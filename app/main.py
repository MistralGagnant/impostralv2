"""FastAPI application: game WebSocket, audio endpoint, and web client."""
from __future__ import annotations

import asyncio
import logging
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .audio import store
from .config import get_settings
from .game import events, questions, stats
from .game.state_machine import GameEngine
from .i18n import SUPPORTED_LANGUAGES, normalize_language, tr
from .modes import SUPPORTED_MODES, normalize_mode
from .rooms import rooms
from .turnstile import GAME_ENTRY_ACTION, verify_turnstile

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("impostral")

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

app = FastAPI(title="Impostral")

# Content-Security-Policy tuned to what the client actually loads: same-origin
# assets and WebSocket, the Cloudflare Turnstile widget (script + iframe), and
# the pinned Three.js module the 3D arena imports from a CDN (jsDelivr, with an
# unpkg fallback). Inline scripts/styles are still allowed because the pages ship
# a few inline blocks; the strong wins here are frame-ancestors, object-src, and
# base-uri.
_TURNSTILE_ORIGIN = "https://challenges.cloudflare.com"
# Kept in sync with the `import()` sources in web/arena3d.js.
_MODULE_CDNS = "https://cdn.jsdelivr.net https://unpkg.com"
_CSP = "; ".join(
    (
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "media-src 'self' blob: data:",
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline'",
        f"script-src 'self' 'unsafe-inline' {_TURNSTILE_ORIGIN} {_MODULE_CDNS}",
        f"connect-src 'self' {_TURNSTILE_ORIGIN} {_MODULE_CDNS}",
        f"frame-src {_TURNSTILE_ORIGIN}",
    )
)
_SECURITY_HEADERS = {
    "Content-Security-Policy": _CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=()",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    # The HTML documents are what carry the `?v=` asset version, so they must be
    # revalidated on every load. Served without Cache-Control they fell under the
    # browser's heuristic freshness, which pinned players to a cached page still
    # asking for the previous bundle — a deploy could not reach them at all.
    content_type = response.headers.get("content-type", "")
    if content_type.startswith("text/html"):
        response.headers.setdefault("Cache-Control", "no-cache")
    elif request.url.query and request.url.path.startswith(("/static/", "/assets/")):
        # Versioned assets are immutable: a change ships under a new `?v=`.
        response.headers.setdefault(
            "Cache-Control", "public, max-age=31536000, immutable"
        )
    return response


app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(str(WEB_DIR / "index.html"))


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> FileResponse:
    return FileResponse(str(ASSETS_DIR / "favicon.ico"), media_type="image/x-icon")


@app.get("/robots.txt", include_in_schema=False)
async def robots() -> FileResponse:
    return FileResponse(str(WEB_DIR / "robots.txt"), media_type="text/plain")


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap() -> FileResponse:
    return FileResponse(str(WEB_DIR / "sitemap.xml"), media_type="application/xml")


@app.get("/config")
async def public_config() -> dict:
    s = get_settings()
    return {
        "num_humans": s.num_humans,  # Default human count offered on creation.
        "num_llms": s.num_llms,
        "min_humans": s.min_humans,
        "max_humans": s.max_humans,
        "max_rounds": s.max_rounds,
        "mock_mode": s.mock_mode,
        "answer_input_seconds": s.question_seconds,
        "answer_processing_seconds": s.answer_processing_seconds,
        "answer_turn_seconds": s.answer_turn_seconds,
        "tts_playback_rate": s.tts_playback_rate,
        "human_wait_seconds": s.human_wait_seconds,
        "turnstile_enabled": s.turnstile_required,
        "turnstile_site_key": s.turnstile_site_key if s.turnstile_required else "",
        "default_language": "en",
        "supported_languages": list(SUPPORTED_LANGUAGES),
        "default_mode": "standard",
        "supported_modes": list(SUPPORTED_MODES),
    }


class CreateLobbyRequest(BaseModel):
    name: str
    num_humans: Optional[int] = None
    player_id: str = ""
    session_id: str = ""
    turnstile_token: str = Field("", max_length=2048)
    language: str = Field("en", max_length=20)
    mode: str = Field("standard", max_length=20)


class JoinLobbyRequest(BaseModel):
    player_id: str
    session_id: str
    turnstile_token: str = Field("", max_length=2048)
    language: str = Field("en", max_length=20)


class MatchmakingRequest(BaseModel):
    player_id: str
    session_id: str
    name: str = ""
    turnstile_token: str = Field("", max_length=2048)
    language: str = Field("en", max_length=20)
    mode: str = Field("standard", max_length=20)


_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,128}$")


