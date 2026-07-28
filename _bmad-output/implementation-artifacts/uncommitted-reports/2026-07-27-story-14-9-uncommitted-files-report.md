# Explicacao dos arquivos nao commitados - Story 14.9 (Epico 14, M10) — Migracao/Catch-Up como ritual no shell

## Visao geral

Este conjunto de mudancas fecha a Story 14.9 do Epico 14 (Onda 3 — Nucleo BuJo no sistema novo): substitui os dois banners legados do Daily (`MigrationBanner` + `CatchUpBanner`, cada um abrindo seu proprio `Dialog`) por um **banner unico** (`MigrationRitualBanner`) alimentado pela fila unificada de migracao (`unified_migration_queue`, ja pronta no backend desde a Story 14.3 mas sem consumidor de frontend ate agora), e por um **ritual roteado dentro do shell** (`/migration`, `MigrationRitualPage`) que reusa a anatomia rail-de-fontes + lista-de-decisao + rail-de-contexto ja estabelecida pelo planejamento Weekly/Monthly (Stories 14.5/14.6). O ritual nunca usa `Dialog` nem overlay full-screen — decisao fechada do mockup `key-migracao.html`. A unica mutacao de escrita para qualquer decisao (migrar hoje/semana/mes/futuro/cancelar) continua sendo `POST /api/bujo/tasks/{id}/migrate/` via `useMigrateTaskMutation`, o mesmo verbo que o fluxo legado ja usava — nenhum endpoint novo, nenhuma migration, nenhum schema novo no backend. O seletor de destino do Monthly (`MonthlyDestinationPicker`) foi promovido a um componente compartilhado (`DestinationPicker`) com 3 abas (Esta semana / Dia no mes / Outro mes) mais os atalhos "Hoje" e "Sem dia definido" do mockup. Os arquivos legados (`MigrationBanner.tsx`, `CatchUpBanner.tsx`, `MigrationFlow.tsx`, `MigrationCard.tsx`, `CatchUpFlow.tsx`) permanecem intocados no repo — so foram desmontados de `DailyPage.tsx`, mesmo padrao de rollback-por-arquivo das stories 14.5-14.8. Os dois specs E2E legados (`migration-flow.spec.ts`, `unified-migration-queue.spec.ts`) foram atualizados para exercitar a nova superficie (banner + ritual roteado) mantendo a mesma tese de cada teste (matematica da fila, herança de status, migracao de pai/filho etc.), e um novo spec (`migration-ritual.spec.ts`) cobre o ritual ponta-a-ponta incluindo pausar/retomar, resumo factual, offline e 5 faixas de axe-core.

## Ordem logica de funcionamento

1. Artefatos de planejamento/contexto da story (spec 14.9 + contexto do epico 14).
2. Chave de query nova (`keys.ts`) e tipos gerados consumidos (`types.ts`) para a fila unificada.
3. Hook de leitura (`useUnifiedMigrationQueueQuery`) e extensao da invalidacao da mutacao existente (`api.ts`), reexportados via `index.ts`.
4. Roteamento/shell: nova rota `migration` (`router.tsx`) e sua entrada no registro do shell (`shellRouting.ts`), com os testes que travam o contrato.
5. Logica pura das "fontes" do ritual (`migrationRitualSources.ts`) — base compartilhada por todos os componentes de UI.
6. Componentes de UI do ritual: rail de fontes, lista de decisao, rail de contexto, resumo factual, banner unificado (pasta `components/migration/`).
7. Seletor de destino compartilhado (`DestinationPicker.tsx`, promovido do Monthly).
8. Pagina do ritual (`MigrationRitualPage.tsx`) que compoe tudo acima.
9. Integracao no Daily legado (`DailyPage.tsx`): troca dos dois banners pelo banner unificado.
10. Testes unitarios/component (co-locados com cada arquivo acima) e guard de literais (`noLiteralTokens.test.ts`).
11. Testes E2E: novo spec do ritual (`migration-ritual.spec.ts`) e atualizacao dos dois specs legados (`migration-flow.spec.ts`, `unified-migration-queue.spec.ts`).

---

## 1. Artefatos de planejamento (implementation-artifacts)

### `_bmad-output/implementation-artifacts/spec-14-9-migracao-catch-up-como-ritual-no-shell.md`

**Funcao geral do arquivo**

Spec de execucao gerada pelo bmad-loop para a Story 14.9 — contrato de intencao (`Intent`/`Boundaries & Constraints`/`I/O & Edge-Case Matrix`), mapa de codigo, tarefas e criterios de aceite, notas de design e comandos de verificacao. E o documento que a sessao automatizada seguiu para implementar o codigo.

**Funcao geral da alteracao**

Arquivo novo (untracked). Define, entre outros pontos centrais reaproveitados no restante do relatorio: unico dado de leitura (`unified_migration_queue`), unica mutacao (`useMigrateTaskMutation`), rota nova `migration` com `surfaceMigrated: true` so para ela, composicao rail+lista+rail-de-contexto, promocao do `MonthlyDestinationPicker` para `DestinationPicker` compartilhado, semantica de "banner pausado" com `M` em `sessionStorage`, e a proibicao de criar `RitualDecision` para decisoes de migracao (a mutacao em si ja e a persistencia).

**Blocos principais**

- Linhas 15-46: `Intent`/`Boundaries & Constraints` — regras "Always"/"Never" que os componentes abaixo seguem ao pe da letra.
- Linhas 48-57: `I/O & Edge-Case Matrix` — tabela de cenarios (fila vazia, decidir ultimo item, escolher Outro mes, falha de escrita, offline, pausar/retomar) usada como checklist de teste.
- Linhas 61-78: `Code Map` — arquivos exatos a tocar/promover, todos confirmados no restante do relatorio.
- Linhas 100-106: `Design Notes` — as DUAS contagens distintas (tally da sessao em memoria vs. `M` de `sessionStorage`) que `MigrationContextRail`/`MigrationRitualBanner`/`MigrationRitualPage` implementam.
- Linhas 108-118: `Verification` — comandos que a sessao automatizada rodou (tsc, eslint, vitest, pytest, ruff, makemigrations --check, diff de schema/types.gen, Playwright).

**Funcoes, classes e importacoes especificas**

N/A (documento markdown, nao codigo executavel).

**Comportamento de libs usadas**

N/A.

### `_bmad-output/implementation-artifacts/epic-14-context.md`

**Funcao geral do arquivo**

Contexto compilado do Epico 14 inteiro (gerado a partir de artefatos de planejamento) — objetivo do epico, lista das 11 stories (14.0-14.10), requisitos/constraints, decisoes tecnicas de todo o epico, padroes de UX transversais e dependencias cruzadas entre stories.

**Funcao geral da alteracao**

Arquivo novo (untracked), referenciado como `context` no front-matter da spec 14.9. Fornece o pano de fundo que explica por que a 14.9 depende da 14.3 (fila unificada) e por que o Daily legado (com seus banners atuais) precisa continuar intocado ate o Epico 17 — premissa que justifica o padrao "desmontar sem editar" aplicado aos arquivos legados de migracao.

**Blocos principais**

- Linhas 54-61: `Cross-Story Dependencies` — confirma "14.3 (fila unificada) e pre-requisito direto da 14.9" e "Aliases finos (14.3) mantem o Daily legado e seus banners intactos ate o Epico 17".
- Linhas 43-52: `UX & Interaction Patterns` — paragrafo especifico de Migracao/Catch-Up: "entrada unica = faixa discreta no Hoje... reusa o padrao rail-de-fontes/lista/rail-de-contexto do shell (nao e dialog nem tela cheia); acoes Migrar para hoje / Escolher destino... / Cancelar (sem Concluir); pausar/retomar nao perde decisoes; resumo factual ao final" — e literalmente o resumo funcional do que os arquivos abaixo implementam.

**Funcoes, classes e importacoes especificas**

N/A (documento markdown).

