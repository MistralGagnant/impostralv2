"""A claimed seat can recover the final verdict after a transient disconnect."""
from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from starlette.websockets import WebSocketDisconnect

from app.game.events import Phase
from app.main import ws_endpoint
from app.rooms import Room, RoomManager, Seat


class FakeWebSocket:
    def __init__(self, messages: list[dict]) -> None:
        self.headers = {
            "origin": "http://testserver",
            "host": "testserver",
        }
        self._messages = iter(messages)
        self.sent: list[dict] = []
        self.accepted = False

    async def accept(self) -> None:
        self.accepted = True

    async def receive_json(self) -> dict:
        try:
            return next(self._messages)
        except StopIteration as error:
            raise WebSocketDisconnect() from error

    async def send_json(self, message: dict) -> None:
        self.sent.append(message)

    async def close(self, code: int = 1000) -> None:
        return None


class FinishedRoomReconnectTest(unittest.IsolatedAsyncioTestCase):
    async def test_reconnect_receives_state_then_retained_game_over_payload(self) -> None:
        manager = RoomManager()
        room = Room(
            id="finished-room",
            language="fr",
            status="finished",
            phase=Phase.GAME_OVER,
            started=True,
            num_humans=1,
            num_llms=1,
        )
        room.seats = {
            "Player A": Seat(
                id="Player A",
                kind="human",
                voice="test",
                claimed=True,
                player_id="player_0001",
                session_id="session_0001",
            ),
            "Player B": Seat(
                id="Player B",
                kind="llm",
                voice="test",
                alive=False,
            ),
        }
        room.game_over_payload = {
            "type": "game_over",
            "winner": "humans",
            "winners": ["Player A"],
            "roles": {"Player A": "human", "Player B": "llm"},
            "models": {"Player B": "mistral-small-latest"},
            "message": "Les humains ont gagné.",
            "reason": "all_agents_exposed",
            "agents": {},
        }
        manager._rooms[room.id] = room
        socket = FakeWebSocket([{
            "type": "join",
            "name": "",
            "player_id": "player_0001",
            "session_id": "session_0001",
            "reservation_token": "",
            "language": "fr",
        }])

        with (
            patch("app.main.rooms", manager),
            patch(
                "app.main._cleanup_after_reconnect_grace",
                new=AsyncMock(return_value=None),
            ),
        ):
            await ws_endpoint(socket, room.id)

        self.assertTrue(socket.accepted)
        payload_types = [message["type"] for message in socket.sent]
        self.assertEqual(payload_types[:3], ["session", "room_state", "game_over"])
        # The reconnecting browser is handed a fresh secret for future retries.
        self.assertTrue(socket.sent[0]["reconnect_token"])
        self.assertEqual(socket.sent[1]["you"], "Player A")
        self.assertEqual(socket.sent[1]["language"], "fr")
        self.assertEqual(socket.sent[2], room.game_over_payload)


if __name__ == "__main__":
    unittest.main()
