---
title: Tarefas
aliases:
  - Task
  - Máquina de estados de tarefas
type: concept
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
source_updated: 2026-07-29
tags:
  - kb/product
  - kb/architecture
---

# Tarefas

Tarefa é o agregado central do BuJo: vive em exatamente um log, segue uma máquina de estados explícita e conserva sua história quando muda de período.

## Regras e invariantes

- Estados: `pending`, `started`, `completed`, `cancelled`, `migrated`, `postponed`.
- `migrated` e `postponed` são terminais na origem.
- Migração preserva a origem e cria um sucessor ligado.
- Uma tarefa pertence exatamente a um Daily, Weekly ou Monthly Log.
- Subtarefas usam a mesma estrutura; pai e filhos não propagam status automaticamente.
- Template recorrente gera snapshot; mudanças futuras no template não retroagem.
- Exclusão de template recorrente é lógica.

## Relações

- [[Migração e Catch-Up]] controla mudança de período.
- [[Autoridade temporal]] determina o log correto.
- [[Arquitetura de aplicação]] concentra transações no serviço de domínio.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-02, AD-03, AD-08 e AD-18.
