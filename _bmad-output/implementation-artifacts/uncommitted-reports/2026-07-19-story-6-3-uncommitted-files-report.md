# Explicacao dos arquivos nao commitados - Story 6.3 (Multiplicador de peso por tipo de dia)

> Baseline dos diffs: commit `9c60d00` (feat da Story 6.2). Escopo: **apenas** os arquivos da Story 6.3 do Épico 6.
> Fora de escopo (não documentados aqui): artefatos de planejamento/specs, logs do story-automator, `sprint-status.yaml`, `tests/test-summary.md` e o próprio `6-3-*.md`.
> Nenhum código-fonte foi modificado na geração deste relatório.

## Visao geral

A Story 6.3 empilha uma **camada de ritmo** (AD-10) sobre o snapshot diário imutável entregue na 6.2: cada dia tem um **tipo** (`weekday` / `weekend` / `holiday`) e cada `(grupo, tipo de dia)` pode ter um **multiplicador de peso** configurável e prospectivo. A completude do dia passa a usar `peso_efetivo = weight_at_time × multiplier_at_time` — tanto no numerador quanto no denominador — de modo que fins de semana e feriados pesem menos (ou zero) sem alterar o peso base do hábito.

Peças principais:

- **Feriado manual** vira uma linha em `accounts.UserHoliday` (feriado é pessoal/regional). `core.calendar.resolve_day_type` é a nova autoridade de tipo de dia, com precedência `holiday > weekend > weekday` **sem acumular**.
- **Config do multiplicador** é versionada como `HabitVersion`: cada mudança é um INSERT com `effective_from = hoje`; o valor vigente em D é a linha de maior `effective_from <= D`. Só `weekend`/`holiday` são armazenados (`weekday` = 1.0 implícito).
- **Snapshot congela** `day_type` + `multiplier_at_time` **separados** do `weight_at_time` base na 1ª abertura do dia, o que habilita transparência na UI (legenda factual), override avulso por dia ("nesse sábado eu trabalhei") e recálculo *bounded* ao togglar feriado.
- **Frontend**: config por grupo em Settings › Hábitos, toggle de feriado + legenda de peso efetivo no tracker, tudo com mutations otimistas.

## Ordem logica de funcionamento

1. **Fundação** — `accounts.UserHoliday` (dado do feriado) + `core.calendar.resolve_day_type` (autoridade de tipo de dia).
2. **Modelo de dados** — `habits.DayType`, `HabitGroupDayMultiplier`, colunas `day_type`/`multiplier_at_time` em `HabitDayEntry` + migrations 0002/0003.
3. **Back-office** — admins de `UserHoliday`, `HabitDayEntry` (novas colunas) e `HabitGroupDayMultiplier`.
4. **Serviço** — `multiplier_for`, `set_group_day_multiplier`, `current_multipliers_of`, `seed_habit_day` atualizado, `_effective_weight`, `_completeness_pct`, `set_holiday`, `update_habit_day_entry`.
5. **Serializers** — leitura do snapshot com os novos campos + serializers de config e feriado.
6. **Views/URLs** — `HabitGroupMultipliersView` (GET/PUT), `HabitHolidayView` (POST/PATCH), `day_type` no payload do dia.
7. **Config** — pin do `DayTypeEnum` em `SPECTACULAR_SETTINGS` (base.py).
8. **Contrato gerado** — `schema.yaml` + `frontend/src/api/types.gen.ts` (aditivos).
9. **Frontend data layer** — `keys`, `types.ts`, `api.ts` (hooks otimistas), `index.ts`.
10. **Frontend UI** — `HabitTracker` (toggle feriado + legenda + override), `HabitsManager` (config de multiplicador por grupo).
11. **Testes** — accounts/core/habits (unit) → frontend (component/hook) → E2E; `conftest` registra o isolamento de `accounts`.

---

## 1. Fundação: dado do feriado e autoridade de tipo de dia

### `backend/accounts/models.py`

**Funcao geral do arquivo**

Define o `User` custom (auth) do projeto.

**Funcao geral da alteracao**

Adiciona o model `UserHoliday`: a presença da linha `(user_id, date)` marca o dia como feriado. Feriado é pessoal/regional, então mora no perfil (`accounts`); `core/calendar` o lê e `habits` o escreve (ambas direções permitidas pela regra de porta do import-linter).

**Blocos principais**

- Linha 7: importa `TenantModel` de `core.models`.
- Linhas 28-56 (aprox.): classe `UserHoliday(TenantModel)` com `date` (`DateField`) + `created_at` (`auto_now_add`), `db_table = "user_holidays"`, `ordering = ["date"]` e `UniqueConstraint(user_id, date)` chamado `uniq_user_holiday`.

