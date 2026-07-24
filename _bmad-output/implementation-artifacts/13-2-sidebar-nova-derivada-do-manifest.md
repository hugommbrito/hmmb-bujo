---
baseline_commit: 1055990
---

# Story 13.2: Sidebar nova derivada do manifest

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero a sidebar do sistema novo (240px expandida / 64px colapsada) gerada a partir do registro de collections,
Para que a navegação seja consistente e collections novas apareçam sem tocar o chrome (FR-1.3 consumo, AR-23, UX-DR22).

## Acceptance Criteria

1. **Sidebar nova, dados puros, sem Query nos testes compartilhados**

   **Dado que** o registro de collections da Story 12.3 (`app/collections/registry.ts`, dados puros) e o `ShellLayout` da Story 13.1,
   **Quando** a sidebar do shell novo é implementada,
   **Então** existe um componente **novo** `frontend/src/app/layout/shell/ShellSidebar.tsx` que o `ShellLayout` renderiza no lugar da `Sidebar` legada, e a `Sidebar.tsx`/`AppLayout.tsx` legadas **permanecem intocadas** como rota de rollback,
   **E** o `ShellSidebar` **não consome TanStack Query diretamente** (a contagem do Brain Dump entra exclusivamente pelo `BrainDumpBadge` do barrel `features/braindump`, já mockado nos testes de chrome), de modo que os 3 testes compartilhados (`AppLayout.test.tsx`/`router.test.tsx`/`RouteAnnouncer.test.tsx`) seguem verdes **sem nenhum mock novo de Query**.

2. **Derivação: núcleo BuJo fora do registro; collections do registro por map puro**

   **Dado que** o núcleo BuJo fica fora do registro (AD-17) e as collections vêm dele,
   **Quando** a sidebar monta a lista de destinos,
   **Então** o **núcleo/chrome** (`Hoje`, grupo `Planner` com `Esta Semana`/`Este Mês`/`Futuro`/`Recorrentes`, `Brain Dump`, `Arquivo`, `Configurações`) tem entradas próprias no componente (não vem do registro),
   **E** as **collections** (`Hábitos`, `Gratidão`, grupo `Saúde` = `Métricas` + `Medicamentos`) são derivadas do registro por map puro, lendo **label/grupo/ordem** de `entry.nav` e o path de `entry.routes[0].path` — exatamente a mesma fonte que a `Sidebar` legada usa hoje (a ordem de render e os agrupamentos permanecem idênticos ao inventário SB-01…SB-10 do checklist da 13.1).

3. **Estados de nav mínima (zero/uma collection) sem lacunas**

   **Dado que** o default all-off de convidados (Épico 10) torna zero/uma collection estados reais, não edge cases,
   **Quando** o conjunto de collections ativas varia,
   **Então** com **zero collections** a sidebar mostra núcleo + `Planner` completo, **sem** heading "Collections", sem grupo `Saúde` vazio e sem item futuro desabilitado; com **uma collection** o agrupamento não exibe títulos vazios; o grupo `Saúde` **permanece com um único filho** e **desaparece por completo quando não tem nenhum**,
   **E** módulos/destinos ainda não implementados **nunca** aparecem desabilitados (o shell só mostra destinos disponíveis).
   *(Nesta fatia todas as 4 collections estão implicitamente ativas; a derivação já deve tolerar o conjunto vazio/parcial por construção — filtrar a lista derivada, não hardcodar as 4.)*

4. **Catálogo Phosphor fechado por destino/controle**

   **Dado que** Phosphor Icons é a biblioteca da plataforma e o **catálogo fechado** do App Shell (DESIGN.md §Catálogo Phosphor),
   **Quando** cada destino/controle da sidebar renderiza seu ícone,
   **Então** usa **exatamente** o ícone canônico do catálogo (`@phosphor-icons/react`, `size 20px`, `weight="regular"` em repouso e `weight="fill"` no selecionado, `currentColor`), conforme a tabela de mapeamento nas Dev Notes,
   **E** nenhum ícone MUI (`@mui/icons-material`) é usado no `ShellSidebar`, e nenhum glyph é inventado fora do catálogo fechado (a única exceção é o cabeçalho do grupo **Planner**, tratado na **Questão Aberta 1**).

5. **Destino ativo comunicado por mais de um canal; agrupador nunca recebe `aria-current`**

   **Dado que** cor nunca é o único canal (WCAG 2.2 AA; DESIGN.md §App Shell),
   **Quando** um destino está ativo,
   **Então** ele combina **indicador lateral de 3px** + `primary-soft` de fundo + **label em peso forte** + ícone em `fill` + `aria-current="page"` (nunca só um desses canais),
   **E** um **agrupador** (`Planner`, `Saúde`) expõe `aria-expanded` e **nunca** `aria-current`; quando está **recolhido contendo a rota ativa**, indica isso por indicador lateral + fundo sutil (`.contains`) e nome/descrição acessível, **sem** `aria-current`.

6. **Rail de 64px, colapso na sessão e atalho `[`**

   **Dado que** o contrato do rail (`{components.app-shell.sidebar-collapsed}` = **64px**, expandida = **240px**) e o colapso **somente na sessão**,
   **Quando** a sidebar colapsa/expande,
   **Então** larguras vêm de `var(--ds-sidebar-expanded)` / `var(--ds-sidebar-collapsed)` (**zero literais estruturais** — troca o `COLLAPSED_WIDTH=56` legado por 64px via token), o rail **oculta os labels sem retirar os nomes acessíveis**, os grupos `Planner`/`Saúde` fecham ao colapsar, e o toggle usa o ícone `sidebar-simple` com `aria-label` alternando (`Colapsar sidebar`/`Expandir sidebar`),
   **E** o atalho `[` (já vivo no `ShellLayout`, escopo desktop) alterna o rail e o estado **persiste durante a sessão** (estado em memória do `ShellLayout`; **nada** em `localStorage` nem no banco).

