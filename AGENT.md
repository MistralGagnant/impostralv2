# AGENT.md — Impostral

Social bluffing game where **humans** and **Mistral LLM agents** share a room.
Every AI competes independently to pass as human, while all active players vote
during elimination rounds. Humans win by eliminating every AI. Each round follows:
**question -> vote -> resolution**.

Status: **functional POC**, validated end to end with chat, Voxtral STT, and TTS.

## Language rule

Code, comments, and documentation are written in English. English is the
canonical game language and fallback. The player-facing landing, game UI,
question deck, mock answers, agent output, STT, and preferred voices support
English and French. A room uses one immutable language.

## Environment

The dedicated virtual environment lives at the repository root in `venv/`.
Always invoke it through explicit paths: `./venv/bin/python`, `./venv/bin/pip`,
and `./venv/bin/uvicorn`.

The API key belongs in the gitignored `.env` file as `MISTRAL_API_KEY=...`.
Without a key, the game uses scripted agents in text-only **mock mode**. This is
useful for testing the game loop without audio or a microphone. `GET /config`
exposes `mock_mode`.

## Run

```bash
./venv/bin/uvicorn app.main:app --reload
# Open http://localhost:8000 in one tab per human player.
```

The default **Play** action uses anonymous quick matchmaking; the private
codename field may be left blank. `POST /matchmaking`
atomically reserves a human seat in the oldest waiting public lobby, or creates a
public lobby with the default composition. The browser opens the room WebSocket
with that short-lived reservation ticket; public players are automatically ready
and the game starts when all human seats are connected or after a configurable
15-second wait, provided at least `IMPOSTRAL_MIN_PUBLIC_START_HUMANS` humans are
present (a lone human can only reach the shared final-duel victory). Below that
floor the wait
extends up to `IMPOSTRAL_MAX_PUBLIC_START_EXTENSIONS` times, then starts anyway so
a lone player is never stranded. Public queues are partitioned
by room language. The landing menu offers an explicit EN/FR selector, remembers
the preferred menu language locally, and still defaults from the primary
browser locale. A stable anonymous
browser ID and a tab-specific session ID are stored locally for reconnection.
There is no sign-up or public user profile.

Every new game admission is protected by Cloudflare Turnstile when
`TURNSTILE_SECRET_KEY` is configured. The browser prepares a single-use token for
the `enter_game` action in the background, caches it for less than Turnstile's
five-minute validity window, and consumes it only on admission. The backend
validates its result, hostname, and action, then issues a short-lived seat
reservation. The public site key is configured as `turnstile_site_key` in
`app/config.py`. Without the secret, enforcement is disabled for local
development, while Cloud Run fails closed. WebSockets additionally require a
same-origin handshake and a valid reservation ticket; anonymous spectators are
not accepted.

Named private lobbies remain available under **Private lobby options**. One
player creates a lobby and chooses its human count; other players join using the
same name. The lobby shows the number of connected humans live and only its
creator can start the game; private lobbies never use the public 15-second
timer. Joining never creates a private room, so a wrong name is rejected.
`IMPOSTRAL_NUM_HUMANS` is
the public/default human count (bounded by `IMPOSTRAL_MIN_HUMANS` and
`IMPOSTRAL_MAX_HUMANS`); the AI count comes from `IMPOSTRAL_NUM_LLMS`. Configure
timings through `IMPOSTRAL_`-prefixed variables such as `IMPOSTRAL_MAX_ROUNDS`
and `IMPOSTRAL_QUESTION_SECONDS`. The latter is the private human input window
(25 seconds by default); `IMPOSTRAL_ANSWER_TURN_SECONDS` is the shared answer
lock window (38 seconds by default). Agents begin model generation only when the
human capture window closes, giving STT and chat the same hidden processing
budget. The lock includes the STT/TTS margin configured through
`IMPOSTRAL_ANSWER_PROCESSING_SECONDS`. TTS
defaults to uniform 1.1x playback with a 0.15-second post-clip gap. See
`app/config.py`. The first browser
interaction unlocks audio playback under autoplay policies.
`web/sound.js` generates the low-volume adaptive score and game cues with Web
Audio. It ducks the music during synthetic speech, silences music and effects
while the microphone is open, pauses when the page is hidden, and persists the
Music & FX toggle locally. Synthetic seat voices remain audible when effects are
muted because they are part of the game. `web/audio.js` reuses one media element
primed by the entry gesture for WebKit autoplay compatibility; if a browser
still blocks a seat voice, the game pauses that playback and displays an
explicit Enable voices action instead of silently acknowledging it.

