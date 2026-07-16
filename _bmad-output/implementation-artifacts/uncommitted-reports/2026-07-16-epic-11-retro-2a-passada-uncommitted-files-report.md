# Explicação dos arquivos não commitados - Retrospectiva Epic 11 (2ª passada, 11.7–11.11)

## Visão geral

Fecha o Épico 11 pela segunda vez: roda a retrospectiva autônoma (#YOLO) do 2º lote (Stories 11.7–11.11, reaberto via Correct Course em 2026-07-15) e aplica as ações de documentação levantadas por ela. Nenhum arquivo de código-fonte foi alterado — só artefatos de planejamento/processo e o log do próprio orquestrador do story-automator.

## Ordem lógica de funcionamento

1. Retrospectiva nova (documento de análise, gerado por esta sessão).
2. Guardrails de processo atualizados (`_bmad/custom/bmad-dev-story.toml`) — consumidos por toda story futura via `bmad-dev-story`.
3. Notas de produto do usuário (`docs/futureIdeas.md`) reconciliadas contra o que já foi implementado.
4. Rastreamento de sprint (`sprint-status.yaml`) atualizado para refletir o fechamento do épico.
5. Log do orquestrador do story-automator (artefato de execução, não de planejamento) — já vinha modificado desde antes desta sessão, registra o gatilho da própria retrospectiva.

## 1. Retrospectiva (documento novo)

### `_bmad-output/implementation-artifacts/epic-11-retro-2026-07-16.md`

**Função geral do arquivo**

Documento de retrospectiva BMAD, gerado pelo workflow `bmad-retrospective` em modo autônomo (#YOLO). É a 2ª passada da retrospectiva do Epic 11 — a 1ª (`epic-11-retro-2026-07-15.md`) cobriu as Stories 11.1–11.6; esta cobre o 2º lote (11.7–11.11), reaberto no mesmo dia via Correct Course.

**Função geral da mudança**

Arquivo novo (untracked). Síntese data-driven de: sprint-status, as 5 stories do 2º lote (Dev Notes, Completion Notes, Senior Developer Review de cada uma), a retrospectiva anterior do próprio épico, `sprint-change-proposal-2026-07-15.md`, `architecture.md` (AD-16), `docs/futureIdeas.md` e o log do orquestrador. Inclui uma reexecução real de `npx vitest run --no-file-parallelism` (Node 22.15.1) contra o HEAD atual como verificação independente, confirmando 542 testes passando (45 arquivos) — bate exatamente com o que a review da Story 11.11 já reportava.

**Blocos principais**

- Seções 1–4: resumo de métricas do lote, o que foi bem, onde a equipe tropeçou, insights principais.
- Seção 5: follow-through dos 8 itens de ação da retrospectiva anterior (mesma retro do mesmo épico, não um épico diferente) — 4 cumpridos, 4 não cumpridos (2 são o mesmo item duplicado, AR-22).
- Seção 6: preview do Epic 5 — sem mudança de conclusão em relação à retro anterior (sem dependência nova, sem replanejamento necessário).
- Seção 7: 8 itens de ação novos, com 3 já executados nesta própria sessão (guardrails + docs).
- Seção 8: avaliação de prontidão do Epic 11 **completo** (ambos os lotes, 11/11 stories).
- Seção 9: ações de documentação executadas (o que motivou as edições nos demais arquivos deste commit).
- Seção 10: encerramento e próximos passos.

**Consumo por outros arquivos**

Referenciado pelas edições em `docs/futureIdeas.md` (nota de rodapé do grupo "Bugs"/"Melhorias de UX/UI") e citado como fonte no `sprint-status.yaml` (comentário da chave `epic-11-retrospective`).

## 2. Guardrails de processo

### `_bmad/custom/bmad-dev-story.toml`

**Função geral do arquivo**

Override de time para o skill `bmad-dev-story` — `persistent_facts` é uma lista de lições de retrospectivas passadas, carregada como contexto obrigatório por toda execução futura de `dev-story`.

**Função geral da alteração**

+3 entradas na lista `persistent_facts`, uma por achado desta retrospectiva que se qualifica como guardrail (recorrente, específico, acionável):

1. `Typography variant` custom (`body-sm` etc.) usada como bloco precisa de `component="div"` explícito — sem isso o MUI cai no fallback `<span>` e `noWrap`/ellipsis não se aplicam. Origem: HIGH da Story 11.9 (AC1 "descrição truncada" não era entregue de fato apesar da suíte verde).
2. Navegação entre duas rotas que renderizam a mesma instância de componente React precisa de reset de estado local chaveado no parâmetro de rota — o React preserva `useState` entre navegações desse tipo. Origem: MEDIUM da Story 11.11 (formulário/painel vazavam estado entre semanas/meses ao usar os novos botões anterior/próximo).
3. Alterar um componente compartilhado exige checar todos os e2e specs que o exercitam indiretamente, não só os specs citados nas tasks da story. Origem: MEDIUM recorrente nas Stories 11.7 (`daily-tasks.spec.ts` esquecido) e 11.8 (`recurring-templates.spec.ts` adicionado por QA automatizado, nunca reconciliado).

**Comportamento esperado**

Toda story futura processada por `bmad-dev-story` carrega essas 3 frases como `persistent_facts` — o mesmo mecanismo que já fez os guardrails da retro do Epic 3 grudarem quase perfeitamente nos Epics 4 e 11 (citado como Insight #1 desta retro e da anterior).

## 3. Notas de produto do usuário

### `docs/futureIdeas.md`

**Função geral do arquivo**

Lista de ideias/bugs/melhorias em texto livre, escrita diretamente pelo Hugo. Fonte original de quase todo o escopo do 2º lote do Epic 11 (seções "Bugs" e "Melhorias de UX/UI").

**Função geral da alteração**

Reconciliação de checkboxes contra o que as Stories 11.7–11.11 de fato implementaram (mesmo padrão já usado pela retrospectiva anterior para a seção "BUGs Epico 4"):
- Seção "Bugs" (linha ~26 em diante): todos os itens marcados `[x]`, cada um anotado com a story que o resolveu. O item de categoria em templates recebeu nota explicando que ficou como questão aberta ao Hugo (AC4 da Story 11.8), não como lacuna.
- Seção "Melhorias de UX/UI": todos os 8 itens marcados `[x]`, anotados com Story 11.9 (4 itens visuais) ou Story 11.10 (4 itens do seletor de mover).
- Item "Aba de Histórico" (linha 9, lista de ideias gerais, fora das seções de bug): **não** marcado — anotado como parcialmente coberto pela Story 11.11 (navegação livre para trás nas superfícies existentes), com a superfície unificada dedicada registrada como fora de escopo.
- Nota de recorrência atualizada (linha 17): a etiqueta Eisenhower do modal de placement, antes pendente, agora resolvida pela Story 11.8.

Nenhuma nota nova do próprio Hugo foi revertida ou alterada — só checkboxes de itens já 100% implementados e verificados por code review.

## 4. Rastreamento de sprint

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo**

Fonte de verdade do status de cada epic/story/retrospectiva do projeto, consumida por todo skill BMAD (`bmad-sprint-status`, `bmad-retrospective`, `bmad-story-automator`, etc.).

**Função geral da alteração**

3 linhas alteradas dentro do bloco `development_status`:
- `epic-11`: `in-progress` (reaberto via Correct Course) → `done` (2º lote concluído e retrospectado).
- `epic-11-retrospective`: `optional` (1ª passada mantida, aguardando a 2ª) → `done`, com comentário apontando para o arquivo de retro desta sessão.
- `last_updated` (topo do arquivo): atualizado para refletir esta sessão.

Nenhuma outra chave alterada — todos os comentários e a seção `STATUS DEFINITIONS` do cabeçalho foram preservados intactos.

## 5. Log do orquestrador do story-automator

### `_bmad-output/story-automator/orchestration-11-20260716-015115.md`

**Função geral do arquivo**

Artefato de execução (não de planejamento) do `bmad-story-automator` — registra o estado passo-a-passo da automação que rodou as Stories 11.7–11.11 em sequência nesta sessão de trabalho.

**Função geral da alteração**

Já vinha modificado no working tree **antes** do início desta retrospectiva (é o próprio orquestrador registrando a conclusão da Story 11.11 e o gatilho para esta retro): `currentStory`/tabela de progresso marcam 11.11 como 100% `done`, e as 2 últimas linhas do log de "Learnings & Recommendations" registram "Story 11.11: COMPLETE" e "Epic 11: ALL STORIES DONE — triggering retrospective". Nenhuma edição foi feita por esta sessão de retrospectiva neste arquivo — incluído no commit seguindo o mesmo precedente da retrospectiva anterior (commit `8490e8e`, que também incluiu o log de orquestração do 1º lote).

---

**Nenhum comportamento de código foi alterado.** Todas as mudanças são de planejamento/processo/rastreamento; nenhum teste foi executado como parte desta reconciliação além da reexecução de sanidade do `vitest` já citada na própria retrospectiva (Seção 1).
