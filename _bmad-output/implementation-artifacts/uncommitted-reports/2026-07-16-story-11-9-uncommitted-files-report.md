# Explicação dos arquivos não commitados - Story 11.9 (Polimento visual dos cards e grid da semana)

## Visão geral

Story **puramente de estilo/layout no frontend** (sem backend, contrato, migração ou dependência nova). Quatro mudanças de UI, todas em componentes/páginas compartilhados:

1. **AC1/AC2** — descrição da tarefa/template exibida truncada (1 linha, `noWrap`) abaixo do título, sob guard falsy (`x.description && …`), em três superfícies: `TaskRow` (que cobre Daily/Semana/Mês/Future/subtarefas de uma vez), aba Recorrentes (`RecurringTemplateManager → TemplateRow`) e seção de placement (`RecurringPlacementSection`).
2. **AC3** — grade desktop de "Esta Semana" passa de `flex` (7 colunas numa linha) para `grid repeat(4, 1fr)` → 7 dias em 2 linhas (4 + 3).
3. **AC4** — hover perceptível no card (`bgcolor: 'action.hover'` + transição 120ms), preservando o hover que revela o drag handle.
4. **AC5** — cards de superfície larga ganham `maxWidth: 720` + `mx: 'auto'` (centralização), gated por `!isSubtask`.

Nenhum comportamento de dados foi alterado — `task.description` e `template.description` já chegavam completos aos componentes; o gap era 100% de renderização/CSS.

## Ordem lógica de funcionamento

1. Artefatos de rastreamento da story (status/sprint).
2. Componente compartilhado `TaskRow` (AC1/AC2/AC4/AC5) — conserta 4 superfícies de uma vez.
3. Listagens de recorrentes: `RecurringTemplateManager` e `RecurringPlacementSection` (AC1/AC2).
4. Página `WeeklyPage` (AC3, grade desktop).
5. Testes de cada camada.

## 1. Artefatos de rastreamento

### `_bmad-output/implementation-artifacts/11-9-polimento-visual-dos-cards-e-grid-da-semana.md`

**Função geral do arquivo:** spec da story (ACs, Tasks, Dev Notes, Dev Agent Record).
**Função geral da alteração:** Status `ready-for-dev` → `in-progress` → `review`; 31 checkboxes de Tasks/Subtasks marcados `[x]`; Dev Agent Record preenchido (Agent Model, Debug Log com contagens reais, Completion Notes por AC); File List reconciliada contra git; Change Log adicionado. `baseline_commit: 65c177c` preservado.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo:** rastreamento de status por story do sprint.
**Função geral da alteração:** `11-9-…` de `ready-for-dev` → `review`; comentário de `last_updated` atualizado. Demais entradas intocadas.

## 2. Componente compartilhado `TaskRow`

### `frontend/src/features/bujo/components/TaskRow.tsx`

**Função geral do arquivo:** componente único de linha de tarefa, reusado por Daily Log, Esta Semana, Este Mês, Future Log e (recursivamente) subtarefas.
**Função geral da alteração:** adiciona descrição truncada, hover de fundo e cap de largura — sem tocar ícone de status, chips, botão Mover, drag handle ou aria-live.

**Blocos principais**

- Box externo (raiz): `sx={{ width: '100%', maxWidth: isSubtask ? 'none' : 720, mx: isSubtask ? 0 : 'auto' }}` (AC5). Cap+centralização só nas linhas raiz; subtarefas fluem dentro do bloco já limitado do pai.
- `sx` do `Box data-testid="task-row"`: `+ transition: 'background-color 120ms ease'` e `+ '&:hover': { bgcolor: 'action.hover' }`, mantendo `'&:hover .drag-handle': { opacity: 1 }` (AC4).
- Bloco do título: envolvido em `<Box sx={{ flex: 1, minWidth: 0 }}>` (o `flex: 1` migrou do `<Typography>` do título para o Box; `minWidth: 0` habilita o ellipsis). Abaixo do título, `{task.description && <Typography variant="body-sm" color="text.secondary" noWrap>{task.description}</Typography>}` (AC1/AC2).

