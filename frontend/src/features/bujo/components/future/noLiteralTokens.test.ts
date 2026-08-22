import { describe, expect, it } from 'vitest'

// `?raw` traz o código-fonte como string (molde de `weekly/` + `monthly/`) —
// prova estrutural de AC8: nenhum componente novo do Future Log escreve os
// literais reservados a `futureBoard` (ou aos tokens compartilhados
// `taskRow`/`weeklyBoard.terminalOpacity`).
import futureHorizonTrailSource from './FutureHorizonTrail.tsx?raw'
import futureMonthPickerSource from './FutureMonthPicker.tsx?raw'
import futureCaptureFormSource from './FutureCaptureForm.tsx?raw'
import futureHorizonSource from './futureHorizon.ts?raw'

const FORBIDDEN_LITERALS = ['230px', '268px', '240px', '235px', '0.58', '36px', '48px', '3px']

const SOURCES: Record<string, string> = {
  'FutureHorizonTrail.tsx': futureHorizonTrailSource,
  'FutureMonthPicker.tsx': futureMonthPickerSource,
  'FutureCaptureForm.tsx': futureCaptureFormSource,
  'futureHorizon.ts': futureHorizonSource,
}

describe('AC8 — zero literal estrutural/cromático nos componentes novos do Future Log', () => {
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

    // O `8` do horizonte tem o MESMO perfil do `7` de colunas que a 14.6
    // registrou: um `\b8\b` global colidiria com prosa legítima nos comentários
    // ("os 8 meses seguintes"). O guard aponta para os PADRÕES DE USO concretos
    // que violariam AC8 — `futureBoard.horizonMonths` é a única fonte do número.
    it(`${name} não materializa o horizonte com o literal 8`, () => {
      expect(source).not.toMatch(/\{\s*length:\s*8\b/)
      expect(source).not.toMatch(/horizon\w*\s*[:=]\s*8\b/i)
      expect(source).not.toMatch(/\.slice\(\s*0\s*,\s*8\s*\)/)
    })
  }
})
