#!/usr/bin/env python3
"""Record a successfully validated Obsidian KB synthesis run."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import tempfile
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", default="_knowledge")
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    required = {"schema_version", "source", "head_commit", "selected_mode", "changes"}
    missing = sorted(required - manifest.keys())
    if missing:
        raise SystemExit(f"Manifest lacks required keys: {', '.join(missing)}")

    vault = Path(args.vault).resolve()
    if not (vault / "Home.md").is_file():
        raise SystemExit(f"Refusing to record state without {vault / 'Home.md'}")

    state_dir = vault / ".obsidiankb"
    state_dir.mkdir(parents=True, exist_ok=True)
    state_path = state_dir / "state.json"
    state = {
        "schema_version": 1,
        "source": manifest["source"],
        "vault": manifest.get("vault", args.vault),
        "processed_commit": manifest["head_commit"],
        "dirty_snapshot": manifest.get("dirty_snapshot"),
        "last_mode": manifest["selected_mode"],
        "completed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "changed_sources": sorted(
            {
                path
                for change in manifest["changes"]
                for path in (change.get("old_path"), change.get("path"))
                if path
            }
        ),
    }
    fd, temporary_name = tempfile.mkstemp(prefix="state-", suffix=".json", dir=state_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary_name, state_path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)
    print(state_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
