---
baseline_commit: 81ae849ad55c7639f13b895127440e955f81198f
---

# Story 11.3: Placement de recorrentes — dedup + modal com calendário de densidade

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero que, ao colocar um recorrente, ele suma da lista do período e que o modal me mostre a recorrência e a densidade de tarefas do mês,
Para que eu não coloque o mesmo recorrente sem querer e decida melhor onde encaixá-lo (itens #4, #5 de `docs/futureIdeas.md`).

## Acceptance Criteria

### AC1 — Recorrente colocado some da lista do período (dedup), com caminho explícito para recolocar

- **Dado que** a lista de recorrentes a colocar em Esta Semana / Este Mês,
- **Quando** coloco um template naquele período,
- **Então** ele some da lista de sugestões **daquele período**,
- **E** se eu precisar de outra ocorrência (ex.: "3x por semana", já que `recurrence_text` é texto livre não-parseado), há um caminho explícito para recolocar — **sem bloqueio rígido de duplicado**.

### AC2 — Modal de placement mostra a recorrência + calendário de densidade do mês

- **Dado que** o modal de placement,
- **Quando** ele abre,
- **Então** mostra as informações da recorrência (título, descrição, `recurrence_text`),
- **E** mostra um calendário do mês com indicador de quantas tarefas já existem em cada dia (densidade), **apenas informativo**.

### AC3 — Calendário de densidade é componente reutilizável (preparado para a Story 11.6)

- **Dado que** o calendário de densidade,
- **Então** é construído como componente reutilizável, para ser reaproveitado no fluxo de mover tarefa (Story 11.6) — tocar num dia **pode** selecioná-lo; se o clique no calendário custar muito, ele apenas exibe densidade e a seleção fica num date-picker à parte.
- **Nesta story o calendário é apenas informativo** (sem seleção ativa). O componente deve **aceitar** props opcionais de seleção (`selectedDate?`, `onSelectDay?`) para que a 11.6 as ligue depois, mas 11.3 não as usa (não desenha estado selecionado nem dispara seleção).

## Tasks / Subtasks

> **Esta story toca backend E frontend.** Diferente da 11.2 (frontend-only), aqui há: (a) um campo aditivo no `TaskSerializer` (dedup), (b) um endpoint novo de agregação de densidade (calendário), e (c) regeneração do contrato (`schema.yaml` + `types.gen.ts`). Nenhuma migração de banco, nenhum campo novo de modelo, nenhuma mudança na máquina de estados. O schema `tasks`/`recurring_task_templates` permanece **congelado** (AD-03/AD-08) — só a **serialização** e uma **query de leitura** mudam.

### Backend

- [x] **Task 1: Expor `source_template` no `TaskSerializer` (habilita o dedup no cliente)** (AC: #1)
  - [x] 1.1 Em `backend/bujo/serializers.py`, adicionar `"source_template"` a `TaskSerializer.Meta.fields` (linhas 17-28). O campo já existe no modelo (`Task.source_template`, FK nullable → `RecurringTaskTemplate`, coluna `source_template_id`, `bujo/models.py:147-153`). O `ModelSerializer` o serializa como a PK do relacionado (`sourceTemplate: string(uuid) | null` sobre o contrato camelCase). **Read-only por natureza** (é uma FK definida só no placement service; nenhum write path de tarefa a aceita) — não precisa entrar em nenhum `*CreateSerializer`/`*UpdateSerializer`.
  - [x] 1.2 **Revoga explicitamente a decisão YAGNI da Story 4.5** (Task 9.4 da 4.5 decidiu *não* adicionar `source_template` ao serializer "pois nenhuma AC pedia exibir a linhagem"). Agora a AC1 exige: sem `sourceTemplate` na Task, o cliente não tem como saber quais templates já foram colocados no período. Deixar registrado no Completion Notes que esta story faz essa reversão consciente.
  - [x] 1.3 Confirmar que o campo aparece em **todas** as superfícies que serializam tarefas via `TaskSerializer`: `LogSerializer.get_tasks` (daily), e as respostas de weekly/monthly log (que reusam `TaskSerializer`). Como `get_subtasks` também usa `TaskSerializer` recursivamente, subtarefas passam a carregar `sourceTemplate` também (será `null` para elas — subtarefas não nascem de template; o placement cria só a raiz, AD-08 item 8). Isso é inócuo e correto.

- [x] **Task 2: Endpoint de densidade de tarefas por dia do mês** (AC: #2)
  - [x] 2.1 Criar view `TaskDensityView` (APIView fina, mesmo molde de `views.py` — parse+validate via serializer, delega/agrega, serializa) em `backend/bujo/views.py`. Rota `GET /api/bujo/task-density/` em `backend/bujo/urls.py` (junto do grupo bujo), name `bujo-task-density`. Query param **obrigatório** `month_first` (camelCase `monthFirst` sobre o fio) — data `YYYY-MM-01`; validar com um serializer de query (`serializers.DateField`), `is_valid(raise_exception=True)`.
  - [x] 2.2 **Agregar a densidade de TODAS as fontes de "tarefa num dia D" do mês**, contando **apenas tarefas raiz** (`parent_task__isnull=True`, convenção já usada em `WeeklyLogView`/`LogSerializer`/`FutureLogView`):
    - Daily: `Task.objects.filter(log__log_date__year=Y, log__log_date__month=M, parent_task__isnull=True)` → dia = `log.log_date`.
    - Weekly: `Task.objects.filter(weekly_log__isnull=False, scheduled_date__year=Y, scheduled_date__month=M, parent_task__isnull=True)` → dia = `scheduled_date`.
    - Monthly: `Task.objects.filter(monthly_log__isnull=False, scheduled_date__year=Y, scheduled_date__month=M, parent_task__isnull=True)` → dia = `scheduled_date`.
    - **Usar SEMPRE `Task.objects`** (manager tenant-scoped, fail-closed via `current_user_id` contextvar) — **nunca `all_objects`** (AD-12/Story 1.2). O escopo por `user_id` é automático.
    - Tarefas weekly/monthly com `scheduled_date = NULL` **não entram** (não têm dia — não contam para densidade de dia nenhum).
  - [x] 2.3 Retornar `{"density": [{"date": "YYYY-MM-DD", "count": N}, ...]}` **apenas para dias com count > 0** dentro do mês pedido (o cliente preenche zeros no grid). Ordenar por `date` asc. Definir com um serializer de resposta (`extend_schema(responses=...)`) para o contrato ficar tipado — evite `Response(<dict cru>)` sem schema (guardrail de contrato). Sugestão de implementação eficiente: `.values('...day...').annotate(count=Count('id'))` por fonte e somar os três dicionários por data em Python (as três fontes são disjuntas por `CHECK task_exactly_one_log`, mas datas coincidem entre fontes — some as contagens da mesma data).
  - [x] 2.4 Bloco `security` do endpoint intacto/presente como os demais (JWT), igual ao resto de `/api/bujo/*` (guardrail retro Epic 3 §3 — nenhum endpoint sem auth por acidente).

- [x] **Task 3: Regenerar o contrato de API** (AC: #1, #2)
  - [x] 3.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 3.2 `cd frontend && npm run generate-types`
  - [x] 3.3 Conferir no diff do `schema.yaml` que entraram **só**: (a) o campo `sourceTemplate` no schema `Task` (nullable uuid); (b) o path novo `/api/bujo/task-density/` + os schemas de request/response da densidade. Blocos `security` dos endpoints **existentes** intactos (guardrail retro Epic 3 §3). O CI (`.github/workflows/ci.yml:74-81`) falha se `types.gen.ts` divergir do `schema.yaml` — regenerar e commitar ambos.

### Frontend

- [x] **Task 4: Camada de dados — hook de densidade + tipo `sourceTemplate`** (AC: #1, #2)
  - [x] 4.1 Após `npm run generate-types` (Task 3.2), `Task` em `types.gen.ts` ganha `sourceTemplate?: string | null`. Confirmar que o re-export em `frontend/src/features/bujo/types.ts` o propaga (é um re-export de tipo, sem edição manual necessária).
  - [x] 4.2 Em `frontend/src/api/keys.ts` (seção `bujo`, linhas 13-25), adicionar `taskDensity: (monthFirst?: string) => ['bujo', 'taskDensity', monthFirst ?? 'current'] as const` — mesmo padrão de `monthlyLog`/`weeklyLog` (sentinel `'current'` quando `undefined`).
  - [x] 4.3 Em `frontend/src/features/bujo/api.ts`, criar `useTaskDensityQuery(monthFirst?: string, options?: { enabled?: boolean })` no molde de `useMonthlyLogQuery` (linhas 201-206): `GET /api/bujo/task-density/` com query param `month_first`; query key `keys.bujo.taskDensity(monthFirst)`; repassar `enabled` (o modal só busca quando aberto). Retornar o array `density` (ou o objeto — seguir o shape que o serializer de resposta definiu na Task 2.3).
  - [x] 4.4 **Invalidação de cache:** a densidade precisa refletir tarefas recém-criadas/colocadas. Em `usePlaceRecurringTemplateMutation` (api.ts:420-434) e nas mutations que criam tarefas em semana/mês (`useCreateMonthlyTaskMutation`, `useCreateWeeklyTaskMutation`), adicionar `queryClient.invalidateQueries({ queryKey: ['bujo', 'taskDensity'] })` ao `onSuccess` (invalidação por prefixo, alcança o sentinel `'current'`). Sem isso, colocar um recorrente não atualizaria a densidade num modal reaberto.

- [x] **Task 5: Componente reutilizável `MonthDensityCalendar`** (AC: #2, #3)
  - [x] 5.1 Criar `frontend/src/features/bujo/components/MonthDensityCalendar.tsx`. Props:
    ```ts
    interface MonthDensityCalendarProps {
      monthFirst: string                          // 'YYYY-MM-01' — mês a exibir
      densityByDate: Map<string, number>          // 'YYYY-MM-DD' -> count (só dias > 0)
      selectedDate?: string | null                // OPCIONAL — reservado p/ Story 11.6
      onSelectDay?: (isoDate: string) => void     // OPCIONAL — reservado p/ Story 11.6
    }
    ```
  - [x] 5.2 Renderizar grid do mês **começando na segunda-feira** (AD-05: segunda é o 1º dia da semana). Cabeçalho de 7 colunas `Seg Ter Qua Qui Sex Sáb Dom`. A 1ª linha ganha células vazias antes do dia 1 conforme o weekday da segunda; a última linha, células vazias após o último dia. **Enumerar os dias do mês sem `new Date(isoString)` (evita off-by-one de UTC)** — parsear `YYYY-MM-DD` por partes e montar com `new Date(y, m-1, d)` **local**, mesma técnica documentada em `WeekDaySelector.tsx` (`formatDayChipLabel`, linhas 14-22) e `MonthlyPage`/`MigrationCard`.
  - [x] 5.3 Cada célula de dia exibe o número do dia + um indicador de densidade (`densityByDate.get(iso) ?? 0`). Densidade 0 = célula neutra; densidade > 0 = badge/contador discreto (ex.: `body-sm` com a contagem, ou um dot; visual honesto e informativo, sem ícone celebratório — DESIGN.md). Usar variantes do tema (`body-sm`, `label`) já existentes; não inventar cor fora do tema (`createBujoTheme`).
  - [x] 5.4 **A11y (baseline WCAG 2.2 AA, Story 2.4):** o grid deve ser navegável e legível por leitor de tela — cada dia com rótulo acessível incluindo a contagem, ex.: `aria-label="14 de julho, 3 tarefas"` (ou "sem tarefas"). Se usar `<table>`, cabeçalhos `<th scope="col">`; se usar `role="grid"`, seguir o padrão. `jest-axe` sem violações **contra o componente real** (nunca mockado — lição recorrente 3.3/4.1–4.5).
  - [x] 5.5 **Seleção fica desligada nesta story:** só ligar `onClick`/estado-selecionado se `onSelectDay` for passado. Como 11.3 não passa, o calendário é puramente informativo. Documentar no topo do arquivo (comentário) que a seleção é o gancho de reuso da Story 11.6 (AC3 / epics.md linha 817).
  - [x] 5.6 Exportar `MonthDensityCalendar` no barrel `frontend/src/features/bujo/index.ts` (mesmo padrão dos demais componentes reusáveis) — a 11.6 vai importá-lo de lá.

- [x] **Task 6: Enriquecer o `RecurringPlacementDialog` (info da recorrência + calendário)** (AC: #2)
  - [x] 6.1 Em `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`, estender as props para receber o **template** sendo colocado e o **mês** do calendário:
    ```ts
    interface RecurringPlacementDialogProps {
      open: boolean
      dateFieldType: 'date' | 'day'
      template: RecurringTaskTemplate | null   // NOVO — info da recorrência a exibir
      monthFirst: string                       // NOVO — mês p/ o calendário de densidade
      onConfirm: (value: string) => void
      onClose: () => void
    }
    ```
    Manter a coleta de valor (`type="date"` / `type="number"`) intacta — o diálogo continua "só coletando" o valor bruto; a conversão para `scheduledDate` segue na página.
  - [x] 6.2 No topo do conteúdo do Dialog, exibir as infos da recorrência a partir de `template`: `title`, `description` (se houver) e `recurrenceText` (rotulado, ex.: "Recorrência: <texto livre>"). Usar variantes do tema. Renderizar só quando `template` não for `null`.
  - [x] 6.3 Abaixo (ou ao lado, no desktop) das infos, renderizar `<MonthDensityCalendar monthFirst={monthFirst} densityByDate={...} />`. Buscar a densidade com `useTaskDensityQuery(monthFirst, { enabled: open })` **dentro do Dialog** (o MUI `Dialog` desmonta os filhos quando `open=false` por padrão; ainda assim passar `enabled: open` para não disparar fetch prematuro). Converter o array de densidade num `Map<string, number>` para o componente. **Sem seleção** (não passar `onSelectDay`).
  - [x] 6.4 **Responsividade (mobile):** o Monthly Log no mobile é lista vertical justamente porque grid de mês fica apertado (EXPERIENCE.md:528). O calendário aqui vive num Dialog (full-width no mobile) — garantir que o grid caiba sem scroll horizontal: fonte compacta, `maxWidth: 100%`, células flexíveis. A AC3 já prevê o fallback "se o clique custar muito, só exibe densidade" — como a seleção está desligada nesta story, o risco é só de layout; validar no viewport mobile.

- [x] **Task 7: Dedup + caminho de recolocação no `RecurringPlacementSection`** (AC: #1)
  - [x] 7.1 Em `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`, adicionar prop `placedTemplateIds: Set<string>` (ids de templates que já têm instância no período corrente — a página calcula e passa) e um estado local `const [showPlaced, setShowPlaced] = useState(false)`.
  - [x] 7.2 Ajustar o filtro (linhas 27-29): além de `recurrenceGroups.includes(...)`, excluir templates cujo `id` está em `placedTemplateIds` **quando `showPlaced` está desligado**. Com `showPlaced` ligado, incluir os já-colocados também.
  - [x] 7.3 Adicionar o controle de recolocação como `<FormControlLabel control={<Switch checked={showPlaced} onChange={...} />} label="Mostrar já colocados" />` — **mesmo padrão do "Mostrar inativos" da Story 11.2** (consistência de UX). Default `false` = dedup ligado (esconde os já-colocados). Este é o **caminho explícito para recolocar sem bloqueio rígido** (AC1): o usuário liga o switch e recoloca a ocorrência extra.
  - [x] 7.4 Nos itens já-colocados exibidos (com `showPlaced` on), marcar visualmente com sufixo "(já colocado)" no texto, análogo ao "(inativo)" da 11.2. O botão "Definir placement" continua funcional (recolocação permitida — cria nova instância, sem checagem de duplicado).
  - [x] 7.5 **Ausência de `placedTemplateIds` = comportamento antigo:** para robustez, tratar `placedTemplateIds` como opcional com default `new Set()` — se uma página não passar, nada é deduplicado (não quebra). Mas ambas as páginas (Task 8) devem passar.

- [x] **Task 8: Ligar dedup + calendário nas páginas Weekly e Monthly** (AC: #1, #2)
  - [x] 8.1 **`MonthlyPage.tsx`**: computar `placedTemplateIds` a partir de `monthlyLog.data.tasks` — `new Set(tasks.map(t => t.sourceTemplate).filter((id): id is string => Boolean(id)))`. Passar para `<RecurringPlacementSection placedTemplateIds={...} .../>`. No `<RecurringPlacementDialog>`, passar `template={<o template de placingTemplateId>}` (buscá-lo na lista de `useRecurringTemplatesQuery` ou receber via callback — ver 8.3) e `monthFirst={monthFirst}` (o mês já exibido). A conversão dia→`scheduledDate` (linhas 231-233) permanece.
  - [x] 8.2 **`WeeklyPage.tsx`**: computar `placedTemplateIds` a partir das tarefas da semana — juntar `weeklyLog.data.days.flatMap(d => d.tasks)` + `weeklyLog.data.unscheduled`, então `new Set(...map(t => t.sourceTemplate).filter(Boolean))`. Passar para a `RecurringPlacementSection` (linha 103). No `RecurringPlacementDialog` (linha 107), passar `template` e `monthFirst`. **`monthFirst` para a semana** = 1º dia do mês que contém `weekStart` (a segunda-feira): `` `${weekStart.slice(0,7)}-01` ``. Edge aceito: semana de virada pertence a 2 meses (AD-05) — mostra-se o mês da segunda-feira; densidade é informativa, então a escolha é aceitável (documentar no Dev Notes/Completion Notes).
  - [x] 8.3 **Obter o objeto `template` a partir do `placingTemplateId`:** hoje as páginas só guardam o `id` (`placingTemplateId`). Opções: (a) trocar o estado para guardar o template inteiro (`placingTemplate: RecurringTaskTemplate | null`) e o `onPlace` do Section passar o template em vez do id; **ou** (b) manter o id e resolver o template via `useRecurringTemplatesQuery({ active: true }).data?.find(t => t.id === placingTemplateId)`. Preferir **(a)** (menos re-busca, o Section já tem o template em mãos ao renderizar a linha) — ajustar a assinatura de `onPlace` para `(template: RecurringTaskTemplate) => void` e atualizar ambas as páginas. Se optar por (a), o `placeTemplate.mutate` usa `placingTemplate.id`.

### Testes & Verificação

- [x] **Task 9: Testes de backend** (AC: #1, #2)
  - [x] 9.1 `TaskSerializer` expõe `sourceTemplate`: teste que uma tarefa colocada via `place_template` serializa com `sourceTemplate == template.id`, e uma tarefa comum serializa `sourceTemplate == None`. (Adicionar/estender em `bujo/tests/` onde o serializer é testado.)
  - [x] 9.2 `TaskDensityView`: cobrir (a) agregação através das 3 fontes (daily por `log_date`, weekly/monthly por `scheduled_date`) — datas coincidentes somam contagens; (b) `scheduled_date NULL` não conta; (c) só raízes contam (subtarefa não infla a contagem); (d) só o mês pedido; (e) `month_first` ausente/ inválido → 400; (f) resposta só com dias `count > 0`, ordenada.
  - [x] 9.3 **Isolamento multi-tenant** do endpoint de densidade: tarefas de outro `user_id` **não** aparecem na contagem (usa `Task.objects` scoped). Seguir o molde de `bujo/tests/test_isolation.py`; a densidade é uma nova superfície de leitura, então **precisa** de cobertura de isolamento (guardrail AD-12 / retro).
  - [x] 9.4 Contrato: teste em `core/tests/test_api_contract.py` (se aplicável ao padrão) cobrindo o path novo, ou confirmar que a suíte de contrato existente não regride.

- [x] **Task 10: Testes de frontend** (AC: #1, #2, #3)
  - [x] 10.1 `MonthDensityCalendar.test.tsx` (novo): grid do mês renderiza começando na segunda; dia com densidade mostra a contagem; dia sem densidade mostra 0/neutro; `aria-label` por dia inclui a contagem; **`jest-axe` sem violações contra o componente real**; caso-âncora de off-by-one (ex.: `monthFirst='2026-03-01'` renderiza "1" na coluna certa; validar 1º/último dia). Confirmar que **sem** `onSelectDay` não há handler de clique/estado selecionado (informativo).
  - [x] 10.2 `RecurringPlacementDialog.test.tsx` (novo ou estendido): com `template` e `open`, exibe título/descrição/`recurrenceText`; monta o `MonthDensityCalendar` (mockar `useTaskDensityQuery` para densidade determinística); a coleta de valor (`date`/`day`) e `onConfirm` seguem funcionando; `jest-axe`.
  - [x] 10.3 `RecurringPlacementSection.test.tsx` (novo ou estendido): com `placedTemplateIds` contendo um template, ele **não** aparece por padrão; ligar o `Switch` "Mostrar já colocados" o faz aparecer com "(já colocado)" e o botão "Definir placement" ainda dispara `onPlace`. Sem `placedTemplateIds`, todos aparecem (compat).
  - [x] 10.4 Integração `MonthlyPage`/`WeeklyPage`: após colocar um template (mockando a mutation e o log com uma tarefa `sourceTemplate` correspondente), a sugestão some da lista; o dialog recebe `monthFirst` correto (mês do `weekStart` no caso weekly). Reaproveitar os mocks de barrel `features/bujo` já existentes (`router.test.tsx`/`RouteAnnouncer.test.tsx`) — se novos exports entrarem no barrel (`MonthDensityCalendar`), **atualizar os mocks** que listam exports (achado recorrente 4.3/4.4/4.5).

- [x] **Task 11: Verificação final** (AC: #1, #2, #3)
  - [x] 11.1 **Backend:** `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — colar contagem **real** de testes (guardrail retro Epic 3 §1; a suíte estava em 288 passed ao fim da 4.5 — vai subir com os testes novos).
  - [x] 11.2 **Frontend:** `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — colar contagem **real** (estava em 392 passed / 42 files ao fim da 11.2; vai subir). Rodar sob **Node 22** (`nvm use 22`) e, se houver flakiness de timeout, `--no-file-parallelism` (Debug Log 11.2).
  - [x] 11.3 **Contrato:** reconferir do zero — regenerar `schema.yaml` e `types.gen.ts` em arquivos temporários e `diff` contra os commitados: **zero diff** (Task 3). O CI valida isso; não deixar divergência.
  - [x] 11.4 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado, contra a branch Neon de dev ou `e2e`): (a) em "Este Mês", colocar um recorrente mensal → some da lista; ligar "Mostrar já colocados" → reaparece com "(já colocado)" e dá pra recolocar (cria 2ª instância). (b) O modal de placement mostra título/descrição/recorrência do template e o calendário do mês com contagens por dia batendo com as tarefas reais. (c) Em "Esta Semana", idem para um semanal; o calendário mostra o mês da semana. (d) Regressão: criar tarefa avulsa em semana/mês ainda funciona e a densidade atualiza ao reabrir o modal. Zero erros de console.
  - [x] 11.5 **File List por último** (retro Epic 3 §8-2, guardrail ativo em `_bmad/custom/bmad-dev-story.toml`): `git status --short` + `git diff --stat` **depois** da verificação manual; reconciliar contra o File List. Confirmar que `schema.yaml` e `types.gen.ts` aparecem no diff (regeneração commitada).

## Dev Notes

### O que muda e o que NÃO muda

Esta story adiciona **dedup de placement** (AC1) e um **modal enriquecido com calendário de densidade** (AC2/AC3). O schema de dados permanece **congelado**: `tasks` e `recurring_task_templates` não ganham coluna nem migração; a máquina de estados (AD-02), a linhagem (AD-03) e o modelo de placement (AD-08) ficam intactos. As duas mudanças de backend são: **(1)** expor um campo que **já existe** no modelo (`source_template`) via serializer; **(2)** um endpoint de **leitura agregada** (densidade). Todo o resto é frontend (componente novo + fiação nos diálogos/páginas).

### AC1 — Como o dedup funciona (fonte da verdade)

- A ligação instância→template é `Task.source_template` (coluna `source_template_id`, `bujo/models.py:147-153`, reverse `template.instances`). O placement (`bujo/services/recurring.py:place_template`) grava essa FK ao criar a `Task` snapshot (AD-08 item 2).
- "Colocado neste período" = existe uma `Task` no período com `source_template = template`. O **período** vem do container da tarefa: weekly → `weekly_log.week_start`; monthly/annual → `monthly_log.month_first` (annual também mora em `monthly_log`, `recurring.py:47-53`).
- **Decisão de arquitetura do dedup:** em vez de um endpoint que devolve "templates já colocados", expomos `sourceTemplate` na `Task` e deixamos o **cliente** cruzar os templates ativos contra as tarefas do período que a página **já carrega** (`useWeeklyLogQuery`/`useMonthlyLogQuery`). Motivos: (a) zero requisição nova para o dedup; (b) espelha a filosofia "filtrar client-side" das Stories 4.5/11.2; (c) o período já está em mãos na página. O único custo é 1 campo aditivo no serializer.
- **Presença = colocado, inclusive migradas/canceladas.** Se uma instância colocada foi depois migrada/cancelada, ela ainda conta como "colocada no período" (some da sugestão). O caminho de recolocação (switch "Mostrar já colocados") cobre o caso legítimo de "preciso de outra ocorrência". Mantém simples e sem bloqueio rígido (AC1).

### AC2/AC3 — Densidade e o componente de calendário

- **Por que um endpoint de densidade e não só contar o monthly log no cliente:** `useMonthlyLogQuery` só traz tarefas do `monthly_log` daquele mês — **não** inclui as tarefas de daily logs nem de weekly logs do mês. A densidade honesta ("quantas tarefas já existem em cada dia") precisa das 3 fontes. Um endpoint de agregação tenant-scoped é a forma correta e barata (uma query de leitura, sem N buscas no cliente). Não existe hoje nenhum endpoint de contagem por dia (confirmado).
- **Root tasks only.** A densidade conta tarefas raiz (`parent_task__isnull=True`), coerente com como o app conta em todo lugar (`WeeklyLogView`, `LogSerializer.get_tasks`, `FutureLogView`). Subtarefas não inflam o dia.
- **Componente reutilizável (AC3):** `MonthDensityCalendar` nasce com props opcionais de seleção (`selectedDate`/`onSelectDay`) **desligadas** nesta story. A Story 11.6 (mover/migrar) vai ligá-las para escolher o dia de destino tocando no calendário (epics.md:817, 878). Não implementar a seleção agora — só deixar o gancho. Isso satisfaz "construído como componente reutilizável" sem inflar o escopo da 11.3.
- **Semana começa na segunda** (AD-05). Enumerar dias **sem** `new Date(isoString)` (off-by-one de UTC) — parsear por partes, `new Date(y, m-1, d)` local (mesma técnica de `WeekDaySelector`).
- **Mobile:** grid de mês num Dialog full-width. O Monthly Log "de verdade" evita grid no mobile (EXPERIENCE.md:528), mas aqui é informativo e pequeno — garantir que caiba sem scroll horizontal. Fallback da AC3 (só densidade, seleção fora) já é o estado desta story.

### Reaproveitamento obrigatório (não reinventar)

- **Dialog:** estender `RecurringPlacementDialog` existente — **não** criar um segundo diálogo. Ele já é usado por Weekly e Monthly.
- **Switch de filtro:** copiar o padrão exato do "Mostrar inativos" da Story 11.2 (`FormControlLabel` + `Switch`, default `false`) para o "Mostrar já colocados". Consistência de UX e de código.
- **Query hook:** `useTaskDensityQuery` no molde de `useMonthlyLogQuery` (api.ts:201-206). **Key** no padrão canônico de `keys.ts` (sentinel `'current'`).
- **Agregação backend:** olhar `FutureLogView` (`views.py:296-299`) que já usa `annotate(Count("tasks", filter=Q(tasks__parent_task__isnull=True)))` como precedente de contagem; e `WeeklyLogView` (`views.py:227-236`) para o bucket por `scheduled_date`.
- **`core/calendar.py`:** não tem função "dias do mês" — usar `_calendar.monthrange` (já importado, `calendar.py:7`) no backend; no frontend, enumerar por partes de data.

### Contrato de API (regeneração obrigatória)

Fluxo exato (Story 4.5 Task 9, e o CI `.github/workflows/ci.yml:74-81` valida): `uv run python manage.py spectacular --file ../schema.yaml` → `npm run generate-types`. Diff esperado **só aditivo**: `Task.sourceTemplate` + path `/api/bujo/task-density/` (+ schemas). Blocos `security` dos endpoints existentes **intactos** (guardrail retro Epic 3 §3). Se `types.gen.ts` divergir do `schema.yaml`, o CI quebra — regerar e commitar ambos.

### Multi-tenant / fail-closed (não negociável)

Toda query nova usa `Task.objects` (manager tenant-scoped: lê `current_user_id` do contextvar e **levanta `TenantScopeViolation` se ausente** — fail-closed, `core/tenant.py:44-55`). **Nunca `all_objects`.** O endpoint de densidade é uma nova superfície de leitura → **exige** teste de isolamento (Task 9.3), como toda leitura entre tenants (AD-12/Story 1.2).

### Previous Story Intelligence (11.2 — done; 4.5 — done)

- **Stack:** Backend Django + DRF + drf-spectacular + uv/pytest/ruff/lint-imports; Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. **Sem dependência nova** (não há date-picker lib — `@mui/x-date-pickers` NÃO está instalado; o calendário é construído com `@mui/material` + HTML).
- **Node 22 obrigatório** para a suíte frontend (`nvm use 22`); Node 18 quebra o vitest/rolldown (Debug Log 11.2). Flakiness de timeout → `--no-file-parallelism`.
- **`jest-axe` só pega violação real contra o componente de verdade** — nunca mockar o componente sob teste de a11y (lição repetida 3.3/4.1–4.5).
- **Mocks de barrel `features/bujo`** (`router.test.tsx`, `RouteAnnouncer.test.tsx`) quebram silenciosamente quando um export entra/sai e o mock não acompanha (achado recorrente). `MonthDensityCalendar` entra no barrel → **revalidar/atualizar** esses mocks.
- **Contagem de testes sempre real** (retro Epic 3 §1). **File List por último** (retro Epic 3 §8-2). **`security` de endpoints intacto** (retro Epic 3 §3). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.
- **Story 4.5 decidiu NÃO expor `source_template` no serializer** (YAGNI). Esta story **reverte** isso (AC1 precisa). Registrar no Completion Notes.
- **Padrão de filtro client-side** já consolidado (`RecurringPlacementSection` faz 1 fetch `active:true` e filtra por grupo; 11.2 filtra por grupo+ativos no cliente). O dedup segue a mesma linha (cruzar com o período já carregado).
- **Story 11.1 (branch Neon `e2e`) done** — a verificação manual/E2E pode rodar contra `e2e` isolada. **AR-22 (observabilidade) segue pendente, sem dono** — não bloqueia, mas continua sendo o pior follow-through do projeto (escalar antes do Épico 5).

### Git Intelligence

- Branch `main`; HEAD em `81ae849` (`feat(story-11.2): Recorrentes no Planner com abas e filtro`). Convenção de commit: `feat(story-11.3): <descrição em pt-BR>`.
- Últimos commits do Épico 11: `11.2` (81ae849), `11.1` (cfdc1ae). O Épico 4 (recorrentes/placement base) foi todo `feat(story-4.x):`.
- Diferente da 11.2 (frontend-only): esta story **toca backend** (serializer + view + urls + testes) **e** regenera contrato (`schema.yaml`/`types.gen.ts`) — `git diff --stat` esperado inclui `backend/bujo/`, `schema.yaml`, `frontend/src/api/types.gen.ts` + `frontend/src/features/bujo/` + páginas do planner.

### Project Structure Notes

- **Backend novos/alterados:** `backend/bujo/serializers.py` (+`source_template` no `TaskSerializer`), `backend/bujo/views.py` (+`TaskDensityView`), `backend/bujo/urls.py` (+rota `task-density`), `backend/bujo/tests/*` (densidade + isolamento + serializer). Padrão de view fina + serializer (Story 1.4). Nenhum arquivo em `backend/*/migrations/`.
- **Contrato:** `schema.yaml` (raiz) + `frontend/src/api/types.gen.ts` regenerados (aditivo).
- **Frontend novos:** `frontend/src/features/bujo/components/MonthDensityCalendar.tsx` (+ `.test.tsx`). **Alterados:** `RecurringPlacementDialog.tsx` (+test), `RecurringPlacementSection.tsx` (+test), `frontend/src/features/bujo/api.ts` (+`useTaskDensityQuery`, invalidações), `frontend/src/api/keys.ts` (+`taskDensity`), `frontend/src/features/bujo/index.ts` (export do calendário), `frontend/src/pages/planner/MonthlyPage.tsx`, `frontend/src/pages/planner/WeeklyPage.tsx`. Mocks de barrel a revalidar (`router.test.tsx`, `RouteAnnouncer.test.tsx`).
- **Fronteiras (§7.2):** `pages/planner` compõe `features/bujo`; `features/bujo` não importa outra feature; o novo componente vive em `features/bujo/components`. Sem violação de ESLint boundary / import-linter.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.3 (linhas 798-817 — dedup do período, recolocação sem bloqueio rígido, modal com info da recorrência + calendário de densidade informativo, componente reutilizável p/ 11.6); §Epic 11 (linha 757 — ordem por dependência: 11.3 "constrói o calendário compartilhado"; 11.6 "reusa o calendário da 11.3")]
- [Source: docs/futureIdeas.md (item #4 — recorrente some ao ser colocado; item #5 — modal com infos da recorrência + calendário do mês com indicador de tarefas por dia)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-08 (linhas 471-532 — template em tabela separada, placement gera Task snapshot com `source_template_id`, template plano sem subtarefas); #AD-03 (linhas 163-185 — schema tasks: `scheduled_date`, `parent_task_id`, `source_template_id`, `log_id`/`weekly_log_id`/`monthly_log_id` com CHECK `task_exactly_one_log`); #AD-05 (linhas 233-286 — segunda = 1º dia da semana, `weeks_of_month`, Future Log = monthly_log futuro); #AD-12 (linhas 660-690 — isolamento tenant fail-closed na camada de app)]
- [Source: backend/bujo/models.py:83-196 (Task fields incl. `source_template` FK:147-153, `scheduled_date`:109-111, CHECK task_exactly_one_log:163-170; RecurringTaskTemplate:174-196); backend/bujo/serializers.py:12-31 (`TaskSerializer.Meta.fields` a estender com `source_template`); backend/bujo/services/recurring.py:28-53 (`place_template` grava `source_template`; weekly→weekly_log, monthly/annual→monthly_log)]
- [Source: backend/bujo/views.py:212-268 (WeeklyLogView/MonthlyLogView — bucket por `scheduled_date`, `parent_task__isnull=True`), :296-299 (FutureLogView — precedente de `annotate(Count(...))`); backend/bujo/urls.py:44-55 (padrão de rota bujo p/ adicionar `task-density`); core/tenant.py:44-55 (TenantManager fail-closed — usar `Task.objects`); core/calendar.py:7,30-51 (`_calendar.monthrange`, `weeks_of_month`, `week_start_of`)]
- [Source: backend/bujo/tests/test_isolation.py (molde de teste de isolamento p/ o endpoint de densidade); core/tests/test_api_contract.py (contrato); .github/workflows/ci.yml:74-81 (gate: `spectacular` → `generate-types`, falha se `types.gen.ts` divergir)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementDialog.tsx (diálogo a enriquecer — hoje só coleta valor); RecurringPlacementSection.tsx (lista a deduplicar — 1 fetch `active:true` + filtro client-side; adicionar `placedTemplateIds` + switch "Mostrar já colocados"); WeekDaySelector.tsx:14-22 (técnica de parse de data por partes contra off-by-one de UTC)]
- [Source: frontend/src/features/bujo/api.ts:201-206 (`useMonthlyLogQuery` molde p/ `useTaskDensityQuery`), :420-434 (`usePlaceRecurringTemplateMutation` — adicionar invalidação de `taskDensity`); frontend/src/api/keys.ts:13-25 (seção `bujo` — adicionar `taskDensity` no padrão canônico); frontend/src/features/bujo/index.ts (barrel — exportar `MonthDensityCalendar`)]
- [Source: frontend/src/pages/planner/MonthlyPage.tsx:60,73,221-237 (`placingTemplateId`, `groupTasksByScheduledDate`, fiação do Section/Dialog — computar `placedTemplateIds` de `tasks.sourceTemplate`, passar `template`+`monthFirst`); frontend/src/pages/planner/WeeklyPage.tsx:101-122 (fiação equivalente; `monthFirst` = mês do `weekStart`)]
- [Source: _bmad-output/implementation-artifacts/11-2-recorrentes-no-planner-com-abas-e-filtro.md (padrão `Switch`+`FormControlLabel` "Mostrar inativos"; Node 22 + `--no-file-parallelism`; mocks de barrel; jest-axe contra componente real); _bmad-output/implementation-artifacts/4-5-templates-de-tarefas-recorrentes-com-placement-manual.md#Task 9.4 (decisão YAGNI de NÃO expor `source_template` — revogada aqui)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 (contagem real de testes), §3 (`security` de endpoints intacto), §8 (File List por último) — guardrails em `_bmad/custom/bmad-dev-story.toml`; _bmad-output/implementation-artifacts/2-4-baseline-de-acessibilidade-wcag-2-2-aa.md (baseline WCAG 2.2 AA — jest-axe gate, aria-label em grids)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md:528 (Monthly Log no mobile é lista vertical, sem grid — cuidado de layout do calendário no Dialog mobile); DESIGN.md (densidade/tom honesto, variantes de tema `body-sm`/`label`, sem ícone celebratório)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- **Backend / remote Neon test DB (Story 11.1):** a suíte roda contra a branch Neon `test_neondb` real (não sqlite) — cada run leva ~13 min. Um teardown que falhou ("database is being accessed by other users") deixou `test_neondb` órfão e o run seguinte quebrou com `database "test_neondb" already exists`. Contornado com `uv run pytest --reuse-db` (nenhuma migração nova nesta story → schema já corrente). O run oficial de fechamento: **323 passed** (`--reuse-db`, 797s).
- **Envelope de erro de validação:** os 2 primeiros testes de 400 do `TaskDensityView` falharam porque o handler custom embrulha os erros como `{"detail": "Validation failed", "fields": {...}}` — o campo fica em `response.data["fields"]["month_first"]`, não no topo. Assertions corrigidas.
- **PK relacionada no `.data` do serializer:** `TaskSerializer(task).data["source_template"]` devolve um objeto `UUID` (não `str`) em Python — igual ao precedente de `migrated_to_task`. Comparação ajustada para `== template.id`.
- **Frontend / flakiness de paralelismo (Debug Log 11.2):** `npm run test` em paralelo total deu 10 timeouts ambientais (não asserção). Rerun com `--no-file-parallelism` → **415 passed / 44 files**. Node 22.
- **Lint do ESLint:** um `// eslint-disable-next-line react/no-array-index-key` quebrou o lint ("rule not found") porque a regra não está configurada neste projeto; comentário removido (índice como chave já é permitido aqui).
- **E2E dedup:** minha mudança de dedup quebrava `recurring-templates.spec.ts` (o AC3 recolocava o mesmo template sem ligar o switch). Spec atualizada: agora liga "Mostrar já colocados" e recoloca via "(já colocado)". Servidores e2e pré-aquecidos (cold-start Neon, lição 11.2) → **2/2 passed (44.6s)**, zero erros de console (prova que o endpoint de densidade responde no browser real).

### Completion Notes List

Story **backend + frontend** (diferente da 11.2, frontend-only). Duas mudanças de backend — **(1)** expor `source_template` (campo que já existia no modelo) no `TaskSerializer`; **(2)** um endpoint novo de leitura agregada `GET /api/bujo/task-density/`. **Nenhuma migração, nenhum campo de modelo novo, nenhuma mudança na máquina de estados** — schema `tasks`/`recurring_task_templates` congelado (AD-03/AD-08).

- **AC1 (dedup + recolocação):** `TaskSerializer` agora expõe `sourceTemplate` (revoga conscientemente a decisão YAGNI da Story 4.5 Task 9.4). As páginas Weekly/Monthly cruzam os templates ativos contra as tarefas do período já carregado (`tasks.sourceTemplate`) — **zero requisição nova** para o dedup, espelhando o filtro client-side de 4.5/11.2. `RecurringPlacementSection` esconde os já-colocados por padrão; o `Switch` "Mostrar já colocados" (mesmo padrão do "Mostrar inativos" da 11.2) é o **caminho explícito de recolocação sem bloqueio rígido** — reaparecem com "(já colocado)" e o botão "Definir placement" cria nova instância.
- **AC2 (modal + calendário):** `RecurringPlacementDialog` enriquecido com título/descrição/`recurrenceText` do template + `MonthDensityCalendar`. O endpoint `TaskDensityView` agrega as **3 fontes** de "tarefa num dia" (daily por `log_date`; weekly/monthly por `scheduled_date`), **só raízes** (`parent_task__isnull=True`), somando contagens de datas coincidentes; retorna só dias `count > 0` ordenados. `Task.objects` (tenant-scoped, fail-closed) — teste de isolamento incluído (AD-12). `scheduled_date NULL` não conta.
- **AC3 (componente reutilizável):** `MonthDensityCalendar` nasce com props opcionais `selectedDate?`/`onSelectDay?` **desligadas** nesta story (informativo). Grid começa na segunda (AD-05), datas parseadas por partes (sem off-by-one de UTC). Quando `onSelectDay` for passado (gancho da Story 11.6), os dias viram `ButtonBase` acessíveis; sem ele, células puramente informativas. Exportado no barrel para a 11.6.
- **Contrato:** `spectacular` → `generate-types`, diff **só aditivo** (`Task.sourceTemplate` nullable uuid + path `/api/bujo/task-density/` + schemas `TaskDensityEntry`/`TaskDensityResponse`). `security: jwtAuth` presente no endpoint novo (herdado do `DEFAULT_PERMISSION_CLASSES=IsAuthenticated` global — nenhuma config de auth tocada). Re-verificação por regeneração em temp + `diff` → **zero diff** (schema e types).
- **Invalidação de cache:** `usePlaceRecurringTemplateMutation` e `useCreateMonthlyTaskMutation` invalidam `['bujo','taskDensity']` por prefixo. (`useCreateWeeklyTaskMutation` citada na Task 4.4 **não existe** — tarefa de semana só nasce por placement, já coberto.)
- **Contagens reais (guardrail Epic 3 §1):** Backend **323 passed** (`uv run pytest --reuse-db`; +12 vs. baseline: 2 serializer + 10 view de densidade). Frontend **415 passed / 44 files** (`--no-file-parallelism`, Node 22; era 392/42 na 11.2). `ruff` ✓, `manage.py check` ✓, `typecheck` ✓, `lint` ✓, `build` ✓. E2E `recurring-templates.spec.ts` **2/2** contra a branch Neon `e2e`.
- **Barrel mocks:** `router.test.tsx`/`RouteAnnouncer.test.tsx` **não** precisaram de atualização (os factories só listam os exports que usam; o novo `MonthDensityCalendar` não é importado por eles) — revalidados via suíte verde. Achado recorrente 4.3–4.5 **não** se materializou aqui.
- **⚠️ Pré-existente, não introduzido por 11.3 — `lint-imports` quebrado:** `uv run lint-imports` falha com "core must not import domain apps": `core.management.commands.purge_e2e_users` e `core.tests.test_purge_e2e_users` importam `bujo` (l.24-26). Confirmado presente no HEAD `81ae849` (introduzido pela Story 11.1, `purge_e2e_users`), **fora do diff desta story** (nenhum arquivo `core/` tocado). Não corrigido aqui (fora do escopo de tarefa da 11.3). **Recomendo escalar** — é um gate de CI da Task 11.1 quebrado desde a 11.1; candidato a AR na retro do Épico 11.

### File List

**Backend (modificados)**
- `backend/bujo/serializers.py` — `source_template` no `TaskSerializer`; serializers de densidade (`TaskDensityQuerySerializer`/`TaskDensityEntrySerializer`/`TaskDensityResponseSerializer`)
- `backend/bujo/views.py` — `TaskDensityView`
- `backend/bujo/urls.py` — rota `task-density/`
- `backend/bujo/tests/test_serializers.py` — campos + `source_template` (comum e pós-placement)
- `backend/bujo/tests/test_views.py` — 10 testes de `TaskDensityView` (agregação, NULL, raízes, mês, 400s, isolamento, 401)

**Contrato (regenerado, aditivo)**
- `schema.yaml`
- `frontend/src/api/types.gen.ts`

**Frontend (novos)**
- `frontend/src/features/bujo/components/MonthDensityCalendar.tsx`
- `frontend/src/features/bujo/components/MonthDensityCalendar.test.tsx`
- `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx`

**Frontend (modificados)**
- `frontend/src/api/keys.ts` — `taskDensity`
- `frontend/src/features/bujo/api.ts` — `useTaskDensityQuery` + invalidações de densidade
- `frontend/src/features/bujo/types.ts` — `TaskDensityEntry`/`TaskDensityResponse`
- `frontend/src/features/bujo/index.ts` — barrel: `MonthDensityCalendar`, `useTaskDensityQuery`, tipos de densidade
- `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx` — infos da recorrência + calendário + query de densidade
- `frontend/src/features/bujo/components/RecurringPlacementSection.tsx` — dedup + switch "Mostrar já colocados"; `onPlace(template)`
- `frontend/src/pages/planner/MonthlyPage.tsx` — `placedTemplateIds`, `template`+`monthFirst` no diálogo
- `frontend/src/pages/planner/WeeklyPage.tsx` — idem; `monthFirst` = mês do `weekStart`
- `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx` — nova assinatura + dedup/switch
- `frontend/src/pages/planner/MonthlyPage.test.tsx` — dedup + densidade
- `frontend/src/pages/planner/WeeklyPage.test.tsx` — dedup + densidade
- `frontend/e2e/recurring-templates.spec.ts` — dedup/recolocação + infos+calendário no modal (real-stack)

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-14 | 0.1 | Implementação da Story 11.3: dedup de placement (AC1), modal enriquecido + `MonthDensityCalendar` (AC2), componente reutilizável com gancho p/ 11.6 (AC3); endpoint `task-density` + `sourceTemplate` no serializer; contrato regenerado (aditivo). Backend 323 passed, Frontend 415 passed, E2E 2/2. Status → review. | Amelia (dev-story) |
| 2026-07-14 | 0.2 | Code review adversarial (story-automator): 0 issues confirmados após verificação independente. Status → done. | story-automator-review |

## Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (via story-automator-review) on 2026-07-14

### Outcome: **Approve**

### Verificação independente (não apenas leitura das claims)

- **Git vs File List:** `git status`/`git diff --name-only` batido contra o File List — zero discrepância em código de aplicação (só `_bmad-output/` de tracking difere, fora do escopo desta review).
- **Backend:** `uv run pytest --reuse-db` → **323 passed** (bate exatamente com a claim). `ruff check .` limpo. `manage.py check` sem issues. `lint-imports` **confirmado quebrado** (`core.management.commands.purge_e2e_users`/`core.tests.test_purge_e2e_users` → `bujo`), mas confirmado **pré-existente** (nenhum arquivo `core/` no diff desta story) — claim do Completion Notes é precisa.
- **Frontend:** `npm run typecheck` / `npm run lint` / `npm run build` limpos. `npm run test -- --no-file-parallelism` (Node 22) → **415 passed / 44 files** (bate exatamente com a claim).
- **Contrato:** regenerado do zero em arquivos temporários (`manage.py spectacular` + `openapi-typescript`) e comparado via `diff` contra `schema.yaml`/`types.gen.ts` commitados → **zero diff** em ambos. Confirma Task 3 e Task 11.3 de forma mais forte do que a claim original (que também alega zero diff).
- **AC1 (dedup):** `sourceTemplate` exposto em `TaskSerializer` e confirmado propagado a **todas** as superfícies de leitura de tarefa (`LogSerializer.get_tasks`, `WeeklyLogSerializer.unscheduled`, `MonthlyLogSerializer.tasks`, demais filas) por reuso do mesmo serializer — Task 1.3 verificado por leitura de código. Confirmado **read-only de fato**: `TaskSerializer` só é instanciado como `TaskSerializer(instance)` (nunca `data=...`) em todo `views.py` — nenhum write path aceita o campo.
- **AC1 (recolocação):** `RecurringPlacementSection` esconde já-colocados por padrão; switch "Mostrar já colocados" (mesmo padrão do "Mostrar inativos" da 11.2) reexibe com sufixo e permite nova instância — sem bloqueio rígido. `placedTemplateIds` opcional com default `new Set()` preserva compat.
- **AC2 (modal + densidade):** `TaskDensityView` agrega as 3 fontes corretamente (raízes, `scheduled_date` NULL excluído, soma por data coincidente, `Task.objects` tenant-scoped fail-closed com teste de isolamento dedicado). `RecurringPlacementDialog` exibe título/descrição/`recurrenceText` e monta `MonthDensityCalendar` via `useTaskDensityQuery(monthFirst, { enabled: open })`.
- **AC3 (componente reutilizável):** `MonthDensityCalendar` aceita `selectedDate?`/`onSelectDay?` opcionais, desligados nesta story (sem `onClick`/estado quando `onSelectDay` ausente — coberto por teste dedicado). Grid começa na segunda (AD-05); datas parseadas por partes (`new Date(y, m-1, d)` local), mesma técnica de `WeekDaySelector`, com teste-âncora de off-by-one.
- **Testes:** todos os testes novos (backend e frontend) lidos e re-executados isoladamente antes da suíte completa — nenhum placeholder, todas as asserções reais e específicas (contagens exatas, `aria-label` exato, isolamento multi-tenant).

### Findings

Nenhum issue CRITICAL, HIGH ou MEDIUM sobreviveu à verificação. Revisão adversarial completa (backend + frontend + contrato + testes reexecutados) não encontrou regressões, claims falsas, ou lacunas de cobertura nas ACs. Este é um dos ciclos mais limpos observados no projeto — todas as contagens de teste e o diff de contrato batem exatamente com o que o Dev Agent Record reivindica, o que é incomum o suficiente para valer o registro.

### Observação para follow-up (não bloqueia)

- `lint-imports` segue quebrado desde a Story 11.1 (`core` → `bujo` via `purge_e2e_users`), sem dono. Consistente com a memória do projeto — escalar antes do Épico 5.