**Comportamento de libs usadas**

N/A.

---

## 2. Chave de query, tipos e API (camada de dados)

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Registro centralizado das `queryKey`s do TanStack Query usadas em toda a aplicacao, agrupadas por dominio (`bujo`, etc.) — garante que toda leitura/invalidacao de cache referencie a mesma chave.

**Funcao geral da alteracao**

Adiciona uma chave nova, `unifiedMigrationQueue`, irma de `migrationQueue`/`catchUpQueue` ja existentes (mesmo endpoint no backend, aliases finos desde a 14.3). E a chave que `useUnifiedMigrationQueueQuery` (em `api.ts`) e a invalidacao de `useMigrateTaskMutation` passam a usar.

**Blocos principais**

- Linha 28: `unifiedMigrationQueue: () => ['bujo', 'unifiedMigrationQueue', 'list'] as const` — nova entrada, comentada explicando que serve tanto o ritual roteado quanto o banner unificado.

**Funcoes, classes e importacoes especificas**

- `keys.bujo.unifiedMigrationQueue`: funcao que retorna a tupla de chave `['bujo','unifiedMigrationQueue','list']`, consumida por `useUnifiedMigrationQueueQuery` (queryFn) e por `useMigrateTaskMutation` (invalidateQueries).

**Comportamento de libs usadas**

- TanStack Query (`@tanstack/react-query`): chaves de array sao comparadas por igualdade estrutural — uma nova chave distinta garante um slot de cache independente das chaves `migrationQueue`/`catchUpQueue` (mesmo que os 3 endpoints, na origem, projetem o mesmo dado).

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Re-exporta tipos TypeScript derivados do schema OpenAPI gerado (`components['schemas']`) para uso no restante do feature `bujo` — camada fina entre o contrato gerado e o codigo de aplicacao.

**Funcao geral da alteracao**

Adiciona 3 tipos novos: `UnifiedMigrationQueue`, `UnifiedQueueSection`, `UnifiedQueueGroup` — todos ja existentes no schema OpenAPI (gerados pela Story 14.3), sem consumidor de frontend ate esta story. Nao ha mudanca em `schema.yaml`/`types.gen.ts` (a spec exige `git diff --stat` vazio nesses arquivos gerados).

**Blocos principais**

- Linhas 21-23: os 3 `export type` novos, com comentario explicando que `sections`/`groups` chegam em ordem mes→semana→dia (contrato do backend).

**Funcoes, classes e importacoes especificas**

- `UnifiedMigrationQueue`: shape `{ totalCount: number; sections: UnifiedQueueSection[] }` (usado por `useUnifiedMigrationQueueQuery`, `MigrationRitualBanner`, `MigrationRitualPage`, `migrationRitualSources.ts`).
- `UnifiedQueueSection`: shape `{ sourceId: string; count: number; groups: UnifiedQueueGroup[] }` — consumido por `itemsBySource`/`flattenSection`.
- `UnifiedQueueGroup`: shape `{ periodStart: string; items: Task[] }` — a unidade de agrupamento por periodo (mes/semana/dia) dentro de uma secao.

**Comportamento de libs usadas**

- `openapi-typescript` (implicito, via `components['schemas'][...]`): os tipos sao indexados a partir do schema gerado — nenhum tipo manual duplicado, garantindo que o frontend nao diverge do contrato real do backend.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Camada de hooks React Query (`useQuery`/`useMutation`) que encapsula todas as chamadas HTTP do dominio `bujo` — Daily/Weekly/Monthly/Future logs, tarefas, migracao, filas de revisao, recorrentes, etc.

**Funcao geral da alteracao**

Adiciona a funcao de fetch `fetchUnifiedMigrationQueue` e o hook `useUnifiedMigrationQueueQuery` (GET `/api/bujo/migration/unified-queue/`), unico dado de leitura consumido pelo ritual roteado e pelo banner unificado. Estende `useMigrateTaskMutation.onSuccess` para tambem invalidar a nova chave `keys.bujo.unifiedMigrationQueue()`, ao lado das invalidacoes ja existentes (`migrationQueue`, `weeklyReviewQueue`, `monthlyReviewQueue`, `catchUpQueue`, prefixo `dailyLog`).

**Blocos principais**

- Linhas 423-441: `fetchUnifiedMigrationQueue` (GET puro via `client.get`) + `useUnifiedMigrationQueueQuery` (queryFn = fetch, queryKey = `keys.bujo.unifiedMigrationQueue()`).
- Linhas 466-470: nova linha de invalidacao dentro do `onSuccess` de `useMigrateTaskMutation`, com comentario explicando que toda decisao de migracao precisa re-derivar essa fila.

**Funcoes, classes e importacoes especificas**

- `fetchUnifiedMigrationQueue(): Promise<UnifiedMigrationQueue>`: chama `client.get<UnifiedMigrationQueue>('/api/bujo/migration/unified-queue/')` e retorna `response.data`.
- `useUnifiedMigrationQueueQuery()`: `useQuery({ queryKey: keys.bujo.unifiedMigrationQueue(), queryFn: fetchUnifiedMigrationQueue })` — sem `select`/opcoes extras, mesmo molde de `useMigrationQueueQuery`/`useCatchUpQueueQuery` ja existentes.
- `useMigrateTaskMutation()` (existente, estendido): dentro de `onSuccess`, adiciona `queryClient.invalidateQueries({ queryKey: keys.bujo.unifiedMigrationQueue() })`.

**Comportamento de libs usadas**

- `@tanstack/react-query` `useQuery`: dispara a `queryFn` automaticamente no mount e em revalidacoes de foco/rede; o componente consumidor le `isPending`/`isError`/`data`/`refetch` do objeto retornado.
- `useMutation`/`queryClient.invalidateQueries`: apos uma mutacao bem-sucedida, marca a query correspondente como stale e refaz o fetch se houver observador montado — e assim que o banner some/atualiza apos uma decisao no ritual.
- `client.get` (axios, via `../../api/client`): GET simples, resposta tipada por generic `<T>`.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel/fachada publica do feature `bujo` — reexporta hooks, componentes e tipos para o resto da aplicacao (evita imports profundos direto dos arquivos internos).

**Funcao geral da alteracao**

Reexporta `useUnifiedMigrationQueueQuery` (hook), `MigrationRitualBanner` (componente novo) e os 3 tipos novos (`UnifiedMigrationQueue`, `UnifiedQueueSection`, `UnifiedQueueGroup`). Mantem os exports legados (`MigrationBanner`, `CatchUpBanner`) intactos — comentario explicito de que seguem exportados "para rollback".

**Blocos principais**

- Linha 16: `useUnifiedMigrationQueueQuery` adicionado a lista de hooks reexportados.
- Linhas 49-51: `export { MigrationRitualBanner } from './components/migration/MigrationRitualBanner'`, com comentario de que substitui `MigrationBanner`+`CatchUpBanner` em `DailyPage.tsx`.
- Linhas 82-84: `UnifiedMigrationQueue`, `UnifiedQueueSection`, `UnifiedQueueGroup` adicionados ao bloco `export type`.

**Funcoes, classes e importacoes especificas**

- Apenas reexportacoes (`export { X } from '...'` / `export type { X }`) — nenhuma logica propria neste arquivo.

**Comportamento de libs usadas**

N/A (puramente reexportacao de modulos ES).

---

## 3. Roteamento e shell

### `frontend/src/app/layout/shell/shellRouting.ts`

**Funcao geral do arquivo**

Registro declarativo (`shellRoutes`) que mapeia cada `routeId` do app a um `shell` (`'legacy' | 'new'`) e a uma flag `surfaceMigrated` — usado pelo `ShellLayout` para decidir se mostra o aviso de seam legado (`LegacySeamNotice`) numa rota.

**Funcao geral da alteracao**

