"""Shared public-answer contract for human and agent seats."""
from __future__ import annotations

import re


MAX_PUBLIC_CHARS = 100

# A sentence may legitimately close on an ellipsis or on the truncation mark.
_TERMINAL_PUNCTUATION = ".!?…"
# Punctuation that may sit after the terminal mark, or before the first letter.
_CLOSERS = "\"'»)]}”’"
_OPENERS = "\"'«([{“‘"


def _capitalize_first_letter(text: str) -> str:
    """Uppercase the opening letter, looking past an opening quote or bracket."""
    for index, char in enumerate(text):
        if char in _OPENERS:
            continue
        if not char.isalpha():
            # A digit or a symbol opens the sentence as typed.
            return text
        return text[:index] + char.upper() + text[index + 1 :]
    return text


def _ensure_terminal_punctuation(text: str) -> str:
    """Close the sentence on `.`, `!`, or `?` when the speaker left it open."""
    text = text.rstrip(" ,;:")
    if not text:
        return ""
    stripped = text.rstrip(_CLOSERS)
    if stripped and stripped[-1] in _TERMINAL_PUNCTUATION:
        return text
    # Keep the public budget intact even when the period is what overflows it.
    if len(text) >= MAX_PUBLIC_CHARS:
        text = text[: MAX_PUBLIC_CHARS - 1].rstrip(" ,;:")
    return text + "."


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

    # A typed answer left in lowercase and without a final mark would read as a
    # human tell next to model output, so every seat is presented alike.
    text = _capitalize_first_letter(text)
    return _ensure_terminal_punctuation(text)