**Funcoes, classes e importacoes especificas**

- `UserHoliday`: model "burro" — só a existência importa (não tem flag, não tem nome). Herda de `TenantModel` (UUID PK + `user_id` denormalizado + auto-scope por tenant + cobertura do gate de isolamento). A AD-10 desenhava PK composta `(user_id, date)`, mas o padrão do projeto exige UUID PK + `user_id` indexado; a unicidade vira `UniqueConstraint` — mesma reconciliação de `habit_day_entries` na 6.2.

**Comportamento de libs usadas**

- `models.UniqueConstraint(fields=[...], name=...)`: cria índice único no banco; viola com `IntegrityError` se `(user_id, date)` repetir.

### `backend/core/calendar.py`

**Funcao geral do arquivo**

Helpers de calendário do domínio (semana começa na segunda — AD-05): `today_for`, `week_start_of`, `weeks_of_month`, `months_of_week`, `is_workday`.

**Funcao geral da alteracao**

Adiciona `resolve_day_type(user, d)` — a nova autoridade única de tipo de dia (AC2).

**Blocos principais**

- Linhas 60-86 (aprox.): função `resolve_day_type`. Import tardio `from accounts.models import UserHoliday` dentro da função (blinda contra ordem de carregamento; `core → accounts` é permitido porque `accounts` é `root_package`, não app de domínio). Lógica: se existe linha em `user_holidays` para `d` → `"holiday"`; senão se `d.weekday() >= 5` → `"weekend"`; senão `"weekday"`.

**Funcoes, classes e importacoes especificas**

- `resolve_day_type` retorna a **string literal** (`core` não pode importar `habits.models.DayType`; quem valida/mapeia é `habits`). Precedência `holiday > weekend > weekday` **sem acumular** — um sábado marcado feriado retorna `"holiday"`, não `"weekend"`.

**Comportamento de libs usadas**

- `UserHoliday.objects.filter(date=d).exists()`: query auto-escopada por tenant (o `TenantManager` lê `current_user_id` do contexto do request; fail-closed sem contexto). `date.weekday()`: 0=seg … 6=dom.

---

## 2. Modelo de dados de habits + migrations

### `backend/habits/models.py`

**Funcao geral do arquivo**

Models do domínio de hábitos: `HabitGroup`, `Habit`, `HabitVersion` (versionamento prospectivo) e `HabitDayEntry` (snapshot diário da 6.2).

**Funcao geral da alteracao**

Introduz o enum `DayType`, o model `HabitGroupDayMultiplier` (config prospectiva) e duas colunas congeladas em `HabitDayEntry` (`day_type`, `multiplier_at_time`).

**Blocos principais**

- Linha 13: `from decimal import Decimal` (default `1.00`).
- Linhas 31-44 (aprox.): `class DayType(models.TextChoices)` com `WEEKDAY/WEEKEND/HOLIDAY`. No nível do módulo (como `HabitType`) para ser visível ao `CheckConstraint` do `Meta`.
- Linhas 113-150 (aprox.): `class HabitGroupDayMultiplier(TenantModel)` — FK `group` (`related_name="day_multipliers"`, `CASCADE`), `day_type` (`CharField` restrito a `WEEKEND`/`HOLIDAY` via `choices`), `multiplier` (`DecimalField(max_digits=4, decimal_places=2)`), `effective_from` (`DateField`), `created_at`. `Meta`: `db_table = "habit_group_day_multipliers"`, `UniqueConstraint(group, day_type, effective_from)` = `uniq_group_day_multiplier_per_day` e `CheckConstraint(day_type in [weekend, holiday])` = `group_multiplier_day_type_valid`.
- Linhas 171-195 (aprox.): docstring de `HabitDayEntry` reescrita (a 6.3 concretiza o "projetar para 6.3" da 6.2) + as colunas `day_type` (`CharField(choices=DayType.choices, default=DayType.WEEKDAY)`) e `multiplier_at_time` (`DecimalField(max_digits=4, decimal_places=2, default=Decimal("1.00"))`).

**Funcoes, classes e importacoes especificas**

- `HabitGroupDayMultiplier` espelha `HabitVersion`: cada mudança é um INSERT com `effective_from = hoje`; vigente em D = `max(effective_from) <= D` para aquele `(grupo, day_type)`. Só `weekend`/`holiday` são armazenados; grupo sem config = 1.0.
- Defaults `weekday`/`1.00` backfillam as linhas materializadas na 6.2 com a semântica correta ("sem multiplicador").
- Manter `weight_at_time` (base) e `multiplier_at_time` **separados** habilita transparência na UI, a distinção evento-vs-ritmo (AD-11) e o override avulso de um dia.

