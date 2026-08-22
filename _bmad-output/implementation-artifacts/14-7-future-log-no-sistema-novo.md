# Story 14.7: Future Log no sistema novo (M08)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero o Futuro como trilho de 8 meses + coluna de foco, com captura e datear/mover no lugar,
Para que nada lançado à frente se perca (UX-DR23; mockup `key-future-log.html`).

## Contexto de herança (leia antes de tudo)

Esta é a **terceira superfície** do Épico 14 no sistema novo, depois da 14.5 (Weekly Board, commit `ecffe40`) e da 14.6 (Monthly Board, commit `0fc9ce6`). A fundação está pronta e é para ser **REUSADA, nunca recriada**: `TaskRowBase`, `TaskDetailCard`, `taskStatusIcons.tsx`, `MonthlyDestinationPicker`, `WeeklyTaskPanel`, os tokens `taskRow`/`panel`/`chip`/`monthlyBoard`, `shared/date/index.ts` e `features/bujo/monthNames.ts`.

Três diferenças estruturais em relação às duas anteriores, que mudam o formato do trabalho:

1. **Não existe ritual.** O Future Log não é um ciclo operacional — é leitura + captura sobre `monthly_log` futuros. Não há `planning`/`active`/`finalized`, não há rail de fontes, não há decisões-snapshot, não há densidade. Abrir o Futuro ou consultar qualquer mês dele **não cria nem inicia** um Monthly em regime operacional (M08; AD-28 item 1: `status IS NULL` = fora do regime).
2. **Concluir e cancelar não existem nesta superfície.** É regra de produto explícita do M08. Isso **colide** com o default de `TaskRowBase`/`TaskDetailCard`, que hoje oferecem os dois — ver AC5.
3. **É a primeira superfície que exige a seta de linhagem sobre `postponed`.** Datear/mover aqui produz origem `postponed` (não `migrated`), e `TaskRowBase` **só renderiza a seta navegável para `migrated`** — hoje um item adiado vira ícone mudo (`role="img"`). Fechar essa lacuna é requisito da AC4 e é o ponto mais fácil de errar desta story. Ver a seção "A seta de linhagem sobre `postponed`" nos Dev Notes.

Esta story **não** toca `MonthlyPage.tsx`, `WeeklyPage.tsx`, `DailyPage.tsx`, `TaskRow.tsx` nem os banners/aliases legados (premissa blindada do Daily até o Épico 17).

## Acceptance Criteria

### AC1 — Superfície híbrida: trilho de 8 meses + coluna de foco em `/planner/future`

**Dado que** o spine M08 e o mockup `mockups/key-future-log.html` (frame A),
**Quando** a superfície nova é implementada em `/planner/future`,
**Então** o desktop mostra composição de duas colunas — **trilho** (`--ds-future-board-trail-width`) com o **horizonte rolante fixo de 8 meses**, todos sempre visíveis **inclusive os vazios** (contagem `0` renderizada, nunca linha omitida), cada linha com nome do mês por extenso + ano + contagem de itens; e **coluna de foco** com o mês selecionado em Task Rows **integrais** (`TaskRowBase` variant `full`, ver AC5),
**E** o mês em foco começa sempre no **primeiro mês do horizonte**; selecionar outra linha do trilho troca o foco sem recarregar a superfície inteira (o trilho não pisca),
**E** o cabeçalho da coluna de foco nomeia o mês ("Agosto de 2026") e traz a contagem derivada da própria lista carregada — "N itens · N com dia · N sem dia" — nunca uma contagem de outra origem que possa divergir da lista renderizada,
**E** o pé do trilho traz **Ir para mês…**, que abre um seletor listando **somente os meses além do horizonte que têm itens**, agrupados por ano e com a contagem de cada um; escolher um leva o foco àquele mês **sem que o trilho cresça**; sem nenhum mês distante com item, o seletor mostra o estado vazio orientando à captura por data (texto do mockup: "Nada capturado além de {último mês do horizonte}." + "Use o campo de captura com uma data para registrar mais adiante."),
**E** quando o foco está num mês **distante** (fora do horizonte), nenhuma linha do trilho fica selecionada/`aria-current` e o cabeçalho de foco continua nomeando o mês corretamente — voltar é selecionar qualquer linha do trilho,
**E** em **compact** o trilho vira uma **barra de meses rolável horizontalmente** com contagem, e **Ir para mês…** e o seletor de destino abrem em **sheet**; a coluna de foco ocupa a largura total; **sem scroll horizontal** no conteúdo,
**E** `shellRouting.ts` passa `planner/future` para `surfaceMigrated: true` (fazendo o `LegacySeamNotice` desaparecer só nessa rota) e o landmark permanece `<main aria-label="Futuro">` — vários specs E2E navegam por esse nome exato (ver AC9).

### AC2 — Backend aditivo: horizonte + meses distantes, leitura 100% pura

**Dado que** `FutureLogView` (`backend/bujo/views.py:518`) devolve só `monthly_log` com `root_task_count > 0` (`.filter(root_task_count__gt=0)`) e **não conhece** horizonte fixo, meses vazios nem separação horizonte/distante — sem esses dados a AC1 é inimplementável,
**Quando** esta story fecha a lacuna,
**Então** `GET /api/bujo/future-log/horizon/` (rota nova, view nova, **sem alterar `GET /api/bujo/future-log/`**) devolve **200** com:
```json
{ "anchorMonthFirst": "2026-07-01",
  "horizon": [ { "monthFirst": "2026-08-01", "taskCount": 3 },
               { "monthFirst": "2026-09-01", "taskCount": 0 } ],
  "distant": [ { "monthFirst": "2027-06-01", "taskCount": 2 },
               { "monthFirst": "2028-01-01", "taskCount": 4 } ] }
```
**E** `horizon` tem **exatamente 8 entradas**, consecutivas e ascendentes, começando em `anchorMonthFirst + 1 mês` — sempre presentes, inclusive as de `taskCount: 0` (o horizonte é scaffolding, não resultado de query),
**E** o **âncora** é `max(monthly_log ACTIVE .month_first, today_for(user).replace(day=1))`, caindo em `today_for(user).replace(day=1)` quando não existe nenhum `active`; o `max(...)` é um **piso, nunca um teto** (o gate `date_reached` de **Iniciar mês** — `today >= planning.month_first`, `cycles.py` — impede que um `active` fique à FRENTE do mês corrente, mas nada impede que fique ATRÁS durante regularização de meses pulados; prova existente: `test_ciclo_monthly_dois_meses_pulados_exigem_materializacao_sequencial`). O piso garante a invariante de que **todo mês desta superfície é estritamente maior que o mês corrente**, que é exatamente a condição que `TaskMigrateView` exige para `destination: 'future'` (`views.py:748-755`) — sem ele, esta story herdaria o mesmo bug CRÍTICO que o code-review da 14.6 encontrou em `destinationForTarget()`. As duas leituras do spine convergem no piso: "os oito meses seguintes ao Monthly operacional" e "o horizonte não inclui o mês corrente" (EXPERIENCE L323) só são simultaneamente verdadeiras com `max(...)`,
**E** `distant` lista **todo** `monthly_log` com `month_first > último mês do horizonte` **e** `taskCount > 0`, em ordem ascendente (o cliente agrupa por ano — ver AC1); nada pode escapar entre o mês corrente e o início do horizonte, porque o âncora nunca é menor que o mês corrente,
**E** `taskCount` conta **tarefas raiz** (`parent_task__isnull=True`), de **qualquer status** — mesma regra que `FutureLogView` já usa hoje (`Count("tasks", filter=Q(tasks__parent_task__isnull=True))`), para que a contagem do trilho não divirja do número de linhas da coluna de foco depois de um datear (que deixa origem terminal **e** sucessor no mesmo mês, ver AC4),
**E** a leitura é **pura**: zero `get_or_create`, zero escrita, zero materialização — provado por teste com `CaptureQueriesContext` (nenhum `INSERT`) **e** por `MonthlyLog.objects.count()` inalterado ao consultar um horizonte inteiro de meses inexistentes, no mesmo molde `_sem_escrita` que a 14.3/14.4 já usam,
**E** o serviço vive em `backend/bujo/services/future_log.py` (módulo novo, no molde de `services/density.py` — projeção de leitura, não materialização), com `future_log_horizon(*, user) -> dict`, reusando `add_months` de `services/cycles.py`; **nenhuma regra nova de ciclo, nenhum predicado novo**,
**E** `schema.yaml`/`frontend/src/api/types.gen.ts` são regenerados e commitados juntos, com **zero deleção** de componente pré-existente; `makemigrations --check --dry-run` não acusa nada (esta story **não** altera schema).

### AC3 — Captura no header, data completa vs. parcial e ordenação dia → sem-dia

**Dado que** a captura no molde do `FutureLogItemForm` e a regra FR-1.2 de data parcial,
**Quando** a captura do sistema novo é implementada no header da superfície,
**Então** ela aceita **título + mês (obrigatório) + dia (opcional)** e escreve por `POST /api/bujo/logs/monthly/` (`useCreateMonthlyTaskMutation`, já existente — **nenhum endpoint de escrita novo nesta story**), com os mesmos rótulos já estabelecidos (`Título`, `Mês`, `Dia (opcional)`, botão `Adicionar`),
**E** o campo **Mês** nasce preenchido com o **mês em foco** (delta deliberado vs. o `FutureLogItemForm` legado, que nasce vazio): captura no mês visível vira um campo só, e capturar num mês distante vazio continua possível digitando a data — que é exatamente como o M08 manda um mês distante passar a existir no seletor "Ir para mês…",
**E** a captura **rejeita, no cliente e antes do POST, mês ≤ `anchorMonthFirst`** com mensagem inline explicando o motivo — `MonthlyTaskCreateSerializer` aceita qualquer `month_first` (só valida `day == 1` e `scheduled_date` dentro do mês), então sem essa validação o item seria criado num mês do passado/corrente e **desapareceria da superfície sem erro nenhum**; a mensagem nomeia a saída ("Este mês não pertence ao Futuro. Use o Mês ou a Semana para datas de agora."),
**E** item **com dia** exibe o prefixo `(14)` e item **só com mês** exibe `— ago` (abreviação de 3 letras em minúsculas, `--ds-*` + números tabulares), com o rótulo acessível diferenciando os dois casos sem depender da forma,
**E** dentro do mês em foco os itens **datados vêm ordenados por dia e os sem dia depois deles** — ordenação no cliente, espelhando `_by_day_then_undated` (`services/rituals.py:254`, cujo docstring já cita "(M08)"): `scheduled_date` asc com nulos por último, desempate por `order_index`; a ordenação **não** pode ser deixada ao default do backend, que é `Meta.ordering = ["order_index"]` (`models.py`) e não conhece dia,
**E** existe teste unitário cobrindo mês com só datados, só sem-dia, misto, e empate de `order_index` na mesma data.

### AC4 — Datear e mover no lugar, com linhagem **funcionando** sobre `postponed`

