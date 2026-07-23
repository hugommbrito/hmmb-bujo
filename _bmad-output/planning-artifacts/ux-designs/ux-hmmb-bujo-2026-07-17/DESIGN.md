---
name: HMMB BuJo — Sistema Operacional Visual
description: Design system denso, calmo e produtivo para o Bullet Journal digital do hmmb-bujo.
status: final
created: 2026-07-17
updated: 2026-07-21
sources:
  - ../../../specs/spec-design-system-migration/SPEC.md
  - ../../../specs/spec-design-system-migration/design-system-contract.md
  - ../../../specs/spec-design-system-migration/migration-plan.md
  - ../../prds/prd-hmmb-bujo-2026-06-15/prd.md
  - ../../architecture.md
  - ../../epics.md
  - imports/mybujo-full-handoff/design_handoff_full_app/README.md
colors:
  canvas: '#F5F2EA'
  surface: '#FBFAF6'
  surface-subtle: '#EEEBE2'
  surface-strong: '#E3DFD5'
  ink: '#25231F'
  ink-muted: '#666159'
  ink-disabled: '#969087'
  border: '#D6D1C7'
  border-strong: '#AAA399'
  primary: '#315F5A'
  primary-hover: '#274D49'
  primary-soft: '#DDEAE7'
  on-primary: '#FFFFFF'
  info: '#3D6488'
  info-soft: '#E2EBF3'
  success: '#4B6F52'
  success-soft: '#E2EBE1'
  warning: '#8A6826'
  warning-soft: '#F2E8CE'
  danger: '#9A493F'
  danger-soft: '#F3E1DE'
  category-teal: '#2BADA0'
  category-purple: '#7B5EA7'
  category-pink: '#D95F78'
  category-yellow: '#C89B00'
  category-green: '#4A8C5C'
  category-blue: '#3D72B4'
  priority-ui: '#C0392B'
  priority-u: '#D4660A'
  priority-i: '#B8920A'
  focus: '#166C9C'
  overlay: 'rgba(37, 35, 31, 0.48)'
typography:
  page-title: { fontFamily: 'Inter', fontSize: '24px', fontWeight: '600', lineHeight: '1.25', letterSpacing: '-0.02em' }
  section-title: { fontFamily: 'Inter', fontSize: '16px', fontWeight: '600', lineHeight: '1.35' }
  body: { fontFamily: 'Inter', fontSize: '14px', fontWeight: '400', lineHeight: '1.45' }
  body-strong: { fontFamily: 'Inter', fontSize: '14px', fontWeight: '600', lineHeight: '1.45' }
  meta: { fontFamily: 'Inter', fontSize: '12px', fontWeight: '400', lineHeight: '1.4' }
  label: { fontFamily: 'Inter', fontSize: '12px', fontWeight: '600', lineHeight: '1.3', letterSpacing: '0.01em' }
rounded:
  xs: '2px'
  sm: '4px'
  md: '6px'
  lg: '8px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  '12': '48px'
components:
  app-shell:
    sidebar-expanded: '240px'
    sidebar-collapsed: '64px'
    topbar-height: '56px'
    canvas: '{colors.canvas}'
  workspace:
    max-width: '1440px'
    reading-width: '800px'
    gutter-wide: '{spacing.8}'
    gutter-compact: '{spacing.4}'
  weekly-board:
    gap: '{spacing.2}'
    weekday-min-width: '240px'
    unscheduled-min-width: '235px'
    day-scroll: 'internal'
    terminal-opacity: '0.58'
  weekly-planning:
    source-rail: '190px'
    context-rail: '315px'
    density-position: 'sticky'
  monthly-board:
    columns: '7'
    gap: '{spacing.2}'
    undated-width: '268px'
    day-scroll: 'internal'
    terminal-opacity: '0.58'
  monthly-planning:
    source-rail: '188px'
    context-rail: '310px'
    density-position: 'sticky'
  future-board:
    trail-width: '230px'
    horizon-months: '8'
    focus-scroll: 'internal'
    terminal-opacity: '0.58'
  task-row:
    min-height-pointer: '36px'
    min-height-touch: '48px'
    padding: '{spacing.2} {spacing.3}'
    radius: '{rounded.sm}'
    hover: '{colors.surface-subtle}'
    category-border-width: '3px'
    category-border-fallback: '{colors.border}'
    description: '{typography.meta}'
    status-icon-size: '20px'
  domain-icon:
    library: '@phosphor-icons/react'
    weight: 'regular'
    size-compact: '18px'
    size-default: '20px'
    color: 'currentColor'
  panel:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    padding: '{spacing.4}'
  chip:
    height: '24px'
    radius: '{rounded.sm}'
    typography: '{typography.label}'
  focus-ring:
    color: '{colors.focus}'
    width: '2px'
    offset: '2px'