**Comportamento de libs usadas**

- `models.CheckConstraint(condition=models.Q(day_type__in=[...]))`: proíbe `weekday` na config no nível do banco.
- `models.ForeignKey(..., on_delete=CASCADE, related_name="day_multipliers")`: apagar o grupo apaga sua config; `group.day_multipliers.all()` navega o reverso.

### `backend/accounts/migrations/0002_user_holiday.py` (novo)

**Funcao geral do arquivo**

Migration que cria a tabela `user_holidays`.

**Funcao geral da alteracao**

Arquivo novo; `CreateModel UserHoliday` — `id` (UUID PK), `user_id` (`UUIDField(db_index=True)`), `date`, `created_at`; `db_table='user_holidays'`, `ordering=['date']`, `UniqueConstraint(user_id, date)`. Depende de `accounts.0001_initial`.

### `backend/habits/migrations/0003_day_type_multiplier.py` (novo)

**Funcao geral do arquivo**

Migration que materializa a camada de ritmo no schema de `habits`.

**Funcao geral da alteracao**

Arquivo novo, depende de `habits.0002_habit_day_entry`. Três operações:

- `AddField HabitDayEntry.day_type` — `CharField(choices=[weekday/weekend/holiday], default='weekday', max_length=8)`.
- `AddField HabitDayEntry.multiplier_at_time` — `DecimalField(decimal_places=2, default=Decimal('1.00'), max_digits=4)`.
- `CreateModel HabitGroupDayMultiplier` — UUID PK, `user_id` indexado, `day_type` (choices só weekend/holiday), `multiplier`, `effective_from`, `created_at`, FK `group` (CASCADE); `UniqueConstraint(group, day_type, effective_from)` + `CheckConstraint(day_type in [weekend, holiday])`.

> Os `AddField` com `default` fazem o backfill correto ("sem multiplicador") nas linhas de 6.2 já existentes.

---

## 3. Back-office (admin)

### `backend/accounts/admin.py`

**Funcao geral do arquivo**

Registro do `User` no Django admin.

**Funcao geral da alteracao**

Registra `UserHolidayAdmin`. `list_display = (id, user_id, date, created_at)`, `list_filter = (date,)`, `search_fields = (id, user_id)`. `get_queryset` usa `UserHoliday.all_objects.all()` (admin de operador, cross-tenant — AD-12), contornando o auto-scope do manager default.

### `backend/habits/admin.py`

**Funcao geral do arquivo**

Registro dos models de hábitos no admin.

**Funcao geral da alteracao**

- Importa `HabitGroupDayMultiplier`.
- `HabitDayEntryAdmin`: adiciona `day_type` e `multiplier_at_time` ao `list_display` e `day_type` ao `list_filter`.
- Registra `HabitGroupDayMultiplierAdmin` (`list_display` com grupo/day_type/multiplier/effective_from; `list_filter = (day_type,)`; `get_queryset` via `all_objects` — cross-tenant).

---

## 4. Camada de serviço

### `backend/habits/services.py`

**Funcao geral do arquivo**

Camada de serviço de hábitos: toda regra de negócio (criação, versionamento, materialização do dia, completude, edição avulsa). Views são finas; o serviço é a fronteira transacional.

**Funcao geral da alteracao**

Adiciona a mecânica de multiplicador e feriado e passa a completude a usar peso efetivo.

**Blocos principais**

