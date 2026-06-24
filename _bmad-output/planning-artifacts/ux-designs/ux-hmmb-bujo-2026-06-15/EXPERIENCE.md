---
title: "BuJo Digital — EXPERIENCE.md"
status: final
created: 2026-06-15
updated: 2026-06-15
sources:
  - prd: "_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md"
  - decision-log: ".decision-log.md"
  - design: "DESIGN.md"
---

# BuJo Digital — Experience Document

> Documento de experiência de usuário. Define comportamento, fluxos, componentes e estados. Especificações visuais (cores, tipografia, espaçamento) ficam em `DESIGN.md`. Mockups ficam em `mockups/` (a produzir na fase Finalize).

---

## 1. Fundação

### 1.1 Plataforma e escopo

Aplicação web responsiva com suporte a múltiplas superfícies. UI implementada com Material UI (MUI) com theming agressivo: zero elevation padrão, sem ripple, border-radius mínimo, superfícies planas. Visual definido em `DESIGN.md`.

**Breakpoints operacionais:**

| Breakpoint | Faixa | Navegação | Comportamento |
|---|---|---|---|
| Desktop | ≥ 1024px | Sidebar fixa com labels | Layout completo; Weekly Log 7 colunas visíveis |
| Tablet | 768–1023px (`md`) | Sidebar colapsada para ícones | Conteúdo em coluna única |
| Mobile | < 768px (`sm`) | Bottom nav 4 abas + FAB | Sidebar oculta; todas as ações do fluxo diário sem scroll horizontal |

### 1.2 Autenticação e multi-tenancy

- Autenticação via email/senha com sessão persistente (PRD FR-0.2).
- Dados de cada usuário completamente isolados — nenhum dado cruza entre usuários em nenhuma circunstância (PRD FR-0.1, NFR-3).
- Suporte a múltiplos usuários desde o primeiro deploy (PRD FR-0.4). Gestão de usuários (convites, onboarding) é fase posterior (FR-6, backlog).
- Dois ambientes completamente separados: dev e prod (PRD FR-0.3, NFR-5).

### 1.3 Modos de cor

Ambos os modos — claro e escuro — são suportados via `palette.mode` do MUI. O usuário controla a preferência em Configurações. Valores de cor definidos em `DESIGN.md`.

---

## 2. Arquitetura de Informação

### 2.1 Tabela de superfícies

| Superfície | Acessada a partir de | Propósito |
|---|---|---|
| Login / Auth | URL raiz (sessão ausente ou expirada) | Autenticação via email/senha |
| Hoje / Daily Log | Abertura do app; sidebar item "Hoje"; bottom nav aba "Hoje" | Log diário de tarefas, hábitos e saúde; ponto de entrada de todas as jornadas matinais |
| Weekly Log (Esta Semana) | Sidebar grupo Planner > Esta Semana; bottom nav aba "Planner" | Visão semanal de tarefas; fechamento e migração de semanas |
| Monthly Log (Este Mês) | Sidebar grupo Planner > Este Mês; bottom nav aba "Planner" | Visão mensal com tarefas atribuídas a datas; abertura e fechamento de meses |
| Future Log (Futuro) | Sidebar grupo Planner > Futuro; bottom nav aba "Planner" | Itens com data futura completa ou parcial (só mês) |
| Hábitos | Sidebar item "Hábitos"; bottom nav aba "Hábitos" | Tracker de hábitos do dia; histórico consultável por data |
| Saúde / Métricas | Sidebar grupo Saúde > Métricas; bottom nav aba "Saúde" | Log diário de métricas de saúde dinâmicas; tabela, gráficos e dashboard |
| Medicamentos | Sidebar grupo Saúde > Medicamentos; bottom nav aba "Saúde" | Confirmação de medicamentos por bloco de horário; histórico |
| Gratidão | Sidebar item "Gratidão"; link contextual na superfície Hoje (mobile); link no Daily Log de ontem durante ritual matinal | Entradas de texto livre por data; histórico navegável por data e mês |
| Brain Dump | Sidebar item "Brain Dump" (com badge numérico); FAB (mobile, sempre visível) | Caixa de entrada sem data; itens aguardam processamento manual |
| Arquivo | Sidebar item "Arquivo" | Semanas e meses fechados consultáveis com estado final de cada tarefa |
| Configurações | Sidebar item "Configurações" (abaixo do separador) | Preferências do sistema; sub-seções listadas abaixo |
| Configurações > Hábitos | Via Configurações | Criação, edição, ativação/desativação de hábitos e grupos (FR-2, UJ-8) |
| Configurações > Métricas de Saúde | Via Configurações | Criação e gestão de campos dinâmicos de saúde (FR-3.1) |
| Configurações > Medicamentos | Via Configurações | Cadastro de medicamentos com nome, dose e blocos de horário (FR-3.4) |
| Configurações > Recorrentes | Via Configurações | Templates de tarefas recorrentes: semanais, mensais e anuais (FR-1.11) |
| Fluxo de Migração | Acionado pelo sistema durante abertura do dia, semana ou mês — nunca navegado diretamente | Modal overlay que apresenta tarefas pendentes uma a uma para decisão explícita do usuário |

→ Referência de composição: [`mockups/key-daily-log-desktop.html`](mockups/key-daily-log-desktop.html) (Daily Log desktop — sidebar, task rows, habit widget, banner de migração), [`mockups/key-migration-modal-desktop.html`](mockups/key-migration-modal-desktop.html) (Migration Flow modal), [`mockups/key-fab-capture-mobile.html`](mockups/key-fab-capture-mobile.html) (FAB + Capture Sheet mobile). Spines vencem em caso de conflito com os mockups.

### 2.2 Navegação desktop — sidebar

```
[ícone] Hoje
[ícone] ▸ Planner
         Esta Semana
         Este Mês
         Futuro
[ícone] Hábitos
[ícone] ▸ Saúde
         Métricas
         Medicamentos
[ícone] Gratidão
[ícone] Brain Dump  [badge: N]
[ícone] Arquivo
──────────────────
[ícone] Configurações
```

- Grupos colapsáveis (Planner, Saúde): clique no item pai expande/colapsa os filhos.
- Sidebar colapsada (breakpoint `md` ou toggle manual): exibe apenas ícones; labels ocultadas. Badge permanece visível no ícone do Brain Dump.
- Toggle de colapso: disponível via botão discreto no topo da sidebar e via atalho de teclado (ver seção Interação).
- Item ativo destacado em `brand-primary` (cor definida em `DESIGN.md`).