---

# HMMB BuJo — Design System

> Novo contrato visual canônico da migração de 2026-07-17. Não herda o design de 15/06. O handoff MyBujo é referência de composição; este arquivo vence em qualquer conflito.

## Brand & Style

O hmmb-bujo é uma ferramenta de trabalho pessoal organizada pelo tempo e por rituais. Sua aparência deve lembrar um instrumento editorial de uso diário: silencioso, preciso e tátil sem imitar papel. A interface privilegia listas, períodos, decisões e histórico — nunca decoração ou métricas sem ação.

Princípios vinculantes:

1. **Trabalho em primeiro plano.** A região onde Hugo age é sempre a maior e mais contrastante.
2. **Densidade legível.** Desktop comporta muitas linhas; touch preserva alvos confortáveis sem perder contexto.
3. **Calma operacional.** Pouca cor, nenhuma celebração e movimento apenas para explicar mudança.
4. **Estrutura, não cards por padrão.** Espaçamento, divisores e headings criam hierarquia; panels existem quando delimitam função.
5. **Digital nativo.** Nenhuma pauta, fita, letra manuscrita ou moldura de caderno.

MUI continua como infraestrutura conforme a arquitetura. Seus comportamentos acessíveis são preservados; a camada visual deste contrato substitui a aparência Material genérica. Phosphor complementa essa infraestrutura como biblioteca de pictogramas de domínio; não substitui indiscriminadamente os controles MUI nem os ícones de estado já consolidados.

## Colors

A paleta usa papel mineral claro e tinta quente, com verde-petróleo como ação. A cor primária aparece em seleção, foco contextual e ação principal — não em grandes áreas decorativas.

- `{colors.canvas}` é o fundo contínuo do workspace.
- `{colors.surface}` recebe panels, sheets e inputs.
- `{colors.surface-subtle}` diferencia hover, agrupamentos e zonas readonly.
- `{colors.ink}` e `{colors.ink-muted}` formam a hierarquia de leitura.
- `{colors.primary}` identifica ação/seleção; não significa sucesso.
- Info, success, warning e danger possuem fundo soft correspondente e sempre são acompanhados de texto ou ícone.

Prioridade Eisenhower preserva o padrão operacional vigente: U+I usa `{colors.priority-ui}`, U usa `{colors.priority-u}`, I usa `{colors.priority-i}` e nenhuma prioridade omite o chip. Status de tarefa não depende dessa taxonomia: cada estado conserva nome e ícone próprios. Cor nunca é o único canal.

As categorias permanecem visíveis por uma borda esquerda de 3px na Task Row: teal, purple, pink, yellow, green e blue usam `{colors.category-*}`. A cor identifica categoria, nunca status ou Eisenhower; tarefa sem categoria usa `{colors.border}` para preservar alinhamento.

Tema escuro não é requisito desta primeira fundação. Sua inclusão exige tokens completos e validação de todos os estados; não se usa inversão automática.

## Typography

Inter é a única família operacional. A escala curta reduz ruído e funciona em listas densas. `page-title` aparece uma vez por superfície; `section-title` estrutura regiões; `body` é o padrão; `meta` nunca carrega informação essencial sozinho.

Não usar display fonts, manuscritas, uppercase longo ou quatro pesos na mesma região. Números de datas, contagens e duração usam variantes tabulares quando disponíveis.

## Layout & Spacing

A escala é de 4px. Wide usa sidebar e workspace de até 1440px; leitura e formulários ficam em até 800px. Gutter wide é 32px, medium 24px e compact 16px.

