# Explicacao dos arquivos nao commitados - Story 3.2

Este documento explica as alteracoes nao commitadas da Story 3.2 em ordem logica de funcionamento:

1. Controle/gestao da story
2. Base de autenticacao e tenant
3. Modelo e banco
4. API backend
5. Contrato OpenAPI / tipos frontend
6. Camada de dados frontend
7. Tema/design tokens
8. Tela `/today`
9. Testes

## 1. Artefatos de gestao da story

### `_bmad-output/implementation-artifacts/3-2-superficie-do-daily-log-com-task-row-e-ciclo-de-estados.md`

**Funcao geral do arquivo**

E o arquivo principal da Story 3.2. Ele descreve o objetivo funcional, criterios de aceitacao, tarefas executadas, decisoes tecnicas, bugs encontrados, arquivos criados/modificados e status final.

**Funcao geral da alteracao**

Arquivo novo que registra que a Story 3.2 foi implementada: Daily Log real, Task Row, ciclo de status, campo `category`, endpoints backend, frontend `/today`, testes e correcoes de infraestrutura.

**Blocos principais**

- Linhas 11-15: historia do usuario.
- Linhas 17-35: acceptance criteria.
- Linhas 39-89: checklist de implementacao.
- Linhas 91-199: dev notes e decisoes.
- Linhas 241-270: registro do agente/dev-story.
- Linhas 271-321: lista de arquivos afetados.
- Linhas 323-328: changelog.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Controla o status das stories no sprint.

**Alteracao**

A Story 3.2 saiu de `in-progress` para `done`.

**Blocos alterados**

- `last_updated`: atualizado para `2026-07-04`.
- `3-2-superficie-do-daily-log...`: atualizado para `done`.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Resumo historico das execucoes e cobertura de testes.

**Alteracao**

Adiciona o resumo de automacao da Story 3.2.

**Blocos principais**

- Gaps fechados:
  - 404 para task inexistente.
  - ciclo completo de status.
  - GET integrado com ordem e categoria.
  - integracao frontend entre `DailyPage`, `TaskRow` e mutacao.
- Comandos executados:
  - backend: `pytest`
  - frontend: `vitest`, `tsc`, `eslint`

## 2. Base de tenant e autenticacao

Esta e a parte mais sensivel da mudanca.

Antes, o sistema tentava setar o tenant no middleware. Isso nao funcionava corretamente para JWT real porque o middleware roda antes do DRF autenticar o usuario.

Agora:

1. `TenantAwareJWTAuthentication` autentica o JWT.
2. Ao descobrir o usuario real, seta `current_user_id`.
3. Guarda o token no request cru.
4. `TenantMiddleware` reseta o contexto no fim da request.

### `backend/core/context.py`

**Funcao geral do arquivo**

Novo modulo minimo que guarda apenas o `current_user_id`.

**Funcao da alteracao**

Evita circular import. Antes o contextvar estava em `core.tenant`; agora fica em um modulo folha, sem imports internos.

**Codigo**

```python
import contextvars

current_user_id = contextvars.ContextVar("current_user_id", default=None)
```

**O que faz**

- `contextvars.ContextVar` cria uma variavel de contexto.
- Ela funciona como estado local da execucao atual.
- `default=None` significa: sem tenant definido.
- Se nao houver tenant, o manager falha fechado.

**Lib**

`contextvars.ContextVar` espera:

- nome da variavel;
- valor default opcional.

Entrega:

- `.get()` para ler valor atual;
- `.set(value)` para setar valor e receber um token;
- `.reset(token)` para restaurar valor anterior.

### `backend/core/authentication.py`

**Funcao geral do arquivo**

Define autenticacao JWT customizada que tambem seta o tenant atual.

**Funcao da alteracao**

Substitui o `JWTAuthentication` padrao por uma versao tenant-aware.

**Importacoes**

```python
from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme
from rest_framework_simplejwt.authentication import JWTAuthentication
from core.context import current_user_id
```

- `JWTAuthentication`: classe do SimpleJWT que valida Bearer token.
- `SimpleJWTScheme`: extensao usada pelo drf-spectacular para gerar schema OpenAPI com `jwtAuth`.
- `current_user_id`: contextvar que guarda o usuario atual.

