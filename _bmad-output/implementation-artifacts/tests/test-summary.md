# Resumo de Automação de Testes — Story 12.3

**Data:** 2026-07-23
**Story:** 12.3 — Manifest de collections (fatia 1, pixel-idêntico)
**Framework:** Vitest 4.1 (unit) + Playwright (E2E, projeto `chromium`)
**Executor:** workflow `bmad-qa-generate-e2e-tests` (QA automation)

---

## Decisão: NENHUM teste E2E novo gerado (com justificativa)

Esta story é um **refactor de contrato pixel-idêntico** (AC4): extrai o manifest
estático `app/collections/registry.ts` e faz Sidebar/BottomNav/rotas de collection
**derivarem** dele, com **zero mudança visível ou comportamental**. Não há
**nenhuma nova superfície ou fluxo de usuário** para exercitar.

Aplicando o julgamento do próprio workflow ("Keep It Simple" / gerar testes apenas
para comportamento implementado) e o contrato da AC4 ("a suíte passa **sem update**
e sem mocks novos"), **fabricar E2E aqui seria contraproducente**: violaria o aceite
mecânico da story (nenhum teste novo, nenhum mock novo) e criaria cobertura
redundante para comportamento que já é a rede de segurança pré-existente.

O **gate desta fatia é a suíte verde existente**, não testes novos.

---

## Verificação do gate (executada nesta sessão)

| Camada | Comando | Resultado |
|---|---|---|
| Unit (Vitest) | `nvm use 22.15.1 && npm run test:run` | **81 arquivos / 828 testes — todos verdes** (107s) |

Idêntico ao baseline pré-refactor registrado na story (81 / 828). Confirma que a
derivação a partir do registro é comportamentalmente indistinguível do hardcode
anterior.

> E2E (Playwright): as specs de navegação **não foram alteradas** e permanecem o
> gate E2E. Não foram reexecutadas nesta sessão — exigem backend + branch Neon
> `e2e` provisionada (setup de integração, não pré-requisito da geração de testes),
> e a story não introduz fluxo novo que as tornasse insuficientes.

---

## Mapa de cobertura das superfícies refatoradas

As superfícies tocadas pelo refactor (rotas de collection, itens de Sidebar, abas
de BottomNav) **já são exercitadas** pela suíte existente — inalterada:

### Rotas de collection derivadas (`collections.flatMap(c => c.routes)`)

| Rota derivada | Cobertura E2E existente |
|---|---|
| `/gratitude`, `/gratitude` (aba Histórico) | `e2e/gratitude.spec.ts`, `e2e/gratitude-history.spec.ts` (`goto` + assert de `<main>`) |
| `/health/metrics` (+ histórico) | `e2e/health-metrics.spec.ts`, `e2e/health-history.spec.ts` |
| `/health/medications` (+ histórico) | `e2e/medications.spec.ts`, `e2e/medications-day.spec.ts`, `e2e/medications-history.spec.ts` |
| `/habits` (+ `/habits/history`) | `e2e/habit-tracker.spec.ts`, `e2e/habit-history.spec.ts` |

### Navegação derivada (Sidebar / BottomNav)

| Superfície | Cobertura existente |
|---|---|
| Sidebar → clique em **"Gratidão"** abre o diário | `e2e/gratitude.spec.ts:177` (clique real no item de Sidebar derivado do registro) |
| Sidebar → clique em **"Hábitos"** | `e2e/habit-history.spec.ts:36` (clique real no item de Sidebar) |
| BottomNav (mobile, viewport 390×844) | `e2e/brain-dump.spec.ts:109` exercita o swap Sidebar→BottomNav por viewport |
| Sidebar/BottomNav/router/RouteAnnouncer/AppLayout | `src/app/layout/{Sidebar,BottomNav,AppLayout,RouteAnnouncer}.test.tsx` + `src/app/router.test.tsx` (comportamental, `getByRole`/`getByText` + `jest-axe`) — parte dos 828 verdes |

### Checkpoint do Risco crítico (React.lazy × RouteAnnouncer mobile)

`RouteAnnouncer.test.tsx › mobile › test_anuncia_mudanca_de_superficie_ao_navegar_via_bottom_nav`
passou **sem edição** — o `<main aria-label="Hábitos">` monta sincronamente sob
`act` após `await user.click`. Sem escalação (consistente com o Dev Agent Record).

---

## Lacunas avaliadas (e por que NÃO foram preenchidas)

- **Clique de Sidebar em "Métricas"/"Medicamentos" via E2E** — só há `goto` direto
  em E2E, não clique de navegação. **Não preenchido:** já coberto no nível unit por
  `Sidebar.test.tsx`; adicionar E2E seria comportamento novo além do escopo
  pixel-idêntico (AC4). Redundante, não uma lacuna real.
- **Clique nas abas de BottomNav ("Hábitos"/"Saúde") via E2E** — **Não preenchido:**
  coberto por `BottomNav.test.tsx` (unit). Mesmo raciocínio.

Nenhuma lacuna preenchível sem fabricar comportamento inexistente. Preencher
qualquer uma quebraria o aceite mecânico da AC4 (nenhum teste/mocks novos).

---

## Validação contra o checklist

- Testes de API gerados — **N/A** (entrega 100% frontend; sem backend/endpoints).
- Testes E2E gerados — **intencionalmente nenhum** (sem novo comportamento de
  usuário; justificado acima).
- Suíte roda com sucesso — **✅ 828/828 verdes** (executado nesta sessão).
- Locators semânticos / sem waits fixos / testes independentes — herdado da suíte
  existente inalterada (`getByRole`/`getByText`).
- Resumo criado com métricas de cobertura — **este documento**.

---

## Próximos passos

- Consumidores **reais** do manifest chegam nas Stories **13.2** (sidebar nova) e
  **13.3** (bottom-nav novo) — aí sim haverá **comportamento novo** para gerar E2E.
  Revisitar este workflow nessas stories.
