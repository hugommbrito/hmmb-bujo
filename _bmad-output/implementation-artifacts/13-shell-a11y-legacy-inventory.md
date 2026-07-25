# Inventário de acessibilidade do conteúdo LEGADO — SHELL-DEBT-02

> Artefato **não-bloqueante** produzido pela Story 13.4 (Task 8 / AC8). É
> **coleta**, não gate: o gate do shell (`frontend/e2e/shell-a11y.spec.ts`)
> continua com `exclude: 'main'` e nenhuma regra do axe é desligada
> (`disableRules` não existe no repositório).
>
> **Para que serve:** dar às Ondas 3–5 (Épicos 14–16) a lista concreta do que a
> migração de cada superfície precisa absorver, com dono explícito — em vez de
> deixar a SHELL-DEBT-02 como "dívida genérica de conteúdo legado".
>
> - **Data da coleta:** 2026-07-24
> - **Commit:** `2fca13f` + as mudanças da Story 13.4
> - **Ambiente:** Playwright/Chromium, `--mode e2e` (5173/8000), Postgres local
>   `bujo_e2e`, tema **Mineral Light** (o único wirado hoje), faixa DEV ativa
>   (`VITE_APP_ENV=development`)
> - **Tags:** `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` (o mesmo piso do gate)

## Como reproduzir

```bash
cd frontend
nvm use 22.15.1
CI=1 DATABASE_URL="postgres://postgres:postgres@localhost:5432/bujo_e2e" \
  npx playwright test --config playwright.inventory.config.ts --reporter=line
```

O coletor é `frontend/e2e/tools/legacy-a11y-inventory.spec.ts`. Ele roda o axe em
`/today` **sem** `exclude`, uma vez por faixa, e imprime cada achado
(`INVENTORY {…}`) com regra, impacto, seletor, `helpUrl`, HTML do nó e a razão de
contraste medida. `e2e/tools/` está fora do `testDir` efetivo da suíte
(`testIgnore: '**/tools/**'` em `playwright.config.ts`), então **nada aqui reprova
o gate e não existe nenhum teste permanentemente `skip`ado**.

## Achados — `/today` sem `exclude: 'main'`

Coleta nas 5 faixas da matriz (wide 1440×900 · medium 1280×800 · tablet 800×720 ·
compact 390×720 · compact 320×720). O resultado é **idêntico nas cinco**: uma
única classe de violação, com os mesmos dois nós.

| # | Regra | Impacto | Nó | Medição | Dono |
|---|---|---|---|---|---|
| LEG-01 | `color-contrast` (WCAG 1.4.3) | serious | `a.MuiButton-sizeSmall` → `href="/gratitude?date=…"` (atalho de gratidão do Daily) | **2.47:1** — `#2bada0` sobre `#f5f2ea`, 13px normal (exigido 4.5:1) | **Épico 18** (troca global de tema) + **Onda 3/Épico 14** (migração do Daily) |
| LEG-02 | `color-contrast` (WCAG 1.4.3) | serious | `button.MuiButton-textSizeMedium` (botão de texto do Daily) | **2.47:1** — `#2bada0` sobre `#f5f2ea`, 14px normal (exigido 4.5:1) | **Épico 18** (troca global de tema) + **Onda 3/Épico 14** (migração do Daily) |

**Causa raiz comum:** `theme.ts` define `brandPrimary = '#2BADA0'` como
`palette.primary.main` do sistema **legado**. Todo `Button`/`Link` de texto
pintado com `color="primary"` herda esse valor e reprova contraste sobre
`canvas`. Não é um bug isolado de um componente: é o **papel `primary` do sistema
legado**.

O sistema NOVO já resolve o mesmo papel com contraste conforme —
`--ds-primary = #315F5A` (`shared/design/tokens.ts`, Mineral Light). Ou seja:
**migrar a superfície para os tokens novos fecha LEG-01/LEG-02 por construção**,
sem correção pontual. Por isso o dono é a onda da superfície + o Épico 18 (que faz
a troca global de `theme.ts`), e não a Story 13.4 — que tem `theme.ts`
explicitamente **fora de escopo** (é rota de rollback).

### LEG-03 — mesma causa raiz, fora do `<main>`

| # | Regra | Impacto | Nó | Medição | Dono |
|---|---|---|---|---|---|
| LEG-03 | `color-contrast` (WCAG 1.4.3) | serious | label do `TextField` "Título" **em foco** dentro do `BrainDumpCaptureSheet` (`[role="dialog"][aria-label="Captura rápida"]`) | ≈**2.8:1** — `primary.main` legado (`#2bada0`) sobre a superfície clara do sheet | **Onda 4 / Épico 15** (migração da captura) + **Épico 18** |