**Dado que** o M08 permite atribuir dia ou mover um item **na própria tela**, fora dos rituais, e que essa é a única mutação de posição desta superfície,
**Quando** Hugo aciona **Definir dia** (item sem dia) ou **Mover** (qualquer item),
**Então** abre o **seletor de destino do ritual** — `MonthlyDestinationPicker` (14.6), estendido por props opcionais aditivas, **nunca forkado/copiado** (ver AC5) — com os dias reais do mês em foco (28–31, incl. bissexto), **Manter sem dia definido** como opção explícita e a aba **Outro mês**,
**E** a aba **Outro mês** lista os 8 meses do horizonte + os meses distantes com item (mesmos dados do trilho e do "Ir para mês…"); escolher um mês **retarga a grade de dias** para ele, permitindo confirmar com ou sem dia,
**E** a confirmação é **nomeada** conforme o ato: "Datar em 14 de agosto", "Mover para setembro de 2026", "Manter sem dia definido" — nunca um "Confirmar" genérico,
**E** a escrita usa `POST /api/bujo/tasks/{id}/migrate/` com `destination: 'future'` + `monthFirst` do destino + `scheduledDate` opcional (`useMigrateTaskMutation`, já existente) — a invariante da AC2 (todo mês desta superfície > mês corrente) garante que o serializer **nunca** responde o 400 `"Use 'month' para o mês corrente"`; um teste prova a invariante em vez de confiar nela,
**E** **o status terminal produzido é `postponed`, não `migrated`** — o backend, **intocado**, devolve `Task.Status.POSTPONED` para `destination in ('month','future')` (`services/migration.py`, docstring explícito; só `today`/`week` produzem `MIGRATED`). "Terminal `migrated`" no texto do M08/DESIGN significa **terminal com linhagem**, não o literal `status == 'migrated'`: a implementação usa o que o backend devolve (rótulo "Adiada", ícone `ArrowLineRight` de `taskStatusIcons.tsx`) e **não** inventa transição, não renomeia status, não escreve `migrated` à mão,
**E** — **lacuna real, verificada no código, que esta story É obrigada a fechar** — hoje `TaskRowBase` **não** oferece seta navegável para `postponed`: tanto o efeito de disponibilidade do sucessor (`TaskRowBase.tsx:123-129`, `if (status !== 'migrated' || !task.migratedToTask) return`) quanto o ramo de renderização (`TaskRowBase.tsx:216`, `status === 'migrated' ? <button…>`) estão presos ao literal `'migrated'`, e o `aria-label`/ícone estão hard-coded em `STATUS_LABEL.migrated`/`taskStatusIconFor('migrated')`. Um item adiado renderiza o ramo `role="img"` **mudo** — sem seta, sem navegação, sem destaque. Sem corrigir isso, a exigência "origem readonly **com seta navegável ao sucessor**" (EXPERIENCE M08; DESIGN.md L631; mockup frames C e E) fica **não entregue** por esta superfície,
**E** a correção é **generalizar o controle de linhagem para status terminal-com-linhagem**, preservando `migrated` byte-a-byte: o ramo botão passa a valer para `status === 'migrated'` (comportamento atual, inclusive sem `migratedToTask`, quando anuncia "O sucessor está em outro período") **ou** para `status === 'postponed'` **com `migratedToTask` preenchido**; `aria-label` e ícone passam a derivar do status real (`STATUS_LABEL[status]` / `taskStatusIconFor(status)`), o que para `migrated` produz exatamente as mesmas strings de hoje. A assimetria é deliberada e documentada no código: `postponed` **sem** linhagem é estado legal (a matriz `ALLOWED` do `state_machine.py` permite `pending`/`started` → `POSTPONED` direto) e **continua** sendo `role="img"` — é isso que mantém `TaskRowBase.test.tsx:104-114` verde sem uma linha alterada (AC5),
**E** origem e sucessor convivem no mesmo mês depois de um "Definir dia" (é o que o frame C do mockup mostra): a origem readonly com a seta **acionável** (o sucessor está no MESMO DOM) e o sucessor entrando com o destaque temporário de 2000ms — nenhuma linha some da lista,
**E** falha de escrita **preserva o seletor aberto com o destino armado**, mostra o motivo (`role="alert"`, anunciado uma única vez) e oferece nova tentativa; sucesso **não** mostra toast — atualiza lista, contagens do trilho e cabeçalho de foco.

### AC5 — Reuso obrigatório dos canônicos + as extensões aditivas que esta superfície exige

**Dado que** `TaskRowBase`/`TaskDetailCard` nasceram na 14.5 explicitamente "desenhados para reuso por este épico em diante" e que o próprio cabeçalho de `TaskRowBase.tsx` prevê que superfícies futuras variem **"o conjunto de ações permitidas por superfície"** sem alterar a anatomia,
**Quando** o Future Log consome os dois,
**Então** a coluna de foco usa `TaskRowBase` variant **`full`** e o detalhe é o `TaskDetailCard` — **sem fork, sem cópia, sem componente paralelo de linha**,
**E** as extensões são **exatamente três**, todas aditivas, cada uma com default que reproduz o comportamento atual:
 - **`TaskRowBase` (a) — desligar o ciclo de status.** Como **concluir e cancelar não existem nesta superfície** (regra de produto do M08), uma **única prop booleana opcional**: quando desligada, o ícone de status renderiza pelo ramo `role="img"` que **já existe** (`TaskRowBase.tsx:263-277`) em vez do ramo botão — implementação = uma condição a mais em `isStatusCycleControl`, zero mudança de layout, `trailingSlot` **preservado** (é por isso que `variant='readonly'` **não serve**: ele suprime a coluna 5 em `TaskRowBase.tsx:392`, e é justamente nela que vivem "definir dia"/"Mover" desta superfície). Esta prop **não** interfere no controle de linhagem: um item terminal-com-linhagem continua mostrando a seta mesmo com o ciclo desligado (é navegação, não mutação — mesmo racional que já faz `migrated` sobreviver a `cycleStatus='finalized'`).
 - **`TaskRowBase` (b) — seta de linhagem sobre `postponed`.** Correção estrutural descrita na AC4; **não** é prop nova, é a condição do ramo de linhagem deixando de ser um literal. Vale para **todas** as superfícies que já consomem `TaskRowBase` (Weekly Board, Monthly Board): um `postponed` com sucessor fora da view carregada renderiza o botão `aria-disabled` com "O sucessor está em outro período" — degradação já provada para `migrated`, sem crash e sem quebra visual. Nenhum consumidor precisa mudar.
 - **`TaskDetailCard` — omitir `Cancelar tarefa`.** Uma **única prop booleana opcional**: quando desligada, o rodapé omite **só** `Cancelar tarefa` e mantém `Salvar`/`Mover tarefa`/`Excluir tarefa` — `readonly` também **não serve** aqui, porque zera o rodapé inteiro (`TaskDetailCard.tsx:398`) e proíbe editar título/categoria, que o Future Log permite. `onMove` **é** fiado nesta superfície (primeiro consumidor real do botão "Mover tarefa" no sistema novo — ver Questões abertas).
**E** a **não-regressão é provada mecanicamente**: `TaskRowBase.test.tsx`, `TaskDetailCard.test.tsx` (14.5) e `MonthlyDestinationPicker.test.tsx` (14.6) passam **sem uma única alteração** — em particular `TaskRowBase.test.tsx:104-114` (`postponed` sem linhagem → `role="img"`), `:153-156` (`migrated` em `finalized` → botão), `:248-330` (navegação/`aria-disabled` de `migrated`); e cada extensão ganha teste próprio: prop ligada e desligada; `postponed` **com** `migratedToTask` e sucessor no DOM → botão navega, foca e destaca; `postponed` **com** `migratedToTask` e sucessor ausente → `aria-disabled` com motivo; `postponed` **sem** `migratedToTask` → segue `role="img"` (caso irmão de não-vacuidade),
**E** `MonthlyDestinationPicker` é estendido **no lugar** com props opcionais (lista de meses selecionáveis para a aba "Outro mês" + rótulo de confirmação nomeado); se o dev preferir extrair uma base compartilhada, é aceitável, mas **fork/cópia não é**,
**E** `taskStatusIcons.tsx`/`STATUS_LABEL`/`TASK_STATUS_ICON_SIZE` são importados como estão — **nenhum ícone novo, nenhuma cor nova de status**,
**E** qualquer necessidade adicional de anatomia descoberta durante a implementação vira **Questão aberta**, nunca duplicação.

### AC6 — Anuais pendentes: mesmo comportamento, termo canônico **Alocar**

**Dado que** a seção "Anuais pendentes de {ano}" já existe e funciona (`FuturePage.tsx:109-137`, Story 11.4) e que o termo padrão do ato é **Alocar** (mockup `key-future-log.html` frame A; decision-log 2026-07-21: "`key-future-log.html`: 'Definir placement' → **'Alocar'**"; Story 14.8 registra a mesma padronização),
**Quando** a seção é reimplementada na superfície nova,
**Então** ela lista os templates `annual` **ativos e sem instância no ano** (`useRecurringTemplatesQuery({ active: true, recurrenceGroup: 'annual', unplacedYear })`, já existente — **não** reimplementar elegibilidade no cliente, **nunca** parsear `recurrence_text`),
**E** o botão do item diz **"Alocar"** (não "Definir placement") e abre o `RecurringPlacementDialog` **intocado** — o título do dialog continua "Definir placement" até a Story 14.8, que é a dona da padronização na biblioteca; renomeá-lo aqui espalharia a mudança por `RecurringPlacementSection` e por specs de outra story (blast radius desnecessário, decisão registrada nas Questões abertas),
**E** o molde **"banner vazio = sem DOM"** é preservado: sem nenhum anual pendente, a seção **não renderiza** — sem placeholder, sem heading órfão,
**E** a seção é exposta como `role="region"` com `aria-label="Anuais pendentes de {ano}"`, para que os dois specs E2E que hoje a localizam por `getByText(...).locator('xpath=..')` (frágil ao DOM) passem a escopar por papel + nome (ver AC9),
**E** alocar um anual numa data futura faz o item aparecer no mês correspondente **e** atualiza a contagem do trilho — o que só acontece se a invalidação de cache da AC9 estiver correta.

### AC7 — Estados obrigatórios e piso de acessibilidade nas 5 faixas

**Dado que** `EXPERIENCE.md#State Patterns` (incl. as duas linhas próprias do M08: "Future vazio" e "Future além do horizonte") e `#Accessibility Floor`,
**Quando** a superfície é auditada,
**Então** existem e são testados: `initial loading` (skeleton **preservando a geometria trilho + foco**, não uma barra genérica — o `PlannerSkeleton` compartilhado é uma pilha de barras e **não** serve; compor local sem deformar o compartilhado), `local loading` (troca de mês afeta só a coluna de foco — o trilho não some), `empty inicial` do mês em foco, `empty global` (horizonte inteiro sem itens: convida a capturar, **os 8 meses seguem visíveis no trilho**), `read error` local com retry **sem trocar o mês em foco**, `write error` (`role="alert"` uma única vez, seletor preservado — AC4), `offline` (consulta pelo cache; **capturar, datar e mover indisponíveis com motivo, sem fila local**) e o vazio do seletor "Ir para mês…",
**E** a **cópia dos estados vem do mockup, não é inventada**: vazio global = "Nada no futuro ainda" + "Capture algo que ainda não tem data certa e ele espera aqui até você decidir o dia."; erro de leitura = "Não foi possível carregar os itens do futuro." + "Tentar de novo"; offline = "Você está offline. Consulta disponível; capturar, datar e mover ficam indisponíveis até reconectar."; seletor vazio = "Nada capturado além de {último mês do horizonte}." + "Use o campo de captura com uma data para registrar mais adiante." (`key-future-log.html`, frames B e E),
**E** `@axe-core/playwright` (`wcag2a/2aa/21a/21aa/22aa`, **sem `disableRules`**, **sem `exclude: 'main'`**) passa em `/planner/future` nas **5 faixas desde o primeiro commit** — wide, medium, tablet, compact e **reflow 320** (a 14.5 precisou de correção ALTA por cobrir só 2 faixas e a 14.6 já nasceu com as 5; **não repetir a lacuna**),
**E** o trilho é `nav` (ou `list`) com nome acessível ("Meses do horizonte"), cada linha anuncia mês + ano + contagem em texto (contagem **nunca** só por chip colorido), e o mês em foco recebe `aria-current`,
**E** a coluna de foco tem heading próprio nomeando o mês; a lista rola internamente (`--ds-future-board-focus-scroll: internal`) sem alterar a geometria, é alcançável por teclado e preserva foco visível,
**E** a seta de linhagem da AC4 é **alcançável por teclado e anunciada**: com sucessor no DOM, nome acessível "Adiada — ir para o sucessor" e ativação por `Enter`/`Space`; sem sucessor, `aria-disabled` com "Adiada — O sucessor está em outro período"; o destaque do sucessor é anunciado por `role="status"` (mecânica já existente do `TaskRowBase`, só verificar que sobrevive nesta superfície),
**E** sheets (compact) contêm foco e **devolvem o foco ao acionador** ao fechar sem navegar; alvos ≥44×44px (atenção ao mesmo achado `target-size` que a 14.6 encontrou em controles dentro de containers estreitos — a barra de meses compact é o candidato natural),
**E** os pares cromáticos usados no trilho (selecionado, vazio/de-ênfase) são checados em Mineral light **e** dark; **mês vazio usa `--ds-ink-muted`, não `--ds-ink-disabled`** — a 14.6 provou por axe que `--ds-ink-disabled` sobre `--ds-surface-subtle` mede ~2,6:1 e reprova AA, e o `DESIGN.md` (L629) descreve o mês vazio com `{colors.ink-disabled}`: **o piso de acessibilidade vence o token de estilo**, divergência registrada no código.

### AC8 — Tokens `futureBoard`, zero literal estrutural

