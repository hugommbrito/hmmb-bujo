---
baseline_commit: 2819951
---

# Story 11.6: Mover/migrar tarefa de qualquer superfície (destino dia-ou-mês)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero mover (migrar/adiar) qualquer tarefa — do Daily Log, Semana, Mês ou Futuro — para um dia específico ou para um mês/futuro,
Para que eu reorganize o "quando" de qualquer tarefa em qualquer direção, antecipando ou adiando (item #9 de `docs/futureIdeas.md`).

## Acceptance Criteria

### AC1 — "Mover" disponível pelo kebab do TaskRow e pelo painel de detalhe, em qualquer superfície

- **Dado que** uma tarefa raiz `pending` ou `started` em qualquer superfície (Daily Log, Esta Semana, Este Mês, Futuro),
- **Quando** aciono "Mover" pelo kebab do `TaskRow` **ou** pelo botão equivalente no `TaskDetailPanel`,
- **Então** abre um seletor de destino (`TaskDestinationDialog`, novo componente).
- **Dado que** uma tarefa em estado terminal (`completed`, `cancelled`, `migrated`, `postponed`) — a matriz `ALLOWED` (AD-02) não permite `migrated`/`postponed` a partir desses estados —,
- **Então** o controle "Mover" aparece desabilitado (mesmo padrão de disable do ícone de status em `TaskRow`, não escondido).
- **Dado que** uma **subtarefa**,
- **Então** ela não tem controle de "Mover" (mesma decisão da Story 11.5 Task 9.5 para excluir/cancelar — profundidade de 1 nível, sem regra de cascata nova a inventar).

### AC2 — Seletor de destino: dia (calendário de densidade da 11.3) ou mês (este/futuro)

- **Dado que** o seletor de destino aberto,
- **Quando** escolho a aba "Dia",
- **Então** vejo o `MonthDensityCalendar` (Story 11.3) com seleção **ligada** (`onSelectDay`/`selectedDate`, até aqui só reservados) — tocar num dia move a tarefa para aquele dia imediatamente,
- **E** posso navegar entre meses no calendário para escolher qualquer dia, passado ou futuro, dentro ou fora da semana corrente — **o app deduz a semana a partir da data escolhida**, não há bucket de "semana sem dia".
- **Dado que** escolho a aba "Este mês" ou "Futuro",
- **Então** o comportamento e os campos são os mesmos já usados no `MigrationCard` (Fluxo de Migração existente): "Este mês" pede uma data dentro do mês corrente; "Futuro" pede mês + dia opcional.

### AC3 — Regra de estado e linhagem mantidas

- **Dado que** a movimentação é executada (qualquer aba),
- **Então** a regra de estado atual é preservada: destino dia (dentro de uma semana, qualquer semana) → origem vira `migrated`; destino mês/futuro → origem vira `postponed`,
- **E** a linhagem (`migration_count`, `migrated_to_task`) é incrementada exatamente como já ocorre hoje — nenhuma tabela/coluna nova, nenhuma regra de linhagem nova.
- **Fora de escopo (registrado):** exibir o destino da migração (`migrated_to_task`) na UI — a contagem `↻ N×` já entregue (Story 4.6) basta por ora; granularidade fina de "próxima semana" como bucket próprio.

### AC4 — Backend: `migrate_task` estendido, não duplicado

- **Dado que** o serviço de backend `migrate_task` (`backend/bujo/services/migration.py`),
- **Então** o destino `"week"` passa a aceitar um `scheduled_date` **opcional**: quando presente, a semana de destino é deduzida dele (`week_start_of(scheduled_date)`, em vez do "sempre semana corrente" de hoje) e o novo registro nasce com esse `scheduled_date`; quando ausente, o comportamento de hoje (semana corrente, sem dia) **não muda** — nenhum chamador existente (`MigrationFlow`/`MigrationCard`, `WeeklyReviewBanner`) é afetado.
- **E** nenhum novo endpoint, nenhuma mudança de contrato (`TaskMigrateSerializer` já aceita `scheduled_date` para qualquer `destination` — só a lógica de `migrate_task` passa a consumi-lo para `"week"`); `schema.yaml`/`types.gen.ts` **não** precisam de regeneração nesta story.

## Tasks / Subtasks

> **Escopo real:** esta story tem 1 mudança cirúrgica de backend (Task 1) e o grosso do trabalho é frontend — um componente novo de seletor de destino que reaproveita o `MonthDensityCalendar` (11.3) e os padrões de picker do `MigrationCard` (Fluxo de Migração existente), mais a fiação em `TaskRow`/`TaskDetailPanel`. **Nenhuma migração de banco, nenhum campo novo, nenhum endpoint novo, nenhuma regeneração de contrato.**

### Backend

- [x] **Task 1: Estender `migrate_task` para deduzir a semana a partir de `scheduled_date` no destino `"week"`** (AC: #3, #4)
  - [x] 1.1 Em `backend/bujo/services/migration.py`, no branch `elif destination == "week":` (linha 80-83 hoje), trocar o cálculo incondicional de `week_start_of(today_for(user))` por: se `scheduled_date` foi passado, `week_start_of(scheduled_date)`; senão, `week_start_of(today_for(user))` (comportamento atual, preservado). O `root_scheduled_date` passa a ser `scheduled_date` (em vez de sempre `None`) quando presente — mesma variável `root_scheduled_date` já usada pelos branches `"month"`/`"future"`, só que agora também alimentada pelo `"week"`.
    ```python
    elif destination == "week":
        container_field = "weekly_log"
        week_start = week_start_of(scheduled_date) if scheduled_date else week_start_of(today_for(user))
        container = get_or_create_weekly_log(user=user, week_start=week_start)
        new_status, root_scheduled_date = Task.Status.MIGRATED, scheduled_date
    ```
    **Nenhuma mudança em `"today"`** — esse branch continua exatamente como está (container `log`, sem `scheduled_date`), é o destino usado pelo Fluxo de Migração existente (`MigrationCard` botão 1 / atalho `1`) e **não** é usado pela nova UI desta story (ver Dev Notes "Por que 'hoje' na nova UI não usa `destination='today'`").
  - [x] 1.2 Atualizar o docstring de `migrate_task` (linhas 59-69) — a linha do `"week"` passa a mencionar: `scheduled_date` opcional; quando presente, a semana é a de `scheduled_date` (não a corrente) e a origem também recebe esse dia; quando ausente, comportamento idêntico ao pré-existente.
  - [x] 1.3 **Sem mudança em `TaskMigrateSerializer`** (`backend/bujo/serializers.py:141-169`) — `scheduled_date` já é um campo opcional aceito para qualquer `destination` (só não era consumido por `"week"`/`"today"` até agora). Confirmar isso por leitura antes de "adivinhar" que falta validação — não falta.
  - [x] 1.4 **Sem mudança em `TaskMigrateView`** (`backend/bujo/views.py:498-529`) — já repassa `scheduled_date` para `migrate_task` para qualquer destino (linha 525); o gap estava só dentro do serviço.

- [x] **Task 2: Testes de backend** (AC: #3, #4)
  - [x] 2.1 `test_services.py` (perto de `test_migrate_task_destination_week_torna_origem_migrated_e_cria_no_weekly_corrente`, linha 627): novo teste `test_migrate_task_destination_week_com_scheduled_date_deduz_semana_da_data` — task `pending`, `migrate_task(destination="week", scheduled_date=<uma segunda-feira 3 semanas no futuro>)` → `result.status == MIGRATED`; `new_task.weekly_log_id` é o de `get_or_create_weekly_log(week_start=week_start_of(scheduled_date))` (**não** a semana corrente); `new_task.scheduled_date == scheduled_date`.
  - [x] 2.2 Variante com data **passada** (semana anterior à corrente, mas ainda **não** fechada — ex.: só uma tarefa `pending` nela, então `is_container_closed` é `False`): confirma que "antecipar/adiar em qualquer direção" (epics.md linha 868) funciona também para trás, não só para frente.
  - [x] 2.3 Confirmar que `test_migrate_task_destination_week_torna_origem_migrated_e_cria_no_weekly_corrente` (existente, sem `scheduled_date`) **continua passando sem alteração** — é a prova de que o comportamento antigo não regrediu.
  - [x] 2.4 `test_views.py` (perto de `test_post_migrate_destination_week_migra_para_weekly_log_corrente`, linha 1173): novo teste `test_post_migrate_destination_week_com_scheduled_date_migra_para_semana_da_data` via `POST /api/bujo/tasks/{id}/migrate/` com `{"destination": "week", "scheduledDate": "<data>"}` → 200, `weeklyLog` de destino é o da data enviada.
  - [x] 2.5 Novo teste de guardrail (prova que o `create_task`/`ClosedCycleReadOnly` da Story 11.5 já protege este caminho **sem código novo**): montar uma `WeeklyLogFactory` de uma semana passada com **todas** as tarefas `completed`/`cancelled` (container fechado, `is_container_closed` = `True`); migrar uma tarefa `pending` de outro lugar com `scheduled_date` caindo nessa semana → `ClosedCycleReadOnly` (409), `fields` ausente no corpo (mesmo formato dos demais `DomainError`, ver Story 11.5). Ver Dev Notes "Por que o guardrail de ciclo fechado já cobre isso de graça".
  - [x] 2.6 `ruff check . && lint-imports && manage.py check` verdes; **colar contagem real** de `pytest` ao fim (guardrail retro Epic 3 §1).

### Frontend

- [x] **Task 3: Exportar os helpers de data do `MigrationCard` para reuso** (AC: #2)
  - [x] 3.1 Em `frontend/src/features/bujo/components/MigrationCard.tsx`, adicionar `export` em `currentMonthBounds()` (linha 27) e `currentMonthLabel()` (linha 36) — hoje são funções locais não-exportadas. Isso é a **2ª** reutilização (não uma 3ª cópia local) — diferente da linha de "duplicar formatação de dia" já estabelecida em 11.4/11.5 (que trata de pequenos formatadores de exibição espalhados por componentes read-only); aqui é lógica de bounds de decisão reaproveitada entre dois diálogos de migração, então exportar é mais simples e mais seguro que duplicar.

- [x] **Task 4: Novo componente `TaskDestinationDialog`** (AC: #1, #2, #3)
  - [x] 4.1 Criar `frontend/src/features/bujo/components/TaskDestinationDialog.tsx`. Props:
    ```ts
    interface TaskDestinationDialogProps {
      task: Task
      open: boolean
      onClose: () => void
    }
    ```
    **Autocontido** (mesmo padrão do `MoveTaskDialog` já embutido em `TaskRow` para reorder) — usa `useMigrateTaskMutation()` internamente, não recebe a mutation via prop.
  - [x] 4.2 3 modos via `Tabs`/`Tab` do MUI (mesmo padrão de abas já usado em `RecurringTemplateManager.tsx:159-168`, Story 11.2): `'day' | 'thisMonth' | 'future'`, rótulos "Dia" / "Este mês" / "Futuro". Estado local `const [mode, setMode] = useState<'day' | 'thisMonth' | 'future'>('day')`.
  - [x] 4.3 Cabeçalho comum (todas as abas): título/descrição da tarefa + lista de subtarefas, mesmo bloco visual já usado em `MigrationCard.tsx:100-113` (linhas `task.title`/`task.description`/`subtasks.map`) — reaproveitar a mesma estrutura JSX, não inventar um layout novo.
  - [x] 4.4 **Aba "Dia"** — estado local `const [calendarMonthFirst, setCalendarMonthFirst] = useState(<mês corrente, mesmo cálculo de `currentMonthFirst` já duplicado em `MonthlyPage`/`FuturePage`>)`. Botões Prev/Next (setas) para navegar `calendarMonthFirst` ±1 mês — só cálculo de UI, sem chamada nova de backend além do refetch de densidade. `useTaskDensityQuery(calendarMonthFirst, { enabled: open && mode === 'day' })` (mesmo guard `enabled` de `RecurringPlacementDialog.tsx:33`). Renderizar:
    ```tsx
    <MonthDensityCalendar
      monthFirst={calendarMonthFirst}
      densityByDate={densityByDate}
      onSelectDay={(iso) =>
        migrate.mutate(
          { taskId: task.id, destination: 'week', scheduledDate: iso },
          { onSuccess: onClose },
        )
      }
    />
    ```
    **Sem `selectedDate`/passo de confirmação separado** — tocar no dia já move e fecha o diálogo (ligando as props `onSelectDay`/`selectedDate` que a 11.3 deixou reservadas e desligadas — `selectedDate` fica opcional, não é necessário para o fluxo de confirmação imediata desta story).
  - [x] 4.5 **Aba "Este mês"** — `TextField type="date"` com `min`/`max` de `currentMonthBounds()` (Task 3, importado de `MigrationCard`), mesmo padrão de `MigrationCard.tsx:148-154`. `onChange` dispara direto (sem botão "Confirmar" extra, mesmo UX imediata do `MigrationCard`):
    ```ts
    function handleThisMonthChange(event: ChangeEvent<HTMLInputElement>) {
      const value = event.target.value
      if (!value) return
      migrate.mutate({ taskId: task.id, destination: 'month', scheduledDate: value }, { onSuccess: onClose })
    }
    ```
  - [x] 4.6 **Aba "Futuro"** — dois `TextField` (`type="number"` "Dia (opcional)" + `type="month"` "Mês"), **mesmo par de campos e mesma ordem** de `MigrationCard.tsx:170-187`: preencher o dia é opcional e deve vir **antes**, porque selecionar o mês já dispara a submissão (mesma UX pré-existente, não inventar uma UX diferente aqui):
    ```ts
    function handleFutureMonthChange(event: ChangeEvent<HTMLInputElement>) {
      const month = event.target.value
      if (!month) return
      const scheduledDate = futureDay ? `${month}-${futureDay.padStart(2, '0')}` : undefined
      migrate.mutate(
        { taskId: task.id, destination: 'future', monthFirst: `${month}-01`, scheduledDate },
        { onSuccess: onClose },
      )
    }
    ```
  - [x] 4.7 **Erro de mutação:** `{migrate.isError && <Typography color="error" variant="body-sm">Não foi possível mover a tarefa. Tente novamente.</Typography>}` dentro do `Dialog`, sem fechar o diálogo no erro (só no sucesso, via `onSuccess: onClose` em cada `mutate`). **Por que esta story precisa disso e nenhuma mutation anterior do app tinha isso:** ver Dev Notes "Por que exibir erro aqui e não em outro lugar" — é o primeiro fluxo onde um 409 real (`ClosedCycleReadOnly`, Task 2.5) é alcançável por uma ação legítima do usuário (mover para uma semana antiga já fechada), não só um cenário de API-direta/defesa-em-profundidade.
  - [x] 4.8 Fechar via `Dialog`'s `onClose` (backdrop/Esc) e um botão "Cancelar" — nenhuma ação de destino é obrigatória.

- [x] **Task 5: Fiar o "Mover" em `TaskRow`** (AC: #1)
  - [x] 5.1 Em `frontend/src/features/bujo/components/TaskRow.tsx`, adicionar prop `isSubtask?: boolean` (default `false`) — a chamada recursiva de subtarefas (linhas 296-303) passa `isSubtask` (implícito `true` ali, explícito na prop). Estado local `const [destinationDialogOpen, setDestinationDialogOpen] = useState(false)`.
  - [x] 5.2 Novo `IconButton` "Mover tarefa" (`aria-label="Mover tarefa"`, ícone `DriveFileMoveOutlinedIcon` de `@mui/icons-material/DriveFileMoveOutlined` — confirmado existente no pacote instalado), renderizado **sempre** que `!isSubtask` (independente de `isMobile`/`onReorder`/`onOpenDetail` — ao contrário do kebab de reorder, que só existe em Daily Log desktop, o "Mover" vale para **todas** as superfícies, incl. mobile e Futuro). `disabled={status !== 'pending' && status !== 'started'}` — espelha a matriz `ALLOWED` (AD-02): só esses dois estados permitem transicionar para `migrated`/`postponed`; um clique num estado terminal bateria num 409 do backend sem essa checagem client-side.
  - [x] 5.3 **Renomear o `aria-label` do kebab de reorder existente** (linha 263, hoje `"Mover tarefa"`) para `"Reordenar tarefa"` — colisão de nome: com o novo botão desta story, Daily Log passaria a ter **dois** controles rotulados `"Mover tarefa"` na mesma linha (reordenar posição vs. migrar para outro período), o que quebra `getByRole('button', {name: 'Mover tarefa'})` em testes e confunde leitores de tela. O ícone (`MoreVertIcon`) e o comportamento de reorder (`MoveTaskDialog`) **não mudam**, só o texto do rótulo.
  - [x] 5.4 Renderizar `<TaskDestinationDialog task={task} open={destinationDialogOpen} onClose={() => setDestinationDialogOpen(false)} />` dentro de `TaskRow`, mesmo padrão do bloco `{isReorderable && (<MoveTaskDialog .../>)}` já existente — mas **sem** gate de `isReorderable` (o novo diálogo é independente do reorder).
  - [x] 5.5 **Nenhuma mudança de prop nas páginas** — `TaskRow` já recebe `task` em toda chamada existente (`DailyPage`, `WeeklyPage`, `MonthlyPage`, `FuturePage`); o botão "Mover" fica disponível de graça em todas elas, incl. `FuturePage.tsx:158` (`<TaskRow task={task} />`, hoje 100% read-only — ganha "Mover" sem precisar de nenhuma outra prop nova).

- [x] **Task 6: Fiar o "Mover" em `TaskDetailPanel`** (AC: #1)
  - [x] 6.1 Em `frontend/src/features/bujo/components/TaskDetailPanel.tsx`, estado local `const [destinationDialogOpen, setDestinationDialogOpen] = useState(false)`.
  - [x] 6.2 Novo `Button` "Mover tarefa" ao lado do botão excluir/cancelar existente (linha 175-182), dentro do mesmo bloco `{!isSubtask && (...)}`, `disabled={task.status !== 'pending' && task.status !== 'started'}` (mesma regra da Task 5.2).
  - [x] 6.3 Renderizar `<TaskDestinationDialog task={task} open={destinationDialogOpen} onClose={() => setDestinationDialogOpen(false)} />`. Ao mover com sucesso (dentro de `TaskDestinationDialog`, via `onSuccess: onClose`), o `onClose` passado é o do painel de detalhe — **fechar também o `Drawer`**, mesmo raciocínio do botão excluir/cancelar (Story 11.5 Task 9.3): mover é ação terminal para aquela tarefa naquela visão, fechar é o feedback esperado. Concretamente: `<TaskDestinationDialog task={task} open={destinationDialogOpen} onClose={() => { setDestinationDialogOpen(false); onClose() }} />` — o `onClose` do diálogo dispara os dois fechamentos em sequência (dialog + painel).
  - [x] 6.4 **Zero props novas na assinatura de `TaskDetailPanel`** — `DailyPage.test.tsx` que mocka o componente inteiro (Story 11.5 Task 10.5, "sem alteração") continua sem precisar de ajuste.

- [x] **Task 7: Invalidar `taskDensity` em `useMigrateTaskMutation`** (AC: #2)
  - [x] 7.1 Em `frontend/src/features/bujo/api.ts`, no `onSuccess` de `useMigrateTaskMutation` (linhas 369-380), adicionar `queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })` — **gap pré-existente desde a 11.3** (a mutation já cria/reposiciona tarefas via `migrate_task`, mas nunca invalidava a densidade). Não era visível antes porque nenhuma tela reabria o calendário de densidade logo após uma migração; esta story é a primeira a expor o calendário dentro do próprio fluxo de mover (Task 4.4), então uma densidade desatualizada ficaria visível ao reabrir o diálogo para outra tarefa na mesma sessão.

### Testes & Verificação

- [x] **Task 8: Testes de frontend** (AC: #1, #2, #3)
  - [x] 8.1 `TaskDestinationDialog.test.tsx` (novo): aba "Dia" mostra `MonthDensityCalendar` interativo (mockar `useTaskDensityQuery`); clicar num dia chama `useMigrateTaskMutation().mutate({taskId, destination:'week', scheduledDate})` e fecha o diálogo no sucesso; Prev/Next mês trocam `calendarMonthFirst` (novo fetch de densidade); aba "Este mês" — `onChange` da data chama `mutate({destination:'month', scheduledDate})`, bounds `min`/`max` do mês corrente; aba "Futuro" — preencher dia então mês chama `mutate({destination:'future', monthFirst, scheduledDate})`; sem dia, só mês, chama com `scheduledDate: undefined`; erro de mutação (`isError`) mostra a mensagem e **não** fecha o diálogo; `jest-axe` sem violações contra o componente real (nunca mockado — lição recorrente 3.3-11.5).
  - [x] 8.2 `TaskRow.test.tsx`: **atualizar** o teste existente (linha 483-489) de `getByRole('button', {name: 'Mover tarefa'})` para `'Reordenar tarefa'` (Task 5.3) — não é regressão, é o rename esperado. Novos testes: botão "Mover tarefa" (novo) aparece em toda `TaskRow` raiz (mesmo sem `onReorder`/`onOpenDetail`), abre `TaskDestinationDialog`; desabilitado para status `completed`/`cancelled`/`migrated`/`postponed`; **ausente** para subtarefas (`isSubtask=true`, renderizadas via recursão de `task.subtasks`).
  - [x] 8.3 `TaskDetailPanel.test.tsx`: botão "Mover tarefa" abre `TaskDestinationDialog`; desabilitado fora de `pending`/`started`; ausente para `isSubtask`; sucesso da migração fecha diálogo **e** painel (mock de `useMigrateTaskMutation` chamando `onSuccess` manualmente para verificar o encadeamento de `onClose`).
  - [x] 8.4 `MigrationCard.test.tsx`: confirmar que exportar `currentMonthBounds`/`currentMonthLabel` (Task 3) não quebra os testes existentes (são só `export` adicionado a funções já testadas indiretamente via o componente).
  - [x] 8.5 `frontend/src/features/bujo/api.test.tsx`: `useMigrateTaskMutation` — sucesso invalida também `['bujo', 'taskDensity']` (Task 7), além das invalidações já existentes (não removê-las, só adicionar a asserção nova).
  - [x] 8.6 `npm run typecheck && npm run lint && npm run build && npm run test` (Node 22, `--no-file-parallelism` se houver flakiness — lição recorrente 11.2-11.5) verdes; **colar contagem real**.

- [x] **Task 9: Verificação manual (Playwright real, branch `e2e`)** (AC: #1, #2, #3, #4)
  - [x] 9.1 Novo `frontend/e2e/move-task.spec.ts` (nome de fluxo, convenção já usada por `weekly-monthly-task-crud.spec.ts` etc.): mover uma tarefa do Daily Log para um dia específico da semana corrente (via calendário) → aparece em "Esta Semana" naquele dia, some do Daily Log, `status: migrated`; mover uma tarefa de "Esta Semana" para "Este mês" → vira `postponed`, aparece em "Este Mês"; mover uma tarefa de "Este Mês" para "Futuro" (mês seguinte) → aparece em "Futuro"; mover uma tarefa a partir do painel de detalhe (não só do kebab); tentar mover uma tarefa `completed`/`cancelled` → controle desabilitado (sem tentativa de clique bloqueado, só assert de `disabled`); navegar de mês no calendário e mover para um dia de outro mês → semana correta deduzida.
  - [x] 9.2 Zero erros de console em todos os passos.
  - [x] 9.3 **File List por último** (retro Epic 3 §8-2) — reconciliar contra `git status --short`/`git diff --stat` reais, guardrails em `_bmad/custom/bmad-dev-story.toml`.

## Dev Notes

### O que já existe vs. o que é net-new

- **Já existe:** `migrate_task`/`TaskMigrateView`/`TaskMigrateSerializer` completos para os destinos `today`/`week`/`month`/`future`/`cancel` (usados hoje só pelo Fluxo de Migração de fim-de-dia/semana/mês — `MigrationFlow`/`MigrationCard`/`*ReviewBanner`); `MonthDensityCalendar` já construído com props `selectedDate`/`onSelectDay` **reservadas e desligadas** desde a Story 11.3, exatamente para esta story ligar; o `TaskDetailPanel` já tem um botão de ação terminal (excluir/cancelar, Story 11.5) que este story replica o padrão para "Mover".
- **Net-new:** qualquer interatividade em `TaskRow` fora de Daily Log/Weekly/Monthly com `onOpenDetail` (Futuro é 100% read-only hoje, `FuturePage.tsx:158`); o componente `TaskDestinationDialog`; a capacidade de `migrate_task` deduzir a semana de um `scheduled_date` arbitrário (hoje só sabe "semana corrente").

### Por que "hoje" na nova UI não usa `destination='today'`

O destino `"today"` cria a tarefa no container **Daily Log** (`log_id`), que é uma superfície diferente de "Esta Semana" (`weekly_log_id` + `scheduled_date`) — ver AD-03 (`architecture.md:163-185`): `scheduled_date` é "dia opcional **dentro de um weekly/monthly log**", não tem relação com `log_id`. O epics.md desta story é explícito: "posso apontar um dia específico (hoje ou qualquer dia — **o app deduz a semana a partir da data**)" — ou seja, todo dia escolhido pela nova UI vira um placement de **semana** (`destination='week'` + `scheduled_date`), mesmo quando o dia é hoje. Isso é consistente com o precedente já criado pela própria Story 11.5: o formulário de criação de `WeeklyPage` já permite escolher "hoje" como dia da semana e a tarefa nasce em `weekly_log`, não em `log` — a dualidade não é nova, só volta a aparecer aqui. `destination='today'` continua reservado para o Fluxo de Migração de fim-de-dia existente (`MigrationCard` botão 1), que esta story não toca.

### Por que o guardrail de ciclo fechado da Story 11.5 já cobre o cenário de destino fechado, sem código novo

Um weekly_log/monthly_log só fica `closed` (`is_container_closed`, `services/archive.py`) quando **tem tarefa E nenhuma pending/started na subárvore**. A matriz `ALLOWED` (AD-02) só permite transicionar para `migrated`/`postponed` a partir de `pending`/`started` — logo, por construção, **nunca existe** uma tarefa `pending`/`started` dentro de um container já fechado (se existisse, o container não estaria fechado). Isso significa: mover a **origem** de um período fechado é estruturalmente impossível (a tarefa nem apareceria como `pending`/`started` lá). O único cenário real de 409 é o **destino** — o usuário escolhe (via navegação de mês no calendário, Task 4.4) um dia cuja semana já está fechada (todas as tarefas dela já dispostas). Esse caso já é coberto pelo guardrail `_check_container_open` dentro de `create_task` (Story 11.5, `services/tasks.py`), chamado por `_migrate_subtree` → `create_task` sem nenhuma mudança nova — só precisa de um teste que prove isso (Task 2.5) e de UI que não quebre silenciosamente no 409 (Task 4.7).

### Por que exibir erro de mutação só nesta story, e não retroativamente em todo o app

Hoje **nenhuma** mutation do frontend exibe erro ao usuário (confirmado por busca — sem `Snackbar`/toast/`isError` em nenhum componente de `features/bujo`) — os fluxos existentes só alcançam erros de validação (400) via campos de formulário com bounds client-side, nunca um 409 de domínio disparável por uma ação legítima. Esta story é a primeira onde um 409 real (`ClosedCycleReadOnly`) é alcançável por um clique normal do usuário (escolher um dia de uma semana antiga já fechada) — sem feedback, o diálogo pareceria travado. Construir um sistema de notificação global (Snackbar compartilhado) é fora de escopo (ninguém pediu, nenhuma outra tela precisa hoje); a mensagem inline dentro do próprio `TaskDestinationDialog` (Task 4.7) é a solução mínima e localizada ao problema real que esta story introduz.

### Componentes reaproveitados (não reinventar)

- **`MonthDensityCalendar`** (Story 11.3): já pronto para seleção, só faltava alguém ligar `onSelectDay`/`selectedDate`. Reaproveitar exatamente como está — nenhuma mudança no componente em si é esperada; se o desenvolvedor achar necessário mudar a assinatura, é sinal de que a 11.3 não deixou o gancho certo e vale investigar antes de alterar (não esperado).
- **Abas (`Tabs`/`Tab`)**: mesmo padrão já usado por `RecurringTemplateManager.tsx:159-168` (Story 11.2) — não introduzir `ToggleButtonGroup` ou outro padrão de seleção de modo.
- **Pickers de "este mês"/"futuro"**: campos e comportamento (`onChange` dispara direto, sem botão "Confirmar" extra) copiados de `MigrationCard.tsx` — é literalmente a mesma decisão de produto (mover para o mês corrente ou para um mês futuro), só acionada de um lugar novo.
- **`useMigrateTaskMutation`**: já existe e já invalida `todayLog`/`weeklyLog`/`monthlyLog`/`futureLog`/as 3 filas de revisão por prefixo — cobre as 4 superfícies desta story sem nenhuma mudança de invalidação além da densidade (Task 7).

### Não fazer nesta story (fora de escopo, registrado)

- **Sistema de notificação global (Snackbar/toast)** — só a mensagem inline do `TaskDestinationDialog` (ver acima).
- **Desabilitar proativamente, no calendário, os dias cuja semana já está fechada** — exigiria o endpoint de densidade também expor "fechado" por dia, que não existe hoje. Deixar o backend recusar (409) + mensagem inline é suficiente para um cenário raro (mover para trás, para uma semana antiga já 100% disposta).
- **Exibir `migrated_to_task` na UI** (epics.md linha 888) — a contagem `↻ N×` (Story 4.6) já entregue basta.
- **Bucket próprio de "próxima semana"** (epics.md linha 888) — o calendário de dia já cobre qualquer semana, incl. a próxima, sem precisar de um atalho dedicado.
- **Confirmação antes de mover** ("tem certeza?") — mesmo raciocínio já registrado na Story 11.5 (sem padrão de confirm-dialog no projeto; mover é sempre corrigível movendo de novo, ao contrário do hard-delete).

### Previous Story Intelligence (11.5 — done)

- **Stack:** Backend Django + DRF + drf-spectacular + uv/pytest/ruff/lint-imports; Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Sem dependência nova nesta story.
- **Node 22 obrigatório** (`nvm use 22`); `--no-file-parallelism` se houver flakiness de timeout (lição recorrente 11.2-11.5).
- **`jest-axe` só pega violação real contra o componente de verdade** — nunca mockar o componente sob teste de a11y (lição repetida 3.3-11.5). Vale para `TaskDestinationDialog.test.tsx` (Task 8.1) e para os testes de `TaskRow`/`TaskDetailPanel` que agora renderizam esse diálogo real.
- **Mocks de barrel `features/bujo`:** `TaskDestinationDialog` **não** entra no barrel (mesmo padrão de `TaskRow`/`TaskDetailPanel`, que também não estão lá — são importados por caminho relativo direto pelas páginas/pelo outro componente). Nenhum mock de barrel a atualizar por causa disso.
- **Contagem de testes sempre real** (retro Epic 3 §1). **File List por último** (retro Epic 3 §8-2). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.
- **AR-22 (observabilidade) segue pendente, sem dono** — não bloqueia, mas continua sendo o pior follow-through do projeto (escalar antes do Épico 5, conforme memória do projeto).
- **`_check_container_open`** (Story 11.5, `services/tasks.py`) é o nome real do guardrail de ciclo fechado — usar esse nome ao ler/estender o código, não `is_container_closed` sozinho (esse é o helper de leitura em `services/archive.py`, chamado por dentro de `_check_container_open`).

### Git Intelligence

- Branch `main`; HEAD em `2819951` (`feat(story-11.5): CRUD de tarefas em Esta Semana / Este Mês`). Commits do Épico 11 até aqui: `11.1` (cfdc1ae), `11.2` (81ae849), `11.3` (43d1b6e), fix pós-11.3 do lint-imports (f160b0b), `11.4` (61d0806), `11.5` (2819951). Convenção de commit: `feat(story-11.6): <descrição em pt-BR>`.
- `git diff --stat` esperado: `backend/bujo/services/migration.py` (branch `"week"` estendido), `backend/bujo/tests/test_services.py`/`test_views.py` (+testes), `frontend/src/features/bujo/components/MigrationCard.tsx` (+`export` em 2 funções), `frontend/src/features/bujo/components/TaskDestinationDialog.tsx` (+`.test.tsx`, novos), `frontend/src/features/bujo/components/TaskRow.tsx` (+botão "Mover", +prop `isSubtask`, rename de aria-label), `frontend/src/features/bujo/components/TaskDetailPanel.tsx` (+botão "Mover"), `frontend/src/features/bujo/api.ts` (+invalidação `taskDensity` em `useMigrateTaskMutation`), testes correspondentes de cada arquivo tocado, `frontend/e2e/move-task.spec.ts` (novo). **Sem `schema.yaml`/`types.gen.ts`** no diff (AC4 — nenhuma mudança de contrato).

### Project Structure Notes

- **Backend alterado:** `backend/bujo/services/migration.py`, `backend/bujo/tests/test_services.py`, `backend/bujo/tests/test_views.py`. Nenhum arquivo em `backend/*/migrations/`, nenhuma mudança em `serializers.py`/`views.py`/`urls.py`.
- **Frontend novo:** `frontend/src/features/bujo/components/TaskDestinationDialog.tsx` (+`.test.tsx`). **Alterado:** `MigrationCard.tsx` (só `export` adicional), `TaskRow.tsx` (+`.test.tsx`), `TaskDetailPanel.tsx` (+`.test.tsx`), `api.ts` (+`.test.tsx`), `frontend/e2e/move-task.spec.ts` (novo).
- **Fronteiras:** `TaskDestinationDialog` vive em `features/bujo/components`, mesmo padrão dos demais; não é exportado no barrel (consistente com `TaskRow`/`TaskDetailPanel`). Sem nova violação de ESLint boundary/import-linter esperada.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.6 (linhas 864-888 — AC completas, "item #9" de futureIdeas.md, "fora de escopo" já registrado no próprio epic); §Epic 11 (linha 757 — "(6) mover/migrar de qualquer lugar (reusa o calendário da 11.3)")]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-02 (linhas 124-146 — matriz `ALLOWED`, migração só via Fluxo de Migração, `migrated`/`postponed` terminais); #AD-03 (linhas 149-185 — `migrated_to_task_id`/`migration_count`, schema `tasks`, `scheduled_date` como "dia dentro de um weekly/monthly log", generalização Task↔log da Story 4.1)]
- [Source: backend/bujo/services/migration.py (arquivo completo — `migrate_task`/`_migrate_subtree`, branch `"week"` linhas 80-83 a estender, Task 1)]
- [Source: backend/bujo/serializers.py:141-169 (`TaskMigrateSerializer` — `scheduled_date` já opcional para qualquer destino, sem mudança necessária)]
- [Source: backend/bujo/views.py:498-529 (`TaskMigrateView.post` — já repassa `scheduled_date`, sem mudança necessária)]
- [Source: backend/bujo/services/tasks.py (`_check_container_open`, guardrail de ciclo fechado da Story 11.5 — protege `create_task` chamado por `_migrate_subtree`, sem código novo aqui); backend/bujo/services/archive.py:15-22 (`is_container_closed`)]
- [Source: backend/bujo/services/state_machine.py:18-43 (`ALLOWED` — só `pending`/`started` transicionam para `migrated`/`postponed`, base do disable client-side, Task 5.2/6.2)]
- [Source: backend/bujo/tests/test_services.py:559-670 (testes existentes de `migrate_task` — modelo pros testes novos, Task 2); backend/bujo/tests/test_views.py:1013-1193 (testes existentes de `TaskMigrateView`, modelo pra Task 2.4)]
- [Source: frontend/src/features/bujo/components/MonthDensityCalendar.tsx (componente a ligar — props `selectedDate`/`onSelectDay` já existentes e documentadas como reservadas "p/ Story 11.6" no próprio arquivo, linhas 8-17); comentário explícito no topo do arquivo confirma o gancho)]
- [Source: frontend/src/features/bujo/components/MigrationCard.tsx (modelo de UI pros modos "Este mês"/"Futuro" — `currentMonthBounds`/`currentMonthLabel` linhas 27-38 a exportar, Task 3; padrão de bloco título/descrição/subtarefas linhas 100-113 a reaproveitar, Task 4.3; TextFields de "Este mês" linhas 148-154 e "Futuro" linhas 170-187 a espelhar, Task 4.5/4.6)]
- [Source: frontend/src/features/bujo/components/MigrationFlow.tsx (Fluxo de Migração existente — `useMigrateTaskMutation`, `MigrationDestination` — não tocado por esta story, só referência de uso do hook)]
- [Source: frontend/src/features/bujo/components/RecurringTemplateManager.tsx:159-168 (padrão `Tabs`/`Tab` a espelhar, Task 4.2); frontend/src/features/bujo/components/RecurringPlacementDialog.tsx:33 (guard `enabled: open` em `useTaskDensityQuery`, mesmo padrão pra Task 4.4)]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx (componente a estender — kebab de reorder existente linhas 259-273, `MoreVertIcon`/"Mover tarefa" a renomear pra "Reordenar tarefa" Task 5.3; `MoveTaskDialog` embutido linhas 282-293, mesmo padrão de diálogo autocontido pro `TaskDestinationDialog`, Task 5.4; recursão de subtarefas linhas 294-305, base pra prop `isSubtask`, Task 5.1)]
- [Source: frontend/src/features/bujo/components/TaskRow.test.tsx:483-494 (teste existente que quebra com o rename do Task 5.3 — atualizar, não é regressão, Task 8.2)]
- [Source: frontend/src/features/bujo/components/TaskDetailPanel.tsx (botão excluir/cancelar Story 11.5 linhas 175-182, modelo pro botão "Mover", Task 6.2; `!isSubtask` gate linha 164, mesmo padrão)]
- [Source: frontend/src/features/bujo/api.ts:351-382 (`useMigrateTaskMutation`/`MigrationDestination` — invalidações existentes a preservar + `taskDensity` a adicionar, Task 7)]
- [Source: frontend/src/pages/planner/FuturePage.tsx:158 (`<TaskRow task={task} />` 100% read-only hoje — ganha "Mover" de graça via Task 5, sem mudança nesta página); frontend/src/pages/daily/DailyPage.tsx:86-93 (`TaskRow` com `onReorder`/`siblings` — único lugar com os dois kebabs simultâneos, prova real da colisão de nome resolvida na Task 5.3)]
- [Source: _bmad-output/implementation-artifacts/11-5-crud-de-tarefas-em-esta-semana-este-mes.md (padrão de botão terminal em `TaskDetailPanel` + `onSuccess: onClose`; `_check_container_open`; Node 22 + `--no-file-parallelism`; File List por último)]
- [Source: _bmad-output/implementation-artifacts/11-3-placement-de-recorrentes-dedup-e-calendario-de-densidade.md (Dev Notes "AC2/AC3 — Densidade e o componente de calendário" — o próprio texto já anuncia que a seleção é o gancho de reuso desta story; `useTaskDensityQuery` padrão de invalidação por prefixo)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 (contagem real de testes), §8 (File List por último) — guardrails em `_bmad/custom/bmad-dev-story.toml`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (dev-story)

### Debug Log References

- `frontend/e2e/move-task.spec.ts` sob `npx playwright test` com paralelismo default (múltiplos workers) apresentou 3 falhas por timeout (dialog não fechava a tempo / requests lentas) contra a branch Neon `e2e`; reexecutado com `--workers=1` (mesma fricção de cold-start documentada na retro do Épico 4, ação #4) → **6/6 passed**. Reexecuções individuais dos 3 testes "falhos" também passaram isoladas, confirmando contenção de rede/DB sob paralelismo, não bug de produto.
- ESLint (`react-refresh/only-export-components`) acusou as duas funções exportadas de `MigrationCard.tsx` (Task 3.1) — resolvido com `eslint-disable-next-line` pontual em cada export (mover para um arquivo à parte por 2 helpers pequenos seria over-engineering para o escopo desta story).

### Completion Notes List

- Backend: `migrate_task` (`services/migration.py`) branch `"week"` estendido para deduzir `week_start_of(scheduled_date)` quando presente, preservando o comportamento pré-existente (semana corrente) quando ausente — nenhuma mudança em `TaskMigrateSerializer`/`TaskMigrateView` (confirmado por leitura, já repassavam `scheduled_date`). Guardrail de ciclo fechado (`_check_container_open`, Story 11.5) protege o novo caminho sem código novo — só precisou de teste provando isso.
- Frontend: novo `TaskDestinationDialog` (3 abas — Dia/Este mês/Futuro) reaproveitando `MonthDensityCalendar` (11.3, props `selectedDate`/`onSelectDay` agora ligadas) e os padrões de picker do `MigrationCard` (helpers `currentMonthBounds`/`currentMonthLabel` exportados). Fiado em `TaskRow` (botão "Mover tarefa" sempre visível em linhas raiz, independente de `onReorder`/`onOpenDetail`/mobile) e em `TaskDetailPanel` (botão equivalente, fecha diálogo + painel em sequência no sucesso). Kebab de reorder existente renomeado de "Mover tarefa" para "Reordenar tarefa" (Task 5.3) para eliminar a colisão de nome com o novo botão — mesmo ícone/comportamento, só o rótulo mudou. Gap pré-existente desde a 11.3 corrigido de graça: `useMigrateTaskMutation` agora também invalida `['bujo', 'taskDensity']`.
- Testes atualizados por causa do rename do Task 5.3 (não são regressão): `TaskRow.test.tsx`, `DailyPage.test.tsx`, `WeeklyPage.test.tsx`, `MonthlyPage.test.tsx` — os dois últimos também ganharam um teste novo confirmando que "Mover tarefa" aparece mesmo sem `onReorder` (comportamento novo desta story).
- Contagens reais coladas (guardrail retro Epic 3 §1): Backend `pytest` **360 passed** (`ruff check` limpo, `lint-imports` 1 kept/0 broken, `manage.py check` 0 issues). Frontend `npm run typecheck`/`npm run lint`/`npm run build` limpos; `vitest run --no-file-parallelism` **471 passed** (45 arquivos). Playwright (`branch e2e`, `frontend/e2e/move-task.spec.ts`, novo): **6/6 passed** com `--workers=1`; zero erros de console em todos os passos.
- Sem alteração em `schema.yaml`/`types.gen.ts` (AC4 — nenhuma mudança de contrato, confirmado: nenhum campo/endpoint novo).

### File List

**Backend:**
- `backend/bujo/services/migration.py` — branch `"week"` de `migrate_task` deduz semana de `scheduled_date` quando presente; docstring atualizado
- `backend/bujo/tests/test_services.py` — 2 novos testes (`scheduled_date` futuro e passado, dedução de semana)
- `backend/bujo/tests/test_views.py` — 2 novos testes (`POST /migrate/` com `scheduledDate` para `"week"`; guardrail de ciclo fechado no destino, 409 só com `detail`)

**Frontend:**
- `frontend/src/features/bujo/components/MigrationCard.tsx` — `export` em `currentMonthBounds`/`currentMonthLabel` (reuso)
- `frontend/src/features/bujo/components/TaskDestinationDialog.tsx` — novo componente (3 abas: Dia/Este mês/Futuro); prop `onSuccess` adicionada na review (ver Change Log) para separar "sucesso da mutação" de "fechar/cancelar"
- `frontend/src/features/bujo/components/TaskDestinationDialog.test.tsx` — novo (12 testes, incl. jest-axe)
- `frontend/src/features/bujo/components/TaskRow.tsx` — prop `isSubtask`, botão "Mover tarefa", rename do kebab de reorder para "Reordenar tarefa", renderização de `TaskDestinationDialog`
- `frontend/src/features/bujo/components/TaskRow.test.tsx` — atualização do teste do rename + novos testes do botão "Mover tarefa"
- `frontend/src/features/bujo/components/TaskDetailPanel.tsx` — botão "Mover tarefa" + `TaskDestinationDialog`, `onClose`/`onSuccess` separados (fix na review — ver Change Log)
- `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx` — novos testes do botão "Mover tarefa" + teste de regressão (cancelar não fecha o painel)
- `frontend/src/features/bujo/api.ts` — `useMigrateTaskMutation` invalida também `['bujo', 'taskDensity']`
- `frontend/src/features/bujo/api.test.tsx` — asserção nova da invalidação de `taskDensity`
- `frontend/src/pages/daily/DailyPage.test.tsx` — assert do teste de reorder atualizado para `'Reordenar tarefa'` (rename, não regressão)
- `frontend/src/pages/planner/WeeklyPage.test.tsx` — assert atualizado para `'Reordenar tarefa'` + novo teste de que "Mover tarefa" aparece sem `onReorder`
- `frontend/src/pages/planner/MonthlyPage.test.tsx` — assert atualizado para `'Reordenar tarefa'` + novo teste de que "Mover tarefa" aparece sem `onReorder`
- `frontend/e2e/move-task.spec.ts` — novo spec e2e (6 testes)

**Sem alteração (verificado, não precisou de mudança):**
- `backend/bujo/serializers.py` (`TaskMigrateSerializer`) — `scheduled_date` já era opcional para qualquer `destination`
- `backend/bujo/views.py` (`TaskMigrateView`) — já repassava `scheduled_date` para `migrate_task`

**Contrato:** sem alteração em `schema.yaml`/`frontend/src/api/types.gen.ts` (AC4).

## Senior Developer Review (AI)

**Reviewer:** Hugo (story-automator-review) · **Data:** 2026-07-15

**Escopo:** validação adversarial de AC1-AC4, auditoria de tasks marcadas `[x]`, leitura de todos os arquivos do File List, contagens reais re-executadas (backend `pytest --reuse-db`: 360 passed; frontend `vitest --no-file-parallelism`: 471 passed antes da correção, 474 depois; `ruff check`: limpo; `npm run typecheck`/`lint`: limpos).

**Achado corrigido (HIGH):** `TaskDetailPanel.tsx` encadeava o `onClose` do `TaskDestinationDialog` diretamente no `onClose` do painel (Task 6.3). Como o `Dialog` interno chama seu próprio `onClose` tanto no cancelamento (botão "Cancelar", backdrop, Esc) quanto — via `onSuccess` de cada `migrate.mutate` — no sucesso, o efeito real era: **cancelar o diálogo de destino fechava o painel de detalhe inteiro**, não só o diálogo, contradizendo a intenção declarada nos próprios Dev Notes ("ao mover **com sucesso**... fechar também o Drawer"). Corrigido adicionando uma prop `onSuccess` dedicada em `TaskDestinationDialog` — `onClose` volta a fechar só o diálogo (cancelar/backdrop/Esc); `onSuccess` (opcional) é chamado apenas quando a mutação de mover tem sucesso, e é isso que `TaskDetailPanel` agora usa para fechar o painel. `TaskRow` não precisa de `onSuccess` (não tem nada externo a fechar). Testes de regressão adicionados em `TaskDestinationDialog.test.tsx` (2 novos) e `TaskDetailPanel.test.tsx` (1 novo, prova que cancelar não fecha o painel).

**Achado corrigido (LOW):** docstring de `migrate_task` (`backend/bujo/services/migration.py`) descrevia o destino `"week"` com `scheduled_date` dizendo "origem também recebe esse dia" — terminologia enganosa, já que é o **novo registro** (destino da migração) que nasce com `scheduled_date`, não a tarefa de origem (que só transiciona de status). Reformulado para deixar isso explícito.

**Verificado sem alterações necessárias:** ACs 1-4 implementadas e testadas de ponta a ponta (backend + componente + e2e); guardrail de ciclo fechado (`_check_container_open`) coberto por teste HTTP real (409, sem `fields`); nenhuma duplicação de endpoint/serializer; contagens de teste batem com o que a story reivindicava.

**Outcome:** Approved com correções aplicadas. Status → done.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-15 | 0.1 | Implementação da Story 11.6: `migrate_task` estendido (destino `"week"` deduz a semana de `scheduled_date` quando presente, comportamento pré-existente preservado quando ausente); novo `TaskDestinationDialog` (3 abas — Dia/Este mês/Futuro) ligando `MonthDensityCalendar` (11.3) e reaproveitando os pickers do `MigrationCard`; botão "Mover tarefa" fiado em `TaskRow` (todas as superfícies) e `TaskDetailPanel`; kebab de reorder renomeado para "Reordenar tarefa" (elimina colisão de nome); gap de invalidação de `taskDensity` em `useMigrateTaskMutation` corrigido de graça. Backend 360 passed, Frontend 471 passed, Playwright 6/6 (branch `e2e`, `--workers=1` — paralelismo default sofre contenção de rede contra a branch Neon, mesma fricção da retro do Épico 4). Sem mudança de contrato (AC4). Status → review. | Amelia (dev-story) |
| 2026-07-15 | 0.2 | Code review (story-automator-review): corrigido bug HIGH em `TaskDetailPanel` (cancelar o `TaskDestinationDialog` fechava indevidamente o painel inteiro — `onClose`/`onSuccess` separados) e clareado docstring de `migrate_task` (LOW). Re-executado: backend 360 passed, frontend 474 passed (+3 testes de regressão), `ruff check`/`typecheck`/`lint` limpos. Status → done. | Claude (story-automator-review) |
