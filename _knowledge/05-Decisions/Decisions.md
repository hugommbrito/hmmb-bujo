---
title: Decisões
aliases:
  - Architecture decisions
  - Decisões de produto
type: moc
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/decisions
  - kb/moc
---

# Decisões

Este mapa destaca decisões que restringem produto e implementação; detalhes normativos permanecem nas notas conceituais.

## Decisões implementadas

- [[Arquitetura de aplicação]] — monólito por domínio, camada de serviço e features isoladas.
- [[Isolamento multi-tenant]] — aplicação fail-closed, sem RLS.
- [[Autoridade temporal]] — uma única função de hoje e nenhuma automação temporal implícita.
- [[Tarefas]] — máquina de estados, linhagem e snapshots recorrentes.
- [[Migração e Catch-Up]] — reconciliação sempre deliberada.
- [[Collections]] — estratégia de schema por domínio e manifest canônico.
- [[Experience]] — coexistência do design system por rota.
- [[Snapshots e versionamento]] — configuração prospectiva e histórico corrigível sem retroação.
- [[Estado e composição do frontend]] — cache do servidor, manifest e componente compartilhado.

## Decisões aprovadas, ainda não entregues integralmente

- [[Automação e IA segura]] — tokens dedicados já existem; DSL analítica, BYO key, relatórios e consentimento ainda estão no roadmap.
- [[Collections futuras]] — Journalling, Custom Collections, Alimentação, Análises e Pressão Arterial possuem decisões arquiteturais aprovadas, mas entrega futura.

O status de uma decisão indica sua autoridade, não que toda capacidade ligada a ela esteja implementada. Cada nota temática separa explicitamente decisão, entrega e pendência.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-01 a AD-29.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — decisões e requisitos de produto.
