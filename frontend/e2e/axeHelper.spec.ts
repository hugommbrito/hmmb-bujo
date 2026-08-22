import { test, expect } from './fixtures'
import { waitForLayoutSettled } from './axeHelper'

// O gate axe passou a MEDIR O LAYOUT ASSENTADO (DW-16). Estes testes cobrem as
// três garantias que sustentam essa espera — nenhuma delas é observável pelos
// gates em si, que passam igual se a espera não fizer nada.
//
// `injectAnimation` cria a animação no estado exato que cada garantia precisa;
// `settleMs` mede a espera DENTRO da página, sem o round-trip do CDP no número.
async function injectAnimation(
  page: import('@playwright/test').Page,
  options: { className: string; durationMs: number; infinite: boolean },
): Promise<void> {
  await page.evaluate(({ className, durationMs, infinite }) => {
    const style = document.createElement('style')
    style.textContent =
      `@keyframes ${className}-kf { from { opacity: 1 } to { opacity: 0.4 } } ` +
      `.${className} { animation: ${className}-kf ${durationMs}ms linear ${infinite ? 'infinite' : '1'} }`
    document.head.append(style)
    const node = document.createElement('div')
    node.className = className
    node.textContent = 'animação de teste'
    document.body.append(node)
  }, options)
}

test.describe('waitForLayoutSettled (infra do gate axe)', () => {
  test('ESPERA animação finita em voo terminar', async ({ page }) => {
    await injectAnimation(page, { className: 'dw16-finite', durationMs: 400, infinite: false })

    const startedAt = Date.now()
    await waitForLayoutSettled(page, 5000)
    const elapsed = Date.now() - startedAt

    // Sem a espera, isto voltaria em poucos ms (só os 2 rAF).
    expect(elapsed).toBeGreaterThanOrEqual(300)
    expect(elapsed).toBeLessThan(4000)
  })

  test('IGNORA animação infinita e retorna muito antes do teto', async ({ page }) => {
    await injectAnimation(page, { className: 'dw16-spinner', durationMs: 1000, infinite: true })

    // Sanidade: a animação está de fato rodando e é infinita.
    const infiniteCount = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity).length,
    )
    expect(infiniteCount).toBeGreaterThan(0)

    const startedAt = Date.now()
    await waitForLayoutSettled(page, 5000)
    const elapsed = Date.now() - startedAt

    // Se a infinita entrasse na espera, o teto só liberaria em ~5000ms. Voltar
    // numa fração disso é a prova de que foi ignorada.
    expect(elapsed).toBeLessThan(1500)
  })

  test('animação CANCELADA no meio não estoura a espera (`finished` rejeita)', async ({ page }) => {
    await injectAnimation(page, { className: 'dw16-cancelled', durationMs: 4000, infinite: false })
    // Remover o nó CANCELA a animação: `finished` rejeita. Sem o `.catch` da
    // espera, o `page.evaluate` lançaria e reprovaria o gate com uma exceção sem
    // relação com acessibilidade.
    await page.evaluate(() => {
      setTimeout(() => document.querySelector('.dw16-cancelled')?.remove(), 200)
    })

    const startedAt = Date.now()
    await waitForLayoutSettled(page, 20_000)
    const elapsed = Date.now() - startedAt

    // Resolveu pelo CANCELAMENTO, não pelo teto (20s) nem pela duração (4s).
    expect(elapsed).toBeLessThan(3000)
  })
})
