"""Test settings — local Postgres (docker-compose), never touches Neon.

Points the pytest suite at a local Postgres (see the repo-root ``docker-compose.yml``)
instead of a remote Neon branch. This eliminates per-statement network round-trips
and Neon cold starts (the test suite goes from minutes to seconds) and stops the
create/drop churn of the pytest test database from polluting the shared Neon dev
branch (the branch where the app is actually used).

Self-contained by design: safe local defaults are provided via ``setdefault`` so
``uv run pytest`` works after ``docker compose up -d db`` with no ``.env`` file.
``setdefault`` never overwrites, so any real environment variable still wins —
CI keeps working unchanged because its workflow ``env:`` block sets
``DATABASE_URL`` / ``SECRET_KEY`` (and pins ``DJANGO_SETTINGS_MODULE``).

To point the suite elsewhere for one run, just export ``DATABASE_URL`` first.
"""

import os

# Local docker-compose Postgres — mirrors CI's ephemeral postgres:16 (no SSL).
os.environ.setdefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/hmmb_test")
os.environ.setdefault("SECRET_KEY", "test-only-secret-not-for-production")
os.environ.setdefault("ALLOWED_HOSTS", "localhost,127.0.0.1")

from .base import *  # noqa: E402, F403

DEBUG = True
