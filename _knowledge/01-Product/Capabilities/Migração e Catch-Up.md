---
title: Migração e Catch-Up
aliases:
  - Ritual de migração
  - Reconciliação
type: capability
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md
source_updated: 2026-07-29
tags:
  - kb/product
---

# Migração e Catch-Up

Migração é o ritual deliberado de dar destino a tarefas ainda abertas; Catch-Up aplica o mesmo fluxo a logs passados e órfãos detectados por consulta.

## Como funciona

O sistema encontra pendências em períodos anteriores, apresenta-as em ordem mês → semana → dia e pede uma decisão explícita: concluir, cancelar, migrar ou postergar conforme o contexto. A origem permanece como evidência e o destino recebe um sucessor ligado por linhagem.

## Regras e invariantes

- Não existe migração automática nem estado acumulador de “dias perdidos”.
- `migration_count` aumenta uma vez por decisão, não por dia transcorrido.
- Dias pulados não fabricam registros de hábitos ou medicamentos.
- Tarefas migradas ou postergadas são terminais no log de origem.
- O status é herdado na migração.

## Relações

- Opera sobre [[Tarefas]].
- Fecha ciclos de [[Ciclo BuJo]].
- Depende da [[Autoridade temporal]].

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-02, AD-03, AD-09 e AD-18.
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md` — ritual e padrões de interação.
