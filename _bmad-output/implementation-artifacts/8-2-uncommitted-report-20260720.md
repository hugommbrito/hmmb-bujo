# Uncommitted Report — Story 8.2 (Confirmação diária por bloco ou individual)

**Data:** 2026-07-20
**Contexto:** commit escopado da story 8.2 pelo orquestrador (story-automator). `commit-story` faz `git add -A`; o commit foi montado manualmente com `git add` escopado para excluir planejamento do Hugo e artefatos de orquestração.

## Incluído no commit `feat(story-8.2)`

### Backend
- `backend/medications/models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py` — camada realizada: `MedicationDayEntry` + enum `Source` (scheduled/ad_hoc), materialização idempotente, confirmação por linha/bloco/avulso
- `backend/medications/migrations/0002_day_entries.py` — migration nova (day entries)
- `backend/medications/tests/{factories,test_models,test_services,test_views}.py` — testes (matriz + 6 API novos do automate)
- `backend/core/calendar.py` — **aditivo**: novo helper `now()` (timestamp de auditoria timezone-aware; distinto de `today_for`); mora em core/calendar.py por causa do guardrail AST `test_no_bare_date_today_outside_calendar`
- `backend/core/tests/test_calendar.py` — teste do novo `now()`
- `backend/config/settings/base.py` — **aditivo**: override drf-spectacular `SourceEnum` (evita hash instável no diff de contrato)

### Frontend
- `frontend/src/features/medications/` — `api.ts`, `types.ts`, `index.ts`, `dayModel.ts`, componentes `MedicationBlock.tsx` + `MedicationDaySurface.tsx` (+ testes)
- `frontend/src/pages/health/MedicationsPage.tsx` (+ teste) — superfície diária em `/health/medications`
- `frontend/src/app/router.tsx` — rota
- `frontend/src/api/{keys.ts,types.gen.ts}` — query keys + tipos regenerados
- `frontend/e2e/medications-day.spec.ts` + `frontend/e2e/seedMedications.ts` — E2E (3 passed)

### Contrato
- `schema.yaml` — OpenAPI regenerado (aditivo)

### Artefatos da story
- `8-2-confirmacao-diaria-por-bloco-ou-individual.md` (Status: done, Senior Developer Review anexada)
- `tests/test-summary.md` (seção 8.2, append)
- `sprint-status.yaml` (8.2 → done)
- `8-2-uncommitted-report-20260720.md` — este relatório

## Excluído do commit
- `_bmad-output/planning-artifacts/**`, `docs/futureIdeas.md` — planejamento do Hugo
- `_bmad-output/story-automator/**` — artefatos de orquestração
- `_bmad-output/implementation-artifacts/epic-7-retro-*`, `_bmad-output/specs/` — não é 8.2

## Verificação (observada)
- Backend Lote A (medications accounts core + isolamento): 221 passed · `test_views.py`: 33 passed (+6) · ruff/lint-imports/makemigrations --check: limpos
- Frontend: tsc/ESLint limpos · vitest 754 passed · vite build OK
- E2E (branch Neon e2e, migration aplicada — "No migrations to apply" no automate): medications-day.spec.ts 3 passed
- Code-review: sprint-status → done, 0 issues, 0 action items
- Lote B backend (habits/bujo/braindump/health): reconfirmação pulada por lentidão de I/O na branch Neon. Risco de regressão negligível: única mudança compartilhada é o helper aditivo `core/calendar.now()` (nova função, não chamada por esses apps); o guardrail AST vive em core e passou no Lote A.

## Pendências não-bloqueantes (fora do commit)
- Comentário obsoleto em `architecture.md:1106` (AD-01 supersedido) — fix de doc-fonte, fora do commit da story
