---
baseline_commit: 8a76795a7e3434f746dd7e92c9313cc78a438e42
---

# Story 3.2: Superfície do Daily Log com Task Row e ciclo de estados

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero ver o Daily Log de hoje com minhas tarefas e mudar o estado de cada uma com um clique,
Para que eu acompanhe o andamento do meu dia de forma imediata e familiar (FR-1.1 Daily, FR-1.4, FR-1.5, UX-DR2, UX-DR5, UX-DR12, NFR-2).

## Acceptance Criteria

1. **Day Header + lista de Task Rows + carregamento**
   - **Dado que** o Daily Log de hoje,
   - **Quando** a superfície é aberta,
   - **Então** exibe o Day Header (data "SEG, 15 JUN", contador de pendentes, chevron de colapso, tom `surface-header` tom-sobre-tom) e a lista de Task Rows na ordem manual (`order_index`),
   - **E** o carregamento usa skeleton e é percebido como instantâneo (< 2s, NFR-2) com prefetch via `useDailyData`.

2. **Anatomia da Task Row e ciclo de clique de status**
   - **Dado que** uma Task Row,
   - **Quando** renderizada,
   - **Então** mostra borda lateral 3px da categoria, ícone de status clicável, título (tachado se cancelada), chip Eisenhower (quando atribuído) e chip de status, com cor sempre acompanhada de ícone/texto,
   - **E** clicar no ícone de status cicla Pendente → Iniciada → Concluída → (volta a Pendente), com resposta otimista e rollback em erro.

3. **Estado vazio e touch target mobile**
   - **Dado que** o estado vazio,
   - **Quando** não há tarefas,
   - **Então** exibe "Nenhuma tarefa para hoje. Adicione ou migre do dia anterior." (sem gamificação),
   - **E** no mobile a linha tem touch target ≥ 44px.

## Tasks / Subtasks

