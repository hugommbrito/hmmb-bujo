---
title: 'Distinção visual DEV × PROD (banner, título da aba, favicon)'
type: 'feature'
created: '2026-07-22'
status: 'done'
context: []
baseline_commit: '234e5e8c6f9d7cd548553338095df92832a25066'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Os deploys de dev e de produção são visualmente idênticos e ambos rodam o mesmo build de produção do Vite (`npm run build`), então é fácil confundir em qual ambiente estou operando — com risco de agir em produção achando que é dev.

**Approach:** Introduzir um sinal explícito de ambiente (`VITE_APP_ENV`, inlined no build) e, a partir dele, aplicar branding distinto: banner fixo no topo apenas em DEV, título da aba (`BuJo` em prod / `DEV-bujo` em dev) e favicon por ambiente. Default fail-safe = `development`; só o ambiente PROD do Railway seta `VITE_APP_ENV=production`.

## Boundaries & Constraints

**Always:**
- Fonte única da verdade do ambiente: `import.meta.env.VITE_APP_ENV === 'production'`.
- Fail-safe: qualquer valor ausente ou diferente de `production` = DEV (banner + branding de dev).
- PROD: sem banner; aba `BuJo`; favicon novo (pen, `favicon-prod.svg`).
- DEV (inclui `npm run dev` local e o deploy de dev): banner visível; aba `DEV-bujo`; favicon atual (`favicon.svg`).
- Preservar o layout existente: sidebar fixa (desktop), bottom nav (mobile) e páginas de login/signup — o banner não pode sobrepor controles.
- Textos visíveis em pt-BR.

**Ask First:**
- Trocar o mecanismo de detecção (ex.: hostname) — já decidido com o usuário: `VITE_APP_ENV`.
- Alterar a identidade visual de PROD além do que está aqui especificado.

**Never:**
- Não usar `import.meta.env.PROD` / `MODE` para distinguir os deploys (ambos buildam em `production`).
- Não hardcodar domínios de produção.
- Não commitar `VITE_APP_ENV=production` nos arquivos `.env` — o override vive só no ambiente PROD do Railway.
- Não tocar em lógica de negócio, rotas ou auth.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Deploy PROD | `VITE_APP_ENV=production` | Sem banner; aba `BuJo`; favicon `/favicon-prod.svg`; sem classe `dev-env` no body | N/A |
| Deploy DEV / local | `VITE_APP_ENV=development` | Banner fixo no topo; aba `DEV-bujo`; favicon `/favicon.svg`; `body.dev-env` ativo | N/A |
| Variável ausente / desconhecida | `VITE_APP_ENV` indefinido | Tratado como DEV (fail-safe) | N/A |
| `<link rel="icon">` ausente no head | qualquer ambiente | `applyEnvBranding()` cria o elemento antes de setar o href | N/A |

</frozen-after-approval>

## Code Map