Achado ao montar as células "Capture Sheet aberto" da matriz (Tabela B do AC4). É
a **mesma causa raiz** de LEG-01/LEG-02, mas o MUI renderiza o sheet num
**portal**, então ele cai **fora do `<main>`** e o `exclude: 'main'` original não o
alcançava. Consequência operacional registrada como divergência no
`13-shell-parity-checklist.md`: as duas células com o Capture Sheet aberto usam
`exclude: ['main', '[role="dialog"][aria-label="Captura rápida"]']` — **extensão de
escopo da SHELL-DEBT-02**, não regra silenciada. O que essas células continuam
medindo é o **chrome** com a captura aberta (FAB/âncora, topbar, backdrop, skip
link, inertização do conteúdo inferior pelo Modal).

### LEG-04 — reflow do documento na superfície de histórico de hábitos

| # | Regra / requisito | Impacto | Nó | Medição | Dono |
|---|---|---|---|---|---|
| LEG-04 | NFR-1 / WCAG 1.4.10 (reflow) — **não** capturado pelo axe | alto | `HabitHistoryGrid.srOnly` (`frontend/src/features/habits/components/HabitHistoryGrid.tsx:53-64`) | `documentElement.scrollWidth` = **2136px** num viewport de **800px** em `/habits/history` | **Onda 3 / Épico 14** (migração de hábitos) |

Encontrado ao verificar o `position: sticky` sob o workspace novo (abaixo). O
objeto `srOnly` usa `width: 1` / `height: 1` no `sx` do MUI — e no sistema
**`sizing`** do MUI um número **≤ 1 significa porcentagem**, não pixels: cada
rótulo sr-only de coluna de dia vira um `span` **absoluto de 100% da largura**,
empurrando a largura de rolagem do documento. O padrão correto (usado pelo chrome
novo, `ShellSidebar.VISUALLY_HIDDEN`) é `width: '1px'` / `height: '1px'`.

É dívida **pré-existente da superfície legada** — não uma regressão do shell (os
spans já eram absolutos e superdimensionados antes da Onda 2a) — e está **fora do
escopo** desta story, que não corrige superfícies. O reflow do **chrome** é medido
em `frontend/e2e/shell-keyboard.spec.ts` (320×720, 720×450 e 640×400) e está
conforme.

## Cobertura e limites honestos desta coleta

- A coleta é de **`/today` com Daily Log VAZIO** (estado da fixture). Uma
  superfície com tarefas, subtarefas, chips de prioridade e painel de detalhe
  provavelmente expõe **mais** nós — e as demais superfícies (`/planner/*`,
  `/archive`, `/settings/*`, históricos) **não** foram inventariadas. Cada onda
  deve rodar o coletor na **sua** superfície antes de declarar paridade de a11y.
- LEG-04 mostra que a classe de dívida do conteúdo legado **não é só o que o axe
  vê**: reflow, ordem de foco interna e alvos de toque das superfícies pedem
  verificação própria por onda.
- `prefers-reduced-motion` **não** entra neste inventário: é **waiver consciente
  de produto** do dono para o App Shell (UX-DR30 item 6 dispensado — Hugo,
  2026-07-24), registrado em `A11Y-07` do checklist de paridade. Não é dívida e
  não está deferido.

## Verificação do `position: sticky` sob o workspace novo (nota da Story 13.1)

A Story 13.1 registrou que o shell trocou o **scroll de documento** por um
workspace com `overflow: auto` próprio, e deixou "para um olhar no passe de
paridade da 13.4" o efeito disso nas duas superfícies com `position: sticky`
horizontal.

**Resultado: FUNCIONA — sem onda própria.** `position: sticky` se ancora no
ancestral de **scroll** mais próximo, e as duas tabelas têm o seu próprio
`<Box sx={{ overflowX: 'auto' }}>` **entre** o `sticky` e o workspace:

| Superfície | Elemento sticky | Ancestral de scroll resolvido no browser | Veredito |
|---|---|---|---|
| `HealthHistoryTable.tsx:103,141` | `<th>` "Data" (coluna fixa) | o wrapper `overflow-x: auto` da própria tabela — **não** `[data-testid="shell-workspace"]` | funciona |
| `HabitHistoryGrid.tsx:137,181` | `<th>` "Hábito" (coluna fixa) | o wrapper `overflow-x: auto` da própria grade — **não** `[data-testid="shell-workspace"]` | funciona |

Evidência automatizada (não inspeção visual):
`frontend/e2e/shell-states.spec.ts::HealthHistoryTable: sticky ancorado no wrapper
da tabela, não no workspace do shell` e `::HabitHistoryGrid: sticky ancorado no
wrapper da grade, não no workspace do shell` — ambos sobem do `<th>` sticky pelo
DOM até o primeiro ancestral que cria contexto de rolagem, provam que ele não é o
workspace, e (quando a tabela transborda) rolam a tabela e medem que a coluna
fixa **não** se move enquanto a última coluna **se move**.

Observação de faixa: as duas superfícies trocam a `<table>` por um layout de
**cartões** abaixo de 768px (`useMediaQuery('(max-width:767px)')` nos dois
componentes), então no compact não existe `sticky` a verificar — a verificação
roda em tablet 800×720.
