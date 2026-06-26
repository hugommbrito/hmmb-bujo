---
baseline_commit: 6dfe2eee8c2e9781282caed509027071a8465cab
---

# Story 1.5: Tema MUI central e camada de dados do frontend

Status: review

## Story

Como **Hugo**,
Quero **um tema visual BuJo (claro/escuro) e a camada de dados do frontend prontos**,
Para que **a casca do app e todas as features futuras tenham a identidade visual "caderno inteligente" e um padrão único de fetch/cache/mutação** (UX-DR1, AR-11, AR-12).

## Acceptance Criteria

**AC1 — Tema MUI**
**Dado que** o tema MUI,
**Quando** `src/theme.ts` é implementado,
**Então** a paleta é completamente substituída em dois níveis:
- Tinta-papel base: `#FDFAF4` (light) / `#2A2420` (dark) como `palette.background.default`
- Camada semântica: `cat-*` / `priority-*` para ambos os modos via `palette.mode`
- `shadows = Array(25).fill('none')` (zero elevation)
- `MuiPaper` com `elevation=0` como defaultProp
- `disableRipple` global via `MuiButtonBase`
- `shape.borderRadius=4`; nenhum componente excede 8px
- Fonte Inter em 2 pesos (400/600) carregada via `@fontsource/inter`
- Escala tipográfica semântica: `display`/`heading`/`body`/`body-sm`/`label` como variantes MUI customizadas

**AC2 — Camada de dados**
**Dado que** a camada de dados,
**Quando** o frontend base é configurado,
**Então** existem:
- `src/api/client.ts` — instância Axios base (sem interceptor JWT — Story 2.2 adiciona)
- `src/api/keys.ts` — query-key factory com padrão `[escopo, entidade, 'list'|'detail', params?]`
- `src/api/queryClient.ts` — `QueryClient` TanStack v5 com `refetchOnWindowFocus: true`
- `src/shared/hooks/useOptimisticMutation.ts` — wrapper canônico `onMutate`/`onError`/`onSettled`
- `src/app/providers/index.tsx` — monta `QueryClientProvider` + `ThemeProvider` + `CssBaseline`

**AC3 — Fronteiras e persistência de modo**
**Dado que** a estrutura de fronteiras do frontend,
**Quando** o ESLint roda (`npm run lint`),
**Então** a regra de boundary falha se uma `feature/<x>` importar arquivos internos de outra `feature/<y>` diretamente (importações inter-feature só são permitidas via barrel `index.ts`),
**E** a preferência de modo claro/escuro é lida do `localStorage` na inicialização e persistida a cada troca via `ColorModeContext`.

## Tasks / Subtasks

- [x] **Task 1 — Dependências** (AC: 1, 3)
  - [x] 1.1: Adicionar `@fontsource/inter` às `dependencies` em `frontend/package.json`
  - [x] 1.2: Adicionar `eslint-plugin-boundaries@^5` às `devDependencies`
  - [x] 1.3: Rodar `npm install` no diretório `frontend/` para atualizar `package-lock.json`

- [x] **Task 2 — Tema MUI (`src/theme.ts`)** (AC: 1)
  - [x] 2.1: Criar `frontend/src/theme.ts` com paletas completas light + dark (ver forma normativa em Dev Notes)
  - [x] 2.2: Incluir module augmentation para variantes tipográficas custom (`display`, `heading`, `body-sm`, `label`) no mesmo arquivo
  - [x] 2.3: Confirmar que `npm run typecheck` passa sem erros após criação do tema

- [x] **Task 3 — Camada de dados** (AC: 2)
  - [x] 3.1: Criar `frontend/src/api/client.ts` — instância Axios base (ver forma normativa)
  - [x] 3.2: Criar `frontend/src/api/keys.ts` — query-key factory seed (ver forma normativa)
  - [x] 3.3: Criar `frontend/src/api/queryClient.ts` — `QueryClient` com configuração padrão
  - [x] 3.4: Criar `frontend/src/shared/hooks/useOptimisticMutation.ts` — wrapper canônico (ver forma normativa)