**Dado que** `DESIGN.md` já especifica `{components.future-board}` (`trail-width: '230px'`, `horizon-months: '8'`, `focus-scroll: 'internal'`, `terminal-opacity: '0.58'` — L383-387) e que `tokens.ts` ainda **não** o implementa,
**Quando** a story entrega,
**Então** `frontend/src/shared/design/tokens.ts` exporta `futureBoard` com esses valores literais, no mesmo molde de dados puros de `weeklyBoard`/`monthlyBoard` (`tokens.ts:195-244`), e `shellCssVariables()` emite **`--ds-future-board-trail-width`**,
**E** `horizonMonths`/`focusScroll` permanecem **dados puros sem CSS var** (não são estilo — mesmo racional já documentado para `dayScroll` em `monthlyBoard`) e `terminalOpacity` **reusa** `--ds-task-row-terminal-opacity` (emitida a partir de `weeklyBoard.terminalOpacity`, `tokens.ts:468`), compartilhada entre Weekly/Monthly/Future por design — **não recriar**,
**E** `horizonMonths` é a **única fonte** do número 8 no cliente: o componente que valida/renderiza o horizonte lê o token, nunca escreve `8`,
**E** `tokens.test.ts` ganha os casos equivalentes (valores batem com `DESIGN.md`; cada token emitido aparece em `shellCssVariables()`),
**E** nenhum componente/página novo escreve `230px`, `0.58`, `8` (horizonte) ou cor hexadecimal literal — guardrail por `?raw` em `features/bujo/components/future/noLiteralTokens.test.ts` (novo, molde de `weekly/`+`monthly/`) e entrada nova em `pages/planner/noLiteralTokens.test.ts` para `FutureBoardPage.tsx`; o guard de `8` usa regex **específica** (ex.: `/\b8\b/` só sobre linhas de `sx`/`style`, ou o padrão de uso concreto) e **não** um `\b8\b` global — a 14.6 registrou que um literal numérico genérico colide com prosa legítima nos comentários (foi o achado ALTO do literal `7`).

### AC9 — Regressão: invalidação de cache correta, legado intocado, specs acopladas atualizadas sem virar vacuosas

**Dado que** duas mutações hoje invalidam o Future Log pela **chave exata** `keys.bujo.futureLog()` = `['bujo','futureLog','list']` (`api.ts:331` em `useCreateMonthlyTaskMutation`; `api.ts:539` em `usePlaceRecurringTemplateMutation`) e que `invalidateRitualQueries` (`api.ts:604-613`) **não invalida o Future Log de forma nenhuma**,
**Quando** esta story entrega,
**Então** a chave nova é `keys.bujo.futureHorizon() = ['bujo','futureLog','horizon']` e **todas** as invalidações de Future Log passam a usar o **prefixo** `['bujo','futureLog']` — invalidar `['bujo','futureLog','list']` **não** alcança `['bujo','futureLog','horizon']` (o match do TanStack Query é por prefixo, e `list` não é prefixo de `horizon`): é a **terceira ocorrência** da mesma classe de bug que a 14.5 e a 14.6 já corrigiram, e sem a correção capturar/alocar num mês distante não atualiza o trilho. `useMigrateTaskMutation` (`api.ts:417`) **já** usa o prefixo — conferir, não mexer,
**E** `invalidateRitualQueries` passa a invalidar `['bujo','futureLog']` — sem isso, **toda decisão do ritual mensal que adia um item ao Future Log** (`useRitualDecisionMutation` e as outras 3 mutações que a chamam em `onSettled`) deixa esta superfície com trilho e contagens desatualizados,
**E** cada uma dessas correções tem teste que **falha antes da correção** (não-vacuidade provada por mutação cirúrgica, mesmo protocolo das 3 stories anteriores),
**E** `FuturePage.tsx`/`FuturePage.test.tsx` **permanecem no repositório, apenas desmontados da rota** (a remoção do legado é o Épico 18, junto com `TaskRow.tsx` e as demais páginas legadas); `FutureLogItemForm.tsx`, `RecurringPlacementDialog.tsx`, `RecurringPlacementSection.tsx`, `MonthlyPage.tsx`, `WeeklyPage.tsx`, `DailyPage.tsx`, `TaskRow.tsx`, `theme.ts`, os banners legados e os aliases `/migration/queue/`+`/catch-up/queue/` **não são alterados**; `GET /api/bujo/future-log/` mantém contrato **idêntico**,
**E** o efeito cross-surface da AC4 (seta de linhagem sobre `postponed`) é **conferido, não presumido**: `move-task.spec.ts` assere `originRow.getByLabel('Adiada')` em 3 pontos (linhas ~98, ~204, ~428) e continua válido porque `getByLabel` casa **substring** por default (o novo nome é "Adiada — …"); `monthly-board.spec.ts:240` e `weekly-board.spec.ts:282` asseram `getByRole('img', { name: 'Cancelada' })`, status **sem** ramo de linhagem — intocados; nenhum teste assere `getByRole('img', { name: 'Adiada' })` (verificado por grep em `frontend/src` e `frontend/e2e`). Se algum desses asserts virar vermelho, a saída é ajustar o **teste**, nunca esconder a seta,
**E** `frontend/e2e/future-log-annual.spec.ts` é atualizado no mesmo commit — hoje ele depende de (a) `getByRole('button', { name: 'Definir placement' })`, que vira **"Alocar"** (AC6); (b) `getByText('Anuais pendentes de {ano}').locator('xpath=..')` como container e `locator('xpath=ancestor::div[1]')` por linha, que passam a `getByRole('region', { name: ... })` + escopo estável; (c) `page.getByText(futureGroupHeading)` + `getByTestId('task-row')` para provar que a instância alocada apareceu — o spec coloca o anual **2 meses à frente**, que **não** é o mês de foco default (o default é o 1º do horizonte = mês corrente + 1), então o spec precisa **selecionar o mês no trilho** antes de assertar a Task Row (o heading do mês sozinho vira falso positivo: os 8 meses aparecem no trilho o tempo todo); o assert final "sem anual pendente, a seção some" e a checagem em "Este Mês" **não mudam**,
**E** `frontend/e2e/recurring-soft-delete.spec.ts` (linhas ~236-247) recebe a **mesma** atualização de container (`getByRole('region', …)`) — a tese do teste (excluído sai da elegibilidade sem levar a seção embora) é preservada literalmente,
**E** `frontend/e2e/move-task.spec.ts` (teste "move de Este Mês para Futuro", assert final em `page.getByRole('button', {name:'Futuro'})` + `task-row`) é conferido: o destino é o **mês seguinte**, que é o **primeiro do horizonte** e portanto o foco default — o assert continua válido, mas ganha a seleção explícita do mês para não depender do default; esse teste **já falha antes** no passo "Mover tarefa" por causa-raiz pré-existente da 14.5 documentada no próprio arquivo — **não** é escopo desta story consertá-lo, e **não** pode ser deletado (a 14.6 levou achado ALTO no code-review por deletar exatamente este teste),
**E** `frontend/e2e/weekly-monthly-cycle.spec.ts` (`navigate(page,'Futuro')` nas linhas 81 e 106) e `frontend/e2e/shell-*.spec.ts` só dependem do **nome do destino e do landmark** — continuam passando desde que `<main aria-label="Futuro">` seja preservado (AC1); confirmar, não reescrever,
**E** a disciplina de não-vacuidade vale para todo assert de ausência: toda asserção "não aparece" tem irmã "aparece quando deveria",
**E** os gates fecham com números **re-executados após o último commit de código**: `npx tsc -b --noEmit`, `npm run lint`, `npx vitest run`, `uv run pytest` full-suite, `uv run ruff check .`, `uv run lint-imports`, `uv run python manage.py makemigrations --check --dry-run` (sem mudanças), `schema.yaml`/`types.gen.ts` regenerados sem deleção de componente, e Playwright escopado aos specs afetados **depois** de `migrate --check` limpo na branch Neon `e2e`.

## Tasks / Subtasks

> **Sequenciamento: Fase A (backend + fundação de dados/props) → Fase B (superfície) → Fase C (datear/mover + anuais) → Fase D (a11y, regressão, E2E)**. Cada fase é um checkpoint de commit natural.

### Fase A — Backend aditivo + fundação de dados

- [x] **Task 1 — `future_log_horizon` (AC2)**
  - [x] Criar `backend/bujo/services/future_log.py` com `future_log_horizon(*, user) -> dict`: âncora = `max(MonthlyLog.objects.filter(status=CycleStatus.ACTIVE).first().month_first, today_for(user).replace(day=1))` (ou só `today_for(...)` sem `active`); horizonte = `add_months(anchor, 1..8)`; contagens por `Count("tasks", filter=Q(tasks__parent_task__isnull=True))` numa **única** query agregada sobre `MonthlyLog`, projetada em Python sobre os 8 slots; `distant` = meses `> anchor+8` com contagem `> 0`, ascendente. Docstring explicando que o `max(...)` é **piso, nunca teto** (regularização atrasada + contrato de `TaskMigrateView`).
  - [x] Em `backend/bujo/serializers.py`: `FutureLogMonthCountSerializer` (`month_first`, `task_count`) e `FutureLogHorizonSerializer` (`anchor_month_first`, `horizon` many, `distant` many). `Serializer` puros (projeção de dict), molde dos serializers de fila da 14.3.
  - [x] Em `backend/bujo/views.py`: `FutureLogHorizonView(APIView)` com `@extend_schema(responses=FutureLogHorizonSerializer)`; em `backend/bujo/urls.py`: `path("future-log/horizon/", ...)` **imediatamente** abaixo de `future-log/` (nome `bujo-future-log-horizon`).
  - [x] Testes em `test_services.py`/`test_views.py` (nomes em pt-BR): 8 slots sempre presentes com zeros; âncora sem `active`; âncora com `active` = mês corrente; **âncora com `active` ANTERIOR ao corrente** (regularização — o piso entra em ação, prova que nenhum mês do horizonte é ≤ corrente); `distant` só com itens; ordenação; **leitura pura** (`CaptureQueriesContext` sem `INSERT` + `MonthlyLog.objects.count()` inalterado); isolamento por tenant.
  - [x] Regenerar `schema.yaml` (`cd backend && uv run python manage.py spectacular --file ../schema.yaml`) e `types.gen.ts` (`cd frontend && npm run generate-types`). Conferir zero deleção de componente pré-existente.

- [x] **Task 2 — Tokens `futureBoard` (AC8)**
  - [x] Em `frontend/src/shared/design/tokens.ts`, adicionar o bloco `futureBoard` com os 4 valores do `DESIGN.md`; emitir **só** `--ds-future-board-trail-width` em `shellCssVariables()`; comentar por que `horizonMonths`/`focusScroll` não viram var e por que `terminalOpacity` reusa a var da Task Row.
  - [x] Estender `tokens.test.ts`.

- [x] **Task 3 — Camada de API: chave, hook e as 3 invalidações (AC9)**
  - [x] `frontend/src/api/keys.ts`: `futureHorizon: () => ['bujo', 'futureLog', 'horizon'] as const` (+ `keys.test.ts`).
  - [x] `frontend/src/features/bujo/api.ts`: `useFutureHorizonQuery()` (GET `/api/bujo/future-log/horizon/`); **trocar por prefixo** `['bujo','futureLog']` as invalidações de `useCreateMonthlyTaskMutation` (`api.ts:331`) e `usePlaceRecurringTemplateMutation` (`api.ts:539`); **acrescentar** `['bujo','futureLog']` a `invalidateRitualQueries` (`api.ts:604`). `useMigrateTaskMutation` (`api.ts:417`) já usa o prefixo — conferir, não mexer.
  - [x] `frontend/src/features/bujo/types.ts` + barrel `index.ts`: re-exportar o hook e os tipos novos (`FutureLogHorizon`, `FutureLogMonthCount`) — a 14.6 perdeu tempo com um barrel incompleto bloqueando a fase seguinte; fechar aqui.
  - [x] `api.test.tsx`: hook novo + **um teste por invalidação corrigida que falha antes da correção**.

