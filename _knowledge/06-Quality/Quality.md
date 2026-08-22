---
title: Qualidade
aliases:
  - Quality
  - Requisitos não funcionais
type: moc
status: current
source_files:
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md
source_updated: 2026-07-24
tags:
  - kb/quality
  - kb/moc
---

# Qualidade

Qualidade combina isolamento, integridade histórica, acesso mobile funcional, acessibilidade e degradação segura de integrações.

## Atributos

- [[Isolamento multi-tenant]] — nenhum dado cruza usuários.
- [[Integridade histórica]] — mudanças futuras não retroagem sobre snapshots; correções manuais permanecem possíveis quando o domínio autoriza.
- [[Performance do fluxo diário]] — menos de 2 segundos percebidos somente no caminho de execução diária.
- Mobile real — ações diárias sem scroll horizontal.
- WCAG 2.2 AA como piso da [[Experience]].
- Ambientes dev e prod isolados.
- Integrações externas degradam sem quebrar o núcleo.
- IA usa allowlist, acesso read-only e limites de execução.

## Riscos

- [[Riscos de entrega]] reúne ações abertas, débitos conhecidos e ambiguidades.
- [[Riscos técnicos]] preserva lacunas verificadas que ainda restringem produção e evolução.

## Fontes

- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — NFR-1 a NFR-9.
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md` — acessibilidade, resiliência e responsividade.
