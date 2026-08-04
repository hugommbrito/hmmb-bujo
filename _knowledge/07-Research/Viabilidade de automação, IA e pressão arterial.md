---
title: Viabilidade de automação, IA e pressão arterial
aliases:
  - Pesquisa C5
  - Pesquisa de IA
  - Pesquisa de pressão arterial
type: research
status: current
source_files:
  - _bmad-output/planning-artifacts/research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22/research.md
source_updated: 2026-07-22
tags:
  - kb/research
---

# Viabilidade de automação, IA e pressão arterial

A investigação concluiu que Apple Shortcuts oferece o melhor canal inicial de captura externa; análises devem usar DSL compilada e séries calculadas no backend; pressão arterial exige um modelo clínico atômico e confirmação humana para extração por foto.

## Captura e iOS

- PWA no iOS não oferece Web Share Target.
- Deep links externos abrem no Safari, não de forma confiável no standalone.
- Shortcuts pode receber texto, URL ou imagem e chamar diretamente a API.
- Scriptable é opção posterior para widget de resumo, aceitando atualização atrasada.
- Wrapper nativo tem custo desproporcional para o estágio atual.

## IA analítica

- Executar SQL gerado por modelo combina prompt injection e tratamento inseguro de saída.
- A alternativa adotada é spec JSON restrita, validada por schema e allowlist, compilada para ORM.
- Números e séries vêm do backend.
- A IA retorna texto e referências a visualizações, não código ou dados embutidos.
- Snapshots de geração e exemplar versionado preservam reprodutibilidade.

## Pressão arterial

- Sistólica e diastólica formam um par atômico; pulso é observação opcional.
- Sessões seguem o protocolo 7-2-2, mas leituras avulsas continuam permitidas.
- Dashboard privilegia média móvel ou média de sessão, não leitura isolada.
- Foto exige plausibilidade, confiança por campo, fallback manual e confirmação explícita.

## Privacidade

- Uso estritamente pessoal possui exceção doméstica na Lei Geral de Proteção de Dados Pessoais (LGPD), mas convidados tornam o enquadramento mais sensível.
- Dados de terceiros exigem consentimento explícito para IA em nuvem e fluxo manual como padrão.
- Provedores precisam garantir que conteúdo de API não seja usado para treinamento; Gemini free tier foi descartado para saúde.

## Confiança e limites

As conclusões centrais foram classificadas majoritariamente com confiança alta. Integração Apple Health via Shortcuts e interpretação da exceção doméstica com convidados mantêm incerteza e exigem validação específica antes da entrega.

## Fontes

- `_bmad-output/planning-artifacts/research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22/research.md` — evidências, alternativas e recomendações.
