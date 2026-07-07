---
name: bmad-uncommitted-report
description: Analyze every uncommitted Git change in the current repository and save a structured Markdown report under the project's implementation artifacts. Use when the user asks to explain, document, audit, summarize, or save a file-by-file report of uncommitted changes, including new, modified, deleted, renamed, or generated files.
---

# Uncommitted Change Report

## Output Location

Save reports in:

```text
_bmad-output/implementation-artifacts/uncommitted-reports/
```

Create the directory if it does not exist. Name files with a stable, descriptive slug and date, for example:

```text
YYYY-MM-DD-uncommitted-files-report.md
```

If the user names a story or scope, include it in the filename:

```text
YYYY-MM-DD-story-3-2-uncommitted-files-report.md
```

## Workflow

1. Inventory uncommitted files with `git status --short`.
2. Inspect tracked changes with `git diff --stat` and focused `git diff -- <paths>`.
3. Inspect untracked files by reading them directly with `nl -ba` or `sed -n`.
4. If there are many files, group reads in parallel and avoid noisy command chaining.
5. Infer the functional flow before writing: artifacts/docs, config, models/schema, backend services/API, generated contracts, frontend data layer, UI, tests.
6. Write a Markdown report organized in logical runtime order, not alphabetic order.
7. Save the report in the output location.
8. In the final response, provide the saved path and mention that no source behavior was changed unless edits were explicitly requested.

## Required Report Structure

Use this structure unless the user requests a different format:

```markdown
# Explicacao dos arquivos nao commitados - <escopo>

## Visao geral

Resumo curto do que o conjunto de mudancas implementa.

## Ordem logica de funcionamento

1. ...
2. ...

## 1. <Camada ou etapa>

### `<path/to/file>`

**Funcao geral do arquivo**

...

**Funcao geral da alteracao**

...

**Blocos principais**

- Linhas X-Y: ...
- Linhas A-B: ...

**Funcoes, classes e importacoes especificas**

- `symbol`: ...

**Comportamento de libs usadas**

- `libraryFunction`: espera ..., entrega ...
```

## Analysis Requirements

For each uncommitted file, cover:

- General purpose of the file.
- General purpose of the change.
- What each meaningful block does, identified with line numbers when practical.
- What specific functions, classes, imports, hooks, serializers, models, routes, or generated types do.
- How third-party library functions/classes behave: what they expect, what they return, and why they are used.
- Whether the file is source, test, generated contract, config, migration, or implementation artifact.
- How artifacts created in one file are consumed by later files.

## Ordering Heuristics

Prefer this order when applicable:

1. Planning/story/status artifacts.
2. Low-level shared primitives and configuration.
3. Data model and migrations.
4. Admin/back-office helpers.
5. Serializers/schemas/contracts.
6. Backend views, URLs, services, middleware, auth.
7. Generated OpenAPI and frontend generated types.
8. Frontend shared keys/types/API hooks.
9. Frontend theme/design tokens.
10. Frontend components/pages/routes.
11. Tests, ordered by the layer they validate.

If the repository has a different architecture, adapt the categories while preserving producer-before-consumer order.

## Command Guidance

Use these commands as appropriate:

```bash
git status --short
git diff --stat
git diff -- <path>
git diff --name-only
git ls-files --others --exclude-standard
nl -ba <path>
sed -n 'START,ENDp' <path>
rg "<symbol-or-endpoint>"
```

When a file is generated, still explain its role, but do not manually inspect every generated line unless the user asks. Summarize generated sections by schema/path/type groups.

## Output Quality Rules

- Be explicit and concrete; this report is for future maintainers.
- Prefer Portuguese when the user writes in Portuguese.
- Keep code excerpts short; explain behavior rather than dumping files.
- Do not modify source code while producing the report.
- Do not revert unrelated user changes.
- If tests are not run, say so only in the final response if relevant; the report itself can focus on explanation unless validation was requested.
- If the repository has uncommitted changes created by this skill itself, include or exclude the just-created report according to user intent. Normally, do not re-analyze the report file as part of the report unless asked.
