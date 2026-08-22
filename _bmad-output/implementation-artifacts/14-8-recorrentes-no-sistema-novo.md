---
baseline_commit: 79e5421a83777079790086a7ca242516165e4737
---

# Story 14.8: Recorrentes no sistema novo (M09)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero a biblioteca de templates no sistema novo com o card de detalhe compartilhado e soft delete,
Para que a gestão de recorrentes siga o padrão canônico (UX-DR24, UX-DR26; mockup `key-recorrentes.html`).

## Contexto de herança (leia antes de tudo)

Esta é a **quarta superfície** do Épico 14 no sistema novo, depois da 14.5 (Weekly Board, `ecffe40`), 14.6 (Monthly Board, `0fc9ce6`) e 14.7 (Future Log, `79e5421`). Quatro diferenças estruturais mudam o formato do trabalho em relação às três anteriores:

1. **Não é um planner — é uma Coleção.** Template **não é tarefa**: não tem status, nem data, nem log, nem linhagem, nem subtarefas (AD-08 itens 1 e 8). Não há ciclo, não há ritual, não há densidade, não há migração. `TaskRowBase` e `TaskDetailCard` **não servem** aqui: os dois são tipados sobre `Task` e a anatomia deles é dominada pela máquina de estados. O que esta story reusa deles é **o vocabulário visual e os dois controles canônicos** — ver AC2 e AC3.
2. **A variante Item Row do sistema novo nasce aqui**, exatamente como a Task Row nasceu na 14.5. `DESIGN.md` L523 a define como "raiz · variante sem máquina de estado de tarefa" e `EXPERIENCE.md` L119 lista os consumidores futuros: **recorrentes, Brain Dump (Épico 15), settings (Épico 18)**. Desenhar para reuso é requisito, não bônus.
3. **O backend já está inteiro pronto.** A 14.4 entregou `deleted_at`, `live_templates()` nos **6 pontos de leitura** (+1 herdado de graça no lookup de item de `upsert_ritual_decision`) e `DELETE /api/bujo/recurring-templates/<pk>/ → 204` idempotente. **Esta story não altera backend, não cria endpoint, não cria migration, não regenera contrato.** O que falta é exclusivamente do cliente: o verbo `DELETE` **nunca foi fiado** — não existe `useDeleteRecurringTemplateMutation` em `features/bujo/api.ts` (verificado por leitura completa do arquivo).
4. **É a story dona da padronização do termo "Alocar"** (epic AC2; decision-log 2026-07-21 "M09 aprovado e promovido"). A 14.7 renomeou o **botão** no Future Log e deixou explicitamente para cá o **título do dialog** e as duas ocorrências restantes (Questão aberta #2 da 14.7).

Esta story **não** toca `MonthlyPage.tsx`, `WeeklyPage.tsx`, `DailyPage.tsx`, `FuturePage.tsx`, `TaskRow.tsx` nem os aliases/banners legados — **exceto** pelo rename literal de rótulo da AC5, que é cirúrgico e está enumerado linha a linha.

## Acceptance Criteria

### AC1 — Biblioteca no sistema novo em `/planner/recurring`

**Dado que** o spine M09 (`EXPERIENCE.md#Recorrentes` L349-357; `DESIGN.md#Recorrentes (Coleção)` L647-655) e o mockup `mockups/key-recorrentes.html` (frames A e D),
**Quando** a biblioteca nova é implementada,
**Então** a superfície é o **padrão Coleção** — header de página com título "Recorrentes", subtítulo "Modelos que você aloca manualmente ao planejar. Não geram tarefas sozinhos." e a ação primária **Novo template**; abaixo, **abas Semanal / Mensal / Anual** (uma por `recurrence_group`) **com contagem por aba**, e o filtro **Mostrar inativos** na mesma faixa das abas,
**E** a **contagem de cada aba reflete exatamente o que aquela aba renderiza** com o filtro vigente (ligar "Mostrar inativos" muda os três números) — contagem derivada da mesma lista filtrada, nunca de uma segunda origem que possa divergir do que está em tela,
**E** o **filtro continua client-side sobre uma única query sem params** (`useRecurringTemplatesQuery()`, chave `['bujo','recurringTemplates','list',{}]`): é a decisão vigente desde a 11.2 e o que mantém a troca de aba instantânea, sem novo estado de loading. **Não** introduzir `?active`/`?recurrence_group` nesta superfície — o servidor já filtra `deleted_at` na origem (`live_templates()`, AD-08 item 6b), e é essa assimetria (`active` no cliente × excluído no servidor) que o E2E da 14.4 prova e a AC9 preserva,
**E** o vazio por grupo é **"Nenhum template neste grupo."** + a ação de criar (cópia do mockup, frame E), e **não** renderiza enquanto a query está pendente (regressão conhecida, coberta hoje por `RecurringTemplateManager.test.tsx:300`),
**E** em **compact** as abas viram faixa rolável horizontalmente, o detalhe abre da mesma forma que o `TaskDetailCard` já abre nas três superfícies irmãs (ver AC3, divergência registrada) e **não há scroll horizontal** no conteúdo,
**E** — **conflito verificado no código, decidir antes de implementar** — o mockup (frame D) põe **Novo template** como **FAB no canto inferior direito** (`.m-fab`), exatamente onde o `ShellLayout` já monta o **FAB de captura persistente** desde a 13.3 (`ShellLayout.tsx:230-266`, circular, acima da bottom nav e da safe-area, token `{components.capture-action}`). **Dois FABs no mesmo canto é colisão, não composição.** O FAB de captura é chrome global e **não pode ser suprimido** por uma superfície. A saída contratada aqui é manter **Novo template** como ação do **header da página** também em compact (alcançável sem scroll e ≥44px), e o mockup perde nesse ponto por conflito com o shell aprovado — divergência registrada no código e na Questão aberta #8,
**E** `shellRouting.ts` passa `planner/recurring` para `surfaceMigrated: true` (quarta superfície migrada) e o landmark permanece **`<main aria-label="Recorrentes">`** com heading de mesmo nome — vários specs E2E navegam por esse nome exato (ver AC9).

### AC2 — `ItemRowBase`: a variante Item Row do sistema novo nasce aqui

**Dado que** `DESIGN.md` L523 registra **Item Row** como componente de **raiz** ("variante sem máquina de estado de tarefa") e `EXPERIENCE.md` L119 nomeia os consumidores futuros (recorrentes, Brain Dump, settings), e que `TaskRowBase.tsx` é tipado `task: Task` com a coluna 1 inteira dedicada ao ícone de status,
**Quando** a linha do template é implementada,
**Então** nasce **`frontend/src/features/bujo/components/ItemRowBase.tsx`** — **irmão** de `TaskRowBase.tsx`, não fork dele —, com cabeçalho documentando (no molde do cabeçalho de `TaskRowBase.tsx:1-20`) que a anatomia é canônica e que os Épicos 15/18 **especializam sem alterá-la**,
**E** a anatomia é a do mockup (frame A, `.trow`): **borda de categoria à esquerda** + conteúdo (título, **chip Eisenhower inline ao lado do título**, subline `{Grupo} — {recurrenceText}`, descrição opcional truncada em 1 linha) + **slot de ações trailing**. **Sem coluna de ícone de status, sem indicador de ordem, sem subárvore** — as três coisas que existem em `TaskRowBase` por causa da máquina de estados e que aqui não têm referente,
**E** o Item Row **consome as mesmas CSS vars da Task Row** — `--ds-task-row-min-height-pointer` / `--ds-task-row-min-height-touch`, `--ds-task-row-category-border-width`, `--ds-task-row-hover` e `typography.meta` para a descrição —, porque "mesma anatomia" (`EXPERIENCE.md` L119) é literal: as duas linhas precisam medir igual lado a lado. **Nenhum token novo** (ver AC7),
**E** o **chip Eisenhower reusa o tratamento cromático já existente** (`--ds-priority-ui` / `--ds-priority-u` / `--ds-priority-i` com `--ds-on-primary`, exatamente como `TaskRowBase.tsx:336-353`); `none`/`null` **não renderiza chip**. A **posição** difere (inline ao lado do título aqui, coluna 2 lá) por desenho do mockup — divergência deliberada, registrada em comentário no componente,
**E** o **inativo** entra com menor ênfase **e chip textual "inativo"** (`DESIGN.md` L649: "Inativo entra com menor ênfase e chip textual"; `EXPERIENCE.md#State Patterns` L410) — a de-ênfase segue a regra que a 14.5 pagou caro para descobrir: **opacidade reduzida só em elementos com fundo opaco próprio, nunca em título/descrição** (`TaskRowBase.tsx:38-46` documenta por quê: `opacity` num ancestral se acumula, CSS não permite o filho desfazê-la, e o texto diluído **reprova `color-contrast` do axe**). Repetir esse erro aqui é a falha de a11y mais provável desta story,
**E** as ações da linha são **Editar** e **Ativar/Desativar** (mockup frame A e frame E), no slot trailing; **Excluir não vive na linha** (é só do card de edição — AC4),
**E** `ItemRowBase.test.tsx` co-locado cobre: com/sem descrição, com/sem categoria (fallback `--ds-border`), os 4 valores de Eisenhower, ativo × inativo (presença/ausência do chip **e** o par de não-vacuidade da opacidade), e slot de ações vazio.

### AC3 — Criar e editar no mesmo card, com os dois controles canônicos **extraídos e compartilhados**

**Dado que** `DESIGN.md` L673 fixa o tratamento de Categoria (radiogroup visual: "Sem categoria" + 6 swatches preenchidos, seleção por **anel** `{colors.primary}`, sem dropdown e sem checkmark) e de Eisenhower (duas **checkboxes reais** `U`/`I` com `checked` derivado do enum combinado) e declara literalmente: *"Esse é o tratamento canônico dos dois controles (**padrão fixado na M09**) e vale para toda superfície com detalhe — **tarefa e template recorrente**"*,
**E dado que** esses dois controles hoje existem **embutidos** em `TaskDetailCard.tsx` (o componente local `CategorySwatch` + o `role="radiogroup"` com roving tabindex de `:184-197` e `:299-327`; as funções `toggleUrgent`/`toggleImportant` de `:50-60` + o par de checkboxes de `:330-357`),
**Quando** o card de template é implementado,
**Então** os dois controles são **EXTRAÍDOS** para módulos próprios consumidos pelos **dois** cards — `frontend/src/features/bujo/components/CategorySwatchGroup.tsx` e `frontend/src/features/bujo/components/EisenhowerCheckboxPair.tsx` — e **`TaskDetailCard.tsx` passa a consumi-los**. Copiar os controles para o card de template é **explicitamente proibido**: seriam duas implementações de um padrão que o `DESIGN.md` acabou de declarar único, e a próxima mudança de tratamento divergiria em silêncio,
**E** a **não-regressão da extração é provada mecanicamente**: `TaskDetailCard.test.tsx` (510 linhas) passa **sem uma única linha alterada** — inclusive os testes de navegação por seta com wrap nas duas pontas (o roving tabindex é a parte mais fácil de perder na extração; a 14.5 levou achado **ALTO** no code-review justamente por ele não existir) e os de `readonly`. Se algum assert precisar mudar, a extração está errada — a saída é corrigir a extração, nunca o teste,
**E** nasce **`frontend/src/features/bujo/components/TemplateDetailCard.tsx`**, irmão de `TaskDetailCard.tsx`, com a **mesma anatomia de card** (header com título + subtítulo `Recorrente · {Grupo}` (+ ` · ativo`/` · inativo` na edição) e botão Fechar; corpo; rodapé) e os campos: **Título**, **Descrição**, **Grupo**, **Recorrência**, e **Categoria + Prioridade no par** (mockup frame B),
**E** **Grupo** é um **segmented `role="radiogroup"`**: **editável na criação**, herdando a aba ativa, com o hint "Herdado da aba ativa; pode trocar antes de criar."; e **readonly na edição** (`aria-readonly="true"`, opções não-selecionadas inertes) com o hint "Semanal/Mensal/Anual define em qual ritual é oferecido. Readonly após criar." — decisão fechada de produto (decision-log 2026-07-21, Revisão 2, Q1),
**E** **Recorrência** é `<input>` de texto livre com o hint "Texto livre — exibido como lembrete, nunca interpretado para inferir datas." (AD-08 item 4),
**E** **criar e editar são o MESMO card** (paridade), diferindo em exatamente três pontos: o rótulo do botão primário (**Criar** × **Salvar**), o Grupo (editável × readonly) e o rodapé (criação = só o primário + a nota "Título e recorrência são obrigatórios."; edição = **Salvar** + **Ativar/Desativar** + **Excluir**),
**E** a **validação** impede salvar com título **ou** recorrência vazios, **preservando o rascunho inteiro**, com o motivo visível junto ao campo (`role="alert"`) e o botão indisponível com motivo — o legado hoje **aborta em silêncio** (`RecurringTemplateManager.tsx:64` e `:166`, `if (!trimmedTitle || !trimmedText) return`), e fechar essa lacuna é delta contratado do M09 (`.decision-log.md`: "Estados offline/erro/validação explícitos"),
**E** **falha de escrita preserva o rascunho**, mostra o motivo (`role="alert"`, anunciado uma única vez) e oferece nova tentativa; **sucesso não mostra toast**,
**E** fechar explicitamente (X / Esc / backdrop) **descarta** o rascunho — mesma semântica já documentada em `TaskDetailCard.tsx:8-10`.

### AC4 — Excluir = soft delete, só na edição, com dialog — e o verbo que o cliente nunca fiou

**Dado que** a 14.4 entregou `DELETE /api/bujo/recurring-templates/<pk>/ → 204` idempotente (`views.py:283-292`), que `PATCH`/`place` sobre excluído respondem **404**, e que **nenhuma mutação do cliente chama esse verbo** (`features/bujo/api.ts` tem `create`/`update`/`place` e mais nada — verificado por leitura completa),
**Quando** o Excluir do M09 é implementado,
**Então** nasce **`useDeleteRecurringTemplateMutation`** em `frontend/src/features/bujo/api.ts`, no molde exato de `useUpdateRecurringTemplateMutation` (`api.ts:540-548`): `DELETE` na URL de detalhe, sem corpo, invalidando `keys.bujo.recurringTemplates()`,
**E** o controle é um **Icon Button de lixeira** (`Trash` de `@phosphor-icons/react`, 44×44, `--ds-ink-muted` em repouso, `--ds-danger` em hover/foco — `DESIGN.md` L675 descreve exatamente esse tratamento para o Excluir do detalhe de tarefa, e `TaskDetailCard.tsx:432-440` já o implementa: **copiar a aparência de lá, não inventar**), presente **apenas no card de edição**, com `aria-label="Excluir template"`,
**E** a confirmação é um **dialog** (`role="alertdialog"`, nome "Confirmar exclusão") com o título "Excluir template?" e a cópia do mockup, que **nomeia o template** e explica a preservação da linhagem: *"«{título}» sai da biblioteca e deixa de ser oferecido nos rituais. As tarefas já criadas a partir dele são preservadas e mantêm a linhagem — a exclusão é lógica (soft delete)."*, com as ações **Cancelar** e **Excluir**,
**E** confirmar fecha dialog **e** card, e o template **some da biblioteca em todas as abas e com "Mostrar inativos" ligado** — porque o filtro vive no servidor, não no cliente (AD-08 item 6b),
**E** a distinção **Desativar × Excluir** é operável e visível na mesma superfície: Desativar é reversível e prospectivo (o inativo continua na biblioteca **com o filtro**, e tem **Ativar** de volta); Excluir é terminal e **não tem caminho de volta na UI** (`EXPERIENCE.md#State Patterns` L410-411). Existe teste que exercita os dois no mesmo cenário — é essa justaposição que prova a AC2 da epic 14.4 na camada que o pytest não alcança,
**E** falha do `DELETE` **mantém o card e o dialog utilizáveis**, com motivo e retry — nunca fecha em cima de um erro.

### AC5 — Termo canônico **Alocar**: o rename que esta story fecha, sem deixar assert vacuoso

**Dado que** "Alocar" é o termo padrão do ato (epic AC2; `DESIGN.md` L653; decision-log 2026-07-21 — a 14.7 renomeou o **botão** do Future Log e registrou na Questão aberta #2 que o **título do dialog** e o resto ficavam para cá),
**Quando** o rename é executado,
**Então** as **três ocorrências de produção restantes** viram **"Alocar"**, e são exatamente estas (grep completo em `frontend/src`, nenhuma outra existe):
 - `features/bujo/components/RecurringPlacementDialog.tsx:69` — `<DialogTitle>Definir placement</DialogTitle>`;
 - `features/bujo/components/RecurringPlacementSection.tsx:116` — rótulo do botão da seção;
 - `pages/planner/FuturePage.tsx:132` — rótulo do botão da página legada (desmontada da rota desde a 14.7, mas com teste vivo);
**E** os testes que asseram esses rótulos são **atualizados, nunca deletados** — `RecurringPlacementSection.test.tsx:103,108,131`, `FuturePage.test.tsx:211,218,233,257`, `MonthlyPage.test.tsx:363,377,447` —, preservando a tese de cada um literalmente,
**E** — **a armadilha desta AC** — os dois asserts **negativos** de `frontend/e2e/archive.spec.ts` (**:102** e **:126**), `expect(page.getByRole('button', { name: 'Definir placement' })).toHaveCount(0)`, ficariam **VACUOSOS** depois do rename: eles provam que a superfície de Arquivo readonly **não oferece** o placement, e `archive/weekly/:weekStart` / `archive/monthly/:monthFirst` montam de fato `WeeklyPage`/`MonthlyPage` (`router.tsx:159-167`), que **renderizam `RecurringPlacementSection` quando não readonly**. Sem atualizar o nome, os dois asserts passariam a ser verdadeiros por o rótulo não existir em lugar nenhum. Trocar para `name: 'Alocar'` é obrigatório,
**E** `frontend/e2e/future-log-annual.spec.ts:114` (`dialog.getByText('Definir placement')`) é atualizado — é o assert que a 14.7 deixou apontando para o título antigo, com o comentário `:27` dizendo que a 14.8 é a dona,
**E** a **alocação continua exclusiva dos rituais e dos anuais do Future Log**: a biblioteca **não ganha** botão Alocar, não abre `RecurringPlacementDialog` e não emite `POST /place/` (epic AC2; decision-log 2026-07-21: "a alocação **não é redesenhada na M09** … a biblioteca apenas **alimenta** e **referencia**"). Existe teste que prova a **ausência** desse caminho na superfície nova, com irmã de não-vacuidade provando que ele existe onde deve.

### AC6 — Estados obrigatórios e piso de acessibilidade nas 5 faixas

**Dado que** `EXPERIENCE.md#State Patterns` (incl. as duas linhas próprias do M09: "Recorrente inativo" e "Recorrente excluído") e `#Accessibility Floor`, e o frame E do mockup,
**Quando** a superfície é auditada,
**Então** existem e são testados, **com a cópia literal do mockup**: `initial loading` (skeleton **preservando a geometria abas + linhas**, frame E — o `PlannerSkeleton` compartilhado é uma pilha genérica e **não** serve; compor local sem deformar o compartilhado), `empty por grupo` ("Nenhum template neste grupo." + "Crie um modelo para alocá-lo depois ao planejar." + a ação de criar), `read error` ("Não foi possível carregar os templates." + "Tentar de novo", **sem sair da tela e sem perder a aba/filtro**), `write error` (AC3/AC4), `offline` ("Você está offline. Consulta disponível; criar e editar templates ficam indisponíveis até reconectar." — **criar/editar/ativar/excluir indisponíveis com motivo, sem fila local**, via `useOnlineStatus()`, mesmo molde do `FutureBoardPage`), `validação` (AC3) e `inativo` (AC2),
**E** `@axe-core/playwright` (`wcag2a/2aa/21a/21aa/22aa`, **sem `disableRules`**, **sem `exclude: 'main'`**) passa em `/planner/recurring` nas **5 faixas desde o primeiro commit** — wide, medium, tablet, compact e **reflow 320**,
**E** o gate de axe mede a superfície com os **overlays ABERTOS** — o card de detalhe **e** o dialog de confirmação —, não só a lista. Esta é a lacuna que a 14.6 pagou com um `aria-required-children` **CRITICAL** e que a 14.7 pagou de novo na aba "Outro mês": **componente nunca medido aberto é achado garantido**. Vale para `role="tablist"`/`role="tab"`/`role="tabpanel"` das abas, para o `role="radiogroup"` do Grupo e para o `role="radiogroup"` da Categoria,
**E** as abas são `role="tablist"` com nome acessível ("Grupo de recorrência"), navegação por seta entre abas, e a contagem de cada aba **anunciada em texto** (nunca só por chip colorido); o painel é `role="tabpanel"` nomeado,
**E** o **Mostrar inativos** tem nome acessível estável e permanece visível/limpável junto ao dado (`EXPERIENCE.md` "Empty por filtro"). **Atenção de contrato:** o legado usa MUI `Switch`, que renderiza `input type="checkbox"` e é localizado por `getByRole('checkbox', { name: 'Mostrar inativos' })` em **dois specs E2E** (`recurring-templates.spec.ts:115`, `recurring-soft-delete.spec.ts:179,195`). O mockup desenha `role="switch"`. **Trocar o papel quebra os dois specs**; manter `checkbox` os preserva. Qualquer que seja a escolha, ela é **deliberada e registrada** — e se o papel mudar, os specs são atualizados **no mesmo commit** (AC9),
**E** o dialog de confirmação e o card **contêm o foco, devolvem o foco ao acionador ao fechar** e o dialog nasce com o foco numa ação não-destrutiva; alvos ≥44×44px (a lixeira é o candidato natural ao `target-size` que a 14.6 e a 14.7 já encontraram em containers estreitos),
**E** os pares cromáticos do inativo (menor ênfase, chip) são checados em Mineral **light e dark**; **de-ênfase de texto usa `--ds-ink-muted`, nunca `--ds-ink-disabled`** — a 14.6 provou por axe que `--ds-ink-disabled` sobre `--ds-surface-subtle` mede ~2,6:1 e reprova AA.

### AC7 — Tokens: **nenhum token novo**, zero literal estrutural

**Dado que** `DESIGN.md` **não define** um bloco `{components.item-row}` (verificado por grep: `item-row` não existe na seção de tokens; "Item Row" aparece só na tabela de componentes, L523, como "variante sem máquina de estado de tarefa"),
**Quando** a story entrega,
**Então** **nenhum bloco novo é acrescentado a `tokens.ts`** — o Item Row consome os tokens já emitidos (`taskRow`, `panel`, `chip`, cores de categoria/prioridade). Inventar `itemRow` seria criar contrato de design que o `DESIGN.md` não tem; se durante a implementação faltar uma medida, ela vira **Questão aberta**, não token novo,
**E** os componentes e a página nova **não escrevem literal estrutural nem cor hexadecimal** — guardrail por `?raw` em `frontend/src/features/bujo/components/recurring/noLiteralTokens.test.ts` (novo, molde byte-a-byte de `future/noLiteralTokens.test.ts`) cobrindo também `ItemRowBase.tsx`/`TemplateDetailCard.tsx`/`CategorySwatchGroup.tsx`/`EisenhowerCheckboxPair.tsx`, e entrada nova em `pages/planner/noLiteralTokens.test.ts` para a página,
**E** se algum literal da lista `FORBIDDEN_LITERALS` existente for **legítimo** no contexto novo, a saída é documentar no guard **por que**, nunca remover o literal da lista (a 14.6 levou achado ALTO por um guard que nunca pegava nada).

### AC8 — Camada de API e composição: aditivo, sem backend, sem contrato regenerado

**Dado que** o serializer devolve exatamente `id · title · description · eisenhower · category · recurrenceGroup · recurrenceText · active` (`serializers.py:514-526` — `deleted_at` **não** é exposto, e não deve ser) e que os tipos já existem em `features/bujo/types.ts:21-22`,
**Quando** a camada de dados é fechada,
**Então** a **única** adição é `useDeleteRecurringTemplateMutation` (AC4); `useRecurringTemplatesQuery`, `useCreateRecurringTemplateMutation` e `useUpdateRecurringTemplateMutation` são **consumidos como estão**,
**E** a invalidação por `keys.bujo.recurringTemplates()` — que resolve para `['bujo','recurringTemplates','list',{}]` — **já alcança** as variantes parametrizadas: `partialMatchKey` do `@tanstack/query-core@5.101.1` faz *partial deep match* (`Object.keys(b).every(...)`, `utils.js:94-105`), e `{}` é subconjunto de qualquer objeto de params. **Isto não é a classe de bug das 14.5/14.6/14.7** e **não deve ser "corrigido"** — a diferença é que lá as chaves eram irmãs por sufixo (`list` × `horizon`), aqui é o mesmo sufixo com params. Verificar antes de mexer; se mexer, provar,
**E** as três mutações de template invalidam **também** os prefixos das fontes de ritual (`['bujo','ritualWeeklySource']`, `['bujo','ritualMonthlySource']`) e do Future Log (`['bujo','futureLog']`) — **aditivo e barato, não conserto de bug**: com `staleTime: 0` (`api/queryClient.ts:7`) a navegação entre rotas já refaz o fetch, então isto é consistência, não correção. **Não afirmar bug onde não há**; a justificativa real está registrada pelo passo de QA da 14.4: *"excluir o último recorrente pendente **encerra a pendência da fonte** — `pendingDecisionCount`/`reviewed` são computados na leitura, o soft delete mexe no progresso do ritual"*,
**E** `features/bujo/index.ts` (barrel) e `types.ts` reexportam o que a página precisa **antes** da fase de UI — a 14.6 e a 14.7 perderam tempo com barrel incompleto travando a fase seguinte,
**E** `uv run python manage.py makemigrations --check --dry-run` responde **"No changes detected"** e `schema.yaml`/`types.gen.ts` **não mudam nem um byte** (esta story não toca backend). Um diff neles é sinal de erro, não de progresso.

### AC9 — Regressão: legado preservado, os quatro specs acoplados e a baseline que já está vermelha

**Dado que** `/planner/recurring` é hoje a superfície legada mais exercitada por E2E do repositório e que **duas das rotinas de teste do próprio chrome a usam como "rota ainda legada"**,
**Quando** esta story entrega,
**Então** `RecurringPage.tsx`, `RecurringPage.test.tsx`, `RecurringTemplateManager.tsx` e `RecurringTemplateManager.test.tsx` (417 linhas, 22 testes) **permanecem no repositório, apenas desmontados da rota** — mesma decisão da 14.7 para `FuturePage.tsx`, pelo mesmo motivo (a remoção do legado é o Épico 18) e com o mesmo efeito prático: o **rollback por superfície continua sendo uma linha em `router.tsx`**. `RecurringPage.test.tsx` continua verde por renderizar o componente direto, sem depender da rota,
**E** — **fato medido, não suposto** — `frontend/e2e/recurring-templates.spec.ts` está **4 failed / 0 passed** no baseline `79e5421`, e as quatro falhas têm a **mesma causa raiz, que não é desta story**: o assert `getByText('{título} — {Grupo}')` da `RecurringPlacementSection`, que vive em `WeeklyPage`/`MonthlyPage` legadas enquanto `planner/week`/`planner/month` montam os boards novos desde a 14.5/14.6. Execução de 2026-07-26 (`CI=1`, `--retries=0`), com a linha exata de cada uma:

| Teste | Passos da **biblioteca** | Falha em | Locator |
|---|---|---|---|
| `:12` CRUD + placement | **passam** (linhas 26-44) | `:50` | `getByText('Reunião semanal — Semanal')` |
| `:128` editar após placement | **passam** (139-147) | `:152` | `getByText('Standup — Semanal')` |
| `:224` modal do Monthly | **passam** | — | `getByText('Fechar o mês — Mensal')` |
| `:306` etiqueta Eisenhower | **passam** (317-330) | `:342` | `getByText('Planejamento crítico — Semanal')` |

**Então** o contrato desta story sobre esse arquivo é **exato**: os passos de biblioteca **que hoje executam** são portados para a superfície nova e **continuam passando**; os passos de **placement** continuam vermelhos pela mesma causa raiz, **no mesmo ponto ou depois — nunca antes**. Nenhum dos 4 testes pode ser deletado nem `.skip` (a 14.6 levou achado **ALTO** por deletar exatamente um teste nessa situação), e o arquivo ganha um comentário de cabeçalho registrando a causa raiz e o dono (Épico 17/18, quando o placement legado sair),
**E** — **armadilha de cobertura, não a subestime** — tudo que vem **depois** do assert que falha **nunca executou** e portanto **não está coberto por ninguém hoje**: em `:12`, os passos de **Desativar + "Mostrar inativos"** (`:100-116`) são inalcançáveis; em `:128`, o passo de **Editar** (`:167-180`) é inalcançável. Portar o arquivo **não** dá cobertura a esses fluxos — é `recurring-library.spec.ts` (novo) que precisa cobri-los de ponta a ponta. Assumir que "o spec legado já testava isso" é falso desde a 14.5,
**E** `frontend/e2e/recurring-soft-delete.spec.ts` (baseline medido em 2026-07-26: **3 passed / 1 failed**) é o **ponto de extensão natural** desta story, como o passo de QA da 14.4 já previu: hoje toda escrita é pelo fio "porque não existe botão Excluir para clicar nesta onda". Agora existe — o teste `:128` ("AC6 na biblioteca real") troca a chamada `api.remove()` por **clicar em Excluir + confirmar no dialog**, preservando a tese literalmente. Os acoplamentos que **quebram** com a superfície nova estão enumerados nos Dev Notes e **cada um** precisa de decisão explícita: o sufixo textual `(inativo)` (`:180`,`:193`) vira **chip**; o papel do filtro (`:179`,`:195`); e o container por `xpath=ancestor::div[2]` (`:189-191`), que deve virar escopo por papel/nome estável. O único vermelho é `:275`, que estoura na **linha 311** pela mesma causa raiz do parágrafo anterior (comentário `:266-274` documenta) — **não é desta story consertá-lo**, e depois da entrega ele deve continuar estourando **na linha 311 ou depois**,
**E** `frontend/e2e/future-log-annual.spec.ts` (linhas **68-81**) cria os dois templates anuais **pelo formulário legado** (`getByRole('form', { name: 'Novo template recorrente' })` + `getByLabel('Recorrência (texto livre)')` + o assert `getByText('Anual — todo dezembro')`) — **esse spec quebra inteiro** se a criação não for reancorada na superfície nova. É o spec mais acoplado depois do `recurring-templates`, e a tese dele (anuais pendentes → Alocar → some sem estado vazio) **não muda**,
**E** as **duas provas de seam** que hoje usam Recorrentes como "rota ainda legada" são reancoradas **na mesma entrega**, porque `surfaceMigrated: true` as inverte:
 - `frontend/e2e/shell.spec.ts:145-156` — "seam persiste ao navegar" navega para **Recorrentes** em `:153` (o próprio comentário `:136-144` diz "até a Story 14.8"); 
 - `frontend/e2e/future-log-board.spec.ts:133-136` — usa **Recorrentes** como **irmã de não-vacuidade** do "seam some em `/planner/future`".
 O destino novo deve ser **`Configurações`** — destino de **topo** (não aninhado sob o Planner, logo imune ao rail colapsado do tablet) e a superfície legada de vida mais longa da fila (Épico 18.1). Registrar essa razão no comentário dos dois specs para encerrar a troca a cada story,
**E** `frontend/e2e/recurring-templates.spec.ts:26-27`, `recurring-soft-delete.spec.ts:159-160`, `future-log-annual.spec.ts:68-69` e `future-log-board.spec.ts:135-136` dependem de `getByRole('button', { name: 'Recorrentes' })` + `getByLabel('Recorrentes')` — **preservar `<main aria-label="Recorrentes">`** (AC1) mantém os quatro navegando; conferir, não reescrever,
**E** nasce `frontend/e2e/recurring-library.spec.ts` cobrindo o que só o browser real prova: abas com contagem que muda com o filtro; criar pelo card (grupo herdado da aba **e** trocado antes de criar); editar com **grupo readonly**; validação bloqueando com rascunho preservado; **Desativar → chip "inativo" → Ativar**; **Excluir → dialog → some de todas as abas mesmo com "Mostrar inativos" ligado**, com o par de não-vacuidade "o vivo continua lá"; ausência de Alocar na biblioteca com irmã provando que ele existe no Future Log; offline; e as **5 faixas de axe com os overlays abertos**,
**E** a disciplina de não-vacuidade vale para todo assert de ausência: toda asserção "não aparece" tem irmã "aparece quando deveria",
**E** os gates fecham com números **re-executados após o último commit de código**: `npx tsc -b --noEmit`, `npm run lint`, `npx vitest run`, `uv run pytest` full-suite, `uv run ruff check .`, `uv run lint-imports`, `makemigrations --check --dry-run`, `schema.yaml`/`types.gen.ts` **sem diff**, e Playwright escopado aos specs afetados **depois** de `migrate --check` limpo na branch Neon `e2e`.

## Tasks / Subtasks

> **Sequenciamento: Fase A (fundação compartilhada) → Fase B (superfície) → Fase C (excluir + rename) → Fase D (a11y, regressão, E2E)**. Cada fase é um checkpoint de commit natural.

### Fase A — Fundação compartilhada

- [x] **Task 1 — Extrair os dois controles canônicos (AC3)**
  - [x] Criar `frontend/src/features/bujo/components/CategorySwatchGroup.tsx` movendo, **sem alterar comportamento**, o `role="radiogroup"` + `handleCategoryKeyDown` (roving tabindex com wrap) + o `CategorySwatch` de `TaskDetailCard.tsx` (`:45-48`, `:184-197`, `:299-327`, `:448-492`). Props: `value: TaskCategory | null`, `onChange`, `readonly?`.
  - [x] Criar `frontend/src/features/bujo/components/EisenhowerCheckboxPair.tsx` movendo `toggleUrgent`/`toggleImportant` (`:50-60`) + o par de checkboxes (`:330-357`). Props: `value: TaskEisenhower | null`, `onChange`, `readonly?`.
  - [x] `TaskDetailCard.tsx` passa a consumir os dois. **Rodar `TaskDetailCard.test.tsx` sem alterá-lo** — verde é o aceite. Se um assert exigir mudança, a extração está errada.
  - [x] Testes próprios co-locados para os dois módulos (o `TaskDetailCard.test.tsx` continua sendo a prova de integração; estes provam a unidade isolada, incl. `readonly`).

- [x] **Task 2 — `ItemRowBase` (AC2)**
  - [x] Criar `frontend/src/features/bujo/components/ItemRowBase.tsx` + `.test.tsx`, com o cabeçalho documentando reuso por Brain Dump (Épico 15) e settings (Épico 18), a divergência de posição do chip Eisenhower e a regra de opacidade (só em elementos com fundo opaco próprio).
  - [x] Consumir `--ds-task-row-*` e `typography.meta`; **nenhum token novo**.

- [x] **Task 3 — Camada de API (AC4, AC8)**
  - [x] `useDeleteRecurringTemplateMutation` em `features/bujo/api.ts` (molde de `useUpdateRecurringTemplateMutation`, `:540-548`).
  - [x] Acrescentar os prefixos de fonte de ritual + Future Log às três mutações de template, com comentário registrando que é **consistência aditiva**, não conserto (`staleTime: 0` já cobre a navegação).
  - [x] `api.test.tsx`: mutação nova + invalidações. Fechar o barrel (`features/bujo/index.ts`) e `types.ts` **agora**, não na Fase B.

### Fase B — Superfície

- [x] **Task 4 — `TemplateDetailCard` (AC3)**
  - [x] Criar `frontend/src/features/bujo/components/TemplateDetailCard.tsx` + `.test.tsx`: header/corpo/rodapé, os 6 campos, Grupo segmented (editável na criação, readonly na edição), validação com rascunho preservado, `role="alert"` único por erro, sem toast no sucesso, fechar explícito descarta.
  - [x] Cobrir paridade criar × editar como **um** componente (mesmo card, três diferenças enumeradas na AC3).

- [x] **Task 5 — Componentes de `recurring/` (AC1, AC6)**
  - [x] Criar `frontend/src/features/bujo/components/recurring/`: abas com contagem (+ faixa rolável em compact), filtro "Mostrar inativos", lista de `ItemRowBase` e o skeleton da geometria abas+linhas. Granularidade a critério do dev, **co-locado com teste**.
  - [x] Derivar as contagens da **mesma lista filtrada** que renderiza (AC1) — teste que liga o filtro e assere os três números mudando.
  - [x] `recurring/noLiteralTokens.test.ts` (molde de `future/`).

- [x] **Task 6 — Página + router/shell (AC1, AC9)**
  - [x] Criar `frontend/src/pages/planner/RecurringLibraryPage.tsx` + `.test.tsx`, landmark `<main aria-label="Recorrentes">`, compondo header + abas + lista + card; estados da AC6 com a cópia literal do mockup.
  - [x] `router.tsx:149-152`: `planner/recurring` passa a montar a página nova; `<RecurringPage />` deixa de ser montada (arquivo permanece — AC9).
  - [x] `shellRouting.ts:65`: `planner/recurring` → `surfaceMigrated: true`; atualizar `shellRouting.test.ts` (`MIGRATED_ROUTE_IDS`).
  - [x] Estender `pages/planner/noLiteralTokens.test.ts`.

### Fase C — Excluir e rename

- [x] **Task 7 — Soft delete pela UI (AC4)**
  - [x] Lixeira no rodapé da edição + `alertdialog` de confirmação com a cópia do mockup nomeando o template; fiar `useDeleteRecurringTemplateMutation`.
  - [x] Falha do `DELETE` mantém card e dialog utilizáveis com motivo e retry.
  - [x] Teste que exercita **Desativar/Ativar e Excluir no mesmo cenário** (AC4) — a justaposição é a prova.

- [x] **Task 8 — Rename "Definir placement" → "Alocar" (AC5)**
  - [x] Os **3** sítios de produção enumerados na AC5.
  - [x] Os testes unitários que asseram o rótulo (`RecurringPlacementSection.test.tsx`, `FuturePage.test.tsx`, `MonthlyPage.test.tsx`) — atualizar, **nunca deletar**.
  - [x] **`e2e/archive.spec.ts:102,126`** — trocar para `name: 'Alocar'`, senão os dois asserts negativos viram vacuosos.
  - [x] `e2e/future-log-annual.spec.ts:114`.
  - [x] Grep final: **zero** ocorrências de "Definir placement" como **rótulo** (string de JSX ou de locator) em `frontend/src` e `frontend/e2e`. Menções em **comentário** que registram a história do rename são legítimas e devem permanecer — não caçar prosa.

### Fase D — Acessibilidade, regressão e E2E

- [x] **Task 9 — Acessibilidade (AC6)**
  - [x] 5 faixas de axe **desde o primeiro commit** do spec, medindo **lista, card aberto e dialog aberto**.
  - [x] Conferir papéis/nomes das abas, dos dois radiogroups, do filtro e do dialog; contenção e devolução de foco; contraste do inativo em light **e** dark.

- [x] **Task 10 — E2E e regressão (AC9)**
  - [x] Criar `frontend/e2e/recurring-library.spec.ts` com a cobertura da AC9.
  - [x] Portar os passos de biblioteca de `recurring-templates.spec.ts` (4 testes, **nenhum deletado**) e acrescentar o comentário de cabeçalho sobre a causa raiz das falhas de placement.
  - [x] Atualizar `recurring-soft-delete.spec.ts` (Excluir por clique no teste `:128`; chip em vez de `(inativo)`; container estável; papel do filtro) e `future-log-annual.spec.ts` (criação pelo card novo).
  - [x] Reancorar `shell.spec.ts:153-157` e `future-log-board.spec.ts:132-136` em **Configurações**, com a razão no comentário.
  - [x] Conferir (não reescrever) os specs que só dependem do rótulo/landmark "Recorrentes".
  - [x] `nvm use 22.15.1`; `migrate --check` limpo na branch Neon `e2e` **antes** do Playwright; `CI=1`, portas 5173/8000 (nunca matar 5174/8001).

- [x] **Task 11 — Gates finais (AC8, AC9)**
  - [x] `npx tsc -b --noEmit`, `npm run lint`, `npx vitest run`, `uv run pytest -q`, `uv run ruff check .`, `uv run lint-imports`, `makemigrations --check --dry-run`, **diff vazio** em `schema.yaml`/`types.gen.ts`, Playwright escopado. **Números derivados de execução real, nunca por subtração.**

## Dev Notes

### Reuso obrigatório — não recriar

| Já existe | Arquivo | Ação nesta story |
|---|---|---|
| Controles canônicos de Categoria/Eisenhower | `components/TaskDetailCard.tsx` (`:45-60`, `:184-197`, `:299-357`, `:448-492`) | **EXTRAIR** para módulos compartilhados; `TaskDetailCard` passa a consumi-los, testes intactos (AC3). |
| Aparência do Excluir (lixeira 44×44, `Trash`, `--ds-ink-muted`) | `components/TaskDetailCard.tsx:432-440` | Copiar a aparência. **Não inventar** ícone nem cor. |
| Regra de opacidade terminal | `components/TaskRowBase.tsx:38-52` | Aplicar o mesmo racional ao inativo. É a lição que a 14.5 pagou com `color-contrast`. |
| Tokens `taskRow`/`panel`/`chip`/cores | `shared/design/tokens.ts:176-286` | Consumir. **Nenhum token novo** (AC7). |
| `useRecurringTemplatesQuery`, `useCreate…`, `useUpdate…` | `features/bujo/api.ts:487-548` | Consumir como estão. Só a mutação de `DELETE` é nova. |
| `useOnlineStatus` | `shared/hooks/useOnlineStatus.ts` | Consumir (molde do `FutureBoardPage`). |
| `RecurringPlacementDialog` / `RecurringPlacementSection` | `components/` | **Só o rótulo muda** (AC5). Comportamento intocado. |
| `PlannerSkeleton` | `components/PlannerSkeleton.tsx` | **Não serve**: pilha genérica, não preserva a geometria abas+linhas da AC6. Compor local — **não** deformar o compartilhado. |
| `TaskRowBase` / `TaskDetailCard` | `components/` | **Não são reusáveis aqui** (tipados sobre `Task`). Ver "Por que não dá para reusar" abaixo. |

### Estrutura de arquivos (alinhada à convenção vigente)

```
frontend/src/features/bujo/components/
  CategorySwatchGroup.tsx        NOVO  — extraído de TaskDetailCard (raiz: 2 consumidores)
  EisenhowerCheckboxPair.tsx     NOVO  — idem
  ItemRowBase.tsx                NOVO  — irmão de TaskRowBase.tsx (componente de RAIZ)
  TemplateDetailCard.tsx         NOVO  — irmão de TaskDetailCard.tsx
  TaskDetailCard.tsx             EDITA — passa a consumir os dois extraídos
  recurring/                     NOVO  — pasta da superfície (molde de weekly/ monthly/ future/)
    <abas, filtro, lista, skeleton>.tsx + .test.tsx
    noLiteralTokens.test.ts      NOVO  — guardrail de fronteira de pasta
frontend/src/pages/planner/
  RecurringLibraryPage.tsx       NOVO  (+ .test.tsx)
  RecurringPage.tsx              INTOCADO — permanece no repo, só desmontado da rota
  noLiteralTokens.test.ts        EDITA — entrada da página nova
frontend/src/features/bujo/api.ts       EDITA — useDeleteRecurringTemplateMutation
frontend/src/features/bujo/index.ts     EDITA — barrel
frontend/src/app/router.tsx             EDITA — planner/recurring monta a página nova
frontend/src/app/layout/shell/shellRouting.ts  EDITA — surfaceMigrated: true
frontend/e2e/recurring-library.spec.ts  NOVO
```

Nada em `backend/`. Nada em `schema.yaml`/`types.gen.ts`. Nenhum bloco novo em `tokens.ts`.

### Por que `TaskRowBase`/`TaskDetailCard` não servem — e o que exatamente se reusa

A leitura apressada do M09 ("criar/editar no **mesmo card** do detalhe de tarefa") sugere reusar `TaskDetailCard` diretamente. Não dá, e forçar seria pior que duplicar:

1. **Os tipos não coincidem.** `TaskDetailCardProps.task` é `Task` (`components['schemas']['Task']`); `RecurringTaskTemplate` é outro schema, sem `status`, `logId`, `subtasks`, `migratedToTask`, `migrationCount` nem `orderIndex`. Fabricar um `Task` sintético para satisfazer o tipo é o caminho curto para um bug silencioso.
2. **Os campos divergem nas duas direções.** O template **não tem** subtarefas (AD-08 item 8: "template é sempre plano"), nem Mover, nem Cancelar; e **tem** dois campos que tarefa nenhuma tem — `recurrenceGroup` (segmented, readonly na edição) e `recurrenceText`.
3. **O rodapé é outro.** Tarefa: Salvar · Mover · Cancelar · Excluir. Template: Salvar · **Ativar/Desativar** · Excluir.

O que **é** literalmente compartilhado — e por isso a AC3 exige extração, não cópia — são os **dois controles** que o `DESIGN.md` L673 declara canônicos "para toda superfície com detalhe — **tarefa e template recorrente**". Mesma lógica para a linha: `ItemRowBase` é irmão de `TaskRowBase`, consome as mesmas CSS vars, e a única coisa que não herda é a máquina de estados.

### O que o backend já entrega (e o que o cliente nunca fiou)

| Capacidade | Método + URL | Cliente hoje |
|---|---|---|
| Listar (já filtra excluídos na origem) | `GET /api/bujo/recurring-templates/` | `useRecurringTemplatesQuery` ✅ |
| Criar | `POST /api/bujo/recurring-templates/` | `useCreateRecurringTemplateMutation` ✅ |
| Editar | `PATCH /api/bujo/recurring-templates/{id}/` | `useUpdateRecurringTemplateMutation` ✅ |
| **Soft delete** | `DELETE /api/bujo/recurring-templates/{id}/` → **204** | ❌ **não existe** — AC4 |
| Alocar (fora do escopo da biblioteca) | `POST /api/bujo/recurring-templates/{id}/place/` | `usePlaceRecurringTemplateMutation` ✅ |

`RecurringTaskTemplateSerializer` (`serializers.py:514-526`) expõe 8 campos e **não** expõe `deleted_at` — deliberado (14.4, AC4). A superfície nova **não precisa** do campo: um template excluído simplesmente não vem na resposta.

**`recurrence_group` readonly é contrato de UI, não de API.** `RecurringTaskTemplateUpdateSerializer` (`serializers.py:554-556`) continua aceitando o campo no `PATCH` — a 14.4 registrou isso como Questão aberta e o atribuiu a esta story. A decisão desta story é **readonly no cliente, backend intocado**, porque esta é uma entrega sem backend (AC8) e endurecer o serializer mudaria o contrato de um endpoint que o legado ainda consome. Registrado como Questão aberta #3.

### Dois deltas silenciosos de comportamento (decidir de propósito, não por omissão)

1. **O checkbox "Ativo" da criação some.** O form legado tem um `Checkbox` "Ativo" (`RecurringTemplateManager.tsx:278-283`), então hoje dá para **nascer inativo**. O card do mockup (frame B) tem no rodapé da criação **só** o primário — Ativar/Desativar aparece na edição. Consequência: todo template passa a nascer `active: true`. É o que o mockup especifica e é coerente (criar um template já desativado não tem caso de uso), mas é mudança de contrato de UI: registrar em comentário e no Completion Notes, não deixar como acidente.
2. **A ordenação vem do servidor.** `RecurringTaskTemplateListView` já devolve `order_by("recurrence_text")` (`views.py:232`). A superfície nova **preserva a ordem da resposta** — não reordenar no cliente, não inventar ordenação por título. Se a ordem por texto de recorrência parecer errada em revisão, é decisão de produto (Questão aberta), não ajuste de implementação.

### O que quebra e por quê — mapa de acoplamento E2E (lido nos arquivos, não suposto)

`/planner/recurring` é a rota legada mais exercitada do repositório. Quatro arquivos dependem do **DOM** da superfície (não só do nome do destino):

| Arquivo | Acoplamento | Estado hoje |
|---|---|---|
| `recurring-templates.spec.ts` | `getByRole('form', {name:'Novo template recorrente'})`, `getByLabel('Recorrência (texto livre)')`, `getByLabel('Eisenhower')` (MUI Select), `getByRole('tab',{name})`, `getByRole('checkbox',{name:'Mostrar inativos'})`, `getByText(/… \(inativo\)/)`, `xpath=ancestor::div[2]`, `getByRole('button',{name:'Editar'})` | **4 failed / 0 passed** — passos de biblioteca passam, placement falha (tabela na AC9) |
| `recurring-soft-delete.spec.ts` | idem + `getByText(/Semanal — todo dia útil \(inativo\)/)`, `getByRole('button',{name:'Ativar'})` | **3 passed / 1 failed** (medido): `:128`, `:210` e `:339` verdes; `:275` vermelho na linha **311**, mesma causa raiz (comentário `:266-274`) |
| `future-log-annual.spec.ts` | cria os 2 anuais **pelo form legado** (`:68-81`) | verde — **quebra inteiro** sem reancoragem |
| `future-log-board.spec.ts` / `shell.spec.ts` | usam Recorrentes como **rota ainda legada** para provar o seam | verdes — **invertem** com `surfaceMigrated: true` |

Três decisões de rótulo/papel decidem quanto desses specs sobrevive sem edição. Decidir **antes** de escrever a UI, não depois:

1. **Filtro "Mostrar inativos":** MUI `Switch` → `role="checkbox"` (preserva 3 asserts) × `role="switch"` do mockup (quebra 3 asserts). O `EXPERIENCE.md` não fixa o papel; o mockup fixa. Qualquer escolha exige registro e, se mudar, atualização no mesmo commit.
2. **Sufixo `(inativo)` × chip:** o legado concatena `" (inativo)"` na subline (`RecurringTemplateManager.tsx:108`) e **dois specs** asseram por regex com esse sufixo. O mockup e o `DESIGN.md` L649 pedem **chip textual**. O chip vence (é a especificação), e os asserts são reescritos para o chip — a tese ("o inativo volta com o filtro ligado") é preservada literalmente.
3. **Container da linha:** `xpath=ancestor::div[2]` é frágil por construção e vai quebrar. A superfície nova deve dar **escopo estável** por papel/nome (o padrão que a 14.7 adotou com `role="region"` e `role="listitem"`), e os specs passam a usá-lo.

### As quatro falhas de `recurring-templates.spec.ts` **não são desta story**

Medido em `79e5421` (2026-07-26, `CI=1 npx playwright test e2e/recurring-templates.spec.ts --retries=0`): **4 failed**. Todas param no primeiro assert da `RecurringPlacementSection` (`'{título} — {Grupo}'`), depois de os passos de biblioteca terem passado. Causa raiz única: a seção de placement de recorrentes vive nas páginas legadas `WeeklyPage`/`MonthlyPage`, e `planner/week`/`planner/month` montam `WeeklyBoardPage`/`MonthlyBoardPage` desde a 14.5/14.6 — nos boards novos a alocação passou a ser ato **do ritual**, por desenho (M06/M07). É a **mesma** causa raiz de `recurring-soft-delete.spec.ts:275` e dos 5 vermelhos conhecidos de `move-task.spec.ts`.

Consequências práticas para o dev:

- **Não é regressão sua.** Meça o baseline antes de começar e compare depois.
- **Não delete nem `.skip`.** A 14.6 levou achado **ALTO** no code-review por deletar um teste nessa exata situação.
- **Não "conserte" reintroduzindo a seção de placement no board novo** — seria desfazer uma decisão de produto de duas stories anteriores.
- O critério de aceite é posicional: depois da entrega, as falhas continuam **no passo de placement**, nunca num passo de biblioteca.

### Inteligência das stories anteriores — o que já custou code-review nas 14.5/14.6/14.7

Cada item abaixo tem endereço nesta story:

1. **Componente nunca medido ABERTO no gate de axe** — CRITICAL na 14.6 (`aria-required-children` no `MonthlyDestinationPicker`) e **de novo** na 14.7 (aba "Outro mês"). Aqui há **três** estruturas ARIA novas fechadas por default: abas, radiogroup de Grupo, dialog de confirmação. AC6 exige medi-las abertas.
2. **Roving tabindex esquecido em `role="radiogroup"`** — ALTO na 14.5: só a opção já selecionada era alcançável por teclado. A Task 1 **move** o código que resolve isso; perder o `handleCategoryKeyDown` na extração reproduz o achado.
3. **Opacidade em texto reprovando `color-contrast`** — achado real da 14.5, invisível em jsdom. O "inativo com menor ênfase" desta story é o candidato natural (AC2).
4. **Número de gate afirmado sem execução** — MÉDIO na 14.3 e na 14.6 ("`move-task.spec.ts` 8/11" num arquivo de 9 testes). Contar por contagem literal, nunca por subtração (Task 11).
5. **`tsc -b --noEmit` mascarado pelo Vitest** — ALTO na 14.6 (esbuild não type-checa testes). Rodar `tsc` de verdade antes de declarar o gate.
6. **Guard de literal genérico demais / de menos** — ALTO na 14.6 (o `7` nunca era pego). AC7 exige que o guard novo **pegue** algo se o literal voltar.
7. **Barrel incompleto travando a fase seguinte** — 14.6 e 14.7. Fechado na Task 3, antes da UI.
8. **Assert que vira vacuoso depois de um rename** — a armadilha nova desta story (`archive.spec.ts:102,126`, AC5). A 14.4 já teve dois asserts tautológicos corrigidos no code-review.

**Padrão de commit observado** (`971da7c` → `79e5421`, sete stories): **um commit por story**, mensagem `feat(story-14.N): <título>`, incluindo frontend + E2E + o arquivo da story + `sprint-status.yaml` + o relatório de arquivos não commitados. Manter.

### Cópia canônica (do mockup — não inventar)

- Subtítulo do header: "Modelos que você aloca manualmente ao planejar. Não geram tarefas sozinhos."
- Vazio por grupo: "Nenhum template neste grupo." + "Crie um modelo para alocá-lo depois ao planejar."
- Erro de leitura: "Não foi possível carregar os templates." + "Tentar de novo"
- Offline: "Você está offline. Consulta disponível; criar e editar templates ficam indisponíveis até reconectar."
- Hint do Grupo (criação): "Herdado da aba ativa; pode trocar antes de criar."
- Hint da Recorrência: "Texto livre — exibido como lembrete, nunca interpretado para inferir datas."
- Nota do rodapé (criação): "Título e recorrência são obrigatórios."
- Dialog: "Excluir template?" · "«{título}» sai da biblioteca e deixa de ser oferecido nos rituais. As tarefas já criadas a partir dele são preservadas e mantêm a linhagem — a exclusão é lógica (soft delete)." · Cancelar / Excluir
- Validação: "Informe um título."

### Stack em vigor — **nenhuma dependência nova**

React `^19.2.0` (ref é prop normal, sem `forwardRef` — ver `TaskDetailCard.tsx:461`), `@mui/material` `^6.1.0`, `@tanstack/react-query` `^5.101.1`, `@phosphor-icons/react` `^2.1.10`, TypeScript `~5.9.0`, Vitest `^4.1.9`, `@playwright/test` `^1.61.1`, `@axe-core/playwright` `^4.12.1`. **Nenhuma lib de tabs, de dialog, de forms ou de ícones além do que já existe.** `@mui/icons-material` permanece **só** no legado até o Épico 18 — componente novo usa `@phosphor-icons/react` (AD-29). Qualquer dependência nova é mudança de escopo: registrar como Questão aberta antes de instalar.

### Convenções de teste (idênticas às da 14.5/14.6/14.7 — citadas, não repetidas)

Co-localização `Component.test.tsx`; `frontend/e2e/fixtures.ts` (`test` **nunca** de `@playwright/test` direto); `shellHelpers.ts` (`navigate`, `waitForDialogSettled`, `waitForSheetSettled`); `axeHelper.ts` (`expectNoAxeViolations`); disciplina de não-vacuidade; nomes de teste em pt-BR. **`nvm use 22.15.1`** antes de qualquer comando de frontend (a sessão abre em v18). Playwright em `CI=1` nas portas 5173/8000 — **nunca** matar 5174/8001 (dev local do usuário). No viewport **tablet (800px) a sidebar inicia em rail colapsado** e **Recorrentes é destino ANINHADO sob o Planner** (`shellDestinations.ts:50-55`): expandir a sidebar antes de clicar (`mainNav().getByRole('button',{name:'Expandir sidebar'})`), senão o clique trava até timeout. Cuidado com locators sem escopo: o `BrainDumpCaptureSheet` portaliza um `Título *` oculto em toda rota desde a 13.3 — escopar `getByLabel('Título')` ao card.

### Baseline medida na criação da story (commit `79e5421`)

Todas re-executadas em 2026-07-26, não lidas de story anterior:

- `uv run pytest -q` (full-suite): **1314 passed em 258,27s**
- `npx vitest run`: **1545 passed / 121 arquivos em 156,06s**
- `CI=1 npx playwright test e2e/recurring-templates.spec.ts --retries=0`: **4 failed / 0 passed** (tabela na AC9)
- `CI=1 npx playwright test e2e/recurring-soft-delete.spec.ts --retries=0`: **3 passed / 1 failed** (`:275`, na linha 311)
- `git status --short`: limpo, exceto artefatos de orquestração do story-automator.

Os dois primeiros números batem **exatamente** com os gates pós-correção que o code-review da 14.7 registrou — o baseline não drifta. Derive os testes novos por `git diff`, nunca por subtração.

### Referências

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 14.8` (L2335-2350) — ACs originais do épico]
- [Source: `.../ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Recorrentes` (L349-357), `#Component Patterns` (L119), `#State Patterns` (L410-411)]
- [Source: `.../DESIGN.md#Recorrentes (Coleção)` (L647-655), `#Task Row` (L671-681 — controles canônicos e o Excluir), tabela de componentes (L523)]
- [Source: `.../mockups/key-recorrentes.html` — mockup canônico aprovado (frames A–E + reconciliação e decisões fechadas)]
- [Source: `.../architecture-and-story-handoff.md#M09 — Recorrentes`]
- [Source: `.../.decision-log.md` — "Abertura do M09" + Revisões 1 e 2 + "M09 aprovado e promovido" (2026-07-21)]
- [Source: `_bmad-output/planning-artifacts/architecture.md#AD-08` (itens 1, 4, 5, 6, **6b**, 8), `#AD-29` (coexistência por rota, Phosphor)]
- [Source: `_bmad-output/implementation-artifacts/14-4-soft-delete-de-templates-recorrentes-backend.md` — backend do soft delete + os 3 achados que o passo de QA registrou para esta story]
- [Source: `_bmad-output/implementation-artifacts/14-7-future-log-no-sistema-novo.md` — precedente direto: extensões aditivas, achados de a11y, Questões abertas #2 e #8]
- [Source: `backend/bujo/views.py:227-311`, `backend/bujo/serializers.py:514-564`, `backend/bujo/services/recurring.py` (`live_templates`, `soft_delete_template`)]
- [Source: `frontend/src/features/bujo/components/TaskDetailCard.tsx`, `TaskRowBase.tsx`, `RecurringTemplateManager.tsx`, `RecurringPlacementSection.tsx`, `RecurringPlacementDialog.tsx`; `frontend/src/features/bujo/api.ts:458-590`; `frontend/src/api/keys.ts:29-33`; `frontend/src/api/queryClient.ts`; `frontend/src/app/router.tsx:149-167`; `frontend/src/app/layout/shell/shellRouting.ts:69`; `frontend/src/app/layout/shell/shellDestinations.ts:50-63`]
- [Source: `frontend/e2e/recurring-templates.spec.ts`, `recurring-soft-delete.spec.ts`, `future-log-annual.spec.ts`, `future-log-board.spec.ts:133-136`, `shell.spec.ts:136-156`, `archive.spec.ts:102,126`]

### Questões abertas

1. **Papel do filtro "Mostrar inativos".** `role="checkbox"` (MUI `Switch`, preserva 3 asserts E2E) × `role="switch"` (o que o mockup desenha). Decisão de implementação com custo de teste conhecido — registrar a escolha no componente. Não deixar implícita.
2. **Sheet em compact para o card de detalhe.** `DESIGN.md` L651 pede "drawer no desktop, **sheet no compact**", mas o `TaskDetailCard` das 14.5-14.7 é `Dialog` do MUI em **todas** as faixas. Adotar sheet só aqui criaria assimetria entre os dois cards irmãos; adotar nos dois é refatoração de três superfícies já entregues. Esta story segue o `Dialog` (paridade com o irmão) e registra a divergência — decisão de produto para o rito `bmad-ux` ou para uma story própria.
3. **`recurrence_group` no `PATCH`.** Readonly é garantido na UI; o serializer continua aceitando o campo (herdada da 14.4, Questão aberta #3). Endurecer no backend é mudança de contrato — candidata ao Épico 18, quando o legado sair.
4. **`ItemRowBase` com um consumidor só.** Nasce genérico por contrato (`EXPERIENCE.md` L119 nomeia Brain Dump e settings), mas só a 14.8 o consome hoje. Confirmar que o Épico 15 é o segundo consumidor obrigatório — se o Brain Dump divergir de anatomia, a generalização vira dívida em vez de ativo.
5. **`RecurringPage.tsx` + `RecurringTemplateManager.tsx` desmontados.** Ficam no repo como código morto até o Épico 18, junto com `FuturePage.tsx` e `TaskRow.tsx`. São 417 linhas de teste legado que continuam rodando em todo `vitest run`. Confirmar que a dívida temporária é aceitável (é o preço do rollback por superfície em uma linha).
6. **Destino permanente das provas de seam.** Esta story move `shell.spec.ts` e `future-log-board.spec.ts` de Recorrentes para **Configurações**. É a última rota legada de vida longa; quando o Épico 18.1 migrar Configurações, os dois specs precisam de outro destino — ou de um seam simulado, que encerraria a troca de vez.
7. **Contagem por aba × filtro.** A AC1 fixa que a contagem reflete o filtro vigente. O mockup mostra "Anual 0" no frame de grupo vazio, o que é consistente; mas se o dono preferir que a contagem seja sempre o total do grupo (independente do filtro), é decisão de produto — não implementar as duas.
8. **FAB "＋ Novo" do mockup × FAB de captura do shell.** O frame D da M09 foi desenhado antes de a 13.3 fixar o FAB de captura persistente no mesmo canto do compact. A AC1 resolve mantendo **Novo template** no header, mas a decisão pertence ao rito `bmad-ux`: alternativas são mover o FAB de captura por superfície (rejeitado — é chrome global), empilhar dois FABs (rejeitado — alvo de toque e ordem de foco) ou reconciliar o mockup. Registrar no `.decision-log.md` na próxima passada de UX.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Amelia — dev-story)

### Debug Log References

- A implementação em disco (Fases A–D, Tasks 1–11) já existia não-commitada ao retomar esta sessão (pausa por limite de gasto do épico, ver memória). O trabalho desta sessão foi: reler a story inteira, verificar cada AC contra o código real (não confiar no estado das checkboxes, que estavam todas `[ ]` apesar do código completo), rodar todos os gates do zero, e corrigir dois defeitos reais encontrados na verificação:
  1. **`RecurringLibraryPage.tsx` escrevia o literal `44px` cru** (largura/altura do `IconButton` de exclusão e um comentário) em vez de `var(--ds-touch-target-min)` — violação direta da AC7 ("nenhum literal estrutural"), e a página nem sequer tinha entrada no guard `pages/planner/noLiteralTokens.test.ts` (a Task 6 pedia essa entrada; não existia). Corrigido: literal trocado pela CSS var, comentário reescrito sem o dígito, `RecurringLibraryPage.tsx` adicionado ao `SOURCES` do guard com `44px` acrescentado a `FORBIDDEN_LITERALS` (documentado inline, seguindo a regra da AC7 de nunca remover literal da lista). Não-vacuidade confirmada: o guard falhou antes da correção do comentário (pegou o `44px` em prosa), passou depois — o mecanismo pega de fato.
  2. **`future-log-annual.spec.ts` quebrava por colisão de strict-mode**: `card.getByLabel('Recorrência')` sem `{ exact: true }` casava tanto o input "Recorrência" quanto o `radiogroup` "Grupo de recorrência" (substring). `recurring-templates.spec.ts` já usava `{ exact: true }` no mesmo padrão — `future-log-annual.spec.ts` tinha ficado para trás na porta do form legado para o card novo. Corrigido nas duas ocorrências (linhas 84 e 92); teste voltou a passar sozinho e no lote completo.
- Baseline re-medido nesta sessão, no HEAD atual (com as duas correções acima), não herdado da story: `uv run pytest -q` → **1314 passed** (idêntico ao baseline da criação da story — esta story não toca backend); `npx vitest run` → **1748 passed / 131 arquivos** (1748 = 1545 do baseline + 203 novos, incl. os 3 testes adicionais do guard após a correção); `npx tsc -b --noEmit` limpo; `npm run lint` limpo; `uv run ruff check .` limpo; `uv run lint-imports` → 1 kept / 0 broken; `makemigrations --check --dry-run` → "No changes detected"; `git diff --stat -- schema.yaml frontend/src/api/types.gen.ts` vazio.
- Playwright, escopado aos 7 specs afetados (`recurring-library`, `recurring-templates`, `recurring-soft-delete`, `future-log-annual`, `shell`, `future-log-board`, `archive`), `CI=1 --retries=0`, contra a branch Neon `e2e` (`migrate --check` limpo antes de rodar): **36 passed / 5 failed** em 41 testes. Os 5 vermelhos são exatamente os que a AC9 contrata como fora de escopo, na posição exigida ("no mesmo ponto ou depois — nunca antes"): os 4 testes de `recurring-templates.spec.ts` (4/4, todos os passos de biblioteca passam antes de estourar no assert de `RecurringPlacementSection`, mesma causa raiz documentada) e o `:289` de `recurring-soft-delete.spec.ts` (a mesma falha que era `:275`/linha 311 no baseline, agora `:289`/linha 325 — "na linha 311 ou depois", cumprido). `recurring-library.spec.ts` (9/9, incl. as 5 faixas de axe com card e dialog abertos), `future-log-annual.spec.ts` (1/1, depois da correção acima), `shell.spec.ts` (7/7), `future-log-board.spec.ts` (14/14) e `archive.spec.ts` (2/2) fecham 100% verdes.

### Passo de QA — `bmad-qa-generate-e2e-tests` (2026-07-27)

- Reverifiquei os gates do zero no HEAD entregue pelo dev-story (não herdei os números): `npx vitest run` → **1748 passed / 131 arquivos**; `npx tsc -b --noEmit` limpo; `npm run lint` limpo; `uv run pytest -q` → **1314 passed em 257,35s**; `uv run ruff check .` limpo; `uv run lint-imports` → 1 kept/0 broken; `makemigrations --check --dry-run` → "No changes detected"; `migrate --check` limpo na branch Neon `e2e`. Playwright nos 7 specs afetados, `CI=1 --retries=0`: **36 passed / 5 failed em 41**, falhas nos mesmos locators/posições da AC9 (placement legado, causa raiz alheia) — sem regressão.
- Li os 6 specs E2E alterados (`archive`, `future-log-annual`, `future-log-board`, `recurring-soft-delete`, `recurring-templates`, `shell`) linha a linha contra o contrato exato da AC9/AC5 (tabela de acoplamento, decisão de rótulo do filtro, sufixo `(inativo)` → chip, container por `xpath` → `role="listitem"`) — bateram byte a byte com o que a story promete, sem achado.
- **Dois gaps reais de cobertura E2E encontrados e fechados em `recurring-library.spec.ts`** (AC3/AC4/AC6 estavam contratados mas só provados em jsdom com mutação mockada — a mesma classe de risco que as Stories 14.6/14.7 pagaram por medir estrutura ARIA nova sem exercitar o caminho real):
  1. **Falha de escrita (criar) e falha do `DELETE` nunca fecham o card/dialog, sempre oferecem retry** (AC3/AC4) — só havia prova em `TemplateDetailCard.test.tsx`/`RecurringLibraryPage.test.tsx` com a mutação mockada rejeitando. Novo teste intercepta o `POST`/`DELETE` reais via `page.route()`, força um `500` na 1ª tentativa, prova a cópia exata do erro (`WRITE_ERROR`/`DELETE_ERROR` de `RecurringLibraryPage.tsx`) e o rascunho preservado, depois deixa a 2ª tentativa passar (`route.continue()`).
  2. **O `alertdialog` de exclusão nasce com foco em "Cancelar" (ação não-destrutiva) e devolve o foco ao acionador ao fechar, por Escape e por Cancelar** (AC6) — não havia NENHUMA prova disso, nem unit nem E2E; só o axe media a estrutura ARIA, não o comportamento de foco do `FocusTrap` real do MUI (que jsdom não simula fielmente). Novo teste com `toBeFocused()` nos dois pontos.
- **Não-vacuidade provada para o teste de foco** (é contrato de acessibilidade — guardrail do passo de QA): comentei temporariamente o corpo do `onEntered` em `RecurringLibraryPage.tsx:296` (`transition: { onEntered: () => {} }`), rodei o teste isolado (`-g 'foco em .Cancelar'`) e vi **FALHAR** exatamente no `toBeFocused()` do Cancelar (`Received: inactive`); restaurei a linha original e confirmei o teste **verde** de novo e o conteúdo do arquivo idêntico ao anterior (arquivo é novo/não rastreado, então a checagem foi por `grep` do trecho, não `git diff`). O teste de falha de escrita/DELETE não é "correção" nem contrato de acessibilidade estrito (é contrato funcional de retry) — as asserções são todas de presença de texto/valor específico (nunca de ausência), o que já é não-vacuo por construção: se o app não tratasse o erro, o `toBeVisible()` do texto de erro estouraria por timeout.
- `recurring-library.spec.ts` passou de 9 para **11 testes** (rodados isolados: 11/11 verdes em 2,3min) — os 2 novos entram na faixa **wide** (mesmo padrão dos demais testes funcionais do arquivo; a cobertura de a11y/viewport já está nos outros 7).
- **Achado do code-review (MÉDIO, corrigido): o número combinado dos 7 specs acima (36/41) nunca foi re-executado depois de os 2 testes novos entrarem no arquivo** — exatamente a classe "número de gate afirmado sem execução" que a própria story lista como lição das 14.3/14.6. Re-executado agora, no HEAD final: `CI=1 npx playwright test e2e/recurring-library.spec.ts e2e/recurring-templates.spec.ts e2e/recurring-soft-delete.spec.ts e2e/future-log-annual.spec.ts e2e/shell.spec.ts e2e/future-log-board.spec.ts e2e/archive.spec.ts --retries=0` → **38 passed / 5 failed em 43** (36+2 novos verdes; os 5 vermelhos são os MESMOS locators/posições já documentados acima — `recurring-templates.spec.ts` 4/4 no assert de placement, `recurring-soft-delete.spec.ts:289`/linha 325 — nenhuma posição mudou, sem regressão). Este é o número final e autoritativo do gate de Playwright para esta story.

### Completion Notes List

- **AC1–AC9 implementadas e verificadas por leitura de código, não só por suíte verde.** Percorri cada AC contra o arquivo correspondente antes de aceitar o checkbox: extração dos dois controles canônicos com `TaskDetailCard.test.tsx` **byte-a-byte idêntico ao baseline** (`git diff`/`git status` vazios nesse arquivo) e verde (40/40); `ItemRowBase` sem coluna de status/indicador de ordem/subárvore, com a regra de opacidade aplicada só a elementos de fundo opaco (nunca título/descrição/container — os três têm teste de não-vacuidade dedicado); `TemplateDetailCard` com Grupo editável-na-criação/readonly-na-edição, validação com rascunho preservado e `role="alert"` por campo tocado; soft delete via `useDeleteRecurringTemplateMutation` fiando o verbo `DELETE` que o cliente nunca tinha chamado, com `alertdialog` nomeando o template e preservando card+dialog utilizáveis em erro; rename "Definir placement" → "Alocar" nos 3 sítios de produção exatos da AC5, com os testes unitários **atualizados** (nunca deletados) e os 2 asserts negativos de `archive.spec.ts` corrigidos para não ficarem vacuosos.
- **Decisões registradas no código, não deixadas implícitas** (Questões abertas #1–#8 da story): filtro "Mostrar inativos" ficou `role="checkbox"` (preserva os 3 asserts E2E vivos, decisão documentada no cabeçalho de `RecurringGroupTabs.tsx`); card de detalhe segue `Dialog` do MUI em todas as faixas (paridade com `TaskDetailCard`, não o `sheet` do mockup); `recurrence_group` fica readonly só no cliente, backend intocado; as duas provas de seam (`shell.spec.ts`, `future-log-board.spec.ts`) foram reancoradas em **Configurações**, com a razão registrada no comentário dos dois specs.
- **Dois defeitos reais encontrados e corrigidos nesta sessão** (não presentes no código herdado como features, mas como lacunas de verificação): o literal `44px` cru + guard ausente em `RecurringLibraryPage.tsx` (AC7), e a colisão de strict-mode em `future-log-annual.spec.ts` por falta de `{ exact: true }`. Ver Debug Log References para o detalhe de cada um.
- **AC9 cumprida com precisão posicional**: o baseline media `recurring-templates.spec.ts` em 4 failed/0 passed e `recurring-soft-delete.spec.ts` em 3 passed/1 failed, ambos pela mesma causa raiz alheia a esta story (a seção de placement legada não existe nos boards novos desde a 14.5/14.6). Depois da entrega, os mesmos testes falham nos mesmos locators, apenas em linhas deslocadas pela inserção de código antes deles — nenhum teste foi deletado, `.skip`ado ou teve sua tese alterada, e o passo de biblioteca de cada um (que antes não executava, por travar no form legado que não está mais montado na rota) agora executa e passa.
- **Delta de contrato de UI registrado, não deixado como acidente** (Dev Notes): todo template passa a nascer `active: true` — o checkbox "Ativo" da criação legada não tem equivalente no card novo (o mockup não o desenha na criação).
- Nenhuma dependência nova, nenhum token novo em `tokens.ts`, nenhuma mudança de backend/schema/contrato — confirmado pelos gates (Debug Log References).
- **Passo de QA (`bmad-qa-generate-e2e-tests`) fechou dois gaps reais de cobertura E2E**, ambos contratados por AC mas só provados em jsdom até então: falha de escrita (criar)/`DELETE` com retry sem fechar card/dialog (AC3/AC4), e foco inicial em "Cancelar" + devolução de foco ao acionador no `alertdialog` de exclusão (AC6) — este último com não-vacuidade provada por experimento (quebrar → falhar → restaurar → passar). `recurring-library.spec.ts` foi de 9 para 11 testes; todos os gates re-executados sem regressão (ver Debug Log References).

### File List

**Frontend — camada de API e barrel**

- `frontend/src/features/bujo/api.ts` *(`useDeleteRecurringTemplateMutation` nova + invalidação compartilhada das 3 mutações de template)*
- `frontend/src/features/bujo/api.test.tsx`
- `frontend/src/features/bujo/index.ts`

**Frontend — controles canônicos extraídos**

- `frontend/src/features/bujo/components/CategorySwatchGroup.tsx` *(novo)*
- `frontend/src/features/bujo/components/CategorySwatchGroup.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/EisenhowerCheckboxPair.tsx` *(novo)*
- `frontend/src/features/bujo/components/EisenhowerCheckboxPair.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/TaskDetailCard.tsx` *(passa a consumir os dois; `TaskDetailCard.test.tsx` NÃO foi tocado)*

**Frontend — componentes de raiz e superfície nova** *(pasta `recurring/` inteira é nova)*

- `frontend/src/features/bujo/components/ItemRowBase.tsx` *(novo)*
- `frontend/src/features/bujo/components/ItemRowBase.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/TemplateDetailCard.tsx` *(novo)*
- `frontend/src/features/bujo/components/TemplateDetailCard.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/recurring/RecurringGroupTabs.tsx` *(novo)*
- `frontend/src/features/bujo/components/recurring/RecurringGroupTabs.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/recurring/RecurringLibrarySkeleton.tsx` *(novo)*
- `frontend/src/features/bujo/components/recurring/RecurringLibrarySkeleton.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/recurring/TemplateLibraryList.tsx` *(novo)*
- `frontend/src/features/bujo/components/recurring/TemplateLibraryList.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/recurring/recurringLibrary.ts` *(novo)*
- `frontend/src/features/bujo/components/recurring/recurringLibrary.test.ts` *(novo)*
- `frontend/src/features/bujo/components/recurring/noLiteralTokens.test.ts` *(novo — guardrail de literais, TIPO NOVO nesta pasta)*
- `frontend/src/pages/planner/RecurringLibraryPage.tsx` *(novo)*
- `frontend/src/pages/planner/RecurringLibraryPage.test.tsx` *(novo)*
- `frontend/src/pages/planner/noLiteralTokens.test.ts` *(entrada nova para `RecurringLibraryPage.tsx` + `44px` em `FORBIDDEN_LITERALS`)*

**Frontend — router e shell**

- `frontend/src/app/router.tsx` *(`planner/recurring` monta `RecurringLibraryPage`)*
- `frontend/src/app/layout/shell/shellRouting.ts` *(`surfaceMigrated: true`)*
- `frontend/src/app/layout/shell/shellRouting.test.ts`

**Frontend — rename "Definir placement" → "Alocar" (AC5)**

- `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`
- `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`
- `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx`
- `frontend/src/pages/planner/FuturePage.tsx`
- `frontend/src/pages/planner/FuturePage.test.tsx`
- `frontend/src/pages/planner/MonthlyPage.test.tsx`
- `frontend/src/pages/planner/WeeklyPage.test.tsx`
- `frontend/src/pages/planner/FutureBoardPage.test.tsx`

**E2E**

- `frontend/e2e/recurring-library.spec.ts` *(novo — 11 testes, incl. 5 faixas de axe com card e dialog abertos; +2 do passo de QA: falha de escrita/DELETE com retry (AC3/AC4) e foco inicial/devolução de foco no alertdialog de exclusão (AC6))*
- `frontend/e2e/recurring-templates.spec.ts` *(atualizado: criação/edição portadas do form legado para o card novo; rename "Alocar"; seção de placement intocada — causa raiz alheia documentada no cabeçalho)*
- `frontend/e2e/recurring-soft-delete.spec.ts` *(atualizado: exclusão pela UI — lixeira + `alertdialog` — em vez de `api.remove()`; chip "inativo" em vez do sufixo textual; escopo por `role="listitem"` em vez de `xpath=ancestor::div[2]`)*
- `frontend/e2e/future-log-annual.spec.ts` *(atualizado: criação pelo card novo; título do dialog "Alocar"; correção do locator `Recorrência` com `{ exact: true }`)*
- `frontend/e2e/shell.spec.ts` *(reancorado em Configurações — Recorrentes migrou)*
- `frontend/e2e/future-log-board.spec.ts` *(idem)*
- `frontend/e2e/archive.spec.ts` *(asserts negativos de "Definir placement" trocados para "Alocar", senão ficariam vacuosos)*

**Rastreamento**

- `_bmad-output/implementation-artifacts/14-8-recorrentes-no-sistema-novo.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/tests/test-summary-14-8.md` *(novo — saída do passo de QA)*

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-07-26 | 0.1 | Story criada pelo workflow `create-story` (9 ACs / 11 tasks) | Amelia (create-story) |
| 2026-07-27 | 1.0 | Implementação completa (Fases A–D, Tasks 1–11); 2 defeitos reais encontrados e corrigidos na verificação (literal `44px` sem guard em `RecurringLibraryPage.tsx`; colisão de strict-mode em `future-log-annual.spec.ts`); todos os gates verdes; status → review | Amelia (dev-story) |
| 2026-07-27 | 1.1 | Passo de QA (`bmad-qa-generate-e2e-tests`): gates re-executados sem regressão; 2 gaps reais de cobertura E2E fechados em `recurring-library.spec.ts` (falha de escrita/DELETE com retry AC3/AC4; foco inicial e devolução de foco no alertdialog de exclusão AC6, com não-vacuidade provada por experimento) — 9→11 testes, 11/11 verdes | Amelia (QA) |
| 2026-07-27 | 1.2 | Code-review (story-automator, auto-fix): 0 críticos, 0 altos. 1 achado MÉDIO corrigido — o número combinado de Playwright dos 7 specs afetados (36/41) nunca havia sido re-executado depois de os 2 testes do passo de QA entrarem em `recurring-library.spec.ts`; todos os demais gates (tsc, lint, vitest 1748/131, pytest 1314, ruff, lint-imports, makemigrations --check, diff `schema.yaml`/`types.gen.ts`, `migrate --check` na branch Neon `e2e`) re-executados de forma independente e batem exatamente com os números da story. Re-executado o combinado final: **38 passed / 5 failed em 43** (36+2 novos verdes; os 5 vermelhos seguem nos mesmos locators/posições da AC9, sem regressão) — número corrigido em `test-summary-14-8.md` e nos Dev Notes. Status → `done`. | Amelia (code-review) |
