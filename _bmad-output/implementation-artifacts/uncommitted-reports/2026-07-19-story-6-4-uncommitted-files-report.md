# Explicação dos arquivos não commitados — Story 6.4 (Histórico por data e gráfico de evolução)

> **Escopo deste relatório:** APENAS os arquivos da Story 6.4 (Épico 6), a **camada de leitura read-only** do Sistema de Hábitos.
> **Baseline dos diffs:** commit `c668936` (fechamento da Story 6.3).
> **Fora de escopo (não documentados aqui):** `_bmad-output/planning-artifacts/*`, `_bmad-output/specs/`, logs do `story-automator`, `sprint-status.yaml`, `tests/test-summary.md` e o próprio arquivo de contexto `6-4-*.md`.

## Visão geral

A Story 6.4 adiciona a **superfície de revisão histórica** de hábitos: um detalhe read-only por-data, um gráfico de evolução por hábito e uma grade densa hábitos × dias, tudo alcançável por uma aba dentro de `/habits`. Tecnicamente é uma **camada de LEITURA derivada on-read**, empilhada sobre a série materializada da 6.2 (`habit_day_entries`) e o ritmo da 6.3 (`day_type`/multiplicadores).

Os **invariantes de arquitetura da story (AD-11 / AD-14)** atravessam todo o conjunto e são o critério de aceite mais importante:

- **Read-only:** nenhuma escrita nova. Zero `@transaction.atomic` novos, nenhuma mutação, nenhum `useMutation`.
- **Sem schema:** nenhuma migration, nenhum model novo, nenhum campo novo. Nenhuma série materializada nova — o histórico é derivado a cada leitura de dados que **já existem**.
- **Nunca semeia:** os serviços de leitura **jamais** chamam `seed_habit_day`. Um dia nunca aberto é uma **lacuna honesta** (`total_completion = None`, `groups = []`, `entries = []`), NUNCA um `0%` fabricado. Vários testes (backend unit, view e E2E) blindam exatamente isso contando linhas antes/depois.

O fluxo producer→consumer é: primitiva de calendário em lote → serviços de leitura → serializers read-only → views/URLs GET → contrato OpenAPI (aditivo) → tipos/hooks/componentes do frontend → testes.

## Ordem lógica de funcionamento

1. **Primitiva compartilhada (batch):** `core/calendar.resolve_day_types_range` resolve o tipo de dia de **todo** dia de calendário do range com uma query só.
2. **Serviços read-only (`habits/services.py`):** `_grouped_completeness` (extraído de `compute_day_completeness`), `get_habit_history_range`, `_diff_versions` e `get_habit_series` — derivam histórico/série/eventos sem materializar.
3. **Serializers read-only (`habits/serializers.py`):** `HabitSlimSerializer` + os serializers de histórico/série. `field` do diff é `CharField` (não emite enum novo); chaves `before`/`after` (nunca `from`/`to`).
4. **Views + URLs (GET):** `HabitHistoryRangeView`, `HabitSeriesView` e as duas rotas novas.
5. **Contrato gerado (aditivo):** `schema.yaml` + `frontend/src/api/types.gen.ts` — 2 paths e 7 schemas novos.
6. **Frontend:** dependência `recharts` → `keys`/hooks `useQuery` read-only → tipos → `historyUtils` → `HabitEvolutionChart`/`HabitHistoryGrid`/`HabitHistory` → `HabitsTabs`/`HabitHistoryPage`/rota.
7. **Testes:** calendar → services → serializers → views (backend) → hooks/componentes (frontend) → E2E ponta-a-ponta.

---

## 1. Primitiva compartilhada de calendário (batch)

### `backend/core/calendar.py`

**Função geral do arquivo**
Autoridade temporal do domínio: resolve "hoje" por usuário (`today_for`), tipos de dia, semanas/meses. `core` não importa `habits` (evita ciclo), então trabalha com strings literais de tipo de dia.

**Função geral da alteração**
Adiciona `resolve_day_types_range(user, start, end)` — a versão em **lote** de `resolve_day_type`. Necessária porque a camada de histórico precisa do tipo de dia de **cada** dia do range (inclusive dias-lacuna, sem linha materializada), para o sombreamento de ritmo. Resolver dia a dia seria N chamadas; a versão em lote faz **uma** query.

