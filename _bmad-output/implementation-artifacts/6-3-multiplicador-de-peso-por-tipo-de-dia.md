---
baseline_commit: 9c60d003b9c566eeafa3df75665cf58e38f25e02
---

# Story 6.3: Multiplicador de peso por tipo de dia

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero que hábitos de um grupo tenham peso ajustado por tipo de dia (fim de semana/feriado),
Para que minha completude reflita que certos hábitos importam menos em certos dias, sem que ajustes futuros ou feriados alterem dias já congelados (FR-2.4, AR-17, AD-10, AD-11).

**Terceira story do Épico 6 (Sistema de Hábitos).** É a **camada de ritmo** de AD-10, empilhada sobre o snapshot realizado da 6.2. Introduz três estruturas novas: `user_holidays` (feriados manuais por data, em `accounts`), `habit_group_day_multipliers` (config prospectiva de multiplicador por `(grupo, tipo de dia)`, em `habits`) e **duas colunas congeladas** em `habit_day_entries` (`day_type` + `multiplier_at_time`). A materialização passa a **resolver e congelar o tipo de dia + o multiplicador vigente** na 1ª abertura, e a completude passa a usar **`peso_efetivo = weight_at_time × multiplier_at_time`**. Ordem interna do épico: config (6.1) → tracker/snapshot (6.2) → **multiplicador por tipo de dia (6.3)** → histórico/gráfico (6.4). A 6.4 consome `day_type`/`multiplier_at_time` como "ritmo/sombreamento" (AD-11), nunca como marcador de mudança.

## Acceptance Criteria

### AC1 — Config: multiplicador prospectivo por grupo × tipo de dia + feriados manuais (AD-10 itens 1-2/5, FR-2.4)

**Dado que** existe um grupo de hábitos,
**Quando** Hugo configura o multiplicador de `weekend` e/ou `holiday` daquele grupo,
**Então** cada valor vira uma **linha prospectiva** em `habit_group_day_multipliers` por `(grupo, day_type ∈ {weekend, holiday})` com `effective_from = hoje` (multiplicador vigente em D = versão com `max(effective_from) <= D`, mesma mecânica de `habit_versions`); `weekday` **nunca é armazenado** (= 1.0 implícito); grupo sem config = 1.0; hábito sem multiplicador para o tipo do dia = 1.0,
**E** Hugo marca/desmarca um dia como **feriado** manualmente por data em `user_holidays` (presença da linha = feriado; por usuário — feriado é pessoal/regional).

### AC2 — Materialização: resolve `day_type`, congela `day_type` + `multiplier_at_time`, completude usa peso efetivo (AD-10 itens 3-4/7, FR-2.4, FR-2.6)

**Dado que** o dia D é materializado (`seed_habit_day` na 1ª abertura),
**Quando** roda,
**Então** resolve `day_type(D)` com precedência **`holiday > weekend > weekday` (sem acumular)** — feriado por presença em `user_holidays`, fim de semana automático (sáb/dom, semana começando na segunda, AD-05) — e **congela** em cada linha nova de `habit_day_entries` o `day_type` e o `multiplier_at_time` (multiplicador do grupo vigente em D para aquele `day_type`, default `1.00`), **separados** do `weight_at_time` base,
**E** a completude (total e por grupo) passa a usar `peso_efetivo = weight_at_time × multiplier_at_time` no **numerador e no denominador** — `Σ(contribuição × peso_efetivo) / Σ(peso_efetivo)` —, com o **tracker exibindo o multiplicador de forma transparente e factual** quando `≠ 1` (ex.: cabeçalho do grupo "Fim de semana · peso ×0,2"), sem enquadramento de recompensa/penalidade (UX-DR13).

### AC3 — Ajustes não sangram: config prospectiva, feriado recalcula só o dia, override avulso de um dia (AD-10 itens 5-6, AD-06 item 6, NFR-4)

**Dado que** um multiplicador de grupo é alterado, um feriado é marcado/desmarcado, ou um único dia é ajustado à mão,
**Quando** cada ação é aplicada,
**Então** **alterar o multiplicador do grupo** só afeta dias abertos daqui em diante (INSERT prospectivo; dias congelados mantêm o `multiplier_at_time` antigo); **marcar/desmarcar feriado** re-resolve `day_type` + `multiplier_at_time` de **todas as linhas daquele dia** (bounded — vizinhos intactos, `value` preservado); e um **override avulso de `multiplier_at_time` de uma linha/dia** ("nesse sábado eu trabalhei") é UPDATE **só naquela linha**,
**E** nenhuma dessas ações toca `habit_versions`, o `weight_at_time` base, nem outras linhas — só o(s) dia(s) afetado(s) recalcula(m) a completude na leitura (o sistema nunca retroage — NFR-4).

## Decisões a confirmar (defaults recomendados, buildáveis de ponta-a-ponta)

Segue o guardrail da retro do Épico 5 (resolver ambiguidade favorecendo leitura literal + código existente + arquitetura, documentando inline) e a memória `ask-dont-assume-functionality-flows`. A UX **não especifica nada** desta feature (confirmado: 0 menções a multiplicador/feriado/tipo de dia nos workspaces 06-15 e 07-17). Cada default abaixo é **implementável sem bloquear**; se Hugo vetar algum, ajustar a task correspondente.

1. **Casa do write-path de feriado.** O **model** `UserHoliday` mora em `accounts` (arquitetura §6.9: "user_holidays pertencem ao perfil (accounts), lidos por core/calendar" — é a única casa que permite `core/calendar` lê-lo **sem** violar a regra de porta, já que `core → habits` é proibido mas `core → accounts` é **permitido**). O **endpoint de escrita + recálculo** mora em `habits` (`POST /api/habits/holidays/`), porque togglar feriado precisa recalcular `habit_day_entries` (concern de habits). `habits → accounts` é permitido pelo contrato. **Default:** model em `accounts`, workflow em `habits`.
2. **Onde configurar o multiplicador do grupo (UI).** UX silente. **Default:** primeira afordância de edição por-grupo dentro do `HabitsManager` (Settings › Hábitos), no cabeçalho de cada `GroupSection` — hoje é display-only. Dois campos numéricos por grupo ("Fim de semana ×", "Feriado ×") + salvar prospectivo com a tooltip honesta-com-o-passado.
3. **Onde marcar feriado (UI).** UX silente. **Default:** toggle "Feriado" no cabeçalho do `HabitTracker` (compartilhado por `/today` e `/habits`), adjacente à completude do dia — o estado vem do `dayType` no payload do dia.
4. **Transparência do peso efetivo (UI).** UX silente; AD-10 item 3 pede transparência ("peso 5 × 0,2 = 1,0"). **Default:** legenda factual no cabeçalho do grupo quando `multiplier_at_time ≠ 1` ("Fim de semana · peso ×0,2" / "Feriado · peso ×0,0"). Per-linha ("peso 5 × 0,2 = 1,0") é opcional.
5. **Override avulso de um dia (UI).** UX silente. **Default:** controle de nível-dia no cabeçalho do tracker ("Tratar este dia como dia útil (peso cheio)") quando `dayType ≠ weekday`, que seta `multiplier_at_time = 1.0` nas linhas do dia. Primitivo de backend é **por-linha** (testado para não-sangramento); o controle de dia itera as linhas.
6. **Limites do multiplicador.** `0.0` é válido e semântico (feriado com `holiday=0.0` → hábitos do grupo não contam: `peso_efetivo = 0`, saem de numerador e denominador). Sem limite superior imposto (a escala `DecimalField(max_digits=4, decimal_places=2)` acomoda até 99.99). Não impor bounds novos sem AC — só a guarda de `Σ peso_efetivo == 0 → 0` (já existe).

## Escopo — o que NÃO entra nesta story (limites explícitos)

