---
baseline_commit: 91b7bd3
---

# Story 11.10: Seletor Mover/Migrar completo (abas Hoje / Semana / Mês / Futuro, botão explícito)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero um seletor de mover/migrar com destinos claros (Hoje/Esta semana/Este mês/Futuro) e uma ação de confirmar explícita,
Para que eu reorganize o "quando" de qualquer tarefa com controle — incluindo trazer para o Daily Log de hoje — sem disparos acidentais.

Reformula o seletor entregue pela Story 11.6 (`TaskDestinationDialog`), absorve o destino "Hoje" que estava planejado à parte, e corrige o bug relatado de o seletor não funcionar quando aberto a partir de Esta Semana.

## Acceptance Criteria

### AC1 — Seletor com 4 destinos, título "Migrar Tarefa" e informações da tarefa

- **Dado que** o seletor de mover (`TaskDestinationDialog`) é aberto para uma tarefa `pending`/`started`,
- **Então** o título do diálogo é **"Migrar Tarefa"** (não mais "Mover tarefa"), e ele mostra as informações da tarefa: título, descrição (se houver) e a data atual (`task.scheduledDate`, se houver — ver Dev Notes "Escopo de 'onde ela está hoje'" sobre por que não é o nome da superfície).
- **E** há quatro abas de destino: **Hoje**, **Esta semana**, **Este mês**, **Futuro**.
- **Dado que** a aba **Hoje**,
- **Então** ao confirmar, a tarefa vai para o **Daily Log de hoje** (`destination: 'today'`, container `log`) — reusa o destino que hoje só o Fluxo de Migração de fim-de-dia aciona; sem endpoint/coluna novos.
- **Dado que** a aba **Esta semana**,
- **Então** mostra o `MonthDensityCalendar` (Story 11.3); posso escolher um **dia específico** (→ `destination: 'week'`, `scheduledDate`) **ou**, sem escolher dia, confirmar para alocar na **semana corrente sem data** (→ `destination: 'week'` sem `scheduledDate` — backend já suporta isso hoje, ver `migrate_task`/testes existentes).
- **Dado que** a aba **Este mês**,
- **Então** mostra o **mesmo `MonthDensityCalendar`** da aba "Esta semana" (mês corrente, com densidade + o destaque de hoje/semana corrente da Task 3); posso escolher um **dia específico** (→ `destination: 'month'`, `scheduledDate`) **ou**, sem escolher dia, confirmar para alocar no **mês corrente sem data** (→ `destination: 'month'` sem `scheduledDate` — **requer o ajuste de backend da Task 1**, ver Dev Notes). Difere de "Esta semana" só no alvo do submit: o balde é o **mês** (`destination: 'month'`) e o fallback sem dia é "mês corrente sem data" (vs "semana corrente sem data"). Fonte da decisão: `docs/futureIdeas.md:32` (calendário de densidade também para "Este mês"), confirmada pelo Hugo — ver Dev Notes "Por que 'Este mês' usa o calendário de densidade".
- **Dado que** a aba **Futuro**,
- **Então** o comportamento é o mesmo já existente (dia opcional + mês obrigatório, `destination: 'future'`).

### AC2 — Confirmação explícita: só o botão "Migrar" dispara a ação

- **Dado que** qualquer aba,
- **Quando** preencho ou seleciono um valor (dia num dos calendários — Esta semana **ou** Este mês —, dia/mês nos `TextField`s de Futuro),
- **Então** **nada é migrado ainda** — o valor só fica marcado/preenchido localmente (calendário: dia clicado fica destacado, reusando o `selectedDate` do `MonthDensityCalendar`).
- **Quando** clico no botão **"Migrar"**,
- **Então** a mutação dispara com os valores atuais da aba ativa (ou sem `scheduledDate`, se nenhum dia foi escolhido nas abas Esta semana/Este mês).
- **Dado que** a aba **Futuro**,
- **Então** o botão "Migrar" fica desabilitado até o mês ser preenchido (campo obrigatório, igual à validação já existente).
- **Escopo:** este reversão do auto-fire vale **só para este seletor** (`TaskDestinationDialog`). O `MigrationCard`/Fluxo de Migração de fim-de-dia (`MigrationFlow`) **não muda** — mantém a confirmação automática dos pickers (UX-DR3 inalterado).

### AC3 — Calendário: destaca hoje/semana atual; clique preenche, não migra

- **Dado que** o `MonthDensityCalendar` — usado tanto na aba "Esta semana" **quanto** na aba "Este mês" (mesmo componente, mesmo destaque),
- **Então** destaca visualmente **o dia de hoje** e **os dias da semana corrente** (mesmo mês exibido) — distinto do destaque de "dia selecionado" (`action.selected`) já existente.
- **Quando** clico num dia (em qualquer uma das duas abas com calendário),
- **Então** o estado local do dia escolhido é preenchido (`selectedDate` na aba "Esta semana"; `monthDate` na aba "Este mês") — **não** dispara a migração (comportamento revisto da Story 11.6, que migrava direto no clique).

### AC4 — Funciona em Esta Semana (corrige o bug relatado da 11.6)

- **Dado que** uma tarefa na tela **Esta Semana**,
- **Quando** aciono "Mover tarefa" (kebab/botão do `TaskRow` ou do `TaskDetailPanel`),
- **Então** o seletor abre e a migração funciona ponta-a-ponta (calendário, "Este mês" e "Futuro") — sem o bug relatado (`docs/futureIdeas.md:28`, "O modal de migração não está funcionando em Esta Semana"). Ver Dev Notes "O bug relatado na Esta Semana — diagnóstico necessário" — a causa raiz não estava clara por leitura de código; a reescrita desta story deve fechar a lacuna, mas **precisa de verificação e cobertura de teste dedicadas** (não existe hoje nenhum teste, unitário ou e2e, que exercite abrir o calendário/clicar um dia a partir de uma tarefa **originada** em Esta Semana).

### AC5 — Estado e linhagem mantidos; sem mudança de contrato além do já existente

- **Dado que** a movimentação confirmada (qualquer aba),
- **Então** a regra de estado atual se mantém: destino Hoje/dia dentro de semana → origem vira `migrated`; destino mês/futuro → origem vira `postponed`; alocar **sem data** segue a regra do destino (semana sem data → ainda `migrated`; mês sem data → ainda `postponed`) — comportamento já garantido pelo `migrate_task` de hoje (ver Dev Notes).
- **E** `migration_count`/`migrated_to_task` incrementam exatamente como já ocorre (Story 4.6/11.6) — nenhuma tabela/coluna nova.
- **E** `schema.yaml`/`frontend/src/api/types.gen.ts` **não** precisam de regeneração — `scheduled_date` já é opcional no contrato para qualquer `destination` (o ajuste da Task 1 é só de validação de negócio na camada de serialização, não de forma do payload).

### AC6 — Sem regressão

- **Dado que** o `MigrationCard`/`MigrationFlow` (Fluxo de Migração de fim-de-dia/semana/mês),
- **Então** continuam idênticos — nenhuma mudança neste componente (só `TaskDestinationDialog` é reformulado).
- **Dado que** os testes de a11y (jest-axe) do `TaskDestinationDialog`/`TaskRow`/`TaskDetailPanel`,
- **Então** seguem verdes contra os componentes reais.

## Tasks / Subtasks

> **Escopo real:** 1 ajuste cirúrgico de backend (Task 1 — remove uma validação que hoje bloqueia "mês sem data") + extensão do `MonthDensityCalendar` com destaque de hoje/semana atual (Task 3) + reescrita do `TaskDestinationDialog` (Task 4) + atualização de 7 referências ao título antigo do diálogo (Task 5) + investigação/cobertura do bug relatado em Esta Semana (Task 6). **Sem migração de banco, sem endpoint novo, sem campo novo.**

### Backend

