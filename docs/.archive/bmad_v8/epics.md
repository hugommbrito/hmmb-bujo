---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-06-22'
updated: '2026-07-23'
updateStepsCompleted: [1, 2, 3, 4]
sessionStatus: 'Breakdown do MVP completo em 2026-06-22 (Épicos 1–11; entregues 1–9 e 11). UPDATE 2026-07-22/23 — rito [CE] do handoff do CC (sprint-change-proposal-2026-07-22.md §9), atualização in-place COMPLETA: Requirements Inventory renumerado (Anexo A) + FRs novos + NFR-7..9 + AR-23..33 + DIR-1..15 + UX-DR21..31; Épicos 12–22 e Épico 10 ampliado com 86 stories novas na ordem mestre (§4); revisão party-mode + elicitação aplicadas. UPDATE CIRÚRGICO 2026-07-23 — pós-[IR] (implementation-readiness-report-2026-07-23.md, achados 🔴 1 e 🟠 1): Story 10.8 nova (recuperação de senha, FR-0.5 do [PRD] 2026-07-23; ordem interna antes da 10.1); refresh das 10.1/10.2 (FR-6.x→FR-15.x + ACs de erro + pt-BR); banner de pendência do É10 resolvido; FR-0.5 no inventário e no Coverage Map; nota do rename Index atualizada (PRD já aplicou). Próximo rito: [SP] bmad-sprint-planning (codificar ordem mestre 12→13→14→15→16→17→18→10→19→20→21(a/b)→22→21(c)).'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/addendum.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-22.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-22.md'
  - '_bmad-output/planning-artifacts/plano-de-acao-ui-e-ideias-2026-07-21.md'
  - '_bmad-output/specs/spec-design-system-migration/migration-plan.md'
project_name: 'hmmb-bujo'
user_name: 'HugoMMBrito'
---

# BuJo Digital (hmmb-bujo) - Epic Breakdown

## Overview

Este documento fornece a quebra completa de épicos e histórias do **BuJo Digital**, decompondo os requisitos do PRD, do UX Design (EXPERIENCE + DESIGN) e da Arquitetura (15 ADs + padrões de implementação) em histórias implementáveis.

> **Nota de reconciliação:** o `sprint-change-proposal-2026-06-22.md` já foi aplicado ao PRD-fonte — **FR-2.10** (gráfico de evolução de hábitos) e o **Brain Dump na Fase 1b** já constam no PRD. Nenhum requisito pendente de reconciliação.

> **Nota de atualização (rito [CE] 2026-07-22):** este documento está em **atualização in-place** para o ciclo pós-MVP, conforme handoff do `sprint-change-proposal-2026-07-22.md` (§9). Os Épicos 1–9 e 11 permanecem como registro histórico do entregue e **não reabrem**; o Requirements Inventory foi renumerado para o PRD reorganizado por collection (**Anexo A do PRD** = de-para) e os épicos novos (Tier 0/plataforma, ondas 2a/3/4/5/2b/6, Épico 10 ampliado, Tier 3) são adicionados na sequência da **ordem mestre** (proposal §4). Toda story de UI nova referencia o design system 2026-07-17 (CAP-3); épicos com UI nascem com story x.0 de UX (diretriz 15).

## Requirements Inventory

### Functional Requirements

> **Renumeração (CC 2026-07-22):** a Seção 5 do PRD foi reorganizada por collection (**núcleo + collections + plataforma**) e os FRs renumerados — o de-para completo está no **Anexo A do PRD**. Este inventário segue a numeração **nova**. FRs entregues têm o texto preservado e são marcados *(entregue)*; FRs do ciclo pós-MVP são marcados *(novo)*. A **sequência** de entrega é governada pela ordem mestre do proposal §4 — autoridade única de sequenciamento.

#### Grupo A — Fundação e Plataforma

**FR-0 — Fundação** *(FR-0.1–0.4 entregues — Épicos 1–2; FR-0.5 novo — IR 2026-07-23)*

- **FR-0.1** — Dados de cada usuário completamente isolados; nenhum dado acessível por outro usuário, em nenhuma circunstância.
- **FR-0.2** — Autenticação via email/senha com sessão persistente.
- **FR-0.3** — Dois ambientes isolados: dev e prod; dados não se cruzam.
- **FR-0.4** — Suporte a múltiplos usuários desde o início (UI de convite/gestão é fase posterior — FR-15).
- **FR-0.5** — *(novo — IR 2026-07-23)* **Recuperação de senha:** o usuário redefine a própria senha por email — solicita a redefinição ("esqueci minha senha"), recebe um link com token de validade limitada e define uma nova senha. Complementa o FR-0.2; entrega obrigatória **antes do Épico 10** (FR-15) — convidado trancado para fora é falha de onboarding.

**FR-1 — Infraestrutura de Collections** *(novo — fatia 1: Tier 0; Index/defaults: Épico 10 ampliado)*

- **FR-1.1** — O núcleo BuJo (logs Daily/Weekly/Monthly/Future, motor de migrações, recorrentes, arquivo e Brain Dump) é **não-gateável por construção**; todo o resto é **collection** opcional.
- **FR-1.2** — Taxonomia de 4 archetypes: coded fixa · coded com campos user-defined · coded de integração · custom (conteúdo do container coded "Custom Collections").
- **FR-1.3** — Manifest/registro central de collections coded (identidade, nome, ícone, rotas, entrada de navegação; campos reservados `dashboardCard`/`settingsSchema` sem consumidores na fatia 1); navegação derivada do registro. **Aceite da fatia 1: app pixel-idêntico**; collection nova = pasta da feature + UMA entrada no registro.
- **FR-1.4** — **Index:** superfície de ativação/desativação de collections; desativar preserva os dados; reativar restaura; o núcleo fica fora do Index. Ambiente de escolha, não marketplace. *(Renomeado de "cardápio" — decisão Hugo 2026-07-23: Index é estrutura canônica do método BuJo. O PRD ainda usa "cardápio"; atualização roteada ao [IR]/[PRD]. Rótulo pt-BR final — Index × Índice — decidido na x.0 10.3.)*
- **FR-1.5** — Default **all-off** para convidados: usuário novo nasce só com o núcleo e ativa collections por escolha deliberada.
- **FR-1.6** — Granularidade da flag de ativação (espaço × usuário) decidida no desenho do Épico 10; manifest agnóstico a ela.

**FR-2 — Configuração de IA (BYO key)** *(novo — nasce com Análises fase a, Tier 3)*

- **FR-2.1** — Chave de API de IA fornecida pelo usuário (BYO key), configuração global, **criptografada em repouso**; credenciais de integração de collection (ex.: foodLog) permanecem no `settingsSchema` da collection.
- **FR-2.2** — Capability **`ai_available`** derivada (= chave configurada), estado transversal que habilita todos os fluxos de IA.
- **FR-2.3** — **Tag "função de IA"** (ícone + texto, nunca só cor — UX-DR20): elementos dependentes de IA sem chave ficam **inativos (não ocultos)**, explicam o porquê e linkam a configuração.
- **FR-2.4** — Dados sensíveis (saúde) nunca enviados a provedores de IA que treinam com o conteúdo (Gemini free tier proibido). *(Ver NFR-8.)*

**FR-3 — Plataforma de Automação e Captura (C5)** *(novo — Tier 0, sem UI própria; atalhos iOS e widget ficam do lado do usuário)*

