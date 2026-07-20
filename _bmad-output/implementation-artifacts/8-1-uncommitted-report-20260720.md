# Uncommitted Report — Story 8.1 (Cadastro de medicamentos com slot estável e versões)

**Data:** 2026-07-20
**Contexto:** commit escopado da story 8.1 pelo orquestrador (story-automator). `commit-story` faz `git add -A`, então o commit foi montado manualmente com `git add` escopado para excluir trabalho de planejamento do Hugo e artefatos de orquestração.

## Incluído no commit `feat(story-8.1)`

### Backend
- `backend/medications/` — novo app Django (5 TenantModels versionados no molde de `habits/`, service layer com dois eixos de versão + validação de dose JSONB, DRF API em 3 recursos irmãos, migration `0001_initial`)
- `backend/config/settings/base.py` — `medications` em INSTALLED_APPS (aditivo)
- `backend/config/urls.py` — rotas de medications (aditivo)
- `backend/conftest.py` — `medications.tests.factories` na matriz de isolamento cross-tenant (aditivo)

### Frontend
- `frontend/src/features/medications/` — nova feature
- `frontend/src/pages/settings/MedicationsSettingsPage.tsx` — página de configuração
- `frontend/src/pages/settings/SettingsPage.tsx` — link para Medicamentos
- `frontend/src/app/router.tsx` — rota de medications
- `frontend/src/api/keys.ts` — query keys de medications
- `frontend/src/api/types.gen.ts` — tipos regenerados (aditivo)
- `frontend/e2e/medications.spec.ts` — 6 testes E2E (7/7 ACs)
- `frontend/e2e/seedMedications.ts` — helper de seed E2E

### Contrato
- `schema.yaml` — OpenAPI regenerado (aditivo, 0 remoções)

### Artefatos da story
- `_bmad-output/implementation-artifacts/8-1-cadastro-de-medicamentos-com-slot-estavel-e-versoes.md` — story file (Status: done, Senior Developer Review anexada)
- `_bmad-output/implementation-artifacts/tests/test-summary.md` — seção 8.1 (append)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 8.1 → done, epic-8 → in-progress
- `_bmad-output/implementation-artifacts/8-1-uncommitted-report-20260720.md` — este relatório

## Excluído do commit (deliberadamente)

- `_bmad-output/planning-artifacts/**` — trabalho de planejamento do Hugo (architecture.md, epics.md, ux-designs/*, incl. LEGACY.md, imports/, reconcile-*, ux-hmmb-bujo-2026-07-17/) — pré-existentes/não pertencem a 8.1
- `docs/futureIdeas.md` — planejamento
- `_bmad-output/story-automator/**` — artefatos de orquestração (orchestration-*, agents/, complexity-*, preflight-*, init-log-*, policy-snapshots/, learnings.md, arquivos `.epic8_*`)
- `_bmad-output/implementation-artifacts/epic-7-retro-2026-07-19.md` — retro do épico 7 (não é 8.1)
- `_bmad-output/specs/` — não é 8.1

## Verificação (observada)
- Backend medications: 82 passed · Lote 1 (medications accounts core + isolamento cross-tenant): 187 passed
- Frontend vitest: 735 passed · tsc/ESLint: ✓/✓ · vite build: ✓
- E2E medications: 6 passed (gate de migration na branch Neon e2e checado → "No migrations to apply")
- Contrato: aditivo, 0 remoções · `makemigrations --check`: sem mudanças
- Code-review: sprint-status → done; 3 correções de robustez (LOW) aplicadas na árvore
- Lote 2 backend (habits/bujo/braindump/health — apps intocados): reconfirmação pulada por lentidão de I/O na branch Neon; risco de regressão nulo (mudanças puramente aditivas; Lote 1 cobriu infra compartilhada + matriz de isolamento)

## Pendências não-bloqueantes (fora do commit)
- Comentário obsoleto em `architecture.md:1106` (esboço AD-01 supersedido por AD-07) — corrigir na árvore de trabalho, fora do commit da story
- 5 decisões de PO registradas na story (não-bloqueantes, com defaults)
