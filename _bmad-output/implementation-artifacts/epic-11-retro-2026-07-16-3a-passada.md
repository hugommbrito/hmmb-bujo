# Retrospectiva — Epic 11: Refinamento do Planner & Recorrentes (3ª passada — 3º lote, Story 11.12) — ENCERRAMENTO DO ÉPICO

**Data:** 2026-07-16
**Modo:** #YOLO (autônomo — sem interação síncrona com Hugo; decisões sintetizadas a partir de sprint-status, do arquivo da Story 11.12, das duas retrospectivas anteriores do próprio Epic 11 (1ª e 2ª passada), de `epics.md`, `docs/futureIdeas.md`, do log do orquestrador (`orchestration-11-20260716-015115.md`) e de verificação direta do código/git — incluindo reexecução real da suíte frontend)
**Facilitação:** Amelia (Dev)
**Participantes convocados:** Amelia (Dev, facilitação), Winston (Arquiteto), John (PM), Dana (QA)

> Nota de transparência: rodada em modo autônomo por solicitação explícita — nenhuma fala abaixo deve ser lida como citação literal de Hugo. É síntese data-driven da única story do 3º lote (11.12), das duas retrospectivas anteriores do próprio Epic 11 (`epic-11-retro-2026-07-15.md`, 1ª passada, 11.1–11.6; `epic-11-retro-2026-07-16.md`, 2ª passada, 11.7–11.11), do log do orquestrador e de verificação independente: reexecução real de `npx vitest run --no-file-parallelism` (Node 22.15.1) contra o HEAD atual (`7972dc3`), confirmando **551 passed (45 arquivos)**.

---

## 1. Resumo do Épico

### 3º lote (esta retro)

| Métrica | Valor |
|---|---|
| Stories completas | 1/1 (100%) — 11.12 |
| Testes backend (baseline pós-11.11: 368) | **377** (+9) — reportado pelo dev e reconfirmado de forma independente pelo Senior Developer Review (mesmo número, duas execuções distintas); **não re-executado nesta retro** (custo de cold-start da branch Neon já registrado como caro nas duas retros anteriores) — aceito por dupla confirmação independente já existente |
| Testes frontend (baseline real pós-11.11, ver achado abaixo) | **551** (45 arquivos) — **reconfirmado nesta retro por reexecução real**, Node 22.15.1, batendo exatamente com dev e review |
| Achados de code review | 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW — único lote do épico com zero achados de qualquer severidade |
| Contrato de API | **Única story do 2º+3º lote a mudar contrato**: `schema.yaml` (raiz) e `frontend/src/api/types.gen.ts` regenerados — `category` adicionado a `RecurringTaskTemplate`/`RecurringTaskTemplateCreate`/`PatchedRecurringTaskTemplateUpdate`, mesmo shape que `eisenhower` já tinha |
| Migração de banco | 1 nova (`0005_recurringtasktemplate_category.py`), `AddField` isolado, sem backfill — mesma forma do precedente direto `0002_task_category.py` |
| Questão em aberto fechada | A questão registrada na Story 11.8 (AC4: "categoria deveria virar campo do template?") foi fechada — Hugo decidiu que sim, via Correct Course 2026-07-16, e a Story 11.12 é exatamente o escopo que a própria 11.8 já havia esboçado (campo + migração + serializers + contrato + CRUD + placement) |

**Escopo entregue:** `RecurringTaskTemplate` ganha campo `category` opcional (reusa `Task.Category`, sem enum novo); os 3 serializers de template passam a incluí-lo; `place_template` copia a categoria do template para a `Task` gerada (mesmo padrão de `title`/`description`/`eisenhower`); o CRUD de templates (`RecurringTemplateManager`) ganha seletor de categoria, incluindo exibição na listagem (`TemplateRow`) por leitura literal da AC3; o modal de placement (`RecurringPlacementDialog`) **e** a lista de sugestões (`RecurringPlacementSection`) passam a exibir a categoria do template — fechando definitivamente a AC4 da Story 11.8.

### Épico completo (3 lotes, 12/12 stories)

