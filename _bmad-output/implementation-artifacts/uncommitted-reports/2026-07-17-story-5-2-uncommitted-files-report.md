# Explicacao dos arquivos nao commitados - Story 5.2 (Indicador persistente como server state derivado)

## Visao geral

O conjunto de mudancas implementa a Story 5.2 do Epico 5 (Brain Dump & Captura Rapida): um badge numerico persistente que mostra quantos itens existem na caixa de entrada do Brain Dump, exposto simultaneamente na Sidebar (desktop/tablet) e no FAB mobile (BottomNav). O numero e tratado como **server state derivado** via TanStack Query — nao existe store de cliente proprio — e e alimentado por um novo endpoint leve `GET /api/brain-dump/count/` no backend. As mutacoes existentes (capturar, processar, descartar) passam a invalidar essa contagem; a captura, especificamente, ganha incremento otimista com rollback em erro. Para permitir uma chave de cache `['brainDump', 'count', userId]` isolada por usuario, o frontend passa a decodificar o claim `user_id` do proprio access token JWT (sem lib nova, sem endpoint novo) e a expor esse `userId` via `AuthContext`/`useAuth()` — uma capacidade que nenhuma story anterior havia precisado. A mudanca em componentes compartilhados (Sidebar/BottomNav) teve efeito cascata sobre varios testes que renderizam esses componentes sem `QueryClientProvider`, todos ajustados nesta mesma leva. Cobertura: 9 testes novos de backend, suite ampliada de frontend (componente `BrainDumpBadge` com `jest-axe`, query/otimismo/rollback, `userId`), e 2 novos testes E2E (badge no FAB mobile e isolamento de cache entre dois usuarios em contextos de navegador distintos).

## Ordem logica de funcionamento

1. Backend expoe a contagem: `count_brain_dump_items` (servico) → `BrainDumpCountSerializer` (contrato) → `BrainDumpCountView` + rota `/api/brain-dump/count/` (view/url).
2. Contrato de API e regenerado (`schema.yaml` → `frontend/src/api/types.gen.ts`), trazendo o tipo `BrainDumpCount` para o frontend.
3. Frontend ganha acesso ao `userId` do usuario logado: `tokenStorage.ts` decodifica o JWT → `AuthContext`/`AuthProvider` expoem `userId` via `useAuth()`.
4. Data layer do Brain Dump consome o endpoint via `useBrainDumpCountQuery` (chave `keys.brainDump.count(userId)`), e as 3 mutacoes existentes passam a invalidar essa chave (a de captura, alem disso, incrementa otimisticamente via `useOptimisticMutation`).
5. O componente `BrainDumpBadge` consome `useBrainDumpCountQuery` e renderiza um `Badge` do MUI em volta de um icone, com `aria-label` dinamico.
6. `Sidebar.tsx` e `BottomNav.tsx` passam a envolver seus icones de Brain Dump com `BrainDumpBadge`, tornando o numero visivel nas duas superficies da AC #1.
7. Testes sobem em cascata: testes dedicados de cada camada (backend, `tokenStorage`, `AuthProvider`, `api.ts`, `BrainDumpBadge`, `Sidebar`, `BottomNav`) e testes de terceiros que renderizam `Sidebar`/`BottomNav`/`AppLayout` de verdade sem `QueryClientProvider` (`AppLayout.test.tsx`, `router.test.tsx`, `RouteAnnouncer.test.tsx`) ou que constroem objetos `AuthState`-shaped a mao (`LoginPage.test.tsx`, `SignupPage.test.tsx`).
8. E2E (`frontend/e2e/brain-dump.spec.ts`) valida o fluxo completo contra backend+frontend reais: badge na sidebar, badge no FAB mobile, e isolamento de cache entre dois usuarios via `browser.newContext()` (habilitado pela exportacao de `signUpAndLandOnToday` em `fixtures.ts`).
9. Artefatos de planejamento/status (`sprint-status.yaml`, `test-summary.md`, log de orquestracao do story-automator, arquivo da story) registram o fechamento da story como `done`.

---

## 1. Artefatos de planejamento e status

### `_bmad-output/implementation-artifacts/5-2-indicador-persistente-como-server-state-derivado.md`

**Funcao geral do arquivo**

Arquivo da story gerado pelo workflow BMAD (`create-story`), contendo ACs, tasks, dev notes, debug log, code review e file list. Status atual: `done`.

**Funcao geral da alteracao**

Arquivo novo (untracked) — nao existia antes desta story. Documenta integralmente o ciclo `create-story → dev-story → automate → code-review` da Story 5.2.

**Blocos principais**

- Linhas 17-35: as 3 Acceptance Criteria (endpoint de contagem via TanStack Query nas duas superficies; mutacoes invalidam a contagem e a captura e otimista; `aria-label` do badge e isolamento entre usuarios).
- Linhas 41-220: 12 tasks/subtasks detalhando backend (servico, serializer, view/url, testes, regeneracao de contrato), frontend (`userId` via JWT, data layer, componente `BrainDumpBadge`, composicao Sidebar/BottomNav, testes) e verificacao final.
- Linhas 222-297: Dev Notes — reconciliacao da chave de query (`keys.ts` versus AD-13), decisao de decodificar `userId` do JWT, escopo do otimismo (so na captura), risco de accname do `aria-label` do badge dentro de botoes interativos, referencias cruzadas para arquitetura/UX/stories anteriores.
- Linhas 299-331: Dev Agent Record — Debug Log (gap nao previsto: 4 arquivos de teste `AuthState`-shaped quebraram no typecheck; regressao real capturada em 3 arquivos que renderizam `Sidebar`/`BottomNav` sem `QueryClientProvider`; risco de accname confirmado como real na Sidebar, nao no FAB) e Code Review (AI) com contagens reais de teste reexecutadas (backend 50 passed no app `braindump`, frontend 117 passed nos arquivos tocados) e 1 achado MEDIUM corrigido (File List faltando `frontend/e2e/fixtures.ts`).
- Linhas 333-366: File List final (32 arquivos).

**Comportamento de libs usadas**

- N/A — arquivo de documentacao, sem codigo executavel.

---

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Arquivo de tracking central do sprint (gerado pelo workflow `bmad-sprint-planning`), com o status de cada story de cada epico.

**Funcao geral da alteracao**

Atualiza `last_updated` (linha 2 e linha 38, comentario) para `2026-07-17` e move a entrada `5-2-indicador-persistente-como-server-state-derivado` de `backlog` para `done` (linha 99), refletindo o fechamento da story apos o code review.

