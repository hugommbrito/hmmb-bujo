// ─────────────────────────────────────────────────────────────────────────────
// Camada de tokens canônicos do design system novo (migração 2026-07-17).
//
//   ▶ DADOS PUROS: sem React, sem MUI, sem side effects, sem env. Consumidores
//     são o shell novo (13.1), a sidebar/bottom nav novas (13.2/13.3), o passe
//     de paridade (13.4), o Épico 14 e os módulos seguintes — por isso vive em
//     `shared/` (primitivo sem dono, §7.1/§7.2 da arquitetura), não em `app/`.
//
//   ▶ NÃO substitui `src/theme.ts`. A paleta MUI vigente é o sistema LEGADO e
//     continua pintando todas as superfícies internas até suas ondas. Trocar o
//     tema global repintaria ~20 superfícies não validadas de uma vez e
//     contradiria o seam legado ("esta área ainda usa a versão anterior"). A
//     troca global acontece só na consolidação (Épico 18) — ver
//     `migration-plan.md`, nota de promoção 2026-07-23.
//
//   ▶ Aplicação: `shellCssVariables()` devolve CSS custom properties `--ds-*`
//     que o shell aplica no seu elemento raiz. CSS vars afetam apenas quem as
//     lê, então o conteúdo legado dentro do shell NÃO é repintado — que é
//     exatamente o que o seam promete. (Um `ThemeProvider` aninhado vazaria a
//     paleta nova para todo o conteúdo legado por herança de contexto.)
//
// [Source: ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md — frontmatter + §App Shell]
// [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md — §Accessibility Floor, §Responsive & Platform]
// ─────────────────────────────────────────────────────────────────────────────

// ─── Escala de espaçamento (base 4px) ────────────────────────────────────────

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
} as const

export type SpacingStep = keyof typeof spacing

// ─── Raios ───────────────────────────────────────────────────────────────────

export const radius = {
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  full: '9999px',
} as const

// ─── Tipografia ──────────────────────────────────────────────────────────────
// Inter é a única família operacional. Exportada como dados (não como CSS vars)
// porque o shell consome as variantes inteiras; a aplicação por variante MUI
// acontece na consolidação do tema (Épico 18).

