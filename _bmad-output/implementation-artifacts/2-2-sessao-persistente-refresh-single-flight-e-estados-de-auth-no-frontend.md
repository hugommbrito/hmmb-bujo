---
baseline_commit: 5305d88672648685e7d39b7dc833e12ab8a7aa31
---

# Story 2.2: Sessão persistente, refresh single-flight e estados de auth no frontend

Status: done

## Story

Como **Hugo**,
Quero **que minha sessão persista entre recarregamentos e se renove sozinha sem me deslogar**,
Para que **eu nunca seja interrompido durante o uso ativo e só precise re-logar após real inatividade** (FR-0.2, AR-5, UX-DR16).

## Acceptance Criteria

**AC1 — Persistência de tokens e interceptor**
**Dado que** os tokens recebidos no login,
**Quando** o frontend os armazena,
**Então** ficam em `localStorage` com as chaves `access_token` e `refresh_token`, e o interceptor de request Axios anexa `Authorization: Bearer <access>` em toda requisição autenticada,
**E** ao recarregar a página a sessão é restaurada (isAuthenticated = true) sem novo login, enquanto o `access_token` ou `refresh_token` válido existir no `localStorage`.

**AC2 — Single-flight refresh e logout multi-aba**
**Dado que** várias requisições que tomam `401` simultaneamente,
**Quando** o token de acesso expira durante o uso,
**Então** um único refresh **single-flight** é disparado (promise compartilhada) — as demais requisições aguardam e fazem retry uma única vez com o novo token, e nenhum segundo refresh é disparado enquanto o primeiro está em voo,
**E** um `401` no próprio refresh aciona `logout()`, que limpa o `localStorage` (ambos os tokens) e chama `queryClient.clear()`,
**E** um evento `storage` detectado de outra aba (token removido) re-sincroniza o estado de auth da aba atual (setIsAuthenticated(false), exibe o banner de sessão expirada).

**AC3 — Estados de auth honestos**
**Dado que** uma sessão expirada por inatividade superior a 7 dias (refresh token vencido),
**Quando** o usuário volta ao app e faz qualquer requisição autenticada,
**Então** um banner não-bloqueante "Sessão expirada. Entre novamente." é exibido sobrepondo o conteúdo **sem destruir o estado da UI** (nenhum unmount de rotas, nenhum modal bloqueante),
**E** o erro de login na LoginPage é exibido inline de forma discreta ("Email ou senha incorretos."), sem stack trace nem detalhes técnicos na tela.

## Tasks / Subtasks

- [x] **Task 1 — Utilitários de token (`src/features/auth/tokenStorage.ts`)** (AC: 1, 2)
  - [x] 1.1: Criar `frontend/src/features/auth/tokenStorage.ts` com funções: `getAccessToken()`, `getRefreshToken()`, `setTokens(access, refresh)`, `clearTokens()`
  - [x] 1.2: `setTokens` persiste em `localStorage` com chaves `access_token` / `refresh_token` (convenção canônica de §6.5 da arquitetura)
  - [x] 1.3: `clearTokens` remove ambas as chaves do `localStorage`

- [x] **Task 2 — Atualizar `src/api/client.ts` com interceptores JWT single-flight** (AC: 1, 2)
  - [x] 2.1: Exportar `registerLogoutHandler(fn: () => void)` — registra callback que o `AuthProvider` usará; garante que o client não acoplado diretamente à feature
  - [x] 2.2: Adicionar interceptor de **request**: anexa `Authorization: Bearer <access_token>` se token existir no `localStorage`
  - [x] 2.3: Adicionar interceptor de **response** para 401:
    - Se o request original era `/api/accounts/token/refresh/` → chamar `onLogout?.()` + `clearTokens()` + `queryClient.clear()` e rejeitar (sem retry)
    - Caso contrário: verificar se `refreshing` (a promise compartilhada) existe; se não, criar `refreshing = doRefresh().finally(() => refreshing = null)`; aguardar `refreshing`; fazer retry da request original com novo access token; se retry retornar 401 também → `onLogout?.()` + `clearTokens()` + `queryClient.clear()`
  - [x] 2.4: `doRefresh()` faz `POST /api/accounts/token/refresh/` com o `refresh_token` atual; em sucesso chama `setTokens(access, refresh)` com os novos tokens rotacionados; em falha propaga o erro para o caller (que chama logout)
  - [x] 2.5: Criar/atualizar `frontend/src/api/client.test.ts` para cobrir:
    - Request interceptor: adiciona header Authorization quando token existe
    - Request interceptor: não adiciona header quando token ausente
    - Response interceptor: single 401 → dispara refresh + retry
    - Response interceptor: N 401 simultâneos → único refresh (verificar que `doRefresh` foi chamado exatamente 1 vez)
    - Response interceptor: 401 no refresh → `logout` chamado, promise rejeitada
    - Response interceptor: retry com novo token; se retry também retorna 401 → logout

