"""Message schemas exchanged over the game WebSocket.

Outgoing server messages are dictionaries built by `srv_*` helpers. Incoming
client messages are validated by `parse_client_message`.

The role of an active seat is never disclosed. It is only revealed on
elimination when `reveal_role_on_elimination` is enabled.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, ValidationError


class Phase(str, Enum):
    LOBBY = "lobby"
    QUESTION = "question"
    VOTE = "vote"
    RESOLUTION = "resolution"
    GAME_OVER = "game_over"


# --- Incoming messages: client -> server ---------------------------------


class JoinMsg(BaseModel):
    type: Literal["join"]
    name: str = ""
    player_id: str = ""
    session_id: str = ""
    reservation_token: str = ""
    reconnect_token: str = Field(default="", max_length=128)
    language: str = Field(default="en", max_length=20)


class AudioBlobMsg(BaseModel):
    type: Literal["audio_blob"]
    request_id: str = Field(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    # Base64 audio from MediaRecorder with its actual MIME type, or fallback text.
    audio_b64: Optional[str] = Field(default=None, max_length=2_000_000)
    audio_mime: Optional[str] = Field(default=None, max_length=100)
    text: Optional[str] = Field(default=None, max_length=100)


class SubmitVoteMsg(BaseModel):
    type: Literal["submit_vote"]
    request_id: str = Field(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    target: str


class StartGameMsg(BaseModel):
    type: Literal["start_game"]


class PlaybackCompleteMsg(BaseModel):
    type: Literal["playback_complete"]
    playback_id: str


ClientMessage = (
    JoinMsg | AudioBlobMsg | SubmitVoteMsg | StartGameMsg | PlaybackCompleteMsg
)

_PARSERS = {
    "join": JoinMsg,
    "audio_blob": AudioBlobMsg,
    "submit_vote": SubmitVoteMsg,
    "start_game": StartGameMsg,
    "playback_complete": PlaybackCompleteMsg,
}


def parse_client_message(raw: dict[str, Any]) -> Optional[BaseModel]:
    """Validate an incoming message or return None when invalid or unknown."""
    parser = _PARSERS.get(raw.get("type"))
    if parser is None:
        return None
    try:
        return parser.model_validate(raw)
    except ValidationError:
        return None


# --- Outgoing messages: server -> client ---------------------------------


def srv_room_state(
    *, seats: list[dict], phase: str, round_no: int, you: Optional[str],
    auto_ready: bool = False, lobby_wait_remaining: Optional[int] = None,
    visibility: str = "public", connected_humans: Optional[int] = None,
    expected_humans: Optional[int] = None, is_host: Optional[bool] = None,
    started: bool = False, prompt: str = "", question_act: str = "",
    answer_input_seconds: Optional[float] = None,
    round_limit: Optional[int] = None,
    answers: Optional[dict[str, str]] = None,
    language: str = "en",
    mode: str = "standard",
) -> dict:
    return {
        "type": "room_state",
        "seats": seats,
        "phase": phase,
        "round": round_no,
        "you": you,
        "auto_ready": auto_ready,
        "lobby_wait_remaining": lobby_wait_remaining,
        "visibility": visibility,
        "connected_humans": connected_humans,
        "expected_humans": expected_humans,
        "is_host": is_host,
        "started": started,
        "prompt": prompt,
        "question_act": question_act,
        "answer_input_seconds": answer_input_seconds,
        "round_limit": round_limit,
        "answers": answers or {},
        "language": language,
        # Public and role-safe: the ruleset is chosen before anyone is seated.
        "mode": mode,
    }


def srv_phase_change(
    *,
    phase: str,
    deadline: Optional[float],
    prompt: str = "",
    round_no: Optional[int] = None,
    question_id: str = "",
    question_act: str = "",
    answer_input_seconds: Optional[float] = None,
) -> dict:
    """Describe a phase, including public question-director metadata."""
    return {
        "type": "phase_change",
        "phase": phase,
        "deadline": deadline,
        "prompt": prompt,
        "round": round_no,
        "question_id": question_id,
        "question_act": question_act,
        "answer_input_seconds": answer_input_seconds,
    }


def srv_answer_turn(
    *, seat: str, position: int, total: int, deadline: Optional[float]
) -> dict:
    """Announce one role-neutral answer reveal to the room."""
    return {
        "type": "answer_turn",
        "seat": seat,
        "position": position,
        "total": total,
        "deadline": deadline,
    }


def srv_utterance(
    *, seat: str, text: str, audio_url: Optional[str], context: str = "",
    playback_id: str = "",
) -> dict:
    return {
        "type": "utterance",
        "seat": seat,
        "text": text,
        "audio_url": audio_url,
        "context": context,  # For example: "answer" or "to Player C".
        "playback_id": playback_id,
    }


def srv_request_input(
    *, mode: str, deadline: Optional[float], request_id: str,
    targets: Optional[list[str]] = None,
) -> dict:
    """Request an answer or vote from the relevant human client."""
    return {
        "type": "request_input",
        "mode": mode,
        "deadline": deadline,
        "request_id": request_id,
        "targets": targets,
    }


def srv_input_status(*, request_id: str, mode: str, accepted: bool) -> dict:
    """Confirm whether a private answer or vote reached its live deadline."""
    return {
        "type": "input_status",
        "request_id": request_id,
        "mode": mode,
        "accepted": accepted,
    }


def srv_playback_cancel(*, playback_id: str) -> dict:
    """Tell browsers to discard a voice reveal that exceeded its server slot."""
    return {
        "type": "playback_cancel",
        "playback_id": playback_id,
    }


def srv_vote_result(
    *, tally: dict[str, int], eliminated: Optional[str],
    runoff: Optional[list[str]] = None,
    tie_break: Optional[dict[str, Any]] = None,
) -> dict:
    return {
        "type": "vote_result",
        "tally": tally,
        "eliminated": eliminated,
        "runoff": runoff or [],
        "tie_break": tie_break,
    }


def srv_elimination(*, seat: str, role: Optional[str], model: Optional[str] = None) -> dict:
    # `model` names the LLM behind an AI seat (e.g. "mistral-large-latest").
    return {"type": "elimination", "seat": seat, "role": role, "model": model}


def srv_game_over(
    *, winner: str, winners: list[str], roles: dict[str, str],
    models: dict[str, str], message: str = "", reason: str = "",
    agents: Optional[dict[str, dict[str, str]]] = None,
) -> dict:
    return {
        "type": "game_over",
        "winner": winner,
        "winners": winners,
        "roles": roles,
        "models": models,  # seat id -> model name, for AI seats only.
        "message": message,
        "reason": reason,
        "agents": agents or {},
    }


def srv_session(*, reconnect_token: str) -> dict:
    """Hand the claimed seat its private secret for a later reconnection."""
    return {"type": "session", "reconnect_token": reconnect_token}


def srv_system(*, text: str, code: str = "") -> dict:
    message = {"type": "system", "text": text}
    if code:
        message["code"] = code
    return message
