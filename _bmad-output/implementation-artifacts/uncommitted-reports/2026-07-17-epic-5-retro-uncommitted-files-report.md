# Explicacao dos arquivos nao commitados - Retrospectiva do Épico 5 (Brain Dump & Captura Rápida)

## Visao geral

O conjunto de mudanças é o resultado da retrospectiva do Épico 5, rodada em modo autônomo (`#YOLO`) pelo story-automator após as Stories 5.1, 5.2 e 5.3 já estarem implementadas, revisadas e commitadas individualmente. Não há código de produto (backend/frontend de aplicação) alterado — são 7 arquivos, todos de três naturezas: (1) **artefatos de planejamento/status** que registram o fechamento do épico e a própria retrospectiva; (2) **reconciliação de documentação de arquitetura** (uma chave de query do TanStack Query documentada de forma diferente do código real); e (3) **configuração de tooling de teste e guardrails de processo**, promovendo a duas correções de retrospectivas anteriores (Epic 4/Epic 11) que vinham sendo aplicadas manualmente há 4 ciclos sem nunca virar default. Nenhum arquivo de `backend/` ou `frontend/src/` foi tocado — o épico em si permanece com o código já commitado; só o "encerramento" do processo e o ajuste de config/guardrails são novos.

## Ordem logica de funcionamento

1. A retrospectiva é sintetizada e registrada em um documento novo (`epic-5-retro-2026-07-17.md`), que é a fonte de verdade de todas as demais mudanças.
2. O status do sprint é atualizado para refletir que o épico e sua retrospectiva estão `done` (`sprint-status.yaml`).
3. O log de orquestração do story-automator registra o encerramento da Story 5.3 e o disparo automático da retrospectiva (`orchestration-5-20260716-224123.md`) — housekeeping do próprio orquestrador.
4. A documentação de arquitetura é reconciliada contra o código real, corrigindo uma chave de query desatualizada (`architecture.md`, decisão AD-13).
5. Dois guardrails de processo identificados na retrospectiva são codificados como fatos persistentes que o agente de dev-story deve respeitar em stories futuras (`bmad-dev-story.toml`).
6. A mitigação de flakiness do Neon/paralelismo, até então aplicada manualmente a cada rodada de testes, é promovida a configuração default tanto no Vitest (`vitest.config.ts`) quanto no Playwright (`playwright.config.ts`), fechando o item de ação mais antigo (aberto desde a retro do Epic 4).

## 1. Artefatos de planejamento e status do épico

### `_bmad-output/implementation-artifacts/epic-5-retro-2026-07-17.md`

**Funcao geral do arquivo**

Documento novo (untracked), puramente Markdown — é um artefato de implementação/processo (não código), a ata estruturada da retrospectiva do Épico 5. Segue o template padrão de retrospectiva do BMAD: resumo do épico, o que foi bem, tropeços, insights, follow-through de retros anteriores, preview do próximo épico, itens de ação, avaliação de prontidão, ações executadas e encerramento.

**Funcao geral da alteracao**

Arquivo inteiramente novo (174 linhas). É o documento "fonte" que motivou e justifica todas as demais alterações deste conjunto (sprint-status, architecture.md, bmad-dev-story.toml, configs de teste).

**Blocos principais**

