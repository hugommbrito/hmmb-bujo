---
title: Saúde
aliases:
  - Métricas de saúde
  - Health
type: capability
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/product
---

# Saúde

Saúde registra métricas definidas pelo usuário com tipos explícitos e histórico consultável para apoiar percepção pessoal e comunicação clínica.

## Como funciona

- Definições de campo controlam nome, tipo, ativação e validação.
- Valores diários vivem em JSONB indexado pelo UUID da definição.
- Validação ocorre na camada de serviço contra campos ativos.
- Leituras analíticas fazem conversão explícita de tipo.
- Histórico oferece tabela, gráficos por campo e resumo.

## Regras e invariantes

- JSONB é específico para métricas dinâmicas; não é padrão indiscriminado.
- Desativar campo preserva histórico.
- Mudanças futuras de definição não reescrevem registros passados.
- Pressão arterial terá domínio próprio no futuro, com par sistólica/diastólica atômico.

## Estado de entrega

Métricas dinâmicas, log diário e visualizações foram entregues no Épico 7. Refinos e a superfície nova pertencem ao Épico 16; pressão arterial está no Épico 22.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-01 e AD-27.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — FR-8 e FR-12.
