# Explicacao dos arquivos nao commitados - Story 11.11 — Navegar e agir em logs passados não-fechados

## Visao geral

O conjunto de mudancas implementa a Story 11.11 (última do 2º lote do Épico 11): permitir **navegar para semanas, meses e dias passados ainda não-fechados** e **agir sobre suas pendências**. Hoje o Arquivo (Story 4.6) lista só ciclos fechados e não há navegação para alcançar um período passado **aberto** — só os rituais de revisão/catch-up expunham essas pendências.

A entrega tem uma única adição de backend — `TodayLogView.get` (`views.py`) passa a aceitar um query param opcional `log_date`, permitindo **ler o Daily Log de uma data arbitrária** (o serviço `get_or_create_daily_log` já suportava qualquer data; só a view estava hardcoded em "hoje"). O grosso é frontend: uma nova rota `/daily/:date` (reusando `DailyPage`), controles **anterior/próximo** em Esta Semana / Este Mês (reusando as rotas de arquivo `/archive/weekly/:weekStart` e `/archive/monthly/:monthFirst` já existentes, sem rota nova), um link de **drill-down** do dia (`DayHeader.linkToDaily`) e a distinção visual de 3 estados (corrente / passado aberto / passado fechado) com caminho de volta ao presente.

Além do escopo planejado, a story carrega **três correções pré-existentes** documentadas na spec: (1) **`isArchiveView` forçava somente-leitura por rota** em vez de por `closed` — nunca importou porque a única rota parametrizada existente só era alcançada a partir do Arquivo (sempre fechado); a story quebra essa coincidência de propósito, então o read-only passa a depender **só de `closed`**; (2) **invalidação de cache do Daily Log usava a chave exata `['bujo','dailyLog','today']`** em vez do prefixo `['bujo','dailyLog']` — nunca alcançaria um dia passado; corrigido em `useDeleteTaskMutation`/`useMigrateTaskMutation` e adicionado a `useUpdateTaskMutation`; (3) durante a review, um **vazamento de estado local** entre navegações anterior/próximo (o mesmo componente não remonta ao mudar de rota parametrizada) — corrigido por um `useEffect` chaveado no parâmetro de rota que reseta o estado de UI.

O escopo toca **backend** (`views.py` + `tests/test_views.py`) e **frontend** (`keys.ts`, `api.ts`, `router.tsx`, `useDailyData.ts`, `DayHeader.tsx`, `DailyPage.tsx`, `WeeklyPage.tsx`, `MonthlyPage.tsx` + 5 arquivos de teste + 1 e2e novo com helper). **Sem** mudança de contrato (`schema.yaml`/`types.gen.ts` fora do diff — `log_date` segue o padrão não-anotado de `week_start`/`month_first`), **sem** migração de banco, **sem** novo modelo/serializer, **sem** endpoint novo (só extensão de `TodayLogView`). Além do código, o commit carrega a **spec da story** (untracked), o `sprint-status.yaml` (11.11 → done) e o state doc do story-automator (resumidos brevemente). Total: **20 arquivos**.

## Ordem logica de funcionamento

1. A **spec da Story 11.11** (`11-11-...md`) é o contrato funcional (5 ACs, tasks, Dev Notes com os 3 achados críticos, Dev Agent Record e Senior Developer Review) — produzida na automação do 2º lote do Épico 11.
2. O **backend** (`views.py`) é a primeira camada de runtime de uma leitura de Daily Log por data: `TodayLogView.get` ganha o param opcional `log_date`, espelhando `WeeklyLogView`/`MonthlyLogView`.
3. Os **testes de backend** (`test_views.py`) provam o novo comportamento (data passada → 200, idempotente; data malformada → 400; sem param → hoje, regressão).
4. A **camada de dados do frontend** — `keys.ts` (chave `todayLog(logDate?)`) e `api.ts` (`useTodayLogQuery(logDate?)` + generalização das mutações e correção de invalidação por prefixo) — consome o backend.
5. A **rota** (`router.tsx`) registra `/daily/:date`, e o **hook de composição** (`useDailyData.ts`) repassa `logDate`.
6. O **componente `DayHeader`** produz o link de drill-down (`linkToDaily`), consumido pelas páginas.
7. As **páginas** (`DailyPage`, `WeeklyPage`, `MonthlyPage`) montam a experiência: rota do Daily Log passado, navegação anterior/próximo, 3 indicadores, link de volta, e as correções pré-existentes (read-only por `closed`, reset de estado por rota).
8. Os **testes de frontend** (`api.test.tsx`, `DayHeader.test.tsx`, `DailyPage.test.tsx`, `WeeklyPage.test.tsx`, `MonthlyPage.test.tsx`) validam cada camada.
9. O **e2e** (`past-period-navigation.spec.ts` + `seedPastDailyTask.ts`) valida o fluxo real contra o backend.
10. Os **registros de status** (`sprint-status.yaml`, `orchestration-11-...md`) documentam a conclusão (11.11 → done).

---

## 1. Especificacao da Story 11.11

### `_bmad-output/implementation-artifacts/11-11-navegar-e-agir-em-logs-passados-nao-fechados.md` (novo, untracked)

**Funcao geral do arquivo**

Artefato de story da BMad para a 11.11 — documento de implementação (não código) que define escopo, 5 ACs, tasks/subtasks, Dev Notes, Dev Agent Record, Senior Developer Review e Change Log. É o contrato funcional consumido pelo dev-story e pela review.

**Funcao geral da alteracao**

Arquivo novo (untracked). Front matter `baseline_commit: 5d677f7` (o commit da 11.10), Status `done`. Documenta que a story destrava a navegação para trás nas superfícies já existentes, com **três achados críticos** que precisavam de correção antes de a navegação nova funcionar corretamente.

**Blocos principais**

