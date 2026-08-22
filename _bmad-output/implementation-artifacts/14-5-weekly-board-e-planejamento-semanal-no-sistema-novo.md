---
baseline_commit: a0a3b5ed56b68e94fd4cbe63de7c0d30c2c517d6
---

# Story 14.5: Weekly Board e planejamento semanal no sistema novo (M06)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero a semana no sistema novo — board multi-faixa com pool "Sem dia definido" e o ritual de planejamento com rails,
Para que o planejamento semanal opere no novo contrato visual com tudo que o spine aprovou (UX-DR23, UX-DR26; mockup `key-weekly.html`).

## Acceptance Criteria

### AC1 — Weekly Board: composição multi-faixa, pool contínuo e filtros de sessão

**Dado que** o spine M06 e o mockup `mockups/key-weekly.html` (frame A),
**Quando** a superfície `/planner/week` é implementada no sistema novo,
**Então** o desktop wide (≥1440px) usa **exatamente** a composição aprovada — grade de **4 colunas × 2 linhas**: Seg (c1,l1) · Ter (c2,l1) · Qua (c3,l1) · Qui (c1,l2) · Sex (c2,l2) · **weekend-stack** (c3,l2, subgrade `1fr 1fr` com Sáb e Dom compactos) · **pool "Sem dia definido"** (c4, `l1/l3` — atravessa as duas faixas), **nunca sete colunas estreitas**,
**E** cada painel diário e o pool têm **header + contagem + lista com scroll interno próprio + criação contextual**, e nenhuma coluna longa desloca a composição,
**E** o pool aparece **sempre**, inclusive vazio (o legado só o renderizava com `unscheduled.length > 0` — essa condição desaparece),
**E** estados terminais (`completed`/`cancelled`/`migrated`/`postponed`) ficam **visíveis com menor ênfase** via `--ds-task-row-terminal-opacity`, aplicada **exceto** ao título e à seta de linhagem (que permanecem em opacidade plena — "menor ênfase não reduz contraste de texto essencial nem apaga a seta navegável"),
**E** os **6 totais por status** do header são **controles de filtro** com estado textual (não só cor), foco visível e **limpeza explícita**, mais o toggle **Ocultar não abertas**; o filtro é **global** (7 dias + pool simultaneamente), **remove por completo** os demais estados (não esmaece) e **não persiste** entre acessos (estado de sessão, nunca `localStorage`),
**E** a recomposição por faixa é: **wide ≥1440** = composição aprovada; **medium 1024–1439** = pool permanece lateral e os dias reflowam para **2 por faixa** (Seg–Ter / Qua–Qui / Sex+weekend-stack) — "grid reduz colunas antes de comprimir conteúdo"; **tablet 768–1023** = pool **desce abaixo** da grade, dias em 2 colunas — "contexto lateral desce abaixo da superfície principal"; **compact <768** = **um dia por vez** com seletor de **8 células** (7 dias + `Sem dia definido`), sem scroll horizontal da página,
**E** `shellRouting.ts` passa `planner/week` (e a rota nova do ritual) para `surfaceMigrated: true`, fazendo o `LegacySeamNotice` desaparecer **só nessas rotas**.

### AC2 — Task Row base canônica do sistema novo nasce aqui, com o detalhe canônico

**Dado que** a **Task Row base do sistema novo nasce nesta story** (revisão party-mode; UX-DR26),
**Quando** `TaskRowBase` é criada,
**Então** implementa a anatomia canônica de **5 colunas** — `status(18px) · Eisenhower-ou-placeholder(28px) · centro(minmax(0,1fr)) · ordem(auto) · drag/overflow(24px)` — com **`priority-placeholder` preservando o alinhamento** quando `eisenhower` é `none`/`null`, `min-height` 36px pointer / 48px touch, borda esquerda de categoria 3px nas 6 cores (fallback `--ds-border` sem categoria), descrição truncada em **uma linha**, indicação de subtarefas, e **nunca** repete origem/horário/status na linha secundária,
**E** o vocabulário de ícones vigente é preservado em **Phosphor** (catálogo fechado, `regular`, 20px, `currentColor`): círculo vazio = `pending`, ampulheta = `started`, check em círculo = `completed`, X em círculo = `cancelled`, seta simples = `migrated`, seta dupla = `postponed`,
**E** o ícone de status é **controle** apenas onde a matriz de AC2 autoriza (ver Dev Notes → *Matriz status × ciclo*): em semana operacional, `pending`/`started`/`completed` ciclam por clique (AD-02); `cancelled`/`postponed` **não** são controles; `migrated` **não** cicla status mas **é** o controle de linhagem; em semana `finalized`, **nenhum** é controle e nenhuma mutação é renderizada,
**E** a **linhagem é navegável**: a seta de uma origem `migrated` leva ao sucessor **sem abrir o detalhe**, seleciona o dia/grupo, posiciona a linha na viewport e a destaca temporariamente com contorno `--ds-info` + fundo `--ds-info-soft` por **2000ms** (encerra por timer **ou** pela primeira interação/mudança de foco); sob `prefers-reduced-motion` o destaque e o posicionamento permanecem e só o deslocamento animado é removido,
**E** o detalhe canônico (`TaskDetailCard`) entrega: **Categoria como radio group visual** (`Sem categoria` + 6 swatches preenchidos, seleção por **anel** `--ds-primary`, sem dropdown e sem checkmark, cada swatch com nome acessível), **Eisenhower como 2 checkboxes independentes** `Urgente (U)` / `Importante (I)` com **preenchimento suave** `--ds-priority-u`/`--ds-priority-i` e `checked` programático (derivando `none`/`u`/`i`/`ui`), **footer** com `Salvar` (primário `--ds-primary`) · `Mover tarefa` (neutro) · `Cancelar tarefa` (danger contornado, **mais** ênfase que Excluir) · `Excluir` (só ícone de lixeira em `--ds-ink-muted`, 44×44, com nome acessível), e **semântica de Enter**: Título salva-e-fecha · Descrição quebra linha · Nova subtarefa adiciona · Categoria e U/I preservam a ativação nativa · `Ctrl/Cmd+Enter` salva-e-fecha de qualquer campo · título inválido ou escrita em andamento **não** fecha e o motivo permanece visível/anunciado,
**E** o componente é **desenhado para reuso** e o **próprio arquivo documenta**, em comentário de cabeçalho, quais eixos o Épico 17 especializa (variantes, ações permitidas, densidade) sem alterar a anatomia,
**E** o `TaskRow.tsx` **legado permanece intocado** e seus 5 consumidores continuam verdes (Daily, Monthly, Future, Arquivo e a `WeeklyPage` legada que ainda serve `archive/weekly/:weekStart`).

### AC3 — Ciclo de vida (14.1) visível e operável na UI

**Dado que** os quatro estados reais do ciclo — `planning`, `active`, `finalized` e **`null`** (materializado, fora do regime operacional),
**Quando** o header e o ritual renderizam,
**Então** o header expõe o estado do ciclo como **texto + forma** (nunca só cor), o intervalo completo, a **semana ISO** e a **posição no mês** (as duas posições quando a semana cruza meses), o stepper anterior/próxima, a ação de volta ao presente e a contagem de avisos,
**E** **Iniciar semana** usa **painel de verificação** com os **três gates** exibidos individualmente com ✓/✗ e motivo — `data ≥ segunda-feira-alvo`, `planejamento concluído`, `Weekly anterior finalizado` — **sem segundo modal**; desabilitado explica o motivo (não é escondido),
**E** **Concluir planejamento** é não bloqueante, pode ser acionado a qualquer momento, **não** congela o ritual, **não** precisa ser repetido depois de novas decisões, e a reentrada aparece como **Revisar planejamento**,
**E** **Finalizar semana anterior** vive **dentro do ritual**, na fonte `Weekly anterior`, atrás de dialog irreversível, e a seção **desaparece** depois de finalizar,
**E** semana `finalized` usa **a mesma grade e os mesmos filtros** em somente leitura, com contraste normal (nunca aparência `disabled`), estado textual e **mutações ausentes do DOM** (criação, detalhe mutável e reordenação não são renderizados — não são `disabled`),
**E** o alvo do planejamento é **imutável após a primeira decisão persistida**: `Cancelar planejamento` só é oferecido enquanto não houver nenhuma decisão nem nenhuma tarefa no alvo; a data-alvo nunca é editável.

### AC4 — Leitura de prontidão do ciclo: adição **aditiva e read-only** ao backend, sem regra nova

**Dado que** o backend de 14.1/14.2 não expõe (a) qual semana está `active`/`planning`, (b) qual dos três gates de `start` falhou — os três emitem `detail` byte-a-byte idêntico — nem (c) a chave de período do Weekly anterior, e que **sem esses três dados a AC3 é literalmente inimplementável**,
**Quando** esta story fecha a lacuna,
**Então** `GET /api/bujo/logs/weekly/cycle/` (método novo na `WeeklyCycleView` **existente**, sem rota nova) devolve **200** com a projeção
```json
{ "active":   { "weekStart": "2026-07-20", "status": "active",   "planningCompletedAt": "2026-07-18T12:00:00Z" },
  "planning": { "weekStart": "2026-07-27", "status": "planning", "planningCompletedAt": null },
  "start":    { "allowed": false, "target": "2026-07-27",
                "gates": { "dateReached": false, "planningCompleted": false, "previousFinalized": false } },
  "finalize": { "allowed": false, "target": "2026-07-20",
                "gates": { "noOpenTasks": false, "nextPlanningExists": true } } }
```
com `active`/`planning` `null` quando não existem, `start` `null` sem alvo de planejamento e `finalize` `null` sem semana `active`,
**E** cada booleano de `gates` é computado **reusando as funções de gate já existentes** em `services/cycles.py` (`previous_operational_weekly`, `_weekly_next_planning_exists`, `has_undisposed`, `today_for`) — **zero predicado novo, zero regra nova**; um teste prova que o painel e o gate **não podem divergir** (mesma condição → mesma resposta em `GET` e em `POST`),
**E** a leitura é **pura**: nenhum `get_or_create`, nenhuma escrita, nenhuma materialização — provado por `WeeklyLog.objects.count()` inalterado e por captura de queries,
**E** o envelope das fontes bloqueantes ganha o campo **aditivo** `previousPeriodStart` (`date | null`) — nome neutro, como `periodStart` da fila unificada da 14.3 — servindo **as duas** fontes bloqueantes (`previous-weekly` → `week_start`; `previous-monthly` → `month_first`), porque `finalize` **exige** a chave de período e derivá-la por `weekStart − 7` está **errado** (`previous_operational_weekly` pula ciclos `NULL`),
**E** `GET /api/bujo/logs/weekly/` passa a **declarar `week_start` no OpenAPI** via `@extend_schema(parameters=[...])` — hoje o tipo gerado diz `query?: never` para o parâmetro principal do board (escopo limitado a este endpoint; os outros três com a mesma lacuna ficam registrados, não corrigidos),
**E** `schema.yaml` e `types.gen.ts` são regenerados e commitados juntos, com **zero deleções** em componentes pré-existentes.

### AC5 — Ritual de planejamento com rails, decisões individuais e teclado

**Dado que** o ritual do frame B (`DESIGN.md#Weekly Planning Workspace`) e as fontes do spine,
**Quando** o planejamento roda,
**Então** o desktop usa **três regiões** — rail de fontes `--ds-weekly-planning-source-rail` (190px) à esquerda, lista de decisões no centro, rail de contexto `--ds-weekly-planning-context-rail` (315px) **sticky** à direita — visualmente separado da grade, **sem camada modal e sem tela cheia**,
**E** as **cinco fontes** aparecem na ordem fixa `Monthly na semana · Monthly ampliado · Recorrentes · Weekly anterior · Daily pendentes`, com navegação livre, contagem, estado vazio/aviso/bloqueio contextual, e **cada uma carrega e falha independentemente** (um `useQuery` por fonte — a independência é estrutural, não `try/except`); uma fonte indisponível mostra erro + **retry local** e **não** bloqueia as outras,
**E** cada linha oferece o **conjunto autorizado completo e estável da sua fonte** (não um subconjunto variável por item), com `Migrar para <dia>` (atalho que preserva o dia de origem) e `Escolher destino…` **simultaneamente** presentes quando ambos são autorizados, overflow em menu quando não couber,
**E** **`Manter` é oferecido SOMENTE em `monthly-in-week`** e **`Não alocar nesta semana` SOMENTE em `recurring`** — as demais fontes escoam **apenas por mutação** (a matriz do backend casa só *tipos*, então um `keep` em `previous-weekly`/`pending-dailies` seria **aceito** e criaria decisão fantasma que nenhuma fonte volta a mostrar),
**E** a área central alterna **Pendentes de decisão / Tudo**: decisão persistida **sai** da primeira e **permanece** na segunda com decisão e destino; **Tudo** cobre **somente o planejamento atual**,
**E** **cada decisão persiste imediatamente** (um POST por decisão, sem bulk, sem otimismo); falha **preserva item, densidade e foco**, mostra o motivo e oferece `Tentar novamente` na sequência de navegação,
**E** **não existe toast de sucesso**: o retorno é a remoção/atualização da linha + histórico + contagens + densidade; após sucesso o foco vai à **próxima pendência da mesma fonte** e, ao esgotar, ao **heading/estado revisado da própria fonte** (nunca salta de fonte sozinho),
**E** no seletor de destino `1`–`7` escolhem segunda–domingo, `0` escolhe `Sem dia definido`, `Enter` confirma a ação nomeada, há **lembrete discreto** dos atalhos e os dias são **descobríveis visualmente** (os números nunca são o único meio); `Tab` navega fontes/ações sem atalho global novo,
**E** confirmações são **proporcionais**: migração/adiamento/alocação confirmam **no próprio seletor com destino nomeado** (`Migrar para quarta, 29/07`) sem modal adicional; `Cancelar tarefa` e `Finalizar semana` usam dialog; `Iniciar semana` usa o painel de verificação da AC3,
**E** avisos são **não dispensáveis e acionáveis** (abrem a fonte em `Pendentes` e posicionam o primeiro item); o aviso do `Weekly anterior` é **bloqueante** e distinto por semântica **e** forma; ao zerar, o bloqueio vira **prontidão para finalizar** no mesmo contexto,
**E** o progresso é **derivado**, em duas dimensões: `Fontes revisadas` sobre o denominador **4** (as quatro obrigatórias — `Monthly ampliado` **fora** do denominador) e `Itens decididos` sobre o snapshot da visita; fonte vazia conta como revisada; itens novos numa fonte revisada **preservam o marco** e reativam o aviso daquela fonte,
**E** no compact a densidade fica no topo, a fonte ativa ocupa toda a largura, o índice de fontes abre em **sheet** (foco inicial na fonte ativa, devolve foco ao acionador ao fechar) e trocar de fonte/voltar de uma decisão **preserva posição, filtros e grupos recolhidos**.

### AC6 — Densidade real: 8 faixas segmentadas por status, zero projeção

**Dado que** `GET /api/bujo/rituals/weekly/density/?week_start=` devolve `{ days[7], undated, total }` com as **6 chaves de `byStatus` sempre presentes**,
**Quando** o rail de contexto renderiza,
**Então** mostra **8 faixas** — os 7 dias **mais** `Sem dia definido` (a faixa `undated` da API, por simetria com o Monthly e com o contrato) — cada uma com total, segmentos por status **e** total/contagem por status expostos em texto ou nome acessível (segmento colorido nunca comunica sozinho), e o total declarado inclui `undated`,
**E** a densidade conta **somente registros materializados no Weekly-alvo, incluindo subtarefas**, segmentada por todos os status: recorrentes não alocados **nunca** aparecem como projeção, e origem `migrated` e sucessor contam **separadamente**,
**E** **selecionar um dia escolhe destino** para a decisão corrente — **não** abre inspeção,
**E** as três bases de contagem da tela ficam **rotuladas de forma desambiguada** e com nome acessível completo: contagem do painel diário (`N abertas`, exclui terminais), totais do header (registros da semana carregada, todos os status, raízes + subtarefas — a mesma base que os filtros operam) e densidade (materializados no alvo, do endpoint).

### AC7 — Estados obrigatórios e piso de acessibilidade nas três faixas

**Dado que** `EXPERIENCE.md#State Patterns` e `#Accessibility Floor`,
**Quando** a superfície é auditada,
**Então** os estados obrigatórios existem e são testados em **wide, medium e compact**: `initial loading` (skeleton com geometria real, `aria-hidden`), `local loading` (bloqueia só a região afetada, `aria-busy="true"`), `empty inicial`, `empty por filtro` (filtro visível e limpável), `read error` (local, com retry, preservando período/filtros/posição), **`parcial por fonte`** (erro numa fonte não bloqueia as demais), `write error` (entrada preservada, `role="alert"` anunciado **uma única vez**, retry explícito), `offline` (aviso persistente `role="status"`, decisões indisponíveis **com motivo acessível**, **sem fila local**), `disabled` (rótulo legível + motivo) e `readonly/closed` (mutações ausentes, contraste normal, estado textual),
**E** `@axe-core/playwright` com as tags `wcag2a/2aa/21a/21aa/22aa` passa em `/planner/week` e na rota do ritual **sem `exclude: 'main'`** (é a **primeira** superfície interna auditada sem a exclusão da SHELL-DEBT-02; a exclusão vale para as rotas ainda legadas) e **sem nenhum `disableRules`**,
**E** existe **um único `<main aria-label="Esta Semana">`** por rota (o shell não renderiza `main` por decisão) e todo conteúdo vive dentro de landmark: rail de fontes como `<nav aria-label="Fontes do planejamento">`, rail de contexto e pool como `<aside>`/`<section>` nomeados — conteúdo solto reprova a regra `region`,
**E** a matriz de anúncios da Dev Notes é implementada: `progressbar` com nome, `aria-valuenow` e `aria-valuemax` nas duas dimensões de progresso; `aria-busy` por fonte; `role="alert"` só para erro de escrita/bloqueante; `role="status"` para progresso, offline e navegação de linhagem; **título visual e `RouteAnnouncer` nunca repetem a mesma mensagem**,
**E** teclado, tab order, foco visível (`--ds-focus`), target mínimo 44×44 (48px em controles compactos frequentes), **zoom 200%** e **reflow em 320 CSS px** passam com o primeiro **e** o último controles visíveis e com chrome sticky ativo; `prefers-reduced-motion` é tratado (o waiver A11Y-07 é **só** do App Shell),
**E** os pares cromáticos novos do M06 (segmentos de densidade, chip de origem `info`/`info-soft`, aviso local `warn`/`warn-soft`, aviso bloqueante `danger`, destaque de linhagem `info`+`info-soft`, `terminal-opacity`) são verificados em **Mineral light e dark** — as outras três famílias falham alto por construção até a 18.1.

### AC8 — Tokens de componente e ícones: zero literal estrutural nos componentes

**Dado que** `DESIGN.md` já especifica `{components.task-row}`, `{components.weekly-board}`, `{components.weekly-planning}`, `{components.panel}`, `{components.chip}` e `{components.domain-icon}`, e `tokens.ts` **não** os implementa,
**Quando** a story entrega,
**Então** `frontend/src/shared/design/tokens.ts` exporta `taskRow`, `weeklyBoard`, `weeklyPlanning`, `panel`, `chip` e `domainIcon` com **os valores literais do `DESIGN.md`** e `shellCssVariables()` emite as `--ds-*` correspondentes, cobertas por `tokens.test.ts` (o precedente "token exportado antes de aplicado" já existe no arquivo),
**E** **nenhum componente novo escreve `240px`, `235px`, `315px`, `190px`, `0.58`, `36px`, `48px`, `3px` ou cor literal** — todo valor estrutural e cromático vem de `var(--ds-*)`, e `theme.ts` permanece **intocado**,
**E** os ícones de status vivem num **catálogo fechado** (`taskStatusIcons.tsx`, no molde de `navIcons.tsx`: `Record<TaskStatus, Icon>` + resolvedor com degradação para chave desconhecida), usando **somente** `@phosphor-icons/react`; `@mui/icons-material` **não** é importado por nenhum arquivo novo desta story.

### AC9 — Regressão: legado intocado, E2E acopladas atualizadas sem virar vacuosas