**Blocos principais**

- Linha 2 e linha 38: metadado de ultima atualizacao e comentario associado.
- Linha 99: `5-2-indicador-persistente-como-server-state-derivado: backlog` → `done`.

**Comportamento de libs usadas**

- N/A — YAML de dados, consumido pelos workflows BMAD (`bmad-sprint-status`, `bmad-story-automator`) para decidir a proxima story a processar.

---

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Resumo cumulativo de rodadas de automacao de teste (QA/E2E) por story, mantido pelo workflow `bmad-qa-generate-e2e-tests`.

**Funcao geral da alteracao**

Acrescenta (append, sem alterar conteudo anterior) uma nova secao "Resumo de Automacao de Testes — Story 5.2", documentando os 2 gaps de cobertura E2E identificados e fechados nesta rodada (badge no FAB mobile e isolamento de cache entre usuarios), o mapeamento de cada AC para o teste que a cobre, e o resultado real de execucao (`7 passed` no spec do Brain Dump, `591 passed`/51 arquivos na suite completa do frontend).

**Blocos principais**

- Novo bloco a partir da linha 1864: contexto da rodada (a story ja chegou implementada com cobertura propria extensa — 9 testes de backend, suite de frontend, 1 teste E2E pre-existente).
- Tabela de gaps descobertos: badge no FAB mobile (AC1, so verificado manualmente antes) e isolamento de cache entre usuarios (AC3, so verificado manualmente antes via "duas abas/perfis").
- Tabela de cobertura por AC, cruzando testes unitarios e E2E.
- Bloco de resultado de execucao real (Playwright e Vitest) e checklist de validacao do workflow de QA.

**Comportamento de libs usadas**

- N/A — Markdown de relatorio, nao executavel.

---

### `_bmad-output/story-automator/orchestration-5-20260716-224123.md`

**Funcao geral do arquivo**

Log de orquestracao do workflow `bmad-story-automator` para o Epico 5, com estado da maquina (story atual, passos concluidos) e uma tabela de progresso por story/etapa.

**Funcao geral da alteracao**

Avanca o ponteiro de orquestracao de `currentStory: 5.1` para `5.2` (linha 7), atualiza `lastUpdated` (linha 10), marca a linha da Story 5.1 como totalmente `done` (incluindo `git-commit`) e a Story 5.2 com `create-story`/`dev-story`/`automate`/`code-review` concluidos e `git-commit` pendente (`in-progress`), e acrescenta 6 novas entradas de log cronologico (linhas 93-98) narrando o fechamento da 5.1 e todo o ciclo da 5.2 ate o code review.

**Blocos principais**

- Linhas 7-10: ponteiro de estado da orquestracao (story atual, timestamp).
- Linhas 54-58 (tabela): progresso por story/etapa — 5.1 = done em tudo; 5.2 = done ate `code-review`, `git-commit` ainda pendente (`-`), status geral `in-progress`.
- Linhas 93-98 (log append-only): eventos cronologicos, incluindo a contagem real de testes de cada etapa (dev-story: 428 backend + 591 frontend; automate: 7/7 E2E; code review: PASS com 1 MEDIUM auto-corrigido).

**Comportamento de libs usadas**

- N/A — log de orquestracao em Markdown/YAML de front matter, consumido pelo proprio workflow `bmad-story-automator` para retomada (resumable tmux orchestration).

---

## 2. Backend — camada de servico, contrato e view/url

### `backend/braindump/services.py`

**Funcao geral do arquivo**

Camada de servico do app `braindump`, concentrando as funcoes de acesso/regra de negocio sobre `BrainDumpItem` (`list_brain_dump_items`, `create_brain_dump_item`, `process_brain_dump_item`, `discard_brain_dump_item`), todas com assinatura fixa `*, user` (padrao arquitetural §6.2).

**Funcao geral da alteracao**

Adiciona uma nova funcao de leitura, `count_brain_dump_items`, seguindo o mesmo padrao das demais.

**Blocos principais**

- Linhas 24-25: `def count_brain_dump_items(*, user) -> int: return BrainDumpItem.objects.count()`.

**Funcoes, classes e importacoes especificas**

- `count_brain_dump_items(*, user)`: sem `@transaction.atomic` (e leitura, nao escrita, diferente de `create_brain_dump_item`). O parametro `user` e recebido por assinatura fixa mas nao usado diretamente no corpo — o isolamento por tenant vem do proprio manager.

**Comportamento de libs usadas**

- `BrainDumpItem.objects.count()`: `objects` e o manager auto-escopado por tenant (`TenantManager`, AD-12) — ja filtra implicitamente pelo `current_user_id` de um `contextvar` setado por `TenantAwareJWTAuthentication.authenticate()` a cada request. `.count()` do Django ORM executa um `SELECT COUNT(*)` no banco (nao traz linhas para a aplicacao), garantindo que a contagem nunca vaza entre usuarios pela mesma garantia que ja protege `list_brain_dump_items`.

---

### `backend/braindump/serializers.py`

**Funcao geral do arquivo**

Serializers DRF do app `braindump`: `BrainDumpItemSerializer` (ModelSerializer de leitura) e serializers planos de entrada (`BrainDumpItemCreateSerializer`, `BrainDumpItemProcessSerializer`).

**Funcao geral da alteracao**

Adiciona `BrainDumpCountSerializer`, um serializer plano de saida com um unico campo `count`.

**Blocos principais**

- Linhas 14-16: `class BrainDumpCountSerializer(serializers.Serializer): count = serializers.IntegerField()`.

**Funcoes, classes e importacoes especificas**

- `BrainDumpCountSerializer`: herda de `serializers.Serializer` (nao `ModelSerializer`) — mesmo padrao ja usado pelos outros dois serializers deste arquivo, porque a saida (`{"count": N}`) nao corresponde a um model diretamente.

**Comportamento de libs usadas**

- `rest_framework.serializers.IntegerField`: valida/serializa um inteiro; usado aqui so para a direcao de saida (o serializer e instanciado com um dict Python e `.data` e lido, nunca `.is_valid()`/`.save()`).

---

### `backend/braindump/views.py`

**Funcao geral do arquivo**

Views DRF (`APIView`) do app `braindump`: listagem/criacao, processamento e descarte de itens do Brain Dump.

**Funcao geral da alteracao**

Estende as tuplas de import de `serializers`/`services` com os novos simbolos e adiciona `BrainDumpCountView`, uma view somente-leitura para o endpoint de contagem.

