import { createTheme, type Theme } from '@mui/material/styles'

// ─── Module augmentation para variantes tipográficas custom ──────────────────
declare module '@mui/material/styles' {
  interface TypographyVariants {
    display: React.CSSProperties
    heading: React.CSSProperties
    'body-sm': React.CSSProperties
    label: React.CSSProperties
  }
  interface TypographyVariantsOptions {
    display?: React.CSSProperties
    heading?: React.CSSProperties
    'body-sm'?: React.CSSProperties
    label?: React.CSSProperties
  }
}
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    display: true
    heading: true
    'body-sm': true
    label: true
  }
}

// ─── Module augmentation para tokens de categoria/prioridade/superfície ──────
interface CategoryPalette {
  teal: string
  purple: string
  pink: string
  yellow: string
  green: string
  blue: string
}
interface PriorityPalette {
  ui: string
  u: string
  i: string
  none: string
}
interface SurfacesPalette {
  header: string
}
declare module '@mui/material/styles' {
  interface Palette {
    category: CategoryPalette
    priority: PriorityPalette
    surfaces: SurfacesPalette
  }
  interface PaletteOptions {
    category?: CategoryPalette
    priority?: PriorityPalette
    surfaces?: SurfacesPalette
  }
}

// ─── Tokens de cor (espelham DESIGN.md exatamente) ───────────────────────────
const colors = {
  // Superfície e tinta — light
  surfaceBase:       '#FDFAF4',
  surfaceRaised:     '#F7F3EB',
  surfaceHeader:     '#F0EBE0',
  inkPrimary:        '#1A1612',
  inkSecondary:      '#6B6359',
  inkDisabled:       '#B0A899',
  borderHairline:    '#DDD8CF',
  // Superfície e tinta — dark
  surfaceBaseDark:   '#2A2420',
  surfaceRaisedDark: '#322C28',
  surfaceHeaderDark: '#3A3129', // DESIGN.md §Categorias Semânticas — não exposto até esta story
  inkPrimaryDark:    '#EDE8E0',
  inkSecondaryDark:  '#A89E93',
  inkDisabledDark:   '#5C554E',
  borderHairlineDark:'#4A433C',
  // Categorias semânticas — light / dark
  catTeal:           '#2BADA0', catTealDark:    '#3DC9BA',
  catPurple:         '#7B5EA7', catPurpleDark:  '#9E7FCC',
  catPink:           '#D95F78', catPinkDark:    '#F07F97',
  catYellow:         '#C89B00', catYellowDark:  '#F2C22E',
  catGreen:          '#4A8C5C', catGreenDark:   '#6BB880',
  catBlue:           '#3D72B4', catBlueDark:    '#6098D9',
  // Prioridade Eisenhower — light / dark
  priorityUi:        '#C0392B', priorityUiDark: '#E05A4A',
  priorityU:         '#D4660A', priorityUDark:  '#F08230',
  priorityI:         '#B8920A', priorityIDark:  '#D4B030',
  priorityNone:      '#4A8C5C', priorityNoneDark:'#6BB880',
  // FAB e brand
  brandPrimary:      '#2BADA0', brandPrimaryDark: '#3DC9BA',
  fabBg:             '#1A1612', fabBgDark:        '#EDE8E0',
} as const

// ─── Escala tipográfica (DESIGN.md) ─────────────────────────────────────────
const INTER = '"Inter", system-ui, sans-serif'
const typographyVariants = {
  display: { fontFamily: INTER, fontWeight: 600, fontSize: '20px', lineHeight: '24px', letterSpacing: '-0.02em' },
  heading: { fontFamily: INTER, fontWeight: 600, fontSize: '15px', lineHeight: '20px', letterSpacing: '-0.01em' },
  body:    { fontFamily: INTER, fontWeight: 400, fontSize: '14px', lineHeight: '20px', letterSpacing: '0' },
  'body-sm': { fontFamily: INTER, fontWeight: 400, fontSize: '12px', lineHeight: '16px', letterSpacing: '0' },
  label:   { fontFamily: INTER, fontWeight: 600, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.04em', textTransform: 'uppercase' as const },
}

// ─── Factory ─────────────────────────────────────────────────────────────────
export function createBujoTheme(mode: 'light' | 'dark') {
  const light = mode === 'light'
  return createTheme({
    palette: {
      mode,
      background: {
        default: light ? colors.surfaceBase       : colors.surfaceBaseDark,
        paper:   light ? colors.surfaceRaised     : colors.surfaceRaisedDark,
      },
      text: {
        primary:   light ? colors.inkPrimary      : colors.inkPrimaryDark,
        secondary: light ? colors.inkSecondary    : colors.inkSecondaryDark,
        disabled:  light ? colors.inkDisabled     : colors.inkDisabledDark,
      },
      divider: light ? colors.borderHairline : colors.borderHairlineDark,
      primary: { main: light ? colors.brandPrimary    : colors.brandPrimaryDark },
      error:   { main: light ? colors.priorityUi      : colors.priorityUiDark },
      warning: { main: light ? colors.priorityU       : colors.priorityUDark },
      category: {
        teal:   light ? colors.catTeal   : colors.catTealDark,
        purple: light ? colors.catPurple : colors.catPurpleDark,
        pink:   light ? colors.catPink   : colors.catPinkDark,
        yellow: light ? colors.catYellow : colors.catYellowDark,
        green:  light ? colors.catGreen  : colors.catGreenDark,
        blue:   light ? colors.catBlue   : colors.catBlueDark,
      },
      priority: {
        ui:   light ? colors.priorityUi   : colors.priorityUiDark,
        u:    light ? colors.priorityU    : colors.priorityUDark,
        i:    light ? colors.priorityI    : colors.priorityIDark,
        none: light ? colors.priorityNone : colors.priorityNoneDark,
      },
      surfaces: {
        header: light ? colors.surfaceHeader : colors.surfaceHeaderDark,
      },
    },
    spacing: 4,
    shape: { borderRadius: 4 },
    shadows: Array(25).fill('none') as Theme['shadows'],
    typography: {
      fontFamily: INTER,
      ...typographyVariants,
    },
    components: {
      MuiPaper:      { defaultProps: { elevation: 0 } },
      MuiCard:       { defaultProps: { elevation: 0 } },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton:     { styleOverrides: { root: { minHeight: 44 } } },
      MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
    },
  })
}
