---
name: HMMB BuJo — Sistema Operacional Visual
description: Design system denso, calmo e produtivo para o Bullet Journal digital do hmmb-bujo.
status: final
created: 2026-07-17
updated: 2026-07-29
sources:
  - ../../../specs/spec-design-system-migration/SPEC.md
  - ../../../specs/spec-design-system-migration/design-system-contract.md
  - ../../../specs/spec-design-system-migration/migration-plan.md
  - ../../prds/prd-hmmb-bujo-2026-06-15/prd.md
  - ../../architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - ../../epics.md
  - ../../../implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md
  - ../../../implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md
  - imports/mybujo-full-handoff/design_handoff_full_app/README.md
  - imports/story-15-0-brain-dump-handoff/README.md
colors:
  # Aliases canônicos: Mineral Light.
  canvas: '#F5F2EA'
  surface: '#FBFAF6'
  surface-subtle: '#EEEBE2'
  surface-strong: '#E3DFD5'
  ink: '#25231F'
  ink-muted: '#666159'
  ink-disabled: '#969087'
  border: '#D6D1C7'
  border-strong: '#AAA399'
  control-border: '#666159'
  primary: '#315F5A'
  primary-hover: '#274D49'
  primary-soft: '#DDEAE7'
  on-primary: '#FFFFFF'
  info: '#3D6488'
  info-soft: '#E2EBF3'
  success: '#4B6F52'
  success-soft: '#E2EBE1'
  warning: '#806020'
  warning-soft: '#F2E8CE'
  danger: '#9A493F'
  danger-soft: '#F3E1DE'
  category-teal: '#2BADA0'
  category-purple: '#7B5EA7'
  category-pink: '#D95F78'
  category-yellow: '#C89B00'
  category-green: '#4A8C5C'
  category-blue: '#3D72B4'
  priority-ui: '#C0392B'
  priority-u: '#D4660A'
  priority-i: '#B8920A'
  focus: '#166C9C'
  overlay: '#25231F7A'
  # Mineral Dark.
  mineral-dark-canvas: '#151613'
  mineral-dark-surface: '#1D1F1B'
  mineral-dark-surface-subtle: '#252823'
  mineral-dark-surface-strong: '#30342E'
  mineral-dark-ink: '#F2F0E9'
  mineral-dark-ink-muted: '#B7B3AA'
  mineral-dark-ink-disabled: '#7D7A73'
  mineral-dark-border: '#3C4038'
  mineral-dark-border-strong: '#5D6257'
  mineral-dark-control-border: '#B7B3AA'
  mineral-dark-primary: '#72B7AE'
  mineral-dark-primary-hover: '#8CC9C1'
  mineral-dark-primary-soft: '#243F3B'
  mineral-dark-on-primary: '#102321'
  mineral-dark-info: '#8DB9DE'
  mineral-dark-info-soft: '#223747'
  mineral-dark-success: '#8FC397'
  mineral-dark-success-soft: '#263C2A'
  mineral-dark-warning: '#E0B85D'
  mineral-dark-warning-soft: '#40351F'
  mineral-dark-danger: '#E5968C'
  mineral-dark-danger-soft: '#472B28'
  mineral-dark-category-teal: '#47C8BB'
  mineral-dark-category-purple: '#A990D4'
  mineral-dark-category-pink: '#F08098'
  mineral-dark-category-yellow: '#E0B936'
  mineral-dark-category-green: '#77B783'
  mineral-dark-category-blue: '#77A9E2'
  mineral-dark-priority-ui: '#E5665B'
  mineral-dark-priority-u: '#EE8B42'
  mineral-dark-priority-i: '#D7B94A'
  mineral-dark-focus: '#65BCE8'
  mineral-dark-overlay: '#000000A3'
  # Horizonte Azul Light.
  horizonte-light-canvas: '#F1F4F5'
  horizonte-light-surface: '#FAFCFC'
  horizonte-light-surface-subtle: '#E7ECEE'
  horizonte-light-surface-strong: '#D9E1E4'
  horizonte-light-ink: '#20292D'
  horizonte-light-ink-muted: '#58676D'
  horizonte-light-ink-disabled: '#89969B'
  horizonte-light-border: '#C9D3D7'
  horizonte-light-border-strong: '#91A1A7'
  horizonte-light-control-border: '#58676D'
  horizonte-light-primary: '#285B73'
  horizonte-light-primary-hover: '#20495C'
  horizonte-light-primary-soft: '#DCEAF0'
  horizonte-light-on-primary: '#FFFFFF'
  horizonte-light-info: '#315F8A'
  horizonte-light-info-soft: '#DEE9F4'
  horizonte-light-success: '#356B57'
  horizonte-light-success-soft: '#DDECE5'
  horizonte-light-warning: '#81631F'
  horizonte-light-warning-soft: '#F1E8CD'
  horizonte-light-danger: '#93483F'
  horizonte-light-danger-soft: '#F2E0DE'
  horizonte-light-category-teal: '#168F86'
  horizonte-light-category-purple: '#7058A1'
  horizonte-light-category-pink: '#C84F72'
  horizonte-light-category-yellow: '#A97D00'
  horizonte-light-category-green: '#3F8050'
  horizonte-light-category-blue: '#356EAE'
  horizonte-light-priority-ui: '#B9382E'
  horizonte-light-priority-u: '#C85D09'
  horizonte-light-priority-i: '#927000'
  horizonte-light-focus: '#0B6E99'
  horizonte-light-overlay: '#20292D7A'
  # Horizonte Azul Dark.
  horizonte-dark-canvas: '#10181C'
  horizonte-dark-surface: '#172126'
  horizonte-dark-surface-subtle: '#202D33'
  horizonte-dark-surface-strong: '#293940'
  horizonte-dark-ink: '#EEF5F7'
  horizonte-dark-ink-muted: '#ABC0C8'
  horizonte-dark-ink-disabled: '#71868E'
  horizonte-dark-border: '#344750'
  horizonte-dark-border-strong: '#526A74'
  horizonte-dark-control-border: '#ABC0C8'
  horizonte-dark-primary: '#71B5D1'
  horizonte-dark-primary-hover: '#8CC8DF'
  horizonte-dark-primary-soft: '#203B48'
  horizonte-dark-on-primary: '#0C2732'
  horizonte-dark-info: '#87B8E5'
  horizonte-dark-info-soft: '#21394D'
  horizonte-dark-success: '#7FC49F'
  horizonte-dark-success-soft: '#203D30'
  horizonte-dark-warning: '#DFB85B'
  horizonte-dark-warning-soft: '#40361E'
  horizonte-dark-danger: '#EA9188'
  horizonte-dark-danger-soft: '#492927'
  horizonte-dark-category-teal: '#40C3B9'
  horizonte-dark-category-purple: '#A48BDA'
  horizonte-dark-category-pink: '#ED7698'
  horizonte-dark-category-yellow: '#DDB744'
  horizonte-dark-category-green: '#72B889'
  horizonte-dark-category-blue: '#72A7E3'
  horizonte-dark-priority-ui: '#E4665D'
  horizonte-dark-priority-u: '#EF8B43'
  horizonte-dark-priority-i: '#D5B94A'
  horizonte-dark-focus: '#61C5EF'
  horizonte-dark-overlay: '#000000A3'
  # Bosque Sálvia Light.
  bosque-light-canvas: '#F1F3EC'
  bosque-light-surface: '#FBFCF8'
  bosque-light-surface-subtle: '#E6EAE0'
  bosque-light-surface-strong: '#D8DED1'
  bosque-light-ink: '#242A22'
  bosque-light-ink-muted: '#5D675A'
  bosque-light-ink-disabled: '#8D9789'
  bosque-light-border: '#CBD2C4'
  bosque-light-border-strong: '#97A290'
  bosque-light-control-border: '#5D675A'
  bosque-light-primary: '#3E6242'
  bosque-light-primary-hover: '#304E34'
  bosque-light-primary-soft: '#DFEBDD'
  bosque-light-on-primary: '#FFFFFF'
  bosque-light-info: '#426783'
  bosque-light-info-soft: '#E0EAF1'
  bosque-light-success: '#3F6C45'
  bosque-light-success-soft: '#DFEBDE'
  bosque-light-warning: '#80651F'
  bosque-light-warning-soft: '#F0E8CD'
  bosque-light-danger: '#924A41'
  bosque-light-danger-soft: '#F1E1DE'
  bosque-light-category-teal: '#208F84'
  bosque-light-category-purple: '#75599C'
  bosque-light-category-pink: '#C55771'
  bosque-light-category-yellow: '#A98100'
  bosque-light-category-green: '#4C7F48'
  bosque-light-category-blue: '#416DA1'
  bosque-light-priority-ui: '#B73B31'
  bosque-light-priority-u: '#C45E0A'
  bosque-light-priority-i: '#907000'
  bosque-light-focus: '#176B82'
  bosque-light-overlay: '#242A227A'
  # Bosque Sálvia Dark.
  bosque-dark-canvas: '#121711'
  bosque-dark-surface: '#1A2119'
  bosque-dark-surface-subtle: '#232D22'
  bosque-dark-surface-strong: '#2E392C'
  bosque-dark-ink: '#F0F4EC'
  bosque-dark-ink-muted: '#B3C0AE'
  bosque-dark-ink-disabled: '#788474'
  bosque-dark-border: '#3A4937'
  bosque-dark-border-strong: '#596C55'
  bosque-dark-control-border: '#B3C0AE'
  bosque-dark-primary: '#85BB87'
  bosque-dark-primary-hover: '#9BCB9C'
  bosque-dark-primary-soft: '#29402A'
  bosque-dark-on-primary: '#102612'
  bosque-dark-info: '#8FB8D4'
  bosque-dark-info-soft: '#253947'
  bosque-dark-success: '#8FC591'
  bosque-dark-success-soft: '#273D28'
  bosque-dark-warning: '#DDB85F'
  bosque-dark-warning-soft: '#40361F'
  bosque-dark-danger: '#E59288'
  bosque-dark-danger-soft: '#482B28'
  bosque-dark-category-teal: '#49C5B8'
  bosque-dark-category-purple: '#AA8FD1'
  bosque-dark-category-pink: '#EC7891'
  bosque-dark-category-yellow: '#DDB844'
  bosque-dark-category-green: '#82B87C'
  bosque-dark-category-blue: '#7AA4D5'
  bosque-dark-priority-ui: '#E36960'
  bosque-dark-priority-u: '#EC8B45'
  bosque-dark-priority-i: '#D4B94A'
  bosque-dark-focus: '#67C2D8'
  bosque-dark-overlay: '#000000A3'
  # Ameixa Editorial Light.
  ameixa-light-canvas: '#F5F1F4'
  ameixa-light-surface: '#FCFAFC'
  ameixa-light-surface-subtle: '#EDE6EB'
  ameixa-light-surface-strong: '#E1D7DE'
  ameixa-light-ink: '#2C242B'
  ameixa-light-ink-muted: '#6C5C67'
  ameixa-light-ink-disabled: '#9C8D97'
  ameixa-light-border: '#D7CAD3'
  ameixa-light-border-strong: '#AA98A4'
  ameixa-light-control-border: '#6C5C67'
  ameixa-light-primary: '#6C3F62'
  ameixa-light-primary-hover: '#56324E'
  ameixa-light-primary-soft: '#EFE0EB'
  ameixa-light-on-primary: '#FFFFFF'
  ameixa-light-info: '#426783'
  ameixa-light-info-soft: '#E1EAF2'
  ameixa-light-success: '#4B6C52'
  ameixa-light-success-soft: '#E2EBE2'
  ameixa-light-warning: '#80631E'
  ameixa-light-warning-soft: '#F2E8CD'
  ameixa-light-danger: '#98443E'
  ameixa-light-danger-soft: '#F4DFDD'
  ameixa-light-category-teal: '#188E85'
  ameixa-light-category-purple: '#7552A0'
  ameixa-light-category-pink: '#C8496A'
  ameixa-light-category-yellow: '#A77B00'
  ameixa-light-category-green: '#417C4F'
  ameixa-light-category-blue: '#3D6DA7'
  ameixa-light-priority-ui: '#B9362D'
  ameixa-light-priority-u: '#C55C09'
  ameixa-light-priority-i: '#8F6D00'
  ameixa-light-focus: '#176B91'
  ameixa-light-overlay: '#2C242B7A'
  # Ameixa Editorial Dark.
  ameixa-dark-canvas: '#191318'
  ameixa-dark-surface: '#221A21'
  ameixa-dark-surface-subtle: '#2E232C'
  ameixa-dark-surface-strong: '#3A2D38'
  ameixa-dark-ink: '#F6EEF4'
  ameixa-dark-ink-muted: '#C7B2C0'
  ameixa-dark-ink-disabled: '#8B7784'
  ameixa-dark-border: '#4A3946'
  ameixa-dark-border-strong: '#6E5668'
  ameixa-dark-control-border: '#C7B2C0'
  ameixa-dark-primary: '#D092C1'
  ameixa-dark-primary-hover: '#DEA9D1'
  ameixa-dark-primary-soft: '#472D41'
  ameixa-dark-on-primary: '#2A1024'
  ameixa-dark-info: '#91B6D8'
  ameixa-dark-info-soft: '#273847'
  ameixa-dark-success: '#91C09B'
  ameixa-dark-success-soft: '#293B2D'
  ameixa-dark-warning: '#E2B75A'
  ameixa-dark-warning-soft: '#41351E'
  ameixa-dark-danger: '#ED918A'
  ameixa-dark-danger-soft: '#4B2928'
  ameixa-dark-category-teal: '#43C4B7'
  ameixa-dark-category-purple: '#AE8ADD'
  ameixa-dark-category-pink: '#F07898'
  ameixa-dark-category-yellow: '#DDB742'
  ameixa-dark-category-green: '#79B887'
  ameixa-dark-category-blue: '#78A6DF'
  ameixa-dark-priority-ui: '#E4665C'
  ameixa-dark-priority-u: '#EE8A43'
  ameixa-dark-priority-i: '#D6B849'
  ameixa-dark-focus: '#6BC4E9'
  ameixa-dark-overlay: '#000000A3'
