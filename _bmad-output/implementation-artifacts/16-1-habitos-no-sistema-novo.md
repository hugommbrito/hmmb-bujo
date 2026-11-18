---
title: 'Story 16.1 — Hábitos no sistema novo'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: 'd990d3bb528ec6341b65fd8e2addcb70d4cc5082'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-habitos.html'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-16-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/15-brain-dump-parity-checklist.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** O módulo de Hábitos ainda vive nas 3 superfícies legado (`/habits`, `/habits/history`, `/settings/habits`) com dialeto MUI antigo e `surfaceMigrated: false` — o shell novo desenha o `LegacySeamNotice` por cima. O gate de UX 16.0 (aprovado em 2026-08-22) já promoveu aos spines a composição nova: **uma superfície com três abas internas Hoje · Histórico · Configuração**, variante "Registro em cards", barra de completude, Habit Tracker Row, grade de tom contínuo.

**Approach:** Recompor a apresentação sobre o sistema novo **sem tocar no domínio nem na API**. Reusar integralmente os 14 hooks do barrel `features/habits` (zero endpoint novo, zero migration, zero mudança de regra). Criar as páginas/componentes novos ao lado do legado (padrão de coexistência dos Épicos 14/15), emitir os 4 blocos de token de geometria que o gate definiu, apontar o manifest para a página nova e flipar `surfaceMigrated`.

## Boundaries & Constraints

**Always:**
- **Paridade antes de refino.** Todo comportamento inventariado no legado sobrevive: completude ponderada, multiplicador por tipo de dia, override avulso, versionamento prospectivo, snapshot imutável, "Mostrar inativos", grade acessível, gráfico de eixo único com eventos anotados em texto. Zero mudança de regra de domínio.
- **A interface nunca calcula completude.** Porcentagem do dia e de grupo vêm do servidor. Otimismo restrito ao **valor da linha**; peso efetivo e multiplicador só mudam com resposta do servidor.
- **Zero literal de cor ou medida.** Só `var(--ds-*)` e `typography[...]` de `shared/design/tokens`. Nada de `theme.palette` nem `color="primary"` do MUI. Um `noLiteralTokens.test.ts` guarda a subpasta nova.
- **Exatamente um `<main>`** por superfície, com `aria-label` — o shell não renderiza `main`.
- Estados obrigatórios em toda superfície: loading (skeleton com a geometria final, sem porcentagem provisória), vazio, erro de leitura com retry, erro de escrita com valor preservado + rollback, offline (faixa `role="status"` + controles desabilitados com motivo acessível), hábito inativo (chip textual "Inativo" + tratamento terminal — opacidade nunca é canal único).
- **Nenhum toast de sucesso.** Sucesso é o valor e a porcentagem mudando.
- Strings verbatim do gate (§ I/O Matrix e Design Notes) — os testes asseram o texto exato.