**Classe `TenantAwareJWTAuthentication`**

```python
class TenantAwareJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _ = result
            request._request._tenant_context_token = current_user_id.set(user.id)
        return result
```

**O que faz**

- Chama a autenticacao JWT original.
- Se o token for valido, recebe `(user, token)`.
- Seta `current_user_id` com `user.id`.
- Guarda o token de reset em `request._request`.

**Por que `request._request`**

O DRF passa um wrapper `Request`, mas o middleware enxerga o `HttpRequest` cru do Django. O token precisa ficar no objeto que o middleware ve.

**Classe `TenantAwareJWTAuthenticationScheme`**

```python
class TenantAwareJWTAuthenticationScheme(SimpleJWTScheme):
    target_class = "core.authentication.TenantAwareJWTAuthentication"
```

**O que faz**

Registra essa autenticacao customizada no drf-spectacular para que o OpenAPI continue gerando:

```yaml
security:
  - jwtAuth: []
```

Sem isso, o schema perderia a seguranca JWT.

### `backend/core/middleware.py`

**Funcao geral do arquivo**

Garante limpeza do tenant depois da request.

**Funcao da alteracao**

O middleware nao seta mais o tenant. Ele so reseta.

**Codigo principal**

```python
class TenantMiddleware:
    def __call__(self, request):
        try:
            return self.get_response(request)
        finally:
            token = getattr(request, "_tenant_context_token", None)
            if token is not None:
                current_user_id.reset(token)
```

**O que faz**

- Executa a request normalmente.
- Mesmo se a view lancar excecao, entra no `finally`.
- Se houver token salvo pelo autenticador, reseta o contextvar.

**Comportamento esperado**

- JWT valido: auth seta tenant, middleware limpa no final.
- Sem JWT: nada e setado, nada e resetado.
- Erro na view: ainda assim limpa.

### `backend/core/tenant.py`

**Funcao geral do arquivo**

Define isolamento multi-tenant.

**Alteracao**

Agora importa `current_user_id` de `core.context`.

**Blocos principais**

```python
@contextmanager
def tenant_context(user):
```

Usado fora do ciclo HTTP, especialmente em testes e scripts.

```python
class TenantManager(models.Manager):
    def get_queryset(self):
        uid = current_user_id.get()
        if uid is None:
            raise TenantScopeViolation()
        return super().get_queryset().filter(user_id=uid)
```

**O que faz**

- Le tenant atual.
- Se nao houver tenant, levanta erro.
- Se houver, filtra queries por `user_id`.

**Lib**

`models.Manager` e o manager do Django. `get_queryset()` define a base de toda query feita por `Model.objects`.

## 3. Modelo e banco

### `backend/bujo/models.py`

**Funcao geral do arquivo**

Define os modelos `Log` e `Task`.

**Funcao da alteracao**

Adiciona categoria a task.

**Novo bloco**

```python
class Category(models.TextChoices):
    TEAL = "teal"
    PURPLE = "purple"
    PINK = "pink"
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"
```

**O que faz**

Define as categorias possiveis para a borda lateral da Task Row.

**Campo novo**

```python
category = models.CharField(
    max_length=8,
    choices=Category.choices,
    null=True,
    blank=True
)
```

**O que faz**

- Armazena a categoria da task.
- Pode ser `null`.
- Pode ficar em branco em forms/admin.
- Aceita apenas os valores definidos em `Category`.

**Lib**

`models.TextChoices` entrega:

- `.choices`: lista compativel com `choices=`;
- `.values`: valores brutos;
- nomes simbolicos como `Task.Category.TEAL`.

### `backend/bujo/migrations/0002_task_category.py`

**Funcao geral do arquivo**

Migration Django que altera o banco.

**Alteracao**

Adiciona coluna `category` em `tasks`.

```python
migrations.AddField(
    model_name='task',
    name='category',
    field=models.CharField(...),
)
```

**Lib**

`migrations.AddField` instrui o Django a gerar SQL para adicionar uma coluna.

### `backend/bujo/admin.py`

**Funcao geral do arquivo**

Registra `Log` e `Task` no Django Admin.

**Funcao da alteracao**

Permite manipular logs/tasks no admin, inclusive atribuir categoria manualmente antes da UI de edicao existir.

