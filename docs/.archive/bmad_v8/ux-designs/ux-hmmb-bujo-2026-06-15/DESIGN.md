---
title: "BuJo Digital — DESIGN.md"
status: legacy
created: 2026-06-15
updated: 2026-07-17
sources:
  - prd: "_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md"
  - decisions: "_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/.decision-log.md"
  - spec: "_bmad-output/specs/spec-design-system-migration/SPEC.md"
  - contract: "_bmad-output/specs/spec-design-system-migration/design-system-contract.md"
  - migration: "_bmad-output/specs/spec-design-system-migration/migration-plan.md"
  - handoff: "imports/mybujo-full-handoff/design_handoff_full_app/README.md"

colors:
  # ── Superfície e Tinta ──────────────────────────────────────────────────────
  surface-base: "#FDFAF4"
  surface-base-dark: "#2A2420"

  surface-raised: "#F7F3EB"
  surface-raised-dark: "#322C28"

  surface-header: "#F0EBE0"
  surface-header-dark: "#3A3129"

  ink-primary: "#1A1612"
  ink-primary-dark: "#EDE8E0"

  ink-secondary: "#6B6359"
  ink-secondary-dark: "#A89E93"

  ink-disabled: "#B0A899"
  ink-disabled-dark: "#5C554E"

  border-hairline: "#DDD8CF"
  border-hairline-dark: "#4A433C"

  # ── Categorias Semânticas (bordas de tarefas e tints de cabeçalho) ──────────
  cat-teal: "#2BADA0"
  cat-teal-dark: "#3DC9BA"

  cat-purple: "#7B5EA7"
  cat-purple-dark: "#9E7FCC"

  cat-pink: "#D95F78"
  cat-pink-dark: "#F07F97"

  cat-yellow: "#C89B00"
  cat-yellow-dark: "#F2C22E"

  cat-green: "#4A8C5C"
  cat-green-dark: "#6BB880"

  cat-blue: "#3D72B4"
  cat-blue-dark: "#6098D9"

  # ── Prioridade Eisenhower ───────────────────────────────────────────────────
  priority-ui: "#C0392B"
  priority-ui-dark: "#E05A4A"

  priority-u: "#D4660A"
  priority-u-dark: "#F08230"

  priority-i: "#B8920A"
  priority-i-dark: "#D4B030"

  priority-none: "#4A8C5C"
  priority-none-dark: "#6BB880"

  # ── Ação e FAB ─────────────────────────────────────────────────────────────
  brand-primary: "#2BADA0"
  brand-primary-dark: "#3DC9BA"

  fab-bg: "#1A1612"
  fab-bg-dark: "#EDE8E0"

typography:
  display:
    family: "Inter"
    weight: 600
    size: "20px"
    line-height: "24px"
    letter-spacing: "-0.02em"
    usage: "Títulos de seção — MAIO, SEMANA 3, GRATIDÃO"

  heading:
    family: "Inter"
    weight: 600
    size: "15px"
    line-height: "20px"
    letter-spacing: "-0.01em"
    usage: "Cabeçalhos de dia — TERÇA | 10/06"

  body:
    family: "Inter"
    weight: 400
    size: "14px"
    line-height: "20px"
    letter-spacing: "0"
    usage: "Texto de tarefas, conteúdo padrão"

  body-sm:
    family: "Inter"
    weight: 400
    size: "12px"
    line-height: "16px"
    letter-spacing: "0"
    usage: "Labels do habit tracker, informações secundárias, contadores de hora"

  label:
    family: "Inter"
    weight: 600
    size: "11px"
    line-height: "14px"
    letter-spacing: "0.04em"
    text-transform: "uppercase"
    usage: "Chips de status, badges Eisenhower, labels de UI"

rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"

spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"

breakpoints:
  compact: "0px"
  medium: "768px"
  wide: "1024px"
  expansive: "1440px"

