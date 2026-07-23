# Uncommitted Report — Rito [ARCH] update (CC 2026-07-22)

**Data:** 2026-07-22
**Contexto:** commit escopado dos artefatos de planejamento do rito **[ARCH]** `bmad-create-architecture` (update), executado em sessão interativa na branch `dev`. Commit montado com `git add` escopado (nunca `git add -A`) e assinado normalmente (1Password disponível em sessão interativa). A working tree contém também uma feature de frontend **não relacionada** ao rito (distinção visual dev × prod), deliberadamente excluída.

## Incluído no commit `docs(arch)`

### Artefatos do rito [ARCH]
- `_bmad-output/planning-artifacts/architecture.md` (M) — **Seção 3b nova** (AD-17 a AD-27): registro das 12 decisões roteadas pelo §9 do `sprint-change-proposal-2026-07-22.md` + adicionais (#15/#23 herança de status e flag `waiting_on`; componente compartilhado Hoje/Dashboard do D4), com tabela de rastreabilidade §9→AD. Deltas: frontmatter (update 2026-07-22, inputDocuments), Stack §2 (tabela de adições pós-MVP), nota inline na AD-03 (herança de status), Rastreador §4 (bloco do ciclo pós-MVP + pendências deliberadas), Ponto de Retomada §5, Estrutura §7.5 (novos apps/infra/envs), Validação §8.8 (adendo NFR-7/8/9 + escopo do [IR]). Revisões pós-registro com Hugo (mesma data): fotos do foodLog referenciadas por URL de bucket Cloudflare (AD-23), storage de fotos de PA em **Cloudflare R2** privado dedicado em vez de volume Railway (AD-27), herança de `waiting_on` confirmada (AD-18).
- `_bmad-output/planning-artifacts/plano-de-acao-ui-e-ideias-2026-07-21.md` (M) — FASE 2: checkboxes **[PRD]** (já executado no commit `b64319a`, estava desmarcado) e **[ARCH]** (concluído hoje) marcadas com sumário e links.
- `_bmad-output/implementation-artifacts/uncommitted-reports/2026-07-22-rito-arch-uncommitted-files-report.md` — este relatório.

## Excluído do commit (feature separada — distinção visual dev × prod, spec `in-review`)
- `_bmad-output/implementation-artifacts/spec-distincao-visual-dev-prod.md` (novo) — spec da feature (baseline `234e5e8` = HEAD atual)
- `frontend/.env.development`, `frontend/.env.production` (M) — `VITE_APP_ENV`
- `frontend/index.html`, `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/index.css` (M)
- `frontend/public/favicon-prod.svg`, `frontend/src/app/DevEnvBanner.tsx` + `.test.tsx`, `frontend/src/shared/env.ts` + `.test.ts` (novos)

Essa feature deve ganhar **commit próprio** quando aprovada (spec está `in-review`), com sua própria verificação — não pega carona no commit de planejamento.

## Verificação (observada)
- Rito de documentação pura: **nenhum código de produto tocado** pelo commit; sem migration, sem testes a rodar.
- Integridade estrutural do `architecture.md` verificada por grep de headers (AD-01–AD-27 sequenciais; §§ 1–8 + 3b/7.5/8.8 presentes).
- Rastreabilidade: as 12 linhas do checklist §9 do proposal mapeadas para ADs na tabela da Seção 3b.

## Pendências não-bloqueantes (fora do commit)
- **Push** para o remoto: fazer nesta sessão interativa junto/após o commit.
- Próximo rito: **[CE]** `bmad-create-epics-and-stories` em janela de contexto nova.
- Feature dev × prod: commitar separadamente após aprovação da spec/review.
