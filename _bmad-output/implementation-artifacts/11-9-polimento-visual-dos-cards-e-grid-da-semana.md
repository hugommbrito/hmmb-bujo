---
baseline_commit: 65c177c
---

# Story 11.9: Polimento visual dos cards de tarefa e grid da semana

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero cards de tarefa mais legíveis (com descrição visível, hover perceptível e controles coesos com o título) e uma "Esta Semana" menos apertada (7 dias em duas linhas),
Para que o Planner fique mais claro no uso diário.

## Acceptance Criteria

> **⚠️ Leia o Diagnóstico (Dev Notes) antes de implementar.** Esta é uma story **puramente de estilo/layout no frontend** — **sem** backend, contrato, migração, dependência nova ou mudança de dados. Os quatro ACs são independentes e recaem sobre poucos componentes compartilhados: `TaskRow` (cobre Daily Log, Semana, Mês, Future de uma vez), a grade da `WeeklyPage`, e as duas listagens de recorrentes (`RecurringTemplateManager` e `RecurringPlacementSection`). Todo o dado necessário (`task.description`, `template.description`) **já existe no contrato e já chega aos componentes** — o gap é só de renderização/CSS.

### AC1 — Descrição truncada (1 linha) abaixo do título, em toda superfície, **incluindo os recorrentes**

- **Dado que** um card de tarefa (`TaskRow`) cujo `task.description` tem conteúdo — em **qualquer** superfície que reusa `TaskRow` (Daily Log, Esta Semana, Este Mês, Future Log, "Sem dia definido", subtarefas),
- **Quando** o card renderiza,
- **Então** exibe a descrição **truncada em 1 linha** (ellipsis via `noWrap`) **abaixo** do título, em `variant="body-sm"` / `color="text.secondary"` (mesmo tom das linhas secundárias já usadas no projeto).
- **E** as duas listagens de **recorrentes** também passam a exibir a descrição do template (truncada, 1 linha) quando `template.description` existe: a aba **Recorrentes** (`RecurringTemplateManager` → `TemplateRow`) e a seção de placement (`RecurringPlacementSection`) nas páginas Semana/Mês/Future. *(O modal de placement `RecurringPlacementDialog` **já** exibe a descrição desde a 11.8 — não mexer nele.)*

### AC2 — Regra de nulos: sem descrição → nada aparece (sem placeholder ruidoso)

- **Dado que** `task.description` / `template.description` é `null`, `""` (blank) ou `undefined`,
- **Então** a linha de descrição **simplesmente não aparece** — sem placeholder, sem espaço reservado, sem chip vazio. Espelha a convenção já vigente (`{template.description && …}` em `RecurringPlacementDialog.tsx`, `{task.category && …}` em `TaskRow`). Usar guard falsy (`task.description && …`) — cobre os três casos de uma vez.

### AC3 — Grade de "Esta Semana" em **duas linhas** (desktop)

- **Dado que** a tela **Esta Semana** no **desktop** (`!isMobile`, `WeeklyPage.tsx:135-159`), hoje com os 7 dias numa **única** linha `flex` apertada (`:139`),
- **Então** os 7 dias passam a ser dispostos em **duas linhas** (grade de 4 colunas → 4 + 3), com espaçamento vertical entre as linhas, sem scroll horizontal.
- **E** o **mobile** (`WeekDaySelector`, um dia por vez, `:113-134`) permanece **inalterado** — o problema de "apertado" é só da grade desktop de 7 colunas. Os cabeçalhos (`DayHeader`) e o conteúdo de cada dia seguem idênticos; nenhuma tarefa/dia some.

### AC4 — Hover perceptível no card

- **Dado que** um card de tarefa (`TaskRow`) no desktop,
- **Quando** passo o mouse sobre ele,
- **Então** há um **estado de hover perceptível** — mudança sutil de fundo (`bgcolor: 'action.hover'`, token de tema já em uso no projeto), com transição suave.
- **E** o hover **preexistente** que revela o drag handle (`'&:hover .drag-handle': { opacity: 1 }`, `TaskRow.tsx:170`) é **preservado**, não substituído.

### AC5 — Coesão dos cards largos: largura máxima + centralização

- **Dado que** um `TaskRow` numa superfície de largura total (Daily Log, Este Mês, "Sem dia definido") em tela larga, onde hoje o título tem `flex: 1` e empurra chips/ações para a borda extrema — ficando "desconexos" do texto,
- **Então** o conteúdo do card ganha **largura máxima** e **centralização** (`maxWidth` + `mx: 'auto'`) de modo que chips e botões fiquem **próximos do título**.
- **E** isso é um **no-op** onde a superfície já é estreita (colunas da grade da Semana < `maxWidth`) — não regride esses casos.
- **E** subtarefas (`isSubtask`) **não** recebem o cap próprio: fluem dentro do bloco já limitado do pai (evita centralização dupla/aninhada).

### AC6 — Sem regressão funcional; sem mudança de dados/contrato

