"""Quality and progression tests for the curated question director."""
from __future__ import annotations

import unittest
from unittest.mock import patch

from app.game import questions
from app.game.answers import normalize_public_answer


class QuestionDirectorTest(unittest.TestCase):
    def test_arc_compresses_to_the_rounds_a_room_can_play(self) -> None:
        expected = {
            1: ["TRACE"],
            2: ["TRACE", "ALIBI"],
            3: ["TRACE", "FRICTION", "ALIBI"],
            4: ["TRACE", "TELL", "ECHO", "ALIBI"],
            5: ["TRACE", "TELL", "FRICTION", "ECHO", "ALIBI"],
        }
        for total, acts in expected.items():
            with self.subTest(total=total):
                self.assertEqual(
                    [
                        questions.act_for_round(round_no, total)
                        for round_no in range(1, total + 1)
                    ],
                    acts,
                )

    def test_every_act_has_a_replayable_safe_pool(self) -> None:
        self.assertEqual(len(questions.QUESTIONS), 40)
        self.assertEqual(
            len({card.id for card in questions.QUESTIONS}),
            len(questions.QUESTIONS),
        )
        self.assertEqual(
            len({card.prompt for card in questions.QUESTIONS}),
            len(questions.QUESTIONS),
        )
        for act in questions.ACTS:
            cards = [card for card in questions.QUESTIONS if card.act == act]
            with self.subTest(act=act):
                self.assertGreaterEqual(len(cards), 8)
                self.assertEqual(len({card.id for card in cards}), len(cards))

    def test_cards_fit_the_one_sentence_public_contract(self) -> None:
        banned_fragments = (
            "who is an ai",
            "most suspicious player",
            "weakest answer",
            "search history",
        )
        for card in questions.QUESTIONS:
            with self.subTest(card=card.id):
                self.assertTrue(card.prompt.endswith("?") or card.prompt.endswith("…”"))
                self.assertLessEqual(len(card.prompt), 90)
                self.assertFalse(
                    any(fragment in card.prompt.lower() for fragment in banned_fragments)
                )
                self.assertGreaterEqual(len(card.mock_answers), 4)
                for answer in card.mock_answers:
                    self.assertLessEqual(len(answer), 100)
                    self.assertEqual(normalize_public_answer(answer), answer)
                    self.assertNotIn("Player B", answer)
                    self.assertNotIn("Player C", answer)

    def test_picker_stays_in_act_and_excludes_a_used_card(self) -> None:
        used = next(card for card in questions.QUESTIONS if card.act == "TRACE")
        remaining = [
            card
            for card in questions.QUESTIONS
            if card.act == "TRACE" and card.id != used.id
        ]
        with patch("app.game.questions.random.choice", side_effect=lambda pool: pool[0]):
            selected = questions.pick_question(
                {used.id},
                round_no=1,
                total_rounds=4,
            )

        self.assertEqual(selected.act, "TRACE")
        self.assertNotEqual(selected.id, used.id)
        self.assertIn(selected, remaining)

    def test_picker_excludes_the_used_semantic_family(self) -> None:
        used = next(card for card in questions.QUESTIONS if card.id == "tell_chore")
        captured: list = []

        def choose(pool):
            captured.extend(pool)
            return pool[0]

        with patch("app.game.questions.random.choice", side_effect=choose):
            questions.pick_question(
                {used.id},
                round_no=2,
                total_rounds=5,
            )

        self.assertTrue(captured)
        self.assertNotIn(
            "tell_tomorrow",
            {card.id for card in captured},
        )

    def test_playable_rounds_match_real_room_sizes(self) -> None:
        self.assertEqual(
            {
                seats: questions.playable_rounds(seats, 5)
                for seats in (4, 5, 6, 7)
            },
            {4: 2, 5: 3, 6: 4, 7: 5},
        )

    def test_known_prompt_exposes_question_specific_mock_answers(self) -> None:
        card = questions.QUESTIONS[0]
        self.assertEqual(
            questions.mock_answers_for(card.prompt),
            card.mock_answers,
        )
        self.assertEqual(questions.mock_answers_for("Unknown prompt"), ())

    def test_english_remains_the_canonical_default(self) -> None:
        for card in questions.QUESTIONS:
            with self.subTest(card=card.id):
                self.assertEqual(card.prompt_for(), card.prompt)
                self.assertEqual(card.prompt_for("en-US"), card.prompt)
                self.assertEqual(card.prompt_for("unsupported"), card.prompt)
                self.assertEqual(card.mock_answers_for(), card.mock_answers)

    def test_every_card_has_polished_french_copy(self) -> None:
        self.assertEqual(
            set(questions.FRENCH_QUESTION_COPY),
            {card.id for card in questions.QUESTIONS},
        )
        french_prompts = set()
        for card in questions.QUESTIONS:
            with self.subTest(card=card.id):
                localized = card.localized("fr-FR")
                self.assertNotEqual(localized.prompt, card.prompt)
                self.assertTrue(
                    localized.prompt.endswith("?")
                    or localized.prompt.endswith(" »")
                )
                self.assertLessEqual(len(localized.prompt), 90)
                self.assertEqual(len(localized.mock_answers), 4)
                self.assertEqual(len(set(localized.mock_answers)), 4)
                french_prompts.add(localized.prompt)
                for answer in localized.mock_answers:
                    self.assertLessEqual(len(answer), 100)
                    self.assertEqual(normalize_public_answer(answer), answer)

        self.assertEqual(len(french_prompts), len(questions.QUESTIONS))

    def test_locale_helpers_accept_browser_locale_variants(self) -> None:
        expected = {
            None: "en",
            "": "en",
            "en": "en",
            "en-GB": "en",
            "fr": "fr",
            "fr-FR": "fr",
            "fr_CA": "fr",
            "de-DE": "en",
        }
        for locale, normalized in expected.items():
            with self.subTest(locale=locale):
                self.assertEqual(
                    questions.normalize_locale(locale),
                    normalized,
                )

    def test_localized_lookup_uses_ids_and_can_infer_a_french_prompt(self) -> None:
        card = next(
            card
            for card in questions.QUESTIONS
            if card.id == "tell_small_lie"
        )
        french = questions.localize_question(card.id, "fr")

        self.assertEqual(card.prompt_for("fr"), french.prompt)
        self.assertEqual(card.mock_answers_for("fr"), french.mock_answers)
        self.assertEqual(
            questions.mock_answers_for(card.id, "fr"),
            french.mock_answers,
        )
        self.assertEqual(
            questions.mock_answers_for(french.prompt),
            french.mock_answers,
        )
        self.assertEqual(
            questions.localize_question(french.prompt, "en").prompt,
            card.prompt,
        )
        with self.assertRaises(KeyError):
            questions.localize_question("unknown_card", "fr")


if __name__ == "__main__":
    unittest.main()
