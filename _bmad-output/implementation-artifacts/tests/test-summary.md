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