**Comportamento de libs usadas**

- MUI `Typography noWrap`: aplica `overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap` → truncagem em 1 linha (exige ancestral com `minWidth: 0` dentro do flex).
- Token de tema `action.hover`: fundo sutil padrão do MUI para hover (design flat, sem elevation).

## 3. Listagens de recorrentes

### `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`

**Função geral do arquivo:** CRUD de templates recorrentes (aba Recorrentes), com `TemplateRow` por template.
**Função geral da alteração:** na view de leitura do `TemplateRow`, o wrapper do texto ganhou `minWidth: 0` e uma linha de descrição truncada condicional (`{template.description && <Typography variant="body-sm" color="text.secondary" noWrap>…</Typography>}`). View de edição e botões intocados (AC1/AC2).

### `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`

**Função geral do arquivo:** lista templates recorrentes colocáveis no período (Semana/Mês/Future), delegando o placement via `onPlace`.
**Função geral da alteração:** o lado esquerdo de cada linha foi reestruturado de um único `<Typography>` para uma coluna `<Box sx={{ minWidth: 0 }}>` com a linha "título — Grupo (já colocado)" + descrição truncada condicional; o container ganhou `gap: 1` e o botão "Definir placement" ganhou `flexShrink: 0` (não ser espremido). Dedup "(já colocado)" preservado (AC1/AC2).

## 4. Página `WeeklyPage`

### `frontend/src/pages/planner/WeeklyPage.tsx`

**Função geral do arquivo:** página "Esta Semana" (ramo mobile: `WeekDaySelector`, um dia; ramo desktop: 7 dias).
**Função geral da alteração:** ramo desktop trocou `<Box sx={{ display: 'flex', gap: 1 }}>` por `<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>`; cada coluna de dia perdeu `flex: '1 1 0'` (não se aplica a grid) e manteve `minWidth: 0`. Comentário de código atualizado para descrever a grade de 2 linhas (AC3). Ramo mobile, seção "Sem dia definido", form de criação e `RecurringPlacementSection`/`Dialog` intocados.

## 5. Testes

### `frontend/src/features/bujo/components/TaskRow.test.tsx`

Novo describe "descrição (Story 11.9, AC1/AC2)": exibe a descrição quando presente; `it.each` para `undefined`/`null`/`""` (não renderiza, sem placeholder); subtarefa exibe a própria descrição (herança via recursão). Testes existentes (status, chips, reorder, Mover, subtarefas) intocados.

### `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx`

+2 casos de **exibição** (não criação): template com `description` mostra a descrição na linha; template sem `description` (null) não mostra linha ruidosa.

### `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx`

+2 casos: template com `description` exibe a descrição na seção; sem `description`, nada. Teste jest-axe preservado.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

Teste "desktop: 7 dias lado a lado" renomeado para "7 dias em grade de 2 linhas (AC3)" + asserção de que os 7 `DayHeader` renderizam (contando os botões "Colapsar lista de tarefas"). Sem asserção frágil de `display: grid`.

## Fora do escopo (não commitar nesta story)

- `_bmad-output/story-automator/orchestration-11-20260716-015115.md` — artefato do orquestrador story-automator, não faz parte desta story (Dev Notes / Git Intelligence).

## Verificação (contagens reais, Node 22.15.1)

- `npm run typecheck` → verde.
- `npm run lint` → verde.
- `npm run build` → verde (único aviso: chunk > 500 kB, pré-existente).
- `npx vitest run --no-file-parallelism` → **45 arquivos, 493 passed** (baseline 11.8: 484 → +9 casos novos).
- AC6: `git diff --name-only` **não** inclui `backend/`, `schema.yaml`, `types.gen.ts`, `api.ts` nem `keys.ts`.

Nenhum comportamento de código-fonte foi alterado além do estilo/layout descrito acima (mudanças de renderização/CSS; dados e contrato intactos).
