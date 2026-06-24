---
baseline_commit: b79865536240c52ffc8734b1746f7f7e811f035c
---

# Story 1.1: Scaffold do monorepo e pipeline de CI base

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **desenvolvedor do projeto**,
I want **um monorepo `backend/` (Django + DRF) e `frontend/` (React + Vite + MUI) com ambientes dev/prod isolados e CI rodando lint e testes**,
so that **exista um esqueleto deployável e verificável sobre o qual todo o resto é construído, com dev e prod nunca cruzando dados** (FR-0.3, FR-0.4, NFR-5, AR-1).

## Acceptance Criteria

**AC1 — Scaffold do monorepo (backend + frontend)**
**Given** o repositório vazio,
**When** o scaffold é criado,
**Then** existe `backend/` com projeto Django + DRF, `manage.py`, `pyproject.toml` (deps + ruff + pytest) e `config/settings/` dividido em `base.py`/`dev.py`/`prod.py` via `django-environ`,
**And** existe `frontend/` com Vite + React + TypeScript + MUI, `package.json`, `tsconfig.json` e ESLint configurado.

**AC2 — Ambientes dev/prod isolados via Neon**
**Given** os ambientes dev e prod,
**When** a configuração é carregada,
**Then** `.env.dev` aponta para a branch dev do Neon e `.env.prod` para a branch main, lidos por `django-environ`, sem segredos commitados (`.env.example` versionado),
**And** CORS e base-URL da API são configuráveis por variável de ambiente desde o início.

**AC3 — Pipeline de CI base**
**Given** um push para o repositório,
**When** o workflow `.github/workflows/ci.yml` roda,
**Then** executa `ruff` + `pytest` (backend) e `tsc` + ESLint (frontend) e falha o build em qualquer erro,
**And** o backend sobe e responde a um health-check, e o `vite build` gera os estáticos sem erro.

## Tasks / Subtasks

- [x] **Task 1 — Estrutura raiz do monorepo** (AC: 1)
  - [x] Criar `README.md` na raiz (descrição mínima do projeto + como rodar backend e frontend)
  - [x] Criar diretório `docs/` (documentação viva — destino do padrão temporal canônico da Story 1.3)
  - [x] Criar `.gitignore` cobrindo `.env`, `.env.dev`, `.env.prod`, `__pycache__/`, `*.pyc`, `node_modules/`, `dist/`, `.venv/`, `frontend/dist/`
- [x] **Task 2 — Scaffold do backend Django + DRF** (AC: 1)
  - [x] Inicializar projeto Django em `backend/` com `manage.py` e o pacote `config/` (NÃO usar o nome default; o projeto Django chama-se `config`, como na árvore §7.1)
  - [x] Criar `backend/pyproject.toml` com dependências (Django, DRF, django-environ, django-cors-headers, pytest, pytest-django, factory-boy, ruff) + seção `[tool.ruff]` + seção `[tool.pytest.ini_options]`
  - [x] Na seção `[tool.pytest.ini_options]`, **cravar `DJANGO_SETTINGS_MODULE = "config.settings.dev"`** (sem isso o `pytest-django` não encontra o settings e a coleta falha) + `python_files = "test_*.py"`
  - [x] Gerar `backend/uv.lock` (gerenciador de pacotes do backend é `uv` — cravar versões major aqui, ver Dev Notes §Versões)
  - [x] Criar split de settings `backend/config/settings/{__init__.py,base.py,dev.py,prod.py}` lendo env via `django-environ` (`environ.Env()` + `env.read_env()`)
  - [x] Configurar `INSTALLED_APPS` com `rest_framework` e `corsheaders`; `MIDDLEWARE` com `corsheaders.middleware.CorsMiddleware` no topo; `DATABASES` lido de `DATABASE_URL` (`env.db()`); `ALLOWED_HOSTS`, `DEBUG`, `SECRET_KEY`, `CORS_ALLOWED_ORIGINS` via env
  - [x] **NÃO** forçar opções de SSL no `DATABASES`/`OPTIONS` — o `sslmode` deve vir apenas da `DATABASE_URL` (`env.db()` já o propaga). Hardcodar `sslmode=require` quebra o Postgres efêmero do CI, que não fala SSL (ver §CI)
  - [x] Criar diretórios-placeholder `backend/core/` e `backend/accounts/` com `__init__.py` (apenas esqueleto — conteúdo é das Stories 1.2/2.1; ver §Limites de Escopo). **NÃO** registrá-los em `INSTALLED_APPS` ainda — são pacotes sem models; registrar app vazio sem `migrations/` confunde `makemigrations`/coleta. Entram em `INSTALLED_APPS` quando ganharem models (1.2/2.1)
