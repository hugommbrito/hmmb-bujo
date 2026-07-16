---
baseline_commit: 5d677f7
---

# Story 11.11: Navegar e agir em logs passados não-fechados

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero navegar para semanas, meses e dias passados que ainda não fecharam e agir sobre suas pendências,
Para que pendências de períodos passados abertos não fiquem presas — hoje o Arquivo lista só fechados e não há navegação para alcançá-las; só os rituais de revisão/catch-up as expõem.

Última story do 2º lote do Épico 11 (Correct Course 2026-07-15). Depende da Story 11.10 (`TaskDestinationDialog`, done) — "Migrar" a partir de um período passado aberto reusa o seletor já reformulado. Decisões de arquitetura em **AD-16** (`architecture.md:761-775`), ponto 4.

## Acceptance Criteria

### AC1 — Esta Semana / Este Mês: navegação livre para períodos passados

- **Dado que** as telas Esta Semana / Este Mês,
- **Então** cada uma ganha um controle explícito de navegação **anterior/próximo** (não existe hoje — ver Dev Notes "Achado crítico #1") que avança/recua um período (semana ou mês) por clique, reusando `useWeeklyLogQuery(weekStart)`/`useMonthlyLogQuery(monthFirst)` e a rota já existente `/archive/weekly/:weekStart`/`/archive/monthly/:monthFirst` (sem rota nova) — o backend já serve qualquer período via `week_start`/`month_first` (`WeeklyLogView`/`MonthlyLogView`, sem mudança).
- **Dado que** o período exibido é o período corrente (semana ou mês atual),
- **Então** o controle "próximo" fica desabilitado/ausente — esta story só abre navegação para **trás**; ir além do corrente para o futuro é fora de escopo (a superfície Futuro, `FuturePage`, já cobre isso).

### AC2 — Daily Log de um dia passado é navegável

- **Dado que** um dia dentro de Esta Semana/Este Mês (período corrente ou passado, aberto ou fechado),
- **Quando** clico na data do cabeçalho daquele dia (`DayHeader`, novo link),
- **Então** vejo o Daily Log daquele dia numa página dedicada (`/daily/:date`, nova rota) — única adição de backend desta story: uma leitura de Daily Log por data (`TodayLogView` estendido com o parâmetro `log_date`, mesmo padrão de `WeeklyLogView`/`MonthlyLogView`); nenhum modelo/serializer novo.
- **Dado que** o dia é **hoje** ou está no **futuro** (dentro da grade de Esta Semana/Este Mês corrente),
- **Então** o link **não aparece** para dias futuros (nada para consultar com certeza; a data se torna "hoje" naturalmente) e o dia de hoje aponta para a rota canônica `/today` (não para `/daily/<hoje>`, evitando uma segunda chave de cache para o mesmo conteúdo).

### AC3 — Período passado aberto permanece acionável (sem guardrail novo)

- **Dado que** um período passado (semana, mês ou dia) com pelo menos uma tarefa `pending`/`started` (não-fechado),
- **Então** posso agir sobre suas tarefas normalmente: abrir detalhes/editar, excluir, migrar (inclusive via o seletor completo da Story 11.10) e — só no Daily Log — transicionar de estado e reordenar. `_check_container_open` (Story 11.5, `backend/bujo/services/tasks.py:13-19`) já é a única fronteira de escrita e **já** trata corretamente esse caso (não distingue "corrente" de "passado", só fechado/aberto) — nenhum código de permissão novo no backend.
- **Dado que** o formulário de adicionar tarefa (Esta Semana/Este Mês) e o `AddTaskRow` do Daily Log,
- **Então** o formulário de Esta Semana/Este Mês **também** funciona num período passado aberto (mesma regra de AC3), mas **adicionar uma tarefa nova direto num Daily Log passado fica fora de escopo** — `TaskCreateView`/`create_task` não aceita hoje uma data arbitrária para o container `log` (só `today_for(user)`), e o AD-16 não pede essa adição de backend. O Daily Log passado permite agir sobre tarefas **existentes**, não criar novas.

### AC4 — Período passado fechado permanece somente-leitura (sem regressão)

- **Dado que** um período passado **fechado** (Story 4.6),
- **Então** segue somente-leitura: sem formulário de adicionar tarefa, sem abrir `TaskDetailPanel`, sem `RecurringPlacementSection` — exatamente como hoje no Arquivo. Esta story **corrige o mecanismo** que produz esse resultado (ver Dev Notes "Achado crítico #2" — hoje o read-only é acionado por `isArchiveView`, não por `closed`) sem mudar o comportamento observável desse caso.
- **Dado que** a superfície Arquivo (Story 4.6, listagem de fechados) e seus testes de a11y/regressão,
- **Então** continuam idênticos — nenhuma mudança em `ArchiveView`/`ArchivePage.tsx`/`list_closed_cycles`.

### AC5 — Distinção visual de 3 estados + caminho de volta ao atual

- **Dado que** Esta Semana/Este Mês exibindo um período,
- **Então** há distinção visual clara entre os três estados possíveis: **corrente** (sem indicador extra, comportamento de hoje), **passado aberto** (novo indicador, ex. "Semana anterior"/"Mês anterior" — texto informativo, sem ícone, mesmo tom do indicador "Fechada"/"Fechado" já existente) e **passado fechado** (indicador "Fechada"/"Fechado" já existente, sem mudança).
- **Dado que** estou vendo um período **não-corrente** (aberto ou fechado),
- **Então** há um caminho explícito de volta — um link/botão "Voltar para a semana atual"/"Voltar para o mês atual" — sem depender só da navegação lateral (sidebar/bottom-nav), que já existe mas não é contextual ao fluxo de navegar-para-trás.

## Tasks / Subtasks

> **Escopo real:** 1 leitura nova de backend (Daily Log por data, extensão de `TodayLogView`) + 2 achados críticos de frontend que **precisam de correção antes** de qualquer navegação nova funcionar corretamente (ver Dev Notes) + navegação anterior/próximo em Esta Semana/Este Mês + nova rota/página do Daily Log por data + link de drill-down do dia. **Sem migração de banco, sem endpoint novo** (extensão de endpoint existente), sem novo modelo/serializer.

### Backend

- [x] **Task 1: Leitura do Daily Log por data — estender `TodayLogView`** (AC2)
  - [x] 1.1 Em `backend/bujo/views.py:54-59`, estender `TodayLogView.get` para aceitar `log_date` via query param, espelhando **exatamente** o padrão de `WeeklyLogView.get` (`views.py:237-247`):
    ```python
    class TodayLogView(APIView):
        @extend_schema(responses=LogSerializer)
        def get(self, request):
            log_date_param = request.query_params.get("log_date")
            if log_date_param:
                try:
                    log_date = date.fromisoformat(log_date_param)
                except ValueError:
                    raise serializers.ValidationError(
                        {"log_date": "Data inválida. Use o formato AAAA-MM-DD."}
                    ) from None
            else:
                log_date = today_for(request.user)
            log = get_or_create_daily_log(user=request.user, log_date=log_date)
            return Response(LogSerializer(log).data)
    ```
    Nenhuma mudança em `get_or_create_daily_log` (`backend/bujo/services/logs.py:8-17`) — já aceita `log_date` arbitrário, é a **view** que está hardcoded (não o serviço). Nenhuma restrição de data futura (mesma ausência de restrição de `WeeklyLogView`/`MonthlyLogView`, que também não limitam `week_start`/`month_first`).
  - [x] 1.2 **Nenhuma mudança em `LogSerializer`** (`backend/bujo/serializers.py`, campos `id`/`log_date`/`tasks`) — Daily Log não tem conceito de "fechado" (só `WeeklyLog`/`MonthlyLog`, Story 4.6/FR-1.10); `_check_container_open` (`backend/bujo/services/tasks.py:13-19`) já documenta isso: *"Daily (`log`) nunca entra nesse check"*. Confirmar isso na leitura, não implementar nada novo.
  - [x] 1.3 **Sem impacto em `schema.yaml`/`types.gen.ts`** — mesma situação da Story 11.10 Task 1: `week_start`/`month_first` também não são documentados via `@extend_schema(parameters=...)` hoje (gap pré-existente, fora de escopo corrigir); `log_date` segue o mesmo padrão não anotado. Verificar com `git diff` que nenhum desses dois arquivos aparece no diff final.
  - [x] 1.4 Nome da URL/rota do backend **não muda** (`path("logs/today/", TodayLogView.as_view(), name="bujo-today-log")`, `backend/bujo/urls.py:26`) — só o `GET` ganha um parâmetro opcional, mesmo endpoint.

