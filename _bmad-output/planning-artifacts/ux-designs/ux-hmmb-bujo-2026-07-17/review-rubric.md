# Spine Pair Review — HMMB BuJo

## Overall verdict

O par está **adequado**, próximo de forte, como contrato para arquitetura e story-dev. A Story 14.0 e o mock aprovado fecham o Arquivo de forma implementável e rastreável, mas a promoção ainda não terminou: os spines apontam para um arquivo inexistente em `mockups/`, e o padrão novo `Archive History` não foi incorporado ao catálogo bilateral de componentes.

## 1. Flow coverage — strong

Foram confrontadas as oito jornadas upstream, a rastreabilidade dos requisitos e os oito Key Flows. UJ-2–UJ-5 possuem fluxo atual com protagonista nomeado, passos numerados, clímax e falha; UJ-1 está explicitamente delimitada/diferida, e UJ-6–UJ-8 têm gates nomeados. O Fluxo 4 cobre a Story 14.0 de ponta a ponta: selecionar ciclo fechado, ler detalhe readonly, seguir a linhagem e retornar preservando contexto.

### Findings

Nenhum.

## 2. Token completeness — strong

Os tokens do frontmatter e as referências reais `{path.to.token}` foram verificados. As cores possuem valores hex, as oito combinações de família/modo têm papéis completos, os aliases de Mineral Light têm algoritmo explícito e os pares load-bearing declaram metas WCAG 2.2 AA. Expressões editoriais como `{grupo}`, `{recurrence_text}` e `{família}-{modo}-{papel}` são placeholders de conteúdo/algoritmo, não referências de token.

### Findings

Nenhum.

## 3. Component coverage — adequate

O catálogo bilateral existente mantém 30 nomes alinhados entre `DESIGN.md.Components` e `EXPERIENCE.md.Component Patterns`, com regras visuais e comportamentais substanciais. O Arquivo reutiliza corretamente Task Row, Date/Range Control, Dialog/Sheet e Feedback, mas introduz também um componente composto nomeado e tokenizado fora desse catálogo.

### Findings

- **[medium]** `archive-history` está definido no frontmatter e consumido como “padrão Histórico”, porém `Archive History` não possui linha em `DESIGN.md.Components` nem em `EXPERIENCE.md.Component Patterns` (`DESIGN.md:388–394, 504–538, 634–644`; `EXPERIENCE.md:111–142, 366–380`). *Fix:* adicionar `Archive History` aos dois catálogos, com anatomia visual (abas, filtro, lista mestre, detalhe readonly e recomposição) e regras comportamentais (seleção, carregamento, linhagem e restauração de contexto).

## 4. State coverage — strong

Todas as superfícies da IA foram confrontadas com State Patterns, Resiliência canônica e seus deltas específicos. Para o Arquivo, estão comprometidos loading, empty inicial, empty por filtro, erro/retry, offline/cache ausente, readonly/closed, ausência de collections, foco/retorno e reflow; o mock mostra cada estado sem introduzir mutação ou contrato de dados.

### Findings

Nenhum.

## 5. Visual reference coverage — thin

Os sete arquivos atualmente presentes em `mockups/` têm referências inline nas seções pertinentes. Os nove wireframes HTML de `imports/` estão ligados individualmente em Inspiration & Anti-patterns; o README é source, e scripts/fontes são identificados como dependências internas. A visão futura está corretamente isolada em `.working/future-vision/` e marcada como não contratual. A precedência dos spines está declarada.

### Findings

- **[high]** `DESIGN.md` e `EXPERIENCE.md` declaram `mockups/key-archive.html` como referência aprovada, mas esse arquivo ainda não existe; a versão aprovada permanece em `.working/key-archive.html` (`DESIGN.md:644`; `EXPERIENCE.md:380`). Um consumidor que segue o spine encontra um link quebrado, e a tarefa explícita de promoção da Story 14.0 continua aberta. *Fix:* promover a versão aprovada para `mockups/key-archive.html`, preservando o artefato de trabalho conforme a política do workspace, e então verificar novamente os dois links.

## 6. Bloat & overspecification — adequate

Os spines são extensos, mas o volume corresponde à complexidade load-bearing dos ciclos, estados, recomposição, linhagem e acessibilidade. O Arquivo foi incorporado como delta focado; a exploração aditiva não foi misturada ao contrato atual. Companions absorvem rastreabilidade e obrigações técnicas sem duplicá-las integralmente nos spines.

### Findings

Nenhum.

## 7. Inheritance discipline — strong

Todos os `sources` de ambos os frontmatters resolvem, incluindo a Story 14.0. A assimetria de fontes está justificada; jornadas upstream mantêm nomenclatura verbatim; aliases de componentes são explícitos; e referências de tokens consumidas por `EXPERIENCE.md` resolvem em `DESIGN.md`. O vocabulário do Arquivo — Semanal, Mensal, Fechado, Somente leitura, origem e sucessor — coincide entre story, spines, reconciliação e mock.

### Findings

Nenhum.

## 8. Shape fit — strong

`DESIGN.md` segue a ordem canônica completa: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. `EXPERIENCE.md` contém todos os defaults obrigatórios, além de Responsive & Platform para a aplicação multi-surface e Inspiration & Anti-patterns para referências e rejeições. As seções inventadas têm consumidores downstream claros.

### Findings

Nenhum.

## Mechanical notes

- Frontmatter legível; todos os caminhos em `sources` existem.
- Oito Key Flows; todos possuem clímax e failure path próprio ou referência explícita à Resiliência canônica.
- Catálogo bilateral vigente: 30 nomes alinhados; `Archive History` é a única omissão identificada.
- Referências de composição promovidas existentes: 7/8; falta somente `mockups/key-archive.html`.
- Story 14.0: seis ACs cobertos pelo mock/spines; a promoção exigida pelo AC 5 e pela Task 3 ainda não está materializada.
- Nenhum bloco Mermaid presente.
- Contagem de findings: 0 critical, 1 high, 1 medium, 0 low.
