# Uncommitted Report — Story 8.3 (Histórico de adesão e dose perdida)

**Data:** 2026-07-20
**Contexto:** commit escopado da story 8.3 pelo orquestrador (story-automator). `commit-story` faz `git add -A`; commit montado manualmente com `git add` escopado, excluindo planejamento do Hugo e artefatos de orquestração.

## Incluído no commit `feat(story-8.3)`

### Backend (medications — camada de leitura, aditivo; SEM migration, SEM mudança de core)
- `backend/medications/services.py`, `serializers.py`, `views.py` — endpoints de histórico/adesão (leitura), derivação de dose perdida, fix de concorrência
- `backend/medications/tests/{test_services,test_views}.py` — testes

### Frontend
- `frontend/src/features/medications/` — `api.ts`, `dayModel.ts`, `index.ts`, componentes `MedicationBlock`, `MedicationDaySurface`, **`AdHocList.tsx` (novo — extração compartilhada do code-review, antes forkado)**, `MedicationHistorySurface.tsx` (+ testes)
- `frontend/src/pages/health/` — `MedicationHistoryPage.tsx`, `MedicationsTabs.tsx`, `MedicationsPage.tsx` (+ testes)
- `frontend/src/app/router.tsx` — rota de histórico
- `frontend/src/api/types.gen.ts` — tipos regenerados (aditivo: PatchedEntryConfirm.dose?)
- `frontend/e2e/medications-history.spec.ts` (novo) + `frontend/e2e/seedMedications.ts`

### Contrato
- `schema.yaml` — OpenAPI (aditivo, 0 remoções, sem novo enum)

### Artefatos da story
- `8-3-historico-de-adesao-e-dose-perdida.md` (Status: done, Senior Developer Review anexada)
- `tests/test-summary.md` (seção 8.3, append)
- `sprint-status.yaml` (8.3 → done; epic-8 todas done)
- `8-3-uncommitted-report-20260720.md` — este relatório

## Excluído do commit
- `_bmad-output/planning-artifacts/**`, `docs/futureIdeas.md` — planejamento do Hugo
- `_bmad-output/story-automator/**` — orquestração
- `_bmad-output/implementation-artifacts/epic-7-retro-*`, `_bmad-output/specs/` — não é 8.3

## Verificação (observada)
- Frontend: tsc/ESLint limpos · vitest suíte completa 779 passed · vite build OK · component/page tests (medications+health+app) 122 passed (3 testes de nav-shell verdes)
- Backend medications suite: verde (dev-story)
- E2E: medications-history.spec.ts (branch Neon e2e)
- Code-review: 0 CRITICAL/HIGH; 1 LOW corrigido (AdHocList extraído/compartilhado); 1 MEDIUM (verificação cross-app) resolvido como não-aplicável — 8.3 confinada a medications (read layer) + frontend, contrato aditivo, sem mudança de código compartilhado ⇒ apps não-tocados não podem regredir
- Batch cross-app (habits/bujo/braindump/health) deferido: lentidão de I/O na branch Neon; risco de regressão nulo (nenhum código compartilhado alterado por 8.3)

## Pendências não-bloqueantes (fora do commit)
- Follow-up aditivo deferido (decisão de PO #1): grid/calendário multi-dia de adesão (latitude AD-14)
- Comentário obsoleto `architecture.md:1106` (AD-01 supersedido) — fix de doc-fonte, fora do commit