- [x] **Task 2: Testes de backend** (AC2)
  - [x] 2.1 Em `backend/bujo/tests/test_views.py` (módulo de `TodayLogView`, docstring linha 1), adicionar: `GET /api/bujo/logs/today/?log_date=<data passada>` → 200, `log_date` no corpo bate com o parâmetro, idempotente (2 chamadas seguidas retornam o mesmo `id`) — mesmo padrão de `test_get_today_log_e_idempotente` (linha 29). `GET ...?log_date=data-invalida` → 400 com `{"log_date": [...]}`, mesmo padrão dos testes de `week_start`/`month_first` inválidos já existentes para `WeeklyLogView`/`MonthlyLogView`. `GET ...` sem `log_date` continua retornando o log de hoje (regressão — nenhum teste existente de `TodayLogView` deve mudar de comportamento).
  - [x] 2.2 Confirmar (via teste ou leitura, registrar o resultado nas Completion Notes) que uma tarefa criada num Daily Log passado (via `factory_boy`/fixture direta, já que `TaskCreateView` não aceita `log_date`) pode ser editada/excluída/transicionada/migrada normalmente — i.e., que **nenhum** teste novo de guardrail é necessário em `test_services.py` para este caso (`_check_container_open` já ignora `log`, ver Task 1.2).
  - [x] 2.3 `ruff check . && lint-imports && manage.py check` verdes; **colar contagem real** de `pytest` ao fim (guardrail retro Epic 3 §1). Baseline de sanidade (11.10, pós-review): **364 passed**.

### Frontend — Corrigir o acoplamento `isArchiveView`/somente-leitura (pré-requisito)

- [x] **Task 3: Read-only deve depender só de `closed`, nunca de "a página tem um parâmetro de rota"** (AC1, AC3, AC4 — ver Dev Notes "Achado crítico #2", bug pré-existente descoberto nesta análise)
  - [x] 3.1 Em `frontend/src/pages/planner/WeeklyPage.tsx:76`, trocar `const onOpenDetail = !isArchiveView && !closed ? setOpenTaskId : undefined` por `const onOpenDetail = !closed ? setOpenTaskId : undefined`. Em `frontend/src/pages/planner/WeeklyPage.tsx:171`, trocar a guarda `{!isArchiveView && !closed && (...)}` do formulário/`RecurringPlacementSection`/`RecurringPlacementDialog` por `{!closed && (...)}`.
  - [x] 3.2 Mesma mudança em `frontend/src/pages/planner/MonthlyPage.tsx:94` (`onOpenDetail`) e `frontend/src/pages/planner/MonthlyPage.tsx:190` (guarda do formulário/recorrentes).
  - [x] 3.3 `isArchiveView` (`Boolean(routeWeekStart)`/`Boolean(routeMonthFirst)`) **continua existindo** — ainda é usado no `aria-label` (`"Arquivo — Semana de ..."` vs `"Esta Semana"`) e na leitura de `useWeeklyLogQuery(routeWeekStart)`/`useMonthlyLogQuery(routeMonthFirst)`. Só o **efeito de bloquear escrita** deixa de depender dele.
  - [x] 3.4 **Teste a inverter (não é regressão nova, é o comportamento que a AC3 exige):** `frontend/src/pages/planner/WeeklyPage.test.tsx:426` (`'form não aparece em isArchiveView'`, hoje passa com `closed: false` na rota de arquivo) — o comportamento correto agora é o **formulário aparecer** quando `closed: false`, mesmo na rota `/archive/weekly/:weekStart`. Renomear/reescrever o teste para refletir a regra nova (`'form aparece em período passado aberto (closed: false) mesmo via rota parametrizada'` + manter um teste separado para `closed: true` → formulário não aparece, já coberto por `WeeklyPage.test.tsx:418`). Mesma correção em `frontend/src/pages/planner/WeeklyPage.test.tsx:455` (`'painel não abre... quando isArchiveView'`, hoje com `closed: true` — este caso já está correto no resultado, mas o *nome*/framing do teste deve deixar claro que é `closed: true` que bloqueia, não a rota; ver também o par `WeeklyPage.test.tsx:465`, que já testa exatamente isso no período corrente). Mesma varredura em `MonthlyPage.test.tsx` (linhas equivalentes ~493/546, confirmar durante a implementação).

### Frontend — Esta Semana / Este Mês: navegação anterior/próximo + estados visuais

- [x] **Task 4: Controle de navegação anterior/próximo** (AC1)
  - [x] 4.1 Em `WeeklyPage.tsx`, calcular a semana corrente client-side (mesma técnica de UI-não-autoridade-de-domínio já usada por `currentMonthFirst()` em `MonthlyPage.tsx:25-30` e pelo cálculo de "hoje"/"semana atual" em `MonthDensityCalendar.tsx`, Story 11.10 Task 3) — função local `currentWeekStart()` (segunda-feira da semana de `new Date()`, mesma técnica Monday-based já usada no projeto). Comparar com `weekStart` (do log carregado) para saber se é a semana corrente.
  - [x] 4.2 Adicionar dois `IconButton` (ex. `NavigateBeforeIcon`/`NavigateNextIcon` do MUI, mesma família de ícones já usada no projeto) no topo da página: "Semana anterior" navega (via `useNavigate`/`Link`) para `/archive/weekly/${weekStartMenosSeteDias}`; "Próxima semana" só aparece/habilita quando a semana exibida **não** é a corrente, e navega para `/archive/weekly/${weekStartMaisSeteDias}` **exceto** quando o destino calculado for a própria semana corrente — nesse caso navega para a rota canônica `/planner/week` (sem parâmetro), mantendo a URL "limpa" quando se está de volta ao presente.
  - [x] 4.3 Mesmo padrão em `MonthlyPage.tsx`, usando o `isCurrentMonth`/`currentMonthFirst()` **já existentes** (`MonthlyPage.tsx:25-30,82`) — não recalcular, só reusar. Anterior/próximo navegam para `/archive/monthly/${monthFirst±1 mês}`, com o mesmo caso especial de cair em `/planner/month` quando o destino é o mês corrente.
  - [x] 4.4 **Sem rota nova** — os controles apontam para as rotas `archive/weekly/:weekStart`/`archive/monthly/:monthFirst` **já existentes** (`frontend/src/app/router.tsx:106-113`), que já renderizam `WeeklyPage`/`MonthlyPage` parametrizados; a Task 3 já garantiu que passar por essa rota não força mais somente-leitura quando `closed: false`.

- [x] **Task 5: Distinção visual de 3 estados + link de volta ao atual** (AC5)
  - [x] 5.1 Em `WeeklyPage.tsx`/`MonthlyPage.tsx`, ao lado do indicador `closed` já existente (`WeeklyPage.tsx:108-112` "Fechada"; `MonthlyPage.tsx:150-154` "Fechado"), adicionar um indicador para o caso `!closed && !isCurrentPeriod`: texto informativo curto (ex. "Você está vendo uma semana passada."/"Você está vendo um mês passado.") — mesmo estilo tipográfico (`Typography variant="heading"` ou `body-sm`, sem ícone, consistente com "sem ícone celebratório" já estabelecido para o indicador "Fechada").
  - [x] 5.2 Junto do indicador da Task 5.1 (só quando `!isCurrentPeriod`, fechado ou aberto), um link/botão "Voltar para a semana atual"/"Voltar para o mês atual" apontando para `/planner/week`/`/planner/month` (rota canônica, sem parâmetro).
  - [x] 5.3 **Reusar, não recalcular:** o destaque de "hoje"/"semana atual" dentro do `MonthDensityCalendar` (Story 11.10, `data-today`/`data-current-week`) é um componente diferente (calendário de placement/migração) e **não** precisa de nenhuma mudança aqui — este Task 5 é sobre o cabeçalho da própria página Esta Semana/Este Mês, não sobre o calendário de densidade.