The terminal payload is retained on `Room.game_over_payload` until
`finished_lobby_ttl_seconds` expires and is replayed to an already claimed seat
that reconnects. Humans win as one side when all agents are exposed, including
humans eliminated earlier; every surviving agent is still an independent
winner. The browser renders the verdict as an accessible result dialog with
role/model reveals, replay/menu actions, a Three.js result state, and a finite
outcome-specific score through `ImpostralSound.playResult()`.

## Default Mistral models (`app/config.py`)

| Role | Model | Environment override |
|------|-------|----------------------|
| Large agent | `mistral-large-latest` | `IMPOSTRAL_CHAT_MODEL_LARGE` |
| Medium agent | `mistral-medium-latest` | `IMPOSTRAL_CHAT_MODEL_MEDIUM` |
| Small agent | `mistral-small-latest` | `IMPOSTRAL_CHAT_MODEL_SMALL` |
| Ministral agent | `ministral-8b-latest` | `IMPOSTRAL_CHAT_MODEL_MINISTRAL` |
| STT | `voxtral-mini-latest` (room language) | `IMPOSTRAL_STT_MODEL`, `IMPOSTRAL_STT_LANGUAGE` |
| TTS | `voxtral-mini-tts-latest` | `IMPOSTRAL_TTS_MODEL` |

The default room has three humans and three agents, using Large, Medium, and
Small respectively. Agents also use different personas, temperatures, and
persona-specific human few-shot examples from `PERSONAS` in
`app/agents/llm_agent.py`. Personas are drawn without repetition inside a room.
A persona may carry a `licence` that relaxes the shared answer rules for itself;
only **The Troll** does, so it may joke, answer off topic, claim to be the human
of the table, and mistype on purpose. Guided decoding enforces a strict JSON Schema with
private `thinking` and one public `output` utterance of at most 100 characters,
preferably one short sentence. Round answers must address the exact personal
question with a concrete detail, but that is a suggestion: a seat that has just
claimed to be human or called for a vote may be answered instead of the card.
The ballot itself stays imperative — an agent must vote for the least convincing
competing AI and never for a seat it believes is human. Only `output` enters the transcript. Mock-mode agents
use card-specific scripted answers instead of unrelated persona examples,
rotated on the seat's rank among the room's agents through
`AgentBuildSpec.answer_variant` so that two seats never read the same line.

## Model performance tracking

Each finished game appends a JSON record to `IMPOSTRAL_STATS_PATH` (default
`data/results.jsonl`). `app/game/stats.py` records each model's win, survival,
elimination round, competitive vote accuracy, and whether the seat was
disqualified for voting a human out. Humans are recorded too, but
grouped anonymously into a single `Humans` bucket (never per pseudonym), so the
dashboard compares humans against each AI model. `/stats` exposes aggregates and
`/stats.html` renders the player comparison dashboard. Records created before
human tracking remain readable and are reported as unavailable human history.

## `mistralai` SDK version caveat

The project targets **`mistralai` 2.x**, whose structure differs from 1.x:

- Client import: `from mistralai.client import Mistral`; `app/mistral_client.py`
  supports both the 1.x and 2.x entry points.
