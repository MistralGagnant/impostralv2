"""Trusted provider registry for constructing autonomous game entities.

Providers are registered by local application code. The registry intentionally
accepts neither callback URLs nor import strings; a future remote transport
must therefore sit behind a reviewed adapter instead of turning user input into
network access or arbitrary imports.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from .contracts import GameAgent, normalize_language


_PROVIDER_ID_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")


@dataclass(frozen=True, slots=True)
class AgentBuildSpec:
    """Safe constructor inputs shared by every trusted provider factory."""

    seat_id: str
    persona_idx: int = 0
    model: str | None = None
    language: str = "en"
    seed: int | str | bytes | None = None
    # Rank of this agent among the room's agents, so scripted demo answers can
    # be rotated per seat instead of per persona. `None` leaves it to the
    # provider.
    answer_variant: int | None = None

    def __post_init__(self) -> None:
        if not self.seat_id.strip():
            raise ValueError("seat_id must not be empty")
        if self.persona_idx < 0:
            raise ValueError("persona_idx must not be negative")
        if self.answer_variant is not None and self.answer_variant < 0:
            raise ValueError("answer_variant must not be negative")
        object.__setattr__(self, "language", normalize_language(self.language))


AgentFactory = Callable[[AgentBuildSpec], GameAgent]


class AgentProviderRegistry:
    """Explicit mapping from a short provider ID to a trusted local factory."""

    def __init__(self) -> None:
        self._factories: dict[str, AgentFactory] = {}

    @staticmethod
    def _validate_provider_id(provider_id: str) -> str:
        normalized = provider_id.strip().lower()
        if not _PROVIDER_ID_RE.fullmatch(normalized):
            raise ValueError(
                "provider_id must be a short local identifier, not a URL or import path"
            )
        return normalized

    def register(
        self,
        provider_id: str,
        factory: AgentFactory,
        *,
        replace: bool = False,
    ) -> None:
        """Register one trusted factory, rejecting accidental replacement."""
        key = self._validate_provider_id(provider_id)
        if not callable(factory):
            raise TypeError("agent factory must be callable")
        if key in self._factories and not replace:
            raise ValueError(f"agent provider already registered: {key}")
        self._factories[key] = factory

    def create(self, provider_id: str, spec: AgentBuildSpec) -> GameAgent:
        """Create an agent only through a previously registered provider."""
        key = self._validate_provider_id(provider_id)
        factory = self._factories.get(key)
        if factory is None:
            raise KeyError(f"unknown agent provider: {key}")
        agent = factory(spec)
        if not isinstance(agent, GameAgent):
            raise TypeError(f"provider {key} did not return a GameAgent")
        return agent

    @property
    def providers(self) -> tuple[str, ...]:
        """Return registered provider IDs in deterministic order."""
        return tuple(sorted(self._factories))


def _mistral_factory(spec: AgentBuildSpec) -> GameAgent:
    # Imported lazily so contracts and custom registries stay lightweight.
    from .llm_agent import LLMAgent

    return LLMAgent(
        spec.seat_id,
        spec.persona_idx,
        model=spec.model,
        seed=spec.seed,
        language=spec.language,
        answer_variant=spec.answer_variant,
    )


agent_registry = AgentProviderRegistry()
agent_registry.register("mistral", _mistral_factory)


def create_agent(provider_id: str, spec: AgentBuildSpec) -> GameAgent:
    """Convenience entry point used by room composition code."""
    return agent_registry.create(provider_id, spec)

