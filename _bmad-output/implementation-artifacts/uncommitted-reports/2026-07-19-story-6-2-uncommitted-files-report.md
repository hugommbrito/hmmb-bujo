# Explicação dos arquivos não commitados - Story 6.2 (Tracker diário com snapshot imutável e completude ponderada)

> Escopo: apenas os arquivos da Story 6.2 do Épico 6 (Sistema de Hábitos) — código,
> artefatos de story relevantes e E2E. Baseline de comparação para arquivos
> modificados: commit `647014b` (commit da Story 6.1). Resíduos de outros escopos
> (`_bmad-output/planning-artifacts/`, `_bmad-output/specs/`, logs do
> story-automator, `learnings.md`, `orchestration-*`, `sprint-status.yaml`,
> `tests/test-summary.md` e o próprio `6-2-*.md`) foram deliberadamente excluídos.

## Visão geral

A Story 6.2 entrega a **camada de "realizado" do Sistema de Hábitos** sobre a
fundação de config da 6.1 (AD-06). Enquanto a 6.1 modelou *o que se pretende*
(`HabitVersion`, versionamento prospectivo), a 6.2 modela *o que aconteceu no dia*:

- **Backend** — novo model `HabitDayEntry` (snapshot congelado, uma linha por
  hábito ativo por dia) + migration `0002`; três serviços novos (`seed_habit_day`,
  `compute_day_completeness`, `update_habit_day_entry`); campo de identidade `unit`
  no `Habit`; serializers de leitura/escrita do tracker; duas views/rotas
  (`GET /api/habits/days/` e `PATCH /api/habits/days/{id}/`); admin.
- **Contrato gerado** — `schema.yaml` e `frontend/src/api/types.gen.ts` regerados de
  forma **puramente aditiva** (novos paths, schemas `HabitDay`/`HabitDayEntry`/
  `HabitDayGroup`/`PatchedHabitDayEntryUpdate`, campo `unit`).
- **Frontend** — data-layer TanStack Query (`useHabitDayQuery`,
  `useMarkHabitEntryMutation` otimista), componente `HabitTracker`, página `/habits`,
  campo `unit` no `HabitsManager`, e o acoplamento do tracker ao Daily Log (fluxo da
  manhã).
- **Testes** — unidade backend (model/serviço/serializer/view), unidade/componente
  frontend (hooks + `HabitTracker`), E2E ponta-a-ponta, e ajuste de mocks nos testes
  compartilhados que passaram a carregar `features/habits`.

Conceito arquitetural central: **AD-06 item 6 — imutabilidade do realizado**. Mudar
config = INSERT de `HabitVersion` (prospectivo, não sangra em dias passados). Corrigir
um dia = UPDATE **só naquela linha** de `habit_day_entries` (avulso, não toca
`habit_versions`). O snapshot é materializado por gap-fill idempotente na 1ª abertura
do dia e nunca sobrescrito. A completude é ponderada: `Σ(contribuição × peso) / Σ(peso)`.

## Ordem lógica de funcionamento

1. Camada de dados — model `HabitDayEntry` + campo `unit` + migration.
2. Camada de serviço — `seed_habit_day`, `compute_day_completeness`, `update_habit_day_entry`.
3. Serializers (leitura do tracker + escrita da correção avulsa).
4. Views + URLs (superfície de API).
5. Admin de operador.
6. Contrato gerado (OpenAPI + tipos TS).
7. Frontend data-layer (keys, types, hooks de API, barrel).
8. Frontend UI (`HabitTracker`, `HabitsManager`, página `/habits`, rota).
9. Acoplamento ao Daily Log (`useDailyData`, `DailyPage`).
10. Testes, na ordem da camada que validam.
11. Ajuste dos testes compartilhados.

---

## 1. Camada de dados — model e migration

### `backend/habits/models.py`

**Função geral do arquivo**

Define os models do app `habits`. Já continha `HabitGroup`, `Habit` e `HabitVersion`
(da 6.1). Todos herdam `TenantModel` (UUID PK + `user_id` denormalizado + auto-scope
por tenant).

**Função geral da alteração**

Adiciona (a) o campo de identidade `unit` ao `Habit` e (b) o novo model
`HabitDayEntry`, que é a materialização por-dia do estado realizado de cada hábito.

**Blocos principais**

- Linhas 47-53 (`Habit`): novo campo `unit = models.CharField(max_length=32, blank=True)`.
  É identidade cosmética (não versionada, como `name`/`emoticon`); só hábitos numéricos
  a usam na prática, mas mora em `Habit` por ser identidade, não estado do dia.
