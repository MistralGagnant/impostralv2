"""Keep the suite independent of the developer's local .env.

A checked-out `.env` with a real MISTRAL_API_KEY made `get_client()` build a
live SDK client inside timing-sensitive tests, so the same suite passed on CI
and failed on a configured machine. Environment variables win over the `.env`
file in pydantic-settings, so clearing the key here pins every test to the
mock path regardless of what sits on disk.
"""
from __future__ import annotations

import os

os.environ["MISTRAL_API_KEY"] = ""

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()