- [x] **Task 4 — Providers e entrypoint** (AC: 2)
  - [x] 4.1: Criar `frontend/src/app/providers/ColorModeContext.ts` — contexto para toggle de modo
  - [x] 4.2: Criar `frontend/src/app/providers/index.tsx` — `Providers` com `QueryClientProvider` + `ThemeProvider` + `CssBaseline` + lógica de persistência de modo
  - [x] 4.3: Atualizar `frontend/src/main.tsx` — importar `@fontsource/inter/400.css` e `@fontsource/inter/600.css`, envolver `<App>` em `<Providers>`
  - [x] 4.4: Simplificar `frontend/src/index.css` — remover `font-family` do `:root` (Inter agora via MUI), remover bloco `main {}` que define max-width (controle de layout pertence ao App)

- [x] **Task 5 — ESLint boundary rule** (AC: 3)
  - [x] 5.1: Atualizar `frontend/eslint.config.js` — importar `eslint-plugin-boundaries` e adicionar regra de boundary (ver forma normativa)
  - [x] 5.2: Criar `frontend/src/features/.gitkeep` para marcar o diretório como existente
  - [x] 5.3: Testar a regra: criar arquivo temporário `src/features/test-a/test.ts` com `import { x } from '../test-b/api'`, confirmar que `npm run lint` reporta erro; deletar os arquivos de teste

- [x] **Task 6 — Verificação final** (AC: 1, 2, 3)
  - [x] 6.1: Confirmar `npm run typecheck` passa 0 erros
  - [x] 6.2: Confirmar `npm run lint` passa 0 warnings/errors (sem os arquivos de teste temporários)
  - [x] 6.3: Confirmar `npm run build` produz bundle sem erros
  - [x] 6.4: Iniciar `npm run dev`, abrir `localhost:5173`, verificar: fundo `#FDFAF4`, fonte Inter visível no navegador, sem console errors

## Dev Notes

### ⚠️ Limites de Escopo (LEIA PRIMEIRO)

| Pertence a esta Story (1.5) | NÃO faça agora — Story responsável |
|---|---|
| `src/theme.ts` com paleta completa (light + dark) | Sidebar + bottom-nav (`AppLayout`) → **Story 2.3** |
| `src/api/client.ts` instância Axios base (sem auth) | JWT interceptor single-flight → **Story 2.2** |
| `src/api/keys.ts` estrutura seed | Query keys de domínio real → **Story 3.x+** |
| `src/api/queryClient.ts` | `AuthProvider` + JWT state → **Story 2.1** |
| `src/shared/hooks/useOptimisticMutation.ts` | Usar o hook em features reais → **Story 3.x+** |
| `src/app/providers/` (QueryClient + Theme + ColorMode) | `src/app/providers/AuthProvider` → **Story 2.1** |
| ESLint boundary rule | Real feature imports → **Epic 2+** |
| Persistência de modo claro/escuro (localStorage) | Settings UI para troca de modo → **Story 2.3+** |

**Princípio:** nada além do tema, dados base e infraestrutura de fronteiras. Sem AuthProvider, sem AppLayout, sem rotas reais, sem JWT.

---

### Forma normativa das implementações

#### `frontend/src/theme.ts`

