# Explicação dos arquivos não commitados — Story 14.7: Future Log no sistema novo (M08)

## Visão geral

A Story 14.7 é a **terceira superfície de tela do Épico 14** (Onda 3 — Núcleo BuJo no
Sistema Novo), depois do Weekly Board (14.5 / M06) e do Monthly Board (14.6 / M07).
Ela entrega o **Future Log** do sistema novo (`M08` do `EXPERIENCE.md`): um **trilho
fixo de 8 meses** à esquerda + uma **coluna de foco** com os itens do mês selecionado.

A diferença estrutural em relação às duas anteriores é que **o Futuro não é um ritual**:
não há `planning`/`active`/`finalized`, não há rail de fontes, não há decisões-snapshot
nem densidade. É **leitura + captura sobre `monthly_log` futuros**. Consequência direta
de produto: **concluir e cancelar não existem** nessa superfície.

Peças centrais:

- **Uma única lacuna aditiva de backend**: `GET /api/bujo/future-log/horizon/`, servida
  por um módulo de serviço novo (`bujo/services/future_log.py`) com **leitura 100% pura**
  — nenhum `get_or_create`, porque varrer 8 meses materializando criaria oito logs por
  consulta. O endpoint legado `GET /api/bujo/future-log/` fica **intocado**.
- **Âncora com piso no mês corrente** (`max(monthly ACTIVE, mês corrente)`), que dissolve
  por construção o bug CRÍTICO que o code-review da 14.6 encontrou em
  `destinationForTarget()`: todo mês da superfície é estritamente maior que o corrente,
  que é exatamente a pré-condição de `destination: 'future'` em `TaskMigrateView`.
- **Duas props aditivas nos componentes canônicos da 14.5** (`allowStatusCycle` no
  `TaskRowBase`, `allowCancel` no `TaskDetailCard`), ambas com default que reproduz o
  comportamento anterior byte a byte.
- **Correção do ramo de linhagem do `TaskRowBase`** (AC4/Task 4b): a seta de sucessor
  passa a valer também para `postponed` **com** `migratedToTask` — que é o status que o
  próprio Future Log gera.
- **Terceira e quarta correções da classe de bug de invalidação por prefixo** (AC9), a
  quarta encontrada pelo code-review desta story.
- **`MonthlyDestinationPicker` estendido no lugar, nunca forkado**: três props opcionais
  que adicionam a aba "Outro mês" e um rótulo de confirmação nomeado.

**Único arquivo de frontend gerado:** `frontend/src/api/types.gen.ts` — nunca editado à
mão. `schema.yaml` idem (`manage.py spectacular`). Ambos **estritamente aditivos**.

**Verificação (code-review desta story, gates re-executados do zero):** `pytest -q`
**1314 passed**; `npx vitest run` **1545 passed / 121 arquivos**; `tsc -b --noEmit`,
`npm run lint`, `uv run ruff check .`, `uv run lint-imports` e `makemigrations --check`
limpos; `schema.yaml` sem drift; `migrate --check` limpo na branch Neon `e2e`. E2E:
`future-log-board.spec.ts` **14/14**, `future-log-annual` verde, Weekly/Monthly Board e o
ciclo mensal 100% (prova cross-surface da AC9). **Nenhuma migration nesta story** — o
endpoint é puramente de leitura sobre tabelas existentes.

**Code review: 0 CRÍTICOS.** 1 alto + 3 médios corrigidos, 5 baixos (4 corrigidos,
1 registrado sem conserto por simetria com Weekly/Monthly). O achado recorrente das
14.3/14.6 — "número de gate afirmado sem execução" — **não se repetiu**: as contagens da
story bateram exatamente com a re-execução independente, e as discrepâncias File List ×
`git` foram 0.

---

## Ordem lógica de funcionamento

1. Artefatos de story/status registram o escopo e o resultado.
2. O **serviço** `future_log.py` calcula o horizonte (âncora + 8 meses + distantes).
3. **Serializers** projetam o dict do serviço; a **view** fina serializa; a **URL** expõe.
4. `schema.yaml` é regenerado do código; `types.gen.ts` é gerado do schema.
5. O frontend ganha primitivas compartilhadas (`addMonthsIso`, token `futureBoard`,
   `MONTH_ABBREV_PT`).
6. A camada de dados adiciona a chave `futureHorizon` e o hook `useFutureHorizonQuery`,
   e corrige as invalidações por prefixo.
7. Componentes canônicos ganham as props aditivas e a correção de linhagem.
8. Os componentes novos de `future/` compõem trilho, captura e seletor de mês.
9. `FutureBoardPage` orquestra tudo; router e shellRouting montam a rota.
10. Testes unitários, guards estruturais e E2E provam cada camada.

---

## 1. Artefatos de planejamento e status

### `_bmad-output/implementation-artifacts/14-7-future-log-no-sistema-novo.md` (NOVO)

