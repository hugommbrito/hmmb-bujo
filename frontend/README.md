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
| `npm run test:e2e` | Playwright. Sobe frontend em `--mode e2e` (5173) + backend `config.settings.e2e` (8000) e os derruba no fim — **não** usa o dev local. Inclui o gate de a11y em browser real (`@axe-core/playwright`, WCAG 2.2 AA). Banco: ver [runbook](../docs/e2e-neon-reset.md). |
| `npm run preview` | Servir o build de produção localmente. |
| `npm run generate-types` | Gera `src/api/types.gen.ts` a partir do `schema.yaml` do backend (`openapi-typescript`). |

## Configuração

- **Lint:** ESLint flat config (`eslint.config.js`) com `typescript-eslint`, React Hooks/Refresh, `eslint-plugin-boundaries` (fronteira entre `features/`) e `eslint-plugin-jsx-a11y` (guardrail estático de acessibilidade).
- **API base-URL:** lida de `VITE_API_BASE_URL` (`.env.development` / `.env.production`). Em dev as chamadas `/api` são same-origin via proxy do Vite; em produção usam a base-URL.
- **Stack:** React 19, MUI 6, TanStack Query v5, Axios e `react-router-dom` v6. Ícones: **`@phosphor-icons/react`** (catálogo fechado do sistema novo) e `@mui/icons-material` (**apenas** no legado, até a consolidação do Épico 18). Camada de dados (`api/client.ts`, `api/queryClient.ts`, `api/keys.ts`) e autenticação JWT com refresh single-flight (`features/auth/`) já implementados.
- **Design system — dois sistemas convivendo (`architecture.md` AD-29):** o **novo** vive em `shared/design/tokens.ts` (dados puros, aplicados como CSS custom properties `--ds-*` na raiz do shell) e é consumido pelo chrome em `app/layout/shell/` (`ShellLayout`, sidebar 240/64, bottom nav de 3 atalhos + Menu, sheet de navegação, captura persistente). O **legado** é o `theme.ts` (MUI, claro/escuro), que continua pintando todas as superfícies internas e **não deve ser alterado** antes do Épico 18. Qual casca cada rota monta é declarado em `app/layout/shell/shellRouting.ts` — rollback de uma superfície é trocar `'new'` por `'legacy'` numa linha; `app/layout/AppLayout.tsx`, `Sidebar.tsx` e `BottomNav.tsx` existem só como essa rota de rollback.
- **Acessibilidade:** piso WCAG 2.2 AA em duas camadas — `jest-axe` nos testes unitários (não computa cor/layout) e `@axe-core/playwright` no E2E, que é onde contraste, foco não encoberto e conteúdo portalizado são de fato medidos. Nenhuma regra do axe é desligada no repositório.
