# Test Automation Summary — Story 14.5 (Weekly Board e planejamento semanal no sistema novo)

**Workflow:** `bmad-qa-generate-e2e-tests` · **Data:** 2026-07-25 · **Story:** `14-5-weekly-board-e-planejamento-semanal-no-sistema-novo.md` · **Baseline do passo:** 27/27 Playwright (`weekly-board.spec.ts` + `weekly-planning-ritual.spec.ts` + 3 specs de regressão), 1223 Vitest, todos verdes ao fim do `dev-story` · **Framework:** Playwright (E2E) + Vitest (unit), ambos já no projeto

Story **grande** (3 fases: tokens/ícones, Task Row + detalhe canônicos, Weekly Board, ritual de
planejamento) que o `dev-story` já fechou com cobertura densa: 220 testes unitários 100% novos e
2 specs E2E novos (`weekly-board.spec.ts`, `weekly-planning-ritual.spec.ts`, 15 testes) cobrindo
composição/filtros/readonly/estados obrigatórios e o ritual em 5 fontes. Este passo não
reexercitou isso. Procurou o que o `dev-story` **descreveu** na AC mas nunca **provou contra o
browser real** — em particular o `TaskDetailCard` inteiro (AC2), que nasceu nesta story e não
tinha um único E2E abrindo-o.

## Lacunas encontradas e fechadas

### `weekly-board.spec.ts` — 7 → **12** testes (5 novos)

| # | Lacuna | Teste |
|---|---|---|
| 1 | **AC1 "o pool aparece sempre, inclusive vazio"** não tinha um cenário de pool genuinamente vazio — o seed de composição sempre põe 1 item no pool. | Assert de pool vazio+visível movido para o teste de `finalized` (seed sem tarefa no pool) + assert de painel de dia vazio ("Terça") no teste de composição — o par não-vacuoso do painel-com-tarefa já existente. |
| 2 | **AC2 inteiro sem E2E.** `TaskDetailCard` nasceu nesta story (categoria em radiogroup, Eisenhower em 2 checkboxes, footer Salvar/Mover/Cancelar/Excluir, semântica de Enter) e nenhum spec E2E jamais o abria — só unit/jsdom. | `Detalhe da tarefa: categoria e Eisenhower persistem após Salvar` (round-trip contra o backend real) e `Detalhe da tarefa: Cancelar transiciona o status; Excluir remove a linha` |
| 3 | **Task 7 "reordenação relativa dentro do dia"** — no gate de testes da própria Task 7, sem spec E2E algum contra `POST /tasks/{id}/reorder/`. | `reordenação relativa: Mover acima/abaixo trocam irmãos do MESMO dia` |
| 4 | **Navegação de linhagem (AC2)** — seta de `migrated` → sucessor, destaque 2000ms, foco — comportamento de DOM real (`scrollIntoView`, `focus()`, evento customizado) que jsdom não executa de verdade. | `navegação de linhagem: a seta de origem migrada leva ao sucessor, com destaque e foco` |
| 5 | **Matriz status×ciclo, linha `migrated` em `finalized`**: "a seta de linhagem é a única mutação-zero que sobrevive ao readonly" — nenhum teste media isso especificamente. | Assert dedicado no teste de `finalized`, com seed estendido (par migrada/sucessora dentro da semana finalizada) |
| 6 | **`TaskDetailCard` em semana `finalized`** — a Task 12 registra isso como um dos 3 achados reais de produto corrigidos (`readonly` prop), mas o spec de regressão nunca abre o detalhe para provar o footer ausente e os campos desabilitados. | Assert dedicado no teste de `finalized`: `Título`/`Descrição` desabilitados, `Salvar`/`Mover tarefa`/`Cancelar tarefa`/`Excluir tarefa` ausentes, só `Fechar` presente |
| 7 | **Contrato de acessibilidade do dialog nunca auditado.** Nenhum axe scan da story roda com o `TaskDetailCard` aberto. | `axe com o Detalhe da tarefa ABERTO (o dialog precisa de nome acessível — 4.1.2)` |

### `weekly-planning-ritual.spec.ts` — 8 → **11** testes (3 novos)

