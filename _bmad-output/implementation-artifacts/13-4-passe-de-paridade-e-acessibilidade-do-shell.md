---
baseline_commit: 2fca13f6ab1be4e43dec8bf89ed09fefdf7eba6b
---

# Story 13.4: Passe de paridade e acessibilidade do shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero o shell novo verificado contra a checklist de paridade e o piso de acessibilidade — **exceto `prefers-reduced-motion`, conscientemente dispensado** (UX-DR30 item 6; decisão do dono, 2026-07-24),
Para que a Onda 2a feche com equivalência comprovada, não estimada (UX-DR30, migration-plan DoR).

## Acceptance Criteria

1. **Destino ativo unificado nas três superfícies de navegação (fecha SHELL-DEBT-03)**

   **Dado que** hoje a `ShellSidebar` marca o destino ativo por match **exato** (`ShellSidebar.tsx:105`) enquanto `ShellBottomNav` (`:58-59`) e `ShellNavigationSheet` (`:81-82`) usam **prefixo** (`containsRoute`) — três cópias literais do mesmo predicado, com semânticas divergentes,
   **Quando** o passe de paridade unifica o predicado,
   **Então** existe **uma única** implementação, exportada de `shellDestinations.ts` (dados/funções puras, recebe `pathname` como argumento — sem React, sem hooks), consumida pelas três superfícies; a variante `isActive` de match exato **deixa de existir** na sidebar,
   **E** nas **9 rotas reais** que hoje deixam a sidebar **sem nenhum destino ativo** — `/habits/history`, `/gratitude/history`, `/health/metrics/history`, `/health/medications/history`, `/settings/habits`, `/settings/health-metrics`, `/settings/medications`, `/archive/weekly/:weekStart`, `/archive/monthly/:monthFirst` — o destino **pai** fica ativo com `aria-current="page"` + todos os canais visuais (borda 3px, `--ds-primary-soft`, peso 700, ícone `fill`),
   **E** permanece **exatamente UM** `aria-current="page"` por superfície de navegação em toda rota autenticada (o agrupador continua **nunca** recebendo `aria-current`, mantendo `aria-expanded` e a descrição `Contém a página atual: {destino}.` — SB-05/SB-13, EXPERIENCE §Accessibility Floor),
   **E** as rotas que **não** têm destino próprio (`/daily/:date`) continuam sem nenhum destino ativo por contrato, com o item **Menu** selecionado no compact — comportamento registrado no checklist como esperado, não como bug.

2. **Collections avulsas derivadas genericamente + agrupador tolerante a ícone ausente (fecha SHELL-DEBT-04, DoD do AD-17)**

   **Dado que** `deriveShellNavItems` escolhe os avulsos por `id` hardcoded (`shellDestinations.ts:97-98`: `standalone.find(c => c.id === 'habits')` / `'gratitude'`), de modo que uma collection avulsa **nova** no registro não apareceria em **nenhuma** superfície de navegação — contrariando o DoD do AD-17 ("collection nova = pasta da feature + UMA entrada no registro"),
   **Quando** a derivação passa a ser genérica,
   **Então** os avulsos vêm de `collections.filter(c => !c.nav.group)` sem nenhum `id` literal, e a **ordem canônica atual é preservada byte-a-byte** (`Hoje · Planner[4] · Hábitos · Saúde[Métricas, Medicamentos] · Gratidão · Brain Dump · Arquivo · Configurações`) pela regra determinística: as **unidades de collection** (cada avulsa + cada grupo) são ordenadas por `nav.order` (para grupo: o menor `nav.order` entre os filhos) e, em empate, pela **primeira ocorrência no array do registro**; dentro do grupo continua valendo `nav.order`,
   **E** um teste novo injeta pelo seam `collections` uma collection avulsa **inédita** (id fora do catálogo `navIcons`, sem `nav.group`) e prova que ela aparece na sidebar, no sheet e na lista achatada, na posição ditada pelo `nav.order`, **sem ícone e sem crash** (o guard de `iconFor` já existe — `ShellSidebar.tsx:112-116`),
   **E** o cabeçalho de **grupo** também deixa de crashar com chave fora do catálogo: hoje `navIcons[group.key]` é lido **sem guard** em `ShellSidebar.tsx:174` e `ShellNavigationSheet.tsx:173` (um `nav.group` novo derruba o chrome inteiro) — passa a degradar como o destino, coberto por teste,
   **E** o **gateamento** (filtrar o registro por collections ligadas) permanece fora de escopo (Épico 10) — a derivação apenas **tolera** listas filtradas, como já hoje.

3. **Linha de destino compartilhada entre sidebar e sheet (fecha a duplicação registrada na review da 13.3)**

   **Dado que** `renderDestination` existe em duas cópias quase idênticas (`ShellSidebar.tsx:133-161` e `ShellNavigationSheet.tsx:128-168`) e `renderGroup` em outras duas (`:166-236` e `:171-201`), com ~90 linhas duplicadas e divergências que já produziram um defeito real (o predicado de ativo — AC1),
   **Quando** a duplicação é resolvida,
   **Então** a **linha de destino** vira um componente compartilhado no diretório do shell, parametrizado pelo que legitimamente difere (`collapsed`/rail, `onActivate`, `ref` de foco inicial, presença de `:hover`), consumido pelas duas superfícies **sem alterar markup, nomes acessíveis, tokens ou comportamento** — os 23 testes de `ShellSidebar.test.tsx` e os 16 de `ShellNavigationSheet.test.tsx` passam **sem edição de assert** (são o detector de regressão, mesmo padrão da Task 1 da 13.3),
   **E** o **cabeçalho de grupo** é unificado **apenas se** o resultado preservar 100% do comportamento das duas superfícies (a sidebar tem rail, `aria-describedby` com `Contém a página atual`, peso condicional e chevron oculto no rail; o sheet não tem nada disso); se a unificação for lesiva, a duplicação do agrupador **permanece** e a divergência de composição é **registrada no checklist com justificativa explícita** — não fica silenciosa,
   **E** o **tripé** de guards de fonte por `?raw` (sem `@mui/icons-material`, sem `@tanstack/react-query`, sem literais estruturais `56`/`64`/`240`) passa a valer para o módulo novo **e** para a `ShellSidebar` — e aqui o dev **escreve os greps que faltam**, não "estende" greps existentes, porque a cobertura de hoje é **parcial e assimétrica**:
   - `ShellBottomNav.test.tsx:138-153` é o **único** lugar com o tripé completo — mui-icons (`:138-141`), literais `\b(56|64|240)\b` (`:143-149`) e `@tanstack/react-query` (`:150-153`) — e ele grepa **só** `ShellBottomNav.tsx` e `ShellNavigationSheet.tsx`.
   - `ShellSidebar.test.tsx:370-385` tem **apenas** o grep de `@mui/icons-material` (`:370-377`, sobre `ShellSidebar.tsx` **e** `navIcons.tsx`); o teste seguinte (`:378-385`, "larguras vêm dos tokens") verifica **presença** de `var(--ds-sidebar-expanded/collapsed)` e **ausência** de `COLLAPSED_WIDTH`/`DRAWER_WIDTH` — **não** é grep de literais estruturais. Não existe hoje **nenhum** grep de `@tanstack/react-query` nem de literais `56`/`64`/`240` sobre `ShellSidebar.tsx`.
   - `shellDestinations.test.ts:139-147` cobre o módulo puro (Query/hooks/`import.meta.env`/React/mui-icons) e continua valendo.
   ⇒ Entregar: (i) o tripé completo sobre o **arquivo novo** da linha de destino compartilhada, e (ii) os dois greps faltantes sobre `ShellSidebar.tsx` (`@tanstack/react-query` e literais `\b(56|64|240|52|48)\b`). **Mitigante verificado no HEAD `2fca13f`:** `\b(56|64|240|52|48)\b` dá **0 hits** em `ShellSidebar.tsx`, `ShellNavigationSheet.tsx` e `ShellBottomNav.tsx` — os greps novos entram **verdes**, sem refactor de geometria embutido nesta task.

