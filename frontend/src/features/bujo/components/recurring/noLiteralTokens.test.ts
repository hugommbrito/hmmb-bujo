import { describe, expect, it } from 'vitest'

// `?raw` traz o código-fonte como string (molde byte-a-byte de `future/`) —
// prova estrutural de AC7: nenhum componente novo da M09 escreve os literais
// reservados a tokens, nem cor hexadecimal. Cobre também os TRÊS componentes de
// raiz que nascem fora desta pasta (`ItemRowBase`, `TemplateDetailCard` e os
// dois controles canônicos extraídos): eles não têm guardrail próprio em lugar
// nenhum, e um guard assimétrico entre irmãos dá falsa sensação de cobertura
// (lição da Retro do Épico 13 sobre `ShellSidebar` × `ShellBottomNav`).
import recurringGroupTabsSource from './RecurringGroupTabs.tsx?raw'
import templateLibraryListSource from './TemplateLibraryList.tsx?raw'
import recurringLibrarySkeletonSource from './RecurringLibrarySkeleton.tsx?raw'
import recurringLibrarySource from './recurringLibrary.ts?raw'
import itemRowBaseSource from '../ItemRowBase.tsx?raw'
import templateDetailCardSource from '../TemplateDetailCard.tsx?raw'
import categorySwatchGroupSource from '../CategorySwatchGroup.tsx?raw'
import eisenhowerCheckboxPairSource from '../EisenhowerCheckboxPair.tsx?raw'

// Medidas que TÊM token e CSS var próprios — escrevê-las cruas é o defeito.
// `36px`/`48px` = `--ds-task-row-min-height-pointer`/`-touch`; `3px` =
// `--ds-task-row-category-border-width`; `0.58` = `--ds-task-row-terminal-opacity`;
// `20px` = `--ds-task-row-status-icon-size`; `24px` = `--ds-chip-height`;
// `230px`/`240px`/`235px`/`268px` = larguras de board de outras superfícies
// (emprestá-las aqui seria acoplamento acidental).
const FORBIDDEN_LITERALS = [
  '36px',
  '48px',
  '3px',
  '0.58',
  '20px',
  '24px',
  '230px',
  '240px',
  '235px',
  '268px',
]

const SOURCES: Record<string, string> = {
  'RecurringGroupTabs.tsx': recurringGroupTabsSource,
  'TemplateLibraryList.tsx': templateLibraryListSource,
  'RecurringLibrarySkeleton.tsx': recurringLibrarySkeletonSource,
  'recurringLibrary.ts': recurringLibrarySource,
  'ItemRowBase.tsx': itemRowBaseSource,
  'TemplateDetailCard.tsx': templateDetailCardSource,
  'CategorySwatchGroup.tsx': categorySwatchGroupSource,
  'EisenhowerCheckboxPair.tsx': eisenhowerCheckboxPairSource,
}

// LITERAL LEGÍTIMO, documentado em vez de removido da lista (AC7 é explícita:
// "a saída é documentar no guard POR QUE, nunca remover o literal da lista"):
// `CategorySwatchGroup.tsx` desenha o swatch em `28px`/`28px`. Esse valor NÃO
// está na lista acima porque `28px` não tem token nem CSS var — é a medida do
// próprio swatch, que o `DESIGN.md` não emite. Ele veio intacto do
// `TaskDetailCard` na extração (a Task 1 proíbe mudança de comportamento) e um
// token novo é proibido pela AC7. Fica registrado aqui como decisão, não como
// omissão. O mesmo vale para o `'28px'` que já existia no código de origem.
describe('AC7 — zero literal estrutural/cromático nos componentes novos da M09', () => {
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
  }
})

// O guard da 14.6 levou achado ALTO por NUNCA pegar nada. Estes dois testes são
// a prova de não-vacuidade: o mecanismo reprova de fato quando o literal existe.
describe('AC7 — o guard não é vacuoso', () => {
  it('reprova uma fonte que escreve uma medida com token (36px)', () => {
    const violador = "sx={{ minHeight: '36px' }}"
    const pegou = FORBIDDEN_LITERALS.some((literal) =>
      new RegExp(`\\b${literal.replace('.', '\\.')}\\b`).test(violador),
    )
    expect(pegou).toBe(true)
  })

  it('reprova uma fonte que escreve cor hexadecimal', () => {
    expect("color: '#0f766e'").toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