- [x] **Task 1: Permitir `destination: "month"` sem `scheduled_date` (mês sem data)** (AC1, AC5)
  - [x] 1.1 **Achado desta análise, corrige uma premissa errada do sprint-change-proposal:** hoje `TaskMigrateSerializer.validate()` (`backend/bujo/serializers.py:146-151`) **exige** `scheduled_date` quando `destination == "month"`, retornando 400 sem ele (provado pelo teste existente `test_post_migrate_destination_month_sem_scheduled_date_retorna_400`, `backend/bujo/tests/test_views.py:1034-1044`). O serviço `migrate_task` (`backend/bujo/services/migration.py:92-95`) **já** aceita `scheduled_date=None` para `"month"` sem problema (o branch `else` não distingue "month" de "future" e `root_scheduled_date = scheduled_date`, que pode ser `None`) — a restrição é **só** da camada de serializer/validação HTTP, não do domínio. Remover o bloco `if destination == "month" and not attrs.get("scheduled_date"): raise ...` (linhas 147-151) — `"month"` passa a se comportar, quanto a `scheduled_date`, exatamente como `"week"` já se comporta hoje (opcional).
  - [x] 1.2 **Nenhuma mudança em `TaskMigrateView`** (`backend/bujo/views.py:498-529`) — já força `month_first = current_month_first` para `destination == "month"` independente do que o cliente manda (linha 508-509) e já repassa `scheduled_date` (linha 525); nada a mudar ali.
  - [x] 1.3 Atualizar o docstring de `migrate_task` (`backend/bujo/services/migration.py:68-70`, branch `"month"`) — remover "scheduled_date obrigatório", já que passa a ser opcional (mesma redação do branch `"week"`, linhas 62-67).
  - [x] 1.4 **Sem impacto de `schema.yaml`/`types.gen.ts`** — `scheduled_date` já é campo opcional no schema OpenAPI (`TaskMigrateSerializer.scheduled_date = DateField(required=False, allow_null=True)`); a mudança é só na função `validate()`, que não aparece no schema gerado.

- [x] **Task 2: Testes de backend** (AC1, AC5)
  - [x] 2.1 Em `backend/bujo/tests/test_views.py`, **substituir** `test_post_migrate_destination_month_sem_scheduled_date_retorna_400` (linhas 1034-1044) por um teste que prove o novo comportamento — modelo: `test_post_migrate_destination_week_migra_para_weekly_log_corrente` (linhas 1172-1192). Nome sugerido: `test_post_migrate_destination_month_sem_scheduled_date_postpoe_no_monthly_corrente`. Asserta: `POST` com `{"destination": "month"}` (sem `scheduledDate`) → 200, `status == "postponed"`, o novo registro está no `monthly_log` do **mês corrente** com `scheduled_date is None`.
  - [x] 2.2 Em `backend/bujo/tests/test_services.py`, estender a cobertura de `migrate_task(destination="month", ...)` para o caso sem `scheduled_date` — mesmo padrão de `test_migrate_task_destination_future_com_e_sem_scheduled_date` (linhas 719-744, que já cobre "future" com e sem data lado a lado). Pode ser um novo teste dedicado ou uma extensão do existente `test_migrate_task_destination_month_torna_origem_postponed_e_cria_no_monthly_corrente` (linha 696) com um segundo caso sem data. Asserta `new_task.scheduled_date is None` e `new_task.monthly_log_id` igual ao do mês corrente.
  - [x] 2.3 `ruff check . && lint-imports && manage.py check` verdes; **colar contagem real** de `pytest` ao fim (guardrail retro Epic 3 §1). Baseline de sanidade (11.9): **360 passed** — esta story só adiciona 1-2 testes, backend não muda em mais nada. **Contagem real observada (execução final, sem escopo por caminho): 364 passed, 1 warning in 1038.09s.** +4 vs baseline (2 testes da Task 2 + 2 testes de regressão do bug fix da Task 6 — ver Dev Notes).

### Frontend — Calendário: destaque de hoje/semana atual

- [x] **Task 3: Estender `MonthDensityCalendar` com destaque de "hoje" e "semana atual"** (AC3)
  - [x] 3.1 Em `frontend/src/features/bujo/components/MonthDensityCalendar.tsx`, calcular "hoje" via `new Date()` **dentro do componente** (mesmo padrão de cálculo-de-UI-não-autoridade-de-domínio já usado por `currentMonthFirst()`/`currentMonthBounds()`/`currentMonthLabel()` em `TaskDestinationDialog.tsx`/`MigrationCard.tsx` — **não** adicionar prop `todayIso` nem depender de fetch/contexto).
  - [x] 3.2 Calcular a semana corrente com a **mesma técnica Monday-based** já usada no próprio arquivo (`leadingBlanks = (first.getDay() + 6) % 7`, linha 48) — para cada dia renderizado, determinar se cai na mesma semana Seg-Dom de "hoje".
  - [x] 3.3 **Design testável (evitar o erro da 11.9 de depender só de `sx`/sem sinal estável):** marcar a célula de "hoje" com um atributo estável, ex. `data-today="true"`, e as células da semana corrente com `data-current-week="true"`, além do estilo visual (`sx`) — não depender só de cor/`bgcolor` para o teste (jsdom não computa estilo de tema de forma confiável; um atributo é barato e determinístico). Sugestão visual: contorno (`border`) ou peso de fonte para "hoje" (distinto do `bgcolor: 'action.selected'` já usado para o dia **selecionado**, já que os dois podem coincidir — hoje pode ser o dia selecionado ao mesmo tempo, os dois sinais precisam conviver sem se cancelar); fundo sutil diferente (ex. `action.hover` ou `action.focus`) para a linha/semana corrente.
  - [x] 3.4 **Sem mudança nas props existentes** (`monthFirst`, `densityByDate`, `selectedDate`, `onSelectDay`) — só adiciona o destaque interno, backward-compatible com o uso atual em `RecurringPlacementDialog` (informativo) e no `TaskDestinationDialog`. O destaque é **do componente**, então ele vale automaticamente para **as duas** abas com calendário do `TaskDestinationDialog` — "Esta semana" (Task 4.5) **e** "Este mês" (Task 4.6) — sem trabalho extra por aba.
  - [x] 3.5 Testes em `MonthDensityCalendar.test.tsx`: usar `vi.useFakeTimers()`/`vi.setSystemTime()` para fixar "hoje" numa data conhecida dentro do `monthFirst` renderizado, então assertar `data-today`/`data-current-week` nas células esperadas (e ausência nas demais). `sem violações de acessibilidade (jest-axe)` já existente deve continuar verde.

### Frontend — Reescrita do `TaskDestinationDialog`