- Cancellable SDK calls use `complete_async` when available, with `complete`
  in a worker thread only as an older-client fallback. The shared transport
  timeout defaults to 20 seconds through
  `IMPOSTRAL_MISTRAL_REQUEST_TIMEOUT_SECONDS`.
- TTS: `client.audio.speech.complete_async(model=..., voice_id=..., input=...,
  response_format="mp3")` returns base64 in `SpeechResponse.audio_data`.
- STT: `client.audio.transcriptions.complete_async(model=...,
  file={"file_name","content","content_type"})` returns
  `TranscriptionResponse.text`.
- Voices: `client.audio.voices.list(type_="preset")` returns voices with UUID
identifiers. `app/audio/voices.py` serves the room language first, so a French
room does not read French with an English accent. Presets ship a single French
speaker, so a full French room reuses their emotional variants instead of
borrowing English speakers. Exactly one foreign speaker is invited right after
the room-language speakers, on purpose: the accent is part of the fun and both
languages keep one. Only the seats' slice of that pool is shuffled in
`setup_seats`.

The STT and TTS wrappers degrade gracefully to text-only play when calls fail.

## Core mechanic: voice anonymization

Every human and LLM utterance uses the synthetic Voxtral voice assigned to that
seat through `_prepare_answer`, `_reveal_prepared`, and `audio/tts.py`.
Listeners cannot identify a human by
voice. Typing tells are hidden too: `app/game/answers.py` normalizes every
public answer, human or agent, to one sentence that starts with a capital and
ends with `.`, `!`, or `?`. Response-time tells are also hidden through a lock,
scramble, reveal flow. Every active seat prepares privately and in parallel during one fixed
window from the same prior-round transcript. Text survives a slow TTS call.
Locked answers are then revealed one at a time in a fresh randomized order.
No seat can copy an answer revealed earlier in the same round, and agents never
receive role information. That includes eliminated seats: the humans are told
what an eliminated player was, the agents are not. `_public_view` fills
`revealed_role` only once the phase is `game_over`, so an agent that voted a
human out plays the rest of the match without knowing it has already lost.
Connection state is server-private because exposing it would identify human
seats.

## Files

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, quick matchmaking, private lobby creation, WebSocket, audio endpoint, and static web client. |
| `app/config.py` | Models, timings, composition, and voice language settings. |
| `app/mistral_client.py` | Shared Mistral client with robust 1.x/2.x imports. |
| `app/turnstile.py` | Server-side Cloudflare Turnstile token verification. |
| `app/rooms.py` | Rooms with per-lobby composition, seats, connections, and human input routing. |
| `app/game/state_machine.py` | Phase engine, timing protection, and win conditions. |
| `app/game/events.py` | WebSocket message schemas; active roles are never exposed. |
| `app/game/questions.py` | Curated TRACE-to-ALIBI question director and local-demo answers. |
| `app/game/stats.py` | Per-game records and per-model performance aggregation. |
| `app/agents/llm_agent.py` | Structured LLM answers, votes, personas, few-shots, and mock fallback. |
| `app/agents/contracts.py` | Immutable public view and versioned autonomous-player protocol. |
| `app/agents/registry.py` | Trusted local provider registry and native Mistral factory. |
| `app/audio/stt.py` / `tts.py` | Voxtral wrappers with graceful fallback. |
| `app/audio/voices.py` | Cached preset voice pool, room language first. |
| `app/audio/store.py` | Ephemeral FIFO audio store served from `/audio/{id}`. |
| `web/` | 3D arena, adaptive Web Audio, model statistics dashboard, phase UI, and the header **Rules** dialog stating the victory, draw, and disqualification conditions. |

## WebSocket protocol

Quick play calls
`POST /matchmaking {player_id, session_id, name, turnstile_token}`. It returns
`room_id` and `reservation_token`; concurrent calls are serialized so they cannot
claim the same seat. Reservations expire after 20 seconds by default. Private
lobby creation calls
`POST /lobby {name, num_humans, player_id, session_id, turnstile_token}` and
returns the creator's reservation. Joining calls
`POST /lobby/{room_id}/join {player_id, session_id, turnstile_token}` and returns
another reservation. Creation returns 409 if the name is taken and 400 if
`num_humans` is out of range. `GET /config` exposes composition bounds plus the
public Turnstile site key when enforcement is active.

