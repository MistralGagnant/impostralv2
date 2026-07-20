# Agent integration

Impostral treats every autonomous player as an isolated entity behind a
versioned, role-safe contract. Native Mistral players and future community
adapters use the same interface.

The engine sends only an immutable `PublicGameView`: public questions and
answers, alive seat IDs, aggregate ballots, runoff targets, and roles that have
already been revealed. It never sends a `Room`, browser identity, connection
state, human name, raw audio, response timing, reservation token, or active
role. Each agent receives a separate `AgentMatchContext`, owns its own state and
random generator, and makes its own answers and votes.

## Add a trusted local provider

Implement `GameAgent` from `app/agents/contracts.py`, then register a reviewed
factory during server startup:

```python
from app.agents.registry import agent_registry

agent_registry.register("my-agent", build_my_agent)
```

Server-side room composition can mount it with:

```python
room = Room(
    id="agent-lab",
    language="en",
    num_humans=3,
    num_llms=1,
    agent_providers=("my-agent",),
)
room.setup_seats()
```

The factory receives only `AgentBuildSpec`. The returned identity must declare
its supported languages. A room rejects an entity that cannot play in its
language.

Provider IDs are explicit local identifiers. The registry deliberately rejects
URLs and import paths. A remote or user-supplied agent should later be exposed
through a hardened transport adapter that implements the same `GameAgent`
protocol, with authentication, request deadlines, payload limits, egress
controls, and idempotent decision IDs. Arbitrary callback URLs must never be
passed directly from a browser into the registry.

For credible evaluation, keep one owner per competitive entity, randomize
persona/model pairing, and compare results within the same ruleset, room
composition, language, and question-deck version. These fields are written into
new result records.