**Blocos principais**

- Linhas 11 e 17: `BrainDumpCountSerializer` e `count_brain_dump_items` adicionados aos imports existentes (nenhuma linha de import nova, so extensao das tuplas).
- Linhas 83-89: nova classe `BrainDumpCountView(APIView)` com um metodo `get`.

**Funcoes, classes e importacoes especificas**

- `BrainDumpCountView.get(self, request)`: chama `count_brain_dump_items(user=request.user)` e retorna `Response(BrainDumpCountSerializer({"count": count}).data)`. Sem override de `permission_classes` — herda `IsAuthenticated` do `DEFAULT_PERMISSION_CLASSES` global (`backend/config/settings/base.py`), confirmado no code review da propria story.

**Comportamento de libs usadas**

- `drf_spectacular.utils.extend_schema(responses=BrainDumpCountSerializer)`: declara explicitamente o schema de resposta para o drf-spectacular gerar o OpenAPI corretamente — decisao deliberada da story para nao repetir o problema de "unable to guess serializer" que ocorreu nas views da Story 5.1 (registrado no proprio Debug Log da story).
- `rest_framework.response.Response`: encapsula o corpo serializado com o content-type/negociacao padrao do DRF.

---

### `backend/braindump/urls.py`

**Funcao geral do arquivo**

Roteamento de URLs do app `braindump`, montado sob o prefixo `api/brain-dump/`.

**Funcao geral da alteracao**

Importa `BrainDumpCountView` e registra a rota `count/`.

**Blocos principais**

- Linha 4: `BrainDumpCountView` adicionado ao import de `braindump.views`.
- Linha 18: `path("count/", BrainDumpCountView.as_view(), name="braindump-item-count")`.

**Funcoes, classes e importacoes especificas**

- Rota final: `GET /api/brain-dump/count/` — prefixo literal `count/` nao colide com `items/...`, entao a ordem de declaracao nao importa para o roteador do Django.

**Comportamento de libs usadas**

- `django.urls.path`: mapeamento direto path→view, sem parametros dinamicos nesta rota (diferente de `items/<uuid:item_id>/...` usada pelas outras views do mesmo arquivo).

---

## 3. Backend — testes

### `backend/braindump/tests/test_services.py`

**Funcao geral do arquivo**

Testes unitarios (pytest + `pytest.mark.django_db`) da camada de servico do app `braindump`.

**Funcao geral da alteracao**

Adiciona 3 testes novos para `count_brain_dump_items`, cobrindo caso vazio, contagem apos criar N itens, e isolamento por tenant.

**Blocos principais**

- Linhas 193-217: `test_count_brain_dump_items_vazio_para_usuario_novo` (retorna 0 sem itens), `test_count_brain_dump_items_conta_apos_criar_n_itens` (cria 3 via `BrainDumpItemFactory.create_batch`, espera `count == 3`), `test_count_brain_dump_items_escopado_por_tenant` (cria itens para `user` e `other_user` em `tenant_context` distintos, confirma que `count_brain_dump_items(user=other_user)` so conta os do `other_user`).

**Funcoes, classes e importacoes especificas**

- `count_brain_dump_items` importado da propria `braindump.services` (linha 7).

**Comportamento de libs usadas**

- `tenant_context(user)`: context manager (ja usado pelos testes existentes deste arquivo) que seta o `contextvar` de tenant corrente, simulando o efeito de `TenantAwareJWTAuthentication` fora do ciclo de request HTTP.
- `BrainDumpItemFactory.create_batch(N, user=...)`: factory Factory Boy que cria N instancias persistidas no banco de teste.

---

### `backend/braindump/tests/test_serializers.py`

**Funcao geral do arquivo**

Testes unitarios dos serializers do app `braindump`.

**Funcao geral da alteracao**

Adiciona um teste trivial de paridade de cobertura por camada (§6.2) para `BrainDumpCountSerializer`.

**Blocos principais**

- Linhas 102-103: `test_brain_dump_count_serializer_expoe_count` — `assert BrainDumpCountSerializer({"count": 3}).data == {"count": 3}`.

**Funcoes, classes e importacoes especificas**

- `BrainDumpCountSerializer` importado (linha 11) ao lado dos demais serializers do modulo.

**Comportamento de libs usadas**

- N/A alem do proprio DRF (`.data`), ja coberto na secao do serializer.

---

### `backend/braindump/tests/test_views.py`

**Funcao geral do arquivo**

Testes de integracao (fim-a-fim via `APIClient`) das views do app `braindump`.

**Funcao geral da alteracao**

Adiciona 3 testes para `GET /api/brain-dump/count/`: contagem zero, contagem com N itens, e isolamento entre tenants no nivel HTTP.

**Blocos principais**

- Linhas 193-198: `test_get_count_vazio_retorna_200_com_count_zero` — sem itens, `200` com `{"count": 0}`.
- Linhas 201-208: `test_get_count_com_n_itens_retorna_200_com_count_n` — cria 3 itens via factory dentro de `tenant_context(user)`, espera `{"count": 3}`.
- Linhas 211-226: `test_get_count_isolamento_itens_de_outro_tenant_nao_afetam_a_contagem` — cria 1 item para `user` e 2 para `other_user`, confirma que a resposta do `auth_client` (autenticado como `user`) e `{"count": 1}`.

**Funcoes, classes e importacoes especificas**

- Fixture `auth_client` (ja existente no arquivo/conftest): `APIClient` pre-autenticado como o usuario de teste padrao.

**Comportamento de libs usadas**

- `rest_framework.test.APIClient` (via fixture): dispara requests HTTP reais contra as views do Django, exercitando roteamento + autenticacao + serializer de ponta a ponta.

---

## 4. Contrato de API gerado

### `schema.yaml`

**Funcao geral do arquivo**

Especificacao OpenAPI gerada automaticamente por `drf-spectacular` (`manage.py spectacular`) a partir das views/serializers do backend — fonte de verdade para a geracao de tipos do frontend.

**Funcao geral da alteracao**

Arquivo gerado; regenerado apos a Task 3/adicao da `BrainDumpCountView`. Acrescenta o path `/api/brain-dump/count/` e o schema `BrainDumpCount`.

**Blocos principais**

- Linhas 60-73: novo path `/api/brain-dump/count/`, metodo `get`, `operationId: brain_dump_count_retrieve`, tag `brain-dump`, `security: [jwtAuth]` (confirma que o endpoint exige autenticacao, nao ficou acidentalmente publico), resposta `200` referenciando `#/components/schemas/BrainDumpCount`.
- Linhas 639-645: novo schema `BrainDumpCount` — `type: object`, propriedade `count: integer`, `required: [count]`.

