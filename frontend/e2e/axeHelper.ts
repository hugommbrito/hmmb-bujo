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
 * Espera o layout ASSENTAR antes de medir acessibilidade: fontes carregadas,
 * animações/transições CSS FINITAS em voo concluídas, e um `requestAnimationFrame`
 * duplo para o browser aplicar o layout final.
 *
 * Por quê: medir logo depois do `toBeVisible()` do `main` pega um frame
 * INTERMEDIÁRIO — a sidebar ainda animando largura, o `Collapse` do submenu
 * (MUI, `timeout="auto"`) ainda abrindo — e o axe mede geometria de transição.
 * É a mesma classe de problema que `migration-ritual.spec.ts:220` contorna com
 * um `waitForTimeout(300)` fixo; aqui a espera é determinística (o que está DE
 * FATO em voo, não um número mágico). Aquele spec segue com o número fixo: está
 * fora do escopo da DW-16 e é dívida registrada, não substituição feita.
 *
 * ESCOPO (medido na DW-16): cobre só o que o browser tem em voo — fontes e
 * animações/transições CSS. NÃO espera dados (React Query) nem o re-render que
 * eles disparam. Um gate cujo alvo só aparece depois da resposta de rede tem
 * que esperar esse alvo ANTES de chamar esta função (é o que
 * `weekly-planning-ritual.spec.ts`/`monthly-planning-ritual.spec.ts` fazem em
 * `waitForRitualHydrated`).
 *
 * NUNCA pendura a suíte: só entram na espera as animações que PODEM terminar
 * (fora as infinitas dos spinners, as pausadas e as sem `effect` — nenhuma delas
 * resolve `finished`), e o teto `timeoutMs` é um orçamento TOTAL das esperas.
 * Não silencia regra nenhuma: o gate continua medindo o estado final com o mesmo
 * ruleset.
 */
export async function waitForLayoutSettled(page: Page, timeoutMs = 1000): Promise<void> {
  await page.evaluate(async (budgetMs) => {
    const startedAt = Date.now()
    const remaining = () => Math.max(0, budgetMs - (Date.now() - startedAt))
    // Cada espera corre contra o que SOBRA do orçamento — o teto vale para o
    // conjunto, não por etapa.
    const capped = (work: Promise<unknown>) =>
      Promise.race([work, new Promise((resolve) => setTimeout(resolve, remaining()))])

    // Só animação que PODE terminar: infinita nunca termina, e `paused`/sem
    // `effect` também não resolvem `finished` — esperar por elas queimaria o
    // orçamento inteiro à toa.
    const inFlight = () =>
      document.getAnimations().filter((animation) => {
        if (animation.playState !== 'running') return false
        const timing = animation.effect?.getComputedTiming()
        return timing != null && timing.iterations !== Infinity
      })

    await capped(document.fonts.ready)

    // Relê a lista a cada volta em vez de tirar um snapshot único: o `Collapse`
    // do MUI MEDE antes de começar, e todo re-render inicia sua transição num
    // frame POSTERIOR — um snapshot perderia exatamente essas.
    while (remaining() > 0) {
      const running = inFlight()
      if (running.length === 0) break
      // `finished` REJEITA quando a animação é cancelada (ex.: re-render no
      // meio da transição) — engolir a rejeição mantém a espera cooperativa.
      await capped(Promise.all(running.map((animation) => animation.finished.catch(() => undefined))))
      // Um frame antes de reavaliar: evita laço quente quando uma animação
      // termina no exato instante da leitura.
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }

    // FORA do orçamento, SEMPRE: são estes 2 frames que fazem o browser aplicar
    // o layout final — a garantia central desta função. Se ficassem sob o teto,
    // um orçamento esgotado pelas etapas anteriores devolveria exatamente a
    // medição não-assentada que ela existe para impedir.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }, timeoutMs)
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
