# Test Automation Summary — Story 14.7 (Future Log no sistema novo — M08)

**Workflow:** `bmad-qa-generate-e2e-tests` · **Data:** 2026-07-26 · **Story:** `14-7-future-log-no-sistema-novo.md` · **Baseline do passo:** `future-log-board.spec.ts` (13 testes) + 3 specs de regressão atualizados + 127 declarações de teste unitário novas do `dev-story`, com os gates da story ainda **não numerados** (`{{VITEST}}`/`{{PYTEST}}`/`{{E2E}}` literais nas Completion Notes) · **Framework:** Playwright (E2E) + Vitest (unit) + pytest (API), todos já no projeto

O `dev-story` entregou cobertura densa e disciplinada (não-vacuidade provada em 5 experimentos,
5 faixas de axe desde o primeiro commit, 3 defeitos de produto achados pelo E2E real). Este passo
**não** reexercitou o que já estava provado: leu cada AC contra o que os testes de fato medem e
atacou (a) contratos que a story exige **nominalmente** e nenhum teste tocava, (b) fiação nova que
só existe nesta superfície, e (c) asserts que **pareciam** provar mas eram estruturalmente vazios.

## Defeito de produto encontrado e corrigido

**`FutureMonthPicker` — o overlay "Ir para mês…" não se expunha como diálogo nomeado.**
`aria-label` estava no componente `<Dialog>`/`<Drawer>` do MUI, que o espalha no root
`role="presentation"` do Modal — **não** no elemento que carrega o papel. Efeito medido: no desktop o
diálogo existia mas **anônimo**; em compact o sheet **não tinha `role="dialog"` nenhum** (só o
`Dialog` põe o papel no paper por conta própria; o `Drawer` não põe). O outro overlay da mesma
superfície (`MonthlyDestinationPicker`, herdado da 14.6) já se expunha como
`role="dialog"` + `aria-label="Escolher destino"` — a divergência entre os dois é que denunciou.
Correção: papel e nome movidos para o slot `paper` nos dois ramos (1 linha cada). Nenhuma mudança
visual, nenhuma mudança de composição.

Por que o axe não pegou: `aria-dialog-name` é regra **best-practice**, fora das tags
`wcag2a/2aa/21a/21aa/22aa` que o `axeHelper` roda — o gate de a11y da story estava correto e ainda
assim não alcançava este caso. Por que os testes não pegaram: o único assert existente era
`page.getByRole('dialog')` **sem nome**, que casa o diálogo anônimo.

## Lacunas encontradas e fechadas

### E2E — `future-log-board.spec.ts` 13 → **14** testes (1 novo + asserts em 2 existentes)

| # | Lacuna | O que passou a existir |
|---|---|---|
| 1 | **AC1: "`shellRouting.ts` passa `planner/future` para `surfaceMigrated: true` (fazendo o `LegacySeamNotice` desaparecer só nessa rota)"** — provado só no unit de `shellRouting.test.ts` (a tabela de rotas), nunca no browser. A tabela estar certa e a faixa sumir são coisas diferentes. | Teste novo `rota migrada: o seam legado some SÓ em /planner/future`, com a **irmã de não-vacuidade** obrigatória: Recorrentes (legada até a 14.8) continua com o seam, e voltar ao Futuro faz sumir de novo. |
| 2 | **AC7: "ativação por `Enter`/`Space`" da seta de linhagem** — nenhum teste, em lugar nenhum, acionava a seta por teclado (todos usavam clique). Um `<div role="button">` passaria em todos os asserts existentes. | Asserts de teclado no teste de linhagem: `seta.press('Enter')` → o sucessor recebe o foco (browser real, onde a semântica nativa do botão é de fato exercida). |
| 3 | **AC2: "`taskCount` conta raízes de qualquer status **para que a contagem do trilho não divirja** da coluna de foco depois de um datear"** — a justificativa estava escrita, o número nunca foi medido depois da mutação. | No mesmo teste de datear: trilho em `3 itens` **antes**, `4 itens` **depois**, `task-row` em 4 e cabeçalho `4 itens · 3 com dia · 1 sem dia` — os três números medidos no mesmo instante contra o backend real. |
| 4 | **AC1/AC7 compact: "sheets contêm foco e devolvem o foco ao acionador"** — o título do teste compact **afirmava** "sheets contêm foco" e o corpo não abria sheet nenhum. Claim vazio. | O teste compact abre "Ir para mês…", confere que é um `dialog` **nomeado**, roda axe com o sheet **aberto**, fecha por `Escape`, e assere foco de volta no acionador + mês em foco inalterado. |