- Linhas 19-55: Acceptance Criteria — AC1 (navegação anterior/próximo em Esta Semana/Este Mês, só para trás; "próximo" ausente no corrente), AC2 (Daily Log de dia passado navegável via `/daily/:date`, link no `DayHeader`; sem link para dias futuros; hoje aponta para `/today`), AC3 (período passado aberto permanece acionável — sem guardrail novo; criação nova num Daily Log passado é fora de escopo), AC4 (período passado fechado permanece somente-leitura, sem regressão do Arquivo), AC5 (distinção visual de 3 estados + link de volta ao atual).
- Linhas 57-162: tasks — Task 1 (backend: estender `TodayLogView`), Task 2 (testes de backend, baseline 364 → **368 passed**), Task 3 (correção pré-requisito: read-only por `closed`, não `isArchiveView`), Tasks 4-5 (navegação + estados visuais), Task 6 (camada de dados: chave/query/mutações + fix de invalidação por prefixo), Task 7 (rota + página do Daily Log por data), Task 8 (drill-down do dia), Task 9 (testes de frontend, baseline 509 → 538, +4 na review = **542**), Task 10 (e2e real + verificação manual).
- Linhas 164-247: Dev Notes — os **3 achados críticos** (não existe controle de navegação hoje; `isArchiveView` bloqueia por rota, não por `closed`; invalidação do Daily Log usa chave exata "hoje" em vez de prefixo), o escopo de "agir sobre tarefas" (sem criação nova), por que a rota do Daily Log é nova, por que Esta Semana/Este Mês reusam as rotas de arquivo, "não fazer nesta story", Previous Story Intelligence, Git/Project Structure e References ancoradas em arquivos e linhas.
- Linhas 249-329: Dev Agent Record — Debug Log (sessão órfã no Neon; ajuste do teste 400 para `response.data["fields"]`; achado de containers disjuntos `Log` vs `WeeklyLog`/`MonthlyLog` ao escrever o e2e; contagens reais backend 368 / frontend 538), Completion Notes por task, File List, e a Senior Developer Review (1 MEDIUM + 2 LOW).

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Não define símbolos executáveis; especifica o comportamento implementado nos arquivos abaixo. Contém o achado MEDIUM da review (vazamento de estado entre navegações) e o LOW registrado sem fix (`/daily/<data-de-hoje>` via URL direta renderiza hoje em modo "dia passado").

---

## 2. Backend — view do Daily Log (extensão de leitura por data)

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Views finas do Daily Log e dos logs de planejamento (§6.2): parseiam/validam → chamam o serviço já existente → serializam. `TodayLogView` serve o Daily Log corrente via `GET /api/bujo/logs/today/`.

**Funcao geral da alteracao**

Estende `TodayLogView.get` para aceitar um query param **opcional** `log_date`, permitindo ler o Daily Log de qualquer data (AC2). Espelha **exatamente** o padrão de parse já usado por `WeeklyLogView`/`MonthlyLogView`. Sem `log_date`, o comportamento é idêntico ao anterior (cai em `today_for(request.user)`). É a **única** adição de backend da story.

**Blocos principais**

- Linhas 54-59 (contexto): a classe `TodayLogView(APIView)` com `@extend_schema(responses=LogSerializer)`.
- Linhas 57-66 (novo): lê `log_date_param = request.query_params.get("log_date")`; se presente, parseia via `date.fromisoformat(log_date_param)` dentro de `try/except ValueError`, levantando `serializers.ValidationError({"log_date": "Data inválida. Use o formato AAAA-MM-DD."}) from None` em formato inválido; senão, `log_date = today_for(request.user)`.
- Linhas seguintes (inalteradas): `log = get_or_create_daily_log(user=request.user, log_date=log_date)` e `return Response(LogSerializer(log).data)` — o serviço e o serializer não mudam.

**Funcoes, classes e importacoes especificas**

- `request.query_params.get("log_date")`: leitura do query param (DRF); `None` quando ausente → mantém o caminho "hoje".
- `date.fromisoformat` (import `from datetime import date, timedelta`, já no topo do arquivo): parseia estritamente 'AAAA-MM-DD'; lança `ValueError` em formato inválido — capturado e reconvertido em 400.
- `serializers.ValidationError` (import `from rest_framework import serializers, status`, já presente): vira HTTP 400 com o corpo de campo `{"log_date": [...]}` (normalizado pelo `custom_exception_handler` para `{"detail": ..., "fields": {...}}`).
- `from None`: suprime o encadeamento da exceção original (`ValueError`), deixando o traceback limpo.
- `get_or_create_daily_log` (inalterado, `services/logs.py`): já aceitava `log_date` arbitrário; é escopado por tenant (`Log.objects` sob `current_user_id`), então uma data arbitrária não vaza entre tenants (confirmado na review de segurança).

**Comportamento de libs usadas**

- DRF `APIView.get` + `Response`: pipeline padrão; `ValidationError` levantada aqui é traduzida para 400 pelo exception handler do projeto.
- Ausência de `@extend_schema(parameters=...)`: `log_date` não é documentado no schema OpenAPI — gap pré-existente já aceito para `week_start`/`month_first`; por isso `schema.yaml`/`types.gen.ts` **não** aparecem no diff (Task 1.3).

---

## 3. Backend — testes

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testes de view/API (DRF `APIClient`) de `TodayLogView`/`TaskTransitionView`.

**Funcao geral da alteracao**

Adiciona 4 testes novos (+41 linhas) cobrindo o novo param `log_date`. Nenhum teste existente é alterado (a extensão é backward-compatible).

**Blocos principais**

- Linhas 81-89: `test_get_today_log_com_log_date_passado_retorna_log_daquele_dia` — `past_date = today_for(user) - timedelta(days=10)`; `GET .../today/?log_date=<past_date>` → 200 e `response.data["log_date"] == past_date.isoformat()`.
- Linhas 91-101: `test_get_today_log_com_log_date_e_idempotente` — duas chamadas seguidas com a mesma data retornam o mesmo `id` (o `get_or_create` não duplica).
- Linhas 103-108: `test_get_today_log_log_date_malformado_retorna_400` — `?log_date=not-a-date` → 400 e `"log_date" in response.data["fields"]` (o corpo passa pelo `custom_exception_handler`, daí `["fields"]`, não a raiz).
- Linhas 110-118: `test_get_today_log_sem_log_date_continua_retornando_log_de_hoje` — regressão: sem o param, `log_date` do corpo bate `today_for(user)`.

**Funcoes, classes e importacoes especificas**

- `today_for(user)` / `timedelta(days=10)` (imports já no topo: `from core.calendar import today_for, week_start_of` e `from datetime import date, timedelta`): compõem a data passada de forma determinística e escopada por tenant.
- `auth_client.get(f".../?log_date=...")`: exerce o pipeline real view → serviço → serializer.
- `response.data["fields"]`: o formato normalizado de erro do projeto — o Debug Log registra que o teste inicialmente assumiu o corpo cru do DRF e foi ajustado.

**Comportamento de libs usadas**

- pytest `@pytest.mark.django_db`: cada teste roda numa transação com o tenant do usuário (fixture `auth_client`/`user`), refletindo o isolamento multi-tenant real.

---

## 4. Frontend — camada de dados (chave + query + mutações)

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Fábrica central de chaves de cache do TanStack Query, por domínio. `keys.bujo.*` produz tuplas `[escopo, entidade, discriminador]`.

