# Deferred Work

Itens reais porém não acionáveis agora, registrados durante reviews para acompanhamento futuro.

## Deferred from: code review of 1-1-scaffold-do-monorepo-e-pipeline-de-ci-base (2026-06-24)

- **Hardening de produção incompleto** — `backend/config/settings/prod.py` define cookies `Secure` e `SECURE_PROXY_SSL_HEADER`, mas falta `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`/`INCLUDE_SUBDOMAINS`/`PRELOAD`. Deferido porque o alvo de deploy e o hardening de produção estão explicitamente fora do escopo desta story (Gap I-1, pré-produção). Revisitar antes do primeiro deploy.
- **CI não exercita o caminho de produção** — `.github/workflows/ci.yml` roda apenas `config.settings.dev`; `prod.py` nunca é importado/validado e não há smoke de `migrate`/`makemigrations --check`. Inócuo hoje (sem models de domínio), mas deixa drift de migração e erros exclusivos de prod passarem despercebidos. Revisitar quando houver models (Stories 1.2+) ou ao definir deploy.

## Deferred from: code review of 1-2-modulo-core-com-isolamento-multi-tenant-fail-closed-e-guardrails (2026-06-24)

- **Escrita cross-tenant não validada contra o contexto ativo** (`backend/core/models.py:394-402`) — `save()` só preenche `user_id` quando é `None`, então um `user_id` explícito arbitrário é persistido sem checar `current_user_id`, e `bulk_create` não chama `save()` (contorna auto-fill + fail-closed). **Razão do defer:** sem serializers/views/`bulk_create` até a Story 1.4; preservar `user_id` explícito é by-design (caminho admin). Endereçar validação `user_id == current_user_id` + guarda de `bulk_create` quando surgir a primeira camada de escrita de domínio.
- **Robustez do `custom_exception_handler` para corpos de erro não-triviais** (`backend/core/exceptions.py:278-315`) — `_as_list` stringifica erros de serializer aninhado como `"{'sub': [...]}"`; `non_field_errors` como string é indexado por caractere; `data=None` vira `{"detail": "None"}`; dict com `detail` + chaves extras rebaixa o `detail` real a "campo". Sem serializers/views que exercitem esses caminhos até a Story 1.4 — endereçar quando a primeira view/serializer surgir.
- **Mapeamento 404 "recurso de outro usuário" não implementado nem testado** (`backend/core/exceptions.py`) — o mapa do §6.4 lista 404 para recurso de outro tenant, mas isso só emerge com `get_object_or_404`/views de recurso, inexistentes até o Épico 3+. Cobrir com a primeira view de recurso.
- **`tenant_context`/middleware aceitam `user.id` None ou falsy** (`backend/core/tenant.py:446,461`; `backend/core/middleware.py:345`) — `set(None)`/`set(0)`/`set("")` torna o contexto indistinguível de "sem tenant" (500 + log crítico enganoso) ou aceita id espúrio. Guards são estritamente `is None`. Sem `User` real até a Story 2.1.
- **`TenantMiddleware` pode "acordar" via sessão do Django admin com PK incompatível** (`backend/core/middleware.py:343-345`) — login no admin autentica um `auth.User` de PK inteiro; o middleware setaria `current_user_id` para um int incompatível com `user_id` UUID. Sem superuser/models de domínio hoje; reavaliar quando houver acesso ao admin ou models reais.