- Linhas 95-139 (`HabitDayEntry`): o snapshot congelado e editável por dia. Docstring
  documenta a decisão AD-06 (uma linha por hábito ativo por dia, semeada na 1ª abertura;
  `value` nulo = não-feito; booleano marcado = `1`), a reconciliação da PK (a AD-06
  desenha PK composta `(user_id, habit_id, date)`, mas o projeto exige UUID PK +
  `user_id` indexado, então a unicidade vira `UniqueConstraint(habit, date)`), e o
  gancho de futuro para a 6.3 (`day_type` + `multiplier_at_time`).

**Funções, classes e importações específicas**

- `HabitDayEntry.habit`: FK para `Habit`, `on_delete=CASCADE`, `related_name="day_entries"`.
- `HabitDayEntry.date`: `DateField` do dia do snapshot.
- `HabitDayEntry.value`: `DecimalField(max_digits=10, decimal_places=2, null=True)` — nulo
  = não-feito; booleano marcado = `1`; numérico = valor registrado.
- `HabitDayEntry.weight_at_time`: `DecimalField(max_digits=6, decimal_places=2)` — peso
  **congelado** da versão vigente naquele dia. Isolado propositalmente para a 6.3
  multiplicar por `multiplier_at_time` sem reescrever a fórmula.
- `HabitDayEntry.meta_at_time` / `bonus_at_time`: congelados da versão; nulos para
  booleanos (só numéricos usam).
- `Meta`: `db_table="habit_day_entries"`, `ordering=["date", "habit"]`,
  `UniqueConstraint(fields=["habit", "date"], name="uniq_habit_day_entry_per_day")`.

**Comportamento de libs usadas**

- `models.ForeignKey(on_delete=CASCADE)`: apagar o `Habit` apaga suas linhas de dia.
- `models.UniqueConstraint`: garante no banco uma única linha por `(habit, date)` — base
  da idempotência do seed (segunda passada não duplica).

### `backend/habits/migrations/0002_habit_day_entry.py` (novo)

**Função geral do arquivo**

Migration que aplica ao schema do banco as mudanças de `models.py`. Gerada pelo Django
(`makemigrations`), depende de `habits.0001_initial`.

**Função geral da alteração**

Arquivo novo (não é diff). Duas operações: adiciona a coluna `unit` em `habits` e cria a
tabela `habit_day_entries`.

**Blocos principais**

- Linhas 15-19: `AddField` de `Habit.unit` (`CharField`, `blank=True`, `max_length=32`).
- Linhas 20-38: `CreateModel HabitDayEntry` — colunas `id` (UUID PK), `user_id`
  (`UUIDField(db_index=True)`, herdado de `TenantModel`), `date`, `value`,
  `weight_at_time`, `meta_at_time`, `bonus_at_time`, `created_at`, FK `habit`
  (`CASCADE`); `db_table="habit_day_entries"`; `UniqueConstraint(habit, date)`.

**Comportamento de libs usadas**

- `migrations.AddField` / `migrations.CreateModel`: descrição declarativa aplicada pelo
  executor de migrations do Django; a `UniqueConstraint` vira um índice único no banco.

---

## 2. Camada de serviço (regras AD-06 do realizado)

### `backend/habits/services.py`

**Função geral do arquivo**

Camada de serviço do app `habits`: toda regra de negócio e escrita passa por aqui
(kwargs keyword-only; `@transaction.atomic` nas escritas; scoping implícito por tenant).

**Função geral da alteração**

Adiciona `unit` ao fluxo de create/identity da 6.1 e introduz a **camada de snapshot
realizado da 6.2**: seed idempotente do dia, cálculo de completude ponderada e edição
avulsa de linha.

**Blocos principais**

- Linhas 11-23: novos imports (`Decimal`, `ROUND_HALF_UP`), `HabitDayEntry` no import de
  models; `_IDENTITY_FIELDS` ganha `"unit"`; sentinela `_UNSET = object()` para
  distinguir "value não enviado" de "value enviado como None (desmarcar)".
- Linhas 65-85 (`create_habit`): novo parâmetro `unit=""` — identidade cosmética, **não**
  forçada a vazio para booleanos (o form já a esconde); persistida no `Habit`.
- Linhas 156-192 (`seed_habit_day`): materialização idempotente por gap-fill.
- Linhas 195-215 (`_contribution`): contribuição de uma linha em [0, 1].
- Linhas 218-232 (`_completeness_pct`): % ponderada inteira.
- Linhas 235-270 (`compute_day_completeness`): total + por grupo.
- Linhas 273-296 (`update_habit_day_entry`): UPDATE só naquela linha.

**Funções, classes e importações específicas**

