---
title: Arquitetura
aliases:
  - Architecture
  - Architecture Spine
type: moc
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
source_updated: 2026-07-29
tags:
  - kb/architecture
  - kb/moc
---

# Arquitetura

A arquitetura é um monólito Django por domínio com camada de serviço obrigatória e uma SPA React organizada por features isoladas.

## Comece aqui

- [[Arquitetura de aplicação]] — limites de módulos, estado e contratos.
- [[Isolamento multi-tenant]] — proteção fail-closed entre usuários.
- [[Autoridade temporal]] — fonte única para datas e períodos.
- [[Tarefas]] — principal agregado de domínio.

## Invariantes transversais

- `core/` oferece infraestrutura e nunca importa apps de domínio.
- Regras e transações vivem em `<app>/services.py`.
- Features frontend não se importam entre si; composição ocorre em `pages/` e `app/`.
- Estado do servidor pertence ao TanStack Query.
- O contrato OpenAPI e os tipos gerados conectam backend e frontend.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — contrato arquitetural vigente.
