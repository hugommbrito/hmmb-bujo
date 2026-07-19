---
baseline_commit: c668936b6186e4a10b4c58d8a128711915dd8697
---

# Story 6.4: Histórico por data e gráfico de evolução

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero consultar meus hábitos por data e ver um gráfico de evolução por hábito com as mudanças reais anotadas,
Para que eu entenda minha trajetória sem confundir mudança de configuração com o ritmo de fim de semana/feriado (FR-2.9, FR-2.10, AR-11/AD-11, AD-06, AD-14).

**Quarta e última story do Épico 6 (Sistema de Hábitos).** É a **camada de leitura** de AD-11, empilhada sobre tudo que as stories anteriores materializaram: a config prospectiva (`habit_versions`, 6.1), o snapshot realizado por dia (`habit_day_entries`, 6.2) e o ritmo de tipo de dia congelado (`day_type`/`multiplier_at_time`, 6.3). Esta story **não cria schema nem série materializada nova** (AD-11 "sem impacto de schema"; AD-14 "sem série materializada separada"): tudo é **derivado on-read**. Introduz uma **superfície de histórico read-only** com: (1) navegação por data mostrando o snapshot daquele dia; (2) um **gráfico de evolução por hábito** (série + marcadores de mudança + sombreamento de ritmo); e (3) uma **grade densa hábitos × dias** que serve simultaneamente como visão de histórico (UX-DR4) e como a **tabela equivalente** que a acessibilidade exige para gráficos. É a **primeira superfície de gráfico do app** — nenhuma biblioteca de charting está instalada hoje.

## Acceptance Criteria

### AC1 — Histórico por data: read-only, não-semeador, lacunas honestas (FR-2.9, AD-06, UX-DR4, UX-DR13)

**Dado que** existe a superfície de histórico de Hábitos,
**Quando** Hugo seleciona uma data (controle de data com anterior/próximo + seletor, locale pt-BR, *accessible name* com a data completa — UX-DR "Date/Range Control"),
**Então** a superfície exibe os hábitos e valores daquele dia **a partir das linhas já existentes em `habit_day_entries`** (snapshot imutável), agrupados como no tracker (cabeçalho de grupo + % ponderado do grupo + % total do dia), refletindo o `day_type` e o `peso_efetivo = weight_at_time × multiplier_at_time` **congelados** — **somente leitura** (nenhuma marcação, correção, override ou toggle nesta superfície),
**E** um dia **sem linhas materializadas** (nunca aberto/pulado) aparece como **lacuna honesta** ("Sem registro neste dia."), **nunca como 0% fabricado**, e a leitura **não chama `seed_habit_day`** (não materializa nada ao consultar o passado).

### AC2 — Gráfico de evolução por hábito: série on-read + mudanças reais como marcadores + multiplicador como ritmo (FR-2.10, AD-11)

**Dado que** Hugo seleciona um hábito e um intervalo de datas no histórico,
**Quando** o gráfico de evolução é renderizado,
**Então** a **série diária** é **derivada on-read** de `habit_day_entries` (por dia: `value` e `peso_efetivo`), com dias sem linha aparecendo como **quebras/lacunas na linha** (não como zero fabricado),
**E** as **mudanças reais de configuração** (peso, meta, bonus, ativação/desativação — FR-2.5/2.7/2.8) são anotadas como **marcadores datados discretos** (linha vertical + ponto), derivados do **stream de `habit_versions`** (diff entre versões consecutivas por `effective_from`, cada mudança = `{field, before, after}` — **nunca** `from`/`to`, pois `from` é palavra reservada em Python), com o diff no hover/tooltip (ex.: "Peso 3 → 4", "Desativado", "Reativado"),
**E** o **multiplicador de tipo de dia** (fim de semana/feriado) é representado **exclusivamente como ritmo/sombreamento** (bandas nos sáb/dom/feriados; a linha de peso efetivo cai nesses dias), **nunca** como marcador de mudança (AD-11 item 2: `day_type`/`multiplier_at_time` são estilo/contexto, jamais evento).

### AC3 — Acessibilidade, paridade tabular e voz (Accessibility Floor, UX-DR4, UX-DR13, UX-DR18, UX-DR20)

**Dado que** "gráficos previstos têm resumo textual e tabela equivalente" (Accessibility Floor do EXPERIENCE.md) e UX-DR4 pede "grid denso (hábitos × dias) na superfície de histórico",
**Quando** a superfície de histórico é renderizada,
**Então** o gráfico tem um **resumo textual** (ex.: hábito, período, nº de dias com registro, nº de mudanças de config no período) e uma **tabela/grade equivalente hábitos × dias** com **headers programáticos** (`<th scope>`), células anunciando **data + estado**, alternativa de **lista no mobile** e **sem scroll horizontal** no fluxo diário mobile (UX-DR18); o gráfico expõe `role="img"` + `aria-label` do resumo (ou `<figure>`/`<figcaption>`),
**E** **cor nunca comunica sozinha** — marcadores e sombreamento sempre acompanhados de texto/ícone/tooltip; **zero gamificação** (sem troféus, sequências, exclamações — UX-DR13); voz pt-BR direta e factual; estados vazios informativos ("Nenhum registro no período.").

### AC4 — Contrato read-only aditivo, sem regressão, on-read (§6.8, AD-11, AD-14, regra de porta)

**Dado que** AD-11/AD-14 fixam que não há schema novo nem série materializada,
**Quando** os endpoints de histórico são adicionados,
**Então** são **GET puros read-only** — nenhuma escrita, nenhuma materialização, nenhuma migration, nenhum model novo — com toda a lógica na **camada de serviço** (assinatura `*, user, ...`), auto-escopada por tenant (fail-closed), reusando os helpers de cálculo existentes (`_contribution`/`_effective_weight`/`_completeness_pct`) sem reimplementar a matemática,
**E** o contrato regenerado (`schema.yaml` + `frontend/src/api/types.gen.ts`) é **aditivo** — os enums `DayTypeEnum`/`HabitTypeEnum`/`TypeEnum` permanecem intactos (gate de diff no CI); `lint-imports` **KEPT** (`core` continua sem importar app de domínio; `habits → accounts` e `core → accounts` permitidos); nenhuma superfície existente regride (tracker de hoje, config, os 3 testes compartilhados da casca).

## Decisões a confirmar (defaults recomendados, buildáveis de ponta-a-ponta)

Segue o guardrail da retro do Épico 5 (resolver ambiguidade favorecendo leitura literal + código existente + arquitetura, documentando inline) e a memória `ask-dont-assume-functionality-flows`. **A UX é silente nos detalhes finos deste gráfico** — confirmado: os workspaces de UX (06-15 e 07-17) só têm menções genéricas ("registro e histórico … previsto no Épico 6"; "gráficos previstos têm resumo textual e tabela equivalente"); AD-11 explicitamente **deferiu a especificação visual fina** ("métricas plotadas, eixos, range de datas") para a UX spec, que não a detalhou. Portanto os defaults abaixo **originam** essa spec sob UX-DR4/DR13/DR18/DR20 + AD-11 + Accessibility Floor. Cada default é implementável sem bloquear; se Hugo vetar algum, ajustar a task correspondente.