- `seed_habit_day(*, user, date) -> None`: coleta os `habit_id` que já têm linha em `date`;
  para cada `Habit`, resolve `current_version_of(habit, date)` e, se a versão existe **e**
  está `active` **e** o hábito ainda não tem linha, cria a linha com `value=None` e
  `weight_at_time`/`meta_at_time`/`bonus_at_time` daquela versão. **Nunca** sobrescreve
  linhas existentes (preserva `value` editado e correções avulsas). Efeitos corretos por
  construção: dias passados imunes a hábitos criados depois; reativação só conta a partir
  dela; dia pulado usa a versão vigente **naquele dia**.
- `_contribution(entry) -> Decimal`: booleano → `1` se `value == 1`, senão `0`; numérico →
  `0` se sem `value` ou sem `meta` (>0); `1` ao atingir/passar a meta (salto discreto, ganha
  o bonus); senão proporcional `(value/meta) × (1 − bonus/100)`. `bonus` nulo = 0.
- `_completeness_pct(entries) -> int`: `Σ(contrib × w) / Σ(w) × 100`, arredondado a inteiro;
  guarda `Σw == 0 → 0` (nunca divide por zero). O peso do não-feito conta no denominador.
- `compute_day_completeness(*, user, date) -> dict`: lê as linhas de `habit_day_entries` do
  dia (fonte única, sem fallback para versão), agrupa por grupo, preserva a ordem canônica
  de `HabitGroup` (`display_order`, `name`) e retorna `{"total": int, "groups": [...]}`.
- `update_habit_day_entry(*, user, entry_id, value=_UNSET, weight_at_time=None, ...)`:
  UPDATE só naquela linha; usa `_UNSET` para desmarcar (`value=None`) vs. não-enviar;
  `save(update_fields=updated)` só grava os campos realmente mexidos; identidade
  (`habit`/`date`) é imutável e barrada no serializer, não aqui.

**Comportamento de libs usadas**

- `Decimal` / `Decimal.quantize(Decimal("1"), rounding=ROUND_HALF_UP)`: aritmética exata de
  ponto fixo; o `quantize` arredonda para inteiro com "metade para cima" (evita erro de
  ponto flutuante no percentual).
- `Habit.objects.select_related("group"/"habit__group")`: pré-carrega FKs numa única query,
  evitando N+1 ao percorrer as linhas do dia.
- `@transaction.atomic`: seed e update ocorrem numa transação (consistência).
- `.values_list("habit_id", flat=True)`: retorna os IDs já existentes como lista plana,
  formando o `set` que torna o seed idempotente.

---

## 3. Serializers

### `backend/habits/serializers.py`

**Função geral do arquivo**

Serializers DRF do app `habits`: validam **forma** de entrada e formatam saída. Regra de
negócio fica na camada de serviço.

**Função geral da alteração**

Expõe `unit` nos serializers da 6.1 e adiciona os serializers do tracker: leitura do dia
(payload aninhado) e escrita da correção avulsa (PATCH com campos imutáveis barrados).

**Blocos principais**

- Linhas 55-93: `unit` acrescentado a `HabitSerializer.Meta.fields`, `HabitCreateSerializer`
  (`required=False`, `default=""`) e `HabitUpdateSerializer` (`required=False`).
- Linhas 121-142 (`HabitDayEntrySerializer`): `ModelSerializer` de leitura de uma linha.
  Achata a identidade do hábito (`habit_id`, `name`, `emoticon`, `unit`, `type`, `group`)
  via `source="habit.…"` (todos `read_only`) junto do estado do dia (`value`, `*_at_time`).
  `type` reusa `Habit.Type.choices` via `ChoiceField` com `source="habit.type"`.
- Linhas 145-150 (`HabitDayGroupSerializer`): `Serializer` simples do cabeçalho de grupo
  (`id`, `name`, `completion` inteiro).
- Linhas 153-160 (`HabitDaySerializer`): `Serializer` do payload completo — `date`,
  `total_completion` (int), `groups` (many), `entries` (many).
- Linhas 163-193 (`HabitDayEntryUpdateSerializer`): PATCH da linha. `value` `allow_null`
  (desmarcar); `weight_at_time`/`meta_at_time`/`bonus_at_time` opcionais (correção de dia
  passado). `_IMMUTABLE = ("habit", "habit_id", "date")` + `validate()` que inspeciona
  `self.initial_data` e rejeita (400) se algum campo imutável foi enviado.

**Funções, classes e importações específicas**

- `serializers.ChoiceField(choices=Habit.Type.choices, source="habit.type", read_only=True)`:
  reusa o enum de tipo (mesmo override do drf-spectacular da 6.1) na leitura.