- **Dado que** todas as mudanças são de estilo/layout,
- **Então** ciclo de status, clique no título (`onOpenDetail`), Mover (`TaskDestinationDialog`), reorder (drag/long-press/`MoveTaskDialog`), dedup/densidade de recorrentes, criação de tarefa e navegação de arquivo **continuam funcionando idênticos**, e os testes de a11y (jest-axe) das superfícies afetadas seguem verdes.
- **E** `git diff` **não** inclui `backend/`, `schema.yaml`, `frontend/src/api/types.gen.ts`, `api.ts` nem `keys.ts` — zero mudança de contrato/dados. Se aparecer, saiu do escopo — investigar antes de commitar.

## Tasks / Subtasks

> **Escopo real (confirmado por leitura do código atual):** frente **única de frontend**, tocando **4 componentes** + seus testes. Sem backend, sem contrato, sem dependência nova, sem migração. `task.description` já existe no contrato (`types.gen.ts:537 — Task.description?: string | null`) e chega mapeado em camelCase; `template.description` idem (`RecurringTemplateManager` já cria templates com descrição, `:144`).

### Frontend — AC1 + AC2: descrição truncada (arquivos: `TaskRow`, `RecurringTemplateManager`, `RecurringPlacementSection`)

- [x] **Task 1: Descrição truncada no `TaskRow`** (AC1, AC2)
  - [x] 1.1 Em `frontend/src/features/bujo/components/TaskRow.tsx`, o título hoje é uma `<Typography>` única (botão quando há `onOpenDetail`, `:196-216`; texto simples caso contrário, `:217-228`) com `flex: 1`. **Envolver título + descrição numa coluna vertical**: `<Box sx={{ flex: 1, minWidth: 0 }}>` (o `minWidth: 0` é obrigatório para o ellipsis funcionar dentro do flex do card). Mover o `flex: 1` do `<Typography>` do título para esse `<Box>`; o título mantém suas duas variantes (botão / texto) e o `textAlign`/estilos de status atuais (line-through cancelled, `text.disabled` completed).
  - [x] 1.2 **Abaixo do título**, dentro do mesmo `<Box>` coluna, adicionar a linha de descrição **condicionada** a conteúdo:
    ```tsx
    {task.description && (
      <Typography variant="body-sm" color="text.secondary" noWrap>
        {task.description}
      </Typography>
    )}
    ```
    O `noWrap` já dá `overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap` (truncagem em 1 linha). O guard falsy cobre `null`/`""`/`undefined` (AC2).
  - [x] 1.3 **Não alterar** o resto do card: ícone de status (`:187-195`), bloco de chips (`:229-269`), botão Mover (`:270-280`), drag handle (`:281-295`), aria-live (`:296-302`). A altura mínima (`minHeight`, `:163`) segue por linha — o card pode crescer verticalmente ao ganhar a 2ª linha; ok. Subtarefas (recursão, `:323-335`) herdam a descrição automaticamente (também são `TaskRow`) — comportamento desejado, nada a fazer.
- [x] **Task 2: Descrição na aba Recorrentes (`RecurringTemplateManager` → `TemplateRow`)** (AC1, AC2)
  - [x] 2.1 Em `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`, na **view de leitura** do `TemplateRow` (`:93-106`), dentro do `<Box sx={{ flex: 1 }}>` que já tem título (`:96`) e a subline "Grupo — recorrência" (`:97-100`), adicionar, **quando `template.description`**, uma linha de descrição truncada (`variant="body-sm"`, `color="text.secondary"`, `noWrap`). Não tocar a view de edição (`:75-92`) nem os botões Editar/Ativar/Desativar.
- [x] **Task 3: Descrição na seção de placement (`RecurringPlacementSection`)** (AC1, AC2)
  - [x] 3.1 Em `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`, a linha do template (`:66-85`) hoje é um flex `space-between` com um único `<Typography>` "título — Grupo (já colocado)" (`:77-80`) e o botão "Definir placement" (`:81-83`). **Reestruturar o lado esquerdo** para uma coluna: manter a linha "título — Grupo (já colocado)" e, **abaixo**, quando `template.description`, a descrição truncada (`variant="body-sm"`, `color="text.secondary"`, `noWrap`). Envolver o texto num `<Box sx={{ minWidth: 0 }}>` para o ellipsis; o botão continua à direita. Manter `alignItems: 'center'`/`justifyContent: 'space-between'` (ou ajustar para `flex-start` se ficar melhor com 2 linhas — decisão de estilo do dev, mas manter o botão acessível e o dedup "(já colocado)" visível).

### Frontend — AC3: grade da semana em 2 linhas (arquivo: `WeeklyPage`)