### 2.3 Navegação mobile — bottom nav + FAB

```
[Hoje]   [Planner]   [Hábitos]   [Saúde]
                 [FAB]
```

- FAB: sempre visível, sobreposto ao conteúdo. Badge numérico quando há itens no Brain Dump (PRD FR-5.4).
- Gratidão: não tem aba dedicada no mobile. Acessada via link contextual na superfície Hoje (integrada ao ritual matinal — UJ-1 passo 3). Também acessível via Arquivo quando necessário para consulta histórica.
- Brain Dump: FAB abre o capture sheet diretamente. Superfície completa acessível via Configurações não — não há rota direta no mobile além do FAB.
- Modal: empilhamento máximo de um nível. Nenhum modal abre outro modal.

---

## 3. Voz e Tom

### 3.1 Princípios

Português brasileiro. Direto e funcional — o app fala como o caderno, sem palavras desnecessárias. Zero gamificação, zero contagem de sequências, zero exclamações em mensagens do sistema.

### 3.2 Tabela de exemplos

| Faça | Evite |
|---|---|
| "Sem tarefas pendentes para migrar." | "Ótimo! Você zerou o dia de ontem! 🎉" |
| "Tarefa migrada para hoje." | "Tarefa movida com sucesso ✓" |
| "3 itens no Brain Dump." | "Você tem 3 itens esperando por você!" |
| "Semana fechada." | "Semana concluída! Você arrasou!" |
| "Sessão expirada. Entre novamente." | "Ops! Sua sessão expirou. Faça login para continuar!" |
| "Hábito desativado." | "Hábito arquivado com sucesso!" |
| "Nenhuma entrada de gratidão para esta data." | "Que tal registrar algo pelo qual você é grato hoje?" |
| "Medicamento confirmado." | "Você tomou seus remédios! Ótimo hábito!" |
| "Mês fechado." | "Parabéns! Você fechou mais um mês!" |

### 3.3 Microcopy — estados vazios

Estados vazios são informativos, não motivacionais:
- Brain Dump vazio: "Brain Dump vazio." (estado normal — PRD FR-5.1)
- Daily Log sem tarefas: "Nenhuma tarefa para hoje. Adicione ou migre do dia anterior."
- Gratidão sem entradas: "Nenhuma entrada para esta data."
- Arquivo vazio: "Nenhuma semana ou mês fechado ainda."

---

## 4. Padrões de Componentes

> Especificações comportamentais. Tokens visuais (cores, dimensões, tipografia) estão em `DESIGN.md`.

### 4.1 Task Row — linha de tarefa

O componente mais crítico do sistema. Aparece em Daily Log, Weekly Log, Monthly Log e Future Log.

**Anatomia (da esquerda para a direita):**
1. **Borda lateral esquerda** — cor semântica da categoria (única decoração de cor por tarefa)
2. **Ícone de status** — clicável, cicla os estados (ver tabela abaixo)
3. **Título da tarefa** — texto principal; tachado quando cancelada
4. **Chip Eisenhower** — opcional, à direita do título; cor + texto abreviado (U+I / U / I / —)
5. **Drag handle** — ícone de alça, extrema direita; visível ao hover (desktop) ou sempre visível (mobile em modo reorder)

**Estados e ícones de status (PRD FR-1.4, FR-1.5):**

| Estado | Ícone MUI | Label aria |
|---|---|---|
| Pendente (•) | `RadioButtonUnchecked` | "Pendente" |
| Iniciada (/) | `HourglassEmpty` | "Em andamento" |
| Concluída (X) | `TaskAlt` | "Concluída" |
| Migrada (>) | `ArrowForward` | "Migrada" |
| Adiada (>>) | `KeyboardDoubleArrowRight` | "Adiada" |
| Rápida (·) | `Bolt` | "Tarefa rápida" |
| Cancelada | `Cancel` + tachado no título | "Cancelada" |

**Ciclo de estados (clique no ícone):**
- Pendente → Iniciada → Concluída → (volta a Pendente se necessário)
- Cancelada: via menu de contexto (não pelo ciclo de clique)
- Migrada / Adiada: aplicados pelo Fluxo de Migração — não alteráveis via ciclo de clique

**Comportamento:**
- Clique no título ou área central: abre painel de detalhe inline (desktop) ou bottom sheet (mobile) com campos: título, descrição, subtarefas, categoria, Eisenhower.
- Hover (desktop): exibe drag handle e ações rápidas (cancelar, mover para log).
- Long-press (mobile, ≥ 500ms): abre menu de contexto com ações: Migrar para hoje / Cancelar / Mover para log.
- Drag-and-drop (desktop): reordenação manual dentro do log (PRD FR-1.6). Drop target exibe linha horizontal indicando posição.
- Reordenação mobile: via long-press → menu → "Mover para..." (posição relativa: acima de / abaixo de). Drag-and-drop não disponível no mobile.
- Acessibilidade: cor da borda lateral NUNCA é o único indicador de categoria — o chip de categoria (se exibido) usa ícone de forma além da cor. Touch target mínimo de 44px de altura no mobile.

**Chip Eisenhower:**

| Prioridade | Cor (ver DESIGN.md) | Label exibida |
|---|---|---|
| Urgente + Importante | Vermelho | U+I |
| Urgente | Laranja | U |
| Importante | Amarelo | I |
| Nenhuma | Verde | — (chip ausente ou mínimo) |

A cor do chip é sempre acompanhada do texto abreviado — cor nunca é indicador único (acessibilidade).

---

→ Composição: [`mockups/key-migration-modal-desktop.html`](mockups/key-migration-modal-desktop.html).

### 4.2 Migration Card — cartão de migração

Componente exclusivo do Fluxo de Migração (modal overlay). Apresentado um por vez, um cartão por tarefa pendente.

**Anatomia:**
- Título da tarefa (destaque, tamanho maior)
- Descrição (se houver) — exibida diretamente, sem necessidade de expandir
- Subtarefas (se houver) — listadas abaixo da descrição
- Indicador de progresso: "N de M tarefas revisadas" (texto, sem barra de progresso animada) — com `aria-live="polite"`
- 4 ações, cada uma em botão individual:
  1. **Migrar para hoje** — move para Daily Log do dia atual
  2. **Adiar no mês** — picker de data dentro do mês corrente → vai para o Monthly Log na data escolhida
  3. **Adiar no Futuro** — picker de mês (e opcionalmente dia) → vai para o Future Log
  4. **Cancelar** — encerra a tarefa sem destino

