---
baseline_commit: a6ebcad8ee6e6d2c45b7e4a649089604245c8700
---

# Story 4.6: Fechamento de ciclos e Arquivo

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero que semanas e meses fechados fiquem consultáveis no arquivo com o estado final de cada tarefa,
Para que eu tenha o histórico auditável que é o valor central do BuJo (FR-1.10, FR-1.13).

## Acceptance Criteria

1. **Fechamento é computado na leitura — nunca armazenado, nunca automático**
   - **Dado que** um ciclo (semana/mês) em que todas as tarefas têm disposição (concluída, cancelada, adiada ou migrada — FR-1.10),
   - **Quando** a condição de fechamento é avaliada,
   - **Então** o ciclo é marcado "Fechado"/"Fechada" (texto, sem ícone celebratório) considerando a subárvore completa de cada tarefa — um pai com filho `pending`/`started` não fecha,
   - **E** o ciclo fechado aparece no Arquivo (não se move fisicamente — o mesmo `WeeklyLog`/`MonthlyLog` continua acessível pela navegação normal, mas passa a ser listado no Arquivo também).

2. **Superfície Arquivo — lista e consulta de ciclos fechados**
   - **Dado que** a superfície Arquivo,
   - **Quando** Hugo a acessa,
   - **Então** lista semanas e meses fechados, consultáveis com o estado final de cada tarefa e o que foi feito com ela (incl. linhagem de migração — `migration_count`),
   - **E** o estado vazio exibe "Nenhuma semana ou mês fechado ainda."

## Tasks / Subtasks

> **Ordem de execução:** backend (service → serializers → views → contrato) antes do frontend (data layer → páginas), igual às Stories 4.1–4.5. **Sem migration nesta story** — fechamento é 100% computado na leitura (nenhum campo novo em `WeeklyLog`/`MonthlyLog`/`Task`, nenhuma tabela nova), consistente com a filosofia "sem automação" da AD-04 item 5 generalizada para fechamento de ciclo. Leia a Dev Note "Por que não existe endpoint de detalhe dedicado do Arquivo" antes de desenhar o frontend — a decisão de reusar `WeeklyPage`/`MonthlyPage` via rota parametrizada é o ponto mais fácil de reinventar sem essa nota.