**Funcao/papel do arquivo em relacao aos demais**

- Arquivo gerado (nao editado manualmente); consumido em seguida por `npm run generate-types` para produzir `frontend/src/api/types.gen.ts`. Nenhuma outra parte do schema (endpoints/`security` existentes) foi alterada — mudanca estritamente aditiva.

---

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados automaticamente (openapi-typescript ou equivalente) a partir de `schema.yaml` — contrato tipado consumido por toda a camada de dados do frontend.

**Funcao geral da alteracao**

Arquivo gerado; acrescenta a entrada de path `/api/brain-dump/count/` em `paths`, o tipo `BrainDumpCount` em `components.schemas`, e a operacao `brain_dump_count_retrieve` em `operations`.

**Blocos principais**

- Linhas 63-78: entrada `paths["/api/brain-dump/count/"]` — so `get`, demais metodos (`put`/`post`/`delete`/etc.) marcados `never`.
- Linhas 459-461: `components.schemas.BrainDumpCount = { count: number }`.
- Linhas 812-830: `operations.brain_dump_count_retrieve` — sem parametros/`requestBody`, resposta `200` tipada como `components["schemas"]["BrainDumpCount"]`.

**Funcao/papel do arquivo em relacao aos demais**

- Consumido por `frontend/src/features/braindump/types.ts` (`export type BrainDumpCount = components['schemas']['BrainDumpCount']`), que por sua vez alimenta `api.ts` e `BrainDumpBadge.tsx`. Nenhuma edicao manual — regenerado via `npm run generate-types` e comparado byte-a-byte contra o schema no code review.

---

## 5. Frontend — infraestrutura de identidade do usuario (`userId` via JWT)

### `frontend/src/features/auth/tokenStorage.ts`

**Funcao geral do arquivo**

Funcoes puras de armazenamento de tokens JWT em `localStorage` (`getAccessToken`, `getRefreshToken`, `setTokens`, `clearTokens`).

**Funcao geral da alteracao**

Adiciona `getCurrentUserId`, a primeira funcao do arquivo que decodifica (nao so armazena) o conteudo de um token.

**Blocos principais**

- Linhas 16-30: `export function getCurrentUserId(): string | null` — le o access token via `getAccessToken()`; se ausente, retorna `null`; senao, extrai a 2ª parte do JWT (`token.split('.')[1]`), normaliza base64url para base64 padrao (`replace(/-/g,'+').replace(/_/g,'/')`), decodifica com `atob`, faz `JSON.parse` e retorna o campo `user_id` (ou `null` se ausente); qualquer excecao no bloco `try` (payload malformado, JSON invalido) e capturada e tambem retorna `null`.

**Funcoes, classes e importacoes especificas**

- `getCurrentUserId()`: nao verifica assinatura do JWT — decisao deliberada e documentada em comentario (linhas 16-19): a autoridade de acesso e 100% do backend via `TenantAwareJWTAuthentication`; o decode no cliente serve so para namespacing de cache (chave de query), nao para controle de acesso.

**Comportamento de libs usadas**

- `atob` (Web API nativa): decodifica uma string base64 para binario/texto; usado aqui sem lib externa (`jwt-decode` nao e dependencia do projeto, conforme Dev Notes da story) — unica forma de decode e via API nativa do browser.
- `JSON.parse`: usado dentro do `try/catch` — se o payload decodificado nao for JSON valido, lanca e cai no `catch`, retornando `null` em vez de propagar a excecao.

---

### `frontend/src/features/auth/tokenStorage.test.ts`

**Funcao geral do arquivo**

Testes unitarios (Vitest) de `tokenStorage.ts`.

**Funcao geral da alteracao**

Adiciona o `describe('getCurrentUserId')` com 4 casos.

**Blocos principais**

- Linhas 66-92: sem token → `null`; token JWT valido (payload montado com `btoa(JSON.stringify({ user_id: 'uuid-fake' }))`) → retorna `'uuid-fake'`; token malformado sem pontos → `null` (nao lanca); payload que nao e JSON valido (`btoa('isto nao e json')`) → `null`.

**Comportamento de libs usadas**

- `btoa` (nativo): usado nos proprios testes para montar tokens JWT fake, espelhando o `atob` usado pela implementacao.

---

### `frontend/src/app/providers/AuthContext.ts`

**Funcao geral do arquivo**

Definicao do tipo `AuthState` e do `React.Context` de autenticacao, consumido via `useAuth()`.

**Funcao geral da alteracao**

Estende a interface `AuthState` com o campo `userId: string | null` (linha 7), tornando-o obrigatorio em qualquer objeto que implemente `AuthState` — e a raiz da quebra em cascata que atingiu 4 arquivos de teste que constroem `AuthState`-shaped mocks a mao (ver secao 8).

**Blocos principais**

- Linha 7: `userId: string | null` adicionado a `AuthState`.

**Funcoes, classes e importacoes especificas**

- `AuthState`: agora `{ isAuthenticated, sessionExpired, userId, login, logout }`.

---

### `frontend/src/app/providers/AuthProvider.tsx`

**Funcao geral do arquivo**

Provider React que implementa `AuthState`, gerenciando `isAuthenticated`/`sessionExpired`/login/logout e sincronizacao entre abas via evento `storage`.

**Funcao geral da alteracao**

Adiciona o estado `userId`, inicializado e atualizado nos mesmos 3 pontos que ja tocam `isAuthenticated` (mount, `login`, `logout`, listener de `storage`).

**Blocos principais**

- Linha 4-9: import de `getCurrentUserId` adicionado ao lado das demais funcoes de `tokenStorage`.
- Linha 16: `const [userId, setUserId] = useState(() => getCurrentUserId())` — inicializacao lazy, mesma tecnica de `isAuthenticated`.
- Linhas 19-24 (`logout`): `setUserId(null)` adicionado.
- Linhas 26-31 (`login`): `setUserId(getCurrentUserId())` adicionado — redecodifica o token recem-salvo.
- Linha 45 (listener de `storage`, disparado quando outra aba remove o `access_token`): `setUserId(null)` adicionado.
- Linha 53: `userId` incluido no valor do `AuthContext.Provider`.

**Funcoes, classes e importacoes especificas**

- `AuthProvider`: nenhuma mudanca na assinatura publica do componente; apenas o valor exposto via contexto cresce um campo.

