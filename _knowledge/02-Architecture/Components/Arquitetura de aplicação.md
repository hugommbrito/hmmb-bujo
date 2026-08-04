---
title: Arquitetura de aplicação
aliases:
  - Backend e frontend
  - Monólito por domínio
type: component
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
source_updated: 2026-07-29
tags:
  - kb/architecture
---

# Arquitetura de aplicação

O backend é um monólito modular Django/DRF/PostgreSQL; o frontend é uma SPA React/TypeScript com Material UI e TanStack Query.

## Como funciona

- Apps Django representam bounded contexts.
- Views e serializers traduzem HTTP; serviços possuem regras e transações.
- `core/` concentra tenant, calendário, erros e paginação.
- No frontend, `features/<domínio>/` expõe apenas seu barrel público.
- `pages/` e `app/` podem compor múltiplas features.
- Dados remotos ficam no cache do TanStack Query; estado efêmero fica local.

## Regras e invariantes

- Import-linter mantém o grafo acíclico.
- Mutações invalidam query keys; não atualizam contadores manualmente.
- `userId` participa das query keys e logout limpa o cache.
- O novo shell coexiste por rota com o legado durante a migração.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — paradigma, stack, AD-13, AD-17 e AD-29.