**Blocos**

```python
@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
```

Configura listagem de logs.

```python
def get_queryset(self, request):
    return Log.all_objects.all()
```

Usa `all_objects` para fugir do manager tenant-scoped.

Mesmo padrao para `TaskAdmin`.

**Lib**

`admin.ModelAdmin` permite configurar listagem, filtros, busca e queryset do Django Admin.

## 4. API backend

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Define como models viram JSON.

**Funcao da alteracao**

Cria serializers do Daily Log.

**`TaskSerializer`**

```python
class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ["id", "title", "status", "eisenhower", "category"]
```

Entrega uma task com os campos usados pela UI.

**`LogSerializer`**

```python
class LogSerializer(serializers.ModelSerializer):
    tasks = TaskSerializer(many=True, read_only=True)
```

Aninha as tasks do log.

**Lib**

`serializers.ModelSerializer` espera:

- um model;
- lista de fields.

Entrega:

- `.data` com representacao serializada;
- validacao automatica quando usado para input.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Expoe endpoints do Daily Log.

#### `TodayLogView`

```python
class TodayLogView(APIView):
    @extend_schema(responses=LogSerializer)
    def get(self, request):
        log_date = today_for(request.user)
        log = get_or_create_daily_log(user=request.user, log_date=log_date)
        return Response(LogSerializer(log).data)
```

**O que faz**

- Calcula a data de hoje para o usuario.
- Busca ou cria o Daily Log.
- Retorna log com tasks aninhadas.

**Libs/funcoes**

- `APIView`: classe base DRF para views.
- `extend_schema`: informa o schema OpenAPI.
- `Response`: resposta DRF serializada.
- `today_for(user)`: funcao do projeto que decide a data correta do usuario.
- `get_or_create_daily_log`: servico de dominio que materializa o log.

#### `TaskTransitionRequestSerializer`

```python
class TaskTransitionRequestSerializer(serializers.Serializer):
    to_status = serializers.ChoiceField(choices=Task.Status.choices)
```

**O que faz**

Valida o corpo do POST:

```json
{ "toStatus": "started" }
```

No Python vira `to_status`, por causa do camel-case parser.

**Lib**

`ChoiceField` aceita apenas valores dentro de `Task.Status.choices`. Valor invalido gera 400.

#### `TaskTransitionView`

```python
class TaskTransitionView(APIView):
    @extend_schema(request=TaskTransitionRequestSerializer, responses=TaskSerializer)
    def post(self, request, pk):
        body = TaskTransitionRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            task = transition_task(...)
        except Task.DoesNotExist:
            raise NotFound() from None
        return Response(TaskSerializer(task).data)
```

**O que faz**

- Valida o input.
- Chama o servico de transicao.
- Se a task nao existe ou e de outro tenant, retorna 404.
- Retorna a task atualizada.

**Libs**

- `NotFound`: excecao DRF que vira HTTP 404.
- `is_valid(raise_exception=True)`: valida e lanca erro 400 se invalido.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Define rotas do app `bujo`.

```python
urlpatterns = [
    path("logs/today/", TodayLogView.as_view(), name="bujo-today-log"),
    path("tasks/<uuid:pk>/transition/", TaskTransitionView.as_view(), name="bujo-task-transition"),
]
```

**Resultado final**

- `GET /api/bujo/logs/today/`
- `POST /api/bujo/tasks/{id}/transition/`

### `backend/config/urls.py`

**Alteracao**

Inclui:

```python
path("api/bujo/", include("bujo.urls"))
```

Liga as rotas do app `bujo` ao prefixo `/api/bujo/`.

## 5. Contrato OpenAPI e tipos frontend

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI da API.

**Alteracao**

Adiciona:

- `/api/bujo/logs/today/`
- `/api/bujo/tasks/{id}/transition/`
- schemas `Log`, `Task`, `TaskTransitionRequest`
- enums `StatusEnum`, `CategoryEnum`, `EisenhowerEnum`

**Importante**

Os campos aparecem em camelCase:

- `logDate`
- `toStatus`

Isso precisa bater com o JSON real.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do OpenAPI.

**Alteracao**

Adiciona tipos usados pela feature `bujo`.

Exemplos:

