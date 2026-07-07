import { test as base, expect, type Page } from '@playwright/test'

// Um usuário novo por teste (signup real via UI) garante um Daily Log de hoje
// vazio e isola os testes entre si — nenhum reaproveita tarefas de outro.
async function signUpAndLandOnToday(page: Page) {
  const email = `e2e-${crypto.randomUUID()}@e2e.test`
  const password = 'SenhaE2e!2026'

  await page.goto('/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page).toHaveURL('/today')
  await expect(page.getByText('Nenhuma tarefa para hoje.')).toBeVisible()
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await signUpAndLandOnToday(page)
    await use(page)
  },
})

export { expect }

// Toda mutação de tarefa é otimista (useOptimisticMutation): a UI mostra o
// resultado com um id temporário no mesmo instante, e só depois de
// onSettled → invalidateQueries o cache é substituído pelo id real do
// servidor (ver Dev Notes da story 3.3, `mapTaskTree`). Ações subsequentes
// que dependem do id real (abrir detalhe, criar subtarefa, ciclar status)
// precisam esperar esse refetch — senão usam o id temporário e o backend
// responde 404.
export async function syncAfter(page: Page, action: () => Promise<void>) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/bujo/logs/today/') &&
        response.request().method() === 'GET' &&
        response.ok(),
    ),
    action(),
  ])
}

export function detailPanel(page: Page) {
  return page.locator('.MuiDrawer-paper').filter({ hasText: 'Detalhe da tarefa' })
}
