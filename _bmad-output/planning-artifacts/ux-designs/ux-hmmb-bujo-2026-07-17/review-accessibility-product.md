# Review — Acessibilidade e fidelidade ao produto

## Veredito

**Acessibilidade: adequada, ainda não liberável. Fidelidade ao produto: quebrada em decisões pontuais de alta importância.** A dupla estabelece bons pisos para teclado, touch, reflow, leitores de tela e estados, mas ainda não especifica comportamentos verificáveis para todos os componentes/superfícies. Há também divergências diretas com contratos vigentes dos épicos. Os mockups podem ser produzidos, porém essas divergências precisam ser decididas e registradas antes de os mockups virarem contrato de implementação.

## Achados

### Alta

- **A navegação e a localização de Recorrentes divergem do produto implementado.** A IA cria um destino de primeiro nível `Recorrentes` e admite bottom nav variável + menu (`EXPERIENCE.md` §Information Architecture, linhas 42–57). O Épico 11.2 moveu Recorrentes para abas do Planner e removeu sua gestão de Configurações; UX-DR8 fixa quatro abas mobile (Hoje, Planner, Hábitos, Saúde), FAB e proíbe drawer/hambúrguer. *Correção:* inventariar as rotas reais; fixar Recorrentes dentro do Planner e documentar o acesso aos demais destinos mobile sem contradizer a navegação entregue.

- **Migração troca um contrato de interação vigente sem reconciliação.** O spine exige tela cheia em todas as plataformas (`DESIGN.md` §Dialog, Sheet e Ritual, linhas 188–190; `EXPERIENCE.md` linhas 59 e 101), enquanto UX-DR3 exige modal overlay no desktop e full-screen apenas no mobile, com ações `1`–`4`, pickers e retomada. A SPEC permite recomposição, mas exige equivalência e decisão explícita, não substituição silenciosa. *Correção:* registrar uma decisão de produto/UX: manter modal desktop ou aprovar formalmente full-screen desktop; em ambos, preservar as quatro decisões, ausência de preseleção, pickers, atalhos e pausa.

- **Os contratos de interação já entregues foram reduzidos a “inventariar depois”.** O spine não compromete `[`/`N`/`B`, teclas `1`–`4`, FAB 52 px, long-press, detalhe inline desktop/bottom sheet mobile e drag apenas desktop; deixa atalhos para inventário futuro (`EXPERIENCE.md` linhas 142–153). UX-DR2/3/6/19 e histórias concluídas já os tornam parte da paridade. *Correção:* incorporar os comportamentos existentes como baseline explícita ou registrar, item a item, qual será deliberadamente substituído.

- **Auth não tem superfície nem padrão suficiente para mockup/aceite.** A migração inclui auth na Onda 6 (`EXPERIENCE.md` linhas 178–188), mas a IA cobre somente rotas autenticadas; faltam Login, Cadastro, restauração de sessão, erro de credencial e sessão expirada. Isso deixa FR-0.2, UX-DR16 e Epic 2 sem representação. *Correção:* adicionar a família Auth à IA, estados e inventário visual, inclusive preservação de formulário/estado durante expiração.

- **Contraste de tokens semânticos ainda não fecha AA.** Em cálculo sRGB, `{colors.warning}` sobre `{colors.warning-soft}` resulta em aproximadamente **4,21:1**, abaixo de 4,5:1 para labels de 12 px; `{colors.border}` sobre `{colors.surface}` fica abaixo de 3:1 quando a borda é o único contorno de componente. O spine declara AA universal, mas não nomeia combinações válidas nem tokens de borda interativa (`DESIGN.md` linhas 15–38, 112–125). *Correção:* escurecer warning foreground ou trocar o par; criar tokens separados para borda decorativa e contorno de controle, com ≥3:1 para estados necessários; publicar uma matriz de contraste por combinação/estado.

### Média