- Linhas 15-24 (aprox.): imports — `resolve_day_type` (de `core.calendar`) e `DayType`/`HabitGroupDayMultiplier` (de `habits.models`).
- Linha 32 (aprox.): constante `_NEUTRAL_MULTIPLIER = Decimal("1.00")`.
- `multiplier_for(group, day_type, on_date) -> Decimal`: `weekday` → `1.00`; para `weekend`/`holiday`, a linha vigente é a de maior `effective_from <= on_date` (mesma mecânica de `current_version_of`); sem linha → `1.00`. Auto-escopado por tenant.
- `set_group_day_multiplier(*, user, group_id, day_type, multiplier)` (`@transaction.atomic`): valida `day_type in (WEEKEND, HOLIDAY)` (senão `DomainError`); `update_or_create` com `effective_from = today_for(user)` (INSERT novo ou UPDATE da linha de hoje). Prospectivo — **não** toca dias congelados.
- `current_multipliers_of(group, on_date) -> dict`: `{"weekend": ..., "holiday": ...}` via `multiplier_for` (default 1.00).
- `seed_habit_day` atualizado: resolve `day_type = resolve_day_type(user, date)` **uma vez**, e para cada linha nova congela `day_type` + `multiplier_at_time = multiplier_for(habit.group, day_type, date)`. Dias pulados recebem o tipo/multiplicador **daquele dia**, nunca os de hoje.
- `_effective_weight(entry) -> Decimal`: `entry.weight_at_time * entry.multiplier_at_time`. `multiplier = 0` zera o peso efetivo — o hábito sai de numerador **e** denominador.
- `_completeness_pct(entries)` reescrito: usa `_effective_weight` no numerador e no denominador; guarda `Σ peso_efetivo == 0 → 0` (cobre `multiplier=0` em todas as linhas).
- `set_holiday(*, user, date, is_holiday)` (`@transaction.atomic`): import tardio de `UserHoliday`; `is_holiday` → `get_or_create`, senão `.filter(date=date).delete()`. **Depois**, re-resolve `day_type` + `multiplier_at_time` de **todas as linhas do dia D** (bounded — vizinhos intactos, `value` preservado, `habit_versions`/`weight_at_time` base nunca tocados). Um override avulso anterior daquele dia é re-derivado (comportamento esperado — togglar feriado reconstrói o ritmo do dia).
- `update_habit_day_entry`: novo parâmetro `multiplier_at_time=None` (override avulso "nesse sábado eu trabalhei"); `None` = "não informado" (não há caso de "desmarcar" — default é 1.0, não null). Escreve só naquela linha via `save(update_fields=...)`.

**Comportamento de libs usadas**

- `HabitGroupDayMultiplier.objects.filter(...).order_by("-effective_from").first()`: retorna a linha vigente (maior `effective_from <= on_date`) ou `None`.
- `update_or_create(**lookup, defaults={...})`: retorna `(obj, created)`; UPSERT idempotente por `(group, day_type, effective_from)`.
- `queryset.select_related("habit__group")` em `set_holiday`: pré-carrega FK aninhada para evitar N+1 ao ler `entry.habit.group`.
- `@transaction.atomic`: envolve escrita + recálculo numa transação (feriado + linhas do dia sobem juntos ou nada).

---

## 5. Serializers

### `backend/habits/serializers.py`

**Funcao geral do arquivo**

DRF serializers do domínio de hábitos: mapeiam models ↔ wire (camelizado pelo renderer JSON) e validam entrada; a lógica fica no serviço.

**Funcao geral da alteracao**

Expõe os novos campos de leitura no snapshot e no payload do dia; adiciona serializers de config e feriado.

**Blocos principais**

- `HabitDayEntrySerializer`: novo campo `day_type = ChoiceField(choices=DayType.choices, read_only=True)` e `multiplier_at_time` incluído em `fields`.
- `HabitDaySerializer`: novo campo `day_type = ChoiceField(choices=DayType.choices)` (nível-dia, para o toggle de feriado / legenda) — mesmos 3 valores → mesmo `DayTypeEnum` no contrato.
- `HabitDayEntryUpdateSerializer`: novo `multiplier_at_time = DecimalField(max_digits=4, decimal_places=2, required=False)` (sem `allow_null`: não há "desmarcar"). Mantém a validação de campos imutáveis (`habit`/`date` → 400).
- `GroupMultipliersSerializer` (read): `weekend` + `holiday` (`DecimalField`). Sem enum `day_type` no wire (evita colisão de `DayTypeEnum`); `weekday` nunca aparece.
- `SetGroupMultipliersSerializer` (write): `weekend`/`holiday` opcionais + `allow_null`; `validate` rejeita ambos nulos ("Informe ao menos um multiplicador...").
- `SetHolidaySerializer` (write): `date` (`DateField`) + `is_holiday` (`BooleanField`).
- `HolidayResultSerializer`: `date` + `day_type` (resultado do toggle).

**Comportamento de libs usadas**

- `serializers.ChoiceField(choices=DayType.choices, read_only=True)`: valida/serializa contra os valores do enum; `read_only` mantém fora do input.
- `serializers.DecimalField(max_digits, decimal_places)`: serializa como string ("0.20") preservando escala.

---

## 6. Views e URLs

### `backend/habits/views.py`

**Funcao geral do arquivo**

APIViews finas de hábitos: parseiam/validam via serializer, delegam ao serviço, serializam a resposta.

**Funcao geral da alteracao**

