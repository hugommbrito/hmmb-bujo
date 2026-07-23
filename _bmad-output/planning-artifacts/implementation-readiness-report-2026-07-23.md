---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
status: 'complete'
overallReadiness: 'READY (condição: FR de recuperação de senha antes do Épico 10)'
documentsIncluded:
  prd:
    - prds/prd-hmmb-bujo-2026-06-15/prd.md
    - prds/prd-hmmb-bujo-2026-06-15/addendum.md
  architecture:
    - architecture.md
  epics:
    - epics.md
  ux:
    - ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md
    - ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md
  referencias:
    - sprint-change-proposal-2026-07-22.md
    - plano-de-acao-ui-e-ideias-2026-07-21.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-23
**Project:** hmmb-bujo

## Inventário de Documentos (Step 1)

### PRD
- **Whole:** `prds/prd-hmmb-bujo-2026-06-15/prd.md` (44K, mod. 2026-07-22) — reorganizado por collection no rito [PRD] de 2026-07-22
- **Acompanhante:** `prds/prd-hmmb-bujo-2026-06-15/addendum.md` (11K, mod. 2026-07-22)
- Pasta `_deprecados/` presente (arquivados; não conta como duplicata)

### Arquitetura
- **Whole:** `architecture.md` (155K, mod. 2026-07-22) — §3b com AD-17–27 do rito [ARCH]

### Épicos & Stories
- **Whole:** `epics.md` (245K, mod. 2026-07-23) — atualizado pelo [CE] com Épicos 12–22 + Épico 10 ampliado (86 stories)

### UX Design
- **Workspace atual:** `ux-designs/ux-hmmb-bujo-2026-07-17/` — DESIGN.md + EXPERIENCE.md (spines `final`, gate da Fundação fechado 2026-07-21) + 5 mockups key
- **Workspace legado:** `ux-designs/ux-hmmb-bujo-2026-06-15/` — contém LEGACY.md (não é duplicata ativa)

### Referências de reconciliação
- `sprint-change-proposal-2026-07-22.md` — ordem mestre + 15 diretrizes de story
- `plano-de-acao-ui-e-ideias-2026-07-21.md` — plano de ação (entrada deste rito)

### Issues
- **Duplicatas:** nenhuma (whole + sharded não coexistem)
- **Ausentes:** nenhum — os 4 tipos obrigatórios existem

## Análise do PRD (Step 2)

**Fonte:** `prds/prd-hmmb-bujo-2026-06-15/prd.md` (status: final, atualizado 2026-07-22) + `addendum.md`. Organização: núcleo + collections + plataforma (Grupos A–E). Numeração nova pós-CC 2026-07-22; de-para no Anexo A do PRD.

### Requisitos Funcionais Extraídos

#### Grupo A — Fundação e Plataforma

**FR-0 — Fundação**
- FR-0.1: Dados de cada usuário completamente isolados; nenhum dado acessível por outro usuário em nenhuma circunstância.
- FR-0.2: Autenticação via email/senha com sessão persistente.
- FR-0.3: Dois ambientes isolados (dev e prod); dados não se cruzam.
- FR-0.4: Suporte a múltiplos usuários desde o início; UI de convite/gestão em fase posterior (FR-15).