- ❌ **Seletor de data / navegação por histórico / gráfico de evolução / lacunas honestas / "ritmo/sombreamento" do multiplicador no gráfico / anotação de mudanças reais via stream de `habit_versions`** → **Story 6.4** (AD-11). A 6.3 **congela** `day_type`/`multiplier_at_time` (o dado que a 6.4 lê como ritmo), mas a **UI de gráfico/histórico** é da 6.4. Em 6.3 o tracker e `/habits` mostram **hoje**.
- ❌ **Override de multiplicador por hábito isolado** (só por grupo) — AD-10 item 1: "override por hábito isolado não é previsto (sem cenário de uso)".
- ❌ **Multiplicador em medicamentos/gratidão/saúde** — AD-10 item 8: só hábitos têm peso/completude.
- ❌ **Reescrever `is_workday`** em `core/calendar.py`. É um stub usado só pelos próprios testes; o TODO de integrar feriados **não** é desta story. A 6.3 adiciona `resolve_day_type` como nova autoridade de tipo-de-dia; `is_workday` fica intacto (sem consumidor de produção). *(Opcional, fora do AC: alinhar `is_workday` a feriados depois — não fazer aqui para não mexer em comportamento/tests não-relacionados.)*
- ❌ **Refatorar `accounts/models.py` para o pacote `accounts/models/{user,profile,holidays}.py`** desenhado na arquitetura. Manter o arquivo único e **acrescentar** `UserHoliday` nele (menos churn, sem mudança de import path) — mesma reconciliação pragmática que a 6.1/6.2 fizeram para schema vs. convenção.
- ❌ Alterar peso/meta/bonus/ativação (INSERT de `habit_version`) → 6.1. Corrigir `value`/`weight_at_time` avulso → já existe (6.2). A 6.3 só **acrescenta** `multiplier_at_time` ao caminho de override avulso da 6.2.

## Tasks / Subtasks

- [x] **Task 1 — Model `UserHoliday` em `accounts` + migration `accounts/0002` (AC1)**
  - [x] Em `backend/accounts/models.py`, adicionar `UserHoliday(TenantModel)` (importar `from core.models import TenantModel` — `accounts → core` é permitido): `date = models.DateField()`; `created_at = models.DateTimeField(auto_now_add=True)`. `Meta.db_table = "user_holidays"`; `ordering = ["date"]`; `constraints = [UniqueConstraint(fields=["user_id", "date"], name="uniq_user_holiday")]`. Presença da linha = feriado. Herda UUID PK + `user_id` denormalizado + auto-scope + cobertura do gate de isolamento (AD-12; mesma reconciliação de PK que `habit_day_entries` — não usar PK `(user_id, date)`). Ver Dev Notes › "Feriados moram em accounts".
  - [x] `makemigrations accounts --name user_holiday` → **`0002_user_holiday.py`** com `dependencies = [("accounts", "0001_initial")]`.
  - [x] `backend/accounts/admin.py`: registrar `UserHolidayAdmin` usando `all_objects` (padrão AD-12, igual aos admins de habits).
- [x] **Task 2 — `resolve_day_type` em `core/calendar.py` (AC2)**
  - [x] Adicionar `resolve_day_type(user, d: date) -> str` retornando **strings literais** `"holiday"`/`"weekend"`/`"weekday"` (core **não** pode importar `habits.models.DayType` — regra de porta; retorna bare strings, `habits` valida). Precedência `holiday > weekend > weekday` sem acumular: feriado se existe linha em `user_holidays` para `(user, d)`; senão `weekend` se `d.weekday() >= 5` (sáb/dom, semana começa na segunda — AD-05); senão `weekday`.
  - [x] Ler feriados com **import tardio** dentro da função (`from accounts.models import UserHoliday`) para blindar contra ordem de import (calendar é importado amplamente). Query auto-escopada por tenant: `UserHoliday.objects.filter(date=d).exists()` (contexto setado no request; fail-closed via `TenantManager`). `core → accounts` é permitido pelo import-linter (accounts **não** está em `forbidden_modules`). **Não** tocar `is_workday`.
  - [x] `backend/core/tests/test_calendar.py`: testar `resolve_day_type` — weekday (seg-sex), weekend (sáb/dom), holiday (linha em `user_holidays`, dentro de `tenant_context(user)`), e **precedência** (um sábado marcado feriado → `"holiday"`, não `"weekend"`).
- [x] **Task 3 — Model `HabitGroupDayMultiplier` + 2 colunas em `HabitDayEntry` + migration `habits/0003` (AC1, AC2)**
  - [x] Em `backend/habits/models.py`, adicionar `DayType(models.TextChoices)` no **nível do módulo** (como `HabitType` — visível ao `CheckConstraint` de `Meta`): `WEEKDAY = "weekday"`, `WEEKEND = "weekend"`, `HOLIDAY = "holiday"`. Expor `Habit.DayType`? Não — só usado por `HabitDayEntry`/`HabitGroupDayMultiplier`; deixar no módulo.
  - [x] `HabitGroupDayMultiplier(TenantModel)` (config prospectiva, espelha `HabitVersion`): `group = ForeignKey(HabitGroup, on_delete=CASCADE, related_name="day_multipliers")`; `day_type = CharField(max_length=8, choices=[(DayType.WEEKEND, ...), (DayType.HOLIDAY, ...)])` (**só weekend/holiday**; weekday nunca armazenado); `multiplier = DecimalField(max_digits=4, decimal_places=2)`; `effective_from = DateField()`; `created_at`. `Meta.db_table = "habit_group_day_multipliers"`; `ordering = ["group", "day_type", "-effective_from"]`; `constraints = [UniqueConstraint(fields=["group", "day_type", "effective_from"], name="uniq_group_day_multiplier_per_day"), CheckConstraint(condition=Q(day_type__in=[DayType.WEEKEND, DayType.HOLIDAY]), name="group_multiplier_day_type_valid")]`.
  - [x] Em `HabitDayEntry`, **acrescentar** `day_type = CharField(max_length=8, choices=DayType.choices, default=DayType.WEEKDAY)` e `multiplier_at_time = DecimalField(max_digits=4, decimal_places=2, default=Decimal("1.00"))` (adicionar `from decimal import Decimal` no topo de `models.py` — ainda não importado). Defaults backfillam as linhas materializadas na 6.2 para `weekday`/`1.00` (semântica correta = "sem multiplicador"). Atualizar a docstring do model (remover o "Projetar para 6.3", agora concretizado).
  - [x] `makemigrations habits --name day_type_multiplier` → **`0003_day_type_multiplier.py`** (`dependencies = [("habits", "0002_habit_day_entry")]`): **uma** migration cria `HabitGroupDayMultiplier` **e** adiciona as 2 colunas a `habit_day_entries`. Sem dependência cross-app (feriados não são FK de habits).
  - [x] `backend/habits/admin.py`: registrar `HabitGroupDayMultiplierAdmin` (`all_objects`); acrescentar `day_type`/`multiplier_at_time` ao `list_display` de `HabitDayEntryAdmin`.
