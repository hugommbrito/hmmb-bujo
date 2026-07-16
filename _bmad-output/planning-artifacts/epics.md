---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-06-22'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/addendum.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/DESIGN.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-22.md'
project_name: 'hmmb-bujo'
user_name: 'HugoMMBrito'
---

# BuJo Digital (hmmb-bujo) - Epic Breakdown

## Overview

Este documento fornece a quebra completa de épicos e histórias do **BuJo Digital**, decompondo os requisitos do PRD, do UX Design (EXPERIENCE + DESIGN) e da Arquitetura (15 ADs + padrões de implementação) em histórias implementáveis.

> **Nota de reconciliação:** o `sprint-change-proposal-2026-06-22.md` já foi aplicado ao PRD-fonte — **FR-2.10** (gráfico de evolução de hábitos) e o **Brain Dump na Fase 1b** já constam no PRD. Nenhum requisito pendente de reconciliação.

## Requirements Inventory

### Functional Requirements

**FR-0 — Fundação**

- **FR-0.1** — Dados de cada usuário completamente isolados; nenhum dado acessível por outro usuário, em nenhuma circunstância.
- **FR-0.2** — Autenticação via email/senha com sessão persistente.
- **FR-0.3** — Dois ambientes isolados: dev e prod; dados não se cruzam.
- **FR-0.4** — Suporte a múltiplos usuários desde o início (UI de convite/gestão é fase posterior — FR-6).

**FR-1 — Motor BuJo**