**Funcao geral da alteracao**

Generaliza `todayLog` para aceitar uma data opcional (Task 6.1), preservando 100% dos call-sites existentes.

**Blocos principais**

- Linha 14: `todayLog: () => ['bujo', 'dailyLog', 'today'] as const` → `todayLog: (logDate?: string) => ['bujo', 'dailyLog', logDate ?? 'today'] as const`.

**Funcoes, classes e importacoes especificas**

- `todayLog(logDate?)`: `todayLog()` sem argumento continua produzindo `['bujo','dailyLog','today']` (compatível); `todayLog('2026-06-10')` produz `['bujo','dailyLog','2026-06-10']`. Crucialmente, ambas compartilham o **prefixo de 2 elementos** `['bujo','dailyLog']` — base da correção de invalidação em `api.ts`.

**Comportamento de libs usadas**

- Convenção de chave hierárquica do TanStack Query: invalidação por prefixo alcança todas as chaves que começam com o prefixo — por isso o `'today'`/`'2026-06-10'` no 3º elemento é o discriminador que distingue os caches.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Camada de acesso à API do domínio `bujo`: `fetch*` (axios) + hooks `useQuery`/`useOptimisticMutation`, com as regras de invalidação de cache no sucesso das mutações.

**Funcao geral da alteracao**

Três frentes (Tasks 6.2-6.4): (1) `fetchTodayLog`/`useTodayLogQuery` aceitam `logDate?` e mandam `?log_date=` quando presente, espelhando `fetchWeeklyLog`; (2) `useTransitionTaskMutation`/`useReorderTaskMutation` — as **únicas** mutações usadas só pelo Daily Log — aceitam `logDate?` e miram a chave de cache certa; (3) **correção pré-existente**: `useDeleteTaskMutation`/`useMigrateTaskMutation` trocam a invalidação da chave **exata** `keys.bujo.todayLog()` pelo **prefixo** `['bujo','dailyLog']`, e `useUpdateTaskMutation` **ganha** essa invalidação por prefixo (que não existia).

**Blocos principais**

- Linhas 26-31: `fetchTodayLog(logDate?)` — `client.get<Log>('/api/bujo/logs/today/', { params: logDate ? { log_date: logDate } : undefined })`. O 2º argumento passa a ser **sempre** enviado (`{ params: undefined }` quando sem data) — daí o ajuste no teste de regressão.
- Linhas 32-38: `useTodayLogQuery(logDate?)` — `queryKey: keys.bujo.todayLog(logDate)`, `queryFn: () => fetchTodayLog(logDate)`.
- Linhas 50-53: `useTransitionTaskMutation(logDate?)` — `queryKey: keys.bujo.todayLog(logDate)` no `useOptimisticMutation` (o update otimista e a invalidação de `onSettled` miram exatamente essa chave).
- Linhas 154-159: `useUpdateTaskMutation.onSuccess` — **adiciona** `queryClient.invalidateQueries({ queryKey: ['bujo', 'dailyLog'] })` à lista que já invalidava `weeklyLog`/`monthlyLog`; sem isso, editar uma tarefa de um Daily Log passado via `TaskDetailPanel` faria um update otimista "no-op" (a chave exata 'today' não bate) sem nunca convergir para o servidor.
- Linhas 181-183: `useReorderTaskMutation(logDate?)` — `queryKey: keys.bujo.todayLog(logDate)`.
- Linhas 244-249: `useDeleteTaskMutation.onSuccess` — `queryClient.invalidateQueries({ queryKey: keys.bujo.todayLog() })` → `['bujo', 'dailyLog']` (prefixo), alcançando também um Daily Log passado; comentário atualizado.
- Linhas 381-386: `useMigrateTaskMutation.onSuccess` — mesma troca de `keys.bujo.todayLog()` por `['bujo', 'dailyLog']` (prefixo), com comentário.

**Funcoes, classes e importacoes especificas**

- `useOptimisticMutation({ queryKey })` (`shared/hooks/useOptimisticMutation.ts`): o `onSettled` invalida **exatamente** o `queryKey` recebido na criação do hook — por isso `useTransitionTaskMutation`/`useReorderTaskMutation` precisam **generalizar a assinatura** (passar `logDate` no hook), não só ajustar invalidação externa.
- `client.get(url, { params })` (axios): serializa `params` em query string; `{ params: undefined }` é equivalente a não passar params (nenhum `?...` na URL) — por isso a chamada "hoje" segue idêntica no fio, embora a assinatura tenha mudado.
- `['bujo', 'dailyLog']` (prefixo de 2 elementos): mesma técnica **já usada nas mesmas funções** para `['bujo','weeklyLog']`/`['bujo','monthlyLog']` — alcança "hoje" e qualquer data passada, sem mudar o comportamento hoje observável (o caso "hoje" continua invalidado).

**Comportamento de libs usadas**

- TanStack Query `invalidateQueries({ queryKey })`: invalida por **prefixo** — `['bujo','dailyLog']` alcança `['bujo','dailyLog','today']` **e** `['bujo','dailyLog','2026-06-10']`; a chave exata `['bujo','dailyLog','today']` **não** alcança um dia passado (3º elemento difere). É a raiz do achado crítico #3.

---

## 5. Frontend — rota

### `frontend/src/app/router.tsx`

**Funcao geral do arquivo**

Definição declarativa das rotas (react-router) da aplicação.

**Funcao geral da alteracao**

Adiciona a rota `daily/:date` reusando `DailyPage` (Task 7.1) — mesmo padrão de `WeeklyPage`/`MonthlyPage` reusados pelas rotas de arquivo. Sem componente novo.

**Blocos principais**

- Linha 63 (nova): `{ path: 'daily/:date', element: <DailyPage />, handle: { title: 'Daily Log' } }`, logo abaixo da rota `today`.

**Funcoes, classes e importacoes especificas**

- `path: 'daily/:date'`: `:date` vira `useParams().date` dentro de `DailyPage`; `handle.title` alimenta o título contextual do layout.
- Nota da spec: **não** confundir com `/api/daily/{date}/` de `architecture.md` (endpoint de backend reservado e não construído) — esta é uma rota **só de frontend**, sem relação.

**Comportamento de libs usadas**

- react-router `RouteObject`: `element` compartilhado entre rotas na mesma posição da árvore **não remonta** ao trocar de path — fato central do achado MEDIUM da review (vazamento de estado), tratado nas páginas.

---

## 6. Frontend — hook de composição

### `frontend/src/pages/daily/useDailyData.ts`

**Funcao geral do arquivo**

