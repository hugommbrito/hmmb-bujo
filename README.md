# hmmb-bujo

Bullet Journal digital multi-tenant. Monorepo com **backend** Django + DRF e
**frontend** React + Vite + MUI. Banco PostgreSQL via [Neon](https://neon.tech)
(branch `dev` ↔ `.env.dev`, branch `main` ↔ `.env.prod`).

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

A configuração é lida via `django-environ`. Crie `.env.dev` e `.env.prod`
(ambos **git-ignored**) a partir de `backend/.env.example`:

- `.env.dev` → branch **dev** do Neon
- `.env.prod` → branch **main** do Neon

`DJANGO_SETTINGS_MODULE` seleciona o settings (`config.settings.dev` ou
`config.settings.prod`). CORS e base-URL da API são configuráveis por ambiente.

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
npm run build    # gera estáticos em frontend/dist/
```

## CI

`.github/workflows/ci.yml` roda em cada push: `ruff` + `pytest` (backend, contra
um Postgres efêmero do runner) e `tsc` + ESLint + `vite build` (frontend).
Qualquer erro de lint, tipo, teste ou build falha o workflow.

## Documentação

Documentação viva em [`docs/`](docs/) (o padrão temporal canônico chega na Story 1.3).