```ts
Log
Task
StatusEnum
CategoryEnum
TaskTransitionRequest
```

**Funcao pratica**

Evita criar tipos manuais no frontend. O frontend passa a depender do contrato gerado.

## 6. Camada de dados frontend

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza query keys do TanStack Query.

**Alteracao**

```ts
bujo: {
  todayLog: () => ['bujo', 'dailyLog', 'today'] as const,
}
```

**O que faz**

Define a chave de cache do Daily Log.

**Lib**

TanStack Query usa `queryKey` para:

- cache;
- invalidacao;
- update otimista;
- refetch.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Alias dos tipos gerados.

```ts
export type Log = components['schemas']['Log']
export type Task = components['schemas']['Task']
export type TaskStatus = components['schemas']['StatusEnum']
```

**Funcao da alteracao**

Permite importar `Task`, `Log`, etc. sem acessar diretamente `components[...]` em todos os arquivos.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks de dados da feature `bujo`.

#### `fetchTodayLog`

```ts
async function fetchTodayLog(): Promise<Log> {
  const response = await client.get<Log>('/api/bujo/logs/today/')
  return response.data
}
```

**O que faz**

Busca o log de hoje.

**Lib**

`client.get<T>()` e Axios tipado:

- espera URL;
- retorna `Promise<AxiosResponse<T>>`;
- dado real vem em `response.data`.

#### `useTodayLogQuery`

```ts
export function useTodayLogQuery() {
  return useQuery({
    queryKey: keys.bujo.todayLog(),
    queryFn: fetchTodayLog,
  })
}
```

**O que faz**

Cria query React Query para carregar/cachear o Daily Log.

**Lib**

`useQuery` espera:

- `queryKey`;
- `queryFn`.

Entrega:

- `data`;
- `isPending`;
- `isSuccess`;
- `isError`;
- `refetch`;
- etc.

#### `transitionTask`

```ts
async function transitionTask({ taskId, toStatus }: TransitionTaskVariables): Promise<Task> {
  const response = await client.post<Task>(
    `/api/bujo/tasks/${taskId}/transition/`,
    { toStatus }
  )
  return response.data
}
```

**O que faz**

Chama endpoint de transicao.

#### `useTransitionTaskMutation`

```ts
export function useTransitionTaskMutation() {
  return useOptimisticMutation<Task, unknown, TransitionTaskVariables, Log>({
    mutationFn: transitionTask,
    queryKey: keys.bujo.todayLog(),
    updater: ...
  })
}
```

**O que faz**

Executa mutacao com update otimista.

**Bloco `updater`**

```ts
tasks: current.tasks.map((task) =>
  task.id === taskId ? { ...task, status: toStatus } : task,
)
```

Atualiza no cache a task clicada antes da resposta do backend.

**Lib/projeto**

`useOptimisticMutation` e hook interno. Ele espera:

- `mutationFn`;
- `queryKey`;
- `updater`.

Entrega comportamento de:

- snapshot do cache;
- update otimista;
- rollback em erro.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export.

```ts
export { useTodayLogQuery, useTransitionTaskMutation } from './api'
export type { Log, Task, TaskStatus, TaskCategory, TaskEisenhower } from './types'
```

Facilita imports.

## 7. Tema e tokens visuais

### `frontend/src/theme.ts`

**Funcao geral do arquivo**

Cria o tema MUI da aplicacao.

**Funcao da alteracao**

Expoe no tema as cores que a Task Row e Day Header precisam.

### Module augmentation

```ts
interface CategoryPalette {
  teal: string
  purple: string
  ...
}
```

E depois:

```ts
declare module '@mui/material/styles' {
  interface Palette {
    category: CategoryPalette
    priority: PriorityPalette
    surfaces: SurfacesPalette
  }
}
```

**O que faz**

Ensina o TypeScript que `theme.palette.category`, `theme.palette.priority` e `theme.palette.surfaces` existem.

**Lib**

MUI permite module augmentation para estender o tipo do tema.

### Tokens adicionados ao tema

```ts
category: {
  teal: ...
  purple: ...
}
```

Usado para borda da task.

```ts
priority: {
  ui: ...
  u: ...
}
```

Usado para chip Eisenhower.

```ts
surfaces: {
  header: ...
}
```

