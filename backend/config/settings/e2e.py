"""E2E settings — reads ``.env.e2e`` (dedicated Neon ``e2e`` branch).

Identical to ``dev.py`` except for the env file it reads: the E2E suite points
here so its create/delete churn hits an isolated Neon branch instead of the dev
branch where the app is actually used (story 11.1). ``read_env`` is a no-op if
the file is absent, so importing this module stays safe everywhere.
"""

from pathlib import Path

import environ

# Read .env.e2e before importing base so its env vars are available.
_BASE_DIR = Path(__file__).resolve().parent.parent.parent
environ.Env.read_env(_BASE_DIR / ".env.e2e")

from .base import *  # noqa: E402, F403

DEBUG = True