typography:
  page-title: { fontFamily: 'Inter', fontSize: '24px', fontWeight: '600', lineHeight: '1.25', letterSpacing: '-0.02em' }
  section-title: { fontFamily: 'Inter', fontSize: '16px', fontWeight: '600', lineHeight: '1.35' }
  body: { fontFamily: 'Inter', fontSize: '14px', fontWeight: '400', lineHeight: '1.45' }
  body-strong: { fontFamily: 'Inter', fontSize: '14px', fontWeight: '600', lineHeight: '1.45' }
  meta: { fontFamily: 'Inter', fontSize: '12px', fontWeight: '400', lineHeight: '1.4' }
  label: { fontFamily: 'Inter', fontSize: '12px', fontWeight: '600', lineHeight: '1.3', letterSpacing: '0.01em' }
rounded:
  xs: '2px'
  sm: '4px'
  md: '6px'
  lg: '8px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  '12': '48px'
components:
  app-shell:
    sidebar-expanded: '240px'
    sidebar-collapsed: '64px'
    topbar-height: '56px'
    canvas: '{colors.canvas}'
    workspace-max-width: '1440px'
    gutter-wide: '{spacing.8}'
    gutter-medium: '{spacing.6}'
    gutter-compact: '{spacing.4}'
    bottom-nav-items: '4'
    bottom-nav-configurable-items: '3'
    touch-target-min: '44px'
  app-shell-nav-icon:
    library: '@phosphor-icons/react'
    size: '20px'
    weight-default: 'regular'
    weight-selected: 'fill'
    color: 'currentColor'
  app-shell-badge:
    min-height: '18px'
    radius: '{rounded.full}'
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
  capture-action:
    icon: 'note-pencil'
    desktop-anchor: 'navigation'
    mobile-size: '52px'
    mobile-radius: '{rounded.full}'
  mobile-navigation-sheet:
    form: 'high-sheet'
    background: '{colors.surface}'
    backdrop: '{colors.overlay}'
    radius-top: '{rounded.lg}'
  legacy-seam:
    background: '{colors.info-soft}'
    foreground: '{colors.info}'
    border-left: '3px solid {colors.info}'
  appearance-settings:
    family-count: '4'
    mode-count: '3'
    apply: 'after-save'
    control-border: '{colors.control-border}'
  interactive-control:
    border: '1px solid {colors.control-border}'
  workspace:
    max-width: '1440px'
    reading-width: '800px'
    gutter-wide: '{spacing.8}'
    gutter-compact: '{spacing.4}'
  weekly-board:
    gap: '{spacing.2}'
    weekday-min-width: '240px'
    unscheduled-min-width: '235px'
    day-scroll: 'internal'
    terminal-opacity: '0.58'
  weekly-planning:
    source-rail: '190px'
    context-rail: '315px'
    density-position: 'sticky'
  monthly-board:
    columns: '7'
    gap: '{spacing.2}'
    undated-width: '268px'
    day-scroll: 'internal'
    terminal-opacity: '0.58'
  monthly-planning:
    source-rail: '188px'
    context-rail: '310px'
    density-position: 'sticky'
  future-board:
    trail-width: '230px'
    horizon-months: '8'
    focus-scroll: 'internal'
    terminal-opacity: '0.58'
  archive-history:
    period-list-width: '330px'
    detail-min-width: '0'
    desktop-layout: 'period-list + readonly-detail'
    tablet-layout: 'reduced-period-list + readonly-detail'
    compact-layout: 'period-list -> readonly-detail'
    closed-contrast: 'normal'
  task-row:
    min-height-pointer: '36px'
    min-height-touch: '48px'
    padding: '{spacing.2} {spacing.3}'
    radius: '{rounded.sm}'
    hover: '{colors.surface-subtle}'
    category-border-width: '3px'
    category-border-fallback: '{colors.border}'
    description: '{typography.meta}'
    status-icon-size: '20px'
  domain-icon:
    library: '@phosphor-icons/react'
    weight: 'regular'
    size-compact: '18px'
    size-default: '20px'
    color: 'currentColor'
  panel:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    padding: '{spacing.4}'
  chip:
    height: '24px'
    radius: '{rounded.sm}'
    typography: '{typography.label}'
  focus-ring:
    color: '{colors.focus}'
    width: '2px'
    offset: '2px'