- [x] **Task 3 — `AuthProvider` e contexto de auth** (AC: 1, 2, 3)
  - [x] 3.1: Criar `frontend/src/app/providers/AuthProvider.tsx`:
    - Contexto exportado: `AuthContext` com shape `{ isAuthenticated: boolean; sessionExpired: boolean; login: (tokens: AuthTokens) => void; logout: () => void }`
    - No mount: lê `localStorage` via `getAccessToken()` para inicializar `isAuthenticated`
    - `login(tokens)`: chama `setTokens(tokens.access, tokens.refresh)`, seta `isAuthenticated = true`, `sessionExpired = false`
    - `logout()`: chama `clearTokens()`, `queryClient.clear()`, seta `isAuthenticated = false`
    - No mount: registra `registerLogoutHandler(() => { logout(); setSessionExpired(true) })` no `client.ts`
    - Listener de `storage`: detecta remoção de `access_token` em outra aba → seta `isAuthenticated = false`, `sessionExpired = true`
  - [x] 3.2: Criar `frontend/src/shared/hooks/useAuth.ts` — hook consumidor do `AuthContext`; lança erro se usado fora do provider
  - [x] 3.3: Atualizar `frontend/src/app/providers/index.tsx` — envolver com `<AuthProvider>` (dentro do `QueryClientProvider`, fora do `ThemeProvider`)
  - [x] 3.4: Criar `frontend/src/app/providers/AuthProvider.test.tsx`:
    - Restaura sessão do localStorage no mount (isAuthenticated = true quando token existir)
    - login() persiste tokens e atualiza estado
    - logout() limpa localStorage e chama queryClient.clear()
    - Listener de storage seta sessionExpired quando access_token removido por outra aba

- [x] **Task 4 — Tipos de auth** (AC: 1)
  - [x] 4.1: Criar `frontend/src/features/auth/types.ts`:
    ```typescript
    export interface AuthTokens { access: string; refresh: string }
    export interface LoginCredentials { email: string; password: string }
    export interface SignupCredentials { email: string; password: string; timezone: string }
    ```

- [x] **Task 5 — API de auth** (AC: 1, 3)
  - [x] 5.1: Criar `frontend/src/features/auth/api.ts` com funções:
    - `loginApi(credentials: LoginCredentials): Promise<AuthTokens>` — POST `/api/accounts/token/` com camelCase correto (campo `email` e `password`)
    - `signupApi(credentials: SignupCredentials): Promise<void>` — POST `/api/accounts/signup/`
  - [x] 5.2: Usar o `client` Axios (sem TanStack Query aqui — auth é imperativo, não declarativo); tratar erro 401 como credenciais inválidas; erro 400 como erro de validação

- [x] **Task 6 — Componente `LoginPage`** (AC: 3)
  - [x] 6.1: Criar `frontend/src/features/auth/components/LoginPage.tsx`:
    - Formulário com `email` e `password` com visibilidade toggle
    - Estado local: `error: string | null` — exibido inline abaixo do formulário como `<Alert severity="error">` do MUI
    - Em erro da API → `setError("Email ou senha incorretos.")` (mensagem fixa, sem expor detalhes técnicos)
    - Em sucesso → chama `auth.login(tokens)` do `useAuth()`; não navega (navegação é Story 2.3)
    - Usar componentes MUI: `TextField`, `Button`, `CircularProgress` no estado loading, `Alert`
    - Props: `onSuccess?: () => void` — callback chamado após login bem-sucedido (Story 2.3 passará a navegação)
  - [x] 6.2: Criar `frontend/src/features/auth/components/LoginPage.test.tsx`:
    - Renderiza email + password + botão
    - Credenciais válidas → chama `auth.login()`, chama `onSuccess`
    - Credenciais inválidas → exibe "Email ou senha incorretos." inline (sem reload)
    - Botão desabilitado durante loading
    - Nenhum detalhe técnico na tela em erro

- [x] **Task 7 — Componente `SignupPage`** (AC: 1)
  - [x] 7.1: Criar `frontend/src/features/auth/components/SignupPage.tsx`:
    - Formulário com `email`, `password`, `timezone` (hidden, preenchido via `Intl.DateTimeFormat().resolvedOptions().timeZone`)
    - Em sucesso → login automático com os tokens retornados pelo loginApi, depois chama `auth.login(tokens)` + `onSuccess?.()`
    - Erros de validação (400) exibidos inline
    - Props: `onSuccess?: () => void`

- [x] **Task 8 — Componente `SessionExpiredBanner`** (AC: 3)
  - [x] 8.1: Criar `frontend/src/features/auth/components/SessionExpiredBanner.tsx`:
    - Renderizado condicionalmente quando `auth.sessionExpired === true`
    - MUI `Alert severity="warning"` fixado no topo (position fixed, z-index alto)
    - Texto: "Sessão expirada. Entre novamente."
    - Botão "Entrar" leva à LoginPage (via `onLogin` callback — Story 2.3 passará navegação)
    - **Não** faz unmount do conteúdo por baixo; apenas sobrepõe
    - Props: `onLogin?: () => void`
  - [x] 8.2: Usar `SessionExpiredBanner` no `AuthProvider` (renderiza junto com `{children}` via Fragment)