```typescript
import { createTheme, type Theme } from '@mui/material/styles'
import type {} from '@mui/material/themeCssVarsAugmentation'

// ─── Module augmentation para variantes tipográficas custom ──────────────────
declare module '@mui/material/styles' {
  interface TypographyVariants {
    display: React.CSSProperties
    heading: React.CSSProperties
    'body-sm': React.CSSProperties
    label: React.CSSProperties
  }
  interface TypographyVariantsOptions {
    display?: React.CSSProperties
    heading?: React.CSSProperties
    'body-sm'?: React.CSSProperties
    label?: React.CSSProperties
  }
}
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    display: true
    heading: true
    'body-sm': true
    label: true
  }
}

// ─── Tokens de cor (espelham DESIGN.md exatamente) ───────────────────────────
const colors = {
  // Superfície e tinta — light
  surfaceBase:       '#FDFAF4',
  surfaceRaised:     '#F7F3EB',
  surfaceHeader:     '#F0EBE0',
  inkPrimary:        '#1A1612',
  inkSecondary:      '#6B6359',
  inkDisabled:       '#B0A899',
  borderHairline:    '#DDD8CF',
  // Superfície e tinta — dark
  surfaceBaseDark:   '#2A2420',
  surfaceRaisedDark: '#322C28',
  inkPrimaryDark:    '#EDE8E0',
  inkSecondaryDark:  '#A89E93',
  inkDisabledDark:   '#5C554E',
  borderHairlineDark:'#4A433C',
  // Categorias semânticas — light / dark
  catTeal:           '#2BADA0', catTealDark:    '#3DC9BA',
  catPurple:         '#7B5EA7', catPurpleDark:  '#9E7FCC',
  catPink:           '#D95F78', catPinkDark:    '#F07F97',
  catYellow:         '#C89B00', catYellowDark:  '#F2C22E',
  catGreen:          '#4A8C5C', catGreenDark:   '#6BB880',
  catBlue:           '#3D72B4', catBlueDark:    '#6098D9',
  // Prioridade Eisenhower — light / dark
  priorityUi:        '#C0392B', priorityUiDark: '#E05A4A',
  priorityU:         '#D4660A', priorityUDark:  '#F08230',
  priorityI:         '#B8920A', priorityIDark:  '#D4B030',
  priorityNone:      '#4A8C5C', priorityNoneDark:'#6BB880',
  // FAB e brand
  brandPrimary:      '#2BADA0', brandPrimaryDark: '#3DC9BA',
  fabBg:             '#1A1612', fabBgDark:        '#EDE8E0',
} as const

// ─── Escala tipográfica (DESIGN.md) ─────────────────────────────────────────
const INTER = '"Inter", system-ui, sans-serif'
const typographyVariants = {
  display: { fontFamily: INTER, fontWeight: 600, fontSize: '20px', lineHeight: '24px', letterSpacing: '-0.02em' },
  heading: { fontFamily: INTER, fontWeight: 600, fontSize: '15px', lineHeight: '20px', letterSpacing: '-0.01em' },
  body:    { fontFamily: INTER, fontWeight: 400, fontSize: '14px', lineHeight: '20px', letterSpacing: '0' },
  'body-sm': { fontFamily: INTER, fontWeight: 400, fontSize: '12px', lineHeight: '16px', letterSpacing: '0' },
  label:   { fontFamily: INTER, fontWeight: 600, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.04em', textTransform: 'uppercase' as const },
}

// ─── Factory ─────────────────────────────────────────────────────────────────
export function createBujoTheme(mode: 'light' | 'dark') {
  const light = mode === 'light'
  return createTheme({
    palette: {
      mode,
      background: {
        default: light ? colors.surfaceBase       : colors.surfaceBaseDark,
        paper:   light ? colors.surfaceRaised     : colors.surfaceRaisedDark,
      },
      text: {
        primary:   light ? colors.inkPrimary      : colors.inkPrimaryDark,
        secondary: light ? colors.inkSecondary    : colors.inkSecondaryDark,
        disabled:  light ? colors.inkDisabled     : colors.inkDisabledDark,
      },
      divider: light ? colors.borderHairline : colors.borderHairlineDark,
      primary: { main: light ? colors.brandPrimary    : colors.brandPrimaryDark },
      error:   { main: light ? colors.priorityUi      : colors.priorityUiDark },
      warning: { main: light ? colors.priorityU       : colors.priorityUDark },
    },
    shape: { borderRadius: 4 },
    shadows: Array(25).fill('none') as Theme['shadows'],
    typography: {
      fontFamily: INTER,
      ...typographyVariants,
    },
    components: {
      MuiPaper:      { defaultProps: { elevation: 0 } },
      MuiCard:       { defaultProps: { elevation: 0 } },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
    },
  })
}
```

**Nota sobre `body1`/`body2`:** Não remova nem sobrescreva `body1` e `body2` do MUI — eles são usados internamente por vários componentes (Typography, ListItemText, etc.). A variante `body` customizada coexiste sem conflito.