7. **Badge do Brain Dump: `9+`, tokens do shell, sem deslocar label, visível no rail**

   **Dado que** `{components.app-shell-badge}` e o contrato de badge do Brain Dump,
   **Quando** o destino Brain Dump renderiza na sidebar,
   **Então** o badge usa o `BrainDumpBadge` (mesma fonte de contagem, já mockada), **oculto em 0/loading/erro**, mostra `1`–`9` literais e **`9+` acima de 9** preservando a **contagem exata no nome acessível**, com estilo `app-shell-badge` (fundo `primary`, tinta `on-primary`, `min-height 18px`, cantos `full`), **não desloca o label** e permanece **perceptível no rail** (ligado ao ícone, sem cobrir o pictograma),
   **E** falha do contador **não bloqueia** navegação.

8. **Paridade com a checklist da 13.1 e nenhuma regressão**

   **Dado que** a checklist enumerada `13-shell-parity-checklist.md`,
   **Quando** a sidebar nova fecha,
   **Então** os itens `SB-01…SB-15`, `BD-01…BD-04`, `RA-*` aplicáveis e as divergências contratadas `DIV-1` (56→64), `DIV-4` (`FavoriteBorder`→`first-aid-kit`), `DIV-5` (MUI→Phosphor) e `DIV-6` (badge `9+`) são marcados **resolvidos** (ou com divergência registrada para upstream), e o checklist é atualizado nesta story,
   **E** a suíte Vitest completa segue verde (colar a contagem observada, derivando herdados/novos pelo diff), `typecheck`/`lint` limpos (regra de boundary do ESLint respeitada) e a suíte E2E existente segue verde.

## Tasks / Subtasks

- [x] **1. Instalar `@phosphor-icons/react` e criar o mapa de catálogo Phosphor** (AC: 4)
  - [x] Adicionar `@phosphor-icons/react` (última 2.x estável) como **dependency** do `frontend/` — é a biblioteca de ícones de toda a plataforma (DESIGN.md §Brand & Style). É a única dependência nova desta story; respeitar o lockfile no resto.
  - [x] Criar um mapa de catálogo **por destino/controle** (ver tabela nas Dev Notes) num módulo dedicado do shell (ex.: `frontend/src/app/layout/shell/navIcons.tsx`), keyado por identidade estável (`id` da collection para as 4 collections; chave própria para o núcleo). **Não** persistir nada e **não** tocar `registry.ts` (o campo `icon` do manifest continua MUI — é o consumidor legado; a curadoria Phosphor é frontend-only, sem `iconKey` no backend — decisão de arquitetura futura, não desta story).
  - [x] Importar por **named import** (`import { CalendarDot, Brain, … } from '@phosphor-icons/react'`); usar `size={20}`, `weight` `'regular'`/`'fill'`, cor herdada (`currentColor`).

- [x] **2. Criar `ShellSidebar.tsx` derivando núcleo + collections** (AC: 1, 2, 3)
  - [x] Novo arquivo `frontend/src/app/layout/shell/ShellSidebar.tsx`. Manter a **mesma interface de props** da `Sidebar` legada: `{ collapsed: boolean; onToggle: () => void }` (o `ShellLayout` já gerencia o estado e o atalho `[`). *(Prop opcional `collections` adicionada só como seam de teste da nav mínima — produção não passa; interface pública inalterada para o `ShellLayout`.)*
  - [x] Núcleo/chrome hardcoded na mesma ordem do inventário: `Hoje` → grupo `Planner` (`Esta Semana`→`Este Mês`→`Futuro`→`Recorrentes`) → `Hábitos` → grupo `Saúde` (`Métricas`→`Medicamentos`) → `Gratidão` → `Brain Dump` → `Arquivo` → `Divider` → `Configurações`. *(Ordem idêntica à `Sidebar.tsx` legada — SB-01…SB-10.)*
  - [x] Collections derivadas do registro por map puro: `Hábitos`/`Gratidão` como avulsas e `Métricas`/`Medicamentos` filtrando `nav.group === 'saude'` ordenado por `nav.order` (mesma lógica de `Sidebar.tsx:71-83`). Ler **label/grupo/ordem** de `entry.nav` e path de `entry.routes[0].path`.
  - [x] **Nav mínima:** derivar as seções de collection da lista **filtrada** de collections ativas (não hardcodar as 4). Grupo `Saúde` só renderiza se tiver ≥1 filho; destinos avulsos só se presentes; sem heading "Collections" nunca.
  - [x] `nav` landmark: **manter** `aria-label="Navegação principal"` (o `ShellLayout` conta com ela e não a duplica — comentário em `ShellLayout.tsx:133`).
  - [x] **Sem TanStack Query direto.** Brain Dump usa `<BrainDumpBadge>` do barrel `features/braindump` (já mockado nos 3 testes). **Não** importar `BrainDumpCaptureSheet` nem nenhum hook de Query aqui (a captura persistente é a Story 13.3; puxá-la agora obrigaria mock novo e violaria o AC 1).

- [x] **3. Estado ativo, agrupadores e indicador "contém rota ativa"** (AC: 5)
  - [x] Destino ativo: indicador lateral 3px (`var(--ds-primary)`) + fundo `var(--ds-primary-soft)` + label em peso forte (`typography.body-strong` / `fontWeight 600-700`) + ícone `weight="fill"` + `aria-current="page"`. Repouso: `weight="regular"`, sem borda/fundo.
  - [x] Agrupadores `Planner`/`Saúde`: `aria-expanded={aberto}`, **nunca** `aria-current`. Clique alterna o grupo (só quando a sidebar está expandida; no rail o clique não expande — paridade `Sidebar.tsx:169,198`).
  - [x] **Grupo recolhido contendo a rota ativa:** aplicar tratamento `.contains` (indicador lateral + `var(--ds-surface-subtle)` de fundo) e expor a relação por nome/descrição acessível (`aria-describedby` apontando um texto tipo "Contém a página atual: {destino}", conforme mockup `key-app-shell-13-0.html`), **sem** `aria-current` no agrupador.
  - [x] Chevron do grupo — **reconciliado**: o catálogo fechado não define chevron e o AC4 proíbe `@mui/icons-material` na `ShellSidebar`; em vez de `ExpandLess`/`ExpandMore` (MUI) usei um **glyph unicode decorativo** (`⌄`/`⌃`, `aria-hidden`), como o mockup (`&#8964;`). Ocultado no rail (como os labels). Registrado no checklist.