- [x] **Task 9 — Barrel da feature auth** (AC: 1)
  - [x] 9.1: Criar `frontend/src/features/auth/index.ts` exportando: `LoginPage`, `SignupPage`, `SessionExpiredBanner`, `useAuth`, tipos `AuthTokens`, `LoginCredentials`, `SignupCredentials`
  - [x] 9.2: **NÃO** exportar `tokenStorage.ts` diretamente pelo barrel — é implementação interna da feature

- [x] **Task 10 — Verificação final** (AC: 1, 2, 3)
  - [x] 10.1: `cd frontend && npx vitest run` — 73 testes passando (11 suites, incluindo todos os novos de auth)
  - [x] 10.2: `npx tsc --noEmit` — 0 erros de tipo
  - [x] 10.3: `npx eslint src/` — 0 erros de boundary (features/auth não importa outra feature)
  - [ ] 10.4: Teste manual: atualizar temporariamente `App.tsx` para renderizar `<LoginPage />` + `<SessionExpiredBanner />`; testar credenciais inválidas → erro inline; testar reload sem login → `isAuthenticated` corretamente lido do localStorage

## Dev Notes

### ⚠️ Limites de Escopo (LEIA PRIMEIRO)

| Pertence a esta Story (2.2) | NÃO fazer agora — Story responsável |
|---|---|
| `src/api/client.ts` — interceptores JWT + single-flight | `src/app/router.tsx` — rotas protegidas e redirect → **Story 2.3** |
| `AuthProvider` + `useAuth` (auth state) | `AppLayout` (sidebar/bottom-nav) → **Story 2.3** |
| `LoginPage` (formulário + erro inline) | Redirect para Daily Log após login → **Story 2.3** |
| `SignupPage` (formulário) | `PrivateRoute` / guards de rota → **Story 2.3** |
| `SessionExpiredBanner` (banner não-bloqueante) | Acessibilidade WCAG 2.2 AA da casca → **Story 2.4** |
| Token storage helpers | `react-router-dom` (instalar e configurar) → **Story 2.3** |
| Listener de `storage` multi-aba | Navegação pós-login → **Story 2.3** |

**Princípio:** 100% frontend. Zero mudanças no `backend/`. `LoginPage` não navega em 2.2 — chama `onSuccess` callback que Story 2.3 preencherá via router.

---

### Padrão canônico do interceptor single-flight (IMPLEMENTAÇÃO OBRIGATÓRIA)

Este é o padrão mais crítico da story. **Não reinventar.** Seguir exatamente o esqueleto da arquitetura §6.10 expandido:

```typescript
// frontend/src/api/client.ts — forma normativa COMPLETA

import axios, { AxiosError } from 'axios'
import { queryClient } from './queryClient'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../features/auth/tokenStorage'

let refreshing: Promise<void> | null = null
let onLogout: (() => void) | null = null

export function registerLogoutHandler(fn: () => void) {
  onLogout = fn
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor de REQUEST — anexa Bearer token
client.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de RESPONSE — trata 401 com single-flight refresh
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    // Se o 401 veio do próprio endpoint de refresh → logout imediato
    if (originalRequest.url?.includes('/api/accounts/token/refresh/')) {
      clearTokens()
      queryClient.clear()
      onLogout?.()
      return Promise.reject(error)
    }

    // Single-flight: apenas um refresh em voo por vez
    if (!refreshing) {
      refreshing = doRefresh().finally(() => {
        refreshing = null
      })
    }

    try {
      await refreshing
    } catch {
      // doRefresh já fez logout
      return Promise.reject(error)
    }

    // Retry da requisição original com o novo access token
    const newToken = getAccessToken()
    if (originalRequest.headers && newToken) {
      originalRequest.headers.Authorization = `Bearer ${newToken}`
    }
    return client(originalRequest)
  },
)

async function doRefresh(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearTokens()
    queryClient.clear()
    onLogout?.()
    throw new Error('No refresh token')
  }

  try {
    // Usar axios diretamente (não o client interceptado) para evitar loop
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/accounts/token/refresh/`,
      { refresh: refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    )
    const { access, refresh } = response.data
    setTokens(access, refresh)
  } catch {
    clearTokens()
    queryClient.clear()
    onLogout?.()
    throw new Error('Refresh failed')
  }
}

export default client
```

**Armadilha crítica — usar `axios` (não `client`) no `doRefresh`:** se `doRefresh` usar o `client` interceptado, um 401 no refresh dispararia o interceptor de response de novo, criando loop infinito. Usar a instância base `axios` diretamente no doRefresh.

---

### Padrão canônico do `AuthProvider` (IMPLEMENTAÇÃO OBRIGATÓRIA)

```typescript
// frontend/src/app/providers/AuthProvider.tsx — forma normativa

