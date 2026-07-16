# Explicacao dos arquivos nao commitados - Story 11.10 — Seletor Mover/Migrar completo (abas Hoje/Semana/Mês/Futuro, botão explícito)

## Visao geral

O conjunto de mudancas implementa a Story 11.10: reformular o seletor de mover/migrar (`TaskDestinationDialog`, entregue na 11.6) para **4 abas de destino** — Hoje / Esta semana / Este mês / Futuro — com **confirmação explícita** por um botão "Migrar" (fluxo de 2 passos: selecionar → confirmar), absorvendo o destino "Hoje" que estava planejado à parte e mostrando "Atualmente: DD/MM" quando a tarefa tem `scheduledDate`. A aba "Este mês", por decisão do Hugo (`docs/futureIdeas.md:32`), passa a usar o **mesmo `MonthDensityCalendar`** da aba "Esta semana" em vez do antigo `TextField type="date"`; o calendário ganha **destaque de hoje e da semana corrente**.

O ponto mais importante da story **não é** o frontend: ao reproduzir o bug relatado "o modal de migração não funciona em Esta Semana" via e2e real contra o backend, descobriu-se que a causa raiz era **backend e pré-existente desde a 11.6**. `_migrate_subtree` (`services/migration.py`) transicionava a **origem** (`transition_task` → `MIGRATED`/`POSTPONED`) **antes** de criar a nova tarefa no destino. Quando a tarefa migrada era a única `pending`/`started` do seu container de origem **e** o destino era **esse mesmo container** (ex.: dar um dia a uma tarefa "sem dia" da semana/mês corrente), a transição esvaziava o container, `is_container_closed` passava a considerá-lo fechado, e `create_task` rejeitava a própria inserção da migração com `ClosedCycleReadOnly` (409). O fix é uma **inversão de ordem** (criar antes, transicionar depois), coberta por transação atômica; mais uma remoção cirúrgica de validação no serializer para permitir "Este mês sem data" (`destination: "month"` sem `scheduled_date`).

O escopo toca **backend** (`serializers.py`, `services/migration.py`, + `test_services.py`/`test_views.py`) e **frontend** (`MonthDensityCalendar.tsx`, `TaskDestinationDialog.tsx` reescrito, + 4 arquivos de teste de componente e o e2e `move-task.spec.ts` reescrito). **Sem** mudança de contrato (`schema.yaml`/`types.gen.ts`), `api.ts`/`keys.ts`, `views.py`/`urls.py` ou migração de banco — `scheduled_date` já era opcional no schema OpenAPI e o `MigrationDestination` já tipava `'today'`. Além do código, o commit carrega a **spec da story** (untracked), o `sprint-status.yaml` (11.10 → done) e o state doc do story-automator (resumidos brevemente).

## Ordem logica de funcionamento

1. A **spec da Story 11.10** (`11-10-...md`) é o contrato funcional (15 ACs, tasks, Dev Notes com a root cause, Dev Agent Record) — produzida na automação do 2º lote do Épico 11.
2. O **serializer** (`serializers.py`) é a primeira camada de runtime numa migração: remove a validação que retornava 400 para `destination: "month"` sem `scheduled_date`, deixando "month" tão permissivo quanto "week" já era.
3. O **serviço** (`services/migration.py`) consome o payload validado: `_migrate_subtree` inverte a ordem (criar destino antes de transicionar origem), fechando o 409 `ClosedCycleReadOnly` quando origem == destino; docstring de `migrate_task` atualizado.
4. Os **testes de backend** (`test_services.py`, `test_views.py`) provam o novo comportamento: 2 regressões de "origem == destino" (semana e mês), "month sem data" no serviço, e o teste de view antigo (`_retorna_400`) vira `_postpoe_no_monthly_corrente` (200).
5. O **componente de calendário** (`MonthDensityCalendar.tsx`) ganha destaque de hoje/semana corrente com atributos estáveis (`data-today`/`data-current-week`) — usado pelas duas abas com calendário.
6. O **seletor** (`TaskDestinationDialog.tsx`) é reescrito para 4 abas, estado local por aba e botão "Migrar"; consome o `MonthDensityCalendar` nas abas "Esta semana" e "Este mês".
7. Os **testes de componente** (`TaskDestinationDialog.test.tsx`, `MonthDensityCalendar.test.tsx`, `TaskDetailPanel.test.tsx`, `TaskRow.test.tsx`) validam os componentes reais e o rename do título do diálogo.
8. O **teste E2E** (`move-task.spec.ts`) valida o fluxo real de 2 passos nas 4 superfícies + o caminho do bug (origem = Esta Semana), contra o backend real.
9. Os **registros de status** (`sprint-status.yaml`, `orchestration-11-...md`) documentam a conclusão (11.10 → done).

---

## 1. Especificacao da Story 11.10

### `_bmad-output/implementation-artifacts/11-10-seletor-mover-migrar-completo.md` (novo, untracked)

**Funcao geral do arquivo**

Artefato de story da BMad para a 11.10 — documento de implementação (não código) que define escopo, 15 ACs (agrupadas em AC1-AC6 numeradas de fato), tasks/subtasks, Dev Notes, Dev Agent Record, Senior Developer Review e Change Log. É o contrato funcional consumido pelo dev-story e pela review.

**Funcao geral da alteracao**