**Blocos principais**
- Linhas ~87-118 (função nova): import tardio de `accounts.models.UserHoliday` (direção `core → accounts` é permitida); uma query `filter(date__range=(start, end))` materializada num `set` de feriados; laço `while d <= end` construindo `dict[date, str]`.

**Funções, classes e importações específicas**
- `resolve_day_types_range(user, start, end) -> dict[date, str]`: espelha a precedência `holiday > weekend > weekday` de `resolve_day_type` e as mesmas strings literais. `start > end` retorna `{}` (o chamador valida antes). Auto-escopada por tenant (mesmo scoping implícito de `resolve_day_type`).

**Comportamento de libs usadas**
- `UserHoliday.objects.filter(...).values_list("date", flat=True)`: retorna uma lista plana de datas; embrulhada em `set(...)` para lookup O(1) por dia.
- `datetime.timedelta(days=1)`: incremento do cursor no laço.

**Invariante:** função **read-only**, sem escrita, uma query.

---

## 2. Serviços de leitura de histórico (read-only, não-semeadores)

### `backend/habits/services.py`

**Função geral do arquivo**
Camada de serviço do Sistema de Hábitos: toda regra de negócio (criação/versionamento, materialização de dia, completude, multiplicadores). Escrita é `@transaction.atomic`; scoping implícito por tenant.

**Função geral da alteração**
Adiciona a **seção "Camada de LEITURA de histórico"** (bloco novo ao fim do arquivo, ~linhas 429-605) e **refatora** `compute_day_completeness` extraindo `_grouped_completeness` para reuso. Nenhuma função nova é transacional; nenhuma chama `seed_habit_day`.

**Blocos principais**
- **`import timedelta`** (topo) e `resolve_day_types_range` acrescentado ao import de `core.calendar`.
- **`_grouped_completeness(entries)` (extraído):** antes o cálculo por grupo vivia dentro de `compute_day_completeness`; foi movido para uma função pura que recebe `entries` já carregadas. `compute_day_completeness` passa a delegar (`"groups": _grouped_completeness(entries)`), preservando comportamento. O objetivo é que o histórico reuse a **mesma mecânica** de % por grupo sem reimplementar (AC1).
- **`_MAX_RANGE_DAYS = 92`** + **`_validate_range(start, end)`:** guarda comum das leituras — `start <= end` e range ≤ 92 dias, senão `DomainError` (a view traduz para 400).
- **`get_habit_history_range(...)`:** o payload do intervalo (grade + detalhe por-data).
- **`_decimal_str` / `_bool_str`:** serializam `Decimal`/`None` e `bool` como string estável para o diff.
- **`_diff_versions(prev, curr)`:** diff entre duas versões consecutivas.
- **`get_habit_series(...)`:** série + eventos + ritmo de UM hábito.

**Funções, classes e importações específicas**
- `get_habit_history_range(*, user, start, end) -> dict`:
  - **Uma** query em `habit_day_entries` (`filter(date__range=...).select_related("habit", "habit__group")`, auto-escopada) + **uma** query de feriados via `resolve_day_types_range` — agrupa em Python (sem N+1).
  - Retorna `habits` (identidade dos hábitos que aparecem no range, ordenados por `group.display_order, group.name, habit.name`) e `days` = **todos** os dias de calendário em `[start, end]`.
  - Dia materializado: `total_completion = _completeness_pct(day_entries)` + `groups = _grouped_completeness(day_entries)`.
  - **Dia sem linha (lacuna honesta):** `total = None`, `groups = []`, `entries = []`. Comentário explícito distingue de `0%` (`_completeness_pct([]) == 0`). **Nada é materializado.**
- `_diff_versions(prev, curr) -> list[dict]`:
  - `prev is None` (primeira versão) = criação → `[{"field": "created", "before": None, "after": None}]`.
  - Só campos versionados que mudaram: `weight`/`meta`/`bonus`/`active`.
  - Chaves **`before`/`after`** — NUNCA `from`/`to` (`from` é palavra reservada em Python). `active` false→true / true→false vira o marcador Reativado/Desativado no front.