def _valid_client_id(value: str) -> bool:
    return bool(_CLIENT_ID_RE.fullmatch(value))


async def _validate_game_entry(
    request: Request, turnstile_token: str
) -> Optional[JSONResponse]:
    """Return an error response when browser admission cannot be verified."""
    settings = get_settings()
    if not settings.turnstile_required:
        return None

    verification = await verify_turnstile(
        turnstile_token,
        secret_key=settings.turnstile_secret_key,
        expected_hostname=request.url.hostname or "",
        expected_action=GAME_ENTRY_ACTION,
    )
    if verification.allowed:
        log.info(
            "Turnstile validation accepted: action=%s hostname=%s",
            GAME_ENTRY_ACTION,
            request.url.hostname,
        )
        return None

    log.warning(
        "Turnstile validation failed: action=%s hostname=%s reason=%s unavailable=%s",
        GAME_ENTRY_ACTION,
        request.url.hostname,
        verification.reason,
        verification.unavailable,
    )
    if verification.unavailable:
        return JSONResponse(
            {"error": "security_check_unavailable"}, status_code=503
        )
    return JSONResponse({"error": "security_check_failed"}, status_code=403)


@app.post("/lobby")
async def create_lobby(req: CreateLobbyRequest, request: Request) -> JSONResponse:
    """Create a lobby with a chosen number of human seats.

    Others then join by typing the lobby name; joining never creates a room.
    """
    s = get_settings()
    name = req.name.strip()
    if not name:
        return JSONResponse({"error": "empty_name"}, status_code=400)
    if not _valid_client_id(req.player_id) or not _valid_client_id(req.session_id):
        return JSONResponse({"error": "bad_identity"}, status_code=400)

    num_humans = s.num_humans if req.num_humans is None else req.num_humans
    if not s.min_humans <= num_humans <= s.max_humans:
        return JSONResponse(
            {"error": "bad_humans", "min": s.min_humans, "max": s.max_humans},
            status_code=400,
        )

    admission_error = await _validate_game_entry(request, req.turnstile_token)
    if admission_error is not None:
        return admission_error

    room, token, _created = await rooms.create_private_and_reserve(
        name,
        num_humans=num_humans,
        num_llms=s.num_llms,
        player_id=req.player_id,
        session_id=req.session_id,
        language=normalize_language(req.language),
        mode=normalize_mode(req.mode),
    )
    if room is None:
        return JSONResponse({"error": "exists", "name": name}, status_code=409)
    return JSONResponse(
        {
            "name": name,
            "num_humans": room.num_humans,
            "num_llms": room.num_llms,
            "reservation_token": token,
            "language": room.language,
            "mode": room.mode,
        }
    )


@app.post("/lobby/{room_id}/join")
async def join_lobby(
    room_id: str, req: JoinLobbyRequest, request: Request
) -> JSONResponse:
    """Reserve a human seat in an existing private lobby."""
    name = room_id.strip()
    if not name:
        return JSONResponse({"error": "empty_name"}, status_code=400)
    if not _valid_client_id(req.player_id) or not _valid_client_id(req.session_id):
        return JSONResponse({"error": "bad_identity"}, status_code=400)

    admission_error = await _validate_game_entry(request, req.turnstile_token)
    if admission_error is not None:
        return admission_error

    room, token, error = await rooms.reserve_private(
        name, req.player_id, req.session_id
    )
    if error == "missing":
        return JSONResponse({"error": "missing", "name": name}, status_code=404)
    if error == "started":
        return JSONResponse({"error": "started", "name": name}, status_code=409)
    if error == "full":
        return JSONResponse({"error": "full", "name": name}, status_code=409)
    # A joiner never picks the ruleset: it comes from the lobby it joins.
    return JSONResponse({
        "name": room.id,
        "reservation_token": token,
        "language": room.language,
        "mode": room.mode,
    })


@app.post("/matchmaking")
async def matchmaking(req: MatchmakingRequest, request: Request) -> JSONResponse:
    """Reserve a seat in the oldest public lobby, creating one if needed."""
    if not _valid_client_id(req.player_id) or not _valid_client_id(req.session_id):
        return JSONResponse({"error": "bad_identity"}, status_code=400)
    admission_error = await _validate_game_entry(request, req.turnstile_token)
    if admission_error is not None:
        return admission_error
    room, token, created = await rooms.matchmake(
        req.player_id,
        req.session_id,
        normalize_language(req.language),
        normalize_mode(req.mode),
    )
    return JSONResponse({
        "room_id": room.id,
        "reservation_token": token,
        "created": created,
        "language": room.language,
        "mode": room.mode,
    })


