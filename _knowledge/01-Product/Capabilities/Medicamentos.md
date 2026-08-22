---
title: Medicamentos
aliases:
  - Medicines
  - Adesão medicamentosa
type: capability
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/product
---

# Medicamentos

Medicamentos registram doses programadas e adesão por data e bloco de horário, preservando o significado clínico de uma dose ausente.

## Como funciona

- O grão do log é medicamento × bloco × data.
- Blocos de horário são configuráveis por usuário.
- Confirmação de bloco escreve as doses em lote; o estado do bloco é derivado.
- Agenda de doses e substância/laboratório possuem versionamentos independentes.
- Entradas diárias congelam a dose vigente e distinguem origem programada de ad hoc.

## Regras e invariantes

- Medicamento é entidade própria, não campo de Saúde.
- Ausência de entrada programada em dia passado significa dose perdida.
- Alterar substância não precisa alterar agenda, e vice-versa.
- Configuração futura não reescreve adesão histórica.

## Estado de entrega

Cadastro, confirmação e histórico foram entregues no Épico 8. A superfície do sistema novo está planejada no Épico 16.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-07.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — FR-9.