| # | Lacuna | Teste |
|---|---|---|
| 1 | **`Migrar para <dia>`** (atalho nomeado que preserva o dia de origem) nunca testado — só `Escolher destino…` tinha E2E. | `Migrar para <dia>: atalho de destino nomeado que preserva o dia de origem` |
| 2 | **`Cancelar planejamento`** (AC3, guardrail de UI da lacuna B11) sem nenhuma cobertura E2E. | `Cancelar planejamento remove o alvo quando não há decisão nem tarefa` |
| 3 | **Estado offline do ritual (AC7)** — banner, `aria-disabled` nas ações, clique guardado sem fila local — nunca exercitado contra o browser real (`context.setOffline`, padrão já usado em `shell-bottomnav.spec.ts`/`brain-dump.spec.ts`). | `offline desabilita decisões com motivo; clique fica guardado, sem fila local` |

## Achados

**1 — `TaskDetailCard` sem nome acessível no `role="dialog"` (WCAG 4.1.2, achado REAL de produto).**
`aria-label="Detalhe da tarefa"` estava no `<Dialog>` do MUI, mas o MUI só repassa `aria-label`
(via `...other`) para o `Modal` raiz — o `Paper` interno, que é quem carrega `role="dialog"` de
fato (`role: "dialog"` é fixado no `PaperSlot` em `Dialog.js`), nunca recebia o `aria-label`.
`getByRole('dialog', { name: 'Detalhe da tarefa' })` não resolvia **nunca**; nenhum unit test
(`TaskDetailCard.test.tsx`, 27 testes) tentava essa query, e nenhum axe scan da story abria o
dialog — por isso sobreviveu ao `dev-story` inteiro. **Corrigido**: `aria-label` movido para
`slotProps.paper` (mesmo objeto que já carregava `style`/`sx`). Não-vacuidade: revertida a
correção → as 3 asserções novas de `TaskDetailCard` (que dependem de resolver o `dialog` por
nome) voltaram a falhar por timeout → restaurada → `git diff` limpo, só a posição do
`aria-label` mudou.

**2 — Falso-positivo de `color-contrast` por timing de transição (achado de TESTE, não de produto).**
Um axe scan tirado logo após `toBeVisible()` do dialog aberto mediu o `.MuiDialog-container`
(onde o `Fade` do MUI injeta a opacidade animada — não no `.MuiDialog-paper`, cuja opacidade
própria já reporta `1` desde o primeiro frame) em ~1% de opacidade, fazendo o card inteiro
aparecer translúcido e acusando `color-contrast` em ~11 nós simultaneamente. Reproduzido de
forma determinística em 2 rodadas isoladas (não foi flakiness) e resolvido (0 violações) só
depois de esperar a opacidade do container assentar — confirmado visualmente por screenshot
antes/depois. Corrigido com um helper novo, `waitForDialogSettled` (`shellHelpers.ts`, par de
`waitForSheetSettled`, mesmo padrão `expect.poll`), usado pelo teste de axe novo — sem ele,
qualquer futuro axe scan contra um `<Dialog>` recém-aberto herdaria o mesmo falso-positivo.