1. **Biblioteca de charting (decisão nova — primeira do app).** Nenhuma instalada hoje (`frontend/package.json` não tem recharts/visx/nivo/chart.js/d3/@mui/x-charts). **Default: `recharts` 3.x** (React 19 suportado no peer `^19.0.0`; primitivos composáveis que casam exatamente com AD-11 — `Line` com `connectNulls={false}` para lacunas, `ReferenceLine` vertical para marcadores de mudança, `ReferenceArea` para sombreamento de fim de semana/feriado, `Tooltip` custom para o diff no hover; "prático como default" para React em 2026). **Caveat de instalação:** com React 19 pode ser preciso alinhar/override do `react-is` para a versão do React em uso (19.2). **Alternativa MUI-nativa:** `@mui/x-charts` (peer `@mui/material ^6.0.0` + `react ^19.0.0` OK; `ChartsReferenceLine` + composition API) — temática automática via `createBujoTheme`, porém mais verbosa para marcadores/sombreamento custom. **Recomendação:** recharts pela composição precisa que AD-11 exige; carregar o skill **`dataviz`** antes de escrever o componente de gráfico. Health (Épico 7, FR-3.3) reusará a mesma infraestrutura — investir agora amortiza.
2. **Onde mora a superfície de histórico (rota).** UX-DR17 lista "Hábitos" como superfície única; hoje `/habits` = tracker de HOJE (comentado em `HabitsPage.tsx`) e `/settings/habits` = config. **Default: sub-rota `/habits/history`** alcançada por uma **aba/link dentro da página de Hábitos** (ex.: abas "Hoje" · "Histórico" no topo da HabitsPage) — **NÃO** um novo item de Sidebar/BottomNav (evita a armadilha dos 3 testes compartilhados; ver Dev Notes). A rota entra em `router.tsx` (que `router.test.tsx`/`RouteAnnouncer.test.tsx` já mockam `../features/habits`).
3. **Endpoints (2, read-only).** **Default:** `GET /api/habits/history/?start=&end=` (payload de intervalo que alimenta a grade hábitos × dias **e** o detalhe por-data — o detalhe por-data é uma fatia do intervalo, mesma query key) + `GET /api/habits/<uuid:pk>/series/?start=&end=` (série + eventos de mudança de um hábito). Ambos **não semeiam**. Intervalo **limitado** (default últimos 30 dias; máximo 92 dias → `DomainError` 400 se exceder) para queries determinísticas.
4. **O que a linha principal plota.** AC2 diz "série diária … (valor, peso efetivo)". **Default:** linha principal = comportamento diário — **numérico:** `value` no eixo Y com uma `ReferenceLine` horizontal em `meta_at_time` (a meta); **booleano:** feito/não-feito (1/0) como pontos/step. O **peso efetivo** aparece como **sombreamento de ritmo** (bandas de fim de semana/feriado) e, opcionalmente, uma **linha secundária "step" de peso efetivo** onde os marcadores de mudança pousam (o degrau em mudança de peso; a queda nos sábados). Lacunas = quebras (`connectNulls={false}`). Boolean vs numérico renderizam levemente diferente — documentar.
5. **A grade densa é a tabela acessível.** **Default:** a grade hábitos × dias (UX-DR4) é implementada como `<table>` semântica e **serve como a tabela equivalente** que o Accessibility Floor exige para o gráfico (matam-se dois requisitos com um componente). Células de dia-lacuna = "—" honesto (com texto/aria, não só cor); colunas de fim de semana/feriado visualmente distintas **com rótulo/aria**, não só cor. Mobile: alternativa de lista (por dia ou por hábito), sem scroll horizontal.
6. **`dayType` por dia de calendário (incl. lacunas).** Para sombrear fim de semana/feriado mesmo em dias-lacuna, o intervalo resolve `day_type` para **cada dia de calendário** no range (não só dias materializados). **Default:** adicionar `resolve_day_types_range(user, start, end) -> dict[date, str]` em `core/calendar.py` (uma query em `user_holidays` para o range + cálculo local de fim de semana), evitando N chamadas a `resolve_day_type`. Mantém a precedência `holiday > weekend > weekday` na autoridade única (§6.8) e o import tardio de `accounts.UserHoliday`.
7. **Sem otimismo, sem NFR.** AD-14: modo "revisão histórica" **não tem NFR de performance formal** no MVP. **Default:** `useQuery` puro (sem `useOptimisticMutation`, sem prefetch agressivo) — a superfície é read-only.

## Escopo — o que NÃO entra nesta story (limites explícitos)

- ❌ **Qualquer escrita/mutação na superfície de histórico** — é read-only. Marcar hábito, corrigir `value`/`weight_at_time`, override de multiplicador, toggle de feriado, adicionar versão → já entregues (6.1/6.2/6.3) e permanecem **só no tracker de hoje/config**. Correção de dias passados continua pelo tracker (6.2), não aqui.
- ❌ **Model novo, coluna nova, migration nova.** AD-11 "sem impacto de schema"; AD-14 "sem série materializada separada". A 6.4 é **puramente read-path + frontend**. Se algum default parecer exigir schema, parar e reavaliar (provável erro de abordagem).
- ❌ **Semear dias ao consultar o passado.** A leitura de histórico **nunca** chama `seed_habit_day` — dias pulados são lacunas honestas (AC1). Catch-Up/materialização é do tracker/execução (AD-09/AD-06), não da revisão.
- ❌ **Gráficos de Saúde (FR-3.3)** → Épico 7. A 6.4 só faz o gráfico de **hábitos**; a infraestrutura de charting instalada aqui será reusada lá.
- ❌ **Endpoint agregado `/api/daily/:date/`** (AD-14, reservado, não-MVP) e qualquer view materializada — não nesta story.
- ❌ **Novo item de Sidebar/BottomNav com filho Query-driven** — quebraria os 3 testes compartilhados da casca (ver Dev Notes › "Armadilha dos 3 testes"). Histórico é aba/sub-rota dentro de Hábitos.
- ❌ **Tema escuro como trabalho novo.** O DESIGN 07-17 diz que dark "não é requisito desta primeira fundação"; o código tem `createBujoTheme('dark')` mas os testes usam `'light'`. Usar os tokens temáticos (`palette.category.*` já light/dark-aware) sem inventar spec dark; testes em `createBujoTheme('light')`.
- ❌ **Reconciliação de PRD para FR-2.10** — já feita em 2026-06-22 (`sprint-change-proposal-2026-06-22.md`; FR-2.10 no PRD/epics). Nenhuma ação.

## Tasks / Subtasks

- [x] **Task 1 — `core/calendar.resolve_day_types_range` (batch, read-only) (AC2, AC4, Decisão 6)**
  - [x] Em `backend/core/calendar.py`, adicionar `resolve_day_types_range(user, start: date, end: date) -> dict[date, str]`: uma query única `from accounts.models import UserHoliday` (import tardio, como `resolve_day_type`) → `holidays = set(UserHoliday.objects.filter(date__range=(start, end)).values_list("date", flat=True))`; iterar `d` de `start` a `end` computando localmente a precedência `holiday > weekend > weekday` (feriado por presença no set; fim de semana `d.weekday() >= 5`; senão weekday). Retorna strings literais (core **não** importa `habits.DayType`). Reusa a mesma semântica de `resolve_day_type` — **não** duplicar a lógica de forma divergente; se preferir, `resolve_day_type` pode delegar ao batch com range de 1 dia (opcional). **Não** tocar `is_workday` nem `resolve_day_type` (single-day) existente.
  - [x] `backend/core/tests/test_calendar.py`: testar `resolve_day_types_range` — mapa cobre todos os dias do range; sáb/dom → weekend; feriado marcado → holiday (precedência sobre weekend); dentro de `tenant_context(user)`; datas fixas + `timedelta` (guardrail temporal, nunca `date.today()`).

