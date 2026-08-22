#!/usr/bin/env python3
"""Validate core structure, provenance, and wikilinks in a generated vault."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---(?:\n|\Z)", re.DOTALL)
WIKILINK = re.compile(r"(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")
REQUIRED_KEYS = {"title", "type", "status", "source_files"}


def note_key(path: Path, vault: Path) -> set[str]:
    relative = path.relative_to(vault).with_suffix("").as_posix()
    return {relative.casefold(), path.stem.casefold()}


def frontmatter_keys(text: str) -> set[str]:
    match = FRONTMATTER.search(text)
    if not match:
        return set()
    keys = set()
    for line in match.group(1).splitlines():
        if line and not line[0].isspace() and ":" in line:
            keys.add(line.split(":", 1)[0].strip())
    return keys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", default="_knowledge")
    args = parser.parse_args()
    vault = Path(args.vault).resolve()
    errors: list[str] = []
    warnings: list[str] = []

    if not vault.is_dir():
        print(f"ERROR vault does not exist: {vault}")
        return 1
    if not (vault / "Home.md").is_file():
        errors.append("missing Home.md")

    notes = sorted(
        path
        for path in vault.rglob("*.md")
        if ".obsidiankb" not in path.relative_to(vault).parts
    )
    index: set[str] = set()
    for note in notes:
        index.update(note_key(note, vault))

    for note in notes:
        relative = note.relative_to(vault).as_posix()
        text = note.read_text(encoding="utf-8")
        keys = frontmatter_keys(text)
        missing = REQUIRED_KEYS - keys
        if missing:
            errors.append(f"{relative}: missing frontmatter keys {', '.join(sorted(missing))}")
        if "## Fontes" not in text and "type: moc" not in text:
            warnings.append(f"{relative}: canonical note has no '## Fontes' section")
        for target in WIKILINK.findall(text):
            normalized = target.strip().replace("\\", "/").removesuffix(".md").casefold()
            if normalized not in index:
                warnings.append(f"{relative}: unresolved wikilink [[{target.strip()}]]")

    for message in errors:
        print(f"ERROR {message}")
    for message in warnings:
        print(f"WARN  {message}")
    print(f"Checked {len(notes)} notes: {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