Arquivo novo (untracked). Front matter `baseline_commit: 91b7bd3`, Status `done`. Documenta que a story reformula o seletor da 11.6, absorve o destino "Hoje" e — criticamente — corrige o bug relatado de Esta Semana, com um **achado que contradiz o sprint-change-proposal** (que dizia "nenhum delta de backend nesta story"): a story acabou tendo 2 mudanças de backend (remoção de validação + fix de ordem em `_migrate_subtree`).

**Blocos principais**

- Linhas 19-71: Acceptance Criteria — AC1 (4 destinos, título "Migrar Tarefa", "Atualmente: DD/MM"), AC2 (confirmação explícita só por "Migrar", só neste seletor; `MigrationCard`/`MigrationFlow` inalterados), AC3 (calendário destaca hoje/semana; clique preenche, não migra — vale para as duas abas), AC4 (funciona em Esta Semana — exige diagnóstico e cobertura dedicada), AC5 (estado/linhagem mantidos; sem mudança de contrato), AC6 (sem regressão do MigrationCard nem dos testes de a11y).
- Linhas 73-164: tasks — Task 1 (backend: remover validação de "month sem data" em `serializers.py:147-151`; docstring; sem mudança de `views.py`/schema), Task 2 (testes de backend, +4 vs baseline 360 → **364 passed**), Task 3 (destaque hoje/semana em `MonthDensityCalendar` com `data-today`/`data-current-week`), Task 4 (reescrita do dialog em 4 abas + botão), Task 5 (7 renames do título do diálogo), Task 6 (diagnóstico e cobertura do bug de Esta Semana), Task 7 (testes de frontend, +14 → **508/509 passed**), Task 8 (e2e reescrito, 11 cenários / 10 testes + verificação visual por screenshot).
- Linhas 166-257: Dev Notes — o achado crítico (delta de backend não previsto), o diagnóstico do bug de Esta Semana com a **root cause** documentada (`_migrate_subtree` fechava o próprio container de destino antes de inserir), a decisão de mostrar só `scheduledDate` (o tipo `Task` não expõe o container atual), a reversão registrada do Hugo (calendário em "Este mês", fonte `futureIdeas.md:32`), componentes reaproveitados, "não fazer nesta story", Git/Project Structure e References ancoradas em arquivos e linhas.
- Linhas 259 em diante: Dev Agent Record — Debug Log (reprodução do 409 via e2e descartável; root cause; fix 200 OK; contagens `pytest`/`vitest`), Completion Notes por camada, e a Senior Developer Review.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Não define símbolos executáveis; especifica o comportamento implementado nos arquivos abaixo. Contém a decisão de produto (calendário em "Este mês") e o registro de que a root cause do bug era backend, não a reescrita do frontend.

---

## 2. Backend — camada de serialização (gate de validação HTTP)

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Serializers DRF do app `bujo`. `TaskMigrateSerializer` valida o payload do endpoint `POST /api/bujo/tasks/{id}/migrate/` — é a primeira camada de runtime a tocar a requisição de migração, antes da view e do serviço.

**Funcao geral da alteracao**

Remove o bloco de validação que **rejeitava com 400** qualquer `destination == "month"` sem `scheduled_date`. Após a mudança, "month" se comporta, quanto a `scheduled_date`, exatamente como "week" já se comportava (opcional) — habilitando "Este mês sem data" (AC1/AC5). A restrição era **só** de validação HTTP: o serviço `migrate_task` já aceitava `scheduled_date=None` para "month".

**Blocos principais**

- Linhas 146-147 (contexto): `validate(self, attrs)` mantém `destination = attrs["destination"]`.
- **Removidas** (antigas 147-151): o `if destination == "month" and not attrs.get("scheduled_date"): raise serializers.ValidationError({"scheduled_date": "Obrigatório para adiar no mês."})`. São as -4 linhas do `git diff --stat`.
- Preservada: a validação de `destination == "future"` (exige `month_first`) permanece intacta logo abaixo — só o ramo "month" foi removido.

**Funcoes, classes e importacoes especificas**

- `TaskMigrateSerializer.validate`: agora só cobre o ramo "future"; os ramos "today"/"week"/"month" seguem para a view/serviço com `scheduled_date` opcional.
- `serializers.ValidationError`: continua usado para "future" — a mudança não altera a forma do payload nem o schema OpenAPI (`scheduled_date` já era `DateField(required=False, allow_null=True)`), logo sem regeneração de `schema.yaml`/`types.gen.ts` (AC5).

**Comportamento de libs usadas**

- DRF `Serializer.validate`: hook de validação de objeto (cross-field) — roda depois da validação de campo; levantar `ValidationError` aqui vira HTTP 400. Remover o ramo faz o request de "month sem data" passar para 200.

---

## 3. Backend — serviço de migração (root cause do bug)

### `backend/bujo/services/migration.py`

**Funcao geral do arquivo**

Serviço de domínio da migração de tarefas (AD-08). `migrate_task` é o dispatcher por `destination` (today/week/month/future/cancel); `_migrate_subtree` faz a migração recursiva de uma tarefa e seus filhos ainda não-dispostos, criando o novo registro no container de destino e transicionando a origem.

**Funcao geral da alteracao**