- [x] **Task 4 — Extensões aditivas nos canônicos (AC4, AC5)**
  - [x] `TaskRowBase.tsx` **(a)**: prop booleana opcional (default = comportamento atual) que faz o ícone de status cair no ramo `role="img"` já existente. Uma condição em `isStatusCycleControl`; **nada mais muda** — `trailingSlot`, ordem, subtarefas, opacidade terminal, todos intocados. A prop **não** desliga o controle de linhagem.
  - [x] `TaskRowBase.tsx` **(b)** — **a correção da seta**: extrair o predicado de "controle de linhagem" (`status === 'migrated' || (status === 'postponed' && Boolean(task.migratedToTask))`) e aplicá-lo **nos dois lugares** hoje presos ao literal: o `useEffect` de `successorAvailable` (`:123-129`) e o ramo de renderização (`:216`). Trocar `STATUS_LABEL.migrated`/`taskStatusIconFor('migrated')` por `STATUS_LABEL[status]`/`taskStatusIconFor(status)`. Comentar no código por que `postponed` exige `migratedToTask` e `migrated` não (retrocompatibilidade + `postponed` sem linhagem é estado legal da matriz `ALLOWED`).
  - [x] `TaskDetailCard.tsx`: prop booleana opcional (default = comportamento atual) que omite **só** `Cancelar tarefa` do rodapé (`:411-421`, o bloco `{!isSubtask && (<Button onClick={handleCancel}…>)}`).
  - [x] `MonthlyDestinationPicker.tsx`: props opcionais para (a) lista de meses selecionáveis (aba "Outro mês", retargeting da grade) e (b) rótulo de confirmação nomeado por ato (hoje o botão é o literal `Confirmar` em `:205`). Documentar no cabeçalho que a 14.9 provavelmente estende de novo (abas "Esta semana · Dia no mês · Outro mês").
  - [x] Rodar `TaskRowBase.test.tsx`, `TaskDetailCard.test.tsx` e `MonthlyDestinationPicker.test.tsx` **sem alterá-los** — verde é o aceite de não-regressão. Acrescentar, nos mesmos arquivos, os testes novos da AC5 (props ligada/desligada; `postponed` com linhagem + sucessor no DOM; `postponed` com linhagem sem sucessor; `postponed` sem linhagem seguindo `role="img"`).
  - [x] Rodar também `WeeklyBoardPage.test.tsx`, `MonthlyBoardPage.test.tsx` e os specs `weekly-board`/`monthly-board`/`move-task` — a extensão (b) é cross-surface por construção (ver AC9).

### Fase B — Superfície

- [x] **Task 5 — `futureHorizon.ts` (lógica pura)**
  - [x] Criar `frontend/src/features/bujo/components/future/futureHorizon.ts`: ordenação dia → sem-dia (espelho de `_by_day_then_undated`); formatação `(14)` / `— ago` + rótulos acessíveis; agrupamento dos `distant` por ano (com contagem por mês); derivação de "N itens · N com dia · N sem dia"; validação de captura (`monthFirst > anchorMonthFirst`).
  - [x] Acrescentar `MONTH_ABBREV_PT` a `frontend/src/features/bujo/monthNames.ts` (hoje só existe `MONTH_NAMES_PT`; a abreviação vive duplicada dentro de `FuturePage.tsx` legado — **não** importar de lá).
  - [x] Acrescentar `addMonthsIso(monthFirst, delta)` a `frontend/src/shared/date/index.ts` — a função existe **copiada** em 4 arquivos de produção (`MonthlyPage`, `MonthlyBoardPage`, `MonthlyPlanningPage`, `GratitudeHistorySurface`); esta story **não** refatora os 4 consumidores existentes (fora de escopo), só para de criar o 5º.
  - [x] Testes cobrindo os casos da AC3 + virada dez/jan no agrupamento por ano.

- [x] **Task 6 — Componentes de `future/` (AC1, AC5, AC7)**
  - [x] Criar em `frontend/src/features/bujo/components/future/`: trilho do horizonte (desktop) + barra de meses rolável (compact), seletor **Ir para mês…** (popover/sheet, agrupado por ano, com estado vazio) e a captura do header. Nomes e granularidade a critério do dev, **co-locados com teste**.
  - [x] `future/noLiteralTokens.test.ts` (guardrail, molde de `weekly/`+`monthly/`).

- [x] **Task 7 — `FutureBoardPage` + router/shell (AC1, AC9)**
  - [x] Criar `frontend/src/pages/planner/FutureBoardPage.tsx` (+ `.test.tsx`), landmark `<main aria-label="Futuro">`, compondo trilho + foco, consumindo `useFutureHorizonQuery()` (trilho/distantes) e `useMonthlyLogQuery(monthFirst)` (coluna de foco). Estado do mês em foco é **local** (sem param de rota) — registrar a decisão no cabeçalho do arquivo. Skeleton próprio preservando a geometria (AC7).
  - [x] `frontend/src/app/router.tsx`: `planner/future` (linhas 140-141) passa a montar `<FutureBoardPage />`; `<FuturePage />` deixa de ser montada (arquivo permanece no repo, AC9).
  - [x] `frontend/src/app/layout/shell/shellRouting.ts:62`: `planner/future` → `surfaceMigrated: true`; atualizar `shellRouting.test.ts` (`MIGRATED_ROUTE_IDS`).
  - [x] Estender `pages/planner/noLiteralTokens.test.ts` com `FutureBoardPage.tsx`.

### Fase C — Datear/mover e anuais

- [x] **Task 8 — Datear/mover no lugar (AC4)**
  - [x] Fiar "Definir dia" (item sem dia) e "Mover" (qualquer item) no `trailingSlot` da Task Row, abrindo o `MonthlyDestinationPicker` estendido; fiar também o `onMove` do `TaskDetailCard`; confirmar por `useMigrateTaskMutation` com `destination:'future'`.
  - [x] Tratar erro preservando seletor + destino armado (`role="alert"`); nenhum toast no sucesso.
  - [x] **Provar a linhagem ponta-a-ponta na superfície**: depois de datar, a origem aparece como "Adiada" **com a seta acionável** (sucessor no mesmo mês/DOM), clicar navega e o sucessor entra com o destaque de 2000ms; o sucessor aparece na lista; nenhuma das duas linhas some. Teste de componente/página **e** E2E (Task 11) — este é o assert que a Task 4(b) existe para viabilizar.
  - [x] Teste provando a invariante "todo mês desta superfície > mês corrente" (nenhum caminho monta `destination:'future'` com mês ≤ corrente).

- [x] **Task 9 — Anuais pendentes (AC6)**
  - [x] Seção `role="region"` + `aria-label="Anuais pendentes de {ano}"`, botão **"Alocar"**, `RecurringPlacementDialog` reusado **sem alteração**, molde "vazio = sem DOM" preservado.

### Fase D — Acessibilidade, regressão e E2E

- [x] **Task 10 — Acessibilidade (AC7)**
  - [x] Cobrir as **5 faixas** (wide/medium/tablet/compact/reflow-320) com `axe` **desde o primeiro commit** do spec. Se o tablet reproduzir o achado de `target-size` da 14.6, a saída autorizada é adotar a composição compact nessa faixa — documentar no cabeçalho do arquivo, não silenciar a regra.
  - [x] Conferir foco/nome/papel do trilho, do foco, da seta de linhagem e dos sheets; retorno de foco ao acionador; contraste do mês vazio em light **e** dark (AC7, `--ds-ink-muted`).

- [x] **Task 11 — E2E e regressão (AC9)**
  - [x] Criar `frontend/e2e/seedFutureLogScenario.ts` (itens datados/sem dia em meses do horizonte, um item num mês distante, um anual pendente) e `frontend/e2e/future-log-board.spec.ts` cobrindo: horizonte com 8 meses inclusive vazios; troca de foco; "Ir para mês…" com meses distantes e o estado vazio; captura com data completa e parcial; captura rejeitada em mês não-futuro; **datear no lugar com linhagem (origem "Adiada" + seta acionável que navega ao sucessor + sucessor destacado)**; mover para outro mês; ausência de concluir/cancelar na linha **e** no detalhe; offline; as 5 faixas de axe.
  - [x] Atualizar `future-log-annual.spec.ts` e `recurring-soft-delete.spec.ts` (container por `role="region"`, botão "Alocar", seleção do mês no trilho antes de assertar a Task Row).
  - [x] Conferir `move-task.spec.ts` (não deletar o teste; os 3 asserts `getByLabel('Adiada')` seguem válidos por substring — confirmar por execução), `weekly-board.spec.ts`/`monthly-board.spec.ts` (asserts `role="img"` de "Cancelada", intocados), `weekly-monthly-cycle.spec.ts` e os `shell-*.spec.ts` — landmark preservado.
  - [x] `nvm use 22.15.1` antes de qualquer comando de frontend/e2e; `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` limpo na branch Neon `e2e` **antes** do Playwright; `CI=1`, portas 5173/8000 (nunca matar 5174/8001).

- [x] **Task 12 — Gates finais (AC9)**
  - [x] `npx tsc -b --noEmit`, `npm run lint`, `npx vitest run`, `uv run pytest -q` (full-suite), `uv run ruff check .`, `uv run lint-imports`, `uv run python manage.py makemigrations --check --dry-run`, `schema.yaml`/`types.gen.ts` regenerados, Playwright escopado. **Números derivados de execução real, nunca por subtração** (achado recorrente das 14.3/14.6).

## Dev Notes

### Reuso obrigatório — não recriar

| Já existe | Arquivo | Ação nesta story |
|---|---|---|
| `TaskRowBase` (`full`/`compact`/`readonly`) | `features/bujo/components/TaskRowBase.tsx` | Consumir `full`. **Uma** prop aditiva + a correção do ramo de linhagem (AC4/AC5). Anatomia intocada. |
| `TaskDetailCard` | `features/bujo/components/TaskDetailCard.tsx` | Consumir. **Uma** prop aditiva (omitir `Cancelar tarefa`); `onMove` fiado. |
| `taskStatusIcons.tsx` | `features/bujo/components/taskStatusIcons.tsx` | Importar `taskStatusIconFor`/`STATUS_LABEL`. **Não modificar.** |
| `MonthlyDestinationPicker` | `features/bujo/components/monthly/MonthlyDestinationPicker.tsx` | Estender com props opcionais (AC4). Precedente de import cruzado: `MonthlyBoardPage` importa `WeeklyTaskPanel` de `weekly/`. |
| `RecurringPlacementDialog` | `features/bujo/components/RecurringPlacementDialog.tsx` | Reusar **intocado** (AC6). |
| `useCreateMonthlyTaskMutation`, `useMigrateTaskMutation`, `useRecurringTemplatesQuery`, `usePlaceRecurringTemplateMutation`, `useMonthlyLogQuery` | `features/bujo/api.ts` | Consumir. Só as invalidações da AC9 mudam. |
| `shared/date/index.ts`, `monthNames.ts` | — | Base dos helpers novos. **Não duplicar** de `FuturePage.tsx`. |
| `PlannerSkeleton` | `features/bujo/components/PlannerSkeleton.tsx` | **Não serve** aqui: é uma pilha de 5 barras (`aria-hidden`), não preserva a geometria trilho+foco que a AC7 exige. Compor um skeleton local — **não** deformar o compartilhado. |

### A seta de linhagem sobre `postponed` — a lacuna que esta story fecha

Esta é a parte da story mais fácil de errar por leitura apressada. Os fatos, todos verificados no código do baseline:

1. **O backend produz `POSTPONED`, não `MIGRATED`.** `migrate_task` (`services/migration.py`) tem o ramo `else: # "month" ou "future"` que fixa `new_status = Task.Status.POSTPONED`; só `today`/`week` produzem `MIGRATED`. O docstring da função diz isso literalmente. Datear/mover no Future Log usa `destination:'future'` → origem **`postponed`**, rótulo "Adiada", ícone `ArrowLineRight`.
2. **O spine pede seta navegável.** EXPERIENCE.md#Future Log: "a origem fica terminal `migrated` (readonly, **com seta navegável ao sucessor**)". DESIGN.md L631: "a origem fica terminal com `{components.future-board.terminal-opacity}` **e seta navegável ao sucessor**". O mockup mostra a seta nos frames C e E. "Terminal `migrated`" no texto é **terminal com linhagem**, não o literal do enum — a mesma frase aparece no ritual mensal (L285), que também produz `postponed`.
3. **`TaskRowBase` hoje NÃO faz isso.** O ramo botão de linhagem é `status === 'migrated' ? (...)` (`TaskRowBase.tsx:216`) e o efeito de disponibilidade do sucessor abre com `if (status !== 'migrated' || !task.migratedToTask) { setSuccessorAvailable(false); return }` (`:123-129`). `TERMINAL_OPACITY_STATUSES` incluir `postponed` (`:47-52`) resolve **só a opacidade**, não a navegação. Um `postponed` cai no terceiro ramo, `role="img"` — ícone mudo, sem seta, sem foco, sem destaque.
4. **Portanto a correção é obrigatória**, e é da AC4/Task 4(b): generalizar o predicado para terminal-com-linhagem, derivar rótulo e ícone do status real, e manter `migrated` byte-a-byte.

