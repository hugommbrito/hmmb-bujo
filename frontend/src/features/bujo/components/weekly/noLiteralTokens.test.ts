import { describe, expect, it } from 'vitest'

// `?raw` traz o código-fonte como string (molde de `shellRouting.test.ts`) —
// prova estrutural de AC8: "nenhum componente novo escreve 240px, 235px,
// 315px, 190px, 0.58, 36px, 48px ou 3px — todo valor estrutural/cromático vem
// de `var(--ds-*)`". Também cobre os componentes das Tasks 2/3/6/7.
import taskRowBaseSource from '../TaskRowBase.tsx?raw'
import taskDetailCardSource from '../TaskDetailCard.tsx?raw'
import weeklyTaskPanelSource from './WeeklyTaskPanel.tsx?raw'
import weeklyRowOverflowMenuSource from './WeeklyRowOverflowMenu.tsx?raw'
import weeklySourceRailSource from './WeeklySourceRail.tsx?raw'
import weeklyDecisionListSource from './WeeklyDecisionList.tsx?raw'
import weeklyContextRailSource from './WeeklyContextRail.tsx?raw'

const FORBIDDEN_LITERALS = ['240px', '235px', '315px', '190px', '0.58', '36px', '48px', '3px']

const SOURCES: Record<string, string> = {
  'TaskRowBase.tsx': taskRowBaseSource,
  'TaskDetailCard.tsx': taskDetailCardSource,
  'WeeklyTaskPanel.tsx': weeklyTaskPanelSource,
  'WeeklyRowOverflowMenu.tsx': weeklyRowOverflowMenuSource,
  'WeeklySourceRail.tsx': weeklySourceRailSource,
  'WeeklyDecisionList.tsx': weeklyDecisionListSource,
  'WeeklyContextRail.tsx': weeklyContextRailSource,
}

describe('AC8 — zero literal estrutural/cromático nos componentes novos', () => {
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
