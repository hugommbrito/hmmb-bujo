import { test, expect } from './fixtures'

// E2E de COMPORTAMENTO do shell novo (Story 13.1) num browser real — o
// complemento do `shell-a11y.spec.ts`, que cobre só o gate axe. Aqui ficam os
// contratos que jsdom (unit/Vitest) não consegue exercer de verdade: ordem de
// tabulação real, geometria computada (topbar 56px / workspace 1440px), atalhos
// de teclado contra o handling nativo do browser e persistência do seam/título
// através de navegação de fato.
//
// A fixture faz signup real por teste e cai em `/today` já dentro do shell novo
// (o registro `shellRouting.ts` monta o shell em todas as rotas autenticadas).

const SHELL_CONTENT_ID = 'conteudo-da-superficie'
const SEAM_TEXT = 'Esta área ainda usa a versão anterior.'

test.describe('Shell novo — comportamento (wide 1440×900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // G1 · AC4 — Bypass Blocks (WCAG 2.2 2.4.1). Tab real: o primeiro focável do
  // documento é o skip link; ativá-lo move o foco para o wrapper de conteúdo
  // (que NÃO é um <main> — o shell não introduz um segundo main).
  test('skip link é o primeiro focável e move o foco para o conteúdo', async ({ page }) => {
    await page.keyboard.press('Tab')

    const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skipLink).toBeFocused()

    await page.keyboard.press('Enter')

    const content = page.locator(`#${SHELL_CONTENT_ID}`)
    await expect(content).toBeFocused()
    // Alvo programático (tabindex=-1), não um landmark novo.
    await expect(content).toHaveAttribute('tabindex', '-1')
    await expect(page.locator(`main#${SHELL_CONTENT_ID}`)).toHaveCount(0)
  })

  // G2 · AC1 — "shell consome dela topbar 56px e workspace máx. 1440px". Só o
  // browser real tem layout: aqui a geometria computada confirma que os tokens
  // `--ds-*` chegam ao DOM (não só que a variável foi setada, como no unit).
  test('tokens estruturais aplicados: topbar 56px e workspace máx. 1440px', async ({ page }) => {
    const banner = page.getByRole('banner')
    await expect(banner).toBeVisible()

    const topbarHeight = await banner.evaluate((el) => el.getBoundingClientRect().height)
    // 56px do token (± a borda inferior de 1px, conforme box-sizing) — tolerância
    // curta o bastante para reprovar se a topbar deixar de consumir o token.
    expect(topbarHeight).toBeGreaterThanOrEqual(55)
    expect(topbarHeight).toBeLessThanOrEqual(58)

    const maxWidth = await page
      .locator(`#${SHELL_CONTENT_ID}`)
      .evaluate((el) => getComputedStyle(el).maxWidth)
    expect(maxWidth).toBe('1440px')

    // A geometria vem de custom properties `--ds-*` na raiz do shell, não de
    // literais cravados no componente (AC1: "zero literais estruturais").
    const topbarVar = await page
      .getByTestId('shell-root')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--ds-topbar-height').trim())
    expect(topbarVar).toBe('56px')
  })

  // G3 · AC4 + AC2 — a topbar mostra o nome da superfície (mesma fonte do
  // RouteAnnouncer) e ATUALIZA ao navegar; toda rota de núcleo monta o shell
  // novo (coexistência por rota, estado inicial `shell: 'new'`); e existe sempre
  // exatamente UM `main` por rota (nenhum segundo main introduzido pelo shell).
  test('topbar reflete a superfície e atualiza ao navegar, com um único main', async ({ page }) => {
    const banner = page.getByRole('banner')
    const nav = page.getByRole('navigation', { name: 'Navegação principal' })

    await expect(banner).toContainText('Hoje')
    await expect(page.getByRole('main')).toHaveCount(1)
    // A topbar é texto estático, nunca live region — o anúncio é exclusivo do
    // RouteAnnouncer (uma única region status na casca).
    await expect(banner).not.toHaveAttribute('aria-live')
    await expect(page.getByRole('status')).toHaveCount(1)

    await nav.getByText('Esta Semana').click()
    await expect(page).toHaveURL('/planner/week')
    await expect(banner).toContainText('Esta Semana')
    await expect(page.getByRole('main')).toHaveCount(1)

    await nav.getByText('Arquivo').click()
    await expect(page).toHaveURL('/archive')
    await expect(banner).toContainText('Arquivo')
    await expect(page.getByRole('main')).toHaveCount(1)
  })

  // G4 · AC4 — atalho `[` faz toggle da sidebar (colapsada esconde os rótulos),
  // preservado do AppLayout legado; e é ignorado quando o foco está num campo
  // editável (mesmo guard de hoje).
  test('atalho [ colapsa e reexpande a sidebar; ignorado em campo editável', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Navegação principal' })
    // Expandida: os rótulos de texto são renderizados.
    await expect(nav.getByText('Planner')).toBeVisible()

    await page.keyboard.press('[')
    // Colapsada: `ListItemText` deixa de ser renderizado (rótulos somem).
    await expect(nav.getByText('Planner')).toBeHidden()

    await page.keyboard.press('[')
    await expect(nav.getByText('Planner')).toBeVisible()

    // Guard: com o foco num input, `[` é digitação, não atalho.
    const novaTarefa = page.getByLabel('Nova tarefa')
    await novaTarefa.click()
    await page.keyboard.press('[')
    await expect(nav.getByText('Planner')).toBeVisible()
    await expect(novaTarefa).toHaveValue('[')
  })

  // G5 · AC4 — atalho `B` navega para o Brain Dump; ignorado com `Meta`/`Ctrl`
  // (senão sequestra Cmd+B/Ctrl+B do browser — risco #3 da story) e ignorado
  // dentro de campo editável.
  test('atalho B navega para o Brain Dump; ignorado com Meta e em campo editável', async ({ page }) => {
    // Guard 1: Meta+b não navega.
    await page.keyboard.press('Meta+b')
    await expect(page).toHaveURL('/today')

    // Guard 2: `b` dentro de um input é digitação, não navegação.
    const novaTarefa = page.getByLabel('Nova tarefa')
    await novaTarefa.click()
    await page.keyboard.type('b')
    await expect(page).toHaveURL('/today')
    await expect(novaTarefa).toHaveValue('b')

    // Fora de campo editável, `b` navega para o Brain Dump.
    await novaTarefa.blur()
    await page.keyboard.press('b')
    await expect(page).toHaveURL('/brain-dump')
    await expect(page.getByRole('banner')).toContainText('Brain Dump')
  })

  // G6 · AC3 — Seam A (faixa editorial): visível no início do conteúdo, texto
  // aprovado, SEM botão de dispensar, não é live region, e persiste ao navegar
  // (todas as superfícies ainda legadas nesta story ⇒ o seam nunca some aqui).
  test('seam legado é persistente, editorial e sem botão de dispensar', async ({ page }) => {
    const seam = page.getByRole('complementary')
    await expect(seam).toContainText(SEAM_TEXT)
    // Faixa editorial estática: não é live region e não tem controle de dispensar.
    await expect(seam).not.toHaveAttribute('aria-live')
    await expect(seam.getByRole('button')).toHaveCount(0)

    // Persiste em outra rota (também legada nesta story).
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Esta Semana').click()
    await expect(page).toHaveURL('/planner/week')
    await expect(page.getByRole('complementary')).toContainText(SEAM_TEXT)
  })
})

test.describe('Shell novo — comportamento (compact 320×720)', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  // G7 · AC4 — regressão de contrato: o mobile do AppLayout legado NÃO tinha
  // topbar. No shell novo a topbar passa a existir no compact, a ShellBottomNav
  // ("Atalhos de navegação" — troca contratada de landmark na 13.3) é
  // renderizada e o skip link continua sendo o primeiro focável.
  test('compact: topbar passa a existir, bottom nav presente e skip link primeiro focável', async ({ page }) => {
    await expect(page.getByRole('banner')).toContainText('Hoje')
    await expect(page.getByRole('navigation', { name: 'Atalhos de navegação' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()

    // O seam também aparece no compact (superfície ainda legada).
    await expect(page.getByRole('complementary')).toContainText(SEAM_TEXT)
  })
})