Corrige um bug **pré-existente desde a 11.6**: `_migrate_subtree` **inverte a ordem** de duas operações — passa a **criar** a nova tarefa no destino **antes** de transicionar a origem, em vez do inverso. Root cause do "modal não funciona em Esta Semana" (AC4): quando a tarefa migrada é a única `pending`/`started` do seu container de origem **e** o destino é esse mesmo container, transicionar a origem primeiro deixava o container sem tarefas ativas por um instante, `is_container_closed` (`services/archive.py`) o considerava fechado, e `create_task` rejeitava a própria inserção com `ClosedCycleReadOnly` (409). Também atualiza o docstring de `migrate_task` (ramo "month": `scheduled_date` "obrigatório" → "opcional").

**Blocos principais**

- Linhas 23-36 (`_migrate_subtree`, docstring): reescrito para documentar a nova ordem ("criar o novo registro PRIMEIRO e só depois transicionar a origem"), o motivo (janela em que `is_container_closed` fecharia o destino), e a garantia de atomicidade (`migrate_task` é `@transaction.atomic`, então uma falha tardia em `transition_task` reverte a criação também, sem órfão).
- Antiga linha ~30: a chamada `transition_task(user=user, task_id=source.id, to_status=new_status)` que rodava **antes** de `create_task` foi **removida** dessa posição.
- Linhas 37-44: `create_task(...)` (com `**{container_field: container}`) agora é a **primeira** escrita.
- Linha 47 (nova posição): `transition_task(user=user, task_id=source.id, to_status=new_status)` movida para **depois** da criação, antes de `set_lineage_fields`.
- Linhas 75-77 (`migrate_task` docstring): ramo "month" — "scheduled_date obrigatório" → "opcional; origem vira POSTPONED", alinhando ao comportamento real e à remoção de validação da Seção 2.

**Funcoes, classes e importacoes especificas**

- `_migrate_subtree(...)`: a inversão é a correção; a semântica de linhagem (`migration_count + 1`, `migrated_to_task`) e o resultado final (origem `MIGRATED`/`POSTPONED`, novo registro no destino) são idênticos ao anterior — só a ordem das escritas mudou.
- `create_task` / `_check_container_open`: `create_task` valida se o container está aberto antes de inserir; criar primeiro garante que o container ainda tem a tarefa de origem ativa (não fechado) no momento da inserção.
- `transition_task`: impõe a matriz `ALLOWED`; continua sendo fail-fast, mas a checagem da matriz já ocorreu na chamada raiz, então movê-lo para depois não perde a validação.
- `is_container_closed` (`services/archive.py`): consumido por `create_task`; era ele que, com o container esvaziado, disparava o falso "ciclo fechado".

**Comportamento de libs usadas**

- Django `@transaction.atomic` (em `migrate_task`): envolve criação + transição numa transação — se `transition_task` falhar após `create_task`, tudo reverte, evitando registro órfão no destino. É o que torna a inversão segura.

---

## 4. Backend — testes

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testes de serviço (pytest + `tenant_context`) do domínio `bujo`, incluindo `migrate_task`.

**Funcao geral da alteracao**

Adiciona 3 testes novos (+79 linhas): 2 regressões do bug "origem == destino" (semana e mês) e 1 caso "month sem `scheduled_date`". Nenhum teste existente é alterado.

**Blocos principais**

- Linhas 695-720: `test_migrate_task_destination_week_mesma_semana_da_origem_nao_fecha_o_proprio_destino` — regressão direta do bug (AC4): cria a **única** tarefa `pending` num `weekly_log` corrente, migra com `destination="week"` + `scheduled_date` na **mesma** semana; asserta `result.status == MIGRATED`, novo registro no **mesmo** `weekly_log`, com a data e `status == PENDING`. Antes do fix, isto falharia com `ClosedCycleReadOnly`.
- Linhas 748-767: `test_migrate_task_destination_month_sem_scheduled_date_postpoe_sem_dia` — prova o novo caminho habilitado pela Seção 2: `destination="month"` sem data → origem `POSTPONED`, novo registro no `monthly_log` corrente com `scheduled_date is None`.
- Linhas 769-795: `test_migrate_task_destination_month_mesmo_mes_da_origem_nao_fecha_o_proprio_destino` — mesma regressão que a de semana, para "month": única tarefa do `monthly_log` corrente ganha um dia dentro do **mesmo** mês; asserta `POSTPONED`, novo registro no mesmo `monthly_log`, com a data e `PENDING`.

**Funcoes, classes e importacoes especificas**

- `WeeklyLogFactory`/`MonthlyLogFactory`/`LogFactory`/`TaskFactory`: montam o cenário "container corrente com a tarefa como única ativa".
- `week_start_of(today_for(user))` / `today_for(user).replace(day=1)`: garantem que origem e destino calculados coincidem no mesmo container corrente — exatamente a condição do bug.
- `get_or_create_monthly_log`: usado para localizar o container de destino e assertar a presença do novo registro.

**Comportamento de libs usadas**

- pytest `@pytest.mark.django_db` + `tenant_context(user)`: cada teste roda numa transação com o tenant do usuário, refletindo o isolamento multi-tenant real.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testes de view/API (DRF `APIClient`) do endpoint de migração.

**Funcao geral da alteracao**

**Substitui** o teste que provava o comportamento antigo (400) pelo que prova o novo (200), refletindo a remoção da validação da Seção 2. É a contrapartida HTTP da Task 1.

**Blocos principais**