**Regras críticas:**
- Uma ação = um clique. Nenhuma ação exige um formulário interno ao cartão.
- "Adiar no mês" e "Adiar no Futuro" abrem um picker minimalista (popover ou inline select) — confirmação é automática ao selecionar a data. Sem botão "confirmar" adicional.
- Nenhuma ação é pré-selecionada. O app não sugere nem pré-preenche a decisão.
- Após qualquer ação, o próximo cartão aparece imediatamente (sem animação de transição celebratória).
- Esc no teclado: pausa o fluxo de migração (não cancela). O usuário pode retomar a partir da última tarefa não decidida.
- O fluxo nunca é encerrado pelo sistema. Só Hugo decide quando terminar (pode pausar e voltar depois).
- Teclado: `1` = Migrar para hoje, `2` = Adiar no mês, `3` = Adiar no Futuro, `4` = Cancelar. Atalhos exibidos discretamente abaixo de cada botão.

---

### 4.3 Habit Tracker Row — linha de hábito

Aparece na superfície Hábitos e no widget de hábitos do Daily Log.

**Anatomia:**
1. Emoticon do hábito (decorativo, aria-hidden)
2. Nome do hábito
3. Input de registro:
   - **Booleano:** checkbox — clique marca/desmarca. Estados: desmarcado (pendente), marcado (feito).
   - **Numérico:** campo de número + label da unidade (ex: "passos", "min"). Exibe percentual de meta atingido à direita.
4. Indicador de completude (numérico): barra textual ou percentual — informativo, não celebratório. Ex: "2.500 / 5.000 passos (50%)".

**Agrupamento:** hábitos são exibidos agrupados por grupo do usuário (ex: Profissional, Pessoal, Saúde). Cada grupo tem cabeçalho com nome do grupo e percentual ponderado do grupo.

**Ponderação e completude:** calculada conforme PRD FR-2.4. Percentual total exibido no topo do tracker — sem troféus ou indicadores de sequência.

**Touch target mobile:** linha inteira ≥ 44px de altura. Tap em qualquer ponto da linha ativa o input.

---

### 4.4 Day Header — cabeçalho de dia

Aparece no topo de cada seção de dia no Daily Log e no Weekly Log.

**Anatomia:**
- Data: formato "SEG, 15 JUN" ou "Segunda-feira, 15 de junho"
- Contador de janela de tempo (opcional, reproduz o caderno físico): "Xh (Yh) Zh" — horário de acordar / foco / dormir. Campos editáveis inline por clique.
- Número de tarefas pendentes (texto simples — ex: "3 pendentes")
- Ação de colapso: ícone chevron à direita. Colapsa o bloco de tarefas do dia, mantendo o header visível.

**Estilo:** tom-sobre-tom do background da superfície — sem cor de destaque forte. Sem o azul pastel do caderno físico (decisão de design confirmada no `.decision-log.md`).

**Comportamento:** cabeçalho sempre visível mesmo com bloco colapsado.

---

→ Composição: [`mockups/key-fab-capture-mobile.html`](mockups/key-fab-capture-mobile.html).

### 4.5 FAB — Brain Dump / Captura Rápida

Exclusivo do mobile (< 768px). Sempre visível, sobreposto ao conteúdo.

**Anatomia:**
- Ícone de captura (ex: `AddCircle` ou `FlashOn`)
- Badge numérico quando Brain Dump contém itens (PRD FR-5.4). Badge desaparece quando Brain Dump está vazio.

**Comportamento:**
- Tap: abre o Capture Sheet (bottom sheet a partir da parte inferior da tela).
- Capture Sheet — campos:
  - Título (obrigatório, foco automático ao abrir)
  - Descrição (opcional, textarea)
  - Log de destino (opcional; select: Brain Dump / Hoje / Esta Semana / Este Mês / Futuro — padrão: Brain Dump)
- Envio: botão "Salvar" ou Enter no último campo.
- Após salvar: sheet fecha, badge do FAB atualiza se destino for Brain Dump.
- Esc ou swipe-down: fecha sem salvar. Confirmação de descarte apenas se título foi preenchido.

**Posição:** fixo, canto inferior direito, acima do bottom nav.

---

### 4.6 Sidebar Nav Item

**Anatomia:**
- Ícone MUI à esquerda
- Label textual à direita (oculta quando sidebar colapsada)
- Badge numérico (apenas Brain Dump)
- Indicador de item ativo: cor `brand-primary` no ícone e no texto

**Grupo colapsável (Planner, Saúde):**
- Clique no item pai: expande/colapsa subitens
- Estado colapsado: chevron apontado para direita (→)
- Estado expandido: chevron apontado para baixo (↓)
- Subitens têm indentação visual de 16px

**Sidebar colapsada para ícones:**
- Labels ocultas
- Tooltip com o label aparece ao hover (desktop)
- Badge permanece visível
- Grupos colapsáveis: clique no ícone pai expande a sidebar temporariamente para mostrar subitens

---

### 4.7 Future Log Item

**Anatomia:**
- Marcador de mês (agrupador, ex: "Julho 2026")
- Linha de item: data (completa ou só mês) + título da tarefa + ícone de status (pendente por padrão)

**Comportamento:**
- Data parcial (só mês): exibida como "jul" ou "— jul". Na migração mensal, o dia é preenchido.
- Clique no item: abre detalhe inline com campos completos da tarefa.
- Adição de novo item: botão "+" no cabeçalho do mês ou na área do log. Campos: título (obrigatório), mês (obrigatório), dia (opcional), descrição (opcional).

---

### 4.8 Health Metric Row — linha de métrica de saúde

Aparece na superfície Saúde / Métricas.

**Anatomia:**
- Nome do campo (configurado pelo usuário em FR-3.1)
- Input do tipo correspondente: inteiro / decimal / booleano / enum (select) / texto
- Estado: preenchido / não preenchido

**Comportamento:**
- Campos do dia anterior exibidos no topo com indicação "Ontem, [data]" — parte do ritual matinal (UJ-7).
- Campos do dia atual logo abaixo.
- Campos inativos não aparecem no log ativo (PRD FR-3.2).
- Sem exclusão de campo — apenas desativação.

---

### 4.9 Medication Block — bloco de medicamentos

Aparece na superfície Medicamentos.

