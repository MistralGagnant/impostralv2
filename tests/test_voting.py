"""Voting and elimination rules without network calls."""
from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.game.state_machine import GameEngine


class StubAgent:
    def __init__(self, votes: list[str] | None = None, *, error: bool = False) -> None:
        self.votes = list(votes or [])
        self.error = error
        self.eligible_history: list[list[str]] = []

    async def vote(self, transcript: str, eligible: list[str]) -> str:
        self.eligible_history.append(list(eligible))
        if self.error:
            raise RuntimeError("agent vote failed")
        return self.votes.pop(0)


class StubSeat:
    def __init__(
        self,
        seat_id: str,
        kind: str,
        agent: StubAgent | None = None,
        model: str | None = None,
    ) -> None:
        self.id = seat_id
        self.kind = kind
        self.agent = agent
        self.model = model
        self.alive = True
        self.connected = kind == "human"
        self.votes_total = 0
        self.votes_correct = 0
        self.eliminated_round = None
        self.disqualified = False

    def public(self, *, reveal_role: bool = False) -> dict:
        state = {
            "id": self.id,
            "alive": self.alive,
            "connected": self.connected,
        }
        if reveal_role:
            state["role"] = self.kind
        return state


class StubRoom:
    def __init__(self, seats: list[StubSeat]) -> None:
        self.seats = {seat.id: seat for seat in seats}
        self.round_no = 1
        self.phase = None
        self.messages: list[dict] = []

    def alive_seats(self) -> list[StubSeat]:
        return [seat for seat in self.seats.values() if seat.alive]

    def alive_ids(self, exclude: str | None = None) -> list[str]:
        return [seat.id for seat in self.alive_seats() if seat.id != exclude]

    def llms_alive(self) -> list[StubSeat]:
        return [seat for seat in self.alive_seats() if seat.kind == "llm"]

    def humans_alive(self) -> list[StubSeat]:
        return [seat for seat in self.alive_seats() if seat.kind == "human"]

    def render_transcript(self) -> str:
        return ""

    async def broadcast(self, message: dict) -> None:
        self.messages.append(message)


def make_engine(room: StubRoom) -> GameEngine:
    engine = GameEngine(room)
    engine.settings = SimpleNamespace(
        vote_seconds=1,
        reveal_role_on_elimination=True,
    )
    return engine