---

# HMMB BuJo — Design System

> Novo contrato visual canônico da migração de 2026-07-17. Não herda o design de 15/06. O handoff MyBujo é referência de composição; este arquivo vence em qualquer conflito.

## Brand & Style

O hmmb-bujo é uma ferramenta de trabalho pessoal organizada pelo tempo e por rituais. Sua aparência deve lembrar um instrumento editorial de uso diário: silencioso, preciso e tátil sem imitar papel. A interface privilegia listas, períodos, decisões e histórico — nunca decoração ou métricas sem ação.

Princípios vinculantes:

1. **Trabalho em primeiro plano.** A região onde Hugo age é sempre a maior e mais contrastante.
2. **Densidade legível.** Desktop comporta muitas linhas; touch preserva alvos confortáveis sem perder contexto.
3. **Calma operacional.** Pouca cor, nenhuma celebração e movimento apenas para explicar mudança.
4. **Estrutura, não cards por padrão.** Espaçamento, divisores e headings criam hierarquia; panels existem quando delimitam função.
5. **Digital nativo.** Nenhuma pauta, fita, letra manuscrita ou moldura de caderno.

MUI continua como infraestrutura de comportamento acessível conforme a arquitetura; a camada visual deste contrato substitui a aparência Material genérica. **Phosphor Icons é a biblioteca iconográfica de toda a plataforma**: destinos, ações, agrupadores e pictogramas de domínio usam `@phosphor-icons/react`, sempre com `currentColor`, nome/estado acessível independente e o pictograma sem significado exclusivo de estado. Os ícones de status de tarefa preservam o vocabulário operacional já consolidado.

