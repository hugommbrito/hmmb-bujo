---
title: 'Story 16.2c: Dia "não registrado" por collection (Hábitos e Medicamentos)'
type: 'feature'
created: '2026-10-19'
status: 'done'
baseline_commit: '0d0f3476a606d1d99f06b2c2af953ae0fec3f9a9'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-16-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Um dia só fica fora das estatísticas de Hábitos se ninguém o abrir; abrir o dia (Daily legado, navegação para dia passado) semeia linhas com valor nulo e o dia passa a contar como 0% na grade, no gráfico e no detalhe — e quebraria sequências/médias na 16.2b. Em Medicamentos, o mesmo gesto transforma um dia não registrado em "Dose perdida", sinal clínico falso. Não existe hoje forma de dizer "não registrei este dia".

**Approach:** Flag por `(usuário, data, collection)` em `accounts.UntrackedDay` (presença = fora das estatísticas; molde de `user_holidays`), escrita por endpoint próprio de cada módulo, dia a dia. O servidor trata o dia marcado exatamente como dia sem linha (completude nula, fora de todo denominador, ponto omitido na série) sem apagar nada; a UI escreve "Não registrado" no lugar da porcentagem (Hábitos) e de "Dose perdida" (Medicamentos), com um checkbox rotulado ao lado do controle de feriado (aba Hoje) e no Histórico de Medicamentos.

## Boundaries & Constraints

**Always:** `today_for(user)` como única fonte de "hoje"; isolamento via `TenantModel` + `register_isolation_case`; `habits`/`medications` → `accounts` (porta já usada por `UserHoliday`); linhas de domínio (`habit_day_entries`, `medication_day_entries`) intocadas por marcar/desmarcar; dia marcado continua editável e **nunca** desmarca sozinho; a interface não calcula completude nem agregado — `null` vem do servidor; estado textual (nunca só cor), sem barra em 0, readonly nunca parece disabled; tokens `--ds-*` na pasta `record/` (guard `noLiteralTokens.test.ts`); `schema.yaml` + `types.gen.ts` regenerados e commitados; migration reversível; pt-BR em toda cópia; sem `ruff format`.

**Never:** intervalo/bulk de datas; flag global (sempre por collection); collection `health` (sem estatística a excluir); apagar ou re-semear linhas; alterar `compute_day_completeness`, `seed_*`, `_derive_block_status`, `deriveBlockStatus` ou a fórmula de `gridCell`; novo enum no wire (`collection` fica fora do payload); toggle nas superfícies legadas (`HabitTracker`, `HabitHistory`) — só guarda de `null`; mudar `GET /api/summary/today` (vira DW); celebração/cor por número; `git add -A`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Marcar dia passado | `POST /api/habits/untracked-days/ {date: D≤hoje, untracked: true}` | 200 `{date, untracked: true}`; 1 linha `(user, D, habits)`; entries de D intactas | N/A |
| Idempotência | marcar 2×; desmarcar sem linha | 200 nas duas; 1 linha / 0 linhas; sem erro | N/A |
| Data futura | `date > today_for(user)` | 400 `{"date": "Não é possível marcar um dia futuro como não registrado."}` | `DomainError` → `ValidationError({"date"})` na view |
| Body inválido | `date` ausente/inválida, `untracked` ausente | 400 do serializer | padrão DRF |
| Dia marcado (Hoje) | `GET /api/habits/days/?date=D` | semeia como antes; `untracked: true`, `totalCompletion: null`, `groups[].completion: null`, `entries` presentes e PATCH-áveis | N/A |
| Dia marcado (histórico) | `GET /api/habits/history/` com D no range | dia D: `untracked: true`, `totalCompletion: null`, `groups: []`, `entries: []`; vizinhos intactos; hábito que só aparece em D sai de `habits` | N/A |
| Dia marcado (série) | `GET /api/habits/{id}/series/` | ponto de D omitido; `dayTypes` ainda cobre D | N/A |
| Desmarcar | `{untracked: false}` em dia com valores | linha-flag removida; `GET days` volta ao % real sem recálculo | N/A |
| Medicamentos marcado | `GET /api/medications/days/?date=D` | `untracked: true`; blocos/linhas inalterados; UI: linha `scheduled` sem confirmação lê "Não registrado" (não "Dose perdida"); bloco `pending` lê "Não registrado" (não "Doses perdidas"); `partial`/`confirmed` mantêm rótulo | N/A |
| Por collection / tenant | flag `habits` em D; outro usuário marca D | `GET /api/medications/days/?date=D` → `untracked: false`; flag alheia invisível | N/A |
| Hoje marcado | `date = today_for(user)` | permitido; `GET /api/summary/today` segue numérico (DW) | N/A |
| UI Hoje marcado | payload com `untracked: true` | slot `habits-day-percent` = "Não registrado", sem `CompletionBar`; chip "Dia não registrado — fora das estatísticas"; nota no lugar do denominador; cards de grupo "Não registrado" sem barra; checkbox marcado; linhas editáveis | erro de escrita → `role="alert"` + retry |
| UI Histórico marcado | dia D no range | detalhe "Dia não registrado — fora das estatísticas." + nota; lista compacta "Não registrado"; célula semanal exclui D do denominador; gráfico com lacuna | N/A |
| Offline | `disabled` no painel | checkbox desabilitado com `aria-describedby` do motivo (igual feriado) | N/A |

