# Explicação dos arquivos não commitados — Story 11.9 (correções do code review)

## Visão geral

Este conjunto corrige o **Finding #1 (HIGH)** do code review da Story 11.9: a descrição das tarefas/templates era renderizada, mas **não truncava em 1 linha** e, nas superfícies editáveis, **não ficava abaixo do título** — ou seja, a AC1 não era entregue de fato, apesar de todos os testes passarem.

**Causa raiz (uma só, replicada em 3 componentes):** `variant="body-sm"` é uma **variante tipográfica custom** do projeto (`theme.ts:99`, via module augmentation). O MUI só mapeia variante→elemento HTML para as variantes **nativas** (`body1`/`body2`/`h1`…, em `defaultVariantMapping`); para qualquer variante custom sem prop `component`, o `Typography` cai no fallback **`<span>`**:

```js
// node_modules/@mui/material/Typography/Typography.js:166
const Component = component || (paragraph ? 'p' : variantMapping[variant] || defaultVariantMapping[variant]) || 'span';
```

Em `display: inline`, `overflow` e `text-overflow` **não se aplicam** (CSS 2.1 §11.1.1 e CSS-UI §5.2 — valem para block containers). Portanto o `noWrap` do MUI, que injeta `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`, só entregava o `white-space:nowrap`: **texto em 1 linha, sem ellipsis, vazando horizontalmente**.

Efeito colateral pior: como o título do card é `inline-block` (`<Typography component="button">`, presente em Daily/Semana/Mês — todas as superfícies com `onOpenDetail`), título e descrição caíam no **mesmo inline formatting context** e renderizavam **lado a lado, sem espaço entre eles**:

```html
<button ...>Titulo</button><span class="...MuiTypography-noWrap...">Levar documentos ao consulado</span>
```

**Correção:** adicionar `component="div"` às 3 linhas de descrição — a convenção **já vigente** em todos os outros `body-sm` de bloco do projeto (`RecurringPlacementDialog.tsx:66,70,74`, `TaskDestinationDialog.tsx:104`, `MonthDensityCalendar.tsx:104`). O dev copiou `variant`/`color` do modelo da 11.8 e perdeu o `component`.

Também corrige o **Finding #2 (MEDIUM)**: os testes de AC1 assertavam apenas presença no DOM (`getByText`), logo passavam com ou sem truncagem — não podiam pegar o Finding #1.

**Nenhuma mudança de contrato, dados ou backend** (AC6 preservada). Mudança contida em CSS/estrutura de render.

## Ordem lógica de funcionamento

1. **Componente compartilhado de linha de tarefa** (`TaskRow.tsx`) — cobre Daily/Semana/Mês/Future/subtarefas de uma vez.
2. **Listagens de recorrentes** (`RecurringTemplateManager.tsx`, `RecurringPlacementSection.tsx`) — mesma correção, superfícies distintas.
3. **Testes** dos três, com a asserção de regressão que faltava.
4. **Artefatos de rastreamento** da story (review notes, status, sprint).

---

## 1. Frontend — componente compartilhado

### `frontend/src/features/bujo/components/TaskRow.tsx`

**Função geral do arquivo**

Componente único de linha de tarefa do BuJo. Renderiza ícone de status (com ciclo de clique), título (botão quando há `onOpenDetail`, texto simples caso contrário), descrição, chips (Eisenhower / status / contador de migração), botão "Mover", drag handle e região `aria-live`. Recursivo: subtarefas são `TaskRow` com `isSubtask`. Importado por `DailyPage`, `WeeklyPage`, `MonthlyPage` e `FuturePage` — por isso a correção vale nas 4 superfícies sem tocar nenhuma página.

**Função geral da alteração**

Adiciona `component="div"` ao `<Typography>` da descrição, fazendo o elemento sair de `<span>` (`display:inline`) para `<div>` (`display:block`) — condição necessária para o `noWrap` truncar com ellipsis e para a descrição ocupar sua própria linha abaixo do título.

**Blocos principais**

- Linhas 236-242: comentário ampliado, registrando *por que* `component="div"` é obrigatório (evita que a próxima edição o remova por parecer redundante).
- Linha 244: `<Typography variant="body-sm" color="text.secondary" component="div" noWrap>` — única mudança funcional.

**Funções, classes e importações específicas**

- `task.description && (…)`: guard falsy preservado (AC2) — cobre `null`, `""` e `undefined` de uma vez.
- `<Box sx={{ flex: 1, minWidth: 0 }}>` (linha ~204, inalterado): o `minWidth: 0` continua necessário, mas **não é suficiente** — ele permite ao flex item encolher abaixo do min-content, o que só habilita o ellipsis se o elemento de texto for bloco.

**Comportamento de libs usadas**

- `Typography` (MUI 6.1): a prop `noWrap` injeta `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` e a classe `MuiTypography-noWrap`. A prop `component` sobrescreve o elemento renderizado (via `as` do styled-engine) — é o único caminho para variantes custom, que não constam de `defaultVariantMapping`.

### `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`

**Função geral do arquivo**