- `HabitDayEntryUpdateSerializer.validate(self, attrs)`: cruza `self.initial_data` (dados
  crus recebidos) com `_IMMUTABLE`; se houver interseção, levanta `ValidationError` no
  campo ofensor — é o que garante o AC de identidade imutável do snapshot.

**Comportamento de libs usadas**

- `serializers.ModelSerializer`: infere campos do model; aqui os `source="habit.…"`
  puxam atributos do FK relacionado (achatamento na resposta).
- `serializers.DecimalField(..., allow_null=True)`: aceita `null` explícito no corpo
  (necessário para desmarcar um booleano enviando `value: null`).

---

## 4. Views e URLs

### `backend/habits/views.py`

**Função geral do arquivo**

Views "finas" da API de hábitos: validam entrada → chamam o serviço → serializam a saída.

**Função geral da alteração**

Adiciona as duas views do tracker: `HabitDayView` (GET do dia, materializa + calcula) e
`HabitDayEntryDetailView` (PATCH da linha).

**Blocos principais**

- Linhas 1-40: imports novos — `date as date_cls`, `NotFound`, `today_for`,
  `HabitDayEntry`, os três serializers do tracker e os serviços `seed_habit_day`,
  `compute_day_completeness`, `update_habit_day_entry`.
- Linhas 132-176 (`HabitDayView.get`): lê `?date=` (parseia `date.fromisoformat`, 400 se
  inválida) ou usa `today_for(request.user)`; chama `seed_habit_day` (materializa),
  `compute_day_completeness` (total + grupos), busca as `entries` do dia com
  `select_related`, monta o payload `{date, total_completion, groups, entries}` e serializa
  com `HabitDaySerializer`. `@extend_schema` documenta o param `date` e a resposta.
- Linhas 179-191 (`HabitDayEntryDetailView.patch`): valida o corpo com
  `HabitDayEntryUpdateSerializer(raise_exception=True)`, chama `update_habit_day_entry`
  (repassando `**validated_data`), converte `HabitDayEntry.DoesNotExist` em `NotFound`
  (404 — cobre também acesso cross-tenant) e devolve a linha via `HabitDayEntrySerializer`.

**Comportamento de libs usadas**

- `date.fromisoformat(raw)`: parseia `YYYY-MM-DD`; levanta `ValueError` em data inválida,
  convertido em `ValidationError` (400) com `from None` para suprimir o encadeamento.
- `drf_spectacular.utils.extend_schema` / `OpenApiParameter`: alimentam o OpenAPI gerado
  (é a origem dos paths novos em `schema.yaml`).
- `rest_framework.exceptions.NotFound`: retorna 404 padrão.

### `backend/habits/urls.py`

**Função geral do arquivo**

Roteamento sob `api/habits/`.

**Função geral da alteração**

Registra as rotas do tracker antes das rotas de detalhe por UUID.

**Blocos principais**

- Linhas 3-8: importa `HabitDayView` e `HabitDayEntryDetailView`.
- Linhas 12-17: `days/` → `HabitDayView` (name `habit-day`); `days/<uuid:pk>/` →
  `HabitDayEntryDetailView` (name `habit-day-entry-detail`). Comentário nota que a rota
  estática `days/` fica no topo por clareza (o conversor `uuid` não casaria "days" mesmo).

---

## 5. Admin

### `backend/habits/admin.py`

**Função geral do arquivo**

Registro dos models no Django Admin para inspeção de operador.

**Função geral da alteração**

Registra `HabitDayEntry` no admin.

**Blocos principais**

- Linha 5: `HabitDayEntry` no import.
- Linhas 37-44 (`HabitDayEntryAdmin`): `list_display` (`id`, `user_id`, `habit_id`, `date`,
  `value`, `weight_at_time`), `list_filter=("date",)`, `search_fields`, e
  `get_queryset` usando `HabitDayEntry.all_objects.all()` para ver todos os tenants
  (bypass do scope automático, como os demais admins do app).

---

## 6. Contrato gerado (OpenAPI + tipos TS)

### `schema.yaml`

**Função geral do arquivo**

Contrato OpenAPI gerado pelo drf-spectacular; fonte de verdade do client tipado do
frontend.

**Função geral da alteração**

Regeneração **puramente aditiva** (190 linhas adicionadas, 0 removidas). Não inspecionar
linha a linha (é gerado); resumo por grupos:

- **Paths novos**: `GET /api/habits/days/` (`operationId habits_days_retrieve`, param opcional
  `date`, resposta `HabitDay`); `PATCH /api/habits/days/{id}/`
  (`operationId habits_days_partial_update`, corpo `PatchedHabitDayEntryUpdate`, resposta
  `HabitDayEntry`).