- Linhas 1034-1053: `test_post_migrate_destination_month_sem_scheduled_date_retorna_400` **renomeado** para `test_post_migrate_destination_month_sem_scheduled_date_postpoe_no_monthly_corrente`. Antes: `POST {"destination": "month"}` (sem `scheduledDate`) → `assert status_code == 400`. Depois: → `assert status_code == 200`, `response.data["status"] == "postponed"`, `task.status == "postponed"` após refresh, e o novo registro (`migrated_to_task_id`) existe no `monthly_log` do mês corrente com `scheduled_date is None`.

**Funcoes, classes e importacoes especificas**

- `auth_client.post(..., format="json")`: exerce o pipeline real serializer → view → serviço; a mudança de código-esperado (400 → 200) é a prova de ponta a ponta da remoção da validação.
- `get_or_create_monthly_log(...)` + `monthly_log.tasks.filter(id=...).exists()`: confirma que a tarefa foi para o mês corrente sem data.

**Comportamento de libs usadas**

- DRF `APIClient.post`: emite a requisição HTTP real contra a rota `migrate/`; `response.data` é o corpo serializado da resposta.

---

## 5. Frontend — componente de calendário (produtor do destaque)

### `frontend/src/features/bujo/components/MonthDensityCalendar.tsx`

**Funcao geral do arquivo**

Calendário do mês com indicador de densidade de tarefas por dia (Story 11.3). Interativo quando `onSelectDay` é passado (Story 11.6); as props `selectedDate`/`onSelectDay` já existiam. É reusado por `RecurringPlacementDialog` (informativo) e agora pelas duas abas com calendário do `TaskDestinationDialog`.

**Funcao geral da alteracao**

Adiciona **destaque visual de "hoje" e da "semana corrente"** (Task 3, AC3), calculados internamente via `new Date()` (cálculo de UI, não autoridade de domínio — mesmo padrão de `currentMonthFirst()`), com atributos **estáveis para teste** (`data-today`/`data-current-week`) além do `sx`. Não muda nenhuma prop existente (backward-compatible). O destaque vale automaticamente para as duas abas com calendário do dialog.

**Blocos principais**

- Linhas 35-46: nova função `mondayIsoOf(date)` — retorna o ISO ('YYYY-MM-DD') da segunda-feira da semana que contém `date`, via a mesma técnica Monday-based (`(getDay()+6)%7`) já usada em `leadingBlanks`. Retorna **string** (não `Date`) de propósito: comparar `Date.getTime()` entre `new Date()` (com hora real) e um dia parseado à meia-noite dava falso-negativo mesmo no mesmo dia.
- Linhas 74-79: dentro do componente, `today = new Date()`, `todayIso = isoOf(...)` e `todayMondayIso = mondayIsoOf(today)` — os âncoras do destaque, computados uma vez por render.
- Linhas 119-122 (por célula): `isToday = iso === todayIso` e `isCurrentWeek = mondayIsoOf(parseLocalDate(iso)) === todayMondayIso`.
- Linhas 142-159 (na `<td>` da célula): novos atributos `data-today`/`data-current-week` (só quando true, senão `undefined`), `bgcolor: 'action.hover'` para a semana corrente e um `boxShadow: inset 0 0 0 2px primary.main` para "hoje" (contorno interno, não `border` — que já é ocupado pela grade — para **conviver** com o `action.selected` do dia selecionado; hoje pode ser o dia selecionado, os dois sinais não podem se cancelar).

**Funcoes, classes e importacoes especificas**

- `mondayIsoOf`: normaliza qualquer data para o ISO da segunda-feira de sua semana — base tanto do `todayMondayIso` quanto do `isCurrentWeek` por célula.
- `parseLocalDate` (existente): parseia 'YYYY-MM-DD' por partes com `new Date(y, m-1, d)` local, evitando o off-by-one de UTC — reusado para converter o `iso` da célula antes de `mondayIsoOf`.
- `isoOf` (existente): formata ano/mês/dia com zero-padding — reusado por `mondayIsoOf` e por `todayIso`.

**Comportamento de libs usadas**

- MUI `sx` com callback de tema (`(theme) => ...palette.primary.main`): resolve a cor do tema em runtime; usado no `boxShadow` de "hoje".
- `Date.getDay()`: 0=Dom … 6=Sáb; `(getDay()+6)%7` reindexa para Seg=0 … Dom=6 (AD-05, segunda como 1º dia).

---

## 6. Frontend — o seletor (reescrita)

### `frontend/src/features/bujo/components/TaskDestinationDialog.tsx`

**Funcao geral do arquivo**

Modal (MUI `Dialog`) de mover/migrar tarefa, autocontido (usa `useMigrateTaskMutation()` internamente). Aberto pelo botão "Mover tarefa" do `TaskRow` (kebab) e do `TaskDetailPanel`, em todas as superfícies. Antes da story: 3 abas (Dia/Este mês/Futuro), com auto-fire (clique no dia ou `onChange` da data migrava direto).

**Funcao geral da alteracao**

Reescrita substancial (Task 4): título "Mover tarefa" → **"Migrar Tarefa"**; `DestinationMode` `'day'|'thisMonth'|'future'` → `'today'|'week'|'month'|'future'`; 4 abas na ordem Hoje/Esta semana/Este mês/Futuro (inicial "today"); **estado local por aba** (nada migra até "Migrar"); "Este mês" troca o `TextField` pelo `MonthDensityCalendar`; linha "Atualmente: DD/MM". O `handleConfirm` centraliza a mutação por aba. Remove o import de `currentMonthBounds` (não mais usado — o `TextField` sumiu).

