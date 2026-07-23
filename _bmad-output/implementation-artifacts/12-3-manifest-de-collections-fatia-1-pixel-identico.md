---
baseline_commit: 781a77365a71c10ba3b88b587f61b4d4664a9021
---

# Story 12.3: Manifest de collections — fatia 1 (pixel-idêntico)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como desenvolvedor do projeto,
Quero um registro estático de collections em `src/app/collections/registry.ts` e a navegação (Sidebar, BottomNav) + rotas de collection derivadas dele,
Para que adicionar uma collection vire operação de baixo atrito (pasta da feature + UMA entrada), **sem nenhuma mudança visível agora** (FR-1.1, FR-1.2, FR-1.3, AR-23, AD-17, DIR-6, DIR-12a).

## Acceptance Criteria

**AC1 — Registro estático de dados puros**

**Dado que** as 4 collections coded existentes (Hábitos, Saúde-Métricas, Medicamentos, Gratidão),
**Quando** o registro `src/app/collections/registry.ts` é criado,
**Então** cada uma tem UMA entrada `{ id, name, icon, routes (referências lazy via React.lazy), nav: { label, group, order }, archetype, dashboardCard?, settingsSchema? }`,
**E** o registro é **dados puros** — sem hooks, sem TanStack Query, sem side effects no eval do módulo,
**E** `dashboardCard` e `settingsSchema` são **campos reservados tipados, sem consumidores nesta fatia** (só a tipagem existe).

**AC2 — Taxonomia como tipo (FR-1.2)**

**Dado que** a taxonomia de 4 archetypes do FR-1.2,
**Quando** o tipo do registro é declarado,
**Então** `archetype ∈ { 'coded_fixed' | 'coded_user_fields' | 'coded_integration' | 'custom_container' }` (union de string literals),
**E** cada collection recebe seu archetype: Hábitos = `coded_fixed`, Saúde-Métricas = `coded_user_fields` (campos definidos pelo usuário — AD-01/AD-14), Medicamentos = `coded_fixed`, Gratidão = `coded_fixed`.

**AC3 — Navegação e rotas derivadas + núcleo fora do registro**

**Dado que** a navegação atual (Sidebar, BottomNav) e as rotas de collection do router,
**Quando** Sidebar, BottomNav e as rotas de collection passam a derivar do registro por **map puro**,
**Então** o núcleo BuJo (Hoje, Planner e seus filhos, Brain Dump, Arquivo, Configurações) permanece **fora** do registro — mantém rotas/navegação próprias no `router.tsx`/`Sidebar.tsx`/`BottomNav.tsx` (FR-1.1 — não-gateável por construção),
**E** **não existe flag de ativação nesta fatia** — todas as collections ficam implicitamente ativas (a ativação futura = consulta separada que *filtra* o registro, deferida ao Épico 10 — AD-17 item 6).

**AC4 — Aceite mecânico: pixel-idêntico**

**Dado que** o aceite da fatia 1 é **pixel-idêntico**,
**Quando** a story é revisada,
**Então** o diff toca apenas o registro novo + a substituição dos dados de navegação/rotas por derivação do registro nos arquivos de chrome (`router.tsx`, `Sidebar.tsx`, `BottomNav.tsx`) — **zero alteração em componentes de tela/superfícies visuais** (Pages, cards, tabs),
**E** a suíte de testes de frontend passa **sem update** e os 3 testes compartilhados (`AppLayout.test.tsx`, `router.test.tsx`, `RouteAnnouncer.test.tsx`) + os testes de `Sidebar.test.tsx`/`BottomNav.test.tsx` passam **sem mocks novos** e sem edição de asserts (dados puros — nenhum TanStack Query novo entra pela navegação).

**AC5 — DoD estrutural documentado**

**Dado que** o DoD estrutural do modelo núcleo+collections,
**Quando** a story encerra,
**Então** o próprio `registry.ts` documenta em comentário de topo: **"collection nova = pasta da feature + UMA entrada neste registro"**.

## Tasks / Subtasks

