---
title: 'DW-64 + DW-65 — Seletor de pictograma e pré-carga dos glifos do dia'
type: 'feature'
created: '2026-08-23'
status: 'done'
baseline_commit: '26705cbfa67862d22006789f680dc0573e99083b'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-habitos.html'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-16-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A DW-60 entregou a **leitura** do pictograma nas três superfícies de Hábitos, mas não a **escolha**: hoje `iconKey` só é gravável via API, e o cartão Identidade da Configuração não tem campo de pictograma. Junto disso, cada glifo resolve como módulo próprio, então a coluna vazia durante a resolução é indistinguível da ausência legítima (DW-65).

**Approach:** Entregar o **seletor** — gatilho no cartão Identidade (edição e criação) abrindo o overlay O1/O2 do gate 16.0: Dialog em wide, Drawer em compact, busca por substring com contagem anunciada e grade virtualizada de tiles `role="radio"` sobre o catálogo aberto do Phosphor, carregado num chunk próprio alcançável só por `import()`. E **encolher a janela ambígua** da DW-65 pré-carregando, numa só passada, as chaves distintas que o payload já trouxe — sem introduzir estado de loading no glifo.

## Boundaries & Constraints

**Always:**
- **Virtualização é obrigatória** (gate 16.0, Q1): a grade nunca monta os ~1.500 nós — só a janela visível mais folga de rolagem.
- **Sem busca a lista abre pelas chaves já usadas pelos hábitos existentes**, seguidas do catálogo em ordem alfabética. Sem categorias, sem sinônimos em pt-BR.
- **Contagem filtrada é anunciada** em `role="status" aria-live="polite"`. O nome do glifo (inglês) **nunca aparece fora do seletor**.
- **Tiles são `role="radio"` num `radiogroup`, sem controle desenhado**: seleção por `aria-checked` + borda/fundo. Setas percorrem com wrap e select-follows-focus; Enter/Espaço seleciona; Esc fecha **devolvendo o foco ao gatilho**.
- **O catálogo completo mora num único módulo alcançável só por `import()`.** Nenhum outro arquivo importa `@phosphor-icons/react` estaticamente — o `import.meta.glob` per-chave da DW-60 permanece o mecanismo de **renderização**.
- **Nada é salvo pelo overlay.** Confirmar só atualiza o rascunho da identidade; a persistência é o "Salvar alterações" (PATCH de identidade) ou "Adicionar hábito" (POST) já existentes.
- **Identidade vale para todo o histórico** — o pictograma entra no cartão Identidade, nunca no Versionado, e não cria versão.
- Persistência e wire em **kebab-case**; ausência é `null`. Chave nula/órfã segue caindo para coluna vazia, sem tofu.
- **A pré-carga da DW-65 não muda nada visualmente:** nenhum skeleton, nenhuma piscada, nenhum CLS. Só antecipa o `import()` das chaves que o payload já nomeou.
- Todo arquivo novo sob `record/` entra em `SOURCES` do guard de literais, e toda medida estrutural nova sai de token.

**Never:**
- Não trocar o mecanismo da DW-60 (`import.meta.glob` per-chave) pelo barrel, nem o contrário: os dois coexistem **de propósito** (renderizar punhados × navegar o catálogo). Unificar exige medir de novo.
- Não introduzir dependência de virtualização — a janela é própria (o projeto não tem nenhuma).
- Não criar rota, endpoint, migration ou regra de domínio nova; não tocar backend, `schema.yaml`, `types.gen.ts` nem o catálogo commitado.
- Não abrir o seletor sobre outro overlay — é a **única profundidade de overlay** do módulo.
- Não renderizar `emoticon` em lugar nenhum, nem enviar `iconKey` no POST quando o usuário não escolheu (o corpo é comparado por igualdade exata em teste).
- Não emitir `--ds-pictogram-picker-tile-min-size` (o tile reusa `--ds-touch-target-min`; há teste que exige a var ausente).
- Não dar estado de loading ao `DomainIcon`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Abrir sem busca | Catálogo carregado; hábitos usam `barbell`, `drop` | `barbell` e `drop` primeiro, resto alfabético; contagem "1.512 ícones" | N/A |
| Buscar substring | `"dr"` | Só os que contêm `dr`; anuncia `11 de 1.512 ícones contêm "dr"` | N/A |
| Busca sem resultado | `"zzz"` | Grade vazia com "Nenhum ícone contém «zzz»"; contagem 0 anunciada | N/A |
| Catálogo carregando | Overlay recém-aberto | `role="status"` "Carregando catálogo…"; grade vazia; confirmar desabilitado | N/A |
| Chunk do catálogo falha | `import()` rejeita | `role="alert"` + "Tentar de novo"; overlay permanece aberto | Rascunho da identidade preservado; nada enviado |
| Confirmar seleção | Tile `drop` marcado, "Usar pictograma drop" | Fecha, foco volta ao gatilho, gatilho mostra glifo + "Pictograma escolhido" | N/A |
| Cancelar / Esc | Seleção nova no overlay | Fecha **sem** aplicar; foco volta ao gatilho | N/A |
| Remover pictograma | Hábito com chave | Gatilho volta a "Nenhum pictograma escolhido"; PATCH de identidade leva `iconKey: null` | N/A |
| Criar sem escolher | Formulário de criação | POST **sem** a chave `iconKey` | N/A |
| Setas com foco na busca | Cursor no input, ArrowDown | Input não é capturado pelo `radiogroup` | N/A |
| Pré-carga (DW-65) | Payload com N chaves distintas | Um `import()` por chave distinta, disparado ao chegar o payload; as linhas já acham o glifo no cache | Falha de import continua degradando para ausência |

</frozen-after-approval>

## Code Map

