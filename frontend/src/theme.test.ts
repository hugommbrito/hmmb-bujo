import { describe, it, expect } from 'vitest'
import { createBujoTheme } from './theme'

describe('createBujoTheme', () => {
  describe('modo light', () => {
    const theme = createBujoTheme('light')

    it('background.default é #FDFAF4 (AC1)', () => {
      expect(theme.palette.background.default).toBe('#FDFAF4')
    })

    it('background.paper é #F7F3EB', () => {
      expect(theme.palette.background.paper).toBe('#F7F3EB')
    })

    it('primary.main é #2BADA0 (brand teal)', () => {
      expect(theme.palette.primary.main).toBe('#2BADA0')
    })
  })

  describe('modo dark', () => {
    const theme = createBujoTheme('dark')

    it('background.default é #2A2420 (AC1)', () => {
      expect(theme.palette.background.default).toBe('#2A2420')
    })

    it('background.paper é #322C28', () => {
      expect(theme.palette.background.paper).toBe('#322C28')
    })

    it('primary.main é #3DC9BA (brand teal dark)', () => {
      expect(theme.palette.primary.main).toBe('#3DC9BA')
    })
  })

  describe('elevation zero (AC1)', () => {
    it('todas as 25 sombras são "none"', () => {
      const theme = createBujoTheme('light')
      expect(theme.shadows).toHaveLength(25)
      expect(theme.shadows.every((s) => s === 'none')).toBe(true)
    })

    it('MuiPaper elevation padrão é 0', () => {
      const theme = createBujoTheme('light')
      expect(theme.components?.MuiPaper?.defaultProps?.elevation).toBe(0)
    })
  })

  describe('border-radius e spacing (AC1)', () => {
    it('shape.borderRadius é 4', () => {
      const theme = createBujoTheme('light')
      expect(theme.shape.borderRadius).toBe(4)
    })

    it('spacing base é 4px: theme.spacing(1) === "4px"', () => {
      const theme = createBujoTheme('light')
      expect(theme.spacing(1)).toBe('4px')
    })
  })

  describe('tipografia (AC1)', () => {
    it('fontFamily padrão contém "Inter"', () => {
      const theme = createBujoTheme('light')
      expect(theme.typography.fontFamily).toContain('Inter')
    })

    it('variante display está definida', () => {
      const theme = createBujoTheme('light')
      expect(theme.typography.display).toBeDefined()
      expect((theme.typography.display as { fontSize: string }).fontSize).toBe('20px')
    })

    it('variante heading está definida', () => {
      const theme = createBujoTheme('light')
      expect(theme.typography.heading).toBeDefined()
    })

    it('variante body-sm está definida', () => {
      const theme = createBujoTheme('light')
      expect(theme.typography['body-sm']).toBeDefined()
      expect((theme.typography['body-sm'] as { fontSize: string }).fontSize).toBe('12px')
    })

    it('variante label está definida com textTransform uppercase', () => {
      const theme = createBujoTheme('light')
      expect(theme.typography.label).toBeDefined()
      expect((theme.typography.label as { textTransform: string }).textTransform).toBe('uppercase')
    })
  })

  describe('interação (AC1)', () => {
    it('MuiButtonBase.disableRipple é true', () => {
      const theme = createBujoTheme('light')
      expect(theme.components?.MuiButtonBase?.defaultProps?.disableRipple).toBe(true)
    })
  })

  describe('touch target (AC1)', () => {
    it('MuiButton tem minHeight 44px', () => {
      const theme = createBujoTheme('light')
      expect(theme.components?.MuiButton?.styleOverrides?.root).toMatchObject({ minHeight: 44 })
    })

    it('MuiIconButton tem minWidth e minHeight 44px', () => {
      const theme = createBujoTheme('light')
      expect(theme.components?.MuiIconButton?.styleOverrides?.root).toMatchObject({
        minWidth: 44,
        minHeight: 44,
      })
    })
  })

  describe('tokens de categoria (AC2, Story 3.2)', () => {
    it('light: expõe as 6 cores de categoria', () => {
      const theme = createBujoTheme('light')
      expect(theme.palette.category).toEqual({
        teal: '#2BADA0',
        purple: '#7B5EA7',
        pink: '#D95F78',
        yellow: '#C89B00',
        green: '#4A8C5C',
        blue: '#3D72B4',
      })
    })

    it('dark: expõe as 6 cores de categoria em suas variantes dark', () => {
      const theme = createBujoTheme('dark')
      expect(theme.palette.category).toEqual({
        teal: '#3DC9BA',
        purple: '#9E7FCC',
        pink: '#F07F97',
        yellow: '#F2C22E',
        green: '#6BB880',
        blue: '#6098D9',
      })
    })
  })

  describe('tokens de prioridade Eisenhower (AC2, Story 3.2)', () => {
    it('light: expõe as 4 cores de prioridade', () => {
      const theme = createBujoTheme('light')
      expect(theme.palette.priority).toEqual({
        ui: '#C0392B',
        u: '#D4660A',
        i: '#B8920A',
        none: '#4A8C5C',
      })
    })

    it('dark: expõe as 4 cores de prioridade em suas variantes dark', () => {
      const theme = createBujoTheme('dark')
      expect(theme.palette.priority).toEqual({
        ui: '#E05A4A',
        u: '#F08230',
        i: '#D4B030',
        none: '#6BB880',
      })
    })
  })

  describe('token de superfície do Day Header (AC1, Story 3.2)', () => {
    it('light: surfaces.header é o tom-sobre-tom claro', () => {
      const theme = createBujoTheme('light')
      expect(theme.palette.surfaces.header).toBe('#F0EBE0')
    })

    it('dark: surfaces.header é o tom-sobre-tom escuro', () => {
      const theme = createBujoTheme('dark')
      expect(theme.palette.surfaces.header).toBe('#3A3129')
    })
  })
})
