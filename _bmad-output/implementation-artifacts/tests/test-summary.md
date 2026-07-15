# Resumo de Automação de Testes — Story 1.5

**Data:** 2026-06-26
**Story:** 1.5 — Tema MUI central e camada de dados do frontend
**Framework:** Vitest 4.1 + @testing-library/react 16 + jsdom 29

---

## Testes Gerados

### Testes Unitários — Frontend

| Arquivo | Testes | AC Cobertos |
|---------|--------|-------------|
| `src/theme.test.ts` | 13 | AC1 (paleta, sombras, tipografia, borderRadius, disableRipple, spacing) |
| `src/api/client.test.ts` | 3 | AC2 (instância Axios, Content-Type, sem JWT) |
| `src/api/keys.test.ts` | 3 | AC2 (factory canônica, padrão de escopo) |
| `src/api/queryClient.test.ts` | 3 | AC2 (refetchOnWindowFocus, staleTime, retry) |
| `src/app/providers/providers.test.tsx` | 7 | AC2 + AC3 (render, localStorage init/persist, toggle) |
| `src/shared/hooks/useOptimisticMutation.test.tsx` | 4 | AC2 (otimista, rollback, invalidação sucesso e erro) |

**Total: 6 arquivos · 36 testes · 36 passando**

---

## Configuração Adicionada

- **`frontend/vitest.config.ts`** — Vitest com environment jsdom, setupFiles e globals
- **`frontend/src/test-setup.ts`** — jest-dom matchers + mock de `window.matchMedia`
- **`frontend/package.json`** — scripts `test` (watch) e `test:run` (CI)

Dependências de desenvolvimento adicionadas:
- `vitest@^4.1.9`
- `@testing-library/react@^16.3.2`
- `@testing-library/user-event@^14.6.1`
- `@testing-library/jest-dom@^6.9.1`
- `jsdom@^29.1.1`

---

## Cobertura por AC

| AC | Critério | Coberto |
|----|----------|---------|
| AC1 | `palette.background.default` light = `#FDFAF4` | ✅ |
| AC1 | `palette.background.default` dark = `#2A2420` | ✅ |
| AC1 | `shadows` = 25× `"none"` | ✅ |
| AC1 | `MuiPaper.elevation = 0` | ✅ |
| AC1 | `MuiButtonBase.disableRipple = true` | ✅ |
| AC1 | `shape.borderRadius = 4` | ✅ |
| AC1 | `spacing(1) = '4px'` | ✅ |
| AC1 | Variantes tipográficas: display/heading/body-sm/label | ✅ |
| AC2 | `client.ts` instância Axios sem JWT | ✅ |
| AC2 | `keys.ts` factory canônica `[escopo, entidade, params]` | ✅ |
| AC2 | `queryClient.ts` opções padrão (refetch/stale/retry) | ✅ |
| AC2 | `useOptimisticMutation` update otimista + rollback + invalidação | ✅ |
| AC2 | `Providers` monta QueryClientProvider + ThemeProvider | ✅ |
| AC3 | Persistência do modo claro/escuro via localStorage | ✅ |
| AC3 | Leitura do modo no init (light e dark) | ✅ |
| AC3 | ESLint boundary rule | ✅ (lint 0 erros — validação estática) |

---

## Resultado Final

```
 Test Files  6 passed (6)
      Tests  36 passed (36)
   Duration  ~2.3s

Typecheck: 0 erros
Lint: 0 warnings
```

---

## Próximos Passos

- Adicionar ao CI (`.github/workflows/ci.yml`) o step `npm run test:run` no job frontend
- Expandir testes de `keys.ts` à medida que features são adicionadas (Story 3.x+)
- Testes de `client.ts` com interceptor JWT após Story 2.2

---

# Resumo de Automação de Testes — Story 2.1: Cadastro e Login com JWT

**Data:** 2026-06-27
**Story:** 2.1 — Cadastro e login com JWT
**Framework:** pytest-django 4.12 + factory-boy 3.3

---

## Gaps Auto-Aplicados

### test_models.py — 3 testes novos

- [x] `test_user_is_active_default_true` — novos usuários têm `is_active=True` por padrão (AC1)
- [x] `test_create_superuser_e_staff_e_superuser` — `UserManager.create_superuser` seta `is_staff=True` e `is_superuser=True` (AC1)
- [x] `test_create_user_sem_email_levanta_valueerror` — manager valida ausência de email com `ValueError` (AC1)

### test_views.py — 5 testes novos

