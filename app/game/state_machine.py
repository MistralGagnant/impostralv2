"""Game flow engine: QUESTION -> VOTE -> RESOLUTION.

Key properties:
- Every utterance passes through the seat's anonymized TTS voice.
- Every seat prepares privately in the same fixed-duration lock window.
- Locked answers are scrambled, then revealed one at a time, hiding response
  time while giving every player the same information.
- Agents compete independently to pass as human.
- Every active human and agent casts a vote.
- A tied first ballot triggers a runoff restricted to the tied candidates.
- Exactly one seat is eliminated after each vote phase.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import random
import secrets
import time
from typing import Optional

from ..agents.contracts import (
    AgentMatchContext,
    AnswerRequest,
    PublicGameEvent,
    PublicGameView,
    PublicSeat,
    VoteRequest,
)
from ..audio import stt, tts
from ..config import get_settings
from ..i18n import tr
from ..modes import DEFAULT_MODE, is_hardcore, normalize_mode, ruleset_id
from . import events, questions, stats
from .answers import normalize_public_answer
from .events import Phase

log = logging.getLogger("impostral.engine")


class GameEngine:
    def __init__(self, room) -> None:
        self.room = room
        self.language = getattr(room, "language", "en")
        # Small test rooms and legacy controllers may not carry a mode at all.
        self.mode = normalize_mode(getattr(room, "mode", DEFAULT_MODE))
        self.hardcore = is_hardcore(self.mode)
        self.settings = get_settings()
        self.used_questions: set[str] = set()
        self.eliminated_llms: list[str] = []
        # Aggregate first-ballot suspicion from completed prior rounds. It is a
        # transparent deterministic tie-break before a secure draw.
        self.received_votes: dict[str, int] = {}
        self._agent_matches: dict[str, AgentMatchContext] = {}

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    async def run(self) -> None:
        try:
            await self._start_agents()
            await self._broadcast_state()
            await asyncio.sleep(1.0)
            if self._check_end():
                await self._game_over()
                return
            while True:
                self.room.round_no += 1
                await self._system(tr(
                    self.language,
                    "round",
                    round_no=self.room.round_no,
                ))

                await self._question_phase()
                if self._check_end():
                    break
                await self._vote_phase()
                await self._resolution_phase()

                if self._check_end():
                    break
                if self.room.round_no >= self._planned_rounds():
                    break

            await self._game_over()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            log.exception("Game engine crashed")
            self.room.status = "finished"
            self.room.finished_at = time.time()
            self.room.updated_at = self.room.finished_at
            await self._system(tr(self.language, "internal_error"))
        finally:
            if self._agent_matches:
                cleanup_phase = (
                    Phase.GAME_OVER.value
                    if self.room.status == "finished"
                    else self.room.phase.value
                )
                await self._end_agents(
                    self._public_view(phase=cleanup_phase)
                )

    # ------------------------------------------------------------------
    # QUESTION phase
    # ------------------------------------------------------------------
    async def _question_phase(self) -> None:
        self.room.phase = Phase.QUESTION
        planned_rounds = questions.playable_rounds(
            len(self.room.seats),
            int(getattr(self.settings, "max_rounds", 5)),
        )
        selected = questions.pick_question(
            self.used_questions,
            round_no=self.room.round_no,
            total_rounds=planned_rounds,
        )
        if isinstance(selected, str):
            # Keep tests and third-party question providers backwards compatible.
            question = selected
            question_id = selected
            question_act = questions.act_for_round(
                self.room.round_no, planned_rounds
            )
        else:
            localize = getattr(selected, "prompt_for", None)
            question = (
                localize(self.language)
                if callable(localize)
                else selected.prompt
            )
            question_id = selected.id
            question_act = selected.act
        self.used_questions.add(question_id)
        input_duration = max(0.05, float(self.settings.question_seconds))
        processing_duration = max(
            0.0,
            float(getattr(self.settings, "answer_processing_seconds", 0.0)),
        )
        turn_duration = max(
            input_duration + processing_duration,
            float(getattr(self.settings, "answer_turn_seconds", input_duration)),
        )
        if bool(getattr(self.settings, "mock_mode", False)):
            # Local scripted answers need no network processing curtain.
            turn_duration = input_duration + min(processing_duration, 2.0)
        prior_transcript = self.room.render_transcript()
        self.room.current_question = question
        self.room.current_question_id = question_id
        self.room.current_question_act = question_act
        self.room.current_answer_input_seconds = input_duration
        self.room.current_answers = {}
        add_question = getattr(self.room, "add_question", None)
        if callable(add_question):
            try:
                add_question(
                    self.room.round_no,
                    question,
                    question_id=question_id,
                    act=question_act,
                )
            except TypeError:
                # Compatibility with small test rooms and third-party decks.
                add_question(self.room.round_no, question)

        await self.room.broadcast(
            events.srv_phase_change(
                phase=Phase.QUESTION.value,
                deadline=turn_duration,
                prompt=question,
                round_no=self.room.round_no,
                question_id=question_id,
                question_act=question_act,
                answer_input_seconds=input_duration,
            )
        )
        await self._broadcast_state()

        order = list(self.room.alive_seats())
        slots: dict[str, dict[str, object]] = {
            seat.id: {
                "text": tr(self.language, "no_answer"),
                "audio_url": None,
                "text_ready": False,
            }
            for seat in order
        }
        # LOCK: every seat answers privately, at the same time, from the exact
        # same prior-round transcript. This removes order and latency tells.
        answer_tasks = {
            seat.id: asyncio.create_task(
                self._prepare_answer(
                    seat,
                    question,
                    input_duration,
                    prior_transcript,
                    slots[seat.id],
                )
            )
            for seat in order
        }
        try:
            # The lock is elastic: it lifts as soon as every seat is prepared,
            # and `turn_duration` is only the ceiling for stragglers. Waiting it
            # out unconditionally made a round sleep long after the last human
            # had submitted and every agent had answered.
            if answer_tasks:
                await asyncio.wait(
                    answer_tasks.values(), timeout=turn_duration
                )
            for seat in order:
                task = answer_tasks[seat.id]
                if not task.done():
                    task.cancel()
            await asyncio.gather(*answer_tasks.values(), return_exceptions=True)

            # SCRAMBLE + REVEAL: the locked responses play one at a time in a
            # fresh random order. No player sees another answer while composing.
            # Audio is per seat: one failed clip silences that seat only, never
            # the round. Gating the whole round on every seat succeeding turned
            # any single TTS hiccup into a fully mute round.
            random.shuffle(order)
            for position, seat in enumerate(order, start=1):
                await self.room.broadcast(
                    self.room.set_answer_turn(
                        seat.id,
                        position=position,
                        total=len(order),
                        duration=None,
                    )
                )
                slot = slots[seat.id]
                ready = bool(slot.get("text_ready"))
                prepared_audio = slot.get("audio_url")
                await self._reveal_prepared(
                    seat,
                    (
                        str(slot.get("text") or tr(self.language, "no_answer"))
                        if ready
                        else tr(self.language, "no_answer")
                    ),
                    prepared_audio if isinstance(prepared_audio, str) else None,
                    context="answer",
                )
        finally:
            self.room.clear_answer_turn()
            unfinished = [task for task in answer_tasks.values() if not task.done()]
            for task in unfinished:
                task.cancel()
            if unfinished:
                await asyncio.gather(*unfinished, return_exceptions=True)

    async def _collect_answer(
        self, seat, question: str, dur: float, transcript: str
    ) -> str:
        if seat.kind == "llm":
            match = self._agent_matches.get(seat.id)
            if match is None:
                # Small engine tests and legacy local controllers can still call
                # a phase directly. Full games always use the canonical seam.
                return await seat.agent.answer(question, transcript)
            return await seat.agent.answer(AnswerRequest(
                decision_id=(
                    f"{match.match_id}:r{self.room.round_no}:answer:{seat.id}"
                ),
                match=match,
                view=self._public_view(),
                question=question,
                question_id=getattr(self.room, "current_question_id", ""),
                time_budget_ms=max(
                    0,
                    round(
                        float(
                            getattr(
                                self.settings,
                                "answer_processing_seconds",
                                dur,
                            )
                        )
                        * 1000
                    ),
                ),
            ))
        payload = await self._request_human(seat, mode="answer", dur=dur)
        return await self._payload_to_text(payload)

    async def _prepare_answer(
        self,
        seat,
        question: str,
        dur: float,
        transcript: str,
        slot: dict[str, object],
    ) -> None:
        """Prepare text and audio without exposing when either becomes ready."""
        try:
            if (
                seat.kind == "llm"
                and bool(
                    getattr(
                        self.settings,
                        "agent_waits_for_input_window",
                        False,
                    )
                )
            ):
                await asyncio.sleep(
                    dur
                    + max(
                        0.0,
                        float(
                            getattr(
                                self.settings,
                                "input_grace_seconds",
                                0.0,
                            )
                        ),
                    )
                )
            text = await self._collect_answer(seat, question, dur, transcript)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            log.exception("Answer collection failed for %s", seat.id)
            text = ""

        normalized = normalize_public_answer(text)
        slot["text"] = normalized or tr(self.language, "no_answer")
        slot["text_ready"] = True
        # A missing answer is spoken too. The fallback line says nothing the
        # revealed text does not already show, and a mute seat in an otherwise
        # voiced round would itself be a tell.
        slot["audio_url"] = await self._synthesize_with_retry(
            str(slot["text"]), seat.voice, seat.id
        )

    async def _synthesize_with_retry(
        self, text: str, voice: str, seat_id: str
    ) -> Optional[str]:
        """Synthesize speech, retrying transient failures within the lock window.

        A failed clip now costs its own seat its voice and nothing more, but a
        seat revealed in text while the others speak still stands out. A bounded
        retry keeps that rare, without exposing per-seat timing.
        """
        attempts = 1 + max(0, int(getattr(self.settings, "tts_retry_attempts", 1)))
        for attempt in range(attempts):
            try:
                url = await tts.synthesize(text, voice=voice)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                log.exception("Speech preparation failed for %s", seat_id)
                url = None
            if url:
                return url
            if attempt + 1 < attempts:
                await asyncio.sleep(min(0.4, 0.15 * (attempt + 1)))
        return None

    # ------------------------------------------------------------------
    # VOTE phase
    # ------------------------------------------------------------------
    async def _vote_phase(self) -> None:
        self.room.phase = Phase.VOTE
        dur = self.settings.vote_seconds
        await self.room.broadcast(events.srv_phase_change(phase=Phase.VOTE.value, deadline=dur))
        await self._broadcast_state()

        voters = self.room.alive_seats()
        tally = await self._collect_ballot(voters, dur)
        first_tally = dict(tally)
        leaders = self._leaders(tally)

        if len(leaders) > 1:
            record_event = getattr(self.room, "record_public_event", None)
            if callable(record_event):
                record_event(
                    "vote_result",
                    round=self.room.round_no,
                    tally=dict(tally),
                    runoff=list(leaders),
                    eliminated=None,
                )
            await self.room.broadcast(
                events.srv_vote_result(tally=tally, eliminated=None, runoff=leaders)
            )
            await self._system(
                tr(
                    self.language,
                    "tie_runoff",
                    seats=", ".join(leaders),
                )
            )
            await self.room.broadcast(
                events.srv_phase_change(
                    phase=Phase.VOTE.value,
                    deadline=dur,
                    prompt=tr(
                        self.language,
                        "runoff_prompt",
                        seats=", ".join(leaders),
                    ),
                )
            )
            tally = await self._collect_ballot(voters, dur, candidates=leaders)
            leaders = self._leaders(tally)

        # A persistent runoff tie first uses cumulative public suspicion from
        # prior rounds, then a cryptographically secure draw among exact ties.
        tie_break = None
        if len(leaders) == 1:
            eliminated = leaders[0]
        else:
            pool = list(leaders)
            if not pool:
                pool = self.room.alive_ids()
            highest_prior = max(
                (self.received_votes.get(seat_id, 0) for seat_id in pool),
                default=0,
            )
            finalists = [
                seat_id
                for seat_id in pool
                if self.received_votes.get(seat_id, 0) == highest_prior
            ]
            eliminated = secrets.choice(sorted(finalists)) if finalists else None
            if eliminated:
                tie_break = {
                    "method": "prior_suspicion_then_secure_draw",
                    "prior_votes": {
                        seat_id: self.received_votes.get(seat_id, 0)
                        for seat_id in pool
                    },
                    "finalists": sorted(finalists),
                    "selected": eliminated,
                }
                await self._system(tr(
                    self.language,
                    "tie_break",
                    seat=eliminated,
                ))

        for seat_id, count in first_tally.items():
            self.received_votes[seat_id] = (
                self.received_votes.get(seat_id, 0) + count
            )
        record_event = getattr(self.room, "record_public_event", None)
        if callable(record_event):
            record_event(
                "vote_result",
                round=self.room.round_no,
                tally=dict(tally),
                eliminated=eliminated,
                tie_break=tie_break,
            )
        await self.room.broadcast(events.srv_vote_result(
            tally=tally,
            eliminated=eliminated,
            tie_break=tie_break,
        ))
        self._pending_eliminated = eliminated

    async def _collect_ballot(
        self, voters: list, dur: int, candidates: Optional[list[str]] = None
    ) -> dict[str, int]:
        tasks = [
            asyncio.ensure_future(self._collect_vote(seat, dur, candidates=candidates))
            for seat in voters
        ]
        results = await asyncio.gather(*tasks)

        # Keep the ballot that is being counted right now. A runoff overwrites
        # the first ballot on purpose: only the decisive one can eliminate a
        # seat, so only it can cost an agent the game.
        self._last_ballot = {
            voter_id: target_id
            for voter_id, target_id, valid in results
            if valid and target_id
        }
        tally: dict[str, int] = {}
        for voter_id, target_id, valid in results:
            if target_id is None:
                continue
            tally[target_id] = tally.get(target_id, 0) + 1
            voter = self.room.seats.get(voter_id)
            target = self.room.seats.get(target_id)
            if voter and valid:
                voter.votes_total += 1
                if target and target.kind == "llm":
                    voter.votes_correct += 1
        return tally

    async def _collect_vote(
        self, seat, dur: int, candidates: Optional[list[str]] = None
    ) -> tuple[str, Optional[str], bool]:
        alive_others = self.room.alive_ids(exclude=seat.id)
        eligible = (
            [target for target in candidates if target in alive_others]
            if candidates is not None
            else alive_others
        )
        if not eligible:
            return seat.id, None, False

        target = None
        try:
            if seat.kind == "llm":
                match = self._agent_matches.get(seat.id)
                if match is None:
                    target = await seat.agent.vote(
                        self.room.render_transcript(),
                        eligible,
                    )
                else:
                    target = await seat.agent.vote(VoteRequest(
                        decision_id=(
                            f"{match.match_id}:r{self.room.round_no}:"
                            f"{'runoff' if candidates is not None else 'vote'}:"
                            f"{seat.id}"
                        ),
                        match=match,
                        view=self._public_view(),
                        eligible_targets=tuple(eligible),
                        time_budget_ms=max(0, round(float(dur) * 1000)),
                        runoff=candidates is not None,
                    ))
            else:
                payload = await self._request_human(
                    seat, mode="vote", dur=dur, targets=eligible
                )
                target = payload.get("target") if payload else None
        except Exception:  # noqa: BLE001
            log.exception("Vote collection failed for %s", seat.id)

        valid = target in eligible
        if not valid:
            # Silence cannot strategically hurt a random opponent. On the first
            # ballot it counts against the silent seat; during a runoff, only a
            # tied candidate can receive their own timeout penalty.
            target = seat.id if candidates is None or seat.id in candidates else None
            log.info("Applied timeout vote penalty for %s to %s", seat.id, target)
        return seat.id, target, valid

    def _disqualify_human_hunters(self, eliminated: str) -> None:
        """Sink every agent whose decisive vote sent a human home.

        Agents are told to hunt each other, never the humans. Breaking that
        rule costs the game: the agent stays at the table and keeps voting, but
        it is out of the running. The penalty is never announced, because
        naming the punished seats would tell the humans exactly which seats are
        AIs. Hardcore rooms skip this entirely: there, an AI wins by surviving,
        whoever it eliminated, and it is briefed to hunt the humans on purpose.
        """
        if self.hardcore:
            return
        hunters = []
        for seat_id, target in getattr(self, "_last_ballot", {}).items():
            voter = self.room.seats.get(seat_id)
            if target == eliminated and voter and voter.kind == "llm":
                voter.disqualified = True
                hunters.append(seat_id)
        if hunters:
            log.info(
                "Agents disqualified for eliminating human %s: %s",
                eliminated,
                ", ".join(hunters),
            )

    @staticmethod
    def _leaders(tally: dict[str, int]) -> list[str]:
        if not tally:
            return []
        top = max(tally.values())
        return [sid for sid, votes in tally.items() if votes == top]

    # ------------------------------------------------------------------
    # RESOLUTION phase
    # ------------------------------------------------------------------
    async def _resolution_phase(self) -> None:
        self.room.phase = Phase.RESOLUTION
        eliminated = getattr(self, "_pending_eliminated", None)
        if eliminated and eliminated in self.room.seats:
            seat = self.room.seats[eliminated]
            seat.alive = False
            seat.eliminated_round = self.room.round_no
            if seat.kind == "llm":
                self.eliminated_llms.append(seat.id)
            else:
                self._disqualify_human_hunters(seat.id)
            role = seat.kind if self.settings.reveal_role_on_elimination else None
            model = seat.model if role == "llm" else None
            await self.room.broadcast(
                events.srv_elimination(seat=eliminated, role=role, model=model)
            )
            if role == "llm":
                await self._system(
                    tr(
                        self.language,
                        "eliminated_ai_model",
                        seat=eliminated,
                        model=model,
                    )
                    if model else tr(
                        self.language,
                        "eliminated_ai",
                        seat=eliminated,
                    )
                )
            elif role == "human":
                await self._system(tr(
                    self.language,
                    "eliminated_human",
                    seat=eliminated,
                ))
            else:
                await self._system(tr(
                    self.language,
                    "eliminated_hidden",
                    seat=eliminated,
                ))
            record_event = getattr(self.room, "record_public_event", None)
            if callable(record_event):
                record_event(
                    "elimination",
                    round=self.room.round_no,
                    seat=eliminated,
                    role=role,
                    model=model,
                )
        else:
            await self._system(tr(self.language, "no_elimination"))
        await self._broadcast_state()
        await asyncio.sleep(1.5)

    # ------------------------------------------------------------------
    # End of game
    # ------------------------------------------------------------------
    def _planned_rounds(self) -> int:
        """Rounds this room can actually play before a two-seat showdown.

        The engine loop and the terminal round-limit share this bound so the
        server never promises the client more rounds than it will run.
        """
        return questions.playable_rounds(
            len(self.room.seats),
            int(getattr(self.settings, "max_rounds", 5)),
        )

    def _check_end(self) -> bool:
        return bool(self._end_reason(include_round_limit=False))

    def _end_reason(self, *, include_round_limit: bool = True) -> str:
        """Return the first terminal condition in ruleset order."""
        if not self.room.llms_alive():
            return "all_agents_exposed"
        if not self.room.humans_alive():
            return "human_extinction"
        if len(self.room.alive_seats()) <= 2:
            return "final_duel"
        if include_round_limit and self.room.round_no >= self._planned_rounds():
            return "round_limit"
        return ""

    async def _game_over(self) -> None:
        self.room.phase = Phase.GAME_OVER
        self.room.status = "finished"
        self.room.finished_at = time.time()
        self.room.updated_at = self.room.finished_at
        surviving_humans = [s.id for s in self.room.humans_alive()]
        surviving_llms = [s.id for s in self.room.llms_alive()]
        # An agent that voted a human out survived without winning.
        eligible_llms = [
            s.id for s in self.room.llms_alive() if not s.disqualified
        ]
        all_humans = [
            seat.id
            for seat in self.room.seats.values()
            if seat.kind == "human"
        ]
        reason = self._end_reason() or "round_limit"
        if reason == "final_duel" and surviving_humans and eligible_llms:
            # A last human against a last agent is a degenerate ballot: the
            # agent can never be exposed, so the duel is a shared victory. The
            # human is credited for surviving and the agent for staying hidden.
            # Humans win as one side here too, eliminated seats included.
            winners = all_humans + eligible_llms
            winner_type = "draw"
            result = tr(
                self.language,
                "final_duel_shared",
                human=surviving_humans[0],
                agent=eligible_llms[0],
            )
        elif eligible_llms:
            winners = eligible_llms
            winner_type = "agents"
            if reason == "human_extinction":
                result = tr(
                    self.language,
                    "agents_no_humans",
                    winners=", ".join(winners),
                )
            else:
                result = tr(
                    self.language,
                    (
                        "agents_round_limit_many"
                        if len(winners) > 1
                        else "agents_round_limit_one"
                    ),
                    winners=", ".join(winners),
                    winner=winners[0],
                )
        elif surviving_humans:
            # Humans are the one cooperative side from the original rules:
            # exposing every agent is a team victory, including for humans who
            # were eliminated earlier. Agents remain individual competitors.
            winners = all_humans
            winner_type = "humans"
            # Surviving agents with no claim left were all caught hunting a
            # human, which is a different story than a clean sweep.
            result = tr(
                self.language,
                "humans_win_hunted" if surviving_llms else "humans_win",
            )
        else:
            winners = []
            winner_type = "none"
            result = tr(self.language, "no_winner")
        roles = {s.id: s.kind for s in self.room.seats.values()}
        models = {s.id: s.model for s in self.room.seats.values() if s.model}
        agents = {
            seat.id: {
                "agent_id": getattr(seat, "agent_id", ""),
                "provider": getattr(seat, "agent_provider", ""),
                "version": getattr(seat, "agent_version", ""),
                "model": seat.model or "",
            }
            for seat in self.room.seats.values()
            if seat.kind == "llm"
        }
        stats.record_game(self.room, winners)
        game_over_payload = events.srv_game_over(
            winner=winner_type,
            winners=winners, roles=roles,
            models=models,
            agents=agents,
            message=result,
            reason=reason,
        )
        self.room.game_over_payload = dict(game_over_payload)
        await self.room.broadcast(game_over_payload)
        await self._system(tr(
            self.language,
            "game_over",
            result=result,
        ))
        await self._end_agents(self._public_view(phase=Phase.GAME_OVER.value))

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    async def _reveal_prepared(
        self,
        seat,
        text: str,
        audio_url: Optional[str],
        context: str = "",
    ) -> None:
        """Reveal a prepared utterance and wait for uniform client playback."""
        reveal_started = asyncio.get_running_loop().time()
        self.room.add_utterance(seat.id, text, context)
        playback_id = secrets.token_urlsafe(12) if audio_url else ""
        playback_done = self.room.expect_playback(playback_id) if playback_id else None
        await self.room.broadcast(
            events.srv_utterance(
                seat=seat.id, text=text, audio_url=audio_url, context=context,
                playback_id=playback_id,
            )
        )
        if playback_done is not None:
            try:
                timeout = max(
                    0.05,
                    float(getattr(self.settings, "playback_timeout_seconds", 12)),
                )
                await asyncio.wait_for(playback_done, timeout=timeout)
            except asyncio.TimeoutError:
                self.room.cancel_playback(playback_id)
                await self.room.broadcast(
                    events.srv_playback_cancel(playback_id=playback_id)
                )
            except asyncio.CancelledError:
                self.room.cancel_playback(playback_id)
                raise
        minimum = max(
            0.0,
            float(getattr(self.settings, "answer_reveal_min_seconds", 0.0)),
        )
        elapsed = asyncio.get_running_loop().time() - reveal_started
        await asyncio.sleep(max(0.0, minimum - elapsed))
        await asyncio.sleep(self.settings.reveal_gap_seconds)

    async def _request_human(self, seat, *, mode: str, dur: float,
                             targets: Optional[list[str]] = None) -> Optional[dict]:
        """Request one human input and accept only its matching response."""
        request_id = secrets.token_urlsafe(12)
        timeout = max(0.05, float(dur))
        grace = max(
            0.0,
            float(getattr(self.settings, "input_grace_seconds", 0.75)),
        )
        acceptance_timeout = timeout + grace
        # Create the future before sending so an immediate response cannot be lost.
        fut = self.room.expect_input(
            seat.id,
            request_id,
            deadline_at=time.time() + acceptance_timeout,
        )
        await self.room.send_seat(
            seat.id,
            events.srv_request_input(
                mode=mode,
                deadline=timeout,
                request_id=request_id,
                targets=targets,
            ),
        )
        try:
            return await asyncio.wait_for(fut, timeout=acceptance_timeout)
        except asyncio.TimeoutError:
            return None
        finally:
            self.room.cancel_input(seat.id, request_id)

    async def _payload_to_text(self, payload: Optional[dict]) -> str:
        if not payload:
            return ""
        audio_b64 = payload.get("audio_b64")
        audio_mime = payload.get("audio_mime") or "audio/webm"
        fallback = (payload.get("text") or "").strip()
        audio_bytes = None
        if audio_b64:
            try:
                audio_bytes = base64.b64decode(audio_b64, validate=True)
                if len(audio_bytes) > 1_500_000:
                    audio_bytes = None
            except Exception:  # noqa: BLE001
                audio_bytes = None
        text = await stt.transcribe(
            audio_bytes,
            mime_type=audio_mime,
            fallback_text=fallback,
            language=getattr(self, "language", "en"),
        )
        return normalize_public_answer(text)

    async def _broadcast_state(self) -> None:
        seats = [
            seat.public(
                reveal_role=(
                    bool(
                        getattr(
                            self.settings,
                            "reveal_role_on_elimination",
                            True,
                        )
                    )
                    and not seat.alive
                )
            )
            for seat in self.room.seats.values()
        ]
        await self.room.broadcast(
            events.srv_room_state(
                seats=seats, phase=self.room.phase.value, round_no=self.room.round_no,
                you=None,
                lobby_wait_remaining=(
                    0
                    if getattr(self.room, "started", False)
                    and self.room.phase == Phase.LOBBY
                    else None
                ),
                prompt=getattr(self.room, "current_question", ""),
                question_act=getattr(self.room, "current_question_act", ""),
                answer_input_seconds=(
                    getattr(self.room, "current_answer_input_seconds", 0.0) or None
                ),
                round_limit=questions.playable_rounds(
                    len(self.room.seats),
                    int(getattr(self.settings, "max_rounds", 5)),
                ),
                answers=getattr(self.room, "current_answers", {}),
                language=getattr(self.room, "language", "en"),
                mode=self.mode,
            )
        )

    async def _system(self, text: str) -> None:
        await self.room.broadcast(events.srv_system(text=text))

    # ------------------------------------------------------------------
    # Autonomous-player contract
    # ------------------------------------------------------------------
    async def _start_agents(self) -> None:
        """Initialize every entity with isolated role-safe match metadata."""
        for seat in self.room.seats.values():
            if seat.kind != "llm" or seat.agent is None:
                continue
            context = AgentMatchContext(
                match_id=self.room.agent_match_id,
                seat_id=seat.id,
                language=self.language,
                ruleset_id=ruleset_id(self.mode),
                max_rounds=int(getattr(self.settings, "max_rounds", 5)),
                seat_count=len(self.room.seats),
                objective=(
                    "survive_by_any_elimination"
                    if self.hardcore
                    else "survive_to_terminal"
                ),
                protocol_version="1",
            )
            if self.language not in seat.agent.identity.supported_languages:
                raise ValueError(
                    f"{seat.agent.identity.agent_id} does not support "
                    f"{self.language}"
                )
            await seat.agent.start_match(context)
            self._agent_matches[seat.id] = context

    async def _end_agents(self, final_view: PublicGameView) -> None:
        """Release all entity-local state without ever exposing private roles."""
        for seat_id, context in list(self._agent_matches.items()):
            seat = self.room.seats.get(seat_id)
            if seat is None or seat.agent is None:
                continue
            try:
                await seat.agent.end_match(final_view)
            except Exception:  # noqa: BLE001
                log.exception("Agent cleanup failed for %s", context.seat_id)
        self._agent_matches.clear()

    def _public_view(self, *, phase: str | None = None) -> PublicGameView:
        """Build the exact immutable projection shared with every agent."""
        public_phase = phase or self.room.phase.value
        reveal_all = public_phase == Phase.GAME_OVER.value
        # The humans are told what an eliminated seat was; the agents never
        # are. An AI that voted a human out has already lost, and it must keep
        # playing without knowing it. Roles reach agents only in the terminal
        # reveal, when nothing is left to play.
        public_seats = tuple(
            PublicSeat(
                seat_id=seat.id,
                alive=seat.alive,
                revealed_role=seat.kind if reveal_all else None,
            )
            for seat in self.room.seats.values()
        )
        raw_events = (
            self.room.public_event_snapshot()
            if callable(getattr(self.room, "public_event_snapshot", None))
            else ()
        )
        public_events: list[PublicGameEvent] = []
        for sequence, event in enumerate(raw_events, start=1):
            kind = str(event.get("type") or "system")
            revealed_role = (
                str(event.get("role"))
                if reveal_all and kind == "elimination" and event.get("role")
                else None
            )
            public_events.append(PublicGameEvent(
                sequence=sequence,
                kind="answer" if (
                    kind == "utterance" and event.get("context") == "answer"
                ) else kind,
                round_no=int(event.get("round") or 0),
                seat_id=str(event.get("seat") or ""),
                text=str(event.get("text") or event.get("prompt") or ""),
                target_ids=tuple(
                    str(target)
                    for target in (
                        event.get("runoff")
                        or event.get("targets")
                        or ()
                    )
                ),
                tally=tuple(
                    sorted(
                        (
                            str(target),
                            int(count),
                        )
                        for target, count in (
                            event.get("tally") or {}
                        ).items()
                    )
                ),
                revealed_role=revealed_role,
            ))
        return PublicGameView(
            round_no=self.room.round_no,
            phase=public_phase,
            seats=public_seats,
            events=tuple(public_events),
            question_id=getattr(self.room, "current_question_id", ""),
            question=getattr(self.room, "current_question", ""),
            question_act=getattr(self.room, "current_question_act", ""),
        )