**Never:**
- **Não renderizar emoji** em nenhuma superfície de Hábitos. A coluna do glifo de 20px existe e fica **vazia**; nada de quadrado, tofu ou glifo de erro. Campo `iconKey`, seletor de pictograma (O1/O2) e migração `emoticon` → `iconKey` são **Story 16.2**.
- **Não implementar as leituras agregadas** (F13–F15 + agregação por bucket da grade): sequência, contagem de dias 100%, série por grupo. Exigem backend novo — **Story 16.2b**. A grade de F8 é **semanal fixa** e entra aqui; o alternador semana/quinzena não foi promovido e não existe.
- **Não redesenhar o Hoje.** F10–F12 (bloco de Hábitos nas duas lentes do Daily) são da **onda da home**. `DailyPage.tsx:110` continua renderizando o `HabitTracker` legado, intacto.
- Não tocar `backend/`, schema, OpenAPI, `api.ts`, `keys.ts` nem `types.gen.ts`. Nenhum endpoint novo.
- Não apagar os componentes/páginas legado — coexistência; a remoção é do Épico 18.
- Nada de excluir hábito, ordenação manual, arraste, busca, filtro, fila offline, rascunho local, autosave, celebração, insight/IA, lembrete, exportação, comparação entre períodos, edição dentro do histórico.
- **Sem matriz axe por viewport nem story de fechamento de a11y** — descontinuada desde a retro do Épico 15.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Booleano marcado | linha booleana nula, clique no checkbox | `PATCH /api/habits/days/{id}` `{value:1}`; linha otimista → "Feito"; **porcentagem do dia e do grupo não mudam** até o refetch | Erro: rollback da linha, `role="alert"` inline junto à linha, "Não foi possível salvar. Tente novamente." + retry |
| Booleano desmarcado | linha em `1`, clique | grava **nulo**; estado textual "Não feito" (nunca ausência) | idem |
| Numérico commit | campo com `2,1`, `blur` ou `Enter` | parser aceita vírgula **e** ponto; grava; linha lê `2,1 / 8 km (26%)` | Erro: valor digitado **preservado** no campo, `aria-invalid="true"` + `aria-describedby`, retry inline |
| Numérico inalterado | `blur` sem editar | **nenhuma requisição** | — |
| Numérico vazio | campo limpo, `blur` | grava **nulo** | idem |
| Meta atingida | valor ≥ meta | "Meta atingida · 8,4 / 8 km"; checkbox indicador marca sozinho, permanece `disabled` (saída, não entrada) | — |
| Feriado por data | checkbox "Marcar este dia como feriado" | `POST /api/habits/holidays/`; servidor reescreve `multiplierAtTime` do dia; a UI **refetcha**, nunca recalcula; legenda `Feriado · peso ×0,5 neste grupo` aparece só se dia≠útil **e** multiplicador≠1 | erro → `role="alert"` + retry, sem alterar porcentagem |
| Override avulso | botão "Tratar este dia como dia útil (peso cheio)" (só quando dia≠útil) | N `PATCH` com `multiplierAtTime:'1.00'` nas linhas **do dia visível**; configuração dos grupos intocada | falha parcial → erro agregado com retry |
| Dia passado | navegação de data para qualquer dia já semeado | abre com os pesos congelados **daquele** dia; edição livre, **sem limite de retroatividade** | — |
| Σ pesos efetivos = 0 | dia sem hábito exigível | completude **0% por definição do domínio**, vinda do servidor; denominador nomeado explicita que nada era exigível | — |
| Dia-lacuna no histórico | data sem linha materializada | "Sem registro neste dia." + nota de que nenhuma linha foi materializada; **nenhuma porcentagem, nunca 0% fabricado** | — |
| Célula da grade | completude 71% na célula | fundo `color-mix(in srgb, var(--ds-primary) calc(var(--p)*1%), var(--ds-surface))` com `--p:71`; número herda o fundo um degrau mais escuro; booleano "5/7" pinta a **71%** (razão real, não o numerador) | célula sem número é bug, não variante |
| Célula sem registro | período sem linha | tracejada com "—" | — |
| Série sem hábito selecionado | select vazio | **nada é buscado** (`enabled:false`); "Selecione um hábito para ver o gráfico de evolução." | — |
| Falha parcial | série falha, grade ok | banner `role="alert"` + retry **só no bloco da série**; a grade carrega íntegra. Multiplicador falha sem derrubar a lista de hábitos | cada bloco tem erro e retry próprios |
| Offline | `navigator.onLine === false` | faixa persistente `role="status"`: "Sem conexão. Registrar e configurar hábitos exige rede."; controles de escrita `disabled` com `aria-describedby` apontando para a faixa; rótulos seguem legíveis | nenhuma promessa de fila, rascunho ou sync |
| Criar hábito sem grupo | zero grupos cadastrados | campos e botão `disabled` + `aria-describedby` → `role="note"` com "Crie um grupo para começar a adicionar hábitos." | — |
| Multiplicador vazio | campo de fim de semana limpo, salvar | remove a configuração e devolve **1,00** (placeholder `1,00`); dia útil é 1,00 implícito, nunca armazenado | erro inline no bloco, lista intacta |
| Collection desligada | entrada `habits` ausente do manifest | destino **ausente** da nav do shell (sem link fantasma, sem item `disabled`, sem heading vazio); `/habits` não resolve na superfície e devolve ao núcleo; Hoje/Planner íntegros; nenhum dado apagado | — |

</intent-contract>

## Code Map

**Reuso integral — NÃO alterar (fonte de dados e regra):**
- `frontend/src/features/habits/api.ts` — 14 hooks. Leitura: `useHabitsQuery({includeInactive})`:27, `useHabitGroupsQuery`:40, `useHabitDayQuery(date)`:53, `useHabitHistoryQuery({start,end})`:76, `useHabitSeriesQuery(id,range)`:93 (`enabled: habitId!==''`:98), `useGroupMultipliersQuery`:237. Escrita: `useMarkHabitEntryMutation`:212 (otimista), `useSetHolidayMutation`:286 (otimista), `useOverrideDayWorkdayMutation`:308 (N PATCH via `Promise.all`:300), `useCreateHabitMutation`:122, `useUpdateHabitIdentityMutation`:146 (identidade), `useAddHabitVersionMutation`:170 (versão prospectiva), `useCreateHabitGroupMutation`:187, `useSetGroupMultipliersMutation`:263.
- `frontend/src/api/keys.ts:59-73` — query keys de habits. `frontend/src/features/habits/types.ts` — aliases sobre `types.gen.ts`. `backend/habits/**` — intocado.
- ⚠️ **Peso/meta/bônus vão por `useAddHabitVersionMutation`; unidade é identidade e vai por `useUpdateHabitIdentityMutation`** — duas chamadas distintas no mesmo formulário (padrão em `HabitsManager.tsx:67-70`).

**Legado — referência de paridade, permanece montado só onde indicado:**
- `frontend/src/features/habits/components/HabitTracker.tsx` (263 l.) — **continua sendo usado por `pages/daily/DailyPage.tsx:110`**; não remover, não redesenhar. Fonte de paridade: `DAY_TYPE_LABEL`:21, `SAVE_ERROR`:28, legenda de multiplicador:166-180, override:237-245.
- `HabitsManager.tsx` (483 l.) — paridade da Configuração: `PROSPECTIVE_CHANGE_TOOLTIP`:31, `GroupMultiplierConfig`:172 (remount por `key`:174-185), criação condicional numérico:443-471.
- `HabitHistory.tsx` (267 l.) — `DEFAULT_SPAN=29`:16-42, `shiftPeriod`:114-120, `DayDetail`:60.
- `HabitEvolutionChart.tsx` (231 l.) — recharts, eixo único, `ReferenceArea` de ritmo:167-175, `ReferenceLine` + lista textual "Mudanças no período":209-222, `figure`/`role="img"`:135-140. **Reusável quase como está** — só trocar os literais restantes por tokens e acrescentar o select de Visão (3 visões sobre o payload existente).
- `HabitHistoryGrid.tsx` (217 l.) — tabela semântica, `th scope` em linha e coluna, `DAY_TYPE_TAG` FDS/FER:42-46, lista por dia no compact:86-121.
- `historyUtils.ts` (60 l.) — `formatNumber`, `formatDateBR` (split de string, nunca `new Date(iso)`):12-14, `describeChange`, `describeEvent`. `isRhythmDay`:58 é dead code.
- Páginas legado desmontadas por esta story: `pages/habits/HabitsPage.tsx`, `HabitHistoryPage.tsx`, `HabitsTabs.tsx`, `pages/settings/HabitsSettingsPage.tsx`.