- [x] **Task 4 — Serviço: resolução de multiplicador, seed atualizado, completude por peso efetivo, config e feriado (AC1, AC2, AC3)**
  - [x] `multiplier_for(group, day_type, on_date) -> Decimal` em `habits/services.py` (helper interno auto-escopado, **sem** `user` — como `current_version_of`): se `day_type == DayType.WEEKDAY` → `Decimal("1.00")`; senão a linha vigente `HabitGroupDayMultiplier.objects.filter(group=group, day_type=day_type, effective_from__lte=on_date).order_by("-effective_from").first()` → seu `multiplier`, ou `Decimal("1.00")` se `None`.
  - [x] Atualizar `seed_habit_day`: computar `day_type = resolve_day_type(user, date)` **uma vez**; por hábito ativo, `multiplier = multiplier_for(habit.group, day_type, date)`; criar a linha congelando também `day_type=day_type, multiplier_at_time=multiplier`. (`habit.group` já vem via `select_related("group")`.) Gap-fill idempotente e imunidade de dias passados **inalterados**.
  - [x] `_effective_weight(entry) -> Decimal`: `entry.weight_at_time * entry.multiplier_at_time`. Trocar `weight_at_time` por `_effective_weight(e)` em `_completeness_pct` (numerador **e** denominador) — é a mudança cirúrgica que a 6.2 preparou isolando `weight_at_time`. Guarda `Σ peso_efetivo == 0 → 0` mantida.
  - [x] `set_group_day_multiplier(*, user, group_id, day_type, multiplier) -> HabitGroupDayMultiplier` (`@transaction.atomic`): validar `day_type ∈ {weekend, holiday}` (senão `DomainError`); `HabitGroupDayMultiplier.objects.update_or_create(group=<get>, day_type=day_type, effective_from=today_for(user), defaults={"multiplier": multiplier})`. **Prospectivo** (igual `add_habit_version`): não toca dias congelados. Valida existência/escopo do grupo (`HabitGroup.objects.get`).
  - [x] `current_multipliers_of(group, on_date) -> dict` → `{"weekend": multiplier_for(group, WEEKEND, on_date), "holiday": multiplier_for(group, HOLIDAY, on_date)}` (para exibir a config vigente).
  - [x] `set_holiday(*, user, date, is_holiday) -> None` (`@transaction.atomic`): import tardio `from accounts.models import UserHoliday`; se `is_holiday` → `UserHoliday.objects.get_or_create(date=date)`; senão → `UserHoliday.objects.filter(date=date).delete()`. **Depois**, recalcular só aquele dia (bounded, AD-10 item 6): `dt = resolve_day_type(user, date)`; para cada `HabitDayEntry.objects.filter(date=date).select_related("habit__group")`: setar `day_type = dt` e `multiplier_at_time = multiplier_for(entry.habit.group, dt, date)`, `save(update_fields=["day_type", "multiplier_at_time"])`. **Nunca** toca `value`, vizinhos, `habit_versions` (re-deriva da config — um override avulso anterior é re-derivado; documentar). `habits → accounts` permitido.
  - [x] Estender `update_habit_day_entry` (6.2) com `multiplier_at_time=None`: se informado, UPDATE **só naquela linha** (override avulso "nesse sábado eu trabalhei"). Não sangra; não toca `habit_versions`.
- [x] **Task 5 — API DRF + contrato (AC1, AC2, AC3)**
  - [x] **Serializers** (`habits/serializers.py`): (a) `HabitDayEntrySerializer` ganha `day_type` (read; `ChoiceField(choices=DayType.choices, source=... )`) e `multiplier_at_time` (read). (b) `HabitDaySerializer` ganha `day_type` (nível-dia, para o toggle/legenda). (c) `HabitDayEntryUpdateSerializer` ganha `multiplier_at_time` (write, opcional; `habit`/`date` continuam imutáveis). (d) **Config sem enum de `day_type` no wire** (evita colisão — ver Dev Notes › "Colisão de enum"): `GroupMultipliersSerializer` (read) e `SetGroupMultipliersSerializer` (write) usam chaves nomeadas `weekend`/`holiday` (`DecimalField(max_digits=4, decimal_places=2, required=False, allow_null=True)`). (e) `SetHolidaySerializer` (write): `date = DateField()`, `is_holiday = BooleanField()`.
  - [x] **Views finas** (`habits/views.py`, `APIView` + `@extend_schema`): `HabitDayView.get` computa `day_type = resolve_day_type(user, day)` e o inclui no payload (`entries` já trazem os campos via serializer). Novas: `HabitGroupMultipliersView` (GET → `current_multipliers_of`; PUT → para cada chave enviada, `set_group_day_multiplier`) em `/api/habit-groups/<uuid:pk>/multipliers/`; `HabitHolidayView` (POST/PATCH → `set_holiday`; opcional GET lista feriados por range) em `/api/habits/holidays/`.
  - [x] **Rotas:** `habits/urls_groups.py` += `"<uuid:pk>/multipliers/"`; `habits/urls.py` += `"holidays/"` (antes de `<uuid:pk>/`, como `days/`). **Nenhuma** mudança em `config/urls.py` (mesmos prefixos `/api/habits/` e `/api/habit-groups/`).
  - [x] **Enum override (contrato):** em `backend/config/settings/base.py` `SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"]`, adicionar `"DayTypeEnum": "habits.models.DayType"` (pin do enum de 3 valores de `day_type`; a config de multiplicador **não** emite enum `day_type` — usa chaves `weekend`/`holiday`, sem colisão). Ver Dev Notes › "Colisão de enum".
  - [x] Regenerar contrato: `uv run python manage.py spectacular --file ../schema.yaml` + `npm run generate-types` → commitar `schema.yaml` **e** `frontend/src/api/types.gen.ts`. Verificar diff **aditivo** (novos `HabitGroupDayMultiplier*`, `GroupMultipliers*`, `SetHoliday*`; `day_type`/`multiplier_at_time` em `HabitDayEntry`; `day_type` em `HabitDay`; `DayTypeEnum` estável). O `TypeEnum`/`HabitTypeEnum` de bujo/habits **não** pode mudar (gate de diff no CI).
- [x] **Task 6 — Frontend: hooks + config de multiplicador + feriado + transparência no tracker (AC1, AC2, AC3)**
  - [x] `frontend/src/features/habits/types.ts`/`index.ts`: re-exportar os novos tipos gerados (`HabitGroupDayMultiplier`?, `GroupMultipliers`, `SetHoliday`, e os campos novos já vêm em `HabitDay`/`HabitDayEntry`).
  - [x] `frontend/src/api/keys.ts` seção `habits`: `groupMultipliers: (groupId: string) => ['habits', 'groupMultipliers', groupId] as const` (para a query de config). O estado de feriado vem no `habits.day(date)` (via `dayType`) — sem key nova.
  - [x] `features/habits/api.ts`: (a) `useGroupMultipliersQuery(groupId)` (GET `/api/habit-groups/${groupId}/multipliers/`, key `keys.habits.groupMultipliers(groupId)`). (b) `useSetGroupMultipliersMutation()` (PUT; vars `{ groupId, weekend?, holiday? }`; `onSuccess` invalida `['habits']`). (c) `useSetHolidayMutation(date?)` **otimista** via `useOptimisticMutation` (key `keys.habits.day(date)`, `updater` flipa `dayType`; % reconcilia no `onSettled`), espelhando `useMarkHabitEntryMutation` (`api.ts:166-180`). (d) override avulso: reusar `useMarkHabitEntryMutation` estendendo os vars com `multiplierAtTime?` **ou** um `useOverrideDayMultiplierMutation` que itera as linhas do dia (default: itera via o PATCH de entry existente). Re-exportar tudo em `index.ts`.
  - [x] **Config (Settings › Hábitos):** primeira afordância de edição por-grupo em `HabitsManager.tsx` `GroupSection` (`components/HabitsManager.tsx:168-184`, hoje display-only): dois `TextField type="number"` por grupo ("Fim de semana ×", "Feriado ×"), preenchidos por `useGroupMultipliersQuery`, salvos por `useSetGroupMultipliersMutation` com a tooltip honesta-com-o-passado (`PROSPECTIVE_CHANGE_TOOLTIP`, `HabitsManager.tsx:29-30`) e `SAVE_ERROR` inline. Controlado por `useState` + MUI (sem react-hook-form/zod).
  - [x] **Tracker (`HabitTracker.tsx`):** (a) no cabeçalho (`:186-193`), toggle "Feriado" (MUI `Switch`/`Checkbox`, `role`/label, ≥44px) refletindo/mutando `dayType` via `useSetHolidayMutation`; (b) legenda factual de peso efetivo no cabeçalho do grupo (`GroupSection`, `:144-157`) quando o multiplicador do grupo `≠ 1` — derivar de `entries[].multiplierAtTime`+`dayType` (ex.: "Fim de semana · peso ×0,2"), neutra, **cor nunca sozinha** (texto+ícone); (c) controle de override "Tratar este dia como dia útil (peso cheio)" quando `dayType ≠ weekday`. Voz UX-DR13: pt-BR direto, zero gamificação/exclamação; formatação de decimal via `Intl.NumberFormat('pt-BR')` (padrão `formatNumber`, `:17-21`).
  - [x] **NÃO** adicionar filho com TanStack Query a `Sidebar`/`BottomNav` (badge etc.) — quebraria os 3 testes compartilhados. `HabitTracker` vive no `<Outlet/>`, então não os afeta (confirmado na 6.2). Ver Dev Notes › "Armadilha dos 3 testes".