Aba "Recorrentes": CRUD de templates recorrentes. `TemplateRow` tem view de leitura (título + subline "Grupo — recorrência" + descrição) e view de edição, além dos botões Editar/Ativar/Desativar.

**Função geral da alteração**

Mesma correção. Aqui o sintoma era ainda mais visível: a subline de recorrência (linha 97) **também** é um `<span>` inline, então dois `<span>` adjacentes renderizavam **na mesma linha**, colando os textos ("Semanal — toda segundaFechar pendências da semana").

**Blocos principais**

- Linhas 101-104: comentário explicando a razão do `component="div"`.
- Linha 106: `component="div"` adicionado.

**Nota de escopo:** o `<Typography variant="body-sm">` da subline (linha 97) **não** foi alterado. Ele não precisa de truncagem, e com a descrição virando `<div>` (bloco), o span da subline passa a formar uma anonymous block box entre dois blocos → volta a ocupar a própria linha. Alterá-lo seria scope creep.

### `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`

**Função geral do arquivo**

Seção "Recorrentes" embutida nas páginas Semana/Mês/Future: lista templates ativos do grupo, aplica dedup dos já colocados no período (com switch "Mostrar já colocados") e delega o placement à página via `onPlace`.

**Função geral da alteração**

Mesma correção. Aqui o título é `<p>` (variante nativa `body2`), então a descrição já caía abaixo — o defeito era **só** a ausência do ellipsis.

**Blocos principais**

- Linhas 84-87: comentário explicando a razão.
- Linha 89: `component="div"` adicionado.

---

## 2. Frontend — testes

### `frontend/src/features/bujo/components/TaskRow.test.tsx`

**Função geral do arquivo**

Suíte de componente do `TaskRow` — fonte de verdade da renderização neste projeto.

**Função geral da alteração**

Adiciona o caso de regressão que faltava para o Finding #1.

**Blocos principais**

- Linhas ~259-272: novo `it('a descrição é bloco com noWrap — sem isso não há truncagem em 1 linha (AC1)')`, assertando `window.getComputedStyle(description).display === 'block'` e a classe `MuiTypography-noWrap`.

**Por que estas asserções**

A Task 7.2 da story excluiu, com razão, testes frágeis de `:hover`/`maxWidth` — jsdom não aplica pseudo-classe nem faz layout, então não dá para assertar "o texto foi cortado em 1 linha". Mas **"é bloco + tem `noWrap`"** é a pré-condição binária, barata e estável da truncagem, e é exatamente o que estava quebrado. Verificado que o teste **falha** contra o código anterior (`AssertionError: expected 'inline' to be 'block'`) e passa com a correção — um teste de regressão que não falha contra o bug não vale nada.

### `RecurringTemplateManager.test.tsx` / `RecurringPlacementSection.test.tsx`

**Função geral da alteração**

Mesma asserção (`display === 'block'` + classe `noWrap`) embutida nos casos de exibição de descrição já existentes — sem `it` novo, para não inflar contagem sem ganho.

---

## 3. Artefatos de rastreamento

### `_bmad-output/implementation-artifacts/11-9-polimento-visual-dos-cards-e-grid-da-semana.md`

- `Status: review` → `done`.
- Nova seção **"Senior Developer Review (AI)"**: verificação com contagens reais, validação AC a AC contra o código, tabela de 4 findings (1 HIGH + 1 MEDIUM corrigidos; 2 LOW, sendo 1 corrigido e 1 registrado) e a lista de verificação visual pendente para o Hugo.
- **Debug Log**: contagem pós-review (**45 arquivos, 494 passed**).
- **Completion Notes**: anotadas as duas afirmações que a review invalidou (AC1 "entregue" e cobertura de testes).
- **File List**: reconciliada — marca os 3 componentes/3 testes tocados pela review e adiciona o report de uncommitted da dev-story, que estava faltando (Finding #3).
- **Change Log**: entrada 1.1 (code review).

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

- `11-9-polimento-visual-dos-cards-e-grid-da-semana`: `review` → `done`.
- `last_updated` atualizado.

---

## Fora do escopo deste commit

- `_bmad-output/story-automator/orchestration-11-20260716-015115.md` aparece modificado no working tree, mas é artefato do **orquestrador**, não da story — mesma decisão do commit `fc76f5f` da dev-story e das reviews 11.7/11.8. **Não commitar aqui.**
- `backend/bujo/views.py` e `backend/bujo/tests/test_views.py` aparecem no range `65c177c..HEAD`, mas vêm do commit `9d5ef75` (`fix(bujo): ordena listagem de recorrentes por recurrence_text`), independente desta story. AC6 permanece intacta.

## Validação executada

- `npm run typecheck` (tsc -b --noEmit): **0 erros**.
- `npm run lint` (eslint .): **0 erros/avisos**.
- `npm run build`: verde (aviso de chunk > 500 kB é pré-existente).
- `npx vitest run --no-file-parallelism` (Node 22.15.1): **45 arquivos, 494 passed**.
- Backend não reexecutado — nenhum arquivo backend tocado por esta story.