- `frontend/index.html` -- shell estático; `<title>` + `<link rel="icon">` (defaults de PROD para first-paint limpo).
- `frontend/src/main.tsx` -- entrypoint; chama `applyEnvBranding()` antes do render.
- `frontend/src/App.tsx` -- monta `<DevEnvBanner/>` acima do `RouterProvider` (chrome global, todas as rotas).
- `frontend/src/index.css` -- reset global; offsets do banner sob `body.dev-env`.
- `frontend/src/app/layout/Sidebar.tsx` -- Drawer permanente com `position: fixed` em `top:0` (`.MuiDrawer-docked`); alvo do offset CSS (NÃO editar).
- `frontend/src/app/layout/AppLayout.tsx` -- layout autenticado (flex row desktop / bottom nav mobile) — referência de que o conteúdo flui no body.
- `frontend/.env.development`, `frontend/.env.production` -- origem de `VITE_APP_ENV`.
- `frontend/public/favicon.svg` -- favicon DEV (atual, roxo).

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/shared/env.ts` (novo) -- exporta `IS_PROD_DEPLOY`, `APP_TITLE` e `applyEnvBranding()` (seta `document.title`, o href do favicon e a classe `dev-env` no body) -- fonte única do sinal de ambiente.
- [x] `frontend/public/favicon-prod.svg` (novo) -- SVG pen fornecido pelo usuário, verbatim -- favicon de PROD.
- [x] `frontend/src/app/DevEnvBanner.tsx` (novo) -- componente do banner; retorna `null` se `IS_PROD_DEPLOY`; senão, `Box` fixo full-width no topo, âmbar, `pointer-events:none`, z-index acima do Drawer -- aviso de ambiente.
- [x] `frontend/src/App.tsx` -- renderizar `<DevEnvBanner/>` como irmão do `RouterProvider` -- banner global.
- [x] `frontend/src/main.tsx` -- chamar `applyEnvBranding()` antes de `createRoot` -- título/favicon/classe corretos no primeiro paint.
- [x] `frontend/index.html` -- `<title>BuJo</title>` + `href="/favicon-prod.svg"` (defaults de prod) + comentário de que o JS ajusta por ambiente.
- [x] `frontend/src/index.css` -- var `--dev-banner-height: 28px`; `body.dev-env { padding-top }`; `body.dev-env .MuiDrawer-docked .MuiDrawer-paper { top; height }` -- abre espaço p/ o banner sem editar Sidebar.tsx.
- [x] `frontend/.env.development` -- `VITE_APP_ENV=development`.
- [x] `frontend/.env.production` -- `VITE_APP_ENV=development` (fail-safe) + comentário do override no Railway PROD.
- [x] `frontend/src/shared/env.test.ts` (novo) -- `applyEnvBranding()` aplica title/favicon/classe por ambiente (`vi.stubEnv` + `vi.resetModules` + import dinâmico).
- [x] `frontend/src/app/DevEnvBanner.test.tsx` (novo) -- renderiza o banner em dev e `null` em prod.

**Acceptance Criteria:**
- Dado `VITE_APP_ENV` não setado, quando carrego o app, então vejo o banner de DEV, a aba `DEV-bujo` e o favicon atual.
- Dado `VITE_APP_ENV=production` no build, quando carrego o app, então não há banner, a aba é `BuJo` e o favicon é o pen; sidebar, bottom nav e login sem sobreposição.
- Dado que estou em DEV no desktop com a sidebar aberta, quando observo o topo, então o botão de toggle da sidebar não fica escondido atrás do banner.
- Dado a suíte existente, quando rodo lint + typecheck + testes, então tudo passa sem regressão.

## Design Notes

- **Por que env var:** os dois deploys rodam `npm run build` (Vite `mode=production`), então `PROD`/`MODE` não os distinguem. O Railway já sobrescreve `VITE_*` por ambiente (ver o placeholder de `VITE_API_BASE_URL`), então basta setar `VITE_APP_ENV=production` no ambiente PROD; o DEV herda o default `development` do arquivo.
- **Offset do banner:** o banner é `position: fixed` no topo, `z-index = theme.zIndex.drawer + 2`, `pointer-events: none`. Para não sobrepor a sidebar (Drawer permanente fixo em `top:0`), o espaço é aberto via `body.dev-env` no CSS global — `padding-top` no body (conteúdo mobile/login/desktop) e `top`/`height` no `.MuiDrawer-docked .MuiDrawer-paper` (sidebar). Isso evita editar `Sidebar.tsx` e não afeta drawers temporários/modais.
- **index.html com defaults de prod:** first-paint limpo para usuários reais; `applyEnvBranding()` corrige para DEV quando o flag indicar (a autoridade é sempre a env var).

## Verification

**Commands:** (Node 22 via nvm — `cd frontend && nvm use 22.15.1` antes)
- `npm run lint` -- expected: sem erros
- `npm run typecheck` -- expected: sem erros
- `npm run test:run` -- expected: verde, incluindo os novos testes
- `npm run build` -- expected: build conclui sem erro

**Manual checks:**
- `npm run dev` → banner no topo, aba `DEV-bujo`, favicon roxo atual, sidebar (toggle) não coberta pelo banner.
- `VITE_APP_ENV=production npm run build && npm run preview` → sem banner, aba `BuJo`, favicon pen.

## Suggested Review Order

**Sinal de ambiente (comece por aqui)**

- Fonte única da verdade: só `'production'` é prod; qualquer outro valor cai em dev (fail-safe).
  [`env.ts:11`](../../frontend/src/shared/env.ts#L11)

- Efeito colateral no DOM: título, favicon e classe `dev-env`, idempotente.
  [`env.ts:24`](../../frontend/src/shared/env.ts#L24)

- Ponto de disparo: roda antes do render para acertar o primeiro paint.
  [`main.tsx:11`](../../frontend/src/main.tsx#L11)

**Banner**

- `null` em prod; faixa fixa, `pointer-events:none`, z-index acima do Drawer.
  [`DevEnvBanner.tsx:11`](../../frontend/src/app/DevEnvBanner.tsx#L11)

- Montagem global (todas as rotas), acima do `RouterProvider`.
  [`App.tsx:8`](../../frontend/src/App.tsx#L8)

**Offset de layout (CSS, sem tocar nos componentes de layout)**

- Var gated: `0px` fora do dev, `28px` sob `body.dev-env` (+ padding no body).
  [`index.css:18`](../../frontend/src/index.css#L18)

- Empurra o paper do Drawer permanente para não cobrir o toggle da sidebar.
  [`index.css:26`](../../frontend/src/index.css#L26)

- Elemento fixo no topo pré-existente lê a var para não colidir com o banner.
  [`SessionExpiredBanner.tsx:15`](../../frontend/src/features/auth/components/SessionExpiredBanner.tsx#L15)

**Shell e configuração**

- Defaults de prod no HTML (first-paint limpo); JS ajusta para dev.
  [`index.html:9`](../../frontend/index.html#L9)

- Fail-safe `development`; override `production` só no ambiente PROD do Railway.
  [`.env.production:11`](../../frontend/.env.production#L11)

**Testes (por último)**

- Branding por ambiente + criação do `<link>` ausente (stub + import dinâmico).
  [`env.test.ts:1`](../../frontend/src/shared/env.test.ts#L1)

- Banner renderiza em dev e retorna `null` em prod.
  [`DevEnvBanner.test.tsx:1`](../../frontend/src/app/DevEnvBanner.test.tsx#L1)