- [x] **Task 7 — Testes backend (todas as ACs)**
  - [x] `accounts/tests/factories.py`: `UserHolidayFactory` (`class Params: user = SubFactory(UserFactory)` + `user_id = SelfAttribute("user.id")`; `date` fixa + `timedelta`, **nunca** `date.today()` — guardrail AST) + `register_isolation_case(id="accounts.UserHoliday", model=UserHoliday, make=lambda: {"date": date(2026, 1, 1)})`. **Editar `backend/conftest.py`:** acrescentar `"accounts.tests.factories"` a `_ISOLATION_TEST_MODULES` (accounts **não** está listado hoje — diferente de habits). Ver Dev Notes › "Isolamento de accounts".
  - [x] `habits/tests/factories.py`: `HabitGroupDayMultiplierFactory` (padrão `class Params` + `SelfAttribute`) + `register_isolation_case("habits.HabitGroupDayMultiplier", ...)` (conftest já lista `habits.tests.factories`). `HabitDayEntryFactory` funciona com os defaults novos (weekday/1.00); adicionar overrides só onde os testes precisarem.
  - [x] `test_models/serializers/services/views.py` cobrindo: (a) `resolve_day_type` precedência (via core, Task 2) — e no seed: sábado → linhas com `day_type=weekend`+`multiplier` do grupo; feriado → `holiday` (precedência sobre weekend); weekday → `weekday`+`1.00`; (b) **congelamento**: `multiplier_at_time` semeado da versão vigente em D; grupo sem config → `1.00`; (c) **completude por peso efetivo**: exemplo âncora com multiplicador (ver Dev Notes › "Matemática"); `multiplier=0` remove o grupo de num+den; (d) **config prospectiva não sangra**: alterar multiplicador hoje não muda linhas de dias congelados; (e) **feriado recalcula só o dia**: `set_holiday` re-resolve `day_type`+`multiplier` das linhas de D, preserva `value`, não toca vizinhos nem `habit_versions`; (f) **override avulso**: `update_habit_day_entry(multiplier_at_time=1)` altera só aquela linha; (g) endpoints (GET days com `dayType`/`multiplierAtTime`; PUT multipliers prospectivo; POST holiday + recálculo; data inválida 400; rejeição de mutação de identidade 400); (h) isolamento multi-tenant + fail-closed para `UserHoliday` e `HabitGroupDayMultiplier` (via gate parametrizado).
- [x] **Task 8 — Testes frontend (AC1, AC2, AC3)**
  - [x] `features/habits/api.test.tsx`: casos de `useSetGroupMultipliersMutation` (payload + invalidação) e `useSetHolidayMutation` (otimista: flip de `dayType` antes do servidor com Promise deferida; rollback em erro) — espelhando os 3 casos otimistas existentes. Atualizar fixtures `HABIT_DAY`/`ENTRY` com `dayType`/`multiplierAtTime`.
  - [x] `HabitTracker.test.tsx`: toggle de feriado (otimista), legenda de peso efetivo quando `multiplier ≠ 1`, sem violações a11y (`jest-axe`, `ThemeProvider theme={createBujoTheme('light')}`). Atualizar `BOOLEAN_ENTRY`/`NUMERIC_ENTRY`/`makeDay` com os campos novos.
  - [x] `HabitsManager.test.tsx`: config de multiplicador por grupo (renderiza campos weekend/holiday, salva com o mutation certo), a11y. `setGet` deve rotear `/api/habit-groups/<id>/multipliers/`.
- [x] **Task 9 — Verificação e contrato**
  - [x] Backend verde: `ruff`, `lint-imports` (**verificar KEPT**: `core → accounts` é permitido; `habits → accounts` é permitido; `core` continua **sem** importar habits/domínio), `pytest` (escopado a `accounts core habits` + suíte relevante). Ver Dev Notes › "Regra de porta".
  - [x] `spectacular` + diff de `types.gen.ts` **aditivo** (novos schemas; `DayTypeEnum` estável; `TypeEnum`/`HabitTypeEnum` intactos).
  - [x] Frontend verde: `tsc`, ESLint (fronteira de feature), `vitest`, `vite build`. **`nvm use 22.15.1`** antes de todo comando de frontend/e2e (sessão inicia em v18). **Não** passar `--no-file-parallelism`/`--workers=1` (já default).
  - [x] **Aplicar `accounts.0002_*` e `habits.0003_*` às branches Neon `dev` e `e2e`** antes de rodar suítes que batem no banco (lacuna ambiental recorrente ao evoluir schema — Épico 5).

## Dev Notes

### Contexto de arquitetura — AD-10 empilha "ritmo" sobre o snapshot da 6.2

