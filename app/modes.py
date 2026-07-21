"""Room rulesets shared by matchmaking, the engine, the agents, and stats.

A room picks one immutable mode at creation time, exactly like its language.

- ``standard``: an AI that votes a human out loses the game. Agents are told to
  hunt each other only.
- ``hardcore``: surviving is the only thing that counts for an AI, so hunting
  the humans is both allowed and profitable. The disqualification penalty is
  dropped and the agents are told so.
"""
from __future__ import annotations

from typing import Final

DEFAULT_MODE: Final = "standard"
HARDCORE_MODE: Final = "hardcore"
SUPPORTED_MODES: Final = (DEFAULT_MODE, HARDCORE_MODE)

# Ruleset identifiers travel to the agents through `AgentMatchContext` and to
# the results log, so a recorded game always says which rules it was played by.
RULESET_IDS: Final = {
    DEFAULT_MODE: "independent-survival.v2",
    HARDCORE_MODE: "hardcore-survival.v1",
}


def normalize_mode(value: object) -> str:
    """Return a supported mode, defaulting safely to the standard ruleset."""
    cleaned = str(value or "").strip().lower()
    return HARDCORE_MODE if cleaned == HARDCORE_MODE else DEFAULT_MODE


def is_hardcore(value: object) -> bool:
    """Return whether a mode string selects the hardcore ruleset."""
    return normalize_mode(value) == HARDCORE_MODE


def ruleset_id(value: object) -> str:
    """Return the versioned ruleset identifier for one mode."""
    return RULESET_IDS[normalize_mode(value)]