**Sistema novo — reusar, não reinventar:**
- `frontend/src/shared/design/tokens.ts` (532 l., dados puros) — `spacing`:28, `typography`:57 (`page-title`/`section-title`/`body`/`body-strong`/`meta`/`label`), `mediaQueries`:84, `taskRow`:177 (`min-height-pointer` 36px / `-touch` 48px / `terminal-opacity` 0.58), `panel`:273, `chip`:282, `domainIcon`:289 (20px default / 18px compact), `structuralCssVariables`:469 (**adicionar as `--ds-*` novas aqui**), `shellCssVariables`:518, `dsColor`:530.
- `frontend/src/features/bujo/components/ItemRowBase.tsx` — base de apresentação da Item Row (o cabeçalho do arquivo já nomeia Hábitos como consumidor futuro). Base da **Habit Tracker Row**.
- `frontend/src/features/bujo/components/recurring/RecurringGroupTabs.tsx` (155 l.) — molde de `tablist` à mão (roving `tabIndex`, setas com wrap, `aria-controls` **só na aba selecionada**); ids do par tab⇄tabpanel em módulo puro (`recurring/recurringLibrary.ts:60-66`).
- `frontend/src/pages/archive/ArchivePage.tsx:311-344` (tablist) / `:409` (tabpanel) — molde de **aba com estado na querystring** (`?tab=`), Home/End. **É o molde desta story.**
- `frontend/src/pages/planner/RecurringLibraryPage.tsx` — molde de página nova: `PRIMARY_BUTTON_SX`:71-81, skeleton, erro com `refetch`, `Dialog` portalizado com `slotProps.paper.style = shellCssVariables('light')`:294-306.
- `frontend/src/pages/braindump/BrainDumpInboxPage.tsx` — `RETRY_BUTTON_SX`:45-50, restauração manual de foco:70-110.
- `frontend/src/features/bujo/components/recurring/RecurringLibrarySkeleton.tsx` — molde de skeleton. `PlannerSkeleton.tsx` idem.
- `frontend/src/shared/hooks/useOnlineStatus.ts:7` — **hoje não é usado por nenhum arquivo de habits**; é a maior lacuna do módulo.

**Roteamento e chrome:**
- `frontend/src/app/collections/registry.ts:96-119` — entrada `habits`: `icon: RepeatIcon`, `nav:{label:'Hábitos', order:0}`, rotas lazy `habits`:102-108 e `habits/history`:109-117 (mapeiam export nomeado → `default`).
- `frontend/src/app/layout/shell/shellRouting.ts:82` (`settings/habits`), `:90` (`habits`), `:91` (`habits/history`) — todos `shell:'new', surfaceMigrated:false`. **Flipar para `true`.** `shellRouting.test.ts` exige que toda rota do registry esteja em `shellRoutes`.
- `frontend/src/app/router.tsx:79-92` — `collectionRoutes` derivado do registry, `<Suspense fallback={null}>`; `:25` + `:205-208` — `settings/habits` é rota eager hardcoded. `pages/settings/SettingsPage.tsx:14` — link de entrada.
- `frontend/src/app/layout/shell/shellDestinations.ts:93-99` (ativação por prefixo), `:143-146` (derivação genérica). `navIcons.tsx:100` — `habits: CheckSquare` no shell novo.
- ⚠️ **`frontend/src/app/router.test.tsx:55-58` e `RouteAnnouncer.test.tsx:50-53` mockam `../features/habits` com exatamente `{useHabitDayQuery, HabitTracker}`** — a página nova consome mais hooks do barrel; esses dois mocks **precisam ser estendidos** ou os testes quebram.

**Testes existentes a preservar/estender:** `features/habits/api.test.tsx` (457 l., 14 hooks — não deve mudar), `HabitsManager.test.tsx` (204), `HabitTracker.test.tsx` (216), `HabitHistory.test.tsx` (111), `HabitEvolutionChart.test.tsx` (85), `HabitHistoryGrid.test.tsx` (84). E2E: `frontend/e2e/habit-tracker.spec.ts` (117), `habit-history.spec.ts` (162), `habit-multiplier.spec.ts` (171) — **os três navegam pelas rotas/markup antigos e precisam ser ajustados**. Seeds reusáveis: `e2e/seedHabits.ts`, `seedHabitHistory.ts`, `seedMultiplierScenario.ts`. Helpers: `e2e/shellHelpers.ts` (`navigate(page,'Hábitos')`, `mainNav`, `dsTokenPx`), `e2e/fixtures.ts`.

## Tasks & Acceptance

**Execution:**