**Blocos principais**

- Linha 16-17: import de `currentMonthBounds` (de `MigrationCard`) **removido**; `MonthDensityCalendar` mantido.
- Linha 32: `type DestinationMode = 'today' | 'week' | 'month' | 'future'`.
- Linhas 43-49: nova `formatDDMM(iso)` — parse por partes (não `new Date`, evita off-by-one de UTC), retorna `DD/MM`.
- Linhas 55-60: estados — `mode` inicial `'today'`; `selectedDate: string | null` (dia da aba "Esta semana"); `monthDate: string` (dia da aba "Este mês", `''` = sem dia); `futureDay`/`futureMonth`. Separados por aba → trocar de aba não reseta o estado das outras (AC2).
- Linhas 63-74: `thisMonthFirst = currentMonthFirst()` fixo (a aba "Este mês" não navega Prev/Next, pois o backend força `month_first` corrente); duas `useTaskDensityQuery` distintas (`weekDensity` com `enabled: open && mode === 'week'`; `monthDensity` com `enabled: open && mode === 'month'`).
- Linhas 95-107: handlers de seleção com **toggle** — `handleSelectWeekDay`/`handleSelectMonthDay` desmarcam o dia se reclicado (volta a "sem data"); `handleFutureMonthChange` só faz `setFutureMonth`.
- Linhas 109-130: `handleConfirm()` — a única porta da mutação: `today` → `{destination:'today'}`; `week` → `{destination:'week', scheduledDate: selectedDate ?? undefined}`; `month` → `{destination:'month', scheduledDate: monthDate || undefined}`; `future` → guarda `if (!futureMonth) return`, compõe `scheduledDate` de dia+mês. Todas com `onSuccess: handleMoveSuccess`.
- Linha 134: `<DialogTitle>Migrar Tarefa</DialogTitle>` (rename — muda o nome acessível do `Dialog`, daí os 7 renames em testes/e2e).
- Linhas 145-149: linha condicional "Atualmente: {formatDDMM(task.scheduledDate)}" (`variant="body-sm"`, `component="div"` — lição HIGH da review 11.9 para `body-sm` de bloco).
- Linhas 161-166: `Tabs` com 4 `Tab` (today/week/month/future).
- Linhas 168-203: tabpanels — "today" só texto ("Mover para o Daily Log de hoje."); "week" mantém navegação Prev/Next + `MonthDensityCalendar` (agora com `selectedDate={selectedDate}` e `onSelectDay={handleSelectWeekDay}`, **sem** migrar no clique); "month" renderiza `MonthDensityCalendar` fixo em `thisMonthFirst` (`selectedDate={monthDate || null}`), sem Prev/Next; "future" mantém os dois `TextField` (agora com `value={futureMonth}` controlado).
- Linhas 233-242: `DialogActions` — "Cancelar" (inalterado) + novo `<Button variant="contained">Migrar</Button>` (`onClick={handleConfirm}`, `disabled={mode === 'future' && !futureMonth}`).

**Funcoes, classes e importacoes especificas**

- `handleConfirm`: substitui os antigos `handleThisMonthChange`/`handleFutureMonthChange` que disparavam a mutação; é agora o único ponto de `migrate.mutate`.
- `selectedDate ?? undefined` (week) e `monthDate || undefined` (month): convertem "sem dia" para `scheduledDate` ausente — o caminho "semana/mês sem data" que depende do fix de backend (mês) e do suporte já existente (semana).
- `useTaskDensityQuery(..., { enabled })`: gate por aba evita fetch de densidade nas abas sem calendário; a de "week" segue o `calendarMonthFirst` navegável, a de "month" o `thisMonthFirst` fixo.
- `currentMonthFirst()` (mantido) / `currentMonthBounds` (removido): a fixação do mês corrente na aba "Este mês" agora vem de `currentMonthFirst()`, não mais dos bounds de um `TextField`.

**Comportamento de libs usadas**

- MUI `Dialog` + `DialogTitle`: MUI associa `aria-labelledby` ao `DialogTitle` — por isso renomear o título muda `getByRole('dialog', { name })` em todos os testes.
- MUI `Button variant="contained"`: destaca o "Migrar" como ação primária ao lado do "Cancelar" (texto); `disabled` reflete a única validação obrigatória (mês em "Futuro").
- MUI `Tabs`/`Tab` com `value`: aba controlada por `mode`; `handleTabChange` só troca `mode`, preservando os estados por aba.

---

## 7. Frontend — testes de componente

### `frontend/src/features/bujo/components/TaskDestinationDialog.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `TaskDestinationDialog` (Vitest + Testing Library + jest-axe), com `useMigrateTaskMutation`/`useTaskDensityQuery` mockados e o componente real renderizado.

**Funcao geral da alteracao**

Reescrita/extensão substancial (+159 linhas líquidas) para o fluxo de 2 passos (selecionar → confirmar) e as 4 abas; casos obsoletos do auto-fire removidos. Cobre título, "Atualmente", ordem das abas, cada aba com/sem dia, toggle, botão desabilitado em "Futuro" e persistência de estado entre abas.

**Blocos principais**

