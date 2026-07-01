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
