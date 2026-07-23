# Contrato do novo design system

## Princípios preservados

1. **Trabalho antes de decoração.** A ação primária e o estado do ciclo ocupam a maior hierarquia; resumos e atalhos ficam secundários.
2. **Densidade controlada.** Listas e grids carregam informação suficiente para decidir sem abrir cada item, mas mantêm legibilidade, foco e alvos de toque.
3. **Superfícies compostas.** Páginas são formadas por regiões reconhecíveis — header, controles de período, superfície principal, contexto lateral e feedback — que podem reorganizar sem perder hierarquia.
4. **Consistência sem uniformidade.** Cards, linhas, chips e painéis compartilham anatomia; variantes expressam função e estado, não estilos arbitrários por módulo.
5. **Semântica redundante.** Cor nunca comunica sozinha; status e prioridade combinam cor com texto, forma ou ícone.
6. **Ritual explícito.** Migração, placement e processamento preservam fricção intencional, progresso, escolha consciente e retomada; o design não automatiza decisões de produto.
7. **Responsividade por recomposição.** Desktop pode usar sidebar, colunas e grids; mobile prioriza sequência, sheets e seletores sem comprimir a mesma composição nem criar scroll horizontal proibido.
8. **Evolução por fundação.** Um padrão só vira local quando uma variação de domínio é comprovada; padrões recorrentes sobem para a camada compartilhada.

## Fundação reutilizável obrigatória

| Fundação | Contrato a ser definido pelo bmad-ux | Consumidores iniciais |
|---|---|---|
| Tokens semânticos | cor, tipografia, espaçamento, raio, borda, elevação, opacidade, foco, densidade, breakpoints e estados | todas as superfícies |
| App shell | sidebar desktop, navegação mobile, área principal, badges, agrupamento e estados ativo/colapsado | todas as rotas autenticadas |
| Page/Period Header | título, contexto temporal, navegação anterior/próximo, ação contextual, stats/chips opcionais | Daily, Weekly, Monthly, Future, Arquivo |
| Workspace Surface | largura, grid, regiões principal/secundária, sticky zones, scroll e reorganização responsiva | Daily, Planner e módulos futuros |
| Card/Panel | anatomia, densidades, cabeçalho, ações, estados vazio/loading/error e composição em grid | dashboards e sidebars |
| Item/Task Row | leading state, título/meta, chips, ações, seleção, hover/focus, drag desktop e detalhe mobile | tarefas, recorrentes, Brain Dump e listas futuras |
| Status/Priority Chip | taxonomia visual sem alterar semântica existente, combinações acessíveis e overflow | tarefas, migração, recorrentes |
| Section/Group Header | rótulo, contagem, progresso, collapse e ações | hábitos, medicamentos, listas agrupadas |
| Date/Range Controls | stepper, today/current, seletor, tabs e estado temporal | todos os logs e históricos |
| Data grid/calendar | cabeçalhos, células, seleção, today, densidade, overflow, responsividade e alternativa mobile | Weekly, Monthly, Hábitos, Saúde |
| Dialog/Sheet/Flow | modal desktop, sheet/full-screen mobile, foco, progresso, ações e retomada | migração, placement, mover, captura, detalhe |
| Feedback states | skeleton, vazio, erro inline, toast, otimista/rollback, offline e disabled | todas as features |
| Data display | KPI, progresso, legendas, gráficos e tabelas sem inventar métricas | Hábitos, Saúde e analytics somente quando previstos |

## Regras de extração do handoff

- Preservar como inspiração: hierarquia de regiões, superfícies principais versus auxiliares, padrões de cards, layouts em grid/colunas, headers temporais, chips compactos, sidebars contextuais, controles persistentes e alternância entre visão operacional e histórica.
- Reconciliar antes de adotar: rail de ícones versus arquitetura de informação real, densidade desktop, calendários, grids horizontais, paleta de prioridade, tipografia, bordas, raios e sombras.
- Descartar: fundo pautado, moldura de app, tags de região, pins/legendas de anotação, toolbar de revisão, fonte manuscrita, conteúdo demonstrativo e qualquer fluxo sem requisito correspondente.
- Tratar todos os wireframes como exemplos, não como catálogo obrigatório de páginas. Analytics, fasting, produtividade, streaks, auto-injeção de recorrentes e campos fixos de saúde não entram sem requisito upstream.

## Decisões reservadas ao bmad-ux

- Direção visual final e distância intencional da estética lo-fi.
- Família tipográfica, escala, pesos, iconografia e regras de motion/reduced motion.
- Paleta semântica unificada, inclusive reconciliação de prioridade e contraste em claro/escuro.
- Escalas exatas de espaçamento, raio, borda, elevação, largura de conteúdo e densidade.
- Anatomia e variantes finais de cada fundação da tabela, incluindo critérios para promoção de componente local a compartilhado.
- Composição responsiva por breakpoint, especialmente Weekly, Monthly, grids históricos, sidebars e fluxos full-screen.
- Arquitetura de informação e navegação final, mantendo apenas destinos e acessos autorizados pelo produto.
- Estados completos de cada padrão: default, hover, focus, pressed, selected, disabled, loading, empty, error, offline e read-only quando aplicável.
- Tratamento visual de dados densos, calendário, gráficos e tabelas sem violar legibilidade ou acessibilidade.
- Estratégia de tema e compatibilidade visual durante a convivência entre superfícies legadas e novas.
- Protótipos e critérios visuais dos gates definidos em `migration-plan.md`.

