# Explicação dos arquivos não commitados — Story 12.3: Manifest de collections, fatia 1 (pixel-idêntico)

## Visão geral

Fatia 1 do modelo **núcleo + collections** (FR-1, AD-17): extrai um **registro estático de
collections** em `frontend/src/app/collections/registry.ts` e faz o chrome legado (router,
Sidebar, BottomNav) **derivar** dele por map puro — com **zero mudança visível/comportamental**
(AC4, aceite mecânico "pixel-idêntico"). É um **refactor de contrato puro**: nenhuma Page,
nenhuma superfície visual e nenhum teste foram tocados; nenhum mock novo.

O objetivo é institucionalizar o DoD estrutural "**collection nova = pasta da feature + UMA
entrada neste registro**". Os consumidores reais do manifest (sidebar/bottom-nav do shell **novo**)
chegam nas Stories 13.2/13.3; a 12.3 só prova o registro cabeando o chrome atual a ele.

**Gate:** a suíte existente permanece verde sem alteração — **81 arquivos / 828 testes** (Vitest),
`tsc --noEmit` e `eslint` exit 0. Idêntico ao baseline pré-refactor (prova comportamental do
pixel-idêntico). Nenhum E2E novo (não há superfície/fluxo novo — justificado no test-summary).

## Ordem lógica de funcionamento

1. **Planejamento/status** — story file + `sprint-status.yaml`.
2. **Primitivo de dados (novo)** — `app/collections/registry.ts`: tipos + `collections[]` (dados puros).
3. **Router** — `router.tsx`: rotas de collection derivadas do registro (`flatMap`, lazy + Suspense).
4. **Sidebar** — `Sidebar.tsx`: itens de collection derivados via `collectionNavItem(id)`.
5. **BottomNav** — `BottomNav.tsx`: aba Hábitos + `TAB_PATHS` derivados do registro.
6. **Artefato de testes + orquestração** — `test-summary.md`, `_bmad-output/story-automator/*`.

---

## 1. Planejamento/status

### `_bmad-output/implementation-artifacts/12-3-manifest-de-collections-fatia-1-pixel-identico.md`
Story file (novo). 25 subtasks `[x]`; `Status: done`; Dev Agent Record com contagem real
(828 verdes, tsc/eslint OK) e a resolução inline da ambiguidade da aba "Saúde" (ver §5).

### `_bmad-output/implementation-artifacts/sprint-status.yaml`
`12-3-...: backlog → done`.

---

## 2. Primitivo de dados (novo)

### `frontend/src/app/collections/registry.ts` (NOVO)
**Função geral** — Manifest estático das 4 collections coded (Hábitos, Saúde-Métricas,
Medicamentos, Gratidão). **Dados puros**: sem hooks, sem TanStack Query, sem side effects no eval
do módulo (nada no top-level além de `React.lazy`, que só embrulha o `import()` sem executá-lo).

**Blocos principais**
- Tipos: `CollectionArchetype` (union de string literals, não enum), `CollectionNav`
  (`{ label, group?, order }`), `CollectionRoute` (path + componente lazy + `title`),
  `CollectionManifestEntry` (`{ id, name, icon, routes, nav, archetype, dashboardCard?, settingsSchema? }`).
  `dashboardCard`/`settingsSchema` são **reservados tipados** (`Record<string, never>`, opcionais)
  sem valor nesta fatia e sem consumidores (AC1/AC2/AC5).
- `export const collections: CollectionManifestEntry[]` com as 4 entradas + archetypes (Hábitos/
  Medicamentos/Gratidão = `coded_fixed`; Saúde-Métricas = `coded_user_fields`).
- Comentário de topo documenta o DoD (AC5) e a **ausência de flag de ativação** nesta fatia
  (gateamento futuro = consulta que *filtra* o registro, deferido ao Épico 10 — AD-17 item 6).

**Por que `app/collections/`** — os consumidores são o chrome (`router.tsx`, `layout/`), coerente
com "composição com dono" (§7.1/§7.2); a boundary do ESLint permite `app/` compor `pages/`. Sem
path aliases no projeto → imports relativos.

**Comportamento de libs** — `React.lazy(() => import(...).then(m => ({default: m.Named})))`: como as
Pages exportam **nomes** (não `default`), cada lazy mapeia o export nomeado — sem alterar as Pages (AC4).

---

## 3. Router

### `frontend/src/app/router.tsx`
**Alteração:** −70/+... — remove os 8 imports diretos das Pages de collection e as 8 entradas de
rota hardcoded; gera `collectionRoutes` por `collections.flatMap(c => c.routes.map(...))`, cada
elemento lazy sob `<Suspense fallback={null}>` (nada pintado durante o load → pixel-idêntico),
`handle.title` preservado. Rotas de **núcleo permanecem eager e hardcoded** (Suspense em `/today`
quebraria os testes síncronos de chrome — Risco crítico das Dev Notes). `routeDefinitions`/`router`
exportados preservados (AC3, AC4).

---

## 4. Sidebar

### `frontend/src/app/layout/Sidebar.tsx`
**Alteração:** `healthItems` (grupo Saúde) e as entradas Hábitos/Gratidão de `bottomItems` derivam do
registro via helper `collectionNavItem(id)` (lê label/ícone/path). **Sequência de render inalterada**
— só a fonte dos dados mudou; cabeçalho "Saúde", Planner, Brain Dump, Arquivo, Divider e Configurações
seguem chrome hardcoded. Imports diretos dos 4 ícones de collection removidos (AC3, AC4).

---

## 5. BottomNav

### `frontend/src/app/layout/BottomNav.tsx`
**Alteração:** a aba **Hábitos** lê label/ícone/path da entrada `habits`; `TAB_PATHS[2]/[3]` derivados
(`/habits`, `/health/metrics`); `getCurrentTab` (prefixos) inalterado. Import direto de `RepeatIcon`
removido.

**Resolução de ambiguidade (aba "Saúde") — confirmada pelo usuário (HugoMMBrito) 2026-07-23:** não
existe collection "Saúde" no registro — `saude` é apenas uma `nav.group` compartilhada por
`health-metrics` e `medications`. Label "Saúde" + ícone `FavoriteBorderIcon` são **chrome do grupo**
(Dev Notes explícitas). AC4 (pixel-idêntico) é a autoridade; `BottomNav.test.tsx` exige
`getByText('Saúde')`. Decisão: manter label+ícone hardcoded, derivar **só o path** (`/health/metrics`).

---

## 6. Artefato de testes + orquestração

- `_bmad-output/implementation-artifacts/tests/test-summary.md` — seção da 12.3: decisão "sem E2E novo"
  (refactor pixel-idêntico, superfícies já cobertas pela suíte inalterada) + verificação do gate (828 verdes).
- `_bmad-output/story-automator/orchestration-12-*.md` — documento de estado da run.

---

## Nota de processo

O code-review (story-automator-review) aprovou (0 CRITICAL → sprint-status/Status = done). A sessão de
review foi encerrada pelo orquestrador durante o bookkeeping final; o orquestrador **re-verificou a
suíte** após o encerramento — **81 arquivos / 828 testes verdes** (pixel-idêntico mantido). O veredito
autoritativo está no `sprint-status.yaml`. Nenhum comportamento de código-fonte foi alterado por este
relatório (documentação apenas).