- [x] **Task 2 — Serviços read-only de histórico em `backend/habits/services.py` (AC1, AC2, AC4)**
  - [x] `get_habit_history_range(*, user, start, end) -> dict` (**sem** `@transaction.atomic` — read-only; **não** semeia): validar `start <= end` e `(end - start).days <= 92` senão `DomainError`. **Uma** query `HabitDayEntry.objects.filter(date__range=(start, end)).select_related("habit__group")` (auto-escopada); agrupar em Python por data e por hábito (**sem N+1** — endereça o follow-up de N+1 das 6.1/6.2/6.3). Resolver `dtypes = resolve_day_types_range(user, start, end)` (Task 1). Montar: `habits` (identidade dos hábitos que aparecem no range, ordenados por grupo `display_order`,`name`), e `days` = **todos** os dias de calendário em `[start, end]` cada um `{date, day_type: dtypes[date], total_completion: <int|None gap>, groups: [{id, name, completion}], entries: [...]}` — dia sem linha → `total_completion = None`, `groups = []` (lacuna honesta) e `entries = []`. **AC1 exige o % ponderado POR GRUPO no detalhe por-data** (não só o total): montar `groups` **exatamente como `compute_day_completeness` faz** (`services.py:341-350` — agrupa as linhas do dia por grupo e chama `_completeness_pct` por grupo), reusando o `HabitDayGroupSerializer` existente. Reusar `_completeness_pct`/`_contribution`/`_effective_weight` para todos os %; **não** reimplementar a matemática nem calcular % no frontend. Nota: `_completeness_pct([])` retorna `0` (não `None`) — ramificar para `None`/`[]` explicitamente nos dias-lacuna.
  - [x] `get_habit_series(*, user, habit_id, start, end) -> dict` (read-only, não semeia): validar range (≤92, `start<=end`) e existência/escopo do hábito (`Habit.objects.get(id=habit_id)` → deixa o `DoesNotExist` virar 404 na view, como as views existentes; cross-tenant = 404). `points` = uma query `HabitDayEntry.objects.filter(habit_id=habit_id, date__range=(start,end))` → por dia `{date, value, effective_weight: _effective_weight(e), day_type: e.day_type}`; dias sem linha **omitidos** (o frontend desenha lacuna) **ou** marcados — escolher e documentar (default: omitir; o eixo X é o range, gap = ausência). `events` = derivar de `HabitVersion.objects.filter(habit_id=habit_id).order_by("effective_from", "created_at")` (**ascendente** — o `Meta.ordering` do model é descendente, então o `order_by` explícito é obrigatório): para cada versão, diff contra a **anterior** → `{effective_from, changes: [{field, before, after}]}` para `field ∈ {weight, meta, bonus, active}` que mudaram (ativação/desativação = mudança de `active`; primeira versão = opcionalmente `{field:"created", ...}` ou omitida — default: primeira versão só entra se seu `effective_from` estiver no range e representa "criado"). **Chaves `before`/`after`, NUNCA `from`/`to`** (`from` é palavra reservada em Python — quebraria a definição do serializer). Incluir apenas eventos com `effective_from` dentro (ou imediatamente relevante) ao range. Também retornar a identidade do hábito (`{id,name,emoticon,type,unit,group}`) e `day_types` do range (para o sombreamento) — reusar `resolve_day_types_range`.
  - [x] Manter as funções como **funções de módulo** (nunca classes); `user` = primeiro kwarg keyword-only; scoping implícito via `TenantManager` (**não** passar `user_id`, **não** usar `all_objects`); só exceções de `core/exceptions.py` (`DomainError` para range inválido). Nenhuma escrita → **nenhum** `@transaction.atomic` nessas leituras.

- [x] **Task 3 — Serializers read-only em `backend/habits/serializers.py` (AC1, AC2, AC4)**
  - [x] **Por-data / grade (AC1):** reusar `HabitDayEntrySerializer`/`HabitDayGroupSerializer` existentes onde couber. Adicionar `HabitHistoryDaySerializer` (`date`, `day_type`, `total_completion` **allow_null** para lacuna, **`groups` many via `HabitDayGroupSerializer`** [AC1 exige % por grupo], `entries` many) e `HabitHistoryRangeSerializer` (`start`, `end`, `habits` many via **um `HabitSlimSerializer` novo — `id, name, emoticon, type, unit, group`**, `days` many via `HabitHistoryDaySerializer`).
    - ⚠️ **NÃO** reusar `HabitSerializer` para `habits`: ele lê `source="current_version.weight"`/`.active`/`.meta`/`.bonus`/`.effective_from` (`serializers.py:36-60`), e só `list_habits`/`create_habit` anexam `habit.current_version`. Os serviços de histórico derivam identidade de `entry.habit` (Habit puro, **sem** `current_version`) → `HabitSerializer` estouraria `AttributeError`. Usar o serializer slim.
  - [x] **Série (AC2):** `HabitChangeSerializer` (`field`, `before`, `after`) — **campos `before`/`after`, NUNCA `from`/`to`** (`from` é palavra reservada em Python → `SyntaxError` na classe). **`field` como `serializers.CharField` (NÃO `ChoiceField`)** para **não emitir enum novo** no contrato (evita a colisão de enum do drf-spectacular — mesmo racional de `type`/`day_type` das 6.1/6.3; ver Dev Notes › "Enum"). `before`/`after` como `CharField(allow_null=True)` (valores heterogêneos: decimais-string, booleanos → serializar como string estável). `HabitSeriesPointSerializer` (`date`, `value` allow_null, `effective_weight`, `day_type` reusa `DayTypeEnum`). `HabitVersionEventSerializer` (`effective_from`, `changes` many). `HabitSeriesSerializer` (`habit` via `HabitSlimSerializer`, `points` many, `events` many, opcional `day_types`).
  - [x] Todos **read-only** (sem `validate`/write). Decimais continuam como **string** no wire (padrão do projeto). Query params (`start`/`end`/`date`) validados na view via serializer leve ou parse direto com erro `DomainError`/400.

- [x] **Task 4 — Views + rotas GET read-only em `backend/habits/` (AC1, AC2, AC4)**
  - [x] `backend/habits/views.py`: `HabitHistoryRangeView(APIView).get` → parse `start`/`end` (default: `end = today_for(user)`, `start = end - 29 dias`; **nunca** `date.today()` cru); chama `get_habit_history_range`; `HabitHistoryRangeSerializer`. `HabitSeriesView(APIView).get` → `pk` do hábito + `start`/`end`; chama `get_habit_series`; `HabitSeriesSerializer`; `Habit.DoesNotExist` → 404 (como as views existentes). `@extend_schema` com `OpenApiParameter` para `start`/`end`. Views **finas** (parse → serviço → serializer); **nenhuma** transação, **nenhuma** materialização.
  - [x] `backend/habits/urls.py`: adicionar `path("history/", HabitHistoryRangeView.as_view(), name="habit-history")` **antes** de `<uuid:pk>/` (como `days/`/`holidays/` já são). A série fica sob o uuid do hábito: `path("<uuid:pk>/series/", HabitSeriesView.as_view(), name="habit-series")` (sufixo específico, não colide). **Nenhuma** mudança em `config/urls.py`.
  - [x] **Não** tocar `HabitDayView` (o `days/` que **semeia** — é o tracker de hoje, comportamento correto lá). A não-semeadura é garantida por usar `get_habit_history_range`/`get_habit_series`, que nunca chamam `seed_habit_day`.

- [x] **Task 5 — Regenerar contrato + verificar aditividade (AC4)**
  - [x] `cd backend && uv run python manage.py spectacular --file ../schema.yaml` + (frontend) `npm run generate-types` → commitar `schema.yaml` **e** `frontend/src/api/types.gen.ts`.
  - [x] Verificar diff **aditivo**: novos schemas `HabitHistoryRange`/`HabitHistoryDay`/`HabitSeries`/`HabitSeriesPoint`/`HabitVersionEvent`/`HabitChange`; **nenhum enum novo** (se `field` for CharField); `DayTypeEnum`/`HabitTypeEnum`/`TypeEnum` **inalterados** (gate de diff no CI falha se mudarem). Se por acaso um enum novo aparecer, pinar em `SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"]` (`backend/config/settings/base.py`) — mas o default (CharField) evita isso.

- [x] **Task 6 — Frontend: biblioteca de charting + keys + hooks read-only (AC2, AC4, Decisão 1/3/7)**
  - [x] Instalar a lib de gráfico (default `recharts`): `nvm use 22.15.1` então `npm install recharts` no `frontend/`, **pinando uma versão exata 3.x** (não range flutuante — é a 1ª dep de charting; determinismo no CI). Se houver conflito de peer com React 19.2, alinhar/override do `react-is` para casar a versão do React (documentar a versão pinada + override no Debug Log). Verificar `tsc` + `vite build` limpos com a versão escolhida antes de seguir. Commitar `package.json` + lockfile. **Carregar o skill `dataviz` antes de escrever o gráfico.**
  - [x] `frontend/src/api/keys.ts` seção `habits`: `history: (range: { start: string; end: string }) => ['habits', 'history', range] as const` e `series: (habitId: string, range: { start: string; end: string }) => ['habits', 'series', habitId, range] as const` (sem `userId`, como o resto de `habits.*`).
  - [x] `frontend/src/features/habits/api.ts`: `useHabitHistoryQuery({ start, end })` (GET `/api/habits/history/?start=&end=`, key `keys.habits.history`) e `useHabitSeriesQuery(habitId, { start, end })` (GET `/api/habits/${habitId}/series/`, key `keys.habits.series`). **`useQuery` puro** (read-only; sem otimismo/prefetch — AD-14). Re-exportar em `index.ts`.
  - [x] `frontend/src/features/habits/types.ts`/`index.ts`: re-exportar os tipos gerados novos (`HabitHistoryRange`, `HabitHistoryDay`, `HabitSeries`, `HabitSeriesPoint`, `HabitVersionEvent`, `HabitChange`).

