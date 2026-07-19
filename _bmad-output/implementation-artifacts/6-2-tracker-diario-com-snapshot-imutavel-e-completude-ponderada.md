---
baseline_commit: 83d0266bc64f515515db68b9e664d927b7a3f6b8
---

# Story 6.2: Tracker diário com snapshot imutável e completude ponderada

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero marcar meus hábitos do dia e ver o percentual de completude ponderado,
Para que eu acompanhe minha consistência sem que mudanças futuras alterem o passado (FR-2.4, FR-2.5, FR-2.6, AR-16, UX-DR4).

**Segunda story do Épico 6 (Sistema de Hábitos).** É a **camada de snapshot realizado** de AD-06: cria `habit_day_entries` (a linha por hábito por dia, congelada e editável por dia) e o serviço idempotente `seed_habit_day` que a materializa lendo a timeline de config (`habit_versions`) já construída na Story 6.1. Entrega o **Habit Tracker Row** e a **matemática de completude ponderada** (FR-2.4), acoplando o widget de hábitos ao **fluxo da manhã no Daily Log**. Ordem interna do épico: config (6.1) → **tracker/snapshot (6.2)** → multiplicador por tipo de dia (6.3) → histórico/gráfico (6.4).

## Acceptance Criteria

### AC1 — Materialização ansiosa por dia via `seed_habit_day` (AR-16/AD-06 itens 3-4, FR-2.6)

**Dado que** o dia D é aberto pela primeira vez (o tracker é carregado),
**Quando** `seed_habit_day(*, user, date=D)` roda,
**Então** materializa **uma linha em `habit_day_entries` por hábito ativo em D**, semeando `weight_at_time`/`meta_at_time`/`bonus_at_time` da **versão vigente em D** (`current_version_of(habit, D)`) com `value` nulo,
**E** o serviço é **idempotente**: rodar de novo no mesmo dia **não recria nem sobrescreve** linhas já materializadas (preserva `value` e correções); dias pulados abertos depois são semeados com a versão vigente **naquele dia**, nunca a de hoje.

### AC2 — Habit Tracker Row agrupado com marcação otimista (UX-DR4, FR-2.3)

**Dado que** o Habit Tracker é exibido,
**Quando** renderiza,
**Então** os hábitos aparecem **agrupados por grupo** (cabeçalho com nome do grupo **e percentual ponderado do grupo**), com **percentual total no topo**; **booleano = checkbox**, **numérico = campo numérico + unidade + % da meta** (ex.: "2.500 / 5.000 passos (50%)", "Meta atingida" quando `value ≥ meta`), com **touch target ≥ 44px** (linha inteira tappável), **sem troféus nem indicadores de sequência**,
**E** marcar/registrar um hábito grava em `value` com **resposta otimista** (UI atualiza antes do servidor; rollback com erro inline "Não foi possível salvar. Tente novamente." em caso de falha).

### AC3 — Completude ponderada + edição avulsa que não sangra (FR-2.4, FR-2.5, AD-06 itens 5-6)

**Dado que** a completude do dia é calculada,
**Quando** roda,
**Então** segue `Σ(contribuição × weight_at_time) / Σ(weight_at_time)` sobre as linhas de `habit_day_entries` do dia — **booleano não-marcado = 0 e conta no denominador**; **inativo = sem linha, fora do denominador**; contribuição do numérico conforme FR-2.4 (ver Dev Notes › "Matemática de completude"),
**E** **corrigir o `value` ou o `weight_at_time` de um dia passado é UPDATE só naquela única linha** (não sangra para dias vizinhos, não toca `habit_versions`), e o **widget do tracker é acoplado ao fluxo da manhã no Daily Log**.

> **Decisão pendente única — campo `unit` (unidade do numérico).** As ACs/UX exigem exibir a unidade do hábito numérico ("2.500 / 5.000 **passos**", "min"), mas a Story 6.1 **não** criou campo `unit` em `Habit` (só `name`, `emoticon`, `group`, `type`; nenhum FR menciona unidade). **Default recomendado (buildável de ponta-a-ponta):** adicionar `unit` como campo de **identidade** (não versionado, `CharField(blank=True)`) em `Habit` nesta migration 0002, expor em criar/editar hábito, oferecer um input opcional de unidade no ramo numérico do form já existente (`HabitsManager`, superfície da 6.1) e exibir na linha do tracker. **Se Hugo vetar** (manter 6.2 mais enxuta): a linha numérica exibe "2.500 / 5.000 (50%)" **sem** unidade e o campo/form não são adicionados. Coerente com o guardrail da retro do Épico 5 (resolver AC ambígua favorecendo leitura literal + código existente + documentar inline).

## Escopo — o que NÃO entra nesta story (limites explícitos)

Para evitar que o dev implemente o épico inteiro, estes itens são de stories posteriores e **não devem** ser construídos aqui:

- ❌ **`habit_group_day_multipliers`, `user_holidays`, `day_type`, `multiplier_at_time`, `is_workday` para hábitos, `peso_efetivo = weight × multiplier`** → **Story 6.3**. O model `HabitDayEntry` de 6.2 **deve ser projetado** para que a 6.3 acrescente as colunas `day_type` + `multiplier_at_time` (nova migration 0003), mas em 6.2 o numerador/denominador usa **apenas `weight_at_time`** (multiplicador implícito = 1.0). Não criar essas colunas agora.
- ❌ **Seletor de data / navegação por histórico / gráfico de evolução / lacunas honestas / anotações de mudança / série on-read** → **Story 6.4**. O **mecanismo** de backend de 6.2 (snapshot por dia + UPDATE de uma linha sem sangrar) é pré-requisito da 6.4 e **é testado aqui**, mas a **UI de navegar dias passados** é da 6.4. Em 6.2 o widget e a superfície `/habits` mostram **o dia de hoje**.
- ❌ **Alterar peso/meta/bonus/ativação prospectivamente (INSERT de `habit_version`)** → já entregue na **Story 6.1** (`add_habit_version`). 6.2 **lê** a timeline via `current_version_of`; **não** cria versões. Distinção crítica: mudar config = INSERT de versão (6.1, prospectivo); corrigir um dia = UPDATE numa linha de `habit_day_entries` (6.2, avulso, não sangra) — ver Dev Notes › AD-06 item 6.
- ❌ Migração de dados, cron/job de fundo, celebrações/streaks/ranking (fora da voz do produto, UX-DR13).

## Tasks / Subtasks

- [x] **Task 1 — Model `HabitDayEntry` (habit_day_entries) + migration 0002 (AC1, AC3)**
  - [x] Em `backend/habits/models.py`, adicionar `HabitDayEntry(TenantModel)` espelhando `HabitVersion`: `habit = ForeignKey(Habit, on_delete=CASCADE, related_name="day_entries")`; `date = DateField()`; `value = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)` (nulo = não-feito; booleano marcado = `1`); `weight_at_time = DecimalField(max_digits=6, decimal_places=2)`; `meta_at_time = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)`; `bonus_at_time = DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)` (os três `*_at_time` **espelham exatamente** as escalas de `HabitVersion.weight`/`meta`/`bonus` da 6.1 — `backend/habits/models.py:74-78`); `created_at = DateTimeField(auto_now_add=True)`. Ver Dev Notes › "Modelo de dados".
  - [x] `Meta.db_table = "habit_day_entries"`; `ordering = ["date", "habit"]`; `constraints = [UniqueConstraint(fields=["habit", "date"], name="uniq_habit_day_entry_per_day")]` (uma linha por hábito por dia — **não** usar PK composta; UUID `id` do `TenantModel` + constraint, exatamente como a 6.1 resolveu para `habit_versions`).
  - [x] **(Se `unit` aprovado)** adicionar `unit = models.CharField(max_length=32, blank=True)` a **`Habit`** (identidade, não versionado). Ver "Decisão pendente única".
  - [x] `makemigrations habits --name habit_day_entry` → **`0002_*.py`** com `dependencies = [("habits", "0001_initial")]`. Uma migration só (inclui `unit` em `Habit` se aprovado).