Hook de composição da página Daily (ponto de agregação futura de habits/medications/gratitude nos Épicos 6-9). Hoje só compõe `bujo`.

**Funcao geral da alteracao**

Repassa `logDate?` para `useTodayLogQuery` (Task 7.2), habilitando a página a ler um dia passado.

**Blocos principais**

- Linhas 6-9: `useDailyData()` → `useDailyData(logDate?: string)`; `const todayLog = useTodayLogQuery()` → `useTodayLogQuery(logDate)`.

**Funcoes, classes e importacoes especificas**

- `useDailyData(logDate?)`: chamada existente sem argumento (`/today`) continua idêntica; `DailyPage` passa `routeDate` quando na rota `/daily/:date`.

**Comportamento de libs usadas**

- Transparente sobre `useTodayLogQuery` — só encaminha o parâmetro.

---

## 7. Frontend — componente do cabeçalho do dia (produtor do drill-down)

### `frontend/src/features/bujo/components/DayHeader.tsx`

**Funcao geral do arquivo**

Cabeçalho colapsável de um dia (data formatada + contagem de pendentes), usado no Daily Log e nas grades de Esta Semana/Este Mês.

**Funcao geral da alteracao**

Adiciona a prop opcional `linkToDaily` (default `false`, Task 8.1/8.3): quando `true` e o dia **não** é futuro, o `Typography` do cabeçalho vira um `RouterLink` para `/daily/<data>` (ou `/today` se for hoje); dias futuros ficam texto plano. Backward-compatible (sem a prop, nada muda).

**Blocos principais**

- Linha 2: import de `Link as RouterLink` de `react-router-dom`.
- Linhas 10 (interface): nova prop `linkToDaily?: boolean`.
- Linhas 16-19: função local `todayIso()` — retorna o ISO de hoje via `new Date()` + `getFullYear/getMonth/getDate` com zero-padding; **comparação de string**, não `Date.getTime()` (Task 8.3), evitando falso-negativo por hora/minuto (mesma lição de `MonthDensityCalendar`/11.10).
- Linhas 38-41: dentro do componente, `isToday = logDate === todayIso()`, `isFuture = logDate > todayIso()` (comparação lexicográfica de ISO, válida para 'AAAA-MM-DD'), `showLink = linkToDaily && !isFuture`.
- Linhas 57-67: render condicional — quando `showLink`, `Typography variant="heading" component={RouterLink} to={isToday ? '/today' : `/daily/${logDate}`}` com `sx` de link discreto (`color: 'inherit'`, sem sublinhado, sublinha no hover); senão, o `Typography` plano anterior.

**Funcoes, classes e importacoes especificas**

- `todayIso()`: âncora do cálculo "é hoje / é futuro"; retorna string ISO.
- `to={isToday ? '/today' : `/daily/${logDate}`}`: hoje aponta para a **rota canônica** `/today`, evitando uma segunda chave de cache para o mesmo conteúdo (AC2).
- `component={RouterLink}` no MUI `Typography`: renderiza um `<a>` navegável mantendo a tipografia `heading`.

**Comportamento de libs usadas**

- MUI `Typography` com `component`: troca o elemento raiz preservando estilos do variant.
- react-router `Link`: navegação client-side sem reload; expõe `role="link"` e `href` — base dos testes de `DayHeader`.

---

## 8. Frontend — páginas

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Página do Daily Log — lista as tarefas do dia, banners de ritual, `AddTaskRow`, atalho `N` e `TaskDetailPanel`.

**Funcao geral da alteracao**

Passa a servir também um **dia passado** via `/daily/:date` (Tasks 7.2-7.5): lê `routeDate` de `useParams`; quando presente, esconde banners de ritual + `AddTaskRow` + atalho `N` (criação restrita a hoje), mostra um link "Voltar para hoje", `aria-label` reflete a data, e usa `useTransitionTaskMutation(routeDate)`/`useReorderTaskMutation(routeDate)` para mirar o cache certo. A rota `/today` (sem parâmetro) mantém 100% do comportamento anterior.

**Blocos principais**

- Linhas 2-3: imports de `Link as RouterLink, useParams` e `Button` (MUI).
- Linha 22: `const { date: routeDate } = useParams<{ date: string }>()`.
- Linhas 23-25: `useDailyData(routeDate)`, `useTransitionTaskMutation(routeDate)`, `useReorderTaskMutation(routeDate)`; `createTask` segue sem parâmetro (criação só de hoje).
- Linha 28: `ariaLabel = routeDate ? `Daily Log de ${routeDate}` : 'Hoje'`.
- Linhas 37-39: `useEffect` do atalho `N` ganha `if (routeDate) return` no topo e `routeDate` na lista de deps — o listener não é registrado num dia passado.
- Linhas 66/79: `aria-label={ariaLabel}` no `Box component="main"` (nos ramos loading e principal).
- Linhas 82-92: quando `routeDate`, renderiza `<Button component={RouterLink} to="/today">Voltar para hoje</Button>`; senão, os 4 banners (`MigrationBanner`/`WeeklyReviewBanner`/`MonthlyReviewBanner`/`CatchUpBanner`).
- Linhas 96-101: texto de estado vazio muda para "Nenhuma tarefa neste dia." num dia passado.
- Linhas 114-116: `AddTaskRow` renderizado **só** quando `!routeDate`.

**Funcoes, classes e importacoes especificas**

- `useParams<{ date: string }>()`: `routeDate` é `undefined` em `/today`, string em `/daily/:date` — o discriminador de todo o comportamento condicional.
- `useTransitionTaskMutation(routeDate)`/`useReorderTaskMutation(routeDate)`: garantem que a transição/reordenação de uma tarefa de um dia passado atualize a chave `['bujo','dailyLog',<data>]`, não a de "hoje".

**Comportamento de libs usadas**

- react-router `useParams`/`Link`: leitura do segmento de rota e navegação de volta.
- MUI `Button component={RouterLink}`: link estilizado de "Voltar para hoje".

### `frontend/src/pages/planner/WeeklyPage.tsx`

**Funcao geral do arquivo**

Página "Esta Semana" — grade semanal (desktop) ou seletor de dia (mobile), formulário de criação, recorrentes e `TaskDetailPanel`. Renderizada tanto por `/planner/week` (sem param) quanto por `/archive/weekly/:weekStart` (parametrizada).

**Funcao geral da alteracao**