- `get_habit_series(*, user, habit_id, start, end) -> dict`:
  - `Habit.objects.select_related("group").get(id=habit_id)` — deixa `DoesNotExist` subir (a view vira 404; cross-tenant também = 404 via auto-scope).
  - `points`: uma query em `habit_day_entries` `order_by("date")`; cada ponto `{date, value, effective_weight (via _effective_weight), day_type}`; dias sem linha são **omitidos** (o eixo X é o range; ausência = lacuna no gráfico).
  - `events`: diff das `habit_versions` consecutivas em ordem **ascendente** por `effective_from, created_at` (o `Meta.ordering` do model é descendente — o `order_by` explícito é obrigatório). Só entram eventos cujo `effective_from` cai no range (inclusive o `created`).
  - `day_types`: range inteiro (sombreamento até em dias-lacuna).
  - **O multiplicador NUNCA vira evento (AD-11)** — é ritmo, expresso só como sombreamento.

**Comportamento de libs usadas**
- `HabitDayEntry.objects.filter(...).select_related(...)`: 1 query com joins de `habit`/`habit__group` para evitar N+1 ao ler grupo/nome.
- `.order_by("effective_from", "created_at")`: sobrescreve o `Meta.ordering` descendente do `HabitVersion`; sem isso o diff consecutivo sairia invertido.

**Invariantes AD-11/AD-14:** nenhum `@transaction.atomic` novo; nenhuma chamada a `seed_habit_day`; nenhuma escrita; lacuna honesta ≠ 0%.

---

## 3. Serializers read-only

### `backend/habits/serializers.py`

**Função geral do arquivo**
Serializers do Sistema de Hábitos (I/O de API). Decimais viajam como string no wire (padrão do projeto); a camelização acontece só no renderer JSON.

**Função geral da alteração**
Adiciona a seção "Histórico read-only" (~linhas 252-343): 7 serializers novos, **todos read-only** (sem `validate`/write).

**Funções, classes e importações específicas**
- `HabitSlimSerializer(ModelSerializer)`: identidade do hábito **sem** `current_version` (`fields = ["id", "name", "emoticon", "type", "unit", "group"]`; `group` = `UUIDField(source="group_id")`). Existe porque os serviços de histórico entregam `Habit` puro (sem `current_version` anexada); `HabitSerializer` estouraria `AttributeError` ao ler `current_version.weight`. `type` reusa `Habit.Type.choices` (mapeia para `HabitTypeEnum` já pinado no contrato — nenhum enum novo).
- `HabitHistoryDaySerializer(Serializer)`: um dia do range. `total_completion = IntegerField(allow_null=True)` → **lacuna honesta**. `groups = HabitDayGroupSerializer(many=True)`, `entries = HabitDayEntrySerializer(many=True)` (reusa serializers existentes).
- `HabitHistoryRangeSerializer(Serializer)`: `start`/`end`/`habits (HabitSlim, many)`/`days (HabitHistoryDay, many)`.
- `HabitChangeSerializer(Serializer)`: uma mudança do diff. **`field = CharField()`** (NÃO `ChoiceField`) — decisão deliberada para **não emitir enum novo** no contrato (evita colisão de `*Enum` do drf-spectacular). `before`/`after` = `CharField(allow_null=True)` (valores heterogêneos: decimais/booleanos como string). Nunca `from`/`to`.
- `HabitSeriesPointSerializer(Serializer)`: `value = DecimalField(allow_null=True)`, `effective_weight = DecimalField`, `day_type = ChoiceField(DayType.choices)` (reusa `DayTypeEnum`).
- `HabitVersionEventSerializer(Serializer)`: `effective_from` + `changes (HabitChange, many)`.
- `HabitDayTypeSerializer(Serializer)`: `date` + `day_type` (para sombreamento).
- `HabitSeriesSerializer(Serializer)`: `habit (HabitSlim)` + `points` + `events` + `day_types (many, required=False)`.