**Comportamento de libs usadas**

- Nenhuma lib nova; reaproveita `useState`/`useCallback`/`useEffect` ja usados no arquivo.

---

### `frontend/src/app/providers/AuthProvider.test.tsx`

**Funcao geral do arquivo**

Testes do `AuthProvider` via um `TestConsumer` que le o contexto e expoe seus campos em elementos com `data-testid`.

**Funcao geral da alteracao**

Adiciona `getCurrentUserId` ao mock de `tokenStorage` (sem o qual `AuthProvider.tsx` chamaria uma funcao `undefined` e o describe inteiro quebraria — risco explicitamente documentado na propria story), adiciona um `<span data-testid="user-id">` ao `TestConsumer`, e acrescenta 3 casos novos mais 1 caso existente estendido.

**Blocos principais**

- Linhas 6-11: mock de `tokenStorage` ganha `getCurrentUserId: vi.fn(() => null)`.
- Linha 37: `TestConsumer` ganha `<span data-testid="user-id">{String(auth.userId)}</span>`.
- Linhas 121-137: novo teste — token existente + `getCurrentUserId` mockado retornando `'user-abc'` → `userId` reflete no contexto.
- Linhas 139-157: novo teste — `login()` chama `getCurrentUserId()` de novo (mock trocado de `null` para `'user-novo'` entre o render e o clique) e o `userId` exibido atualiza.
- Linhas 159-175: novo teste — `logout()` reseta `userId` para `null`.
- Linhas 183-208: teste existente de evento `storage` estendido para tambem afirmar `userId` resetado para `null` apos o evento.

**Comportamento de libs usadas**

- `vi.mocked(...).mockReturnValue(...)`: usado para trocar o retorno de `getCurrentUserId` entre estagios do mesmo teste, simulando o token mudar entre `login()`/`logout()`.

---

## 6. Frontend — data layer do Brain Dump (query de contagem + otimismo)

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Factory central de `queryKey`s do TanStack Query, no padrao fixo `[escopo, entidade, discriminador, params?]` (§6.5).

**Funcao geral da alteracao**

So o comentario acima do bloco `bujo` (linhas 10-13) foi atualizado — nenhuma chave nova nem alterada. O comentario antigo dizia que "nao ha hoje nenhum acessor de userId no frontend"; o novo texto reconhece que `useAuth().userId` ja existe desde a Story 5.2, mas justifica (YAGNI) por que as chaves `bujo.*` continuam deliberadamente sem `userId`.

**Blocos principais**

- Linhas 10-13: comentario reescrito; `keys.brainDump.count`/`keys.brainDump.list` (linhas 6-8, ja existentes desde a Story 5.1) permanecem inalterados nesta story — apenas passam a ser efetivamente consumidos.

**Funcao/papel do arquivo em relacao aos demais**

- `keys.brainDump.count(userId)` e a chave usada por `useBrainDumpCountQuery` e por todas as invalidacoes de contagem em `api.ts`.

---

### `frontend/src/features/braindump/types.ts`

**Funcao geral do arquivo**

Reexporta tipos do contrato gerado (`components['schemas'][...]`) com nomes de dominio para o feature `braindump`.

**Funcao geral da alteracao**

Adiciona `BrainDumpCount`.

**Blocos principais**

- Linha 5: `export type BrainDumpCount = components['schemas']['BrainDumpCount']`.

---

### `frontend/src/features/braindump/api.ts`

**Funcao geral do arquivo**

Data layer (hooks TanStack Query) do feature `braindump`: `useBrainDumpItemsQuery` e as mutacoes `useCreateBrainDumpItemMutation`/`useProcessBrainDumpItemMutation`/`useDiscardBrainDumpItemMutation`.

**Funcao geral da alteracao**

Adiciona a query de contagem (`useBrainDumpCountQuery`) e passa a invalidar/atualizar essa contagem nas 3 mutacoes existentes — a de captura via `useOptimisticMutation` (incremento otimista + rollback), as outras duas via invalidacao simples adicional.

**Blocos principais**

- Linhas 4-5: novos imports — `useAuth` de `'../auth'` (so o barrel, respeitando a fronteira de ESLint entre features) e `useOptimisticMutation` de `'../../shared/hooks/useOptimisticMutation'`.
- Linhas 17-28: `fetchBrainDumpCount` (GET simples) e `useBrainDumpCountQuery()` — le `userId` de `useAuth()`, usa `queryKey: keys.brainDump.count(userId ?? '')`, e `enabled: !!userId` (a query so dispara com um `userId` valido).
- Linhas 43-53: `useCreateBrainDumpItemMutation` migrada de `useMutation` para `useOptimisticMutation`, com `updater: (current) => ({ count: (current?.count ?? 0) + 1 })` e `mutationOptions.onSuccess` preservando a invalidacao original de `brainDump.list()`.
- Linhas 68-77 (`useProcessBrainDumpItemMutation`): `const { userId } = useAuth()` adicionado; `onSuccess` ganha `queryClient.invalidateQueries({ queryKey: keys.brainDump.count(userId ?? '') })` ao lado das invalidacoes ja existentes (`brainDump.list`, `dailyLog`, `weeklyLog`, `monthlyLog`, `taskDensity`).
- Linhas 96-103 (`useDiscardBrainDumpItemMutation`): mesma adicao — `userId` + invalidacao de `brainDump.count` ao lado de `brainDump.list`.

**Funcoes, classes e importacoes especificas**

- `useBrainDumpCountQuery`: nao recebe argumentos; deriva `userId` internamente via `useAuth()`. `enabled: !!userId` evita disparar a query antes do `AuthProvider` ter um `userId` resolvido (nao deveria ocorrer no caminho normal, ja que `AppLayout` so monta autenticado, mas e uma guarda defensiva).
- `useCreateBrainDumpItemMutation`: assinatura publica inalterada — continua retornando o mesmo formato de objeto de `useMutation` (o consumidor `BrainDumpPage.tsx` nao precisa mudar), porque `useOptimisticMutation` e um wrapper fino sobre `useMutation`.

**Comportamento de libs usadas**