## Colors

A paleta usa papel mineral claro e tinta quente, com verde-petróleo como ação. A cor primária aparece em seleção, foco contextual e ação principal — não em grandes áreas decorativas.

- `{colors.canvas}` é o fundo contínuo do workspace.
- `{colors.surface}` recebe panels, sheets e inputs.
- `{colors.surface-subtle}` diferencia hover, agrupamentos e zonas readonly.
- `{colors.ink}` e `{colors.ink-muted}` formam a hierarquia de leitura.
- `{colors.control-border}` delimita exclusivamente controles interativos quando a fronteira é necessária para reconhecer a affordance; não substitui `{colors.border}` em divisores/panels nem reutiliza `{colors.border-strong}` para esse papel.
- `{colors.primary}` identifica ação/seleção; não significa sucesso.
- Info, success, warning e danger possuem fundo soft correspondente e sempre são acompanhados de texto ou ícone.

Prioridade Eisenhower preserva o padrão operacional vigente: U+I usa `{colors.priority-ui}`, U usa `{colors.priority-u}`, I usa `{colors.priority-i}` e nenhuma prioridade omite o chip. Status de tarefa não depende dessa taxonomia: cada estado conserva nome e ícone próprios. Cor nunca é o único canal.

As categorias permanecem visíveis por uma borda esquerda de 3px na Task Row: teal, purple, pink, yellow, green e blue usam, respectivamente, `{colors.category-teal}`, `{colors.category-purple}`, `{colors.category-pink}`, `{colors.category-yellow}`, `{colors.category-green}` e `{colors.category-blue}`. A cor identifica categoria, nunca status ou Eisenhower; tarefa sem categoria usa `{colors.border}` para preservar alinhamento.

Quatro famílias estão disponíveis: **Mineral**, **Horizonte Azul**, **Bosque Sálvia** e **Ameixa Editorial**. Cada uma possui paletas Light e Dark completas no frontmatter; Dark é composição própria, nunca inversão automática. Os aliases sem prefixo (`{colors.canvas}`, `{colors.surface}`, `{colors.ink}`, `{colors.primary}` etc.) representam Mineral Light e definem os papéis semânticos substituídos em runtime.

Algoritmo de resolução: formar `{família}-{modo}-{papel}` para Horizonte, Bosque, Ameixa e Mineral Dark; para **Mineral Light**, resolver o mesmo `papel` pelo alias canônico sem prefixo. Em modo Sistema, manter `família` e trocar somente `modo` conforme a preferência do sistema. Essa exceção evita duplicar 32 tokens semânticos e não altera a forma consumida pela paleta baseline.

| Família | Light | Dark | Postura |
|---|---|---|---|
| Mineral | `{colors.canvas}` / `{colors.primary}` | `{colors.mineral-dark-canvas}` / `{colors.mineral-dark-primary}` | papel mineral e verde-petróleo |
| Horizonte Azul | `{colors.horizonte-light-canvas}` / `{colors.horizonte-light-primary}` | `{colors.horizonte-dark-canvas}` / `{colors.horizonte-dark-primary}` | cinza-azulado e azul profundo |
| Bosque Sálvia | `{colors.bosque-light-canvas}` / `{colors.bosque-light-primary}` | `{colors.bosque-dark-canvas}` / `{colors.bosque-dark-primary}` | papel esverdeado e sálvia |
| Ameixa Editorial | `{colors.ameixa-light-canvas}` / `{colors.ameixa-light-primary}` | `{colors.ameixa-dark-canvas}` / `{colors.ameixa-dark-primary}` | papel rosado e ameixa |

Em todas as oito paletas, os pares load-bearing — ink/canvas, ink/surface, on-primary/primary e texto semântico/fundo soft — devem atingir WCAG 2.2 AA. `{colors.control-border}` alcança no mínimo 3:1 contra `{colors.surface}` nas oito paletas. Estados ativos, falhas e categorias mantêm forma, texto ou ícone além da cor.

Os sources deste spine são deliberadamente visuais. `addendum.md` e `sprint-status.yaml` aparecem apenas em `EXPERIENCE.md`, pois fundamentam comportamento, planejamento e gates, não tokens ou identidade visual.

## Typography

Inter é a única família operacional. A escala curta reduz ruído e funciona em listas densas. `page-title` aparece uma vez por superfície; `section-title` estrutura regiões; `body` é o padrão; `meta` nunca carrega informação essencial sozinho.

Não usar display fonts, manuscritas, uppercase longo ou quatro pesos na mesma região. Números de datas, contagens e duração usam variantes tabulares quando disponíveis.

## Layout & Spacing

A escala é de 4px. Wide usa sidebar e workspace de até 1440px; leitura e formulários ficam em até 800px. Gutter wide é 32px, medium 24px e compact 16px.

| Viewport | Composição |
|---|---|
| ≥1440px | sidebar expandida; regiões principal/secundária quando agregam decisão |
| 1024–1439px | sidebar expandida ou colapsada; grid reduz colunas antes de comprimir conteúdo |
| 768–1023px | sidebar colapsada; contexto lateral desce abaixo da superfície principal |
| <768px | top bar + navegação compacta; uma coluna; sheets ou telas próprias |

Weekly usa múltiplas faixas para preservar a Task Row: Seg–Qua na primeira; Qui–Sex e fim de semana compacto na segunda; **Sem dia definido** ocupa uma coluna lateral contínua. Cada painel diário possui scroll interno. No compact, o Weekly mostra um dia por vez com seletor, sem scroll horizontal da página.

Monthly usa calendário segunda→domingo de até seis linhas e mostra todos os dias do mês, inclusive vazios. Em wide, o calendário ocupa a região principal e **Sem dia definido** fica numa coluna lateral contínua conforme `{components.monthly-board}`. Em cada célula, as tarefas aparecem diretamente em anatomia compacta; overflow usa scroll interno. Em compact, a grade vira escolha de data e a lista completa de um dia por vez, sem scroll horizontal da página.

## Elevation & Depth

Hierarquia vem de tom, borda e posição. Panels usam borda de 1px; sombras não estruturam páginas. Dialogs e sheets podem usar uma sombra ambiente mínima apenas para separar uma camada transitória. O backdrop usa `{colors.overlay}`.

## Shapes