1. `frontend/src/shared/design/tokens.ts` -- adicionar os 4 blocos de geometria do gate (`recordCards`: max-width `1120px`, columns-wide `2`, card-min-width `520px`, gap `spacing[4]`; `completionBar`: height-day `8px`, height-group `6px`, track `surface-subtle`, track-border 1px `border`, fill `primary`, radius `xs`; `habitTrackerRow`: control-column `44px`, numeric-field-width `104px`, category-border `none`, terminal-opacity `0.58`; `pictogramPicker`: columns-dialog `6`, columns-sheet `4`, tile-min-size = `appShell.touchTargetMin`) e emitir as `--ds-*` correspondentes em `structuralCssVariables`:469 -- sem as CSS vars o guard de literais força inventar medidas. Estender `tokens.test.ts`.
2. `frontend/src/features/habits/components/record/habitsSurface.ts` -- módulo **puro** novo: ids do par tab⇄tabpanel, slugs de aba (`hoje`/`historico`/`configuracao`) com parse/normalização da querystring, formatação de fatores congelados (`Peso 3 × 0,5 = 1,5`, inteiro sem fração), parser decimal aceitando vírgula e ponto, derivação do rótulo de dias reais da coluna da grade -- lógica testável sem DOM, no molde de `recurring/recurringLibrary.ts`.
3. `frontend/src/features/habits/components/record/CompletionBar.tsx` + `HabitTrackerRow.tsx` + `HabitGroupCard.tsx` -- primitivos da variante "Registro em cards": barra `role="img"` com a porcentagem no nome acessível e **sempre redundante** ao número; linha sobre `ItemRowBase` com grid `44px | 20px | 1fr [| 104px]`, sem borda de categoria, coluna do glifo **vazia**, estado textual obrigatório, checkbox indicador `disabled` no numérico; card = Panel por grupo com Section Header (nome · peso efetivo · %) e barra de 6px.
4. `frontend/src/features/habits/components/record/HabitsTodayPanel.tsx` -- aba **Hoje**: cabeçalho do dia (data por extenso + chip de tipo de dia + navegação `‹ Anterior · Hoje (aria-pressed) · Próximo ›`), porcentagem + barra de 8px + denominador nomeado, checkbox de feriado + texto de precedência, override avulso condicional, grade de cards (2 col ≥ wide via `recordCards`, 1 col nas demais) -- superfície de registro do gate.
5. `frontend/src/features/habits/components/record/HabitsConfigPanel.tsx` -- aba **Configuração** em largura de leitura (800px): "Mostrar inativos", por grupo (sectionhead + linhas + bloco de multiplicadores com precedência declarada), bloco de edição **um por vez** separando Identidade (UPDATE direto) de Versionado (nova versão) com o aviso persistente verbatim, "Cancelar edição" sem tocar o servidor, "Desativar/Reativar hábito", criação ao fim com tipo em `radiogroup` imutável e campos numéricos condicionais.
6. `frontend/src/features/habits/components/record/HabitsHistoryPanel.tsx` + `HabitCompletionGrid.tsx` -- aba **Histórico**, readonly em contraste normal, na ordem intervalo → detalhe do dia → evolução → grade. Detalhe com "Abrir este dia para edição" que leva a data para a aba Hoje; evolução com select de Hábito + select de **Visão** (valor diário / % da meta / contribuição) reusando `HabitEvolutionChart` e mantendo a tabela equivalente **permanente**; grade semanal fixa com **escala contínua de tom** (`color-mix` sobre `--ds-primary`/`--ds-surface`, `--p` = completude da célula; booleano usa a razão real), `caption`, `th scope` em linha e coluna, tags FDS/FER, tabela equivalente em `details`, e lista por dia no compact.
7. `frontend/src/features/habits/components/record/HabitsSkeleton.tsx` -- skeleton por aba com a **geometria final** (44px / 20px / corpo / 104px), `aria-busy`, **sem porcentagem** e sem pulo de altura quando o dado chega.
8. `frontend/src/pages/habits/HabitsRecordPage.tsx` -- página nova: `<Box component="main" aria-label="Hábitos">`, page header, `tablist` de 3 abas com estado em `?tab=` (molde `ArchivePage`), faixa de offline via `useOnlineStatus`, e por bloco: skeleton no `isPending`, `role="alert"` + "Tentar de novo" chamando `refetch()` no `isError`, vazio com o texto verbatim. Erro de um bloco não derruba os outros.
9. `frontend/src/app/collections/registry.ts` -- apontar a rota `habits` para `HabitsRecordPage`; converter `habits/history` em redirect para `/habits?tab=historico` (preserva deep link e mantém a rota no manifest, que `shellRouting.test.ts` exige).
10. `frontend/src/app/router.tsx` -- `settings/habits` (`:205-208`) vira redirect para `/habits?tab=configuracao`; `frontend/src/app/layout/shell/shellRouting.ts:82,90,91` -- `surfaceMigrated: true` nas três, removendo o `LegacySeamNotice`.
11. `frontend/src/app/router.test.tsx` + `frontend/src/app/layout/RouteAnnouncer.test.tsx` -- estender o mock de `../features/habits` com os hooks que a página nova consome -- hoje mockam só `{useHabitDayQuery, HabitTracker}` e quebram sem isso.
12. `frontend/src/features/habits/components/record/noLiteralTokens.test.ts` -- guard estrutural da subpasta nova (importa cada fonte com `?raw`, reprova `#hex` e literais que têm token: `44px`, `104px`, `520px`, `1120px`, `8px`, `6px`, `36px`, `48px`, `20px`, `18px`, `0.58`), incluindo os dois testes de não-vacuidade do molde de `recurring/noLiteralTokens.test.ts`. `color-mix`/`--p` da grade é literal legítimo e vai documentado no guard.
13. `frontend/src/features/habits/components/record/*.test.tsx` + `frontend/src/pages/habits/HabitsRecordPage.test.tsx` -- testes semânticos/interação no molde de `RecurringLibraryPage.test.tsx` (`vi.mock('../../api/client')`, `mockWideFaixa()` no `beforeEach`, `describe` nomeado pela AC), cobrindo cada linha da I/O Matrix e cada estado obrigatório.
14. `frontend/e2e/habits-record.spec.ts` -- E2E novo reusando `seedHabits.ts`/`seedHabitHistory.ts`/`seedMultiplierScenario.ts` e `shellHelpers.navigate(page,'Hábitos')`: percurso das 3 abas, registro booleano+numérico com persistência, dia passado, feriado/override, grade e tabela equivalente. Ajustar `habit-tracker.spec.ts`, `habit-history.spec.ts` e `habit-multiplier.spec.ts` às rotas e ao markup novos. **Sem matriz axe por viewport.**
15. `_bmad-output/implementation-artifacts/16-habits-parity-checklist.md` -- checklist de fechamento no molde de `15-brain-dump-parity-checklist.md` (ID · comportamento · origem `arquivo:linha` no legado · evidência jsdom · evidência browser), provando que nenhum comportamento do inventário sumiu.

