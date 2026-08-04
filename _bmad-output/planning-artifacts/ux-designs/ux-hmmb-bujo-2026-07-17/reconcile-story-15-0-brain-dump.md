# Reconciliação — Story 15.0

Data: 2026-07-29
Entrada: `imports/story-15-0-brain-dump-handoff/` (pacote produzido por Hugo em outra sessão do Claude)

## Resultado

| Tema da entrada | Destino canônico | Resultado |
|---|---|---|
| Contrato e escopo (§1) | `EXPERIENCE.md.Brain Dump e captura` + `DESIGN.md.Brain Dump (Inbox)` | Promovido |
| Superfícies, camadas e faixas (§2) | `DESIGN.md.Brain Dump (Inbox)` | Promovido |
| Composição por faixa F1–F3 (§3) | `DESIGN.md.Brain Dump (Inbox)` | Promovido; sem mockup HTML próprio ainda (ver §"Cobertura de mockup" abaixo) |
| Overlays O1–O6 (§4) | `EXPERIENCE.md.Brain Dump e captura` + `DESIGN.md.Dialog/Sheet` | Promovido — seletor de destino confirmado como reuso integral do M10 · C |
| Matriz de estados (§5) | `EXPERIENCE.md.State Patterns` | Promovido; a maioria já coberta pelos padrões genéricos (Empty, Read/Write error, Offline, Optimistic); 2 linhas novas para as nuances específicas (erro parcial badge/lista, descartar rascunho) |
| Interação e teclado (§6) | `EXPERIENCE.md.Interaction Primitives` | Promovido; a maior parte já herdada do seletor de migração |
| Acessibilidade (§7) | `EXPERIENCE.md.Accessibility Floor` | Já coberto pelos princípios gerais (landmarks, `aria-live`, alvos, foco, forced colors); nenhuma exceção nova |
| Delta de design system | `DESIGN.md` (frontmatter + `Brain Dump (Inbox)`) | Confirmado: nenhum token novo, nenhum componente novo — todas as referências do handoff já existem no frontmatter atual |
| Domínio preservado + Q1/Q4 | `architecture-and-story-handoff.md#m11--brain-dumpcaptura` | Promovido como obrigação downstream |

## Questões abertas — decisões de Hugo (2026-07-29)

| # | Decisão | Onde ficou registrado |
|---|---|---|
| Q1 — edição do item | **Adicionar edição** (endpoint novo). Reabre o texto do handoff "sheet sem campos editáveis" — superado. | `EXPERIENCE.md.Brain Dump e captura` (§ item ganha edição paritária) + `architecture-and-story-handoff.md#m11` |
| Q2 — descartar sem confirmação | **Manter paridade** (descarta direto). | `EXPERIENCE.md.Brain Dump e captura` |
| Q3 — data de captura | **Manter** (meta tabular na linha e no sheet). | `DESIGN.md.Brain Dump (Inbox)` + `EXPERIENCE.md.Brain Dump e captura` |
| Q4 — scheduled_date em Esta Semana/Este Mês | Já resolvida por Hugo no próprio pacote antes desta sessão. | `EXPERIENCE.md.Brain Dump e captura` + `architecture-and-story-handoff.md#m11`; nota de divergência de paridade permanece para a 15.3 |
| Q5 — lacuna documental | Esta própria promoção fecha a lacuna. | `EXPERIENCE.md`/`DESIGN.md` |
| Q6 — copy "você" | **Adotada** a reescrita, por consistência com a Voice and Tone já vigente. | copy já usada nos textos verbatim do handoff, sem alteração adicional necessária |
| Q7 — locale do campo de mês | **Manter nativo** (input month). | `EXPERIENCE.md.Brain Dump e captura` |

## Divergências resolvidas

| Handoff original | Spine aprovado |
|---|---|
| O6 "o item não expõe... campos editáveis" | Item ganha edição paritária com a captura (Q1); endpoint novo é obrigação de M11 antes da 15.1 |
| "Descartar item?"/"Descartar alterações?" só citado para o Capture Sheet | Aplica-se igualmente ao sheet de edição do item, por consistência de padrão (extensão mínima, não um novo componente) |
| Seletor de log "composição nova" | Confirmado como composição sobre o Dialog/Sheet + Grid/Calendar existentes — nenhum componente novo, registrado em `DESIGN.md.Dialog/Sheet` |

## Cobertura de mockup

O handoff trouxe um pacote visual completo (`Story 15.0 - Handoff visual.html`, lido nesta sessão via PDF exportado), mas o arquivo HTML fonte não foi anexado — só o texto/composição, salvos em `imports/`. A partir dessa especificação, [`mockups/key-brain-dump.html`](mockups/key-brain-dump.html) foi renderizado no estilo real do projeto (mesmos tokens/CSS de `key-weekly.html`, `key-migracao.html` e `key-recorrentes.html`): frames A (wide populado), B (overlays de Capture Sheet e seletor de destino), C (compact recomposto — lista, Capture Sheet, seletor de destino e sheet de edição do item) e D (estados vazio/offline/erro/saving). Linkado inline em `DESIGN.md.Brain Dump (Inbox)` e `EXPERIENCE.md.Brain Dump e captura`.

## Reviewer Gate (2026-07-29)

Rodado com rubric walker + lente de acessibilidade dedicada ao Brain Dump. Achados: 1 critical, 1 high, 6 medium, 5 low — nenhum bloqueante, todos os critical/high/medium de maior impacto corrigidos nesta mesma sessão:

- **Critical** — `{workspace.reading-width}`/`{task-row.min-height-touch}` em DESIGN.md não resolviam contra o frontmatter (faltava o prefixo `components.`). Corrigido.
- **High** — a confirmação de descarte do sheet de edição do item estava especificada para disparar por "texto preenchido", igual ao Capture Sheet; como o item editado sempre chega com texto, isso dispararia em **todo** fechamento, mesmo sem alteração. Corrigido: o sheet de edição dispara por alteração não salva (dirty-state), o Capture Sheet continua disparando por texto preenchido — condições distintas, agora explícitas em `DESIGN.md`/`EXPERIENCE.md`.
- **Medium** — save-path do sheet de edição não estava especificado (fechado? linha atualizada? otimista?); copy da Q6 e a decisão da Q7 (input month nativo) nunca chegaram ao texto do spine, só ao decision log; `Brain Dump (Inbox)` faltava na tabela Component Patterns de EXPERIENCE.md; Fluxo 3 não cobria o round-trip Mover/editar e usava um formato de falha diferente dos outros sete fluxos. Todos corrigidos.
- **Low** — `key-migracao.html`/`key-recorrentes.html` só tinham link na tabela de wireframes legados de EXPERIENCE.md, não inline nas próprias seções `Migração e Catch-Up`/`Recorrentes`. Corrigido com o mesmo callout `→ Composição e estados aprovados` usado pelas demais superfícies.

Relatórios completos: [`review-rubric.md`](review-rubric.md) (reescrito para cobrir o par de spines completo) e [`review-accessibility-brain-dump.md`](review-accessibility-brain-dump.md).

## Ideias qualitativas não absorvidas pelo contrato atual

Nenhuma. O handoff é disciplinado: as únicas três decisões declaradas como não vindas de requisito explícito (data de captura, chip de dica de destino, sheet de ações do item no compact) já estavam corretamente sinalizadas como tal pelo próprio pacote (autocrítica §1k, não promovida por ser meta-processo) e foram absorvidas com decisão explícita de Hugo (Q3) ou por seguirem padrão já aprovado (chip de dica, sheet de item).

Nenhuma regra de produto nasce apenas do mockup.