- [x] **4. Rail 240/64, colapso de labels e grupos, toggle `sidebar-simple`** (AC: 6)
  - [x] Larguras exclusivamente por token: `var(--ds-sidebar-expanded)` (240) e `var(--ds-sidebar-collapsed)` (64) — **nenhum** `56`, `240`, `64` cravado. (Substitui `DRAWER_WIDTH`/`COLLAPSED_WIDTH` do legado; DIV-1: 56→64.)
  - [x] Rail oculta labels e chevrons **preservando `aria-label`/nome acessível** em cada botão (DESIGN: "o rail oculta labels sem retirar nomes acessíveis"; EXPERIENCE §Accessibility Floor). Ícones centralizados; touch target adequado (`--ds-touch-target-min`).
  - [x] Grupos `Planner`/`Saúde` fecham ao colapsar (`Collapse in={open && !collapsed}`); reabrem ao expandir preservando o estado da sessão (o `useState` do grupo não é resetado no colapso).
  - [x] Botão colapsar/expandir: ícone `sidebar-simple` (Phosphor), `aria-label` alternando `Colapsar sidebar` / `Expandir sidebar` (paridade SB-15; DIV-1). Mantido no topo da sidebar (paridade estrutural).
  - [x] **Colapso só na sessão:** o estado vive no `useState` do `ShellLayout` (já existe); **não** adicionei `localStorage` nem persistência de banco (explicitamente rejeitado no reconcile 13.0; EXPERIENCE §App shell). O atalho `[` já está no `ShellLayout` — **não** dupliquei o handler no `ShellSidebar`.

- [x] **5. Badge do Brain Dump com `9+` e tokens `app-shell-badge`** (AC: 7)
  - [x] Adicionar o cap `9+` ao `BrainDumpBadge` (`features/braindump/components/BrainDumpBadge.tsx`) via prop `max={9}` do MUI `Badge` — o **`aria-label` continua com a contagem exata** (já é derivado de `count`, não do conteúdo exibido). Resolve BD-04/DIV-6.
  - [x] Permitir que o `ShellSidebar` aplique o estilo `app-shell-badge` **sem** repintar o uso legado: prop opcional `badgeSx` consumida só pelo shell via `slotProps={{ badge: { sx } }}`, mirando `.MuiBadge-badge` com `backgroundColor: var(--ds-primary)`, `color: var(--ds-on-primary)`, `minHeight: var(--ds-badge-min-height)` (18px), `borderRadius: var(--ds-radius-full)`. O uso legado (`Sidebar`/`BottomNav`) permanece com `color="primary"` — nenhuma regressão visual no legado.
  - [x] Garantir que o badge **não desloca o label** (MUI posiciona o `.badge` em absolute) e é **perceptível no rail** ligado ao ícone (sem cobrir o pictograma). Mantido `invisible={count === 0}` (oculto em 0/loading/erro).
  - [x] Atualizar `BrainDumpBadge.test.tsx`: assere `9+` visual para count>9 **com** `aria-label` de contagem exata preservado; e o caminho legado inalterado (sem `max` → contagem cheia).

- [x] **6. Wire no `ShellLayout` + preservar contrato acessível** (AC: 1, 5, 8)
  - [x] Trocar em `ShellLayout.tsx` o import/uso de `Sidebar` (`../Sidebar`) por `ShellSidebar` (`./ShellSidebar`). Nenhuma outra mudança no `ShellLayout` (topbar/workspace/skip link/seam/atalhos permanecem os da 13.1); só atualizei 2 comentários que citavam a `Sidebar` legada.
  - [x] Confirmar que `ShellLayout.test.tsx` segue verde: os testes que dependem do texto `Planner` e do landmark `Navegação principal` (`test_tablet_inicia_com_a_sidebar_colapsada`, `test_atalho_colchete_*`, `test_desktop_mostra_sidebar_*`, axe wide/compact) continuam válidos com o `ShellSidebar` (mesmo label "Planner", mesma nav) — **sem alterar nenhum teste compartilhado**.
  - [x] `AppLayout.tsx` legado continua renderizando a `Sidebar` legada (rollback) — **não** alterado.

- [x] **7. Testes unitários do `ShellSidebar`** (AC: 1–7)
  - [x] Novo `frontend/src/app/layout/shell/ShellSidebar.test.tsx` no padrão dos testes de chrome (`MemoryRouter`, mock do barrel `../../../features/braindump` com `BrainDumpBadge` passthrough — **sem** QueryClientProvider). Cobre:
    - derivação: núcleo presente + collections do registro (label/grupo/ordem) na ordem correta;
    - nav mínima: com lista de collections vazia/parcial (injetada via prop de teste) não há heading vazio, `Saúde` some sem filhos, permanece com um único filho, `Planner` completo sempre;
    - ativo: `aria-current="page"` no destino da rota + peso forte; inativo sem `aria-current`;
    - agrupador: `aria-expanded`, nunca `aria-current`; recolhido-com-filho-ativo mostra descrição acessível ("Contém a página atual: …") sem `aria-current`;
    - rail: `collapsed` oculta labels/chevrons mas preserva `aria-label`; toggle `sidebar-simple` com aria-label alternando;
    - badge: Brain Dump com nome acessível no expandido e no rail. *(oculto em 0 / `9+` / contagem exata ficam em `BrainDumpBadge.test.tsx`, que tem `QueryClientProvider`; aqui o barrel é passthrough por causa do AC1.)*
  - [x] Rodar `jest-axe` no `ShellSidebar` (como `Sidebar.test.tsx`/`AppLayout.test.tsx` já fazem) — expandido e rail. *(Também gated por axe real no Playwright: `shell-a11y.spec.ts` wide inclui a sidebar.)*
  - [x] Verificar que **nenhum** `@mui/icons-material` é importado no `ShellSidebar` (grep de import no teste, via `?raw`) + guarda de larguras por token (sem `COLLAPSED_WIDTH`/`DRAWER_WIDTH`).

