---
title: Integridade histórica
aliases:
  - NFR-4
  - Não retroação
type: quality
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/quality
---

# Integridade histórica

O sistema impede retroação automática: configuração ou templates alterados no futuro não reescrevem ocorrências passadas. Isso não proíbe correções manuais pontuais quando o domínio as autoriza.

## Regras por contexto

- [[Hábitos]]: configuração é versionada; editar um dia passado altera apenas sua entrada.
- [[Medicamentos]]: dose e substância vigentes ficam congeladas por ocorrência.
- [[Tarefas]]: origem de migração permanece, e logs fechados são somente leitura.
- Recorrentes: editar template só afeta placements futuros.
- [[Journalling]] e schemas futuros: remoção destrutiva vira desativação.
- Relatórios futuros: cada geração é snapshot imutável.

## Limite semântico

“Snapshot imutável” descreve independência de configuração viva. “Log fechado somente leitura” descreve uma barreira de escrita. São contratos relacionados, mas não equivalentes.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-03, AD-06 a AD-08, AD-16 e AD-20.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — NFR-4.