- **FR-3.1** — Credencial de automação dedicada, **distinta da sessão de login**: longa duração, escopada às capacidades de captura/resumo, revogável a qualquer momento.
- **FR-3.2** — Captura rápida por automação: item com conteúdo mínimo (tipo + texto + valor opcional), confirmação imediata; ingestão preparada para dados importados (`source: import` — ponte Apple Health futura do #20).
- **FR-3.3** — Resumo do dia por automação em uma única requisição (tarefas pendentes, hábitos do dia, última entrada de journalling).
- **FR-3.4** — Rate limiting + registro de auditoria desde o início (preparação para o multiusuário).
- **FR-3.5** — A PWA **não** é canal de captura rápida (limitação iOS — sem Web Share Target); polir a PWA é oportunista, fora de escopo de épico.

#### Grupo B — Núcleo BuJo (não-gateável)

**FR-4 — Motor BuJo** *(FR-4.1–4.13 entregues — ex-FR-1.1–1.13; FR-4.14–4.16 novos — refinos do CC)*

- **FR-4.1** — Quatro tipos de log: Daily (um por dia), Weekly (um por semana, seg→dom), Monthly (tarefas em datas), Future (data completa ou parcial).
- **FR-4.2** — Future Log aceita data parcial (só mês); dia definido na migração mensal.
- **FR-4.3** — Tarefa tem: título (obrigatório), descrição, subtarefas, etiqueta Eisenhower (Vermelho U+I / Laranja U / Amarelo I / Verde nenhum) e categoria (cor, borda lateral na Task Row, independente do Eisenhower) — opcionais.
- **FR-4.4** — Estados de tarefa: pendente, iniciada (`/`), concluída (`X`), cancelada, migrada, adiada.
- **FR-4.5** — Iniciar marca `/`; concluir marca `\`, formando X visual.
- **FR-4.6** — Ordenação manual das tarefas dentro de um log.
- **FR-4.7** — Migração diária: na abertura do dia, apresenta tarefas pendentes de ontem uma a uma; decisão por tarefa (migrar / adiar no mês / adiar no futuro / cancelar).
- **FR-4.8** — Migração semanal (segunda): apresenta tarefas do Weekly anterior sem disposição; decisão por tarefa.
- **FR-4.9** — Migração mensal (1ª semana do mês): apresenta tarefas do Monthly anterior sem disposição + puxa automaticamente itens do Future Log do mês corrente para o Monthly.
- **FR-4.10** — Semana **fechada** quando todas as tarefas têm disposição (concluída/cancelada/adiada/migrada).
- **FR-4.11** — Tarefas recorrentes são templates: título, grupo de recorrência (Semanal/Mensal/Anual), recorrência (texto livre), ativo + demais campos de tarefa.
- **FR-4.12** — Na abertura de cada ciclo, app apresenta recorrentes ativos; placement **manual** de cada um (sem auto-placement).
- **FR-4.13** — Semanas e meses fechados consultáveis no arquivo, com estado final de cada tarefa.
- **FR-4.14** — *(novo — #24, Onda 6)* **Nome às categorias:** o usuário atribui um rótulo a cada uma das 6 cores fixas de categoria; o rótulo aparece em selects e tooltips. As cores permanecem fixas — mapeamento usuário→label, não criação de cores.
- **FR-4.15** — *(novo — #15)* **Flag "Aguardando Terceiro"** (`waiting_on`) com indicador visual e filtro; é anotação sobre a tarefa, **não** estado — **proibido criar 7º estado** (enum de 6 estados congelado, Story 3.1). Backend (campo + service + API) = Tier 0; indicador e filtro de UI = Onda 2b.
- **FR-4.16** — *(novo — #23, Tier 0)* **Herança de status na migração:** o sucessor herda o status `started` da origem (em vez de resetar); apenas `pending`/`started` são migráveis; `migrated`/`postponed` terminais. Regra de service, **sem tocar o schema** do agregado Task.

**FR-5 — Brain Dump** *(entregue — Épico 5, Fase 1b via AD-15)*

- **FR-5.1** — Caixa de entrada independente, sem data e sem log de destino obrigatório; estado normal é vazio.
- **FR-5.2** — Cada item tem título (obrigatório) e, opcionalmente, descrição e log de destino.
- **FR-5.3** — Itens processados manualmente (movidos para o log correto ou descartados); sem migração automática.
- **FR-5.4** — Indicador visual persistente quando o Brain Dump contém itens, até ficar vazio.

**FR-6 — Home: Dashboard, Hoje e Captura** *(novo — Onda 2b; layout/spec visual = story x.0 de UX ampliada da onda, pré-requisito)*

- **FR-6.1** — Ponto de entrada pós-login = **Dashboard-panorama (home)**; revoga a cláusula "pós-login abre no Daily Log" do UX-DR16 (revogação parcial registrada).
- **FR-6.2** — **Dashboard = ver:** panorama do dia + cards das collections ativas; o card do dia é **acionável** (rapid logging direto + migrações pendentes visíveis), preservando a captura a um toque.
- **FR-6.3** — **Hoje = trabalhar:** superfície dos itens de trabalho do dia (eventos, migrações pendentes, rapid logging); Hoje e Dashboard apresentam a **mesma visão das tasks do dia** — componente único compartilhado (AD-21) — e diferem apenas pelo entorno.
- **FR-6.4** — **Empty-state do dashboard = Index/oferta:** sem collections ativas, a home mostra o núcleo (o dia) + convites de ativação por collection (ligados ao toggle FR-1.4). Uma superfície, dois jobs.
- **FR-6.5** — Cada collection ativa contribui um **card no dashboard** (via `dashboardCard` do manifest); conteúdo/layout detalhados na spec da home.
- **FR-6.6** — A home-panorama apresenta **indicadores de uso do sistema**; conjunto exato e fórmulas definidos na spec da home (bmad-ux). *(Absorve o antigo backlog "dashboard de indicadores do sistema".)*

#### Grupo C — Collections coded

**FR-7 — Hábitos** *(entregue — Épico 6; ex-FR-2.1–2.10)*

- **FR-7.1** — Hábitos organizados em grupos criados pelo usuário.
- **FR-7.2** — Criação de hábito: nome, emoticon, grupo, peso inicial, tipo (booleano/numérico).
- **FR-7.3** — Hábitos numéricos têm meta (valor alvo) e bonus de completude (%).
- **FR-7.4** — Percentual de completude diário, ponderado pelos pesos (booleano = 100% do peso quando feito; numérico = proporcional 0%→(100%−bonus%), 100% ao atingir meta).
- **FR-7.5** — Pesos alteráveis a qualquer momento; alteração vale a partir do dia corrente; dias anteriores preservam pesos vigentes.
- **FR-7.6** — Log diário de hábitos é snapshot imutável (hábitos ativos + pesos vigentes naquele dia).
- **FR-7.7** — Hábitos são desativados, nunca deletados; inativos somem do log ativo, permanecem no histórico.
- **FR-7.8** — Hábitos desativados podem ser reativados (voltam a partir do dia da reativação).
- **FR-7.9** — Histórico de hábitos consultável por data.
- **FR-7.10** — Histórico consultável como **gráfico de evolução por hábito**; mudanças reais de config (peso/meta/bonus/ativação) anotadas como eventos datados; multiplicador de tipo de dia **não** é mudança de config (ver AD-10/AD-11).

**FR-8 — Saúde-Métricas** *(entregue — Épico 7; ex-FR-3.1–3.3. Collection coded com campos user-defined; grupo visual "Saúde" com Medicamentos)*

- **FR-8.1** — Métricas de saúde são campos dinâmicos criados pelo usuário: nome, tipo (inteiro/decimal/booleano/enum/texto), ativo.
- **FR-8.2** — Log diário de saúde preenchido pelo usuário (majoritariamente de manhã, revisando o dia anterior); campos inativos preservados no histórico.
- **FR-8.3** — Histórico de saúde em três visualizações: tabela dia a dia, gráficos de evolução por campo, dashboard de período.
- **FR-8.R** — *(novo — refinos C3, Onda 5; nível de story por decisão do rito [PRD])* #16 reordenar métricas (`display_order` já existe) · #17 editar métricas (edição segura × destrutiva — DIR-3) · #18 tipos percentual + enum multi-seleção (valor→array) · #22 grupos de métricas (nova entidade de agrupamento).

**FR-9 — Medicamentos** *(entregue — Épico 8; ex-FR-3.4–3.7. Collection coded fixa; grupo visual "Saúde")*

- **FR-9.1** — Medicamentos são entidade separada: nome, dose, blocos de horário.
- **FR-9.2** — Um medicamento pode aparecer em múltiplos blocos com doses diferentes.
- **FR-9.3** — Confirmação diária por bloco ("tomar remédios da manhã") ou individual.
- **FR-9.4** — Medicamentos com ativo/inativo; histórico de confirmações preservado após desativação.
- *(Pendência §10 do proposal: campo "médico prescritor" — o modelo AD-07 já tem `prescribed_by` em `medication_substance_versions`; a story da Onda 5 verifica a exposição na superfície.)*

**FR-10 — Journalling** *(novo — Onda 5; absorve o Diário de Gratidão entregue no Épico 9; 2ª instância do archetype "coded com campos user-defined")*

- **FR-10.1** — Collection onde o usuário define **campos de relato**: `{nome, prompt opcional, cadência (diário|semanal|livre), múltiplas entradas, contexto_ia, gravar horário, ativo}`.
- **FR-10.2** — Ciclo de vida dos campos = **editar seguro × destrutivo**: renomear/adicionar = livre; mudar tipo/remover = só desativação (histórico preservado).
- **FR-10.3** — `contexto_ia` **nasce OFF** em todo campo (opt-in explícito); só campos com `contexto_ia = on` viram contexto de Análises (FR-13) — consentimento por campo.
- **FR-10.4** — Múltiplas entradas por campo, configurável (ex-FR-4.1 da Gratidão, absorvido).
- **FR-10.5** — Cadência configurável por campo **já no MVP** (decisão contra-recomendação preservada — DIR-14); histórico navegável apropriado por cadência: diário por data/mês (ex-FR-4.2), semanal e livre com visualização própria.
- **FR-10.6** — Visibilidade no Hoje: **card único** agregando os campos ativos (não um toggle por campo).
- **FR-10.7** — **Absorção da Gratidão:** campo seed **"Gratidões"** `{diário, múltiplas entradas, contexto_ia off}`; entradas existentes migradas; superfície antiga aposentada na mesma onda (sem período de duas verdades).

**FR-11 — Alimentação (#5a)** *(novo — Tier 3; archetype integração, define o padrão herdável)*

- **FR-11.1** — Consome o **foodLog** (API externa do usuário) em somente leitura, via **espelho local sincronizado**.
- **FR-11.2** — Superfície: resumo diário (refeições + horários + fotos) e janela de jejum.
- **FR-11.3** — Credenciais/URL da API no `settingsSchema` da collection (configuração sensível da collection, não global).
- **FR-11.4** — **Resiliência:** foodLog indisponível **nunca quebra o bujo**; degradação com indicador de "última sincronização"; fotos podem degradar. *(NFR-9.)*
- **FR-11.5** — Métricas de alimentação são fontes de 1ª classe nos Modelos de Relatório (FR-13); **fotos são exibição, nunca contexto de IA**.
- **FR-11.6** — Espelho completo navegável/editável e absorção do foodLog (#5b) ficam fora do MVP (icebox).

**FR-12 — Pressão Arterial (#20)** *(novo — Tier 3; depende de `ai_available` (FR-2); grounding: TR 2026-07-22)*

- **FR-12.1** — **N medições/dia**, par sistólica/diastólica **atômico** + pulso opcional + contexto opcional (braço, posição, momento); leitura avulsa ou agrupada em **sessão** (protocolo 7-2-2).
- **FR-12.2** — Captura por **foto + IA**: a IA **transcreve** os valores — modo de captura, não sugestão (fronteira UX-DR19).
- **FR-12.3** — **Human-in-the-loop obrigatório:** foto (guia de crop) → IA (saída estruturada estrita com instrução de recusa: `null` em vez de adivinhar) → formulário pré-preenchido com badge de confiança por campo → confirmação explícita → salvar. **Nunca salvar direto.**
- **FR-12.4** — Fallback manual sempre visível (mesmo formulário sem foto); imagem ilegível ou timeout cai no manual.
- **FR-12.5** — Evidência auditável (foto original + JSON bruto guardados); validação de plausibilidade + alerta de outlier vs. média de 7 dias, server-side.
- **FR-12.6** — Dashboard clínico usa a **média móvel de 7 dias**, não a leitura isolada.
- **FR-12.7** — `source` (photo_ai / manual / import) registrado **desde o início**; caminho Apple Health/Bluetooth (`import`) preparado no schema, não implementado.
- **FR-12.8** — Privacidade: crop do display (sem ambiente/rosto) + strip de EXIF antes do envio; Gemini free tier proibido (FR-2.4/NFR-8); no multiusuário, consentimento explícito para "leitura por IA em nuvem" + fluxo 100% manual como padrão para terceiros.

**FR-13 — Análises** *(novo — Tier 3, fases a→b→c; depende de `ai_available`; consolida o antigo FR-4.3/backlog e absorve "relatórios médicos" e "resumo mensal por IA")*

- **FR-13.1** — **Guardrail (UX-DR19/DIR-1):** a IA **analisa e explica**; nunca sugere, preenche ou automatiza captura/migração; **nunca gera nem executa queries; nunca produz números**. Toda geração por ação explícita.
- **FR-13.2** — Entidade central **Modelo de Relatório**: `{nome, métricas cross-collection, filtros (range de datas + condições simples), anotações por métrica (global com override local), conceitos, prompt de expectativa, exemplar adotado?, histórico de gerações}`.
- **FR-13.3** — **Fase a — dicionário semântico:** anotações por métrica + conceitos como contexto da IA.
- **FR-13.4** — **Fase b — geração sob demanda:** texto + gráficos que **referenciam séries pré-computadas pelo backend** (`serie_ref`); a IA escolhe tipo de gráfico/título/destaques; **os números vêm do backend, nunca da IA**.
- **FR-13.5** — **Ancoragem por exemplar:** resultado satisfatório pode ser "adotado" como padrão do modelo; vai como contexto nas gerações futuras.
- **FR-13.6** — Relatórios salvos com histórico; cada geração é **snapshot imutável**.
- **FR-13.7** — **Fronteira de privacidade:** saem para a IA somente métricas selecionadas + campos de journalling com `contexto_ia: on`; fotos nunca.
- **FR-13.8** — **Consentimento e transparência:** seleção da métrica no modelo = consentimento; **badge "dado lido por IA"** (ícone + texto) no formulário de origem; índice reverso métrica→modelos com **degradação graciosa**; badge distinto da tag "função de IA" (FR-2.3).
- **FR-13.9** — Collection-fonte desligada = fora de novos relatórios (métricas ocultas, não deletadas; relatórios antigos intactos).
- **FR-13.10** — **Fase c — geração agendada:** só depois das fases a/b.
- **FR-13.11** — **Relatórios médicos** = Modelo de Relatório especializado com exemplar de formato; exportação estruturada (PDF) = fase 2.
- **FR-13.12** — O antigo "resumo mensal por IA" = apenas um Modelo de Relatório possível, não feature fixa.

#### Grupo D — Collections custom

**FR-14 — Custom Collections (C6)** *(novo — Tier 3, 1º investimento do tier; caso motor: logs do Canadá #1)*

- **FR-14.1** — **Collection coded container:** entrada estática única no manifest, ativável/desativável; as custom collections do usuário são **conteúdo do container** (vivem no banco).
- **FR-14.2** — Custom collection = **lista de registros com schema definido pelo usuário**: campos tipados, incluindo campo-array de sub-registros com **máx. 1 nível de aninhamento**.
- **FR-14.3** — Sistema de tipos **próprio, independente do Épico 7** (decisão contra-recomendação preservada — DIR-14).
- **FR-14.4** — Navegação: grupo "Custom Collections" na sidebar; cada custom collection ativa é entrada (paridade com as coded).
- **FR-14.5** — Edição de schema com registros existentes: segura livre; destrutiva bloqueada (só desativação; histórico preservado).
- **FR-14.6** — Nasce vazia com exemplos ilustrativos no empty-state; sem templates/presets seed.
- **FR-14.7** — **Sem export no MVP** (decisão preservada — DIR-14); fase 2 se a dor aparecer.
- **FR-14.8** — Cidadania no ecossistema (card no dashboard, `contexto_ia`/Análises, Index) decidida por feature/story; default conservador **off**.
- **FR-14.9** — Caso motor: Viagens (datas, destinos), Moradias (endereços, períodos), Empregos (empregador, cargo, período) — listas estruturadas com colunas tipadas.

#### Grupo E — Gestão de Usuários

**FR-15 — Gestão de Usuários** *(FR-15.1–15.4 preservados — ex-FR-6.1–6.4; FR-15.5–15.6 novos — Épico 10 ampliado)*

- **FR-15.1** — Convite de novos usuários por email.
- **FR-15.2** — Cada usuário com espaço de dados completamente isolado.
- **FR-15.3** — [ASSUMPTION] Sem espaço compartilhado entre usuários no MVP.
- **FR-15.4** — **[BACKLOG]** Competição entre amigos por percentual de hábitos.
- **FR-15.5** — *(novo)* O Épico 10 entrega, além de convites e onboarding: **observabilidade mínima** (Story 10.0, antes de convidar externos) e as **peças 2–4 do #14** — Index (FR-1.4), default all-off (FR-1.5) e empty-state do dashboard como oferta (FR-6.4).
- **FR-15.6** — *(novo — LGPD)* Consentimento explícito para "leitura por IA em nuvem" de dados sensíveis de terceiros; **fluxo 100% manual como padrão** para convidados (cross-ref FR-12.8, FR-2.4); granularidade da flag de ativação decidida no desenho do épico (FR-1.6).

### NonFunctional Requirements

- **NFR-1 — Mobile real:** 100% das ações do fluxo diário (brain dump, hábito, saúde) executáveis em mobile sem scroll horizontal.
- **NFR-2 — Performance:** Daily Log e fluxo de migrações percebidos como instantâneos (< 2s em conexão normal). *Aplica-se só ao modo de execução diária (AD-14).*
- **NFR-3 — Isolamento de dados:** nenhum dado de um usuário acessível por outro em nenhuma circunstância. *Interpretado como isolamento na fronteira da aplicação (AD-12).*
- **NFR-4 — Integridade do histórico:** logs passados imutáveis; nenhuma operação futura altera registros históricos. *Interpretado como imutabilidade sistêmica — usuário edita manualmente, o sistema nunca retroage (AD-04/06/07).*
- **NFR-5 — Ambientes separados:** dev e prod com dados completamente isolados.
- **NFR-6 — Disponibilidade:** uptime 99% no horário ativo (6h–23h).
- **NFR-7 — Segurança de IA:** *(novo)* nenhuma query é gerada ou executada por IA — a IA compõe apenas specs validadas server-side contra catálogo/allowlist; defesa em profundidade no caminho de leitura de relatórios (role read-only + `statement_timeout`). *(AD-25.)*
- **NFR-8 — Privacidade de dados sensíveis:** *(novo)* chave de IA criptografada em repouso; dados de saúde nunca enviados a provedores que treinam com o conteúdo (Gemini free tier proibido por allowlist — AD-24). *(Decisão do dono neste rito, 2026-07-22: cláusula de crop+EXIF removida do NFR transversal; o pipeline de foto permanece como requisito de feature em FR-12.8/AD-27.)*
- **NFR-9 — Resiliência de integrações externas:** *(novo)* indisponibilidade de fonte externa (ex.: foodLog) nunca quebra o núcleo do bujo; degradação graciosa com indicador de última sincronização. *(AD-23.)*

### Additional Requirements

_Requisitos técnicos e transversais da Arquitetura (27 ADs — 16 do MVP + AD-17..27 do ciclo pós-MVP, §3b — + §6 Padrões + §7 Estrutura) que impactam a criação de histórias. **Não há starter template** — projeto greenfield com scaffold próprio de monorepo._

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

**Ciclo pós-MVP (AD-17 a AD-27 — §3b da arquitetura, rito [ARCH] 2026-07-22):**

- **AR-23 (Manifest/registry — AD-17)** — registro estático em `src/app/collections/registry.ts`, **dados puros** (sem hooks/TanStack Query — não dispara mocks novos nos 3 testes compartilhados de AppLayout/router/RouteAnnouncer); entrada `{id, name, icon, routes lazy, nav {label, group, order}, archetype, dashboardCard?, settingsSchema?}` (reservados sem consumidores na fatia 1); Sidebar/BottomNav/rotas derivadas por map puro; **o núcleo BuJo fica FORA do registro**; fatia 1 sem flag de ativação (ativação futura = consulta separada que filtra o registro); aceite **pixel-idêntico**; DoD estrutural: collection nova = pasta + UMA entrada.
- **AR-24 (Refinos de service — AD-18)** — herança de status na migração (`started`→`started`; matriz AD-02 inalterada; na migração de pai, cada filho herda o próprio status); `tasks.waiting_on boolean default false` + service + API PATCH + filtro `?waitingOn=` (django-filter); flag ortogonal às transições de estado; **sucessor herda `waiting_on`** (confirmado 2026-07-22); UI na Onda 2b.
- **AR-25 (AutomationToken + endpoints C5 — AD-19)** — app backend `automation` (app de composição); token **opaco** escopado revogável sem refresh, só hash SHA-256 + prefixo (padrão GitHub PAT), pleno exibido 1× na criação; auth class DRF dedicada que valida hash/revogação/escopo, atualiza `last_used_at` e **seta o tenant context (AD-12)**; `POST /api/capture` (payload raso `{type, text, value?}`, dispatcher por tipo, preparado p/ `source: import`) + `GET /api/summary/today` (agregado; enquanto Journalling não existe, última gratidão); `ScopedRateThrottle` + log estruturado `{token_prefix, endpoint, status}` (token nunca em log); gestão inicial via Django admin.
- **AR-26 (Journalling — AD-20)** — app `journalling`; `journal_field_definitions` no padrão do Épico 7 + `journal_entries` com **3 âncoras temporais mutuamente exclusivas** (`entry_date`/`week_start` seg/`occurred_at`) via CHECK conforme a cadência; entrada única × múltiplas validada no service + índice único parcial; `ai_context` = consentimento por campo (default off, incl. seed); **data migration**: campo seed "Gratidões" + cópia de `gratitude_entries`; superfície da Gratidão aposentada na mesma onda (rotas removidas); app `gratitude` (código + tabela) removido na Onda 6 após verificação.
- **AR-27 (Home compartilhada — AD-21)** — **UM componente** de visualização+manipulação das tasks do dia em `features/bujo/` (barrel passa a expor este componente de composição designado), consumido por `pages/today/` e `pages/dashboard/`; capacidade plena e idêntica; **mesmas query keys** (zero estado duplicado; mutação numa superfície reflete na outra); rota pós-login → `/dashboard`; empty-state Index nasce com slot (condição (c) da Sally); UI do `waiting_on` nasce aqui.
- **AR-28 (Custom Collections — AD-22)** — app `customcollections`; `custom_collections` (schema JSONB) + `custom_collection_records` (data JSONB); tipos próprios `{text, int, decimal, bool, date, enum, subrecords}`; `subrecords` só escalares, **máx. 1 nível** (fronteira dura); validação no service (padrão AD-01); filhas dinâmicas na sidebar = **server state confinado ao grupo do container** (exceção deliberada ao dados-puros; **a story registra: mocks de Query nos 3 testes compartilhados**); rota paramétrica única `/collections/:collectionId`; cidadania default off; sem export e sem índice JSONB no MVP.
- **AR-29 (Alimentação — AD-23)** — app `food`; espelho `food_log_entries` + `food_sync_state` (`last_sync_at`, `status`, `last_error`); **sync on-read com TTL + refresh manual, sem scheduler** (django-q2 não existe ainda — nunca pré-requisito); falha de sync silenciosa para o núcleo (NFR-9); **fotos REFERENCIADAS** (URLs do bucket R2 do foodLog; verificar na story URL estável × presignada); credenciais no `settingsSchema` criptografadas (Fernet, padrão AD-24); Análises lê do espelho, nunca da API externa.
- **AR-30 (Config de IA global — AD-24)** — `user_ai_settings` 1:1 `{encrypted_api_key, provider, monthly_cap_usd?}`; **Fernet** com `AI_KEY_ENCRYPTION_KEY` dedicada (≠ SECRET_KEY, rotacionável); API **write-only** (GET devolve máscara + `ai_available`); endpoint leve de config (Query, staleTime alto); tag "função de IA" como componente em `shared/components/`; **allowlist de providers no backend** (inicial: `anthropic`) — NFR-8 por construção.
- **AR-31 (Análises fases a/b — AD-25)** — app `analytics`; **catálogo de métricas em código** (`analytics/catalog.py`) = allowlist única; Modelo de Relatório persiste **spec JSON** validada por JSON Schema estrito e **compilada server-side para ORM** (`services/compiler.py`); alias `report_read` (role Postgres read-only + `statement_timeout`); fase b: backend computa séries determinísticas, IA devolve blocos `{tipo, serie_ref, titulo}` via structured outputs (nunca embute dados), frontend renderiza com **Recharts**; `report_models`/`report_exemplars` (versionado)/`report_generations` (snapshot imutável + `payload_hash`); **índice reverso métrica→modelos** com degradação graciosa (sem badge, formulário intacto).
- **AR-32 (Análises fase c — AD-26)** — **django-q2** (broker ORM/Postgres, zero infra nova; worker `qcluster` no Railway; `tenant_context(user)` explícito fora de request); **Batch API** (−50%); controle de custo: cap mensal via `usage` das gerações (excedido → pula e registra) + **skip por hash**; entra **somente na fase c** — nenhuma story anterior depende dele.
- **AR-33 (Pressão Arterial — AD-27)** — app `bloodpressure`; `bp_sessions` (médias derivadas on-read) + `bp_measurements` (**par atômico** na mesma linha, CHECKs sis>dia + ranges plausíveis, `source` enum **desde a 1ª migration**) + `bp_photos`; média móvel de 7 dias; fluxo foto+IA: crop/redimensionamento ≤1.100px/strip EXIF **no cliente** → structured output estrito com instrução de recusa → form pré-preenchido com badge de confiança → confirmação explícita; validação server-side independente + alerta de outlier; **Haiku 4.5** default; storage `django-storages` → **R2 privado dedicado** (URL presignada curta via endpoint tenant-scoped; config por env); endpoint de ingestão aceita `AutomationToken` (`source: import` preparado).

**Diretrizes vinculantes de story — proposal §8 (embutir textualmente nas stories indicadas):**

- **DIR-1 (Guardrail DR19 — Análises e #20)** — texto obrigatório nas stories: *"A IA analisa e explica; nunca sugere, preenche ou automatiza captura/migração; transcrição só salva após confirmação explícita."*
- **DIR-2 (#20 human-in-the-loop)** — foto (guia de crop) → IA (structured output com instrução de recusa: `null` em vez de adivinhar) → formulário pré-preenchido com badge de confiança por campo → confirmação explícita → salvar; fallback manual sempre visível; foto + JSON bruto guardados; plausibilidade + outlier server-side; Haiku 4.5 default; **nunca** Gemini free tier.
- **DIR-3 (Editar seguro × destrutivo)** — aplicar em #17 (métricas), C6 e Journalling: renomear/adicionar opção = livre; mudar tipo/remover = só desativação; histórico preservado.
- **DIR-4 (#15 = flag)** — `waiting_on` + indicador + filtro; **proibido 7º estado**; backend no Tier 0, UI na Onda 2b.
- **DIR-5 (#23)** — sucessor herda `started`; regra de service (Stories 4.2/11.6), sem tocar schema; só `pending`/`started` migráveis.
- **DIR-6 (Manifest fatia 1)** — registro estático com dados puros; campos reservados sem consumidores; aceite = app **pixel-idêntico**; DoD: collection nova = pasta + UMA entrada.
- **DIR-7 (Sinais de IA distintos)** — tag "função de IA" (feature precisa de key) ≠ badge "dado lido por IA" (dado selecionado em ≥1 modelo); ambos ícone + texto, nunca só cor (UX-DR20); índice reverso com degradação graciosa.
- **DIR-8 (Consentimento)** — `contexto_ia` nasce **off** em todo campo de journalling (opt-in explícito); em métricas, a seleção no Modelo é o consentimento e o badge é a transparência.
- **DIR-9 (BYO key global)** — nasce com a primeira feature de IA (Análises fase a); criptografada em repouso; deriva `ai_available`.
- **DIR-10 (Alimentação #5a)** — read-only; espelho local sincronizado; credenciais no `settingsSchema`; foodLog fora do ar **nunca** quebra o bujo; fotos são exibição, **nunca** contexto de IA.
- **DIR-11 (C5)** — payloads rasos `{type, text, value?}`; token escopado, revogável, sem refresh; rate limiting + logging; ingestão preparada para `source: import`.
- **DIR-12 (Condições da Sally)** — (a) extração do manifest é contrato puro (nenhuma mudança visual pega carona); (c) todo mockup daqui em diante inclui o estado "collection desligada/ausente".
- **DIR-13 (Épico 10)** — consentimento explícito para "leitura por IA em nuvem" de dados de terceiros; fluxo 100% manual como padrão para convidados; granularidade da flag decidida no desenho do épico.
- **DIR-14 (Decisões contra-recomendação preservadas — não "corrigir")** — tipos de C6 independentes do Épico 7; C6 sem export no MVP; Journalling com cadência configurável no MVP.
- **DIR-15 (Story x.0 de UX)** — todo épico novo com superfície de UI nasce com story `x.0` de design: rito **bmad-ux** (human-in-the-loop) produz o mockup/spec com as features decididas e promove a DESIGN/EXPERIENCE, como **gate de entrada** do épico; nenhuma story de implementação antes da x.0 aprovada; épicos sem UI (Tier 0, 10.0) não ganham x.0; o story-automator só entra após a x.0 `done`; a spec da nova home é a x.0 **ampliada** da Onda 2b.

### UX Design Requirements

_Requisitos acionáveis extraídos do EXPERIENCE.md (comportamento, fluxos, componentes, estados) e DESIGN.md (tokens visuais, theming MUI). Cada UX-DR é específico o bastante para gerar histórias com ACs testáveis._

> **Atualização (CC/[CE] 2026-07-22):** UX-DR1–20 documentam o sistema **entregue** (design de 2026-06-15) e permanecem como registro histórico — já com as revisões E3 (UX-DR16) e E4 (UX-DR19) do CC aplicadas inline. Para **todo trabalho novo**, a autoridade visual/comportamental é o **DESIGN.md + EXPERIENCE.md de 2026-07-17** (`status: final`; gate da Fundação fechado em 2026-07-21), expressa em **UX-DR21–31** abaixo. Em conflito com UX-DR1–15/17–18, o sistema novo vence.

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
- **UX-DR16 (Estados de Auth)** — redirect para Login sem sessão; erro de login inline ("Email ou senha incorretos."); sessão expirada com banner não-bloqueante sem destruir o estado da UI. **[REVOGADO PARCIALMENTE — CC 2026-07-22]**: a cláusula "pós-login abre no Daily Log de hoje" é revogada — pós-login abre no **Dashboard-panorama (home)**. Exigências preservadas: captura a um toque; card do dia **acionável** (rapid logging direto, migrações pendentes visíveis). "Hoje" permanece como superfície de trabalho — **Hoje = trabalhar / Dashboard = ver** — compartilhando o mesmo componente de tasks do dia. Detalhamento na spec da nova home (bmad-ux, pré-requisito da Onda 2b).

**Estrutura, navegação e plataforma:**

- **UX-DR17 (Arquitetura de Informação / Roteamento)** — mapa de superfícies (Hoje, Planner: Esta Semana/Este Mês/Futuro, Hábitos, Saúde: Métricas/Medicamentos, Gratidão, Brain Dump, Arquivo, Configurações + sub-seções); empilhamento de modal máximo 1 nível; Fluxo de Migração nunca navegado diretamente.
- **UX-DR18 (Responsividade)** — breakpoints desktop ≥1024 / tablet 768–1023 / mobile <768; Weekly Log 7 colunas (desktop) → seletor de dia (tablet/mobile), sem scroll horizontal; Monthly Log lista vertical no mobile; detalhe de tarefa = bottom sheet no mobile; Migração full-screen no mobile.
- **UX-DR19 (Primitivos de interação / teclado)** — atalhos globais `[` (sidebar), `N` (nova tarefa), `B` (Brain Dump), `Esc` (fechar modal/popover); drag-and-drop de reordenação só desktop; ciclo de status por clique; proibições explícitas (migração automática, drag mobile, modal aninhado, gamificação, sugestões de IA, scroll horizontal de navegação). **[Fronteira registrada — CC 2026-07-22]**: "sugestões de IA" proíbe IA como **primitivo de interação** (sugerir/preencher/automatizar captura e migração — atalhos em fluxos intencionalmente atritosos). **Não** proíbe análises sobre dados já preenchidos (collection Análises) nem transcrição sob confirmação humana obrigatória (Pressão Arterial foto+IA). Guardrail obrigatório nas stories dessas features: *a IA analisa e explica; nunca sugere, preenche ou automatiza captura/migração; transcrição só salva após confirmação explícita.* Consentimento: campo de journalling só vira contexto com `contexto_ia: on` (opt-in, default off); métrica selecionada em Modelo de Relatório ganha badge "dado lido por IA" no formulário de origem (cor + ícone/texto, conforme UX-DR20).
- **UX-DR20 (Acessibilidade — WCAG 2.2 AA)** — cor nunca único indicador (sempre + ícone/texto); touch target ≥ 44px mobile; focus ring MUI preservado; tab order = ordem visual; `Esc` fecha modal/popover; anúncios `aria-live` (mudança de superfície, progresso de migração, status de tarefa, badge do Brain Dump); semântica HTML (`<nav>`, `<main>`, `role=dialog`/`aria-modal` com foco travado).

**Sistema de design novo — migração 2026-07-17 (governa todo trabalho novo; CAP-3):**

- **UX-DR21 (Contrato visual novo — DESIGN.md 2026-07-17)** — tokens canônicos: paleta papel-mineral/tinta (canvas `#F5F2EA`, ink `#25231F`, primary verde-petróleo `#315F5A` + soft/hover, semânticas info/success/warning/danger com softs, `category-*` 6 cores, `priority-*`, focus `#166C9C`, overlay 48%); Inter única (escala `page-title`/`section-title`/`body`/`body-strong`/`meta`/`label`); radius 2–8px; spacing base 4px; **zero elevation estrutural** (borda 1px; sombra mínima só em camada transitória); princípios vinculantes: trabalho em 1º plano, densidade legível, calma operacional, estrutura sem cards por padrão, digital nativo; MUI = infraestrutura (comportamentos acessíveis preservados, aparência substituída); **tema escuro fora da 1ª fundação**; handoff MyBujo = referência de composição, nunca fonte de CSS/feature.
- **UX-DR22 (App Shell novo — Onda 2a)** — sidebar 240px expandida / 64px colapsada, topbar 56px, workspace máx. 1440px sobre canvas contínuo; destino ativo = indicador lateral + peso de label + estado selecionado; badges não deslocam labels; **sem seletor Legado/Moderno**; shell mostra só destinos implementados (módulos futuros não aparecem desabilitados); navegação derivada do manifest (AR-23); mobile: top bar + bottom nav com até 4 destinos frequentes + menu; escolha final dos ícones por destino é acabamento do catálogo semântico, anterior ao gate de implementação.
- **UX-DR23 (Núcleo BuJo — spines M06/M07/M08, Onda 3)** — **Weekly Board** multi-faixa (Seg–Qua; Qui–Sex + fim de semana compacto) + pool "Sem dia definido" lateral contínuo + scroll interno por painel (nunca 7 colunas estreitas); **ciclo de vida** Em planejamento → Em andamento → Finalizada com gates explícitos (Concluir planejamento não-bloqueante; Iniciar exige alvo alcançado + planejamento concluído + anterior finalizado; Finalizar irreversível); **planejamento** com rails (fontes em ordem fixa → lista de decisões Pendentes/Tudo → rail sticky de densidade real/progresso/avisos); **Monthly Board** calendário seg→dom completo com Task Rows nas células (sem "+N"), pool lateral, today/seleção por contorno; **Future Log** trilho de 8 meses + coluna de foco + "Ir para mês…" (só meses com itens) + datear/mover no lugar com linhagem (origem terminal + seta navegável ao sucessor com destaque temporário); decisões individuais sem bulk; sem toast de sucesso redundante; teclado `1`–`7`/`0` + `Enter` no seletor de destino; mockups `key-weekly.html`/`key-monthly.html`/`key-future-log.html` **vencem conflitos**; deltas de domínio (estados de ciclo, decisões-snapshot etc.) exigem **stories próprias** — nunca tratados como CSS do redesign.
- **UX-DR24 (Recorrentes — M09, Onda 3)** — biblioteca em `/planner/recurring` (padrão Coleção): abas Semanal/Mensal/Anual com contagem + filtro "Mostrar inativos"; variante **Item Row** (sem ícone de status — template não tem estado); criar/editar no **mesmo card do detalhe de tarefa** (grupo segmented na criação, readonly na edição; recorrência = texto livre nunca parseado); footer Salvar / Ativar-Desativar / Excluir; **soft delete** com dialog (preserva a FK `source_template` das tarefas alocadas); **Alocar** vive nos rituais, não na biblioteca; termo padrão do ato = **"Alocar"**.
- **UX-DR25 (Migração/Catch-Up — M10, Onda 3)** — **faixa discreta no Hoje** ("N tarefas precisam de decisão", contagem por fonte) = único ponto de entrada; **fila unificada** mês→semana→dia (mescla `/migration/queue/` + `/catch-up/queue/`); apresentação como **ritual dentro do shell** (não Dialog nem full-screen); decisões individuais: **Migrar para hoje** (destaque) / **Escolher destino…** / **Cancelar** — sem "Concluir"; seletor de destino unificado (abas Esta semana · Dia no mês · Outro mês + atalhos Hoje/Sem dia); rail de contexto = progresso + decidido + restante por fonte; **pausar/retomar** sem perder decisões (persistidas por item); **resumo factual** ao fim; erro de escrita preserva decisão e item com retry.
- **UX-DR26 (Task Row e detalhe canônicos — sistema novo)** — cluster leading (borda de categoria 3px, ícone de status, chip Eisenhower) + centro (título, descrição 1 linha, subtarefas) + trailing (indicador de ordem, drag com alternativa de teclado/comando); vocabulário de ícones vigente preservado (círculo/ampulheta/TaskAlt/Cancel/seta/seta dupla); min-height 36px pointer / 48px touch; no detalhe: **Categoria = radio group de swatches preenchidos com anel de seleção** (sem dropdown), **Eisenhower = 2 checkboxes U/I com preenchimento suave** (deriva ui/u/i/none); footer Salvar (primário) / Mover (neutro) / Cancelar tarefa (danger contornado, maior que Excluir) / Excluir (lixeira discreta `ink-muted`); semântica de Enter (título salva e fecha; descrição quebra linha; `Ctrl/Cmd+Enter` salva de qualquer campo); linhagem: seta da origem `migrated` navega ao sucessor (contorno `info` temporário, sem abrir detalhe). Padrão fixado na M09; vale para toda superfície com detalhe.
- **UX-DR27 (Pictogramas de domínio — Phosphor)** — `iconKey` estável de **catálogo fechado** pesquisável por nome (nunca componente React/SVG persistido); monocromático `currentColor`, weight regular, 18/20px; identifica o assunto, **nunca** estado/conclusão/severidade; mesmo `iconKey` em cadastro, Hoje, grids e histórico; `emoticon` existente preservado como fallback na migração; introdução do campo `iconKey` = mudança de contrato com **story própria**; fronteira: Phosphor = domínio, MUI = controles/ações, vocabulário de tarefas = estados.
- **UX-DR28 (Alternador do Hoje — Onda 2b)** — Icon Button único terciário com `aria-pressed` alterna **Dia completo ↔ Foco nas tarefas**; mesma rota/data/dados/regras — muda só composição e nível de detalhe; preferência local (default Dia completo); totalizadores são resumos navegáveis (não KPIs) — acioná-los troca a lente, posiciona o módulo e transfere foco programático; módulos não implementados não geram cards vazios/placeholders; alternância não perde edição confirmada e preserva/confirma drafts.
- **UX-DR29 (Access Surface — "Limiar do workspace", Onda 6)** — Login/Signup com formulário operacional em primeiro plano + silhueta abstrata da área autenticada (`surface-subtle`/`border`/opacidade reduzida; sem conteúdo real, sem interação, oculta de tecnologia assistiva); signup com confirmação de senha **local** (divergência impede envio, preserva valores, `"As senhas não coincidem."` associado ao campo e anunciado); não bloquear colar/gerenciador de senhas; só email/senha/timezone na requisição existente.
- **UX-DR30 (Aceite UX por story + DoR da migração)** — toda story de implementação de UI: (1) rastreia SPEC CAP, FR/épico e padrão do spine; (2) inventaria e preserva ações/estados/atalhos/feedback da superfície real; (3) consome tokens/componentes do DESIGN.md novo sem valores estruturais locais injustificados; (4) demonstra wide/medium/compact por recomposição; (5) cobre loading/empty/error/offline/disabled/readonly-closed; (6) passa teclado/foco/screen reader/touch target/zoom-reflow/reduced motion/contraste; (7) preserva conteúdo em falha + otimismo/rollback da arquitetura; (8) preserva ciclos/status/linhagem/snapshots/alocação manual; (9) testes semânticos/interação + E2E representativo + regressão visual; (10) define ativação/rollback/remoção do legado por superfície. **DoR do migration-plan** aplica-se integralmente (superfície inventariada, fronteira legado/novo, paridade testável, nenhuma funcionalidade nascida só do handoff). Condições da Sally: (a) extração do manifest = contrato puro; (c) todo mockup inclui o estado "collection desligada/ausente".
- **UX-DR31 (Story x.0 de UX — gate de entrada de épico)** — todo épico novo com superfície de UI abre com story `x.0` de design: o rito **bmad-ux** (human-in-the-loop, nunca dev-story/automator) produz o mockup/spec da superfície com as features já decididas (M11–M23 conforme a onda) e promove o resultado a DESIGN/EXPERIENCE; **nenhuma story de implementação do épico começa antes da x.0 aprovada**; épicos sem UI (Tier 0/plataforma, 10.0 observabilidade) não ganham x.0; a spec da nova home é formalmente a x.0 **ampliada** da Onda 2b (pré-requisito dela).

### FR Coverage Map

> **Decisão de granularidade (party-mode 2026-06-22):** estrutura refinada seguindo a recomendação da Amelia — Épico de Fundação rachado em **Plataforma** + **Autenticação**; Saúde & Medicamentos rachados em **Métricas de Saúde** + **Medicamentos**; o épico de Migração permanece **unificado com histórias estritamente ordenadas**. Convergências aplicadas: `core/calendar.py` + padrão temporal canônico explícitos na Fundação; **schema de `tasks` congelado por completo** no Épico 3 (Daily Log); "espinha do ritual" como contrato nos épicos de domínio.

**Requisitos Funcionais:**

*Entregues (numeração nova — o de-para com a numeração antiga está no Anexo A do PRD):*

- **FR-0.1** → Épico 1 (mecanismo de isolamento — `TenantModel`, manager fail-closed, `test_isolation`)
- **FR-0.2** → Épico 2 (auth email/senha + sessão persistente)
- **FR-0.3** → Épico 1 (ambientes dev/prod isolados — branches do Neon)
- **FR-0.4** → Épico 1 (multi-usuário desde o início — schema)
- **FR-4.1** *(ex-1.1)* → Épico 3 (Daily Log) + Épico 4 (Weekly/Monthly/Future Log)
- **FR-4.2** *(ex-1.2)* → Épico 4 (Future Log com data parcial)
- **FR-4.3** *(ex-1.3)* → Épico 3 (campos de tarefa + subtarefas)
- **FR-4.4** *(ex-1.4)* → Épico 3 (estados de tarefa)
- **FR-4.5** *(ex-1.5)* → Épico 3 (`/` e `\` formando X)
- **FR-4.6** *(ex-1.6)* → Épico 3 (ordenação manual)
- **FR-4.7** *(ex-1.7)* → Épico 4 (migração diária)
- **FR-4.8** *(ex-1.8)* → Épico 4 (migração semanal)
- **FR-4.9** *(ex-1.9)* → Épico 4 (migração mensal + pull do Future Log)
- **FR-4.10** *(ex-1.10)* → Épico 4 (semana fechada)
- **FR-4.11** *(ex-1.11)* → Épico 4 (templates recorrentes)
- **FR-4.12** *(ex-1.12)* → Épico 4 (placement manual de recorrentes)
- **FR-4.13** *(ex-1.13)* → Épico 4 (arquivo de ciclos fechados)
- **FR-7.1 a FR-7.10** *(ex-2.1–2.10)* → Épico 6 (Sistema de Hábitos, incl. gráfico de evolução FR-7.10)
- **FR-8.1, FR-8.2, FR-8.3** *(ex-3.1–3.3)* → Épico 7 (Métricas de Saúde — campos dinâmicos JSONB)
- **FR-9.1 a FR-9.4** *(ex-3.4–3.7)* → Épico 8 (Medicamentos — versionamento + confirmação)
- **FR-10.4 + FR-10.5-diário** *(ex-4.1/4.2 — Diário de Gratidão)* → Épico 9 (entregue como superfície dedicada; absorção pelo Journalling → FR-10.7, Onda 5)
- **FR-5.1 a FR-5.4** → Épico 5 (Brain Dump — Fase 1b)
- **FR-15.1, FR-15.2, FR-15.3** *(ex-6.1–6.3)* → Épico 10 (Gestão de Usuários — pós-MVP)
- **FR-15.4** *(ex-6.4)* → **[BACKLOG]** (competição entre amigos — fora do escopo)

*Novos (ciclo pós-MVP — CC 2026-07-22; épicos definidos no step 2 deste rito, na ordem mestre do proposal §4):*

- **FR-0.5** (recuperação de senha — IR 2026-07-23) → **Épico 10 ampliado** · **Story 10.8** (antes da 10.1 na ordem interna)
- **FR-1.1–1.3** (manifest fatia 1) → **Épico 12** (Tier 0) · **FR-1.4–1.6** (Index, all-off, granularidade) → **Épico 10 ampliado**
- **FR-2.1–2.4** (Config de IA/BYO key) → **Épico 21** (primeiras stories — DIR-9)
- **FR-3.1–3.5** (Plataforma C5) → **Épico 12** (Tier 0)
- **FR-4.14** (#24 nome às categorias) → **Épico 18** (Onda 6) · **FR-4.15** (#15 waiting_on) → **Épico 12** (backend) + **Épico 17** (UI) · **FR-4.16** (#23 herança de status) → **Épico 12**
- **FR-6.1–6.6** (Home: Dashboard/Hoje) → **Épico 17** (Onda 2b; FR-6.4 = desenho na 2b, implementação da oferta no Épico 10)
- **FR-8.R** (refinos C3: #16/#17/#18/#22) → **Épico 16** (Onda 5)
- **FR-10.1–10.7** (Journalling, absorvendo a Gratidão) → **Épico 16** (Onda 5)
- **FR-11.1–11.6** (Alimentação #5a) → **Épico 20**
- **FR-12.1–12.8** (Pressão Arterial #20) → **Épico 22**
- **FR-13.1–13.12** (Análises fases a/b/c) → **Épico 21** (fase c gateada: só após o Épico 22 — D7)
- **FR-14.1–14.9** (Custom Collections C6) → **Épico 19** (1º investimento do Tier 3)
- **FR-15.5–15.6** (Épico 10 ampliado + LGPD) → **Épico 10 ampliado**
- *Paridade de migração (sem FR novo):* navegação → **Épico 13** · núcleo BuJo (FR-4.1–4.13) + deltas dos spines → **Épico 14** · captura (FR-5.1–5.4) → **Épico 15** · módulos (FR-7/8/9) → **Épico 16** · Daily → **Épico 17** · auth/config → **Épico 18**

**NFRs (transversais):**

- **NFR-1 (mobile real)** → Épico 2 (casca/nav) + tecido nos épicos de feature (3–9)
- **NFR-2 (<2s execução diária)** → Épicos 3, 4 (prefetch paralelo do Daily Log)
- **NFR-3 (isolamento)** → Épico 1 (fail-closed, gate `test_isolation` verde antes de modelos de domínio) + verificado por épico
- **NFR-4 (imutabilidade sistêmica)** → Épicos 4 (linhagem), 6 (snapshot hábitos), 8 (snapshot medicamentos)
- **NFR-5 (dev/prod)** → Épico 1 (branches do Neon, settings split)
- **NFR-6 (uptime)** → MVP solo em regime best-effort; Épico 10.0 antes de multiusuário (AR-21/AR-22)
- **NFR-7 (segurança de IA)** → Épico 21 — invariante de arquitetura, eliminada por construção (AD-25)
- **NFR-8 (privacidade de dados sensíveis)** → Épicos 21 e 22 (via AR-30)
- **NFR-9 (resiliência de integrações)** → Épico 20 (AR-29)

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
- **AR-23** (manifest/registry) · **AR-24** (refinos de service) · **AR-25** (AutomationToken/C5) → Épico 12
- **AR-26** (Journalling) → Épico 16 (remoção do legado da Gratidão → Épico 18) · **AR-27** (home compartilhada) → Épico 17
- **AR-28** (C6) → Épico 19 · **AR-29** (Alimentação) → Épico 20 · **AR-30/31/32** (IA global, Análises a/b, fase c) → Épico 21 · **AR-33** (Pressão Arterial) → Épico 22

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
- **UX-DR21** (contrato visual novo) → transversal a todos os épicos novos com UI (CAP-3; estabelecido na Fundação/Onda 1, já fechada)
- **UX-DR22** (app shell novo) → Épico 13
- **UX-DR23** (spines do núcleo BuJo M06–M08), **UX-DR24** (recorrentes M09), **UX-DR25** (migração/catch-up M10), **UX-DR26** (Task Row/detalhe canônicos) → Épico 14 (gate vertical de implementação)
- **UX-DR27** (pictogramas Phosphor) → Épico 16 (Hábitos/Saúde)
- **UX-DR28** (alternador do Hoje) → Épico 17
- **UX-DR29** (access surface) → Épico 18
- **UX-DR30** (aceite UX por story + DoR) → transversal — toda story de UI dos Épicos 13–22
- **UX-DR31** (story x.0 de UX) → Épicos 13–22 com UI + Épico 10 ampliado (gate de entrada)

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
**FRs covered:** FR-4.1 (Daily Log), FR-4.3, FR-4.4, FR-4.5, FR-4.6 *(ex-FR-1.1/1.3–1.6 — Anexo A)*
**Depende de:** Épicos 1, 2. **Standalone:** rastreia o hoje sem precisar de migração/planejamento.

### Epic 4: Logs de Planejamento, Migração & Recorrentes
Completa o **ciclo BuJo** — o marco de "abandono do caderno". Consome o agregado `Task` congelado (não o altera). Histórias **estritamente ordenadas**: (1) Logs Weekly/Monthly/Future → (2) migração diária → (3) rollover semanal/mensal + pull do Future Log → (4) **Catch-Up** para dias pulados (depende de 2+3) → (5) templates recorrentes com placement manual → (6) fechamento de ciclos + **arquivo** consultável. Decisão explícita por tarefa com linhagem (`migration_count`).
**FRs covered:** FR-4.1 (Weekly/Monthly/Future), FR-4.2, FR-4.7 a FR-4.13 *(ex-FR-1.x — Anexo A)*
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
Hugo configura hábitos (grupos, booleano/numérico, peso, meta, bonus), marca o tracker diário e acompanha a **completude ponderada**, com snapshot imutável por dia, pesos prospectivos, multiplicador por tipo de dia (fim de semana/feriado), desativação/reativação, histórico por data e **gráfico de evolução** com anotação de mudanças reais (FR-7.10, ex-2.10). Ordem interna: model + snapshot de pesos → multiplicador de tipo de dia → gráfico (lê snapshots, vem por último).
**Espinha do ritual:** a história final acopla o widget de hábitos ao fluxo da manhã no Daily Log — não uma ilha isolada.
**FRs covered:** FR-7.1 a FR-7.10 *(ex-FR-2.x — Anexo A)*
**Depende de:** Épicos 1, 3 (Daily Log para o widget). **Standalone:** sistema de hábitos completo.

### Epic 7: Métricas de Saúde
Hugo cria **campos de saúde dinâmicos** (JSONB, validados na camada de serviço contra `health_field_definitions`), preenche o log diário (campos de ontem no topo, ritual matinal) e consulta o histórico em três visualizações: tabela dia a dia, gráficos de evolução e dashboard de período.
**Espinha do ritual:** a história final acopla as métricas de ontem ao fluxo da manhã.
**FRs covered:** FR-8.1, FR-8.2, FR-8.3 *(ex-FR-3.1–3.3 — Anexo A)*
**Depende de:** Épicos 1, 3. **Standalone:** tracking de métricas de saúde completo.

### Epic 8: Medicamentos
Hugo gerencia **medicamentos** com modelo versionado (slot estável `medications.title` + `medication_substance_versions` + `medication_schedule_versions` com dose JSONB + `time_blocks` dinâmicos) e confirma a adesão diária por bloco ("tomar remédios da manhã") ou individual, com distinção de **dose perdida** (sinal clínico). Materialização ansiosa em `medication_day_entries`; ativo/inativo com histórico preservado.
**Espinha do ritual:** a confirmação de medicamentos da manhã integra o ritual matinal.
**FRs covered:** FR-9.1, FR-9.2, FR-9.3, FR-9.4 *(ex-FR-3.4–3.7 — Anexo A)*
**Depende de:** Épicos 1, 3. **Standalone:** cadastro e confirmação de medicamentos completos. *(Sem FK para `health` — domínio independente, AD-07/§7.2.)*

### Epic 9: Diário de Gratidão
Hugo registra entradas de texto livre (múltiplas por dia, sem estrutura) e navega o histórico por data e por mês.
**Espinha do ritual:** acessível por link contextual no Daily Log de ontem, integrado ao ritual matinal (UJ-1).
**FRs covered:** FR-10.4 + FR-10.5-diário *(ex-FR-4.1/4.2 — a serem absorvidos pelo Journalling, FR-10.7/Épico 16)*
**Depende de:** Épicos 1, 3. **Standalone:** diário de gratidão completo. *(O antigo "resumo mensal por IA" virou apenas um Modelo de Relatório possível — FR-13.12/Épico 21.)*

### Epic 10: Gestão de Usuários — **ampliado** *(CC 2026-07-22; posição na fila: depois de TODAS as ondas, antes do Tier 3 — D8)*
Amigos entram num produto **observável** e ganham um espaço isolado que **nasce só com o núcleo**. Sequência interna: observabilidade mínima (Story 10.0 — AR-21/AR-22, antes de convidar externos) → **peças 2–4 do #14**: página de toggles/**Index** de collections (FR-1.4), **default all-off** para convidados (FR-1.5) e **empty-state do dashboard como superfície de oferta** (implementação do desenho feito na Onda 2b — FR-6.4 — contrato fechado, sem reabertura) → recuperação de senha (10.8 — FR-0.5, antes do convite) → convite por email (10.1) → onboarding (10.2). Inputs de design: **granularidade da flag** espaço × usuário (FR-1.6); **cláusulas LGPD** — consentimento explícito para "leitura por IA em nuvem" de dados de terceiros e fluxo 100% manual como padrão (FR-15.6, DIR-13).
**FRs covered:** FR-15.1, FR-15.2, FR-15.3 *(ex-FR-6.1–6.3)*, FR-15.5, FR-15.6, FR-0.5 *(recuperação de senha — IR 2026-07-23)*, FR-1.4, FR-1.5, FR-1.6, FR-6.4 (implementação da oferta)
**Depende de:** Épico 1 (isolamento), Épico 12 (manifest) e todas as ondas (o convidado do dia zero cai na home nova). **Standalone:** produto multiusuário observável com ativação por escolha deliberada. **x.0 de UX:** sim — superfícies novas (Index; oferta no dashboard). *(FR-15.4 competição fica no backlog.)*

> **Ciclo pós-MVP (CC 2026-07-22):** os Épicos 12–22 abaixo rastreiam a **ordem mestre** do proposal §4 — autoridade única de sequenciamento (Tier 0 → 2a → 3 → 4 → 5 → spec da home → 2b → 6 → Épico 10 ampliado → Tier 3: C6 → Alimentação → Análises a/b → #20 → Análises c). Épicos com superfície de UI nascem com **story x.0 de UX** (DIR-15/UX-DR31), executada pelo rito bmad-ux — o story-automator só entra após a x.0 `done`. Toda story de UI referencia o design system 2026-07-17 (UX-DR21/30). A numeração continua do 11 (identificadores, não ordem).

> **Revisão party-mode (2026-07-22 — John/Winston/Amelia/Sally):** estrutura aprovada com ajustes de registro. Decisão Hugo: **(a) aliases finos** — os endpoints legados de migração/catch-up permanecem como aliases finos sobre a fila unificada do Épico 14 até a remoção no Épico 18. **Premissa blindada: o Daily legado permanece plenamente utilizável até o Épico 17 entrar** (o Épico 16 aposenta só a Gratidão; nada além). Falso alarme esclarecido: a captura externa do Épico 12 cai no Brain Dump legado, visível desde o dia 1 (AD-19). Notas de fatiamento e aceites mecânicos (Amelia) aplicam-se na criação das stories (step 3).

> **Estratégia de promoção a prod (decisão Hugo, 2026-07-23 — auditoria de premissas):** durante as ondas de migração, **prod permanece no sistema atual**; todo o trabalho roda na branch `dev` (homologação — fluxo vigente desde 2026-07-22). A **primeira promoção a prod** acontece apenas quando o design system antigo puder ser abandonado (validação completa em dev, ≈ Épico 18). Consequências: a coexistência por rota e o rollback por superfície são mecanismos do ambiente de desenvolvimento/homologação; **o rollback de prod é não promover**; a troca global de tema ao final é aceitável (sem exigência de namespace à prova de troca irreversível). O [IR] reconcilia esta nuance com o migration-plan ("rota segura de rollback por superfície"). Decisões complementares (Hugo, 2026-07-23 — lentes de stakeholder): **sem gate formal de validação pré-promoção** (usuário único; erro crítico em prod se corrige via quick-dev) e **janela da Gratidão aceita** — entre a entrega do Journalling (É16, dev) e o merge (≈É18), Hugo simplesmente não preenche a Gratidão em prod; a data migration roda na promoção sem divergência relevante.

> **Terminologia — "Index" (decisão Hugo, 2026-07-23):** a superfície de ativação de collections chama-se **Index** — estrutura canônica do método Bullet Journal (a página que lista as collections do caderno) — em lugar de "cardápio". O nome dissolve por vocabulário o risco de leitura como loja/marketplace (FR-1.4) e reforça a fidelidade ao método. O Index digital acumula ativação além de listagem; a x.0 do Épico 10 (10.3) valida a comunicação da ação e decide o rótulo pt-BR (Index × Índice). ~~O PRD (FR-1.4/6.4/15.5) mantém "cardápio" até o [IR]/[PRD] aplicar o rename.~~ **Rename aplicado ao PRD no [PRD] update de 2026-07-23** (revisão IR — FR-1.4, FR-6.4, FR-15.5 e correlatas).

### Epic 12: Tier 0 — Plataforma e Quick Wins *(sem UI)*
Hugo captura itens e consulta o resumo do dia **de fora do app** (atalho iOS/Back Tap; widget Scriptable — ambos do lado do usuário) com um **token de automação** escopado e revogável; tarefas migradas **preservam o `started`** (#23); tarefas ganham a flag `waiting_on` no backend (#15 — UI fica na Onda 2b); e o produto ganha a **espinha do modelo núcleo+collections** — o manifest fatia 1, com aceite **pixel-idêntico**. Nenhuma mudança visível no app.
**FRs covered:** FR-1.1, FR-1.2, FR-1.3, FR-3.1 a FR-3.5, FR-4.15 (backend), FR-4.16
**ARs:** AR-23, AR-24, AR-25. **DIRs:** DIR-4, DIR-5, DIR-6, DIR-11, DIR-12(a). **Depende de:** épicos entregues (1–9, 11). **Standalone:** automação externa funcionando + refinos de service + manifest extraído. **x.0 de UX:** não (sem UI — DIR-15).
*Notas da revisão (party-mode 2026-07-22):* a captura externa aparece **no Brain Dump legado desde o dia 1** (badge via refetch — AD-19); o contrato de `GET /api/summary/today` nasce **compatível com os ciclos de vida M06–M10** (contract-first — os spines já estão escritos); testes da herança de status escritos **no nível da função de regra**, não do endpoint (o Épico 14 retoca o mesmo service); consumidores futuros do manifest já resolvidos por AD-17/AD-22 (ativação = consulta separada que filtra o registro; filhas de C6 nunca entram no registro).

### Epic 13: Onda 2a — App Shell no Sistema Novo
Hugo navega o app inteiro num **shell do design system novo**: sidebar (240/64px), bottom-nav, captura persistente e layout derivados do **manifest** por map puro (dados puros — sem server state), com paridade de navegação, badge do Brain Dump, estados preservados e WCAG 2.2 AA. Primeira superfície visível da migração; coexistência por rota (superfícies internas seguem no legado até suas ondas).
**FRs covered:** consumo de FR-1.3 (navegação derivada); paridade da navegação entregue (sem FR de produto novo)
**UX-DRs:** UX-DR21, UX-DR22, UX-DR30. **Depende de:** Épico 12 (manifest). **Standalone:** shell novo com paridade e rollback por superfície. **x.0 de UX:** sim, **enxuta** — catálogo de ícones por destino + estados do shell (estrutura já aprovada na Fundação/Onda 1), **incluindo obrigatoriamente** os estados **"nav mínima"** (zero/uma collection ligada — antecipa o default all-off do Épico 10) e **"superfície legada dentro do shell novo"** (o seam da convivência das Ondas 2a–5 — tratamento definido, não acidente).
*Notas da revisão (party-mode 2026-07-22):* setup de axe-core no Playwright entra como task da primeira story (WCAG testável); paridade por checklist enumerada; a story referencia explicitamente os mocks dos 3 testes compartilhados.

### Epic 14: Onda 3 — Núcleo BuJo no Sistema Novo *(gate vertical de implementação)*
Hugo planeja e migra no sistema novo: **Weekly Board** multi-faixa + pool "Sem dia definido", **Monthly Board** calendário completo, **Future Log** com horizonte de 8 meses + "Ir para mês…", **Migração/Catch-Up como ritual unificado dentro do shell**, biblioteca de **Recorrentes** com soft delete e **Arquivo**. Inclui os **deltas de domínio aprovados nos spines M06–M10** como **stories de domínio próprias** (decisão Hugo neste rito, 2026-07-22): ciclos de vida explícitos (Em planejamento/Em andamento/Finalizada), fila unificada de migração (mescla `/migration/queue/` + `/catch-up/queue/`), soft delete de template, decisões-snapshot dos rituais, horizonte/seletor do Future — **nunca como CSS do redesign**. As regras do método (migração manual, 6 estados, linhagem, placement manual) permanecem intactas. Assume o papel de **gate vertical** da migração (D2).
**FRs covered:** paridade FR-4.1–4.13 + deltas de domínio dos spines (EXPERIENCE.md §M06–M10 "Decisions for Architecture and Stories")
**UX-DRs:** UX-DR23, UX-DR24, UX-DR25, UX-DR26, UX-DR30. **Depende de:** Épico 13 (shell). **Standalone:** núcleo BuJo completo no sistema novo. **x.0 de UX:** sim — cobre o que falta (ex.: Arquivo); M06–M10 já aprovados e promovidos.
*Notas da revisão (party-mode 2026-07-22):* **decisão (a) do Hugo** — os endpoints legados de migração/catch-up viram **aliases finos** sobre a fila unificada, mantidos até o Épico 18 (**Daily legado plenamente utilizável até o Épico 17** — premissa blindada); ordem interna **domínio-primeiro** (deltas M06–M10 maturando sob a UI legada; UI depois — gate testável em camadas); ciclos de vida fatiados em story backend (model+migration+service+constraints) + story de integração por superfície; a **Task Row base do sistema novo nasce aqui** e o Épico 17 apenas a especializa (evita refactor duplo); é o **caminho crítico** do roadmap — gate de saída = épico completo, e o [SP] prioriza de acordo.

### Epic 15: Onda 4 — Captura no Sistema Novo
Hugo captura em qualquer contexto no sistema novo: **Brain Dump** (inbox + processamento manual), **badge persistente** (server state derivado preservado), **captura persistente conforme o shell** e **Capture Sheet** mobile — mantendo otimismo, conectividade e estados existentes.
**FRs covered:** paridade FR-5.1–5.4
**UX-DRs:** UX-DR21, UX-DR30. **Depende de:** Épico 13. **Standalone:** padrão de inbox e captura mobile provado no sistema novo. **x.0 de UX:** sim.

### Epic 16: Onda 5 — Módulos: Migração + Refinos + Journalling
Os módulos diários vivem no sistema novo **e ficam melhores**: **Hábitos** (com pictogramas Phosphor/`iconKey` — UX-DR27); **Saúde-Métricas com o pacote C3** — #16 reordenar → #17 editar (seguro × destrutivo — DIR-3) → #18 percentual + enum multi-seleção → #22 grupos de métricas; **Medicamentos** (Saúde e Medicamentos = **2 collections** no grupo visual "Saúde"; verificar exposição do prescritor — AD-07 já modela `prescribed_by`); e o **Journalling nasce** direto no sistema novo **absorvendo a Gratidão** (campo seed "Gratidões", migração das entradas, aposentadoria da superfície antiga na mesma onda — zero período de duas verdades). Épico pesado por design (risco 2 do proposal): **stories pequenas**; o [SP] pode dividir a onda em lotes.
**FRs covered:** FR-8.R (#16/#17/#18/#22), FR-10.1 a FR-10.7; paridade FR-7.1–7.10, FR-8.1–8.3, FR-9.1–9.4
**ARs:** AR-26. **UX-DRs:** UX-DR21, UX-DR27, UX-DR30. **DIRs:** DIR-3, DIR-8, DIR-14. **Depende de:** Épicos 13–14. **Standalone:** todos os módulos no sistema novo com refinos; Gratidão absorvida. **x.0 de UX:** sim — **por módulo** (Hábitos; Saúde+Medicamentos **na mesma sessão de bmad-ux** — grupo visual "Saúde" coerente; Journalling).
*Notas da revisão (party-mode 2026-07-22):* sequência interna do Journalling: **story de verificação da migração** (AC: contagem origem = destino + amostra conferida) **antes** da story de aposentadoria da superfície antiga, com **freeze de escrita** da Gratidão (incl. o que o capture/summary do AutomationToken referencia); #18 (valor→array) fatiado em story backend (migration + testes de reversibilidade) e story frontend (forms + charts) — nunca no mesmo diff.

### Epic 17: Onda 2b — Daily + Home (Dashboard + Hoje)
Hugo entra pós-login num **Dashboard-panorama acionável** (cards das collections ativas + card do dia com rapid logging e migrações pendentes — captura a um toque preservada) e trabalha no **Hoje**; o **Daily Log** migra; a **UI do `waiting_on`** (indicador + filtro) nasce aqui (D3); o **empty-state/Index é desenhado** (a oferta implementa no Épico 10). Componente único compartilhado das tasks do dia (AR-27): mesmas query keys, capacidade idêntica, muda o entorno — **Hoje = trabalhar / Dashboard = ver** (D4). **Pré-requisito duro: spec da nova home aprovada (bmad-ux)** — formalmente a **x.0 ampliada** desta onda; valida a sub-condição "≥1 collection" e define os indicadores de uso (FR-6.6).
**FRs covered:** FR-6.1 a FR-6.6, FR-4.15 (UI)
**ARs:** AR-27. **UX-DRs:** UX-DR28, UX-DR21, UX-DR30; revogação parcial do UX-DR16 aplicada aqui. **Depende de:** Épicos 13–16 (fim da fila de superfícies — D2) + spec da home. **Standalone:** home nova + Daily no sistema novo. **x.0 de UX:** sim — **a spec da home (ampliada)**.
*Notas da revisão (party-mode 2026-07-22):* a spec da home roda **em paralelo com a cauda do Épico 16** (mitigação do risco 3 do proposal — o gargalo vira sobreposição; só os indicadores dos módulos esperam); o mockup do empty-state aprovado aqui é **contrato fechado** para o Épico 10 (sem reabertura).

### Epic 18: Onda 6 — Consolidação e Remoção do Legado
Uma linguagem só: **Configurações** (incluindo **#24 — nome às categorias**, FR-4.14), **auth no padrão "Limiar do workspace"** (UX-DR29), superfícies residuais migradas e a **remoção planejada do legado** — tokens/componentes antigos e o app `gratitude` (código + tabela, após verificação da migração — AR-26). Gate de saída: nenhuma rota ativa depende do sistema antigo; exceções eliminadas ou formalizadas.
**FRs covered:** FR-4.14; paridade FR-0.2 (superfícies de auth)
**UX-DRs:** UX-DR29, UX-DR21, UX-DR30. **Depende de:** Épicos 13–17. **Standalone:** migração concluída, legado removido. **x.0 de UX:** sim (Config + auth).
*Notas da revisão (party-mode 2026-07-22):* a remoção inclui os **aliases finos** das queues legadas (decisão (a) do Épico 14); aceites mecânicos: `grep` zero de imports de tokens/componentes legados; drop da tabela `gratitude` **condicionado** ao AC de contagem da migração (Épico 16).

### Epic 19: Tier 3 · Custom Collections (C6)
Hugo cria **as próprias collections** — caso motor: logs do Canadá (#1): Viagens, Moradias, Empregos — com **schema tipado próprio** (independente do Épico 7 — DIR-14), campo-array de sub-registros com **máx. 1 nível**, **edição segura × destrutiva** (DIR-3) e **filhas dinâmicas na sidebar** (server state confinado ao grupo do container; a story registra os mocks nos 3 testes compartilhados — AR-28). Container "Custom Collections" como entrada estática única no manifest; rota paramétrica única; cidadania no ecossistema default off; **sem export no MVP** (DIR-14).
**FRs covered:** FR-14.1 a FR-14.9
**ARs:** AR-28. **DIRs:** DIR-3, DIR-14. **Depende de:** Épicos 12–13. **Standalone:** framework completo de collections custom. **x.0 de UX:** sim.

### Epic 20: Tier 3 · Alimentação (#5a)
Hugo vê **refeições, horários, fotos e a janela de jejum** do foodLog dentro do bujo: espelho local read-only com **sync on-read + TTL e refresh manual** (sem scheduler — django-q2 não é pré-requisito), credenciais no `settingsSchema` da collection, **resiliente por construção** (NFR-9: foodLog fora do ar nunca quebra o bujo; indicador de última sincronização); **fotos referenciadas** do R2 do foodLog, nunca copiadas — e **nunca contexto de IA** (DIR-10). Define o padrão herdável do archetype integração; métricas viram fontes de 1ª classe para Análises.
**FRs covered:** FR-11.1 a FR-11.6
**ARs:** AR-29. **DIRs:** DIR-10. **Depende de:** Épicos 12–13; posição após o Épico 19 é ordem da fila (D7), não dependência técnica. **Standalone:** collection de integração completa. **x.0 de UX:** sim.

### Epic 21: Tier 3 · Análises + Configuração de IA *(fases a/b/c)*
Hugo configura a **chave de IA global** (BYO key criptografada; `ai_available`; tag "função de IA" — FR-2 entra como as **primeiras stories deste épico**, decisão Hugo 2026-07-22/DIR-9) e compõe **Modelos de Relatório**: **fase a** (dicionário semântico: anotações + conceitos) → **fase b** (geração sob demanda: texto + gráficos via `serie_ref`/Recharts; catálogo allowlist + DSL compilado — **a IA nunca toca o banco nem produz números**, NFR-7) → **fase c** (agendamento django-q2 + Batch API + cap mensal + skip por hash). Badge "dado lido por IA" com índice reverso e degradação graciosa (DIR-7); relatórios médicos = Modelo especializado (FR-13.11). **Gate explícito (decisão Hugo 2026-07-22): as stories da fase c só entram após o Épico 22, conforme a ordem mestre (D7).**
**FRs covered:** FR-2.1 a FR-2.4, FR-13.1 a FR-13.12
**ARs:** AR-30, AR-31, AR-32. **DIRs:** DIR-1, DIR-7, DIR-8, DIR-9. **Depende de:** Épico 12; leitura do espelho de Alimentação (Épico 20) é fonte opcional com degradação graciosa. **Standalone:** análises completas nas fases a/b (c gateada). **x.0 de UX:** sim.

### Epic 22: Tier 3 · Pressão Arterial (#20)
Hugo registra a pressão **por foto**: a IA **transcreve** (nunca sugere — fronteira UX-DR19) sob **human-in-the-loop obrigatório** (DIR-2: guia de crop → structured output com instrução de recusa → formulário pré-preenchido com badge de confiança por campo → confirmação explícita; **fallback manual sempre visível**); leituras avulsas ou **sessões 7-2-2**; dashboard clínico de **média móvel de 7 dias**; evidência auditável (foto + JSON bruto); `source` enum **desde a 1ª migration** (ponte Apple Health preparada via AutomationToken do Épico 12); fotos em **R2 privado dedicado**.
**FRs covered:** FR-12.1 a FR-12.8
**ARs:** AR-33. **DIRs:** DIR-1, DIR-2. **Depende de:** Épico 21-fase a (`ai_available`/FR-2) e Épico 12 (endpoint com token p/ `import` futuro). **Standalone:** collection de PA completa — captura manual funciona mesmo sem chave de IA. **x.0 de UX:** sim.
*Nota da revisão (party-mode 2026-07-22):* o setup `django-storages`→R2 (primeira mídia binária do produto) é **story própria de infraestrutura**, validada em dev antes das stories de feature.

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

> **3º lote do Épico 11 — nova story via Correct Course (2026-07-16).** A Story 11.12 abaixo nasce da questão em aberto registrada na Story 11.8: o modelo `RecurringTaskTemplate` **não tem** campo `category` (só o `Task` tem, via `Category`/`CategoryEnum`). O Hugo decidiu fechá-la como story curta. Fecha também o item em aberto da **AC4 da Story 11.8** (exibir a categoria da recorrência no placement). Origem: retro do 2º lote + decisão direta do Hugo. **Diferente das stories só-de-frontend deste épico, esta muda schema** (migração + regen de `schema.yaml`/`types.gen.ts`).

### Story 11.12: Categoria em templates recorrentes

As a Hugo,
I want atribuir uma categoria (cor) aos templates de tarefas recorrentes,
So that a recorrência já carregue sua categoria e a tarefa gerada herde a cor sem eu reclassificar toda vez (fecha a questão em aberto registrada na Story 11.8).

**Acceptance Criteria:**

**Given** o modelo `RecurringTaskTemplate` (backend),
**Then** ganha um campo `category` opcional/nulável que **reusa os valores do `Category`/`CategoryEnum` já existente no `Task`** (teal/purple/pink/yellow/green/blue) — sem inventar enum novo; template sem categoria continua válido (`null`).

**Given** a mudança de modelo,
**Then** há migração Django + serializer atualizado + **regen do contrato** — `schema.yaml` do OpenAPI e `types.gen.ts` gerado; esta story **muda schema**, ao contrário das stories só-de-frontend do 2º lote.

**Given** o CRUD de templates (`RecurringTemplateManager`),
**When** crio/edito um template,
**Then** há um seletor de categoria (as mesmas cores do `Task`), a categoria escolhida é persistida e exibida na listagem/edição; deixá-la vazia é permitido (sem categoria).

**Given** o modal/seção de placement de recorrentes (`RecurringPlacementDialog`/`RecurringPlacementSection`, Stories 11.3/11.8),
**Then** a categoria do template é exibida junto às demais infos — fechando o item em aberto da **AC4 da Story 11.8**; template sem categoria simplesmente não mostra o campo (sem placeholder ruidoso).

**Given** um template **com** categoria colocado/gerado como `Task` real (fluxos de placement manual e de auto-geração já existentes),
**Then** a `Task` criada **herda** a `category` do template — e permanece **editável** depois na tarefa (sem travar o campo).

**Given** um template **sem** categoria colocado/gerado,
**Then** a `Task` criada nasce sem categoria (`null`), como hoje — sem regressão.

*Nota:* story curta, mas **toca backend + contrato + frontend** (migração, serializer, regen de `schema.yaml`/`types.gen.ts`, seletor no CRUD e exibição no placement) — não é só-frontend.

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

## Epic 10: Gestão de Usuários — ampliado *(CC 2026-07-22)*

> ⚠️ Escopo original mantido (âncora do AD-12; Story 10.0 pré-requisito para convidados) e **ampliado pelo CC 2026-07-22** (FR-15.5/15.6): peças 2–4 do #14 (Index, default all-off, empty-state como oferta) + LGPD. **Posição na fila: depois de TODAS as ondas, antes do Tier 3 (D8).** Ordem de execução interna: **10.0 → 10.3 → 10.4 → 10.5 → 10.6 → 10.7 → 10.8 → 10.1 → 10.2** (observabilidade primeiro; Index antes do convite; recuperação de senha antes do convite; convite/onboarding por último). Stories 10.3–10.7 escritas no rito [CE] 2026-07-22; Story 10.8 e refresh das 10.1/10.2 no rito [CE] 2026-07-23 (correções roteadas pelo [IR]).

> ✅ **Pendência de PRD resolvida (2026-07-23, via [IR]→[PRD]→[CE]):** a pendência sinalizada pelas lentes de stakeholder (recuperação de senha não existia em nenhum FR — o Épico 2 entregou cadastro/login/sessão sem requisito de reset; irrelevante para o dono do banco, real para convidados) foi corrigida em 2026-07-23: o [PRD] criou o **FR-0.5** (recuperação de senha) e este épico ganhou a **Story 10.8**, posicionada **antes da 10.1** na ordem interna — convidado trancado para fora deixou de ser risco de onboarding.

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

Como Hugo (operador),
Quero convidar novos usuários por email,
Para que amigos possam adotar o sistema quando ele estiver estável (FR-15.1 *(ex-FR-6.1 — Anexo A do PRD)*).

*(Refresh [CE] 2026-07-23 — achado 🟠 do [IR]: citação de FR renumerada — a numeração antiga hoje colide com o FR-6 Home/Dashboard — e ACs elevados ao padrão do ciclo pós-MVP com estados de erro.)*

**Critérios de Aceitação:**

**Dado que** o fluxo de convite,
**Quando** Hugo envia um convite por email,
**Então** o sistema gera um convite associado ao email e dispara a mensagem,
**E** o convite tem validade e estado (pendente/aceito/expirado).

**Dado que** a pré-condição de isolamento,
**Quando** o convite é criado,
**Então** reusa o schema multi-tenant + manager fail-closed já entregue no Épico 1 (sem nova fundação de isolamento),
**E** o caminho de operador permanece explícito e separado do caminho de usuário.

**Dado que** uma falha no envio do email (provedor indisponível, endereço rejeitado),
**Quando** Hugo dispara o convite,
**Então** a falha fica **visível ao operador** — estado do convite reflete o erro na UI, além do log/evento seguro com `request_id` (Story 10.0),
**E** Hugo pode reenviar o convite sem criar registro duplicado.

**Dado que** a lista de convites do operador,
**Quando** Hugo a consulta,
**Então** vê estado e validade de cada convite,
**E** pode **reenviar** um convite pendente ou expirado (novo token; o anterior é invalidado) — este é o caminho de reenvio referenciado pelo onboarding (10.2).

### Story 10.2: Onboarding de usuário convidado com espaço isolado

Como usuário convidado,
Quero aceitar o convite e ter meu próprio espaço de dados isolado,
Para que eu use o sistema sem cruzar dados com nenhum outro usuário (FR-15.2, FR-15.3 *(ex-FR-6.2, FR-6.3 — Anexo A do PRD)*).

*(Refresh [CE] 2026-07-23 — achado 🟠 do [IR]: citações de FR renumeradas + ACs elevados ao padrão do ciclo pós-MVP com estados de erro.)*

**Critérios de Aceitação:**

**Dado que** um convite válido,
**Quando** o usuário o aceita,
**Então** uma conta é criada com seu próprio espaço de dados completamente isolado (sem espaço compartilhado entre usuários no MVP),
**E** o isolamento é garantido pelo manager auto-escopado da fundação (verificado por `test_isolation`).

**Dado que** o novo usuário autenticado,
**Quando** ele usa o app,
**Então** enxerga apenas seus próprios dados em todas as superfícies,
**E** nenhum dado de outro usuário é acessível em nenhuma circunstância (NFR-3).

**Dado que** um link de convite expirado ou inválido (token inexistente ou adulterado),
**Quando** o convidado o abre,
**Então** vê uma mensagem clara do que aconteceu (sem stack trace nem 404 cru),
**E** com o caminho de reenvio indicado: orientação para pedir um novo convite ao operador (o reenvio da 10.1 gera novo token e invalida o anterior).

**Dado que** um convite já aceito,
**Quando** o mesmo link é aberto novamente,
**Então** o sistema não cria conta duplicada nem reabre o onboarding,
**E** direciona para o login — indicando "esqueci minha senha" (Story 10.8) caso o convidado não lembre a credencial.

### Story 10.3: [UX] Mockups do Index e da oferta no dashboard (x.0 do escopo ampliado)

Como Hugo,
Quero os mockups do Index de collections e da oferta no dashboard aprovados no bmad-ux,
Para que as superfícies novas do épico nasçam desenhadas — respeitando o contrato fechado da Onda 2b (UX-DR31; DIR-15).

**Critérios de Aceitação:**

**Dado que** o empty-state do dashboard foi **fechado como contrato** na spec da home (Story 17.0 — sem reabertura),
**Quando** esta x.0 rodar,
**Então** desenha a página de toggles/Index (FR-1.4) e a materialização da oferta sobre o desenho já aprovado — sem alterar o contrato,
**E** cobre os estados: tudo desligado (convidado novo), parcialmente ligado, tudo ligado (Hugo), e desativação com dados preservados; promovida a DESIGN/EXPERIENCE antes das stories de implementação novas.

### Story 10.4: Flags de ativação de collections (backend + granularidade)

Como Hugo (dono do produto),
Quero o modelo de ativação por collection com a granularidade decidida,
Para que ligar/desligar collections seja server state que filtra o manifest (FR-1.4 backend, FR-1.5, FR-1.6; AD-17 item 6).

**Critérios de Aceitação:**

**Dado que** a granularidade (espaço × usuário) é decidida no desenho deste épico (FR-1.6),
**Quando** a story inicia,
**Então** a decisão é registrada com racional no próprio épico (input de design resolvido — hoje cada usuário é seu espaço, FR-15.3) antes da migration,
**E** a migration cria o modelo de ativação conforme decidido; branch e2e atualizada.

**Dado que** o manifest é agnóstico à flag,
**Quando** o endpoint de ativação entra,
**Então** a consulta devolve o conjunto ativo por usuário e o frontend **filtra** o registro estático (nenhum campo de flag dentro do manifest),
**E** usuários existentes nascem com tudo ligado (sem mudança de comportamento); usuários novos nascem **all-off** (FR-1.5); o núcleo BuJo não participa (FR-1.1).

### Story 10.5: Index de collections (página de toggles)

Como Hugo (e cada convidado),
Quero ligar e desligar collections numa página de escolha,
Para que o produto seja o núcleo + o que eu deliberadamente ativar (FR-1.4, FR-15.5; #14 peça 2).

**Critérios de Aceitação:**

**Dado que** o mockup da 10.3 e o backend da 10.4,
**Quando** o Index entra (em Configurações),
**Então** cada collection coded aparece com toggle; desativar **preserva os dados** e remove a superfície da navegação; reativar restaura tudo,
**E** o núcleo não aparece no Index; a mudança reflete na sidebar/bottom-nav imediatamente (invalidação da consulta de ativação).

**Dado que** o estado "collection desligada" (condição (c)),
**Quando** uma collection está desligada,
**Então** rotas diretas para ela respondem com o tratamento definido no mockup (sem 404 cru; convite de reativação).

### Story 10.6: Empty-state do dashboard como oferta

Como convidado no primeiro login,
Quero ver o meu dia + um convite claro para ativar collections,
Para que a home vazia seja uma vitrine, não um deserto (FR-6.4 implementação; #14 peça 4).

**Critérios de Aceitação:**

**Dado que** o slot criado na Story 17.3 e o contrato fechado da 17.0,
**Quando** um usuário sem collections ativas entra no dashboard,
**Então** vê o núcleo (card do dia acionável) + a oferta de collections, cada convite ligando ao toggle do Index (10.5),
**E** ao ativar a primeira collection, o card correspondente aparece no panorama sem reload.

### Story 10.7: LGPD — consentimento de IA em nuvem para terceiros

Como convidado,
Quero decidir explicitamente se meus dados sensíveis podem ser lidos por IA em nuvem,
Para que o padrão seja o fluxo 100% manual e o consentimento seja meu (FR-15.6; DIR-13; NFR-8).

**Critérios de Aceitação:**

**Dado que** um usuário terceiro (não-owner),
**Quando** ele acessa qualquer fluxo dependente de IA (Análises, PA foto+IA, `contexto_ia`),
**Então** o fluxo manual é o padrão e a função de IA só destrava após consentimento explícito registrado (data + escopo),
**E** o consentimento é revogável em Configurações; sem consentimento, as superfícies degradam para o manual (tag "função de IA" explica).

**Dado que** o onboarding (10.2),
**Quando** um convidado entra,
**Então** nenhum dado dele é enviado a provedor de IA sem o consentimento acima (verificado por teste no gate `ai_available` + consentimento).

### Story 10.8: Recuperação de senha por email

Como usuário (convidado ou Hugo),
Quero redefinir minha própria senha por email quando a esquecer,
Para que eu nunca fique trancado para fora do sistema (FR-0.5 — pré-requisito dos convites/onboarding).

*(Nova — [CE] 2026-07-23, issue 🔴 do [IR]: FR-0.5 criado no [PRD] update de 2026-07-23. **Ordem interna: antes da 10.1** — convidado trancado para fora é falha de onboarding. Numeração é identificador, não ordem.)*

**Critérios de Aceitação:**

**Dado que** a tela de login,
**Quando** o usuário aciona "esqueci minha senha" e informa um email,
**Então** se a conta existir, recebe um link de redefinição com token de **validade limitada e uso único**,
**E** a resposta visível (UI e API) é **idêntica exista ou não a conta** — sem enumeração de contas, coerente com o AC de login "401 sem revelar se o email existe" (Story 2.1).

**Dado que** um link de redefinição válido,
**Quando** o usuário define a nova senha,
**Então** a senha é atualizada e as sessões/refresh tokens anteriores são invalidados,
**E** o login com a nova senha funciona em seguida (a senha antiga deixa de valer).

**Dado que** um token expirado ou já utilizado,
**Quando** o usuário abre o link,
**Então** vê uma mensagem clara do que aconteceu (sem stack trace nem 404 cru) com caminho para solicitar um novo link,
**E** o token não redefine senha alguma (uso único: reutilização = inválido).

**Dado que** uma falha no envio do email de redefinição (provedor indisponível),
**Quando** a solicitação é processada,
**Então** o erro gera log/evento seguro com `request_id` (política da Story 10.0),
**E** a resposta ao usuário permanece a genérica — sem revelar a existência da conta nem o detalhe do erro.

**Dado que** o modelo novo de token de redefinição,
**Quando** a migration da story entra,
**Então** ela é aplicada também à **branch e2e do Neon antes da suíte Playwright** (lição recorrente 7.1/7.2),
**E** nenhum token, hash de token ou email aparece em logs (política de dados proibidos da Story 10.0).

**Dado que** as superfícies novas (solicitação + redefinição),
**Quando** forem implementadas,
**Então** seguem o design system 2026-07-17 (UX-DR21/30) — formulários padrão, sem exigir x.0 própria,
**E** funcionam no mobile real (NFR-1).

---

## Epic 12: Tier 0 — Plataforma e Quick Wins (sem UI)

Hugo captura itens e consulta o resumo do dia de fora do app com um token de automação escopado e revogável; tarefas migradas preservam o `started`; tarefas ganham a flag `waiting_on` no backend; e o produto ganha a espinha do modelo núcleo+collections (manifest fatia 1) com aceite **pixel-idêntico**. Nenhuma mudança visível no app. *(Sem story x.0 — épico sem UI, DIR-15.)*

*Restrição registrada (FR-3.5): a PWA **não** é canal de captura rápida (limitação iOS) — a captura externa vai direto na API; polir a PWA (manifest, badge, Declarative Web Push) é oportunista, fora deste épico.*

> Convenção de idioma: stories deste ciclo seguem o padrão pt-BR do projeto (Como/Quero/Para que; Dado que/Quando/Então/E).

### Story 12.1: Herança de status na migração (#23)

Como Hugo (praticante do BuJo),
Quero que uma tarefa iniciada (`/`) migrada carregue o status `started` para o sucessor,
Para que o progresso real não se perca ao carregar a tarefa adiante (FR-4.16, AR-24, DIR-5).

**Critérios de Aceitação:**

**Dado que** uma tarefa `started` é migrada ou adiada por qualquer fluxo (migração diária, ritual semanal/mensal, Catch-Up, Mover — Stories 4.2/11.6/11.10),
**Quando** o service cria o sucessor,
**Então** o sucessor nasce com o status da origem (`started`→`started`, `pending`→`pending`),
**E** a origem permanece terminal (`migrated`/`postponed`) com `migrated_to_task_id` e `migration_count` incrementado (AD-03 intacto).

**Dado que** um pai com filhos não-dispostos é migrado,
**Quando** a subárvore é recriada no destino,
**Então** cada filho recriado herda **o próprio** status de origem, não o do pai (AD-08 item 11 / AD-18).

**Dado que** a matriz de transições AD-02 permanece inalterada,
**Quando** tarefas `completed`/`cancelled`/`migrated`/`postponed` são avaliadas,
**Então** apenas `pending`/`started` são migráveis e nenhuma mudança de schema ocorre (regra pura de service em `bujo/services/migration.py`).

**Dado que** o Épico 14 retocará o mesmo service (fila unificada),
**Quando** os testes desta story são escritos,
**Então** cobrem a **função de regra de herança** diretamente (nível unit), não apenas os endpoints,
**E** todos os caminhos de migração existentes ficam cobertos sem duplicação de fixture.

### Story 12.2: Flag `waiting_on` no backend (#15)

Como Hugo,
Quero marcar via API uma tarefa como "Aguardando Terceiro",
Para que dependências externas fiquem registradas sem poluir a máquina de estados (FR-4.15, AR-24, DIR-4).

**Critérios de Aceitação:**

**Dado que** o agregado Task congelado (Story 3.1),
**Quando** a migration nomeada adiciona `waiting_on BOOLEAN NOT NULL DEFAULT false`,
**Então** o enum de 6 estados permanece intocado (**proibido 7º estado**),
**E** a migration é aplicada também à branch Neon e2e antes da suíte Playwright (lição recorrente do projeto).

**Dado que** uma tarefa existente,
**Quando** o cliente envia PATCH com `waitingOn` (camelCase na borda, §6.3),
**Então** a flag alterna e persiste,
**E** transições de estado (AD-02) **não** alteram a flag (ortogonalidade), nem a flag altera transições.

**Dado que** listagens de tarefas,
**Quando** o cliente filtra por `?waitingOn=true|false` (django-filter),
**Então** o resultado respeita o filtro em conjunto com os filtros existentes.

**Dado que** uma tarefa com `waiting_on = true` é migrada,
**Quando** o sucessor é criado,
**Então** ele herda `waiting_on` da origem (confirmado por Hugo 2026-07-22 — AD-18 item 5).

**Dado que** o escopo é Tier 0,
**Quando** a story é entregue,
**Então** nenhuma UI é alterada (indicador visual e filtro de UI nascem no Épico 17 — D3).

### Story 12.3: Manifest de collections — fatia 1 (pixel-idêntico)

Como desenvolvedor do projeto,
Quero um registro estático de collections em `src/app/collections/registry.ts` com a navegação derivada dele,
Para que adicionar uma collection vire operação de baixo atrito, sem nenhuma mudança visível agora (FR-1.1, FR-1.2, FR-1.3, AR-23, DIR-6, DIR-12a).

**Critérios de Aceitação:**

**Dado que** as collections coded existentes (Hábitos, Saúde-Métricas, Medicamentos, Gratidão),
**Quando** o registro é criado,
**Então** cada uma tem UMA entrada `{id, name, icon, routes (React.lazy), nav {label, group, order}, archetype, dashboardCard?, settingsSchema?}`,
**E** o registro é **dados puros** — sem hooks, sem TanStack Query, sem side effects; `dashboardCard`/`settingsSchema` são campos reservados tipados **sem consumidores**.

**Dado que** a navegação atual,
**Quando** Sidebar, BottomNav e rotas de collection passam a derivar do registro por map puro,
**Então** o núcleo BuJo (Hoje, Planner, Brain Dump, Arquivo, Configurações) permanece **fora** do registro (FR-1.1 — não-gateável por construção),
**E** não existe flag de ativação na fatia 1 (ativação futura = consulta separada que **filtra** o registro — AD-17 item 6).

**Dado que** o aceite é pixel-idêntico,
**Quando** a story é revisada,
**Então** o diff toca apenas o registro novo + a remoção/import dos dados de navegação — zero alteração em arquivos de componente visual,
**E** a suíte de snapshots existente passa **sem update** e os 3 testes compartilhados (AppLayout/router/RouteAnnouncer) passam **sem mocks novos** (aceite mecânico — revisão 2026-07-22).

**Dado que** o DoD estrutural do modelo de collections,
**Quando** a story encerra,
**Então** o próprio `registry.ts` documenta em comentário: "collection nova = pasta da feature + UMA entrada neste registro".

### Story 12.4: Token de automação (`AutomationToken`) com autenticação dedicada

Como Hugo,
Quero criar um token de automação de longa duração, escopado e revogável,
Para que meus atalhos iOS e o widget autentiquem na API sem expor senha nem sessão (FR-3.1, AR-25, DIR-11).

**Critérios de Aceitação:**

**Dado que** o novo app backend `automation`,
**Quando** a migration cria `automation_tokens` (`name`, `token_prefix`, `token_hash` SHA-256, `scopes` JSONB, `last_used_at`, `revoked_at`),
**Então** o token pleno é exibido **uma única vez** na criação (padrão GitHub PAT), nunca armazenado nem logado,
**E** a migration é aplicada também à branch Neon e2e.

**Dado que** a gestão inicial é via Django admin,
**Quando** o operador acessa o admin,
**Então** consegue criar token (com escopos `capture`/`summary`), identificar pelo prefixo e revogar (`revoked_at`),
**E** UI própria de gestão fica explicitamente fora do escopo (story futura).

**Dado que** a auth class dedicada `AutomationTokenAuthentication`,
**Quando** uma requisição chega com `Authorization: Bearer <token>` num endpoint de automação,
**Então** valida hash + não-revogado + escopo, atualiza `last_used_at` e **seta o tenant context (AD-12)** com o dono do token — `test_isolation` cobre o caminho,
**E** a auth class não é aceita em nenhum endpoint fora do app `automation`, e nunca emite sessão/JWT.

**Dado que** um token revogado ou fora de escopo,
**Quando** ele é usado,
**Então** revogado → 401 imediato; escopo insuficiente → 403.

### Story 12.5: Captura externa — `POST /api/capture`

Como Hugo,
Quero capturar um item com uma única chamada autenticada por token,
Para que o Back Tap do iPhone jogue pensamentos direto no Brain Dump (FR-3.2, FR-3.4, AR-25, DIR-11).

**Critérios de Aceitação:**

**Dado que** um token com escopo `capture`,
**Quando** `POST /api/capture` recebe payload raso `{type, text, value?}` com `type: "braindump"`,
**Então** um item de Brain Dump é criado via service existente e a resposta é um `201` curto,
**E** `type` desconhecido retorna 400 com mensagem clara.

**Dado que** o item foi capturado por fora,
**Quando** Hugo abre o app,
**Então** o item aparece no Brain Dump (superfície legada — visível desde o dia 1) e o badge atualiza no próximo refetch (AD-13/AD-19).

**Dado que** rate limiting e auditoria nascem juntos (FR-3.4),
**Quando** o endpoint é chamado,
**Então** `ScopedRateThrottle` com escopo `automation-capture` aplica o limite (configurável em settings),
**E** cada chamada gera log estruturado `{token_prefix, endpoint, status}` — o token pleno nunca aparece em log.

**Dado que** tipos futuros de captura,
**Quando** o dispatcher por `type` é implementado,
**Então** adicionar um tipo novo não exige retrabalho de modelo nem de contrato — implementação simples (match por tipo), **sem padrão de registro especulativo** (navalha de Occam 2026-07-23; a ingestão de PA tem endpoint próprio — AD-27).

### Story 12.6: Resumo do dia — `GET /api/summary/today`

Como Hugo,
Quero um resumo agregado do meu dia numa única requisição,
Para que o widget Scriptable mostre o dia sem abrir o app (FR-3.3, FR-3.4, AR-25).

**Critérios de Aceitação:**

**Dado que** um token com escopo `summary`,
**Quando** `GET /api/summary/today` é chamado,
**Então** responde JSON raso com: tarefas pendentes do dia (via `today_for(user)`), hábitos do dia e a última entrada de journalling — **enquanto o Journalling não existir, a última gratidão** (AD-19), num campo de nome genérico que não quebra quando a fonte trocar.

**Dado que** os ciclos de vida M06–M10 chegam no Épico 14 (contract-first — revisão 2026-07-22),
**Quando** o shape da resposta é definido,
**Então** as contagens/estruturas derivam de services de domínio (não de queries ad-hoc) e não assumem semântica legada que os spines mudam,
**E** o contrato é declarado no OpenAPI (`drf-spectacular`). *(A compatibilidade pós-Épico 14 é verificada lá, pelos testes de caracterização — não é AC testável desta story; navalha de Occam 2026-07-23.)*

**Dado que** rate limiting e auditoria (FR-3.4),
**Quando** o endpoint é chamado,
**Então** `ScopedRateThrottle` escopo `automation-summary` + log estruturado `{token_prefix, endpoint, status}`.

**Dado que** `automation` é app de composição (AD-19 item 4),
**Quando** o summary importa services de `bujo`/`habits`/`gratitude`,
**Então** a regra de porta do `core` permanece intacta (import-linter verde no CI).

---

## Epic 13: Onda 2a — App Shell no Sistema Novo

Hugo navega o app inteiro num shell do design system novo (sidebar, bottom-nav, captura persistente, layout), derivado do manifest por map puro, com paridade funcional e WCAG 2.2 AA. Coexistência por rota: superfícies internas seguem no legado até suas ondas.

### Story 13.0: [UX] Spec do App Shell novo (x.0 — gate do épico)

Como Hugo,
Quero a spec/mockup do shell aprovada no bmad-ux antes de qualquer implementação,
Para que o shell nasça desenhado para todos os seus estados reais — inclusive os que só existirão no futuro (UX-DR31, DIR-15).

**Critérios de Aceitação:**

**Dado que** a estrutura do shell já foi aprovada na Fundação (Onda 1),
**Quando** o rito bmad-ux (human-in-the-loop) rodar esta x.0,
**Então** entrega o **catálogo fechado de ícones por destino** (acabamento pré-gate — DESIGN.md App Shell) e os estados do shell com o manifest,
**E** inclui **obrigatoriamente** os estados **"nav mínima"** (zero/uma collection ligada — antecipa o all-off do Épico 10) e **"seam legado"** (superfície ainda antiga dentro do shell novo, Ondas 2a–5 — tratamento definido, não acidente) (revisão party-mode 2026-07-22).

**Dado que** a condição (c) da Sally (DIR-12),
**Quando** os mockups são produzidos,
**Então** todo estado "collection desligada/ausente" está representado,
**E** o resultado é promovido a DESIGN.md/EXPERIENCE.md antes de qualquer story de implementação deste épico começar (o story-automator só entra após esta story `done`).

### Story 13.1: Fundação do shell novo com coexistência por rota

Como Hugo,
Quero o novo AppLayout (topbar 56px, canvas contínuo, workspace máx. 1440px) ativável rota a rota,
Para que a migração aconteça superfície a superfície com rota segura de rollback (UX-DR21, UX-DR22, UX-DR30; CAP-3).

**Critérios de Aceitação:**

**Dado que** o design system novo (tokens do DESIGN.md 2026-07-17),
**Quando** o AppLayout novo é implementado,
**Então** consome exclusivamente os tokens canônicos (zero valores estruturais locais injustificados),
**E** a coexistência é por rota/superfície com rollback documentado por superfície (migration-plan).

**Dado que** WCAG 2.2 AA precisa ser testável (revisão party-mode),
**Quando** a primeira story do épico roda,
**Então** o setup de **axe-core no Playwright** entra como task desta story,
**E** a **checklist de paridade enumerada** do shell (ações, estados, atalhos, badges) é produzida como artefato e usada nas stories seguintes.

**Dado que** o seam legado (estado da 13.0),
**Quando** uma superfície legada renderiza dentro do shell novo,
**Então** o tratamento aprovado na x.0 é aplicado (sem disfarce; marcador discreto conforme spec).

### Story 13.2: Sidebar nova derivada do manifest

Como Hugo,
Quero a sidebar do sistema novo (240px expandida / 64px colapsada) gerada a partir do registro de collections,
Para que a navegação seja consistente e collections novas apareçam sem tocar o chrome (FR-1.3 consumo, AR-23, UX-DR22).

**Critérios de Aceitação:**

**Dado que** o manifest da Story 12.3 (dados puros),
**Quando** a sidebar deriva grupos/entradas por map puro,
**Então** o núcleo BuJo mantém entradas próprias (fora do registro) e as collections vêm do registro com label/grupo/ordem,
**E** os 3 testes compartilhados (AppLayout/router/RouteAnnouncer) passam **sem mocks novos** (dados puros — sem Query).

**Dado que** os padrões do DESIGN.md,
**Quando** a sidebar renderiza,
**Então** destino ativo = indicador lateral + peso de label + estado selecionado; badges não deslocam labels; badge do Brain Dump visível mesmo colapsada; atalho `[` alterna e o estado colapsado persiste,
**E** paridade com a sidebar legada conforme checklist da 13.1.

### Story 13.3: Bottom-nav e captura persistente mobile

Como Hugo,
Quero a navegação mobile do sistema novo (top bar + bottom nav + captura persistente),
Para que o fluxo diário mobile continue completo, sem scroll horizontal (NFR-1, UX-DR22).

**Critérios de Aceitação:**

**Dado que** o viewport compact (<768px),
**Quando** o shell renderiza,
**Então** top bar + bottom nav com até 4 destinos frequentes + menu para os demais, acima da safe-area,
**E** só destinos implementados aparecem (módulos futuros não aparecem desabilitados).

**Dado que** a captura persistente segue a composição do shell (FAB circular não é linguagem obrigatória — DESIGN.md),
**Quando** o controle de captura é implementado,
**Então** segue a spec da 13.0, permanece sempre visível, carrega o badge do Brain Dump e abre a captura existente (superfície legada até a Onda 4),
**E** offline fica desabilitado com motivo acessível (UX-DR15 preservado).

### Story 13.4: Passe de paridade e acessibilidade do shell

Como Hugo,
Quero o shell novo verificado contra a checklist de paridade e o piso de acessibilidade,
Para que a Onda 2a feche com equivalência comprovada, não estimada (UX-DR30, migration-plan DoR).

**Critérios de Aceitação:**

**Dado que** a checklist enumerada da 13.1,
**Quando** o passe final roda,
**Então** todos os itens de paridade (navegação, dados, comandos, atalhos, badges, estados vazios/loading/error/offline) estão verificados ou com divergência registrada para o artefato upstream,
**E** axe-core passa em wide/medium/compact nas rotas do shell.

**Dado que** o piso de acessibilidade (EXPERIENCE.md),
**Quando** o shell é auditado,
**Então** teclado/tab order/foco visível/aria-live de navegação passam; zoom 200% e reflow em 320px sem perda de conteúdo/ação.

---

## Epic 14: Onda 3 — Núcleo BuJo no Sistema Novo (gate vertical)

Weekly, Monthly, Future, Migração/Catch-Up unificada, Recorrentes e Arquivo no sistema novo — com os deltas de domínio aprovados nos spines M06–M10 como stories de domínio próprias (domínio-primeiro, UI depois). Decisão (a): endpoints legados viram aliases finos; **Daily legado plenamente utilizável até o Épico 17**. A Task Row base do sistema novo nasce aqui. Caminho crítico do roadmap; gate de saída = épico completo.

### Story 14.0: [UX] Mockups complementares do Núcleo BuJo (x.0 — gate do épico)

Como Hugo,
Quero os mockups que faltam para a Onda 3 aprovados no bmad-ux,
Para que toda superfície do épico tenha spine/mockup vigente antes da implementação (UX-DR31, DIR-15).

**Critérios de Aceitação:**

**Dado que** M06–M10 já estão aprovados e promovidos (gate 2026-07-21),
**Quando** esta x.0 rodar,
**Então** cobre apenas o que falta — **Arquivo** (padrão Histórico readonly) e lacunas identificadas na aplicação dos spines,
**E** todo mockup inclui o estado "collection desligada/ausente" (condição (c) — DIR-12) e os estados obrigatórios (loading/empty/error/offline/readonly).

**Dado que** os spines vencem conflitos,
**Quando** houver divergência entre mockup novo e spine promovido,
**Então** o spine vence e a divergência é registrada — nenhuma regra de produto muda por handoff visual.

### Story 14.1: Ciclos de vida de Weekly e Monthly (backend)

Como Hugo,
Quero os estados explícitos Em planejamento / Em andamento / Finalizada(o) para Weekly e Monthly persistidos com seus gates,
Para que o ciclo operacional do método seja garantido pelo domínio, não pela disciplina (UX-DR23; EXPERIENCE M06/M07; delta aprovado — decisão Hugo 2026-07-22).

**Critérios de Aceitação:**

**Dado que** os ciclos descritos nos spines M06/M07,
**Quando** a migration nomeada adiciona o estado do ciclo + marco de "planejamento concluído",
**Então** constraints garantem no máximo UM Weekly e UM Monthly "Em andamento" e UM "Em planejamento" por vez,
**E** a migration é aplicada à branch Neon e2e antes do Playwright.

**Dado que** os gates dos spines,
**Quando** os services de concluir planejamento / iniciar / finalizar rodam,
**Então** são idempotentes; **Iniciar** exige data ≥ alvo + planejamento concluído + anterior finalizado (só `pending`/`started` do anterior bloqueiam); **Finalizar** é irreversível; **Concluir planejamento** é não-bloqueante e não congela o ritual,
**E** meses pulados exigem materialização sequencial (um ciclo por vez, sem lote nem fechamento automático); a janela regular mensal deriva da semana seg→dom que contém a virada (via `core/calendar.py`).

**Dado que** o Daily legado permanece utilizável (premissa blindada),
**Quando** esta story entrega,
**Então** nenhum endpoint consumido pelo Daily/fluxos legados muda de contrato (as regras novas atuam nos fluxos novos; aliases intactos até a 14.3).

**Dado que** ciclos Weekly/Monthly já existem no banco (abertos e fechados pela semântica do Épico 4),
**Quando** a data migration de estados roda,
**Então** todo ciclo existente recebe estado retroativo coerente — fechados → Finalizado; o corrente → Em andamento; monthlies futuros usados só como storage do Future Log ficam fora da navegação operacional (sem estado operacional),
**E** zero ciclos órfãos: o gate "Iniciar exige anterior finalizado" funciona no primeiro uso real (contagens da migração verificadas e registradas — auditoria de premissas 2026-07-23).

### Story 14.2: Fontes dos rituais e decisões-snapshot (backend)

Como Hugo,
Quero as fontes de planejamento (Monthly na semana, recorrentes, Weekly anterior, Daily pendentes, Future Log, Monthly anterior) agregadas por endpoints independentes com registro de decisão por item,
Para que os rituais Semana/Mês operem com progresso real e retomável (UX-DR23; EXPERIENCE M06/M07).

**Critérios de Aceitação:**

**Dado que** as fontes definidas nos spines (ordem fixa, navegação livre),
**Quando** os endpoints de fonte são implementados,
**Então** cada fonte carrega/falha de forma independente, com contagem e elegibilidade conforme spine (ex.: Weekly anterior = só `pending`/`started`; anual elegível = sem instância no ano-alvo, sem parsing de `recurrence_text`),
**E** decisões sem mutação de task (**Manter**, **Não alocar nesta semana**, **Manter sem dia**) são persistidas como decisões-snapshot do ritual, contando no progresso sem alterar a Task.

**Dado que** a densidade real (Week/Month Density),
**Quando** o rail de contexto consulta as contagens,
**Então** contam somente registros materializados no alvo, incluindo subtarefas, segmentados por todos os status — recorrentes não alocados nunca aparecem como projeção.

### Story 14.3: Fila unificada de migração + aliases finos (backend)

Como Hugo,
Quero uma fila única de pendências ordenada mês → semana → dia, com decisão persistida por item,
Para que tudo que ficou sem lugar seja decidido num fluxo só, retomável (UX-DR25; EXPERIENCE M10; decisão (a) — party-mode 2026-07-22).

**Critérios de Aceitação:**

**Dado que** as filas hoje separadas (`/migration/queue/` + `/catch-up/queue/`),
**Quando** o endpoint unificado é implementado,
**Então** devolve a lista mesclada na ordem mês → semana → dia ("ontem" = nível dia), com rótulo e contagem por fonte,
**E** cada decisão (migrar p/ hoje, destino explícito, cancelar) persiste por item — pausar/sair não perde nada; retomar traz só os restantes (sem posição salva).

**Dado que** a decisão (a) do Hugo,
**Quando** a fila unificada entra,
**Então** os endpoints legados permanecem como **aliases finos** sobre o serviço novo (mesmos contratos de resposta), removidos só no Épico 18,
**E** o `MigrationBanner`/`CatchUpBanner` do Daily legado continuam funcionando sem alteração (premissa blindada; testes de caracterização cobrem os aliases).

**Dado que** a herança de status (12.1) e o `waiting_on` (12.2),
**Quando** decisões da fila unificada criam sucessores,
**Então** status e `waiting_on` são herdados conforme AD-18 (testes reusam a função de regra, sem duplicação).

### Story 14.4: Soft delete de templates recorrentes (backend)

Como Hugo,
Quero excluir um template da biblioteca sem apagar o registro,
Para que a linhagem das tarefas já alocadas permaneça rastreável (UX-DR24; EXPERIENCE M09).

**Critérios de Aceitação:**

**Dado que** um template com instâncias alocadas,
**Quando** o soft delete é executado (flag lógica + confirmação),
**Então** o template some da biblioteca e das fontes dos rituais (filtro default nas queries),
**E** a FK `source_template_id` das tarefas alocadas permanece íntegra; não existe delete físico.

**Dado que** Ativar/Desativar já existe,
**Quando** o soft delete entra,
**Então** os dois conceitos ficam distintos (inativo = visível com filtro, reversível; excluído = fora da biblioteca, irreversível na UI) e testados separadamente.

### Story 14.5: Weekly Board e planejamento semanal no sistema novo (M06)

Como Hugo,
Quero a semana no sistema novo — board multi-faixa com pool "Sem dia definido" e o ritual de planejamento com rails,
Para que o planejamento semanal opere no novo contrato visual com tudo que o spine aprovou (UX-DR23, UX-DR26; mockup key-weekly.html).

**Critérios de Aceitação:**

**Dado que** o spine M06 e o mockup aprovado,
**Quando** a superfície é implementada,
**Então** desktop = Seg–Qua + Qui–Dom compacto em faixas, pool lateral contínuo, scroll interno por painel, terminais com menor ênfase, filtros globais não-persistentes; mobile = um dia por vez com seletor,
**E** o ciclo de vida (14.1) aparece: estados no header, painel de verificação de Iniciar, finalização irreversível no ritual.

**Dado que** a **Task Row base do sistema novo nasce aqui** (revisão party-mode),
**Quando** o componente é criado,
**Então** implementa a anatomia canônica completa (UX-DR26: cluster leading, swatches/checkboxes no detalhe, footer, semântica de Enter, linhagem navegável com destaque temporário),
**E** é desenhado para reuso — o Épico 17 apenas especializa (documentado no próprio componente).

**Dado que** o ritual com rails (fontes → decisões → densidade sticky),
**Quando** o planejamento roda,
**Então** decisões individuais persistem imediatamente (14.2), teclado `1`–`7`/`0` + `Enter` no seletor, avisos acionáveis não-dispensáveis, sem toast de sucesso redundante,
**E** axe-core + estados obrigatórios (loading/empty/error/offline/parcial por fonte) passam em wide/medium/compact.

### Story 14.6: Monthly Board e planejamento mensal no sistema novo (M07)

Como Hugo,
Quero o mês no sistema novo — calendário completo com tarefas nas células e o ritual mensal,
Para que a abertura do mês opere no novo contrato com as três fontes do spine (UX-DR23; mockup key-monthly.html).

**Critérios de Aceitação:**

**Dado que** o spine M07,
**Quando** a superfície é implementada,
**Então** calendário seg→dom completo (células vazias visíveis), Task Rows compactas nas células (sem "+N"), overflow com scroll interno acessível, pool "Sem dia definido" lateral, cabeçalho do dia → Daily Log e Task Row → detalhe,
**E** compact = seleção de data + lista completa do dia, sem scroll horizontal.

**Dado que** o ritual mensal (recorrentes → Future Log → Monthly anterior),
**Quando** as decisões rodam,
**Então** anual elegível segue a regra do ano-alvo (dezembro: só o próprio mês resolve), Future Log oferece só dia/manter/adiar, Monthly anterior permite concluir/cancelar/migrar/adiar e é a única fonte bloqueante,
**E** o seletor de destino combina calendário + entrada direta do dia, valida 28–31 dias (incl. bissexto), com "Sem dia definido" explícito e confirmação nomeada.

### Story 14.7: Future Log no sistema novo (M08)

Como Hugo,
Quero o Futuro como trilho de 8 meses + coluna de foco, com captura e datear/mover no lugar,
Para que nada lançado à frente se perca (UX-DR23; mockup key-future-log.html).

**Critérios de Aceitação:**

**Dado que** o spine M08,
**Quando** a superfície é implementada,
**Então** trilho fixo com os 8 meses seguintes ao operacional (vazios visíveis, contagens), coluna de foco com Task Rows integrais, captura no header com data completa/parcial (`(14)` / `— ago`), ordenação dia→sem-dia,
**E** **Ir para mês…** lista só meses distantes com itens (agrupados por ano, com contagem); compact vira barra rolável + sheets.

**Dado que** datear/mover no lugar,
**Quando** Hugo define dia ou move um item,
**Então** usa o seletor de destino padrão com confirmação nomeada, origem vira terminal `migrated` com seta navegável e o sucessor nasce com destaque temporário (linhagem preservada),
**E** concluir/cancelar não existem nesta superfície.

### Story 14.8: Recorrentes no sistema novo (M09)

Como Hugo,
Quero a biblioteca de templates no sistema novo com o card de detalhe compartilhado e soft delete,
Para que a gestão de recorrentes siga o padrão canônico (UX-DR24, UX-DR26; mockup key-recorrentes.html).

**Critérios de Aceitação:**

**Dado que** o spine M09,
**Quando** a biblioteca é implementada em `/planner/recurring`,
**Então** abas Semanal/Mensal/Anual com contagem + filtro "Mostrar inativos", variante Item Row (sem ícone de status), criar/editar no mesmo card do detalhe de tarefa (grupo segmented na criação, readonly na edição; recorrência = texto livre exibido),
**E** o footer traz Salvar / Ativar-Desativar / Excluir — Excluir só na edição, com dialog, acionando o soft delete da 14.4.

**Dado que** o termo padrão do ato é **"Alocar"**,
**Quando** qualquer superfície referencia o placement,
**Então** usa "Alocar" (o Future Log deixa de usar "Definir placement") e a alocação permanece exclusiva dos rituais/anuais — a biblioteca só alimenta.

### Story 14.9: Migração/Catch-Up como ritual no shell (M10)

Como Hugo,
Quero decidir todas as pendências num ritual dentro do shell, entrando por uma faixa discreta no Hoje,
Para que a reconciliação seja um fluxo único, pausável e com fim claro (UX-DR25; mockup key-migracao.html).

**Critérios de Aceitação:**

**Dado que** a fila unificada (14.3),
**Quando** o ritual abre pela faixa ("N tarefas precisam de decisão", contagem por fonte; vazio = sem faixa; a faixa vive no Hoje legado até o Épico 17 e usa o tratamento de seam da 13.0),
**Então** apresenta rail de fontes (Meses → Semanas → Dias), lista de decisões com origem/linhagem e rail de contexto com progresso/decidido/restante — **não** é Dialog nem tela cheia,
**E** as ações são Migrar para hoje (destaque) / Escolher destino… (abas Esta semana · Dia no mês · Outro mês + atalhos Hoje/Sem dia) / Cancelar — sem "Concluir".

**Dado que** pausar/retomar e o fim do fluxo,
**Quando** Hugo sai e volta,
**Então** decisões persistidas não se perdem e o ritual reabre com os itens restantes,
**E** ao decidir tudo, um resumo factual (migradas/adiadas/canceladas) antecede a volta ao Hoje; falha de escrita preserva decisão e item com retry local (estado de erro no fluxo — delta M10).

### Story 14.10: Arquivo no sistema novo

Como Hugo,
Quero consultar ciclos fechados no sistema novo, readonly e navegável,
Para que o histórico permaneça legível com a linhagem intacta (FR-4.13 paridade; padrão Histórico; mockup da 14.0).

**Critérios de Aceitação:**

**Dado que** ciclos finalizados,
**Quando** o Arquivo renderiza no sistema novo,
**Então** filtros/período → lista → detalhe readonly; conteúdo com contraste normal (nunca aparência disabled); "Fechado"/"Somente leitura" textuais; mutações ausentes,
**E** a seta de linhagem navega ao sucessor entre períodos sem perder filtro/posição (paridade com 11.11).

---

## Epic 15: Onda 4 — Captura no Sistema Novo

Brain Dump (inbox + processamento), badge persistente e Capture Sheet mobile migram para o sistema novo, mantendo server state, otimismo e conectividade existentes. Prova o padrão de inbox e captura mobile na fundação nova.

### Story 15.0: [UX] Mockup da captura e do Brain Dump (x.0 — gate do épico)

Como Hugo,
Quero o mockup da superfície de captura (inbox + sheet) aprovado no bmad-ux,
Para que a captura nasça no padrão Inbox do sistema novo com todos os estados (UX-DR31, DIR-15).

**Critérios de Aceitação:**

**Dado que** o padrão de página Inbox (EXPERIENCE.md: captura → pendências → processamento; vazio é saudável),
**Quando** a x.0 rodar,
**Então** entrega mockup do Brain Dump (desktop/mobile) e do Capture Sheet, com estados loading/empty/error/offline e o estado "collection desligada/ausente" onde aplicável (DIR-12c),
**E** é promovido a DESIGN/EXPERIENCE antes das stories de implementação.

### Story 15.1: Brain Dump no sistema novo (inbox + processamento)

Como Hugo,
Quero a caixa de entrada no sistema novo, com processamento manual dos itens,
Para que o Brain Dump siga sendo a válvula de escape — agora na linguagem nova (paridade FR-5.1–5.3; UX-DR21/30).

**Critérios de Aceitação:**

**Dado que** o inventário da superfície legada (DoR),
**Quando** o Brain Dump renderiza no sistema novo,
**Então** captura, listagem (variante Item Row), edição e processamento (mover para log correto / descartar) mantêm paridade completa,
**E** "Brain Dump vazio." permanece o estado saudável (uma frase, sem incentivo a conteúdo).

**Dado que** o server state existente (AD-13),
**Quando** itens são processados,
**Então** as query keys e invalidações atuais são preservadas (sem estado novo de cliente),
**E** escrita otimista com rollback + erro inline seguem o contrato (UX-DR14/15).

### Story 15.2: Capture Sheet e captura persistente no sistema novo

Como Hugo,
Quero capturar de qualquer contexto pelo controle persistente do shell, com o sheet novo,
Para que a captura mobile continue a um toque (paridade FR-5.2/5.4; UJ-4; UX-DR21).

**Critérios de Aceitação:**

**Dado que** o controle de captura do shell (13.3),
**Quando** Hugo aciona a captura,
**Então** o sheet novo abre com foco no título, descrição e log de destino opcionais (default Brain Dump), salva e fecha atualizando o badge,
**E** em falha o texto permanece com retry disponível; offline desabilita com motivo (nenhuma captura perdida silenciosamente).

**Dado que** o badge é server state derivado,
**Quando** a captura confirma,
**Então** o badge atualiza por invalidação da key (`['brainDump','count']`), com anúncio `aria-live`.

### Story 15.3: Passe de paridade, estados e acessibilidade da captura

Como Hugo,
Quero a Onda 4 fechada com paridade e acessibilidade comprovadas,
Para que o gate da onda meça equivalência real (UX-DR30; migration-plan).

**Critérios de Aceitação:**

**Dado que** a checklist de paridade da superfície (inventário pré-redesign),
**Quando** o passe roda,
**Então** todos os estados (loading/empty/error/offline/disabled) e ações estão equivalentes ou com divergência registrada,
**E** axe-core + teclado + touch targets ≥44px passam em wide/medium/compact; rollback por superfície documentado; rota legada da captura removida do uso ativo.

---

## Epic 16: Onda 5 — Módulos: Migração + Refinos + Journalling

Hábitos, Saúde-Métricas (com o pacote C3), Medicamentos (2 collections no grupo visual "Saúde") migram para o sistema novo já com seus refinos; o Journalling nasce direto no sistema novo absorvendo a Gratidão. Épico pesado por design: stories pequenas, x.0 por módulo, e o [SP] pode dividir em lotes. **Lotes de automação** (as x.0 são human-in-the-loop — o story-automator para em cada gate): 16.0 → [16.1–16.2] · 16.3 → [16.4–16.9] · 16.10 → [16.11–16.14] *(auditoria de premissas 2026-07-23)*.

### Story 16.0: [UX] Mockup de Hábitos no sistema novo (x.0 — gate do épico)

Como Hugo,
Quero o mockup de Hábitos (tracker, config, histórico/gráfico) aprovado no bmad-ux,
Para que o módulo migre com pictogramas e padrão de registro definidos (UX-DR31, UX-DR27, DIR-15).

**Critérios de Aceitação:**

**Dado que** o padrão Registro (data → registro → feedback → histórico) e os pictogramas Phosphor,
**Quando** a x.0 rodar,
**Então** cobre tracker diário (booleano/numérico, grupos, percentuais), configuração, histórico/grid e gráfico de evolução, com `iconKey` + fallback emoji representados,
**E** inclui os estados obrigatórios + "collection desligada/ausente" (DIR-12c); promovida a DESIGN/EXPERIENCE antes do lote de Hábitos.

### Story 16.1: Hábitos no sistema novo

Como Hugo,
Quero o módulo de Hábitos migrado para o sistema novo,
Para que o tracker diário, a config e o histórico vivam na linguagem nova sem perder nada (paridade FR-7.1–7.10; UX-DR21/30).

**Critérios de Aceitação:**

**Dado que** o inventário do módulo legado,
**Quando** as superfícies migram (tracker, config de hábitos/grupos, histórico por data, grid, gráfico de evolução com anotações),
**Então** paridade completa de ações/estados/cálculos (completude ponderada, multiplicador por tipo de dia, snapshot imutável intocados — zero mudança de regra),
**E** axe-core + estados obrigatórios passam; emoji atual permanece exibido como fallback.

### Story 16.2: Campo `icon_key` e catálogo Phosphor (mudança de contrato)

Como Hugo,
Quero escolher um pictograma Phosphor estável para cada hábito e métrica,
Para que a identidade visual dos domínios seja consistente em toda superfície (UX-DR27 — story própria por mudança de contrato).

**Critérios de Aceitação:**

**Dado que** a decisão de contrato (EXPERIENCE.md: `iconKey` estável, nunca componente/SVG persistido),
**Quando** a migration adiciona `icon_key` (nullable) a hábitos e métricas de saúde,
**Então** o catálogo fechado e pesquisável por nome valida os valores no service (nome fora do catálogo = 400),
**E** a migration vai à branch Neon e2e; registros sem mapeamento continuam exibindo emoji até escolha do usuário (retrocompatível).

**Dado que** o mesmo `iconKey` representa a entidade em toda parte,
**Quando** cadastro, tracker, grids e históricos renderizam,
**Então** usam o mesmo pictograma monocromático (`currentColor`, 18/20px), decorativo quando há label (sem anúncio duplo), com nome acessível quando sozinho.

### Story 16.3: [UX] Mockups de Saúde-Métricas + Medicamentos (x.0 do lote — mesma sessão)

Como Hugo,
Quero os mockups de Saúde e Medicamentos produzidos na mesma sessão de bmad-ux,
Para que o grupo visual "Saúde" nasça coerente (UX-DR31; revisão party-mode — Sally).

**Critérios de Aceitação:**

**Dado que** Saúde-Métricas e Medicamentos são 2 collections no grupo visual "Saúde",
**Quando** a sessão única de x.0 rodar,
**Então** cobre log diário de saúde (com os refinos C3: reordenar, edição, novos tipos, grupos de métricas), as 3 visualizações de histórico, e a confirmação/histórico de Medicamentos,
**E** o agrupamento visual e a navegação entre as duas collections ficam definidos; estados obrigatórios + "collection desligada" incluídos; promovida antes do lote de Saúde/Medicamentos.

### Story 16.4: Saúde-Métricas no sistema novo

Como Hugo,
Quero o módulo de Saúde migrado para o sistema novo,
Para que o ritual matinal viva na linguagem nova (paridade FR-8.1–8.3; UX-DR21/30).

**Critérios de Aceitação:**

**Dado que** o inventário do módulo legado,
**Quando** as superfícies migram (log diário com campos de ontem no topo, tabela, gráficos, dashboard de período),
**Então** paridade completa (tipos de campo, inativos preservados, validação JSONB no service intocada),
**E** axe-core + estados obrigatórios passam; gráficos com resumo textual/tabela equivalente.

### Story 16.5: Refinos C3 — reordenar (#16) e editar métricas (#17)

Como Hugo,
Quero reordenar minhas métricas e editar as existentes com segurança,
Para que a configuração de saúde acompanhe a vida real sem corromper histórico (FR-8.R; DIR-3).

**Critérios de Aceitação:**

**Dado que** `display_order` já existe (#16 — quick win),
**Quando** a UI de reordenação entra (drag com alternativa de teclado),
**Então** a ordem persiste e reflete no log diário e nas visualizações.

**Dado que** o princípio editar seguro × destrutivo (#17),
**Quando** Hugo edita uma métrica,
**Então** renomear e adicionar opção de enum são livres (histórico preservado; renomeação reflete em históricos sem migração de dados),
**E** mudar tipo/remover é bloqueado na API e na UI — apenas desativação, com explicação acessível do motivo.

### Story 16.6: Refino C3 — tipos percentual e enum multi-seleção (#18, backend)

Como Hugo,
Quero os tipos "percentual" e "enum multi-seleção" no schema de métricas,
Para que métricas reais (ex.: qualidade em %, sintomas múltiplos) sejam representáveis (FR-8.R; revisão party-mode — split backend).

**Critérios de Aceitação:**

**Dado que** enum multi = valor→array (mudança de shape),
**Quando** a migration + validação de service entram,
**Então** `percent` valida 0–100 e `enum_multi` grava array de rótulos válidos contra `enum_options`,
**E** valores single existentes permanecem válidos (sem migração destrutiva de dados; testes de reversibilidade da migration; branch e2e atualizada).

**Dado que** as queries analíticas (7.3),
**Quando** os novos tipos entram,
**Então** a tipagem/cast por tipo cobre os dois casos novos com testes (percentual numérico; multi como contagem/frequência), sem quebrar gráficos existentes.

*Nota (auditoria de premissas 2026-07-23):* converter uma métrica enum **existente** para multi-seleção é **mudança de tipo — bloqueada** (DIR-3/#17); o caminho suportado é **desativar a métrica antiga + criar a nova** como `enum_multi`. A UI da 16.7 comunica isso explicitamente.

### Story 16.7: Refino C3 — percentual e enum multi na UI (#18, frontend)

Como Hugo,
Quero preencher e visualizar os novos tipos no log e nos históricos,
Para que os tipos novos sejam utilizáveis de ponta a ponta (FR-8.R).

**Critérios de Aceitação:**

**Dado que** os tipos da 16.6,
**Quando** o log diário renderiza,
**Então** percentual tem input adequado (0–100) e enum multi tem seleção múltipla acessível (checkboxes/chips com texto),
**E** tabela/gráficos/dashboard representam os dois tipos (multi como frequência/contagem), com resumo textual.

### Story 16.8: Refino C3 — grupos de métricas (#22)

Como Hugo,
Quero organizar métricas em grupos,
Para que o log diário e as visualizações reflitam a estrutura real (ex.: sono, digestão, atividade) (FR-8.R).

**Critérios de Aceitação:**

**Dado que** a nova entidade de agrupamento,
**Quando** a migration + CRUD de grupos entram (criar, renomear, reordenar, desativar — nunca deletar com métricas associadas),
**Então** cada métrica pode pertencer a um grupo (opcional; sem grupo = "Geral"),
**E** o log diário e a tabela agrupam com section headers; branch e2e atualizada.

### Story 16.9: Medicamentos no sistema novo (2 collections, grupo "Saúde")

Como Hugo,
Quero Medicamentos migrado para o sistema novo como collection própria no grupo visual "Saúde",
Para que a confirmação diária siga fluida na linguagem nova (paridade FR-9.1–9.4; migration-plan Onda 5).

**Critérios de Aceitação:**

**Dado que** o inventário do módulo legado,
**Quando** as superfícies migram (confirmação por bloco/individual, dose perdida como sinal clínico textual, histórico de adesão),
**Então** paridade completa; Saúde-Métricas e Medicamentos aparecem como 2 entradas no manifest sob o grupo "Saúde" (agrupamento é apresentação),
**E** a exposição do médico prescritor é verificada: `prescribed_by` (AD-07) aparece no detalhe da substância vigente — se a verificação revelar lacuna de superfície, registra follow-up (pendência §10 do proposal resolvida).

### Story 16.10: [UX] Mockup do Journalling (x.0 do lote)

Como Hugo,
Quero o mockup do Journalling aprovado no bmad-ux,
Para que a collection nova nasça desenhada por completo — campos, cadências e históricos (UX-DR31, DIR-15).

**Critérios de Aceitação:**

**Dado que** o modelo de campos de relato (FR-10.1) e as 3 cadências,
**Quando** a x.0 rodar,
**Então** cobre configuração de campos (com `contexto_ia` off e explicação), registro diário/semanal/livre, históricos por cadência (data/mês; por semana; timeline) e o comportamento múltiplas × única,
**E** cobre a chegada das Gratidões migradas (campo seed) e o estado "collection desligada"; promovida antes do lote de Journalling.

### Story 16.11: Journalling — backend (app, campos e três âncoras)

Como Hugo,
Quero o backend do Journalling com campos de relato configuráveis e âncoras temporais corretas,
Para que cada cadência tenha a semântica temporal certa desde a primeira migration (FR-10.1–10.5; AR-26; DIR-3, DIR-8).

**Critérios de Aceitação:**

**Dado que** o app `journalling` novo,
**Quando** as migrations criam `journal_field_definitions` e `journal_entries`,
**Então** definições seguem FR-10.1 (`ai_context` DEFAULT false — nasce off em todo campo) e entradas têm as 3 âncoras mutuamente exclusivas (`entry_date` / `week_start` com CHECK de segunda / `occurred_at`) via CHECK conforme a cadência do campo (padrão AD-03),
**E** `logged_at` preenche quando `record_time = on`; branch e2e atualizada.

**Dado que** editar seguro × destrutivo (FR-10.2) e entrada única × múltiplas (FR-10.4),
**Quando** os services entram,
**Então** renomear/adicionar campo = livre; mudar cadência/remover = só desativação (bloqueado na API),
**E** campo `multiple_entries = false` aceita no máximo 1 entrada por âncora (validação no service + índice único parcial).

### Story 16.12: Journalling — superfícies (config, registro e históricos)

Como Hugo,
Quero configurar meus campos de relato e escrever/reler por cadência,
Para que o Journalling seja utilizável de ponta a ponta no sistema novo (FR-10.1–10.6; UX-DR21/30).

**Critérios de Aceitação:**

**Dado que** o mockup da 16.10,
**Quando** as superfícies entram,
**Então** config de campos (criar/renomear/desativar; `contexto_ia` off por padrão com explicação do que significa), registro por cadência e históricos apropriados (diário por data/mês; semanal por `week_start`; livre em timeline paginada),
**E** a entrada da collection vem do manifest (1 entrada nova no registro — DoD estrutural) com `dashboardCard` reservado preenchido (card único agregando campos ativos — consumo real na home, Épico 17/FR-10.6).

### Story 16.13: Migração das Gratidões + freeze de escrita (verificação antes da aposentadoria)

Como Hugo,
Quero minhas entradas de gratidão migradas para o campo seed "Gratidões" com verificação auditável,
Para que a absorção seja sem perda — antes de qualquer aposentadoria de superfície (FR-10.7; AR-26; revisão party-mode — John/Winston/Amelia).

**Critérios de Aceitação:**

**Dado que** a data migration,
**Quando** ela roda,
**Então** cria o campo seed "Gratidões" `{diário, múltiplas entradas, contexto_ia off}` e copia todas as `gratitude_entries` para `journal_entries` (âncora = data original),
**E** o AC de verificação passa: `count(origem) == count(destino)` + amostra conferida (primeiras/últimas/aleatórias) registrada na story — **pré-condição do drop no Épico 18**.

**Dado que** o freeze de escrita (janela sem duas verdades),
**Quando** a migração é verificada,
**Então** a superfície antiga da Gratidão fica somente leitura (escrita bloqueada com aviso apontando o Journalling),
**E** o `GET /api/summary/today` (12.6) passa a servir a última entrada do Journalling no campo genérico (troca sem breaking change).

### Story 16.14: Aposentadoria da superfície da Gratidão

Como Hugo,
Quero a superfície antiga da Gratidão removida da navegação na mesma onda,
Para que não exista período de duas verdades (FR-10.7; D5 do CC).

**Critérios de Aceitação:**

**Dado que** a migração verificada (16.13),
**Quando** a aposentadoria roda,
**Então** as rotas da Gratidão são removidas, a entrada do manifest sai (Journalling a substitui) e links contextuais apontam para o Journalling,
**E** o código do app `gratitude` (backend) e a tabela **permanecem** até a remoção do legado (Épico 18 — condicionada ao AC de contagem); nenhum dado é apagado aqui.

---

## Epic 17: Onda 2b — Daily + Home (Dashboard + Hoje)

Hugo entra pós-login num Dashboard-panorama acionável e trabalha no Hoje; o Daily Log migra; a UI do `waiting_on` nasce; o empty-state/Index é desenhado (implementação da oferta no Épico 10). Componente único compartilhado das tasks do dia (AR-27): Hoje = trabalhar / Dashboard = ver (D4). Pré-requisito duro: spec da nova home aprovada (17.0).

### Story 17.0: [UX] Spec da nova home (x.0 ampliada — gate do épico)

Como Hugo,
Quero a spec completa da nova home (Dashboard + Hoje + Daily) construída comigo no bmad-ux,
Para que a maior mudança de entorno do produto seja desenhada antes de qualquer código (UX-DR31; D4; roda em paralelo com a cauda do Épico 16 — revisão party-mode).

**Critérios de Aceitação:**

**Dado que** a decisão D4 (Hoje = trabalhar / Dashboard = ver),
**Quando** a spec é produzida,
**Então** detalha as duas superfícies com o componente compartilhado de tasks do dia (capacidade idêntica), o card do dia acionável (rapid logging + migrações pendentes — captura a um toque preservada), os cards por collection (`dashboardCard`) e o alternador do Hoje (UX-DR28),
**E** valida a sub-condição "≥1 collection" (D4 — as duas páginas diferem pelo entorno mesmo sem collections).

**Dado que** o empty-state é contrato,
**Quando** a spec cobre o dashboard sem collections ativas,
**Então** o desenho do empty-state/Index-oferta fica **fechado como contrato para o Épico 10** (sem reabertura),
**E** os indicadores de uso do sistema (FR-6.6) têm conjunto e fórmulas definidos; estados obrigatórios + "collection desligada" incluídos; promovida a DESIGN/EXPERIENCE.

### Story 17.1: Componente compartilhado das tasks do dia

Como Hugo,
Quero um único componente de visualização e manipulação das tasks do dia,
Para que Hoje e Dashboard mostrem exatamente a mesma verdade, sem estado duplicado (FR-6.3; AR-27).

**Critérios de Aceitação:**

**Dado que** a Task Row base do sistema novo (14.5),
**Quando** o componente de composição é criado em `features/bujo/` (barrel passa a expô-lo — delta §7.2),
**Então** oferece capacidade plena: rapid logging, transições de estado, migrações pendentes visíveis, reordenação — **especializando** a base da 14.5, sem duplicá-la,
**E** não carrega nenhum estado de "qual página" (zero prop de contexto de superfície além de slots de entorno).

**Dado que** zero estado duplicado (AD-21),
**Quando** as duas pages consomem o componente,
**Então** leem as mesmas query keys (mutação numa superfície reflete na outra por invalidação),
**E** testes cobrem a equivalência de capacidade nas duas superfícies.

### Story 17.2: Página Hoje (trabalhar)

Como Hugo,
Quero o Hoje como superfície de trabalho do dia no sistema novo,
Para que executar o dia — tarefas, migrações, registros — seja o centro (FR-6.3; UX-DR28).

**Critérios de Aceitação:**

**Dado que** a spec da 17.0,
**Quando** `pages/today/` é implementada,
**Então** compõe o componente compartilhado + entorno de trabalho (faixa de migração/Catch-Up — que sai do seam legado e vive aqui —, registros diários conforme spec),
**E** o alternador Dia completo / Foco nas tarefas segue UX-DR28 (aria-pressed, preferência local, totalizadores navegáveis que trocam a lente e posicionam módulo com foco programático; módulos não implementados sem placeholders).

**Dado que** o Daily legado era o dono da faixa de migração,
**Quando** o Hoje novo entra,
**Então** a faixa e o ritual (14.9) passam a ser acionados daqui, e o Daily legado é aposentado nesta onda (rota redirecionada; nada quebra).

### Story 17.3: Dashboard-panorama (home pós-login)

Como Hugo,
Quero entrar num panorama acionável do meu dia e das minhas collections,
Para que a primeira tela diga o estado de tudo — e deixe agir sem navegar (FR-6.1, FR-6.2, FR-6.5, FR-6.6).

**Critérios de Aceitação:**

**Dado que** a revogação parcial do UX-DR16,
**Quando** `pages/dashboard/` entra,
**Então** a rota pós-login vira `/dashboard`, com o card do dia **acionável** (componente compartilhado — rapid logging e migrações direto do card),
**E** cada collection ativa contribui seu card via `dashboardCard` do manifest (Hábitos, Saúde, Medicamentos, Journalling), com conteúdo conforme spec da 17.0.

**Dado que** os indicadores de uso (FR-6.6),
**Quando** o panorama renderiza,
**Então** exibe os indicadores definidos na spec (com fórmulas de service, resumo textual acessível),
**E** o slot do empty-state/Index existe e renderiza o desenho aprovado quando não há collections ativas (implementação da oferta ligada aos toggles fica no Épico 10 — aqui o estado é alcançável apenas por teste/preview).

### Story 17.4: Daily Log no sistema novo

Como Hugo,
Quero o registro do dia (Daily Log) migrado para o sistema novo,
Para que a superfície mais usada do produto viva na linguagem nova (paridade FR-4.1/4.3–4.6; UX-DR21/26/30).

**Critérios de Aceitação:**

**Dado que** o inventário do Daily legado,
**Quando** a superfície migra (Day Header, lista de tasks com a Task Row canônica, criação/edição/detalhe, subtarefas, ordenação manual, ciclo de estados),
**Então** paridade completa de ações/estados/atalhos (`N` nova tarefa etc.),
**E** axe-core + estados obrigatórios passam em wide/medium/compact.

**Dado que** a premissa blindada se encerra aqui,
**Quando** o Daily novo assume,
**Então** os aliases finos das queues legadas (14.3) ficam sem consumidores (remoção formal no Épico 18),
**E** o rollback por superfície permanece possível até o fim da onda.

### Story 17.5: UI da flag "Aguardando Terceiro" (#15)

Como Hugo,
Quero ver e filtrar tarefas aguardando terceiros,
Para que dependências externas fiquem visíveis onde eu trabalho (FR-4.15 UI; D3; DIR-4).

**Critérios de Aceitação:**

**Dado que** o backend da 12.2,
**Quando** a UI entra,
**Então** a Task Row exibe indicador com ícone + texto acessível (nunca só cor — UX-DR20) e o detalhe permite alternar a flag,
**E** o filtro (`waitingOn`) está disponível no Hoje/Daily e nas superfícies de tasks conforme spec da 17.0.

**Dado que** a herança na migração (12.1/12.2),
**Quando** uma tarefa aguardando é migrada,
**Então** o sucessor mantém o indicador (comportamento já garantido; verificado na UI).

### Story 17.6: Passe de paridade e acessibilidade da Onda 2b

Como Hugo,
Quero a Onda 2b fechada com paridade e acessibilidade comprovadas,
Para que a home nova entre sem regressão no fluxo mais frequente do produto (UX-DR30; NFR-1/2).

**Critérios de Aceitação:**

**Dado que** as checklists de paridade (Daily + entrada pós-login),
**Quando** o passe roda,
**Então** captura a um toque, migrações pendentes, prefetch/performance percebida (<2s) e todos os estados estão verificados,
**E** axe-core + teclado + zoom/reflow passam; e2e representativo cobre login → dashboard → agir no card → Hoje → Daily.

---

## Epic 18: Onda 6 — Consolidação e Remoção do Legado

Configurações (com #24), auth no padrão "Limiar do workspace", superfícies residuais e a remoção planejada do legado — tokens/componentes antigos, aliases finos e o app `gratitude`. Gate de saída: nenhuma rota ativa depende do sistema antigo.

### Story 18.0: [UX] Mockups de Configurações e Auth (x.0 — gate do épico)

Como Hugo,
Quero os mockups de Configurações e das telas de acesso aprovados no bmad-ux,
Para que a consolidação feche o produto numa linguagem só (UX-DR31, UX-DR29, DIR-15).

**Critérios de Aceitação:**

**Dado que** o padrão Coleção (config) e o padrão "Limiar do workspace" (access),
**Quando** a x.0 rodar,
**Então** cobre o índice de Configurações e suas sub-superfícies (incl. rótulos de categorias #24) e Login/Signup com a silhueta abstrata,
**E** estados obrigatórios + "collection desligada" incluídos; promovida antes das stories do épico.

### Story 18.1: Configurações no sistema novo

Como Hugo,
Quero as Configurações consolidadas no sistema novo,
Para que preferências e cadastros vivam num só lugar coerente (UX-DR21/30; paridade das configs existentes).

**Critérios de Aceitação:**

**Dado que** as superfícies de configuração existentes (hábitos, métricas, medicamentos, journalling, timezone, preferências),
**Quando** o índice novo entra,
**Então** cada sub-superfície é alcançável e mantém paridade (as configs por módulo migradas nas ondas anteriores são linkadas, não duplicadas),
**E** axe-core + estados passam.

### Story 18.2: Nome às categorias (#24)

Como Hugo,
Quero dar nome às 6 cores de categoria,
Para que "teal" vire "Trabalho" nos selects e tooltips (FR-4.14).

**Critérios de Aceitação:**

**Dado que** as 6 cores fixas,
**Quando** a migration cria o mapeamento usuário→label e a config entra,
**Então** Hugo edita o rótulo de cada cor (vazio = nome da cor); as cores permanecem fixas (nenhuma cor nova),
**E** branch e2e atualizada.

**Dado que** os rótulos existem,
**Quando** selects, swatches (tooltip/nome acessível) e filtros renderizam,
**Então** exibem o rótulo do usuário em toda superfície com categoria (Task Row detail, recorrentes, filtros).

### Story 18.3: Auth no padrão "Limiar do workspace"

Como Hugo (e futuros convidados),
Quero Login e Signup no sistema novo,
Para que o primeiro contato com o produto já fale a linguagem nova (paridade FR-0.2; UX-DR29).

**Critérios de Aceitação:**

**Dado que** o padrão aprovado (18.0),
**Quando** Login/Signup migram,
**Então** formulário operacional em 1º plano + silhueta abstrata (surface-subtle/border/opacidade; sem conteúdo real; oculta de AT); em compact vira fundo recortado,
**E** signup ganha confirmação de senha local ("As senhas não coincidem." associado e anunciado; sem bloquear colar/gerenciador); só email/senha/timezone na requisição existente; estados de auth preservados (erro inline, sessão expirada com banner não-destrutivo).

### Story 18.4: Superfícies residuais e remoção dos aliases legados

Como Hugo,
Quero os resíduos migrados e os aliases temporários removidos,
Para que nenhuma rota ativa dependa do sistema antigo (migration-plan Onda 6; decisão (a)).

**Critérios de Aceitação:**

**Dado que** o inventário de rotas/superfícies,
**Quando** os resíduos migram,
**Então** nenhuma rota ativa renderiza o sistema legado; exceções restantes são formalizadas (responsável, prazo, remoção),
**E** os **aliases finos** das queues legadas (14.3) são removidos junto com seus consumidores (verificado por teste de rotas + grep de referências).

### Story 18.5: Remoção do legado — tokens, componentes e app `gratitude`

Como Hugo,
Quero o código e os dados legados removidos com verificação,
Para que o produto feche a migração sem cadáveres no repositório (AR-26; revisão party-mode — aceites mecânicos).

**Critérios de Aceitação:**

**Dado que** o AC de contagem da 16.13 passou (pré-condição dura),
**Quando** a remoção roda,
**Então** o app `gratitude` (código) é removido e a migration de drop da tabela roda **somente** com a verificação registrada,
**E** branch e2e atualizada; rollback documentado (backup/dump antes do drop).

**Dado que** os tokens/componentes do design antigo,
**Quando** a limpeza roda,
**Então** `grep` retorna **zero** imports de tokens/componentes legados no frontend,
**E** o tema antigo é removido do bundle; suíte completa + e2e verdes.

---

## Epic 19: Tier 3 · Custom Collections (C6)

Hugo cria as próprias collections — caso motor: logs do Canadá (#1: Viagens, Moradias, Empregos) — com schema tipado próprio, sub-registros de 1 nível, edição segura × destrutiva e filhas dinâmicas na sidebar. Container "Custom Collections" no manifest; sem export no MVP (DIR-14). *(6 stories — a ex-19.6 foi fundida em 19.3/19.5, navalha de Occam 2026-07-23.)*

### Story 19.0: [UX] Mockups de Custom Collections (x.0 — gate do épico)

Como Hugo,
Quero os mockups do container, do construtor de schema e das superfícies de registros aprovados,
Para que o framework nasça com UX definida para criar, preencher e evoluir collections (UX-DR31, DIR-15).

**Critérios de Aceitação:**

**Dado que** o padrão Coleção e a taxonomia de tipos (FR-14.2/14.3),
**Quando** a x.0 rodar,
**Então** cobre: container (lista de collections do usuário), construtor de schema (campos tipados + sub-registros com limite de 1 nível comunicado), lista/detalhe de registros, edição de schema com dados existentes (seguro × destrutivo) e empty-state com exemplos ilustrativos (sem presets — FR-14.6),
**E** inclui container desligado/collection filha desativada (DIR-12c); promovida antes das stories.

### Story 19.1: Backend — definição, registros e sistema de tipos

Como Hugo,
Quero criar collections com schema tipado e registros validados,
Para que listas estruturadas reais (Viagens, Moradias, Empregos) sejam confiáveis (FR-14.1–14.3; AR-28).

**Critérios de Aceitação:**

**Dado que** o app `customcollections` novo,
**Quando** as migrations criam `custom_collections` (schema JSONB) e `custom_collection_records` (data JSONB),
**Então** o sistema de tipos próprio suporta `{text, int, decimal, bool, date, enum, subrecords}` — `subrecords` só com campos escalares, **máx. 1 nível** (rejeição no service com mensagem clara),
**E** a validação de `data` contra o `schema` vive na camada de serviço (padrão AD-01); branch e2e atualizada.

**Dado que** o CRUD de registros,
**Quando** registros são criados/editados,
**Então** valores inválidos por tipo são rejeitados com erro por campo, e o caso motor (Viagens com trechos como sub-registros) passa nos testes.

### Story 19.2: Backend — edição de schema segura × destrutiva

Como Hugo,
Quero evoluir o schema de uma collection com registros existentes sem perder histórico,
Para que a collection acompanhe a vida sem migrações destrutivas (FR-14.5; DIR-3).

**Critérios de Aceitação:**

**Dado que** uma collection com registros,
**Quando** Hugo renomeia campo ou adiciona campo/opção de enum,
**Então** a edição é livre e os registros existentes permanecem válidos,
**E** mudar tipo/remover campo é bloqueado na API — apenas **desativação** do campo (chaves órfãs preservadas no JSONB, ocultas pela definição desativada).

### Story 19.3: Container no manifest + filhas dinâmicas na sidebar

Como Hugo,
Quero minhas collections ativas aparecendo na sidebar sob "Custom Collections",
Para que tenham cidadania de navegação igual às coded (FR-14.1, FR-14.4; AR-28).

**Critérios de Aceitação:**

**Dado que** a entrada estática única do container (archetype `custom_container`),
**Quando** o container é adicionado ao registro,
**Então** a rota paramétrica única `/collections/:collectionId` atende todas as filhas (o router permanece estático; filhas **nunca** entram no registro),
**E** o grupo da sidebar ganha server state (useQuery das filhas ativas) **confinado ao grupo do container**.

**Dado que** a lição conhecida do projeto (obrigatória na story — AR-28),
**Quando** o server state entra na Sidebar/BottomNav,
**Então** os 3 testes compartilhados (AppLayout/router/RouteAnnouncer) **ganham mocks de Query** e a suíte fica verde,
**E** container desativado = grupo some, dados intactos (FR-1.4).

**Dado que** o default conservador de cidadania (FR-14.7, FR-14.8 — absorvido da ex-19.6, navalha de Occam 2026-07-23),
**Quando** o épico fecha,
**Então** custom collections **não** têm `dashboardCard`, **não** participam de `contexto_ia`/Análises e aparecem no Index apenas via container (verificado por teste),
**E** não existe endpoint de export (sem export no MVP — DIR-14).

### Story 19.4: UI — criar e evoluir collections (construtor de schema)

Como Hugo,
Quero criar uma collection e definir seus campos numa UI clara,
Para que "criar a collection de Viagens" leve minutos (FR-14.2, FR-14.5, FR-14.6).

**Critérios de Aceitação:**

**Dado que** o mockup da 19.0,
**Quando** o construtor entra,
**Então** cria collection (nome, ícone) e campos tipados com preview; sub-registros com limite de 1 nível comunicado na UI; edição segura livre e destrutiva bloqueada com explicação (desativar como alternativa),
**E** empty-state com exemplos ilustrativos, sem presets.

### Story 19.5: UI — registros (lista, criação e detalhe)

Como Hugo,
Quero preencher e consultar os registros das minhas collections,
Para que os logs do Canadá vivam no bujo (FR-14.2, FR-14.9).

**Critérios de Aceitação:**

**Dado que** uma collection com schema,
**Quando** a superfície de registros entra,
**Então** lista com colunas derivadas do schema, criação/edição com inputs por tipo (incl. sub-registros em tabela aninhada), detalhe legível,
**E** campos desativados ficam ocultos na criação e visíveis (readonly) no histórico dos registros antigos; axe-core + estados obrigatórios passam,
**E** o e2e representativo do épico cobre: criar collection → registrar → evoluir schema → desativar campo → desativar container (absorvido da ex-19.6).

---

## Epic 20: Tier 3 · Alimentação (#5a)

Refeições, horários, fotos e janela de jejum do foodLog dentro do bujo — espelho local read-only, sync on-read com TTL, resiliente por construção (NFR-9). Define o padrão herdável do archetype integração.

*Fronteira de escopo (FR-11.6): espelho completo navegável/editável e a absorção do foodLog como desenvolvimento interno (#5b) ficam no **icebox** — fora deste épico.*

### Story 20.0: [UX] Mockup da Alimentação (x.0 — gate do épico)

Como Hugo,
Quero o mockup da superfície de Alimentação aprovado,
Para que a primeira collection de integração nasça com os estados de resiliência desenhados (UX-DR31, DIR-15).

**Critérios de Aceitação:**

**Dado que** o archetype integração (FR-1.2),
**Quando** a x.0 rodar,
**Então** cobre resumo diário (refeições + horários + fotos) e janela de jejum, com os estados: sincronizado, "última sincronização há X", erro de sync, fotos degradadas (placeholder), credenciais ausentes/inválidas e collection desligada (DIR-12c),
**E** promovida antes das stories de implementação.

### Story 20.1: Backend — espelho local, sync on-read e credenciais da collection

Como Hugo,
Quero o espelho local do foodLog sincronizado sob demanda,
Para que meus dados de alimentação existam no bujo sem depender do foodLog estar de pé (FR-11.1, FR-11.3, FR-11.4; AR-29; DIR-10).

**Critérios de Aceitação:**

**Dado que** o contrato real da API do foodLog nunca foi verificado formalmente (o [TR] cobriu C5/DSL/PA, não o foodLog — auditoria de premissas 2026-07-23),
**Quando** a story inicia,
**Então** a primeira task é um **spike de contrato registrado**: endpoints, auth, shape de refeições/horários/fotos/jejum e a natureza das URLs de foto (estável × presignada),
**E** o modelo do espelho só é escrito depois do spike; divergências do shape esperado são registradas antes de qualquer migration.

**Dado que** o app `food` novo,
**Quando** as migrations criam `food_log_entries` (shape mínimo: refeições, horários, janela de jejum, **referências** de foto) e `food_sync_state`,
**Então** o sync on-read dispara quando `last_sync_at` excede o TTL (settings), com botão de refresh manual, **sem scheduler** (django-q2 não é pré-requisito),
**E** falha de sync é silenciosa para o núcleo: grava `status`/`last_error` e a superfície degrada (NFR-9); branch e2e atualizada.

**Dado que** as credenciais são da collection (não globais),
**Quando** a config entra,
**Então** URL/credenciais vivem no `settingsSchema` da collection, criptografadas (Fernet — padrão AD-24), write-only na API,
**E** se o spike de contrato apontar URLs presignadas, o sync renova as referências (decisão AD-23 item 4).

### Story 20.2: Superfície — resumo diário e janela de jejum

Como Hugo,
Quero ver refeições, fotos e a janela de jejum do dia dentro do bujo,
Para que a alimentação componha meu panorama sem abrir outro app (FR-11.2, FR-11.4, FR-11.5).

**Critérios de Aceitação:**

**Dado que** o espelho da 20.1 e o mockup da 20.0,
**Quando** a superfície entra (1 entrada nova no manifest — DoD estrutural),
**Então** resumo diário com refeições/horários/fotos (URLs referenciadas — nunca binário copiado) e a janela de jejum calculada do espelho,
**E** com o foodLog fora do ar, a superfície renderiza o espelho com "última sincronização há X" e fotos em placeholder — o bujo nunca quebra (e2e cobre o cenário).

**Dado que** a fronteira de privacidade (FR-11.5),
**Quando** o épico fecha,
**Então** fotos são exibição — nenhum caminho as envia como contexto de IA (verificado por teste quando Análises existir; aqui, garantia estrutural: URLs não entram no espelho analítico),
**E** as métricas de alimentação ficam prontas para registro no catálogo de Análises (Épico 21 — cross-ref, sem dependência).

---

## Epic 21: Tier 3 · Análises + Configuração de IA (fases a/b/c)

BYO key global → Modelos de Relatório: fase a (dicionário semântico) → fase b (texto + gráficos via `serie_ref`/Recharts — a IA nunca toca o banco nem produz números, NFR-7) → fase c (agendamento django-q2 + Batch API — **gate: só após o Épico 22**, D7). FR-2 entra como primeiras stories (DIR-9). Guardrail DIR-1 obrigatório em toda story de geração.

### Story 21.0: [UX] Mockups de Análises e Config de IA (x.0 — gate do épico)

Como Hugo,
Quero os mockups do compositor de modelos, da superfície de relatórios e da config de IA aprovados,
Para que a collection mais nova do produto nasça com os dois sinais de IA distintos e todos os estados (UX-DR31; DIR-7).

**Critérios de Aceitação:**

**Dado que** os dois sinais distintos (DIR-7),
**Quando** a x.0 rodar,
**Então** cobre: config de IA (BYO key, máscara, cap mensal), tag "função de IA" (inativo explicado + link), compositor de Modelo de Relatório (métricas, filtros, anotações, conceitos, prompt, exemplar), superfície de geração/histórico, badge "dado lido por IA" nos formulários de origem — visuais **distintos** entre tag e badge,
**E** estados: sem chave, chave inválida, collection-fonte desligada, geração em andamento/falha, cap atingido, collection desligada (DIR-12c); promovida antes das stories.

### Story 21.1: Config de IA global — backend (BYO key + `ai_available`)

Como Hugo,
Quero armazenar minha chave de IA criptografada e derivar a capability global,
Para que todos os fluxos de IA tenham um único gate transversal (FR-2.1, FR-2.2, FR-2.4; AR-30; DIR-9).

**Critérios de Aceitação:**

**Dado que** o modelo `user_ai_settings` (1:1),
**Quando** a migration entra,
**Então** `{encrypted_api_key, provider default anthropic, monthly_cap_usd?}` com criptografia **Fernet** via `AI_KEY_ENCRYPTION_KEY` dedicada (≠ SECRET_KEY; procedimento de rotação documentado),
**E** a chave nunca toca o banco em texto puro e nunca aparece em log; branch e2e atualizada.

**Dado que** a API write-only,
**Quando** o cliente interage,
**Então** PUT aceita a chave; GET devolve só máscara (últimos 4) + `ai_available`; endpoint leve de config para o frontend (staleTime alto),
**E** allowlist de providers no backend (inicial: `anthropic`) — Gemini free tier proibido **por construção** (NFR-8).

### Story 21.2: Config de IA — UI + tag "função de IA"

Como Hugo,
Quero configurar minha chave e ver o que a IA destravaria,
Para que features de IA inativas se expliquem em vez de sumir (FR-2.3; AR-30; DIR-7).

**Critérios de Aceitação:**

**Dado que** o mockup da 21.0,
**Quando** a config entra em Configurações,
**Então** salvar/trocar/remover chave com máscara; cap mensal opcional,
**E** o componente compartilhado da tag "função de IA" (`shared/components/`) nasce: ícone + texto (nunca só cor), elemento inativo (não oculto), explica o porquê e linka a config — consumido por Análises e reutilizável pelo Épico 22.

### Story 21.3: Catálogo de métricas (allowlist em código)

Como Hugo,
Quero um catálogo único das métricas analisáveis,
Para que só o que está declarado exista para o sistema de Análises (FR-13.2 fonte; AR-31; NFR-7).

**Critérios de Aceitação:**

**Dado que** `analytics/catalog.py`,
**Quando** o catálogo entra,
**Então** registra métricas das collections existentes (hábitos, saúde, medicamentos-adesão, journalling `ai_context: on`, alimentação do espelho) com `{id, label, fonte (função→QuerySet/série), tipo, agregações permitidas, sensivel}`,
**E** métrica fora do catálogo não é referenciável em nenhuma spec (validação); collection-fonte desligada = métricas ocultas do compositor, não deletadas (FR-13.9); fotos jamais entram no catálogo (FR-11.5).

### Story 21.4: Modelo de Relatório — spec DSL validada e compilada

Como Hugo,
Quero compor Modelos de Relatório persistidos como spec validada,
Para que a IA (ou eu) só descreva análises — nunca queries (FR-13.2; AR-31; NFR-7).

**Critérios de Aceitação:**

**Dado que** o CRUD de `report_models`,
**Quando** uma spec é salva,
**Então** é validada por JSON Schema estrito (métricas do catálogo, agregações permitidas, filtros = range de datas + igualdade/existência; `additionalProperties: false`) e versionada (`spec_version`),
**E** `analytics/services/compiler.py` compila a spec para QuerySets do ORM — nenhum SQL cru, nenhuma string interpolada (testes com specs hostis).

**Dado que** defesa em profundidade,
**Quando** o caminho de leitura roda,
**Então** usa o alias `report_read` (role Postgres read-only + `statement_timeout` em settings/env),
**E** spec patológica é cortada pelo timeout sem afetar o alias default (teste de integração).

### Story 21.5: Fase a — dicionário semântico (anotações e conceitos)

Como Hugo,
Quero anotar minhas métricas e definir conceitos,
Para que a IA entenda o significado dos meus dados no meu vocabulário (FR-13.3).

**Critérios de Aceitação:**

**Dado que** o compositor (21.4),
**Quando** o dicionário entra,
**Então** anotações por métrica são globais com **override local** por modelo; conceitos (definições semânticas) são criáveis e referenciáveis nos modelos,
**E** tudo entra como contexto da geração (fase b) sem nunca virar query.

### Story 21.6: Fase b — geração backend (séries + IA com `serie_ref`)

Como Hugo,
Quero gerar uma análise sob demanda com texto e gráficos ancorados nos meus números reais,
Para que a IA redija — e o backend calcule (FR-13.1, FR-13.4, FR-13.6, FR-13.7; AR-31; DIR-1).

**Critérios de Aceitação:**

*Guardrail obrigatório (DIR-1): "A IA analisa e explica; nunca sugere, preenche ou automatiza captura/migração; transcrição só salva após confirmação explícita."*

**Dado que** um Modelo de Relatório válido e `ai_available`,
**Quando** Hugo aciona a geração (sempre ação explícita),
**Então** o backend compila a spec, computa as séries/agregados determinísticos (por ID) e chama a IA com structured outputs (JSON Schema estrito, sem recursão) — a resposta são blocos ordenados `{tipo: texto|grafico|tabela, serie_ref, titulo, anotacoes}`,
**E** a IA **nunca** recebe caminho de escrita nem devolve números: bloco com `serie_ref` inexistente é rejeitado (renderizam-se os válidos); fronteira de privacidade respeitada (só métricas do modelo + journalling `ai_context: on` + anotações/conceitos).

**Dado que** o snapshot imutável (padrão prompt-registry),
**Quando** a geração conclui,
**Então** `report_generations` grava prompt renderizado, versões (spec/exemplar), modelo, `usage`, `payload_hash`, blocos e séries — nunca UPDATE,
**E** teste do caso-âncora: anotação hostil ("ignore as instruções…") é inócua por construção.

### Story 21.7: Fase b — superfície de relatórios (Recharts, histórico e exemplar)

Como Hugo,
Quero ler as análises com gráficos, navegar o histórico e adotar um exemplar,
Para que os relatórios ganhem consistência de formato com o tempo (FR-13.4–13.6, FR-13.12).

**Critérios de Aceitação:**

**Dado que** os blocos da 21.6,
**Quando** a superfície renderiza (entrada no manifest — DoD),
**Então** texto + gráficos **Recharts** alimentados pelas séries referenciadas (resumo textual/tabela equivalente — a11y), histórico por modelo (data, período, snapshot),
**E** "Adotar como padrão" cria versão de exemplar (`report_exemplars`) usada nas gerações futuras do modelo; sem chave → superfície inativa com a tag "função de IA" (21.2).

### Story 21.8: Badge "dado lido por IA" + índice reverso

Como Hugo,
Quero ver nos formulários de origem quais dados algum modelo lê,
Para que a transparência acompanhe o consentimento (FR-13.8; AR-31; DIR-7/DIR-8).

**Critérios de Aceitação:**

**Dado que** o índice reverso métrica→modelos (`metric_index` + endpoint leve),
**Quando** uma métrica está selecionada em ≥1 modelo,
**Então** o formulário de origem exibe o badge (ícone + texto, visual **distinto** da tag "função de IA"),
**E** degradação graciosa obrigatória: Análises desligada ou endpoint em erro → **sem badge, formulário intacto** (nunca error boundary na origem; teste cobre).

### Story 21.9: Relatório médico como modelo especializado

Como Hugo,
Quero um Modelo de Relatório médico (saúde/medicamentos/PA por período),
Para que a consulta médica receba um resumo consistente (FR-13.11).

**Critérios de Aceitação:**

**Dado que** o compositor e o exemplar,
**Quando** o modelo médico é composto (métricas de saúde + adesão de medicamentos + PA quando existir),
**Então** gera com formato ancorado por exemplar adotado,
**E** exportação estruturada (PDF/arquivo) fica explicitamente fora (fase 2); PA entra como fonte quando o Épico 22 existir (degradação graciosa até lá).

### Story 21.10: Fase c — agendamento (django-q2) ⛔ gate: só após o Épico 22

Como Hugo,
Quero meus Modelos de Relatório executando sozinhos na cadência que eu definir,
Para que os relatórios cheguem sem eu lembrar de gerar (FR-13.10; AR-32; D7).

**Critérios de Aceitação:**

**Dado que** o gate da ordem mestre (esta story só entra após o Épico 22 — D7),
**Quando** django-q2 entra (broker ORM/Postgres — zero infra nova),
**Então** worker `qcluster` como serviço separado no Railway (mesma imagem/env), schedules geridos no admin, retries nativos,
**E** toda task usa `tenant_context(user)` explícito (fail-closed protege contra esquecimento — teste cobre); falha persistente aparece no admin sem afetar o request path.

### Story 21.11: Fase c — Batch API, cap mensal e skip por hash

Como Hugo,
Quero controle de custo automático nas gerações agendadas,
Para que a BYO key nunca gere surpresa de fatura (FR-13.10; AR-32).

**Critérios de Aceitação:**

**Dado que** gerações agendadas (21.10),
**Quando** rodam,
**Então** usam a Batch API da Anthropic (−50%; task submete, task de polling colhe),
**E** antes de gerar: cap mensal (`monthly_cap_usd`; soma via `usage` das gerações do mês) — excedido → **pula e registra visível** na superfície; `payload_hash` igual ao da última geração → **skip** (dados não mudaram; zero custo). Casos-âncora AD-26 testados.

---

## Epic 22: Tier 3 · Pressão Arterial (#20)

Registro de pressão por foto com transcrição de IA sob human-in-the-loop obrigatório, leituras avulsas ou sessões 7-2-2, dashboard clínico de média móvel de 7 dias, `source` desde a 1ª migration e fotos em R2 privado. Captura manual funciona sem chave de IA.

### Story 22.0: [UX] Mockups da Pressão Arterial (x.0 — gate do épico)

Como Hugo,
Quero os mockups da captura (foto e manual), do formulário de confirmação e do dashboard clínico aprovados,
Para que o human-in-the-loop seja desenhado antes de existir (UX-DR31; DIR-2).

**Critérios de Aceitação:**

**Dado que** o fluxo obrigatório (DIR-2),
**Quando** a x.0 rodar,
**Então** cobre: guia de enquadramento/crop, formulário pré-preenchido com **badge de confiança por campo** (verde/âmbar; `null` = vazio com foco), confirmação explícita, fallback manual sempre visível, sessões 7-2-2, dashboard de média móvel e histórico,
**E** estados: sem chave de IA (manual + tag "função de IA"), foto ilegível, timeout, outlier, collection desligada (DIR-12c); promovida antes das stories.

### Story 22.1: Infra de mídia — django-storages + R2 privado (story própria)

Como Hugo,
Quero o storage de fotos configurado e validado isoladamente,
Para que a primeira mídia binária do produto entre sem risco enterrado em story de feature (AR-33; revisão party-mode — Amelia).

**Critérios de Aceitação:**

**Dado que** o bucket R2 privado dedicado (separado do foodLog),
**Quando** `django-storages` (backend S3-compatível) é configurado 100% por env,
**Então** upload/download funcionam em dev com bucket de teste, mídia servida por endpoint autenticado + tenant-scoped emitindo **URL presignada de curta duração** (nunca URL pública),
**E** a validação em dev é registrada **antes** de qualquer story de feature consumir o storage.

### Story 22.2: Backend — schema clínico e ingestão

Como Hugo,
Quero o modelo de medições com par atômico, sessões e origem registrada,
Para que o dado clínico nasça correto e auditável (FR-12.1, FR-12.5–12.7; AR-33).

**Critérios de Aceitação:**

**Dado que** o app `bloodpressure` novo,
**Quando** as migrations criam `bp_sessions`, `bp_measurements` e `bp_photos`,
**Então** o par sistólica/diastólica é **atômico** (mesma linha), sessão opcional, CHECKs `systolic > diastolic` + ranges plausíveis (70–250 / 40–150 / pulso 30–220), e `source ENUM(photo_ai, manual, import)` **desde a 1ª migration**,
**E** branch e2e atualizada; médias de sessão e móvel derivadas on-read (nunca materializadas).

**Dado que** a ponte futura (`source: import`),
**Quando** o endpoint de ingestão entra,
**Então** aceita POST autenticado por `AutomationToken` (12.4) com validação idêntica — preparado sem retrabalho de modelo (teste cobre),
**E** validação server-side independente da IA: plausibilidade re-checada no service com mensagens amigáveis + **alerta de outlier** vs. média de 7 dias.

### Story 22.3: Captura manual e histórico

Como Hugo,
Quero registrar medições manualmente e consultar o histórico,
Para que a collection funcione por inteiro mesmo sem chave de IA (FR-12.4; DIR-2 fallback).

**Critérios de Aceitação:**

**Dado que** o mockup da 22.0,
**Quando** a superfície entra (entrada no manifest — DoD),
**Então** formulário manual completo (par + pulso + braço/posição/momento + notas), histórico/lista com contexto e origem (`source`),
**E** sem `ai_available`, a captura por foto aparece inativa com a tag "função de IA" (21.2) — o manual é pleno; axe-core + estados passam.

### Story 22.4: Captura por foto + IA (human-in-the-loop obrigatório)

Como Hugo,
Quero fotografar o monitor e confirmar os valores transcritos,
Para que o registro seja rápido sem jamais salvar sozinho (FR-12.2, FR-12.3, FR-12.5, FR-12.8; AR-33; DIR-1/DIR-2).

**Critérios de Aceitação:**

*Guardrail obrigatório (DIR-1): "A IA analisa e explica; nunca sugere, preenche ou automatiza captura/migração; transcrição só salva após confirmação explícita."*

**Dado que** `ai_available` e a guia de enquadramento,
**Quando** Hugo fotografa o display,
**Então** o cliente faz crop + redimensionamento (≤ ~1.100px) + **strip de EXIF antes do upload**, e o backend chama a IA (BYO key; **Haiku 4.5 default**; allowlist — nunca Gemini free tier) com structured output estrito `{systolic, diastolic, pulse: int|null, confidence, legible, notes}` + **instrução de recusa** (null em vez de adivinhar),
**E** o formulário volta **pré-preenchido** com badge de confiança por campo; **salvar só após confirmação explícita** (1 tap se tudo verde); `legible: false` ou timeout → fallback manual com a foto descartável.

**Dado que** a evidência auditável (FR-12.5),
**Quando** uma medição `photo_ai` é salva,
**Então** foto original (pós-crop, no R2 da 22.1) + `ai_raw_response` ficam associados à medição,
**E** os CHECKs/validação server-side rejeitam leituras implausíveis mesmo "lidas" pela IA (caso-âncora 300/80).

### Story 22.5: Sessões 7-2-2 e dashboard clínico

Como Hugo,
Quero agrupar medições em sessões e acompanhar a média móvel de 7 dias,
Para que a métrica clínica — não a leitura isolada — guie decisões (FR-12.1, FR-12.6).

**Critérios de Aceitação:**

**Dado que** o protocolo 7-2-2,
**Quando** Hugo cria uma sessão,
**Então** medições agrupam com médias da sessão derivadas on-read,
**E** o dashboard destaca a **média móvel de 7 dias** (com resumo textual), nunca a leitura isolada; outliers sinalizados (22.2) aparecem com contexto, sem alarme colorido isolado (UX-DR20).
