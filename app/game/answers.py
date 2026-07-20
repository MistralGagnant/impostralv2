"""Shared public-answer contract for human and agent seats."""
from __future__ import annotations

import re


MAX_PUBLIC_CHARS = 100


def normalize_public_answer(value: object) -> str:
    """Return at most one clean sentence within the public character budget."""
    text = " ".join(str(value or "").split()).strip()
    if not text:
        return ""

    # Normalize punctuation that produces inconsistent speech synthesis.
    text = re.sub(r"\s*[‐‑‒–—―]\s*", ", ", text)
    text = re.sub(r"\s+-+\s+", ", ", text)
    text = re.sub(r"(?<=\w)-(?=\w)", " ", text)
    text = re.sub(r",(?:\s*,)+", ",", text)
    # Trim a trailing explanatory relative in either supported language so the
    # one-sentence contract does not favor English phrasing.
    text = re.sub(
        r",\s*(?:that|which|qui|que|ce\s+qui|ce\s+que)\b.*$",
        "",
        text,
        flags=re.IGNORECASE,
    )

    # The game promise is one question, one sentence, one vote.
    text = re.split(r"(?<=[.!?])\s+", text, maxsplit=1)[0]
    if len(text) > MAX_PUBLIC_CHARS:
        text = text[: MAX_PUBLIC_CHARS - 1].rstrip(" ,;:-") + "…"
    return text