**Por que `postponed` exige `migratedToTask` e `migrated` não:** `migrated` já renderiza o botão mesmo sem sucessor (anunciando "O sucessor está em outro período") e mudar isso seria regressão. Já `postponed` **sem** linhagem é estado legal (`ALLOWED` em `state_machine.py` permite `pending`/`started` → `POSTPONED` direto, sem passar por `migrate_task`) e é exatamente o caso que `TaskRowBase.test.tsx:104-114` cobre asserindo `role="img"`. A guarda por `migratedToTask` é o que mantém aquele teste verde **sem editá-lo** — que é o critério de não-regressão da AC5.

**Efeito cross-surface (intencional, verificado):** Weekly Board e Monthly Board também renderizam `postponed` com linhagem (o ritual mensal adia itens ao Future Log). Depois desta mudança, essas origens ganham a seta; como o sucessor mora em outro período, ela renderiza `aria-disabled` com motivo — mesma degradação já provada para `migrated`, sem crash e sem mudança de layout. Nenhum consumidor precisa de alteração. Os asserts existentes sobrevivem (ver AC9); confirme por execução, não por dedução.

### Contratos de API (todos verificados no código atual — nenhum é hipotético)

| Capacidade | Método + URL | Onde |
|---|---|---|
| **Horizonte + distantes — NOVO** | `GET /api/bujo/future-log/horizon/` | `FutureLogHorizonView` — **a criar (AC2)** |
| Future Log agrupado (legado, intocado) | `GET /api/bujo/future-log/` | `FutureLogView` (`views.py:518`) |
| Tarefas do mês em foco | `GET /api/bujo/logs/monthly/?month_first=` | `MonthlyLogView.get` (`views.py:378`) |
| Captura no futuro | `POST /api/bujo/logs/monthly/` | `MonthlyLogView.post` (`views.py:405`) |
| Datear/mover | `POST /api/bujo/tasks/{id}/migrate/` | `TaskMigrateView` (`views.py:736`) |
| Anuais pendentes | `GET /api/bujo/recurring-templates/?active&recurrence_group=annual&unplaced_year=` | `useRecurringTemplatesQuery` |
| Alocar anual | `POST /api/bujo/recurring-templates/{id}/place/` | `RecurringTaskTemplatePlaceView` |

### `GET /logs/monthly/` **materializa** — e por que é aceitável aqui

`MonthlyLogView.get` chama `get_or_create_monthly_log` (`views.py:389`), então **focar um mês vazio cria o `MonthlyLog`**. Aceito deliberadamente, com três razões verificadas:

1. É o comportamento já vigente e documentado desse endpoint desde a 14.1 ("Consultar um monthly futuro (armazenamento do Future Log) segue devolvendo `status: null`") e o `MonthlyBoardPage` da 14.6 já opera assim.
2. O log criado nasce com `status = NULL` — **inerte** para todos os predicados de ciclo: `_previous_operational` filtra `status__isnull=False` (`cycles.py:134-149`), `_monthly_next_planning_exists` exige `status=PLANNING` (`cycles.py:97-102`), `monthly_cycle_readiness` só olha `ACTIVE`/`PLANNING` (`cycles.py:349-360`). Não entra na navegação operacional (decision-log 2026-07-20, M07/M08).
3. O endpoint **novo** da AC2 é que não pode materializar — é ele que varre o horizonte inteiro. Por isso a AC2 exige a prova de leitura pura só dele.

Se o dev preferir um caminho de leitura sem materialização para o foco, é mudança de escopo — registrar como Questão aberta, não implementar de improviso.

### A invariante que dissolve o bug CRÍTICO da 14.6

O code-review da 14.6 encontrou que `destination:'future'` é rejeitado (400) quando `monthFirst <= mês corrente`, e que durante regularização de 2+ meses pulados o alvo do ritual pode ser **anterior** ao mês corrente — deixando 3 ações quebradas (Questão aberta #5 da 14.6). Aqui a mesma armadilha existe **se e somente se** o âncora do horizonte for o `active` puro. Com o piso `max(active, mês corrente)` da AC2, todo mês do trilho e todo mês distante é **estritamente maior** que o mês corrente, e `destination:'future'` é sempre aceito. Isso é uma **invariante a testar**, não uma coincidência a torcer para que se mantenha.

### Inteligência das stories anteriores — 7 lições que custaram code-review nas 14.5/14.6

Todas extraídas dos Dev Agent Records e dos achados de code-review já registrados. Cada uma tem endereço nesta story:

1. **Invalidação por chave exata em vez de prefixo** — bug real na 14.5 (`useCreateWeeklyTaskMutation`) e de novo na 14.6 (`useCreateMonthlyTaskMutation` + `invalidateRitualQueries`). Terceira ocorrência endereçada pela AC9 **antes** de existir.
2. **Número de gate afirmado sem execução** — MÉDIO na 14.3 e na 14.6 ("`move-task.spec.ts` 8/11" num arquivo de 9 testes). Contar por contagem literal de `test(`, nunca por subtração (Task 12).
3. **Deletar um teste que a AC mandava atualizar** — ALTO na 14.6 (`move-task.spec.ts`). Ver AC9: o mesmo teste volta a aparecer aqui e **não** pode ser removido.
4. **`tsc -b --noEmit` mascarado pelo Vitest** — ALTO na 14.6 (esbuild não type-checa testes). Rodar `tsc` de verdade antes de declarar o gate.
5. **Guardrail de literal com regex genérica demais / de menos** — ALTO na 14.6 (literal `7` passava porque `\b7\b` colidiria com prosa). O `8` do horizonte tem o mesmo perfil: regex específica, AC8.
6. **Achados de a11y que só o browser real pega** — 3 na 14.6, nenhum reproduzível em jsdom: `color-contrast` de `--ds-ink-disabled` sobre `--ds-surface-subtle` (~2,6:1, **exatamente o par que o `DESIGN.md` sugere para mês vazio** — ver AC7), `target-size` de botão herdando o piso global de 44px dentro de container estreito, e falta de espaço para alvos de toque em faixa intermediária. Rodar as 5 faixas cedo, não no fim.
7. **Barrel incompleto travando a fase seguinte** — a 14.6 descobriu no meio da Fase B que `features/bujo/index.ts` não reexportava os hooks novos. Fechado na Task 3.

**Padrão de commit observado no git** (`971da7c` → `0fc9ce6`, seis stories): **um commit por story**, mensagem `feat(story-14.N): <título>`, incluindo backend + frontend + E2E + o próprio arquivo da story + `sprint-status.yaml` + o relatório de arquivos não commitados. Manter.

### Riscos de regressão E2E (verificados lendo os specs atuais, não hipotéticos)

- `frontend/e2e/future-log-annual.spec.ts` — o mais acoplado. Depende de: botão `'Definir placement'` (vira "Alocar", AC6); container por `getByText(...).locator('xpath=..')` e linha por `locator('xpath=ancestor::div[1]')`; `page.getByText(futureGroupHeading)` e `getByTestId('task-row')` **sem selecionar mês**. O item é colocado em `now.getMonth() + 2` — o **segundo** mês do horizonte, não o de foco default (`+1`), então na superfície nova o assert vira **falso positivo** se não houver seleção explícita no trilho. O trecho final que confere o placement sem data em "Este Mês" não muda.
- `frontend/e2e/recurring-soft-delete.spec.ts:236-247` — mesmo container por `xpath=..`; a tese (excluído sai da elegibilidade, seção sobrevive pelo vivo) precisa ser preservada literalmente.
- `frontend/e2e/move-task.spec.ts` — 3 asserts `originRow.getByLabel('Adiada')` (~98, ~204, ~428) permanecem verdes com a mudança da Task 4(b) porque `getByLabel` casa substring por default; o teste "move de Este Mês para Futuro" (~171-212) **não pode ser deletado** — ele já falha antes, no passo "Mover tarefa", por causa-raiz pré-existente da 14.5 (affordance que só `TaskRow.tsx` legado expõe), documentada num comentário extenso no próprio arquivo; a 14.6 levou achado ALTO no code-review exatamente por ter deletado este teste.
- `frontend/e2e/monthly-board.spec.ts:240` e `frontend/e2e/weekly-board.spec.ts:282` — asserem `getByRole('img', { name: 'Cancelada' })`. `cancelled` não tem ramo de linhagem; intocados pela Task 4(b).
- `frontend/e2e/weekly-monthly-cycle.spec.ts:81,106` e `shell-{a11y,active-destination,bottomnav,keyboard,sidebar,states}.spec.ts` — só dependem do rótulo "Futuro" do destino e do landmark `getByLabel('Futuro')`. Preservar `<main aria-label="Futuro">` mantém todos verdes; conferir, não reescrever.
- `frontend/src/pages/planner/FuturePage.test.tsx` — continua verde por renderizar o componente diretamente (não depende da rota). Deixar como está.

### Stack em vigor — **nenhuma dependência nova**

Verificado em `frontend/package.json` no baseline desta story: React `^19.2.0`, `@mui/material` `^6.1.0`, `@tanstack/react-query` `^5.59.0`, `@phosphor-icons/react` `^2.1.10`, TypeScript `~5.9.0`, Vitest `^4.1.9`, `@playwright/test` `^1.61.1`, `@axe-core/playwright` `^4.12.1`, `openapi-typescript` `^7.0.0`. Backend: Django + DRF + `drf-spectacular`, gerenciado por `uv`.

Esta story **não instala nada**: sem date picker (`@mui/x-date-pickers` continua fora — a grade de dias é a do `MonthlyDestinationPicker`, e o mês usa `<input type="month">` nativo, decisão já vigente em `FutureLogItemForm`), sem lib de virtualização (o horizonte tem 8 linhas fixas), sem lib de ícones além do catálogo Phosphor fechado. `@mui/icons-material` permanece **só** no legado até o Épico 18 — componente novo que precise de ícone usa `@phosphor-icons/react` via catálogo (AD-29). Qualquer dependência nova é mudança de escopo: registrar como Questão aberta antes de instalar.

### Convenções de teste (idênticas às da 14.5/14.6 — citadas, não repetidas)

Co-localização `Component.test.tsx`; `frontend/e2e/fixtures.ts` (`test` **nunca** de `@playwright/test` direto); `shellHelpers.ts` (`navigate`, `waitForDialogSettled`, `waitForSheetSettled`); `axeHelper.ts` (`expectNoAxeViolations`); disciplina de não-vacuidade (toda asserção "não aparece" tem irmã "aparece quando deveria"); nomes de teste em pt-BR no backend; guardrails `noLiteralTokens.test.ts` por fronteira de pasta. **`nvm use 22.15.1`** antes de qualquer comando de frontend (a sessão abre em v18). Playwright em `CI=1` nas portas 5173/8000 — **nunca** matar 5174/8001 (dev local do usuário). No viewport tablet (800px) a sidebar inicia em **rail colapsado**: expandir antes de clicar em destino aninhado (`mainNav().getByRole('button',{name:'Expandir sidebar'})`), senão o clique trava até timeout.

### Referências

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 14.7` (L2317-2333) — ACs originais do épico]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Future Log` (L313-339), `#State Patterns` (L419-420), `#Tarefas e logs` (L285), `#Key Flows` Fluxo 6]
- [Source: `.../mockups/key-future-log.html` — mockup canônico aprovado (frames A–E + reconciliação)]
- [Source: `.../DESIGN.md` L383-387 (`{components.future-board}`), L627-633 (seção Future Log)]
- [Source: `.../architecture-and-story-handoff.md#M08 — Future Log`]
- [Source: `.../.decision-log.md` — "Abertura do M08" (2026-07-20), "M08 aprovado e promovido" (2026-07-21), "Separação de navegação Monthly/Future" (2026-07-20), M09/"Alocar" (2026-07-21)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` L307 (Future Log = `monthly_log` futuro, sem tabela própria), AD-28 item 1 (`status IS NULL` = fora do regime)]
- [Source: `_bmad-output/implementation-artifacts/14-6-monthly-board-e-planejamento-mensal-no-sistema-novo.md` — precedente direto: props/reuso, achados de a11y, bug de `destinationForTarget()`, Questão aberta #5]
- [Source: `_bmad-output/implementation-artifacts/14-5-weekly-board-e-planejamento-semanal-no-sistema-novo.md` — origem de `TaskRowBase`/`TaskDetailCard`/tokens]
- [Source: `backend/bujo/views.py` (`FutureLogView`, `MonthlyLogView`, `TaskMigrateView`), `backend/bujo/services/migration.py` (`migrate_task`), `backend/bujo/services/state_machine.py` (`ALLOWED`), `backend/bujo/services/cycles.py` (`add_months`, `_previous_operational`, `next_monthly_target`), `backend/bujo/services/rituals.py` (`_by_day_then_undated`)]
- [Source: `frontend/src/features/bujo/components/TaskRowBase.tsx` (ramo de linhagem, `:123-129` e `:216-242`), `TaskDetailCard.tsx` (`:398-430`), `monthly/MonthlyDestinationPicker.tsx`, `frontend/src/pages/planner/FuturePage.tsx`, `frontend/src/features/bujo/api.ts`, `frontend/src/api/keys.ts`, `frontend/src/shared/design/tokens.ts`, `frontend/src/app/layout/shell/shellRouting.ts`]

### Questões abertas

1. **Deep-link do mês em foco.** Esta story usa estado local (sem param de rota), coerente com o stepper da 14.6. Vale um `?month=AAAA-MM` para compartilhar/voltar direto a um mês distante? Decisão de produto — não implementar sem ela.
2. **Título do `RecurringPlacementDialog`.** O botão vira "Alocar" (AC6) mas o dialog continua "Definir placement" até a 14.8, que é a dona da padronização na biblioteca. Confirmar que a inconsistência temporária é aceitável, ou antecipar o rename (custo: `RecurringPlacementSection` + `recurring-templates.spec.ts:306`, que **já** falha por esse locator desde a 13.3).
3. **Onde mora o seletor de destino depois desta story.** Ele nasce em `monthly/` (14.6), é estendido aqui e a 14.9 vai precisar de abas "Esta semana · Dia no mês · Outro mês". Promover a `components/` compartilhado com nome neutro é decisão natural da 14.9 — registrar, não fazer agora.
4. **Materialização no foco.** `GET /logs/monthly/` cria o log ao consultar (ver Dev Notes). Se o dono quiser zero materialização por navegação no Futuro, é uma leitura nova (ou um `?materialize=false`) — story própria.
5. **`FuturePage.tsx` desmontada.** Fica no repo como código morto até o Épico 18, junto com `TaskRow.tsx`. Alternativa (remover já) foi descartada porque o Épico 18 é o dono da remoção e o teste do arquivo ainda documenta o contrato legado — confirmar que a dívida temporária é aceitável.
6. **Herdada da 14.6, parcialmente endereçada:** `onMove` do `TaskDetailCard` continua sem handler no Weekly/Monthly Board, deixando 4 testes de `move-task.spec.ts` vermelhos por decisão pendente de produto. Esta story **fia** o mover no Future Log (é requisito do M08) — o que aumenta a assimetria e dá o precedente concreto para decidir se Weekly/Monthly seguem o mesmo caminho.
7. **Seta de linhagem em `cancelled`.** A Task 4(b) generaliza o controle para `migrated`/`postponed` — os dois status que `migrate_task` produz com `migrated_to_task`. `cancelled` não gera sucessor (`destination:'cancel'` não cria registro nem linhagem), então fica fora por construção. Registrado para que a generalização não seja "esticada" sem decisão.
8. **Anatomia da coluna 5 do `TaskRowBase` × as DUAS affordances do mockup** *(aberta no code review, conforme a própria AC5 manda: "qualquer necessidade adicional de anatomia … vira Questão aberta, nunca duplicação")*. O `key-future-log.html` (frame A) põe **duas** affordances na área trailing: o botão de texto `definir dia` (só na linha sem dia) **e** o ícone `⇢ Mover de mês` (em **toda** linha) — é a leitura literal da AC4, "Definir dia (item sem dia) **ou** Mover (**qualquer item**)". A coluna 5 do `TaskRowBase` é fixa em **24px** (`TaskRowBase.tsx:437`) e não comporta dois controles de 44px sem mexer na anatomia que a AC5 blinda. A implementação entrega **um** controle por linha, nomeado pelo estado do item, e mover um item **sem dia** continua alcançável **no mesmo fluxo**: o seletor que esse controle abre tem a aba "Outro mês", e o `TaskDetailCard` tem "Mover tarefa". Decidir: alargar a coluna 5 (mexe em Weekly/Monthly Board por ser anatomia compartilhada), aceitar o controle único como definitivo, ou dar overflow menu à linha. Não implementar sem a decisão.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`) — workflow `bmad-dev-story`.