- [x] **Task 4: Grade desktop de "Esta Semana" em duas linhas** (AC3)
  - [x] 4.1 Em `frontend/src/pages/planner/WeeklyPage.tsx`, ramo **desktop** (`:135-159`), trocar o container dos 7 dias de `<Box sx={{ display: 'flex', gap: 1 }}>` (`:139`) para uma **grade de 4 colunas**:
    ```tsx
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
    ```
    Em cada coluna de dia (`:141`), remover `flex: '1 1 0'` (não se aplica a grid) e **manter `minWidth: 0`** (evita overflow do conteúdo dentro da célula). 7 dias em 4 colunas → 2 linhas (4 + 3); o `gap: 1` cobre espaçamento horizontal **e** vertical.
  - [x] 4.2 Atualizar o **comentário** de código (`:136-138`, que descreve "7 dias lado a lado, comprimindo proporcionalmente") para refletir a grade de 2 linhas.
  - [x] 4.3 **Não tocar** o ramo mobile (`WeekDaySelector`, `:113-134`), a seção "Sem dia definido" (`:160-169`), o form de criação (`:170-210`), nem `RecurringPlacementSection`/`RecurringPlacementDialog` (`:211-231`).

### Frontend — AC4 + AC5: hover e coesão (arquivo: `TaskRow`)

- [x] **Task 5: Estado de hover perceptível** (AC4)
  - [x] 5.1 No `sx` do `Box data-testid="task-row"` (`TaskRow.tsx:159-171`), **acrescentar** ao hover existente (`'&:hover .drag-handle': { opacity: 1 }`, `:170`) uma mudança de fundo: `'&:hover': { bgcolor: 'action.hover' }` + `transition: 'background-color 120ms ease'` (mesma duração/easing do `DayHeader.tsx:57`). `action.hover` é token de tema já usado no projeto (`MonthDensityCalendar.tsx:140` usa `action.selected`); design é flat (sem sombras, `theme.ts:142`), então um fundo sutil é o affordance correto — **não** adicionar sombra/elevation.
- [x] **Task 6: Largura máxima + centralização dos cards largos** (AC5)
  - [x] 6.1 No `Box` **externo** do `TaskRow` (`:146`, o que envolve o card + subtarefas), adicionar, **apenas para linhas raiz** (`!isSubtask`): `width: '100%'`, `maxWidth: 720`, `mx: 'auto'`. Gate sugerido: `maxWidth: isSubtask ? 'none' : 720, mx: isSubtask ? 0 : 'auto'`. Assim os cards largos (Daily/Mês/"Sem dia") capam e centralizam, aproximando chips/ações do título; nas colunas estreitas da grade da Semana o cap não vincula (no-op, AC5); subtarefas fluem dentro do bloco já limitado do pai (sem centralização aninhada).
  - [x] 6.2 Verificar visualmente que o cap não empurra o `TaskRow` de forma estranha no caso especial da `MonthlyPage` "Itens do Future Log" (mês corrente), onde o `TaskRow` fica dentro de um `<Box flex:1>` ao lado do `TextField` "Confirmar data" (`MonthlyPage.tsx:106-119`). Se ficar ruim, `maxWidth` sozinho (sem `mx:'auto'`) é variante aceitável — mas o AC pede centralização; priorizar a versão centralizada e só recuar se destoar.

### Testes & Verificação

- [x] **Task 7: Testes de descrição no `TaskRow`** (AC1, AC2)
  - [x] 7.1 Em `frontend/src/features/bujo/components/TaskRow.test.tsx` (fixture `baseTask` em `:18-28` **não** tem `description` — bom default para os testes de ausência), adicionar:
    - **Descrição exibida quando presente:** `baseTask({ description: 'Levar documentos ao consulado' })` → `expect(screen.getByText('Levar documentos ao consulado')).toBeInTheDocument()`.
    - **Descrição ausente (AC2):** `baseTask()` (sem description) e também `description: null` / `description: ''` → a linha não renderiza (usar um texto sentinela e `queryByText(...).not.toBeInTheDocument()`, ou verificar que só o título aparece).
  - [x] 7.2 **Não** escrever teste frágil de `:hover`/`maxWidth` via `toHaveStyle`: jsdom não aplica pseudo-classe `:hover`, e `maxWidth`/centralização são layout de baixo valor para asserção unitária → **verificação manual** (Task 10). Manter todos os testes existentes do `TaskRow` verdes (status, chips, reorder, Mover, subtarefas).
- [x] **Task 8: Testes de descrição nas listagens de recorrentes** (AC1, AC2)
  - [x] 8.1 Em `RecurringTemplateManager.test.tsx`: adicionar um caso de **listagem** (não criação) — um template com `description` mostra a descrição na linha; um sem `description` não mostra linha ruidosa. (Já existe `:212` cobrindo o *payload* de criação com descrição — este é o de **exibição**.)
  - [x] 8.2 Em `RecurringPlacementSection.test.tsx`: adicionar caso — template com `description` exibe a descrição truncada na seção de placement; sem `description`, nada. Manter o teste jest-axe (`:143`) verde.