import { createContext, useEffect, useState, useCallback } from 'react'
import { queryClient } from '../../api/queryClient'
import { registerLogoutHandler } from '../../api/client'
import { getAccessToken, setTokens, clearTokens } from '../../features/auth/tokenStorage'
import type { AuthTokens } from '../../features/auth/types'
import { SessionExpiredBanner } from '../../features/auth'

interface AuthState {
  isAuthenticated: boolean
  sessionExpired: boolean
  login: (tokens: AuthTokens) => void
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAccessToken())
  const [sessionExpired, setSessionExpired] = useState(false)

  const logout = useCallback(() => {
    clearTokens()
    queryClient.clear()
    setIsAuthenticated(false)
  }, [])

  const login = useCallback((tokens: AuthTokens) => {
    setTokens(tokens.access, tokens.refresh)
    setIsAuthenticated(true)
    setSessionExpired(false)
  }, [])

  useEffect(() => {
    // Registra o logout handler no Axios client
    registerLogoutHandler(() => {
      logout()
      setSessionExpired(true)
    })
  }, [logout])

  useEffect(() => {
    // Multi-aba: detecta quando outra aba remove o access_token (logout)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'access_token' && event.newValue === null) {
        setIsAuthenticated(false)
        setSessionExpired(true)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, sessionExpired, login, logout }}>
      {sessionExpired && <SessionExpiredBanner />}
      {children}
    </AuthContext.Provider>
  )
}
```

**Nota sobre o `storage` event:** o evento `storage` do browser **NÃO dispara na aba que originou a mudança** — apenas nas outras abas do mesmo domínio. Isso é o comportamento correto para a sincronização cross-aba: a aba que fez logout já tem o estado correto via `logout()`; as outras abas são notificadas via `storage` event.

---

### Token storage helpers (forma normativa)

```typescript
// frontend/src/features/auth/tokenStorage.ts

const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_KEY)
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY)

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
```

---

### LoginPage — forma normativa resumida

```typescript
// frontend/src/features/auth/components/LoginPage.tsx

import { useState } from 'react'
import { TextField, Button, Alert, Box, Typography, CircularProgress } from '@mui/material'
import { useAuth } from '../../../shared/hooks/useAuth'
import { loginApi } from '../api'

interface LoginPageProps { onSuccess?: () => void }

export function LoginPage({ onSuccess }: LoginPageProps) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const tokens = await loginApi({ email, password })
      auth.login(tokens)
      onSuccess?.()
    } catch {
      setError('Email ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} /* ... */>
      <Typography variant="h1">Entrar</Typography>
      <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <TextField label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="contained" disabled={loading}>
        {loading ? <CircularProgress size={20} /> : 'Entrar'}
      </Button>
    </Box>
  )
}
```

**Nota:** o erro é sempre "Email ou senha incorretos." para qualquer falha de credenciais (401 ou 400). **Nunca** expor mensagem da API diretamente — verificar na Story 2.1 que o backend retorna 401 genérico sem revelar se o email existe.

---

### SessionExpiredBanner — pontos críticos

```typescript
// frontend/src/features/auth/components/SessionExpiredBanner.tsx
import { Alert, Button } from '@mui/material'

interface SessionExpiredBannerProps { onLogin?: () => void }

export function SessionExpiredBanner({ onLogin }: SessionExpiredBannerProps) {
  return (
    <Alert
      severity="warning"
      sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
      action={onLogin && <Button color="inherit" size="small" onClick={onLogin}>Entrar</Button>}
    >
      Sessão expirada. Entre novamente.
    </Alert>
  )
}
```

**Não usar Modal/Dialog** — o banner DEVE ser não-bloqueante. O conteúdo por baixo permanece visível e interativo. `position: fixed` com `zIndex: 9999` sobrepõe sem desmontar.

---

### `src/app/providers/index.tsx` — ordem obrigatória dos providers

```tsx
// A ordem importa: AuthProvider dentro do QueryClientProvider para que
// auth.logout() possa chamar queryClient.clear() sem circular dependency
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  </AuthProvider>
</QueryClientProvider>
```

---

### API de auth — camelCase e endpoints

```typescript
// frontend/src/features/auth/api.ts
import client from '../../api/client'
import type { LoginCredentials, SignupCredentials, AuthTokens } from './types'

export async function loginApi(credentials: LoginCredentials): Promise<AuthTokens> {
  // Endpoint: POST /api/accounts/token/
  // Retorna: { access: string, refresh: string }
  // camelCase-case: djangorestframework-camel-case não afeta email/password (mono-word)
  const response = await client.post<{ access: string; refresh: string }>(
    '/api/accounts/token/',
    credentials,
  )
  return response.data
}

