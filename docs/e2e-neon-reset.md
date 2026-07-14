# Runbook — Branch Neon `e2e` (criação e reset)

> **Referenciável por**: Épico 11 (Refinamento do Planner) — Story 11.1 (isolamento de teste).
> **Autoridade de código**: `backend/config/settings/e2e.py`, `backend/core/management/commands/purge_e2e_users.py`.
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
| `backend/core/management/commands/purge_e2e_users.py` | Comando de limpeza reutilizável (dev e e2e)   |
| `frontend/e2e/backendEnv.ts`                      | Ponto único do `DJANGO_SETTINGS_MODULE` dos E2E   |
| `frontend/playwright.config.ts`                   | webServer do backend sob `config.settings.e2e`    |
| `README.md`                                       | Mapeamento de branches Neon dev/prod/e2e          |
| Épico 4 — retro, ação #7                          | Origem do procedimento de `pg_terminate_backend`  |