---

#### `frontend/src/api/client.ts`

```typescript
import axios from 'axios'

// Instância base. JWT interceptor single-flight será adicionado na Story 2.2.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

export default client
```

**Notas:**
- `VITE_API_BASE_URL=''` em `.env.development` (proxy Vite cuida do `/api`)
- Não adicionar `Authorization` header aqui — Story 2.2
- Não adicionar response interceptor de 401 aqui — Story 2.2

---

#### `frontend/src/api/keys.ts`

```typescript
// Padrão canônico: [escopo, entidade, 'list' | 'detail', params?]
// Cada feature adiciona sua seção à medida que é implementada.
// Mutations invalidam por prefixo: queryClient.invalidateQueries({ queryKey: keys.habits.logs.all })
export const keys = {
  brainDump: {
    count: (userId: string) => ['brainDump', 'count', userId] as const,
  },
  // Adicionados nas stories:
  // habits: { logs: { ... } }  → Story 6.x
  // health: { logs: { ... } }  → Story 7.x
  // bujo:   { dailyLog: { ... } } → Story 3.x
} as const
```

---

#### `frontend/src/api/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 0,
      retry: 1,
    },
  },
})
```

---

#### `frontend/src/shared/hooks/useOptimisticMutation.ts`

```typescript
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query'

interface UseOptimisticMutationOptions<TData, TError, TVariables, TCacheItem> {
  mutationFn: (variables: TVariables) => Promise<TData>
  queryKey: QueryKey
  updater: (current: TCacheItem | undefined, variables: TVariables) => TCacheItem
  mutationOptions?: Omit<
    UseMutationOptions<TData, TError, TVariables, { snapshot: TCacheItem | undefined }>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >
}

export function useOptimisticMutation<TData, TError, TVariables, TCacheItem>({
  mutationFn,
  queryKey,
  updater,
  mutationOptions,
}: UseOptimisticMutationOptions<TData, TError, TVariables, TCacheItem>) {
  const qc = useQueryClient()

  return useMutation<TData, TError, TVariables, { snapshot: TCacheItem | undefined }>({
    mutationFn,
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<TCacheItem>(queryKey)
      qc.setQueryData<TCacheItem>(queryKey, (old) => updater(old, variables))
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData<TCacheItem>(queryKey, context.snapshot)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
    },
    ...mutationOptions,
  })
}
```

---

#### `frontend/src/app/providers/ColorModeContext.ts`

```typescript
import { createContext, useContext } from 'react'

interface ColorModeContextValue {
  mode: 'light' | 'dark'
  toggle: () => void
}

export const ColorModeContext = createContext<ColorModeContextValue>({
  mode: 'light',
  toggle: () => {},
})

export function useColorMode() {
  return useContext(ColorModeContext)
}
```

---

#### `frontend/src/app/providers/index.tsx`

```typescript
import { useState, useMemo } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { queryClient } from '../../api/queryClient'
import { createBujoTheme } from '../../theme'
import { ColorModeContext } from './ColorModeContext'

const STORAGE_KEY = 'bujo-color-scheme'