### Debug Log References

**Experimentos de não-vacuidade (reversão cirúrgica, `git diff --stat` limpo depois de cada um).**

*As 3 invalidações da AC9* — cada teste semeia `keys.bujo.futureHorizon()` no cache e exige `isInvalidated === true`:

| # | Mutação aplicada em `features/bujo/api.ts` | Teste alvo | Resultado |
|---|---|---|---|
| a | `['bujo','futureLog']` → `keys.bujo.futureLog()` em `useCreateMonthlyTaskMutation` | "useCreateMonthlyTaskMutation invalida o trilho" | **1 failed** |
| b | idem em `usePlaceRecurringTemplateMutation` | "usePlaceRecurringTemplateMutation invalida o trilho" | **1 failed** |
| c | linha `['bujo','futureLog']` REMOVIDA de `invalidateRitualQueries` | "invalidateRitualQueries invalida o Future Log" | **1 failed** |

Restaurado: `api.test.tsx` 70 passed, arquivo idêntico ao backup byte a byte.

*A seta de linhagem sobre `postponed` (Task 4b)* — dois asserts distintos, **dois experimentos separados** (o ramo de renderização e o efeito de disponibilidade do sucessor são lugares diferentes do código e falham por motivos diferentes):

| # | Mutação aplicada em `TaskRowBase.tsx` | Resultado (`-t "postponed"`) |
|---|---|---|
| A | ramo de renderização (`:216`) revertido para o literal `status === 'migrated'` | **2 failed** — some a seta inteira (com e sem sucessor no DOM) |
| B | só o `useEffect` de `successorAvailable` (`:123-129`) revertido | **1 failed** — a seta aparece, mas nasce `aria-disabled` mesmo com o sucessor no DOM |

O experimento B isola o efeito: o caso "sucessor ausente" continua verde, provando que os dois asserts medem coisas diferentes.

**Achados reais só reproduzíveis no browser (primeira execução do E2E, 9 dos 13 testes vermelhos).** Nenhum era falso positivo de teste — 3 eram defeitos de produto e 4 eram acoplamento do próprio spec ao chrome global:

1. **`color-contrast` (serious, wide/medium/tablet)** — o `primary` do tema MUI (teal de marca) sobre `--ds-surface` mede ~2,4:1. Todo `Button` novo passou a declarar `--ds-primary`/`--ds-on-primary` explicitamente. O legado nunca foi pego porque a rota antiga ficava sob `exclude: 'main'` (SHELL-DEBT-02) — a superfície nova roda **sem** exclusão.
2. **`aria-required-children` + `aria-required-parent` (CRITICAL)** — `MonthlyDestinationPicker` (herdado da 14.6) tem `role="grid"` com `role="gridcell"` **sem `role="row"` entre os dois**. A 14.6 nunca mediu o componente ABERTO. Corrigido com uma linha `role="row"` + `display: contents` (grade CSS byte a byte idêntica).
3. **Colisão de nome acessível** — o formulário de captura nasceu com `aria-label="Capturar no futuro"`, e `getByLabel('Futuro')` casa por **substring**: `navigate()` (`shellHelpers.ts`), `future-log-annual`, `weekly-monthly-cycle` e os `shell-*` passaram a resolver 2 elementos. Renomeado para `"Adicionar item ao Future Log"` (rótulo que o `FutureLogItemForm` legado já usava; "Futuro" não é substring de "Future Log"). Guardado por teste unitário de regressão.
4. **Locators do spec ambíguos pelo chrome global** (achado do mesmo tipo que a Retro do Épico 13): `getByLabel('Título')` casava a captura do Futuro **e** o `BrainDumpCaptureSheet`; `getByRole('button', { name: 'Pendente' })` casava por substring o item de menu "Brain Dump: 0 itens pendentes". Escopados ao formulário e à lista de foco.
5. **`waitForDialogSettled` não serve ao seletor de destino** em wide/medium/tablet: ali o `MonthlyDestinationPicker` é **inline**, não um `<Dialog>` do MUI, então esperar `.MuiDialog-container` travava até o timeout. Trocado por `expect(seletorDestino(page)).toBeVisible()`.
6. **Compact não tem "Futuro" na bottom nav** (só Hoje / Esta Semana / Este Mês / Menu): a navegação em 390 e 320 passa pelo sheet de navegação completa.

**Passo de QA (`bmad-qa-generate-e2e-tests`, 2026-07-26) — 1 defeito de produto + 9 lacunas de prova.**
Relatório completo em `_bmad-output/implementation-artifacts/tests/test-summary-14-7.md`.

*Defeito:* o overlay "Ir para mês…" (`FutureMonthPicker`) não se expunha como diálogo nomeado —
`aria-label` estava no componente `<Dialog>`/`<Drawer>` do MUI, que o espalha no root
`role="presentation"` do Modal, e não no elemento que carrega o papel. No desktop o diálogo existia
**anônimo**; em compact o sheet **não tinha `role="dialog"` nenhum**. O `MonthlyDestinationPicker`,
o outro overlay desta mesma superfície, já fazia certo — a divergência denunciou. Papel e nome
movidos para o slot `paper` nos dois ramos. O gate de axe não alcançava o caso porque
`aria-dialog-name` é regra **best-practice**, fora das tags `wcag2a/2aa/21a/21aa/22aa`.

*Experimentos de não-vacuidade deste passo* (reversão cirúrgica, `git diff` limpo depois de cada um):

| # | Mutação | Resultado |
|---|---|---|
| D | `aria-label` de volta ao componente `<Dialog>`/`<Drawer>` (estado pré-correção) | **3 failed** — desktop sem nome, compact sem papel |
| E | `onKeyDown={(e) => e.preventDefault()}` na seta de linhagem (`TaskRowBase.tsx`) — mata **só** a ativação por teclado, deixa o clique intacto | **1 failed**, exatamente o teste de teclado; os 3 testes de clique na mesma seta seguem verdes (isola o mecanismo medido) |
| F | `disableRestoreFocus` no `Drawer` do `FutureMonthPicker` | **1 failed**, exatamente o teste de devolução de foco ao acionador |

*Teste stale consertado (causa raiz da 14.5):* `shell.spec.ts:137` estava vermelho desde a 14.5 —
a segunda metade prova que o seam **persiste** ao navegar, e o destino escolhido em 13.x foi
`Esta Semana`, migrada na 14.5. Uma linha: destino passou a ser `Recorrentes` (legada de fato até a
14.8), com a tese preservada literalmente e o par oposto (seam **sumir** numa rota migrada) agora
provado em `future-log-board.spec.ts` usando esta mesma rota como irmã de não-vacuidade.

*Lacunas fechadas:* seam legado ausente em `/planner/future` com irmã não-vacuosa (AC1 — só o unit
da tabela de rotas provava isso); ativação por `Enter`/`Space` da seta de linhagem (AC7 — nenhum
teste do projeto acionava a seta por teclado); contagem do trilho **medida** depois de um datear,
na superfície e na API (AC2 — a justificativa estava escrita, o número nunca era medido); sheet
compact do "Ir para mês…" de fato exercitado (o título do teste compact **afirmava** "sheets contêm
foco" e o corpo não abria sheet nenhum); par `0 itens` → `1 item` no trilho ao alocar um anual (AC6
— o assert existente, "a linha do mês aparece", é sempre verdadeiro: os 8 meses são scaffolding);
fiação do `onMove` do `TaskDetailCard` (AC5 — só a presença do botão era testada); disparo real do
placement anual com o `monthFirst` derivado da data (AC6); estado `local loading` (AC7).

### Completion Notes List

**Fase A — backend + fundação (Tasks 1-4)**