Raios de 2–8px comunicam ferramenta, não aplicativo lifestyle. Pills ficam restritos a presença/contagem muito curta; status e prioridade usam `{rounded.sm}` para conservar leitura de etiqueta. FAB circular não é linguagem obrigatória: captura persistente deve seguir a composição do shell.

## Components

### Catálogo bilateral canônico

| Componente | Hierarquia | Contrato visual |
|---|---|---|
| App Shell | raiz | canvas, sidebar/rail, topbar e workspace contínuo |
| App Shell Navigation | App Shell | ativo com indicador, soft, label forte e Phosphor fill |
| App Shell Badge | App Shell | cápsula curta; trailing expandido, canto do ícone em icon-only |
| Persistent Capture | App Shell | ação ancorada; FAB circular no compact |
| Mobile Navigation Sheet | App Shell | sheet alto, backdrop, alça, header e rolagem |
| Legacy Seam Notice | App Shell | faixa info no início do conteúdo |
| Appearance Settings | Configurações | amostras de família + modos em radio groups |
| Mobile Shortcut Settings | Configurações | três slots editáveis + Menu readonly |
| Access Surface | raiz | limiar do workspace |
| Page/Period Header | raiz | título, período, stepper, status e ações |
| Workspace Surface | raiz | principal + contexto somente quando necessário |
| Task Row | raiz | categoria/status/Eisenhower + conteúdo + trailing |
| Domain Pictogram | raiz | Phosphor monocromático `currentColor` |
| Item Row | raiz | variante sem máquina de estado de tarefa |
| Panel | raiz | uma função, borda e surface |
| Section Header | Panel/lista | label, contagem/progresso e ações |
| Chip | raiz | etiqueta curta de taxonomia |
| Date/Range Control | raiz | stepper e seletor |
| Grid/Calendar | raiz | headers, células e foco |
| Dialog/Sheet | raiz | camada transitória de uma profundidade |
| Feedback | raiz | estado semântico junto ao dado/ação |
| Ritual de migração | Workspace Surface | rails + decisões + contexto |
| Weekly Board | Workspace Surface | faixas de dias + pool sem data |
| Weekly Planning Workspace | Workspace Surface | pai de sources e density |
| Weekly Planning Sources | Weekly Planning Workspace | rail de fontes |
| Week Density | Weekly Planning Workspace | contexto sticky e distribuição |
| Monthly Board | Workspace Surface | calendário completo + pool sem dia |
| Monthly Planning Workspace | Workspace Surface | pai de sources e density |
| Monthly Planning Sources | Monthly Planning Workspace | rail de três fontes |
| Month Density | Monthly Planning Workspace | minicalendário e distribuição |
| Archive History | Workspace Surface | abas temporais + filtros + lista mestre + detalhe readonly |
| Brain Dump (Inbox) | Workspace Surface | Panel Capturar + Section Header + lista Item Row; sem rail de contexto |

### App Shell

Sidebar, topbar e workspace contínuo seguem `{components.app-shell}`. Wide (≥1440px) e medium (1024–1439px) iniciam com sidebar de `{components.app-shell.sidebar-expanded}`; tablet (768–1023px) inicia como rail de `{components.app-shell.sidebar-collapsed}`. A topbar de `{components.app-shell.topbar-height}` usa a composição **superfície como protagonista**: mostra o nome da superfície atual como elemento principal, sem repetir a marca, breadcrumb ou ações globais não contratadas.

Cada destino usa `{components.app-shell-nav-icon}`: `regular` em repouso e o mesmo pictograma em `fill` quando selecionado. O ativo também combina indicador lateral de 3px, `{colors.primary-soft}`, label em `body-strong` e estado programático; nunca depende do preenchimento ou da cor isoladamente. O rail oculta labels sem retirar nomes acessíveis. Um agrupador recolhido que contém o filho ativo usa indicador lateral e fundo sutil, mas não recebe `aria-current`.

Badges seguem `{components.app-shell-badge}` e não deslocam labels. Brain Dump oculta o badge em zero, loading e erro; mostra `1`–`9` e limita valores maiores a **9+**. O nome acessível conserva a contagem exata. Rail, bottom nav e menu completo mantêm a cápsula ligada ao destino sem cobrir o pictograma.

A captura usa `note-pencil`. Em desktop/medium/tablet, **Abrir captura rápida** fica ancorada ao fim da navegação: nominal na sidebar e icon-only no rail. Em compact, vira FAB circular de `{components.capture-action.mobile-size}`, no canto inferior direito acima da bottom nav e da safe-area. Offline usa superfície e tinta disabled, preservando identidade, foco e motivo acessível; falha do contador não altera a disponibilidade.

Compact (<768px) usa bottom nav com exatamente `{components.app-shell.bottom-nav-configurable-items}` destinos dinâmicos e um quarto item fixo **Menu**. O menu abre `{components.mobile-navigation-sheet.form}` com toda a navegação disponível, inclusive os três atalhos, na ordem e nos agrupamentos canônicos. O sheet possui backdrop, alça, header/Fechar e rolagem interna; termina acima da bottom nav/safe-area.

O seam legado é uma faixa editorial de `{components.legacy-seam}` no início do conteúdo. Informa que a superfície ainda usa a versão anterior, não envolve o conteúdo em nova moldura, não oferece toggle Legado/Moderno e não pode ser dispensada. Desaparece apenas quando aquela rota for migrada.

→ Referências aprovadas: [`mockups/key-app-shell-13-0.html`](mockups/key-app-shell-13-0.html) e [`mockups/key-settings-appearance-nav-13-0.html`](mockups/key-settings-appearance-nav-13-0.html). Este spine vence em qualquer conflito.

### Catálogo Phosphor do App Shell

| Destino/controle | Ícone |
|---|---|
| Hoje | `calendar-dot` |
| Brain Dump | `brain` |
| Arquivo | `archive` |
| Configurações | `gear` |
| Esta Semana | `calendar-dots` |
| Este Mês | `calendar` |
| Futuro | `calendar-plus` |
| Recorrentes | `repeat` |
| Hábitos | `check-square` |
| Gratidão | `heart` |
| Saúde, agrupador não navegável | `first-aid-kit` |
| Métricas | `chart-line` |
| Medicamentos | `pill` |
| Colapsar/expandir sidebar | `sidebar-simple` |
| Abrir captura rápida | `note-pencil` |
| Menu de navegação completa | `list` |

### Configurações de aparência e navegação

O seletor de aparência apresenta quatro amostras de família e três modos — **Claro**, **Escuro** e **Sistema** — em panels de `{colors.surface}` e controles com foco `{components.focus-ring}`. A amostra comunica canvas, surface e primary; seleção usa borda `{colors.primary}`, fundo `{colors.primary-soft}` e estado textual/programático. Não existe preview imediato: a tela distingue “aplicado agora” de “selecionado, não salvo”.