**Comportamento de libs usadas**
- `serializers.ChoiceField(choices=DayType.choices)`: reusa o enum já existente no schema, mantendo o contrato estável.
- `serializers.CharField` para `field`: escapa da geração de `*Enum` do drf-spectacular (a Dev Note atribui a isso a escolha por `CharField`).

---

## 4. Views e URLs (GET read-only)

### `backend/habits/views.py`

**Função geral do arquivo**
Views finas: validam → chamam o serviço → serializam. Autoridade temporal = `today_for` (nunca `date.today()` cru).

**Função geral da alteração**
Adiciona helpers de parse de range + duas views GET.

**Blocos principais**
- `import timedelta` e imports de `HabitHistoryRangeSerializer`/`HabitSeriesSerializer` e dos serviços `get_habit_history_range`/`get_habit_series`.
- **Helpers de range (~linhas 51-88):**
  - `_HISTORY_DEFAULT_SPAN = timedelta(days=29)` — 30 dias inclusivos.
  - `_parse_date_param(raw, field)`: `date.fromisoformat`; `ValueError` → `serializers.ValidationError({field: ...})` (400).
  - `_resolve_history_range(request)`: default `end = today_for(request.user)`, `start = end - 29`. **Nunca** `date.today()`.
  - `_HISTORY_RANGE_PARAMS`: dois `OpenApiParameter` (`start`/`end`, opcionais) para o schema.
- **`HabitHistoryRangeView(APIView)`** (`GET /api/habits/history/`): resolve o range, chama `get_habit_history_range`, captura `DomainError` → 400, serializa. Docstring reafirma: **nunca** materializa.
- **`HabitSeriesView(APIView)`** (`GET /api/habits/<pk>/series/`): idem, mas captura `Habit.DoesNotExist` → `NotFound()` (404, inclusive cross-tenant) além de `DomainError` → 400.

**Comportamento de libs usadas**
- `@extend_schema(parameters=..., responses=...)`: alimenta o `schema.yaml` (drf-spectacular) — origem dos paths/schemas gerados.
- `rest_framework.exceptions.NotFound`: traduz `DoesNotExist` em 404 padronizado.

### `backend/habits/urls.py`

**Função geral da alteração**
Registra as duas rotas novas, mantendo rotas estáticas antes do conversor `<uuid:pk>`.
- `path("history/", HabitHistoryRangeView.as_view(), name="habit-history")` — estática, no topo (comentário atualizado para incluir `history/`).
- `path("<uuid:pk>/series/", HabitSeriesView.as_view(), name="habit-series")` — abaixo do detail.

**Invariante:** só `GET` — nenhuma rota de escrita nova (AD-14).

---

## 5. Contrato gerado (aditivo, alto nível)

### `schema.yaml`

**Função geral do arquivo**
Contrato OpenAPI gerado por drf-spectacular; fonte da geração de tipos do frontend.

**Função geral da alteração (aditiva):** 2 paths + 7 schemas novos; nada removido/alterado no existente.
- **Paths:** `/api/habits/{id}/series/` (`habits_series_retrieve`) e `/api/habits/history/` (`habits_history_retrieve`), ambos só `get`, `jwtAuth`, params `start`/`end` opcionais.
- **Schemas:** `HabitChange` (`field: string`, `before`/`after` nullable), `HabitDayType`, `HabitHistoryDay` (`totalCompletion: integer nullable`), `HabitHistoryRange`, `HabitSeries` (`dayTypes` opcional), `HabitSeriesPoint` (`value` nullable, `effectiveWeight` string decimal), `HabitSlim`, `HabitVersionEvent`.
- Campos em **camelCase** (`totalCompletion`, `dayType`, `effectiveWeight`, `effectiveFrom`) — reflete o renderer. `field` de `HabitChange` é `type: string` (sem enum) — confirma a decisão do serializer.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo**
Tipos TypeScript gerados a partir do `schema.yaml` (openapi-typescript). Consumidos via `components['schemas'][...]`.