### Frontend — Daily Log por data

- [x] **Task 6: Camada de dados — Daily Log por data (query/cache)** (AC2, AC3)
  - [x] 6.1 Em `frontend/src/api/keys.ts:14`, generalizar `todayLog: () => ['bujo', 'dailyLog', 'today'] as const` para `todayLog: (logDate?: string) => ['bujo', 'dailyLog', logDate ?? 'today'] as const` — **compatível com todos os call-sites existentes** (`todayLog()` sem argumento continua produzindo a mesma chave de hoje).
  - [x] 6.2 Em `frontend/src/features/bujo/api.ts:26-36`, generalizar `fetchTodayLog`/`useTodayLogQuery` mirando exatamente `fetchWeeklyLog`/`useWeeklyLogQuery` (`api.ts:185-197`):
    ```ts
    async function fetchTodayLog(logDate?: string): Promise<Log> {
      const response = await client.get<Log>('/api/bujo/logs/today/', {
        params: logDate ? { log_date: logDate } : undefined,
      })
      return response.data
    }

    export function useTodayLogQuery(logDate?: string) {
      return useQuery({
        queryKey: keys.bujo.todayLog(logDate),
        queryFn: () => fetchTodayLog(logDate),
      })
    }
    ```
  - [x] 6.3 **Transição/reordenação precisam do parâmetro de data para mirar o cache certo** (`useTransitionTaskMutation`, `api.ts:48-62`; `useReorderTaskMutation`, `api.ts:174-183`) — são as **únicas** duas mutações usadas só pelo Daily Log (Weekly/Monthly não passam `onTransition`/`onReorder` ao `TaskRow`), e hoje miram `keys.bujo.todayLog()` fixo, sem fallback de invalidação por prefixo (diferente de update/delete/migrate — ver Task 6.4). Generalizar as duas para aceitar `logDate?: string` e passar `queryKey: keys.bujo.todayLog(logDate)` ao `useOptimisticMutation`. Chamadas existentes (`DailyPage.tsx` atual, sem parâmetro) continuam idênticas.
  - [x] 6.4 **Editar/excluir/migrar uma tarefa dentro de um Daily Log passado precisa alcançar a chave de cache certa na invalidação** (achado desta análise — ver Dev Notes "Achado crítico #3"). `useDeleteTaskMutation` (`api.ts:233-247`, linha `queryClient.invalidateQueries({ queryKey: keys.bujo.todayLog() })`) e `useMigrateTaskMutation` (`api.ts:365-383`, mesma linha) invalidam hoje a chave **exata** `['bujo','dailyLog','today']` — que não alcança `['bujo','dailyLog','2026-07-10']` (chave de um dia passado). Trocar essas duas ocorrências de `keys.bujo.todayLog()` por `['bujo', 'dailyLog']` (prefixo, mesma técnica **já usada nas mesmas funções** para `['bujo','weeklyLog']`/`['bujo','monthlyLog']`) — alcança "hoje" e qualquer data passada, sem mudar nenhum comportamento hoje observável (o caso "hoje" continua invalidado, só o alcance fica mais amplo). Em `useUpdateTaskMutation` (`api.ts`, bloco `mutationOptions.onSuccess` que hoje só invalida `['bujo','weeklyLog']`/`['bujo','monthlyLog']`), **adicionar** `queryClient.invalidateQueries({ queryKey: ['bujo', 'dailyLog'] })` à mesma lista — sem isso, editar uma tarefa de um Daily Log passado via `TaskDetailPanel` faria um update otimista "no-op" (mesmo padrão hoje aceitável para Weekly/Monthly, comentário em `api.ts` linha ~152) sem nunca convergir para o servidor. **Não** propagar `logDate` como prop por `TaskDetailPanel`/`TaskRow` — a invalidação por prefixo já resolve sem nenhuma mudança de assinatura nesses dois componentes.
  - [x] 6.5 `useCreateTaskMutation`/`useCreateSubtaskMutation` **não mudam** — criação de tarefa raiz continua restrita a hoje (Task 1.2/AC3), e criação de subtarefa a partir de um Daily Log passado não é um caso novo introduzido por esta story (mesmo comportamento pré-existente de qualquer container não-hoje).

- [x] **Task 7: Nova rota + página do Daily Log por data** (AC2, AC3)
  - [x] 7.1 Em `frontend/src/app/router.tsx`, adicionar `{ path: 'daily/:date', element: <DailyPage />, handle: { title: 'Daily Log' } }` (reusa o componente `DailyPage`, mesmo padrão de `WeeklyPage`/`MonthlyPage` reusados pela rota de arquivo). **Não confundir** com o `/api/daily/{date}/` mencionado em `architecture.md` (§7.3/AD-14) — aquele é um endpoint agregado de backend **reservado e não construído**, para prefetch cross-domínio (NFR-2); esta rota é só de frontend, só bujo, e não tem relação.
  - [x] 7.2 Em `frontend/src/pages/daily/DailyPage.tsx`, ler `const { date: routeDate } = useParams<{ date: string }>()` (mesmo padrão de `WeeklyPage.tsx:36`). Passar `routeDate` para `useDailyData(routeDate)` (`frontend/src/pages/daily/useDailyData.ts:6-10`, generalizar a assinatura — `useTodayLogQuery(logDate)` internamente).
  - [x] 7.3 Quando `routeDate` está presente (visualização de um dia passado): **não** renderizar `MigrationBanner`/`WeeklyReviewBanner`/`MonthlyReviewBanner`/`CatchUpBanner` (`DailyPage.tsx:75-78`) — são rituais de "hoje", sem sentido para um dia passado. **Não** renderizar `AddTaskRow` (`DailyPage.tsx:96`) nem o atalho de teclado `N` (`DailyPage.tsx:32-56`) — criação fica restrita a hoje (Task 1.2/6.5). **Manter** `TaskRow` com `onTransition`/`onOpenDetail`/`siblings`/`onReorder` funcionando normalmente (AC3) — passar `useTransitionTaskMutation(routeDate)`/`useReorderTaskMutation(routeDate)` (Task 6.3).
  - [x] 7.4 `aria-label` do `Box component="main"` (`DailyPage.tsx:60,74`) passa a refletir a data quando `routeDate` presente (ex. `` `Daily Log de ${routeDate}` ``), mantendo `'Hoje'` quando não há parâmetro (comportamento atual intacto).
  - [x] 7.5 Adicionar um link "Voltar para hoje" quando `routeDate` presente, mesmo padrão da Task 5.2 — apontando para `/today`.

- [x] **Task 8: Link de drill-down do dia (Esta Semana/Este Mês → Daily Log do dia)** (AC2)
  - [x] 8.1 Em `frontend/src/features/bujo/components/DayHeader.tsx`, adicionar uma prop opcional (ex. `linkToDaily?: boolean`, default `false`) que, quando `true` **e** a data (`logDate`) não é futura, envolve o `Typography` do cabeçalho (`DayHeader.tsx:44`) num `RouterLink` para `/daily/${logDate}` — **exceto** quando `logDate` é hoje, que aponta para `/today` (rota canônica, evita uma segunda entrada de cache para o mesmo conteúdo, ver AC2). Dias futuros (dentro da grade de Esta Semana/Este Mês corrente) **não** ficam clicáveis — sem link, texto plano como hoje.
  - [x] 8.2 Em `WeeklyPage.tsx` (chamadas em `DayHeader` nas linhas ~120 e ~143) e `MonthlyPage.tsx` — **duas chamadas a atualizar, não uma**: linha ~163 (branch `isCurrentMonth`) **e** linha ~177 (branch `else`, mês passado — é a que mais importa nesta story, fácil de esquecer por vir depois no arquivo) — passar `linkToDaily` nas duas. Em `DailyPage.tsx` (chamada em `DayHeader`, linha ~79), **não** passar (ou passar `false` explicitamente) — a própria página já é o Daily Log daquele dia, link para si mesmo não faz sentido.
  - [x] 8.3 Comparação "é hoje"/"é futuro" usa a mesma técnica de cálculo local já estabelecida (`new Date()` dentro do componente, comparação de string ISO — mesmo cuidado de `MonthDensityCalendar.tsx`/Story 11.10 sobre comparar ISO de string, não `Date.getTime()`, para evitar falso-negativo por hora/minuto).