- **FR-1.1** — Quatro tipos de log: Daily (um por dia), Weekly (um por semana, seg→dom), Monthly (tarefas em datas), Future (data completa ou parcial).
- **FR-1.2** — Future Log aceita data parcial (só mês); dia definido na migração mensal.
- **FR-1.3** — Tarefa tem: título (obrigatório), descrição, subtarefas, etiqueta Eisenhower (Vermelho U+I / Laranja U / Amarelo I / Verde nenhum) — opcionais.
- **FR-1.4** — Estados de tarefa: pendente, iniciada (`/`), concluída (`X`), cancelada, migrada, adiada.
- **FR-1.5** — Iniciar marca `/`; concluir marca `\`, formando X visual.
- **FR-1.6** — Ordenação manual das tarefas dentro de um log.
- **FR-1.7** — Migração diária: na abertura do dia, apresenta tarefas pendentes de ontem uma a uma; decisão por tarefa (migrar / adiar no mês / adiar no futuro / cancelar).
- **FR-1.8** — Migração semanal (segunda): apresenta tarefas do Weekly anterior sem disposição; decisão por tarefa.
- **FR-1.9** — Migração mensal (1ª semana do mês): apresenta tarefas do Monthly anterior sem disposição + puxa automaticamente itens do Future Log do mês corrente para o Monthly.
- **FR-1.10** — Semana **fechada** quando todas as tarefas têm disposição (concluída/cancelada/adiada/migrada).
- **FR-1.11** — Tarefas recorrentes são templates: título, grupo de recorrência (Semanal/Mensal/Anual), recorrência (texto livre), ativo + demais campos de tarefa.
- **FR-1.12** — Na abertura de cada ciclo, app apresenta recorrentes ativos; placement **manual** de cada um (sem auto-placement).
- **FR-1.13** — Semanas e meses fechados consultáveis no arquivo, com estado final de cada tarefa.

**FR-2 — Sistema de Hábitos**

- **FR-2.1** — Hábitos organizados em grupos criados pelo usuário.
- **FR-2.2** — Criação de hábito: nome, emoticon, grupo, peso inicial, tipo (booleano/numérico).
- **FR-2.3** — Hábitos numéricos têm meta (valor alvo) e bonus de completude (%).
- **FR-2.4** — Percentual de completude diário, ponderado pelos pesos (booleano = 100% do peso quando feito; numérico = proporcional 0%→(100%−bonus%), 100% ao atingir meta).
- **FR-2.5** — Pesos alteráveis a qualquer momento; alteração vale a partir do dia corrente; dias anteriores preservam pesos vigentes.
- **FR-2.6** — Log diário de hábitos é snapshot imutável (hábitos ativos + pesos vigentes naquele dia).
- **FR-2.7** — Hábitos são desativados, nunca deletados; inativos somem do log ativo, permanecem no histórico.
- **FR-2.8** — Hábitos desativados podem ser reativados (voltam a partir do dia da reativação).
- **FR-2.9** — Histórico de hábitos consultável por data.
- **FR-2.10** — Histórico consultável como **gráfico de evolução por hábito**; mudanças reais de config (peso/meta/bonus/ativação) anotadas como eventos datados; multiplicador de tipo de dia **não** é mudança de config (ver AD-10/AD-11).

**FR-3 — Saúde e Medicamentos**

- **FR-3.1** — Métricas de saúde são campos dinâmicos criados pelo usuário: nome, tipo (inteiro/decimal/booleano/enum/texto), ativo.
- **FR-3.2** — Log diário de saúde preenchido pelo usuário (majoritariamente de manhã, revisando o dia anterior); campos inativos preservados no histórico.
- **FR-3.3** — Histórico de saúde em três visualizações: tabela dia a dia, gráficos de evolução por campo, dashboard de período.
- **FR-3.4** — Medicamentos são entidade separada: nome, dose, blocos de horário (manhã/tarde/noite).
- **FR-3.5** — Um medicamento pode aparecer em múltiplos blocos com doses diferentes.
- **FR-3.6** — Confirmação diária por bloco ("tomar remédios da manhã") ou individual.
- **FR-3.7** — Medicamentos com ativo/inativo; histórico de confirmações preservado após desativação.

**FR-4 — Diário de Gratidão**

- **FR-4.1** — Múltiplas entradas por dia em texto livre, sem estrutura obrigatória.
- **FR-4.2** — Histórico navegável por data e por mês.
- **FR-4.3** — **[BACKLOG]** Resumo mensal gerado por IA.

**FR-5 — Brain Dump** *(Fase 1b — antecipado via AD-15)*

- **FR-5.1** — Caixa de entrada independente, sem data e sem log de destino obrigatório; estado normal é vazio.
- **FR-5.2** — Cada item tem título (obrigatório) e, opcionalmente, descrição e log de destino.
- **FR-5.3** — Itens processados manualmente (movidos para o log correto ou descartados); sem migração automática.
- **FR-5.4** — Indicador visual persistente quando o Brain Dump contém itens, até ficar vazio.

**FR-6 — Gestão de Usuários** *(fase posterior — pós-MVP)*

- **FR-6.1** — Convite de novos usuários por email.
- **FR-6.2** — Cada usuário com espaço de dados completamente isolado.
- **FR-6.3** — [ASSUMPTION] Sem espaço compartilhado entre usuários no MVP.
- **FR-6.4** — **[BACKLOG]** Competição entre amigos por percentual de hábitos.

### NonFunctional Requirements

- **NFR-1 — Mobile real:** 100% das ações do fluxo diário (brain dump, hábito, saúde) executáveis em mobile sem scroll horizontal.
- **NFR-2 — Performance:** Daily Log e fluxo de migrações percebidos como instantâneos (< 2s em conexão normal). *Aplica-se só ao modo de execução diária (AD-14).*
- **NFR-3 — Isolamento de dados:** nenhum dado de um usuário acessível por outro em nenhuma circunstância. *Interpretado como isolamento na fronteira da aplicação (AD-12).*
- **NFR-4 — Integridade do histórico:** logs passados imutáveis; nenhuma operação futura altera registros históricos. *Interpretado como imutabilidade sistêmica — usuário edita manualmente, o sistema nunca retroage (AD-04/06/07).*
- **NFR-5 — Ambientes separados:** dev e prod com dados completamente isolados.
- **NFR-6 — Disponibilidade:** uptime 99% no horário ativo (6h–23h).

### Additional Requirements

_Requisitos técnicos e transversais da Arquitetura (15 ADs + §6 Padrões + §7 Estrutura) que impactam a criação de histórias. **Não há starter template** — projeto greenfield com scaffold próprio de monorepo._

**Fundação técnica (pré-condição de tudo — primeira prioridade da arquitetura §8.7):**

- **AR-1 (Scaffold monorepo)** — `backend/` (Django + DRF) + `frontend/` (React + Vite + MUI); dev/prod via branches do Neon (sem Docker); `django-environ` (`.env.dev`/`.env.prod`); settings split `base/dev/prod`.
- **AR-2 (`core/` primeiro)** — `TenantModel` abstrata (PK UUID, `user_id`), `tenant.py` (contextvar + `TenantManager` fail-closed + `tenant_context`), `exceptions.py` (`DomainError` + handler DRF), `calendar.py` (`today_for`/`user_today`/`is_workday` — autoridade única do "dia"), `middleware.py` (seta contextvar pós-auth JWT, reset no `finally`), `pagination.py` (PageNumberPagination, page_size 50).
- **AR-3 (Isolamento multi-tenant — AD-12)** — manager auto-escopado por `contextvar`; **fail-closed** (contexto vazio → `TenantScopeViolation`); `all_objects` só no caminho admin; sem RLS no MVP. Toda tabela tenant carrega e indexa `user_id`.
- **AR-4 (Guardrails de CI desde o commit inicial)** — `import-linter` (regra de porta do `core`: não importa app de domínio), guardrail de tenant (manager escopado como default), `test_isolation` (incl. teste fail-closed), ESLint boundary (features não se importam), `ruff`/`pytest`/`tsc`.
- **AR-5 (Auth JWT — §6.5)** — `djangorestframework-simplejwt`; access ~30min, refresh 7 dias, rotação + blacklist; tokens em `localStorage`; **interceptor Axios refresh single-flight** (obrigatório por causa da rotação); sync multi-aba via evento `storage`; logout limpa `localStorage` + `queryClient.clear()`.

**Contrato de dados e tempo (transversal a vários épicos):**

- **AR-6 (Contrato temporal — AD-04/05)** — `today_for(user)` é a única fonte de "hoje" (proibido `date.today()`/`timezone.now()` crus, guardrail no CI); `DATE` puro para "página do diário" vs `timestamptz` (UTC) para eventos; semana começa segunda; semana 1 = a que contém o dia 1; Weekly chaveado por `week_start` (segunda), Monthly por `month_first` (dia 1); funções de derivação em `core/calendar.py`.
- **AR-7 (Schema dinâmico diferenciado — AD-01)** — hábitos e medicamentos em tabelas normalizadas; métricas de saúde em **JSONB** com validação de tipo na camada de serviço contra `health_field_definitions`; chaves JSONB de UUID **nunca** convertidas para camelCase (exceção crítica do round-trip — §6.3).
- **AR-8 (Camada de serviço obrigatória — §6.2/6.6/6.8)** — regra de negócio em `<app>/services.py` com assinatura fixa `def <verbo>_<substantivo>(*, user, ...) -> Model`; `@transaction.atomic` no serviço; views finas; materialização e cálculo de domínio só no serviço; só exceções de `core/exceptions.py` (mapa exceção→status: 400/409/401/404/500).
- **AR-9 (Convenções — §6.1/6.3)** — `snake_case` no DB/Python, `camelCase` na borda via `djangorestframework-camel-case`; `models.TextChoices` + `CheckConstraint` (nunca ENUM nativo Postgres); migrations nomeadas (uma por story); `/api/` em tudo; DRF nativo sem envelope; datas ISO 8601.
- **AR-10 (Contrato back↔front — §7.3)** — `drf-spectacular` gera `frontend/src/api/types.gen.ts` como contrato único, via passo de CI versionado.

**Padrões de frontend (transversal — AD-13):**

- **AR-11 (TanStack Query v5)** — camada de dados do app: `useQuery`/`useMutation`; query-key factory em `src/api/keys.ts` (`[escopo, entidade, 'list'|'detail', params?]`); invalidação por prefixo; `useOptimisticMutation` canônico (onMutate/onError/onSettled); IDs no cliente via `crypto.randomUUID()`.
- **AR-12 (Estrutura frontend — §7.1/7.2)** — `features/<domínio>` isoladas (barrel `index.ts`); `pages/` e `app/` únicos que compõem múltiplas features; `app/layout/AppLayout` (app bar, bottom-nav, FAB); `pages/daily/useDailyData` com prefetch paralelo (NFR-2); `/api/daily/:date` agregado reservado (não no MVP).

**Mecânicas de domínio do BuJo (impactam histórias do Motor BuJo e Hábitos/Saúde):**

- **AR-13 (Máquina de estados — AD-02)** — matriz formal de transições; `migrated`/`postponed` terminais; `completed` reabre via clique; `cancelled` desfaz via edição; transição ilegal → `InvalidTransition` (409) no serviço.
- **AR-14 (Linhagem de migração — AD-03)** — registro original preservado com `status=migrated` + `migrated_to_task_id` → sucessor; `migration_count` incrementa em cada decisão de carregar adiante (fricção intencional do BuJo).
- **AR-15 (Recorrentes + Subtarefas — AD-08)** — template em `recurring_task_templates` (separado de `tasks`); placement cria `task` snapshot com `source_template_id` (não referência viva); subtarefa = `task` com `parent_task_id` (árvore auto-referencial); fechamento de log considera a subárvore; migração de pai recria filhos não-dispostos.
- **AR-16 (Snapshot de hábitos — AD-06)** — duas camadas: `habit_versions` (config prospectiva, autoridade de semeadura) + `habit_day_entries` (snapshot realizado, congelado, editável por dia); materialização ansiosa na 1ª abertura do dia via método de serviço idempotente (`seed_habit_day`); denominador = todas as linhas do dia; edição avulsa não sangra para vizinhos.
- **AR-17 (Pesos por tipo de dia — AD-10/11)** — multiplicador por grupo × tipo de dia (`weekend`/`holiday`, precedência `holiday > weekend > weekday`); `weekday`=1.0; `user_holidays` manual; `habit_day_entries` congela `day_type` + `multiplier_at_time` separados do peso base; `peso_efetivo = weight_at_time × multiplier_at_time`; gráfico anota mudanças reais via stream de `habit_versions`, multiplicador é ritmo (nunca evento).
- **AR-18 (Modelo de medicamentos — AD-07)** — slot estável (`medications.title`) + `medication_substance_versions` + `medication_schedule_versions` (dose JSONB multi-componente) + `time_blocks` dinâmicos + `medication_day_entries` (materializado, `source=scheduled|ad_hoc`); confirmação de bloco = escrita em lote; dose perdida = sinal clínico (≠ zero de hábito).
- **AR-19 (Catch-Up / log órfão — AD-09)** — fluxo de migração generalizado; detecção por query (sem cron, sem estado acumulado); gatilhos por condição; ordem mês → semana → dia; dias pulados = lacunas honestas (não 0%); catch-up só de tarefas; reusa método de semeadura idempotente.
- **AR-20 (Brain Dump técnico — AD-13)** — badge = server state derivado (não store de cliente); endpoint leve `GET /brain-dump/count` com chave `['brainDump','count',userId]`; mutações invalidam a chave; otimismo na captura.

**Lacunas não-bloqueantes (não bloqueiam o MVP solo — §8.4):**

- **AR-21 (Deploy & Observabilidade — I-1, NFR-6)** — alvo de deploy resolvido em Railway; estratégia de uptime/monitoramento + **canal de alerta** fica deferida para o gate multiusuário do Épico 10.0 (o §6.4 prevê "500 + alerta" para contexto de tenant ausente).
- **AR-22 (Logging — I-2)** — stack/formato/níveis de logging estruturado a fixar. **Não bloqueia o MVP de uso solo**; vira pré-requisito explícito do Épico 10 antes de convidar usuários externos.

### UX Design Requirements

_Requisitos acionáveis extraídos do EXPERIENCE.md (comportamento, fluxos, componentes, estados) e DESIGN.md (tokens visuais, theming MUI). Cada UX-DR é específico o bastante para gerar histórias com ACs testáveis._

**Fundação de design / theming:**

- **UX-DR1 (Tema MUI central)** — `src/theme.ts` com paleta completamente substituída em dois níveis (tinta-papel base + camada semântica `cat-*`/`priority-*`), light + dark mode via `palette.mode`; **zero elevation** (`shadows = Array(25).fill('none')`, `MuiPaper elevation=0`), **disableRipple global**, `shape.borderRadius=4`, border-radius ≤ 8px; fonte Inter em 2 pesos (400/600); escala tipográfica (`display`/`heading`/`body`/`body-sm`/`label`); escala de espaçamento base 4px. Preferência de modo controlada em Configurações.

**Componentes (EXPERIENCE §4 + DESIGN §7):**

- **UX-DR2 (Task Row)** — componente central. Borda lateral 3px (cor de categoria), ícone de status clicável (ciclo Pendente→Iniciada→Concluída), título (tachado se cancelada), chip Eisenhower opcional, drag handle (hover desktop). Detalhe inline (desktop) / bottom sheet (mobile); long-press mobile → menu de contexto; min-height 36px, touch target ≥ 44px; cor nunca é indicador único.
- **UX-DR3 (Migration Card / Fluxo de Migração)** — modal overlay (desktop) / full-screen (mobile), uma tarefa por vez; 4 ações em botão (Migrar hoje / Adiar no mês / Adiar no futuro / Cancelar); pickers com confirmação automática (sem botão extra); nenhuma ação pré-selecionada; atalhos de teclado `1`–`4`, `Esc` pausa (não cancela, retomável); indicador "N de M revisadas" com `aria-live=polite`; sistema nunca encerra o fluxo.
- **UX-DR4 (Habit Tracker Row / Grid)** — booleano (checkbox) e numérico (campo + unidade + % de meta); agrupamento por grupo com cabeçalho e percentual ponderado do grupo; percentual total no topo; sem troféus/sequências; touch target ≥ 44px. Grid denso (hábitos × dias) na superfície de histórico.
- **UX-DR5 (Day Header)** — data ("SEG, 15 JUN"), contador opcional de janela de tempo (acordar/foco/dormir, editável inline), contador de pendentes, chevron de colapso; `surface-header` tom-sobre-tom (sem cor de destaque); sempre visível mesmo colapsado.
- **UX-DR6 (FAB + Capture Sheet)** — exclusivo mobile, sempre visível, 52×52px, badge numérico quando Brain Dump não-vazio; tap abre bottom sheet com título (foco automático), descrição, log de destino (default Brain Dump); salvar fecha e atualiza badge; FAB desabilitado offline com tooltip.
- **UX-DR7 (Sidebar + Nav Item)** — sidebar fixa desktop (240px) / colapsada para ícones (56px); grupos colapsáveis (Planner, Saúde) com chevron; item ativo com borda 3px `brand-primary` + bg 10%; badge no Brain Dump (visível mesmo colapsada); toggle por atalho `[`.
- **UX-DR8 (Bottom Nav mobile)** — 4 abas (Hoje · Planner · Hábitos · Saúde) + FAB; sem drawer/hambúrguer; acima da safe-area; Gratidão sem aba dedicada (link contextual em Hoje).
- **UX-DR9 (Future Log Item)** — agrupador por mês ("Julho 2026"); linha com data completa ou parcial (só mês, exibida "— jul"); adição inline com prefixo `(14)` para dia; detalhe inline.
- **UX-DR10 (Health Metric Row)** — input por tipo (inteiro/decimal/booleano/enum/texto); campos de ontem no topo com rótulo "Ontem, [data]" (ritual matinal); campos inativos não aparecem; sem exclusão, só desativação.
- **UX-DR11 (Medication Block)** — cabeçalho de bloco; lista nome+dose; botão "Confirmar todos da manhã" (lote) + checkbox individual; estados pendente/parcial/confirmado (indicador no cabeçalho); histórico por data.
- **UX-DR12 (Status Chip + Eisenhower Chip)** — chips densos (`label` 11px uppercase, radius 2px); variantes de status (a-fazer/fazendo/feita/migrada/adiada/rápida) e Eisenhower (U+I/U/I/—); cor sempre acompanhada de texto (acessibilidade).

**Estados, microcopy e feedback:**

- **UX-DR13 (Voz, tom e estados vazios)** — pt-BR direto e funcional; zero gamificação/exclamações/sequências; microcopy conforme tabela de exemplos (EXPERIENCE §3); estados vazios informativos ("Brain Dump vazio.", "Nenhuma tarefa para hoje.", etc.).
- **UX-DR14 (Loading & escrita otimista)** — skeleton screens (Daily/Weekly/Monthly); sem spinner global em escrita; resposta otimista com rollback + erro inline em falha; meta percebida < 2s (NFR-2).
- **UX-DR15 (Conectividade & erros)** — MVP sem offline; toast não-bloqueante em perda de conexão; erro inline em escrita com retry; FAB desabilitado offline; nenhuma captura perdida silenciosamente.
- **UX-DR16 (Estados de Auth)** — redirect para Login sem sessão; erro de login inline ("Email ou senha incorretos."); sessão expirada com banner não-bloqueante sem destruir o estado da UI; pós-login abre no Daily Log de hoje.

**Estrutura, navegação e plataforma:**

- **UX-DR17 (Arquitetura de Informação / Roteamento)** — mapa de superfícies (Hoje, Planner: Esta Semana/Este Mês/Futuro, Hábitos, Saúde: Métricas/Medicamentos, Gratidão, Brain Dump, Arquivo, Configurações + sub-seções); empilhamento de modal máximo 1 nível; Fluxo de Migração nunca navegado diretamente.
- **UX-DR18 (Responsividade)** — breakpoints desktop ≥1024 / tablet 768–1023 / mobile <768; Weekly Log 7 colunas (desktop) → seletor de dia (tablet/mobile), sem scroll horizontal; Monthly Log lista vertical no mobile; detalhe de tarefa = bottom sheet no mobile; Migração full-screen no mobile.
- **UX-DR19 (Primitivos de interação / teclado)** — atalhos globais `[` (sidebar), `N` (nova tarefa), `B` (Brain Dump), `Esc` (fechar modal/popover); drag-and-drop de reordenação só desktop; ciclo de status por clique; proibições explícitas (migração automática, drag mobile, modal aninhado, gamificação, sugestões de IA, scroll horizontal de navegação).
- **UX-DR20 (Acessibilidade — WCAG 2.2 AA)** — cor nunca único indicador (sempre + ícone/texto); touch target ≥ 44px mobile; focus ring MUI preservado; tab order = ordem visual; `Esc` fecha modal/popover; anúncios `aria-live` (mudança de superfície, progresso de migração, status de tarefa, badge do Brain Dump); semântica HTML (`<nav>`, `<main>`, `role=dialog`/`aria-modal` com foco travado).

### FR Coverage Map

> **Decisão de granularidade (party-mode 2026-06-22):** estrutura refinada seguindo a recomendação da Amelia — Épico de Fundação rachado em **Plataforma** + **Autenticação**; Saúde & Medicamentos rachados em **Métricas de Saúde** + **Medicamentos**; o épico de Migração permanece **unificado com histórias estritamente ordenadas**. Convergências aplicadas: `core/calendar.py` + padrão temporal canônico explícitos na Fundação; **schema de `tasks` congelado por completo** no Épico 3 (Daily Log); "espinha do ritual" como contrato nos épicos de domínio.

**Requisitos Funcionais:**

- **FR-0.1** → Épico 1 (mecanismo de isolamento — `TenantModel`, manager fail-closed, `test_isolation`)
- **FR-0.2** → Épico 2 (auth email/senha + sessão persistente)
- **FR-0.3** → Épico 1 (ambientes dev/prod isolados — branches do Neon)
- **FR-0.4** → Épico 1 (multi-usuário desde o início — schema)
- **FR-1.1** → Épico 3 (Daily Log) + Épico 4 (Weekly/Monthly/Future Log)
- **FR-1.2** → Épico 4 (Future Log com data parcial)
- **FR-1.3** → Épico 3 (campos de tarefa + subtarefas)
- **FR-1.4** → Épico 3 (estados de tarefa)
- **FR-1.5** → Épico 3 (`/` e `\` formando X)
- **FR-1.6** → Épico 3 (ordenação manual)
- **FR-1.7** → Épico 4 (migração diária)
- **FR-1.8** → Épico 4 (migração semanal)
- **FR-1.9** → Épico 4 (migração mensal + pull do Future Log)
- **FR-1.10** → Épico 4 (semana fechada)
- **FR-1.11** → Épico 4 (templates recorrentes)
- **FR-1.12** → Épico 4 (placement manual de recorrentes)
- **FR-1.13** → Épico 4 (arquivo de ciclos fechados)
- **FR-2.1 a FR-2.10** → Épico 6 (Sistema de Hábitos, incl. gráfico de evolução FR-2.10)
- **FR-3.1, FR-3.2, FR-3.3** → Épico 7 (Métricas de Saúde — campos dinâmicos JSONB)
- **FR-3.4, FR-3.5, FR-3.6, FR-3.7** → Épico 8 (Medicamentos — versionamento + confirmação)
- **FR-4.1, FR-4.2** → Épico 9 (Diário de Gratidão)
- **FR-4.3** → **[BACKLOG]** (resumo mensal por IA — fora do MVP)
- **FR-5.1 a FR-5.4** → Épico 5 (Brain Dump — Fase 1b)
- **FR-6.1, FR-6.2, FR-6.3** → Épico 10 (Gestão de Usuários — pós-MVP)
- **FR-6.4** → **[BACKLOG]** (competição entre amigos — fora do MVP)

**NFRs (transversais):**

- **NFR-1 (mobile real)** → Épico 2 (casca/nav) + tecido nos épicos de feature (3–9)
- **NFR-2 (<2s execução diária)** → Épicos 3, 4 (prefetch paralelo do Daily Log)
- **NFR-3 (isolamento)** → Épico 1 (fail-closed, gate `test_isolation` verde antes de modelos de domínio) + verificado por épico
- **NFR-4 (imutabilidade sistêmica)** → Épicos 4 (linhagem), 6 (snapshot hábitos), 8 (snapshot medicamentos)
- **NFR-5 (dev/prod)** → Épico 1 (branches do Neon, settings split)
- **NFR-6 (uptime)** → MVP solo em regime best-effort; Épico 10.0 antes de multiusuário (AR-21/AR-22)

**Requisitos de Arquitetura (ARs):**

- **AR-1, AR-2, AR-3, AR-4** (scaffold, `core/`, multi-tenant fail-closed, guardrails CI) → Épico 1
- **AR-6** (contrato temporal/calendário — `core/calendar.py` + **padrão temporal canônico** como artefato explícito) → Épico 1 (estabelece) → usado intensamente nos Épicos 4 e 6
- **AR-8, AR-9, AR-10** (camada de serviço, convenções, contrato back↔front) → Épico 1 (estabelece) → todos
- **AR-11, AR-12** (TanStack Query, estrutura frontend) → Épico 1 (estabelece) → todos
- **AR-5** (auth JWT single-flight) → Épico 2
- **AR-13** (máquina de estados) → Épico 3
- **AR-14** (linhagem de migração — **colunas no `tasks` criadas/congeladas no Épico 3**; comportamento exercido no Épico 4) → Épico 3 (schema) + Épico 4 (comportamento)
- **AR-15** (recorrentes + subtarefas — subtarefas/árvore no `tasks` congeladas no Épico 3; recorrentes no Épico 4) → Épico 3 (subtarefas) + Épico 4 (recorrentes)
- **AR-7** (schema dinâmico JSONB) → Épico 7 (saúde); padrão de validação estabelecido no Épico 1
- **AR-16, AR-17** (snapshot hábitos, pesos por tipo de dia) → Épico 6
- **AR-18** (modelo de medicamentos) → Épico 8
- **AR-19** (catch-up) → Épico 4
- **AR-20** (Brain Dump técnico) → Épico 5
- **AR-21, AR-22** (deploy/observabilidade/logging) → Épico 10.0 antes de multiusuário (não-bloqueantes para o MVP solo)

**Requisitos de UX Design (UX-DRs):**

- **UX-DR1** (tema MUI) → Épico 1
- **UX-DR7** (sidebar), **UX-DR8** (bottom-nav), **UX-DR16** (estados de auth), **UX-DR17** (IA/roteamento), **UX-DR20** (a11y baseline) → Épico 2
- **UX-DR2** (Task Row), **UX-DR5** (Day Header), **UX-DR12** (chips) → Épico 3
- **UX-DR3** (Migration Card), **UX-DR9** (Future Log Item) → Épico 4
- **UX-DR6** (FAB + Capture Sheet) → Épico 5
- **UX-DR4** (Habit Tracker) → Épico 6
- **UX-DR10** (Health Metric Row) → Épico 7
- **UX-DR11** (Medication Block) → Épico 8
- **UX-DR13** (voz/estados vazios), **UX-DR14** (loading/otimista), **UX-DR15** (conectividade), **UX-DR18** (responsividade), **UX-DR19** (teclado/interação) → transversais (estabelecidos nos Épicos 1–2, aplicados em todos)

## Epic List

> **Auditoria de dependência Brain Dump ↔ "abandono do caderno" (questão de John):** confirmado **sem dependência oculta**. O critério "abandono do caderno" (ciclo BuJo completo) é cumprido pelo Épico 4 de forma independente do Brain Dump. A relação é a inversa e fraca — o Brain Dump (Épico 5) depende do Daily Log existir (Épico 3) para ter destino de processamento, conforme AD-15. Sequenciamento mantido: Brain Dump complementa, não bloqueia o ciclo.

### Epic 1: Fundação de Plataforma
Entrega o esqueleto deployável e a **garantia de isolamento provada** (NFR-3) — o alicerce sobre o qual tudo é construído. Scaffold do monorepo (`backend/` Django+DRF + `frontend/` React+Vite+MUI), o módulo `core/` completo (`TenantModel` UUID, `tenant.py` fail-closed, **`core/calendar.py` com `today_for` e o padrão temporal canônico documentado**, `exceptions.py` + handler, `middleware.py`, `pagination.py`), guardrails de CI desde o commit inicial (`import-linter`, guardrail de tenant, **`test_isolation` verde antes de qualquer modelo de domínio**), ambientes dev/prod via branches do Neon, tema MUI central (claro/escuro) e os padrões de dados que todos herdam (camada de serviço, TanStack Query, contrato `drf-spectacular`→`types.gen.ts`).
**FRs covered:** FR-0.1, FR-0.3, FR-0.4
**Habilita:** todos os épicos seguintes. **Standalone:** fundação deployável com isolamento garantido e padrões canônicos prontos — o gate de qualidade do projeto.

### Epic 2: Autenticação & Acesso
Hugo cria conta, faz **login com sessão persistente** e entra numa casca navegável: sidebar (desktop) / bottom-nav + FAB (mobile), roteamento autenticado, estados de auth (erro de login, sessão expirada sem destruir a UI), baseline de acessibilidade (WCAG 2.2 AA, foco, `aria-live`, semântica HTML). JWT com refresh **single-flight** e sync multi-aba.
**FRs covered:** FR-0.2
**Depende de:** Épico 1. **Standalone:** Hugo autentica e navega a casca do app.

### Epic 3: Daily Log & Agregado de Tarefas
Hugo rastreia o **dia de hoje**: cria tarefas com título, descrição, subtarefas e etiqueta Eisenhower; cicla estados pela máquina de transições (pendente → iniciada → concluída, cancelar/reabrir); reordena manualmente; vê o Daily Log com Day Header e widget de pendentes. **O agregado `Task` é congelado por completo aqui** — incluindo as colunas de linhagem (`migrated_to_task_id`, `migration_count`) e a árvore de subtarefas (`parent_task_id`) como schema estável, mesmo que o comportamento de migração só seja exercido no Épico 4.
**FRs covered:** FR-1.1 (Daily Log), FR-1.3, FR-1.4, FR-1.5, FR-1.6
**Depende de:** Épicos 1, 2. **Standalone:** rastreia o hoje sem precisar de migração/planejamento.

### Epic 4: Logs de Planejamento, Migração & Recorrentes
Completa o **ciclo BuJo** — o marco de "abandono do caderno". Consome o agregado `Task` congelado (não o altera). Histórias **estritamente ordenadas**: (1) Logs Weekly/Monthly/Future → (2) migração diária → (3) rollover semanal/mensal + pull do Future Log → (4) **Catch-Up** para dias pulados (depende de 2+3) → (5) templates recorrentes com placement manual → (6) fechamento de ciclos + **arquivo** consultável. Decisão explícita por tarefa com linhagem (`migration_count`).
**FRs covered:** FR-1.1 (Weekly/Monthly/Future), FR-1.2, FR-1.7, FR-1.8, FR-1.9, FR-1.10, FR-1.11, FR-1.12, FR-1.13
**Depende de:** Épicos 1, 3. **Standalone:** ciclo de planejamento e migração completo sobre as tarefas do Épico 3.

### Epic 11: Refinamento do Planner & Recorrentes *(refina o Épico 4 — roda antes do Épico 5)*
Correções e melhorias identificadas em uso após o Épico 4: isola o banco de testes numa branch Neon dedicada; leva os Recorrentes para o Planner com abas/filtros; refina o placement (dedup + modal com calendário de densidade); torna anuais pendentes consultáveis/colocáveis no Future Log o ano todo; habilita CRUD de tarefas em Esta Semana/Este Mês; permite mover/migrar qualquer tarefa (destino dia-ou-mês) de qualquer superfície; e, num 2º lote (reaberto pós-retro via Correct Course 2026-07-15), corrige bugs remanescentes (edição não persistia, placement sem infos), poli o visual dos cards, reformula o seletor de Mover (abas Hoje/Semana/Mês/Futuro, botão explícito) e habilita navegação/ação em logs passados não-fechados. Número 11 é apenas identificador (épicos 5–10 já planejados não foram renumerados) — a execução é logo após o Épico 4.
**Origem:** lista de bugs/melhorias em `docs/futureIdeas.md` (pós-Épico 4).
**Depende de:** Épico 4 (refina o que ele entregou). **Standalone:** melhorias incrementais sobre o ciclo BuJo já funcional.

### Epic 5: Brain Dump & Captura Rápida (Fase 1b)
A **válvula de escape** do sistema, especialmente no mobile (UJ-4): caixa de entrada sem data, captura rápida pelo FAB, indicador visual persistente (badge como server state derivado) e processamento manual dos itens para os logs corretos. Trivial e desacoplado — antecipado para logo após o ciclo BuJo (AD-15).
**FRs covered:** FR-5.1, FR-5.2, FR-5.3, FR-5.4
**Depende de:** Épicos 1, 3 (itens precisam de destino). **Standalone:** captura + processamento completos.

### Epic 6: Sistema de Hábitos
Hugo configura hábitos (grupos, booleano/numérico, peso, meta, bonus), marca o tracker diário e acompanha a **completude ponderada**, com snapshot imutável por dia, pesos prospectivos, multiplicador por tipo de dia (fim de semana/feriado), desativação/reativação, histórico por data e **gráfico de evolução** com anotação de mudanças reais (FR-2.10). Ordem interna: model + snapshot de pesos → multiplicador de tipo de dia → gráfico (lê snapshots, vem por último).
**Espinha do ritual:** a história final acopla o widget de hábitos ao fluxo da manhã no Daily Log — não uma ilha isolada.
**FRs covered:** FR-2.1 a FR-2.10
**Depende de:** Épicos 1, 3 (Daily Log para o widget). **Standalone:** sistema de hábitos completo.

### Epic 7: Métricas de Saúde
Hugo cria **campos de saúde dinâmicos** (JSONB, validados na camada de serviço contra `health_field_definitions`), preenche o log diário (campos de ontem no topo, ritual matinal) e consulta o histórico em três visualizações: tabela dia a dia, gráficos de evolução e dashboard de período.
**Espinha do ritual:** a história final acopla as métricas de ontem ao fluxo da manhã.
**FRs covered:** FR-3.1, FR-3.2, FR-3.3
**Depende de:** Épicos 1, 3. **Standalone:** tracking de métricas de saúde completo.

### Epic 8: Medicamentos
Hugo gerencia **medicamentos** com modelo versionado (slot estável `medications.title` + `medication_substance_versions` + `medication_schedule_versions` com dose JSONB + `time_blocks` dinâmicos) e confirma a adesão diária por bloco ("tomar remédios da manhã") ou individual, com distinção de **dose perdida** (sinal clínico). Materialização ansiosa em `medication_day_entries`; ativo/inativo com histórico preservado.
**Espinha do ritual:** a confirmação de medicamentos da manhã integra o ritual matinal.
**FRs covered:** FR-3.4, FR-3.5, FR-3.6, FR-3.7
**Depende de:** Épicos 1, 3. **Standalone:** cadastro e confirmação de medicamentos completos. *(Sem FK para `health` — domínio independente, AD-07/§7.2.)*

### Epic 9: Diário de Gratidão
Hugo registra entradas de texto livre (múltiplas por dia, sem estrutura) e navega o histórico por data e por mês.
**Espinha do ritual:** acessível por link contextual no Daily Log de ontem, integrado ao ritual matinal (UJ-1).
**FRs covered:** FR-4.1, FR-4.2
**Depende de:** Épicos 1, 3. **Standalone:** diário de gratidão completo. *(FR-4.3 resumo por IA fica no backlog.)*

### Epic 10: Gestão de Usuários *(pós-MVP — `[não-estimado]`)*
Convite de novos usuários por email e onboarding de amigos, cada um com espaço de dados isolado. A pré-condição (schema multi-tenant + isolamento fail-closed) já é entregue no Épico 1 — **este épico é mantido no documento como âncora de justificativa do AD-12**, fora da contagem de sprint do MVP. Antes de abrir o uso para convidados, fecha a observabilidade mínima que foi deliberadamente deferida do MVP solo (AR-21/AR-22).
**FRs covered:** FR-6.1, FR-6.2, FR-6.3
**Depende de:** Épico 1. **Standalone:** observabilidade mínima + fluxo de convite/onboarding. *(FR-6.4 competição fica no backlog.)*

---

## Epic 1: Fundação de Plataforma

Entrega o esqueleto deployável e a garantia de isolamento provada (NFR-3) — o alicerce sobre o qual tudo é construído. Estabelece os padrões canônicos (camada de serviço, multi-tenant fail-closed, autoridade temporal, contrato de API, tema e camada de dados) que todos os épicos seguintes herdam.

### Story 1.1: Scaffold do monorepo e pipeline de CI base

As a desenvolvedor do projeto,
I want um monorepo `backend/` (Django + DRF) e `frontend/` (React + Vite + MUI) com ambientes dev/prod isolados e CI rodando lint e testes,
So that exista um esqueleto deployável e verificável sobre o qual todo o resto é construído, com dev e prod nunca cruzando dados (FR-0.3, FR-0.4, NFR-5, AR-1).

**Acceptance Criteria:**

**Given** o repositório vazio,
**When** o scaffold é criado,
**Then** existe `backend/` com projeto Django + DRF, `manage.py`, `pyproject.toml` (deps + ruff + pytest) e `config/settings/` dividido em `base.py`/`dev.py`/`prod.py` via `django-environ`,
**And** existe `frontend/` com Vite + React + TypeScript + MUI, `package.json`, `tsconfig.json` e ESLint configurado.

**Given** os ambientes dev e prod,
**When** a configuração é carregada,
**Then** `.env.dev` aponta para a branch dev do Neon e `.env.prod` para a branch main, lidos por `django-environ`, sem segredos commitados (`.env.example` versionado),
**And** CORS e base-URL da API são configuráveis por variável de ambiente desde o início.

**Given** um push para o repositório,
**When** o workflow `.github/workflows/ci.yml` roda,
**Then** executa `ruff` + `pytest` (backend) e `tsc` + ESLint (frontend) e falha o build em qualquer erro,
**And** o backend sobe e responde a um health-check, e o `vite build` gera os estáticos sem erro.

### Story 1.2: Módulo `core/` com isolamento multi-tenant fail-closed e guardrails

As a desenvolvedor do projeto,
I want o `TenantModel` abstrato, o `TenantManager` auto-escopado por `contextvar` (fail-closed), a taxonomia de exceções com handler DRF e os guardrails de CI que impõem o isolamento,
So that o isolamento total de dados entre usuários seja o comportamento padrão e provado verde antes de qualquer modelo de domínio existir (FR-0.1, NFR-3, AR-2, AR-3, AR-4).

**Acceptance Criteria:**

**Given** um model que herda `TenantModel`,
**When** ele é definido,
**Then** tem PK `UUID` (default `uuid4`), coluna `user_id` indexada, `objects = TenantManager()` (auto-escopado) e `all_objects` (manager não-escopado, só para admin),
**And** na criação o `user_id` é preenchido automaticamente a partir do `current_user_id` do contextvar.

**Given** uma query via `Model.objects` **sem** contexto de tenant setado,
**When** a query é executada,
**Then** o `TenantManager` levanta `TenantScopeViolation` (fail-closed) — nunca retorna dados de todos os usuários,
**And** o teste `core/tests/test_isolation.py` cobre esse caso fail-closed e o caso de isolamento entre dois usuários, e passa.

**Given** a taxonomia de exceções de domínio,
**When** `core/exceptions.py` é implementado,
**Then** existe a hierarquia `DomainError` (com `InvalidTransition`, `ImmutableSnapshot`, `TenantScopeViolation`, etc.) e um exception handler DRF que uniformiza o corpo `{ "detail", "fields" }` e mapeia exceção→status (400/401/404/409; contexto de tenant ausente → 500 + alerta),
**And** o `middleware.py` seta o `contextvar` logo após a autenticação e o reseta no `finally`.

**Given** o pipeline de CI,
**When** ele roda,
**Then** o `import-linter` falha o build se `core/` importar qualquer app de domínio (regra de porta),
**And** o guardrail de tenant falha o build se um model tenant expuser manager não-escopado como `objects` default.

### Story 1.3: Autoridade temporal `core/calendar.py` e padrão temporal canônico

As a desenvolvedor do projeto,
I want uma fonte única para "hoje" e para a semântica de calendário (semana/mês/ano), com o padrão temporal canônico documentado e imposto por guardrail,
So that todo módulo concorde sobre datas e fronteiras temporais, evitando divergência conceitual entre Daily Log, migração e materialização de snapshots (AR-6, AD-04, AD-05).

**Acceptance Criteria:**

**Given** a necessidade de saber "que dia é hoje" para um usuário,
**When** `core/calendar.py` é implementado,
**Then** expõe `today_for(user)` que resolve o fuso IANA do usuário (`timezone.now().astimezone(ZoneInfo(user.timezone)).date()`), e nenhum outro código chama `date.today()`/`timezone.now().date()` direto,
**And** um guardrail no CI falha o build se houver uso direto de `date.today()`/`timezone.now()` fora de `core/calendar.py`.

**Given** a semântica de calendário (segunda = primeiro dia; semana 1 = a que contém o dia 1),
**When** as funções de derivação são implementadas,
**Then** existem `week_start_of(d)`, `weeks_of_month(year, month)` e `months_of_week(week_start)`,
**And** os casos-âncora passam: `week_start_of(2023-01-01) == 2022-12-26`; `months_of_week(2022-12-26) == {(2022,12),(2023,1)}`; `weeks_of_month(2022,12)[-1] == weeks_of_month(2023,1)[0]`.

**Given** as duas categorias de coluna temporal,
**When** o padrão temporal canônico é documentado em `docs/`,
**Then** registra `DATE` puro para "página do diário" (`log_date`, datas de hábito/saúde) vs `timestamptz` (UTC) para eventos/auditoria, a regra "sem auto-migração / dia congela na abertura", e quando se materializa vs. consulta sob demanda,
**And** o documento é referenciável pelos Épicos 4 e 6.

### Story 1.4: Contrato de API e padrões da camada de serviço

As a desenvolvedor do projeto,
I want o contrato de API único (`drf-spectacular` → `types.gen.ts`), o casing camelCase na borda com a exceção de JSONB de chave dinâmica, paginação/filtros padrão e a convenção da camada de serviço,
So that backend e frontend compartilhem um contrato que não envelhece e todo agente de IA escreva código consistente (AR-8, AR-9, AR-10).

**Acceptance Criteria:**

**Given** o schema OpenAPI do backend,
**When** o passo de CI de geração de tipos roda,
**Then** `drf-spectacular` gera `frontend/src/api/types.gen.ts` como contrato único, e o CI falha se o tipo gerado divergir do commitado,
**And** todos os endpoints ficam sob o prefixo `/api/` com respostas DRF nativas (objeto direto; lista paginada `{count,next,previous,results}`).

**Given** o casing de dados,
**When** a serialização é configurada,
**Then** `djangorestframework-camel-case` converte `snake_case`↔`camelCase` na borda (incl. query params),
**And** campos JSONB de chave dinâmica (ex.: `health_logs.values`) são explicitamente **excluídos** da conversão (round-trip idempotente), com um teste que prova que uma chave não-camelCase sobrevive ao round-trip.

**Given** a convenção da camada de serviço,
**When** um serviço de exemplo de referência é implementado,
**Then** segue a assinatura `def <verbo>_<substantivo>(*, user, ...) -> Model` com `@transaction.atomic` no serviço (não na view) e levanta só exceções de `core/exceptions.py`,
**And** `PageNumberPagination` (page_size 50) e `django-filter`/`OrderingFilter` estão configurados como default.

### Story 1.5: Tema MUI central e camada de dados do frontend

As a Hugo,
I want um tema visual BuJo (claro/escuro) e a camada de dados do frontend prontos,
So that a casca do app e todas as features futuras tenham a identidade visual "caderno inteligente" e um padrão único de fetch/cache/mutação (UX-DR1, AR-11, AR-12).

**Acceptance Criteria:**

**Given** o tema MUI,
**When** `src/theme.ts` é implementado,
**Then** a paleta é completamente substituída em dois níveis (tinta-papel base `#FDFAF4`/`#2A2420` + camada semântica `cat-*`/`priority-*`), com modo claro e escuro via `palette.mode`,
**And** `shadows = Array(25).fill('none')`, `MuiPaper` com `elevation=0`, `disableRipple` global, `shape.borderRadius=4` (sem componente > 8px), fonte Inter em 2 pesos (400/600) e a escala tipográfica (`display`/`heading`/`body`/`body-sm`/`label`).

**Given** a camada de dados,
**When** o frontend base é configurado,
**Then** existem `src/api/client.ts` (Axios), `src/api/keys.ts` (query-key factory `[escopo, entidade, 'list'|'detail', params?]`), `src/api/queryClient.ts` (TanStack Query v5 com `refetchOnWindowFocus`) e `src/shared/hooks/useOptimisticMutation.ts` (wrapper canônico onMutate/onError/onSettled),
**And** os providers (`QueryClientProvider`, `ThemeProvider`) estão montados em `src/app/providers/`.

**Given** a estrutura de fronteiras do frontend,
**When** o ESLint roda,
**Then** a regra de boundary falha o build se uma `feature/<x>` importar outra feature diretamente (só via barrel `index.ts`),
**And** a preferência de modo claro/escuro é persistida e aplicada na inicialização.

---

## Epic 2: Autenticação & Acesso

Hugo cria conta, faz login com sessão persistente e entra numa casca navegável, com estados de auth honestos e baseline de acessibilidade WCAG 2.2 AA.

### Story 2.1: Cadastro e login com JWT

As a Hugo,
I want criar uma conta com email/senha e autenticar recebendo tokens JWT,
So that eu tenha acesso seguro ao meu espaço de dados isolado (FR-0.2, AR-5).

**Acceptance Criteria:**

**Given** o app `accounts/` e o model de usuário,
**When** ele é implementado,
**Then** o `User` tem PK `UUID`, email único, senha com hash e `timezone` IANA (detectado no signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`, editável),
**And** existe endpoint de cadastro que cria o usuário e endpoint de login que valida credenciais.

**Given** um login válido,
**When** o usuário autentica,
**Then** recebe um par access/refresh token (`djangorestframework-simplejwt`) com `ACCESS_TOKEN_LIFETIME` ~30min e `REFRESH_TOKEN_LIFETIME` 7 dias, com `ROTATE_REFRESH_TOKENS=True` + `BLACKLIST_AFTER_ROTATION=True`,
**And** o middleware passa a setar o `current_user_id` no contextvar a partir do token autenticado (liga o isolamento da Story 1.2).

**Given** credenciais inválidas,
**When** o login é tentado,
**Then** a API responde `401` sem revelar se o email existe,
**And** um teste de isolamento confirma que um usuário recém-criado não enxerga dados de outro.

### Story 2.2: Sessão persistente, refresh single-flight e estados de auth no frontend

As a Hugo,
I want que minha sessão persista entre recarregamentos e se renove sozinha sem me deslogar,
So that eu nunca seja interrompido durante o uso ativo e só precise re-logar após real inatividade (FR-0.2, AR-5, UX-DR16).

**Acceptance Criteria:**

**Given** os tokens recebidos no login,
**When** o frontend os armazena,
**Then** ficam em `localStorage` (`access_token`/`refresh_token`) e o interceptor Axios anexa `Authorization: Bearer <access>` em toda requisição,
**And** ao recarregar a página a sessão é restaurada sem novo login.

**Given** várias requisições que tomam `401` simultaneamente,
**When** o token expira,
**Then** um único refresh **single-flight** é disparado (promise compartilhada), as requisições aguardam e fazem retry uma vez, e `401` no próprio refresh chama `logout()`,
**And** `logout()` limpa o `localStorage` e chama `queryClient.clear()`; um evento `storage` re-sincroniza/limpa as demais abas.

**Given** uma sessão expirada por inatividade > 7 dias,
**When** o usuário volta,
**Then** um banner não-bloqueante "Sessão expirada. Entre novamente." sobrepõe o conteúdo sem destruir o estado da UI,
**And** o erro de login é inline e discreto ("Email ou senha incorretos."), sem detalhes técnicos.

### Story 2.3: Casca de navegação autenticada (sidebar, bottom-nav, roteamento)

As a Hugo,
I want navegar entre as superfícies do app por uma sidebar no desktop e bottom-nav no mobile, com roteamento protegido,
So that eu acesse cada módulo do BuJo a partir de uma casca consistente e familiar (UX-DR7, UX-DR8, UX-DR17, NFR-1).

**Acceptance Criteria:**

**Given** o `AppLayout` no desktop (≥1024px),
**When** renderizado,
**Then** exibe a sidebar fixa (240px) com os itens (Hoje, Planner ▸ Esta Semana/Este Mês/Futuro, Hábitos, Saúde ▸ Métricas/Medicamentos, Gratidão, Brain Dump, Arquivo, separador, Configurações), grupos colapsáveis (Planner/Saúde), item ativo com borda 3px `brand-primary`, e toggle de colapso (ícones 56px) via botão e atalho `[`,
**And** a tela de cada superfície ainda não-implementada exibe um placeholder honesto (não erro).

**Given** o mobile (<768px),
**When** renderizado,
**Then** a sidebar fica oculta e aparece a bottom-nav com 4 abas (Hoje · Planner · Hábitos · Saúde) + FAB placeholder, acima da safe-area, sem drawer/hambúrguer,
**And** não há scroll horizontal de navegação em nenhuma superfície.

**Given** o roteamento,
**When** um usuário não autenticado acessa qualquer rota do app,
**Then** é redirecionado para Login (nenhuma rota acessível sem sessão),
**And** após autenticar o app abre no Daily Log de hoje (Hoje); o empilhamento de modal é limitado a 1 nível.

### Story 2.4: Baseline de acessibilidade WCAG 2.2 AA

As a Hugo,
I want que a casca e os padrões base do app respeitem WCAG 2.2 AA,
So that toda feature futura herde acessibilidade por padrão, não como remendo posterior (UX-DR20, NFR-1).

**Acceptance Criteria:**

**Given** os elementos interativos da casca,
**When** auditados,
**Then** o focus ring do MUI é preservado e visível, a tab order corresponde à ordem visual, `Esc` fecha o modal/popover mais recente e todo touch target no mobile tem ≥ 44px,
**And** cor nunca é o único indicador de estado/categoria (sempre acompanhada de ícone ou texto).

**Given** a semântica HTML,
**When** a casca é renderizada,
**Then** a sidebar usa `<nav aria-label="Navegação principal">`, a bottom-nav `<nav aria-label="Navegação mobile">`, o conteúdo `<main>` com `aria-label`, e modais `role="dialog"` + `aria-modal="true"` com foco travado,
**And** a mudança de superfície é anunciada via `aria-live="polite"`.

---

## Epic 3: Daily Log & Agregado de Tarefas

Hugo rastreia o dia de hoje. O agregado `Task` é congelado por completo aqui — incluindo as colunas de linhagem e a árvore de subtarefas — mesmo que o comportamento de migração só seja exercido no Épico 4.

### Story 3.1: Agregado `Task` com schema congelado e máquina de estados

As a desenvolvedor do projeto,
I want o model `Task` completo (incluindo colunas de linhagem e subtarefa) e a máquina de estados formal no service layer,
So that o agregado seja estável e testado, e o Épico 4 possa apenas consumir/transicionar sem alterar o schema (FR-1.3, FR-1.4, FR-1.5, AR-13, AR-14, AR-15).

**Acceptance Criteria:**

**Given** o app `bujo/` e o model `Task`,
**When** ele é definido,
**Then** herda `TenantModel` e tem: `log_id` (FK), `status` (`TextChoices` pending/started/completed/cancelled/migrated/postponed + `CheckConstraint`), `eisenhower` (ui/u/i/none, nullable), `order_index` (float), `title`, `description` (nullable), e — **congeladas agora, nuláveis/inertes** — `migrated_to_task_id` (self-FK), `migration_count` (default 0), `parent_task_id` (self-FK), `source_template_id` (nullable),
**And** existe o model de Daily Log chaveado por `(user_id, log_date DATE)`, materializado na primeira abertura via método de serviço idempotente.

**Given** a máquina de estados (AD-02),
**When** `bujo/services/state_machine.py` é implementado,
**Then** a matriz de transições é imposta no serviço: `pending↔started↔completed` via clique, `cancelled` via menu, `completed` reabre via clique, `cancelled` desfaz via edição; `migrated`/`postponed` são terminais e só atingíveis pelo fluxo de migração (não pelo clique),
**And** uma transição ilegal levanta `InvalidTransition` (→ 409), coberta por teste com 100% das transições da matriz.

**Given** a regra `/` e `\` formando X (FR-1.5),
**When** uma tarefa cicla,
**Then** iniciar marca `started` (`/`) e concluir marca `completed` (X visual),
**And** o `user_id` é auto-preenchido e toda query de `Task` é escopada por tenant.

### Story 3.2: Superfície do Daily Log com Task Row e ciclo de estados

As a Hugo,
I want ver o Daily Log de hoje com minhas tarefas e mudar o estado de cada uma com um clique,
So that eu acompanhe o andamento do meu dia de forma imediata e familiar (FR-1.1 Daily, FR-1.4, FR-1.5, UX-DR2, UX-DR5, UX-DR12, NFR-2).

**Acceptance Criteria:**

**Given** o Daily Log de hoje,
**When** a superfície é aberta,
**Then** exibe o Day Header (data "SEG, 15 JUN", contador de pendentes, chevron de colapso, `surface-header` tom-sobre-tom) e a lista de Task Rows na ordem manual,
**And** o carregamento usa skeleton e é percebido como instantâneo (< 2s, NFR-2) com prefetch via `useDailyData`.

**Given** uma Task Row,
**When** renderizada,
**Then** mostra borda lateral 3px da categoria, ícone de status clicável, título (tachado se cancelada), chip Eisenhower (quando atribuído) e chip de status, com cor sempre acompanhada de ícone/texto,
**And** clicar no ícone de status cicla Pendente → Iniciada → Concluída → (volta a Pendente), com resposta otimista e rollback em erro.

**Given** o estado vazio,
**When** não há tarefas,
**Then** exibe "Nenhuma tarefa para hoje. Adicione ou migre do dia anterior." (sem gamificação),
**And** no mobile a linha tem touch target ≥ 44px.

### Story 3.3: Criação e edição de tarefas com campos completos e subtarefas

As a Hugo,
I want criar e editar tarefas com título, descrição, Eisenhower e subtarefas,
So that eu capture o detalhe necessário de cada tarefa do meu dia (FR-1.3, AR-15).

**Acceptance Criteria:**

**Given** o Daily Log,
**When** Hugo adiciona uma tarefa (botão ou atalho `N`),
**Then** o título é obrigatório e descrição, Eisenhower e subtarefas são opcionais; salvar cria a `Task` com `status=pending` e `order_index` no fim da lista,
**And** Enter no campo de título salva e abre nova linha.

**Given** uma tarefa existente,
**When** Hugo abre o detalhe (clique no título → painel inline desktop / bottom sheet mobile),
**Then** pode editar título, descrição, categoria, Eisenhower e gerenciar subtarefas,
**And** uma subtarefa é criada como `Task` com `parent_task_id` apontando para a tarefa-pai (árvore auto-referencial), compartilhando o `log_id` do pai.

**Given** subtarefas de uma tarefa,
**When** exibidas,
**Then** aparecem aninhadas sob o pai e cada uma tem seu próprio ciclo de estados independente (sem cascata automática pai↔filho),
**And** concluir todos os filhos não conclui o pai automaticamente.

### Story 3.4: Ordenação manual de tarefas

As a Hugo,
I want reordenar manualmente as tarefas do log,
So that a ordem reflita minha intenção de execução, não um algoritmo (FR-1.6, UX-DR2).

**Acceptance Criteria:**

**Given** o Daily Log no desktop,
**When** Hugo arrasta uma tarefa pelo drag handle,
**Then** a posição é atualizada via `order_index` com linha horizontal indicando o destino, persistida no servidor,
**And** não há reordenação automática por nenhum algoritmo.

**Given** o mobile,
**When** Hugo faz long-press numa tarefa,
**Then** o menu de contexto oferece "Mover para..." com posição relativa (acima de / abaixo de) — sem drag-and-drop,
**And** a nova ordem persiste e é refletida ao reabrir o log.

---

## Epic 4: Logs de Planejamento, Migração & Recorrentes

Completa o ciclo BuJo — o marco de "abandono do caderno". Consome o agregado `Task` congelado do Épico 3 (não o altera). Histórias **estritamente ordenadas**.

### Story 4.1: Logs Weekly, Monthly e Future

As a Hugo,
I want acessar o Weekly Log, o Monthly Log e o Future Log,
So that eu planeje tarefas no horizonte certo, com a semântica de calendário correta (FR-1.1 W/M/F, FR-1.2, UX-DR9).

**Acceptance Criteria:**

**Given** os models de log de planejamento,
**When** implementados,
**Then** `weekly_log` é chaveado por `(user_id, week_start DATE)` com `CHECK` de que `week_start` é segunda-feira, e `monthly_log` por `(user_id, month_first DATE)` com `CHECK` de que é dia 1; o pertencimento a mês/ano é derivado na leitura (nunca ordinal duplicado),
**And** as superfícies usam `week_start_of`/`weeks_of_month`/`months_of_week` de `core/calendar.py`.

**Given** o Future Log,
**When** Hugo adiciona um item,
**Then** aceita data completa (mês + dia, ex.: prefixo `(14)`) ou parcial (só mês, exibida "— jul"),
**And** os itens são agrupados por mês ("Julho 2026") e consultáveis por período.

**Given** o Weekly Log no mobile,
**When** aberto,
**Then** exibe um dia por vez com seletor de dia horizontal (sem scroll horizontal); no desktop exibe os 7 dias quando a viewport permite,
**And** o Monthly Log no mobile é lista vertical de datas (sem grid de calendário).

### Story 4.2: Migração diária com Migration Card e linhagem

As a Hugo,
I want revisar as tarefas pendentes de ontem uma a uma e decidir o destino de cada,
So that nenhuma tarefa se mova sem minha decisão explícita, preservando a fricção intencional do método (FR-1.7, AR-14, UX-DR3).

**Acceptance Criteria:**

**Given** a abertura do dia com tarefas `pending`/`started` de ontem,
**When** o Daily Log carrega,
**Then** um banner informa "N tarefas pendentes de ontem. Iniciar migração?" com botão "Iniciar" — sem iniciar automaticamente,
**And** iniciar abre o Fluxo de Migração (modal overlay no desktop / full-screen no mobile) com um Migration Card por tarefa.

**Given** um Migration Card,
**When** exibido,
**Then** mostra título, descrição e subtarefas, indicador "N de M revisadas" (`aria-live=polite`) e 4 ações (Migrar para hoje / Adiar no mês / Adiar no futuro / Cancelar), nenhuma pré-selecionada, com atalhos `1`–`4` e `Esc` pausa (retomável),
**And** "Adiar no mês/futuro" abrem picker com confirmação automática (sem botão extra).

**Given** uma decisão de migração,
**When** Hugo escolhe um destino,
**Then** o registro original fica `status=migrated` com `migrated_to_task_id` apontando para o novo registro (`status=pending` no destino) e `migration_count` incrementado; migrar um pai recria no destino a subárvore de filhos ainda não-dispostos (concluídos/cancelados ficam na origem),
**And** o fluxo nunca é encerrado pelo sistema — só Hugo decide quando terminar.

### Story 4.3: Revisão semanal/mensal e pull automático do Future Log

As a Hugo,
I want revisar as pendências da semana/mês anterior e receber os itens do Future Log do mês corrente,
So that a virada de semana e de mês aconteça com julgamento explícito e sem perder o que planejei (FR-1.8, FR-1.9, FR-1.10).

**Acceptance Criteria:**

**Given** um Weekly Log anterior com tarefas sem disposição,
**When** Hugo abre o app (gatilho por condição, não por data — uma segunda pulada ainda dispara na quarta),
**Then** um banner "Semana anterior tem N tarefas sem disposição. Revisar?" oferece o fluxo de migração semanal,
**And** uma semana é marcada **fechada** quando todas as suas tarefas têm disposição (considerando a subárvore: pai com filho pendente não fecha).

**Given** a abertura do mês (1ª semana),
**When** há um Monthly Log anterior com pendências,
**Then** o fluxo apresenta cada tarefa para decisão (migrar com data / adiar no futuro / cancelar),
**And** o sistema puxa automaticamente os itens do Future Log com destino no mês corrente para uma seção "Itens do Future Log para [mês]" no topo do Monthly Log, com data definida ou "data a definir", aguardando confirmação de Hugo.

### Story 4.4: Catch-Up de dias pulados

As a Hugo,
I want, ao voltar depois de pular vários dias, reconciliar as tarefas não-dispostas num único fluxo,
So that uma ausência seja um evento de reencontro, não N migrações de procrastinação (FR-1.7 generalizado, AR-19/AD-09).

**Acceptance Criteria:**

**Given** tarefas `pending`/`started` em logs com data < hoje após dias pulados,
**When** Hugo reabre o app,
**Then** a detecção é por **query** (sem cron, sem fila acumulada) e o mesmo Fluxo de Migração apresenta as tarefas, na ordem hierárquica **mês → semana → dia**,
**And** cada tarefa migrada incrementa `migration_count` em **1** por decisão (não por dia de calendário pulado).

**Given** os dias pulados,
**When** o catch-up roda,
**Then** esses dias permanecem como lacunas honestas (sem linhas materializadas, fora de qualquer denominador) — nunca 0% fabricado,
**And** o catch-up cobre **somente tarefas**; preencher hábitos/saúde de um dia pulado usa o caminho normal de navegar até o dia.

### Story 4.5: Templates de tarefas recorrentes com placement manual

As a Hugo,
I want cadastrar tarefas recorrentes como templates e decidir manualmente onde cada uma entra a cada ciclo,
So that o juízo de placement permaneça comigo, sem auto-placement (FR-1.11, FR-1.12, AR-15).

**Acceptance Criteria:**

**Given** a tela Configurações > Recorrentes,
**When** Hugo cria um template,
**Then** é gravado em `recurring_task_templates` (separado de `tasks`, sem `status`/`log_id`/ciclo de vida) com título, descrição, eisenhower, `recurrence_group` (weekly/monthly/annual), `recurrence_text` (texto livre, **não parseado**) e `active` (booleano simples),
**And** o template é sempre plano (sem subtarefas).

**Given** a abertura de um ciclo,
**When** o app apresenta os recorrentes ativos do período,
**Then** lista os templates com botão "Definir placement" — sem auto-placement,
**And** colocar um recorrente cria uma `Task` snapshot (copiando os campos do template no instante) com `source_template_id` apontando para a origem, `status=pending`, `parent_task_id=NULL` e `migration_count=0`.

**Given** uma instância colocada e seu template,
**When** qualquer um é editado depois,
**Then** editar a instância toca só aquela `Task`; editar o template afeta só placements **futuros** (instâncias passadas intactas).

### Story 4.6: Fechamento de ciclos e Arquivo

As a Hugo,
I want que semanas e meses fechados fiquem consultáveis no arquivo com o estado final de cada tarefa,
So that eu tenha o histórico auditável que é o valor central do BuJo (FR-1.10, FR-1.13).

**Acceptance Criteria:**

**Given** um ciclo (semana/mês) em que todas as tarefas têm disposição,
**When** a condição de fechamento é avaliada,
**Then** o ciclo é marcado "Fechado" (texto, sem ícone celebratório) considerando a subárvore completa de cada tarefa,
**And** o ciclo fechado passa a aparecer no Arquivo (fechamento computado na leitura — o registro não é movido; continua acessível pela navegação normal e passa a ser listado no Arquivo também).

**Given** a superfície Arquivo,
**When** Hugo a acessa,
**Then** lista semanas e meses fechados, consultáveis com o estado final de cada tarefa e o que foi feito com ela (incl. linhagem de migração),
**And** o estado vazio exibe "Nenhuma semana ou mês fechado ainda."

---

## Epic 11: Refinamento do Planner & Recorrentes

Refinamentos identificados em uso após o Épico 4 (origem: `docs/futureIdeas.md`). Consome o que o Épico 4 entregou; não redesenha o ciclo BuJo. Histórias ordenadas por dependência: (1) isolamento de teste → (2) Recorrentes no Planner → (3) placement + calendário de densidade *(constrói o calendário compartilhado)* → (4) anuais no Future Log *(reusa o placement)* → (5) CRUD em Semana/Mês → (6) mover/migrar de qualquer lugar *(reusa o calendário da 11.3)*. **2º lote (Correct Course 2026-07-15, reabertura pós-retro): → (7) edição de tarefa persiste *(bug da 11.5)* → (8) infos da recorrência no modal de placement *(bug da 11.3)* → (9) polimento visual dos cards + grid da semana → (10) seletor Mover/Migrar completo *(abas Hoje/Semana/Mês/Futuro, botão explícito; reformula o da 11.6, reusa o calendário)* → (11) navegar/agir em logs passados não-fechados *(reusa as páginas por rota)*.** Número 11 é só identificador; executa antes do Épico 5.

### Story 11.1: Isolamento de teste via branch Neon dedicada

As a desenvolvedor do projeto,
I want que os testes E2E rodem contra uma branch Neon dedicada em vez da branch de dev,
So that os testes parem de criar/apagar registros no banco onde eu de fato uso o app (item #1 de `futureIdeas.md`).

**Acceptance Criteria:**

**Given** a configuração de E2E (Playwright, que sobe `manage.py runserver`),
**When** o backend é iniciado para os testes,
**Then** ele usa um `DATABASE_URL` próprio (ex.: `.env.e2e`) apontando para uma branch Neon dedicada `e2e`, isolada da branch de dev,
**And** os specs E2E existentes passam sem alteração de lógica — só a origem do banco muda.

**Given** a branch `e2e` acumulando estado entre execuções,
**When** eu quero limpá-la,
**Then** existe um comando/runbook de reset documentado (não precisa ser automático por run enquanto não houver CI rodando E2E).

**Given** os 200+ usuários de teste órfãos já acumulados na branch de dev,
**When** esta story é concluída,
**Then** eles são removidos da branch de dev (limpeza one-shot) e novas execuções de teste não criam mais registros ali.

### Story 11.2: Recorrentes no Planner com abas e filtro

As a Hugo,
I want gerenciar meus templates recorrentes dentro do Planner, organizados por tipo e com filtro de ativos,
So that eu os encontre junto do resto do planejamento em vez de perdidos em Configurações (itens #2, #3).

**Acceptance Criteria:**

**Given** a navegação do Planner,
**When** acesso a aba "Recorrentes",
**Then** vejo a gestão de templates (o CRUD já existente da Story 4.5) ali,
**And** a gestão deixa de existir em Configurações (que volta a placeholder / settings de conta).

**Given** a tela de Recorrentes,
**When** ela carrega,
**Then** os templates são organizados em abas por grupo (Semanal / Mensal / Anual),
**And** um controle "mostrar inativos" inclui/exclui templates com `active=false` (padrão: só ativos).

### Story 11.3: Placement de recorrentes — dedup + modal com calendário de densidade

As a Hugo,
I want que, ao colocar um recorrente, ele suma da lista do período e que o modal me mostre a recorrência e a densidade de tarefas do mês,
So that eu não coloque o mesmo recorrente sem querer e decida melhor onde encaixá-lo (itens #4, #5).

**Acceptance Criteria:**

**Given** a lista de recorrentes a colocar em Esta Semana / Este Mês,
**When** coloco um template naquele período,
**Then** ele some da lista de sugestões daquele período,
**And** se eu precisar de outra ocorrência (ex.: "3x por semana", já que `recurrence_text` é texto livre não-parseado), há um caminho explícito para recolocar — sem bloqueio rígido de duplicado.

**Given** o modal de placement,
**When** ele abre,
**Then** mostra as informações da recorrência (título, descrição, `recurrence_text`),
**And** mostra um calendário do mês com indicador de quantas tarefas já existem em cada dia (densidade), apenas informativo.

**Given** o calendário de densidade,
**Then** é construído como componente reutilizável, para ser reaproveitado no fluxo de mover tarefa (Story 11.6) — tocar num dia pode selecioná-lo; se o clique no calendário custar muito, ele apenas exibe densidade e a seleção fica num date-picker à parte.

### Story 11.4: Anuais pendentes consultáveis e colocáveis no Future Log

As a Hugo,
I want ver e colocar, direto do Future Log e o ano todo, os recorrentes anuais ainda não colocados no ano,
So that eu não perca anuais só porque não abri o ciclo de janeiro (item #6).

**Acceptance Criteria:**

**Given** o Future Log,
**When** ele carrega,
**Then** exibe uma seção "Anuais pendentes de [ano]" listando os templates de grupo `annual` que ainda não foram colocados neste ano.

**Given** essa seção,
**When** coloco um anual dali,
**Then** o placement acontece reusando o fluxo da Story 11.3,
**And** o item some da seção ao ser colocado.

**Given** um ano em que todos os anuais já foram colocados (ou não há anuais),
**Then** a seção não aparece (sem estado vazio ruidoso).

*Nota de escopo:* revoga a decisão da Story 4.5 de anuais aparecerem apenas na abertura do ciclo de janeiro.

### Story 11.5: CRUD de tarefas em Esta Semana / Este Mês

As a Hugo,
I want criar, editar e remover tarefas direto nas telas Esta Semana e Este Mês,
So that eu planeje semana/mês sem depender do Daily Log ou de um fluxo de migração (itens #7, #8).

**Acceptance Criteria:**

**Given** a tela Esta Semana,
**When** adiciono uma tarefa,
**Then** posso atribuí-la a um dia específico da semana (ou deixá-la sem dia); a tela Este Mês permite adicionar ao mês.

**Given** uma tarefa em Semana/Mês,
**When** a edito,
**Then** posso alterar seus campos (título, descrição, eisenhower etc.), igual ao Daily Log.

**Given** uma tarefa `pending` sem linhagem de migração,
**When** a removo,
**Then** posso excluí-la permanentemente (hard delete); tarefas com histórico/linhagem só podem ser canceladas (`status=cancelled`), preservando a semântica BuJo.

**Given** ciclos já fechados (Arquivo),
**Then** continuam somente-leitura (sem CRUD).

### Story 11.6: Mover/migrar tarefa de qualquer superfície (destino dia-ou-mês)

As a Hugo,
I want mover (migrar/adiar) qualquer tarefa — do Daily Log, Semana, Mês ou Futuro — para um dia específico ou para um mês/futuro,
So that eu reorganize o "quando" de qualquer tarefa em qualquer direção, antecipando ou adiando (item #9).

**Acceptance Criteria:**

**Given** uma tarefa em qualquer superfície,
**When** aciono "Mover" pelo kebab do TaskRow ou pelo painel de detalhe,
**Then** abre um seletor de destino.

**Given** o seletor de destino,
**When** escolho o destino,
**Then** posso apontar um dia específico (hoje ou qualquer dia — o app deduz a semana a partir da data) usando o calendário de densidade da Story 11.3, ou um mês (este/futuro),
**And** mover "para esta semana" sempre exige apontar o dia (não há balde de semana sem dia).

**Given** a movimentação executada,
**Then** a regra de estado atual é mantida — destino dia (hoje / dentro de semana) → origem vira `migrated`; destino mês/futuro → origem vira `postponed`,
**And** a linhagem (`migration_count`) é incrementada como já ocorre hoje.

**Given** o serviço de backend,
**Then** `migrate_task` passa a aceitar `scheduled_date` para destinos dentro de semana (hoje / dia específico), estendendo o serviço existente sem duplicá-lo.

*Fora de escopo (registrado):* granularidade fina de "próxima semana" como bucket próprio; exibir o destino da migração (`migrated_to_task`) na UI — a contagem `↻ N×` já entregue basta por ora.

---

> **2º lote do Épico 11 — reabertura via Correct Course (2026-07-15).** As Stories 11.7–11.11 abaixo nascem de bugs/melhorias identificados em uso após o fechamento do 1º lote (11.1–11.6). Origem: `docs/futureIdeas.md` + feedback direto do Hugo. Ver `sprint-change-proposal-2026-07-15.md`. Decisões de spec correlatas (Mover para Hoje, balde de semana sem dia no seletor, botão explícito de Migrar, navegação de logs passados abertos) em **AD-16**.

### Story 11.7: Edição de tarefa persiste em Esta Semana / Este Mês

As a Hugo,
I want que a edição de uma tarefa em Esta Semana/Este Mês seja de fato salva,
So that as alterações não se percam ao fechar o painel (corrige bug da Story 11.5: edição não persiste, sem ação clara de salvar).

**Acceptance Criteria:**

**Given** uma tarefa em Esta Semana/Este Mês que eu edito (título, descrição, eisenhower, categoria, etc.),
**When** confirmo a edição,
**Then** a alteração é persistida via a mutação de update já existente (`PATCH`/`useUpdateTaskMutation`) e refletida na tela após a invalidação.

**Given** o painel/formulário de edição,
**Then** há um caminho explícito de salvar (botão "Salvar" ou salvamento no submit) — fechar o painel/aba **não** é o gatilho de persistência.

**Given** o Daily Log (onde a edição já funcionava),
**Then** não há regressão — o mesmo padrão de salvar vale para todas as superfícies.

*Nota:* investigar se o gap é só de fiação no frontend (provável — o `PATCH` já existe desde a 11.5) antes de assumir mudança de backend/contrato.

### Story 11.8: Infos da recorrência no modal de placement

As a Hugo,
I want ver as informações da recorrência (descrição, categoria, Eisenhower, `recurrence_text`) no modal de placement,
So that eu decida o encaixe com contexto completo (corrige bug da Story 11.3: o modal não exibe esses campos).

**Acceptance Criteria:**

**Given** o modal de placement de um recorrente (`RecurringPlacementDialog`, Story 11.3),
**When** ele abre,
**Then** exibe descrição, categoria, etiqueta Eisenhower e `recurrence_text` do template, além do que já mostra (título + calendário de densidade).

**Given** um template sem algum desses campos (nuláveis),
**Then** o campo ausente simplesmente não aparece (sem placeholder ruidoso).

### Story 11.9: Polimento visual dos cards de tarefa e grid da semana

As a Hugo,
I want cards de tarefa mais legíveis e uma semana menos apertada,
So that o Planner fique mais claro no uso diário.

**Acceptance Criteria:**

**Given** um card de tarefa (`TaskRow`) com descrição — em qualquer superfície, **incluindo os recorrentes**,
**Then** exibe a descrição (truncada, ex.: 1 linha) abaixo do título.

**Given** a tela Esta Semana,
**Then** os 7 dias são dispostos em **duas linhas** (não uma só apertada).

**Given** um card de tarefa,
**When** passo o mouse,
**Then** há um estado de **hover** perceptível.

**Given** cards largos que se estendem de lado a lado da tela,
**Then** o conteúdo fica visualmente **coeso** — chips/ações mais próximos do título, com largura máxima/centralização evitando que os controles fiquem distantes do texto.

*Nota:* mudanças de estilo/layout; sem mudança de dados/contrato.

### Story 11.10: Seletor Mover/Migrar completo (abas Hoje / Semana / Mês / Futuro, botão explícito)

As a Hugo,
I want um seletor de mover/migrar com destinos claros e uma ação de confirmar,
So that eu reorganize o "quando" de qualquer tarefa com controle — incluindo trazer para o **Daily Log de hoje** — sem disparos acidentais (reformula o seletor da Story 11.6, absorve o destino "Hoje" antes planejado, e corrige o bug de não funcionar em Esta Semana).

**Acceptance Criteria:**

**Given** o seletor de mover (`TaskDestinationDialog`) aberto para uma tarefa `pending`/`started`, com título **"Migrar Tarefa"** e as **informações da tarefa** (título, descrição, data/onde ela está hoje),
**Then** apresenta quatro destinos:
- **Hoje** → cria no **Daily Log de hoje** (container `log`, `destination='today'`; usa o destino que hoje só o ritual de fim-de-dia aciona — sem endpoint/coluna novos);
- **Esta semana** → calendário de densidade do mês; posso escolher um **dia específico** (→ `scheduled_date`) **ou** alocar na **semana sem data certa** (→ `weekly_log` corrente, `scheduled_date` nulo — backend já suporta);
- **Este mês** → um **dia específico** do mês **ou** o **mês sem data** (comportamento do `MigrationCard`);
- **Futuro** → como já está (mês + dia opcional).

**Given** qualquer destino,
**Then** a ação **só dispara ao clicar em "Migrar"** — preencher/selecionar não migra sozinho (reverte o auto-fire da Story 11.6 **apenas para este seletor**; o `MigrationCard` de fim-de-dia mantém a confirmação automática dos pickers, UX-DR3 inalterado).

**Given** o calendário de densidade dentro do seletor,
**Then** destaca visualmente **o dia de hoje e a semana atual**, e **clicar num dia preenche o campo de data** (não migra imediatamente) — liga `onSelectDay`/`selectedDate` para seleção, não para submit.

**Given** uma tarefa em **Esta Semana**,
**Then** o seletor abre e funciona (corrige o bug da 11.6 nessa superfície).

**Given** a movimentação confirmada,
**Then** estado/linhagem se mantêm: destino dia/hoje → origem `migrated`; destino mês/futuro → origem `postponed`; alocar sem data segue a regra do destino; `migration_count` incrementa — sem mudança de contrato além do que a 11.6 já entregou. (Decisões de "Hoje", balde-sem-dia e botão explícito registradas em **AD-16**.)

*Story mais parruda do lote — pode ser quebrada em subtarefas na dev-story.*

### Story 11.11: Navegar e agir em logs passados não-fechados

As a Hugo,
I want navegar para semanas, meses e dias passados que **ainda não fecharam** e agir sobre suas pendências,
So that pendências de períodos passados abertos não fiquem presas — hoje o Arquivo lista só fechados e não há navegação para alcançá-las; só os rituais de revisão/catch-up as expõem (item #9 e a "Aba de Histórico" do `futureIdeas.md`).

**Acceptance Criteria:**

**Given** as telas Esta Semana / Este Mês,
**When** navego para trás (controle anterior/próximo ou seletor de data),
**Then** vejo o período passado correspondente mesmo **não-fechado**, reusando as páginas que já renderizam período por rota (`weekStart`/`monthFirst`) — backend já serve via `week_start`/`month_first`, sem mudança.

**Given** o Daily Log de um dia passado,
**Then** também é navegável — **única adição de backend** desta story: uma leitura de daily log por data (hoje `TodayLogView` é fixo em "hoje"), sem novo modelo.

**Given** um período passado **não-fechado** (tem `pending`/`started`),
**Then** posso agir sobre suas tarefas — inclusive "Migrar" (Story 11.10) — normalmente; o guardrail `_check_container_open` (Story 11.5) só bloqueia períodos **fechados**, então passado aberto permanece acionável sem código de permissão novo.

**Given** um período passado **fechado**,
**Then** segue somente-leitura (Arquivo, Story 4.6) — sem regressão.

**Given** a navegação para trás,
**Then** há distinção visual entre período atual, passado aberto e fechado (read-only), e um caminho de volta ao hoje/período atual.

*Fora de escopo (registrado):* a aba "Histórico" unificada completa (superfície única de navegação de todos os logs) — esta story entrega a navegação livre para trás; a superfície dedicada fica registrada para depois.

---

## Epic 5: Brain Dump & Captura Rápida (Fase 1b)

A válvula de escape do sistema, especialmente no mobile. Caixa de entrada sem data, indicador persistente como server state derivado e processamento manual.

### Story 5.1: Caixa de entrada do Brain Dump e processamento manual

As a Hugo,
I want uma caixa de entrada sem data onde capturo itens e depois os movo para o log correto ou descarto,
So that eu tenha um lugar honesto para pensamentos soltos, sem inseri-los direto num dia que não posso planejar agora (FR-5.1, FR-5.2, FR-5.3).

**Acceptance Criteria:**

**Given** o app `braindump/` e seu model,
**When** implementado,
**Then** o item herda `TenantModel` com `title` (obrigatório), `description` (opcional) e `target_log` (opcional); o estado normal da caixa é vazio,
**And** a superfície Brain Dump (item da sidebar) lista os itens pendentes e exibe "Brain Dump vazio." quando não há itens.

**Given** um item no Brain Dump,
**When** Hugo o processa,
**Then** pode movê-lo para um log de destino (criando a `Task` correspondente) ou descartá-lo — sem migração automática,
**And** após processar/descartar, o item sai da caixa.

**Given** a captura no desktop,
**When** Hugo aciona o atalho `B` ou o item da sidebar,
**Then** abre o formulário de captura (título obrigatório, descrição e destino opcionais, destino default = Brain Dump),
**And** salvar persiste o item escopado por tenant.

### Story 5.2: Indicador persistente como server state derivado

As a Hugo,
I want um badge numérico persistente enquanto o Brain Dump tiver itens,
So that eu nunca esqueça que há algo aguardando processamento (FR-5.4, AR-20).

**Acceptance Criteria:**

**Given** o endpoint de contagem,
**When** implementado,
**Then** existe `GET /api/brain-dump/count` leve, consumido via TanStack Query com chave `['brainDump','count', userId]`, ativo no app inteiro,
**And** o badge aparece no item Brain Dump da sidebar (visível mesmo colapsada) e no FAB mobile, e desaparece quando a caixa está vazia.

**Given** uma mutação no Brain Dump (capturar/processar/descartar),
**When** ela completa,
**Then** invalida a chave `['brainDump','count', userId]` e o badge atualiza sozinho em todas as superfícies (sem store de cliente),
**And** a captura faz incremento otimista do badge com rollback em erro.

**Given** o `aria-label` do badge,
**When** a contagem muda,
**Then** é atualizado com a contagem atual (ex.: "Brain Dump: 3 itens pendentes"),
**And** dois usuários em navegadores distintos têm caches isolados (a invalidação de um nunca afeta o outro).

### Story 5.3: Captura rápida no mobile via FAB e Capture Sheet

As a Hugo fora de casa,
I want capturar um item rapidamente pelo FAB no celular,
So that eu registre algo importante em trânsito sem planejar nada agora (UJ-4, FR-5.2, UX-DR6, NFR-1).

**Acceptance Criteria:**

**Given** o mobile,
**When** Hugo toca o FAB (sempre visível, 52×52px, canto inferior direito),
**Then** o Capture Sheet sobe como bottom sheet com o campo de título já em foco (teclado aberto), descrição opcional e select de destino (Brain Dump / Hoje / Esta Semana / Este Mês / Futuro, default Brain Dump),
**And** salvar (botão ou Enter no último campo) fecha o sheet e atualiza o badge se o destino for Brain Dump.

**Given** o Capture Sheet aberto,
**When** Hugo faz swipe-down ou `Esc`,
**Then** fecha sem salvar, com confirmação de descarte apenas se o título foi preenchido,
**And** nenhuma ação do fluxo de captura exige scroll horizontal.

**Given** ausência de conexão (MVP sem offline),
**When** Hugo está sem rede,
**Then** o FAB fica desabilitado com tooltip "Sem conexão" e o Capture Sheet não abre,
**And** nenhuma captura é perdida silenciosamente.

---

## Epic 6: Sistema de Hábitos

Hugo configura hábitos, marca o tracker diário e acompanha a completude ponderada com snapshot imutável. Ordem interna: config → tracker/snapshot → multiplicador → gráfico (lê snapshots, por último).

### Story 6.1: Configuração de hábitos e grupos

As a Hugo,
I want criar e ajustar hábitos organizados em grupos, com peso, tipo e (para numéricos) meta e bonus, podendo desativar e reativar,
So that eu modele meu sistema de hábitos como faço hoje, com mudanças honestas com o passado (FR-2.1, FR-2.2, FR-2.3, FR-2.5, FR-2.7, FR-2.8, UJ-8).

**Acceptance Criteria:**

**Given** a tela Configurações > Hábitos,
**When** Hugo cria um hábito,
**Then** define nome, emoticon, grupo (de `habit_groups`), tipo (booleano/numérico) e peso inicial; para numérico define também meta e bonus de completude (%),
**And** o hábito é gravado com identidade (`type` imutável após criação) e a configuração inicial vira a primeira `habit_version` (`weight`, `active`, `meta`, `bonus`, `effective_from`).

**Given** um hábito existente,
**When** Hugo altera o peso (ou meta/bonus),
**Then** uma nova `habit_version` com `effective_from = hoje` é inserida — a alteração vale a partir do dia corrente, com tooltip "Alteração válida a partir de hoje. Registros anteriores preservados.",
**And** dias passados já materializados não são afetados (NFR-4).

**Given** um hábito ativo,
**When** Hugo o desativa,
**Then** uma nova versão `active=false` é inserida; o hábito some do log ativo mas permanece no histórico (nunca deletado),
**And** reativar insere versão `active=true`, fazendo-o reaparecer a partir do dia da reativação.

### Story 6.2: Tracker diário com snapshot imutável e completude ponderada

As a Hugo,
I want marcar meus hábitos do dia e ver o percentual de completude ponderado,
So that eu acompanhe minha consistência sem que mudanças futuras alterem o passado (FR-2.4, FR-2.5, FR-2.6, AR-16, UX-DR4).

**Acceptance Criteria:**

**Given** a primeira abertura do dia D,
**When** o tracker é carregado,
**Then** o serviço idempotente `seed_habit_day(*, user, date)` materializa uma linha em `habit_day_entries` por hábito **ativo em D**, semeando `weight_at_time`/`meta_at_time`/`bonus_at_time` da versão vigente em D, com `value` nulo,
**And** dias pulados abertos depois são semeados com a versão vigente **naquele dia**, não a de hoje.

**Given** o Habit Tracker Row,
**When** exibido,
**Then** hábitos aparecem agrupados (cabeçalho com nome do grupo e percentual ponderado do grupo); booleano = checkbox, numérico = campo + unidade + % da meta (ex.: "2.500 / 5.000 passos (50%)"), com touch target ≥ 44px,
**And** marcar um hábito grava em `value` com resposta otimista, sem troféus/sequências.

**Given** a completude do dia,
**When** calculada,
**Then** segue `Σ(contribuição × peso) / Σ(peso dos ativos em D)` sobre as linhas de `habit_day_entries` (booleano não-marcado = 0 e conta no denominador; inativo = fora do denominador),
**And** corrigir o valor/peso de um dia passado é UPDATE só naquela linha (não sangra para vizinhos), e o widget do tracker é acoplado ao fluxo da manhã no Daily Log.

### Story 6.3: Multiplicador de peso por tipo de dia

As a Hugo,
I want que hábitos de um grupo tenham peso ajustado por tipo de dia (fim de semana/feriado),
So that minha completude reflita que certos hábitos importam menos em certos dias (FR-2.4, AR-17/AD-10).

**Acceptance Criteria:**

**Given** um grupo de hábitos,
**When** Hugo configura multiplicadores,
**Then** `habit_group_day_multipliers` guarda multiplicador por `(grupo, day_type ∈ {weekend, holiday})` com `effective_from` (prospectivo); `weekday` é implicitamente 1.0,
**And** feriados são marcados manualmente por data em `user_holidays` (presença = feriado).

**Given** a materialização do dia D,
**When** roda,
**Then** resolve `day_type(D)` com precedência `holiday > weekend > weekday` (sem acumular) e congela `day_type` + `multiplier_at_time` em `habit_day_entries`, separados do `weight_at_time` base,
**And** a completude passa a usar `peso_efetivo = weight_at_time × multiplier_at_time` no numerador e denominador.

**Given** um ajuste de multiplicador ou toggle de feriado,
**When** aplicado,
**Then** alterar o multiplicador do grupo só afeta dias abertos daqui em diante (dias congelados intactos); marcar/desmarcar feriado recalcula só aquele dia,
**And** um override avulso de `multiplier_at_time` de um único dia ("nesse sábado eu trabalhei") não sangra para vizinhos.

### Story 6.4: Histórico por data e gráfico de evolução

As a Hugo,
I want consultar meus hábitos por data e ver um gráfico de evolução com as mudanças reais anotadas,
So that eu entenda minha trajetória sem confundir mudança de configuração com ritmo de fim de semana (FR-2.9, FR-2.10, AR-11/AD-11).

**Acceptance Criteria:**

**Given** o histórico por data,
**When** Hugo seleciona uma data,
**Then** exibe os hábitos e valores daquele dia a partir de `habit_day_entries` (snapshot imutável),
**And** dias pulados aparecem como lacunas honestas, nunca 0% fabricado.

**Given** o gráfico de evolução por hábito,
**When** renderizado,
**Then** a série diária é derivada on-read de `habit_day_entries` (valor, peso efetivo) e as **mudanças reais** (peso/meta/bonus/ativação) são anotadas como marcadores datados discretos a partir do stream de `habit_versions`, com o diff no hover (ex.: "Exercício 3 → 4"),
**And** o multiplicador de tipo de dia é representado como ritmo/sombreamento (queda nos sábados), **nunca** como marcador de mudança.

**Given** a ordem de implementação,
**When** esta história roda,
**Then** depende dos snapshots já materializados pela Story 6.2 e da timeline de versões da Story 6.1/6.3,
**And** não há série materializada separada (derivada on-read, coerente com AD-14).

---

## Epic 7: Métricas de Saúde

Hugo cria campos de saúde dinâmicos (JSONB), preenche o log diário e consulta o histórico em três visualizações.

### Story 7.1: Campos de saúde dinâmicos

As a Hugo,
I want criar e gerenciar meus próprios campos de métrica de saúde,
So that eu rastreie exatamente o que importa para mim, com o conjunto evoluindo no tempo (FR-3.1, AR-7).

**Acceptance Criteria:**

**Given** a tela Configurações > Métricas de Saúde,
**When** Hugo cria um campo,
**Then** `health_field_definitions` grava nome, `field_type` (inteiro/decimal/booleano/enum/texto), `active` e `display_order`, escopado por tenant,
**And** campos não são deletados — apenas desativados (preservados no histórico).

**Given** um campo enum,
**When** criado,
**Then** suas opções são definidas pelo usuário,
**And** a definição é a fonte de verdade para tipar/validar/renderizar o campo na leitura e escrita.

### Story 7.2: Log diário de saúde

As a Hugo,
I want preencher minhas métricas de saúde do dia (tipicamente de manhã, revisando ontem),
So that eu mantenha meu registro de saúde com validação correta por tipo (FR-3.2, AR-7, UX-DR10).

**Acceptance Criteria:**

**Given** o log diário de saúde,
**When** Hugo o preenche,
**Then** os valores são gravados em `health_logs.values` (JSONB indexado por UUID do campo) após validação na camada de serviço contra `health_field_definitions` (grava só se tudo válido),
**And** as chaves JSONB dinâmicas **não** são convertidas para camelCase em nenhuma direção (round-trip idempotente).

**Given** o ritual matinal,
**When** a superfície Saúde > Métricas abre no período da manhã,
**Then** os campos de ontem aparecem no topo com rótulo "Ontem, [data]" e os de hoje logo abaixo (acoplado ao fluxo da manhã),
**And** campos inativos não aparecem no log ativo mas seus valores históricos são preservados.

**Given** o input de cada campo,
**When** renderizado (Health Metric Row),
**Then** usa o controle correspondente ao tipo (inteiro/decimal com teclado numérico no mobile, booleano toggle, enum select, texto),
**And** salvar mostra confirmação inline discreta ("Dados de ontem salvos.").

### Story 7.3: Histórico de saúde em três visualizações

As a Hugo,
I want consultar meu histórico de saúde em tabela, gráficos e dashboard de período,
So that eu acompanhe a evolução das minhas métricas ao longo do tempo (FR-3.3).

**Acceptance Criteria:**

**Given** a visualização em tabela,
**When** Hugo a acessa,
**Then** exibe os valores de cada campo por data (dia a dia),
**And** respeita as definições de campo para tipar cada coluna.

**Given** os gráficos de evolução,
**When** Hugo seleciona um campo numérico,
**Then** a série é derivada via cast explícito do JSONB (`(values->>'uuid')::numeric`) ao longo do tempo,
**And** o dashboard de período resume as métricas de um intervalo selecionado.

**Given** o escopo de performance,
**When** estas visualizações carregam,
**Then** não há NFR formal de < 2s (modo de revisão histórica, AD-14) — a latitude de otimização (índices, view materializada) fica reservada,
**And** as queries são escopadas por tenant.

---

## Epic 8: Medicamentos

Hugo gerencia medicamentos com modelo versionado (slot estável + substância/agenda) e confirma a adesão diária por bloco ou individual, com distinção de dose perdida. Domínio independente de Saúde (sem FK).

### Story 8.1: Cadastro de medicamentos com slot estável e versões

As a Hugo,
I want cadastrar medicamentos como slots estáveis cuja substância, laboratório, médico e dose por bloco variam no tempo,
So that meu histórico de adesão continue contínuo mesmo quando o médico troca o remédio ou a dose (FR-3.4, FR-3.5, FR-3.7, AR-18/AD-07).

**Acceptance Criteria:**

**Given** a tela Configurações > Medicamentos,
**When** Hugo cadastra um medicamento,
**Then** `medications.title` guarda o slot estável ("Remédio de pressão") e `medication_substance_versions` guarda o produto vigente (substância, laboratório, `prescribed_by` → `doctors`) com `effective_from`,
**And** `time_blocks` são dinâmicos por usuário (nome, ordem, `active`) — sem ENUM — e podem ser criados sem migração de schema.

**Given** a agenda de doses,
**When** Hugo a define,
**Then** `medication_schedule_versions` guarda, por `(medicamento, bloco)`, a `dose` como JSONB multi-componente (`[{label, amount, unit}]`, validado na camada de serviço), `active` e `effective_from` — permitindo doses diferentes em blocos diferentes,
**And** trocar só a dose insere nova versão de agenda; trocar a substância/laboratório insere nova versão de substância (eixos independentes).

**Given** a desativação,
**When** Hugo desativa uma agenda,
**Then** o ativo/inativo vive nas versões (sem coluna `active` em `medications`) e o histórico de confirmações é preservado,
**And** todas as alterações de versão são prospectivas (dias já materializados mantêm o valor congelado).

### Story 8.2: Confirmação diária por bloco ou individual

As a Hugo,
I want confirmar meus medicamentos do dia por bloco inteiro ("tomar remédios da manhã") ou individualmente,
So that eu registre a adesão rapidamente no ritual matinal (FR-3.6, UX-DR11).

**Acceptance Criteria:**

**Given** a primeira abertura do dia D,
**When** o módulo de medicamentos carrega,
**Then** materializa (idempotente, ansioso) uma linha em `medication_day_entries` por `(medicamento, bloco)` agendado e ativo em D, com `dose_at_time` semeada da versão vigente, `confirmed_at` nulo e `source=scheduled`,
**And** dias pulados abertos depois são semeados com a versão vigente naquele dia.

**Given** o Medication Block,
**When** exibido,
**Then** mostra o cabeçalho do bloco, a lista de nome+dose e um botão "Confirmar todos — [bloco]" + checkbox individual por medicamento,
**And** confirmar o bloco é escrita em lote (`confirmed_at = now()` em todas as linhas `scheduled` do bloco no dia); confirmar um só é UPDATE numa linha.

**Given** o estado do bloco,
**When** parcialmente confirmado,
**Then** o status "confirmado/parcial" é **derivado** (todas as linhas `scheduled` confirmadas = confirmado), nunca armazenado,
**And** um medicamento tomado sem previsão é registrado como `source=ad_hoc` com `confirmed_at` preenchido, sem contrapartida esperada.

### Story 8.3: Histórico de adesão e dose perdida

As a Hugo,
I want consultar o histórico de confirmações e ver claramente as doses perdidas,
So that eu acompanhe minha adesão como sinal clínico, distinto da ausência de um hábito (FR-3.7, AD-07).

**Acceptance Criteria:**

**Given** o histórico por data,
**When** Hugo o consulta,
**Then** exibe o estado final de confirmação de cada medicamento por bloco,
**And** uma linha `scheduled` com `confirmed_at` nulo num dia passado é exibida como **dose perdida** (sinal clínico), distinta de "sem linha" (não aplicável).

**Given** a edição de um dia passado,
**When** Hugo corrige dose ou confirmação,
**Then** é UPDATE só naquela linha de `medication_day_entries` (não toca agenda nem substância, não sangra para vizinhos),
**And** o histórico é preservado mesmo após desativação do medicamento.

---

## Epic 9: Diário de Gratidão

Hugo registra entradas de texto livre e navega o histórico, integrado ao ritual matinal.

### Story 9.1: Entradas de texto livre

As a Hugo,
I want adicionar múltiplas entradas de gratidão em texto livre por dia,
So that eu registre gratidão sem estrutura imposta, como parte do ritual da manhã (FR-4.1, UJ-6).

**Acceptance Criteria:**

**Given** a superfície Gratidão,
**When** Hugo adiciona uma entrada,
**Then** o model (escopado por tenant) grava texto livre associado a uma data, permitindo múltiplas entradas no mesmo dia, sem campos obrigatórios além do texto,
**And** a entrada aparece listada com hora e data.

**Given** o ritual matinal,
**When** Hugo revisa o Daily Log de ontem,
**Then** há um link contextual ("Gratidão de ontem") que abre o Diário de Gratidão no dia de ontem; também acessível pelo item da sidebar,
**And** o seletor de data permite registrar para ontem ou hoje.

**Given** o estado vazio,
**When** não há entradas para a data,
**Then** exibe "Nenhuma entrada para esta data." (informativo, não motivacional),
**And** salvar usa resposta otimista.

### Story 9.2: Histórico navegável por data e mês

As a Hugo,
I want navegar o histórico de gratidão por data e por mês,
So that eu releia entradas passadas (FR-4.2).

**Acceptance Criteria:**

**Given** o histórico de gratidão,
**When** Hugo navega,
**Then** pode consultar entradas por data específica e por mês,
**And** as entradas de cada dia são exibidas em ordem cronológica.

**Given** as queries de histórico,
**When** executadas,
**Then** são escopadas por tenant,
**And** o escopo de performance segue revisão histórica (sem NFR formal de < 2s).

---

## Epic 10: Gestão de Usuários *(pós-MVP — `[não-estimado]`)*

> ⚠️ **Fora do escopo do MVP.** Mantido como âncora de justificativa do AD-12 (o isolamento multi-tenant fail-closed do Épico 1 foi construído para este horizonte). **Não entra na contagem de sprint** e não deve ser quebrado em sprint-stories até o MVP fechar. AR-22 não bloqueia o MVP solo, mas a Story 10.0 é pré-requisito para convidar usuários externos.

### Story 10.0: Observabilidade mínima antes de usuários convidados

As a Hugo (operador),
I want observabilidade mínima antes de convidar novos usuários,
So that eu consiga detectar indisponibilidade, erros críticos e falhas de onboarding sem depender apenas de relatos manuais (AR-21, AR-22, NFR-6).

**Acceptance Criteria:**

**Given** o backend em produção,
**When** requisições são processadas,
**Then** logs estruturados em JSON são emitidos para stdout/Railway,
**And** incluem `timestamp`, `level`, `event`, `logger`, `request_id`, `method`, `path`, `status_code`, `duration_ms` e `user_id` quando aplicável,
**And** `user_id` é apenas o UUID interno opaco, nunca email, nome ou conteúdo de payload.

**Given** o sistema de logging,
**When** qualquer evento ou erro é registrado,
**Then** tokens, cookies, senhas, headers sensíveis e conteúdo privado do journal nunca aparecem nos logs ou eventos externos,
**And** existe teste ou checklist explícito validando essa política de dados proibidos.

**Given** uma falha não tratada no backend,
**When** a exceção ocorre,
**Then** ela é enviada ao Sentry com contexto seguro,
**And** ambiente e release/versão são incluídos quando disponíveis.

**Given** os fluxos de convite e onboarding do Épico 10,
**When** uma falha técnica ocorre nesses fluxos,
**Then** o erro gera log/evento seguro com `request_id` e contexto operacional suficiente para investigação,
**And** nenhum dado sensível do convite ou do usuário convidado é registrado.

**Given** o app em produção,
**When** o endpoint público `/health/` fica indisponível ou retorna status não-2xx,
**Then** Better Stack gera alerta conforme I-1/NFR-6,
**And** o canal mínimo de alerta é email para Hugo, salvo substituição explícita por outro canal monitorado,
**And** Railway permanece a fonte primária de logs de runtime.

**Given** o endpoint `/health/`,
**When** app e dependências essenciais respondem dentro do timeout configurado,
**Then** ele retorna `200` com corpo mínimo,
**And** não exige autenticação nem expõe detalhes sensíveis de infraestrutura.

**Given** a operação do sistema,
**When** alguém precisar investigar incidente,
**Then** existe documentação operacional descrevendo stack, formato de logs, níveis (`INFO`, `WARNING`, `ERROR`), dados proibidos e onde consultar Railway/Sentry/Better Stack.

**Out of scope:** dashboards avançados, tracing distribuído, métricas Prometheus/Grafana, alertas complexos por regra de negócio, auditoria de ações de usuário e Sentry frontend (`@sentry/react`) salvo se uma story futura explicitar erros de UI como escopo.

### Story 10.1: Convite de novos usuários por email

As a Hugo (operador),
I want convidar novos usuários por email,
So that amigos possam adotar o sistema quando ele estiver estável (FR-6.1).

**Acceptance Criteria:**

**Given** o fluxo de convite,
**When** Hugo envia um convite por email,
**Then** o sistema gera um convite associado ao email e dispara a mensagem,
**And** o convite tem validade e estado (pendente/aceito).

**Given** a pré-condição de isolamento,
**When** o convite é criado,
**Then** reusa o schema multi-tenant + manager fail-closed já entregue no Épico 1 (sem nova fundação de isolamento),
**And** o caminho de operador permanece explícito e separado do caminho de usuário.

### Story 10.2: Onboarding de usuário convidado com espaço isolado

As a usuário convidado,
I want aceitar o convite e ter meu próprio espaço de dados isolado,
So that eu use o sistema sem cruzar dados com nenhum outro usuário (FR-6.2, FR-6.3).

**Acceptance Criteria:**

**Given** um convite válido,
**When** o usuário o aceita,
**Then** uma conta é criada com seu próprio espaço de dados completamente isolado (sem espaço compartilhado entre usuários no MVP),
**And** o isolamento é garantido pelo manager auto-escopado da fundação (verificado por `test_isolation`).

**Given** o novo usuário autenticado,
**When** ele usa o app,
**Then** enxerga apenas seus próprios dados em todas as superfícies,
**And** nenhum dado de outro usuário é acessível em nenhuma circunstância (NFR-3).