4. **Matriz axe-core em wide/medium/tablet/compact nas rotas do shell**

   **Dado que** o gate axe hoje roda em **4 células** apenas (`shell-a11y.spec.ts:24` wide `/today`; `:40` compact 320 `/today`; `shell-sidebar.spec.ts:387` wide `/planner/week` em rail; `shell-bottomnav.spec.ts:580` compact 390 `/today` com sheet aberto) e **nenhuma** em medium (1024–1439) ou tablet (768–1023),
   **Quando** a matriz do passe final é montada,
   **Então** `expectNoAxeViolations` (tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` — sem `disableRules`, sem regra silenciada) roda em **todas** as células das duas tabelas da seção *Matriz de acessibilidade obrigatória* das Dev Notes, com o `label` no formato `faixa · rota · estado`,
   **E** o `exclude: 'main'` **permanece** (a dívida de a11y do conteúdo legado é migrada onda a onda — SHELL-DEBT-02 não é desta story), mas o gate cobre **todo o chrome**: topbar, sidebar/rail, bottom nav, Menu/sheet, FAB/âncora de captura, skip link, seam legado e badge,
   **E** nenhuma célula é adicionada com `test.skip`, `test.fixme` ou `exclude` novo: célula que reprove é **corrigida** no chrome ou registrada como divergência com o motivo e o artefato upstream de destino.

5. **Teclado, ordem de foco, foco visível/não encoberto e aria-live única**

   **Dado que** o piso de acessibilidade (EXPERIENCE §Accessibility Floor, §Interaction Primitives) e os itens `KB-01…KB-03`, `RA-01…RA-03`, `A11Y-01…A11Y-06` da checklist (`A11Y-07` — `prefers-reduced-motion` — é **waiver consciente** e está **fora** deste aceite; ver a última cláusula deste AC),
   **Quando** o shell é auditado por teclado num browser real,
   **Então** em **cada faixa** o **primeiro** controle focável é `Pular para o conteúdo`, que move o foco para o wrapper do conteúdo (`SHELL_CONTENT_ID`), e a **ordem de Tab** acompanha a ordem visual (chrome → conteúdo; no compact: topbar → conteúdo → bottom nav/FAB conforme a composição renderizada),
   **E** todo controle do chrome exibe foco visível pelo `focus-ring` do token (`--ds-focus`, 2px, offset 2px) e **nenhum controle focado fica encoberto** por topbar, bottom nav, FAB, safe-area ou faixa DEV (WCAG 2.2 `2.4.11`) — verificado medindo o retângulo do **primeiro** e do **último** controle focáveis contra o viewport e contra o chrome fixo, lendo `--dev-banner-height`/`--ds-topbar-height`/`--ds-bottom-nav-height` do DOM (a faixa DEV **está ativa** no ambiente e2e: `.env.e2e` define `VITE_APP_ENV=development` ⇒ `--dev-banner-height: 28px` — nunca assumir 0),
   **E** os atalhos são preservados exatamente: `[` alterna sidebar/rail e `B` abre Brain Dump **só** em `(min-width: 1024px)`, ambos ignorados em `INPUT`/`TEXTAREA`/`contentEditable` e com guard de `ctrl`/`meta`/`alt`; `Escape` fecha o sheet de navegação devolvendo o foco ao **Menu**,
   **E** o anúncio de rota tem **uma única** live region no chrome: o `RouteAnnouncer` (`role="status"` + `aria-live="polite"`) — a topbar mostra o mesmo título de forma **estática** e nunca é live region (RA-02), e o `<main>` da superfície legada (que tem live regions próprias) fica fora dessa afirmação, que é escopada ao chrome,
   **E** — ressalva explícita ao piso — `prefers-reduced-motion` **não** faz parte deste aceite nem de nenhum outro desta story: é **waiver consciente de produto** do dono (UX-DR30 item 6 dispensado para o App Shell, Hugo 2026-07-24; ver *Decisão consciente de produto — reduced motion*). O dev **não** implementa nem verifica reduced motion aqui; o restante do piso (teclado, foco visível, foco não encoberto, targets, zoom/reflow, contraste, nome/papel/estado, live region) é o que esta story fecha.

6. **Zoom 200% e reflow em 320 CSS px sem perda de conteúdo ou ação**

   **Dado que** o piso exige "Zoom 200% e reflow em 320 CSS px sem perda de conteúdo/ação" e "o aceite testa primeiro e último controles a 320 CSS px e zoom de 200%, com chrome fixo/sticky ativo",
   **Quando** as duas condições são exercidas no browser real,
   **Então** em **320×720** (reflow) e no **equivalente a zoom 200%** — viewport com metade das dimensões em CSS px da faixa de origem (`1440×900 → 720×450`; `1280×800 → 640×400`), equivalência **documentada no spec** como a emulação escolhida — não há **scroll horizontal** do documento (`documentElement.scrollWidth <= clientWidth`), e navegação **e** captura permanecem alcançáveis e acionáveis,
   **E** o zoom 200% a partir de wide/medium cai **abaixo de 768px**, o que faz o chrome **recompor** para a composição compact (topbar + 3 atalhos + Menu + FAB): a recomposição é parte do aceite — nenhum destino ou ação do chrome fica inacessível na troca (o sheet de navegação continua listando **todos** os destinos),
   **E** o primeiro e o último controles focáveis são alcançados por teclado e ficam **totalmente visíveis** ao receber foco nessas duas condições.

7. **Estados ST-01…ST-06 verificados com evidência nomeada**

   **Dado que** a seção *H. Estados exigidos pelo aceite da 13.4* do checklist (`ST-01` vazio, `ST-02` loading, `ST-03` error, `ST-04` offline, `ST-05` disabled, `ST-06` readonly) e a tabela §State Patterns do EXPERIENCE,
   **Quando** o passe roda,
   **Então** cada estado tem **evidência nomeada** (arquivo `::` nome do teste) provando o contrato no **chrome**:
   - badge do Brain Dump oculto em 0 (`BD-02`), em loading (`ST-02`, checklist `:127`) e em erro (`ST-03`, checklist `:128`) — e, nos três casos, **navegação e captura permanecem disponíveis**: a disponibilidade do chrome é **independente do contador**. Este é o contrato de `ST-02`/`ST-03` (checklist `:128`: "falha do contador não bloqueia navegação/captura"); **não** é DIV-8;
   - offline com FAB **e** âncora `aria-disabled="true"` + guard no `onClick`, **permanecendo focáveis**, com motivo acessível e navegação/leitura intactas — **este** é o contrato de **DIV-8** (checklist `:144`: `aria-disabled` + guard no lugar do `disabled` nativo do legado, controle segue focável com identidade e motivo acessível) (`ST-04`/`ST-05`);
   - rota de histórico como superfície readonly sem ação de escrita no chrome (`ST-06`),
   **E** a **fronteira** é registrada explicitamente: `ST-01` (vazio) e `ST-06` (readonly) são estados da **superfície legada** — o que a Onda 2a garante é que o chrome permanece completo, estável e acessível nesses estados; a auditoria do conteúdo interno é das Ondas 3–5,
   **E** o estado **nav mínima** (zero/uma collection) segue coberto pelo seam de injeção nas três superfícies, sem heading de collections, sem grupo `Saúde` vazio e sem item desabilitado (EXPERIENCE §State Patterns).

8. **Checklist de paridade fechada: zero item pendente, zero decisão "a confirmar" — com UM waiver consciente declarado (reduced motion)**

   **Dado que** `13-shell-parity-checklist.md` é o artefato que a 13.1 criou e as 13.2–13.4 consomem, e que hoje ele tem 6 itens com status `13.4` (ST-01…ST-06), 3 dívidas abertas (SHELL-DEBT-02/03/04) e **3** decisões interinas explicitamente marcadas **"A confirmar com UX/Hugo no passe da 13.4"** (`:154` ícone `Notebook` do cabeçalho `Planner`; `:188` `aria-current="page"` no botão Menu; `:195` `CAPTURE_FAB_ICON_SIZE = 24` no FAB) — **mais** a reconciliação do **chevron unicode** (`:156-160`), que está escrita como decisão **já reconciliada**, **sem** marcador de pendência, e que esta story promove no mesmo lote por ser da mesma safra 13.2/13.3,
   **Quando** esta story fecha,
   **Então** **todo** item das seções A–H tem status final (`parity`, `✅ 13.x`, divergência registrada ou **waiver consciente**) e ganha uma coluna **Evidência** apontando `arquivo::nome do teste` (ou "verificação manual + motivo", quando não automatizável) — nenhum item permanece com status `13.4`,
   **E** a única exceção ao "piso fechado" é declarada como **waiver consciente de produto, não como item pendente nem dívida**: `prefers-reduced-motion` / **UX-DR30 item 6 (reduced motion)** é **dispensado** para o App Shell por decisão do dono (Hugo, 2026-07-24) — ver *Decisão consciente de produto — reduced motion* abaixo. A linha `A11Y-07` do checklist registra o waiver com essa redação; ela **não** vira `SHELL-DEBT` e **não** é deferida para nenhuma onda,
   **E** SHELL-DEBT-03 e SHELL-DEBT-04 são **fechadas** (AC1/AC2); SHELL-DEBT-02 é **re-escopada** com dono explícito (auditoria do `<main>` por superfície nas Ondas 3–5) e acompanhada de um **inventário** dos achados do axe **sem** `exclude: 'main'` em `/today`, gravado como artefato não-bloqueante para as ondas seguintes,
   **E** as **3 decisões marcadas "a confirmar"** — **mais** a reconciliação do chevron, que não tem marcador — são **promovidas a divergências contratadas** (4 divergências no total) com justificativa e destino upstream, deixando de ser pendências: (a) ícone `Notebook` no cabeçalho `Planner` (checklist `:154`; o catálogo fechado do DESIGN.md dá glyph de agrupador só a `Saúde`); (b) chevron como glyph unicode decorativo `⌄`/`⌃` `aria-hidden` (checklist `:156-160` — já reconciliada, sem marcador de pendência; o catálogo não define chevron); (c) `aria-current="page"` no botão **Menu** quando a rota está fora dos 3 atalhos (checklist `:188`; EXPERIENCE exige "Menu aparece selecionado"; o mockup aprovado marca `aria-current`); (d) `CAPTURE_FAB_ICON_SIZE = 24` no FAB contra os 20px de `{components.app-shell-nav-icon}` (checklist `:195`; mockup aprovado, área de 52px) — cada uma com a linha de código e o artefato upstream (DESIGN.md/EXPERIENCE.md) que precisa absorvê-la,
   **E** a **ausência de regressão visual automatizada** no chrome da Onda 2a é registrada como divergência consciente contra UX-DR30 item 9 / migration-plan ("aceite mede paridade, não apenas screenshot"): a paridade é medida por asserts semânticos e geométricos, e Playwright não roda no CI (arquitetura §7.4), o que tornaria baselines de imagem locais um custo sem gate,
   **E** a nota da 13.1 sobre o shell ter trocado o scroll de documento por um workspace com `overflow:auto` próprio é resolvida: as duas superfícies com `position: sticky` sob o shell novo (`HealthHistoryTable.tsx:103,141` e `HabitHistoryGrid.tsx:137,181`) são verificadas dentro do shell e o achado é registrado (funciona / degrada / precisa de onda própria).

9. **Nenhuma regressão e gates verdes**

   **Dado que** este é o passe de fechamento do épico e o chrome é montado em **todas** as 22 rotas autenticadas (`shellRouting.ts:48-77`, todas `shell: 'new'`),
   **Quando** a story fecha,
   **Então** os legados de rollback seguem **intocados** (`AppLayout.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `theme.ts`, `registry.ts` sem diff) e nenhuma rota é migrada para `shell: 'legacy'`,
   **E** a suíte Vitest completa segue verde partindo do baseline **89 arquivos / 952 testes** (colar a saída literal; derivar herdados/novos pelo diff), `typecheck` e `lint` limpos,
   **E** a suíte E2E roda verde partindo do baseline **41 passed** dos 4 specs do shell **mais** os specs que navegam pelo chrome (`brain-dump`, `archive`, `daily-tasks`, `gratitude-history`, `habit-history`, `health-history`, `medications-history`) — porque a derivação de destinos e o predicado de ativo mudaram e esses specs clicam na navegação; contagens literais nas Completion Notes.

### Decisão consciente de produto — reduced motion (UX-DR30 item 6 dispensado)

**Decisão do dono (Hugo, 2026-07-24), registrada como decisão consciente de produto — não é dívida técnica, não é pendência, não é item deferido:**

> O shell (e o Épico 13) **não suporta nem buscará** `prefers-reduced-motion`. **UX-DR30 item 6 (reduced motion) é conscientemente DISPENSADO para o App Shell — agora e no futuro.** As animações do shell (ex.: transição `width 0.2s` da `ShellSidebar`, `Drawer`/`Collapse`/`Modal` do MUI) **permanecem como estão**.

Consequências para quem executa esta story:

- **Não** implementar `@media (prefers-reduced-motion: reduce)`, `useMediaQuery('(prefers-reduced-motion: reduce)')`, `transition: none` condicional ou qualquer variante — não há task para isso e criar uma é **fora de escopo**.
- **Não** escrever teste (unit ou E2E) que verifique reduced motion, e **não** deixar o assunto silenciosamente sem cobertura: ele está coberto por este waiver, rastreável no checklist (`A11Y-07`).
- O waiver **não** vira `SHELL-DEBT-0x` e **não** é deferido para as Ondas 3–5, para o Épico 18 nem para story nenhuma. Se um dia a decisão mudar, isso é uma **story nova** com decisão nova do dono.
- Por isso o AC8 fecha o piso **"exceto reduced motion"** e o AC5 carrega a mesma ressalva: nenhuma afirmação desta story pode dizer "piso de acessibilidade integralmente fechado" ou "zero item pendente" sem essa qualificação.
- O restante do UX-DR30 item 6 (teclado, foco, screen reader por nome/papel/estado, touch target, zoom/reflow, contraste) **continua integralmente exigido** pelas ACs 4–6.

## Tasks / Subtasks

- [x] **1. Unificar o predicado de destino ativo nas três superfícies** (AC: 1)
  - [x] Em `shellDestinations.ts` (módulo puro), exportar o predicado único — assinatura sugerida `isDestinationActive(pathname: string, path: string): boolean` — com a semântica **prefixo do próprio destino** já vigente: `pathname === path || pathname.startsWith(\`${path}/\`)`. Nenhum import de React/hooks/Query/env (os greps de `shellDestinations.test.ts:139-147` protegem isso).
  - [x] Remover as 3 cópias literais: `ShellSidebar.tsx:105-107` (apagar `isActive` exato **e** o `containsRoute` local), `ShellBottomNav.tsx:58-59`, `ShellNavigationSheet.tsx:81-83`. Cada superfície passa a chamar o predicado do módulo com `location.pathname`.
  - [x] `ShellSidebar.tsx:134` (`renderDestination`) passa a usar o predicado novo — é a mudança de comportamento **intencional** desta task (SHELL-DEBT-03). O uso em `renderGroup` (`:171`, `activeChild`/`showContains`/`aria-describedby`) continua com a mesma semântica.
  - [x] Verificar que não nasce um segundo `aria-current`: com prefixo, checar par a par os destinos que são prefixo um do outro. Hoje só `/settings` × `/settings/habits|health-metrics|medications` (as 3 de settings **não** são destinos da nav ⇒ só `Configurações` ativa) e `/archive` × `/archive/weekly|monthly/*`. Nenhum destino da nav é prefixo de outro destino da nav — provar por teste sobre a lista achatada, não por inspeção.
  - [x] Testes: em `ShellSidebar.test.tsx`, casos novos para `/habits/history`, `/health/metrics/history`, `/settings/habits`, `/archive/weekly/2026-07-20` — destino pai com `aria-current="page"` e `document.querySelectorAll('[aria-current="page"]').length === 1`; e `/daily/2026-07-01` sem nenhum destino ativo (contrato registrado). Os asserts existentes de rota exata (`:169-205`) **não** mudam. Atenção: `/planner/week/2026-07-20` **não** é rota real do router (só `planner/week` existe) — em `ShellBottomNav.test.tsx:87-102` ela é um caso **sintético** de prefixo; não inventar rota nova nem entrada em `shellRouting.ts`.
  - [x] Teste de invariante compartilhada (arquivo do módulo): para cada rota de `shellRoutes`, no máximo **um** destino da lista achatada casa o predicado.

- [x] **2. Derivação genérica de avulsos + guard do ícone de agrupador** (AC: 2)
  - [x] Reescrever `deriveShellNavItems` (`shellDestinations.ts:93-123`) eliminando `c.id === 'habits'` / `'gratitude'` (`:97-98`, `:108`, `:112`): montar **unidades** (avulsa | grupo) e ordená-las por `nav.order` com tiebreak no índice de primeira ocorrência no registro; dentro do grupo, `nav.order`. O label do grupo continua vindo de onde vem hoje (`'saude' → 'Saúde'`) — se a fonte é literal, isolar num mapa nomeado e registrar a limitação no checklist (o registro não tem label de grupo).
  - [x] Preservar: núcleo hardcoded fora do registro (FR-1.1/AD-17 item 5), `Planner` sempre completo, grupo sem filhos não renderiza, `brain-dump` como único portador de badge, `Configurações` no fim após o divisor.
  - [x] O teste de ordem exata (`shellDestinations.test.ts:19-34`, 12 labels) é o detector: **não editar** esse assert. Se a regra nova mudar a ordem, a regra está errada.
  - [x] Teste novo: injetar collection avulsa inédita (ex.: `{ id: 'journalling', nav: { label: 'Journalling', order: 2 }, routes: [{ path: 'journalling', … }] }`) e provar presença + posição na lista achatada, na sidebar e no sheet, sem ícone e sem crash. Este teste é o DoD do AD-17 tornado executável.
  - [x] Guard do ícone de grupo: `ShellSidebar.tsx:174` e `ShellNavigationSheet.tsx:173` passam a tolerar chave fora de `navIcons` (mesmo tratamento de `iconFor`, `ShellSidebar.tsx:112-116`); teste injetando `nav.group` novo prova que o chrome renderiza sem ícone em vez de explodir.

- [x] **3. Extrair a linha de destino compartilhada** (AC: 3)
  - [x] Criar o componente compartilhado no diretório do shell (ex.: `ShellNavDestination.tsx`) com props para o que difere de fato: `destination`, `active`, `collapsed?`, `onActivate`, `itemRef?`, `withHover?`. Manter **idênticos**: `ListItemButton`/`ListItemIcon`/`ListItemText`, `aria-current`, `aria-label` no rail, `BrainDumpBadge` com `SHELL_BADGE_SX` + `max={9}`, peso 700/500, ícone `fill`/`regular`, tokens `--ds-*`.
  - [x] Substituir as duas cópias (`ShellSidebar.tsx:133-161`, `ShellNavigationSheet.tsx:128-168`). `ShellSidebar.test.tsx` (23) e `ShellNavigationSheet.test.tsx` (16) devem passar **sem edição de assert**; rodar os dois arquivos isolados antes de seguir.
  - [x] Agrupador: tentar unificar `renderGroup`; se a unificação exigir prop condicional para cada divergência real da sidebar (rail, `aria-describedby` de `Contém a página atual`, peso condicional, chevron oculto no rail), **parar**, manter as duas versões e registrar a divergência de composição no checklist com o motivo. Documentar a decisão tomada nas Completion Notes.
  - [x] **Escrever os guards `?raw` que faltam** (não "estender" — a cobertura de hoje é parcial; ver AC3):
    - [x] Arquivo **novo** da linha compartilhada: tripé completo — sem `@mui/icons-material`, sem `@tanstack/react-query`, sem literais estruturais (`\b(56|64|240|52|48)\b`). Colocar onde o tripé já mora (`ShellBottomNav.test.tsx:138-153`, adicionando o `?raw` do arquivo novo aos três `it`) **ou** num `describe` de guardas do teste do componente novo — não espalhar em três lugares.
    - [x] `ShellSidebar.tsx`: **criar** os dois greps inexistentes — `@tanstack/react-query` e literais `\b(56|64|240|52|48)\b`. Hoje `ShellSidebar.test.tsx:370-377` só grepa `@mui/icons-material` (sobre `ShellSidebar.tsx` + `navIcons.tsx`) e `:378-385` verifica tokens/ausência de `COLLAPSED_WIDTH`/`DRAWER_WIDTH` — **não** é grep de literais. Não editar os asserts existentes desses dois `it`; adicionar `it` novos.
    - [x] Confirmado no HEAD `2fca13f`: `\b(56|64|240|52|48)\b` dá **0 hits** em `ShellSidebar.tsx`/`ShellNavigationSheet.tsx`/`ShellBottomNav.tsx` — os greps novos nascem verdes. Se algum reprovar, é regressão introduzida pela extração, não legado.

- [x] **4. Matriz axe wide/medium/tablet/compact** (AC: 4)
  - [x] `nvm use 22.15.1` antes de qualquer comando de frontend/e2e.
  - [x] Ampliar **`frontend/e2e/shell-a11y.spec.ts`** (não criar spec paralelo — o gate do shell tem um dono só) com um `describe` por faixa e `test.use({ viewport })` dentro dele, cobrindo as duas tabelas da seção *Matriz de acessibilidade obrigatória*. Reaproveitar `expectNoAxeViolations` de `axeHelper.ts` com `exclude: 'main'` e `label` no formato `faixa · rota · estado`.
  - [x] Para alcançar as rotas da matriz, `page.goto('/rota')` **depois** do signup da fixture é aceitável e mais barato que clicar por dentro da superfície legada; a navegação **pelo chrome** já é provada por `shell-sidebar.spec.ts`/`shell-bottomnav.spec.ts`. Antes de cada `analyze()`, aguardar um marcador estável da rota (título na `banner`) — nunca medir durante transição.
  - [x] Células de **estado** (rail colapsado, sheet aberto, capture sheet aberto, offline via `context.setOffline`, badge `9+` com `seedBrainDumpItems`): aguardar a transição assentar (padrão `waitForSheetSettled` de `shell-bottomnav.spec.ts`) antes do axe.
  - [x] Nenhum `disableRules`, nenhum `exclude` novo, nenhum `skip`/`fixme`. Violação encontrada ⇒ corrigir no chrome e registrar na Change Log da story.

- [x] **5. Auditoria de teclado, foco e live region** (AC: 5)
  - [x] E2E por faixa (wide/medium/tablet/compact): `Tab` a partir de `body` ⇒ primeiro focável é `Pular para o conteúdo`; acioná-lo move o foco ao wrapper do conteúdo; sequência de `Tab` seguinte cobre o chrome na ordem visual (asserts pelos nomes acessíveis, não por índice cru).
  - [x] **Caso limítrofe conhecido — FAB depois da bottom nav no DOM.** No compact o `ShellLayout` renderiza `ShellBottomNav` (`:223`) **antes** do FAB (`:230-263`), mas visualmente o FAB fica **acima** da barra. WCAG `2.4.3` pede ordem que preserve significado e operabilidade, não coincidência pixel a pixel: **verificar e registrar** o comportamento no checklist (ambos alcançáveis por teclado, nenhum encoberto, ordem justificada), não reordenar o DOM só para casar com a geometria — a troca mudaria o `pb`/`scroll-padding` e o gate axe da 13.3.
  - [x] Foco não encoberto (WCAG 2.2 `2.4.11`): para o **primeiro** e o **último** controles focáveis, comparar `boundingBox()` com o viewport e com as faixas de chrome fixo, lendo `--dev-banner-height`, `--ds-topbar-height`, `--ds-bottom-nav-height`, `--ds-capture-fab-size` do DOM via o helper `dsToken` já existente em `shell-sidebar.spec.ts` (extrair para reuso se necessário).
  - [x] Foco visível: `:focus-visible` do chrome resolve `outline`/`box-shadow` a partir de `--ds-focus` com 2px e offset 2px (ler o token do DOM, não hardcodar cor).
  - [x] Atalhos: `[` e `B` funcionam em wide e medium; **não** funcionam em tablet nem compact; ignorados com foco em campo editável (usar um campo real da superfície ou o Capture Sheet); guard de `ctrl`/`meta`/`alt`. `Escape` no sheet devolve o foco ao **Menu**.
  - [x] Live region: no chrome existe exatamente **uma** região de rota (`RouteAnnouncer`, `role="status"` + `aria-live="polite"`); a `banner` tem o mesmo texto e **nenhum** atributo de live region. Escopar o assert ao chrome (o `<main>` legado tem live regions próprias — `TaskRow`, `HealthHistory` etc.).

- [x] **6. Zoom 200% e reflow 320** (AC: 6)
  - [x] `describe` de reflow: `320×720` — sem scroll horizontal (`documentElement.scrollWidth <= clientWidth`), bottom nav + Menu + FAB acionáveis, sheet abre e lista todos os destinos, primeiro/último focáveis visíveis.
  - [x] `describe` de zoom 200%: viewports `720×450` (equivalente de 1440×900) e `640×400` (equivalente de 1280×800), com comentário no spec explicitando a emulação escolhida e por quê (`page.setViewportSize` em CSS px equivalentes; `Emulation.setPageScaleFactor` é pinch-zoom e não reflui). Asserts: chrome **recomposto** para compact (topbar + atalhos + Menu + FAB), nenhum destino perdido (via sheet), sem scroll horizontal, captura acionável.
  - [x] Se a emulação por viewport for considerada insuficiente, complementar com `document.documentElement.style.zoom = '200%'` — mas só **em adição**, e verificando que `position: fixed`/`100svh`/`env(safe-area-inset-*)` do chrome não distorcem o assert (registrar o que foi observado).

- [x] **7. Estados ST-01…ST-06 com evidência nomeada** (AC: 7)
  - [x] Mapear cada `ST-0x` para teste **existente** (a maioria já existe: badge 0/loading/erro, offline do FAB e da âncora, nav mínima) e criar só o que falta. Não duplicar cobertura já provada — citar arquivo `::` nome do teste.
  - [x] `ST-06` readonly: numa rota de histórico, o chrome está completo, o destino pai está ativo (AC1) e o chrome não oferece ação de escrita.
  - [x] `ST-04` offline sob axe: a célula de estado offline da matriz (Task 4) cobre `aria-disabled` no gate real.
  - [x] Registrar no checklist a fronteira de `ST-01`/`ST-06` (estado da superfície legada; garantia da Onda 2a é o chrome).

- [x] **8. Inventário SHELL-DEBT-02 (não-bloqueante)** (AC: 8)
  - [x] Rodar o axe em `/today` **sem** `exclude: 'main'` uma vez por faixa e gravar o inventário de violações (regra, impacto, seletor, `helpUrl`) em `_bmad-output/implementation-artifacts/13-shell-a11y-legacy-inventory.md`, marcando cada achado com a onda/épico dono da superfície.
  - [x] Isso é **coleta**, não gate: o teste da matriz continua com `exclude: 'main'`. Não introduzir um teste que reprove por conteúdo legado (script utilitário ou `test.skip` **explicitamente** documentado, gerado uma vez — preferir script/execução manual a um teste permanente pulado).
  - [x] Verificar as duas superfícies `position: sticky` sob o shell novo (`HealthHistoryTable.tsx:103,141`, `HabitHistoryGrid.tsx:137,181`) — o workspace tem `overflow:auto` próprio, então `sticky` passa a se ancorar no workspace, não na janela. Registrar o achado (funciona / degrada / onda própria) no checklist.

- [x] **9. Fechar a checklist de paridade** (AC: 8)
  - [x] Em `13-shell-parity-checklist.md`: adicionar coluna **Evidência** (`arquivo::nome do teste`) em A–H; nenhum item com status `13.4`; SHELL-DEBT-03/04 fechadas com o commit/arquivo; SHELL-DEBT-02 re-escopada com dono e link para o inventário.
  - [x] Promover a **divergências contratadas** (DIV-10…DIV-13 ou equivalente) as **3** decisões marcadas "A confirmar com UX/Hugo no passe da 13.4" (`:154` ícone `Planner`, `:188` `aria-current` no Menu, `:195` ícone 24px do FAB) **+** a reconciliação do chevron unicode (`:156-160`, que não tem marcador de pendência) ⇒ 4 divergências. Cada uma com: o que o artefato upstream diz, o que o código faz, por quê, a linha de código e o artefato que precisa absorver a mudança.
  - [x] **Preservar** a linha `A11Y-07` (waiver consciente de reduced motion, UX-DR30 item 6 dispensado — Hugo 2026-07-24) e a nota da seção de dívidas que diz que ela **não** é `SHELL-DEBT`: já estão no checklist, entram na seção de fechamento como **waiver**, nunca como pendência, dívida ou item deferido. **Não** criar task de implementação de reduced motion.
  - [x] Registrar a divergência sobre regressão visual automatizada (UX-DR30 item 9) com a justificativa do AC8.
  - [x] Adicionar uma seção de fechamento: **"Onda 2a — equivalência comprovada"**, com a tabela faixa × rota × estado do gate axe e o resumo dos gates executados.

- [x] **10. Gates finais** (AC: 9)
  - [x] `npm run test:run` (baseline **89 arquivos / 952 testes**), `npm run typecheck`, `npm run lint` — colar saída literal; derivar herdados/novos pelo diff.
  - [x] E2E escopado: `CI=1 DATABASE_URL=… npx playwright test e2e/shell-a11y.spec.ts e2e/shell.spec.ts e2e/shell-sidebar.spec.ts e2e/shell-bottomnav.spec.ts e2e/brain-dump.spec.ts e2e/archive.spec.ts e2e/daily-tasks.spec.ts e2e/gratitude-history.spec.ts e2e/habit-history.spec.ts e2e/health-history.spec.ts e2e/medications-history.spec.ts --reporter=line` (ver *Testing Requirements* para o workaround do banco). E2E **não** fica "não verificado".
  - [x] `git diff --stat` sobre `AppLayout.tsx`/`Sidebar.tsx`/`BottomNav.tsx`/`theme.ts`/`registry.ts` deve ser **vazio**; `shellRouting.ts` sem nenhuma entrada virando `'legacy'`.
  - [x] File List reconciliada com `git status --short` **depois** de QA/E2E.

## Dev Notes

### Fronteira desta story (o que é 13.4 e o que NÃO é)

| Entrega | Story |
|---|---|
| Casca, topbar, tokens, skip link, seam, coexistência por rota, axe-core no Playwright, criação da checklist | 13.1 (done) |
| Sidebar 240/64 derivada do manifest, catálogo Phosphor, badge `9+`, rail, atalho `[` | 13.2 (done) |
| Bottom nav 3 atalhos + Menu, sheet de navegação completa, captura persistente (FAB + âncora), offline acessível, token 64px | 13.3 (done) |
| **Passe de paridade: predicado de ativo unificado, avulsos genéricos, linha de destino compartilhada, matriz axe 4 faixas, teclado/foco/live region, zoom 200% + reflow 320, estados ST-01…ST-06, checklist fechada** | **13.4 (esta)** |
| Migração do conteúdo das superfícies (o `<main>` que hoje é excluído do axe) | Ondas 3–5 (Épicos 14–16) |
| Configurações → Navegação mobile (escolher os 3 atalhos) e Aparência | 18.1 |
| Gateamento do registro (default all-off, collections ligadas por conta) | Épico 10 |
| Remoção dos arquivos legados (`AppLayout`/`Sidebar`/`BottomNav`) | Épico 18 (Onda 6) |

**Fora de escopo — não fazer nesta story:**

- Tocar `AppLayout.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `theme.ts` ou `registry.ts` (rota de rollback / fronteiras de outro épico).
- Remover `exclude: 'main'` do gate axe (SHELL-DEBT-02 é das ondas de superfície — esta story **inventaria**, não corrige).
- Introduzir regressão visual por screenshot (decisão registrada no AC8).
- Implementar **ou** verificar `prefers-reduced-motion` — **waiver consciente do dono** (UX-DR30 item 6 dispensado para o App Shell, Hugo 2026-07-24). Não é dívida, não é deferimento: ver *Decisão consciente de produto — reduced motion*.
- Backend, migration, OpenAPI, `types.gen.ts`. Story **100% frontend**.
- Persistir preferências (colapso, atalhos, tema) — nada em banco nem `localStorage`.
- Migrar qualquer rota para `shell: 'legacy'`.

### Matriz de acessibilidade obrigatória (AC4)

Faixas conforme EXPERIENCE §Responsive & Platform: **wide** ≥1440 · **medium** 1024–1439 · **tablet** 768–1023 · **compact** <768. `mediaQueries` do código (`tokens.ts:83-91`) só distingue `desktop` (≥1024), `tablet` (768–1023) e `compact` (≤767) — wide e medium compartilham o mesmo comportamento de chrome, mas **ambas** entram na matriz porque os gutters e o workspace máximo diferem.

**Tabela A — rotas por faixa** (todas com `exclude: 'main'`):

| Faixa / viewport | Rota | Por que esta célula | Situação |
|---|---|---|---|
| wide 1440×900 | `/today` | núcleo, sidebar expandida | ✅ existe (`shell-a11y.spec.ts:24`) |
| wide 1440×900 | `/planner/week` (rail) | agrupador com filho ativo + rail | ✅ existe (`shell-sidebar.spec.ts:387`) |
| wide 1440×900 | `/settings` | divisor + último destino do chrome | **novo** |
| medium 1280×800 | `/today` | faixa **sem nenhuma cobertura** hoje | **novo** |
| medium 1280×800 | `/brain-dump` | destino com badge no ativo | **novo** |
| medium 1280×800 | `/health/metrics/history` | rota de histórico ⇒ ativo por prefixo (AC1) + readonly | **novo** |
| tablet 800×720 | `/today` | rail inicial da faixa; sem cobertura hoje | **novo** |
| tablet 800×720 | `/habits` | collection avulsa derivada do registro | **novo** |
| compact 390×720 | `/today` | topbar + bottom nav + FAB | **novo** (hoje só 320) |
| compact 390×720 | `/health/metrics` | rota fora dos 3 atalhos ⇒ Menu selecionado | **novo** |
| compact 320×720 | `/today` | reflow mínimo | ✅ existe (`shell-a11y.spec.ts:40`) |
| compact 320×720 | `/archive` | prefixo profundo + faixa mínima | **novo** |

**Tabela B — estados do chrome sob axe:**

| Faixa | Estado | Situação |
|---|---|---|
| compact 390×720 | sheet de navegação **aberto** | ✅ existe (`shell-bottomnav.spec.ts:580`) |
| compact 390×720 | Capture Sheet **aberto** pelo FAB | **novo** |
| compact 390×720 | **offline** (`context.setOffline(true)`) — FAB e navegação | **novo** |
| wide 1440×900 | Capture Sheet aberto pela **âncora** da sidebar | **novo** |
| wide 1440×900 | **offline** — âncora `aria-disabled` | **novo** |
| medium 1280×800 | badge `9+` (12 itens via `seedBrainDumpItems`) | **novo** |

### Contrato — números que o dev não deve inventar

| Item | Valor | Fonte |
|---|---|---|
| Faixas | wide ≥1440 · medium 1024–1439 · tablet 768–1023 · compact <768 | EXPERIENCE §Responsive & Platform |
| Sidebar | expandida 240px (wide/medium) · rail 64px (tablet) | `{components.app-shell.sidebar-expanded/collapsed}` |
| Topbar / bottom nav | 56px / 64px (+ safe-area) | `--ds-topbar-height` / `--ds-bottom-nav-height` |
| Workspace | máx. 1440px; gutters wide 32 / medium 24 / compact 16 | `{components.app-shell.*}` |
| FAB de captura | 52px circular, `bottom = bottom-nav + safe-area + 16px`, `right 16px` | `{components.capture-action}`; FAB-01 |
| Focus ring | `--ds-focus`, 2px, offset 2px | `{components.focus-ring}` |
| Touch target | ≥44px; controles frequentes compactos 48px; FAB 52px | EXPERIENCE §Accessibility Floor |
| Landmarks | `banner` (topbar) · `Navegação principal` (sidebar) · `Atalhos de navegação` (bottom nav) · `Navegação completa` (sheet) · `complementary` (seam) | EXPERIENCE §Accessibility Floor |
| Reflow / zoom | 320 CSS px sem perda; zoom 200% (equivalente: metade das dimensões em CSS px) | EXPERIENCE §Accessibility Floor |
| Faixa DEV no e2e | `--dev-banner-height: 28px` (`.env.e2e` ⇒ `VITE_APP_ENV=development`) | `index.css:13-29`; `.env.e2e` |
| Tags axe | `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`; sem `disableRules` | `e2e/axeHelper.ts:8` |
| Atalhos | `[` sidebar, `B` Brain Dump — só `(min-width: 1024px)` | KB-01…KB-03; `ShellLayout.tsx:103-124` |

### Estado atual do código (arquivos lidos — linhas conferidas no HEAD `2fca13f`)

**`frontend/src/app/layout/shell/shellDestinations.ts` (157 linhas, UPDATE — coração desta story)**
- Tipos: `ShellDestination { key, label, path, badge? }` (`:28-34`), `ShellDestinationGroup` (`:37-41`), `ShellNavItem` (`:44-46`).
- Núcleo hardcoded fora do registro: `TODAY` (`:49`), `PLANNER_CHILDREN` (`:50-55`), `BRAIN_DUMP` com `badge:true` (`:56-61`), `ARCHIVE` (`:62`), `SETTINGS` (`:63`). `SHELL_BADGE_SX` (`:71-76`). `toDestination` (`:79-85`).
- `deriveShellNavItems(collections = registryCollections)` (`:93-123`): **`:96` `standalone = collections.filter(c => !c.nav.group)`; `:97-98` `find(c => c.id === 'habits')` / `'gratitude'`; push em `:108` e `:112`** — o hardcode da SHELL-DEBT-04. O grupo `saude` já é genérico (`:99-102`: filtra por `nav.group === 'saude'`, ordena por `nav.order`), mas a chave `'saude'` e o label `'Saúde'` são literais (`:99`, `:110`). `standalone` **não** é ordenado por `nav.order` hoje — a ordem vem da sequência de `push`.
- `flattenDestinations` (`:125`), `deriveBottomNavShortcuts` (`:141-155`): lança se `preferredPaths` for passado (`:145-149`, mensagem cita "Story 18.1"), dedup por `path`, `slice(0, 3)` via `appShell.bottomNavConfigurableItems` (`tokens.ts:108`).

**`frontend/src/app/layout/shell/ShellSidebar.tsx` (350 linhas, UPDATE)**
- **Dois predicados**: `:105` `isActive = path => location.pathname === path` (exato — usado em `renderDestination:134`) e `:106-107` `containsRoute` (prefixo — usado só em `renderGroup:171`).
- `renderDestination` (`:133-161`); `destinationSx` (`:120-129`); `iconSx` (`:118`); `iconFor` com guard de ícone ausente (`:112-116`).
- `renderGroup` (`:166-236`): `activeChild` (`:171`), `showContains` (`:172`), `GroupIcon = navIcons[group.key]` **sem guard** (`:174`), `aria-expanded` (`:182`), `aria-describedby` (`:184`), `<p>` visualmente oculto `Contém a página atual: X.` (`:215-227`), `Collapse unmountOnExit` (`:229-233`).
- Props (`:57-74`): `{ collapsed, onToggle, onOpenCapture?, collections? }` — `collections` é seam de teste (produção nunca passa). `nav aria-label="Navegação principal"` (`:260-261`). Divisor antes de `settings` por `key === 'settings'` (`:289-296`). Âncora de captura (`:301-346`) com `aria-disabled` + guard (`:310-314`). `VISUALLY_HIDDEN` local (`:77-87`).

**`frontend/src/app/layout/shell/ShellNavigationSheet.tsx` (297 linhas, UPDATE)**
- `containsRoute` (`:81-82`) + `isActive = containsRoute` (`:83`); `visibleDestinations` respeitando `closedGroups` (`:89-95`); `focusPath` (`:98-100`); foco inicial armado só na abertura (`:112-124` — fix da review 13.3, WCAG `3.2.1`); `ModalProps={{ keepMounted: false }}` (`:214`); tokens reaplicados por `style` nos slots `paper`/`backdrop` (`:215-238`) porque `var()` não resolvia no portal; paper `bottom: calc(--ds-bottom-nav-height + safe-area)` (`:231-233`); `nav aria-label="Navegação completa"` (`:241-242`).
- `renderDestination` (`:128-168`) e `renderGroup` (`:171-201`) — as cópias a unificar. Diferenças reais vs sidebar: predicado (agora igual pela AC1), `onClick` também chama `onClose`, ausência de `aria-label` do rail, ausência de `:hover`, `ListItemIcon minWidth: 40` fixo, `ListItemText` sempre visível, sem `activeChild`/`aria-describedby` no grupo, peso do grupo fixo em 600.

**`frontend/src/app/layout/shell/ShellBottomNav.tsx` (143 linhas, UPDATE leve)**
- `containsRoute` (`:58-59`), `activeShortcut` (`:61`), `menuSelected = !activeShortcut` (`:65`) ⇒ `aria-current="page"` no Menu (`:135`); `shortcuts` derivado **no render** (fix da review 13.3).

**`frontend/src/app/layout/shell/ShellLayout.tsx` (274 linhas — provavelmente sem mudança)**
- Breakpoints (`:70-72`); `scrollPaddingTop` com `--dev-banner-height` (`:132`); `pb`/`scrollPaddingBottom` do compact (`:131-143`); `height: calc(100svh - var(--dev-banner-height))` (`:154`); `:focus-visible` global do shell (`:157-160`); FAB (`:230-263`) com `CAPTURE_FAB_ICON_SIZE = 24` (`:35`); reset de `menuOpen` ao sair do compact (`:93-97`); atalhos (`:103-124`); `SHELL_CONTENT_ID = 'conteudo-da-superficie'` (`:27`); **sem `<main>`** no shell (por design, `:18-27`).

**`frontend/src/app/collections/registry.ts`**
- `CollectionNav { label, group?, order }` (`:39-46`) — **não** tem campo de ícone Phosphor; `icon` da entrada é MUI (`:76`). 4 collections: `habits` (avulsa, order 0), `health-metrics` (`saude`, 0), `medications` (`saude`, 1), `gratitude` (avulsa, 1). `navIcons` mapeia por `id` da collection.

**`frontend/e2e/axeHelper.ts` (73 linhas)** — `expectNoAxeViolations(page, { include?, exclude?, label? })`; tags em `:8`; **nenhum `disableRules` existe no repo**; `include` nunca usado. Falha imprime regra/impacto/seletores/`helpUrl` (`:54-72`).

**Helpers reutilizáveis já existentes** — `dsToken` (`shell-sidebar.spec.ts:59-64`, lê `--ds-*` do `shell-root`), `hexToRgb` (`:67-71`), `computed` (`:73-78`), `waitForSheetSettled` e o padrão `expect.poll` para geometria de sheet (`shell-bottomnav.spec.ts`), `seedBrainDumpItems`. **Reusar; não reescrever.** Se um helper passar a ser usado por dois specs, extrair para um módulo em `e2e/` em vez de duplicar.

### Riscos concretos desta story

1. **Dois `aria-current` ao migrar a sidebar para prefixo.** É o modo de falha exato do AC1: `ShellNavigationSheet.test.tsx:160-173` já exige `length === 1`. Provar a invariante para **todas** as rotas de `shellRoutes`, não só para as testadas à mão.
2. **Mudar a ordem canônica ao generalizar os avulsos.** `shellDestinations.test.ts:19-34` compara os 12 labels **exatos**; `ShellSidebar.test.tsx:66-107` tem 10 asserts de ordem par-a-par; `ShellNavigationSheet.test.tsx:75-104` verifica 14 labels no DOM. Nenhum desses asserts deve ser editado — se a regra nova os quebra, a regra está errada (`habits` order 0 empata com `health-metrics` order 0: o tiebreak pelo índice no registro é o que mantém Hábitos antes de Saúde).
3. **Regressão silenciosa na extração da linha de destino.** Um `sx` perdido (`:hover`, `minWidth` condicional do rail, `justifyContent` do rail) não quebra teste jsdom mas quebra o E2E de geometria/cor da 13.2 (`shell-sidebar.spec.ts:112-190`). Rodar os specs de sidebar **antes** de declarar a task pronta.
4. **Guards `?raw` não seguem o código extraído — e hoje já são assimétricos.** Ao mover markup para um arquivo novo, nenhum grep existente o cobre. Pior: o tripé completo (mui-icons + literais + Query) existe **só** em `ShellBottomNav.test.tsx:138-153`, sobre `ShellBottomNav.tsx`/`ShellNavigationSheet.tsx`; `ShellSidebar.test.tsx:370-385` tem **apenas** o grep de `@mui/icons-material` (`:370-377`) e um teste de tokens (`:378-385`) que **não** grepa literais — e `ShellSidebar.tsx` **não** tem grep de `@tanstack/react-query` algum. Ou seja: **escrever** os greps faltantes (AC3/Task 3), não "estender" greps que não existem.
5. **Célula de matriz que "passa" por não ter medido nada.** `analyze()` numa rota que ainda não montou, ou com o sheet em transição, dá verde falso. Aguardar marcador estável (título na `banner`, `toBeFocused`, `expect.poll` de geometria) antes de cada `analyze()`.
6. **Faixa DEV esquecida na geometria de foco.** `--dev-banner-height` é **28px** no ambiente e2e. Assert de "não encoberto" que assume 0 no topo dá falso negativo/positivo. Ler os tokens do DOM.
7. **Zoom 200% "emulado" que não reflui.** `Emulation.setPageScaleFactor` é pinch-zoom: não muda CSS px e não recompõe. A emulação contratada é viewport em CSS px equivalentes (720×450 / 640×400), com a equivalência documentada no spec.
8. **O sheet marca o conteúdo inferior como inerte** (`aria-hidden` do Modal — é o contrato do AC4 da 13.3): com o sheet aberto, `getByRole` **não** encontra a bottom nav. Asserts nesse estado usam locator CSS (achado registrado na 13.3).
9. **Playwright trata `aria-disabled` como "not enabled"**: clique em controle offline precisa de `force` (achado do passo QA da 13.3).
10. **Custo de tempo do E2E.** Cada teste faz signup real; a matriz adiciona ~18 células. Rodar escopado (Task 10) e evitar `page.goto` desnecessário. Se a suíte estourar tempo, **não** cortar células — reduzir setup (uma rota por teste, sem seeds que a célula não usa).
11. **Sticky sob o workspace com `overflow:auto`.** `HealthHistoryTable`/`HabitHistoryGrid` usam `position: sticky` horizontal dentro do `<main>` legado; o container de scroll agora é o workspace do shell, não a janela. É verificação/registro (Task 8), **não** conserto de superfície legada.
12. **Contagem de testes inflada por duplicação.** Antes de escrever um teste novo para um `ST-0x`, procurar o existente (AC7 pede evidência nomeada, não cobertura nova).

### Project Structure Notes

Arquivos previstos:

```
frontend/src/app/layout/shell/shellDestinations.ts            UPDATE (predicado único + avulsos genéricos)
frontend/src/app/layout/shell/shellDestinations.test.ts       UPDATE (+ avulsa inédita, + invariante de 1 ativo)
frontend/src/app/layout/shell/ShellNavDestination.tsx         NEW    (linha de destino compartilhada)
frontend/src/app/layout/shell/ShellSidebar.tsx                UPDATE (predicado único, guard do ícone de grupo, consome a linha compartilhada)
frontend/src/app/layout/shell/ShellSidebar.test.tsx           UPDATE (+ rotas de histórico/settings/archive, + grupo sem ícone, + avulsa inédita, + greps NOVOS de Query e de literais para ShellSidebar.tsx; asserts existentes intactos)
frontend/src/app/layout/shell/ShellNavigationSheet.tsx        UPDATE (predicado único, guard do ícone de grupo, consome a linha compartilhada)
frontend/src/app/layout/shell/ShellNavigationSheet.test.tsx   UPDATE (asserts existentes intactos)
frontend/src/app/layout/shell/ShellBottomNav.tsx              UPDATE (consome o predicado do módulo)
frontend/src/app/layout/shell/ShellBottomNav.test.tsx         UPDATE (tripé de greps `:138-153` passa a cobrir o arquivo novo da linha compartilhada)
frontend/e2e/shell-a11y.spec.ts                               UPDATE (matriz de faixas/rotas/estados — dono único do gate axe)
frontend/e2e/shell-keyboard.spec.ts                           NEW    (teclado, tab order, foco não encoberto, live region única, zoom/reflow)
_bmad-output/implementation-artifacts/13-shell-parity-checklist.md      UPDATE (coluna Evidência, DIV novas, dívidas fechadas, seção de fechamento)
_bmad-output/implementation-artifacts/13-shell-a11y-legacy-inventory.md NEW (inventário SHELL-DEBT-02, não-bloqueante)
```

- Se a auditoria de teclado/zoom couber melhor dentro de `shell-a11y.spec.ts`, consolidar lá — o que **não** vale é criar um terceiro dono do gate axe.
- `app/layout/shell/` = chrome com dono; pode importar `features/braindump`, `app/collections/registry`, `shared/design/tokens`, `shared/hooks`. `shared/` nunca importa `app/`/`features/` (boundary do ESLint).
- **Nenhuma dependência nova.** Lockfile: MUI `6.5.0`, TanStack Query `5.101.1`, React `19.2.x`, Router `6.30.x`, Vite `8.x`, Vitest `4.1.9`, Playwright `1.61.x`, `@axe-core/playwright` + `jest-axe` já instalados.

### Testing Requirements

- **Vitest + Testing Library + `jest-axe`**, padrão de chrome: `MemoryRouter`, mock do barrel `features/braindump` (`BrainDumpBadge` **e** `BrainDumpCaptureSheet`), **sem** `QueryClientProvider`. Não introduzir filho com Query no chrome (quebraria `AppLayout.test.tsx`/`router.test.tsx`/`RouteAnnouncer.test.tsx` — lição recorrente do projeto).
- `ShellLayout.test.tsx:30-46` casa **strings literais** de `mediaQueries` no mock de `matchMedia` (`'(min-width: 1024px)'`, `'(max-width: 767px)'`, `'(min-width: 768px) and (max-width: 1023px)'`) — não alterar essas strings em `tokens.ts`.
- **CI não roda Vitest nem Playwright** (arquitetura §7.4): a execução local completa é o gate. Contagens em Completion Notes com comando real + saída literal; herdados/novos pelo diff.
- **`nvm use 22.15.1`** antes de todo comando de frontend/e2e (a sessão inicia em Node 18).
- **Playwright:** ambiente e2e isolado (`--mode e2e`, portas 5173/8000) — **nunca** derrubar 5174/8001 (dev local do usuário). Falha em massa no fixture de signup ⇒ checar vazamento de `VITE_API_BASE_URL` antes de culpar o banco. `workers: 1` e `expect.timeout: 10_000` são default do config.
- **Banco e2e:** a credencial da branch Neon `e2e` está **stale** (pendência ops do dono). Workaround validado nas 13.2/13.3: `DATABASE_URL` one-shot apontando o Postgres **local** `bujo_e2e` (`postgres://postgres:postgres@localhost:5432/bujo_e2e`) ao rodar o Playwright. E2E **não** fica "não verificado".
- Esta story **não** cria migration — sem passo de migration no banco e2e.
- Baselines a bater: Vitest **89 arquivos / 952 testes**; E2E dos 4 specs do shell **41 passed**.
- File List final nomeia artefatos de tipo novo (spec E2E novo, inventário) e é reconciliada com `git status --short` **depois** de QA/E2E (guardrail das retros 3/4/11/12).

### Previous Story Intelligence

**Story 13.3 (`done`)** — base direta e fonte das 3 dívidas desta story:
- A review corrigiu 4 médios + 3 baixos e **registrou de propósito** SHELL-DEBT-03, SHELL-DEBT-04 e a duplicação `renderDestination`/`renderGroup` para o passe da 13.4 — são exatamente as ACs 1–3 daqui.
- Lições aplicáveis: (a) refatoração "sem mudar comportamento" funciona quando os testes existentes são o detector e **não** são editados (Task 1 da 13.3, 17 testes); (b) tokens `--ds-*` via `style` no root não alcançam paper de portal — reaplicar nos slots; (c) `expect.poll` para geometria após transição; (d) teste negativo sem assert é cobertura falsa (achado #4 da review); (e) derivação em escopo de módulo congela o valor — derivar no render.
- O passo QA da 13.3 fechou 14 gaps de E2E e registrou honestamente o que **não** cobriu (swipe-down, safe-area) — mesmo padrão de honestidade esperado aqui.

**Story 13.2 (`done`)** — `ShellSidebar` + `navIcons` + badge `max`/`badgeSx`; padrão de mock rico (data-attrs) e greps `?raw` de guarda; fallback de ícone para collection fora do catálogo (**preservar e estender ao agrupador** — AC2).

**Story 13.1 (`done`)** — tokens, `shellRouting` puro, `axeHelper`, checklist enumerada; aprendizados: regra `region` do axe exige landmark para conteúdo solto (o seam virou `aside` por isso), `jest-axe` **não** roda `color-contrast` em jsdom (só o axe real do Playwright pega — por isso a matriz E2E é o gate desta story), `scrollIntoView` opcional em jsdom, `Typography` custom como bloco precisa `component="div"`. A nota da 13.1 sobre scroll do workspace (`overflow:auto` no lugar do scroll de documento) foi explicitamente deixada "para um olhar no passe de paridade da 13.4" — Task 8.

**Story 13.0 (gate UX)** — delegou nominalmente à 13.4: "paridade e WCAG 2.2 AA em wide/medium/compact, reflow, teclado, foco, screen reader e regressão visual" e "13.4 fecha a matriz wide/medium/compact". Rejeições que continuam valendo: foco inicial no Fechar, expansão automática de grupo recolhido com rota ativa, achatamento de Saúde com um filho, badge com contagem exata acima de 9, toggle Legado/Moderno, preferência de sidebar persistida.

### Git Intelligence

- HEAD da `dev`: `2fca13f feat(story-13.3): Bottom-nav e captura persistente mobile`. Antes: `d14e366` (13.2), `1055990` (13.1), `e9cba41` (env e2e dedicado + branding 3 estados), `ee50f10` (spec UX 13.0).
- Padrão dos commits do épico: um commit por story, mensagem `feat(story-13.x): <título>`.
- Branch de trabalho: `dev` (homologação); `main` = prod só após homologar. Na automação, commit com `--no-gpg-sign` (1Password SSH indisponível) e `git add` **escopado** (nunca `git add -A`).
- Protocolo de fechamento: rodar `/bmad-uncommitted-report`, salvar o report, commitar sem pedir confirmação.
- Único arquivo sujo no início: `_bmad-output/story-automator/orchestration-13-20260724-130311.md` (log da sessão do orquestrador).

### Pesquisa técnica

- **`@axe-core/playwright`**: `withTags` já cobre `wcag22aa`; `color-contrast` só roda em browser real (jsdom não computa cor) — a matriz E2E é o único lugar onde `1.4.3` é de fato medido. `exclude` aceita seletor CSS; **não** usar `disableRules` (nenhuma ocorrência no repo, e silenciar regra global é proibido pelo padrão do épico).
- **Emulação de zoom no Chromium/Playwright**: `page.setViewportSize` em CSS px equivalentes é a emulação previsível para reflow/zoom (200% ⇒ metade das dimensões). `Emulation.setPageScaleFactor` via CDP é pinch-zoom: escala pixels sem recompor layout — inadequado para `1.4.4`/`1.4.10`. `document.documentElement.style.zoom` recompõe no Chromium, mas interage com `position: fixed`, `100svh` e `env(safe-area-inset-*)` — só como complemento documentado.
- **WCAG 2.2 AA relevante ao passe**: `1.4.3` contraste (chrome inteiro na matriz), `1.4.4` resize text (zoom 200%), `1.4.10` reflow (320 CSS px), `1.4.11` non-text contrast (borda 3px do ativo, `control-border` da âncora), `2.1.1`/`2.1.2` teclado e foco contido no sheet, `2.4.3` ordem de foco, `2.4.7` foco visível, `2.4.11` **foco não encoberto** (chrome fixo — o SC novo da 2.2 que este passe mede), `2.5.8` target size (44/48/52px), `3.2.1` on focus (fix da review 13.3), `4.1.2` name/role/value (`aria-current`/`aria-expanded`/`aria-disabled`), `4.1.3` status messages (live region única de rota).
- **Nada de novo a instalar**: Phosphor, MUI, axe e Playwright já resolvidos no lockfile; a story não sobe versão.

### Project Structure / Architecture Compliance

- **AD-17 (manifest de collections)**: a AC2 é o DoD estrutural do AD-17 virando teste ("collection nova = pasta + UMA entrada no registro"). O núcleo BuJo permanece **fora** do registro (FR-1.1). Flags/gateamento continuam fora do dado estático (Épico 10 filtra o registro; a derivação só precisa tolerar a lista filtrada).
- **§7.2 Fronteiras**: `app/` pode importar `features/`/`shared/`; `shared/` nunca importa `app/`/`features/`. O módulo compartilhado da linha de destino é chrome ⇒ mora em `app/layout/shell/`, não em `shared/`.
- **§7.4**: sem gate de CI para Vitest/Playwright ⇒ a execução local é o gate real; `types.gen.ts` e OpenAPI não são tocados (story 100% frontend).
- **migration-plan (DoR/DoD por onda)**: "não avançar quando a onda exige alterar regra de produto; **registrar a divergência para o artefato upstream adequado**" — é a origem literal das divergências contratadas do AC8. O rollback de prod é **não promover** `dev → main`.

### Questões abertas (registradas; não bloqueiam o #YOLO)

As decisões herdadas das 13.2/13.3 — **3** marcadas "A confirmar com UX/Hugo no passe da 13.4" (checklist `:154`, `:188`, `:195`) **+** a reconciliação do chevron (`:156-160`, sem marcador de pendência) — são **promovidas a divergências contratadas** pelo AC8, 4 no total, com a justificativa de cada uma. Se UX/Hugo discordar de qualquer delas, o custo é de uma linha:

1. **Ícone do cabeçalho `Planner`** *(marcada "a confirmar" — checklist `:154`)* — `Notebook` (`navIcons.tsx:81-87`); o catálogo fechado do DESIGN.md dá glyph de agrupador só a `Saúde`. Troca = uma linha em `navIcons.tsx`.
2. **Chevron do agrupador** *(não marcada — checklist `:156-160` já a escreve como reconciliada)* — glyph unicode `⌄`/`⌃` `aria-hidden` (o catálogo não define chevron e o épico proíbe `@mui/icons-material` no chrome novo).
3. **`aria-current="page"` no botão Menu** *(marcada "a confirmar" — checklist `:188`)* (`ShellBottomNav.tsx:65,135`) — EXPERIENCE exige "Menu aparece selecionado" e o mockup aprovado marca `aria-current`; Menu é botão que abre sheet, não destino, então o atributo é heterodoxo. Alternativa, se UX preferir: manter só os canais visuais + `aria-expanded`.
4. **`CAPTURE_FAB_ICON_SIZE = 24`** *(marcada "a confirmar" — checklist `:195`)* (`ShellLayout.tsx:35`) contra os 20px de `{components.app-shell-nav-icon}` — mockup aprovado, área de 52px.
5. **Leitor de tela real não é automatizável nesta suíte** — a cobertura de "screen reader" delegada pela 13.0 é exercida por nome/papel/estado acessível (axe + asserts de `aria-current`/`aria-expanded`/`aria-disabled`/`aria-describedby`) e pela live region única de rota; nenhum teste dirige NVDA/VoiceOver. Registrar como limitação conhecida no checklist, não como item verificado.
6. **Regressão visual automatizada do chrome** — não introduzida na Onda 2a (justificativa no AC8: paridade medida por asserts semânticos/geométricos e Playwright fora do CI). Se Hugo quiser baselines de imagem, é uma story própria de infraestrutura de teste.

**Não é questão aberta:** `prefers-reduced-motion` / UX-DR30 item 6. Está **decidido e fechado** — waiver consciente do dono (Hugo, 2026-07-24), registrado em *Decisão consciente de produto — reduced motion* e na linha `A11Y-07` do checklist. Nada a confirmar, nada a implementar, nada a deferir.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.4-Passe-de-paridade-e-acessibilidade-do-shell]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-13-Onda-2a--App-Shell-no-Sistema-Novo]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-Design-Requirements] (UX-DR30 aceite por story + DoR; UX-DR22 app shell; UX-DR21 tokens; UX-DR20 WCAG 2.2 AA; UX-DR19 atalhos)
- [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional-Requirements] (NFR-1 — mobile sem scroll horizontal)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Accessibility-Floor] (piso integral: landmarks, targets, focus ring, zoom 200%/reflow 320, foco não encoberto, live regions, badge `9+`, grupo recolhido com filho ativo)
- [Source: .../EXPERIENCE.md#Responsive--Platform] (faixas wide/medium/tablet/compact e gutters)
- [Source: .../EXPERIENCE.md#State-Patterns] (loading/empty/error/offline/disabled/readonly; nav mínima; captura offline; menu mobile aberto; seam legado) · [Source: .../EXPERIENCE.md#Resiliência-canônica] (retorno de foco ⇒ Menu)
- [Source: .../EXPERIENCE.md#Interaction-Primitives] (`Esc`, tab order, `[`/`B`, fechamento do sheet)
- [Source: .../EXPERIENCE.md#Component-Patterns] (App Shell, App Shell Navigation, Badge, Persistent Capture, Mobile Navigation Sheet, Legacy Seam Notice) · [Source: .../EXPERIENCE.md#Information-Architecture] (§App shell)
- [Source: .../EXPERIENCE.md#UX-Acceptance-Criteria] (os 10 itens; espelho do UX-DR30) · [Source: .../EXPERIENCE.md#Migration-Strategy] (gate da Onda 2 = paridade funcional desktop/mobile + rollback comprovado)
- [Source: .../DESIGN.md#App-Shell] (geometria, ativo multi-canal, badge, captura, bottom nav, sheet, seam) · [Source: .../DESIGN.md#Catálogo-Phosphor-do-App-Shell] (catálogo fechado — sem glyph para o agrupador Planner, sem chevron)
- [Source: .../reconcile-story-13-0-app-shell.md#Promovido-aos-spines] · [Source: .../reconcile-story-13-0-app-shell.md#Não-promovido--rejeitado]
- [Source: .../review-accessibility-product.md] (0 achados; notas de cobertura sobre reflow/zoom/targets, contraste de `control-border` e focus ring nos 8 temas)
- [Source: _bmad-output/specs/spec-design-system-migration/migration-plan.md] (Ordem de migração — Onda 2a; Critérios por onda; **Definition of Ready**; nota de promoção `dev → main`; riscos — "aceite mede paridade, não apenas screenshot")
- [Source: _bmad-output/implementation-artifacts/13-shell-parity-checklist.md] (A. SB-01…SB-15 · B. BN-01…BN-06 · C. FAB-01…FAB-06 · D. BD-01…BD-04 · E. KB-01…KB-03 · F. RA-01…RA-03 · G. A11Y-01…A11Y-07 (**`A11Y-07` = waiver consciente de reduced motion**) · H. ST-01…ST-06 · DIV-1…DIV-9 · SHELL-DEBT-02/03/04 · Rollback por superfície)
- [Source: _bmad-output/implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md] (delegação explícita à 13.4; stack declarada)
- [Source: _bmad-output/implementation-artifacts/13-1-fundacao-do-shell-novo-com-coexistencia-por-rota.md] (axe-core, tokens, nota do scroll do workspace)
- [Source: _bmad-output/implementation-artifacts/13-2-sidebar-nova-derivada-do-manifest.md] · [Source: _bmad-output/implementation-artifacts/13-3-bottom-nav-e-captura-persistente-mobile.md] (incl. Senior Developer Review — dívidas 03/04 e duplicação)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-17--Manifestregistry-estático-de-collections-fatia-1] · [Source: .../architecture.md#7.2-Fronteiras-Arquiteturais] · [Source: .../architecture.md#7.4-Configuração-Build-Testes--Deploy]
- [Source: frontend/src/app/layout/shell/shellDestinations.ts] · [Source: frontend/src/app/layout/shell/ShellSidebar.tsx] · [Source: frontend/src/app/layout/shell/ShellNavigationSheet.tsx] · [Source: frontend/src/app/layout/shell/ShellBottomNav.tsx] · [Source: frontend/src/app/layout/shell/ShellLayout.tsx] · [Source: frontend/src/app/layout/shell/navIcons.tsx] · [Source: frontend/src/app/layout/shell/shellRouting.ts]
- [Source: frontend/src/app/collections/registry.ts] · [Source: frontend/src/shared/design/tokens.ts] · [Source: frontend/src/index.css] · [Source: frontend/.env.e2e]
- [Source: frontend/e2e/axeHelper.ts] · [Source: frontend/e2e/shell-a11y.spec.ts] · [Source: frontend/e2e/shell-sidebar.spec.ts] · [Source: frontend/e2e/shell-bottomnav.spec.ts] · [Source: frontend/e2e/shell.spec.ts] · [Source: frontend/e2e/fixtures.ts] · [Source: frontend/playwright.config.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

**Experimentos de não-vacuidade (revert temporário + restauração, todos verificados por `git diff --stat` vazio depois):**

1. **Predicado de ativo revertido para match exato** (`isDestinationActive` → `pathname === path`) **+ guard de ícone removido** (`navIconFor` sem `if (!IconComp) return null`) ⇒ **19 testes falharam** nos 3 arquivos (`shellDestinations.test.ts`, `ShellSidebar.test.tsx`, `ShellNavigationSheet.test.tsx`). Prova que os casos novos de AC1/AC2 detectam de fato a regressão.
2. **Derivação revertida ao hardcode por `id`** (`entry.id === 'habits' || 'gratitude'`) ⇒ **6 testes falharam**, incluindo o grep de "nenhum id de collection hardcodado". Prova que a genericidade da AC2 é medida (o experimento #1 não provava isso, porque a avulsa inédita também quebrava pelo ícone).
3. **FAB com `bottom: '-30px'`** (estourando o rodapé) ⇒ `último focável "Captura rápida" saiu do viewport`. **FAB com `bottom: 0` + bottom nav com `z-index: 9999`** (barra cobrindo o FAB) ⇒ `último focável "Captura rápida" está encoberto`. Prova que os dois asserts do WCAG 2.2 `2.4.11` medem coisas diferentes e ambos morde. **Nota:** um primeiro experimento com só `bottom: 0` PASSOU — corretamente, porque o FAB vem depois da barra no DOM com o mesmo `z-index`, então ele cobre a barra, não o contrário. Foi o que levou aos dois experimentos separados.

**Achados de diagnóstico durante a montagem da matriz:**

4. **Célula `tablet · /habits` reprovava `target-size` de forma intermitente** (`div[aria-label="Futuro"]`). Causa: o tablet nasce com a sidebar **expandida** e colapsa por `useEffect`, com `transition: width 0.2s` no paper e `Collapse` fechando os filhos dos agrupadores — o axe media um filho de grupo sendo **clipado** pelo `Collapse`. É exatamente o risco #5 da story ("célula que mede durante transição"). Corrigido com o helper `waitForRailSettled` (espera o paper em 64px **e** os filhos desmontados), não com tolerância no assert.
5. **Nome acessível aproximado por `textContent` incluía o chevron decorativo** (`"Planner⌃"`), quebrando o assert de ordem de Tab. A sequência de Tab passou a ser assertada pelos **locators do Playwright** (que calculam o nome acessível de verdade) e o enumerador de focáveis passou a remover subárvores `aria-hidden`.
6. **`getByLabel('Migrada')` e `getByLabel('Fechar')` ambíguos** em `archive.spec.ts:97` e `daily-tasks.spec.ts:89` (strict mode violation, 2 elementos cada). **Verificado por `git stash` que as duas falhas existem no baseline `2fca13f` sem nenhuma mudança desta story** — são pré-existentes, não regressões (detalhe nas Completion Notes).

**Experimento de não-vacuidade do passo de review:**

7. **Guard de modificador revertido para o ramo do `B` só** (estado pré-review de `ShellLayout.tsx`) ⇒ o assert novo **reprovou** em `shell-keyboard.spec.ts:325`, com o paper medido em `226.688px → 183.062px → 105.938px → 64px` (a transição `width 0.2s` do rail sendo capturada pelo auto-retry do matcher) — prova que `Control+[` de fato colapsava a sidebar e que o assert novo mede isso. Restaurado; `git diff --stat` do arquivo volta a mostrar só a correção da review (9 inserções / 4 remoções).

**Probe descartado:** um spec temporário (`e2e/zz-probe-tmp.spec.ts`, criado e **removido** na mesma execução) enumerou os elementos com `right > clientWidth` em `/habits/history` a 800px para localizar a origem do scroll horizontal do documento ⇒ levou ao achado LEG-04 (`HabitHistoryGrid.srOnly` com `width: 1` = 100% no sistema `sizing` do MUI). Não ficou no repositório.

### Completion Notes List

#### O que foi entregue

**AC1 · SHELL-DEBT-03 fechada — predicado de ativo unificado.** `isDestinationActive(pathname, path)` é agora a **única** implementação, exportada do módulo puro `shellDestinations.ts` e consumida pelas três superfícies. As 3 cópias literais foram removidas (`ShellSidebar` perdeu `isActive` exato **e** `containsRoute`; `ShellBottomNav` e `ShellNavigationSheet` perderam os seus `containsRoute`). A mudança de comportamento intencional: as **9 rotas profundas** que deixavam a sidebar sem nenhum destino ativo agora marcam o **pai** com `aria-current="page"` + todos os canais visuais. A invariante de **exatamente um** `aria-current` foi provada **sobre `shellRoutes` inteiro** (não por inspeção), mais um teste de que nenhum destino da nav é prefixo de outro. `/daily/:date` continua sem destino ativo — **contrato registrado** em teste e no checklist, não bug.

**AC2 · SHELL-DEBT-04 fechada — derivação genérica + guard de agrupador.** `deriveShellNavItems` monta **unidades** (avulsa | grupo) e ordena por `nav.order` com tiebreak no índice de primeira ocorrência no registro; **zero `id` literal** (com grep de guarda sobre o código, ignorando comentários). A ordem canônica dos 12 labels é preservada byte-a-byte — o assert de ordem existente **não foi editado**. O DoD estrutural do AD-17 virou teste executável: uma collection avulsa **inédita** aparece na lista achatada, na sidebar e no sheet, na posição do `nav.order`, sem ícone e sem crash. O guard de ícone subiu para `navIcons.navIconFor` e passou a valer também para o **cabeçalho de grupo**, que antes derrubava o chrome inteiro com uma `nav.group` nova.

**AC3 · linha de destino compartilhada.** `ShellNavDestination.tsx` (novo) substitui as duas cópias de `renderDestination`. Os **23 testes** que `ShellSidebar.test.tsx` já tinha e os **16** de `ShellNavigationSheet.test.tsx` — os 39 que a story nomeia como detector — passam **sem edição de nenhum assert existente**. Contagens reais depois das adições desta story: `ShellSidebar.test.tsx` **39 passed**, `ShellNavigationSheet.test.tsx` **19 passed**, `shellDestinations.test.ts` **21 passed**, `ShellBottomNav.test.tsx` **11 passed** (mesmo 11 de antes — só asserts novos dentro dos 3 `it` do tripé). O **cabeçalho de grupo permanece duplicado de propósito** — unificá-lo exigiria 4 props condicionais para 2 consumidores (rail, `aria-describedby`, peso condicional, chevron oculto no rail); registrado como **DIV-15** no checklist com a justificativa. Os greps `?raw` que **não existiam** foram escritos: tripé completo sobre o arquivo novo (no lugar onde o tripé já mora, `ShellBottomNav.test.tsx`) + os dois greps inexistentes sobre `ShellSidebar.tsx` (`@tanstack/react-query` e literais `\b(56|64|240|52|48)\b`). Como previsto, nasceram **verdes**.

**AC4 · matriz axe.** `shell-a11y.spec.ts` foi de **2 para 16 células** — as 12 rotas da Tabela A e 4 das 6 células de estado da Tabela B (as outras 2 continuam nos specs donos do seu estado: rail em `shell-sidebar.spec.ts`, sheet aberto em `shell-bottomnav.spec.ts`, e contam para a matriz). Tags WCAG 2.2 AA sem `disableRules`, nenhum `skip`/`fixme`, `label` no formato `faixa · rota · estado`, marcador estável antes de cada `analyze()`. **medium e tablet, que não tinham cobertura nenhuma, entraram.**

**AC5/AC6 · teclado, foco, live region, zoom e reflow.** `shell-keyboard.spec.ts` (novo, 24 testes): skip link como primeiro focável nas 4 faixas; ordem de Tab por nome acessível; **foco não encoberto** (`2.4.11`) medido por hit-test `elementFromPoint` + tokens lidos do DOM (com assert explícito de que `--dev-banner-height` é **> 0** no e2e — nunca 0 assumido) em **7 viewports**; anel de foco resolvido a partir de `--ds-focus`/`--ds-focus-ring-*`; atalhos `[`/`B` com casos **positivos** (wide, medium) e **negativos** (tablet, compact) + guards de campo editável e de `ctrl`/`meta`; `Escape` devolvendo o foco ao **Menu**; **uma única** live region de rota no chrome, escopada com `:not(main …)`. Zoom 200% emulado por **viewport equivalente** (720×450 e 640×400), com a escolha e o descarte de `setPageScaleFactor`/`style.zoom` documentados no spec; a **recomposição** para compact é parte do aceite e nenhum destino/ação se perde.

**AC7 · estados com evidência nomeada.** `shell-states.spec.ts` (novo) cobriu as **3 lacunas** (`ST-01`, `ST-02`, `ST-06`); `ST-03`/`ST-04`/`ST-05` e a nav mínima foram **mapeados para os testes existentes**, sem duplicar cobertura (a lista está no cabeçalho do spec e na seção H do checklist). `ST-06` ganhou um assert forte: o **inventário de controles do chrome é fechado** (toggle + 14 destinos + captura persistente) — nenhuma ação de escrita da superfície subiu ao chrome. Duas linhas novas foram acrescentadas à seção H para não deixar contrato em prosa: `ST-07` (nav mínima) e `ST-08` (collection/grupo inédito = DoD do AD-17).

**AC8 · checklist fechada.** Coluna **Evidência** em A–H com `arquivo::nome do teste`; **nenhum item com status `13.4`**; SHELL-DEBT-03/04 **fechadas**; SHELL-DEBT-02 **re-escopada** com dono explícito (Ondas 3–5 + Épico 18) e link para o inventário novo. As 3 decisões "a confirmar" **mais** o chevron foram promovidas a **DIV-10…DIV-13** (cada uma com upstream, linha de código e custo de reversão de uma linha); a ausência de regressão visual é **DIV-14**; e **DIV-15…DIV-20** registram as limitações de composição (agrupador duplicado, label de grupo fora do registro, exclude estendido à captura portalizada, ordem de DOM do FAB, leitor de tela real, swipe/safe-area). `A11Y-07` foi **preservado como waiver**, e a seção nova **"Onda 2a — equivalência comprovada"** traz a tabela faixa × rota × estado e o resumo dos gates. Acrescentei `A11Y-08/09/10` (zoom/reflow, ordem de foco, alvos de toque) porque eram contrato em prosa sem ID — enumeração **aditiva**, nada renumerado.

**AC8 · inventário e sticky.** `13-shell-a11y-legacy-inventory.md` (novo) com os achados de `/today` **sem** `exclude`, por faixa, cada um com nó, medição e dono. A **nota da 13.1 sobre o scroll do workspace está resolvida: FUNCIONA**, sem onda própria — as duas tabelas têm o próprio `overflow-x: auto` **entre** o `sticky` e o workspace, provado subindo o DOM até o primeiro ancestral de scroll e verificando que ele **não** é `[data-testid="shell-workspace"]`.

**AC9 · legados intocados.** `git diff --stat` **vazio** em `AppLayout.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `theme.ts` e `registry.ts`; `shellRouting.ts` **sem diff** e sem nenhuma rota virando `'legacy'` (as 22 entradas seguem `shell: 'new'`).

#### Gates executados (comando real + saída literal)

**Vitest** — `nvm use 22.15.1 && npm run test:run`:

```
 Test Files  89 passed (89)
      Tests  981 passed (981)
```

Baseline re-executada no início desta story, no commit `2fca13f`: `89 passed (89)` / `952 passed (952)`.
**Divisão derivada do `git diff`, não por subtração:** `952 herdados + 29 novos = 981`. Os 29 vêm de 20 declarações `it(...)` adicionadas — 10 em `shellDestinations.test.ts`, 3 em `ShellNavigationSheet.test.tsx` e 7 + 1 templada em `ShellSidebar.test.tsx`, sendo que a templada (`for (const { path, destino } of rotasProfundas)`) gera **9** testes ⇒ 10 + 3 + 7 + 9 = 29. Nenhum `it(...)` foi removido (`git diff` de `-  it('` = 0) e **nenhum assert existente foi editado**. `ShellBottomNav.test.tsx` ganhou asserts novos dentro dos 3 `it` do tripé, sem `it` novo.

**Typecheck** — `npm run typecheck`: `tsc -b --noEmit`, **sem saída** (limpo).
**Lint** — `npm run lint`: `eslint .`, **sem saída** (limpo).

**E2E — 6 specs do shell** (`CI=1 DATABASE_URL=postgres://postgres:postgres@localhost:5432/bujo_e2e npx playwright test e2e/shell.spec.ts e2e/shell-a11y.spec.ts e2e/shell-sidebar.spec.ts e2e/shell-bottomnav.spec.ts e2e/shell-keyboard.spec.ts e2e/shell-states.spec.ts --reporter=line`):

```
  86 passed (3.2m)
```

Baseline dos 4 specs do shell no `2fca13f`: **41 passed**. **Divisão derivada por contagem de testes por arquivo:** `41 herdados + 45 novos = 86` — `shell.spec.ts` 7 (inalterado) · `shell-a11y.spec.ts` 2 → **16** (+14) · `shell-sidebar.spec.ts` 10 (inalterado) · `shell-bottomnav.spec.ts` 22 (inalterado) · `shell-keyboard.spec.ts` **24** (novo) · `shell-states.spec.ts` **7** (novo).

**E2E — specs que navegam pelo chrome** (`brain-dump`, `archive`, `daily-tasks`, `gratitude-history`, `habit-history`, `health-history`, `medications-history`):

```
  2 failed
    [chromium] › e2e/archive.spec.ts:38:1 › lista ciclos fechados e navega para semana/mês com estado final, sem affordance de escrita (AC1, AC2)
    [chromium] › e2e/daily-tasks.spec.ts:79:1 › subtarefa cicla status independente do pai, sem cascata
  27 passed (1.6m)
```

**As duas falhas são PRÉ-EXISTENTES e foram verificadas como tal, não estimadas.** Fiz `git stash push -u -- frontend/` (voltando a árvore ao `2fca13f` puro), rodei os dois specs e obtive **exatamente as mesmas 2 falhas** (`2 failed / 5 passed`), depois restaurei com `git stash pop`. Ambas são *strict mode violation* por locator ambíguo na **superfície legada**, sem relação com o chrome desta story:

- `archive.spec.ts:97` — `getByLabel('Migrada')` casa **2** elementos dentro do mesmo `task-row`: o `IconButton` `aria-label="Migrada"` e o `Chip` `aria-label="Migrada 2 vezes"` (o `getByLabel` do Playwright casa por substring). É ambiguidade introduzida pelo chip de contagem de migrações da superfície legada.
- `daily-tasks.spec.ts:89` — `page.getByLabel('Fechar')` casa **2**: o "Fechar" do `TaskDetailPanel` e o do `BrainDumpCaptureSheet`. O sheet de captura é a **instância única montada pelo `ShellLayout` desde a Story 13.3** (FAB-05) e o `SwipeableDrawer` do MUI mantém o paper montado mesmo fechado — no `AppLayout` legado ele vivia dentro da `BottomNav` (só compact), então no desktop não existia. **Origem: Story 13.3, não 13.4** — a 13.3 rodou só os 4 specs do shell e nunca exercitou `daily-tasks.spec.ts`.

Não corrigi nenhuma das duas: ambas pedem escopar o locator no spec da superfície legada, o que está fora do escopo desta story (que é 100% chrome e não toca superfícies). Registro aqui como **achado para triagem**, com a recomendação de escopar os locators (`detailPanel(page).getByLabel('Fechar')` e `migratedRow.getByRole('button', { name: 'Migrada' })`) — é correção de spec, de uma linha cada, e o segundo caso é consequência direta de uma decisão de arquitetura da 13.3 que vale para todo spec de desktop daqui em diante.

**Coletor de inventário** (não é gate) — `npx playwright test --config playwright.inventory.config.ts --reporter=line`: `5 passed`, uma execução por faixa.

#### Decisões e divergências assumidas nesta execução

1. **`exclude` estendido à superfície legada de captura (DIV-17).** As duas células "Capture Sheet aberto" reprovaram `color-contrast` num nó que **não é chrome**: o label do `TextField` "Título" em foco, pintado pelo `primary.main` do tema **legado** (`#2bada0`, ≈2.8:1). O AC4 proíbe `exclude` novo, mas também prevê "registrada como divergência com o motivo e o artefato upstream de destino" — e o MUI **portaliza** o sheet, então ele cai fora do `<main>` que a SHELL-DEBT-02 já excluía. Assumi a exclusão como **extensão de escopo da SHELL-DEBT-02** (`exclude: ['main', '[role="dialog"][aria-label="Captura rápida"]']`), documentada no spec, registrada como DIV-17 no checklist e inventariada como **LEG-03** com dono (Épico 15 + Épico 18). Nenhuma regra do axe foi desligada; `disableRules` continua não existindo no repositório. `theme.ts` é explicitamente fora de escopo. **Se o dono preferir, a alternativa é corrigir `theme.ts` numa story própria e remover a exclusão.**
2. **`axeHelper.exclude` passou a aceitar `string | string[]`** (retrocompatível) para viabilizar o item acima sem duplicar chamadas.
3. **Helpers de E2E do shell extraídos para `e2e/shellHelpers.ts`.** `dsToken`/`hexToRgb`/`computed`/`waitForSheetSettled` e os locators do chrome existiam **duplicados** em `shell-sidebar.spec.ts` e `shell-bottomnav.spec.ts`, e os dois specs novos precisavam dos mesmos. A story manda extrair em vez de triplicar. Os dois specs existentes passaram a importar do módulo (nenhum assert alterado; as contagens de 10 e 22 testes seguem idênticas).
4. **Coletor de inventário fora do gate por `testIgnore` + config própria**, não por `test.skip`. A story preferia "script/execução manual a um teste permanente pulado": `playwright.config.ts` ganhou `testIgnore: ['**/tools/**']` e criei `playwright.inventory.config.ts` (que só troca `testDir` e reaproveita webServer/banco/timeouts). Resultado: **nenhum teste `skip`ado na suíte** e a coleta é reproduzível por um comando.
5. **Seção H e G ganharam IDs novos** (`ST-07`, `ST-08`, `A11Y-08`, `A11Y-09`, `A11Y-10`) para contratos que existiam só em prosa (nav mínima, DoD do AD-17, zoom/reflow, ordem de foco, alvos de toque). É **aditivo**: nenhum ID existente foi renumerado ou removido.
6. **`prefers-reduced-motion`: nada implementado, nada testado, nada deferido.** Respeitei integralmente o waiver do dono — não há `@media (prefers-reduced-motion)`, `useMediaQuery('(prefers-reduced-motion: reduce)')` nem teste sobre o assunto em nenhum arquivo desta story. `A11Y-07` segue registrado como waiver consciente, e toda afirmação sobre o piso está qualificada com "exceto reduced motion".

#### Achados para triagem (fora do escopo desta story)

- **LEG-04 (novo) — `HabitHistoryGrid.srOnly` usa `width: 1`/`height: 1` no `sx` do MUI**, e no sistema `sizing` um número ≤ 1 significa **porcentagem**: cada rótulo sr-only de coluna vira um `span` absoluto de **100% da largura**, levando `documentElement.scrollWidth` a **2136px** num viewport de **800px** em `/habits/history`. É violação de NFR-1/`1.4.10` na **superfície legada** (pré-existente, o axe não pega) e o padrão correto já existe no chrome novo (`ShellSidebar.VISUALLY_HIDDEN` usa `'1px'`). Dono: **Onda 3 / Épico 14**. Inventariado.
- ~~**As 2 falhas de E2E pré-existentes** descritas acima (locators ambíguos em `archive.spec.ts` e `daily-tasks.spec.ts`).~~ **RESOLVIDO no passo de QA (`bmad-qa-generate-e2e-tests`, 2026-07-24):** as duas eram escopo de locator de **teste** (nenhuma linha de produto), corrigidas com uma linha cada — `getByLabel('Migrada', { exact: true })` e `panel.getByLabel('Fechar')`. Os 7 specs que navegam pelo chrome passaram a rodar **29 passed / 0 failed**. A lição fica registrada como convenção: desde a 13.3 existe uma instância de captura montada em **toda** faixa, então `getByLabel('Fechar')` sem escopo é ambíguo no app inteiro.
- **Árvore de trabalho com mudanças de outra sessão.** No fechamento, `git status` mostra artefatos de UX da **Story 14.0** (mockups, reconcile, review, `deferred-features.md`, `DESIGN.md`/`EXPERIENCE.md` modificados) que **não** são desta story e **não** estão no File List abaixo. O commit desta story precisa de `git add` **escopado**.

### File List

Reconciliada com `git status --short` **depois** de todos os gates (Vitest, typecheck, lint, os dois lotes de E2E, o coletor de inventário e os experimentos de não-vacuidade).

**Frontend — código do chrome (UPDATE):**

- `frontend/src/app/layout/shell/shellDestinations.ts` — predicado único `isDestinationActive`; derivação genérica por unidades com tiebreak; `GROUP_LABELS` nomeado
- `frontend/src/app/layout/shell/navIcons.tsx` — `navIconFor(key, weight)`: guard de catálogo ÚNICO, agora também para o cabeçalho de grupo
- `frontend/src/app/layout/shell/ShellSidebar.tsx` — consome o predicado único e a linha compartilhada; perde `isActive`/`containsRoute`/`iconFor`/`destinationSx`
- `frontend/src/app/layout/shell/ShellNavigationSheet.tsx` — idem; perde `containsRoute`/`isActive` e o `renderDestination` próprio
- `frontend/src/app/layout/shell/ShellBottomNav.tsx` — consome o predicado único e `navIconFor`; perde `containsRoute`

**Frontend — código do chrome (NEW — artefato de tipo novo: componente compartilhado do chrome):**

- `frontend/src/app/layout/shell/ShellNavDestination.tsx` — linha de destino compartilhada por sidebar e sheet

**Frontend — testes unitários (UPDATE; nenhum assert existente editado):**

- `frontend/src/app/layout/shell/shellDestinations.test.ts` — +10 testes (predicado, invariante sobre `shellRoutes`, avulsa inédita, tiebreak, grupo fora do catálogo, grep de `id` hardcodado)
- `frontend/src/app/layout/shell/ShellSidebar.test.tsx` — +16 testes (9 rotas profundas templadas, `/daily/:date`, agrupador, avulsa inédita ×2, grupo sem ícone, **2 greps `?raw` novos**)
- `frontend/src/app/layout/shell/ShellNavigationSheet.test.tsx` — +3 testes (avulsa inédita, grupo sem ícone, rotas profundas)
- `frontend/src/app/layout/shell/ShellBottomNav.test.tsx` — tripé `?raw` passa a cobrir `ShellNavDestination.tsx` (asserts novos nos 3 `it` existentes, sem `it` novo)

**Frontend — E2E (NEW — artefatos de tipo novo: 2 specs E2E permanentes, 1 módulo de helpers, 1 coletor e 1 config de Playwright):**

- `frontend/e2e/shell-keyboard.spec.ts` — **NEW** (24 testes): teclado, ordem de foco, foco visível/não encoberto, live region única, zoom 200%, reflow 320
- `frontend/e2e/shell-states.spec.ts` — **NEW** (7 testes): `ST-01`/`ST-02`/`ST-06` + verificação do `sticky` sob o workspace
- `frontend/e2e/shellHelpers.ts` — **NEW**: locators do chrome + `dsToken`/`dsTokenPx`/`hexToRgb`/`computed`/`waitForSheetSettled` (extraídos das duplicatas)
- `frontend/e2e/tools/legacy-a11y-inventory.spec.ts` — **NEW**: coletor do inventário SHELL-DEBT-02 (fora do gate)
- `frontend/playwright.inventory.config.ts` — **NEW**: config sob demanda dos coletores de `e2e/tools/`

**Frontend — E2E (UPDATE):**

- `frontend/e2e/shell-a11y.spec.ts` — matriz de 2 → 16 células; `waitForRailSettled`; escopo estendido nas 2 células de captura (DIV-17)
- `frontend/e2e/shell-sidebar.spec.ts` — passa a importar os helpers compartilhados (10 testes, inalterados)
- `frontend/e2e/shell-bottomnav.spec.ts` — idem (22 testes, inalterados)
- `frontend/e2e/axeHelper.ts` — `exclude` aceita `string | string[]` (retrocompatível)
- `frontend/playwright.config.ts` — `testIgnore: ['**/tools/**']` (coleta fora do gate)

**Passo de QA (`bmad-qa-generate-e2e-tests`, 2026-07-24) — acréscimos sobre o fechamento do dev-story:**

- `frontend/e2e/shell-active-destination.spec.ts` — **NEW** (5 testes): destino ativo no **router real** (sweep das 22 rotas autenticadas, pares de prefixo colidente `/settings/*` e `/archive/{weekly,monthly}/*`, agrupador recolhido com filho ativo por rota profunda, contrato do `/daily/:date` no sheet)
- `frontend/e2e/shell-keyboard.spec.ts` — **UPDATE** (+3 testes ⇒ 27): ordem de Tab em **medium** e no **rail do tablet**; anel de foco **dentro do sheet portalizado** (detector do defeito abaixo)
- `frontend/e2e/shell-a11y.spec.ts` — **UPDATE** (+1 célula ⇒ **17**): `wide · /today · skip link EM FOCO` — o estado visível do único controle do chrome que vive fora da tela, que o axe não media
- `frontend/src/app/layout/shell/ShellNavigationSheet.tsx` — **UPDATE (correção de produto)**: regra `:focus-visible` do token reaplicada no slot `paper`. O portal do MUI fica fora do `shell-root`, onde vive a regra do `ShellLayout`, e o `ButtonBase` aplica `outline: 0` ⇒ **nenhum** controle do sheet (Fechar, 2 agrupadores, 14 destinos) tinha anel de foco (A11Y-06 / WCAG `2.4.7`)
- `frontend/e2e/archive.spec.ts`, `frontend/e2e/daily-tasks.spec.ts` — **UPDATE**: locators escopados; fecham as 2 falhas pré-existentes (test-only)
- `_bmad-output/implementation-artifacts/tests/test-summary-13-4.md` — **NEW**: resumo do passo de QA

**Artefatos BMAD:**

- `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` — **UPDATE**: coluna Evidência em A–H, seção A.1, DIV-10…DIV-20, dívidas fechadas/re-escopadas, seção "Onda 2a — equivalência comprovada"
- `_bmad-output/implementation-artifacts/13-shell-a11y-legacy-inventory.md` — **NEW**: inventário LEG-01…LEG-04 + verificação do `sticky`
- `_bmad-output/implementation-artifacts/13-4-passe-de-paridade-e-acessibilidade-do-shell.md` — **UPDATE**: esta story (frontmatter, checkboxes, Dev Agent Record, File List, Change Log, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **UPDATE**: 13.4 `ready-for-dev` → `in-progress` → `review`

**Passo de review (`bmad-story-automator-review`, 2026-07-24) — acréscimos sobre o fechamento do QA:**

- `frontend/src/app/layout/shell/ShellLayout.tsx` — **UPDATE (correção de produto)**: o guard de `ctrl`/`meta`/`alt` subiu para **antes** do dispatch, passando a valer para os **dois** atalhos. Antes só o `B` era guardado, então `Cmd+[` — que é **"voltar"** no macOS — também colapsava a sidebar/rail, contra a cláusula do AC5 ("**ambos** … com guard de `ctrl`/`meta`/`alt`")
- `frontend/e2e/shell-keyboard.spec.ts` — **UPDATE**: (a) detector do defeito acima — `Control/Meta/Alt+[` não podem mexer na largura do paper, e `Alt+b` não navega (só `Control+b`/`Meta+b` eram cobertos); (b) `--ds-bottom-nav-height` deixa de ser lido e descartado: o último focável passa a ser assertado **fora da faixa** da bottom nav (o hit-test do centro não pega um controle que invada a barra apenas pela base)
- `frontend/e2e/shell-a11y.spec.ts` — **UPDATE**: 4 células traziam `label` só com `faixa · rota`; o AC4 exige `faixa · rota · estado`
- `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` — **UPDATE**: `KB-01` passa a declarar o guard de modificador; `A11Y-03` corrigido de 6 → **7** viewports (+ a faixa da barra); `A11Y-09` apontava para **DIV-15** (agrupador duplicado) quando a ordem de DOM do FAB é **DIV-18**; a tabela "além do axe" dizia 4 testes de `shell-active-destination.spec.ts` quando são **5**

**Não tocados (verificado por `git diff --stat` vazio):** `frontend/src/app/layout/AppLayout.tsx`, `frontend/src/app/layout/Sidebar.tsx`, `frontend/src/app/layout/BottomNav.tsx`, `frontend/src/theme.ts`, `frontend/src/app/collections/registry.ts`, `frontend/src/app/layout/shell/shellRouting.ts`. Backend, migrations, OpenAPI e `types.gen.ts` intocados — story 100% frontend.

> **Nota da review:** `ShellLayout.tsx` saiu da lista de "não tocados" (o dev-story e o QA o deixaram intacto; a review o alterou pela correção acima). Ele **não** é arquivo de rollback — a lista congelada do AC9 é `AppLayout.tsx`/`Sidebar.tsx`/`BottomNav.tsx`/`theme.ts`/`registry.ts`, e essa segue vazia no diff.

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito (via `bmad-story-automator-review`) · **Data:** 2026-07-24 · **Baseline:** `2fca13f`
**Resultado:** **Aprovada** — 0 críticos. 4 médios + 3 baixos encontrados; 6 corrigidos nesta review, 1 registrado.

### Alegações re-executadas (não aceitas no papel)

Toda contagem das Completion Notes foi **re-executada** neste passo, não lida:

| Gate | Alegado | Medido na review | Veredito |
|---|---|---|---|
| Vitest | 89 arquivos / 981 testes | `Test Files 89 passed (89)` / `Tests 981 passed (981)` | ✅ confere |
| `typecheck` | limpo | `tsc -b --noEmit` sem saída | ✅ |
| `lint` | limpo | `eslint .` sem saída | ✅ |
| E2E — 7 specs do shell | 95 passed | `95 passed (3.7m)` | ✅ confere |
| E2E — specs que navegam pelo chrome | 29 passed | `29 passed (1.4m)` | ✅ confere (as 2 falhas do dev-story estão de fato fechadas) |
| Legados de rollback sem diff | vazio | `git diff --stat 2fca13f` vazio nos 5 arquivos | ✅ |
| Nenhuma rota em `shell: 'legacy'` | 22 × `'new'` | 22 entradas `'new'`; a única ocorrência de `'legacy'` é **comentário** do procedimento de rollback (`:11-12`) | ✅ |
| Nenhum assert existente editado | 39 testes de sidebar+sheet intactos | `git diff` dos `*.test.*` do shell: **0** linhas removidas, **0** `it(` removidos | ✅ |

Também verificado por amostragem adversarial: a matriz axe tem de fato **17 células** (5 wide + 4 medium + 2 tablet + 4 compact 390 + 2 compact 320), as 18 células contratadas pelas Tabelas A/B estão cobertas (2 delas nos specs donos do estado), e nenhum `disableRules`/`skip`/`fixme` existe no repositório.

### Achados

**🟡 M1 — `[` sem guard de modificador: `Cmd+[` (voltar no macOS) colapsava a sidebar.** `ShellLayout.tsx:114` fazia o dispatch de `[` **antes** de qualquer checagem de `ctrlKey`/`metaKey`/`altKey` — o guard existia só no ramo do `B`. O AC5 contrata o guard para **ambos** ("ambos ignorados em `INPUT`/`TEXTAREA`/`contentEditable` **e com guard de `ctrl`/`meta`/`alt`**"), e o teste novo da faixa medium — cujo nome é literalmente `…com guard de campo editável e de modificador` — exercitava o modificador **só** no `b`, então a assimetria era invisível ao gate. É herança da 13.1 (o `AppLayout` legado tem a mesma forma), mas no shell novo o `[` de fato move a sidebar, e `Cmd+[` é atalho nativo do browser. **Corrigido:** guard único antes do dispatch + asserts de `Control/Meta/Alt+[` e `Alt+b`. `KB-01` do checklist passa a declarar o guard.

**🟡 M2 — referência cruzada errada no artefato de rastreabilidade.** `A11Y-09` remetia a **DIV-15** para justificar a ordem de DOM do FAB; DIV-15 é o *agrupador duplicado* e a ordem do FAB é **DIV-18**. Num documento cujo propósito é rastreabilidade, o leitor cai na divergência errada. **Corrigido.**

**🟡 M3 — duas contagens erradas no checklist.** `A11Y-03` dizia hit-test em **6** viewports (são **7**: wide, medium, tablet, compact 390, 320, 720×450, 640×400 — a story e o `test-summary` já diziam 7) e a tabela "além do axe" atribuía **4** testes a `shell-active-destination.spec.ts` (são **5**). **Corrigido.**

**🟡 M4 — `sprint-status.yaml` com anotação defasada.** A linha da 13.4 já estava em `review`, mas o comentário inline descrevia apenas o `create-story` — enquanto toda story irmã do épico carrega o histórico `dev-story | code-review`. **Corrigido no sync desta review.**

**🟢 B1 — `label` do axe fora do formato contratado.** O AC4 exige `faixa · rota · estado`; 4 células traziam só `faixa · rota` (`medium · /today`, `compact 390 · /today`, `compact 320 · /today`, `compact 320 · /archive`) — o formato é o que torna a mensagem de falha localizável. **Corrigido.**

**🟢 B2 — token lido e descartado.** `expectEdgeControlsUnobscured` lia `--ds-bottom-nav-height` e só verificava `> 0`, embora a Task 5 mande medir o controle **contra as faixas de chrome fixo**. O hit-test do centro não pega um controle que invada a barra apenas pela base. **Corrigido** com o assert de faixa (`last.rect.bottom <= height − bottomNavHeight`), que passa com os 16px de folga do FAB.

**🟢 B3 — guard de ícone ainda não é o único caminho na sidebar (registrado, não corrigido).** `ShellSidebar.tsx:203-204,245,306` continua renderizando o toggle e a âncora de captura por `navIcons[...]` + `NAV_ICON_SIZE` em vez do `navIconFor` consolidado no AC2. **Sem risco de crash** — `sidebar-toggle` e `capture` são chaves de chrome, nunca derivadas do registro (o guard existe para `entry.id`/`nav.group`, que são string aberta). Deixado como está de propósito: é cosmético e alterar produção por estilo no passe de fechamento custa mais do que entrega.

### O que resistiu ao ataque

- **Os 3 experimentos de não-vacuidade das Debug Log References são reais e bem escolhidos** — em especial o #3, que separa "FAB fora do viewport" de "FAB encoberto" depois de um primeiro experimento ter passado corretamente. O padrão de reverter, medir e restaurar com `git diff` vazio está documentado.
- **A honestidade sobre as 2 falhas pré-existentes** (verificadas por `git stash` no baseline, não estimadas) e sobre o achado LEG-04 (`width: 1` = 100% no sistema `sizing` do MUI) é exatamente o comportamento que a retro do épico pede.
- **AC2 realmente fecha o DoD do AD-17**: o experimento #2 prova que a genericidade é medida de forma independente do guard de ícone — sem ele, a avulsa inédita quebraria pelo ícone e o teste "passaria" medindo outra coisa.
- **A divergência DIV-17** (`exclude` da captura portalizada) é a leitura correta do AC4: a célula reprovava por `primary.main` do tema **legado**, `theme.ts` é fora de escopo, e o AC prevê explicitamente "registrada como divergência com o motivo e o artefato upstream". Nenhuma regra do axe foi desligada.
- **O defeito de produto achado no passo de QA** (anel de foco ausente em todo o sheet portalizado) é um achado de verdade, com detector permanente e a causa raiz nomeada.

## Change Log

| Data | Mudança |
|---|---|
| 2026-07-24 | create-story: contexto completo da 13.4 (predicado de ativo unificado / SHELL-DEBT-03, avulsos genéricos / SHELL-DEBT-04 + guard do ícone de agrupador, linha de destino compartilhada, matriz axe wide/medium/tablet/compact com 18 células, auditoria de teclado/foco/live region, zoom 200% + reflow 320, estados ST-01…ST-06 com evidência nomeada, checklist fechada com as decisões interinas promovidas a divergências contratadas + inventário do SHELL-DEBT-02). 5 questões abertas registradas — nenhuma bloqueia. |
| 2026-07-24 | Correções do gate de review (4 achados): (1) **decisão do dono registrada** — `prefers-reduced-motion` / UX-DR30 item 6 **dispensado** para o App Shell como waiver consciente (nova seção *Decisão consciente de produto*, ressalva no AC5, cláusula no AC8, item em Fora de escopo, linha `A11Y-07` no checklist — não é dívida, não é deferimento); (2) AC3/Task 3 deixam de supor greps inexistentes — o dev **escreve** os greps faltantes (`@tanstack/react-query` e literais para `ShellSidebar.tsx`; tripé completo para o arquivo novo), com a localização real de cada guard hoje (`ShellBottomNav.test.tsx:138-153` = tripé completo; `ShellSidebar.test.tsx:370-385` = só mui-icons + teste de tokens) e o mitigante de 0 hits; (3) contagem de decisões interinas corrigida de 4 para **3 marcadas "a confirmar"** (`:154`, `:188`, `:195`) **+** a reconciliação do chevron (`:156-160`, sem marcador) ⇒ 4 divergências contratadas; (4) AC7 deixa de rotular "disponibilidade independente do contador" como DIV-8 — DIV-8 é o contrato `aria-disabled` + guard no `onClick` preservando foco (checklist `:144`). **Nota de numeração:** todas as referências de linha ao checklist nesta story usam a numeração **posterior** à inclusão de `A11Y-07` (as linhas citadas pela review — `:131` DIV-8, `:141`, `:143-147`, `:170`, `:177` — deslocaram +13). |
| 2026-07-24 | dev-story: passe de paridade executado. **AC1** predicado único `isDestinationActive` nas 3 superfícies (SHELL-DEBT-03 fechada; 9 rotas profundas ativam o pai; invariante de 1 `aria-current` provada sobre `shellRoutes`). **AC2** derivação genérica por unidades com tiebreak no índice do registro (SHELL-DEBT-04 fechada; zero `id` literal; DoD do AD-17 executável) + guard de ícone único (`navIconFor`) estendido ao cabeçalho de grupo. **AC3** `ShellNavDestination.tsx` novo substitui as 2 cópias de `renderDestination` (os 39 testes existentes de sidebar+sheet passam sem edição de assert); agrupador segue duplicado por decisão registrada (DIV-15); greps `?raw` faltantes escritos (tripé no arquivo novo + Query e literais na `ShellSidebar`). **AC4** matriz axe de 2 → 16 células cobrindo wide/medium/tablet/compact (medium e tablet não tinham cobertura), sem `disableRules`/`skip`. **AC5/AC6** `shell-keyboard.spec.ts` novo (24 testes): skip link, ordem de Tab, foco não encoberto por hit-test em 7 viewports com tokens lidos do DOM, anel de foco, atalhos positivos+negativos, `Escape`→Menu, live region única, zoom 200% por viewport equivalente e reflow 320. **AC7** `shell-states.spec.ts` novo (7 testes) fecha `ST-01`/`ST-02`/`ST-06`; `ST-03`/`04`/`05` mapeados para testes existentes; `ST-07`/`ST-08` acrescentados. **AC8** checklist fechada (coluna Evidência, nenhum item `13.4`, DIV-10…DIV-20, SHELL-DEBT-03/04 fechadas, 02 re-escopada com dono) + inventário `13-shell-a11y-legacy-inventory.md` novo (LEG-01…LEG-04) + nota do `sticky` da 13.1 resolvida (funciona: ancestral de scroll é o wrapper da tabela, não o workspace). **AC9** legados de rollback sem diff; Vitest 89/981 (952 herdados + 29 novos), typecheck/lint limpos, E2E do shell 86 passed (41 + 45 novos). 3 experimentos de não-vacuidade documentados. Divergência assumida: `exclude` estendido à superfície de captura portalizada (DIV-17). 2 falhas de E2E em `archive`/`daily-tasks` **verificadas como pré-existentes** no baseline `2fca13f` via `git stash` — não regressões; registradas para triagem com o fix sugerido. |
| 2026-07-24 | qa-generate-e2e-tests: auditoria AC por AC do que jsdom não pode reprovar. **1 defeito de produto encontrado e corrigido:** o sheet de navegação (portal do MUI, fora do `shell-root`) não recebia a regra `:focus-visible` do shell e o `ButtonBase` zera até o anel default ⇒ **nenhum** controle do sheet tinha anel de foco (A11Y-06/WCAG 2.4.7) — regra reaplicada no slot `paper` do `ShellNavigationSheet.tsx`, com detector E2E. **+9 E2E:** `shell-active-destination.spec.ts` **novo** (5) — invariante de um único `aria-current` sobre as **22 rotas no router real** (antes só em jsdom), os 2 pares de prefixo colidente (`/settings/*`, `/archive/{weekly,monthly}/*`) que nenhum E2E visitava, agrupador recolhido com filho ativo por rota profunda, contrato do `/daily/:date` no sheet; `shell-keyboard.spec.ts` +3 (ordem de Tab em **medium** e no **rail do tablet**, anel de foco no portal); `shell-a11y.spec.ts` +1 célula (**skip link em foco** — o único controle do chrome que o axe não media, por viver fora da tela) ⇒ matriz 16 → **17**. As **2 falhas pré-existentes** de `archive`/`daily-tasks` foram **corrigidas** (escopo de locator, test-only, uma linha cada — o `Fechar` ambíguo é consequência da instância única de captura da 13.3 e vale para todo spec de desktop). Gates: Vitest **89/981** (inalterado), typecheck/lint limpos, E2E do shell **95 passed** (86 + 9), specs que navegam pelo chrome **29 passed** (era 2 failed/27). Checklist atualizada (A.1, `A11Y-06`, `A11Y-09`, matriz axe). Resumo em `tests/test-summary-13-4.md`. |
| 2026-07-24 | code-review (story-automator): **aprovada, 0 críticos**. Alegações **re-executadas**, não aceitas no papel: Vitest **89/981**, `typecheck`/`lint` limpos, E2E do shell **95 passed**, specs que navegam pelo chrome **29 passed**, legados de rollback com `git diff` vazio, 22 rotas em `shell: 'new'` (a única ocorrência de `'legacy'` é comentário do procedimento), 0 linhas removidas nos testes existentes do shell. **4 médios + 3 baixos**; 6 corrigidos: (M1) **defeito de produto** — o `[` fazia dispatch antes do guard de `ctrl`/`meta`/`alt` (só o `B` era guardado), então `Cmd+[`, que é "voltar" no macOS, colapsava a sidebar, contra a cláusula do AC5 que contrata o guard para **ambos**; o teste da faixa medium exercitava o modificador só no `b`, deixando a assimetria invisível ao gate — guard unificado em `ShellLayout.tsx` + asserts de `Control/Meta/Alt+[` e `Alt+b`, e `KB-01` do checklist passa a declarar o guard; (M2) `A11Y-09` remetia a **DIV-15** (agrupador duplicado) para a ordem de DOM do FAB, que é **DIV-18**; (M3) duas contagens erradas no checklist — `A11Y-03` dizia 6 viewports de hit-test (são **7**) e a tabela "além do axe" dava 4 testes a `shell-active-destination.spec.ts` (são **5**); (M4) `sprint-status.yaml` com comentário inline descrevendo só o `create-story`, sem o histórico `dev-story | qa | review` das stories irmãs; (B1) 4 `label` do axe fora do formato `faixa · rota · estado` exigido pelo AC4; (B2) `--ds-bottom-nav-height` era lido e descartado (só `> 0`) embora a Task 5 mande medir o controle **contra** a faixa fixa — o último focável passa a ser assertado fora da faixa da barra. **1 registrado sem corrigir (B3):** o toggle e a âncora de captura da `ShellSidebar` ainda renderizam ícone por `navIcons[...]` em vez do `navIconFor` consolidado no AC2 — sem risco de crash (chaves de chrome, nunca derivadas do registro), cosmético. Waiver `A11Y-07` (reduced motion) **preservado**: nada implementado, testado ou deferido. |
