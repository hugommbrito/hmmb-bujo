---
date: 2026-07-22
workflow: bmad-correct-course
status: approved (2026-07-22 — aprovação explícita do usuário; edições E1–E7 aplicadas)
mode: incremental
participante: HugoMMBrito
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-07-21-1751.md
  - _bmad-output/planning-artifacts/research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22.md
  - _bmad-output/planning-artifacts/plano-de-acao-ui-e-ideias-2026-07-21.md
  - _bmad-output/specs/spec-design-system-migration/SPEC.md
  - _bmad-output/specs/spec-design-system-migration/migration-plan.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
  - _bmad-output/planning-artifacts/epics.md
---

# Sprint Change Proposal — Reconciliação pós-Trilha B (CC 2026-07-22)

> Rito **[CC] bmad-correct-course** da FASE 1 do plano de ação 2026-07-21. Reconcilia a triagem de ideias ([BP] Rodadas 1–4), os veredictos do [TR] e a migração de design system com o produto entregue (Épicos 1–9 e 11 done; MVP funcional completo).

---

## 1. Sumário do gatilho

**Não é falha de story** — é a reconciliação planejada do gate de convergência: as duas trilhas do plano de ação fecharam (Fundação do design system aprovada em 2026-07-21; triagem [BP] + viabilidade [TR] concluídas em 2026-07-21/22) e produziram, ao longo de dias, decisões que precisavam ser confrontadas entre si e com o produto real. O CC identificou **uma contradição estrutural real** (condição (b) da Sally × Onda 2 do migration-plan), **duas decisões pendentes nomeadas** (destino do "Hoje"; horizonte do Journalling) e **um conjunto de reescritas já maduras** aguardando formalização (FR-4.3, UX-DR16, fronteira do DR19, #15, #17).

**Evidências:** documentos de entrada listados no frontmatter; contradições mapeadas na seção "Contradições e overlaps" do [BP] e na seção "Implicações para o [CC]" do [TR].

---

## 2. Decisões já resolvidas pela cronologia (formalizadas aqui, não redecididas)

Regra de precedência aplicada: **Rodada 4 > Rodada 3 > Rodada 1** do [BP]; **[TR] > [BP]** em viabilidade técnica.

1. **FR-4.3 muda de natureza** — de feature fixa ("resumo mensal por IA") para capacidade de **Modelos de Relatório** (Mergulho 3); a IA **compõe specs validadas** (DSL JSON compilado server-side contra catálogo/allowlist), **nunca gera nem executa queries** e **nunca produz números** ([TR]: OWASP LLM01/LLM05, ataques P2SQL). Fase b = texto + gráficos via `serie_ref` + Recharts; fase c = django-q2 + Batch API; custo < US$ 1/mês.
2. **UX-DR16 revogado parcialmente** — home deixa de ser o Daily Log e passa a ser o **Dashboard-panorama** (Rodada 2); exigências preservadas: captura a um toque e card do dia **acionável**.
3. **Fronteira do UX-DR19** — o DR proíbe IA como **primitivo de interação** (sugestão/preenchimento/automação de captura e migração); análises sobre dados preenchidos e transcrição sob confirmação humana são **compatíveis**. Guardrail obrigatório nas stories de Análises e #20.
4. **#15 "Aguardando Terceiro" = flag** (`waiting_on` + indicador + filtro), **nunca 7º estado** — o enum de status é parte do agregado Task congelado (Story 3.1); `migrated`/`postponed` são terminais.
5. **Edição segura × destrutiva** como princípio transversal (filosofia do Épico 7 / Story 7.1): renomear e adicionar opções é livre; mudar tipo/remover é bloqueado (só desativação). Vale para **#17** (métricas), **schema de C6** e **campos do Journalling**.
6. **BYO key = configuração global de IA** (Rodada 4 supersede R2/R3) + capability `ai_available` + **tag "função de IA"** (ícone + texto) em elementos inativos que explicam e linkam a config. Credenciais de integração (foodLog) permanecem no `settingsSchema` da collection.
7. **C6 = collection coded container "Custom Collections"** (Rodada 4): entrada estática no manifest; filhas dinâmicas vêm do banco. Taxonomia de 4 archetypes registrada: coded fixa · coded com campos user-defined · custom (conteúdo do container) · coded de integração.
8. **C1 superseded → Journalling** (Rodada 3): collection com campos de relato configuráveis (`{nome, prompt?, cadência, múltiplas_entradas, contexto_ia, gravar_horário, ativo}`); **absorve a Gratidão** (Épico 9): campo seed "Gratidões", migração das entradas, aposentadoria da superfície na mesma onda.
9. **Manifest de collections = fatia 1, Tier 0** ("vamos já", sob as condições (a)/(b)/(c) da Sally); **C5 sem app nativo** (wrapper adiado indefinidamente — [TR]); **#20 viável somente com human-in-the-loop obrigatório** ([TR]).
10. **Decisões contra-recomendação do facilitador preservadas** (o CC não as "corrige"): C6 com sistema de tipos independente do Épico 7 · C6 sem export no MVP · Journalling com cadência configurável já no MVP.

---

## 3. Decisões tomadas neste CC (Hugo, 2026-07-22)

| # | Questão | Decisão |
|---|---------|---------|
| D1 | Modo do workflow | **Incremental** — cada edição revisada individualmente (E1–E7, todas aprovadas) |
| D2 | Condição (b) da Sally × Onda 2 do migration-plan | **Rachar a Onda 2**: 2a (App Shell) migra cedo; 2b (Daily + Dashboard + Hoje) vai para o fim da fila, com a spec da home como pré-requisito. **Onda 3 (Núcleo BuJo) assume o papel de gate vertical de implementação** |
| D3 | #15 preso na onda do fim | **Backend já, UI na onda**: campo `waiting_on` + service + API entram como Tier 0 (sem UI); indicador visual e filtro nascem na Onda 2b |
| D4 | Destino do "Hoje" | **Mantido, com empregos crisp (Sally) e implementação compartilhada (Winston)**: o componente de visualização + manipulação das tasks do dia é UM só, reutilizado; muda o entorno — **Dashboard** = cards das demais collections (sem collections ativas, convite de ativação/empty-state-cardápio); **Hoje** = itens de trabalho (eventos, migrações pendentes, rapid logging). Hoje = trabalhar / Dashboard = ver |
| D5 | Journalling × migração da Gratidão | **A "onda Gratidão" vira a onda Journalling**: na Onda 5 constrói-se o Journalling direto no design system novo já absorvendo a Gratidão (sem migrar a superfície antiga; zero retrabalho duplo) |
| D6 | Stories de plataforma do C5 | **Cedo, junto dos quick wins (Tier 0)**: token de automação + `POST /api/capture` + `GET /api/summary/today`; gestão do token via Django admin no início; endpoints nascem com rate limiting e logging |
| D7 | Ordem do Tier 3 (pós-TR) | **C6 → Alimentação (#5a) → Análises fases a/b → #20 Pressão Arterial → Análises fase c** |
| D8 | Posição do Épico 10 ampliado | **Depois de TODAS as ondas** — convidado do dia zero já cai na home nova com empty-state/cardápio; Tier 3 vem depois |

**Nota sobre D4:** a sub-condição da Sally ("Hoje só existe com ≥1 collection ativa") **perde força** nessa definição — as duas páginas diferem pelo entorno mesmo sem collections. A spec da nova home valida esse ponto.

---

## 4. Ordem mestre do roadmap

1. **Tier 0 — agora, sem dependência de onda (sem UI visível):**
   - #23 — sucessor de migração herda `started` (regra de service; só `pending`/`started` são migráveis)
   - Manifest de collections — fatia 1 (registro estático, dados puros; aceite **pixel-idêntico**)
   - #15 backend — campo `waiting_on` + service + API (UI fica para a Onda 2b)
   - C5 plataforma — token de automação (modelo próprio, escopado, revogável; admin) + `POST /api/capture` (payload raso) + `GET /api/summary/today` + rate limiting/logging; atalhos iOS e widget Scriptable ficam do lado do usuário
2. **Onda 2a — App Shell** (sidebar, bottom-nav, FAB, layout no sistema novo, consumindo o manifest)
3. **Onda 3 — Núcleo BuJo** (novo gate vertical: Weekly, Monthly, Future, Migração/Catch-Up, Recorrentes, Arquivo)
4. **Onda 4 — Captura** (Brain Dump, badge, FAB, Capture Sheet)
5. **Onda 5 — Módulos: migração + refinos** (Hábitos; Saúde-Métricas com C3: #16 → #17/#18/#22; Medicamentos — Saúde e Medicamentos = 2 collections + grupo visual "Saúde"; **Journalling substitui a migração da Gratidão**)
6. **Spec da nova home** (bmad-ux) → **Onda 2b — Daily + Dashboard(home) + Hoje** (componente compartilhado de tasks do dia; UI do #15; desenho do empty-state)
7. **Onda 6 — Consolidação** (Config com #24 nome às categorias; auth; residuais; remoção do legado)
8. **Épico 10 ampliado** — 10.0 observabilidade → #14 peças 2–4 (página de toggles/"cardápio", default all-off para convidados, story do empty-state do dashboard como superfície de oferta) → 10.1 convite → 10.2 onboarding. Inputs de design: granularidade da flag (espaço × usuário); cláusulas LGPD (consentimento explícito para IA em nuvem; fluxo manual como padrão para terceiros)
9. **Tier 3 — grandes investimentos:** C6 Custom Collections (caso motor: logs do Canadá/#1) → Alimentação (#5a) → Análises fases a/b (BYO key global + `ai_available` nascem aqui) → #20 Pressão Arterial (foto+IA com confirmação humana) → Análises fase c (agendamento django-q2 + Batch API)
10. **Oportunista (sem posição fixa):** polir a PWA (manifest completo, badge, Declarative Web Push); widget Scriptable "resumo do dia"
11. **Icebox:** #13 timer de foco · #9-restante (superfície Histórico unificada) · #5b reimplementar foodLog · wrapper nativo/widgets de 1ª classe

**Absorvidas/encerradas:** #6/#21 → requisito de theming da migração (tokens semânticos) · #1 → C6 · #2/#4 (C1) → Journalling · #9-parcial → Story 11.11.

---

## 5. Análise de impacto

### Épicos

- **Épicos 1–9 e 11 (done):** não reabrem. Refinos viram épicos/stories novos no [CE]. A Gratidão (Épico 9) será absorvida pelo Journalling na Onda 5 — os dados migram, a superfície aposenta; o épico entregue permanece histórico.
- **Épico 10 (backlog):** escopo **ampliado** — além de 10.0/10.1/10.2, ganha as peças 2–4 do #14 (cardápio, default all-off, empty-state como oferta) e os inputs de design (granularidade da flag; LGPD). Posição: depois de todas as ondas (D8).
- **Épicos novos (a criar no [CE]):** Tier 0/plataforma; um épico por onda de migração (2a, 3, 4, 5, 2b, 6); um épico por investimento do Tier 3 (C6, Alimentação, Análises, #20).

### Artefatos

| Artefato | Impacto |
|---|---|
| PRD | FR-4.3 reescrito (E1); backlog §8 reconciliado (E2); FRs novos por onda a escrever no rito [PRD] |
| epics.md | UX-DR16 revogado parcialmente (E3); fronteira do UX-DR19 registrada (E4); épicos novos virão do [CE] |
| migration-plan.md | Nova ordem de ondas (E5): racha 2a/2b, gate vertical na Onda 3, Onda 5 com refinos + Journalling |
| sprint-status.yaml | Housekeeping (E6): épicos 1/2/3/7/8/9 → done; Story 10.0 adicionada |
| plano-de-ação | FASE 1 concluída; FASES 2–3 roteadas com escopo (E7) |
| Arquitetura | Sem edição neste CC — lista de decisões roteada para o rito [ARCH] (seção 9) |
| UX (DESIGN/EXPERIENCE) | Sem edição neste CC — spec da nova home roteada para bmad-ux antes da Onda 2b; mockup por onda mantido (padrão FASE 3) |

### Técnica

- **Backend:** django-q2 (nova dependência, fase c de Análises); modelo de token de automação; endpoints de captura/resumo; campo `waiting_on`; regra de herança de status na migração; futuras tabelas de Journalling/C6/Análises/BP conforme [ARCH].
- **Frontend:** manifest/registry estático (dados puros — sem hooks/TanStack Query, para não exigir mocks novos nos 3 testes compartilhados de AppLayout/router/RouteAnnouncer); quando C6 chegar, filhas dinâmicas do container exigem server state na sidebar → mocks novos nesses 3 testes (registrar na story de C6).
- **Segurança/privacidade:** SQL gerado por IA eliminado por arquitetura (DSL compilado); role read-only + `statement_timeout` como defesa extra; chave de IA criptografada em repouso; Gemini free tier proibido para dados de saúde; crop/EXIF strip nas fotos de PA.

---

## 6. Abordagem recomendada

**Opção 1 — Ajuste Direto** (sem rollback; sem redução de MVP — o MVP está entregue e intacto). O trabalho novo entra como extensão do plano: épicos novos ordenados pela ordem mestre (seção 4).

- **Esforço:** alto no agregado (multi-onda + features novas), mas fatiado em ondas com gates.
- **Risco:** médio-baixo — as decisões estruturais foram amarradas por [BP] (4 rodadas), [TR] (viabilidade com fontes) e este CC (8 decisões explícitas do dono).
- **Riscos nomeados:** (1) gate vertical deslocado — mitigado pelos gates de UX já provados e pela Onda 3 como prova de implementação; (2) Onda 5 pesada (módulos + refinos + Journalling) — o [CE] deve fatiar em stories pequenas e o [SP] pode dividir a onda em lotes; (3) spec da home é gargalo da Onda 2b — rodar o rito bmad-ux com antecedência (não precisa esperar a Onda 6).

**Classificação de escopo: MAJOR** — replan fundamental com handoff para PM/Arquiteto ([PRD] → [ARCH] → [CE] → [IR] → [SP]).

---

## 7. Propostas de edição aprovadas (modo incremental — todas aprovadas em 2026-07-22)

### E1 — PRD · FR-4.3 reescrito

**Arquivo:** `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md`

**ANTES:**

> **FR-4.3** — **[BACKLOG]** Resumo mensal gerado por IA.

**DEPOIS:**

> **FR-4.3** — **[BACKLOG — collection Análises, Tier 3]** **Modelos de Relatório:** o usuário compõe modelos reutilizáveis de análise sobre os próprios dados: métricas selecionadas de outras collections, filtros (range de datas + condições simples), anotações e conceitos (globais com override local), prompt de expectativa e exemplar adotado como âncora de formato. A IA redige a análise — texto + gráficos que **referenciam séries pré-computadas pelo backend** (`serie_ref`) — a partir de uma **spec validada** (DSL JSON compilado server-side contra catálogo/allowlist). **A IA nunca gera nem executa queries, e nunca produz números.** Geração sempre por ação explícita; relatórios salvos com histórico; agendamento (fase c: django-q2 + Batch API) só após as fases a/b. O antigo "resumo mensal por IA" vira um Modelo de Relatório possível, não uma feature fixa. Chave de IA fornecida pelo usuário (config global; capability `ai_available`). Guardrail UX-DR19 aplicável.

**Racional:** Mergulho 3 do [BP] (entidade central) + veredicto de segurança do [TR]. O rito [PRD] pode realocar o texto para uma seção própria de Análises.

### E2 — PRD · Backlog §8 reconciliado

**Arquivo:** `prd.md`, seção "Backlog (fora do MVP)". Anotações item a item: correlações de IA e resumo mensal por IA **riscados** (absorvidos por Análises/FR-4.3); food log **riscado** (vira collection Alimentação #5a); tracking por foto **riscado** (superseded pelo foodLog; #5b icebox); relatórios médicos e dashboard de indicadores **anotados** para confirmação no [PRD]; notificações e PWA **anotados** com o caminho técnico do [TR]; gestão de usuários **anotada** com o Épico 10 ampliado; demais itens inalterados.

### E3 — epics.md · Revogação parcial do UX-DR16

**Arquivo:** `_bmad-output/planning-artifacts/epics.md` (inventário de UX-DRs). A cláusula "pós-login abre no Daily Log de hoje" é revogada; home = **Dashboard-panorama**; exigências preservadas (captura a um toque; card do dia acionável); "Hoje" permanece como superfície de trabalho (Hoje = trabalhar / Dashboard = ver, componente compartilhado); detalhamento na spec da nova home.

### E4 — epics.md · Fronteira do UX-DR19

**Arquivo:** `epics.md` (inventário de UX-DRs). Registro da fronteira: a proibição de "sugestões de IA" vale para IA como **primitivo de interação**; análises sobre dados preenchidos e transcrição sob confirmação são compatíveis. Guardrail obrigatório nas stories de Análises/#20 + regras de consentimento (`contexto_ia` opt-in default off; badge "dado lido por IA" com cor + ícone/texto).

### E5 — migration-plan.md · Nova ordem de ondas

**Arquivo:** `_bmad-output/specs/spec-design-system-migration/migration-plan.md`. Tabela "Ordem de migração" substituída: Ondas 0/1 marcadas concluídas; **2a App Shell** cedo; **3 Núcleo BuJo = novo gate vertical**; 4 Captura inalterada; **5 Módulos = migração + refinos** (C3 na Saúde; 2 collections + grupo; Journalling no lugar da Gratidão); **2b Daily + Home no fim** (pré-requisito: spec da home); 6 Consolidação (com #24). Nova linha na tabela de riscos: "Gate vertical deslocado" com mitigação.

### E6 — sprint-status.yaml · Housekeeping

Épicos 1, 2, 3, 7, 8 e 9: `in-progress` → `done` (todas as stories e retrospectivas concluídas; correção contábil). Nova entrada: `10-0-observabilidade-minima-antes-de-usuarios-convidados: backlog`.

### E7 — plano-de-ação · FASE 1 fechada + roteamento

FASE 1 marcada concluída com link para este proposal. FASE 2 reescrita com escopo por rito, **incluindo o rito [ARCH] que faltava** e o rito pontual de bmad-ux para a spec da home (detalhes na seção 9).

---

## 8. Diretrizes vinculantes para as stories (a embutir no [CE])

1. **Guardrail DR19 (Análises e #20):** *"A IA analisa e explica; nunca sugere, preenche ou automatiza captura/migração; transcrição só salva após confirmação explícita."* — texto obrigatório nas stories dessas features.
2. **#20 human-in-the-loop (do [TR]):** foto (com guia de crop) → IA (structured output estrito com instrução de recusa: `null` em vez de adivinhar) → formulário pré-preenchido com badge de confiança por campo → confirmação explícita → salvar; fallback manual sempre visível; foto original + JSON bruto guardados; validação de plausibilidade + alerta de outlier server-side; Haiku 4.5 por padrão; **nunca** Gemini free tier.
3. **Edição segura × destrutiva** (aplicar em #17, C6 e Journalling): renomear/adicionar opção = livre; mudar tipo/remover = só desativação; histórico preservado.
4. **#15:** flag `waiting_on` (+ indicador visual + filtro) — proibido criar 7º estado; story de backend no Tier 0, UI na Onda 2b.
5. **#23:** sucessor de migração herda `started` da origem; regra de service (Stories 4.2/11.6), sem tocar schema; só `pending`/`started` são migráveis.
6. **Manifest fatia 1:** registro estático com `id`, nome, ícone, rotas lazy, entrada de sidebar (label/grupo/ordem); campos reservados `dashboardCard` e `settingsSchema` sem consumidores; **dados puros** (sem hooks/Query); aceite = app **pixel-idêntico**; DoD estrutural: collection nova = pasta da feature + UMA entrada no registro.
7. **Sinais de IA distintos (Rodada 4):** tag "função de IA" (feature precisa de key; inativo explica e linka config) ≠ badge "dado lido por IA" (dado selecionado em ≥1 Modelo de Relatório; no formulário de origem). Ambos com ícone + texto, nunca só cor (UX-DR20). Índice reverso métrica→modelos com degradação graciosa.
8. **Consentimento:** `contexto_ia` nasce **off** em todo campo de journalling (opt-in explícito); em métricas, a seleção no Modelo é o consentimento e o badge é a transparência.
9. **BYO key global:** nasce com a primeira feature de IA (Análises fase a); criptografada em repouso; deriva `ai_available`.
10. **Alimentação (#5a):** read-only; espelho local sincronizado; credenciais no `settingsSchema` da collection; foodLog fora do ar **nunca** quebra o bujo (indicador de última sincronização; fotos podem degradar); fotos são exibição, **nunca** contexto de IA.
11. **C5:** payloads rasos (`{type, text, value?}`); token escopado aos endpoints de captura/resumo, revogável, sem refresh; rate limiting + logging; ingestão preparada para `source: import` (ponte Apple Health futura do #20).
12. **Condições da Sally vigentes:** (a) extração do manifest é contrato puro (nenhuma mudança visual pega carona); (c) todo mockup daqui em diante inclui o estado "collection desligada/ausente".
13. **Épico 10:** consentimento explícito para "leitura por IA em nuvem" de dados de terceiros; fluxo 100% manual como padrão para convidados; granularidade da flag (espaço × usuário) decidida no desenho do épico.
14. **Decisões contra-recomendação preservadas** (não "corrigir"): tipos de C6 independentes do Épico 7; C6 sem export no MVP; Journalling com cadência configurável no MVP.
15. **Story x.0 de UX no início de cada épico com superfície de UI** (decisão Hugo, aprovação deste CC): todo épico novo que toque UI nasce com uma story `x.0` de design — rodar **bmad-ux** para produzir o mockup/spec da superfície com as features já decididas, promovendo o resultado a DESIGN/EXPERIENCE — como **gate de entrada** do épico; nenhuma story de implementação do épico começa antes da x.0 aprovada. Épicos sem UI (Tier 0/plataforma, 10.0 observabilidade) não ganham x.0. Nota operacional: a x.0 é executada pelo rito bmad-ux (human-in-the-loop), **não** pelo dev-story/story-automator — o automator só entra no épico após a x.0 estar `done`. A spec da nova home é formalmente a x.0 (ampliada) da Onda 2b.

---

## 9. Handoff e roteamento

**Classificação MAJOR → Product Manager / Arquiteto.** Sequência (cada rito em janela nova):

| Ordem | Rito | Escopo |
|---|---|---|
| 1 | **[PRD]** `bmad-prd` (update) | Aplicar E1/E2 no PRD; escrever FRs novos: infraestrutura de collections (manifest, #14 peças 2–4, taxonomia de archetypes), Journalling (absorvendo FR-4.1/4.2), C6, Análises (fases a/b/c), Alimentação (#5a), Pressão Arterial (#20), plataforma C5, #15, #23, #24, home/dashboard/Hoje (D4); confirmar itens anotados do backlog (relatórios médicos; dashboard de indicadores) |
| 2 | **[ARCH]** `bmad-create-architecture` (update) | Registry/manifest; token de automação; django-q2; DSL dos Modelos de Relatório (JSON Schema + allowlist + compilação ORM + role read-only + `statement_timeout`); JSONB e aninhamento máx. 1 nível em C6; 3 âncoras temporais do Journalling; espelho do foodLog (fotos: copiar × referenciar); chave IA global criptografada + `ai_available`; índice reverso métrica→modelos; filhas dinâmicas do container na sidebar (mocks nos 3 testes compartilhados); granularidade da flag; schema `BPMeasurement`/`BPSession` com `source` enum desde a 1ª migration |
| 3 | **[CE]** `bmad-create-epics-and-stories` | Decompor ondas (2a, 3, 4, 5, 2b, 6) + épicos novos (Tier 0/plataforma; Épico 10 ampliado; Tier 3) na ordem mestre; embutir as diretrizes da seção 8; **épicos com UI nascem com story x.0 de UX** (diretriz 15); toda story com UI referencia o sistema novo (CAP-3) |
| 4 | **[IR]** `bmad-check-implementation-readiness` | Alinhar PRD/UX/Arquitetura/Épicos antes do sprint |
| 5 | **[SP]** `bmad-sprint-planning` | Inserir stories prontas na ordem mestre |
| pontual | **bmad-ux** | Spec da nova home **antes da Onda 2b** (resolve D4 em detalhe + empty-state/cardápio + valida a sub-condição "≥1 collection"); mockup por onda no início de cada onda (padrão FASE 3) |

**Critérios de sucesso do handoff:** PRD sem requisitos órfãos das decisões deste CC; arquitetura cobre as 12 decisões roteadas; épicos rastreiam cada item da ordem mestre; nenhuma story de UI nasce fora do design system novo sem exceção registrada.

---

## 10. Pendências e riscos residuais

- **Campo "médico prescritor"** em Medicamentos: verificar na Onda 5; se não existir, é requisito novo do módulo (não de Análises).
- **Granularidade da flag de ativação** (espaço × usuário): decidir no desenho do Épico 10; manifest é agnóstico.
- **Itens anotados do backlog** (relatórios médicos; dashboard de indicadores do sistema): confirmar destino no rito [PRD].
- **Sub-condição da Sally sobre o "Hoje"** (≥1 collection): superseded pela definição D4 — validar na spec da home.
- **Preços/políticas de IA e comportamento do iOS**: revalidar na implementação (limitação declarada do [TR]).
- **Widget Scriptable e polimento da PWA**: oportunistas, sem posição fixa na fila.

---

## 11. Status do checklist do CC

| Seção | Status |
|---|---|
| 1. Trigger e contexto | [x] Done — gatilho planejado (gate de convergência), evidências nos 8 documentos de entrada |
| 2. Impacto nos épicos | [x] Done — entregues não reabrem; Épico 10 ampliado; épicos novos roteados ao [CE] |
| 3. Conflitos de artefatos | [x] Done — PRD/epics/migration-plan/sprint-status editados (E1–E6); arquitetura e UX roteadas |
| 4. Caminho adiante | [x] Done — Opção 1 (Ajuste Direto), classificação Major |
| 5. Componentes do proposal | [x] Done — este documento |
| 6. Revisão final e handoff | [x] Aprovação explícita do usuário em 2026-07-22; sprint-status atualizado (E6); handoff na seção 9 |
