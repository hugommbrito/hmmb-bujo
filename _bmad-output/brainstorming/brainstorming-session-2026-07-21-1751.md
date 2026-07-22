---
stepsCompleted: [1, 2, 3, 4]
sessionStatus: complete
inputDocuments:
  - docs/futureIdeas.md
  - _bmad-output/planning-artifacts/plano-de-acao-ui-e-ideias-2026-07-21.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/specs/spec-design-system-migration/SPEC.md
session_topic: 'Triagem e amadurecimento das ideias de docs/futureIdeas.md (24 itens) — Trilha B do plano de ação 2026-07-21'
session_goals: 'Lista madura, categorizada (tipo + horizonte) e priorizada (impacto × esforço), com overlaps/contradições sinalizados e flags de viabilidade [TR], pronta para alimentar o correct-course'
selected_approach: 'Híbrido: draft convergente dos itens óbvios + discussão focada nos polêmicos (com fusões/divisões de itens)'
techniques_used: ['clustering', 'impact-effort-matrix', 'constraint-mapping', 'party-mode-roundtable']
ideas_generated: ['C1-captura-contexto (#2+#4 → superseded por journalling)', 'C2-analytics-ia (#3+#11+#12 → collection Análises + Modelo de Relatório)', 'C3-refino-saude (#16-#19+#22)', 'C4-theming (#6+#21 → migração)', 'C5-mobile (#7+#8)', 'C6-colecoes (#10+#1 → anatomia completa R3)', '#5a-consumir-foodlog (→ collection Alimentação)', '#5b-reimplementar-foodlog', '#15-flag-aguardando-terceiro', '#23-herdar-status', '#24-nome-categorias', '#14-toggle-modulos (→ manifest+cardápio+empty-state R2)', '#13-timer-foco', '#9-historico-restante', '#20-pressao-arterial', 'journalling (nova collection, absorve Gratidão)', 'modelo-de-relatorio (entidade central de Análises)', 'taxonomia-de-collections (4 archetypes)']
context_file: ''
---

# Brainstorming Session Results

**Facilitador:** Claude (rito [BP] da Trilha B)
**Participante:** HugoMMBrito
**Data:** 2026-07-21

## Session Overview