**Função geral do arquivo** — Especificação da story: 9 ACs / 12 tasks, Dev Notes,
Dev Agent Record, File List, Questões abertas.

**Função geral da alteração** — Arquivo novo. É a **segunda geração** da story: a
primeira reprovou no gate de story-review (afirmava, falsamente, que a seta de linhagem
do `TaskRowBase` já funcionava para `postponed`). A versão vigente transforma esse erro
em escopo explícito — AC4 / Task 4b — com não-regressão provada pelos testes 14.5/14.6
intactos. Status atual: `done`.

### `_bmad-output/implementation-artifacts/14-7-future-log-no-sistema-novo.md.rejected-cycle1` (NOVO)

**Função geral do arquivo** — Backup automático da story reprovada, criado pelo gate A2
do story-automator antes de regenerar.

**Nota** — É artefato **transitório de orquestração**, não entregável. Nenhum arquivo
`.rejected-cycle*` jamais foi commitado neste repositório; **este é excluído do commit**
pelo mesmo critério.

### `_bmad-output/implementation-artifacts/tests/test-summary-14-7.md` (NOVO)

**Função geral do arquivo** — Relatório do passo de QA automatizado: o que foi
adicionado, os experimentos de não-vacuidade e os números de gate observados.

### `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFICADO)

**Função geral da alteração** — `14-7-future-log-no-sistema-novo` → `done`, com o resumo
do code-review na mesma linha, e `last_updated` no topo.

### `_bmad-output/story-automator/orchestration-14-20260725-024358.md` (MODIFICADO)

**Função geral da alteração** — Log da orquestração do Épico 14: a linha da 14.7 na
tabela de progresso e as entradas de action log (pausa por limite de gasto, retomada,
automate, code-review).

---

## 2. Backend — serviço, contrato e rotas

### `backend/bujo/services/future_log.py` (NOVO, 108 linhas)

**Função geral do arquivo** — Módulo de serviço que calcula o horizonte do Future Log.
Molde de `services/density.py`: **projeção de leitura**, não materialização.

**Função geral da alteração** — Arquivo novo. Existe porque `FutureLogView` (legado) é
estruturalmente incapaz de servir o M08: ele filtra `root_task_count__gt=0`, ou seja,
**só devolve meses que já têm item** — não conhece horizonte fixo, mês vazio, nem a
separação horizonte/distante. O trilho novo precisa dos oito meses **sempre**, inclusive
com `task_count: 0`.

**Blocos principais**

- Linhas 1-20 (docstring de módulo): documenta o contraste com o legado e a razão de a
  leitura ser pura — varrer 8 meses com `get_or_create` criaria oito logs por consulta.
  Contrasta deliberadamente com `MonthlyLogView.get`, que materializa o mês consultado
  (comportamento aceito desde a 14.1 para o *board*, inaceitável aqui).
- Linha 33: `HORIZON_MONTHS = 8` — fonte única do número no servidor
  (`DESIGN.md {components.future-board}: horizon-months: '8'`).
- Linhas 36-65: `_anchor_month_first(user)`.
- Linhas 68-108: `future_log_horizon(*, user)`.

**Funções, classes e importações específicas**

- `_anchor_month_first(user) -> date`: âncora = `max(monthly ACTIVE, mês corrente)`. O
  `max` é **piso, nunca teto**, e a docstring explica a assimetria: o gate `date_reached`
  de *Iniciar mês* já impede que um `active` fique à frente do corrente, mas **nada**
  impede que fique atrás durante a regularização de meses pulados. Sem o piso, o
  horizonte começaria em um mês `<=` corrente — e a superfície herdaria o bug CRÍTICO da
  14.6, porque `TaskMigrateView` responde 400 para `destination:'future'` quando
  `month_first <= current_month_first`.
- `future_log_horizon(*, user) -> dict`: devolve
  `{"anchor_month_first", "horizon", "distant"}`. `horizon` tem **exatamente**
  `HORIZON_MONTHS` entradas consecutivas ascendentes a partir de `âncora + 1`; `distant`
  lista todo `monthly_log` além do último mês do horizonte com `task_count > 0`.
