---
title: Journalling
aliases:
  - Diário
  - Gratidão
  - Journal
type: capability
status: proposed
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/product
---

# Journalling

Journalling é a evolução aprovada do Diário de Gratidão: campos definidos pelo usuário, cada um preso a uma única cadência temporal e com participação em IA desativada por padrão.

## Como funcionará

- Campos podem ser diários, semanais ou livres por instante.
- Cada entrada usa exatamente uma âncora compatível: `entry_date`, `week_start` ou `occurred_at`.
- Mudanças seguras de campo são permitidas; remover ou mudar cadência desativa a definição e preserva histórico.
- `ai_context` é opt-in por campo.
- Gratidão nasce como campo seed e suas entradas existentes serão migradas.

## Estado de entrega

Gratidão com texto livre e histórico está entregue. O domínio Journalling, a migração e a aposentadoria da superfície antiga estão no Épico 16 e ainda não foram implementados.

## Relações

- Participa de [[Registros pessoais e saúde]].
- Sua fronteira de IA segue [[Automação e IA segura]].
- É uma [[Collections|collection codificada]] com campos definidos pelo usuário.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-20.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — FR-10 e UJ-6.
