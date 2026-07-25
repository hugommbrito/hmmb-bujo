import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

// Piso de acessibilidade do projeto = WCAG 2.2 AA (EXPERIENCE.md §Accessibility
// Floor). Usamos as tags WCAG explícitas em vez do ruleset default do axe para
// alinhar o gate exatamente a esse piso — o default do axe inclui regras de
// "best-practice" fora do contrato e omite parte de 2.2.
export const WCAG_2_2_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
] as const

interface RunAxeOptions {
  /**
   * Restringe a análise a um seletor (ex.: o chrome do shell). A Story 13.1
   * mede o SHELL; violações preexistentes do conteúdo legado ficam registradas
   * como dívida no `13-shell-parity-checklist.md` para a Story 13.4 — nunca
   * silenciadas globalmente.
   */
  include?: string
  /**
   * Exclui um ou mais seletores da análise. Usado desde a Story 13.1 para tirar
   * o `<main>` da página legada do escopo (SHELL-DEBT-02, migrada onda a onda),
   * mantendo o chrome do shell — topbar, sidebar/bottom nav, skip link e seam —
   * sob o gate.
   *
   * A Story 13.4 aceita LISTA porque uma superfície legada pode ficar FORA do
   * `<main>`: o `BrainDumpCaptureSheet` é portalizado pelo MUI, então a mesma
   * dívida de conteúdo legado precisa do mesmo tratamento por um segundo
   * seletor. É extensão de escopo da SHELL-DEBT-02, não regra silenciada —
   * `disableRules` continua não existindo no repo, e cada exclusão é explícita
   * no spec e registrada no checklist de paridade.
   */
  exclude?: string | string[]
  /** Rótulo do contexto (viewport/rota) para a mensagem de falha. */
  label?: string
}

/**
 * Roda axe numa página e falha com o DETALHE das violações (id, impacto,
 * seletores, ajuda) — mensagem acionável, não um `expect([]).toEqual([])` cru
 * que só diz "esperava array vazio".
 *
 * Helper reutilizável e base para a Story 13.4, que amplia para a matriz
 * wide/medium/compact completa.
 */
export async function expectNoAxeViolations(page: Page, options: RunAxeOptions = {}): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_2_2_AA_TAGS])
  if (options.include) {
    builder = builder.include(options.include)
  }
  for (const selector of [options.exclude ?? []].flat()) {
    builder = builder.exclude(selector)
  }

  const results = await builder.analyze()

  if (results.violations.length > 0) {
    const context = options.label ? ` (${options.label})` : ''
    const detail = results.violations
      .map((violation) => {
        const nodes = violation.nodes
          .map((node) => `      · ${node.target.join(' ')}`)
          .join('\n')
        return (
          `  [${violation.impact ?? 'sem impacto'}] ${violation.id}: ${violation.help}\n` +
          `    ${violation.helpUrl}\n${nodes}`
        )
      })
      .join('\n')

    expect(
      results.violations.length,
      `axe encontrou ${results.violations.length} violação(ões) WCAG 2.2 AA${context}:\n${detail}`,
    ).toBe(0)
  }
}