- [x] **Task 1 — Criar o tipo + registro estático** (AC: #1, #2, #5)
  - [x] Criar `frontend/src/app/collections/registry.ts` com o comentário de topo do DoD (AC5).
  - [x] Declarar os tipos: `CollectionArchetype` (union), `CollectionNav` (`{ label, group?, order }`), `CollectionRoute` (path + componente lazy + `handle.title`), `CollectionManifestEntry` (`{ id, name, icon, routes, nav, archetype, dashboardCard?, settingsSchema? }`). Tipar `dashboardCard`/`settingsSchema` como reservados (`?`) sem valor nas entradas.
  - [x] Exportar `collections: CollectionManifestEntry[]` com as 4 entradas conforme a **Tabela de mapeamento** em Dev Notes.
  - [x] Usar `React.lazy(() => import('../../pages/...'))` para cada componente de rota. Importar os ícones MUI **exatamente** os mesmos usados hoje na Sidebar (ver tabela).
  - [x] Garantir eval sem side effects: nenhum hook, nenhum import de `@tanstack/react-query`, nenhuma chamada de função no top-level.

- [x] **Task 2 — Derivar as rotas de collection no router** (AC: #3, #4)
  - [x] Em `frontend/src/app/router.tsx`, remover os imports/entradas das 8 rotas de collection (`/habits`, `/habits/history`, `/health/metrics`, `/health/metrics/history`, `/health/medications`, `/health/medications/history`, `/gratitude`, `/gratitude/history`) e gerá-las por map puro a partir de `collections` (`collections.flatMap(c => c.routes)`).
  - [x] Envolver cada elemento lazy num `<Suspense fallback={null}>` compartilhado (fallback `null` = nada pintado durante o microtask de load → sem mudança visual). Preservar o `handle: { title }` de cada rota (o `RouteAnnouncer` lê `handle.title`).
  - [x] Manter **eager e hardcoded** todas as rotas de núcleo: `/login`, `/signup`, index→`/today`, `today`, `daily/:date`, `planner/*`, `brain-dump`, `archive` + `archive/weekly/:weekStart` + `archive/monthly/:monthFirst`, `settings` + `settings/*`, catch-all `*`. **Não converter rotas de núcleo para lazy** (ver Risco crítico em Dev Notes).
  - [x] Preservar a exportação `routeDefinitions` (os 3 testes a importam) e `router = createBrowserRouter(routeDefinitions)`.

- [x] **Task 3 — Derivar itens de collection na Sidebar** (AC: #3, #4)
  - [x] Em `frontend/src/app/layout/Sidebar.tsx`, substituir os dados hardcoded das 4 collections (`healthItems` e as entradas de Hábitos/Gratidão em `bottomItems`) por derivação do registro.
  - [x] Manter **hardcoded (chrome/núcleo)**: `Hoje`, o grupo colapsável **Planner** e seus filhos, os itens **Brain Dump** e **Arquivo**, o `Divider` e **Configurações**. Manter também o **cabeçalho do grupo "Saúde"** (label "Saúde" + ícone Favorite + comportamento colapsável `healthOpen`) como chrome — só os *filhos* (Métricas, Medicamentos) vêm do registro.
  - [x] **Reproduzir a sequência de render EXATA** (ver "Ordem visual obrigatória" em Dev Notes). Recomendado: manter a sequência explícita da Sidebar e apenas *ler* label/ícone/path de cada collection do registro (abordagem de menor risco visual). Não introduzir um motor de ordenação genérico nesta fatia (Occam — isso é trabalho da Story 13.2 no shell novo).
  - [x] Não introduzir nenhum hook/Query novo. `BrainDumpBadge` (item Brain Dump, núcleo) permanece como está.

- [x] **Task 4 — Derivar as abas de collection na BottomNav** (AC: #3, #4)
  - [x] Em `frontend/src/app/layout/BottomNav.tsx`, manter as **4 abas fixas** (Hoje, Planner, Hábitos, Saúde) — a curadoria de quais 4 abas é decisão de produto, fora de escopo (a generalização é da Story 13.3).
  - [x] Ler label/ícone/path da aba **Hábitos** da entrada de collection `habits` do registro, e da aba **Saúde** do grupo `saude` (path de entrada `/health/metrics`). Manter `TAB_PATHS` e a lógica de prefixo de `getCurrentTab` (`/today`→0, `/planner`→1, `/habits`→2, `/health`→3) idênticas em comportamento.
  - [x] As abas Hoje/Planner e o FAB de captura + `BrainDumpCaptureSheet` permanecem como estão (núcleo/chrome).

- [x] **Task 5 — Verificação pixel-idêntica + suíte verde** (AC: #4)
  - [x] `nvm use 22.15.1` antes de qualquer comando de frontend (o ambiente inicia em Node 18 — ver Dev Notes).
  - [x] Rodar `cd frontend && npm run test:run` → **toda a suíte verde**, com **zero edição** dos 5 arquivos de teste de chrome (`AppLayout.test.tsx`, `router.test.tsx`, `RouteAnnouncer.test.tsx`, `Sidebar.test.tsx`, `BottomNav.test.tsx`) e **zero mocks novos**.
  - [x] Rodar `npm run lint` (ESLint) e `npx tsc -p tsconfig.app.json --noEmit` (ou `npm run build`) → sem erros; a regra de boundary de ESLint continua verde (o registro vive em `app/`, que pode compor `pages/`).
  - [x] **Checkpoint do Risco crítico (React.lazy × RouteAnnouncer mobile):** confirmar que `RouteAnnouncer.test.tsx › RouteAnnouncer — mobile › test_anuncia_mudanca_de_superficie_ao_navegar_via_bottom_nav` passa sem edição. Se falhar **só** por timing de Suspense no assert `getAllByRole('main')`, **parar e escalar** (não editar o teste nem regredir o visual) — ver Risco crítico. → **PASSOU sem edição (35ms)**; o `<main aria-label="Hábitos">` monta de forma síncrona sob `act` (o `await user.click` flusha o microtask do `import()` já transformado pelo Vitest). Sem escalação.

## Dev Notes

### Contexto e fronteira da fatia

- Fatia 1 do modelo **núcleo + collections** (FR-1). Objetivo: extrair o manifest **sem nenhuma mudança visível**. É refactor puro de contrato. [Source: architecture.md#AD-17; epics.md#Epic-12 / Story-12.3]
- **Consumidores reais do manifest no shell NOVO** são as Stories **13.2** (sidebar nova derivada do manifest) e **13.3** (bottom-nav novo). A 12.3 apenas prova o registro cabeando o chrome **legado atual** (Sidebar/BottomNav/router) a ele, pixel-idêntico. Não construa o motor de navegação genérico aqui. [Source: epics.md#Story-13.2 (L2117-2133), #Story-13.3]
- **Backend:** nenhum modelo, nenhuma migration. Entrega 100% frontend. [Source: architecture.md#AD-17 item 7]

### Por que `src/app/collections/`

O registro vive em `app/` porque seus consumidores são o chrome (router, Sidebar, BottomNav) — coerente com "composição com dono" (§7.1/§7.2). `app/` já contém `router.tsx`, `layout/` e `providers/`; a regra de boundary do ESLint permite `app/` compor `pages/` (o `router.tsx` já importa Pages). **Sem path aliases no projeto** — use imports **relativos** (`./collections/registry` de dentro de `app/`, `../../pages/...` nos lazy imports). [Source: architecture.md#7.1 (L1621), #7.2 (L1649); exploração do frontend]

### Forma canônica do registro (AD-17 item 2)

```
{ id, name, icon, routes (React.lazy), nav: { label, group, order }, archetype, dashboardCard?, settingsSchema? }
```
- `id`: slug estável (`'habits'`, `'health-metrics'`, `'medications'`, `'gratitude'`).
- `name`: nome canônico da collection (= título de rota principal).
- `nav.label`: rótulo curto exibido na Sidebar (pode diferir de `name`).
- `nav.group`: chave do grupo colapsável (`'saude'`) ou ausente (item avulso).
- `nav.order`: índice para ordenação estável dentro do grupo/avulsos.
- `routes`: rotas **próprias da collection** (principal + histórico), cada uma com componente lazy + `handle.title`. **Escopo:** rotas de *settings* por-collection (`/settings/habits`, etc.) e sub-rotas de arquivo **permanecem no núcleo** (Configurações é chrome; a config por-collection é consumidor futuro de `settingsSchema`, sem consumidor nesta fatia). [Source: architecture.md#AD-17 itens 2, 5]
- `dashboardCard`/`settingsSchema`: **reservados tipados, sem consumidores** (consumidores futuros: home da Onda 2b e config por-collection). [Source: architecture.md#AD-17 item 2]

### Tabela de mapeamento (fonte da verdade — reproduzir EXATO)

| id | name | nav.label | nav.group | archetype | ícone Sidebar (import) | rotas (path → título → componente) |
|---|---|---|---|---|---|---|
| `habits` | `Hábitos` | `Hábitos` | — (avulso) | `coded_fixed` | `RepeatIcon` (`@mui/icons-material/Repeat`) | `habits` → "Hábitos" → `pages/habits/HabitsPage`; `habits/history` → "Hábitos — Histórico" → `pages/habits/HabitHistoryPage` |
| `health-metrics` | `Métricas de Saúde` | `Métricas` | `saude` | `coded_user_fields` | `ShowChartIcon` (`@mui/icons-material/ShowChart`) | `health/metrics` → "Métricas de Saúde" → `pages/health/HealthMetricsPage`; `health/metrics/history` → "Métricas de Saúde — Histórico" → `pages/health/HealthHistoryPage` |
| `medications` | `Medicamentos` | `Medicamentos` | `saude` | `coded_fixed` | `MedicationIcon` (`@mui/icons-material/Medication`) | `health/medications` → "Medicamentos" → `pages/health/MedicationsPage`; `health/medications/history` → "Medicamentos — Histórico" → `pages/health/MedicationHistoryPage` |
| `gratitude` | `Diário de Gratidão` | `Gratidão` | — (avulso) | `coded_fixed` | `SentimentSatisfiedAltIcon` (`@mui/icons-material/SentimentSatisfiedAlt`) | `gratitude` → "Diário de Gratidão" → `pages/gratitude/GratitudePage`; `gratitude/history` → "Histórico de Gratidão" → `pages/gratitude/GratitudeHistoryPage` |

> Atenção: `MedicationsPage`/`MedicationHistoryPage` vivem em `pages/health/` (não `pages/medications/`), embora a feature seja `features/medications/`. Confirme o caminho ao escrever o `React.lazy`. [Source: exploração — router.tsx L19-20, L112-121]

### Ordem visual obrigatória da Sidebar (pixel-idêntico)

A Sidebar hoje intercala arrays e grupos inline. Sequência a **reproduzir exatamente** (`Sidebar.tsx:153-217`):

1. `Hoje` (núcleo — `topItems`)
2. Grupo colapsável **Planner** (núcleo) → filhos: Esta Semana, Este Mês, Futuro, Recorrentes
3. **`Hábitos`** (collection — hoje `bottomItems.slice(0,1)`)
4. Grupo colapsável **Saúde** (cabeçalho = chrome) → filhos: **Métricas**, **Medicamentos** (collections do grupo `saude`)
5. **`Gratidão`** (collection — hoje `bottomItems.slice(1)[0]`)
6. `Brain Dump` (núcleo, com `BrainDumpBadge`) e `Arquivo` (núcleo) — hoje `bottomItems.slice(1)[1..]`
7. `Divider`
8. `Configurações` (núcleo)

Estados/comportamentos que **não** podem mudar: `aria-current="page"` no ativo, `borderLeft` primary + `fontWeight:700` no ativo, grupos iniciam abertos (`plannerOpen`/`healthOpen = true`), colapso via `[` fecha grupos e some com labels, `aria-label="Navegação principal"`. [Source: exploração — Sidebar.tsx:51-217; Sidebar.test.tsx]

### BottomNav (pixel-idêntico)

4 abas fixas, prefixos de `getCurrentTab` inalterados. Só **Hábitos** (aba 2) e **Saúde** (aba 3) são "de collection"; a **Saúde** representa o *grupo* (path de entrada `/health/metrics`, ícone `FavoriteBorderIcon` = chrome do grupo, ativa em prefixo `/health`). `aria-label="Navegação mobile"`, FAB "Captura rápida" e `BrainDumpCaptureSheet` intactos. [Source: exploração — BottomNav.tsx:14-56; BottomNav.test.tsx]

### 🚨 Risco crítico — React.lazy × testes síncronos

Hoje **nenhuma rota usa `React.lazy`/`Suspense`** (tudo eager). AD-17 exige rotas como referências lazy. Converter as rotas de **collection** para lazy é o pedido; **as rotas de núcleo devem continuar eager** (a rota `/today` é a mais testada — Suspense nela quebraria `router.test.tsx`/`RouteAnnouncer.test.tsx`).

Ponto sensível: `RouteAnnouncer.test.tsx › mobile › test_anuncia_mudanca_de_superficie_ao_navegar_via_bottom_nav` clica em "Hábitos" e, **de forma síncrona após `await user.click`**, verifica `expect(screen.getAllByRole('main')).toHaveLength(1)` — isto exige que a `HabitsPage` (`<main aria-label="Hábitos">`) já esteja montada. Com `/habits` lazy, o `<main>` só aparece após o microtask do `import()` resolver.

- Mitigação: `<Suspense fallback={null}>` (nada pintado durante o load) + o `handle.title` do RouteAnnouncer é lido do match **imediatamente** (não depende do componente carregar), então o assert de `role="status"` não corre risco. Na prática, `await user.click()` (envolto em `act`) tende a *flushar* o microtask do import já transformado pelo Vitest, e o `<main>` aparece — **verifique empiricamente na Task 5**.
- **Se, e somente se,** esse assert falhar por timing de Suspense: **PARE e escale como questão aberta.** O aceite mecânico (pixel-idêntico + testes de chrome sem edição) é a **autoridade máxima** desta story; não enfraqueça o teste nem regrida o visual para forçar o lazy. Documente a decisão (precedente 12.2: resolver questões abertas em favor do documento mais específico + código existente, registrando inline). [Source: exploração — RouteAnnouncer.test.tsx:118-128; router.test.tsx:63-107; AD-17 item 2]

### Testes existentes — o que preservar (NÃO há snapshots)

**Não existem testes de snapshot no projeto** (nenhum `.snap`, nenhum `toMatchSnapshot`). O "aceite de snapshot" do texto do épico se traduz, na prática, na **suíte comportamental** (Testing Library `getByRole`/`getByText` + `jest-axe`) que serve de prova do pixel-idêntico. Não procure/gere snapshots. [Source: exploração — vitest]

Por que os 3 testes compartilhados hoje **não** precisam de `QueryClientProvider`: eles **não** mockam TanStack Query diretamente; mockam os *barrels* que consomem Query (`../features/braindump` → `BrainDumpBadge`, e em router/RouteAnnouncer também `../features/bujo`, `../features/habits`, `TaskDetailPanel`). A lição recorrente do projeto (memória `[[sidebar-bottomnav-shared-tests-need-query-mock]]`): **filho novo com Query na Sidebar/BottomNav exige mocks nesses 3 testes**. O manifest é desenhado para **não** disparar isso — o registro é **dados puros**, então nenhum Query novo entra pela navegação e **nenhum mock novo é necessário**. Manter essa propriedade é o coração da AC4. [Source: architecture.md#AD-17 (L827); exploração — AppLayout.test.tsx, router.test.tsx, RouteAnnouncer.test.tsx; MEMORY]

- `AppLayout.test.tsx` renderiza a Sidebar/BottomNav **reais** com árvore de rotas inline; checa labels `Hoje`/`Planner` e branches desktop/mobile/tablet. Importar o registro na Sidebar não pode alterar isso (lazy não é avaliado ao montar só a nav).
- `router.test.tsx` e `RouteAnnouncer.test.tsx` importam `routeDefinitions` de `./router` — **preserve a exportação e o shape**.

### Comandos e ambiente

- **Node:** ambiente inicia em v18 sem `.nvmrc`; rodar **`nvm use 22.15.1`** antes de todo comando de frontend/e2e. [Source: MEMORY — [[frontend-needs-node-22-via-nvm]]]
- **Testes:** `cd frontend && npm run test:run` (Vitest one-shot; `fileParallelism:false`). Vitest **não** roda no CI — é rede de segurança local/code-review; rode localmente. [Source: exploração — package.json; architecture.md#7.4 CI (L1664)]
- **Types/lint:** `npm run lint` + checagem de tipos (`tsc -p tsconfig.app.json --noEmit` ou `npm run build`).

### Stack (versões)

React `19.2`, react-router-dom `6.30` (data router: `createBrowserRouter`/`RouteObject`), MUI `@mui/material 6.1` + `@mui/icons-material 6.5` (ícones por-ícone default import), Vite `8`, TypeScript `5.9` (`moduleResolution: bundler`, `verbatimModuleSyntax`), Vitest `4`, `@tanstack/react-query 5.59`. [Source: exploração — frontend/package.json, tsconfig.app.json]

### Inteligência da story anterior (12.2)

12.2 foi 100% backend (`waiting_on`), sem toques no frontend — pouca sobreposição técnica direta. Lição de processo reaproveitável: **resolver ambiguidades em favor do documento mais específico + código existente, documentando inline** (aqui, o documento mais específico é AD-17 + o texto do épico). [Source: 12-2-flag-waiting-on-no-backend.md#Completion-Notes]

### Project Structure Notes

- Novo arquivo: `frontend/src/app/collections/registry.ts` (diretório `collections/` novo dentro de `app/`). Alinhado a §7.1/§7.5 (`app/` = composição com dono). [Source: architecture.md#7.5 (L1689)]
- Arquivos de chrome que mudam (fonte de dados, não visual): `frontend/src/app/router.tsx`, `frontend/src/app/layout/Sidebar.tsx`, `frontend/src/app/layout/BottomNav.tsx`.
- **Nenhum** componente de tela (`pages/**`, `features/**`) deve ser alterado (AC4). Sem mudança de schema; sem migration; sem backend.
- Conflito/variância detectada: o texto do épico fala em "suíte de snapshots"; o projeto **não tem snapshots** — a prova do pixel-idêntico é a suíte comportamental + `jest-axe` (documentado acima; nenhuma ação de criar snapshots).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-12 / Story-12.3 (L1966-1991)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.2 (L2117-2133) — consumidor do manifest no shell novo]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-17 (L825-844) — registro estático, dados puros, taxonomia, núcleo fora, sem flag]
- [Source: _bmad-output/planning-artifacts/architecture.md#7.5 (L1688-1692) — `src/app/collections/registry.ts`; exceção "dados puros" é só C6]
- [Source: _bmad-output/planning-artifacts/architecture.md#7.1 (L1608-1638), #7.2 (L1640-1649) — estrutura frontend e boundaries]
- [Source: FR-1.1, FR-1.2, FR-1.3 — epics.md L50-52]
- [Source: frontend/src/app/router.tsx, frontend/src/app/layout/{Sidebar,BottomNav,RouteAnnouncer,AppLayout}.tsx e seus `*.test.tsx` — estado atual lido nesta análise]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, contexto 1M)

### Debug Log References

- `nvm use 22.15.1` + `npm run test:run` → **81 arquivos / 828 testes, todos verdes** (baseline pré-refactor: idêntico — 81 / 828). Contagem colada da execução real, não de memória.
- `npx tsc -p tsconfig.app.json --noEmit` → exit 0 (sem erros de tipo).
- `npm run lint` (`eslint .`) → exit 0 (boundary rule verde; registro em `app/` compõe `pages/`).
- Checkpoint do Risco crítico — `RouteAnnouncer.test.tsx › mobile › test_anuncia_mudanca_de_superficie_ao_navegar_via_bottom_nav` → **✓ 35ms** (assert `getAllByRole('main')` de tamanho 1 satisfeito sincronamente após `await user.click`).

### Completion Notes List

- **Registro estático criado** (`frontend/src/app/collections/registry.ts`) como **dados puros**: tipos (`CollectionArchetype` union, `CollectionNav`, `CollectionRoute`, `CollectionManifestEntry`) + `collections` com as 4 entradas da Tabela de mapeamento. `dashboardCard`/`settingsSchema` são reservados tipados (`Record<string, never>`, opcionais) sem valor nas entradas e sem consumidores nesta fatia (AC1, AC2, AC5). Comentário de topo documenta o DoD estrutural ("collection nova = pasta da feature + UMA entrada").
- **Sem side effects no eval**: nenhum hook, nenhum `@tanstack/react-query`, nenhuma chamada de função no top-level além de `React.lazy` (que só embrulha o `import()` sem executá-lo). Como as Pages exportam nomes (não `default`), cada `lazy` mapeia o export nomeado para `default` — **sem alterar as Pages** (AC4).
- **Router** (`router.tsx`): 8 rotas de collection substituídas por `collections.flatMap(c => c.routes)`, cada elemento lazy sob `<Suspense fallback={null}>`, `handle.title` preservado. Rotas de **núcleo permanecem eager e hardcoded**. Exportações `routeDefinitions` e `router` preservadas (AC3, AC4).
- **Sidebar** (`Sidebar.tsx`): `healthItems` (grupo Saúde) e as entradas Hábitos/Gratidão de `bottomItems` agora derivam do registro via helper `collectionNavItem(id)` que lê label/ícone/path. **Sequência de render inalterada** (só a fonte dos dados mudou) — cabeçalho "Saúde", Planner, Brain Dump, Arquivo, Divider e Configurações seguem chrome hardcoded (AC3, AC4).
- **BottomNav** (`BottomNav.tsx`): aba Hábitos lê label/ícone/path da entrada `habits`; `TAB_PATHS[2]`/`[3]` derivados (`/habits`, `/health/metrics`). `getCurrentTab` (prefixos) inalterado.
- **Resolução de ambiguidade documentada inline (aba Saúde da BottomNav)**: a Task 4 diz "ler label/ícone/path da aba Saúde do grupo `saude`", mas **não existe collection "Saúde"** no registro — `saude` é apenas uma `nav.group` compartilhada por `health-metrics` e `medications`. O label "Saúde" e o ícone `FavoriteBorderIcon` são **chrome do grupo** (Dev Notes › BottomNav é explícito: "ícone FavoriteBorderIcon = chrome do grupo"). Como AC4 (pixel-idêntico) é a autoridade máxima e `BottomNav.test.tsx` exige `getByText('Saúde')`, mantive label + ícone hardcoded e derivei **apenas o path** (rota principal da 1ª collection do grupo `saude` = `/health/metrics`). Precedente institucionalizado (Retro Epic 4 #3 / Story 12.2): resolver ambiguidade em favor do documento mais específico + código existente, documentando inline. Risco de mudança de 1 linha se o PO discordar.
- **Risco crítico (React.lazy × testes síncronos) — RESOLVIDO sem escalação**: o assert `getAllByRole('main')` do teste mobile passou. Empiricamente, `await user.click()` (envolto em `act`) flusha o microtask do `import()` transformado pelo Vitest e o `<main aria-label="Hábitos">` monta antes do assert síncrono — exatamente a mitigação prevista nas Dev Notes.
- **AC4 mecânico confirmado por `git diff`**: zero arquivos de teste modificados, zero arquivos de `pages/**` ou `features/**` (superfícies visuais) modificados, zero mocks novos. O diff toca só o registro novo + os 3 arquivos de chrome.

### File List

**Novo:**
- `frontend/src/app/collections/registry.ts` — manifest estático de collections (dados puros; tipo + registro). Diretório `app/collections/` criado.

**Modificado (chrome — fonte de dados, não visual):**
- `frontend/src/app/router.tsx` — rotas de collection derivadas do registro (`flatMap` + `<Suspense fallback={null}>`); imports das 8 Pages de collection removidos; `Suspense` importado.
- `frontend/src/app/layout/Sidebar.tsx` — `healthItems` e itens Hábitos/Gratidão derivados via `collectionNavItem`; imports diretos dos 4 ícones de collection removidos.
- `frontend/src/app/layout/BottomNav.tsx` — aba Hábitos e `TAB_PATHS[2]/[3]` derivados do registro; import direto de `RepeatIcon` removido.

**Tracking do workflow (não-código):**
- `_bmad-output/implementation-artifacts/12-3-manifest-de-collections-fatia-1-pixel-identico.md` — esta story (frontmatter `baseline_commit`, checkboxes, Dev Agent Record, Change Log, Status).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status 12.3 → in-progress → review.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-07-23 | 1.0 | Implementação da fatia 1 do manifest de collections: registro estático de dados puros (`app/collections/registry.ts`) + navegação (Sidebar/BottomNav) e rotas de collection derivadas dele, pixel-idêntico. Suíte 81/828 verde, typecheck e lint verdes, sem edição de testes nem mocks novos. Status → review. | Amelia (dev-story) |
| 2026-07-23 | 1.1 | Code review (story-automator-review): aprovado, 0 CRITICAL → sprint-status/Status = done. Suíte re-verificada pelo orquestrador após término da sessão: **81 arquivos / 828 testes verdes** (pixel-idêntico mantido). Obs.: a sessão de review foi encerrada durante a escrita do bookkeeping final — o veredito autoritativo (done) está no sprint-status.yaml; a seção detalhada de achados não foi persistida no story file. | code-review + orquestrador |
