#!/usr/bin/env python3
"""Select BMad artifacts for an Obsidian KB bootstrap or incremental update."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable

ELIGIBLE_SUFFIXES = {
    ".md",
    ".markdown",
    ".yaml",
    ".yml",
    ".json",
    ".html",
    ".canvas",
    ".base",
}
NOISE_NAMES = {".DS_Store"}
NOISE_PARTS = {".obsidian", "node_modules"}
OPERATIONAL_PARTS = {"story-automator"}
STATE_RELATIVE = Path(".obsidiankb/state.json")


class GitError(RuntimeError):
    pass


@dataclass(frozen=True)
class Change:
    status: str
    path: str
    old_path: str | None = None


def run_git(repo: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode:
        raise GitError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout


def is_ancestor(repo: Path, ancestor: str, descendant: str) -> bool:
    result = subprocess.run(
        ["git", "merge-base", "--is-ancestor", ancestor, descendant],
        cwd=repo,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


def repository_root(start: Path) -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=start,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode:
        raise GitError("Run this script inside a Git repository.")
    return Path(result.stdout.strip()).resolve()


def repo_relative(repo: Path, value: str) -> str:
    path = Path(value)
    absolute = path.resolve() if path.is_absolute() else (repo / path).resolve()
    try:
        return absolute.relative_to(repo).as_posix()
    except ValueError as exc:
        raise ValueError(f"Path must be inside repository: {value}") from exc


def resolve_vault(repo: Path, value: str) -> tuple[Path, str]:
    path = Path(value)
    absolute = path.resolve() if path.is_absolute() else (repo / path).resolve()
    try:
        display = absolute.relative_to(repo).as_posix()
    except ValueError:
        display = absolute.as_posix()
    return absolute, display


def eligible(path: str, source: str, include_operational: bool) -> bool:
    pure = PurePosixPath(path)
    source_pure = PurePosixPath(source)
    try:
        relative = pure.relative_to(source_pure)
    except ValueError:
        return False
    if not relative.parts or relative.name in NOISE_NAMES:
        return False
    if any(part in NOISE_PARTS for part in relative.parts):
        return False
    if not include_operational and any(part in OPERATIONAL_PARTS for part in relative.parts):
        return False
    if ".rejected-" in relative.name:
        return False
    return relative.suffix.lower() in ELIGIBLE_SUFFIXES


def parse_name_status_z(raw: bytes) -> list[Change]:
    tokens = raw.decode("utf-8", errors="surrogateescape").split("\0")
    changes: list[Change] = []
    index = 0
    while index < len(tokens) and tokens[index]:
        status = tokens[index]
        index += 1
        code = status[0]
        if code in {"R", "C"}:
            if index + 1 >= len(tokens):
                raise GitError("Malformed Git rename/copy output.")
            old_path, path = tokens[index], tokens[index + 1]
            index += 2
            changes.append(Change(code, path, old_path))
        else:
            if index >= len(tokens):
                raise GitError("Malformed Git name-status output.")
            changes.append(Change(code, tokens[index]))
            index += 1
    return changes


def git_changes(repo: Path, args: list[str]) -> list[Change]:
    result = subprocess.run(
        ["git", *args, "--name-status", "-z"],
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode:
        raise GitError(result.stderr.decode().strip() or "Git diff failed.")
    return parse_name_status_z(result.stdout)


def merge_changes(changes: Iterable[Change]) -> list[Change]:
    merged: dict[tuple[str, str | None], Change] = {}
    priority = {"D": 5, "R": 4, "A": 3, "M": 2, "T": 1, "U": 1, "C": 1}
    for change in changes:
        key = (change.path, change.old_path)
        previous = merged.get(key)
        if not previous or priority.get(change.status, 0) >= priority.get(previous.status, 0):
            merged[key] = change
    return sorted(merged.values(), key=lambda item: (item.path, item.old_path or ""))


def working_tree_changes(repo: Path) -> list[Change]:
    staged = git_changes(repo, ["diff", "--cached", "--find-renames"])
    unstaged = git_changes(repo, ["diff", "--find-renames"])
    untracked = run_git(repo, "ls-files", "--others", "--exclude-standard", "-z")
    additions = [Change("A", path) for path in untracked.split("\0") if path]
    return merge_changes([*staged, *unstaged, *additions])


def commit_changes(repo: Path, base: str, head: str = "HEAD") -> list[Change]:
    return git_changes(repo, ["diff", "--find-renames", base, head])


def empty_tree(repo: Path) -> str:
    return run_git(repo, "hash-object", "-t", "tree", "/dev/null").strip()


def head_parent_or_empty(repo: Path) -> str:
    parent = run_git(repo, "rev-parse", "HEAD^", check=False).strip()
    return parent if parent else empty_tree(repo)


def load_state(vault_path: Path) -> dict | None:
    state_path = vault_path / STATE_RELATIVE
    if not state_path.exists():
        return None
    try:
        value = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid state file: {state_path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"State file must contain a JSON object: {state_path}")
    return value


def bootstrap_changes(repo: Path, source: str, include_operational: bool) -> list[Change]:
    base = repo / source
    if not base.is_dir():
        raise ValueError(f"Source directory does not exist: {base}")
    return [
        Change("A", path.relative_to(repo).as_posix())
        for path in sorted(base.rglob("*"))
        if path.is_file()
        and eligible(path.relative_to(repo).as_posix(), source, include_operational)
    ]


def fingerprint(repo: Path, changes: Iterable[Change]) -> str:
    digest = hashlib.sha256()
    for change in changes:
        digest.update(f"{change.status}\0{change.old_path or ''}\0{change.path}\0".encode())
        path = repo / change.path
        if change.status != "D" and path.is_file():
            digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="_bmad-output")
    parser.add_argument("--vault", default="_knowledge")
    parser.add_argument(
        "--mode",
        choices=["auto", "bootstrap", "working-tree", "since-state", "last-commit"],
        default="auto",
    )
    parser.add_argument("--include-operational", action="store_true")
    parser.add_argument("--output", help="Write JSON manifest to this path instead of stdout.")
    args = parser.parse_args()

    try:
        repo = repository_root(Path.cwd())
        source = repo_relative(repo, args.source)
        vault_path, vault = resolve_vault(repo, args.vault)
        state = load_state(vault_path)
        vault_initialized = (vault_path / "Home.md").is_file() and state is not None
        head = run_git(repo, "rev-parse", "HEAD").strip()
        requested_mode = args.mode
        selected_mode = requested_mode
        baseline: str | None = None

        working = [
            change
            for change in working_tree_changes(repo)
            if eligible(change.path, source, args.include_operational)
            or (
                change.old_path
                and eligible(change.old_path, source, args.include_operational)
            )
        ]

        if requested_mode == "auto":
            if state is None:
                selected_mode = "bootstrap"
            elif working:
                selected_mode = "working-tree"
            else:
                recorded = state.get("processed_commit")
                if recorded == head:
                    selected_mode = "no-op"
                elif recorded and is_ancestor(repo, recorded, head):
                    selected_mode = "since-state"
                    baseline = recorded
                else:
                    selected_mode = "bootstrap"

        if selected_mode == "bootstrap":
            changes = bootstrap_changes(repo, source, args.include_operational)
        elif selected_mode == "working-tree":
            changes = working
        elif selected_mode == "since-state":
            baseline = baseline or (state or {}).get("processed_commit")
            if not baseline:
                raise ValueError("since-state requires a valid processed_commit in vault state.")
            changes = commit_changes(repo, baseline, head)
        elif selected_mode == "last-commit":
            baseline = head_parent_or_empty(repo)
            changes = commit_changes(repo, baseline, head)
        elif selected_mode == "no-op":
            changes = []
        else:
            raise ValueError(f"Unsupported selected mode: {selected_mode}")

        filtered = merge_changes(
            change
            for change in changes
            if eligible(change.path, source, args.include_operational)
            or (
                change.old_path
                and eligible(change.old_path, source, args.include_operational)
            )
        )
        manifest = {
            "schema_version": 1,
            "repository_root": repo.as_posix(),
            "source": source,
            "vault": vault,
            "requested_mode": requested_mode,
            "selected_mode": selected_mode,
            "baseline_commit": baseline,
            "head_commit": head,
            "dirty_snapshot": fingerprint(repo, working) if working else None,
            "include_operational": args.include_operational,
            "vault_initialized": vault_initialized,
            "requires_bootstrap": selected_mode
            in {"working-tree", "since-state", "last-commit"}
            and not vault_initialized,
            "change_count": len(filtered),
            "changes": [
                {"status": item.status, "path": item.path, "old_path": item.old_path}
                for item in filtered
            ],
        }
        payload = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(payload, encoding="utf-8")
        else:
            sys.stdout.write(payload)
        return 0
    except (GitError, OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