- `useOptimisticMutation` (`frontend/src/shared/hooks/useOptimisticMutation.ts`, nao modificado nesta story mas central ao comportamento novo): wrapper sobre `useMutation` do TanStack Query. No `onMutate`, cancela queries em voo para a `queryKey` (`qc.cancelQueries`), tira um snapshot do valor atual (`qc.getQueryData`), aplica `updater(old, variables)` otimisticamente (`qc.setQueryData`) e retorna o snapshot como contexto; no `onError`, restaura o snapshot (`qc.setQueryData(queryKey, context.snapshot)`); no `onSettled` (sempre, sucesso ou erro), invalida a `queryKey` para reconciliar com o servidor. `mutationOptions` e tipado com `Omit<..., 'mutationFn'|'onMutate'|'onError'|'onSettled'>` — ou seja, so pode adicionar callbacks que o helper nao ja controla (aqui, `onSuccess` para a invalidacao extra de `brainDump.list()`).
- `useQuery`/`useQueryClient` (`@tanstack/react-query`): comportamento padrao — `useQuery` cacheia por `queryKey` e reexecuta `queryFn` conforme staleness/`refetchOnWindowFocus` (ja ligado globalmente em `queryClient.ts`); `invalidateQueries({ queryKey })` marca as queries daquela chave como stale e as reexecuta se houver observadores montados.

---

### `frontend/src/features/braindump/api.test.tsx`

**Funcao geral do arquivo**

Testes unitarios da data layer do Brain Dump, com `client.get/post/delete` mockados e um `QueryClientProvider` real por teste.

**Funcao geral da alteracao**

Adiciona o mock de `'../auth'` (necessario porque `api.ts` agora importa `useAuth`), um novo `describe('useBrainDumpCountQuery')`, e estende os describes das 3 mutacoes com asserções de contagem/otimismo/rollback.

**Blocos principais**

- Linhas 10-19: `vi.mock('../auth', () => ({ useAuth: () => ({ userId: 'user-1', ... }) }))` — sem este mock o teste quebraria, pois `api.ts` chamaria o `useAuth` real (que depende de `AuthContext`/`AuthProvider` nao presentes no wrapper de teste).
- Linhas 75-91: `describe('useBrainDumpCountQuery')` — busca `/api/brain-dump/count/`, confirma `queryKey` correta (`keys.brainDump.count('user-1')`) e o dado retornado.
- Linhas 106-113: teste existente de criacao estendido para tambem afirmar `invalidateSpy` chamado com `keys.brainDump.count('user-1')`.
- Linhas 115-135: novo teste — incremento otimista sincrono: preenche o cache com `{ count: 1 }`, mantem a Promise do POST pendente (`resolvePost` guardado), dispara `mutate`, e afirma que o cache ja mostra `{ count: 2 }` **antes** de resolver a Promise do servidor.
- Linhas 137-147: novo teste — rollback: preenche `{ count: 1 }`, mocka o POST para rejeitar, dispara `mutate`, espera `isError` e confirma que o cache volta a `{ count: 1 }`.
- Linhas 173, 199, 211: asserções adicionais de `invalidateSpy` para `keys.brainDump.count('user-1')` nos testes existentes de `useProcessBrainDumpItemMutation`/`useDiscardBrainDumpItemMutation`.

**Comportamento de libs usadas**

- `vi.spyOn(qc, 'invalidateQueries')`: espiona o `QueryClient` real do teste para confirmar quais `queryKey`s foram invalidadas, sem mockar o `QueryClient` inteiro.

---

### `frontend/src/features/braindump/index.ts`

**Funcao geral do arquivo**

Barrel publico do feature `braindump` — unico ponto de import permitido para outras partes do app (fronteira de ESLint).

**Funcao geral da alteracao**

Exporta `useBrainDumpCountQuery`, o componente `BrainDumpBadge` e o tipo `BrainDumpCount`.

**Blocos principais**

- Linha 3: `useBrainDumpCountQuery` adicionado a lista de hooks reexportados.
- Linha 8: `export { BrainDumpBadge } from './components/BrainDumpBadge'`.
- Linha 9: `BrainDumpCount` adicionado aos tipos reexportados.

**Funcao/papel do arquivo em relacao aos demais**

- E por este barrel que `Sidebar.tsx`/`BottomNav.tsx` importam `BrainDumpBadge` (`'../../features/braindump'`), respeitando a regra de fronteira que proibe import por subpath direto.

---

## 7. Frontend — componente `BrainDumpBadge`

### `frontend/src/features/braindump/components/BrainDumpBadge.tsx`

**Funcao geral do arquivo**

Arquivo novo (untracked). Componente de apresentacao reutilizavel que envolve um icone filho com um `Badge` numerico.

**Funcao geral da alteracao**

Primeiro uso do componente `Badge` do MUI em todo o codebase (confirmado na propria story via busca no repo).

**Blocos principais**

- Linhas 1-6: imports (`Badge` de `@mui/material`, `useBrainDumpCountQuery` de `'../api'`) e a interface `BrainDumpBadgeProps { children: React.ReactNode }`.
- Linhas 8-18: `export function BrainDumpBadge({ children })` — le `data` de `useBrainDumpCountQuery()`, deriva `count = data?.count ?? 0` e um `label` em pt-BR com singular/plural correto (`"item pendente"` vs `"itens pendentes"`), e renderiza `<Badge badgeContent={count} invisible={count === 0} color="primary" aria-label={label}>{children}</Badge>`.

**Funcoes, classes e importacoes especificas**