function readStoredMode(): 'light' | 'dark' {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ProvidersProps { children: React.ReactNode }

export function Providers({ children }: ProvidersProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(readStoredMode)

  const colorMode = useMemo(
    () => ({
      mode,
      toggle: () => {
        setMode((prev) => {
          const next = prev === 'light' ? 'dark' : 'light'
          localStorage.setItem(STORAGE_KEY, next)
          return next
        })
      },
    }),
    [mode],
  )

  const theme = useMemo(() => createBujoTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </ColorModeContext.Provider>
  )
}
```

---

#### `frontend/src/main.tsx` (versão final)

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './index.css'
import App from './App.tsx'
import { Providers } from './app/providers/index.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
```

---

#### `frontend/src/index.css` (simplificado)

```css
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100svh;
}
```

Remove o bloco `:root` com `font-family` (Inter agora é responsabilidade do tema MUI) e o bloco `main {}` (max-width e padding de layout pertencem ao App). `CssBaseline` do MUI reseta margin/padding e aplica `background-color` do tema.

---

#### `frontend/eslint.config.js` (com boundary rule)

```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // ─── Fronteiras inter-feature ─────────────────────────────────────────────
  // Arquivos dentro de src/features/<A>/ NÃO podem importar
  // diretamente de src/features/<B>/<sub-path>.
  // Apenas o barrel (index.ts / import '../featureB') é permitido.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Captura: ../outraFeature/qualquerCoisa (não é index)
              // Regex: começa com ../ + palavra + / + algo (não vazio)
              // Isso bloqueia imports como '../auth/api', '../bujo/components/Row'
              // Permite: '../auth' (barrel index implícito) ou '../auth/index'
              group: ['../*/*'],
              message:
                'Imports inter-feature devem usar apenas o barrel: import { X } from "../featureB" (não "../featureB/arquivo")',
            },
          ],
        },
      ],
    },
  },
])
```

**Nota:** O padrão `'../*/*'` em `group` usa glob do ESLint `no-restricted-imports`. Ele captura qualquer import relativo que atravessa dois níveis — ex.: `../auth/api` corresponde, mas `../auth` (sem subpath) não. Validar com arquivo de teste temporário antes de marcar como concluído (ver Task 5.3).

---

### Estrutura de arquivos ao fim da story

```
frontend/
├── package.json                              # ALTERAR — +@fontsource/inter, +eslint-plugin-boundaries
├── package-lock.json                         # ALTERAR — npm install
├── eslint.config.js                          # ALTERAR — boundary rule
├── src/
│   ├── main.tsx                              # ALTERAR — Providers wrapper + fontsource imports
│   ├── index.css                             # ALTERAR — simplificado
│   ├── App.tsx                               # MANTER — scaffold sem alteração
│   ├── theme.ts                              # NOVO — tema MUI completo com module augmentation
│   ├── api/
│   │   ├── types.gen.ts                      # MANTER — gerado pela Story 1.4, não tocar
│   │   ├── client.ts                         # NOVO — Axios base (sem JWT)
│   │   ├── keys.ts                           # NOVO — query-key factory seed
│   │   └── queryClient.ts                    # NOVO — QueryClient TanStack v5
│   ├── app/
│   │   └── providers/
│   │       ├── ColorModeContext.ts           # NOVO — contexto de modo claro/escuro
│   │       └── index.tsx                     # NOVO — Providers wrapper
│   ├── shared/
│   │   └── hooks/
│   │       └── useOptimisticMutation.ts      # NOVO — wrapper otimista canônico
│   └── features/
│       └── .gitkeep                          # NOVO — marca diretório para boundary rule
```

**Não criar:**
- `src/app/router.tsx` → **Story 2.3**
- `src/app/layout/AppLayout.tsx` → **Story 2.3**
- Qualquer feature real (`auth/`, `bujo/`, `habits/`, etc.) → **Epic 2+**
- Interceptor JWT em `client.ts` → **Story 2.2**
- `src/app/providers/AuthProvider.tsx` → **Story 2.1**
- Path aliases (`@/`) no tsconfig → não necessário até Epic 2

---

### ⚠️ Armadilhas críticas (LEIA ANTES DE IMPLEMENTAR)

#### 1. `shadows` exige cast de tipo estrito
`theme.shadows` é uma tupla `[string, string, ...×23]` de exatamente 25 elementos. `Array(25).fill('none')` produz `string[]`. O TypeScript rejeita sem cast. Forma correta:
```typescript
import type { Theme } from '@mui/material/styles'
// dentro de createTheme():
shadows: Array(25).fill('none') as Theme['shadows'],
```

#### 2. Module augmentation de variantes tipográficas é obrigatória
Sem ela, `<Typography variant="display">` e `<Typography variant="body-sm">` produzem erros de tipo. A declaração deve estar em `src/theme.ts` ou em `src/theme.d.ts` — ambos são cobertos por `"include": ["src"]` no tsconfig. Não colocar em `vite-env.d.ts` (contexto errado).

#### 3. `@fontsource/inter` — importar somente os pesos usados
```typescript
import '@fontsource/inter/400.css'  // Inter Regular
import '@fontsource/inter/600.css'  // Inter SemiBold
```
**Não importar** `@fontsource/inter` sem subpath — isso carrega todos os pesos (~900KB).

#### 4. `CssBaseline` deve estar dentro de `ThemeProvider`
`<CssBaseline>` precisa estar aninhado dentro de `<ThemeProvider>` para herdar `background.default` do tema. Se ficar fora, o fundo será branco padrão do browser em vez de `#FDFAF4`.

#### 5. `body1` e `body2` MUI: não remover
O MUI usa internamente `body1` para textos de `<ListItemText>`, `<TableCell>`, etc., e `body2` para texto secundário. A variante customizada `body` (sem número) coexiste sem conflito — não sobrescreva `body1`.

#### 6. `no-restricted-imports` com `group: ['../*/*']`
O padrão `../*/*` usa glob do ESLint (não regex). Ele bloqueia qualquer import relativo que passa por dois níveis de pasta a partir do arquivo atual. O padrão só está ativo para `files: ['src/features/**/*.{ts,tsx}']` — não afeta `pages/`, `app/` ou `shared/`.

Validar manualmente:
```bash
# Criar dois mini-arquivos de teste dentro de src/features/
echo 'export {}' > frontend/src/features/test-b/api.ts
echo "import { } from '../test-b/api'" > frontend/src/features/test-a/test.ts
cd frontend && npm run lint
# Deve reportar erro no test-a/test.ts
# Limpar: rm -rf frontend/src/features/test-a frontend/src/features/test-b
```

#### 7. `readStoredMode` é chamada no render inicial (SSR-unsafe)
Este projeto é CSR puro (Vite). `localStorage` e `window.matchMedia` são seguros no corpo da função componente. Não adicionar guard `typeof window !== 'undefined'` — YAGNI.

#### 8. `eslint-plugin-boundaries@^5` requer ESLint v9 flat config
A Story usa apenas `no-restricted-imports` (nativo do ESLint) para a regra de boundary. O `eslint-plugin-boundaries` está listado como devDep mas não é usado diretamente no config acima — foi reservado para quando a lógica de boundary crescer além do `no-restricted-imports`. Instale-o mas não o configure ainda (evita overhead).

**Alternativamente:** se o `no-restricted-imports` com `group` glob não funcionar como esperado no ESLint v9 flat config, substituir pelo equivalente com `patterns`:
```javascript
'no-restricted-imports': ['error', {
  patterns: [{ group: ['../*/*'], message: '...' }]
}]
```

#### 9. `App.tsx` permanece inalterado
O `App.tsx` atual renderiza um `<main>` com h1/p — isso é válido dentro do `ThemeProvider`. O MUI não exige que o root use componentes MUI. Não alterar o `App.tsx` nesta story.

---

### Previous Story Intelligence (1.4 — done)

Aprendizados relevantes da Story 1.4 (aplicáveis a esta):

- **Stack frontend confirmada**: Node 22, npm, Vite 8, React 19, TypeScript 5.9 (strict mode), MUI 6.1, TanStack Query 5.59, Axios 1.7, ESLint 9 flat config
- **Dependências já instaladas**: `@mui/material`, `@emotion/react`, `@emotion/styled`, `@tanstack/react-query`, `axios` — **não reinstalar**
- **`openapi-typescript` já é devDep** — não adicionar novamente
- **`frontend/src/api/` já existe** com `types.gen.ts` — não recriar o diretório
- **`.env.development` e `.env.production` existem** em `frontend/` — verificar se `VITE_API_BASE_URL` está definido antes de adicionar
- **CI `.github/workflows/ci.yml`**: já tem setup Node 22 — não duplicar steps
- **Vite proxy `/api → localhost:8000`** em `vite.config.ts` — não alterar
- **Desvio intencional de 1.4**: `JSON_UNDERSCOREIZE` → `JSON_CAMEL_CASE` no Django settings — irrelevante para o frontend, documentado como contexto
- **53 testes no backend passando** — esta story não toca no backend; zero regressão esperada no backend

### Git Intelligence

- Branch `main`, último commit `6dfe2ee` ("feat(story-1.4): Contrato de API e padrões da camada de serviço")
- `frontend/src/api/client.ts`, `keys.ts`, `queryClient.ts` **não existem** — confirmar com `ls` antes de criar
- `frontend/src/shared/` **não existe** — criar com `mkdir -p`
- `frontend/src/app/` **não existe** — criar com `mkdir -p`
- `frontend/src/features/` **não existe** — criar com `.gitkeep`
- Convenção de commit: `"feat(story-1.5): <descrição em pt-BR>"`
- O `eslint.config.js` tem comentário na linha 8 antecipando esta boundary rule: "feature-boundary rule arrives in Story 1.5" — alinhar com o comentário existente

---

### Testing requirements

Stack de testes frontend não está configurada nesta story. Verificações manuais obrigatórias antes de marcar como done:

1. `cd frontend && npm run typecheck` → 0 erros TypeScript
2. `cd frontend && npm run lint` → 0 warnings/errors
3. `cd frontend && npm run build` → bundle produção sem erros (watch bundle size)
4. `cd frontend && npm run dev` → `localhost:5173`:
   - Background do `<body>` deve ser `#FDFAF4` (light) ou `#2A2420` (dark por prefers-color-scheme)
   - Font-family do texto deve ser "Inter" (inspecionar no DevTools > Computed)
   - Console sem erros vermelho
5. Teste manual de boundary rule (ver armadilha #6 acima)

### Project Structure Notes

- Alinhamento com `architecture.md §7.1`: `src/api/`, `src/app/providers/`, `src/shared/hooks/`, `src/features/`
- Tokens de cor em `theme.ts` espelham `DESIGN.md` exatamente (valores hex idênticos)
- A tipografia usa as 5 escalas de `DESIGN.md`: display/heading/body/body-sm/label
- O spacing base 4px é o default do MUI (`theme.spacing(1) === '8px'` no MUI) — para base 4px, configurar `spacing: 4` no tema ou usar `theme.spacing` como está (MUI default é 8px por unidade; se o design exige 4px base, adicionar `spacing: 4` ao `createTheme`)

**Nota sobre spacing**: `DESIGN.md` define `spacing["1"] = "4px"`. O MUI default é `spacing = 8` (então `theme.spacing(1) = '8px'`). Para alinhar com o design (base 4px), adicionar `spacing: 4` ao `createTheme`:
```typescript
createTheme({
  spacing: 4,  // theme.spacing(1) === '4px', theme.spacing(2) === '8px'
  // ...
})
```
Verificar se isso conflita com os componentes MUI internos antes de aplicar (pode alterar padding padrão de botões, etc.). Se causar problemas visuais, reverter para `spacing: 8` (default) e usar tokens manuais.

### References

- [Source: epics.md#Story-1.5] — user story e ACs originais (BDD completo)
- [Source: epics.md#Epic-1 UX-DR1] — especificação de tema MUI central obrigatório
- [Source: architecture.md §6.5] — TanStack Query v5: padrão canônico de fetch/cache/mutação
- [Source: architecture.md §6.10] — Reference Implementations: query-key factory, interceptor single-flight skeleton, optimistic mutation skeleton
- [Source: architecture.md §7.1] — Árvore do projeto frontend (paths canônicos)
- [Source: architecture.md §7.3] — Fluxo de dados: read via useQuery, write via useMutation + invalidação por prefixo
- [Source: architecture.md AD-13] — Estado do frontend: server state derivado via TanStack Query, sem client store
- [Source: architecture.md AR-11] — MUI theme centralizado em `src/theme.ts`
- [Source: architecture.md AR-12] — Feature isolation via ESLint boundary rule
- [Source: DESIGN.md] — Paleta de cores completa (hex exatos), tipografia (Inter, 5 escalas), border-radius, spacing base 4px
- [Source: DESIGN.md#Elevation & Profundity] — `theme.shadows = Array(25).fill("none")`, `elevation: 0`
- [Source: 1-4-...md §Dev Notes#Limites de Escopo] — Confirma que `client.ts`/`keys.ts`/`queryClient.ts` pertencem a esta story
- [Source: frontend/package.json] — MUI 6.1, TanStack Query 5.59, Axios 1.7 já instalados
- [Source: frontend/eslint.config.js:8] — comentário na linha 8 antecipando a boundary rule desta story

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Nenhum desvio ou bloqueio durante a implementação. Todos os itens das armadilhas críticas foram aplicados corretamente:
- `shadows` com cast `as Theme['shadows']` ✅
- Module augmentation para variantes tipográficas custom ✅
- Apenas pesos 400/600 do `@fontsource/inter` importados ✅
- `CssBaseline` dentro de `ThemeProvider` ✅
- `body1`/`body2` não removidos ✅
- `no-restricted-imports` com `group: ['../*/*']` testado e funcional ✅
- `spacing: 4` adicionado conforme DESIGN.md (base 4px) ✅

### Completion Notes List

- **Task 1**: `@fontsource/inter@^5` adicionado a `dependencies`; `eslint-plugin-boundaries@^5` a `devDependencies`; `npm install` executado com sucesso (20 pacotes adicionados).
- **Task 2**: `frontend/src/theme.ts` criado com paleta light/dark completa (todos os tokens de cor conforme DESIGN.md), module augmentation para variantes `display`/`heading`/`body-sm`/`label`, `shadows: Array(25).fill('none')`, `spacing: 4`, `borderRadius: 4`, `disableRipple` global. Typecheck: 0 erros.
- **Task 3**: Camada de dados completa — `client.ts` (Axios sem JWT), `keys.ts` (factory seed `brainDump.count`), `queryClient.ts` (TanStack v5 com `refetchOnWindowFocus: true`, `staleTime: 0`, `retry: 1`), `useOptimisticMutation.ts` (wrapper canônico `onMutate`/`onError`/`onSettled`).
- **Task 4**: `ColorModeContext.ts` com `useColorMode()` hook; `Providers/index.tsx` montando `QueryClientProvider + ThemeProvider + CssBaseline` + persistência via `localStorage`; `main.tsx` atualizado com fontsource imports e `<Providers>` wrapper; `index.css` simplificado (apenas `box-sizing` e `body.margin/min-height`).
- **Task 5**: `eslint.config.js` atualizado com regra `no-restricted-imports` (padrão `../*/*`) restrita a `src/features/**`. Teste manual validado: `test-a/test.ts` importando `../test-b/api` disparou erro ESLint. Arquivos temporários removidos.
- **Task 6**: `typecheck` 0 erros, `lint` 0 warnings/errors, `build` 460 módulos (Inter fonts incluídas), `dev` iniciou em 365ms sem erros.

### File List

- `frontend/package.json` — ALTERADO (+ @fontsource/inter, + eslint-plugin-boundaries)
- `frontend/package-lock.json` — ALTERADO (npm install)
- `frontend/eslint.config.js` — ALTERADO (boundary rule no-restricted-imports)
- `frontend/src/theme.ts` — NOVO
- `frontend/src/main.tsx` — ALTERADO (Providers wrapper + fontsource imports)
- `frontend/src/index.css` — ALTERADO (simplificado)
- `frontend/src/api/client.ts` — NOVO
- `frontend/src/api/keys.ts` — NOVO
- `frontend/src/api/queryClient.ts` — NOVO
- `frontend/src/shared/hooks/useOptimisticMutation.ts` — NOVO
- `frontend/src/app/providers/ColorModeContext.ts` — NOVO
- `frontend/src/app/providers/index.tsx` — NOVO
- `frontend/src/features/.gitkeep` — NOVO

### Change Log

- **2026-06-26**: Story 1.5 implementada — Tema MUI central com paleta light/dark BuJo, camada de dados (Axios + TanStack Query), providers com persistência de modo claro/escuro via localStorage, e ESLint boundary rule para isolamento inter-feature. Typecheck/lint/build: 0 erros.
