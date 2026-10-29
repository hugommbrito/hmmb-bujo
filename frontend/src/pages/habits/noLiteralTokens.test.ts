import { describe, expect, it } from 'vitest'

// Guard GÊMEO do de `features/habits/components/record/noLiteralTokens.test.ts`,
// para a CASCA da superfície de Hábitos (Story 16.1). Mora aqui, e não junto do
// outro, porque o lint proíbe `features/` importar de `pages/` — e deixar a
// página sem guard daria a mesma falsa sensação de cobertura que a Retro do
// Épico 13 registrou.
import habitsRecordPageSource from './HabitsRecordPage.tsx?raw'
import habitHistoryRedirectSource from './HabitHistoryRedirect.tsx?raw'

const FORBIDDEN_LITERALS = [
  '44px',
  '104px',
  '520px',
  '1120px',
  '8px',
  '6px',
  '36px',
  '48px',
  '20px',
  '18px',
  '0.58',
]

const SOURCES: Record<string, string> = {
  'HabitsRecordPage.tsx': habitsRecordPageSource,
  'HabitHistoryRedirect.tsx': habitHistoryRedirectSource,
}

// LITERAL LEGÍTIMO documentado: `2px` (indicador da aba selecionada) e `3px`
// (filete da faixa de offline) não têm token para ESTE papel —
// `--ds-legacy-seam-border-width` é do seam legado e
// `--ds-task-row-category-border-width` é da borda de categoria, que esta
// superfície explicitamente NÃO tem.
describe('Story 16.1 — zero literal estrutural/cromático na casca da superfície', () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    it(`${name} não escreve nenhum dos literais reservados a tokens`, () => {
      for (const literal of FORBIDDEN_LITERALS) {
        expect(source).not.toMatch(new RegExp(`\\b${literal.replace('.', '\\.')}\\b`))
      }
    })

    it(`${name} não escreve cor hexadecimal nem usa a paleta do tema MUI legado`, () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(source).not.toMatch(/theme\.palette/)
      expect(source).not.toMatch(/color="primary"/)
    })
  }
})

describe('Story 16.1 — o guard da casca não é vacuoso', () => {
  it('reprova uma fonte que escreve uma medida com token (1120px)', () => {
    const violador = "sx={{ maxWidth: '1120px' }}"
    expect(
      FORBIDDEN_LITERALS.some((literal) =>
        new RegExp(`\\b${literal.replace('.', '\\.')}\\b`).test(violador),
      ),
    ).toBe(true)
  })

  it('reprova uma fonte que escreve cor hexadecimal', () => {
    expect("background: '#F5F2EA'").toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