- `BrainDumpBadge`: componente puro de apresentacao — nao recebe `count` por prop, busca-o internamente via TanStack Query (garante que qualquer ponto de uso, sidebar ou FAB, exiba sempre o mesmo server state sem prop drilling).
- `invisible={count === 0}`: mantem o `Badge` montado (e a query ativa) mesmo quando a contagem e zero, so ocultando visualmente — cobre "desaparece quando a caixa esta vazia" (AC #1) sem desmontar/remontar a query.

**Comportamento de libs usadas**

- `@mui/material Badge`: componente que sobrepoe um indicador (numero/ponto) num canto do elemento filho; prop `badgeContent` define o conteudo exibido, `invisible` oculta via CSS (classe `MuiBadge-invisible`) sem remover do DOM — e exatamente essa classe que os testes (unitarios e E2E) usam para verificar "sumiu", ja que o MUI congela o ultimo digito exibido durante a transicao de saida (documentado no proprio codigo/testes).

---

### `frontend/src/features/braindump/components/BrainDumpBadge.test.tsx`

**Funcao geral do arquivo**

Arquivo novo (untracked). Testes unitarios do `BrainDumpBadge`, com `client.get` mockado, `useAuth` mockado e um `QueryClientProvider` real.

**Blocos principais**

- Linhas 6-18: mocks de `'../../../api/client'` e `'../../auth'` (`userId: 'user-1'`).
- Linhas 25-35: helper `renderBadge(count)` — mocka a resposta do GET com `{ count }` e renderiza o componente dentro de um `QueryClientProvider` novo.
- Linhas 42-48: teste — `count === 0` → `.MuiBadge-invisible` presente.
- Linhas 50-55: teste — `count > 0` (3) → texto `'3'` visivel e sem a classe `invisible`.
- Linhas 57-63: teste — `aria-label` contem a contagem atual (`getByLabelText('Brain Dump: 3 itens pendentes')`).
- Linhas 65-70: teste — sem violacoes de acessibilidade via `jest-axe`.

**Comportamento de libs usadas**

- `jest-axe` (`axe(container)` / `toHaveNoViolations()`): roda uma auditoria de acessibilidade (regras axe-core) sobre a arvore renderizada e falha o teste se houver violacoes (contraste, nomes ausentes, roles invalidos etc.) — nao acusa "nomes verbosos", por isso nao pega o risco de accname documentado na story (ver arquivo da story, Task 8.1/Debug Log).

---

## 8. Frontend — composicao na Sidebar e no BottomNav

### `frontend/src/app/layout/Sidebar.tsx`

**Funcao geral do arquivo**

Navegacao lateral (desktop/tablet), com itens de navegacao definidos em arrays (`healthItems`, `bottomItems`, etc.) e renderizados via `renderItem`.

**Funcao geral da alteracao**

Importa `BrainDumpBadge` do barrel de `features/braindump` e envolve o icone do item "Brain Dump" com ele.

**Blocos principais**

- Linha 35: `import { BrainDumpBadge } from '../../features/braindump'`.
- Linha 70: `{ label: 'Brain Dump', path: '/brain-dump', icon: <BrainDumpBadge><InboxIcon /></BrainDumpBadge> }` (era `icon: <InboxIcon />`).

**Funcoes, classes e importacoes especificas**

- Nenhuma mudanca estrutural em `renderItem`/no componente `Sidebar` em si — `bottomItems` continua um array de descricoes de elemento React; a troca e so no valor do campo `icon`. Como `renderItem` ja renderiza `item.icon` dentro de `ListItemIcon` independente do estado `collapsed` (so o `ListItemText` some quando colapsada), o badge fica visivel mesmo com a sidebar colapsada — cobrindo essa parte da AC #1 sem esforco extra.

---

### `frontend/src/app/layout/BottomNav.tsx`

**Funcao geral do arquivo**

Navegacao inferior mobile, com tabs de rota e um FAB central (ainda `disabled` — a captura de verdade e da Story 5.3).

**Funcao geral da alteracao**

Importa `BrainDumpBadge` e envolve o `AddIcon` dentro do `Fab` com ele.

**Blocos principais**

- Linha 10: `import { BrainDumpBadge } from '../../features/braindump'`.
- Linhas 66-68: `<Fab ... disabled ...><BrainDumpBadge><AddIcon /></BrainDumpBadge></Fab>` (era so `<AddIcon />`).

**Funcoes, classes e importacoes especificas**

- O `Fab` mantem seu proprio `aria-label="Captura rápida (em breve)"` explicito (nao alterado nesta story) — por isso o nome acessivel do botao nao deriva do conteudo, e o `aria-label` do `Badge` interno nao "vaza" para o nome do botao pai (diferente do que ocorre na Sidebar, onde o `ListItemButton` deriva o nome do conteudo — risco confirmado no Debug Log da story, nao corrigido por ser nao-bloqueante).

---

### `frontend/src/app/layout/Sidebar.test.tsx`

**Funcao geral do arquivo**

Testes do componente `Sidebar` (render dentro de `MemoryRouter`).

**Funcao geral da alteracao**

Adiciona um mock de `'../../features/braindump'` que substitui `BrainDumpBadge` por um passthrough (`({ children }) => children`) — necessario porque o `Sidebar` real agora usa `BrainDumpBadge`, que depende de TanStack Query, e o arquivo de teste nao envolve o render num `QueryClientProvider`.

**Blocos principais**

- Linhas 6-9: `vi.mock('../../features/braindump', () => ({ BrainDumpBadge: ({ children }) => children }))`.

**Funcao/papel da mudanca**

- Mock puramente estrutural — devolve so os `children`, preservando o texto/estrutura dos demais itens de navegacao, entao nenhuma asserção existente precisou mudar.

---

### `frontend/src/app/layout/BottomNav.test.tsx`

**Funcao geral do arquivo**

Testes do componente `BottomNav`.

**Funcao geral da alteracao**

Mesmo ajuste do `Sidebar.test.tsx` — mock de `'../../features/braindump'` com passthrough.

**Blocos principais**

- Linhas 6-9: mesmo bloco de mock.

**Funcao/papel da mudanca**

- O teste existente que verifica o FAB presente e desabilitado continua passando sem alteracao, ja que o `aria-label` do `Fab` e proprio, nao depende do conteudo/badge interno.

---

## 9. Frontend — testes de terceiros afetados por efeito cascata

Estes 5 arquivos nao fazem parte do escopo funcional direto da story, mas quebraram como consequencia das mudancas em `AuthContext`/`Sidebar`/`BottomNav` e foram corrigidos na mesma leva (registrado no Debug Log da story como "gap nao previsto pelo Dev Notes").

### `frontend/src/app/layout/AppLayout.test.tsx`

**Funcao geral do arquivo**

Testes do `AppLayout`, que compoe `Sidebar`/`BottomNav` conforme o breakpoint (`useMediaQuery`).

**Funcao geral da alteracao**

Adiciona `userId: 'user-1'` ao mock de `useAuth` (linha 11, exigido pela nova obrigatoriedade do campo em `AuthState`) e um mock de `'../../features/braindump'` com passthrough (linhas 15-17) — sem ele, o render real de `Sidebar`/`BottomNav` (que `AppLayout` monta de verdade) quebraria por falta de `QueryClientProvider`.

**Blocos principais**

- Linha 11: `userId: 'user-1'` no objeto mockado de `useAuth`.
- Linhas 15-17: `vi.mock('../../features/braindump', () => ({ BrainDumpBadge: ({ children }) => children }))`.

---

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testes do anunciador de rota (acessibilidade), que renderiza o `router` completo (portanto `AppLayout`/`Sidebar`/`BottomNav` reais).

**Funcao geral da alteracao**

Mesmo padrao — mock de `'../../features/braindump'` (linhas 39-43, com comentario explicito remetendo ao mock ja existente de `TaskDetailPanel` por analogia) e `userId: null` adicionado ao objeto `mockAuthBase` (linha 55).

**Blocos principais**

- Linhas 39-43: novo `vi.mock`.
- Linha 55: `mockAuthBase = { sessionExpired: false, userId: null, login: vi.fn(), logout: vi.fn() }`.

---

### `frontend/src/app/router.test.tsx`

**Funcao geral do arquivo**

Testes do roteador da aplicacao (rotas protegidas/publicas).

**Funcao geral da alteracao**

Mesmo padrao: mock de `'../features/braindump'` (linhas 42-46) e `userId: null` em `mockAuthBase` (linha 58).

**Blocos principais**

- Linhas 42-46: `vi.mock('../features/braindump', () => ({ BrainDumpBadge: ({ children }) => children }))`.
- Linha 58: `mockAuthBase` estendido com `userId: null`.

---

### `frontend/src/features/auth/components/LoginPage.test.tsx`

**Funcao geral do arquivo**

Testes da pagina de login, com um objeto `mockAuth` construido diretamente (nao via mock de `tokenStorage`).

**Funcao geral da alteracao**

Adiciona `userId: null` ao objeto `mockAuth` — mudanca puramente mecanica exigida pelo TypeScript apos `AuthState` ganhar o campo obrigatorio.

**Blocos principais**

- Linhas 19-25: `mockAuth` reformatado como objeto multilinha incluindo `userId: null`.

---

### `frontend/src/features/auth/components/SignupPage.test.tsx`

**Funcao geral do arquivo**

Testes da pagina de cadastro, mesmo padrao de `mockAuth` do `LoginPage.test.tsx`.

**Funcao geral da alteracao**

Identica a anterior — `userId: null` adicionado ao `mockAuth`.

**Blocos principais**

- Linhas 20-26: `mockAuth` com `userId: null`.

---

## 10. E2E — cobertura de regressao permanente

### `frontend/e2e/fixtures.ts`

**Funcao geral do arquivo**

Fixtures compartilhadas do Playwright para os specs E2E do projeto — define a fixture `page`, que automaticamente cria um usuario novo via signup real na UI antes de cada teste (isolamento entre testes).

**Funcao geral da alteracao**

Promove `signUpAndLandOnToday` de funcao privada do modulo a funcao exportada, sem alterar seu corpo.

**Blocos principais**

- Linha 5: `async function signUpAndLandOnToday(page: Page)` → `export async function signUpAndLandOnToday(page: Page)`.

**Funcao/papel do arquivo em relacao aos demais**

- Consumida diretamente por `brain-dump.spec.ts` no teste de isolamento entre usuarios, que precisa criar um segundo usuario dentro de um `browser.newContext()` proprio (fora da fixture `page` padrao). Esta foi a mudanca sinalizada como MEDIUM no code review por estar ausente do File List original da story — corrigida so na documentacao (File List), sem mudanca de codigo adicional.

---

### `frontend/e2e/brain-dump.spec.ts`

**Funcao geral do arquivo**

Suite E2E (Playwright, browser real) do Brain Dump, rodando contra backend+frontend reais (`config.settings.e2e`), cobertura de regressao permanente desde a Story 5.1.

**Funcao geral da alteracao**

Import estendido para trazer `signUpAndLandOnToday` (linha 1); acrescenta 3 testes novos: badge na sidebar (captura → "1" → descarte → some), um `test.describe` com viewport mobile para o badge no FAB, e um teste de isolamento de cache entre dois usuarios em `browser.newContext()`s distintos.

**Blocos principais**

- Linhas 73-97: `test('capturar um item mostra o badge "1" na sidebar; descartar o item faz o badge sumir (AC1, AC2)')` — localiza o botao "Brain Dump" da navegacao, deriva `badgeCounter` via `.locator('.MuiBadge-badge')`, confirma `MuiBadge-invisible` antes da captura, captura um item, confirma o texto `'1'` visivel e a classe `invisible` removida, descarta o item via botao "Descartar" na linha do item, e confirma que a classe `invisible` volta.
- Linhas 99-127: `test.describe('badge no FAB mobile')` com `test.use({ viewport: { width: 390, height: 844 } })` — forca o layout mobile (`BottomNav`/`Fab` em vez de `Sidebar`, via `useMediaQuery` de `AppLayout.tsx`); o teste captura um item diretamente em `/brain-dump` (navegado por URL, ja que o `BottomNav` nao tem item de navegacao para o Brain Dump), confirma o badge do FAB mostrando `'1'`, depois navega para `/today` e confirma que o badge continua `'1'` — provando que e server state global (TanStack Query), nao estado local ao componente.
- Linhas 129-157: `test('dois usuarios em navegadores distintos têm badges isolados...')` — usuario A (fixture `page` padrao) captura um item e confirma badge `'1'`; `browser.newContext()` cria um segundo contexto isolado (cookies/localStorage proprios), `signUpAndLandOnToday(pageB)` cria um segundo usuario real via UI; confirma que o badge do usuario B nasce invisivel e a lista do Brain Dump aparece vazia (`'Brain Dump vazio.'`), e que o item do usuario A nunca aparece para B; fecha o contexto B ao final.

**Funcoes, classes e importacoes especificas**

- `signUpAndLandOnToday` (importado de `./fixtures`): reaproveitado para criar o segundo usuario do teste de isolamento, fora da fixture `page` automatica.

**Comportamento de libs usadas**

- `browser.newContext()` (Playwright): cria um contexto de navegador completamente isolado (cookies, localStorage, sessionStorage proprios) dentro do mesmo processo de browser — usado aqui para simular "dois usuarios em navegadores distintos" sem precisar de dois processos de browser separados.
- `.locator('.MuiBadge-badge')` / `toHaveClass(/MuiBadge-invisible/)`: os testes verificam "o badge sumiu" pela presenca/ausencia da classe CSS `MuiBadge-invisible`, nao pela ausencia do texto do digito no DOM — porque o MUI `Badge` congela visualmente o ultimo `badgeContent` exibido durante a transicao de saida (documentado em comentario no proprio spec).

---

## Observacoes finais

- Nenhum arquivo de codigo-fonte foi modificado durante a producao deste relatorio; nenhum teste foi executado.
- O escopo cobrido corresponde integralmente a saida de `git status --short` no momento da analise: 32 arquivos modificados + 3 arquivos novos (a story em si, o componente `BrainDumpBadge` e seu teste).
- O arquivo do proprio relatorio (este) nao foi incluido na analise, conforme a regra padrao da skill.
