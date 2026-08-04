# Sprint Change Proposal — 2026-07-31

**Gatilho:** Retrospectiva do Épico 15 (`epic-15-retro-2026-07-31.md`, §6 — Achado Significativo)
**Modo de execução:** Batch (todas as mudanças revisadas juntas, por escolha do Hugo)

---

## 1. Resumo do Problema

Discutindo o custo de tempo/tokens do Épico 15 na retrospectiva, ficou evidente que o maior driver de rodadas de review do épico foi a story 15.3 (passe de fechamento de acessibilidade) — 4 rodadas de review, a maioria achando lacunas de *simetria de cobertura entre viewports* (não bugs de produção). Essa verificação existe para atender uma exigência de **Definition of Ready** (`UX-DR30`, item 6) e uma decisão de design (`UX-DR20`), ambas tomadas antes de o contexto real de uso do produto estar confirmado.

**Contexto que mudou:** Hugo confirmou que o produto é usado por um grupo pequeno e fechado de amigos, **nenhum deles usuário de leitor de tela ou navegação só-por-teclado**.

**Decisão:** descontinuar a *verificação formal* de acessibilidade (matriz axe-core por viewport, stories dedicadas de fechamento tipo `13.4`/`15.3`) — **manter** o comportamento acessível que já vem de graça pelos componentes compartilhados (tokens, foco, teclado, semântica básica MUI), já que degradá-lo de propósito não economizaria nada relevante.

## 2. Análise de Impacto

**Épicos:** 1–15 intocados (já entregues). Épicos 16–22 precisam de ajuste de AC — nenhum épico fica inviável, é recorte de escopo, não replanejamento.

**PRD:** **sem conflito, sem mudança.** `UX-DR20` só é citado no PRD para FR-2.3/FR-13.8 ("tag função de IA": cor nunca sozinha) — princípio de clareza de feature de IA, não a verificação que está sendo cortada.

**Arquitetura:** **sem mudança.** `@axe-core/playwright` é só uma entrada de dependência no spine, não uma AD normativa.

**UX Design (`DESIGN.md`/`EXPERIENCE.md`):** **sem mudança.** A seção "Accessibility Floor" (contraste de tokens, target 44px) é o contrato de design dos componentes — comportamento que Hugo decidiu manter (grátis, já embutido).

**`migration-plan.md`** (`_bmad-output/specs/spec-design-system-migration/`): **sem mudança.** As únicas menções a a11y são sobre ondas 2a/3, já fechadas (histórico, não prescrevem requisito futuro).

**`epics.md` — achado principal:** a real fonte normativa não são as 6 cláusulas soltas de AC com "axe-core +" que uma primeira varredura encontra — é o **item (6) de `UX-DR30`** ("Aceite UX por story + DoR da migração"), citado transversalmente por **12 stories** dos Épicos 13–22 como Definition of Ready. Editar só as cláusulas soltas sem editar o item (6) da fonte deixaria o gate real intacto (`create-story`/`dev-story` continuariam puxando o requisito via a citação "UX-DR30"). Este é o edit de maior alavancagem desta proposta.

## 3. Caminho Recomendado

**Opção 1 — Ajuste direto** (única opção avaliada como viável): editar `UX-DR20`/`UX-DR30` no glossário do `epics.md`, revisar a Story `17.6` (não excluí-la — ela mistura paridade/performance com a11y, e a parte de paridade/performance é real e deve ficar) e limpar as 6 cláusulas soltas por consistência. Esforço: baixo. Risco: baixo (nenhuma dependência aponta para `17.6`, confirmado por busca no documento inteiro).

## 4. Mudanças Detalhadas

### 4.1 — `epics.md` linha 330 — `UX-DR20` (glossário)

**ANTES:**
> — **UX-DR20 (Acessibilidade — WCAG 2.2 AA)** — cor nunca único indicador (sempre + ícone/texto); touch target ≥ 44px mobile; focus ring MUI preservado; tab order = ordem visual; `Esc` fecha modal/popover; anúncios `aria-live` (mudança de superfície, progresso de migração, status de tarefa, badge do Brain Dump); semântica HTML (`<nav>`, `<main>`, `role=dialog`/`aria-modal` com foco travado).

**DEPOIS (acrescenta emenda, não remove o original — preserva rastreabilidade):**
> — **UX-DR20 (Acessibilidade — WCAG 2.2 AA)** — cor nunca único indicador (sempre + ícone/texto); touch target ≥ 44px mobile; focus ring MUI preservado; tab order = ordem visual; `Esc` fecha modal/popover; anúncios `aria-live` (mudança de superfície, progresso de migração, status de tarefa, badge do Brain Dump); semântica HTML (`<nav>`, `<main>`, `role=dialog`/`aria-modal` com foco travado). **[EMENDA 2026-07-31 — ver `sprint-change-proposal-2026-07-31.md`]:** estes princípios seguem valendo como convenção de design herdada dos componentes compartilhados (grátis, já embutida), mas deixam de ser **verificação formal obrigatória** por story — ver `UX-DR30` item (6).

**Rationale:** preserva a decisão de design (comportamento) e documenta explicitamente que a obrigatoriedade de verificação caiu, sem apagar o histórico da decisão original.