- `backend/bujo/services/future_log.py` (novo, molde de `services/density.py`): `future_log_horizon(*, user)` com âncora `max(monthly ACTIVE, mês corrente)`. O `max(...)` é **piso, nunca teto** — documentado no docstring e coberto por teste dedicado com `active` ATRASADO (regularização de meses pulados). É essa invariante que dissolve o bug CRÍTICO da 14.6: todo mês da superfície é estritamente maior que o corrente, então `destination:'future'` nunca cai no 400 "Use 'month' para o mês corrente". Provado dos dois lados: um teste assere a invariante e, no mesmo teste, migra de verdade para o 1º mês do horizonte (200).
- Leitura **pura** provada em dois níveis: serviço (`CaptureQueriesContext` sem `INSERT`/`UPDATE`/`DELETE` + `MonthlyLog.objects.count()` inalterado) e endpoint (`MonthlyLog.all_objects.count()` inalterado após varrer 8 meses inexistentes). Uma única query agregada cobre horizonte e distantes.
- `GET /api/bujo/future-log/horizon/` é **aditivo**: `GET /api/bujo/future-log/` mantém contrato idêntico, com teste próprio provando isso.
- Tokens `futureBoard` com os 4 valores do `DESIGN.md`; só `--ds-future-board-trail-width` vira CSS var. `horizonMonths` é a **única fonte do número 8** no cliente.
- `keys.bujo.futureHorizon()` nasce sob o **mesmo prefixo** `['bujo','futureLog']`, e as 3 invalidações passaram a usar o prefixo (3ª ocorrência da classe de bug das 14.5/14.6, cada uma com experimento de não-vacuidade acima).
- As 3 extensões dos canônicos são **aditivas com default = comportamento atual**: `TaskRowBase.allowStatusCycle`, o predicado `isLineageControl` (não é prop — é o literal `'migrated'` virando predicado) e `TaskDetailCard.allowCancel`. `MonthlyDestinationPicker` foi estendido **no lugar** com `selectableMonths`/`onTargetMonthChange`/`confirmLabelFor` — o mês-alvo é CONTROLADO pelo pai, o que preserva a assinatura `onConfirm(scheduledDate)` intacta e mantém `MonthlyDestinationPicker.test.tsx` verde sem uma linha alterada.
- **Não-regressão mecânica confirmada**: `TaskRowBase.test.tsx`, `TaskDetailCard.test.tsx` e `MonthlyDestinationPicker.test.tsx` passam **sem nenhuma alteração nos testes pré-existentes** — em particular o `postponed` sem linhagem → `role="img"` (`:104-114`), que é exatamente o que a guarda por `migratedToTask` preserva.

**Fase B-C — superfície, datear/mover e anuais (Tasks 5-9)**

- Lógica pura em `future/futureHorizon.ts` (ordenação dia → sem-dia espelhando `_by_day_then_undated`, formatação `(14)`/`— ago` com rótulo acessível por PALAVRA, agrupamento por ano, contagens do foco, validação de captura). O desempate por `order_index` sai do `sort` estável: o backend já entrega ordenado por `order_index`, e `TaskSerializer` não expõe o campo.
- `addMonthsIso` promovido a `shared/date/index.ts` (a função existia copiada em 4 arquivos; esta story não refatora os 4, só para de criar o 5º) e `MONTH_ABBREV_PT` a `monthNames.ts` (não importado do `FuturePage.tsx` legado).
- `FutureBoardPage` com skeleton próprio preservando a geometria trilho+foco, mês em foco como estado local, e os 8 estados da AC7 com a cópia literal do mockup.
- Datear/mover usa `useMigrateTaskMutation` com `destination:'future'`; a origem vira `postponed` (o que o backend devolve — nada foi renomeado nem inventado) e a seta de linhagem navega ao sucessor no mesmo mês. Falha preserva o seletor com o destino armado; sucesso não mostra toast.
- Anuais pendentes: `role="region"` nomeada, botão **"Alocar"**, `RecurringPlacementDialog` reusado **intocado** (o título dele segue "Definir placement" até a 14.8), molde "vazio = sem DOM" preservado.

**Fase D — gates (Tasks 10-12), todos re-executados após o último commit de código**

- `npx tsc -b --noEmit`: limpo.
- `npm run lint` (eslint): limpo.
- `npx vitest run`: **1542 passed / 121 arquivos** (número re-executado no passo de QA, já com os 11 testes que ele acrescentou). Baseline re-executada no worktree do commit `0fc9ce6`: **1401 passed / 115 arquivos** — logo, **141 testes novos** em tempo de execução. A contagem literal no `git diff` dá **127 declarações** novas (35 em arquivos rastreados + 92 nos arquivos novos): a diferença são os dois guardrails `noLiteralTokens.test.ts`, que geram um teste **por arquivo-fonte** num laço — uma declaração nova ali vira N testes executados.
- `uv run pytest -q` (full-suite, SEM escopo por caminho): **1314 passed** (re-executado no passo de QA). Baseline re-executada no mesmo worktree: **1301 passed** — logo, **13 testes novos** de backend, número que bate com a contagem literal de `def test_` adicionados no `git diff` (13: 7 em `test_services.py`, 6 em `test_views.py` — 5 do dev-story + 1 do passo de QA).
- `uv run ruff check .`: `All checks passed!`
- `uv run lint-imports`: `Contracts: 1 kept, 0 broken.`
- `uv run python manage.py makemigrations --check --dry-run`: `No changes detected` (esta story não altera schema).
- `schema.yaml` + `frontend/src/api/types.gen.ts` regenerados e commitados juntos: **+50 e +54 linhas, ZERO deleção** (conferido por `git diff | grep "^-"`).
- `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` na branch Neon `e2e`: limpo (exit 0), **antes** do Playwright.
- Playwright (`CI=1`, portas 5173/8000), escopado aos specs afetados e re-executado no passo de QA:
  - `future-log-board.spec.ts`: **14/14 passed** (2,8 min) — 13 do dev-story + 1 do passo de QA.
  - `future-log-annual.spec.ts` + `recurring-soft-delete.spec.ts`: **4 passed / 1 failed**. O spec desta story (`future-log-annual`) passa; a falha é `recurring-soft-delete.spec.ts:266`, **pré-existente da 14.5** (espera a seção de placement de recorrentes em "Esta Semana", que vive na `WeeklyPage.tsx` legada enquanto `planner/week` monta o `WeeklyBoardPage` desde a 14.5). Mantida executável com comentário registrando a causa raiz — mesmo tratamento dos vermelhos conhecidos de `move-task.spec.ts`, e o oposto do achado ALTO que a 14.6 levou por deletar um teste nessa situação.
  - `shell-a11y` + `shell-active-destination` + `shell-bottomnav` + `shell-keyboard` + `shell-sidebar` + `shell-states` + `shell.spec.ts` (AC9: landmark `<main aria-label="Futuro">` e chrome preservados): **94 passed / 1 failed** na primeira rodada. A falha, `shell.spec.ts:137`, estava **vermelha desde a 14.5** e não tinha relação com esta story: a segunda metade do teste prova que o seam **persiste** ao navegar, e o destino escolhido em 13.x foi `Esta Semana` — migrada na 14.5, onde o seam some de propósito. Consertada aqui em uma linha, com a tese preservada literalmente (destino passou a ser `Recorrentes`, legada de fato até a 14.8); o teste sozinho passa. A re-execução da suíte inteira depois do conserto degradou por ambiente (46,8 min contra 10,4 min da primeira: 82 passed / 9 flaky / 4 failed, **todas** em `shell-keyboard.spec.ts`) — o mesmo arquivo passou 27/27 na primeira rodada e passa **27/27 em 2,5 min** re-executado sozinho, sem flaky nenhum. Nenhuma linha desta story toca esse arquivo; é a flakiness de cold-start da branch Neon `e2e` já registrada nas retros dos Épicos 4/5/11.
  - `move-task.spec.ts` + `weekly-board.spec.ts` + `monthly-board.spec.ts` + `weekly-monthly-cycle.spec.ts`: **32 passed / 5 failed**, com as 5 falhas **todas** em `move-task.spec.ts` e **todas** pré-existentes desde a 14.5 (confirmado por execução isolada: `move de Este Mês para Futuro` estoura no clique em "Mover tarefa", `move-task.spec.ts:213` — antes de qualquer linha desta story). Weekly Board, Monthly Board e o ciclo semanal/mensal **100% verdes**: é a confirmação cross-surface que a AC9 exige para a generalização da seta de linhagem. **Nota:** a Questão aberta #6 fala em "4 testes vermelhos" de `move-task`; são **5** — o quinto (`mover para Esta semana sem escolher dia`, `:382`) tem a mesma causa raiz de DOM legado e não estava no comentário do arquivo.

### File List

**Backend**

- `backend/bujo/services/future_log.py` *(novo)*
- `backend/bujo/serializers.py`
- `backend/bujo/views.py`
- `backend/bujo/urls.py`
- `backend/bujo/tests/test_services.py`
- `backend/bujo/tests/test_views.py`

**Contrato**

- `schema.yaml`
- `frontend/src/api/types.gen.ts`

**Frontend — design system e camada de API**

- `frontend/src/shared/design/tokens.ts`
- `frontend/src/shared/design/tokens.test.ts`
- `frontend/src/shared/date/index.ts`
- `frontend/src/shared/date/index.test.ts`
- `frontend/src/api/keys.ts`
- `frontend/src/api/keys.test.ts`
- `frontend/src/features/bujo/api.ts`
- `frontend/src/features/bujo/api.test.tsx`
- `frontend/src/features/bujo/types.ts`
- `frontend/src/features/bujo/index.ts`
- `frontend/src/features/bujo/monthNames.ts`

**Frontend — canônicos estendidos (aditivos)**