Adiciona `day_type` ao payload do dia e duas views novas.

**Blocos principais**

- Imports: `resolve_day_type`, `DomainError`, e os serializers/serviços novos.
- `HabitDayView.get`: payload passa a incluir `"day_type": resolve_day_type(request.user, day)` (nível-dia).
- `HabitGroupMultipliersView` (APIView): `GET pk` → `current_multipliers_of(group, today)` (404 se grupo inexistente/outro tenant); `PUT pk` → valida `SetGroupMultipliersSerializer`, itera `weekend`/`holiday` chamando `set_group_day_multiplier` para cada chave não-nula, converte `DomainError` → `ValidationError` (400), devolve a config vigente resultante. Anotada com `@extend_schema` para o contrato.
- `HabitHolidayView` (APIView): `POST` → valida `SetHolidaySerializer`, chama `set_holiday(**validated)`, devolve `{date, day_type re-resolvido}`. `patch = post` (POST/PATCH equivalentes).

**Comportamento de libs usadas**

- `@extend_schema(request=..., responses=...)` (drf-spectacular): fixa request/response no OpenAPI (senão a APIView não inferiria o schema).
- `raise NotFound()`/`ValidationError(...)`: viram 404/400 pelo exception handler do DRF.

### `backend/habits/urls.py`

**Funcao geral da alteracao**

Registra `holidays/` → `HabitHolidayView` (rota estática antes de `<uuid:pk>/`, junto com `days/`; "holidays" não casa o conversor `uuid`, mas fica explícita no topo por clareza).

### `backend/habits/urls_groups.py`

**Funcao geral da alteracao**

Registra `<uuid:pk>/multipliers/` → `HabitGroupMultipliersView` (name `habit-group-multipliers`).

---

## 7. Config (enum pin)

### `backend/config/settings/base.py`

**Funcao geral do arquivo**

Settings base do Django, incluindo `SPECTACULAR_SETTINGS` (geração do OpenAPI).

**Funcao geral da alteracao**

Em `ENUM_NAME_OVERRIDES`, adiciona `"DayTypeEnum": "habits.models.DayType"` — pin do nome do enum de 3 valores (`weekday`/`weekend`/`holiday`) usado em `HabitDayEntry.day_type` e `HabitDay.day_type`. A config de multiplicador não emite enum `day_type` (usa chaves nomeadas `weekend`/`holiday`), então não há colisão a resolver; o pin só estabiliza o nome no contrato.

---

## 8. Contrato gerado (aditivo)

### `schema.yaml`

**Funcao geral do arquivo**

OpenAPI 3 gerado pelo drf-spectacular — fonte de verdade do contrato consumido pelo frontend.

**Funcao geral da alteracao**

Aditiva (nada removido/renomeado). Novidades:

- Paths: `/api/habit-groups/{id}/multipliers/` (`retrieve`/`update`) e `/api/habits/holidays/` (`create`/`partial_update`).
- Schemas: `DayTypeEnum` (`weekday|weekend|holiday`), `GroupMultipliers`, `SetGroupMultipliers`, `SetHoliday`, `PatchedSetHoliday`, `HolidayResult`.
- `HabitDay` e `HabitDayEntry` ganham `dayType` (e `HabitDayEntry`, `multiplierAtTime`).

> Arquivo gerado — não inspecionado linha a linha; validado por grupos de path/schema.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do `schema.yaml` (openapi-typescript). Espelho tipado do contrato.

**Funcao geral da alteracao**

Aditiva, espelhando o schema: `paths` para `/api/habit-groups/{id}/multipliers/` e `/api/habits/holidays/`; `components["schemas"]` com `DayTypeEnum = "weekday" | "weekend" | "holiday"`, `GroupMultipliers { weekend; holiday }`, `SetGroupMultipliers { weekend?; holiday? }`, `SetHoliday { date; isHoliday }`, `PatchedSetHoliday`, `HolidayResult { date; dayType; ... }`; `dayType`/`multiplierAtTime?` em `HabitDay`/`HabitDayEntry`; e as `operations` correspondentes.

> Arquivo gerado — validado por grupos de tipo/operação.

---

## 9. Frontend — data layer

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Fábrica central de query keys do TanStack Query (evita strings soltas e colisões).

**Funcao geral da alteracao**

Adiciona `habits.groupMultipliers(groupId) → ['habits', 'groupMultipliers', groupId]`. O estado de feriado **não** ganha key nova — vem embutido em `habits.day(date)` via `dayType`.

### `frontend/src/features/habits/types.ts`

**Funcao geral do arquivo**