Adiciona a entrada `{ routeId: 'migration', shell: 'new', surfaceMigrated: true }`, logo apos `daily/:date`. E a UNICA rota nova nesta story marcada como `surfaceMigrated: true` — `today`/`daily/:date` permanecem `false` (o Daily legado, com seus proprios banners, so migra no Epico 17).

**Blocos principais**

- Linhas 52-56: nova entrada `migration`, com comentario explicando que a rota "ja nasce" migrada por ser 100% nova (nunca teve seam legado), ao contrario de `today`/`daily/:date`.

**Funcoes, classes e importacoes especificas**

- `shellRoutes`: array `readonly ShellRouteEntry[]` — a nova entrada segue a mesma forma `{ routeId, shell, surfaceMigrated }` das demais.

**Comportamento de libs usadas**

N/A (estrutura de dados estatica, sem lib de terceiros).

### `frontend/src/app/router.tsx`

**Funcao geral do arquivo**

Definicao das rotas React Router (`routeDefinitions`) dentro do `ShellLayout` — cada entrada mapeia um `path` a um componente de pagina e a metadados (`handle.title`).

**Funcao geral da alteracao**

Importa `MigrationRitualPage` e registra a rota `path: 'migration'` como irma direta de `today`/`daily/:date` (nao filha de `planner/*`) — decisao explicita de que a migracao "une os tres niveis mes/semana/dia" e nao pertence a nenhum log especifico.

**Blocos principais**

- Linha 13: `import { MigrationRitualPage } from '../pages/MigrationRitualPage'`.
- Linhas 110-119: nova entrada de rota `{ path: 'migration', element: <MigrationRitualPage />, handle: { title: 'Migração' } }`, com comentario justificando a posicao na arvore de rotas.

**Funcoes, classes e importacoes especificas**

- `routeDefinitions: RouteObject[]`: array consumido por `createBrowserRouter`/`useRoutes` (React Router) para montar a arvore de rotas do app.

**Comportamento de libs usadas**

- `react-router-dom` `RouteObject`: cada objeto de rota e resolvido pelo matcher do React Router; `handle.title` e lido por `RouteAnnouncer`/documento para anunciar o titulo da pagina a leitores de tela e definir `document.title`.

---

## 4. Testes de roteamento/shell (regressao)

### `frontend/src/app/layout/shell/shellRouting.test.ts`

**Funcao geral do arquivo**

Suite de testes que trava o contrato de `shellRoutes`/`resolveShellRoute` — garante que toda rota do app tem entrada no registro e que `surfaceMigrated` esta correto por rota.

**Funcao geral da alteracao**

Adiciona `'migration'` a lista de `routeId`s esperados (linha 74), um teste novo (`test_migration_e_a_rota_migrada_da_story_14_9`) que confirma `surfaceMigrated: true` para `migration` e `false` para `today`/`daily/:date`, e uma asercao extra em `resolveShellRoute('/migration').routeId === 'migration'` dentro do teste de resolucao de rotas parametrizadas/estaticas ja existente.

**Blocos principais**

- Linhas 73-75: `'migration'` adicionado ao array de `routeId`s esperados.
- Linhas 104-112: novo `it('test_migration_e_a_rota_migrada_da_story_14_9', ...)`.
- Linha 105 (bloco de resolucao): `expect(resolveShellRoute('/migration').routeId).toBe('migration')`.

**Funcoes, classes e importacoes especificas**

- `shellRoutes`, `resolveShellRoute` (importados do arquivo de producao) — nenhuma importacao nova.

**Comportamento de libs usadas**

- Vitest (`describe`/`it`/`expect`): asercoes sincronas sobre estrutura de dados estatica, sem mocks.

### `frontend/src/app/router.test.tsx`

**Funcao geral do alteracao**

Adiciona `MigrationRitualBanner: () => null` ao mock do modulo `../features/bujo` (o mock precisa cobrir todo simbolo que `router.tsx`/`DailyPage.tsx` importa transitivamente, senao o teste quebra por `undefined is not a function`).

**Blocos principais**

- Linha 30: `MigrationRitualBanner: () => null,` adicionado ao objeto de mock, ao lado de `MigrationBanner`/`WeeklyReviewBanner`/etc.

**Funcoes, classes e importacoes especificas**

- `vi.mock('../features/bujo', () => ({ ... }))`: mock de modulo completo — cada simbolo real precisa de um stub aqui.

**Comportamento de libs usadas**

- Vitest `vi.mock`: substitui o modulo inteiro por um objeto literal; qualquer export nao mockado vira `undefined`, quebrando quem o chama como funcao/componente.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral da alteracao**

Mesmo ajuste que `router.test.tsx`: adiciona `MigrationRitualBanner: () => null` ao mock do modulo `../../features/bujo`, mantendo o teste do `RouteAnnouncer` (que renderiza o `DailyPage` real dentro da arvore) funcional.

**Blocos principais**

- Linha 27: `MigrationRitualBanner: () => null,` adicionado ao objeto de mock.

**Funcoes, classes e importacoes especificas**

- Mesmo `vi.mock('../../features/bujo', ...)`.

**Comportamento de libs usadas**

- Vitest `vi.mock` — mesma explicacao do item anterior.

---

## 5. Logica pura das fontes do ritual

### `frontend/src/features/bujo/components/migration/migrationRitualSources.ts`

**Funcao geral do arquivo**

Modulo de logica pura (sem JSX, sem hooks de estado) que define as 3 "fontes" do ritual de migracao — aqui "fonte" e NIVEL (mes/semana/dia) dentro da mesma fila unificada, ao contrario do Weekly/Monthly onde cada fonte e um endpoint proprio. Fornece constantes de ordem/rotulo, achatamento de secoes em itens planos e normalizacao para a forma que a lista de decisao consome.

**Funcao geral da alteracao**

Arquivo novo. E a base compartilhada por `MigrationSourceRail`, `MigrationDecisionList`, `MigrationContextRail`, `MigrationRitualBanner` e `MigrationRitualPage`.

**Blocos principais**

- Linha 25: `MIGRATION_SESSION_TOTAL_KEY = 'migrationRitualSessionTotal'` — chave unica de `sessionStorage` para o `M` do banner pausado.
- Linhas 27-47: `MIGRATION_SOURCE_ORDER` (`['month','week','day']`), `MIGRATION_SOURCE_LABEL`, `MIGRATION_SOURCE_HEADING`, `MIGRATION_SOURCE_SUBTITLE` — dicionarios de rotulo por fonte, na ordem fixa exigida pelo contrato do backend.
- Linhas 61-66: `flattenSection(section)` — achata `groups[].items[]` de uma secao numa lista plana de `MigrationQueueItem`.
- Linhas 70-80: `itemsBySource(sections)` — garante as 3 chaves SEMPRE presentes (mesmo vazias), mapeando cada `UnifiedQueueSection` do backend para uma entrada por `sourceId`.
- Linhas 84-93: `originLabelFor(sourceId, periodStart)` — formata o rotulo de linhagem/origem ("De: Junho de 2026" / "De: semana de 20 jul." / "De: 26 jul.").
- Linhas 106-113: `normalizeQueueItem(item)` — converte um `MigrationQueueItem` (pendente) para `NormalizedMigrationItem` (`decision: null`), forma unica que a lista de decisao consome.

**Funcoes, classes e importacoes especificas**

- `MigrationQueueItem` (interface): `{ task: Task; sourceId: MigrationSourceId; periodStart: string }` — item de raiz achatado, com a fonte/periodo de origem anexados.
- `NormalizedMigrationItem` (interface): `{ id, title, originLabel, decision }` — forma final consumida pela UI; `decision` e `null` para pendentes e uma string (o `destination`) para itens decididos nesta visita (vindos de `mutatedThisVisit` em `MigrationRitualPage`).
- Importa `formatDayLabel` de `../../../../shared/date` e `capitalize`/`MONTH_NAMES_PT` de `../../monthNames` — utilitarios ja existentes, reusados sem duplicacao.

**Comportamento de libs usadas**

