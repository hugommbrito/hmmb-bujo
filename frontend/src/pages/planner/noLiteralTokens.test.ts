import { describe, expect, it } from 'vitest'

// `?raw` traz o código-fonte como string (molde de `shellRouting.test.ts`) —
// prova estrutural de AC8 para as páginas novas (o guardrail dos componentes
// vive em `features/bujo/components/weekly/noLiteralTokens.test.ts` — imports
// inter-camada não podem cruzar `pages/` <- `features/`, então são arquivos
// separados).
import weeklyBoardPageSource from './WeeklyBoardPage.tsx?raw'
import weeklyPlanningPageSource from './WeeklyPlanningPage.tsx?raw'
import monthlyBoardPageSource from './MonthlyBoardPage.tsx?raw'
import monthlyPlanningPageSource from './MonthlyPlanningPage.tsx?raw'

const FORBIDDEN_LITERALS = [
  '240px',
  '235px',
  '315px',
  '190px',
  '268px',
  '188px',
  '310px',
  '0.58',
  '36px',
  '48px',
  '3px',
]

const SOURCES: Record<string, string> = {
  'WeeklyBoardPage.tsx': weeklyBoardPageSource,
  'WeeklyPlanningPage.tsx': weeklyPlanningPageSource,
  'MonthlyBoardPage.tsx': monthlyBoardPageSource,
  'MonthlyPlanningPage.tsx': monthlyPlanningPageSource,
}

describe('AC8 — zero literal estrutural/cromático nas páginas novas', () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    it(`${name} não escreve nenhum dos 8 literais reservados a tokens`, () => {
      for (const literal of FORBIDDEN_LITERALS) {
        const pattern = new RegExp(`\\b${literal.replace('.', '\\.')}\\b`)
        expect(source).not.toMatch(pattern)
      }
    })

    it(`${name} não escreve cor hexadecimal literal`, () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    })
  }
})