- **O catálogo comportamental é insuficiente para testar teclado em grids/calendários.** “teclado, headers, alternativa de lista” (`EXPERIENCE.md` linhas 98–101, 155–165) não define modelo de foco, setas, Home/End, Enter/Space, seleção, anúncio de mudança de período nem saída do grid. *Correção:* definir se o padrão usa tabela com controles tabbáveis ou grid composto/roving tabindex e documentar teclas e nomes acessíveis.

- **Estados globais não estão mapeados por superfície.** A tabela é boa, mas não resolve permission/unauthenticated/session-expired, dados parciais, zero-result de busca, conflito/duplicação de placement, tarefa já alterada, limite/overflow e erro parcial de confirmação em lote (`EXPERIENCE.md` linhas 124–140). *Correção:* anexar uma matriz superfície × estados aplicáveis e dar tratamento específico a auth, rituais, filtros e mutações em lote.

- **Target mínimo conflita com chips e linhas densas se forem acionáveis.** `chip.height = 24px` e linha pointer de 36px (`DESIGN.md` linhas 73–87) convivem com piso de 44×44 (`EXPERIENCE.md` linhas 155–159), sem dizer quando chip é somente display nem como controles inline recebem hit-area sem aumentar a linha. *Correção:* separar `Chip` informativo de `Filter/Action Chip`; definir caixa interativa mínima, espaçamento entre alvos e exceção WCAG 2.5.8 somente quando realmente aplicável.

- **Responsividade é macro, não demonstrável para todas as famílias.** Há breakpoints e regras para Weekly/Monthly, mas faltam recomposições específicas para formulários densos, health history, habit grid, medication blocks, arquivo/filtros, settings, teclado virtual e safe areas (`DESIGN.md` linhas 133–144; `EXPERIENCE.md` linhas 167–176). *Correção:* cada mockup deve ter wide, ponto crítico intermediário e 320 CSS px, com anotação de ordem, sticky/scroll e ação principal.

- **Tema escuro permanece uma divergência upstream.** O novo spine o exclui da fundação (`DESIGN.md` linha 125), enquanto UX-DR1 dos épicos exige light + dark e preferência em Configurações. Isso não inventa funcionalidade do handoff, mas remove requisito vigente. *Correção:* decidir via correct-course se dark mode foi cancelado; até lá, não marcar o design system como final.

- **Terminologia de Saúde pode reintroduzir “dashboard” sem regra clara.** O spine rejeita dashboard/analytics não previsto, mas o PRD FR-3.3 exige “Dashboard de período”; `EXPERIENCE.md` chama genericamente “histórico em tabela, gráfico e período” (linha 120). *Correção:* nomear explicitamente “Resumo de período previsto em FR-3.3”, listar apenas métricas derivadas autorizadas e manter a rejeição de analytics inventado.

### Baixa

- **`ink-disabled` tem contraste aproximado de 3,03:1 sobre surface.** Conteúdo disabled é exceção normativa de contraste, mas o próprio design promete label legível (`DESIGN.md` linhas 20–24 e 192–194). *Correção:* validar com usuários/zoom ou elevar contraste sem confundir disabled com enabled.

- **Faltam preferências de movimento e zoom nos mockups de aceite.** O texto cobre reduced motion e reflow, mas não explicita font scaling, orientação e 400% zoom para conteúdo estreito quando aplicável. *Correção:* adicionar essas evidências ao checklist de validação, sem criar telas novas.

## Fidelidade e contenção de escopo

O spine está **forte** ao preservar máquina de estados, linhagem, snapshots, placement manual, ciclos, módulos futuros autorizados e MVP sem offline. Também rejeita corretamente streaks, fasting, IA, auto-injeção, campos fixos de saúde e analytics não previsto (`EXPERIENCE.md` linhas 103–122 e 213–217). Não foi encontrada funcionalidade nova claramente importada do handoff. O risco principal não é expansão de escopo; é apagar ou substituir contratos existentes de navegação e interação sem decisão rastreável.

## Inventário obrigatório para cobertura integral de mockups

Cada item abaixo precisa de **wide desktop**, **variante intermediária quando a recomposição divergir** e **mobile a 320 CSS px**. Estados podem ser reunidos em boards anotados, mas nenhum estado aplicável pode ficar apenas implícito.