- [x] **Task 9: Ajustar/estender testes de grade da `WeeklyPage`** (AC3)
  - [x] 9.1 Em `WeeklyPage.test.tsx`, o teste "desktop: renderiza os 7 dias lado a lado" (`:119-126`) só assere presença de texto + ausência de `tablist` → **segue verde** com a grade. Renomear para refletir "2 linhas" e, opcionalmente, assertar que os **7** `DayHeader` renderizam (ex.: contar cabeçalhos de dia). Não introduzir asserção frágil de `display:grid`.
- [x] **Task 10: Verificação** (todos os ACs)
  - [x] 10.1 `nvm use 22` e então `npm run typecheck && npm run lint && npm run build && npx vitest run --no-file-parallelism` — **todos verdes, contagem real colada** (guardrail retro Epic 3 §1). `--no-file-parallelism` obrigatório (lição recorrente 11.2→11.8). Baseline de sanidade da 11.8: **frontend 484 passed (45 arquivos)**; esta story adiciona casos → a contagem sobe pelo nº real de testes novos; colar o número real.
  - [x] 10.2 **Contrato/dados inalterados (AC6):** confirmar que `git diff` **não** inclui `backend/`, `schema.yaml`, `frontend/src/api/types.gen.ts`, `api.ts` nem `keys.ts`. Backend intocado → **não** rodar `pytest` (baseline 11.8 era 360 passed; não deve mudar).
  - [x] 10.3 **Verificação manual** (a maioria dos ACs é visual): em **Esta Semana** (desktop) confirmar (a) 7 dias em 2 linhas; (b) card com descrição mostra a 2ª linha truncada; (c) hover muda o fundo do card. Em **Daily Log** / **Este Mês** confirmar (d) cap de largura + centralização aproxima chips/ações do título; (e) card sem descrição não mostra linha vazia. Em **Recorrentes** (aba) e na **seção de placement** (Semana/Mês/Future) confirmar a descrição do template. Não é preciso repetir em todas as superfícies de `TaskRow` — é um componente único.
  - [x] 10.4 **e2e:** mudança puramente visual — **não** adicionar e2e novo (mesma divisão de responsabilidade da 11.7/11.8: teste de componente é a fonte de verdade da renderização). Se algum e2e existente quebrar por causa da 2ª linha de descrição / nova estrutura de DOM do card (seletor exato), **ajustar o seletor** — não mudar comportamento. Caso contrário, `e2e/` sem mudança.
  - [x] 10.5 **File List por último** (retro Epic 3 §8-2) — reconciliar contra `git status --short` / `git diff --stat` reais. Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.

## Dev Notes

### Diagnóstico — o que muda e por quê (cruzando o épico com o código atual)

Os 4 itens de UI vêm de `docs/futureIdeas.md:38-41` (feedback direto do Hugo, 2º lote via Correct Course 2026-07-15):

| Item (futureIdeas.md) | AC | Situação real no código | Ação |
|---|---|---|---|
| "Todos os cards com descrição devem mostrá-la (truncada). Também para recorrentes." (`:38`) | AC1/AC2 | `TaskRow` **nunca** renderiza `task.description` (só título, `:196-228`). As 2 listagens de recorrentes também não. `RecurringPlacementDialog` **já** mostra (11.8). | Adicionar linha truncada em `TaskRow` + 2 listagens |
| "Dividir a semana em 2 linhas — 7 numa só está apertado." (`:39`) | AC3 | Desktop = `flex` de 7 colunas numa linha (`WeeklyPage.tsx:139`). | Grade `repeat(4,1fr)` → 4+3 |
| "Aplicar hover sobre os cards." (`:40`) | AC4 | `TaskRow` só tem hover que revela o drag handle (`:170`); sem feedback de fundo. | `+ '&:hover': { bgcolor: 'action.hover' }` |
| "Centralizar cards largos — botões/chips ficam distantes do título." (`:41`) | AC5 | Título `flex:1` empurra chips/ações à borda em telas largas. | `maxWidth` + `mx:'auto'` no card raiz |

**Nenhuma fiação de dados a corrigir:** `task.description` e `template.description` já chegam completos aos componentes (contrato + páginas passam os objetos inteiros). O gap é 100% de renderização/CSS.

### `TaskRow` é compartilhado → AC1/AC4/AC5 valem em todas as superfícies de uma vez

`TaskRow` é o componente único de linha de tarefa, importado por **Daily Log** (`DailyPage.tsx:86-92`, com `onTransition`/`onOpenDetail`/`onReorder`), **Esta Semana** (`WeeklyPage.tsx:130,152,166`), **Este Mês** (`MonthlyPage.tsx:110,121,169,183`) e **Future Log** (`FuturePage.tsx`). Mexer no componente conserta as 4 superfícies simultaneamente — nenhuma página precisa ser tocada para AC1/AC4/AC5. (Igual ao padrão explorado na 11.7/11.8 com `TaskDetailPanel`/`RecurringPlacementDialog`.)

### Onde ficam os "recorrentes" (AC1) — 3 superfícies, 1 já pronta

