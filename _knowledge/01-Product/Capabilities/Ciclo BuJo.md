---
title: Ciclo BuJo
aliases:
  - Motor BuJo
  - Logs BuJo
type: capability
status: current
source_files:
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-28
tags:
  - kb/product
---

# Ciclo BuJo

O ciclo BuJo conecta Daily, Weekly, Monthly e Future Log e está entregue no backend e nas superfícies do MVP; o novo sistema visual já cobre shell, semanal, mensal, Future Log, recorrentes, migração e arquivo.

## Como funciona

- Daily Log representa o dia lógico.
- Weekly Log começa na segunda-feira e atravessa meses sem duplicação.
- Monthly Log representa o mês; um mês futuro também é o Future Log.
- Encerrar um ciclo exige dar disposição às pendências por [[Migração e Catch-Up]].
- O arquivo oferece leitura dos ciclos fechados.

## Regras e invariantes

- O sistema não fecha nem migra períodos por cron.
- Semana e mês têm identidade temporal canônica.
- O usuário decide; o sistema executa a movimentação e mantém a linhagem.
- Logs passados e registros históricos não devem sofrer alteração retroativa indevida.

## Estado de entrega

Os épicos 1–9 e 11–14 estão concluídos. A modernização visual de Weekly, Monthly, Future Log, recorrentes, migração e arquivo foi fechada no Épico 14; Daily Log e Home ainda pertencem ao Épico 17 do [[Roadmap]]. As jornadas relacionadas estão em [[Dia de uso]] e [[Planejamento e fechamento de ciclos]].

## Fontes

- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — capacidade e regras funcionais.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — estado de entrega.