@app.get("/stats")
async def game_stats() -> dict:
    """Return per-model performance aggregated over all recorded games."""
    return stats.aggregate()


@app.get("/stats.html")
async def stats_page() -> FileResponse:
    return FileResponse(str(WEB_DIR / "stats.html"))


@app.get("/audio/{clip_id}")
async def audio(clip_id: str) -> Response:
    item = store.get(clip_id)
    if item is None:
        return Response(status_code=404)
    data, content_type = item
    return Response(content=data, media_type=content_type)


def _normalize(msg) -> dict:
    """Convert a validated client message into a game-engine payload."""
    t = msg.type
    if t == "audio_blob":
        return {
            "request_id": msg.request_id,
            "audio_b64": msg.audio_b64,
            "audio_mime": msg.audio_mime,
            "text": msg.text,
        }
    if t == "submit_vote":
        return {"request_id": msg.request_id, "target": msg.target}
    return {}


def _room_state(room, *, you: Optional[str] = None) -> dict:
    """Build a lobby state without exposing which anonymous seats are human."""
    settings = get_settings()
    return events.srv_room_state(
        seats=[
            seat.public(
                reveal_role=(
                    bool(
                        getattr(
                            settings,
                            "reveal_role_on_elimination",
                            True,
                        )
                    )
                    and not seat.alive
                )
            )
            for seat in room.seats.values()
        ],
        phase=room.phase.value,
        round_no=room.round_no,
        you=you,
        auto_ready=room.visibility == "public",
        lobby_wait_remaining=room.lobby_wait_remaining(),
        visibility=room.visibility,
        connected_humans=len(room.connected_humans()),
        expected_humans=room.num_humans,
        is_host=room.is_host(you) if you else None,
        started=room.started,
        prompt=room.current_question,
        question_act=room.current_question_act,
        answer_input_seconds=room.current_answer_input_seconds or None,
        round_limit=questions.playable_rounds(
            len(room.seats),
            int(getattr(settings, "max_rounds", 5)),
        ),
        answers=room.current_answers,
        language=room.language,
        mode=room.mode,
    )


async def _broadcast_room_state(room) -> None:
    """Send personalized host permissions to every connected human."""
    for seat in list(room.connected_humans()):
        await room.send_seat(seat.id, _room_state(room, you=seat.id))


async def _launch_game(room, *, allow_partial: bool = False) -> None:
    if room.started or room.status != "waiting":
        return
    connected_humans = room.connected_humans()
    if not connected_humans:
        return
    if not allow_partial and len(connected_humans) < room.num_humans:
        return
    room.fill_absent_humans_with_agents()

    room.started = True
    room.status = "running"
    room.updated_at = time.time()
    wait_task = room.start_wait_task
    if wait_task and wait_task is not asyncio.current_task() and not wait_task.done():
        wait_task.cancel()
    await room.broadcast(events.srv_system(
        text=tr(
            room.language,
            "starting_humans",
            count=room.num_humans,
            plural="s" if room.num_humans != 1 else "",
        )
    ))
    await _broadcast_room_state(room)
    engine = GameEngine(room)
    room.engine_task = asyncio.create_task(engine.run())
    room.engine_task.add_done_callback(
        lambda _task: asyncio.create_task(rooms.cleanup())
    )
    log.info("Game started in room %s", room.id)


def _public_start_floor(room) -> int:
    """Return the smallest human count a public lobby should auto-start with."""
    floor = max(1, int(getattr(get_settings(), "min_public_start_humans", 2)))
    return min(floor, room.num_humans)


async def _arm_start_wait(room) -> None:
    """Announce and schedule the next public auto-start attempt."""
    wait_seconds = max(0, get_settings().human_wait_seconds)
    room.start_deadline = time.time() + wait_seconds
    await room.broadcast(events.srv_system(
        text=tr(room.language, "waiting_humans", seconds=wait_seconds)
    ))
    room.start_wait_task = asyncio.create_task(
        _start_after_wait(room, wait_seconds)
    )


async def _start_after_wait(room, delay: float) -> None:
    try:
        await asyncio.sleep(max(0, delay))
        await _resolve_public_start(room)
    except asyncio.CancelledError:
        return


async def _resolve_public_start(room) -> None:
    """Start a public lobby, or extend the wait while below the winnable floor."""
    if room.started or room.visibility != "public":
        return
    connected = len(room.connected_humans())
    if connected == 0:
        return
    if connected >= _public_start_floor(room):
        await _launch_game(room, allow_partial=True)
        return
    # A lone human cannot win against the AI seats. Wait a little longer for a
    # companion, but never strand the player: start after the last extension.
    max_extensions = max(0, int(getattr(get_settings(), "max_public_start_extensions", 1)))
    if room.start_extensions < max_extensions:
        room.start_extensions += 1
        await _arm_start_wait(room)
        return
    await _launch_game(room, allow_partial=True)


