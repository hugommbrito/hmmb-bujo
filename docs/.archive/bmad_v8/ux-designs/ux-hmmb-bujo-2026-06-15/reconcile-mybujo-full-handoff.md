# Reconciliação — MyBujo Full Handoff

Data: 2026-07-17  
Fonte: `imports/mybujo-full-handoff/design_handoff_full_app/`

## Regra de autoridade

A SPEC e seus companions governam a migração. PRD, arquitetura, épicos e comportamento implementado governam produto e domínio. O handoff informa composição apenas quando não conflita com essas fontes.

## Resultado por superfície

| Referência | Aproveitado | Rejeitado ou condicionado |
|---|---|---|
| Daily Dashboard | hierarquia temporal, lista dominante, contexto secundário, quick add | score de produtividade, ritual inventado e variante escolhível de layout |
| Weekly View | header de período, densidade por dia, contexto lateral | auto-injeção, regra temporal não confirmada e grid comprimido no mobile |
| Monthly/Future | alternância operacional/histórica, calendário e agrupamento por mês | stats inventados, drag como única interação e auto-pull sem confirmação |
| Migration Ritual | fluxo dedicado, progresso, origem/destino e decisão explícita | ações ou automações que divergirem da máquina de estados real |
| Recurrents Engine | coleção de templates, agrupamento e edição contextual | engine auto-injetável, “synced”, audit trail e frequência executável não prevista |
| Habits | tracker diário primário, histórico secundário e grid denso | streak, ranking, tipos/cálculos divergentes dos Épicos 6 e arquitetura |
| Gratitude | composer dominante e histórico por período | streak, insights, infinite scroll obrigatório e prompts de produto |
| Health | separação entre registro e histórico, controles por período | fasting, campos fixos, BMI e dashboards não rastreados ao PRD |
| Analytics | somente padrões genéricos de tabela/gráfico acessível | página e métricas inteiras até requisito upstream explícito |

## Elementos globais

- Aproveitados: shell lateral, headers temporais, regiões principal/secundária, chips compactos, cards com função, grids e controles persistentes.
- Reconciliados: rail, densidade, breakpoints, paleta, tipografia, raios e elevação conforme `DESIGN.md`.
- Descartados: papel pautado, moldura, toolbar, pins, legendas, tags de região, fontes, SVGs, CSS, JavaScript e conteúdo demonstrativo.

Os spines `DESIGN.md` e `EXPERIENCE.md` vencem em qualquer conflito com esta reconciliação ou com os arquivos importados.