**Acceptance Criteria:**

- **Dado** um usuário autenticado em `/habits`, **quando** a superfície carrega, **então** existe um único `<main aria-label="Hábitos">` com `tablist` de exatamente três abas na ordem **Hoje · Histórico · Configuração** (rótulo "Config." no compact), a aba ativa reflete `?tab=`, o `back` do navegador volta à aba anterior, **e** o `LegacySeamNotice` não aparece em nenhuma das três rotas de Hábitos.
- **Dado** os deep links antigos, **quando** o usuário abre `/habits/history` ou `/settings/habits` (inclusive pelo link de `SettingsPage`), **então** é redirecionado para `/habits?tab=historico` e `/habits?tab=configuracao` respectivamente, com a aba correspondente ativa.
- **Dado** o inventário do módulo legado, **quando** as três superfícies são comparadas com as novas, **então** toda ação, estado, cálculo e texto de transparência do legado está presente na superfície nova, registrado linha a linha em `16-habits-parity-checklist.md` com evidência de teste, **e** nenhuma regra de domínio mudou (nenhum arquivo de `backend/`, `api.ts`, `keys.ts` ou `types.gen.ts` no diff).
- **Dado** a decisão do gate 16.0 sobre pictogramas, **quando** qualquer superfície de Hábitos renderiza, **então** nenhum emoji é exibido e a coluna do glifo de `{components.domain-icon.size-default}` permanece vazia sem alterar o layout — sem quadrado, tofu ou glifo de erro.
- **Dado** um dia já semeado no passado, **quando** o usuário navega até ele pela aba Hoje e corrige um valor, **então** a linha abre com os pesos, meta e multiplicador congelados **daquele** dia, a escrita afeta só aquela linha, **e** a configuração dos grupos permanece intocada.
- **Dado** o histórico aberto, **quando** o usuário aciona "Abrir este dia para edição", **então** a aba Hoje é ativada com a data selecionada carregada, **e** nenhum controle de escrita existe na aba Histórico.
- **Dado** a entrada `habits` ausente do manifest de collections, **quando** o shell novo deriva a navegação, **então** o destino "Hábitos" não aparece na sidebar, na bottom nav nem no navigation sheet — sem link fantasma, item `disabled` ou heading vazio —, `/habits` não resolve na superfície e devolve ao núcleo, **e** Hoje e Planner seguem íntegros (DIR-12c, verificado por teste com manifest sem a entrada).
- **Dado** a suíte do frontend, **quando** `npm run test:run`, `npm run typecheck` e `npm run lint` rodam, **então** todos passam, incluindo o guard `noLiteralTokens` da subpasta nova com seus testes de não-vacuidade.
- **Dado** o backend e o banco `bujo_e2e` locais, **quando** a suíte Playwright escopada a Hábitos roda com `CI=1`, **então** `habits-record.spec.ts` e os três specs legado ajustados passam.

## Spec Change Log

## Review Triage Log

**Ciclo de review 1 (registrado)** — 3 camadas (blind-hunter, edge-case-hunter, verification-gap)
contra o diff de `d990d3b`..árvore de trabalho. Nota: o `16-habits-parity-checklist.md` § J
descreve um passe anterior de 15 patches que **nunca foi registrado aqui** (a sessão expirou antes;
commit `81be411 "implementação até o timeout"`). Este é o primeiro ciclo com trilha de auditoria.

### Mantidos → `patch`