- **Schemas novos**: `HabitDay` (`date`, `totalCompletion`, `groups[]`, `entries[]`);
  `HabitDayEntry` (identidade achatada `habitId`/`name`/`emoticon`/`type`/`group`/`unit` +
  `value`/`weightAtTime`/`metaAtTime`/`bonusAtTime`); `HabitDayGroup` (`id`, `name`,
  `completion`); `PatchedHabitDayEntryUpdate` (`value`/`weightAtTime`/`metaAtTime`/
  `bonusAtTime`, todos opcionais).
- **Schemas alterados (aditivo)**: `unit` acrescentado a `Habit` e `HabitCreate`.

Observação: os campos saem em **camelCase** no contrato (`totalCompletion`, `weightAtTime`)
por causa da camelização do renderer JSON, embora `response.data` em Python seja snake_case.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo**

Tipos TypeScript gerados a partir de `schema.yaml` (openapi-typescript). Consumidos via
`components["schemas"][...]`.

**Função geral da alteração**

Regeneração aditiva (149 linhas). Adiciona os paths `"/api/habits/days/"` e
`"/api/habits/days/{id}/"`, os schemas `HabitDay`/`HabitDayEntry`/`HabitDayGroup`/
`PatchedHabitDayEntryUpdate`, as operations `habits_days_retrieve`/
`habits_days_partial_update`, e o campo `unit` em `Habit`/`HabitCreate`. É o que dá tipo
aos types de feature (`features/habits/types.ts`).

---

## 7. Frontend data-layer

### `frontend/src/api/keys.ts`

**Função geral do arquivo**

Fábrica central de query keys do TanStack Query.

**Função geral da alteração**

- Linha 37: `day: (date?: string) => ['habits', 'day', date ?? 'today'] as const` — chave do
  tracker por data (`'today'` quando sem data). É o eixo de cache/invalidação do dia,
  usada tanto no query quanto na mutação otimista.

### `frontend/src/features/habits/types.ts`

**Função geral do arquivo**

Re-exporta os tipos gerados do domínio hábitos com nomes de domínio.

**Função geral da alteração**

- Linhas 7-10: `HabitDay`, `HabitDayEntry`, `HabitDayGroup` mapeados de
  `components["schemas"][...]`.

### `frontend/src/features/habits/api.ts`

**Função geral do arquivo**

Data-layer TanStack Query do domínio hábitos (queries + mutations).

**Função geral da alteração**

Adiciona a query do tracker do dia e a mutação **otimista** de marcação, além de `unit`
nas variáveis de create/update da 6.1.

**Blocos principais**

- Linhas 1-16: importa `useOptimisticMutation` (hook compartilhado) e os tipos `HabitDay`/
  `HabitDayEntry`.
- Linhas 40-55 (`fetchHabitDay`/`useHabitDayQuery`): GET `/api/habits/days/` com
  `params: { date }` só quando `date` é informada; `queryKey: keys.habits.day(date)`.
- Linhas 60-90: `unit?` adicionado a `CreateHabitVariables` e
  `UpdateHabitIdentityVariables`.
- Linhas 149-180 (`markHabitEntry`/`useMarkHabitEntryMutation`): PATCH
  `/api/habits/days/${entryId}/` com `{ value }`; mutação otimista via
  `useOptimisticMutation` — o `updater` mapeia `entries` e troca o `value` da linha
  correspondente **antes** da resposta do servidor; `totalCompletion`/
  `groups[].completion` são recalculados pelo backend e reconciliam no `onSettled`
  (invalidate → refetch). Espelha `useTransitionTaskMutation` do bujo.

**Comportamento de libs usadas**

- `useOptimisticMutation<TData, TError, TVars, TSnapshot>`: hook compartilhado que aplica o
  `updater` ao cache de `queryKey` no `onMutate`, faz rollback no `onError` e invalida no
  `onSettled`. Aqui `TSnapshot = HabitDay`.
- `useQuery` / `client.get`: busca padrão; `params` só quando há `date` (mantém a URL limpa
  para "hoje").

### `frontend/src/features/habits/index.ts`

**Função geral do arquivo**

Barrel público da feature (o resto do app importa daqui, não de arquivos internos).

**Função geral da alteração**

- Linhas 8-9: exporta `useHabitDayQuery` e `useMarkHabitEntryMutation`.
- Linha 12: exporta o componente `HabitTracker`.
- Linhas 13-21: exporta os tipos `HabitDay`, `HabitDayEntry`, `HabitDayGroup`.

---

## 8. Frontend UI