- Linhas 47-63: `beforeEach` — mocks resetados; comentário registra que "Esta semana"/"Este mês" partem do mês corrente real (`currentMonthFirst` não mockado), assumindo execução em julho/2026 (premissa da suite anterior).
- Linhas 61-64: novo `it('título do diálogo é "Migrar Tarefa"')` — `getByRole('dialog', { name: 'Migrar Tarefa' })`.
- Linhas 80-90: `it('exibe "Atualmente: DD/MM"...')` e `it('não exibe "Atualmente"...')` — presença/ausência da linha por `task.scheduledDate`.
- Linhas 92-99: `it('4 abas na ordem Hoje/Esta semana/Este mês/Futuro, com "Hoje" selecionada por padrão')` — `getAllByRole('tab')` + `aria-selected`.
- Linhas 101-114: aba "Hoje" — sem campos; "Migrar" chama `mutate({destination:'today'})` e fecha no sucesso.
- Linhas ~116-158: aba "Esta semana" — clicar dia **não** migra; "Migrar" chama `{destination:'week', scheduledDate:'2026-07-10'}`; sem clicar dia → `scheduledDate: undefined`; toggle (`aria-pressed` true→false); Prev/Next dispara novo fetch de densidade.
- Linhas ~160-215: aba "Este mês" — sem Prev/Next (asserção de ausência dos botões); clicar dia + "Migrar" → `{destination:'month', scheduledDate:'2026-07-10'}`; sem dia → `scheduledDate: undefined`; toggle.
- Linhas ~217-273: aba "Futuro" — dia+mês e só-mês via "Migrar"; botão desabilitado até o mês preencher (`toBeDisabled`/`toBeEnabled`); `it('trocar de aba não reseta o estado das outras')` — seleciona dia em "Esta semana", vai a "Futuro", volta e "Migrar" ainda usa o dia.
- Linhas ~301-307: teste de `onSuccess` atualizado — agora clica "Migrar" (default aba "Hoje") em vez de mudar data em "Este mês".

**Funcoes, classes e importacoes especificas**

- `renderDialog(props)`: helper que injeta `task`/`onClose`/`onSuccess` e renderiza sob `ThemeProvider`.
- `screen.getAllByRole('tab').map(t => t.textContent)`: valida rótulo e ordem exatos das abas.
- `expect(mockMigrateMutate).not.toHaveBeenCalled()`: a assertiva central do 2-passos — clicar dia/preencher campo **não** migra.

**Comportamento de libs usadas**

- Testing Library `getByRole('tab'/'button'/'dialog')` + `aria-selected`/`aria-pressed`/`toBeDisabled`: leem o estado acessível real do componente.
- Vitest mock de `useMigrateTaskMutation`: expõe `mockMigrateMutate` para assertar o payload por aba; `mock.calls[0][1].onSuccess()` dispara o callback de sucesso manualmente.

### `frontend/src/features/bujo/components/MonthDensityCalendar.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `MonthDensityCalendar` (Vitest + Testing Library + jest-axe).

**Funcao geral da alteracao**

Adiciona um `describe` novo (+54 linhas) para o destaque de hoje/semana corrente (Task 3.5), usando fake timers para fixar "hoje". Os testes existentes (AC2/AC3 da 11.3) ficam intactos.

**Blocos principais**

- Linhas 1, 87-97: importa `beforeEach`/`afterEach`; `vi.useFakeTimers()` + `vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0))` (11/03/2026, quarta → semana corrente 09-15/03, inteira dentro do mês exibido).
- Linhas 99-107: `it('marca a célula de hoje com data-today')` — `getByLabelText('11 de março...')` tem `data-today='true'`; dias 1 e 31 não.
- Linhas 108-119: `it('marca todos os dias da semana corrente (Seg-Dom) com data-current-week')` — dias 9-15 marcados; 8 e 16 não.
- Linhas 121-131: `it('mês sem sobreposição... não marca nenhum dia')` — `monthFirst: '2026-05-01'`: nenhuma célula com `data-today`/`data-current-week`.
- Linhas 133-140: `it('destaque de hoje convive com o destaque de dia selecionado')` — modo interativo, `selectedDate: '2026-03-11'`: o botão tem `aria-pressed='true'` **e** o `<td>` tem `data-today='true'` (os dois sinais coexistem — Task 3.3).

**Funcoes, classes e importacoes especificas**

- `renderCalendar(overrides)`: helper existente reusado com `monthFirst`/`onSelectDay`/`selectedDate`.
- `button.closest('td')`: verifica o atributo no `<td>` (onde o destaque vive), não no `ButtonBase`.

**Comportamento de libs usadas**

- Vitest `vi.useFakeTimers()`/`vi.setSystemTime()`: fixam `new Date()` para uma data determinística — essencial porque o destaque é calculado do relógio real do componente.
- Testing Library `getByLabelText(regex)`/`toHaveAttribute`: leem os atributos estáveis (`data-today`/`data-current-week`), imunes a jsdom não computar `sx` de tema.

### `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `TaskDetailPanel`, que embute o `TaskDestinationDialog`.

**Funcao geral da alteracao**

Ajustes de regressão do rename do título (Task 5) e do novo fluxo: 3 asserções `{ name: 'Mover tarefa' }` → `{ name: 'Migrar Tarefa' }`, e o caso de migração via "Este mês" passa a **clicar um dia no calendário** + "Migrar" (não mais preencher `TextField`).