- [x] **Task 2 — Serviço `seed_habit_day` + matemática de completude (AC1, AC3)**
  - [x] `seed_habit_day(*, user, date) -> None` em `backend/habits/services.py` (função de módulo, `@transaction.atomic`). **Gap-fill idempotente**: para cada hábito cujo `current_version_of(habit, date)` existe **e** está `active`, e que **ainda não tem** linha em `(habit, date)`, criar `HabitDayEntry` semeando `weight_at_time`/`meta_at_time`/`bonus_at_time` da versão vigente em `date`, `value=None`. **Nunca** sobrescrever linhas existentes. Ver Dev Notes › "seed_habit_day".
  - [x] Função de domínio de cálculo (§6.8, no serviço): `compute_day_completeness(*, user, date)` (ou puro `_contribution(entry, habit_type)` + agregador) que retorna `total` e por-grupo, seguindo **exatamente** a fórmula da Dev Notes › "Matemática de completude". Booleano não-marcado = 0 no numerador, peso conta no denominador; inativo não tem linha.
  - [x] `update_habit_day_entry(*, user, entry_id, value=<sentinela>, weight_at_time=None, meta_at_time=None, bonus_at_time=None) -> HabitDayEntry` (`@transaction.atomic`): UPDATE **só naquela linha** (marcar/desmarcar `value`; correção avulsa de dia passado). Não toca `habit_versions` nem outras linhas.
- [x] **Task 3 — API DRF + contrato (AC1, AC2, AC3)**
  - [x] `GET /api/habits/days/?date=YYYY-MM-DD` (default `today_for(user)`): chama `seed_habit_day(user, date)` (idempotente) → retorna `{ date, totalCompletion, groups: [{id, name, completion}], entries: [...] }`. Ver Dev Notes › "Superfície de API".
  - [x] `PATCH /api/habits/days/{id}/` → `update_habit_day_entry` (marcação de `value` e correção avulsa de `weightAtTime`/`metaAtTime`/`bonusAtTime`).
  - [x] Serializers em `habits/serializers.py`: read (`ModelSerializer` com `fields` explícito, expondo identidade do hábito — `name`/`emoticon`/`type`/`group`/`unit?` — + `value`/`weightAtTime`/`metaAtTime`/`bonusAtTime`) e write plano (`value` opcional `allow_null=True`; `weightAtTime`/`metaAtTime`/`bonusAtTime` opcionais). Split leitura/escrita como na 6.1.
  - [x] Views finas `APIView` + `@extend_schema`, novas rotas em `habits/urls.py` (`days/` e `days/<uuid:pk>/`). **Nenhuma** mudança em `config/urls.py` (mesmo prefixo `/api/habits/`).
  - [x] Regenerar contrato: `uv run python manage.py spectacular --file ../schema.yaml` + `npm run generate-types` → commitar `schema.yaml` **e** `frontend/src/api/types.gen.ts` (gate de diff no CI). Verificar que o diff é **aditivo** (novos schemas `HabitDayEntry*`; se `unit` entrar, `Habit`/`HabitCreate` ganham `unit`).
- [x] **Task 4 — Feature frontend: hooks + Habit Tracker (AC2, AC3)**
  - [x] `frontend/src/api/keys.ts` seção `habits`: adicionar `day: (date?: string) => ['habits', 'day', date ?? 'today'] as const` (sem `userId`, coerente com o resto de `habits.*`).
  - [x] `features/habits/api.ts`: `useHabitDayQuery(date?)` (GET `days/`, key `keys.habits.day(date)`); `useMarkHabitEntryMutation(date?)` **otimista** via `useOptimisticMutation` (chave `keys.habits.day(date)`, `updater` atualiza a `entry` no cache), espelhando `useTransitionTaskMutation` de `features/bujo/api.ts:50-64`. `types.ts`/`index.ts`: re-exportar os novos tipos (`components['schemas']['HabitDayEntry']` etc.) e o componente.
  - [x] `features/habits/components/HabitTracker.tsx`: percentual total no topo; grupos com cabeçalho (nome + % ponderado do grupo, vindos de `groups[]` do payload) reusando o padrão `GroupSection`/`HabitRow` de `HabitsManager.tsx`; **booleano = `Checkbox`** (marcar → `value:1`, desmarcar → `value:null`), **numérico = `TextField type="number"` + unidade + "X / meta unit (Y%)"** / "Meta atingida"; `minHeight:44`, linha inteira ativa o input; erro inline `role="alert"` com `SAVE_ERROR`. Reusar `DayHeader` (`pages/daily/DayHeader.tsx`) se quiser seção colapsável titulada "Hábitos".
  - [x] **(Se `unit` aprovado)** adicionar input opcional de unidade no ramo `isNumeric` do form de criar/editar hábito em `HabitsManager.tsx` (superfície 6.1) e mapear em `useCreateHabitMutation`/`useUpdateHabitIdentityMutation`.
- [x] **Task 5 — Rota `/habits` + acoplamento ao Daily Log (AC2, AC3)**
  - [x] Substituir o stub `PlaceholderPage` de `/habits` em `frontend/src/app/router.tsx:87` por uma `HabitsPage` (nova, ex.: `pages/habits/HabitsPage.tsx`) que renderiza `<HabitTracker date=hoje/>` com `<main aria-label>`. **Não** mexer no item de nav (`Sidebar.tsx:68` / `BottomNav.tsx` já apontam para `/habits` com `RepeatIcon`).
  - [x] **Acoplar ao fluxo da manhã:** compor `useHabitDayQuery` em `pages/daily/useDailyData.ts` (o ponto de composição documentado; hoje retorna só `{ todayLog }`) e montar `<HabitTracker>` em `pages/daily/DailyPage.tsx` **dentro do `<Box component="main">`, após o cluster de banners** (bloco today-only, ~linha 93). Widget mostra **hoje** (histórico por data = 6.4).
  - [x] **NÃO** adicionar filho que usa TanStack Query ao `Sidebar`/`BottomNav` (ex.: badge de completude) — quebraria os 3 testes compartilhados. Ver Dev Notes › "Armadilha dos 3 testes".
- [x] **Task 6 — Testes backend (todas as ACs)**
  - [x] `habits/tests/factories.py`: `HabitDayEntryFactory` no padrão `class Params` + `SelfAttribute("user.id")` (datas fixas + `timedelta`, **nunca** `date.today()` — guardrail AST) e `register_isolation_case(id="habits.HabitDayEntry", model=..., make=lambda: {...})`. **`conftest.py` já lista `habits.tests.factories`** — nenhuma edição de conftest necessária.
  - [x] `test_models/serializers/services/views.py` cobrindo: (a) seed cria 1 linha por ativo em D com `value` nulo e `*_at_time` da versão vigente em D; (b) **idempotência**: 2º seed no mesmo dia não recria/sobrescreve (preserva `value` editado); (c) **dia pulado** semeia com a versão vigente **naquele dia** (não a de hoje); (d) inativo em D → sem linha; (e) matemática de completude: booleano feito/não-feito, numérico parcial / meta atingida / com bonus, ponderação por peso, % por grupo, denominador; (f) **não-sangramento**: UPDATE de `value`/`weight_at_time` de um dia altera só aquela linha, vizinhos intactos, `habit_versions` intacto; (g) isolamento multi-tenant e fail-closed.