- Linhas 1-9: cabeçalho — data, modo (`#YOLO`, autônomo, sem interação síncrona com Hugo), facilitação (Amelia) e nota de transparência explicitando que nenhuma fala é citação literal.
- Linhas 12-33 (Seção 1 — Resumo do Épico): tabela de métricas — 3/3 stories completas, evolução de contagem de testes (backend 419→428; frontend 577→591→609/610 unit + 12 E2E), 0 achados CRITICAL/HIGH em todo o épico, e o gap de especificação encontrado (chave de query `['brainDumpCount', userId]` vs. `['brainDump', 'count', userId]` real), marcado como "fechado nesta retrospectiva (Seção 9)".
- Linhas 36-43 (Seção 2 — O que foi bem): destaca a Story 5.1 como fatia vertical completa que amortizou 5.2/5.3 (5.3 não tocou backend), o primeiro import cross-domain do codebase (`braindump.services` → `bujo.services.logs`/`tasks`), e o bug real de `autoFocus`/`FocusTrap` só detectável por E2E real.
- Linhas 45-51 (Seção 3 — Tropeços): "File List incompleto" reincidente (5.2, `fixtures.ts` modificado, não arquivo novo); regressão da contagem de testes "de memória" na 5.3 (604/11 documentado vs. 609/12 real); 4º ciclo consecutivo de aplicar `--no-file-parallelism`/`--workers=1` manualmente; migration `braindump.0001_initial` não aplicada em branches Neon dedicadas (recorrente 2x).
- Linhas 53-58 (Seção 4 — Insights): reforça que guardrail escrito só "gruda" quando a checagem é binária, e que ações triviais sem dono único não se auto-executam sem gatilho — a própria retro assume o papel de gatilho de execução.
- Linhas 60-76 (Seção 5 — Follow-through, tabela de 9 itens): rastreia itens de ação de retros anteriores (Epic 4/Epic 11), marcando como **executados nesta retro** a promoção do Neon a default (item 1) e o refinamento do guardrail de contagem (item 2).
- Linhas 78-98 (Seção 6 — Preview do Epic 6): mapeia o que o Epic 6 (Sistema de Hábitos) pode reaproveitar do Epic 5 (server state derivado via TanStack Query, otimismo seletivo), confirma que não há dependência técnica bloqueante e que os novos defaults de paralelismo devem ser aplicados desde a 1ª story do Epic 6.
- Linhas 102-123 (Seção 7 — Itens de Ação): 8 itens numerados, agrupados em Processo (1-3), Qualidade (4-5), Técnico/Não-bloqueante (6-7) e Documentação (8); os itens 1, 2, 4 e 8 estão marcados "✅ EXECUTADO nesta retro".
- Linhas 126-136 (Seção 8 — Avaliação de Prontidão): tabela com 5 dimensões (Testes & Qualidade, Deploy, Aceite de stakeholder, Saúde técnica, Bloqueios não resolvidos), todas ✅ com ressalvas ⚠️ não-bloqueantes.
- Linhas 140-160 (Seção 9 — Ações de documentação e configuração executadas): o detalhamento técnico de cada correção real aplicada nesta sessão — a correção da AD-13 em `architecture.md` (3 ocorrências, linhas 703/718/815), a promoção dos defaults de paralelismo em `vitest.config.ts`/`playwright.config.ts` (com validação: `npx vitest run src/shared/hooks/useOnlineStatus.test.ts` passou 3/3), e o apêndice de 2 fatos persistentes no `bmad-dev-story.toml` (validado: TOML parseia, 15 fatos no total).
- Linhas 164-175 (Seção 10 — Encerramento): confirma "Epic Update Required: NÃO", resume commitments (8 itens de ação, 4 executados na própria sessão) e lista os próximos passos, incluindo iniciar a Story 6.1.

**Funcoes, classes e importacoes especificas**

Não aplicável — arquivo é prosa/Markdown, sem código executável.

**Comportamento de libs usadas**

Não aplicável.

---

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Artefato de tracking de sprint em YAML — a fonte única de verdade do estado de cada épico/story do projeto (`development_status`), consumida pelo story-automator e por outras skills BMAD (`bmad-sprint-status`, `bmad-story-automator`) para decidir a próxima ação.

**Funcao geral da alteracao**

Reflete no status global o fechamento do Épico 5 e de sua retrospectiva, consistente com o que `epic-5-retro-2026-07-17.md` conclui.

**Blocos principais**

- Linha 38: `last_updated` muda de `2026-07-17  # Story 5.3 pronta para review` para `2026-07-17  # Epic 5 fechado — retrospectiva concluída` — mesmo dia, comentário atualizado para refletir o marco mais recente.
- Linha 97: `epic-5: in-progress` → `epic-5: done  # 3/3 stories done (5.1–5.3); retrospectiva concluída em 2026-07-17`.
- Linhas 98-100 (inalteradas): as 3 stories individuais (`5-1-caixa-de-entrada...`, `5-2-indicador-persistente...`, `5-3-captura-rapida...`) já estavam `done` antes desta mudança — confirma que o épico só faltava o fechamento formal, não trabalho de story pendente.
- Linha 101: `epic-5-retrospective: optional` → `epic-5-retrospective: done`.