---

### 4.2 — `epics.md` linha 343 — `UX-DR30` item (6) (o gate real, citado por 12 stories)

**ANTES:**
> (6) passa teclado/foco/screen reader/touch target/zoom-reflow/reduced motion/contraste;

**DEPOIS:**
> (6) mantém teclado/foco funcionais como comportamento herdado dos componentes compartilhados — **[EMENDA 2026-07-31]** descontinuada a verificação formal dedicada de screen reader/zoom-reflow/reduced motion/matriz axe-core por viewport (grupo de usuários fechado, sem necessidade confirmada de tecnologia assistiva; ver `sprint-change-proposal-2026-07-31.md`); touch target/contraste seguem garantidos pelos tokens do `DESIGN.md` (Accessibility Floor), sem gate de teste dedicado por story;

**Rationale:** este é o edit de maior alavancagem — é a cláusula que qualquer story futura das Onda 5–6+ herda só por citar "UX-DR30", sem precisar repetir "axe-core" explicitamente.

---

### 4.3 — `epics.md` linhas 2787–2798 — Story 17.6 (revisão, não remoção)

**ANTES:**
```
### Story 17.6: Passe de paridade e acessibilidade da Onda 2b

Como Hugo,
Quero a Onda 2b fechada com paridade e acessibilidade comprovadas,
Para que a home nova entre sem regressão no fluxo mais frequente do produto (UX-DR30; NFR-1/2).

**Critérios de Aceitação:**

**Dado que** as checklists de paridade (Daily + entrada pós-login),
**Quando** o passe roda,
**Então** captura a um toque, migrações pendentes, prefetch/performance percebida (<2s) e todos os estados estão verificados,
**E** axe-core + teclado + zoom/reflow passam; e2e representativo cobre login → dashboard → agir no card → Hoje → Daily.
```

**DEPOIS:**
```
### Story 17.6: Passe de paridade e performance da Onda 2b

Como Hugo,
Quero a Onda 2b fechada com paridade funcional e performance comprovadas,
Para que a home nova entre sem regressão no fluxo mais frequente do produto (NFR-1/2).

**Critérios de Aceitação:**

**Dado que** as checklists de paridade (Daily + entrada pós-login),
**Quando** o passe roda,
**Então** captura a um toque, migrações pendentes, prefetch/performance percebida (<2s) e todos os estados estão verificados,
**E** e2e representativo cobre login → dashboard → agir no card → Hoje → Daily. **[EMENDA 2026-07-31]** verificação dedicada de acessibilidade (axe-core/teclado/zoom-reflow) descontinuada — ver `sprint-change-proposal-2026-07-31.md`; comportamento de teclado/foco dos componentes compartilhados permanece inalterado.
```

**Rationale:** esta story mistura DUAS coisas — paridade/performance da superfície mais usada do produto (Daily + Dashboard) e acessibilidade formal. Só a segunda é descontinuada; a primeira (prefetch <2s, captura a um toque, e2e representativo) é valor real e não deve ser cortada.

---

### 4.4 — Seis cláusulas soltas de AC (limpeza de consistência, redundantes após 4.2)

| Story | Linha | ANTES | DEPOIS |
|---|---|---|---|
| 16.1 Hábitos | 2480 | `**E** axe-core + estados obrigatórios passam; emoji atual permanece exibido como fallback.` | `**E** estados obrigatórios passam; emoji atual permanece exibido como fallback.` |
| 16.4 Saúde-Métricas | 2523 | `**E** axe-core + estados obrigatórios passam; gráficos com resumo textual/tabela equivalente.` | `**E** estados obrigatórios passam; gráficos com resumo textual/tabela equivalente.` |
| 17.4 Daily Log | 2763 | `**E** axe-core + estados obrigatórios passam em wide/medium/compact.` | `**E** estados obrigatórios passam em wide/medium/compact.` |
| 18.1 Configurações | 2830 | `**E** axe-core + estados passam.` | `**E** estados passam.` |
| 19.5 UI — registros | 2989 | `...axe-core + estados obrigatórios passam,` | `...estados obrigatórios passam,` |
| 22.3 Captura manual | 3294 | `...axe-core + estados passam.` | `...estados passam.` |

**Rationale:** em todos os 6 casos, mantém-se "estados (obrigatórios) passam" (paridade funcional de loading/empty/error/offline — não é a11y) e remove-se só o `axe-core +`.

## 5. Impacto no MVP

Nenhum. Escopo funcional de nenhuma story muda — só a exigência de verificação formal de acessibilidade é retirada. MVP segue como estava.

## 6. Handoff de Implementação

**Classificação:** Moderada (reorganização de backlog — texto de `epics.md`, sem replanejamento de arquitetura/PRD).
**Responsável pela implementação:** Amelia (Dev), diretamente nesta sessão, mediante aprovação do Hugo.
**Critério de sucesso:** `epics.md` reflete a decisão; `UX-DR30` item (6) é o texto que qualquer `create-story` futuro vai ler — verificado que não há mais nenhuma outra fonte independente (PRD/arquitetura/migration-plan/DESIGN.md) mandando verificação formal de a11y.