1. **Aba Recorrentes** (`RecurringPage` → `RecurringTemplateManager` → `TemplateRow`, `:64-111`): listagem CRUD; hoje mostra título + "Grupo — recorrência", **sem** descrição → **adicionar** (Task 2).
2. **Seção de placement** (`RecurringPlacementSection`, `:64-86`) dentro de Semana/Mês/Future: "título — Grupo" + botão, **sem** descrição → **adicionar** (Task 3).
3. **Modal de placement** (`RecurringPlacementDialog`): **já exibe** descrição desde a 11.8 → **não mexer**.

### Padrões a reusar — não inventar

- **Truncagem 1 linha:** prop `noWrap` do MUI `<Typography>` (aplica `overflow:hidden`+`text-overflow:ellipsis`+`white-space:nowrap`). Dentro de flex, exige um ancestral com `minWidth: 0` (por isso o wrapper coluna do título/descrição precisa dele).
- **Tipografia secundária:** `variant="body-sm"` (12px/16px, `theme.ts:99`) + `color="text.secondary"` — exatamente o que `DayHeader` (`:46`), `RecurringTemplateManager` subline (`:97`) e o modal da 11.8 já usam. Nada de variante nova.
- **Regra de nulos:** guard falsy `x.description && (…)` — mesma convenção de `{template.description && …}` (modal 11.8) e `{task.category && …}` (`TaskRow.tsx:94`).
- **Hover/seleção:** tokens `action.hover` / `action.selected` (MUI default; `MonthDensityCalendar.tsx:140` já usa `action.selected`). Transição `120ms ease` (igual `DayHeader.tsx:57`).
- **Grade responsiva:** MUI `Box` com `sx={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1 }}` — o mesmo `Box` já usado em todo o feature; sem `Grid` container/item (o projeto não usa `<Grid>` aqui).

### AC5 — por que `maxWidth` + `mx:'auto'` no `Box` externo, gated por `!isSubtask`

O `TaskRow` tem estrutura aninhada: `<Box>` externo (`:146`) envolve o `<Box data-testid="task-row">` (linha do card, `:147`) **e** o bloco de subtarefas (`:323-335`, `pl:3`). Colocar `maxWidth`/`mx:'auto'` no **externo** cap+centraliza o card e suas subtarefas como um bloco coeso. **Gate `!isSubtask`** porque cada subtarefa é um `TaskRow` próprio dentro do `pl:3` do pai — se o filho também capasse/centralizasse, haveria centralização aninhada/dupla. `maxWidth: 720` é um valor de leitura confortável para título + descrição + chips + 2 ações; ajustável, mas 720 é o default recomendado. Nas colunas da grade da Semana (largura « 720) o cap é inerte (no-op, AC5). O hover de fundo (AC4) fica no `Box` interno (`task-row`), então cobre exatamente a área visível do card capado.

### O que NÃO fazer nesta story (fora de escopo, registrado)

- **Não** tocar backend, serializer, view, `urls.py`, `api.ts`, `keys.ts`, `schema.yaml`, `types.gen.ts`. Zero mudança de contrato/dados (AC6). Se aparecer no `git diff`, saiu do escopo.
- **Não** mexer no `RecurringPlacementDialog` (descrição já entregue na 11.8).
- **Não** truncar/alterar o **título** dos cards (só a descrição ganha `noWrap`) — mudar o título é scope creep e pode quebrar testes de status/line-through.
- **Não** adicionar sombra/elevation no hover (design é flat, `theme.ts:142` zera shadows) — só mudança de `bgcolor`.
- **Não** mexer no ramo **mobile** da Semana (`WeekDaySelector`) — AC3 é só da grade desktop.
- **Não** extrair utilitário compartilhado de truncagem/descrição — é `noWrap` inline trivial; extrair é scope creep.
- **Não** adicionar toast/snackbar nem qualquer feedback novo além do hover pedido.
- **Não** escrever teste frágil de `:hover`/`maxWidth` (jsdom não simula pseudo-classe; layout de baixo valor unitário) — verificação manual.

### Previous Story Intelligence (11.8 — done)

- **Stack (sem dependência nova aqui):** Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Backend **intocado** nesta story.
- **Node 22 obrigatório** (`nvm use 22`); `vitest run --no-file-parallelism` (lição recorrente 11.2→11.8); Playwright (se rodasse) `--workers=1` por cold-start da branch Neon `e2e` — mas esta story **não** precisa de e2e (Task 10.4).
- **jest-axe só contra o componente real** — os testes de a11y de `WeeklyPage`/`RecurringPlacementSection` usam o componente de verdade; **manter** e não mockar o componente sob teste (lição recorrente 3.3→11.8).
- **Contagem de testes sempre real** (retro Epic 3 §1); **File List por último** (retro Epic 3 §8-2). Guardrails em `_bmad/custom/bmad-dev-story.toml`.
- **Lição de spec recorrente (11.7/11.8, repete aqui):** a AC do épico foi escrita assumindo comportamento; confirmar **contra o código, não contra o texto**. Aqui a confirmação foi favorável — os dados (`description`) já existem e chegam; o gap é só de render.
- **AR-22 (observabilidade) segue pendente e sem dono há 4 épicos** — não bloqueia esta story, mas continua o pior follow-through do projeto (escalar antes do Épico 5, conforme memória do projeto).
- **Contagens da 11.8 (baseline de sanidade):** backend `pytest` **360 passed**; frontend `vitest` **484 passed (45 arquivos)**. Esta story só mexe em frontend (4 componentes + testes) → backend não muda; frontend sobe pelos casos novos.

