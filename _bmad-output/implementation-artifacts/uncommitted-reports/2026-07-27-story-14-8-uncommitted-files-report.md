# Explicação dos arquivos não commitados — Story 14.8: Recorrentes no sistema novo (M09)

## Visão geral

A Story 14.8 é a **quarta superfície de tela do Épico 14**, depois do Weekly Board
(14.5), Monthly Board (14.6) e Future Log (14.7). Ela migra `/planner/recurring` para
uma **biblioteca** de templates recorrentes no sistema novo — abas por
`recurrence_group` (Semanal/Mensal/Anual), filtro "Mostrar inativos", criar/editar num
único card compartilhado, e exclusão lógica (soft delete) pela UI.

A diferença estrutural em relação às três anteriores é que **isto não é um planner nem
um ritual**: um template não tem status, data, log, linhagem nem subtarefas (AD-08 itens
1 e 8). Não há ciclo, densidade ou migração aqui. **Alocar continua sendo dos rituais** —
esta story não adiciona nenhum botão "Alocar" nem `RecurringPlacementDialog` novo, apenas
alimenta e referencia os templates que os rituais já colocam.

**Zero mudança de backend** — toda a story é frontend puro sobre o contrato REST que a
Story 14.4 já entregou (`DELETE` 204 idempotente incluído; o cliente é que nunca tinha
fiado o verbo).

Peças centrais:

- **`ItemRowBase`**: primeiro componente de RAIZ "sem máquina de estados" do sistema
  novo — irmã de `TaskRowBase`, não um fork. `DESIGN.md` L523 já o nomeia como
  componente de raiz para reuso futuro no Brain Dump (Épico 15) e em Settings (Épico 18).
- **Dois controles canônicos extraídos** de `TaskDetailCard.tsx` para módulos
  compartilhados (`CategorySwatchGroup`, `EisenhowerCheckboxPair`) — extração pura, sem
  mudança de comportamento, com `TaskDetailCard.test.tsx` permanecendo **byte a byte
  intocado** como prova de aceite.
- **`TemplateDetailCard`**: card de criar/editar template, irmão de `TaskDetailCard`
  (não um fork — os tipos de domínio são incompatíveis por design).
- **Exclusão lógica pela UI**: botão na edição → `alertdialog` de confirmação → `DELETE`.
- **Rename "Definir placement" → "Alocar"** fechado nos últimos 3 sítios de produção que
  restavam (AC5), com todos os asserts E2E que dependiam do texto antigo atualizados.

**Verificação (code-review desta story, gates re-executados do zero):** `tsc`/`lint`
limpos, `pytest -q` **1314 passed** (backend intocado, como a story exige), `npx vitest
run` **1748 passed / 131 arquivos**, `ruff`, `lint-imports` (1 kept/0 broken),
`makemigrations --check` limpo, diff de `schema.yaml`/`types.gen.ts` vazio. Playwright
combinado final (7 specs, `CI=1 --retries=0`): **38 passed / 5 failed em 43** — os 5
vermelhos seguem exatamente nos mesmos locators/posições que a AC9 previu, sem
regressão.

**Code review: 0 CRÍTICOS, 0 ALTOS.** 1 achado MÉDIO corrigido (o número combinado de
Playwright nunca tinha sido re-executado depois de os 2 testes do passo de QA entrarem —
mesma classe "número de gate afirmado sem execução" das 14.3/14.6, desta vez pega antes
de virar achado maior). Todos os demais números bateram exatamente com a re-execução
independente.

**Nenhuma migration nesta story.**

---

## Ordem lógica de funcionamento

1. Artefatos de story/status registram o escopo e o resultado.
2. A camada de API ganha a mutação de exclusão e a invalidação compartilhada.
3. Os dois controles canônicos são extraídos para módulos próprios.
4. `TaskDetailCard` passa a consumi-los (extração pura).
5. `ItemRowBase` nasce como componente de raiz para a linha de item.
6. `TemplateDetailCard` compõe os controles canônicos + `ItemRowBase`-adjacent.
7. O diretório `recurring/` compõe abas, skeleton, lista e as derivações puras.
8. `RecurringLibraryPage` orquestra tudo; router e shellRouting montam a rota.
9. O rename "Alocar" se propaga pelos componentes de placement e seus testes.
10. E2E cobre a biblioteca nova e reancora os specs afetados pela migração da rota.

