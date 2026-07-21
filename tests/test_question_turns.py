"""Sequential answer-turn timing and input-correlation tests."""
from __future__ import annotations

import asyncio
import time
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.game import events
from app.game.events import Phase
from app.game.state_machine import GameEngine
from app.rooms import Room


class StubAgent:
    def __init__(self, answer: str, delay: float = 0.0) -> None:
        self.output = answer
        self.delay = delay
        self.transcripts: list[str] = []
        self.called_at: float | None = None

    async def answer(self, question: str, transcript: str) -> str:
        self.called_at = time.perf_counter()
        self.transcripts.append(transcript)
        if self.delay:
            await asyncio.sleep(self.delay)
        return self.output


class StubSeat:
    def __init__(
        self, seat_id: str, kind: str, agent: StubAgent | None = None
    ) -> None:
        self.id = seat_id
        self.kind = kind
        self.agent = agent
        self.voice = "test"
        self.alive = True
        self.connected = kind == "human"

    def public(self, *, reveal_role: bool = False) -> dict:
        state = {"id": self.id, "alive": self.alive}
        if reveal_role:
            state["role"] = self.kind
        return state


class StubRoom:
    def __init__(self, seats: list[StubSeat]) -> None:
        self.seats = {seat.id: seat for seat in seats}
        self.phase = Phase.LOBBY
        self.round_no = 1
        self.started = True
        self.messages: list[tuple[float, dict]] = []
        self.direct_messages: list[tuple[str, dict]] = []
        self.transcript: list[dict] = []
        self._pending: dict[str, asyncio.Future] = {}
        self._request_ids: dict[str, str] = {}

    def alive_seats(self) -> list[StubSeat]:
        return [seat for seat in self.seats.values() if seat.alive]

    def render_transcript(self) -> str:
        return "\n".join(
            f"{item['seat']}: {item['text']}" for item in self.transcript
        )

    def add_utterance(self, seat_id: str, text: str, context: str = "") -> None:
        self.transcript.append({"seat": seat_id, "text": text, "context": context})

    async def broadcast(self, message: dict) -> None:
        self.messages.append((time.perf_counter(), message))

    async def send_seat(self, seat_id: str, message: dict) -> bool:
        self.direct_messages.append((seat_id, message))
        future = self._pending[seat_id]
        asyncio.get_running_loop().call_soon(
            future.set_result,
            {"text": f"answer from {seat_id}", "request_id": message["request_id"]},
        )
        return True

    def expect_input(
        self, seat_id: str, request_id: str, deadline_at: float
    ) -> asyncio.Future:
        future = asyncio.get_running_loop().create_future()
        self._pending[seat_id] = future
        self._request_ids[seat_id] = request_id
        return future

    def cancel_input(self, seat_id: str, request_id: str = "") -> None:
        if request_id and self._request_ids.get(seat_id) != request_id:
            return
        self._pending.pop(seat_id, None)
        self._request_ids.pop(seat_id, None)

    def set_answer_turn(
        self, seat_id: str, *, position: int, total: int, duration: float
    ) -> dict:
        return events.srv_answer_turn(
            seat=seat_id,
            position=position,
            total=total,
            deadline=duration,
        )

    def clear_answer_turn(self) -> None:
        return

    def expect_playback(self, playback_id: str):
        return None


class CaptureSocket:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def send_json(self, message: dict) -> None:
        self.messages.append(message)


def make_engine(room: StubRoom, *, input_seconds: float, turn_seconds: float) -> GameEngine:
    engine = GameEngine(room)
    engine.settings = SimpleNamespace(
        question_seconds=input_seconds,
        answer_turn_seconds=turn_seconds,
        reveal_gap_seconds=0,
        answer_reveal_min_seconds=0,
    )
    return engine


