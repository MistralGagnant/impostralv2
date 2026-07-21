"""Tests sans appel réseau du contrat de sortie des agents."""
from __future__ import annotations

import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch


# Isole le module testé des dépendances de configuration non nécessaires ici.
config_stub = types.ModuleType("app.config")
config_stub.get_settings = lambda: None
client_stub = types.ModuleType("app.mistral_client")
client_stub.get_client = lambda: None
sys.modules.setdefault("app.config", config_stub)
sys.modules.setdefault("app.mistral_client", client_stub)

from app.agents.llm_agent import (  # noqa: E402
    _PUBLIC_RESPONSE_SCHEMA,
    LLMAgent,
    MAX_PUBLIC_CHARS,
    PERSONA_COUNT,
    PERSONAS,
    _one_short_sentence,
    _vote_schema,
)
from app.game import stats  # noqa: E402
from app.game.questions import QUESTIONS  # noqa: E402


class SortieAgentTest(unittest.TestCase):
    def test_le_schema_separe_raisonnement_et_sortie(self) -> None:
        schema = _PUBLIC_RESPONSE_SCHEMA["json_schema"]["schema"]
        self.assertEqual(schema["required"], ["thinking", "output"])
        self.assertEqual(
            schema["properties"]["output"]["maxLength"], MAX_PUBLIC_CHARS
        )
        self.assertEqual(schema["properties"]["output"]["minLength"], 1)
        self.assertEqual(schema["properties"]["thinking"]["maxLength"], 800)
        self.assertFalse(schema["additionalProperties"])

    def test_only_the_first_sentence_is_public(self) -> None:
        self.assertEqual(
            _one_short_sentence("First sentence. Second sentence. Third sentence."),
            "First sentence.",
        )

    def test_an_empty_output_stays_empty_for_question_specific_fallback(self) -> None:
        self.assertEqual(_one_short_sentence(""), "")

    def test_une_reponse_de_quelques_mots_est_conservee(self) -> None:
        self.assertEqual(_one_short_sentence("Honestly, no idea."), "Honestly, no idea.")

    def test_une_relative_superflue_est_supprimee(self) -> None:
        self.assertEqual(
            _one_short_sentence(
                "A warm cup of coffee, that I was just holding in my hand."
            ),
            "A warm cup of coffee.",
        )
        self.assertEqual(
            _one_short_sentence(
                "Une tasse de café tiède, qui traînait près du clavier."
            ),
            "Une tasse de café tiède.",
        )

    def test_une_reponse_est_capitalisee_et_ponctuee(self) -> None:
        # A typed human answer must not stand out from model output.
        self.assertEqual(_one_short_sentence("deux cafés ce matin"), "Deux cafés ce matin.")
        self.assertEqual(_one_short_sentence("vraiment ?"), "Vraiment ?")
        self.assertEqual(_one_short_sentence("aucune idée,"), "Aucune idée.")
        self.assertEqual(_one_short_sentence("3 heures de sommeil"), "3 heures de sommeil.")
        long_answer = _one_short_sentence("b" * MAX_PUBLIC_CHARS)
        self.assertLessEqual(len(long_answer), MAX_PUBLIC_CHARS)
        self.assertTrue(long_answer.endswith("."))

    def test_les_tirets_sont_normalises(self) -> None:
        output = _one_short_sentence("I—think Player-C looks scripted - honestly.")
        self.assertNotRegex(output, r"[-‐‑‒–—―]")
        self.assertEqual(output, "I, think Player C looks scripted, honestly.")

    def test_la_sortie_est_bornee(self) -> None:
        output = _one_short_sentence("a" * 250)
        self.assertLessEqual(len(output), MAX_PUBLIC_CHARS)
        self.assertTrue(output.endswith("…"))

    def test_la_persona_flemmarde_repond_en_un_ou_deux_mots(self) -> None:
        slacker = next(
            index
            for index, persona in enumerate(PERSONAS)
            if persona["nom"] == "The Slacker"
        )
        for key in ("exemples", "exemples_fr"):
            for _, response in PERSONAS[slacker][key]:
                with self.subTest(response=response):
                    self.assertLessEqual(len(response.split()), 3)
        self.assertIn(
            "fewest words",
            LLMAgent("Player A", slacker)._system(),
        )

    def test_chaque_persona_possede_des_exemples_humains_courts(self) -> None:
        for persona in PERSONAS:
            with self.subTest(persona=persona["nom"]):
                self.assertGreaterEqual(len(persona["exemples"]), 3)
                for question, response in persona["exemples"]:
                    self.assertTrue(question)
                    self.assertTrue(response)
                    self.assertLessEqual(len(response), MAX_PUBLIC_CHARS)
                    self.assertEqual(_one_short_sentence(response), response)

    def test_le_prompt_contient_uniquement_les_exemples_de_la_persona(self) -> None:
        agent = LLMAgent("Player A", 0, model="mistral-large-latest")
        prompt = agent._system()
        self.assertEqual(agent.model, "mistral-large-latest")
        self.assertIn(PERSONAS[0]["exemples"][0][1], prompt)
        self.assertNotIn(PERSONAS[1]["exemples"][0][1], prompt)
        self.assertIn("Answer every round question directly", prompt)
        self.assertNotIn("Ask Player B instead", prompt)
        self.assertIn("Never use hyphens", prompt)

    def test_une_licence_ne_fuit_pas_vers_les_autres_personas(self) -> None:
        licenced = [
            index
            for index, persona in enumerate(PERSONAS)
            if persona.get("licence")
        ]
        self.assertEqual(
            [PERSONAS[index]["nom"] for index in licenced],
            ["The Troll", "The Slacker"],
        )
        for index in licenced:
            licence = PERSONAS[index]["licence"]
            for language in ("en", "fr"):
                with self.subTest(persona=PERSONAS[index]["nom"], language=language):
                    self.assertIn(
                        licence,
                        LLMAgent("Player A", index)._system(language),
                    )
                    for other in range(PERSONA_COUNT):
                        if other == index:
                            continue
                        self.assertNotIn(
                            licence,
                            LLMAgent("Player A", other)._system(language),
                        )

    def test_la_consigne_de_tour_est_une_suggestion_partagee(self) -> None:
        banned = ("do not accuse", "n'accuse personne", "ne parle pas de stratégie")
        for language in ("en", "fr"):
            with self.subTest(language=language):
                tasks = {
                    LLMAgent("Player A", index)._answer_task(language)
                    for index in range(PERSONA_COUNT)
                }
                # No persona needs a derogation from a suggestion.
                self.assertEqual(len(tasks), 1)
                task = tasks.pop()
                for fragment in banned:
                    self.assertNotIn(fragment, task.lower())

    def test_la_consigne_de_tour_ouvre_sur_la_reaction_a_la_table(self) -> None:
        english = LLMAgent("Player A", 0)._answer_task("en").lower()
        french = LLMAgent("Player A", 0)._answer_task("fr").lower()
        self.assertIn("claimed to be human", english)
        self.assertIn("called for a vote", english)
        self.assertIn("déclarer humain", french)
        self.assertIn("appeler à voter", french)

    def test_le_bulletin_interdit_de_viser_un_humain(self) -> None:
        agent = LLMAgent("Player A", 0)
        for language, expected in (
            ("en", ("never a seat you believe is human", "loses you the game")),
            ("fr", ("jamais un siège que tu crois humain", "perdre la partie")),
        ):
            with self.subTest(language=language):
                task = agent._vote_task(language)
                for fragment in expected:
                    self.assertIn(fragment, task)
        # The ballot instruction is shared, unlike the answer suggestion it is
        # not softened for any persona.
        self.assertEqual(
            len({
                LLMAgent("Player A", index)._vote_task("fr")
                for index in range(PERSONA_COUNT)
            }),
            1,
        )

    def test_le_bulletin_hardcore_vise_l_humain_puis_l_ia_la_moins_credible(
        self,
    ) -> None:
        agent = LLMAgent("Player A", 0, hardcore=True)
        english = agent._vote_task("en")
        french = agent._vote_task("fr")
        # Cibler un humain devient l'objectif, sans jamais voter au hasard.
        self.assertIn("clearly reads as human", english)
        self.assertIn("least convincing seat", english)
        self.assertIn("flagrant AI", english)
        self.assertNotIn("loses you the game", english)
        self.assertIn("humain", french)
        self.assertIn("le moins crédible", french)
        self.assertIn("l'IA la plus flagrante", french)
        self.assertNotIn("perdre la partie", french)
        # Le règlement standard reste intact dans la même salle de code.
        self.assertIn(
            "never a seat you believe is human",
            LLMAgent("Player A", 0)._vote_task("en"),
        )

    def test_le_schema_de_vote_suit_le_reglement(self) -> None:
        standard = _vote_schema(["Player B"])["json_schema"]["schema"]
        hardcore = _vote_schema(["Player B"], hardcore=True)["json_schema"]["schema"]
        self.assertIn(
            "most probably AI", standard["properties"]["thinking"]["description"]
        )
        self.assertIn(
            "most probably human", hardcore["properties"]["thinking"]["description"]
        )

    def test_le_systeme_hardcore_recompense_la_survie_a_tout_prix(self) -> None:
        prompt = LLMAgent("Player A", 0, hardcore=True)._system()
        self.assertIn("hardcore ruleset", prompt)
        self.assertIn("voting a human out costs you nothing", prompt)
        self.assertIn("the reason to send it home", prompt)
        # L'agent doit savoir qu'il joue avec les autres IA, pas contre elles,
        # et que son bulletin appartient d'abord à la chasse aux humains.
        self.assertIn("the AIs are one side against the humans", prompt)
        self.assertIn("briefed exactly like you", prompt)
        self.assertIn(
            "Never spend a ballot on another AI while a human is still readable",
            prompt,
        )
        # La sanction standard ne doit surtout pas rester dans le prompt.
        self.assertNotIn("eliminating a human loses you the game", prompt)
        self.assertNotIn("protect it and vote elsewhere", prompt)
        self.assertNotIn("Every AI competes independently", prompt)
        # Le reste du prompt (lecture de la table, persona) est partagé.
        self.assertIn("announces it is an AI", prompt)
        self.assertNotIn("\n\n\n", prompt)

    def test_le_systeme_protege_les_sieges_qui_se_revelent(self) -> None:
        prompt = LLMAgent("Player A", 0)._system()
        self.assertIn("eliminating a human", prompt)
        self.assertIn("shouts that it is human", prompt)
        self.assertIn("protect it", prompt)
        self.assertNotIn("decrease your score", prompt)

    def test_le_systeme_desamorce_le_faux_aveu_de_machine(self) -> None:
        prompt = LLMAgent("Player A", 0)._system()
        self.assertIn("announces it is an AI", prompt)
        self.assertIn("is a human having", prompt)
        # The claim must be treated as noise, in both directions.
        self.assertIn("A confession", prompt)
        self.assertIn("judge that seat on its other answers", prompt)

    def test_le_prompt_reste_intact_sans_licence(self) -> None:
        prompt = LLMAgent("Player A", 0)._system()
        self.assertNotIn("\n\n\n", prompt)
        self.assertIn(
            "Read what actually happened before choosing.\n\nHuman response examples",
            prompt,
        )

    def test_le_tirage_des_personas_peut_atteindre_le_troll(self) -> None:
        self.assertEqual(PERSONA_COUNT, len(PERSONAS))
        self.assertEqual(
            {LLMAgent("Player A", index).persona["nom"] for index in range(PERSONA_COUNT)},
            {persona["nom"] for persona in PERSONAS},
        )

    def test_mock_answers_are_on_topic_and_distinct_between_seats(self) -> None:
        question = "What did you drink most recently?"
        answers = [
            LLMAgent("Player Z", 0, answer_variant=variant)._mock_answer(question)
            for variant in range(4)
        ]
        first = answers[0]

        self.assertIn(first, {
            "Warm water I forgot about.",
            "An aggressively sweet iced coffee.",
            "Orange juice straight from the bottle.",
            "Tea that has gone completely cold.",
        })
        self.assertEqual(len(set(answers)), 4)
        self.assertNotIn("Player", first)

        for card in QUESTIONS:
            with self.subTest(card=card.id):
                card_answers = {
                    LLMAgent(
                        "Any seat",
                        # Four seats sharing one persona must still differ.
                        persona_idx=0,
                        answer_variant=variant,
                    )._mock_answer(card.prompt)
                    for variant in range(4)
                }
                self.assertEqual(len(card_answers), 4)

    def test_le_choix_scripte_suit_le_siege_et_non_la_persona(self) -> None:
        question = "What did you drink most recently?"
        same_seat_rank = {
            LLMAgent("Any seat", persona_idx, answer_variant=1)._mock_answer(question)
            for persona_idx in range(PERSONA_COUNT)
        }
        self.assertEqual(len(same_seat_rank), 1)

        # Standalone construction keeps the historical persona rotation.
        self.assertEqual(LLMAgent("Any seat", 3).answer_variant, 3)

    def test_le_vote_est_limite_aux_cibles_eligibles(self) -> None:
        targets = ["Player B", "Player C"]
        schema = _vote_schema(targets)["json_schema"]["schema"]
        self.assertEqual(schema["required"], ["thinking", "output"])
        self.assertEqual(schema["properties"]["output"]["enum"], targets)
        self.assertFalse(schema["additionalProperties"])

    def test_les_stats_mesurent_les_victoires_individuelles(self) -> None:
        records = [{
            "rounds": 3,
            "winners": ["Player A"],
            "llms": [
                {
                    "model": "mistral-large-latest",
                    "won": True,
                    "survived": False,
                    "eliminated_round": 3,
                    "votes_total": 2,
                    "votes_correct": 1,
                },
                {
                    "model": "mistral-small-latest",
                    "won": False,
                    "survived": False,
                    "eliminated_round": 1,
                    "votes_total": 2,
                    "votes_correct": 0,
                },
            ],
        }]
        with patch.object(stats, "_read_records", return_value=records):
            models = {row["model"]: row for row in stats.aggregate()["models"]}
        self.assertIn("Humans", models)
        self.assertFalse(models["Humans"]["data_available"])
        self.assertEqual(models["Humans"]["legacy_games_without_data"], 1)
        self.assertEqual(models["mistral-large-latest"]["team_win_rate"], 1.0)
        self.assertEqual(models["mistral-small-latest"]["team_win_rate"], 0.0)
        self.assertEqual(models["mistral-large-latest"]["vote_accuracy"], 0.5)

    def test_les_stats_humaines_sont_agregees_quand_disponibles(self) -> None:
        records = [{
            "rounds": 2,
            "winners": ["Player A", "Player B"],
            "llms": [],
            "humans": [{
                "won": True,
                "survived": True,
                "eliminated_round": None,
                "votes_total": 2,
                "votes_correct": 1,
            }],
        }]
        with patch.object(stats, "_read_records", return_value=records):
            result = stats.aggregate()
        humans = next(row for row in result["models"] if row["model"] == "Humans")
        self.assertTrue(humans["data_available"])
        self.assertEqual(humans["team_win_rate"], 1.0)
        self.assertEqual(humans["vote_accuracy"], 0.5)
        self.assertEqual(result["legacy_games_without_humans"], 0)

    def test_les_stats_separent_les_deux_reglements(self) -> None:
        def game(mode: str | None, won: bool) -> dict:
            record = {
                "rounds": 3,
                "winners": ["Player B"] if won else [],
                "llms": [{
                    "model": "mistral-large-latest",
                    "won": won,
                    "survived": won,
                    "eliminated_round": None if won else 2,
                    "votes_total": 2,
                    "votes_correct": 1,
                }],
                "humans": [],
            }
            if mode is not None:
                record["mode"] = mode
            return record

        records = [
            game("hardcore", True),
            game("standard", False),
            game(None, False),  # Antérieur au hardcore : compté en standard.
        ]
        with patch.object(stats, "_read_records", return_value=records):
            result = stats.aggregate()

        # Le total global reste celui de toutes les parties enregistrées.
        self.assertEqual(result["total_games"], 3)
        self.assertEqual(result["modes"]["standard"]["total_games"], 2)
        self.assertEqual(result["modes"]["hardcore"]["total_games"], 1)

        def win_rate(mode: str) -> float:
            row = next(
                entry
                for entry in result["modes"][mode]["models"]
                if entry["model"] == "mistral-large-latest"
            )
            return row["team_win_rate"]

        self.assertEqual(win_rate("hardcore"), 1.0)
        self.assertEqual(win_rate("standard"), 0.0)


class AgentAsyncSdkTest(unittest.IsolatedAsyncioTestCase):
    async def test_agent_prefers_the_cancellable_async_sdk(self) -> None:
        response = SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content='{"thinking":"private","output":"Public answer"}'
                    )
                )
            ]
        )
        complete_async = AsyncMock(return_value=response)
        complete = Mock()
        client = SimpleNamespace(
            chat=SimpleNamespace(
                complete=complete,
                complete_async=complete_async,
            )
        )
        settings = SimpleNamespace(chat_model_large="mistral-large-latest")
        agent = LLMAgent("Player A", 0, model="mistral-large-latest")

        with (
            patch("app.agents.llm_agent.get_client", return_value=client),
            patch("app.agents.llm_agent.get_settings", return_value=settings),
        ):
            result = await agent._chat_json("Prompt", _PUBLIC_RESPONSE_SCHEMA)

        self.assertEqual(result["output"], "Public answer")
        complete_async.assert_awaited_once()
        complete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