**FR-1 — Infraestrutura de Collections *(novo)***
- FR-1.1: Núcleo BuJo (logs Daily/Weekly/Monthly/Future, motor de migrações, recorrentes, arquivo, Brain Dump) é não-gateável por construção; todo o resto é collection opcional.
- FR-1.2: Taxonomia de 4 archetypes: coded fixa; coded com campos user-defined; coded de integração (fonte externa + espelho local); custom (schema no banco). Coded vivem no manifest; custom são conteúdo do container "Custom Collections" (FR-14).
- FR-1.3: Manifest/registro central declara cada collection coded (identidade, nome, ícone, rotas, entrada de navegação) e reserva `dashboardCard` e `settingsSchema`. Navegação derivada do registro. Aceite fatia 1: extração não altera nada visível; adicionar collection nova = baixo atrito.
- FR-1.4: Cardápio de ativação/desativação de collections (#14 peça 2); desativar preserva dados; reativar restaura; núcleo fora do cardápio; não é marketplace.
- FR-1.5: Default all-off para convidados (#14 peça 3): usuário novo nasce com todas as collections desligadas.
- FR-1.6: Granularidade da flag (espaço × usuário) decidida no desenho do Épico 10; manifest agnóstico. *(Nota, não requisito fechado.)*

**FR-2 — Configuração de IA / BYO key *(novo)***
- FR-2.1: Chave de API de IA fornecida pelo usuário (BYO key), configuração global, criptografada em repouso; única credencial de IA global (credenciais de integração ficam no `settingsSchema` da collection).
- FR-2.2: Capability derivada `ai_available` (= chave configurada) como estado transversal que habilita todos os fluxos de IA.
- FR-2.3: Tag "função de IA" (ícone + texto, nunca só cor — UX-DR20): elementos dependentes de IA sem chave ficam inativos (não ocultos), explicam o porquê e linkam à configuração.
- FR-2.4: Dados sensíveis (saúde) nunca enviados a provedores que treinam com o conteúdo (Gemini free tier proibido). (Ver NFR-8.)

**FR-3 — Plataforma de Automação e Captura / C5 *(novo)***
- FR-3.1: Credencial de automação dedicada, distinta da sessão de login — longa duração, restrita a captura/resumo, revogável.
- FR-3.2: Captura rápida por automação (tipo + texto + valor opcional) com confirmação imediata; preparada para dados importados (ponte Apple Health futura).
- FR-3.3: Resumo do dia por automação em uma requisição (tarefas pendentes, hábitos do dia, última entrada de journalling) para widget.
- FR-3.4: Automação nasce com limite de taxa e registro de auditoria.
- FR-3.5: PWA não é canal de captura rápida (limitação iOS); polir a PWA é oportunista.

#### Grupo B — Núcleo BuJo (não-gateável)

**FR-4 — Motor BuJo**
- FR-4.1: Quatro tipos de log: Daily (um/dia), Weekly (um/semana, seg–dom), Monthly (tarefas em datas específicas), Future (data completa ou parcial só-mês).
- FR-4.2: Future Log aceita data parcial (só mês); dia definido na migração mensal.
- FR-4.3: Campos de tarefa: título (obrigatório), descrição, subtarefas, etiqueta Eisenhower (4 cores), categoria (6 cores, borda lateral) — opcionais.
- FR-4.4: Estados: pendente, iniciada (`/`), concluída (`X`), cancelada, migrada, adiada.
- FR-4.5: Iniciar = `/`; concluir = `\` formando X.
- FR-4.6: Ordenação manual das tarefas dentro de um log.
- FR-4.7: Migração diária: pendentes do dia anterior apresentadas uma a uma; decisão por tarefa (migrar / adiar no mês / adiar fora do mês / cancelar).
- FR-4.8: Migração semanal (segunda-feira): tarefas do Weekly anterior sem disposição; migrar / adiar / cancelar.
- FR-4.9: Abertura do mês: revisa Monthly anterior sem disposição + puxa automaticamente itens do Future Log do mês corrente com suas datas.
- FR-4.10: Semana fechada = todas as tarefas com disposição.
- FR-4.11: Recorrentes = templates: título, grupo (Semanal/Mensal/Anual), recorrência texto livre, ativo, demais campos de tarefa.
- FR-4.12: Na abertura de cada ciclo, lista de recorrentes ativos apresentada; placement manual, sem auto-placement.
- FR-4.13: Semanas/meses fechados consultáveis no arquivo com estado final de cada tarefa.
- FR-4.14 *(novo, #24)*: Rótulo (nome) por usuário para cada uma das 6 cores fixas de categoria; aparece em selects e tooltips.
- FR-4.15 *(novo, #15)*: Flag `waiting_on` (Aguardando Terceiro) com indicador visual e filtro; anotação, não estado (proibido 7º estado); backend Tier 0, UI na onda da home/Daily.
- FR-4.16 *(novo, #23)*: Sucessor de tarefa migrada herda status `started`; só `pending`/`started` são migráveis; `migrated`/`postponed` terminais; regra de service, sem tocar schema.

**FR-5 — Brain Dump**
- FR-5.1: Caixa de entrada independente, sem data, sem log de destino obrigatório; estado normal vazio.
- FR-5.2: Item: título obrigatório; descrição e log de destino opcionais.
- FR-5.3: Processamento manual (mover ou descartar); sem migração automática.
- FR-5.4: Indicador visual persistente enquanto houver itens pendentes.

**FR-6 — Home: Dashboard, Hoje e Captura *(novo)***
- FR-6.1: Ponto de entrada pós-login = Dashboard-panorama (revoga parcialmente UX-DR16).
- FR-6.2: Dashboard = ver: panorama do dia + cards das collections ativas; card do dia acionável (rapid logging + migrações pendentes), preservando captura a um toque.
- FR-6.3: Hoje = trabalhar: mesma visão das tasks do dia que o Dashboard (componente único compartilhado); diferem pelo entorno.
- FR-6.4: Empty-state do dashboard = cardápio/oferta: núcleo + convites para ativar collections, cada convite ligando ao toggle (FR-1.4).
- FR-6.5: Cada collection ativa contribui com card no dashboard (via `dashboardCard` do manifest); conteúdo/layout na spec da home (bmad-ux).
- FR-6.6: Home-panorama apresenta indicadores de uso do sistema; conjunto exato e fórmulas definidos na spec da home (bmad-ux). [ASSUMPTION]

#### Grupo C — Collections coded

**FR-7 — Hábitos**
- FR-7.1: Grupos de hábitos criados pelo usuário.
- FR-7.2: Criação: nome, emoticon, grupo, peso inicial, tipo (booleano/numérico).
- FR-7.3: Numéricos: meta + bonus de completude (%).
- FR-7.4: Percentual de completude diário ponderado por pesos (booleano = 100% do peso; numérico = proporcional até (100−bonus)%, 100% na meta).
- FR-7.5: Pesos alteráveis a qualquer momento; valem a partir do dia corrente.
- FR-7.6: Log diário = snapshot imutável (hábitos ativos + pesos vigentes do dia).
- FR-7.7: Hábitos desativados, nunca deletados; inativos somem do log ativo, ficam no histórico.
- FR-7.8: Reativação: voltam ao log a partir do dia da reativação.
- FR-7.9: Histórico consultável por data.
- FR-7.10: Histórico como gráfico de evolução por hábito; mudanças reais de config anotadas como eventos datados; multiplicador de fim de semana/feriado não é mudança de config. (AD-10/AD-11.)

**FR-8 — Saúde-Métricas**
- FR-8.1: Campos dinâmicos criados pelo usuário: nome, tipo (inteiro, decimal, booleano, enum, texto), ativo.
- FR-8.2: Log diário preenchido pelo usuário; campos inativos fora do log ativo, preservados no histórico.
- FR-8.3: Histórico em 3 visualizações: tabela dia a dia, gráficos de evolução por campo, dashboard de período.
- *Nota PRD: refinos #16/#17/#18/#22 (reordenar, editar, percentual/enum multi, grupos) fora do escopo do PRD; entram como refinos de story no [CE] preservando "editar seguro × destrutivo".*

**FR-9 — Medicamentos**
- FR-9.1: Entidade separada das métricas: nome, dose, blocos de horário (manhã/tarde/noite).
- FR-9.2: Mesmo medicamento em múltiplos blocos com doses diferentes.
- FR-9.3: Confirmação por bloco de uma vez ou individual.
- FR-9.4: Ativo/inativo; histórico de confirmações preservado após desativação.

**FR-10 — Journalling *(novo)***
- FR-10.1: Campos de relato user-defined: {nome, prompt opcional, cadência (diário|semanal|livre), múltiplas entradas (bool), contexto_ia (bool), gravar horário (bool), ativo (bool)}.
- FR-10.2: Ciclo de vida editar seguro × destrutivo: renomear/adicionar = livre; mudar tipo/remover = só desativação.
- FR-10.3: `contexto_ia` nasce OFF (opt-in por campo); só com on o campo vira contexto de Análises (UX-DR19).
- FR-10.4: Múltiplas entradas por campo configurável.
- FR-10.5: Cadência configurável por campo já no MVP; histórico navegável apropriado por cadência (diário por data/mês; semanal/livre com visualização própria).
- FR-10.6: Visibilidade no Hoje: card único agregando campos ativos.
- FR-10.7: Absorção da Gratidão: campo seed "Gratidões" {diário, múltiplas entradas, contexto_ia off}; entradas migradas; superfície antiga aposentada na mesma onda.

**FR-11 — Alimentação (#5a) *(novo)***
- FR-11.1: Consome foodLog (API externa) somente leitura, via espelho local sincronizado.
- FR-11.2: Superfície: resumo diário (refeições + horários + fotos) e janela de jejum.
- FR-11.3: Credenciais/URL no `settingsSchema` da collection.
- FR-11.4: Resiliência: foodLog indisponível nunca quebra o bujo; degradação com indicador de última sincronização. (NFR-9.)
- FR-11.5: Métricas de alimentação = fontes de primeira classe nos Modelos de Relatório; fotos são exibição, nunca contexto de IA.
- FR-11.6: Espelho completo navegável/editável e #5b fora do MVP (icebox). *(Nota.)*

**FR-12 — Pressão Arterial (#20) *(novo)***
- FR-12.1: N medições/dia; par sistólica/diastólica atômico + pulso opcional; contexto opcional (braço, posição, momento); avulsa ou em sessão (protocolo 7-2-2).
- FR-12.2: Captura por foto + IA que transcreve valores (captura, não sugestão — UX-DR19).
- FR-12.3: Human-in-the-loop obrigatório: foto → IA (saída estruturada estrita com recusa `null`) → formulário pré-preenchido com badge de confiança por campo → confirmação explícita → salvar. Nunca salvar direto.
- FR-12.4: Fallback manual sempre visível; ilegível/timeout cai no manual.
- FR-12.5: Evidência auditável: foto original + JSON bruto guardados; validação de plausibilidade + alerta de outlier vs. média de 7 dias (server-side).
- FR-12.6: Dashboard clínico usa média móvel de 7 dias.
- FR-12.7: `source` enum (photo_ai/manual/import) desde o início; caminho import preparado no schema, não implementado.
- FR-12.8: Privacidade: crop do display + strip de EXIF; Gemini free tier proibido; no multiusuário, consentimento explícito para IA em nuvem + fluxo manual como padrão para terceiros.

**FR-13 — Análises *(novo)***
- FR-13.1: Guardrail UX-DR19: IA analisa e explica; nunca sugere/preenche/automatiza captura ou migração; nunca gera/executa queries; nunca produz números; geração só por ação explícita.
- FR-13.2: Entidade central Modelo de Relatório: {nome, métricas cross-collection, filtros (range + condições simples), anotações por métrica (global com override local), conceitos, prompt de expectativa, exemplar adotado?, histórico de gerações}.
- FR-13.3: Fase a — dicionário semântico: anotações por métrica + conceitos como contexto da IA. [ASSUMPTION nos conceitos]
- FR-13.4: Fase b — geração sob demanda: texto + gráficos referenciando séries pré-computadas pelo backend (via `serie_ref`); IA escolhe tipo/título/destaques; números vêm do backend.
- FR-13.5: Ancoragem por exemplar: usuário "adota" resultado satisfatório como padrão do modelo; vai como contexto nas gerações futuras.
- FR-13.6: Relatórios salvos com histórico; cada geração = snapshot imutável.
- FR-13.7: Fronteira de privacidade: só métricas selecionadas + campos com `contexto_ia: on`; fotos nunca.
- FR-13.8: Seleção de métrica = consentimento; badge "dado lido por IA" (ícone + texto) no formulário de origem; índice reverso métrica→modelos com degradação graciosa; badge distinto da tag FR-2.3.
- FR-13.9: Collection-fonte desligada = fora de novos relatórios (métricas ocultas, não deletadas; relatórios antigos intactos).
- FR-13.10: Fase c — geração agendada, só depois das fases a/b.
- FR-13.11: Relatórios médicos = Modelo de Relatório especializado com exemplar adotado; exportação estruturada (PDF) = fase 2.
- FR-13.12: "Resumo mensal por IA" (Gratidão) = apenas um Modelo de Relatório possível.

#### Grupo D — Collections custom

**FR-14 — Custom Collections (C6) *(novo)***
- FR-14.1: Collection coded container: entrada estática única no manifest; custom collections do usuário são conteúdo do container (banco).
- FR-14.2: Custom collection = lista de registros com schema user-defined; campos tipados incl. campo-array de sub-registros com máx. 1 nível de aninhamento.
- FR-14.3: Sistema de tipos próprio, independente do Épico 7.
- FR-14.4: Navegação: sidebar, grupo "Custom Collections"; cada ativa é entrada da sidebar.
- FR-14.5: Edição de schema com registros: segura livre; destrutiva bloqueada (só desativação).
- FR-14.6: Nasce vazia com exemplos ilustrativos no empty-state; sem templates/presets.
- FR-14.7: Sem export no MVP; fase 2 se a dor aparecer.
- FR-14.8: Cidadania no ecossistema (card, contexto_ia/Análises, cardápio) decidida por feature/story; default off. *(Nota.)*
- FR-14.9: Caso motor: logs do Canadá (#1) — Viagens, Moradias, Empregos.

#### Grupo E — Gestão de Usuários

**FR-15 — Gestão de Usuários (Épico 10 ampliado)**
- FR-15.1: Convite de novos usuários por email.
- FR-15.2: Espaço de dados isolado por usuário.
- FR-15.3: [ASSUMPTION] Sem espaço compartilhado no MVP.
- FR-15.4: [BACKLOG] Competição entre amigos por percentual de hábitos.
- FR-15.5: Épico 10 entrega também: observabilidade mínima (antes de convidar externos) + peças 2–4 do #14 (cardápio FR-1.4, all-off FR-1.5, empty-state oferta FR-6.4).
- FR-15.6: [LGPD] Consentimento explícito para IA em nuvem sobre dados sensíveis de terceiros; fluxo 100% manual como padrão; granularidade da flag decidida no desenho do épico.

**Total de FRs: 110** (16 grupos: FR-0 a FR-15; contagem por sub-item: 4+6+4+5+16+4+6+10+3+4+7+6+8+12+9+6)

### Requisitos Não-Funcionais Extraídos

- NFR-1 — Mobile real: 100% das ações do fluxo diário executáveis em mobile sem scroll horizontal.
- NFR-2 — Performance: Daily Log e migrações percebidos como instantâneos [ASSUMPTION: < 2s em conexão normal].
- NFR-3 — Isolamento de dados: nenhum dado de um usuário acessível por outro.
- NFR-4 — Integridade do histórico: logs passados imutáveis; nenhuma operação futura altera registros históricos.
- NFR-5 — Ambientes separados: dev e prod com dados isolados.
- NFR-6 — Disponibilidade: uptime 99% no horário 6h–23h; downtime tolerável só de madrugada.
- NFR-7 — Segurança de IA *(novo)*: nenhuma query gerada/executada por IA; specs validadas server-side contra catálogo/allowlist; role read-only + `statement_timeout` no caminho de leitura.
- NFR-8 — Privacidade de dados sensíveis *(novo)*: chave de IA criptografada em repouso; dados de saúde nunca a provedores que treinam com conteúdo; fotos de PA com crop + strip de EXIF.
- NFR-9 — Resiliência de integrações externas *(novo)*: fonte externa indisponível nunca quebra o núcleo; degradação graciosa com indicador de última sincronização.

**Total de NFRs: 9**

### Requisitos e Restrições Adicionais

- **Counter-métrica (Seção 3):** 100% das decisões de migração exigem ação explícita; nenhuma tarefa movida silenciosamente.
- **Jornadas UJ-1 a UJ-8** com notas CC (entrada pós-login = Dashboard; Gratidão → campo seed do Journalling).
- **Sequência (7.2):** ordem-mestre por onda vive no `sprint-change-proposal-2026-07-22.md` §4 (autoridade única); PRD descreve capacidades. Todo épico com UI nasce com story x.0 de UX.
- **Addendum (contexto técnico):** manifest estático frontend sem hooks; AutomationToken padrão Home Assistant; DSL de Análises = spec JSON validada + compilação server-side p/ ORM; Recharts (não Vega); django-q2 + Batch API na fase c; 3 âncoras temporais do Journalling; espelho foodLog; schema BPMeasurement/BPSession (FHIR/7-2-2); Haiku 4.5 default p/ foto de PA; JSONB p/ custom collections (aninhamento máx. 1).
- **Restrições nomeadas:** schema Task congelado (6 estados; flag em vez de 7º estado); decisões contra-recomendação preservadas (§2.10 do proposal): cadência no MVP (FR-10.5), tipos próprios C6 (FR-14.3), sem export (FR-14.7).

### Avaliação de Completude do PRD

**Pontos fortes:** FRs numerados e organizados por collection; de-para de renumeração (Anexo A) explícito p/ reconciliar epics.md; guardrails de IA (UX-DR19/DR20) codificados como requisito; fronteiras de privacidade explícitas; ASSUMPTIONs marcadas inline; notas de escopo (o que ficou fora e por quê) rastreáveis ao proposal.

**Pontos de atenção (a validar nos próximos steps):**
1. FR-6.6 e FR-13.3 dependem de definição posterior (spec da home; conceitos "a confirmar na onda") — aceitável se as stories x.0 correspondentes existirem no epics.md.
2. Refinos de Saúde (#16–18/#22) estão *fora do PRD* por decisão de rito, mas devem existir como stories no [CE] — traçar no step 3.
3. FR-1.6/FR-15.6 deixam a granularidade da flag deliberadamente aberta (decisão no Épico 10) — verificar que o epics.md a registra como decisão de desenho, não como lacuna.
4. Pendência registrada no plano de ação (via [CE]): **recuperação de senha antes do Épico 10** não consta como FR no PRD (FR-0.2 não cobre reset de senha) — candidata a gap formal.
5. Rename "cardápio"→"Index" decidido no [CE] ainda não refletido no PRD (pendência de [IR], per plano de ação).

## Validação de Cobertura dos Épicos (Step 3)

**Fonte:** `epics.md` (atualizado 2026-07-23 pelo [CE]; 22 épicos, ~119 stories no total — Épicos 1–9/11 entregues + Épico 10 ampliado + Épicos 12–22 novos com 86 stories). O documento contém FR Coverage Map próprio, renumerado para a numeração nova (Anexo A do PRD). Verificação feita em dois níveis: mapa de cobertura declarado + conferência por amostragem no texto das stories (Épicos 10, 12, 16, 17, 19, 21, 22 lidos integralmente).

### Matriz de Cobertura

| FR | Épico/Story | Status |
|---|---|---|
| FR-0.1, 0.3, 0.4 | Épico 1 (entregue) | ✓ Entregue |
| FR-0.2 | Épico 2 (entregue); paridade de superfície → 18.3 | ✓ Entregue |
| FR-1.1–1.3 | Épico 12 · Story 12.3 (manifest fatia 1, pixel-idêntico) | ✓ Coberto |
| FR-1.4 | Épico 10 · 10.4 (backend) + 10.5 (Index/página de toggles) | ✓ Coberto |
| FR-1.5 | Épico 10 · 10.4 (all-off p/ novos; existentes all-on) | ✓ Coberto |
| FR-1.6 | Épico 10 · 10.4 (decisão de granularidade registrada como input de design) | ✓ Coberto |
| FR-2.1, 2.2, 2.4 | Épico 21 · 21.1 (BYO key + `ai_available` + allowlist) | ✓ Coberto |
| FR-2.3 | Épico 21 · 21.2 (tag "função de IA" compartilhada) | ✓ Coberto |
| FR-3.1 | Épico 12 · 12.4 (AutomationToken) | ✓ Coberto |
| FR-3.2 | Épico 12 · 12.5 (`POST /api/capture`) | ✓ Coberto |
| FR-3.3 | Épico 12 · 12.6 (`GET /api/summary/today`) | ✓ Coberto |
| FR-3.4 | Épico 12 · 12.5 + 12.6 (throttle + log estruturado) | ✓ Coberto |
| FR-3.5 | Épico 12 · restrição registrada no preâmbulo (requisito negativo) | ✓ Coberto |
| FR-4.1–4.13 | Épicos 3/4 (entregues) + 11 (refinos); paridade no 14/17 | ✓ Entregue |
| FR-4.14 | Épico 18 · 18.2 (#24 nome às categorias) | ✓ Coberto |
| FR-4.15 | Épico 12 · 12.2 (backend) + Épico 17 · 17.5 (UI) | ✓ Coberto |
| FR-4.16 | Épico 12 · 12.1 (herança de status, testes no nível da regra) | ✓ Coberto |
| FR-5.1–5.4 | Épico 5 (entregue); paridade → Épico 15 | ✓ Entregue |
| FR-6.1, 6.2, 6.5 | Épico 17 · 17.3 (Dashboard-panorama) | ✓ Coberto |
| FR-6.3 | Épico 17 · 17.1 (componente compartilhado) + 17.2 (Hoje) | ✓ Coberto |
| FR-6.4 | Épico 17 · 17.0 (desenho = contrato fechado) + Épico 10 · 10.6 (implementação) | ✓ Coberto |
| FR-6.6 | Épico 17 · 17.0 (definição na spec) + 17.3 (implementação) | ✓ Coberto |
| FR-7.1–7.10 | Épico 6 (entregue); paridade → 16.1–16.2 | ✓ Entregue |
| FR-8.1–8.3 | Épico 7 (entregue); paridade → 16.4 | ✓ Entregue |
| FR-8.R (#16/#17/#18/#22) | Épico 16 · 16.5–16.8 (fora do PRD por decisão de rito; nível de story) | ✓ Coberto |
| FR-9.1–9.4 | Épico 8 (entregue); paridade → 16.9 (+ verificação `prescribed_by`) | ✓ Entregue |
| FR-10.1–10.5 | Épico 16 · 16.11 (backend, 3 âncoras, `ai_context` off) + 16.12 (superfícies/históricos por cadência) | ✓ Coberto |
| FR-10.6 | Épico 16 · 16.12 (`dashboardCard`) + Épico 17 · 17.3 (consumo na home) | ✓ Coberto |
| FR-10.7 | Épico 16 · 16.13 (migração + freeze + verificação) + 16.14 (aposentadoria) | ✓ Coberto |
| FR-11.1–11.6 | Épico 20 · 20.1 (espelho/sync/credenciais) + 20.2 (superfície) | ✓ Coberto |
| FR-12.1, 12.5–12.7 | Épico 22 · 22.2 (schema clínico, `source` desde a 1ª migration) | ✓ Coberto |
| FR-12.2, 12.3, 12.8 | Épico 22 · 22.4 (foto+IA human-in-the-loop, crop/EXIF no cliente) | ✓ Coberto |
| FR-12.4 | Épico 22 · 22.3 (manual pleno sem chave) | ✓ Coberto |
| FR-12.6 | Épico 22 · 22.5 (média móvel de 7 dias) | ✓ Coberto |
| FR-13.1 | Épico 21 · guardrail DIR-1 embutido em 21.6/22.4 | ✓ Coberto |
| FR-13.2 | Épico 21 · 21.3 (catálogo) + 21.4 (spec DSL validada/compilada) | ✓ Coberto |
| FR-13.3 | Épico 21 · 21.5 (fase a) | ✓ Coberto |
| FR-13.4–13.6 | Épico 21 · 21.6 (geração backend) + 21.7 (superfície/exemplar/histórico) | ✓ Coberto |
| FR-13.7 | Épico 21 · 21.6 (fronteira de privacidade testada) | ✓ Coberto |
| FR-13.8 | Épico 21 · 21.8 (badge + índice reverso + degradação graciosa) | ✓ Coberto |
| FR-13.9 | Épico 21 · 21.3 (métricas ocultas, não deletadas) | ✓ Coberto |
| FR-13.10 | Épico 21 · 21.10 + 21.11 (⛔ gate: só após Épico 22 — D7) | ✓ Coberto |
| FR-13.11 | Épico 21 · 21.9 (relatório médico especializado) | ✓ Coberto |
| FR-13.12 | Épico 21 · 21.7 (resumo mensal = modelo possível) | ✓ Coberto |
| FR-14.1–14.3 | Épico 19 · 19.1 (tipos próprios, máx. 1 nível) | ✓ Coberto |
| FR-14.4 | Épico 19 · 19.3 (filhas dinâmicas + mocks dos 3 testes) | ✓ Coberto |
| FR-14.5 | Épico 19 · 19.2 (edição segura × destrutiva) | ✓ Coberto |
| FR-14.6–14.9 | Épico 19 · 19.3–19.5 (cidadania off, sem export, caso motor) | ✓ Coberto |
| FR-15.1 | Épico 10 · 10.1 (convite por email) | ✓ Coberto |
| FR-15.2, 15.3 | Épico 10 · 10.2 (onboarding isolado) | ✓ Coberto |
| FR-15.4 | — (competição entre amigos) | ⏸ BACKLOG intencional (documentado no PRD e no epics.md) |
| FR-15.5 | Épico 10 · 10.0 (observabilidade) + 10.5 + 10.6 | ✓ Coberto |
| FR-15.6 | Épico 10 · 10.7 (LGPD/consentimento IA) | ✓ Coberto |

### Estatísticas de Cobertura

- **Total de FRs no PRD:** 110
- **Cobertos nos épicos:** 109
- **Diferidos intencionalmente (documentados):** 1 (FR-15.4 — backlog)
- **FRs ausentes sem justificativa:** 0
- **Cobertura efetiva do escopo comprometido: 100%**

### FRs nos épicos que não estão no PRD

- **FR-8.R** (refinos C3 #16/#17/#18/#22): identificador criado pelo [CE]; o PRD registra explicitamente que esses refinos ficam fora dele por decisão de rito. **Consistente** — não é divergência.
- **Requisito implícito novo (pendência de PRD registrada no epics.md):** **recuperação de senha** — o epics.md (preâmbulo do Épico 10) sinaliza: *"recuperação de senha não existe em nenhum FR — corrigir antes de implementar este épico"*. **GAP DE PRD confirmado** (ver Missing Coverage abaixo).

### Cobertura Ausente / Pendências

#### Crítico (bloqueia o Épico 10, não as ondas anteriores)

**FR ausente no PRD: Recuperação de senha.**
- Impacto: convidado trancado para fora é falha de onboarding; o Épico 2 nunca teve requisito de reset de senha.
- Situação: a pendência já está roteada dentro do próprio epics.md ao [PRD]/[IR]; **não há FR nem story**.
- Recomendação: escrever FR (grupo FR-0 ou FR-15) e story no Épico 10 (antes de 10.1/10.2) — via rito [PRD] (update curto) antes do [SP] chegar ao Épico 10.

#### Alta prioridade (consistência documental, não bloqueia implementação)

1. **Rastreabilidade das Stories 10.1/10.2:** citam "FR-6.1/FR-6.2/FR-6.3" na numeração **antiga** (= FR-15.1–15.3 novos). Após a renumeração, FR-6.x significa Home/Dashboard — risco real de confusão na implementação. Corrigir as citações nas duas stories.
2. **Rename "cardápio"→"Index" pendente no PRD:** decisão registrada no epics.md (2026-07-23); PRD FR-1.4/6.4/15.5 ainda dizem "cardápio". Roteado ao [PRD].
3. **Divergência NFR-8 (PRD × epics):** o epics.md registra decisão do dono (2026-07-22) removendo a cláusula "crop + strip de EXIF" do NFR transversal (permanece como requisito de feature em FR-12.8/AD-27); o **PRD ainda contém a cláusula no NFR-8**. Alinhar o texto do PRD.

## Avaliação de Alinhamento UX (Step 4)

### Status do Documento de UX

**ENCONTRADO** — workspace `ux-designs/ux-hmmb-bujo-2026-07-17/` (DESIGN.md + EXPERIENCE.md, ambos `status: final`; gate da Fundação fechado em 2026-07-21). O workspace 2026-06-15 está formalmente marcado como LEGACY. Cobertura do spine: fundação (tokens, shell, componentes, estados, a11y, responsividade) + spines M06–M10 (Weekly, Monthly, Future, Recorrentes, Migração/Catch-Up) + alternador do Hoje + signup + pictogramas Phosphor. Mockups de módulo (M11–M23) **deliberadamente diferidos** para as stories x.0 de cada onda (DIR-15/UX-DR31) — decisão de processo do plano de ação, não lacuna.

### Alinhamento UX ↔ PRD

**Alinhado no essencial.** As jornadas UJ-1–8 correspondem aos Key Flows do spine; os guardrails de IA do PRD (FR-13.1, FR-12.2–12.3) citam textualmente a fronteira UX-DR19; a voz/tom (zero gamificação) é consistente com o princípio "sem troféus/sequências" dos FRs de Hábitos; UX-DR21–31 foram extraídos para o epics.md como requisitos acionáveis.

**Divergências datadas (ambas com rota de resolução já planejada — não bloqueiam):**

1. **Entrada principal:** a tabela de IA do EXPERIENCE.md lista "Hoje = Daily Log e entrada principal", mas o PRD FR-6.1 (CC 2026-07-22, **posterior** ao fechamento do spine em 21/07) define pós-login = Dashboard-panorama. Resolução: a Story 17.0 (spec da nova home, x.0 ampliada) atualiza o spine — é pré-requisito duro da Onda 2b. **Até lá o EXPERIENCE.md está desatualizado neste ponto** (registrar nota no spine seria prudente).
2. **Onda 5 do Migration Strategy:** o spine lista "Gratidão" nascendo na nova fundação; o CC decidiu que o **Journalling substitui** a migração da Gratidão (FR-10.7). O Épico 16 (stories 16.10–16.14) já reflete a decisão correta; o spine é atualizado pela x.0 16.10.

**Nota menor:** o signup do spine (confirmação de senha local) é detalhamento de UI compatível com FR-0.2; porém **recuperação de senha não existe nem no PRD nem no spine** — reforça o gap crítico já registrado no Step 3.

### Alinhamento UX ↔ Arquitetura

**Alinhado e rastreável.** A seção "Decisions for Architecture and Stories" do EXPERIENCE.md foi consumida: manifest/nav derivada (AD-17 ↔ UX-DR22), componente compartilhado Hoje/Dashboard (AD-21 ↔ D4/UX-DR16 revisado), `iconKey` como mudança de contrato com story própria (Story 16.2 ↔ UX-DR27), fila unificada e ritual no shell (Stories 14.3/14.9 ↔ UX-DR25), soft delete de recorrentes (Story 14.4 ↔ UX-DR24). Performance: skeletons + otimismo (UX-DR14/spine States) casam com AD-13/AD-14 e NFR-2.

**Achados:**

1. **[MÉDIO] Deltas de domínio M06–M10 sem AD dedicado.** O EXPERIENCE.md exige que os deltas (ciclos de vida Em planejamento/Em andamento/Finalizada, decisões-snapshot, fila unificada, constraints de unicidade, materialização sequencial) "passem por Correct Course/arquitetura antes de implementação". O CC aprovou o lado de produto e o [CE] os especificou com bom detalhe nas stories 14.1–14.3 (constraints, gates idempotentes, data migration retroativa) — mas o architecture.md §3b **não tem AD** para o modelo desses estados/entidades (o §9 do proposal não os roteou ao [ARCH]). Risco: decisões de modelagem (estado em coluna × tabela própria; shape da entidade de decisão-snapshot) serão tomadas ad-hoc no dev-story. **Recomendação:** adendo leve de [ARCH] (1 AD curto) OU aceitar explicitamente a modelagem no nível da story 14.1 com as convenções §6 — decisão do dono.
2. **[RECONCILIAÇÃO SOLICITADA AO IR — resolvida aqui] Rollback por superfície × promoção única a prod.** O epics.md (decisão Hugo 2026-07-23) pede que o [IR] reconcilie a estratégia de promoção com o migration-plan ("rota segura de rollback por superfície"). Reconciliação registrada: **não há contradição** — a coexistência por rota e o rollback por superfície (UX-DR30 item 10, migration-plan) são mecanismos do ambiente **dev/homologação**; para **prod**, o rollback é **não promover** (prod permanece no sistema atual até ≈Épico 18). As stories de UI continuam definindo ativação/rollback por superfície normalmente — o que muda é que o público delas até a promoção é o próprio Hugo em dev. **Recomendação:** anotar essa nuance no migration-plan.md (1 parágrafo) para evitar que stories futuras tratem rollback de prod como exigência por superfície.
3. **[MENOR — deferimento aceito] Tema escuro:** o sistema entregue tem modo claro/escuro (UX-DR1); o DESIGN.md novo define paleta única clara e registra "tema escuro fora da 1ª fundação" (UX-DR21). Superfícies migradas perdem o dark mode até um ciclo futuro — deferimento explícito e aceito no spine; sem ação, apenas ciência.

### Avisos

- Nenhum aviso de UX ausente — o produto é user-facing e a documentação de UX existe, está final e governa o trabalho novo.
- O processo x.0 (DIR-15/UX-DR31) cobre o risco de mockups faltantes por onda; o único pré-requisito duro externo à sequência é a **spec da nova home (17.0)** — já mapeada como gate da Onda 2b e listada no plano de ação (FASE 2).

## Revisão de Qualidade dos Épicos (Step 5)

**Escopo da revisão:** Épicos 10 (ampliado) e 12–22 — o trabalho a implementar. Épicos 1–9/11 são registro histórico do entregue (o [CE] declara que não reabrem) e foram auditados apenas quanto à consistência de rastreabilidade.

### Valor de usuário por épico

Todos os épicos novos têm goal centrado no usuário ("Hugo captura de fora do app", "Hugo navega o app inteiro num shell novo", "Hugo cria as próprias collections") e declaram standalone value. Casos-limite avaliados:

- **Épico 12 (Tier 0, sem UI):** aparência de "épico técnico", mas entrega valor real de usuário (captura externa por atalho iOS, widget de resumo, herança de status, flag waiting_on no backend). A única story puramente técnica é a 12.3 (manifest, aceite pixel-idêntico) — infraestrutura deliberada do CC com DoD mecânico verificável. **Aceito** (padrão da casa, como as stories 1.x da fundação).
- **Épicos 13–18 (ondas de migração):** valor = mesma funcionalidade na linguagem nova, com paridade comprovada por checklist + passes de a11y. Estrutura correta para brownfield.

### Independência e dependências

**Sem dependências circulares. Sem forward dependencies ocultas.** A cadeia declarada é consistente: 12 → 13 → 14 → 15 → 16 → 17 → 18 → 10 → 19 → 20 → 21 → 22 (ordem mestre §4 do proposal). Verificações específicas:

- Story 12.6 lida com o Journalling inexistente ("enquanto não existir, a última gratidão" + campo genérico) — dependência futura **neutralizada por design**. ✓
- Story 16.13 troca a fonte do summary (12.6) sem breaking change — cross-epic explícito. ✓
- Story 10.6 consome o slot da 17.3 e o contrato da 17.0 — coerente, pois o Épico 10 roda **depois** das ondas. ✓
- Sequência interna do Journalling (16.11 → 16.12 → 16.13 verificação → 16.14 aposentadoria) com pré-condição dura para o drop no 18.5. ✓
- Premissa blindada (Daily legado utilizável até o Épico 17) protegida por ACs de contrato nas stories 14.1/14.3. ✓

### Qualidade de stories e ACs

- **Formato:** Dado que/Quando/Então/E (pt-BR, convenção do projeto) em todas as stories novas. ✓
- **Testabilidade:** ACs específicos e mecânicos (ex.: "snapshots passam sem update", "grep zero imports", "count(origem) == count(destino)", casos-âncora nomeados). Nível excepcional. ✓
- **Estados de erro:** cobertos sistematicamente (offline, falha de escrita, degradação, timeout de IA, cap excedido). ✓
- **Timing de banco:** migrations nomeadas por story, criadas quando necessárias, com "branch e2e atualizada" embutido (lição recorrente codificada). ✓
- **Rastreabilidade:** stories citam FR/AR/DIR/UX-DR. ✓ (exceção: 10.1/10.2 — abaixo)

### Violações e achados

#### 🔴 Críticas
Nenhuma violação estrutural crítica. (O gap de recuperação de senha é de PRD — Step 3 — e já tem rota; bloqueia o Épico 10, não a estrutura dos épicos.)

#### 🟠 Maiores
1. **Stories 10.1/10.2 defasadas do padrão atual.** Escritas em 2026-06-22 (pré-CC): citam FRs pela **numeração antiga** (FR-6.1–6.3, que hoje significam a Home) e têm ACs mais rasos que o padrão do ciclo — sem estados de erro (convite expirado/inválido, falha de envio de email, convite reenviado). **Recomendação:** refresh das duas stories (renumerar citações p/ FR-15.1–15.3 + ACs de erro) antes do [SP] chegar ao Épico 10 — pode ser feito no próprio [SP] ou num create-story.
2. **Deltas M06–M10 sem AD (herdado do Step 4).** Stories 14.1–14.3 especificam bem os gates/constraints, mas a forma de modelagem (estado em coluna × tabela; entidade de decisão-snapshot) não tem decisão arquitetural registrada. Risco de decisão ad-hoc no caminho crítico do roadmap.

#### 🟡 Menores
1. **Numeração ≠ ordem de execução.** Épico 10 roda depois dos Épicos 12–18; Épico 11 rodou após o 4. Está documentado ("identificadores, não ordem"), mas o [SP] **precisa codificar a ordem mestre** no sprint-status — risco de automação seguir ordem numérica.
2. **Épico 21 pausa no meio** (21.10/21.11 gateadas ⛔ para depois do Épico 22). O [SP]/story-automator precisa representar um épico que para e retoma — atenção na geração do sprint plan.
3. **Story 14.5 potencialmente grande demais:** nascimento da Task Row base canônica + Weekly Board + ritual de planejamento com rails numa story só, no caminho crítico. Candidata a split no [SP]/create-story (ex.: Task Row base como story própria).
4. **Mockup da fase c envelhece:** a 21.0 desenha estados da fase c (cap atingido, agendamento) que só serão implementados após o Épico 22 — risco baixo de retrabalho de spec; aceitável.

### Checklist de conformidade (épicos novos)

| Critério | Resultado |
|---|---|
| Épicos entregam valor de usuário | ✓ (12.3 técnica, aceita e justificada) |
| Independência entre épicos | ✓ na ordem mestre |
| Stories dimensionadas | ✓ (ressalva 14.5) |
| Sem forward dependencies | ✓ |
| Tabelas criadas quando necessárias | ✓ |
| ACs claros e testáveis | ✓ (ressalva 10.1/10.2) |
| Rastreabilidade a FRs | ✓ (ressalva 10.1/10.2) |

## Sumário e Recomendações (Step 6)

### Status Geral de Prontidão

# ✅ READY — com 1 condição pontual (não bloqueia o início)

O conjunto PRD + Arquitetura + UX + Épicos/Stories está **pronto para a Fase 4** (sprint planning e implementação) para toda a fila até o Épico 18. A ordem mestre é única e clara, a cobertura de FRs é 100% do escopo comprometido, as stories têm ACs de qualidade excepcional e as divergências encontradas são documentais e pontuais — todas com rota de correção definida. A **única condição dura** está longe do início da fila: o Épico 10 não pode ser implementado antes de o FR de recuperação de senha existir.

### Issues por criticidade

**🔴 Crítico (1) — corrigir antes do Épico 10 (não bloqueia Tier 0/ondas):**
1. **FR de recuperação de senha inexistente** (PRD): rotear ao [PRD] (update curto) para escrever o FR + story no Épico 10 antes de 10.1/10.2. A pendência já está sinalizada no próprio epics.md.

**🟠 Maiores (4) — corrigir na primeira oportunidade:**
2. Stories 10.1/10.2 com FRs na numeração antiga (FR-6.x → FR-15.x) e ACs sem estados de erro — refresh antes do [SP] do Épico 10.
3. Deltas M06–M10 (ciclos de vida Weekly/Monthly, decisões-snapshot, fila unificada) sem AD dedicado — adendo leve de [ARCH] ou aceite explícito da modelagem no nível da story 14.1 (decisão do dono; o Épico 14 é o caminho crítico).
4. PRD NFR-8 diverge da decisão registrada no epics.md (cláusula crop+EXIF removida do NFR transversal em 2026-07-22; permanece em FR-12.8) — alinhar o texto do PRD.
5. Rename "cardápio"→"Index" pendente no PRD (FR-1.4/6.4/15.5) — aplicar no mesmo update de [PRD] do item 1.

**🟡 Menores (5) — ciência e mitigação no [SP]:**
6. Ordem de execução ≠ ordem numérica (Épico 10 depois do 18): o [SP] deve codificar a ordem mestre no sprint-status.
7. Épico 21 pausa nas stories 21.10/21.11 (gate ⛔ pós-Épico 22): representar no sprint plan.
8. Story 14.5 candidata a split (Task Row base + Weekly Board + ritual).
9. EXPERIENCE.md desatualizado em 2 pontos datados (entrada principal; Onda 5 Gratidão×Journalling) — atualizado pelas x.0 17.0 e 16.10; anotar no spine se desejado.
10. Migration-plan: anotar a nuance "rollback de prod = não promover" (reconciliação feita neste relatório, §Step 4).

### Próximos Passos Recomendados

1. **[PRD] update curto (1 sessão):** FR de recuperação de senha + rename cardápio→Index + ajuste do NFR-8. Na sequência, refresh das stories 10.1/10.2 no epics.md (citações + ACs de erro) e story de recuperação de senha no Épico 10.
2. **Decisão do dono sobre os deltas M06–M10:** adendo [ARCH] leve (1 AD) **ou** aceite formal da modelagem no nível da story 14.1. Recomendo o adendo — o Épico 14 é o gate vertical e caminho crítico.
3. **[SP] `bmad-sprint-planning`:** gerar o sprint-status com a ordem mestre (12 → 13 → 14 → 15 → 16 → 17 → 18 → 10 → 19 → 20 → 21(a/b) → 22 → 21(c)), os gates x.0 human-in-the-loop (lotes do Épico 16; automator só entra após x.0 done) e o gate ⛔ das 21.10/21.11.
4. **Anotação de 1 parágrafo no migration-plan.md** sobre a estratégia de promoção única a prod (item 10).

Os itens 1–2 podem rodar em paralelo; nada impede o [SP] e o início do Épico 12 imediatamente (Tier 0 não é afetado por nenhum issue).

### Nota Final

Esta avaliação identificou **10 issues** (1 crítico, 4 maiores, 5 menores) em 4 categorias (PRD, arquitetura, épicos/stories, documentação UX/plano de migração). Nenhum afeta a estrutura do plano: são correções documentais e uma pendência de requisito já auto-sinalizada pelo próprio [CE]. O trabalho de planejamento dos ritos [CC]→[PRD]→[ARCH]→[CE] chegou coeso a este gate — os épicos rastreiam 100% do escopo comprometido, com decisões de produto, arquitetura e UX mutuamente referenciadas e datadas.

---

**Data da avaliação:** 2026-07-23
**Avaliador:** rito [IR] `bmad-check-implementation-readiness` (Claude + HugoMMBrito)
**Insumos:** prd.md + addendum.md (2026-07-22) · architecture.md §1–8 + §3b (2026-07-22) · epics.md (2026-07-23) · DESIGN.md/EXPERIENCE.md 2026-07-17 (final, gate 2026-07-21) · sprint-change-proposal-2026-07-22.md · plano-de-acao-ui-e-ideias-2026-07-21.md