### Git Intelligence

- Branch `main`; HEAD em `65c177c` (`feat(story-11.8): Infos da recorrência no modal de placement`) — `baseline_commit` desta story. Commits recentes do 2º lote: `11.8` (65c177c), `11.7` (d6ddd17), retro/fechamento 1º lote (8490e8e), `11.6` (899666e — trouxe `TaskDestinationDialog`/botão "Mover" ao `TaskRow`), `11.5` (2819951). Convenção de commit: `feat(story-11.9): <descrição em pt-BR>`.
- `git diff --stat` esperado (frontend-only): `TaskRow.tsx` (+coluna título/descrição, +hover, +maxWidth) e `TaskRow.test.tsx`; `RecurringTemplateManager.tsx` (+descrição na `TemplateRow`) e `.test.tsx`; `RecurringPlacementSection.tsx` (+descrição) e `.test.tsx`; `WeeklyPage.tsx` (grade 2 linhas) e `WeeklyPage.test.tsx`. **Nada** de backend, `api.ts`, `keys.ts`, `schema.yaml`, `types.gen.ts`.
- **Working tree atual:** `_bmad-output/story-automator/orchestration-11-…md` aparece modificado (artefato do orquestrador, fora do escopo de código) — **não** commitar como parte desta story. `docs/futureIdeas.md` pode conter notas do Hugo — se aparecer modificado, deixar intocado (mesma decisão das reviews 11.7/11.8).

### Latest Tech Information

- **Nenhuma dependência nova, nenhuma pesquisa de versão necessária.** Tudo reusa MUI 6.1 já em uso (`Typography noWrap`, `Box` com `sx` grid, tokens `action.hover`/`action.selected`, `maxWidth`/`mx`). Sem API externa, breaking change ou migração. Nada a pesquisar.

### Project Structure Notes