| Lote | Stories | Origem |
|---|---|---|
| 1º | 11.1–11.6 | Backlog original do épico (`docs/futureIdeas.md`, itens #1–#9) |
| 2º | 11.7–11.11 | Correct Course 2026-07-15 (bugs/melhorias pós-1º lote) |
| 3º | 11.12 | Correct Course 2026-07-16 (questão aberta da 11.8) |

O épico está **integralmente concluído**: 12/12 stories `done`, 3 retrospectivas realizadas (uma por lote, todas no mesmo dia de fechamento de cada lote), zero bloqueio técnico remanescente. `epic-11` e `epic-11-retrospective` atualizados para `done` em `sprint-status.yaml` como parte desta sessão.

---

## 2. O que foi bem

- **Zero achados de qualquer severidade em code review — o único lote do épico a conseguir isso.** A Story 11.12 seguiu o padrão `eisenhower` ponto a ponto (modelo → migração → serializers → placement → contrato → CRUD → UI de placement), exatamente como as próprias Dev Notes prescreviam. O Senior Developer Review confirmou cada AC lendo o código real (não as Completion Notes) e não encontrou nenhuma divergência. É a evidência mais forte até agora de que copiar um precedente estrutural já validado (em vez de desenhar uma abordagem nova) reduz risco de forma mensurável.
- **A única mudança de contrato do 2º+3º lote foi tratada com o cuidado inverso do padrão recém-estabelecido — e funcionou.** Todo o 2º lote treinou a disciplina de "não tocar `schema.yaml`/`types.gen.ts`"; a Story 11.12 inverteu essa expectativa de propósito (é a exceção documentada) e o dev seguiu a Task 6 à risca, conferindo por `git diff` que os dois artefatos gerados mudaram no formato esperado antes de fechar a story. Nenhum drift entre schema e tipos, gate de CI (`ci.yml:76-82`) preservado.
- **Uma decisão de escopo ambígua (AC3 "persistida e exibida na listagem") foi resolvida com o mesmo padrão institucionalizado desde a retro do Epic 4 (#3): favorecer a leitura mais literal + documentar o raciocínio inline.** O dev decidiu adicionar a categoria também em `TemplateRow` (não só no formulário de criação) e registrou essa decisão explicitamente nas Completion Notes e no Change Log — quarta ou quinta aplicação bem-sucedida do mesmo padrão ao longo do épico, sem nenhuma reversão até agora.
- **A pergunta "existe um segundo fluxo de criação de Task a partir de template que eu preciso atualizar?" foi respondida por busca exaustiva, não por suposição** (Dev Notes: "confirmado por busca exaustiva — sem Celery, sem cron, sem management command tocando `RecurringTaskTemplate`... o único ponto é `place_template`"). Mesmo padrão de rigor que encontrou os 3 bugs reais do 2º lote, aplicado aqui numa story sem bug para encontrar — o hábito generalizou além do caso que o originou.

## 3. Onde a equipe tropeçou (sistemas e processos, sem culpar indivíduos)

- **Achado novo desta retro, via cross-referência entre documentos: a seção "Previous Story Intelligence" da própria Story 11.12 registrou um baseline de testes frontend (538) que diverge do baseline que a retrospectiva do 2º lote havia acabado de reconfirmar por reexecução real (542) — uma diferença de 4 testes, ambos alegando ser o estado pós-11.11.** A aritmética final bate com **538 + 13 = 551** (o número que a reexecução desta retro confirma como real), não com 542 + 13 = 555. Ou seja: o baseline "542" citado pela retro do 2º lote (também obtido por reexecução real, não por suposição) e o baseline "538" citado pela própria story 11.12 não podem estar ambos certos para o mesmo commit — e a evidência empírica (551 confirmado + a contagem de 13 testes novos que o dev efetivamente escreveu) aponta para 538 como o valor correto, sugerindo que a citação de "542" carregou algum artefato de contagem transitório (possivelmente um estado intermediário entre a correção de review da 11.11 e o commit final `cc53a83`). **Não é um bug funcional** — nenhuma story ficou com contagem incorreta em suas próprias Completion Notes — mas é exatamente a classe de risco que o guardrail "sempre rode o comando real, nunca escreva de memória" (retro Epic 3 §1) foi criado para prevenir, aplicada agora não a uma execução individual, mas à **citação de um baseline de retro anterior copiada para dentro de uma story nova** sem re-verificação no momento da criação da story. O guardrail existente cobre bem "não invente o número desta story"; não cobre ainda "não copie o número de uma story/retro anterior sem revalidar".
- **O item de ação #3 da retrospectiva do 2º lote ("promover a mitigação de contenção do Neon — `--workers=1`/`--no-file-parallelism` — de lembrete manual para configuração default") permanece não executado, agora pela terceira vez consecutiva dentro do próprio Epic 11.** Confirmado por leitura direta nesta sessão: `frontend/playwright.config.ts` ainda tem `fullyParallel: true` sem `workers` default; `frontend/vitest.config.ts` ainda não define `fileParallelism`. A Story 11.12 repetiu a mesma invocação manual da flag (`npx vitest run --no-file-parallelism`), como todas as 11 stories anteriores do épico.
- **A questão em aberto da Story 11.9 (verificação visual: hover, cap de 720px, grade 4+3, truncagem) segue sem confirmação do Hugo** — fora do escopo da Story 11.12 (que não tocou nenhum desses componentes), carregada como pendência não-bloqueante há dois ciclos de retro.

## 4. Insights principais

1. **Uma story sem nenhum achado de review não é "sorte" — é o resultado observável de copiar um precedente estrutural validado em vez de desenhar algo novo.** `eisenhower` já tinha percorrido exatamente o caminho que `category` precisava percorrer; a story citou esse precedente em cada task, e o resultado foi zero achados pela primeira vez no épico. É a contraparte positiva do Insight #1 da retrospectiva do 2º lote ("guardrails só sobrevivem como config versionada") — aqui o "guardrail" era um precedente de código bem escolhido, não uma regra escrita, e funcionou igualmente bem.
2. **Baselines de teste citados em documentos (retros, seções "Previous Story Intelligence") têm prazo de validade e podem divergir entre si mesmo quando ambos alegam vir de execução real.** A discrepância 538 vs. 542 (Seção 3) mostra que a mitigação certa não é só "rode o comando real nesta story" (já garantido), mas também "não herde um número de um documento anterior sem revalidar no momento em que ele é citado de novo" — um refinamento do guardrail existente, não um guardrail novo do zero.
3. **Uma questão aberta registrada explicitamente numa story (em vez de descartada ou resolvida silenciosamente) é rastreável e fechável de forma limpa.** A Story 11.8 registrou a questão da categoria com o escopo exato que ela exigiria; quando o Hugo decidiu fechá-la, a Story 11.12 pôde ser criada e implementada sem nenhuma investigação adicional de escopo — o trabalho de descoberta já tinha sido feito e documentado no momento certo, não differido.
4. **Itens de ação de retro sem dono individual + sem custo de implementação trivial não avançam, mesmo depois de reconhecidos repetidamente como triviais.** A mitigação do Neon é um exemplo raro: o "custo" de implementar é de fato baixo (2 linhas de config), mas 3 ciclos consecutivos não bastaram para que alguém (humano ou agente) a executasse como parte do trabalho normal — reforça que mesmo ações triviais precisam de um gatilho explícito de execução, não apenas de reconhecimento repetido.

## 5. Retrospectiva anterior — Follow-through

**Nota metodológica:** "retro anterior" aqui é a 2ª passada do próprio Epic 11 (`epic-11-retro-2026-07-16.md`, 11.7–11.11), fechada horas antes do início do 3º lote no mesmo dia.

| # | Item de ação (2ª passada) | Status | Evidência |
|---|---|---|---|
| 1 | Apendar 3 guardrails novos a `_bmad/custom/bmad-dev-story.toml` (`component="div"`, reset de estado por rota, e2e de componente compartilhado) | ✅ **Feito** (executado na própria 2ª passada) — confirmados presentes no toml lido nesta sessão; a Story 11.12 não tocou nenhuma dessas 3 áreas (sem `Typography` de bloco novo, sem navegação por rota, sem componente compartilhado alterado por ricochete), então não há uma nova amostra de aderência, mas também zero recorrência |
| 2/6 | AR-22 — escalar decisão de dono/data antes do Epic 5 | ✅ **RESOLVIDO** — decisão explícita do Hugo registrada em 2026-07-16 (memória do projeto): observabilidade mínima fica agendada deliberadamente para **antes do Épico 10** (mais usuários), não antes do Épico 5. O prazo antigo "antes do Epic 5" está cancelado por decisão, não por omissão. **Parar de reafirmar como pendência** — é a primeira retro do projeto em que este item para de aparecer como "sem dono" |
| 3 | Promover mitigação de contenção do Neon a configuração default | ❌ **Ainda não feito** — 3º ciclo consecutivo sem execução (Seção 3) |
| 4 | Questão aberta ao Hugo (categoria em templates recorrentes) | ✅ **Resolvida e implementada** — Hugo decidiu que sim via Correct Course; Story 11.12 entrega o escopo completo. Esta é a story deste próprio lote |
| 5 | Verificação visual pendente do Hugo (Story 11.9: hover/720px/grade 4+3/truncagem) | ⏳ **Ainda pendente** — fora do escopo da Story 11.12, não avançou nem regrediu |
| 7/8 | Documentação (`futureIdeas.md`, `architecture.md`/`prd.md`/`README.md`) revisada contra o código do 2º lote | ✅ **Feito** na própria 2ª passada; **`futureIdeas.md` atualizado novamente nesta sessão** para refletir a Story 11.12 (categoria deixou de ser "questão aberta" nas duas linhas que a citavam) |

**Leitura:** dos 6 itens de ação da retro anterior, 2 foram resolvidos nesta janela (a questão da categoria — sendo o próprio objeto do lote — e o AR-22, por decisão explícita já tomada fora deste ciclo), 1 segue sem execução pela terceira vez (Neon), 1 segue pendente de confirmação humana não-bloqueante (verificação visual), e 2 (guardrails, docs) seguem válidos sem nova amostra ou foram re-executados.

## 6. Preview do Epic 5: Brain Dump & Captura Rápida (Fase 1b)

**Objetivo:** inalterado desde as duas retros anteriores — caixa de entrada sem data, indicador persistente como server state derivado, processamento manual (`epics.md`, linha ~1042).
**Depende de:** Epic 1, Epic 3 (Daily Log como destino de processamento) — **não depende do Epic 4 nem do Epic 11**. A Story 11.12 tocou exclusivamente `RecurringTaskTemplate` (modelo, contrato, CRUD e placement de recorrentes) — nenhuma superfície, modelo ou máquina de estados relevante ao Brain Dump foi alterada.

### O que o Epic 5 pode reaproveitar da Story 11.12 (não por dependência, por padrão)

- **Copiar um campo nulável entre modelo-template e modelo-instância** (`category` de `RecurringTaskTemplate` → `Task`) é o mesmo formato estrutural que um eventual "template de brain dump processado → task gerada" usaria, se o Epic 5 vier a introduzir algo parecido — mesmo padrão de "reusar o enum existente, não inventar um novo" vale por analogia.
- **Resolver uma AC ambígua ("persistida e exibida na listagem") favorecendo a leitura mais literal + documentando a escolha inline** segue sendo o padrão institucionalizado (Epic 4 #3) — útil se o Epic 5 tiver ACs redigidas em nível de produto sem apontar componente exato.

### Lacunas ou preparação necessária

- **Nenhuma preparação técnica bloqueante identificada** — mesma conclusão das duas retros anteriores, reconfirmada; a Story 11.12 não introduziu nenhuma dependência nova para o Epic 5.
- **AR-22 não é mais um item de preparação para o Epic 5** — decisão já tomada de adiar para antes do Epic 10 (Seção 5, item 2/6). Remover das listas de "preparação necessária antes do Epic 5" das retros anteriores.
- **Mitigação de contenção do Neon como config default** — não bloqueante, mas agora 12 stories seguidas (todo o Epic 11) repetiram a flag manual. Se o Epic 5 também rodar E2E extensivamente, o custo de fricção acumulado continua a crescer.

### Descobertas significativas que exigiriam replanejar o Epic 5

Nenhuma. A Story 11.12 é aditiva e isolada a `bujo/` (recorrentes) — nada no seu escopo contradiz ou tensiona o que `epics.md` já documenta para o Epic 5. **Epic Update Required: NÃO.**

---

## 7. Itens de Ação

### Processo

1. **Promover a mitigação de contenção do Neon (`--workers=1`/`--no-file-parallelism`) de lembrete manual para configuração default** em `playwright.config.ts` (`workers: 1`) e `vitest.config.ts` (`fileParallelism: false`) — 3º ciclo consecutivo sem execução; ação repetida integralmente, sem modificação, das duas retros anteriores. Owner: Winston (Arquiteto). **Recomendação desta retro:** como o custo de implementação é trivial (2 linhas) e o item já foi validado 3 vezes como correto, tratar como candidato a execução na primeira oportunidade de qualquer story futura que já esteja mexendo nesses arquivos de config — não esperar uma 4ª retrospectiva reafirmando o mesmo texto.
2. **Refinar o guardrail de contagem de testes para cobrir baselines herdados de documentos anteriores** (Seção 3/Insight #2): ao citar um baseline de teste numa seção "Previous Story Intelligence" ou Dev Notes, re-executar o comando real no momento da criação da story, não copiar o número de uma retro/story anterior sem revalidação — mesmo quando esse número também alegava vir de execução real. Owner: Amelia (Dev) — aplicar em `_bmad/custom/bmad-dev-story.toml` na próxima oportunidade de revisão de guardrails.

### Qualidade

3. **Verificação visual pendente do Hugo (Story 11.9, não bloqueante, carregada de duas retros anteriores):** hover perceptível, cap de 720px + centralização, grade 4+3 e truncagem — CSS que jsdom não valida por asserção unitária. Owner: Hugo.

### Resolvido nesta sessão (sem ação futura necessária)

4. **AR-22 (observabilidade):** decisão de dono/prazo já tomada (antes do Epic 10, não antes do Epic 5) — deixar de reafirmar como pendência em retros futuras até se aproximar do Epic 10.
5. **Categoria em templates recorrentes:** implementada integralmente via Story 11.12 — questão fechada.

### Documentação (executado como parte desta retrospectiva)

6. **`docs/futureIdeas.md` atualizado** — as duas linhas que registravam "categoria não incluída / questão aberta ao Hugo" (itens de "BUGs Epico 4" e "Bugs Epico 11 2º lote") foram corrigidas para apontar a Story 11.12 e esta retrospectiva como a resolução.
7. **`architecture.md`/`prd.md`/`README.md` revisados contra o código real da Story 11.12** — nenhum dos três documenta `RecurringTaskTemplate` em nível de schema/campos, então a adição de `category` não cria nenhuma discrepância a corrigir. Proposta de atualização descartada (nenhuma mudança necessária).

---

## 8. Avaliação de Prontidão do Epic 11 (COMPLETO — 12/12 stories, 3 lotes)

| Dimensão | Status |
|---|---|
| Testes & Qualidade | ✅ 377 testes backend (dupla confirmação independente dev+review, não re-executado nesta retro) + **551 testes frontend (reconfirmado por reexecução real nesta retro, Node 22.15.1, 45 arquivos)**; 0 achados de qualquer severidade na Story 11.12; ⚠️ 1 verificação visual pendente do Hugo (Story 11.9), não bloqueante |
| Deploy | ✅ Nenhum bloqueio novo; AR-21 (deploy) concluído desde 2026-07-12; AR-22 (observabilidade) **decidido e agendado** para antes do Epic 10 — não é mais item pendente/escalável |
| Aceite de stakeholder | ✅ Hugo é o único stakeholder; Story 11.12 passou por Senior Developer Review (autônomo) com resultado aprovado/`done`; a única questão de produto em aberto do épico (categoria) foi decidida e implementada nesta própria story |
| Saúde técnica | ✅ Sem dívida técnica nova; contrato de API regenerado corretamente e sem drift; migração de banco simples (`AddField`, sem backfill) |
| Bloqueios não resolvidos | ✅ Nenhum bloqueio técnico; ⚠️ mitigação de contenção do Neon segue como fricção manual não-bloqueante (item de ação #1, 3º ciclo) |

**Conclusão:** o Epic 11 está **integralmente completo** — 12/12 stories entre os três lotes, incluindo a questão em aberto da Story 11.8 fechada pela Story 11.12. Zero achados de qualquer severidade no 3º lote. Dos itens pendentes carregados pelas retros anteriores, 2 foram resolvidos nesta janela (categoria, AR-22), restando apenas 2 itens não-bloqueantes (mitigação do Neon, verificação visual da 11.9) — nenhum impede o início do Epic 5.

---

## 9. Ações de documentação executadas

Após a retrospectiva, os documentos de planejamento e configuração de processo foram comparados contra o código real e o histórico de git da Story 11.12. Resultado das verificações e correções:

- **`docs/futureIdeas.md`:** discrepância confirmada e corrigida. As duas linhas que registravam "categoria não incluída, questão aberta ao Hugo" (uma na seção "BUGs Epico 4", outra na seção "Bugs Epico 11, 2º lote") estavam desatualizadas desde a implementação da Story 11.12 — corrigidas para apontar a story e esta retrospectiva como a resolução.
- **`_bmad/custom/bmad-dev-story.toml`:** nenhum guardrail novo necessário — a Story 11.12 não produziu nenhum achado de review (Seção 2), então não há um erro recorrente novo para codificar. O refinamento proposto no Item de Ação #2 (baselines herdados) fica registrado como ação futura, não executado nesta sessão (é uma mudança de texto de guardrail existente, não uma reação a um achado desta story).
- **`architecture.md`:** revisado — nenhuma seção documenta o schema de `RecurringTaskTemplate` a nível de campo (AD-16 trata de decisões de UX/fluxo de "Mover", não do modelo de dados de recorrentes). A adição de `category` não contradiz nem exige atualização de nenhuma AD existente. Nenhuma discrepância encontrada.
- **`prd.md`:** revisado (FR-1.11–FR-1.12, recorrentes) — nenhum FR especifica os campos exatos do template recorrente a nível de implementação; a adição de `category` é uma extensão aditiva dentro do espírito já descrito ("recorrência carrega os mesmos atributos de uma tarefa comum"). Nenhuma mudança necessária.
- **`README.md`:** revisado — não documenta modelo de dados nem endpoints da API. Nenhuma discrepância encontrada.
- **Demais candidatos revisados sem discrepância encontrada:** `schema.yaml`/`types.gen.ts` (gerados, já regenerados corretamente pela própria story); `sprint-change-proposal` — não existe um documento de correct-course dedicado para o 3º lote além da nota inline em `epics.md` (linha 1009), que já está atualizada e correta.

---

## 10. Encerramento

**Epic Update Required:** NÃO — Epic 5 pode começar com o plano atual, sem sessão de replanejamento.

**Commitments desta retrospectiva:** 3 itens de ação (1 técnico não-bloqueante repetido pela 3ª vez — Neon config; 1 de refinamento de guardrail; 1 de verificação visual pendente do Hugo), 2 itens resolvidos nesta janela e removidos da lista de pendências (AR-22, categoria), 2 itens de documentação já executados, 0 itens de preparação crítica bloqueando o Epic 5, 0 itens de critical path técnico.

**Próximos passos:**
1. Épico 11 fechado em `sprint-status.yaml` (`epic-11: done`, `epic-11-retrospective: done`).
2. Promover a mitigação de contenção do Neon a configuração default (item de ação #1) — recomendado executar junto de qualquer story futura que já toque `playwright.config.ts`/`vitest.config.ts`, sem esperar uma 4ª retrospectiva.
3. Confirmar com o Hugo a verificação visual pendente da Story 11.9 (item de ação #3) — não bloqueante.
4. Iniciar Epic 5 com `create-story` para a Story 5.1 (Caixa de entrada do Brain Dump e processamento manual) quando desejado — sem bloqueios técnicos ou de preparação pendentes.
