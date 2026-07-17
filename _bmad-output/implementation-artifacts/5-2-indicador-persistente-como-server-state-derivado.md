---
baseline_commit: b52cc774cc505acb25daa523391728d7399dd45d
---

# Story 5.2: Indicador persistente como server state derivado

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero um badge numérico persistente enquanto o Brain Dump tiver itens,
Para que eu nunca esqueça que há algo aguardando processamento (FR-5.4, AR-20).

## Acceptance Criteria

1. **Endpoint de contagem consumido via TanStack Query, badge nas duas superfícies**
   - **Dado que** o endpoint de contagem,
   - **Quando** implementado,
   - **Então** existe `GET /api/brain-dump/count/` leve, consumido via TanStack Query com chave `['brainDump', 'count', userId]`, ativo no app inteiro,
   - **E** o badge aparece no item Brain Dump da sidebar (visível mesmo colapsada) e no FAB mobile, e desaparece quando a caixa está vazia.

2. **Mutações invalidam a contagem; a captura é otimista**
   - **Dado que** uma mutação no Brain Dump (capturar/processar/descartar),
   - **Quando** ela completa,
   - **Então** invalida a chave `['brainDump', 'count', userId]` e o badge atualiza sozinho em todas as superfícies (sem store de cliente),
   - **E** a captura faz incremento otimista do badge com rollback em erro.

3. **`aria-label` do badge e isolamento entre usuários**
   - **Dado que** o `aria-label` do badge,
   - **Quando** a contagem muda,
   - **Então** é atualizado com a contagem atual (ex.: "Brain Dump: 3 itens pendentes"),
   - **E** dois usuários em navegadores distintos têm caches isolados (a invalidação de um nunca afeta o outro).

## Tasks / Subtasks

> **Ordem de execução:** backend (serviço → serializer → view/url → testes → contrato) antes do frontend (infra de `userId` → data layer → componente do badge → composição na Sidebar/BottomNav → testes), mesma ordem das stories anteriores. **Esta story NÃO cria model novo** — `BrainDumpItem` já existe (Story 5.1); é só um `GET` de contagem sobre a tabela existente.