Re-exporta tipos do domínio de hábitos a partir de `components['schemas']` do contrato gerado.

**Funcao geral da alteracao**

Adiciona `DayType`, `GroupMultipliers`, `SetGroupMultipliers`, `SetHoliday`, `HolidayResult`.

### `frontend/src/features/habits/api.ts`

**Funcao geral do arquivo**

Camada de acesso a dados de hábitos: funções de fetch + hooks (`useQuery`/`useMutation`) que encapsulam o `client` axios e as invalidações de cache.

**Funcao geral da alteracao**

Adiciona os hooks da 6.3.

**Blocos principais**

- `fetchGroupMultipliers` + `useGroupMultipliersQuery(groupId)`: GET `/api/habit-groups/{id}/multipliers/`, key `keys.habits.groupMultipliers(groupId)`.
- `setGroupMultipliers` + `useSetGroupMultipliersMutation`: PUT dos multiplicadores; `onSuccess` invalida o prefixo `['habits']` (cobre config + tracker; os % recalculam no backend só para dias abertos daqui em diante).
- `setHoliday` + `useSetHolidayMutation(date)`: POST `/api/habits/holidays/`; usa `useOptimisticMutation` sobre `keys.habits.day(date)` — o `updater` flipa `dayType` (`holiday`/`weekday`) na hora; %/`multiplierAtTime` reconciliam no refetch de `onSettled`.
- `overrideDayWorkday(entryIds)` + `useOverrideDayWorkdayMutation(date)`: PATCH `multiplierAtTime: '1.00'` em cada linha do dia (`Promise.all`) — o primitivo de backend é por-linha, o controle de dia itera; `onSuccess` invalida `keys.habits.day(date)`.

**Comportamento de libs usadas**

- `useOptimisticMutation` (hook do projeto): aplica o `updater` no cache antes da resposta e faz rollback em erro (testado em `api.test.tsx`).
- `queryClient.invalidateQueries({ queryKey })`: marca queries stale → refetch.
- `Promise.all`: dispara os PATCH em paralelo e resolve quando todos concluem.

### `frontend/src/features/habits/index.ts`

**Funcao geral da alteracao**

Barrel: re-exporta os 4 hooks novos e os 5 tipos novos da 6.3.

---

## 10. Frontend — UI

### `frontend/src/features/habits/components/HabitTracker.tsx`

**Funcao geral do arquivo**

Tracker do dia: renderiza % total, % por grupo e as linhas marcáveis (booleano/numérico) do dia.

**Funcao geral da alteracao**

Adiciona toggle de feriado, legenda factual de peso efetivo por grupo e botão de override "tratar como dia útil".

**Blocos principais**

- Imports: `Button`/`Switch` (MUI), `InfoOutlinedIcon`, e os hooks `useOverrideDayWorkdayMutation`/`useSetHolidayMutation`; tipo `DayType`.
- `DAY_TYPE_LABEL`: rótulos factuais e neutros (`Dia útil`/`Fim de semana`/`Feriado`) — UX-DR13, sem gamificação.
- `GroupSection`: lê `dayType`/`multiplierAtTime` da 1ª linha do grupo; `showLegend` quando `dayType !== 'weekday'` e `multiplier != null && Number(multiplier) !== 1`; renderiza ícone + `caption` "`{label} · peso ×{n}`".
- `HabitTracker`: instancia `setHoliday`/`overrideDay`; desestrutura `date`, `totalCompletion`, `dayType`, `groups`, `entries`. Adiciona `FormControlLabel` + `Switch` "Feriado" (`checked = dayType === 'holiday'`, `onChange` → `setHoliday.mutate`); `Button` de override só quando `dayType !== 'weekday'` (`onClick` → `overrideDay.mutate(entries.map(id))`, desabilitado sem linhas ou pending); `Typography role="alert"` com `SAVE_ERROR` quando qualquer mutation erra.

**Comportamento de libs usadas**

- MUI `Switch`/`FormControlLabel`: expõe `role="checkbox"` acessível (usado nos testes por `name: 'Feriado'`); `minHeight: 44` = alvo de toque.
- `InfoOutlinedIcon ... aria-hidden`: ícone decorativo (a informação está no texto — cor nunca sozinha).

### `frontend/src/features/habits/components/HabitsManager.tsx`

**Funcao geral do arquivo**

Tela de gestão (Settings › Hábitos): grupos, hábitos, criação/edição e versionamento.

**Funcao geral da alteracao**

Adiciona a config de multiplicador por grupo (primeira afordância de edição por-grupo).

**Blocos principais**

