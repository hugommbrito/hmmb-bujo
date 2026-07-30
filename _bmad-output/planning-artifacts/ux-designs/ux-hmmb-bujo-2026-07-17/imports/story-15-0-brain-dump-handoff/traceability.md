# Rastreabilidade — Story 15.0 (Captura e Brain Dump)

Âncoras (`#1d`, `#1e`, `F1`, `E3`, `O4`…) apontam para `Story 15.0 - Captura e Brain Dump.dc.html`.

## Requisito → decisão visual

| Requisito | Decisão visual / de composição | Onde ver |
|---|---|---|
| FR-5.1 — inbox sem data, vazio é o normal | Page Header sem stepper, sem status de ciclo e sem seletor de período; contexto textual “Caixa de entrada sem data”. Empty ocupa o lugar da lista com uma frase e nenhuma ação. | 1d · 1f |
| FR-5.2 — título obrigatório, descrição e destino opcionais | Panel “Capturar” no topo: Título (obrigatório, foco na montagem), Descrição multiline de 2 linhas, Select Destino com as cinco opções canônicas e Brain Dump como padrão. Ação primária desabilitada sem título. | 1d |
| FR-5.3 — processamento manual, sem migração automática | Cada linha tem duas ações nomeadas: Mover (abre o seletor de destino) e Descartar. Nenhum destino é aplicado sem confirmação; a dica gravada só pré-seleciona. | 1e |
| FR-5.4 + AR-20 — indicador persistente derivado do servidor | Badge de `{components.app-shell-badge}` no destino Brain Dump e na captura: trailing na sidebar, sobre o ícone no rail e na bottom nav. Sem contador em outra região; nada de store de cliente. | 1f |
| UJ-4 / Fluxo 3 — capturar em deslocamento | FAB de 52px acima da bottom nav e da safe-area abre o Capture Sheet com foco no título e Brain Dump como destino padrão; salvar fecha o sheet, incrementa o badge e devolve o foco ao FAB sem trocar de rota. | 1e · 1g |
| Padrão Inbox (EXPERIENCE) | Ordem de leitura única em todas as faixas: captura → Section Header “Pendências” com contagem → lista de Item Rows. Nenhum card dentro de card; leitura limitada a `{workspace.reading-width}` = 800px. | 1d |
| Mockup promovido M10 · C — seletor de destino do ritual | Processar reusa a anatomia aprovada do seletor do ritual — mesmo calendário de densidade, mesmos atalhos, mesma ação nomeada — com o seletor de log do pacote no topo. Só o verbo muda: Mover, não Migrar. | 1e |
| Item Row (catálogo) — variante Brain Dump | Mesma anatomia dos templates recorrentes: título, descrição truncada em uma linha, borda esquerda neutra (sem categoria, sem Eisenhower, sem ícone de status). | 1d |
| UX-DR15 — conectividade | Aviso persistente no início do conteúdo, captura e ações de item indisponíveis com motivo (“Sem conexão. Esta ação exige rede.”), captura do shell disabled com o motivo no nome acessível. Nenhuma promessa de fila. | 1f |
| UX-DR14 — loading e escrita otimista | Skeleton com a geometria real da lista (shell e header permanecem); ação exibe “Salvando…” com `aria-busy`; sucesso aparece como linha nova e contagem nova, sem toast. | 1f |
| UX-DR19 / Interaction Primitives — teclado | `B` abre Brain Dump; `Esc` fecha a camada superior; Enter no Título salva; foco inicial no Título ao montar a superfície. | 1g |
| UX-DR20 / Accessibility Floor | Skip link como primeiro foco, `main` único, landmarks nomeados, alvos 44/48px, foco nunca encoberto por topbar/FAB/bottom nav, contagem exata no nome acessível do badge. | 1h |
| DIR-12c — collection desligada/ausente | Não aplicável e não desenhado: Brain Dump e os quatro destinos pertencem ao núcleo não-gateável (FR-1.1). Registrado como recusa. | 1j |

## Cobertura de estado → frame

| Estado | Frame(s) |
|---|---|
| populated | F1 · F2 · F3 |
| empty | E1 |
| loading | E2 |
| read error + retry | E3 |
| offline | E4 |
| saving / write error | E5 |
| alta densidade / texto longo | E6 |
| badge (5 estados + falha do contador) | E7 |
| Capture Sheet dialog / sheet | O1 · O2 |
| confirmação do rascunho | O3 |
| seletor de destino (semana / mês / futuro) | O4 · O4b · O5 |
| sheet de ações do item (compact) | O6 |

## Lacunas conhecidas de rastreabilidade
- **Q5:** EXPERIENCE.md e architecture-and-story-handoff.md não têm seção própria de Brain Dump/captura. Este pacote é a fonte candidata na promoção da 15.0.
- Três elementos não vêm de requisito explícito e estão declarados: data de captura na linha (Q3), chip de dica de destino, sheet de ações do item no compact.