N/A (nenhuma lib de terceiros; so utilitarios internos do proprio repo).

---

## 6. Componentes de UI do ritual (`components/migration/`)

### `frontend/src/features/bujo/components/migration/MigrationSourceRail.tsx`

**Funcao geral do arquivo**

Rail de navegacao lateral entre as 3 fontes (Meses/Semanas/Dias), molde de `WeeklySourceRail.tsx`. Cada entrada mostra a contagem da fonte ou "✓ revisado" quando chega a zero.

**Funcao geral da alteracao**

Arquivo novo. Ao contrario do Weekly (onde cada fonte e um endpoint independente com `isLoading`/`isError` proprios), aqui as 3 entradas compartilham uma unica leitura (`isError` e um booleano unico que afeta as 3 igualmente).

**Blocos principais**

- Linhas 29-72: componente `MigrationSourceRail` — itera `MIGRATION_SOURCE_ORDER`, renderiza um `<button>` por fonte com `aria-current` na ativa, contagem ou "✓ revisado"/"erro".

**Funcoes, classes e importacoes especificas**

- `MigrationSourceRailEntry` (interface): `{ sourceId, count }`.
- `MigrationSourceRailProps`: `{ entries, activeSourceId, onSelect, isError? }`.
- `MigrationSourceRail({ entries, activeSourceId, onSelect, isError })`: componente funcional puro — sem estado proprio, tudo vem de props.

**Comportamento de libs usadas**

- MUI `Box` (`component="nav"`/`component="button"`): usado como wrapper estilizavel via `sx`, sem trazer nenhum comportamento de navegacao/acessibilidade alem do que o elemento HTML nativo (`nav`, `button`) ja oferece.

### `frontend/src/features/bujo/components/migration/MigrationDecisionList.tsx`

**Funcao geral do arquivo**

Lista de decisao — renderiza os itens pendentes/decididos de uma fonte, com as 3 acoes fixas ("Migrar para hoje" / "Escolher destino…" / "Cancelar"), toggle "Pendentes de decisao"/"Tudo", erro por item com retry, e continuidade de foco (ao decidir um item, foca o proximo pendente na mesma posicao ou o heading, se a fonte esgotou).

**Funcao geral da alteracao**

Arquivo novo, molde direto de `weekly/WeeklyDecisionList.tsx`.

**Blocos principais**

- Linhas 57-69: `useEffect` de continuidade de foco — compara `items` a cada render; se o item marcado como `lastActed` sumiu da lista, foca o proximo na mesma posicao (`itemRefs`) ou o `headingRef` se a lista esvaziou.
- Linhas 71-80: `actOn`/`chooseDestination` — bloqueiam a acao se `offline`.
- Linhas 93-100: toggle `role="group"` com dois botoes `aria-pressed` (Pendentes de decisao / Tudo).
- Linhas 102-115: estados de erro de leitura (`role="alert"` + retry) e vazio ("Nenhuma pendencia nesta fonte." / "Nada para mostrar ainda.").
- Linhas 117-168: mapeamento de itens — titulo, `originLabel`, e as 3 acoes com `aria-disabled={offline}`; erro por item em `role="alert"` com botao "Tentar novamente".

**Funcoes, classes e importacoes especificas**

- `MigrationDecisionListProps`: contrato completo de props (`sourceId`, `items`, `view`, `onViewChange`, `loading`, `error`, `offline?`, `onRetry`, `itemErrors?`, `onRetryItem?`, `onMigrateToday`, `onChooseDestination`, `onCancel`).
- `useRef<HTMLHeadingElement>` (`headingRef`), `useRef<Map<string, HTMLElement>>` (`itemRefs`) — refs imperativos usados so para `.focus()` apos a lista mudar.
- `useState<{ id, index } | null>` (`lastActed`) — marca qual item foi acionado por ultimo, para o efeito de foco decidir o alvo.

**Comportamento de libs usadas**

- React `useEffect` com dependencia `[items]`: roda toda vez que a lista de itens muda de referencia (novo array apos decisao) — usado para decidir foco pos-decisao, nao para side-effects de rede.
- `// eslint-disable-next-line react-hooks/exhaustive-deps`: suprime o lint de deps porque o efeito le `lastActed` via closure sem precisar re-rodar quando `lastActed` muda (so quando `items` muda) — padrao ja usado no molde Weekly.

### `frontend/src/features/bujo/components/migration/MigrationContextRail.tsx`

**Funcao geral do arquivo**

Rail de contexto lateral do ritual — mostra progresso (fontes revisadas / itens decididos), o tally da sessao (migradas/adiadas/canceladas), lista "por fonte" com navegacao, e o botao "Pausar e sair". Adaptacao do `WeeklyContextRail.tsx`/`MonthlyContextRail.tsx`, sem o calendario-alvo (a migracao nao tem destino unico).

**Funcao geral da alteracao**

Arquivo novo. Implementa a mecanica de "snapshot que so cresce" (`useState<Record<string, number>>`) para que o DENOMINADOR do progresso ("N de M revisadas") nao encolha junto com o numerador conforme itens sao decididos e somem da fila (a fila so lista pendentes).

**Blocos principais**

- Linhas 42-56: calculo de `nextSnapshot` — para cada fonte, se `pendingNow` supera o valor guardado, atualiza (nunca reduz); `setSnapshot` so roda se algo mudou (`snapshotChanged`), evitando loop de render.
- Linhas 58-61: derivacao de `totalSnapshot`, `totalPending`, `decidedCount`, `reviewedCount` a partir do snapshot e das props atuais.
- Linhas 65-89: secao "Progresso" — dois `role="progressbar"` (`Fontes revisadas`, `Itens decididos`) com `aria-valuenow/min/max/text`.
- Linhas 91-98: secao "Decidido até agora" — 3 `TallyCell` (migradas/adiadas/canceladas).
- Linhas 100-123: secao "Por fonte" — lista com botao por fonte que chama `onNavigateToSource`.
- Linhas 125-147: secao "Ações do ritual" — botao "Pausar e sair" (`onPause`) com texto explicativo fixo.
- Linhas 152-159: `TallyCell` — subcomponente de exibicao de um numero + rotulo.

**Funcoes, classes e importacoes especificas**

- `MigrationProgressSourceInput`: `{ sourceId, pendingNow }`.
- `MigrationTally`: `{ migrated, postponed, cancelled }` — tipo tambem importado por `MigrationSummary.tsx` e por `MigrationRitualPage.tsx`.
- `MigrationContextRailProps`: `{ progressSources, tally, onNavigateToSource, onPause }`.

**Comportamento de libs usadas**

- React `useState` chamado condicionalmente dentro do corpo de render (`if (snapshotChanged) setSnapshot(...)`) — padrao de "derivacao idempotente do render atual" (comentado no proprio arquivo): React tolera `setState` durante render desde que seja idempotente e nao cause loop infinito (o novo valor so difere do antigo quando ha crescimento real).

### `frontend/src/features/bujo/components/migration/MigrationSummary.tsx`

**Funcao geral do arquivo**

Tela de resumo factual exibida quando a fila zera dentro de uma montagem continua do ritual — mostra contagem de migradas/adiadas/canceladas, sem celebracao/exclamacao/emoji alem de um check decorativo, e o botao "Voltar ao Hoje".

**Funcao geral da alteracao**

Arquivo novo. Reflete somente o `tally` em memoria da sessao atual (nunca um total historico), conforme a Design Note da spec.

**Blocos principais**

- Linhas 20-37: icone de check decorativo (`aria-hidden`) num circulo.
- Linhas 38-43: titulo "Migração concluída" + subtitulo com contagem total pluralizada ("N tarefa(s) decidida(s). Nada ficou sem lugar.").
- Linhas 44-48: grade de 3 `SummaryCell` (migradas/adiadas/canceladas).
- Linhas 49-65: botao "Voltar ao Hoje" (`onBack`).

**Funcoes, classes e importacoes especificas**

