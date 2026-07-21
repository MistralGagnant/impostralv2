"""Stable contracts between the game engine and autonomous players.

The types in this module deliberately model only public game information.
Controllers never receive a ``Room`` or ``Seat`` object, so transport adapters
cannot accidentally expose active roles, browser identities, connection state,
raw audio, or response timing.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal, Protocol, runtime_checkable


AgentLanguage = Literal["en", "fr"]
PublicRole = Literal["human", "agent", "llm"]


def normalize_language(value: str | None) -> AgentLanguage:
    """Return a supported game language, defaulting safely to English."""
    normalized = (value or "en").strip().lower().replace("_", "-")
    return "fr" if normalized == "fr" or normalized.startswith("fr-") else "en"


@dataclass(frozen=True, slots=True)
class AgentIdentity:
    """Versioned identity used for attribution and benchmark separation."""

    agent_id: str
    display_name: str
    provider_id: str
    version: str = "1"
    model: str = ""
    supported_languages: tuple[AgentLanguage, ...] = ("en",)

    def __post_init__(self) -> None:
        if not self.agent_id.strip():
            raise ValueError("agent_id must not be empty")
        if not self.display_name.strip():
            raise ValueError("display_name must not be empty")
        if not self.provider_id.strip():
            raise ValueError("provider_id must not be empty")
        if not self.version.strip():
            raise ValueError("version must not be empty")
        if not self.supported_languages:
            raise ValueError("supported_languages must not be empty")


@dataclass(frozen=True, slots=True)
class AgentMatchContext:
    """Private, role-safe context issued to one agent for one match."""

    match_id: str
    seat_id: str
    language: AgentLanguage | str = "en"
    ruleset_id: str = "classic.v1"
    max_rounds: int = 5
    seat_count: int = 0
    objective: str = "survive_to_terminal"
    protocol_version: str = "1"
    # Composition of the very first round, never refreshed. A live count of the
    # humans left would tell an agent what each eliminated seat was, which the
    # public view deliberately withholds until the terminal reveal.
    starting_humans: int = 0
    starting_agents: int = 0

    def __post_init__(self) -> None:
        if not self.match_id.strip():
            raise ValueError("match_id must not be empty")
        if not self.seat_id.strip():
            raise ValueError("seat_id must not be empty")
        if self.max_rounds < 1:
            raise ValueError("max_rounds must be positive")
        if self.seat_count < 0:
            raise ValueError("seat_count must not be negative")
        if self.starting_humans < 0 or self.starting_agents < 0:
            raise ValueError("starting composition must not be negative")
        object.__setattr__(self, "language", normalize_language(self.language))


@dataclass(frozen=True, slots=True)
class PublicSeat:
    """The public projection of a seat.

    ``revealed_role`` remains empty for an active seat during play. The
    ``PublicGameView`` invariant permits active-role disclosure only once the
    whole match has reached ``game_over``.
    """

    seat_id: str
    alive: bool = True
    revealed_role: PublicRole | None = None

    def __post_init__(self) -> None:
        if not self.seat_id.strip():
            raise ValueError("seat_id must not be empty")


@dataclass(frozen=True, slots=True)
class PublicGameEvent:
    """One immutable, role-safe event from the shared public history."""

    sequence: int
    kind: str
    round_no: int = 0
    seat_id: str = ""
    text: str = ""
    target_ids: tuple[str, ...] = ()
    tally: tuple[tuple[str, int], ...] = ()
    revealed_role: PublicRole | None = None

    def __post_init__(self) -> None:
        if self.sequence < 0:
            raise ValueError("event sequence must not be negative")
        if not self.kind.strip():
            raise ValueError("event kind must not be empty")
        if self.round_no < 0:
            raise ValueError("round_no must not be negative")
        if any(votes < 0 for _, votes in self.tally):
            raise ValueError("vote counts must not be negative")
        if self.revealed_role is not None and self.kind not in {
            "elimination",
            "game_over",
        }:
            raise ValueError("roles may appear only in public reveal events")

    def as_dict(self) -> dict:
        """Return a JSON-safe event projection for transport or prompting."""
        return {
            "sequence": self.sequence,
            "kind": self.kind,
            "round": self.round_no,
            "seat": self.seat_id or None,
            "text": self.text or None,
            "targets": list(self.target_ids),
            "tally": dict(self.tally),
            "revealed_role": self.revealed_role,
        }


@dataclass(frozen=True, slots=True)
class PublicGameView:
    """The exact public state an agent may reason from."""

    round_no: int
    phase: str
    seats: tuple[PublicSeat, ...]
    events: tuple[PublicGameEvent, ...] = ()
    question_id: str = ""
    question: str = ""
    question_act: str = ""

    def __post_init__(self) -> None:
        if self.round_no < 0:
            raise ValueError("round_no must not be negative")
        if not self.phase.strip():
            raise ValueError("phase must not be empty")
        seat_ids = [seat.seat_id for seat in self.seats]
        if len(seat_ids) != len(set(seat_ids)):
            raise ValueError("public seat IDs must be unique")
        if self.phase != "game_over" and any(
            seat.alive and seat.revealed_role is not None for seat in self.seats
        ):
            raise ValueError("active roles cannot be revealed during play")
        sequences = [event.sequence for event in self.events]
        if sequences != sorted(sequences) or len(sequences) != len(set(sequences)):
            raise ValueError("public event sequences must be ordered and unique")

    def as_dict(self) -> dict:
        """Return the public projection without adding any private fields."""
        return {
            "round": self.round_no,
            "phase": self.phase,
            "question": {
                "id": self.question_id,
                "text": self.question,
                "act": self.question_act,
            },
            "seats": [
                {
                    "id": seat.seat_id,
                    "alive": seat.alive,
                    "revealed_role": seat.revealed_role,
                }
                for seat in self.seats
            ],
            "events": [event.as_dict() for event in self.events],
        }

    def as_json(self) -> str:
        """Serialize public state so player text remains clearly delimited data."""
        return json.dumps(
            self.as_dict(),
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )


@dataclass(frozen=True, slots=True)
class AnswerRequest:
    """A single idempotent answer decision."""

    decision_id: str
    match: AgentMatchContext
    view: PublicGameView
    question: str
    question_id: str = ""
    time_budget_ms: int = 0
    max_chars: int = 100

    def __post_init__(self) -> None:
        if not self.decision_id.strip():
            raise ValueError("decision_id must not be empty")
        if not self.question.strip():
            raise ValueError("question must not be empty")
        if self.time_budget_ms < 0:
            raise ValueError("time_budget_ms must not be negative")
        if self.max_chars < 1:
            raise ValueError("max_chars must be positive")
        if self.match.seat_id not in {
            seat.seat_id for seat in self.view.seats
        }:
            raise ValueError("the agent seat must exist in the public view")


@dataclass(frozen=True, slots=True)
class VoteRequest:
    """A single idempotent ballot decision with server-owned constraints."""

    decision_id: str
    match: AgentMatchContext
    view: PublicGameView
    eligible_targets: tuple[str, ...]
    time_budget_ms: int = 0
    runoff: bool = False

    def __post_init__(self) -> None:
        if not self.decision_id.strip():
            raise ValueError("decision_id must not be empty")
        if self.time_budget_ms < 0:
            raise ValueError("time_budget_ms must not be negative")
        if len(self.eligible_targets) != len(set(self.eligible_targets)):
            raise ValueError("eligible_targets must be unique")
        if self.match.seat_id in self.eligible_targets:
            raise ValueError("an agent cannot vote for its own seat")
        alive_ids = {seat.seat_id for seat in self.view.seats if seat.alive}
        if self.match.seat_id not in alive_ids:
            raise ValueError("an eliminated agent cannot vote")
        if not set(self.eligible_targets).issubset(alive_ids):
            raise ValueError("eligible targets must be alive public seats")


@runtime_checkable
class GameAgent(Protocol):
    """Controller interface implemented by native and future remote adapters."""

    @property
    def identity(self) -> AgentIdentity:
        """Return the immutable identity attributed in match results."""

    async def start_match(self, context: AgentMatchContext) -> None:
        """Initialize isolated state for one match."""

    async def answer(self, request: AnswerRequest) -> str:
        """Return only the public answer for one question."""

    async def vote(self, request: VoteRequest) -> str:
        """Return one exact seat ID from ``eligible_targets``."""

    async def end_match(self, final_view: PublicGameView | None = None) -> None:
        """Release match-local state without receiving private role data."""