- [x] **Task 1: `services/archive.py` (novo arquivo) — fechamento computado + listagem** (AC: #1, #2)
  - [x] 1.1 Criar `backend/bujo/services/archive.py`:
    ```python
    """Fechamento de ciclos e Arquivo (FR-1.10, FR-1.13).

    Fechamento é sempre COMPUTADO na leitura, nunca armazenado nem calculado
    por job/cron — mesma filosofia de "sem automação" da AD-04 item 5,
    generalizada aqui de migração para fechamento de ciclo.
    """

    from django.db.models import Count, Q

    from bujo.models import MonthlyLog, Task, WeeklyLog

    UNDISPOSED = (Task.Status.PENDING, Task.Status.STARTED)


    def is_container_closed(log) -> bool:
        """`log`: instância de `WeeklyLog` ou `MonthlyLog` (ambas expõem
        `.tasks`, related_name da FK em `Task`). Fechado = tem >=1 tarefa E
        nenhuma tarefa da subárvore completa (raiz OU subtarefa — a query não
        filtra por `parent_task`) está `pending`/`started` (FR-1.10: um pai
        com filho pendente não fecha)."""
        tasks = log.tasks.all()
        return tasks.exists() and not tasks.filter(status__in=UNDISPOSED).exists()


    def list_closed_cycles(*, user):
        """Semanas e meses fechados do tenant (auto-escopado pelo manager,
        `user` mantido por consistência posicional com `get_or_create_*` em
        `services/logs.py`), mais recentes primeiro. `total_tasks=0` (log
        nunca populado) NUNCA conta como fechado — só ciclos com conteúdo
        disposto entram no Arquivo."""
        closed_weekly = WeeklyLog.objects.annotate(
            total=Count("tasks"),
            undisposed=Count("tasks", filter=Q(tasks__status__in=UNDISPOSED)),
        ).filter(total__gt=0, undisposed=0)
        closed_monthly = MonthlyLog.objects.annotate(
            total=Count("tasks"),
            undisposed=Count("tasks", filter=Q(tasks__status__in=UNDISPOSED)),
        ).filter(total__gt=0, undisposed=0)

        entries = [
            {"type": "weekly", "week_start": log.week_start, "month_first": None}
            for log in closed_weekly
        ] + [
            {"type": "monthly", "week_start": None, "month_first": log.month_first}
            for log in closed_monthly
        ]
        entries.sort(key=lambda e: e["week_start"] or e["month_first"], reverse=True)
        return entries
    ```
    Padrão de `Count(..., filter=Q(...))` sobre a mesma relação já usado em `FutureLogView` (`views.py`) — conditional aggregation via `CASE WHEN`, um único join, sem risco de fan-out (esse risco só existe ao agregar *relações diferentes* juntas, não é o caso aqui).

- [x] **Task 2: Serializers — `closed` no Weekly/Monthly, linhagem no Task, `ArchiveEntrySerializer`** (AC: #1, #2)
  - [x] 2.1 Em `backend/bujo/serializers.py`, `TaskSerializer.Meta.fields`: adicionar `"migration_count"` e `"migrated_to_task"` à lista existente (depois de `"subtasks"`). `ModelSerializer` gera `migrated_to_task` como `PrimaryKeyRelatedField` automático (mostra o `id` da tarefa de destino) — sem `SerializerMethodField`, sem configuração extra. **Nenhum outro código muda**: `TaskSerializer` é usado só para leitura em todo o codebase (nenhum `.is_valid()`/`.save()` chamado nele, confirmado por grep) — os 2 campos novos são estritamente aditivos ao contrato, aparecem em toda superfície que já usa `TaskSerializer` (Daily/Weekly/Monthly/Future Log, filas de revisão), mas só o Arquivo (Task 9) efetivamente os renderiza. Diferente da decisão da Story 4.5 de **não** adicionar `source_template` a este serializer (lá, nenhuma AC pedia exibir linhagem de recorrência) — aqui a AC #2 desta story pede explicitamente "o que foi feito com ela (incl. linhagem de migração)", então a adição é justificada, não especulativa.
  - [x] 2.2 Em `WeeklyLogSerializer` e `MonthlyLogSerializer`, adicionar `closed = serializers.BooleanField()`.
  - [x] 2.3 Adicionar `ArchiveEntrySerializer(serializers.Serializer)`:
    ```python
    class ArchiveEntrySerializer(serializers.Serializer):
        type = serializers.ChoiceField(choices=["weekly", "monthly"])
        week_start = serializers.DateField(required=False, allow_null=True)
        month_first = serializers.DateField(required=False, allow_null=True)
    ```

- [x] **Task 3: `WeeklyLogView.get`/`MonthlyLogView.get` — popular `closed`** (AC: #1)
  - [x] 3.1 Em `backend/bujo/views.py`, importar `is_container_closed` de `bujo.services.archive`.
  - [x] 3.2 `WeeklyLogView.get`: adicionar `"closed": is_container_closed(weekly_log)` ao dict `data` (mesma variável `weekly_log` já resolvida por `get_or_create_weekly_log`).
  - [x] 3.3 `MonthlyLogView.get`: adicionar `"closed": is_container_closed(monthly_log)` ao dict `data` (mesma variável `monthly_log`). **`MonthlyLogView.post` não muda** (não usa `MonthlyLogSerializer`, retorna `TaskSerializer`).

- [x] **Task 4: `ArchiveView` + URL** (AC: #2)
  - [x] 4.1 Em `backend/bujo/views.py`, adicionar:
    ```python
    class ArchiveView(APIView):
        @extend_schema(responses=ArchiveEntrySerializer(many=True))
        def get(self, request):
            entries = list_closed_cycles(user=request.user)
            return Response(ArchiveEntrySerializer(entries, many=True).data)
    ```
    Importar `list_closed_cycles` de `bujo.services.archive` e `ArchiveEntrySerializer` de `bujo.serializers`.
  - [x] 4.2 Em `backend/bujo/urls.py`: adicionar `path("archive/", ArchiveView.as_view(), name="bujo-archive")` (preservando as 17 rotas existentes — 18 no total após esta story) e importar `ArchiveView`.

- [x] **Task 5: Testes de backend** (AC: #1, #2)
  - [x] 5.1 `test_services.py` (seção nova `# --- archive.py (AC #1, #2) ---`):
    - `is_container_closed`: log sem tarefas → `False` (vazio nunca é "fechado", evita falso-positivo de um log só materializado por navegação); log com só tarefas `pending` → `False`; log com todas `completed`/`cancelled`/`migrated`/`postponed` → `True`; log com tarefa pai `completed` e subtarefa `pending` → `False` (prova direta da subárvore completa, FR-1.10) — usar `TaskFactory(parent_task=...)`.
    - `list_closed_cycles`: cria 2 `WeeklyLog`/2 `MonthlyLog` do usuário, sendo 1 de cada fechado e 1 de cada aberto (com tarefa `pending`) mais 1 `WeeklyLog` vazio (sem tarefas) — resultado contém só os 2 fechados, ordenados por data desc (`type`/`week_start`/`month_first` conferidos); escopo por tenant (ciclo fechado de `other_user` não aparece).
  - [x] 5.2 `test_views.py` (seção nova `# --- ArchiveView (AC #2) ---`):
    - `GET /api/bujo/archive/` vazio → `200` com `[]`.
    - Com 1 semana e 1 mês fechados → `200` com 2 entradas, `type`/`weekStart`/`monthFirst` corretos (camelCase na resposta).
    - Escopo por tenant (ciclo fechado de `other_user` não aparece).
  - [x] 5.3 `test_views.py` (estender seções `# --- WeeklyLogView ---`/`# --- MonthlyLogView ---` existentes): `response.data["closed"]` é `False` para um log recém-criado com tarefa `pending`, e `True` depois de transicionar todas as tarefas para disposição (`transition_task`/`migrate_task` conforme o caso).
  - [x] 5.4 `test_serializers.py`: `TaskSerializer` inclui `migrationCount`/`migratedToTask` na saída (verificar nomes exatos gerados pelo middleware camelCase); `migratedToTask` é `null` quando a tarefa nunca migrou e é o `id` da tarefa de destino depois de `migrate_task`.

- [x] **Task 6: Regenerar o contrato de API** (AC: #1, #2)
  - [x] 6.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 6.2 `cd frontend && npm run generate-types`
  - [x] 6.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" passa sem diff residual.
  - [x] 6.4 Conferir no diff do `schema.yaml`: `Task` ganha `migrationCount`/`migratedToTask`; `WeeklyLog`/`MonthlyLog` ganham `closed`; schema novo `ArchiveEntry` + path `/api/bujo/archive/`; blocos `security` dos endpoints existentes intactos (guardrail retro Epic 3 §3).

- [x] **Task 7: Camada de dados do frontend** (AC: #1, #2)
  - [x] 7.1 `frontend/src/api/keys.ts` (estender seção `bujo`): `archive: () => ['bujo', 'archive', 'list'] as const,`.
  - [x] 7.2 `frontend/src/features/bujo/types.ts` (estender): `export type ArchiveEntry = components['schemas']['ArchiveEntry']`. `Task`/`WeeklyLog`/`MonthlyLog` já reexportam via `components['schemas'][...]` — os campos novos (`migrationCount`/`migratedToTask`/`closed`) chegam automaticamente depois da Task 6, sem editar essas linhas.
  - [x] 7.3 `frontend/src/features/bujo/api.ts` (estender):
    ```ts
    async function fetchArchive(): Promise<ArchiveEntry[]> {
      const response = await client.get<ArchiveEntry[]>('/api/bujo/archive/')
      return response.data
    }

    export function useArchiveQuery() {
      return useQuery({
        queryKey: keys.bujo.archive(),
        queryFn: fetchArchive,
      })
    }
    ```
    Adicionar `ArchiveEntry` ao bloco de `import type { ... } from './types'` no topo do arquivo.
  - [x] 7.4 Exportar `useArchiveQuery` (barrel `export { ... } from './api'`) e o tipo `ArchiveEntry` em `frontend/src/features/bujo/index.ts`.
  - [x] 7.5 `frontend/src/features/bujo/api.test.tsx` (estender): `useArchiveQuery` bate em `GET /api/bujo/archive/` e retorna os dados.

- [x] **Task 8: `WeeklyPage`/`MonthlyPage` — indicador "Fechada"/"Fechado" + modo Arquivo via rota parametrizada** (AC: #1, #2)
  - [x] 8.1 Em `frontend/src/pages/planner/WeeklyPage.tsx`:
    - Importar `useParams` de `react-router-dom`.
    - `const { weekStart: routeWeekStart } = useParams<{ weekStart: string }>()`.
    - `const isArchiveView = Boolean(routeWeekStart)`.
    - Trocar `useWeeklyLogQuery()` por `useWeeklyLogQuery(routeWeekStart)` (a assinatura já aceita `weekStart?: string` desde a Story 4.1 — nenhuma mudança na função, só no argumento passado).
    - Desestruturar `closed` também de `weeklyLog.data`.
    - `aria-label` do `<Box component="main">`: `isArchiveView ? \`Arquivo — Semana de ${weekStart}\` : 'Esta Semana'`.
    - Logo no início do conteúdo (antes do bloco `isMobile ? ... : ...`), renderizar condicionalmente: `{closed && <Typography variant="heading" sx={{ px: 1, mb: 1 }}>Fechada</Typography>}` — texto puro, sem ícone (UX: "Cabeçalho da semana exibe indicador 'Fechada' (texto, sem ícone celebratório)"). Aparece **independente** de `isArchiveView`: a semana corrente também pode fechar antes do fim do período se todas as tarefas forem dispostas cedo (FR-1.10 não tem exceção de data).
    - Envolver `<RecurringPlacementSection ... />` e `<RecurringPlacementDialog ... />` em `{!isArchiveView && (...)}") — placement de recorrentes não faz sentido ao navegar para uma semana fechada/passada via Arquivo.
  - [x] 8.2 Em `frontend/src/pages/planner/MonthlyPage.tsx`: mesmo padrão —
    - `const { monthFirst: routeMonthFirst } = useParams<{ monthFirst: string }>()`, `isArchiveView = Boolean(routeMonthFirst)`.
    - `useMonthlyLogQuery(routeMonthFirst)` (assinatura já aceita `monthFirst?: string` desde a Story 4.1).
    - Desestruturar `closed`.
    - `aria-label`: `isArchiveView ? \`Arquivo — Mês de ${monthFirst}\` : 'Este Mês'`.
    - `{closed && <Typography variant="heading" sx={{ px: 1, mb: 1 }}>Fechado</Typography>}` antes do bloco de renderização de tarefas.
    - Envolver o `<Box component="form" aria-label="Adicionar tarefa ao mês">` **e** `<RecurringPlacementSection .../>`/`<RecurringPlacementDialog .../>` em `{!isArchiveView && (...)}`.
    - **Sem mudança** na lógica `isCurrentMonth`/`recurrenceGroups`/`withoutDateTitle` — para qualquer mês fechado navegado via Arquivo, `isCurrentMonth` já é `false` naturalmente (mês fechado no passado), então a seção `withoutDate` já renderiza no branch read-only existente (`withoutDate.map((task) => isCurrentMonth ? <TextField .../> : <TaskRow .../>)`) sem alteração nenhuma nessa função.

- [x] **Task 9: `ArchivePage` — lista de ciclos fechados** (AC: #2)
  - [x] 9.1 Novo arquivo `frontend/src/pages/archive/ArchivePage.tsx`:
    ```tsx
    import { Link as RouterLink } from 'react-router-dom'
    import { Box, List, ListItemButton, ListItemText, Typography } from '@mui/material'
    import { useArchiveQuery } from '../../features/bujo'
    import type { ArchiveEntry } from '../../features/bujo'
    import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'

    function formatEntryLabel(entry: ArchiveEntry): string {
      if (entry.type === 'weekly' && entry.weekStart) {
        return `Semana de ${entry.weekStart}`
      }
      if (entry.type === 'monthly' && entry.monthFirst) {
        const month = Number(entry.monthFirst.slice(5, 7))
        const year = entry.monthFirst.slice(0, 4)
        return `${capitalize(MONTH_NAMES_PT[month - 1])} ${year}`
      }
      return ''
    }

    function entryPath(entry: ArchiveEntry): string {
      return entry.type === 'weekly'
        ? `/archive/weekly/${entry.weekStart}`
        : `/archive/monthly/${entry.monthFirst}`
    }

    export function ArchivePage() {
      const archive = useArchiveQuery()

      if (archive.isPending) return null
      if (!archive.data) return null

      return (
        <Box component="main" aria-label="Arquivo" sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Arquivo
          </Typography>
          {archive.data.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma semana ou mês fechado ainda.
            </Typography>
          ) : (
            <List disablePadding>
              {archive.data.map((entry) => (
                <ListItemButton
                  key={`${entry.type}-${entry.weekStart ?? entry.monthFirst}`}
                  component={RouterLink}
                  to={entryPath(entry)}
                >
                  <ListItemText
                    primary={formatEntryLabel(entry)}
                    secondary={entry.type === 'weekly' ? 'Semana' : 'Mês'}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      )
    }
    ```
    Reaproveita `capitalize`/`MONTH_NAMES_PT` de `features/bujo/monthNames.ts` (mesmo módulo já usado por `MonthlyPage` — não duplicar o array de nomes de mês como `FuturePage.tsx` faz com seu próprio `MONTH_NAMES` local).

- [x] **Task 10: Rotas** (AC: #2)
  - [x] 10.1 Em `frontend/src/app/router.tsx`: importar `ArchivePage` de `'../pages/archive/ArchivePage'`. Trocar `{ path: 'archive', element: <PlaceholderPage title="Arquivo" />, ... }` por `{ path: 'archive', element: <ArchivePage />, handle: { title: 'Arquivo' } }` (mesmo padrão da troca de `settings` na Story 4.5).
  - [x] 10.2 Adicionar duas rotas novas (`WeeklyPage`/`MonthlyPage` já importados):
    ```tsx
    {
      path: 'archive/weekly/:weekStart',
      element: <WeeklyPage />,
      handle: { title: 'Arquivo — Semana' },
    },
    {
      path: 'archive/monthly/:monthFirst',
      element: <MonthlyPage />,
      handle: { title: 'Arquivo — Mês' },
    },
    ```
    Posicionar antes de `{ path: '*', ... }` (igual às demais rotas). Nomes de parâmetro (`:weekStart`/`:monthFirst`) devem bater exatamente com os usados em `useParams` na Task 8.

- [x] **Task 11: Testes de frontend** (AC: #1, #2)
  - [x] 11.1 **Guardrail crítico — `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` não têm `MemoryRouter` hoje.** Os helpers `renderWeeklyPage()`/`renderMonthlyPage()` atuais renderizam `<WeeklyPage />`/`<MonthlyPage />` direto, sem nenhum Router na árvore — funciona hoje porque nenhum dos dois componentes chama `useParams`/`useNavigate`/etc. Depois da Task 8, `useParams` **exige** um Router ancestral (React Router lança erro em runtime sem ele) — envolver os dois helpers com `<MemoryRouter>` (`react-router-dom`, já dependência do projeto) **antes** de rodar qualquer teste existente, senão os ~15 testes já passando nesses dois arquivos quebram. Ver Dev Notes "Guardrail: `useParams` exige Router nos testes existentes".
  - [x] 11.2 `WeeklyPage.test.tsx` (estender): mock de `useWeeklyLogQuery` retornando `closed: true` → texto "Fechada" visível; `closed: false` → texto ausente; renderizar via `MemoryRouter` com `initialEntries: ['/archive/weekly/2026-07-13']` + rota `path="archive/weekly/:weekStart"` (usar `<Routes><Route path="archive/weekly/:weekStart" element={<WeeklyPage />} /></Routes>` dentro do `MemoryRouter`, ou `createMemoryRouter`/`RouterProvider` como em `router.test.tsx`) → `useWeeklyLogQuery` é chamado com `'2026-07-13'` (via `mockUseWeeklyLogQuery.mock.calls`) e `RecurringPlacementSection`/dialog não renderizam (nenhuma chamada a `client.get` de templates — ou o texto do form de placement ausente).
  - [x] 11.3 `MonthlyPage.test.tsx` (estender): mesmo padrão — `closed: true` → "Fechado" visível; rota `archive/monthly/:monthFirst` → `useMonthlyLogQuery` chamado com o `monthFirst` da URL; form "Adicionar tarefa ao mês" e `RecurringPlacementSection` ausentes nesse modo.
  - [x] 11.4 Novo `frontend/src/pages/archive/ArchivePage.test.tsx` (mesmo molde de `SettingsPage.test.tsx`/`FuturePage`-style, mock de `useArchiveQuery` via `vi.mock('../../features/bujo', ...)`): estado vazio mostra "Nenhuma semana ou mês fechado ainda."; lista renderiza rótulo de semana (`Semana de 2026-07-13`) e de mês (`Julho 2026`) formatados corretamente a partir de entradas mockadas; clicar num item navega para a rota certa (`MemoryRouter` + `screen.getByRole('link'...)` ou `ListItemButton` como link — conferir `href`/navegação via `userEvent.click` + `createMemoryRouter`); `jest-axe` no componente real.
  - [x] 11.5 **Mocks de barrel** (achado recorrente 4.3/4.4/4.5): `RouteAnnouncer.test.tsx`/`router.test.tsx` mockam `features/bujo` inteiro — como nenhum teste desses dois arquivos navega para `/archive`, `/planner/week` ou `/planner/month` hoje (só `/today`, `/habits`, `/signup`, `/login`), **não é necessário** adicionar `useArchiveQuery` a esses mocks — confirmar isso lendo os testes antes de assumir que é preciso (evita trabalho especulativo).

- [x] **Task 12: Verificação final** (AC: #1, #2)
  - [x] 12.1 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — colar a contagem **real** observada (guardrail retro Epic 3 §1). **305 passed** (0 failed), `ruff check`: "All checks passed!", `lint-imports`: "Contracts: 1 kept, 0 broken.", `manage.py check`: "System check identified no issues (0 silenced)."
  - [x] 12.2 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — idem, colar a contagem real. `typecheck`: 0 erros. `lint`: 0 erros. `build`: sucesso (chunk-size warning pré-existente, não é erro). `test` (`--no-file-parallelism`, ver Completion Notes sobre flakiness de concorrência): **376 passed** (0 failed) em 42 arquivos.
  - [x] 12.3 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado): verificado via spec Playwright temporária (descartada ao final, mesmo padrão da 4.3/4.5) contra servidores reais (`playwright.config.ts` webServer) — usuário novo → Arquivo mostra "Nenhuma semana ou mês fechado ainda."; seed de 1 semana passada (2 tarefas: completed/cancelled) e 1 mês passado (1 tarefa completed) direto no banco de dev via `manage.py shell` (mesma técnica de `seedReviewScenario.ts`) → Arquivo lista as 2 entradas; clicar na semana → "Fechada" visível, tarefas no estado final, sem botão "Definir placement"; clicar no mês → "Fechado" visível, tarefa final, sem form "Adicionar tarefa ao mês" nem "Definir placement". Zero erros de console (`page.on('console')` filtrado por `type() === 'error'`, array vazio confirmado).
  - [x] 12.4 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual, reconciliado contra o File List documentado.

## Dev Notes

### Fechamento é sempre computado — nenhuma migration nesta story

Diferente de todas as stories anteriores do Épico 4, a 4.6 **não adiciona nenhum campo de banco**. "Fechado" não é um `status`/`is_closed` persistido em `WeeklyLog`/`MonthlyLog` — é uma condição avaliada a cada leitura (`is_container_closed`, Task 1), a mesma filosofia da AD-04 item 5 ("sem automação de migração... a reconciliação é ato deliberado do usuário") generalizada aqui: se fosse armazenado, precisaria de um job para mantê-lo sincronizado toda vez que uma tarefa mudasse de status — exatamente o tipo de automação que a arquitetura rejeita conscientemente. O custo é uma query extra por leitura de `WeeklyLogView`/`MonthlyLogView` (aceitável — mesmo padrão de não-otimização prematura já usado em `WeeklyReviewQueueView`/`MonthlyReviewQueueView`/`CatchUpQueueView`) e uma query agregada por leitura do Arquivo (Task 1.1, `Count` condicional — volume esperado é dezenas de ciclos por usuário no MVP, sem necessidade de paginação).

### Por que não existe endpoint de detalhe dedicado do Arquivo

A tentação óbvia é criar `GET /api/bujo/archive/weekly/<week_start>/` e `.../monthly/<month_first>/` como endpoints novos. **Decisão desta story: não criar.** `WeeklyLogView`/`MonthlyLogView` (`GET /api/bujo/logs/weekly/?week_start=X` e `.../logs/monthly/?month_first=X`) já aceitam **qualquer** data desde a Story 4.1 — inclusive datas passadas — e já retornam a árvore completa de tarefas com estado final. A única coisa que faltava para servir de "detalhe do Arquivo" era o campo `closed` (Task 3) e a linhagem de migração no `TaskSerializer` (Task 2.1), ambos aditivos. Reaproveitar esses dois endpoints (via `useWeeklyLogQuery(weekStart)`/`useMonthlyLogQuery(monthFirst)`, já parametrizados desde 4.1) elimina a necessidade de duplicar a lógica de agrupamento por dia/tarefa em endpoints novos — o Arquivo só precisa saber **quais** datas estão fechadas (`ArchiveView`, Task 4) e navegar para a página que já sabe renderizá-las.

Consequência no frontend: `WeeklyPage`/`MonthlyPage` passam a ter um segundo modo de entrada — via rota parametrizada (`/archive/weekly/:weekStart`, `/archive/monthly/:monthFirst`) além da rota fixa atual (`/planner/week`, `/planner/month`). Isso é uma reutilização deliberada, não um acidente: `TaskRow` já é renderizado **sem** `onTransition`/`onOpenDetail`/`onReorder` nessas duas páginas desde a Story 4.1 (comentário no próprio componente: "Weekly/Monthly Log (Story 4.1) reusam `TaskRow` somente-leitura") — ou seja, a interação com tarefa já era zero nessas páginas; a única diferença funcional entre "ver a semana corrente" e "ver uma semana fechada do Arquivo" é (a) qual data buscar e (b) esconder os formulários de criação/placement de recorrentes, que não fazem sentido para um ciclo fechado. Se essa reutilização se revelar confusa na prática (ex.: crescer divergência entre os dois modos), separar em componentes dedicados é um refactor razoável para uma story futura — não escopo desta.

### Guardrail: `useParams` exige Router nos testes existentes

`WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` **hoje** renderizam o componente sem nenhum `<MemoryRouter>`/`<RouterProvider>` na árvore (confirmado por leitura direta dos dois arquivos) — funciona porque nenhum dos dois usa nada de `react-router-dom` atualmente. A Task 8 introduz `useParams`, que **lança em runtime** sem um Router ancestral. Task 11.1 é bloqueante: sem envolver os helpers `renderWeeklyPage`/`renderMonthlyPage` num `MemoryRouter`, todos os testes já existentes desses dois arquivos (~15 no total, ambos com casos AC3 e AC12 marcados como passing na Story 4.5) quebram imediatamente, não só os novos casos de Arquivo.

### Duas superfícies, um único `closed` — não confundir com `isArchiveView`

`closed` (vem da API, reflete FR-1.10) e `isArchiveView` (deriva só da presença do param de rota) são conceitos independentes: uma semana **corrente** pode estar `closed=true` se Hugo dispuser todas as tarefas antes do fim da semana (FR-1.10 não tem exceção temporal — ver EXPERIENCE.md linha 369, "Semana fechada" é um estado do Weekly Log **normal**, não exclusivo do Arquivo). Por isso o indicador textual "Fechada"/"Fechado" (Task 8.1/8.2) é condicionado só a `closed`, enquanto esconder o formulário/placement de recorrentes (Task 8.1/8.2) é condicionado só a `isArchiveView`. Não colapsar os dois num único flag.

### Reaproveitamento obrigatório — não reinventar

`is_container_closed`/`list_closed_cycles` são as únicas peças novas de lógica de negócio desta story — tudo o resto é composição do que já existe: `get_or_create_weekly_log`/`get_or_create_monthly_log` (`services/logs.py`) continuam intocados; `WeeklyLogView`/`MonthlyLogView` ganham 1 campo cada, sem mudar a query principal; `TaskSerializer` ganha 2 campos aditivos; nenhuma nova exceção de domínio é necessária (não há escrita nesta story — Arquivo é 100% leitura); `useWeeklyLogQuery`/`useMonthlyLogQuery` (frontend) já aceitam parâmetro de data desde a Story 4.1, reaproveitados sem alteração de assinatura.

### Previous Story Intelligence (4.5 — done)

- Stack: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59; React Router 6.30. Sem dependência nova nesta story.
- `TaskSerializer` é o único serializer de tarefa em todo o codebase, usado recursivamente (`subtasks`) e por toda superfície de log — mudanças nele são globais por definição (ver Dev Notes acima sobre por que isso é aceitável aqui, diferente da decisão inversa da 4.5 para `source_template`).
- Mocks do barrel `features/bujo` usados em `RouteAnnouncer.test.tsx`/`router.test.tsx` só importam o que os componentes efetivamente renderizados nesses testes usam (`/today`, `/habits`, `/signup`, `/login`) — como nenhum navega para `/archive`/`/planner/*`, **não** é necessário estender esses mocks (confirmar antes de assumir, Task 11.5 — evita o retrabalho especulativo que a 4.5 Task 11.7 precisou fazer por um motivo diferente).
- **File List por último** (retro Epic 3 §8-2): rodar `git status --short`/`git diff --stat` **depois** da verificação manual e reconciliar — guardrail ativo em `_bmad/custom/bmad-dev-story.toml`.
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1) — rodar o comando de verdade antes de escrever Completion Notes/Debug Log.
- Deploy AR-21 concluído (2026-07-12); AR-22 (observabilidade) segue pendente, sem dono/data — não bloqueia esta story.

### Git Intelligence

- Branch `main`; HEAD em `a6ebcad` (Story 4.5 mergeada — Templates de tarefas recorrentes). Convenção de commit: `feat(story-4.6): <descrição em pt-BR>`.
- Primeira story do Épico 4 **sem** migration (nenhum model novo, nenhum campo novo em `WeeklyLog`/`MonthlyLog`/`Task` — só serviço/serializer/view novos e aditivos, mais frontend).
- Esta é também a última story do Épico 4 — ao concluir, avaliar se a retrospectiva do épico (`epic-4-retrospective`, hoje `optional` em `sprint-status.yaml`) deve rodar antes de abrir o Épico 5 (guardrail: retrospective nunca pulada quando o épico realmente fecha, ver memória "Story-automator: commits e retrospective").

### Project Structure Notes

- Backend: `services/archive.py` é o único arquivo novo; `serializers.py`/`views.py`/`urls.py` estendidos (não recriados); nenhuma migration; nenhuma exceção de domínio nova (superfície só de leitura).
- Frontend: `pages/archive/ArchivePage.tsx` (+ teste) é o único diretório/página nova; `WeeklyPage.tsx`/`MonthlyPage.tsx` estendidos (não recriados) para servir também como visão do Arquivo via rota parametrizada; `api.ts`/`keys.ts`/`types.ts`/`index.ts` estendidos; `router.tsx` ganha 2 rotas novas + troca `PlaceholderPage` por `ArchivePage` em `/archive` (mesmo padrão da troca de `settings` na 4.5).
- Fronteiras (§7.2): `features/bujo` não importa outra feature; `pages/archive` compõe a feature (mesmo padrão de `pages/daily`/`pages/planner`/`pages/settings`). Sem violação de `import-linter` esperada (mesma app `bujo` no backend, nenhum novo app Django).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6 (linhas 730-746); §Epic 4 (linhas 622-624 — "histórias estritamente ordenadas")]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.10 (linha 203 — definição de "fechada": todas as tarefas com disposição — concluída/cancelada/adiada/migrada), FR-1.13 (linha 213 — Arquivo: consultável, estado final + o que foi feito)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-04 item 5 (linhas 205 — "sem automação de migração... reconciliação é ato deliberado", generalizada nesta story para fechamento computado sem persistência), schema de `tasks` (linhas 163-183 — `migration_count`/`migrated_to_task_id` já existem desde a 3.1, nunca expostos em serializer até agora), schema de `weekly_log`/`monthly_log` (linhas 247-263 — sem campo de status/fechamento, confirma que fechamento não é persistido)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md §2.1 (linha 61 — "Arquivo" na tabela de superfícies), §3.3 (linha 135 — microcopy do estado vazio "Nenhuma semana ou mês fechado ainda."), §5.2/5.3 (linhas 363-378 — "Semana fechada"/"Mês fechado": indicador textual "Fechada"/"Fechado" sem ícone, semana/mês "move para Arquivo"), §10 (linha 688 — FR-1.13 mapeado só para "Arquivo", sem mockup dedicado — nenhum arquivo em `mockups/` referencia Arquivo, confirmado por grep)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/review-rubric.md (linha 30 — "Junho fechado" deve confirmar mesmo sem pendências, achado já incorporado ao Fluxo 3 do EXPERIENCE.md, não uma lacuna nova desta story)]
- [Source: backend/bujo/models.py (`Task.migration_count`/`Task.migrated_to_task` — campos congelados desde 3.1, "Épico 4 consome sem precisar alterar o schema", primeira story a efetivamente expô-los via API); backend/bujo/views.py (`FutureLogView` — padrão `Count(..., filter=Q(...))` reaproveitado por `list_closed_cycles`; `WeeklyReviewQueueView`/`MonthlyReviewQueueView`/`CatchUpQueueView` — padrão de query não-otimizada para filas de disposição, mesmo espírito de `is_container_closed`); backend/bujo/services/logs.py (`get_or_create_weekly_log`/`get_or_create_monthly_log`, reaproveitados sem alteração)]
- [Source: backend/bujo/serializers.py (`TaskSerializer`/`WeeklyLogSerializer`/`MonthlyLogSerializer` — pontos de extensão desta story); backend/bujo/urls.py (17 rotas existentes a preservar, 18 no total após esta story)]
- [Source: frontend/src/features/bujo/api.ts (`useWeeklyLogQuery(weekStart?)`/`useMonthlyLogQuery(monthFirst?)` — já parametrizados desde 4.1, Task 179-205); frontend/src/features/bujo/components/TaskRow.tsx (linhas 55-64 — comentário confirmando uso somente-leitura em Weekly/Monthly Log desde 4.1); frontend/src/features/bujo/monthNames.ts (`MONTH_NAMES_PT`/`capitalize`, reaproveitados por `ArchivePage`); frontend/src/pages/planner/{WeeklyPage,MonthlyPage}.tsx (pontos de extensão — `useParams`, indicador `closed`, guarda `isArchiveView`); frontend/src/pages/PlaceholderPage.tsx (substituído só na rota `archive`, mesmo padrão da 4.5 em `settings`); frontend/src/app/router.tsx (rota `archive` linha 98, a trocar; novas rotas `archive/weekly/:weekStart`/`archive/monthly/:monthFirst`); frontend/src/app/layout/Sidebar.tsx (nav item "Arquivo" → `/archive`, já existente desde a 2.3 — nenhuma alteração necessária)]
- [Source: frontend/src/pages/planner/WeeklyPage.test.tsx, frontend/src/pages/planner/MonthlyPage.test.tsx (helpers `renderWeeklyPage`/`renderMonthlyPage` sem Router — guardrail crítico da Task 11.1, confirmado por leitura direta, nenhum `import` de `react-router-dom` nesses dois arquivos hoje)]
- [Source: _bmad-output/implementation-artifacts/4-5-templates-de-tarefas-recorrentes-com-placement-manual.md#Dev Notes ("O que é 'abertura de ciclo' nesta story" — precedente de documentar decisões de escopo não-óbvias explicitamente; "AC #3 não exige lógica nova de congelamento" — precedente de reaproveitar campos já congelados sem reinventar); #File List (padrão de organização por camada)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 ("contagem real de testes"), §8 ("File List por último") — guardrails codificados em `_bmad/custom/bmad-dev-story.toml`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Retomada de uma tentativa anterior interrompida (dev-story attempt 1, ver orchestration log): Tasks 1-5 (backend: `services/archive.py`, serializers, views, urls, testes) já estavam implementadas no working tree ao iniciar esta sessão, mas com checkboxes desmarcados na story. Verificado o código contra a story antes de assumir prontidão, depois validado com a suíte completa.
- Achado real durante a validação da Task 5.4: `test_task_serializer_migrated_to_task_e_o_id_da_tarefa_de_destino_apos_migrar` (já escrito pela tentativa anterior) comparava contra `new_task.id`, mas `migrate_task()` retorna a tarefa de ORIGEM recarregada (`Task.Status.MIGRATED`, `migrated_to_task` populado) — não a tarefa de destino nova (confirmado lendo `backend/bujo/services/migration.py`: `return Task.objects.get(id=task.id)` no fim de `migrate_task`). Corrigido o teste para usar `migrated_source.migrated_to_task` como a tarefa de destino real; suíte completa voltou a 305/305 passando.
- Ambiente: a suíte de testes do backend usa Postgres remoto (Neon) e o teardown do pytest-django deixa consistentemente 1 conexão idle presa a `test_neondb` ao final de cada rodada completa (`OperationalError`/`ObjectInUse` no warning de teardown) — isso bloqueia a criação do banco de teste na rodada seguinte (`DuplicateDatabase` → `DROP DATABASE` falha por "being accessed by other users"). Não é causado por esta story (reproduzido também antes de qualquer mudança); mitigado a cada rodada terminando a conexão presa via `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'test_neondb'` (executado via `manage.py shell`, usando a conexão "default" que aponta para o banco de dev, não o de teste) antes de cada `pytest` subsequente.
- `npm run test` (Vitest) rodando os 42 arquivos em paralelo (padrão) produziu falhas intermitentes e não-determinísticas espalhadas por arquivos não relacionados a esta story (SignupPage, LoginPage, Sidebar, AppLayout, TaskDetailPanel etc. — nenhum tocado por esta story), com conjuntos de falhas diferentes a cada rodada e `Error: Test timed out in 5000ms` em testes baseados em `userEvent`. Isolados individualmente, todos os arquivos passam 100%; com `--no-file-parallelism` a suíte inteira passa 376/376 de forma determinística. Diagnosticado como contenção de recursos do worker pool nesta máquina, não regressão desta story — documentado aqui em vez de "consertado" porque não há código de produção ou teste a alterar.

### Completion Notes List

- Backend (Tasks 1-6): `services/archive.py` novo (`is_container_closed`, `list_closed_cycles`, fechamento 100% computado na leitura, sem migration). `TaskSerializer` ganha `migration_count`/`migrated_to_task` (aditivo). `WeeklyLogSerializer`/`MonthlyLogSerializer` ganham `closed`. `ArchiveEntrySerializer` + `ArchiveView` (`GET /api/bujo/archive/`) novos. Contrato regenerado (`schema.yaml` + `types.gen.ts`), diff conferido: `security` dos endpoints existentes intacto. Backend: **305 passed**, ruff/lint-imports/manage.py check limpos.
- Frontend (Tasks 7-11): `useArchiveQuery` (data layer) + `ArchivePage` (nova, lista de ciclos fechados, estado vazio tratado) + 2 rotas parametrizadas (`archive/weekly/:weekStart`, `archive/monthly/:monthFirst`) reaproveitando `WeeklyPage`/`MonthlyPage` via `useParams` (decisão documentada nas Dev Notes: sem endpoint de detalhe dedicado do Arquivo). Indicador textual "Fechada"/"Fechado" condicionado só a `closed` (independente de `isArchiveView`, conforme Dev Notes "não confundir os dois flags"); formulário de criação e `RecurringPlacementSection`/`Dialog` escondidos só quando `isArchiveView`. Guardrail da Task 11.1 aplicado antes de qualquer teste novo: `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` envolvidos em `MemoryRouter` (os ~15 testes existentes continuam passando). Frontend: **376 passed**, typecheck/lint/build limpos.
- Desvio pontual do snippet literal da Task 9.1: `<List disablePadding>` foi trocado para `<List disablePadding component="div">` (mesmo padrão já usado em `Sidebar.tsx`) — o snippet original gerava uma violação real de acessibilidade (`jest-axe`: "`<ul>` só pode conter `<li>`" quando `ListItemButton` renderiza como `<a>` via `component={RouterLink}`). Confirmado com o teste de a11y do Task 11.4 antes e depois da correção.
- Verificação manual (Task 12.3) feita via spec Playwright contra backend+frontend reais (servidores `npm run dev`/`manage.py runserver` via `playwright.config.ts`). **Correção pós-review**: a Debug Log/Completion Notes originais afirmavam que a spec fora "descartada ao final, mesmo padrão da Story 4.3/4.5" — falso, conferido via `git log`: `weekly-monthly-review.spec.ts`/`seedReviewScenario.ts` (4.3) e `recurring-templates.spec.ts` (4.5) foram **commitados**, não descartados. O padrão real do épico é manter a spec de verificação como cobertura de regressão e2e permanente; `frontend/e2e/archive.spec.ts`/`frontend/e2e/seedArchiveScenario.ts` seguem esse mesmo padrão real e foram adicionados ao File List. Confirmado: estado vazio para usuário novo, listagem de semana+mês fechados após seed direto no banco, navegação para as duas visões read-only (sem formulário/recorrentes), zero erros de console.
- Nenhum gap de especificação (architecture.md/prd.md) encontrado durante a implementação — `migration_count`/`migrated_to_task` e o schema de `weekly_log`/`monthly_log` já estavam documentados como esperado pelas Dev Notes desta story.

### Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (story-automator-review) em 2026-07-14

Revisão adversarial completa: ACs #1/#2 cross-checados contra `services/archive.py`, serializers, views, `ArchivePage`/`WeeklyPage`/`MonthlyPage` e as duas suítes de teste (backend 305/305, frontend 376/376 antes da correção). Nenhuma tarefa marcada `[x]` sem evidência real encontrada; File List batia 1:1 com `git status`/`git diff --name-only` (únicos arquivos fora da lista são artefatos de processo `_bmad-output/`/`docs/futureIdeas.md`, fora do escopo desta story).

**Achado (MEDIUM, corrigido):** `ArchivePage.tsx` retornava `null` durante `archive.isPending`, divergindo do padrão já estabelecido em `FuturePage`/`WeeklyPage`/`MonthlyPage` (todas renderizam `PlannerSkeleton` dentro do landmark `<Box component="main">` correspondente durante o carregamento). Efeito prático: usuário via página em branco (sem skeleton, sem landmark `aria-label="Arquivo"` para leitor de tela) por um instante ao abrir `/archive`. Corrigido: `ArchivePage` agora renderiza `PlannerSkeleton` no mesmo padrão das páginas irmãs; teste `'mostra skeleton enquanto carrega'` adicionado a `ArchivePage.test.tsx` (mesmo molde de `FuturePage.test.tsx`). Suíte frontend revalidada após a correção: 377/377 passing, typecheck/lint limpos.

**Outcome:** Approved. 0 issues CRITICAL. 1 issue MEDIUM encontrada e corrigida nesta revisão.

### File List

- backend/bujo/services/archive.py
- backend/bujo/serializers.py
- backend/bujo/urls.py
- backend/bujo/views.py
- backend/bujo/tests/test_serializers.py
- backend/bujo/tests/test_services.py
- backend/bujo/tests/test_views.py
- schema.yaml
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/app/router.tsx
- frontend/src/features/bujo/api.ts
- frontend/src/features/bujo/api.test.tsx
- frontend/src/features/bujo/index.ts
- frontend/src/features/bujo/types.ts
- frontend/src/pages/planner/WeeklyPage.tsx
- frontend/src/pages/planner/WeeklyPage.test.tsx
- frontend/src/pages/planner/MonthlyPage.tsx
- frontend/src/pages/planner/MonthlyPage.test.tsx
- frontend/src/pages/archive/ArchivePage.tsx
- frontend/src/pages/archive/ArchivePage.test.tsx
- frontend/e2e/archive.spec.ts
- frontend/e2e/seedArchiveScenario.ts
