# Uncommitted Report — Story 9.2 (Histórico navegável por data e mês — Diário de Gratidão)

**Data:** 2026-07-20
**Contexto:** commit escopado da story 9.2 pelo orquestrador (story-automator). `commit-story` faz `git add -A` e commit sem `--no-gpg-sign`; commit montado manualmente com `git add` escopado e `--no-gpg-sign`, excluindo planejamento do Hugo e artefatos de orquestração. Push deferido para sessão interativa (1Password SSH indisponível na automação). **Sem migration** (9.2 é read-only, confirmado por `makemigrations --check`).

## Incluído no commit `feat(story-9.2)`

### Backend (gratitude — camada de leitura, aditivo; SEM migration)
- `backend/gratitude/views.py`, `serializers.py`, `services.py`, `urls.py` — novo endpoint `months/` (GratitudeMonth: contagem/agregado por mês para o navegador), reuso do read-model diário da 9.1
- `backend/gratitude/tests/{test_views,test_serializers,test_services}.py` — testes do caminho de mês

### Frontend
- `frontend/src/features/gratitude/components/GratitudeHistorySurface.tsx` (novo) + teste — superfície read-only: navegador de mês (anterior/próximo + seletor `type="month"`, capado no mês corrente) e modo "por data" (reusa `useGratitudeDayQuery` da 9.1); helpers tz-safe de mês/dia (split de string, nunca `new Date(iso)`)
- `frontend/src/pages/gratitude/GratitudeHistoryPage.tsx` (novo) + teste
- `frontend/src/pages/gratitude/GratitudeTabs.tsx` (novo) + teste — abas Diário/Histórico
- `frontend/src/pages/gratitude/GratitudePage.tsx` (M — integra as abas) + `GratitudePage.test.tsx` (novo — lacuna de teste de página preenchida no automate)
- `frontend/src/features/gratitude/` — `api.ts` (query de mês read-only), `types.ts`, `index.ts`, `api.test.tsx` (M)
- `frontend/src/app/router.tsx` (M — rota/abas de histórico)
- `frontend/src/api/keys.ts` (M — `gratitude.month`), `types.gen.ts` (M — tipo GratitudeMonth, aditivo)
- `frontend/e2e/gratitude-history.spec.ts` (novo) — histórico ponta-a-ponta (AC1–4/6)

### Contrato
- `schema.yaml` — OpenAPI (aditivo: novo GratitudeMonth + path `months/`; 0 remoções, sem novo enum)

### Artefatos da story
- `9-2-historico-navegavel-por-data-e-mes.md` (Status: done, Senior Developer Review (AI) anexada, Change Log/File List)
- `tests/test-summary.md` (seção 9.2, append)
- `sprint-status.yaml` (9.2 → done; epic-9 continua in-progress até a retrospectiva)
- `9-2-uncommitted-report-20260720.md` — este relatório

## Excluído do commit
- `_bmad-output/planning-artifacts/**`, `docs/futureIdeas.md`, `.gitignore` — planejamento do Hugo
- `_bmad-output/story-automator/**` — orquestração
- `_bmad-output/implementation-artifacts/epic-7-retro-*`, `epic-8-retro-*`, `_bmad-output/specs/` — não é 9.2

## Verificação (observada)
- Backend: `pytest gratitude/` → 40 passed; guardrail + isolation → 30 passed; suíte completa (sem scoping) → 871 passed (dev-story); ruff/import-linter verdes
- Frontend: typecheck (tsc) e lint (eslint) limpos · `npm run test:run` → 822 passed (79 arquivos)
- E2E: `gratitude-history.spec.ts` na branch Neon e2e → verde; regressão 9.1 (`gratitude.spec.ts`) verde (6 passed no total no dev-story)
- Migration: nenhuma (`makemigrations --check` → No changes detected) — 9.2 é leitura pura
- Code-review (adversarial, auto-fix): 1 MEDIUM corrigido, **0 CRITICAL/HIGH**, 0 action items → aprovado, sprint-status sincronizado para done
- Cobertura: 7/7 ACs (estados vazio/erro exaustivos no nível unitário; E2E cobre AC1–4/6, decisão consciente de não inflar a suíte E2E)

## Pendências não-bloqueantes (fora do commit)
- Decisão de UX (D3): "por data" ficou como modo alternável (seletor "Ir para data" na visão de mês → visão de dia; "Voltar ao mês" retorna). Alternativa "clicar num dia do grupo do mês" = troca de ~1 componente — confirmação de PO opcional, baixo risco
- Épico 9 completo após esta story → dispara retrospectiva (#YOLO, não-bloqueante)