</frozen-after-approval>

## Code Map

**Precedente a espelhar — feriado por data:** `backend/accounts/models.py:30-56` `UserHoliday` (TenantModel, `UniqueConstraint(user_id, date)`); `backend/accounts/migrations/0002_user_holiday.py`; `backend/accounts/admin.py:28-37` `UserHolidayAdmin` (`all_objects`); `backend/accounts/tests/factories.py:28-47` factory + `register_isolation_case` (módulo já em `backend/conftest.py:21`); `backend/habits/serializers.py:260-271` `SetHolidaySerializer`/`HolidayResultSerializer`; `backend/habits/services.py:371-396` `set_holiday` (get_or_create/delete); `backend/habits/views.py:287-300` `HabitHolidayView` (`patch = post`); `backend/habits/urls.py:20`.

**Backend Hábitos:** `services.py:235-276` `seed_habit_day` (não tocar); `:310-325` `_completeness_pct`, `:328-353` `_grouped_completeness`, `:356-368` `compute_day_completeness` (puro — **não tocar**; consumido por `backend/automation/services.py:103`); `:455-510` `get_habit_history_range` (uma query + `resolve_day_types_range`; lacuna em `:495-498`); `:563-610` `get_habit_series` (`points` em `:584-592`); `views.py:202-226` `HabitDayView.get` (semeia e monta payload); `:303-342` views de histórico/série; `serializers.py:170-176` `HabitDayGroupSerializer.completion`, `:178-187` `HabitDaySerializer.total_completion`, `:299-307` `HabitHistoryDaySerializer` (`total_completion allow_null` já existe). `DomainError`: `backend/core/exceptions.py` (service → 409 por padrão; view converte em 400 como `views.py:281-282`). `today_for`: `backend/core/calendar.py`.

**Backend Medicamentos:** `services.py:345-401` `seed_medication_day` (não tocar); `:404-417` `_derive_block_status`; `:439-478` `get_medication_day` (retorna `{date, blocks, ad_hoc}`); `views.py:291-308` `MedicationDayView`; `serializers.py:238-243` `MedicationDaySerializer`; `urls.py` (rotas `days/…` antes de `<uuid:pk>/`).

**Testes backend (moldes):** `habits/tests/test_views.py:363` (holiday), `:429-532` (history/series, inclui `test_get_history_does_not_seed`); `medications/tests/test_views.py:296` (`test_get_days_seeds_and_returns_read_model`); fixtures `user`/`other_user`/`auth_client` em `backend/conftest.py:36-66`; `tenant_context` de `core.tenant`; datas fixas + `timedelta` (guardrail proíbe `date.today()`).

**Contrato:** `cd backend && uv run python manage.py spectacular --file ../schema.yaml` → `cd frontend && npm run generate-types` (`frontend/package.json:12`); gate em `.github/workflows/ci.yml:174-187`. `camelize` ⇒ `untracked`, `totalCompletion`.

**Frontend Hábitos:** `src/features/habits/api.ts:283-305` `useSetHolidayMutation` (molde: `useOptimisticMutation` em `keys.habits.day(date)`); `src/shared/hooks/useOptimisticMutation.ts:8-40` (aceita `mutationOptions.onSuccess`; `onSettled` já invalida a `queryKey`); `src/api/keys.ts:59-72` (`habits.history`, `habits.series`); `src/features/habits/types.ts:8,19` (tipos de `components['schemas']`); `components/record/HabitsTodayPanel.tsx:49-55` constantes de cópia, `:134-138` destructuring/`isHoliday`/`writeError`, `:229-259` slot do % + `CompletionBar` + denominador, `:271-311` linha de controles (checkbox feriado), `:313-330` erro/retry; `record/HabitGroupCard.tsx:107-114` `% do grupo` + `CompletionBar`; `record/HabitsHistoryPanel.tsx:125-234` `DayDetail` (`hasRecord` em `:135`, cópia `NO_RECORD_DAY` em `:149-150`); `record/HabitCompletionGrid.tsx:167-194` lista compacta (`hasRecord`/`NO_RECORD_DAY` em `:169,191-193`), `:140-154` células via `gridCell` (sem mudança); `record/habitsSurface.ts:401-405` `GridCellInput` (comentar que dia marcado chega vazio); `components/HabitEvolutionChart.tsx:109-128` (sem mudança); legado `components/HabitTracker.tsx:222`, `components/HabitHistory.tsx:71` (`{totalCompletion}%` → guarda de null).