A 6.1 entregou a **config prospectiva** (`habit_versions`); a 6.2 entregou o **snapshot realizado** (`habit_day_entries`, congelado/editável por dia) com o `weight_at_time` **base** já isolado na fórmula. A 6.3 é a **camada de ritmo** de AD-10: um multiplicador **por grupo × tipo de dia** que dobra o peso base sem confundir-se com mudança real de peso [Source: architecture.md#AD-10 linhas 571-630]. **Três fontes de variação** de uma série de hábito, que a 6.4/AD-11 exige nunca confundir: (1) valor/comportamento, (2) mudança real de config (`habit_versions` — evento), (3) **multiplicador de tipo de dia** (ritmo periódico — nunca evento) [Source: architecture.md#AD-11 linhas 634-645]. Por isso `day_type`+`multiplier_at_time` são **congelados separados** do `weight_at_time` (não o produto): habilita transparência na UI, distinção evento-vs-ritmo, e override avulso de um dia [Source: architecture.md#AD-10 item 3 linha 584].

| Ação | Mecanismo | Story | Sangra? |
|---|---|---|---|
| Mudar peso/meta/bonus/ativação | INSERT `habit_version` | 6.1 | ❌ dias congelados intactos |
| Corrigir `value`/`weight_at_time` de um dia | UPDATE 1 linha `habit_day_entries` | 6.2 | ❌ só aquele dia |
| Mudar multiplicador do grupo (weekend/holiday) | INSERT `habit_group_day_multiplier` (`effective_from=hoje`) | **6.3** | ❌ dias congelados mantêm `multiplier_at_time` antigo |
| Marcar/desmarcar feriado | toggle `user_holidays` + **recálculo bounded de D** | **6.3** | ❌ só o dia D re-resolve |
| Override avulso "trabalhei nesse sábado" | UPDATE `multiplier_at_time` de 1 linha/dia | **6.3** | ❌ vizinhos intactos |

### Padrão temporal canônico + resolução de tipo de dia

`resolve_day_type(user, D)` é a **nova autoridade de tipo de dia**, em `core/calendar.py` (a autoridade única do "dia", §6.8) [Source: architecture.md linha 1094; docs/temporal-pattern.md]. Precedência **`holiday > weekend > weekday` sem acumular** [Source: architecture.md#AD-10 item 2 linhas 579-582]:
- `holiday`: presença em `user_holidays (user_id, date)` — booleano manual por usuário.
- `weekend`: automático, `d.weekday() >= 5` (sáb/dom; semana começa na segunda — AD-05, coerente com `week_start_of`/`is_workday`).
- `weekday`: o resto.
- Um sábado marcado feriado → `holiday` (não multiplica os dois).

Materialização ansiosa idempotente na 1ª abertura (AD-06, sem cron): `seed_habit_day` resolve `day_type(D)` e congela `multiplier_at_time` do multiplicador vigente em D. **Dias pulados** abertos depois recebem o `day_type`/multiplicador **daquele dia** (via `resolve_day_type` na data D e `effective_from <= D`), nunca os de hoje [Source: architecture.md#AD-10 item 7 linha 593]. `resolve_day_type(user, D)` retorna **string literal** — `core` **não** importa `habits.DayType` (regra de porta); `habits` mapeia a string para `DayType`.

### Feriados moram em `accounts`, lidos por `core/calendar`, escritos por `habits` (regra de porta)

Arquitetura §6.9: **"`user_holidays` pertencem ao perfil (`accounts`), lidos por `core/calendar`"** [Source: architecture.md linhas 1094, 1098, 1148, 1290]. Por que `accounts` e não `habits`: `core/calendar.resolve_day_type` **precisa** ler feriados, e `core → habits` é **proibido** pela regra de porta; mas `core → accounts` é **permitido** (o contrato só proíbe `core → {bujo, habits, health, medications, gratitude, braindump}`) [Source: backend/pyproject.toml:52-59]. Logo o model **tem** que ficar em `accounts` (ou `core`); arquitetura fixa `accounts`. O **workflow de escrita** (togglar feriado + recalcular `habit_day_entries` de D) é concern de `habits`, então o endpoint mora em `habits` e o serviço `set_holiday` escreve `accounts.UserHoliday` (`habits → accounts` permitido) e recalcula. Resultado: `accounts` fica um model "burro"; `core` lê; `habits` orquestra. `UserHoliday` herda `TenantModel` (auto-scope + fail-closed + gate de isolamento; import `accounts → core` permitido) — a AD-10 desenha PK `(user_id, date)`, mas o projeto exige UUID PK + `user_id` indexado, então unicidade vira `UniqueConstraint(user_id, date)` (mesma reconciliação de `habit_day_entries`) [Source: backend/core/models.py:21-43].

**Import tardio em `resolve_day_type`:** `from accounts.models import UserHoliday` **dentro da função** — sem ciclo real (`core.calendar → accounts.models → core.models`; `core.models` não importa nenhum dos dois), mas o import tardio blinda contra fragilidade de ordem de carregamento já que `calendar` é importado amplamente. O grimp (import-linter) detecta imports em qualquer nível, mas `core → accounts` é permitido, então o contrato continua verde.

### Colisão de enum de `day_type` no contrato — projetar o wire para evitá-la

Há **dois** campos `day_type` com **conjuntos de valores diferentes**: `HabitDayEntry.day_type` (weekday/weekend/holiday) e `HabitGroupDayMultiplier.day_type` (weekend/holiday). Expor ambos como `ChoiceField` chamado `day_type` faria o drf-spectacular gerar dois `DayTypeEnum` e renomear um com hash instável — exatamente a classe de bug que motivou `ENUM_NAME_OVERRIDES` na 6.1 (`type` de habits × `type` de bujo) [Source: backend/config/settings/base.py:178-188]. **Solução:** a config de multiplicador **não emite** um enum `day_type` no wire — usa **chaves nomeadas** `weekend`/`holiday` (payload `{ "weekend": "0.20", "holiday": "0.00" }` para GET e PUT). Só `HabitDayEntry.day_type` (e o `day_type` de nível-dia em `HabitDay`, mesmos 3 valores → mesmo enum) emitem `DayTypeEnum`, pinado via `"DayTypeEnum": "habits.models.DayType"`. Um único enum, sem colisão.

### Matemática de completude (FR-2.4) — agora com peso efetivo

A mudança é **cirúrgica** (a 6.2 isolou `weight_at_time` de propósito): o **peso** em num+den passa de `weight_at_time` para `peso_efetivo = weight_at_time × multiplier_at_time` [Source: architecture.md#AD-10 item 4 linhas 586-587; habits/services.py:216-231].

```
peso_efetivo_i = weight_at_time_i × multiplier_at_time_i
completude = Σ(contribuicao_i × peso_efetivo_i) / Σ(peso_efetivo_i)   sobre as linhas do dia
```
- A **contribuição** por hábito (booleano/numérico/bonus/meta) **não muda** — `_contribution(entry)` fica igual à 6.2 [Source: backend/habits/services.py:195-213].
- **% do grupo** = mesma fórmula restrita às linhas do grupo.
- `multiplier_at_time = 0` (ex.: feriado com `holiday=0.0`) → `peso_efetivo = 0`: o hábito sai de num **e** den (não conta). Guarda `Σ peso_efetivo == 0 → 0` já existe (evita divisão por zero).
- **Exemplo âncora (teste):** grupo Profissional, sábado, `weekend=0.2`. H1 booleano peso 2 feito (contrib 1, peso_efetivo 2×0.2=0.4) + H2 booleano peso 1 feito (contrib 1, peso_efetivo 1×0.2=0.2) → `(1×0.4 + 1×0.2)/(0.4+0.2) = 0.6/0.6 = 100%`. Misturando grupos: acima + H3 (outro grupo, weekday-multiplier 1.0) peso 1 **não** feito (contrib 0, peso_efetivo 1.0) → total `(0.4+0.2+0)/(0.4+0.2+1.0) = 0.6/1.6 = 37,5% → 38%` (arredondamento `ROUND_HALF_UP`). Fazer a matemática em `Decimal` no backend; expor os % já calculados (frontend não recalcula — confirmado: o tracker só exibe `totalCompletion`/`group.completion`).

### Camada de serviço (§6.2) — regras não-negociáveis (idênticas à 6.1/6.2)

- Funções de módulo, **NUNCA classes**; `user` = primeiro kwarg keyword-only (exceções auto-escopadas sem `user`: `current_version_of`, `multiplier_for`) [Source: architecture.md §6.2; backend/habits/services.py:26].
- `@transaction.atomic` em toda escrita (`set_group_day_multiplier`, `set_holiday`, `update_habit_day_entry`, `seed_habit_day`); a view **nunca** abre transação.
- Scoping implícito via `TenantManager` — **não** passar `user_id` em query, **não** usar `all_objects` (exceto admin) [Source: backend/core/models.py:29-30].
- **Só exceções de `core/exceptions.py`** — `DomainError` para `day_type` inválido em `set_group_day_multiplier`; proibido `ValueError`/`ValidationError` cru no serviço. `ImmutableSnapshot` **não** se aplica a marcação/correção/override legítimos (é o propósito do AD-06/10); reservá-la só a mutação de identidade do snapshot (validada no serializer → 400) [Source: backend/core/exceptions.py:46-114].

### Frontend — hooks otimistas + config de grupo (primeira edição por-grupo) + transparência

- **O frontend não faz matemática de peso** — só exibe `totalCompletion`/`group.completion`/e (novo) o multiplicador/`dayType`. Multiplicador propaga automaticamente via os % recalculados no backend + invalidação de `keys.habits.day` (confirmado na recon) [Source: frontend/src/features/habits/components/HabitTracker.tsx:182-201].
- **Otimismo** (feriado/override): `useOptimisticMutation` (`onMutate` cancel→snapshot→`setQueryData`; `onError` rollback; `onSettled` invalidate), espelhando `useMarkHabitEntryMutation` [Source: frontend/src/shared/hooks/useOptimisticMutation.ts:18-42; frontend/src/features/habits/api.ts:149-180]. Nuance: `totalCompletion`/`group.completion` vêm do backend — o `updater` flipa `dayType` na hora; os % reconciliam no `onSettled`.
- **Config por-grupo é greenfield:** `GroupSection` do `HabitsManager` é display-only hoje (não há mutation de update de grupo). A 6.3 introduz a primeira edição por-grupo — dois campos de multiplicador no cabeçalho do grupo, salvos prospectivamente com a tooltip **"Alteração válida a partir de hoje. Registros anteriores preservados."** (mesma voz da 6.1) [Source: frontend/src/features/habits/components/HabitsManager.tsx:29-30, 168-184].
- **Voz (UX-DR13):** pt-BR direto, **zero gamificação/troféus/sequências/exclamações**; o multiplicador é **divulgação factual neutra** ("peso ×0,2 · fim de semana"), nunca recompensa/penalidade; **cor nunca comunica sozinha** (texto+ícone) [Source: epics.md#UX-DR13 linha 168; ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md:106,123,203]. Estados vazios/labels honestos; `Intl.NumberFormat('pt-BR')` para decimais.
- **Tipos/keys:** re-exportar tipos gerados em `types.ts`/`index.ts`; `keys.habits.groupMultipliers(groupId)` (sem `userId`, como o resto de `habits.*`) [Source: frontend/src/api/keys.ts:33-38].

### Isolamento de `accounts` — editar conftest (diferente de habits)

O gate de isolamento parametrizado (§7.4) percorre `_ISOLATION_TEST_MODULES` no `conftest.py`. Hoje inclui `core/bujo/braindump/habits`, **não** `accounts` [Source: backend/conftest.py:19-24]. Para cobrir `UserHoliday`, **acrescentar `"accounts.tests.factories"`** à lista **e** chamar `register_isolation_case(id="accounts.UserHoliday", ...)` nesse arquivo. `HabitGroupDayMultiplier` **não** exige edição de conftest (`habits.tests.factories` já listado) [Source: backend/core/tests/registry.py:19-36; backend/habits/tests/factories.py:74-113]. Guardrail temporal continua ativo em ambos os factories (não são `test_*.py`): datas fixas + `timedelta`, nunca `date.today()`.

### Regra de porta — o que o `lint-imports` deve manter (KEPT)

- `core` **continua sem** importar nenhum app de domínio (habits/bujo/...). `resolve_day_type` importa **`accounts`**, que **não** é app de domínio no contrato (é `root_package`, não está em `forbidden_modules`) → **permitido** [Source: backend/pyproject.toml:52-59].
- `habits → accounts` (para `set_holiday` escrever `UserHoliday`) → **permitido** (não há contrato proibindo domínio→accounts; accounts é fundacional).
- `accounts → core` (para `UserHoliday(TenantModel)`) → **permitido**.
- Confirmar `lint-imports` **KEPT** após as mudanças (uma quebra indica import cruzado indevido).

### Ambiente / CI / operação (retros Épico 5)

- **Node ≥ 22.15.1 via nvm** antes de todo comando de frontend/e2e (sessão inicia em v18) [Source: memória `frontend-needs-node-22-via-nvm`].
- **Paralelismo Neon**: `fileParallelism:false` (vitest) e `workers:1` (playwright) já default — **não** passar flags [Source: epic-5-retro §7].
- **Migrations em branches Neon dedicadas**: aplicar `accounts.0002_*` **e** `habits.0003_*` às branches `dev` e `e2e` antes de suítes que batem no banco (lacuna recorrente) [Source: epic-5-retro §3].
- **Gates de CI** (ordem): `ruff` → `lint-imports` → `pytest` → `spectacular` + diff de `types.gen.ts` (backend); `tsc` → ESLint → `vite build` (frontend). **Vitest não roda no CI** — rede local/review [Source: .github/workflows/ci.yml:56-111].
- **Suíte grande e serial**: a suíte completa é lenta (~20 min, `workers:1`); rodar em blocos foreground `--reuse-db` cobrindo **todos** os apps, sem omitir (padrão da 6.2) [Source: 6-2 Debug Log].
- **Commit ao fim da story**: 1 commit/story; rodar `/bmad-uncommitted-report`, salvar o report, então commitar **sem** pedir "[S]im" [Source: memória `commit-at-end-of-each-story`].

### Inteligência da story anterior (6.2 — mesmo épico)

Padrões diretamente reusáveis e armadilhas já mapeadas [Source: 6-2-tracker-diario-com-snapshot-imutavel-e-completude-ponderada.md]:
- **`weight_at_time` já foi isolado** em `_completeness_pct` **de propósito** para a 6.3 — a troca por `_effective_weight` é a mudança planejada, não uma reescrita [Source: backend/habits/services.py:216-231; 6-2 Completion Notes].
- **`response.data` do DRF é snake_case** (a camelização ocorre só no renderer JSON): asserts de view em `total_completion`/`weight_at_time`/`day_type`/`multiplier_at_time`, não camelCase. O wire JSON é camelCase (verificado pelos tipos gerados) [Source: 6-2 Debug Log].
- **Sentinela `_UNSET`** em `update_habit_day_entry` distingue "não enviado" de "None"; ao acrescentar `multiplier_at_time`, `None` = "não enviado" (não há caso de "desmarcar multiplicador"; default é 1.0, não null) — usar `None` como "não informado" é suficiente aqui [Source: backend/habits/services.py:266-295].
- **Armadilha dos 3 testes compartilhados**: `Sidebar/BottomNav/AppLayout.test.tsx` renderizam a casca sem `QueryClientProvider`; `HabitTracker` vive no `<Outlet/>` (páginas), então **não** os afeta. Só quebraria com um filho Query-driven na casca — evitar. A `DailyPage`/`router.test.tsx`/`RouteAnnouncer.test.tsx` já mockam `../features/habits` [Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; 6-2 Debug Log].
- **File List honesto** e contagem de testes colada **após** escrever o último teste [Source: epic-5-retro §3].

### Project Structure Notes

- **Backend `accounts/`:** `models.py` (+`UserHoliday`), `admin.py` (+admin), `tests/factories.py` (+factory + isolation case). Migration nova `migrations/0002_user_holiday.py`. **`conftest.py`** (+`accounts.tests.factories` em `_ISOLATION_TEST_MODULES`).
- **Backend `core/`:** `calendar.py` (+`resolve_day_type`), `tests/test_calendar.py` (+testes). **Não** tocar `is_workday`, `models.py`, contrato de porta.
- **Backend `habits/`:** `models.py` (+`DayType`, +`HabitGroupDayMultiplier`, +2 campos em `HabitDayEntry`), `services.py` (+`multiplier_for`, +`set_group_day_multiplier`, +`current_multipliers_of`, +`set_holiday`, +`_effective_weight`; atualiza `seed_habit_day`, `_completeness_pct`, `update_habit_day_entry`), `serializers.py` (+campos e serializers de config/feriado), `views.py` (+2 views, `HabitDayView` inclui `day_type`), `urls.py` (+`holidays/`), `urls_groups.py` (+`<uuid:pk>/multipliers/`), `admin.py` (+admin, +colunas). Migration nova `migrations/0003_day_type_multiplier.py`. `tests/factories.py` (+factory + isolation case), `tests/test_*.py`.
- **Backend `config/`:** `settings/base.py` (+`"DayTypeEnum"` em `ENUM_NAME_OVERRIDES`). **Não** tocar `config/urls.py`.
- **Frontend:** `features/habits/api.ts` (+hooks), `types.ts`/`index.ts` (+tipos), `components/HabitsManager.tsx` (config de multiplicador por grupo), `components/HabitTracker.tsx` (toggle de feriado + legenda de peso efetivo + override de dia); `api/keys.ts` (+`habits.groupMultipliers`). Testes: `api.test.tsx`, `HabitTracker.test.tsx`, `HabitsManager.test.tsx`.
- **Regenerados:** `schema.yaml`, `frontend/src/api/types.gen.ts`.
- **Não tocar:** `config/urls.py`, `Sidebar.tsx`/`BottomNav.tsx`, `is_workday`. Nenhuma variância de estrutura detectada além da adição de `UserHoliday` ao `accounts/models.py` único (em vez do pacote desenhado — decisão de escopo documentada).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.3 linhas 1167-1188] — user story + ACs originais
- [Source: _bmad-output/planning-artifacts/epics.md linhas 55-58, 134, 156, 168, 284] — FR-2.4, AR-17, UX-DR4, UX-DR13, objetivo Épico 6
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-10 linhas 571-630] — multiplicador por grupo×tipo de dia, precedência, congelar base+multiplicador separados, fórmula, prospectivo, recálculo bounded de feriado, schema, casos-âncora
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-11 linhas 634-656] — multiplicador é ritmo (nunca evento); contrato de read-path para a 6.4
- [Source: _bmad-output/planning-artifacts/architecture.md linhas 1089-1098, 1148, 1290] — core/calendar autoridade do dia lê user_holidays de accounts; accounts dono de user_holidays; grafo acíclico
- [Source: _bmad-output/planning-artifacts/architecture.md §6.8 linhas 949-957] — materialização por service explícito idempotente; multiplicador calculado só no serviço
- [Source: docs/temporal-pattern.md] — `today_for`/DATE vs TIMESTAMPTZ/materialização ansiosa idempotente
- [Source: backend/core/calendar.py:14-59] — `today_for`, `week_start_of`, `is_workday` (stub a não tocar; `resolve_day_type` novo)
- [Source: backend/core/models.py:21-43; backend/core/exceptions.py:46-114] — `TenantModel`, `DomainError`
- [Source: backend/pyproject.toml:52-59] — contrato import-linter (core não importa domínio; accounts é root_package permitido)
- [Source: backend/accounts/models.py:1-27; backend/accounts/migrations/0001_initial.py] — `User` (a base da migration 0002); onde `UserHoliday` entra
- [Source: backend/habits/models.py:18-139] — `HabitType`/`HabitGroup`/`Habit`/`HabitVersion`/`HabitDayEntry` (padrões a espelhar; docstring "Projetar para 6.3" a concretizar)
- [Source: backend/habits/services.py:26-296] — `current_version_of`, `seed_habit_day`, `_contribution`, `_completeness_pct`, `compute_day_completeness`, `update_habit_day_entry` (pontos de extensão)
- [Source: backend/habits/serializers.py:122-194; backend/habits/views.py:134-192; backend/habits/urls.py; backend/habits/urls_groups.py] — serializers/views/rotas de day-entry e de grupos a estender
- [Source: backend/config/settings/base.py:161-189] — `SPECTACULAR_SETTINGS`/`ENUM_NAME_OVERRIDES` (adicionar `DayTypeEnum`; precedente da colisão de `type`)
- [Source: backend/conftest.py:19-24; backend/core/tests/registry.py:19-36] — `_ISOLATION_TEST_MODULES` (acrescentar `accounts.tests.factories`) + `register_isolation_case`
- [Source: backend/habits/tests/factories.py:1-113; backend/accounts/tests/factories.py] — padrões de factory + isolation case
- [Source: frontend/src/features/habits/api.ts:23-180] — hooks (queries + `useMarkHabitEntryMutation` otimista a espelhar)
- [Source: frontend/src/features/habits/components/HabitsManager.tsx:29-30, 168-184] — `GroupSection` display-only + tooltip prospectiva (config greenfield)
- [Source: frontend/src/features/habits/components/HabitTracker.tsx:17-21, 144-204] — cabeçalho do dia/grupo, `formatNumber`, ponto de montagem do toggle/legenda
- [Source: frontend/src/api/keys.ts:33-38; frontend/src/api/types.gen.ts:639-759] — keys de habits; shapes gerados (`HabitDay`/`HabitDayEntry`/`HabitGroup`, decimais como string)
- [Source: frontend/src/features/habits/{api.test.tsx,components/HabitTracker.test.tsx,components/HabitsManager.test.tsx}] — harness de teste (mocks, fixtures, otimista, ThemeProvider+axe)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/{EXPERIENCE.md,DESIGN.md}] — voz/anti-gamificação/a11y (feature em si é UX-silente; originar sob UX-DR4/DR13 + AD-10 transparência)
- [Source: _bmad-output/implementation-artifacts/6-2-tracker-diario-com-snapshot-imutavel-e-completude-ponderada.md] — story anterior (mesmo épico): isolamento de `weight_at_time`, snake_case em `.data`, `_UNSET`, armadilha dos 3 testes
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-17.md §3/§6/§7] — aprendizados de ambiente/CI aplicáveis
- [Source: memórias do projeto] — `commit-at-end-of-each-story`, `story-language-conventions`, `frontend-needs-node-22-via-nvm`, `sidebar-bottomnav-shared-tests-need-query-mock`, `ask-dont-assume-functionality-flows`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — dev-story workflow controlado in-session.