### `frontend/src/features/habits/components/HabitTracker.tsx` (novo)

**Função geral do arquivo**

Componente central do tracker do dia: renderiza o payload de `useHabitDayQuery`, agrupado
por grupo, com o percentual total no topo, e trata marcação otimista por linha.

**Função geral da alteração**

Arquivo novo. Recebe `date?` opcional (default = hoje) e é reutilizado no Daily Log e na
página `/habits`.

**Blocos principais**

- Linhas 12-34: `SAVE_ERROR` (string exata da AC2, verificada em teste), `numberFormat`
  (`Intl.NumberFormat('pt-BR')`), helpers `formatNumber`, `metaPercent` ("% da meta" cru no
  cliente) e `isChecked` (booleano marcado = `value == 1`).
- Linhas 42-65 (`BooleanRow`): `Checkbox` com `minHeight: 44` (alvo de toque); `onChange`
  chama `onMark(checked ? null : '1')` (toggle marcar/desmarcar); label com emoticon+nome;
  erro inline com `role="alert"`.
- Linhas 73-121 (`NumericRow`): estado local `draft`, `TextField type="number"`; calcula
  `percent` e `reached` (`value >= meta`); `commit()` no `onBlur`/Enter só dispara `onMark`
  se o valor mudou; legenda "Meta atingida" ou `"X / meta unit (Y%)"`.
- Linhas 128-136 (`HabitEntryRow`): instancia `useMarkHabitEntryMutation(date)` por linha e
  despacha para `NumericRow`/`BooleanRow` conforme `entry.type`; propaga `mark.isError`.
- Linhas 144-157 (`GroupSection`): filtra `entries` por `group.id`, esconde grupo vazio,
  renderiza cabeçalho `"{group.name} · {group.completion}%"` (`<h3>`).
- Linhas 163-205 (`HabitTracker`): estados `isPending` ("Carregando hábitos…", `role=status`),
  `isError`/sem dado (`role=alert`), cabeçalho `<h2>` "Hábitos" + "Completude do dia: N%",
  empty state honesto ("Nenhum hábito ativo hoje."), e a lista de grupos.

**Comportamento de libs usadas**

- `Intl.NumberFormat('pt-BR').format(n)`: formata milhar com separador pt-BR (`2.500`).
- MUI `Checkbox`/`FormControlLabel`/`TextField`/`Typography`/`Box`: primitivas de UI;
  `minHeight: 44` atende alvo de toque; `role="alert"`/`role="status"` para acessibilidade.

### `frontend/src/features/habits/components/HabitsManager.tsx`

**Função geral do arquivo**

UI de **configuração** de hábitos (Story 6.1): cria hábito/grupo e edita config
(prospectiva via nova versão) e identidade.

**Função geral da alteração**

Acrescenta o campo `unit` (identidade não versionada) tanto na linha de edição quanto no
formulário de criação — só para hábitos numéricos.

**Blocos principais**

- Linhas 21-24: importa `useUpdateHabitIdentityMutation`.
- Linhas 43-72 (`HabitRow`): estado `unit`; no `handleSave`, além da nova versão (peso/meta/
  bonus), se numérico e `unit` mudou, dispara `updateIdentity.mutate({ habitId, unit })` —
  unidade é identidade, UPDATE direto, mutação separada da versão.
- Linhas 121-134: `TextField` "Unidade" na linha de edição (numéricos).
- Linhas 199-247 e 372-385: estado `unit` do formulário de criação, incluído no payload
  quando `type === 'numeric'`, resetado no `onSuccess`, e `TextField` "Unidade"
  (placeholder "passos, min…").

### `frontend/src/pages/habits/HabitsPage.tsx` (novo)

**Função geral do arquivo**

Página da superfície dedicada `/habits`.

**Função geral da alteração**

Arquivo novo. Renderiza `<HabitTracker />` (tracker de HOJE) dentro de um `<main
aria-label="Hábitos">`. Comentário nota que histórico por data é a Story 6.4.

### `frontend/src/app/router.tsx`

**Função geral do arquivo**

Definição de rotas da app (React Router).

**Função geral da alteração**

- Linha 16: importa `HabitsPage`.
- Linha 88: a rota `habits` deixa de ser `PlaceholderPage` e passa a renderizar `<HabitsPage />`.

---

## 9. Acoplamento ao Daily Log (fluxo da manhã)

### `frontend/src/pages/daily/useDailyData.ts`

**Função geral do arquivo**

Hook de composição de dados da página diária (ponto de prefetch paralelo dos domínios do
dia, §7.3).

**Função geral da alteração**

