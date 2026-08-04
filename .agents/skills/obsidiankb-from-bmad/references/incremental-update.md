# Incremental update

## Scope selection

Use `collect_changes.py` as the authoritative scope detector.

| Condition in `auto` | Selected mode |
|---|---|
| Vault state missing | `bootstrap` |
| Staged, unstaged, untracked, deleted, or renamed source artifacts exist | `working-tree` |
| Recorded commit differs from `HEAD` and remains an ancestor | `since-state` |
| Recorded commit equals `HEAD` | `no-op` |
| Recorded commit cannot safely define a range | `bootstrap` |

Use `last-commit` only when explicitly requested. It can intentionally revisit already processed sources.

An incremental manifest with `requires_bootstrap: true` is not executable as-is. Without both
`Home.md` and `.obsidiankb/state.json`, there is no trustworthy knowledge baseline to reconcile.
Bootstrap the complete source when the user has already identified this as the first run;
otherwise request permission before broadening an explicit incremental scope.

## Impact analysis

For every changed source:

1. Classify it as canonical, supporting, historical, operational, or noise.
2. Locate existing notes whose `source_files` mention its old or new path.
3. Extract changed claims, decisions, statuses, constraints, relationships, and terminology.
4. Search the vault for concepts affected indirectly.
5. Decide whether to create, update, merge, move, archive, or leave notes unchanged.
6. Update MOCs and cross-links when navigation or semantics changed.

Do not equate “file changed” with “note must change.” Formatting-only or duplicated-source changes may produce no semantic update, but still record the run after validation.

## Working-tree semantics

The manifest combines:

- `HEAD` versus index for staged changes;
- index versus working tree for unstaged changes;
- untracked eligible files;
- rename and deletion metadata.

When the same path appears more than once, treat it as one impacted source and use the current working-tree content. A deleted file has no current content; reason from the existing note and Git history only when necessary.

## Commit semantics

For `since-state`, process the range `recorded_commit..HEAD`. This prevents missed knowledge when several commits land between runs.

For `last-commit`, compare `HEAD^` with `HEAD`. On the repository’s first commit, compare the empty tree with `HEAD`.

## Renames and deletions

- Replace old provenance paths after a rename.
- Preserve the canonical note filename unless the concept itself changed.
- On deletion, check whether another current artifact still supports the claim.
- Mark unsupported but historically useful knowledge `deprecated` or `superseded` and explain why.
- Archive source-oriented or obsolete notes only after reconnecting inbound links.
- Never infer that a feature was removed solely because a planning artifact was reorganized.

## Conflict resolution

Use this authority order unless the artifacts explicitly define another:

1. Newer accepted decision or current canonical specification.
2. Current implementation contract and verified behavior.
3. Current planning artifact.
4. Historical artifact.

When authority remains ambiguous, preserve both claims, mark the note `uncertain`, cite each source, and report the ambiguity.

## Idempotency

A repeat run over the same semantic inputs must not:

- create duplicate notes;
- reorder content without reason;
- rewrite dates merely because the run happened;
- add duplicate aliases, tags, sources, or links;
- change the state cursor before validation succeeds.

Use `source_updated` for the last semantic source change represented by the note, not the current wall-clock date.

## State

Store execution metadata at `_knowledge/.obsidiankb/state.json`. The state contains:

- schema version;
- source and vault paths;
- processed Git commit;
- dirty snapshot fingerprint when applicable;
- last mode;
- completion timestamp;
- changed source paths from the completed run.

Do not use state as proof that the vault is correct. It is only a baseline cursor.