**3 — Duas armadilhas de locator no próprio processo de escrita dos specs (autocorrigidas, sem virar achado de produto):** `getByRole('button', { name: 'Pendente' })` sem `exact: true`
colide com o botão "Ver detalhes de **Pendente** na segunda" (a tarefa se chama "Pendente na
segunda" — o título vaza pro nome acessível de outro controle da mesma linha); e clicar um botão
`aria-disabled="true"` (não nativamente `disabled`) trava a actionability do Playwright — o
teste de offline usa `.click({ force: true })` de propósito, para provar que o **próprio
componente** guarda o clique (`if (offline) return`), não o Playwright por ele.

## Provas de não-vacuidade

| # | O quê | Resultado |
|---|---|---|
| (a) | `TaskDetailCard`: `aria-label` revertido para a posição original (`<Dialog aria-label=...>`) | As 3 asserções de `TaskDetailCard.spec` que dependem de `getByRole('dialog', {name:...})` voltam a dar timeout — confirmado, restaurado, `git diff` limpo |
| (b) | `waitForDialogSettled` removido do teste de axe | O mesmo scan volta a acusar `color-contrast` em ~11 nós (reproduzido 2x antes da correção) |
| (c) | Assert de "Cancelada é conteúdo semântico" | Par irmão já presente: o teste também afirma a AUSÊNCIA do botão "Pendente" (`exact: true`) — ambos precisam do estado real pós-transição, não de um assert que passa de qualquer jeito |
| (d) | Seta de linhagem em `finalized` | Testado com o par não-vacuoso: a MESMA seed prova `Reordenar tarefa` AUSENTE (mutação comum) e a seta de linhagem PRESENTE (a exceção) na mesma semana `finalized` |

## Gates

| Gate | Resultado |
|---|---|
| `npx tsc -b --noEmit` (Node 22.15.1) | limpo |
| `npm run lint` (eslint) | limpo |
| `npx vitest run` | **105 arquivos, 1223 testes** — inalterado (nenhum unit test novo neste passo) |
| `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` (branch Neon `e2e`) | limpo (exit 0), confirmado antes de cada rodada de Playwright |
| `CI=1 npx playwright test weekly-board weekly-planning-ritual --retries=0` (isolado) | **23/23 passed** (5.6min) — passou por 3 rodadas até verde (as 2 primeiras revelaram os 2 achados acima) |
| `CI=1 npx playwright test weekly-monthly-task-crud past-period-navigation weekly-monthly-cycle ritual-sources weekly-board weekly-planning-ritual --retries=0` (regressão completa) | **38/38 passed** (10.6min), executado **depois** das duas correções |

**Contagem derivada por contagem literal de `test(` e leitura do arquivo (arquivos novos desta
story, sem baseline em `git diff` — nunca por subtração): `weekly-board.spec.ts` 7→**12**,
`weekly-planning-ritual.spec.ts` 8→**11**. Total nos dois arquivos: 15→**23** (+8 testes novos).

## Cobertura

- **AC2 (Task Row/detalhe canônicos):** categoria (radiogroup), Eisenhower (2 checkboxes),
  Salvar (persistência via round-trip), Cancelar tarefa, Excluir tarefa, navegação de linhagem
  intra-semana (destaque+foco), seta de linhagem sobrevivendo a `finalized` — **agora com E2E
  contra o backend real**, além do unit já existente.
- **AC1:** pool vazio-e-visível e painel de dia vazio-e-visível, provados com pares não-vacuosos.
- **Task 7 (reordenação):** `Mover acima`/`Mover abaixo` contra `POST /tasks/{id}/reorder/` real.
- **AC5 (ritual):** `Migrar para <dia>` (atalho nomeado) e `Cancelar planejamento`.
- **AC7 (estados obrigatórios):** offline do ritual com `context.setOffline`.
- **Acessibilidade:** o `TaskDetailCard` entra no piso de axe sem `exclude:'main'` pela primeira
  vez, e o achado que isso revelou já está corrigido.
- **Sem cobertura, por decisão (fora do escopo desta story):** `Iniciar semana` com os 3 gates
  todos verdes (fluxo positivo completo — só o painel desabilitado tinha E2E); zoom 200%/reflow
  320 do detalhe; paletas Mineral dark e as 3 famílias fora do Mineral (todas fora do escopo
  desta story por decisão prévia, AC7/AD-29).

## Próximos passos

1. Regressão desta story (`weekly-board.spec.ts`, `weekly-planning-ritual.spec.ts`) cresceu de
   15 para 23 testes — considerar o tempo agregado (~5.6min só os dois arquivos) ao escopar
   regressão de stories futuras do Épico 14/17 que tocarem o Weekly Board ou o `TaskDetailCard`.
2. `waitForDialogSettled` (`shellHelpers.ts`) é o padrão a reusar em qualquer story futura que
   rode axe contra um `<Dialog>` do MUI recém-aberto (Monthly/Future/Arquivo, Épico 14/17) —
   sem ele, o mesmo falso-positivo de `color-contrast` se repete.
3. Fluxo positivo de `Iniciar semana` (3 gates verdes, clique habilitado, transição real de
   `planning`→ nenhuma semana em planejamento) fica como lacuna registrada para a primeira story
   que precisar dele diretamente — a seed exigiria manipular a semana-alvo para colidir com a
   semana corrente, escopo maior que uma adição pontual deste passo.