- **Client -> server**: `join{name, player_id, session_id, reservation_token,
  reconnect_token}`,
  `start_game` (private host only),
  `audio_blob{request_id,audio_b64,audio_mime,text}`,
  `submit_vote{request_id,target}`, and
  `playback_complete{playback_id}`.
- **Server -> client**: `session{reconnect_token}`, `room_state`,
  `phase_change{phase, deadline, prompt, round, question_id, question_act, answer_input_seconds}`,
  `answer_turn{seat, position, total, deadline}`,
  `input_status{request_id, mode, accepted}`,
  `playback_cancel{playback_id}`,
  `utterance{seat, text, audio_url, context, playback_id}`,
  `request_input{mode, deadline, request_id, targets}`,
  `vote_result{tally, eliminated, runoff}`,
  `elimination{seat, role}`,
  `game_over{winner, winners, roles, reason, agents}`, and `system`.

Every `audio_blob` and `submit_vote` echoes the private `request_id`; stale input
cannot resolve a later action. `deadline` is the number of remaining seconds;
the client renders the countdown.

On the first successful attach the server issues a per-seat `reconnect_token` in a
`session` message. A later reconnect must present it alongside the anonymous
`player_id`/`session_id`, so knowing those identifiers is not by itself enough to
reclaim a live seat.

Every HTTP response also carries a Content-Security-Policy and companion security
headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`). The CSP allows same-origin assets and WebSocket, the
Cloudflare Turnstile widget, and the pinned Three.js module CDNs used by the 3D
arena; keep those origins in sync with `web/arena3d.js`.

Rooms, reservations, audio clips, and open sockets are currently process-local.
Production deployment therefore requires one Uvicorn worker and one Cloud Run
instance (`max-instances=1`). A container restart intentionally ends active MVP
games; the client retries its WebSocket and returns to Play when the room is gone.

## Win conditions

- Every active human and AI is asked to vote.
- A first-ballot tie triggers a second vote restricted to the tied seats.
- A persistent tie uses cumulative public suspicion from prior rounds, then a secure draw only among exact ties.
- Missing or invalid first-ballot votes count against the silent seat and do not improve its vote-accuracy statistics.
- The selected seat is eliminated regardless of role, so every completed round eliminates one player.
- An AI that votes a human out loses. Only the agents whose **decisive** ballot
  named the eliminated human are disqualified — a first ballot replaced by a
  runoff no longer counts, and a timeout vote falls on the silent seat itself,
  never on a human. A disqualified agent keeps playing and voting but can never
  be a winner, and it never learns that it lost: agents are not told what an
  eliminated seat was. `Seat.disqualified` is server-private and never
  broadcast either, since naming the punished seats would expose them as AIs.
  The planned hardcore mode is the exception that would drop this penalty; it
  is not implemented yet.
- If every surviving AI is disqualified, the humans win. A last human facing a
  disqualified AI is therefore a plain human victory, not the shared duel.
- A final human and AI ends in a shared victory (`winner: "draw"`): the ballot
  is degenerate, so the last AI can never be exposed. The human is credited for
  surviving and the AI for staying hidden. Humans win as one side there too, so
  every human seat is a winner alongside the surviving agent. This is the only
  way a lone human can win, since exposing every AI is unreachable for them.
- Once every AI is eliminated, the surviving humans win.
- At `max_rounds`, every undetected AI wins individually; agents never form a team.

## Possible improvements

- Replace batch STT with `voxtral-mini-realtime-latest`.
- Add voice cloning through `ref_audio`, or more distinct speakers.
- Add player reconnection, multiple rooms, and a dedicated spectator screen.
