---
title: Hábitos
aliases:
  - Habit tracker
  - Hábitos ponderados
type: capability
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/product
---

# Hábitos

Hábitos são definições configuráveis com peso e histórico versionado; a completude diária mede importância relativa, não apenas quantidade marcada.

## Como funciona

- Cada hábito possui versões prospectivas de configuração.
- A primeira abertura do dia materializa uma entrada para cada hábito ativo naquela data.
- O denominador inclui hábitos ativos não marcados.
- Grupos podem multiplicar peso em fim de semana ou feriado, com precedência feriado → fim de semana → dia útil.
- Gráficos anotam mudanças reais de configuração; tipo do dia aparece como estilo, não como evento.

## Regras e invariantes

- Snapshot diário congela peso, meta, bônus, tipo de dia e multiplicador.
- Peso efetivo é calculado; o produto peso × multiplicador não é persistido.
- Mudanças de configuração não retroagem.
- Edição manual de um dia passado altera somente a entrada daquele dia.
- Desativação preserva histórico.

## Estado de entrega

Backend, tracker, pesos, multiplicadores e histórico foram entregues nos Épicos 6 e 11. A migração da superfície para o sistema novo está planejada no Épico 16.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-06, AD-10 e AD-11.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — FR-7.
