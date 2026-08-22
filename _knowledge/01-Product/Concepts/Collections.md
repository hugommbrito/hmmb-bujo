---
title: Collections
aliases:
  - Coleções
  - Módulos de registro
type: concept
status: partial
source_files:
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/addendum.md
source_updated: 2026-07-23
tags:
  - kb/product
---

# Collections

Collections são módulos de registro integrados ao workspace. Há collections codificadas com contratos próprios e uma futura collection-container para schemas criados pelo usuário.

## Estado atual

Entregues no MVP: [[Hábitos]], [[Saúde]], [[Medicamentos]] e gratidão. O manifest/registry base já existe. [[Journalling]] substituirá gratidão; módulos de alimentação, pressão arterial, análises e custom collections estão aprovados para o roadmap, mas ainda não implementados.

## Regras e invariantes

- Cada domínio usa a estratégia de dados apropriada; não há EAV ou JSONB indiscriminado.
- Collections codificadas são registradas no manifest.
- Custom Collections admitem campos tipados e um nível de sub-registros.
- Desligar uma collection não deve destruir histórico.
- Participação em dashboard ou IA é explícita e conservadora por padrão.

## Estados de desativação

- Desativar uma collection impede novas ofertas e operações que dependem dela, sem apagar registros ou relatórios históricos.
- Métricas de collection desligada deixam de aparecer em novos modelos de relatório.
- Participação em dashboard, Arquivo ou contexto de IA segue contratos específicos; não é inferida apenas pela existência da collection.
- Flags de ativação são estado do servidor separado do manifest estático.

## Relações

- A arquitetura é definida em [[Arquitetura de aplicação]].
- O sequenciamento futuro está em [[Roadmap]].

## Fontes

- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — FR-1, FR-7 a FR-14.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/addendum.md` — contratos técnicos complementares.