| Viewport | Composição |
|---|---|
| ≥1440px | sidebar expandida; regiões principal/secundária quando agregam decisão |
| 1024–1439px | sidebar expandida ou colapsada; grid reduz colunas antes de comprimir conteúdo |
| 768–1023px | sidebar colapsada; contexto lateral desce abaixo da superfície principal |
| <768px | top bar + navegação compacta; uma coluna; sheets ou telas próprias |

Weekly usa múltiplas faixas para preservar a Task Row: Seg–Qua na primeira; Qui–Sex e fim de semana compacto na segunda; **Sem dia definido** ocupa uma coluna lateral contínua. Cada painel diário possui scroll interno. No compact, o Weekly mostra um dia por vez com seletor, sem scroll horizontal da página.

Monthly usa calendário segunda→domingo de até seis linhas e mostra todos os dias do mês, inclusive vazios. Em wide, o calendário ocupa a região principal e **Sem dia definido** fica numa coluna lateral contínua conforme `{components.monthly-board.*}`. Em cada célula, as tarefas aparecem diretamente em anatomia compacta; overflow usa scroll interno. Em compact, a grade vira escolha de data e a lista completa de um dia por vez, sem scroll horizontal da página.

## Elevation & Depth

Hierarquia vem de tom, borda e posição. Panels usam borda de 1px; sombras não estruturam páginas. Dialogs e sheets podem usar uma sombra ambiente mínima apenas para separar uma camada transitória. O backdrop usa `{colors.overlay}`.

## Shapes

Raios de 2–8px comunicam ferramenta, não aplicativo lifestyle. Pills ficam restritos a presença/contagem muito curta; status e prioridade usam `{rounded.sm}` para conservar leitura de etiqueta. FAB circular não é linguagem obrigatória: captura persistente deve seguir a composição do shell.

## Components

### App Shell

Sidebar, top bar e workspace. O destino ativo combina indicador lateral, peso do label e estado selecionado. Badges não deslocam labels. O shell não expõe seletor Legado/Moderno. A estrutura responsiva está aprovada; a escolha final dos ícones de cada destino permanece um acabamento do catálogo semântico, anterior ao gate de implementação. Glyphs presentes nos mockups não constituem essa escolha.

### Access Surface

Login e Signup usam o padrão **Limiar do workspace**: formulário operacional em primeiro plano e silhueta abstrata da área autenticada como profundidade contextual. A silhueta usa somente `{colors.surface-subtle}`, `{colors.border}` e opacidade reduzida; não reproduz conteúdo real, não aceita interação e fica oculta de tecnologias assistivas. Em compact, torna-se fundo recortado enquanto o formulário ocupa a ordem principal.

### Page/Period Header

Título, contexto temporal, anterior/próximo, ação Atual/Hoje, status do ciclo e ações contextuais. Em compact, título e stepper ficam na primeira linha; ações secundárias entram em menu.

### Workspace Surface

Região principal obrigatória; região secundária apenas quando oferece contexto necessário à decisão atual. Pode ser `focus`, `planner`, `ritual`, `collection`, `history` ou `settings`.

### Weekly Board

O desktop segue `{components.weekly-board.*}`: cinco dias úteis preservam a largura integral da Task Row, sábado e domingo recebem painéis compactos e o pool **Sem dia definido** permanece visível na lateral. Cada painel tem header, contagem, lista com scroll próprio e criação contextual. A superfície não usa sete colunas estreitas.

Estados terminais continuam visíveis com `{components.weekly-board.terminal-opacity}`; filtros podem removê-los por completo. Menor ênfase não reduz contraste de texto essencial nem apaga a seta navegável de migração. Totais por status são controles de filtro com estado textual e foco visível.

### Weekly Planning Workspace

O ritual é visualmente separado da grade. Desktop usa rail de fontes à esquerda, lista de decisões no centro e rail sticky de contexto à direita conforme `{components.weekly-planning.*}`. O rail direito reúne densidade real, totais, progresso, avisos e ações do ciclo. Densidade mostra somente registros já materializados no Weekly e segmenta status sem depender apenas de cor.

No mobile, a densidade permanece no topo; a fonte ativa ocupa toda a largura e o índice de fontes abre em sheet. O seletor de destino também usa sheet, com os sete dias, **Sem dia definido**, contagem de densidade e lembrete discreto de atalhos.

