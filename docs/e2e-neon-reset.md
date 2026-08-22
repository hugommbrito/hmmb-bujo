# Runbook — Branch Neon `e2e` (criação e reset)

> **Referenciável por**: Épico 11 (Refinamento do Planner) — Story 11.1 (isolamento de teste).
> **Autoridade de código**: `backend/config/settings/e2e.py`, `backend/bujo/management/commands/purge_e2e_users.py`.
> **Decisões de arquitetura**: §7.1/§7.4 (config por env, branch por ambiente), AD-12 (`user_id` sem FK).

---

## 1. Por que uma branch `e2e` dedicada

A suíte E2E (Playwright) cria e apaga um usuário por teste (`e2e-${uuid}@e2e.test`,
ver `frontend/e2e/fixtures.ts`). Enquanto o backend dos testes apontava para
`config.settings.dev`, essa rotatividade poluía a **branch de dev do Neon** — o
banco onde o app é de fato usado (item #1 de `docs/futureIdeas.md`). A partir da
Story 11.1 os testes escrevem numa **branch Neon `e2e` dedicada**, isolada da
dev, via `config.settings.e2e` + `backend/.env.e2e`.

Mapeamento de branches (ver também `README.md`):

| Branch Neon | Arquivo `.env` | Settings module        | Uso                     |
| ----------- | -------------- | ---------------------- | ----------------------- |
| `main`      | `.env.prod`    | `config.settings.prod` | Produção                |
| `dev`       | `.env.dev`     | `config.settings.dev`  | Desenvolvimento local   |
| `e2e`       | `.env.e2e`     | `config.settings.e2e`  | Suíte E2E (descartável) |

---

## 2. Criar a branch `e2e` no Neon (passo de ops manual)

O dev agent não tem credenciais do Neon; **este passo é manual** e precisa ser
feito uma vez antes de rodar os E2E na nova branch.

**Nuance de copy-on-write (CoW)**: uma branch Neon nasce como cópia CoW do pai.

- Branchar a partir de **dev** copiaria os usuários órfãos junto.
- Branchar a partir de **main** copiaria os dados reais.

Recomendação: nascer de um pai limpo (ou resetar logo após criar). O schema vem
junto por ser CoW; se a branch nascer vazia, aplique as migrações.

**Via console Neon**: New Branch → nome `e2e` → escolher o pai → Create.

**Via `neonctl`**:

```bash
neonctl branches create --name e2e --project-id <PROJECT_ID>
neonctl connection-string e2e --project-id <PROJECT_ID>   # copiar a URL
```

Cole a connection string real em `backend/.env.e2e` (git-ignored) no campo
`DATABASE_URL`. Depois, se a branch nasceu vazia:

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate
```

---

## 3. Resetar a branch `e2e` quando acumular lixo

O reset **não** é automático por run — não há E2E no CI hoje (`.github/workflows/ci.yml`),
então a limpeza é manual, acionada quando a branch incomodar. Duas vias:

### 3a. Via Neon (reset/recriação da branch)

Pelo console: **Reset from parent** (ou apagar e recriar a branch). Via CLI:

```bash
neonctl branches reset e2e --parent --project-id <PROJECT_ID>
```

Rápido e devolve a branch ao estado do pai. Após reset, reaplique migrações se
necessário (§2).

### 3b. Via Django (limpeza cirúrgica dos usuários de teste)

Apaga só os usuários `e2e-*@e2e.test` **e** suas linhas tenant-scoped, sem tocar
no schema — o mesmo comando usado na limpeza one-shot da branch de dev (§5),
apontado para a branch `e2e`:

```bash
cd backend
# Prévia (não apaga nada):
DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py purge_e2e_users --dry-run
# Apaga de fato:
DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py purge_e2e_users
```

⚠️ **Guardrail (AD-12)**: `user_id` é `UUIDField` puro, **não** FK — apagar o
`User` sozinho **não** cascateia. O comando varre cada model tenant-scoped
(`Task`, `Log`, `WeeklyLog`, `MonthlyLog`, `RecurringTaskTemplate`) por
`user_id` via `all_objects` antes de apagar os `User`. Não substitua por um
`User.objects.filter(...).delete()` simples: deixaria centenas de linhas órfãs.

---

## 4. Conexões presas (`pg_terminate_backend`)

Fecha a **ação #7 da retro do Épico 4**: locks de conexão órfã contra o Neon
reapareceram em 4.5/4.6 exigindo intervenção manual. Se um reset/drop da branch
travar com "database is being accessed by other users" (uma conexão idle do
`runserver` ou de um `manage.py shell` anterior ainda presa), encerre as
conexões daquele banco antes de tentar de novo:

```sql
-- Conecte no banco (psql / Neon SQL editor) e rode:
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();      -- não mate a própria sessão
```

Depois repita o reset (§3a) ou a limpeza (§3b). Causa comum: um `runserver`
apontando para `config.settings.e2e` ainda de pé — pare-o antes do reset.

---

## 4b. Ambiente E2E isolado e o banco local oficial

> Acrescentado pela retrospectiva do Épico 13 (2026-07-24); banco local promovido a
> oficial em 2026-07-28 (achado da Story 14.9 — ver seção abaixo).

### O ambiente que o Playwright sobe

`frontend/playwright.config.ts` sobe **dois** servidores dedicados e os derruba no
fim — não reutilize nem mate o seu dev local:

| Papel | Porta | Como sobe |
| ----- | ----- | --------- |
| Frontend E2E | **5173** | `npm run dev -- --mode e2e --strictPort` → lê `frontend/.env.e2e` e **ignora** `.env.development*` |
| Backend E2E | **8000** | `uv run python manage.py runserver 8000` sob `config.settings.e2e` |

⚠️ O dev local do dono roda em **5174/8001**. **Nunca** derrube essas portas para
"liberar" o E2E. Se a suíte falhar **em massa no fixture de signup**, veja as DUAS
hipóteses antes de suspeitar do código da story: (1) vazamento de
`VITE_API_BASE_URL` (frontend falando com o backend errado — checar
`git diff frontend/.env*` e `lsof -i :5173 -i :8000`); (2) latência/cold-start do
banco (ver §4c) — a distinção é: (1) dá erro/dado errado, (2) dá timeout com o
backend saudável (2xx no log).

### Banco OFICIAL: Postgres local `bujo_e2e`

Desde 2026-07-28, `frontend/e2e/backendEnv.ts` **defaulta** `DATABASE_URL` para o
Postgres local `bujo_e2e` (mesmo container `hmmb-test-db` do `docker-compose.yml`
usado pelo `pytest`, banco separado do `hmmb_test`) — nenhum comando extra é
necessário no dia a dia:

```bash
# uma vez (se o container ainda não estiver de pé):
docker compose up -d db

# uma vez: criar o banco dedicado do E2E:
PGPASSWORD=postgres createdb -h localhost -U postgres bujo_e2e

# uma vez por migration nova (obrigatório antes do Playwright):
cd backend
DJANGO_SETTINGS_MODULE=config.settings.e2e \
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bujo_e2e \
  uv run python manage.py migrate

# rodar a suíte normalmente — sem passar DATABASE_URL, o default já aponta pro local:
cd ../frontend
nvm use 22.15.1
CI=1 npx playwright test e2e/<spec>.spec.ts --reporter=line
```

⚠️ **O container roda em tmpfs** (dados em memória, mesma trade-off do `pytest`) —
um restart do container **apaga** `bujo_e2e` por completo. Depois de qualquer
restart do Docker, refaça `createdb` + `migrate` antes do próximo Playwright.

### Fallback opcional: branch `e2e` do Neon

Pra validar contra um Postgres gerenciado real (paridade de infra com produção),
exporte a connection string da branch **antes** de rodar o Playwright — isso
sobrescreve o default local:

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate  # aplica na branch Neon e2e (usa o DATABASE_URL de .env.e2e)

cd ../frontend
DATABASE_URL=<connection-string-da-branch-e2e> \
  npx playwright test e2e/<spec>.spec.ts --reporter=line
```

O `DATABASE_URL` do comando chega ao `runserver` pelo `webServer` do Playwright
(que já espelha `process.env`, ver `backendEnv.ts`) e aos seeds via
`manage.py shell`. Sintoma quando a credencial da branch expira: o `webServer` do
backend não sobe e o Playwright falha antes do primeiro teste
(`authentication failed` no log do Django) — a correção é o passo de ops manual do
§2 (renovar a connection string), o dev agent não tem credenciais do Neon.

### §4c. Por que o Neon deixou de ser o caminho oficial (achado da Story 14.9, 2026-07-28)

Investigando falhas em massa do e2e na 14.9, medimos a branch Neon `e2e`: o
`manage.py runserver` levou **~2 minutos** só para abrir a 1ª conexão Postgres
(muito acima do timeout de 30s do `webServer` do Playwright), e mesmo já "aquecido"
respondeu com **gaps de 8-20s entre requisições** de uma mesma sequência
signup→token→cargas iniciais — todas retornando 200/201 (backend saudável, sem
erro). Como o fixture `signUpAndLandOnToday` (usado por TODO spec) espera `/today`
em 10s, isso derrubava a suíte inteira nesse ponto compartilhado, mascarando
qualquer defeito real das stories. Rodando os mesmos specs contra `bujo_e2e` local
a suíte caiu de ~23min para ~2,5min e o sintoma de "trava no signup" desapareceu
por completo — foi o que motivou promover o banco local a oficial nesta seção.

### Coletores fora do gate

`frontend/e2e/tools/` guarda execuções de **diagnóstico**, não testes: hoje o
inventário de acessibilidade do conteúdo legado (axe sem `exclude: 'main'`, por
faixa — SHELL-DEBT-02). Elas ficam fora da suíte por `testIgnore: ['**/tools/**']`
e rodam sob demanda:

```bash
CI=1 DATABASE_URL=… npx playwright test \
  --config playwright.inventory.config.ts --reporter=line
```

O padrão é **config própria em vez de teste permanentemente `skip`ado** — a suíte
não tem nenhum `skip`/`fixme`. Obrigação por onda (Ondas 3–5): rodar o coletor na
superfície recém-migrada antes de declarar paridade de acessibilidade.

---

## 5. Limpeza one-shot da branch de dev (histórica — Story 11.1 / AC3)

Antes do isolamento, os testes acumularam ~220 usuários órfãos na branch de dev.
Foram removidos uma única vez com o mesmo comando, apontado para dev:

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.dev uv run python manage.py purge_e2e_users --dry-run
DJANGO_SETTINGS_MODULE=config.settings.dev uv run python manage.py purge_e2e_users
```

Após a Story 11.1, novas execuções de E2E não escrevem mais na branch de dev
(a origem passou a ser `e2e`), então esta limpeza não precisa se repetir na dev.

---

## 6. Referências cruzadas

| Referência                                        | Conteúdo                                          |
| ------------------------------------------------- | ------------------------------------------------- |
| `backend/config/settings/e2e.py`                  | Settings module da suíte E2E (lê `.env.e2e`)      |
| `backend/.env.example`                            | Template versionado das três opções de settings  |
| `backend/bujo/management/commands/purge_e2e_users.py` | Comando de limpeza reutilizável (dev e e2e)   |
| `frontend/e2e/backendEnv.ts`                      | Ponto único do `DJANGO_SETTINGS_MODULE` dos E2E   |
| `frontend/playwright.config.ts`                   | webServer (5173/8000), `workers: 1`, `testIgnore` |
| `frontend/playwright.inventory.config.ts`         | Config sob demanda dos coletores de `e2e/tools/`  |
| `frontend/.env.e2e`                               | Env do frontend no modo e2e (isola do dev local)  |
| `docker-compose.yml`                              | Postgres local (`hmmb-test-db`) do fallback §4b   |
| `README.md`                                       | Mapeamento de branches Neon dev/prod/e2e          |
| Épico 4 — retro, ação #7                          | Origem do procedimento de `pg_terminate_backend`  |
| Épico 13 — retro (2026-07-24), §9                 | Origem da seção §4b (ambiente isolado + fallback) |