**Blocos principais**

- Linha 290: `getByRole('dialog', { name: 'Migrar Tarefa' })` (abertura).
- Linhas 307-311: fluxo via "Este mês" — `fireEvent.click(getByLabelText('20 de julho, sem tarefas'))` + `fireEvent.click(getByRole('button', { name: 'Migrar' }))`, em vez do `fireEvent.change(getByLabelText('Data no mês corrente'), ...)` antigo; a asserção do payload (`{destination:'month', scheduledDate:'2026-07-20'}`) e o fechamento seguem.
- Linhas 322, 331, 335: `queryByRole('dialog', { name: 'Migrar Tarefa' })` no fechamento e no cancelar.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- `waitFor(() => expect(queryByRole('dialog', ...)).not.toBeInTheDocument())`: confirma que o diálogo (agora "Migrar Tarefa") fecha após sucesso/cancelar.

### `frontend/src/features/bujo/components/TaskRow.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `TaskRow`, que abre o `TaskDestinationDialog` pelo kebab "Mover tarefa".

**Funcao geral da alteracao**

Mudança mínima (Task 5): 1 asserção de título do diálogo, `{ name: 'Mover tarefa' }` → `{ name: 'Migrar Tarefa' }` (linha 606). O `aria-label` do **botão** que abre o diálogo continua "Mover tarefa" (só o título do diálogo muda).

**Blocos principais / Comportamento de libs**

- Linha 606: `getByRole('dialog', { name: 'Migrar Tarefa' })` — o resto do caso (verifica o título da tarefa no diálogo) inalterado.

---

## 8. Frontend — teste E2E

### `frontend/e2e/move-task.spec.ts`

**Funcao geral do arquivo**

Spec Playwright E2E de mover/migrar tarefa contra o backend real (branch Neon `e2e`), sem mocks de rede. Cobria a 11.6 nas 4 superfícies.

**Funcao geral da alteracao**

Reescrita para o fluxo de 2 passos (Task 8, +222 linhas): todos os casos existentes ganham um clique extra em "Migrar" após selecionar o destino; o título esperado passa a "Migrar Tarefa" (5 ocorrências); o caso "Esta Semana → Este Mês" passa a **clicar um dia no calendário** (não mais `TextField`) e assere o `scheduledDate` no payload. Adiciona cenários novos, incluindo o **caminho do bug** (origem = Esta Semana, destino = mesma semana) e os fallbacks "sem data" e "Hoje".

**Blocos principais**

- Linhas 1-13: cabeçalho atualizado (cobre 11.6 **e** 11.10, 4 abas + botão "Migrar").
- Linhas 35-56: caso "Daily Log → dia da semana" — agora clica a aba "Esta semana", clica o dia, e só então "Migrar"; `waitForResponse` do `/migrate/` movido para depois da seleção, antes do clique em "Migrar".
- Linhas 58-104: caso "Esta Semana → Este Mês" **renomeado** (…"via calendário (dia)… fecha a lacuna do bug relatado (AC2, AC3, AC4)") — clica um dia no calendário da aba "Este mês" e assere `requestPayload.scheduledDate === todayIso()`.
- Linhas 106-148: **novo** caso "move de Esta Semana clicando no calendário da própria aba Esta semana" (AC4) — cria a tarefa **em** Esta Semana, migra para um dia da **mesma** semana; o destino == origem exercita exatamente a root cause; assere `originRow.getByLabel('Migrada', { exact: true })` (o `exact` isola o botão de status do chip de linhagem "Migrada 1 vez"). É o teste que teria falhado (409) antes do fix de backend.
- Linhas 150-200: caso "Este Mês → Futuro" — preenche o mês antes de "Migrar".
- Linhas 203-241: caso "a partir do painel de detalhe" — clica dia no calendário de "Este mês" + "Migrar".
- Linhas 243-283: caso "navegar de mês (aba Esta semana)... deduz a semana correta" — Prev/Next, clica dia 15 do mês seguinte, "Migrar", assere o payload.
- Linhas 285-315: **novo** "mover para Hoje a partir de Esta Semana" — "Hoje" é a aba inicial (assere `aria-selected='true'` sem clicar aba); "Migrar" → `destination === 'today'`; confirma a tarefa no Daily Log.
- Linhas 317-355: **novo** "mover para Esta semana sem escolher dia" — "Migrar" sem clicar dia → `destination === 'week'`, `scheduledDate` undefined; confirma em "Sem dia definido" da semana corrente (escopado ao heading para evitar colisão com o placeholder do form).
- Linhas 357-413: **novo** "mover para Este mês sem escolher dia" — depende do ajuste de backend da Task 1; "Migrar" → `destination === 'month'`, `scheduledDate` undefined; origem vira "Adiada"; confirma no mês corrente.

**Funcoes, classes e importacoes especificas**

- `page.waitForResponse((r) => r.url().includes('/migrate/') && method === 'POST')` + `response.request().postDataJSON()`: capturam e inspecionam o payload real (`destination`/`scheduledDate`) — a prova de que o frontend só migra no clique em "Migrar" e com os campos certos.
- `originRow.getByLabel('Migrada', { exact: true })`: no caso destino==origem, a nova tarefa reusa o título na mesma página; o `exact` distingue o botão de status ("Migrada") do chip de linhagem ("Migrada 1 vez").
- `page.locator('.MuiTypography-heading', { hasText: 'Sem dia definido' })`: escopa ao heading da seção para não colidir com o `MenuItem` placeholder de mesmo texto no form.