- `MigrationSummaryProps`: `{ tally: MigrationTally; onBack: () => void }` — importa o tipo `MigrationTally` de `./MigrationContextRail`.
- `SummaryCell({ value, label })`: subcomponente de exibicao.

**Comportamento de libs usadas**

N/A alem de MUI `Box` como wrapper estilizavel.

### `frontend/src/features/bujo/components/migration/MigrationRitualBanner.tsx`

**Funcao geral do arquivo**

Banner unico exibido no Daily — substitui `MigrationBanner`+`CatchUpBanner`. Le `useUnifiedMigrationQueueQuery`; se `totalCount === 0` (ou a query ainda esta pendente), nao renderiza NADA (sem DOM). Tem 2 variantes: simples (contagem + detalhamento por fonte) e pausada ("Migração pausada · N de M restantes"), decidida pela presenca de `sessionStorage[MIGRATION_SESSION_TOTAL_KEY]`.

**Funcao geral da alteracao**

Arquivo novo. So LE a chave de `sessionStorage` (quem escreve e `MigrationRitualPage`, no mount do ritual).

**Blocos principais**

- Linha 27: `if (queue.isPending || totalCount === 0) return null` — vazio = sem DOM.
- Linhas 29-30: leitura de `sessionStorage.getItem(MIGRATION_SESSION_TOTAL_KEY)`; `paused = storedTotal !== null`.
- Linhas 32-35: `breakdown` — string "`X` de meses · `Y` de semanas · `Z` de dias", montada a partir de `queue.data.sections`.
- Linhas 37-39: `label` — a `aria-label` completa da regiao, calculada em texto puro para leitores de tela (independente da marcacao visual em `<b>`/nos de texto abaixo).
- Linhas 41-92: `Box role="region"` com `aria-label={label}`, icone decorativo (`⏸` pausado / `⇥` normal), texto visivel (JSX partido em spans, mas coberto pelo `aria-label` da regiao) e botao `RouterLink to="/migration"` rotulado "Retomar migração"/"Migrar ›".

**Funcoes, classes e importacoes especificas**

- `MigrationRitualBanner()`: componente funcional, sem props.
- `useUnifiedMigrationQueueQuery()` (de `../../api`): unico dado de leitura.

**Comportamento de libs usadas**

- `react-router-dom` `Link` (`component={RouterLink} to="/migration"`, via MUI `Button`): renderiza uma tag `<a href="/migration">` real — navegacao client-side sem reload, e o motivo pelo qual os testes conseguem fazer `getByRole('link', { name: /Migrar/ })` e checar `href`.
- Web Storage API `sessionStorage.getItem`: leitura sincrona, sobrevive a navegacao dentro da mesma aba mas nao a fechar a aba — exatamente a semantica de "pausar sem perder o M" que a spec pede.

---

## 7. Seletor de destino compartilhado

### `frontend/src/features/bujo/components/DestinationPicker.tsx`

**Funcao geral do arquivo**

Componente compartilhado de selecao de destino de migracao — promovido a partir de `monthly/MonthlyDestinationPicker.tsx` (que ja documentava essa extensao no proprio cabecalho), absorvendo tambem a anatomia de `weekly/WeeklyDestinationPicker.tsx`. Oferece ate 3 abas (Esta semana / Dia no mes / Outro mes), cada uma opcional por composicao de props, mais os atalhos novos "Hoje" e "Sem dia definido" do mockup.

**Funcao geral da alteracao**

Arquivo novo. Unico consumidor atual e `MigrationRitualPage` — os 3 consumidores mais antigos (`WeeklyPlanningPage`, `MonthlyPlanningPage`, `FutureBoardPage`) continuam usando os pickers legados intocados, evitando reabrir risco de regressao fora do escopo desta story.

**Blocos principais**

- Linhas 97-105: estado local — `hasOtherMonthTab` (deriva de `month?.selectableMonths?.length`), `tab` (aba ativa, default `'week'` se `week` existe senao `'day'`), `armed` (selecao em curso, union type `Armed`), `weekDays`/`lastDay`/`monthYear`/`monthMonth` derivados de props.
- Linhas 106-138: funcoes de selecao — `isoForDay`, `selectWeekday`, `selectDay`, `stepDay`, `selectToday`, `selectUndated`, `selectOtherMonth` (troca de mes reseta a aba para `'day'` e limpa `armed`).
- Linhas 140-157: `currentSelection()` — traduz `armed` (estado interno) em `DestinationSelection` (`{ kind, scheduledDate, monthFirst }`), inclusive o caso `'undated'` que depende da aba ativa no momento da confirmacao.
- Linhas 159-164: `confirm()` — chama `onConfirm(scheduledDate, meta)`.
- Linhas 166-177: `useKeyboardShortcuts` — `Enter` confirma, `Escape` fecha, teclas `1`-`7` selecionam dia da semana quando a aba `week` esta ativa.
- Linhas 179-188: `confirmationLabel(selection)` — rotula o botao de confirmacao ("Migrar para hoje" / "Sem dia definido" / "Migrar para quarta, 23 de julho" / "Migrar para 15 de agosto"), sobrescrito por `confirmLabelFor` se o chamador passar um.
- Linhas 193-421: JSX do conteudo — `role="dialog"`, `role="tablist"` (so aparece se houver mais de 1 aba disponivel), `role="radiogroup"` (dias da semana), `role="listbox"`/`role="option"` (Outro mes), `role="grid"`/`role="gridcell"` (grade de dias do mes com entrada numerica direta), atalhos "Hoje"/"Sem dia definido" tab-agnosticos.
- Linhas 423-443: se `compact`, envolve o conteudo num MUI `Drawer` ancorado embaixo; senao, retorna o conteudo puro (uso inline, nao-modal).
- Linhas 446-468: `DestinationTab` — subcomponente de aba (`role="tab"`, `aria-selected`).

**Funcoes, classes e importacoes especificas**

- `DestinationConfirmMeta`: `{ kind: 'today'|'week'|'month'; monthFirst: string }` — informa ao CHAMADOR qual `destination` do `POST /migrate/` usar; o componente nao conhece o conceito de "mes corrente" (quem decide `'month'` vs `'future'` e o chamador comparando `monthFirst`).
- `DestinationSelection extends DestinationConfirmMeta`: adiciona `scheduledDate: string | null`.
- `DestinationPickerProps`: `week?`, `month?` (cada um opcional, controla quais abas existem), `todayIso?`, `compact?`, `error?`, `onConfirm`, `onClose`, `confirmLabelFor?`.
- `DestinationPicker(props)`: componente principal, usado por `MigrationRitualPage` com `week` + `month` + `todayIso` sempre presentes (as 3 abas completas).

**Comportamento de libs usadas**

- `useKeyboardShortcuts` (hook interno, `../../../shared/hooks/useKeyboardShortcuts`): registra um mapa `tecla → handler`; espera-se que o hook adicione/remova um listener de teclado global enquanto o componente que o chama esta montado.
- MUI `Drawer` (`anchor="bottom"`, `slotProps.paper.style = shellCssVariables('light')`): usado so no modo `compact` (mobile/tablet) para apresentar o seletor como bandeja inferior; `shellCssVariables` injeta as CSS custom properties `--ds-*` no `style` do `paper`/`backdrop` para que os tokens de design funcionem dentro do portal do `Drawer` (que renderiza fora da arvore DOM normal).
- `addDaysIso`, `formatDayLabel`, `isoOf`, `lastDayOfMonth` (de `../../../shared/date`): utilitarios de data ja existentes, reusados sem duplicacao logica.

---

## 8. Pagina do ritual

### `frontend/src/pages/MigrationRitualPage.tsx`

**Funcao geral do arquivo**

