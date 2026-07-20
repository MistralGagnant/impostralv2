"""A transient TTS failure is retried so one glitch does not mute a round."""
from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.game.state_machine import GameEngine


def _engine() -> GameEngine:
    room = SimpleNamespace(language="en")
    engine = GameEngine(room)
    # Two attempts total (one retry) with no real sleep between them.
    engine.settings = SimpleNamespace(tts_retry_attempts=1)
    return engine


class TtsRetryTest(unittest.IsolatedAsyncioTestCase):
    async def test_retries_after_a_transient_failure(self) -> None:
        engine = _engine()
        synth = AsyncMock(side_effect=[None, "/audio/clip.mp3"])
        with (
            patch("app.game.state_machine.tts.synthesize", synth),
            patch("app.game.state_machine.asyncio.sleep", AsyncMock()),
        ):
            url = await engine._synthesize_with_retry("hello", "voice-1", "Player A")
        self.assertEqual(url, "/audio/clip.mp3")
        self.assertEqual(synth.await_count, 2)

    async def test_returns_none_when_every_attempt_fails(self) -> None:
        engine = _engine()
        synth = AsyncMock(side_effect=RuntimeError("boom"))
        with (
            patch("app.game.state_machine.tts.synthesize", synth),
            patch("app.game.state_machine.asyncio.sleep", AsyncMock()),
        ):
            url = await engine._synthesize_with_retry("hello", "voice-1", "Player A")
        self.assertIsNone(url)
        self.assertEqual(synth.await_count, 2)


if __name__ == "__main__":
    unittest.main()