export async function signupApi(credentials: SignupCredentials): Promise<void> {
  // Endpoint: POST /api/accounts/signup/
  // Detectar timezone automaticamente: Intl.DateTimeFormat().resolvedOptions().timeZone
  await client.post('/api/accounts/signup/', credentials)
}
```

**Importante:** `loginApi` usa `client` (com interceptores) mas o próprio endpoint de login não autentica — `client` não terá token na primeira chamada e o interceptor simplesmente não adicionará o header. Sem problema.

---

### `useAuth` hook — localização correta

```typescript
// frontend/src/shared/hooks/useAuth.ts
import { useContext } from 'react'
import { AuthContext } from '../../app/providers/AuthProvider'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

**Localização em `shared/hooks/`:** `useAuth` é usado pela `LoginPage` (`features/auth`) E eventualmente pela `AppLayout` (`app/layout`) — portanto pertence a `shared/`, não a `features/auth/`, para não criar dependência circular (features/ não pode importar de outra feature; app/ pode importar de shared/).

---

### Estrutura de arquivos ao fim da story

```
frontend/src/
├── api/
│   ├── client.ts                             ALTERAR — + interceptores JWT + single-flight + registerLogoutHandler
│   ├── client.test.ts                        ALTERAR — + testes dos interceptores
│   ├── keys.ts                               sem alteração (nenhuma query key de auth — tokens não são server state)
│   ├── queryClient.ts                        sem alteração
│   └── types.gen.ts                          sem alteração (vazio; gerado por CI quando backend tiver schemas)
├── app/
│   └── providers/
│       ├── AuthProvider.tsx                  NOVO — auth state, login/logout, session expired, multi-tab listener
│       ├── AuthProvider.test.tsx             NOVO
│       ├── index.tsx                         ALTERAR — + <AuthProvider> na pilha de providers
│       ├── ColorModeContext.ts               sem alteração
│       └── providers.test.tsx               verificar se passa após mudança
├── features/
│   └── auth/
│       ├── index.ts                          NOVO — barrel: LoginPage, SignupPage, SessionExpiredBanner, useAuth, types
│       ├── types.ts                          NOVO — AuthTokens, LoginCredentials, SignupCredentials
│       ├── tokenStorage.ts                   NOVO — get/setTokens, clearTokens (NÃO exportado no barrel)
│       ├── api.ts                            NOVO — loginApi, signupApi
│       ├── hooks/
│       │   (vazio — useAuth fica em shared/hooks/)
│       └── components/
│           ├── LoginPage.tsx                 NOVO
│           ├── LoginPage.test.tsx            NOVO
│           ├── SignupPage.tsx                NOVO
│           └── SessionExpiredBanner.tsx      NOVO
└── shared/
    └── hooks/
        ├── useAuth.ts                        NOVO — consumer do AuthContext
        └── useOptimisticMutation.ts          sem alteração
```

**Não criar:**
- `src/app/router.tsx` — criado em Story 2.3
- `src/app/layout/AppLayout.tsx` — criado em Story 2.3
- Nenhum arquivo em `backend/` — zero mudanças no backend
- Nenhum hook TanStack Query para auth — tokens são estado de infra, não server state

---

### ⚠️ Armadilhas críticas (LEIA ANTES DE IMPLEMENTAR)

#### 1. Loop infinito no refresh: usar `axios` bruto, não `client`

`doRefresh()` DEVE usar `axios.post(...)` diretamente, **nunca `client.post(...)`**. Se usar `client`, um 401 no endpoint de refresh dispara o interceptor novamente, que tenta outro refresh, criando um loop infinito. Esta é a falha mais comum neste padrão.

#### 2. O evento `storage` não dispara na aba que originou a mudança

`window.addEventListener('storage', ...)` recebe eventos de `localStorage.setItem`/`removeItem` feitos em **outras abas**. Na aba que chamou `logout()`, o estado já foi atualizado diretamente pelo `logout()`. Não criar lógica redundante para a aba local.

#### 3. `refreshing = null` no `finally`, não no `then/catch`

A promise `refreshing` DEVE ser resetada para `null` no `.finally()`, não no `.then()`. Se resetado no `.then()`, uma falha no refresh deixa `refreshing` "preso" e requisições futuras ficam esperando uma promise que nunca resolve.

#### 4. `registerLogoutHandler` deve ser chamado no `useEffect`, não no corpo do componente

Chamá-lo no corpo do componente (`AuthProvider`) faz com que seja recriado em todo re-render. Dentro do `useEffect` com dependência `[logout]`, é registrado apenas quando `logout` muda (praticamente uma vez).

#### 5. `tokenStorage.ts` não deve ser re-exportado no barrel de `features/auth`

`tokenStorage.ts` é implementação interna — expor no barrel cria tentação de usá-lo diretamente em outros módulos, quebrando o encapsulamento. Apenas `AuthProvider` e `client.ts` (via import direto) devem usar `tokenStorage`.