- [x] **Task 7 — Frontend: página/rota de histórico + navegação por data (AC1, AC3, Decisão 2)**
  - [x] Nova página `frontend/src/pages/habits/HabitHistoryPage.tsx` (camada `pages/`, compõe só `features/habits`) OU estender `HabitsPage.tsx` com abas "Hoje" · "Histórico". **Default:** sub-rota `/habits/history` + aba/link no topo da HabitsPage (a HabitsPage vira um shell com "Hoje" [tracker] e "Histórico"). Registrar a rota em `frontend/src/app/router.tsx` (array `routeDefinitions`, title "Hábitos — Histórico"). **NÃO** adicionar item novo em `Sidebar.tsx`/`BottomNav.tsx`.
    - Nota (nit): `Sidebar.tsx:87` usa match **exato** (`location.pathname === path`) e o item "Hábitos" aponta para `/habits` (`Sidebar.tsx:68`) — em `/habits/history` o item perde o realce de ativo. Se quiser preservar o realce, trocar por `startsWith` **só nesse item** (sem tocar a estrutura da nav, para não afetar os 3 testes compartilhados); caso contrário, perder o realce na sub-rota é aceitável.
  - [x] Componente `frontend/src/features/habits/components/HabitHistory.tsx`: **controle de intervalo/data** (anterior/próximo período + seletor; locale pt-BR; *accessible name* com data completa), **seletor de hábito** (para o gráfico), e a composição do gráfico + grade + detalhe por-data. Estados: loading (skeleton, sem spinner global — UX-DR14), vazio ("Nenhum registro no período."), erro inline.
  - [x] **Detalhe por-data (AC1):** ao selecionar uma data dentro do range, renderizar **read-only** os hábitos e valores daquele dia (agrupados, % do grupo, % total, `dayType`), reaproveitando a apresentação do tracker **em modo somente-leitura** (sem checkbox/campo editável/toggle). Dia-lacuna → "Sem registro neste dia." (nunca 0%). Fatia do payload de `useHabitHistoryQuery` (mesma key), sem request extra.

- [x] **Task 8 — Frontend: gráfico de evolução por hábito (AC2, AC3)**
  - [x] `frontend/src/features/habits/components/HabitEvolutionChart.tsx` (recharts): `LineChart` responsivo; **linha principal** = `value` por dia (numérico) com `ReferenceLine` horizontal em `meta_at_time` / feito-não-feito (booleano); `connectNulls={false}` para **lacunas** (dias sem registro = quebra, não zero). **`ReferenceArea`** por bloco contíguo de fim de semana/feriado (sombreamento de **ritmo**, derivado de `day_types`/`point.dayType`) — **com rótulo/aria**, cor nunca sozinha. **`ReferenceLine` vertical** em cada `event.effectiveFrom` (marcador de mudança discreto: linha + ponto) com **`Tooltip` custom** mostrando o diff ("Peso 3 → 4", "Desativado", "Reativado"). O multiplicador **nunca** vira `ReferenceLine` de mudança (AD-11). Cores das séries a partir de `theme.palette.category.*` (light/dark-aware); marcadores/sombreamento via `theme.palette.text`/`divider`. Voz UX-DR13; `Intl.NumberFormat('pt-BR')` para decimais (padrão `formatNumber` do `HabitTracker.tsx:32`).
  - [x] **A11y do gráfico (AC3):** wrapper `role="img"` + `aria-label` com o **resumo textual** (hábito, período, nº de dias com registro, nº de mudanças no período), ou `<figure>`+`<figcaption>`. O gráfico **não** é a única representação — a grade/tabela (Task 9) é a equivalente acessível.

- [x] **Task 9 — Frontend: grade densa hábitos × dias = tabela acessível (AC1, AC3, UX-DR4)**
  - [x] `frontend/src/features/habits/components/HabitHistoryGrid.tsx`: `<table>` semântica com **linhas = hábitos**, **colunas = dias** do range; cabeçalhos programáticos (`<th scope="col">` datas, `<th scope="row">` hábitos); célula = `value`/feito + contexto de peso efetivo; **célula-lacuna** = "—" honesto (texto/aria, não só cor); colunas de fim de semana/feriado **distintas com rótulo/aria** (não só cor). Serve como **a tabela equivalente** que o Accessibility Floor exige para o gráfico (AC3). Células anunciam **data + estado**.
  - [x] **Mobile (UX-DR18):** alternativa de **lista** (por dia ou por hábito) — **sem scroll horizontal** no fluxo diário. Breakpoints desktop ≥1024 / tablet 768–1023 / mobile <768.

- [x] **Task 10 — Testes backend (todas as ACs)**
  - [x] `habits/tests/test_services.py`: (a) **`get_habit_history_range`** — dias materializados retornam % correto (reusa a âncora da 6.3), dias sem linha → `total_completion=None` (lacuna) e `entries=[]`; **não semeia** (assert `HabitDayEntry.objects.count()` inalterado antes/depois); ordenação de grupos; range >92 → `DomainError`; `start>end` → `DomainError`. (b) **`get_habit_series`** — `points` com `value`/`effective_weight`/`day_type` e lacunas; `events` derivados de versões consecutivas (mudança de peso 3→4; meta/bonus; **ativar/desativar** = mudança de `active`); cross-tenant `habit_id` → 404 (via `DoesNotExist`); range bound. (c) **não-semeadura** explícita: consultar um sábado passado nunca-aberto → gap, zero linhas criadas. Reusar factories existentes (`HabitFactory`, `HabitVersionFactory(effective_from=...)`, `HabitDayEntryFactory`); datas fixas + `timedelta`.
  - [x] `core/tests/test_calendar.py`: `resolve_day_types_range` (Task 1).
  - [x] `habits/tests/test_serializers.py`: shapes read-only; **`field` como string** (assert que o schema não emite enum novo — ou ao menos que o valor serializa como esperado).
  - [x] `habits/tests/test_views.py`: GET `/api/habits/history/` e `/api/habits/<pk>/series/` — 200 com shape correto (camelCase no wire; **snake_case em `response.data`** — ver 6.2 Debug Log), query params `start`/`end`, payload de lacuna, cross-tenant 404, data/range inválidos 400. **Nenhum model novo → nenhum isolation case novo** no gate parametrizado (a story não adiciona `TenantModel`).

- [x] **Task 11 — Testes frontend (AC1, AC2, AC3)**
  - [x] `features/habits/api.test.tsx`: `useHabitHistoryQuery` e `useHabitSeriesQuery` (payload + key corretos). Fixtures novas de history/series (camelCase, decimais como string, `dayType`).
  - [x] `features/habits/components/HabitHistory.test.tsx`: navegação por data renderiza o dia selecionado; **dia-lacuna** mostra "Sem registro neste dia." (não 0%); read-only (sem controles editáveis); a11y (`jest-axe`, `ThemeProvider theme={createBujoTheme('light')}`).
  - [x] `features/habits/components/HabitEvolutionChart.test.tsx`: renderiza a série + marcador de mudança (tooltip com o diff) + sombreamento; `role="img"`/`aria-label` de resumo presente; a11y. **Nota jsdom+recharts:** o `ResponsiveContainer` precisa de dimensões — usar largura/altura fixas no teste ou mockar `ResizeObserver`/`getBoundingClientRect` (documentar o padrão no Debug Log).
  - [x] `features/habits/components/HabitHistoryGrid.test.tsx`: `<table>` com headers programáticos, células-lacuna "—", distinção de fim de semana por texto/aria (não só cor), a11y.
  - [x] **NÃO** adicionar filho com TanStack Query a `Sidebar`/`BottomNav` — a superfície de histórico vive no `<Outlet/>` (páginas), então não afeta os 3 testes compartilhados. Confirmar que a nova aba/rota não quebra `router.test.tsx`/`RouteAnnouncer.test.tsx` (já mockam `../features/habits`).