class QuestionTurnTest(unittest.IsolatedAsyncioTestCase):
    async def test_answers_lock_together_then_reveal_in_random_order(self) -> None:
        human = StubSeat("Player A", "human")
        agent = StubAgent("agent answer")
        ai = StubSeat("Player B", "llm", agent)
        room = StubRoom([human, ai])
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.04)
        started = time.perf_counter()

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch(
                "app.game.state_machine.random.shuffle",
                side_effect=lambda items: items.reverse(),
            ),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(return_value=None),
            ),
        ):
            await engine._question_phase()

        turn_messages = [
            (sent_at, message)
            for sent_at, message in room.messages
            if message["type"] == "answer_turn"
        ]
        utterances = [
            (sent_at, message)
            for sent_at, message in room.messages
            if message["type"] == "utterance"
        ]

        self.assertEqual(
            [message["seat"] for _, message in turn_messages],
            ["Player B", "Player A"],
        )
        self.assertEqual(len(utterances), 2)
        phase_sent_at, phase_message = next(
            item for item in room.messages if item[1]["type"] == "phase_change"
        )
        self.assertEqual(phase_message["question_act"], "TRACE")
        self.assertEqual(phase_message["round"], 1)
        self.assertEqual(phase_message["answer_input_seconds"], 0.05)
        self.assertGreaterEqual(utterances[0][0] - phase_sent_at, 0.03)
        self.assertLess(time.perf_counter() - started, 0.09)
        for sent_at, turn in turn_messages:
            reveal_at = next(
                timestamp
                for timestamp, utterance in utterances
                if utterance["seat"] == turn["seat"]
            )
            self.assertGreaterEqual(reveal_at, sent_at)
            self.assertIsNone(turn["deadline"])
            self.assertNotIn("role", turn)
            self.assertNotIn("model", turn)
            self.assertNotIn("connected", turn)

        self.assertEqual(len(room.direct_messages), 1)
        direct_seat, request = room.direct_messages[0]
        self.assertEqual(direct_seat, "Player A")
        self.assertEqual(request["mode"], "answer")
        self.assertEqual(request["deadline"], 0.05)
        self.assertGreaterEqual(len(request["request_id"]), 8)
        self.assertEqual(agent.transcripts, [""])

    async def test_the_lock_lifts_once_every_seat_has_answered(self) -> None:
        """`answer_turn_seconds` is a ceiling, not a mandatory wait."""
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "llm", StubAgent("agent answer")),
        ])
        engine = make_engine(room, input_seconds=0.05, turn_seconds=1.5)
        started = time.perf_counter()

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(return_value=None),
            ),
        ):
            await engine._question_phase()

        self.assertLess(time.perf_counter() - started, 0.5)
        texts = {
            message["seat"]: message["text"]
            for _, message in room.messages
            if message["type"] == "utterance"
        }
        self.assertEqual(texts["Player A"], "answer from Player A")
        self.assertEqual(texts["Player B"], "agent answer")

    async def test_a_slow_agent_falls_back_without_extending_its_turn(self) -> None:
        room = StubRoom([
            StubSeat("Player A", "llm", StubAgent("too late", delay=0.2)),
        ])
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.02)
        started = time.perf_counter()

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(return_value=None),
            ),
        ):
            await engine._question_phase()

        elapsed = time.perf_counter() - started
        utterance = next(
            message for _, message in room.messages if message["type"] == "utterance"
        )
        self.assertEqual(utterance["text"], "No answer.")
        self.assertLess(elapsed, 0.12)

    async def test_agent_generation_waits_for_the_human_capture_window(self) -> None:
        agent = StubAgent("agent answer")
        room = StubRoom([StubSeat("Player A", "llm", agent)])
        engine = make_engine(room, input_seconds=0.05, turn_seconds=0.08)
        engine.settings.agent_waits_for_input_window = True
        started = time.perf_counter()

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(return_value=None),
            ),
        ):
            await engine._question_phase()

        self.assertIsNotNone(agent.called_at)
        self.assertGreaterEqual(agent.called_at - started, 0.045)

    async def test_every_agent_receives_only_the_same_prior_round_context(self) -> None:
        agent = StubAgent("agent answer")
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "llm", agent),
        ])
        room.add_utterance("Player C", "an earlier answer", "answer")
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.02)

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch("app.game.state_machine.random.shuffle", return_value=None),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(return_value=None),
            ),
        ):
            await engine._question_phase()

        self.assertEqual(len(agent.transcripts), 1)
        self.assertIn("Player C: an earlier answer", agent.transcripts[0])
        self.assertNotIn("answer from Player A", agent.transcripts[0])

    async def test_valid_text_survives_when_voice_is_not_ready(self) -> None:
        room = StubRoom([
            StubSeat("Player A", "llm", StubAgent("private partial answer")),
        ])
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.02)

        async def slow_speech(text: str, *, voice: str):
            await asyncio.sleep(0.2)
            return "/audio/late"

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(side_effect=slow_speech),
            ),
        ):
            await engine._question_phase()

        utterance = next(
            message for _, message in room.messages if message["type"] == "utterance"
        )
        self.assertEqual(utterance["text"], "private partial answer")
        self.assertIsNone(utterance["audio_url"])

    async def test_one_voice_failure_never_silences_the_other_seats(self) -> None:
        """A failed clip costs its own seat its voice, never the whole round."""
        room = StubRoom([
            StubSeat("Player A", "llm", StubAgent("voiced answer")),
            StubSeat("Player B", "llm", StubAgent("mute answer")),
        ])
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.5)

        async def mixed_speech(text: str, *, voice: str):
            if text == "mute answer":
                return None
            return f"/audio/{text.replace(' ', '-')}"

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch("app.game.state_machine.random.shuffle", return_value=None),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(side_effect=mixed_speech),
            ),
        ):
            await engine._question_phase()

        audio = {
            message["seat"]: message["audio_url"]
            for _, message in room.messages
            if message["type"] == "utterance"
        }
        self.assertEqual(audio["Player A"], "/audio/voiced-answer")
        self.assertIsNone(audio["Player B"])

    async def test_a_seat_without_an_answer_still_speaks(self) -> None:
        """The fallback line is voiced too, so no seat goes mute for free."""
        room = StubRoom([StubSeat("Player A", "llm", StubAgent(""))])
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.5)
        spoken: list[str] = []

        async def record_speech(text: str, *, voice: str):
            spoken.append(text)
            return "/audio/fallback"

        with (
            patch("app.game.state_machine.questions.pick_question", return_value="Prompt?"),
            patch(
                "app.game.state_machine.tts.synthesize",
                new=AsyncMock(side_effect=record_speech),
            ),
        ):
            await engine._question_phase()

        utterance = next(
            message for _, message in room.messages if message["type"] == "utterance"
        )
        self.assertEqual(utterance["text"], "No answer.")
        self.assertEqual(spoken, ["No answer."])
        self.assertEqual(utterance["audio_url"], "/audio/fallback")

    async def test_text_only_reveal_keeps_a_readable_fixed_pace(self) -> None:
        seat = StubSeat("Player A", "llm", StubAgent("answer"))
        room = StubRoom([seat])
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.02)
        engine.settings.answer_reveal_min_seconds = 0.03
        started = time.perf_counter()

        await engine._reveal_prepared(
            seat,
            "A readable local answer.",
            None,
            context="answer",
        )

        self.assertGreaterEqual(time.perf_counter() - started, 0.025)

    async def test_stalled_voice_is_cancelled_before_the_next_reveal(self) -> None:
        seat = StubSeat("Player A", "llm", StubAgent("answer"))
        room = StubRoom([seat])
        playback = asyncio.get_running_loop().create_future()
        cancelled: list[str] = []
        room.expect_playback = lambda playback_id: playback
        room.cancel_playback = cancelled.append
        engine = make_engine(room, input_seconds=0.01, turn_seconds=0.02)
        engine.settings.playback_timeout_seconds = 0.05

        await engine._reveal_prepared(
            seat,
            "A stalled voice.",
            "/audio/stalled",
            context="answer",
        )

        utterance = next(
            message for _, message in room.messages if message["type"] == "utterance"
        )
        cancellation = next(
            message
            for _, message in room.messages
            if message["type"] == "playback_cancel"
        )
        self.assertEqual(cancelled, [utterance["playback_id"]])
        self.assertEqual(cancellation["playback_id"], utterance["playback_id"])

    async def test_a_human_can_reconnect_after_their_turn_opens(self) -> None:
        human = StubSeat("Player A", "human")
        human.connected = False
        room = StubRoom([human])
        engine = make_engine(room, input_seconds=0.05, turn_seconds=0.05)

        payload = await engine._request_human(
            human,
            mode="answer",
            dur=0.05,
        )

        self.assertEqual(payload["text"], "answer from Player A")
        self.assertEqual(room.direct_messages[0][0], "Player A")

    async def test_room_ignores_a_late_response_for_an_old_request(self) -> None:
        room = Room(id="request-guard")
        future = room.expect_input(
            "Player A",
            "current_request",
            deadline_at=time.time() + 1,
        )

        accepted = room.resolve_input(
            "Player A",
            {"text": "late"},
            request_id="previous_request",
        )
        self.assertFalse(accepted)
        self.assertFalse(future.done())

        accepted = room.resolve_input(
            "Player A",
            {"text": "current"},
            request_id="current_request",
        )
        self.assertTrue(accepted)
        self.assertEqual(await future, {"text": "current"})

    async def test_reconnect_deadlines_report_only_remaining_time(self) -> None:
        room = Room(id="reconnect")
        room.phase = Phase.QUESTION
        room.set_answer_turn(
            "Player A",
            position=1,
            total=3,
            duration=0.08,
        )
        await asyncio.sleep(0.02)

        message = room.current_answer_turn()
        self.assertIsNotNone(message)
        self.assertEqual(message["seat"], "Player A")
        self.assertGreater(message["deadline"], 0)
        self.assertLess(message["deadline"], 0.08)

    async def test_reconnected_input_uses_its_real_remaining_deadline(self) -> None:
        room = Room(id="input-reconnect")
        socket = CaptureSocket()
        room._ws_of_seat["Player A"] = socket
        request_id = "current_request"
        room.expect_input(
            "Player A",
            request_id,
            deadline_at=time.time() + 0.08,
        )
        request = events.srv_request_input(
            mode="answer",
            deadline=0.08,
            request_id=request_id,
        )

        await room.send_seat("Player A", request)
        await asyncio.sleep(0.02)
        resent = await room.resend_pending("Player A")

        self.assertTrue(resent)
        self.assertEqual(len(socket.messages), 2)
        self.assertEqual(socket.messages[1]["request_id"], request_id)
        self.assertGreater(socket.messages[1]["deadline"], 0)
        self.assertLess(socket.messages[1]["deadline"], socket.messages[0]["deadline"])
        room.cancel_input("Player A", request_id)


if __name__ == "__main__":
    unittest.main()