Usado no Day Header.

## 8. Tela `/today`

### `frontend/src/features/bujo/components/DayHeader.tsx`

**Funcao geral do arquivo**

Renderiza o cabecalho do dia.

**Blocos**

### Imports

```ts
import { useState, type ReactNode } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
```

- `useState`: controla colapso.
- `ReactNode`: tipo dos filhos.
- MUI components: layout, botao e texto.
- `ExpandMoreIcon`: icone do chevron.

### `formatDayHeaderDate`

```ts
const [year, month, day] = logDate.split('-').map(Number)
const date = new Date(year, month - 1, day)
```

Evita `new Date("YYYY-MM-DD")`, que pode deslocar data por timezone.

```ts
new Intl.DateTimeFormat('pt-BR', ...).formatToParts(date)
```

Formata em PT-BR e extrai partes.

Entrega:

```txt
SEG, 15 JUN
```

### `DayHeader`

```tsx
const [collapsed, setCollapsed] = useState(false)
```

Controla se lista esta visivel.

```tsx
<IconButton
  aria-label={collapsed ? 'Expandir...' : 'Colapsar...'}
  aria-expanded={!collapsed}
  onClick={() => setCollapsed((prev) => !prev)}
>
```

Botao acessivel para colapsar/expandir.

```tsx
{!collapsed && children}
```

Renderiza a lista apenas quando nao colapsado.

### `frontend/src/features/bujo/components/TaskRow.tsx`

**Funcao geral do arquivo**

Renderiza uma task individual.

### Mapeamentos

```ts
const STATUS_ICON: Record<TaskStatus, ...>
```

Mapeia status para icone.

```ts
const STATUS_LABEL
```

Mapeia status para texto acessivel.

```ts
const NEXT_STATUS
```

Define ciclo clicavel:

```txt
pending -> started -> completed -> pending
```

Estados `cancelled`, `migrated`, `postponed` nao sao clicaveis.

### `eisenhowerChipInfo`

```ts
function eisenhowerChipInfo(eisenhower: Task['eisenhower'])
```

Transforma valor Eisenhower em:

- label;
- chave de cor;
- cor do texto.

Retorna `null` se nao deve mostrar chip.

### `TaskRow`

```ts
const isMobile = useMediaQuery('(max-width: 767px)')
```

Define altura minima:

- desktop: 36px;
- mobile: 44px.

```ts
const [announcement, setAnnouncement] = useState('')
```

Texto para `aria-live`.

```ts
function handleStatusClick() {
  if (!nextStatus) return
  onTransition(task.id, nextStatus)
  setAnnouncement(...)
}
```

Dispara transicao e anuncia novo estado.

### Render

```tsx
borderLeftColor: (theme) =>
  category ? theme.palette.category[category] : theme.palette.divider
```

Borda lateral colorida por categoria.

```tsx
<IconButton disabled={!nextStatus}>
```

Desabilita estados fora do ciclo.

```tsx
textDecoration: status === 'cancelled' ? 'line-through' : 'none'
```

Tacha tarefa cancelada.

```tsx
{eisenhowerChip && <Chip ... />}
```

Chip Eisenhower condicional.

```tsx
{statusChipLabel && <Chip ... />}
```

Chip de status so para `started` e `completed`.

```tsx
<Box role="status" aria-live="polite">
```

Anuncio acessivel para leitores de tela.

### `frontend/src/features/bujo/components/DailyLogSkeleton.tsx`

**Funcao geral do arquivo**

Skeleton de carregamento.

```tsx
<Skeleton variant="rounded" height={36} />
```

MUI renderiza placeholder visual.

### `frontend/src/pages/daily/useDailyData.ts`

**Funcao geral do arquivo**

Hook agregador da pagina Daily.

Hoje so chama:

```ts
const todayLog = useTodayLogQuery()
```

No futuro pode agregar habits, meds, gratitude etc.

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Pagina real da rota `/today`.

**Blocos**

```ts
const { todayLog } = useDailyData()
const transition = useTransitionTaskMutation()
```

Carrega dados e prepara mutacao.

```tsx
if (todayLog.isPending) {
  return <DailyLogSkeleton />
}
```

Estado de carregamento.

```tsx
if (!todayLog.data) return null
```