### Fundação e acesso

1. App shell autenticado: sidebar expandida/colapsada, Planner expandido, destino ativo, Brain Dump com badge; bottom nav, FAB/safe-area e acesso aos destinos sem aba.
2. Login; cadastro; restauração de sessão; credencial inválida; sessão expirada preservando a UI; sem conexão.
3. Catálogo operacional: tipografia, cores/contraste, botões, inputs, chips informativos/interativos, rows, panels, headers, focus/hover/pressed/selected/disabled/readonly, skeleton/empty/error/offline/toast/dialog/sheet.

### Núcleo já implementado

4. Hoje/Daily: normal, vazio, skeleton, erro, offline, tarefas/subtarefas, estados completos, criação/edição, detalhe, reordenação e pendências/catch-up.
5. Semana: sete colunas + pool/sem data + recorrentes; período passado aberto; fechado readonly; versão mobile por dia.
6. Mês: calendário + itens; CRUD; período passado aberto; fechado readonly; lista cronológica mobile.
7. Futuro: agrupamento mensal, data completa/parcial, anuais pendentes e placement.
8. Recorrentes dentro do Planner: abas/filtros, lista, vazio, criar/editar/desativar e categoria.
9. Placement de recorrentes: informação da recorrência, calendário de densidade, deduplicação, seleção e confirmação/erro.
10. Mover/Migrar tarefa: abas Hoje/Semana/Mês/Futuro, destino dia/mês, confirmação explícita, conflito/erro e retorno de foco.
11. Migração diária, semanal, mensal e Catch-Up multinível: uma tarefa, pickers, progresso, pausa/retomada, erro e resumo final; modalidade desktop a decidir.
12. Arquivo: lista/filtros, vazio/erro, semana fechada, mês fechado, detalhe e linhagem readonly.
13. Brain Dump: vazio saudável, lista pendente, captura, processamento/mover/descartar, erro e badge atualizado.
14. Capture Sheet mobile: teclado aberto, destinos, validação, salvando, falha preservando texto e offline/FAB desabilitado.
15. Configurações/conta atuais e qualquer placeholder realmente roteável, sem antecipar cadastros futuros.

### Módulos autorizados futuros

16. Hábitos — configuração de grupos/hábitos, ativos/inativos, booleano/numérico; tracker diário; tipo de dia/pesos; histórico por data; gráfico com eventos + tabela equivalente.
17. Saúde — configuração de campo dinâmico por tipo; log de ontem/hoje; histórico em tabela, gráfico por campo e resumo de período FR-3.3; inativos no histórico.
18. Medicamentos — configuração/versionamento e blocos; confirmação diária individual/em lote nos estados pendente/parcial/confirmado; dose perdida; histórico.
19. Gratidão — composer com múltiplas entradas; dia vazio; histórico por data e mês; erro preservando texto.
20. Gestão de usuários **pós-MVP**, em board separado e rotulado future: convite, estado do convite e onboarding isolado; não incluir ranking/competição backlog.

### Boards transversais obrigatórios

21. Matriz de estados por superfície: initial/local loading, empty inicial/filtro, read/write error, offline, disabled com motivo, optimistic/rollback, readonly/archive e closed cycle.
22. Teclado e foco: shell, task row, reorder alternativo, grid/calendar, dialog/sheet, ritual e retorno de foco; atalhos existentes anotados.
23. Acessibilidade de dados: contrastes, não-cor, nomes acessíveis, aria-live, tabela alternativa de gráfico e leitura de linhagem/status.
24. Reflow/responsividade: 1440+, 1024, 768 e 320 CSS px; zoom 200%; teclado virtual; orientação e safe-area onde aplicável.

## Gate recomendado

Não liberar desenvolvimento enquanto os cinco achados altos não forem reconciliados. Depois, produzir os 24 conjuntos acima, executar revisão de paridade produto + teclado/touch/reflow/contraste sobre os mockups e somente então promover ambos os spines de `draft` para `final`.