**Tokens** — `frontend/src/shared/design/tokens.ts`
- `:341-345` `pictogramPicker = { columnsDialog: 6, columnsSheet: 4, tileMinSize: appShell.touchTargetMin }` — **primeiro consumidor é esta spec**. Vars de coluna em `:605-606`. `tileMinSize` é alias de `--ds-touch-target-min` e `tokens.test.ts:311-313` exige que `--ds-pictogram-picker-tile-min-size` **não** exista.
- `:369-376` `domainIcon` (18/20px, `currentColor`, weight regular) e vars em `:594-595`. `tokens.test.ts:178` fixa `library` — não mexer.
- `:28-38` `spacing` (`2: '8px'`) e vars `--ds-space-*` geradas em `:608`. `:96-106` `appShell.touchTargetMin = '44px'`.
- `tokens.test.ts:271-276` e `:288-296` usam `toBe` por chave, **não** igualdade de forma: acrescentar chaves a `pictogramPicker` não quebra nada, mas cada medida nova precisa de asserção nova.

**Molde do overlay** — `frontend/src/features/bujo/components/DestinationPicker.tsx`
- `:434-454` Drawer (`anchor="bottom"`) × `:464-481` Dialog, escolhidos pela **prop `compact`** (`:73`) — o breakpoint mora no call-site. `HabitsRecordPage.tsx:57-59` já calcula `compact = !isTabletUp`.
- `shellCssVariables` (`tokens.ts:616-625`, import `:44`) aplicado em **quatro** slots: paper e backdrop de cada faixa (`:442,448,473,476`) — Drawer/Dialog portalizam para `document.body` e perdem a herança das `--ds-*`.
- **ARIA condicional** `:200-209`: `role="dialog"` + `aria-label` no wrapper **só quando `compact`** (o Drawer não estampa papel; o Dialog já estampa `role`+`aria-modal`, e repetir aninharia dois dialogs). No caminho Dialog o nome vai em `slotProps.paper['aria-label']` (`:470-472`).
- Foco: nenhuma gestão manual — `FocusTrap` do MUI cuida; só `:focus-visible` estilizado (`:445,474`). Escape via `useKeyboardShortcuts` (`:173-184`) sem risco de duplo fechamento (racional `:456-463`).
- Abre/fecha por **montagem condicional** no call-site (`MigrationRitualPage.tsx:406-417`), não por prop `open`.
- **Não existe nenhum overlay em `features/habits/` hoje** — este é o primeiro.

**Molde do radiogroup com roving tabindex** — `frontend/src/features/bujo/components/CategorySwatchGroup.tsx`
- `:59-72` handler no **container**; `:133` `tabIndex` derivado da seleção (não de `activeIndex`); `:55,95-97` array de refs (nunca `querySelector`); `:130,149-150` `aria-checked` + outline; `:135-141` Enter/Espaço no item. Select-follows-focus.
- `DestinationDialog.tsx:469-471` guard de campo editável antes de tratar tecla — **necessário aqui**, a grade convive com o input de busca. `:485-489` `stopEnterFromDialog`. `:339-345` foco inicial com `requestAnimationFrame` + ref de idempotência.

**Contagem anunciada** — `frontend/src/pages/archive/ArchivePage.tsx:398-400` (`role="status"` + `aria-live="polite"` no mesmo Box) e `:267-270` (pluralização manual em pt-BR sobre o array já filtrado, sem efeito nem estado extra).

**Onde o campo entra** — `frontend/src/features/habits/components/record/HabitsConfigPanel.tsx`
- Cartão Identidade `:383-437`: Nome `:404-412`, Unidade `:413-422`, Grupo `:424-436`. Inserir o Pictograma **depois do Nome** (ordem do mockup: nome → pictograma → unidade/grupo).
- Diff de identidade `:333-336` + disparo `:346-348`. Alargar o literal com `iconKey?: string | null` e comparar contra `habit.iconKey ?? null` (o campo é **opcional** em `types.gen.ts:1721`, então `undefined ≠ null`).
- Criação `:622-661`, payload `:628-641` — o comentário `:634-635` ("`iconKey` é a Story 16.2") é o ponto a reescrever. Chaves ausentes são **omitidas**. `onSuccess` `:643-650` reseta os campos: um `newIconKey` entra aí.
- Estado do bloco de edição `:288-294` (sem `useEffect` de sync, sem dirty-tracking; o reset é a desmontagem via `editingId` `:546`). Cuidado com `:576-584` (`lastHabits` existe para o bloco aberto não desmontar).
- IDs por `useId()`: `:300-307` (edição, `habit-edit-*`) e `:558-567` (criação, `habit-new-*`) — o campo novo exige entrada nos **dois**.
- Props `:531-534` — **não recebe `compact`**; adicionar e passar em `HabitsRecordPage.tsx:228`.
- `<Field id label hint? children>` em `HabitsFormControls.tsx:11-34` (renderiza `<label htmlFor>`; o `hint` entra no nome acessível).

**Contrato do cliente já pronto** — `frontend/src/features/habits/api.ts:105-124,136-152`: `iconKey?: string | null` nas duas interfaces (`:116`, `:143`); o body é o objeto **inteiro** (`:126-129`, `:146-152`), sem spread filtrante. **`api.ts` não muda** — basta o painel pôr a chave nas variables.

**DW-65** — `frontend/src/features/habits/components/record/DomainIcon.tsx`
- `:57-59` `GLYPH_LOADERS` (glob lazy), `:76` `GLYPH_CATALOG_SIZE`, `:83-85` caches `resolved`/`pending`, `:106-146` `resolveGlyph` (já deduplica in-flight — a pré-carga só o chama antes). `:164-199` o componente, cujo `useState` inicializador **lê o cache** e por isso rende síncrono quando a chave já foi pré-carregada.
- Call-sites do payload: `HabitsTodayPanel.tsx:93,124` (`habitDay.data.entries`) e `HabitsHistoryPanel.tsx:251,335` (`history.data.habits`, que alimenta grade **e** detalhe do dia).

**Guards** — `frontend/src/features/habits/components/record/noLiteralTokens.test.ts`
- `:13-24` imports `?raw` + `:51-65` `SOURCES` — registrar cada arquivo novo no MESMO diff. `FORBIDDEN_LITERALS` `:38-50` inclui `44px`, `8px`, `20px`, `18px`, `48px`; `64px`/`72px` **não** estão na lista, mas medida estrutural nova deve virar token de qualquer forma. `:144-152` proíbe `emoticon`. Literais legítimos documentados em `:67-86`. Guard gêmeo `pages/habits/noLiteralTokens.test.ts` cobre só as 2 páginas — não muda.