---

## 1. Artefatos de planejamento e status

### `_bmad-output/implementation-artifacts/14-8-recorrentes-no-sistema-novo.md` (NOVO)

Especificação da story: 9 ACs / 11 tasks, Dev Notes, Dev Agent Record, File List,
Change Log, Questões abertas. Status atual: `done`.

### `_bmad-output/implementation-artifacts/tests/test-summary-14-8.md` (NOVO)

Relatório do passo de QA automatizado (`bmad-qa-generate-e2e-tests`): os 2 gaps reais
encontrados e fechados, com os experimentos de não-vacuidade.

### `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFICADO)

`14-8-recorrentes-no-sistema-novo` → `done`, com o resumo do code-review na mesma linha.

### `_bmad-output/story-automator/orchestration-14-20260725-024358.md` (MODIFICADO)

Log da orquestração: tabela de progresso e action log (as 4 tentativas de dev-story,
automate, code-review).

### `_bmad-output/implementation-artifacts/14-7-future-log-no-sistema-novo.md.rejected-cycle1` (NÃO RASTREADO)

Backup do gate de story-review da 14.7, de uma pausa anterior. **Não pertence a esta
story** — nenhum arquivo `.rejected-cycle*` jamais foi commitado neste repositório;
permanece fora do commit pelo mesmo critério já aplicado à 14.7.

---

## 2. Camada de API e barrel

### `frontend/src/features/bujo/api.ts` (MODIFICADO, +60/-6)

**Função geral da alteração** — Uma mutação nova e uma função de invalidação
compartilhada.

**Funções, classes e importações específicas**

- `invalidateRecurringTemplateConsumers(queryClient)`: invalida
  `keys.bujo.recurringTemplates()` + `['bujo','ritualWeeklySource']` +
  `['bujo','ritualMonthlySource']` + `['bujo','futureLog']`. Chamada pelas **três**
  mutações de template (create/update/delete) — consistência, não conserto de bug: com
  `staleTime: 0`, a navegação entre rotas já refaz o fetch, mas excluir o último
  recorrente pendente de uma fonte **encerra a pendência** dela
  (`pendingDecisionCount`/`reviewed` são computados na leitura).
- `deleteRecurringTemplate({ templateId })`: `DELETE
  /api/bujo/recurring-templates/{id}/`, sem corpo. O servidor responde **204** e é
  **idempotente** — repetir sobre um já excluído continua respondendo 204. A exclusão é
  lógica: `deleted_at` some de toda leitura via `live_templates()`, mas tarefas já
  criadas a partir do template preservam a linhagem.
- `useDeleteRecurringTemplateMutation()`: expõe a mutação acima.

**Nota de não-regressão documentada inline** — Um comentário extenso no código explica
por que `keys.bujo.recurringTemplates()` (que resolve para
`['bujo','recurringTemplates','list',{}]`) **já alcança** as variantes parametrizadas via
`partialMatchKey` do `@tanstack/query-core` (partial deep match, `{}` é subconjunto de
qualquer objeto de params) — isto **não é** a classe de bug de invalidação por sufixo das
14.5/14.6/14.7 (lá as chaves eram irmãs por sufixo distinto, aqui é o mesmo sufixo com
params), e a story registra explicitamente que não deveria ser "corrigido" nesse sentido.

### `frontend/src/features/bujo/api.test.tsx` (MODIFICADO, +142)

Testes da mutação de exclusão e da invalidação compartilhada nas três mutações.

### `frontend/src/features/bujo/index.ts` (MODIFICADO, +8)

Barrel: exporta `useDeleteRecurringTemplateMutation`, `ItemRowBase`,
`CategorySwatchGroup`, `EisenhowerCheckboxPair`, `TemplateDetailCard`.

---

## 3. Controles canônicos extraídos

### `frontend/src/features/bujo/components/CategorySwatchGroup.tsx` (NOVO, 155 linhas)

**Função geral do arquivo** — Radiogroup visual de categoria: "Sem categoria" + 6
swatches preenchidos, seleção por anel `--ds-primary`, sem dropdown e sem checkmark.