| # | Achado | Consequência verificada | Sev |
|---|---|---|---|
| P1 | `% da meta` num hábito **booleano** zera a série inteira | `metaAtTime` é sempre nulo em booleano ⇒ `metaPercent` devolve `null` em todo ponto; a tabela equivalente imprime `Sem registro neste dia.` em dias **que têm** registro. É absência fabricada — o inverso do princípio "nunca 0% fabricado". `HabitsHistoryPanel.tsx:259`, `:519` | high |
| P2 | Gráfico × tabela discordam do mesmo dia | Booleano com linha materializada e valor nulo: `contributionFactor` devolve `0` (tabela mostra leitura) mas `HabitEvolutionChart.tsx:120` desenha **lacuna** nas visões `%`/contribuição. O comentário em `habitsSurface.ts:515-521` afirma que essa classe de bug foi corrigida — o conserto só entrou no lado da tabela | high |
| P3 | Cabeçalho da coluna da grade conta dias **corridos** | `realDaysLabel(bucket.dates.length)` em `HabitCompletionGrid.tsx:265`, mas o parâmetro é `daysWithRecord` e a Task 2 pede "dias reais": a coluna diz "7 dias" sobre células "2/3" — a leitura errada que o rótulo existe para evitar. `GridCell.daysWithRecord` existe e não é usado no cabeçalho | high |
| P4 | Regressão de paridade no **compact** da grade | Legado (`HabitHistoryGrid.tsx:86-118`) renderiza uma linha **por hábito por dia**; o novo compact (`HabitCompletionGrid.tsx:135-177`) só agrega por dia, e a tabela equivalente em `details` está **depois** do `return` do compact ⇒ no compact o usuário perde a leitura por hábito **e** a tabela equivalente. `HB-E-07` registra como paridade plena, sem DIV | high |
| P5 | Navegação de data não desabilitada offline | Controles de escrita são corretamente `disabled`, mas `‹ Anterior`/`Próximo ›` não (`HabitsTodayPanel.tsx:201` só trata `atToday`) ⇒ navegar offline cai em erro de leitura com um retry que não pode funcionar | medium |
| P6 | `selectTab` empurra sempre | `HabitsRecordPage.tsx:82-87` faz `push` mesmo quando o slug já é o selecionado ⇒ clicar duas vezes na mesma aba empilha entradas idênticas e o primeiro `back` não muda de aba, contrariando a AC | medium |
| P7 | Legenda do grupo × chip do dia | `HabitGroupCard.tsx:49-53` deriva `dayType` de `entries[0]`; o chip usa o `dayType` do dia. O updater otimista de feriado muda só `data.dayType` ⇒ janela em que o chip diz "Feriado" e a legenda ainda diz "Dia útil" | medium |
| P8 | `scope="colgroup"` sem `<colgroup>` | `HabitCompletionGrid.tsx:280` — banda de seção usando um escopo que não se aplica, justamente no componente cuja exceção de contraste se sustenta na redundância semântica | medium |
| P9 | `Adicionar grupo` sem nenhum teste que submeta | Única saída do estado "zero grupos" (com o form de hábito todo `disabled`). A string só aparece em `HabitsRecordPage.test.tsx:1131`, dentro do teste que a assere **`disabled`** offline. `HB-C-02` cita como evidência testes de outro comportamento | medium |
| P10 | Criação numérica e move de grupo sem asserção de payload | O único teste de criação (`:1180`) é **booleano**; nada assere `meta`/`bonus`/`unit` no `POST`, nem `group` no `PATCH` de identidade. O backend 400 em `meta` para booleano, e um move de grupo silenciosamente no-op passariam verdes | medium |
| P11 | `draft` do campo numérico nunca ressincroniza | `HabitTrackerRow.tsx:88` inicializa uma vez; refetch com valor diferente (outra aba/normalização do servidor) deixa o campo mostrando o que não está gravado, e o próximo blur é tratado como "inalterado" ⇒ nada é enviado | medium |
| P12 | `--ds-record-cards-columns-wide` emitido sem consumidor | `tokens.ts:597` emite e `tokens.test.ts` assere **a emissão**; nenhum consumidor real (só um comentário em `HabitsTodayPanel.tsx:343`). É o padrão de asserção vácua que `HB-G-08` dizia ter corrigido | low |
| P13 | Citações obsoletas no checklist de paridade | `HB-C-08`/`HB-C-09` citam `RecordPage::multiplicador vazio remove a configuração (envia null)…`; o teste real é `:898 multiplicador vazio salva 1,00 (nunca null)…`. `HB-C-02`/`C-03`/`C-19` citam testes de outro comportamento | low |

### Descartados (verificação refutou a consequência)

| Achado | Por que cai |
|---|---|
| `weeklyBuckets` mesclaria semanas distintas | A entrada é ordenada em `habitsSurface.ts:340` (`[...dates].sort()`) ⇒ uma chave de segunda não pode reaparecer depois de outra; a comparação com a chave anterior é equivalente a indexar por semana |
| `var(--ds-*)` não resolveria em atributo de apresentação SVG (gráfico invisível/preto) | **Medido em Chromium real**: `stroke="var(--ds-primary)"` computa `rgb(51,102,204)`, idêntico à via CSS. O gráfico pinta certo. (A lacuna de *verificação* — nenhum teste observa a pintura — permanece como observação, não como defeito) |
| `--p` fora de 0..100 invalidaria o `color-mix` e apagaria o tom | **Medido em Chromium real**: o navegador **satura** — `--p:105` → primary cheio, `--p:-20` → surface cheio. Nenhuma célula perde fundo |
| `Nenhum hábito neste grupo.` seria tratamento divergente | `backend/habits/services.py:331-335` deriva `groups` **das** entries ⇒ grupo no payload sempre tem ≥1 linha. O ramo é inalcançável contra o backend real (só vive em payload sintético de teste); não é defeito de comportamento |
| Spec diz "remove a configuração" mas o código grava `1.00` | O conserto seria editar a spec desta build ⇒ descartado por regra do workflow. O código é o comportamento correto e o checklist já documenta a decisão |
| `addDays` reusa `isoLocalToday` (acoplamento de nome) | Nenhuma consequência para o consumidor; estilo |

