"""Text-to-speech SDK and audio-store tests."""
from __future__ import annotations

import base64
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.audio import tts


class TextToSpeechTest(unittest.IsolatedAsyncioTestCase):
    async def test_synthesis_prefers_the_cancellable_async_sdk(self) -> None:
        response = SimpleNamespace(
            audio_data=base64.b64encode(b"synthetic voice").decode("ascii")
        )
        complete_async = AsyncMock(return_value=response)
        complete = Mock()
        client = SimpleNamespace(
            audio=SimpleNamespace(
                speech=SimpleNamespace(
                    complete=complete,
                    complete_async=complete_async,
                ),
            ),
        )
        settings = SimpleNamespace(tts_model="voxtral-mini-tts-latest")

        with (
            patch("app.audio.tts.get_client", return_value=client),
            patch("app.audio.tts.get_settings", return_value=settings),
            patch("app.audio.tts.store.put", return_value="/audio/test") as put,
        ):
            result = await tts.synthesize("Hello", voice="voice-id")

        self.assertEqual(result, "/audio/test")
        complete_async.assert_awaited_once_with(
            model="voxtral-mini-tts-latest",
            voice_id="voice-id",
            input="Hello",
            response_format="mp3",
        )
        complete.assert_not_called()
        put.assert_called_once_with(b"synthetic voice", "audio/mpeg")


if __name__ == "__main__":
    unittest.main()
