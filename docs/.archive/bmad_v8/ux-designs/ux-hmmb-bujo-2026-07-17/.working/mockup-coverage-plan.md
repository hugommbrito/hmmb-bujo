# Plano de cobertura visual — aprovação pré-desenvolvimento

Status: **gate da Fundação FECHADO** (2026-07-21). M01–M10 aprovados e promovidos; `DESIGN.md` e `EXPERIENCE.md` em `status: final`. Demais superfícies (M11–M23) diferidas para a onda de migração de cada uma. Próximo rito: Correct Course (convergência com a triagem de ideias).

## Regra de cobertura

Cada rota ou fluxo com composição própria recebe um mockup. Variações que apenas trocam dados usam o mesmo arquivo com painéis de estado. Toda superfície responsiva recebe desktop + mobile no mesmo artefato quando a recomposição for material.

## Linha de corte — gate da Fundação vs. ondas de migração (decisão 2026-07-21)

O `bmad-ux` não precisa de todos os mockups (M01–M23) para cumprir seu papel. Ele precisa provar a **Fundação** nos **gates** definidos pela SPEC (`protótipos dos gates Daily + Planner/Migração`). O restante das superfícies migra **onda a onda**, e cada mockup de módulo/configuração deve ser produzido **na sua onda de migração**, já com o conjunto de features estável.

Motivo: há uma triagem de novas ideias (`docs/futureIdeas.md`) em curso (Brainstorm → Correct Course) que pode adicionar/alterar features das superfícies de módulo e de configurações. Detalhar esses mockups agora, no conjunto antigo de features, geraria retrabalho.

**Estado desta decisão:**

