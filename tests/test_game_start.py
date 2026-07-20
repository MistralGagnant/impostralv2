"""Public lobby timeout and private host-controlled start behavior."""
from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.game import events
from app.main import _maybe_start, _room_state, _start_private_game
from app.rooms import Room, Seat


class FakeEngine:
    def __init__(self, room: Room) -> None:
        self.room = room

    async def run(self) -> None:
        return


class GameStartTest(unittest.IsolatedAsyncioTestCase):
    async def test_timeout_starts_partial_once_the_human_floor_is_met(self) -> None:
        room = Room(id="partial", num_humans=3, num_llms=1, visibility="public")
        room.seats = {
            "Player A": Seat(
                id="Player A", kind="human", voice="test",
                connected=True, claimed=True,
            ),
            "Player B": Seat(
                id="Player B", kind="human", voice="test",
                connected=True, claimed=True,
            ),
            "Player C": Seat(id="Player C", kind="human", voice="test"),
            "Player D": Seat(id="Player D", kind="llm", voice="test"),
        }
        with (
            patch("app.main.GameEngine", FakeEngine),
            patch(
                "app.main.get_settings",
                return_value=SimpleNamespace(
                    human_wait_seconds=0,
                    min_public_start_humans=2,
                    max_public_start_extensions=1,
                ),
            ),
        ):
            await _maybe_start(room)
            await room.start_wait_task
            await asyncio.sleep(0)

        self.assertTrue(room.started)
        self.assertEqual(room.status, "running")
        self.assertEqual(room.num_humans, 2)
        self.assertEqual(set(room.seats), {"Player A", "Player B", "Player D"})

    async def test_timeout_extends_below_floor_then_starts_solo(self) -> None:
        room = Room(id="lonely", num_humans=3, num_llms=1, visibility="public")
        room.seats = {
            "Player A": Seat(
                id="Player A", kind="human", voice="test",
                connected=True, claimed=True,
            ),
            "Player B": Seat(id="Player B", kind="human", voice="test"),
            "Player C": Seat(id="Player C", kind="human", voice="test"),
            "Player D": Seat(id="Player D", kind="llm", voice="test"),
        }
        with (
            patch("app.main.GameEngine", FakeEngine),
            patch(
                "app.main.get_settings",
                return_value=SimpleNamespace(
                    human_wait_seconds=0,
                    min_public_start_humans=2,
                    max_public_start_extensions=1,
                ),
            ),
        ):
            await _maybe_start(room)
            # Drive the chained wait tasks: one extension below the floor, then
            # a start with the lone human so the player is never stranded.
            for _ in range(10):
                if room.started:
                    break
                task = room.start_wait_task
                if task is None or task.done():
                    await asyncio.sleep(0)
                    continue
                await task

        self.assertTrue(room.started)
        # Exactly one extension happened before the solo fallback start.
        self.assertEqual(room.start_extensions, 1)
        self.assertEqual(room.num_humans, 1)
        self.assertEqual(set(room.seats), {"Player A", "Player D"})

    async def test_private_lobby_never_starts_on_a_timer(self) -> None:
        room = Room(id="friends", num_humans=2, num_llms=1, visibility="private")
        room.seats = {
            "Player A": Seat(
                id="Player A", kind="human", voice="test",
                connected=True, claimed=True,
            ),
            "Player B": Seat(
                id="Player B", kind="human", voice="test",
                connected=True, claimed=True,
            ),
            "Player C": Seat(id="Player C", kind="llm", voice="test"),
        }
        room.host_seat_id = "Player A"

        with patch("app.main.GameEngine", FakeEngine):
            await _maybe_start(room)
            await asyncio.sleep(0)

        self.assertFalse(room.started)
        self.assertIsNone(room.start_wait_task)
        self.assertEqual(room.start_deadline, 0)

    async def test_only_private_host_can_start_with_connected_humans(self) -> None:
        room = Room(id="friends", num_humans=3, num_llms=1, visibility="private")
        room.seats = {
            "Player A": Seat(
                id="Player A", kind="human", voice="test",
                connected=True, claimed=True,
            ),
            "Player B": Seat(
                id="Player B", kind="human", voice="test",
                connected=True, claimed=True,
            ),
            "Player C": Seat(id="Player C", kind="human", voice="test"),
            "Player D": Seat(id="Player D", kind="llm", voice="test"),
        }
        room.host_seat_id = "Player A"

        with patch("app.main.GameEngine", FakeEngine):
            self.assertFalse(await _start_private_game(room, "Player B"))
            self.assertFalse(room.started)
            self.assertTrue(await _start_private_game(room, "Player A"))
            await asyncio.sleep(0)

        self.assertTrue(room.started)
        self.assertEqual(room.num_humans, 2)
        self.assertEqual(set(room.seats), {"Player A", "Player B", "Player D"})

    def test_private_room_state_contains_only_aggregate_lobby_information(self) -> None:
        room = Room(id="friends", num_humans=2, num_llms=1, visibility="private")
        room.seats = {
            "Player A": Seat(
                id="Player A", kind="human", voice="test", connected=True,
            ),
            "Player B": Seat(id="Player B", kind="human", voice="test"),
            "Player C": Seat(id="Player C", kind="llm", voice="test"),
        }
        room.host_seat_id = "Player A"

        state = _room_state(room, you="Player A")

        self.assertEqual(state["connected_humans"], 1)
        self.assertEqual(state["expected_humans"], 2)
        self.assertEqual(state["visibility"], "private")
        self.assertTrue(state["is_host"])
        self.assertNotIn("role", state["seats"][0])
        self.assertNotIn("connected", state["seats"][0])

    def test_reconnect_snapshot_restores_answers_and_revealed_dead_roles(self) -> None:
        human = Seat(id="Player A", kind="human", voice="test", connected=True)
        agent = Seat(
            id="Player B",
            kind="llm",
            voice="test",
            model="mistral-large-latest",
            alive=False,
        )
        room = Room(id="snapshot", num_humans=1, num_llms=1)
        room.seats = {human.id: human, agent.id: agent}
        room.current_answers = {"Player A": "A restored answer."}

        state = _room_state(room, you=human.id)

        self.assertEqual(state["answers"], room.current_answers)
        self.assertNotIn("role", state["seats"][0])
        self.assertEqual(state["seats"][1]["role"], "llm")
        self.assertEqual(
            state["seats"][1]["model"],
            "mistral-large-latest",
        )

    def test_start_game_replaces_the_ready_client_message(self) -> None:
        self.assertIsNotNone(events.parse_client_message({"type": "start_game"}))
        self.assertIsNone(events.parse_client_message({"type": "ready"}))


if __name__ == "__main__":
    unittest.main()
