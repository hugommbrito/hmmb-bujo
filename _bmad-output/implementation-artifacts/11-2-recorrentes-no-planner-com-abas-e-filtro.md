---
baseline_commit: 0abb9fa8f54e9fce4fff150d6a4941e600b888ee
---

# Story 11.2: Recorrentes no Planner com abas e filtro

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero gerenciar meus templates recorrentes dentro do Planner, organizados por tipo e com filtro de ativos,
Para que eu os encontre junto do resto do planejamento em vez de perdidos em Configurações (itens #2, #3 de `docs/futureIdeas.md`).

## Acceptance Criteria

### AC1 — Gestão de recorrentes migra de Configurações para o Planner

- **Dado que** a navegação do Planner,
- **Quando** acesso a aba/rota "Recorrentes",
- **Então** vejo a gestão de templates (o CRUD já existente da Story 4.5) ali,
- **E** a gestão deixa de existir em Configurações (que volta a placeholder / settings de conta).

### AC2 — Templates organizados por grupo com filtro de ativos

- **Dado que** a tela de Recorrentes,
- **Quando** ela carrega,
- **Então** os templates são organizados em abas por grupo (Semanal / Mensal / Anual),
- **E** um controle "mostrar inativos" inclui/exclui templates com `active=false` (padrão: só ativos).

## Tasks / Subtasks

> **Story só de frontend — nada de backend, schema ou contrato muda.** O endpoint `/api/bujo/recurring-templates/` (Story 4.5) já aceita os query params `active` e `recurrence_group`, e o hook `useRecurringTemplatesQuery({ active?, recurrenceGroup? })` já existe. Esta story **move** o CRUD de Configurações para o Planner e **reorganiza** a apresentação (abas + filtro). Não crie endpoint, model, serializer, migração nem regenere `schema.yaml`/`types.gen.ts`. Se você se pegar editando qualquer arquivo em `backend/`, parou de fazer esta story.
>
> **Decisão de filtragem (client-side, não por query param):** o `RecurringTemplateManager` continua fazendo **um único** `useRecurringTemplatesQuery()` (sem params, lista tudo) e filtra por grupo + `active` **no cliente**. Motivo: (a) mesma escolha "manter simples, filtrar client-side" já adotada em `RecurringPlacementSection` (Story 4.5, Task 12.1); (b) trocar de aba não dispara refetch nem novo estado de loading; (c) invalidação de cache permanece trivial (as mutations já invalidam `keys.bujo.recurringTemplates()` por prefixo). **Não** parametrize a query por aba.

- [ ] **Task 1: Reorganizar `RecurringTemplateManager` — abas por grupo + filtro "mostrar inativos"** (AC: #2)
  - [ ] 1.1 Em `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`, adicionar estado `const [group, setGroup] = useState<RecurrenceGroup>('weekly')` e `const [showInactive, setShowInactive] = useState(false)`.
  - [ ] 1.2 Renderizar `<Tabs value={group} onChange={(_, v) => setGroup(v)} aria-label="Grupo de recorrência">` com três `<Tab value="weekly" label="Semanal" />` / `"monthly"` / `"annual"` — reutilizar `RECURRENCE_GROUP_LABEL` (já definido no arquivo) para os rótulos. **Primeira ocorrência de `Tabs` no projeto** (confirmado por grep) — importar de `@mui/material`; MUI 6.1 já gera o `role="tablist"`/`role="tab"`/`aria-selected` corretos. Passar `aria-label` no `<Tabs>` é obrigatório (baseline WCAG 2.2 AA, Story 2.4).
  - [ ] 1.3 Filtrar a lista antes de mapear: `templates.data.filter((t) => t.recurrenceGroup === group && (showInactive || t.active))`. A mensagem de estado vazio ("Nenhum template cadastrado.") passa a ser por-aba: se a lista filtrada for vazia (e a query não estiver `isPending`), mostrar mensagem — considerar texto "Nenhum template neste grupo." (mais preciso agora que a lista é segmentada por aba). Se `showInactive` estiver desligado e existirem só inativos no grupo, a mensagem aparece igual (comportamento correto: eles estão filtrados fora).
  - [ ] 1.4 Adicionar o controle "mostrar inativos" como `<FormControlLabel control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label="Mostrar inativos" />` (usar `Switch`, não `Checkbox`, para distinguir visualmente do checkbox "Ativo" do form de criação; ambos existem em `@mui/material`). Posicionar acima ou ao lado da lista, dentro da aba corrente. Padrão inicial `false` = **só ativos** (AC #2).
  - [ ] 1.5 **Form de criação segue o grupo da aba ativa:** remover o `<Select>` de "Grupo de recorrência" do form (redundante com as abas) e usar `group` (estado da aba) como `recurrenceGroup` no `createTemplate.mutate({ ..., recurrenceGroup: group, ... })`. Assim, criar um template na aba "Mensal" nasce `monthly`. Remover também o estado `recurrenceGroup`/`setRecurrenceGroup` do form (substituído por `group`). **Regressão a preservar:** o teste existente `criar template via form chama a mutation com os campos certos` espera `recurrenceGroup: 'weekly'` — com a aba default `weekly`, o comportamento se mantém (ver Task 4.1).
  - [ ] 1.6 A `TemplateRow` (edição inline + toggle `active`) **não muda** — continua recebendo um `template` e chamando `useUpdateRecurringTemplateMutation`. O toggle "Desativar"/"Ativar" continua funcionando; com `showInactive=false`, desativar um template o remove da view imediatamente após a invalidação de cache (comportamento correto e esperado).

- [ ] **Task 2: Nova página do Planner `RecurringPage` + rota + item de navegação** (AC: #1)
  - [ ] 2.1 Criar `frontend/src/pages/planner/RecurringPage.tsx` — casca fina no mesmo molde de `WeeklyPage`/`SettingsPage`: `<Box component="main" aria-label="Recorrentes" sx={{ p: 3 }}>` com um `<Typography variant="h5" gutterBottom>Recorrentes</Typography>` (mesmo padrão de header de `SettingsPage`, ver Dev Notes sobre o `variant="heading"` interno do manager) compondo `<RecurringTemplateManager />` (importado do barrel `../../features/bujo`). **Nota:** o `RecurringTemplateManager` já renderiza internamente um `<Typography variant="heading">Recorrentes</Typography>` (título de seção). Ter dois "Recorrentes" (h5 da página + heading da seção) é redundante — **decisão:** remover o `<Typography variant="heading">Recorrentes</Typography>` de dentro do `RecurringTemplateManager` (Task 1) e deixar o título só na página (`RecurringPage`), já que o manager agora é a única seção e ganha as abas logo no topo. Atualizar o teste do manager que dependa desse heading (Task 4.1).
  - [ ] 2.2 Em `frontend/src/app/router.tsx`: importar `RecurringPage` e adicionar a rota `{ path: 'planner/recurring', element: <RecurringPage />, handle: { title: 'Recorrentes' } }` dentro do grupo Planner (junto de `planner/week`/`planner/month`/`planner/future`).
  - [ ] 2.3 Em `frontend/src/app/layout/Sidebar.tsx`: adicionar `{ label: 'Recorrentes', path: '/planner/recurring', icon: <EventRepeatIcon /> }` ao array `plannerItems` (linhas 52-56). Importar `EventRepeatIcon` de `@mui/icons-material/EventRepeat` (confirmado disponível; `RepeatIcon` já está em uso por "Hábitos", então usar `EventRepeat` para não colidir visualmente). Posicionar como último item do grupo Planner (depois de "Futuro").
  - [ ] 2.4 `BottomNav.tsx` **não muda**: `getCurrentTab` já mapeia qualquer `/planner*` para o tab "Planner" (índice 1) via `pathname.startsWith('/planner')`; a rota nova cai nesse guarda-chuva sem alteração.

- [ ] **Task 3: Remover a gestão de recorrentes de Configurações** (AC: #1)
  - [ ] 3.1 Em `frontend/src/app/router.tsx`: trocar a rota `settings` de `<SettingsPage />` de volta para `<PlaceholderPage title="Configurações" />` (o `PlaceholderPage` já é importado no arquivo — usado por Hábitos/Saúde/etc.). Remover o `import { SettingsPage } from '../pages/settings/SettingsPage'`.
  - [ ] 3.2 Apagar `frontend/src/pages/settings/SettingsPage.tsx` e `frontend/src/pages/settings/SettingsPage.test.tsx` (o diretório `pages/settings/` fica vazio — pode remover o diretório). **Justificativa:** a única razão de `SettingsPage` existir era hospedar o `RecurringTemplateManager` (Story 4.5, Task 11.2); com a migração para o Planner, Configurações volta ao placeholder até uma futura story de "settings de conta". Nenhum outro consumidor importa `SettingsPage` (confirmar com `grep -rn "SettingsPage" frontend/src` antes de apagar — só o `router.tsx` e o próprio teste devem aparecer).
  - [ ] 3.3 O item de navegação "Configurações" na `Sidebar` (linha 212, `path: '/settings'`) **permanece** — só a página por trás vira placeholder. Não remover o nav item.

- [ ] **Task 4: Testes** (AC: #1, #2)
  - [ ] 4.1 **Reescrever `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx`** para o novo layout (abas + filtro). Cobrir:
    - Abas renderizam (`role="tab"` com nomes "Semanal"/"Mensal"/"Anual"); a aba "Semanal" está selecionada por padrão (`aria-selected`).
    - Com dois templates de grupos diferentes na query, a aba default ("Semanal") mostra **só** o `weekly`; clicar na aba "Mensal" (`fireEvent.click`/`user.click` no `role="tab"` "Mensal") passa a mostrar **só** o `monthly`.
    - Filtro "mostrar inativos": por padrão (desligado) um template `monthly` inativo **não** aparece na aba "Mensal"; ligar o `Switch` "Mostrar inativos" o faz aparecer com o sufixo "(inativo)". (Reaproveitar `INACTIVE_TEMPLATE`, que já é `monthly`+`active:false`.)
    - Criar template na aba "Mensal" chama `mockCreateMutate` com `recurrenceGroup: 'monthly'`; na aba default (weekly), com `recurrenceGroup: 'weekly'` (preserva a asserção original). Como o `<Select>` de grupo foi removido, ajustar o teste para trocar de aba em vez de mudar o select.
    - Editar (`TemplateRow`) e toggle `active` seguem chamando as mutations com os mesmos payloads de antes (mantidos da suíte atual).
    - `jest-axe` no componente real (incluindo as `Tabs` — garante que a primeira adoção de tabs do projeto nasce sem violação de a11y). **Este teste só vale contra o componente de verdade, nunca mockado** (lição 3.3/4.1–4.5).
    - **Escopo de queries com labels duplicados:** com o form de criação e uma linha em edição coexistindo, "Título" aparece 2×; usar `getAllByLabelText` + índice (mesmo padrão já documentado no Debug Log da Story 4.5), ou escopar por `within(...)`.
  - [ ] 4.2 Criar `frontend/src/pages/planner/RecurringPage.test.tsx` (smoke de composição, molde de `SettingsPage.test.tsx` que está sendo apagado): mockar o barrel `../../features/bujo` com `RecurringTemplateManager: () => <div data-testid="recurring-template-manager" />`; assertar que o `<main aria-label="Recorrentes">` existe, que o título "Recorrentes" (h5) renderiza, e que o manager é montado; `jest-axe` sem violações.
  - [ ] 4.3 Atualizar `frontend/src/app/layout/Sidebar.test.tsx`: adicionar asserção de que o item "Recorrentes" aparece sob o grupo Planner expandido (junto de "Esta Semana"/"Este Mês"/"Futuro"). Conferir que os testes existentes de expandir/colapsar o grupo Planner continuam passando (o novo item entra no mesmo `Collapse`).
  - [ ] 4.4 **Mocks de barrel** (achado recorrente 4.3/4.4/4.5): `router.test.tsx` (linha 33) e `RouteAnnouncer.test.tsx` (linha 30) mockam `features/bujo` com `RecurringTemplateManager: () => null`. Esse export **continua existindo** (agora consumido por `RecurringPage` em vez de `SettingsPage`), então o mock permanece válido — **não remover**. Rodar os dois testes para confirmar que a mudança de rota (`settings` → placeholder, nova rota `planner/recurring`) não os quebra; se `router.test.tsx` asseverar algo sobre a rota `settings`/`SettingsPage`, ajustar (grep confirmou que hoje não há asserção sobre settings, mas revalide após a mudança).
  - [ ] 4.5 `grep -rn "SettingsPage" frontend/src` após apagar os arquivos — deve retornar **zero** ocorrências (garante que nenhum import órfão sobrou e o build/typecheck não quebra).

- [ ] **Task 5: Verificação final** (AC: #1, #2)
  - [ ] 5.1 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — colar a contagem **real** observada (guardrail retro Epic 3 §1; a suíte estava em 365 passed / 41 arquivos ao fim da 4.5 — o número muda: `SettingsPage.test.tsx` sai, `RecurringPage.test.tsx` entra, `RecurringTemplateManager.test.tsx` é reescrito, `Sidebar.test.tsx` ganha caso).
  - [ ] 5.2 **Backend não roda nesta story** (nenhum arquivo `backend/` tocado). Não é necessário `uv run pytest`; se por acaso algum arquivo backend aparecer no `git status`, é bug — reverter.
  - [ ] 5.3 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado): navegar por Planner → "Recorrentes" (novo item na sidebar). Confirmar: (a) o CRUD funciona ali (criar template `weekly` na aba Semanal, `monthly` na aba Mensal → cada um nasce no grupo certo); (b) trocar de aba mostra só os templates daquele grupo; (c) desativar um template o some da view com "mostrar inativos" desligado, e ligar o Switch o traz de volta com "(inativo)"; (d) ir em Configurações → agora é o placeholder (sem CRUD de recorrentes); (e) as seções de placement em "Esta Semana"/"Este Mês" continuam funcionando (regressão — não foram tocadas, mas confirmar que ainda listam ativos e colocam). Zero erros de console.
  - [ ] 5.4 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual, reconciliar contra o File List documentado. Confirmar que `pages/settings/` foi de fato removido (aparece como deleção no git).

## Dev Notes

### Esta é uma story de MOVIMENTAÇÃO + APRESENTAÇÃO, não de novo comportamento

Todo o backend e a camada de dados do frontend para recorrentes já existem e estão em produção (Story 4.5, `done`, deploy AR-21). O que muda aqui é **onde** o usuário acessa o CRUD (Configurações → Planner) e **como** os templates são apresentados (lista plana → abas por grupo + filtro de ativos). Nenhuma AC pede novo campo, novo endpoint ou nova regra de negócio. O risco desta story é de **regressão** (quebrar o CRUD que já funciona, ou o placement do Weekly/Monthly que consome os mesmos hooks), não de lógica nova.

### O que NÃO tocar (superfícies que consomem os mesmos hooks)

`RecurringPlacementSection.tsx` e `RecurringPlacementDialog.tsx` (usados por `WeeklyPage`/`MonthlyPage`) consomem `useRecurringTemplatesQuery({ active: true, recurrenceGroup })` e `usePlaceRecurringTemplateMutation` — **não alterar**. Eles são a "abertura de ciclo" da Story 4.5 e são ortogonais à gestão de templates. A única interação é via cache do TanStack Query: as mutations de create/update (disparadas na tela de Recorrentes) invalidam `keys.bujo.recurringTemplates()` por prefixo, o que **corretamente** revalida também as listas de placement — comportamento desejado e já existente, sem trabalho novo.

### Por que abas (Tabs) e não filtro por dropdown

A AC #2 diz literalmente "organizados em abas por grupo". `Tabs` do MUI é a materialização direta. É a **primeira** adoção de `Tabs` no projeto (grep confirmou zero usos), então:
- Importar `Tabs`/`Tab` de `@mui/material` (já é dependência, `^6.1.0`).
- MUI gera a semântica ARIA de tablist/tab/tabpanel automaticamente; ainda assim, `aria-label` no `<Tabs>` é obrigatório pelo baseline WCAG 2.2 AA (Story 2.4). Não é preciso `role`/`aria-*` manual nos filhos.
- O conteúdo abaixo das abas (lista filtrada + form) pode ficar num único container sem `role="tabpanel"` explícito por aba, já que o estado `group` reprocessa a mesma região — mantendo simples. Se o `jest-axe` (Task 4.1) reclamar de estrutura tab/tabpanel, envolver a região em `<Box role="tabpanel">` com `aria-label` do grupo corrente.

### Título "Recorrentes": um só, na página

Hoje o `RecurringTemplateManager` renderiza `<Typography variant="heading">Recorrentes</Typography>` internamente (era a seção dentro de `SettingsPage`). Agora que ele é o conteúdo inteiro de `RecurringPage`, mover o título para a página (`<Typography variant="h5">Recorrentes</Typography>`, mesmo padrão que `SettingsPage` usava para "Configurações") e remover o heading interno evita título duplicado. Os `variant="heading"`/`variant="body-sm"` são variantes **customizadas do tema** (`createBujoTheme`) — existem e são válidas; não trocar por `h6`/`body2` sem motivo. O header da página usa `variant="h5"` (variante MUI padrão) porque é o molde já estabelecido por `SettingsPage`.

### `EventRepeatIcon` para o nav item

`RepeatIcon` (`@mui/icons-material/Repeat`) já está em uso pelo item "Hábitos" na `Sidebar` (linha 21/64). Para "Recorrentes", usar `EventRepeatIcon` (`@mui/icons-material/EventRepeat`, confirmado presente em `node_modules`) — semanticamente "evento que se repete", distinto do repeat genérico de hábitos.

### Filtragem client-side (não por query param) — reforço

O hook `useRecurringTemplatesQuery` aceita `{ active?, recurrenceGroup? }` e o backend filtra por `?active=&recurrence_group=` (Story 4.5, Task 7.1). **Mesmo assim**, filtre no cliente: um único fetch de tudo + `.filter()` por `group`/`showInactive`. Isso espelha a decisão da própria 4.5 (`RecurringPlacementSection` faz um fetch só e filtra por `recurrenceGroups.includes(...)` no cliente para evitar N requisições) e mantém troca de aba instantânea, sem novo `isPending`. A query key sem params (`keys.bujo.recurringTemplates()` → `['bujo','recurringTemplates','list',{}]`) é a que as mutations já invalidam por prefixo — não introduza uma variante parametrizada que escaparia dessa invalidação.

### Previous Story Intelligence (4.5 — done; 11.1 — ready-for-dev, não bloqueia)

- **Stack:** Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Sem dependência nova nesta story.
- **Labels duplicados em teste** (Debug Log 4.5): quando o form de criação e uma linha em edição coexistem, "Título" aparece 2×; usar `getAllByLabelText`+índice ou `within(...)`. O MUI renderiza portais (Dialog) por último no DOM — relevante para Weekly/Monthly, mas aqui não há Dialog no manager.
- **`jest-axe` só pega violação real contra o componente de verdade** — nunca mockar o componente sob teste de a11y (lição repetida 3.3/4.1–4.5).
- **Mocks de barrel `features/bujo`** quebram silenciosamente quando um export some/entra e o mock não acompanha (achado recorrente 4.3/4.4/4.5). Aqui o export `RecurringTemplateManager` **continua** existindo — os mocks de `router.test.tsx`/`RouteAnnouncer.test.tsx` seguem válidos; só revalidar.
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1) — rodar `npm run test` de verdade antes de escrever Completion Notes.
- **File List por último** (retro Epic 3 §8-2) — `git status --short`/`git diff --stat` depois da verificação manual; guardrail ativo em `_bmad/custom/bmad-dev-story.toml`.
- **Story 11.1 (isolamento de teste E2E)** é independente desta: mexe em config/env/seed-plumbing do backend, não em `features/bujo`. Não há dependência nem conflito de arquivos. Esta story não depende da branch `e2e` estar pronta (não toca E2E specs).
- **Deploy AR-21 concluído** (2026-07-12); AR-22 (observabilidade) segue pendente, sem dono — não bloqueia esta story frontend-only.

### Git Intelligence

- Branch `main`; HEAD em `0abb9fa` (fechamento do Épico 4). Convenção de commit: `feat(story-11.2): <descrição em pt-BR>` (o `story-4.6`/`story-4.5` mostram o padrão `feat(story-N.M):`).
- Story anterior no Épico 11 (`11-1`) está `ready-for-dev`, ainda não commitada — não afeta os arquivos desta story (backend config vs. frontend UI).
- Zero mudança de schema/migração/contrato — diferente de toda story do Épico 4 que tocou dados. `git diff --stat` esperado: só arquivos em `frontend/src/` (+ deleção de `pages/settings/`).

### Project Structure Notes

- **Novos arquivos:** `frontend/src/pages/planner/RecurringPage.tsx` + `RecurringPage.test.tsx`.
- **Apagados:** `frontend/src/pages/settings/SettingsPage.tsx` + `SettingsPage.test.tsx` (diretório `pages/settings/` esvazia).
- **Alterados:** `frontend/src/features/bujo/components/RecurringTemplateManager.tsx` (+ `.test.tsx` reescrito), `frontend/src/app/router.tsx` (rota nova + rota settings revertida), `frontend/src/app/layout/Sidebar.tsx` (+ `Sidebar.test.tsx`).
- **Fronteiras (§7.2):** `pages/planner` compõe `features/bujo` (mesmo padrão de `WeeklyPage`/`MonthlyPage`). `features/bujo` não importa outra feature. Sem violação de ESLint boundary / import-linter (nada muda no backend). O barrel `features/bujo/index.ts` **não muda** — `RecurringTemplateManager` já é exportado (linha 27).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.2 (linhas 780-796 — abas por grupo, filtro "mostrar inativos", CRUD sai de Configurações); §Epic 11 (linha 757 — ordem por dependência, "número 11 é só identificador; executa antes do Épico 5")]
- [Source: docs/futureIdeas.md (itens #2, #3 — recorrentes perdidos em Configurações; organizar por tipo)]
- [Source: _bmad-output/implementation-artifacts/4-5-templates-de-tarefas-recorrentes-com-placement-manual.md#Tasks 10-11 (camada de dados + `RecurringTemplateManager` originais); #Dev Notes "Reaproveitamento obrigatório" (hooks e filtros já existentes)]
- [Source: frontend/src/features/bujo/components/RecurringTemplateManager.tsx (componente a reorganizar — abas + filtro; `RECURRENCE_GROUP_LABEL`/`EISENHOWER_LABEL` reaproveitados)]
- [Source: frontend/src/features/bujo/api.ts (`useRecurringTemplatesQuery({ active?, recurrenceGroup? })` já aceita filtros — usar sem params + filtrar client-side); frontend/src/api/keys.ts (`keys.bujo.recurringTemplates` — invalidação por prefixo)]
- [Source: frontend/src/pages/settings/SettingsPage.tsx (molde de casca de página + header `variant="h5"` — a ser apagado); frontend/src/pages/settings/SettingsPage.test.tsx (molde do smoke test de composição para `RecurringPage.test.tsx`)]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx (molde de página do Planner — `<Box component="main" aria-label>`)]
- [Source: frontend/src/app/router.tsx (rota `settings` a reverter para `PlaceholderPage`; grupo Planner onde entra `planner/recurring`); frontend/src/pages/PlaceholderPage.tsx (destino da rota settings)]
- [Source: frontend/src/app/layout/Sidebar.tsx (linhas 52-56 `plannerItems`; linha 212 item "Configurações" que permanece; linha 21 `RepeatIcon` já em uso por Hábitos → usar `EventRepeatIcon`); frontend/src/app/layout/Sidebar.test.tsx (casos de expandir/colapsar Planner a estender); frontend/src/app/layout/BottomNav.tsx (linha 14 `startsWith('/planner')` já cobre a rota nova — não muda)]
- [Source: frontend/src/app/router.test.tsx (linha 33 mock de barrel `RecurringTemplateManager: () => null` — segue válido); frontend/src/app/layout/RouteAnnouncer.test.tsx (linha 30 idem)]
- [Source: _bmad-output/planning-artifacts/architecture.md#7.2 (fronteiras: `features/<x>` não importa outra feature; `pages/*` compõe features)]
- [Source: _bmad-output/implementation-artifacts/2-4-baseline-de-acessibilidade-wcag-2-2-aa.md (baseline WCAG 2.2 AA — `aria-label` em `Tabs`, jest-axe como gate de a11y)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 ("contagem real de testes"), §8 ("File List por último") — guardrails em `_bmad/custom/bmad-dev-story.toml`]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