**Anatomia:**
- Cabeçalho de bloco: "Manhã", "Tarde" ou "Noite"
- Lista de medicamentos do bloco: nome + dose
- Botão de confirmação de bloco: "Confirmar todos da manhã" (confirma todos os medicamentos do bloco de uma vez — PRD FR-3.6)
- Checkbox individual por medicamento (confirmação unitária)

**Estados:**
- Bloco pendente: todos os itens sem check
- Bloco parcial: alguns confirmados, alguns pendentes
- Bloco confirmado: todos confirmados, cabeçalho com indicador visual (ícone check ao lado do nome do bloco)

**Histórico:** consultável por data — exibe estado final de confirmação de cada medicamento por bloco.

---

## 5. Padrões de Estado

### 5.1 Daily Log

| Estado | Descrição | Indicador visual |
|---|---|---|
| Primeiro acesso do dia — migração pendente | App detecta que há tarefas de ontem sem disposição | Banner informativo no topo do Daily Log: "Você tem N tarefas pendentes de ontem. Iniciar migração?" com botão "Iniciar". Não inicia migração automaticamente. |
| Migração em andamento | Fluxo de Migração ativo (modal overlay) | Modal com Migration Card visível; conteúdo do Daily Log visível atrás (overlay semitransparente) |
| Migração concluída | Todas as tarefas de ontem têm disposição | Banner some. Daily Log exibe as tarefas migradas para hoje na sua ordem manual. |
| Dia limpo — sem tarefas migradas | Hugo optou por não migrar nada | Daily Log vazio com texto de estado vazio (veja seção 3.3) |
| Dia em andamento | Tarefas com vários estados | Log normal; status icons refletem estado atual de cada tarefa |

### 5.2 Weekly Log

| Estado | Descrição | Indicador visual |
|---|---|---|
| Semana aberta | Há tarefas sem disposição | View normal; nenhum indicador especial |
| Semana com migração pendente (segunda-feira) | App detecta semana anterior com tarefas sem disposição | Banner no topo do Weekly Log: "Semana anterior tem N tarefas sem disposição. Revisar?" + botão "Iniciar revisão" |
| Semana fechada | Todas as tarefas têm disposição (FR-1.10) | Cabeçalho da semana exibe indicador "Fechada" (texto, sem ícone celebratório). Semana move para Arquivo. |

### 5.3 Monthly Log

| Estado | Descrição | Indicador visual |
|---|---|---|
| Mês aberto | Mês em curso | View normal |
| Abertura do novo mês — pendências do mês anterior | App detecta mês anterior com itens sem disposição | Banner informativo com contagem. Botão "Revisar mês anterior". |
| Itens do Future Log puxados automaticamente | Items do Future Log do mês corrente disponíveis para revisão | Seção separada no topo do Monthly Log: "Itens do Future Log para este mês" — aguardam confirmação de data pelo usuário |
| Mês fechado | Todas as tarefas do mês têm disposição | Cabeçalho do mês: "Fechado". Mês move para Arquivo. |

### 5.4 Brain Dump

| Estado | Descrição | Indicador visual |
|---|---|---|
| Vazio | Estado normal (PRD FR-5.1) | Texto de estado vazio: "Brain Dump vazio." Sem badge no FAB ou sidebar. |
| Com itens | Itens aguardando processamento | Badge numérico no FAB (mobile) e no item da sidebar (desktop). Lista de itens exibida. |

### 5.5 Hábitos

| Estado | Descrição |
|---|---|
| Não marcado (booleano) | Checkbox vazio — pendente |
| Marcado (booleano) | Checkbox preenchido — feito |
| Abaixo da meta (numérico) | Valor registrado < meta; percentual exibido |
| Meta atingida (numérico) | Valor ≥ meta; indicador textual "Meta atingida" |

### 5.6 Loading e Skeleton

- Skeleton screens para Daily Log, Weekly Log e Monthly Log — blocos de placeholder com proporções reais dos conteúdos esperados.
- Sem spinners globais para operações de escrita (salvar tarefa, marcar hábito): resposta otimista — UI atualiza imediatamente.
- Em caso de erro na escrita: rollback com mensagem de erro inline (ex: "Não foi possível salvar. Tente novamente.").
- Performance: Daily Log e fluxo de migração devem ser percebidos como instantâneos (< 2s em conexão normal — PRD NFR-2).

### 5.7 Auth

| Estado | Comportamento |
|---|---|
| Não autenticado | Redireciona para Login. Nenhuma rota do app é acessível sem sessão. |
| Login com erro | Mensagem inline discreta: "Email ou senha incorretos." Sem detalhes técnicos. |
| Sessão expirada | Banner não-bloqueante: "Sessão expirada. Entre novamente." + botão "Entrar". Formulário de login sobrepõe o conteúdo sem destruir o estado da UI. |
| Autenticado | App abre no Daily Log de hoje (Hoje). |

### 5.8 Conectividade

O MVP não oferece suporte offline. Toda leitura e escrita requer conexão ativa.

| Estado | Comportamento |
|---|---|
| Conexão perdida | Toast não-bloqueante, uma vez: "Sem conexão. Verifique sua rede." Persiste até reconexão. Sem escrita local. |
| Escrita falhou (rede) | Erro inline no componente afetado: "Não foi possível salvar. Tente novamente." Botão de retry visível. UI não faz rollback otimista — aguarda confirmação do servidor antes de atualizar. |
| Reconectado | Toast some. App retoma operação normal sem refresh manual. |
| UJ-4 (mobile em trânsito) | Sem conexão → FAB desabilitado com tooltip "Sem conexão". Capture Sheet não abre. Nenhuma captura é perdida silenciosamente. |

---

## 6. Primitivos de Interação

### 6.1 Desktop (teclado + mouse)

**Atalhos globais:**

| Atalho | Ação |
|---|---|
| `[` | Colapsar / expandir sidebar |
| `N` (global, fora de inputs) | Nova tarefa no contexto atual |
| `B` (global, fora de inputs) | Abrir Brain Dump (captura rápida) |
| `Esc` | Fechar modal / popover / painel de detalhe mais recente |

**Interações por componente:**

