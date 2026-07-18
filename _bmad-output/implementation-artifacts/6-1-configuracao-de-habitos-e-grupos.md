---
baseline_commit: a44f20cadbe4c5adefe3874bbe329d9db1918484
---
# Story 6.1: Configuração de hábitos e grupos

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero criar e ajustar hábitos organizados em grupos — com peso, tipo e (para numéricos) meta e bonus — podendo desativar e reativar,
Para que eu modele meu sistema de hábitos como faço hoje, com mudanças honestas com o passado (FR-2.1, FR-2.2, FR-2.3, FR-2.5, FR-2.7, FR-2.8, UJ-8).

**Primeira story do Épico 6 (Sistema de Hábitos).** É a fundação de modelagem: cria o app `habits/` do backend do zero e a feature `features/habits/` do frontend do zero. Estabelece o **padrão de versionamento prospectivo** (`habit_versions` com `effective_from`) que as Stories 6.2 (snapshot diário), 6.3 (multiplicador por tipo de dia) e 6.4 (histórico/gráfico) vão consumir. Ordem interna do épico: **config (6.1) → tracker/snapshot (6.2) → multiplicador (6.3) → gráfico (6.4)**.

## Acceptance Criteria

### AC1 — Criar hábito (FR-2.1, FR-2.2, FR-2.3)

**Dado que** estou na tela Configurações > Hábitos,
**Quando** crio um hábito,
**Então** defino nome, emoticon, grupo (de `habit_groups`), tipo (booleano/numérico) e peso inicial; para numérico defino também meta e bonus de completude (%),
**E** o hábito é gravado com identidade (`type` **imutável após a criação**) e a configuração inicial vira a primeira `habit_version` (`weight`, `active=true`, `meta`, `bonus`, `effective_from = hoje`).

### AC2 — Alterar peso/meta/bonus é prospectivo (FR-2.5, NFR-4)

**Dado que** existe um hábito,
**Quando** altero o peso (ou meta/bonus),
**Então** uma nova `habit_version` com `effective_from = hoje` é inserida — a alteração vale a partir do dia corrente, com tooltip **"Alteração válida a partir de hoje. Registros anteriores preservados."**,
**E** dias passados já materializados não são afetados (NFR-4). As versões anteriores nunca são editadas nem removidas.

### AC3 — Desativar e reativar sem deletar (FR-2.7, FR-2.8)

**Dado que** existe um hábito ativo,
**Quando** o desativo,
**Então** uma nova versão `active=false` (com `effective_from = hoje`) é inserida; o hábito some da lista ativa mas permanece no histórico (**nunca é deletado**),
**E** reativar insere versão `active=true`, fazendo-o reaparecer a partir do dia da reativação.

### AC4 — Gerenciar grupos (FR-2.1, UJ-8, título da story) — *derivada: pré-requisito de ponta-a-ponta*

**Dado que** um hábito precisa pertencer a um grupo e a tela abre sem grupos existentes,
**Quando** gerencio grupos na tela Configurações > Hábitos,
**Então** posso criar um grupo (nome) e a lista de hábitos aparece **agrupada por grupo** (cabeçalho com o nome do grupo),
**E** o formulário de criação de hábito oferece os grupos existentes num dropdown; sem grupo não é possível criar hábito.

> **Nota sobre AC4:** as ACs originais de `epics.md` focam nos hábitos e assumem `habit_groups` existente ("grupo (de `habit_groups`)"). O título da story ("hábitos **e grupos**") e o Fluxo 7 de UX exigem que o usuário consiga criar grupos, senão a tela é inoperável no primeiro uso (não há grupo para atribuir). AC4 é o requisito mínimo de gerenciamento de grupo para a feature funcionar de ponta a ponta. Escopo enxuto: **criar + listar grupos** (renomear é bônus; reordenar/multiplicadores ficam para 6.3). Se Hugo preferir grupos pré-semeados em vez de criação manual, é um risco de uma linha a confirmar — a decisão default aqui é **criação manual inline**, coerente com o Fluxo 7.

## Escopo — o que NÃO entra nesta story (limites explícitos)

Para evitar que o dev implemente o épico inteiro de uma vez, estes itens são de stories posteriores e **não devem** ser construídos aqui:

- ❌ **`habit_day_entries` / materialização / `seed_habit_day` / cálculo de completude ponderada / Habit Tracker Row** → **Story 6.2**. Os models de 6.1 (`Habit`, `HabitVersion`) devem ser *projetados* para suportar a materialização de 6.2 (resolução "versão vigente em D"), mas nenhuma linha de `habit_day_entries` é criada nem lida aqui.
- ❌ **`habit_group_day_multipliers`, `user_holidays`, `day_type`, `multiplier_at_time`, `is_workday` para hábitos** → **Story 6.3**.
- ❌ **Histórico por data, gráfico de evolução, anotações de mudança, série on-read** → **Story 6.4**.
- ❌ **Widget de hábitos acoplado ao Daily Log / fluxo da manhã** → **Story 6.2** (a AC final do épico).

O `display_order` em `habit_groups` **pode** ser incluído já no schema (a AD-10 o especifica em `habit_groups (id, user_id, name, display_order)`), mas reordenar grupos pela UI não é requisito de 6.1 — deixe `display_order` com default sequencial e sem UI de reorder.

## Tasks / Subtasks

- [x] **Task 1 — Criar o app Django `habits/` e os models (AC1, AC2, AC3, AC4)**
  - [x] Criar `backend/habits/` espelhando o esqueleto de `braindump/` (`__init__.py`, `apps.py`, `models.py`, `serializers.py`, `services.py` ou pacote `services/`, `views.py`, `urls.py`, `admin.py`, `migrations/`, `tests/`). Ver Dev Notes › "Esqueleto do app".
  - [x] Registrar `"habits"` no bloco `# Local` de `INSTALLED_APPS` em `backend/config/settings/base.py` (após `"braindump"`).
  - [x] `HabitGroup(TenantModel)`: `name` (CharField), `display_order` (PositiveIntegerField, default 0). `Meta.db_table = "habit_groups"`, `ordering = ["display_order", "name"]`.
  - [x] `Habit(TenantModel)`: `name` (CharField), `emoticon` (CharField, curto), `group` (ForeignKey → HabitGroup, `PROTECT`), `type` (CharField + `TextChoices{BOOLEAN,NUMERIC}` + `CheckConstraint`, imutável), `created_at`. `Meta.db_table = "habits"`.
  - [x] `HabitVersion(TenantModel)`: `habit` (ForeignKey → Habit), `weight` (DecimalField), `active` (BooleanField), `meta` (DecimalField null), `bonus` (DecimalField null), `effective_from` (DateField), `created_at`. `Meta.db_table = "habit_versions"`, `ordering = ["habit", "-effective_from", "-created_at"]`. Ver Dev Notes › "Modelo de dados" para tipos/constraints exatos.
  - [x] `makemigrations habits` com `--name` descritivo (ex.: `0001_initial`). Uma migration só.