- [x] **Task 1: Fechar o gap de schema "categoria" — última janela antes do fechamento do Épico 3** (AC: #2)
  - [x] 1.1 Em `bujo/models.py`, dentro de `Task`: `class Category(models.TextChoices): TEAL = "teal"; PURPLE = "purple"; PINK = "pink"; YELLOW = "yellow"; GREEN = "green"; BLUE = "blue"` — pode ser **aninhada** (diferente de `TaskStatus`/`Status`): não há `CheckConstraint` referenciando `Category.values`, então o problema de namespace da Task 3.5 de 3.1 não se aplica aqui (mesmo padrão que `Eisenhower`, já aninhada e funcionando)
  - [x] 1.2 Campo `category = models.CharField(max_length=8, choices=Category.choices, null=True, blank=True)  # noqa: DJ001 - ausência de categoria é um valor válido (ver Dev Notes)` — sem `CheckConstraint` (arquitetura §6.1 só exige `TextChoices+CheckConstraint` para `status`/blocos de medicamento/`source`/tipo de hábito/tipo de dia; `category`, assim como `eisenhower`, fica de fora dessa lista)
  - [x] 1.3 Gerar migration nomeada: `python manage.py makemigrations bujo --name task_category`
  - [x] 1.4 Criar `bujo/admin.py` registrando `Log` e `Task` (`ModelAdmin.get_queryset` retornando `all_objects` — caminho de operador explícito, AD-12) — sem UI de criação/edição de tarefa até a Story 3.3, este é o único jeito de atribuir `category` a tarefas de seed para o QA manual desta story (Task 8.3)
  - [x] 1.5 `bujo/tests/test_models.py`: teste cobrindo as 6 choices válidas de `category` + aceitação de `null`

- [x] **Task 2: Serializers de leitura** (AC: #1, #2)
  - [x] 2.1 Criar `bujo/serializers.py`: `TaskSerializer(serializers.ModelSerializer)` com `Meta.fields = ["id", "title", "status", "eisenhower", "category"]` (nomes de campo em `snake_case`, igual sempre em `Meta` — o renderer converte para `camelCase` na borda automaticamente, não duplicar a conversão aqui)
  - [x] 2.2 `LogSerializer(serializers.ModelSerializer)` com `Meta.fields = ["id", "log_date", "tasks"]`; `tasks = TaskSerializer(many=True, read_only=True)` — usa o `related_name="tasks"` da FK `Task.log` (3.1); a ordem já vem correta via `Task.Meta.ordering = ["order_index"]`, sem precisar de `order_by` explícito no serializer
  - [x] 2.3 `bujo/tests/test_serializers.py`: `LogSerializer` aninha tarefas na ordem de `order_index`; `TaskSerializer` expõe exatamente os 4 campos; campo `category` nulo serializa como `null` (não omitido)

- [x] **Task 3: Views + URLs — leitura do Daily Log de hoje e transição de status** (AC: #1, #2)
  - [x] 3.1 Criar `bujo/views.py` com `TodayLogView(APIView)`: `GET` resolve `log_date = today_for(request.user)` (autoridade temporal, §6.8 — **nunca** `date.today()`/`timezone.now().date()` direto, o guardrail de `test_guardrails.py` pega isso), chama `get_or_create_daily_log(user=request.user, log_date=log_date)`, retorna `LogSerializer(log).data`; anotar com `@extend_schema(responses=LogSerializer)` (evita o gap de schema "adivinhado" pelo drf-spectacular registrado em `deferred-work.md` — item de 2026-07-03 sobre `accounts/views.py`, mesma lição aplicada aqui desde o início)
  - [x] 3.2 No mesmo arquivo: `TaskTransitionRequestSerializer(serializers.Serializer)` com `to_status = serializers.ChoiceField(choices=Task.Status.choices)` (valor fora do enum → 400 automático)
  - [x] 3.3 `TaskTransitionView(APIView)`: `POST` valida o body com `TaskTransitionRequestSerializer`, chama `transition_task(user=request.user, task_id=pk, to_status=serializer.validated_data["to_status"])` dentro de um `try/except Task.DoesNotExist: raise NotFound()` (import `from rest_framework.exceptions import NotFound`) — **fecha o item deferido "mapeamento 404 recurso de outro usuário" registrado em `deferred-work.md` desde a Story 1.2** (ver Dev Notes); `InvalidTransition` já propaga para 409 via `custom_exception_handler` sem tratamento adicional na view; retorna `TaskSerializer(task).data`; anotar com `@extend_schema(request=TaskTransitionRequestSerializer, responses=TaskSerializer)`
  - [x] 3.4 Criar `bujo/urls.py`: `path("logs/today/", TodayLogView.as_view(), name="bujo-today-log")`, `path("tasks/<uuid:pk>/transition/", TaskTransitionView.as_view(), name="bujo-task-transition")`
  - [x] 3.5 `config/urls.py`: adicionar `path("api/bujo/", include("bujo.urls"))` (mesmo padrão de `accounts.urls`)
  - [x] 3.6 `bujo/tests/test_views.py` (usar fixture `auth_client` de `conftest.py`; para isolamento, criar um segundo client autenticado com `other_user`): GET idempotente (duas chamadas retornam o mesmo `Log.id`, não duplica); GET sem autenticação → 401; GET de `other_user` nunca vê tarefas de `user` (isolamento fim-a-fim via a view, não só via manager); POST transição válida (`pending`→`started`) → 200 com `status` atualizado; POST transição ilegal (ex. `completed`→`migrated`) → 409; POST com `toStatus` fora do enum → 400; **POST com `task_id` de uma tarefa de `other_user` → 404** (teste explícito do item antes deferido — não 403, não 500)

- [x] **Task 4: Regenerar o contrato de API** (AC: #1, #2)
  - [x] 4.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 4.2 `cd frontend && npm run generate-types`
  - [x] 4.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" (Story 1.4) passa sem diff

- [x] **Task 5: Estender o tema com os tokens de categoria/prioridade/superfície** (AC: #2) — gap: `theme.ts` já tem os valores hex em `colors` (const interna) mas **não os expõe** em `theme.palette`; nenhum componente hoje consegue lê-los
  - [x] 5.1 Em `frontend/src/theme.ts`: acrescentar module augmentation de `Palette`/`PaletteOptions` com dois grupos novos: `category: { teal, purple, pink, yellow, green, blue }` (cada um: string) e `priority: { ui, u, i, none }`; popular a partir dos mesmos valores de `colors` já existentes, condicionados por `light` (nenhum hex novo — só expor o que já está ali)
  - [x] 5.2 Também expor `surfaces: { header }` (hoje `colors.surfaceHeader`/`surfaceHeaderDark` existem mas não são usados em lugar nenhum — necessários para o tom-sobre-tom do Day Header desta story)
  - [x] 5.3 `frontend/src/theme.test.ts`: asserções cobrindo os 3 grupos novos em `light` e `dark`

- [x] **Task 6: Camada de dados do frontend — feature `bujo`** (AC: #1, #2)
  - [x] 6.1 `frontend/src/api/keys.ts`: adicionar `bujo: { todayLog: () => ['bujo', 'dailyLog', 'today'] as const }` (ver Dev Notes sobre por que **sem** `userId` no key, diferente do padrão comentado para `brainDump.count`)
  - [x] 6.2 Criar `frontend/src/features/bujo/types.ts` (reexportar/alias dos tipos de `api/types.gen.ts` gerados na Task 4 — não duplicar tipos ad-hoc, §6.2)
  - [x] 6.3 Criar `frontend/src/features/bujo/api.ts`: `useTodayLogQuery()` (`useQuery({ queryKey: keys.bujo.todayLog(), queryFn: ... })` chamando `GET /api/bujo/logs/today/`) e `useTransitionTaskMutation()` (`useOptimisticMutation` — `mutationFn` chama `POST /api/bujo/tasks/{id}/transition/`; `updater` aplica o novo `status` na tarefa certa dentro do `Log` em cache; `queryKey: keys.bujo.todayLog()`)
  - [x] 6.4 Criar `frontend/src/features/bujo/index.ts` (barrel: hooks + types, nada de `components/` internos expostos além do necessário para `pages/daily`)
  - [x] 6.5 `frontend/src/features/bujo/api.test.ts`: mock de `client` (axios) cobrindo query de sucesso, mutação otimista aplicando o novo status antes da resposta do servidor, e rollback em erro (usar `useOptimisticMutation.test.tsx` como referência de harness com `QueryClientProvider`)

- [x] **Task 7: Componentes de superfície** (AC: #1, #2, #3)
  - [x] 7.1 `frontend/src/features/bujo/components/DayHeader.tsx` — data formatada PT-BR abreviada maiúscula ("SEG, 15 JUN", ver Dev Notes sobre a armadilha de parsing de data), contador de pendentes ("N pendentes", calculado no cliente a partir da lista — sem campo novo no backend), chevron de colapso com estado local (`useState`, colapsa só a lista de tarefas, header sempre visível), fundo `theme.palette.surfaces.header`
  - [x] 7.2 `frontend/src/features/bujo/components/TaskRow.tsx` — borda esquerda 3px via `theme.palette.category[task.category]` (fallback `divider`/transparente quando `category` é `null`); ícone de status clicável (`RadioButtonUnchecked`/`HourglassEmpty`/`TaskAlt` para pending/started/completed — ver tabela em Dev Notes; `migrated`/`postponed`/`cancelled` fora do ciclo de clique nesta story, ícone renderizado mas não clicável) com `aria-label` (`"Pendente"`/`"Em andamento"`/`"Concluída"`) e anúncio do novo estado após o clique; título com `textDecoration: 'line-through'` quando `status === 'cancelled'`; chip Eisenhower **omitido** quando `eisenhower` é `null` ou `"none"`; chip de status (`"Iniciada"`/`"Feita"`) exibido **só** para `started`/`completed` (mockup não mostra chip para `pending`); `minHeight` responsivo 36px desktop / 44px mobile (mesmo padrão `useMediaQuery` de `AppLayout.tsx`) — o `IconButton` do status já herda `minWidth/minHeight: 44` do tema (Story 2.4), não duplicar
  - [x] 7.3 `frontend/src/features/bujo/components/DailyLogSkeleton.tsx` — placeholders MUI `Skeleton` nas proporções do Day Header + N Task Rows
  - [x] 7.4 Estado vazio inline (texto exato do AC3: `"Nenhuma tarefa para hoje. Adicione ou migre do dia anterior."`)
  - [x] 7.5 Criar `frontend/src/pages/daily/useDailyData.ts` — hoje só chama `useTodayLogQuery()` (único domínio pronto); comentário reservando o ponto de composição futura (`habits`/`medications`/`gratitude` entram em Épicos 6/7/8/9, prefetch paralelo per §7.3 quando existirem)
  - [x] 7.6 Criar `frontend/src/pages/daily/DailyPage.tsx` — `<Box component="main" aria-label="Hoje">` (mesmo padrão de landmark de `PlaceholderPage.tsx`); orquestra skeleton (`isPending`) → estado vazio (`tasks.length === 0`) → lista de `TaskRow`
  - [x] 7.7 `frontend/src/app/router.tsx`: trocar `{ path: 'today', element: <PlaceholderPage title="Hoje" /> }` por `{ path: 'today', element: <DailyPage />, handle: { title: 'Hoje' } }`

- [x] **Task 8: Testes de frontend + verificação manual** (AC: #1, #2, #3)
  - [x] 8.1 `DayHeader.test.tsx`, `TaskRow.test.tsx` (ciclo de clique pending→started→completed→pending, borda por categoria, chip Eisenhower condicional, chip de status condicional, título tachado quando cancelada, ícone não-clicável para migrated/postponed/cancelled), `DailyPage.test.tsx` (skeleton → lista, estado vazio, sem regressão de a11y via `jest-axe` seguindo o baseline da Story 2.4)
  - [x] 8.2 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — 0 falhas/issues
  - [x] 8.3 `cd frontend && npm run typecheck && npm run lint && npm run build` — 0 erros
  - [x] 8.4 Verificação manual: `npm run dev`, logar, abrir `/today`; usar o Django Admin (Task 1.4) para atribuir `category` a algumas tarefas de seed; confirmar bordas coloridas corretas, ciclo de clique com resposta otimista, rollback simulando erro de rede (offline no DevTools), e o estado vazio com zero tarefas

## Dev Notes

### ⚠️ Gap de schema resolvido nesta story: campo `category`

A Story 3.1 fechou o schema de `Task` **exceto** por um gap que ela mesma sinalizou e deixou para esta story resolver (ver `3-1-...md#Dev Notes — "Gap encontrado"`): as ACs de UI das Stories 3.2 ("borda lateral 3px da categoria") e 3.3 ("editar título, descrição, **categoria**, Eisenhower") referenciam um campo de **categoria** de tarefa que **não existe** no schema congelado nem em FR-1.3 do PRD (que só lista título/descrição/subtarefas/Eisenhower).

**Investigação feita para esta story (resolve o gap, não adia mais):**
- `DESIGN.md` é explícito e consistente: *"As cores `cat-*` identificam a qual grupo pertence uma tarefa — e só aparecem como bordas de 3px na lateral esquerda da task-row. As cores `priority-*` identificam o quadrante Eisenhower e aparecem como chips."* — dois conceitos paralelos, não um renomeado do outro.
- O mockup `mockups/key-daily-log-desktop.html` prova isso empiricamente: a tarefa "Finalizar relatório Q2" tem `cat-teal` **e** chip Eisenhower `U+I` ao mesmo tempo (mesma linha, dois indicadores independentes); "IVDM" tem `cat-purple` e nenhum chip Eisenhower. Categoria e Eisenhower variam de forma independente na mesma tarefa — não é o mesmo campo com nomes diferentes.
- `epics.md` Story 3.3 (linha 594) já assume que `category` será editável junto com Eisenhower — ou seja, o próprio backlog já pressupõe o campo existir antes da 3.3.

**Decisão tomada nesta story:** adicionar `Task.category` agora (Task 1), enquanto o Épico 3 ainda está aberto (só fecha ao final da Story 3.4) — a alternativa (adiar para depois do Épico 3 "fechado") violaria a própria premissa do épico de schema congelado por completo antes do Épico 4 consumir. Nenhum dado histórico existe ainda em produção para esta tabela (schema criado nesta mesma sprint), então a migration é de baixo risco.

**Escopo desta decisão:** só o campo + migration + admin (para QA manual). **Não** inclui UI de atribuição de categoria via formulário — isso é Story 3.3 ("editar... categoria"), que vai reusar o campo aqui criado.

### ⚠️ Item deferido fechado nesta story: mapeamento 404 de recurso de outro tenant

`deferred-work.md` (review da Story 1.2, 2026-06-24) registra: *"Mapeamento 404 'recurso de outro usuário' não implementado nem testado... inexistente até o Épico 3+. Cobrir com a primeira view de recurso."* — e o próprio Dev Notes da Story 3.1 já apontava: *"será relevante já na Story 3.2."*

`transition_task` (já implementado, 3.1) faz `Task.objects.get(id=task_id)` — se o `task_id` pertence a outro tenant (ou não existe), o `TenantManager` escopado simplesmente não encontra a linha e Django levanta `Task.DoesNotExist` (um `ObjectDoesNotExist` puro). Isso **não** é capturado por `custom_exception_handler` nem por `exception_handler` padrão do DRF — sem tratamento na view, viraria um 500 não mapeado, violando a tabela de erros §6.4 (`404` esperado, ocultando a existência do recurso). A Task 3.3 fecha isso explicitamente na view (`except Task.DoesNotExist: raise NotFound()`), com teste dedicado na Task 3.6. Não alterar `transition_task` em si — o tratamento é responsabilidade da view (camada mais fina, conforme §6.2: "view fina... trata erros de recurso").

### Armadilha: parsing de data no Day Header (frontend)

`logDate` chega como string `"YYYY-MM-DD"` (ISO date, sem hora). **Não** fazer `new Date("2026-07-03")` para formatar — o construtor `Date` interpreta strings ISO-8601 sem hora como UTC-midnight, e em fusos negativos (ex. `America/Sao_Paulo`, UTC-3) isso desloca a data exibida um dia para trás (mostraria "02 JUL" em vez de "03 JUL"). Fazer parsing manual dos componentes (`const [y, m, d] = logDate.split('-').map(Number)`, depois `new Date(y, m - 1, d)` — construtor de componentes locais, sem ambiguidade de fuso) antes de formatar com `Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })`. O `Intl` em pt-BR devolve abreviações com ponto final (ex. "seg.") — normalizar removendo o ponto e capitalizando em maiúsculas para bater com o formato do AC ("SEG, 15 JUN").

### Tabela de ícones de status (EXPERIENCE.md §4.1) — só o subconjunto desta story

| Estado | Ícone MUI | aria-label | Clicável nesta story? |
|---|---|---|---|
| `pending` | `RadioButtonUnchecked` | "Pendente" | ✅ (cicla p/ started) |
| `started` | `HourglassEmpty` | "Em andamento" | ✅ (cicla p/ completed) |
| `completed` | `TaskAlt` | "Concluída" | ✅ (cicla p/ pending) |
| `cancelled` | `Cancel` + título tachado | "Cancelada" | ❌ (menu de contexto — fora do escopo desta story) |
| `migrated` | `ArrowForward` | "Migrada" | ❌ (Fluxo de Migração — Épico 4) |
| `postponed` | `KeyboardDoubleArrowRight` | "Adiada" | ❌ (Fluxo de Migração — Épico 4) |

O chip de status textual (`"Iniciada"`/`"Feita"`, tokens `cat-yellow`/`cat-green` conforme `DESIGN.md`) só é exibido para `started`/`completed` — o mockup de referência não mostra chip para `pending`, e `cancelled`/`migrated`/`postponed` não são alcançáveis nesta story.

### Observação não-bloqueante: borda de categoria é indicador só-de-cor

`EXPERIENCE.md` §7.1 exige que cor nunca seja indicador único, mas nem `epics.md` (AC desta story) nem `DESIGN.md` especificam um chip/ícone textual para categoria — a lista de anatomia da Task Row (borda, ícone de status, título, chip Eisenhower, drag handle) não inclui um "chip de categoria", e o mockup de referência confirma: só a borda lateral representa categoria. Implementar exatamente o que a AC pede (borda de cor); **não inventar** um chip de categoria não especificado em nenhum documento. Ponto para o Sally (UX) resolver numa iteração futura de a11y, se necessário — não bloqueia esta story.

### Escopo — o que esta story NÃO faz

| Fora do escopo (3.2) | Pertence a |
|---|---|
| Criar/editar tarefa (título, descrição, subtarefas, atribuir Eisenhower/categoria via formulário) | Story 3.3 |
| Clique no título/área central abrindo painel de detalhe (inline desktop / bottom sheet mobile) | Story 3.3 |
| Cancelar via menu de contexto | Fora do MVP desta story (não há AC pedindo) |
| Drag-and-drop / "Mover para..." (reordenação) | Story 3.4 |
| Banner de migração, Migration Card, Fluxo de Migração | Épico 4 |
| Widget de hábitos no Daily Log (visível no mockup) | Épico 6 — `useDailyData` só compõe `bujo` por ora |

Não construir nenhum desses agora — a Task Row deve renderizar `cancelled`/`migrated`/`postponed` corretamente (ícone + título tachado quando aplicável) caso apareçam nos dados (ex. via admin), mas não precisa oferecer nenhuma ação de UI para alcançá-los.

### Endpoints desta story (novos)

```
GET  /api/bujo/logs/today/              → materializa (idempotente) e retorna o Log de hoje + tasks aninhadas
POST /api/bujo/tasks/{id}/transition/   → body {"toStatus": "started"} → Task atualizada
```

`log_date` nunca é aceito como parâmetro do cliente neste endpoint (AD-04: "o cliente nunca dita a data") — sempre resolvido server-side via `today_for(request.user)`. Navegação para outras datas (histórico, ontem, etc.) não faz parte desta story.

### Reference: `TodayLogView`/`TaskTransitionView` (forma esperada)

```python
# bujo/views.py
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from bujo.models import Task
from bujo.serializers import LogSerializer, TaskSerializer
from bujo.services.logs import get_or_create_daily_log
from bujo.services.state_machine import transition_task
from core.calendar import today_for


class TodayLogView(APIView):
    def get(self, request):
        log_date = today_for(request.user)
        log = get_or_create_daily_log(user=request.user, log_date=log_date)
        return Response(LogSerializer(log).data)


class TaskTransitionRequestSerializer(serializers.Serializer):
    to_status = serializers.ChoiceField(choices=Task.Status.choices)


class TaskTransitionView(APIView):
    def post(self, request, pk):
        body = TaskTransitionRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            task = transition_task(
                user=request.user, task_id=pk, to_status=body.validated_data["to_status"]
            )
        except Task.DoesNotExist:
            raise NotFound() from None
        return Response(TaskSerializer(task).data)
```

Views ficam finas (§6.2): parseiam/validam → chamam o serviço já existente → serializam. Nenhuma regra de transição na view.

### Query key sem `userId` — desvio intencional do padrão comentado em `keys.ts`

O comentário em `keys.ts` reserva `bujo: { dailyLog: { ... } }` e o precedente `brainDump.count(userId)` inclui `userId` na chave (evita colisão em navegador compartilhado, AD-13). Esta story usa `keys.bujo.todayLog()` **sem** `userId` porque **não existe hoje nenhum acessor de `userId` no frontend** — `AuthContext`/`AuthProvider` só expõem `isAuthenticated`/`sessionExpired`/`login`/`logout`, sem usuário decodificado (não há endpoint `/api/accounts/me/` nem decode de JWT no cliente). Adicionar isso agora seria escopo não pedido por nenhuma AC. Mitigação já existente: `AuthProvider.logout()` chama `queryClient.clear()`, então a troca de usuário no mesmo navegador já limpa todo o cache — o risco que o `userId` na chave mitigaria (dado de um usuário vazando para outro na mesma aba) já é coberto por outro mecanismo. Reavaliar se/quando um endpoint de perfil do usuário autenticado for criado.

### Previous Story Intelligence (3.1 — done)

- Stack confirmada: Django 5.2, DRF, `uv`; frontend Node 22, Vite, React 19, MUI 6.1, TanStack Query 5.59 — nenhuma dependência nova necessária nesta story (backend: nada novo em `pyproject.toml`; frontend: nada novo em `package.json`).
- `bujo/models.py`, `bujo/services/{logs,state_machine}.py`, `bujo/tests/{factories,test_models,test_services}.py` já existem — **não recriar**, só estender (`models.py` ganha `Category`+`category`; nenhum outro arquivo de 3.1 muda).
- `bujo.tests.factories` já está em `_ISOLATION_TEST_MODULES` (`conftest.py`) — `TaskFactory`/`LogFactory` já cobertas pelo contrato de isolamento; adicionar `category` ao model não exige nova entrada no registry (o `make()` já registrado continua válido, o campo é nulo por default).
- Esta é a **primeira** story que cria `bujo/serializers.py`, `bujo/views.py`, `bujo/urls.py`, `bujo/admin.py` — não existem ainda, confirmar com `ls` antes de criar (evita sobrescrever sem querer algo inesperado).
- Frontend: esta é a **primeira** feature real usando `useQuery`/`useMutation`/`useOptimisticMutation` (grep em `frontend/src/` no momento da criação desta story não achou nenhum uso fora do próprio hook em `shared/hooks/`) — sem precedente de app real para copiar; seguir literalmente `useOptimisticMutation.test.tsx` como referência de harness de teste.
- `frontend/src/features/auth/api.ts` exporta funções `async` puras (chamadas diretamente pelo componente, sem TanStack Query) — **não copiar esse padrão** para `bujo`; a arquitetura (§7.1) especifica `api.ts` como hooks `useQuery`/`useMutation`, e o `auth` antecede a adoção de TanStack Query nas features (client state simples via Context). `bujo/api.ts` é o primeiro a seguir o padrão "correto" da árvore do projeto.

### Git Intelligence

- Branch `main`; HEAD em `8a76795`. Trabalho da Story 3.1 está implementado mas **ainda não commitado** (`git status` mostra `backend/bujo/` como untracked e `core/services.py`/`core/tests/test_services.py` como deletados) — isso é esperado, não é responsabilidade desta story resolver; o dev-story desta story trabalha em cima do working tree como está.
- Convenção de commit: `"feat(story-X.Y): <descrição em pt-BR>"` (ver `4c8ed87`, `0abb27c`, etc.).
- `bujo/serializers.py`, `bujo/views.py`, `bujo/urls.py`, `bujo/admin.py` não existem — confirmar antes de criar.
- `frontend/src/features/bujo/`, `frontend/src/pages/daily/` não existem — criar com `mkdir -p`.

### Project Structure Notes

- Backend: `bujo/` ganha os arquivos que `accounts/` e `core/` já têm (`serializers.py`, `views.py`, `urls.py`, `admin.py`) — mesmo padrão de app por domínio (§7.1). `config/urls.py` ganha um `include("bujo.urls")` igual ao de `accounts`.
- Frontend: primeira feature real sob `src/features/bujo/` (o diretório só tinha `.gitkeep` até a Story 1.5) e primeira página sob `src/pages/daily/` (caminhos já reservados na árvore da arquitetura §7.1). Nenhuma variância detectada entre a estrutura pedida e a árvore documentada.
- Nenhum conflito entre o schema desta story e a árvore de projeto — a única alteração de schema (`category`) é aditiva, nula por padrão, sem impacto em dado existente.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2 (linhas 556-577)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3 (linha 594) — confirma "categoria" como campo editável futuro]
- [Source: _bmad-output/planning-artifacts/architecture.md §6.1 (nomenclatura/CheckConstraint), §6.2 (camada de serviço/estrutura), §6.3 (camelCase/paginação), §6.4 (erros/404), §6.7/6.8 (tenant/tempo), §6.10 (Reference Implementations), §7.1 (árvore do projeto), §7.3 (fluxo de dados/useDailyData)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/DESIGN.md#Categorias Semânticas, #components.task-row/status-chip/eisenhower-chip]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md §4.1 Task Row, §4.4 Day Header, §5.1 Daily Log, §5.6 Loading/Skeleton, §6.1-6.3 Primitivos de Interação, §7.1-7.2 Acessibilidade, §3.3 Microcopy estados vazios]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/mockups/key-daily-log-desktop.html — prova empírica de categoria ≠ Eisenhower]
- [Source: _bmad-output/implementation-artifacts/3-1-agregado-task-com-schema-congelado-e-maquina-de-estados.md#Dev Notes "Gap encontrado" e item deferido de 404]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from code review of 1-2 — mapeamento 404 recurso de outro usuário]
- [Source: backend/bujo/models.py, services/{logs,state_machine}.py — schema e serviços já existentes, não alterar lógica de transição]
- [Source: backend/core/calendar.py#today_for, core/exceptions.py#custom_exception_handler, core/tenant.py]
- [Source: backend/accounts/{serializers,views,urls}.py — padrão de view/serializer simples já estabelecido]
- [Source: backend/conftest.py — fixtures `user`/`other_user`/`api_client`/`auth_client`]
- [Source: frontend/src/theme.ts — tokens `cat-*`/`priority-*`/`surfaceHeader` já existem em `colors`, não expostos em `palette`]
- [Source: frontend/src/api/keys.ts, shared/hooks/useOptimisticMutation.ts — padrões canônicos de query key e mutação otimista]
- [Source: frontend/src/app/router.tsx, app/layout/AppLayout.tsx, pages/PlaceholderPage.tsx — rota `/today` já existe apontando para placeholder]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Migration `bujo/migrations/0002_task_category.py` gerada e aplicada (`manage.py migrate`) — o dev database não tinha a coluna `category` até a verificação manual expor isso via `ProgrammingError: column tasks.category does not exist`.
- **Bug pré-existente descoberto na verificação manual (Task 8.4), fora do escopo original das Tasks 1–8, corrigido nesta story com aprovação explícita do usuário** (ver `AskUserQuestion` na sessão): `GET /api/bujo/logs/today/` retornava 500 (`TenantScopeViolation`) com um JWT real, mesmo com os 139 testes originais passando. Causa raiz: `core/middleware.py:TenantMiddleware` lia `request.user` **antes** de `get_response(request)` — mas o JWT do DRF só é resolvido **dentro** do dispatch da view (`perform_authentication()`), que roda depois do middleware. O middleware sempre via `AnonymousUser` em requests reais; os testes passavam porque `auth_client`/`force_authenticate` contornam isso com `tenant_context()` manual ou nem chegam a rodar o authenticator (ver `request._force_auth_user` em `rest_framework/request.py`).
  - Fix: `core/authentication.py` (novo) — `TenantAwareJWTAuthentication` seta `current_user_id` como efeito colateral de `authenticate()`, no momento em que o DRF resolve o usuário de verdade. `TenantMiddleware` foi reescrito para só garantir o `reset` no `finally`.
  - Armadilha descoberta ao implementar o fix: `authenticate()` recebe o `Request` **wrapper** do DRF, um objeto diferente do `HttpRequest` cru que o middleware enxerga — guardar o token em `request` (o wrapper) o tornava invisível para o middleware, vazando o contextvar entre requests (só detectado porque outros testes do `core`/`accounts` passaram a falhar de forma aparentemente não-relacionada ao rodar a suíte completa). Corrigido guardando em `request._request` (a referência de volta ao `HttpRequest` cru que o DRF já expõe).
  - Circular import descoberto ao criar `core/authentication.py`: importar `core.tenant` de lá reintroduz `core.exceptions` (que `core.tenant` importa) exatamente enquanto `core.exceptions` está no meio da própria importação (via `rest_framework.views` → `rest_framework.schemas` → resolução antecipada de `DEFAULT_AUTHENTICATION_CLASSES`). Resolvido extraindo o contextvar para um módulo-folha novo, `core/context.py`, sem imports internos.
  - Testes atualizados/adicionados para refletir o novo contrato: `core/tests/test_middleware.py` (reescrito — testa só o reset), `core/tests/test_authentication.py` (novo), `bujo/tests/test_views.py` (novo teste ponta-a-ponta com Bearer token real, sem `force_authenticate`, incluindo asserção de que o contextvar é resetado), `accounts/tests/test_isolation.py::test_contextvar_conteudo_correto` (reescrito — a versão anterior testava o contrato antigo do middleware diretamente, sem passar por JWT real).
- **Segundo bug pré-existente descoberto na verificação manual**: `frontend/.env.development` tinha `VITE_API_BASE_URL=/api`, mas todo endpoint já é chamado com o path `/api/...` embutido (ex. `client.get('/api/bujo/logs/today/')`) — o axios concatenava os dois, gerando `/api/api/...` (404) em **todo** request do frontend (login incluído). Nenhum teste pegou isso porque `client` é sempre mockado nos testes de frontend. Corrigido para `VITE_API_BASE_URL=` (vazio) em dev; `.env.production` tinha o mesmo problema de classe (sufixo `/api` redundante) e foi corrigido de forma análoga.
- Neon dev database (via pooler) deixa uma sessão órfã em `test_neondb` após cada run de `pytest`, fazendo o próximo run falhar com `database "test_neondb" already exists` / `is being accessed by other users`. Contornado terminando a sessão + `DROP DATABASE` antes de cada run completo. Pré-existente, não introduzido por esta story — não corrigido (fora de escopo).

### Completion Notes List

- Gap de schema `category` fechado conforme decisão registrada nos Dev Notes: campo aninhado em `Task`, sem `CheckConstraint` (mesmo padrão de `Eisenhower`), migration `task_category`, admin de operador (`all_objects`) para QA manual.
- Item deferido "mapeamento 404 de recurso de outro usuário" (desde a Story 1.2) fechado em `TaskTransitionView` com teste explícito.
- `TaskSerializer`/`LogSerializer` expõem exatamente os campos especificados; `category`/`eisenhower` nulos serializam como `null` (não omitidos) — confirmado por teste.
- Frontend: primeira feature real usando `useQuery`/`useMutation`/`useOptimisticMutation` no projeto, seguindo `useOptimisticMutation.test.tsx` como referência de harness de teste.
- `theme.ts` ganhou `surfaceHeaderDark` (`#3A3129`, de `DESIGN.md`) em `colors` — não existia antes, só `surfaceHeader` (light); necessário para popular `theme.palette.surfaces.header` no dark mode sem inventar um hex novo.
- **Achado durante a implementação, fora do escopo original da Task 1–8 mas corrigido com aprovação explícita do usuário via `AskUserQuestion`:** bug de infraestrutura compartilhada em `core/middleware.py` (`TenantMiddleware` nunca via o usuário JWT real — ver Debug Log acima) que quebrava **toda** a superfície `/api/bujo/*` para qualquer usuário real, apesar dos 139 testes originais passarem. Corrigido movendo a responsabilidade de setar `current_user_id` para uma nova `core.authentication.TenantAwareJWTAuthentication`, com testes de regressão cobrindo o cenário real (Bearer token, sem `force_authenticate`).
- **Segundo achado, também fora do escopo original, corrigido:** `frontend/.env.development`/`.env.production` com `VITE_API_BASE_URL` duplicando o prefixo `/api` em toda chamada (login incluído) — corrigido nos dois arquivos.
- Verificação manual (Task 8.4) executada via Chromium headless (Playwright) contra `npm run dev` + backend real: login, Day Header (data formatada + contador + colapso), bordas de categoria (cores exatas confirmadas via `getComputedStyle`), ciclo de clique com atualização otimista, rollback em erro de rede simulado (request abortada), e estado vazio com zero tarefas — todos confirmados visualmente com screenshots.
- Backend: 142 testes passando (139 originais + 3 novos de `TenantAwareJWTAuthentication`/regressão), `ruff check`, `lint-imports` e `manage.py check` sem issues.
- Frontend: 157 testes passando, `typecheck`, `lint` e `build` sem erros.

### File List

**Backend — novos:**
- `backend/bujo/admin.py`
- `backend/bujo/serializers.py`
- `backend/bujo/views.py`
- `backend/bujo/urls.py`
- `backend/bujo/migrations/0002_task_category.py`
- `backend/bujo/tests/test_serializers.py`
- `backend/bujo/tests/test_views.py`
- `backend/core/authentication.py`
- `backend/core/context.py`
- `backend/core/tests/test_authentication.py` (code review: +1 teste de regressão do schema)

**Backend — modificados:**
- `backend/bujo/models.py`
- `backend/bujo/tests/test_models.py`
- `backend/config/settings/base.py`
- `backend/config/urls.py`
- `backend/core/middleware.py`
- `backend/core/tenant.py`
- `backend/core/tests/test_middleware.py`
- `backend/accounts/tests/test_isolation.py`

**Frontend — novos:**
- `frontend/src/features/bujo/types.ts`
- `frontend/src/features/bujo/api.ts`
- `frontend/src/features/bujo/api.test.tsx`
- `frontend/src/features/bujo/index.ts`
- `frontend/src/features/bujo/components/DayHeader.tsx`
- `frontend/src/features/bujo/components/DayHeader.test.tsx`
- `frontend/src/features/bujo/components/TaskRow.tsx`
- `frontend/src/features/bujo/components/TaskRow.test.tsx`
- `frontend/src/features/bujo/components/DailyLogSkeleton.tsx`
- `frontend/src/pages/daily/useDailyData.ts`
- `frontend/src/pages/daily/DailyPage.tsx`
- `frontend/src/pages/daily/DailyPage.test.tsx`

**Frontend — modificados:**
- `frontend/src/theme.ts`
- `frontend/src/theme.test.ts`
- `frontend/src/api/keys.ts`
- `frontend/src/api/types.gen.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/app/router.test.tsx`
- `frontend/src/app/layout/RouteAnnouncer.test.tsx`
- `frontend/.env.development`
- `frontend/.env.production`

**Contrato de API:**
- `schema.yaml`

### Change Log

- 2026-07-04: Implementação completa da Story 3.2 (Tasks 1–8): campo `category`, serializers/views/urls do Daily Log, tema estendido, camada de dados `bujo`, componentes `DayHeader`/`TaskRow`/`DailyPage`, testes de backend e frontend.
- 2026-07-04: Corrigido bug pré-existente em `core/middleware.py`/`core/authentication.py` (tenant context nunca era setado para JWT real) — descoberto na verificação manual, aprovado pelo usuário para correção nesta story.
- 2026-07-04: Corrigido bug pré-existente de double-prefix `/api/api/...` em `frontend/.env.development`/`.env.production` — descoberto na verificação manual.
- 2026-07-04 (code review): Corrigido regressão introduzida pela própria troca de `DEFAULT_AUTHENTICATION_CLASSES` para `TenantAwareJWTAuthentication` (Task de correção do bug de middleware, acima): drf-spectacular só resolve `OpenApiAuthenticationExtension` por path de classe exato (`match_subclasses = False`), então a subclasse deixou de casar com o `SimpleJWTScheme` nativo do `rest_framework_simplejwt`, derrubando silenciosamente `security`/`securitySchemes` (`jwtAuth`) do schema gerado em **todos** os endpoints autenticados (não só os desta story) — sem CI cobrindo isso, pois o step de CI só compara `types.gen.ts` derivado de uma regeneração fresca contra o commitado, nunca `schema.yaml` em si, e a ausência de `security` não muda os tipos TS gerados. Corrigido registrando `TenantAwareJWTAuthenticationScheme(SimpleJWTScheme)` em `core/authentication.py` (mesmo padrão que a própria lib usa para `JWTTokenUserAuthentication`); confirmado que `manage.py spectacular` volta a gerar `schema.yaml` byte-a-byte idêntico ao commitado. Teste de regressão: `core/tests/test_authentication.py::test_spectacular_resolves_a_security_scheme_for_this_class`.