**Função geral da alteração** — Extraído de `TaskDetailCard.tsx` **sem mudança de
comportamento**: o `DESIGN.md` L673 declara este tratamento único válido "para toda
superfície com detalhe — tarefa e template recorrente". Duas implementações do mesmo
padrão divergiriam em silêncio na próxima mudança de tratamento.

**Funções, classes e importações específicas**

- `CategorySwatchGroup({ value, onChange, readonly, label })`: o nome acessível do
  radiogroup é sempre "Categoria" (contrato de locator dos testes existentes),
  independente do `label` visível passado.
- `handleCategoryKeyDown`: **roving tabindex** com wrap nas duas pontas
  (ArrowRight/Down avança, ArrowLeft/Up recua). Preservar este handler na extração era
  crítico — perdê-lo reproduziria o achado ALTO de code-review da própria Story 14.5
  (sem ele, só a opção já selecionada é alcançável por teclado).
- `CategorySwatch`: sub-componente do swatch individual, com `ref` como prop normal
  (React 19, sem `forwardRef`).

**Consumidores:** `TaskDetailCard.tsx` (14.5) e `TemplateDetailCard.tsx` (14.8, novo).

### `frontend/src/features/bujo/components/EisenhowerCheckboxPair.tsx` (NOVO, 91 linhas)

**Função geral do arquivo** — Duas checkboxes reais e independentes (Urgente/Importante),
com `checked` **derivado** do enum combinado (`none|u|i|ui`) — nunca dois booleanos
soltos, porque o backend guarda um único campo e derivar-na-leitura +
recombinar-na-escrita é o que impede os dois estados de divergirem.

**Funções, classes e importações específicas**

- `toggleUrgent(current, checked)` / `toggleImportant(current, checked)`: funções puras
  exportadas (não apenas internas) que calculam o próximo valor do enum combinado.
- Desmarcar o último marcado devolve `null` (não `'none'`) — é o valor que os dois cards
  enviam no PATCH/POST desde a 14.5.

**Consumidores:** `TaskDetailCard.tsx` e `TemplateDetailCard.tsx`.

### `frontend/src/features/bujo/components/TaskDetailCard.tsx` (MODIFICADO, +12/-170)

**Função geral da alteração** — Passa a **consumir** os dois controles acima em vez de
implementá-los inline. Grande redução de linhas (170 removidas: os dois blocos de JSX +
os helpers `toggleUrgent`/`toggleImportant`/`CategorySwatch` locais), zero remoção de
comportamento.

**Prova de aceite da extração:** `TaskDetailCard.test.tsx` permanece **sem uma linha
alterada** — confirmado pelo `git diff` (arquivo não aparece na lista de modificados).

---

## 4. Componentes de raiz e superfície nova

### `frontend/src/features/bujo/components/ItemRowBase.tsx` (NOVO, 213 linhas)

**Função geral do arquivo** — Item Row do sistema novo: nasce como **irmã** de
`TaskRowBase.tsx`, não um fork. `DESIGN.md` L523 registra Item Row como componente de
raiz ("variante sem máquina de estado de tarefa"); `EXPERIENCE.md` L119 nomeia os
consumidores futuros: Recorrentes (14.8), Brain Dump (Épico 15) e Settings (Épico 18).

**Blocos principais**

- Props são de **apresentação** (título/subline/descrição/categoria/chips/`trailingSlot`),
  nunca de domínio — nenhum `RecurringTaskTemplate` cruza esta fronteira. Isso é o que
  permite os Épicos 15/18 especializarem sem alterar a anatomia.
- **O que não existe aqui, de propósito**: coluna de ícone de status, indicador de
  ordem, subárvore. As três existem em `TaskRowBase` por causa da máquina de estados —
  template não tem estado, data, linhagem nem subtarefas.
- **Mesma medida da Task Row**: consome `--ds-task-row-min-height-pointer` /
  `-touch` e `--ds-task-row-category-border-width` — "mesma anatomia" é literal, as duas
  linhas precisam medir igual lado a lado. Nenhum token novo (AC7).
- **Regra de opacidade** (lição da 14.5): a de-ênfase do item inativo é aplicada **só**
  a elementos com fundo opaco próprio (os chips) — nunca ao container, título ou
  descrição. `opacity` num ancestral se acumula e CSS não permite o filho desfazê-la; a
  de-ênfase de texto usa `--ds-ink-muted` (nunca `--ds-ink-disabled`, que a 14.6 provou
  reprovar AA).