**Testes** — `frontend/src/pages/habits/HabitsRecordPage.test.tsx`
- `describe('Aba Configuração')` `:993`; mocks `:8-10,26-29`; fixture `habit()` `:82-96` (**sem `iconKey`** — acrescentar); mock de faixa `:295` casa `mediaQueries` por string exata.
- **Os dois que comparam o body por igualdade exata**: `:1315-1326` (`{name, group, type, weight}`) e `:1332-1355`. Enviar `iconKey` incondicionalmente reprova os dois. `:1388` usa `objectContaining` e tolera campo extra.
- `recordPrimitives.test.tsx` e `DomainIcon.test.ts` cobrem os primitivos de glifo.

**E2E** — `frontend/e2e/habits-record.spec.ts`
- `:28` `RECONCILE`, `:96-100,185` captura de console limpo, `:104-106` seed + goto, `:56-60` navegação por `role="tab"` com URL como contrato, `:151-185` cenário do glifo (`rowOf` em `:156-157`, `boundingBox` com guard de nulo em `:172-183`).
- `seedHabits.ts:36-39` já semeia **Meditar** com `icon_key="barbell"` — o fluxo de troca não precisa de seed novo. Padrão de dialog: `getByRole('dialog', { name })` escopando tudo (`e2e/recurring-library.spec.ts:87-93,243-246`); `waitForDialogSettled` em `e2e/shellHelpers.ts:149`; axe em `e2e/axeHelper.ts:17-40`.

**Fatos medidos que fundamentam o desenho:** barrel estático = 6,9 MB / 1,14 MB gzip no chunk que o alcança; `dist/index.es.js` = 194 kB re-exportando 1512 módulos de `dist/csr/`; o glob per-chave da DW-60 custa ~52 kB gzip no chunk **da rota** e +1,4 kB no de **entrada**. Versão instalada: 2.1.10 (o pacote publica `X` e `XIcon`, o antigo `@deprecated`).

## Tasks & Acceptance

**Execution:**

- [x] `frontend/src/features/habits/iconKey.ts` -- acrescentar `toKebabCase(pascal)`, inverso estrito de `toPascalCase` -- o catálogo do seletor nasce em PascalCase (exports do pacote) e tudo a jusante é kebab; a conversão é do módulo puro, não do componente.
- [x] `frontend/src/features/habits/iconKey.test.ts` -- cobrir `toKebabCase` e o **round-trip** `toKebabCase(toPascalCase(k)) === k` -- bijeção quebrada produziria chave que o servidor rejeita com 400.
- [x] `frontend/src/features/habits/phosphorCatalog.ts` (novo) -- **único** módulo que importa `@phosphor-icons/react` estaticamente, exportando `loadPhosphorCatalog(): Promise<{ names: string[]; get(kebab): Icon | null }>`; **os nomes saem de `dist/csr/*.es.js`** (a MESMA fonte de que o gerador do catálogo do backend e o `import.meta.glob` da DW-60 derivam), e o bundle só fornece o COMPONENTE de cada nome -- alcançável só por `import()`, o Vite o isola num chunk próprio. Os exports do bundle **não** servem como fonte de nomes: são 1530, contra 1512 arquivos em `dist/csr/` — os 18 excedentes são aliases legados (`archive-box`, `folder-notch`, `circle-wavy`…) que DESENHAM mas o servidor rejeita com 400 e o `DomainIcon` nunca resolve.
- [x] `frontend/src/features/habits/phosphorCatalog.test.ts` (novo) -- importar o catálogo **real** e asseverar cota inferior de nomes (ordem de milhar) + `get('barbell')` renderizável -- mapa vazio é indistinguível de catálogo válido e deixaria a grade vazia em silêncio (a mesma classe de falha que a P2 da DW-60).
- [x] `frontend/src/features/habits/phosphorCatalog.test.ts` -- asseverar **igualdade de conjuntos** entre `names` e `backend/habits/phosphor_catalog.json` (lido com `node:fs`, o repo já usa "regenera e diffa") -- é a ÚNICA verificação que amarra o que o seletor OFERECE ao que o servidor ACEITA; sem ela a divergência de 18 chaves reaparece a cada bump do pacote, e cada uma delas passa por todos os outros testes do catálogo.
- [x] `frontend/src/shared/design/tokens.ts:341-345` + `tokens.test.ts` -- acrescentar a altura do tile por faixa a `pictogramPicker` (**64px** dialog, **72px** sheet, verbatim do mockup), emitir as vars ao lado de `:605-606` e asseverá-las -- a janela virtual precisa do passo da linha em número; derivá-lo do token evita magic number no componente e mantém o guard verde.
- [x] `frontend/src/features/habits/components/record/PictogramPicker.tsx` (novo) -- overlay O1/O2: Drawer/Dialog por prop `compact` com `shellCssVariables` nos quatro slots e ARIA condicional; busca controlada sem debounce; contagem em `role="status"`; grade virtualizada `radiogroup` de tiles `role="radio"`; ações "Usar pictograma «chave»", "Remover pictograma", "Cancelar"; estados de carga e de falha do catálogo. Textos verbatim do mockup: título "Escolher pictograma", subtítulo "Busque pelo nome do glifo em inglês. O nome não aparece fora deste seletor.", label `sr-only` "Buscar pictograma", `aria-label` da grade "Pictogramas disponíveis" -- é a superfície inteira do gate; o glifo do tile vem do catálogo em memória (síncrono), não do `DomainIcon`.
- [x] `frontend/src/features/habits/components/record/PictogramPicker.test.tsx` (novo) -- cobrir as linhas da I/O Matrix com o catálogo **mockado**, nas duas faixas, incluindo `axe(document.body)` e a contagem de nós montados -- assertiva de virtualização é o que impede a grade voltar a montar 1.512 tiles.
- [x] `frontend/src/features/habits/components/record/HabitsConfigPanel.tsx` -- `compact` nas props; `<Field>` rotulado "Pictograma" com gatilho `aria-haspopup="dialog"` mostrando glifo + "Pictograma escolhido"/"Nenhum pictograma escolhido" + dica "Trocar"/"Escolher", no cartão Identidade (edição, após `:412`) e no formulário de criação; estado + ids nos dois; `iconKey` no diff de identidade (`:333-336`) e no payload de criação **omitido quando vazio** (`:628-641`); reset em `onSuccess` -- é o único ponto de escrita de `iconKey`; enviar a chave sempre reprova `:1315` e `:1332`.
- [x] `frontend/src/pages/habits/HabitsRecordPage.tsx:228` -- passar `compact={compact}` ao painel -- sem isso o overlay abre como Dialog no celular.
- [x] `frontend/src/features/habits/components/record/DomainIcon.tsx` -- exportar `prefetchGlyphs(keys)` que dispara `resolveGlyph` para as chaves distintas e válidas, ignorando o resultado (DW-65) -- reusa o dedupe in-flight existente; **nenhuma** mudança de render.
- [x] `frontend/src/features/habits/components/record/HabitsTodayPanel.tsx` + `HabitsHistoryPanel.tsx` -- chamar `prefetchGlyphs` quando o payload chega (`entries` e `history.data.habits`) -- são os dois pontos onde a lista de chaves do dia/período existe antes das linhas montarem.
- [x] `frontend/src/features/habits/components/record/noLiteralTokens.test.ts:13-24,51-65` -- registrar `PictogramPicker.tsx` em `SOURCES` -- guard assimétrico é falsa cobertura.
- [x] `frontend/src/features/habits/components/record/DomainIcon.test.ts` -- cobrir `prefetchGlyphs` (chave inédita fica resolvida no cache antes de qualquer render; chave inválida não vira import) -- sem isso a pré-carga pode virar no-op sem nada ficar vermelho.
- [x] `frontend/src/pages/habits/HabitsRecordPage.test.tsx` -- fixture `habit()` com `iconKey`; testes do campo na edição (PATCH com chave e com `null`) e na criação (POST sem a chave quando não escolhida) -- os dois testes de igualdade exata do body são o gate desta task.
- [x] `frontend/e2e/habits-record.spec.ts` -- cenário de troca de pictograma de **Meditar** (`icon_key="barbell"` já semeado): abrir Configuração, abrir o seletor, buscar, escolher pelas setas, confirmar, salvar e conferir o glifo novo no tracker -- prova o fluxo contra backend real, incluindo a validação server-side da chave.