### Testes & Verificação

- [x] **Task 9: Testes de frontend** (AC1-AC5)
  - [x] 9.1 `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx`: casos novos para os botões anterior/próximo (navegam para a URL esperada); caso "próximo" ausente/desabilitado no período corrente; caso "próximo" a partir do período imediatamente anterior ao corrente navega para a rota canônica sem parâmetro; casos dos 3 indicadores visuais (corrente sem indicador extra / passado aberto com indicador informativo / fechado com "Fechada"/"Fechado", já existentes); caso do link "Voltar para a semana/mês atual" (só aparece fora do período corrente, navega para a rota canônica). **Reescrever** os dois testes da Task 3.4 (`isArchiveView` → `closed`). `jest-axe` contra os componentes reais.
  - [x] 9.2 `DayHeader.test.tsx`: casos novos de `linkToDaily` — link presente/ausente por posição (passado/hoje/futuro), `href`/`to` correto (`/daily/<data>` vs `/today`).
  - [x] 9.3 Novo `DailyPage.test.tsx` (estender o existente): renderização via rota `/daily/:date` — sem banners de ritual, sem `AddTaskRow`, com `TaskRow` funcional (`onTransition`/`onOpenDetail`/`onReorder` chamando as mutações certas), `aria-label` com a data, link "Voltar para hoje" presente. Rota `/today` sem parâmetro mantém 100% do comportamento hoje testado (regressão).
  - [x] 9.4 `keys.test.ts` (se existir) ou os testes que hoje verificam chaves de invalidação (`api.test.ts`/testes inline nos componentes que mockam `useDeleteTaskMutation`/`useMigrateTaskMutation`/`useUpdateTaskMutation`): confirmar que a invalidação por prefixo `['bujo','dailyLog']` (Task 6.4) é exercitada por pelo menos um teste novo por mutação afetada.
  - [x] 9.5 `npm run typecheck && npm run lint && npm run build && npx vitest run --no-file-parallelism` (Node 22, `nvm use 22`) verdes; **colar contagem real**. Baseline de sanidade (11.10, pós-review): **509 passed (45 arquivos)**.

- [x] **Task 10: Verificação manual e e2e (Playwright real, branch `e2e`)** (AC1-AC5)
  - [x] 10.1 Estender `frontend/e2e/` (novo spec ou extensão de um existente) com cenários reais: navegar para trás em Esta Semana/Este Mês algumas vezes, confirmar que o período exibido é o correto e que ainda é possível adicionar/editar/migrar uma tarefa nele (período aberto); navegar até um período **fechado** conhecido (via fixture/seed) e confirmar somente-leitura idêntico ao Arquivo; clicar num dia passado dentro de Esta Semana e confirmar que abre `/daily/<data>` com as tarefas certas e ações funcionando (transição/migração); voltar ao atual via o novo link.
  - [x] 10.2 Verificar manualmente (screenshot real) os 3 indicadores visuais e o link de volta.
  - [x] 10.3 Zero erros de console em todos os passos. `--workers=1`.
  - [x] 10.4 **File List por último** (retro Epic 3 §8-2) — reconciliar contra `git status --short`/`git diff --stat` reais. Guardrails em `_bmad/custom/bmad-dev-story.toml`.

## Dev Notes

### Achado crítico #1: não existe hoje NENHUM controle de navegação anterior/próximo

O texto da AC (`epics.md:989-991`, "quando navego para trás (controle anterior/próximo ou seletor de data)... reusando as páginas que já renderizam período por rota") pressupõe que só falta *alcançar* um controle existente. **Não é o caso.** Confirmado por leitura exaustiva de `WeeklyPage.tsx`/`MonthlyPage.tsx`: as únicas rotas que passam `weekStart`/`monthFirst` a essas páginas são `archive/weekly/:weekStart`/`archive/monthly/:monthFirst` (`router.tsx:106-113`), alcançáveis **só** a partir da lista do Arquivo (que só lista fechados). `planner/week`/`planner/month` (`router.tsx:64-72`) não têm variante parametrizada, e não há nenhum botão anterior/próximo em nenhuma das duas páginas. O backend (`WeeklyLogView`/`MonthlyLogView`) já serve qualquer período — é **só** a UI de navegação que falta, por completo (Task 4).

### Achado crítico #2: `isArchiveView` bloqueia escrita por rota, não por `closed` — bug pré-existente que esta story expõe

`WeeklyPage.tsx:76,171` e `MonthlyPage.tsx:94,190` condicionam toda escrita (`onOpenDetail`, formulário, recorrentes) a `!isArchiveView && !closed`, onde `isArchiveView = Boolean(routeWeekStart)` (`WeeklyPage.tsx:37`)/`Boolean(routeMonthFirst)` (`MonthlyPage.tsx:55`) — ou seja, **qualquer** acesso via rota parametrizada é forçado a somente-leitura, **mesmo quando `closed: false`**. Isso nunca importou até agora porque a **única** rota parametrizada existente (`archive/weekly/:weekStart`) só era alcançada a partir do Arquivo, que só lista ciclos **já fechados** — então `isArchiveView` e `closed` sempre coincidiam na prática. Esta story quebra essa coincidência de propósito (AC1 exige navegar para períodos passados **abertos** via rota parametrizada) — sem a correção da Task 3, o novo botão "anterior" abriria uma semana passada aberta em modo **somente-leitura**, violando a AC3 diretamente. **Confirmado por teste existente que precisa ser invertido:** `WeeklyPage.test.tsx:426` (`'form não aparece em isArchiveView'`) hoje afirma explicitamente esse comportamento com `closed: false` — é o comportamento que a Task 3 corrige e o teste que a Task 3.4 reescreve. Isso não é uma regressão introduzida por esta story; é um acoplamento que já existia e nunca tinha sido exercitado com `closed: false` numa rota parametrizada.

### Achado crítico #3: invalidação de cache do Daily Log usa a chave exata "hoje", não um prefixo — mutações passado-cegas

`useDeleteTaskMutation` e `useMigrateTaskMutation` (`api.ts:241`, `api.ts:376`) invalidam `queryKey: keys.bujo.todayLog()` — hoje isso resolve para a chave **exata** `['bujo','dailyLog','today']`. TanStack Query invalida por **prefixo**, então essa chamada só alcança queries cuja chave **começa** com esses 3 elementos — nunca alcançará `['bujo','dailyLog','2026-07-10']` (uma chave de 3 elementos onde o 3º difere). É exatamente o mesmo motivo pelo qual essas funções **já** precisam invalidar `['bujo','weeklyLog']`/`['bujo','monthlyLog']` como prefixo de 2 elementos (comentário em `api.ts:238-240`, "container de origem é desconhecido... invalidação por prefixo") — só que o Daily Log nunca precisou disso até esta story, porque nunca existiu uma variante não-"today" do seu cache. Fix: trocar a chave exata pelo prefixo `['bujo', 'dailyLog']` nesses dois lugares (Task 6.4) — mesma técnica já validada no arquivo, zero mudança de comportamento para o caso "hoje" (que continua batendo o prefixo).

### Escopo de "agir sobre as tarefas" de um Daily Log passado — sem criação nova