### Debug Log References

- **Contagem de testes colada literalmente após rodar (guardrail retro Épico 3/11):**
  - Backend: `uv run pytest -q --reuse-db` (SEM escopo por caminho) → **538 passed** em 1386s (0:23:06). Rodada final após escrever o último teste.
  - Frontend: `npx vitest run` (suíte completa) → **648 passed** (56 arquivos). Habits isolado: 38 passed (3 arquivos).
- **`--create-db` na 1ª rodada** para materializar `accounts.0002` + `habits.0003` no `test_neondb` (dev); depois `--reuse-db`.
- **Bugs de teste corrigidos durante o dev (não de produção):**
  1. Testes de serviço/view do 6.3 usavam `effective_from=_D1` (março) com dias de fim de semana em janeiro (`_SAT`/`_MON`) → config/versão não vigente no dia consultado; introduzido `_EARLY = date(2026,1,1)` como effective_from. 8 falhas → verdes.
  2. `test_get_day_includes_day_type_and_frozen_multiplier` usava `create_habit` (vigente hoje) consultando um sábado passado → sem linha materializada; trocado por `HabitFactory` + `HabitVersionFactory(effective_from=2026-01-01)`.
- **Frontend — armadilhas de teste resolvidas:**
  1. MUI `Tooltip` injeta `aria-label` (o texto do tooltip) no filho direto, sobrescrevendo o nome acessível do `Button` ("Salvar multiplicadores"). Solução: mover o Tooltip para os **campos** (input mantém seu `aria-label`, padrão da 6.1), botão fica com nome próprio.
  2. `userEvent.clear`/`type` não funcionam em `input type=number` no jsdom (sem suporte a seleção; `type('0.2')` sanitiza o `.`). Solução no componente: montar o form só após a config carregar (estado inicializa uma vez, sem corrida de prefill); no teste: `fireEvent.change` seta o valor direto.
