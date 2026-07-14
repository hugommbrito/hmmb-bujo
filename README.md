# hmmb-bujo

Bullet Journal digital multi-tenant. Monorepo com **backend** Django + DRF e
**frontend** React + Vite + MUI. Banco PostgreSQL via [Neon](https://neon.tech)
(branch `dev` ↔ `.env.dev`, branch `main` ↔ `.env.prod`, branch `e2e` ↔
`.env.e2e` para a suíte E2E).

## Estrutura

```
hmmb-bujo/
├── backend/    # Django + DRF (projeto `config`), gerenciado por uv
└── frontend/   # Vite + React + TypeScript + MUI
```

## Pré-requisitos

- Python 3.12+ e [`uv`](https://docs.astral.sh/uv/) (gerenciador do backend)
- Node.js LTS (≥20) e npm

## Backend

```bash
cd backend
cp .env.example .env.dev   # preencha com a connection string da branch dev do Neon
uv sync                    # cria o venv e instala as deps a partir do uv.lock
uv run python manage.py migrate
uv run python manage.py runserver
```

Health-check: `GET http://localhost:8000/api/health/` → `200 {"status": "ok"}`.

Lint e testes:

```bash
uv run ruff check .
uv run pytest
```

### Ambientes (dev/prod)

A configuração é lida via `django-environ`. Crie `.env.dev`, `.env.prod` e
`.env.e2e` (todos **git-ignored**) a partir de `backend/.env.example`:

- `.env.dev` → branch **dev** do Neon
- `.env.prod` → branch **main** do Neon
- `.env.e2e` → branch **e2e** do Neon (usada pela suíte E2E do Playwright; ver
  [runbook de reset](docs/e2e-neon-reset.md))

`DJANGO_SETTINGS_MODULE` seleciona o settings (`config.settings.dev`,
`config.settings.prod` ou `config.settings.e2e`). CORS e base-URL da API são
configuráveis por ambiente.

## Frontend

```bash
cd frontend
npm ci
npm run dev      # http://localhost:5173 (proxy /api → http://localhost:8000)
```

A base-URL da API em produção vem de `VITE_API_BASE_URL`
(`.env.development` / `.env.production`).

Verificações:

```bash
npm run lint
npx tsc --noEmit
npm run test:run   # vitest (inclui regressão de acessibilidade via jest-axe)
npm run build      # gera estáticos em frontend/dist/
```

## CI

`.github/workflows/ci.yml` roda em cada push: `ruff` + `pytest` (backend, contra
um Postgres efêmero do runner) e `tsc` + ESLint + `vite build` (frontend).
Qualquer erro de lint, tipo, teste ou build falha o workflow.

## Documentação

Documentação viva em [`docs/`](docs/), incluindo o [padrão temporal canônico](docs/temporal-pattern.md) (`core/calendar.py`, AD-04/AD-05).