- [x] **Task 4: 4 abas (Hoje/Esta semana/Este mês/Futuro) + confirmação explícita** (AC1, AC2, AC3, AC5)
  - [x] 4.1 Em `frontend/src/features/bujo/components/TaskDestinationDialog.tsx`, renomear `DialogTitle` de "Mover tarefa" para **"Migrar Tarefa"** (linha 97) — isso também renomeia o nome acessível do `Dialog` (MUI associa `aria-labelledby` ao `DialogTitle` automaticamente), então **todo teste/e2e que usa `getByRole('dialog', {name: 'Mover tarefa'})` quebra e precisa ser atualizado para `'Migrar Tarefa'`** — ver Task 5 para a lista completa dos 7 pontos.
  - [x] 4.2 Trocar `DestinationMode` de `'day' | 'thisMonth' | 'future'` para `'today' | 'week' | 'month' | 'future'`, e os `Tab`s (linhas 119-123) para rótulos "Hoje" / "Esta semana" / "Este mês" / "Futuro", nessa ordem. Estado inicial `mode` = `'today'` (primeira aba, reflete o novo destaque do destino "Hoje" que esta story introduz).
  - [x] 4.3 **Bloco de informações da tarefa** (linhas 99-117, já existe): manter título/descrição/subtarefas; **acrescentar** a data atual quando houver (`task.scheduledDate && <Typography variant="body-sm" color="text.secondary">Atualmente: {formatação DD/MM}</Typography>` — reusar alguma formatação de data local já existente no projeto, ex. o padrão de `WeeklyPage.formatDaySelectLabel`/`DayHeader`, sem introduzir lib nova). Ver Dev Notes "Escopo de 'onde ela está hoje'" — não é o nome da superfície (Daily/Semana/Mês/Futuro), só a data, porque o tipo `Task` não carrega o container atual.
  - [x] 4.4 **Aba "Hoje" (nova):** sem calendário/campo — só um texto curto confirmando o destino (ex. "Mover para o Daily Log de hoje."). Nenhum estado local novo.
  - [x] 4.5 **Aba "Esta semana" (renomeada de "Dia"):** mesmo `MonthDensityCalendar` com navegação Prev/Next de mês (linhas 126-150, mantidas), mas o `onSelectDay` **não migra mais direto** — só `setSelectedDate(iso)` (novo estado local `const [selectedDate, setSelectedDate] = useState<string | null>(null)`). Passar `selectedDate={selectedDate}` ao `MonthDensityCalendar` (prop já existente, hoje não usada por este componente) para o destaque visual do dia escolhido. Considerar clique no mesmo dia já selecionado como toggle (desseleciona → volta ao estado "sem dia") — não obrigatório pela AC, mas é o caminho mais simples para o usuário voltar a "semana sem data" sem um controle extra.
  - [x] 4.6 **Aba "Este mês" (mesmo `MonthDensityCalendar` da aba "Esta semana" — ver Dev Notes "Por que 'Este mês' usa o calendário de densidade"):** substituir o antigo `TextField type="date"` (linhas 152-160) pelo mesmo `MonthDensityCalendar` da Task 4.5, com seu **próprio** estado local de dia escolhido (novo estado `const [monthDate, setMonthDate] = useState('')`, `''` = sem dia = "mês sem data"). O `onSelectDay` **não migra direto** — só `setMonthDate(iso)`; passar `selectedDate={monthDate || null}` ao calendário para o destaque do dia escolhido. Fixar o mês no **mês corrente** (`currentMonthFirst()`) — o balde de destino é sempre o mês corrente (a `TaskMigrateView` já força `month_first = current_month_first` para `destination == "month"`, Task 1.2), então a navegação Prev/Next de mês da aba "Esta semana" **não** se aplica aqui; renderizar só o mês corrente com densidade. Reusar `currentMonthBounds()`/`currentMonthLabel()`/`currentMonthFirst()` já exportados (Dev Notes "Componentes reaproveitados"). Considerar clique no mesmo dia já escolhido como toggle (desseleciona → volta a "mês sem data"), espelhando a Task 4.5. O destaque de hoje/semana corrente (Task 3) vem de graça por ser do próprio componente.
  - [x] 4.7 **Aba "Futuro":** os dois `TextField`s (linhas 162-181) deixam de disparar `migrate.mutate` no `onChange` do mês — só atualizam estado local (`futureDay` já existe; adicionar `const [futureMonth, setFutureMonth] = useState('')`).
  - [x] 4.8 **Botão "Migrar"** (novo, em `DialogActions` ao lado de "Cancelar"): `onClick` lê o `mode` atual e chama `migrate.mutate(...)` com os campos daquela aba:
    ```ts
    function handleConfirm() {
      if (mode === 'today') {
        migrate.mutate({ taskId: task.id, destination: 'today' }, { onSuccess: handleMoveSuccess })
      } else if (mode === 'week') {
        migrate.mutate(
          { taskId: task.id, destination: 'week', scheduledDate: selectedDate ?? undefined },
          { onSuccess: handleMoveSuccess },
        )
      } else if (mode === 'month') {
        migrate.mutate(
          { taskId: task.id, destination: 'month', scheduledDate: monthDate || undefined },
          { onSuccess: handleMoveSuccess },
        )
      } else {
        if (!futureMonth) return
        const scheduledDate = futureDay ? `${futureMonth}-${futureDay.padStart(2, '0')}` : undefined
        migrate.mutate(
          { taskId: task.id, destination: 'future', monthFirst: `${futureMonth}-01`, scheduledDate },
          { onSuccess: handleMoveSuccess },
        )
      }
    }
    ```
    `disabled={mode === 'future' && !futureMonth}` (único caso com campo obrigatório — espelha a validação já existente no backend/`MigrationCard`).
  - [x] 4.9 **Trocar de aba não reseta os estados das outras** (ex. ir de "Esta semana" com um dia selecionado para "Futuro" e voltar não deve perder a seleção) — comportamento natural de manter os `useState` separados por aba, nenhuma limpeza especial necessária.
  - [x] 4.10 `migrate.isError` (linhas 184-188) e o botão "Cancelar" (linha 191) seguem exatamente como estão.

### Frontend — Corrigir referências ao título antigo do diálogo

- [x] **Task 5: Atualizar as 7 referências a `getByRole('dialog', {name: 'Mover tarefa'})`** (regressão de teste esperada pela Task 4.1, não é bug novo)
  - [x] 5.1 `frontend/src/features/bujo/components/TaskRow.test.tsx:606`
  - [x] 5.2 `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx:290,332`
  - [x] 5.3 `frontend/e2e/move-task.spec.ts:36,76,116,153,205` (5 ocorrências)
  - [x] 5.4 Todas trocam `{ name: 'Mover tarefa' }` → `{ name: 'Migrar Tarefa' }`. **Não** mudar o `aria-label`/texto do botão que abre o diálogo (`IconButton` em `TaskRow.tsx:293` e `Button` em `TaskDetailPanel.tsx:191`, ambos "Mover tarefa") — a AC só pede o título do **diálogo**, não do botão que o abre; manter os dois rótulos distintos é aceitável e não gerado confusão (botão = ação de abrir; título do diálogo = nome da tela).

### Frontend — Diagnóstico e correção do bug relatado em Esta Semana

- [x] **Task 6: Investigar e cobrir o bug "modal de migração não funciona em Esta Semana"** (AC4)
  - [x] 6.1 **Antes de assumir que a reescrita resolve de graça:** reproduzir manualmente (dev server) o fluxo relatado — abrir "Esta Semana", clicar "Mover tarefa" numa tarefa daquela tela, tentar migrar via calendário. Por leitura de código (`TaskRow.tsx`, `WeeklyPage.tsx`), o botão "Mover tarefa" já renderiza incondicionalmente para linhas raiz (`!isSubtask`) em todas as superfícies desde a 11.6, e `TaskDestinationDialog` é autocontido — nenhuma causa raiz óbvia foi encontrada por leitura estática. **Se o bug persistir após a Task 4**, investigar further antes de declarar concluído (não assumir que "reescrever resolve"). **Resultado:** reproduzido via e2e real (não frontend) — root cause era backend (`_migrate_subtree` fechava o próprio container de destino antes de inserir a nova tarefa quando origem == destino); ver Dev Notes "Root cause encontrada" e fix em `backend/bujo/services/migration.py`.
  - [x] 6.2 **Lacuna de cobertura confirmada (não é suposição):** nenhum teste hoje — nem `TaskDestinationDialog.test.tsx`, nem `move-task.spec.ts` — abre o seletor a partir de uma tarefa **originada** em Esta Semana e interage com uma aba de calendário (o e2e atual "move de Esta Semana para Este Mês", `move-task.spec.ts:58-96`, hoje troca direto para a aba "Este mês" e usa o `TextField`, sem nunca clicar num dia de calendário). Com a Task 4.6 "Este mês" também vira calendário, então o novo e2e (Task 8.1) deve exercitar o **clique no calendário** a partir dessa origem — em "Esta semana" e/ou "Este mês". Fechar essa lacuna é, no mínimo, obrigatório independente da causa do bug. **Fechada:** novo teste e2e "move de Esta Semana clicando no calendário da própria aba Esta semana" + testes de regressão dedicados em `test_services.py`.

### Testes & Verificação

