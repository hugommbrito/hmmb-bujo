# Delta de design system — Story 15.0

Nenhum **componente novo** é proposto. O que segue é o que o catálogo precisa aceitar como variante/composição documentada antes de 15.1.

## A. Variantes a documentar no catálogo

| Componente | Variante / uso desta story | Tokens |
|---|---|---|
| App Shell Badge | Contagem do Brain Dump nas quatro presenças; regras 0/loading/erro/1–9/9+ com contagem exata no nome acessível. | `app-shell-badge.min-height 18` · `rounded.full` · `primary`/`on-primary` |
| Persistent Capture | Variantes nav, rail e fab; estado offline com motivo no nome acessível e no tooltip. | `capture-action.icon note-pencil` · `capture-action.mobile-size 52` · `app-shell.touch-target-min 44` |
| Item Row | **Variante Brain Dump:** título, descrição truncada, borda esquerda neutra (sem categoria/status/Eisenhower), trailing com ações; densidade touch de 48px no compact. | `task-row.min-height-pointer 36` · `task-row.min-height-touch 48` · `task-row.category-border-width 3` |
| Dialog/Sheet | Variantes **Capture**, **destino** e **confirmação**: dialog de 400px no ponteiro, sheet no compact, footer canônico, uma só profundidade. | `colors.overlay` · `--shadow-layer` · `rounded.md`/`rounded.lg` |
| Seletor de destino do ritual (M10 · C) + Grid/Calendar | **Composição nova:** seletor de log (4 destinos com rótulo e ícone da navegação) em `radiogroup` **no lugar das abas**; week picker; calendário de densidade; atalhos Hoje / Sem dia definido; ação nomeada. Sem alteração de geometria; sheet no compact. | `spacing.2` · `rounded.sm` · `primary`/`primary-soft` · `info` · `surface-subtle` |
| Page/Period Header | Uso reduzido: só título + contexto textual — sem stepper, sem status de ciclo, sem seletor de período. | `typography.page-title` · `typography.meta` |
| Panel · Section Header | Um Panel para a função “Capturar”; Section Header com contagem textual. Nenhum Panel aninhado. | `panel.border` · `panel.radius` (rounded.md) · `panel.padding` (spacing.4) |
| Text Input · Select | Título, Descrição, Destino e Mês; erro associado ao campo. | `interactive-control.border` · `rounded.sm` · alvo 44/48 |
| Button · Icon Button · Chip · Icon | Primary para salvar/confirmar, secondary para Mover, danger contornado para Descartar, ghost para Cancelar; chip neutro para a dica; Phosphor `regular` em repouso, `fill` só no destino selecionado do shell. | `chip.height 24` · `app-shell-nav-icon.size 20` |
| Feedback · Empty State · Skeleton Block | Erro de leitura/escrita, aviso offline, “Brain Dump vazio.”, skeleton com a geometria real da lista. | `danger-soft` · `warning-soft` · `surface-subtle` |
| Workspace Surface | Principal única, **sem rail de contexto**. | `workspace.reading-width 800` · `workspace.max-width 1440` |

Verificação contra `DESIGN.md`: todos os tokens acima já existem no frontmatter atual (conferido na promoção de 2026-07-29) — confirma o item C.4 abaixo.

## B. Reuso sem alteração
App Shell · App Shell Navigation · Bottom Nav · Mobile Navigation Sheet — exatamente como aprovados na 13.0. Nenhum item novo, nenhuma reordenação.
Geometria: `sidebar-expanded 240` · `sidebar-collapsed 64` · `topbar 56` · gutters 32/24/16.

## C. Decisões de sistema a ratificar
1. O grupo de destino usa Buttons em `radiogroup` — o catálogo não tem Tabs, e o vocabulário de destino é o mesmo dos rituais. **Composição, não componente novo.**
2. O calendário de densidade é reuso integral do ritual (segunda–domingo, dias fora do mês em `surface-subtle`, hoje com contorno `info`, seleção em `primary`, pontos com contagem no nome acessível). Qualquer divergência aqui é bug, não variante.
3. Sem componente de toast: sucesso é comunicado por lista + contagem + `aria-live="polite"`.
4. Nenhum token novo foi introduzido. Todas as medidas e cores vêm do DESIGN.md.