→ Referência aprovada: [`mockups/key-weekly.html`](mockups/key-weekly.html). Este spine vence em qualquer conflito.

### Monthly Board

O desktop segue `{components.monthly-board.*}`: calendário completo de sete colunas, começando na segunda-feira, com até seis linhas e células vazias preservadas. Cada célula mostra número/data, contagem textual e Task Rows compactas com categoria, estado, Eisenhower e título; não substitui títulos por pontos, contagens ou “+ N”. Quando o conteúdo excede a célula, a lista interna rola sem alterar a altura da grade e só captura a rolagem depois de receber interação explícita.

O número/cabeçalho do dia e cada Task Row são alvos separados. Today usa contorno `{colors.info}`; seleção usa contorno `{colors.primary}` e `{colors.primary-soft}`. Dias fora do mês usam `{colors.surface-subtle}` e `{colors.ink-disabled}`. Estados terminais permanecem legíveis com `{components.monthly-board.terminal-opacity}`; filtros podem ocultá-los por completo. **Sem dia definido** usa Task Rows integrais e scroll próprio em coluna continuamente acessível.

Em compact, a data selecionada aparece no header, um seletor semanal curto mantém anterior/próximo e uma escolha de data expõe todos os dias do mês. A Task Row volta à anatomia completa abaixo do seletor; **Sem dia definido** permanece como destino/lista equivalente e não fica escondido ao final de uma página longa.

### Monthly Planning Workspace

O ritual reutiliza a hierarquia do Weekly com delta mensal conforme `{components.monthly-planning.*}`: rail de três fontes à esquerda, decisões no centro e rail sticky à direita. O contexto mostra minicalendário completo, total e distribuição por status em cada dia, faixa **Sem dia definido**, totais, progresso, avisos e ações do ciclo. Segmentos de status sempre recebem legenda e contagens textuais; seleção/destino usa borda e fundo, nunca cor isolada.

No mobile, densidade permanece no topo, a fonte ativa ocupa toda a largura e o índice de fontes abre em sheet. O seletor de destino combina calendário navegável, entrada direta do número do dia e a opção explícita **Sem dia definido**; a ação primária nomeia o destino completo.

→ Referência aprovada: [`mockups/key-monthly.html`](mockups/key-monthly.html). Os spines vencem em qualquer conflito com este mockup.

### Future Log

Superfície híbrida conforme `{components.future-board.*}`: trilho à esquerda com o horizonte rolante de oito meses — cada mês uma linha com nome e contagem, o selecionado com indicador lateral `{colors.primary}` e `{colors.primary-soft}`, meses vazios em `{colors.ink-disabled}` sem desaparecer — e coluna de foco à direita com Task Rows integrais. A captura fica no header, no padrão do campo de item. **Ir para mês…** é um controle ao pé do trilho que abre um seletor de meses distantes com itens, agrupados por ano e com contagem; sem itens além do horizonte, o seletor mostra estado vazio orientando à captura por data.

Item datado usa prefixo `(14)`; item só com mês usa `— ago`, ambos em `{typography.meta}` com números tabulares. Datear/mover reutiliza o seletor de destino do ritual — dias do mês, **Sem dia definido** e outro mês — confirmando com destino nomeado; a origem fica terminal com `{components.future-board.terminal-opacity}` e seta navegável ao sucessor, que entra com contorno `{colors.info}` e `{colors.info-soft}` temporários. A seção **Anuais pendentes** usa o padrão de placement; vazia, não renderiza. No compact, o trilho vira barra de meses rolável e os seletores abrem em sheet.

→ Referência aprovada: [`mockups/key-future-log.html`](mockups/key-future-log.html). Os spines vencem em qualquer conflito com este mockup.

### Recorrentes (Coleção)

Superfície de coleção — não planner — em `/planner/recurring`: a biblioteca de templates. Agrupa por abas **Semanal / Mensal / Anual** (uma por `recurrence_group`) com contagem, mais o filtro **Mostrar inativos**. Cada linha é a **variante Item Row**: borda de categoria, título, subline `{grupo} — {recurrence_text}`, descrição opcional e chip Eisenhower — **sem ícone de status**, porque template não tem estado. Inativo entra com menor ênfase e chip textual, visível só com o filtro.