**Função geral da alteração (aditiva):** espelha o schema — 2 entradas em `paths`, 7 interfaces em `components["schemas"]` e 2 `operations` (`habits_series_retrieve`, `habits_history_retrieve`). `HabitSlim` marca `id`/`type`/`group` como `readonly`; `HabitSeries.dayTypes` opcional; decimais como `string`/`string | null`.

**Invariante:** puramente aditivo — nenhum tipo pré-existente muda.

---

## 6. Frontend

### `frontend/package.json` + `frontend/package-lock.json`  (dependência)

**Função geral da alteração**
Adiciona **`recharts` fixado em `3.9.2`** — a **primeira biblioteca de charting** do app (usada só no `HabitEvolutionChart`). Versão pinada (sem `^`) por ser superfície nova e sensível a breaking changes de major (v3 mudou `TooltipProps`, tratado no componente).

**Comportamento / cadeia de dependências (lockfile, resumo):**
- Recharts arrasta a família **d3** (`d3-array`, `d3-color`, `d3-ease`, `d3-format`, `d3-interpolate`, `d3-path`, `d3-scale`, `d3-shape`, `d3-time`, `d3-time-format`, `d3-timer`, `internmap`) via `victory-vendor`, além de `decimal.js-light`, `es-toolkit`, `eventemitter3`, `tiny-invariant`, `use-sync-external-store` e uma stack de estado interna (`@reduxjs/toolkit`, `react-redux`, `redux`, `redux-thunk`, `reselect`, `immer`, `@standard-schema/utils`) + `@types/d3-*`. Tudo transitivo do recharts; nenhuma outra dependência de topo foi tocada.

### `frontend/src/api/keys.ts`

**Função geral do arquivo**
Fábrica central de query keys do TanStack Query.

**Função geral da alteração**
Duas keys novas em `keys.habits` (sem `userId`, como o resto de `habits.*`):
- `history: (range) => ['habits', 'history', range]`
- `series: (habitId, range) => ['habits', 'series', habitId, range]`

### `frontend/src/features/habits/api.ts`

**Função geral do arquivo**
Hooks de dados da feature de hábitos (TanStack Query sobre o axios `client`).

**Função geral da alteração**
Seção "Histórico read-only" com **`useQuery` puro** (sem otimismo/prefetch — AD-14 não impõe NFR ao modo de revisão):
- `fetchHabitHistory({start,end})` → `client.get('/api/habits/history/', { params })`; `useHabitHistoryQuery(range)` com `queryKey: keys.habits.history(range)`.
- `fetchHabitSeries(habitId, {start,end})` → `client.get('/api/habits/${habitId}/series/', { params })`; `useHabitSeriesQuery(habitId, range)` com `enabled: habitId !== ''` (o seletor inicia vazio, então não dispara request até selecionar um hábito).

### `frontend/src/features/habits/types.ts` e `index.ts`

- **`types.ts`:** re-exporta 8 tipos novos de `components['schemas']`: `HabitHistoryRange`, `HabitHistoryDay`, `HabitSlim`, `HabitSeries`, `HabitSeriesPoint`, `HabitVersionEvent`, `HabitChange`, `HabitDayType`.
- **`index.ts`:** barrel — exporta os hooks (`useHabitHistoryQuery`, `useHabitSeriesQuery`), o componente `HabitHistory` e os 8 tipos.

### `frontend/src/features/habits/components/historyUtils.ts`  (novo)

**Função geral do arquivo**
Utilitários puros compartilhados pelos três componentes de histórico (formatação e rótulos factuais).

**Funções específicas**
- `formatNumber(raw)`: pt-BR via `Intl.NumberFormat('pt-BR')`; `null`/`''` → `'0'`; NaN → string crua.
- `formatDateShortBR(iso)` / `formatDateBR(iso)`: formatação **por split de string** (`iso.split('-')`), **nunca** `new Date(iso)` — evita desvio de fuso (UTC vs local) que deslocaria o dia.
- `DAY_TYPE_LABEL`: `weekday`→"Dia útil", `weekend`→"Fim de semana", `holiday`→"Feriado" (UX-DR13: sem gamificação).
- `describeChange(change)`: texto humano de uma mudança — `weight`/`meta`/`bonus` "X → Y"; `active` → "Reativado"/"Desativado" (via `after === 'true'`); `created` → "Criado". (Cor nunca comunica sozinha — AC3.)
- `describeEvent(event)`: junta as mudanças com " · ".
- `isRhythmDay(dayType)`: `dayType !== 'weekday'`.