A configuração mobile mostra três slots ordenados com selects de destino e um quarto slot **Menu** readonly. Erro de validação usa `{colors.danger-soft}` + `{colors.danger}` junto ao slot e à ação Salvar; saving usa ação disabled, sucesso usa `{colors.success-soft}` e falha preserva visualmente a escolha pendente. Não existe atalho de aparência no shell.

### Access Surface

Login e Signup usam o padrão **Limiar do workspace**: formulário operacional em primeiro plano e silhueta abstrata da área autenticada como profundidade contextual. A silhueta usa somente `{colors.surface-subtle}`, `{colors.border}` e opacidade reduzida; não reproduz conteúdo real, não aceita interação e fica oculta de tecnologias assistivas. Em compact, torna-se fundo recortado enquanto o formulário ocupa a ordem principal.

### Page/Period Header

Título, contexto temporal, anterior/próximo, ação Atual/Hoje, status do ciclo e ações contextuais. Em compact, título e stepper ficam na primeira linha; ações secundárias entram em menu.

### Workspace Surface

Região principal obrigatória; região secundária apenas quando oferece contexto necessário à decisão atual. Pode ser `focus`, `planner`, `ritual`, `collection`, `history`, `inbox` ou `settings`.

### Weekly Board

O desktop segue `{components.weekly-board}`: cinco dias úteis preservam a largura integral da Task Row, sábado e domingo recebem painéis compactos e o pool **Sem dia definido** permanece visível na lateral. Cada painel tem header, contagem, lista com scroll próprio e criação contextual. A superfície não usa sete colunas estreitas.

Estados terminais continuam visíveis com `{components.weekly-board.terminal-opacity}`; filtros podem removê-los por completo. Menor ênfase não reduz contraste de texto essencial nem apaga a seta navegável de migração. Totais por status são controles de filtro com estado textual e foco visível.

### Weekly Planning Workspace

O ritual é visualmente separado da grade. Desktop usa rail de fontes à esquerda, lista de decisões no centro e rail sticky de contexto à direita conforme `{components.weekly-planning}`. O rail direito reúne densidade real, totais, progresso, avisos e ações do ciclo. Densidade mostra somente registros já materializados no Weekly e segmenta status sem depender apenas de cor.

No mobile, a densidade permanece no topo; a fonte ativa ocupa toda a largura e o índice de fontes abre em sheet. O seletor de destino também usa sheet, com os sete dias, **Sem dia definido**, contagem de densidade e lembrete discreto de atalhos.

→ Referência aprovada: [`mockups/key-weekly.html`](mockups/key-weekly.html). Este spine vence em qualquer conflito.

### Monthly Board

O desktop segue `{components.monthly-board}`: calendário completo de sete colunas, começando na segunda-feira, com até seis linhas e células vazias preservadas. Cada célula mostra número/data, contagem textual e Task Rows compactas com categoria, estado, Eisenhower e título; não substitui títulos por pontos, contagens ou “+ N”. Quando o conteúdo excede a célula, a lista interna rola sem alterar a altura da grade e só captura a rolagem depois de receber interação explícita.

O número/cabeçalho do dia e cada Task Row são alvos separados. Today usa contorno `{colors.info}`; seleção usa contorno `{colors.primary}` e `{colors.primary-soft}`. Dias fora do mês usam `{colors.surface-subtle}` e `{colors.ink-disabled}`. Estados terminais permanecem legíveis com `{components.monthly-board.terminal-opacity}`; filtros podem ocultá-los por completo. **Sem dia definido** usa Task Rows integrais e scroll próprio em coluna continuamente acessível.

Em compact, a data selecionada aparece no header, um seletor semanal curto mantém anterior/próximo e uma escolha de data expõe todos os dias do mês. A Task Row volta à anatomia completa abaixo do seletor; **Sem dia definido** permanece como destino/lista equivalente e não fica escondido ao final de uma página longa.

### Monthly Planning Workspace

O ritual reutiliza a hierarquia do Weekly com delta mensal conforme `{components.monthly-planning}`: rail de três fontes à esquerda, decisões no centro e rail sticky à direita. O contexto mostra minicalendário completo, total e distribuição por status em cada dia, faixa **Sem dia definido**, totais, progresso, avisos e ações do ciclo. Segmentos de status sempre recebem legenda e contagens textuais; seleção/destino usa borda e fundo, nunca cor isolada.

No mobile, densidade permanece no topo, a fonte ativa ocupa toda a largura e o índice de fontes abre em sheet. O seletor de destino combina calendário navegável, entrada direta do número do dia e a opção explícita **Sem dia definido**; a ação primária nomeia o destino completo.

→ Referência aprovada: [`mockups/key-monthly.html`](mockups/key-monthly.html). Os spines vencem em qualquer conflito com este mockup.

### Future Log

Superfície híbrida conforme `{components.future-board}`: trilho à esquerda com o horizonte rolante de oito meses — cada mês uma linha com nome e contagem, o selecionado com indicador lateral `{colors.primary}` e `{colors.primary-soft}`, meses vazios em `{colors.ink-disabled}` sem desaparecer — e coluna de foco à direita com Task Rows integrais. A captura fica no header, no padrão do campo de item. **Ir para mês…** é um controle ao pé do trilho que abre um seletor de meses distantes com itens, agrupados por ano e com contagem; sem itens além do horizonte, o seletor mostra estado vazio orientando à captura por data.

Item datado usa prefixo `(14)`; item só com mês usa `— ago`, ambos em `{typography.meta}` com números tabulares. Datear/mover reutiliza o seletor de destino do ritual — dias do mês, **Sem dia definido** e outro mês — confirmando com destino nomeado; a origem fica terminal com `{components.future-board.terminal-opacity}` e seta navegável ao sucessor, que entra com contorno `{colors.info}` e `{colors.info-soft}` temporários. A seção **Anuais pendentes** usa o padrão de placement; vazia, não renderiza. No compact, o trilho vira barra de meses rolável e os seletores abrem em sheet.

→ Referência aprovada: [`mockups/key-future-log.html`](mockups/key-future-log.html). Os spines vencem em qualquer conflito com este mockup.

### Arquivo

Arquivo usa o padrão Histórico conforme `{components.archive-history}`. As abas **Semanal** e **Mensal** antecipam a taxonomia temporal sem expor Diário, busca ou IA antes de seus contratos. Em cada aba, as datas inicial e final filtram os períodos pela chave temporal já disponível; a lista permanece cronológica, do mais recente para o mais antigo, e a seleção abre o detalhe readonly ao lado.