**Frontend Medicamentos:** `src/features/medications/api.ts` (`useMedicationDayQuery` ~`:296`; sem mutation de dia-flag ainda); `src/api/keys.ts:100` `medications.day`; `dayModel.ts:9,20-26` `EntryStatus`/`deriveEntryStatus(entry, isPast)`; `components/MedicationBlock.tsx:41-47` `ENTRY_STATUS`, `:49-74` `StatusIndicator` (relabel "Doses perdidas"), `:79` `EntryStatusIndicator`, `:232-270` `EntryRow` (indicador só se `isPast`), `:301-338` `MedicationBlock` props/encadeamento; `components/MedicationHistorySurface.tsx:47-52` estado/`isPast`, `:103-105` título da data, `:125-130` + `:135-167` `HistoryDay` (encadeia `isPast`); `components/MedicationDaySurface.tsx:161` (não tocar).

**Testes frontend (moldes):** `features/medications/components/MedicationBlock.test.tsx:66-77` (`renderSurface` + axe `:111`), `:268` `renderBlock(b, {isPast})`; `features/habits/components/record/glyphPrefetch.test.tsx:17-62` (mock de `api/client` + `renderWithQuery`); `record/noLiteralTokens.test.ts` (guard de tokens).

**Artefatos:** `_bmad-output/planning-artifacts/epics.md` (Story 16.2c já inserida após a 16.2b; ACs da 16.2b emendados); `_bmad-output/implementation-artifacts/sprint-status.yaml:205` (`16-2c-…`); `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md:398-433` (seção Hábitos) e `:465-490` (State Patterns); `_bmad-output/implementation-artifacts/deferred-work.md` (DW do summary).

## Tasks & Acceptance