- **Reordenação de tarefas:** drag-and-drop dentro do log. Drag handle visível ao hover. Drop target sinalizado por linha horizontal. Sem reordenação automática por algoritmo.
- **Status de tarefa:** clique no ícone de status cicla: Pendente → Iniciada → Concluída. Retorno a Pendente disponível via clique adicional.
- **Fluxo de Migração — teclado:**
  - `1` Migrar para hoje
  - `2` Adiar no mês (abre picker de data; Tab navega no picker; Enter confirma)
  - `3` Adiar no Futuro (abre picker de mês; Tab navega; Enter confirma)
  - `4` Cancelar
  - `Esc` Pausar fluxo (retomável)
  - Setas (↑ ↓) navegam entre ações quando picker não está aberto
- **Navegação no sidebar:** Tab navega pelos itens em ordem visual. Enter ativa o item. Grupos colapsáveis: espaço ou Enter expande/colapsa.
- **Campos de texto:** Tab avança para o próximo campo, Shift+Tab retrocede. Enter em campo de título de nova tarefa salva e abre nova linha.

### 6.2 Mobile (touch)

- **Tap em linha de tarefa:** expande o painel de detalhe inline (ou bottom sheet com campos completos).
- **Tap no ícone de status:** cicla o estado (Pendente → Iniciada → Concluída).
- **Long-press em linha de tarefa (≥ 500ms):** abre menu de contexto com ações: Migrar para hoje / Cancelar / Mover para log / Ver detalhes.
- **FAB tap:** abre Capture Sheet a partir da parte inferior da tela.
- **Bottom nav tap:** troca de superfície principal.
- **Reordenação de tarefas:** não disponível via drag no mobile. Acessível via long-press → "Mover para..." com seleção de posição relativa.
- **Weekly Log no mobile:** exibe um dia por vez, com seletor de dia acima (ex: "Seg | Ter | Qua | Qui | Sex | Sab | Dom" — abas horizontais ou chips). Sem swipe entre dias (conflito com scroll do browser).

### 6.3 Proibido em todas as superfícies

- Migração automática de tarefas sem ação explícita do usuário (PRD counter-métrica — 100% das decisões são do Hugo).
- Drag-and-drop de reordenação no mobile.
- Modal abrindo outro modal (empilhamento máximo = 1 nível).
- Confetti, contadores de sequência, badges de conquista, qualquer UI de gamificação.
- Sugestões de IA para decisões de migração ou priorização.
- Navegação via drawer/hamburger no mobile (bottom nav é o padrão — sem drawer).
- Scroll horizontal como gesto de navegação entre dias ou seções no mobile.

---

## 7. Acessibilidade

### 7.1 Floor de acessibilidade

- WCAG 2.2 AA para todo texto e elementos interativos.
- Cor nunca é o único indicador de estado ou categoria — sempre acompanhada de ícone (forma distinta) ou label textual. Isso se aplica a:
  - Bordas de categoria das tarefas (acompanhadas de chip com texto de categoria)
  - Chips Eisenhower (cor + texto abreviado U+I / U / I)
  - Estados de hábito (cor + ícone de status)
- Touch targets: altura mínima de 44px para todos os elementos interativos no mobile (linhas de tarefa, linhas de hábito, linhas de medicamento, botões de ação).
- Focus ring do MUI preservado — não removido pelo theming. Visível e com contraste adequado.
- Tab order corresponde à ordem de leitura visual.
- Tecla Esc fecha o modal ou popover mais recente em qualquer ponto do app.

### 7.2 Anúncios para screen reader

- Mudança de superfície: `aria-live="polite"` anuncia o nome da nova superfície.
- Progresso na migração: `aria-live="polite"` anuncia "N de M tarefas revisadas" após cada decisão.
- Erros de formulário: `aria-live="assertive"` para mensagens de erro de validação.
- Ação de status de tarefa: o novo estado é anunciado após o clique (ex: "Tarefa marcada como concluída").
- Badge do Brain Dump: `aria-label` atualizado com contagem atual (ex: "Brain Dump: 3 itens pendentes").

### 7.3 Semântica HTML

- Sidebar: `<nav aria-label="Navegação principal">`.
- Bottom nav: `<nav aria-label="Navegação mobile">`.
- Daily Log, Weekly Log, Monthly Log: `<main>` com `aria-label` descritivo.
- Modal de migração: `role="dialog"` com `aria-modal="true"` e `aria-label="Fluxo de migração"`. Foco travado no modal enquanto aberto.
- Botões de status de tarefa: `aria-label` com estado atual e próximo estado (ex: `aria-label="Status: Pendente. Clicar para marcar como Iniciada"`).

---

## 8. Responsividade e Plataforma

### 8.1 Desktop (≥ 1024px)

- Sidebar visível com labels completas.
- Weekly Log: 7 colunas de dias visíveis simultaneamente. Se viewport for menor que o necessário para 7 colunas (ex: janela estreitada), as colunas são comprimidas proporcionalmente — sem scroll horizontal na página; o conteúdo de cada coluna scrolls verticalmente.
- Layouts de dois painéis onde relevante: Daily Log + painel de detalhe de tarefa aberto lateralmente.
- Hover states em todos os elementos interativos.
- Drag-and-drop disponível.

### 8.2 Tablet (768–1023px)

- Sidebar colapsada para ícones automaticamente neste breakpoint.
- Conteúdo em coluna única.
- Weekly Log: condensado — seletor de dia no topo, um dia por vez.
- Touch e mouse suportados simultaneamente.

### 8.3 Mobile (< 768px)

- Sidebar completamente oculta. Bottom nav com 4 abas + FAB.
- Todas as ações do fluxo diário (brain dump, marcação de hábito, saúde, migração) executáveis sem scroll horizontal (PRD NFR-1).
- Weekly Log: seletor de dia horizontal no topo (chips ou abas) + um dia por vez na área principal.
- Monthly Log: lista vertical de datas, sem grid de calendário (colunas muito estreitas no mobile).
- Painel de detalhe de tarefa: bottom sheet, não painel lateral.
- Capture Sheet (FAB): bottom sheet com campos empilhados verticalmente.
- Fluxo de Migração: modal full-screen no mobile (não overlay parcial).

---

## 9. Fluxos Principais

### Fluxo 1 — Abertura do Dia (UJ-1, Hugo, 7h30, segunda-feira)

Hugo acorda, faz café e abre o BuJo Digital no desktop.

1. **App abre no Daily Log de hoje** (segunda-feira, 16 de junho). O sistema detecta que o Daily Log de ontem (domingo) tem 4 tarefas com estado "Pendente" ou "Iniciada" sem disposição.

2. **Banner informativo** aparece no topo do Daily Log: "4 tarefas pendentes de ontem. Iniciar migração?" com botão "Iniciar". Hugo não é obrigado a agir agora — ele pode rolar a página e ver o log.