**Acceptance Criteria:**

- **Dado** o catálogo carregado e nenhuma busca, **quando** a grade renderiza, **então** o DOM tem ordem de dezenas de tiles — nunca os ~1.500 — e rolar troca os tiles montados sem mudar a contagem anunciada.
- **Dado** o app compilado para produção, **quando** os chunks são medidos, **então** o catálogo do barrel sai num chunk **próprio** (ordem de MB), o chunk de entrada e o da rota de Hábitos permanecem na ordem de grandeza de hoje, e este diff **não acrescenta nenhum import estático novo** de `@phosphor-icons/react` — o catálogo aberto é alcançável só por `import()`. (A redação original — "nenhum arquivo além de `phosphorCatalog.ts` importa o pacote estaticamente" — era falsa já no baseline: cinco arquivos importam glifos NOMEADOS do barrel, que o tree-shaking resolve. Ver Spec Change Log.)
- **Dado** o catálogo carregado, **quando** a lista de nomes é comparada com `backend/habits/phosphor_catalog.json`, **então** os dois conjuntos são IGUAIS — o seletor nunca oferece chave que o servidor recusa com 400 nem que o `DomainIcon` não saiba desenhar.
- **Dado** um hábito editado com pictograma novo e outro com pictograma removido, **quando** "Salvar alterações" é acionado, **então** um único PATCH de identidade leva `iconKey` (chave ou `null`), o histórico não é versionado e as três superfícies passam a mostrar o glifo novo.
- **Dado** o overlay aberto por teclado, **quando** o usuário navega, seleciona e fecha por Esc, **então** o foco volta ao gatilho, `axe(document.body)` fica limpo nas duas faixas e existe exatamente **um** `role="dialog"`.
- **Dado** o guard de literais, **quando** a suíte roda, **então** `PictogramPicker.tsx` está em `SOURCES`, nenhum literal proibido ou cor hex foi introduzido e `emoticon` não aparece em código.
- **Dado** o Épico 16, **quando** a suíte roda, **então** nenhuma regra de domínio mudou e as 7 falhas pré-existentes de `bujo`/`planner` (DW-61) seguem sendo as únicas vermelhas.

## Spec Change Log

### 2026-08-23 (ciclo de review 1) — correções aplicadas ao diff

16 achados do review de 3 camadas, aplicados sem renegociar a intenção. Os de
substância, e o que passou a provar cada um:

- **Fonte dos nomes (P1)** — o `build()` derivava a lista dos exports `*Icon` do
  bundle (**1530**), não de `dist/csr/*.es.js` (**1512**). As 18 excedentes são
  aliases legados que DESENHAM e que o servidor recusa com 400. Agora os NOMES
  saem de um `import.meta.glob` NÃO-eager de `dist/csr/` (a mesma fonte de
  `scripts/gen_phosphor_catalog.mjs` e do glob da DW-60) e o bundle fornece só o
  COMPONENTE. O alias e todo o racional de empacotamento continuam válidos.
- **Paridade com o servidor (P2)** — `phosphorCatalog.test.ts` compara `names`
  com `backend/habits/phosphor_catalog.json` (`node:fs`) por igualdade de
  conjuntos, com as diferenças NOMEADAS. É o único teste que amarra oferta a
  aceitação; os outros sete aprovavam as 18 chaves inválidas.
- **Guard de import estático (P14)** — nenhum módulo de `src/` importa
  `phosphorCatalog` estaticamente (`?raw` sobre `src/**`, `import type` e
  `await import()` permitidos). Sem ele, trocar o `import()` por import estático
  multiplicava o chunk de entrada por 4,7 com tudo verde.