- `add_months` (de `services/cycles.py`): aritmética de mês reutilizada, não reescrita.
- `today_for(user)` (de `core.calendar`): "hoje" com fuso do usuário — nunca
  `date.today()` (Convenção #8).

**Comportamento de libs usadas**

- `Count("tasks", filter=Q(tasks__parent_task__isnull=True))`: agregação do Django ORM
  que conta **tarefas raiz** (exclui subtarefas), mesma regra que `FutureLogView` já usa.
  É o que mantém a contagem do trilho igual ao número de linhas da coluna de foco depois
  de um "definir dia" — operação que deixa origem terminal **e** sucessor no mesmo mês.
- **Uma única query agregada** cobre horizonte e distantes (`month_first__gt=anchor`); a
  projeção nos 8 slots acontece em Python, porque um `values_list` puro faria os meses
  sem linha no banco **sumirem** da resposta.

### `backend/bujo/serializers.py` (MODIFICADO, +17)

**Função geral da alteração** — Dois `Serializer` puros (não `ModelSerializer`: a fonte é
um dict do serviço, não uma linha de tabela), no molde dos serializers de fila da 14.3.

**Funções, classes e importações específicas**

- `FutureLogMonthCountSerializer`: `month_first` (`DateField`) + `task_count`
  (`IntegerField`).
- `FutureLogHorizonSerializer`: `anchor_month_first` + `horizon` (many) + `distant` (many).

**Nota de aditividade** — `FutureLogMonthGroupSerializer` e o contrato de
`GET /api/bujo/future-log/` seguem **idênticos**.

### `backend/bujo/views.py` (MODIFICADO, +16)

**Função geral da alteração** — Nova `FutureLogHorizonView(APIView)`, fina como todas as
outras: chama o serviço e serializa. **Nenhuma regra vive na view.**

**Funções, classes e importações específicas**

- `@extend_schema(responses=FutureLogHorizonSerializer)`: decorator do
  **drf-spectacular** que informa ao gerador de OpenAPI qual é o response — sem ele, um
  `APIView` sem serializer de classe produz schema vazio.
- `FutureLogView` permanece no arquivo, intocada.

### `backend/bujo/urls.py` (MODIFICADO, +9)

**Função geral da alteração** — Registra `future-log/horizon/` com nome
`bujo-future-log-horizon`, imediatamente após `future-log/`, que mantém contrato idêntico.

### `backend/bujo/tests/test_services.py` (MODIFICADO, +173)

**Função geral da alteração** — Testes do serviço: cardinalidade fixa do horizonte
(8 entradas mesmo sem nenhum `monthly_log`), meses vazios presentes com `task_count: 0`,
âncora com piso no mês corrente (inclusive o cenário de meses pulados, em que o `active`
está atrás), separação horizonte/distante e a **prova de leitura pura** (contagem de
linhas em `monthly_log` inalterada após a chamada).

### `backend/bujo/tests/test_views.py` (MODIFICADO, +156)

**Função geral da alteração** — Testes do endpoint: forma da resposta, isolamento por
tenant, e o contrato do endpoint legado inalterado (não-regressão explícita).

---

## 3. Contrato gerado

### `schema.yaml` (MODIFICADO, +50, 0 deleções)

**Função geral do arquivo** — OpenAPI gerado por `manage.py spectacular`. **Nunca**
editado à mão.

**Função geral da alteração** — Adiciona o path `/api/bujo/future-log/horizon/` e os
schemas `FutureLogHorizon` e `FutureLogMonthCount`. **Zero deleções** é a prova mecânica
de aditividade estrita.

### `frontend/src/api/types.gen.ts` (MODIFICADO, +54, 0 deleções)

**Função geral do arquivo** — Tipos TypeScript gerados a partir de `schema.yaml`.

**Função geral da alteração** — `components['schemas']['FutureLogHorizon']` e
`FutureLogMonthCount`, mais a entrada de path. É o **produtor** consumido pelo
`types.ts` do feature.

---

## 4. Frontend — primitivas compartilhadas

### `frontend/src/shared/date/index.ts` (MODIFICADO, +15)

**Função geral da alteração** — `addMonthsIso(monthFirst, delta)`: `"AAAA-MM-01"` ± N
meses, sempre normalizado ao dia 1. Espelha `add_months` do backend
(`services/cycles.py`).

**Nota de escopo** — A função já existia **copiada em 4 arquivos de produção**
(`MonthlyPage`, `MonthlyBoardPage`, `MonthlyPlanningPage`, `GratitudeHistorySurface`).
Esta story **não refatora os 4 consumidores** (fora de escopo) — apenas **para de criar
o 5º**. Dívida registrada, não paga.

**Comportamento de libs usadas**

- `new Date(year, month - 1 + delta, 1)`: o construtor do `Date` **normaliza overflow de
  mês automaticamente** (mês 12 vira janeiro do ano seguinte, mês -1 vira dezembro do
  anterior), que é o motivo de não haver aritmética manual de ano.

### `frontend/src/shared/design/tokens.ts` (MODIFICADO, +27)

**Função geral da alteração** — Novo token `futureBoard`
(`[Source: DESIGN.md#components — future-board, L383-387]`).

**Blocos principais**

- `trailWidth: '230px'` — **única CSS var emitida daqui**
  (`--ds-future-board-trail-width`, registrada em `structuralCssVariables`): é a única
  medida de layout que o CSS precisa ler.
- `horizonMonths: 8` — **dados puros, sem var**: é cardinalidade consumida por lógica
  TypeScript, não estilo. É a **única fonte do número 8 no cliente**.
- `focusScroll: 'internal'` — descritivo, mesmo racional já documentado para `dayScroll`.
- `terminalOpacity: 0.58` — **reusa** `--ds-task-row-terminal-opacity` (emitida a partir
  de `weeklyBoard.terminalOpacity`): o valor é idêntico nas três superfícies por design, e
  quem recebe a de-ênfase é a Task Row, não a grade. Var própria seria duplicação.

### `frontend/src/features/bujo/monthNames.ts` (MODIFICADO, +19)

**Função geral da alteração** — `MONTH_ABBREV_PT`: abreviação de 3 letras minúsculas,
usada na **data parcial** do Future Log (`— ago`, FR-1.2). Nasce ao lado do nome por
extenso e **não** é importada do `FuturePage.tsx` legado (que tem a própria cópia,
desmontada da rota por esta story e removida no Épico 18).

---

## 5. Frontend — camada de dados

### `frontend/src/api/keys.ts` (MODIFICADO, +6)

**Função geral da alteração** — `keys.bujo.futureHorizon()` =
`['bujo','futureLog','horizon']`.

**Ponto crítico** — É **irmã** de `futureLog()` (`['bujo','futureLog','list']`) sob o
**mesmo prefixo, de propósito**: é isso que faz uma única invalidação por prefixo
alcançar as duas. Invalidar a chave **exata** `['bujo','futureLog','list']` **não**
alcança `horizon` — o match do TanStack Query é por prefixo, e `list` não é prefixo de
`horizon`. Esta é a raiz da AC9.

### `frontend/src/features/bujo/types.ts` (MODIFICADO, +5)

**Função geral da alteração** — Reexporta `FutureLogHorizon` e `FutureLogMonthCount` do
`types.gen.ts`, aditivos ao `FutureLogMonthGroup` que segue servindo o endpoint legado.

### `frontend/src/features/bujo/api.ts` (MODIFICADO, +61)

**Função geral da alteração** — O hook novo e **quatro correções de invalidação**.

**Blocos principais**

- `fetchFutureHorizon()` + `useFutureHorizonQuery()`: `GET /api/bujo/future-log/horizon/`
  sob a chave `keys.bujo.futureHorizon()`.
- `useDeleteTaskMutation` (linha ~272): **+ `['bujo','futureLog']`**. Este é o **achado
  ALTO do code-review** — 4ª ocorrência da classe de bug que a AC9 existe para matar, e
  só alcançável a partir desta story: o Future Log é a **primeira** superfície a fiar
  "Excluir tarefa" do `TaskDetailCard` sobre `monthly_log` futuros **e** a exibir
  contagens vindas de `futureHorizon()`. Sem isso, excluir pelo detalhe atualizava a
  coluna de foco e deixava o trilho dizendo "3 itens" com 2 linhas na lista — exatamente
  o que a AC4 proíbe.
- `useCreateMonthlyTaskMutation`: troca `keys.bujo.futureLog()` (chave exata) por
  `['bujo','futureLog']` (prefixo). 3ª ocorrência da classe.
- `usePlaceRecurringTemplateMutation`: mesma troca — sem ela, alocar um anual num mês do
  horizonte não atualizava a contagem daquele mês no trilho.
- `invalidateRitualQueries`: **+ `['bujo','futureLog']`** — toda decisão do ritual mensal
  que adia um item para o Futuro (`destination:'future'`) muda conteúdo **e** contagens
  do trilho. Alcança as 4 mutações que chamam essa função em `onSettled`.
- `useRecurringTemplatesQuery(params?, options?)`: ganha `options.enabled` (default
  `true`). O Future Log só sabe qual **ano** consultar depois que o horizonte responde (o
  ano vem do âncora do servidor, nunca de `new Date()`); sem o guard a query dispararia
  uma vez com `unplacedYear: undefined` — chave diferente, resposta inútil. Default
  `true` deixa todos os consumidores anteriores intocados.

**Comportamento de libs usadas**

- `queryClient.invalidateQueries({ queryKey })` (TanStack Query): faz **match por
  prefixo** do array de chave. É a semântica que a AC9 explora deliberadamente — e a
  mesma que torna a chave exata uma armadilha silenciosa.
- `useQuery({ enabled })`: quando `false`, a query não dispara e permanece em `pending`
  sem `fetchStatus` ativo.

### `frontend/src/features/bujo/index.ts` (MODIFICADO, +3)

**Função geral da alteração** — Barrel do feature: exporta `useFutureHorizonQuery` e os
dois tipos novos.

---

## 6. Componentes canônicos estendidos

### `frontend/src/features/bujo/components/TaskRowBase.tsx` (MODIFICADO, +62)

**Função geral do arquivo** — Linha de tarefa canônica do sistema novo (nasceu na 14.5),
com 5 colunas: status, conteúdo, chip, meta, slot de comandos.

**Função geral da alteração** — Duas mudanças independentes.

**(a) Prop `allowStatusCycle` (AC5)** — default `true`. Quando `false`, o ícone de status
deixa de ser botão de mutação e cai no ramo `role="img"` **que já existia**: zero mudança
de layout e `trailingSlot` preservado. É por isso que `variant='readonly'` **não serviria**
— ele suprime a coluna 5 inteira. A prop é propagada recursivamente às subtarefas.

**(b) Correção do ramo de linhagem (AC4 / Task 4b)** — nova função
`isLineageControl(status, migratedToTask)`, que substitui o teste `status === 'migrated'`
em três pontos (o `useEffect` de detecção de sucessor e os dois ramos de render):

- `migrated` → sempre renderiza o controle, **mesmo sem sucessor** (anuncia "O sucessor
  está em outro período"). Mudar isso seria regressão, então o comportamento é preservado.
- `postponed` → renderiza **apenas com** `migratedToTask`. A assimetria é deliberada:
  `postponed` **sem** linhagem é estado legal (a matriz `ALLOWED` de `state_machine.py`
  permite `pending`/`started` → `POSTPONED` direto, sem passar por `migrate_task`), e
  precisa continuar caindo no ramo `role="img"` mudo.
- `cancelled` fica fora por construção: `destination:'cancel'` não cria sucessor nem
  linhagem (registrado como Questão aberta #7).

O `aria-label` e o ícone passam a derivar do **status real** (`STATUS_LABEL[status]`,
`taskStatusIconFor(status)`) — para `migrated` produz exatamente as mesmas strings de
antes; para `postponed` produz "Adiada — …" com o ícone `ArrowLineRight`.

**Por que importa aqui** — `postponed` é precisamente o status que `migrate_task` produz
com `destination` `month`/`future`, ou seja, o que o **próprio Future Log gera**.

### `frontend/src/features/bujo/components/TaskDetailCard.tsx` (MODIFICADO, +12)

**Função geral da alteração** — Prop `allowCancel` (default `true`). Quando `false`, omite
**só** o botão "Cancelar tarefa", mantendo `Salvar` / `Mover tarefa` / `Excluir tarefa` e a
edição de título/categoria. `readonly` não serviria: zera o rodapé inteiro e proíbe editar.

### `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx` (MODIFICADO, +174)

**Função geral do arquivo** — Seletor de destino do ritual mensal (nasceu na 14.6): grade
de dias do mês-alvo, navegação por setas, digitação do número do dia, Enter confirma.

**Função geral da alteração** — **Estendido no lugar, nunca forkado.** Três props
**opcionais**, todas com default que reproduz a 14.6 byte a byte — o
`MonthlyDestinationPicker.test.tsx` anterior passa sem uma linha alterada.

**Funções, classes e importações específicas**

- `selectableMonths?: readonly string[]` — meses para os quais o destino pode ser
  retargetado (os 8 do horizonte + os distantes com item). Ausente/vazia = **sem aba**,
  exatamente a composição da 14.6.
- `onTargetMonthChange?` — o mês-alvo passa a ser **controlado pelo pai** quando
  `selectableMonths` é passado. É o que preserva a assinatura de `onConfirm(scheduledDate)`
  intacta: o pai já sabe para qual mês está confirmando porque é ele quem detém o estado.
- `confirmLabelFor?(selection)` — rótulo **nomeado** do ato ("Datar em 14 de agosto",
  "Mover para setembro de 2026", "Manter sem dia definido"), aplicado ao próprio botão de
  confirmação. Ausente = o par "texto + `Confirmar`" da 14.6.
- `MonthlyDestinationSelection` — interface exportada `{ monthFirst, scheduledDate }`.
- `useEffect(() => setArmed(null), [targetMonthFirst])` — **reset explícito** do dia
  armado quando o mês muda. Sem ele, `useState` sobreviveria à troca de prop e um "18"
  armado em agosto viraria 18 de fevereiro silenciosamente; pior, um "31" sobreviveria a
  um mês de 30 dias. (Mesma classe de bug já institucionalizada como guardrail no Épico 11.)
- `role="tablist"` / `DestinationTab` — as abas "Dia em {mês}" e "Outro mês".

**Nota de arquitetura** — A Story 14.9 provavelmente estende de novo (as abas previstas lá
— "Esta semana · Dia no mês · Outro mês" — são superconjunto destas). Promover o componente
a compartilhado com nome neutro é decisão natural da 14.9 (Questão aberta #3), não desta.

---

## 7. Componentes novos do Future Log

### `frontend/src/features/bujo/components/future/futureHorizon.ts` (NOVO, 129 linhas)

**Função geral do arquivo** — **Lógica pura**: sem React, sem Query, sem DOM. Ordenação,
formatação de data parcial/completa, agrupamento dos distantes por ano, contagens do
cabeçalho de foco e validação de captura.

**Funções, classes e importações específicas**

- `sortByDayThenUndated(tasks)`: ordenação "dia → sem-dia", espelho de
  `_by_day_then_undated` no backend — `scheduledDate` ascendente com nulos **por último**.
  O desempate por `order_index` **sai de graça** porque `Array.prototype.sort` é
  **estável** (garantido pela spec desde ES2019): `order_index` não é campo do contrato de
  API, mas o backend já entrega a lista ordenada por ele
  (`Task.Meta.ordering = ["order_index"]`), então preservar a ordem de entrada **é** o
  desempate. A ordenação não pode ser deixada ao default do backend: `Meta.ordering` não
  conhece dia nenhum.
- `dayPrefixOf(task, monthFirst)`: `(14)` com dia, `— ago` só com mês (FR-1.2).
- `dayPrefixLabelOf(...)`: rótulo **acessível**, que diferencia os dois casos por
  **palavra** ("Dia 14 de agosto" / "Sem dia definido em agosto") — `(14)` vs. `— ago` é
  distinção puramente visual, e um leitor de tela anunciaria "parêntese 14".
- `groupDistantByYear`, `focusCountsOf`, `formatFocusCounts`, `formatMonthTitle`,
  `isCaptureMonthInFuture`, `CAPTURE_MONTH_REJECTED`.

**Convenção #8** — "Hoje" nunca vem daqui: o âncora é do servidor.

### `frontend/src/features/bujo/components/future/FutureHorizonTrail.tsx` (NOVO, 206 linhas)

**Função geral do arquivo** — O trilho de 8 meses (AC1/AC7).

**Blocos principais**

- Os `futureBoard.horizonMonths` meses ficam **sempre visíveis**, inclusive os de contagem
  0 — o horizonte é scaffolding, não resultado de query. Linha omitida seria a única
  leitura errada possível.
- `component="nav"` com `aria-label`, `aria-current` no mês em foco, e a contagem em
  **texto** (`countLabel`: "1 item" / "N itens"), nunca só por chip colorido.
- **Divergência deliberada de token**: mês vazio usa `--ds-ink-muted`, e **não** o
  `{colors.ink-disabled}` que o `DESIGN.md` L629 descreve — a 14.6 provou por axe que
  `--ds-ink-disabled` sobre `--ds-surface-subtle` mede ~2,6:1 e reprova AA. O piso de
  acessibilidade vence o token de estilo.
- Modo `compact`: a mesma lista vira barra horizontal rolável (abreviação de 3 letras +
  contagem), **sem** scroll horizontal no conteúdo da superfície.

### `frontend/src/features/bujo/components/future/FutureCaptureForm.tsx` (NOVO, 161 linhas)

**Função geral do arquivo** — Captura no header (AC3).

**Blocos principais**

- Molde do `FutureLogItemForm` legado: mesmos rótulos (`Título`, `Mês`, `Dia (opcional)`),
  mesmo `<input type="month">` nativo — nenhum date picker novo, `@mui/x-date-pickers`
  segue fora.
- **Delta deliberado vs. o legado**: o campo **Mês** nasce preenchido com o mês em foco.
  Capturar no mês visível vira um campo só; capturar num mês distante vazio continua
  possível digitando a data — que é exatamente como um mês distante passa a existir no
  seletor "Ir para mês…".
- **Rejeita mês ≤ âncora antes do POST**: `MonthlyTaskCreateSerializer` aceita qualquer
  `month_first` (só valida `day == 1` e a data dentro do mês), então sem essa validação o
  item seria criado com **201** num mês passado/corrente e **sumiria da superfície sem
  erro nenhum**.
- `useEffect` reseta só o mês quando a prop de foco muda (o pai não remonta o formulário).
- Offline (AC7): capturar fica indisponível **com motivo**, sem fila local.
- **Ícones: nenhum.** `@mui/icons-material` permanece só no legado até o Épico 18 (AD-29).

### `frontend/src/features/bujo/components/future/FutureMonthPicker.tsx` (NOVO, 159 linhas)

**Função geral do arquivo** — Seletor "Ir para mês…" (AC1/AC7).

**Blocos principais**

- Lista **só** os meses além do horizonte que têm item, agrupados por ano e com contagem.
  Escolher um leva o foco àquele mês **sem que o trilho cresça** — o horizonte é fixo por
  definição.
- Sem nenhum mês distante com item, mostra o estado vazio do mockup (frame B), que orienta
  à captura **por data**.
- `compact` abre em `Drawer` (sheet), desktop em `Dialog`; as duas contêm foco e o
  devolvem ao acionador ao fechar (comportamento do `Modal` do MUI).
- **Achado de acessibilidade do passo de QA**: papel e nome do overlay vão no **slot
  `paper`**, nunca no componente. `aria-label` posto em `<Dialog>`/`<Drawer>` cai no root
  `role="presentation"` do `Modal`, deixando o overlay anônimo — e, no `Drawer`, **sem
  `role="dialog"` nenhum**, porque só o `Dialog` põe o papel no paper por conta própria.

---

## 8. Página e roteamento

### `frontend/src/pages/planner/FutureBoardPage.tsx` (NOVO, 507 linhas)

**Função geral do arquivo** — A superfície: orquestra queries, estado local e os
componentes acima.

**Blocos principais**

- **Não é ritual**: sem `planning`/`active`/`finalized`, sem rail de fontes, sem decisões,
  sem densidade. Abrir o Futuro ou consultar qualquer mês **não inicia ciclo nenhum** — o
  log que nasce da consulta tem `status IS NULL`, inerte para todos os predicados de
  `cycles.py` (AD-28 item 1).
- **Concluir e cancelar não existem**: `TaskRowBase` recebe `allowStatusCycle={false}` e o
  detalhe `allowCancel={false}` — as duas props aditivas desta story.
- Mês em foco é **estado local**, sem param de rota — coerente com o stepper da 14.6.
  Deep-link (`?month=AAAA-MM`) é decisão de produto pendente (Questão aberta #1), não
  improviso.
- `RETRY_BUTTON_SX` declara **cores explícitas** do design system: achado real do axe
  nesta story — o `primary` do tema MUI é o teal de marca, que sobre `--ds-surface` mede
  ~2,4:1 e reprova AA.
- `PendingMove` guarda **apenas a tarefa**: o ato (datar / mover / manter sem dia) **não é
  estado**, sai do par (mês-alvo, dia armado) no momento da confirmação, via
  `confirmLabelFor`. (Um campo `kind` existia e foi removido no code-review como estado
  morto.)
- `OFFLINE_REASON`: consulta disponível; capturar, datar e mover indisponíveis.
- `GET /logs/monthly/` **materializa** o mês consultado, e isso é aceito de propósito —
  comportamento vigente desde a 14.1, e o log criado nasce inerte. Quem **não** pode
  materializar é o endpoint do horizonte, que varre 8 meses: por isso a leitura pura é
  provada só dele.

### `frontend/src/app/router.tsx` (MODIFICADO, +8)

**Função geral da alteração** — `planner/future` passa a montar `FutureBoardPage`.
`FuturePage` legada **permanece no repositório, apenas desmontada da rota** — a remoção do
legado é o Épico 18, junto com `TaskRow.tsx`.

### `frontend/src/app/layout/shell/shellRouting.ts` (MODIFICADO, +4/-2)

**Função geral da alteração** — `planner/future`: `surfaceMigrated: false` → `true`.
Terceira superfície interna migrada; o `LegacySeamNotice` desaparece nessa rota.

---

## 9. Testes unitários e guards estruturais

| Arquivo | O que prova |
|---|---|
| `frontend/src/api/keys.test.ts` (+21) | `futureHorizon()` sob o mesmo prefixo de `futureLog()`, e que a chave exata **não** alcança a irmã |
| `frontend/src/features/bujo/api.test.tsx` (+152) | As 4 invalidações por prefixo e o `enabled` de `useRecurringTemplatesQuery` |
| `TaskRowBase.test.tsx` (+202) | `allowStatusCycle`; linhagem em `postponed` **com** sucessor; `postponed` **sem** linhagem seguindo mudo; não-regressão de `migrated` sem sucessor |
| `TaskDetailCard.test.tsx` (+29) | `allowCancel` omite só o botão, preservando Salvar/Mover/Excluir e a edição |
| `MonthlyDestinationPicker.test.tsx` (+143) | Aba "Outro mês", reset do dia armado ao trocar de mês, rótulo nomeado, e **2 testes jest-axe novos** medindo o componente **aberto** nas duas abas |
| `futureHorizon.test.ts` (NOVO) | A lógica pura isolada |
| `future/noLiteralTokens.test.ts` (NOVO, 44) | Via `?raw`: nenhum componente novo escreve `230px`, `268px`, `240px`, `235px`, `0.58`, `36px`, `48px`, `3px` |
| `planner/noLiteralTokens.test.ts` (+15) | `FutureBoardPage` entra no guard; `230px` entra na lista; **3 padrões de uso** barram o literal 8 (`{length: 8`, `horizon…= 8`, `.slice(0, 8)`) — um `\b8\b` global colidiria com prosa de comentário |
| `shellRouting.test.ts` (+12) | `planner/future` como superfície migrada |
| `tokens.test.ts` (+21) | O token `futureBoard` e a var `--ds-future-board-trail-width` |
| `shared/date/index.test.ts` (+19) | `addMonthsIso`, incluindo travessia de ano em ambas as direções |
| `FutureBoardPage.test.tsx` (NOVO) | A composição da página |
| `future/*.test.tsx` (NOVOS) | Trilho, captura e seletor isolados |
| `backend/bujo/tests/*` (+328) | Serviço e endpoint (ver seção 2) |

**Nota sobre o guard de AC8** — O achado MÉDIO (b) do code-review foi que
`futureBoard.horizonMonths` — que a AC8 declara "única fonte do 8 no cliente" — **não
tinha nenhum consumidor de produção** (o único leitor era `horizonMonthsFrom()`, função
exportada que ninguém chamava): a AC8 estava satisfeita **vacuosamente**. Corrigido junto
com o achado (b') do skeleton, que desenhava 6 barras para um trilho de 8 meses — o
skeleton passou a consumir o token e o teste agora **mede a geometria**.

---

## 10. E2E (Playwright, backend real na branch Neon `e2e`)

### `frontend/e2e/seedFutureLogScenario.ts` (NOVO, 152 linhas)

**Função geral do arquivo** — Semeia o cenário via `execFileSync` no Django, molde direto
de `seedMonthlyBoardScenario.ts` (14.6). **Nenhuma data é literal**: o horizonte sempre
começa em `âncora + 1`, e o âncora tem piso no mês corrente, então os alvos derivam dessa
invariante. Exporta também `seedFutureLogEmpty` e `monthTitleOf`.

### `frontend/e2e/future-log-board.spec.ts` (NOVO, 533 linhas, 14 testes)

**Função geral do arquivo** — Cobre AC1/AC3/AC4/AC5/AC7 contra o backend real. O gate de
acessibilidade roda **sem `exclude: 'main'` e sem `disableRules`**, nas **5 faixas**, desde
o primeiro commit.

### `frontend/e2e/future-log-annual.spec.ts` (MODIFICADO, +65/-…)

**Função geral da alteração** — Atualizado para a superfície nova (a rota passou a montar
outro componente).

### `frontend/e2e/shell.spec.ts` (MODIFICADO, +16/-8)

**Função geral da alteração** — **Correção de um vermelho pré-existente da 14.5.** O teste
G6 ("seam legado persiste ao navegar") navegava para `Esta Semana`, rota legada quando ele
nasceu (13.x) mas `surfaceMigrated: true` desde a 14.5 — o seam some lá de propósito, e o
teste estava vermelho desde então. A **tese é preservada literalmente**: só o destino mudou
para uma rota que ainda é legada de fato (`Recorrentes`, até a 14.8). O par oposto — o seam
**sumir** numa rota migrada — é provado em `future-log-board.spec.ts`.

### `frontend/e2e/recurring-soft-delete.spec.ts` (MODIFICADO, +20/-…)

**Função geral da alteração** — Duas coisas:

1. O locator da seção "Anuais pendentes" passa de `getByText(...).locator('xpath=..')` para
   `getByRole('region', { name })` — o container virou `role="region"` com nome próprio. A
   tese fica literalmente preservada.
2. **Registro (não conserto)** de uma falha cuja causa raiz é de outra story: o segundo
   teste falha em `getByText('Revisar finanças — Semanal')` porque a seção de placement de
   recorrentes vive em `WeeklyPage.tsx` (legada) e `planner/week` monta o `WeeklyBoardPage`
   desde a 14.5 — a superfície nova não porta a seção. Mesma classe (e mesmo tratamento:
   **manter executável, nunca deletar nem `.skip`**) dos 4 testes conhecidos de
   `move-task.spec.ts`.

### `frontend/e2e/move-task.spec.ts` (MODIFICADO, +30)

**Função geral da alteração** — Asserts adicionais cobrindo o destino "Futuro" a partir da
superfície nova.

---

## Observações finais

- **Nenhuma migration** nesta story: o endpoint novo é leitura pura sobre tabelas
  existentes.
- **Aditividade estrita provada mecanicamente**: `schema.yaml` e `types.gen.ts` com
  **0 deleções**; `FutureLogView` e `GET /api/bujo/future-log/` intocados; todas as props
  novas são opcionais com default retrocompatível.
- **Dívidas registradas, não pagas** (deliberado): `addMonthsIso` duplicado em 4 arquivos
  legados; promoção do `MonthlyDestinationPicker` a compartilhado (Questão aberta #3, para
  a 14.9); deep-link de mês (#1); `cancelled` sem linhagem (#7); a segunda affordance na
  área trailing do `TaskRowBase` (#8); e a falha de captura silenciosa que perde o título
  digitado — **não corrigida de propósito**, porque é idêntica no `WeeklyBoardPage` e no
  `MonthlyBoardPage` e consertar só aqui criaria assimetria.
- Este report **não alterou nenhum comportamento de código**; é documentação do estado da
  árvore de trabalho imediatamente antes do commit da story.
