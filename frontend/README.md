# hmmb-bujo — Frontend

Frontend do hmmb-bujo: **Vite + React + TypeScript + MUI**. Parte do monorepo (ver o `README.md` da raiz).

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite). Proxy `/api` → `http://localhost:8000` (backend). |
| `npm run build` | `tsc -b && vite build` — checa tipos e gera os estáticos em `dist/`. |
| `npm run typecheck` | `tsc -b --noEmit` — checagem de tipos sem emitir. |
| `npm run lint` | ESLint (flat config em `eslint.config.js`). |
| `npm run preview` | Servir o build de produção localmente. |

## Configuração

- **Lint:** ESLint flat config (`eslint.config.js`) com `typescript-eslint` + regras de React Hooks/Refresh.
- **API base-URL:** lida de `VITE_API_BASE_URL` (`.env.development` / `.env.production`). Em dev as chamadas `/api` são same-origin via proxy do Vite; em produção usam a base-URL.
- **Stack:** React 19, MUI 6, TanStack Query v5 e Axios estão instalados; a configuração de tema (`theme.ts`) e do client (Axios/Query) chega na Story 1.5.