- [x] **Task 3 — Health-check do backend** (AC: 3)
  - [x] Implementar endpoint `GET /api/health/` que retorna `200` com `{"status": "ok"}` (view DRF fina ou função simples), registrado em `config/urls.py` sob o prefixo `/api/`
  - [x] Garantir que o backend sobe (`python manage.py check` + boot do runserver) sem erro com `.env.dev` válido
- [x] **Task 4 — Configuração de ambiente (Neon dev/prod)** (AC: 2)
  - [x] Criar `backend/.env.example` versionado com TODAS as chaves (valores placeholder): `DJANGO_SETTINGS_MODULE`, `SECRET_KEY`, `DEBUG`, `DATABASE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`
  - [x] Documentar no `README.md`/`.env.example` que `.env.dev` → branch dev do Neon e `.env.prod` → branch main; ambos git-ignored
  - [x] `frontend/.env.development` e `frontend/.env.production` com `VITE_API_BASE_URL` (base-URL da API configurável por ambiente)
- [x] **Task 5 — Scaffold do frontend Vite + React + TS + MUI** (AC: 1)
  - [x] Inicializar `frontend/` com Vite (template `react-ts`): `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`
  - [x] Instalar MUI (`@mui/material`, `@emotion/react`, `@emotion/styled`) + TanStack Query v5 + Axios (apenas instalar; configuração de tema e client é das Stories 1.5)
  - [x] Configurar `vite.config.ts` com proxy `/api` → `http://localhost:8000` (usado em **dev**: chamadas same-origin, sem CORS) e leitura de `VITE_API_BASE_URL` (usado em **prod**/cross-origin). Não duplicar a config — proxy para dev, base-URL para prod
  - [x] Configurar ESLint base TS/React. O template `react-ts` atual do Vite gera **flat config** (`eslint.config.js`) — adotar o flat config como padrão (a árvore §7.1 cita `.eslintrc.cjs` por legado; seguir o que o template gera e não misturar os dois formatos). Regra de boundary de features fica para 1.5
  - [x] Cravar versões major no `package.json` + `package-lock.json` (ver §Versões)
  - [x] Garantir que `vite build` gera estáticos em `frontend/dist/` sem erro
- [x] **Task 6 — Testes mínimos para o CI passar** (AC: 3)
  - [x] Backend: criar um smoke test (ex.: `backend/core/tests/test_health.py`) que chama `GET /api/health/` e valida `200` — garante que `pytest` coleta ≥ 1 teste (evitar exit code 5 "no tests collected")
  - [x] Criar `backend/conftest.py` mínimo ativando `@pytest.mark.django_db` por default (fixtures de isolamento parametrizadas vêm na 1.2)
  - [x] Frontend: garantir que `tsc --noEmit` e `eslint` passam limpos no scaffold