- [x] **Task 7: Testes de frontend** (AC1-AC5)
  - [x] 7.1 `TaskDestinationDialog.test.tsx` — reescrever/estender os casos existentes para o novo fluxo de 2 passos (selecionar → confirmar): aba "Hoje" confirma `destination:'today'` sem campos; aba "Esta semana" — clicar um dia no `MonthDensityCalendar` + Migrar chama `mutate({destination:'week', scheduledDate})`; **sem** clicar dia + Migrar chama `mutate({destination:'week', scheduledDate: undefined})` (semana sem data, caso novo); aba "Este mês" — **mesmo par de casos via calendário** (o `MonthDensityCalendar` da Task 4.6, não mais um `TextField`): clicar um dia + Migrar chama `mutate({destination:'month', scheduledDate})`; **sem** clicar dia + Migrar chama `mutate({destination:'month', scheduledDate: undefined})` — o caso sem data é **novo** e depende do ajuste de backend da Task 1; aba "Futuro" mantém os casos existentes (dia+mês, só mês), mas agora via botão "Migrar"; botão "Migrar" desabilitado em "Futuro" sem mês preenchido; clicar num dia de **qualquer um dos dois calendários** (Esta semana / Este mês) **não** chama `mutate` (só depois do clique em "Migrar"); erro de mutação e botão "Cancelar" mantêm o comportamento já testado. `jest-axe` contra o componente real (não mockado).
  - [x] 7.2 `MonthDensityCalendar.test.tsx` — casos novos de `data-today`/`data-current-week` (Task 3.5).
  - [x] 7.3 `TaskRow.test.tsx`/`TaskDetailPanel.test.tsx` — atualizar as 3 asserções de título do diálogo (Task 5.1/5.2); nenhum outro caso deveria quebrar (o botão que abre o diálogo não muda de rótulo).
  - [x] 7.4 `npm run typecheck && npm run lint && npm run build && npx vitest run --no-file-parallelism` (Node 22, `nvm use 22`) verdes; **colar contagem real**. Baseline de sanidade (11.9): **494 passed (45 arquivos)**. **Contagem real observada: 508 passed (45 arquivos).** +14 vs baseline (10 casos novos de highlight em `MonthDensityCalendar.test.tsx` + 10 casos novos/reescritos em `TaskDestinationDialog.test.tsx`, líquido após remover casos obsoletos do fluxo antigo).

- [x] **Task 8: Verificação manual e e2e (Playwright real, branch `e2e`)** (AC1-AC5)
  - [x] 8.1 Reescrever `frontend/e2e/move-task.spec.ts` para o novo fluxo de abas/confirmação — cada teste existente precisa de um clique extra em "Migrar" após selecionar o destino (calendários das abas Esta semana/Este mês e os campos de Futuro não migram mais sozinhos). O antigo caso "move de Esta Semana para Este Mês" passa a **clicar um dia no calendário** da aba "Este mês" (não há mais `TextField`). Adicionar cenários novos: mover para **Hoje** a partir de qualquer superfície (aparece no Daily Log); mover para **Esta semana sem data** (aparece em "Sem dia definido" da semana corrente); mover para **Este mês com dia** (clique no calendário) e **Este mês sem data** (sem clicar dia + Migrar); e — fechando a Task 6.2 — abrir o seletor a partir de uma tarefa **originada em Esta Semana** e migrar **clicando um dia no calendário** (o caminho que nenhum teste exercitava, seja na aba "Esta semana" seja na "Este mês"). **11 cenários** (10 testes, 1 com retry ambiental) — todos verdes contra o backend real após o fix da Task 6.
  - [x] 8.2 Verificar manualmente o destaque visual do dia de hoje/semana atual no calendário dentro do seletor — confirmado via screenshot real (Playwright) contra o dev server: dia 16/07 (hoje) com contorno distinto; linha 13-19 (semana corrente) com fundo sutil (`action.hover`) visível ao ampliar a captura.
  - [x] 8.3 Zero erros de console em todos os passos (`expect(consoleErrors).toEqual([])` em cada teste, todos verdes). `--workers=1` usado; 1 flake ambiental confirmado (cold-start da branch Neon `e2e`, timeout de navegação pós-signup) — reproduzido isoladamente 3x com sucesso (2 passes limpos de 3 tentativas), consistente com a fricção já documentada desde o Épico 4, não uma regressão de código.
  - [x] 8.4 **File List por último** (retro Epic 3 §8-2) — reconciliar contra `git status --short`/`git diff --stat` reais. Guardrails em `_bmad/custom/bmad-dev-story.toml`.

## Dev Notes

### Achado crítico: o sprint-change-proposal errou ao dizer "nenhum delta de backend nesta story"

O `sprint-change-proposal-2026-07-15.md` (§2, "Técnico/backend") afirma que o único delta de backend do 2º lote é a leitura de Daily Log por data (Story 11.11) e que a 11.10 é "frontend + reuso de `migrate_task`/`destination='today'` já existentes". **Isso está incompleto.** A leitura desta story encontrou que `TaskMigrateSerializer.validate()` (`backend/bujo/serializers.py:147-151`) **rejeita com 400** qualquer `destination: "month"` sem `scheduled_date` — provado pelo teste existente `test_post_migrate_destination_month_sem_scheduled_date_retorna_400`. Como a AC desta story (e o `AD-16` ponto 2, que fala em "análogamente, no mês sem dia") exige que "Este mês" aceite alocar **sem** data, esse comportamento precisa mudar. A boa notícia: o **serviço** `migrate_task` já suporta `scheduled_date=None` para `"month"` sem nenhuma mudança (o branch `else` do dispatcher não distingue "month"/"future" e sempre aceita `scheduled_date` opcional) — a restrição é **só** da validação HTTP (Task 1), não do domínio, o que confirma o espírito da frase do AD-16 ("a restrição era de UI, não de domínio") mesmo que a camada certa seja o serializer, não o componente React. **Sem impacto de schema** (`scheduled_date` já é campo opcional no tipo gerado) — coerente com o "Sem impacto de schema" do próprio AD-16.

### O bug relatado na Esta Semana — diagnóstico necessário, não uma correção óbvia

`docs/futureIdeas.md:28` registra "Story 11.6 O modal de migração não está funcionando em Esta Semana" sem detalhar o sintoma exato (erro de rede? diálogo não abre? clique no calendário não responde?). A leitura de `TaskRow.tsx`/`WeeklyPage.tsx`/`TaskDestinationDialog.tsx` **não revelou nenhuma causa óbvia** — o botão "Mover tarefa" renderiza incondicionalmente para linhas raiz em todas as páginas desde a 11.6, `WeeklyPage` passa `task` normalmente ao `TaskRow`, e o diálogo é autocontido. O e2e existente (`move-task.spec.ts`, teste "move de Esta Semana para Este Mês") **passa** hoje, mas nunca testa um calendário a partir dessa origem — só troca para a aba "Este mês", que hoje ainda é o `TextField` (com a Task 4.6 essa aba também vira calendário). **Duas hipóteses razoáveis, sem confirmação:** (a) o bug já não existe e a reclamação é anterior a algum fix incidental; (b) o bug é específico da interação com o calendário (aba "Dia"/"Esta semana") a partir dessa superfície, não do diálogo em si. **Não assumir que a reescrita desta story resolve de graça** — reproduzir manualmente antes de declarar a AC4 satisfeita, e garantir que o novo e2e (Task 8.1) realmente exercita esse caminho (calendário, não só "Este mês").

**Root cause encontrada (Task 6, via e2e real contra o backend):** não era um bug de frontend. Reproduzindo "criar uma única tarefa pendente em Esta Semana → Mover tarefa → aba Esta semana → clicar um dia dentro da semana corrente → Migrar" contra o backend real, o `POST .../migrate/` retornava **409** com `{"detail": "Ciclo fechado — somente leitura."}` (`ClosedCycleReadOnly`), não 400/500 — por isso o diálogo só mostrava a mensagem genérica "Não foi possível mover a tarefa" e parecia simplesmente "não funcionar". Causa: `_migrate_subtree` (`backend/bujo/services/migration.py`) transicionava a tarefa de origem (`transition_task` → `MIGRATED`) **antes** de criar a nova tarefa no destino. Quando a tarefa migrada é a **única** `pending`/`started` do seu `weekly_log`/`monthly_log` de origem **e** o destino calculado (`week_start_of(scheduled_date)` ou o mês corrente) é **esse mesmo container** (ex.: dar um dia a uma tarefa "sem dia" da própria semana/mês corrente — exatamente o fluxo novo desta story), a transição da origem fazia `is_container_closed` (`services/archive.py`) considerar o container fechado **um instante antes** de `create_task` tentar inserir o novo registro nele — e `create_task`/`_check_container_open` rejeitava a própria inserção que a migração estava tentando fazer. Isso não é um bug introduzido por esta story: já existia desde a 11.6 (o dispatcher `migrate_task`/`_migrate_subtree` não mudou), só nunca tinha cobertura de teste que colocasse "única tarefa do container" + "destino == origem" juntos. **Fix:** inverter a ordem em `_migrate_subtree` — criar a nova tarefa primeiro, transicionar a origem depois (`migrate_task` já é `@transaction.atomic`, então uma falha tardia em `transition_task` reverte a criação também, sem órfão). Testes de regressão dedicados em `test_services.py` (`test_migrate_task_destination_week_mesma_semana_da_origem_nao_fecha_o_proprio_destino`, `test_migrate_task_destination_month_mesmo_mes_da_origem_nao_fecha_o_proprio_destino`) e o novo e2e (Task 8.1, cenário "clicando no calendário da própria aba Esta semana") cobrem o caso.

