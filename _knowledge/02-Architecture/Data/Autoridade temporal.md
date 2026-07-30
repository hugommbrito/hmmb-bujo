---
title: Autoridade temporal
aliases:
  - Contrato temporal
  - Calendário canônico
type: concept
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
source_updated: 2026-07-29
tags:
  - kb/architecture
---

# Autoridade temporal

O servidor define o instante e `users.timezone` define a zona; `today_for(user)` é a única autoridade para o “hoje” lógico.

## Regras e invariantes

- Instantes usam `timestamptz`; páginas de diário usam `DATE`.
- Código de domínio não chama diretamente `date.today()` ou `timezone.now().date()`.
- O dia lógico congela ao abrir a página.
- Sem refresh automático à meia-noite, fechamento por cron ou migração automática.
- Semana começa na segunda; a primeira semana do mês/ano contém o dia 1.
- Weekly Log é chaveado por `week_start`; Monthly Log por `month_first`.
- Future Log é um Monthly Log futuro, não outra entidade.

## Relações

- Determina a identidade do [[Ciclo BuJo]].
- Sustenta a detecção de [[Migração e Catch-Up]].

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-04 e AD-05.
