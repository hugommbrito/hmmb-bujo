---
title: Snapshots e versionamento
aliases:
  - Integridade por snapshot
  - Configuração prospectiva
type: decision
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/decisions
  - kb/architecture
---

# Snapshots e versionamento

Configuração é prospectiva e ocorrências históricas preservam os valores vigentes no momento; “imutável” proíbe retroação automática, mas não necessariamente uma correção manual autorizada.

## Decisões

- [[Hábitos]] materializam peso, meta, bônus e tipo de dia na primeira abertura da data.
- [[Medicamentos]] congelam dose e origem para cada ocorrência.
- Tarefas recorrentes geram instâncias independentes do template.
- Gerações futuras de relatórios serão snapshots que nunca recebem `UPDATE`.
- Campos e schemas com histórico preferem desativação a remoção destrutiva.

## Regras e invariantes

- Alterar configuração hoje não reescreve ontem.
- Correção manual de um registro passado afeta apenas aquele registro quando o domínio autoriza.
- Logs fechados do núcleo BuJo permanecem somente leitura.
- Histórico preservado não significa que toda configuração antiga continue oferecida para novas entradas.

## Relações

- Resolve a interpretação operacional de [[Integridade histórica]].
- Restringe [[Tarefas]], [[Hábitos]], [[Medicamentos]] e [[Journalling]].

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-03, AD-06 a AD-08, AD-20 e AD-25.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — NFR-4.