Pagina roteada em `/migration` — compoe o cabecalho do ritual, o rail de fontes, a lista de decisao, o rail de contexto e (condicionalmente) o `DestinationPicker`/`MigrationSummary`. E o unico lugar que orquestra as duas mutacoes de estado local (tally da sessao + `sessionStorage[M]`) e a unica mutacao de escrita real (`useMigrateTaskMutation`).

**Funcao geral da alteracao**

Arquivo novo. Landmark `<main aria-label="Migração">` em todos os ramos de retorno (loading/erro/vazio/ritual ativo/resumo) — nunca `Dialog`.

**Blocos principais**

- Linhas 68-80: estado local — `activeSourceId` (fonte selecionada no rail), `view` (`'pending'|'all'`), `mutatedThisVisit` (snapshot de itens decididos NESTA visita, por fonte), `itemErrors`/`retryActionsRef` (erro e funcao de retry por item), `destinationItemId`/`pickerMonthFirst`/`destinationError` (estado do `DestinationPicker` aberto), `tally` (contagem migradas/adiadas/canceladas da sessao).
- Linhas 82-86: os 4 hooks de leitura — `useUnifiedMigrationQueueQuery`, `useMigrateTaskMutation`, `useTodayLogQuery`, `useWeeklyLogQuery`, `useMonthlyLogQuery` (os 3 ultimos alimentam o `DestinationPicker` com `todayIso`/`weekStart`/mes corrente).
- Linhas 90-101: `useEffect` que grava/atualiza/limpa `sessionStorage[MIGRATION_SESSION_TOTAL_KEY]` — captura `M` no primeiro mount (ou recaptura se a fila crescer acima do `M` salvo) e remove a chave quando `totalCount === 0`.
- Linhas 103-121: ramos de retorno para `loading` (`PlannerSkeleton`) e `isError`/`!data` (`role="alert"` + botao "Tentar de novo").
- Linhas 124-148: calculo de `items` (via `itemsBySource`), `totalCount`, `totalDecided`; se `totalCount === 0`: mostra `MigrationSummary` (se `totalDecided > 0`, ou seja, zerou DENTRO desta visita) ou "Nada para migrar." (fila ja nasceu vazia).
- Linhas 150-168: `railEntries` (contagem por fonte para o rail), `activeAllItems`/`activeItems` (mescla itens pendentes normalizados + `mutatedThisVisit`, filtrados por `view`), `findSourceOf(taskId)`.
- Linhas 170-215: `recordMutation`, `clearItemError`, `setItemError`, `decide(taskId, destination, extra, onDecided)` — funcao central que chama `migrateTask.mutate`, registra sucesso (move o item para `mutatedThisVisit`, incrementa `tally` via `bucketFor(destination)`) ou erro (`setItemError`), e guarda a propria funcao de retry em `retryActionsRef.current[taskId]`.
- Linhas 217-227: `handleMigrateToday`, `handleCancel`, `handleRetryItem` — atalhos que chamam `decide`/reexecutam o retry guardado.
- Linhas 229-278: fluxo do `DestinationPicker` — `otherMonths` (12 meses futuros a partir do mes corrente, via `addMonthsIso`), `handleOpenDestinationPicker`, `handleCloseDestinationPicker`, `handleConfirmDestination` (traduz `DestinationConfirmMeta` em `destination: MigrationDestination` — `'today'`, `'week'`, `'month'` se o mes escolhido bate com o mes corrente, senao `'future'`).
- Linhas 280-293: `confirmLabelFor` — rotula o botao de confirmacao do picker com o destino especifico (delegado ao `DestinationPicker` via prop).
- Linhas 295-304: `handleNavigateToSource` (troca fonte + reseta `view` para `'pending'`), `progressSources`/`totalPending` (dados para o `MigrationContextRail`).
- Linhas 306-382: JSX principal — grid de 3 colunas (`--ds-weekly-planning-source-rail`/`minmax(0,1fr)`/`--ds-weekly-planning-context-rail`, REUSANDO os tokens de geometria do Weekly, sem var nova), banner offline (`role="status"`), `MigrationSourceRail`, `MigrationDecisionList`, `aside` com `MigrationContextRail`, e o `DestinationPicker` condicional no final.
- Linhas 385-429: `RitualHeader` — subcomponente do cabecalho (botao "‹ Hoje", titulo "Migração", `role="status"` com `progressText`, botao "Pausar" condicional a `!concluded`).

**Funcoes, classes e importacoes especificas**

- `bucketFor(destination: MigrationDestination): keyof MigrationTally`: mapeia `'cancel'→'cancelled'`, `'today'|'week'→'migrated'`, qualquer outro (`'month'`/`'future'`) `→'postponed'`.
- `MigrationRitualPage()`: componente de pagina, sem props (le tudo de hooks/rota).
- `RitualHeader({ progressText, onPause, concluded })`: subcomponente interno.
- Reusa `PlannerSkeleton` (existente) para o estado de loading — nenhum skeleton novo criado.

**Comportamento de libs usadas**

- `react-router-dom` `useNavigate`: `navigate('/today')` e chamado tanto por "Pausar" quanto por "Voltar ao Hoje" — navegacao imperativa, sem `Link`, porque a acao depende de logica (nao e so um destino estatico).
- MUI `useMediaQuery(mediaQueries.compact)`: decide `isCompact`, repassado ao `DestinationPicker` para escolher `Drawer` (mobile) vs. inline (desktop).
- `useOnlineStatus()` (hook interno): booleano reativo a eventos `online`/`offline` do browser — usado para desabilitar decisoes e mostrar o aviso "Sem conexão" sem implementar fila de escrita local (proibido pela spec).
- `useEffect` com dependencia `[queue.data]`: so recalcula o `sessionStorage[M]` quando o objeto de dados da query muda de referencia (nova resposta do servidor), nao a cada render.

---

## 9. Integracao no Daily legado

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Pagina do Daily Log (`/today`, `/daily/:date`) — orquestra a lista de tarefas do dia, os banners de ritual (migracao/weekly-review/monthly-review) e o `HabitTracker`.

**Funcao geral da alteracao**

Troca a importacao/uso de `MigrationBanner` + `CatchUpBanner` (ambos removidos do JSX, mas nao deletados do repo) por um unico `MigrationRitualBanner`, posicionado no mesmo lugar que `MigrationBanner` ocupava (antes de `WeeklyReviewBanner`).

**Blocos principais**

- Linhas 2-9 (import): `MigrationRitualBanner` substitui `CatchUpBanner`/`MigrationBanner` na lista de imports de `../../features/bujo`.
- Linhas 99-108: JSX — `<MigrationRitualBanner />` no lugar de `<MigrationBanner />`, com comentario explicando a troca; `<CatchUpBanner />` removido de baixo de `<MonthlyReviewBanner />`. `WeeklyReviewBanner`/`MonthlyReviewBanner` permanecem intocados.

**Funcoes, classes e importacoes especificas**

- Nenhuma funcao nova neste arquivo — so troca de import/uso de componente dentro do JSX existente de `DailyPage()`.

**Comportamento de libs usadas**

N/A alem do que ja se aplicava (React, MUI) — mudanca puramente de composicao.

---

## 10. Testes unitarios/component novos e alterados

### `frontend/src/features/bujo/components/migration/MigrationSourceRail.test.tsx` (novo)

Cobre: ordem mes→semana→dia com contagem por fonte; `aria-current` na fonte ativa; fonte com 0 restantes marcada "✓ revisado"; `onSelect` disparado ao clicar; estado de erro compartilhado mostrando "erro" nas 3 entradas.

### `frontend/src/features/bujo/components/migration/MigrationDecisionList.test.tsx` (novo)

Cobre: origem/linhagem visivel + as 3 acoes (nunca "Concluir"); `onMigrateToday`/`onCancel`/`onChooseDestination` chamados com o id certo; offline deixa acoes `aria-disabled` e guardadas; erro de escrita mostra motivo inline + retry por item; toggle "Tudo" mostra itens decididos nesta visita; erro de leitura mostra motivo + retry sem itens; fonte sem pendencias mostra estado vazio; `jest-axe` sem violacoes com a lista aberta.