A AC da epics (`epics.md:996-997`) diz "posso agir sobre suas tarefas... normalmente" — **tarefas**, no plural, sobre o que já existe. `TaskCreateView.post` (`views.py:62-69`) cria sempre em `get_or_create_daily_log(user=request.user, log_date=today_for(request.user))` — hardcoded em hoje, sem receber nenhuma data do cliente. O AD-16 (ponto 4, `architecture.md:773`) é explícito: *"única adição de backend"* é a **leitura**. Estender `create_task`/`TaskCreateView`/`AddTaskRow` para aceitar uma data arbitrária **não** está pedido por nenhuma AC ou pela AD-16 — decisão desta story: **fora de escopo**, registrado abaixo. Transicionar, reordenar, editar, excluir e migrar tarefas **já existentes** num Daily Log passado funcionam sem nenhuma restrição nova (nenhum guardrail as bloqueia — `_check_container_open` ignora `log` por design, Task 1.2).

### Por que a rota do Daily Log passado é nova (`/daily/:date`) e não reaproveita `/today`

`/today` (`router.tsx:62`) não tem variante parametrizada, e generalizar a própria rota "hoje" para aceitar uma data ambíguaria a própria ideia de "hoje" (ex. o que o sidebar deveria linkar?). Uma rota nova e paralela — mesma relação de `archive/weekly/:weekStart` com `planner/week` — é mais simples e não tira nada de `/today`. **Cuidado de nomenclatura:** `architecture.md` (§7.3/AD-14, linhas 839/1131/1159/1201/1277) menciona um `/api/daily/{date}/` **reservado e não construído**, para um cenário de fallback de performance (prefetch agregado cross-domínio, NFR-2) — é um endpoint de **backend**, uma ideia registrada mas nunca implementada, e não tem nenhuma relação com a rota de **frontend** `/daily/:date` desta story. Não confundir os dois ao ler a arquitetura.

### Por que não existe rota nova para Esta Semana/Este Mês passados

Diferente do Daily Log, `archive/weekly/:weekStart`/`archive/monthly/:monthFirst` **já existem** e já renderizam exatamente o componente certo (`WeeklyPage`/`MonthlyPage`) com o parâmetro certo. Uma vez que a Task 3 desacopla a escrita de `isArchiveView`, reusar essas rotas para a navegação anterior/próximo desta story é reuso literal — zero rota nova, zero componente novo. O nome da rota (`archive/...`) fica um pouco descolado do propósito ("estou navegando pelo planner, não pelo arquivo") quando o período ainda está aberto, mas é só a URL — não é exposto ao usuário como rótulo, e o `aria-label`/indicador visual (Task 5) já comunicam o estado real independente do path.

### Não fazer nesta story (fora de escopo, registrado)