Quatro frentes: (1) **correção pré-existente** — read-only passa a depender só de `closed`, nunca de `isArchiveView` (Task 3.1); (2) navegação **anterior/próximo** com cálculo client-side da semana corrente (Task 4); (3) indicador de "semana passada aberta" + link "Voltar para a semana atual" (Task 5); (4) **correção da review** — `useEffect` chaveado em `routeWeekStart` resetando o estado local, para o rascunho/painel não vazar entre semanas (a página não remonta ao navegar entre rotas parametrizadas). Também passa `linkToDaily` aos `DayHeader`.

**Blocos principais**

- Linhas 1-6: imports de `useEffect`, `Link as RouterLink`, `IconButton`, `NavigateBeforeIcon`/`NavigateNextIcon`.
- Linhas 37-42: `isoOf(date)` — ISO local com zero-padding.
- Linhas 40-47: `addDaysIso(iso, days)` — parseia por partes (`new Date(y, m-1, d)`), soma dias, evita off-by-one de UTC.
- Linhas 49-57: `currentWeekStart()` — segunda-feira da semana de `new Date()` via `(getDay()+6)%7` (Monday-based, AD-05); cálculo de UI, não autoridade de domínio.
- Linhas 73-82: `useEffect(() => { setSelectedDayIndex(0); setPlacingTemplate(null); setTitle(''); setFormSelectedDay(''); setOpenTaskId(null) }, [routeWeekStart])` — o reset de estado da correção da review.
- Linha 114: `const onOpenDetail = !closed ? setOpenTaskId : undefined` (antes `!isArchiveView && !closed`).
- Linhas 116-121: `isCurrentWeek = weekStart === currentWeekStart()`, `previousWeekStart = addDaysIso(weekStart, -7)`, `nextWeekStart = addDaysIso(weekStart, 7)`, `nextWeekIsCurrent = nextWeekStart === currentWeekStart()`.
- Linhas 153-168: `Box` com dois `IconButton` (`RouterLink`) — "Semana anterior" → `/archive/weekly/${previousWeekStart}`; "Próxima semana" só quando `!isCurrentWeek`, → `/planner/week` se o destino for a corrente, senão `/archive/weekly/${nextWeekStart}`.
- Linhas 175-183: indicador `!closed && !isCurrentWeek` → `Typography variant="body-sm" component="div"` "Você está vendo uma semana passada."; e `!isCurrentWeek` → `Button` "Voltar para a semana atual" → `/planner/week`.
- Linhas 196/220: `linkToDaily` passado aos `DayHeader` (ramos mobile e desktop).
- Linha 246: guarda do formulário/recorrentes `{!closed && (...)}` (antes `{!isArchiveView && !closed && (...)}`).

**Funcoes, classes e importacoes especificas**

- `isArchiveView = Boolean(routeWeekStart)` (mantido): ainda usado no `aria-label` (`"Arquivo — Semana de ..."` vs `"Esta Semana"`) e na leitura `useWeeklyLogQuery(routeWeekStart)` — só o **efeito de bloquear escrita** deixou de depender dele.
- `component="div"` no `Typography variant="body-sm"`: lição HIGH da review 11.9 para `body-sm` de bloco.
- `nextWeekIsCurrent`: garante URL "limpa" (`/planner/week`) ao voltar ao presente.

**Comportamento de libs usadas**

- react-router `useParams`/`Link`/`IconButton component={RouterLink}`: navegação por clique nos controles.
- `Date.getDay()` + `(getDay()+6)%7`: reindexa domingo=0 para segunda=0 (AD-05).

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Página "Este Mês" — tarefas agrupadas por dia + seção "sem dia", formulário de criação, recorrentes e `TaskDetailPanel`. Renderizada por `/planner/month` e `/archive/monthly/:monthFirst`.

**Funcao geral da alteracao**

Mesmas quatro frentes de `WeeklyPage`, adaptadas ao mês: read-only por `closed` (Task 3.2), navegação anterior/próximo reusando `currentMonthFirst()`/`isCurrentMonth` já existentes (Task 4.3), indicador + link de volta (Task 5), `useEffect` de reset por `routeMonthFirst` (correção da review), e `linkToDaily` nos dois `DayHeader`.

**Blocos principais**

- Linhas 1-6: imports de `useEffect`, `Link as RouterLink`, `IconButton`, `NavigateBeforeIcon`/`NavigateNextIcon`.
- Linhas 34-39: `addMonthsIso(monthFirstIso, delta)` — parseia 'AAAA-MM-01', soma meses via `new Date(year, month-1+delta, 1)`, reformata; reusa `currentMonthFirst()` como única autoridade de "mês corrente".
- Linhas 75-85: `useEffect(() => { setTitle(''); setDay(''); setPlacingTemplate(null); setOpenTaskId(null) }, [routeMonthFirst])` — reset de estado (correção da review).
- Linha 116: `const onOpenDetail = !closed ? setOpenTaskId : undefined` (antes `!isArchiveView && !closed`).
- Linhas 118-121: `previousMonthFirst = addMonthsIso(monthFirst, -1)`, `nextMonthFirst = addMonthsIso(monthFirst, 1)`, `nextMonthIsCurrent = nextMonthFirst === currentMonthFirst()`.
- Linhas 177-192: `Box` com dois `IconButton` — "Mês anterior" → `/archive/monthly/${previousMonthFirst}`; "Próximo mês" só quando `!isCurrentMonth`, → `/planner/month` se destino for o corrente, senão `/archive/monthly/${nextMonthFirst}`.
- Linhas 198-208: indicador `!closed && !isCurrentMonth` → "Você está vendo um mês passado." (`body-sm`/`component="div"`); e `!isCurrentMonth` → `Button` "Voltar para o mês atual" → `/planner/month`.
- Linhas 222/237: `linkToDaily` nos dois `DayHeader` (ramo `isCurrentMonth` e ramo `else`/mês passado — o segundo é o "fácil de esquecer" citado nas Dev Notes).
- Linha 247: guarda `{!closed && (...)}` (antes `{!isArchiveView && !closed && (...)}`).

**Funcoes, classes e importacoes especificas**

- `isCurrentMonth`/`currentMonthFirst()` (já existentes): reusados, não recalculados (Task 4.3).
- `addMonthsIso`: aritmética de mês segura via `Date` local (overflow de mês tratado pelo construtor).

**Comportamento de libs usadas**

- Idem `WeeklyPage`: react-router `Link`/`IconButton`, MUI `Button`/`Typography`.

---

## 9. Frontend — testes de camada de dados, componente e página

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testes dos hooks de `api.ts` (Vitest + Testing Library `renderHook`), com axios (`client`) mockado e um `QueryClient` real por teste.

**Funcao geral da alteracao**

