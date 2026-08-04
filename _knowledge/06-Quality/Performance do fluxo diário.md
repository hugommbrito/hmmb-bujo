---
title: Performance do fluxo diário
aliases:
  - NFR-2
  - Hot path diário
type: quality
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/quality
---

# Performance do fluxo diário

A meta de menos de dois segundos percebidos aplica-se exclusivamente ao modo de execução cotidiana, não a toda página do produto.

## Dentro do hot path

- Carregar Daily Log.
- Marcar hábito.
- Registrar saúde.
- Confirmar medicamento.
- Executar migrações.

## Fora do requisito formal

- Planejamento Weekly, Monthly e Future Log.
- Revisão histórica.
- Análises e relatórios.

Essas superfícies ainda devem ser utilizáveis, mas não justificam índices, agregações ou views materializadas preventivamente. Otimização adicional depende de medição real.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-14.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — NFR-2.