### `frontend/src/features/habits/components/HabitEvolutionChart.tsx`  (novo)

**Função geral do arquivo**
Primeiro gráfico do app: `LineChart` recharts da série de UM hábito.

**Decisões de design (dataviz + AD-11):**
- **Um eixo Y só** (nunca dual-scale): a linha é o `value`. Peso efetivo/multiplicador NÃO viram 2ª linha — são representados EXCLUSIVAMENTE como **sombreamento de ritmo** (`ReferenceArea`).
- Série única → sem legenda de cor; o título nomeia o hábito.
- Marcadores de mudança (`ReferenceLine` datada) SEMPRE acompanhados de **texto** (lista "Mudanças no período" + tooltip) — AC3.
- `meta` NÃO é desenhada como `ReferenceLine` (é versionada; suas mudanças já viram marcadores).

**Blocos/funções específicas**
- `ChartDatum` / `ChartTooltip`: tooltip custom; tipa só `active`/`payload`/`unit` (v3 mudou `TooltipProps`, por isso não o importa).
- Montagem de `chartData` a partir de `dayTypes` (eixo X = range inteiro): sem linha → `null` (quebra da linha, lacuna honesta); **booleano** com `value` nulo mas linha presente = "aberto, não feito" → `0` (degrau); **numérico** com `value` nulo → `null` (não fabrica 0).
- `bands`: blocos contíguos de weekend/holiday → `ReferenceArea` (sombreamento).
- `summary`: `aria-label` textual do `role="img"` (nº de dias com registro + nº de mudanças) — a tabela equivalente acessível é a grade, não o SVG.
- `YAxis domain={isBoolean ? [0,1] : [0,'auto']}`; `Line connectNulls={false}` (respeita lacunas), `isAnimationActive={false}`.

**Comportamento de libs (recharts):** `ResponsiveContainer` mede o container (usa `ResizeObserver`/`getBoundingClientRect` — mockados nos testes); `ReferenceArea`/`ReferenceLine` posicionam por `dataKey="date"`; `Tooltip content={...}` injeta `active`/`payload`.

### `frontend/src/features/habits/components/HabitHistoryGrid.tsx`  (novo)

**Função geral do arquivo**
Grade densa hábitos × dias (UX-DR4) — a **tabela equivalente acessível** exigida pelo Accessibility Floor para o gráfico.

**Blocos/funções específicas**
- `cellState(entry, habit)`: lacuna/não-feito → `{display:'—', aria:'sem registro'}`; booleano → `✓`/`—` ("feito"/"não feito"); numérico → valor formatado + unidade no aria.
- `DAY_TYPE_TAG`: tags textuais curtas `FDS`/`FER` (nunca só cor).
- `srOnly`: estilo screen-reader-only (o `<th>` precisa de texto visível não-aria-hidden para o axe; o rótulo completo entra aqui).
- **Desktop:** `<table>` semântica com `overflowX:'auto'` (nunca scroll horizontal no body da página); `<caption>` descritivo; `<th scope="col">` datas, `<th scope="row">` hábitos; colunas de ritmo com `bgcolor` + tag; células `<td>` com `aria-label` "hábito, data (tipo): estado".
- **Mobile (`useMediaQuery('(max-width:767px)')`):** alternativa em LISTA por dia (só dias com registro), sem scroll horizontal (UX-DR18).
- `indexByDate`: `Map` dia→(hábito→linha) para leitura O(1) das células.

### `frontend/src/features/habits/components/HabitHistory.tsx`  (novo)

**Função geral do arquivo**
Superfície read-only que compõe: controle de intervalo + navegação por data (detalhe) + seletor de hábito (gráfico) + grade.