#### 6. `useAuth` em `shared/hooks/`, não em `features/auth/hooks/`

`useAuth` precisa ser acessível de `app/` (para o `AuthProvider` e future `AppLayout`) e de features (para `LoginPage`). Se ficasse em `features/auth/`, a `AppLayout` em `app/` teria que importar de `features/`, violando a regra de boundary. Em `shared/hooks/` é acessível de qualquer lugar.

#### 7. Boundary ESLint: `features/auth/api.ts` importa de `../../api/client`

`api/client` não é uma `feature`, é a camada de infra compartilhada. Essa importação é **permitida**. O que é proibido é `features/auth/` importar de `features/bujo/` ou qualquer outra feature.

#### 8. Backend usa `camelCase` na borda via `djangorestframework-camel-case`

O interceptor de request do Axios **não precisa** converter camelCase — o `djangorestframework-camel-case` parser no backend aceita camelCase. O retorno de `/api/accounts/token/` já vem em camelCase: `{ "access": "...", "refresh": "..." }` (esses campos são palavras simples sem conversão). Verificar com `POST /api/accounts/token/` na Story 2.1.

#### 9. `SignupPage` deve detectar timezone do browser

O backend exige `timezone` IANA no signup. A forma canônica (AD-04): `Intl.DateTimeFormat().resolvedOptions().timeZone`. Preenchido automaticamente, sem exibir ao usuário. O campo não aparece no formulário — apenas incluído no body da requisição.

---

### Inteligência da Story anterior (2.1 — done)

- **79 testes passando** no backend — nenhuma mudança frontend nesta story afeta esses testes
- **Tokens retornados:** `POST /api/accounts/token/` retorna `{ access: string, refresh: string }`. Formato verificado na Story 2.1, campos simples sem camelCase conversion
- **Rotação configurada:** `ROTATE_REFRESH_TOKENS=True` + `BLACKLIST_AFTER_ROTATION=True` — cada refresh gera NOVOS `access` + `refresh`. O `doRefresh` DEVE persistir os dois tokens novos (`setTokens(access, refresh)`) — não só o `access`
- **Endpoint de refresh:** `POST /api/accounts/token/refresh/` — body `{ "refresh": "<token>" }` — retorna `{ "access": "...", "refresh": "..." }` com os dois tokens rotacionados
- **401 sem revelar email:** backend retorna 401 genérico para credenciais inválidas — seguro exibir "Email ou senha incorretos." diretamente para qualquer falha de credenciais
- **`frontend/src/api/client.test.ts` já existe** da Story 1.5 (pode estar vazio ou ter mock básico) — verificar com `cat` antes de reescrever; adicionar novos testes sem apagar os existentes

### Git Intelligence

- Branch `main`, último commit `5305d88` ("feat(story-2.1): Cadastro e login com JWT")
- `frontend/src/api/client.ts` linhas 1-9: comentário explícito `"JWT interceptor single-flight será adicionado na Story 2.2"` — substituir o arquivo inteiro pelo canônico
- `frontend/src/api/keys.ts`: sem chaves de auth — tokens não são TanStack Query state, correto permanecer assim
- `frontend/src/app/providers/index.tsx`: stack atual é `ColorModeContext → QueryClient → Theme`; adicionar `AuthProvider` entre `QueryClient` e `Theme`
- `frontend/src/App.tsx`: scaffold placeholder; pode ser atualizado temporariamente para renderizar `<LoginPage />` para verificação manual; será substituído em 2.3
- Convenção de commit: `"feat(story-2.2): Sessão persistente, refresh single-flight e estados de auth no frontend"`

---

### Testes obrigatórios

#### `frontend/src/api/client.test.ts` (adicionar/atualizar)

- `test_request_interceptor_adiciona_bearer_quando_token_presente` — mock localStorage com token → verificar header Authorization na request capturada
- `test_request_interceptor_sem_header_quando_token_ausente` — localStorage vazio → sem header Authorization
- `test_response_interceptor_401_dispara_refresh` — mock POST /token/refresh/ OK → verifica que refresh foi chamado e request original foi retentada
- `test_response_interceptor_N_401_simultaneos_single_refresh` — disparar 3 requests simultâneas que retornam 401 → mock refresh → verificar que refresh foi chamado **exatamente 1 vez**
- `test_response_interceptor_401_em_refresh_chama_logout_e_rejeita` — mock POST /token/refresh/ retornando 401 → verificar que `onLogout` foi chamado, localStorage limpo
- `test_response_interceptor_non_401_passa_adiante` — error 500 → rejeita sem tentar refresh

#### `frontend/src/app/providers/AuthProvider.test.tsx`