- **Criar tarefa nova diretamente num Daily Log passado** (`AddTaskRow`/`TaskCreateView`) — só ação sobre tarefas existentes (ver "Escopo de 'agir sobre as tarefas'" acima).
- **Navegação para o futuro** além do período corrente em Esta Semana/Este Mês via o novo controle anterior/próximo — a superfície Futuro (`FuturePage`) já cobre isso; o controle desta story só destrava o passado.
- **Aba "Histórico" unificada** (item #9 de `futureIdeas.md`, também citado em `epics.md:1005`) — esta story entrega navegação livre para trás nas superfícies já existentes (Esta Semana/Este Mês/Daily Log), não uma superfície dedicada nova de navegação de todos os logs.
- **Corrigir `transition_task` não chamar `_check_container_open`** (achado adjacente desta análise — hoje é possível reabrir uma tarefa `completed` dentro de um container já fechado via `TaskTransitionView`, sem 409; `services/state_machine.py` é a única função de mutação de tarefa que não chama o guardrail). Não é pedido por nenhuma AC desta story e não é um caso introduzido por ela — registrar como possível item de backlog/deferred-work, não corrigir aqui.
- **Extender `@extend_schema` com parâmetros documentados** para `week_start`/`month_first`/`log_date` — gap pré-existente nos dois primeiros, mantido por consistência; fora de escopo desta story.

### Previous Story Intelligence (11.10 — done)

- **Stack:** Backend Django + DRF + drf-spectacular + uv/pytest/ruff/lint-imports; Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Sem dependência nova nesta story.
- **Node 22 obrigatório** (`nvm use 22`); `vitest run --no-file-parallelism`; Playwright `--workers=1` por cold-start da branch Neon `e2e`.
- **`jest-axe` só pega violação real contra o componente de verdade** — nunca mockar o componente sob teste de a11y.
- **`component="div"` obrigatório em `Typography variant="body-sm"` de bloco** (achado HIGH da review 11.9) — vale para qualquer `Typography variant="body-sm"` nova nesta story (indicadores da Task 5.1, texto informativo).
- **Contagem de testes sempre real** (retro Epic 3 §1). **File List por último** (retro Epic 3 §8-2). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.
- **Baselines de sanidade (pós-11.10):** backend `pytest` **364 passed**; frontend `vitest` **509 passed (45 arquivos)**.
- **`TaskDestinationDialog`/seletor de Mover (Story 11.10) já funciona a partir de qualquer superfície**, incluindo — por construção, já que o botão "Mover tarefa" renderiza incondicionalmente para linhas raiz em todas as páginas desde a 11.6 — a partir do Daily Log passado e de Esta Semana/Este Mês passados desta story, **sem nenhuma mudança no seletor**. Confirmar isso na verificação manual (Task 10.1), não reimplementar.
- **AR-22 (observabilidade) segue pendente e sem dono há 4 épicos** — não bloqueia esta story; ao concluí-la, roda a retrospectiva do Épico 11 (2ª passada, 11.7-11.11) — bom momento para reescalar.

### Git Intelligence

- Branch `main`; HEAD em `5d677f7` (`feat(story-11.10): Seletor Mover/Migrar completo`) — `baseline_commit` desta story. Convenção de commit: `feat(story-11.11): <descrição em pt-BR>`.
- `git diff --stat` esperado: `backend/bujo/views.py` (`TodayLogView.get` estendido), `backend/bujo/tests/test_views.py` (+testes); `frontend/src/api/keys.ts`, `frontend/src/features/bujo/api.ts` (generalização de `todayLog`/mutações), `frontend/src/app/router.tsx` (+1 rota), `frontend/src/pages/daily/DailyPage.tsx`, `frontend/src/pages/daily/useDailyData.ts`, `frontend/src/pages/planner/WeeklyPage.tsx`, `frontend/src/pages/planner/MonthlyPage.tsx`, `frontend/src/features/bujo/components/DayHeader.tsx` (+`linkToDaily`), e os `.test.tsx` correspondentes. **Sem** `schema.yaml`/`types.gen.ts` no diff (Task 1.3).

### Project Structure Notes

- **Backend alterado:** `backend/bujo/views.py` (só `TodayLogView`), `backend/bujo/tests/test_views.py`. Nenhum arquivo em `backend/*/migrations/`, nenhuma mudança em `services/`, `serializers.py`, `urls.py`.
- **Frontend alterado:** `frontend/src/api/keys.ts`, `frontend/src/features/bujo/api.ts`, `frontend/src/app/router.tsx`, `frontend/src/pages/daily/DailyPage.tsx` (+`.test.tsx`), `frontend/src/pages/daily/useDailyData.ts`, `frontend/src/pages/planner/WeeklyPage.tsx` (+`.test.tsx`), `frontend/src/pages/planner/MonthlyPage.tsx` (+`.test.tsx`), `frontend/src/features/bujo/components/DayHeader.tsx` (+`.test.tsx`). **Nenhum arquivo novo de componente** — só extensão de páginas/componentes/hooks existentes + 1 rota nova.
- **Fronteiras:** mudanças contidas em `features/bujo`, `pages/daily`, `pages/planner`, `app/router.tsx` + `e2e/`. Nenhum import novo cross-feature; nenhuma nova violação de ESLint boundary/import-linter esperada.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.11 (linhas 981-1005 — ACs completas); §Epic 11 intro (linha 757, item 11: "navegar/agir em logs passados não-fechados (reusa as páginas por rota)")]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-16 (linhas 761-775, ponto 4 — passado aberto navegável/acionável, passado fechado read-only, única adição de backend é a leitura por data)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-15.md (contexto da reabertura do Épico 11; ordem de dependência 11.11 após 11.10)]
- [Source: docs/futureIdeas.md:9 ("Aba de Histórico") — superfície unificada registrada como fora de escopo, ver Dev Notes]
- [Source: backend/bujo/views.py:54-59 (`TodayLogView` atual, hardcoded); :235-267 (`WeeklyLogView.get`, padrão a espelhar exatamente na Task 1.1)]
- [Source: backend/bujo/services/logs.py:8-17 (`get_or_create_daily_log`, já aceita `log_date` arbitrário — nenhuma mudança necessária)]
- [Source: backend/bujo/services/tasks.py:13-19 (`_check_container_open`, docstring confirma que `log` nunca entra no guardrail de fechamento)]
- [Source: backend/bujo/services/archive.py:15-22 (`is_container_closed`); :25-48 (`list_closed_cycles`, usado só por `ArchiveView`, sem mudança)]
- [Source: backend/bujo/serializers.py (`LogSerializer`, campos `id`/`log_date`/`tasks`, sem `closed` — confirma que Daily Log não tem estado de fechamento)]
- [Source: backend/bujo/urls.py:26 (`path("logs/today/", TodayLogView.as_view(), name="bujo-today-log")`, sem mudança de nome/path)]
- [Source: backend/bujo/tests/test_views.py:1-75 (módulo/testes existentes de `TodayLogView` — modelo para os testes novos da Task 2.1)]
- [Source: frontend/src/app/router.tsx (rotas completas) — linhas 62 (`/today`, sem param), 64-72 (`planner/week`/`planner/month`, sem param), 106-113 (`archive/weekly/:weekStart`/`archive/monthly/:monthFirst`, já parametrizadas — reusadas pela Task 4); nova entrada `daily/:date` na Task 7.1]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx (arquivo completo) — linhas 36-37 (`isArchiveView`), 76 (`onOpenDetail`, a corrigir na Task 3.1), 108-112 (indicador "Fechada"), 171 (guarda do formulário, a corrigir na Task 3.1)]
- [Source: frontend/src/pages/planner/MonthlyPage.tsx (arquivo completo) — linhas 25-30 (`currentMonthFirst()`, a reusar na Task 4.3), 54-55 (`isArchiveView`), 82 (`isCurrentMonth`), 94/190 (a corrigir na Task 3.2), 150-154 (indicador "Fechado")]
- [Source: frontend/src/pages/daily/DailyPage.tsx (arquivo completo) — linhas 20-26 (sem `useParams` hoje), 32-56 (atalho `N`, a condicionar na Task 7.3), 75-78 (banners de ritual, a condicionar na Task 7.3), 96 (`AddTaskRow`, a condicionar na Task 7.3)]
- [Source: frontend/src/pages/daily/useDailyData.ts (arquivo completo, 11 linhas) — só compõe `bujo` hoje; a generalizar na Task 7.2]
- [Source: frontend/src/pages/archive/ArchivePage.tsx (arquivo completo) — padrão de navegação por `RouterLink`/`entryPath`, referência para a Task 4.2/4.3 e Task 5.2/7.5; sem mudança neste arquivo]
- [Source: frontend/src/features/bujo/components/DayHeader.tsx (arquivo completo, 66 linhas) — linha 44 (`Typography` a envolver em `RouterLink` na Task 8.1)]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx:57-65 (props `onTransition`/`onOpenDetail`/`siblings`/`onReorder`, todas opcionais — confirma que nenhuma mudança de props é necessária, só o que os hooks fazem com os dados)]
- [Source: frontend/src/features/bujo/components/MonthDensityCalendar.tsx (Story 11.10) — técnica de cálculo de "hoje"/"semana atual" client-side (comparação de string ISO, não `Date.getTime()`) a reusar na Task 8.3]
- [Source: frontend/src/shared/hooks/useOptimisticMutation.ts (arquivo completo, 43 linhas) — `onSettled` invalida exatamente o `queryKey` recebido na criação do hook; confirma por que a Task 6.3 precisa generalizar a assinatura de `useTransitionTaskMutation`/`useReorderTaskMutation` em vez de só ajustar invalidação externa]
- [Source: frontend/src/features/bujo/api.ts (arquivo completo) — linhas 26-36 (`fetchTodayLog`/`useTodayLogQuery`, Task 6.2), 48-62 (`useTransitionTaskMutation`, Task 6.3), 174-183 (`useReorderTaskMutation`, Task 6.3), 185-197 (`fetchWeeklyLog`/`useWeeklyLogQuery`, padrão espelhado), 233-247 (`useDeleteTaskMutation`, linha 241 a corrigir na Task 6.4), 365-383 (`useMigrateTaskMutation`, linha 376 a corrigir na Task 6.4), ~146-158 (`useUpdateTaskMutation.mutationOptions.onSuccess`, a estender na Task 6.4)]
- [Source: frontend/src/api/keys.ts (arquivo completo) — `todayLog`/`weeklyLog`/`monthlyLog`, padrão `[escopo, entidade, discriminador]`, generalização na Task 6.1]
- [Source: frontend/src/pages/planner/WeeklyPage.test.tsx:64-75 (setup da rota de arquivo), :324-433 (describe "Indicador 'Fechada' e modo Arquivo"), :426 (teste a inverter na Task 3.4), :455-473 (describe "onOpenDetail")]
- [Source: _bmad-output/implementation-artifacts/11-10-seletor-mover-migrar-completo.md (story anterior — `TaskDestinationDialog` já funciona a partir de qualquer superfície por construção desde a 11.6; padrão de invalidação por prefixo já estabelecido para `weeklyLog`/`monthlyLog`)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 (contagem real de testes), §8 (File List por último) — guardrails em `_bmad/custom/bmad-dev-story.toml`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Ambiente: a suíte `pytest` completa anterior (baseline 11.10) deixou uma sessão órfã presa no Postgres remoto (Neon) após o teardown (`OperationalError: database "test_neondb" is being accessed by other users`), fazendo a criação do banco de teste falhar na execução seguinte (`psycopg.errors.DuplicateDatabase`/`ObjectInUse`, erro interno do pytest `assert not self._finalizers`). Diagnosticado via `pg_stat_activity` contra o banco `neondb` (não o de teste) e resolvido terminando a sessão órfã (`pg_terminate_backend`) antes de re-rodar — ambiental, não uma regressão de código desta story.
- O teste novo `test_get_today_log_log_date_malformado_retorna_400` (Task 2.1) inicialmente assumiu o corpo de erro cru do DRF (`{"log_date": [...]}}`) — o `custom_exception_handler` (`core/exceptions.py`) do projeto normaliza toda resposta de erro para `{"detail": ..., "fields": {...}}`; ajustado para `response.data["fields"]`, mesmo formato já usado pelos demais testes 400 de query param inválido no projeto.
- Achado ao escrever o e2e da Task 10.1: uma tarefa criada via o formulário de Esta Semana/Este Mês com um dia específico vive em `WeeklyLog`/`MonthlyLog` (campo `scheduled_date`), **não** no container `Log` (Daily) daquele calendário — são containers disjuntos (`CHECK task_exactly_one_log`). O drill-down (`/daily/<data>`) lê o `Log` de verdade daquele dia, que fica vazio nesse cenário. Corrigido seedando o Daily Log passado direto via `manage.py shell` (novo `seedPastDailyTask.ts`, mesma técnica de `seedYesterdayQueue.ts`), não via formulário — condizente com a própria Dev Notes da story ("Escopo de 'agir sobre as tarefas'": criação fica restrita a hoje).
- **Contagem real backend:** `pytest -q` (suíte completa, sem escopo de path) → **368 passed** (baseline 11.10: 364 passed; +4 testes novos de `TodayLogView`, Task 2.1). `ruff check .`: All checks passed. `lint-imports`: 1 kept, 0 broken. `manage.py check`: 0 problemas.
- **Contagem real frontend:** `npx vitest run --no-file-parallelism` → **538 passed (45 arquivos)** (baseline 11.10: 509 passed; +29 testes novos/reescritos nas Tasks 3.4/9.1-9.4). `npm run typecheck`: 0 erros. `npm run lint`: 0 erros/avisos.
- **e2e:** `frontend/e2e/past-period-navigation.spec.ts` (3 cenários novos, Task 10.1) — 3/3 verdes contra o backend real (branch Neon `e2e`), `--workers=1`, zero erros de console em todos os passos, executado 2x (uma vez completo, mais uma repetição do 1º cenário após ajuste). 3 screenshots reais capturados (Task 10.2) confirmando os 3 estados visuais (corrente/passado aberto/passado fechado) + link de volta — script descartável, não sobrevive no File List.

### Completion Notes List

- **Backend (Tasks 1-2):** `TodayLogView.get` estendido com `log_date` opcional, espelhando exatamente `WeeklyLogView.get` (parse via `date.fromisoformat`, 400 em formato inválido, sem parâmetro cai em `today_for`). Nenhuma mudança em `get_or_create_daily_log`/`LogSerializer`/`_check_container_open`/nome de rota — confirmado por leitura (Task 1.2/1.4) e por `git diff` (Task 1.3: `schema.yaml`/`types.gen.ts` fora do diff). Task 2.2 confirmada por leitura + pelos testes já existentes de `test_services.py` que exercitam update/delete/reorder/migrate contra `log=log` (`LogFactory`, datas arbitrárias não-"hoje") sem nenhum guardrail disparar — `_check_container_open` só recebe `weekly_log`/`monthly_log`, nunca `log`, então nenhum teste novo de guardrail foi necessário.
- **Frontend — Task 3 (bug pré-existente corrigido):** `onOpenDetail`/guarda do formulário em `WeeklyPage.tsx`/`MonthlyPage.tsx` passam a depender só de `closed`, nunca de `isArchiveView` — `isArchiveView` continua existindo só para `aria-label`/leitura parametrizada. 4 testes reescritos/adicionados (`WeeklyPage.test.tsx`/`MonthlyPage.test.tsx`) invertendo o comportamento antigo e provando o novo (form/painel acionáveis em rota parametrizada quando `closed: false`).
- **Frontend — Tasks 4-5 (navegação + indicadores):** `currentWeekStart()`/`addDaysIso()` locais em `WeeklyPage.tsx`; `addMonthsIso()` local em `MonthlyPage.tsx` (reusando `currentMonthFirst()`/`isCurrentMonth` já existentes). Dois `IconButton` (`NavigateBeforeIcon`/`NavigateNextIcon`) apontando para as rotas de arquivo já existentes — sem rota nova. "Próximo" cai em `/planner/week`/`/planner/month` quando o destino calculado é o período corrente. Indicador informativo (`Typography variant="body-sm" component="div"`, achado HIGH da 11.9 aplicado) + link "Voltar para a semana/mês atual" quando `!isCurrentPeriod`.
- **Frontend — Task 6 (camada de dados):** `keys.bujo.todayLog(logDate?)`, `fetchTodayLog`/`useTodayLogQuery(logDate?)` generalizados espelhando `fetchWeeklyLog`. `useTransitionTaskMutation`/`useReorderTaskMutation` aceitam `logDate?` (únicas mutações exclusivas do Daily Log). **Achado crítico #3 confirmado e corrigido:** `useDeleteTaskMutation`/`useMigrateTaskMutation` invalidavam a chave exata `['bujo','dailyLog','today']` (nunca alcançava um dia passado); trocado por prefixo `['bujo','dailyLog']`. `useUpdateTaskMutation` ganhou a mesma invalidação por prefixo (não existia nenhuma antes para o Daily Log). `useCreateTaskMutation`/`useCreateSubtaskMutation` inalterados (criação restrita a hoje).
- **Frontend — Task 7 (rota + página):** `daily/:date` nova em `router.tsx`, reusando `DailyPage`. `DailyPage` lê `routeDate` via `useParams`; quando presente, esconde banners de ritual + `AddTaskRow` + atalho `N`, mostra link "Voltar para hoje", `aria-label` reflete a data. Rota `/today` sem parâmetro mantém 100% do comportamento anterior (regressão coberta).
- **Frontend — Task 8 (drill-down):** `DayHeader` ganhou `linkToDaily?` (default `false`); quando `true` e o dia não é futuro, o cabeçalho vira `RouterLink` para `/daily/<data>` (ou `/today` se for hoje). Passado nas duas chamadas de `WeeklyPage`/`MonthlyPage` (branch atual e branch passado/`else` do mês — a mais fácil de esquecer, citada nas Dev Notes); **não** passado em `DailyPage` (a própria página já é o destino).
- **Testes (Task 9):** 29 casos novos/reescritos no total — navegação anterior/próximo + 3 indicadores + link de volta (`WeeklyPage.test.tsx`/`MonthlyPage.test.tsx`), `linkToDaily` por posição (`DayHeader.test.tsx`), rota `/daily/:date` completa (`DailyPage.test.tsx`), invalidação por prefixo `['bujo','dailyLog']` exercitada para `useDeleteTaskMutation`/`useMigrateTaskMutation`/`useUpdateTaskMutation`/`useTransitionTaskMutation`/`useReorderTaskMutation` (`api.test.tsx`) — incluindo o teste de regressão do `fetchTodayLog` (chamada `client.get` ganhou um 2º argumento `{ params }` sempre, mesmo sem `logDate`).
- **e2e + verificação manual (Task 10):** novo `past-period-navigation.spec.ts` (3 cenários) + novo helper `seedPastDailyTask.ts` (seed direto de um Daily Log passado — única forma de compor esse cenário, já que a UI não permite criar tarefa num Daily Log arbitrário). 3 screenshots reais confirmaram os 3 estados visuais. Zero erros de console em todos os passos.
- **Fora de escopo, não tocado (conforme Dev Notes):** criação de tarefa nova num Daily Log passado, navegação para o futuro além do período corrente, aba "Histórico" unificada, guardrail de `transition_task`/`_check_container_open`, `@extend_schema(parameters=...)` para `week_start`/`month_first`/`log_date`.

### File List

**Backend — código:**
- `backend/bujo/views.py` (modificado — `TodayLogView.get` estendido com `log_date` opcional, Task 1.1)

**Backend — testes:**
- `backend/bujo/tests/test_views.py` (modificado — +4 testes de `TodayLogView` com `log_date`, Task 2.1)

**Frontend — dados/rotas:**
- `frontend/src/api/keys.ts` (modificado — `todayLog(logDate?)`, Task 6.1)
- `frontend/src/features/bujo/api.ts` (modificado — `fetchTodayLog`/`useTodayLogQuery`/`useTransitionTaskMutation`/`useReorderTaskMutation` generalizados; invalidação por prefixo `['bujo','dailyLog']` em `useDeleteTaskMutation`/`useMigrateTaskMutation`/`useUpdateTaskMutation`, Tasks 6.2-6.4)
- `frontend/src/app/router.tsx` (modificado — +rota `daily/:date`, Task 7.1)

**Frontend — páginas/componentes:**
- `frontend/src/pages/daily/DailyPage.tsx` (modificado — `routeDate` via `useParams`, banners/`AddTaskRow`/atalho `N` condicionados, link "Voltar para hoje", Task 7.2-7.5)
- `frontend/src/pages/daily/useDailyData.ts` (modificado — `useDailyData(logDate?)`, Task 7.2)
- `frontend/src/pages/planner/WeeklyPage.tsx` (modificado — fix `isArchiveView`/`closed` (Task 3.1), navegação anterior/próximo + indicadores + link de volta (Tasks 4.1-4.2, 5.1-5.2), `linkToDaily` nos 2 `DayHeader` (Task 8.2))
- `frontend/src/pages/planner/MonthlyPage.tsx` (modificado — fix `isArchiveView`/`closed` (Task 3.2), navegação anterior/próximo + indicadores + link de volta (Tasks 4.3, 5.1-5.2), `linkToDaily` nos 2 `DayHeader` (Task 8.2))
- `frontend/src/features/bujo/components/DayHeader.tsx` (modificado — prop `linkToDaily`, Task 8.1/8.3)

**Frontend — testes:**
- `frontend/src/features/bujo/api.test.tsx` (modificado — testes de `logDate`/invalidação por prefixo, Task 9.4)
- `frontend/src/pages/daily/DailyPage.test.tsx` (modificado — +describe da rota `/daily/:date`, Task 9.3)
- `frontend/src/pages/planner/WeeklyPage.test.tsx` (modificado — testes invertidos da Task 3.4 + navegação/indicadores, Task 9.1)
- `frontend/src/pages/planner/MonthlyPage.test.tsx` (modificado — idem, Task 9.1)
- `frontend/src/features/bujo/components/DayHeader.test.tsx` (modificado — +describe `linkToDaily`, Task 9.2)

**e2e (novos):**
- `frontend/e2e/past-period-navigation.spec.ts` (novo — 3 cenários AC1-AC5, Task 10.1)
- `frontend/e2e/seedPastDailyTask.ts` (novo — seed de Daily Log passado via `manage.py shell`, mesma técnica de `seedYesterdayQueue.ts`, necessário para o cenário de drill-down do Task 10.1)

**Rastreamento da story (seções permitidas):**
- `_bmad-output/implementation-artifacts/11-11-navegar-e-agir-em-logs-passados-nao-fechados.md` (checkboxes, Dev Agent Record, File List, Change Log, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (11-11 → in-progress → review; `last_updated`)

*Sem migração de banco, sem endpoint novo (extensão de `TodayLogView` existente). Sem impacto em `schema.yaml`/`frontend/src/api/types.gen.ts` (confirmado — nenhum dos dois aparece no diff). Nenhum novo modelo/serializer. O artefato `_bmad-output/story-automator/orchestration-11-…md` aparece modificado no working tree desde antes do início desta sessão — é do orquestrador, fora do escopo desta story, não tocado e não deve ser commitado por ela.*

## Senior Developer Review (AI)

**Reviewer:** Claude Sonnet 5 (story-automator-review) · **Data:** 2026-07-16

**Verificação executada (contagem real):**
- Backend: `ruff check .` (all checks passed), `lint-imports` (1 kept, 0 broken), `manage.py check` (0 problemas), `pytest -q` → **368 passed** (bate com a Completion Note; 1 warning de teardown — sessão órfã pré-existente no Neon, ambiental, já documentada no Debug Log).
- Frontend: `npm run typecheck` (0 erros), `npm run lint` (0 erros/avisos), `npm run build` (ok), `npx vitest run --no-file-parallelism` → **542 passed (45 arquivos)** (538 originais da story + 4 testes novos desta review; 1 flake de timeout em `TaskDetailPanel.test.tsx` na primeira rodada, não relacionado a este story — passa isolado, arquivo fora do File List).
- Todas as ACs (1-5) re-verificadas linha a linha contra `views.py`/`WeeklyPage.tsx`/`MonthlyPage.tsx`/`DailyPage.tsx`/`DayHeader.tsx`/`api.ts`/`keys.ts`/`router.tsx`. Git diff batido contra o File List — sem discrepâncias (só `sprint-status.yaml`/orchestration do automator fora do escopo, corretamente não listados).
- Segurança: `log_date` arbitrário em `TodayLogView` não vaza entre tenants (`get_or_create_daily_log` roda sob `Log.objects`, escopado por `current_user_id` do `tenant_context`; `user` explícito no serviço não é a fronteira de isolamento). Sem injeção (parse via `date.fromisoformat` + `ValidationError`).

**Achado (MEDIUM) encontrado e corrigido nesta review:** `WeeklyPage`/`MonthlyPage` não remontam ao navegar entre semanas/meses via os novos controles anterior/próximo (Task 4) — `/planner/week` e `/archive/weekly/:weekStart` renderizam o mesmo componente na mesma posição da árvore (sem `key` diferenciador), então o React preserva a instância e todo `useState` local (rascunho do formulário "Título"/"Dia opcional", `openTaskId`, `placingTemplate`, `selectedDayIndex`) sobrevive à navegação. Antes desta story isso nunca era observável: a única forma de alcançar a rota parametrizada era a partir do `ArchivePage` (componente diferente, remonta garantido); os novos botões anterior/próximo introduzem a primeira navegação *entre* instâncias do mesmo componente. Verificado empiricamente com um teste isolado (`fireEvent.click` num link real dentro de um `<Routes>` com as duas rotas) antes de corrigir — confirmado que o valor digitado sobrevivia à navegação. **Fix:** `useEffect` chaveado em `routeWeekStart`/`routeMonthFirst` resetando o estado local de UI no topo de cada componente. Testes de regressão adicionados em `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` (verificados: falham sem o fix, passam com ele).

**Achado (LOW) corrigido nesta review:** os testes de `jest-axe` existentes em `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` só exercitavam o período corrente — os novos elementos interativos (botões de navegação, indicador informativo, link "Voltar") não tinham cobertura de acessibilidade dedicada. Adicionado 1 teste `axe` por página contra o estado "período passado aberto".

**Achado (LOW) não corrigido, registrado para awareness:** navegar manualmente para `/daily/<data-de-hoje>` (URL direta, não gerada pela própria UI — `DayHeader` sempre aponta "hoje" para `/today`) renderiza o Daily Log de hoje em modo "dia passado" (sem banners de ritual, sem `AddTaskRow`, sem atalho `N`). Nenhuma AC exige guarda contra isso; um fix robusto exigiria mover a checagem de "é hoje" para antes de qualquer hook (risco de violar Rules of Hooks se o dia virar meia-noite com a aba aberta). Dado o baixíssimo valor/probabilidade do cenário, não corrigido — deixado como nota para o time.

**Outcome:** Approved. 0 issues CRITICAL. 1 MEDIUM e 1 LOW corrigidos nesta review (com testes de regressão); 1 LOW registrado sem fix (ver acima).

## Change Log

- **2026-07-16** — Implementação completa (Tasks 1-10). 2 achados críticos de frontend pré-existentes identificados nas Dev Notes e corrigidos: (1) `isArchiveView` bloqueava escrita por rota em vez de `closed` (Task 3) — nunca importou até esta story porque a única rota parametrizada existente só era alcançada a partir do Arquivo (sempre fechado); (2) invalidação de cache do Daily Log usava a chave exata "hoje" em vez de prefixo (Task 6.4) — nunca precisou de prefixo até existir uma variante não-"today" do cache. Achado adicional durante a escrita do e2e (Task 10): tarefas de `WeeklyLog`/`MonthlyLog` com `scheduled_date` vivem num container disjunto do `Log` (Daily) do mesmo calendário — não aparecem via `/daily/<data>` (containers `CHECK task_exactly_one_log`); resolvido seedando o Daily Log passado direto (`seedPastDailyTask.ts`). Nenhuma mudança de escopo além do especificado; todas as ACs satisfeitas.
- **2026-07-16** — Code review (AI): achado MEDIUM corrigido — `WeeklyPage`/`MonthlyPage` não remontavam entre navegações anterior/próximo (mesmo componente, mesma posição de rota), vazando rascunho de formulário/painel aberto entre semanas/meses; fix via `useEffect` resetando estado local chaveado no parâmetro de rota, com testes de regressão. Achado LOW corrigido — cobertura `jest-axe` estendida para o estado "período passado aberto". 1 achado LOW adicional registrado sem fix (ver Senior Developer Review acima). Suite completa reverificada: backend 368 passed, frontend 542 passed (45 arquivos).
