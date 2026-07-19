# Uncommitted Report — Story 7.2 (Log diário de saúde) — 2026-07-19

Gerado no fechamento da dev-story (o comando `/bmad-uncommitted-report` não existe
neste repo → réplica manual do passo de auditoria). Um único commit por story.

## Incluído no commit da Story 7.2

**Backend (novos):**
- `backend/health/migrations/0002_health_log.py`
- `backend/health/urls_logs.py`

**Backend (modificados):**
- `backend/health/models.py`, `services.py`, `serializers.py`, `views.py`, `admin.py`
- `backend/config/urls.py`
- `backend/health/tests/{factories,test_models,test_services,test_views,test_serializers}.py`
- `schema.yaml` (regenerado, aditivo)

**Frontend (novos):**
- `frontend/src/features/health/components/HealthMetricRow.tsx`
- `frontend/src/features/health/components/HealthMetricsLog.tsx`
- `frontend/src/features/health/components/HealthMetricsLog.test.tsx`
- `frontend/src/pages/health/HealthMetricsPage.tsx`

**Frontend (modificados):**
- `frontend/src/api/keys.ts`, `types.gen.ts` (regenerado)
- `frontend/src/app/router.tsx`
- `frontend/src/features/health/{types,api,index}.ts`, `api.test.tsx`

**Artefatos de processo:**
- `_bmad-output/implementation-artifacts/7-2-log-diario-de-saude.md` (Status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (7-2 → review)
- `_bmad-output/implementation-artifacts/7-2-uncommitted-report-20260719.md` (este relatório)

## EXCLUÍDO do commit (trabalho paralelo de planejamento/UX do Hugo — não varrer)

- `_bmad-output/planning-artifacts/architecture.md`, `epics.md`
- `_bmad-output/planning-artifacts/ux-designs/**` (ux-hmmb-bujo-2026-06-15/*, LEGACY.md, imports/, reconcile-*, ux-hmmb-bujo-2026-07-17/)
- `_bmad-output/specs/**`
- `_bmad-output/story-automator/**` (learnings, orchestration-*, preflight-*, policy-snapshots, init-log, agents, complexity)
- `docs/futureIdeas.md`

## Verificação (gates de CI)

- Backend: `ruff` ✓ · `lint-imports` KEPT ✓ · `spectacular` + diff `types.gen.ts` puramente aditivo (0 remoções) ✓
- Backend testes (Neon full-suite trava → lotes `--reuse-db`, partição dos 6 apps):
  Lote A `health accounts core` = **181 passed** · Lote B `habits bujo braindump` = **470 passed** → união = **651 passed**.
- Frontend: `tsc` ✓ · ESLint ✓ · `vite build` ✓ · `vitest run` = **689 passed** (62 arquivos).