- **✅ Aprovados (Fundação + núcleo):** M01–M08. Não reabrir. Features aditivas sobre superfície aprovada (ex.: card de resumo/observação em Hoje, estado "aguardando terceiro" na tarefa) entram como stories na onda da superfície, compondo a partir das primitivas já aprovadas — sem redesenho do mockup.
- **✅ Gate fechado:** M09 (Recorrentes) e M10 (Migração/Catch-Up) aprovados e promovidos. Decisões promovidas para `DESIGN.md`/`EXPERIENCE.md` (seção Recorrentes + controles Categoria/Eisenhower como padrão + soft delete + termo "Alocar"; seção Migração/Catch-Up como ritual dentro do shell + fila unificada + aba "Esta semana" + resumo). Spines em `status: final`. `bmad-ux` cumpriu seu papel central.
- **⏸ Diferidos para a onda de cada superfície (pós-triagem de ideias):** M11–M23. Não são gate. Produzir cada um quando sua onda de migração começar, com o conjunto de features já decidido pelo Correct Course. Superfícies diretamente churnadas pelas ideias: Saúde/métricas (M16/M17/M22 — #16–19), Configurações-índice (M20 — #13/#14). O toggle de habilitar/desabilitar módulos (#14) é transversal e afeta o estado "desabilitado" de todas as superfícies de módulo.

## Fundação e acesso — ✅ aprovado

| ID | Mockup | Estados/variantes obrigatórios |
|---|---|---|
| M01 | Login | aprovado: `key-login-v2.html` é a referência canônica para desktop, mobile, erro, loading e sessão expirada |
| M02 | Signup | aprovado: `key-signup.html` cobre desktop/mobile, confirmação de senha, validações, loading e redirect automático |
| M03 | App Shell | estrutura v2 aprovada em desktop expandido/compacto, tablet e mobile; seleção final de ícones fica para o acabamento transversal |

## Núcleo BuJo implementado

M04–M10 ✅ aprovados (gate fechado). M11–M12 ⏸ diferidos para a onda de cada superfície.

| ID | Mockup | Estados/variantes obrigatórios |
|---|---|---|
| M04 | Hoje / Daily | ✅ aprovado: composição, duas lentes, estados e refinamento com dados reais de Saúde, Hábitos, Medicamentos e Gratidões em `key-hoje-real-data.html` |
| M05 | Detalhe/criação de tarefa | ✅ aprovado: `key-task-create-detail.html` cobre quick-add, drawer, sheet, validação, loading, erro e readonly terminal |
| M06 | Weekly | ✅ aprovado: `key-weekly.html` cobre grade desktop em múltiplas faixas, pool lateral, ritual desktop/mobile, densidade, ciclo planejamento→andamento→finalizada, linhagem, finalização, falha parcial e offline |
| M07 | Monthly | ✅ aprovado: `key-monthly.html` cobre calendário desktop com tarefas e scroll interno, pool sem dia, lista mobile, ritual desktop/mobile, densidade por status, seletor de destino, ciclo sequencial, vazio, fechado/readonly, falha parcial e offline |
| M08 | Future Log | ✅ aprovado: `key-future-log.html` cobre horizonte rolante de 8 meses (com vazios), seletor de meses distantes com contagem, data parcial/completa, datear/mover no lugar com linhagem, empty/loading/erro/offline, item migrado terminal e recomposição mobile |
| M09 | Recorrentes | ✅ aprovado: `key-recorrentes.html` cobre biblioteca por abas, detalhe criar/editar (card de tarefa; grupo readonly na edição), soft delete com confirmação, alocação **por referência** aos rituais (não redesenhada), recomposição mobile e estados (empty/loading/erro/offline/inativo/validação) |
| M10 | Migração / Catch-Up | ✅ aprovado: `key-migracao.html` — banner discreto unificado, ritual dentro do shell (fontes = níveis mês→semana→dia), seletor com aba "Esta semana", pausar/retomar por itens restantes, resumo factual, mobile e estados (pausado/erro/offline/sem-DOM/parcial) |
| M11 | Brain Dump | ⏸ diferido → onda: inbox com itens, empty saudável, processamento, capture mobile |
| M12 | Arquivo | ⏸ diferido → onda: índice, filtro vazio, semana fechada, mês fechado, detalhe readonly |

## Módulos previstos no produto — ⏸ diferido para a onda de cada módulo (pós-triagem)

| ID | Mockup | Estados/variantes obrigatórios |
|---|---|---|
| M13 | Hábitos — Hoje | booleano/numérico, grupos, lacuna, loading/error, mobile |
| M14 | Hábitos — Histórico | data, gráfico autorizado, mudança real, alternativa tabular |
| M15 | Configurações de hábitos | lista, criação/edição, efeito prospectivo, desativação |
| M16 | Saúde — Registro | campos dinâmicos por tipo, ontem/hoje, validação, mobile |
| M17 | Saúde — Histórico | tabela, gráfico por campo, período, alternativa textual |
| M18 | Medicamentos | blocos dinâmicos, parcial/confirmado, dose perdida, histórico |
| M19 | Gratidão | composer, múltiplas entradas, empty, histórico por mês, mobile |

## Configurações — ⏸ diferido para a onda de configurações (pós-triagem)

| ID | Mockup | Estados/variantes obrigatórios |
|---|---|---|
| M20 | Configurações — índice | seções atuais e futuras somente quando disponíveis |
| M21 | Configurações — recorrentes | compartilhado com M09; mostrar efeito prospectivo |
| M22 | Configurações — métricas | campos dinâmicos, tipo enum, desativação |
| M23 | Configurações — medicamentos | slot, substância, dose por bloco, versões prospectivas |

## Aprovação

A aprovação é em dois níveis:

- **Fundação (gate): ✅ ATINGIDO em 2026-07-21** — M01–M10 prontos e promovidos, decisões nos spines (`status: final`). Destrava a decisão de arquitetura e o Correct Course.
- **Por superfície (onda):** cada mockup diferido (M11–M23) é produzido e aprovado dentro da onda de migração da sua superfície, já com o conjunto de features estabilizado pela triagem de ideias — não todos antecipadamente.

Nenhuma tela é liberada para desenvolvimento até:

1. direção visual escolhida;
2. mockup correspondente aprovado;
3. estados obrigatórios representados ou ligados a um padrão visual aprovado;
4. contraste, reflow, teclado e touch validados;
5. decisões do mockup promovidas para `DESIGN.md`/`EXPERIENCE.md`;
6. qualquer divergência funcional removida ou marcada como futura com fonte upstream.
