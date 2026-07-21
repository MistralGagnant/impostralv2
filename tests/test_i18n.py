"""Deterministic room-language and server-copy tests."""
from __future__ import annotations

import unittest

from app.i18n import normalize_language, tr


class ServerI18nTest(unittest.TestCase):
    def test_language_normalization_keeps_english_as_the_fallback(self) -> None:
        self.assertEqual(normalize_language("fr-FR"), "fr")
        self.assertEqual(normalize_language("fr_CA"), "fr")
        self.assertEqual(normalize_language("en-GB"), "en")
        self.assertEqual(normalize_language("de-DE"), "en")

    def test_game_copy_is_localized_without_runtime_translation(self) -> None:
        self.assertEqual(tr("fr", "no_answer"), "Aucune réponse.")
        self.assertEqual(tr("en", "no_answer"), "No answer.")
        self.assertIn(
            "duel final",
            tr("fr", "final_duel_shared", human="Player A", agent="Player B"),
        )


if __name__ == "__main__":
    unittest.main()