Sem dados, nao renderiza.

```ts
const pendingCount = tasks.filter((task) => task.status === 'pending').length
```

Calcula pendentes no cliente.

```tsx
<DayHeader logDate={logDate} pendingCount={pendingCount}>
```

Renderiza header.

```tsx
tasks.length === 0 ? <Typography>...</Typography> : tasks.map(...)
```

Mostra estado vazio ou lista.

```tsx
onTransition={(taskId, toStatus) => transition.mutate({ taskId, toStatus })}
```

Liga clique da task a mutacao otimista.

### `frontend/src/app/router.tsx`

**Funcao geral do arquivo**

Define rotas frontend.

**Alteracao**

```tsx
{ path: 'today', element: <DailyPage />, handle: { title: 'Hoje' } }
```

Antes era placeholder. Agora `/today` usa a pagina real.

## 9. Testes

### Backend

#### `backend/bujo/tests/test_models.py`

Cobre:

- todas as choices de `category`;
- `category=None`.

#### `backend/bujo/tests/test_serializers.py`

Cobre:

- `LogSerializer` aninha tasks na ordem de `order_index`;
- `TaskSerializer` expoe campos esperados;
- `category` nulo vira `null`;
- `category` definido aparece no JSON.

#### `backend/bujo/tests/test_views.py`

Cobre endpoints reais:

- GET `/api/bujo/logs/today/` e idempotente.
- JWT real seta tenant e reseta depois.
- sem auth retorna 401.
- usuario nao ve tasks de outro tenant.
- transicao valida retorna 200.
- transicao ilegal retorna 409.
- `toStatus` invalido retorna 400.
- task de outro usuario retorna 404.
- task inexistente retorna 404.
- ciclo completo funciona.
- GET retorna ordem e categoria.

#### `backend/core/tests/test_authentication.py`

Cobre:

- JWT valido seta `current_user_id`.
- request sem credencial nao seta nada.
- drf-spectacular reconhece o esquema `jwtAuth`.

#### `backend/core/tests/test_middleware.py`

Cobre:

- middleware reseta contextvar quando ha token.
- nao faz nada quando nao ha token.
- reseta mesmo se a view lanca excecao.

#### `backend/accounts/tests/test_isolation.py`

Atualizado para refletir o novo contrato:

- `force_authenticate` nao testa o autenticador real;
- teste de contextvar agora usa JWT real com `TenantAwareJWTAuthentication`.

### Frontend

#### `frontend/src/features/bujo/api.test.tsx`

Cobre:

- `useTodayLogQuery` chama GET correto.
- mutacao aplica status otimista no cache.
- erro faz rollback.

#### `DayHeader.test.tsx`

Cobre:

- data formatada;
- contador;
- lista visivel por padrao;
- colapso;
- expansao.

#### `TaskRow.test.tsx`

Cobre:

- titulo;
- borda por categoria;
- fallback sem categoria;
- altura mobile;
- ciclo de clique;
- estados nao clicaveis;
- chip Eisenhower;
- chip de status;
- titulo tachado;
- anuncio acessivel.

#### `DailyPage.test.tsx`

Cobre:

- skeleton;
- estado vazio;
- lista;
- clique chamando mutacao;
- acessibilidade com `jest-axe`.

#### `router.test.tsx` e `RouteAnnouncer.test.tsx`

Foram ajustados porque `/today` deixou de ser placeholder e passou a renderizar `DailyPage`.

Mudancas principais:

- envolvem render com `ThemeProvider`;
- mockam `features/bujo`;
- procuram `main` com nome acessivel `"Hoje"`.

## Resumo final

A Story 3.2 adiciona a primeira superficie real do Daily Log:

- `Task` ganha `category`.
- Backend expoe:
  - `GET /api/bujo/logs/today/`
  - `POST /api/bujo/tasks/{id}/transition/`
- Tenant via JWT real e corrigido.
- Schema OpenAPI e tipos TS sao atualizados.
- Frontend cria feature `bujo`, hooks TanStack Query, update otimista e rollback.
- `/today` deixa de ser placeholder.
- UI passa a ter Day Header, Task Rows, skeleton, estado vazio e ciclo de status.
- Testes cobrem modelo, API, autenticacao, integracao e UI.