Criar e editar usam o **mesmo card do detalhe de tarefa** (drawer no desktop, sheet no compact; header, corpo e footer; Categoria e Prioridade no par), com paridade entre criar e editar. O **Grupo** é um segmented editável na criação (herda a aba) e **readonly** na edição. **Recorrência** é texto livre exibido como lembrete, nunca interpretado. O footer traz **Salvar**, **Ativar/Desativar** e **Excluir**: Excluir é um Icon Button de lixeira de menor ênfase, presente só na edição, com dialog de confirmação — é **soft delete** (o registro persiste para preservar a linhagem das tarefas já alocadas). Desativar é reversível e prospectivo; excluir some da biblioteca sem apagar o histórico.

**Alocar** — criar a instância real a partir do template — não vive aqui: é decisão de planejamento e acontece nas fontes **Recorrentes** dos rituais Semana/Mês e nos anuais do Future Log. Esta superfície apenas alimenta essas fontes. O termo padrão do ato é **Alocar** (não "Definir placement").

→ Referência aprovada: [`mockups/key-recorrentes.html`](mockups/key-recorrentes.html). Os spines vencem em qualquer conflito com este mockup.

### Migração / Catch-Up (Ritual)

Superfície contextual acionada por uma **faixa discreta** no Hoje ("N tarefas precisam de decisão", com a contagem por fonte). Não é destino permanente de navegação nem camada modal: reusa a estrutura do **ritual de planejamento** dentro do shell — rail de fontes à esquerda, lista de decisões no centro, rail de contexto à direita.

As **fontes** são os níveis **Meses → Semanas → Dias** (ordem fixa; "ontem" é o nível dia). O rail de contexto substitui o calendário-alvo do planejamento por **progresso, o que já foi decidido e o que resta por fonte** — migração não tem destino único. Cada linha traz origem/linhagem e as ações **Migrar para hoje** (destaque, em toda fonte), **Escolher destino…** e **Cancelar**; não há "Concluir". O seletor de destino é o mesmo dos rituais, com as abas **Esta semana** · **Dia no mês** · **Outro mês** e os atalhos **Hoje** / **Sem dia**. Pausar sai sem perder decisões (persistidas por item); retomar reabre com os itens restantes. Ao decidir tudo, um **resumo** factual antecede a volta ao Hoje.

→ Referência aprovada: [`mockups/key-migracao.html`](mockups/key-migracao.html). Os spines vencem em qualquer conflito com este mockup.

### Task/Item Row

O cluster leading reúne borda de categoria, ícone de status e Eisenhower. Título, descrição e indicação de subtarefas ocupam o centro. O indicador numérico de ordem fica no trailing; a alça de drag, quando disponível, fica junto dele sem substituir a alternativa por teclado/comando. A linha secundária mostra apenas descrição e, quando aplicável, quantidade/expansão de subtarefas — não repete origem, horário ou status. Hover pode revelar atalhos, mas foco e touch têm equivalentes.

O vocabulário de ícones vigente é preservado: círculo vazio = pendente; ampulheta = iniciada; `TaskAlt` = concluída; `Cancel` = cancelada; seta simples = migrada; seta dupla = adiada. Migrada, adiada e cancelada são readonly no contexto de origem. Eisenhower aparece como chip compacto U+I vermelho, U laranja ou I amarelo; `none` não renderiza chip.

Na origem migrada, a seta simples é um controle navegável para o sucessor imediato. O destino entra na viewport com contorno `{colors.info}` e fundo `{colors.info-soft}` temporários; o tratamento mantém forma/texto e não depende somente de cor. Reduced motion remove deslocamento animado sem remover posicionamento ou destaque.

No detalhe, Categoria é um radio group visual: **Sem categoria** + seis swatches **preenchidos** com `{colors.category-*}`, sem dropdown ou nome visível; a seleção usa um **anel** `{colors.primary}`, não checkmark. Eisenhower usa duas caixas semanticamente checkboxes, `U` e `I`, com sublabel opcional (*urgente* / *importante*): desmarcadas são neutras e marcadas recebem **preenchimento suave** e cor correspondentes a `{colors.priority-u}` / `{colors.priority-i}`, nunca dependendo só da cor. Ambas marcadas geram U+I, uma marcada gera U ou I e ambas desmarcadas geram nenhuma prioridade. Esse é o tratamento canônico dos dois controles (padrão fixado na M09) e vale para toda superfície com detalhe — tarefa e template recorrente.

