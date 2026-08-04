---
title: Riscos de entrega
aliases:
  - Dívidas abertas
  - Lacunas de entrega
type: risk
status: current
source_files:
  - _bmad-output/implementation-artifacts/deferred-work.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/planning-artifacts/deferred-features.md
source_updated: 2026-07-28
tags:
  - kb/quality
  - kb/delivery
---

# Riscos de entrega

O núcleo está operacional, mas ainda existem homologação manual, coexistência com o legado e funcionalidades conscientemente deferidas.

## Ações abertas

- Homologar manualmente o Épico 14 em `dev` antes de promover para produção.
- Avaliar reaproveitamento de sessões preservadas em retries do `bmad-loop`.
- Confirmar incorporação das decisões de acessibilidade e reduced motion do Épico 13.

## Funcionalidades deferidas

- Daily Logs anteriores no Arquivo.
- Busca histórica por tarefa.
- Navegação bidirecional da linhagem.
- Resumo de período por IA, condicionado à arquitetura futura de Análises.

## Riscos estruturais

- A coexistência por rota permanece até o Épico 18 remover aliases e componentes legados.
- Gates UX humanos condicionam o início de cada superfície futura.
- Histórico do sprint contém comentários extensos de execução; esta base considera o status final, não cada log operacional.
- O cabeçalho de atualização do sprint está atrasado em relação a entradas internas; consulte [[Roadmap]] antes de assumir a próxima story.

Débitos concretos de implementação não são resumidos aqui; estão em [[Riscos técnicos]].

## Fontes

- `_bmad-output/implementation-artifacts/sprint-status.yaml` — ações e status.
- `_bmad-output/implementation-artifacts/deferred-work.md` — dívida técnica.
- `_bmad-output/planning-artifacts/deferred-features.md` — capacidades adiadas.