3. **Ritual de revisão de ontem:** Hugo clica em "Hoje" no sidebar, mas primeiro acessa o Daily Log de **ontem** pelo link no banner ou pelo header de data. Ele revê os hábitos não marcados de ontem, preenche os campos de saúde pendentes e abre o Diário de Gratidão de ontem — adiciona uma entrada de texto livre. O app não interrompe esse fluxo de revisão com popups.

4. **De volta ao Daily Log de hoje:** Hugo clica em "Hoje" na sidebar. Vê o log do dia vazio (ainda sem tarefas migradas). Marca os primeiros hábitos da manhã no widget de hábitos.

5. **É segunda-feira:** o sistema também detecta que o Weekly Log da semana passada tem 3 tarefas sem disposição. Um segundo banner aparece abaixo do primeiro: "Semana anterior tem 3 tarefas sem disposição. Revisar semanalmente?" + botão "Iniciar revisão semanal".

6. **Hugo inicia a revisão semanal primeiro** (ordem natural do BuJo — semana antes do dia). Clica em "Iniciar revisão semanal". O Fluxo de Migração abre como modal overlay. O Migration Card aparece com a primeira tarefa sem disposição da semana anterior.
   - Tarefa: "Finalizar relatório Q2". Hugo decide: clica em "Migrar para hoje". Próximo cartão.
   - Tarefa: "Ligar para seguradora". Hugo decide: clica em "Adiar no mês" → picker de data aparece → seleciona 20/jun → confirma. Próximo cartão.
   - Tarefa: "Pesquisar voos para julho". Hugo decide: clica em "Adiar no Futuro" → picker de mês aparece → seleciona "julho" → confirma. Próximo cartão.
   - `aria-live` anuncia "3 de 3 tarefas revisadas." Modal fecha automaticamente.

7. **Revisão do dia:** Hugo clica em "Iniciar" no banner do Daily Log. Fluxo de Migração abre novamente com as 4 tarefas de ontem.
   - Decide por cada uma em sequência — total de 4 cliques para as 4 tarefas mais 2 seletores de data.
   - Após a última: modal fecha. Banner some.

8. **Today's log agora tem conteúdo:** as tarefas migradas aparecem na lista. Hugo adiciona uma nova tarefa manualmente, define Eisenhower para "Finalizar relatório Q2" como U+I (vermelho) e reordena o list por drag-and-drop colocando ela no topo.

**Clímax:** O Daily Log de hoje está montado — não por algoritmo, mas pelas decisões explícitas de Hugo na última meia hora. Ele não foi forçado a nenhuma escolha e não teve nenhuma tarefa movida sem sua ação. Começa o dia.

---

### Fluxo 2 — Captura Rápida no Mobile (UJ-4, Hugo, no metrô, 11h)

Hugo está no metrô sem acesso ao desktop. Lembrou de uma coisa importante.

1. **Hugo abre o app no celular.** Vê o Daily Log de hoje (bottom nav, aba "Hoje"). O FAB com ícone de captura está visível no canto inferior direito. O badge mostra "2" — há dois itens no Brain Dump de uma captura anterior.

2. **Hugo toca o FAB.** O Capture Sheet sobe a partir da parte inferior da tela. O campo de título já está em foco com o teclado virtual aberto.

3. **Hugo digita:** "Verificar prazo de renovação do seguro". Não preenche descrição. No campo "Destino" (padrão: Brain Dump) não altera nada — vai para o Brain Dump.

4. **Toca "Salvar".** O Capture Sheet fecha. O badge do FAB atualiza para "3".

**Clímax:** A tarefa está no Brain Dump, sem data, sem pressão. Hugo sabe que quando abrir o desktop de manhã vai processar esse item junto com o ritual diário. A captura foi rápida e honesta — foi para o lugar certo, não foi inserida diretamente no Daily Log de um dia que Hugo não pode planejar agora.

---

### Fluxo 3 — Abertura do Mês (UJ-3, Hugo, primeira segunda-feira de julho)

Hugo abre o app na primeira semana de julho. Além da migração diária e semanal (Fluxo 1), o sistema detecta uma condição adicional.

1. **App abre no Daily Log de hoje** (primeira segunda-feira de julho). Além dos banners de migração diária e semanal, um terceiro banner aparece: "Junho tem N tarefas do Monthly Log sem disposição. Revisar mês anterior?"

2. **Hugo inicia a revisão do mês anterior.** Clica em "Revisar junho". O Fluxo de Migração abre com as tarefas do Monthly Log de junho sem disposição, uma a uma.
   - Para cada uma: decide entre Migrar para julho (com data), Adiar no Futuro ou Cancelar.
   - Após todas as decisões: "Junho fechado." Banner some. Junho aparece no Arquivo com status "Fechado".

3. **Itens do Future Log puxados automaticamente.** O sistema puxa os itens do Future Log que tinham destino "julho" para o Monthly Log de julho — com suas datas já definidas (se data completa foi registrada) ou marcadas como "data a definir" (se só mês foi registrado, PRD FR-1.2). Uma seção "Itens do Future Log para julho" aparece no topo do Monthly Log. Hugo revê cada item e confirma — ou ajusta a data para os que vieram sem dia.

4. **Recorrentes mensais.** O app apresenta os recorrentes mensais ativos (PRD FR-1.12) na mesma interface: lista de templates com botão "Definir placement" para cada um. Hugo decide em qual data cada recorrente entra no Monthly Log de julho. Sem auto-placement.

5. **Monthly Log de julho está montado.** Hugo fecha o modal e vê o Monthly Log do novo mês com todas as tarefas no lugar.

**Clímax:** Junho é formalmente passado. Julho começa com conteúdo intencional — tarefas que Hugo julgou válidas para trazer, itens do Future Log que chegou a hora de executar, e recorrentes no lugar certo. Nenhuma tarefa entrou sozinha. O mês começa com o mesmo respeito ao julgamento que o caderno físico sempre exigiu.

---

---

### Fluxo 4 — Future Log (UJ-5, Hugo, desktop, tarde)

Hugo acabou de confirmar uma consulta com endocrinologista para o dia 14 de agosto. Quer registrar antes de esquecer.