+125 linhas: cobre `useTodayLogQuery(logDate)`, o targeting de cache por data em transition/reorder, e a invalidação por prefixo `['bujo','dailyLog']` nas mutações update/delete/migrate. Ajusta o teste de regressão do `fetchTodayLog` (agora sempre recebe um 2º argumento).

**Blocos principais**

- Linhas 94-96: teste existente ajustado — `expect(mockGet).toHaveBeenCalledWith('/api/bujo/logs/today/', { params: undefined })` (antes sem o 2º argumento).
- Linhas 98-110: novo — `useTodayLogQuery('2026-06-10')` chama `client.get` com `{ params: { log_date: '2026-06-10' } }` e retorna o log passado.
- Linhas 157-181: `useTransitionTaskMutation('2026-06-10')` — o update otimista atinge `keys.bujo.todayLog('2026-06-10')` e **não** toca `keys.bujo.todayLog()` (hoje continua `undefined`).
- Linhas 328-352: `useReorderTaskMutation('2026-06-10')` — reordena a árvore no cache do dia passado; a chave "hoje" fica intacta.
- Linhas 432-452: `useUpdateTaskMutation` — no sucesso, `invalidateSpy` recebe `{ queryKey: ['bujo', 'dailyLog'] }` e o cache do dia passado fica `isInvalidated`.
- Linhas 646/656: teste de `useDeleteTaskMutation` renomeado e ajustado — invalida `['bujo','dailyLog']` (por prefixo) em vez de `keys.bujo.todayLog()`; teste novo confirma que o prefixo alcança o Daily Log passado.
- Linhas 728/737-748: `useMigrateTaskMutation` — mesma troca para `['bujo','dailyLog']` + teste novo do alcance por prefixo (destino `today`).

**Funcoes, classes e importacoes especificas**

- `qc.setQueryData(keys.bujo.todayLog('2026-06-10'), ...)` + `qc.getQueryState(...).isInvalidated`: montam e inspecionam o cache do dia passado.
- `mockPost.mockReturnValueOnce(new Promise(...))` com `resolvePost` diferido: mantêm a mutação `isPending` para observar o update otimista antes da resolução do servidor.

**Comportamento de libs usadas**

- TanStack Query `getQueryData`/`getQueryState`/`invalidateQueries`: `isInvalidated=true` prova que a invalidação por prefixo alcançou a chave do dia passado.

### `frontend/src/features/bujo/components/DayHeader.test.tsx`

**Funcao geral do arquivo**

Testes de componente do `DayHeader` (Vitest + Testing Library), agora sob `MemoryRouter` (necessário pelo `RouterLink`).

**Funcao geral da alteracao**

+57 linhas: envolve o helper de render em `MemoryRouter` e adiciona um `describe` para `linkToDaily`, com fake timers fixando "hoje" em 2026-06-15.

**Blocos principais**

- Linhas 1-2, 11-19: imports de `vi/beforeEach/afterEach`, `MemoryRouter`; `renderDayHeader` agora sob `<MemoryRouter>`.
- Linhas 54-63: `FIXED_TODAY = new Date('2026-06-15T12:00:00')` + `vi.useFakeTimers()`/`setSystemTime`.
- Linhas 64-69: sem `linkToDaily`, o cabeçalho **não** é link (`queryByRole('link')` ausente) — comportamento padrão inalterado.
- Linhas 71-77: `linkToDaily` + dia passado (2026-06-10) → link com `href='/daily/2026-06-10'`.
- Linhas 79-84: `linkToDaily` + hoje (2026-06-15) → link com `href='/today'` (rota canônica).
- Linhas 86-91: `linkToDaily` + dia futuro (2026-06-20) → **não** vira link.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- `vi.useFakeTimers()`/`vi.setSystemTime()`: fixam `new Date()` para o cálculo determinístico de "é hoje/futuro".
- `getByRole('link', { name })`/`toHaveAttribute('href', ...)`: leem o link acessível real.

### `frontend/src/pages/daily/DailyPage.test.tsx`

**Funcao geral do arquivo**

Testes de página do `DailyPage` (Vitest + Testing Library + jest-axe), com hooks de `bujo` mockados.

**Funcao geral da alteracao**

+128 linhas: envolve o render existente em `MemoryRouter`, adiciona `renderDailyPageAtDate(date)` (monta `<Routes>` com `daily/:date`) e um `describe` da rota `/daily/:date`.

**Blocos principais**

- Linhas 2, 89-95: import de `MemoryRouter, Route, Routes`; `renderDailyPage` sob `<MemoryRouter>`.
- Linhas 97-114: `renderDailyPageAtDate(date)` — `MemoryRouter initialEntries={['/daily/${date}']}` + `<Route path="daily/:date" element={<DailyPage />} />`.
- Linhas 578-600: renderização via `/daily/:date` — `mockUseTodayLogQuery` recebe a data como 1º argumento; `aria-label` "Daily Log de 2026-06-10".
- Linhas 601-611: banners de ritual **não** renderizam num dia passado.
- Linhas 613-623: `AddTaskRow` (`textbox` "Nova tarefa") ausente num dia passado.
- Linhas 625-637: atalho `N` não foca nada (sem `AddTaskRow`) — `document.activeElement` não muda.
- Linhas 639-659: `TaskRow` funcional — clicar "Pendente" chama `mutate({ taskId, toStatus: 'started' })`; "Ver detalhes" abre o painel.
- Linhas 661-671: link "Voltar para hoje" → `/today`.
- Linhas 673-680: regressão — `/today` (sem parâmetro) mantém `aria-label` "Hoje", sem link de volta, com `AddTaskRow`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- `mockUseTodayLogQuery.mock.calls[0][0]`: confirma que a página passou `routeDate` ao hook.
- `renderDailyPageAtDate`: mesma técnica de `renderWeeklyPageAtArchiveRoute` — a única forma de montar `useParams` com valor real.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

**Funcao geral do arquivo**

Testes de página do `WeeklyPage` (Vitest + Testing Library + jest-axe), com `useWeeklyLogQuery` mockado.

**Funcao geral da alteracao**

+138 linhas: novo `describe` de navegação anterior/próximo + 3 indicadores (com fake timers), inversão dos 2 testes acoplados a `isArchiveView` (Task 3.4) e novos casos de "período passado aberto acionável".

**Blocos principais**

