---
baseline_commit: f160b0b68cdf5eb4f7da85f8485c80bcc8df7aa3
---

# Story 11.4: Anuais pendentes consultáveis e colocáveis no Future Log

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero ver e colocar, direto do Future Log e o ano todo, os recorrentes anuais ainda não colocados no ano,
Para que eu não perca anuais só porque não abri o ciclo de janeiro (item #6 de `docs/futureIdeas.md`).

## Acceptance Criteria

### AC1 — Future Log exibe seção "Anuais pendentes de [ano]"

- **Dado que** o Future Log,
- **Quando** ele carrega,
- **Então** exibe uma seção "Anuais pendentes de [ano]" listando os templates de grupo `annual` que ainda não foram colocados neste ano.

### AC2 — Colocar um anual dali reusa o fluxo de placement da Story 11.3

- **Dado que** essa seção,
- **Quando** coloco um anual dali,
- **Então** o placement acontece reusando o fluxo da Story 11.3 (`RecurringPlacementDialog` + `MonthDensityCalendar` + `usePlaceRecurringTemplateMutation`),
- **E** o item some da seção ao ser colocado.

### AC3 — Sem estado vazio ruidoso

- **Dado que** um ano em que todos os anuais já foram colocados (ou não há anuais),
- **Então** a seção não aparece.

### Nota de escopo — revoga a decisão da Story 4.5

Esta story **revoga** a decisão da Story 4.5 (Task 12.3, Dev Notes "`annual` não tem 'abertura do ano' definida...") de que templates `annual` só aparecem na `RecurringPlacementSection` do `MonthlyPage` quando o mês exibido é janeiro. Ver Dev Notes "Por que revogar (e não só adicionar)" para o porquê.

## Tasks / Subtasks

> **Esta story toca backend E frontend**, mas o toque de backend é mínimo: um **filtro de query param aditivo** numa view já existente (`RecurringTaskTemplateListView`), sem nova rota, sem novo serializer de resposta, **sem diff de contrato** (`schema.yaml`/`types.gen.ts` — a view não declara `parameters=` no `@extend_schema` hoje, então um filtro novo em `query_params` não aparece no OpenAPI, igual a `active`/`recurrence_group` já existentes). Nenhuma migração, nenhum campo de modelo novo. O grosso do trabalho é frontend: uma seção nova no `FuturePage` + a remoção da lógica de "annual só em janeiro" no `MonthlyPage`.

### Backend

- [x] **Task 1: Filtro `unplaced_year` em `RecurringTaskTemplateListView`** (AC: #1)
  - [x] 1.1 Em `backend/bujo/views.py`, `RecurringTaskTemplateListView.get` (linhas 156-166), adicionar um terceiro filtro opcional após `active`/`recurrence_group`:
    ```python
    unplaced_year_param = request.query_params.get("unplaced_year")
    if unplaced_year_param:
        try:
            unplaced_year = int(unplaced_year_param)
        except ValueError:
            raise serializers.ValidationError(
                {"unplaced_year": "Deve ser um ano válido (inteiro)."}
            ) from None
        templates = templates.exclude(instances__monthly_log__month_first__year=unplaced_year)
    ```
    Mesmo estilo de parsing manual (sem serializer de query dedicado) já usado por `active`/`recurrence_group` nesta view — não inventar um `QuerySerializer` novo só para este filtro isolado.
  - [x] 1.2 **Semântica ("colocado neste ano") — mesma regra de presença da Story 11.3:** um template está "colocado no ano Y" se existe **qualquer** `Task` com `source_template = template` cujo container (`monthly_log`) tem `month_first.year == Y` — **inclusive migradas/canceladas** (11.3 Dev Notes: "Presença = colocado, inclusive migradas/canceladas"). `instances` é o `related_name` de `Task.source_template` (`bujo/models.py:147-153`). Annual **só** coloca em `monthly_log` (nunca `weekly_log`/`log`) — AD-08 item 5, confirmado em `place_template` (`services/recurring.py:47-53`: "monthly E annual colocam no mesmo container").
  - [x] 1.3 **`.exclude(instances__...)` é uma travessia por JOIN, não passa pelo manager `Task.objects`** — mas isso é seguro aqui: a queryset base (`RecurringTaskTemplate.objects.all()`, linha 159) já é tenant-scoped (fail-closed, AD-12) **antes** do `.exclude`; o JOIN só correlaciona `Task`s que apontam pra templates já filtrados por tenant, e toda `Task` criada por `place_template` pertence ao mesmo tenant do seu `source_template` (nunca há `Task` de outro tenant referenciando um template deste tenant). Documentar esse raciocínio no code review se questionado — **não precisa de teste de isolamento dedicado novo** (não é uma superfície de leitura nova como o `TaskDensityView` da 11.3; é um filtro a mais numa view já coberta) — mas Task 2.6 abaixo adiciona um teste de regressão barato para essa garantia.
  - [x] 1.4 **Sem `extend_schema(parameters=...)` novo** — a view já não declara parâmetros no schema hoje (confirmado: `schema.yaml:195-210` não tem bloco `parameters` no GET). Manter assim; não introduzir documentação de parâmetro que os filtros existentes (`active`, `recurrence_group`) também não têm — consistência > completude aqui.

- [x] **Task 2: Testes de backend** (AC: #1)
  - [x] 2.1 Em `backend/bujo/tests/test_views.py`, seção `# --- RecurringTaskTemplateView* ---` (perto de `test_get_recurring_templates_filtra_por_recurrence_group`, linha ~1415): `unplaced_year` exclui template com instância no ano pedido — criar `RecurringTaskTemplateFactory(recurrence_group=annual)`, colocar via `place_template(month_first=date(Y,3,1))`, então `GET ?recurrence_group=annual&unplaced_year=Y` → **não** retorna o template.
  - [x] 2.2 Template **sem** instância nenhuma → aparece no filtro `unplaced_year=Y` (caso comum: recorrente recém-criado).
  - [x] 2.3 Template com instância **em outro ano** (ex.: colocado em `Y-1`) → **aparece** no filtro `unplaced_year=Y` (ainda pendente neste ano).
  - [x] 2.4 **Presença inclui migrada/cancelada:** colocar o template no ano Y, transicionar a `Task` resultante para `cancelled` (ou simular migração) → `GET ?unplaced_year=Y` continua **excluindo** o template (mesma regra de dedup da 11.3, não "desfaz" a presença).
  - [x] 2.5 `unplaced_year` inválido (não-numérico, ex. `?unplaced_year=abc`) → 400 com o campo no corpo do erro (mesmo formato de envelope custom já usado pelo `TaskDensityView`, `response.data["fields"]["unplaced_year"]` — ver Debug Log 11.3 sobre o formato do handler).
  - [x] 2.6 **Regressão de isolamento (barata, não a suíte completa):** dois usuários, cada um com um template `annual` **idêntico em título**; `other_user` coloca o dele no ano Y; `GET` do `user` com `?unplaced_year=Y` ainda retorna o template do `user` (não é afetado pela instância do outro tenant) — prova a garantia do Task 1.3.
  - [x] 2.7 Query combinada realista (a que o frontend de fato usa): `?active=true&recurrence_group=annual&unplaced_year=Y` com uma mistura de templates ativos/inativos, weekly/monthly/annual, colocados/não — só o(s) template(s) `annual` ativo(s) e não-colocados no ano Y voltam.

### Frontend

- [x] **Task 3: Camada de dados — `unplacedYear` em `useRecurringTemplatesQuery`** (AC: #1)
  - [x] 3.1 Em `frontend/src/features/bujo/api.ts`, estender `RecurringTemplatesParams` (linha 331-334): adicionar `unplacedYear?: number`.
  - [x] 3.2 Em `fetchRecurringTemplates` (linha 336-347), mapear para `unplaced_year` no objeto `params` do axios (mesma convenção snake_case no fio dos demais filtros desta função).
  - [x] 3.3 Em `frontend/src/api/keys.ts`, o tipo de `recurringTemplates(params?: ...)` (linha 22-23) já aceita um objeto genérico — estender a assinatura do parâmetro para incluir `unplacedYear?: number` (só o tipo; a implementação (`['bujo','recurringTemplates','list', params ?? {}]`) não muda).
  - [x] 3.4 **Nenhuma mudança de invalidação necessária:** `usePlaceRecurringTemplateMutation` (api.ts:425-441) já invalida `keys.bujo.recurringTemplates()` (sem params → `{}`) por prefixo — `{}` faz partial-match contra **qualquer** objeto de params no cache (inclusive `{ active: true, recurrenceGroup: 'annual', unplacedYear: 2026 }`), então colocar um anual já invalida a lista "pendentes deste ano" automaticamente. Confirmar isso com um teste (Task 6), não assumir.

- [x] **Task 4: Seção "Anuais pendentes de [ano]" no `FuturePage`** (AC: #1, #2, #3)
  - [x] 4.1 Em `frontend/src/pages/planner/FuturePage.tsx`, adicionar um helper local `currentYear(): number { return new Date().getFullYear() }` — mesma técnica de cálculo "agora" **client-side, só para UI** já estabelecida em `MonthlyPage.tsx:23-28` (`currentMonthFirst()`) e `MigrationCard`; **não** é autoridade de negócio (essa continua sendo `today_for` no backend, AR-6) — é só o rótulo/filtro de uma seção informativa.
  - [x] 4.2 Buscar os pendentes com `useRecurringTemplatesQuery({ active: true, recurrenceGroup: 'annual', unplacedYear: currentYear() })`.
  - [x] 4.3 **Regra de "sem DOM quando vazio" (AC3)** — mesmo molde de `MigrationBanner`/`CatchUpBanner`/`RecurringPlacementSection` (11.3, `RecurringPlacementSection.tsx:47`: `if (templates.isPending || inGroup.length === 0) return null`): se `templates.isPending` ou a lista vier vazia, **não renderizar a seção** (nem o heading). Zero estado vazio ruidoso — a AC3 é explícita sobre isso.
  - [x] 4.4 Heading exato: `` `Anuais pendentes de ${currentYear()}` `` (variant `heading`, mesmo padrão dos outros headings da página, ex. `formatMonthGroupTitle`). Cada item: título do template + botão "Definir placement" (rótulo idêntico ao já usado em `RecurringPlacementSection.tsx:82` — mesma ação, mesma label, não inventar um rótulo novo pra a mesma interação).
  - [x] 4.5 **Posição da seção na página:** depois do `FutureLogItemForm` e depois da lista de grupos por mês (final da página) — mesmo lugar relativo que `RecurringPlacementSection` ocupa em `WeeklyPage`/`MonthlyPage` (área de "sugestões de recorrentes" vem depois do conteúdo principal do log, não antes). Não é a única posição defensável, mas é a que seque o precedente já estabelecido nas outras duas páginas do Planner — manter consistência de layout entre as 3 páginas do Planner.
  - [x] 4.6 **Diálogo de placement:** estado local `const [placingAnnualTemplate, setPlacingAnnualTemplate] = useState<RecurringTaskTemplate | null>(null)`. Renderizar `<RecurringPlacementDialog open={placingAnnualTemplate !== null} dateFieldType="date" template={placingAnnualTemplate} monthFirst={currentMonthFirst()} onClose={...} onConfirm={...} />` — **componente reaproveitado sem alteração** (mesma assinatura de props já usada por `WeeklyPage`/`MonthlyPage`, Story 11.3). `monthFirst` aqui é só o mês inicial exibido no calendário de densidade (informativo) — não é o mês do placement real.
  - [x] 4.7 **`onConfirm` — cálculo do container real do placement** (não existe "mês corrente" natural para um anual colocado do Future Log, diferente de `MonthlyPage`/`WeeklyPage` que já têm um período fixo em mãos):
    ```ts
    function handleConfirmAnnualPlacement(dateValue: string) {
      if (!placingAnnualTemplate) return
      const scheduledDate = dateValue || undefined
      const monthFirst = scheduledDate ? `${scheduledDate.slice(0, 7)}-01` : currentMonthFirst()
      placeTemplate.mutate({ templateId: placingAnnualTemplate.id, monthFirst, scheduledDate })
      setPlacingAnnualTemplate(null)
    }
    ```
    Data escolhida (campo "Data (opcional)" do dialog, `dateFieldType="date"`) → `monthFirst` = mês/ano da data escolhida. Campo deixado em branco → cai no mês corrente (`currentMonthFirst()`, mesmo helper de `MonthlyPage.tsx`, duplicado localmente por ora — ver Dev Notes sobre por que não extrair um util compartilhado). **`day=1` sempre garantido** pelo slice (`scheduledDate.slice(0,7)` é sempre `YYYY-MM`), consistente com o padrão já usado em `WeeklyPage`/`MonthlyPage` (nenhuma validação de servidor exige isso para este endpoint, mas é a convenção do projeto).
  - [x] 4.8 Chamar `usePlaceRecurringTemplateMutation()` (já existente, sem alteração) para a mutation. Após sucesso, o item some **automaticamente** da seção — não escrever lógica de remoção manual: a invalidação por prefixo (Task 3.4) refaz o fetch de `unplacedYear` e o template colocado não volta na resposta.
  - [x] 4.9 Importar `RecurringPlacementDialog`, `useRecurringTemplatesQuery`, `usePlaceRecurringTemplateMutation`, `RecurringTaskTemplate` (tipo) — `RecurringPlacementDialog` continua importado do caminho direto do componente (`../../features/bujo/components/RecurringPlacementDialog`), não do barrel, mesma convenção de `WeeklyPage`/`MonthlyPage`.

- [x] **Task 5: Revogar a lógica "annual só em janeiro" no `MonthlyPage`** (Nota de escopo)
  - [x] 5.1 Em `frontend/src/pages/planner/MonthlyPage.tsx:80-87`, remover a ramificação de `annual`. `recurrenceGroups` volta a ser sempre `isCurrentMonth ? ['monthly'] : []` — sem checagem de `Number(monthFirst.slice(5,7)) === 1`.
  - [x] 5.2 Remover/atualizar o comentário associado (linhas 80-82, "Task 12.3... `annual` só se soma quando o mês exibido é janeiro") — não deixar comentário morto referenciando uma regra que não existe mais.
  - [x] 5.3 **Não tocar em mais nada de `MonthlyPage`** — o resto (dedup via `placedTemplateIds`, `RecurringPlacementDialog` com `dateFieldType="day"`, form de adicionar tarefa) é ortogonal a esta mudança e fica intacto.

### Testes & Verificação

- [x] **Task 6: Testes de frontend** (AC: #1, #2, #3)
  - [x] 6.1 **Reescrever `frontend/src/pages/planner/FuturePage.test.tsx` para o padrão `importOriginal` + `QueryClientProvider` real + `client` mockado** — mesmo padrão de `MonthlyPage.test.tsx`/`WeeklyPage.test.tsx` (11.3). Motivo: `FuturePage` passa a chamar `useRecurringTemplatesQuery`/`usePlaceRecurringTemplateMutation` (hooks reais, TanStack Query) e a montar `RecurringPlacementDialog` (real, chama `useTaskDensityQuery` real) — o mock atual do teste (`vi.mock('../../features/bujo', () => ({ useFutureLogQuery: ..., useCreateMonthlyTaskMutation: ... }))`, sem `importOriginal`) vai quebrar tudo que a página agora importa a mais. Trocar por:
    ```ts
    vi.mock('../../features/bujo', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../features/bujo')>()
      return { ...actual, useFutureLogQuery: vi.fn(), useCreateMonthlyTaskMutation: vi.fn(() => ({ mutate: mockCreateMutate })) }
    })
    vi.mock('../../api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
    ```
    E envolver o render com `QueryClientProvider` (novo `QueryClient` por teste, `retry: false`).
  - [x] 6.2 **Todos os testes existentes** (skeleton, estado vazio, agrupamento por mês, prefixo de dia, submit do form, a11y) precisam de `mockGet.mockResolvedValue({ data: [] })` num `beforeEach` — assim a busca de `unplacedYear` sempre volta vazia e a seção nova fica sem DOM (AC3), não interferindo nos testes que não são sobre ela (mesmo padrão de `MonthlyPage.test.tsx:138`).
  - [x] 6.3 **Testes novos da seção "Anuais pendentes de [ano]":**
    - Com templates `annual` pendentes retornados por `GET /api/bujo/recurring-templates/`, a seção aparece com o heading `` `Anuais pendentes de ${ano}` `` (mockar `client.get` roteando por URL, mesmo padrão `routeRecurringTemplatesGet` de `MonthlyPage.test.tsx:293-300`); conferir que a chamada real inclui `unplaced_year` no `params` (`expect(mockGet).toHaveBeenCalledWith('/api/bujo/recurring-templates/', { params: { active: true, recurrence_group: 'annual', unplaced_year: <ano fixado via `vi.setSystemTime`> } })`).
    - Lista vazia (`data: []` para essa query específica) → seção **não** aparece (sem heading, sem DOM) — AC3.
    - Clicar "Definir placement" no item anual abre o `RecurringPlacementDialog` com as infos do template (título/descrição/`recurrenceText`, herdado sem alteração da 11.3).
    - Confirmar com uma data preenchida → `client.post` chamado em `/api/bujo/recurring-templates/<id>/place/` com `monthFirst` = mês/ano da data e `scheduledDate` = a data exata.
    - Confirmar **sem** preencher a data → `client.post` chamado com `monthFirst` = mês corrente (`vi.setSystemTime` fixando "hoje" para determinismo) e `scheduledDate: undefined`.
    - Fixar "hoje" via `vi.useFakeTimers()` + `vi.setSystemTime(...)` (mesma técnica de `MonthlyPage.test.tsx:75,134-135`) para tornar o ano/mês do heading e do placement determinísticos — **não** depender do relógio real da máquina.
    - `jest-axe` sem violações com a seção renderizada (componente real, nunca mockado — lição recorrente 3.3–11.3).
  - [x] 6.4 **`MonthlyPage.test.tsx`:** atualizar o teste `'mês corrente = janeiro: seção mostra templates monthly e annual'` (linhas 328-342) — com a lógica revogada, o resultado esperado agora é o **oposto**: mesmo em janeiro, `Revisão anual` **não** aparece na `RecurringPlacementSection` do `MonthlyPage`. Renomear o teste para algo como `'mês corrente = janeiro: seção mostra só templates monthly (annual revogado — Story 11.4)'` e trocar a asserção de `findByText` por `queryByText(...).not.toBeInTheDocument()`.
  - [x] 6.5 **`frontend/src/features/bujo/api.test.tsx`:** estender `describe('useRecurringTemplatesQuery ...')` (linha 692-722) com um teste para `unplacedYear` → `params: { unplaced_year: <n> }` no `client.get`, mesmo formato do teste já existente para `active`/`recurrenceGroup` (linhas 708-721).

- [x] **Task 7: Verificação final** (AC: #1, #2, #3)
  - [x] 7.1 **Backend:** `cd backend && uv run pytest --reuse-db && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — **330 passed** (baseline 323 + 7 testes novos do filtro `unplaced_year`, Task 2). `ruff check`: `All checks passed!`. `lint-imports`: `Contracts: 1 kept, 0 broken` (verde, confirmado — não é mais achado pré-existente). `manage.py check`: `System check identified no issues (0 silenced)`.
  - [x] 7.2 **Frontend:** `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — **423 passed / 44 files** (baseline 415 + 8 testes novos: 6 em `FuturePage.test.tsx`, 2 em `api.test.tsx`). `typecheck`/`lint`/`build` sem erros. Node 22 via `nvm use 22`; `--no-file-parallelism` necessário (timeouts de paralelismo em `WeeklyPage.test.tsx`/auth/`RecurringPlacementDialog.test.tsx` na primeira rodada, mesma lição 11.2/11.3 — segunda rodada com a flag: 100% verde).
  - [x] 7.3 **Contrato — verificação de ZERO diff:** `manage.py spectacular --file /tmp/schema-check.yaml` + `diff` contra `schema.yaml` commitado → **diff vazio**. `npx openapi-typescript ../schema.yaml -o /tmp/types-check.gen.ts` + `diff` contra `src/api/types.gen.ts` commitado → **diff vazio**. Confirmado: nenhuma mudança de contrato, como esperado (filtro `unplaced_year` não aparece no OpenAPI, igual `active`/`recurrence_group`).
  - [x] 7.4 **Verificação manual contra backend+frontend reais** (Playwright real, branch Neon `e2e`, signup real via `e2e/fixtures.ts`, sem mocks): (a) criado template `annual` ativo sem instância → seção "Anuais pendentes de 2026" apareceu no Future Log com o template. (b) "Definir placement" → dialog mostrou título/`recurrenceText`/calendário de densidade real (`GET /task-density/` 200). (c) Confirmado sem data → `POST .../place/` 201, item sumiu da seção (`GET .../unplaced_year=2026` voltou `[]`), `Task` apareceu em "Este Mês". (d) Segundo template `annual` colocado com data ~2 meses no futuro → sumiu da seção; **achado real** (não achado pré-existente, mas causado por esta story): `usePlaceRecurringTemplateMutation` não invalidava `futureLog`, então o grupo do mês futuro não aparecia sem refresh manual — `WeeklyPage`/`MonthlyPage` nunca alcançavam esse caminho (placement sempre no período corrente já visível), mas o placement do Future Log (Task 4.7) pode cair em qualquer mês futuro. **Corrigido** em `api.ts` (`usePlaceRecurringTemplateMutation` agora invalida `keys.bujo.futureLog()` também) + teste de invalidação atualizado em `api.test.tsx`; reverificado com o mesmo fluxo Playwright → grupo do mês futuro apareceu corretamente com a tarefa. (e) Sem nenhum anual pendente → seção não apareceu, zero estado vazio ruidoso. (f) Não executado manualmente (exigiria simular relógio do sistema em janeiro) — coberto pelo teste automatizado `MonthlyPage.test.tsx` (Task 6.4: `annual` não aparece mais em "Recorrentes" mesmo em janeiro). Zero erros de console em todos os passos (`consoleErrors` array vazio, asserção final do script de verificação).
  - [x] 7.5 **File List por último:** `git status --short` + `git diff --stat` rodados depois da verificação manual (script de verificação Playwright temporário criado em `frontend/e2e/`, executado, e removido antes do diff final — não deixou resíduo); File List abaixo reconciliado contra a saída real.

## Dev Notes

### O que muda e o que NÃO muda

Backend: **um filtro de query param aditivo** numa view já existente (`RecurringTaskTemplateListView`) — zero migração, zero campo de modelo novo, zero endpoint novo, **zero diff de contrato** (diferente da 11.3, que teve diff aditivo real). Frontend: uma seção nova em `FuturePage` (reaproveitando 100% dos componentes/hooks da 11.3 — `RecurringPlacementDialog`, `MonthDensityCalendar`, `usePlaceRecurringTemplateMutation`) + a remoção de ~7 linhas de lógica condicional em `MonthlyPage` (a ramificação "annual só em janeiro"). Nenhuma mudança na máquina de estados, na linhagem de migração, ou no modelo de placement (AD-02/03/08 intactos).

### Por que revogar (e não só adicionar)

A Story 4.5 decidiu (Dev Notes, linha 206 do arquivo da story): *"`annual` não tem 'abertura do ano' definida em nenhum FR/UX... templates `annual` são apresentados junto com os `monthly`, apenas quando o `MonthlyPage` exibe janeiro"*. Essa decisão tinha uma lacuna: se o usuário nunca abrir explicitamente o `MonthlyPage` de janeiro (ex.: catch-up que pula direto pro mês corrente, ou uso do app que não visita janeiro), o anual nunca aparece pra colocação — exatamente o problema que o item #6 do `futureIdeas.md` descreve. Manter as **duas** superfícies (Future Log + `MonthlyPage`-em-janeiro) simultaneamente criaria um bug sutil de dedup: a seção "Recorrentes" do `MonthlyPage` só sabe quais templates já foram colocados **naquele mês específico** (via `placedTemplateIds` calculado a partir de `monthlyLog.tasks`, Story 11.3), não no ano inteiro. Um anual colocado em junho via Future Log continuaria aparecendo como "disponível" na seção Recorrentes de janeiro do ano seguinte (ou do mesmo ano, se o usuário abrir janeiro depois), sem o switch "Mostrar já colocados" sequer fazer sentido nesse contexto (ele é por período, não por ano). A correção mais simples e correta é ter **uma única fonte de verdade** para "anual pendente": a seção do Future Log, com dedup por ano inteiro. Por isso a Task 5 remove a ramificação de janeiro do `MonthlyPage` em vez de deixá-la coexistir.

### AC1 — Como "pendente no ano" é calculado

- Fonte da verdade: `Task.source_template` (mesma FK usada pelo dedup da 11.3) + o container `monthly_log.month_first.year` da instância (annual só coloca em `monthly_log`, nunca tem "log anual" próprio — AD-08 item 5, `place_template` em `services/recurring.py:47-53`).
- **Presença = colocado, inclusive migradas/canceladas** — mesma regra da 11.3 (Dev Notes da 11.3, "Presença = colocado, inclusive migradas/canceladas"). Não há reaparecimento automático se a instância for cancelada; o caminho de recolocação (se necessário) seria manual/futuro, fora de escopo desta story (não pedido pela AC — diferente da 11.3, que tinha um AC explícito de "recolocação sem bloqueio rígido"; aqui a AC2 só fala de reusar o fluxo de placement, não de dedup relaxado).
- **Decisão de arquitetura:** filtro no backend (`unplaced_year` na `RecurringTaskTemplateListView`), não client-side. Diferente do dedup semanal/mensal da 11.3 (que cruza client-side porque a página **já tem** as tarefas do período carregadas via `useWeeklyLogQuery`/`useMonthlyLogQuery`), aqui **não existe** nenhuma query que já traga "todas as tarefas colocadas no ano inteiro" — `useFutureLogQuery` só cobre meses **futuros** (`FutureLogView`, `views.py:296`: `month_first__gt=current_month_first`), não o ano inteiro (meses já passados do ano corrente ficariam de fora se o cálculo fosse client-side a partir do Future Log). Um filtro de backend é a forma correta e barata (evita buscar todas as tarefas do ano no cliente só para cruzar).

### AC2 — Reaproveitamento do fluxo de placement (não redesenhar)

- **Nenhum componente novo.** `RecurringPlacementDialog` (props inalteradas: `open`, `dateFieldType`, `template`, `monthFirst`, `onConfirm`, `onClose`) e `MonthDensityCalendar` (usado internamente pelo dialog, sem seleção ativa — igual à 11.3) são reaproveitados tal como estão.
- **Diferença de uso:** `WeeklyPage`/`MonthlyPage` sempre têm um período (`weekStart`/`monthFirst`) **fixo e conhecido** antes de abrir o dialog. O Future Log não tem — colocar um anual pode ser em qualquer mês do ano. Por isso `dateFieldType="date"` (como `WeeklyPage`, que também não restringe a data a um único dia) e o `monthFirst` real do placement só é decidido em `onConfirm`, a partir da data escolhida (ou do mês corrente, se a data ficar em branco) — ver Task 4.7.
- **`monthFirst` passado ao `RecurringPlacementDialog` é só para o calendário de densidade** (mês inicial exibido, informativo) — não é o mês em que o placement necessariamente vai cair. Isso é uma pequena imprecisão aceita conscientemente (o calendário mostra a densidade do mês corrente mesmo que o usuário depois escolha uma data em outro mês) — mesma classe de trade-off já aceita pela 11.3 no `WeeklyPage` (calendário mostra o mês da segunda-feira da semana, mesmo a data escolhida podendo, em teoria, ser de outro mês).

### AC3 — Sem estado vazio ruidoso

Mesmo molde de `MigrationBanner`/`CatchUpBanner`/`RecurringPlacementSection`: lista vazia (ou `isPending`) → a seção inteira (heading incluído) não é renderizada. Nenhum texto tipo "Nenhum anual pendente." — a ausência de seção já comunica isso (AC3 é explícito: "a seção não aparece").

### Reaproveitamento obrigatório (não reinventar)

- **`RecurringPlacementDialog`/`MonthDensityCalendar`/`usePlaceRecurringTemplateMutation`:** zero alteração de código nesses três — só novos call-sites em `FuturePage`.
- **`useRecurringTemplatesQuery`:** estender (não duplicar) com `unplacedYear` — mesmo hook que `RecurringPlacementSection`/`RecurringTemplateManager` já usam.
- **Padrão "banner vazio = sem DOM":** copiar a checagem de `RecurringPlacementSection.tsx:47`, não inventar uma variante.
- **`currentMonthFirst()`/`currentYear()`:** cálculo client-side de "agora" só pra rótulo/filtro de UI, nunca autoridade de negócio — mesma convenção já em `MonthlyPage.tsx:23-28`. **Duplicação intencional:** `FuturePage` ganha seu próprio `currentYear()`/uso de `currentMonthFirst()`-equivalente local, em vez de extrair um util compartilhado — segue o precedente já estabelecido (o `currentMonthFirst()` de `MonthlyPage` também não foi extraído quando `WeeklyPage` precisou de algo parecido, Story 11.3, `monthFirst = weekStart.slice(0,7)-01`). Duas duplicações pequenas (3-5 linhas) não justificam um novo módulo `dateHelpers.ts` ainda — reavaliar só se uma quarta página precisar do mesmo cálculo.

### Multi-tenant / fail-closed

A queryset base de `RecurringTaskTemplateListView` (`RecurringTaskTemplate.objects.all()`) já é tenant-scoped (fail-closed, AD-12) antes de qualquer filtro. O `.exclude(instances__monthly_log__month_first__year=...)` faz um JOIN direto (não passa pelo manager de `Task`), mas isso é seguro: o JOIN só pode correlacionar `Task`s cujo `source_template` já pertence ao tenant corrente (a FK nunca aponta pra template de outro tenant — `place_template` sempre grava `source_template=template` do mesmo usuário que fez o placement). Ver Task 1.3/2.6 para o teste de regressão que prova isso.

### Contrato de API — sem regeneração esperada

Diferente da 11.3 (que teve diff aditivo real: `sourceTemplate` + `/task-density/`), esta story **não muda nenhum schema OpenAPI**. `RecurringTaskTemplateListView` já não declara `parameters=` no `@extend_schema` (confirmado em `schema.yaml:195-210`) — um filtro novo em `request.query_params` não aparece na doc gerada, igual aos filtros `active`/`recurrence_group` já existentes. Task 7.3 pede uma verificação de **zero diff**, não uma regeneração com diff esperado.

### Previous Story Intelligence (11.3 — done; 4.5 — done)

- **Stack:** Backend Django + DRF + drf-spectacular + uv/pytest/ruff/lint-imports; Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Sem dependência nova nesta story também.
- **Node 22 obrigatório** (`nvm use 22`); `--no-file-parallelism` se houver flakiness de timeout (lição recorrente 11.2/11.3).
- **`jest-axe` só pega violação real contra o componente de verdade** — nunca mockar o componente sob teste de a11y (lição repetida 3.3–11.3).
- **Mocks de barrel `features/bujo`:** `FuturePage.test.tsx` precisa da técnica `importOriginal` (Task 6.1) — o mock atual (sem `importOriginal`) só cobre os 2 hooks que a página já usava; vai quebrar assim que `FuturePage` importar `useRecurringTemplatesQuery`/`usePlaceRecurringTemplateMutation`. Esse é exatamente o "achado recorrente" de mocks de barrel desatualizados (4.3–11.3), só que na direção inversa (mock precisa **crescer em cobertura via importOriginal**, não em lista de exports).
- **Contagem de testes sempre real** (retro Epic 3 §1). **File List por último** (retro Epic 3 §8-2). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.
- **`lint-imports` estava quebrado ao fim da 11.3** (`core` importando `bujo` via `purge_e2e_users`) — **já corrigido** no commit `f160b0b` (pós-11.3, fora desta story). Task 7.1 espera **verde**, não repetir o achado como "pré-existente" — se aparecer quebrado de novo, é uma regressão nova, não a mesma pendência antiga.
- **AR-22 (observabilidade) segue pendente, sem dono** — não bloqueia, mas continua sendo o pior follow-through do projeto (escalar antes do Épico 5, conforme memória do projeto).

### Git Intelligence

- Branch `main`; HEAD em `f160b0b` (`fix(story-11.1): move purge_e2e_users de core/ para bujo/`). Commits do Épico 11 até aqui: `11.1` (cfdc1ae), `11.2` (81ae849), `11.3` (43d1b6e), fix pós-11.3 do lint-imports (f160b0b). Convenção de commit: `feat(story-11.4): <descrição em pt-BR>`.
- `git diff --stat` esperado para esta story: `backend/bujo/views.py` (+filtro), `backend/bujo/tests/test_views.py` (+testes), `frontend/src/features/bujo/api.ts` + `frontend/src/api/keys.ts` (+`unplacedYear`), `frontend/src/pages/planner/FuturePage.tsx` (+seção), `frontend/src/pages/planner/FuturePage.test.tsx` (reescrito), `frontend/src/pages/planner/MonthlyPage.tsx` (-ramificação annual/janeiro), `frontend/src/pages/planner/MonthlyPage.test.tsx` (teste atualizado), `frontend/src/features/bujo/api.test.tsx` (+teste). **Nenhum** arquivo de migração, **nenhum** `schema.yaml`/`types.gen.ts` no diff (contrato inalterado — se aparecerem no diff, algo saiu do escopo).

### Project Structure Notes

- **Backend alterado:** `backend/bujo/views.py` (`RecurringTaskTemplateListView.get` — filtro `unplaced_year`), `backend/bujo/tests/test_views.py` (testes do filtro). Nenhum arquivo em `backend/*/migrations/`. Nenhum serializer novo (reaproveita `RecurringTaskTemplateSerializer` sem mudança).
- **Frontend alterado:** `frontend/src/features/bujo/api.ts` (`RecurringTemplatesParams`, `fetchRecurringTemplates`), `frontend/src/api/keys.ts` (tipo de `recurringTemplates`), `frontend/src/pages/planner/FuturePage.tsx` (seção nova + dialog), `frontend/src/pages/planner/FuturePage.test.tsx` (reescrito para o padrão `QueryClientProvider`+`client` mockado), `frontend/src/pages/planner/MonthlyPage.tsx` (remoção da ramificação annual/janeiro), `frontend/src/pages/planner/MonthlyPage.test.tsx` (teste do cenário janeiro invertido), `frontend/src/features/bujo/api.test.tsx` (teste de `unplacedYear`). **Nenhum componente novo** — só novos call-sites de componentes já existentes (`RecurringPlacementDialog`).
- **Fronteiras (§7.2):** `pages/planner` compõe `features/bujo`; nenhuma nova violação de ESLint boundary / import-linter esperada (mesmo padrão de imports já usado por `WeeklyPage`/`MonthlyPage`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.4 (linhas 819-839 — AC1/AC2/AC3, nota de escopo revogando a 4.5); §Epic 11 (linha 757 — ordem por dependência: "(4) anuais no Future Log *reusa o placement*")]
- [Source: docs/futureIdeas.md:18 (item #6 — "Recorrentes: Na aba Logs Futuros deve conter os Recorrentes anuais que ainda não foram 'placed' nesse ano.")]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-08 (linhas 471-531 — item 5: `recurrence_group` controla apresentação, não placement; annual e monthly compartilham `monthly_log` como container, não existe "log anual")]
- [Source: backend/bujo/models.py:147-153 (`Task.source_template`, `related_name="instances"`); :189 (`RecurringTaskTemplate.recurrence_group` choices)]
- [Source: backend/bujo/views.py:156-166 (`RecurringTaskTemplateListView.get` — filtros `active`/`recurrence_group` a estender com `unplaced_year`); :293-313 (`FutureLogView` — só meses futuros, não serve para "pendente no ano inteiro")]
- [Source: backend/bujo/services/recurring.py:28-53 (`place_template` — annual/monthly sempre em `monthly_log`, `WrongPlacementContainer` se `month_first` ausente)]
- [Source: schema.yaml:195-210 (`/api/bujo/recurring-templates/` GET — sem bloco `parameters`, confirma que o filtro novo não gera diff de contrato)]
- [Source: frontend/src/features/bujo/api.ts:331-354 (`RecurringTemplatesParams`/`fetchRecurringTemplates`/`useRecurringTemplatesQuery` — estender com `unplacedYear`); :407-442 (`usePlaceRecurringTemplateMutation` — invalidação por prefixo já cobre a query nova, sem alteração necessária)]
- [Source: frontend/src/api/keys.ts:22-23 (`keys.bujo.recurringTemplates` — tipo do parâmetro a estender)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementDialog.tsx (reaproveitado sem alteração); RecurringPlacementSection.tsx:47 (molde "banner vazio = sem DOM"), :82 (label "Definir placement")]
- [Source: frontend/src/pages/planner/FuturePage.tsx (página a estender — form + agrupamento por mês já existentes); MonthlyPage.tsx:23-28 (`currentMonthFirst()`, técnica de "agora" client-side), :80-87 (ramificação `annual`/janeiro **a remover**)]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx:45-48,121-136 (uso de `RecurringPlacementDialog` com `dateFieldType="date"` — precedente mais próximo do uso desta story, já que nenhum período fixo existe de antemão)]
- [Source: _bmad-output/implementation-artifacts/4-5-templates-de-tarefas-recorrentes-com-placement-manual.md:41,206 (decisão original "annual só em janeiro", revogada nesta story); Task 12.3 (implementação original da ramificação no `MonthlyPage`)]
- [Source: _bmad-output/implementation-artifacts/11-3-placement-de-recorrentes-dedup-e-calendario-de-densidade.md (dedup "presença inclusive migrada/cancelada"; padrão `importOriginal`+`QueryClientProvider`+`client` mockado em testes de página; Node 22 + `--no-file-parallelism`; `jest-axe` contra componente real)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 (contagem real de testes), §8 (File List por último) — guardrails em `_bmad/custom/bmad-dev-story.toml`]
- [Source: frontend/src/pages/planner/MonthlyPage.test.tsx:283-342 (`RecurringPlacementSection integration` — teste do cenário janeiro a inverter); frontend/src/pages/planner/FuturePage.test.tsx (mock atual do barrel a trocar por `importOriginal`); frontend/src/features/bujo/api.test.tsx:692-722 (`useRecurringTemplatesQuery` — teste de params a estender)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Backend: `uv run pytest --reuse-db` → 330 passed (13m36s, latência normal da branch Neon `e2e`/`dev`).
- Contrato: `manage.py spectacular --file /tmp/schema-check.yaml` termina com exit code 2 (avisos pré-existentes não relacionados a esta story: `accounts/views.py:signup` sem serializer, `ToStatusEnum` duplicado) — mas o arquivo é gerado corretamente e o `diff` contra `schema.yaml` commitado é vazio. Não é uma regressão desta story.
- Frontend: primeira rodada de `npm run test` sem `--no-file-parallelism` teve 7 falhas por timeout (`WeeklyPage.test.tsx`, `LoginPage.test.tsx`, `SignupPage.test.tsx`, `RecurringPlacementDialog.test.tsx`) — mesma flakiness de paralelismo já documentada nas Stories 11.2/11.3, não relacionada às mudanças desta story (nenhum desses arquivos foi tocado). Segunda rodada com `--no-file-parallelism`: 423/423 passed.
- Verificação manual (Task 7.4): usado um script Playwright temporário (`frontend/e2e/zzz-manual-verify-11-4.spec.ts`, reaproveitando `e2e/fixtures.ts` — signup real, sem mocks) contra a branch Neon `e2e` via `npx playwright test`, criado e removido na mesma sessão (não faz parte do File List final). Encontrou e corrigiu um gap de invalidação real (ver Completion Notes).

### Completion Notes List

- Backend: filtro `unplaced_year` aditivo em `RecurringTaskTemplateListView.get` (`backend/bujo/views.py`) — mesmo estilo de parsing manual dos filtros `active`/`recurrence_group` já existentes, sem serializer de query novo. Semântica "colocado no ano Y" via `.exclude(instances__monthly_log__month_first__year=Y)`, inclusive migradas/canceladas (mesma regra de presença da 11.3). 7 testes novos em `test_views.py` cobrindo exclusão, inclusão (sem instância / instância em outro ano), presença com task cancelada, erro 400 para valor inválido, isolamento de tenant e query combinada `active`+`recurrence_group`+`unplaced_year`. Zero migração, zero mudança de contrato OpenAPI (confirmado por diff vazio em `schema.yaml`/`types.gen.ts`).
- Frontend: `unplacedYear` estendido em `RecurringTemplatesParams`/`fetchRecurringTemplates` (`api.ts`) e no tipo de `keys.bujo.recurringTemplates` (`keys.ts`). Nova seção "Anuais pendentes de [ano]" em `FuturePage.tsx`, reaproveitando 100% `RecurringPlacementDialog`/`MonthDensityCalendar`/`usePlaceRecurringTemplateMutation` da Story 11.3 sem alteração de assinatura — só novos call-sites. Regra "sem DOM quando vazio" (AC3) replicada do molde de `RecurringPlacementSection`. `MonthlyPage.tsx`: removida a ramificação "annual só em janeiro" (Story 4.5, revogada por esta story) — `recurrenceGroups` volta a ser sempre `isCurrentMonth ? ['monthly'] : []`.
- **Achado real durante a verificação manual (Task 7.4), corrigido nesta story:** `usePlaceRecurringTemplateMutation` não invalidava `keys.bujo.futureLog()`. Isso era inofensivo antes desta story (`WeeklyPage`/`MonthlyPage` só colocam no período corrente já visível, nunca num mês futuro), mas a Task 4.7 desta story introduz o primeiro caminho de placement que pode legitimamente cair num mês futuro (data escolhida no dialog do Future Log) — sem a invalidação, o grupo novo não aparecia no Future Log até um refresh manual da página. Corrigido com uma linha em `api.ts` + teste de invalidação atualizado em `api.test.tsx`; reverificado end-to-end via Playwright real (branch `e2e`) — o grupo do mês futuro passou a aparecer corretamente após o placement.
- Testes: `FuturePage.test.tsx` reescrito para o padrão `importOriginal` + `QueryClientProvider` real + `client` mockado (mesmo padrão de `MonthlyPage.test.tsx`/`WeeklyPage.test.tsx`, 11.3) — os 7 testes pré-existentes preservados + 6 testes novos para a seção "Anuais pendentes". `MonthlyPage.test.tsx`: teste do cenário janeiro invertido (annual não aparece mais). `api.test.tsx`: teste de `unplacedYear` como query param + teste de invalidação de `futureLog`.
- Backend: 330 passed (baseline 323 + 7). Frontend: 423 passed / 44 files (baseline 415 + 8). `ruff`/`lint-imports`/`manage.py check`/`typecheck`/`lint`/`build` todos verdes. Contrato: diff vazio em `schema.yaml` e `types.gen.ts` (confirmado, zero regeneração necessária).

### File List

- `backend/bujo/views.py` — filtro `unplaced_year` em `RecurringTaskTemplateListView.get`
- `backend/bujo/tests/test_views.py` — 7 testes novos do filtro `unplaced_year`
- `frontend/src/features/bujo/api.ts` — `unplacedYear` em `RecurringTemplatesParams`/`fetchRecurringTemplates`; invalidação de `futureLog` em `usePlaceRecurringTemplateMutation` (achado da verificação manual)
- `frontend/src/api/keys.ts` — tipo de `unplacedYear` em `keys.bujo.recurringTemplates`
- `frontend/src/pages/planner/FuturePage.tsx` — seção "Anuais pendentes de [ano]" + dialog de placement
- `frontend/src/pages/planner/FuturePage.test.tsx` — reescrito (`importOriginal`+`QueryClientProvider`+`client` mockado) + 6 testes novos
- `frontend/src/pages/planner/MonthlyPage.tsx` — remoção da ramificação "annual só em janeiro" (revogação da Story 4.5)
- `frontend/src/pages/planner/MonthlyPage.test.tsx` — teste do cenário janeiro invertido
- `frontend/src/features/bujo/api.test.tsx` — teste de `unplacedYear` + teste de invalidação de `futureLog`
- `frontend/e2e/future-log-annual.spec.ts` — e2e permanente (AC1/AC2/AC3) cobrindo Future Log real: seção de anuais pendentes, placement com e sem data, invalidação de `futureLog`, sem estado vazio ruidoso. Ausente do File List original (achado do code review); corrigido nesta revisão junto com um bug de asserção não escopada (ver Senior Developer Review abaixo)

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-14 | 0.1 | Implementação da Story 11.4: filtro `unplaced_year` aditivo em `RecurringTaskTemplateListView` (AC1); seção "Anuais pendentes de [ano]" no `FuturePage` reusando 100% o fluxo de placement da 11.3 (AC2); revogação da ramificação "annual só em janeiro" no `MonthlyPage` (AC3/nota de escopo). Achado real na verificação manual: `usePlaceRecurringTemplateMutation` não invalidava `futureLog`, corrigido nesta mesma story. Backend 330 passed, Frontend 423 passed, contrato sem diff. Status → review. | Amelia (dev-story) |
| 2026-07-15 | 0.2 | Code review adversarial (story-automator-review): 1 issue MEDIUM confirmado e corrigido (`frontend/e2e/future-log-annual.spec.ts` ausente do File List **e** com asserção não escopada que fazia o teste falhar de verdade contra backend+frontend reais — corrigido escopando as asserções ao container da seção). Zero issues CRITICAL/HIGH. Status → done. | story-automator-review |

## Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (via story-automator-review) on 2026-07-15

### Outcome: **Approve** (após correção)

### Verificação independente (não apenas leitura das claims)

- **Git vs File List:** `git status`/`git diff --name-only` batido contra o File List — **1 discrepância encontrada**: `frontend/e2e/future-log-annual.spec.ts` estava `??` (untracked) no git mas ausente do File List do Dev Agent Record, apesar de ser um e2e permanente e intencional (mesmo padrão de `recurring-templates.spec.ts` na 11.3, confirmado por `git log -- frontend/e2e/`). MEDIUM — corrigido adicionando a entrada ao File List.
- **Backend:** os 7 testes novos do filtro `unplaced_year` reexecutados isoladamente (`pytest -k unplaced_year`) → **7 passed**, batendo com a claim. `ruff check .` e `lint-imports` limpos (`Contracts: 1 kept, 0 broken` — confirma que o fix pós-11.3 do lint-imports segue de pé, sem regressão).
- **Frontend:** `FuturePage.test.tsx` + `MonthlyPage.test.tsx` + `api.test.tsx` reexecutados isoladamente → **67 passed**. Suíte completa (`--no-file-parallelism`) → **422/423 passed**, 1 falha em `RecurringTemplateManager.test.tsx` (timeout de `jest-axe`, arquivo **não tocado** por esta story) — reexecutado isoladamente e **passou** (17/17), confirmando flakiness pré-existente de paralelismo (mesma classe de achado já documentada nas Stories 11.2/11.3), não uma regressão desta story. `typecheck`/`lint` limpos nos arquivos tocados.
- **Contrato:** `manage.py spectacular` regenerado do zero e comparado via `diff` contra `schema.yaml` commitado → **zero diff**, confirmando a claim de "sem mudança de contrato".
- **AC1:** confirmado por leitura + teste: `unplaced_year` exclui via `.exclude(instances__monthly_log__month_first__year=Y)`, semântica "presença inclusive migrada/cancelada" coberta por teste dedicado, isolamento de tenant coberto.
- **AC2:** `RecurringPlacementDialog`/`MonthDensityCalendar`/`usePlaceRecurringTemplateMutation` reaproveitados sem alteração de assinatura — confirmado por diff (só novos call-sites em `FuturePage.tsx`). Achado real da invalidação de `futureLog` confirmado necessário e presente em `api.ts`.
- **AC3:** padrão "banner vazio = sem DOM" replicado corretamente de `RecurringPlacementSection.tsx:47` — `pendingAnnualTemplates.isPending || length === 0` → não renderiza.
- **Verificação end-to-end real (achado + correção desta revisão):** rodei `frontend/e2e/future-log-annual.spec.ts` contra o backend+frontend reais (branch Neon `e2e`, `npx playwright test`) — **falhou na primeira execução**: `expect(page.getByText('Revisão anual', { exact: true })).toHaveCount(0)` recebeu `1` porque, após a invalidação de `futureLog` (achado da própria story), o mesmo título passa a aparecer também no grupo do mês futuro do Future Log — a asserção não estava escopada ao container da seção "Anuais pendentes", então pegava o texto errado. **Não é um bug de produto** (a API já retornava a lista correta, encolhida, confirmado pelos tamanhos de resposta no log de rede) — é um bug de teste (seletor amplo demais). Corrigido escopando todas as asserções de "aparece"/"some" da seção ao container da própria seção (`pendingAnnualSection = page.getByText(...).locator('xpath=..')`); reexecutado → **1 passed**.

### Findings

- **[MEDIUM][fixed]** `frontend/e2e/future-log-annual.spec.ts`: (a) ausente do File List apesar de ser um e2e permanente pretendido; (b) a asserção de "item some da seção" (linha ~100 original) usava `page.getByText(...)` sem escopo, causando falha real do teste contra a stack real assim que a invalidação de `futureLog` (achado da própria story) faz o mesmo título aparecer em outro lugar da página. Ambos corrigidos nesta revisão: File List atualizado; asserções escopadas ao container da seção via `pendingAnnualSection`. Reverificado com `npx playwright test e2e/future-log-annual.spec.ts` → passou.

Nenhum outro issue CRITICAL, HIGH ou MEDIUM sobreviveu à verificação.

### Observação para follow-up (não bloqueia)

- `RecurringTemplateManager.test.tsx` (`jest-axe`) segue com flakiness de timeout sob paralelismo/carga — mesma classe de achado recorrente das Stories 11.2/11.3, não introduzida por esta story, sem ação necessária além de continuar usando `--no-file-parallelism`.
- AR-22 (observabilidade) segue pendente, sem dono, conforme memória do projeto — escalar antes do Épico 5.