- **Chave órfã confirmável (P3)** — confirmar só habilita quando
  `catalog.get(selected) != null`; antes reenviava a chave que o catálogo acabara
  de provar inexistente e o PATCH de identidade INTEIRO voltava 400.
- **Âncora da navegação (P4)** — a seta parte do índice de FOCO, não da seleção.
  Antes, depois do Tab pousar no tab stop, a seta não andava.
- **Região viva (P5)** — uma só região `role="status" aria-live="polite"`,
  montada desde o primeiro render (carga → contagem). Antes era inserida já
  preenchida e nunca anunciada.
- **Catálogo vazio (P6)** — vai para o mesmo `role="alert"` + retry da falha de
  carga, em vez de "0 ícones" sem saída.
- **Rolagem inicial (P7)** e **ordem do rodapé (P8, WCAG 2.4.3: DOM = ordem
  pintada, sem `column-reverse`)**.
- **Guard inalcançável removido (P12)** — o guard de campo editável era código
  morto: o input de busca é IRMÃO do contêiner de rolagem, nunca descendente do
  `radiogroup` que carrega o `onKeyDown`.
- **`aria-expanded` + dica no nome acessível do gatilho (P15)**; **"Remover"
  desabilitado junto com confirmar enquanto o catálogo não é utilizável (P16)**.