**Funcoes, classes e importacoes especificas**

Não aplicável — arquivo é dado estruturado (YAML), consumido por leitura/parse pelas skills BMAD, não por import de código.

**Comportamento de libs usadas**

Não aplicável (não é consumido por uma lib de terceiros; é lido por skills/orquestrador BMAD como config declarativa).

---

### `_bmad-output/story-automator/orchestration-5-20260716-224123.md`

**Funcao geral do arquivo**

Log/estado de orquestração do story-automator para o Épico 5 — documento de housekeeping do próprio automatizador (front-matter YAML + tabela de progresso por story/etapa + log cronológico em texto). Não é artefato de produto nem de decisão funcional.

**Funcao geral da alteracao**

Registra a conclusão da Story 5.3 e o disparo da retrospectiva; alteração é somente de trilha de auditoria do processo, sem impacto em comportamento de código. Tratada aqui como housekeeping menor, conforme indicado pelo usuário.

**Blocos principais**

- Linha 15: `lastUpdated` avança de `2026-07-17T17:21:52Z` para `2026-07-17T17:37:43Z`.
- Linha 61 (tabela de progresso): a linha da Story 5.3 muda a coluna de review de `-` para `done` e o status geral de `in-progress` para `done`.
- Linhas 104-106 (log): duas novas entradas de timestamp — conclusão da Story 5.3 (commit `bd76754`, report salvo) e o gatilho `"Epic 5: ALL STORIES DONE - triggering retrospective"`.

**Funcoes, classes e importacoes especificas**

Não aplicável.

**Comportamento de libs usadas**

Não aplicável.

## 2. Documentação de arquitetura (reconciliação)

### `_bmad-output/planning-artifacts/architecture.md`

**Funcao geral do arquivo**

Documento de arquitetura de solução do projeto — registra decisões arquiteturais (`AD-xx`) e trade-offs técnicos (`Txx`), incluindo a AD-13 (indicador do Brain Dump como server state derivado via TanStack Query).

**Funcao geral da alteracao**

Corrige uma inconsistência interna do próprio documento: a AD-13 descrevia a chave de query do TanStack Query como `['brainDumpCount', userId]` (forma "plana"), enquanto o código real (`frontend/src/api/keys.ts:7`, confirmado nesta análise) e o próprio §7.1 do documento (linha 1045: `brainDump: { count: (userId) => ['brainDump', 'count', userId] as const }`) já usavam a forma aninhada `['brainDump', 'count', userId]`. As Stories 5.2/5.3 já haviam sinalizado essa divergência em suas Dev Notes, mas resolveram apenas no código, sem propagar a correção ao documento-fonte — é exatamente esse gap que a retrospectiva fecha.

**Blocos principais**

- Linha 703: no texto de justificativa da AD-13 ("Contagem via endpoint dedicado leve `GET /brain-dump/count`"), a chave citada muda de `['brainDumpCount', userId]` para `['brainDump', 'count', userId]`.
- Linha 718: no caso-âncora "Captura no FAB", a mesma correção de chave é aplicada na frase sobre invalidação otimista de cache.
- Linha 815: no resumo do trade-off **T12 — Indicador Técnico do Brain Dump**, a chave citada como parte da resolução em AD-13 recebe a mesma correção.

**Funcoes, classes e importacoes especificas**

Não aplicável a este arquivo isoladamente, mas a correção referencia diretamente o objeto `brainDump.count` exportado por `frontend/src/api/keys.ts` (arquivo não alterado neste conjunto, apenas citado como fonte de verdade): `count: (userId: string) => ['brainDump', 'count', userId] as const`.

**Comportamento de libs usadas**