Wide e medium usam lista de períodos + detalhe. Tablet reduz a lista antes de recompor. Compact usa sequência lista → detalhe, sem comprimir o mestre-detalhe nem criar scroll horizontal de página. `Fechado` identifica o período; `Somente leitura` identifica a permissão do detalhe. Ambos usam texto e contraste normal.

O detalhe reutiliza a Task Row, agrupamento diário/seção **Sem dia definido** e anatomia do detalhe de tarefa. Criar, editar, mover, reordenar, concluir, cancelar e excluir desaparecem; não ficam disabled. Seleção, leitura, abertura do detalhe e seta origem → sucessor permanecem ativas. A origem migrada e o sucessor destacado seguem o tratamento canônico de linhagem com `{colors.info}` e `{colors.info-soft}`.

Loading preserva a geometria de abas, filtros, lista e detalhe. Empty inicial e empty por filtro ocupam a região de períodos; erro e offline ficam junto à região afetada. Nenhum desses estados substitui o shell ou o header.

→ Referência aprovada: [`mockups/key-archive.html`](mockups/key-archive.html). A visão aditiva não contratual permanece em [`.working/future-vision/archive-future-vision.html`](.working/future-vision/archive-future-vision.html). Os spines vencem em qualquer conflito.

### Recorrentes (Coleção)

Superfície de coleção — não planner — em `/planner/recurring`: a biblioteca de templates. Agrupa por abas **Semanal / Mensal / Anual** (uma por `recurrence_group`) com contagem, mais o filtro **Mostrar inativos**. Cada linha é a **variante Item Row**: borda de categoria, título, subline `{grupo} — {recurrence_text}`, descrição opcional e chip Eisenhower — **sem ícone de status**, porque template não tem estado. Inativo entra com menor ênfase e chip textual, visível só com o filtro.

Criar e editar usam o **mesmo card do detalhe de tarefa** (drawer no desktop, sheet no compact; header, corpo e footer; Categoria e Prioridade no par), com paridade entre criar e editar. O **Grupo** é um segmented editável na criação (herda a aba) e **readonly** na edição. **Recorrência** é texto livre exibido como lembrete, nunca interpretado. O footer traz **Salvar**, **Ativar/Desativar** e **Excluir**: Excluir é um Icon Button de lixeira de menor ênfase, presente só na edição, com dialog de confirmação — é **soft delete** (o registro persiste para preservar a linhagem das tarefas já alocadas). Desativar é reversível e prospectivo; excluir some da biblioteca sem apagar o histórico.

**Alocar** — criar a instância real a partir do template — não vive aqui: é decisão de planejamento e acontece nas fontes **Recorrentes** dos rituais Semana/Mês e nos anuais do Future Log. Esta superfície apenas alimenta essas fontes. O termo padrão do ato é **Alocar** (não "Definir placement").

→ Referência aprovada: [`mockups/key-recorrentes.html`](mockups/key-recorrentes.html). Os spines vencem em qualquer conflito com este mockup.

### Migração / Catch-Up (Ritual)

Superfície contextual acionada por uma **faixa discreta** no Hoje ("N tarefas precisam de decisão", com a contagem por fonte). Não é destino permanente de navegação nem camada modal: reusa a estrutura do **ritual de planejamento** dentro do shell — rail de fontes à esquerda, lista de decisões no centro, rail de contexto à direita.

As **fontes** são os níveis **Meses → Semanas → Dias** (ordem fixa; "ontem" é o nível dia). O rail de contexto substitui o calendário-alvo do planejamento por **progresso, o que já foi decidido e o que resta por fonte** — migração não tem destino único. Cada linha traz origem/linhagem e as ações **Migrar para hoje** (destaque, em toda fonte), **Escolher destino…** e **Cancelar**; não há "Concluir". O seletor de destino é o mesmo dos rituais, com as abas **Esta semana** · **Dia no mês** · **Outro mês** e os atalhos **Hoje** / **Sem dia**. Pausar sai sem perder decisões (persistidas por item); retomar reabre com os itens restantes. Ao decidir tudo, um **resumo** factual antecede a volta ao Hoje.

→ Referência aprovada: [`mockups/key-migracao.html`](mockups/key-migracao.html). Os spines vencem em qualquer conflito com este mockup.

### Brain Dump (Inbox)

Superfície de padrão **Inbox** conforme `{components.workspace}`: `inbox`, sem rail de contexto. O Page/Period Header usa só `{typography.page-title}` e contexto textual — sem stepper, sem status de ciclo, sem seletor de período. Um único Panel **Capturar** no topo (Título obrigatório, Descrição multiline de duas linhas, Select Destino com as cinco opções canônicas e Brain Dump como padrão) antecede o Section Header **Pendências** com contagem textual e a lista, na ordem de leitura captura → pendências → processamento. Leitura limitada a `{components.workspace.reading-width}`; nenhum Panel aninhado.

Cada linha é a **variante Brain Dump** do Item Row: título, descrição truncada em uma linha, borda esquerda **neutra** — sem categoria, sem Eisenhower, sem ícone de status, porque o item não tem máquina de estado — com chip textual opcional para a dica de destino (`target_log` gravado, texto verbatim “Fica no Brain Dump até ser processado.”) e meta tabular com a data de captura. Trailing traz duas ações nomeadas (Mover, Descartar) sempre visíveis no ponteiro; no compact a linha inteira é o alvo único de `{components.task-row.min-height-touch}` e as ações migram para o sheet de item, incluindo os campos de edição do item (Título, Descrição, Destino).

