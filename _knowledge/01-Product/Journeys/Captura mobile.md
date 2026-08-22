---
title: Captura mobile
aliases:
  - Captura rápida no celular
  - UJ-4
type: journey
status: partial
source_files:
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
  - _bmad-output/planning-artifacts/research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22/research.md
source_updated: 2026-07-22
tags:
  - kb/product
  - kb/experience
---

# Captura mobile

No celular, o objetivo é registrar ou marcar com poucos passos, sem transportar planejamento detalhado e migrações para o contexto de deslocamento.

## Como funciona

- Opção A: capturar um título no [[Brain Dump e Captura]], com descrição e destino opcionais.
- Opção B: marcar um hábito ou uma métrica de saúde.
- A navegação compacta mantém a captura persistente disponível.

## Limites

- A jornada original exclui planejamento, detalhamento de tarefas e migração.
- PWA instalada no iOS não oferece share target nem deep link confiável para o app standalone.
- Captura externa deve usar Apple Shortcuts chamando a API com token dedicado, não navegação para uma URL de captura.
- O polimento da PWA é complementar; ela não é o canal primário de captura externa.

## Estado de entrega

A captura mobile do MVP está entregue. O Épico 15 migrará Brain Dump e capture sheet para o sistema visual novo. A API de captura e o token de automação foram entregues no Épico 12.

## Fontes

- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — UJ-4 e NFR-1.
- `_bmad-output/planning-artifacts/research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22/research.md` — limites do iOS e ordem de adoção.
