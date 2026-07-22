"""Central configuration for IMPOSTRAL_-prefixed environment variables.

Every value has a practical default so the game can start immediately. Without
MISTRAL_API_KEY, the game uses scripted agents in text-only mock mode.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="IMPOSTRAL_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # --- Mistral ---------------------------------------------------------
    # The API key follows the standard unprefixed MISTRAL_API_KEY convention.
    mistral_api_key: str = Field("", alias="MISTRAL_API_KEY")
    chat_model_large: str = "mistral-large-latest"
    chat_model_medium: str = "mistral-medium-latest"
    chat_model_small: str = "mistral-small-latest"
    chat_model_ministral: str = "ministral-8b-latest"
    stt_model: str = "voxtral-mini-latest"
    stt_language: str = "en"
    tts_model: str = "voxtral-mini-tts-latest"
    mistral_request_timeout_seconds: int = 20

    # --- Browser admission -----------------------------------------------
    # The site key is public. The secret follows Cloudflare's standard
    # unprefixed environment variable and enables enforcement when present.
    turnstile_site_key: str = "0x4AAAAAAD4tTOpT16Ki8-cd"
    turnstile_secret_key: str = Field("", alias="TURNSTILE_SECRET_KEY")
    cloud_run_service: str = Field("", alias="K_SERVICE")

    # --- Model performance tracking -------------------------------------
    stats_path: str = "data/results.jsonl"

    # --- Game composition ------------------------------------------------
    # `num_humans` is the default seat count offered when creating a lobby;
    # the creator may pick any value within [min_humans, max_humans].
    num_humans: int = 3
    num_llms: int = 3
    min_humans: int = 1
    max_humans: int = 8
    max_rounds: int = 5
    reveal_role_on_elimination: bool = True
    human_wait_seconds: int = 15
    # Humans can only possibly win when at least two of them play (they must
    # eliminate every AI before the room shrinks to a final duel). Public
    # matchmaking therefore avoids auto-starting an unwinnable solo game, while
    # still starting eventually so a lone player is never stranded.
    min_public_start_humans: int = 2
    max_public_start_extensions: int = 1

    # --- Ephemeral lobby lifecycle --------------------------------------
    matchmaking_reservation_seconds: int = 20
    reconnect_grace_seconds: int = 30
    waiting_lobby_ttl_seconds: int = 600
    finished_lobby_ttl_seconds: int = 300

    # --- Phase durations in seconds -------------------------------------
    # Humans can submit during the private input window. Every public answer
    # turn lasts longer, giving STT/TTS a hidden processing margin.
    question_seconds: int = 25
    answer_processing_seconds: int = 12
    answer_turn_seconds: int = 38
    # Agents start their model work at once, in parallel with the human capture
    # window. Timing tells are already hidden by the lock and the shuffled
    # reveal; delaying them would only push every round to the ceiling above and
    # squeeze chat + TTS into the leftover seconds.
    agent_waits_for_input_window: bool = False
    vote_seconds: int = 20
    # The elimination overlay covers the whole arena on the client. The engine
    # leaves `elimination_pause_seconds` before moving on, which is what lets
    # `game_over` land while the arena is still on screen. When the game
    # continues instead, the next question must wait for the overlay to clear:
    # opening it underneath would put the answer panel on screen over a
    # question nobody can read yet. Keep the reveal in sync with the overlay
    # lifetime in `web/app.js` (`showElimination`).
    elimination_pause_seconds: float = 1.5
    elimination_reveal_seconds: float = 4.4
    # Accept a deadline auto-submit that was already in flight over the socket.
    input_grace_seconds: float = 1.25
    # Fixed reveal cadence used to hide response-time tells.
    reveal_gap_seconds: float = 0.15
    # Text-only and failed-TTS reveals remain readable and role-neutral.
    answer_reveal_min_seconds: float = 2.6
    # Never let one stalled browser hold every later answer reveal.
    playback_timeout_seconds: int = 10
    # Uniform client playback speed preserves voice anonymity across seats.
    tts_playback_rate: float = 1.1
    # A failed clip only costs its own seat its voice, but a text-only seat in a
    # voiced round still stands out. Agents no longer wait for the input window,
    # so there is budget for one more attempt.
    tts_retry_attempts: int = 2

    # --- TTS voice pool used only as a mock fallback ---------------------
    # Outside mock mode, preset Voxtral voices are loaded dynamically.
    voice_pool: list[str] = [
        "Aria", "Colette", "Emile", "Nadia", "Oskar", "Yara", "Timo", "Lise",
    ]
    # Preferred preset voice language code prefix.
    voice_lang_prefix: str = "en"

    @property
    def mock_mode(self) -> bool:
        """Return True when no API key is set and the game should use mock mode."""
        return not self.mistral_api_key.strip()

    @property
    def turnstile_enabled(self) -> bool:
        """Enforce Turnstile when a production secret has been configured."""
        return bool(self.turnstile_secret_key.strip())

    @property
    def turnstile_required(self) -> bool:
        """Fail closed on Cloud Run while keeping secret-free localhost usable."""
        return self.turnstile_enabled or bool(self.cloud_run_service.strip())

    @property
    def agent_models(self) -> list[str]:
        """Return the four model tiers assigned to agents in seat order."""
        return [
            self.chat_model_large,
            self.chat_model_medium,
            self.chat_model_small,
            self.chat_model_ministral,
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