- Imports: `useGroupMultipliersQuery`/`useSetGroupMultipliersMutation`.
- `GroupMultiplierConfig({ groupId })`: só monta o form depois que `useGroupMultipliersQuery` carrega (`if (!query.data) return null`) — estado inicializa uma vez a partir da config vigente (sem corrida de prefill); `key` remonta ao trocar de grupo/config.
- `GroupMultiplierForm`: `useSetGroupMultipliersMutation` + estado local `weekend`/`holiday`; dois `TextField type="number"` ("Fim de semana ×", "Feriado ×") com `aria-label` por grupo e `step: '0.1'`, envoltos em `Tooltip` de mudança prospectiva (no campo, não no botão, para preservar nomes acessíveis); botão "Salvar multiplicadores" (`handleSave` manda `null` para campos vazios, senão o valor `trim`); `Typography role="alert"` com `SAVE_ERROR` em erro.
- `GroupSection`: renderiza `<GroupMultiplierConfig groupId={group.id} />` abaixo do título do grupo.

**Comportamento de libs usadas**

- MUI `Tooltip` no campo: dica sem sequestrar o nome acessível do botão/input.
- `TextField type="number"` com `inputProps.step`: input numérico com passo 0.1 (os testes usam `fireEvent.change` porque `userEvent.type` não opera em `type=number` no jsdom).

---

## 11. Testes

### `backend/core/tests/test_calendar.py`

**Funcao geral da alteracao**

Adiciona 5 testes de `resolve_day_type` (AC2): weekday, weekend, holiday, precedência holiday-sobre-weekend (sem acumular) e escopo por tenant (feriado de `other_user` não afeta `user`). Usa `tenant_context` e cria `UserHoliday` dentro do contexto. Datas fixas de 2026-01 (guardrail temporal).

### `backend/accounts/tests/factories.py`

**Funcao geral da alteracao**

Adiciona `UserHolidayFactory` — `user_id` via `class Params` + `SelfAttribute("user.id")` (padrão para `UUIDField` puro do `TenantModel`, não FK); `date` sequencial a partir de `date(2026,1,1)` (nunca `date.today()`). Registra o caso de isolamento `accounts.UserHoliday` via `register_isolation_case`.

### `backend/habits/tests/factories.py`

**Funcao geral da alteracao**

`HabitDayEntryFactory` ganha defaults `day_type = WEEKDAY` e `multiplier_at_time = 1.00`. Adiciona `HabitGroupDayMultiplierFactory` (day_type WEEKEND, multiplier 0.20, effective_from sequencial). Registra o caso de isolamento `habits.HabitGroupDayMultiplier`.

### `backend/habits/tests/test_models.py`

**Funcao geral da alteracao**

Testa defaults do snapshot (`weekday`/`1.00`), a `UniqueConstraint (group, day_type, effective_from)` (levanta `IntegrityError`), o `CheckConstraint` rejeitando `weekday` na config, e dois `day_type` distintos no mesmo dia permitidos.

### `backend/habits/tests/test_serializers.py`

**Funcao geral da alteracao**

Testa `HabitDayEntryUpdateSerializer` aceitando `multiplier_at_time`, `SetGroupMultipliersSerializer` (parcial válido / vazio inválido) e `SetHolidaySerializer` (exige `date`).

### `backend/habits/tests/test_services.py`

**Funcao geral da alteracao**

Suíte extensa da 6.3 (~9 grupos): `multiplier_for` (weekday=1, config presente, default sem config, resolução por `max effective_from`); `seed_habit_day` congelando `day_type`/multiplier (weekend, precedência holiday, weekday neutro, grupo sem config); completude por peso efetivo (âncora 100%, âncora mista 38% = 0,6/1,6, multiplier=0 removendo grupo de num+den); `set_group_day_multiplier` prospectivo (effective_from=hoje, rejeita weekday, não sangra dias congelados, UPDATE no mesmo dia); `current_multipliers_of`; `set_holiday` (recalcula só o dia preservando `value`, vizinho e versões intactos; desmarcar re-resolve de volta); override avulso de `multiplier_at_time` numa única linha.

### `backend/habits/tests/test_views.py`

**Funcao geral da alteracao**

Testes de API (AC1-AC3): GET days expõe `day_type` (nível-dia) + `day_type`/`multiplier_at_time` nas linhas; GET/PUT `/multipliers/` (config vigente, escrita prospectiva com `effective_from=hoje`, 400 para vazio, 404 grupo inexistente e cross-tenant); POST `/holidays/` marca e recalcula só o dia (`value` preservado); PATCH de entry com override de multiplier. Observa que `response.data` é snake_case (camelização só no renderer JSON) enquanto o request usa camelCase (`isHoliday`, `multiplierAtTime`).

