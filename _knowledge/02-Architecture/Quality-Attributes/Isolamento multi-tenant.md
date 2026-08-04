---
title: Isolamento multi-tenant
aliases:
  - Tenant isolation
  - Isolamento por usuário
type: quality
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
source_updated: 2026-07-29
tags:
  - kb/architecture
  - kb/quality
---

# Isolamento multi-tenant

O isolamento de dados é autoritativo na aplicação e falha fechado: sem contexto de usuário, uma consulta tenant gera erro em vez de retornar todos os dados ou um resultado vazio.

## Regras e invariantes

- Todo model tenant usa `TenantManager`.
- Middleware instala e sempre remove o `current_user_id`.
- Commands, workers e testes usam `tenant_context(user)`.
- Operação administrativa usa `all_objects` de modo explícito e raro.
- Cada app deve provar que consulta sem contexto levanta `TenantScopeViolation`.
- Não há Row-Level Security (RLS) no PostgreSQL.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-12.
- `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` — NFR-3 e FR-15.