### `defer` (pré-existente, fora do diff desta story)

Registrados em `deferred-work.md`: updater otimista de feriado destrói a distinção de fim de semana
(`api.ts:292`, arquivo que a story deliberadamente não toca — diff zero confirmado); `useOverrideDayWorkdayMutation`
sem `onSettled`/invalidate ⇒ falha parcial do `Promise.all` deixa a UI com multiplicadores velhos
(`api.ts:308-315`); `HabitEvolutionChart.tsx` e `habitSeriesView.ts` fora do `SOURCES` dos dois
guards de literais; `handle.title` morto na rota de redirect `settings/habits`.


## Design Notes

**Rota única × abas internas (decisão de implementação).** O spine é explícito: "principal única, sem rail de contexto, dividida em três abas" (`EXPERIENCE.md#Hábitos`), enquanto o legado usa três rotas em duas árvores diferentes. O caminho escolhido é o precedente já vivo no `ArchivePage`: **uma página, abas com estado na querystring**, e as rotas antigas viram redirect. Isso preserva deep link, o link de `SettingsPage` e os specs e2e que navegam por URL, sem inflar o manifest nem criar rota nova (o gate proíbe rota nova). `habits/history` **permanece** no `routes[]` do manifest — só o componente muda para o redirect — porque `shellRouting.test.ts` exige que toda rota do registry tenha entrada em `shellRoutes`, e `shellDestinations` deriva o destino de `routes[0]` (que continua sendo `habits`).

**A grade de tom contínuo, verbatim do mockup (`key-habitos.html:220-222`):**

```css
/* --p = completude da própria célula, 0..100, via style="--p:71" */
background: color-mix(in srgb, var(--ds-primary) calc(var(--p) * 1%), var(--ds-surface));
color:      color-mix(in srgb, <o mesmo fundo> 72%, var(--ds-ink));
```

Booleano "5/7" pinta a **71%** (a razão real), nunca 5%. Essa é a **única exceção nomeada ao piso de 4,5:1 do produto** (`EXPERIENCE.md#Accessibility Floor`), não extensível a nenhuma outra superfície — o que a sustenta é a redundância em volta: `caption`, `th scope` em linha e coluna, tags textuais FDS/FER e a **tabela equivalente permanente em `details`** na mesma superfície, em contraste normal. "Célula sem número é bug, não variante" permanece válido.

**Identidade × versionado é o coração da Configuração.** Nome/pictograma/unidade/grupo mudam direto e valem para todo o histórico; peso/meta/bônus/ativação abrem versão com efeito **a partir de hoje**, e a segunda mudança no mesmo dia **atualiza** a versão do dia em vez de criar outra. O aviso é texto persistente sob os campos versionados — **"Alteração válida a partir de hoje. Registros anteriores preservados."** — e nunca tooltip, porque tooltip não sobrevive a teclado nem a toque. Cuidado com a armadilha do legado: um único formulário dispara **duas** mutações diferentes (versão + identidade).

**Textos verbatim** (os testes asseram literalmente): `Nenhum hábito ativo hoje.` · `Nenhum hábito neste grupo.` (sem sugerir ação — grupo vazio é estado legítimo) · `Crie um grupo para começar a adicionar hábitos.` · `Nenhum registro no período.` · `Sem registro neste dia.` · `Sem conexão. Registrar e configurar hábitos exige rede.` · `Não foi possível salvar. Tente novamente.` · `Não foi possível carregar. Tente novamente.` · `Tratar este dia como dia útil (peso cheio)` · `Alteração válida a partir de hoje. Registros anteriores preservados.` · `Desativar hábito` / `Reativar hábito` · chip `Inativo`.

**Armadilhas conhecidas deste repo:**
- Rodar `nvm use 22.15.1` antes de qualquer comando de frontend/e2e (a sessão inicia em Node 18).
- `mockWideFaixa()` no `beforeEach` depois de `vi.resetAllMocks()` — o reset apaga o `matchMedia` global de `test-setup.ts` e `useMediaQuery` passa a devolver `undefined`.
- `Dialog` do MUI é portalizado: precisa de `slotProps.paper.style = shellCssVariables('light')` para enxergar as `--ds-*`.
- Botão primário precisa de cor explícita (`PRIMARY_BUTTON_SX`) — o `primary` do tema MUI legado reprova AA sobre `--ds-surface`.
- `registry.ts` e `shellRouting.ts` são **dados puros**: introduzir hook ou Query neles obriga a mockar Query em `AppLayout.test`, `router.test` e `RouteAnnouncer.test`.

**Fronteira consciente, deixada de fora:** `Sidebar.tsx:53` e `BottomNav.tsx:21` (chrome **legado**) lançam exceção se a entrada `habits` sumir do manifest — o mesmo acoplamento vale para `gratitude`. A AC de DIR-12c desta story cobre o **shell novo**, que é onde o módulo passa a viver e cuja derivação já é genérica; consertar o chrome legado seria mexer numa superfície que o Épico 18 aposenta.

## Verification

