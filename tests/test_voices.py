"""Language-aware preset voice selection."""
from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.audio import voices


class VoicePoolTest(unittest.TestCase):
    def tearDown(self) -> None:
        voices._preset_voice_ids.cache_clear()

    def test_voice_order_and_cache_are_partitioned_by_language(self) -> None:
        page = SimpleNamespace(model_dump=lambda: {
            "items": [
                {
                    "id": "english",
                    "name": "Alex - neutral",
                    "languages": ["en"],
                    "tags": ["neutral"],
                },
                {
                    "id": "french",
                    "name": "Camille - neutre",
                    "languages": ["fr"],
                    "tags": ["neutral"],
                },
            ],
            "total": 2,
        })
        listing = Mock(return_value=page)
        client = SimpleNamespace(
            audio=SimpleNamespace(
                voices=SimpleNamespace(list=listing),
            ),
        )

        with patch("app.audio.voices.get_client", return_value=client):
            french = voices._preset_voice_ids("fr")
            english = voices._preset_voice_ids("en")
            french_again = voices._preset_voice_ids("fr")

        self.assertEqual(french[0], "french")
        self.assertEqual(english[0], "english")
        self.assertEqual(french_again, french)
        self.assertEqual(listing.call_count, 2)


if __name__ == "__main__":
    unittest.main()