**Comportamento de libs usadas**

- Playwright locators acessíveis (`getByRole`/`getByLabel`/`getByText`) + `toBeVisible`/`toHaveCount`/`toHaveAttribute` com timeouts de config (sem sleeps).
- `--workers=1` por cold-start da branch Neon `e2e` (fricção documentada desde o Épico 4); `expect(consoleErrors).toEqual([])` em cada teste.

---

## 9. Registro de status e rastreamento

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreamento de status das stories do projeto.

**Funcao geral da alteracao**

Reflete a conclusão da 11.10: `11-10-seletor-mover-migrar-completo: backlog → done` e comentário de `last_updated` para `2026-07-16  # story 11.10 → done (code review)`. Epic 11 segue `in-progress`; 11.11 permanece `backlog`.

**Blocos principais**

- Linha 38: `last_updated` com a nota da 11.10.
- Linha 91: `11-10-seletor-mover-migrar-completo: done`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem símbolos; estado YAML consumido pelos workflows de sprint.

### `_bmad-output/story-automator/orchestration-11-20260716-015115.md` (modificado)

> Artefato autodocumentado de rastreamento do run do orquestrador. Não contém runtime da aplicação. Resumido brevemente, conforme escopo.

**Funcao geral do arquivo**

State doc do run do story-automator para o lote 11.7-11.11.

**Funcao geral da alteracao**

Avança o run da 11.8 até a 11.10: front matter `currentStory: 11.8 → 11.10`, `currentStep: step-03a-execute-review`, `lastUpdated`; na tabela de progresso 11.8 e 11.9 viram `done` em todas as colunas e 11.10 fica `create/dev/automate/code-review: done` com `git-commit` pendente (`in-progress`). O Action Log ganha entradas de 11.8 completa (commit `65c177c`), 11.9 (dev `fc76f5f` + review-fix `91b7bd3`, mais o fix independente de ordenação `9d5ef75`), início da 11.10 (decisão do calendário em "Este mês"), review gate PASS, dev-story done (backend 364, frontend 508, E2E 10/10) e **code-review PASSED** — que destaca a MAJOR: a repro do bug da review encontrou a root cause de backend (`_migrate_subtree` fechava o container de destino antes de inserir; 409 quando origem==destino, pré-existente desde a 11.6), fix de 1 linha (reorder) + 2 testes de regressão; 0 C/H/M, 1 LOW corrigido, frontend vitest 509.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem símbolos; rastreamento consumido apenas pelo próprio story-automator, não pela aplicação em runtime.

---

## 10. Relacao produtor-consumidor e validacao cruzada

- `11-10-...md` (spec) **produz** o contrato funcional (ACs + a root cause documentada) consumido pelo dev-story.
- `serializers.py` (gate HTTP) **precede** `services/migration.py` (domínio) no runtime de uma migração; a remoção de validação habilita o payload "month sem data" que `migrate_task` já sabia processar.
- `services/migration.py` (`_migrate_subtree` reordenado) **é validado** por `test_services.py` (2 regressões origem==destino + "month sem data") e por `test_views.py` (400 → 200), e ponta-a-ponta por `move-task.spec.ts` (caso "origem em Esta Semana").
- `MonthDensityCalendar.tsx` (destaque hoje/semana) **é consumido** por `TaskDestinationDialog.tsx` nas abas "Esta semana" e "Este mês", e **validado** por `MonthDensityCalendar.test.tsx`.
- `TaskDestinationDialog.tsx` (reescrito) **é validado** por `TaskDestinationDialog.test.tsx` e, via consumidores, por `TaskDetailPanel.test.tsx`/`TaskRow.test.tsx` (rename do título) e pelo e2e.
- `sprint-status.yaml` e `orchestration-11-...md` **registram** o resultado (11.10 → done), sem participar do runtime.

### Observacao de escopo e risco (ja registrada)

- **Contrato intacto (AC5):** o diff **não** inclui `schema.yaml`, `frontend/src/api/types.gen.ts`, `api.ts`, `keys.ts`, `views.py`, `urls.py` nem migrações. `scheduled_date` já era opcional no schema e `MigrationDestination` já tipava `'today'`.
- **Delta de backend não previsto:** o sprint-change-proposal dizia "nenhum delta de backend nesta story"; a story acabou com **2** mudanças de backend (remoção de validação + fix de ordem em `_migrate_subtree`), ambas documentadas na spec.
- **Bug de Esta Semana era backend, não a reescrita:** a reescrita do dialog **sozinha não** teria corrigido o bug — a causa raiz (`_migrate_subtree`) é pré-existente desde a 11.6 e só ficou visível quando o fluxo novo (origem == destino) foi exercitado por e2e real; coberta por 2 testes de regressão + 1 e2e.
- **Decisão de produto (calendário em "Este mês"):** reversão registrada do Hugo (`futureIdeas.md:32`) — as duas abas com calendário usam o mesmo componente, diferindo só no alvo do submit e na navegação de mês.
- **Contagens de teste (colhidas na story):** backend `pytest` **364 passed** (baseline 360, +4); frontend `vitest` **508→509 passed** (509 após +1 regressão da review). Não reexecutadas na produção deste relatório.