**Blocos/funções específicas**
- Helpers de data locais (`isoLocalToday`, `addDays`, `clamp`, `defaultRange`) — split de string / `Date` local, sem desvio de fuso. `DEFAULT_SPAN = 29`.
- `readState(entry)`: estado read-only de uma linha (booleano "feito"/"não feito"; numérico "valor / meta unidade"; sem valor → "sem valor · meta …").
- `DayDetail`: detalhe por-data agrupado (% por grupo + % total + tipo de dia). Dia-lacuna → **"Sem registro neste dia."** (nunca 0%).
- Estado: `range`, `selectedHabitId`, `selectedDate`; `updateRange` recusa `start > end` e re-clampa a data; `shiftPeriod(±1)` navega período inteiro.
- Consome `useHabitHistoryQuery(range)` e `useHabitSeriesQuery(selectedHabitId, range)`; estados `isPending`/`isError` com `role="status"`/`role="alert"`.

### `frontend/src/pages/habits/HabitsTabs.tsx`  (novo)

Abas "Hoje" · "Histórico" no topo da superfície de Hábitos (Decisão 2). MUI `Tabs`/`Tab` com `component={Link}`; valor derivado de `useLocation().pathname`. **Não** é item de Sidebar/BottomNav — vive dentro das páginas (no `<Outlet/>`), então **não afeta os 3 testes compartilhados da casca** (armadilha registrada na memória).

### `frontend/src/pages/habits/HabitHistoryPage.tsx`  (novo)

Página da sub-rota `/habits/history`: `<main aria-label="Hábitos">` compondo `<HabitsTabs/>` + `<HabitHistory/>`. Compõe só `features/habits` (fronteira §7.2).

### `frontend/src/pages/habits/HabitsPage.tsx`

**Função geral da alteração:** vira um shell com abas — adiciona `<HabitsTabs/>` acima do `<HabitTracker/>` (a aba "Hoje").

### `frontend/src/app/router.tsx`

**Função geral da alteração:** importa `HabitHistoryPage` e registra a rota `{ path: 'habits/history', element: <HabitHistoryPage/>, handle: { title: 'Hábitos — Histórico' } }` (irmã de `habits`, dentro do layout autenticado).

---

## 7. Testes

### `backend/core/tests/test_calendar.py`

Cinco testes novos para `resolve_day_types_range`: cobre todos os dias do range (inclusive); sáb/dom → weekend, seg–sex → weekday; feriado marcado precede weekend; **tenant scoping** (feriado de `other_user` não vaza); range de 1 dia. Datas ancoradas na semana 05–11/01/2026.

### `backend/habits/tests/test_services.py`

Suíte "Histórico read-only (AC1/AC2/AC4)". Destaques:
- **`get_habit_history_range`:** dia materializado → `total_completion`/`groups` com % (reusa `_completeness_pct`); dia sem linha → **lacuna honesta** (`None`/`[]`/`[]`); `test_history_range_nao_semeia_dias_passados` conta `HabitDayEntry` antes/depois (`before == after == 1` → **zero linhas criadas**); ordenação por grupo; `DomainError` para range > 92 dias e `start > end`; day_type resolve até em lacunas.
- **`get_habit_series`:** points com `value`/`effective_weight`/`day_type` e dias sem linha omitidos; events derivados de versões consecutivas (peso 3→4, desativar, reativar) só com `effective_from` no range; **assert de que nenhuma chave é `from`/`to`** (só `field`/`before`/`after`); `created` só entra se no range; cross-tenant → `Habit.DoesNotExist`; range > 92 → `DomainError`; `test_series_nao_semeia` (`before == after == 0`).

### `backend/habits/tests/test_serializers.py`

Quatro testes: `field` é `CharField` e **não** `ChoiceField`; `HabitChangeSerializer` aceita `field='created'` e serializa `before`/`after`; `HabitHistoryDaySerializer` permite `total_completion=None`; `HabitSeriesPointSerializer` permite `value=None` e serializa `effective_weight` como string.

### `backend/habits/tests/test_views.py`

Suíte de view (GET history / GET series): shape com snake_case em `response.data` (camelização só no renderer JSON); default de 30 dias (`end = today_for(user)`); **`test_get_history_does_not_seed`** (não materializa); data inválida → 400 (`fields.start`); range > 92 → 400 (mensagem "exceder"); série retorna points/events/day_types com `before`/`after`; cross-tenant → 404; range grande na série → 400.