- **Kill da 1ª rodada full-suite:** a suíte completa em background foi morta ao rodar `manage.py migrate` concorrente na branch `dev` (mesmo compute Neon). Re-rodada limpa (sem operações Neon concorrentes) → 538 passed.

### Completion Notes List

Implementada a **camada de ritmo** de AD-10 empilhada sobre o snapshot da 6.2, cobrindo as 3 ACs:

- **AC1 — Config prospectiva + feriados manuais:** `HabitGroupDayMultiplier` (habits) versionado por `(grupo, day_type∈{weekend,holiday}, effective_from)` com `CheckConstraint` rejeitando `weekday`; `UserHoliday` (accounts, presença da linha = feriado, por usuário). `weekday` nunca armazenado (1.0 implícito); grupo/tipo sem config = 1.0.
- **AC2 — Materialização congela + peso efetivo:** `resolve_day_type` (core/calendar, nova autoridade; precedência `holiday>weekend>weekday` sem acumular; import tardio de `accounts.UserHoliday`, `is_workday` intacto). `seed_habit_day` resolve o tipo do dia uma vez e congela `day_type`+`multiplier_at_time` (separados do `weight_at_time` base). Completude passa a usar `peso_efetivo = weight_at_time × multiplier_at_time` em num+den (troca cirúrgica de `weight_at_time` por `_effective_weight` isolada pela 6.2). Âncora testada: mix de grupos → 0.6/1.6 = 37,5% → **38%** (ROUND_HALF_UP). `multiplier=0` remove o grupo de num+den (guarda `Σ==0→0`). Tracker exibe legenda factual ("Fim de semana · peso ×0,2", texto+ícone) quando `≠1` (UX-DR13, sem gamificação).
- **AC3 — Ajustes não sangram:** alterar multiplicador do grupo = INSERT prospectivo (`effective_from=hoje`, dias congelados intactos); marcar/desmarcar feriado = `set_holiday` re-resolve `day_type`+`multiplier` só das linhas do dia D (bounded — `value` preservado, vizinhos/`habit_versions`/`weight_at_time` base intactos); override avulso de `multiplier_at_time` = UPDATE só naquela linha. Nenhuma ação toca `habit_versions`.
- **API/contrato:** `HabitDay`/`HabitDayEntry` ganham `day_type`/`multiplier_at_time`; novas rotas `PUT/GET /api/habit-groups/<pk>/multipliers/` (chaves `weekend`/`holiday`, sem enum `day_type` no wire → sem colisão) e `POST/PATCH /api/habits/holidays/`. Diff **aditivo**: `DayTypeEnum` pinado em `ENUM_NAME_OVERRIDES`; `TypeEnum`/`HabitTypeEnum` intactos.
- **Frontend:** hooks `useGroupMultipliersQuery`/`useSetGroupMultipliersMutation` (config prospectiva com tooltip honesta-com-o-passado), `useSetHolidayMutation` (otimista: flipa `dayType`, reconcilia no `onSettled`), `useOverrideDayWorkdayMutation` (itera o PATCH por-linha). Config por-grupo no `HabitsManager` (1ª edição por-grupo); toggle "Feriado" + legenda de peso efetivo + "tratar como dia útil" no `HabitTracker`. Sidebar/BottomNav **não** tocados (armadilha dos 3 testes evitada).
- **Regra de porta:** `lint-imports` KEPT — `core→accounts` e `habits→accounts` permitidos; `core` continua sem importar app de domínio.
- **Decisões de escopo (guardrail retro Épico 5):** `UserHoliday` acrescentado ao `accounts/models.py` único (não ao pacote desenhado) — mesma reconciliação pragmática de schema vs. convenção da 6.1/6.2; nenhum gap de especificação novo encontrado (ACs de epics.md/architecture.md/prd.md consistentes com o implementado).
- **Migrations aplicadas às branches Neon `dev` e `e2e`** (`accounts.0002_user_holiday`, `habits.0003_day_type_multiplier`).