### Escopo de "onde ela está hoje" — só a data, não o nome da superfície

O `epics.md` pede que o seletor mostre "data/onde ela está hoje"; `docs/futureIdeas.md:43` pede "mais informações da task (Descrição, data atual, etc.)". O tipo `Task` (`frontend/src/api/types.gen.ts:533-549`) expõe `scheduledDate` (opcional) mas **não** expõe em qual container a tarefa está hoje (`log`/`weekly_log`/`monthly_log` não aparecem no serializer de leitura, só nos internos do backend) — não há campo para "superfície atual" sem adicionar um novo campo ao contrato (schema change, fora do "sem impacto de schema" do AD-16) ou sem que cada página passe uma prop nova de "rótulo da superfície" ao `TaskRow`/`TaskDestinationDialog` (4 páginas a tocar por um dado cosmético). **Decisão desta story:** mostrar só `task.scheduledDate` (quando presente, formatada), sem tentar reconstruir "em qual tela ela está" — está dentro do "além do que a 11.6 já entregou" que a AC5 promete não estourar. Se o Hugo quiser o nome da superfície depois, é uma story pequena e isolada (plumbing de prop, não mudança de contrato).

### Por que "Este mês" usa o calendário de densidade (decisão do Hugo, 2026-07-16)

**Reversão registrada.** A v1 destas Dev Notes seguia a redação formal do `epics.md` ("comportamento do MigrationCard") e mantinha um `TextField type="date"` em "Este mês", sinalizando que, **se** essa leitura estivesse errada, o conserto seria trocar o `TextField` da Task 4.6 pelo mesmo `MonthDensityCalendar` da Task 4.5, e avisar o Hugo. O Hugo confirmou (2026-07-16): a fonte de verdade é a **nota do próprio Hugo** em `docs/futureIdeas.md:32` — "Este mês - exibe calendário de densidade do mês (dando a opção de escolher um dia específico ou de alocar na semana sem data certa)" — ou seja, **calendário de densidade também em "Este mês"**, não `TextField`.

**Consequência:** as abas "Esta semana" e "Este mês" usam o **mesmo** `MonthDensityCalendar` (mesmo componente, mesmo destaque de hoje/semana corrente da Task 3). O layout de dois calendários é **intencional**. A diferença está no **alvo do submit**, não na UI:
- **Esta semana** → dia escolhido vira `destination: 'week'` + `scheduledDate`; sem dia → `destination: 'week'` sem `scheduledDate` ("semana corrente sem data", já suportado pelo backend hoje).
- **Este mês** → dia escolhido vira `destination: 'month'` + `scheduledDate`; sem dia → `destination: 'month'` sem `scheduledDate` ("mês corrente sem data", que **exige o ajuste de backend da Task 1** — manter a Task 1 exatamente como está).

Cada aba tem seu próprio estado local de dia (`selectedDate` para semana, `monthDate` para mês), então a seleção de uma não interfere na outra. A AC3, antes redigida para um único calendário, passa a valer para os **dois** (ver AC3 revista). Diferença prática de mês: "Esta semana" mantém a navegação Prev/Next de mês do calendário; "Este mês" fixa o mês corrente (o backend força `month_first = current_month_first` para `destination == "month"`), renderizando só o mês atual.

### `MigrationDestination`/`useMigrateTaskMutation` — nenhuma mudança necessária

`frontend/src/features/bujo/api.ts:351-383` já tipa `MigrationDestination` incluindo `'today'`, já aceita `scheduledDate?: string | null` opcional para qualquer destino, e já invalida `todayLog`/`weeklyLog`/`monthlyLog`/`futureLog`/`taskDensity` no sucesso (Task 7 da 11.6). **Nenhuma mudança em `api.ts`/`keys.ts` nesta story.**

### Componentes reaproveitados (não reinventar)

- **`MonthDensityCalendar`** (11.3, estendido nesta story só com destaque hoje/semana — Task 3): a seleção (`selectedDate`/`onSelectDay`) já existe desde a 11.3, só não era usada para manter estado (11.6 migrava direto no clique); esta story é a primeira a de fato usar `selectedDate` para o que a prop foi desenhada.
- **`currentMonthBounds()`/`currentMonthLabel()`** (exportadas de `MigrationCard.tsx` desde a 11.6): reusar para a aba "Este mês", sem duplicar.
- **`useTaskDensityQuery`**: mesmo guard `enabled: open && mode === 'week'` (renomear de `mode === 'day'` já que a aba mudou de nome).

### Não fazer nesta story (fora de escopo, registrado)

- **Rótulo da superfície atual da tarefa** (ex. "está em Esta Semana, terça-feira") — só a data (`scheduledDate`), ver Dev Notes acima.
- ~~**Calendário na aba "Este mês"** — mantém `TextField`~~ → **revertido (Hugo, 2026-07-16):** a aba "Este mês" passa a usar o `MonthDensityCalendar`, igual à "Esta semana" (fonte: `docs/futureIdeas.md:32`) — ver Task 4.6 e Dev Notes "Por que 'Este mês' usa o calendário de densidade". O que **segue fora de escopo** nessa aba é apenas a navegação Prev/Next de mês (o calendário fica fixo no mês corrente).
- **Mudar o `aria-label` do botão que abre o diálogo** (`TaskRow`/`TaskDetailPanel`, ambos "Mover tarefa") — só o título do diálogo muda para "Migrar Tarefa".
- **Mudar `MigrationCard`/`MigrationFlow`** — confirmação automática (UX-DR3) preservada, fora de escopo (AD-16 ponto 3).
- **Endpoint/campo novo, migração de banco** — nenhum necessário.
- **Navegação de logs passados não-fechados** — Story 11.11 (depende desta, ordem registrada no AD-16/sprint-change-proposal).

### Previous Story Intelligence (11.9 — done)

- **Stack:** Backend Django + DRF + drf-spectacular + uv/pytest/ruff/lint-imports; Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Sem dependência nova nesta story.
- **Node 22 obrigatório** (`nvm use 22`); `vitest run --no-file-parallelism` (lição recorrente 11.2→11.9); Playwright `--workers=1` por cold-start da branch Neon `e2e` (fricção desde o Épico 4).
- **`jest-axe` só pega violação real contra o componente de verdade** — nunca mockar o componente sob teste de a11y (lição repetida 3.3→11.9).
- **`component="div"` obrigatório em `Typography variant="body-sm"` de bloco** (achado HIGH da review 11.9): variantes custom do MUI caem no fallback `<span>` sem `component` explícito, quebrando `noWrap`/layout de bloco. Vale para qualquer `Typography variant="body-sm"` nova nesta story (ex. o texto "Atualmente: DD/MM" da Task 4.3).
- **Contagem de testes sempre real** (retro Epic 3 §1). **File List por último** (retro Epic 3 §8-2). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.
- **Baselines de sanidade (pós-11.9):** backend `pytest` **360 passed**; frontend `vitest` **494 passed (45 arquivos)**.
- **AR-22 (observabilidade) segue pendente e sem dono há 4 épicos** — não bloqueia esta story, mas continua o pior follow-through do projeto (escalar antes do Épico 5, conforme memória do projeto).

### Git Intelligence

- Branch `main`; HEAD em `91b7bd3` (`fix(story-11.9): descrição dos cards trunca e fica abaixo do título`) — `baseline_commit` desta story. Commits recentes do 2º lote do Épico 11: `11.9`+fix (91b7bd3, fc76f5f), fix independente `9d5ef75` (ordenação de recorrentes, não relacionado), `11.8` (65c177c), `11.7` (d6ddd17), retro/fechamento 1º lote (8490e8e), `11.6` (899666e). Convenção de commit: `feat(story-11.10): <descrição em pt-BR>`.
- `git diff --stat` esperado: `backend/bujo/serializers.py` (remoção de 5 linhas de validação), `backend/bujo/services/migration.py` (docstring), `backend/bujo/tests/test_views.py`/`test_services.py` (+testes); `frontend/src/features/bujo/components/MonthDensityCalendar.tsx` (+destaque hoje/semana) e `.test.tsx`; `frontend/src/features/bujo/components/TaskDestinationDialog.tsx` (reescrita) e `.test.tsx`; `frontend/src/features/bujo/components/TaskRow.test.tsx`/`TaskDetailPanel.test.tsx` (rename do título do diálogo); `frontend/e2e/move-task.spec.ts` (reescrita). **Sem** `schema.yaml`/`types.gen.ts`/`api.ts`/`keys.ts` no diff.

