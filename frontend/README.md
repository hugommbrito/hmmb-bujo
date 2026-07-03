# hmmb-bujo — Frontend

Frontend do hmmb-bujo: **Vite + React + TypeScript + MUI**. Parte do monorepo (ver o `README.md` da raiz).

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite). Proxy `/api` → `http://localhost:8000` (backend). |
| `npm run build` | `tsc -b && vite build` — checa tipos e gera os estáticos em `dist/`. |
| `npm run typecheck` | `tsc -b --noEmit` — checagem de tipos sem emitir. |
| `npm run lint` | ESLint (flat config em `eslint.config.js`). |
| `npm run test` | Vitest em modo watch. |
| `npm run test:run` | Vitest em modo single-run (inclui regressão de acessibilidade via `jest-axe`). |
| `npm run preview` | Servir o build de produção localmente. |
| `npm run generate-types` | Gera `src/api/types.gen.ts` a partir do `schema.yaml` do backend (`openapi-typescript`). |

## Configuração

- **Lint:** ESLint flat config (`eslint.config.js`) com `typescript-eslint`, React Hooks/Refresh, `eslint-plugin-boundaries` (fronteira entre `features/`) e `eslint-plugin-jsx-a11y` (guardrail estático de acessibilidade).
- **API base-URL:** lida de `VITE_API_BASE_URL` (`.env.development` / `.env.production`). Em dev as chamadas `/api` são same-origin via proxy do Vite; em produção usam a base-URL.
- **Stack:** React 19, MUI 6 (+ `@mui/icons-material`), TanStack Query v5, Axios e `react-router-dom` v6. Tema central (`theme.ts`, claro/escuro), camada de dados (`api/client.ts`, `api/queryClient.ts`, `api/keys.ts`), autenticação JWT com refresh single-flight (`features/auth/`), casca de navegação autenticada (`app/router.tsx`, `app/layout/`) e baseline de acessibilidade WCAG 2.2 AA (`jest-axe` nos testes, `shared/components/Modal.tsx`) já implementados.