- `frontend/src/features/bujo/components/TaskRowBase.tsx`
- `frontend/src/features/bujo/components/TaskRowBase.test.tsx`
- `frontend/src/features/bujo/components/TaskDetailCard.tsx`
- `frontend/src/features/bujo/components/TaskDetailCard.test.tsx`
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx`
- `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.test.tsx`

**Frontend — superfície nova** *(pasta `future/` inteira é nova)*

- `frontend/src/features/bujo/components/future/futureHorizon.ts` *(novo)*
- `frontend/src/features/bujo/components/future/futureHorizon.test.ts` *(novo)*
- `frontend/src/features/bujo/components/future/FutureHorizonTrail.tsx` *(novo)*
- `frontend/src/features/bujo/components/future/FutureHorizonTrail.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/future/FutureMonthPicker.tsx` *(novo)*
- `frontend/src/features/bujo/components/future/FutureMonthPicker.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/future/FutureCaptureForm.tsx` *(novo)*
- `frontend/src/features/bujo/components/future/FutureCaptureForm.test.tsx` *(novo)*
- `frontend/src/features/bujo/components/future/noLiteralTokens.test.ts` *(novo — guardrail de literais, TIPO NOVO nesta pasta)*
- `frontend/src/pages/planner/FutureBoardPage.tsx` *(novo)*
- `frontend/src/pages/planner/FutureBoardPage.test.tsx` *(novo)*
- `frontend/src/pages/planner/noLiteralTokens.test.ts`

**Frontend — router e shell**

- `frontend/src/app/router.tsx`
- `frontend/src/app/layout/shell/shellRouting.ts`
- `frontend/src/app/layout/shell/shellRouting.test.ts`

**E2E** *(dois artefatos de TIPO NOVO: um spec permanente e um seed)*

- `frontend/e2e/future-log-board.spec.ts` *(novo — spec E2E permanente)*
- `frontend/e2e/seedFutureLogScenario.ts` *(novo — seed de cenário)*
- `frontend/e2e/future-log-annual.spec.ts` *(atualizado: container por `role="region"`, botão "Alocar", seleção do mês no trilho)*
- `frontend/e2e/recurring-soft-delete.spec.ts` *(atualizado: mesmo container por `role="region"`)*
- `frontend/e2e/move-task.spec.ts` *(atualizado: seleção explícita do mês no trilho; o teste "move de Este Mês para Futuro" foi PRESERVADO, não deletado)*
- `frontend/e2e/shell.spec.ts` *(atualizado no passo de QA: destino do teste de persistência do seam trocado para uma rota ainda legada — vermelho desde a 14.5)*

**Rastreamento**

- `_bmad-output/implementation-artifacts/14-7-future-log-no-sistema-novo.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/tests/test-summary-14-7.md` *(novo — relatório do passo `bmad-qa-generate-e2e-tests`)*

> **Passo de QA (2026-07-26)** — arquivos tocados **depois** do `dev-story`, todos já listados
> acima: `frontend/src/features/bujo/components/future/FutureMonthPicker.tsx` (correção do papel/nome
> do overlay) e `.test.tsx` (+3), `frontend/src/features/bujo/components/TaskRowBase.test.tsx` (+2),
> `frontend/src/pages/planner/FutureBoardPage.test.tsx` (+6), `backend/bujo/tests/test_views.py`
> (+1), `frontend/e2e/future-log-board.spec.ts` (+1 teste e asserts em 2 existentes),
> `frontend/e2e/future-log-annual.spec.ts` (par de asserts de contagem),
> `frontend/e2e/recurring-soft-delete.spec.ts` (comentário registrando a falha pré-existente da 14.5)
> e `frontend/e2e/shell.spec.ts` *(ARQUIVO NOVO na File List desta story — conserto de uma linha num
> teste vermelho desde a 14.5, tese preservada; ver Debug Log References)*.

> **Code review (2026-07-26)** — arquivos tocados **depois** do passo de QA, todos já listados acima:
> `frontend/src/features/bujo/api.ts` (invalidação do Future Log em `useDeleteTaskMutation` — achado
> ALTO) e `api.test.tsx` (+1), `frontend/src/pages/planner/FutureBoardPage.tsx` (skeleton consumindo
> `futureBoard.horizonMonths`, `PendingMove.kind` removido, glifo `⇢`) e `.test.tsx` (assert de
> geometria do skeleton), `frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.test.tsx`
> (+2 axe, um por aba) e `frontend/e2e/future-log-board.spec.ts` (axe na aba "Outro mês"). **Nenhum
> arquivo novo.** Ver "Senior Developer Review (AI)".

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-07-26 | 1.2 | **Code review adversarial (auto-fix).** 1 ALTO corrigido: `useDeleteTaskMutation` não invalidava `['bujo','futureLog']` — 4ª ocorrência da classe de bug da AC9, recém-alcançável porque esta é a 1ª superfície a fiar "Excluir tarefa" sobre `monthly_log` futuros com contagem de trilho (não-vacuidade provada: 1 failed sem a correção). 3 MÉDIOS corrigidos: token `futureBoard.horizonMonths` sem consumidor de produção + skeleton com literal `6` (agora o esqueleto consome o token, com assert de geometria); axe nunca media a aba "Outro mês" (E2E wide + 2 testes jsdom novos no `MonthlyDestinationPicker`). 1 MÉDIO virou Questão aberta #8 (anatomia de 24px da coluna 5 × as duas affordances do mockup), conforme a própria AC5. 1 BAIXO: `PendingMove.kind` (estado morto) removido; glifo do controle trocado para o `⇢` do mockup. Gates re-executados: Vitest **1545**, pytest **1314**, tsc/lint/ruff/lint-imports/makemigrations limpos, schema sem drift. | Amelia (code review) |
| 2026-07-26 | 0.1 | Story criada pelo workflow `create-story` (9 ACs / 12 tasks) | Amelia (create-story) |
| 2026-07-26 | 1.1 | Passo `bmad-qa-generate-e2e-tests`: 1 defeito de produto corrigido (overlay "Ir para mês…" sem papel/nome de diálogo — anônimo no desktop, sem `role="dialog"` em compact) + 9 lacunas de prova fechadas (+11 unit, +1 pytest, +1 E2E e asserts em 3 specs), 3 experimentos de não-vacuidade, gates re-executados e **números finais preenchidos** (Vitest 1542, pytest 1314, Playwright escopado). Relatório em `tests/test-summary-14-7.md`. | Amelia (qa-generate-e2e-tests) |
| 2026-07-26 | 1.0 | Implementação completa (12 tasks / 9 ACs): endpoint aditivo `future-log/horizon/` com leitura pura e âncora com piso; tokens `futureBoard`; 3ª correção da classe de invalidação por prefixo (3 experimentos de não-vacuidade); seta de linhagem generalizada para terminal-com-linhagem (2 experimentos separados); superfície trilho+foco com captura, datear/mover e anuais; 5 faixas de axe. 3 defeitos de produto encontrados pelo E2E real e corrigidos: contraste dos botões, `role="row"` ausente no `MonthlyDestinationPicker` (CRITICAL, herdado da 14.6) e colisão de nome acessível com `getByLabel('Futuro')`. | Amelia (dev-story) |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-26 · **Resultado:** aprovado com correções aplicadas (auto-fix).

### O que foi verificado, e não deduzido

- **Toda task `[x]` tem evidência no código.** Nenhuma marcação falsa: as 12 tasks batem com o `git diff` arquivo a arquivo.
- **File List × `git status`:** conferência mecânica, **zero discrepância** — nenhum arquivo tocado ficou fora da lista e nenhum item da lista está sem mudança.
- **Números de gate re-executados do zero** (não conferidos por leitura): `uv run pytest -q` → **1314 passed**; `npx vitest run` → **1542 passed / 121 arquivos**. Os dois batem **exatamente** com o que a story afirmava — o achado MÉDIO recorrente das 14.3/14.6 ("número afirmado sem execução") **não** se repetiu aqui.
- `npx tsc -b --noEmit`, `npm run lint`, `uv run ruff check .`, `uv run lint-imports`, `makemigrations --check --dry-run`: todos limpos. `schema.yaml` regenerado e comparado byte a byte com o arquivo commitado → **sem drift**.
- **AC2 conferida no código, não no texto:** o piso `max(active, mês corrente)`, a query única agregada e a pureza de leitura estão implementados como a AC descreve; `MonthlyLog.objects` é tenant-scoped por `TenantManager` (fail-closed), então a ausência de filtro explícito por usuário no serviço é correta, não um vazamento.
- **AC5 (não-regressão mecânica):** os testes pré-existentes de `TaskRowBase`/`TaskDetailCard`/`MonthlyDestinationPicker` seguem **sem uma linha alterada**; as adições da 14.7 (e as deste review) são blocos `describe` novos.
- **AC4 (a correção da seta):** `isLineageControl` preserva `migrated` byte a byte (inclusive o ramo sem sucessor) e exige `migratedToTask` só para `postponed` — exatamente a assimetria que mantém `TaskRowBase.test.tsx:104-114` verde.

### Achados

| # | Sev. | Achado | Desfecho |
|---|---|---|---|
| 1 | **ALTO** | `useDeleteTaskMutation` (`api.ts:260-283`) invalida `dailyLog`/`weeklyLog`/`monthlyLog`/`taskDensity` mas **não** `['bujo','futureLog']`. É a **4ª ocorrência** da classe de bug que a AC9 existe para matar, e ela só passou a ser alcançável **nesta story**: o Future Log é a primeira superfície a fiar "Excluir tarefa" do `TaskDetailCard` sobre `monthly_log` futuros (a AC5 mantém o botão de propósito) **e** a exibir contagens vindas de `keys.bujo.futureHorizon()`. Efeito: excluir um item pelo detalhe atualizava a coluna de foco e deixava o trilho dizendo "3 itens" com 2 linhas na lista — o oposto do que a AC4 exige ("atualiza lista, contagens do trilho e cabeçalho de foco"). | **Corrigido.** Prefixo acrescentado + teste em `api.test.tsx` no mesmo molde dos outros três. **Não-vacuidade provada** por reversão cirúrgica da linha: **1 failed**; arquivo restaurado e conferido. |
| 2 | **MÉDIO** | `futureBoard.horizonMonths` — que a AC8 declara "a **única** fonte do número 8 no cliente: o componente que valida/renderiza o horizonte lê o token" — não tinha **nenhum** consumidor de produção: o horizonte chega inteiro do servidor e o único leitor era `horizonMonthsFrom()`, uma função exportada que ninguém chama. AC8 satisfeita vacuosamente. | **Corrigido.** O skeleton do `FutureBoardPage` passou a renderizar `futureBoard.horizonMonths` barras — consumidor real, e o teste de `initial loading` agora **mede** essa geometria. |
| 3 | **MÉDIO** | O skeleton usava `Array.from({ length: 6 })` — literal solto, e 6 barras para um trilho de **8** meses, contra a AC7 ("skeleton **preservando a geometria** trilho + foco"). | **Corrigido** junto com o #2. |
| 4 | **MÉDIO** | O gate de axe **nunca media a aba "Outro mês" aberta** — exatamente a estrutura ARIA que esta story acrescentou (`role="tablist"`/`role="tab"` + `role="listbox"`/`role="option"`). É a repetição da lacuna que a 14.6 pagou caro (nunca mediu o componente **aberto**, deixando passar um `aria-required-children` CRITICAL) e que esta story corrigiu **só** para a grade de dias. | **Corrigido.** Medição acrescentada ao teste de axe wide do `future-log-board.spec.ts` **e** dois testes `jest-axe` novos no `MonthlyDestinationPicker.test.tsx` (uma aba cada), pondo a mesma medição no ciclo rápido. **Sem violação** nas duas abas. |
| 5 | **MÉDIO** | AC4 pede "**Definir dia** (item sem dia) **ou Mover** (**qualquer item**)", e o mockup (frame A) põe **duas** affordances na área trailing: `definir dia` (texto, só na linha sem dia) **e** `⇢ Mover de mês` (**toda** linha). A implementação entrega **um** controle por linha. Causa: a coluna 5 do `TaskRowBase` é fixa em **24px** e não comporta dois controles de 44px. | **Registrado como Questão aberta #8**, que é o que a própria AC5 manda fazer com necessidade de anatomia ("nunca duplicação"). Mitigação real e documentada no código: mover um item **sem dia** continua alcançável no mesmo fluxo (aba "Outro mês" do seletor + "Mover tarefa" do detalhe). |
| 6 | **BAIXO** | `PendingMove.kind` era estado **morto**: escrito nos dois call-sites, nunca lido (o rótulo do ato sai do par mês-alvo/dia armado). Segunda fonte de verdade em potencial. | **Corrigido** (campo removido). |
| 7 | **BAIXO** | O glifo do controle da linha era `⌖`, que no mockup pertence a **"Ir para mês…"**; o glifo do ato de mover lá é `⇢`. | **Corrigido** (troca puramente visual — o nome acessível vem do `aria-label` e não mudou, então nenhum locator foi afetado). |
| 8 | **BAIXO** | `useRecurringTemplatesQuery` ganhou um parâmetro `options?: { enabled }` (aditivo, default `true`) que as Completion Notes não registram como extensão — a AC5 fala em "exatamente três", todas em componentes, e esta é na camada de API. | **Registrado aqui.** Sem correção: é o molde já vigente de `useMonthlyLogQuery`/`useTaskDensityQuery` e o guard é necessário (o ano dos anuais vem do âncora do servidor). |
| 9 | **BAIXO** | Falha de `POST /logs/monthly/` na captura é **silenciosa** e o título digitado é limpo antes de a resposta chegar (`createTask.mutate(fields)` sem `onError`). | **Registrado, não corrigido.** Está fora da letra da AC7 (que amarra `write error` ao seletor da AC4) e é o comportamento idêntico do `WeeklyBoardPage`/`MonthlyBoardPage`; consertar só aqui criaria assimetria entre as três superfícies irmãs. Candidato natural a item de retro do épico. |
| 10 | **BAIXO** | `horizonMonthsFrom()` continua sendo export sem consumidor de produção. | **Mantido de propósito** (não é dívida silenciosa): removê-lo deixaria `addMonthsIso` — promovido a `shared/date` pela Task 5 exatamente para não virar a 5ª cópia — também sem consumidor, e apagaria dois testes de regra correta. Com o #2 corrigido, a AC8 já não depende dele. |

### Gates após as correções

`npx tsc -b --noEmit` limpo · `npm run lint` limpo · `npx vitest run` **1545 passed / 121 arquivos** (1542 + 3: a invalidação do delete e os dois axe de aba) · `uv run pytest -q` **1314 passed** · `ruff`/`lint-imports`/`makemigrations --check` limpos · `schema.yaml` sem drift · `migrate --check` limpo na branch Neon `e2e` **antes** do Playwright.

**Playwright (`CI=1`, 5173/8000), `future-log-board.spec.ts` re-executado com as correções: 14/14 passed (3,4 min), 1 flaky.** O flaky é `captura com data completa e parcial no header` — passou na retentativa e passa **sozinho em 21s**, sem flaky nenhum, o que o caracteriza como a flakiness de cold-start da branch Neon `e2e` já registrada nas retros dos Épicos 4/5/11. Nenhuma correção deste review toca o caminho de captura. Os demais specs afetados não foram re-executados de propósito: nenhuma das correções altera locator, papel ou nome acessível fora deste arquivo (a troca de glifo não muda nome acessível — quem o define é o `aria-label` —, e a invalidação nova é estritamente aditiva).

### Por que "done"

Zero CRÍTICO. O único ALTO foi corrigido com teste de não-vacuidade provado por reversão cirúrgica; os três MÉDIOS foram corrigidos ou (o de anatomia) encaminhados como Questão aberta pelo próprio mecanismo que a AC5 prescreve; os BAIXOS estão registrados com o motivo de cada desfecho. As 9 ACs estão implementadas e provadas por teste executável.
