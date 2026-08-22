import { describe, expect, it } from 'vitest'

// `?raw` traz o código-fonte como string (molde de `weekly/noLiteralTokens.test.ts`)
// — prova estrutural de AC8: nenhum componente novo do Monthly Board/ritual
// escreve os literais reservados a `monthlyBoard`/`monthlyPlanning` (ou aos
// tokens compartilhados `taskRow`/`weeklyBoard.terminalOpacity`).
import monthlyDayCellSource from './MonthlyDayCell.tsx?raw'
import monthlyCalendarGridSource from './MonthlyCalendarGrid.tsx?raw'
import monthlyRitualSourcesSource from './monthlyRitualSources.ts?raw'
import monthlySourceRailSource from './MonthlySourceRail.tsx?raw'
import monthlyDecisionListSource from './MonthlyDecisionList.tsx?raw'
import monthlyDestinationPickerSource from './MonthlyDestinationPicker.tsx?raw'
import monthlyContextRailSource from './MonthlyContextRail.tsx?raw'

const FORBIDDEN_LITERALS = ['268px', '188px', '310px', '0.58', '36px', '48px', '3px']

const SOURCES: Record<string, string> = {
  'MonthlyDayCell.tsx': monthlyDayCellSource,
  'MonthlyCalendarGrid.tsx': monthlyCalendarGridSource,
  'monthlyRitualSources.ts': monthlyRitualSourcesSource,
  'MonthlySourceRail.tsx': monthlySourceRailSource,
  'MonthlyDecisionList.tsx': monthlyDecisionListSource,
  'MonthlyDestinationPicker.tsx': monthlyDestinationPickerSource,
  'MonthlyContextRail.tsx': monthlyContextRailSource,
}

describe('AC8 — zero literal estrutural/cromático nos componentes novos do Monthly', () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    it(`${name} não escreve nenhum dos literais reservados a tokens`, () => {
      for (const literal of FORBIDDEN_LITERALS) {
        const pattern = new RegExp(`\\b${literal.replace('.', '\\.')}\\b`)
        expect(source).not.toMatch(pattern)
      }
    })

    it(`${name} não escreve cor hexadecimal literal`, () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    })

    // Achado de revisão: `FORBIDDEN_LITERALS` acima não pode incluir um `\b7\b`
    // genérico (colide com prosa legítima em comentários, ex. "7 colunas"); o
    // literal estrutural real é o `7` dentro de `repeat(7, ...)` do CSS grid —
    // checado à parte, contra o padrão exato que viola AC8.
    it(`${name} não escreve o literal de colunas 7 em repeat()`, () => {
      expect(source).not.toMatch(/repeat\(\s*7\s*,/)
    })
  }
})