- [x] **Task 7 — Testes frontend (AC2, AC3)**
  - [x] `features/habits/api.test.tsx`: casos do `useMarkHabitEntryMutation` espelhando os 3 testes otimistas de `braindump/api.test.tsx` (payload+invalidação; atualização otimista **antes** do servidor com Promise deferida; **rollback** em erro). Harness = `QueryClientProvider` (`retry:false`) + mock de `../../api/client` (sem `useAuth`, sem ThemeProvider/axe — é teste de hook).
  - [x] Teste de **componente** de `HabitTracker` (com `ThemeProvider theme={createBujoTheme('light')}` + `jest-axe`): checkbox booleano marca (otimista), numérico exibe "X / meta unit (Y%)"/"Meta atingida", cabeçalho de grupo com %, total no topo, sem violações a11y.
- [x] **Task 8 — Verificação e contrato**
  - [x] Backend verde: `ruff`, `lint-imports` (`core` não importa `habits`; **não** importar `habits` de `bujo` — ver Dev Notes › "Gatilho de seed"), `pytest` (escopado a `habits` + suíte relevante), `spectacular` + diff de `types.gen.ts` (aditivo).
  - [x] Frontend verde: `tsc`, ESLint (fronteira de feature), `vitest`, `vite build`. **`nvm use 22.15.1`** antes de todo comando de frontend/e2e (sessão inicia em v18). **Não** passar `--no-file-parallelism`/`--workers=1` (já default).
  - [x] **Aplicar `habits.0002_*` às branches Neon `dev` e `e2e`** antes de rodar suítes que batem no banco (lacuna ambiental recorrente ao evoluir schema — Épico 5).

## Dev Notes

### Contexto de arquitetura — AD-06 (Snapshot de Hábitos): a 6.2 é a camada realizada