**Tópico:** Triagem das ideias de `docs/futureIdeas.md` (24 itens; numeração #1–#21 herdada do apêndice do plano de ação + #22–#24 novos) para o hmmb-bujo.

**Metas:**
1. Aprofundar/expandir cada ideia (fusões e divisões permitidas)
2. Classificar por tipo (feature nova / refino / plataforma / design system) e horizonte (agora / backlog / descartar / absorvida)
3. Priorizar por impacto × esforço
4. Sinalizar contradições/overlaps com o produto existente e com a migração de design system
5. Marcar itens que exigem `[TR] bmad-technical-research` antes de decisão

**Fora de escopo (papel do correct-course):** decidir escopo final, reescrever requisitos, ordenar sprint.

### Contexto de produto (verificado em epics.md + código)

- Épicos 1–9 e 11 done; Épico 10 (gestão de usuários) backlog. MVP funcional completo.
- Migração de design system: gate da Fundação FECHADO em 2026-07-21; toda UI nova nasce no sistema novo, onda a onda.
- Máquina de estados de Task: 6 estados (`pending/started/completed/cancelled/migrated/postponed`), schema do agregado congelado; migração entrega sucessor como `pending` (Story 4.2/11.6). Não existe estado "waiting".
- Categorias: enum fixo de 6 cores, opcional, sem nome definível pelo usuário (Épico 3 + Story 11.12).
- Métricas de saúde (Épico 7): tipos int/decimal/bool/enum/texto; criar + desativar apenas; `display_order` JÁ EXISTE no schema, mas sem UI de reordenação; sem edição, grupos, percentual ou enum multi.
- Épico 10 (backlog): 10.0 observabilidade, 10.1 convite por email, 10.2 onboarding com espaço isolado. NÃO cobre habilitar/desabilitar módulos.
- Coleções BuJo: inexistentes no produto.
- foodLog: sistema externo; sem nenhuma menção em código; PRD backlog menciona "food log + janela de jejum".
- Analytics hoje: gráfico de evolução por hábito (6.4) + histórico de saúde em 3 visualizações incl. dashboard de período (7.3). UX-DR19 proíbe "sugestões de IA" **como primitivo de interação** (mesma família: migração automática, gamificação); **FR-4.3 (resumo mensal por IA) já é backlog do PRD**.

### Achados novos desta sessão (além dos overlaps já conhecidos)

- **Fronteira DR19 (não é contradição — corrigido pelo usuário em 2026-07-21):** UX-DR19 proíbe "sugestões de IA" como **primitivo de interação** — IA como atalho em fluxos intencionalmente atritosos (mesma lista: migração automática, gamificação). O cluster C2 propõe **análises** com IA sobre dados já preenchidos — leitura, não escrita/sugestão no fluxo de captura. **Compatível com o DR vigente.** Registrar no CC como guardrail de design das stories de C2: *a IA analisa e explica; nunca sugere, preenche ou automatiza captura/migração.*
- **Requisito adiado, não ideia nova:** #2/#3 retomam FR-4.3 (resumo mensal IA) que já está no backlog do PRD.
- **Reordenar métricas (#16) é barato:** `display_order` já existe no schema; falta só UI.
- **Sinergia #14 × Épico 10:** habilitar/desabilitar módulos ganha valor máximo ANTES de convidar usuários externos (10.1/10.2).
- **Possível absorção #1 → #10:** os logs do Canadá podem ser a primeira instância real de "coleções customizadas" — a decidir com o usuário.

## Triagem (em construção — modo híbrido)

_Itens óbvios classificados pelo facilitador; itens polêmicos decididos em conversa._

### Fusões e divisões propostas

| Cluster | Itens fundidos | Racional |
|---------|----------------|----------|
| **C1 — Captura de contexto do dia** | #2 (resumo diário) + #4 (seção de observação) | Ambos são texto livre contextual do dia; mesma entidade/superfície (Hoje). O resumo é narrativo de fim de dia; a observação marca eventos relevantes. Uma feature com dois usos — e é o **pré-requisito de dados** do cluster de IA. |
| **C2 — Analytics com IA** | #3 (análise explicativa) + #11 (aba de análises + dicionário de métricas) + #12 (query salva auto-atualizável) | Mesma cadeia de valor, em 3 fases incrementais: (a) dicionário semântico das métricas do usuário, (b) relatórios sob demanda via dataviz, (c) relatórios periódicos com query persistida [TR]. Retoma FR-4.3 (backlog do PRD). Guardrail DR19: análise, não sugestão. |
| **C3 — Refino de Métricas de Saúde** | #16 (reordenar) + #17 (editar) + #18 (percentual/enum multi) + #22 (grupos) | Todos refinos do Épico 7 na mesma superfície; implementar juntos na onda Saúde da migração. Nota: #16 é barato (`display_order` já existe). #17 exige distinguir edição segura (nome) de edição que quebra histórico (tipo). |
| **C4 — Theming** | #6 (segunda UI) + #21 (outro padrão de cores) | **Absorvidos pela migração de design system.** Não é um segundo sistema: é requisito de theming — a fundação deve usar tokens semânticos que suportem paleta alternativa. Identidade/temas são decisão do bmad-ux (SPEC, Non-goals). |
| **C5 — Plataforma mobile** | #7 (Shortcuts iPhone) + #8 (app/widgets) | Mesma investigação [TR]: (a) Shortcuts chamando a API REST (JWT) diretamente; (b) PWA + deep links de captura; (c) widgets de home screen — exigem app nativo? A resposta técnica ordena as demais. |
| **C6 — Coleções BuJo** | #10 (+ possivelmente #1) | Superfície nova, fiel ao método BuJo. #1 (logs Canadá) pode ser a 1ª coleção real **se** coleções suportarem campos estruturados — ou módulo dedicado. **Decisão com o usuário.** |

### Classificação dos itens não-polêmicos (decisão do facilitador, veto do usuário)

| # | Item | Tipo | Horizonte | Impacto × Esforço | Notas |
|---|------|------|-----------|-------------------|-------|
| #6/#21 | C4 Theming | design system | **absorvida** | — | Ação residual: registrar requisito de theming na fundação (tokens semânticos) |
| #9 | Aba Histórico | navegação | **backlog-baixo** | médio × médio | Parcial na 11.11; a dor central (navegar para trás) já coberta. Reavaliar pós-ondas de migração |
| #13 | Timer de foco | feature nova (config) | **backlog-baixo** | baixo × baixo-médio | Page Visibility API + persistência; meta-métrica de curiosidade |
| #14 | Habilitar/desabilitar módulos | config transversal | **backlog-alto** | alto × médio | **Sinergia com Épico 10**: ancorar como companheiro de 10.1/10.2 (antes de convidar usuários) |
| #16 | Reordenar métricas | refino Épico 7 | **agora** (onda Saúde) | médio × baixo | Quick win: `display_order` já no schema, falta UI |
| #17/#18/#22 | Editar/novos tipos/grupos de métricas | refino Épico 7 | **agora** (onda Saúde) | médio-alto × médio | Enum multi = mudança de modelo (valor→array); editar tipo ameaça histórico imutável — detalhar no CC |
| #20 | Módulo Pressão Arterial (foto+IA) | módulo novo | **backlog + [TR]** | médio-alto × alto | PA exige 2-3 valores/medição e N medições/dia — não cabe no log diário de saúde (1 registro/dia). Módulo próprio; foto+IA é o diferencial [TR] |
| #23 | Task migrada herda status | refino de domínio (Épico 4/11) | **agora** (quick win sem UI) | baixo-médio × baixo | Regra do service, não schema. Escopo real: sucessor herda `started` em vez de resetar p/ `pending` (só pending/started são migráveis) |
| #24 | Nome às categorias | refino (config) | **agora** (onda Config) | médio × baixo-médio | Mapeamento user→label das 6 cores fixas; exibir em selects/tooltips |

### Itens em discussão (polêmicos) — DECIDIDOS na conversa

| Item | Decisão do usuário (2026-07-21) |
|------|--------------------------------|
| **#5 foodLog** | É sistema externo **com API**. Decisão: **consumir via API primeiro** (#5a, backlog-alto); **reimplementar/absorver** fica no backlog distante (#5b, icebox). Cuidados registrados: superfície onde os dados aparecem é decisão do CC (nasce no design system novo); integração resiliente (foodLog offline não trava o bujo). Gancho existente: PRD backlog já menciona "food log + janela de jejum". |
| **#1 Canadá** | **Absorvido por C6** como a 1ª coleção customizada real. Requisito herdado por C6: coleções precisam suportar **listas estruturadas simples** (datas, endereços, empregadores), não só páginas livres. Sem deadline urgente declarado — se um prazo de imigração se materializar, fallback = planilha externa ou fast-track de módulo dedicado. |
| **Estratégia dos grandes investimentos** | **Nenhum lidera agora**: refinos + Épico 10 vêm primeiro. C2/C6/C5 permanecem vivos no backlog, atrás dos refinos, ordenados pelo CC após os [TR]. |
| **#15 Aguardando Terceiro** | **Uso frequente — prioridade alta**, na forma mais barata: **flag/anotação sobre a task** (ex.: `waiting_on` + indicador visual + filtro), **sem tocar a máquina de estados congelada** (Story 3.1). Novo estado formal fica descartado salvo decisão arquitetural contrária no CC. |

---

## LISTA FINAL — Triagem consolidada (entregável para o correct-course)

### Tabela completa por item

| # | Ideia | Cluster | Tipo | Horizonte | Impacto × Esforço | Flags |
|---|-------|---------|------|-----------|-------------------|-------|
| 1 | Logs viagem/moradia/empregos (Canadá) | C6 | superfície nova | **absorvida → C6** | — | requisito de listas estruturadas p/ C6 |
| 2 | Resumo diário | C1 | refino (Hoje, aditivo) | **agora** (onda Hoje) | alto × baixo-médio | pré-requisito de dados de C2 |
| 3 | Análise IA explicando fatos do dia | C2 | feature nova (Analytics) | **backlog** (fase b de C2) | alto × alto | guardrail DR19 (análise ≠ sugestão); retoma FR-4.3 |
| 4 | Observações nos logs diários | C1 | refino (Hoje, aditivo) | **agora** (onda Hoje) | alto × baixo-médio | fundido com #2 |
| 5a | Consumir foodLog via API | — | plataforma (integração) | **backlog-alto** | médio-alto × médio | decisão arquitetural leve no CC; sem [TR] |
| 5b | Reimplementar foodLog no bujo | — | módulo novo | **icebox** | médio × alto | reavaliar após #5a provar valor |
| 6 | Segunda UI moderna | C4 | design system | **absorvida → migração** | — | vira requisito de theming |
| 7 | Shortcuts iPhone | C5 | plataforma | **backlog + [TR]** | alto × ? | viabilidade define esforço |
| 8 | App mobile / widgets | C5 | plataforma | **backlog + [TR]** | alto × ? | widgets provavelmente exigem app nativo |
| 9 | Aba "Histórico" unificada | — | navegação | **backlog-baixo** | médio × médio | parcial na Story 11.11; reavaliar pós-migração |
| 10 | Aba de coleções BuJo | C6 | superfície nova | **backlog** (1º grande investimento sugerido) | alto × alto | absorve #1; caso de uso concreto |
| 11 | Aba análises IA + dicionário de métricas | C2 | feature nova (Analytics) | **backlog** (fase a de C2) | alto × médio | guardrail DR19 (análise ≠ sugestão) |
| 12 | Query salva auto-atualizável por IA | C2 | plataforma (Analytics) | **backlog + [TR]** (fase c de C2) | alto × alto | segurança de query gerada por IA |
| 13 | Timer de foco | — | feature nova (config) | **backlog-baixo** | baixo × baixo-médio | Page Visibility API |
| 14 | Habilitar/desabilitar módulos | — | config transversal | **backlog-alto** | alto × médio | casar com Épico 10 (antes de 10.1); **escopo detalhado na Rodada 2** (manifest → já; cardápio; default all-off; empty state) |
| 15 | "Aguardando Terceiro" | — | refino de tarefa | **agora** (flag, onda Daily) | médio-alto × baixo-médio | flag, NÃO novo estado; schema congelado |
| 16 | Reordenar métricas de saúde | C3 | refino Épico 7 | **agora** (onda Saúde) | médio × baixo | quick win: `display_order` já existe |
| 17 | Editar métricas de saúde | C3 | refino Épico 7 | **agora** (onda Saúde) | médio-alto × médio | distinguir edição segura (nome) × perigosa (tipo) |
| 18 | Percentual + enum multi-seleção | C3 | refino Épico 7 | **agora** (onda Saúde) | médio × médio | enum multi = valor→array |
| 19 | (agrupado com 16–18) | C3 | — | — | — | — |
| 20 | Módulo Pressão Arterial (foto+IA) | — | módulo novo | **backlog + [TR]** | médio-alto × alto | N medições/dia não cabe no log 1×/dia |
| 21 | Outro padrão de cores | C4 | design system | **absorvida → migração** | — | tokens semânticos → paleta trocável |
| 22 | Dividir itens de saúde em grupos | C3 | refino Épico 7 | **agora** (onda Saúde) | médio × médio | nova entidade de agrupamento |
| 23 | Task migrada herda status | — | refino de domínio | **agora** (quick win sem UI) | baixo-médio × baixo | sucessor herda `started`; regra de service, não schema |
| 24 | Nome às categorias | — | refino (config) | **agora** (onda Config) | médio × baixo-médio | label por usuário sobre as 6 cores fixas |

### Priorização em tiers (proposta para o CC ordenar)

- **Tier 0 — Quick win sem UI (não depende de onda de migração):** #23
- **Tier 1 — Refinos embutidos nas ondas de migração:** onda **Saúde** → C3 (#16 primeiro, depois #17/#18/#22); onda **Hoje/Daily** → C1 (#2+#4) e #15-flag; onda **Config** → #24
- **Tier 2 — Plataforma/planejados:** #14 + Épico 10 (companheiros; Story 10.0/AR-22 observabilidade antes, conforme já decidido em 2026-07-16); #5a (consumir foodLog)
- **Tier 3 — Grandes investimentos (pós-[TR], ordem sugerida):** C6 Coleções (caso de uso concreto: #1) → C2 Analytics IA (fases a → b → c) → C5 Mobile (conforme resultado do [TR])
- **Icebox / descartados por ora:** #13 (timer de foco), #9-restante (superfície Histórico unificada), #5b (reimplementar foodLog)
- **Absorvidas:** #6/#21 → requisito de theming da migração; #1 → C6; #9-parcial → Story 11.11

### Contradições e overlaps (consolidado para o CC formalizar)

1. **C4 (#6/#21) × SPEC da migração** — não é segundo design system; vira requisito de theming da fundação (tokens semânticos com paleta trocável). Identidade/temas = decisão bmad-ux (SPEC Non-goals).
2. **C2 (#3/#11/#12) × UX-DR19 — fronteira, NÃO contradição (corrigido pelo usuário):** UX-DR19 (epics.md:177) proíbe "sugestões de IA" como primitivo de interação — IA encurtando fluxos intencionalmente atritosos (mesma lista: migração automática, gamificação). C2 é **análise** de dados já preenchidos, compatível com o DR. O CC deve registrar o guardrail nas stories de C2: *IA analisa e explica; nunca sugere, preenche ou automatiza captura/migração*. Além disso, C2 **retoma FR-4.3** (resumo mensal IA, já backlog do PRD) — é requisito adiado, não ideia nova.
3. **#9 × Story 11.11** — navegação retroativa já entregue; só a superfície unificada dedicada resta (registrada como fora de escopo nas Dev Notes da 11.11).
4. **C3 (#17) × princípio de imutabilidade do Épico 7** — Story 7.1 estabeleceu "desativar, nunca deletar"; editar **tipo** de campo ameaça o histórico. O CC deve separar edição segura (nome/opções novas de enum) de edição destrutiva (tipo/remoção de opções).
5. **#15 × schema congelado (Story 3.1)** — implementar como flag standalone, não como 7º estado; `migrated`/`postponed` são terminais e o enum é parte do agregado congelado.
6. **#23 × regra das Stories 4.2/11.6** — hoje o sucessor nasce `pending` por regra de service; a mudança é pontual e não toca o schema.
7. **#14 × Épico 10** — sinergia (não contradição): habilitar/desabilitar módulos deve estar pronto **antes** de convidar usuários externos (10.1/10.2).
8. **#5 × PRD backlog** — "food log + janela de jejum" já consta no PRD; #5a formaliza o caminho (consumir via API).

### Escopo dos [TR] (bmad-technical-research — janela nova)

1. **C5 (#7/#8) — Mobile/automação:**
   - Shortcuts do iPhone chamando a API REST diretamente: autenticação JWT em Shortcuts (armazenamento do token, refresh, expiração), payloads de captura rápida.
   - Widgets de home screen **sem** app nativo: existe caminho (iOS)? Hipótese: não — confirmar e estimar custo de um app wrapper mínimo (Capacitor/Expo) só para widgets.
   - PWA instalável + deep links / share sheet como alternativa de captura sem app.
2. **#12 (C2 fase c) — Query IA persistida:** segurança (role read-only, sandbox, validação/allowlist de SQL), versionamento das queries salvas, custo de tokens, mecanismo de refresh do gráfico do dashboard. **[ampliado na Rodada 3]** O alvo concreto agora é a entidade **Modelo de Relatório** (ver Mergulho 3): fase c = rodar modelos em agenda. O TR também deve responder o **formato de saída da fase b** (texto vs texto+gráficos gerados pela IA) — decisão deliberadamente amarrada ao TR.
3. **#20 — Pressão arterial foto+IA:** acurácia de vision LLM/OCR lendo display de monitor de PA, custo por leitura, privacidade (dado de saúde), fluxo de confirmação/fallback manual, modelo de dados (N medições/dia com sistólica/diastólica/pulso).
4. **(#5a não precisa de [TR]** — API própria do usuário; só decisão arquitetural leve no CC.)

### Handoff

- **Trilha B do plano de ação:** [BP] concluído nesta sessão; [TR] pendente com escopo definido acima (rodar em janela nova).
- **Gate de convergência:** Trilha A ✅ (Fundação, 2026-07-21) + Trilha B = [BP] ✅ / [TR] ⏳ → após o [TR], rodar **[CC] bmad-correct-course** com este documento + SPEC/plano da migração + PRD/épicos/sprint-status.
- **Não decidido aqui (de propósito):** escopo final das stories, ordem definitiva do sprint, redação formal do guardrail DR19 nas stories de C2, modelo de dados de coleções — tudo papel do CC/PRD/CE.

---

## Rodada 2 — Party mode: visão "Collections" e escopo do #14 (2026-07-21, mesma data)

_Roundtable multi-agente (John/PM, Winston/Arquiteto, Sally/UX, Victor/Estratégia) sobre a proposta do Hugo: reorganizar o produto no conceito BuJo — logs padrão como núcleo fixo, todo o resto como "collections" opcionais ativáveis._

### Visão aprovada (unanimidade dos 4 agentes)

**Modelo mental "núcleo de logs + collections opcionais"** — não é feature nova, é dar nome verdadeiro ao que o produto já é (backend já fatiado em apps por domínio; frontend em features). Fidelidade ao método BuJo como diferencial: o caderno nasce com o esqueleto (logs), cada collection é escolha deliberada do dono. Núcleo **não-gateável por construção**: Future/Monthly/Weekly/Daily, migrações e Brain Dump ficam fora do jogo de ativação.

### Decisões do Hugo nesta rodada

1. **"Marketplace" reescrito como "cardápio"** — Hugo esclareceu: as aspas já subentendiam só um ambiente de escolha de collections. Consenso: página de toggles + empty state; **o job real do "cardápio" é do próprio Hugo** (baixo atrito para ele publicar collections novas) e quem o atende é o manifest, não uma loja. Sem infraestrutura de marketplace.
2. **Dashboard-panorama como home** ("quero ver o panorama completo") — **revoga UX-DR16** (pós-login abre no Daily Log). Exigência da Sally: revogação escrita no decision log, e o card do dia no dashboard deve ser **acionável** (rapid logging direto do card, migrações pendentes visíveis) para não adicionar um clique à ação mais frequente do produto.
3. **BYO API key** — não ganha item próprio; vira **cláusula anexada à primeira feature de IA** ("AC: chave fornecida pelo usuário"; segredo criptografado em repouso, settings por usuário).
4. **"Vamos já"** no manifest (posição do Winston vence o timing da Sally, sob as condições dela — abaixo).
5. **Defaults do convidado novo: todas as collections desligadas** — ambientação com o core primeiro, oferta depois.
6. **"Hoje" = elegância conceitual de baixo custo** (não dor real) — ver divergência em aberto.

### Colisão detectada (pelos 3 agentes, independentemente) e solução convergente

**Decisão 2 × decisão 5:** dashboard-panorama como home + convidado com tudo desligado = **primeiro login numa home vazia** — o momento mais frágil do produto (dia zero do convidado do Épico 10).

**Solução convergente: o empty state do dashboard É o cardápio.** O convidado vê o núcleo (seu dia) + convite para ativar collections ("seu caderno tem espaço para mais: Hábitos, Saúde, Gratidão…"), cada convite ligando ao toggle. Uma superfície, dois jobs: panorama para quem tem tudo ligado, vitrine para quem não tem nada. Resolve de graça o "QUANDO e COMO oferecer" da decisão 5. **Deve estar na spec do dashboard desde o primeiro mockup.**

### #14 — não muda de tier, muda de forma (4 peças nomeadas)

| Peça | O quê | Quando |
|------|-------|--------|
| 1 | **Manifest/registro de collections no frontend** (fatia do Winston, abaixo) | **Já** (refino, pré-onda) |
| 2 | **Página de toggles ("cardápio")** | Épico 10 (ou colado nele) |
| 3 | **Default all-off para convidados** (`defaultEnabled: false` no manifest) | Épico 10 |
| 4 | **Empty state do dashboard como superfície de oferta** (story nova de onboarding; design antes de código — Sally) | Épico 10 |

### Fatia 1 — spec do manifest (Winston)

- **Entra:** um arquivo de registro estático (ex.: `src/app/collections/registry.ts`) com uma entrada por collection (habits, health, medications, gratitude): `id`, nome, ícone, rotas (lazy), entrada de sidebar (label, grupo, ordem). Interface **reserva** campos opcionais `dashboardCard` (estendida/compacta) e `settingsSchema` — nada os consome ainda. Consumidores passam a iterar o registro: Sidebar, BottomNav, router.
- **Fica de fora:** backend, persistência de flags, UI de toggles, dashboard, cards, "Hoje", tela de configurações. Registro estático, tudo "ligado" — não existe estado ainda.
- **Não tocar:** internos dos 4 apps de feature; núcleo dos logs (hardcoded como core); agregado Task congelado.
- **Critério de aceite:** app renderiza **pixel-idêntico** antes/depois; se snapshot/E2E mudar, a fatia vazou escopo.
- **Guardrail de teste (lição conhecida do projeto):** registro = **dados puros** — sem hooks/TanStack Query — para não exigir mocks novos nos 3 testes compartilhados de AppLayout/router/RouteAnnouncer.
- **Definition of done estrutural:** collection nova = criar pasta da feature + **UMA** entrada no registro (sem editar sidebar/router/testes de navegação). É isso que atende o "cardápio sem atrito" do Hugo.

### Condições da Sally para o "vamos já" não invalidar mockups

- **(a)** Extração é contrato puro — nenhuma mudança visual/navegação pega carona; telas mantêm empregos atuais durante as ondas.
- **(b)** A onda Daily Log/Dashboard/Hoje vai para o **fim da fila**; o mockup dela só nasce após a spec da nova home (com as resoluções da colisão) aprovada.
- **(c)** Todo mockup daqui em diante inclui o estado **"collection desligada/ausente"** (sidebar em particular).

### Ressalva viva (input formal para o desenho do Épico 10)

**Granularidade da flag: por espaço × por usuário.** A decisão 5 descreve preferência *por usuário*; enquanto cada convidado tiver espaço isolado, as duas coincidem — divergem no dia em que um espaço for compartilhado. Decisão pertence ao desenho do Épico 10; o manifest é agnóstico a ela (por isso a fatia 1 é segura).

### Divergência em aberto — destino do "Hoje" (decisão do Hugo pendente)

- **John:** corta do escopo atual; backlog-baixo; só volta se, usando dashboard-as-home por semanas, virar **dor real**; reavaliar pós-migração do dashboard.
- **Sally:** aceita condicionado a empregos crisp — **Hoje = trabalhar** (tarefas, eventos, migrações, rapid logging) / **Dashboard = ver** (núcleo + cards); e Hoje só existe com ≥1 collection ativa (senão é página duplicada).
- **Winston:** se existir, é **um componente com dois presets de filtro** sobre a mesma lista de cards — duas rotas, uma implementação ("duas páginas irmãs divergem em três meses").

### Sem mudança

- **C6 (coleções customizadas):** segue Tier 3; o manifest constrói a porta pela qual C6 entrará, sem adiantar seu relógio.
- **Decisão estratégica da triagem** (refinos + Épico 10 antes de grandes investimentos): reafirmada.

### Deltas para o correct-course (consolidado da Rodada 2)

1. Fatia 1 (manifest) pode entrar como refino imediato — junto de #23 no Tier 0 (sem UI visível; aceite = pixel-idêntico).
2. Escopo do #14 no Épico 10 ganha as peças 2–4 + a story do empty state.
3. Revogação formal do UX-DR16 (home = dashboard) a registrar quando a spec da nova home for escrita — com a exigência de captura a um toque preservada.
4. "Hoje": registrar como backlog-baixo condicionado (posições dos 3 agentes acima; decisão final do Hugo pendente).
5. BYO key: cláusula da 1ª feature de IA (provável C2 fase a/b).

---

## Rodada 3 — Brainstorming generativo: as ideias sob a lente "Collections" (2026-07-21)

_Objetivo: reclassificar as ideias triadas em (a) refinos do core, (b) refinos de collections existentes, (c) collections novas; depois aprofundar o funcionamento de cada collection._

### Remapeamento (draft do facilitador — em discussão)

**CORE (logs + Brain Dump — não-gateável) · refinos:**
| Item | Nota |
|------|------|
| #23 herda status na migração | Tier 0, sem UI |
| #15 flag "Aguardando Terceiro" | sobre Task, onda Daily |
| #24 nome às categorias | config do core |
| #9 Histórico unificado | backlog-baixo |
| C1 (#2+#4) resumo/observações do dia | ❓ **core aditivo OU collection própria?** — em discussão |

**Collections EXISTENTES · refinos:**
| Item | Collection |
|------|-----------|
| C3 (#16/#17/#18/#22) | Saúde-Métricas |
| ❓ Saúde × Medicamentos | **uma collection ou duas?** — em discussão |

**Collections NOVAS (coded — desenvolvidas pelo Hugo):**
| Item | Collection candidata | Observação estrutural |
|------|---------------------|----------------------|
| C2 (#3/#11/#12) | "Análises" | ❓ vira collection? BYO key seria `settingsSchema` DELA; **depende de dados de outras collections** (archetype novo: collection dependente) |
| #20 Pressão Arterial | "Pressão Arterial" | [TR] pendente; dados próprios |
| #5a foodLog | "Alimentação" | **archetype novo: collection de integração** (fonte externa, precisa estado offline) |

**Collections CUSTOM (criadas pelo usuário — espécie diferente):**
| Item | Nota |
|------|------|
| C6 framework de coleções customizadas | vive no BANCO (dados), não no manifest (código) — arquitetura distinta das coded |
| #1 logs do Canadá | 1ª instância custom |

**Não-collections (plataforma / design system / config):**
C5 mobile (#7/#8) · C4 theming (#6/#21) · #13 timer (icebox) · #14 (virou a própria infraestrutura de collections) · #5b (icebox)

### Insights estruturais da lente

1. **Existem DUAS espécies de collection** — *coded* (entrada no manifest, código do Hugo: Hábitos, Saúde, Análises…) e *custom* (linhas no banco, criadas pelo usuário via C6). O manifest da Rodada 2 cobre só as coded; nomear a distinção agora evita o CC confundir os dois investimentos.
2. **Collections têm archetypes de dados diferentes:** dados próprios (Hábitos, Pressão) · integração externa (Alimentação/foodLog) · derivada/dependente (Análises, que lê as outras). A dependente levanta uma questão de design: o que Análises mostra quando uma collection-fonte está desligada?
3. **BYO key deixa de ser setting global** — vira configuração da collection Análises (o `settingsSchema` reservado no manifest já comporta isso). **[REVISTO na Rodada 4: volta a ser global — múltiplas collections consomem IA.]**

### Decisões do usuário na Rodada 3

1. **Saúde e Medicamentos = DUAS collections + grupo visual "Saúde"** na sidebar (ativação granular; agrupamento é apresentação — campo `grupo` do manifest já suporta).
2. **Análises (C2) = collection coded**, com BYO key como configuração dela (`settingsSchema`). Requisito herdado: definir comportamento quando collection-fonte está desligada. **[BYO key revisto na Rodada 4 → config global de IA.]**
3. **C1 SUPERSEDED → collection "Journalling"** (ideia nova do Hugo, substitui a discussão core-vs-collection): collection onde o usuário define **campos de relato** (ex.: "Gratidões", "Fatos relevantes"). Por campo: toggle **"usar conteúdo como contexto de IA?"** (consentimento por campo — alimenta Análises respeitando o guardrail DR19) e toggle **"gravar horário do registro?"**.
   - **Consequência nomeada:** Journalling **absorve a Gratidão** (Épico 9, entregue) como instância de campo — exige decisão de sequência no CC (migração de dados é simples; o custo é retrabalho de superfície).
   - **Eco estrutural:** segunda collection do tipo "coded com campos user-defined" — o padrão já existe em Saúde-Métricas (Épico 7). Taxonomia: coded fixa (Medicamentos) · coded com campos user-defined (Saúde-Métricas, Journalling) · custom (C6).
   - **Sugestões do facilitador em avaliação:** cadência por campo (diário/semanal/livre) · prompt/placeholder por campo · múltiplas entradas/dia vs única · visibilidade no Hoje (card/link contextual como a Gratidão faz hoje vs só na superfície própria).
4. **Primeiro mergulho: Custom collections (C6 + Canadá)** — em andamento abaixo.

### Mergulho 1 — Custom collections (C6 + logs do Canadá)

_Anatomia a definir: o que É uma collection custom, o que o Canadá exige dela, onde ela para e uma coded começa._

**Requisitos concretos extraídos do caso Canadá (#1):** três logs estruturados — viagens (datas, destinos), moradias (endereços, períodos), empregos (empregador, cargo, período). Todos são **listas estruturadas com colunas tipadas**, não páginas de texto livre.

**Rima arquitetural em avaliação:** o sistema de tipos do Épico 7 (`field_type`: int/decimal/bool/enum/texto — que C3/#18 já quer estender com percentual e enum-multi) poderia ser o MESMO sistema de tipos das colunas de uma custom collection — um investimento em C3 valorizaria C6 e vice-versa.

**Decisões do Hugo — anatomia do C6:**

1. **Forma MVP: logs tipados com campos configuráveis pelo usuário** — cada custom collection é uma lista de registros com campos definidos pelo dono. Ex. (Log de Viagem): data início, data fim, destino, **hospedagem = campo-array de sub-registros** (cada um com datas, endereço, hotel...).
   - ⚠️ **Flag de complexidade (facilitador):** campos-array de sub-registros movem o modelo de "tabela plana" para "documento com sub-listas" — sobe custo de UI de edição, modelo de dados e exibição. Proposta de fronteira para a arquitetura: **máx. 1 nível de aninhamento** (sub-registro não aninha). Rima interna: tarefas→subtarefas já existem no produto. Candidato natural de persistência: schema por collection + registros JSONB (decisão do architect).
2. **Sistema de tipos: INDEPENDENTE do Épico 7** — decisão contrária à recomendação do facilitador, registrada: Saúde-Métricas e C6 evoluem com vocabulários de tipos próprios, sem acoplamento entre domínios.
3. **Cidadania no ecossistema (card no dashboard, toggle contexto-IA, cardápio): decidir POR FEATURE no CC** — nem plena desde o MVP, nem negada; cada capacidade é uma decisão de story.
4. **Journalling nasce absorvendo a Gratidão** — campo "Gratidões" seed + migração das entradas existentes; superfície Gratidão aposentada na mesma onda (sem período de duas verdades).

**Decisões finais do Mergulho 1:**

5. **Navegação: sidebar, grupo "Custom Collections"** — cada custom collection ativa é entrada da sidebar, paridade com as coded. **[Complementado na Rodada 4: o grupo É a collection-container coded; filhas são dinâmicas.]**
6. **Edição de schema com registros existentes: segura livre / destrutiva bloqueada** — renomear/adicionar campo e opção de enum: livre; mudar tipo/remover campo: só desativação (histórico preservado). Mesma filosofia do Épico 7 / distinção do #17.
7. **Export: FORA do MVP** (decisão contrária à recomendação do facilitador, registrada) — dados ficam no app; export vira fase 2 se a dor aparecer. Nota honesta: o job do caso motor (preencher formulário de imigração) termina com transcrição manual.
8. **Templates seed: NÃO** — sem infraestrutura de presets; o empty state mostra exemplos ilustrativos e o usuário monta o schema manualmente.

**📦 Anatomia consolidada do C6 (entregável do Mergulho 1):**

> Uma **custom collection** é uma lista de registros com **schema definido pelo usuário** (campos tipados, incl. campo-array de sub-registros com máx. 1 nível — flag p/ arquitetura), com sistema de tipos **próprio** (independente do Épico 7). Vive na **sidebar, grupo "Custom Collections"**. Schema editável sob regra **segura/destrutiva**. Nasce **vazia com exemplos no empty state** (sem presets). **Sem export no MVP.** Cidadania no ecossistema (card no dashboard, contexto-IA, cardápio) decidida **por feature no CC**. Caso motor: logs do Canadá (Viagens, Moradias, Empregos — #1).

### Mergulho 2 — Journalling

_A entidade central é o **campo de journalling**, configurável pelo dono: {nome, + decisões abaixo}. Toggles já decididos pelo Hugo: **"usar como contexto de IA?"** (consentimento por campo → Análises) e **"gravar horário do registro?"**. Premissa herdada (default do facilitador, veto do usuário): ciclo de vida dos campos segue a filosofia do Épico 7 — **desativar, nunca deletar**; renomear é edição segura._

**Decisões do Mergulho 2:**

1. **Cadência CONFIGURÁVEL por campo já no MVP** (diário/semanal/livre) — decisão contrária à recomendação do facilitador (que sugeria só-diário no MVP), registrada. **Consequências nomeadas para o CC/arquitetura:**
   - Três âncoras temporais no modelo de entrada (data / semana / timestamp) — decisão de schema.
   - Campos semanais e livres precisam de casa na navegação e no histórico (o shape do 9.2 é por data/mês — funciona para diário; semanal/livre exigem visualização própria).
   - Interação com o card no Hoje (decisão 4 abaixo): o que o card mostra para campos não-diários — questão de design para a onda.
2. **Prompt: nome + prompt opcional por campo** (prompt = placeholder do editor).
3. **Entradas/dia: configurável por campo** (toggle "múltiplas entradas?") — Gratidões = múltiplas (fidelidade à migração do Épico 9); Resumo do dia = única editável.
4. **Visibilidade no Hoje: card único da collection** agregando os campos ativos (não toggle por campo).

**📦 Anatomia consolidada do Journalling (entregável do Mergulho 2):**

> **Campo de journalling** = `{nome, prompt?, cadência: diário|semanal|livre, múltiplas_entradas: bool, contexto_ia: bool, gravar_horário: bool, ativo: bool}`. Ciclo de vida: desativar, nunca deletar; renomear é seguro (filosofia Épico 7). A collection aparece no **Hoje como card único** com os campos ativos. **Nasce absorvendo a Gratidão**: campo seed "Gratidões" = {diário, múltiplas entradas, migração das entradas do Épico 9}. Default do facilitador (veto do usuário): **`contexto_ia` nasce OFF** em todo campo — consentimento de IA é sempre opt-in explícito, coerente com o guardrail DR19.

### Mergulho 3 — Análises (C2, fases a/b; fase c aguarda [TR])

_Âncoras herdadas: collection coded · BYO key no `settingsSchema` · guardrail DR19 (analisa/explica, nunca sugere/automatiza captura) · retoma FR-4.3 · lê Journalling só via campos com `contexto_ia: on`._

**Defaults do facilitador (veto do usuário):**
- **Fronteira de privacidade:** o que sai para a API de IA = métricas dos módulos + campos de journalling com `contexto_ia: on`. Nada além.
- **Geração sempre por ação explícita** (botão "gerar") — nada roda em background até a fase c existir e passar pelo [TR].
- **FR-4.3 (resumo mensal) vira relatório pré-modelado da fase b** — o requisito adiado do PRD encontra sua casa aqui.

**Decisões do Mergulho 3 (1ª leva):**

1. **A entidade central é o MODELO DE RELATÓRIO** (reestruturação do Hugo sobre o draft do facilitador — o "dicionário global" morre; anotações e conceitos vivem no contexto do modelo). Cada modelo contém:
   - **Métricas selecionadas** de outras collections (as fontes daquele relatório);
   - **Filtros sobre as métricas** (range de datas, condições de campo — ex.: "só remédios prescritos pelo médico X", "só dias com atividade física preenchida");
   - **Anotações por métrica + conceitos** (a semântica que a IA recebe);
   - **Prompt de expectativa** (o que o usuário espera deste relatório).
2. **Mecanismo de ancoragem por exemplar:** o usuário itera; quando um resultado é satisfatório, **"adota" aquele relatório como padrão do modelo** — o exemplar adotado é enviado como contexto em toda solicitação futura do mesmo modelo (consistência de formato sem engenharia pesada). Substitui o conceito de "relatórios pré-modelados de fábrica".
3. **Relatórios salvos com histórico** na superfície da collection (data, período, modelo).
4. **Collection-fonte desligada = fora de novos relatórios** (métricas ocultas do modelo, não deletadas; relatórios antigos intactos).

**⚠️ Flags do facilitador:**
- O filtro-exemplo "médico prescritor" pressupõe campo que pode não existir em Medicamentos (verificar na onda; se não existir, é requisito novo do módulo, não de Análises).
- A entidade Modelo de Relatório é exatamente o objeto que a fase c ([TR] #12) rodaria em agenda — o TR ganha um alvo concreto.
- Exemplar adotado como contexto = custo extra de tokens por geração (aceitável: BYO key, quem usa paga).

**Decisões do Mergulho 3 (2ª leva):**

5. **Anotação por métrica: global com override local** — a anotação global descreve a métrica; cada modelo a herda e pode usá-la intacta ou substituí-la localmente para aquele relatório.
6. **FR-4.3: REESCREVER no CC** — o requisito mudou de natureza (feature fixa "resumo mensal" → capacidade de o usuário compor seus próprios modelos de relatório). O CC deve reformular o texto do FR no PRD.
7. **Filtros MVP: range de datas + condições simples** (igualdade/existência sobre campos que já existem); operadores compostos ficam para fase 2.
8. **Formato da saída: decidir no [TR]** — o TR de #12 passa a cobrir também o formato de saída da fase b (texto vs texto+gráficos gerados).

**📦 Anatomia consolidada de Análises (entregável do Mergulho 3):**

> Collection coded (BYO key: **revisto na Rodada 4 → config global de IA**). Entidade central: **Modelo de Relatório** = `{nome, métricas selecionadas (cross-collection), filtros (range de datas + condições simples), anotações herdadas (global c/ override local), conceitos, prompt de expectativa, exemplar adotado?, histórico de gerações}`. **Ancoragem por exemplar**: resultado satisfatório "adotado" vira contexto das gerações futuras do mesmo modelo. Relatórios **salvos com histórico**. Fonte desligada = **fora de novos relatórios** (antigos intactos). Fronteira de privacidade: só métricas selecionadas + campos de journalling com `contexto_ia: on`. Geração **sempre por ação explícita** (fase c = [TR]). Guardrail DR19 permanece: analisa e explica, nunca sugere/automatiza captura. FR-4.3 reescrito no CC como capacidade.

### Mergulho 4 — Alimentação (integração foodLog, #5a)

_Define o **archetype de integração** (collection cuja fonte de dados é externa) — padrão herdável por futuras integrações._

**Defaults do facilitador (veto do usuário):**
- **Credenciais/URL da API do foodLog vivem no `settingsSchema` da collection** — mesma rima do BYO key em Análises: configuração sensível é da collection, não global.
- **foodLog indisponível NUNCA quebra o bujo** — a superfície degrada com indicador de "última sincronização" (requisito da Rodada 1 formalizado).

**Decisões do Mergulho 4:**

1. **Exibição: resumo diário + janela de jejum + FOTOS das refeições.** Espelho completo navegável/editável → **backlog distante, junto com #5b** (incorporação do foodLog como desenvolvimento interno).
2. **Sync: espelho local sincronizado** (Análises filtra/agrega localmente; resiliência de graça).
3. **Direção: somente leitura** (registrar refeição continua no foodLog).
4. **Fonte de primeira classe em Análises desde o MVP** — métricas de alimentação entram no seletor de fontes dos Modelos de Relatório (correlação comida × saúde × hábitos é o motivo da integração).

**⚠️ Flags do facilitador:**
- **Fotos:** espelhar binários custa storage; referenciar URLs do foodLog degrada quando ele cai (dados aparecem, fotos não). Decisão do architect; degradação parcial é aceitável.
- **Fotos ≠ contexto de IA:** a fronteira de privacidade de Análises envia métricas, não imagens — fotos são exibição.

**📦 Anatomia consolidada da Alimentação (entregável do Mergulho 4):**

> Collection coded de **archetype integração**: consome o foodLog (API externa) em **somente leitura**, via **espelho local sincronizado**. Superfície: **resumo diário** (refeições + horários + fotos) e **janela de jejum**. Credenciais no `settingsSchema` da collection. foodLog fora do ar **nunca quebra o bujo** (última sincronização indicada; fotos podem degradar). Métricas de alimentação são **fontes de primeira classe** nos Modelos de Relatório de Análises. Espelho completo/edição e absorção do foodLog (#5b): backlog distante.

---

## Síntese da Rodada 3 — deltas consolidados para o correct-course

**A) Taxonomia de collections (vocabulário novo do produto):**
1. **Coded fixa** (Medicamentos) · 2. **Coded com campos user-defined** (Saúde-Métricas, Journalling) · 3. **Custom** (C6 — schema no banco, criada pelo usuário) · 4. **Coded de integração** (Alimentação — fonte externa, espelho local). Coded vivem no manifest (Rodada 2); custom vivem **como conteúdo de uma collection coded container ("Custom Collections") — padrão container definido na Rodada 4**.

**B) Collections definidas nesta rodada (anatomias completas nos Mergulhos 1–4):**
- **Custom Collections (C6)** — logs tipados com schema do usuário; caso motor Canadá (#1).
- **Journalling** — campos de relato configuráveis; **ABSORVE a Gratidão (Épico 9, entregue)** com migração de dados e aposentadoria da superfície — retrabalho de épico entregue, sequência a decidir no CC.
- **Análises** — Modelo de Relatório + ancoragem por exemplar; fases a/b definidas, fase c no [TR].
- **Alimentação** — integração read-only do foodLog com espelho local.
- **Saúde e Medicamentos** — confirmadas como DUAS collections + grupo visual "Saúde".

**C) Requisitos existentes que o CC deve reescrever/revogar formalmente:**
1. **FR-4.3** — de "resumo mensal por IA" (feature fixa) para capacidade de compor Modelos de Relatório.
2. **UX-DR16** — home passa de Daily Log para Dashboard (decisão da Rodada 2; captura a um toque preservada como exigência).
3. **Triagem da Rodada 1 superseded em C1**: #2/#4 deixam de ser "refino da onda Hoje" e passam a integrar a collection Journalling (horizonte muda: acompanha a onda da Journalling, não a onda Hoje).

**D) Trabalho roteado para outros ritos:**
- **[TR] #12 ampliado**: alvo = Modelo de Relatório; inclui formato de saída da fase b.
- **Arquitetura**: aninhamento 1-nível em C6 (JSONB?); 3 âncoras temporais do Journalling; espelho do foodLog (fotos: copiar × referenciar); granularidade da flag de ativação (espaço × usuário — já era input do Épico 10); **[R4]** chave de IA global criptografada + capability derivada `ai_available`; **[R4]** índice reverso métrica→modelos (badge de transparência) como serviço compartilhado com degradação graciosa; **[R4]** filhas dinâmicas do container Custom Collections na sidebar (server state → mocks nos 3 testes compartilhados quando C6 chegar).
- **Medicamentos**: verificar existência do campo "médico prescritor" (filtro-exemplo de Análises); se não existir, é requisito novo do módulo.

**E) Decisões do usuário CONTRA recomendação do facilitador (registradas para o CC não "corrigir" por engano):**
- C6 com sistema de tipos independente do Épico 7 · C6 sem export no MVP · Journalling com cadência configurável já no MVP.

**F) Pendências que sobreviveram à sessão:**
- Destino do "Hoje" (Rodada 2 — três posições registradas, decisão do Hugo em aberto).
- Pressão Arterial (#20) — aguarda [TR].
- Defaults de `contexto_ia: off` e demais defaults do facilitador — válidos até veto.

**Ordem sugerida de dependências (não é decisão de sprint):** manifest (Tier 0) → refinos + Épico 10/#14 → Journalling (destrava contexto de IA) e Alimentação (destrava fonte em Análises) podem preceder Análises; C6 é independente; fase c de Análises só pós-[TR].

---

## Rodada 4 — Alinhamentos pós-entrega (2026-07-22)

_Três revisões propostas pelo Hugo sobre o documento entregue; analisadas e aceitas com flags._

### Revisão 1 — BYO key: de `settingsSchema` de Análises → **config GLOBAL de IA**

**Decisão:** a chave de API de IA vive na configuração global. Todo elemento de UI que depende de IA carrega uma **tag "IA"** e fica **inativo (não oculto) quando não há key configurada**.

**Racional aceito:** múltiplas collections consomem IA (Análises, Pressão Arterial foto+IA futura, campos de journalling com `contexto_ia`) — a chave é credencial do usuário, não config de collection. Bônus de descoberta: o usuário vê o que a IA destravaria.

**Condições de design (facilitador):**
- Elemento inativo **explica o porquê** e linka para a config (nada de disabled misterioso).
- Tag "IA" = **ícone + texto**, nunca só cor (UX-DR20).
- Deriva a capability `ai_available` (= key configurada) como estado transversal.
- **Escopo:** só a chave de IA é global. Credenciais de integração (foodLog) permanecem no `settingsSchema` da collection respectiva — são configs de natureza diferente.
- Supersede: insight 3 da Rodada 3 e trechos correspondentes das anatomias (marcados inline). Mantém-se: "cláusula da 1ª feature de IA" (Rodada 2) — a config global nasce com a primeira feature que a consome.

### Revisão 2 — Transparência no ponto de captura: marcador em campo consumido por IA

**Decisão:** quando uma métrica/campo é selecionado em algum Modelo de Relatório de Análises, o campo ganha **destaque visual no formulário nativo da collection de origem** — o usuário sabe, no ato do preenchimento, que aquele dado pode ser processado por IA.

**Correção obrigatória (facilitador):** cor **não pode ser o único indicador** (UX-DR20/WCAG, baseline do próprio produto) → cor + ícone/chip com label acessível.

**Distinção semântica nomeada (para a UX da onda):** o produto passa a ter DOIS sinais de IA que não podem compartilhar o mesmo visual:
- **Tag "função de IA"** (Revisão 1): *esta funcionalidade usa IA; precisa de key.*
- **Badge "dado lido por IA"** (esta revisão): *este dado está selecionado em ≥1 Modelo de Relatório.*

**Notas de implementação:** índice reverso (métrica → modelos que a usam) como serviço compartilhado; **degradação graciosa** (Análises desligada/erro = sem badge, formulário intacto). Coerência de consentimento: Journalling = opt-in explícito por campo (`contexto_ia`); métricas = seleção no modelo é o consentimento, badge é a transparência. Nota para o Épico 10: em espaço multi-usuário futuro, quem seleciona é o dono do espaço — revisitar se espaços compartilhados existirem.

### Revisão 3 — C6 vira **collection coded container "Custom Collections"**

**Decisão:** em vez de espécie separada "vivendo só no banco", o framework C6 é **uma collection coded** com entrada estática no manifest ("Custom Collections"), ativável/desativável como qualquer outra. Ativada, suas tabelas no banco são populadas com as custom collections que o usuário criar e suas configurações.

**Ganhos aceitos:** manifest permanece estático (uma entrada, não N dinâmicas) · toggle único liga/desliga a espécie inteira · cardápio lista só coded (incl. o container) · default all-off do convidado já cobre custom · desativar preserva dados (filosofia da casa).

**⚠️ Flag técnico (facilitador):** as **filhas do grupo na sidebar são dinâmicas** (vêm do banco) — tensão com o guardrail "manifest = dados puros" da fatia 1 (Rodada 2). A fatia 1 permanece segura (o container ainda não existe nela); quando C6 for implementado, Sidebar/BottomNav ganham server state para esse grupo → **mocks novos nos 3 testes compartilhados** (AppLayout/router/RouteAnnouncer — lição conhecida do projeto). Registrar na story de C6.

**Taxonomia revista:** os 4 archetypes de DADOS permanecem; na IMPLEMENTAÇÃO, "custom" deixa de ser espécie paralela e vira **conteúdo do container coded** — unificação registrada na síntese (item A).