### `frontend/src/features/habits/api.test.tsx`

**Funcao geral da alteracao**

Adiciona `put` ao mock do client. Cobre `useGroupMultipliersQuery` (GET), `useSetGroupMultipliersMutation` (PUT + invalidação de `['habits']`) e `useSetHolidayMutation` (flip otimista de `dayType` antes da resposta + rollback em erro). `ENTRY`/`HABIT_DAY` de fixture ganham `dayType`/`multiplierAtTime`.

### `frontend/src/features/habits/components/HabitTracker.test.tsx`

**Funcao geral da alteracao**

Adiciona `put`/`post` ao mock. Fixtures ganham `dayType`/`multiplierAtTime`; `makeDay` ganha `dayType`. Testa: marcar feriado otimista (POST `isHoliday:true`), refletir dia já feriado no toggle, legenda "Fim de semana · peso ×0,2" quando multiplier ≠ 1 (e ausência em dia útil), botão "tratar como dia útil" fazendo PATCH das linhas (e ausência em dia útil).

### `frontend/src/features/habits/components/HabitsManager.test.tsx`

**Funcao geral da alteracao**

Adiciona `put` ao mock e `fireEvent`. `setGet` passa a responder `/multipliers/` com uma config default. Testa a renderização dos campos por grupo (aria-labels) e o PUT no endpoint certo ao salvar (usa `fireEvent.change` no `type=number`).

### `frontend/e2e/seedMultiplierScenario.ts` (novo)

**Funcao geral do arquivo**

Helper de seed do E2E: monta e roda um script Python via `manage.py shell -c` (uv), semeando o cenário âncora diretamente pela camada de serviço.

**Funcao geral da alteracao**

Arquivo novo. Cria grupo "Profissional" (Emails peso 2 + Relatório peso 1) e, salvo `onlyProfessional`, grupo "Pessoal" (Ler peso 1, sem config = ×1,0). Se `professionalHolidayMultiplier` vier, chama `set_group_day_multiplier(day_type="holiday", ...)` (prospectivo, effective_from=hoje). Retorna `{professionalId, personalId}` parseando a última linha não-vazia do stdout (o banner do shell precede o `print`). Injeta valores no script via `JSON.stringify` (escape seguro).

### `frontend/e2e/habit-multiplier.spec.ts` (novo)

**Funcao geral do arquivo**

E2E Playwright da 6.3 contra o backend real (sem mocks de rede).

**Funcao geral da alteracao**

Arquivo novo, 3 testes:

1. **Config prospectiva persiste (AC1)**: em `/settings/habits`, preenche "Feriado ×" = 0.2, aguarda o PUT concluir antes de recarregar, e confirma reidratação como "0.20".
2. **Feriado congela peso efetivo + legenda + override (AC1/AC2/AC3)**: em `/today`, marca Emails/Relatório (baseline 50% → 75%, sem legenda), marca **Feriado** (força `day_type=holiday` em qualquer dia — alavanca determinística), verifica completude 38% (0,6/1,6, ROUND_HALF_UP), legenda "Feriado · peso ×0,2", grupos 100%/0%; usa "tratar como dia útil" (volta a 75%, legenda some); desmarca feriado (volta a 75%). Assere `consoleErrors == []`.
3. **Multiplicador zero remove grupo de num+den (AC2/AC3)**: config feriado ×0; baseline 25% (só Ler feito); marca Feriado → "Profissional" sai inteiro do cálculo → 100% (não porque algo foi concluído); desmarca → volta a 25%.

Notas de determinismo: o tracker sempre mostra HOJE e o tipo de dia real varia; por isso o **toggle de feriado** é a alavanca (precedência holiday > weekend > weekday). Usa `.click()` (não `.check()`/`.uncheck()`, que falham no pisca-pisca otimista→refetch) e assere a completude server-side depois de cada ação (serializa o settle). `RECONCILE = { timeout: 20_000 }` acomoda o cold-start da branch Neon `e2e`.

### `backend/conftest.py`

**Funcao geral do arquivo**

Config global de testes do backend, incluindo o gate genérico de isolamento por tenant que varre os módulos registrados.

**Funcao geral da alteracao**

Adiciona `"accounts.tests.factories"` a `_ISOLATION_TEST_MODULES`, para que o `register_isolation_case` do `UserHoliday` seja carregado e o contrato genérico de isolamento cubra o novo model de `accounts`.