class VotingTest(unittest.IsolatedAsyncioTestCase):
    def test_game_ends_as_soon_as_only_ais_remain(self) -> None:
        human = StubSeat("Player A", "human")
        human.alive = False
        room = StubRoom([
            human,
            StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest"),
            StubSeat("Player C", "llm", StubAgent(), "mistral-small-latest"),
        ])

        self.assertTrue(make_engine(room)._check_end())

    def test_round_limit_does_not_skip_the_final_round_vote(self) -> None:
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "human"),
            StubSeat("Player C", "llm", StubAgent()),
            StubSeat("Player D", "llm", StubAgent()),
        ])
        room.round_no = 5
        engine = make_engine(room)
        engine.settings.max_rounds = 5

        self.assertFalse(engine._check_end())
        self.assertEqual(engine._end_reason(), "round_limit")

    async def test_game_over_announces_ai_victory_when_no_humans_remain(self) -> None:
        human = StubSeat("Player A", "human")
        human.alive = False
        room = StubRoom([
            human,
            StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest"),
            StubSeat("Player C", "llm", StubAgent(), "mistral-small-latest"),
        ])
        engine = make_engine(room)

        with patch("app.game.state_machine.stats.record_game"):
            await engine._game_over()

        game_over = next(msg for msg in room.messages if msg["type"] == "game_over")
        self.assertEqual(
            game_over["message"],
            "Player B, Player C survived independently. No human remains.",
        )
        self.assertEqual(game_over["reason"], "human_extinction")
        self.assertEqual(game_over["models"], {
            "Player B": "mistral-large-latest",
            "Player C": "mistral-small-latest",
        })

    async def test_both_sides_win_the_final_human_ai_duel(self) -> None:
        eliminated_human = StubSeat("Player C", "human")
        eliminated_human.alive = False
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest"),
            eliminated_human,
        ])
        engine = make_engine(room)

        self.assertTrue(engine._check_end())
        with patch("app.game.state_machine.stats.record_game"):
            await engine._game_over()

        game_over = next(msg for msg in room.messages if msg["type"] == "game_over")
        self.assertEqual(game_over["winner"], "draw")
        # Humans win as one side, the surviving agent wins for staying hidden.
        self.assertEqual(
            game_over["winners"], ["Player A", "Player C", "Player B"]
        )
        self.assertEqual(game_over["reason"], "final_duel")
        self.assertIn("Both sides win", game_over["message"])

    async def test_a_lone_human_wins_the_final_duel_by_surviving(self) -> None:
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest"),
        ])
        engine = make_engine(room)

        with patch("app.game.state_machine.stats.record_game"):
            await engine._game_over()

        game_over = next(msg for msg in room.messages if msg["type"] == "game_over")
        self.assertEqual(game_over["winner"], "draw")
        self.assertEqual(game_over["winners"], ["Player A", "Player B"])

    async def test_humans_win_when_every_ai_is_eliminated(self) -> None:
        ai = StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest")
        ai.alive = False
        eliminated_human = StubSeat("Player C", "human")
        eliminated_human.alive = False
        room = StubRoom([
            StubSeat("Player A", "human"),
            ai,
            eliminated_human,
        ])
        engine = make_engine(room)
        engine.eliminated_llms = [ai.id]

        with patch("app.game.state_machine.stats.record_game"):
            await engine._game_over()

        game_over = next(msg for msg in room.messages if msg["type"] == "game_over")
        self.assertEqual(game_over["winner"], "humans")
        self.assertEqual(game_over["winners"], ["Player A", "Player C"])
        self.assertEqual(room.game_over_payload, game_over)
        self.assertEqual(
            game_over["message"],
            "The humans have won — every AI was eliminated.",
        )

    async def test_every_seat_votes_and_a_tie_triggers_a_restricted_runoff(self) -> None:
        agent_b = StubAgent(["Player A", "Player A"])
        agent_d = StubAgent(["Player B", "Player B"])
        seats = [
            StubSeat("Player A", "human"),
            StubSeat("Player B", "llm", agent_b),
            StubSeat("Player C", "human"),
            StubSeat("Player D", "llm", agent_d),
        ]
        room = StubRoom(seats)
        engine = make_engine(room)
        human_votes = {
            "Player A": ["Player B", "Player B"],
            "Player C": ["Player A", "Player A"],
        }
        human_eligible_history = {"Player A": [], "Player C": []}

        async def request_human(seat, **kwargs):
            human_eligible_history[seat.id].append(kwargs["targets"])
            return {"target": human_votes[seat.id].pop(0)}

        engine._request_human = request_human
        with patch("app.game.state_machine.random.choice", side_effect=lambda items: items[0]):
            await engine._vote_phase()

        results = [msg for msg in room.messages if msg["type"] == "vote_result"]
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["tally"], {"Player B": 2, "Player A": 2})
        self.assertEqual(results[0]["runoff"], ["Player B", "Player A"])
        self.assertIsNone(results[0]["eliminated"])
        self.assertEqual(sum(results[1]["tally"].values()), len(seats))
        self.assertIn(results[1]["eliminated"], {"Player A", "Player B"})
        self.assertEqual(human_eligible_history["Player A"][1], ["Player B"])
        self.assertEqual(
            human_eligible_history["Player C"][1], ["Player B", "Player A"]
        )
        self.assertEqual(agent_b.eligible_history[1], ["Player A"])
        self.assertEqual(agent_d.eligible_history[1], ["Player B", "Player A"])
        self.assertEqual(seats[1].votes_total, 2)
        self.assertEqual(seats[3].votes_total, 2)
        self.assertEqual(seats[0].votes_total, 2)
        self.assertEqual(seats[2].votes_total, 2)

    async def test_missing_invalid_and_failed_votes_penalize_the_silent_seat(self) -> None:
        seats = [
            StubSeat("Player A", "human"),
            StubSeat("Player B", "llm", StubAgent(error=True)),
            StubSeat("Player C", "llm", StubAgent(["not eligible"])),
        ]
        room = StubRoom(seats)
        engine = make_engine(room)
        engine._request_human = AsyncMock(return_value=None)

        with (
            patch("app.game.state_machine.random.choice", side_effect=lambda items: items[0]),
            patch("app.game.state_machine.log.exception"),
        ):
            tally = await engine._collect_ballot(seats, dur=1)

        self.assertEqual(sum(tally.values()), len(seats))
        self.assertEqual(tally, {
            "Player A": 1,
            "Player B": 1,
            "Player C": 1,
        })
        self.assertTrue(all(seat.votes_total == 0 for seat in seats))

    async def test_persistent_tie_uses_prior_public_suspicion(self) -> None:
        agent_b = StubAgent(["Player A", "Player A"])
        agent_d = StubAgent(["Player B", "Player B"])
        seats = [
            StubSeat("Player A", "human"),
            StubSeat("Player B", "llm", agent_b),
            StubSeat("Player C", "human"),
            StubSeat("Player D", "llm", agent_d),
        ]
        room = StubRoom(seats)
        engine = make_engine(room)
        engine.received_votes = {"Player A": 4, "Player B": 1}
        human_votes = {
            "Player A": ["Player B", "Player B"],
            "Player C": ["Player A", "Player A"],
        }

        async def request_human(seat, **_kwargs):
            return {"target": human_votes[seat.id].pop(0)}

        engine._request_human = request_human
        with patch(
            "app.game.state_machine.secrets.choice",
            side_effect=lambda items: items[0],
        ):
            await engine._vote_phase()

        final = [
            message
            for message in room.messages
            if message["type"] == "vote_result"
        ][-1]
        self.assertEqual(final["eliminated"], "Player A")
        self.assertEqual(
            final["tie_break"]["method"],
            "prior_suspicion_then_secure_draw",
        )
        self.assertEqual(final["tie_break"]["finalists"], ["Player A"])

    async def test_a_selected_human_is_eliminated(self) -> None:
        human = StubSeat("Player A", "human")
        ai = StubSeat("Player B", "llm", StubAgent())
        room = StubRoom([human, ai])
        room.round_no = 3
        engine = make_engine(room)
        engine._pending_eliminated = human.id

        with patch("app.game.state_machine.asyncio.sleep", new=AsyncMock()):
            await engine._resolution_phase()

        self.assertFalse(human.alive)
        self.assertEqual(human.eliminated_round, 3)
        elimination = next(msg for msg in room.messages if msg["type"] == "elimination")
        self.assertEqual(elimination, {
            "type": "elimination",
            "seat": "Player A",
            "role": "human",
            "model": None,
        })


    async def test_only_the_agents_that_voted_the_human_out_are_disqualified(
        self,
    ) -> None:
        human = StubSeat("Player A", "human")
        hunter = StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest")
        loyal = StubSeat("Player C", "llm", StubAgent(), "mistral-small-latest")
        other_human = StubSeat("Player D", "human")
        room = StubRoom([human, hunter, loyal, other_human])
        engine = make_engine(room)
        engine._pending_eliminated = human.id
        engine._last_ballot = {
            hunter.id: human.id,
            loyal.id: hunter.id,
            other_human.id: human.id,
        }

        with patch("app.game.state_machine.asyncio.sleep", new=AsyncMock()):
            await engine._resolution_phase()

        self.assertTrue(hunter.disqualified)
        self.assertFalse(loyal.disqualified)
        # Humans are never penalised for a bad ballot.
        self.assertFalse(other_human.disqualified)
        # The penalty stays private: naming it would expose the AI seats.
        self.assertNotIn(
            "disqualified",
            " ".join(str(message) for message in room.messages).lower(),
        )

    async def test_eliminating_an_ai_disqualifies_nobody(self) -> None:
        target = StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest")
        voter = StubSeat("Player C", "llm", StubAgent(), "mistral-small-latest")
        room = StubRoom([StubSeat("Player A", "human"), target, voter])
        engine = make_engine(room)
        engine._pending_eliminated = target.id
        engine._last_ballot = {voter.id: target.id}

        with patch("app.game.state_machine.asyncio.sleep", new=AsyncMock()):
            await engine._resolution_phase()

        self.assertFalse(voter.disqualified)

    async def test_a_runoff_ballot_replaces_the_first_one(self) -> None:
        first = StubSeat("Player C", "llm", StubAgent(["Player A", "Player B"]))
        second = StubSeat("Player D", "llm", StubAgent(["Player B", "Player B"]))
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "human"),
            first,
            second,
        ])
        engine = make_engine(room)

        await engine._collect_ballot([first, second], 1)
        self.assertEqual(
            engine._last_ballot, {"Player C": "Player A", "Player D": "Player B"}
        )

        await engine._collect_ballot([first, second], 1, candidates=["Player B"])
        # Only the decisive ballot can eliminate anyone, so only it is kept.
        self.assertEqual(
            engine._last_ballot, {"Player C": "Player B", "Player D": "Player B"}
        )

    async def test_a_disqualified_agent_does_not_win_at_the_round_limit(self) -> None:
        hunter = StubSeat("Player C", "llm", StubAgent(), "mistral-large-latest")
        hunter.disqualified = True
        clean = StubSeat("Player D", "llm", StubAgent(), "mistral-small-latest")
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "human"),
            hunter,
            clean,
        ])
        room.round_no = 5
        engine = make_engine(room)
        engine.settings.max_rounds = 5

        with patch("app.game.state_machine.stats.record_game"):
            await engine._game_over()

        game_over = next(msg for msg in room.messages if msg["type"] == "game_over")
        self.assertEqual(game_over["winner"], "agents")
        self.assertEqual(game_over["winners"], ["Player D"])

    async def test_humans_win_when_every_surviving_agent_hunted_a_human(self) -> None:
        hunter = StubSeat("Player C", "llm", StubAgent(), "mistral-large-latest")
        hunter.disqualified = True
        room = StubRoom([
            StubSeat("Player A", "human"),
            StubSeat("Player B", "human"),
            hunter,
        ])
        room.round_no = 5
        engine = make_engine(room)
        engine.settings.max_rounds = 5

        with patch("app.game.state_machine.stats.record_game"):
            await engine._game_over()

        game_over = next(msg for msg in room.messages if msg["type"] == "game_over")
        self.assertEqual(game_over["winner"], "humans")
        self.assertEqual(game_over["winners"], ["Player A", "Player B"])
        self.assertIn("costs an AI the game", game_over["message"])

    async def test_a_disqualified_agent_loses_the_final_duel(self) -> None:
        hunter = StubSeat("Player B", "llm", StubAgent(), "mistral-large-latest")
        hunter.disqualified = True
        room = StubRoom([StubSeat("Player A", "human"), hunter])
        engine = make_engine(room)

        with patch("app.game.state_machine.stats.record_game"):
            await engine._game_over()

        game_over = next(msg for msg in room.messages if msg["type"] == "game_over")
        self.assertEqual(game_over["winner"], "humans")
        self.assertEqual(game_over["winners"], ["Player A"])


if __name__ == "__main__":
    unittest.main()