- TanStack Query (v5): a chave de array (`['brainDump', 'count', userId]`) é o identificador de cache usado por `useQuery`/`queryClient.invalidateQueries` — arrays aninhados por hierarquia (`domínio`, `operação`, `parâmetro`) são a convenção recomendada da lib para permitir invalidação parcial (ex.: invalidar todas as queries de `brainDump` sem especificar `count`). A correção do documento apenas alinha a *descrição* a essa convenção já implementada; não há mudança de comportamento de runtime.

## 3. Guardrails de processo (dev-story)

### `_bmad/custom/bmad-dev-story.toml`

**Funcao geral do arquivo**

Arquivo de override de equipe (TOML) para a skill `bmad-dev-story` — carrega uma lista `persistent_facts` que é injetada como contexto adicional/guardrails em toda execução futura de implementação de story, acumulando lições de retrospectivas anteriores (conforme a memória do projeto: "Ações de retro como persistent_facts do dev-story").

**Funcao geral da alteracao**

Acrescenta (append, não substitui) 2 novos fatos persistentes à lista `persistent_facts`, ambos originados de achados da retrospectiva do Epic 5. O arquivo passa de 13 para 15 fatos, validado como TOML sintaticamente correto na própria retrospectiva.

**Blocos principais**

- Linha 23 (novo fato #14): estende o guardrail pré-existente de "contagem real de testes, nunca de memória" (já presente desde a Retro do Epic 3, linha 10) para cobrir dois casos adicionais: (a) baselines de teste **herdados** de uma story/retro anterior devem ser re-executados no momento da criação da nova story, nunca copiados por confiança; (b) a contagem de testes deve ser colada **depois** de escrito o último teste da story, não antes — origem: a Story 5.3 reportou "604 unit / 11 E2E" quando o real (após um teste de regressão adicionado depois) era "609/12", achado MEDIUM em code review.
- Linha 24 (novo fato #15): guardrail novo sobre `autoFocus` dentro de componentes MUI com `FocusTrap` (`Dialog`, `Drawer`, `SwipeableDrawer`) — `autoFocus` sozinho não foca o campo no browser real porque o `FocusTrap` rouba o foco durante a animação de entrada; o teste unitário em jsdom passa (falso verde, pois jsdom não reproduz a transição/FocusTrap real). A correção recomendada é focar via `inputRef` no callback `onEntered` da transição do MUI, mantendo `autoFocus` apenas como caminho de fallback para o unit test. Origem: Story 5.3, primeiro uso de `SwipeableDrawer` no codebase — o bug real deixava o campo título `inactive` por 10s no Playwright apesar da suíte unitária verde.

**Funcoes, classes e importacoes especificas**

- `persistent_facts` (array TOML de strings, chave sob `[workflow]`): cada string é um fato de guardrail em linguagem natural (pt-BR), consumido pela skill `bmad-dev-story` como contexto adicional injetado no prompt/instruções da próxima execução de story — não há parsing estruturado além de "é uma lista de strings acrescentada aos fatos base".

**Comportamento de libs usadas**

- MUI (`@mui/material`) `Dialog`/`Drawer`/`SwipeableDrawer`: todos usam internamente um componente `FocusTrap` (via `Modal`) que captura o foco do teclado dentro do modal durante e após a transição de entrada, para acessibilidade (usuário de teclado não escapa do modal). Isso implica que `autoFocus` de um input filho, se aplicado antes do `FocusTrap` assumir o controle, pode ser sobrescrito silenciosamente — daí a recomendação de usar o callback `onEntered` da transição MUI (disparado após a animação concluir) para aplicar o foco via `ref` de forma determinística.
- jsdom (ambiente de teste do Vitest): não implementa o ciclo completo de transições/animações do browser real nem o comportamento exato do `FocusTrap`, por isso testes unitários que dependem de `autoFocus` dentro de um modal podem "passar" mesmo quando o comportamento real do browser está quebrado (falso positivo/falso verde).

## 4. Configuração de testes (frontend)

### `frontend/vitest.config.ts`

**Funcao geral do arquivo**

Arquivo de configuração do Vitest (test runner unitário/integração do frontend, ambiente `jsdom`) — define ambiente de teste, arquivo de setup, globals e exclusões de coleta de specs.

**Funcao geral da alteracao**

Promove a mitigação de flakiness de execução paralela de arquivos — até então invocada manualmente via flag de linha de comando (`--no-file-parallelism`) em todas as stories do Epic 11 e do Epic 5 — a configuração **default** do projeto, fechando o item de ação mais antigo em aberto (originado na retro do Epic 4, item #7, reafirmado na retro do Epic 11 item #1, e finalmente executado na retro do Epic 5).

**Blocos principais**

- Linhas 10-15 (comentário novo): documenta o motivo — a suíte é flaky sob paralelismo de arquivos (poluição de estado global / pressão de recursos entre arquivos), com ~2 falhas não-determinísticas por rodada, conjunto variável, todas passando em isolamento; achado MEDIUM pré-existente registrado na review da Story 5.3.
- Linha 16: `fileParallelism: false,` — nova chave de configuração adicionada ao objeto `test`.

**Funcoes, classes e importacoes especificas**

- `defineConfig` (de `vitest/config`, linha 1): helper de tipagem que valida o objeto de configuração passado contra o schema do Vitest; nenhuma mudança na assinatura de uso, apenas mais uma chave no objeto `test`.

**Comportamento de libs usadas**

- Vitest — opção `test.fileParallelism` (default `true` na lib): quando `true`, o Vitest executa arquivos de teste diferentes em processos/workers paralelos para acelerar a suíte; quando `false` (o novo valor aqui), força execução sequencial de arquivos, eliminando condições de corrida entre arquivos ao custo de tempo total de execução maior. A mudança troca velocidade por determinismo, revertendo o comportamento default da lib.

---

### `frontend/playwright.config.ts`

**Funcao geral do arquivo**

Arquivo de configuração do Playwright (E2E de browser real) — define diretório de testes, timeouts, projetos de browser e os `webServer`s (frontend Vite + backend Django) que sobem antes da suíte rodar contra a branch Neon `e2e` dedicada.

**Funcao geral da alteracao**

Mesma motivação do `vitest.config.ts`: promove `--workers=1`, até então invocado manualmente, a configuração default, para eliminar a contenção observada na branch Neon `e2e` (locks órfãos + cold-start) sob execução paralela de workers.

**Blocos principais**

- Linhas 11-15 (comentário novo): documenta a causa raiz (contenção da branch Neon `e2e`) e o histórico do item de ação (retro Epic 4 #7 → Epic 11 #1 → 4º ciclo, agora resolvido na retro do Epic 5).
- Linha 16: `workers: 1,` — nova chave adicionada ao objeto de configuração raiz, logo após `fullyParallel: true` (linha 10, inalterada).

**Funcoes, classes e importacoes especificas**

- `defineConfig` (de `@playwright/test`, linha 1): mesma função de tipagem/validação de config, sem mudança de assinatura.

**Comportamento de libs usadas**

- Playwright — opção `workers` (interage com `fullyParallel: true`, já existente na linha 10): `fullyParallel: true` permite que testes dentro de um mesmo arquivo rodem em paralelo; `workers` controla quantos processos de worker executam em paralelo simultaneamente. Definir `workers: 1` serializa a execução de todos os testes/arquivos em um único processo, mesmo com `fullyParallel: true` mantido — na prática anula o paralelismo real (mantendo a flag semântica ligada, mas limitando a capacidade concorrente a 1), eliminando a contenção de conexões simultâneas contra a branch Neon dedicada.

## Observações finais

- Nenhum arquivo de código de produto (`backend/**/models.py`, `views.py`, `services.py`, `frontend/src/features/**`, etc.) foi alterado neste conjunto — o escopo é 100% processo, documentação e configuração de tooling de teste.
- O arquivo `_bmad-output/story-automator/orchestration-5-20260716-224123.md` foi tratado como housekeeping menor (log de orquestração), conforme indicado, sem análise aprofundada além do resumo acima.
- Nenhum código-fonte foi modificado e nenhum teste foi executado como parte da produção deste relatório.