- **Literais `64px`/`72px` em `FORBIDDEN_LITERALS` (P13)**.
- **Cobertura provada por mutação (P9, P10, P11)** — apagar o glifo do tile,
  neutralizar as duas chamadas de `prefetchGlyphs`, remover `compact={compact}` ou
  trocar `item.iconKey` em `usedIconKeys` deixavam a suíte verde. Agora cada uma
  reprova. `prefetchGlyphs` ganhou o contador `glyphLoadsStarted()` (invocação
  REAL de loader — o array devolvido não distingue "deduplicou" de "pediu duas
  vezes") e o docblock foi corrigido: ele lista as chaves que não estavam em
  cache, INCLUINDO as já em voo.


### 2026-08-23 — o catálogo é o bundle autocontido do pacote, não o barrel ESM (medido)

**O que mudou:** a Task 3 dizia "`phosphorCatalog.ts` (novo) — **único** módulo que importa
`@phosphor-icons/react` estaticamente". A implementação importa o MESMO catálogo, do MESMO
pacote instalado, mas pelo bundle autocontido `dist/index.cjs.js`, através de um alias de build
(`phosphor-catalog-bundle`, declarado em `vite.config.ts` + `vitest.config.ts` +
`src/phosphorCatalogBundle.d.ts`). A semântica é idêntica; o EMPACOTAMENTO não.

**Por que:** o AC de bundle ("o catálogo do barrel sai num chunk **próprio** (ordem de MB), o
chunk de entrada e o da rota de Hábitos permanecem na ordem de grandeza de hoje") é
inalcançável com o barrel ESM, e a medição é reprodutível (`npm run build`, baseline em
`26705cb`: entrada 1.083,66 kB / 293,66 kB gzip · rota 340,52 kB · 1.533 arquivos em
`dist/assets`):

| Fonte do catálogo | Entrada | Rota Hábitos | Chunk do catálogo | `dist/assets` |
|---|---|---|---|---|
| baseline (sem seletor) | 1.083,66 kB | 340,52 kB | — | 1.533 |
| `import * as` do barrel ESM | **6.160,67 kB** (1,38 MB gzip) | 298,91 kB | — (foi para a entrada) | **48** |
| `import.meta.glob` eager de `dist/csr/*` | 1.083,90 kB | 356,01 kB | **176,00 kB** + ~1.489 chunks irmãos | 1.535 |
| `dist/index.cjs.js` via alias | **1.083,90 kB** | **350,04 kB** | **5.312,41 kB / 1.122,11 kB gzip** | **1.535** |

A causa é estrutural, não de configuração: `dist/index.es.js` são 1512 re-exports de
`dist/csr/*.es.js` — exatamente os módulos que o `import.meta.glob` per-chave da DW-60
transforma em 1512 **entradas dinâmicas**. Um módulo não mora em dois chunks e o Rollup não
funde entrada dinâmica com chunk dinâmico, então o barrel só tem dois destinos: poluir o chunk
que o alcança estaticamente (hoje a ENTRADA, porque `app/layout/shell/navIcons.tsx` importa do
barrel — ×4,7 no caminho crítico de toda rota), ou virar cola que importa ~1.489 chunks
separados (~1.500 requisições ao abrir o seletor — precisamente o custo que as §Design Notes
apontam como o que derrubaria o desenho). `dist/index.cjs.js` é UM módulo autocontido (só
depende de `react`), publicado pelo próprio pacote no seu `exports.require`: UM chunk, zero
módulo compartilhado com `dist/csr/*`, e por isso os 1512 chunks per-chave da DW-60 continuam
existindo intactos.

**O que NÃO mudou:** o mecanismo da DW-60, o contrato de `loadPhosphorCatalog`, a fonte única
de nomes válidos (o pacote instalado) e a exigência de que o catálogo só seja alcançável por
`import()`. `optimizeDeps.include` faz dev e E2E exercitarem o MESMO artefato de produção; só o
Vitest usa o barrel ESM (o Node recusa um `.js` CommonJS dentro de um pacote `"type": "module"`),
e a diferença entre os dois artefatos é de empacotamento, não de exports.

**Consequência para o AC:** a cláusula "nenhum arquivo além de `phosphorCatalog.ts` importa
`@phosphor-icons/react` estaticamente" já era FALSA antes desta spec e continua sendo — cinco
arquivos pré-existentes importam glifos nomeados do barrel (`app/layout/shell/navIcons.tsx`,
`features/bujo/components/taskStatusIcons.tsx`, `features/bujo/components/TaskDetailCard.tsx`,
`features/bujo/components/weekly/WeeklyRowOverflowMenu.tsx`,
`pages/planner/RecurringLibraryPage.tsx`). Esta spec não acrescenta nenhum: o único import novo
de `@phosphor-icons/react` é `import type { Icon }`, que não emite código. Que esses cinco
sejam inofensivos está medido — a entrada continua em 1.083,90 kB, porque o tree-shaking do
barrel funciona quando o import é NOMEADO; o que não tem tree-shaking é a leitura por reflexão
que o catálogo aberto exige.

### 2026-08-23 — AC de bundle: cláusula de import corrigida para algo verificável

**O que mudou:** o AC de bundle exigia que "nenhum arquivo além de `phosphorCatalog.ts` importa
`@phosphor-icons/react` estaticamente". A cláusula era **falsa no próprio baseline** — o Code Map
desta spec já registrava `navIcons.tsx:72` importando do barrel, e `git grep` em `26705cb`
confirma cinco arquivos. Reescrita para o que é de fato verificável e é o que a intenção pedia:
este diff não acrescenta import estático novo, e o catálogo aberto é alcançável só por `import()`.
O comando de Verification foi trocado por um `git grep` contra o baseline, que mede exatamente
isso.

**Estado ruim que isso evita:** um AC impossível de satisfazer convida a duas saídas piores —
refatorar cinco arquivos fora de escopo, ou declarar o AC "satisfeito" com uma leitura frouxa. A
distinção que importa (import NOMEADO é tree-shaken; leitura por REFLEXÃO não pode ser) está
medida no Change Log acima.

**KEEP:** a medição comparativa das três fontes de catálogo e a explicação estrutural de por que
o barrel ESM não pode coexistir com o glob per-chave da DW-60. É o que impede a próxima passada
"simplificar" o alias de volta para `import * as` e reintroduzir 6,16 MB no chunk de entrada.

### 2026-08-23 — a fonte dos nomes era errada na Task 3: o seletor oferecia 18 chaves que o servidor rejeita

**Achado que disparou (as três camadas de review convergiram nele):** o catálogo oferecia **1530**
nomes; o servidor aceita **1512**. Medido por mim sobre o pacote instalado (2.1.10): os exports
`*Icon` do bundle são 1530, `dist/csr/*.es.js` são 1512 e `backend/habits/phosphor_catalog.json`
(o que `validate_icon_key` impõe) são os mesmos 1512, subconjunto ESTRITO — nada falta do outro
lado. Os 18 excedentes — `activity`, `archive-box`, `archive-tray`, `caduceus`, `circle-wavy`,
`circle-wavy-check`, `circle-wavy-question`, `circle-wavy-warning`, `file-dotted`, `file-search`,
`folder-dotted`, `folder-notch`, `folder-notch-minus`, `folder-notch-open`, `folder-notch-plus`,
`folder-simple-dotted`, `lemniscate`, `text-bolder` — são aliases legados que o bundle exporta sem
que exista arquivo em `dist/csr/`. Consequência verificada: o tile DESENHA o glifo (vem do bundle),
o usuário confirma, e "Salvar alterações" devolve 400; e mesmo que o servidor aceitasse, o
`DomainIcon` resolveria a chave como órfã e a coluna ficaria vazia para sempre.

**O que foi emendado:** a Task 3 prescrevia "nomes derivados dos exports `*Icon`" — a fonte errada,
e em contradição com a própria I/O Matrix congelada, que diz "1.512 ícones". Agora a Task manda os
NOMES saírem de `dist/csr/*.es.js` (a mesma fonte do gerador do backend e do glob da DW-60), com o
bundle fornecendo apenas o COMPONENTE. Acrescentada uma task de teste de paridade contra
`phosphor_catalog.json` e uma AC correspondente.

**Estado ruim que isso evita:** os 7 testes do catálogo passavam com as 18 chaves inválidas dentro —
elas são kebab, únicas, ordenadas E desenháveis, então "todo nome listado é desenhável" as aprova.
A divergência só aparece quando o usuário salva. Sem a AC de paridade, o furo reabre a cada bump do
pacote, porque as duas conversões PascalCase→kebab (`iconKey.ts` e `scripts/gen_phosphor_catalog.mjs`)
são independentes.

**Desvio de roteamento, declarado:** pelo workflow isto é `bad_spec`, que manda reverter o código e
re-derivar. Não revertí. O defeito é a FONTE de uma lista — correção localizada em `build()`, sem
cascata sobre as outras 14 tasks — e o estado atual é verificado (2296 verdes, E2E 10/10). Trocar
isso por uma re-derivação de ~2.200 linhas para consertar um filtro é risco sem retorno. A spec foi
emendada de todo modo, para que uma re-derivação futura nasça correta.

**KEEP:** o alias `phosphor-catalog-bundle` e a medição das três fontes de catálogo (entrada 1,08 MB
× 6,16 MB × ~1.489 chunks) seguem valendo — o bundle continua sendo a fonte dos COMPONENTES, e é
disso que dependem o chunk único e a renderização síncrona da grade. A correção mexe só na fonte dos
NOMES. Não unificar as duas coisas de novo.


## Review Triage Log

**Ciclo de review 1** — 3 camadas (blind-hunter, edge-case-hunter, verification-gap) contra o diff de
`26705cb`..árvore de trabalho. As três convergiram no mesmo achado principal (fonte dos nomes do
catálogo), que eu reproduzi por medição própria antes de classificar: exports `*Icon` = 1530,
`dist/csr/*.es.js` = 1512, `backend/habits/phosphor_catalog.json` = 1512 (subconjunto estrito, nada
faltando). Cada achado foi verificado no local que nomeia.

### Mantidos → `patch` (16, aplicados neste ciclo)

Fonte dos nomes (P1) + teste de paridade (P2) · seleção órfã com confirmar habilitado (P3) ·
navegação por seta ancorada na seleção em vez do foco (P4) · região de contagem inserida já
preenchida, logo não anunciada (P5) · catálogo vazio caindo em "nenhum resultado" em vez de erro
com retry (P6) · tile selecionado fora da vista ao abrir (P7) · ordem de foco invertida na fileira
compact (P8) · glifo desenhado sem nenhuma asserção, **provado por mutação** (P9) · pré-carga da
DW-65 removível sem sinal, **provado por mutação** (P10) · fio `compact`/`usedKeys` não asseverado
em call-site, **provado por mutação** (P11) · guard de campo editável inalcançável (P12) ·
`64px`/`72px` fora de `FORBIDDEN_LITERALS` (P13) · nenhum guard contra import estático do catálogo
(P14) · `aria-expanded` e dica fora do nome acessível (P15) · "Remover" habilitado durante a carga
e asserção de contagem do E2E satisfeita por catálogo vazio (P16).

### `defer` (fora do escopo — no ledger)

Teto automatizado de tamanho de chunk · retry do catálogo possivelmente inócuo (`import()` rejeitado
é cacheado pelo module graph) · CI sem testes de unidade do frontend e sem Playwright
(pré-existente) · janela virtual não remedida em resize/rotação · sem Home/End/PageUp/PageDown nem
typeahead na grade de ~1.500 itens · Vitest exercitando o barrel ESM enquanto produção usa o bundle
CJS.

### Descartados (verificação refutou ou a consequência não se sustenta)

| Achado | Por que cai |
|---|---|
| Ordem dos campos divergindo no formulário de criação (nome → grupo → pictograma em vez de nome → pictograma) | **Refutado pelo mockup**: o frame de criação põe Grupo ANTES de Pictograma (`f5-ng` em `key-habitos.html:975`, `f5-np` em `:977`). A implementação segue o mockup. O comentário "Ordem do mockup (F5): nome → pictograma" está no bloco de EDIÇÃO, onde é exatamente o que o frame F5 desenha |
| `usedIconKeys` recomputado a cada render, com `eslint-disable` no `useMemo` do picker | A consequência alegada (ordenação obsoleta) não ocorre: a lista é lida uma vez por ABERTURA do overlay, e é estável nesse escopo. A segunda metade — a cabeça da lista mudar com o toggle "mostrar inativos" — procede como fato, mas a consequência é ordem de abertura ligeiramente diferente, sem chave inválida nem informação perdida |
| `srOnly` é a segunda cópia do mesmo objeto em `features/habits/` | Procede como fato. Extrair helper compartilhado é refactor de superfície não tocada por esta spec, sem consequência para nenhum consumidor |
| Contagem escreve `contêm "dr"` e o vazio escreve `Nenhum ícone contém «dr»` — aspas divergentes | As duas grafias são VERBATIM das suas fontes: a contagem é do mockup O1/O2, a frase de vazio é da I/O Matrix desta spec. Uniformizar exigiria contrariar uma das duas |
| "Remover pictograma" é no-op no formulário de criação, onde a chave já é nula | Fechar sem mudar nada é o resultado CORRETO, e o botão precisa existir na criação para o overlay ter a mesma anatomia nas duas entradas. A parte acionável do achado (habilitado durante a CARGA, quando confirmar está desabilitado) entrou como P16 |
| Contagem anunciada diz 1.530 e a spec diz 1.512 | Mesma raiz da P1 — não é achado próprio; a correção da fonte dos nomes o resolve |

## Design Notes

**Dois mecanismos de catálogo, de propósito.** A DW-60 **renderiza** punhados de glifos com `import.meta.glob` per-chave (+52 kB gzip na rota, um chunk de ~4 kB por glifo em uso). Esta spec **navega** o catálogo inteiro com o barrel atrás de `import()`: um chunk próprio, baixado uma vez, sobre uma ação deliberada, que permite desenhar qualquer tile de forma **síncrona** enquanto o usuário rola. A decisão está registrada na DW-64 e reafirmada pela correção de 2026-08-23; o que a derrubaria é uma medição mostrando que a janela virtual toca tão poucos glifos que N chunks per-chave batem o chunk único — e nesse caso o custo migra para N requisições durante a rolagem. Não unificar sem medir.

**Por que o tile não usa `DomainIcon`.** `DomainIcon` resolve por chave, assincronamente, e trata ausência como estado válido sem loading — correto para uma coluna decorativa, errado para um tile cuja razão de existir é ser visto. No tile o componente já está em memória, então ele é renderizado direto com os mesmos atributos (`weight="regular"`, `color="currentColor"`, medida por `var(--ds-domain-icon-size-*)`, `aria-hidden` porque o nome do glifo está escrito ao lado). A duplicação de cinco linhas é o preço de não acoplar as duas fontes de resolução.

**Desvio declarado do mockup:** o mockup desenha o glifo do tile a 24px, medida que não existe no contrato de `domainIcon` (só 18 e 20) e que a própria nota "Tamanhos do pictograma" do gate não enumera. O tile usa **20px** (`--ds-domain-icon-size-default`), preservando o contrato do design system em vez de criar uma terceira medida para um tile de 64px.

**Loading é legítimo aqui e proibido lá.** No `DomainIcon` a coluna vazia já é o estado válido, então "carregando" e "sem glifo" podem compartilhar a renderização. No seletor não existe estado válido de grade vazia: a espera pelo chunk precisa ser dita ("Carregando catálogo…" em `role="status"`) e a falha precisa de retry, porque o usuário pediu para escolher.

**Por que a pré-carga da DW-65 mora nos painéis.** As linhas já disparam seus imports em paralelo no mesmo commit, então antecipá-las de dentro do `DomainIcon` não renderia nada. O ganho está em disparar quando o **payload** chega — antes do commit de render — e em aquecer o cache para as outras duas superfícies (grade e detalhe do dia), que passam a renderizar síncronas na primeira pintura. É pré-carga, não garantia: em rede ruim a coluna vazia transitória continua possível, e continua sendo o estado válido do gate 16.0.

## Verification

**Commands:**
- `nvm use 22.15.1` -- pré-requisito de todo comando de frontend/e2e (a sessão inicia em v18).
- `cd frontend && npm run typecheck && npm run lint` -- expected: verde.
- `cd frontend && npm run test:run` -- expected: Hábitos e `shared/design` integralmente verdes; total continua com **apenas** as 7 falhas pré-existentes de `bujo`/`planner` (DW-61).
- `cd frontend && npm run build && ls -la dist/assets/ | sort -k5 -n | tail -20` -- expected: um chunk novo de ordem de MB só para o catálogo; chunk de entrada ~1,08 MB e chunk da rota de Hábitos ~340 kB, ambos na ordem de grandeza de hoje.
- `cd frontend && git diff --stat && git grep -n "from '@phosphor-icons/react'" -- 'frontend/src/**' | grep -v 'import type'` -- expected: os MESMOS cinco arquivos do baseline (`navIcons`, `taskStatusIcons`, `TaskDetailCard`, `WeeklyRowOverflowMenu`, `RecurringLibraryPage`), nenhum acrescentado; o catálogo aberto entra só por `import('../../phosphorCatalog')`.
- `cd frontend && CI=1 npx playwright test habits-record.spec.ts` -- expected: verde (não há migration nova; `bujo_e2e` local já tem `icon_key` da 16.2).

**Manual checks:**
- Abrir o seletor em wide e em compact: 6 e 4 colunas, tile ≥44px de alvo, rolagem fluida com o catálogo inteiro, contagem mudando ao digitar.
- Escolher, salvar e conferir o glifo nas três superfícies; remover e conferir a coluna vazia com a mesma altura de linha.

## Suggested Review Order

**A decisão central: de onde vem a LISTA e de onde vem o COMPONENTE (comece aqui)**

- A lista sai de `dist/csr/*.es.js` — mesma fonte do catálogo do servidor e do glob da DW-60.
  [`phosphorCatalog.ts:79`](../../frontend/src/features/habits/phosphorCatalog.ts#L79)

- O bundle entra só para o componente; `XIcon` primeiro, `X` como queda.
  [`phosphorCatalog.ts:94`](../../frontend/src/features/habits/phosphorCatalog.ts#L94)

- Nome sem componente desenhável é descartado, e o teste de paridade é o alarme.
  [`phosphorCatalog.ts:115`](../../frontend/src/features/habits/phosphorCatalog.ts#L115)

- O que o review pegou: oferta 1530 × servidor 1512, aqui amarrados por igualdade de conjuntos.
  [`phosphorCatalog.test.ts:113`](../../frontend/src/features/habits/phosphorCatalog.test.ts#L113)

- O alias e o `import()`: por que um módulo, um chunk, e não o barrel ESM.
  [`vite.config.ts:5`](../../frontend/vite.config.ts#L5)

- O único ponto que isola o chunk de 5,3 MB — import estático aqui custaria a rota inteira.
  [`PictogramPicker.tsx:269`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L269)

- Guard contra a regressão mais cara possível: nada importa o catálogo estaticamente.
  [`phosphorCatalog.test.ts:162`](../../frontend/src/features/habits/phosphorCatalog.test.ts#L162)

**A grade virtualizada (o passo da linha vem do token, nunca de magic number)**

- Faixa e passo da linha derivados do token — 6/4 colunas, 64/72px.
  [`PictogramPicker.tsx:212`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L212)

- Sizer de altura total dentro do rolador: barra honesta sem montar ~1.500 nós.
  [`PictogramPicker.tsx:541`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L541)

- Navegação ancorada no FOCO, não na seleção — era o bug que travava a primeira seta.
  [`PictogramPicker.tsx:360`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L360)

- Tile `role="radio"` sem controle desenhado: `aria-checked` + borda/fundo.
  [`PictogramPicker.tsx:669`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L669)

**Estados que o gate exige e que o review corrigiu**

- Uma só região viva, montada desde o primeiro render: carga → contagem no MESMO nó.
  [`PictogramPicker.tsx:435`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L435)

- Confirmar exige chave que o catálogo SABE desenhar — chave órfã não reenvia 400.
  [`PictogramPicker.tsx:432`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L432)

- Catálogo vazio cai em erro com retry, não em "nenhum resultado" silencioso.
  [`PictogramPicker.tsx:423`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L423)

**O campo: escrita de `iconKey` e devolução do foco**

- Gatilho com `aria-expanded` e estado no nome acessível, nunca o nome do glifo.
  [`PictogramPicker.tsx:795`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L795)

- O overlay não salva: confirmar mexe no rascunho, e o foco volta ao gatilho.
  [`PictogramPicker.tsx:757`](../../frontend/src/features/habits/components/record/PictogramPicker.tsx#L757)

- Pictograma é IDENTIDADE: entra no diff que não versiona, comparado contra `?? null`.
  [`HabitsConfigPanel.tsx:360`](../../frontend/src/features/habits/components/record/HabitsConfigPanel.tsx#L360)

- Na criação a chave é OMITIDA quando não escolhida — dois testes comparam o corpo exato.
  [`HabitsConfigPanel.tsx:688`](../../frontend/src/features/habits/components/record/HabitsConfigPanel.tsx#L688)

**DW-65 — a pré-carga**

- Dispara na chegada do payload, antes do commit de render; nada muda visualmente.
  [`DomainIcon.tsx:203`](../../frontend/src/features/habits/components/record/DomainIcon.tsx#L203)

- Contador de imports reais: é o que torna o dedupe asseverável em vez de prosa.
  [`DomainIcon.tsx:114`](../../frontend/src/features/habits/components/record/DomainIcon.tsx#L114)

**Periféricos, mas quatro deles provados por mutação**

- Sem isto, neutralizar a pré-carga nos dois painéis deixava a suíte verde.
  [`glyphPrefetch.test.tsx:90`](../../frontend/src/features/habits/components/record/glyphPrefetch.test.tsx#L90)

- Sem isto, remover `compact={compact}` abria Dialog de 6 colunas no celular em silêncio.
  [`HabitsRecordPage.test.tsx:1453`](../../frontend/src/pages/habits/HabitsRecordPage.test.tsx#L1453)

- As duas medidas novas entram na lista proibida, com caso de não-vacuidade.
  [`noLiteralTokens.test.ts:131`](../../frontend/src/features/habits/components/record/noLiteralTokens.test.ts#L131)

- Inverso estrito de `toPascalCase`: segmento de uma letra é segmento, não sufixo.
  [`iconKey.ts:74`](../../frontend/src/features/habits/iconKey.ts#L74)

- Contra backend real: buscar, andar pelas setas, confirmar, salvar e validar a chave.
  [`habits-record.spec.ts:384`](../../frontend/e2e/habits-record.spec.ts#L384)