- [x] **8. Verificação e atualização do checklist de paridade** (AC: 8)
  - [x] Atualizar `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md`: marcar `SB-01…SB-15`, `BD-01`/`BD-04`, e as divergências `DIV-1`, `DIV-4`, `DIV-5`, `DIV-6` como **resolvidas na 13.2** (com arquivo/símbolo do `ShellSidebar`). Registrada a Questão Aberta 1 (ícone do agrupador Planner = `Notebook` interino) como dívida/nota até confirmação de UX, + notas do chevron e da nav mínima.
  - [x] Rodar `nvm use 22.15.1` antes de qualquer comando de frontend/e2e (a sessão inicia em Node 18).
  - [x] Rodar `npm run test:run` e **colar a contagem literal**; derivar "herdados + novos" pelo diff. → **86 files / 901 tests passed** (baseline re-observada 85/881 → 881 herdados + 20 novos: 17 no `ShellSidebar.test.tsx` + 3 no `BrainDumpBadge.test.tsx`).
  - [x] Rodar `npm run typecheck` e `npm run lint` (regra de boundary respeitada) → ambos limpos.
  - [x] Rodar a suíte E2E existente (`workers:1` contra a branch Neon `e2e`; esta story **não** cria migration) → `shell.spec.ts` + `shell-a11y.spec.ts` = **9 passed (58.6s)**. Nenhum assert de geometria/ícone da sidebar precisou mudar em `e2e/shell.spec.ts`.

## Dev Notes

### Fronteira desta story (o que é 13.2 e o que NÃO é)

| Entrega | Story |
|---|---|
| Casca, topbar, workspace, tokens, skip link, seam, coexistência por rota, axe-core, checklist | 13.1 (feito) |
| **Sidebar nova 240/64 derivada do manifest, catálogo Phosphor, badge `9+`, ativo/grupos, rail, atalho `[`** | **13.2 (esta)** |
| Bottom nav (3 atalhos + Menu), sheet de navegação completa, **captura persistente (FAB + âncora desktop)** | 13.3 |
| Passe de paridade completo + matriz axe wide/medium/compact | 13.4 |
| Configurações → Aparência (4 famílias × Light/Dark) e Navegação mobile | 18.1 |

**Fora de escopo — não fazer nesta story:**

- **Captura persistente / “Abrir captura rápida”** (nem a âncora desktop no fim da nav, nem o FAB mobile, nem o `BrainDumpCaptureSheet`). Toda captura é a **Story 13.3**. *(A nota em `tokens.ts` que cita "13.2 (âncora na navegação)" é superada pelo handoff da 13.0 e pelas ACs do epics: puxar `BrainDumpCaptureSheet` — consumidor de Query — para a sidebar agora obrigaria um mock novo nos 3 testes e violaria o AC 1.)*
- Alterar `Sidebar.tsx`, `BottomNav.tsx`, `AppLayout.tsx` legados (rota de rollback) ou `theme.ts`.
- Persistir o estado de colapso (banco ou navegador). Contrato: **só na sessão**.
- Adicionar `iconKey`/ícone Phosphor ao `registry.ts` ou ao backend/schema. A curadoria Phosphor é frontend-only; `iconKey` exige decisão de arquitetura e story retrocompatível própria (decision-log 13.0).
- Backend, migration, OpenAPI, `types.gen.ts`. Story **100% frontend**.
- Bottom nav / navegação mobile (13.3) e o seletor de aparência (18.1).

### Catálogo Phosphor fechado — mapeamento canônico (DESIGN.md §Catálogo Phosphor)

Nomes kebab do catálogo → componente `@phosphor-icons/react` (PascalCase). **Usar exatamente estes.** `size=20`, `weight="regular"` (repouso) / `"fill"` (selecionado), `currentColor`.

| Destino/controle | Ícone (catálogo) | Componente | Escopo |
|---|---|---|---|
| Hoje | `calendar-dot` | `CalendarDot` | 13.2 |
| Brain Dump | `brain` | `Brain` (dentro do `BrainDumpBadge`) | 13.2 |
| Arquivo | `archive` | `Archive` | 13.2 |
| Configurações | `gear` | `Gear` | 13.2 |
| Esta Semana | `calendar-dots` | `CalendarDots` | 13.2 |
| Este Mês | `calendar` | `Calendar` | 13.2 |
| Futuro | `calendar-plus` | `CalendarPlus` | 13.2 |
| Recorrentes | `repeat` | `Repeat` | 13.2 |
| Hábitos | `check-square` | `CheckSquare` | 13.2 |
| Gratidão | `heart` | `Heart` | 13.2 |
| Saúde (agrupador não navegável) | `first-aid-kit` | `FirstAidKit` | 13.2 |
| Métricas | `chart-line` | `ChartLine` | 13.2 |
| Medicamentos | `pill` | `Pill` | 13.2 |
| Colapsar/expandir sidebar | `sidebar-simple` | `SidebarSimple` | 13.2 |
| Abrir captura rápida | `note-pencil` | `NotePencil` | **13.3** |
| Menu de navegação completa | `list` | `List` | **13.3** |

O check de `Hábitos` (`check-square`) identifica **domínio**, não conclusão — não confundir com o vocabulário de status de tarefa (que segue MUI/inalterado). A troca `regular`→`fill` é **exclusiva do estado selecionado** dos destinos.

### Estado atual do código a preservar (arquivos lidos)

**`frontend/src/app/layout/Sidebar.tsx` (LEGADA — permanece intocada, é o rollback)**
- Ordem de render canônica (a nova deve espelhar): `Hoje` → grupo `Planner`(week/month/future/recurring) → `Hábitos` → grupo `Saúde`(métricas/medicamentos) → `Gratidão` → `Brain Dump` → `Arquivo` → `Divider` → `Configurações`. Ver `Sidebar.tsx:58-83,164-228`.
- Deriva collections do registro via `collectionNavItem(id)` (label = `entry.nav.label`, path = `/${entry.routes[0].path}`). Saúde filtra `nav.group==='saude'` por `nav.order`.
- Ativo: `borderLeft 3px primary` + `alpha(primary,0.10)` + `fontWeight 700` + `aria-current="page"` (`Sidebar.tsx:101-119`). Grupos **não** recebem `aria-current`.
- `DRAWER_WIDTH=240`/`COLLAPSED_WIDTH=56`; `useEffect` fecha grupos ao colapsar (`Sidebar.tsx:34-35,91-96`). `nav aria-label="Navegação principal"` (`Sidebar.tsx:148`).
- Toggle `MenuOpen`/`Menu` com aria-label alternando (`Sidebar.tsx:159-161`).