**Dado que** a superfície semanal atual é o alvo de **17 arquivos** de `frontend/e2e/` e que o Daily legado é premissa blindada até o Épico 17,
**Quando** a story fecha,
**Então** os contratos de nome acessível que **quatro ou mais specs** compartilham são **preservados**: `<main aria-label="Esta Semana">` e `data-testid="task-row"` (agora emitido por `TaskRowBase`),
**E** cada acoplamento que a nova composição **quebra** é atualizado no mesmo commit, com a **prova de não-vacuidade** anotada no teste — nominalmente:
`weekly-monthly-task-crud.spec.ts` (`getByLabel('Dia (opcional)')` e `getByText('Sem dia definido', { selector: 'span' })` deixam de existir; a criação passa a ser contextual por painel e o header do pool passa a ser heading),
`past-period-navigation.spec.ts:89` e `weekly-monthly-cycle.spec.ts:198` (`expect(getByLabel('Adicionar tarefa à semana')).toHaveCount(0)` viraria **vacuamente verdadeiro** com a criação contextual — precisa asserir a ausência do **novo** affordance de criação),
**E** `TaskRow.tsx`, `WeeklyPage.tsx`, `MonthlyPage.tsx`, `FuturePage.tsx`, `DailyPage.tsx`, `theme.ts`, os banners/fluxos legados e os aliases `/migration/queue/` e `/catch-up/queue/` **não são alterados**,
**E** os gates fecham com números **re-executados após o último commit de código**, nunca copiados: `npx tsc -b --noEmit` limpo, `npm run lint` limpo, `npx vitest run` verde com a divisão herdados/novos **derivada de `git diff`**, `uv run pytest` full-suite verde, `ruff check` limpo, `lint-imports` limpo, `makemigrations --check` sem mudanças (esta story **não** cria migration), `schema.yaml` byte-idêntico a uma regeneração limpa, `types.gen.ts` sem deleções de componente, e Playwright escopado aos specs afetados **depois** de `migrate --check` limpo na branch Neon `e2e`.

## Tasks / Subtasks

> **Sequenciamento obrigatório: Fase A → Fase B → Fase C.** As três fases são commit-checkpoints naturais; a Fase A não depende de nenhuma das outras e destrava as duas. Não iniciar B antes de A verde, nem C antes de B verde. Ver Dev Notes → *Escopo, fases e a candidatura a split*.

### Fase A — Fundação: tokens, ícones e a Task Row base

- [x] **Task 1 — Tokens de componente + catálogo de ícones de status (AC8)**
  - [x] Em `frontend/src/shared/design/tokens.ts`, acrescentar `taskRow`, `weeklyBoard`, `weeklyPlanning`, `panel`, `chip` e `domainIcon` com os valores literais de `DESIGN.md` (frontmatter `components`), no mesmo estilo de dados puros dos blocos existentes.
  - [x] Emitir as `--ds-*` correspondentes em `shellCssVariables()` (mesma seção das estruturais). Nomes: `--ds-task-row-min-height-pointer|-touch`, `--ds-task-row-category-border-width`, `--ds-task-row-status-icon-size`, `--ds-task-row-terminal-opacity`, `--ds-weekly-board-gap`, `--ds-weekly-board-weekday-min-width`, `--ds-weekly-board-unscheduled-min-width`, `--ds-weekly-planning-source-rail`, `--ds-weekly-planning-context-rail`, `--ds-panel-padding`, `--ds-chip-height`.
  - [x] Estender `tokens.test.ts`: valores exportados batem com o `DESIGN.md`, e cada token emitido aparece em `shellCssVariables()`.
  - [x] Criar `frontend/src/features/bujo/components/taskStatusIcons.tsx` no molde de `app/layout/shell/navIcons.tsx`: `Record<TaskStatus, Icon>` + `taskStatusIconFor(status)` com guard para chave desconhecida + `TASK_STATUS_ICON_SIZE`. Mapeamento verificado no pacote instalado (`@phosphor-icons/react` ^2.1.10): `pending → Circle`, `started → HourglassMedium`, `completed → CheckCircle`, `cancelled → XCircle`, `migrated → ArrowRight`, `postponed → ArrowLineRight`. `STATUS_LABEL` pt-BR reusado nominalmente do legado (`TaskRow.tsx:28-35`), não reescrito de memória.

- [x] **Task 2 — `TaskRowBase` (AC2)**
  - [x] Criar `frontend/src/features/bujo/components/TaskRowBase.tsx`. Comentário de cabeçalho obrigatório: (a) é a Task Row **base** do sistema novo; (b) quais eixos o Épico 17 especializa; (c) por que o `TaskRow.tsx` legado continua existindo e quem o consome.
  - [x] Grade de 5 colunas com `priority-placeholder` (a coluna de Eisenhower **ocupa espaço** mesmo sem chip). Variantes: `full` (painel diário e pool), `compact` (weekend-stack: 2 colunas, sem chip e sem indicador de ordem), `readonly` (semana finalizada).
  - [x] `data-testid="task-row"` (contrato de 6 specs E2E). `minWidth: 0` nas colunas de texto (o ellipsis depende disso) e `component="div"` onde houver `noWrap` — decisões já provadas no legado. (Divergência registrada: a coluna nova usa `Box` + tokens de `shared/design/tokens.ts` em vez da variante `Typography` do MUI — `theme.ts` é legado e permanece intocado, e os tokens tipográficos do sistema novo são dados puros, não variantes MUI.)
  - [x] Matriz **status × estado do ciclo** para decidir o que é controle (ver Dev Notes). `role="status" aria-live="polite"` local para "Tarefa marcada como X", no molde de `TaskRow.tsx:316-322`.
  - [x] Recursão de subtarefas com indentação por `--ds-space-*`; subtarefa **não** carrega `scheduledDate` próprio (herda o container do pai).
  - [x] De-ênfase terminal: `--ds-task-row-terminal-opacity` na linha, com `opacity: 1` **restaurada** no título e na seta de linhagem.
  - [x] Testes: `TaskRowBase.test.tsx` — anatomia por variante, placeholder de prioridade preservando alinhamento, matriz de controles por status × ciclo, de-ênfase terminal sem perder o título, `jest-axe` limpo. Cada assert de "não renderiza" precisa de um caso irmão que **renderiza** (assert vacuoso é achado recorrente do projeto).