async def _maybe_start(room) -> None:
    if room.started or room.visibility != "public":
        return
    if len(room.connected_humans()) >= room.num_humans:
        await _launch_game(room)
        return
    if not room.connected_humans():
        return

    now = time.time()
    if not room.start_deadline:
        await _arm_start_wait(room)
    elif room.start_deadline <= now:
        await _resolve_public_start(room)


async def _start_private_game(room, seat_id: str) -> bool:
    """Start a private lobby only when its connected creator requests it."""
    if room.started or not room.is_host(seat_id):
        return False
    await _launch_game(room, allow_partial=True)
    return room.started


def _same_origin_websocket(ws: WebSocket) -> bool:
    """Accept browser sockets only when their Origin matches the request host."""
    origin = ws.headers.get("origin", "")
    host = ws.headers.get("host", "")
    parsed = urlparse(origin)
    return (
        parsed.scheme in {"http", "https"}
        and bool(host)
        and parsed.netloc.lower() == host.lower()
    )


@app.websocket("/ws/{room_id}")
async def ws_endpoint(ws: WebSocket, room_id: str) -> None:
    if not _same_origin_websocket(ws):
        log.warning("Rejected WebSocket with an invalid Origin header")
        await ws.close(code=1008)
        return
    await ws.accept()
    room = rooms.get(room_id)
    seat_id: str | None = None

    try:
        while True:
            raw = await ws.receive_json()
            msg = events.parse_client_message(raw)
            if msg is None:
                continue

            if msg.type == "join":
                if room is None:
                    # Joining never creates a lobby: the name must exist.
                    await ws.send_json(events.srv_system(
                        text=tr(msg.language, "room_missing", room=room_id),
                        code="room_missing",
                    ))
                    break
                seat = await room.attach(
                    ws,
                    msg.name,
                    player_id=msg.player_id,
                    session_id=msg.session_id,
                    reservation_token=msg.reservation_token,
                    reconnect_token=msg.reconnect_token,
                )
                seat_id = seat.id if seat is not None else None
                if seat_id is None:
                    await ws.send_json(events.srv_system(
                        text=tr(room.language, "reservation_expired"),
                        code="reservation_expired",
                    ))
                    break
                # Deliver the seat's reconnect secret before any state so a
                # transient drop can re-authenticate the same browser session.
                await room.send_seat(
                    seat_id,
                    events.srv_session(reconnect_token=seat.reconnect_token),
                )
                if room.status == "finished":
                    await room.send_seat(
                        seat_id,
                        _room_state(room, you=seat_id),
                    )
                    if room.game_over_payload:
                        await room.send_seat(
                            seat_id,
                            room.game_over_payload,
                        )
                    continue
                await room.broadcast(events.srv_system(
                    text=tr(room.language, "player_joined")
                ))
                active_turn = room.current_answer_turn()
                if active_turn is not None:
                    await room.send_seat(seat_id, active_turn)
                await room.resend_pending(seat_id)
                await _maybe_start(room)
                await _broadcast_room_state(room)
                continue

            if seat_id is None:
                continue  # Spectators cannot submit game actions.

            if msg.type == "start_game":
                if not await _start_private_game(room, seat_id):
                    await ws.send_json(events.srv_system(
                        text=tr(room.language, "host_only"),
                        code="host_only",
                    ))
                continue

            if msg.type == "playback_complete":
                room.resolve_playback(seat_id, msg.playback_id)
                continue

            # audio_blob / submit_vote -> expected input
            accepted = room.resolve_input(
                seat_id,
                _normalize(msg),
                request_id=msg.request_id,
            )
            await room.send_seat(
                seat_id,
                events.srv_input_status(
                    request_id=msg.request_id,
                    mode="answer" if msg.type == "audio_blob" else "vote",
                    accepted=accepted,
                ),
            )

    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("Error in WebSocket loop")
    finally:
        if room is not None:
            was_attached = room.seat_of(ws) is not None
            room.detach(ws)
            if was_attached:
                try:
                    await room.broadcast(events.srv_system(
                        text=tr(room.language, "player_disconnected")
                    ))
                    await _broadcast_room_state(room)
                except Exception:  # noqa: BLE001
                    pass
            await rooms.cleanup()
            asyncio.create_task(_cleanup_after_reconnect_grace())


async def _cleanup_after_reconnect_grace() -> None:
    await asyncio.sleep(max(1, get_settings().reconnect_grace_seconds))
    await rooms.cleanup()