**`frontend/src/app/layout/shell/ShellLayout.tsx` (Story 13.1 — UPDATE mínimo)**
- Já gerencia `sidebarCollapsed` (useState, só sessão), `onToggle`, o atalho `[` (desktop) e passa `collapsed`/`onToggle` para a `Sidebar`. **A troca é só o import/uso**: `Sidebar` → `ShellSidebar` (linha ~5 e ~135). Não mexer no resto (topbar, workspace, skip link, seam, `[`/`B`).
- Renderiza a sidebar só quando `!isCompact`; tablet inicia colapsado (`ShellLayout.tsx:60-64`). Comentário em `:133` confirma que a `nav "Navegação principal"` vem da sidebar (não duplicar).

**`frontend/src/app/collections/registry.ts` (Story 12.3 — NÃO alterar)**
- `CollectionManifestEntry = { id, name, icon: SvgIconComponent, routes, nav{label,group?,order}, archetype, dashboardCard?, settingsSchema? }`. Dados puros, sem hooks/Query. As 4 entradas: `habits`(avulso, order 0), `health-metrics`(group `saude`, order 0), `medications`(group `saude`, order 1), `gratitude`(avulso, order 1).
- O campo `icon` é **MUI** (consumidor legado) — permanece. A sidebar nova mapeia o Phosphor por `id` no `navIcons`, não pelo `entry.icon`.

**`frontend/src/features/braindump/components/BrainDumpBadge.tsx` (UPDATE pequeno)**
- Hoje: MUI `Badge color="primary"`, `badgeContent={count}`, `invisible={count===0}`, `aria-label` com contagem exata. **Sem** cap. Adicionar `max={9}` (mostra `9+`) e o hook de estilo opcional do shell (§Task 5). O `aria-label` já é exato — preservar.
- É consumido pelo barrel `features/braindump` (index.ts), **mockado** nos testes de chrome como passthrough `({children}) => children`.

### Por que dados puros / sem Query é inegociável (AC 1)

- Os 3 testes compartilhados (`AppLayout`/`router`/`RouteAnnouncer`) montam a árvore **sem** `QueryClientProvider` e mockam o barrel `features/braindump` só com `BrainDumpBadge` passthrough. Qualquer hook de Query **direto** no `ShellSidebar` (ou importar `BrainDumpCaptureSheet`, que o mock de `router.test.tsx` não fornece) explodiria esses testes e obrigaria mock novo — o oposto do AC.
- Mesmo motivo do manifest da 12.3 (AD-17): server state no chrome contamina os testes de chrome. A contagem do Brain Dump entra **encapsulada** no `BrainDumpBadge`; o `ShellSidebar` só compõe.

### Contrato do shell — números que o dev não deve inventar

| Item | Valor | Fonte |
|---|---|---|
| Sidebar expandida / rail | `240px` / `64px` | `{components.app-shell.sidebar-expanded/collapsed}` → `--ds-sidebar-expanded/collapsed` |
| Ícone de nav | Phosphor `20px`, `regular`/`fill`, `currentColor` | `{components.app-shell-nav-icon}` |
| Indicador de ativo | borda-esquerda `3px` + `primary-soft` + label forte + `fill` + `aria-current` | DESIGN §App Shell |
| Badge | `min-height 18px`, `radius full`, bg `primary`, fg `on-primary`, `9+` | `{components.app-shell-badge}` → `--ds-badge-min-height` |
| Faixas | ≥1440 wide · 1024–1439 medium · 768–1023 tablet · <768 compact | EXPERIENCE §Responsive & Platform |
| Início | expandida em wide/medium; **rail em tablet** | DESIGN §App Shell |

### Riscos concretos desta story

1. **Introduzir Query/mock novo** — grep por `useQuery`/`useBrainDumpCountQuery`/`BrainDumpCaptureSheet` no `ShellSidebar` deve dar vazio. Só `BrainDumpBadge` do barrel.
2. **Literal estrutural** — qualquer `56`/`64`/`240` cravado no `ShellSidebar` é falha do AC 6; tudo via `var(--ds-*)`.
3. **`aria-current` no agrupador** — Planner/Saúde nunca recebem `aria-current` (só `aria-expanded`); o filho-ativo-com-grupo-recolhido usa `.contains`, não `aria-current`. Há teste explícito no legado (`Sidebar.test.tsx`).
4. **Quebrar os 3 testes compartilhados / ShellLayout.test.tsx** — manter label "Planner" e `nav "Navegação principal"`; manter o rail escondendo labels (os testes checam `queryByText('Planner')` sumindo ao colapsar/tablet).
5. **Repintar o badge legado** — o estilo `app-shell-badge` deve entrar por prop **só** no uso do shell; `color="primary"` do legado permanece.
6. **Bloat/lentidão do Phosphor no dev** — usar **named imports** (tree-shaken em prod); se o dev server ficar lento, considerar `@phosphor-icons/react/dist/ssr` para imports diretos (não obrigatório).
7. **Nav mínima hardcodada** — derivar da lista **filtrada** de collections; não presumir sempre 4 (o all-off do Épico 10 torna zero/uma reais).

### Project Structure Notes

Arquivos previstos (`NEW` salvo indicação):

```
frontend/src/app/layout/shell/ShellSidebar.tsx            NEW
frontend/src/app/layout/shell/ShellSidebar.test.tsx       NEW
frontend/src/app/layout/shell/navIcons.tsx                NEW  (mapa catálogo Phosphor; dados/compos. do shell)
frontend/src/app/layout/shell/ShellLayout.tsx             UPDATE (troca Sidebar → ShellSidebar; só isso)
frontend/src/features/braindump/components/BrainDumpBadge.tsx      UPDATE (max=9 → "9+"; hook de estilo opcional do shell)
frontend/src/features/braindump/components/BrainDumpBadge.test.tsx UPDATE
frontend/package.json + package-lock.json                 UPDATE (+ @phosphor-icons/react)
_bmad-output/implementation-artifacts/13-shell-parity-checklist.md  UPDATE (SB/BD/DIV resolvidos)
```

