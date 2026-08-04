---
name: obsidiankb-from-bmad
description: Build and incrementally update a structured Obsidian knowledge base from BMad artifacts in `_bmad-output/`. Use when Codex needs to bootstrap a human- and AI-readable project vault, synthesize BMad planning or implementation knowledge, refresh the vault from uncommitted Git changes, update it from commits, reconcile renamed or deleted artifacts, or improve Obsidian navigation and traceability.
---

# Obsidian KB from BMad

Transform `_bmad-output/` into a curated knowledge system in `_knowledge/`. Synthesize; do not mirror the source tree.

## Defaults

- Resolve paths from the Git repository root.
- Use `_bmad-output/` as source and `_knowledge/` as vault unless the user overrides them.
- Write Markdown compatible with core Obsidian features. Do not require community plugins.
- Preserve source artifacts. Modify only the vault and this skill when explicitly requested.
- Treat generated notes as Portuguese unless the project artifacts clearly use another primary language.

## Execute

1. Read [references/knowledge-model.md](references/knowledge-model.md) before designing or changing vault notes.
2. Read [references/incremental-update.md](references/incremental-update.md) before selecting update scope or reconciling existing notes.
3. Run:

   ```bash
   python3 .agents/skills/obsidiankb-from-bmad/scripts/collect_changes.py \
     --source _bmad-output --vault _knowledge --mode auto \
     --output /tmp/obsidiankb-change-set.json
   ```

4. Inspect the manifest. Stop with a concise no-op report when it contains no changes.
   If `requires_bootstrap` is `true`, do not build a partial vault. Use a full bootstrap when
   the user's intent already establishes this as the first run; otherwise ask before expanding
   an explicitly incremental request.
5. For `bootstrap`, inventory the manifest by artifact type and read canonical/high-signal sources first. Build the knowledge model from concepts, not filenames.
6. For incremental modes, read every changed high-signal artifact and the existing notes connected to it through `source_files`. Follow semantic impact beyond direct one-to-one mappings.
7. Plan note creates, updates, moves, merges, and archives. Keep one canonical note per concept.
8. Write or update the vault using [assets/note-template.md](assets/note-template.md) and [assets/moc-template.md](assets/moc-template.md) as structural guides, not literal boilerplate.
9. Reconcile removed and renamed sources. Never delete durable knowledge merely because one source disappeared; remove unsupported claims, repoint provenance, merge duplicates, or move obsolete notes to `90-sources/Archive/`.
10. Run:

    ```bash
    python3 .agents/skills/obsidiankb-from-bmad/scripts/validate_vault.py \
      --vault _knowledge
    ```

11. Fix errors. Review warnings when they indicate broken navigation or provenance.
12. Record successful completion only after validation:

    ```bash
    python3 .agents/skills/obsidiankb-from-bmad/scripts/update_state.py \
      --vault _knowledge --manifest /tmp/obsidiankb-change-set.json
    ```

13. Report the selected mode, sources considered, notes created/updated/moved/archived, validation result, and unresolved ambiguities.

## Synthesis rules

- State the current truth first. Move history, alternatives, and evidence below it.
- Separate facts, decisions, constraints, open questions, and superseded knowledge.
- Use stable conceptual filenames and titles. Do not encode dates unless the note is inherently chronological.
- Use `[[wikilinks]]` for concepts and Markdown links only for external URLs or source-file paths.
- Add aliases for terminology that humans or agents may search.
- Keep notes small enough to answer one coherent question, but avoid atomizing tightly coupled context.
- Prefer updating an existing canonical note over creating a near-duplicate.
- Preserve disagreement explicitly when artifacts conflict. Do not silently pick a winner without authority.
- Cite source paths in frontmatter and under `## Fontes`.
- Never copy secrets, tokens, personal data, raw CI logs, orchestration chatter, or large source passages into the vault.
- Summarize generated HTML/JSON only when it adds unique product, UX, architectural, or delivery knowledge.

## Update modes

- `auto`: bootstrap without state; otherwise use uncommitted source changes, then commits since state, otherwise no-op.
- `bootstrap`: consider all eligible source artifacts and create/reconcile the entire vault.
- `working-tree`: consider staged, unstaged, untracked, deleted, and renamed source files.
- `since-state`: consider committed changes after the state recorded in the vault.
- `last-commit`: explicitly consider only the current `HEAD` commit.

Override `auto` only when the user asks for a specific baseline or when recovering from stale/corrupt state.
Incremental modes require an initialized vault containing `Home.md` and `.obsidiankb/state.json`.

## Safety

- Regard `.obsidiankb/state.json` as an execution cursor, not knowledge.
- Do not update state when synthesis or validation is incomplete.
- Do not overwrite hand-authored content blindly. Preserve sections outside managed markers and reconcile meaningful manual edits.
- Ask before destructive vault-wide restructuring when existing human-authored notes make ownership ambiguous.