- [x] **Task 2 — Camada de serviço (AC1, AC2, AC3, AC4)**
  - [x] `create_habit(*, user, name, emoticon, group_id, type, weight, meta=None, bonus=None) -> Habit`: cria `Habit` + primeira `HabitVersion` (`effective_from = today_for(user)`, `active=True`) numa transação. Valida meta/bonus só para numérico (delegar validação de forma ao serializer; regra cruzada de negócio no service).
  - [x] `update_habit_identity(*, user, habit_id, **fields) -> Habit`: atualiza campos de **identidade** (`name`, `emoticon`, `group`) com UPDATE direto — **não** cria versão. Rejeita alteração de `type` (imutável).
  - [x] `add_habit_version(*, user, habit_id, weight=None, meta=None, bonus=None, active=None) -> HabitVersion`: insere nova `HabitVersion` com `effective_from = today_for(user)`, herdando da versão vigente os campos não informados. Usado para mudança de peso/meta/bonus **e** para desativar/reativar (`active`).
  - [x] Helper `current_version_of(habit, on_date) -> HabitVersion`: resolve a versão vigente (`effective_from <= on_date`, maior `effective_from`). Ver Dev Notes › "Resolver versão vigente".
  - [x] `create_habit_group(*, user, name) -> HabitGroup` e `list_habit_groups(*, user)`; `list_habits(*, user, include_inactive=False)`.
- [x] **Task 3 — API DRF + contrato (AC1, AC2, AC3, AC4)**
  - [x] Views finas `APIView` com `@extend_schema`, seguindo `braindump/views.py`. Endpoints (ver Dev Notes › "Superfície de API"):
        `GET/POST /api/habit-groups/`, `PATCH /api/habit-groups/{id}/`;
        `GET/POST /api/habits/`, `PATCH /api/habits/{id}/` (identidade), `POST /api/habits/{id}/versions/` (nova versão / desativar / reativar).
  - [x] Serializers com split leitura/escrita (`ModelSerializer` para saída com `fields` explícito; `Serializer` plano para entrada com `validate`). `HabitSerializer` de saída deve expor a **versão vigente hoje** (weight/active/meta/bonus/effectiveFrom).
  - [x] Wire em `backend/config/urls.py`: `path("api/habits/", include("habits.urls"))` e (se separar grupos) `path("api/habit-groups/", include("habits.urls_groups"))` — OU um único `habits/urls.py` cobrindo ambos os prefixos via um `include` só. Recomendado: um `habits/urls.py` e dois `path(...)` em `config/urls.py`.
  - [x] Regenerar contrato: `manage.py spectacular --file ../schema.yaml` e `npm run generate-types` → commitar `schema.yaml` **e** `frontend/src/api/types.gen.ts` (gate de diff no CI).
- [x] **Task 4 — Feature frontend `features/habits/` (AC1, AC2, AC3, AC4)**
  - [x] Criar `frontend/src/features/habits/` espelhando `features/braindump/`: `api.ts` (hooks TanStack Query), `types.ts` (re-export de `components['schemas'][...]`), `index.ts` (barrel), `components/`.
  - [x] Adicionar seção `habits` em `frontend/src/api/keys.ts` (slot já reservado na linha 33). Ver Dev Notes › "Query keys".
  - [x] Hooks: `useHabitsQuery`, `useHabitGroupsQuery`, `useCreateHabitMutation`, `useUpdateHabitIdentityMutation`, `useAddHabitVersionMutation`, `useCreateHabitGroupMutation`. Escrita = `useMutation` + `invalidateQueries` por prefixo (padrão `RecurringTemplateManager`, não precisa de otimismo aqui).
  - [x] Componente de tela modelado em `features/bujo/components/RecurringTemplateManager.tsx`: lista agrupada por grupo, form inline de criar hábito com **campos condicionais** (meta/bonus só quando tipo=numérico — padrão `ProcessItemDialog.tsx`), edição inline de peso com `Tooltip` exibindo a string exata da AC2, toggle Desativar/Ativar, `Switch` "Mostrar inativos", criação de grupo, empty state "Nenhum hábito neste grupo."
  - [x] Formulários com `useState` controlado + MUI (o projeto **não** tem react-hook-form/formik/zod). Emoticon: campo de texto simples (não há lib de emoji-picker instalada — não adicionar dependência).
- [x] **Task 5 — Rota e navegação (AC4)**
  - [x] Adicionar rota `settings/habits` em `frontend/src/app/router.tsx` com `handle: { title: 'Configurações — Hábitos' }` e a página nova (ex.: `pages/settings/HabitsSettingsPage.tsx`). **Não** usar a rota `/habits` (reservada para o *tracker* da Story 6.2, já registrada no Sidebar/BottomNav).
  - [x] Tornar a página `/settings` (hoje `PlaceholderPage`) um hub mínimo com link para "Hábitos" (ou linkar direto), para que o caminho fique navegável de ponta a ponta.
  - [x] **Não** adicionar filho que usa TanStack Query ao `Sidebar`/`BottomNav` (evita quebrar os 3 testes compartilhados — ver Dev Notes › "Armadilha dos 3 testes"). A tela de config é renderizada no `<Outlet/>`, então não os afeta.
- [x] **Task 6 — Testes backend (todas as ACs)**
  - [x] `habits/tests/factories.py`: `HabitGroupFactory`, `HabitFactory`, `HabitVersionFactory` no padrão `class Params` + `SelfAttribute("user.id")`; chamar `register_isolation_case(...)` para os **três** models. **Não usar `date.today()`** em factories (guardrail AST) — usar datas fixas + `timedelta`.
  - [x] Adicionar `"habits.tests.factories"` a `_ISOLATION_TEST_MODULES` em `backend/conftest.py:19`.
  - [x] `test_models.py`, `test_serializers.py`, `test_services.py`, `test_views.py` cobrindo: criação gera 1ª versão; mudança de peso/meta/bonus **insere** nova versão (versão antiga preservada) com `effective_from=hoje`; desativar/reativar inserem versões; `type` imutável (rejeição); meta/bonus só para numérico; grupo obrigatório; isolamento multi-tenant e fail-closed.
- [x] **Task 7 — Testes frontend (todas as ACs)**
  - [x] `features/habits/api.test.tsx` e testes de componente espelhando `braindump/api.test.tsx` / `BrainDumpCaptureSheet.test.tsx`: mock de `../../api/client` e `useAuth`, wrapper `QueryClientProvider` com `retry:false`, `ThemeProvider theme={createBujoTheme('light')}` se usar variantes de tipografia custom, `jest-axe` sem violações. Assert de endpoint/payload, invalidação, campos condicionais numéricos, tooltip da AC2.
