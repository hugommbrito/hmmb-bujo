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
import futureBoardPageSource from './FutureBoardPage.tsx?raw'
import recurringLibraryPageSource from './RecurringLibraryPage.tsx?raw'

const FORBIDDEN_LITERALS = [
  '230px',
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
  // Story 14.8 (M09): `44px` tem token e CSS var próprios
  // (`--ds-touch-target-min`) — escrevê-lo cru é o mesmo defeito que os
  // demais literais desta lista.
  '44px',
]

const SOURCES: Record<string, string> = {
  'WeeklyBoardPage.tsx': weeklyBoardPageSource,
  'WeeklyPlanningPage.tsx': weeklyPlanningPageSource,
  'MonthlyBoardPage.tsx': monthlyBoardPageSource,
  'MonthlyPlanningPage.tsx': monthlyPlanningPageSource,
  'FutureBoardPage.tsx': futureBoardPageSource,
  'RecurringLibraryPage.tsx': recurringLibraryPageSource,
}

describe('AC8 — zero literal estrutural/cromático nas páginas novas', () => {
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

    // Story 14.7, AC8: o `8` do horizonte tem o mesmo perfil do `7` de colunas
    // (achado ALTO da 14.6) — um `\b8\b` global colidiria com prosa legítima
    // nos comentários. O guard aponta para os PADRÕES DE USO concretos:
    // `futureBoard.horizonMonths` é a única fonte do número no cliente.
    it(`${name} não materializa o horizonte com o literal 8`, () => {
      expect(source).not.toMatch(/\{\s*length:\s*8\b/)
      expect(source).not.toMatch(/horizon\w*\s*[:=]\s*8\b/i)
      expect(source).not.toMatch(/\.slice\(\s*0\s*,\s*8\s*\)/)
    })
  }
})
