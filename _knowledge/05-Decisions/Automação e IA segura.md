---
title: Automação e IA segura
aliases:
  - Guardrails de IA
  - Plataforma de automação
type: decision
status: partial
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
  - _bmad-output/planning-artifacts/research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22/research.md
source_updated: 2026-07-29
tags:
  - kb/decisions
  - kb/security
---

# Automação e IA segura

Automação usa credenciais dedicadas e IA opera sobre contratos declarativos: ela analisa e explica, mas não executa queries, inventa números, migra tarefas ou salva captura clínica sem confirmação.

## Implementado

- `AutomationToken` é opaco, longo, escopado e revogável.
- Apenas o hash SHA-256 é armazenado; o valor pleno aparece uma vez.
- Autenticação dedicada instala o tenant do dono sem criar sessão JWT.
- API externa de captura e resumo diário foram entregues no Épico 12.

## Aprovado para entrega futura

- Chave própria do usuário, criptografada em repouso.
- Catálogo allowlist de métricas.
- Spec JSON validada e compilada no servidor para ORM.
- Banco de leitura com role read-only e `statement_timeout`.
- Backend calcula séries; IA referencia `serie_ref` e apenas escolhe narrativa e visualização.
- Campos de journalling entram no contexto somente com opt-in.
- Consentimento explícito para dados sensíveis de convidados.
- Pressão arterial extraída de foto exige formulário editável e confirmação humana.

## Proibições

- SQL ou código gerado por modelo.
- Números produzidos pela IA.
- Fotos enviadas como contexto analítico.
- Gemini free tier para dados sensíveis.
- Salvamento automático de leitura clínica extraída de imagem.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-19 e AD-24 a AD-27.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — FR-2, FR-3, FR-12, FR-13, NFR-7 e NFR-8.
- `_bmad-output/planning-artifacts/research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22/research.md` — ameaças e alternativas verificadas.