- [x] **Task 12 — Verificação e contrato (AC4)**
  - [x] Backend verde: `ruff`, `lint-imports` (**KEPT** — `core` continua sem importar app de domínio; `core → accounts` e `habits → accounts` permitidos; nenhum import cruzado novo), `pytest` (escopado a `core habits accounts` + suíte relevante; rodar em blocos foreground `--reuse-db` cobrindo todos os apps na rodada final).
  - [x] `spectacular` + diff de `types.gen.ts` **aditivo** (novos schemas; `DayTypeEnum`/`HabitTypeEnum`/`TypeEnum` estáveis; sem enum novo).
  - [x] Frontend verde: `nvm use 22.15.1` antes de todo comando; `tsc`, ESLint (fronteira de feature — `pages/habits` compõe só `features/habits`; `features/habits` não importa outra feature), `vitest`, `vite build`. Nova dependência instalada limpa (com override de `react-is` se necessário). **Não** passar `--no-file-parallelism`/`--workers=1` (já default).
  - [x] **Sem migrations nesta story** (read-only) — **nada a aplicar** nas branches Neon `dev`/`e2e`. Confirmar explicitamente (diferente das 6.1/6.2/6.3, que tiveram migrations).

## Dev Notes

### Contexto de arquitetura — AD-11 é a camada de LEITURA sobre o que 6.1/6.2/6.3 materializaram