### File List

**Backend — novos:**
- `backend/accounts/migrations/0002_user_holiday.py`
- `backend/habits/migrations/0003_day_type_multiplier.py`

**Backend — modificados:**
- `backend/accounts/models.py` (+`UserHoliday`)
- `backend/accounts/admin.py` (+`UserHolidayAdmin`)
- `backend/accounts/tests/factories.py` (+`UserHolidayFactory` + isolation case)
- `backend/conftest.py` (+`accounts.tests.factories` em `_ISOLATION_TEST_MODULES`)
- `backend/core/calendar.py` (+`resolve_day_type`; `is_workday` intacto)
- `backend/core/tests/test_calendar.py` (+testes de `resolve_day_type`)
- `backend/habits/models.py` (+`DayType`, +`HabitGroupDayMultiplier`, +2 colunas em `HabitDayEntry`, +import `Decimal`)
- `backend/habits/services.py` (+`multiplier_for`, +`set_group_day_multiplier`, +`current_multipliers_of`, +`set_holiday`, +`_effective_weight`; `seed_habit_day`/`_completeness_pct`/`update_habit_day_entry` atualizados)
- `backend/habits/serializers.py` (+`day_type`/`multiplier_at_time`; +`GroupMultipliers`/`SetGroupMultipliers`/`SetHoliday`/`HolidayResult`)
- `backend/habits/views.py` (+`HabitGroupMultipliersView`, +`HabitHolidayView`; `HabitDayView` inclui `day_type`)
- `backend/habits/urls.py` (+`holidays/`)
- `backend/habits/urls_groups.py` (+`<uuid:pk>/multipliers/`)
- `backend/habits/admin.py` (+`HabitGroupDayMultiplierAdmin`, +colunas em `HabitDayEntryAdmin`)
- `backend/habits/tests/factories.py` (+`HabitGroupDayMultiplierFactory` + isolation case; defaults novos em `HabitDayEntryFactory`)
- `backend/habits/tests/test_models.py`, `test_serializers.py`, `test_services.py`, `test_views.py` (+testes 6.3)
- `backend/config/settings/base.py` (+`"DayTypeEnum"` em `ENUM_NAME_OVERRIDES`)

**Contrato — regenerados:**
- `schema.yaml`
- `frontend/src/api/types.gen.ts`

**Frontend — modificados:**
- `frontend/src/api/keys.ts` (+`habits.groupMultipliers`)
- `frontend/src/features/habits/api.ts` (+4 hooks)
- `frontend/src/features/habits/types.ts` (+`DayType`/`GroupMultipliers`/`SetGroupMultipliers`/`SetHoliday`/`HolidayResult`)
- `frontend/src/features/habits/index.ts` (re-exports)
- `frontend/src/features/habits/components/HabitsManager.tsx` (config de multiplicador por grupo)
- `frontend/src/features/habits/components/HabitTracker.tsx` (toggle feriado + legenda de peso efetivo + override de dia)
- `frontend/src/features/habits/api.test.tsx`, `components/HabitTracker.test.tsx`, `components/HabitsManager.test.tsx` (+testes 6.3, fixtures atualizadas)

### Change Log

| Data | Mudança |
|------|---------|
| 2026-07-19 | Story 6.3 criada (create-story): multiplicador de peso por tipo de dia — `user_holidays` (accounts) + `habit_group_day_multipliers` (habits) + `day_type`/`multiplier_at_time` congelados em `habit_day_entries`; `resolve_day_type` em core/calendar; completude por peso efetivo; config prospectiva + toggle de feriado (recálculo bounded) + override avulso. Status → ready-for-dev. |
| 2026-07-19 | Story 6.3 implementada (dev-story): Tasks 1-9 concluídas. Backend 538 passed, frontend 648 passed; ruff/lint-imports (KEPT)/tsc/ESLint/vite build verdes; contrato aditivo (`DayTypeEnum` pinado, `TypeEnum`/`HabitTypeEnum` intactos); migrations aplicadas às branches Neon dev e e2e. Status → review. |
| 2026-07-19 | Automate (E2E): `habit-multiplier.spec.ts` + `seedMultiplierScenario.ts` (toggle feriado, multiplicador, completude com peso efetivo). Sem bugs de produção (falhas iniciais eram do teste; backend reproduzido correto). |
| 2026-07-19 | Code-review adversarial (in-session): 0 CRITICAL / 0 HIGH / 0 MEDIUM; 2 LOW/nit → follow-ups. `resolve_day_type`, peso efetivo, `set_holiday` bounded e override avulso verificados; migrations aditivas; regra de porta KEPT. Status → **done**. |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (story-automator, in-session) · **Data:** 2026-07-19
**Resultado:** ✅ **Approve → done** (0 CRITICAL, 0 HIGH, 0 MEDIUM)

**Verificado contra o código:** AC1 (`set_group_day_multiplier` prospectivo por `(grupo, weekend/holiday)`, `weekday` nunca armazenado; `set_holiday` grava `accounts.UserHoliday` por presença); AC2 (`resolve_day_type` precedência `holiday > weekend > weekday` sem acumular; `seed_habit_day` congela `day_type`+`multiplier_at_time` por linha, dia pulado usa a config daquele dia; completude `Σ(contrib×peso_efetivo)/Σ(peso_efetivo)` com `peso_efetivo = weight_at_time × multiplier_at_time`); AC3 (config prospectiva não sangra dias congelados; `set_holiday` recalcula **só** o dia D — `save(update_fields=["day_type","multiplier_at_time"])`, `value`/`weight_at_time`/`habit_versions` intactos; override avulso de `multiplier_at_time` só naquela linha). Regra de porta **KEPT** (`core→accounts` e `habits→accounts` permitidos, import tardio de `UserHoliday`; `core` sem importar app de domínio). Migrations **aditivas** (accounts/0002 CreateModel; habits/0003 AddField×2 + CreateModel); schema aditivo (só a description de `HabitDay` reescrita p/ incluir `dayType`); `DayTypeEnum` pinado, `TypeEnum`/`HabitTypeEnum` intactos. Testes reais e completos: 19 de serviço + 5 de `resolve_day_type` (core) + 8 de view (incl. cross-tenant 404, PUT vazio 400) + frontend + E2E. Colisão de enum evitada por design (config usa chaves `weekend`/`holiday`, não um enum `day_type`).

### Review Follow-ups (AI) — LOW/nit, não bloqueantes

- [ ] [AI-Review][LOW] `seed_habit_day` e `set_holiday` chamam `multiplier_for` por linha → N+1 (mesma classe dos follow-ups de 6.1/6.2). Aceitável na escala atual; reavaliar com a leitura por-range da 6.4. [backend/habits/services.py:258, 372]
- [ ] [AI-Review][LOW] `set_holiday` re-deriva `multiplier_at_time` de TODAS as linhas do dia a partir da config — um override avulso anterior daquele dia é sobrescrito. Documentado como comportamento esperado (togglar feriado reconstrói o ritmo do dia); confirmar que é a semântica desejada. [backend/habits/services.py:351]