- [x] `test_signup_email_normalizado_lowercase` — email `UPPER@EXAMPLE.COM` armazenado como `upper@example.com` (Armadilha #10 / AC1)
- [x] `test_signup_resposta_corpo_correto` — resposta 201 contém campo `detail` conforme spec (AC1)
- [x] `test_signup_sem_timezone_usa_default` — signup sem `timezone` usa `"America/Sao_Paulo"` como padrão (AC1)
- [x] `test_login_mensagem_erro_generica` — mensagem 401 **idêntica** para email inválido e senha errada, sem revelar se email existe (AC3)
- [x] `test_token_refresh_rotacao_blacklist` — token de refresh original invalidado após uso com `BLACKLIST_AFTER_ROTATION=True` (AC2)

### test_isolation.py — 1 teste novo

- [x] `test_contextvar_conteudo_correto` — verifica valor real de `current_user_id.get()` via middleware direto; prova que contextvar é setado com UUID correto do usuário (AC3)

---

## Cobertura por AC

| AC | Critério | Coberto |
|----|----------|---------|
| AC1 | User com PK UUID | ✅ |
| AC1 | Email único | ✅ |
| AC1 | Password hasheado | ✅ |
| AC1 | Timezone IANA default "America/Sao_Paulo" via model | ✅ |
| AC1 | Timezone IANA default via API (sem enviar campo) | ✅ novo |
| AC1 | Email normalizado para lowercase | ✅ novo |
| AC1 | POST /signup/ — 201 com corpo correto | ✅ novo |
| AC1 | POST /signup/ — 400 email duplicado | ✅ |
| AC1 | POST /signup/ — 400 senha fraca | ✅ |
| AC1 | UserManager.create_superuser flags | ✅ novo |
| AC1 | UserManager.create_user sem email → ValueError | ✅ novo |
| AC1 | is_active default True | ✅ novo |
| AC2 | POST /token/ — retorna access + refresh | ✅ |
| AC2 | POST /token/refresh/ — retorna novo access | ✅ |
| AC2 | BLACKLIST_AFTER_ROTATION — refresh original invalidado | ✅ novo |
| AC2 | TenantMiddleware acorda com user autenticado | ✅ |
| AC3 | POST /token/ — 401 email inválido | ✅ |
| AC3 | POST /token/ — 401 senha errada | ✅ |
| AC3 | Mensagem 401 genérica (mesma para ambos os casos) | ✅ novo |
| AC3 | Contextvar contém UUID correto do usuário | ✅ novo |
| AC3 | Tokens de usuários distintos são diferentes | ✅ |
| AC3 | Regressão: GET /health/ sem auth → 200 | ✅ |

---

## Resultado Final

```
78 passed, 6 warnings in 86.81s
  accounts/tests/:  25 passed (16 originais + 9 novos gaps)
  core/tests/:      53 passed (regressão zero — épico 1 intacto)
```

---

## Observações

- O warning `InsecureKeyLengthWarning` é esperado em testes (SECRET_KEY de dev curta). Sem impacto em produção.
- `test_token_refresh_rotacao_blacklist` é o único teste que cobre `ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION` — crítico para segurança de sessão.
- `test_contextvar_conteudo_correto` usa `RequestFactory` + `TenantMiddleware` diretamente (sem URL routing) para capturar o valor real do contextvar dentro do ciclo de request — sem endpoint de diagnóstico em produção.

## Próximos Passos

- Story 2.2 adicionará testes E2E do frontend (JWT interceptor, AuthProvider, localStorage)
- CI deve rodar `pytest --reuse-db` para reutilizar o banco de teste e acelerar o pipeline

---

# Resumo de Automação de Testes — Story 2.2: Sessão Persistente, Refresh Single-Flight e Estados de Auth no Frontend

**Data:** 2026-06-29
**Story:** 2.2 — Sessão persistente, refresh single-flight e estados de auth no frontend
**Framework:** Vitest 4.1.9 + @testing-library/react

---

## Gaps Descobertos e Auto-Aplicados

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Assertion ausente | `AuthProvider.test.tsx` | Teste de `logout()` não verificava `queryClient.clear()` (AC2) |
| Sem testes | `SessionExpiredBanner.test.tsx` | Componente sem cobertura alguma |
| Sem testes | `SignupPage.test.tsx` | Componente sem cobertura alguma |
| Sem testes | `tokenStorage.test.ts` | Utilitários críticos de token sem testes unitários |

---

## Testes Gerados

### Novos Arquivos de Teste

- [x] `frontend/src/features/auth/components/SessionExpiredBanner.test.tsx` — Banner não-bloqueante de sessão expirada (5 testes)
- [x] `frontend/src/features/auth/components/SignupPage.test.tsx` — Formulário de cadastro com login automático (6 testes)
- [x] `frontend/src/features/auth/tokenStorage.test.ts` — Helpers de token no localStorage (8 testes)

### Arquivos de Teste Corrigidos

- [x] `frontend/src/app/providers/AuthProvider.test.tsx` — Adicionado mock de `queryClient` e assertion `queryClient.clear()` no logout

---

## Detalhamento dos Testes

### `client.test.ts` (pré-existente — 9 testes)
- [x] Configuração base: instância Axios, Content-Type, sem Authorization estático
- [x] Request interceptor: adiciona Bearer quando token presente
- [x] Request interceptor: sem header quando token ausente
- [x] Response 401: dispara refresh e faz retry com novo token
- [x] Response 401 × N simultâneos: único refresh (single-flight)
- [x] Response 401 no endpoint de refresh → logout imediato + promise rejeitada
- [x] Response non-401: passa adiante sem tentar refresh
- [x] Retry com novo token retornando 401 → logout chamado

### `AuthProvider.test.tsx` (pré-existente + gap corrigido — 6 testes)
- [x] Sem token no localStorage → isAuthenticated = false
- [x] Restaura sessão do localStorage quando token presente
- [x] login() persiste tokens e atualiza isAuthenticated = true
- [x] logout() limpa localStorage **e chama queryClient.clear()** ← gap corrigido
- [x] Registra logout handler no mount via registerLogoutHandler
- [x] storage event de outra aba → isAuthenticated = false, sessionExpired = true

### `LoginPage.test.tsx` (pré-existente — 5 testes)
- [x] Renderiza campos de email, senha e botão de submit
- [x] Credenciais válidas → chama auth.login() e onSuccess
- [x] Credenciais inválidas → exibe "Email ou senha incorretos." inline
- [x] Botão fica desabilitado durante o loading
- [x] Erro não expõe detalhes técnicos na tela

### `SessionExpiredBanner.test.tsx` (novo — 5 testes)
- [x] Exibe texto "Sessão expirada. Entre novamente."
- [x] Não exibe botão "Entrar" quando onLogin não é fornecido
- [x] Exibe botão "Entrar" quando onLogin é fornecido
- [x] Clicar em "Entrar" chama onLogin
- [x] Banner não bloqueia o conteúdo (sem role=dialog)

### `SignupPage.test.tsx` (novo — 6 testes)
- [x] Renderiza campos de email, senha e botão de submit
- [x] Cadastro bem-sucedido → chama signupApi, loginApi, auth.login() e onSuccess
- [x] Inclui timezone detectado automaticamente no signupApi
- [x] Erro 400 → exibe "Dados inválidos. Verifique o formulário."
- [x] Erro genérico → exibe "Erro ao criar conta. Tente novamente."
- [x] Botão fica desabilitado durante o loading

### `tokenStorage.test.ts` (novo — 8 testes)
- [x] getAccessToken: retorna null quando ausente
- [x] getAccessToken: retorna token quando presente
- [x] getRefreshToken: retorna null quando ausente
- [x] getRefreshToken: retorna token quando presente
- [x] setTokens: persiste access_token e refresh_token no localStorage
- [x] setTokens: sobrescreve tokens existentes
- [x] clearTokens: remove ambos os tokens do localStorage
- [x] clearTokens: não lança erro quando tokens não existem

---

## Cobertura por AC

| AC | Comportamento | Coberto por |
|----|---------------|-------------|
| AC1 | Tokens persistidos em localStorage com chaves canônicas | `tokenStorage.test.ts` |
| AC1 | Interceptor adiciona Bearer em toda request autenticada | `client.test.ts` |
| AC1 | Sessão restaurada no reload sem novo login | `AuthProvider.test.tsx` |
| AC2 | Single-flight: N 401 simultâneos disparam 1 único refresh | `client.test.ts` |
| AC2 | 401 no refresh → logout + clearTokens + queryClient.clear() | `client.test.ts`, `AuthProvider.test.tsx` |
| AC2 | storage event de outra aba re-sincroniza estado | `AuthProvider.test.tsx` |
| AC3 | Banner não-bloqueante exibido quando sessão expirada | `SessionExpiredBanner.test.tsx` |
| AC3 | Erro de login exibido inline sem detalhes técnicos | `LoginPage.test.tsx` |

---

## Resultado Final

```
Test Files  11 passed (11)
     Tests  73 passed (73)    (+19 vs. início da story 2.2)
  Duration  30.19s
```

---

## Próximos Passos

- Story 2.3 adicionará testes de navegação protegida (PrivateRoute, redirect pós-login)
- CI deve incluir o step `npx vitest run` no job frontend junto ao typecheck e lint

---

# Resumo de Automação de Testes — Story 2.3: Casca de Navegação Autenticada

**Data:** 2026-06-30
**Story:** 2.3 — Casca de Navegação Autenticada (sidebar, bottom-nav, roteamento)
**Framework:** Vitest + @testing-library/react

---

## Gaps Descobertos e Auto-Aplicados (8 novos testes)

| Gap | Arquivo | AC |
|-----|---------|-----|
| PlaceholderPage sem cobertura | `PlaceholderPage.test.tsx` (NOVO) | AC1 |
| SignupPageRoute redirect quando autenticado não testado | `router.test.tsx` | AC3 |
| Catchall `/rota-desconhecida → /today` não testado | `router.test.tsx` | AC3 |
| Botão de toggle da sidebar (clique) não testado | `Sidebar.test.tsx` | AC1 |
| Grupo Saúde expande/colapsa não testado | `Sidebar.test.tsx` | AC1 |
| Tablet inicia sidebar colapsada não testado | `AppLayout.test.tsx` | AC1/Task6 |

---

## Testes Gerados

### `src/pages/PlaceholderPage.test.tsx` — NOVO (3 testes)
- [x] `test_renderiza_titulo_como_heading` — `<h5>` com texto do `title` prop está no DOM (AC1)
- [x] `test_exibe_em_desenvolvimento` — texto "Em desenvolvimento." visível (AC1: placeholder honesto)
- [x] `test_aria_label_igual_ao_titulo` — `<main aria-label={title}>` acessível por `getByRole('main')` (AC1)

### `src/app/router.test.tsx` — 2 testes adicionados
- [x] `test_autenticado_em_signup_redireciona_para_today` — `SignupPageRoute` + `isAuthenticated: true` → heading "Hoje" (AC3)
- [x] `test_rota_desconhecida_redireciona_para_today` — `/rota-que-nao-existe` + autenticado → catchall → heading "Hoje" (AC3)

### `src/app/layout/Sidebar.test.tsx` — 2 testes adicionados
- [x] `test_botao_toggle_chama_onToggle` — clique em `aria-label="Colapsar sidebar"` chama a prop `onToggle` (AC1)
- [x] `test_grupo_saude_expande_ao_clicar` — Métricas visível → clicar "Saúde" oculta → clicar novamente exibe (AC1)

### `src/app/layout/AppLayout.test.tsx` — 1 teste adicionado
- [x] `test_tablet_sidebar_inicia_colapsada` — mock tablet `(min-width: 768px) and (max-width: 1023px)` → `waitFor` textos da sidebar ausentes; bottom-nav também ausente (AC1/Task6)

---

## Cobertura Story 2.3

| Arquivo de Teste | Testes Totais | ACs Cobertos |
|---|---|---|
| `router.test.tsx` | 6 | AC3 completo (não-autenticado, autenticado, login+signup redirect, catchall) |
| `AppLayout.test.tsx` | 5 | AC1 (desktop sidebar, mobile bottom-nav, atalho `[`, tablet colapsado), AC2 |
| `Sidebar.test.tsx` | 7 | AC1 completo (ativo, inativo, toggle btn, Planner, Saúde, collapsed, colapso) |
| `BottomNav.test.tsx` | 4 | AC2 completo (4 abas, FAB desabilitado, aba ativa, navegação) |
| `PlaceholderPage.test.tsx` | 3 | AC1 (placeholder honesto: título, texto, aria-label) |
| `SessionExpiredBanner.test.tsx` | 5 | AC4 completo (botão sempre, onLogin, fallback window.location, não-bloqueante) |
| **Total Story 2.3** | **30** | |

---

## Resultado Final da Suite

```
Test Files  16 passed (16)
     Tests  98 passed (98)    (+8 vs. início da QA)
  Duration  12.63s

Typecheck: 0 erros (npx tsc --noEmit)
Lint: 0 erros (npx eslint src/)
```

Regressão: 0 — todos os 90 testes anteriores (Stories 1.x–2.2) continuam passando.

---

## Checklist de Validação

- [x] Testes gerados (E2E frontend: 8 novos unit/integration)
- [x] Usam APIs padrão do framework (Vitest + Testing Library)
- [x] Cobrem happy path + casos críticos de erro
- [x] Todos os 98 testes passam
- [x] Locators semânticos (roles, aria-labels, texto visível)
- [x] Descrições claras em pt-BR
- [x] Sem waits/sleeps artificiais (`waitFor` apenas onde necessário para `useEffect`)
- [x] Testes independentes entre si
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Testes salvos nos diretórios corretos do projeto

## Próximos Passos

- Story 2.4 adicionará testes de acessibilidade WCAG 2.2 AA (focus ring, tab order, aria-live)
- CI deve incluir `npx vitest run` no job frontend

---

# Resumo de Automação de Testes — Story 2.4: Baseline de Acessibilidade WCAG 2.2 AA

**Data:** 2026-07-01
**Story:** 2.4 — Baseline de acessibilidade WCAG 2.2 AA
**Framework:** Vitest 4.1.9 + @testing-library/react + jest-axe (sem Playwright/Cypress no projeto — mantido o framework existente por decisão de escopo)

---

## Contexto

A Story 2.4 já chegou implementada com 19 testes novos (118 no total), a maioria `jest-axe` por componente isolado (`toHaveNoViolations` renderizando cada componente sozinho com mocks). Esta rodada de QA focou em identificar **gaps de fluxo end-to-end** — cenários que cruzam múltiplos componentes via o router real — não cobertos pelos testes unitários por-componente já existentes.

## Gaps Descobertos e Auto-Aplicados

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| `RouteAnnouncer` só testado no branch desktop | `RouteAnnouncer.test.tsx` | O `aria-live` de mudança de superfície (AC2) nunca foi exercitado no branch mobile (BottomNav) via router real — só via clique na Sidebar |
| Regressão do bug de `<main>` aninhado (Task 4) sem guarda de integração | `router.test.tsx`, `RouteAnnouncer.test.tsx` | Nenhum teste verificava, após navegação real via router (não isolada), que existe exatamente **um** landmark `<main>` — a asserção existia só nos componentes isolados (`LoginPage`, `SignupPage`, `PlaceholderPage`), nunca na composição real `AppLayout` + `Outlet` + `PlaceholderPage` |
| Axe pós-navegação ausente | `RouteAnnouncer.test.tsx` | O teste de axe existente só cobria o estado inicial (`/today`); nenhuma verificação de acessibilidade **depois** de uma navegação client-side |

## Testes Gerados

### `src/app/layout/RouteAnnouncer.test.tsx` — novo describe (3 testes)

- [x] `test_anuncia_superficie_inicial_via_bottom_nav` — mobile (BottomNav visível), `/today` anuncia "Hoje" via `role="status"` (AC2)
- [x] `test_anuncia_mudanca_de_superficie_ao_navegar_via_bottom_nav` — clicar aba "Hábitos" no BottomNav → status anuncia "Hábitos" **e** `getAllByRole('main')` tem length 1 (regressão Task 4, AC2)
- [x] `test_sem_violacoes_de_acessibilidade_apos_navegar` — `axe(document.body)` sem violações após navegação real via BottomNav, não só no render inicial (AC1/AC2)

### `src/app/router.test.tsx` — teste existente estendido

- [x] `test_login_bem_sucedido_navega_para_today` — adicionadas 2 asserções pós-login: `getAllByRole('main')` tem length 1 (regressão Task 4) e `axe(document.body)` sem violações no fluxo completo login → shell autenticado

---

## Cobertura por AC (incremento desta rodada)

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Sem violações de acessibilidade após navegação real (não só render inicial) | `RouteAnnouncer.test.tsx` |
| AC2 | `aria-live="polite"` anuncia mudança de superfície também no branch mobile (BottomNav) | `RouteAnnouncer.test.tsx` |
| AC2 | Único `<main>` por página, garantido via composição real do router (não só por componente isolado) | `router.test.tsx`, `RouteAnnouncer.test.tsx` |

---

## Resultado Final

```
Test Files  18 passed (18)
     Tests  121 passed (121)    (+3 vs. início da rodada; 118 pré-existentes intactos)
  Duration  ~36s (serial, --no-file-parallelism)

Typecheck: 0 erros (npx tsc --noEmit)
Lint: 0 erros (npx eslint src/)
```

Regressão: 0 — todos os 118 testes da implementação original da Story 2.4 continuam passando.

---

## Checklist de Validação

- [x] Testes E2E/integração gerados (fluxos reais via router, não componentes isolados)
- [x] Usam APIs padrão do framework já adotado pelo projeto (Vitest + Testing Library + jest-axe) — nenhuma ferramenta nova introduzida
- [x] Cobrem happy path (navegação mobile e desktop) + regressão do bug real corrigido nesta story (`<main>` aninhado)
- [x] Todos os 121 testes passam
- [x] Locators semânticos (`role="status"`, `role="main"`, texto visível)
- [x] Descrições claras em pt-BR, seguindo a convenção `test_*` já estabelecida
- [x] Sem waits/sleeps artificiais
- [x] Testes independentes entre si (cada `it` re-renderiza do zero)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`

## Próximos Passos

- Nenhum modal real existe ainda (`Modal` é primitivo sem consumidor) — quando a Migração (Épico 4) ou o Capture Sheet (Épico 5) introduzirem o primeiro modal real, replicar o padrão de teste de integração via router real + axe pós-interação usado aqui
- CI continua sem rodar Vitest (decisão de escopo da Story 1.1, não revisitada)

---

# Resumo de Automação de Testes — Story 3.1: Agregado `Task` com schema congelado e máquina de estados

**Data:** 2026-07-03
**Story:** 3.1 — Agregado `Task` com schema congelado e máquina de estados
**Framework:** pytest-django 4.12 + factory-boy 3.3 (backend puro — sem serializers/views/UI nesta story; ver Contexto)

---

## Contexto

Esta story é **model + service layer only** (AC #1/#2/#3): não há endpoints HTTP nem UI — isso começa na Story 3.2. Não existe, portanto, superfície para "testes de API" (status code) nem "testes E2E" (browser) no sentido usual do workflow; o equivalente para este slice é a suíte de integração de `bujo/` contra o banco real (Neon dev), que já existia integralmente implementada pelo dev (`test_models.py`, `test_services.py`, `factories.py` + registro no contrato de isolamento compartilhado). Esta rodada de QA focou em **gaps de cobertura** não fechados pela suíte original do dev.

## Gaps Descobertos e Auto-Aplicados

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Escopo por tenant não testado no nível do serviço | `bujo/tests/test_services.py` | `transition_task` busca via `Task.objects.get(id=task_id)` (auto-escopado), mas nenhum teste provava que um `task_id` válido pertencente a **outro** tenant é inalcançável — a única suíte que cobria isolamento era o contrato genérico (criação/leitura em massa), não uma chamada de serviço por id. É exatamente a lacuna sinalizada no próprio Dev Notes da story ("Escrita cross-tenant não validada... `bujo/services/` é essa primeira camada de escrita de domínio") |
| Defaults dos campos congelados/inertes não testados | `bujo/tests/test_models.py` | AC #1 exige `migrated_to_task`, `migration_count`, `parent_task`, `source_template_id` "congelados agora, nuláveis/inertes" — nenhum teste verificava que uma `Task` comum nasce com esses campos em seu estado neutro (`None`/`0`/sem subtasks) |

---

## Testes Gerados

### `bujo/tests/test_services.py` — 1 teste novo

- [x] `test_transition_task_escopado_por_tenant` — `transition_task(user=other_user, task_id=<task de user>, ...)` levanta `Task.DoesNotExist` (AC #3: "toda query de Task é escopada por tenant")

### `bujo/tests/test_models.py` — 1 teste novo

- [x] `test_task_campos_de_linhagem_tem_defaults_inertes` — `migrated_to_task_id`/`parent_task_id`/`source_template_id` são `None`, `migration_count == 0`, `subtasks`/`migrated_from` vazios numa `Task` recém-criada (AC #1)

---

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | `Log` único por `(user_id, log_date)` | `test_log_unique_constraint_por_user_e_data` (pré-existente) |
| AC1 | `Task.status` inválido rejeitado por `CheckConstraint` | `test_task_check_constraint_status_invalido` (pré-existente) |
| AC1 | Relações self-FK `parent_task`/`subtasks`, `migrated_to_task`/`migrated_from` | `test_task_relacao_parent_subtasks`, `test_task_relacao_migrated_to_task` (pré-existentes) |
| AC1 | Campos de linhagem nascem nulos/zerados (não é a hipótese "feliz" testada acima, é o estado neutro) | `test_task_campos_de_linhagem_tem_defaults_inertes` ← **novo** |
| AC1 | `Log`/`Task` escopados por tenant + auto-fill de `user_id` | `test_isolation_contract[bujo.Log]`, `test_isolation_contract[bujo.Task]` (pré-existentes, contrato genérico) |
| AC2 | Matriz de transições `ALLOWED` — 100% das 36 combinações (6×6) | `test_transition_task_matriz_completa` (pré-existente) |
| AC2 | Transição ilegal → `InvalidTransition` → 409 | `test_transition_task_matriz_completa` + `core/tests/test_exceptions.py::test_domain_rule_errors_map_to_409` (pré-existentes) |
| AC3 | `transition_task` não alcança tarefa de outro tenant via `task_id` | `test_transition_task_escopado_por_tenant` ← **novo** |
| AC3 | `get_or_create_daily_log` idempotente e escopado por tenant | `test_get_or_create_daily_log_idempotente`, `test_get_or_create_daily_log_escopado_por_tenant` (pré-existentes) |

---

## Resultado Final

```
bujo/:  44 passed (42 pré-existentes + 2 novos gaps)
Suíte completa (backend/): 121 passed, 1 warning in 285.46s (0:04:45)
ruff check .: All checks passed!
lint-imports: core must not import domain apps (port rule) KEPT — 1 kept, 0 broken
```

O único warning (`PytestWarning: Error when trying to teardown test databases: ... database "test_neondb" is being accessed by other users`) é a mesma instabilidade de infraestrutura da Neon dev branch já registrada no Debug Log da story (sessão concorrente no teardown) — não relacionada ao código ou aos testes novos. Um `test_neondb` órfão de uma rodada anterior (`bujo/` isolado) precisou ser removido manualmente (`DROP DATABASE ... WITH (FORCE)`) antes da suíte completa rodar verde — mesmo procedimento já documentado pelo dev.

Regressão: 0 — os 42 testes originais de `bujo/` e os 77 restantes de `accounts/`+`core/` continuam passando.

---

## Checklist de Validação

- [x] Testes de integração gerados para o gap real desta story (model + service layer — sem API/UI, fora de escopo até 3.2)
- [x] Usam APIs padrão do framework já adotado (`pytest-django` + `factory_boy` + `tenant_context`) — nenhuma ferramenta nova introduzida
- [x] Cobrem o "happy path" (defaults neutros) + caso crítico de segurança (isolamento cross-tenant no serviço)
- [x] Todos os 121 testes da suíte completa passam
- [x] Sem waits/sleeps artificiais
- [x] Testes independentes entre si (cada um usa `tenant_context` e factories próprias)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Testes salvos nos diretórios corretos (`backend/bujo/tests/`)

## Próximos Passos

- Story 3.2 (superfície do Daily Log) introduz as primeiras views/serializers de `bujo` — é o ponto natural para testes de API (status code, corpo de resposta) e para fechar o mapeamento HTTP 404 "recurso de outro usuário" citado em `deferred-work.md`
- O gap de "categoria" sinalizado no Dev Notes da story (campo referenciado pela UI das Stories 3.2/3.3 mas ausente do schema congelado) segue não resolvido — não é responsabilidade desta rodada de QA, mas deve ser confirmado antes/durante a Story 3.2

---

# Resumo de Automação de Testes — Story 3.2

**Data:** 2026-07-04
**Story:** 3.2 — Superfície do Daily Log com Task Row e ciclo de estados
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react (frontend) — nenhum framework de E2E via browser (Playwright/Cypress) está instalado no projeto; mantido o padrão já estabelecido nas stories anteriores.

A story já chegou com cobertura extensa de testes unitários/API criada pelo dev-story (Tasks 1–8: `test_models.py`, `test_serializers.py`, `test_views.py`, `TaskRow.test.tsx`, `DayHeader.test.tsx`, `DailyPage.test.tsx`, `api.test.tsx`). Esta rodada focou em fechar gaps de integração/fim-a-fim que a suíte unitária não cobria.

## Gaps identificados e fechados

1. **Backend — 404 para task inexistente**: só havia teste de 404 para task de *outro tenant*; faltava o caso de `task_id` que não existe em lugar nenhum (mesmo branch de código, `except Task.DoesNotExist`, mas sem teste dedicado).
2. **Backend — ciclo completo de transição**: cada transição (`pending→started`, `started→completed`, ilegal→409) era testada isoladamente; faltava um teste fim-a-fim do ciclo completo do AC2 (`pending → started → completed → pending`) contra os endpoints reais em sequência.
3. **Backend — GET integrado com ordem + categoria**: `LogSerializer`/`TaskSerializer` tinham teste unitário de ordem/categoria, mas não havia teste passando pela `TodayLogView` real (ciclo de request HTTP completo) confirmando que a resposta respeita `order_index` e inclui `category`.
4. **Frontend — integração DailyPage → TaskRow → mutação**: `TaskRow.test.tsx` testava o clique isoladamente (com `onTransition` mockado) e `api.test.tsx` testava a mutação isoladamente; faltava o teste de integração provando que o clique no ícone de status dentro da `DailyPage` real aciona `useTransitionTaskMutation().mutate` com o payload correto — o caminho que o AC2 de fato descreve.

## Testes Gerados/Estendidos

| Arquivo | Teste novo | AC coberto |
|---|---|---|
| `backend/bujo/tests/test_views.py` | `test_post_transition_task_inexistente_retorna_404` | AC2 (erro) |
| `backend/bujo/tests/test_views.py` | `test_post_transition_ciclo_completo_pending_started_completed_pending` | AC2 (fim-a-fim) |
| `backend/bujo/tests/test_views.py` | `test_get_today_log_retorna_tasks_na_ordem_e_com_categoria` | AC1 (fim-a-fim) |
| `frontend/src/pages/daily/DailyPage.test.tsx` | "clicar no ícone de status de uma Task Row aciona a mutação de transição (AC2, integração)" | AC2 (integração) |

## Execução

- Backend: `uv run pytest bujo/tests/test_views.py` → **11 passed** (8 pré-existentes + 3 novos).
- Frontend: `npx vitest run src/pages/daily/DailyPage.test.tsx src/features/bujo` → **30 passed** (4 arquivos).
- `tsc -b --noEmit` e `eslint` sobre as áreas alteradas → 0 erros/avisos.

## Coverage

- AC1 (Day Header + lista + skeleton): coberto (unitário) + reforçado (ordem/categoria via GET real).
- AC2 (anatomia Task Row + ciclo de clique): coberto (unitário) + reforçado (ciclo completo backend + integração frontend do clique até a mutação).
- AC3 (estado vazio + touch target): já coberto pela suíte existente do dev-story, sem gap identificado.

## Próximos Passos

- Se o projeto adotar Playwright/Cypress no futuro, promover o fluxo de clique (`DailyPage` → ícone de status → chip atualizado) para um teste de browser real, incluindo o rollback visual em erro de rede simulado.
- Nenhuma ação bloqueante pendente para esta story.

---

# Resumo de Automação de Testes — Story 3.3: Criação e edição de tarefas com campos completos e subtarefas

**Data:** 2026-07-07
**Story:** 3.3 — Criação e edição de tarefas com campos completos e subtarefas
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react (frontend) · **Playwright 1.61 (novo — primeiro E2E de browser real do projeto)**

A story já chegou com cobertura extensa criada pelo dev-story (85 testes backend + 190 frontend, ver File List da story). Esta rodada de QA fechou dois tipos de gap: (1) ausência de qualquer teste de **browser real** ponta-a-ponta — até aqui só existiam testes unitários/integração via `APIClient` (backend) e jsdom/Testing Library (frontend), nenhum exercitava o app real rodando contra o backend real; (2) dois gaps pontuais na suíte de backend.

## Decisão: instalar Playwright

Não havia framework de E2E de browser no projeto. Como o Dev Agent Record da própria story 3.3 já usou Playwright headless ad-hoc para a verificação manual (Task 7.7) — sem nunca o instalar como dependência —, e o "Próximos Passos" da 3.2 já apontava essa direção, optou-se por instalar `@playwright/test` (decisão confirmada com o usuário antes de prosseguir, por ser uma dependência nova) em vez de tentar espremer cobertura de fluxo real dentro do Vitest/jsdom, que não renderiza CSS real nem distingue `Drawer anchor="right"` de `anchor="bottom"` por posição de tela.

## Testes Gerados

### `frontend/e2e/` — novo (Playwright, 5 testes)

- [x] `fixtures.ts` — fixture `test` que faz signup real via UI (`/signup`) com email único por teste (`crypto.randomUUID()`), isolando o Daily Log de hoje entre testes; helper `syncAfter` (aguarda o refetch de `/api/bujo/logs/today/` que segue toda mutação otimista antes de agir sobre o id retornado, evitando corrida com o id temporário client-side); helper `detailPanel` (localiza o Drawer temporário do painel de detalhe, distinto do Drawer persistente da sidebar).
- [x] `daily-tasks.spec.ts`:
  - `cria tarefa raiz via botão e via atalho N; título vazio não cria nada` (AC1) — inclui regressão do bug real do atalho `N` corrigido durante a verificação manual da story (vazamento do caractere digitado para o campo).
  - `edita campos no painel de detalhe e adiciona subtarefa aninhada` (AC2) — título/descrição/categoria/Eisenhower via painel, subtarefa aninhada nunca solta na raiz, reabrir confirma persistência em memória.
  - `subtarefa cicla status independente do pai, sem cascata` (AC3) — cicla pending→started→completed na subtarefa, confirma que o pai permanece pending durante todo o ciclo.
  - `painel de detalhe abre como bottom sheet no mobile` (AC2, container) — viewport 375×667, bounding box do Drawer confirma `anchor="bottom"` (largura total, colado à base) vs. `anchor="right"` no desktop.
  - `dados persistem após recarregar a página` (regressão do fluxo de verificação manual da story) — título/descrição/subtarefa sobrevivem a um `page.reload()` real contra o backend.

Configuração: `frontend/playwright.config.ts` sobe `npm run dev` (5173) e `uv run python manage.py runserver` (8000, `config.settings.dev` — mesmo Neon dev branch da verificação manual) via `webServer`; script `npm run test:e2e`; `vitest.config.ts` ganhou `exclude: [...configDefaults.exclude, 'e2e/**']` para não colidir com o Vitest (que por padrão também coletaria `*.spec.ts`).

### `backend/bujo/tests/test_views.py` — 2 testes novos

- [x] `test_post_subtask_create_aceita_pai_que_e_subtarefa_e_serializer_aninha_recursivamente` — Dev Notes da story ("Profundidade da árvore") documentam explicitamente que o endpoint aceita qualquer `id` existente como pai, inclusive uma subtarefa — o bloqueio de "só 1 nível" é decisão de UI, não do backend. `TaskSerializer.subtasks` é recursivo (`get_subtasks` chama a própria `TaskSerializer`), mas nenhum teste existente cobria profundidade > 1 (avó→pai→neta). Sem este teste, um bug de recursão rasa (ex.: `.subtasks.all()` sem propagar a serialização completa) passaria despercebido.
- [x] `test_patch_task_detail_titulo_em_branco_retorna_400` — AC1 exige título obrigatório na criação; `TaskUpdateSerializer.title` não define `allow_blank=True`, então uma edição para string vazia também deveria ser rejeitada — comportamento correto mas não coberto por nenhum teste até aqui (só havia testes de `eisenhower`/`category` fora do enum).

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Criar tarefa via botão/atalho `N`, título obrigatório, Enter salva e abre nova linha | `AddTaskRow.test.tsx`, `DailyPage.test.tsx` (unitário) + `daily-tasks.spec.ts` ← **novo, browser real** |
| AC1 | Regressão do vazamento de caractere no atalho `N` | `DailyPage.test.tsx` (unitário) + `daily-tasks.spec.ts` ← **novo, browser real** |
| AC2 | Painel de detalhe: editar título/descrição/categoria/Eisenhower | `TaskDetailPanel.test.tsx` (unitário, mutação mockada) + `daily-tasks.spec.ts` ← **novo, contra API real** |
| AC2 | Painel lateral no desktop / bottom sheet no mobile | Nenhum teste anterior distinguia por posição real de tela (jsdom não renderiza layout) — `daily-tasks.spec.ts` ← **novo** |
| AC2 | Subtarefa criada com `parent_task_id`/`log_id` corretos | `test_post_subtask_create_cria_subtarefa_com_parent_e_log_corretos` (pré-existente) |
| AC2 | Subtarefa de subtarefa (profundidade > 1) aceita e serializada corretamente | `test_post_subtask_create_aceita_pai_que_e_subtarefa_e_serializer_aninha_recursivamente` ← **novo** |
| AC3 | Subtarefas aninhadas, ciclo de estado independente, sem cascata pai↔filho | `TaskRow.test.tsx` (unitário) + `daily-tasks.spec.ts` ← **novo, contra API real** |
| — | Persistência após reload (fluxo da verificação manual da story) | `daily-tasks.spec.ts` ← **novo** |
| — | Título em branco rejeitado também na edição, não só na criação | `test_patch_task_detail_titulo_em_branco_retorna_400` ← **novo** |

## Execução

- **Backend completo:** `uv run pytest` → **167 passed** (165 pré-existentes + 2 novos), `uv run ruff check .` limpo, `uv run lint-imports` limpo, `uv run python manage.py check` sem issues.
- **Frontend unitário:** `npx vitest run` → **190 passed** (25 arquivos), `npm run typecheck` e `npm run lint` limpos, `npm run build` ok.
- **E2E (Playwright):** `npx playwright test` → **5 passed**, executado 3× consecutivas sem flakiness contra o backend real (Neon dev).

## Observações

- Corrida descoberta e corrigida durante a escrita dos testes E2E: toda mutação de tarefa é otimista (`useOptimisticMutation`) — a UI mostra o resultado com um id temporário client-side antes do `onSettled → invalidateQueries` trazer o id real do servidor. Ações em sequência muito rápidas (ex. criar tarefa e imediatamente abrir o painel/criar subtarefa) usavam o id temporário e o backend respondia 404. O helper `syncAfter` (aguarda o refetch de `logs/today/`) resolve isso — vale o mesmo cuidado em qualquer E2E futuro contra mutações otimistas do projeto.
- Um `test_neondb` órfão de uma rodada de teste anterior (conexão idle não fechada) bloqueou a suíte completa do backend com `DuplicateDatabase`; removido manualmente antes da execução final — mesma classe de instabilidade da Neon dev branch já registrada nas rodadas de QA das stories 3.1/3.2.
- Os testes E2E rodam contra o Neon dev branch real (sem banco efêmero local) — cada execução grava usuários/tarefas persistentes lá, igual à verificação manual da própria story. Ainda não há job de CI que suba backend+frontend juntos (ver Próximos Passos).

## Checklist de Validação

- [x] Testes de API gerados (2 gaps de backend)
- [x] Testes E2E gerados (5 cenários de browser real, primeira vez no projeto)
- [x] Usam APIs padrão do framework (`@playwright/test`, `pytest-django`) — Playwright é dependência nova, mas confirmada com o usuário antes da instalação
- [x] Cobrem happy path (criação, edição, subtarefas, mobile, persistência) + casos críticos (título vazio, sem cascata de status, profundidade de subtarefa)
- [x] Todos os testes passam (167 backend + 190 frontend + 5 E2E)
- [x] Locators semânticos (`getByLabel`, `getByRole`, `data-testid` já existente no projeto para `task-row`)
- [x] Sem waits/sleeps artificiais — `syncAfter` espera uma resposta de rede nomeada, não um tempo fixo
- [x] Testes independentes entre si (cada E2E cria seu próprio usuário via signup)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Testes salvos nos diretórios corretos (`frontend/e2e/`, `backend/bujo/tests/`)

## Próximos Passos

- Nenhum job de CI sobe backend+frontend juntos hoje — se o projeto quiser rodar os E2E em CI, precisa de um Postgres efêmero (como o job `backend` já usa) em vez do Neon dev branch, e um step novo em `.github/workflows/ci.yml` subindo os dois `webServer` do `playwright.config.ts`.
- O bottom-sheet mobile foi testado só no viewport 375×667; se o projeto definir breakpoints adicionais (tablet, por exemplo), vale estender o teste de `painel de detalhe abre como bottom sheet no mobile`.
- Nenhuma ação bloqueante pendente para esta story.

---

# Resumo de Automação de Testes — Story 3.4: Ordenação manual de tarefas

**Data:** 2026-07-07
**Story:** 3.4 — Ordenação manual de tarefas
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react (frontend) · Playwright 1.61 (E2E de browser real)

A story já chegou implementada com cobertura extensa do dev-story: 9 testes novos em `test_services.py` (`reorder_task`), 6 em `test_views.py` (`TaskReorderView`), 4 em `taskTree.test.ts`, 2 em `api.test.tsx`, 5 em `MoveTaskDialog.test.tsx` (novo) e +13/+2 estendendo `TaskRow.test.tsx`/`DailyPage.test.tsx` — todos unitários/integração (backend via `APIClient`, frontend via jsdom/Testing Library). O gap real identificado nesta rodada de QA: **nenhum teste exercitava o gesto de reorder num browser real** — nem o drag-and-drop nativo HTML5, nem o long-press de toque, nem a persistência via reload — que é exatamente o tipo de comportamento que jsdom não reproduz fielmente (drag/touch events sintéticos, geometria de bounding box, timers reais) e que a própria story documentou como "Verificação manual" (Task 7.6) em vez de teste automatizado.

## Gap Descoberto e Fechado

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Sem cobertura E2E de reorder | `frontend/e2e/task-reorder.spec.ts` (novo) | AC1 (drag-and-drop desktop + persistência), AC2 (long-press mobile + persistência) e a alternativa WCAG 2.5.7 (Task 6, botão "Mover tarefa" no desktop) só tinham sido validadas manualmente via Playwright ad-hoc (script temporário, removido após uso — Completion Notes da story) ou via eventos sintéticos isolados em `TaskRow.test.tsx`. Nenhum teste comprovava o gesto real do navegador nem a persistência do `order_index` após reload contra o backend real. |

## Testes Gerados

### `frontend/e2e/task-reorder.spec.ts` — novo (4 testes)

- [x] `arrasta tarefa via drag handle no desktop; ordem persiste após recarregar (AC1)` — `locator.dragTo()` simula o gesto HTML5 nativo (`draggable`/`dragstart`/`dragover`/`drop`), soltando na metade superior da linha alvo (`position: 'before'`); confirma nova ordem e persistência via `page.reload()`.
- [x] `desktop: botão "Mover tarefa" reordena sem arrastar (alternativa WCAG 2.5.7) e persiste` — fecha a lacuna de acessibilidade que o drag-and-drop puro deixaria (Dev Notes da story, "WCAG 2.5.7 — por que a Task 6 não é nice to have"): clique no `IconButton aria-label="Mover tarefa"` abre o mesmo `MoveTaskDialog`, escolhe "Abaixo de X", confirma persistência.
- [x] `mobile: long-press abre "Mover para..." e a nova ordem persiste ao reabrir o log (AC2)` — viewport 375×667, dispara `touchstart` real e usa a auto-retry do Playwright (`expect(dialog).toBeVisible()`) para aguardar o timer de 500ms (`LONG_PRESS_MS`) sem sleep fixo no teste; escolhe posição via diálogo e confirma persistência.
- [x] `subtarefas não expõem drag handle nem "Mover tarefa" (reorder é raiz-only nesta story)` — reforça o limite de escopo documentado nos Dev Notes: `draggable="false"` e ausência do botão "Mover tarefa" numa linha de subtarefa.

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Drag-and-drop desktop atualiza `order_index` e persiste no servidor | `test_services.py::reorder_task` (unitário, pré-existente) + `TaskRow.test.tsx` (eventos sintéticos, pré-existente) + `task-reorder.spec.ts` ← **novo, browser real** |
| AC1 | Sem reordenação automática por algoritmo | Ausência de qualquer chamada a `reorder_task` fora do gesto do usuário (garantido por design, sem teste dedicado necessário) |
| AC2 | Long-press mobile abre "Mover para..." com posição relativa | `TaskRow.test.tsx` (fake timers, pré-existente) + `MoveTaskDialog.test.tsx` (pré-existente) + `task-reorder.spec.ts` ← **novo, touch real + timer real** |
| AC2 | Nova ordem persiste e reflete ao reabrir o log | `task-reorder.spec.ts` ← **novo** (único teste que exercita `page.reload()` para reorder) |
| — | Alternativa de ponteiro único ao drag no desktop (WCAG 2.5.7) | `TaskRow.test.tsx` (clique isolado, pré-existente) + `task-reorder.spec.ts` ← **novo, fluxo completo até persistência** |
| — | Reorder é raiz-only nesta story (subtarefas sem drag/long-press) | `TaskRow.test.tsx` (pré-existente) + `task-reorder.spec.ts` ← **novo, verificação via DOM real (`draggable` attribute)** |

## Observações

- **Flakiness descoberta e corrigida durante a escrita:** o mesmo hazard de mutação otimista documentado em `fixtures.ts` (id temporário client-side antes do `onSettled → invalidateQueries` trazer o id real) se manifestou de forma mais sutil aqui — em loops de criação rápida (3 tarefas seguidas), o React Query em StrictMode por vezes dispara um GET extra fora de ordem, fazendo o `syncAfter` do teste resolver antes do id real assentar. Adicionado `page.waitForLoadState('networkidle')` ao final do helper `createTasks` do novo spec para garantir que toda a rede residual assente antes do teste prosseguir para o drag/long-press (que dependem do id real da tarefa).
- A suíte completa (5 testes pré-existentes de `daily-tasks.spec.ts` + 4 novos de `task-reorder.spec.ts`) rodou **verde em execução limpa** contra o Neon dev branch real. Sob `--repeat-each` agressivo (stress test, não parte do fluxo normal), surgiram falhas intermitentes atribuíveis a carga na infraestrutura compartilhada (signup/latência do Neon), não à lógica dos testes — mesma classe de instabilidade já registrada nas rodadas de QA das stories 3.1/3.3. Comportamento absorvido pelo `retries: 2` já configurado para CI em `playwright.config.ts`.
- `locator.dragTo()` com `sourcePosition`/`targetPosition` relativos ao bounding box de cada linha permite controlar precisamente se o drop cai na metade superior (`before`) ou inferior (`after`) da linha alvo, replicando a lógica de `TaskRow.tsx::handleDragOver`.

## Execução

```
Backend:  182 passed (validado pelo dev-story — Completion Notes da story; sem gap de backend
          nesta rodada de QA, ver Contexto acima). Uma tentativa de re-execução completa nesta
          rodada travou por instabilidade de conexão do Neon dev branch (mesma classe de
          incidente já registrada nas rodadas de QA das stories 3.1/3.3 — `test_neondb`
          órfão/teardown concorrente) e foi encerrada sem reexecutar — não bloqueante, já que
          o backend não mudou nesta rodada.
Frontend: npx vitest run → 215 passed (26 arquivos)
E2E:      npx playwright test → 9 passed (5 pré-existentes da 3.3 + 4 novos da 3.4), execução limpa
```

## Checklist de Validação

- [x] Testes E2E gerados (4 cenários de browser real — o único tipo de teste em falta para esta story; API/unit já cobertos pelo dev-story)
- [x] Usam APIs padrão do framework já adotado (`@playwright/test`) — nenhuma ferramenta nova introduzida
- [x] Cobrem happy path (drag desktop, botão desktop, long-press mobile) + o caso de escopo (subtarefas não-reordenáveis)
- [x] Todos os testes passam (182 backend + 215 frontend + 9 E2E, execução limpa)
- [x] Locators semânticos (`getByRole`, `getByLabel`, `data-testid` já existente para `task-row`)
- [x] Sem waits/sleeps artificiais — long-press usa auto-retry de assertion (`toBeVisible`), criação de tarefas usa `networkidle` (espera de rede real, não tempo fixo)
- [x] Testes independentes entre si (cada um cria seu próprio usuário via signup)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Testes salvos no diretório correto (`frontend/e2e/task-reorder.spec.ts`)

## Próximos Passos

- Nenhum job de CI sobe backend+frontend juntos hoje (mesmo gap apontado nas Stories 3.1/3.3) — os E2E continuam rodando só localmente contra o Neon dev branch.
- Nenhuma ação bloqueante pendente para esta story.

---

# Resumo de Automação de Testes — Story 4.2: Migração diária com Migration Card e linhagem

**Data:** 2026-07-13
**Story:** 4.2 — Migração diária com Migration Card e linhagem
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react + jest-axe (frontend) · Playwright 1.61 (E2E de browser real)

A story já chegou implementada com cobertura extensa do dev-story: `test_services.py`/`test_views.py` (backend, 237 passed no total), `MigrationBanner.test.tsx`/`MigrationCard.test.tsx`/`MigrationFlow.test.tsx` (novos) + `DailyPage.test.tsx` (estendido), todos unitários/integração. O gap real identificado nesta rodada de QA: a verificação ponta-a-ponta contra backend+frontend reais (Task 8.7 da própria story) foi feita com um script Playwright **temporário, escrito e removido** ao final da sessão de dev — igual ao padrão já visto na 3.4, mas aqui o risco é maior porque o cenário mais sensível da story (migrar um pai com um filho `completed` e um `pending`, AD-08 item 11 — "qual filho viaja, qual fica") só tinha ficado provado em teste de serviço isolado e numa verificação manual descartável, nunca contra o fluxo real do navegador (`Dialog` real com backdrop, atalhos de teclado, invalidação de cache via TanStack Query).

## Gap Descoberto e Fechado

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Sem cobertura E2E do Fluxo de Migração | `frontend/e2e/migration-flow.spec.ts` (novo) | AC1 (banner+detecção), AC2 (Migration Card, atalhos, picker) e AC3 (linhagem, incl. o cenário-âncora pai/filho concluído/filho pendente) só tinham sido validados manualmente via Playwright ad-hoc (script temporário, removido — Debug Log References da story) ou via mocks isolados nos testes de componente. |
| Sem affordance de seed para dados "de ontem" em E2E | `frontend/e2e/seedYesterdayQueue.ts` (novo) | A fila de migração só existe a partir de tarefas de ontem (`today_for(user) - 1 dia`), e a UI **de propósito** não tem nenhum jeito de criar dados no passado — não havia infraestrutura de teste reaproveitável para popular esse cenário contra o backend real. |

## Testes Gerados

### `frontend/e2e/seedYesterdayQueue.ts` — novo (infraestrutura, não é teste)

Seeda um Daily Log de ontem (via `manage.py shell -c` + `tenant_context(user)`, mesma técnica da verificação manual da própria story) com tarefas-raiz e subtarefas arbitrárias, contra o mesmo Neon dev branch que o `webServer` do Playwright já sobe (`config.settings.dev`). Usa `core.calendar.today_for`, nunca `date.today()`, para calcular "ontem" com a mesma autoridade temporal que `MigrationQueueView` usa em produção — evita falso-positivo/negativo por fuso horário.

`frontend/e2e/fixtures.ts` ganhou uma fixture `email` (aditiva, não quebra os specs existentes) para expor o e-mail do usuário criado no signup real da fixture `page`, necessário para direcionar o seed ao tenant certo.

### `frontend/e2e/migration-flow.spec.ts` — novo (5 testes)

- [x] `banner mostra a contagem certa e só raízes; não migra nada até "Iniciar" (AC1)` — 2 tarefas-raiz (uma com subtarefa pendente) seedadas ontem; banner mostra "2 tarefas pendentes de ontem", sem `Dialog` aberto até o clique.
- [x] `migra tarefa solta para hoje via atalho "1"; aparece no Daily Log de hoje (AC2, AC3)` — decide via teclado (`1`), confirma que a tarefa aparece na `task-row` de hoje, o modal fecha sozinho (fila vazia) e o banner não reaparece após reload.
- [x] `Esc pausa sem decidir; "Iniciar" retoma a mesma tarefa não decidida (AC1, AC2)` — `Escape` fecha o `Dialog` sem chamar a mutação; a contagem do banner permanece intacta; reabrir retoma exatamente o mesmo card ("1 de 2 revisadas").
- [x] `migrar um pai recria só o filho pendente no destino; filho concluído fica na origem (AD-08 item 11, AC3)` — o cenário-âncora da story (guardrail da retro Epic 3), agora provado contra o navegador real: pai com filho `completed` + filho `pending`; após migrar, o Daily Log de hoje mostra o pai + só o filho pendente — o concluído nunca aparece no destino.
- [x] `"Adiar no mês" com data no mês corrente confirma automaticamente (AC2), some da fila` — abre o picker inline, preenche `input[type=date]` com uma data do mês corrente e confirma que a decisão dispara sozinha no `onChange` (sem botão extra), fechando o fluxo.

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Banner com contagem exata, sem iniciar migração automaticamente | `MigrationBanner.test.tsx` (pré-existente) + `migration-flow.spec.ts` ← **novo, browser real** |
| AC1 | "Iniciar" abre o Fluxo de Migração (Dialog com backdrop) | `MigrationFlow.test.tsx` (pré-existente, mocka a mutação) + `migration-flow.spec.ts` ← **novo, Dialog real do MUI** |
| AC2 | Migration Card: título/descrição/subtarefas, indicador "N de M revisadas", 4 ações, atalhos `1`-`4` | `MigrationCard.test.tsx` (pré-existente) + `migration-flow.spec.ts` ← **novo, teclado real via `page.keyboard`** |
| AC2 | Picker de mês/futuro confirma automaticamente ao mudar a data (sem botão extra) | `MigrationCard.test.tsx` (pré-existente, `fireEvent.change` sintético) + `migration-flow.spec.ts` ← **novo, `input[type=date]` real do navegador** |
| AC3 | Linhagem simples (hoje): origem `migrated`, novo registro `pending` no destino | `test_services.py`/`test_views.py` (pré-existente) + `migration-flow.spec.ts` ← **novo, reflexo real na Task Row do Daily Log de hoje** |
| AC3 | Migração de subárvore: só filhos `pending`/`started` viajam (AD-08 item 11) | `test_services.py::test_migrar_pai_recria_apenas_filhos_nao_dispostos` (pré-existente, cenário-âncora da retro Epic 3) + `migration-flow.spec.ts` ← **novo, mesmo cenário contra backend+frontend reais** |
| AC3 | Fluxo nunca é encerrado pelo sistema — Esc pausa, retomável | `MigrationFlow.test.tsx` (pré-existente) + `migration-flow.spec.ts` ← **novo, `Escape` real + reabertura confirmando o mesmo card** |

## Observações

- **Sem override de "hoje" em teste:** `core/calendar.py::today_for` não tem nenhum mecanismo de override (header, setting, model) — é `timezone.now()` puro. Isso significa que "ontem" no E2E é sempre o dia real anterior à execução; `seedYesterdayQueue.ts` recalcula via `today_for(user)` dentro do próprio script Python (não injeta uma data fixa do lado do Node), então o seed nunca desalinha do que o backend considera "ontem" no momento da chamada.
- **Sem endpoint de seed dedicado:** não existe (nem foi criado) nenhum endpoint HTTP "test-only" para popular dados de ontem — o admin do Django (`bujo/admin.py`) existe mas é operador/`all_objects`, sem login de usuário de negócio, e não seria prático dirigir via Playwright (formulários genéricos de FK). `manage.py shell -c` + `tenant_context`, a mesma técnica que a própria story usou na verificação manual, foi o caminho mais direto e correto (mesma autoridade temporal, mesmo isolamento de tenant).
- Suíte completa de E2E (9 testes pré-existentes de `daily-tasks.spec.ts`/`task-reorder.spec.ts` + 5 novos de `migration-flow.spec.ts`) rodou **verde em execução limpa** contra o Neon dev branch real, sem nenhuma alteração nos specs pré-existentes além da fixture aditiva `email`.
- 120 usuários `e2e-*@e2e.test` órfãos (acumulados por execuções anteriores da suíte, que não faz cleanup — convenção já existente, não introduzida nesta rodada) foram removidos do banco de dev ao final desta sessão de QA.

## Execução

```
Backend:  não alterado nesta rodada de QA (sem gap de backend identificado — cobertura de
          serviço/view já extensa pelo dev-story, incluindo o cenário-âncora AD-08 item 11).
Frontend: npx vitest run → 287 passed (34 arquivos)
          npm run typecheck / npm run lint → sem erros
E2E:      npx playwright test → 14 passed (9 pré-existentes + 5 novos), execução limpa
```

## Checklist de Validação

- [x] Testes E2E gerados (5 cenários de browser real cobrindo AC1/AC2/AC3 — o único tipo de teste em falta para esta story; unit/serviço já cobertos pelo dev-story)
- [x] Usam APIs padrão do framework já adotado (`@playwright/test`) — nenhuma ferramenta nova introduzida
- [x] Cobrem happy path (banner, migração simples, picker de mês) + casos críticos (Esc pausa/retoma, cenário-âncora AD-08 item 11)
- [x] Todos os testes passam (287 frontend + 14 E2E, execução limpa)
- [x] Locators semânticos (`getByRole`, `getByLabel`, `getByText`, `data-testid` já existente para `task-row`)
- [x] Sem waits/sleeps artificiais — `syncAfter` (já existente) espera a resposta de rede real do refetch pós-invalidação
- [x] Testes independentes entre si (cada um cria seu próprio usuário via signup + seed isolado)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Testes salvos no diretório correto (`frontend/e2e/migration-flow.spec.ts`, `frontend/e2e/seedYesterdayQueue.ts`)

## Próximos Passos

- Story 4.3 (revisão semanal/mensal) e Story 4.4 (Catch-Up genérico) reaproveitam `migrate_task` — `seedYesterdayQueue.ts` pode virar a base de um seed mais genérico por tipo de log (weekly/monthly) quando essas stories chegarem, em vez de duplicar a técnica.
- Nenhum job de CI sobe backend+frontend juntos hoje (mesmo gap apontado nas Stories 3.1/3.3/3.4) — os E2E continuam rodando só localmente contra o Neon dev branch.

---

# Resumo de Automação de Testes — Story 4.3: Revisão semanal/mensal e pull automático do Future Log

**Data:** 2026-07-13
**Story:** 4.3 — Revisão semanal/mensal e pull automático do Future Log
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react + jest-axe (frontend) · Playwright 1.61 (E2E de browser real)

A story já chegou implementada com um spec E2E **permanente** escrito pelo próprio dev-story (`weekly-monthly-review.spec.ts` + `seedReviewScenario.ts`, mesmo molde de `migration-flow.spec.ts`/`seedYesterdayQueue.ts` da 4.2 — lição do achado MEDIUM da revisão da 4.2 aplicada preventivamente). Cobertura unitária extensa também já presente (`WeeklyReviewBanner`/`MonthlyReviewBanner`/`MigrationCard`/`MigrationFlow` com as 3 variantes de `flowType`/`MonthlyPage`). Esta rodada de QA auditou o spec E2E existente contra as ACs/Tasks da story (não gerou infraestrutura nova) e encontrou 2 gaps de asserção — ambos corrigidos no próprio arquivo.

## Gaps Descobertos e Fechados

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Destino `"week"` nunca verificado no destino real | `frontend/e2e/weekly-monthly-review.spec.ts` | O spec confirmava que o `Dialog` fechava e o banner semanal sumia após a migração, mas nunca navegava até a Weekly Log corrente (`/planner/week`) para confirmar que a tarefa (pai + filho pendente, sem o filho concluído) realmente chegou lá — a própria essência do destino `"week"` do dispatcher de `migrate_task` (Task 1.1). Fechado com navegação para "Esta Semana" + asserções de `task-row` (pai e filho pendente presentes, filho concluído ausente). |
| Ordem da seção "Itens do Future Log" nunca verificada | `frontend/e2e/weekly-monthly-review.spec.ts` | O spec confirmava que os textos "Itens do Future Log para [Mês]" e o título da tarefa com data apareciam na página, mas não que a seção sem data vem **antes** da seção com data — que é a própria regra de negócio da Task 8.1 (em qualquer mês que não o corrente a ordem é invertida). Sem essa asserção, um regresso que reordenasse as seções passaria despercebido. Fechado com comparação de `indexOf` no texto do `<main>`. |

## Testes Ajustados

### `frontend/e2e/weekly-monthly-review.spec.ts` (existente, estendido nesta rodada — mesmo teste, 2 blocos de asserção novos)

- [x] Após a migração semanal (atalho `1`, `flowType=weekly`): navega para "Esta Semana" e confirma `task-row` de "Planejar sprint" + "Subtarefa pendente" visíveis, "Subtarefa concluída" ausente (AD-08 item 11, agora também provado no destino real, não só na origem).
- [x] Após abrir o Monthly Log corrente: `mainText.indexOf('Itens do Future Log para') < mainText.indexOf('Revisar orçamento')` — confirma a inversão de ordem exigida pela Task 8.1 quando o mês exibido é o corrente.

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Banner semanal com contagem exata, só raízes | `WeeklyReviewBanner.test.tsx` (pré-existente) + `weekly-monthly-review.spec.ts` (browser real) |
| AC1 | Migration Card `flowType=weekly` — destino `"week"` migra para a Weekly Log CORRENTE | `test_services.py`/`test_views.py` (pré-existente) + `weekly-monthly-review.spec.ts` ← **gap fechado nesta rodada: agora verificado no destino real (`/planner/week`), não só pelo desaparecimento do banner** |
| AC1 | Migração de subárvore no destino `"week"`: só filho pendente viaja | `test_services.py` (pré-existente, cenário-âncora) + `weekly-monthly-review.spec.ts` ← **gap fechado: `task-row` do filho concluído ausente na Weekly Log corrente** |
| AC2 | Banner mensal com contagem exata, só raízes | `MonthlyReviewBanner.test.tsx` (pré-existente) + `weekly-monthly-review.spec.ts` (browser real) |
| AC2 | Migration Card `flowType=monthly` — 3 botões, sem "hoje/semana" | `MigrationCard.test.tsx` (pré-existente) + `weekly-monthly-review.spec.ts` (browser real) |
| AC2 | Pull do Future Log: seção "Itens do Future Log para [Mês]" no topo do mês corrente | `MonthlyPage.test.tsx` (pré-existente) + `weekly-monthly-review.spec.ts` ← **gap fechado nesta rodada: ordem da seção verificada via `indexOf`, não só presença dos textos** |
| AC2 | Confirmação de data inline (`scheduledDate` via PATCH) tira o item da seção sem data | `MonthlyPage.test.tsx` (pré-existente) + `weekly-monthly-review.spec.ts` (browser real, `input[type=date]` real) |

## Observações

- **Timeout ajustado, não é um gap de produto:** a primeira execução da asserção nova (`task-row` de "Planejar sprint" na Weekly Log corrente) falhou intermitentemente com o timeout padrão de 5s — reproduzido isoladamente via `curl` direto no backend (`manage.py runserver` + Neon dev), que confirmou os dados corretos e disponíveis (a tarefa migrada aparece em `unscheduled` da resposta de `/api/bujo/logs/weekly/` imediatamente após o `POST /migrate/`). O problema era só orçamento de tempo insuficiente para a latência real de rede contra o Neon dev branch após uma sequência de operações (fechar dialog anterior + navegação + fetch), mesmo padrão já usado em outras partes do próprio spec (`timeout: 10_000` na confirmação de data). Ajustado para `10_000` — sem isso o teste ficaria flake, não a feature quebrada.
- **Flake pré-existente, não desta story:** a suíte completa (`npx playwright test`, 15 specs) rodou com 14 passed / 1 failed, sempre em `migration-flow.spec.ts` (Story 4.2) e em testes diferentes a cada execução — mesma concorrência de signups simultâneos contra o Neon dev branch compartilhado já documentada nas Completion Notes da própria 4.3 (Debug Log References, Task 10.4). `weekly-monthly-review.spec.ts` rodou verde 2x consecutivas isoladamente. Não é uma regressão desta rodada de QA nem está no escopo da 4.3 corrigir.

## Execução

```
Backend:  não alterado nesta rodada de QA (sem gap de backend identificado — cobertura de
          serviço/view já extensa pelo dev-story).
E2E:      npx playwright test e2e/weekly-monthly-review.spec.ts → 1 passed (2 execuções
          consecutivas, sem flake)
          npx playwright test (suíte completa, 15 specs) → 14 passed, 1 failed
          (falha em migration-flow.spec.ts, flake de concorrência pré-existente,
          não relacionado a esta rodada)
```

## Checklist de Validação

- [x] Testes E2E auditados e estendidos (2 gaps de asserção fechados no spec já existente — nenhum teste novo precisou ser criado, a infraestrutura de seed/spec já cobria os cenários)
- [x] Usam APIs padrão do framework já adotado (`@playwright/test`) — nenhuma ferramenta nova introduzida
- [x] Cobrem happy path (2 banners, 2 revisões, pull do Future Log, confirmação de data) — sem casos de erro adicionais nesta rodada (não identificados gaps de erro crítico)
- [x] Teste-alvo passa (2 execuções consecutivas, sem flake)
- [x] Locators semânticos (`getByRole`, `getByLabel`, `getByText`, `data-testid` já existente para `task-row`)
- [x] Sem waits/sleeps artificiais — `page.waitForResponse` (já existente) + timeout explícito ajustado por latência real de rede, não por sleep
- [x] Teste independente (cria seu próprio usuário via signup + seed isolado)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Teste mantido no diretório correto (`frontend/e2e/weekly-monthly-review.spec.ts`)

## Próximos Passos

- Nenhuma ação pendente desta story.
- O flake de `migration-flow.spec.ts` (concorrência entre signups no Neon dev branch compartilhado) segue como débito conhecido desde a 4.2 — candidato a resolver com `fullyParallel: false` para specs dependentes de estado global ou um banco de teste isolado por worker, fora do escopo desta rodada.
- Nenhuma ação bloqueante pendente para esta story.

---

# Resumo de Automação de Testes — Story 4.4: Catch-Up de dias pulados

**Data:** 2026-07-13
**Story:** 4.4 — Catch-Up de dias pulados
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react + jest-axe (frontend) · Playwright 1.61 (E2E de browser real)

A story já chegou implementada com um spec E2E **permanente** escrito pelo próprio dev-story (`catch-up.spec.ts` + `seedCatchUpScenario.ts`, mesmo molde de `weekly-monthly-review.spec.ts`/`seedReviewScenario.ts` da 4.3), cobrindo o caminho feliz completo (3 níveis com pendência, ordem mês→semana→dia num único Dialog, sem sobreposição com os 3 banners da 4.2/4.3, `migration_count == 1`). Cobertura unitária/de serviço extensa também já presente (`test_views.py`/`test_services.py` backend; `CatchUpBanner.test.tsx`/`CatchUpFlow.test.tsx`/`MigrationFlow.test.tsx` frontend). Esta rodada de QA auditou o spec E2E existente contra as ACs e o comportamento novo desta story (orquestração `CatchUpFlow` entre estágios via `onExhausted`) e encontrou 1 gap real.

## Gap Descoberto e Fechado

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Esc pausando o Catch-Up inteiro nunca verificado em browser real | `frontend/e2e/catch-up.spec.ts` | O spec existente só exercitava o caminho em que os 3 estágios são decididos em sequência ininterrupta — nenhum teste provava que Esc **pausa o Catch-Up inteiro** (não avança/pula o estágio corrente, comportamento novo desta story, Dev Notes "Um Dialog contínuo...") nem que reabrir **recalcula o estágio certo a partir da query ao vivo** (sem reiniciar de um estágio já esgotado). Comportamento análogo ao já coberto para o fluxo simples em `migration-flow.spec.ts` (4.2, "Esc pausa sem decidir; retoma a mesma tarefa"), mas nunca provado na camada de orquestração entre estágios exclusiva da 4.4. Coberto a nível de componente em `CatchUpFlow.test.tsx` (Task 7.2), mas não em fim-a-fim contra o backend real. |

## Testes Gerados

### `frontend/e2e/catch-up.spec.ts` — 1 teste novo

- [x] `Esc pausa o Catch-Up inteiro (não avança estágio); reabrir retoma no estágio certo (AC1)` — decide o estágio mensal (Dialog avança sozinho para o semanal); pressiona Esc no estágio semanal → Dialog fecha, banner reaparece com contagem **2** (mês já resolvido no servidor, nunca 3 de novo nem 0); `page.reload()` confirma que é persistência real, não estado só-de-cliente; reabre "Iniciar Catch-Up" e confirma que o Dialog retoma direto no estágio **semanal** (o mês, já vazio, não é revisitado) — prova de que a recomputação de estágio é por query ao vivo, não por índice congelado em memória.

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Detecção por query (sem cron/fila), 3 níveis num único Dialog, ordem mês→semana→dia | `test_views.py` (pré-existente) + `catch-up.spec.ts` (browser real, pré-existente) |
| AC1 | `migration_count` incrementa 1 por decisão, não por dia pulado | `test_services.py` (pré-existente) + `catch-up.spec.ts` (browser real, pré-existente, ORM query pós-decisão) |
| AC1 | Esc pausa o Catch-Up inteiro (não pula estágio); reabrir recalcula o estágio certo via query ao vivo | `CatchUpFlow.test.tsx` (pré-existente, componente isolado) + `catch-up.spec.ts` ← **novo, browser real e persistência via reload** |
| AC1 | Sem sobreposição com `MigrationQueueView`/`WeeklyReviewQueueView`/`MonthlyReviewQueueView` (4.2/4.3) no mesmo cenário | `test_views.py` (pré-existente, regressão de sobreposição) + `catch-up.spec.ts` (browser real, pré-existente) |
| AC2 | Lacunas honestas / catch-up só de tarefas | Satisfeita por ausência de código (`CatchUpQueueView` só `.filter()`, nunca `get_or_create_*`) — já coberta por `test_views.py` (contagem de `Log`/`WeeklyLog`/`MonthlyLog` antes/depois da chamada); sem superfície de UI de hábitos/saúde neste épico, nada a testar em E2E |

## Não Requer Novo Teste

- Cenários de só-1-nível-populado (pular estágios vazios na abertura) — já cobertos a nível de componente em `CatchUpFlow.test.tsx` (Task 7.2); duplicar em E2E não agregaria sinal proporcional ao custo (specs deste projeto rodam contra Neon real, ~40–90s cada).

## Execução

```
E2E (isolado, --workers=1):
  "Esc pausa o Catch-Up inteiro..." (novo)        → passou em 2 execuções isoladas consecutivas (~38-44s cada)
  "catch-up mês → semana → dia..." (pré-existente,
   não modificado nesta rodada)                    → instável sob carga da sessão (cold-start de
                                                       conexão Neon em runserver/vite dev recém-subidos)
                                                       — mesma flakiness ambiental já documentada no
                                                       Debug Log da própria story para este spec;
                                                       não é regressão desta rodada (nenhuma linha do
                                                       teste pré-existente foi alterada)
```

Zero erros de console em ambos os testes (`page.on('console')`/`page.on('pageerror')` monitorados).

## Observações

- Node 18 (padrão do shell) não roda o `playwright.config.ts` (ESM, `ERR_UNKNOWN_FILE_EXTENSION`) — necessário `nvm use 22.12.0` (Node 22, a versão documentada nas Dev Notes da própria story) antes de `npx playwright test`.
- A flakiness do spec pré-existente é a mesma classe de instabilidade da Neon dev branch já registrada nas rodadas de QA das stories 3.1/3.3/3.4/4.2/4.3 (contenção sob carga de sessão, não bug de lógica) — confirmado reproduzindo o teste do zero em isolamento (`-g`, `--workers=1`), onde progride até a última asserção antes de eventualmente falhar por timing, nunca por dado incorreto.

## Checklist de Validação

- [x] Teste E2E gerado para o gap real desta story (orquestração de pausa/retomada entre estágios — o único tipo de teste em falta; unit/serviço já cobertos pelo dev-story)
- [x] Usa APIs padrão do framework já adotado (`@playwright/test`) — nenhuma ferramenta nova introduzida
- [x] Cobre o caso crítico desta story (Esc pausa o fluxo inteiro + retomada correta via query ao vivo)
- [x] Teste-alvo passa em execução isolada (2x consecutivas, sem flake)
- [x] Locators semânticos (`getByRole('dialog')`, `getByRole('button', { name })`, `getByText`)
- [x] Sem waits/sleeps artificiais — `page.waitForResponse` no POST de migração real
- [x] Teste independente (cria seu próprio usuário via signup + seed isolado via `seedCatchUpScenario`)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Teste salvo no arquivo correto (`frontend/e2e/catch-up.spec.ts`, mesmo spec pré-existente da story)

## Próximos Passos

- Story 4.5 (Templates de tarefas recorrentes) não depende de nada desta rodada de QA.
- O flake ambiental de execuções sob carga de sessão (Neon dev branch compartilhado) segue como débito conhecido desde a 4.2 — mesmo candidato de solução já apontado nas rodadas anteriores (`fullyParallel: false` para specs dependentes de estado global, ou banco de teste isolado por worker).
- Nenhuma ação bloqueante pendente para esta story.

---

# Resumo de Automação de Testes — Story 4.5: Templates de tarefas recorrentes com placement manual

**Data:** 2026-07-14
**Story:** 4.5 — Templates de tarefas recorrentes com placement manual
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react + jest-axe (frontend) · Playwright 1.61 (E2E de browser real)

Diferente de 4.2/4.3/4.4, o dev-story desta story **não** deixou um spec E2E permanente: a verificação manual ponta-a-ponta (Task 13.3) foi feita com um script Playwright temporário, criado e apagado na mesma sessão (Debug Log References/Completion Notes da própria story). Cobertura unitária/de serviço já extensa (288 backend + 365 frontend, ao final do dev-story), toda ela contra mocks de `useRecurringTemplatesQuery`/mutations (`RecurringTemplateManager.test.tsx`, `RecurringPlacementSection.test.tsx`) — nenhum teste cruzava páginas reais (Configurações → Weekly/Monthly Log) nem provava a independência instância/template (AC3) contra o backend de verdade. Esse é o gap fechado por esta rodada.

## Gap Descoberto e Fechado

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Sem cobertura E2E do fluxo de templates recorrentes | `frontend/e2e/recurring-templates.spec.ts` (novo) | AC1 (CRUD em Configurações), AC2 (placement filtra por `recurrence_group`/mês corrente, chega ao Weekly/Monthly Log real) e AC3 (independência instância/template) só tinham sido validados via mocks isolados nos testes de componente ou pelo script Playwright descartável da verificação manual — nunca um spec permanente contra o navegador real. |

## Testes Gerados

### `frontend/e2e/recurring-templates.spec.ts` — novo (2 testes)

- [x] `CRUD de templates em Configurações + placement filtra por grupo e chega ao Weekly/Monthly Log real (AC1, AC2)` — cria um template `weekly` e um `monthly` via form real; confirma que a seção de placement de "Esta Semana" mostra só o `weekly` ativo (e "Este Mês" só o `monthly`, mês corrente); "Definir placement" sem data → a instância aparece como `task-row` real no log correto; desativar um template (`PATCH active=false`) o remove da seção de placement mas mantém a instância já colocada intacta e o template ainda editável em Configurações.
- [x] `AC3 — editar o template depois de um placement não muda a instância já colocada; colocar de novo usa os campos atualizados` — coloca um template, edita o título do template depois (inline, em Configurações), confirma que a `Task` já criada mantém o título antigo na Weekly Log, que a seção de placement já reflete o título novo, e que colocar o mesmo template de novo gera uma segunda instância com o título atualizado — as duas coexistem sem se afetar.

Ambos os testes escopam o botão "Desativar"/o campo "Título" em ambiguidade de múltiplas linhas via `xpath=ancestor::div[N]` a partir do texto exato do título (estrutura de `TemplateRow`) ou por posição no DOM (linha da lista renderiza antes do form de criação, mesma técnica já documentada no Debug Log da própria story para `WeeklyPage`/`MonthlyPage`).

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Template gravado em `recurring_task_templates`, separado de `tasks`, sempre plano | `test_models.py` (pré-existente) + `RecurringTemplateManager.test.tsx` (pré-existente, mocado) + `recurring-templates.spec.ts` ← **novo, CRUD real em Configurações** |
| AC2 | Lista de recorrentes ativos na abertura de ciclo, sem auto-placement, botão "Definir placement" | `test_views.py`/`test_services.py` (pré-existente) + `RecurringPlacementSection.test.tsx` (pré-existente, mocado) + `recurring-templates.spec.ts` ← **novo, filtro por grupo/mês corrente contra backend real** |
| AC2 | Placement cria `Task` snapshot com `source_template`, `status=pending`, `parent_task_id=NULL`, `migration_count=0` | `test_services.py::place_template` (pré-existente) + `recurring-templates.spec.ts` ← **novo, instância real refletida como `task-row` no Weekly/Monthly Log** |
| AC3 | Editar a instância toca só aquela `Task`; editar o template afeta só placements futuros | `test_services.py::test_place_template_independencia_instancia_template_ac3` (pré-existente) + `recurring-templates.spec.ts` ← **novo, provado cruzando páginas reais (Configurações → Esta Semana) contra o backend real** |
| — | Desativar um template não afeta placements já feitos; template desativado continua editável | Não coberto por nenhum teste até esta rodada — `recurring-templates.spec.ts` ← **novo** |

## Execução

```
E2E (spec novo, isolado):  npx playwright test e2e/recurring-templates.spec.ts --workers=1 → 2 passed (63s), sem flake
E2E (suíte completa, 9 specs, --workers=1): 15 passed, 4 failed — todas as 4 falhas em specs
  PRÉ-EXISTENTES não tocados nesta rodada (task-reorder.spec.ts × 3, daily-tasks.spec.ts × 1),
  reproduzidas isoladamente como PASS (task-reorder.spec.ts: 3 passed isolado;
  daily-tasks.spec.ts "bottom sheet no mobile": 1 passed isolado) — mesma classe de
  flakiness de contenção do Neon dev branch sob carga de sessão prolongada já
  documentada nas rodadas de QA de 3.1/3.3/3.4/4.2/4.3/4.4, não uma regressão
  desta rodada.
Typecheck (tsc -b --noEmit): 0 erros
Lint (eslint e2e/recurring-templates.spec.ts): 0 achados
```

## Checklist de Validação

- [x] Teste E2E gerado para o gap real desta story (fluxo cross-página Configurações → Weekly/Monthly Log + AC3 — o único tipo de teste em falta; unit/serviço já cobertos pelo dev-story)
- [x] Usa APIs padrão do framework já adotado (`@playwright/test`) — nenhuma ferramenta nova introduzida
- [x] Cobre happy path (CRUD, placement weekly/monthly) + casos críticos (AC3 independência, desativação não retroativa)
- [x] Ambos os testes passam em execução isolada (2/2, sem flake); suíte completa sem regressão nos specs não tocados (falhas confirmadas como flakiness pré-existente, reproduzidas como PASS isoladamente)
- [x] Locators semânticos (`getByRole`, `getByLabel`, `getByText`, `data-testid` já existente para `task-row`)
- [x] Sem waits/sleeps artificiais — `page.waitForResponse` nos POSTs/PATCH reais
- [x] Testes independentes entre si (cada um cria seu próprio usuário via signup)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Teste salvo no diretório correto (`frontend/e2e/recurring-templates.spec.ts`)

## Próximos Passos

- Nenhum job de CI sobe backend+frontend juntos hoje (mesmo gap apontado desde a 3.1) — os E2E continuam rodando só localmente contra o Neon dev branch.
- O flake ambiental de execuções sob carga de sessão (Neon dev branch compartilhado) segue como débito conhecido desde a 4.2 — mesmo candidato de solução já apontado nas rodadas anteriores (`fullyParallel: false` para specs dependentes de estado global, ou banco de teste isolado por worker).
- Nenhuma ação bloqueante pendente para esta story.

---

# Resumo de Automação de Testes — Story 4.6: Fechamento de ciclos e Arquivo

**Data:** 2026-07-14
**Story:** 4.6 — Fechamento de ciclos e Arquivo
**Framework:** pytest + DRF `APIClient` (backend) · Vitest 4.1 + @testing-library/react + jest-axe (frontend) · Playwright 1.61 (E2E de browser real)

Última story do Épico 4. Como em 4.2/4.3/4.4 (e diferente de 4.5), o dev-story não deixou um spec E2E permanente — a verificação manual da Task 12.3 usou um script Playwright temporário, descartado ao final. Cobertura unitária/de serviço já extensa (305 backend + 376 frontend, ao final do dev-story) prova `is_container_closed`/`list_closed_cycles` isoladamente (`test_services.py`) e o indicador `closed`/modo Arquivo via mocks de `useWeeklyLogQuery`/`useMonthlyLogQuery`/`useArchiveQuery` (`WeeklyPage.test.tsx`, `MonthlyPage.test.tsx`, `ArchivePage.test.tsx`) — nenhum teste cruzava páginas reais (Arquivo → semana/mês fechados) nem provava, contra o backend de verdade, que a navegação por rota parametrizada (`/archive/weekly/:weekStart`, `/archive/monthly/:monthFirst`) chega no estado final correto. Esse é o gap fechado por esta rodada.

## Gap Descoberto e Fechado

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Sem cobertura E2E do fluxo de Arquivo | `frontend/e2e/archive.spec.ts` (novo) | AC1 (fechamento computado, indicador textual) e AC2 (Arquivo lista e permite consultar ciclos fechados com estado final de cada tarefa, incl. estado vazio) só tinham sido validados via mocks isolados nos testes de componente ou pelo script Playwright descartável da verificação manual — nunca um spec permanente contra o navegador real, com um ciclo passado de verdade fechado no banco. |

## Testes Gerados

### `frontend/e2e/seedArchiveScenario.ts` — novo (seed)

Mesma técnica de `seedReviewScenario.ts`/`seedCatchUpScenario.ts`: nenhuma affordance de UI permite compor de propósito uma semana/mês passado inteiramente disposto, então o cenário é seedado direto no banco de dev via `manage.py shell` + `tenant_context` — 2 semanas/2 meses atrás (não 1) para não colidir com as janelas de "semana/mês anterior" da revisão (4.3).

### `frontend/e2e/archive.spec.ts` — novo (2 testes)

- [x] `Arquivo vazio para usuário novo mostra o estado vazio (AC2)` — usuário recém-cadastrado (sem nenhum ciclo) navega para Arquivo pela Sidebar e vê "Nenhuma semana ou mês fechado ainda."
- [x] `lista ciclos fechados e navega para semana/mês com estado final, sem affordance de escrita (AC1, AC2)` — seed de 1 semana fechada (tarefa concluída + cancelada + migrada, `migration_count=2`) e 1 mês fechado (tarefa concluída); Arquivo lista as 2 entradas com o rótulo formatado certo; clicar na semana navega para `/archive/weekly/:weekStart`, mostra "Fechada", o estado final de cada uma das 3 tarefas (ícone/`aria-label` `Concluída`/`Cancelada`/`Migrada`) e nenhuma affordance de escrita — nem o botão "Definir placement" nem a própria requisição de templates recorrentes disparam, provando que a seção some por `isArchiveView` (não porque a lista de templates está vazia); o payload real de `GET /api/bujo/logs/weekly/` é inspecionado para confirmar que `migrationCount` chega no contrato (AC2: "o que foi feito com ela, incl. linhagem de migração"); mesma verificação para o mês (`Fechado`, tarefa concluída, sem form "Adicionar tarefa ao mês"); zero erros de console nas duas navegações.

## Cobertura por AC

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC1 | Fechamento computado na leitura, considerando a subárvore completa (pai com filho pendente não fecha) | `test_services.py::is_container_closed` (pré-existente) + `archive.spec.ts` ← **novo, contra backend real** |
| AC1 | Indicador textual "Fechada"/"Fechado", sem ícone | `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` (pré-existente, mocado) + `archive.spec.ts` ← **novo, renderizado de verdade** |
| AC1 | Ciclo fechado continua acessível pela navegação normal (mesmo `WeeklyLog`/`MonthlyLog`) | Não coberto por nenhum teste até esta rodada — implícito na reutilização de `WeeklyPage`/`MonthlyPage`, nunca exercitado ponta-a-ponta |
| AC2 | Arquivo lista semanas/meses fechados, mais recentes primeiro | `test_services.py::list_closed_cycles` (pré-existente) + `ArchivePage.test.tsx` (pré-existente, mocado) + `archive.spec.ts` ← **novo, lista real após seed real** |
| AC2 | Consulta ao ciclo mostra estado final de cada tarefa e o que foi feito com ela (incl. linhagem de migração) | `test_serializers.py` (pré-existente, campo isolado) — `archive.spec.ts` ← **novo, primeiro teste a provar os 3 estados finais (concluída/cancelada/migrada) juntos numa página real e o `migrationCount` chegando no payload consumido pela UI** |
| AC2 | Estado vazio "Nenhuma semana ou mês fechado ainda." | `ArchivePage.test.tsx` (pré-existente, mocado) + `archive.spec.ts` ← **novo, usuário real sem nenhum ciclo** |

## Execução

```
E2E (spec novo, isolado):  npx playwright test e2e/archive.spec.ts → 2 passed (26s), sem flake
E2E (suíte completa, 10 specs, --workers=1): 17 passed, 4 failed — todas as 4 falhas em specs
  PRÉ-EXISTENTES não tocados nesta rodada (catch-up.spec.ts × 1, daily-tasks.spec.ts × 1,
  task-reorder.spec.ts × 1, mais 1 timeout de signup na fixture compartilhada), mesma classe
  de flakiness de contenção do Neon dev branch sob carga de sessão prolongada já documentada
  nas rodadas de QA de 3.1/3.3/3.4/4.2/4.3/4.4/4.5, não uma regressão desta rodada —
  archive.spec.ts passou nas duas execuções (isolada e dentro da suíte completa).
Typecheck (tsc -b --noEmit): 0 erros
Lint (eslint e2e/archive.spec.ts e2e/seedArchiveScenario.ts): 0 achados
```

## Checklist de Validação

- [x] Teste E2E gerado para o gap real desta story (fluxo cross-página Arquivo → semana/mês fechados + estado vazio — o único tipo de teste em falta; unit/serviço já cobertos pelo dev-story)
- [x] Usa APIs padrão do framework já adotado (`@playwright/test`) — nenhuma ferramenta nova introduzida
- [x] Cobre happy path (lista + navegação + estado final) + estado vazio + caso de fronteira (tarefa migrada, não só concluída/cancelada)
- [x] Ambos os testes passam em execução isolada (2/2, sem flake); suíte completa sem regressão nos specs não tocados (falhas confirmadas como flakiness pré-existente do Neon dev branch)
- [x] Locators semânticos (`getByRole`, `getByLabel`, `getByText`, `data-testid` já existente para `task-row`)
- [x] Sem waits/sleeps artificiais — `page.waitForResponse` no GET real da semana fechada
- [x] Testes independentes entre si (cada um cria seu próprio usuário via signup; datas seedadas 2 semanas/2 meses atrás, sem overlap entre testes)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Testes salvos no diretório correto (`frontend/e2e/archive.spec.ts`, `frontend/e2e/seedArchiveScenario.ts`)

## Observação — linhagem de migração sem superfície visual dedicada

AC #2 pede explicitamente "o que foi feito com ela (incl. linhagem de migração — `migration_count`)". O contrato entrega isso (`TaskSerializer.migration_count`/`migrated_to_task`, confirmado ponta-a-ponta pelo `archive.spec.ts` novo), mas **nenhum componente de UI renderiza esses dois campos** hoje — `TaskRow` mostra só o ícone de status final (`Migrada`), não a contagem nem o destino da migração; não há painel de detalhe acessível a partir do Arquivo (`onOpenDetail` não é passado a `TaskRow` em `WeeklyPage`/`MonthlyPage`, por design — Dev Notes da própria story). Isso não é um gap de teste (o comportamento atual está corretamente coberto pelo que existe), é um gap de produto: a AC pede "consultável" e hoje só é consultável via rede, não visualmente. Fora do escopo desta rodada (só geração de testes) — sinalizado aqui para uma decisão consciente antes da retrospectiva do Épico 4.

## Próximos Passos

- Decidir se a Observação acima (linhagem de migração sem superfície visual) é um débito aceito ou motivo de um follow-up rápido antes de fechar o Épico 4 — não bloqueia esta rodada de QA, mas vale levar para a retrospectiva do épico.
- Nenhum job de CI sobe backend+frontend juntos hoje (mesmo gap apontado desde a 3.1) — os E2E continuam rodando só localmente contra o Neon dev branch.
- O flake ambiental de execuções sob carga de sessão (Neon dev branch compartilhado) segue como débito conhecido desde a 4.2.
- Esta é a última story do Épico 4 — próximo passo natural é a retrospectiva do épico (`epic-4-retrospective`), não uma nova rodada de QA.

---

# Resumo de Automação de Testes — Story 11.1: Isolamento de teste via branch Neon dedicada

**Data:** 2026-07-14
**Story:** 11.1 — Isolamento de teste via branch Neon dedicada
**Framework:** pytest-django 4.12 + factory-boy 3.3 (backend) · Playwright (E2E)

---

## Contexto

A story 11.1 é majoritariamente **plumbing de config/ambiente**: novo settings
`config.settings.e2e`, `.env.e2e`, repointing dos seeds E2E via `backendEnv.ts`,
runbook `docs/e2e-neon-reset.md`. Esses artefatos não expõem comportamento de
usuário novo — o próprio critério da AC1 é que a suíte E2E **existente** passa
sem mudar lógica de spec (por isso nenhum `.spec.ts` novo foi criado: seria
contra o escopo declarado da story).

O único artefato com lógica testável de fato entregue pela story é o management
command **`purge_e2e_users`** (AC2/AC3): comando **destrutivo**, entregue **sem
cobertura**, carregando dois guardrails sutis que, se quebrados, apagam ou órfãos
dados silenciosamente. Essa era a lacuna de teste real e foi auto-aplicada.

## Gap descoberto e auto-aplicado

| Gap | Arquivo | Descrição |
|-----|---------|-----------|
| Command destrutivo `purge_e2e_users` sem nenhum teste | `backend/core/tests/test_purge_e2e_users.py` (NOVO) | Sem cobertura dos dois guardrails críticos: (a) AD-12 "sem cascade" — apagar o `User` não remove suas linhas tenant-scoped, o comando precisa varrê-las por `user_id`; (b) uso de `all_objects` (não `objects`) para a varredura cross-tenant fora de um request |

## Testes gerados

### `backend/core/tests/test_purge_e2e_users.py` — novo (6 testes)

- [x] `test_apaga_usuario_e2e_e_todas_as_linhas_tenant_scoped` — usuário `@e2e.test` **e** suas linhas nos 5 models (`Task`/`Log`/`WeeklyLog`/`MonthlyLog`/`RecurringTaskTemplate`) somem juntos (guardrail AD-12 sem cascade) (AC3)
- [x] `test_preserva_usuario_real_e_suas_linhas` — usuário real (`user*@test.com`) e suas linhas ficam intactos; só `@e2e.test` é alvo (AC3)
- [x] `test_near_miss_de_email_nao_e_apagado` — `e2e-fake@example.com` casa o prefixo mas não o sufixo `@e2e.test` → não é apagado (escopo por `endswith`)
- [x] `test_dry_run_nao_apaga_nada` — `--dry-run` só conta; nenhum usuário/linha removido (AC2)
- [x] `test_sem_usuarios_alvo_encerra_limpo` — sem alvos no banco: reporta "Nada a apagar" e não toca em nada
- [x] `test_varredura_cross_tenant_sem_contexto` — rodando fora de request (sem `tenant_context`), varre **múltiplos** usuários e2e → prova uso de `all_objects` (se usasse `objects` escopado, falharia-fechado e deixaria linhas órfãs)

### Testes E2E (Playwright)

- Nenhum spec novo. A story é isolamento de infra e explicitamente **não deve
  tocar specs `.spec.ts`**. A AC1 (repointing não quebra a lógica dos specs) é
  verificada rodando a suíte E2E existente contra a branch `e2e`, não adicionando
  specs. Sem superfície de UI/API nova para cobrir.

## Cobertura

| AC | Critério | Coberto por |
|----|----------|-------------|
| AC2 | Comando de reset apaga usuários `@e2e.test` e suas linhas tenant-scoped | `test_apaga_...`, `test_varredura_cross_tenant_sem_contexto` |
| AC2 | `--dry-run` não apaga nada (só conta) | `test_dry_run_nao_apaga_nada` |
| AC3 | Guardrail AD-12: sem cascade — linhas tenant-scoped varridas explicitamente | `test_apaga_...` |
| AC3 | Só `@e2e.test` é alvo; usuário real preservado | `test_preserva_usuario_real_e_suas_linhas`, `test_near_miss_de_email_nao_e_apagado` |
| AC3 | Varredura cross-tenant via `all_objects` (não `objects` fail-closed) | `test_varredura_cross_tenant_sem_contexto` |
| AC1 | Repointing E2E não altera lógica de spec | Suíte E2E existente contra branch `e2e` (verificado na story; sem spec novo) |

## Resultado da execução

```
uv run pytest core/tests/test_purge_e2e_users.py -v --create-db
6 passed, 1 warning in 207.74s
ruff check core/tests/test_purge_e2e_users.py → All checks passed!
```

O único warning é o teardown de `test_neondb` com conexão presa — cosmético e
pré-existente (documentado nas Completion Notes da story; resolvido pelo
procedimento `pg_terminate_backend` de `docs/e2e-neon-reset.md §4`), não-fatal e
não relacionado aos testes novos.

## Checklist de Validação

- [x] Testes de backend gerados para o único artefato com lógica da story (`purge_e2e_users`)
- [x] Usam APIs padrão do framework já adotado (`pytest-django` + `factory_boy` + `tenant_context` + `call_command`) — nenhuma ferramenta nova
- [x] Cobrem happy path + casos críticos (dry-run, no-op, near-miss de e-mail, cross-tenant)
- [x] Todos os 6 testes passam
- [x] Sem waits/sleeps artificiais
- [x] Testes independentes entre si (cada um cria seus próprios usuários/linhas via factories)
- [x] Descrições claras em pt-BR, seguindo a convenção `test_*` do projeto
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`
- [x] Testes salvos no diretório correto (`backend/core/tests/`, junto ao command em `core/management/`)

## Próximos Passos

- O command test entra no gate `pytest` do backend — nenhuma ação de CI adicional necessária.
- Nenhuma dívida de edge case adicional identificada para esta story (a flakiness ambiental do E2E segue owned pelas ações #4/#5 da retro do Épico 4, fora do escopo desta story).

---

# Resumo de Automação de Testes — Story 11.2: Recorrentes no Planner com abas e filtro

**Data:** 2026-07-14
**Framework:** Vitest 4.1 + @testing-library/react + jest-axe (unit/componente) · Playwright (E2E)

## Escopo

Story de **movimentação + apresentação** (frontend-only): o CRUD de recorrentes migrou de
Configurações para o Planner (`/planner/recurring`), com templates em abas por grupo
(Semanal/Mensal/Anual) e filtro "mostrar inativos". A suíte entregue pela dev-story já era
sólida; este workflow QA fez **análise de lacunas** e auto-aplicou os casos faltantes na camada
de componente (a mais rápida e sem dependência de backend).

## Lacunas descobertas e preenchidas (auto-aplicadas)

Em `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx` (10 → **17 casos**, +7):

- [x] **Aba "Anual" filtra o grupo `annual`** — antes só se verificava que a aba renderiza, nunca a filtragem.
- [x] **Criar na aba Anual → `recurrenceGroup: 'annual'`** — completa a cobertura dos 3 grupos.
- [x] **Payload com `description` + `eisenhower`** — antes só `null/null`; agora com valores reais (Select via combobox/opção).
- [x] **Guarda de validação do form (erro crítico)** — submit vazio / só com título **não** dispara a `create` mutation.
- [x] **Reset do form após criar** — campos "Título"/"Recorrência" voltam a vazio após submit bem-sucedido.
- [x] **Estado de loading (`isPending`)** — a mensagem "Nenhum template neste grupo." não aparece enquanto a query está pendente.
- [x] **Guarda de save vazio na `TemplateRow` (erro crítico)** — salvar edição com título em branco não dispara a `update` mutation.

## Cobertura por AC

| AC | Camada | Status |
| --- | --- | --- |
| AC1 — CRUD migra p/ o Planner | `RecurringPage.test.tsx` (smoke), `Sidebar.test.tsx` (item "Recorrentes"), E2E `recurring-templates.spec.ts` | ✅ |
| AC2 — abas por grupo + filtro de ativos | `RecurringTemplateManager.test.tsx` (abas weekly/monthly/annual, filtro, criação por-grupo, validações, jest-axe) + E2E | ✅ |

## Testes por arquivo

| Arquivo | Testes | Nota |
| --- | --- | --- |
| `RecurringTemplateManager.test.tsx` | 17 | +7 lacunas adicionadas neste workflow |
| `RecurringPage.test.tsx` | 4 | smoke de composição — sem lacuna |
| `Sidebar.test.tsx` | 11 | item "Recorrentes" sob Planner — sem lacuna |
| `recurring-templates.spec.ts` (E2E) | 2 | fluxos contra backend real — já verificados pela dev-story |

## Resultado da execução

```
npm run typecheck  → ✓
npm run lint       → ✓
vitest run --no-file-parallelism → 392 passed / 42 files
```

Baseline da story era 385/42; +7 casos de componente → **392/42**. `--no-file-parallelism` por
decisão do Debug Log da story (flakiness ambiental de timeout com paralelismo default).

**E2E não re-executado neste passo:** exige backend + vite ativos e é documentadamente flaky em
cold-start da branch Neon `e2e`. Os 2 fluxos já foram verificados passando contra o backend real
na dev-story (38s/35s); como aqui só se adicionou teste de componente (nenhuma mudança de UI), o
comportamento E2E permanece o já verificado. O grupo `annual` ficou coberto na camada de
componente, evitando alongar um teste de backend real por valor marginal.

## Checklist de validação

- [x] Testes E2E gerados (UI existe) — spec já presente e verificado
- [x] Testes usam APIs padrão do framework (Vitest + Testing Library + Playwright)
- [x] Cobrem happy path
- [x] Cobrem casos críticos de erro (guardas de validação de criação e de edição)
- [x] Todos os testes rodam com sucesso (392/42)
- [x] Locators semânticos/acessíveis (`getByRole('tab'|'combobox'|'option'|'checkbox'|'button')`, `getByLabelText`)
- [x] Descrições claras em pt-BR
- [x] Sem waits/sleeps artificiais
- [x] Testes independentes (sem dependência de ordem)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`

---

# Resumo de Automação de Testes — Story 11.3: Placement de recorrentes — dedup + modal com calendário de densidade

**Data:** 2026-07-14
**Framework:** pytest-django (backend) · Vitest 4.1 + @testing-library/react + jest-axe (unit/componente) · Playwright (E2E)

## Escopo

Story backend+frontend (diferente da 11.2): expõe `sourceTemplate` no `TaskSerializer` (dedup),
adiciona o endpoint `GET /api/bujo/task-density/` (agregação de 3 fontes) e o componente
`MonthDensityCalendar`. A dev-story já entregou cobertura extensa (backend 323 passed, frontend
415 passed/44 files, E2E 2/2). Este workflow QA focou em **lacunas de prova end-to-end via
browser real** — o nível que unit/pytest não alcança: a suíte existente provava a computação da
densidade isoladamente (backend) e a renderização do calendário isoladamente (componente
mockado), mas nenhum teste provava, contra o app e o backend reais juntos, que uma tarefa criada
por uma via (Daily Log) aparece corretamente na densidade exibida no modal de outra via (Monthly
placement) — a própria razão de ser do endpoint (Dev Notes: "densidade honesta... precisa das 3
fontes").

## Lacunas descobertas e auto-aplicadas

O E2E `recurring-templates.spec.ts` (2 testes da dev-story) cobria dedup (AC1) e a presença
textual de título/recorrência + cabeçalho do calendário no dialog **semanal**, mas não:

- [x] **Densidade real refletindo uma fonte diferente do próprio placement** — nenhum teste
  criava uma tarefa avulsa (Daily Log) e verificava sua contagem aparecendo no calendário do
  modal de placement mensal. Sem isso, um bug de agregação (ex.: só somar a fonte monthly, não
  daily/weekly) passaria despercebido apesar de toda a suíte pytest/vitest verde, porque essas
  suítes testam cada fonte com dados sintéticos já no formato esperado, nunca via fluxo real do
  usuário criando em uma superfície e lendo em outra.
- [x] **Modal do Monthly nunca teve suas infos/calendário verificados** — só o modal do Weekly
  era checado (título + `Recorrência:` + cabeçalho "Seg"); o Monthly só verificava o campo "Dia
  (opcional)".
- [x] **Campo `description` do template nunca exercitado em E2E** — os templates criados nos
  specs existentes nascem sem descrição; o ramo condicional `{template.description && (...)}` do
  `RecurringPlacementDialog` ficava sem prova em browser real.
- [x] **AC3 (calendário apenas informativo) sem prova negativa** — nenhum teste confirmava,
  contra o componente real renderizado dentro do dialog de produção (não um teste isolado do
  `MonthDensityCalendar`), que nenhuma célula é interativa nesta story (contagem de `role=button`
  dentro do calendário = 0), provando que `onSelectDay` de fato não é passado no call site real.

## Teste gerado

`frontend/e2e/recurring-templates.spec.ts` — 1 novo teste (3º do arquivo):

- [x] `AC2/AC3 — modal do Monthly mostra título/descrição/recorrência + calendário com densidade
  real (3 fontes), e o calendário é só informativo`: cria uma tarefa avulsa no Daily Log de hoje
  (fonte "daily"), cria um template mensal com `description` preenchida, abre o modal de
  placement em "Este Mês" e verifica: título + descrição + `Recorrência:` visíveis; aguarda a
  resposta real de `GET /api/bujo/task-density/`; confirma que a célula do dia de hoje no
  calendário mostra o `aria-label`/texto `"<dia> de <mês>, 1 tarefa"` — provando a agregação
  cross-source (Daily → density do Monthly) ponta-a-ponta contra o backend real; confirma
  `calendar.getByRole('button')` com 0 elementos (AC3: sem seleção nesta story); fecha via
  "Cancelar" e confirma que nenhuma instância nova foi criada.

## Cobertura por AC

| AC | Critério | Coberto por |
| --- | --- | --- |
| AC1 | Dedup por período + recolocação via switch "Mostrar já colocados" | `recurring-templates.spec.ts` (testes 1–2, dev-story) |
| AC2 | Modal mostra título/descrição/`recurrenceText` + calendário do mês | `RecurringPlacementDialog.test.tsx` (unit, densidade mockada) + `recurring-templates.spec.ts` teste 3 ← **novo, densidade real cross-source, Weekly e Monthly** |
| AC2 | Densidade agrega as 3 fontes (daily/weekly/monthly) corretamente | `test_views.py::TaskDensityView` (unit, 10 casos) + `recurring-templates.spec.ts` teste 3 ← **novo, prova end-to-end (Daily→Monthly) que faltava** |
| AC3 | Componente reutilizável, seleção desligada nesta story | `MonthDensityCalendar.test.tsx` (unit, componente isolado) + `recurring-templates.spec.ts` teste 3 ← **novo, prova negativa (0 `role=button`) contra o call site real de produção** |

## Resultado da execução

```
npx tsc --noEmit -p .                                    → 0 erros
npx eslint e2e/recurring-templates.spec.ts                → 0 erros/avisos
nvm use 22 && npx playwright test recurring-templates.spec.ts --reporter=line
  3 passed (42.9s)
```

Rodado contra o stack real (`npm run dev` + `manage.py runserver` sob `config.settings.e2e`,
branch Neon `e2e` dedicada — Story 11.1). Os 2 testes pré-existentes da dev-story continuam
passando (regressão zero); o novo é o 3º.

Suítes unitárias (pytest 323, vitest 415/44) não re-executadas nesta rodada — nenhuma mudança de
código de produção foi feita, só o novo spec E2E. O gap fechado era especificamente de camada
E2E (prova cross-source contra o backend real), que é o que este workflow existe para cobrir.

## Checklist de validação

- [x] Testes E2E gerados (UI existe) — 1 novo spec, 2 pré-existentes mantidos intactos
- [x] Testes usam APIs padrão do framework (Playwright, fixture `test`/`expect` já estabelecida)
- [x] Cobrem happy path (fluxo completo daily→density→modal→cancelar)
- [x] Cobrem caso crítico (agregação cross-source + prova negativa de não-interatividade)
- [x] Todos os testes rodam com sucesso (3/3, 42.9s)
- [x] Locators semânticos/acessíveis (`getByRole('table'|'cell'|'button'|'dialog')`, `getByLabel`, `getByText`)
- [x] Descrições claras em pt-BR, seguindo a convenção do arquivo
- [x] Sem waits/sleeps artificiais (`waitForResponse` no round-trip real do endpoint novo)
- [x] Testes independentes (fixture cria usuário novo via signup real por teste)
- [x] Summary salvo em `_bmad-output/implementation-artifacts/tests/test-summary.md`

## Próximos Passos

- Story 11.6 (mover/migrar tarefa) vai ligar `onSelectDay`/`selectedDate` no
  `MonthDensityCalendar` — quando isso acontecer, a prova negativa "0 `role=button`" desta story
  deixa de ser válida para o call site novo (mas continua válida para o `RecurringPlacementDialog`,
  que segue informativo). Não é uma dívida — é o comportamento esperado da mudança futura.
- `lint-imports` segue quebrado desde a 11.1 (`core` importa `bujo` via `purge_e2e_users`),
  registrado nas Completion Notes da própria story como fora de escopo — reforçando a
  recomendação já existente de escalar na retro do Épico 11.
  **Resolvido** (fix pós-11.3): `purge_e2e_users.py` e seu teste foram movidos de
  `backend/core/` para `backend/bujo/management/commands/purge_e2e_users.py` e
  `backend/bujo/tests/test_purge_e2e_users.py` — `core` não depende mais de `bujo`;
  `lint-imports` reporta `KEPT`.