**Commands** (rodar `nvm use 22.15.1` antes; `cwd = frontend/`):
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0, zero warning novo
- `npm run test:run -- src/features/habits src/pages/habits src/app` -- expected: todos verdes, incluindo o guard `noLiteralTokens` e os mocks estendidos de `router.test.tsx`/`RouteAnnouncer.test.tsx`
- `npm run test:run` -- expected: suíte completa verde (gate cross-app)
- `CI=1 npx playwright test e2e/habits-record.spec.ts e2e/habit-tracker.spec.ts e2e/habit-history.spec.ts e2e/habit-multiplier.spec.ts` -- expected: todos passam (o Playwright sobe os servers sozinho contra o Postgres local `bujo_e2e`)

**Manual checks:**
- Comparar o resultado com `mockups/key-habitos.html` frames **F1–F9** e **E1–E6** (F10–F15, O1 e O2 estão fora do escopo desta story) e registrar cada divergência no checklist de paridade.

## Suggested Review Order

**A composição da superfície (comece aqui)**

- Entrada do design: uma rota, três abas em `?tab=`, um único `<main>`.
  [`HabitsRecordPage.tsx:82`](../../frontend/src/pages/habits/HabitsRecordPage.tsx#L82)

- Rotas antigas viram redirect; manifest preservado para o `shellRouting.test`.
  [`registry.ts:96`](../../frontend/src/app/collections/registry.ts#L96)

- `surfaceMigrated: true` nas três rotas — é o que remove o `LegacySeamNotice`.
  [`shellRouting.ts:85`](../../frontend/src/app/layout/shell/shellRouting.ts#L85)

**Aritmética e derivações puras (o coração testável)**

- Fatores congelados, parser decimal, buckets: nada aqui calcula completude.
  [`habitsSurface.ts:117`](../../frontend/src/features/habits/components/record/habitsSurface.ts#L117)

- Célula da grade: booleano usa a razão real; sem meta, tom não pinta.
  [`habitsSurface.ts:453`](../../frontend/src/features/habits/components/record/habitsSurface.ts#L453)

- `contributionFactor`: booleano com linha e valor nulo é 0, nunca lacuna.
  [`habitsSurface.ts:510`](../../frontend/src/features/habits/components/record/habitsSurface.ts#L510)

**Registro do dia (aba Hoje)**

- Otimismo restrito ao valor da linha; porcentagem só muda no refetch.
  [`HabitTrackerRow.tsx:116`](../../frontend/src/features/habits/components/record/HabitTrackerRow.tsx#L116)

- **Patch:** campo ressincroniza com o servidor sem pisar em erro pendente.
  [`HabitTrackerRow.tsx:104`](../../frontend/src/features/habits/components/record/HabitTrackerRow.tsx#L104)

- **Patch:** navegação de data indisponível offline (leitura impossível).
  [`HabitsTodayPanel.tsx:190`](../../frontend/src/features/habits/components/record/HabitsTodayPanel.tsx#L190)

- **Patch:** legenda do grupo vem do `dayType` do dia, não de `entries[0]`.
  [`HabitGroupCard.tsx:52`](../../frontend/src/features/habits/components/record/HabitGroupCard.tsx#L52)

**Histórico: gráfico, grade e a exceção de contraste**

- **Patch:** `% da meta` não é oferecida para booleano (série seria toda nula).
  [`HabitsHistoryPanel.tsx:77`](../../frontend/src/features/habits/components/record/HabitsHistoryPanel.tsx#L77)

- **Patch:** regra de nulo do gráfico alinhada à da tabela equivalente.
  [`HabitEvolutionChart.tsx:120`](../../frontend/src/features/habits/components/HabitEvolutionChart.tsx#L120)

- **Patch:** cabeçalho da coluna conta dias com registro, não dias corridos.
  [`HabitCompletionGrid.tsx:265`](../../frontend/src/features/habits/components/record/HabitCompletionGrid.tsx#L265)

- **Patch:** compact recupera a leitura por hábito (paridade com o legado).
  [`HabitCompletionGrid.tsx:152`](../../frontend/src/features/habits/components/record/HabitCompletionGrid.tsx#L152)

- Escala contínua de tom + tabela equivalente que sustenta a exceção.
  [`HabitCompletionGrid.tsx:399`](../../frontend/src/features/habits/components/record/HabitCompletionGrid.tsx#L399)

**Configuração: identidade × versionado**

- Um formulário, duas mutações distintas — a armadilha do legado.
  [`HabitsConfigPanel.tsx:290`](../../frontend/src/features/habits/components/record/HabitsConfigPanel.tsx#L290)

- Multiplicador vazio grava `1,00` (não remove) — divergência documentada.
  [`HabitsConfigPanel.tsx:174`](../../frontend/src/features/habits/components/record/HabitsConfigPanel.tsx#L174)

**Tokens e periféricos**

- Os 4 blocos de geometria do gate, emitidos como `--ds-*`.
  [`tokens.ts:290`](../../frontend/src/shared/design/tokens.ts#L290)

- Testes de regressão do ciclo de review (2 verificados por sabotagem).
  [`HabitsRecordPage.test.tsx:341`](../../frontend/src/pages/habits/HabitsRecordPage.test.tsx#L341)

- Guard estrutural de literais da subpasta nova, com não-vacuidade.
  [`noLiteralTokens.test.ts:1`](../../frontend/src/features/habits/components/record/noLiteralTokens.test.ts#L1)

- E2E das três abas contra o backend real.
  [`habits-record.spec.ts:1`](../../frontend/e2e/habits-record.spec.ts#L1)