- [x] **Task 1: Serviço de contagem** (AC: #1)
  - [x] 1.1 `backend/braindump/services.py` — adicionar ao lado de `list_brain_dump_items` (mesma assinatura fixa `*, user`, §6.2):
    ```python
    def count_brain_dump_items(*, user) -> int:
        return BrainDumpItem.objects.count()
    ```
    Sem `@transaction.atomic` (leitura, não escrita). `BrainDumpItem.objects` já é o manager auto-escopado por tenant (AD-12) — `.count()` nunca vaza entre usuários pela mesma garantia que já protege `list_brain_dump_items`.

- [x] **Task 2: Serializer de contagem** (AC: #1)
  - [x] 2.1 `backend/braindump/serializers.py` — adicionar:
    ```python
    class BrainDumpCountSerializer(serializers.Serializer):
        count = serializers.IntegerField()
    ```
    Serializer plano (não `ModelSerializer`) — mesmo padrão de `BrainDumpItemCreateSerializer`/`BrainDumpItemProcessSerializer`, já existentes neste arquivo.

- [x] **Task 3: View + URL** (AC: #1)
  - [x] 3.1 `backend/braindump/views.py` — adicionar `BrainDumpCountSerializer` ao import de `braindump.serializers` e `count_brain_dump_items` ao import de `braindump.services` (ambos já importam de lá — só estender as tuplas existentes), depois adicionar a view:
    ```python
    class BrainDumpCountView(APIView):
        @extend_schema(responses=BrainDumpCountSerializer)
        def get(self, request):
            count = count_brain_dump_items(user=request.user)
            return Response(BrainDumpCountSerializer({"count": count}).data)
    ```
    `@extend_schema` explícito desde o início (não esperar o drf-spectacular acusar `unable to guess serializer` como aconteceu nas 3 views da Story 5.1, Debug Log) — a resposta não é um `ModelSerializer` simples.
  - [x] 3.2 `backend/braindump/urls.py` — importar `BrainDumpCountView` e adicionar `path("count/", BrainDumpCountView.as_view(), name="braindump-item-count")` à lista (sem conflito com `items/...` — prefixo literal distinto). URL final: `/api/brain-dump/count/` (bate exatamente com o texto da AC #1 e da AD-13/AR-20).

- [x] **Task 4: Testes de backend** (AC: #1)
  - [x] 4.1 `backend/braindump/tests/test_services.py` — `count_brain_dump_items`: retorna `0` para usuário sem itens; retorna a contagem correta após criar N itens via `BrainDumpItemFactory`; escopado por tenant (itens de `other_user` não contam — criar itens para os dois, `count_brain_dump_items(user=user)` só conta os do `user` dentro do `tenant_context` certo, mesmo padrão de `list_brain_dump_items` nos testes existentes).
  - [x] 4.2 `backend/braindump/tests/test_serializers.py` — `BrainDumpCountSerializer({"count": 3}).data == {"count": 3}` (teste trivial, só para manter a paridade de cobertura por camada do §6.2 — mesmo padrão dos demais serializers testados nesta story).
  - [x] 4.3 `backend/braindump/tests/test_views.py` (fixture `auth_client`) — `GET /api/brain-dump/count/` sem itens → `200` com `{"count": 0}`; com N itens criados → `200` com `{"count": N}`; isolamento: itens de `other_user` não afetam a contagem de `user` (mesmo padrão de isolamento fim-a-fim já usado nos outros testes de view deste arquivo).

- [x] **Task 5: Regenerar o contrato de API** (AC: #1)
  - [x] 5.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 5.2 `cd frontend && npm run generate-types`
  - [x] 5.3 Conferir no diff do `schema.yaml`: novo path `/api/brain-dump/count/`; novo schema `BrainDumpCount` com campo `count: integer` (nome exato gerado pelo drf-spectacular a partir de `BrainDumpCountSerializer` — confirmar contra o arquivo, mesma diligência da Story 5.1 Task 8.2 com `TargetLogEnum`); blocos `security` dos endpoints existentes intactos (guardrail retroativo do Epic 3).
  - [x] 5.4 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" passa sem diff residual.

- [x] **Task 6: `userId` acessível no frontend — decodificar o claim do access token** (AC: #1, #2, #3)
  > **Gap real de arquitetura, resolvido aqui:** a AC #1 exige a chave `['brainDump', 'count', userId]` (mesmo texto da AD-13/AR-20/epics.md), e `frontend/src/api/keys.ts` já reserva `brainDump.count: (userId: string) => [...]` desde a Story 5.1 — mas **nenhum código do frontend hoje sabe o `userId` do usuário logado** (`AuthContext` só expõe `isAuthenticated`/`sessionExpired`/`login`/`logout`; o próprio comentário em `keys.ts` linha 10-13 documenta essa ausência para explicar por que as chaves `bujo.*` não usam `userId`). O relatório de prontidão de implementação (`implementation-readiness-report-2026-06-22.md`, linha 222) já sinalizou essa inconsistência de chave (`AD-13` usa `['brainDumpCount', userId]`; épicos/AR-20 usam `['brainDump','count', userId]`) como pendência a resolver **nesta story**. Decisão: manter a forma já reservada em `keys.ts` (`['brainDump', 'count', userId]` — mais próxima do padrão fixo `[escopo, entidade, discriminador, params?]` do §6.5 do que a forma plana de AD-13) e resolver o `userId` via **decode do claim `user_id` do access token JWT** (`SIMPLE_JWT.USER_ID_CLAIM = "user_id"`, `backend/config/settings/base.py` linha 123 — confirmado, é uma UUID string, mesmo tipo da PK de `User`). Sem lib nova (`jwt-decode` não é dependência do projeto) — JWT é 3 partes base64url separadas por `.`, decodificáveis com `atob()` nativo; não há necessidade de verificar assinatura no cliente (a autoridade de acesso já é 100% do backend via `TenantAwareJWTAuthentication`; isto serve só para namespacing de cache).
  - [x] 6.1 `frontend/src/features/auth/tokenStorage.ts` — adicionar, ao lado das funções existentes:
    ```typescript
    // Decodifica o claim `user_id` do access token (SIMPLE_JWT.USER_ID_CLAIM,
    // backend/config/settings/base.py) — só o payload, sem verificar
    // assinatura (a autoridade de acesso já é do backend; isto serve só para
    // namespacing de cache no frontend, AD-13/Story 5.2). Sem lib nova.
    export function getCurrentUserId(): string | null {
      const token = getAccessToken()
      if (!token) return null
      try {
        const payload = token.split('.')[1]
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        return (JSON.parse(json) as { user_id?: string }).user_id ?? null
      } catch {
        return null
      }
    }
    ```
  - [x] 6.2 `frontend/src/app/providers/AuthContext.ts` — estender `AuthState` com `userId: string | null`:
    ```typescript
    export interface AuthState {
      isAuthenticated: boolean
      sessionExpired: boolean
      userId: string | null
      login: (tokens: AuthTokens) => void
      logout: () => void
    }
    ```
  - [x] 6.3 `frontend/src/app/providers/AuthProvider.tsx` — importar `getCurrentUserId`, adicionar estado `userId` inicializado do token existente, atualizar em `login`/`logout`/no listener de `storage` (mesmos 3 pontos que já tocam `isAuthenticated`), e incluir `userId` no valor do `AuthContext.Provider`. **`AppLayout` só monta dentro de `<ProtectedRoute>` (`frontend/src/app/router.tsx`, redireciona para `/login` se `!isAuthenticated`)** — então qualquer componente que leia `userId` via `useAuth()` dentro da Sidebar/BottomNav só renderiza autenticado, sem race de token ausente no caminho normal.
  - [x] 6.4 `frontend/src/app/providers/AuthProvider.test.tsx` — **quebra sem este ajuste:** o arquivo já mocka `../../features/auth/tokenStorage` inteiro (linhas 6-11) com só 4 funções; sem adicionar `getCurrentUserId: vi.fn(() => null)` a esse mock, `AuthProvider.tsx` chama uma função `undefined` e todo o describe quebra. Adicionar o mock, adicionar `<span data-testid="user-id">{String(auth.userId)}</span>` em `TestConsumer`, e novos casos: token existente → `getCurrentUserId` mockado retorna um id e `userId` reflete no context; `login()` chama `getCurrentUserId()` de novo e atualiza `userId`; `logout()`/evento de `storage` resetam `userId` para `null`.
  - [x] 6.5 `frontend/src/features/auth/tokenStorage.test.ts` — estender com testes de `getCurrentUserId`: sem token → `null`; token JWT válido (montar uma string fake `header.payload.signature` com `payload = btoa(JSON.stringify({ user_id: 'uuid-fake' }))`) → retorna `'uuid-fake'`; token malformado (string sem pontos, ou payload que não é JSON válido) → `null` (não lança).

- [x] **Task 7: Data layer — query de contagem + otimismo nas mutações existentes** (AC: #1, #2)
  - [x] 7.1 `frontend/src/features/braindump/types.ts` — adicionar (tipo vem do contrato gerado, §6.2, não um `interface` ad-hoc):
    ```typescript
    export type BrainDumpCount = components['schemas']['BrainDumpCount']
    ```
  - [x] 7.2 `frontend/src/features/braindump/api.ts` — importar `useAuth` do barrel de `features/auth` (`import { useAuth } from '../auth'` — permitido pela fronteira de ESLint: só o barrel, nunca um subpath, `frontend/eslint.config.js` linhas 36-59) e `useOptimisticMutation` de `'../../shared/hooks/useOptimisticMutation'`. Adicionar a query de contagem:
    ```typescript
    async function fetchBrainDumpCount(): Promise<BrainDumpCount> {
      const response = await client.get<BrainDumpCount>('/api/brain-dump/count/')
      return response.data
    }

    export function useBrainDumpCountQuery() {
      const { userId } = useAuth()
      return useQuery({
        queryKey: keys.brainDump.count(userId ?? ''),
        queryFn: fetchBrainDumpCount,
        enabled: !!userId,
      })
    }
    ```
  - [x] 7.3 `useCreateBrainDumpItemMutation` — trocar de `useMutation` para `useOptimisticMutation` (helper canônico, §6.5/§6.10 — "nunca otimismo artesanal"), otimista **só na contagem** (a lista do Brain Dump continua sem otimismo, herdado da Story 5.1 — "Sem otimismo na lista"):
    ```typescript
    export function useCreateBrainDumpItemMutation() {
      const queryClient = useQueryClient()
      const { userId } = useAuth()
      return useOptimisticMutation<BrainDumpItem, unknown, CreateBrainDumpItemVariables, BrainDumpCount>({
        mutationFn: createBrainDumpItem,
        queryKey: keys.brainDump.count(userId ?? ''),
        updater: (current) => ({ count: (current?.count ?? 0) + 1 }),
        mutationOptions: {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.brainDump.list() }),
        },
      })
    }
    ```
    `useOptimisticMutation` já cobre `onMutate` (snapshot + incremento otimista) → `onError` (rollback) → `onSettled` (invalida `keys.brainDump.count(userId)`) por construção (`frontend/src/shared/hooks/useOptimisticMutation.ts`); `mutationOptions.onSuccess` (não excluído pelo `Omit` do tipo do helper) é o único ponto extra necessário para manter a invalidação de `brainDump.list()` que já existia. **Não** muda a assinatura pública do hook — `BrainDumpPage.tsx` (`createItem.mutate(fields)`) continua funcionando sem alteração, porque `useOptimisticMutation` retorna o mesmo objeto de `useMutation`.
  - [x] 7.4 `useProcessBrainDumpItemMutation`/`useDiscardBrainDumpItemMutation` — **sem** otimismo (AC #2 só pede otimismo na captura); adicionar `const { userId } = useAuth()` e mais uma linha de invalidação em cada `onSuccess` existente:
    ```typescript
    queryClient.invalidateQueries({ queryKey: keys.brainDump.count(userId ?? '') })
    ```
    (em `useProcessBrainDumpItemMutation`, ao lado das invalidações de `brainDump.list`/`dailyLog`/`weeklyLog`/`monthlyLog`/`taskDensity` já existentes; em `useDiscardBrainDumpItemMutation`, ao lado da invalidação de `brainDump.list` já existente). Não muda a assinatura pública de nenhum dos dois hooks — `BrainDumpItemRow.tsx`/`ProcessItemDialog.tsx` continuam chamando `useDiscardBrainDumpItemMutation()`/`useProcessBrainDumpItemMutation()` sem argumentos.
  - [x] 7.5 `frontend/src/features/braindump/index.ts` — exportar `useBrainDumpCountQuery` ao lado dos 4 hooks já exportados, e o tipo `BrainDumpCount`.
  - [x] 7.6 `frontend/src/api/keys.ts` — o comentário nas linhas 10-13 ("não há hoje nenhum acessor de userId no frontend") fica **desatualizado** depois da Task 6 — atualizar para explicar por que as chaves `bujo.*` continuam deliberadamente sem `userId` mesmo agora que `useAuth().userId` existe (YAGNI: `AuthProvider.logout()` já limpa o cache inteiro na troca de usuário; adicionar `userId` a chaves que não precisam seria especulativo). Não adicionar `userId` a nenhuma chave `bujo.*` nesta story — fora de escopo.

- [x] **Task 8: Componente `BrainDumpBadge`** (AC: #1, #3)
  - [x] 8.1 `frontend/src/features/braindump/components/BrainDumpBadge.tsx` — wrapper reutilizável (2 pontos de uso: sidebar + FAB) em volta de um ícone:
    ```typescript
    import { Badge } from '@mui/material'
    import { useBrainDumpCountQuery } from '../api'

    interface BrainDumpBadgeProps {
      children: React.ReactNode
    }

    export function BrainDumpBadge({ children }: BrainDumpBadgeProps) {
      const { data } = useBrainDumpCountQuery()
      const count = data?.count ?? 0
      const label = `Brain Dump: ${count} ${count === 1 ? 'item pendente' : 'itens pendentes'}`

      return (
        <Badge badgeContent={count} invisible={count === 0} color="primary" aria-label={label}>
          {children}
        </Badge>
      )
    }
    ```
    `invisible={count === 0}` cobre "desaparece quando a caixa está vazia" (AC #1) sem desmontar a query. `aria-label` no `Badge` cobre o texto exato pedido pela AC #3 e por `EXPERIENCE.md` §7.2 (linha 494: `aria-label` atualizado com a contagem, ex. "Brain Dump: 3 itens pendentes") — **verificar com `jest-axe`/inspeção manual (Task 12.3) se o `aria-label` do `Badge` (elemento descendente dentro de um `ListItemButton`/`Fab` interativo) polui o nome acessível do botão pai por concatenação** (regra de accname: um `aria-label` num descendente entra no nome computado do ancestral interativo quando o nome do ancestral vem do conteúdo). Se isso se provar um problema real (redundância tipo "Brain Dump: 3 itens pendentes Brain Dump" no botão), a correção é marcar o dígito do `Badge` como `aria-hidden` (`slotProps={{ badge: { 'aria-hidden': true } }}` — confirmar API exata contra a versão instalada do MUI, `^6.1.0`) e mover o texto completo para uma região `role="status" aria-live="polite"` visualmente oculta como **irmã**, não descendente, do botão — mesmo padrão já usado em `frontend/src/features/bujo/components/TaskRow.tsx` linhas 316-322 (`announcement`). Não é bloqueante para esta story a menos que o teste de acessibilidade acuse violação real.
  - [x] 8.2 `frontend/src/features/braindump/index.ts` — exportar `BrainDumpBadge`.

- [x] **Task 9: Sidebar e BottomNav consomem o badge** (AC: #1)
  - [x] 9.1 `frontend/src/app/layout/Sidebar.tsx` — importar `BrainDumpBadge` de `'../../features/braindump'` (import permitido: `app/` compõe múltiplas features, §7.2), trocar o ícone do item "Brain Dump" em `bottomItems` (linha ~68):
    ```typescript
    { label: 'Brain Dump', path: '/brain-dump', icon: <BrainDumpBadge><InboxIcon /></BrainDumpBadge> },
    ```
    `bottomItems` continua um array no escopo do módulo — `BrainDumpBadge` é só uma descrição de elemento React até `renderItem` de fato montá-lo; nenhuma outra mudança estrutural necessária no componente. Isso cobre "visível mesmo colapsada" (AC #1) de graça: `renderItem` já renderiza `item.icon` dentro de `ListItemIcon` independentemente de `collapsed` (só o `ListItemText` some quando colapsada).
  - [x] 9.2 `frontend/src/app/layout/BottomNav.tsx` — importar `BrainDumpBadge` de `'../../features/braindump'`, envolver o ícone do FAB (ainda `disabled` — a funcionalidade de captura é da Story 5.3, só o badge visual é desta story):
    ```typescript
    <Fab aria-label="Captura rápida (em breve)" disabled sx={{ ... }}>
      <BrainDumpBadge>
        <AddIcon />
      </BrainDumpBadge>
    </Fab>
    ```

- [x] **Task 10: Testes de frontend** (AC: #1, #2, #3)
  - [x] 10.1 `frontend/src/features/braindump/api.test.tsx` — **quebra sem ajuste:** adicionar `vi.mock('../auth', () => ({ useAuth: () => ({ userId: 'user-1', isAuthenticated: true, sessionExpired: false, login: vi.fn(), logout: vi.fn() }) }))` no topo (mesma técnica de `router.test.tsx` linhas 8-10, que já mocka `useAuth` diretamente). Novo `describe('useBrainDumpCountQuery')`: busca `/api/brain-dump/count/` com a chave `keys.brainDump.count('user-1')`. Atualizar `describe('useCreateBrainDumpItemMutation')`: (a) incremento otimista síncrono — depois de `result.current.mutate(...)`, antes do `waitFor`, ler `qc.getQueryData(keys.brainDump.count('user-1'))` e conferir que já subiu; (b) rollback em erro — `mockPost.mockRejectedValueOnce(...)`, confirmar que o cache volta ao snapshot anterior após `isError`; (c) no sucesso, `invalidateSpy` chamado tanto com `keys.brainDump.list()` quanto com `keys.brainDump.count('user-1')`. Em `useProcessBrainDumpItemMutation`/`useDiscardBrainDumpItemMutation`, adicionar a asserção de `invalidateSpy` também para `keys.brainDump.count('user-1')` nos testes de invalidação já existentes.
  - [x] 10.2 `frontend/src/features/braindump/components/BrainDumpBadge.test.tsx` (novo) — `QueryClientProvider` real + mock de `'../../../api/client'` (3 níveis de `..` a partir de `components/`) + mock de `'../../auth'` (2 níveis): badge invisível quando `count: 0`; badge mostra o número quando `count > 0`; `aria-label` contém a contagem atual; `jest-axe` sem violações.
  - [x] 10.3 `frontend/src/app/layout/Sidebar.test.tsx` — **quebra sem ajuste:** hoje só envolve `<Sidebar>` em `<MemoryRouter>`, sem `QueryClientProvider`/`AuthContext` — `BrainDumpBadge` (via `useBrainDumpCountQuery` → TanStack Query) quebraria o render. Adicionar no topo, mesmo padrão de mock de componente usado por `router.test.tsx` (`TaskDetailPanel: () => null`, linhas 37-39):
    ```typescript
    vi.mock('../../features/braindump', () => ({
      BrainDumpBadge: ({ children }: { children: React.ReactNode }) => children,
    }))
    ```
    Sem outra mudança — os testes existentes continuam válidos (o mock devolve só os `children`, não altera texto/estrutura dos outros itens).
  - [x] 10.4 `frontend/src/app/layout/BottomNav.test.tsx` — mesmo ajuste da 10.3 (mock de `../../features/braindump`). O teste `test_fab_presente_e_desabilitado` (linha 35-40) continua passando sem mudança — o `aria-label` do `Fab` é próprio (`"Captura rápida (em breve)"`), não depende do conteúdo/badge interno.
  - [x] 10.5 `frontend/src/app/providers/AuthProvider.test.tsx` — ver Task 6.4 (mock de `getCurrentUserId` + novos casos de `userId`).
  - [x] 10.6 `frontend/src/features/auth/tokenStorage.test.ts` — ver Task 6.5.

- [x] **Task 11: Estender o e2e do Brain Dump** (AC: #1, #2)
  - [x] 11.1 `frontend/e2e/brain-dump.spec.ts` — novo teste contra backend+frontend reais: capturar um item → badge da sidebar mostra "1" (ex.: escopar a busca dentro do botão/link "Brain Dump" da navegação, já usado nos testes existentes via `page.getByRole('button', { name: 'Brain Dump' })`); descartar o item → badge some. Mesmo padrão de "cobertura de regressão e2e permanente" estabelecido na Story 5.1 — não é descartável depois do merge. Ajustar o locator exato durante a verificação manual (Task 12) se o texto do badge colidir com outro elemento da página.

- [x] **Task 12: Verificação final** (AC: #1, #2, #3)
  - [x] 12.1 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — colar a contagem real observada.
  - [x] 12.2 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — colar a contagem real observada (`--no-file-parallelism` se houver flakiness de carga, mesma nota da Story 5.1/4.6).
  - [x] 12.3 Verificação manual contra backend+frontend reais (`npm run dev` + backend, logado): capturar um item → badge aparece na sidebar (e, se possível inspecionar via devtools mobile, no FAB) com a contagem certa, `aria-label` correto (inspecionar via devtools de acessibilidade — confirmar se o `aria-label` do badge polui o nome acessível do item pai, ver nota da Task 8.1); processar/descartar até esvaziar → badge some; abrir em duas abas/perfis com usuários diferentes (ou um normal + uma aba anônima) → confirmar que a contagem de um não vaza para o outro; zero erros de console.
  - [x] 12.4 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual, reconciliado contra o File List documentado.

## Dev Notes

### Reconciliação da chave de query: `keys.ts` já reservada, AD-13 diverge — resolvido a favor de `keys.ts`

O texto da AD-13 (`architecture.md` linha 703/718) usa a forma plana `['brainDumpCount', userId]`. O texto dos épicos (linha 1079) e da AR-20 (linha 137) usa `['brainDump', 'count', userId]`. `frontend/src/api/keys.ts` já reservou a segunda forma desde a Story 5.1 (`brainDump.count: (userId) => ['brainDump', 'count', userId] as const`) — e é a forma mais próxima do padrão fixo `[escopo, entidade, discriminador, params?]` documentado em §6.5 (`escopo='brainDump'`, `entidade` implícita no próprio escopo aqui, `discriminador='count'`). O `implementation-readiness-report-2026-06-22.md` (linha 222) já sinalizou essa divergência como "trivial, mas convém padronizar... antes de implementar a Story 5.2". Esta story resolve a favor da forma já escrita em código (`keys.ts`), não do texto da AD-13 — reescrever `keys.ts` para bater com AD-13 quebraria a Story 5.1 sem nenhum ganho.

### `userId` no frontend é uma lacuna real de arquitetura — decidida e fechada nesta story

Nenhuma story anterior precisou de identidade do usuário no frontend (as chaves `bujo.*` deliberadamente não usam `userId` — comentário em `keys.ts`, decisão documentada desde a Story 3.2). A AC #1 desta story é a primeira a **exigir** `userId` numa chave de fato consumida (não só reservada). A decisão tomada (Task 6): decodificar o claim `user_id` do próprio access token JWT já armazenado em `localStorage` (sem endpoint novo, sem lib nova) e expor via `AuthContext`/`useAuth()`. Alternativas descartadas: (a) criar um endpoint `/api/accounts/me/` só para isso — desnecessário, o `user_id` já viaja no token a cada request; (b) manter as chaves sem `userId` (como `bujo.*`) — rejeitado porque a AC #1 e o próprio `keys.ts` já fixam a forma da chave com `userId` explícito, e reescrever a AC estaria fora do escopo de uma story de implementação.

### Otimismo é só na captura — processar/descartar continuam com invalidação simples

AD-13 item 5 e a AC #2 desta story pedem otimismo especificamente na **captura** ("a captura faz incremento otimista do badge"). Processar e descartar só precisam invalidar a chave no sucesso (mesmo padrão que já usam para `brainDump.list`) — não há pedido de decremento otimista nem para processar nem para descartar. Não inventar otimismo extra além do que a AC pede.

### FAB mobile já existe (desabilitado) — esta story só adiciona o badge visual, não a funcionalidade

`frontend/src/app/layout/BottomNav.tsx` já tem um `<Fab disabled aria-label="Captura rápida (em breve)">` desde antes do Épico 5 (scaffold do layout mobile). A Story 5.3 é quem liga a captura de verdade (Capture Sheet). Esta story só envolve o ícone do FAB com `BrainDumpBadge` — o badge aparece/atualiza corretamente mesmo com o FAB desabilitado, porque a contagem é 100% independente do botão estar clicável.

### Risco de accname: `aria-label` do badge pode "vazar" para o nome do botão pai

Ver nota completa na Task 8.1. Resumo: um `aria-label` num elemento descendente (o `Badge`) pode ser concatenado no nome acessível computado do ancestral interativo (`ListItemButton` na Sidebar, `Fab` no mobile) quando esse ancestral deriva o nome do conteúdo — o que tornaria o nome do botão algo como "Brain Dump: 3 itens pendentes Brain Dump". Isso **não quebra** os testes e2e existentes (Playwright faz correspondência por substring por padrão, não exata) nem necessariamente falha `jest-axe` (que não acusa nomes verbosos, só ausência de nome/contraste/etc.) — mas vale uma inspeção manual (Task 12.3) com uma árvore de acessibilidade real (devtools) antes de considerar a AC #3 100% limpa. Se incomodar, o fallback documentado (badge com `aria-hidden`, texto completo numa região `role="status"` separada, mesmo padrão de `TaskRow.tsx`) resolve sem mudar o comportamento visual.

### Testes existentes que quebram sem ajuste — lista de verificação rápida

Quatro arquivos de teste **já existentes** param de passar se as Tasks 6/7/8/9 forem implementadas sem os ajustes correspondentes (todos detalhados nas próprias tasks, resumidos aqui para não se perder no meio da implementação):
1. `AuthProvider.test.tsx` — mocka `tokenStorage` inteiro; precisa de `getCurrentUserId` no mock (Task 6.4).
2. `Sidebar.test.tsx` — sem `QueryClientProvider`; precisa mockar `features/braindump` (Task 10.3).
3. `BottomNav.test.tsx` — mesmo motivo (Task 10.4).
4. `features/braindump/api.test.tsx` — `api.ts` passa a importar `useAuth`; precisa mockar `../auth` (Task 10.1).

### Fora de escopo desta story

- **FAB funcional + Capture Sheet mobile** (captura de verdade pelo FAB) é **Story 5.3** — esta story só adiciona o badge visual ao FAB já existente (desabilitado).
- **Realtime entre abas/dispositivos** (push do badge sem refetch) — AD-13 item 6 já resolve staleness via `refetchOnWindowFocus` (já ligado globalmente em `frontend/src/api/queryClient.ts`) + refetch ao montar; websocket só entraria se virasse requisito real (não é o caso).
- **`userId` nas chaves `bujo.*`** — YAGNI, ver Task 7.6. Não tocar nessas chaves nesta story.

### Previous Story Intelligence

Aprendizados da Story 5.1 (mesmo épico, `done`, commit `b52cc77`):
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1) — rodar os comandos de verdade (Task 12.1/12.2) antes de escrever Completion Notes/Debug Log.
- **File List por último** (retro Epic 3 §8-2) — `git status --short`/`git diff --stat` depois da verificação manual, não antes (Task 12.4).
- Ambiente de teste do backend usa Postgres remoto (Neon); a Story 5.1 documentou conexões presas no teardown do pytest-django em rodadas consecutivas — se `pytest` falhar com `DuplicateDatabase`/`ObjectInUse`, é ambiente, não regressão desta story.
- `npm run test` (Vitest) em paralelo pode produzir falhas intermitentes sob carga de máquina alta; `--no-file-parallelism` é determinístico.
- A Story 5.1 já deixou `keys.ts` com `brainDump.count` reservado e um comentário explicando a ausência de `userId` no frontend — este é exatamente o gap que a Task 6 desta story fecha; o comentário precisa ser atualizado (Task 7.6), não just apagado.
- A Story 5.1 manteve `frontend/e2e/brain-dump.spec.ts` como cobertura de regressão permanente (não descartada após o merge) — esta story estende o mesmo arquivo (Task 11), não cria um novo.
- Um achado MEDIUM da revisão da Story 5.1 (`BrainDumpItemProcessSerializer` sem validação cruzada `scheduled_date`/`month_first`) já foi corrigido — não é uma pendência desta story, só contexto de que a revisão anterior foi rigorosa.

### Git Intelligence

- Branch `main`; HEAD em `b52cc77` (Story 5.1, `done`). Convenção de commit: `feat(story-5.2): <descrição em pt-BR>`.
- Segunda story do Épico 5 — reaproveita a app `braindump/` e a feature `features/braindump/` criadas do zero na 5.1; nenhum app/feature novo nesta story.
- Primeira vez no codebase que o frontend precisa de `userId` de fato consumido (não só reservado) — precedente para qualquer story futura que precise de identidade de usuário no cliente (ex.: Épico 10, gestão de usuários, pós-MVP).
- Primeiro uso de `Badge` do MUI no codebase (confirmado — nenhum resultado para `Badge` em `frontend/src` fora desta story).

### Project Structure Notes

- Backend: **nenhum arquivo novo** — só edições em `braindump/services.py`, `braindump/serializers.py`, `braindump/views.py`, `braindump/urls.py`, mais os 3 arquivos de teste existentes do app. Nenhuma mudança em `core/`, nenhuma migration nova (sem schema novo).
- Frontend: um arquivo novo de componente (`features/braindump/components/BrainDumpBadge.tsx` + seu teste) e um arquivo novo de teste (`tokenStorage` já existe, só estendido). Tocados fora de `features/braindump/`: `features/auth/tokenStorage.ts` (nova função), `app/providers/AuthContext.ts` + `AuthProvider.tsx` (+ teste), `app/layout/Sidebar.tsx` + `BottomNav.tsx` (+ testes), `api/keys.ts` (só comentário).
- Fronteiras (§7.2): `features/braindump/api.ts` importa `features/auth` **só pelo barrel** (`'../auth'`, sem subpath) — permitido pela regra de ESLint (`no-restricted-imports`, `frontend/eslint.config.js` linhas 44-58). `app/layout/Sidebar.tsx`/`BottomNav.tsx` importam `features/braindump` pelo barrel — também permitido (`app/` compõe múltiplas features).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2 (linhas 1069-1090 — user story + 3 ACs); Epic 5 intro (linhas 279-283); FR-5.1 a FR-5.4 (linhas 82-85); AR-20 (linha 137)]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-06-22.md (linha 222 — inconsistência de chave de query sinalizada como pendência pré-Story 5.2; linhas 171-174 — cobertura de FR-5.4 mapeada para esta story)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-13 (linhas 691-723 — badge como server state derivado, TanStack Query, endpoint de contagem, otimismo na captura, isolamento por navegador); §6.2 (linhas 875-892 — camada de serviço, assinatura fixa); §6.3 (linhas 894-903 — formatos de resposta, objeto direto); §6.5 (linhas 921-933 — query-key factory de forma fixa, wrapper de otimismo canônico); §6.9 (linhas 959-976 — enforcement, proibido otimismo artesanal e chave inline); §7.1 (linhas 1072-1141 — árvore do projeto, `app/layout/AppLayout.tsx` "FAB de captura", `shared/hooks/useOptimisticMutation.ts`); §7.2 (linhas 1143-1152 — fronteira de features via ESLint, `app`/`pages` como únicos compositores)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md#2.2 (linhas 71-94 — sidebar); §2.3 (linhas 95-108 — bottom nav + FAB); §4.5 (linhas 258-277 — FAB, badge numérico, desaparece quando vazio); §4.6 (linhas 280-299 — Sidebar Nav Item, badge só no Brain Dump, permanece visível colapsada); §7.2 (linha 494 — `aria-label` do badge do Brain Dump, texto exemplo "Brain Dump: 3 itens pendentes")]
- [Source: _bmad-output/implementation-artifacts/5-1-caixa-de-entrada-do-brain-dump-e-processamento-manual.md#Dev Notes ("Fora de escopo desta story (Stories 5.2/5.3)", linhas 540-544 — badge e otimismo reservados explicitamente para esta story); Completion Notes List (contagens reais de teste, `419 passed`/`577 passed`); File List completo (app `braindump/` e feature `features/braindump/` já existentes)]
- [Source: backend/config/settings/base.py (linhas 117-125 — `SIMPLE_JWT`, `USER_ID_CLAIM = "user_id"`, `USER_ID_FIELD = "id"`); backend/accounts/models.py (linha 10 — `User.id` é `UUIDField`, mesmo tipo do claim); backend/core/authentication.py (`TenantAwareJWTAuthentication` — confirma que o backend já resolve `user.id` do token a cada request, autoridade real de tenant)]
- [Source: backend/braindump/services.py (`list_brain_dump_items`/`create_brain_dump_item`/`process_brain_dump_item`/`discard_brain_dump_item` — padrão a seguir para `count_brain_dump_items`); backend/braindump/views.py (`@extend_schema` por método, já usado nas 3 views existentes); backend/braindump/urls.py (3 rotas existentes sob `api/brain-dump/`)]
- [Source: frontend/src/api/keys.ts (linhas 6-13 — `brainDump.count`/`brainDump.list` já reservados desde a Story 5.1, comentário sobre ausência de `userId` a ser atualizado); frontend/src/api/queryClient.ts (`refetchOnWindowFocus: true` já ligado globalmente — cobre AD-13 item 6 de graça); frontend/src/api/client.ts (interceptor de `Authorization: Bearer` já lê `getAccessToken()` a cada request — mesmo token que a Task 6 decodifica)]
- [Source: frontend/src/app/providers/AuthContext.ts / AuthProvider.tsx (estado atual: `isAuthenticated`/`sessionExpired`/`login`/`logout`, sem `userId` — a estender); frontend/src/app/providers/AuthProvider.test.tsx (mock de `tokenStorage` a estender, linhas 6-11); frontend/src/features/auth/tokenStorage.ts (funções existentes de storage puro, sem decode — a estender); frontend/src/features/auth/tokenStorage.test.ts (padrão de teste a seguir); frontend/src/shared/hooks/useAuth.ts (sem mudança — só repassa o contexto, que ganha o campo novo)]
- [Source: frontend/src/shared/hooks/useOptimisticMutation.ts (helper canônico completo — `onMutate`/`onError`/`onSettled`); frontend/src/features/bujo/api.ts (linhas 90-99 — `useCreateTaskMutation`, exemplo real de uso do helper, mesmo padrão a replicar para `useCreateBrainDumpItemMutation`)]
- [Source: frontend/src/app/layout/Sidebar.tsx (linha 68 — item "Brain Dump" em `bottomItems`, ícone `InboxIcon`); frontend/src/app/layout/Sidebar.test.tsx (sem `QueryClientProvider` hoje — a ajustar); frontend/src/app/layout/BottomNav.tsx (linhas 53-65 — `Fab` `disabled`, ícone `AddIcon`); frontend/src/app/layout/BottomNav.test.tsx (sem `QueryClientProvider` hoje — a ajustar); frontend/src/app/router.tsx (linhas 40-46 — `ProtectedRoute` só monta `AppLayout` autenticado, garante `userId` disponível no caminho normal); frontend/src/app/router.test.tsx (linhas 8-10/21-32/37-39 — padrão de mock de `useAuth`/barrel de feature/componente, a replicar nos testes da Sidebar/BottomNav)]
- [Source: frontend/src/features/braindump/api.ts (3 mutações existentes a estender: `useCreateBrainDumpItemMutation`/`useProcessBrainDumpItemMutation`/`useDiscardBrainDumpItemMutation`); frontend/src/features/braindump/api.test.tsx (padrão de teste com `QueryClientProvider` + mock de `client`, a estender); frontend/src/features/braindump/types.ts (padrão `components['schemas'][...]`, a estender com `BrainDumpCount`); frontend/src/features/braindump/index.ts (barrel a estender); frontend/src/pages/braindump/BrainDumpPage.tsx (consumidor de `useCreateBrainDumpItemMutation` — confirma que a assinatura pública não muda)]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx (linhas 316-322 — padrão `role="status" aria-live="polite"` visualmente oculto, fallback documentado para o risco de accname da Task 8.1); frontend/eslint.config.js (linhas 36-59 — regra de fronteira inter-feature, permite import de barrel sem subpath)]
- [Source: frontend/e2e/brain-dump.spec.ts (spec e2e da Story 5.1, cobertura de regressão permanente, a estender nesta story)]

## Dev Agent Record

### Debug Log

- Backend: implementação seguiu exatamente o roteiro do Dev Notes/Tasks (nenhum desvio) — `count_brain_dump_items` sem `@transaction.atomic` (leitura), `BrainDumpCountSerializer` plano, `BrainDumpCountView` com `@extend_schema` explícito desde o início. `manage.py spectacular` confirmou `security: jwtAuth` intacto no novo path e nos existentes (guardrail retroativo do Epic 3), e o schema gerado `BrainDumpCount` bateu exatamente com a previsão da Dev Note (`count: integer`).
- Frontend Task 6 (`userId`): decode do JWT implementado exatamente como especificado (sem lib nova). Os 4 arquivos de teste já existentes listados no Dev Notes ("Testes existentes que quebram sem ajuste") de fato quebraram sem o ajuste correspondente e foram corrigidos conforme instruído.
- **Gap não previsto pelo Dev Notes:** ao adicionar `userId: string | null` (obrigatório) à interface `AuthState`, mais 4 arquivos de teste que constroem objetos `AuthState`-shaped diretamente (não via mock de `tokenStorage`) quebraram no typecheck: `frontend/src/app/layout/RouteAnnouncer.test.tsx`, `frontend/src/app/router.test.tsx`, `frontend/src/features/auth/components/LoginPage.test.tsx`, `frontend/src/features/auth/components/SignupPage.test.tsx`. Corrigido adicionando `userId: null`/`userId` aos objetos mock existentes — mudança mecânica, sem lógica nova.
- **Regressão real capturada e corrigida antes de fechar a story:** `frontend/src/app/layout/AppLayout.test.tsx`, `frontend/src/app/router.test.tsx` e `frontend/src/app/layout/RouteAnnouncer.test.tsx` renderizam a `Sidebar`/`BottomNav` reais (via `AppLayout`/`router`) sem `QueryClientProvider` — nenhum desses 3 arquivos estava na lista de "testes que quebram sem ajuste" do Dev Notes (que citou só `AuthProvider.test.tsx`/`Sidebar.test.tsx`/`BottomNav.test.tsx`/`api.test.tsx`). Ao adicionar `BrainDumpBadge` (que usa `useBrainDumpCountQuery` → TanStack Query) dentro de `Sidebar`/`BottomNav` (Task 9), esses 3 arquivos passaram a falhar com "No QueryClient set". Corrigido com o mesmo mock (`vi.mock('.../features/braindump', () => ({ BrainDumpBadge: ({ children }) => children }))`) já usado em `Sidebar.test.tsx`/`BottomNav.test.tsx`. Mesma classe de achado já registrada em retros anteriores (Epic 11: mudança em componente compartilhado força ajuste em specs não listados nas tasks) — vale reforçar o guardrail para cobrir explicitamente "qualquer teste que renderize `AppLayout`/`Sidebar`/`BottomNav` de verdade", não só os testes dedicados desses componentes.
- Verificação manual (Task 12.3, via script Playwright avulso contra `npm run dev` + backend real, descartado ao final): o banco de dev local (branch Neon `dev`) tinha a migration `braindump.0001_initial` pendente (`manage.py migrate` resolveu) — gap de ambiente pré-existente da Story 5.1, não uma regressão desta story.
- **Risco de accname confirmado como real (não só teórico):** `page.locator(...).ariaSnapshot()` no botão "Brain Dump" da Sidebar (desktop) mostrou o nome acessível computado como `"Brain Dump: 1 item pendente Brain Dump"` — a poluição prevista na Dev Note/Task 8.1 de fato acontece, porque o `ListItemButton` deriva seu nome do conteúdo (sem `aria-label` próprio). Verificado também que o **FAB mobile não sofre o mesmo problema**: `Fab` já tem `aria-label="Captura rápida (em breve)"` explícito, então seu nome acessível não deriva do conteúdo e o `aria-label` do `Badge` não é concatenado. `jest-axe` não acusou violação em nenhuma das duas superfícies (confirma a nota de que `jest-axe` não pega nomes verbosos). Seguindo o critério explícito da própria Task 8.1 ("não é bloqueante... a menos que o teste de acessibilidade acuse violação real"), a implementação foi mantida como está — o fallback documentado (`aria-hidden` no dígito + região `role="status"` como irmã do botão) fica registrado aqui como próximo passo caso isso se prove confuso na prática, mas não foi aplicado nesta story para não expandir o escopo das Tasks 9.1/9.2 além de "envolver o ícone".

### Code Review (AI, 2026-07-17)

Revisão adversarial completa: as 3 ACs foram verificadas contra a implementação real (não só contra o texto da story), todas as 12 tasks/subtasks marcadas `[x]` foram auditadas contra evidência em código, e as contagens de teste/lint/build reivindicadas na Completion Notes foram reexecutadas do zero (não aceitas de memória):

- Backend: `uv run pytest braindump -q` → **50 passed** (1 warning de teardown de DB, ambiente Neon, já documentado nas Previous Story Intelligence — não é regressão); `ruff check .` limpo; `uv run lint-imports` limpo (contrato `core must not import domain apps` mantido); `manage.py check` limpo.
- Contrato de API: `manage.py spectacular` regerado num arquivo temporário e comparado byte-a-byte contra `schema.yaml` commitado → **sem diff**; `npm run generate-types` regerado e comparado contra `types.gen.ts` commitado → **sem diff**. `security: jwtAuth` confirmado intacto no novo path e nos existentes.
- Frontend: `npm run typecheck` limpo; `npm run lint` limpo; `npm run build` sem erros (warning de chunk >500kB é pré-existente, não desta story); `npx vitest run --no-file-parallelism` nos arquivos tocados (`features/braindump`, `app/layout`, `app/providers`, `app/router.test.tsx`, `features/auth`, `pages/braindump`) → **113 + 4 = 117 testes passando** em 17 arquivos.
- Isolamento de tenant confirmado por leitura de código: `count_brain_dump_items` segue exatamente o mesmo padrão de `list_brain_dump_items` (`BrainDumpItem.objects` já escopado por `TenantManager`/`current_user_id` contextvar via `TenantAwareJWTAuthentication.authenticate()`, `backend/core/authentication.py`) — nenhuma regressão de isolamento introduzida.
- `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` (global, `backend/config/settings/base.py`) confirmado aplicado a `BrainDumpCountView` (nenhum override) — endpoint não fica acidentalmente público.
- Achado real (MEDIUM, corrigido): `frontend/e2e/fixtures.ts` foi modificado nesta story (função `signUpAndLandOnToday` promovida a exportada, para o teste de isolamento entre usuários) mas **não constava no File List** — inconsistente com a própria Task 12.4 ("File List por último... reconciliado contra o File List documentado"). Corrigido adicionando o arquivo ao File List; nenhuma mudança de código necessária (a alteração em si — só adicionar `export` — está correta e coberta pelo teste e2e de isolamento).
- Achado de acessibilidade (accname, já documentado no Debug Log da própria story como decisão consciente e não-bloqueante): confirmado que é um trade-off real, não um oversight — mantido como está, sem forçar mudança de escopo além das Tasks 9.1/9.2.
- Nenhum CRITICAL encontrado: todas as ACs implementadas e verificadas, nenhuma task marcada `[x]` sem evidência real, nenhuma vulnerabilidade de segurança, nenhum teste placeholder.

### Completion Notes

- Backend: `count_brain_dump_items` (serviço), `BrainDumpCountSerializer`, `BrainDumpCountView` + rota `GET /api/brain-dump/count/`, 9 testes novos (3 services + 1 serializer + 3 views + isolamento). Suíte completa (sem escopo de path, `uv run pytest -q`): **428 passed**. `ruff check .`, `uv run lint-imports`, `manage.py check` limpos.
- Contrato de API regenerado: `schema.yaml` ganhou o path `/api/brain-dump/count/` e o schema `BrainDumpCount` (`count: integer`); `security: jwtAuth` de todos os endpoints existentes intacto. `frontend/src/api/types.gen.ts` regenerado a partir do schema atualizado.
- Frontend: `getCurrentUserId` (decode de JWT, `tokenStorage.ts`), `AuthContext`/`AuthProvider` estendidos com `userId`, `useBrainDumpCountQuery`, `useCreateBrainDumpItemMutation` migrada para `useOptimisticMutation` (incremento otimista + rollback), invalidação de `brainDump.count` adicionada em processar/descartar, componente `BrainDumpBadge` (MUI `Badge`, primeiro uso no codebase), badge integrado na Sidebar (item "Brain Dump") e no FAB mobile (ainda desabilitado, Story 5.3 liga a funcionalidade). Suíte completa (`npx vitest run --no-file-parallelism`): **591 passed** (51 arquivos). `npm run typecheck`, `npm run lint`, `npm run build` limpos.
- E2E: `frontend/e2e/brain-dump.spec.ts` estendido com 1 novo teste (captura → badge "1" na sidebar → descartar → badge some, verificado pela classe `MuiBadge-invisible` já que o MUI `Badge` congela o último dígito exibido durante a transição de saída, não pelo texto). Suíte completa do arquivo: **5 passed** (contra backend+frontend reais, branch Neon `e2e`).
- Verificação manual (Task 12.3): confirmado contra `npm run dev` + backend real (branch Neon `dev`, após aplicar a migration pendente) — badge aparece na sidebar e no FAB mobile com a contagem correta e `aria-label` correto ("Brain Dump: N item(s) pendente(s)"); badge some (`MuiBadge-invisible`) após descartar o único item; dois usuários (contextos de navegador distintos) confirmados com caches isolados — usuário novo nunca viu a contagem do outro; zero erros de console em toda a sessão.
- Achado de accessibility (accname) confirmado como real na Sidebar (não no FAB) — ver Debug Log. Não bloqueante por critério da própria story (jest-axe limpo); documentado, não corrigido, para não expandir escopo das Tasks 9.1/9.2.
- Nenhum gap de especificação (architecture.md/prd.md/epics.md) encontrado além do já identificado e resolvido pela própria story (reconciliação da chave de query e decisão de `userId`, ambas documentadas nas Dev Notes).

## File List

- backend/braindump/serializers.py
- backend/braindump/services.py
- backend/braindump/tests/test_serializers.py
- backend/braindump/tests/test_services.py
- backend/braindump/tests/test_views.py
- backend/braindump/urls.py
- backend/braindump/views.py
- schema.yaml
- frontend/e2e/brain-dump.spec.ts
- frontend/e2e/fixtures.ts
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/app/layout/AppLayout.test.tsx
- frontend/src/app/layout/BottomNav.test.tsx
- frontend/src/app/layout/BottomNav.tsx
- frontend/src/app/layout/RouteAnnouncer.test.tsx
- frontend/src/app/layout/Sidebar.test.tsx
- frontend/src/app/layout/Sidebar.tsx
- frontend/src/app/providers/AuthContext.ts
- frontend/src/app/providers/AuthProvider.test.tsx
- frontend/src/app/providers/AuthProvider.tsx
- frontend/src/app/router.test.tsx
- frontend/src/features/auth/components/LoginPage.test.tsx
- frontend/src/features/auth/components/SignupPage.test.tsx
- frontend/src/features/auth/tokenStorage.test.ts
- frontend/src/features/auth/tokenStorage.ts
- frontend/src/features/braindump/api.test.tsx
- frontend/src/features/braindump/api.ts
- frontend/src/features/braindump/index.ts
- frontend/src/features/braindump/types.ts
- frontend/src/features/braindump/components/BrainDumpBadge.tsx
- frontend/src/features/braindump/components/BrainDumpBadge.test.tsx

## Change Log

- 2026-07-17: Implementação completa da Story 5.2 — endpoint de contagem (`GET /api/brain-dump/count/`), `userId` decodificado do JWT e exposto via `AuthContext`, badge `BrainDumpBadge` (server state derivado via TanStack Query, otimismo na captura) integrado na Sidebar e no FAB mobile. Corrigidos 3 arquivos de teste não antecipados pelo Dev Notes (`AppLayout.test.tsx`/`router.test.tsx`/`RouteAnnouncer.test.tsx`, quebrados por renderizar `Sidebar`/`BottomNav` reais sem `QueryClientProvider`) e 4 arquivos com mocks `AuthState`-shaped que precisaram de `userId`. Status → `review`.
- 2026-07-17: Code review (AI) — revisão adversarial completa, suítes reexecutadas do zero (backend 50 passed, frontend 117 passed nos arquivos tocados), regeneração de contrato (`schema.yaml`/`types.gen.ts`) confirmada byte-a-byte sem diff, isolamento de tenant e permissões confirmados por leitura de código. 1 achado MEDIUM corrigido: `frontend/e2e/fixtures.ts` (modificado nesta story, `signUpAndLandOnToday` exportada) estava ausente do File List — adicionado. 0 CRITICAL. Status → `done`.