A captura persistente do shell (`{components.capture-action}`) abre o **Capture Sheet**, variante do Dialog/Sheet: dialog de 400px em wide/medium/tablet, sheet no compact, foco no Título, Brain Dump como destino padrão, ação primária nomeando a consequência (*Salvar no Brain Dump*). **Mover** abre o **seletor de destino**, que reusa integralmente a anatomia do seletor do ritual de migração acima — calendário de densidade, atalhos, ação nomeada — trocando as abas por um seletor de log em `radiogroup` com os quatro destinos (Hoje, Esta Semana, Este Mês, Futuro) e os mesmos ícones/rótulos da navegação lateral (`calendar-dot` · `calendar-dots` · `calendar` · `calendar-plus`); o campo de mês de **Futuro** usa `input type="month"` nativo. Fechar o Capture Sheet ou o sheet de edição do item com pendência abre **Descartar item?**/**Descartar alterações?** em dialog, em todas as faixas — condição exata de disparo em `EXPERIENCE.md.Brain Dump e captura`.

→ Referência aprovada: [`mockups/key-brain-dump.html`](mockups/key-brain-dump.html), a partir do handoff em [`imports/story-15-0-brain-dump-handoff/`](imports/story-15-0-brain-dump-handoff/). Os spines vencem em qualquer conflito.

### Task Row

O cluster leading reúne borda de categoria, ícone de status e Eisenhower. Título, descrição e indicação de subtarefas ocupam o centro. O indicador numérico de ordem fica no trailing; a alça de drag, quando disponível, fica junto dele sem substituir a alternativa por teclado/comando. A linha secundária mostra apenas descrição e, quando aplicável, quantidade/expansão de subtarefas — não repete origem, horário ou status. Hover pode revelar atalhos, mas foco e touch têm equivalentes.

O vocabulário de ícones vigente é preservado: círculo vazio = pendente; ampulheta = iniciada; `TaskAlt` = concluída; `Cancel` = cancelada; seta simples = migrada; seta dupla = adiada. Migrada, adiada e cancelada são readonly no contexto de origem. Eisenhower aparece como chip compacto U+I vermelho, U laranja ou I amarelo; `none` não renderiza chip.

Na origem migrada, a seta simples é um controle navegável para o sucessor imediato. O destino entra na viewport com contorno `{colors.info}` e fundo `{colors.info-soft}` temporários; o tratamento mantém forma/texto e não depende somente de cor. Reduced motion remove deslocamento animado sem remover posicionamento ou destaque.

No detalhe, Categoria é um radio group visual: **Sem categoria** + seis swatches preenchidos com `{colors.category-teal}`, `{colors.category-purple}`, `{colors.category-pink}`, `{colors.category-yellow}`, `{colors.category-green}` e `{colors.category-blue}`, sem dropdown ou nome visível; a seleção usa um **anel** `{colors.primary}`, não checkmark. Eisenhower usa duas caixas semanticamente checkboxes, `U` e `I`, com sublabel opcional (*urgente* / *importante*): desmarcadas são neutras e marcadas recebem **preenchimento suave** e cor correspondentes a `{colors.priority-u}` / `{colors.priority-i}`, nunca dependendo só da cor. Ambas marcadas geram U+I, uma marcada gera U ou I e ambas desmarcadas geram nenhuma prioridade. Esse é o tratamento canônico dos dois controles (padrão fixado na M09) e vale para toda superfície com detalhe — tarefa e template recorrente.

No footer do detalhe, Salvar é primário. Cancelar tarefa é um botão danger contornado e possui mais destaque que Excluir. Excluir usa somente Icon Button de lixeira em `{colors.ink-muted}`, adjacente ao cancelamento, com tooltip e nome acessível; hover/foco pode assumir `{colors.danger}`, mas o repouso permanece secundário. Mover é ação neutra separada.

### Pictogramas de domínio

Phosphor é o vocabulário iconográfico de toda a plataforma. Para entidades e registros de domínio, usa `{components.domain-icon.weight}`, `{components.domain-icon.size-compact}` ou `{components.domain-icon.size-default}` e `currentColor`; a variante padrão é monocromática, sem duotone, fill decorativo ou cor própria por ícone. A troca `regular`→`fill` é reservada ao estado selecionado dos destinos do App Shell.

O pictograma identifica o assunto, não comunica conclusão, severidade, seleção ou disponibilidade. Esses estados continuam nos controles e padrões específicos. A seleção oferecida ao usuário deve ser curada, nomeada semanticamente e consistente entre cadastro, Hoje, grids e histórico. Emoji não é o padrão visual novo, mas permanece como fallback durante a migração de dados.

Fronteira do sistema:

- Phosphor: destinos, agrupadores, ações, identidade de hábito, métrica de saúde e demais conceitos aprovados.
- MUI: infraestrutura de componentes e comportamento acessível, sem originar a aparência ou uma segunda biblioteca iconográfica visível.
- Vocabulário vigente de tarefas: estados de pending, started, completed, cancelled, migrated e postponed.
- Não misturar bibliotecas para o mesmo significado nem escolher ícones apenas por semelhança visual.

### Panel e Section Header

Panel contém uma função; section header contém label, contagem/progresso e ações. Não aninhar card dentro de card para criar hierarquia.

### Status, Priority e Origin Chips

Taxonomias separadas. Todo chip tem texto, nome acessível e, quando necessário, ícone. Overflow vira resumo “+N”, nunca fila de pills ilegíveis.

### Date/Range Control

Stepper anterior/atual/próximo com seletor acessível. Datas usam locale pt-BR e nome completo em accessible name.

### Grid/Calendar

Headers persistentes, célula com estados nomeados, foco navegável e alternativa de lista. Today, selected, missing, N/A e closed são visualmente distintos sem depender apenas de preenchimento.

### Dialog/Sheet

Dialog para decisão curta; sheet para detalhe/captura compacta e escolha de destino. Migração/Catch-Up **não** usa camada modal própria nem tela cheia: reusa o **ritual** (fontes + decisões + contexto) dentro do workspace, como o planejamento semanal/mensal. Apenas uma camada modal por vez. Ações destrutivas ficam separadas e nomeiam a consequência. Migração, adiamento e alocação confirmam no próprio seletor com destino explícito; cancelamento e finalização irreversível usam dialog.

O Brain Dump usa três variantes deste componente: **Capture** (captura persistente do shell), **destino** (idêntica ao seletor do ritual de migração, com seletor de log no lugar das abas) e **confirmação** (Descartar item?/Descartar alterações?, foco inicial em Continuar editando — ver `Brain Dump (Inbox)` acima para a condição exata de disparo). Nenhuma delas abre sobre outra — o seletor de destino e o sheet de item nunca empilham sobre o Capture Sheet.

### Feedback

Skeleton preserva geometria. Empty ocupa o lugar do conteúdo. Error fica junto ao dado e oferece retry. Disabled mantém rótulo legível e explica o motivo. Readonly/closed remove mutações sem apagar hierarquia.

## Do's and Don'ts

| Faça | Não faça |
|---|---|
| Componha páginas por função e período | Transforme toda página em dashboard de cards |
| Use uma região principal inequívoca | Dê o mesmo peso a trabalho, KPIs e atalhos |
| Reordene regiões no mobile | Comprima o grid desktop ou imponha scroll horizontal |
| Use status com texto/forma/cor | Use cor como único significado |
| Preserve densidade com ritmo de 4px | Reduza texto essencial abaixo de 14px |
| Use MUI como infraestrutura | Reproduza aparência Material genérica |
| Use Phosphor monocromático para pictogramas de domínio | Substitua ícones funcionais e estados de tarefa indiscriminadamente |
| Use o handoff para composição | Copie CSS, fontes, SVGs ou funcionalidades do handoff |
| Trate ciclo fechado como legível e readonly | Aplique aparência disabled a todo o arquivo |
