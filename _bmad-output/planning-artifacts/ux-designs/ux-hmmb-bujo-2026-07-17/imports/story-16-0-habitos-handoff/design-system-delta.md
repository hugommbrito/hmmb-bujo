# Delta de design system — Story 16.0

Nenhum **componente novo** é proposto. O que segue é o que o catálogo precisa aceitar como variante/composição documentada antes das stories de implementação.

## A. Variantes a documentar no catálogo

| Componente | Variante / uso desta story | Tokens |
|---|---|---|
| Item Row | **Variante Habit Tracker Row:** coluna de controle de 44px (checkbox interativo no booleano, checkbox indicador desabilitado no numérico), pictograma de 20px, nome + peso na mesma linha com `justify-content:space-between`, estado ou razão da meta abaixo, campo numérico de 104px alinhado à direita. **Sem** borda esquerda de categoria — hábito não tem categoria. Densidade touch de 48px. | `task-row-min-height 36` · `…-touch 48` · `control-border` |
| Panel · Section Header | **Composição nova "Registro em cards":** um Panel por grupo de hábitos, com Section Header interno (nome + porcentagem + peso efetivo) e barra de progresso redundante. Duas colunas em wide, uma nas demais faixas. Nenhum Panel aninhado. | `panel-border` · `panel-radius 6` · `panel-padding 16` |
| Barra de completude | **Variante nova de leitura:** 8px no cabeçalho do dia, 6px no card de grupo; trilha `surface-subtle` + `border`, preenchimento `primary`, `role="img"` com a porcentagem no nome. Sempre redundante ao texto. | `primary` · `surface-subtle` · `radius-xs` |
| Domain Pictogram (Icon) | Catálogo **aberto** do Phosphor: `iconKey` = nome do glifo, `regular` fixo no front, `fill` segue reservado ao shell. 20px em configuração/tracker/Hoje, 18px em grade e histórico. `aria-hidden` quando há nome visível. | `nav-icon-size 20` · `domain-icon-compact 18` |
| Dialog/Sheet | **Variante seletor de pictograma:** busca no topo, contador em `aria-live`, grade de tiles `role="radio"` (6 colunas no dialog, 4 no sheet), rolagem virtualizada, footer com a chave nomeada na ação primária. Uma só profundidade. | `overlay` · `shadow-layer` · `radius-md/lg` |
| Chip | Chip textual "Inativo" ao lado do nome, combinado ao tratamento terminal — opacidade **nunca** é canal único. | `chip-height 24` · `radius-sm` |
| Text Input · Select | Peso, meta, bônus, unidade, nome, grupo; multiplicador com `inputmode="decimal"` (vírgula pt-BR — Q6); erro associado ao campo. | `control-border` · `radius-sm` · alvo 44/48 |
| Category Radio Group | Reuso para **tipo de hábito** (booleano · numérico), imutável após a criação. | `primary-soft` · `radius-sm` |
| Date/Range Control | Navegação de dia no tracker (com a nota de que dias passados são editáveis) e intervalo + detalhe no histórico. | `meta 12/400` tabular |
| Grid/Calendar | **Composição nova "hábitos × períodos":** linhas por hábito agrupadas por grupo, colunas por semana ou quinzena, número dentro da célula como canal primário e tom como reforço; célula sem registro tracejada com "—"; tabela equivalente em `details`. Faixas de tom: `--ink` até 69%, `primary 80%`+`on-primary` em 70–89%, `primary` sólido em 90–100%. | `primary` (color-mix) · `border-strong` |
| Feedback · Empty State · Skeleton Block | Cinco vazios distintos com frase própria, erro inline por linha e por consulta, faixa offline, skeleton com a geometria real das linhas. | `danger-soft` · `warning-soft` · `surface-subtle` |
| Workspace Surface | Principal única, sem rail de contexto. Tracker e histórico até **1120px** (exceção da Q4); leitura textual segue 800px. | `workspace-max-width 1440` |

## B. Reuso sem alteração
App Shell · Navigation · Bottom Nav · Mobile Navigation Sheet · Persistent Capture · Page Header — exatamente como aprovados na 13.0. Geometria: `sidebar-expanded 240` · `sidebar-collapsed 64` · `topbar 56` · gutters 32/24/16.
Abas internas de Hábitos reusam o vocabulário de `radiogroup`/`tablist` já existente; **ordem canônica: Hoje · Histórico · Configuração.**

## C. Decisões de sistema a ratificar
1. **"Registro em cards"** é composição, não componente novo — e rompe a largura de leitura de 800px do padrão Registro. Ratificar como variante do DESIGN ou manter local a Hábitos (Q4).
2. **Checkbox indicador** (desabilitado, marcado automaticamente) é uso novo do checkbox como saída, não entrada. Precisa de nota no catálogo para não ser confundido com disabled por falta de permissão (Q9).
3. **Tiles de pictograma** usam `role="radio"` sem controle desenhado: seleção por borda + fundo `primary` + `aria-checked`. Ratificar como padrão de seleção visual do sistema.
4. **Tom como reforço** no heatmap: o número dentro da célula é sempre o canal primário. Qualquer célula sem número é bug, não variante.
5. Sem componente de toast: sucesso é a mudança do valor e da porcentagem.
6. **Nenhum token novo.** Todas as medidas e cores vêm do DESIGN.md; os tons do heatmap são `color-mix` sobre `primary`/`surface`.
7. **Emoji sai do sistema:** com a migração de `emoticon` → `iconKey` (Q2), o fallback de emoji descrito no guia deixa de existir na interface de Hábitos.
