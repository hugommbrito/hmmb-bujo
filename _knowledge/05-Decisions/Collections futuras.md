---
title: Collections futuras
aliases:
  - Arquitetura das Collections futuras
type: decision
status: proposed
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/decisions
  - kb/product
---

# Collections futuras

As Collections futuras já possuem fronteiras arquiteturais aprovadas, embora seus épicos ainda estejam no backlog.

## Decisões por domínio

- [[Journalling]]: campos definidos pelo usuário, uma âncora temporal por cadência e IA opt-in.
- Custom Collections: schema e registros em JSONB, validação no serviço e somente um nível de sub-registros.
- Alimentação: espelho local somente leitura do sistema externo; falhas não quebram o núcleo; fotos ficam referenciadas, não duplicadas.
- Análises: catálogo allowlist, DSL compilada, séries calculadas pelo backend e snapshots de geração.
- Pressão Arterial: sistólica e diastólica formam par atômico; pulso é opcional; sessões 7-2-2 e confirmação humana para foto.

## Estado de entrega

- Journalling: Épico 16.
- Custom Collections: Épico 19.
- Alimentação: Épico 20.
- Análises e configuração de IA: Épico 21.
- Pressão Arterial: Épico 22.

Nenhuma dessas capacidades deve ser descrita como disponível antes da conclusão de suas histórias.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-20 e AD-22 a AD-27.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — FR-10 a FR-14.
