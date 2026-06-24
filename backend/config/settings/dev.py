"""Development settings — reads ``.env.dev`` (Neon dev branch)."""

from pathlib import Path

import environ

# Read .env.dev before importing base so its env vars are available.
# read_env is a no-op if the file is absent (e.g. in CI, where vars come from
# the workflow's `env:` block), so this is safe everywhere.
_BASE_DIR = Path(__file__).resolve().parent.parent.parent
environ.Env.read_env(_BASE_DIR / ".env.dev")

from .base import *  # noqa: E402, F403

DEBUG = True