A 6.1 entregou **`habit_versions` (config prospectiva)**. A 6.2 entrega **`habit_day_entries` (snapshot realizado, congelado e editável por dia)** — a fonte de verdade do que aconteceu no dia [Source: architecture.md#AD-06 linhas 298-300, 337-347]. As duas camadas nunca se confundem (AD-06 item 6) [Source: architecture.md linhas 310-317]:

| Ação | Mecanismo | Story | Sangra? |
|---|---|---|---|
| Mudar peso/meta/bonus/ativação "a partir de hoje" | INSERT `habit_version` (`effective_from = hoje`) | **6.1** (`add_habit_version`) | ❌ dias congelados intactos |
| Corrigir `value`/`weight_at_time` de um dia passado avulso | UPDATE **só naquela linha** de `habit_day_entries` | **6.2** (`update_habit_day_entry`) | ❌ só aquele dia recalcula |

A edição avulsa **não toca** `habit_versions` — a timeline de config permanece limpa; só a completude daquele dia muda. NFR-4 honrado: o sistema nunca retroage, o usuário edita o que quiser [Source: architecture.md#AD-06 item 6 linha 317].

**Semântica da ausência (binária, sem terceiro estado)** [Source: architecture.md#AD-06 item 5 linhas 306-308]:
- Hábito **ativo** sem valor → "não feito": contribui **0%**, **conta no denominador** (booleano não-marcado = 0; numérico sem valor = 0% da meta).
- Hábito **inativo** → "não aplicável": **não tem linha** no dia, **fora do denominador**.

### Padrão temporal canônico (obrigatório) — materialização ansiosa

`docs/temporal-pattern.md` é a autoridade temporal do Épico 6 [Source: docs/temporal-pattern.md linhas 3, 103]:
- **`date` de `habit_day_entries` é `DATE`** (página do diário), nunca `TIMESTAMPTZ`; `created_at` (auditoria) é `TIMESTAMPTZ` via `auto_now_add` [Source: docs/temporal-pattern.md §2 linhas 29-37].
- **"Hoje" vem SEMPRE de `core.calendar.today_for(user)`** — proibido `date.today()`/`timezone.now()` fora de `core/calendar.py`; guardrail AST falha o build (inclusive em `habits/tests/factories.py`, que não é `test_*.py`) [Source: docs/temporal-pattern.md §1 linhas 21-23; backend/core/calendar.py:14-19].
- **Materialização ansiosa idempotente na 1ª abertura do dia** (sem cron/job de fundo), coerente com o "congela na abertura" do AD-04 [Source: docs/temporal-pattern.md §5 linhas 58-65; architecture.md#AD-06 item 3 linha 302]. `seed_habit_day` resolve a **versão vigente em D**, então dias pulados abertos depois recebem a config **daquele dia**, não a de hoje — é isto que torna FR-2.6 literalmente correto.

### Modelo de dados — `HabitDayEntry` (net-new, espelha `HabitVersion`)

Herdar **`core.models.TenantModel`** (UUID PK `id` + `user_id UUIDField(db_index=True)` + `objects=TenantManager()`/`all_objects`; `save()` auto-preenche `user_id` do contexto e falha fechado sem contexto) [Source: backend/core/models.py:21-43]. Schema-alvo AD-06 [Source: architecture.md linhas 337-347]:

```sql
habit_day_entries (
  id, user_id, habit_id FK → habits,
  date            DATE,
  value           NUMERIC NULL,   -- nulo = não-feito; booleano marcado = 1
  weight_at_time  NUMERIC,        -- congelado e editável por dia
  meta_at_time    NUMERIC NULL,
  bonus_at_time   NUMERIC NULL
)
-- UNIQUE (habit_id, date); materializado na 1ª abertura, 1 linha por hábito ativo em D
```

**Reconciliação com a convenção do projeto (como a 6.1 fez para `habit_versions`):** a AD-06 desenha PK composta `(user_id, habit_id, date)`; o projeto exige UUID PK + `user_id` indexado em toda tabela tenant (§6.1/AD-12). Portanto **`HabitDayEntry` herda `TenantModel`** (UUID `id`) e expressa unicidade por `UniqueConstraint(fields=["habit", "date"], name="uniq_habit_day_entry_per_day")` — **não** PK composta [Source: backend/habits/models.py:63-90 (precedente `HabitVersion`); architecture.md §6.1]. `DecimalField` (NUMERIC) para `value`/`weight_at_time`/`meta_at_time`/`bonus_at_time`; `meta_at_time`/`bonus_at_time` `null=True` (só numéricos usam). `CheckConstraint` usa `condition=` (Django 5.2) se preciso.

> **Projetar para 6.3:** a 6.3 acrescentará `day_type` + `multiplier_at_time` a esta tabela (`peso_efetivo = weight_at_time × multiplier_at_time`). **Não** criar essas colunas agora; só garantir que o cálculo de completude de 6.2 isole `weight_at_time` de forma que a 6.3 possa multiplicá-lo sem reescrever a fórmula [Source: architecture.md#AD-06; epics.md#Story-6.3 linhas 1180-1183].

Herança de campos entre models de domínio: `ForeignKey` normal (`HabitDayEntry.habit`, `on_delete=CASCADE` como `HabitVersion.habit`); só `user_id` é `UUIDField` cru (AD-12) [Source: backend/habits/models.py:73].

### `seed_habit_day` — materialização gap-fill idempotente

```python
@transaction.atomic
def seed_habit_day(*, user, date) -> None:
    """Materializa (idempotente) as linhas de habit_day_entries do dia `date`.
    Gap-fill: só cria linhas que faltam; NUNCA sobrescreve linhas existentes
    (preserva value editado e correções avulsas). `date` já vem resolvido pelo
    chamador (ver `list_habits`/`create_habit` que usam today_for(user))."""
    existentes = set(
        HabitDayEntry.objects.filter(date=date).values_list("habit_id", flat=True)
    )
    for habit in Habit.objects.select_related("group"):
        if habit.id in existentes:
            continue
        version = current_version_of(habit, date)     # já existe (6.1), auto-escopado
        if version is None or not version.active:
            continue                                    # inativo/inexistente em D → fora
        HabitDayEntry.objects.create(
            habit=habit, date=date, value=None,
            weight_at_time=version.weight,
            meta_at_time=version.meta, bonus_at_time=version.bonus,
        )
```

**Por que gap-fill (e não "materializa tudo só na 1ª vez"):** nunca tocar linhas existentes preserva `value`/correções (imutabilidade do que já aconteceu). Efeitos corretos e testáveis: (1) **dias passados são imunes a hábitos novos** — um hábito criado hoje tem `effective_from = hoje > D`, logo `current_version_of(habit, D)` retorna `None` e ele não entra em D; (2) **só o dia corrente** pode ganhar um hábito criado hoje mais cedo (comportamento honesto com o presente); (3) reativação (FR-2.8) só entra no denominador de dias abertos a partir da reativação. `current_version_of` já é auto-escopado por tenant e já existe [Source: backend/habits/services.py:21-30]. Ordem `today_for(user)` só se o chamador não resolveu a data (a view resolve).

### Matemática de completude (FR-2.4) — a parte de maior risco, seja literal

**Duas porcentagens DISTINTAS — não confundir:**

1. **"% da meta" (exibição na linha numérica)** = `value / meta_at_time` (progresso cru). Ex.: `2500/5000 = 50%` → "2.500 / 5.000 passos (50%)". Quando `value ≥ meta` → rótulo "Meta atingida". Cálculo trivial, pode ficar no frontend (converter as strings decimais para número).
2. **Contribuição para a completude ponderada (FR-2.4)** — **domínio, no serviço** (§6.8). Por hábito:

```
booleano:  contribuicao = 1        se value == 1   senão 0        (value nulo/0 = 0)
numérico:  se value is None ou meta_at_time in (None, 0):  contribuicao = 0
           elif value >= meta_at_time:                     contribuicao = 1   # bonus: atingiu a meta
           else:  contribuicao = (value / meta_at_time) * (1 - bonus_at_time/100)
```

> O **bonus** é o salto discreto por *atingir* a meta: proporcional de 0% até **(100% − bonus%)** ao aproximar-se da meta, e **100%** ao atingi-la [Source: epics.md#FR-2.4 linha 56]. Ex.: meta=5000, bonus=20%, value=2500 → `(2500/5000)*(1-0.20) = 0.40`; value=4999 → `0.79984`; value=5000 → `1.00` (ganha o bonus). Clamp: `value > meta` → 1.0.

**Completude do dia (e por grupo):**
```
completude = Σ(contribuicao_i × weight_at_time_i) / Σ(weight_at_time_i)   sobre as linhas do dia
```
- Denominador = **todas as linhas de `habit_day_entries` do dia** (fonte única na leitura, sem fallback para versão) [Source: architecture.md#AD-06 item 4 linha 304].
- **% do grupo** = mesma fórmula restrita às linhas cujo `habit.group` = grupo.
- Guardas: `Σ weight == 0` (dia sem linhas / só peso zero) → retornar `0` (ou "—"); nunca dividir por zero.
- **Exemplo âncora de teste:** H1 booleano peso 1 feito (contrib 1) + H2 numérico peso 2, value 2500/meta 5000/bonus 20% (contrib 0.4) → `(1×1 + 0.4×2)/(1+2) = 1.8/3 = 60%`.

`weight`/`meta`/`bonus` chegam da 6.1 como `DecimalField` (NUMERIC) e **viajam no wire como strings decimais** [Source: frontend/src/api/types.gen.ts:600-617]. Fazer a matemática ponderada em `Decimal` no backend e **expor os percentuais já calculados** no payload (evita matemática de string decimal no frontend). Só o "% da meta" simples fica no cliente.

### Camada de serviço (§6.2) — regras não-negociáveis (idênticas à 6.1)

- Lógica em `habits/services.py`, **funções de módulo, NUNCA classes** [Source: architecture.md §6.2; backend/habits/services.py].
- Assinatura fixa `def <verbo>_<substantivo>(*, user, ...)` — `user` primeiro kwarg keyword-only. Exceção já existente e intencional: `current_version_of(habit, on_date)` **não** tem `user` (é helper interno, auto-escopado) [Source: backend/habits/services.py:21].
- `@transaction.atomic` em toda função de escrita (`seed_habit_day`, `update_habit_day_entry`); a view **nunca** abre transação.
- Scoping implícito via `TenantManager` — **não** passar `user_id` em query, **não** usar `all_objects` (exceto admin) [Source: backend/core/models.py:29-30; core/tenant.py].
- **Só exceções de `core/exceptions.py`** — proibido `ValidationError`/`ValueError` cru no serviço. `ImmutableSnapshot(DomainError)` existe e é reservada a este domínio (AD-06/07), mapeada a **409** [Source: backend/core/exceptions.py:46-47, 78-114]. **Nota:** em 6.2 a marcação e a correção avulsa de um dia são **permitidas** (é o propósito do AD-06 item 6) — **não** levantar `ImmutableSnapshot` para edição legítima de `value`/`*_at_time`. Reservá-la só se um cliente tentar mutar a identidade do snapshot (trocar `habit`/`date` de uma linha materializada) — validar isso no serializer (não aceitar `habit`/`date` no PATCH) é suficiente (400). Erro→status: serializer inválido → 400 `{detail, fields}`; `DomainError` → 409; `TenantScopeViolation` → 500 opaco [Source: backend/core/exceptions.py:78-114].

### Superfície de API (§6.1/§6.3) — recomendada

Views finas `APIView` + `@extend_schema` (o codebase **não** usa ViewSet/router); `serializer.is_valid(raise_exception=True)` → serviço → serializa [Source: backend/habits/views.py; backend/braindump/views.py].

| Método & rota | Ação |
|---|---|
| `GET /api/habits/days/?date=YYYY-MM-DD` | `seed_habit_day` (idempotente) + retorna o tracker do dia (default = hoje) |
| `PATCH /api/habits/days/{id}/` | `update_habit_day_entry` — marcar `value` **e** correção avulsa de `weightAtTime`/`metaAtTime`/`bonusAtTime` |

Payload de leitura sugerido (camelCase no wire via `djangorestframework-camel-case`; snake_case no serializer) [Source: architecture.md §6.3]:
```jsonc
{
  "date": "2026-07-17",
  "totalCompletion": 60,                         // % ponderado do dia (backend calcula)
  "groups": [{ "id": "...", "name": "Saúde", "completion": 60 }],
  "entries": [{
    "id": "...", "habitId": "...", "name": "Exercício", "emoticon": "🏃",
    "type": "numeric", "group": "...", "unit": "min",     // unit só se aprovado
    "value": null, "weightAtTime": "2.00",
    "metaAtTime": "30.00", "bonusAtTime": "20.00"
  }]
}
```
Serializers split leitura (`ModelSerializer`, `fields=[...]`, nunca `"__all__"`) / escrita (`Serializer` plano com `validate`); `value` de escrita `allow_null=True` (desmarcar booleano) [Source: backend/habits/serializers.py]. Paginação: o dia tem poucas linhas — **não paginar** o tracker (retornar tudo). Regeneração de contrato (gate CI): `spectacular` + `generate-types`, commitar `schema.yaml` **e** `types.gen.ts`; diff deve ser **aditivo** [Source: .github/workflows/ci.yml].

### Gatilho de seed — pela borda de habits, NÃO acoplado ao `bujo`

O Daily Log do `bujo` abre via `get_or_create_daily_log(*, user, log_date)` (o chamador resolve a data; serviço só faz get-or-create) exposto por `GET /api/bujo/logs/today/` [Source: backend/bujo/services/logs.py:8-17; backend/bujo/views.py:54-68].

**Decisão de design (documentar inline):** o seed de hábitos é disparado pelo **próprio endpoint de leitura de habits** (`GET /api/habits/days/`), **não** dentro de `get_or_create_daily_log`. O widget de hábitos do Daily Log (montado em `DailyPage` via `useDailyData`) chama esse endpoint no load — então "1ª abertura do dia" dispara a materialização naturalmente, e a superfície `/habits` usa o mesmo caminho. **Rejeitado:** hookar `seed_habit_day` em `bujo/services/logs.py` — criaria import `bujo → habits` (acoplamento cross-app; usuário sem hábitos pagaria o custo). O `import-linter` só **proíbe** `core → domínio`; `bujo → habits` não é proibido pelo contrato atual, mas evitamos por higiene de fronteira [Source: backend/pyproject.toml:52-59]. `habits` **pode** importar `core`/`accounts` (domínio→core permitido).

### Frontend — hooks otimistas + Habit Tracker

**Otimismo (AC2)** — usar o hook compartilhado `useOptimisticMutation<TData, TError, TVars, TCacheItem>` (`onMutate`: cancel → snapshot → `setQueryData(updater)`; `onError`: rollback; `onSettled`: invalidate) [Source: frontend/src/shared/hooks/useOptimisticMutation.ts:18-42]. Espelhar o análogo mais próximo, `useTransitionTaskMutation` (marca status de tarefa, cache-item = o `Log` do dia) [Source: frontend/src/features/bujo/api.ts:50-64]:

```ts
export function useMarkHabitEntryMutation(date?: string) {
  return useOptimisticMutation<HabitDayEntry, unknown, MarkVars, HabitDay>({
    mutationFn: markEntry,                       // PATCH /api/habits/days/${id}/ { value }
    queryKey: keys.habits.day(date),
    updater: (current, { entryId, value }) => {
      if (!current) return current as unknown as HabitDay
      return { ...current, entries: current.entries.map(e =>
        e.id === entryId ? { ...e, value } : e) }
    },
  })
}
```
> **Nuance de otimismo:** `totalCompletion`/`groups[].completion` vêm calculados do backend. O `updater` otimista atualiza `entry.value` na hora; os percentuais reconciliam no `onSettled` (invalidate → refetch). Aceitável (o % pisca para o valor correto após o servidor). Se quiser % otimista imediato, replicar a fórmula da Dev Notes no `updater` — **opcional**, não exigido pela AC.

**Componente `HabitTracker`** — reusar os padrões de `HabitsManager.tsx` [Source: frontend/src/features/habits/components/HabitsManager.tsx]:
- **Agrupamento** (`GroupSection`, linhas 153-169): filtra `entries` por `group.id`, cabeçalho `subtitle2 component="h3"` com nome + `completion` do grupo; percentual total no topo.
- **Linha** (`HabitRow`, linhas 43-146): `Box` `display:flex, alignItems:center, minHeight:44, gap:1`; **booleano = `<Checkbox>`** (marcar → `value:1`, desmarcar → `value:null`); **numérico = `<TextField type="number">` + unidade + "2.500 / 5.000 passos (50%)"/"Meta atingida"**; erro inline `<Typography role="alert">{SAVE_ERROR}</Typography>` (`SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'`, já constante em HabitsManager).
- **Voz (UX-DR13):** pt-BR direto, **zero gamificação/troféus/sequências/exclamações** [Source: EXPERIENCE.md §4.3 linhas 238; §5.5-5.6 linhas 391-404]. Empty state honesto se o dia não tem hábitos ativos.
- Formulários/inputs: `useState` controlado + MUI (o projeto **não** tem react-hook-form/formik/zod).

**Tipos/keys:** `types.ts` re-exporta `components['schemas']['HabitDayEntry']` (e o wrapper do dia) após regenerar `types.gen.ts`; `keys.habits.day(date)` adicionado (sem `userId`, como o resto de `habits.*`) [Source: frontend/src/api/keys.ts:32-37; frontend/src/features/habits/types.ts].

### Frontend — acoplamento ao Daily Log (fluxo da manhã)

- **Composição:** `pages/daily/useDailyData.ts` (hoje retorna só `{ todayLog }`) é o **ponto de composição documentado** para habits/medications/gratitude (Épicos 6-9). Adicionar `habitDay = useHabitDayQuery(routeDate)` e expor [Source: frontend/src/pages/daily/useDailyData.ts:3-10].
- **Montagem:** `pages/daily/DailyPage.tsx` — dentro do `<Box component="main">`, **após o cluster de banners** (`MigrationBanner`/`WeeklyReviewBanner`/`MonthlyReviewBanner`/`CatchUpBanner`, bloco today-only ~linha 93). Opcionalmente envolver em `DayHeader` (seção colapsável titulada) [Source: frontend/src/pages/daily/DailyPage.tsx:81-117; pages/daily/DayHeader.tsx].
- **Rota `/habits`:** hoje é `PlaceholderPage` stub — substituir por `HabitsPage` que renderiza `<HabitTracker date=hoje/>` [Source: frontend/src/app/router.tsx:87]. Item de nav já existe (`Sidebar.tsx:68`, `BottomNav.tsx:14/19/54`, `RepeatIcon`).

### Armadilha dos 3 testes compartilhados (memória do projeto — CONFIRMADA)

`Sidebar.test.tsx`, `BottomNav.test.tsx` e `AppLayout.test.tsx` renderizam a casca **sem** `QueryClientProvider` e só sobrevivem porque `vi.mock('../../features/braindump', ...)` stuba o único filho de nav que usa Query (`BrainDumpBadge`). **`HabitTracker` mora no `<Outlet/>` (páginas), então NÃO afeta esses três testes.** Só quebraria se você adicionasse um filho Query-driven ao `Sidebar`/`BottomNav` (ex.: badge de % de hábitos no item "Hábitos") — evite nesta story; se for inevitável, estenda os `vi.mock` dos três arquivos [Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; frontend/src/app/layout/{Sidebar,BottomNav,AppLayout}.test.tsx].

### Testes

**Backend** [Source: backend/habits/tests/factories.py; backend/conftest.py:19-24; backend/braindump/tests/]:
- Matriz fixa `habits/tests/{test_models,test_serializers,test_services,test_views}.py`. Services rodam dentro de `with tenant_context(user):`; fixtures `user`/`other_user`/`api_client`/`auth_client` já existem.
- `HabitDayEntryFactory` no padrão `class Params: user = SubFactory(UserFactory)` + `user_id = SelfAttribute("user.id")`; **datas fixas + `timedelta`** (guardrail AST proíbe `date.today()`). `register_isolation_case(id="habits.HabitDayEntry", model=..., make=lambda: {...})` — **`conftest.py` já inclui `habits.tests.factories`** (linha 23), então o gate de isolamento parametrizado pega o novo caso sem editar conftest.
- Gate de isolamento (obrigatório por model): query sem contexto DEVE levantar `TenantScopeViolation`. O guardrail de manager já percorre todo `TenantModel`.
- Casos-âncora (ver Task 6): seed idempotente/gap-fill; dia pulado usa versão daquele dia; inativo fora; fórmula de completude (booleano/numérico/bonus/meta/ponderação/grupo); **não-sangramento** de UPDATE avulso; isolamento + fail-closed. Sem `pytest-cov`/threshold [Source: backend/pyproject.toml].

**Frontend** [Source: frontend/src/features/braindump/api.test.tsx; frontend/src/features/habits/api.test.tsx]:
- **Teste de hook** (`api.test.tsx`): `QueryClientProvider` (`retry:false`) + mock de `../../api/client` (`{default:{get,post,patch,delete: vi.fn()}}`); **sem** `useAuth` (habits não usa) e **sem** ThemeProvider/axe. 3 casos otimistas: payload+invalidação; atualização otimista antes do servidor (Promise deferida `mockPatch.mockReturnValueOnce(new Promise(...))`); rollback em erro (`mockRejectedValueOnce`).
- **Teste de componente** (`HabitTracker.test.tsx`): `ThemeProvider theme={createBujoTheme('light')}` + `jest-axe` `toHaveNoViolations()`. Reusar fixtures `HABIT`/`GROUP` do `api.test.tsx` (atenção: `weight`/`meta`/`bonus` são **strings**, ex. `'2.00'`).

### Ambiente / CI / operação (retro Épico 5)

- **Node ≥ 22.15.1 via nvm**: sessão inicia em v18 sem `.nvmrc`; `nvm use 22.15.1` antes de todo comando de frontend/e2e [Source: memória `frontend-needs-node-22-via-nvm`].
- **Paralelismo Neon**: `fileParallelism:false` (vitest) e `workers:1` (playwright) já são default — **não** passar as flags manualmente [Source: epic-5-retro-2026-07-17.md §7].
- **Migration em branches Neon dedicadas**: aplicar `habits.0002_*` às branches `dev` e `e2e` antes de suítes que batem no banco (lacuna recorrente ao evoluir schema) [Source: epic-5-retro-2026-07-17.md §3].
- **Gates de CI** (ordem): `ruff` → `lint-imports` → `pytest` → `spectacular` + diff de `types.gen.ts` (backend); `tsc` → ESLint → `vite build` (frontend). **Vitest não roda no CI** — rede de segurança local/review [Source: .github/workflows/ci.yml].
- **Contrato de schema aditivo**: a 6.1 teve colisão de enum (`type` de habits × `type` de bujo) resolvida com `ENUM_NAME_OVERRIDES`. O `HabitDayEntry` não tem enum novo; verifique que o diff de `schema.yaml` continua **aditivo** (novos `HabitDayEntry*`) [Source: 6-1-configuracao-de-habitos-e-grupos.md Debug Log].
- **Commit ao fim da story**: 1 commit/story; rodar `/bmad-uncommitted-report`, salvar o report, então commitar **sem** pedir "[S]im" [Source: memória `commit-at-end-of-each-story`].

### Inteligência da story anterior (6.1 — mesmo épico)

Da 6.1 (`6-1-configuracao-de-habitos-e-grupos.md`), padrões diretamente reusáveis e armadilhas já mapeadas:
- **`current_version_of(habit, on_date)`** já existe e é a peça central do seed — não reimplementar; `list_habits` já anexa `current_version` resolvido a `today_for(user)` [Source: backend/habits/services.py:21-58].
- **Tipografia MUI nativa** (`body2`/`caption`), **não** a custom `body-sm` (a 6.1 documentou a armadilha do `component="div"`); Tooltip da AC2 da 6.1 ficou no *campo*, não no botão (o Tooltip no botão sequestrava o `aria-label`) — replicar essa disciplina de a11y [Source: 6-1 Completion Notes].
- **Follow-ups LOW da 6.1 relevantes aqui:** (a) sem limite inferior em `weight`/`meta`/`bonus` — a 6.1 **deixou explícito para decidir na 6.2** conforme a matemática de completude. **Decisão 6.2:** guardar contra `meta == 0`/`meta is None` (contribuição 0, sem divisão por zero); pesos ≤ 0 são degenerados mas não quebram (denominador pode zerar → guarda de `Σweight==0`). Não impor bounds novos sem AC — apenas as guardas de divisão. (b) `list_habits` resolve versão por hábito (N+1) — aceitável na escala atual; o seed roda 1×/dia [Source: 6-1 Review Follow-ups].
- **File List honesto:** nomear arquivos **modificados** (ex.: `models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `factories.py`, `keys.ts`, `router.tsx`, `useDailyData.ts`, `DailyPage.tsx`, `schema.yaml`, `types.gen.ts`) e colar a contagem de testes **depois** de escrever o último teste [Source: epic-5-retro-2026-07-17.md §3].

### Project Structure Notes

- **Backend (app existente `habits/`, estende):** `models.py` (+`HabitDayEntry`, +`Habit.unit` se aprovado), `services.py` (+`seed_habit_day`, `compute_day_completeness`, `update_habit_day_entry`), `serializers.py` (+read/write de day entry), `views.py` (+2 views), `urls.py` (+`days/`, `days/<uuid:pk>/`), `admin.py` (+admin `all_objects`), `tests/factories.py` (+factory + isolation case), `tests/test_*.py`. Migration nova `migrations/0002_*.py`.
- **Frontend (feature existente + página nova):** `features/habits/api.ts` (+hooks tracker), `types.ts`/`index.ts` (+tipos/export), `components/HabitTracker.tsx` (novo), `components/HabitsManager.tsx` (+input de unidade se aprovado); `pages/habits/HabitsPage.tsx` (novo); `api/keys.ts` (+`habits.day`), `app/router.tsx` (`/habits` real), `pages/daily/useDailyData.ts` + `pages/daily/DailyPage.tsx` (acoplar widget).
- **Regenerados:** `schema.yaml`, `frontend/src/api/types.gen.ts`.
- **Não tocar:** `config/urls.py` (mesmo prefixo), `conftest.py` (`habits.tests.factories` já listado), `Sidebar.tsx`/`BottomNav.tsx` (item `/habits` já existe; não adicionar filho Query-driven). Nenhuma variância de estrutura detectada.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.2 linhas 1144-1165] — user story + ACs originais
- [Source: _bmad-output/planning-artifacts/epics.md linhas 55-58, 284, 133, 156] — FR-2.4/2.5/2.6, objetivo Épico 6, AR-16, UX-DR4
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-06 linhas 290-355] — snapshot de hábitos, duas camadas, `habit_day_entries`, semântica da ausência, edição vs. config, schema, casos-âncora
- [Source: docs/temporal-pattern.md linhas 21-23, 29-37, 58-65, 103] — `today_for`, DATE vs TIMESTAMPTZ, materialização ansiosa idempotente
- [Source: backend/habits/models.py:1-90] — `HabitGroup`/`Habit`/`HabitVersion` (padrão a espelhar em `HabitDayEntry`)
- [Source: backend/habits/services.py:21-148] — `current_version_of`, `list_habits`, `add_habit_version` (convenções de serviço)
- [Source: backend/habits/serializers.py:1-115; backend/habits/views.py:1-123; backend/habits/urls.py] — split leitura/escrita, views finas, rotas
- [Source: backend/habits/tests/factories.py; backend/conftest.py:19-24] — factories + gate de isolamento (já registra `habits.tests.factories`)
- [Source: backend/core/models.py:21-43; backend/core/calendar.py:14-19; backend/core/exceptions.py:46-47,78-114] — `TenantModel`, `today_for`, `ImmutableSnapshot`/handler
- [Source: backend/bujo/services/logs.py:8-17; backend/bujo/views.py:54-68] — seam de "abrir o dia" (`get_or_create_daily_log`, `GET /api/bujo/logs/today/`)
- [Source: backend/pyproject.toml:52-59] — contrato import-linter (só `core → domínio` proibido)
- [Source: frontend/src/features/habits/{api,types,index}.ts:api.ts 1-122] — data-layer 6.1 a estender
- [Source: frontend/src/features/habits/components/HabitsManager.tsx:43-169] — `HabitRow`/`GroupSection` (padrões de linha e agrupamento)
- [Source: frontend/src/shared/hooks/useOptimisticMutation.ts:18-42; frontend/src/features/bujo/api.ts:50-64] — hook otimista + análogo `useTransitionTaskMutation`
- [Source: frontend/src/pages/daily/{DailyPage.tsx:81-117, useDailyData.ts:3-10, DayHeader.tsx}] — superfície do Daily Log, ponto de composição, seção colapsável
- [Source: frontend/src/app/router.tsx:87; frontend/src/app/layout/{Sidebar.tsx:68,BottomNav.tsx:14}] — stub `/habits` + item de nav
- [Source: frontend/src/api/keys.ts:32-37; frontend/src/api/types.gen.ts:600-661] — seção `habits` de keys; shapes gerados (decimais como string)
- [Source: frontend/src/features/braindump/api.test.tsx; frontend/src/app/layout/{Sidebar,BottomNav,AppLayout}.test.tsx] — harness de teste otimista + armadilha dos 3 testes
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md linhas 224-240, 391-406, 543-551, 722] — Habit Tracker Row, estados, fluxo da manhã, "tracker do dia é primário"
- [Source: _bmad-output/implementation-artifacts/6-1-configuracao-de-habitos-e-grupos.md] — story anterior (mesmo épico): decisões, follow-ups LOW, File List honesto
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-17.md §3/§6/§7] — aprendizados de ambiente/CI/otimismo aplicáveis
- [Source: memórias do projeto] — `commit-at-end-of-each-story`, `story-language-conventions`, `frontend-needs-node-22-via-nvm`, `sidebar-bottomnav-shared-tests-need-query-mock`, `ask-dont-assume-functionality-flows`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- **Decisão da `unit` (única pendência da story):** Hugo aprovou o default recomendado — `unit` como campo de **identidade** (não versionado, `CharField(max_length=32, blank=True)`) em `Habit`, exposto em criar/editar hábito (`HabitsManager`) e exibido na linha numérica do tracker (`"2.500 / 5.000 passos (50%)"`).
- **Chaves do `response.data` no DRF são snake_case** (a camelização de `djangorestframework-camel-case` ocorre só no renderer JSON, não no `.data` do serializer): 3 testes de view inicialmente falharam usando `totalCompletion`/`weightAtTime`; corrigidos para `total_completion`/`weight_at_time` (o wire JSON continua camelCase, verificado pelos tipos gerados).
- **Armadilha dos testes compartilhados via rota da DailyPage:** `useDailyData` agora compõe `useHabitDayQuery` e a `DailyPage` monta `<HabitTracker>` — o que quebraria `router.test.tsx` e `RouteAnnouncer.test.tsx` (montam a rota real sem `QueryClientProvider`, dependendo de `../features/bujo` totalmente mockado). Adicionado `vi.mock('../features/habits', ...)` nos dois (mesmo padrão dos mocks de `braindump`/`TaskDetailPanel`). `DailyPage.test.tsx` roteia `/api/habits/days/` no `GET_DEFAULTS`. Sidebar/BottomNav/AppLayout **não** foram afetados (HabitTracker vive no Outlet, não na casca — confirmado).
- **Neon lento/serial (workers:1):** a suíte completa (496 testes) leva ~22 min e excede o limite de tarefas em background do ambiente; rodada em 2 blocos foreground com `--reuse-db` cobrindo **todos** os apps (nada omitido).

### Completion Notes List

Implementada a **camada de snapshot realizado** de AD-06 (a 6.2 do Épico 6).

- **Backend:** `HabitDayEntry(TenantModel)` (`habit_day_entries`, UUID PK + `UniqueConstraint(habit, date)`, projetado para a 6.3 acrescentar `day_type`/`multiplier_at_time` sem reescrever a fórmula); migration `0002_habit_day_entry` (inclui `Habit.unit`). Serviços de módulo: `seed_habit_day` (materialização gap-fill idempotente, nunca sobrescreve), `compute_day_completeness` (total + por grupo), `_contribution`/`_completeness_pct` (fórmula FR-2.4 em `Decimal`, guarda de divisão-por-zero), `update_habit_day_entry` (UPDATE só naquela linha, sentinela `_UNSET` para distinguir "não enviado" de "desmarcar `value`=None"; não sangra, não toca `habit_versions`). API: `GET /api/habits/days/?date=` (seed + payload `{date, totalCompletion, groups, entries}`, default hoje) e `PATCH /api/habits/days/{id}/` (marca `value` + correção avulsa; rejeita mutação de `habit`/`date` → 400). Seed disparado pela **borda de habits**, não por `bujo` (sem import cross-app; `lint-imports` KEPT).
- **Frontend:** `useHabitDayQuery` + `useMarkHabitEntryMutation` (otimista via `useOptimisticMutation`, espelhando `useTransitionTaskMutation`). `HabitTracker` (percentual total no topo, grupos com % ponderado, booleano = `Checkbox`, numérico = `TextField` + unidade + "X / meta unit (Y%)"/"Meta atingida", `minHeight:44`, erro inline `role="alert"`, empty state honesto, zero gamificação). Rota `/habits` real (`HabitsPage`, substituiu o stub). Acoplado ao fluxo da manhã: `useDailyData` compõe a query e `DailyPage` monta o widget no bloco today-only após os banners. Input de unidade adicionado ao form de criar/editar hábito (`HabitsManager`, mapeado em create + `useUpdateHabitIdentityMutation`).
- **Contrato:** `schema.yaml` + `types.gen.ts` regenerados — diff **puramente aditivo** (novos `HabitDay`/`HabitDayEntry`/`HabitDayGroup`/`PatchedHabitDayEntryUpdate`; `unit` em `Habit`/`HabitCreate`; `HabitDayEntry.type` reusa `HabitTypeEnum`). Migration `0002` aplicada às branches Neon `dev` e `e2e`.

**Contagens de teste (observadas, executadas literalmente):**
- **Backend — 496 passed, 0 failed** (suíte completa, sem escopo de caminho; rodada em 2 blocos com `--reuse-db`: `accounts braindump core habits` = 200 passed em 372s + `bujo` = 296 passed em 887s; 200+296 = 496 = itens coletados, cobrindo todos os apps).
- **Frontend — 636 passed** (`vitest run` completo, 56 arquivos), dos quais 26 nos 3 arquivos de habits (`api.test.tsx`, `HabitsManager.test.tsx`, `HabitTracker.test.tsx`).
- Gates: `ruff` ✓, `lint-imports` ✓ (contrato KEPT), `manage.py check` ✓, `tsc` ✓, ESLint ✓, `vite build` ✓, `spectacular` diff aditivo ✓.

### File List

**Backend (modificados):**
- `backend/habits/models.py` — `+HabitDayEntry`, `+Habit.unit`
- `backend/habits/services.py` — `+seed_habit_day`, `+compute_day_completeness`, `+_contribution`, `+_completeness_pct`, `+update_habit_day_entry`, `unit` em `create_habit`/`_IDENTITY_FIELDS`
- `backend/habits/serializers.py` — `+HabitDayEntrySerializer`, `+HabitDayGroupSerializer`, `+HabitDaySerializer`, `+HabitDayEntryUpdateSerializer`, `unit` em Habit read/create/update
- `backend/habits/views.py` — `+HabitDayView`, `+HabitDayEntryDetailView`
- `backend/habits/urls.py` — rotas `days/` e `days/<uuid:pk>/`
- `backend/habits/admin.py` — `+HabitDayEntryAdmin` (`all_objects`)
- `backend/habits/tests/factories.py` — `+HabitDayEntryFactory` + `register_isolation_case("habits.HabitDayEntry")`
- `backend/habits/tests/test_models.py` — constraint `(habit, date)`
- `backend/habits/tests/test_services.py` — seed/completude/não-sangramento
- `backend/habits/tests/test_serializers.py` — `HabitDayEntryUpdateSerializer`
- `backend/habits/tests/test_views.py` — GET days / PATCH entry / isolamento

**Backend (novo — tipo migration):**
- `backend/habits/migrations/0002_habit_day_entry.py`

**Frontend (modificados):**
- `frontend/src/api/keys.ts` — `+habits.day`
- `frontend/src/api/types.gen.ts` — regenerado (aditivo)
- `frontend/src/features/habits/api.ts` — `+useHabitDayQuery`, `+useMarkHabitEntryMutation`, `unit` nas vars
- `frontend/src/features/habits/types.ts` — `+HabitDay/HabitDayEntry/HabitDayGroup`
- `frontend/src/features/habits/index.ts` — re-exports
- `frontend/src/features/habits/components/HabitsManager.tsx` — input de unidade (create + edit)
- `frontend/src/features/habits/api.test.tsx` — `+useHabitDayQuery` + 3 casos otimistas de `useMarkHabitEntryMutation`
- `frontend/src/app/router.tsx` — `/habits` → `HabitsPage`
- `frontend/src/pages/daily/useDailyData.ts` — compõe `useHabitDayQuery`
- `frontend/src/pages/daily/DailyPage.tsx` — monta `<HabitTracker>` (bloco today-only)
- `frontend/src/pages/daily/DailyPage.test.tsx` — roteia `/api/habits/days/`
- `frontend/src/app/router.test.tsx` — `vi.mock('../features/habits')`
- `frontend/src/app/layout/RouteAnnouncer.test.tsx` — `vi.mock('../../features/habits')`

**Frontend (novos):**
- `frontend/src/features/habits/components/HabitTracker.tsx` (componente)
- `frontend/src/features/habits/components/HabitTracker.test.tsx` (teste — tipo novo)
- `frontend/src/pages/habits/HabitsPage.tsx` (página — tipo novo)

**Contrato (regenerado):**
- `schema.yaml`

### Change Log

| Data | Mudança |
|------|---------|
| 2026-07-17 | Story 6.2 criada (create-story): tracker diário com `habit_day_entries`, `seed_habit_day` idempotente e completude ponderada; acoplamento ao Daily Log. Status → ready-for-dev. |
| 2026-07-18 | Story 6.2 implementada (dev-story): model `HabitDayEntry` + migration `0002` (com `Habit.unit`, aprovado por Hugo); serviços seed/completude/edição-avulsa; API `days/` GET+PATCH; hooks otimistas + `HabitTracker`; rota `/habits` real + acoplamento ao Daily Log; contrato aditivo regenerado + migrado em Neon dev/e2e. Backend 496 passed, frontend 636 passed. Status → review. |
| 2026-07-19 | Automate (E2E): `habit-tracker.spec.ts` + `seedHabits.ts`, 2 E2E passaram (fluxo real GET/PATCH days). Sem gaps reais. |
| 2026-07-19 | Code-review adversarial (in-session): 0 CRITICAL / 0 HIGH / 0 MEDIUM; 3 LOW/nit → follow-ups. Contrato aditivo confirmado; seed idempotente, completude ponderada e edição não-sangrante verificados. Status → **done**. |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (story-automator, in-session) · **Data:** 2026-07-19
**Resultado:** ✅ **Approve → done** (0 CRITICAL, 0 HIGH, 0 MEDIUM)

**Verificado contra o código:** AC1 (`seed_habit_day` idempotente/gap-fill — nunca sobrescreve; dias passados imunes a hábitos criados depois via `current_version_of`→None; dia pulado usa a versão vigente naquele dia); AC2 (Habit Tracker agrupado, booleano=checkbox / numérico=campo+unidade+%, total + % por grupo, marcação otimista com rollback via `useOptimisticMutation`, touch target ≥44px, acople ao Daily Log); AC3 (completude `Σ(contrib×w)/Σw` — booleano não-marcado no denominador, guarda `Σw==0`, `weight_at_time` isolado para a 6.3; edição avulsa = UPDATE só naquela linha, não toca `habit_versions`). Contrato **puramente aditivo** (schema/types `+0` removidos). Migration `0002` limpa. Testes reais e completos: 15 de serviço + 7 de view (incl. data inválida 400, rejeição de mutação de identidade, cross-tenant 404) + hooks/componente frontend + 2 E2E. Armadilha dos 3 testes compartilhados tratada corretamente (mocks de `../features/habits`).

### Review Follow-ups (AI) — LOW/nit, não bloqueantes

- [ ] [AI-Review][LOW] `seed_habit_day` resolve `current_version_of` por hábito → N+1 (mesma classe do follow-up da 6.1 em `list_habits`). Aceitável na escala atual; reavaliar com a leitura intensiva da 6.4. [backend/habits/services.py:179]
- [ ] [AI-Review][NIT] `NumericRow` mantém `draft` local que pode divergir do `entry.value` após update otimista/rollback (cosmético; mesma classe do nit da 6.1 em `HabitRow`). [frontend/src/features/habits/components/HabitTracker.tsx:74]
- [ ] [AI-Review][LOW] Hábito numérico com `meta_at_time=None` contribui sempre 0 mesmo com `value` registrado (`_contribution` retorna 0 sem meta). Caso de borda — a AC assume numérico com meta; a 6.1 permite meta nula. Considerar tornar meta obrigatória para numérico ou documentar. [backend/habits/services.py:208]
