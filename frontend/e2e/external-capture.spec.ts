import { test, expect } from './fixtures'
import { issueAutomationToken } from './seedAutomationToken'

// Cobre a Story 12.5 (captura externa `POST /api/capture`) ponta-a-ponta, pelo
// ÚNICO efeito visível ao usuário (AC2): um item capturado POR FORA — via token
// de automação, fora da sessão do browser, como o atalho "Back Tap" do iPhone —
// aparece no Brain Dump legado do dono (lista + badge), na sessão JWT normal.
//
// Por que este E2E existe (e não é redundante com o pytest de `automation/`):
// a suíte pytest (40 testes) já prova o contrato de API ponta-a-ponta
// (201/400/401/403/429, token real, tenant context, log de auditoria) e que,
// no nível de API, o `GET /api/brain-dump/items/` do dono retorna o item. O que
// NENHUM teste cobria é a travessia canal-externo → UI-real-do-dono: um POST
// HTTP externo com Bearer surgindo na tela do Brain Dump que o usuário de fato
// olha. É exatamente a promessa da story ("Para que o Back Tap do iPhone jogue
// pensamentos direto no Brain Dump"). O `brain-dump.spec.ts` prova a renderização
// só para itens capturados PELA própria UI; aqui a origem é externa.
//
// Robustez (não frágil): o token é emitido pelo padrão `runShell` já usado por
// 10+ seeds; a captura é um único `request.post` HTTP real (sem interação de UI
// no lado da captura — fiel ao atalho; sem CSRF, a view usa só token auth); e o
// refetch é DETERMINÍSTICO via `page.goto('/brain-dump')` (load completo → lista
// e badge refazem a query no boot, sem depender de refetch em background). O
// isolamento entre tenants NÃO é reexercitado aqui (o pytest já o cobre
// exaustivamente) — este spec foca no efeito visível novo.

// Backend real do E2E (mesmo `runserver` da branch Neon `e2e` que serve a UI —
// ver `playwright.config.ts`). A captura externa fala HTTP direto com ele, sem
// passar pelo browser, como um cliente de automação externo faria.
const CAPTURE_URL = 'http://localhost:8000/api/capture'

test('captura externa por token aparece no Brain Dump do dono — lista e badge (AC2)', async ({
  page,
  email,
  request,
}) => {
  // Operador emite um token com escopo `capture` para o usuário recém-criado
  // (fora da UI — não há tela de emissão de token; Story 12.4).
  const { full } = issueAutomationToken(email)

  // O "iPhone" dispara a captura: um POST externo, autenticado por Bearer, fora
  // da sessão do browser. Resposta curta 201 `{ id }` (contrato AD-19), provada
  // aqui contra o servidor real (o pytest prova via DRF test client).
  const resp = await request.post(CAPTURE_URL, {
    headers: { Authorization: `Bearer ${full}` },
    data: { type: 'braindump', text: 'Capturado pelo Back Tap do iPhone' },
  })
  expect(resp.status()).toBe(201)
  expect((await resp.json()).id).toBeTruthy()

  // Load completo do app já na página do Brain Dump → lista e badge refazem a
  // query no boot (o "próximo refetch" do AC2), sem depender de timing.
  await page.goto('/brain-dump')
  await expect(page.getByRole('main', { name: 'Brain Dump', exact: true })).toBeVisible()

  // O item capturado por fora está na caixa de entrada do dono (superfície
  // legada, AD-19) e o estado vazio sumiu.
  await expect(page.getByText('Capturado pelo Back Tap do iPhone')).toBeVisible()
  await expect(page.getByText('Brain Dump vazio.')).toHaveCount(0)

  // O badge da sidebar reflete o novo item (contagem como server state derivado,
  // AD-13) — o load completo é o refetch que o materializa.
  await expect(page.getByRole('button', { name: 'Brain Dump' }).getByText('1')).toBeVisible()
})