- `statusChipLabel` só renderiza quando `deemphasized` também é verdadeiro — o chip e a
  de-ênfase são a mesma afirmação visual; separá-los seria "menos ênfase sem motivo dito"
  (falha de a11y por cor-só).
- **Título não é controle** aqui (diferente de `TaskRowBase`): as ações vêm via
  `trailingSlot` nomeado (`Editar`/`Ativar`/`Desativar`), evitando dois botões cujo nome
  acessível começa por "Editar" na mesma linha.

### `frontend/src/features/bujo/components/TemplateDetailCard.tsx` (NOVO, 434 linhas)

**Função geral do arquivo** — Card de criar/editar template, **irmão** de
`TaskDetailCard`, não um fork: mesma anatomia de card (header/corpo/rodapé) e os dois
controles canônicos compartilhados. Reusar `TaskDetailCard` diretamente seria impossível
— ele é tipado sobre `Task`, e template não tem `status`/`logId`/`subtasks`/
`migratedToTask`/`orderIndex`, mas tem `recurrenceGroup`/`recurrenceText`, que tarefa
nenhuma tem.

**Blocos principais**

- **Criar e editar são o mesmo card** (paridade), diferindo em exatamente 3 pontos: o
  rótulo do primário (Criar × Salvar), o campo Grupo (editável × readonly) e o rodapé
  (criação = primário + nota; edição = Salvar + Ativar/Desativar + Excluir).
- `onClose` × `onSaved`: callbacks **separados** de propósito — reaproveitar um único
  `onClose` para os dois eventos foi achado HIGH de code-review na Story 11.6.
- **Validação fecha uma lacuna do legado**: o form antigo abortava em silêncio
  (`if (!t || !r) return`). O primário fica indisponível enquanto faltar título ou
  recorrência, descrito por `aria-describedby`, com o motivo em `role="alert"` só
  **depois** que o campo foi tocado.
- **Delta silencioso registrado nas Dev Notes**: o checkbox "Ativo" da criação legada
  some — todo template nasce `active: true` (mockup frame B). Ativar/Desativar continua
  existindo, só na edição.
- `recurrenceGroup` readonly na edição é contrato de **UI**, não de API — o serializer
  de update continua aceitando o campo no PATCH (o legado ainda o consome); o cliente
  simplesmente nunca o envia. Registrado como Questão aberta #3 (candidata ao Épico 18).
