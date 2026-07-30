"""Games-won leaderboard: who is ranked, how they are grouped, and per ruleset.

The pseudonym is optional, free-form, and unverified. These tests pin what that
means for the board: seats without one are never ranked, seats with one are
grouped case- and spacing-insensitively, and the two rulesets never mix.
"""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from starlette.testclient import TestClient

from app.game import stats
from app.main import app
from app.rooms import MAX_SEAT_NAME_LENGTH, Room, Seat


def _game(mode: str, humans: list[dict], llms: list[dict], ts: str) -> dict:
    return {
        "ts": ts,
        "room": "test",
        "rounds": 2,
        "mode": mode,
        "humans": humans,
        "llms": llms,
    }


def _human(name: str, *, won: bool, survived: bool | None = None) -> dict:
    return {
        "seat": "Player A",
        "name": name,
        "won": won,
        "survived": won if survived is None else survived,
    }


def _llm(model: str, *, won: bool) -> dict:
    return {"seat": "Player B", "model": model, "won": won, "survived": won}


class LeaderboardAggregationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "results.jsonl"
        self.settings = SimpleNamespace(stats_path=str(self.path))
        self.patcher = patch("app.game.stats.get_settings",
                             return_value=self.settings)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.addCleanup(self.tmp.cleanup)

    def _write(self, records: list[dict]) -> None:
        self.path.write_text(
            "".join(json.dumps(record) + "\n" for record in records),
            encoding="utf-8",
        )

    def test_named_humans_and_models_are_ranked_by_games_won(self) -> None:
        self._write([
            _game("standard", [_human("Ada", won=True)],
                  [_llm("mistral-large-latest", won=False)], "2026-07-01T10:00:00Z"),
            _game("standard", [_human("Ada", won=True)],
                  [_llm("mistral-large-latest", won=False)], "2026-07-02T10:00:00Z"),
            _game("standard", [_human("Bob", won=False)],
                  [_llm("mistral-large-latest", won=True)], "2026-07-03T10:00:00Z"),
        ])

        board = stats.leaderboard()["modes"]["standard"]
        names = [entry["name"] for entry in board["entries"]]

        self.assertEqual(names, ["Ada", "mistral-large-latest", "Bob"])
        ada = board["entries"][0]
        self.assertEqual((ada["kind"], ada["wins"], ada["games"]), ("human", 2, 2))
        self.assertEqual(ada["win_rate"], 1.0)
        self.assertEqual(ada["last_played"], "2026-07-02T10:00:00Z")
        self.assertEqual(board["entries"][2]["wins"], 0)
        self.assertEqual((board["humans"], board["ai_models"]), (2, 1))

    def test_one_pseudonym_spelled_differently_is_one_player(self) -> None:
        self._write([
            _game("standard", [_human("Ada", won=True)], [], "2026-07-01T10:00:00Z"),
            _game("standard", [_human("  aDa ", won=True)], [], "2026-07-02T10:00:00Z"),
        ])

        entries = stats.leaderboard()["modes"]["standard"]["entries"]

        self.assertEqual(len(entries), 1)
        # The most recent spelling is the one displayed.
        self.assertEqual(entries[0]["name"], "aDa")
        self.assertEqual(entries[0]["wins"], 2)

    def test_seats_without_a_pseudonym_are_counted_but_never_ranked(self) -> None:
        self._write([
            _game("standard",
                  [_human("", won=True), _human("   ", won=False),
                   _human("Ada", won=True)],
                  [], "2026-07-01T10:00:00Z"),
        ])

        board = stats.leaderboard()["modes"]["standard"]

        self.assertEqual([e["name"] for e in board["entries"]], ["Ada"])
        self.assertEqual(board["anonymous_appearances"], 2)
        self.assertEqual(board["anonymous_wins"], 1)

    def test_rulesets_are_ranked_separately_and_legacy_games_join_neither(self) -> None:
        self._write([
            _game("standard", [_human("Ada", won=True)], [], "2026-07-01T10:00:00Z"),
            _game("hardcore", [_human("Bob", won=True)], [], "2026-07-02T10:00:00Z"),
            # Recorded before the rulesets split: belongs to neither board.
            {"ts": "2026-06-01T10:00:00Z", "rounds": 1,
             "humans": [_human("Zoe", won=True)], "llms": []},
        ])

        payload = stats.leaderboard()

        self.assertEqual(
            [e["name"] for e in payload["modes"]["standard"]["entries"]], ["Ada"])
        self.assertEqual(
            [e["name"] for e in payload["modes"]["hardcore"]["entries"]], ["Bob"])
        # The top level still covers every recorded game, legacy included.
        self.assertEqual(payload["total_games"], 3)
        self.assertEqual(
            sorted(e["name"] for e in payload["entries"]), ["Ada", "Bob", "Zoe"])

    def test_pseudonyms_are_stored_bounded_and_free_of_control_characters(self) -> None:
        seats = {
            "Player A": SimpleNamespace(
                id="Player A", kind="human", name="  Ada‮\nLove" + "!" * 60,
                alive=True, eliminated_round=None, votes_total=1,
                votes_on_target=1, model=None),
            "Player B": SimpleNamespace(
                id="Player B", kind="llm", name="", model="mistral-large-latest",
                alive=False, eliminated_round=1, votes_total=1,
                votes_on_target=0, agent_id="", agent_provider="",
                agent_version="", disqualified=False, hunted_humans=False),
        }
        room = SimpleNamespace(id="room", round_no=2, seats=seats, mode="standard",
                               language="en", public_events=[])

        stats.record_game(room, ["Player A"])
        record = json.loads(self.path.read_text(encoding="utf-8").splitlines()[0])
        name = record["humans"][0]["name"]

        self.assertEqual(stats.MAX_NAME_LENGTH, MAX_SEAT_NAME_LENGTH)
        self.assertLessEqual(len(name), stats.MAX_NAME_LENGTH)
        self.assertEqual(name, "Ada Love")
        self.assertTrue(all(ch.isprintable() for ch in name))
        # The model comparison keeps its anonymous Humans bucket regardless.
        self.assertEqual(
            [row["model"] for row in stats.aggregate()["models"]],
            ["Humans", "mistral-large-latest"],
        )


class SeatNameLengthTest(unittest.IsolatedAsyncioTestCase):
    async def test_an_oversized_pseudonym_is_truncated_not_rejected(self) -> None:
        room = Room(id="room")
        room.seats["Player A"] = Seat(id="Player A", kind="human", voice="test")
        token = room.reserve(
            room.seats["Player A"], "player-identifier", "session-identifier", 60)

        seat = await room.attach(
            object(),
            "  Bartholomew  ",
            player_id="player-identifier",
            session_id="session-identifier",
            reservation_token=token,
        )

        # Losing the seat over a long codename would be far worse than losing
        # the extra characters.
        self.assertIsNotNone(seat)
        self.assertEqual(seat.name, "Bartholo")
        self.assertEqual(len(seat.name), MAX_SEAT_NAME_LENGTH)


class LeaderboardEndpointTest(unittest.TestCase):
    def test_endpoint_serves_both_boards_and_the_page(self) -> None:
        client = TestClient(app)

        payload = client.get("/leaderboard")
        self.assertEqual(payload.status_code, 200)
        body = payload.json()
        self.assertIn("entries", body)
        self.assertEqual(sorted(body["modes"]), ["hardcore", "standard"])

        page = client.get("/leaderboard.html")
        self.assertEqual(page.status_code, 200)
        self.assertIn("Leaderboard", page.text)


if __name__ == "__main__":
    unittest.main()