export const typography = {
  'page-title': { fontFamily: 'Inter', fontSize: '24px', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.02em' },
  'section-title': { fontFamily: 'Inter', fontSize: '16px', fontWeight: 600, lineHeight: 1.35 },
  body: { fontFamily: 'Inter', fontSize: '14px', fontWeight: 400, lineHeight: 1.45 },
  'body-strong': { fontFamily: 'Inter', fontSize: '14px', fontWeight: 600, lineHeight: 1.45 },
  meta: { fontFamily: 'Inter', fontSize: '12px', fontWeight: 400, lineHeight: 1.4 },
  label: { fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, lineHeight: 1.3, letterSpacing: '0.01em' },
} as const

export type TypographyVariant = keyof typeof typography

// ─── Faixas responsivas ──────────────────────────────────────────────────────
// ≥1440 wide · 1024–1439 medium · 768–1023 tablet · <768 compact.

export const breakpoints = {
  wideMin: 1440,
  mediumMin: 1024,
  tabletMin: 768,
  compactMax: 767,
} as const

/**
 * Media queries derivadas das faixas. As strings de `desktop`, `tablet` e
 * `compact` são IDÊNTICAS às usadas pelo `AppLayout` legado — os mocks de
 * `matchMedia` dos testes compartilhados casam por string exata, e o escopo
 * dos atalhos `[`/`B` (desktop ≥1024px) precisa ser preservado na íntegra.
 */
export const mediaQueries = {
  desktop: `(min-width: ${breakpoints.mediumMin}px)`,
  tablet: `(min-width: ${breakpoints.tabletMin}px) and (max-width: ${breakpoints.mediumMin - 1}px)`,
  compact: `(max-width: ${breakpoints.compactMax}px)`,
  /** ≥768px — a partir do tablet (gutter medium). */
  tabletUp: `(min-width: ${breakpoints.tabletMin}px)`,
  /** ≥1440px — wide (gutter wide). */
  wideUp: `(min-width: ${breakpoints.wideMin}px)`,
} as const

// ─── App Shell ───────────────────────────────────────────────────────────────

export const appShell = {
  // `{components.app-shell}`
  sidebarExpanded: '240px',
  sidebarCollapsed: '64px',
  topbarHeight: '56px',
  workspaceMaxWidth: '1440px',
  readingWidth: '800px',
  gutterWide: spacing[8],
  gutterMedium: spacing[6],
  gutterCompact: spacing[4],
  touchTargetMin: '44px',
  bottomNavItems: 4,
  bottomNavConfigurableItems: 3,

  /**
   * Altura da bottom nav nova (3 atalhos + Menu, Story 13.3) — valor do mockup
   * aprovado (`key-app-shell-13-0.html`, `.bottom`). Consumida via
   * `--ds-bottom-nav-height` pelo `ShellLayout` (reserva de `padding-bottom`/
   * `scroll-padding` do compact), pela `ShellBottomNav`, pelo FAB e pelo
   * `ShellNavigationSheet` (o sheet termina acima da barra). A altura cobre o
   * alvo ≥48px dos itens frequentes (EXPERIENCE §Accessibility Floor).
   */
  bottomNavHeight: '64px',

  // `{components.app-shell-badge}` — consumido pela Story 13.2.
  badge: {
    minHeight: '18px',
    radius: radius.full,
    background: 'primary',
    foreground: 'on-primary',
  },

  // `{components.capture-action}` — consumido pelas Stories 13.2 (âncora na
  // navegação) e 13.3 (FAB circular no compact).
  captureAction: {
    icon: 'note-pencil',
    desktopAnchor: 'navigation',
    mobileSize: '52px',
    mobileRadius: radius.full,
  },

  // `{components.mobile-navigation-sheet}` — consumido pela Story 13.3.
  mobileNavigationSheet: {
    form: 'high-sheet',
    background: 'surface',
    backdrop: 'overlay',
    radiusTop: radius.lg,
  },
} as const

/** `{components.workspace}` */
export const workspace = {
  maxWidth: appShell.workspaceMaxWidth,
  readingWidth: appShell.readingWidth,
  gutterWide: appShell.gutterWide,
  gutterCompact: appShell.gutterCompact,
} as const

/**
 * `{components.focus-ring}` — largura/offset são estruturais; a cor é o papel
 * semântico `focus`, que muda com família/modo.
 */
export const focusRing = {
  color: 'focus',
  width: '2px',
  offset: '2px',
} as const

/** `{components.legacy-seam}` — faixa editorial do seam legado (Story 13.1). */
export const legacySeam = {
  background: 'info-soft',
  foreground: 'info',
  borderLeftWidth: '3px',
  borderLeftColor: 'info',
} as const

// ─── Componentes do sistema novo (Épico 14, Story 14.5) ──────────────────────
// [Source: DESIGN.md#components — task-row L395-404, weekly-board L363-368,
// weekly-planning L369-372, panel L411-415, chip L416-419, domain-icon L405-410]

/** `{components.task-row}` — anatomia canônica da Task Row (AC2/AC8). */
export const taskRow = {
  minHeightPointer: '36px',
  minHeightTouch: '48px',
  padding: `${spacing[2]} ${spacing[3]}`,
  radius: radius.sm,
  hover: 'surface-subtle',
  categoryBorderWidth: '3px',
  categoryBorderFallback: 'border',
  description: typography.meta,
  statusIconSize: '20px',
} as const

/**
 * `{components.weekly-board}`. `terminalOpacity` nasce aqui — DESIGN.md agrupa
 * o valor por superfície (idêntico em `monthly-board`/`future-board`), mas a
 * AC8 pede a CSS var na Task Row (`--ds-task-row-terminal-opacity`): é o
 * elemento que recebe a de-ênfase, não a grade que a declara.
 */
export const weeklyBoard = {
  gap: spacing[2],
  weekdayMinWidth: '240px',
  unscheduledMinWidth: '235px',
  dayScroll: 'internal',
  terminalOpacity: 0.58,
} as const

/** `{components.weekly-planning}` — rails do ritual (AC5). */
export const weeklyPlanning = {
  sourceRail: '190px',
  contextRail: '315px',
  densityPosition: 'sticky',
} as const

/** `{components.panel}` — painel diário/pool e cartões do rail. */
export const panel = {
  background: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  radius: radius.md,
  padding: spacing[4],
} as const

/** `{components.chip}` */
export const chip = {
  height: '24px',
  radius: radius.sm,
  typography: typography.label,
} as const

/** `{components.domain-icon}` — catálogo fechado de ícones de status (AC8). */
export const domainIcon = {
  library: '@phosphor-icons/react',
  weight: 'regular',
  sizeCompact: '18px',
  sizeDefault: '20px',
  color: 'currentColor',
} as const

// ─── Papéis semânticos de cor ────────────────────────────────────────────────

export const colorRoles = [
  'canvas',
  'surface',
  'surface-subtle',
  'surface-strong',
  'ink',
  'ink-muted',
  'ink-disabled',
  'border',
  'border-strong',
  'control-border',
  'primary',
  'primary-hover',
  'primary-soft',
  'on-primary',
  'info',
  'info-soft',
  'success',
  'success-soft',
  'warning',
  'warning-soft',
  'danger',
  'danger-soft',
  'category-teal',
  'category-purple',
  'category-pink',
  'category-yellow',
  'category-green',
  'category-blue',
  'priority-ui',
  'priority-u',
  'priority-i',
  'focus',
  'overlay',
] as const

export type ColorRole = (typeof colorRoles)[number]

export const colorFamilies = ['mineral', 'horizonte', 'bosque', 'ameixa'] as const
export type ColorFamily = (typeof colorFamilies)[number]

export const colorModes = ['light', 'dark'] as const
export type ColorMode = (typeof colorModes)[number]

/**
 * Forma canônica do nome de um token de cor: `{família}-{modo}-{papel}`, com a
 * exceção contratada de **Mineral Light**, que usa o alias sem prefixo (evita
 * duplicar os papéis semânticos e preserva a forma consumida pela baseline).
 */
export type ColorTokenName =
  | ColorRole
  | `mineral-dark-${ColorRole}`
  | `horizonte-${ColorMode}-${ColorRole}`
  | `bosque-${ColorMode}-${ColorRole}`
  | `ameixa-${ColorMode}-${ColorRole}`

export function colorTokenName(
  family: ColorFamily,
  mode: ColorMode,
  role: ColorRole,
): ColorTokenName {
  if (family === 'mineral' && mode === 'light') return role
  return `${family}-${mode}-${role}` as ColorTokenName
}

export type ColorPalette = Readonly<Record<ColorRole, string>>

/** Mineral Light — aliases canônicos sem prefixo. */
export const mineralLight: ColorPalette = {
  canvas: '#F5F2EA',
  surface: '#FBFAF6',
  'surface-subtle': '#EEEBE2',
  'surface-strong': '#E3DFD5',
  ink: '#25231F',
  'ink-muted': '#666159',
  'ink-disabled': '#969087',
  border: '#D6D1C7',
  'border-strong': '#AAA399',
  'control-border': '#666159',
  primary: '#315F5A',
  'primary-hover': '#274D49',
  'primary-soft': '#DDEAE7',
  'on-primary': '#FFFFFF',
  info: '#3D6488',
  'info-soft': '#E2EBF3',
  success: '#4B6F52',
  'success-soft': '#E2EBE1',
  warning: '#806020',
  'warning-soft': '#F2E8CE',
  danger: '#9A493F',
  'danger-soft': '#F3E1DE',
  'category-teal': '#2BADA0',
  'category-purple': '#7B5EA7',
  'category-pink': '#D95F78',
  'category-yellow': '#C89B00',
  'category-green': '#4A8C5C',
  'category-blue': '#3D72B4',
  'priority-ui': '#C0392B',
  'priority-u': '#D4660A',
  'priority-i': '#B8920A',
  focus: '#166C9C',
  overlay: '#25231F7A',
}

/** Mineral Dark — composição própria, nunca inversão automática do Light. */
export const mineralDark: ColorPalette = {
  canvas: '#151613',
  surface: '#1D1F1B',
  'surface-subtle': '#252823',
  'surface-strong': '#30342E',
  ink: '#F2F0E9',
  'ink-muted': '#B7B3AA',
  'ink-disabled': '#7D7A73',
  border: '#3C4038',
  'border-strong': '#5D6257',
  'control-border': '#B7B3AA',
  primary: '#72B7AE',
  'primary-hover': '#8CC9C1',
  'primary-soft': '#243F3B',
  'on-primary': '#102321',
  info: '#8DB9DE',
  'info-soft': '#223747',
  success: '#8FC397',
  'success-soft': '#263C2A',
  warning: '#E0B85D',
  'warning-soft': '#40351F',
  danger: '#E5968C',
  'danger-soft': '#472B28',
  'category-teal': '#47C8BB',
  'category-purple': '#A990D4',
  'category-pink': '#F08098',
  'category-yellow': '#E0B936',
  'category-green': '#77B783',
  'category-blue': '#77A9E2',
  'priority-ui': '#E5665B',
  'priority-u': '#EE8B42',
  'priority-i': '#D7B94A',
  focus: '#65BCE8',
  overlay: '#000000A3',
}

export type PaletteKey = `${ColorFamily}-${ColorMode}`

/**
 * Paletas efetivamente **wiradas** nesta story. As outras três famílias
 * (Horizonte Azul, Bosque Sálvia, Ameixa Editorial), o modo Sistema e o
 * seletor de aparência são da Story 18.1 — a tipagem acima já modela a forma
 * completa, mas nada além de Mineral é resolvível hoje.
 */
export const palettes: Record<'mineral-light' | 'mineral-dark', ColorPalette> = {
  'mineral-light': mineralLight,
  'mineral-dark': mineralDark,
}

export function resolvePalette(family: ColorFamily, mode: ColorMode): ColorPalette {
  if (family !== 'mineral') {
    throw new Error(
      `Família cromática "${family}" ainda não está wirada — apenas Mineral existe nesta onda. ` +
        `As demais famílias e o seletor de aparência são da Story 18.1.`,
    )
  }
  return palettes[`mineral-${mode}`]
}

// ─── CSS custom properties `--ds-*` ──────────────────────────────────────────

/**
 * Variáveis estruturais do shell — independentes de família/modo.
 * Chaves em kebab-case, prefixo `--ds-`.
 */
const structuralCssVariables: Readonly<Record<string, string>> = {
  '--ds-sidebar-expanded': appShell.sidebarExpanded,
  '--ds-sidebar-collapsed': appShell.sidebarCollapsed,
  '--ds-topbar-height': appShell.topbarHeight,
  '--ds-bottom-nav-height': appShell.bottomNavHeight,
  '--ds-workspace-max-width': appShell.workspaceMaxWidth,
  '--ds-reading-width': appShell.readingWidth,
  '--ds-gutter-wide': appShell.gutterWide,
  '--ds-gutter-medium': appShell.gutterMedium,
  '--ds-gutter-compact': appShell.gutterCompact,
  '--ds-touch-target-min': appShell.touchTargetMin,
  '--ds-capture-fab-size': appShell.captureAction.mobileSize,
  '--ds-badge-min-height': appShell.badge.minHeight,
  '--ds-focus-ring-width': focusRing.width,
  '--ds-focus-ring-offset': focusRing.offset,
  '--ds-legacy-seam-border-width': legacySeam.borderLeftWidth,
  '--ds-radius-xs': radius.xs,
  '--ds-radius-sm': radius.sm,
  '--ds-radius-md': radius.md,
  '--ds-radius-lg': radius.lg,
  '--ds-radius-full': radius.full,
  '--ds-task-row-min-height-pointer': taskRow.minHeightPointer,
  '--ds-task-row-min-height-touch': taskRow.minHeightTouch,
  '--ds-task-row-category-border-width': taskRow.categoryBorderWidth,
  '--ds-task-row-status-icon-size': taskRow.statusIconSize,
  '--ds-task-row-terminal-opacity': String(weeklyBoard.terminalOpacity),
  '--ds-weekly-board-gap': weeklyBoard.gap,
  '--ds-weekly-board-weekday-min-width': weeklyBoard.weekdayMinWidth,
  '--ds-weekly-board-unscheduled-min-width': weeklyBoard.unscheduledMinWidth,
  '--ds-weekly-planning-source-rail': weeklyPlanning.sourceRail,
  '--ds-weekly-planning-context-rail': weeklyPlanning.contextRail,
  '--ds-panel-padding': panel.padding,
  '--ds-chip-height': chip.height,
  ...Object.fromEntries(
    Object.entries(spacing).map(([step, value]) => [`--ds-space-${step}`, value]),
  ),
}

/**
 * Custom properties `--ds-*` a aplicar no elemento raiz do shell novo:
 * estruturais + papéis semânticos de cor da paleta pedida.
 */
export function shellCssVariables(
  mode: ColorMode = 'light',
  family: ColorFamily = 'mineral',
): Record<string, string> {
  const palette = resolvePalette(family, mode)
  return {
    ...structuralCssVariables,
    ...Object.fromEntries(colorRoles.map((role) => [`--ds-${role}`, palette[role]])),
  }
}

/** Referência a um papel semântico como `var(--ds-<papel>)`. */
export function dsColor(role: ColorRole): string {
  return `var(--ds-${role})`
}
