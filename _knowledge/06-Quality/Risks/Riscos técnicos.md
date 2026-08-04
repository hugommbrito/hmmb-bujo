---
title: Riscos técnicos
aliases:
  - Dívida técnica ativa
  - Deferred work
type: risk
status: current
source_files:
  - _bmad-output/implementation-artifacts/deferred-work.md
source_updated: 2026-07-28
tags:
  - kb/quality
  - kb/delivery
---

# Riscos técnicos

Esta nota preserva lacunas verificadas e ainda abertas; são riscos reais, mas nem todos são acionáveis na frente atual.

## Produção e segurança

- Hardening de produção registrado como incompleto: redirecionamento HTTPS e HSTS precisam ser revistos antes do primeiro deploy.
- CI não exercita integralmente as configurações de produção.
- A proteção de escrita cross-tenant e caminhos de `bulk_create` foi registrada como área que exige validação explícita.

## Contrato de API

- OpenAPI de signup e respostas de erro pode divergir do comportamento real.
- Tipos de request/response de token podem estar conflados.
- O pipeline detecta drift entre artefatos gerados, mas não prova equivalência entre schema e views.

## Acessibilidade

- Weekly Planning mantém dívida conhecida de contraste e tamanho de alvo em faixas estreitas.
- A correção toca tokens compartilhados e foi atribuída aos Épicos 17 ou 18.

## Arquivo e linhagem

- Origem cross-período pode não aparecer no detalhe porque a busca está limitada ao período carregado.
- Saltos consecutivos de linhagem podem sobrescrever o retorno salvo em `sessionStorage`.
- Controle com `aria-disabled` pode continuar clicável e produzir ação morta.

## Processo

- A Story 14.10 ainda possui recomendação de follow-up review independente.
- Itens deste catálogo precisam ser verificados contra o código antes de execução; `deferred-work.md` também contém entradas históricas já resolvidas.

## Fontes

- `_bmad-output/implementation-artifacts/deferred-work.md` — lacunas verificadas, resoluções e encaminhamentos.