- Faixa compact segue `Dialog` do MUI (como o irmão `TaskDetailCard`), não o *sheet* que
  o `DESIGN.md` L651 pede para esta superfície — adotar sheet só aqui criaria assimetria
  entre os dois cards irmãos. Divergência registrada (Questão aberta #2).
- Roving tabindex também no segmented de Grupo (`handleGroupKeyDown`), mesmo racional do
  `CategorySwatchGroup`.

### `frontend/src/features/bujo/components/recurring/recurringLibrary.ts` (NOVO, 67 linhas)

**Função geral do arquivo** — Derivações **puras** da biblioteca: sem React, sem Query,
sem DOM.

**Funções, classes e importações específicas**

- `visibleByGroup(templates, showInactive)`: **fonte única** — produz de uma vez a lista
  visível de cada grupo sob o filtro vigente. A contagem de cada aba é o `.length` dessa
  mesma lista; derivar de uma segunda origem seria o modo mais barato de uma aba dizer
  "4" e mostrar 2.
- **Filtro client-side sobre uma query sem params** — decisão vigente desde a Story
  11.2, mantém a troca de aba instantânea sem novo loading. Deliberadamente **não**
  introduz `?active`/`?recurrence_group`: o servidor já filtra `deleted_at` na origem
  (`live_templates()`), e é essa assimetria que o E2E da 14.4 prova.
- `sublineOf(template)`: `{Grupo} — {recurrenceText}` (mockup frame A).
- `tabIdOf`/`tabPanelIdOf`: ids do par `role="tab"` ⇄ `role="tabpanel"`, vivendo aqui
  porque os dois lados precisam deles e nenhum é dono do outro.
- **A ordem vem do servidor** (`order_by("recurrence_text")`) — estas funções preservam,
  nunca reordenam.

### `frontend/src/features/bujo/components/recurring/RecurringGroupTabs.tsx` (NOVO, 156 linhas)

**Função geral do arquivo** — Abas por `recurrence_group` + filtro "Mostrar inativos".

**Blocos principais**

- Contagem **anunciada em texto** dentro do próprio `role="tab"` ("Semanal (4)"), nunca
  só por chip colorido (AC6) — e mantém os locators legados por substring funcionando.
- **Decisão deliberada e registrada (Questão aberta #1)**: o filtro usa `role="checkbox"`
  (MUI `Switch` renderiza `input type="checkbox"` real), **não** o `role="switch"` que o
  mockup desenha — porque (1) `EXPERIENCE.md` não fixa o papel, só o mockup, que é
  esboço de ARIA; (2) `checkbox` preserva 3 asserts vivos em dois specs E2E; (3) o visual
  do mockup é preservado, só o papel ARIA difere.
- `aria-controls` só aponta para o painel quando a aba está selecionada (lazy panels) —
  apontar para um id inexistente seria violação real de `aria-valid-attr-value`, a mesma
  classe do CRITICAL que a 14.6 levou.
- Navegação por seta entre abas com wrap (padrão APG de tablist).
- Compact: a faixa de abas rola horizontalmente dentro de si — o conteúdo da página
  nunca ganha scroll horizontal.

### `frontend/src/features/bujo/components/recurring/RecurringLibrarySkeleton.tsx` (NOVO, 64 linhas)

**Função geral do arquivo** — Skeleton do carregamento inicial, preservando a geometria
"abas + linhas" (uma barra por aba do grupo + pilha de linhas na altura real da Item
Row) — o `PlannerSkeleton` genérico compartilhado não serve aqui, e deformá-lo quebraria
as outras superfícies que já o consomem (mesma decisão da 14.7 para o trilho do Future
Log).

### `frontend/src/features/bujo/components/recurring/TemplateLibraryList.tsx` (NOVO, 156 linhas)

**Função geral do arquivo** — Painel da aba ativa: lista de `ItemRowBase`.

**Blocos principais**

- `role="tabpanel"` nomeado por `aria-labelledby` (nunca `aria-label` paralelo, que
  divergiria do rótulo da aba na primeira mudança).
- `<ul>`/`<li>` em vez de `div`s soltas — dá a cada template um contorno próprio na
  árvore de acessibilidade, permitindo distinguir dois botões "Editar" idênticos por
  `getByRole('listitem')` em vez do `xpath=ancestor::div[2]` frágil que os specs legados
  usavam.
- Estado vazio **por grupo** (não global), com botão "Novo template" cujo `aria-label`
  ganha o grupo como contexto (`Novo template — Semanal`) para não colidir com o botão
  homônimo do header quando o grupo ativo está vazio.
- `ROW_ACTION_SX`: cor explícita do design system (o `primary` do tema MUI reprova AA
  sobre `--ds-surface` — achado real do axe na 14.7).

### `frontend/src/features/bujo/components/recurring/noLiteralTokens.test.ts` (NOVO)

Guard estrutural via `?raw`: nenhum componente novo do diretório escreve os literais
reservados a `taskRow`/`weeklyBoard.terminalOpacity` etc.

### `frontend/src/features/bujo/components/recurring/*.test.tsx` / `recurringLibrary.test.ts` (NOVOS)

Testes unitários de cada peça acima, isolados.

---

## 5. Página e roteamento

### `frontend/src/pages/planner/RecurringLibraryPage.tsx` (NOVO, 344 linhas)

**Função geral do arquivo** — A superfície: orquestra a query única, estado local de
aba/filtro/card aberto/alvo de exclusão, e compõe os componentes acima.

**Blocos principais**

- **Não é um planner** — é uma coleção. Sem ciclo, ritual, densidade ou migração.
- **Alocar continua sendo dos rituais**: nenhum botão "Alocar", nenhum
  `RecurringPlacementDialog`, nenhum `POST /place/` nesta página — recriar aqui geraria
  redundância e divergência com o que M06/M07/M08 já desenharam.
- **"Novo template" fica no header, também em compact** — o mockup (frame D) desenha um
  FAB no canto inferior direito, exatamente onde o `ShellLayout` já monta o FAB de
  captura persistente desde a 13.3. Dois FABs no mesmo canto seria colisão, não
  composição; o FAB de captura é chrome global que uma superfície não pode suprimir.
  Divergência do mockup registrada (Questão aberta #8).
- `OpenCard` como união discriminada (`{mode:'create'}` | `{mode:'edit', template}`) em
  vez de dois booleanos — impede o par impossível "criando E editando".
- `key={openCard.mode === 'edit' ? openCard.template.id : 'create'}` no
  `TemplateDetailCard`: remonta o card ao trocar de template/modo, evitando o vazamento
  de estado entre instâncias que a Retro do Épico 11 registrou para rotas parametrizadas.
- **Dialog de confirmação de exclusão** (`role="alertdialog"`): foco nasce na ação
  **não-destrutiva** ("Cancelar") — AC6. Dois mecanismos complementares: `autoFocus`
  (cobre jsdom/unit test) + `onEntered` da transição (necessário porque o FocusTrap do
  Modal rouba o foco do `autoFocus` durante a animação no browser real, mesmo padrão de
  `BrainDumpCaptureSheet.tsx`).
- Falha do `DELETE` mantém card e dialog **utilizáveis**, com motivo e retry — nunca
  fecha em cima de um erro (AC4).
- `RecurringPage.tsx` + `RecurringTemplateManager.tsx` (legados) permanecem no
  repositório, apenas desmontados da rota — remoção é o Épico 18; rollback por
  superfície continua sendo uma linha em `router.tsx` (AC9).

### `frontend/src/app/router.tsx` (MODIFICADO, +7/-1)

`planner/recurring` passa a montar `RecurringLibraryPage` em vez de `RecurringPage`.

### `frontend/src/app/layout/shell/shellRouting.ts` (MODIFICADO, +3/-1)

`planner/recurring`: `surfaceMigrated: false` → `true`. Quarta superfície interna
migrada; o `LegacySeamNotice` desaparece nessa rota.

### `frontend/src/app/layout/shell/shellRouting.test.ts` (MODIFICADO)

Reancora o par de não-vacuidade: até a 14.7 era `planner/future` × `planner/recurring`;
com a 14.8 migrando o segundo, o novo par de controle vira `planner/recurring` ×
`settings` (`Configurações` — destino de topo, imune ao rail colapsado do tablet, e a
superfície legada de vida mais longa da fila).

### `frontend/src/pages/planner/noLiteralTokens.test.ts` (MODIFICADO)

Entrada nova para `RecurringLibraryPage.tsx` + `44px` adicionado a
`FORBIDDEN_LITERALS` (o touch-target mínimo tem token e CSS var próprios
`--ds-touch-target-min`; escrevê-lo cru é o mesmo defeito dos demais literais da lista).

---

## 6. Rename "Definir placement" → "Alocar" (AC5)

Fecha nos 3 sítios de produção que restavam, todos com o teste correspondente atualizado
para não ficar vacuoso:

| Arquivo | Mudança |
|---|---|
| `RecurringPlacementDialog.tsx` | Título do dialog: "Definir placement" → "Alocar" |
| `RecurringPlacementSection.tsx` | Rótulo do botão: idem |
| `FuturePage.tsx` (legada) | Rótulo do botão: idem |

Testes ajustados em paralelo (apenas rename do texto buscado, sem mudança de asserção):
`RecurringPlacementSection.test.tsx`, `FuturePage.test.tsx`, `MonthlyPage.test.tsx`,
`WeeklyPage.test.tsx`, `FutureBoardPage.test.tsx`.

---

## 7. E2E

### `frontend/e2e/recurring-library.spec.ts` (NOVO, 627 linhas, 11 testes)

Cobre a biblioteca nova contra o backend real (branch Neon `e2e`): criar/editar/
desativar/excluir pela UI, as 5 faixas de accessibility (incluindo lista, card de
detalhe aberto **e** dialog de confirmação aberto — AC6). Toda escrita de *setup* passa
pela API (molde de `recurring-soft-delete.spec.ts`); os testes exercitam especificamente
a UI nova, que ainda não tinha cobertura de browser real.

**+2 testes do passo de QA** (9 → 11), ambos com não-vacuidade provada:

1. **AC3/AC4** — falha de escrita/`DELETE` com retry, antes só provada em jsdom com
   mutations mockadas. Teste novo usa `page.route()` para forçar um 500 real na
   primeira tentativa, then verifica a cópia de erro exata, o rascunho preservado, e o
   retry bem-sucedido.
2. **AC6** — o dialog de confirmação de exclusão deve abrir focado em "Cancelar" e
   devolver o foco ao botão que o invocou, ao fechar. Zero cobertura antes. Provado
   não-vacuo: quebraram o handler de foco, viram o teste falhar (`Received: inactive`),
   restauraram e confirmaram verde de novo.

### `frontend/e2e/recurring-templates.spec.ts` (MODIFICADO, +160/-…)

**Passos de criação/edição portados** do form legado (`RecurringTemplateManager`) para o
card de detalhe novo — a rota `/planner/recurring` não monta mais o form antigo. **As 4
falhas conhecidas do arquivo não mudam de causa nem de posição** (critério de aceite
posicional da AC9): a causa raiz é inteiramente alheia a esta story —
`RecurringPlacementSection` vive nas páginas legadas `WeeklyPage.tsx`/`MonthlyPage.tsx`,
enquanto `planner/week`/`planner/month` montam os boards **novos** desde as Stories
14.5/14.6, que não renderizam aquela seção (a alocação de recorrentes virou ato do
ritual, por desenho de produto). Consertar aqui desfaria decisões de produto de duas
stories anteriores — dono real é o Épico 17/18. Nenhum teste foi deletado ou marcado
`.skip`; portar os passos iniciais só evita que os 4 testes morram na **primeira**
interação (form legado não existe mais na rota), sem dar cobertura nova — essa vem do
`recurring-library.spec.ts`.

### `frontend/e2e/recurring-soft-delete.spec.ts` (MODIFICADO, +40/-…)

Muda a mecânica de exclusão de `api.remove()` direto para a UI real (lixeira → dialog →
confirmar), e o locator do "inativo" de um sufixo textual concatenado para um chip
próprio + escopo por `role="listitem"` em vez do antigo `xpath=ancestor::div[2]`. A tese
do teste (AC6: o inativo volta com o filtro, o excluído nunca volta) é a mesma.

### `frontend/e2e/future-log-annual.spec.ts` (MODIFICADO, +27/-13)

Criação de templates portada para o card novo; o título do dialog de placement também
virou "Alocar" (a Story 14.8 fecha a padronização que a 14.7 tinha deixado parcial:
título ainda "Definir placement", só o botão do item já dizia "Alocar").

### `frontend/e2e/shell.spec.ts` e `frontend/e2e/future-log-board.spec.ts` (MODIFICADOS)

Reancoram o par de não-vacuidade "uma rota ainda legada continua com o seam" de
`Recorrentes` (agora migrada) para `Configurações` — mesma razão registrada nos dois
arquivos, para não repetir a troca a cada story subsequente.

### `frontend/e2e/archive.spec.ts` (MODIFICADO, +2/-2)

Os dois asserts **negativos** ("Definir placement" não aparece no modo Arquivo) trocados
para "Alocar" — sem a troca, ficariam vacuosamente verdes (o texto antigo nunca mais
existe em lugar nenhum, então o assert de ausência sempre passaria, mesmo se o rename
tivesse falhado em algum ponto).

---

## Observações finais

- **Backend inteiramente intocado** — confirmado pelo `pytest` re-executado com o mesmo
  número da baseline (1314) e pela ausência de qualquer arquivo `backend/` na lista de
  mudanças.
- **Aditividade estrita**: nenhum contrato de API mudou, nenhuma migration, nenhum
  arquivo de schema regenerado.
- **Dívidas registradas, não pagas** (deliberado): `TemplateDetailCard` em `Dialog` em
  vez do *sheet* que o `DESIGN.md` pede (Questão aberta #2); `recurrenceGroup` como
  contrato de UI e não de API (#3); a segunda affordance do FAB de "Novo template" vs. o
  FAB de captura global (#8); as 4 falhas pré-existentes de `recurring-templates.spec.ts`
  (dono: Épico 17/18).
- Este report não alterou nenhum comportamento de código; é documentação do estado da
  árvore de trabalho imediatamente antes do commit da story.
