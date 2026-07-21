"""Language-aware preset voice selection."""
from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.audio import voices


class VoicePoolTest(unittest.TestCase):
    def tearDown(self) -> None:
        voices._preset_voice_ids.cache_clear()

    @staticmethod
    def _client(listing: Mock) -> SimpleNamespace:
        return SimpleNamespace(
            audio=SimpleNamespace(
                voices=SimpleNamespace(list=listing),
            ),
        )

    @staticmethod
    def _listing() -> Mock:
        """Mirror the presets: several English speakers, a single French one."""
        return Mock(return_value=SimpleNamespace(model_dump=lambda: {
            "items": [
                {
                    "id": "alex-neutral",
                    "name": "Alex - Neutral",
                    "languages": ["en_us"],
                    "tags": ["neutral"],
                },
                {
                    "id": "alex-angry",
                    "name": "Alex - Angry",
                    "languages": ["en_us"],
                    "tags": ["angry"],
                },
                {
                    "id": "bea-neutral",
                    "name": "Bea - Neutral",
                    "languages": ["en_gb"],
                    "tags": ["neutral"],
                },
                {
                    "id": "camille-angry",
                    "name": "Camille - Angry",
                    "languages": ["fr_fr"],
                    "tags": ["angry"],
                },
                {
                    "id": "camille-neutral",
                    "name": "Camille - Neutre",
                    "languages": ["fr_fr"],
                    "tags": ["neutral"],
                },
            ],
            "total": 5,
        }))

    def test_room_language_variants_outrank_the_remaining_foreigners(self) -> None:
        """A French room reuses Camille's moods instead of sounding English."""
        with patch("app.audio.voices.get_client", return_value=self._client(self._listing())):
            french = voices._preset_voice_ids("fr")

        self.assertEqual(
            french,
            ("camille-neutral", "alex-neutral", "camille-angry", "bea-neutral",
             "alex-angry"),
        )

    def test_one_foreign_speaker_is_invited_right_after_the_locals(self) -> None:
        """The accent is a feature: an English room still seats a French voice."""
        with patch("app.audio.voices.get_client", return_value=self._client(self._listing())):
            english = voices._preset_voice_ids("en")

        self.assertEqual(english[:3], ("alex-neutral", "bea-neutral", "camille-neutral"))
        self.assertEqual(english[3:], ("alex-angry", "camille-angry"))

    def test_cache_is_partitioned_by_language(self) -> None:
        listing = self._listing()
        with patch("app.audio.voices.get_client", return_value=self._client(listing)):
            french = voices._preset_voice_ids("fr")
            voices._preset_voice_ids("en")
            french_again = voices._preset_voice_ids("fr")

        self.assertEqual(french_again, french)
        self.assertEqual(listing.call_count, 2)


if __name__ == "__main__":
    unittest.main()