- `app/` = composição com dono (chrome); `shared/` = primitivos sem dono. `ShellSidebar`/`navIcons` vivem em `app/layout/shell/` (chrome com dono). Podem importar `features/braindump`, `app/collections/registry` e `shared/design/tokens` (permitido; `app/` → `features/`/`shared/`).
- Regra de boundary do ESLint continua valendo (`shared/` não importa `app/`/`features/`).

### Testing Requirements

- **Vitest + Testing Library + `jest-axe`** no padrão do chrome (`MemoryRouter`, mock do barrel `../../../features/braindump` com `BrainDumpBadge` passthrough; **sem** `QueryClientProvider`).
- Para testar **nav mínima**, injetar a lista de collections (prop/param testável) ou `vi.mock('../../collections/registry', …)` com conjunto vazio/parcial — provar que `Saúde` some sem filhos e que não há heading vazio.
- **CI não roda Vitest nem Playwright** (arquitetura §7.4): a rede de segurança é execução local + code review. Rodar tudo localmente é obrigatório.
- **Playwright:** `nvm use 22.15.1` antes; `workers:1` contra a branch Neon `e2e`. Esta story **não** cria migration (sem passo de migration na branch `e2e`).
- Contagens em Completion Notes: comando real + saída literal; herdados/novos pelo diff.
- File List final deve nomear os artefatos de tipo novo (guardrail recorrente das retros dos Épicos 3/4/11/12).

### Previous Story Intelligence

**Story 13.1 (`in-progress`, E2E é o único gate aberto)** — base direta:
- Criou `ShellLayout`, `shared/design/tokens.ts` (`--ds-*`), o registro puro `shellRouting.ts`, `axeHelper.ts`, `13-shell-parity-checklist.md`. **Toda rota autenticada já monta o `ShellLayout`** (todas `shell:'new'`), então a sidebar da 13.2 é renderizada até nos 3 testes compartilhados.
- O `ShellLayout` **ainda renderiza a `Sidebar` legada** ("a sidebar derivada do manifest é a 13.2"). Os tokens `sidebar 240/64`, `badge` e `capture-action` já estão exportados aguardando esta story.
- Guardrails ativos: File List nomeia artefatos de tipo novo; reconciliar File List contra `git status` **depois** de QA/E2E; `Typography`/bloco custom precisa de `component="div"` (relevante se o label/descrição usar variante custom).
- Divergências já registradas para a 13.2: `DIV-1` (56→64), `DIV-4` (`FavoriteBorder`→`first-aid-kit`), `DIV-5` (MUI→Phosphor), `DIV-6` (badge `9+`), `BD-04`.

**Story 13.0 (gate UX `done`)** — contratos vinculantes: catálogo Phosphor fechado (tabela acima), rail 240/64, colapso só na sessão, ativo por múltiplos canais, badge `9+`, nav mínima (Planner completo, Saúde some vazio). Rejeitado: toggle Legado/Moderno, preferência de sidebar persistida, `house` para Hoje (é `calendar-dot`).

**Story 12.3 (manifest)** — padrão a imitar: registro dados puros; derivação por map puro; "collection nova = pasta + UMA entrada". A sidebar nova consome label/grupo/ordem do registro (não o `icon` MUI).

### Git Intelligence

- Baseline: `ee50f10 docs(ux): concluir spec do app shell da story 13.0` (HEAD atual). O trabalho da 13.1 está **na árvore, não commitado** — o dev da 13.2 encontra `shell/` (ShellLayout, tokens, shellRouting, etc.) e os artefatos da 13.1 já presentes.
- `7b866dc feat(story-12.3)` foi o último commit que tocou o chrome (`registry.ts`, `router.tsx`, `Sidebar.tsx`, `BottomNav.tsx`).
- Branch de trabalho: `dev` (homologação). `main` = prod, só após homologar (fluxo vigente desde 2026-07-22). Commit sem assinatura na automação (`--no-gpg-sign`) se necessário.

### Pesquisa técnica

- **`@phosphor-icons/react`** (última 2.x estável, ex.: `^2.1.x`): biblioteca oficial Phosphor para React, componentes nomeados (`import { CalendarDot } from '@phosphor-icons/react'`), props `size` (number/string), `weight` (`thin|light|regular|bold|fill|duotone`), `color` (default `currentColor`), `mirrored`. Compatível com React 19 + Vite 8. Renderiza SVG inline — sem lazy, ok em jsdom.
  - **Selecionado** = `weight="fill"`; **repouso** = `weight="regular"`; sempre `currentColor` (a cor vem do estado do item via `--ds-*`/tinta herdada).
  - Named imports do barrel são tree-shaken na build; se o dev server pesar, `@phosphor-icons/react/dist/ssr` permite imports diretos por ícone.
- **Não** fazer upgrade das demais dependências: respeitar o lockfile (MUI `6.5.0`, TanStack Query `5.101.1`, React `19.2.x`, React Router `6.30.x`, Vite `8.x`, Vitest `4.1.9`, Playwright `1.61.x`).
- WCAG 2.2 AA relevante à sidebar: `1.4.1 Use of Color` (ativo por ≥2 canais), `4.1.2 Name/Role/Value` (`aria-current`/`aria-expanded`), `2.5.8 Target Size`, nomes acessíveis preservados no rail.

### Questões abertas (registrar; não bloqueiam o #YOLO)

1. **Ícone do cabeçalho do grupo `Planner`.** O catálogo Phosphor **fechado** atribui ícone de agrupador **apenas** a `Saúde` (`first-aid-kit`); a seção "GRUPO Planner" do catálogo cataloga só os **filhos** (`calendar-dots`/`calendar`/`calendar-plus`/`repeat`), sem um ícone para o cabeçalho "Planner". O legado usava `EventNoteIcon` (MUI). Como o rail exige um glyph para o cabeçalho recolhível, **decisão interina desta story** (a confirmar com UX/Hugo, sem inventar semântica que colida com os filhos): usar `Notebook` (`@phosphor-icons/react`) — não colide com nenhum destino/controle catalogado e lê como "agenda/planner". Registrar como nota/dívida no `13-shell-parity-checklist.md` para o passe da 13.4; se UX definir outro glyph, é troca de uma linha no `navIcons`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, contexto 1M) — dev-story workflow.