density:
  compact-row: "36px"
  comfortable-row: "44px"
  touch-row: "48px"
  workspace-max: "1440px"
  reading-max: "800px"

focus:
  width: "2px"
  offset: "2px"
  color: "brand-primary"

motion:
  instant: "0ms"
  fast: "120ms"
  standard: "180ms"
  easing: "ease-out"

components:
  task-row:
    height: "auto"
    min-height: "36px"
    padding: "6px 12px 6px 0"
    border-left-width: "3px"
    border-left-color: "cat-* token da categoria"
    background: "transparent"
    background-hover: "surface-raised"
    border-radius: "sm (4px)"
    status-icon-size: "16px"
    gap: "8px"
    transition: "background 120ms ease"

  day-header:
    background: "surface-header"
    padding: "4px 12px"
    typography: "heading"
    border-radius: "xs (2px)"
    border-bottom: "1px solid border-hairline"

  sidebar-item-active:
    background: "brand-primary + opacity 10%"
    border-left: "3px solid brand-primary"
    typography: "body, weight SemiBold"
    color: "brand-primary"

  fab:
    size: "52px"
    background: "fab-bg"
    icon-color: "surface-base (contraste máximo)"
    border-radius: "md (6px)"
    position: "fixed bottom-right, 20px margin"
    badge: "brand-primary, visível quando brain dump não está vazio"
    elevation: "none"

  status-chip:
    border-radius: "xs (2px)"
    padding: "1px 6px"
    typography: "label"
    variants:
      a-fazer: { bg: "transparent", border: "1px solid border-hairline", color: "ink-secondary" }
      fazendo: { bg: "cat-yellow + 15% opacity", border: "1px solid cat-yellow", color: "cat-yellow-dark" }
      feita: { bg: "cat-green + 15% opacity", border: "1px solid cat-green", color: "cat-green" }
      migrada: { bg: "cat-blue + 15% opacity", border: "1px solid cat-blue", color: "cat-blue" }
      adiada: { bg: "surface-raised", border: "1px solid border-hairline", color: "ink-disabled" }
      rapida: { bg: "cat-teal + 15% opacity", border: "1px solid cat-teal", color: "cat-teal" }

  eisenhower-chip:
    border-radius: "xs (2px)"
    padding: "1px 6px"
    typography: "label"
    variants:
      ui: { bg: "priority-ui", color: "#FFFFFF" }
      u:  { bg: "priority-u", color: "#FFFFFF" }
      i:  { bg: "priority-i", color: "#1A1612" }
      none: { bg: "priority-none + 20% opacity", border: "1px solid priority-none", color: "priority-none" }
---

# BuJo Digital — Guia de Design

> **LEGADO — NÃO USAR.** Preservado apenas como registro histórico do planejamento de 15/06. O contrato canônico atual está em `../ux-hmmb-bujo-2026-07-17/DESIGN.md`.

---

## 1. Marca e Estilo

BuJo Digital é um sistema operacional pessoal disfarçado de caderno. A postura de marca é "caderno inteligente" — tão funcional e honesto quanto o papel pontilhado que substitui, sem o atrito de redesenhar grids e reescrever cabeçalhos.

A linguagem visual comunica através de estrutura e contenção. Cor significa algo ou está ausente. Dense sem desordem. Funcional sem frieza. Hugo usa este sistema há anos — o app deve parecer imediatamente familiar, não como um upgrade forçado. O calor da superfície de papel sobrevive à tradução digital; o ruído, não.

**Postura de design em três princípios:**

