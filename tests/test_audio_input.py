"""Audio input WebSocket contract and game-engine propagation tests."""
from __future__ import annotations

import base64
import unittest
from unittest.mock import AsyncMock, patch

from app.game import events
from app.game.state_machine import GameEngine
from app.main import _normalize


class AudioInputTest(unittest.IsolatedAsyncioTestCase):
    def test_websocket_message_keeps_media_recorder_mime_type(self) -> None:
        message = events.parse_client_message({
            "type": "audio_blob",
            "request_id": "request_123",
            "audio_b64": "dm9pY2U=",
            "audio_mime": "audio/mp4;codecs=mp4a.40.2",
            "text": "fallback",
        })

        self.assertIsNotNone(message)
        self.assertEqual(_normalize(message), {
            "request_id": "request_123",
            "audio_b64": "dm9pY2U=",
            "audio_mime": "audio/mp4;codecs=mp4a.40.2",
            "text": "fallback",
        })

    def test_websocket_message_rejects_an_unbounded_mime_type(self) -> None:
        self.assertIsNone(events.parse_client_message({
            "type": "audio_blob",
            "request_id": "request_123",
            "audio_mime": "audio/" + ("x" * 100),
        }))

    def test_websocket_message_bounds_text_and_audio_payloads(self) -> None:
        self.assertIsNone(events.parse_client_message({
            "type": "audio_blob",
            "request_id": "request_123",
            "text": "x" * 101,
        }))
        self.assertIsNone(events.parse_client_message({
            "type": "audio_blob",
            "request_id": "request_123",
            "audio_b64": "A" * 2_000_001,
        }))

    def test_game_input_requires_a_matching_request_identifier(self) -> None:
        self.assertIsNone(events.parse_client_message({
            "type": "audio_blob",
            "text": "late answer",
        }))
        self.assertIsNone(events.parse_client_message({
            "type": "submit_vote",
            "target": "Player B",
        }))

    async def test_engine_passes_audio_bytes_and_mime_type_to_stt(self) -> None:
        engine = GameEngine.__new__(GameEngine)
        payload = {
            "audio_b64": base64.b64encode(b"voice").decode("ascii"),
            "audio_mime": "audio/mp4",
            "text": "fallback",
        }

        with patch(
            "app.game.state_machine.stt.transcribe",
            new=AsyncMock(return_value="transcript"),
        ) as transcribe:
            result = await engine._payload_to_text(payload)

        self.assertEqual(result, "transcript")
        transcribe.assert_awaited_once_with(
            b"voice",
            mime_type="audio/mp4",
            fallback_text="fallback",
            language="en",
        )

    async def test_human_and_agent_answers_share_one_sentence_limit(self) -> None:
        engine = GameEngine.__new__(GameEngine)
        with patch(
            "app.game.state_machine.stt.transcribe",
            new=AsyncMock(return_value="First sentence. Second sentence."),
        ):
            result = await engine._payload_to_text({
                "audio_b64": None,
                "text": "First sentence. Second sentence.",
            })

        self.assertEqual(result, "First sentence.")


if __name__ == "__main__":
    unittest.main()