### Project Structure Notes

- **Backend alterado:** `backend/bujo/serializers.py`, `backend/bujo/services/migration.py` (só docstring), `backend/bujo/tests/test_services.py`, `backend/bujo/tests/test_views.py`. Nenhum arquivo em `backend/*/migrations/`, nenhuma mudança em `views.py`/`urls.py`.
- **Frontend alterado:** `frontend/src/features/bujo/components/MonthDensityCalendar.tsx` (+`.test.tsx`), `frontend/src/features/bujo/components/TaskDestinationDialog.tsx` (+`.test.tsx`, reescrita substancial), `frontend/src/features/bujo/components/TaskRow.test.tsx`, `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx`, `frontend/e2e/move-task.spec.ts`. **Nenhum arquivo novo** — só extensão/reescrita de componentes e testes existentes.
- **Fronteiras:** mudanças contidas em `features/bujo/components` + `e2e/`; nenhum import novo além do que já existe (`MonthDensityCalendar`, `currentMonthBounds`). Zero nova violação de ESLint boundary/import-linter esperada.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.10 (linhas 952-979 — ACs completas, 4 abas, botão "Migrar", calendário com highlight); §Epic 11 intro (linha 757 — "(10) seletor Mover/Migrar completo... reformula o da 11.6, reusa o calendário")]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-16 (linhas 761-775 — as 4 decisões: "Hoje" explícito, balde semana/mês sem dia, confirmação explícita só neste seletor, passado aberto navegável — este último é da Story 11.11)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-15.md (linhas 13,17,30,64,68-70 — contexto da reabertura do Épico 11, gatilho do gap "hoje", decisões de produto registradas; §2 "Técnico/backend" tem a afirmação **incompleta** sobre não haver delta de backend nesta story, corrigida nesta story — ver Dev Notes)]
- [Source: docs/futureIdeas.md:28-33,36-37,42-43 (bugs/melhorias brutos que originaram esta story: bug em Esta Semana, especificação das 4 abas, highlight hoje/semana, clique preenche campo, botão "Migrar" + título, mais infos da task)]
- [Source: backend/bujo/serializers.py:141-169 (`TaskMigrateSerializer` — bloco de validação de `"month"` a remover, linhas 147-151, Task 1.1)]
- [Source: backend/bujo/views.py:498-529 (`TaskMigrateView.post` — já força `month_first` corrente e repassa `scheduled_date`, sem mudança necessária)]
- [Source: backend/bujo/services/migration.py (arquivo completo — `migrate_task`, branch `"month"`/"future"` linhas 92-95 já aceita `scheduled_date=None`; docstring linhas 58-75 a atualizar, Task 1.3)]
- [Source: backend/bujo/tests/test_views.py:1034-1044 (teste a substituir, Task 2.1); :1172-1192 (`test_post_migrate_destination_week_migra_para_weekly_log_corrente`, modelo do novo teste "sem data")]
- [Source: backend/bujo/tests/test_services.py:696-717 (`test_migrate_task_destination_month_torna_origem_postponed_e_cria_no_monthly_corrente`, teste a estender); :719-744 (`test_migrate_task_destination_future_com_e_sem_scheduled_date`, modelo de teste "com e sem data" lado a lado, Task 2.2)]
- [Source: frontend/src/features/bujo/components/TaskDestinationDialog.tsx (arquivo completo — reescrita desta story, Task 4); linha 97 (`DialogTitle` a renomear); linhas 47-93 (estado/handlers a reestruturar para o padrão "selecionar depois confirmar")]
- [Source: frontend/src/features/bujo/components/MonthDensityCalendar.tsx (componente a estender, Task 3 — props existentes `selectedDate`/`onSelectDay` linhas 13-18, técnica Monday-based linha 48, célula/`ButtonBase` linhas 116-148)]
- [Source: frontend/src/features/bujo/components/MigrationCard.tsx:30-42 (`currentMonthBounds`/`currentMonthLabel` exportadas, reuso na aba "Este mês")]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx:290-300 (botão "Mover tarefa", aria-label mantido); :336-342 (`TaskDestinationDialog` renderizado, sem mudança de props)]
- [Source: frontend/src/features/bujo/components/TaskDetailPanel.tsx:185-208 (botão "Mover tarefa" + `TaskDestinationDialog`, sem mudança de props)]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx (superfície do bug relatado — nenhuma mudança de página esperada, `TaskRow` recebe `task` normalmente, linhas 130,153,167)]
- [Source: frontend/src/api/types.gen.ts:533-549 (schema `Task` — sem campo de container atual, base da decisão "só mostrar `scheduledDate`", Dev Notes)]
- [Source: frontend/src/features/bujo/api.ts:351-383 (`MigrationDestination`/`useMigrateTaskMutation` — já suporta tudo que esta story precisa, sem mudança)]
- [Source: frontend/src/features/bujo/components/TaskDestinationDialog.test.tsx (suite atual — modelo e casos a reescrever/estender, Task 7.1)]
- [Source: frontend/src/features/bujo/components/MonthDensityCalendar.test.tsx (suite atual — modelo pros casos novos de highlight, Task 7.2)]
- [Source: frontend/src/features/bujo/components/TaskRow.test.tsx:606; frontend/src/features/bujo/components/TaskDetailPanel.test.tsx:290,332 (asserções de título do diálogo a atualizar, Task 5.1/5.2)]
- [Source: frontend/e2e/move-task.spec.ts (arquivo completo — reescrita para o fluxo de 2 passos + cenários novos, Task 8.1); linhas 36,76,116,153,205 (5 ocorrências do título antigo)]
- [Source: _bmad-output/implementation-artifacts/11-6-mover-migrar-tarefa-de-qualquer-superficie.md (story original do `TaskDestinationDialog` — Dev Notes "Por que 'hoje' na nova UI não usa destination='today'", agora obsoleta/revogada por esta story via AD-16 ponto 1; padrão de invalidação de `taskDensity`)]
- [Source: _bmad-output/implementation-artifacts/11-9-polimento-visual-dos-cards-e-grid-da-semana.md (Finding #1 da review — `component="div"` obrigatório em `body-sm` de bloco, relevante para a Task 4.3)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 (contagem real de testes), §8 (File List por último) — guardrails em `_bmad/custom/bmad-dev-story.toml`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Reprodução do bug relatado (Task 6) via e2e real: `POST /api/bujo/tasks/{id}/migrate/` retornava **409** `{"detail": "Ciclo fechado — somente leitura."}` ao migrar, via aba "Esta semana", a única tarefa `pending` de um `weekly_log` para um dia dentro da MESMA semana corrente. Isolado com um spec Playwright descartável que logou request/response da chamada de migrate — não sobrevive no File List (removido após a investigação).
- Root cause: `_migrate_subtree` (`backend/bujo/services/migration.py`) transicionava a origem para `MIGRATED`/`POSTPONED` **antes** de criar a nova tarefa no destino. Quando destino == container de origem (mesma semana/mês), a transição da origem esvaziava o container de tarefas `pending`/`started`, `is_container_closed` (`services/archive.py`) passava a considerá-lo fechado, e a criação da nova tarefa nesse mesmo container era rejeitada por `ClosedCycleReadOnly` — a migração falhava tentando inserir a própria tarefa que a completaria.
- Fix confirmado (200 OK) via reprodução do mesmo cenário e2e após reordenar `_migrate_subtree` (criar antes de transicionar); regressão coberta por 2 testes dedicados em `test_services.py`.
- **Após o code review:** `ruff check .` / `lint-imports` / `manage.py check` verdes; `pytest bujo/tests/test_services.py bujo/tests/test_views.py` → **234 passed** (sem falhas; contagem parcial por arquivo, não a suíte completa — ver Senior Developer Review). Frontend: `npm run typecheck` / `npm run lint` verdes; `npx vitest run --no-file-parallelism` → **45 arquivos, 509 passed** (+1 caso de regressão de cobertura, Finding #1). Ver "Senior Developer Review (AI)".

### Completion Notes List

- **Backend (Tasks 1-2):** `TaskMigrateSerializer.validate()` não exige mais `scheduled_date` para `destination: "month"` (bloco de validação removido); `migrate_task` já suportava isso sem mudança. Docstring atualizada. Teste antigo (`_retorna_400`) substituído por um que prova o novo comportamento (200); `test_services.py` ganhou um segundo caso "sem data" ao lado do existente. `ruff`/`lint-imports`/`manage.py check` verdes. **pytest: 364 passed, 1 warning, 1038.09s** (suite completa, sem escopo por caminho — guardrail retro Epic 3/11).
- **Frontend — `MonthDensityCalendar` (Task 3):** destaque de "hoje" (contorno) e "semana corrente" (fundo sutil `action.hover`) calculados via `new Date()` dentro do componente, com atributos `data-today`/`data-current-week` estáveis para teste. Achado durante a implementação: comparar `Date.getTime()` diretamente entre "hoje" (com hora/minuto reais) e um dia parseado à meia-noite dava falso-negativo mesmo no mesmo dia — corrigido comparando ISO de string (`mondayIsoOf`), não timestamp.
- **Frontend — `TaskDestinationDialog` (Tasks 4-5):** reescrito com 4 abas (Hoje/Esta semana/Este mês/Futuro), estado local por aba, confirmação explícita via botão "Migrar" (nenhuma aba migra no clique/onChange). Título renomeado para "Migrar Tarefa"; texto "Atualmente: DD/MM" quando `task.scheduledDate` existe. 7 referências ao título antigo atualizadas (`TaskRow.test.tsx`, `TaskDetailPanel.test.tsx`, `move-task.spec.ts`).
- **Bug da Esta Semana (Task 6):** ver Debug Log References — causa raiz era backend, não frontend; a reescrita do diálogo por si só NÃO teria corrigido o bug (achado confirma o alerta da própria story de "não assumir que reescrever resolve").
- **Testes de frontend (Task 7):** `TaskDestinationDialog.test.tsx` reescrito (22 casos) para o fluxo selecionar→confirmar; `MonthDensityCalendar.test.tsx` +4 casos de highlight (`vi.useFakeTimers`). `npm run typecheck && lint && build` verdes. **vitest: 508 passed (45 arquivos)** (baseline 11.9: 494).
- **e2e (Task 8):** `move-task.spec.ts` reescrito (10 cenários, incluindo os 4 novos pedidos pela AC — Hoje, semana sem data, mês sem data, e o cenário que fecha a Task 6.2). Todos os 10 verdes contra o backend real (branch Neon `e2e`), rodados individualmente e em conjunto em múltiplas execuções; 1 flake ambiental isolado e confirmado como não-regressão (timeout de navegação pós-signup, cold-start da branch — já documentado como fricção recorrente desde o Épico 4), reproduzido com sucesso em 2 de 3 tentativas isoladas subsequentes. Destaque visual de hoje/semana confirmado por screenshot real via Playwright.
- **Fora de escopo, não tocado:** `MigrationCard`/`MigrationFlow` (AC6), `schema.yaml`/`types.gen.ts`/`api.ts`/`keys.ts` (sem mudança de contrato), nenhuma migração de banco.

### File List

**Backend — código:**
- `backend/bujo/serializers.py` (modificado — `TaskMigrateSerializer.validate()`: removida a exigência de `scheduled_date` para `destination == "month"`, Task 1.1)
- `backend/bujo/services/migration.py` (modificado — docstring do branch `"month"` atualizada, Task 1.3; **e** fix do bug real da Task 6: `_migrate_subtree` reordenado para criar a nova tarefa antes de transicionar a origem, evitando fechar o próprio container de destino)

**Backend — testes:**
- `backend/bujo/tests/test_views.py` (modificado — `test_post_migrate_destination_month_sem_scheduled_date_retorna_400` substituído por `test_post_migrate_destination_month_sem_scheduled_date_postpoe_no_monthly_corrente`, Task 2.1)
- `backend/bujo/tests/test_services.py` (modificado — `+test_migrate_task_destination_month_sem_scheduled_date_postpoe_sem_dia` (Task 2.2); **+2 testes de regressão do bug da Task 6**: `test_migrate_task_destination_week_mesma_semana_da_origem_nao_fecha_o_proprio_destino`, `test_migrate_task_destination_month_mesmo_mes_da_origem_nao_fecha_o_proprio_destino`)

**Frontend — componentes:**
- `frontend/src/features/bujo/components/MonthDensityCalendar.tsx` (modificado — destaque de hoje/semana corrente, Task 3)
- `frontend/src/features/bujo/components/TaskDestinationDialog.tsx` (modificado — reescrita substancial: 4 abas, confirmação explícita, Task 4)

**Frontend — testes:**
- `frontend/src/features/bujo/components/MonthDensityCalendar.test.tsx` (modificado — +4 casos de `data-today`/`data-current-week`, Task 3.5)
- `frontend/src/features/bujo/components/TaskDestinationDialog.test.tsx` (modificado — reescrito para o fluxo selecionar→confirmar, Task 7.1; **+1 caso no code review** — toggle de desseleção na aba "Este mês", Finding #1)
- `frontend/src/features/bujo/components/TaskRow.test.tsx` (modificado — título do diálogo `'Mover tarefa'` → `'Migrar Tarefa'`, Task 5.1)
- `frontend/src/features/bujo/components/TaskDetailPanel.test.tsx` (modificado — título do diálogo atualizado (3 asserções) + fluxo de migração do teste de `onClose` encadeado adaptado ao novo padrão calendário+Migrar, Task 5.2)
- `frontend/e2e/move-task.spec.ts` (modificado — reescrito para o fluxo de 2 passos + 4 cenários novos + cenário de fechamento da Task 6.2, Task 8.1)

**Rastreamento da story (seções permitidas):**
- `_bmad-output/implementation-artifacts/11-10-seletor-mover-migrar-completo.md` (checkboxes, Dev Agent Record, File List, Change Log, Status, Senior Developer Review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (11-10 → in-progress → review → done; `last_updated`)

*Backend sem migração de banco, sem endpoint novo. Sem impacto em `schema.yaml`/`frontend/src/api/types.gen.ts`/`api.ts`/`keys.ts` (confirmado — nenhum desses arquivos aparece no diff). Nenhum arquivo novo de tipo E2E/management command/teste destrutivo criado (só extensão de specs existentes). O artefato `_bmad-output/story-automator/orchestration-11-…md` aparece modificado no working tree desde antes do início desta sessão — é do orquestrador, **fora do escopo desta story**, não tocado e não deve ser commitado por ela.*

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (automação story-automator) · **Data:** 2026-07-16 · **Resultado:** ✅ Aprovado (0 issues CRITICAL/HIGH) — 1 finding **LOW** corrigido nesta review (cobertura de teste).

### Verificação executada (contagens reais)

- `ruff check .`: **All checks passed!**
- `lint-imports`: **1 kept, 0 broken** (contrato `core` não importa apps de domínio).
- `python manage.py check`: **0 problemas**.
- `pytest bujo/tests/test_services.py bujo/tests/test_views.py -q`: **234 passed**, 0 falhas (execução isolada dos dois arquivos tocados pela story; suíte completa não reexecutada nesta review por custo de tempo — ~13 min só para estes 2 arquivos contra o Postgres remoto/Neon — mas cobre 100% dos testes novos/alterados da story, e nenhuma alteração de código toca outro arquivo de teste backend).
- `npm run typecheck` (tsc -b --noEmit, Node 22.15.1): **0 erros**.
- `npm run lint` (eslint .): **0 erros/avisos**.
- `npx vitest run --no-file-parallelism`: **45 arquivos, 509 passed** — 508 reivindicados pelo dev + **1 caso novo desta review** (Finding #1). Executado 2x: a 1ª rodada da suíte completa (508) mostrou 2 falhas de timeout (`TaskDestinationDialog` "trocar de aba" e `RecurringTemplateManager` "aba Anual", ambos "Test timed out in 5000ms") coincidindo com um `pytest` backend rodando em paralelo nesta sessão de review; reexecutados isoladamente **2x** logo em seguida (ambos os arquivos, sem concorrência) e passaram limpos — confirmado como flake ambiental de contenção de CPU, não regressão de código (nenhum dos dois é sensível a timer/relógio; `RecurringTemplateManager` nem foi tocado por esta story).
- e2e (`frontend/e2e/move-task.spec.ts`): **não reexecutado** nesta review — requer dev server + backend real + branch Neon `e2e` dedicada, fora do escopo prático desta verificação automatizada. Lido integralmente; os 10 cenários batem com a Task 8.1/AC1-AC5 (ver validação de ACs abaixo).

### Validação das ACs contra o código

- **AC1 ✓** — `TaskDestinationDialog.tsx:134` título "Migrar Tarefa"; bloco de info (:137-149) mostra título/descrição/"Atualmente: DD/MM" (`task.scheduledDate && …`); 4 `Tab`s na ordem Hoje/Esta semana/Este mês/Futuro (:162-165); "Hoje" confirma `destination:'today'` sem campos (:110-111); "Esta semana"/"Este mês" usam o mesmo `MonthDensityCalendar` (:188-193, :197-202), dia específico → `scheduledDate`, sem dia → destino "corrente sem data" (:112-121); "Futuro" idêntico ao comportamento anterior (:122-129).
- **AC2 ✓** — nenhuma aba chama `migrate.mutate` no clique/`onChange`; só `handleConfirm` (botão "Migrar", :235-241) lê o `mode` atual. `disabled={mode === 'future' && !futureMonth}` (:237) replica a validação existente. Confirmado por 6+ casos em `TaskDestinationDialog.test.tsx` que hoje passam **antes** do clique em "Migrar" (`expect(mockMigrateMutate).not.toHaveBeenCalled()`). Escopo isolado ao `TaskDestinationDialog` — `MigrationCard.tsx`/`MigrationFlow` sem diff (AC6).
- **AC3 ✓** — `MonthDensityCalendar.tsx:122-123,145-146,152,157-159`: `data-today`/`data-current-week` + `boxShadow` (hoje, contorno) e `bgcolor: action.hover` (semana corrente) coexistindo com `bgcolor: action.selected` do dia selecionado (elementos DOM distintos — `td` vs `ButtonBase` — não se cancelam, testado em "destaque de hoje convive com o destaque de dia selecionado"). Clique só chama `onSelectDay` → estado local (`handleSelectWeekDay`/`handleSelectMonthDay`), nunca migra direto.
- **AC4 ✓** — root cause real (bug de backend em `_migrate_subtree`, não frontend) encontrada e corrigida; rastreei a lógica manualmente: `is_container_closed` (`services/archive.py:15-22`) e `_check_container_open` (`services/tasks.py:13-19`) dependem só do status das tasks do container-alvo — `transition_task` (`services/state_machine.py`) não checa fechamento, então adiar a transição da origem para depois do `create_task` não pula nenhuma validação; só fecha a janela onde a origem (ainda pending) deixava de "segurar" o container aberto. Regressão coberta por 2 testes dedicados (`test_services.py`) que reproduzem exatamente o cenário (única task pending do container, destino == origem) + e2e novo exercitando o caminho do calendário a partir de Esta Semana.
- **AC5 ✓** — `migrate_task` (`services/migration.py:100-103`) mantém a regra de status (MIGRATED para "today"/"week", POSTPONED para "month"/"future") inalterada pelo reorder; `set_lineage_fields` roda depois da criação, como antes. `git diff` confirma zero mudança em `schema.yaml`/`types.gen.ts`/`api.ts`/`keys.ts`.
- **AC6 ✓** — `git diff --stat` confirma `MigrationCard.tsx`/`MigrationFlow` fora do diff. Suites de a11y (`jest-axe`) do `TaskDestinationDialog`/`TaskRow`/`TaskDetailPanel` continuam presentes e verdes contra os componentes reais (nenhum mock do componente sob teste).

### Cross-check File List vs git reality

`git diff --name-only` + `git status --porcelain` batem exatamente com o File List declarado (13 arquivos rastreados + o arquivo da própria story, antes untracked). Sem arquivo órfão, sem claim falso. O artefato do orquestrador (`_bmad-output/story-automator/orchestration-11-…md`) aparece modificado mas está corretamente excluído do escopo/File List, conforme a nota do próprio dev — condizente com a regra de exclusão de `_bmad-output/` desta revisão.

### Findings

| # | Severidade | Finding | Ação |
|---|---|---|---|
| 1 | LOW | **Assimetria de cobertura de teste:** a Task 4.6 pede o mesmo comportamento de toggle (clique no dia já selecionado desmarca) para a aba "Este mês", espelhando a Task 4.5 — o código implementa corretamente (`handleSelectMonthDay` é idêntico a `handleSelectWeekDay`), mas só a aba "Esta semana" tinha um teste dedicado (`TaskDestinationDialog.test.tsx`, "clicar no dia já selecionado desmarca"). A aba "Este mês" ficava sem prova direta do toggle. | **Corrigido nesta review:** +1 caso `'aba "Este mês" — clicar no dia já selecionado desmarca (toggle)'` em `TaskDestinationDialog.test.tsx`, espelhando o caso existente da aba "Esta semana". Verificado passando (23/23 no arquivo, 509/509 na suíte completa). |

Nenhum finding CRITICAL, HIGH ou MEDIUM sobreviveu à verificação — a implementação é incomumente completa: o próprio dev encontrou e corrigiu, durante a Task 6, um bug real de backend pré-existente desde a Story 11.6 (não introduzido por esta story), com regressão coberta por 2 testes de serviço dedicados que reproduzem o cenário exato (container com uma única task pending, destino == origem). A lógica do fix foi verificada linha a linha contra `is_container_closed`/`_check_container_open`/`transition_task` nesta review e está correta.

### Verificação manual pendente (Hugo)

Destaque visual (contorno de "hoje" + fundo `action.hover` da semana corrente) já foi confirmado por screenshot real na Task 8.2 pelo próprio dev — nenhuma verificação visual adicional pendente. O e2e (`move-task.spec.ts`) não foi reexecutado nesta review (branch Neon `e2e` dedicada, fora do escopo prático de uma verificação automatizada); os 10 cenários foram lidos e batem com as ACs, mas vale confirmar com uma rodada real se surgir dúvida sobre o ambiente `e2e`.

## Change Log

- **2026-07-16** — Aba "Este mês" passa a usar `MonthDensityCalendar` (não `TextField`), por decisão do Hugo (`docs/futureIdeas.md:32`) — sinalizado como possível na v1 das Dev Notes. Seções atualizadas: AC1 (aba "Este mês"), AC2 (lista de campos preenchíveis), AC3 (destaque/clique agora valem para os dois calendários), Task 3.4, Task 4.6 (rewrite: calendário no lugar do `TextField`), Task 6.2, Task 7.1, Task 8.1, Dev Notes "Por que 'Este mês' usa o calendário de densidade" (retitulada, documenta a reversão) e o item de "Não fazer nesta story". Backend Task 1 (mês sem data) mantida como estava.
- **2026-07-16** — Implementação completa (Tasks 1-8). Achado além do escopo original da story durante a Task 6 (investigação do bug relatado): root cause real era um bug de backend pré-existente desde a 11.6 em `_migrate_subtree` (fechava o próprio container de destino antes de inserir a nova tarefa, quando origem e destino coincidem), não um problema de frontend — fix de 1 linha de reordenação + 2 testes de regressão dedicados. Ver Dev Notes "Root cause encontrada" para o relato completo. Nenhuma mudança de escopo além disso; todas as ACs satisfeitas como especificado.
- **2026-07-16** — Code review (automação story-automator): 0 issues CRITICAL/HIGH/MEDIUM; 1 finding LOW corrigido (teste de toggle faltante na aba "Este mês", `TaskDestinationDialog.test.tsx`). Backend/frontend lint/typecheck/testes verificados independentemente (não apenas reexecutando os números reivindicados pelo dev). Status → done. Ver "Senior Developer Review (AI)".