- [x] **Task 8 — Verificação e contrato**
  - [x] Backend verde: `ruff`, `lint-imports` (import-linter — `habits` já está na lista `forbidden_modules` do `core`), `pytest`, `spectacular` + diff de `types.gen.ts`.
  - [x] Frontend verde: `tsc`, ESLint (regra de fronteira de feature), `vitest`, `vite build`. Usar Node ≥ 22.15.1 via `nvm use 22.15.1` (a sessão inicia em v18). **Não** passar `--no-file-parallelism`/`--workers=1` manualmente (agora são default em `vitest.config.ts`/`playwright.config.ts`).
  - [x] Aplicar a migration `habits.0001_initial` às branches Neon dedicadas (`dev`, `e2e`) antes de rodar suítes que batem no banco — lacuna ambiental recorrente quando um app novo entra (ver Dev Notes › "Ambiente").

## Dev Notes

### Contexto de arquitetura — AD-06 (Snapshot de Hábitos) é a decisão-mãe

A story implementa **apenas a camada de configuração prospectiva** de AD-06 (`habit_versions`), não a camada de snapshot realizado (`habit_day_entries`, que é 6.2). AD-06 define duas camadas com papéis distintos [Source: architecture.md#AD-06 linhas 298-300]:

- **`habit_versions` — configuração prospectiva (autoridade de semeadura).** Timeline efetivada por data. **O estado de um hábito no dia D = a versão com `max(effective_from) <= D`.** Mudar peso (UJ-8.2), desativar (FR-2.7) ou reativar (FR-2.8) = **inserir nova versão**. Congela `weight`, `active`, e — para numéricos — `meta` e `bonus`, porque todos afetam a contribuição histórica.
- **`habit_day_entries` — snapshot realizado** (Story 6.2, fora daqui).

Regra de ouro (AD-06 item 6) [Source: architecture.md linhas 310-317]: **mudança de config = INSERT de versão** (prospectivo, `effective_from = hoje`, dias congelados intactos). A edição avulsa de um dia passado (UPDATE numa linha de `habit_day_entries`) **não toca** `habit_versions` — mas isso é 6.2. Em 6.1, **toda** alteração de weight/active/meta/bonus é um INSERT de versão. NFR-4 (imutabilidade sistêmica) honrado: o sistema nunca retroage.

> **Peculiaridade importante — identidade vs. configuração:**
> - **Identidade/cosmético (NÃO versionado, UPDATE direto no `habits`):** `name`, `emoticon`, `group`, `type` (`type` é imutável). Não afetam a contribuição histórica.
> - **Configuração (versionado, INSERT em `habit_versions`):** `weight`, `active`, `meta`, `bonus`. Afetam o cálculo histórico de completude.
>
> Essa separação é o que impede que renomear um hábito "suje" a timeline de config. `group_id` fica em `habits` (não versionado) conforme o schema da AD-06 — a nuance de peso ponderado por grupo é problema da 6.3.

### Padrão temporal canônico (obrigatório) — `effective_from` e `today_for`

`docs/temporal-pattern.md` é a **autoridade de design do Épico 6** [Source: docs/temporal-pattern.md linhas 3, 103]. Pontos que governam esta story:

- **`effective_from` é `DATE`** (página do diário), nunca `TIMESTAMPTZ` [Source: docs/temporal-pattern.md §2 linhas 29-37]. `created_at` (auditoria) é `TIMESTAMPTZ` (via `auto_now_add`).
- **"Hoje" vem SEMPRE de `core.calendar.today_for(user)`** — nenhum código de produção fora de `core/calendar.py` pode chamar `date.today()`/`timezone.now()`/`datetime.now()`/`.utcnow()`. Um guardrail AST (`core/tests/test_guardrails.py`) falha o build se violado — **inclusive em `habits/tests/factories.py`** (não é arquivo `test_*.py`) [Source: docs/temporal-pattern.md §1 linhas 21-23; backend/core/calendar.py].
- Assinatura: `def today_for(user) -> date: return timezone.now().astimezone(ZoneInfo(user.timezone)).date()` [Source: backend/core/calendar.py:14-19]. `user.timezone` existe em `accounts.models.User` (`CharField(max_length=64, default="America/Sao_Paulo")`) [Source: backend/accounts/models.py:12].
- **Convenção de quem resolve "hoje":** os services de `bujo` deixam o **chamador** resolver a data (docstring de `logs.py`), mas `braindump.services`/`migration` chamam `today_for(user)` **dentro** do service. Para 6.1, chame `today_for(user)` **dentro** dos services `create_habit`/`add_habit_version` (é mais simples e o service é a autoridade de cálculo de domínio, §6.8).

### Modelo de dados — schema a criar (net-new; não há precedente de versionamento no código)

**Achado honesto:** não existe hoje nenhum model com `effective_from`/timeline de versões no codebase. `habit_versions` é o **primeiro**. Não há de onde copiar a implementação de versionamento — construa a partir dos primitivos abaixo. Precedentes parciais existem (soft-deactivate via boolean `active` em `RecurringTaskTemplate`; snapshot no instante em `place_template`; linhagem append-forward em `Task`), mas **nenhum** é uma timeline efetivada por data.

Schema de referência (AD-06) — implementar com as convenções do codebase (UUID PK, `TextChoices`+`CheckConstraint`, `db_table` explícito) [Source: architecture.md linhas 321-347]:

```sql
habits (id, user_id, name, emoticon, group_id, type ENUM(boolean, numeric))  -- type imutável
habit_versions (id, habit_id FK, weight NUMERIC, active BOOLEAN, meta NUMERIC NULL, bonus NUMERIC NULL, effective_from DATE)
-- estado em D = versão com max(effective_from <= D)
```

`habit_groups` é formalizado na AD-10 como `(id, user_id, name, display_order)` [Source: architecture.md linhas 599-602].

**Diretrizes de implementação (convenções §6.1):**

- **Todos os três models herdam `core.models.TenantModel`** (UUID PK `id` + `user_id UUIDField(db_index=True)` + managers `objects=TenantManager()` / `all_objects`) [Source: backend/core/models.py:21-43]. Import: `from core.models import TenantModel`.
- **Reconciliação do schema com a convenção do projeto:** a AD-06 desenha `habit_versions` só com `habit_id` (sem `user_id`) e `habit_day_entries` com PK composta. Mas §6.1 exige que **toda tabela tenant indexe `user_id`** e o codebase enforce isolamento por `TenantModel` [Source: architecture.md §6.1 "PKs UUID", "toda tabela tenant indexa user_id"; AD-12]. Portanto: **`HabitVersion` TAMBÉM herda `TenantModel`** (ganha `user_id` denormalizado + auto-scope + cobertura do gate de isolamento). Não usar PK composta — usar o UUID `id` do `TenantModel` e expressar unicidade por `Meta.constraints` (ex.: `UniqueConstraint(fields=["habit", "effective_from"], name="uniq_habit_version_per_day")` para impedir duas versões no mesmo dia — a mudança do dia sobrescreve/atualiza a versão do dia, decisão a validar; ver "Ponto em aberto" abaixo).
- **`type`**: `class Type(models.TextChoices): BOOLEAN="boolean"; NUMERIC="numeric"` + `CheckConstraint` em `Meta.constraints`. **Nunca** ENUM nativo do Postgres [Source: architecture.md §6.1]. Imutável: não expor `type` em serializer de update; se vier, rejeitar.
- **FKs entre models de domínio** são `ForeignKey` normais (`Habit.group`, `HabitVersion.habit`). Só o `user_id` é `UUIDField` cru (não FK), por AD-12. Precedente de FK inter-model: `Task.parent_task`/`source_template` [Source: backend/bujo/models.py].
- **`Habit.group`**: `ForeignKey(HabitGroup, on_delete=models.PROTECT)` — grupo não pode ser deletado com hábitos dentro; e grupos nunca são deletados de fato (coerente com "nunca deletar"). Grupo é **obrigatório** (`null=False`).
- **Numéricos**: `weight`/`meta`/`bonus` como `DecimalField(max_digits=..., decimal_places=...)` (NUMERIC). `meta`/`bonus` são `null=True, blank=True` (só numéricos os usam). `weight` non-null.
- **Timestamps**: `TenantModel` **não** fornece `created_at`/`updated_at` — adicione `created_at = models.DateTimeField(auto_now_add=True)` onde fizer sentido (`Habit`, `HabitVersion`), como `BrainDumpItem` faz [Source: backend/braindump/models.py:25].

Model de referência para espelhar (estrutura, `TextChoices`, `Meta.db_table`, `noqa` de nuláveis) [Source: backend/braindump/models.py:1-30].

### Resolver "versão vigente em D"

Sem código existente; implementar assim (o service é a autoridade):

```python
def current_version_of(habit, on_date):
    return (
        HabitVersion.objects.filter(habit=habit, effective_from__lte=on_date)
        .order_by("-effective_from")
        .first()
    )
```

`HabitVersion.objects` é auto-escopado por tenant (`TenantManager`). O `list_habits` deve resolver a versão vigente **hoje** (`today_for(user)`) para cada hábito e expor no serializer de saída.

### Camada de serviço (§6.2) — regras não-negociáveis

- Lógica em `habits/services.py` (ou pacote `habits/services/`), **funções de módulo, NUNCA classes de serviço** [Source: architecture.md §6.2].
- Assinatura fixa: `def <verbo>_<substantivo>(*, user, ...)` — `user` sempre **primeiro kwarg, keyword-only** [Source: architecture.md §6.2].
- **`@transaction.atomic` decora toda função de escrita**; a view **nunca** abre transação. `create_habit` escreve `Habit` + `HabitVersion` na mesma transação.
- Scoping é implícito: use `Model.objects.get/create/filter` (auto-escopado por `TenantManager`) — **não** passe `user_id` nas queries, **não** use `all_objects` (exceto admin).
- Validação de forma/tipo/enum no serializer; regra de negócio no service. **Só levantar exceções de `core/exceptions.py`** — proibido `ValidationError`/`ValueError` cru no service [Source: architecture.md §6.4/§6.6].
- `type` imutável: em `update_habit_identity`, se `type` for passado, levantar `DomainError` (mapeado a 409) OU (preferível) simplesmente não aceitar `type` no serializer de update (400). Escolha uma e teste.
- `ImmutableSnapshot(DomainError)` já existe e é reservada exatamente para este domínio (AD-06/07), mas ainda não é levantada em produção — em 6.1 não há snapshot congelado para violar (isso é 6.2); use `DomainError` genérico/serializer para as validações desta story [Source: backend/core/exceptions.py:46-47].

Service de referência (idempotência, `*, user`, `@transaction.atomic`, docstring citando §) [Source: backend/braindump/services.py:20-73]. Mapeamento de erro→status: serializer inválido → 400 `{detail, fields}`; `DomainError` → 409; `TenantScopeViolation` → 500 opaco [Source: backend/core/exceptions.py:78-114].

### Superfície de API (§6.1, §6.3) — recomendada

Views finas `APIView` (o codebase **não** usa ViewSet/router) com `@extend_schema(request=..., responses=...)`; `serializer.is_valid(raise_exception=True)` → chama service → serializa resposta [Source: backend/braindump/views.py; backend/bujo/views.py:71-78].

| Método & rota | Ação |
|---|---|
| `GET /api/habit-groups/` | lista grupos (com `displayOrder`) |
| `POST /api/habit-groups/` | cria grupo `{name}` |
| `PATCH /api/habit-groups/{id}/` | renomear grupo (opcional nesta story) |
| `GET /api/habits/` | lista hábitos ativos com a **versão vigente hoje**; `?includeInactive=true` inclui desativados |
| `POST /api/habits/` | cria hábito `{name, emoticon, group, type, weight, meta?, bonus?}` → cria Habit + 1ª versão |
| `PATCH /api/habits/{id}/` | atualiza **identidade** (`name`, `emoticon`, `group`) — sem nova versão |
| `POST /api/habits/{id}/versions/` | insere nova versão `{weight?, meta?, bonus?, active?}` com `effective_from = hoje` — usado para mudança de peso/meta/bonus **e** desativar (`active:false`)/reativar (`active:true`) |

**Por que `versions/` como sub-recurso:** mapeia 1:1 as ACs 2 e 3 (toda mudança de config = inserir versão), torna a semântica de imutabilidade explícita e testável. Não há endpoint de versionamento pré-existente para copiar; esta é uma decisão de design da story — se o dev preferir endpoints `deactivate/reactivate` dedicados, é aceitável **desde que** cada um insira uma versão. Documentar a escolha inline nas Dev Notes do dev.

**Contrato/casing:** JSON camelCase na borda via `djangorestframework-camel-case` (interno snake_case) — serializer fica snake_case, o wire vira camelCase automaticamente [Source: architecture.md §6.3]. Paginação DRF `PageNumberPagination` (page_size 50) para listas [Source: backend/core/pagination.py]. Serializers: split leitura (`ModelSerializer` com `fields=[...]`, nunca `"__all__"`) / escrita (`Serializer` plano com `validate`) [Source: backend/braindump/serializers.py].

**Regeneração de contrato (gate de CI):** `uv run python manage.py spectacular --file ../schema.yaml` (raiz) e `npm run generate-types` (→ `frontend/src/api/types.gen.ts`). O CI regenera e faz `diff`; **commitar ambos** `schema.yaml` e `types.gen.ts` [Source: .github/workflows/ci.yml; frontend/package.json:12].

### Wire de settings/urls

- `INSTALLED_APPS` bloco `# Local`: adicionar `"habits"` após `"braindump"` [Source: backend/config/settings/base.py:32-51].
- `config/urls.py`: adicionar `path("api/habits/", include("habits.urls"))` (e o prefixo `api/habit-groups/` — pode ser servido pelo mesmo `habits/urls.py` se as rotas de grupo forem incluídas via `path("api/habit-groups/", include(...))`) [Source: backend/config/urls.py:9-22].
- `import-linter`: `habits` **já** consta em `forbidden_modules` do contrato "core must not import domain apps" — `core` nunca importa `habits`; `habits` **pode** importar `core`/`accounts`/`bujo` (domínio→domínio é permitido) [Source: backend/pyproject.toml:51-59].

### Frontend — feature `features/habits/`

**Anatomia** (espelhar `features/braindump/`): `api.ts` (hooks), `types.ts` (`import type { components } from '../../api/types.gen'` → `components['schemas']['Habit']` etc.), `index.ts` (barrel expõe só hooks/componentes/types — **feature nunca importa outra feature**), `components/*.tsx` [Source: frontend/src/features/braindump/{api,types,index}.ts; architecture.md §7.1].

**Query keys** — adicionar em `frontend/src/api/keys.ts` (slot reservado na linha 33) [Source: frontend/src/api/keys.ts]:

```ts
habits: {
  list: (params?: { includeInactive?: boolean }) => ['habits', 'list', params ?? {}] as const,
  groups: () => ['habits', 'groups', 'list'] as const,
},
```

Mutations invalidam por prefixo (`queryClient.invalidateQueries({ queryKey: ['habits'] })` ou a chave específica). Chaves `bujo.*` deliberadamente sem `userId` (logout limpa o cache inteiro) — seguir o mesmo (sem `userId` nas chaves de habits).

**Client:** `import client from '../../api/client'` → `client.get/post/patch`. Bodies enviados como estão (camelCase) [Source: frontend/src/api/client.ts; frontend/src/features/bujo/api.ts].

**Tela (a peça central)** — o análogo mais próximo é `features/bujo/components/RecurringTemplateManager.tsx` (lista agrupada + edição inline + toggle ativo + form de criação + empty state + `Switch` "Mostrar inativos") [Source: frontend/src/features/bujo/components/RecurringTemplateManager.tsx]. Reaproveitar:
- **Agrupamento por grupo**: cabeçalho por grupo (a AD-06/UX-DR4 pedem agrupamento). `RecurringTemplateManager` usa `Tabs` por grupo; para hábitos, cabeçalhos de grupo (UX-DR4) são mais fiéis ao Fluxo 7.
- **Campos condicionais** (meta/bonus só quando `type==='numeric'`): padrão `{type === 'numeric' && (<TextField .../>)}` de `ProcessItemDialog.tsx:70-79`.
- **Edição inline de peso + tooltip**: clicar no peso atual → campo inline → salvar; `Tooltip` do `@mui/material` com a string **exata** `"Alteração válida a partir de hoje. Registros anteriores preservados."` (idêntica à AC2 e ao Fluxo 7). Envolver elemento desabilitado em `<span>` se aplicável.
- **Toggle Desativar/Ativar**: um `Button` que chama `addHabitVersion.mutate({ habitId, active: !currentActive })`; linhas inativas com `opacity: 0.6` + sufixo "(inativo)".
- **Criação de grupo**: campo + botão que chama `useCreateHabitGroupMutation`.
- **Formulários**: `useState` controlado + MUI `TextField`/`Select`/`Switch` — **sem lib de formulário** (não existe no projeto). Numérico: `TextField type="number"`; bonus com sufixo "%".
- **Voz (UX-DR13)**: pt-BR direto, **zero gamificação/troféus/sequências/exclamações**. Mensagem de desativação: **"Hábito desativado."** (não "arquivado com sucesso!"). Empty state: "Nenhum hábito neste grupo." Erro inline: "Não foi possível salvar. Tente novamente." [Source: EXPERIENCE.md linhas 109-135, 124, 400].

**Rota/nav** — `frontend/src/app/router.tsx`: adicionar filho `{ path: 'settings/habits', element: <HabitsSettingsPage/>, handle: { title: 'Configurações — Hábitos' } }` (o `handle.title` alimenta o `RouteAnnouncer`, `aria-live`). O `/settings` hoje é `PlaceholderPage` e `/habits` é stub reservado ao **tracker** (6.2) [Source: frontend/src/app/router.tsx:85,113-117]. Fazer `/settings` linkar para Hábitos (hub mínimo) para navegabilidade ponta-a-ponta.

**Tema/tokens**: `createBujoTheme` central; touch targets ≥44px já default em `MuiButton`/`MuiIconButton`; para linhas não-botão, forçar `min-height: 44px` manual [Source: frontend/src/theme.ts:151-152; UX-DR4/UX-DR20].

### UX — Fluxo 7 (fonte autoritativa da tela de config) e UX-DR4

Fluxo 7 (UJ-8) é a especificação literal desta tela [Source: EXPERIENCE.md linhas 647-662]:
1. Configurações > Hábitos mostra hábitos ativos **agrupados por grupo**.
2. "+ Novo hábito" abre **form inline**: Nome; Emoticon (seletor de emoji); Grupo (dropdown); Tipo (toggle Booleano/Numérico); **campos adicionais aparecem após selecionar Numérico**: Meta (ex.: 30 min), Bonus de completude (ex.: 20%); Peso inicial.
3. Salvar → hábito aparece no grupo, **ativo a partir de hoje**.
4. Editar peso: clicar no peso atual, mudar, Salvar → **tooltip "Alteração válida a partir de hoje. Registros anteriores preservados."**.

UX-DR4 (Habit Tracker) é primariamente sobre o *tracker* (6.2), mas fixa o **agrupamento com cabeçalho por grupo** e touch target ≥44px que a tela de config também segue [Source: epics.md:156; EXPERIENCE.md §4.3]. Acessibilidade WCAG 2.2 AA: cor nunca é indicador único; foco preservado; Esc fecha modal; erros de formulário `aria-live="assertive"`; `<main aria-label>` por superfície [Source: EXPERIENCE.md §7 linhas 474-503; UX-DR20].

### Testes

**Backend** [Source: architecture.md §6.2/§7.4; backend/conftest.py; backend/braindump/tests/]:
- Estrutura fixa: `habits/tests/{test_models,test_serializers,test_services,test_views}.py` + `factories.py`.
- `conftest.py` da raiz já dá acesso a DB autouse e fixtures `user`/`other_user`/`api_client`/`auth_client`. Services em teste rodam dentro de `with tenant_context(user):`.
- Factories: `class Params: user = factory.SubFactory(UserFactory)` + `user_id = factory.SelfAttribute("user.id")`; ao final, `register_isolation_case(id=..., model=..., make=lambda: {...})` para **HabitGroup, Habit e HabitVersion** [Source: backend/bujo/tests/factories.py:85-121]. **Adicionar `"habits.tests.factories"` a `_ISOLATION_TEST_MODULES` em `backend/conftest.py:19`** — é assim que o app entra no gate de isolamento parametrizado.
- Gate de isolamento (obrigatório por app): query sem contexto DEVE levantar `TenantScopeViolation` (não retornar vazio). O guardrail de manager (`core/tests/test_guardrails.py`) já percorre todo `TenantModel` e checa `objects=TenantManager` — cobre habits sem wiring extra.
- Casos-âncora de teste (das ACs): (a) criar hábito cria exatamente 1 versão com `active=true`, `effective_from=hoje`; (b) mudar peso insere 2ª versão, 1ª intacta; (c) desativar/reativar inserem versões `active=false/true`; (d) `type` não muda; (e) meta/bonus rejeitados para booleano / aceitos para numérico; (f) grupo obrigatório; (g) isolamento cross-tenant e fail-closed.
- **Não** há `pytest-cov`/threshold configurado — a exigência é a matriz fixa de arquivos de teste + gate de isolamento [Source: backend/pyproject.toml].

**Frontend** [Source: frontend/vitest.config.ts; frontend/src/test-setup.ts; frontend/src/features/braindump/api.test.tsx]:
- vitest + RTL, `fileParallelism: false` (já default). Mock de `../../api/client` (`{default:{get,post,patch,delete: vi.fn()}}`) e de `useAuth`. Wrapper `QueryClientProvider` (`retry:false`), `ThemeProvider theme={createBujoTheme('light')}` se usar variantes de tipografia custom.
- `jest-axe`: `expect(await axe(container)).toHaveNoViolations()`. Sem MSW (mock no módulo do client).

### Armadilha dos 3 testes compartilhados (memória do projeto — CONFIRMADA)

`AppLayout.test.tsx`, `router.test.tsx` e `RouteAnnouncer.test.tsx` renderizam a casca **sem** `QueryClientProvider` e só sobrevivem porque mockam (`vi.mock`) todo filho de nav que usa TanStack Query (ex.: `BrainDumpBadge`). **A tela de config é uma página no `<Outlet/>`, então NÃO afeta esses três testes.** Só quebraria se você adicionasse um filho que usa Query ao `Sidebar`/`BottomNav` (ex.: um badge de completude no item "Hábitos") — nesse caso teria que adicioná-lo às factories de `vi.mock` dos três arquivos. **Recomendação: não adicionar badge Query-driven à nav nesta story** [Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; frontend/src/app/layout/*.test.tsx].

### Ambiente / CI / operação

- **Node ≥ 22.15.1 via nvm**: a sessão inicia em v18 sem `.nvmrc`; rodar `nvm use 22.15.1` antes de todo comando de frontend/e2e [Source: memória `frontend-needs-node-22-via-nvm`].
- **Paralelismo Neon**: `fileParallelism: false` (vitest) e `workers: 1` (playwright) agora são default — **não** passar as flags manualmente (retro Epic 5, item #5) [Source: epic-5-retro-2026-07-17.md §7].
- **Migration em branches Neon dedicadas**: ao introduzir um app novo (`habits.0001_initial`), aplicar a migration às branches `dev` e `e2e` antes de rodar suítes que batem no banco — lacuna ambiental que apareceu 2× no Épico 5 (app `braindump` novo) [Source: epic-5-retro-2026-07-17.md §3, item de ação #6b].
- **Gates de CI** (ordem): `ruff` → `lint-imports` → `pytest` → `spectacular` + diff de `types.gen.ts` (backend); `tsc` → ESLint (fronteira de feature) → `vite build` (frontend). **Vitest não roda no CI** — é rede de segurança local/review [Source: .github/workflows/ci.yml; architecture.md §7.4].
- **Commit ao fim da story**: 1 commit/story; rodar `/bmad-uncommitted-report`, salvar o report, então commitar **sem** pedir "[S]im" [Source: memória `commit-at-end-of-each-story`].

### Inteligência da story anterior (Épico 5 — retrospectiva)

Não há story anterior **neste épico** (6.1 é a primeira). O Épico 6 não depende do Épico 5; mas a retro do Épico 5 (predecessora cronológica) traz padrões diretamente reaproveitáveis [Source: epic-5-retro-2026-07-17.md §6]:
- **Fatia vertical limpa na 1ª story de-risca o resto do épico**: a 5.1 criou app+feature do zero com qualidade e a 5.3 sequer tocou o backend. Investir bem em 6.1 (models + versionamento + padrão de serviço) paga dividendos em 6.2–6.4.
- **Server state derivado via TanStack Query** (badge da 5.2) e **otimismo seletivo na escrita** (`useOptimisticMutation`) generalizam para a completude/tracker da 6.2 — não são necessários em 6.1, mas o padrão de chave/invalidação estabelecido aqui será reusado.
- **Resolver AC ambígua favorecendo leitura literal + código existente + documentar inline** (guardrail institucionalizado) — aplicar às decisões de design não-explícitas desta story (sub-recurso `versions/`, grupo obrigatório, `HabitVersion` como `TenantModel`).
- **Cuidado com "File List" e "contagem de testes"**: nomear no File List também arquivos **modificados** (ex.: `config/urls.py`, `settings/base.py`, `conftest.py`, `keys.ts`, `router.tsx`, `schema.yaml`, `types.gen.ts`), e colar a contagem de testes **depois** de escrever o último teste [Source: epic-5-retro-2026-07-17.md §3, itens #2/#3].
- **Bugs de foco/modal só pegam em E2E real** (caso `autoFocus`/`FocusTrap` da 5.3): se algum campo precisar de foco dentro de modal/drawer, focar via `inputRef` no `onEntered`, não `autoFocus` sozinho [Source: epic-5-retro-2026-07-17.md §7 item #4].

### Ponto em aberto (decidir na implementação, documentar inline)

- **Duas mudanças de config no mesmo dia:** se o usuário muda o peso duas vezes no mesmo dia, isso gera duas `habit_versions` com o mesmo `effective_from`? Recomendação: **uma versão por `(habit, effective_from)`** — a segunda mudança do dia faz UPDATE na versão do dia (ainda "hoje", ainda prospectiva; nenhum dia anterior foi materializado com ela). Expressar via `UniqueConstraint(habit, effective_from)` e `update_or_create` na versão do dia corrente. Isso mantém a timeline limpa e é coerente com "a mudança vale a partir de hoje". Confirmar; se Hugo quiser histórico de todas as edições intra-dia, remover o constraint.

### Project Structure Notes

- **Backend (novo app):** `backend/habits/` — `apps.py` (`class HabitsConfig(AppConfig): default_auto_field="django.db.models.BigAutoField"; name="habits"`), `models.py`, `services.py`(ou `services/`), `serializers.py`, `views.py`, `urls.py`, `admin.py` (usar `all_objects` no admin), `migrations/`, `tests/`. Espelho: `backend/braindump/`.
- **Frontend (nova feature + página):** `frontend/src/features/habits/` (mirror de `features/braindump/`) + `frontend/src/pages/settings/HabitsSettingsPage.tsx` (ou dentro de `features/habits/components/`).
- **Arquivos existentes modificados:** `backend/config/settings/base.py` (INSTALLED_APPS), `backend/config/urls.py` (rotas), `backend/conftest.py` (`_ISOLATION_TEST_MODULES`), `frontend/src/api/keys.ts` (seção habits), `frontend/src/app/router.tsx` (rota settings/habits), `frontend/src/pages/PlaceholderPage.tsx`/`/settings` (hub mínimo), `schema.yaml`, `frontend/src/api/types.gen.ts` (regenerados).
- Alinhamento total com a estrutura unificada (feature-folder isolada, camada de serviço obrigatória, `TenantModel`, query-key factory). Nenhuma variância de estrutura detectada.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.1 linhas 1121-1142] — user story + ACs originais
- [Source: _bmad-output/planning-artifacts/epics.md linhas 284-288, 203, 232, 245] — objetivo do Épico 6, mapeamento FR-2.x/AR-16/UX-DR4
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-06 linhas 290-355] — snapshot de hábitos, `habit_versions`, `habit_day_entries`, schema, casos-âncora
- [Source: _bmad-output/planning-artifacts/architecture.md linhas 599-602] — formalização de `habit_groups` (AD-10)
- [Source: _bmad-output/planning-artifacts/architecture.md §6.1/§6.2/§6.3/§6.4/§6.6/§6.8] — convenções de dados, serviço, API, erros
- [Source: docs/temporal-pattern.md linhas 1-103] — padrão temporal canônico do Épico 6 (`today_for`, DATE vs TIMESTAMPTZ, materialização)
- [Source: backend/core/models.py:21-43] — `TenantModel`
- [Source: backend/core/calendar.py:14-19] — `today_for(user)`
- [Source: backend/core/exceptions.py:29-114] — taxonomia de exceções + handler; `ImmutableSnapshot:46-47`
- [Source: backend/braindump/{models,services,serializers,views,urls}.py] — esqueleto de app de domínio a espelhar
- [Source: backend/bujo/models.py:174-199; backend/bujo/services/recurring.py:19-54] — precedentes de soft-deactivate e snapshot no instante
- [Source: backend/bujo/tests/factories.py:85-121; backend/conftest.py:19] — factories + gate de isolamento
- [Source: backend/config/{urls.py, settings/base.py:32-51}] — wire de rotas/apps
- [Source: backend/pyproject.toml:51-59] — contrato import-linter (`habits` já listado)
- [Source: frontend/src/features/braindump/{api,types,index}.ts] — feature data-layer de referência
- [Source: frontend/src/features/bujo/components/RecurringTemplateManager.tsx] — análogo mais próximo da tela de config
- [Source: frontend/src/api/keys.ts:33] — slot reservado para `habits`
- [Source: frontend/src/app/router.tsx:85,113-117] — rotas stub `/settings` e `/habits`
- [Source: frontend/src/theme.ts:151-152] — touch targets ≥44px
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md linhas 647-662, 220-236, 109-135, 474-503] — Fluxo 7 (config), UX-DR4, voz, a11y
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-17.md §3/§6/§7] — aprendizados aplicáveis
- [Source: memórias do projeto] — `commit-at-end-of-each-story`, `story-language-conventions`, `frontend-needs-node-22-via-nvm`, `sidebar-bottomnav-shared-tests-need-query-mock`, `ask-dont-assume-functionality-flows`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — dev controlado in-session (o modo autônomo tmux do story-automator foi abandonado por hazards de ambiente; ver Debug Log).

### Debug Log References

- **Dev controlado in-session (não tmux autônomo):** o story-automator autônomo foi interrompido antes do dev por 2 problemas de infra: (1) o `ensure-stop-hook` gerou um Stop hook malformado no `.claude/settings.json` (o espaço em "Projetos Pessoais" quebrou o parsing → `Unknown command`), fazendo `monitor-session` estourar timeout; (2) framework global pixel-agents + um prompt fantasma numa sessão-filha. Stop hook corrigido; 6.1 create-story + A2 review-gate (PASS) já tinham rodado. Registrado na memória do projeto.
- **Ponto em aberto resolvido (2 mudanças no mesmo dia):** `UniqueConstraint(habit, effective_from)` + `update_or_create` → uma versão por `(habit, dia)`. Mudança no MESMO dia da criação = UPDATE; INSERT de nova versão (AC2/AC3) ocorre quando a versão vigente é de um dia anterior. Testes cobrem os dois caminhos explicitamente.
- **Colisão de enum no schema:** o campo `type` de hábitos (boolean/numeric) colidia com o `type` (weekly/monthly) de `bujo.ArchiveEntrySerializer` — ambos viravam `TypeEnum`, e o drf-spectacular renomeava com hash instável, poluindo o contrato de bujo. Resolvido com `ENUM_NAME_OVERRIDES` (`HabitTypeEnum` + pin do `TypeEnum`), deixando o diff do schema **puramente aditivo**.
- **Flakiness do Neon na suíte full:** a suíte backend não-escopada travou/erros por 2 causas de ambiente — `test_neondb` órfão de run anterior ("being accessed by other users"; resolvido com terminate+drop) e uma queda transitória de DNS do host Neon no meio do run (Errno 8; recuperou sozinha). O código passou em todo teste que efetivamente rodou.

### Completion Notes List

Fatia vertical completa do Épico 6 (fundação do Sistema de Hábitos):

- **Backend (novo app `habits/`):** `HabitGroup`/`Habit`/`HabitVersion` (todos `TenantModel`; `HabitVersion` também herda para ganhar `user_id` + gate de isolamento), `type` imutável via `TextChoices`+`CheckConstraint`, versionamento prospectivo (`effective_from` DATE), migration `0001_initial`. Camada de serviço (funções de módulo, `*, user`, `@transaction.atomic`, só exceções de `core`). API DRF fina (`APIView` + `@extend_schema`, serializers split leitura/escrita) em `/api/habits/` e `/api/habit-groups/` (mudança de config = `POST .../versions/`). Contrato regenerado (schema.yaml + types.gen.ts, aditivo).
- **Frontend (nova feature `features/habits/` + páginas de settings):** data-layer TanStack Query (queries + mutations com invalidação por prefixo `['habits']`), `HabitsManager` (Fluxo 7: lista agrupada por grupo, form inline com campos condicionais numéricos, edição inline de peso com tooltip exato da AC2, toggle Desativar/Ativar, "Mostrar inativos", criação de grupo, empty states), página `HabitsSettingsPage` + hub `/settings`, rota `settings/habits`.
- **Decisões de design documentadas inline:** (a) sub-recurso `versions/` para toda mudança de config; (b) grupo obrigatório (`PROTECT`); (c) uma versão por `(habit, dia)` via `update_or_create`; (d) tipografia MUI **nativa** (`body2`/`caption`) em vez da custom `body-sm`, evitando a armadilha do `component="div"`; (e) Tooltip da AC2 movido do botão "Editar peso" para o campo de peso em edição (o Tooltip no botão sequestrava o `aria-label`/nome acessível).
- **Voz/a11y (UX-DR13/WCAG):** pt-BR direto, sem gamificação ("Hábito desativado.", "Nenhum hábito neste grupo."); `<main aria-label>` por superfície; jest-axe sem violações; touch targets ≥44px.
- **Escopo respeitado:** nada de `habit_day_entries`/materialização/completude (6.2), multiplicador por tipo de dia (6.3) ou gráfico/histórico (6.4).
- **Gaps de spec:** nenhum novo além do "Ponto em aberto" já previsto na story (resolvido inline). Sem alteração necessária em epics.md/architecture.md/prd.md.

**Gates de verificação:** `ruff` (all passed), `lint-imports` (KEPT — `core` não importa `habits`), `spectacular` (aditivo/idempotente), migration aplicada nos branches Neon `dev` e `e2e`; frontend `tsc` ✓, ESLint ✓, `vite build` ✓, `vitest` full **625 passed (55 arquivos)**. Contagem backend abaixo.

**Backend `pytest` (suíte completa, não-escopada, `--reuse-db`): 467 passed, 0 failed/errors em 1368.60s** (observado após o último teste escrito; run escopado de habits isolado: 48 passed). A suíte precisou de re-execução por flakiness de ambiente (test DB órfão + queda transitória de DNS do Neon), não por falha de teste — todo teste que rodou passou.

### File List

**Backend — novos:**
- `backend/habits/__init__.py`
- `backend/habits/apps.py`
- `backend/habits/models.py`
- `backend/habits/services.py`
- `backend/habits/serializers.py`
- `backend/habits/views.py`
- `backend/habits/urls.py`
- `backend/habits/urls_groups.py`
- `backend/habits/admin.py`
- `backend/habits/migrations/__init__.py`
- `backend/habits/migrations/0001_initial.py`
- `backend/habits/tests/__init__.py`
- `backend/habits/tests/factories.py`
- `backend/habits/tests/test_models.py`
- `backend/habits/tests/test_serializers.py`
- `backend/habits/tests/test_services.py`
- `backend/habits/tests/test_views.py`

**Backend — modificados:**
- `backend/config/settings/base.py` (INSTALLED_APPS `habits` + `SPECTACULAR_SETTINGS.ENUM_NAME_OVERRIDES`)
- `backend/config/urls.py` (rotas `api/habits/` e `api/habit-groups/`)
- `backend/conftest.py` (`habits.tests.factories` em `_ISOLATION_TEST_MODULES`)
- `schema.yaml` (regenerado — aditivo)

**Frontend — novos:**
- `frontend/src/features/habits/api.ts`
- `frontend/src/features/habits/api.test.tsx`
- `frontend/src/features/habits/types.ts`
- `frontend/src/features/habits/index.ts`
- `frontend/src/features/habits/components/HabitsManager.tsx`
- `frontend/src/features/habits/components/HabitsManager.test.tsx`
- `frontend/src/pages/settings/HabitsSettingsPage.tsx`
- `frontend/src/pages/settings/SettingsPage.tsx`

**Frontend — modificados:**
- `frontend/src/api/keys.ts` (seção `habits`)
- `frontend/src/api/types.gen.ts` (regenerado — aditivo)
- `frontend/src/app/router.tsx` (rota `settings/habits` + hub `/settings`)

### Change Log

| Data | Mudança |
|------|---------|
| 2026-07-17 | Story 6.1 implementada: app backend `habits/` (models/serviços/API/testes) + feature frontend `features/habits/` + rota settings/habits. Contrato regenerado (aditivo). |
| 2026-07-17 | Code-review adversarial (story-automator): 0 CRITICAL / 0 HIGH / 0 MEDIUM, 6 achados LOW/nit registrados como follow-ups. Story → **done**. |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (via story-automator-review) · **Data:** 2026-07-17
**Resultado:** ✅ **Approve → done** (0 CRITICAL, 0 HIGH, 0 MEDIUM)

**Verificado:** as 8 tasks marcadas `[x]` estão de fato implementadas (conferidas contra o código-fonte); as 4 ACs estão implementadas (AC1 criar + 1ª versão; AC2 mudança prospectiva de peso/meta/bonus com o **tooltip de string exata**; AC3 desativar/reativar via versão; AC4 grupos + lista agrupada). File List bate exatamente com o git. Contrato **puramente aditivo** (`schema.yaml +351/-0`, `types.gen.ts +329/-0`) — o `ENUM_NAME_OVERRIDES` preservou o contrato de `bujo`. Testes reais e completos (backend: 14 de serviço + 12 de view; frontend: 7 de componente + 7 de hook, incl. jest-axe e assert do tooltip exato).

### Review Follow-ups (AI) — LOW/nit, não bloqueantes

- [ ] [AI-Review][LOW] `list_habits` resolve a versão vigente por hábito → N+1. Aceitável na escala atual; reavaliar (prefetch/subquery) quando a 6.2 ler versões intensamente. [backend/habits/services.py:48]
- [ ] [AI-Review][LOW] Sem limite inferior em `weight`/`meta`/`bonus` (aceita negativo/zero). Não é AC de 6.1; os limites reais dependem da matemática de completude ponderada da 6.2 → **decidir na 6.2** (não assumir bounds agora). [backend/habits/serializers.py]
- [ ] [AI-Review][LOW] Assimetria meta/bonus para booleano: `HabitCreateSerializer` rejeita (400), `HabitVersionCreateSerializer` silenciosamente nula. Inofensivo, mas inconsistente. [backend/habits/serializers.py:101]
- [ ] [AI-Review][LOW] POST vazio em `/versions/` (entre dias) insere versão "fantasma" sem mudança real; poderia aparecer como mudança espúria no histórico da 6.4. Frontend nunca faz isso — robustez de API. [backend/habits/services.py:114]
- [ ] [AI-Review][NIT] Estado local do campo de edição em `HabitRow` pode divergir do valor reformatado do servidor (display usa props frescas — só cosmético). [frontend/src/features/habits/components/HabitsManager.tsx:46]
- [ ] [AI-Review][NIT] `useUpdateHabitIdentityMutation` construído + testado mas não conectado a UI (nenhuma AC exige renomear/editar emoticon); endpoint de renomear grupo entregue mas sem teste. [frontend/src/features/habits/components/HabitsManager.tsx]