### E2E — `future-log-annual.spec.ts` (asserts, 1 teste)

| # | Lacuna | O que passou a existir |
|---|---|---|
| 5 | **AC6: "alocar um anual atualiza a contagem do trilho — o que só acontece se a invalidação de cache da AC9 estiver correta"**. O assert existente (`a linha do mês aparece no trilho`) é **estruturalmente vazio**: os 8 meses do horizonte são scaffolding e estão sempre lá, com item ou sem. Ele passaria com a invalidação quebrada. | Par `0 itens` (antes do placement) → `1 item` (depois) na MESMA linha do trilho. É o único assert do spec que de fato depende de `usePlaceRecurringTemplateMutation` alcançar `keys.bujo.futureHorizon()`. |

### Vitest — 3 arquivos, **+11** testes

| # | Arquivo | Lacuna | Testes |
|---|---|---|---|
| 6 | `FutureMonthPicker.test.tsx` (4→**7**) | O overlay nunca foi medido como overlay: sem nome acessível, sem papel em compact, sem `Escape`. | `desktop: o overlay é um dialog NOMEADO`; `compact: o sheet é o MESMO dialog nomeado`; `Escape fecha o overlay sem trocar o mês em foco` — os 3 **vermelhos antes da correção** acima. |
| 7 | `TaskRowBase.test.tsx` (40→**42**) | Nenhum teste de teclado no arquivo inteiro, e nenhum assert de que a seta `aria-disabled` **não** age (`aria-disabled` não é `disabled`: o browser ativa o botão normalmente). | `a seta é ALCANÇÁVEL e ACIONÁVEL por teclado — Enter e Space`; `IRMÃ DE NÃO-VACUIDADE: a seta aria-disabled não navega quando acionada`. |
| 8 | `FutureBoardPage.test.tsx` (37→**43**) | Três buracos de integração: (a) o `onMove` do `TaskDetailCard` — cuja fiação é a novidade desta superfície (Questão aberta #6) — só tinha assert de que o **botão existe**; (b) o `handleConfirmAnnualPlacement` (AC6) nunca foi disparado, então o `monthFirst` derivado da data escolhida não era medido; (c) o estado **`local loading`** da AC7 não tinha teste — só o `initial loading`. | `"Mover tarefa" fecha o detalhe e abre o seletor de destino armado no mês em foco`; `mover pelo detalhe migra a MESMA tarefa que estava aberta`; `"Alocar" … coloca no mês DA DATA escolhida`; `IRMÃ de não-vacuidade: sem data, o placement cai no mês do ÂNCORA`; `local loading: trocar de mês afeta SÓ a coluna de foco — o trilho não some`; `"Ir para mês…" abre em SHEET nomeado e devolve o foco ao acionador ao fechar sem navegar`. |

### pytest — `test_views.py` **+1** teste

| # | Lacuna | Teste |
|---|---|---|
| 9 | A mesma divergência trilho × foco da lacuna 3, medida na **API**: nenhum teste exercitava `migrate` + `horizon` + `logs/monthly` no mesmo mês para provar que origem terminal e sucessor são contadas juntas. | `test_get_future_log_horizon_conta_origem_E_sucessor_depois_de_datear` — assere `["pending", "postponed"]` na coluna de foco, `taskCount == 2` no trilho e a igualdade entre os dois. |

## Teste stale consertado (causa raiz da 14.5, tese preservada)

**`shell.spec.ts:137` — "seam legado é persistente, editorial e sem botão de dispensar"** estava
**vermelho desde a Story 14.5** e ninguém tinha notado: a segunda metade do teste navega para outra
rota para provar que o seam **persiste**, e a rota escolhida quando ele nasceu (13.x) era
`Esta Semana` — `surfaceMigrated: true` desde a 14.5, onde o seam some **de propósito**. O comentário
do teste ainda dizia "todas as superfícies ainda legadas nesta story".

Conserto de uma linha, com a tese preservada **literalmente**: o destino passou a ser `Recorrentes`,
que é legada de fato (`surfaceMigrated: false`) até a Story 14.8. Nenhum assert foi enfraquecido, e o
par oposto — o seam **sumir** numa rota migrada — passou a existir em `future-log-board.spec.ts`
usando exatamente esta rota como irmã de não-vacuidade. Verificado por execução isolada: **1 passed**.

## Achado registrado, não consertado (fora de escopo)

**`recurring-soft-delete.spec.ts:266` falha por causa raiz da Story 14.5**, não desta story: o teste
espera a seção de placement de recorrentes em "Esta Semana", que vive em `WeeklyPage.tsx` (legada)
enquanto `planner/week` monta o `WeeklyBoardPage` desde a 14.5. Mesma classe dos 5 vermelhos
conhecidos de `move-task.spec.ts`. Tratamento idêntico ao precedente da 14.6 (que levou achado ALTO
por **deletar** um teste nessa situação): mantido executável, com comentário registrando a causa
raiz. A tese sobre o Future Log — o anual excluído sai de "Anuais pendentes" — está no teste
**anterior** do mesmo arquivo, que a 14.7 atualizou e que **passa**.

## Provas de não-vacuidade (reversão cirúrgica, `git diff` limpo depois de cada uma)

| # | Mutação | Resultado |
|---|---|---|
| (a) | `aria-label` de volta ao componente `<Dialog>`/`<Drawer>` (estado pré-correção) | **3 failed** em `FutureMonthPicker.test.tsx` — o desktop sem nome, o compact sem papel nenhum |
| (b) | `onKeyDown={(e) => e.preventDefault()}` na seta de linhagem (`TaskRowBase.tsx`) — mutação que mata **só** a ativação por teclado, deixando o clique intacto | **1 failed**, exatamente o teste de teclado; os 41 restantes (inclusive os 3 de clique na mesma seta) verdes — isola o mecanismo medido |
| (c) | `disableRestoreFocus` no `Drawer` do `FutureMonthPicker` | **1 failed**, exatamente o teste de devolução de foco ao acionador |

## Gates (re-executados depois da última mudança de código)

| Gate | Resultado |
|---|---|
| `npx tsc -b --noEmit` (Node 22.15.1) | limpo |
| `npm run lint` (eslint) | limpo |
| `npx vitest run` | **121 arquivos, 1542 testes, 0 falhas** |
| `uv run pytest -q` (full-suite, sem escopo) | **1314 passed** |
| `uv run ruff check .` | `All checks passed!` |
| `uv run lint-imports` | `Contracts: 1 kept, 0 broken.` |
| `uv run python manage.py makemigrations --check --dry-run` | `No changes detected` |
| `DJANGO_SETTINGS_MODULE=config.settings.e2e … migrate --check` (branch Neon `e2e`) | limpo (exit 0), antes de cada rodada de Playwright |
| `CI=1 npx playwright test future-log-board.spec.ts` | **14/14 passed** (2.8 min) |
| `CI=1 npx playwright test future-log-annual.spec.ts recurring-soft-delete.spec.ts` | **4 passed / 1 failed** — a falha é a pré-existente da 14.5 documentada acima; `future-log-annual` (o spec desta story) **passou** |
| `CI=1 npx playwright test move-task.spec.ts weekly-board.spec.ts monthly-board.spec.ts weekly-monthly-cycle.spec.ts` | **32 passed / 5 failed** — as 5 falhas são **todas** de `move-task.spec.ts`, pré-existentes desde a 14.5 (confirmado por execução isolada: `move de Este Mês para Futuro` estoura no clique em "Mover tarefa", `move-task.spec.ts:213`, muito antes de qualquer linha desta story). Weekly Board, Monthly Board e o ciclo semanal/mensal **100% verdes** — é a confirmação cross-surface que a AC9 exige para a generalização da seta de linhagem |

| `CI=1 npx playwright test shell-*.spec.ts shell.spec.ts` (AC9: landmark e chrome preservados) | **94 passed / 1 failed / 0 flaky** (10,4 min) na 1ª rodada — a falha era `shell.spec.ts:137`, **vermelha desde a 14.5** (ver seção acima). Consertada; o teste sozinho: **1 passed**. A 2ª rodada da suíte inteira degradou por ambiente (**46,8 min**, 4,5× a 1ª): 82 passed / 9 flaky / 4 failed, **todas** em `shell-keyboard.spec.ts` — arquivo que passou 27/27 na 1ª rodada e passa **27/27 em 2,5 min** re-executado sozinho depois, sem nenhum flaky. Nenhuma mudança desta story toca esse arquivo (worker único, contexto novo por teste), e a mesma flakiness de cold-start da branch Neon `e2e` já está registrada nas retros dos Épicos 4/5/11 |

**Contagem de testes novos, derivada de execução real + contagem literal no `git diff`** (nunca por
subtração isolada): backend **13** `def test_` novos (12 do `dev-story` + 1 deste passo), frontend
**127 declarações** de teste novas (35 em arquivos rastreados + 92 em arquivos novos), das quais
**11** deste passo. O delta de execução do Vitest contra a baseline do commit `0fc9ce6`
(1401 → 1542 = **141**) é maior que 127 porque os dois guardrails `noLiteralTokens.test.ts` geram um
teste **por arquivo-fonte** num laço: uma declaração nova ali vira N testes em tempo de execução.

## Cobertura

- **AC1:** o efeito visível de `surfaceMigrated` (seam) agora tem E2E com irmã não-vacuosa; o sheet
  compact do "Ir para mês…" agora é exercitado (era só afirmado no título do teste).
- **AC2:** a regra de contagem (`raízes de qualquer status`) agora é medida depois de uma mutação
  real, nos dois níveis — API (pytest) e superfície (Playwright).
- **AC4/AC5:** a fiação do `onMove` — a novidade desta superfície frente a Weekly/Monthly — agora
  tem prova de integração, incluindo qual tarefa é migrada.
- **AC6:** o placement anual agora é disparado de verdade (mês derivado da data vs. mês do âncora), e
  a invalidação do trilho tem um assert que pode falhar.
- **AC7:** `local loading`, ativação por teclado da seta, papel/nome dos overlays e devolução de foco
  ao acionador — os quatro estavam nominalmente na AC e sem teste.
- **Sem cobertura, por decisão:** os 3 achados de a11y do `dev-story` (contraste dos botões,
  `role="row"` do `MonthlyDestinationPicker`, colisão de nome acessível) não foram reauditados — já
  têm teste próprio ou gate de axe cobrindo; a Questão aberta #1 (deep-link `?month=`) segue sem
  teste porque segue sem decisão de produto.

## Próximos passos

1. **`aria-dialog-name` fora do gate de axe.** O achado deste passo só apareceu porque um overlay
   irmão fazia diferente. Vale decidir (Épico 15/16) se `axeHelper` passa a rodar também a tag
   `best-practice` nas superfícies novas — hoje um diálogo anônimo passa no gate.
2. **`move-task.spec.ts` está com 5 vermelhos, não 4.** A Questão aberta #6 da story fala em 4; o
   quinto (`mover para Esta semana sem escolher dia`, `:382`) tem a mesma causa raiz de 14.5 (DOM
   legado da `WeeklyPage`) e não estava no comentário do arquivo. Atualizar a contagem quando a
   decisão de produto sobre `onMove` nos boards for tomada.
3. **`recurring-soft-delete.spec.ts:266`** entra na mesma fila: ou a seção de placement volta a
   existir numa superfície nova, ou o teste é reescrito contra a superfície que a hospedar.