1. **Hugo abre o Future Log** via sidebar. Vê a lista de meses futuros com seus itens — agosto está vazio.
2. **Clica em "+" ao lado de Agosto.** Um campo de nova tarefa aparece inline dentro da seção agosto, com foco no campo de título.
3. **Hugo digita:** "(14) Consulta endocrinologista". Não preenche descrição. O prefixo `(14)` indica o dia — campo de data completa selecionado automaticamente.
4. **Pressiona Enter.** Item salvo. Aparece na seção agosto com a data `14/ago` como label.
5. **Hugo nota** que há um item em julho sem dia definido: "Estudar AUVD/Canadá". Clica nele para expandir o detalhe. Adiciona uma nota na descrição e confirma que o dia ainda não está definido — ficará `data a definir` até a migração mensal de julho.

**Clímax:** Hugo fecha o Future Log. Agosto tem seu item. O item de julho segue sem data — e está explicitamente marcado como pendente de definição. Nenhuma pressão, nenhuma data inventada.

---

### Fluxo 5 — Diário de Gratidão (UJ-6, Hugo, manhã, parte do ritual do UJ-1)

Hugo está no ritual matinal. Acabou de revisar o Daily Log de ontem. É hora da gratidão.

1. **Hugo acessa o Diário de Gratidão** via link contextual no topo do Daily Log de ontem (label: "Gratidão de ontem") ou diretamente pelo sidebar item "Gratidão".
2. **A superfície abre no dia de ontem.** Vê que não há nenhuma entrada para ontem — estado vazio: "Nenhuma entrada para esta data."
3. **Clica em "Nova entrada".** Um campo de texto livre abre abaixo, com foco automático. Sem estrutura obrigatória — sem prompts, sem campos rotulados.
4. **Hugo escreve:** "Consegui finalizar o relatório financeiro antes do prazo e ainda sobrou tempo para um jogo de tênis." Clica em "Salvar".
5. **A entrada aparece** listada com hora e data. Hugo decide adicionar uma segunda entrada para hoje, sem precisar mudar de data — clica em "Nova entrada" e o seletor de data mostra "hoje" por padrão. Muda para ontem. Salva.

**Clímax:** Ontem tem duas entradas. O histórico de gratidão está completo — sem pressa, sem estrutura imposta. Hugo fecha o diário e segue para o Daily Log de hoje.

---

### Fluxo 6 — Saúde e Medicamentos (UJ-7, Hugo, manhã revisando o dia anterior)

Hugo está no ritual matinal. Hora de preencher os dados de saúde de ontem e confirmar os remédios da manhã.

1. **Hugo acessa Saúde > Métricas** via sidebar. A superfície abre com o formulário do dia anterior pré-selecionado (comportamento padrão: abre no dia anterior durante o período matinal < 10h).
2. **Preenche os campos de ontem:** peso (88,2), pressão (12×8), horas de sono (7), qualidade do sono (4/5), produtividade manhã (3), tarde (4), noite (2), atividade física (sim — corrida). Campos enum e booleanos como selects e toggles. Campo numérico com teclado numérico no mobile.
3. **Salva.** Confirmação inline discreta: "Dados de ontem salvos."
4. **Acessa Saúde > Medicamentos.** Vê os blocos de horário: Manhã (3 medicamentos) / Tarde (1) / Noite (2). O bloco "Manhã" mostra os 3 medicamentos não confirmados.
5. **Hugo clica em "Confirmar todos — manhã".** Os 3 medicamentos mudam para estado "Confirmado" simultaneamente. Não precisou confirmar um por um.

**Clímax:** Os dados de ontem estão registrados. Os remédios da manhã estão confirmados. Hugo não precisou de 3 telas diferentes — tudo em Saúde, dois sub-itens, dois minutos.

---

### Fluxo 7 — Configuração de Hábitos (UJ-8, Hugo, ajustando o sistema)

Hugo decidiu que vai rastrear "Leitura" como hábito — mas de forma numérica (minutos lidos), não booleana. E quer aumentar o peso de "Exercício".

1. **Hugo acessa Configurações > Hábitos.** Vê a lista de hábitos ativos agrupados por grupo.
2. **Clica em "+ Novo hábito".** Um formulário aparece inline:
   - Nome: "Leitura"
   - Emoticon: 📚 (seletor de emoji)
   - Grupo: "Pessoal" (dropdown com os grupos existentes)
   - Tipo: Numérico (toggle Booleano / Numérico)
   - *Campos adicionais aparecem após selecionar Numérico:* Meta: 30 (minutos), Bonus de completude: 20%
   - Peso inicial: 2
3. **Hugo salva.** "Leitura" aparece no grupo Pessoal, ativo a partir de hoje.
4. **Hugo encontra "Exercício" na lista.** Clica no peso atual (3) para editar. Campo inline: altera para 4. Salva. Tooltip discreta: "Alteração válida a partir de hoje. Registros anteriores preservados."

**Clímax:** O sistema de hábitos foi ajustado sem drama. "Leitura" vai aparecer no Daily Log de amanhã. O peso de "Exercício" foi aumentado — e Hugo sabe que o histórico de ontem não foi alterado. O sistema é honesto com o passado.

---

## 10. Rastreamento de Cobertura de Requisitos

### FR por superfície