**Execution:**
- [x] `backend/accounts/models.py` + `backend/accounts/migrations/0003_untracked_day.py` + `backend/accounts/admin.py` -- `UntrackedCollection` (TextChoices `habits`/`medications`) e `UntrackedDay(TenantModel)` {`date`, `collection`, `created_at`}, `db_table="user_untracked_days"`, `UniqueConstraint(user_id, date, collection)` + `CheckConstraint` em `collection`; admin com `all_objects` -- uma tabela só, importável pelos dois módulos.
- [x] `backend/accounts/services.py` (novo) + `backend/accounts/serializers.py` -- `is_untracked`, `untracked_dates` (1 query por range), `set_untracked_day` (`@transaction.atomic`, `date > today_for(user)` → `DomainError`, get_or_create/delete); `SetUntrackedDaySerializer`/`UntrackedDayResultSerializer` `{date, untracked}` -- regra e contrato únicos para os dois endpoints.
- [x] `backend/accounts/tests/factories.py` + `backend/accounts/tests/test_models.py` + `backend/accounts/tests/test_services.py` (novo) -- factory + `register_isolation_case("accounts.UntrackedDay")`; unicidade, check, idempotência, futuro, `untracked_dates` -- gate de isolamento e matriz.
- [x] `backend/habits/services.py` -- `get_day_completeness` (embrulha `compute_day_completeness`; marcado → `total=None`, `groups[].completion=None`, `untracked=True`); `get_habit_history_range` (dia marcado = lacuna + `untracked`; `habits_seen` ignora dias marcados); `get_habit_series` (omite pontos marcados) -- uma regra de exclusão para todo consumidor.
- [x] `backend/habits/serializers.py` + `backend/habits/views.py` + `backend/habits/urls.py` -- `completion`/`total_completion allow_null`, `untracked` em `HabitDaySerializer` e `HabitHistoryDaySerializer`; `HabitDayView` usa `get_day_completeness`; `HabitUntrackedDayView` (`POST`/`PATCH untracked-days/`, `DomainError` → 400 `{"date"}`) -- contrato do dia e endpoint de marcação.
- [x] `backend/medications/services.py` + `serializers.py` + `views.py` + `urls.py` -- `untracked` em `get_medication_day`/`MedicationDaySerializer`; `MedicationUntrackedDayView` + rota `untracked-days/` -- paridade de contrato.
- [x] `backend/habits/tests/test_views.py` + `test_services.py` + `backend/medications/tests/test_views.py` -- cobrir cada linha da I/O Matrix (inclui `compute_day_completeness` inalterado, cross-tenant, por-collection) -- matriz executável.
- [x] `schema.yaml` + `frontend/src/api/types.gen.ts` -- regenerar e commitar -- gate de CI.
- [x] `frontend/src/features/habits/types.ts` + `api.ts` -- tipos novos; `useSetUntrackedDayMutation(date)` otimista (flipa `untracked`, zera `totalCompletion`/`groups[].completion` ao marcar; `onSuccess` invalida `['habits','history']` e `['habits','series']`) -- molde do feriado.
- [x] `frontend/src/features/habits/components/record/HabitsTodayPanel.tsx` + `HabitGroupCard.tsx` -- checkbox `UNTRACKED_LABEL`; slot do % = `UNTRACKED_PERCENT` sem `CompletionBar`; chip `UNTRACKED_STATE` (`data-testid="habits-day-untracked-chip"`); nota `UNTRACKED_NOTE`; `'—'` para null transiente; erro/retry; card de grupo "Não registrado" sem barra -- superfície de marcação.
- [x] `frontend/src/features/habits/components/record/HabitsHistoryPanel.tsx` + `HabitCompletionGrid.tsx` + `habitsSurface.ts` + `components/HabitTracker.tsx` + `components/HabitHistory.tsx` -- ramo `untracked` no `DayDetail` (`UNTRACKED_DAY` + `UNTRACKED_DAY_NOTE`); lista compacta "Não registrado"; comentário em `GridCellInput`; guarda de null no legado -- leitura coerente em todas as superfícies.
- [x] `frontend/src/features/medications/api.ts` + `dayModel.ts` + `components/MedicationBlock.tsx` + `components/MedicationHistorySurface.tsx` -- `useSetMedicationUntrackedDayMutation(date)`; `EntryStatus 'unrecorded'` + `deriveEntryStatus(entry, isPast, untracked=false)`; `ENTRY_STATUS.unrecorded` "Não registrado" (`disabled`, `RadioButtonUncheckedIcon`), prop `untracked` até `StatusIndicator`/`EntryRow` (indicador quando `isPast || untracked`; bloco `pending` → "Não registrado"); checkbox + estado textual + alert/retry no Histórico -- "dose perdida" deixa de ser fabricada.
- [x] `frontend/src/features/**/*.test.ts(x)` -- vitest+axe: Hoje marcado (sem %, sem barra, chip, checkbox, POST), card de grupo, `DayDetail`/compacto, `gridCell` com dia ausente, `deriveEntryStatus`, `MedicationBlock` sem "Dose perdida", `MedicationHistorySurface` toggle, mutations otimistas com rollback -- matriz de UI.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md` + `_bmad-output/implementation-artifacts/deferred-work.md` -- parágrafo "Dia não registrado" em Hábitos + linha em State Patterns; DW "summary/today adota `untracked`" -- rastreabilidade do estado novo.

**Acceptance Criteria:**
- Given um dia passado aberto em branco, when Hugo marca "Marcar este dia como não registrado" na aba Hoje, then o cabeçalho lê "Não registrado" sem barra, os cards de grupo leem "Não registrado", as linhas seguem editáveis, e o Histórico mostra o dia como "Dia não registrado — fora das estatísticas." com a célula semanal e o gráfico ignorando o dia.
- Given um dia marcado, when Hugo desmarca, then a porcentagem real volta após o refetch e nenhuma linha de `habit_day_entries` foi criada, alterada ou apagada pela marcação.
- Given um dia passado de Medicamentos sem confirmações, when Hugo o marca como não registrado no Histórico, then as linhas e o bloco leem "Não registrado" (nenhum "Dose perdida"/"Doses perdidas") e o dia de Hábitos permanece com sua porcentagem.
- Given a suíte existente, when ela roda, then `compute_day_completeness`, `seed_*`, a fórmula de `gridCell` e `GET /api/summary/today` permanecem inalterados, a migration reverte/reaplica, e `schema.yaml`/`types.gen.ts` não divergem no CI.

## Spec Change Log

- 2026-10-19 (implementação, ciclo 1) — **Baseline vermelho do frontend (não tocado):** `npm run test:run` fecha com 8 falhas pré-existentes no baseline `0d0f347`, todas já no ledger: as 7 da DW-61 (`features/bujo/components/TaskDestinationDialog.test.tsx` ×5, `features/bujo/components/TaskDetailPanel.test.tsx` ×1, `pages/planner/FuturePage.test.tsx` ×1) e a 8ª da DW-77 (`pages/habits/HabitsRecordPage.test.tsx › Aba Histórico › "DW-60: o glifo aparece no detalhe do dia e na grade…"`). Nenhuma falha nova.
- 2026-10-19 — **Rota de Medicamentos:** o endpoint é `POST/PATCH /api/medications/untracked-days/` (irmã de `/api/habits/untracked-days/`, antes de `<uuid:pk>/`), não sob `days/`.
- 2026-10-19 — **Constante compartilhada:** `UNTRACKED_PERCENT` ("Não registrado") vive em `record/habitsSurface.ts` (módulo puro) e é re-exportada por `HabitsTodayPanel.tsx`, porque `HabitGroupCard` e `HabitCompletionGrid` (lista compacta) também a escrevem — importá-la do painel criaria import circular.
- 2026-10-19 — **Fixtures de teste atualizadas (sem mudar comportamento):** `untracked: false` adicionado aos payloads `HabitDay`/`HabitHistoryDay`/`MedicationDay` de 9 arquivos de teste existentes (o campo é obrigatório no contrato gerado); `habits/tests/test_serializers.py::test_history_day_serializer_allows_null_total_completion` idem. Os mocks EXPLÍCITOS de `features/habits` em `src/app/layout/RouteAnnouncer.test.tsx` e `src/app/router.test.tsx` ganharam `useSetUntrackedDayMutation` (sem ele, `HabitsTodayPanel` quebrava no mount — regressão apanhada pelo `test:run` completo e corrigida no mesmo ciclo).
- 2026-10-19 — **DW registrada:** DW-78 (`GET /api/summary/today` não adota `untracked`; guardado por `test_summary_habits_segue_numerico_com_dia_marcado_nao_registrado`).
- 2026-10-19 — **Ambiente:** `frontend/node_modules` não existia nesta máquina — `npm ci` executado (lockfile intacto); Postgres de teste subido via `docker compose up -d db`.

- 2026-10-19 — **Patches do ciclo de review 1 (P1–P8), sem mudança no bloco congelado:**
  - **P1** — `frontend/src/api/errors.ts`: novo helper puro `fieldErrorMessage(error, field)` (AxiosError 400 → `response.data.fields[field][0]`; `domainErrorMessage` intacto) + 4 testes em `errors.test.ts`. `HabitsTodayPanel` e `MedicationHistorySurface`: quando o toggle falha com 400 de campo `date`, o `role="alert"` mostra a mensagem do servidor (`data-testid="habits-untracked-field-error"` / `"medications-untracked-field-error"`) e **não** oferece retry; qualquer outro erro mantém genérico + retry. Testes de página/superfície do caminho 400 nas duas (mensagem visível, sem botão) e do 400 sem o campo (cai no genérico).
  - **P2** — nas duas superfícies: `useEffect(() => reset(), [date|selectedDate])` zera o estado do toggle ao trocar de data; o retry reenvia `setUntracked.variables` (a escrita exata que falhou), nunca `!untracked`. Retry do feriado intocado (deferido). Testes: erro em D1 → "Dia anterior" → nenhum alerta; retry num dia já marcado reenvia `{untracked: false}` duas vezes.
  - **P3** — `HabitsTodayPanel`: o checkbox "Marcar este dia como não registrado" passou para **depois** de "Precedência: feriado > fim de semana > dia útil." (feriado + precedência adjacentes). Teste de ordem no DOM (`compareDocumentPosition`).
  - **P4** — `EXPERIENCE.md` (State Patterns, linha "Dia não registrado"): "em Hábitos, offline, o checkbox fica desabilitado apontando para a faixa; a superfície de Medicamentos não tem estado offline próprio"; registra também a exceção do 400 de campo.
  - **P5** — docstrings: `HabitUntrackedDayView`/`MedicationUntrackedDayView` agora descrevem `ValidationError({"date": …})` → `{detail, fields: {date: […]}}` (e não o `{"detail"}` de `HabitGroupMultipliersView.put`); `HabitHistoryRangeView` e `HabitSeriesView` dizem que dia marcado chega como lacuna (`untracked: true`, `entries: []`) / ponto omitido. `schema.yaml` + `types.gen.ts` regenerados (só descrições mudaram; 3 warnings pré-existentes do spectacular).
  - **P6** — `MedicationHistorySurface`: a linha do checkbox fica montada sempre que não há erro de leitura, `disabled` enquanto `dayQuery.data == null`, `checked` a partir de `untracked` (sem salto de layout no "Dia anterior"). Testes: loading → montado e desabilitado; erro de leitura → não montado.
  - **P7** — testes novos: (a) `HabitTracker.test.tsx` — `untracked: true` + % nulos renderiza "Completude do dia: Não registrado" e "Saúde · Não registrado"; (b) `backend/accounts/tests/test_admin.py` (novo, molde `automation/tests/test_admin.py`) — `UntrackedDayAdmin.get_queryset` vê linhas de dois tenants fora de `tenant_context` (idem `UserHolidayAdmin`); (c) `HabitsRecordPage.test.tsx` — clicar no checkbox marcado envia `{date, untracked: false}` e o % segue "—"; (d) `habits/tests/test_views.py` — `GET /api/habits/days/` sem `?date=` após marcar `today_for(user)` devolve `untracked: true`.
  - **P8(a)** — E2E: cenário novo em `frontend/e2e/habits-record.spec.ts` (`seedMultiplierScenario`: marcar → `habits-day-percent` "Não registrado", chip visível, `completion-bar-day`/`-group` ausentes, linhas editáveis, persiste no reload; desmarcar → "50%" volta) e em `frontend/e2e/medications-history.spec.ts` (`seedMedicationPastSchedule`: "Dose perdida"/"Doses perdidas" → "Não registrado" ×2 + título com o estado; persiste; desmarcar devolve o sinal). Postgres local `bujo_e2e` criado e migrado (`createdb` + `migrate` com `config.settings.e2e`, runbook §4b). **Executado:** `npm run test:e2e -- habits-record medications-history` → 13 passed (1.3 min), incluindo os dois cenários novos (`habits-record.spec.ts:221`, `medications-history.spec.ts:77`), contra `bujo_e2e` local.
  - **P8(b)** — reversibilidade: `migrate accounts 0002` → "Unapplying accounts.0003_untracked_day... OK"; `migrate` → "Applying accounts.0003_untracked_day... OK" (base de teste local).
  - **Verification da spec re-executada após os patches:** `ruff check` limpo; `makemigrations --check` sem drift; `lint-imports` KEPT; `spectacular` + `generate-types` → `git diff --stat`: `schema.yaml` +197/−16 e `types.gen.ts` +233/−16 (só os itens da story + descrições do P5; nenhum enum novo); `npm run lint` limpo; `tsc --noEmit -p tsconfig.app.json` limpo; `vitest run` → 2421 passed | 8 failed (exatamente o baseline DW-61 ×7 + DW-77 ×1); `pytest` completo → 1553 passed (5:39, Postgres local `hmmb_test`).

## Review Triage Log

### 2026-10-19 — Review pass (ciclo 1: blind-hunter, edge-case-hunter, verification-gap)

**Mantidos → patch** (um reengajamento do subagente implementador): (1) 400 por campo (`fields.date`, data futura por fuso do perfil ≠ fuso do navegador) engolido no alerta genérico com retry que nunca passa — Hoje de Hábitos e Histórico de Medicamentos; (2) alerta/retry do toggle sobrevive à troca de data e o retry deriva do estado atual (pode escrever no outro dia ou inverter a intenção) — ambas as superfícies; (3) checkbox "não registrado" inserido entre o de feriado e a frase de precedência; (4) linha de State Patterns prometendo offline também em Medicamentos; (5) docstrings imprecisas (idioma do 400 ≠ `HabitGroupMultipliersView.put`; views de histórico/série mudas sobre dia marcado) propagadas ao schema; (6) checkbox de Medicamentos desmonta durante o fetch ao trocar de data; (7) lacunas de teste (guarda de null no `HabitTracker` legado, `UntrackedDayAdmin.get_queryset` cross-tenant, clique de desmarcar na página, `GET days/` sem `?date=`); (8) sem E2E representativo e sem registro do teste de reversibilidade da migration (exigências do contexto do épico) — fix escopado: um cenário Playwright por superfície + rodar e registrar a reversão/reaplicação.

**Dispensados:**
- *`MedicationDaySurface` (aba Hoje) não recebe `untracked`* (blind-hunter + edge-case): fronteira explícita da spec (Code Map/Tasks "não tocar"); o Hoje é superfície de trabalho do dia corrente, onde "Pendente" é leitura correta e não é sinal clínico; o controle e a releitura vivem no Histórico por decisão da Approach congelada. Fix editaria a spec → dispensa.
- *Duas views e duas mutations quase idênticas* (blind-hunter): sem consequência para o usuário; espelha o precedente de feriado; ~30 linhas. Cosmético.
- *`epic-16-context.md` perdeu fatos e mudou o cabeçalho* (blind-hunter): o arquivo foi recompilado pelo rito (step 1, contexto inválido por `epics.md` mais novo) seguindo `compile-epic-context.md`, cujo formato fixa o cabeçalho "Compiled… Edit freely" e proíbe detalhe de story (a rota `by-group/` é da 16.2b e segue no `epics.md`). Documento de contexto de agente → nunca patch.
- *Cópia divergente entre superfícies* ("Tentar de novo" × "Tentar novamente", `SAVE_ERROR` × `WRITE_ERROR`, `UNTRACKED_PERCENT` × `UNRECORDED_LABEL`) (blind-hunter): cada superfície segue a convenção já existente do próprio módulo (`MedicationHistorySurface` já usava "Tentar novamente"; `MedicationBlock` já declarava `SAVE_ERROR`); sem consequência.
- *Hábito que só aparece em dias marcados some de `habits`* (blind-hunter): comportamento fixado na matriz congelada ("hábito que só aparece em D sai de `habits`") e coerente com "dia marcado = dia sem linha" (hábito sem linha no range também não é listado). Fix editaria a spec congelada → dispensa.
- *Redundâncias pequenas* (`is_untracked` relido após a escrita; `get_day_completeness` calcula e descarta) (blind-hunter): sem consequência observável; escala single-user (AD-14).
- *Vitest fora do CI* (verification-gap): condição pré-existente e decisão registrada (`architecture.md` §7.4: nem Vitest nem Playwright rodam no CI); não é defeito desta story.

**Deferidos (pré-existentes, registrados em `deferred-work.md`):** contrato PATCH (`PatchedSetUntrackedDay` com campos opcionais × `patch = post` exigindo ambos — mesma convenção de `PatchedSetHoliday`); retry do feriado em `HabitsTodayPanel` com a mesma fragilidade de estado (deriva de `!isHoliday` e sobrevive à troca de data), anterior a esta story.

## Design Notes

**Uma tabela em `accounts`, não uma por app.** Mesma porta de import de `UserHoliday`; uma migration; `collection` dá o escopo por módulo decidido por Hugo; 16.2b e Épico 21 leem uma fonte só. Sem `collection` no wire: cada endpoint fixa a sua — nenhum enum novo no schema.

**Histórico devolve o dia marcado vazio (`entries: []`), não só a flag.** Toda agregação cliente (grade, lista compacta, legado, gráfico) já trata "dia sem linha" como fora do denominador; devolver vazio reaproveita essa regra em vez de espalhar `if (untracked)` por cada consumidor. A aba Hoje é a exceção deliberada: devolve as entries (dia editável) com `totalCompletion`/`completion` nulos.

**`compute_day_completeness` fica puro.** `get_day_completeness` é o wrapper que conhece a flag; o resumo do widget (`automation`) continua com contrato numérico nesta story (DW).

**400 e não 409.** `DomainError` de service vira 409 no handler central; a view converte em `ValidationError({"date"})`, idioma já usado em `HabitGroupMultipliersView.put`.

**Checkbox, não botão.** Rótulo estável + estado nativo (`checked`) — mesmo controle do feriado; nunca só cor, nunca só um botão apagado.

**Sem auto-desmarcar ao editar.** A flag é declaração explícita de validade estatística; preencher uma linha não deve puxar o dia de volta às médias em silêncio.

## Verification

**Commands:**
- `cd backend && uv run ruff check . && uv run pytest` -- expected: verde (inclui gate de isolamento com `accounts.UntrackedDay`)
- `cd backend && uv run python manage.py makemigrations --check --dry-run --noinput` -- expected: sem drift
- `cd backend && uv run python manage.py migrate accounts 0002 && uv run python manage.py migrate` -- expected: reverte e reaplica sem erro
- `cd backend && uv run lint-imports` -- expected: KEPT
- `cd backend && uv run python manage.py spectacular --file ../schema.yaml && cd ../frontend && npm run generate-types && git diff --stat ../schema.yaml src/api/types.gen.ts` -- expected: só `untracked`, nulos em `totalCompletion`/`completion`, schemas `SetUntrackedDay`/`UntrackedDayResult`; nenhum enum novo
- `cd frontend && npm run lint && npx tsc --noEmit && npm run test:run` -- expected: verde exceto os 7–8 testes de `bujo`/`planner` já vermelhos no baseline `0d0f347` (listar no Spec Change Log)

**Manual checks (if no CLI):**
- Hábitos → Hoje → dia passado em branco → marcar → "Não registrado" sem barra; Histórico → detalhe nomeia o estado, célula semanal perde o dia, gráfico com lacuna; desmarcar → % volta.
- Medicamentos → Histórico → dia passado sem confirmações → marcar → "Não registrado" substitui "Dose perdida"; Hábitos do mesmo dia inalterado.

## Suggested Review Order

**Modelo e regra única (ponto de entrada)**

- A flag é presença de `(user, date, collection)`, molde de `UserHoliday`; `collection` dá o escopo por módulo.
  [`models.py:72`](../../backend/accounts/models.py#L72)

- Escrita idempotente; `date > today_for(user)` vira `DomainError`; só a linha-flag é tocada.
  [`services.py:49`](../../backend/accounts/services.py#L49)

- Uma query por range para histórico e série (sem N+1).
  [`services.py:35`](../../backend/accounts/services.py#L35)

**Hábitos — dia marcado = dia sem linha**

- Wrapper ciente da flag; `compute_day_completeness` fica puro (widget do resumo intacto, DW-78).
  [`services.py:382`](../../backend/habits/services.py#L382)

- Histórico devolve o dia marcado como lacuna (`entries: []`) + `untracked`; `habits_seen` ignora o dia.
  [`services.py:521`](../../backend/habits/services.py#L521)

- Série omite o ponto do dia marcado; `day_types` segue cobrindo o range.
  [`services.py:641`](../../backend/habits/services.py#L641)

- Aba Hoje continua semeando e devolve `untracked` com completude nula.
  [`views.py:221`](../../backend/habits/views.py#L221)

- Endpoint de marcação: `DomainError` → 400 `{"date": …}` (campo, não `detail`).
  [`views.py:310`](../../backend/habits/views.py#L310)

- `completion`/`total_completion` passam a `allow_null`; `untracked` nos dois payloads.
  [`serializers.py:179`](../../backend/habits/serializers.py#L179)

**Medicamentos — "Não registrado" no lugar de "Dose perdida"**

- `get_medication_day` só acrescenta a flag; blocos e linhas não mudam.
  [`services.py:490`](../../backend/medications/services.py#L490)

- Paridade de contrato com a view de Hábitos.
  [`views.py:380`](../../backend/medications/views.py#L380)

- A derivação temporal ganha o terceiro estado `unrecorded`, antes de `missed`.
  [`dayModel.ts:30`](../../frontend/src/features/medications/dayModel.ts#L30)

- Bloco `pending` marcado lê "Não registrado"; `partial`/`confirmed` mantêm rótulo.
  [`MedicationBlock.tsx:67`](../../frontend/src/features/medications/components/MedicationBlock.tsx#L67)

- Checkbox rotulado no Histórico; linha sempre montada, desabilitada durante o fetch.
  [`MedicationHistorySurface.tsx:155`](../../frontend/src/features/medications/components/MedicationHistorySurface.tsx#L155)

**Hábitos — superfície**

- Slot do % vira texto ("Não registrado" / "—"); barra só com número.
  [`HabitsTodayPanel.tsx:179`](../../frontend/src/features/habits/components/record/HabitsTodayPanel.tsx#L179)

- Checkbox depois da frase de precedência (feriado + precedência adjacentes).
  [`HabitsTodayPanel.tsx:383`](../../frontend/src/features/habits/components/record/HabitsTodayPanel.tsx#L383)

- Reset do toggle ao trocar de data: alerta nunca sobrevive para outro dia.
  [`HabitsTodayPanel.tsx:124`](../../frontend/src/features/habits/components/record/HabitsTodayPanel.tsx#L124)

- 400 de campo mostra a mensagem do servidor sem retry; outros erros, genérico + retry com `variables`.
  [`HabitsTodayPanel.tsx:171`](../../frontend/src/features/habits/components/record/HabitsTodayPanel.tsx#L171)

- Card de grupo: "Não registrado" sem barra; nulo transiente lê "—".
  [`HabitGroupCard.tsx:76`](../../frontend/src/features/habits/components/record/HabitGroupCard.tsx#L76)

- Detalhe do Histórico nomeia o estado antes do ramo de lacuna.
  [`HabitsHistoryPanel.tsx:158`](../../frontend/src/features/habits/components/record/HabitsHistoryPanel.tsx#L158)

- Lista compacta escreve "Não registrado"; grade/`gridCell` inalterados (dia chega vazio).
  [`HabitCompletionGrid.tsx:201`](../../frontend/src/features/habits/components/record/HabitCompletionGrid.tsx#L201)

- Mutation otimista: marcar zera os % (nunca recálculo); sucesso invalida histórico e série.
  [`api.ts:333`](../../frontend/src/features/habits/api.ts#L333)

- Helper puro do 400 por campo (`domainErrorMessage` do 409 intacto).
  [`errors.ts:58`](../../frontend/src/api/errors.ts#L58)

**Periféricos**

- Migration reversível (0002 → 0003 → 0002 → 0003 verificado).
  [`0003_untracked_day.py:1`](../../backend/accounts/migrations/0003_untracked_day.py#L1)

- Admin cross-tenant via `all_objects`, com teste.
  [`admin.py:41`](../../backend/accounts/admin.py#L41)

- Gate de isolamento registrado.
  [`factories.py:66`](../../backend/accounts/tests/factories.py#L66)

- Matriz executável: histórico como lacuna + vizinho intacto.
  [`test_views.py:736`](../../backend/habits/tests/test_views.py#L736)

- Página: Hoje marcado, otimismo, retry, offline, 400 de campo, desmarcar.
  [`HabitsRecordPage.test.tsx:2042`](../../frontend/src/pages/habits/HabitsRecordPage.test.tsx#L2042)

- E2E ponta a ponta nas duas superfícies.
  [`habits-record.spec.ts:221`](../../frontend/e2e/habits-record.spec.ts#L221)

- Guarda de null no legado (Daily), sem toggle.
  [`HabitTracker.tsx:222`](../../frontend/src/features/habits/components/HabitTracker.tsx#L222)

