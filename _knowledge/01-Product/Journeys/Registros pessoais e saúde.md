---
title: Registros pessoais e saúde
aliases:
  - Rotina de saúde
  - UJ-6
  - UJ-7
  - UJ-8
type: journey
status: partial
source_files:
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-22
tags:
  - kb/product
---

# Registros pessoais e saúde

O usuário revisa e corrige dados pessoais por data, confirma medicamentos e ajusta prospectivamente a configuração de hábitos.

## Como funciona

- [[Journalling]]: registrar textos livres e revisitar o histórico.
- [[Saúde]]: preencher métricas dinâmicas e consultar tabela, gráficos e resumo.
- [[Medicamentos]]: confirmar doses por bloco ou individualmente e consultar adesão.
- [[Hábitos]]: criar, ponderar, desativar ou reativar definições.

## Regras e invariantes

- Alterações de configuração valem prospectivamente.
- Uma correção manual de dia passado altera somente aquele registro.
- Desativação remove o item do log ativo, não do histórico.
- Ausência de dose programada possui significado clínico distinto de hábito não marcado.

## Estado de entrega

As capacidades do MVP estão entregues. O Épico 16 migrará e ampliará as superfícies no sistema novo e substituirá gratidão por Journalling.

## Fontes

- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — UJ-6, UJ-7 e UJ-8.