| FR | Descrição resumida | Superfície / Componente |
|---|---|---|
| FR-0.1 | Isolamento de dados por usuário | Fundação (infraestrutura — sem superfície específica) |
| FR-0.2 | Auth email/senha + sessão persistente | Login / Auth |
| FR-0.3 | Ambientes dev e prod separados | Fundação (infraestrutura) |
| FR-0.4 | Multi-usuário desde o início | Fundação (infraestrutura) |
| FR-1.1 | Quatro tipos de log | Hoje, Weekly Log, Monthly Log, Future Log |
| FR-1.2 | Future Log com data parcial (só mês) | Future Log + Fluxo de Migração (abertura do mês) |
| FR-1.3 | Campos de tarefa (título, descrição, subtarefas, Eisenhower) | Task Row + painel de detalhe inline / bottom sheet |
| FR-1.4 | Estados de tarefa | Task Row — ícone de status com ciclo de estados |
| FR-1.5 | / e \ formando X visual | Task Row — HourglassEmpty → TaskAlt |
| FR-1.6 | Ordenação manual de tarefas | Task Row — drag handle (desktop) + long-press menu (mobile) |
| FR-1.7 | Motor de migração diário | Fluxo de Migração — Migration Card |
| FR-1.8 | Motor de migração semanal | Fluxo de Migração — Migration Card (acionado na segunda-feira) |
| FR-1.9 | Motor de migração mensal + pull do Future Log | Fluxo de Migração + seção "Itens do Future Log" no Monthly Log |
| FR-1.10 | Semana fechada quando todas as tarefas têm disposição | Weekly Log — estado "Semana fechada" + Arquivo |
| FR-1.11 | Templates de tarefas recorrentes | Configurações > Recorrentes |
| FR-1.12 | Placement manual de recorrentes (sem auto-placement) | Fluxo de Migração — lista de recorrentes com "Definir placement" |
| FR-1.13 | Arquivo de semanas e meses fechados | Arquivo |
| FR-2.1 | Hábitos em grupos | Habit Tracker Row — agrupamento com cabeçalho de grupo |
| FR-2.2 | Criação de hábito (nome, emoji, grupo, peso, tipo) | Configurações > Hábitos |
| FR-2.3 | Hábitos numéricos com meta e bonus | Configurações > Hábitos + Habit Tracker Row (percentual) |
| FR-2.4 | Percentual de completude ponderado | Habit Tracker Row — exibição de percentual total e por grupo |
| FR-2.5 | Alteração de peso a partir do dia corrente | Configurações > Hábitos |
| FR-2.6 | Log diário de hábitos como snapshot imutável | Hábitos — histórico por data (NFR-4) |
| FR-2.7 | Desativação sem deleção de hábitos | Configurações > Hábitos — toggle ativo/inativo |
| FR-2.8 | Reativação de hábitos | Configurações > Hábitos — toggle ativo/inativo |
| FR-2.9 | Histórico de hábitos por data | Hábitos — seletor de data para consulta histórica |
| FR-3.1 | Métricas de saúde como campos dinâmicos | Configurações > Métricas de Saúde + Saúde / Métricas |
| FR-3.2 | Log diário de saúde (majoritariamente de manhã) | Saúde / Métricas — campos do dia anterior no topo |
| FR-3.3 | Três visualizações do histórico de saúde | Saúde / Métricas — abas ou seletor: Tabela / Gráficos / Dashboard |
| FR-3.4 | Medicamentos com nome, dose e blocos | Configurações > Medicamentos + Medicamentos |
| FR-3.5 | Medicamento em múltiplos blocos | Configurações > Medicamentos |
| FR-3.6 | Confirmação por bloco ou individual | Medication Block — botão de bloco + checkboxes individuais |
| FR-3.7 | Medicamentos com ativo/inativo e histórico preservado | Configurações > Medicamentos — toggle ativo/inativo |
| FR-4.1 | Entradas livres por dia, sem estrutura obrigatória | Gratidão — editor de texto livre |
| FR-4.2 | Histórico navegável por data e mês | Gratidão — seletor de data e navegação por mês |
| FR-4.3 | [BACKLOG] Resumo mensal por IA | Fora do escopo — não especificado neste documento |
| FR-5.1 | Brain Dump sem data, estado normal = vazio | Brain Dump — estado vazio com texto informativo |
| FR-5.2 | Item com título obrigatório, descrição e destino opcionais | FAB → Capture Sheet + Brain Dump — formulário de item |
| FR-5.3 | Processamento manual de itens do Brain Dump | Brain Dump — lista com ações manuais por item (mover / descartar) |
| FR-5.4 | Indicador visual persistente quando Brain Dump tem itens | Badge numérico no FAB (mobile) e no item da sidebar (desktop) |
| FR-6.x | [BACKLOG] Gestão de usuários | Fora do escopo do MVP — não especificado neste documento |

### NFR por componente / padrão

| NFR | Atendimento |
|---|---|
| NFR-1 — Mobile real | Todos os fluxos diários executáveis sem scroll horizontal; Weekly Log com seletor de dia; Capture Sheet vertical |
| NFR-2 — Performance | Resposta otimista em operações de escrita; skeleton screens; meta < 2s documentada |
| NFR-3 — Isolamento de dados | Fundação (infraestrutura) |
| NFR-4 — Integridade do histórico | Logs passados imutáveis; hábitos usam snapshot do dia; alterações de peso prospectivas |
| NFR-5 — Ambientes separados | Fundação (infraestrutura) |
| NFR-6 — Disponibilidade | Fundação (infraestrutura / deploy) |

### FRs sem superfície de UI dedicada (infraestrutura pura)

- FR-0.1, FR-0.3, FR-0.4: isolamento e ambientes — implementados na camada de dados e auth, sem superfície específica.
- FR-4.3, FR-6.x: backlog — explicitamente fora do escopo do MVP.

---

## 11. Inspirações e Anti-padrões

### O que o BuJo Digital herda do caderno físico

- **Sistema de cores semânticas como informação pura:** as bordas coloridas nas tarefas não são decoração — são classificação imediata sem precisar ler o texto.
- **Ordenação manual como disciplina:** Hugo decide a ordem das tarefas, não um algoritmo de "impacto" ou "urgência". A ordem é uma declaração de intenção.
- **Migração como ritual:** cada tarefa pendente enfrenta um julgamento. Nada se move sozinho. O atrito do BuJo analógico (reescrever a tarefa no novo dia) é substituído por um clique explícito — a fricção permanece, a mão que dói vai embora.

### O que o BuJo Digital herda do Linear

- Disciplina de teclado no fluxo de migração — atalhos numéricos por decisão.
- Linguagem de estado concisa e sem ruído.

### O que o BuJo Digital rejeita

| Anti-padrão | Motivo |
|---|---|
| Migração automática de tarefas | A counter-métrica do PRD é absoluta. 100% das decisões de migração requerem ação explícita. |
| Streak counters e gamificação | BuJo é um sistema de julgamento, não de recompensa. O percentual de completude de hábitos é informação, não troféu. |
| Sugestões de IA no fluxo de migração | O ponto do BuJo é que Hugo exerce o julgamento. IA "ajudando" a pré-selecionar opções destrói o valor do sistema. |
| Bottom sheet de navegação (drawer / hamburger) | Bottom nav é o padrão mobile. Sem drawer, sem hamburger. |
| Scroll horizontal como gesto de navegação | Conflita com gestos do browser no mobile. |
| Modais aninhados | Empilhamento máximo de 1 nível em qualquer superfície. |
| Animações celebratórias | Zero confetti, zero "você arrasou", zero feedback visual comemorativo. O app é uma ferramenta, não um jogo. |

---

*Fim do documento. Mockups em `mockups/` (a produzir na fase Finalize).*