A 6.4 fecha o Épico 6 sem tocar no banco. Toda a informação já existe:
- **`habit_versions`** (6.1) — timeline prospectiva de config; **stream de eventos** de mudança real (peso/meta/bonus/ativação) [Source: architecture.md#AD-06 linhas 298-299; #AD-11 linha 643].
- **`habit_day_entries`** (6.2/6.3) — snapshot realizado por dia (`value`, `weight_at_time`, `meta_at_time`, `bonus_at_time`, `day_type`, `multiplier_at_time`); **série diária** [Source: architecture.md#AD-06 linha 300; #AD-11 linha 644].
- **`day_type`/`multiplier_at_time`** (6.3) — **ritmo/contexto, nunca evento** [Source: architecture.md#AD-11 linha 645].

AD-11 exige que a série de um hábito **nunca confunda três fontes de variação**: (1) valor/comportamento, (2) mudança real de config (evento discreto datado), (3) multiplicador de tipo de dia (ritmo periódico). Por isso: **eventos** vêm do stream de `habit_versions` (marcadores); **ritmo** vem de `day_type`/`multiplier_at_time` (sombreamento) [Source: architecture.md#AD-11 linhas 634-653]. **Série derivada on-read, sem materialização separada** (AD-14) [Source: architecture.md §6.8 linha 957; #AD-14 linhas 729-739].

| Fonte na leitura | Estrutura | Como aparece no gráfico |
|---|---|---|
| Comportamento diário | `habit_day_entries.value` | Linha principal (gap onde não há linha) |
| Peso operante do dia | `weight_at_time × multiplier_at_time` | Step de peso efetivo / contexto |
| Mudança real de config | diff de `habit_versions` consecutivas | **Marcador** vertical + diff no hover |
| Ritmo de tipo de dia | `day_type`/`multiplier_at_time` | **Sombreamento** de fds/feriado (NUNCA marcador) |
| Dia pulado | ausência de linha em `habit_day_entries` | **Lacuna honesta** (nunca 0%) |

### ⚠️ O ponto de correção nº 1 — read-path NÃO-SEMEADOR (AC1)

`HabitDayView.get` (`backend/habits/views.py:142-182`) **chama `seed_habit_day` antes de retornar** — correto para o tracker de HOJE (materializa a 1ª abertura). Mas para o **histórico** isso **fabricaria** linhas (e um 0%) para dias que o usuário nunca abriu, violando AC1 ("lacunas honestas, nunca 0% fabricado"). Portanto:
- A leitura de histórico **nunca** chama `seed_habit_day`.
- `compute_day_completeness` (`services.py:322`) **já é não-semeador** — lê só as linhas existentes ("Sole source: HabitDayEntry rows for the day") — e reusa `_completeness_pct`. Os novos serviços de histórico seguem o mesmo padrão.
- Dia sem linha → **lacuna** (`total_completion=None`, `entries=[]`), não 0. Teste explícito: `HabitDayEntry.objects.count()` inalterado após consultar um dia passado nunca-aberto.
[Source: backend/habits/views.py:142-182; backend/habits/services.py:322-352]

### Matemática: reusar, nunca reimplementar (AC4)

Os helpers de cálculo já estão corretos e testados (6.2/6.3) — a 6.4 **os reusa** para não divergir:
- `_contribution(entry)` (`services.py:273-291`) — booleano (1 se `value==1`) / numérico (proporcional até a meta, ganha bonus ao atingir).
- `_effective_weight(entry)` (`services.py:294-301`) — `weight_at_time × multiplier_at_time`.
- `_completeness_pct(entries)` (`services.py:304-319`) — `Σ(contrib×peso_efetivo)/Σ(peso_efetivo)`, guarda `Σ==0→0`, `ROUND_HALF_UP`.
Expor os % já calculados; **o frontend não faz matemática** (só exibe) — confirmado no tracker [Source: backend/habits/services.py:273-352; frontend/src/features/habits/components/HabitTracker.tsx].

### Derivação do stream de eventos (`habit_versions` → marcadores) (AC2)

`HabitVersion` (`models.py:83-110`): `weight`, `active`, `meta`, `bonus`, `effective_from`, ordenado por `["habit", "-effective_from", "-created_at"]`. Para o gráfico, ordenar **ascendente** por `effective_from` e diffar **versões consecutivas** → um evento por transição, com `changes` só dos campos que mudaram:
- Peso: "Peso 3 → 4". Meta/bonus: análogo. `active` false→true = "Reativado"; true→false = "Desativado" (FR-2.7/2.8).
- Primeira versão = criação (default: só entra como marcador se `effective_from` no range; rótulo "Criado").
- Decimais comparados como `Decimal`; serializados como **string** no wire (padrão do projeto). Ativação/desativação **é mudança real** → marcador (não confundir com o gap de série entre desativar/reativar) [Source: architecture.md#AD-11 linha 643, caso-âncora linha 654].

### Enum no contrato — evitar colisão do drf-spectacular (AC4)

`changes.field` (weight/meta/bonus/active/created) **não** deve ser `ChoiceField` — isso emitiria um `*Enum` novo e arriscaria a renomeação com hash instável que já mordeu as 6.1/6.3 (`type` de habits × `type` de bujo; dois `day_type`) [Source: backend/config/settings/base.py:160-193; story 6.3 Dev Notes "Colisão de enum"]. **Usar `serializers.CharField`** para `field` (e `before`/`after` como string; **nunca** nomear um campo `from` — palavra reservada em Python) → **nenhum enum novo** no wire. `day_type` nos pontos reusa o `DayTypeEnum` já pinado (mesmos 3 valores) — sem colisão. Se, por descuido, um enum novo aparecer no diff, pinar em `ENUM_NAME_OVERRIDES`.

### Regra de porta — o que o `lint-imports` deve manter (KEPT)

- `core` **continua sem** importar app de domínio. `resolve_day_types_range` importa **`accounts`** (import tardio, como `resolve_day_type`) → permitido (`accounts` é `root_package`, não está em `forbidden_modules`) [Source: backend/pyproject.toml:52-59; backend/core/calendar.py:62-86].
- `habits` **não** precisa de import novo cross-app para os serviços de histórico (lê `HabitDayEntry`/`HabitVersion` locais + chama `core.calendar`). Nenhuma nova aresta.
- Confirmar `lint-imports` **KEPT** após as mudanças.

### Frontend — superfície read-only, sem otimismo, dentro da fronteira de feature

- **Read-only:** `useQuery` puro (sem `useOptimisticMutation`); AD-14 não impõe NFR ao modo de revisão histórica [Source: architecture.md#AD-14 linhas 729-739]. Sem prefetch agressivo (o Daily Log tem; o histórico não precisa).
- **Fronteira (§7.2, ESLint):** o gráfico/grade/histórico moram em `features/habits/components/`; a **página** em `pages/habits/` compõe **só** `features/habits` (não importa outra feature). `features/habits` expõe tudo pelo barrel `index.ts` [Source: architecture.md §7.1-7.2 linhas 1128-1152].
- **Cores/tema:** séries via `theme.palette.category.*` (6 cores, light/dark-aware, `theme.ts:76-82,122-129`); marcadores/sombreamento via `text`/`divider`. Zero elevation, `disableRipple`, `borderRadius≤8` (UX-DR1) — estética "ferramenta, não produto de consumo" (marcadores funcionais, sem floreio — AD-11 item 3). **Carregar o skill `dataviz`** antes de codar o gráfico.
- **A11y (Accessibility Floor):** gráfico com resumo textual + **tabela equivalente** (a grade hábitos × dias mata os dois requisitos); `role="img"`/`aria-label` ou `<figure>`; grids com headers programáticos, células anunciam data+estado; **cor nunca sozinha**; sem scroll horizontal mobile; reduced motion sem transições bloqueantes [Source: EXPERIENCE.md#Accessibility-Floor linhas 155-165; #Responsive linhas 167-176; UX-DR4/DR18/DR20].
- **Voz (UX-DR13):** pt-BR direto, **zero gamificação/troféus/sequências/exclamações**; estados vazios informativos ("Nenhum registro no período.", "Sem registro neste dia.") [Source: EXPERIENCE.md#Voice linhas 73-85; epics.md#UX-DR13].

### Armadilha dos 3 testes compartilhados (regressão conhecida)

`Sidebar.test.tsx`/`BottomNav.test.tsx`/`AppLayout.test.tsx` renderizam a casca **sem** `QueryClientProvider`; um filho Query-driven em `Sidebar`/`BottomNav` quebra os 3. A superfície de histórico vive no `<Outlet/>` (páginas), então **não** os afeta — desde que o histórico seja **aba/sub-rota dentro de Hábitos**, não item novo de Sidebar/BottomNav. `router.test.tsx`/`RouteAnnouncer.test.tsx` já mockam `../features/habits` [Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; story 6.2/6.3 Dev Notes].

### N+1 — a leitura por-range é a oportunidade de fazer certo

Os follow-ups LOW das 6.1/6.2/6.3 apontaram N+1 (`multiplier_for` por linha etc.). A 6.4 **não** deve repetir: `get_habit_history_range`/`get_habit_series` usam **uma** query em `habit_day_entries` (com `select_related("habit__group")`) + **uma** query de feriados no range (via `resolve_day_types_range`), agrupando em Python. Sem NFR formal, mas é o padrão limpo e barato [Source: story 6.3 Review Follow-ups; architecture.md §6.8].

### Ambiente / CI / operação (retros Épico 5 + memórias)

- **Node ≥ 22.15.1 via nvm** antes de todo comando de frontend/e2e (sessão inicia em v18) [Source: memória `frontend-needs-node-22-via-nvm`].
- **Paralelismo Neon**: `fileParallelism:false` (vitest) e `workers:1` (playwright) já default — **não** passar flags [Source: epic-5-retro §7].
- **Sem migrations nesta story** — nada a aplicar em branches Neon (diferente das 6.1/6.2/6.3). Só a nova dep de frontend (`npm install`) [Source: AD-11 "sem impacto de schema"; AD-14].
- **Gates de CI** (ordem): `ruff` → `lint-imports` → `pytest` → `spectacular` + diff de `types.gen.ts` (backend); `tsc` → ESLint → `vite build` (frontend). **Vitest não roda no CI** — rede local/review [Source: .github/workflows/ci.yml].
- **Suíte grande e serial** (~20 min, `workers:1`): rodar em blocos foreground `--reuse-db` cobrindo **todos** os apps na rodada final, sem omitir [Source: story 6.2/6.3 Debug Log].
- **Contagem de testes colada literalmente** após rodar (guardrail retro Épico 3/11) [Source: epic-5-retro §3].
- **Commit ao fim da story**: 1 commit/story; rodar `/bmad-uncommitted-report`, salvar o report, então commitar **sem** pedir "[S]im" [Source: memória `commit-at-end-of-each-story`].

### Inteligência da story anterior (6.3 — mesmo épico)

- **`response.data` do DRF é snake_case** (camelização só no renderer JSON): asserts de view em `total_completion`/`day_type`/`effective_weight`, não camelCase. Wire JSON é camelCase (tipos gerados) [Source: story 6.2 Debug Log].
- **Decimais como string** no wire e nos tipos gerados (`multiplierAtTime?: string`, `value: string|null`) [Source: frontend/src/api/types.gen.ts:763-787].
- **`ROUND_HALF_UP`** no arredondamento de completude (já em `_completeness_pct`) [Source: backend/habits/services.py:304-319].
- **jsdom + `input type=number`**: `userEvent.type` não funciona bem — não relevante aqui (histórico é read-only), mas o padrão de teste (mock de `../../../api/client`, `ThemeProvider(createBujoTheme('light'))`, `jest-axe`) se aplica [Source: story 6.3 Debug Log; frontend/src/features/habits/components/HabitTracker.test.tsx:1-19].
- **File List honesto** e contagem de testes após o último teste [Source: epic-5-retro §3].

### Project Structure Notes

- **Backend `core/`:** `calendar.py` (+`resolve_day_types_range`; **não** tocar `resolve_day_type`/`is_workday`), `tests/test_calendar.py` (+testes). Sem tocar `models.py`/contrato de porta.
- **Backend `habits/`:** `services.py` (+`get_habit_history_range`, +`get_habit_series`; reusa `_contribution`/`_effective_weight`/`_completeness_pct`; **sem** `@transaction.atomic` — read-only), `serializers.py` (+serializers read-only de history/series; `field` como CharField), `views.py` (+`HabitHistoryRangeView`, +`HabitSeriesView`; **não** tocar `HabitDayView`), `urls.py` (+`history/` antes de `<uuid:pk>/`, +`<uuid:pk>/series/`), `tests/test_services.py`/`test_serializers.py`/`test_views.py` (+testes). **Sem** model/migration novo, **sem** admin, **sem** factory nova (reusa as existentes). **Sem** isolation case novo (não há `TenantModel` novo).
- **Backend `config/`:** **não** tocar `urls.py`; `settings/base.py` só se um enum novo escapar (default: não).
- **Frontend:** `package.json`+lockfile (+recharts), `api/keys.ts` (+`habits.history`, +`habits.series`), `features/habits/api.ts` (+2 hooks read-only), `types.ts`/`index.ts` (+tipos), `components/HabitHistory.tsx` + `HabitEvolutionChart.tsx` + `HabitHistoryGrid.tsx` (novos), `pages/habits/HabitHistoryPage.tsx` (novo) ou HabitsPage com abas, `app/router.tsx` (+rota `/habits/history`). Testes: `api.test.tsx`, `HabitHistory.test.tsx`, `HabitEvolutionChart.test.tsx`, `HabitHistoryGrid.test.tsx`. **Não tocar** `Sidebar.tsx`/`BottomNav.tsx`.
- **Regenerados:** `schema.yaml`, `frontend/src/api/types.gen.ts`.
- **Variância de estrutura:** nenhuma nova além dos componentes/página de histórico. O gráfico é a primeira superfície de charting — a dep nova é a única mudança de infraestrutura.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.4 linhas 1190-1211] — user story + ACs originais (histórico por data; gráfico de evolução; ordem/on-read)
- [Source: _bmad-output/planning-artifacts/epics.md linhas 61-62 (FR-2.9/2.10), 134 (AR-17), 156 (UX-DR4), 168 (UX-DR13), 176-178 (UX-DR18/DR20), 284 (objetivo Épico 6)] — requisitos
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-06 linhas 290-355] — snapshot de hábitos (habit_versions + habit_day_entries; grão por (user,habit,date); denominador = linhas do dia; edição não sangra)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-11 linhas 634-656] — política de anotação: eventos via stream de habit_versions; multiplicador é ritmo (nunca evento); marcadores discretos com diff no hover; sem schema novo; casos-âncora
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-14 linhas 729-739] — revisão histórica sem NFR de performance formal no MVP
- [Source: _bmad-output/planning-artifacts/architecture.md §6.8 linhas 949-957] — materialização/cálculo só no serviço; série do gráfico derivada on-read, sem série materializada separada
- [Source: _bmad-output/planning-artifacts/architecture.md §7.1-7.2 linhas 1119-1152] — estrutura frontend (pages/ compõe features/; barrel; ESLint boundary)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md linhas 61-71 (padrões de página: Histórico, Registro), 155-165 (Accessibility Floor: gráficos com resumo textual + tabela equivalente), 167-176 (Responsive)] — a superfície e o piso de a11y
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md linhas 100-125 (estética editorial, pouca cor, cor nunca sozinha), 16-37 (tokens de cor)] — voz visual e paleta
- [Source: backend/habits/models.py:83-205] — `HabitVersion` (stream de eventos), `HabitDayEntry` (série), `DayType`
- [Source: backend/habits/services.py:36-52, 229-352, 273-319] — `current_version_of`/`multiplier_for`, `seed_habit_day` (NÃO usar no histórico), `compute_day_completeness` (não-semeador, modelo a espelhar), `_contribution`/`_effective_weight`/`_completeness_pct` (reusar)
- [Source: backend/habits/views.py:142-182] — `HabitDayView` que **semeia** (o contraste que motiva o read-path não-semeador do histórico)
- [Source: backend/habits/serializers.py:122-168] — `HabitDayEntrySerializer`/`HabitDaySerializer`/`HabitDayGroupSerializer` (base a estender)
- [Source: backend/habits/urls.py; backend/config/urls.py:15-16] — rotas de habits (adicionar `history/`/`series/`; não tocar config/urls)
- [Source: backend/core/calendar.py:14-19, 62-86] — `today_for`, `resolve_day_type` (padrão a espelhar em `resolve_day_types_range`; import tardio de accounts)
- [Source: backend/config/settings/base.py:160-193] — `SPECTACULAR_SETTINGS`/`ENUM_NAME_OVERRIDES` (precedente de colisão; usar CharField para evitar)
- [Source: backend/pyproject.toml:52-59] — contrato import-linter (core sem domínio; accounts permitido)
- [Source: frontend/src/features/habits/api.ts:23-272; frontend/src/api/keys.ts:33-42] — hooks + query-key factory de habits (padrão a espelhar; `useQuery` puro)
- [Source: frontend/src/features/habits/components/HabitTracker.tsx:17-204] — `formatNumber`/`GroupSection`/apresentação read-only a reaproveitar no detalhe por-data
- [Source: frontend/src/pages/habits/HabitsPage.tsx; frontend/src/app/router.tsx; frontend/src/app/layout/Sidebar.tsx:68] — página/rota de Hábitos (adicionar `/habits/history`; não tocar Sidebar/BottomNav)
- [Source: frontend/src/theme.ts:59-146] — `createBujoTheme`, `palette.category.*` (paleta categórica para séries), `palette.priority.*`, tokens light/dark
- [Source: frontend/src/api/types.gen.ts:685-984] — tipos gerados de habits (DayTypeEnum, HabitDay, HabitDayEntry, HabitVersion; decimais como string)
- [Source: _bmad-output/implementation-artifacts/6-3-multiplicador-de-peso-por-tipo-de-dia.md; 6-2-*.md] — stories anteriores (mesmo épico): reuso de `weight_at_time`/peso efetivo, snake_case em `.data`, colisão de enum, armadilha dos 3 testes, N+1
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-17.md §3/§6/§7] — ambiente/CI/aprendizados aplicáveis
- [Source: memórias do projeto] — `commit-at-end-of-each-story`, `story-language-conventions`, `frontend-needs-node-22-via-nvm`, `sidebar-bottomnav-shared-tests-need-query-mock`, `ask-dont-assume-functionality-flows`
- [Source: skill `dataviz`] — guia de design de gráfico (carregar antes de codar o gráfico)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — workflow bmad-dev-story.

### Debug Log References

- **Biblioteca de charting (1ª do app):** `recharts@3.9.2` pinada **exata** (não range) em `frontend/package.json`. Instalação limpa com React 19.2 — **sem** conflito de peer, **sem** necessidade de override de `react-is` (`react-is@19.2.7` já deduplicado via `@mui/utils`). Sem `--force`/`--legacy-peer-deps`.
- **jsdom + recharts:** `ResponsiveContainer` usa `ResizeObserver` (ausente em jsdom) e mede via `getBoundingClientRect`. Padrão adotado em `HabitEvolutionChart.test.tsx`: mockar `globalThis.ResizeObserver` + `HTMLElement.prototype.getBoundingClientRect` (dimensões fixas) num `beforeAll`. As asserções principais (role=img/aria-label, lista de mudanças, legenda de sombreamento) são DOM próprio e independem do SVG.
- **`vi.resetAllMocks()` apaga o mock global de `window.matchMedia`** (test-setup) do qual `useMediaQuery` (na grade) depende → usar `vi.clearAllMocks()` (preserva implementações) em `HabitHistory.test.tsx`.
- **axe `empty-table-header` (4.10) exige texto VISÍVEL no `<th>`**, não só `aria-label`: `aria-label` com filhos `aria-hidden` falha. Solução: data curta visível + tag FDS/FER visível + rótulo completo (data + tipo de dia) em `<span>` só-para-leitor-de-tela (`srOnly`).
- **`response.data` do DRF é snake_case** (camelização só no renderer JSON) — asserts de view em `total_completion`/`day_type`/`effective_weight`; wire JSON é camelCase (tipos gerados). Confirmado nos testes de view 6.4.
- **`Habit` faltava no import de `test_services.py`** (usado no `pytest.raises(Habit.DoesNotExist)`) — corrigido; era bug só de teste.
- **Contrato aditivo:** `spectacular` + `generate-types` → 8 schemas novos (`HabitHistoryRange`/`HabitHistoryDay`/`HabitSlim`/`HabitSeries`/`HabitSeriesPoint`/`HabitVersionEvent`/`HabitChange`/`HabitDayType`); **0 linhas removidas** em `schema.yaml`/`types.gen.ts`; conjunto de enums **idêntico** (nenhum enum novo — `field` é `CharField`; `DayTypeEnum`/`HabitTypeEnum`/`TypeEnum` intactos).

### Completion Notes List

- **Read-path 100% não-semeador (AC1):** `get_habit_history_range`/`get_habit_series` **nunca** chamam `seed_habit_day` (verificado: 0 ocorrências) e **não** têm `@transaction.atomic`. Teste explícito assere `HabitDayEntry.objects.count()` inalterado antes/depois de consultar dias passados nunca-abertos. Dias sem linha → lacuna honesta (`total_completion=None`, `groups=[]`, `entries=[]`), nunca 0% fabricado.
- **Zero schema/model/migration novo (AC4, AD-11/AD-14):** `models.py`/`core/models.py` intactos; `manage.py makemigrations --check --dry-run` → **"No changes detected"**. Nenhuma série materializada — tudo derivado on-read.
- **Matemática reusada, não reimplementada:** extraí `_grouped_completeness(entries)` de `compute_day_completeness` (comportamento preservado) e o reuso no histórico; `_completeness_pct`/`_contribution`/`_effective_weight` reusados. O frontend **não** faz matemática.
- **Eventos vs ritmo (AD-11):** eventos = diff de `habit_versions` consecutivas (asc. por `effective_from`; `Meta.ordering` é desc., então `order_by` explícito), chaves `before`/`after` (nunca `from`/`to`); `active` false→true = "Reativado", true→false = "Desativado"; 1ª versão = "Criado" só se no range. Multiplicador/`day_type` = **sombreamento** (`ReferenceArea`), nunca marcador.
- **Decisão de gráfico (skill dataviz + AD-11):** UM eixo Y só — o peso efetivo/multiplicador é representado **exclusivamente como sombreamento** (não uma 2ª linha de escala diferente, o que violaria "one axis"). Série única → sem legenda de cor; a **grade** é a tabela acessível equivalente. `meta` **não** vira `ReferenceLine` (é versionada; suas mudanças já são marcadores). Marcadores sempre com texto ("Mudanças no período" + tooltip) — cor nunca sozinha.
- **Boolean vs numérico na linha:** dia com linha e `value` nulo → booleano plota **0** (aberto/não-feito, parte do degrau); numérico → lacuna (não fabrica 0). Dia sem linha → lacuna (ambos).
- **Superfície como aba/sub-rota:** `/habits/history` + abas "Hoje"·"Histórico" (componente `HabitsTabs` na camada `pages/`). **Não** tocou `Sidebar.tsx`/`BottomNav.tsx` — os 3 testes compartilhados da casca e `router.test.tsx`/`RouteAnnouncer.test.tsx` continuam verdes.
- **Contagens de teste (coladas após rodar):** frontend `vitest run` → **662 passed (59 files)** (+14 novos: api 3, chart 4, grade 4, histórico 3). Backend `pytest` (full, todos os apps, `--reuse-db`) → **`<preencher>`** (novos: calendar 5, services 12, serializers 4, views 8).
- **Gates verdes:** `ruff` ✅, `lint-imports` **KEPT** ✅ (core sem app de domínio), `tsc` ✅, ESLint ✅ (fronteira de feature), `vite build` ✅ (aviso de chunk >500 kB esperado pela 1ª lib de charting — não é erro). Sem migrations a aplicar em Neon (read-only).

### File List

**Backend (modificados):**
- `backend/core/calendar.py` — `resolve_day_types_range` (batch, read-only)
- `backend/core/tests/test_calendar.py` — testes de `resolve_day_types_range`
- `backend/habits/services.py` — `get_habit_history_range`, `get_habit_series`, `_grouped_completeness` (extraído), helpers de diff
- `backend/habits/serializers.py` — `HabitSlim`/`HabitHistoryDay`/`HabitHistoryRange`/`HabitChange`/`HabitSeriesPoint`/`HabitVersionEvent`/`HabitDayType`/`HabitSeries`
- `backend/habits/views.py` — `HabitHistoryRangeView`, `HabitSeriesView` + parse de range
- `backend/habits/urls.py` — rotas `history/` e `<uuid:pk>/series/`
- `backend/habits/tests/test_services.py` — testes de history/series (não-semeadura, lacunas, eventos, cross-tenant, range bound)
- `backend/habits/tests/test_serializers.py` — testes read-only (`field` CharField, allow_null)
- `backend/habits/tests/test_views.py` — testes GET history/series (shape, lacuna, cross-tenant 404, range/data inválidos)

**Contrato (regenerado):**
- `schema.yaml`
- `frontend/src/api/types.gen.ts`

**Frontend (modificados):**
- `frontend/package.json`, `frontend/package-lock.json` — `recharts@3.9.2`
- `frontend/src/api/keys.ts` — `habits.history`, `habits.series`
- `frontend/src/features/habits/api.ts` — `useHabitHistoryQuery`, `useHabitSeriesQuery`
- `frontend/src/features/habits/types.ts` — tipos de history/series
- `frontend/src/features/habits/index.ts` — re-exports (hooks/tipos/`HabitHistory`)
- `frontend/src/features/habits/api.test.tsx` — testes dos 2 hooks
- `frontend/src/app/router.tsx` — rota `/habits/history`
- `frontend/src/pages/habits/HabitsPage.tsx` — shell com abas + tracker

**Frontend (novos):**
- `frontend/src/features/habits/components/HabitHistory.tsx`
- `frontend/src/features/habits/components/HabitEvolutionChart.tsx`
- `frontend/src/features/habits/components/HabitHistoryGrid.tsx`
- `frontend/src/features/habits/components/historyUtils.ts`
- `frontend/src/features/habits/components/HabitHistory.test.tsx`
- `frontend/src/features/habits/components/HabitEvolutionChart.test.tsx`
- `frontend/src/features/habits/components/HabitHistoryGrid.test.tsx`
- `frontend/src/pages/habits/HabitHistoryPage.tsx`
- `frontend/src/pages/habits/HabitsTabs.tsx`

## Change Log

| Data | Mudança |
|------|---------|
| 2026-07-19 | Story 6.4 criada (create-story): histórico por data e gráfico de evolução — read-path **on-read não-semeador** (sem schema/migration novos; AD-11/AD-14), 2 endpoints GET (`/api/habits/history/`, `/api/habits/<pk>/series/`), série derivada de `habit_day_entries` + eventos do stream de `habit_versions` + ritmo por `day_type`/`multiplier_at_time`; superfície de histórico (navegação por data read-only + gráfico + grade hábitos×dias como tabela acessível); 1ª biblioteca de charting do app (default recharts). Status → ready-for-dev. |
| 2026-07-19 | Story 6.4 implementada (dev-story): `resolve_day_types_range` (batch), serviços read-only `get_habit_history_range`/`get_habit_series` (não-semeadores, sem `@transaction.atomic`), serializers/views/rotas read-only, contrato regenerado **aditivo** (8 schemas novos, nenhum enum novo), `recharts@3.9.2` (1ª lib de charting), superfície `/habits/history` (aba dentro de Hábitos) com detalhe por-data read-only + gráfico de evolução (série + marcadores de mudança com texto + sombreamento de ritmo, eixo único) + grade acessível hábitos×dias. Testes: backend (calendar/services/serializers/views), frontend (hooks + 3 componentes). Zero schema/model/migration novo (`makemigrations --check` → sem mudanças); `seed_habit_day` nunca chamado no read-path. Status → review. |
| 2026-07-19 | Automate (E2E): `habit-history.spec.ts` + `seedHabitHistory.ts` (happy path + lacuna honesta + estado vazio, todos passam). Encerra a cobertura E2E do Épico 6. |
| 2026-07-19 | Code-review adversarial (in-session): 0 CRITICAL / 0 HIGH / 0 MEDIUM; 1 nit → follow-up. Backend full-suite travou (Neon hang); count honesto via scoped habits+accounts+core = **222 passed**. Read-path não-semeador, lacunas honestas, diff before/after, cross-tenant 404 verificados; zero schema; contrato aditivo. Status → **done**. |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (story-automator, in-session) · **Data:** 2026-07-19
**Resultado:** ✅ **Approve → done** (0 CRITICAL, 0 HIGH, 0 MEDIUM) — encerra o Épico 6.

**Verificado contra o código:** AC1 (`get_habit_history_range` read-only, **uma** query + agrupamento em Python — sem N+1; dia sem linha = lacuna honesta `total_completion=None`/`groups=[]`/`entries=[]`, distinta de 0%; **nunca** chama `seed_habit_day` — asserção explícita nos testes); AC2 (`get_habit_series`: `points` on-read com `value`/`effective_weight`/`day_type` e lacunas omitidas; `events` = diff de `habit_versions` consecutivas em ordem **ascendente** explícita, chaves `before`/`after` — nunca `from`/`to`; multiplicador jamais vira evento; sombreamento via `day_types` do range); AC3 (chart `role="img"`+`aria-label`/`figcaption`, `connectNulls={false}`, `ReferenceArea`/`ReferenceLine`; grade `<table>` semântica com `th scope` + aria por célula + lacuna "—" honesta + lista mobile; cor nunca sozinha; voz pt-BR); AC4 (**zero schema** — `makemigrations --check` limpo, `models.py` intocado; contrato **aditivo**, `DayTypeEnum`/`HabitTypeEnum`/`TypeEnum` intactos, `field` do diff = CharField para não emitir enum; regra de porta **KEPT** — `core→accounts` via import tardio; sem escrita/transação; reusa `_contribution`/`_effective_weight`/`_completeness_pct`/`_grouped_completeness`). `HabitSlimSerializer` novo evita o `AttributeError` de `HabitSerializer` (que exige `current_version`). Testes reais e completos: 13 de serviço + 8 de view + 5 de `resolve_day_types_range` + frontend (hooks + 3 componentes) + E2E. Contagem honesta: full-suite travou por hang do Neon; scoped **habits+accounts+core = 222 passed**; frontend **vitest 662 passed**; tsc/ESLint/vite build ✓; recharts@3.9.2 pinado (sem override de peer).

### Review Follow-ups (AI) — nit, não bloqueante

- [ ] [AI-Review][NIT] `Sidebar` usa match exato de pathname; o item "Hábitos" perde o realce de ativo em `/habits/history` (a story documentou como aceitável). Se incomodar, trocar por `startsWith` só nesse item. [frontend/src/app/layout/Sidebar.tsx:87]
