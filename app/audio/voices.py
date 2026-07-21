"""Build the TTS voice pool from Voxtral preset voices.

Preset voices are fetched once and cached. The target language comes first — a
French room must not read French with an English accent — and inside a language
the pool keeps one voice per speaker, preferring neutral variants, before
falling back to the remaining variants. Presets currently offer a single French
speaker, so a full French room reuses their emotional variants rather than
borrowing English speakers. One foreign speaker is deliberately invited right
after the room-language speakers: a French voice reading English, or the
reverse, is a wanted flavour, not an accident. Mock mode and network failures
return `settings.voice_pool`, allowing graceful text-only play.
"""
from __future__ import annotations

import logging
from functools import lru_cache

from ..config import get_settings
from ..mistral_client import get_client

log = logging.getLogger("impostral.voices")

_NEUTRAL_HINTS = ("neutral", "balanced", "neutre")


def _speaker(item: dict) -> str:
    """Return the speaker name shared by every emotional variant."""
    return str(item.get("name", "")).split(" - ")[0].strip() or str(item.get("id"))


def _is_neutral(item: dict) -> bool:
    tags = " ".join(item.get("tags", [])).lower() + " " + str(item.get("name", "")).lower()
    return any(hint in tags for hint in _NEUTRAL_HINTS)


def _heads_and_rest(items: list[dict]) -> tuple[list[str], list[str]]:
    """Split into one voice per speaker, then the remaining variants."""
    heads: dict[str, dict] = {}
    for item in items:
        current = heads.get(_speaker(item))
        if current is None or (_is_neutral(item) and not _is_neutral(current)):
            heads[_speaker(item)] = item

    def by_name(item: dict) -> str:
        return str(item.get("name", ""))

    head_ids = [it["id"] for it in sorted(heads.values(), key=by_name) if it.get("id")]
    head_set = set(head_ids)
    rest = [it for it in items if it.get("id") and it["id"] not in head_set]
    return head_ids, [it["id"] for it in sorted(rest, key=by_name)]


@lru_cache
def _preset_voice_ids(prefix: str = "en") -> tuple[str, ...]:
    """Return one voice ID per speaker with the target language first."""
    client = get_client()
    if client is None:
        return ()
    try:
        items: list[dict] = []
        offset = 0
        while True:
            page = client.audio.voices.list(type_="preset", limit=50, offset=offset)
            d = page.model_dump()
            items.extend(d.get("items", []))
            total = d.get("total", len(items))
            offset += 50
            if offset >= total or not d.get("items"):
                break
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not list preset voices: %s", exc)
        return ()

    def lang_ok(it: dict) -> bool:
        return any(str(l).startswith(prefix) for l in (it.get("languages") or []))

    matching_heads, matching_rest = _heads_and_rest(
        [it for it in items if lang_ok(it)]
    )
    foreign_heads, foreign_rest = _heads_and_rest(
        [it for it in items if not lang_ok(it)]
    )

    # The room language otherwise comes first, variants included: a French room
    # reuses its single speaker's moods rather than sounding English. Only the
    # invited speaker crosses the language line early.
    ids = (
        matching_heads
        + foreign_heads[:1]
        + matching_rest
        + foreign_heads[1:]
        + foreign_rest
    )

    log.info("Preset voice pool: %d voices in %s, %d voices total",
             len(matching_heads) + len(matching_rest), prefix, len(ids))
    return tuple(ids)


def get_pool(language: str | None = None) -> list[str]:
    """Return real voice IDs outside mock mode, otherwise fallback labels."""
    settings = get_settings()
    if settings.mock_mode:
        return list(settings.voice_pool)
    prefix = (language or settings.voice_lang_prefix or "en").lower()
    ids = _preset_voice_ids(prefix)
    return list(ids) if ids else list(settings.voice_pool)