1. **Ferramenta, não produto de consumo.** Cantos afiados, superfícies planas, tipografia monopeso e sem floreio. Cada pixel é funcional ou é removido.
2. **Cor como informação.** As seis categorias semânticas existem porque o caderno físico as usa com esse propósito. Nenhuma cor nova é adicionada por razões estéticas. Cores de categoria aparecem apenas como borda esquerda em task-rows e tints de cabeçalho — nunca como preenchimento de fundo de área.
3. **Calor analógico, precisão digital.** O fundo não é branco puro (#FFFFFF) — é branco-quente (#FDFAF4), da mesma família do papel Leuchtturm que o usuário conhece. O dark mode não é cinza-frio — é carvão-quente (#2A2420), como tinta sobre papel envelhecido.

**MUI como infraestrutura, não como identidade.** O Material UI provê o esqueleto de componentes. Este DESIGN.md especifica o delta da camada de marca sobre os defaults do MUI: sem elevação, sem ripple, border-radius apertado, paleta completamente substituída. O resultado deve parecer nada com o Material Design padrão.

---

## 2. Cores

### Sistema duplo: base tinta-e-papel + camada semântica

A paleta opera em dois níveis que nunca se misturam visualmente.

**Nível base (superfície e tinta):** Define a textura do ambiente. `surface-base` (#FDFAF4 no light, #2A2420 no dark) é o fundo universal — todas as surfaces derivam dele por variações tonais quentes. `ink-primary` é a cor do texto de leitura. Não há azuis, verdes ou outros cromáticos neste nível.

**Nível semântico (categorias e prioridade):** Cada cor carrega um significado herdado do caderno físico. As cores `cat-*` identificam a qual grupo pertentor uma tarefa pertence — e só aparecem como bordas de 3px na lateral esquerda da task-row. As cores `priority-*` identificam o quadrante Eisenhower e aparecem como chips badge-like (pequenos, densos).

**Papéis de superfície:**
- `surface-base`: fundo da página, área de scroll principal
- `surface-raised`: levemente mais escura/quente — usada em estados hover de task-row, áreas de entrada de formulário
- `surface-header`: tom-sobre-tom mais pronunciado — cabeçalhos de dia e semana. Cria hierarquia visual sem usar cor cromática

**Categorias semânticas:**
Os seis tokens `cat-*` mapeiam diretamente para as cores de marcador do caderno físico. Teal e verde são os mais frios; purple e pink são os mais quentes; yellow é reservado para marcadores de data e recorrências importantes. Blue (`cat-blue`) está disponível como categoria E, mas removido do uso em cabeçalhos de dia.

No dark mode, cada `cat-*` ganha luminosidade (+15 a 20 pontos de lightness em HSL) para manter contraste adequado contra superfícies escuras, sem perder a identidade cromática.

**Eisenhower — calor, não alarme:**
As cores de prioridade são deliberadamente quentes, não frias. `priority-ui` (Urgente + Importante) é um vermelho tijolo (#C0392B), não o vermelho-alarme de sistemas de notificação. `priority-u` (Urgente) é laranja-âmbar. `priority-i` (Importante) é âmbar-mostarda, harmonizando com `cat-yellow`. `priority-none` reutiliza o mesmo verde de `cat-green` — reforço semântico positivo.

**Brand primary:**
O único cromático que serve como cor de ação é `brand-primary` (#2BADA0), teal, idêntico a `cat-teal`. Esta decisão não é acidental: teal é a categoria de hábitos e projetos-chave no caderno físico — a cor que o usuário associa a "o que importa". Usá-la como cor de ação primária cria coerência semântica, não dissonância.

**Dark mode:**
Toda a paleta dark é **quente**. Nenhuma surface dark usa cinza neutro ou cool-gray. A base #2A2420 tem matiz marrom-avermelhado. Bordas e surfaces derivadas também mantêm o matiz quente. O resultado é uma experiência noturna que parece "caderno com pouca luz" em vez de "terminal de computador".

**Acessibilidade:**
Cores de categoria nunca são o único indicador de tipo. Todo task-row que usa cor de borda também exibe um símbolo BuJo (•, /, X, >, >>) que carrega o mesmo significado. Chips Eisenhower incluem rótulo textual além da cor. Contraste mínimo WCAG 2.2 AA aplicado em todos os pares ink/surface.

---

## 3. Tipografia

**Uma fonte, dois pesos.** Inter Regular (400) para conteúdo de leitura e Inter SemiBold (600) para hierarquia. Nenhum peso intermediário, nenhum itálico, nenhuma fonte secundária.

**Por que Inter:** melhor legibilidade em tamanhos pequenos (crítico para a densidade do BuJo), distingue bem l/I/1 e O/0 (essencial para datas e contadores), compatível com MUI `theme.typography` sem configuração adicional.

### Escala tipográfica

| Token | Tamanho | Peso | Uso |
|---|---|---|---|
| `display` | 20px / 24px lh | SemiBold (600) | Títulos de seção: MAIO, SEMANA 3, GRATIDÃO |
| `heading` | 15px / 20px lh | SemiBold (600) | Cabeçalhos de dia: TERÇA \| 10/06 |
| `body` | 14px / 20px lh | Regular (400) | Texto de tarefas, conteúdo padrão |
| `body-sm` | 12px / 16px lh | Regular (400) | Labels de habit tracker, contadores, informações secundárias |
| `label` | 11px / 14px lh | SemiBold (600) | Chips de status, badges Eisenhower, labels de UI (uppercase, tracking 0.04em) |

**Notas de densidade:** 14px para body-text é o mínimo para uso prolongado em desktop. 12px (`body-sm`) aparece apenas em contextos verdadeiramente densos (linhas de habit tracker, contadores de hora no Weekly Log) — nunca como texto principal de tarefa. `label` em 11px uppercase ganha legibilidade com o tracking generoso de 0.04em.

**Hierarquia sem cor.** A escala é projetada para criar hierarquia visual apenas com tamanho e peso — nenhum token de cor cromática é necessário para distinguir `display` de `heading` de `body`. O resultado é legível mesmo por usuário com daltonismo.

---

## 4. Layout e Espaçamento

**Escala base 4px.** Todos os espaçamentos internos, gaps e paddings derivam de múltiplos de 4px. O espaçamento 3 (12px) é a unidade de padding interno padrão; o espaçamento 4 (16px) é o gap padrão entre seções.

### Grid e estrutura desktop

| Área | Largura | Comportamento |
|---|---|---|
| Sidebar expandida | 240px | Fixa, sempre visível |
| Sidebar colapsada | 56px | Ícones apenas |
| Conteúdo principal | flex: 1 | Ocupa o espaço restante |
| Coluna máxima de conteúdo | 800px | Centralizado em viewports largas |

A sidebar é fixa à esquerda com opção de colapso para ícones — acomoda os 8 módulos sem crowding, mantém contexto de seção sempre visível. Não há hambúrguer em desktop.

### Layout mobile

Navigation bottom bar com 4 abas (Hoje · Planner · Hábitos · Saúde) + FAB fixo no canto inferior direito. O FAB serve como ponto de entrada permanente do Brain Dump (FR-5.4). A bottom bar fica acima da safe-area do iOS/Android.

Touch targets mínimos: 44px de altura para toda ação interativa em mobile, independentemente do tamanho visual do elemento (padding compensatório aplicado invisível quando necessário).

### Weekly Log — densidade controlada

Em desktop, o Weekly Log exibe os 7 dias lado a lado quando a viewport permite (≥1024px). Em viewports menores, alterna para view condensada empilhada ou scroll horizontal limitado. Nunca força scroll horizontal invisível.

---

## 5. Elevação e Profundidade

**Hierarquia sem sombra.** Nenhum componente usa `box-shadow` para criar profundidade. Hierarquia visual é comunicada exclusivamente por:

- Diferença tonal entre tokens de surface (`surface-base` → `surface-raised` → `surface-header`)
- Bordas hairline de 1px (`border-hairline`) separando seções
- Bordas coloridas de 3px em task-rows marcando categoria

**Overrides MUI obrigatórios:** toda a escala de sombras é neutralizada e componentes de superfície usam elevação zero por padrão. A implementação deve expressar essa regra no tema central, sem exceções locais não documentadas.

Dialogs e drawers usam `surface-raised` como background (diferença tonal em vez de sombra). O overlay de backdrop usa `ink-primary` com 40% de opacidade.

---

## 6. Formas (Border-radius)

| Token | Valor | Uso |
|---|---|---|
| `xs` | 2px | Ícones de status de tarefa, chips de categoria |
| `sm` | 4px | Inputs, task-rows, botões secundários |
| `md` | 6px | Cards, dialogs, popovers |
| `lg` | 8px | Modais, drawers, FAB |

Nenhum componente usa border-radius > 8px. A linguagem é de ferramenta — cantos afiados comunicam funcionalidade, não consumo. O override global no MUI theme define `shape.borderRadius = 4` (token `sm`) como padrão, com exceções explícitas para cada componente.

---

## 7. Componentes

### 7.1 Task Row — o componente central do app

O task-row é o componente mais usado no BuJo Digital. Sua especificação precisa é crítica para a densidade e legibilidade do Daily Log.

**Anatomia (da esquerda para a direita):**
```
[borda-cat 3px] [gap 8px] [ícone-status 16px] [gap 8px] [texto-tarefa flex:1] [chip-eisenhower] [gap 8px]
```

- **Borda esquerda:** 3px sólida na cor `cat-*` da categoria. Sem borda esquerda = tarefa sem categoria (usa `border-hairline` como fallback transparente para manter o alinhamento).
- **Ícone de status:** 16×16px, mapeamento de símbolo BuJo para ícone MUI:
  | Estado | Símbolo BuJo | Ícone MUI |
  |---|---|---|
  | A fazer | • | RadioButtonUnchecked |
  | Iniciada | / | HourglassEmpty |
  | Feita | X | CheckBox |
  | Migrada | > | ArrowForward |
  | Adiada | >> | KeyboardDoubleArrowRight |
  | Rápida | ! (raio) | FlashOn |
  | Cancelada | — | RemoveCircleOutline |
- **Texto:** `body` (14px Regular). Tarefas concluídas recebem `text-decoration: line-through` e cor `ink-disabled`.
- **Chip Eisenhower:** exibido apenas quando atribuído. Alinhado à direita, não empurra o texto (absolute ou slot fixo à direita).
- **Hover:** `background` muda para `surface-raised`, sem outras mudanças. Transição 120ms ease.
- **Height:** automático com `min-height: 36px`. Tarefas com subtarefas expandem verticalmente.
- **Padding:** 6px topo/base, 12px direita, 0 esquerda (a borda colorida define a margem visual).

**Interação — 1 clique por decisão:**
Clicar no ícone de status abre um menu inline com os estados possíveis (não um dialog). O motor de migração (FR-1.7) apresenta cada tarefa individualmente com 4 ações em botões planos: Migrar · Adiar no mês · Adiar no futuro · Cancelar.

### 7.2 Day Header

Bloco que encabeça cada dia no Daily Log e no Weekly Log.

```
[surface-header background] [padding 4px 12px] [texto "TERÇA | 10/06" em heading] [divider hairline embaixo]
```

- Background: `surface-header` — tom-sobre-tom do background, não cor cromática.
- Tipografia: `heading` (Inter SemiBold 15px).
- Border-radius: `xs` (2px).
- Sem ícone, sem emblema extra. A data é o conteúdo.

### 7.3 Sidebar Item (ativo)

```
[border-left 3px brand-primary] [background brand-primary 10% opacity] [padding 8px 16px] [ícone 20px] [label body SemiBold]
```

Estado inativo: sem borda, background transparente, cor `ink-secondary`, peso Regular. Hover: `surface-raised`. A transição de borda esquerda colored é o indicador primário de estado ativo — mantém a linguagem visual consistente com os task-rows.

Grupos colapsáveis (Planner, Saúde) usam `ChevronRight` / `ChevronDown` (16px) à direita do label. O ícone do grupo pai permanece visível quando colapsado para ícones.

### 7.4 FAB — Brain Dump

```
[position fixed bottom: 20px right: 20px] [52×52px] [border-radius lg: 8px] [background fab-bg] [ícone AddComment, 24px, cor surface-base]
```

- Sem sombra (`box-shadow: none`).
- Badge numérico vermelho quando há itens no Brain Dump (FR-5.4): pequeno círculo com `label` tipografia, alinhado ao canto superior direito do FAB.
- No mobile, o FAB sobe 64px acima do bottom nav para não sobrepor.
- Pressionar o FAB abre um drawer bottom (mobile) ou dialog (desktop) para captura rápida: campo de título obrigatório, campo de descrição opcional, selector de log de destino opcional.

### 7.5 Status Chip

Chip badge exibido inline na task-row ou no motor de migrações para comunicar o estado atual da tarefa.

```
[border-radius xs: 2px] [padding 1px 6px] [label typography (11px SemiBold uppercase)]
```

Variantes (ver token `components.status-chip.variants`):
- **A fazer:** ghost — borda hairline, sem preenchimento, texto `ink-secondary`
- **Fazendo:** tint amarelo, borda amarela
- **Feita:** tint verde, borda verde
- **Migrada:** tint azul, borda azul
- **Adiada:** cinza-quente, desativado visualmente
- **Rápida:** tint teal, borda teal

### 7.6 Eisenhower Chip

Badge de prioridade. Menor e mais denso que o status chip — aparece na task-row apenas quando o nível de prioridade foi atribuído.

```
[border-radius xs: 2px] [padding 1px 5px] [label typography (11px SemiBold uppercase)] [min-width 24px]
```

Rótulos: **U+I** · **U** · **I** · **–** (para "nenhum", quando chip é exibido como placeholder)

Fundo sólido para U+I e U (contraste de texto branco). Âmbar semi-sólido para I (texto escuro). Verde com borda para "nenhum" (sem preenchimento sólido para não competir com os outros).

### 7.7 Habit Tracker Grid

Grid denso com hábitos nas linhas e dias nas colunas. Células booleanas: quadrado 28×28px com border-radius xs. Células numéricas: exibem valor + barra de progresso linear interna.

O emoticon do hábito (FR-2.2) aparece antes do nome do hábito na label da linha (`body-sm`). Grupos de hábitos têm separador hairline entre eles com label de grupo em `label` uppercase.

### 7.8 Migration Modal

Tela de decisão de migração (FR-1.7/1.8/1.9). Apresenta uma tarefa por vez com:

```
[contador "3 de 7 tarefas"] [task-row em modo readonly, expandido] [4 botões de ação em linha]
   Migrar para Hoje   |   Adiar no Mês   |   Adiar no Futuro   |   Cancelar
```

Botões planos, sem preenchimento, separados por dividers verticais. Sem dialog overlay para não interromper o fluxo — implementado como surface que substitui o conteúdo principal (full-page flow).

---

### 7.9 Fundação operacional da migração

O novo sistema substitui a expressão visual anterior; não existe variante de produto “Legado” e “Moderno”. Durante o rollout, uma rota pode usar internamente uma das duas fundações, mas cada superfície renderiza apenas uma linguagem por vez. Depois da aprovação da fundação, qualquer módulo novo usa exclusivamente estes tokens e padrões.

| Primitiva | Anatomia visual vinculante | Variantes obrigatórias |
|---|---|---|
| App Shell | sidebar, top bar compacta, área de conteúdo e zona persistente de feedback | sidebar expandida/colapsada; navegação compacta; badge Brain Dump |
| Page/Period Header | título, contexto temporal, stepper, retorno a atual e ações | simples; período; fechado; com resumo |
| Workspace Surface | região principal dominante, contexto secundário e zona sticky opcional | leitura; trabalho; grid; ritual |
| Card/Panel | header, corpo, ações e feedback local | padrão; denso; selecionado; somente leitura |
| Item Row | estado leading, conteúdo, metadados e ações trailing | task; recorrente; inbox; arquivo; configuração |
| Chip | ícone/forma, texto e cor semântica | status; prioridade; origem; período; contagem |
| Section Header | rótulo, contagem/progresso e ações | estático; colapsável; fechado |
| Date/Range Control | anterior, valor atual, próximo e ação Hoje/Atual | dia; semana; mês; intervalo |
| Data Grid | headers persistentes, célula, seleção e alternativa compacta | calendário; histórico; tracker |
| Dialog/Sheet/Flow | título, contexto, conteúdo, feedback e ações | dialog; bottom sheet; full-screen ritual |
| Feedback | mensagem, consequência e recuperação | loading; empty; error; offline; disabled |

Uma variação local só é aceita quando possui semântica de domínio que não pode ser representada por composição. Se o mesmo desenho aparecer em duas features, deve ser promovido para a fundação compartilhada antes da terceira utilização.

### 7.10 Linguagem de páginas e superfícies

O handoff inspira a divisão entre superfície de trabalho dominante e contexto auxiliar, não uma coleção de dashboards. A largura ampla existe para trabalho temporal, não para esticar texto.

| Tipo de superfície | Composição wide | Composição compacta |
|---|---|---|
| Foco diário | lista principal 2/3 + contexto 1/3 | sequência: header, alertas, lista, contexto |
| Planner temporal | header + grid/calendário + painel contextual | seletor de período + lista/cartões por dia; sem compressão do grid |
| Ritual | fluxo concentrado com progresso e destino visível | tela cheia, uma decisão por vez, ações fixas no rodapé |
| Coleção/inbox | lista densa + detalhe contextual | lista; detalhe em sheet/tela própria |
| Configuração | índice/seções + formulário | seções empilhadas, ação principal persistente quando necessário |
| Histórico/arquivo | filtros + lista/tabela somente leitura | cartões cronológicos e detalhe separado |
| Dados densos | controle de período + tabela/gráfico autorizado | resumo + alternância entre tabela e gráfico; nunca miniaturização ilegível |

O `workspace-max` de {density.workspace-max} governa planners e grids; o `reading-max` de {density.reading-max} governa formulários, gratidão e detalhes. Em wide, gutters são 24–32px; em compact, 16px. Regiões principais se separam por 24px, seções por 16px e elementos relacionados por 4–12px.

### 7.11 Hierarquia, densidade e estados visuais

- Ação e estado do ciclo vêm antes de estatísticas, atalhos e contexto histórico.
- Listas de trabalho usam densidade compacta de {density.compact-row} apenas com mouse/teclado; touch usa no mínimo {density.touch-row}.
- Cards não são o contêiner universal. Divisores e agrupamento espacial são preferidos quando não há necessidade de borda própria.
- Hover nunca revela a única forma de executar uma ação; foco e touch têm acesso equivalente.
- Loading preserva a geometria esperada com skeletons; não usa spinner central para páginas.
- Empty ocupa a região que receberia conteúdo, explica o estado em uma frase e oferece no máximo uma ação primária pertinente.
- Error fica junto ao dado/ação afetado e inclui recuperação. Erro de página mantém shell e contexto temporal.
- Disabled usa opacidade apenas como reforço; mantém rótulo legível e fornece motivo quando não for óbvio.
- Readonly/archive reduz controles, não contraste. Ciclo fechado exibe label textual “Fechado” e não aparenta indisponibilidade.
- Foco usa {focus.width} em {focus.color}, offset {focus.offset}; nunca é removido em favor de hover.

### 7.12 Iconografia e motion

Ícones vêm da biblioteca já adotada pelo produto; SVGs do handoff não são ativos. O conjunto usa traço simples, tamanho 16–20px em listas e 20–24px em navegação. Ícone sem texto é permitido apenas para convenções inequívocas com nome acessível; status, prioridade e origem sempre têm redundância textual ou de forma.

Motion confirma causalidade, não decora: {motion.fast} para hover/pressed e {motion.standard} para abrir/fechar navegação, sheet ou painel. Reordenação pode animar deslocamento sem bloquear entrada. `prefers-reduced-motion` reduz movimentos espaciais a {motion.instant}; nenhum fluxo usa celebração, parallax ou animação automática contínua.

### 7.13 Limites da referência MyBujo

**Adotado como inspiração:** shell lateral, headers temporais, contraste entre trabalho e contexto, cards compostos, chips compactos, grids e sidebars contextuais, controles persistentes e ritual com progresso.

**Reconciliado:** rail de 78px vira sidebar da IA real; duas variantes do Daily viram uma composição responsiva; grids de semana/hábitos ganham alternativa compacta; paleta é a taxonomia única deste documento; MUI permanece infraestrutura.

**Descartado:** papel pautado, moldura, tags de região, pins, toolbar, fontes do pacote, SVGs, CSS/JavaScript, streaks, produtividade, fasting, auto-injeção de recorrentes, health fields fixos e analytics sem requisito. Esses itens não podem ser recuperados por histórias sem uma mudança upstream explícita.

## 8. Do's e Don'ts

### Faça

- **Use cor apenas para comunicar significado.** Cada token `cat-*` e `priority-*` carrega informação semântica herdada do caderno físico.
- **Mantenha bordas em 1px e planas.** `border-hairline` separa seções. É um separador, não uma moldura.
- **Prefira diferença tonal a sombra.** `surface-raised` distingue o hover de `surface-base` sem box-shadow.
- **Escreva microcopy direto e em pt-BR.** "Migrar para hoje" em vez de "Mover para o Daily Log". Sem gamificação.
- **Use ícones BuJo semanticamente.** O ícone `CheckBox` para tarefa feita deve ser interpretável sem conhecimento de Material Icons — escolha o ícone mais próximo do símbolo analógico, não o mais moderno.
- **Mantenha o FAB sempre visível.** O Brain Dump é ponto de entrada de captura rápida (UJ-4) — ele não pode ser scrollado para fora da view.
- **Respeite touch targets ≥ 44px em mobile** mesmo que o componente visual seja menor. Padding compensatório invisível.

### Não faça

- **Não use ripple.** Desabilitar o ripple effect é um override global obrigatório no MUI theme. O feedback de interação é dado apenas por mudança de cor de background.
  ```js
  theme.components.MuiButtonBase = { defaultProps: { disableRipple: true } }
  ```
- **Não adicione sombra a nenhum componente.** Nem 1px de blur. Hierarquia via tom, não via profundidade.
- **Não use border-radius > 8px.** Nenhum componente é "redondo". Nem o FAB — ele é `lg` (8px), não circular.
- **Não use cores cromáticas no nível base.** Surface e ink são quentes-neutros. A cor entra apenas na camada semântica.
- **Não celebre conclusões.** Sem confetti, sem animações de "parabéns", sem "sequência de 7 dias!". O BuJo é intencional e calmo.
- **Não mova tarefas silenciosamente.** 100% das decisões de migração exigem ação explícita do usuário (PRD critério de sucesso). Nenhum auto-placement.
- **Não use peso 500 ou itálico.** Apenas Regular (400) e SemiBold (600). A escala é intencional e o contraste entre os dois pesos é suficiente.
- **Não renderize scroll horizontal invisível** no Weekly Log em mobile. Use view condensada ou indicador explícito de scroll.
- **Não use cores cool no dark mode.** Todo token dark tem matiz quente. Se um novo componente precisar de uma surface dark, derive de `surface-base-dark` (#2A2420), não de um cinza neutro como #333333.