- [x] **Task 7 — Pipeline de CI** (AC: 3)
  - [x] Criar `.github/workflows/ci.yml` com job de backend (`ruff check` + `pytest`) e job de frontend (`tsc` + `eslint` + `vite build`)
  - [x] Job de backend: instalar o `uv` via `astral-sh/setup-uv` e instalar deps com `uv sync` (não improvisar `pip install uv`)
  - [x] Configurar **Postgres efêmero do runner** como serviço do job de backend (GitHub Actions `services: postgres:`); `DATABASE_URL` do CI aponta para esse serviço (sem depender do Neon na rede)
  - [x] **Definir os env vars do job de backend no próprio `ci.yml`** (`env:`) — o `.env.example` NÃO é lido pelo GitHub Actions. Exportar no mínimo: `DJANGO_SETTINGS_MODULE=config.settings.dev`, `SECRET_KEY` (valor dummy de CI), `ALLOWED_HOSTS=localhost,127.0.0.1` e `DATABASE_URL=postgres://postgres:postgres@localhost:5432/...` (**sem** `sslmode`, pois o serviço não fala SSL)
  - [x] Garantir que qualquer erro de lint/teste/tipo/build falha o workflow (exit non-zero)
  - [x] **NÃO** adicionar import-linter, guardrail de tenant nem `test_isolation` aqui — pertencem à Story 1.2 (ver §Limites de Escopo)

## Dev Notes

### ⚠️ Limites de Escopo (LEIA PRIMEIRO — previne over-build)

Esta é a **primeira história do projeto** (greenfield, repo só com commit inicial). O escopo é **estritamente o esqueleto deployável + CI base**. NÃO implemente o conteúdo das histórias seguintes — apenas crie os diretórios-placeholder quando indicado.

| Pertence a esta Story (1.1) | NÃO faça agora — Story responsável |
|---|---|
| Esqueleto `backend/` Django+DRF + split de settings | Conteúdo de `core/` (`TenantModel`, `tenant.py`, `exceptions.py`, `middleware.py`, `pagination.py`) → **Story 1.2** |
| Esqueleto `frontend/` Vite+React+TS+MUI + ESLint base | `core/calendar.py` + padrão temporal canônico → **Story 1.3** |
| `.env.dev`/`.env.prod`/`.env.example` + Neon branches | `drf-spectacular`, `djangorestframework-camel-case`, contrato `types.gen.ts`, paginação default, serviço de referência → **Story 1.4** |
| Health-check `/api/health/` | `theme.ts` (tema MUI), `api/client.ts` (Axios single-flight), `keys.ts`, `queryClient.ts`, `useOptimisticMutation`, regra de boundary ESLint → **Story 1.5** |
| CI: `ruff` + `pytest` + `tsc` + ESLint + `vite build` | import-linter, guardrail de tenant, `test_isolation`, guardrail de calendário → **Stories 1.2/1.3** |
| `User` model com UUID + JWT + endpoints de auth → **Story 2.1** |

