import { describe, expect, it } from 'vitest'

// Guard ESTRUTURAL da subpasta `record/` (Story 16.1, molde byte-a-byte de
// `bujo/components/recurring/noLiteralTokens.test.ts`): `?raw` traz o
// código-fonte como string e prova que nenhum arquivo novo escreve cor
// hexadecimal nem medida que TEM token e CSS var próprios.
//
// A CASCA da superfície (`pages/habits/HabitsRecordPage.tsx`) tem o guard
// GÊMEO em `pages/habits/noLiteralTokens.test.ts` — guard assimétrico entre
// irmãos dá falsa sensação de cobertura (lição da Retro do Épico 13 sobre
// `ShellSidebar` × `ShellBottomNav`). Ele mora lá, e não aqui, porque o lint
// proíbe `features/` importar de `pages/`.
import completionBarSource from './CompletionBar.tsx?raw'
import domainIconSource from './DomainIcon.tsx?raw'
import habitCompletionGridSource from './HabitCompletionGrid.tsx?raw'
import habitGroupCardSource from './HabitGroupCard.tsx?raw'
import habitTrackerRowSource from './HabitTrackerRow.tsx?raw'
import habitsConfigPanelSource from './HabitsConfigPanel.tsx?raw'
import habitsFormControlsSource from './HabitsFormControls.tsx?raw'
import habitsFormStylesSource from './habitsFormStyles.ts?raw'
import habitsHistoryPanelSource from './HabitsHistoryPanel.tsx?raw'
import habitsSkeletonSource from './HabitsSkeleton.tsx?raw'
import habitsSurfaceSource from './habitsSurface.ts?raw'
import habitsTodayPanelSource from './HabitsTodayPanel.tsx?raw'

// Medidas que TÊM token e CSS var próprios — escrevê-las cruas é o defeito.
//   `44px`   = `--ds-habit-tracker-row-control-column` / `--ds-touch-target-min`
//   `104px`  = `--ds-habit-tracker-row-numeric-field-width`
//   `520px`  = `--ds-record-cards-card-min-width`
//   `1120px` = `--ds-record-cards-max-width`
//   `8px`    = `--ds-completion-bar-height-day` / `--ds-space-2`
//   `6px`    = `--ds-completion-bar-height-group` / `--ds-radius-md`
//   `36px`   = `--ds-task-row-min-height-pointer`
//   `48px`   = `--ds-task-row-min-height-touch`
//   `20px`   = `--ds-domain-icon-size-default`
//   `18px`   = `--ds-domain-icon-size-compact`
//   `0.58`   = `--ds-task-row-terminal-opacity`
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
  'CompletionBar.tsx': completionBarSource,
  // DW-60: novo arquivo da subpasta ⇒ entra no guard no MESMO diff. Guard
  // assimétrico é falsa cobertura (lição da Retro do Épico 13).
  'DomainIcon.tsx': domainIconSource,
  'HabitCompletionGrid.tsx': habitCompletionGridSource,
  'HabitGroupCard.tsx': habitGroupCardSource,
  'HabitTrackerRow.tsx': habitTrackerRowSource,
  'HabitsConfigPanel.tsx': habitsConfigPanelSource,
  'HabitsFormControls.tsx': habitsFormControlsSource,
  'habitsFormStyles.ts': habitsFormStylesSource,
  'HabitsHistoryPanel.tsx': habitsHistoryPanelSource,
  'HabitsSkeleton.tsx': habitsSkeletonSource,
  'habitsSurface.ts': habitsSurfaceSource,
  'HabitsTodayPanel.tsx': habitsTodayPanelSource,
}

// ── LITERAIS LEGÍTIMOS, documentados em vez de removidos da lista ────────────
//
// 1. `color-mix(in srgb, var(--ds-primary) calc(var(--p) * 1%), var(--ds-surface))`
//    e a custom property `--p` em `HabitCompletionGrid.tsx` são a RECEITA
//    verbatim do mockup aprovado (`key-habitos.html:220-222`), promovida a
//    `DESIGN.md#Grid/Calendar`. Não são medida nem cor literal: são a função
//    que DERIVA a cor de dois tokens (`--ds-primary` sobre `--ds-surface`) com
//    alpha igual à completude da própria célula. Nenhum token novo é criado, e
//    inventar `--ds-heatmap-*` congelaria uma escala que é contínua por
//    decisão de design.
// 2. `1px` (bordas) e `2px`/`3px` (indicador de aba selecionada e filete do
//    aviso/faixa) NÃO estão na lista porque não têm token dedicado para ESTE
//    papel — `--ds-legacy-seam-border-width` é do seam legado e
//    `--ds-task-row-category-border-width` é da borda de categoria, que esta
//    superfície explicitamente NÃO tem (`habit-tracker-row.category-border:
//    'none'`). Emprestá-los seria acoplamento acidental.
// 3. `12rem`/`14rem`/`18rem` nos `minmax()` de grid são pontos de quebra
//    RELATIVOS ao tamanho do texto, não medidas de design system.
describe('Story 16.1 — zero literal estrutural/cromático na subpasta `record/`', () => {
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

    it(`${name} não usa a paleta do tema MUI legado`, () => {
      // `theme.palette.*` e `color="primary"` são o dialeto ANTIGO; o teal de
      // marca reprova AA sobre `--ds-surface` (achado real do axe na 14.7).
      expect(source).not.toMatch(/theme\.palette/)
      expect(source).not.toMatch(/color="primary"/)
    })
  }
})

// O guard da 14.6 levou achado ALTO por NUNCA pegar nada. Estes testes são a
// prova de NÃO-VACUIDADE: o mecanismo reprova de fato quando o literal existe.
describe('Story 16.1 — o guard não é vacuoso', () => {
  it('reprova uma fonte que escreve uma medida com token (44px)', () => {
    const violador = "sx={{ width: '44px' }}"
    const pegou = FORBIDDEN_LITERALS.some((literal) =>
      new RegExp(`\\b${literal.replace('.', '\\.')}\\b`).test(violador),
    )
    expect(pegou).toBe(true)
  })

  it('reprova uma fonte que escreve cor hexadecimal', () => {
    expect("color: '#315F5A'").toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('reprova uma fonte que usa a paleta do tema MUI legado', () => {
    expect('color={theme.palette.primary.main}').toMatch(/theme\.palette/)
  })
})

// O `color-mix` da grade é EXIGIDO, não tolerado: se sumir, a escala contínua
// de tom (canal primário da leitura, `DESIGN.md#Grid/Calendar`) sumiu junto.
describe('Story 16.1 — a escala contínua de tom da grade existe', () => {
  it('HabitCompletionGrid deriva a cor da célula por color-mix sobre os tokens', () => {
    expect(habitCompletionGridSource).toContain('color-mix(in srgb, var(--ds-primary)')
    expect(habitCompletionGridSource).toContain('calc(var(--p) * 1%)')
    expect(habitCompletionGridSource).toContain('var(--ds-surface)')
  })
})

// Emoji: proibição do gate 16.0 (Q2). Nenhuma fonte da superfície nova pode
// LER o campo `emoticon` — nem para exibir, nem para enviar na criação.
describe('Story 16.1 — o emoji saiu da interface de Hábitos', () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    it(`${name} não lê nem escreve o campo emoticon`, () => {
      // Só menções em COMENTÁRIO são aceitas (documentam a decisão).
      const código = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
        .join('\n')
      expect(código).not.toMatch(/\bemoticon\b/)
    })
  }
})