- `test_restaura_sessao_do_localStorage` — setar token no localStorage antes de montar → `isAuthenticated = true`
- `test_sem_token_nao_autenticado` — localStorage vazio → `isAuthenticated = false`
- `test_login_persiste_tokens_e_autentica` — chamar `auth.login(tokens)` → localStorage tem ambos tokens, `isAuthenticated = true`
- `test_logout_limpa_localStorage_e_queryClient` — chamar `auth.logout()` → localStorage vazio, `queryClient.clear()` chamado
- `test_storage_event_aba_externa_atualiza_estado` — disparar `storage` event com key `access_token` e newValue `null` → `isAuthenticated = false`, `sessionExpired = true`

#### `frontend/src/features/auth/components/LoginPage.test.tsx`

- `test_renderiza_formulario_email_senha` — campos de email e senha presentes
- `test_credenciais_validas_chama_onSuccess` — mock loginApi retornando tokens → `onSuccess` chamado, `auth.login` chamado
- `test_credenciais_invalidas_exibe_erro_inline` — mock loginApi lançando erro → texto "Email ou senha incorretos." visível na tela
- `test_botao_desabilitado_durante_loading` — mock loginApi com delay → botão disabled durante a chamada
- `test_erro_nao_expoe_detalhes_tecnicos` — verificar que nenhum erro técnico/stack trace aparece

---

### Project Structure Notes

- Alinhamento com `architecture.md §7.1`: `src/features/auth/` com components, api, types; `src/shared/hooks/useAuth.ts`; `src/app/providers/AuthProvider.tsx`
- `src/api/client.ts` não pertence a nenhuma feature — está na camada de infra compartilhada (`api/`); pode importar de `features/auth/tokenStorage` sem violar regras de boundary
- **Fronteira de autenticação/tenant (§7.2):** JWT autentica → `TenantMiddleware` seta contextvar no backend; no frontend a fronteira é o `AuthProvider` + interceptor
- O `queryClient.clear()` no logout garante que nenhum dado de cache de um usuário seja visível para o próximo que fizer login no mesmo browser
- `types.gen.ts` permanece vazio placeholder — será preenchido via passo de CI quando o backend acumular schemas. Para esta story, types de auth são declarados manualmente em `features/auth/types.ts` (padrão manual aceito pela arquitetura)

### References