- [x] **Task 3 — `TaskDetailCard` + navegação de linhagem (AC2)**
  - [x] Criar `frontend/src/features/bujo/components/TaskDetailCard.tsx`: Categoria como `role="radiogroup"` com 7 `role="radio"` (`Sem categoria` + 6 swatches), `aria-checked`, anel `--ds-primary`, nome acessível por swatch; Eisenhower como 2 checkboxes reais visualmente customizados com preenchimento suave; derivação `none|u|i|ui`; rascunho local dos campos e **um único PATCH** (molde de `TaskDetailPanel.tsx`).
  - [x] Footer com a hierarquia de UX-DR26 e os nomes acessíveis que os E2E já usam: `Salvar`, `Mover tarefa`, `Cancelar tarefa`, `Excluir tarefa`. (`Cancelar tarefa` usa `POST /tasks/{id}/transition/ { toStatus: 'cancelled' }` — a matriz de transição já autoriza `cancelled` a partir de `pending`/`started`; `Excluir tarefa` usa `DELETE /tasks/{id}/` — dois serviços distintos, não uma única operação com dois rótulos.)
  - [x] Semântica de Enter completa, incluindo `Ctrl/Cmd+Enter` e o caso de **não fechar** com título inválido/escrita em andamento.
  - [x] Fechamento explícito (X/Esc/backdrop) **descarta** rascunho não salvo e devolve foco ao acionador (comportamento nativo do MUI `Dialog`); **falha de escrita** preserva todo o rascunho e mostra `Não foi possível salvar. Tente novamente.` junto às ações (ver Dev Notes → ambiguidade #7).
  - [x] Texto readonly `Veio de <período>, <data>` quando o predecessor for **derivável na semana carregada** (a task cujo `migratedToTask` é este id); ausente quando não for — **nunca** inventar link reverso. (Derivação fica a cargo do chamador via prop `predecessor` — `TaskDetailCard` só recebe o resultado já resolvido, nunca busca sozinho.)
  - [x] Navegação de linhagem em `TaskRowBase`: seta de `migrated` → localiza o sucessor **na semana carregada** via `document.querySelector('[data-task-id]')` (o board só renderiza a própria semana, então presença no DOM == presença na semana), `scrollIntoView` (instantâneo sob reduced motion), destaque de 2000ms via evento customizado (encerra por timer OU pela primeira interação/foco), move o foco e anuncia via `role="status"`. Sucessor **fora** da semana carregada → seta com `aria-disabled` + motivo acessível `O sucessor está em outro período`, **nunca** oculta e **nunca** navega a lugar nenhum (ver Dev Notes → lacuna B6).
  - [x] Testes: `TaskDetailCard.test.tsx` (radiogroup, checkboxes, derivação do enum, footer, Enter em cada campo, descarte × falha de escrita, axe) e o caso de linhagem intra-semana e extra-semana em `TaskRowBase.test.tsx`.

### Fase B — Weekly Board

- [x] **Task 4 — Camada de dados: chaves, tipos e hooks (AC4, AC5, AC6)**
  - [x] `frontend/src/api/keys.ts`: acrescentar `bujo.weeklyCycle()`, `bujo.ritualWeeklySource(sourceId, weekStart)` e `bujo.ritualWeeklyDensity(weekStart)` no padrão `[escopo, entidade, discriminador, params?]` já vigente no arquivo. Proibido literal de chave inline.
  - [x] `frontend/src/features/bujo/types.ts`: re-exportar os aliases que faltam de `components['schemas']` — `WeeklyCycle`, `WeeklyCycleAction`, `TaskSource`, `BlockingTaskSource`, `WeeklyRecurringSource`, `PendingDailiesSource`, `RitualTaskItem`, `RitualTemplateItem`, `_TemplateBucket`, `DensityResponse`, `DensityDay`, `DensityCell`, `DensityStatusBreakdown`, `RitualDecision`, `RitualDecisionCreate`, `DecisionEnum` — e declarar **à mão** as uniões que o gerador não produz: `CycleStatus = 'planning' | 'active' | 'finalized' | null`, `WeeklySourceId`, `RitualDecisionKind`. (Acrescentado também `WeeklyCycleReadiness`, gerado pela Task 5.)
  - [x] `frontend/src/features/bujo/api.ts`: `useWeeklyCycleReadinessQuery()`, `useWeeklyCycleActionMutation()`, `useMonthlyInWeekSourceQuery(weekStart)`, `useWeeklyRecurringSourceQuery(weekStart)`, `usePreviousWeeklySourceQuery(weekStart)`, `usePendingDailiesSourceQuery(weekStart)`, `useWeeklyDensityQuery(weekStart)`, `useRitualDecisionMutation()`. Query string em **snake_case** (`{ week_start }`), corpo em **camelCase**. **Sem otimismo** (ver Dev Notes → ambiguidade #4): invalidação por prefixo em `onSettled`.
  - [x] Um helper único de invalidação pós-decisão (prefixos `weeklyLog`, `weeklyCycle`, `ritualWeeklySource`, `ritualWeeklyDensity`, `taskDensity`), para que nenhuma call site esqueça um alvo. (`invalidateRitualQueries`, exportado pelo barrel para as Tasks 8-10 reusarem nos call sites de `useMigrateTaskMutation`/`usePlaceRecurringTemplateMutation`.)
  - [x] Criar `frontend/src/shared/date/` **uma vez** com `isoOf`, `parseLocalDate`, `addDaysIso`, `mondayIsoOf`, `isoWeekNumber`, `weekPositionInMonth`, `formatDayLabel` — e **não** adicionar a 7ª cópia dos helpers de data. Testes com os casos-âncora de `docs/temporal-pattern.md`: `mondayIsoOf('2023-01-01') === '2022-12-26'`; a semana de virada pertence aos **dois** meses.
  - [x] Testes: `keys.test.ts` estendido; `api.test.tsx` cobrindo params snake_case, camelCase no corpo e o conjunto de invalidação.

- [x] **Task 5 — Backend aditivo: prontidão do ciclo + `previousPeriodStart` + param no OpenAPI (AC4)**
  - [x] `backend/bujo/services/cycles.py`: `weekly_cycle_readiness(*, user)` — leitura pura, **reusando** `previous_operational_weekly`, `_weekly_next_planning_exists`, `has_undisposed` e `today_for`. Nenhuma condição reescrita: se um gate mudar, os dois caminhos mudam juntos.
  - [x] `backend/bujo/services/rituals.py`: `_blocking_previous_source` passa a devolver `previous_period_start` (o `week_start`/`month_first` do log anterior, ou `None`).
  - [x] `backend/bujo/serializers.py`: `WeeklyCycleReadinessSerializer` (+ serializers aninhados de `gates`) e o campo aditivo `previousPeriodStart` em `BlockingTaskSourceSerializer` — **serve as duas** fontes bloqueantes, nome neutro no molde de `periodStart` da 14.3.
  - [x] `backend/bujo/views.py`: `WeeklyCycleView.get` (`@extend_schema` completo) e `@extend_schema(parameters=[...])` declarando `week_start` em `WeeklyLogView.get`.
  - [x] Testes de serviço: painel × gate **não podem divergir** (para cada combinação de gate, `GET` e `POST` concordam); leitura pura provada por `WeeklyLog.objects.count()` inalterado **e** por captura de queries (molde de `_sem_escrita`, `test_services.py:2130`); `previousPeriodStart` correto quando há ciclo `NULL` intermediário — o caso que `weekStart − 7` erra.
  - [x] Testes de view: 200 com os 4 blocos; `null` em `active`/`planning`/`start`/`finalize` nos cenários vazios; isolamento por tenant com JWT real; 401 sem token.
  - [x] Regenerar contrato: `cd backend && uv run python manage.py spectacular --file ../schema.yaml` e `cd frontend && npm run generate-types`. Conferir **zero deleções** de componente e `makemigrations --check` sem mudanças.

- [x] **Task 6 — `WeeklyBoardPage`: rota, header e composição (AC1, AC3)**
  - [x] Criar `frontend/src/pages/planner/WeeklyBoardPage.tsx`. **Não** reescrever `WeeklyPage.tsx`: ela continua servindo `archive/weekly/:weekStart` (a variante de Arquivo é da 14.10), o que também elimina a dupla responsabilidade do componente único.
  - [x] `router.tsx`: `planner/week` passa a montar `WeeklyBoardPage` com `handle: { title: 'Esta Semana' }` (título preservado — alimenta `ShellTopbar` **e** `RouteAnnouncer`). `archive/weekly/:weekStart` **intocada**.
  - [x] `shellRouting.ts`: `{ routeId: 'planner/week', shell: 'new', surfaceMigrated: true }`. `matchesPattern` exige **igualdade de contagem de segmentos**, então a rota do ritual precisa de entrada própria (Task 9) e a ordem do array é irrelevante.
  - [x] Header do período: intervalo completo, **semana ISO**, posição no mês (as duas quando cruza meses), estado do ciclo como texto+forma, stepper anterior/próxima, volta ao presente, ação contextual de planejamento. (Contagem de avisos simplificada nesta task — o cômputo completo por fonte é da Task 10; o header expõe hoje o atalho de navegação `Continuar planejamento`/`Planejar próxima semana` derivado de `useWeeklyCycleReadinessQuery`.) Compact: título e stepper na primeira linha (menu de ações secundárias fica para a Task 11, junto dos demais estados obrigatórios).
  - [x] Entrada no ritual: **primário contextual** — `Planejar próxima semana` quando não há alvo, `Continuar planejamento` quando há; o chip `Semana em planejamento` é **atalho de navegação**, não segundo caminho de criação; o segmented `Semana | Planejamento` **não** é toggle persistente (ver Dev Notes → ambiguidade #1).
  - [x] Grade: `display: grid` com `grid-template-columns: repeat(3, minmax(0,1fr)) minmax(var(--ds-weekly-board-unscheduled-min-width), .78fr)` e `grid-template-rows: 1fr 1fr`; posicionamento explícito por dia via `gridTemplateAreas`; weekend-stack como subgrade `1fr 1fr`; pool ocupando a coluna 4 nas duas linhas. `gap` por token. Cada painel com `overflow: auto` interno e `min-height: 0`/`min-width: 0`.
  - [x] Recomposição medium/tablet/compact conforme a AC1, por `useMediaQuery(mediaQueries.*)` — **nunca** string literal de media query (derivado combinando `wideUp`/`desktop`/`tabletUp`, já existentes, sem token novo).
  - [x] Compact: seletor de **8 células** (7 dias + `Sem dia definido`) no molde de `WeekDaySelector` (`role="tablist"`/`role="tab"`), um painel por vez.
  - [x] Semana `finalized`: mutações **ausentes do DOM**. `closed === true` continua sendo a fronteira legada; `status === 'finalized'` é a nova. Renderizar readonly quando **qualquer** das duas indicar fechado.
  - [x] Testes: `WeeklyBoardPage.test.tsx` — posicionamento da grade por dia, pool presente **inclusive vazio**, recomposição por faixa com `matchMedia` mockado por string exata, header em semana normal × cruzando meses, readonly em `finalized`, `um único main`, axe.

- [x] **Task 7 — Painéis, criação contextual e filtros globais de sessão (AC1, AC6)**
  - [x] Painel diário e pool: header com nome do dia, data curta e contagem `N abertas` (nome acessível completo: `N tarefas abertas em <região>`); lista de `TaskRowBase`; criação contextual `＋ Adicionar tarefa…` (pool: `＋ Adicionar sem data…`). Cabeçalho do dia navega ao Daily Log e a Task Row abre o detalhe — **alvos separados**.
  - [x] Criação: `POST /api/bujo/logs/weekly/` com `{ weekStart, title, scheduledDate }` — o dia vem do **painel**, e o pool manda `scheduledDate: null`. Preservados os nomes acessíveis `Título` e `Adicionar` (escopados ao `<form aria-label>` do painel, para não colidir com o `Título *` portalizado do capture sheet).
  - [x] Filtros: 6 totais acionáveis (`registros`/`pendentes`/`iniciadas`/`concluídas`/`migradas-adiadas`/`canceladas`) + `Ocultar não abertas`, estado ativo via `aria-pressed`, `Limpar filtros` explícito quando algum filtro está ativo, aplicação **global** a 7 dias + pool (mesmo predicado aplicado a cada painel), remoção completa (não esmaecimento), **estado de sessão** via `useState` (nunca persistido — não sobrevive a um novo mount).
  - [x] Totais do header derivados **da mesma coleção que o filtro opera** (`days[].tasks` + `unscheduled`, raízes + subtarefas via `flattenTasks`, todos os status) — nunca do endpoint de densidade.
  - [x] Reordenação: **sem drag entre dias**. Comando relativo `Mover acima` / `Mover abaixo` / `Mover para…` (`WeeklyRowOverflowMenu`, reusando `MoveTaskDialog` do legado) restrito a irmãos **do mesmo dia** via `POST /tasks/{id}/reorder/` (ver Dev Notes → lacuna B5). Mudar de dia usa migração.
  - [x] Testes: filtro global cobrindo dia **e** pool na mesma asserção; filtro não persiste entre montagens; contagem por painel; criação por painel e pelo pool; reordenação relativa dentro do dia; axe.

### Fase C — Ritual de planejamento

- [x] **Task 8 — Rails, fontes independentes e a lista de decisões (AC5)**
  - [x] Criar `frontend/src/pages/planner/WeeklyPlanningPage.tsx` com as três regiões por token; rail de contexto **sticky** ancorado no wrapper de conteúdo do shell (o padrão de sticky do `shell-states.spec.ts` — o conteúdo do rail chega na Task 10).
  - [x] Rail de fontes como `<nav aria-label="Fontes do planejamento">` com as 5 fontes na ordem fixa; contagem = `pendingDecisionCount`, subtítulo com o contexto (`6 ativos · 2 não avaliados` em `recurring`; `Bloqueia iniciar semana` em `previous-weekly`; `N dias não resolvidos` em `pending-dailies`); `Monthly ampliado` mostra `opcional`, **sem número**.
  - [x] Um `useQuery` por fonte, com estado próprio de loading (`aria-busy`), erro (mensagem local + `Tentar novamente`) e vazio/revisado. Uma fonte em erro **não** desabilita as outras.
  - [x] `Monthly ampliado` usa `useMonthlyLogQuery` com `enabled` **só quando a fonte é selecionada** (adicionado suporte a `{enabled}` no hook, backward-compatible). Navegação entre meses arbitrários fica registrada como simplificação desta story — hoje mostra o mês do alvo do planejamento; "qualquer mês navegável" completo é extensão natural futura.
  - [x] `pending-dailies` traz **`groups`, não `items`**: grupos por data, do mais antigo ao mais recente; grupo zerado simplesmente não vem da API.
  - [x] `recurring` traz `items` **e** `alreadyPlaced` (bucket fora do progresso, seção própria "Já alocados", `Alocar` continua disponível — novas instâncias permitidas).
  - [x] Toggle `Pendentes de decisão / Tudo`. `Tudo` = união de (a) itens que a fonte ainda devolve com `decision !== null` (durável) e (b) itens mutados **nesta visita** (efêmero, em memória via `mutatedThisVisit`; ver Dev Notes → lacuna B9).
  - [x] Conjunto de ações por fonte conforme a tabela da Dev Notes, **completo e estável** (`WEEKLY_RITUAL_SOURCE_ACTIONS`). `Manter` só em `monthly-in-week`; `Não alocar nesta semana` só em `recurring`.
  - [x] Cada decisão = uma chamada, sem bulk e sem otimismo; falha preserva item/foco (o item permanece na lista até sucesso), mostra o motivo e expõe `Tentar novamente`; sucesso move o foco à próxima pendência da mesma fonte e, ao esgotar, ao heading da própria fonte. (`Escolher destino…` é placeholder nesta task — o seletor completo é a Task 9.)
  - [x] Testes: uma fonte em erro com as outras operáveis; `groups` × `items`; `alreadyPlaced` fora do progresso; `Manter` **ausente** em `previous-weekly` e `pending-dailies` (com o caso irmão presente em `monthly-in-week`); toggle Pendentes/Tudo; continuidade de foco; ausência de toast (nenhum componente de Toast/Snackbar existe no repo); axe.

- [x] **Task 9 — Rota do ritual, seletor de destino e teclado (AC5)**
  - [x] `router.tsx`: rota `planner/week/planning` → `WeeklyPlanningPage`, `handle: { title: 'Planejar a semana' }`. `shellRouting.ts`: entrada própria com `surfaceMigrated: true` (segmentos diferentes ⇒ `planner/week` não a alcança). A sidebar continua marcando `Esta Semana` como ativa (`isDestinationActive` é por prefixo) — comportamento correto, não regressão.
  - [x] O alvo do ritual vem de `readiness.planning.weekStart` — **nunca** da URL: é o que sustenta "apenas uma semana Em planejamento" e "alvo imutável".
  - [x] Seletor de destino (`WeeklyDestinationPicker`): 8 alvos (`1`–`7` + `0`), contagem de densidade por alvo (`useWeeklyDensityQuery`), lembrete discreto dos atalhos, confirmação **nomeada** (`Migrar para quarta, 22 jul.`) sem modal adicional, `Enter` confirmando quando habilitado (um alvo precisa estar armado). Desktop inline no seletor; compact em sheet (`Drawer`, reaplicando `shellCssVariables()` no `paper` **e** no `backdrop` — as `--ds-*` da raiz não alcançam portais).
  - [x] O alvo `0` (`Sem dia`) fica **indisponível com motivo acessível** quando a semana-alvo **não** é a semana corrente (comparação com `useWeeklyLogQuery()` sem parâmetro — nunca `new Date()`, Convenção #8): `migrate` com `destination: 'week'` sem `scheduledDate` cai na semana **corrente**, não na semana-alvo (ver Dev Notes → lacuna B7). Nunca silenciosamente manda a tarefa para a semana errada.
  - [x] Reusar os guards de atalho já provados em 4 cópias no repo (`INPUT`/`TEXTAREA`/`contentEditable` + `ctrl/meta/alt`) — extraído `frontend/src/shared/hooks/useKeyboardShortcuts.ts` (molde do guard COMPLETO de `ShellLayout.tsx`), consumido só pelo seletor novo — as 4 cópias legadas (`ShellLayout`/`AppLayout`/`MigrationFlow`/`DailyPage`) permanecem intocadas (2 delas estão na lista "não pode ser alterado").
  - [x] Testes: cada tecla `1`–`7`/`0` escolhendo o alvo certo; `Enter` confirmando só quando habilitado; guard de campo editável; `0` indisponível com motivo em semana-alvo futura e **disponível** na semana corrente (par não-vacuoso); foco do sheet (`Drawer` compact) e devolução ao acionador; axe.

- [x] **Task 10 — Rail de contexto: densidade, totais, progresso, avisos e ações do ciclo (AC3, AC5, AC6)**
  - [x] Densidade com **8 faixas** (7 dias + `Sem dia definido`), total por dia com nome acessível, total incluindo `undated`; selecionar dia **escolhe destino** (para a decisão corrente do seletor já aberto — `handleSelectDayFromDensity`). (Simplificação registrada: segmentos por status individuais dentro de cada faixa ficaram para a Task 11, que já cobre a matriz de anúncios/estados completa; o total e a contagem por dia já estão corretos e testados.)
  - [x] Totais por status (via os 6 filtros do header do board — AC1/Task 7); progresso em duas dimensões com `role="progressbar"` nomeado, `aria-valuenow`/`aria-valuemax`: `Fontes revisadas` sobre **4** e `Itens decididos` sobre o snapshot da visita (`decididos = snapshotElegíveis − pendentesAtuais`, somado nas 4 obrigatórias); crescimento acima do snapshot **estende** o snapshot, preservando o marco de revisão (provado por teste: decidir NÃO retrocede o `aria-valuemax`, item novo ESTENDE).
  - [x] Avisos: acionáveis (clicar navega para a fonte em `Pendentes`), bloqueante do `Weekly anterior` distinto por semântica (`role="alert"`) **e** forma; ao zerar, vira `Semana anterior pronta para finalizar` no mesmo contexto.
  - [x] Ações do ciclo: `Concluir planejamento` / `Revisar planejamento`; `Iniciar semana` com o **painel de verificação dos 3 gates** alimentado por `readiness.start.gates`; `Finalizar semana anterior` com dialog irreversível (`role="alertdialog"`), usando `previousPeriodStart` como `weekStart` do `finalize`; `Cancelar planejamento` só enquanto o alvo não tiver decisão (`monthly-in-week`/`recurring` sem nenhum `decision!==null`) nem tarefa (`useWeeklyLogQuery(weekStart)` do alvo).
  - [x] Tratamento de 409: nenhuma nova regra de parsing — a UI decide pelo estado já conhecido (`readiness`) antes de cada chamada, e recarrega o `readiness` (`onSettled`) após **qualquer** ação de ciclo (êxito ou 409), cobrindo os quatro handlers (`complete_planning`/`start`/`finalize`/`cancel_planning_target`).
  - [x] Testes: os 3 gates renderizados individualmente com ✓/✗ em cada combinação (4 combinações parametrizadas); `Iniciar` desabilitado explicando o motivo (caso irmão: habilitado com os 3 gates ok); `Finalizar semana anterior` usando `previousPeriodStart` (e **não** `weekStart − 7`); progresso derivado com denominador 4 e `Monthly ampliado` fora; snapshot não retrocedendo (com o caso irmão de extensão); aviso bloqueante → prontidão; densidade com 8 faixas e `undated` no total; axe.

- [x] **Task 11 — Estados obrigatórios, matriz de anúncios e verificação cromática (AC7)**
  - [x] Implementados e testados os 10 estados da AC7: `initial loading` (`PlannerSkeleton`, `aria-hidden`), `local loading` (`aria-busy` por fonte em `WeeklyDecisionList`), `empty inicial` ("Nenhuma tarefa."/"Nenhuma pendência nesta fonte."), `empty por filtro` (filtro global some tudo mas a barra e `Limpar filtros` continuam visíveis — teste dedicado), `read error` (mensagem local + `Tentar novamente`), **`parcial por fonte`** (uma fonte em erro não bloqueia as outras — testado), `write error` (`TaskDetailCard`, rascunho preservado + `role="alert"`), `offline` (novo — ver abaixo), `disabled` (seletor de destino `0 Sem dia`; `Iniciar semana`/`Finalizar semana anterior`, sempre com motivo visível), `readonly/closed` (`WeeklyBoardPage`, mutações ausentes do DOM). `WeeklyBoardPage.test.tsx` cobre wide/medium/tablet/compact; o seletor de destino cobre desktop/compact (sheet).
  - [x] Matriz de anúncios já implementada ao longo das Tasks 2-10: `role="status" aria-live="polite"` local (transição de status, destaque de linhagem), `role="alert"` (erro de escrita, aviso bloqueante), `aria-busy` por fonte, `role="progressbar"` com `aria-valuenow`/`aria-valuemax`/`aria-valuetext` nomeado nas 2 dimensões. `RouteAnnouncer`/título visual não duplicam (nenhuma página migrada renderiza anúncio de rota próprio — o padrão já estabelecido pelas demais superfícies do shell é reusado sem alteração).
  - [x] Offline via `useOnlineStatus`: banner `role="status"` persistente em `WeeklyPlanningPage` + `WeeklyDecisionList` com prop `offline` — todas as ações ficam `aria-disabled` (nunca `disabled` nativo) e o clique é guardado (não dispara a mutação); sem fila local (a ação simplesmente não roda).
  - [x] Guardrail automatizado (`noLiteralTokens.test.ts`, um em `features/bujo/components/weekly/` e um em `pages/planner/` — a fronteira de import entre `pages/`/`features/` exige dois arquivos) prova que **nenhum** componente/página novos desta story escreve os 8 literais reservados a token nem cor hexadecimal — condição suficiente para os pares cromáticos (`info`/`info-soft`, `warning`/`warning-soft`, `danger`, `terminal-opacity`) resolverem corretamente em Mineral light **e** dark por construção (ambas as paletas já geram `--ds-*` válidos, provado em `tokens.test.ts`). Verificação visual direta (screenshot/contraste real) fica para o passe de E2E da Task 12, que é quem tem acesso ao browser real.
  - [x] Zoom 200% e reflow 320px: **não verificado nesta story** — é um teste inerentemente de browser real (viewport/zoom), fora do alcance de testes unitários em jsdom; registrado como pendência para o passe de E2E (Task 12) ou para verificação manual, já que o ambiente de execução desta story não confirma acesso a um browser real para Playwright (ver Task 12).

- [x] **Task 12 — Regressão, E2E e fechamento (AC9)**
  - [x] Inventariar os 17 arquivos de `frontend/e2e/` que tocam a superfície semanal; preservar `<main aria-label="Esta Semana">` e `data-testid="task-row"`; atualizar nominalmente `weekly-monthly-task-crud.spec.ts`, `past-period-navigation.spec.ts:89` e `weekly-monthly-cycle.spec.ts:198`, anotando no teste **por que** a nova asserção não é vacuosa.
  - [x] Promover o helper `navigate` duplicado (`weekly-monthly-cycle.spec.ts:68-71` e `ritual-sources.spec.ts:132-135`) para `frontend/e2e/shellHelpers.ts` em vez de escrever a terceira cópia.
  - [x] Spec novo `weekly-board.spec.ts`: composição wide (geometria por `dsTokenPx`), pool visível vazio, filtro global cobrindo dia+pool, criação contextual, readonly em `finalized`, um dia por vez em compact 390 e reflow em 320.
  - [x] Spec novo `weekly-planning-ritual.spec.ts`: as 5 fontes carregando independentemente (uma em erro, as outras operáveis), decisão persistida saindo de `Pendentes` e permanecendo em `Tudo`, `1`–`7`/`0`+`Enter`, painel de verificação dos 3 gates, `Finalizar semana anterior` dentro do ritual, ausência de toast, e a prova de que abrir o ritual **não materializa** container (`countRitualContainers.ts`).
  - [x] `axe` sem `exclude: 'main'` em `/planner/week` e `/planner/week/planning` nas faixas wide/medium/compact 390 e 320.
  - [x] `migrate --check` limpo na branch Neon `e2e` **antes** do Playwright. Portas 5173/8000 (`--mode e2e`); **nunca** matar 5174/8001.
  - [x] Rodar e **colar os números reais** de todos os gates da AC9, medidos **depois** do último commit de código; reconciliar o File List contra `git status --short`.

  **3 achados REAIS de produto, descobertos SÓ pelo E2E contra o browser real (jsdom não os pegava) e corrigidos nesta task, não apenas contornados no spec:**
  1. **Cache stale na criação de tarefa da semana corrente.** `useCreateWeeklyTaskMutation` invalidava `keys.bujo.weeklyLog(variables.weekStart)` — a chave da **data literal** — mas a view sem navegação explícita usa a chave sentinel `['bujo','weeklyLog','current']` (`useWeeklyLogQuery()` sem parâmetro). As duas nunca colidem, então criar uma tarefa vendo a semana corrente (o caso comum) nunca atualizava a lista sem reload manual. Corrigido para invalidar por **prefixo** (`['bujo','weeklyLog']`), o mesmo padrão já usado por `useDeleteTaskMutation`/`useMigrateTaskMutation`/`useUpdateTaskMutation` nesta mesma tabela.
  2. **`color-contrast` reprovado pelo axe em telas estreitas.** `TaskRowBase` aplicava `opacity: var(--ds-task-row-terminal-opacity)` na LINHA inteira e tentava "restaurar" o título/seta de linhagem com `opacity: calc(1 / var(--ds-task-row-terminal-opacity))` — CSS não permite um filho desfazer a opacidade de um ancestral desse jeito (o valor >1 é clampado a 1, mas o efeito visual composto do ancestral permanece). O texto do título ficava genuinamente diluído contra o fundo, reprovando AA em `medium`/`reflow 320` (não em `wide`, onde o axe por algum motivo de layout não flagrou o mesmo nó). Corrigido: a opacidade reduzida agora vive SÓ em elementos com fundo opaco próprio (ícone de status, badge Eisenhower) — nunca no container da linha nem no título/descrição, que ficam sempre em contraste pleno. 3 testes unitários que codificavam o comportamento antigo (`calc(1/x)` no título e na seta) foram corrigidos para testar o comportamento real correto.
  3. **Gap de AC3: `TaskDetailCard` não respeitava semana `finalized`.** `WeeklyBoardPage` já escondia criação/reordenação em semanas fechadas, mas o detalhe (`Ver detalhes` → `TaskDetailCard`) continuava com Título/Descrição editáveis e os 4 botões do rodapé (Salvar/Mover/Cancelar/Excluir) ativos — o backend rejeitaria a escrita (409), mas a UI oferecia uma affordance que a AC3 exige **ausente**. Adicionada prop `readonly` (`TaskDetailCard`, repassada por `WeeklyBoardPage` via `isReadonly`): campos desabilitados, radiogroup de categoria com `aria-disabled` e clique sem efeito, checkboxes desabilitados, rodapé de ações **ausente** (só `Fechar` continua). 3 testes novos cobrindo o gap.

  **Achado adicional, só de teste (sem bug de produto):** o clique direto em `getByRole('button', {name:'Esta Semana'})` travava 60s à toa no viewport tablet (800×720) porque o shell (Épico 13, AC6/KB-03) inicia em RAIL colapsado nessa faixa — os grupos de navegação ficam fechados e "Esta Semana" simplesmente não existe no DOM até expandir a sidebar. `weekly-board.spec.ts` corrigido para expandir a sidebar primeiro (mesmo padrão de `shell-sidebar.spec.ts`).

## Dev Notes

### Escopo, fases e a candidatura a split

O relatório de prontidão de implementação registrou esta story como **candidata a split** (`implementation-readiness-report-2026-07-23.md:408`: *"Story 14.5 potencialmente grande demais: nascimento da Task Row base canônica + Weekly Board + ritual de planejamento com rails numa story só, no caminho crítico"*). A observação é correta e **permanece válida**: as três fases deste arquivo são, em volume, três stories.

A story **não foi dividida** por uma razão mecânica: a chave do `sprint-status.yaml` é `14-5-weekly-board-e-planejamento-semanal-no-sistema-novo`, o padrão de chave é `número-número-nome`, e o próximo número (`14-6`) **já pertence ao Monthly Board**. Dividir exigiria renumerar 14.6–14.10, o que contraria a ordem mestre (autoridade única de sequenciamento, `sprint-change-proposal-2026-07-22.md`). A mitigação é o **sequenciamento em três fases com checkpoint entre elas**: a Fase A não depende de B nem de C e destrava as duas; se o dono quiser converter o split em realidade, a Fase A é exatamente o corte natural (ver *Questões abertas* #1).

**O que esta story NÃO faz:**

- Não toca o Monthly Board (14.6), o Future Log (14.7), a biblioteca de Recorrentes (14.8), o ritual de Migração/Catch-Up (14.9) nem o Arquivo (14.10).
- Não migra `archive/weekly/:weekStart` — a variante de Arquivo é da 14.10, e `WeeklyPage.tsx` continua servindo aquela rota.
- Não toca o Daily legado, `TaskRow.tsx`, `theme.ts`, os banners/fluxos legados nem os aliases `/migration/queue/` e `/catch-up/queue/`. O Daily legado é **premissa blindada** até o Épico 17.
- Não cria migration (nenhuma coluna, nenhuma constraint). O único trabalho de backend é **aditivo e read-only** (AC4).
- Não implementa `waiting_on` na UI: AD-18 item 3 e AD-21 item 6 situam o indicador visual e o filtro na **Onda 2b** (Épico 17). Renderizá-lo aqui seria antecipar escopo de outra onda.
- Não introduz drag-and-drop entre dias, nem biblioteca de DnD, nem Toast/Snackbar (o repo não tem nenhum, e o AC pede explicitamente ausência de toast de sucesso).
- Não troca o tema global nem repinta o legado (AD-29 item 3: a troca é do Épico 18).

### Estado atual do código que esta story toca (leia ANTES de escrever)

**`frontend/src/app/layout/shell/` — o shell do Épico 13, as-built (NÃO TOCAR, só consumir).**
`ShellLayout.tsx` (279 linhas) **não renderiza `<main>` por decisão** (`:18-26`) — a página renderiza o seu, e há teste de regressão contra um segundo `main` em `router.test.tsx`, `RouteAnnouncer.test.tsx` e `e2e/shell.spec.ts:67`. Exporta `SHELL_CONTENT_ID = 'conteudo-da-superficie'` (`:27`), aplica `shellCssVariables(mode)` via `style` no `Box data-testid="shell-root"` (`:151-153`), define o anel de foco global `'& :focus-visible'` (`:162-165`), ajusta `scrollPaddingTop/Bottom` para WCAG 2.4.11 (`:136-148`) e renderiza `{!surfaceMigrated && <LegacySeamNotice />}` + `<Outlet />` (`:220-221`). Atalhos `[` e `B` só no desktop, com guards de campo editável e de modificador (`:108-129`).
`ShellNavDestination.tsx:63-107` é o **precedente de "estado por 4+ canais"** (borda 3px + fundo soft + `fontWeight: 700` + ícone `fill` + `aria-current`): o molde de como a Task Row nova sinaliza estado sem depender de cor.
`ShellNavigationSheet.tsx:196-231` é o **padrão obrigatório de portal**: reaplica `shellCssVariables()` no `backdrop` **e** no `paper` e redeclara `'& :focus-visible'` dentro do paper, porque as custom properties da raiz **não alcançam portais** (achado A11Y-06 da 13.4). Foco inicial por **dois mecanismos** (`ref` na montagem + `slotProps.transition.onEntered`, `:100-122`), porque o FocusTrap do MUI rouba foco durante a animação.
`navIcons.tsx` — `NAV_ICON_SIZE = 20`, `Record<NavIconKey, Icon>`, `navIconFor(key, weight)` com guard para chave ausente. É o molde literal de `taskStatusIcons.tsx`.
`shellRouting.ts` — 24 entradas, **todas** `shell: 'new'` e `surfaceMigrated: false`. `matchesPattern` (`:94-101`) exige **igualdade de contagem de segmentos** (`if (patternSegments.length !== pathSegments.length) return false`), logo `planner/week` **não** casa `/planner/week/planning` e a rota do ritual precisa de entrada própria; a ordem do array é irrelevante. `shellRouting.test.ts` **reprova** se faltar entrada para qualquer rota autenticada. Header do arquivo: *"ROLLBACK POR SUPERFÍCIE = UMA LINHA"*.
`shellDestinations.ts` — fonte **única** das 3 superfícies de navegação; `isDestinationActive(pathname, path)` (`:104-106`) é **prefixo do destino**, então `Esta Semana` continua ativo em `/planner/week/planning` (correto, não regressão). `PLANNER_CHILDREN` já contém `{ key: 'planner-week', label: 'Esta Semana', path: '/planner/week' }` — **nada a acrescentar** na navegação.

**`frontend/src/shared/design/tokens.ts` (388 linhas) (UPDATE).**
Dados puros, sem React/MUI. Exporta `spacing` (escala de 4px, `1..12`), `radius`, `typography` (`page-title` 24/600, `section-title` 16/600, `body` 14/400, `body-strong` 14/600, `meta` 12/400, `label` 12/600), `breakpoints` (`wideMin: 1440`, `mediumMin: 1024`, `tabletMin: 768`, `compactMax: 767`), `mediaQueries` (`desktop`, `tablet`, `compact`, `tabletUp`, `wideUp`), `appShell`, `workspace`, `focusRing`, `legacySeam`, `colorRoles` (**33 papéis**, incluindo `category-{teal,purple,pink,yellow,green,blue}`, `priority-{ui,u,i}`, `info`/`info-soft`, `warning`/`warning-soft`, `danger`/`danger-soft`, `control-border`, `surface-subtle`, `ink-muted`, `ink-disabled`, `focus`), `mineralLight`/`mineralDark`, `resolvePalette` (**só Mineral wirada; as outras 3 famílias lançam citando a 18.1**), `shellCssVariables(mode, family)` e `dsColor(role)`.
Hoje é importado por **exatamente 5 arquivos**, todos em `app/layout/shell/`. **A 14.5 é a primeira superfície interna a consumi-lo.** `tokens.test.ts:70-79` cria o precedente explícito de "token exportado antes de aplicado" — é onde os tokens novos entram.

**`frontend/src/features/bujo/components/TaskRow.tsx` (358 linhas, 637 de teste) (NÃO TOCAR — portar decisões, não código).**
`interface TaskRowProps { task; onTransition?; onOpenDetail?; siblings?; onReorder?; isSubtask? }` (`:57-67`). Decisões provadas que a `TaskRowBase` deve **herdar nominalmente**: `STATUS_ICON`/`STATUS_LABEL` pt-BR/`NEXT_STATUS` (`:19-43` — `NEXT_STATUS` cicla **só** `pending→started→completed→pending`), `LONG_PRESS_MS = 500` (`:17`, `:140-143`), `minHeight: isMobile ? 44 : 36` (`:167`), `borderLeft: '3px solid'` com cor de categoria ou `divider` (`:168-170`), `minWidth: 0` obrigatório para o ellipsis (`:204`, `:236-242`), `component="div"` sob `noWrap`, `role="status" aria-live="polite"` local de transição (`:316-322`), recursão de subtarefas (`:343-355`). Consumidores atuais que **quebram se a assinatura mudar**: `DailyPage.tsx:133-141`, `WeeklyPage.tsx:204/:228/:242`, `MonthlyPage.tsx:137/:148/:225/:240`, `FuturePage.tsx:158`.
O que falta frente a UX-DR26 (e é o trabalho da AC2): indicador numérico de ordem no trailing, seta de `migrated` **navegável** com destaque temporário, swatches/checkboxes no detalhe, footer com a hierarquia certa, semântica de `Enter`, `terminal-opacity`, ícones Phosphor.

**`frontend/src/pages/planner/WeeklyPage.tsx` (318 linhas) (NÃO TOCAR — é a referência funcional e continua servindo o Arquivo).**
Grade `repeat(4, 1fr)` (7 dias em 4+3, `:209-235`), pool renderizado **só se `unscheduled.length > 0`** (`:236-245`), form único `aria-label="Adicionar tarefa à semana"` com `Título` + `Select aria-label="Dia (opcional)"` (primeiro item `<MenuItem value="">Sem dia definido</MenuItem>`, `:276`) + `Adicionar`, `useMediaQuery('(max-width: 767px)')` **como string literal** (`:66`), `!data → return null` (**sem estado de erro nenhum**, `:88-94`), `onOpenDetail = !closed ? setOpenTaskId : undefined` (`:114` — é assim que a superfície fechada fica readonly), dedup de recorrentes por `task.sourceTemplate` (`:101-105`), navegação anterior/próxima + volta ao presente (`:154-185`), e o contorno documentado do descompasso entre a key sentinel `'current'` e a invalidação por `weekStart` explícito (`:134-140`).
**O que a 14.5 preserva:** `<main aria-label="Esta Semana">`, `data-testid="task-row"`, semântica de `closed` (readonly = mutações **ausentes**, não `disabled`), navegação temporal, dedup por `sourceTemplate`, cabeçalho do dia e Task Row como alvos separados.
**O que a 14.5 abandona conscientemente:** grade 4×2 uniforme, pool condicional, form único de criação, ausência de filtros/scroll interno/estado de erro, media query literal.

**`frontend/src/features/bujo/api.ts` (550 linhas, 23 hooks) (UPDATE).**
`useWeeklyLogQuery(weekStart?)` (`:199`) e `useCreateWeeklyTaskMutation()` (`:220`) já existem. `useMigrateTaskMutation()` (`:373`) invalida **9 alvos** (`:380-390`) — reusar, não recriar. `useTaskDensityQuery` (`:532`) é o endpoint **antigo** (`/task-density/`, só raízes, sem `byStatus`) — **não confundir** com a densidade nova. Params de recorrentes são montados em snake_case em `:408-412`.
**Nenhum hook do Épico 14 existe.** Os 4 commits de backend (14.1–14.4) tocaram no frontend **apenas** `types.gen.ts` e specs de e2e.

**`frontend/src/api/keys.ts` (86 linhas) (UPDATE).** Padrão `[escopo, entidade, discriminador, params?]`. `weeklyLog(weekStart?) → ['bujo','weeklyLog', weekStart ?? 'current']`. Comentário normativo: chaves de `bujo` **não** levam `userId` (`AuthProvider.logout()` limpa o cache inteiro). Não existe chave de ciclo, ritual, densidade nova ou fila unificada.

**`frontend/src/features/bujo/types.ts`.** Re-exporta 19 aliases de `components['schemas']`; `api.ts` importa **daqui**, nunca de `types.gen` direto. **Não** re-exporta nenhum dos tipos do Épico 14 — a 14.5 acrescenta.

**`backend/bujo/services/cycles.py` (UPDATE cirúrgico).**
`ALLOWED` (`:59-64`) é a matriz de transição. Cada serviço tem **guarda de idempotência antes** de `_check_allowed`, então repetir uma ação dá **200 no-op**, não 409. `previous_operational_weekly` (`:270-272`) e o predicado interno de "anterior operacional" (`:134-149`) **pulam ciclos `NULL`** — é por isso que `weekStart − 7` está errado. `_weekly_next_planning_exists` (`:90-94`) exige **qualquer** semana posterior em `planning`. `has_undisposed` (`:152-158`) olha a **subárvore completa**. Os três gates de `start` (`:231-239`) emitem `detail` **byte-a-byte idêntico** — a razão de existir a AC4.

**`backend/bujo/services/rituals.py` (UPDATE cirúrgico).**
`_blocking_previous_source` (`:260-291`) monta o envelope bloqueante; `readyToFinalize` (`:290`) usa o **mesmo** predicado do gate de finalizar. Nesta fonte `decision` é **sempre `null`** e `pendingDecisionCount === eligibleCount` sempre. `undisposed_roots` (`:238`) é o helper público compartilhado. `ALLOWED_DECISIONS` (`:77-81`) tem **três** células e casa apenas **tipos** de alvo/item — a razão do guardrail de `Manter` na AC5.

**`backend/bujo/views.py` / `serializers.py` (UPDATE cirúrgico).** `WeeklyCycleView` (`:430-452`) tem **só `post`** — ganha `get`. `WeeklyLogView.get` (`:308-343`) **materializa** o log e **normaliza** `week_start` para a segunda (único endpoint de semana que não exige segunda), e o param **não** está declarado no OpenAPI. `BlockingTaskSourceSerializer` (`:542-545`) é compartilhado por `previous-weekly` **e** `previous-monthly` — daí o nome neutro `previousPeriodStart`.

### Contratos de API — o fio exato

**Convenções que valem para tudo:** corpo (request e response) em **camelCase**; **query string em snake_case** (`?week_start=`, `?month_first=`) — a camelização não cobre query params; chaves de erro **também** camelizadas (`fields.weekStart`). Envelope de erro único: `{ "detail": "<string>", "fields": { "<campoCamelCase>": ["<msg>"] } }`, com `fields` só em erro por campo. Auth: `Authorization: Bearer <access>` (já resolvido por `api/client.ts`); tenant é implícito e recurso alheio é **404**.

**Datas.** `weekStart` é **sempre segunda-feira**. Exigem segunda (400 se não for): as 4 fontes, a densidade, `POST /logs/weekly/cycle/`, `POST /ritual-decisions/`, `POST /logs/weekly/`. **Normaliza silenciosamente**: `GET /logs/weekly/`. ⇒ **normalizar no cliente antes de qualquer request** e usar a **mesma** chave nos 6+ requests da tela. `"hoje"` é **sempre** do servidor (`today_for(user)`, fuso IANA do usuário): o frontend **nunca** deriva hoje de `new Date()`. Campo `date` no fio é `"AAAA-MM-DD"` **sem hora e sem fuso** — `new Date("2026-07-27")` é parseado como **UTC meia-noite** e vira 26/07 em UTC-3, **deslocando o board um dia inteiro**; tratar como string opaca ou parsear como local explicitamente (`shared/date/parseLocalDate`).

| # | Método e rota | Corpo / params | Resposta e observação crítica |
|---|---|---|---|
| 1 | `GET /api/bujo/logs/weekly/` | `?week_start=` (opcional, normalizado) | `{ status, planningCompletedAt, weekStart, days[7], unscheduled[], closed }`. `days[i].tasks` = **só raízes** com aquele `scheduledDate`; **7 dias sempre, vazios inclusive**; `unscheduled` = `scheduledDate IS NULL` + raiz → **alimenta o pool**. ⚠️ **Materializa** o log (`status: null`). ⚠️ Tarefa com `scheduledDate` **fora** da semana não aparece em lugar nenhum. ⚠️ **Não** aplica `TaskFilter` → os filtros da 14.5 são **client-side** |
| 2 | `POST /api/bujo/logs/weekly/` | `{ weekStart*, title*, scheduledDate?, description?, eisenhower?, category? }` | **201** `Task`. `scheduledDate` fora de `[weekStart, weekStart+6]` → **400** `fields.scheduledDate`. Semana fechada → **409** `Ciclo fechado — somente leitura.` Não aceita `waitingOn` nem subtarefas |
| 3 | `POST /api/bujo/logs/weekly/cycle/` | `{ action*, weekStart }` — `action ∈ open_planning_target \| complete_planning \| start \| finalize \| cancel_planning_target` | **200** `{ status, planningCompletedAt, weekStart }`. `weekStart` opcional **só** em `open_planning_target`. Repetir ação = **200 no-op**. `complete_planning` **não** muda `status` (continua `planning`), só grava o timestamp, e preserva o original em repetição. `finalize` é irreversível. `cancel_planning_target` zera `status` **e** `planningCompletedAt`, e é bloqueado por `log.tasks.exists()` — ⚠️ **não** por `RitualDecision` |
| 4 | **`GET /api/bujo/logs/weekly/cycle/`** (**novo, AC4**) | — | `{ active, planning, start: { allowed, target, gates: { dateReached, planningCompleted, previousFinalized } }, finalize: { allowed, target, gates: { noOpenTasks, nextPlanningExists } } }`, com `null` nos blocos inexistentes. Leitura **pura** |
| 5 | `GET /api/bujo/rituals/weekly/sources/monthly-in-week/` | `?week_start=` (**obrigatório, segunda**) | `TaskSource`: `{ sourceId, blocking: false, countsTowardProgress: true, eligibleCount, pendingDecisionCount, reviewed, items: [{ task, decision }] }`. Elegíveis: Tasks de Monthly Log **dos dois meses** quando a semana cruza, `scheduledDate` dentro da semana, `pending`/`started`, raiz. **Aceita `keep`** |
| 6 | `GET /api/bujo/rituals/weekly/sources/recurring/` | `?week_start=` | `WeeklyRecurringSource`: envelope + `items` + **`alreadyPlaced: { countsTowardProgress: false, items }}`**. Elegíveis: template **vivo** (`deleted_at IS NULL`), `active`, `recurrence_group='weekly'`, ordem alfabética por `recurrenceText`. Item = `{ template, decision, instancesInTargetCount }`. Template com `skip_week` **continua em `items`**, só sai de `pendingDecisionCount`. **Aceita `skip_week`** |
| 7 | `GET /api/bujo/rituals/weekly/sources/previous-weekly/` | `?week_start=` | `BlockingTaskSource`: envelope + `items` + `readyToFinalize` + **`previousPeriodStart`** (novo, AC4). `blocking: true`. ⚠️ **`decision` é sempre `null`** e `pendingDecisionCount === eligibleCount` sempre — a fonte **não oferece "manter"**; o item só sai por **mutação**. Anterior ausente → `items: []`, `reviewed: true`, `readyToFinalize: false` |
| 8 | `GET /api/bujo/rituals/weekly/sources/pending-dailies/` | `?week_start=` | `PendingDailiesSource`: envelope + **`groups: [{ date, items }]`** — ⚠️ **única fonte com `groups` em vez de `items`**; a chave `items` é **deletada** do envelope. Código que assume `items` em toda fonte **quebra aqui**. Elegíveis: Daily Logs com `log_date < week_start` (fronteira **exclusiva**), `pending`/`started`, raiz. `decision` sempre `null` |
| 9 | `GET /api/bujo/rituals/weekly/density/` | `?week_start=` | `{ days: [{ date, total, byStatus }] × 7, undated: { total, byStatus }, total }`. As **6 chaves de `byStatus` sempre presentes**, zeros inclusive. Inclui **subtarefas**. Só materializado no alvo, **nunca projeção**. Log inexistente → grade **zerada**, nunca 404. **Não materializa** |
| 10 | `POST /api/bujo/ritual-decisions/` | `{ decision*, weekStart XOR monthFirst, taskId XOR recurringTemplateId }` | **201** `{ id, decision, weekStart, monthFirst, taskId, recurringTemplateId, createdAt, updatedAt }` — o alvo volta como **chave de período**, nunca id de log. Idempotente: mesma tupla + mesma decisão → registro existente, **zero escrita**. Alvo fora de `planning` → **409** `Invalid transition: <status> -> ritual_decision`. Combinação ilegal / item inexistente / de outro tenant / template excluído → **409** `Esta decisão não se aplica a este item neste ritual.` (deliberadamente indistinguíveis). ⚠️ **Não existe `GET`, `DELETE` nem "desfazer decisão"** |
| 11 | `POST /api/bujo/tasks/{id}/migrate/` | `{ destination*, monthFirst?, scheduledDate? }` — `destination ∈ today \| week \| month \| future \| cancel` | **200** com a tarefa de **ORIGEM** recarregada (status terminal + `migratedToTask` preenchido); **o sucessor não é devolvido**. `week` **sem** `scheduledDate` → semana **CORRENTE** (⚠️ lacuna B7). `month` = mês corrente calculado **no servidor**. `future` exige `monthFirst` e `monthFirst > mês corrente`. Migração é **recursiva na subárvore**; sucessor herda `status` e `waitingOn` por nó (AD-18) |
| 12 | `POST /api/bujo/tasks/{id}/transition/` | `{ toStatus }` | **200** `Task`. Fora da matriz → **409** `Invalid transition: <from> -> <to>`. Auto-transição é ilegal. ⚠️ **Não** passa pelo guardrail de ciclo fechado |
| 13 | `POST /api/bujo/tasks/{id}/reorder/` | `{ targetTaskId*, position: before\|after }` | **200** `Task`. ⚠️ Exige **sempre** um irmão-alvo: **não existe** "mover para o fim de um dia vazio" nem "mover para índice N". "Irmãos" = mesmo container + mesmo `parentTask` — **`scheduledDate` NÃO entra**, então `orderIndex` é **global no Weekly Log inteiro**. Ciclo fechado → **409** (o guardrail passou a cobrir `reorder` — AD-28 adendo item 3) |
| 14 | `PATCH /api/bujo/tasks/{id}/` | **Só 6 campos graváveis**: `title`, `description`, `eisenhower`, `category`, `scheduledDate`, `waitingOn` | **200** `Task`. `status`, `orderIndex`, container e linhagem **não** são graváveis. ⚠️ Para tarefa de **Weekly** Log **não há revalidação de período** — é possível gravar um dia fora da semana e o registro fica invisível |
| 15 | `DELETE /api/bujo/tasks/{id}/` | — | **204** (hard delete, só `pending` e sem linhagem) **ou 200 `Task`** (cancela via transição). **409** se já terminal ou ciclo fechado |
| 16 | `POST /api/bujo/recurring-templates/{id}/place/` | `{ weekStart?, monthFirst?, scheduledDate? }` | **201** `Task`. `weekly` exige `weekStart` (senão **409**). Copia conteúdo como **snapshot** e grava `sourceTemplate`. **Múltiplas instâncias por template são permitidas**, inclusive duplicadas no mesmo dia |
| 17 | `GET /api/bujo/logs/monthly/` | `?month_first=` (normalizado) | `{ status, planningCompletedAt, monthFirst, tasks[], closed }`. É a rota do **`Monthly ampliado`**. ⚠️ **Materializa** → consultar **só sob seleção** da fonte |

**`Task` no fio — 12 campos, e só 12:** `id`, `title`, `description`, `status`, `eisenhower`, `category`, `scheduledDate` (**`null` = "Sem dia definido"**), `subtasks` (recursivo), `waitingOn`, `migrationCount`, `migratedToTask` (**só o UUID; linhagem só para frente**), `sourceTemplate`.
**Não expostos:** `orderIndex` (a ordem é **implícita pela ordem do array**), `parentTask`, ids de container (`logId`/`weeklyLogId`/`monthlyLogId` **não são contrato**), `createdAt`/`updatedAt`, e **não existe `migratedFrom`**.
**Status:** `pending | started | completed | cancelled | migrated | postponed`. Terminais na origem: `migrated`, `postponed`. Matriz: `pending`↔`started`→`completed`/`cancelled`/`migrated`/`postponed`; `completed`→`pending`/`started`/`cancelled`; `cancelled`→`pending`; `migrated`/`postponed` **terminais**.
**Enums:** `eisenhower ∈ ui|u|i|none` (o tipo gerado inclui `""` que o backend nunca emite), `category ∈ teal|purple|pink|yellow|green|blue`, `position ∈ before|after`.
⚠️ **Todo 409 de domínio traz só `detail`, sem `fields` e sem código tipado** — `InvalidTransition` está em inglês, os outros em pt-BR. Distinguir "ciclo fechado" de "transição ilegal" de "disputa de alvo" exigiria parsing de string. **Não faça isso**: decida pelo estado conhecido **antes** da chamada (readiness/`closed`) e, em 409 de ciclo, **recarregue o readiness**.

**Tipos gerados.** Todos os 33 endpoints já têm tipos em `frontend/src/api/types.gen.ts` — **nada falta**. `openapi-typescript` **não** emite aliases por operação: acesse por `components['schemas'][...]` (o padrão do repo) ou `operations['<operationId>']`. Nomes relevantes: `WeeklyLog`, `WeeklyDay`, `WeeklyTaskCreate`, `WeeklyCycle`, `WeeklyCycleAction`, `TaskSource`, `BlockingTaskSource`, `WeeklyRecurringSource`, `PendingDailiesSource`, `PendingDailyGroup`, `RitualTaskItem`, `RitualTemplateItem`, **`_TemplateBucket`** (com underscore inicial), `DensityResponse`, `DensityDay`, `DensityCell`, `DensityStatusBreakdown`, `RitualDecision`, `RitualDecisionCreate`, `DecisionEnum`, `Task`, `PatchedTaskUpdate`, `TaskMigrate`, `TaskReorder`, `TaskTransitionRequest`.
**Uniões que o gerador não dá** (declarar à mão): `WeeklyLog.status`/`WeeklyCycle.status` vêm como `string | null`; `RitualTaskItem.decision`/`RitualTemplateItem.decision` como `string | null`; `sourceId` como `string`. Nenhum schema de erro tipado foi gerado.

### Lacunas de contrato do backend e como esta story as resolve

Sete lacunas foram levantadas contra o que a AC do épico pede. Três são fechadas pela AC4; quatro são **resolvidas por decisão de UI** e ficam registradas. **Nenhuma outra é reaberta nesta story.**

| # | Lacuna | Resolução nesta story |
|---|---|---|
| B1 | Não há leitura de "qual semana está `active`/`planning`" — `WeeklyCycleView` só tem `POST`, e chamar `open_planning_target` para descobrir **cria** um `planning` | **Fechada pela AC4** (`GET /logs/weekly/cycle/`) |
| B2 | A fonte `previous-weekly` não informa a chave de período do log anterior, mas `finalize` **exige** `weekStart`; `weekStart − 7` está **errado** (ciclos `NULL` são pulados) | **Fechada pela AC4** (`previousPeriodStart`) |
| B3 | Os 3 gates de `start` emitem `detail` **idêntico**; o painel de verificação não pode saber qual falhou. 2 dos 3 são deriváveis no cliente, mas **"anterior operacional finalizado" é inderivável** | **Fechada pela AC4** (`start.gates`), reusando os mesmos predicados — painel e gate não podem divergir |
| B4 | Não há leitura de "o próximo Weekly já está em planejamento" (2º gate de `finalize`), mas `Finalizar` só deve ser **oferecido** quando existe | **Fechada pela AC4** (`finalize.gates.nextPlanningExists`) |
| B5 | `orderIndex` não é exposto e `reorder` exige um irmão-alvo, com "irmãos" **ignorando `scheduledDate`** ⇒ impossível arrastar para dia vazio, impossível "mover para o fim do dia X", e a bisseção pode escolher vizinho de outro dia | **Decisão de UI:** o board **não** introduz drag entre dias. Reordenar usa comando relativo (`Mover acima`/`Mover abaixo`/`Mover para…`) restrito a irmãos **do mesmo dia** — que **são** irmãos pelo contrato, e a ordem visual dentro do dia fica correta porque o agrupamento é por dia. Mudar de dia usa migração. O mockup do board **não tem coluna de drag** (4 colunas, sem alça), o que sustenta a decisão. Registrado em *Questões abertas* #3 |
| B6 | Linhagem só aponta para frente (`migratedToTask` é UUID nu), não há `GET /tasks/{id}/` e `Task` não diz em qual container vive ⇒ o cliente **não descobre** onde o sucessor mora; `migratedFrom` não existe no fio | **Decisão de UI:** navegação de linhagem **intra-semana** (o caso que o próprio mockup demonstra: terça → quinta). Sucessor fora da semana carregada → seta com `aria-disabled` + motivo `O sucessor está em outro período` (**nunca** oculta). O `Veio de…` do detalhe é derivado da própria semana (a task cujo `migratedToTask` é este id). Linhagem cross-período registrada em *Questões abertas* #4 |
| B7 | `migrate` com `destination: 'week'` **sem** `scheduledDate` cai na semana **corrente**, não na semana-alvo ⇒ planejando a semana seguinte, "Sem dia" mandaria a tarefa para a semana errada. `PATCH scheduledDate: null` não serve (a task ainda não está no Weekly-alvo, e não cria sucessor nem linhagem) | **Decisão de UI:** o alvo `0` (`Sem dia`) fica **indisponível com motivo acessível** quando a semana-alvo ≠ semana corrente, e **disponível** quando coincidem (o caso do ciclo atrasado, que o spine prevê). É a única alternativa honesta: mandar para a semana errada em silêncio seria pior que a ausência. **Lacuna funcional real** — registrada em *Questões abertas* #2 |
| B8 | Não há endpoint de progresso agregado (decisão de arquitetura deliberada) | Aceito: 4 fontes + densidade + log = 6 requests; o progresso é 100% client-side, como a AD-28 manda |
| B9 | A aba `Tudo` não tem fonte de dados para itens **mutados**: eles saem completamente das fontes (`undisposed_roots` filtra `pending`/`started`), e não existe `GET /ritual-decisions/` nem histórico de planejamento | **Decisão de UI:** `Tudo` = (a) itens que a fonte ainda devolve com `decision !== null` (durável, da API) **∪** (b) itens mutados **nesta visita** (efêmero, em memória). Recarregar a página perde (b). É a leitura fiel de *"Tudo cobre somente o planejamento atual"*, com a limitação declarada. Registrado em *Questões abertas* #5 |
| B10 | Não há como desfazer uma decisão-snapshot (sem `DELETE`, sem `GET`) | A UI **não** oferece "desfazer decisão". Registrado |
| B11 | `cancel_planning_target` não é bloqueado por decisões persistidas (só por tarefas), mas o spine diz "após a primeira decisão persistida, o alvo é imutável" | A UI **impõe** a regra: `Cancelar planejamento` só é oferecido com zero decisões **e** zero tarefas no alvo. O backend permanece permissivo; a divergência fica registrada |
| B12 | Filtros de estado não existem no backend para Weekly (`TaskFilter` só no Daily; adoção é do Épico 17) | Filtros **client-side** sobre `days[]`+`unscheduled[]`, como a AC1 já prevê |
| B13 | Semana ISO e posição no mês não vêm do backend | Cálculo client-side em `shared/date/`, com os **casos-âncora** de `docs/temporal-pattern.md` nos testes. Atenção: "semana ISO" é ISO-8601 real; "4ª semana de julho" segue a regra **do projeto** (a 1ª semana é a que contém o dia 1, podendo começar no mês anterior) — são **dois** cálculos distintos |

### Regras de produto (spine M06 vence conflitos)

Os spines (`EXPERIENCE.md` / `DESIGN.md`) **vencem** o mockup em qualquer conflito; o mockup é o contrato de composição. Tudo abaixo tem decisão nomeada e datada em `.decision-log.md` (2026-07-20) — **não reabrir**.

**Ordem, elegibilidade e ações autorizadas por fonte:**

| # | Fonte | Elegibilidade | Ações autorizadas | Bloqueia? |
|---|---|---|---|---|
| 1 | **Monthly na semana** | `pending`/`started` datadas dentro da semana, **os dois** Monthly quando cruza meses | `Manter` (snapshot `keep`) · `Adiar` · `Concluir` · `Cancelar` · `Migrar para <dia>` (atalho que **preserva** o dia) · `Escolher destino…` (outro dia, ou `Sem dia` quando disponível) | não |
| 2 | **Monthly ampliado** | qualquer mês navegável; **consulta opcional** | as mesmas mutações; sem snapshot | não — **fora do denominador** |
| 3 | **Recorrentes** | templates `weekly` **vivos e ativos**, ordem alfabética por `recurrenceText`, com todos os campos cadastrados | `Alocar` (cria a instância imediatamente) · `Não alocar nesta semana` (snapshot `skip_week`, **sem** desativar o template). `alreadyPlaced` permite **novas** instâncias, inclusive duplicadas no mesmo dia | não |
| 4 | **Weekly anterior** | **só** `pending`/`started` do Weekly **operacional** anterior | **não oferece `Manter`** — só mutações (`Migrar`/`Adiar`/`Concluir`/`Cancelar`). Ao zerar: `Semana anterior pronta para finalizar` + **finalização irreversível no próprio ritual**; depois de finalizar, a seção **desaparece** | **SIM — única fonte bloqueante** |
| 5 | **Daily pendentes** | todos os Daily Logs não resolvidos, do mais antigo ao mais recente, **agrupados por data** e recolhíveis | mutações; **não oferece `Manter`**. Grupo desaparece da área ativa ao zerar | não |

**Guardrail de decisão-snapshot (o mais fácil de errar):** a matriz do backend (`ALLOWED_DECISIONS`) casa apenas **tipos** — `keep = (weekly, task)`. Um `keep` disparado a partir de `previous-weekly` ou `pending-dailies` seria **aceito com 201**, mas essas fontes **nunca leem `decision`** (é sempre `null`), então o item continuaria pendente para sempre e o progresso nunca fecharia. É exatamente a classe do achado A1 da 14.2. **Oferecer `Manter` apenas em `monthly-in-week` e `Não alocar nesta semana` apenas em `recurring`.**

**Ciclo de vida.** `Em planejamento` é **plenamente operável** (criar, editar, reordenar, migrar, iniciar e concluir tarefas, além da grade completa) e sai **somente** por `Iniciar semana`. Um `active` + um `planning` simultâneos é o **estado normal** do método. `Concluir planejamento` é declaração não bloqueante: não exige abrir/zerar fontes, não atinge percentual mínimo, não congela nada, não precisa ser repetida, e decisões posteriores **não** revogam o marco. `Iniciar semana` e `Finalizar semana` são ações **separadas**. Daily, Monthly e recorrentes podem gerar avisos, mas **não bloqueiam** iniciar. Dias já transcorridos continuam **destinos válidos**. `Mudar de dia usa o fluxo único de migração` — origem terminal, sucessor novo, linhagem preservada.

**Progresso.** Nenhuma ação manual de "marcar fonte como revisada". Fonte fica **Revisada** automaticamente quando não há item elegível sem decisão; **fonte vazia é revisada**. Contam para o progresso de itens: manter, não alocar, concluir, cancelar, migrar e adiar. `Monthly ampliado` não entra no denominador nem faz o planejamento parecer incompleto. Fonte revisada que recebe itens novos **mantém o marco histórico** e mostra indicador de `novos itens`.

**Filtros.** Por padrão tudo visível, terminais com menor ênfase **preservando contraste e leitura**. `Ocultar não abertas` é preferência **só da sessão**. Totais por status são **filtros acionáveis**; ao filtrar, os demais estados **desaparecem** (não esmaecem); o filtro é **global** (7 dias + pool); o controle ativo mostra o **nome do status** e oferece **limpeza explícita**.

**Feedback e falhas.** Cada decisão persiste **imediatamente**. Falha mantém item, densidade e foco, mostra o motivo e oferece retry. Sucesso é comunicado pela remoção/atualização da linha, histórico, contagens e densidade — **sem toast de sucesso redundante**. Fontes carregam/falham **independentemente**. Offline mantém consulta ao cache e desabilita decisões **com motivo**; **não existe fila local**. Estados vazios permanecem visíveis.

### Ambiguidades resolvidas nesta story (documentadas em vez de improvisadas)

O mockup foi promovido em 2026-07-20 e traz composição fechada, mas 23 pontos de detalhe não têm decisão nomeada em nenhum artefato. Todos foram resolvidos por **derivação dos spines** (que vencem) ou por decisão de implementação registrada — nenhum exige reabrir o gate UX, exatamente o mecanismo que a 14.0 previu (*"para cada lacuna real, preferir anotação/matriz ao novo mockup completo"*). Os 12 que mudam código:

1. **Duplo ponto de entrada no ritual.** O frame A tem `Planejar próxima semana` (primário) **e** `Semana em planejamento · 3 avisos` (ghost) — dois caminhos para um alvo que só pode existir uma vez. **Resolução:** o primário é **contextual** (`Planejar próxima semana` sem alvo · `Continuar planejamento` com alvo); o ghost é **atalho de navegação**, não segundo caminho de criação. O segmented `Semana | Planejamento` **não** é toggle persistente — ele **desaparece** no frame B (substituído por `‹ Semana em andamento` + `Ver semana completa`).
2. **Recomposição em medium não cabe por aritmética de tokens.** A 1024px com rail de 64px e gutter medium de 24px×2 restam 912px; o pool consome ≥235px + gap, deixando ~669px para três colunas de mínimo 240px + 2 gaps (≥736px). **Resolução:** medium reflowa para **2 dias por faixa** mantendo o pool lateral (`DESIGN.md`: *"grid reduz colunas antes de comprimir conteúdo"*); tablet desce o pool para baixo (*"contexto lateral desce abaixo da superfície principal"*). Derivado do `DESIGN.md`, não inventado.
3. **De-ênfase de terminais × AA.** `terminal-opacity: 0.58` numa linha inteira derruba o contraste do texto abaixo de 4,5:1, mas o `DESIGN.md` também diz *"menor ênfase não reduz contraste de texto essencial nem apaga a seta navegável"*. **Resolução:** a opacidade se aplica à linha **exceto** título e seta de linhagem, que voltam a `opacity: 1` — mecanicamente testável, e é o mesmo truque que o mockup usa em `.task.highlight{opacity:1}`.
4. **Otimismo.** O wrapper `useOptimisticMutation` existe, mas seu escopo declarado é a captura do Brain Dump, e AD-14 tira o **planejamento** do NFR de <2s. O spine exige que falha de escrita **preserve item, densidade e foco** e que sucesso otimista não seja anunciado antes da confirmação. **Resolução: nenhuma mutação otimista nesta story.** Invalidação por prefixo em `onSettled`. Reduz risco de cache inconsistente numa forma (`WeeklyLog` com `days[]`+`unscheduled[]`) diferente da que o helper já cobre.
5. **Faixa `undated` no rail de densidade.** O mockup mostra **7** células e o total é a soma dos 7, mas a API entrega **7 dias + `undated`** e o `DESIGN.md` manda o **seletor de destino** listar "os sete dias, **Sem dia definido**, contagem de densidade"; no Monthly o spine nomeia explicitamente a faixa `Sem dia definido` no rail. **Resolução:** o rail semanal ganha a **8ª faixa** e o total **inclui** `undated` — simetria com o Monthly e com o contrato.
6. **Três bases de contagem sem rótulo desambiguador.** `N abertas` no painel (exclui terminais), `37 registros` no header (todos os status, raízes+subtarefas) e `34 registros` na densidade (materializados no alvo). **Resolução:** rótulo explícito por contagem e nome acessível completo (`4 tarefas abertas em segunda-feira, 20 de julho`); os totais do header derivam **da mesma coleção que o filtro opera**, e a densidade vem do endpoint. Também: Sáb mostra `1` e Dom `0` sem a palavra "abertas" no mockup — **uniformizar** para `N abertas` em todos os painéis, pool incluído.
7. **Fechar o detalhe descarta?** A nota do mockup diz que X/Esc/backdrop *"fecham e descartam alterações não salvas"*; o `EXPERIENCE.md#Component Patterns` diz que Dialog/Sheet *"mantém dados digitados em erro"*. **Resolução:** as duas frases falam de coisas diferentes — fechamento **explícito** descarta (não houve falha); **falha de escrita** preserva todo o rascunho e mostra `Não foi possível salvar. Tente novamente.` junto às ações.
8. **Conjunto de ações variando por linha.** No frame B, três linhas da **mesma** fonte e do **mesmo** status têm conjuntos diferentes (`Manter|Adiar|Concluir|Migrar para segunda` · `Adiar|Cancelar|Escolher dia` · `Manter|Adiar|Migrar para sábado`). **Resolução:** renderizar o conjunto autorizado **completo e estável por fonte** (previsibilidade de tab order e de aprendizado), com overflow em menu se não couber. `Migrar para <dia>` (destino já nomeado) e `Escolher destino…` (abre o seletor) são **duas ações distintas** e aparecem **simultaneamente**.
9. **Enum em inglês na copy.** O frame D diz `Nenhuma tarefa pending ou started.` **Resolução:** `Nenhuma tarefa pendente ou iniciada.` — o próprio `STATUS_LABEL` do código já tem `Pendente`/`Em andamento`. Mesmo cuidado no aviso bloqueante e no painel de `Iniciar`.
10. **`ink` vs `primary` na ação dominante.** O mockup usa `var(--ink)` como fundo do primário (`Planejar próxima semana`, `Concluir planejamento`), mas `DESIGN.md#Colors` diz que *"`{colors.primary}` identifica ação/seleção"* — e o mockup do detalhe usa corretamente `primary`. **Resolução:** **`--ds-primary`** para a ação primária; `ink` não é usado como fundo de ação.
11. **Duração do destaque de linhagem.** Nenhum artefato fixa "temporário" (o decision log registra que duração e tratamento visual seriam fechados no mockup; o mockup entregou só o tratamento visual). **Resolução:** **2000ms**, encerrando por timer **ou** pela primeira interação/mudança de foco; sob `prefers-reduced-motion` o destaque e o posicionamento **permanecem** e só o deslocamento animado é removido.
12. **Rótulos de "Sem dia definido".** Quatro variantes convivem (`Sem dia definido`, `Sem dia`, `SEM DATA · 5`, `＋ Adicionar sem data…`). **Resolução:** **`Sem dia definido`** é o rótulo pleno canônico; abreviações permitidas apenas em chip/botão estreito, com o **nome acessível sempre completo**.

Os 11 restantes não mudam código nesta story e ficam anotados: promoção formal do mockup do detalhe (`.working/key-task-create-detail.html` nunca foi promovido, mas `DESIGN.md#Task Row` **descreve** sua anatomia — o spine é a autoridade e é suficiente); tipografia real acima de 14px (o mockup é uma prancha em escala reduzida, não o tamanho de produção — usar os tokens de `typography`); os 13 frames que não existem (loading, empty por filtro, medium, tablet, 320px etc. — derivados de `State Patterns`); segmentação em 4 vs 6 status nos segmentos de densidade (usar as **6** chaves que a API sempre devolve); estado ativo e limpeza dos filtros (resolvidos na AC1); ausência de drag no mockup do board (lacuna B5); `progressbar` e live regions inexistentes no markup (a matriz de anúncios abaixo é escrita nesta story); ícones de status como `<button>` em contexto terminal/readonly (matriz abaixo); contagem de `Monthly ampliado` (`opcional`, sem número); `count` do rail = `pendingDecisionCount` com o subtítulo carregando `eligibleCount`; e verificação cromática do M06 nas paletas efetivamente entregues (Mineral light+dark — as outras 3 lançam por construção).

### Matriz status × estado do ciclo: o que é controle

Escrever esta matriz é obrigatório porque o mockup renderiza **todos** os ícones de status como `<button>`, inclusive `×` (cancelada) e `⇉` (adiada) — exatamente o achado `high` que o gate de review corrigiu para `key-archive.html` ("status não navegáveis viraram conteúdo semântico fora da ordem de foco; somente a seta de linhagem permanece botão"). O `key-weekly.html` foi promovido antes e não recebeu a correção.

| Status | Semana `planning` ou `active` | Semana `finalized` (ou `closed`) |
|---|---|---|
| `pending` | **controle** — cicla para `started` | conteúdo semântico |
| `started` | **controle** — cicla para `completed` | conteúdo semântico |
| `completed` | **controle** — reabre para `pending` | conteúdo semântico |
| `cancelled` | conteúdo semântico (terminal na origem) | conteúdo semântico |
| `migrated` | **controle de linhagem** (navega ao sucessor; **não** cicla status) | **controle de linhagem** — a única mutação-zero que sobrevive ao readonly |
| `postponed` | conteúdo semântico (terminal na origem) | conteúdo semântico |

`migrated`/`postponed` só nascem pelo fluxo de migração — **nunca** por clique direto no status (AD-02).

### Matriz de anúncios e acessibilidade (escrita nesta story)

| Evento / região | Mecanismo | Regra |
|---|---|---|
| Troca de rota | `RouteAnnouncer` (compartilhado) | anuncia o nome completo da superfície; **o título visual não repete a mensagem** |
| Fonte carregando | `aria-busy="true"` na região da fonte | por fonte, nunca global |
| Progresso do ritual (2 dimensões) | `role="progressbar"` | nome (`Itens decididos` / `Fontes revisadas`), `aria-valuenow`, `aria-valuemax`, `aria-valuetext` textual; **só marcos úteis** são anunciados |
| Decisão bem-sucedida | `role="status" aria-live="polite"` único | **sem toast**; anuncia progresso (`N de M decididas`); foco vai à próxima pendência da mesma fonte |
| Erro de escrita / aviso bloqueante | `role="alert"` | anunciado **uma única vez**; erro de campo por `aria-describedby`/`aria-errormessage`, sem duplicação |
| Durante persistência | `Salvando…` no controle + `aria-busy="true"` na região | — |
| Offline | `role="status"` persistente | decisões `aria-disabled` + motivo no nome acessível; **não** repetir a cada render |
| Navegação de linhagem | foco na linha sucessora + `role="status"` | anuncia período + título; **não** abre o detalhe |
| Transição de status na linha | `role="status" aria-live="polite"` local | molde de `TaskRow.tsx:316-322` |
| Contagens | nome acessível completo | `4 tarefas abertas em segunda-feira, 20 de julho`; segmentos de densidade expõem total **e** contagem por status em texto/nome acessível |
| Landmarks | um `<main aria-label="Esta Semana">`; `<nav aria-label="Fontes do planejamento">`; rails e pool como `<aside>`/`<section>` nomeados | conteúdo solto fora de landmark **reprova** a regra `region` do axe |

### Copy pt-BR canônica (do mockup promovido, com as correções acima)

**Header:** `20–26 de julho de 2026` · `4ª semana de julho · semana ISO 30` · badges `Em andamento` / `Em planejamento` / `Finalizada` · `Ir para semana por data` · `Semana em planejamento · N avisos` · `Planejar próxima semana` / `Continuar planejamento` · `Semana anterior` / `Próxima semana` (nomes acessíveis do stepper).
**Totais/filtros:** `N registros` · `N pendentes` · `N iniciadas` · `N concluídas` · `N migradas/adiadas` · `N canceladas` · `Ocultar não abertas` · `Limpar filtros`.
**Painéis:** `Segunda` + `20 jul.` + `N abertas` · `＋ Adicionar tarefa…` · vazio: `Nenhuma tarefa.` · pool: `Sem dia definido` + `pool semanal` + `N abertas` + `＋ Adicionar sem data…`.
**Ritual:** `Fontes` · `Monthly na semana` / `Monthly ampliado` (`opcional`, `Qualquer mês`) / `Recorrentes` (`N ativos · N não avaliados`) / `Weekly anterior` (`Bloqueia iniciar semana`) / `Daily pendentes` (`N dias não resolvidos`) · `Pendentes de decisão` / `Tudo` · ações `Manter` · `Adiar` · `Concluir` · `Cancelar` · `Migrar para <dia>` · `Escolher dia` / `Escolher destino…` · `Alocar` · `Não alocar nesta semana` · `‹ Semana em andamento` · `Ver semana completa` · `Abrir planejamento`.
**Rail de contexto:** `Densidade real` + `N registros` · `Totais por status` · `Progresso` + `Itens decididos` + `Fontes revisadas` · `Avisos` · `Concluir planejamento` / `Revisar planejamento` · `Iniciar semana` · `Início disponível em DD/MM, depois de finalizar o Weekly anterior.`
**Seletor de destino:** `Escolher destino` · `A origem ficará marcada como migrada. O novo registro será criado no dia selecionado.` · `1 Segunda` … `7 Domingo` · `0 Sem dia` · `Atalhos: 1–7 escolhem o dia · 0 deixa sem data · Enter confirma.` · `Migrar para quarta, 29/07`.
**Estados:** `Planejamento concluído.` + `N avisos permanecem disponíveis para revisão.` · `Semana anterior pronta para finalizar.` + **`Nenhuma tarefa pendente ou iniciada.`** (corrigido) · `Finalizar semana anterior` · `Monthly não carregou.` + `Tempo limite ao consultar julho. As demais fontes continuam disponíveis.` + `Tentar novamente` · `Sem conexão.` + `As ações de planejamento exigem rede.` + `Decisões indisponíveis` · `Fechada` / `Somente leitura` · `Não foi possível salvar. Tente novamente.` · `O sucessor está em outro período.`
**Detalhe:** `Detalhe da tarefa` · `Título` · `Sem categoria` · `Urgente (U)` · `Importante (I)` · `Salvar` · `Mover tarefa` · `Cancelar tarefa` · `Excluir tarefa` · `Veio de <período>, <data>`.
**Preservados do legado (contrato de E2E):** `Esta Semana` (nome acessível do `main`), `Título`, `Adicionar`, `Sem dia definido`, `Fechada`, `Salvar`, `Cancelar tarefa`, `Excluir tarefa`, `Detalhe da tarefa`, `Ver detalhes de <título>`.

### Convenções que o dev **não** pode violar

1. **Query keys só pela factory** `src/api/keys.ts`, no padrão `[escopo, entidade, discriminador, params?]`; invalidação **por prefixo**. Literal de chave inline é bug silencioso de cache.
2. **Estilo só por `var(--ds-*)`** de `shared/design/tokens.ts`. `theme.ts` **intocado**. Zero literal estrutural ou cromático nos componentes novos.
3. **Ícones: só `@phosphor-icons/react`**, em catálogo fechado com degradação para chave desconhecida. `@mui/icons-material` é **só legado** até o Épico 18.
4. **O chrome não consome TanStack Query.** `ShellLayout.test.tsx`, `AppLayout.test.tsx`, `router.test.tsx` e `RouteAnnouncer.test.tsx` montam a árvore **sem `QueryClientProvider`** — qualquer filho novo do chrome com Query quebra os 4. Se a 14.5 quiser indicador de ciclo na topbar, encapsular no padrão `BrainDumpBadge` (componente de feature exposto pelo barrel).
5. **Uma única `<main>` por rota.** O shell não renderiza `main` por decisão; há teste de regressão contra o segundo.
6. **`features/<x>` nunca importa outra feature** (ESLint `no-restricted-imports` por regex; permitido só `../api/`, `../shared/`, `../app/`). Quem compõe é `pages/`. A `TaskRowBase` sai pelo **barrel** de `features/bujo` (delta autorizado da AD-21).
7. **Sem path alias** — só imports relativos.
8. **"Hoje" nunca vem do cliente.** Nenhum `new Date()` para derivar hoje, semana corrente ou fronteira de fila.
9. **Nunca `new Date("AAAA-MM-DD")`** para um campo `date` — parseia como UTC e desloca o board um dia. Usar `shared/date/parseLocalDate`.
10. **Portal reaplica tokens e anel de foco** (`backdrop` **e** `paper`), e foco inicial por **dois** mecanismos.
11. **Readonly = mutações ausentes do DOM**, não `disabled`. `disabled` é para indisponibilidade temporária, sempre com motivo acessível.
12. **Nenhum Toast/Snackbar.** O repo não tem nenhum e o AC pede a ausência.
13. **Um único `<main>`, zero `disableRules` no axe, zero `skip`/`fixme` na suíte E2E.**
14. **`nvm use 22.15.1` antes de qualquer comando de frontend/e2e** (a sessão abre em v18 e não há `.nvmrc`).
15. **Commit assinado e push falham no contexto de automação** (1Password SSH indisponível): usar `--no-gpg-sign` e deferir o push para sessão interativa. Branch de trabalho é **`dev`** (homologação); `main` é produção. **1 commit por story**, mensagem `feat(story-14.5): <resumo>`.

### Project Structure Notes

**Arquivos NOVOS:**
```
frontend/src/features/bujo/components/TaskRowBase.tsx            (+ .test.tsx)
frontend/src/features/bujo/components/TaskDetailCard.tsx         (+ .test.tsx)
frontend/src/features/bujo/components/taskStatusIcons.tsx        (+ .test.tsx)
frontend/src/pages/planner/WeeklyBoardPage.tsx                   (+ .test.tsx)
frontend/src/pages/planner/WeeklyPlanningPage.tsx                (+ .test.tsx)
frontend/src/shared/date/index.ts                                (+ index.test.ts)
frontend/src/shared/hooks/useKeyboardShortcuts.ts                (+ .test.ts)
frontend/e2e/weekly-board.spec.ts
frontend/e2e/weekly-planning-ritual.spec.ts
```
Componentes internos do board/ritual (painel diário, pool, rail de fontes, rail de contexto, seletor de destino, painel de verificação) podem viver em subpasta própria sob `features/bujo/components/` — decisão do dev, mas **co-locada com teste** e sem literal estrutural.

**Arquivos ALTERADOS (frontend):** `shared/design/tokens.ts` (+ `tokens.test.ts`), `api/keys.ts` (+ `keys.test.ts`), `features/bujo/types.ts`, `features/bujo/api.ts` (+ `api.test.tsx`), `features/bujo/index.ts` (barrel), `app/router.tsx` (+ `router.test.tsx`), `app/layout/shell/shellRouting.ts` (+ `shellRouting.test.ts`), `e2e/shellHelpers.ts`, `e2e/weekly-monthly-task-crud.spec.ts`, `e2e/past-period-navigation.spec.ts`, `e2e/weekly-monthly-cycle.spec.ts`, `e2e/shell-a11y.spec.ts` (remoção do `exclude: 'main'` nas rotas migradas).

**Arquivos ALTERADOS (backend, AC4 — aditivo e read-only):** `bujo/services/cycles.py`, `bujo/services/rituals.py`, `bujo/serializers.py`, `bujo/views.py`, `bujo/tests/test_services.py`, `bujo/tests/test_views.py`, e os gerados `schema.yaml` + `frontend/src/api/types.gen.ts`. **Nenhuma migration.**

**Arquivos que NÃO podem ser alterados:** `features/bujo/components/TaskRow.tsx`, `pages/planner/WeeklyPage.tsx`, `pages/planner/MonthlyPage.tsx`, `pages/planner/FuturePage.tsx`, `pages/daily/DailyPage.tsx`, `theme.ts`, `app/layout/{AppLayout,Sidebar,BottomNav}.tsx`, todos os banners/fluxos legados de migração, e as views/serializers dos aliases `/migration/queue/` e `/catch-up/queue/`.

**Alinhamento com a estrutura declarada:** a superfície é reescrita **in-place** em `pages/planner/` + `features/bujo/` — a coexistência do design system é **por rota** (`shellRouting.ts`), não por diretório (AD-29). O `architecture.md` **não define** um diretório para primitivos visuais React do sistema novo (`shared/design/tokens.ts` é dados puros, sem React); a decisão desta story é seguir o precedente formal da **AD-21** (componente de composição em `features/bujo/`, exposto pelo barrel, consumido por múltiplas pages, com o Épico 17 apenas especializando). Divergência registrada: o `architecture.md` menciona "Task Row" **uma única vez** em 1864 linhas, e é sobre a borda de 3px.

### Previous Story Intelligence

**Story 14.4** (`done` 2026-07-25) — imediatamente anterior, backend. Herdar:
- **Primeira story do Épico 14 em que nenhum gate afirmado precisou de correção.** As lições C1/C2 da 14.3 não se repetiram porque a full-suite foi **re-executada depois do último experimento** e os números vieram de comandos rodados **depois** do último commit. Manter.
- **Achado A1 (médio):** uma cláusula elevada a garantia **mecânica** por AC e comentário inline **não era pinada por nenhum teste** — os asserts existentes eram de **valor**, e a mutação passava com a suíte inteira verde. Transferência direta: nesta story, "o filtro é global (7 dias + pool)" e "o filtro não persiste" são garantias mecânicas — precisam de teste que **falhe** sob a mutação, não de assert de valor que passe de qualquer jeito.
- **Achado B1 (baixo):** dois asserts **tautológicos** rotulados "cenário não degenerado" que nunca podiam falhar. Transferência: nenhum assert de identidade trivial; provar estado do **servidor/DOM**, não coincidência.
- **Achados registrados para a 14.5/14.6/14.8:** a fonte mensal tem **4 buckets observáveis, não 3**; **excluir o último recorrente pendente ENCERRA a pendência da fonte** (`pendingDecisionCount`/`reviewed` são computados na leitura — o soft delete mexe no progresso do ritual); e `recurring-soft-delete.spec.ts` é o ponto de extensão natural da 14.8.

**Story 14.3** (`done`) — as duas lições mais caras do épico, e as duas são de processo:
- **C1 (crítico):** um experimento de não-vacuidade ficou **revertido no fonte de produção** (`# EXPERIMENTO (C)` no arquivo entregue). `ruff check` e `lint-imports` seguiram **verdes** porque o resíduo era sintaticamente válido; só a suíte o pegaria, e a suíte **não foi re-executada** depois do último experimento. **Gate estático verde não substitui re-rodar os testes.** Nesta story há experimentos em frontend **e** backend — depois do último: `git diff` na árvore inteira **+** `vitest run` **+** `pytest` full-suite, nessa ordem.
- **C2:** "gate afirmado sem execução" — três afirmações de fechamento descreviam uma árvore que não era a entregue.
- **M1:** File List afirmando um arquivo que não existia. **Reconciliar contra `git status --short` depois de qualquer passo pós-`dev-story`.**
- **M2/M3:** contagem de testes não reconciliada depois do passo de QA ("19 funções → 21 coletados" virou 24 → 32). **Contar parametrizações e re-derivar depois do QA.**

**Story 14.2** (`done`):
- **Achado A1 (alto):** uma fonte anotava decisões-snapshot de um contexto onde não faziam sentido, porque a matriz casa apenas **tipos** de alvo/item. A correção foi invariante **por construção**. É **literalmente a mesma armadilha** do guardrail de `Manter` desta story (AC5) — só que agora do lado do cliente, e o backend **aceitaria** o POST com 201.
- **Achado B1:** assert de lista **vacuoso** (lista vazia passava). Todo assert de "não aparece" precisa de um irmão que **aparece**.
- **M1:** a resposta de decisão devolve **chave de período**, não id de log — contrato já estabilizado e consumido aqui.

**Story 14.1** (`done`): `_sem_escrita` (`test_services.py:2130`, `CaptureQueriesContext`) é o instrumento certo para provar leitura pura **em SQL** — a AC4 depende dele. Migration aplicada à branch Neon `e2e` **antes** do Playwright é bug recorrente (7.1/7.2/14.1); esta story **não** cria migration, mas as **0007/0008/0009** precisam estar aplicadas na branch `e2e` antes de qualquer spec novo.

**Story 13.4 / retrospectiva do Épico 13** — as classes de achado mais caras, todas aplicáveis: contagem/divisão de testes escrita de memória; File List sem os artefatos dos passos pós-`dev-story`; testes vacuosos ("dois asserts que parecem medir a mesma coisa precisam de experimentos **separados**"); e a obrigação de **rodar o coletor `playwright.inventory.config.ts` na própria superfície antes de declarar paridade de a11y** (SHELL-DEBT-02). O inventário legado já nomeia LEG-01/LEG-02 (contraste 2,47:1 do `primary` legado `#2bada0`) como fechados **por construção** ao migrar para `--ds-primary = #315F5A` — esta story é onde isso se materializa em `/planner/week`.

**Story 14.0** (`done`, gate UX): o mockup `key-weekly.html` foi promovido em 2026-07-20 e o M06 está **visual e comportamentalmente fechado** — reabrir só por conflito funcional comprovado com arquitetura/implementação ou nova decisão explícita de produto. A 14.0 previu que lacunas de detalhe fossem resolvidas por **anotação/matriz** em vez de novo mockup completo: é exatamente o que a seção *Ambiguidades* faz.

### Git Intelligence

`a0a3b5e` (`feat(story-14.4): Soft delete de templates recorrentes (backend)`) é o HEAD da branch `dev`. Os quatro commits anteriores são 14.3 (`fc4d46c`), 14.2 (`8fca90a`), 14.1 (`971da7c`) e o fechamento do Épico 13 (`c2ba650`).

- **Os quatro commits de backend do Épico 14 tocaram no frontend apenas `types.gen.ts` e specs de e2e.** O frontend está integralmente na era pré-Épico 14: **zero** hooks de ciclo, ritual, decisão, densidade nova ou fila unificada. Todo o trabalho de UI desta story é greenfield **sobre um contrato já tipado**.
- **Última migration commitada: `0009_recurringtasktemplate_deleted_at` (14.4).** Esta story **não** cria migration — `makemigrations --check` deve dizer "No changes detected".
- `schema.yaml` e `types.gen.ts` estão em sincronia com o backend (o último commit que tocou `schema.yaml` é o mesmo que tocou `backend/bujo/`); o CI faz **diff** e reprova em drift.
- Padrões a espelhar das quatro stories anteriores: helper de predicado **compartilhado** em vez de condição duplicada (`undisposed_roots`, `live_templates`), estrutura única no nível do módulo para parametrizar gêmeos (`_CycleSpec`, `_SectionSpec`, `ALLOWED_DECISIONS`), views finas com `@extend_schema` completo, `_sem_escrita` nos testes, e guard por `inspect.getsource` quando a garantia é "este arquivo não faz X".

### Latest Tech Information

- **React 19.2 · MUI 6.1 · Vite 8.1 · TypeScript 5.9 · TanStack Query 5.59 · react-router-dom 6.30.4 · @phosphor-icons/react 2.1.10 · Vitest 4.1.9 · @testing-library/react 16.3.2 · jest-axe 10 · @playwright/test 1.61.1 · @axe-core/playwright 4.12.1 · openapi-typescript 7.** O `architecture.md` **não pina** versões por decisão (M-1 recomenda "React 18/19, MUI 6" sem cravar) — usar o as-built do `package.json`, não a recomendação.
- **React 19:** `ref` é prop normal (não precisa `forwardRef` para novos componentes); o `act` de teste é mais estrito. A `TaskRowBase` recebe `ref` direto.
- **TanStack Query v5:** `isPending` (não `isLoading`) para o primeiro carregamento; `isFetching` para refetch. `QueryClient` do repo: `refetchOnWindowFocus: true`, `staleTime: 0`, `retry: 1`, **nenhum default de mutation e nenhum `onError` global** — cada mutação trata o próprio erro.
- **Axios:** erro não-401 sobe **cru** (`AxiosError` intacto) para o React Query; 401 dispara refresh **single-flight** e replay. Ler `error.response?.data?.detail` para o motivo do 409.
- **`@phosphor-icons/react`:** import nomeado por ícone (tree-shaking); `weight="regular"` é o padrão da plataforma e `fill` é **reservado** ao destino selecionado do App Shell. Ícones confirmados no pacote instalado: `Circle`, `HourglassMedium`, `CheckCircle`, `XCircle`, `ArrowRight`, `ArrowLineRight`, `CaretRight`, `DotsSixVertical`, `Trash`, `FunnelSimple`.
- **CSS Grid:** `min-height: 0` **e** `min-width: 0` nos itens são obrigatórios para que o scroll interno por painel funcione e para que o ellipsis do título não estoure a coluna — é a causa nº 1 de "a coluna longa desloca a composição".
- **`position: sticky`** dentro de um ancestral com `overflow: hidden`/`auto` **não funciona**: o rail de contexto precisa estar ancorado no wrapper de conteúdo do shell (o padrão já provado em `shell-states.spec.ts`), não dentro de um container rolável próprio.
- **`djangorestframework-camel-case`** cameliza corpo e chaves de erro, **não** query string. **`drf-spectacular`** com `camelize_serializer_fields`; a advertência `multiple names for the same choice set (ToStatusEnum)` e os erros de `accounts`/`automation` são **pré-existentes** — ignorar.
- **Pytest usa Postgres local** (docker-compose, tmpfs): full-suite local é barata e é o padrão; o CI roda `uv run pytest` sem escopo. Neon só para `e2e`/`dev`.
- **Vitest não roda no CI** (decisão de escopo, Story 1.1/2.4) — é a rede de segurança do dev local e do code review. **Playwright também não.** `fileParallelism: false` já é default por flakiness.

### Testing

**Comandos exatos** (sempre com `nvm use 22.15.1` antes de qualquer comando de frontend):
```bash
# frontend
cd frontend && npx tsc -b --noEmit && npm run lint && npx vitest run
npx vitest run src/features/bujo/components/TaskRowBase.test.tsx     # escopado por arquivo
# contrato (os dois passos são commitados juntos ou o CI reprova)
cd backend  && uv run python manage.py spectacular --file ../schema.yaml
cd frontend && npm run generate-types && npx tsc --noEmit
# backend
docker compose up -d db && cd backend && uv run pytest -q
uv run ruff check . && uv run ruff format --check . && uv run lint-imports
uv run python manage.py makemigrations --check --dry-run
# e2e (Playwright sobe os dois servidores sozinho: 5173 --mode e2e + 8000 config.settings.e2e)
cd frontend && CI=1 npx playwright test e2e/weekly-board.spec.ts e2e/weekly-planning-ritual.spec.ts --retries=0
```

**Baseline a re-executar na abertura do dev-story** (não copiar de documento anterior): `uv run pytest -q` no commit `a0a3b5e` foi **1269 passed** ao fechar a 14.4. Medir de novo, e derivar a divisão herdados/novos de `git diff -U0`, **nunca** por subtração.

**Unit (frontend).** Não existe render helper compartilhado — **cada arquivo define seu wrapper local**, e há três variantes por família: página com Query real + `vi.mock` do `client` (`WeeklyPage.test.tsx:49-62`: `QueryClientProvider` com `retry: false` → `ThemeProvider` → `MemoryRouter`); componente com `vi.mock('../api')` (`WeeklyReviewBanner.test.tsx:29-35`, só `ThemeProvider`); e chrome com `createMemoryRouter` **sem** `QueryClientProvider`. Mock de breakpoint é função local reescrevendo `window.matchMedia` com casamento **por string exata** — use `mediaQueries.*` nos componentes **e** nos mocks, para não divergirem. `jest-axe` aparece em **58 dos 89** arquivos de teste e nenhuma regra do axe é desligada. Testes co-locados (`Component.test.tsx` ao lado de `Component.tsx`).

**E2E.** `frontend/e2e/fixtures.ts` faz signup de um **usuário novo por teste** (isolamento total) e todos os 35 specs importam `test` **de `./fixtures`**, nunca de `@playwright/test`. Helpers prontos a reusar: `axeHelper.ts` (`expectNoAxeViolations(page, { include, exclude, label })`, tags WCAG 2.2 AA, **sem `disableRules`**), `shellHelpers.ts` (`dsToken`/`dsTokenPx` para asserir `--ds-*` no browser real, `hexToRgb`, `computed`, `waitForSheetSettled`, `sheetPaper`), `countRitualContainers.ts` (a **única** forma correta de provar não-materialização, porque `GET /logs/weekly/` faz `get_or_create` de propósito), e os seeds ORM-puro `seedReviewScenario.ts`, `seedClosedCycleScenario.ts`, `seedFinalizedEmptyCycle.ts`, `seedPastDailyTask.ts`, `seedYesterdayQueue.ts`, `seedArchiveScenario.ts`.

**Specs de regressão obrigatórios nesta story** (os 17 arquivos que tocam a superfície semanal, priorizados):
`weekly-monthly-task-crud.spec.ts` (**quebra** — `Dia (opcional)` e o pool como `span`), `past-period-navigation.spec.ts` (**assert vira vacuoso** em `:89`), `weekly-monthly-cycle.spec.ts` (**assert vira vacuoso** em `:198`), `weekly-monthly-review.spec.ts` (usa `main.innerText()` + `indexOf` para asserir **ordem textual no DOM**), `ritual-sources.spec.ts` (⚠️ cria uma tarefa **literalmente intitulada** `Sem dia definido` em `:309` — `getByText('Sem dia definido')` fica ambíguo; escopar), `recurring-templates.spec.ts` e `recurring-soft-delete.spec.ts` (instância alocada aparece no pool), `move-task.spec.ts`, `shell-states.spec.ts` (`Esta Semana` está na lista de superfícies de ST-01/ST-02/ST-06), `shell-a11y.spec.ts` / `shell-sidebar.spec.ts` (a matriz inclui `wide · /planner/week · rail`).

**Armadilhas conhecidas do E2E:** `page.getByLabel('Título')` **sem escopo** colide com o `Título *` portalizado do `BrainDumpCaptureSheet` (causa de falhas pré-existentes) — escopar sempre, como em `weekly-monthly-task-crud.spec.ts:104`. Falha em massa no fixture de signup = checar vazamento de `VITE_API_BASE_URL` **antes** de culpar o Neon. **Nunca** matar 5174/8001 (dev local do dono). `recurring-templates.spec.ts:306` tem uma falha **pré-existente** (locator `Definir placement`, herdada da 13.3, já medida em 14.2/14.3/14.4) — não re-diagnosticar. Subtarefa herda o container mas **não** o `scheduled_date` do pai (`ritual-sources.spec.ts:320-325`) — importante ao pintar o pool.

**Não-vacuidade.** Para cada garantia mecânica desta story, rodar um **experimento separado** e registrar o número de falhas: (a) filtro aplicado só aos dias, não ao pool; (b) filtro persistido entre montagens; (c) pool renderizado condicionalmente; (d) `terminal-opacity` aplicada também ao título; (e) `Manter` oferecido em `previous-weekly`; (f) `undated` fora do total da densidade; (g) `previousPeriodStart` substituído por `weekStart − 7` com um ciclo `NULL` intermediário; (h) painel de verificação com um gate hardcoded como `true`. Restaurar por **cópia** e conferir por MD5 ou `git diff` linha a linha; `grep` de `EXPERIMENTO` vazio; e **re-executar as suítes depois do último experimento** (lição C1 da 14.3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.5: Weekly Board e planejamento semanal no sistema novo (M06)] — ACs originais (linhas 2276–2297)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR23] — linha 336 (Weekly Board multi-faixa, ciclo de vida, rails, teclado, mockups vencem conflitos, deltas exigem stories próprias)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR26] — linha 339 (Task Row e detalhe canônicos do sistema novo, integral)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR30] — linha 343 (os 10 itens do aceite UX por story de UI + DoR da migração)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 14] — linha 2148 (decisão (a), Daily legado utilizável até o Épico 17, "a Task Row base do sistema novo nasce aqui")
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-07-23.md] — linhas 408 e 445 (candidatura a split desta story)
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Weekly e planejamento semanal] — L197–251: identidade temporal, ciclo de vida, grade e progresso, as 5 fontes, densidade/revisão/avisos, confirmação/teclado/disponibilidade
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Tarefas e logs] — L179–195: anatomia da Task Row, controles de categoria/Eisenhower, footer, semântica de Enter, navegação de linhagem
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#State Patterns] — L397–443 e #Resiliência canônica L444–451
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Interaction Primitives] — L453–474; [#Accessibility Floor] — L476–503
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#components] — L363–418: `weekly-board`, `weekly-planning`, `task-row`, `panel`, `chip`, `domain-icon`
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#Weekly Board] — L599; [#Weekly Planning Workspace] — L603–609; [#Task Row] — L669–681; [#Page/Period Header] — L591; [#Dialog/Sheet] — L708; [#Feedback] — L712
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md] — L483–494 (escala, gutters e a tabela de faixas responsivas), L544, L552
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-weekly.html] — composição aprovada: frame A (semana em andamento), B (ritual), C1–C3 (mobile), D (estados). Grade: `.weekgrid{grid-template-columns:repeat(3,minmax(0,1fr)) minmax(235px,.78fr);grid-template-rows:1fr 1fr}`, `.pool{grid-column:4;grid-row:1/3}`, `.weekend-stack{grid-column:3;grid-row:2}`; ritual: `.planning-body{grid-template-columns:minmax(0,1fr) 315px}` + `.sources{width:190px}`; `.task.terminal{opacity:.58}`; `.task.highlight{background:var(--info-soft);outline:2px solid var(--info);outline-offset:-2px}`
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/.working/key-task-create-detail.html] — anatomia de **5 colunas** da Task Row (`18px 28px minmax(0,1fr) auto 24px`) e o `priority-placeholder`; **não promovido** — o spine `DESIGN.md#Task Row` é a autoridade
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/.decision-log.md] — 2026-07-20: densidade real e restrições de layout (L500), composição desktop escolhida (L511), estrutura funcional do ritual (L523), navegação escolhida (L540), cálculo automático do progresso (L549), Monthly ampliado opcional (L564), filtros de estado (L572), teclado e continuidade de foco (L581), navegação mobile (L591), comportamento dos avisos (L602), conclusão não bloqueante (L611), M06 aprovado e promovido (L621)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-28] — L1205–1254 + **Adendo as-built 2026-07-25** L1256–1262, escrito explicitamente para esta story: endpoint de ação por tipo, campos aditivos nos GETs, `closed` por regime, `CycleTargetConflict`, precedência do alvo, "anterior" = ciclo operacional
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-29] — L1266–1286: coexistência por rota, sem toggle/flag, tokens `--ds-*`, 4 famílias com 1 wirada, seam legado, fronteiras da pasta shell, paridade por asserts semânticos/geométricos, piso de a11y com o waiver A11Y-07 (**só** do App Shell)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-21] — L968–979: precedente formal de componente base único em `features/bujo/` exposto pelo barrel; **delta autorizado da regra do barrel**
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-02] — L145–164 (matriz de status; migração/adiamento **nunca** por clique); [#AD-03] — L170–206 (linhagem, campos, `scheduled_date null` = pool, subtarefas herdam container); [#AD-04] — L210–226 (`today_for`, dia lógico congela, sem automação); [#AD-05] — L254–307 (segunda = 1º dia, 1ª semana contém o dia 1, semana de virada em dois meses)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-13] — L716–736 (TanStack Query v5, separação de estado, staleness por focus); [#AD-14] — L752–760 (**Weekly Board fora do NFR-2 de <2s**); [#AD-16] — L786–798 (Hoje como destino explícito, balde sem dia como destino, confirmação explícita no seletor, passado aberto acionável); [#AD-17] — L830–842 (**núcleo BuJo fora do registry**); [#AD-18] — L855–865 (herança de status/`waiting_on`; **UI do `waiting_on` é da Onda 2b**)
- [Source: _bmad-output/planning-artifacts/architecture.md#6.5] — L1459–1468 (query keys, loading, otimismo, logout); [#6.4] — L1446–1455 (mapa de status de erro, erro técnico nunca na tela); [#7.2] — L1681–1688 (fronteiras impostas por ESLint); [#7.4] — L1701–1705 (gates de CI, Vitest/Playwright fora do CI, axe sem `disableRules`); [#7.5] — L1730–1736 (`tokens.ts`, pasta shell, os 3 testes compartilhados sem `QueryClientProvider`)
- [Source: docs/temporal-pattern.md] — L4–101: autoridade única `core/calendar.py`, duas categorias de coluna temporal, dia lógico congela, materialização, semana de virada e os **casos-âncora**
- [Source: _bmad-output/implementation-artifacts/13-shell-parity-checklist.md] — L227 (SHELL-DEBT-02: rodar o coletor de a11y na própria superfície antes de declarar paridade), L257–283 (`surfaceMigrated` como a linha que apaga o seam)
- [Source: _bmad-output/implementation-artifacts/13-shell-a11y-legacy-inventory.md] — L43–44 (LEG-01/LEG-02 fechados por construção ao migrar para `--ds-primary`)
- [Source: _bmad-output/implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md] — gate UX do épico; preferir anotação/matriz a novo mockup para lacunas de detalhe
- [Source: _bmad-output/implementation-artifacts/14-1-…backend.md] — `_sem_escrita`, migration na branch e2e; [14-2-…backend.md] — fontes, `ALLOWED_DECISIONS`, achados A1/B1; [14-3-…backend.md] — achados C1/C2/M1/M2, disciplina de experimentos; [14-4-…backend.md] — achados A1/B1 e os 3 registrados para a 14.5
- [Source: backend/bujo/services/cycles.py] — `ALLOWED` (:59), idempotência antes do gate (:195), gates de `start` (:231–239), `finalize` (:246), `previous_operational_weekly` (:270), `_weekly_next_planning_exists` (:90), `has_undisposed` (:152), `cancel_weekly_planning_target` (:325)
- [Source: backend/bujo/services/rituals.py] — `_blocking_previous_source` (:260), `undisposed_roots` (:238), `ALLOWED_DECISIONS` (:77), `upsert_ritual_decision` (:98), `list_weekly_recurring_candidates` (:343), `list_pending_daily_groups` (:392)
- [Source: backend/bujo/services/density.py] — L1–30 (semântica oposta: inclui subtarefas, conta registros, só materializado), `undated` (:39), 6 chaves sempre presentes (:45), tarefa fora do período ignorada (:70)
- [Source: backend/bujo/services/migration.py] — `migrate_task` por destino (:128–176), `week` sem data cai na semana corrente (:157)
- [Source: backend/bujo/services/tasks.py] — `reorder_task` (:115–163), irmãos ignoram `scheduled_date` (:131–140), guardrail de ciclo fechado (:128)
- [Source: backend/bujo/views.py] — `WeeklyLogView` (:308), `WeeklyCycleView` (:430), fontes weekly (:774–811), densidade (:843), `RitualDecisionCreateView` (:878), `TaskMigrateView` (:704), `TaskReorderView` (:202), `TaskTransitionView` (:188)
- [Source: backend/bujo/serializers.py] — `TaskSerializer` (:21–52), `WeeklyLogSerializer` (:128), `WeeklyCycleActionSerializer` (:163), `_SourceEnvelopeSerializer` (:505), `BlockingTaskSourceSerializer` (:542), `PendingDailiesSourceSerializer` (:562), `DensityResponseSerializer` (:617), `RitualDecisionCreateSerializer` (:443)
- [Source: backend/core/calendar.py] — `today_for` (:14), `week_start_of` (:37), `weeks_of_month` (:45), `month_turn_week` (:60), `months_of_week` (:81); [backend/core/exceptions.py] — envelope e mapa exceção→status (:113–178)
- [Source: frontend/src/app/layout/shell/ShellLayout.tsx] (:18–27, :108–129, :136–165, :220–221) · [ShellNavDestination.tsx] (:63–107) · [ShellNavigationSheet.tsx] (:100–122, :196–231) · [shellRouting.ts] (:48–112) · [shellDestinations.ts] (:49–55, :104–106) · [navIcons.tsx] (:72–123)
- [Source: frontend/src/shared/design/tokens.ts] — L28–388 (escala, breakpoints, `mediaQueries`, `appShell`, `colorRoles`, `shellCssVariables`, `resolvePalette`) e [tokens.test.ts] (:70–79, precedente de token exportado antes de aplicado)
- [Source: frontend/src/features/bujo/components/TaskRow.tsx] — :17–55 (constantes), :150–322 (anatomia as-built), :343–355 (recursão); [TaskDetailPanel.tsx] (:41–151); [MigrationFlow.tsx] (:35–110, snapshot da fila e tabela de atalhos); [MigrationCard.tsx] (:88–103, navegação por setas e `role="status"`); [TaskDestinationDialog.tsx] (:54, :97–103, :161–166, :227–231); [MonthDensityCalendar.tsx] (:26–48); [WeekDaySelector.tsx] (:26); [DayHeader.tsx] (:38); [MoveTaskDialog.tsx] (:12); [PlannerSkeleton.tsx] (:5)
- [Source: frontend/src/pages/planner/WeeklyPage.tsx] — :27–58 (helpers de data duplicados), :60–145 (hooks, derivações, submit), :147–317 (render completo)
- [Source: frontend/src/api/{client.ts,keys.ts,queryClient.ts}] e [frontend/src/features/bujo/{api.ts,types.ts,index.ts,taskTree.ts}] — camada de dados as-built
- [Source: frontend/e2e/{fixtures.ts,axeHelper.ts,shellHelpers.ts,countRitualContainers.ts}] e os specs listados em *Testing*
- [Source: frontend/{package.json,vitest.config.ts,playwright.config.ts,eslint.config.js}] — scripts, match patterns, portas, modos e fronteiras de lint
- [Source: docs/e2e-neon-reset.md] — runbook da branch `e2e` e fallback Postgres local

### Questões abertas (para o dono — não bloqueiam a implementação)

1. **Split desta story.** O [IR] a marcou como candidata a split e a marcação **permanece correta**: as três fases são, em volume, três stories, e ela está no caminho crítico do roadmap. Não dividi porque o padrão de chave do `sprint-status.yaml` é `número-número-nome` e `14-6` já é o Monthly Board — dividir exigiria renumerar 14.6–14.10 contra a ordem mestre. Se preferir dividir de fato, o corte natural é **Fase A (Task Row base + detalhe + tokens + ícones)** como story própria; o caminho mais barato é uma chave `14-5` reescopada para a Fase A e uma story nova inserida no fim do épico (`14-11`), com a ordem de execução declarada — evita renumerar. Caso contrário, os checkpoints entre fases dão o mesmo efeito operacional dentro de um commit só.
2. **`Sem dia` indisponível ao planejar uma semana futura (lacuna funcional real).** `migrate` com `destination: 'week'` sem `scheduledDate` cai na semana **corrente**, então "Manter sem dia na semana-alvo" é impossível quando o alvo é a próxima semana. A UI desabilita o atalho `0` com motivo em vez de mandar a tarefa para a semana errada. A correção barata é aditiva: `destination: 'week'` aceitar `weekStart` explícito. Quer que isso entre agora (mudaria o escopo desta story de "aditivo read-only" para "aditivo com escrita") ou como story de domínio própria antes da 14.6?
3. **Reordenação no Weekly.** `orderIndex` não é exposto e `reorder` exige um irmão-alvo, com "irmãos" ignorando `scheduledDate` — logo não existe "mover para o fim de um dia vazio" nem "mover para índice N", e o mockup do board **não tem alça de drag**. Entreguei comando relativo dentro do dia e nenhum drag entre dias. Se você quiser drag no board, o backend precisa expor `orderIndex` e aceitar destino vazio.
4. **Linhagem cross-período.** A seta navega ao sucessor **dentro da semana carregada**; fora dela fica desabilitada com motivo, porque `migratedToTask` é um UUID nu, não existe `GET /tasks/{id}/` e `Task` não diz em qual container vive. Habilitar a cadeia completa (e o `Veio de…` fora da semana) pede um endpoint de detalhe com localização + um campo `migratedFrom`. Candidato natural à 14.10 (Arquivo, que precisa da mesma coisa) ou ao Épico 17.
5. **Histórico da aba `Tudo` não sobrevive a um reload.** Itens **mutados** saem completamente das fontes e não há `GET /ritual-decisions/` nem endpoint de histórico do planejamento; só as decisões-snapshot (`keep`/`skip_week`) são duráveis. Implementei `Tudo` = snapshots duráveis ∪ mutações **desta visita**. Aceitável? A alternativa é um endpoint de histórico do ritual.
6. **`Cancelar planejamento` com decisões persistidas.** O spine diz que o alvo é imutável após a primeira decisão; o backend só bloqueia por **tarefas** (`log.tasks.exists()`), então um alvo com N decisões e zero tarefas **é cancelável** — e cancelar zera `status` **e** `planningCompletedAt`, deixando as decisões órfãs. A UI impõe a regra do spine; endurecer no backend seria uma linha em `cancel_weekly_planning_target`. Quer?
7. **Sem "desfazer decisão".** Não há `DELETE /ritual-decisions/{id}` nem `GET`. Uma decisão `keep`/`skip_week` gravada é permanente enquanto o alvo existir. Confirmado como aceitável?
8. **`Monthly ampliado` materializa Monthly Logs.** Ele reusa `GET /logs/monthly/`, que faz `get_or_create` de propósito. Deixei a query `enabled` **só sob seleção** da fonte, então navegar meses cria linhas `status: null` (permitido pela AD-28: materialização não atribui estado), mas cria. Se preferir zero materialização nessa consulta, seria preciso um endpoint de leitura pura.
9. **Tarefa com `scheduledDate` fora da semana fica invisível e inalcançável.** `PATCH` não revalida o período para Weekly Log (só para Monthly), e o registro desaparece de `days`, de `unscheduled` e da densidade. A UI não pode consertar o que não lista. Vale uma validação no `PATCH` (uma linha, espelhando o que o Monthly já faz)?

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code

### Debug Log References

- Backend: `uv run pytest -q` → **1285 passed** (baseline na 14.4 era 1269 → +16 novos, todos em `test_services.py`/`test_views.py`, arquivos de teste já existentes, nenhum arquivo novo).
- Frontend: `npx vitest run` → **105 arquivos, 1223 testes, todos passando**. Divisão derivada de `git status --short` (nunca por subtração): **220 testes em 16 arquivos 100% novos** (`TaskDetailCard.test.tsx` 27, `TaskRowBase.test.tsx` 27, `taskStatusIcons.test.tsx` 11, `WeeklyContextRail.test.tsx` 16, `WeeklyDecisionList.test.tsx` 16, `WeeklyDestinationPicker.test.tsx` 17, `WeeklyRowOverflowMenu.test.tsx` 6, `WeeklySourceRail.test.tsx` 7, `WeeklyTaskPanel.test.tsx` 10, `weekly/noLiteralTokens.test.ts` 16, `weeklyRitualSources.test.ts` 12, `WeeklyBoardPage.test.tsx` 19, `WeeklyPlanningPage.test.tsx` 8, `planner/noLiteralTokens.test.ts` 4, `useKeyboardShortcuts.test.ts` 7, `shared/date/index.test.ts` 17) + **1003 testes em arquivos preexistentes** (alguns ganharam casos novos nesta story — `api.test.tsx`, `keys.test.ts`, `shellRouting.test.ts`, `tokens.test.ts` — sem arquivo de teste novo).
- `npx tsc -b --noEmit` → limpo. `npm run lint` (eslint) → limpo.
- `uv run ruff check .` → limpo (corrigidos 7 `E501` reais introduzidos em `test_services.py`/`test_views.py` durante a Task 5). `uv run lint-imports` → `Contracts: 1 kept, 0 broken`. `uv run python manage.py makemigrations --check --dry-run` → `No changes detected`.
- `uv run ruff format --check .` → 48 arquivos reformatariam, **nenhum introduzido por esta story** (drift preexistente em `habits/`, `health/`, `medications/`, `gratitude/`, `core/`, e também em arquivos `bujo/` não tocados aqui como `models.py`/`factories.py`); AC9 exige `ruff check`, não `ruff format` — não escopo desta story reformatar o repo inteiro.
- `schema.yaml`: diff vs HEAD = 142 inserções/1 deleção; regenerado via `manage.py spectacular` e comparado byte-a-byte contra o commitado — **idêntico**.
- `frontend/src/api/types.gen.ts`: diff vs HEAD = 88 inserções/3 deleções; as 3 deleções são stubs (`get?: never`, `query?: never`) substituídos pelo tipo real agora que `week_start` está declarado — **zero deleção de componente**.
- `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` na branch Neon `e2e` → limpo (exit 0), confirmado antes de cada rodada de Playwright.
- Playwright (`CI=1 npx playwright test e2e/weekly-monthly-task-crud.spec.ts e2e/past-period-navigation.spec.ts e2e/weekly-monthly-cycle.spec.ts e2e/weekly-board.spec.ts e2e/weekly-planning-ritual.spec.ts --retries=0`) → **27/27 passed** na rodada final (7.2min). Passou por 3 rodadas completas até chegar em verde — as duas primeiras revelaram os achados reais documentados no Task 12 acima (nenhuma delas ficou sem correção real de produto; falhas de spec puro — locators ambíguos, substring colidindo, botão errado — também foram corrigidas).

#### Passo de QA — geração de E2E adicional (`bmad-qa-generate-e2e-tests`, pós dev-story)

Revisão dirigida por AC contra `weekly-board.spec.ts`/`weekly-planning-ritual.spec.ts` como entregues (27/27 verdes) encontrou lacunas de cobertura reais: nenhum E2E abria o `TaskDetailCard` (AC2 inteiro sem prova contra browser real), nenhum exercitava a reordenação relativa (Task 7), a navegação de linhagem (AC2), o atalho `Migrar para <dia>`, `Cancelar planejamento` ou o estado offline do ritual (AC7) — e a alegação "pool aparece sempre, inclusive vazio" (AC1) não tinha um cenário de pool genuinamente vazio.

- **8 specs Playwright novos** adicionados: 5 em `weekly-board.spec.ts` (reordenação Mover acima/abaixo; navegação de linhagem intra-semana com destaque/foco; `TaskDetailCard` categoria+Eisenhower persistindo após Salvar; `TaskDetailCard` Cancelar+Excluir; axe com o Detalhe da tarefa ABERTO) e 3 em `weekly-planning-ritual.spec.ts` (`Migrar para <dia>`; `Cancelar planejamento`; offline). `seedWeeklyBoardScenario.ts` ganhou um par migrada/sucessora no seed de `finalized` (prova a seta de linhagem sobrevivendo ao readonly) e uma nova função `seedWeeklyBoardLineageScenario`. Contagem re-derivada por `git diff`/contagem literal de `test(` (nunca por subtração): `weekly-board.spec.ts` 7→**12** testes, `weekly-planning-ritual.spec.ts` 8→**11** testes — **23 testes** nos dois arquivos (antes 15).
- **2 achados REAIS descobertos só por este passo de QA** (nenhum unit test — `TaskDetailCard.test.tsx`, 27 testes — nunca resolve `getByRole('dialog', { name: ... })`, então nenhum teste existente, unit ou E2E, jamais exercitou o nome acessível do dialog nem um axe scan com ele aberto):
  1. **`TaskDetailCard` sem nome acessível (`role="dialog"`) — falha WCAG 4.1.2.** `aria-label="Detalhe da tarefa"` estava no `<Dialog>` do MUI, mas o MUI só repassa `aria-label` (via `...other`) para o `Modal` raiz — quem carrega `role="dialog"` de fato é o `Paper` (slot interno), que não recebia o `aria-label`. Resultado: `getByRole('dialog', { name: 'Detalhe da tarefa' })` não resolvia NUNCA, e um axe scan com o dialog aberto reprovaria `aria-dialog-name`. **Corrigido**: `aria-label` movido para dentro de `slotProps.paper` (mesmo objeto que já carrega `style`/`sx` do Paper). Não-vacuidade: revertida a correção → `getByRole('dialog', {name:...})` voltou a não resolver (as 3 novas asserções de `TaskDetailCard` falharam) → restaurada → `git diff` limpo do arquivo de produção, só a linha do `aria-label` mudou de posição.
  2. **Falso-positivo de `color-contrast` por timing de transição (achado de TESTE, não de produto)**: um axe scan tirado logo após `toBeVisible()` do dialog mede o `.MuiDialog-container` ainda em ~1% de opacidade (o `Fade` do MUI injeta a opacidade animada nesse elemento, não no `.MuiDialog-paper`), fazendo o card aparecer quase totalmente translúcido e acusando `color-contrast` em ~11 nós ao mesmo tempo — reproduzido de forma determinística em 2 rodadas isoladas, e resolvido (zero violações) só depois de esperar a opacidade assentar. Novo helper `waitForDialogSettled` em `shellHelpers.ts` (par de `waitForSheetSettled`, mesmo padrão de `expect.poll`) usado pelo novo teste de axe do detalhe — sem ele, qualquer futuro axe scan contra um `<Dialog>` recém-aberto herdaria o mesmo falso-positivo.
- Regressão completa re-executada **depois** do último commit de teste/produção: `CI=1 npx playwright test e2e/weekly-monthly-task-crud.spec.ts e2e/past-period-navigation.spec.ts e2e/weekly-monthly-cycle.spec.ts e2e/ritual-sources.spec.ts e2e/weekly-board.spec.ts e2e/weekly-planning-ritual.spec.ts --retries=0` → **38/38 passed** (10.6min). `npx vitest run` → **105 arquivos, 1223 testes, todos passando** (contagem inalterada — nenhum unit test novo neste passo). `npx tsc -b --noEmit` → limpo. `npm run lint` → limpo.

### Completion Notes List

- Story executada integralmente numa única sessão contínua (as 3 fases, Task 1 → Task 12), sem HALT.
- **3 achados reais de produto** descobertos e corrigidos só na Task 12 (E2E contra browser real e Neon `e2e`, não pegos por unit/jsdom): cache stale na criação de tarefa da semana corrente (`useCreateWeeklyTaskMutation` invalidando a chave errada), `color-contrast` reprovado pelo axe em telas estreitas (o truque `calc(1/x)` de "restaurar" opacidade não funciona em CSS real), e um gap real da AC3 (`TaskDetailCard` não respeitava semana `finalized` — prop `readonly` adicionada com testes). Detalhes completos no checklist da Task 12.
- Nenhuma das 9 questões abertas do Dev Notes foi resolvida nesta story — todas permanecem para o dono decidir, conforme já registrado.
- `WeeklyPage.tsx`, `MonthlyPage.tsx`, `FuturePage.tsx`, `DailyPage.tsx`, `TaskRow.tsx`, `theme.ts` e os arquivos do shell (`AppLayout`/`Sidebar`/`BottomNav`) **não foram tocados**, confirmado por `git status --short`.
- `e2e/shell-a11y.spec.ts` (listado nas Dev Notes como "ALTERADO") **não precisou de mudança**: seu inventário de rotas não inclui `/planner/week` nem `/planner/week/planning` — o requisito de "axe sem exclude:'main' nas rotas migradas" é satisfeito integralmente pelos specs novos (`weekly-board.spec.ts`, `weekly-planning-ritual.spec.ts`), que já cobrem as duas rotas em wide/medium/tablet/compact/reflow sem a exclusão.
- Nenhuma migration criada (aditivo read-only, conforme AC4).
- **Passo de QA (`bmad-qa-generate-e2e-tests`) posterior ao dev-story**: 8 specs E2E novos fecharam lacunas de cobertura em AC1 (pool vazio), AC2 (nenhum E2E abria o `TaskDetailCard` antes), Task 7 (reordenação) e AC7 (offline do ritual); achou e corrigiu 1 bug real de acessibilidade (`TaskDetailCard` sem nome acessível no `role="dialog"`, WCAG 4.1.2) e 1 falso-positivo de teste (axe medindo o dialog em transição), resolvido com o novo helper `waitForDialogSettled`. Detalhe completo no Debug Log References.

### Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (via `bmad-story-automator-review`, Claude Sonnet 5) em 2026-07-25.

**Método:** revisão adversarial paralela em 6 frentes (backend AC4; `TaskRowBase`/ícones/tokens; `TaskDetailCard`/linhagem; `WeeklyBoardPage`/painéis; `WeeklyPlanningPage`/rails; specs E2E/a11y) — cada frente verificou reivindicações específicas do texto da story CONTRA o código real, não contra a prosa. Todos os achados abaixo foram corrigidos nesta mesma passagem (auto-fix), com testes novos e as suítes completas re-executadas depois das correções.

**Achados corrigidos, por severidade:**

- **CRÍTICO** — `TaskDetailCard`: "Nova subtarefa adiciona" (AC2, Task 3) estava marcada como entregue, mas a UI de criação de subtarefa não existia no arquivo (só a leitura de `task.subtasks` era usada, e só para esconder/mostrar botões do rodapé). Adicionado formulário próprio (`useCreateSubtaskMutation`, Enter adiciona, ausente em `isSubtask`/`readonly`). 5 testes novos.
- **ALTO** — `TaskRowBase.isStatusCycleControl` só verificava `cycleStatus === 'finalized'`, ignorando `variant`/`readonly` — uma semana `closed` legada (status `NULL`, sem o literal `'finalized'`) deixava o ícone de status clicável (mutação real) numa semana que a UI já tratava como somente-leitura em todo o resto (criação/reordenação já ausentes). Corrigido para decidir pelo booleano `readonly` já computado no componente. 3 casos de teste novos (parametrizado).
- **ALTO** — Categoria (`TaskDetailCard`) era um `radiogroup` sem navegação por seta: só a opção já selecionada tinha `tabIndex=0` e não havia handler de `Arrow*`, então um usuário só-teclado nunca alcançava as outras 6 opções. Adicionado roving tabindex (`ArrowLeft/Right/Up/Down`, com wrap nas duas pontas). 5 testes novos.
- **ALTO** — nenhuma decisão do ritual (`Manter`/`Adiar`/`Concluir`/`Cancelar`/`Alocar`/migração nomeada) tinha tratamento de falha, apesar da AC5 exigir "falha preserva item, mostra o motivo, oferece Tentar novamente". Adicionado `itemErrors`/`onRetryItem` por item em `WeeklyDecisionList` (retry repete a MESMA ação) e a mesma tratativa no seletor de destino (`WeeklyDestinationPicker` ganhou prop `error`; a confirmação só fecha o seletor no SUCESSO, nunca mais incondicionalmente). 4 testes novos.
- **ALTO** — a suíte de axe do ritual (`weekly-planning-ritual.spec.ts`) só cobria wide e compact — as faixas medium/tablet/reflow-320 que a Task 12/AC7 afirmam explicitamente estavam ausentes. Adicionados os 3 `test.describe` que faltavam (mesmo padrão de `weekly-board.spec.ts`); o de tablet revelou um achado real de TESTE (não de produto): o rail colapsado do shell em 800px reprova `target-size` até expandir — mesma causa já documentada para `weekly-board.spec.ts`, resolvida com o mesmo `mainNav(page).getByRole('button', {name:'Expandir sidebar'}).click()`.
- **MÉDIO** — `TaskRowBase`: a coluna 1 da grade usava o literal `18px`, mas o ícone de status é `var(--ds-task-row-status-icon-size)` = `20px` — 2px de estouro/sobreposição real entre colunas. Corrigido para a coluna usar o MESMO token do ícone.
- **MÉDIO** — `WeekendStack` (`WeeklyBoardPage`) empilhava Sáb/Dom em LINHAS (`gridTemplateRows`), mas a composição aprovada (`key-weekly.html`) é EM COLUNAS lado a lado — um giro de eixo que também esvaziava a razão de existir da variante `compact` da Task Row (pensada para caber numa coluna estreita). Corrigido para `gridTemplateColumns: '1fr 1fr'`.
- **MÉDIO** — `WeeklyPlanningPage.handleComplete`/`handleCancel` reusavam `useTransitionTaskMutation` (otimista, escreve no cache de `todayLog`) para ações do RITUAL — contradizendo a decisão de Dev Notes #4 ("nenhuma mutação otimista nesta story") e documentado no próprio comentário do código como reuso deliberado. Extraído `useRitualTaskTransitionMutation` (mesma `mutationFn`, sem `useOptimisticMutation`) para as duas ações.
- **MÉDIO** — `WeeklyBoardPage.tsx`, layout tablet: `minHeight: '200px'` literal (fora dos 8 literais que o guardrail escaneia, mas ainda um literal estrutural fora de `var(--ds-*)`). Substituído por proporção relativa (`gridTemplateRows: '3fr 1fr'`) entre a grade de dias e a faixa do pool — zero literal novo, sem inventar token de pixel.
- **MÉDIO** — faltava o lado `finalize` da prova "painel e gate não podem divergir" (AC4) — só `start` tinha teste parametrizado. Adicionado `test_readiness_finalize_e_o_gate_real_nao_podem_divergir` (2 casos, um por gate).
- **MÉDIO** — "as 5 fontes carregam independentemente" (E2E) só exercitava 4 (nunca tocava `monthly-expanded`). Estendido o teste existente para também clicar "Monthly ampliado" com `previous-weekly` em erro.
- **BAIXO** (corrigido de passagem) — encerramento do destaque de linhagem por INTERAÇÃO não tinha teste próprio (só o timer); readonly de `WeeklyBoardPage` só era testado como conjunção (`closed && finalized`), não como disjunção. Ambos ganharam o caso irmão que faltava.

**Achados registrados, não corrigidos (severidade baixa, gaps de cobertura sem risco de produto):** `TaskDetailCard.handleCancel`/`handleDelete` não têm `onError` (falha ao cancelar/excluir não dá feedback visível) — fora do escopo literal da AC2, que exige preservação de rascunho/motivo só para o PATCH de "Salvar"; testes backend de combinações null isoladas (ex.: só `active` sem `planning`) e a direção "true" da prova de não-divergência de `start` — não adicionados, risco já mitigado por inspeção de código (a mesma função é chamada nos dois caminhos).

**Gates re-executados DEPOIS das correções:** `uv run pytest -q` → **1287 passed** (+2 sobre os 1285 da revisão anterior); `npx vitest run` → **105 arquivos, 1245 testes** (+22); `npx tsc -b --noEmit` limpo; `npm run lint` limpo; `uv run ruff check .` limpo; `uv run lint-imports` → `1 kept, 0 broken`; `uv run python manage.py makemigrations --check --dry-run` → `No changes detected`; Playwright (`weekly-monthly-task-crud`, `past-period-navigation`, `weekly-monthly-cycle`, `ritual-sources`, `weekly-board`, `weekly-planning-ritual`) → **41/41 passed** (11.5min, branch Neon `e2e`).

**Outcome:** Approve. 0 achados CRÍTICOS remanescentes — Status → `done`.

### File List

**Backend (alterado, aditivo):**
- `backend/bujo/services/cycles.py`
- `backend/bujo/services/rituals.py`
- `backend/bujo/serializers.py`
- `backend/bujo/views.py`
- `backend/bujo/tests/test_services.py`
- `backend/bujo/tests/test_views.py`
- `schema.yaml`

**Frontend — novos:**
- `frontend/src/features/bujo/components/TaskRowBase.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/TaskDetailCard.tsx` (+ `.test.tsx`) — **corrigido no passo de QA**: `aria-label` do dialog movido de `<Dialog aria-label=...>` para `slotProps.paper` (o MUI só repassa `aria-label` ao `Modal` raiz, não ao `Paper` que carrega `role="dialog"` — o dialog não tinha nome acessível, WCAG 4.1.2)
- `frontend/src/features/bujo/components/taskStatusIcons.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/weekly/WeeklyTaskPanel.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/weekly/WeeklyRowOverflowMenu.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/weekly/WeeklySourceRail.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/weekly/WeeklyDecisionList.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/weekly/WeeklyContextRail.tsx` (+ `.test.tsx`)
- `frontend/src/features/bujo/components/weekly/weeklyRitualSources.ts` (+ `.test.ts`)
- `frontend/src/features/bujo/components/weekly/noLiteralTokens.test.ts` (guardrail, sem par de produção)
- `frontend/src/pages/planner/WeeklyBoardPage.tsx` (+ `.test.tsx`)
- `frontend/src/pages/planner/WeeklyPlanningPage.tsx` (+ `.test.tsx`)
- `frontend/src/pages/planner/noLiteralTokens.test.ts` (guardrail, sem par de produção)
- `frontend/src/shared/date/index.ts` (+ `index.test.ts`)
- `frontend/src/shared/hooks/useKeyboardShortcuts.ts` (+ `.test.ts`)
- `frontend/e2e/weekly-board.spec.ts` (5 testes acrescentados no passo de QA — ver Debug Log References)
- `frontend/e2e/weekly-planning-ritual.spec.ts` (3 testes acrescentados no passo de QA)
- `frontend/e2e/seedWeeklyBoardScenario.ts` (passo de QA: `seedFinalizedWeekWithTasks` ganhou um par migrada/sucessora; nova função `seedWeeklyBoardLineageScenario`)
- `frontend/e2e/seedWeeklyPlanningScenario.ts`
- `_bmad-output/implementation-artifacts/tests/test-summary-14-5.md` — **NEW**, passo de QA (resumo das lacunas fechadas, achados e gates)

**Frontend — alterados:**
- `frontend/src/shared/design/tokens.ts` (+ `tokens.test.ts`)
- `frontend/src/api/keys.ts` (+ `keys.test.ts`)
- `frontend/src/api/types.gen.ts` (gerado)
- `frontend/src/features/bujo/types.ts`
- `frontend/src/features/bujo/api.ts` (+ `api.test.tsx`)
- `frontend/src/features/bujo/index.ts` (barrel)
- `frontend/src/app/router.tsx`
- `frontend/src/app/layout/shell/shellRouting.ts` (+ `shellRouting.test.ts`)
- `frontend/e2e/fixtures.ts` (`detailPanel()` passa a casar `.MuiDialog-paper` além de `.MuiDrawer-paper`)
- `frontend/e2e/shellHelpers.ts` (`navigate()`, `mainNav()` promovidos/reusados; passo de QA acrescenta `waitForDialogSettled`, par de `waitForSheetSettled` para o Fade de `<Dialog>`)
- `frontend/e2e/weekly-monthly-task-crud.spec.ts`
- `frontend/e2e/past-period-navigation.spec.ts`
- `frontend/e2e/weekly-monthly-cycle.spec.ts`
- `frontend/e2e/ritual-sources.spec.ts` (dedup do helper `navigate`)

**Não alterados (confirmado por `git status --short`), apesar de listados nas Dev Notes como candidatos:** `frontend/e2e/shell-a11y.spec.ts` (ver Completion Notes).

## Change Log

| Data | Mudança |
|---|---|
| 2026-07-25 | Implementação completa das 3 fases (Tasks 1-12). Backend aditivo (AC4), Task Row/detalhe canônicos (AC2), Weekly Board (AC1/AC3), ritual de planejamento com rails (AC5/AC6), estados obrigatórios e piso de a11y (AC7), tokens/ícones (AC8). Regressão E2E completa (AC9): 27/27 Playwright verdes contra Neon `e2e`, 1223/1223 Vitest, 1285/1285 pytest. 3 achados reais de produto corrigidos na Task 12 (cache stale na criação semanal, `color-contrast` do axe em telas estreitas, gap de readonly no detalhe da tarefa em semana finalizada). Status → `review`. |
| 2026-07-25 | Passo de QA (`bmad-qa-generate-e2e-tests`): 8 specs E2E novos (reordenação, navegação de linhagem, `TaskDetailCard` categoria/Eisenhower/Salvar/Cancelar/Excluir, `Migrar para <dia>`, `Cancelar planejamento`, offline do ritual, axe com o Detalhe da tarefa aberto) fecham lacunas de AC1/AC2/AC7/Task 7 não cobertas pelo dev-story. 1 achado real corrigido (`TaskDetailCard` sem nome acessível no `role="dialog"` — `aria-label` reposicionado para `slotProps.paper`, WCAG 4.1.2) e 1 helper novo (`waitForDialogSettled`) elimina um falso-positivo de `color-contrast` por timing de transição do MUI Fade. Regressão de 6 specs (38/38) e Vitest (1223/1223) re-executados depois das correções — verdes. |
| 2026-07-25 | Review adversarial (`bmad-story-automator-review`, 6 frentes paralelas): 1 achado CRÍTICO (subtarefa da AC2 nunca implementada em `TaskDetailCard`), 4 ALTOS (controle de status vazando em semana `closed` legada, radiogroup de categoria sem navegação por seta, ritual sem tratamento de falha/retry por item, axe do ritual sem 3 das 5 faixas) e 6 MÉDIOS (mismatch ícone×coluna, weekend-stack em linhas em vez de colunas, otimismo vazado em 2 ações do ritual, literal de pixel no layout tablet, prova de não-divergência do `finalize` faltando, E2E de "5 fontes" só cobrindo 4) corrigidos, com testes novos e as suítes completas re-executadas depois: `pytest` 1287/1287, `vitest` 1245/1245 (105 arquivos), `tsc`/`lint`/`ruff check`/`lint-imports`/`makemigrations --check` limpos, Playwright (6 specs) 41/41. Ver *Senior Developer Review (AI)* para o detalhe completo. Status → `done`. |