- Linhas 359-483: `describe('Navegação anterior/próximo + indicadores de 3 estados')` — semana corrente ("anterior" navega -7d, "próximo" ausente, sem indicador/link); semana passada aberta (indicador informativo + "próximo" +7d + link de volta); "próximo" a partir da semana imediatamente anterior cai na rota canônica; semana passada fechada (indicador "Fechada", não o informativo, + link); `jest-axe` no estado "passado aberto" (com `vi.useRealTimers()` antes do `axe`); e o **teste de regressão do vazamento de estado** — digita no "Título", clica "Semana anterior" via `<Routes>` real, e afirma que o campo volta a vazio.
- Linhas 548-553: teste renomeado — `'form aparece em período passado aberto (closed: false) mesmo via rota parametrizada'` (antes `'form não aparece em isArchiveView'`), agora esperando o formulário **presente**.
- Linhas 577/587-591: `'painel não abre... quando closed: true, mesmo via rota parametrizada'` + novo `'painel abre (TaskRow acionável) em período passado aberto (closed: false) via rota parametrizada'`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- `mockUseWeeklyLogQuery.mockImplementation((weekStart?) => ...)`: no teste de regressão, reflete o `weekStart` da rota para provar que a instância não remonta.
- `vi.useRealTimers()` antes de `axe`: o jest-axe usa timers reais internamente — sem isso, trava com fake timers ativos.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testes de página do `MonthlyPage` (Vitest + Testing Library + jest-axe), com `useMonthlyLogQuery` mockado.

**Funcao geral da alteracao**

+163 linhas: espelha `WeeklyPage.test.tsx` para o mês — `describe` de navegação + indicadores, inversão dos testes de `isArchiveView`, e o teste de regressão do vazamento de estado.

**Blocos principais**

- Linhas 493/508-517: teste de arquivo renomeado (`closed: true esconde form + recorrentes`) + novo `'form aparece em período passado aberto (closed: false) mesmo via rota parametrizada'`.
- Linhas 533-667: `describe('Navegação anterior/próximo + indicadores de 3 estados')` — mês corrente ("anterior" -1 mês, sem "próximo"/indicador/link); mês passado aberto (indicador + "próximo" +1 mês + link); "próximo" do mês imediatamente anterior cai em `/planner/month`; mês passado fechado (indicador "Fechado" + link); `jest-axe` no "passado aberto"; e o teste de regressão do rascunho não-vazado via `<Routes>` real.
- Linhas 693/705-715: `onOpenDetail` — teste renomeado para `closed: true` + novo `'painel abre (TaskRow acionável) em período passado aberto (closed: false) via rota parametrizada'`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- `MONTHLY_LOG_CURRENT` + `vi.setSystemTime`: variam a data do relógio para simular o mês exibido como corrente/passado sem tocar o mock do log.
- Idem `WeeklyPage.test.tsx` para o padrão de regressão e de a11y.

---

## 10. Frontend — teste E2E e helper de seed

### `frontend/e2e/past-period-navigation.spec.ts` (novo, untracked)

**Funcao geral do arquivo**

Spec Playwright E2E da Story 11.11 contra o backend real (branch Neon `e2e`), sem mocks de rede. Valida navegação anterior/próximo, os 3 indicadores, o drill-down do dia e o guardrail de somente-leitura — tudo pelos controles de UI, não por URL direta.

**Funcao geral da alteracao**

Arquivo novo com 3 cenários (Task 10.1). Cada um coleta `consoleErrors` (via `page.on('console')`/`page.on('pageerror')`) e afirma `toEqual([])` ao fim.

**Blocos principais**

- Linhas 14-60: "semana anterior aberta permanece acionável" (AC1/AC3/AC5) — parte de Esta Semana (sem "Próxima semana"), clica "Semana anterior" 2x, confirma o indicador informativo + "Próxima semana" + "Voltar para a semana atual"; adiciona uma tarefa (formulário funciona num período passado aberto), confirma "Mover tarefa" habilitado (seletor da 11.10 já funciona por construção), abre/fecha o painel de detalhe, e volta ao presente pelo link.
- Linhas 62-96: "semana passada fechada permanece somente-leitura" (AC4) — `seedArchiveScenario` fecha a semana de 2 semanas atrás; 2 cliques em "Semana anterior" chegam nela pela navegação real; confirma "Fechada" (não o indicador informativo), ausência de formulário e de "Ver detalhes", e presença de "Voltar para a semana atual".
- Linhas 98-146: "clicar num dia passado dentro de Esta Semana abre o Daily Log daquele dia" (AC2/AC3) — usa `seedPastDailyTask(email, 1, ...)` (única forma de compor um Daily Log passado); navega 1x para trás; clica o link do dia localizando pelo `href="/daily/${logDate}"` real (não pelo texto formatado); confirma URL/`aria-label`, tarefa acionável (transição via `waitForResponse` do `/transition/`, status 200), ausência de "Nova tarefa", e "Voltar para hoje".

**Funcoes, classes e importacoes especificas**

- `seedArchiveScenario`/`seedPastDailyTask`: montam os cenários de período fechado e de Daily Log passado.
- `page.locator(`a[href="/daily/${logDate}"]`)`: localiza o link do dia pelo destino real (Task 8.1) — desacopla o teste do formato de exibição da data.
- `page.waitForResponse((r) => r.url().includes('/transition/') && method === 'POST')`: prova que a transição num dia passado atinge o backend (200).

**Comportamento de libs usadas**

- Playwright locators acessíveis (`getByRole`/`getByLabel`/`getByText`) + `toBeVisible`/`toHaveCount`; `--workers=1` por cold-start da branch Neon `e2e`.

### `frontend/e2e/seedPastDailyTask.ts` (novo, untracked)

**Funcao geral do arquivo**

Helper de seed que cria, via `manage.py shell`, um Daily Log passado com uma tarefa `pending` para o usuário da fixture — única forma de compor esse cenário (a UI não permite criar tarefa num Daily Log arbitrário).

**Funcao geral da alteracao**

Arquivo novo. Generaliza a técnica de `seedYesterdayQueue.ts` (Story 4.2): o `log_date` é a **segunda-feira de `weeksAgo` semanas atrás** (via `week_start_of`, a mesma autoridade do backend), garantindo que o dia caia exatamente na semana alcançada clicando "Semana anterior" `weeksAgo` vezes.

**Blocos principais**

- Linhas 1-15: imports Node (`execFileSync`, `path`, `fileURLToPath`) + `DJANGO_SETTINGS_MODULE`; resolve `backendDir`.
- Linhas 17-28: `SeedPastDailyTaskResult { logDate }` e assinatura `seedPastDailyTask(email, weeksAgo, title)`.
- Linhas 29-44: script Python inline — sob `tenant_context(user)`, `log_date = week_start_of(today_for(user)) - timedelta(weeks=weeksAgo)`, cria `Log` + `Task(status="pending", order_index=1.0)`, imprime `{"logDate": ...}` em JSON.
- Linhas 46-56: `execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], ...)`; parseia a **última linha não-vazia** do stdout (o `shell -c` imprime um banner antes) — mesma técnica de `seedArchiveScenario.ts`.

