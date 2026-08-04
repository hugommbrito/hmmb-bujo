# Reconciliação — Story 14.0

Data: 2026-07-24
Entrada: `../../../implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md`

## Resultado

| Tema da entrada | Destino canônico | Resultado |
|---|---|---|
| Complemento estrito | `.working/archive-14-0-coverage-audit.md` | M06–M10 confirmados suficientes; nenhum redesenho |
| Arquivo Histórico | `DESIGN.md.Arquivo` + `EXPERIENCE.md.Arquivo e ciclo fechado` | Promovido |
| Semanal/Mensal | `.working/key-archive.html` | Abas alinhadas à visão futura, implementáveis com o índice atual |
| Estados obrigatórios | `EXPERIENCE.md.Arquivo e ciclo fechado` + mock seção B | Promovido |
| Readonly | DESIGN/EXPERIENCE + mock detalhe | Mutações ausentes; navegação e detalhe ativos |
| Linhagem | EXPERIENCE + mock seção A/A2 | Origem → sucessor e retorno preservado |
| Responsividade e AA | EXPERIENCE + mock seções B/C/D | Wide, medium, tablet, compact, 320/200%, foco e forced colors |
| Collection ausente | EXPERIENCE.State Patterns + mock seção B | Núcleo e Planner-base permanecem; nenhum destino disabled |
| Visão futura | `../../../deferred-features.md` + `.working/future-vision/` | Separada do contrato; aprovada como exploração |

## Ideias qualitativas não absorvidas pelo contrato atual

- Daily Logs e históricos de collections no Arquivo.
- Linha do tempo diária unificada com resumos objetivos.
- Busca histórica apenas de tarefas.
- Linhagem bidirecional com todos os pontos navegáveis.
- Resumo de período por IA.
- Preferência por collection **Compartilhar com o Arquivo**.

Esses itens não foram descartados: estão catalogados em `../../../deferred-features.md` e ilustrados em `.working/future-vision/archive-future-vision.html`.

## Divergências resolvidas

| Inventário atual | Spine aprovado |
|---|---|
| Fechado impede abrir detalhe | Readonly remove mutações, não leitura |
| `Mover tarefa` ainda aparece sem callbacks | Ação ausente em Arquivo |
| Completed usa aparência disabled | Conteúdo histórico mantém contraste normal |
| Seta migrated não navega | Origem → sucessor imediato permanece ativa |
| Índice sem filtros estruturados | Filtro cliente usa somente tipo e chave temporal; nenhum dado novo presumido |

Nenhuma regra de produto nasce apenas do mockup. Deltas de runtime permanecem para a Story 14.10.