### Frontend — testes de hook e componente

- **`api.test.tsx`:** `useHabitHistoryQuery` busca com `params` e usa a key correta (cache populado); `useHabitSeriesQuery` busca com a key certa e **não dispara** quando `habitId === ''` (`fetchStatus === 'idle'`, `mockGet` não chamado).
- **`HabitEvolutionChart.test.tsx`:** mocka `ResizeObserver`/`getBoundingClientRect` (recharts em jsdom); verifica `role="img"` + `aria-label` de resumo (nº de dias/mudanças), marcadores como TEXTO ("Peso 3 → 4", "Desativado"), legenda de sombreamento, e **axe sem violações**.
- **`HabitHistory.test.tsx`:** detalhe read-only do dia (sem checkbox), navegação para dia-lacuna mostra "Sem registro neste dia." (sem "Completude do dia"), axe sem violações. Usa `clearAllMocks` (não `resetAllMocks`) para preservar o mock de `matchMedia`.
- **`HabitHistoryGrid.test.tsx`:** `<table>` com headers programáticos (`rowheader`/`columnheader`); fim de semana distinto por texto/aria ("FDS"/"Fim de semana"); células anunciam data+estado e lacuna "—" honesta; axe sem violações.

### E2E — `frontend/e2e/habit-history.spec.ts` + `seedHabitHistory.ts`  (novos)

- **`seedHabitHistory.ts`:** semeia o cenário via `manage.py shell -c` (camada de serviço 6.1 + linhas passadas diretas em `habit_day_entries`, já que a UI read-only não semeia). Cria grupo "Saúde" + "Meditar" (booleano, peso 1) + "Passos" (numérico, peso 2, meta 5000, bonus 20). Backdata o "Criado" de Meditar para **fora** da janela de 30 dias e cria mudança de peso 1→2 **dentro** (marcador único). Usa um **feriado real** (`UserHoliday`, `today-6`) como alavanca de determinismo (precedência holiday > weekend > weekday, estável em qualquer dia da execução). Deixa `today-4` como **lacuna** honesta. Todas as datas relativas a `today_for(user)` (nunca `date.today()` cru). Retorna `anchorDate`/`gapDate`/`holidayDate`/`changeDate`. O dia âncora reproduz a matemática de completude das 6.2/6.3 (60%).
- **`habit-history.spec.ts`:** 4 testes ponta-a-ponta contra o backend real (sem mock de rede): (1) sem hábitos → período vazio honesto, alcançado por **aba** (não Sidebar/BottomNav), sem checkbox/spinbutton (AC1/AC3/AC4); (2) navegação por data — dia âncora mostra 60%/valores, dia-lacuna → "Sem registro neste dia." sem 0% fabricado (AC1/AC3/AC4); (3) gráfico — série on-read, `role="img"` "Evolução de Meditar", marcador "Peso 1 → 2", legenda de sombreamento, **`consoleErrors` vazio** (AC2/AC3); (4) grade acessível — `<table>` com headers programáticos, coluna de **Feriado** rotulada por texto, célula com valor + unidade e lacuna "—" honesta (AC1/AC3/UX-DR4).

---

## Confirmação dos invariantes AD-11 / AD-14

- **Read-only:** nenhuma mutação/escrita nova em nenhuma camada; frontend usa só `useQuery`.
- **Sem schema:** nenhuma migration, model ou campo novo; nenhuma série materializada nova — tudo derivado on-read de dados existentes (`habit_day_entries`, `habit_versions`, `day_type`). Contrato 100% aditivo.
- **Nunca semeia:** os serviços jamais chamam `seed_habit_day`; dia nunca aberto = lacuna honesta (`None`/`[]`), nunca 0% fabricado. Blindado por testes de contagem (`test_history_range_nao_semeia_dias_passados`, `test_series_nao_semeia`, `test_get_history_does_not_seed`) e pelo E2E.

*Relatório gerado sem modificar nenhum código-fonte.*