- Linhas 1-12: passa a compor também `habits` — chama `useHabitDayQuery(logDate)` ao lado de
  `useTodayLogQuery(logDate)` e retorna `{ todayLog, habitDay }`. Comentário atualizado:
  bujo + habits prontos; medications/gratitude entram nos Épicos 8/9.

### `frontend/src/pages/daily/DailyPage.tsx`

**Função geral do arquivo**

Página do Daily Log (fluxo da manhã).

**Função geral da alteração**

- Linha 19: importa `HabitTracker`.
- Linhas 91-96: renderiza `<HabitTracker />` no bloco do "today view" (após os banners de
  review/catch-up). Comentário: só no today view — navegar dias passados de hábitos é 6.4.

---

## 10. Testes

### `backend/habits/tests/factories.py`

**Função geral do arquivo**

Factories `factory_boy` do app + registro de casos de isolamento multi-tenant.

**Função geral da alteração**

- Linhas 59-73 (`HabitDayEntryFactory`): factory da nova linha; `Params.user` (SubFactory),
  `user_id` via `SelfAttribute`, `habit` via `LazyAttribute` amarrando ao mesmo user, `date`
  por `Sequence` com datas fixas + `timedelta` (guardrail AST proíbe `date.today()` neste
  arquivo), `value=None`, `weight_at_time=Decimal("1.00")`.
- Linhas 101-113: `register_isolation_case(id="habits.HabitDayEntry", ...)` para a suíte
  genérica de isolamento por tenant.

### `backend/habits/tests/test_models.py`

**Função geral da alteração**

Adiciona (linhas 60-78) os testes de constraint do model: `test_unique_day_entry_per_habit_and_day`
(2ª linha `(habit, date)` → `IntegrityError`) e `test_two_day_entries_different_days_allowed`
(dias distintos coexistem). Usa `tenant_context` + `transaction.atomic()` para capturar a
violação sem quebrar a transação de teste.

### `backend/habits/tests/test_serializers.py`

**Função geral da alteração**

Testes do `HabitDayEntryUpdateSerializer` (linhas 62-85): aceita `value=None` (desmarcar) e
corpo vazio; rejeita mutação de `date` e de `habit` (campos imutáveis → 400 com o campo no
`errors`).

### `backend/habits/tests/test_services.py`

**Função geral da alteração**

Bloco grande (linhas 222-468) cobrindo a lógica da 6.2. Constantes `_D1`/`_D2` (datas fixas
no passado). Grupos de teste:

- **`seed_habit_day`**: uma linha por hábito ativo com `value` nulo e `*_at_time` da versão
  de D; idempotência preservando `value` editado; dia pulado usa a versão vigente naquele
  dia; exclui inativos; exclui hábito criado depois do dia.
- **`compute_day_completeness`**: booleano feito/não-feito → 50%; numérico parcial com bonus
  → 40%; meta atingida → 100%; **exemplo âncora** ponderado `(1×1 + 0.4×2)/3 = 60%`; % por
  grupo; dia vazio → 0 sem grupos; peso zero não divide por zero.
- **`update_habit_day_entry`**: UPDATE de `value`/`weight_at_time` altera **só aquela linha**
  (dias vizinhos e `habit_versions` intactos — "não sangra"); desmarcar para `None`.

### `backend/habits/tests/test_views.py`

**Função geral da alteração**

Bloco (linhas 160-279) de testes de API do tracker:
`test_get_day_seeds_and_returns_tracker_payload` (GET default=hoje materializa idempotente,
payload snake_case, 2ª chamada não duplica); `test_get_day_weighted_completion` (âncora 60%
via HTTP); `test_get_day_invalid_date_returns_400`; `test_patch_entry_marks_value`;
`test_patch_entry_corrects_weight_at_time` (envio camelCase `weightAtTime` aceito);
`test_patch_entry_rejects_identity_mutation` (400 ao trocar `date`);
`test_patch_entry_other_tenant_returns_404` (isolamento). Nota nos testes: o parser aceita
camelCase e converte para snake_case; `response.data` é snake_case (a camelização é do
renderer JSON).

### `frontend/src/features/habits/api.test.tsx`

**Função geral da alteração**

Adiciona (linhas ~200-284) `describe`s para `useHabitDayQuery` (busca hoje sem params; passa
`date` como query param) e `useMarkHabitEntryMutation` (PATCH + invalidate no settled;
atualização otimista do `value` no cache antes da resposta; rollback do `value` em erro).
Usa fixtures `ENTRY`/`HABIT_DAY` e um `Promise` controlado (`resolvePatch`) para observar o
estado otimista intermediário.

### `frontend/src/features/habits/components/HabitTracker.test.tsx` (novo)