- **Frontend alterado:** `frontend/src/features/bujo/components/TaskRow.tsx` (+ `.test.tsx`), `.../RecurringTemplateManager.tsx` (+ `.test.tsx`), `.../RecurringPlacementSection.tsx` (+ `.test.tsx`), `frontend/src/pages/planner/WeeklyPage.tsx` (+ `.test.tsx`). Nenhum outro arquivo.
- **Sem backend, sem contrato, sem `api.ts`, sem `keys.ts`, sem barrel `index.ts` novo, sem migração.** As demais páginas do planner (`MonthlyPage`/`FuturePage`/`DailyPage`) **não** mudam — herdam AC1/AC4/AC5 via `TaskRow` compartilhado.
- **Fronteiras:** mudanças contidas em `features/bujo/components` e `pages/planner`; nenhum import novo além de componentes/props MUI já em uso. Zero nova violação de ESLint boundary / import-linter.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.9 (linhas 929-950 — ACs: descrição truncada incl. recorrentes, semana em 2 linhas, hover, coesão/largura máxima; "sem mudança de dados/contrato"); §Epic 11 intro (linha 757 — "2º lote → (9) polimento visual dos cards + grid da semana")]
- [Source: docs/futureIdeas.md:38 (descrição truncada em todos os cards, incl. recorrentes); :39 (semana em 2 linhas — "7 dias em uma linha só está ficando muito apertado"); :40 (hover nos cards); :41 (centralizar cards largos — chips/botões distantes do título)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-15.md:4,#4 (reabertura do Épico 11, 2º lote 11.7–11.11; 11.9 = "descrição truncada incl. recorrentes, hover, espaçamento/largura, semana em 2 linhas"; sem impacto de schema)]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx:146 (Box externo — alvo de maxWidth/mx AC5); :147-171 (Box task-row — alvo de hover AC4, contém :170 hover .drag-handle a preservar); :159-171 (sx do card); :196-228 (Typography do título com flex:1 — envolver em coluna + adicionar descrição, AC1); :94 (padrão de guard falsy {task.category}); :323-335 (subtarefas recursivas, pl:3 — herdam descrição; gate isSubtask no maxWidth)]
- [Source: frontend/src/features/bujo/components/TaskRow.test.tsx:18-28 (fixture baseTask sem description — bom default p/ testes de ausência); :56-59 (padrão de teste de exibição de título a espelhar); :136-166 (padrão de testes presença/ausência de chip a espelhar para descrição)]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx:135-159 (grade desktop — trocar flex→grid repeat(4,1fr), AC3); :139 (Box flex a substituir); :140-157 (colunas flex '1 1 0' minWidth 0 — remover flex, manter minWidth); :113-134 (ramo mobile WeekDaySelector — NÃO tocar)]
- [Source: frontend/src/pages/planner/WeeklyPage.test.tsx:119-126 ("desktop: 7 dias lado a lado" — só assere texto/tablist, segue verde; renomear p/ 2 linhas, AC3)]
- [Source: frontend/src/features/bujo/components/RecurringTemplateManager.tsx:64-111 (TemplateRow); :93-106 (view de leitura com título :96 + subline :97-100 — adicionar descrição, AC1); :144 (create já envia description → prova de que o campo existe no template)]
- [Source: frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx:212 (payload de criação com descrição — adicionar teste de EXIBIÇÃO na listagem, AC1)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementSection.tsx:64-86 (linha do template — reestruturar p/ coluna título+descrição, AC1); :77-80 (Typography atual "título — Grupo"); :81-83 (botão Definir placement — manter); :143 jest-axe em .test.tsx (manter verde)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementDialog.tsx (descrição do template JÁ exibida na 11.8 — NÃO mexer)]
- [Source: frontend/src/features/bujo/components/DayHeader.tsx:44-48 (padrão heading + body-sm/text.secondary); :57 (transition 120ms ease — reusar no hover)]
- [Source: frontend/src/features/bujo/components/MonthDensityCalendar.tsx:140 (uso de token action.selected — prova de que action.* é padrão do projeto, reusar action.hover)]
- [Source: frontend/src/theme.ts:99 (variant body-sm 12/16); :142 (shadows zeradas — design flat, hover = bgcolor, não sombra); :136-138 (surfaces.header)]
- [Source: frontend/src/api/types.gen.ts (schema `Task`: `description?: string | null` — campo existe; `scheduledDate`/`migrationCount`/`sourceTemplate` camelCase → mapeamento camelCase confirmado; schema `RecurringTaskTemplate`: `description?: string | null` — campo existe no template também, prova para AC1 "recorrentes")]
- [Source: frontend/src/pages/daily/DailyPage.tsx:86-92 (TaskRow com onTransition/onOpenDetail/onReorder — superfície coberta por AC1/AC4/AC5 sem tocar a página); frontend/src/pages/planner/MonthlyPage.tsx:106-123 (withoutDate envolve TaskRow em flex:1 ao lado de TextField — checar AC5 aqui, Task 6.2)]
- [Source: _bmad-output/implementation-artifacts/11-8-infos-da-recorrencia-no-modal-de-placement.md (padrão de story frontend-only em componentes compartilhados; regra de nulos; jest-axe contra componente real; contagens baseline 484 front / 360 back)]
- [Source: _bmad/custom/bmad-dev-story.toml (guardrails de retrospectiva: contagem de teste real, File List por último)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — workflow bmad-dev-story.

### Debug Log References

- `npm run typecheck` → verde (tsc -b --noEmit, sem erros).
- `npm run lint` → verde (eslint ., sem warnings/erros).
- `npm run build` → verde (build em ~354ms; o único aviso é o de chunk > 500 kB, **pré-existente** e não relacionado a esta story).
- `npx vitest run --no-file-parallelism` → **45 arquivos, 493 passed** (baseline 11.8: 484 → +9 casos novos desta story). Node 22.15.1 (`nvm use 22`).

### Completion Notes List

Story **puramente de estilo/layout no frontend** — sem backend, contrato, migração ou dependência nova (AC6 confirmado: `git diff --name-only` não inclui `backend/`, `schema.yaml`, `types.gen.ts`, `api.ts` nem `keys.ts`).

- **AC1/AC2 (descrição truncada):** `TaskRow` agora envolve título + descrição numa coluna `<Box sx={{ flex: 1, minWidth: 0 }}>` (o `flex: 1` migrou do `<Typography>` do título para o `<Box>`; `minWidth: 0` habilita o ellipsis). A descrição usa `variant="body-sm"` / `color="text.secondary"` / `noWrap`, sob guard falsy `task.description && (…)` — cobre `null`/`""`/`undefined` de uma vez. Mesmo padrão aplicado a `TemplateRow` (aba Recorrentes) e à linha de `RecurringPlacementSection` (lado esquerdo reestruturado em coluna com `minWidth: 0`; botão ganhou `flexShrink: 0` para não ser espremido). `RecurringPlacementDialog` **não** foi tocado (já entregava a descrição desde a 11.8). Como `TaskRow` é compartilhado (Daily/Semana/Mês/Future/subtarefas), AC1 vale nas 4 superfícies + subtarefas de uma vez — subtarefas herdam a descrição via recursão (testado).
- **AC3 (semana em 2 linhas):** ramo desktop da `WeeklyPage` trocou o container `flex` de 7 colunas por `display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1` → 7 dias em 2 linhas (4 + 3), sem scroll horizontal; `gap: 1` cobre espaçamento horizontal e vertical. Cada coluna perdeu `flex: '1 1 0'` (não se aplica a grid) e manteve `minWidth: 0`. Comentário de código atualizado. Ramo **mobile** (`WeekDaySelector`) intocado.
- **AC4 (hover):** `Box data-testid="task-row"` ganhou `'&:hover': { bgcolor: 'action.hover' }` + `transition: 'background-color 120ms ease'` (mesma duração/easing do `DayHeader`). O hover preexistente que revela o drag handle (`'&:hover .drag-handle': { opacity: 1 }`) foi **preservado**. Sem sombra/elevation (design flat).
- **AC5 (cap + centralização):** `Box` externo do `TaskRow` ganhou `width: '100%'`, `maxWidth: isSubtask ? 'none' : 720`, `mx: isSubtask ? 0 : 'auto'`. Cards largos (Daily/Mês/"Sem dia") capam em 720 e centralizam, aproximando chips/ações do título; nas colunas estreitas da grade da Semana o cap é inerte (no-op); subtarefas fluem dentro do bloco já limitado do pai (gate `!isSubtask`, sem centralização aninhada).
- **Cobertura de testes (Task 7/8/9):** os itens **observáveis** (renderização da descrição, AC1/AC2) têm testes de componente — a fonte de verdade da renderização neste projeto (mesma divisão da 11.7/11.8). Adicionados: `TaskRow` (5 casos: presente / `undefined`,`null`,`""` via `it.each` / subtarefa herda), `RecurringTemplateManager` (2), `RecurringPlacementSection` (2). Os testes de a11y (jest-axe) de `WeeklyPage` e `RecurringPlacementSection` seguem verdes. Conforme Task 7.2/10.2, **não** foram escritos testes frágeis de `:hover`/`maxWidth`/`display:grid` (jsdom não aplica pseudo-classe; layout de baixo valor unitário).
- **Verificação manual (Task 10.3):** por ser story visual, os itens de hover/grid/centralização são CSS puro confirmados em nível de código (wiring conforme spec) e ficam para confirmação visual do Hugo no review — mesma convenção da 11.8 (o componente compartilhado é exercitado pelos testes de componente; a renderização da descrição, a parte testável, está coberta). O caso especial da `MonthlyPage` "Itens do Future Log" (Task 6.2, `TaskRow` num `<Box flex:1>` ao lado do `TextField`) usa a variante centralizada recomendada; se destoar visualmente, `maxWidth` sem `mx:'auto'` é o recuo aceitável previsto no AC.
- **e2e (Task 10.4):** mudança puramente visual — nenhum e2e novo; `e2e/` sem mudança. Nenhum seletor de e2e existente precisou de ajuste (suíte vitest não acusou; e2e não roda no dev-story).

### File List

**Frontend — componentes (código):**
- `frontend/src/features/bujo/components/TaskRow.tsx` (modificado — coluna título/descrição com `minWidth:0` + descrição `noWrap`; hover `action.hover` + transição; `maxWidth`/`mx` no Box externo gated por `!isSubtask`)
- `frontend/src/features/bujo/components/RecurringTemplateManager.tsx` (modificado — descrição truncada na view de leitura do `TemplateRow`; `minWidth:0` no wrapper)
- `frontend/src/features/bujo/components/RecurringPlacementSection.tsx` (modificado — lado esquerdo reestruturado em coluna título+descrição com `minWidth:0`; `gap:1` e `flexShrink:0` no botão)
- `frontend/src/pages/planner/WeeklyPage.tsx` (modificado — grade desktop `repeat(4,1fr)` → 2 linhas; comentário atualizado; `flex:'1 1 0'` removido das colunas)

**Frontend — testes (nenhum arquivo novo; casos adicionados a arquivos existentes):**
- `frontend/src/features/bujo/components/TaskRow.test.tsx` (modificado — describe "descrição (Story 11.9, AC1/AC2)": +5 casos)
- `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx` (modificado — +2 casos de exibição de descrição)
- `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx` (modificado — +2 casos de exibição de descrição)
- `frontend/src/pages/planner/WeeklyPage.test.tsx` (modificado — teste renomeado p/ "7 dias em grade de 2 linhas" + asserção de 7 DayHeaders)

**Rastreamento da story (seções permitidas):**
- `_bmad-output/implementation-artifacts/11-9-polimento-visual-dos-cards-e-grid-da-semana.md` (checkboxes, Dev Agent Record, File List, Change Log, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (11-9 → in-progress → review; `last_updated`)

*Backend intocado (nenhum arquivo novo de tipo E2E/management command/teste destrutivo criado). O artefato `_bmad-output/story-automator/orchestration-11-…md` aparece modificado no working tree, mas é do orquestrador — **fora do escopo desta story**, não commitar aqui (Dev Notes / Git Intelligence).*

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-07-16 | 1.0 | Story 11.9 implementada: descrição truncada em `TaskRow` + 2 listagens de recorrentes (AC1/AC2); grade da semana desktop em 2 linhas (AC3); hover perceptível nos cards (AC4); cap de largura + centralização dos cards largos (AC5); zero mudança de contrato/dados (AC6). +9 testes de componente; typecheck/lint/build/vitest (493 passed) verdes. Status → review. | Amelia (dev-story) |