**Funcoes, classes e importacoes especificas**

- `week_start_of(today_for(user))`: alinha o dia seedado à segunda-feira, casando com a navegação por clique.
- `JSON.stringify(email)`/`JSON.stringify(title)`: escapam os valores injetados no script Python (evita quebra de string/injeção).

**Comportamento de libs usadas**

- `execFileSync` (Node): executa o comando síncrono, captura stdout (`stdio: 'pipe'`), com `env` incluindo `DJANGO_SETTINGS_MODULE`.

---

## 11. Registro de status e rastreamento

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreamento de status das stories do projeto.

**Funcao geral da alteracao**

Reflete a conclusão da 11.11: `11-11-navegar-e-agir-em-logs-passados-nao-fechados: backlog → done` e `last_updated` para `2026-07-16  # story 11.11 → done (code review)`. Epic 11 segue `in-progress`; a `epic-11-retrospective` permanece `optional`.

**Blocos principais**

- Linha 38: `last_updated` com a nota da 11.11.
- Linha 92: `11-11-navegar-e-agir-em-logs-passados-nao-fechados: done`.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem símbolos; estado YAML consumido pelos workflows de sprint.

### `_bmad-output/story-automator/orchestration-11-20260716-015115.md` (modificado)

> Artefato autodocumentado de rastreamento do run do orquestrador. Não contém runtime da aplicação. Resumido brevemente, conforme escopo.

**Funcao geral do arquivo**

State doc do run do story-automator para o lote 11.7-11.11.

**Funcao geral da alteracao**

Avança o run da 11.10 até a 11.11: front matter `currentStory: 11.10 → 11.11`, `currentStep: step-03a-execute-review → step-03b-execute-finish`, `lastUpdated`; na tabela de progresso 11.10 vira `done` em todas as colunas e 11.11 fica `create/dev/automate/code-review: done` com `git-commit` pendente (`in-progress`). O Action Log ganha entradas do fechamento da 11.10 (commit `5d677f7`), início da 11.11, create (ready-for-dev; A2 gate pulado por redundância; 2 bugs pré-existentes identificados como prereq; backend delta = `TodayLogView` +`log_date`), dev-story done (automate coberto pelo dev; suíte Neon ~15min pulada por cosmética), e **code-review PASSED** — backend 368 / frontend 542, MEDIUM corrigido (regressão real de remount/state-leak na nav anterior/próximo, reset chaveado por rota + testes), LOW jest-axe do período passado, LOW documentado (`/daily/<hoje>` em visão reduzida), e nota de um "git stash mishap" recuperado limpo.

**Funcoes, classes e importacoes especificas / Comportamento de libs**

- Sem símbolos; rastreamento consumido apenas pelo próprio story-automator, não pela aplicação em runtime.

---

## 12. Relacao produtor-consumidor e validacao cruzada

- `11-11-...md` (spec) **produz** o contrato funcional (5 ACs + os 3 achados críticos documentados) consumido pelo dev-story.
- `views.py` (`TodayLogView` +`log_date`) **é validado** por `test_views.py` (200 para data passada, idempotente, 400 malformado, regressão sem param) e ponta-a-ponta pelo cenário de drill-down do e2e.
- `keys.ts` (`todayLog(logDate?)`) **produz** as chaves consumidas por `api.ts`; o prefixo compartilhado `['bujo','dailyLog']` é o que torna a correção de invalidação correta.
- `api.ts` (`useTodayLogQuery`/mutações generalizadas + invalidação por prefixo) **é consumido** por `useDailyData.ts` → `DailyPage.tsx`, e **é validado** por `api.test.tsx` (targeting de cache por data + invalidação por prefixo em transition/reorder/update/delete/migrate).
- `router.tsx` (`/daily/:date`) **habilita** `DailyPage.tsx` a ler `routeDate`; `DayHeader.tsx` (`linkToDaily`) **produz** o link consumido por `WeeklyPage.tsx`/`MonthlyPage.tsx`.
- `WeeklyPage.tsx`/`MonthlyPage.tsx` (nav anterior/próximo + read-only por `closed` + reset por rota) **são validados** por `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` (navegação, 3 indicadores, inversão dos testes de `isArchiveView`, regressão do vazamento de estado, a11y) e, ponta-a-ponta, por `past-period-navigation.spec.ts`.
- `seedPastDailyTask.ts` **produz** o cenário de Daily Log passado consumido pelo 3º cenário do e2e.
- `sprint-status.yaml` e `orchestration-11-...md` **registram** o resultado (11.11 → done), sem participar do runtime.

### Observacao de escopo e risco (ja registrada)

- **Contrato intacto:** o diff **não** inclui `schema.yaml`, `frontend/src/api/types.gen.ts`, `serializers.py`, `urls.py`, `services/` nem migrações. `log_date` segue o padrão não-anotado de `week_start`/`month_first` (gap pré-existente, fora de escopo corrigir).
- **Três correções pré-existentes:** (1) read-only por `closed` em vez de `isArchiveView` — nunca importou porque a única rota parametrizada só era alcançada do Arquivo (sempre fechado); (2) invalidação do Daily Log por prefixo em vez da chave exata "today" — nunca precisou até existir uma variante não-"today" do cache; (3) vazamento de estado entre navegações anterior/próximo (mesmo componente não remonta) — achado MEDIUM da review, corrigido por `useEffect` chaveado no parâmetro de rota, com testes de regressão que falham sem o fix.
- **Criação nova num Daily Log passado é fora de escopo:** `TaskCreateView`/`create_task` só cria em `today_for(user)`; a story permite agir sobre tarefas **existentes**, não criar novas — por isso o e2e precisa de `seedPastDailyTask.ts` (seed direto).
- **LOW registrado sem fix:** navegar manualmente para `/daily/<data-de-hoje>` (URL direta, nunca gerada pela UI) renderiza hoje em modo "dia passado"; um fix robusto exigiria mover a checagem "é hoje" para antes dos hooks (risco de violar Rules of Hooks na virada de meia-noite). Baixo valor/probabilidade — deixado como nota.
- **Contagens de teste (colhidas na story):** backend `pytest` **368 passed** (baseline 364, +4); frontend `vitest` **542 passed (45 arquivos)** (baseline 509; +29 na story +4 na review). Não reexecutadas na produção deste relatório.