**Função geral do arquivo**

Testes de componente do `HabitTracker` com `@testing-library/react` + mock do `client`.

**Blocos principais**

- Linhas 20-60: fixtures `BOOLEAN_ENTRY`/`NUMERIC_ENTRY`, `makeDay`, `setDay`.
- Linhas 62-73 (`renderTracker`): monta `ThemeProvider` + `QueryClientProvider` (retry off).
- Linhas 75-128: casos — total no topo + cabeçalho de grupo com %; marcação otimista de
  booleano (PATCH `value:1`); numérico parcial `"2.500 / 5.000 passos (50%)"`; "Meta atingida"
  quando `value >= meta`; empty state; sem violações de acessibilidade (`jest-axe`).

### `frontend/e2e/seedHabits.ts` (novo)

**Função geral do arquivo**

Helper de seed E2E que cria hábitos direto pela camada de serviço do backend
(`create_habit_group`/`create_habit`, `effective_from = hoje`) via `manage.py shell -c`.

**Função geral da alteração**

Arquivo novo. `seedHabitAnchor(email)` cria o "exemplo âncora" da matemática de completude:
grupo "Saúde" + booleano "Meditar" (peso 1) + numérico "Passos" (peso 2, meta 5000, bonus
20%, unidade "passos"). Executa Python via `execFileSync('uv', ['run', 'python', ...])`,
lê só a última linha não-vazia do stdout (o `print(json.dumps(...))`, ignorando o banner do
shell) e retorna `{ groupName }`. Mesma técnica dos demais seeds E2E.

**Comportamento de libs usadas**

- `node:child_process.execFileSync`: roda o comando síncrono e captura stdout (`stdio: 'pipe'`);
  o `env` injeta `DJANGO_SETTINGS_MODULE`.
- `fileURLToPath(import.meta.url)`: resolve o diretório do módulo ESM para achar `../../backend`.

### `frontend/e2e/habit-tracker.spec.ts` (novo)

**Função geral do arquivo**

Suíte E2E (Playwright) da Story 6.2 contra o backend real, sem mocks de rede.

**Blocos principais**

- Linhas 20-34: usuário sem hábitos vê o empty state em `/today` e em `/habits` (mesmo
  estado, server state único).
- Linhas 36-116: fluxo completo — `seedHabitAnchor`, `page.reload()` materializa o snapshot
  (AC1); grupo com % ponderado (AC2); marcar booleano → 33%; registrar 2500 → "2.500 / 5.000
  passos (50%)" e completude 60% (âncora AC3); atingir meta → "Meta atingida" e 100%; a
  superfície `/habits` lê o mesmo snapshot (100%); desmarcar em `/habits` → 67% (edição
  avulsa recalcula só aquele dia); voltar a `/today` + reload mantém 67% (seed idempotente
  não sobrescreve). Coleta `consoleErrors` e assere lista vazia ao final.

**Comportamento de libs usadas**

- Playwright `page.getByRole/getByText/reload/check/uncheck/fill/blur`: dirige a UI real;
  `expect(...).toBeVisible/toBeChecked` esperam de forma assíncrona.

---

## 11. Ajuste dos testes compartilhados

Os testes de roteamento/layout passaram a importar (transitivamente) `features/habits` por
causa do `HabitTracker` no `DailyPage` e do `useHabitDayQuery` no `useDailyData`. Como esses
testes montam a árvore **sem** `QueryClientProvider`, foi necessário mockar a feature — mesmo
padrão já usado ali para `braindump` (ver nota de memória sobre Sidebar/BottomNav com Query).

### `frontend/src/app/router.test.tsx`

- Linhas 48-54: `vi.mock('../features/habits', ...)` retornando `useHabitDayQuery` inócuo
  (`{ isPending: false, data: undefined }`) e `HabitTracker: () => null`.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

- Linhas 47-53: mesmo `vi.mock('../../features/habits', ...)`.

### `frontend/src/pages/daily/DailyPage.test.tsx`

- Linhas 62-63: acrescenta `'/api/habits/days/'` ao `GET_DEFAULTS` (dia vazio:
  `{ date, totalCompletion: 0, groups: [], entries: [] }`), já que o `DailyPage` agora
  dispara o GET do tracker no fluxo da manhã. (Aqui o teste usa o `client` mockado de rede,
  então mocka o endpoint em vez do módulo inteiro.)

---

## Nota de encerramento

Relatório apenas descritivo. **Nenhum arquivo de código foi modificado** na produção deste
documento — todas as inspeções foram via `git diff 647014b -- <path>` e leitura de arquivos
novos. O único arquivo criado é este próprio relatório.