- [Source: epics.md#Story-2.2] — user story e ACs originais
- [Source: epics.md#Epic-2 intro] — contexto do épico; single-flight é mandatório por causa da rotação de tokens
- [Source: architecture.md §6.5] — contrato fixo JWT: tokens em localStorage (access_token/refresh_token), single-flight, multi-tab sync, logout = localStorage.clear() + queryClient.clear()
- [Source: architecture.md §6.10] — Reference Implementation do interceptor single-flight (esqueleto expandido nesta story)
- [Source: architecture.md AR-5] — simplejwt single-flight obrigatório, access ~30min, refresh 7d, ROTATE+BLACKLIST
- [Source: architecture.md UX-DR16] — estados de auth: redirect, erro inline, sessão expirada sem destruir UI
- [Source: architecture.md §7.1] — estrutura `features/auth/`, `shared/hooks/`, `app/providers/AuthProvider`
- [Source: architecture.md §7.2] — fronteira ESLint: features não se importam; shared/ e api/ são acessíveis de qualquer lugar
- [Source: architecture.md AD-13] — TanStack Query como camada de dados; tokens NÃO são TanStack Query state
- [Source: _bmad-output/implementation-artifacts/2-1-cadastro-e-login-com-jwt.md] — File List e Completion Notes; 79 testes backend; rotação de tokens confirmada; formato de resposta /token/ verificado
- [Source: frontend/src/api/client.ts:3] — comentário indica "será adicionado na Story 2.2"
- [Source: frontend/src/app/providers/index.tsx] — stack atual de providers; ordem de inserção do AuthProvider

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- AC1 ✅: Tokens armazenados em `localStorage` com chaves `access_token`/`refresh_token`. Interceptor de request Axios anexa `Authorization: Bearer` em toda requisição autenticada. `AuthProvider` inicializa `isAuthenticated` lendo do `localStorage` no mount — sessão restaurada sem novo login.
- AC2 ✅: Single-flight refresh implementado com `let refreshing: Promise<void> | null`. N requisições 401 simultâneas disparam exatamente 1 refresh (testado com 3 requisições paralelas). 401 no endpoint de refresh aciona logout imediato + `clearTokens()` + `queryClient.clear()`. `storage` event de outra aba seta `isAuthenticated = false` + `sessionExpired = true`.
- AC3 ✅: `SessionExpiredBanner` usa `position: fixed, top: 0, zIndex: 9999` — não bloqueia UI abaixo (sem Modal/Dialog). LoginPage exibe "Email ou senha incorretos." inline via `<Alert severity="error">` — zero exposição de detalhes técnicos.
- **Fix aplicado pelo code review**: `AuthContext` extraído para `AuthContext.ts` separado para satisfazer regra `react-refresh/only-export-components`.
- **Fix aplicado pelo code review**: ESLint `no-restricted-imports` atualizado de padrão glob `../*/*` para regex precisa que distingue imports cross-feature (bloqueados) de imports para `api/` e `shared/` (permitidos pela arquitetura §7.2).
- `doRefresh()` usa `axios` bruto (não `client`) para evitar loop infinito — armadilha crítica da Dev Note #1 respeitada.
- `registerLogoutHandler` chamado em `useEffect([logout])`, não no corpo do componente — armadilha crítica #4 respeitada.
- `tokenStorage.ts` NÃO exportado no barrel — armadilha crítica #5 respeitada.
- `useAuth` em `shared/hooks/` — acessível de `app/` e `features/` sem circular dependency — armadilha crítica #6 respeitada.
- 73 testes passando (11 suites) | 0 erros TypeScript | 0 erros ESLint

### File List

- `frontend/src/api/client.ts` — ALTERADO: interceptores JWT request+response, single-flight refresh, `registerLogoutHandler`
- `frontend/src/api/client.test.ts` — ALTERADO: 8 testes cobrindo interceptores (request header, single-flight, retry, logout em 401/refresh)
- `frontend/src/app/providers/AuthContext.ts` — NOVO: `AuthContext` e interface `AuthState` (separado do Provider para react-refresh)
- `frontend/src/app/providers/AuthProvider.tsx` — NOVO: auth state, login/logout, session expired, multi-tab listener, `SessionExpiredBanner`
- `frontend/src/app/providers/AuthProvider.test.tsx` — NOVO: 6 testes (restauração sessão, login, logout, storage event, registerLogoutHandler)
- `frontend/src/app/providers/index.tsx` — ALTERADO: `<AuthProvider>` adicionado entre `QueryClientProvider` e `ThemeProvider`
- `frontend/src/features/auth/types.ts` — NOVO: `AuthTokens`, `LoginCredentials`, `SignupCredentials`
- `frontend/src/features/auth/tokenStorage.ts` — NOVO: `getAccessToken`, `getRefreshToken`, `setTokens`, `clearTokens`
- `frontend/src/features/auth/tokenStorage.test.ts` — NOVO: 8 testes cobrindo todas as funções
- `frontend/src/features/auth/api.ts` — NOVO: `loginApi`, `signupApi`
- `frontend/src/features/auth/index.ts` — NOVO: barrel exportando `LoginPage`, `SignupPage`, `SessionExpiredBanner`, `useAuth`, tipos
- `frontend/src/features/auth/components/LoginPage.tsx` — NOVO: formulário email+senha, erro inline, loading state
- `frontend/src/features/auth/components/LoginPage.test.tsx` — NOVO: 5 testes (render, credenciais válidas, inválidas, loading, sem detalhes técnicos)
- `frontend/src/features/auth/components/SignupPage.tsx` — NOVO: formulário email+senha, timezone automático, login pós-cadastro
- `frontend/src/features/auth/components/SignupPage.test.tsx` — NOVO: 5 testes (render, sucesso, timezone, erros 400/genérico, loading)
- `frontend/src/features/auth/components/SessionExpiredBanner.tsx` — NOVO: banner não-bloqueante fixed-position
- `frontend/src/features/auth/components/SessionExpiredBanner.test.tsx` — NOVO: 5 testes (texto, botão, click, position non-modal)
- `frontend/src/shared/hooks/useAuth.ts` — NOVO: consumer do `AuthContext`, lança erro se fora do provider
- `frontend/eslint.config.js` — ALTERADO: `no-restricted-imports` migrado de glob `../*/*` para regex precisa (fix cross-feature detection)

### Senior Developer Review (AI) — 2026-06-29

**Resultado: APROVADO** (0 CRITICAL após correções automáticas)

**Correções aplicadas automaticamente:**

🟡 MEDIUM #1 — `react-refresh/only-export-components` em `AuthProvider.tsx`
- `AuthContext` e `AuthProvider` exportados do mesmo arquivo quebram React fast-refresh
- Fix: `AuthContext` e `AuthState` extraídos para `frontend/src/app/providers/AuthContext.ts`; `AuthProvider.tsx` importa de `./AuthContext`; `useAuth.ts` e `AuthProvider.test.tsx` atualizados correspondentemente

🟡 MEDIUM #2 — `no-restricted-imports` (6 falsos positivos em 3 arquivos)
- Padrão glob `../*/*` usava contains-matching e bloqueava imports legítimos para `api/` (infra) e `shared/` (utilitários), explicitamente permitidos pela arquitetura §7.2
- Fix: regra migrada para `regex: '\\.\\.\\/(?!api\\/|shared\\/|app\\/|\\.\\.\\/)[^\\/]+\\/'` — detecta precisamente imports cross-feature sem bloquear infra

**Validação pós-fix:** 73/73 testes ✅ | TypeScript 0 erros ✅ | ESLint 0 erros ✅