### `frontend/src/features/bujo/components/migration/MigrationContextRail.test.tsx` (novo)

Cobre: progresso "N de M revisadas" a partir do snapshot que so cresce (nao retrocede ao decidir itens); tally exibe migradas/adiadas/canceladas; clicar "por fonte" navega para a fonte (`onNavigateToSource`); "Pausar e sair" chama `onPause`.

### `frontend/src/features/bujo/components/migration/MigrationSummary.test.tsx` (novo)

Cobre: contagem factual sem exclamacao/emoji alem do check decorativo; tally migradas/adiadas/canceladas; "Voltar ao Hoje" chama `onBack`; `jest-axe` sem violacoes.

### `frontend/src/features/bujo/components/migration/MigrationRitualBanner.test.tsx` (novo)

Cobre: vazio = sem DOM quando a fila unificada nao tem pendencias; contagem total + detalhamento por fonte (variante nao-pausada); variante PAUSADA quando ha `M` salvo em `sessionStorage` (`N` ao vivo, `M` salvo); sem `M` salvo, a variante e sempre a simples mesmo com itens na fila; `jest-axe` sem violacoes.

### `frontend/src/features/bujo/components/migration/noLiteralTokens.test.ts` (novo)

**Funcao geral do arquivo**

Prova estrutural (via `?raw` import do Vite) de que nenhum componente novo desta story escreve um literal (`0.58`, `36px`, `48px`, `3px`, ou qualquer cor hex) que ja tem token `--ds-*` equivalente — molde de `weekly/noLiteralTokens.test.ts`/`monthly/noLiteralTokens.test.ts`.

**Blocos principais**

- Linhas 9-15: imports `?raw` dos 6 arquivos-fonte checados (5 da pasta `migration/` + `DestinationPicker.tsx`, que mora fora da pasta mas e codigo novo desta story).
- Linha 23: `FORBIDDEN_LITERALS = ['0.58', '36px', '48px', '3px']` — subconjunto compartilhado entre superficies; larguras de rail especificas de OUTRAS superficies ficam de fora porque esta story reusa `--ds-weekly-planning-*` direto, sem geometria de rail nova.
- Linhas 36-47: para cada arquivo, testa ausencia de cada literal proibido (regex com `\b`) e ausencia de qualquer cor hex literal.

**Funcoes, classes e importacoes especificas**

- `SOURCES: Record<string, string>` — mapa nome-de-arquivo → conteudo-fonte bruto, usado para os loops de teste.

**Comportamento de libs usadas**

- Vite `?raw` import suffix: importa o conteudo do arquivo como string literal em tempo de build/teste (Vitest usa a mesma pipeline do Vite) — nao executa o modulo, so le seu texto-fonte.

### `frontend/src/features/bujo/components/DestinationPicker.test.tsx` (novo)

Cobre 3 grupos: (1) aba "Esta semana" isolada — 7 dias renderizados, ausencia de `tablist` com composicao unica, clique/tecla `3`+`Enter` armam e confirmam com `destination` implicito `'week'`, `Escape` fecha; (2) aba "Dia no mes" isolada — 31 `gridcell`s para agosto, clique arma e confirma com o mes em foco, setas navegam dia a dia, ausencia/presenca condicional da aba "Outro mes" conforme `selectableMonths`; (3) as 3 abas juntas (composicao real da Migracao) — ordem das abas, atalho "Hoje", "Sem dia definido" com `scheduledDate: null`, `confirmLabelFor` customizando o rotulo do botao, erro preservado sem fechar o seletor, `jest-axe` sem violacoes com as 3 abas presentes.

### `frontend/src/pages/MigrationRitualPage.test.tsx` (novo)

Cobre o ciclo de vida completo da pagina: loading (skeleton); read-error (motivo + retry); vazio sem tally ("Nada para migrar"); composicao normal (rail + lista + context-rail, nunca `Dialog`); "Migrar para hoje" chamando a mutacao com `destination:'today'`; "Cancelar" com `destination:'cancel'`; "Escolher destino…" abrindo o seletor com as 3 abas; confirmar destino "Esta semana" com `destination:'week'`; "Pausar" navegando para `/today` sem perder decisoes; erro de escrita com retry no item sem perder a decisao; offline com banner de motivo e acoes guardadas; ultima decisao zerando a fila e mostrando o resumo antes de voltar ao Hoje; 2 passes de `jest-axe` (resumo aberto; lista + seletor de destino abertos) — cobrindo explicitamente a licao das stories 14.6/14.7 de nunca medir estrutura ARIA fechada.

### `frontend/src/pages/daily/DailyPage.test.tsx` (modificado)

**Funcao geral da alteracao**

Reescreve as suites que cobriam `MigrationBanner`/`CatchUpBanner` isolados para cobrir o `MigrationRitualBanner` unificado. Remove o mock `queueGetResponseOnce`/`mockPost` (nao mais necessarios, pois nao ha mais fluxo de `Dialog` a simular aqui) e adiciona `EMPTY_UNIFIED_QUEUE`/entrada `GET_DEFAULTS['/api/bujo/migration/unified-queue/']` para rotear o novo endpoint.

**Blocos principais**

- Linhas 56-64: `EMPTY_UNIFIED_QUEUE` — fixture com `totalCount: 0` e as 3 secoes vazias, usado como default de `GET_DEFAULTS`.
- Linha 74: nova entrada `'/api/bujo/migration/unified-queue/': EMPTY_UNIFIED_QUEUE` no roteador de respostas GET.
- Linhas 447-509 (aprox.): suite `MigrationRitualBanner integration (Story 14.9)` — banner aparece com contagem+detalhamento (via `aria-label` da `region`, ja que o texto e partido entre nos JSX); botao do banner e um `link` para `/migration` (nunca `Dialog`); vazio = sem DOM.
- Suite `WeeklyReviewBanner/MonthlyReviewBanner/MigrationRitualBanner integration`: reduzida de 4 para 3 banners (removida a suite isolada do `CatchUpBanner`, que nao existe mais em `DailyPage`), mantendo a prova de independencia entre banners.
- Bloco final (`Rota /daily/:date`): teste que confirma ausencia de QUALQUER banner de ritual (incluindo o unificado) num dia passado, usando `queryByRole('region')`/`queryByRole('link', { name: /Migrar/ })` em vez do texto antigo.

**Funcoes, classes e importacoes especificas**

- `mockPost` removido (nao usado mais nesta suite, ja que a decisao de migracao agora acontece na pagina do ritual, testada em `MigrationRitualPage.test.tsx`).
- `setGetResponse`/`resetGetRouting` (mantidos) — helpers de roteamento de `client.get` mockado por URL.

**Comportamento de libs usadas**

- Testing Library `screen.findByRole('region')`/`toHaveAttribute('aria-label', ...)`: usado para verificar o texto completo do banner sem depender da estrutura de nos JSX internos (o texto visivel e partido entre `<b>` e spans irmaos) — mesma tecnica que os proprios testes de `MigrationRitualBanner.test.tsx` usam.

---

## 11. Testes E2E

### `frontend/e2e/migration-ritual.spec.ts` (novo)

**Funcao geral do arquivo**

Novo spec Playwright que cobre o ritual de migracao/catch-up ponta-a-ponta contra o backend real (branch Neon `e2e`). Organizado em 5 `describe` por faixa de viewport (wide 1440×900, medium 1280×800, tablet 800×720, compact 390×720, reflow 320×720).

**Funcao geral da alteracao**

Arquivo novo, com 13 testes no total.

**Blocos principais**

