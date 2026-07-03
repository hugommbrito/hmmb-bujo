---
title: 'Corrige CI (types.gen.ts divergente) e diagnostica falha de deploy no Railway (CORS)'
type: 'bugfix'
created: '2026-07-03'
status: 'done'
route: 'one-shot'
context: []
---

## Intent

**Problem:** O CI do GitHub falhava porque `frontend/src/api/types.gen.ts` estava commitado como um stub vazio (`Record<string, never>`), divergente do schema real gerado por `manage.py spectacular`. Em paralelo, o deploy no Railway falhava o healthcheck porque `CORS_ALLOWED_ORIGINS` continha uma origin com barra final (`.../`), o que o Django rejeita no system check `corsheaders.E014`, impedindo o container de subir.

**Approach:** Regenerar `schema.yaml` e `frontend/src/api/types.gen.ts` a partir do estado atual das views (`manage.py spectacular` + `npm run generate-types`) e commitar o resultado real. A causa do CORS é uma env var mal configurada no Railway (não um bug de código — `env.list()` trata `CORS_ALLOWED_ORIGINS` e `ALLOWED_HOSTS` de forma idêntica); a correção é operacional, feita diretamente no dashboard do Railway, sem mudança de código.

## Suggested Review Order

**Regeneração do contrato de API**

- Schema real passa a listar os 3 endpoints de `accounts` (antes vazio)
  [`schema.yaml:6`](../../schema.yaml#L6)

- Tipos TS gerados a partir do schema real — antes `Record<string, never>` em tudo
  [`types.gen.ts:6`](../../frontend/src/api/types.gen.ts#L6)

**Débito técnico exposto pela regeneração (não introduzido por esta mudança)**

- Lacunas de anotação `@extend_schema` em `accounts/views.py` (status/response/error codes incorretos no schema) registradas para tratamento futuro
  [`deferred-work.md`](./deferred-work.md)
