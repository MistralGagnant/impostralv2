"""Per-game competitive AI result recording, aggregation, and leaderboard.

Each finished game appends one JSON line to `settings.stats_path`. Aggregation
groups those records by the model assigned to each LLM seat, so the `/stats` page
can compare model performance. `leaderboard()` reads the same records the other
way round — one row per named contestant, human pseudonym or AI model, ranked by
games won. Recording is best-effort: any failure is logged and swallowed so it
can never interrupt a game.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from ..config import get_settings
from ..modes import (
    DEFAULT_MODE,
    SUPPORTED_MODES,
    is_hardcore,
    normalize_mode,
    ruleset_id,
)
from ..rooms import MAX_SEAT_NAME_LENGTH

log = logging.getLogger("impostral.stats")


# Pseudonyms are free-form player input. They are stored and served as plain
# text (the dashboard renders them with `textContent`), but never longer than
# the seat allows, and never with control characters or layout tricks inside.
# The bound is applied again on read, so a record written under an older, looser
# limit is displayed within the current one.
MAX_NAME_LENGTH = MAX_SEAT_NAME_LENGTH


def _path() -> Path:
    return Path(get_settings().stats_path)


def _clean_name(raw) -> str:
    """Return a display-safe pseudonym, or "" for a seat that stayed anonymous."""
    text = "".join(
        ch if ch.isprintable() else " " for ch in str(raw or "")
    )
    return " ".join(text.split())[:MAX_NAME_LENGTH]


def _name_key(name: str) -> str:
    """Group pseudonyms that differ only in case or spacing."""
    return " ".join(name.split()).casefold()


def record_game(room, winners: list[str]) -> None:
    """Append one record with every individual winning seat."""
    try:
        rounds = room.round_no
        llms = [
            {
                "model": seat.model,
                "agent_id": getattr(seat, "agent_id", ""),
                "provider": getattr(seat, "agent_provider", ""),
                "agent_version": getattr(seat, "agent_version", ""),
                "seat": seat.id,
                "won": seat.id in winners,
                "survived": seat.alive,
                # Voted a human out, so it could not win whatever it survived.
                # Standard rooms only: hardcore reads the same ballot as the
                # objective, and records it under `hunted_humans` instead.
                "disqualified": bool(getattr(seat, "disqualified", False)),
                # Landed at least one human elimination. This is what a
                # hardcore win is made of, and dead weight on a standard seat.
                "hunted_humans": bool(getattr(seat, "hunted_humans", False)),
                "eliminated_round": seat.eliminated_round,
                "votes_total": seat.votes_total,
                "votes_on_target": seat.votes_on_target,
            }
            for seat in room.seats.values()
            if seat.kind == "llm"
        ]
        # `_aggregate_records` still folds every human into one "Humans" bucket,
        # so the model comparison is unchanged. The pseudonym is recorded on top
        # of that for the leaderboard, and only when the player typed one: the
        # field stays empty for anyone who left the codename blank, and such a
        # seat is never ranked.
        humans = [
            {
                "seat": seat.id,
                "name": _clean_name(getattr(seat, "name", "")),
                "won": seat.id in winners,
                "survived": seat.alive,
                "eliminated_round": seat.eliminated_round,
                "votes_total": seat.votes_total,
                "votes_on_target": seat.votes_on_target,
            }
            for seat in room.seats.values()
            if seat.kind == "human"
        ]
        mode = normalize_mode(getattr(room, "mode", DEFAULT_MODE))
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "room": room.id,
            "winners": winners,
            "rounds": rounds,
            "mode": mode,
            "ruleset": ruleset_id(mode),
            "question_deck": "trace-to-alibi.v1",
            "language": getattr(room, "language", "en"),
            "composition": {
                "humans": len(humans),
                "agents": len(llms),
            },
            "question_ids": [
                event.get("question_id")
                for event in getattr(room, "public_events", [])
                if event.get("type") == "question" and event.get("question_id")
            ],
            "llms": llms,
            "humans": humans,
        }
        path = _path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not record game stats: %s", exc)


def _read_records() -> list[dict]:
    path = _path()
    if not path.exists():
        return []
    records = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue  # Skip corrupt lines.
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not read game stats: %s", exc)
    return records


def _on_target_votes(seat: dict, *, hardcore: bool, is_llm: bool) -> tuple[int, int]:
    """Return this seat's (counted ballots, on-target ballots).

    `votes_on_target` is scored against the kind of seat the voter is actually
    playing to eliminate, which is a human for a hardcore agent. Records
    predating that only carry `votes_correct`, always meaning "voted an AI".
    That reading still holds everywhere except for a hardcore agent, whose
    objective is the exact opposite, so those older ballots are reported as
    having no target history rather than counted backwards.
    """
    total = seat.get("votes_total", 0) or 0
    if "votes_on_target" in seat:
        return total, seat.get("votes_on_target", 0) or 0
    if "votes_correct" in seat and not (hardcore and is_llm):
        return total, seat.get("votes_correct", 0) or 0
    return 0, 0


def _aggregate_records(records: list[dict]) -> dict:
    """Return per-model aggregates over one already selected set of games."""
    # Accumulators keyed by model name.
    acc: dict[str, dict] = {}

    def bucket(model: str) -> dict:
        return acc.setdefault(
            model,
            {
                "games": 0,
                "wins": 0,
                "survivals": 0,
                "votes_total": 0,
                "votes_on_target": 0,
                "rounds_survived_sum": 0,
            },
        )

    def accumulate(
        seat: dict, model: str, rounds: int, *, hardcore: bool, is_llm: bool
    ) -> None:
        b = bucket(model)
        b["games"] += 1
        if seat.get("won"):
            b["wins"] += 1
        if seat.get("survived"):
            b["survivals"] += 1
        counted, on_target = _on_target_votes(
            seat, hardcore=hardcore, is_llm=is_llm
        )
        b["votes_total"] += counted
        b["votes_on_target"] += on_target
        elim = seat.get("eliminated_round")
        b["rounds_survived_sum"] += elim if elim is not None else rounds

    legacy_games_without_humans = 0
    if records:
        # Keep humans visible even when every existing record predates human
        # tracking. The UI can then explain the missing history explicitly.
        bucket("Humans")

    for rec in records:
        rounds = rec.get("rounds", 0) or 0
        hardcore = is_hardcore(rec.get("mode"))
        for seat in rec.get("llms", []):
            accumulate(
                seat,
                seat.get("model") or "(unknown)",
                rounds,
                hardcore=hardcore,
                is_llm=True,
            )
        # All humans across every game collapse into one "Humans" bucket.
        human_seats = rec.get("humans") or []
        if not human_seats:
            legacy_games_without_humans += 1
        for seat in human_seats:
            accumulate(
                seat, "Humans", rounds, hardcore=hardcore, is_llm=False
            )

    models = []
    for model, b in sorted(acc.items(), key=lambda item: (item[0] != "Humans", item[0])):
        games = b["games"] or 1  # Guard against division by zero.
        votes = b["votes_total"] or 1
        models.append(
            {
                "model": model,
                "games": b["games"],
                "team_win_rate": b["wins"] / games,
                "survival_rate": b["survivals"] / games,
                "vote_accuracy": b["votes_on_target"] / votes,
                "votes_total": b["votes_total"],
                "avg_rounds_survived": b["rounds_survived_sum"] / games,
                "data_available": bool(b["games"]),
                # A row can have games but no comparable ballot history.
                "target_data_available": bool(b["votes_total"]),
                "legacy_games_without_data": (
                    legacy_games_without_humans if model == "Humans" else 0
                ),
            }
        )

    return {
        "total_games": len(records),
        "legacy_games_without_humans": legacy_games_without_humans,
        "models": models,
    }


def aggregate() -> dict:
    """Return combined aggregates plus one identical breakdown per ruleset.

    The top-level keys keep their original meaning — every recorded game, both
    rulesets mixed — so an existing consumer is unaffected. `modes` splits the
    same numbers per ruleset, because a hardcore agent hunting humans is not
    comparable to a standard one.

    Records written before hardcore existed carry no `mode`. They used to be
    folded into the standard bucket, which filled it with games played under
    the pre-split balancing — where an agent was already rewarded for
    eliminating humans. They belong to neither published ruleset, so they are
    now left out of the breakdown entirely.
    """
    records = _read_records()
    return {
        **_aggregate_records(records),
        "modes": {
            mode: _aggregate_records(_mode_records(records, mode))
            for mode in SUPPORTED_MODES
        },
    }


def _mode_records(records: list[dict], mode: str) -> list[dict]:
    """Return the records played under exactly this ruleset.

    Records written before hardcore existed carry no `mode` and belong to
    neither published ruleset, so they are left out rather than folded into
    standard.
    """
    return [
        record
        for record in records
        if record.get("mode") and normalize_mode(record.get("mode")) == mode
    ]


def _leaderboard_records(records: list[dict]) -> dict:
    """Return one ranked row per contestant over one already selected set.

    A contestant is a named human (grouped by pseudonym, case- and
    spacing-insensitive) or an AI model. Humans who left the codename blank
    cannot be told apart from each other, so they are counted as anonymous
    appearances instead of being ranked as one shared player.
    """
    entries: dict[tuple[str, str], dict] = {}
    anonymous_appearances = 0
    anonymous_wins = 0

    def bucket(kind: str, key: str, label: str) -> dict:
        entry = entries.setdefault(
            (kind, key),
            {
                "kind": kind,
                "name": label,
                "games": 0,
                "wins": 0,
                "survivals": 0,
                "last_played": "",
            },
        )
        # Keep the most recent spelling of a pseudonym typed several ways.
        entry["name"] = label
        return entry

    def accumulate(entry: dict, seat: dict, ts: str) -> None:
        entry["games"] += 1
        if seat.get("won"):
            entry["wins"] += 1
        if seat.get("survived"):
            entry["survivals"] += 1
        if ts > entry["last_played"]:
            entry["last_played"] = ts

    for rec in records:
        ts = str(rec.get("ts") or "")
        for seat in rec.get("llms") or []:
            model = seat.get("model") or "(unknown)"
            accumulate(bucket("ai", model, model), seat, ts)
        for seat in rec.get("humans") or []:
            name = _clean_name(seat.get("name"))
            if not name:
                anonymous_appearances += 1
                anonymous_wins += 1 if seat.get("won") else 0
                continue
            accumulate(bucket("human", _name_key(name), name), seat, ts)

    ranked = sorted(
        entries.values(),
        key=lambda e: (
            -e["wins"],
            -(e["wins"] / e["games"] if e["games"] else 0),
            -e["games"],
            e["name"].casefold(),
        ),
    )
    for entry in ranked:
        games = entry["games"] or 1  # Guard against division by zero.
        entry["win_rate"] = entry["wins"] / games
        entry["survival_rate"] = entry["survivals"] / games

    return {
        "total_games": len(records),
        "entries": ranked,
        "humans": sum(1 for e in ranked if e["kind"] == "human"),
        "ai_models": sum(1 for e in ranked if e["kind"] == "ai"),
        # Seats played without a codename: real games, but unattributable.
        "anonymous_appearances": anonymous_appearances,
        "anonymous_wins": anonymous_wins,
    }


def leaderboard() -> dict:
    """Return games won per contestant, overall and per ruleset.

    Same shape as `aggregate()`: the top level covers every recorded game and
    `modes` splits it, because winning a hardcore game means surviving whoever
    you sent home, which is not the same achievement as a standard win.
    """
    records = _read_records()
    return {
        **_leaderboard_records(records),
        "modes": {
            mode: _leaderboard_records(_mode_records(records, mode))
            for mode in SUPPORTED_MODES
        },
    }
