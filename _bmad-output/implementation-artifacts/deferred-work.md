# Deferred Work

Itens reais porém não acionáveis agora, registrados durante reviews para acompanhamento futuro.

## Deferred from: code review of 1-1-scaffold-do-monorepo-e-pipeline-de-ci-base (2026-06-24)

- **Hardening de produção incompleto** — `backend/config/settings/prod.py` define cookies `Secure` e `SECURE_PROXY_SSL_HEADER`, mas falta `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`/`INCLUDE_SUBDOMAINS`/`PRELOAD`. Deferido porque o alvo de deploy e o hardening de produção estão explicitamente fora do escopo desta story (Gap I-1, pré-produção). Revisitar antes do primeiro deploy.
- **CI não exercita o caminho de produção** — `.github/workflows/ci.yml` roda apenas `config.settings.dev`; `prod.py` nunca é importado/validado e não há smoke de `migrate`/`makemigrations --check`. Inócuo hoje (sem models de domínio), mas deixa drift de migração e erros exclusivos de prod passarem despercebidos. Revisitar quando houver models (Stories 1.2+) ou ao definir deploy.