### Debug Log References

- Baseline Vitest (início do dev, `npm run test:run`): **85 files / 881 tests passed**.
- Grep-in-test do catálogo fechado: `import.meta.url` não resolve como `file:` sob o transform do Vitest; migrado para import `?raw` (padrão já usado em `shellRouting.test.ts`), sem tipos de node.
- Lint: `no-extra-boolean-cast` em `Boolean(activeChild)` → simplificado para `activeChild ? … : …`.

### Completion Notes List

- **Sidebar nova (`ShellSidebar.tsx`) 100% frontend**, derivada do registro (12.3) + núcleo hardcoded, substituindo a `Sidebar` legada **apenas dentro do `ShellLayout`**. `Sidebar.tsx`/`BottomNav.tsx`/`AppLayout.tsx` legados **intocados** (rollback).
- **AC1 — dados puros, sem Query:** o `ShellSidebar` importa só `BrainDumpBadge` do barrel; **nenhum** hook de Query nem `BrainDumpCaptureSheet`. Os 3 testes compartilhados (`AppLayout`/`router`/`RouteAnnouncer`) seguem verdes **sem nenhum mock novo de Query**.
- **AC2 — derivação por map puro:** `Hábitos`/`Gratidão` avulsas + `Métricas`/`Medicamentos` do grupo `saude` por `nav.order`; ordem idêntica ao inventário SB-01…SB-10.
- **AC3 — nav mínima:** derivada da lista **filtrada** (não hardcoda 4); `Saúde` só com ≥1 filho, avulsas só se presentes, `Planner` sempre completo, nunca heading "Collections". Provada por injeção da lista em teste (zero/uma collection).
- **AC4 — catálogo Phosphor fechado:** `navIcons.tsx` mapeia por identidade estável; `size=20`, `regular`/`fill`, `currentColor`. **Nenhum** `@mui/icons-material` no `ShellSidebar` (grep de import no teste). `registry.ts` **não** tocado (o `icon` MUI segue para o consumidor legado). Chevron = glyph unicode (não é ícone de nenhuma biblioteca).
- **AC5 — ativo multi-canal / agrupador:** ativo = indicador 3px + `--ds-primary-soft` + peso 700 + ícone `fill` + `aria-current="page"`. Agrupador expõe `aria-expanded`, **nunca** `aria-current`; recolhido-com-rota-ativa usa `.contains` + `aria-describedby` ("Contém a página atual: …").
- **AC6 — rail 240/64 + `[`:** larguras só por `var(--ds-sidebar-expanded/collapsed)` (64px substitui 56 legado); rail oculta labels/chevrons preservando `aria-label`; grupos fecham ao colapsar e reabrem preservando estado da sessão; toggle `sidebar-simple` com aria-label alternando; estado só na sessão (no `ShellLayout`), sem `localStorage`/banco; atalho `[` não duplicado.
- **AC7 — badge:** `BrainDumpBadge` ganhou `max` (shell passa `9` → `9+`) e `badgeSx` (token `app-shell-badge` só no shell via `slotProps`); `aria-label` mantém a contagem exata; legado permanece `color="primary"` sem regressão.
- **AC8 — paridade/regressão:** checklist atualizado (SB/BD/DIV resolvidos + Q.A.1/chevron/nav-mínima registrados). **Vitest 86/901**, `typecheck` e `lint` limpos, **E2E shell + shell-a11y = 9 passed** (inclui axe real da sidebar em wide).
- **Divergência de spec reconciliada:** Task 3 dizia "chevron `ExpandLess`/`ExpandMore` pode permanecer", mas AC4 + Task 7 proíbem `@mui/icons-material`. Favoreci a restrição mais forte + o mockup (glyph unicode) e registrei no checklist — troca de baixo risco se UX pedir outro tratamento.
- **Contagem de testes (guardrail — comando real, split pelo diff):** baseline `85 files / 881` re-observada no início; final `86 files / 901` (`+1` file, `+20` tests = 17 `ShellSidebar.test.tsx` + 3 `BrainDumpBadge.test.tsx`).

### File List

**NEW**
- `frontend/src/app/layout/shell/ShellSidebar.tsx` — sidebar nova derivada do manifest (240/64, Phosphor, ativo/grupos/rail, badge).
- `frontend/src/app/layout/shell/ShellSidebar.test.tsx` — testes unitários + `jest-axe` + grep do catálogo fechado (**arquivo de tipo novo**).
- `frontend/src/app/layout/shell/navIcons.tsx` — mapa do catálogo Phosphor fechado (dados/compos. do shell; **arquivo de tipo novo**).
- `frontend/e2e/shell-sidebar.spec.ts` — E2E da sidebar nova (10 testes: geometria 240/64 medida, tokens resolvidos, Phosphor `regular`→`fill`, badge `9+` com seed real, `.contains`, axe no rail, tablet) — criado no passo **automate** (QA), adicionado ao File List na review.
- `frontend/e2e/seedBrainDumpItems.ts` — seed de itens do Brain Dump pela camada de serviço (padrão `seedGratitude.ts`) para materializar `count > 9` — criado no passo **automate** (QA), adicionado ao File List na review.

**UPDATE**
- `frontend/src/app/layout/shell/ShellLayout.tsx` — troca `Sidebar` → `ShellSidebar` (import + uso) + 2 comentários.
- `frontend/src/features/braindump/components/BrainDumpBadge.tsx` — props opcionais `max` (`9+`) e `badgeSx` (token do shell).
- `frontend/src/features/braindump/components/BrainDumpBadge.test.tsx` — 3 testes novos (`9+`, `9` literal, caminho legado sem cap).
- `frontend/package.json` + `frontend/package-lock.json` — `+ @phosphor-icons/react@^2.1.10`.
- `_bmad-output/implementation-artifacts/13-shell-parity-checklist.md` — SB/BD/DIV resolvidos + notas 13.2.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 13.2 → in-progress → review.
- `_bmad-output/implementation-artifacts/13-2-sidebar-nova-derivada-do-manifest.md` — frontmatter `baseline_commit`, checkboxes, Dev Agent Record, Status.

### Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (story-automator review) · **Data:** 2026-07-24 · **Resultado:** Approve (0 críticos; 4 médios e 2 baixos corrigidos na review)

Escopo verificado: 8 ACs contra o código real, todas as tasks `[x]`, git vs File List, qualidade de código/testes/segurança nos arquivos alterados. Nenhuma task marcada `[x]` sem implementação; nenhum AC MISSING/PARTIAL; `Sidebar.tsx`/`AppLayout.tsx`/`registry.ts` intocados (rollback confirmado); zero literais estruturais 56/240/64; nenhum import de Query/`BrainDumpCaptureSheet`/`@mui/icons-material` no `ShellSidebar` (greps na review).

**Findings e resolução:**

1. **[MEDIUM][docs]** File List omitia `frontend/e2e/shell-sidebar.spec.ts` e `frontend/e2e/seedBrainDumpItems.ts` (criados pelo passo automate/QA; presentes no git, ausentes do story). → **Corrigido**: adicionados ao File List.
2. **[MEDIUM][robustez]** Collection nova sem entrada no catálogo fechado derrubaria o shell inteiro (`navIcons[entry.id]` `undefined` → crash de render; o cast `entry.id as NavIconKey` escondia o buraco de tipo — risco real para FR-1.3/AR-23 em collection futura do grupo `saude`). → **Corrigido**: `iconFor` degrada sem ícone (destino segue navegável pelo label) + teste novo com collection injetada.
3. **[MEDIUM][test]** Nenhum teste verificava que o shell passa `max={9}` e o estilo `app-shell-badge` ao `BrainDumpBadge` — o mock passthrough descartava props e a única cobertura (E2E) nunca tinha rodado verde. → **Corrigido**: mock expõe props em data-attrs + assert de `max=9` e dos 4 tokens do `badgeSx`.
4. **[MEDIUM][verificação]** `shell-sidebar.spec.ts` (10 testes E2E da story) nunca tinha rodado verde (sessão automate caiu por conflito de porta; full-run seguinte clobberado por vazamento de env; credencial da branch Neon e2e stale). → **Resolvido na review**: rodado com `CI=1` + `DATABASE_URL` one-shot para Postgres local `bujo_e2e` (workaround do runbook) — **19 passed (1.0m)** (`shell-sidebar` 10 + `shell` 7 + `shell-a11y` 2).
5. **[LOW][tokens]** `minHeight: 48` literal no header do toggle. → **Corrigido**: `var(--ds-space-12)` (48px, mesmo valor computado).
6. **[LOW][docs]** Contagem Vitest do story (86/901) ficou stale após o chore e9cba41 (+4 testes). → **Registrado**: contagem re-observada na review abaixo.

**Não-fixes registrados (sem ação):** no rail, o nome acessível do botão Brain Dump é "Brain Dump" (a contagem exata permanece no `aria-label` do próprio badge, na árvore de acessibilidade — melhora sobre o legado, cujos botões do rail nem nome tinham); literais de paridade herdados do legado (`minWidth: 40`, `fontSize` 11/14) não fazem parte do contrato de larguras do AC6. RA-01…RA-03 permanecem `parity` (a sidebar não toca `RouteAnnouncer`/`main`).

**Verificação final (pós-fixes):** Vitest **86 files / 907 tests passed** (905 pré-review + 2 novos da review); `typecheck` e `lint` limpos; E2E escopado **19 passed** (inclui axe wide expandido + rail). Full-E2E cross-app permanece aguardando a credencial nova da branch Neon `e2e` (pendência ops do dono, fora do escopo da story).

### Change Log

| Data | Mudança |
|---|---|
| 2026-07-24 | create-story: contexto completo da 13.2 (sidebar nova derivada do manifest, catálogo Phosphor, badge 9+, rail 64px, atalho `[`, nav mínima). |
| 2026-07-24 | dev-story: `ShellSidebar` + `navIcons` (catálogo Phosphor), badge `9+`/token, wire no `ShellLayout`; checklist atualizado. Vitest 86/901, typecheck/lint limpos, E2E shell+shell-a11y 9 passed. Status → review. |
| 2026-07-24 | code-review (story-automator): 0 críticos; 4 médios + 2 baixos corrigidos (File List completo, fallback p/ collection sem ícone no catálogo, teste da integração `max`/`badgeSx`, E2E da story finalmente verde via Postgres local, token no header do toggle). Vitest 86/907, typecheck/lint limpos, E2E shell* 19 passed. Status → done. |

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.2-Sidebar-nova-derivada-do-manifest]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-13-Onda-2a--App-Shell-no-Sistema-Novo]
- [Source: _bmad-output/planning-artifacts/epics.md#AR-23] · [Source: …#UX-DR7] · [Source: …#UX-DR22] · [Source: …#UX-DR30] · [Source: …#DIR-6] · [Source: …#DIR-12]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#App-Shell]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#Catálogo-Phosphor-do-App-Shell]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Information-Architecture] (§App shell)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#State-Patterns] (Nav sem collections; Grupo com filho ativo recolhido; Badge)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Accessibility-Floor]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Interaction-Primitives] (atalho `[`)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/reconcile-story-13-0-app-shell.md]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-app-shell-13-0.html]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/icon-catalog-app-shell-13-0.html]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-17--Manifestregistry-estático-de-collections-fatia-1]
- [Source: _bmad-output/implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md]
- [Source: _bmad-output/implementation-artifacts/13-1-fundacao-do-shell-novo-com-coexistencia-por-rota.md]
- [Source: _bmad-output/implementation-artifacts/13-shell-parity-checklist.md]
- [Source: frontend/src/app/layout/Sidebar.tsx] · [Source: frontend/src/app/layout/shell/ShellLayout.tsx] · [Source: frontend/src/app/layout/shell/ShellLayout.test.tsx]
- [Source: frontend/src/app/collections/registry.ts] · [Source: frontend/src/shared/design/tokens.ts]
- [Source: frontend/src/features/braindump/components/BrainDumpBadge.tsx] · [Source: frontend/src/features/braindump/index.ts]
- [Source: frontend/src/app/router.tsx] · [Source: frontend/src/app/router.test.tsx]
