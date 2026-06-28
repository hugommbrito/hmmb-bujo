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