No footer do detalhe, Salvar é primário. Cancelar tarefa é um botão danger contornado e possui mais destaque que Excluir. Excluir usa somente Icon Button de lixeira em `{colors.ink-muted}`, adjacente ao cancelamento, com tooltip e nome acessível; hover/foco pode assumir `{colors.danger}`, mas o repouso permanece secundário. Mover é ação neutra separada.

### Pictogramas de domínio

Phosphor é o vocabulário preferencial para identificar entidades e registros de Hábitos, Saúde e outros domínios em que um pictograma melhora reconhecimento. Usa `{components.domain-icon.weight}`, `{components.domain-icon.size-compact}` ou `{components.domain-icon.size-default}` e `currentColor`; a variante padrão é monocromática, sem duotone, fill decorativo ou cor própria por ícone.

O pictograma identifica o assunto, não comunica conclusão, severidade, seleção ou disponibilidade. Esses estados continuam nos controles e padrões específicos. A seleção oferecida ao usuário deve ser curada, nomeada semanticamente e consistente entre cadastro, Hoje, grids e histórico. Emoji não é o padrão visual novo, mas permanece como fallback durante a migração de dados.

Fronteira do sistema:

- Phosphor: identidade de hábito, métrica de saúde e outros conceitos de domínio aprovados.
- MUI: controles, navegação e ações funcionais já existentes.
- Vocabulário vigente de tarefas: estados de pending, started, completed, cancelled, migrated e postponed.
- Não misturar bibliotecas para o mesmo significado nem escolher ícones apenas por semelhança visual.

### Panel e Section Header

Panel contém uma função; section header contém label, contagem/progresso e ações. Não aninhar card dentro de card para criar hierarquia.

### Status, Priority e Origin Chips

Taxonomias separadas. Todo chip tem texto, nome acessível e, quando necessário, ícone. Overflow vira resumo “+N”, nunca fila de pills ilegíveis.

### Date/Range Controls

Stepper anterior/atual/próximo com seletor acessível. Datas usam locale pt-BR e nome completo em accessible name.

### Data Grid e Calendar

Headers persistentes, célula com estados nomeados, foco navegável e alternativa de lista. Today, selected, missing, N/A e closed são visualmente distintos sem depender apenas de preenchimento.

### Dialog, Sheet e Ritual

Dialog para decisão curta; sheet para detalhe/captura compacta e escolha de destino. Migração/Catch-Up **não** usa camada modal própria nem tela cheia: reusa o **ritual** (fontes + decisões + contexto) dentro do workspace, como o planejamento semanal/mensal. Apenas uma camada modal por vez. Ações destrutivas ficam separadas e nomeiam a consequência. Migração, adiamento e alocação confirmam no próprio seletor com destino explícito; cancelamento e finalização irreversível usam dialog.

### Feedback

Skeleton preserva geometria. Empty ocupa o lugar do conteúdo. Error fica junto ao dado e oferece retry. Disabled mantém rótulo legível e explica o motivo. Readonly/closed remove mutações sem apagar hierarquia.

## Do's and Don'ts

| Faça | Não faça |
|---|---|
| Componha páginas por função e período | Transforme toda página em dashboard de cards |
| Use uma região principal inequívoca | Dê o mesmo peso a trabalho, KPIs e atalhos |
| Reordene regiões no mobile | Comprima o grid desktop ou imponha scroll horizontal |
| Use status com texto/forma/cor | Use cor como único significado |
| Preserve densidade com ritmo de 4px | Reduza texto essencial abaixo de 14px |
| Use MUI como infraestrutura | Reproduza aparência Material genérica |
| Use Phosphor monocromático para pictogramas de domínio | Substitua ícones funcionais e estados de tarefa indiscriminadamente |
| Use o handoff para composição | Copie CSS, fontes, SVGs ou funcionalidades do handoff |
| Trate ciclo fechado como legível e readonly | Aplique aparência disabled a todo o arquivo |