**Princípio:** o repo ao final desta história deve **subir, lintar, testar e buildar verde** — nada além disso. Criar diretórios `core/` e `accounts/` apenas como pacotes Python vazios (`__init__.py`) é aceitável e desejável para fixar a estrutura, mas sem lógica.
[Source: epics.md#Epic-1, architecture.md §8.7 Handoff]

### Versões (M-1 — cravar no scaffold via lockfiles)

A arquitetura **não fixa major versions** no texto (§2 Stack); a decisão (§8.3, §8.4-M-1) é **cravá-las no scaffold via lockfiles** (`uv.lock` no backend, `package-lock.json` no frontend). Use as recomendações abaixo, salvo orientação contrária:

- **Backend:** Python **3.12+**, Django **5.x**, Django REST Framework **3.15+**, `django-environ` (última estável), `pytest` + `pytest-django`, `factory-boy`, `ruff`. Gerenciador: **`uv`** (gera `uv.lock`).
- **Frontend:** Node **LTS (≥20)**, **React 18** (preferir 18 a 19 no scaffold: MUI 6.0 tem fricção de peer-deps com React 19 em minors iniciais — se for React 19, usar MUI ≥6.1), Vite **5.x+**, MUI **6.x**, TypeScript **5.3+**, **TanStack Query v5** (explícito na arquitetura — único pinado), Axios. Gerenciador: npm (`package-lock.json`).

Cravar as versões resolvidas nos lockfiles é o entregável; não deixar ranges abertos sem lock.
[Source: architecture.md §2 Stack Definida, §8.3 Prontidão, §8.4 M-1]

### Stack & convenções aplicáveis

- **Banco:** PostgreSQL via **Neon** (serverless, branching). Sem Docker. Conexão via `DATABASE_URL` (`env.db()` do django-environ). Branch dev ↔ `.env.dev`; branch main ↔ `.env.prod`. Nada assume estado de banco no boot. [Source: architecture.md §1.1, §7.4]
- **Projeto Django chama-se `config`** (não o nome do app). Settings split em `config/settings/{base,dev,prod}.py`; `dev.py`/`prod.py` herdam de `base.py`. `DJANGO_SETTINGS_MODULE` selecionado por env. [Source: architecture.md §6.2, §7.1]
- **Prefixo `/api/` em todo endpoint** (router DRF na raiz). Respostas DRF nativas, sem envelope. O health-check já nasce sob `/api/health/`. [Source: architecture.md §6.3, §7.2]
- **Migrations nomeadas** (`--name` descritivo, nunca `auto_<timestamp>`), uma por story. Nesta story não há models de domínio; se o Django exigir a migration inicial dos apps default, mantê-la padrão. [Source: architecture.md §6.1]
- **Nomenclatura:** `snake_case` no Python/DB; `PascalCase` em classes/components; `camelCase` em variáveis JS/TS e query params; componentes React em `PascalCase.tsx`. [Source: architecture.md §6.1]
- **Deploy-agnóstico via 12-factor/env** — alvo (Railway/Fly/Render) **a definir** (Gap I-1, NÃO bloqueia esta story; é pré-produção). Logging estruturado (I-2) também diferido. Não escolha alvo de deploy aqui. [Source: architecture.md §8.4 I-1/I-2, §7.4]

### Configuração de ambiente (AC2)

`backend/.env.example` versionado deve listar todas as chaves com placeholders (sem segredos reais):

```
DJANGO_SETTINGS_MODULE=config.settings.dev
SECRET_KEY=changeme-dev-only
DEBUG=True
DATABASE_URL=postgres://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

- `.env.dev` e `.env.prod` ficam **git-ignored** e cada um aponta para sua branch do Neon (dev / main). [Source: architecture.md §7.4]
- **CORS e base-URL da API configuráveis por env desde o dia 1** — não fechar a porta de servir o frontend via CDN vs Django. Frontend consome `VITE_API_BASE_URL`. [Source: architecture.md §7.4]
- Como CORS é configurável, instalar `django-cors-headers` no backend e ler origens de `CORS_ALLOWED_ORIGINS` é o caminho esperado.

### Health-check (AC3)

- `GET /api/health/` → `200 OK`. Pode ser uma view DRF `APIView`/`@api_view(['GET'])` retornando `{"status": "ok"}`, sem autenticação e sem acesso a DB (para ser um liveness check honesto). Registrar em `config/urls.py`.
- AC pede explicitamente "o backend sobe e responde a um health-check" — o smoke test da Task 6 cobre isso.

### CI (AC3)

`.github/workflows/ci.yml` com dois jobs (podem ser paralelos):

- **backend:** instalar o `uv` (`astral-sh/setup-uv`) + `uv sync`, `ruff check .`, `pytest`. O `pytest` precisa de um DB alcançável para o Django subir (o health-check em si não toca DB). **Decisão fixada:** usar **Postgres efêmero do runner** via `services: postgres:` no job do GitHub Actions; o `DATABASE_URL` do CI aponta para esse serviço (`postgres://postgres:postgres@localhost:5432/...`, **sem `sslmode=require`** — o serviço não fala SSL; por isso o settings não pode hardcodar `OPTIONS` de SSL). Não depender do Neon no CI — a branch dev do Neon fica reservada para uso local/deploy.
- **Env vars do job de backend (no `ci.yml`, não no `.env.example`):** o GitHub Actions não lê arquivos `.env`. O job precisa exportar via `env:` pelo menos `DJANGO_SETTINGS_MODULE=config.settings.dev`, `SECRET_KEY` (dummy de CI), `ALLOWED_HOSTS=localhost,127.0.0.1` e o `DATABASE_URL` do serviço Postgres. Faltando `SECRET_KEY`/`DJANGO_SETTINGS_MODULE`, o Django nem sobe e `ruff`/`pytest` falham antes de rodar.
- **frontend:** setup Node, `npm ci`, `tsc --noEmit`, `eslint`, `vite build`.
- Qualquer falha (lint, tipo, teste, build) deve falhar o workflow. [Source: architecture.md §7.4]
- **Escopo de CI desta story = só `ruff`+`pytest`+`tsc`+ESLint+`vite build`.** O `ci.yml` será **estendido** na Story 1.2 (import-linter + guardrail de tenant) e 1.4 (geração/diff de `types.gen.ts`). Estruture o arquivo para facilitar essa extensão, mas não adicione esses passos agora. [Source: epics.md Story 1.2, architecture.md §7.4]

### Testing requirements

- Framework backend: **pytest + pytest-django**; `conftest.py` na raiz do `backend/` ativando `@pytest.mark.django_db` por default. Fixtures compartilhadas (`user`, `other_user`, `api_client`, `auth_client`) e a fixture parametrizada de isolamento são da **Story 1.2** — não criar agora. [Source: architecture.md §6.2, §7.4]
- Nesta story, o único teste necessário é o **smoke test do health-check** (garante que `pytest` coleta ≥1 teste e que o app sobe). `pytest` sem testes retorna exit 5 e pode quebrar o CI — por isso o smoke test é obrigatório.
- `factory_boy` por app e `test_isolation.py` chegam na 1.2. [Source: architecture.md §7.4]
- Frontend: não há framework de teste obrigatório nesta story (AC3 só exige `tsc` + ESLint + `vite build`). Não instalar Vitest/Jest a menos que trivial; o épico cita "testes (frontend)" no CI como meta futura.

### Project Structure Notes

Árvore-alvo desta story (subconjunto da §7.1 da arquitetura — apenas o que entra em 1.1; itens marcados `(stub)` são pacotes vazios para fixar a estrutura):

```
hmmb-bujo/
├── README.md
├── docs/                          # vazio por ora (Story 1.3 escreve o padrão temporal)
├── .gitignore
├── .github/workflows/ci.yml
├── backend/
│   ├── manage.py
│   ├── pyproject.toml             # deps + [tool.ruff] + [tool.pytest.ini_options]
│   ├── uv.lock
│   ├── conftest.py                # ativa @pytest.mark.django_db
│   ├── .env.example
│   ├── config/
│   │   ├── settings/{__init__,base,dev,prod}.py
│   │   ├── urls.py                # router /api/ + /api/health/
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── core/                      # (stub) __init__.py + tests/test_health.py
│   │   └── tests/test_health.py
│   └── accounts/                  # (stub) __init__.py  — User model é Story 2.1
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── .eslintrc.cjs
    ├── index.html
    ├── .env.development
    ├── .env.production
    └── src/main.tsx
```

- Alinhar nomes e caminhos **exatamente** à §7.1 da arquitetura (ex.: projeto Django = `config`, settings em `config/settings/`). Não inventar caminhos alternativos.
- `theme.ts`, `src/api/*`, `src/app/*`, `src/features/*` aparecem na §7.1 mas são das Stories **1.5+** — não criá-los agora além de, no máximo, o `src/main.tsx` mínimo que o Vite gera.
- Variância intencional vs §7.1: a árvore completa lista muitos arquivos de domínio; aqui criamos só o esqueleto. Isso é esperado e correto para a primeira story.

### References

- [Source: epics.md#Epic-1: Fundação de Plataforma] — objetivo do épico e gate de qualidade
- [Source: epics.md#Story-1.1] — user story e ACs originais (BDD)
- [Source: architecture.md §2 Stack Definida] — stack (Django+DRF+Neon+React/Vite+MUI+simplejwt)
- [Source: architecture.md §6.1 Nomenclatura] — convenções de nome, UUID PK, migrations nomeadas
- [Source: architecture.md §6.2 Estrutura] — settings split, projeto `config`, conftest
- [Source: architecture.md §6.3 Formatos de Dados & API] — prefixo `/api/`, datas ISO
- [Source: architecture.md §7.1 Árvore do Projeto] — layout do monorepo
- [Source: architecture.md §7.2 Fronteiras] — regra de porta do core, boundary ESLint (1.2/1.5)
- [Source: architecture.md §7.4 Configuração/Build/Testes/Deploy] — django-environ, Neon branches, CORS/base-URL por env, CI (ruff/pytest/import-linter/tsc/ESLint), vite build
- [Source: architecture.md §8.3/§8.4 M-1] — versões cravadas via lockfiles (uv.lock, package-lock)
- [Source: architecture.md §8.4 I-1/I-2] — deploy e logging diferidos (não bloqueiam)
- [Source: architecture.md §8.7 Handoff] — primeira prioridade: scaffold do monorepo

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code — dev-story workflow)

### Debug Log References

- Verificação backend: `manage.py check` → 0 issues; `ruff check .` → limpo; `pytest` → 1 passed; boot real do `runserver` + `curl /api/health/` → `HTTP 200 {"status":"ok"}`. Verificação local usou `DATABASE_URL` sqlite efêmero (settings é agnóstico de engine; CI usa Postgres).
- Verificação frontend: `tsc --noEmit` → 0; `eslint .` → 0; `vite build` → estáticos em `frontend/dist/` sem erro.
- `uv sync --frozen` → lock consistente (17 pacotes); `ci.yml` validado via `yaml.safe_load`.

### Completion Notes List

- **AC1 (scaffold monorepo):** `backend/` Django 5.2 + DRF 3.17 com `manage.py`, `pyproject.toml` (deps + `[tool.ruff]` + `[tool.pytest.ini_options]` cravando `DJANGO_SETTINGS_MODULE=config.settings.dev`) e split `config/settings/{__init__,base,dev,prod}.py` via `django-environ`. `frontend/` Vite 8 + React 19 + TS 5.9 + MUI 6.5, com `package.json`, `tsconfig*.json` e ESLint flat config.
- **AC2 (ambientes dev/prod):** `dev.py`/`prod.py` leem `.env.dev`/`.env.prod` (Neon dev/main, ambos git-ignored) via `environ.Env.read_env`; `.env.example` versionado com todas as chaves. `DATABASES` lido só de `DATABASE_URL` (`env.db()`) — sem hardcode de SSL. CORS (`CORS_ALLOWED_ORIGINS`) e base-URL (`VITE_API_BASE_URL`) configuráveis por env desde o dia 1.
- **AC3 (CI):** `.github/workflows/ci.yml` com job backend (`astral-sh/setup-uv` + `uv sync --frozen` + `ruff` + `pytest`, contra Postgres efêmero do runner, env vars no próprio `ci.yml`, `DATABASE_URL` sem `sslmode`) e job frontend (`npm ci` + `tsc --noEmit` + `eslint` + `vite build`). Qualquer erro falha o workflow. Backend sobe e responde ao health-check; `vite build` gera estáticos.
- **Stubs sem lógica:** `backend/core/` e `backend/accounts/` criados como pacotes vazios (entram em `INSTALLED_APPS` quando ganharem models — Stories 1.2/2.1).
- **Desvios de versão registrados (M-1):** `uv` provisionou **Python 3.13.5** (≥3.12 ok). Template `create-vite@9` gerou **React 19 / Vite 8 / TS 6 / oxlint**; ajustes alinhados à story: mantido React 19 + **MUI `^6.1` (resolveu 6.5.0)** conforme regra "se React 19, usar MUI ≥6.1"; **oxlint substituído por ESLint flat config** (AC3 e arquitetura nomeiam ESLint; regra de boundary da 1.5 é ESLint); **TS fixado em ~5.9** (dentro de "5.3+") para evitar atrito do `typescript-eslint` com TS 6. Versões cravadas em `uv.lock` e `package-lock.json`.
- **Ferramenta de ambiente:** `uv` não estava instalado na máquina — instalado via instalador oficial (`~/.local/bin`, sem sudo).
- Variância vs §7.1: frontend usa `tsconfig.json` com referências (`tsconfig.app.json` + `tsconfig.node.json`, padrão atual do Vite) em vez de um único `tsconfig.json`, e `eslint.config.js` (flat) em vez de `.eslintrc.cjs` — conforme a story manda seguir o que o template gera.

### File List

**Raiz**
- `.gitignore`
- `README.md`
- `docs/.gitkeep`
- `.github/workflows/ci.yml`

**Backend**
- `backend/pyproject.toml`
- `backend/uv.lock`
- `backend/manage.py`
- `backend/conftest.py`
- `backend/.env.example`
- `backend/config/__init__.py`
- `backend/config/urls.py`
- `backend/config/wsgi.py`
- `backend/config/asgi.py`
- `backend/config/settings/__init__.py`
- `backend/config/settings/base.py`
- `backend/config/settings/dev.py`
- `backend/config/settings/prod.py`
- `backend/core/__init__.py`
- `backend/core/views.py`
- `backend/core/tests/__init__.py`
- `backend/core/tests/test_health.py`
- `backend/accounts/__init__.py`

**Frontend**
- `frontend/package.json` (reescrito: MUI/TanStack Query/Axios/ESLint, remoção do oxlint)
- `frontend/package-lock.json`
- `frontend/eslint.config.js` (novo — flat config)
- `frontend/vite.config.ts` (proxy `/api` → backend)
- `frontend/.env.development`
- `frontend/.env.production`
- `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- `frontend/index.html`, `frontend/.gitignore`, `frontend/README.md`
- `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/index.css`
- `frontend/src/assets/*`, `frontend/public/*` (gerados pelo template Vite)
- _Removido:_ `frontend/.oxlintrc.json` (substituído por ESLint)

### Change Log

| Data | Mudança |
|---|---|
| 2026-06-23 | Story 1.1 implementada: scaffold do monorepo (backend Django+DRF / frontend Vite+React+TS+MUI), ambientes dev/prod via django-environ + Neon, health-check `/api/health/`, smoke test, e pipeline de CI base (`ruff`+`pytest`+`tsc`+ESLint+`vite build`). Status → review. |

### Review Findings

_Code review adversarial (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — 2026-06-24. Triagem: 0 decision-needed, 5 patch, 2 defer, 18 dismissed._

- [x] [Review][Patch] Passo "Typecheck (tsc)" do CI era no-op — `npx tsc --noEmit` rodava sobre `tsconfig.json` raiz com `files: []` (só `references`), checando zero arquivos. Corrigido: script `typecheck` → `tsc -b --noEmit` e CI passa a usar `npm run typecheck`. [.github/workflows/ci.yml:82, frontend/package.json]
- [x] [Review][Patch] `frontend/README.md` documentava Oxlint — reescrito para refletir ESLint flat config, scripts reais e a stack do projeto. [frontend/README.md]
- [x] [Review][Patch] Landing page do template Vite enxugada para scaffold mínimo (App.tsx mínimo, index.css reduzido, App.css e assets decorativos `hero.png`/`react.svg`/`vite.svg`/`icons.svg` removidos). MUI/TanStack Query/Axios mantidos como deps (Task 5 manda instalar agora; config é da 1.5). [frontend/src/App.tsx, frontend/src/index.css]
- [x] [Review][Patch] Identidade de projeto preenchida — `<title>hmmb-bujo</title>` e `package.json` name → `hmmb-bujo-frontend`. [frontend/index.html, frontend/package.json]
- [x] [Review][Patch] CI agora dispara em `push` só na `main` + `pull_request`, eliminando runs duplicados em PRs de branch interna. [.github/workflows/ci.yml]
- [x] [Review][Defer] Hardening de produção incompleto — `prod.py` tem cookies `Secure` + `SECURE_PROXY_SSL_HEADER`, mas falta `SECURE_SSL_REDIRECT`/HSTS [backend/config/settings/prod.py] — deferido: deploy/hardening explicitamente fora de escopo (Gap I-1, pré-produção).
- [x] [Review][Defer] CI nunca importa/valida `config.settings.prod` nem roda smoke de `migrate`/`makemigrations --check` [.github/workflows/ci.yml] — deferido: sem models de domínio ainda; revisitar nas Stories 1.2+.