- Faixa **wide** (linhas 16-183): 8 testes — banner soma as 3 fontes e abre o ritual roteado (nao `Dialog`) ao clicar "Migrar ›"; rail mostra Meses→Semanas→Dias com contagem, "Migrar para hoje" remove o item e marca a fonte "✓ revisado"; "Escolher destino…" com as 3 abas migrando para um dia de "Outro mes" (`destination: 'future'`); "Cancelar" remove o item sem sucessor; pausar preserva decisoes e o banner volta com "N de M restantes"; resumo factual ao zerar a fila + "Voltar ao Hoje"; offline desabilita decisoes com motivo, clique guardado sem fila local; axe sem `exclude: 'main'` (rota nova ja migrada).
- Faixas **medium/tablet/compact/reflow** (linhas 186-246): 1 teste de axe cada, todas sem `exclude: 'main'`; a faixa tablet inclui expansao manual da sidebar (rail colapsado por padrao) e um `waitForTimeout(300)` documentado como acomodacao de uma transicao CSS/`Collapse` do MUI, nao regressao da story.

**Funcoes, classes e importacoes especificas**

- Usa fixtures/helpers ja existentes: `seedCatchUpScenario`, `seedYesterdayQueue` (seeds diretos no banco), `mainNav` (helper de navegacao da sidebar), `expectNoAxeViolations` (wrapper de axe-core).
- Nenhuma funcao nova propria do spec alem dos proprios testes.

**Comportamento de libs usadas**

- Playwright `test`/`expect`/`page.getByRole(...)`: locators por papel ARIA (`region`, `navigation`, `dialog`, `gridcell`, `option`, `tab`) — a mesma superficie de acessibilidade testada pelos testes unitarios, mas contra o app real rodando em browser.
- `page.context().setOffline(true/false)`: simula perda de rede no nivel do contexto do browser Playwright, usado no teste offline (com `try/finally` para garantir que a rede volta mesmo se a asercao falhar).
- `expectNoAxeViolations` (helper interno sobre `axe-core`/`@axe-core/playwright` ou similar): injeta axe na pagina e falha o teste se houver violacoes, rotulando o relatorio com `label` para depuracao.

### `frontend/e2e/migration-flow.spec.ts` (modificado)

**Funcao geral do arquivo**

Spec legado que cobre a Story 4.2 (migracao diaria com linhagem) ponta-a-ponta.

**Funcao geral da alteracao**

Atualizado para exercitar a NOVA superficie (banner unificado + ritual roteado) preservando a MESMA tese de cada teste — nenhum teste foi deletado ou pulado (`.skip`), conforme exigido pela spec. Trocas principais: `getByRole('button', {name:'Iniciar'})` → `banner.getByRole('link', {name:'Migrar ›'})`; `getByRole('dialog')` → `page` (a URL vira `/migration`); atalho de teclado `1` (migrar para hoje) → clique em `getByRole('button', {name:'Migrar para hoje'})`; fechamento por `Escape` → botao "Pausar"; fim de fluxo checado por "Migração concluída" + "Voltar ao Hoje" em vez de o dialog fechar sozinho; "Adiar no mes" com `<input type="date">` → fluxo completo "Escolher destino…" → aba "Dia no mês" → `gridcell` → confirmar.

**Blocos principais**

- Linhas 1-16: comentario de cabecalho reescrito, explicando que o spec agora atravessa a SUPERFICIE NOVA e que os arquivos legados seguem intocados em comportamento, so desmontados.
- Teste "banner unificado mostra a contagem certa e so raizes": `banner.toHaveAccessibleName(/2 tarefas precisam de decisão/)`, clique no link "Migrar ›", URL vira `/migration`, `role="status"` com texto "0 de 2 revisadas" (progresso comeca em 0, nao "1 de 2" como no fluxo legado — mudanca de semantica: o ritual novo nao pre-seleciona/avanca o primeiro item automaticamente).
- Teste "migra tarefa solta para hoje": clique em "Migrar para hoje" real (nao mais atalho de teclado `1`), checa "Migração concluída" + navegacao de volta a `/today` + ausencia do banner.
- Teste "migra tarefa iniciada (/) para hoje": mesma adaptacao, preserva a asercao central (status `started` herdado, nao resetado a `pending`).
- Teste "Pausar preserva decisoes": `Escape` → botao "Pausar"; validacao de retomada mostra as duas tarefas ainda pendentes (sem reabrir exatamente a mesma posicao, condizente com a semantica "sem posicao exata" da spec).
- Teste "migrar um pai recria so o filho pendente": mesma adaptacao de clique.
- Teste "'Escolher destino...' -> aba 'Dia no mes'": trocado o `<input type="date">` do fluxo legado por interacao real com o `DestinationPicker` (`gridcell` + botao "Migrar para...").

**Funcoes, classes e importacoes especificas**

- Mesmos helpers (`seedYesterdayQueue`, `syncAfter`) — nenhuma importacao nova.

**Comportamento de libs usadas**

- Playwright `getByRole('gridcell', { name: String(day), exact: true })`: seleciona a celula do dia corrente na grade do `DestinationPicker`, substituindo o preenchimento de `<input type="date">` do picker legado.

### `frontend/e2e/unified-migration-queue.spec.ts` (modificado)

**Funcao geral do arquivo**

Spec que prova que a fila unificada (`unified_migration_queue`) e os aliases legados (`migration/queue`, `catch-up/queue`) contam exatamente a mesma coisa no banco real — a "prova de matematica" da Story 14.3.

**Funcao geral da alteracao**

Atualizado para verificar a contagem pela NOVA superficie (um unico banner com `aria-label` somando as 3 fontes) em vez dos DOIS banners legados lado a lado; e a decidir pela UI nova (ritual roteado) em vez do atalho de teclado `1` dentro do `Dialog` legado — mantendo a mesma asercao de fundo (a decisao esvazia a fila unificada corretamente e nao grava `RitualDecision`).

**Blocos principais**

- Linha 4: remove `syncAfter` do import de `./fixtures` (nao mais usado neste arquivo, ja que a decisao agora e um clique simples sem necessidade da sincronizacao especial que o atalho de teclado exigia).
- Teste "o banner unificado (Story 14.9) e a fila unificada contam a mesma coisa": troca as duas asercoes de texto de banners separados por uma unica `banner.toHaveAccessibleName('4 tarefas precisam de decisão · 1 de meses · 1 de semanas · 2 de dias')` — mesma matematica, nova apresentacao.
- Teste "decidir pelo ritual roteado (Story 14.9) escoa a fila unificada": troca `getByRole('button', {name:'Iniciar', exact:true})` + `keyboard.press('1')` dentro de um `dialog` por `getByRole('link', {name:'Migrar ›'})` → `expect(page).toHaveURL('/migration')` → `getByRole('button', {name:'Migrar para hoje'})`. A validacao de back-end (re-derivacao da fila, secao `day` continua presente, nenhuma linha em `RitualDecision`) permanece inalterada.

**Funcoes, classes e importacoes especificas**

- `queueApi`, `topLevelIds`, `seedCatchUpScenario`, `seedYesterdayQueue` — todos ja existentes, sem mudanca de assinatura.

**Comportamento de libs usadas**

- Playwright `request` fixture (`APIRequestContext`) — usado, sem mudanca, para consultar os 3 endpoints (unificado + 2 aliases) diretamente via HTTP e comparar com o que a UI mostra.

---

## Observacoes finais

- Nenhum arquivo de codigo-fonte foi alterado durante a producao deste relatorio — a analise foi feita inteiramente por leitura (`git diff`, `Read`).
- Os arquivos legados citados na spec (`MigrationBanner.tsx`, `CatchUpBanner.tsx`, `MigrationFlow.tsx`, `MigrationCard.tsx`, `CatchUpFlow.tsx`) NAO aparecem em `git status` porque nao foram tocados — a alteracao neles e zero, exatamente como o padrao de rollback-por-arquivo das stories 14.5-14.8 exige.
- Nenhuma mudanca aparece em `schema.yaml`/`frontend/src/api/types.gen.ts` (`git status --short` nao lista nenhum dos dois) — consistente com a exigencia da spec de que esta story e frontend-only, sem tocar contrato OpenAPI.
