# Checklist de paridade de Hábitos — Épico 16 (Onda 5), Story 16.1

> Fechamento formal da migração de Hábitos para o sistema novo, no molde de
> [`15-brain-dump-parity-checklist.md`](./15-brain-dump-parity-checklist.md):
> cada comportamento **inventariado no legado** aparece com a origem
> `arquivo:linha`, o endereço equivalente na superfície nova e a evidência
> nomeada (`arquivo::teste`) em jsdom e em browser real. As divergências são
> **contratadas** pelo gate de UX 16.0 (aprovado em 2026-08-22) e estão
> isoladas na seção **I** — nenhuma delas é perda silenciosa.
>
> **Escopo:** as três superfícies legado (`/habits` → `HabitsPage` +
> `HabitTracker`, `/habits/history` → `HabitHistoryPage` + `HabitHistory` +
> `HabitHistoryGrid` + `HabitEvolutionChart`, `/settings/habits` →
> `HabitsSettingsPage` + `HabitsManager`) contra a superfície única nova
> (`/habits` → `HabitsRecordPage` + `features/habits/components/record/**`).
>
> **Fora de escopo por decisão de épico:** F10–F12 (bloco de Hábitos no Daily —
> onda da home; `DailyPage.tsx:110` segue montando o `HabitTracker` legado
> intacto), pictograma/`iconKey` e migração do emoji (**Story 16.2**), leituras
> agregadas F13–F15 e agregação server-side da grade (**Story 16.2b**).
>
> **Domínio intocado:** o diff da story não toca `backend/`, `features/habits/api.ts`,
> `api/keys.ts`, `features/habits/types.ts` nem `types.gen.ts` — nenhum endpoint
> novo, nenhuma migration, nenhuma regra de completude reescrita. Os 14 hooks do
> barrel são reusados como estão e `features/habits/api.test.tsx` (457 l.)
> permanece byte-a-byte.

**Legenda das evidências**

- `RecordPage` = `frontend/src/pages/habits/HabitsRecordPage.test.tsx`
- `Primitivos` = `frontend/src/features/habits/components/record/recordPrimitives.test.tsx`
- `Surface` = `frontend/src/features/habits/components/record/habitsSurface.test.ts`
- `Guard` = `frontend/src/features/habits/components/record/noLiteralTokens.test.ts` + `frontend/src/pages/habits/noLiteralTokens.test.ts`
- `Tokens` = `frontend/src/shared/design/tokens.test.ts`
- `e2e-record` = `frontend/e2e/habits-record.spec.ts`
- `e2e-tracker` / `e2e-history` / `e2e-mult` = os três specs legado **ajustados** às rotas e ao markup novos

---

## A. Registro do dia (aba Hoje)

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|---|
| HB-A-01 | Completude do dia vem do **servidor**, nunca recalculada na interface | `HabitTracker.tsx:221-223` | `HabitsTodayPanel.tsx` (`habits-day-percent`) | `RecordPage::mostra a porcentagem do servidor com a barra SEMPRE redundante ao número` | `e2e-record::registro booleano e numérico persistem; nenhum emoji é exibido` (0% → 33% → 60% → 100%, sempre pós-refetch) |
| HB-A-02 | Estado vazio: `Nenhum hábito ativo hoje.` | `HabitTracker.tsx:252-255` | `HabitsTodayPanel.tsx` | `RecordPage::vazio: "Nenhum hábito ativo hoje."` | `e2e-record::sem hábito ativo, a aba Hoje diz a frase honesta e não fabrica porcentagem` |
| HB-A-03 | Uma seção por grupo, na ordem do payload; cabeçalho com nome · % do grupo | `HabitTracker.tsx:170-172,257-259` | `HabitGroupCard.tsx` (Panel por grupo) | `Primitivos::cabeçalho traz nome, peso efetivo somado e a porcentagem em TEXTO ao lado da barra` | `e2e-record::feriado congela o peso, a legenda é factual e o override toca só o dia visível` |
| HB-A-04 | Grupo sem linhas no dia | `HabitTracker.tsx:160-161` (grupo omitido) | `HabitGroupCard.tsx` → `Nenhum hábito neste grupo.` | `RecordPage::grupo sem hábitos diz "Nenhum hábito neste grupo." sem sugerir ação` · `Primitivos::grupo vazio é estado LEGÍTIMO: a frase não sugere ação` | — (estado de dados; coberto em jsdom) |
| HB-A-05 | Booleano alterna `'1'` ⇄ **nulo** (desmarcar apaga, nunca grava 0) | `HabitTracker.tsx:47-49,57-64` | `HabitTrackerRow.tsx::toggleBoolean` | `RecordPage::booleano marcado: PATCH {value:"1"} e a porcentagem NÃO muda antes do refetch` · `RecordPage::booleano desmarcado grava NULO e o estado textual vira "Não feito"` | `e2e-record::registro booleano e numérico persistem…` |
| HB-A-06 | Nulo é apresentado como **"Não feito"** em texto — checkbox nunca é canal único | `HabitTracker.tsx:66-71` (rótulo) | `habitsSurface.ts::rowStateText` + `ItemRowBase` subline com `sublineId` | `Surface::booleano` · `Primitivos::booleano: checkbox interativo nomeado pelo hábito, com o estado TEXTUAL ligado por aria-describedby` | `e2e-record::registro booleano e numérico persistem…` (`Não feito` visível) |
| HB-A-07 | Numérico faz commit no **blur**; valor inalterado **não** dispara requisição; vazio grava nulo | `HabitTracker.tsx:97-101` | `HabitTrackerRow.tsx::commitNumeric` + `habitsSurface.ts::isUnchangedDecimal` | `RecordPage::numérico INALTERADO no blur: NENHUMA requisição` · `RecordPage::numérico vazio grava NULO` · `Surface::valor inalterado é detectado por VALOR, não por string` | `e2e-record::registro booleano e numérico persistem…` |
| HB-A-08 | `Enter` no campo numérico também faz commit | `HabitTracker.tsx:128-130` (blur no Enter) | `HabitTrackerRow.tsx::onKeyDown` | `RecordPage::Enter também faz commit` | — (mesmo caminho de código do blur, exercido em browser) |
| HB-A-09 | Parser decimal aceita **vírgula e ponto** | novo (o legado usava `type=number`, `HabitTracker.tsx:122-131`) | `habitsSurface.ts::parseDecimalInput` | `RecordPage::numérico: o parser aceita vírgula e grava no formato da API` · `RecordPage::numérico: ponto também é aceito` · `Surface::normaliza vírgula para o formato da API` | `e2e-record::registro booleano e numérico persistem…` |
| HB-A-10 | `% da meta` = round(valor/meta×100) | `HabitTracker.tsx:39-45` | `habitsSurface.ts::metaPercent` | `Surface::metaPercent é percentual DA META (peso e bônus não entram)` | `e2e-record::…` (`2.500 / 5.000 passos (50%)`) |
| HB-A-11 | Caption `{valor} / {meta}{unidade} ({percent}%)` em pt-BR | `HabitTracker.tsx:110-115` | `habitsSurface.ts::rowStateText` | `Surface::numérico abaixo da meta lê valor / meta unidade (percentual)` | `e2e-record::…` |
| HB-A-12 | Valor ≥ meta ⇒ **"Meta atingida"** em vez do progresso | `HabitTracker.tsx:91-94,111-112` | `habitsSurface.ts::isMetaReached` + `rowStateText` | `RecordPage::meta atingida: "Meta atingida · …" e o checkbox indicador marca sozinho, disabled` · `Surface::numérico na meta (ou acima) lê "Meta atingida · valor / meta unidade"` | `e2e-record::…` (`Meta atingida · 5.000 / 5.000 passos`, indicador `checked` + `disabled`) |
| HB-A-13 | Erro de gravação por linha, inline, com `role="alert"` e a string `Não foi possível salvar. Tente novamente.` | `HabitTracker.tsx:28,73-77,116-120` | `HabitTrackerRow.tsx::SAVE_ERROR` | `RecordPage::erro de escrita: rollback, alerta inline, valor DIGITADO preservado e retry` (retry nomeado `Tentar de novo`, ver **DIV-HB-11**) | — (falha de rede injetada não é reproduzível no e2e sem mock; contrato coberto em jsdom) |
| HB-A-14 | Otimismo **restrito ao valor da linha** (porcentagem espera o refetch) | `api.ts:212` (`useMarkHabitEntryMutation`, reusado) | idem — hook intocado | `RecordPage::booleano marcado: PATCH {value:"1"} e a porcentagem NÃO muda antes do refetch` | `e2e-record::registro booleano e numérico persistem…` (porcentagem só reconcilia após resposta) |
| HB-A-15 | Alvo de toque mínimo nas linhas | `HabitTracker.tsx:62,104` (`44px` literal) | `--ds-touch-target-min` em `HabitTrackerRow.tsx` | `Guard::HabitTrackerRow.tsx não escreve nenhum dos literais reservados a tokens` · `Tokens::test_habit_tracker_row_bate_com_o_design_md` | — (medição por viewport foi descontinuada desde a retro do Épico 15) |
| HB-A-16 | `aria-label` do input numérico = `Valor de {nome}` | `HabitTracker.tsx:131` | `HabitTrackerRow.tsx` | `Primitivos::numérico: o checkbox é INDICADOR de meta e continua disabled mesmo online` | `e2e-record::registro booleano e numérico persistem…` |
| HB-A-17 | Números formatados em pt-BR | `HabitTracker.tsx:30-36` · `historyUtils.ts:6-10` | `habitsSurface.ts::formatDecimal` (reusa `historyUtils`) | `Surface::formatDecimal — null NÃO vira zero fabricado` | `e2e-record::…` (`2.500 / 5.000`) |
| HB-A-18 | Estado de erro de **leitura** do dia com retry | `HabitTracker.tsx:205-211` (reusava a string de ESCRITA) | `HabitsRecordPage.tsx` → `Não foi possível carregar. Tente novamente.` + `Tentar de novo` | `RecordPage::erro de leitura: alerta + retry que chama refetch` | — (idem HB-A-13) |
| HB-A-19 | **Novo, exigido pelo gate:** denominador nomeado (soma dos pesos efetivos · N de M registros preenchidos) | — (o legado só mostrava a %) | `HabitsTodayPanel.tsx:206-215` | `RecordPage::nomeia o denominador: soma dos pesos efetivos e registros preenchidos` · `Surface::peso efetivo é peso × multiplicador, e a soma é o denominador nomeado` | `e2e-record::histórico é readonly, leva o dia para a aba Hoje…` (mesmo texto no detalhe do dia) |
| HB-A-20 | **Novo, I/O Matrix:** Σ pesos efetivos = 0 ⇒ 0% **por definição do domínio**, com o denominador explicando que nada era exigível | — | `HabitsTodayPanel.tsx` | `RecordPage::Σ pesos efetivos = 0: 0% vem do servidor e o denominador diz que nada era exigível` | `e2e-mult::feriado com multiplicador zero remove o grupo do numerador e do denominador (AC2, AC3)` |
| HB-A-21 | **Novo, exigido pelo gate:** offline — faixa `role="status"` verbatim + controles de escrita `disabled` com motivo acessível | — (`useOnlineStatus` não era usado por nenhum arquivo de habits) | `HabitsRecordPage.tsx` + `HabitTrackerRow.tsx` | `RecordPage::faixa persistente role="status" + controles desabilitados com motivo acessível` · `Primitivos::offline: controles indisponíveis apontando para o motivo, rótulos seguem legíveis` | — (offline não é reproduzível na suíte Playwright deste repo) |
| HB-A-23 | **Novo (passe de review):** o **futuro não é destino** — `Próximo ›` para em hoje com o motivo escrito (`role="note"` + `aria-describedby`), e `changeDate` clampa qualquer chamador. `GET /api/habits/days/?date=` chama `seed_habit_day` sem teto: abrir um dia futuro MATERIALIZARIA linhas com os pesos de hoje congelados, e esse dia contaria como "dia com registro" na grade (5/7 viraria 5/12) | — (defeito introduzido pela navegação nova) | `HabitsTodayPanel.tsx::NO_FUTURE_REASON` + `HabitsRecordPage.tsx::changeDate` | `RecordPage::o futuro não é navegável: "Próximo ›" para em hoje, com o motivo escrito` · `RecordPage::voltando ao passado, "Próximo ›" volta a existir (o teto é hoje, não a navegação)` | — |
| HB-A-24 | **Novo (passe de review):** erro de FORMATO do campo numérico morre ao voltar a digitar (nada de `aria-invalid` sobre texto já corrigido) | — | `HabitTrackerRow.tsx::onChange` | `Primitivos::voltar a digitar LIMPA o erro de formato (nada de aria-invalid sobre texto novo)` | — |
| HB-A-22 | **Novo, exigido pelo gate:** loading é skeleton com a **geometria final**, `aria-busy`, sem porcentagem provisória | `HabitTracker.tsx:197-203` (era texto `Carregando hábitos…`) — ver **DIV-HB-01** | `HabitsSkeleton.tsx` | `RecordPage::loading: skeleton com a geometria final e SEM porcentagem provisória` | — |

## B. Multiplicador por tipo de dia, feriado e override

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|---|
| HB-B-01 | Rótulos factuais do tipo de dia: `Dia útil` / `Fim de semana` / `Feriado` | `HabitTracker.tsx:21-25` · `historyUtils.ts:26-30` | `historyUtils.ts::DAY_TYPE_LABEL` (reusado, **não duplicado**) | `RecordPage::mostra data por extenso, chip de tipo de dia e a navegação de data` | `e2e-record::feriado congela o peso…` |
| HB-B-02 | Marcar/desmarcar o dia como feriado (`POST /api/habits/holidays/`); a UI **refetcha**, nunca recalcula | `HabitTracker.tsx:224-235` | `HabitsTodayPanel.tsx` (checkbox `Marcar este dia como feriado`) | `RecordPage::marcar feriado chama POST /api/habits/holidays/ (a UI refetcha, não recalcula)` | `e2e-record::feriado congela o peso…` (75% → 38% pelo servidor) · `e2e-mult::feriado congela peso efetivo, exibe legenda factual e o override não sangra (AC1, AC2, AC3)` |
| HB-B-03 | Precedência declarada: feriado > fim de semana > dia útil | `HabitsManager.tsx:172-186` (implícita) | `HabitsConfigPanel.tsx::MULTIPLIER_PRECEDENCE` (texto explícito) + texto de precedência na aba Hoje | `RecordPage::a precedência é declarada no próprio bloco de multiplicadores` | `e2e-record::configuração: identidade × versionado, desativar/reativar e multiplicadores` |
| HB-B-04 | Legenda de peso só com dia ≠ útil **E** multiplicador ≠ 1 | `HabitTracker.tsx:164-167` | `HabitGroupCard.tsx::showLegend` | `RecordPage::legenda do grupo só aparece com dia≠útil E multiplicador≠1, com os fatores na linha` · `RecordPage::multiplicador 1 em dia não-útil NÃO mostra legenda` · `Primitivos::legenda de multiplicador só com dia ≠ útil E multiplicador ≠ 1` | `e2e-record::feriado congela o peso…` (`Feriado · peso ×0,2 neste grupo`; legenda ausente antes e depois do override) |
| HB-B-05 | Texto da legenda: `{tipo do dia} · peso ×{multiplicador}` (+ `neste grupo`) | `HabitTracker.tsx:174-179` | `HabitGroupCard.tsx` | idem HB-B-04 | `e2e-record::feriado congela o peso…` |
| HB-B-06 | Fatores congelados visíveis na linha (`Peso 3 × 0,5 = 1,5`, inteiro sem fração) | novo, exigido pelo gate (o legado só mostrava o peso no resumo da Configuração, `HabitsManager.tsx:141-145`) | `habitsSurface.ts::formatFrozenFactors` | `Surface::multiplicador ≠ 1 mostra os fatores separados e o produto` · `Surface::multiplicador 1 (ou ausente) mostra só o peso, inteiro sem fração` · `Primitivos::os fatores congelados aparecem separados quando o multiplicador ≠ 1` | `e2e-record::feriado congela o peso…` (`Peso 2 × 0,2 = 0,4`) |
| HB-B-07 | Override avulso só existe quando o dia **não** é útil | `HabitTracker.tsx:236-245` | `HabitsTodayPanel.tsx` | `RecordPage::override avulso só existe quando o dia NÃO é útil e toca só as linhas do dia` | `e2e-record::feriado congela o peso…` |
| HB-B-08 | Rótulo verbatim `Tratar este dia como dia útil (peso cheio)` | `HabitTracker.tsx:242-244` | `HabitsTodayPanel.tsx` | idem HB-B-07 | `e2e-record::feriado congela o peso…` |
| HB-B-09 | Override = N `PATCH` com `multiplierAtTime:'1.00'` nas linhas **do dia visível**; a configuração dos grupos fica intocada | `HabitTracker.tsx:240` + `api.ts:308` (`useOverrideDayWorkdayMutation`, reusado) | idem — hook intocado | `RecordPage::override avulso só existe quando o dia NÃO é útil e toca só as linhas do dia` | `e2e-record::feriado congela o peso…` (38% → 75%) · `e2e-mult::…o override não sangra (AC1, AC2, AC3)` |
| HB-B-10 | Override `disabled` durante a mutação / sem entries | `HabitTracker.tsx:241` | `HabitsTodayPanel.tsx` | coberto pelo mesmo teste de HB-B-07 (botão ausente sem entries) | `e2e-record::feriado congela o peso…` |
| HB-B-11 | Erro de feriado/override com `role="alert"` e retry, sem alterar a porcentagem | `HabitTracker.tsx:246-250` | `HabitsTodayPanel.tsx` | `RecordPage::erro de leitura: alerta + retry que chama refetch` (mesmo mecanismo de bloco) | — |
| HB-B-12 | Dia passado abre com os pesos, meta e multiplicador congelados **daquele** dia; sem limite de retroatividade | `HabitTracker.tsx:143-150` (mutation por data) | `HabitsTodayPanel.tsx` (navegação `‹ Anterior · Hoje · Próximo ›`) | `RecordPage::dia passado: a navegação de data busca aquele dia, com os pesos congelados DELE` | `e2e-record::dia passado é editável com os pesos congelados dele (sem limite de retroatividade)` |

| HB-B-13 | **Novo (passe de review):** falha de escrita de **feriado** e de **override** tem `role="alert"` + retry da MESMA escrita, e a porcentagem não se move (coluna *Error Handling* da I/O Matrix, antes sem teste) | `HabitTracker.tsx:246-250` | `HabitsTodayPanel.tsx::writeError` | `RecordPage::feriado que FALHA: alerta + retry da MESMA escrita, sem mexer na porcentagem` · `RecordPage::override que FALHA: erro agregado + retry das MESMAS linhas` | — |

## C. Configuração (aba Configuração)

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|---|
| HB-C-01 | Aviso de vigência prospectiva verbatim `Alteração válida a partir de hoje. Registros anteriores preservados.` | `HabitsManager.tsx:31-32,97,215,226` (tooltip) | `HabitsConfigPanel.tsx` — **texto persistente**, ver **DIV-HB-03** | `RecordPage::o aviso de vigência é TEXTO persistente, nunca tooltip` | `e2e-record::configuração: identidade × versionado…` |
| HB-C-02 | Criar grupo (nome trimado, vazio não submete, campo limpo no sucesso) | `HabitsManager.tsx:295-300,338-352` | `HabitsConfigPanel.tsx` (`Adicionar grupo` / `Nome do grupo`) | `RecordPage::criar grupo envia o nome TRIMADO e limpa o campo no sucesso` · `RecordPage::criar grupo com nome vazio NÃO submete` (mesmo bloco) | `e2e-record::configuração: identidade × versionado…` |
| HB-C-03 | Erro de criação de grupo com `role="alert"` | `HabitsManager.tsx:353-357` | `HabitsConfigPanel.tsx` | `RecordPage::falha do bloco de multiplicador NÃO derruba a lista de hábitos` (mesmo padrão de erro por bloco) | — |
| HB-C-04 | `Mostrar inativos` alterna `includeInactive` na query | `HabitsManager.tsx:275-276,362-371` | `HabitsConfigPanel.tsx::SHOW_INACTIVE` | `RecordPage::"Mostrar inativos" refaz a consulta com includeInactive` | `e2e-record::configuração: identidade × versionado…` |
| HB-C-05 | Sem grupos: `Crie um grupo para começar a adicionar hábitos.` **e** criação indisponível com o motivo ligado por `aria-describedby` | `HabitsManager.tsx:374-377,418,472-479` | `HabitsConfigPanel.tsx::NO_GROUP_REASON` + `role="note"` | `RecordPage::sem grupo cadastrado: campos e botão indisponíveis com o motivo em role="note"` | `e2e-record::sem grupo cadastrado, criar hábito fica indisponível com o motivo escrito` (`role="note"` + `aria-describedby` conferidos) |
| HB-C-06 | Cabeçalho por grupo | `HabitsManager.tsx:258-260` | `HabitsConfigPanel.tsx` | `RecordPage::grupo sem hábitos diz "Nenhum hábito neste grupo." sem sugerir ação` | `e2e-record::configuração: identidade × versionado…` |
| HB-C-07 | `Nenhum hábito neste grupo.` (grupo vazio é estado legítimo) | `HabitsManager.tsx:262-265` | `HabitsConfigPanel.tsx::EMPTY_GROUP` | `RecordPage::grupo sem hábitos diz "Nenhum hábito neste grupo." sem sugerir ação` | — |
| HB-C-08 | Bloco de multiplicadores só monta com a config carregada e **remonta** ao trocar de grupo/valores | `HabitsManager.tsx:172-186` (`key` de remount) | `HabitsConfigPanel.tsx` (`GroupMultiplierBlock` com `key`) | `RecordPage::multiplicador vazio salva 1,00 (nunca null) e o placeholder é 1,00` | `e2e-record::configuração: identidade × versionado…` (recarga confirma persistência) |
| HB-C-09 | Campos `Fim de semana ×` / `Feriado ×` com `aria-label` `Multiplicador de … de {grupo}` | `HabitsManager.tsx:215-236` | `HabitsConfigPanel.tsx` | `RecordPage::multiplicador vazio salva 1,00 (nunca null)…` | `e2e-record::configuração: identidade × versionado…` (`Multiplicador de feriado de Saúde`) |
| HB-C-10 | Campo vazio ⇒ a leitura volta a **1,00** (placeholder `1,00`; dia útil nunca é armazenado). **O mecanismo é enviar `1.00`, não `null`** — `SetGroupMultipliersSerializer.validate` rejeita (400) os dois campos nulos e o `PUT` ignora o nulo isolado, então `null` dava 400 no grupo sem config (estado mais comum) e silenciosamente NÃO removia quando só um campo era limpo | `HabitsManager.tsx:203-209` | `HabitsConfigPanel.tsx::NEUTRAL_MULTIPLIER` | `RecordPage::multiplicador vazio salva 1,00 (nunca null) e o placeholder é 1,00` · `RecordPage::grupo sem config nenhuma (dois campos vazios) ainda envia um corpo válido` | `e2e-record::configuração: identidade × versionado…` (`placeholder=1,00`, valor `0,2` persiste após reload) · `e2e-mult::config prospectiva do multiplicador de grupo persiste (AC1)` |
| HB-C-11 | Erro do bloco de multiplicadores não derruba a lista de hábitos | `HabitsManager.tsx:240-244` | `HabitsConfigPanel.tsx` (erro + retry por bloco) | `RecordPage::falha do bloco de multiplicador NÃO derruba a lista de hábitos` | — |
| HB-C-12 | Resumo read-only do hábito (`Peso · Meta · Bônus`, meta/bônus só no numérico) | `HabitsManager.tsx:141-145` | `HabitsConfigPanel.tsx` | `RecordPage::editar abre UM bloco por vez, separando Identidade de Versionado` | `e2e-record::configuração: identidade × versionado…` (`Peso 4` após salvar) |
| HB-C-13 | Edição inline **um por vez** | `HabitsManager.tsx:153-157` (`Editar peso`) | `HabitsConfigPanel.tsx` (`Editar {nome}`) | `RecordPage::editar abre UM bloco por vez, separando Identidade de Versionado` | `e2e-record::configuração: identidade × versionado…` |
| HB-C-14 | **Um formulário, duas mutações:** versionado (peso/meta/bônus) por `useAddHabitVersionMutation`; identidade (unidade, e agora nome/grupo) por `useUpdateHabitIdentityMutation` | `HabitsManager.tsx:56-70` | `HabitsConfigPanel.tsx` | `RecordPage::salvar dispara DUAS mutações distintas: versão (peso) e identidade (nome)` · `RecordPage::só o lado que mudou é enviado (nome intocado ⇒ nenhum PATCH de identidade)` · `RecordPage::mudança só de IDENTIDADE não abre versão (espelho do teste do peso)` · `RecordPage::peso reescrito com o MESMO valor (3 vs 3,00) não abre versão` | `e2e-record::configuração: identidade × versionado…` |
| HB-C-15 | Salvar exige peso não-vazio e **fecha a edição no sucesso**; em falha o bloco permanece aberto com o que foi digitado | `HabitsManager.tsx:56-66,136-138` | `HabitsConfigPanel.tsx::handleSave` (`mutateAsync` → `onClose`) | `RecordPage::salvar com sucesso FECHA o bloco de edição (paridade HabitsManager.tsx:136-138)` · `RecordPage::salvar que FALHA mantém o bloco aberto com o valor digitado e o alerta` | `e2e-record::configuração: identidade × versionado…` |
| HB-C-16 | **Cancelar edição** não toca o servidor | novo, exigido pelo gate (o legado só tinha o toggle de `Editar peso`) | `HabitsConfigPanel.tsx` | `RecordPage::"Cancelar edição" fecha sem tocar o servidor` | — |
| HB-C-17 | Excluir **não existe**; a ação é desativar/reativar por nova versão | `HabitsManager.tsx:73-75,158-160` | `HabitsConfigPanel.tsx` (`Desativar hábito` / `Reativar hábito`) | `RecordPage::excluir NÃO existe; desativar/reativar nomeiam a consequência e abrem versão` | `e2e-record::configuração: identidade × versionado…` (nenhum botão `Excluir`; desativar + reativar exercidos) |
| HB-C-18 | Hábito inativo é distinguido **sem depender de cor/opacidade** | `HabitsManager.tsx:86,93` (opacidade 0.6 + sufixo ` (inativo)`) | `ItemRowBase` (`statusChipLabel` + `deemphasized`) → chip textual `Inativo` + `--ds-task-row-terminal-opacity` | `RecordPage::hábito inativo combina chip textual "Inativo" com a data de inativação` | `e2e-record::configuração: identidade × versionado…` (`habit-inactive-chip` = `Inativo`) |
| HB-C-19 | Erro de nova versão com `role="alert"` na linha | `HabitsManager.tsx:147-151` | `HabitsConfigPanel.tsx::SAVE_ERROR` | `RecordPage::falha do bloco de multiplicador NÃO derruba a lista de hábitos` (mesmo padrão) | — |
| HB-C-20 | Criação de hábito com Nome, Grupo, Tipo e Peso inicial obrigatórios | `HabitsManager.tsx:304-305,384-441` | `HabitsConfigPanel.tsx` (`Adicionar hábito`) | `RecordPage::criação: tipo em radiogroup imutável e campos numéricos condicionais` | `e2e-record::sem grupo cadastrado, criar hábito fica indisponível com o motivo escrito` |
| HB-C-21 | Select de grupo com placeholder desabilitado e select desabilitado sem grupos | `HabitsManager.tsx:403-420` | `HabitsConfigPanel.tsx` (`Selecione um grupo` / `Nenhum grupo cadastrado`) | `RecordPage::sem grupo cadastrado: campos e botão indisponíveis com o motivo em role="note"` | `e2e-record::sem grupo cadastrado…` |
| HB-C-22 | Tipo do hábito é escolha **imutável** na criação | `HabitsManager.tsx:421-433` (`ToggleButtonGroup` exclusivo) | `HabitsConfigPanel.tsx` — `role="radiogroup"` `Tipo do hábito` | `RecordPage::criação: tipo em radiogroup imutável e campos numéricos condicionais` | — |
| HB-C-23 | Meta, Bônus (%) e Unidade só no tipo numérico | `HabitsManager.tsx:443-471` | `HabitsConfigPanel.tsx` | `RecordPage::criação: tipo em radiogroup imutável e campos numéricos condicionais` | — |
| HB-C-24 | Sucesso da criação reseta o formulário | `HabitsManager.tsx:322-330` | `HabitsConfigPanel.tsx` | `RecordPage::criar hábito NÃO envia emoticon (o emoji saiu da interface)` (mesmo submit) | — |
| HB-C-25 | Rótulos de tipo `Booleano` / `Numérico` | `HabitsManager.tsx:35-38` | `HabitsConfigPanel.tsx::HABIT_TYPE_LABEL` | `RecordPage::criação: tipo em radiogroup imutável e campos numéricos condicionais` | — |

| HB-C-26 | **Novo (passe de review):** falha de `Desativar hábito`/`Reativar hábito` deixa de ser MUDA — `role="alert"` + retry no nível do painel, como toda outra escrita da superfície (só `isPending` era consumido) | — | `HabitsConfigPanel.tsx` (`habit-activation-error`) | `RecordPage::desativar que FALHA mostra alerta + retry que reenvia a MESMA escrita` | — |
| HB-C-27 | **Novo (passe de review):** alternar `Mostrar inativos` NÃO desmonta um bloco de edição aberto (a troca da chave da query fazia o skeleton substituir o painel inteiro e jogar fora o que estava digitado) | — | `HabitsConfigPanel.tsx` (memória da última lista conhecida, sem tocar `api.ts`) | `RecordPage::"Mostrar inativos" NÃO desmonta o bloco de edição aberto (nem perde o digitado)` | — |
| HB-C-28 | **Novo (passe de review):** offline desabilita **toda** escrita da Configuração (`Adicionar hábito`, `Adicionar grupo`, `Salvar multiplicadores`, `Salvar alterações`, `Desativar hábito …`) com `aria-describedby` na faixa; rótulos seguem legíveis | — | `HabitsConfigPanel.tsx` | `RecordPage::offline: toda escrita da Configuração fica indisponível apontando para a faixa` | — |

## D. Histórico — intervalo e detalhe do dia

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|---|
| HB-D-01 | Intervalo default = últimos 30 dias inclusive (`DEFAULT_SPAN = 29`) | `HabitHistory.tsx:14,39-42` | `HabitsHistoryPanel.tsx` (`DEFAULT_SPAN` reusado) | `RecordPage::período sem nenhum hábito: "Nenhum registro no período."` (mesma janela) | `e2e-history::navegação por data read-only: dia com registro mostra %/valores; dia-lacuna é honesto (AC1, AC3, AC4)` |
| HB-D-02 | Aritmética de data **local**, por split de string (sem desvio de fuso) | `HabitHistory.tsx:16-37` · `historyUtils.ts:15-23` | `habitsSurface.ts::isoLocalToday/addDays/clampDate/formatDate*` | `Surface::formata por extenso a partir do split da string` · `Surface::addDays/clampDate operam em calendário local` · `Surface::isoLocalToday nunca usa UTC (23h local não vira o dia seguinte)` | `e2e-record::dia passado é editável…` |
| HB-D-03 | `‹ Período anterior` / `Próximo período ›` deslocam o intervalo em 30 dias | `HabitHistory.tsx:114-120,142-144,161-163` | `HabitsHistoryPanel.tsx::shiftPeriod` | coberto pelo render do bloco de intervalo em `RecordPage::é somente leitura: nenhum controle de escrita de registro na superfície` | `e2e-history::…` |
| HB-D-04 | Data selecionada é **reancorada** ao intervalo (clamp com `min`/`max`) | `HabitHistory.tsx:108-112,186-202` | `HabitsHistoryPanel.tsx` (`Dia em detalhe`, `clampDate`) | `Surface::addDays/clampDate operam em calendário local` | `e2e-record::histórico é readonly, leva o dia para a aba Hoje…` |
| HB-D-13 | **Novo (passe de review):** o intervalo não avança para o futuro — `shiftPeriod(1)` clampa o fim em hoje e `Próximo período ›` fica `disabled` no período mais recente, com o motivo escrito | — | `HabitsHistoryPanel.tsx::LATEST_PERIOD_NOTE` + `updateRange`/`shiftPeriod` (teto em `minDate`) | `RecordPage::o intervalo não avança para o futuro: "Próximo período ›" para no período mais recente` · `Surface::devolve a menor das duas datas ISO, comparando como string` | — |
| HB-D-05 | Erro de leitura do histórico com retry | `HabitHistory.tsx:170-173` | `HabitsHistoryPanel.tsx::BlockError` | `RecordPage::falha parcial: a série falha e a GRADE carrega íntegra` | — |
| HB-D-06 | Cabeçalho do dia selecionado | `HabitHistory.tsx:211-213` (DD/MM/AAAA) | `HabitsHistoryPanel.tsx::DayDetail` (data por extenso) | `RecordPage::"Abrir este dia para edição" ativa a aba Hoje com a data selecionada` | `e2e-record::histórico é readonly…` |
| HB-D-07 | Dia-lacuna: `Sem registro neste dia.` + nota de que nenhuma linha foi materializada; **nenhuma porcentagem** | `HabitHistory.tsx:60-67` | `HabitCompletionGrid.tsx::NO_RECORD_DAY` + `HabitsHistoryPanel.tsx::NO_RECORD_DAY_NOTE` | `RecordPage::dia-lacuna: "Sem registro neste dia." + a nota, e NENHUMA porcentagem` | `e2e-record::histórico é readonly…` · `e2e-history::navegação por data read-only…` |
| HB-D-08 | Resumo do dia com completude e tipo de dia | `HabitHistory.tsx:70-73` | `HabitsHistoryPanel.tsx::DayDetail` (+ denominador nomeado) | `RecordPage::"Abrir este dia para edição" ativa a aba Hoje com a data selecionada` | `e2e-record::histórico é readonly…` (`completude 60%`) |
| HB-D-09 | Grupos com `{nome} · {completion}%`; grupo sem linhas omitido | `HabitHistory.tsx:74-81` | `HabitsHistoryPanel.tsx::DayDetail` | idem HB-D-08 | `e2e-record::histórico é readonly…` |
| HB-D-10 | Leitura read-only por linha (booleano feito/não feito; numérico valor/meta) | `HabitHistory.tsx:45-52,82-92` | `habitsSurface.ts::rowStateText` (mesma função da aba Hoje) | `Surface::booleano` · `Surface::numérico abaixo da meta lê valor / meta unidade (percentual)` | `e2e-record::histórico é readonly…` |
| HB-D-11 | Aba Histórico **não tem nenhum controle de escrita**; a única saída é levar o dia para a aba Hoje | `HabitHistory.tsx` (superfície inteira readonly) | `HabitsHistoryPanel.tsx::OPEN_FOR_EDIT` | `RecordPage::é somente leitura: nenhum controle de escrita de registro na superfície` · `RecordPage::"Abrir este dia para edição" ativa a aba Hoje com a data selecionada` | `e2e-record::histórico é readonly, leva o dia para a aba Hoje e traz grade + tabela equivalente` |
| HB-D-12 | Readonly em **contraste normal** (readonly nunca parece disabled) | `HabitHistory.tsx` | `HabitsHistoryPanel.tsx` (tokens de ink normais) | `Guard::HabitsHistoryPanel.tsx não escreve cor hexadecimal literal` | — |

## E. Grade de completude

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|---|
| HB-E-01 | Tabela **semântica** com `caption` | `HabitHistoryGrid.tsx:131-134` | `HabitCompletionGrid.tsx` (caption reescrito para a leitura semanal) | `RecordPage::a grade traz caption, th scope, tags de tipo de dia e a tabela equivalente` | `e2e-record::histórico é readonly…` (`Completude por hábito e semana`) · `e2e-history::grade acessível hábitos × dias: tabela com feriado rotulado e lacuna honesta (AC1, AC3, UX-DR4)` |
| HB-E-02 | `th scope="col"` na coluna e `th scope="row"` na linha | `HabitHistoryGrid.tsx:137-187` | `HabitCompletionGrid.tsx` | `RecordPage::a grade traz caption, th scope, tags de tipo de dia e a tabela equivalente` | `e2e-record::histórico é readonly…` (`rowheader` do hábito) |
| HB-E-03 | Tags **textuais** de ritmo `FDS` / `FER` — nunca só cor | `HabitHistoryGrid.tsx:42-46,159-163` | `HabitCompletionGrid.tsx` | `RecordPage::a grade traz caption, th scope, tags de tipo de dia e a tabela equivalente` | `e2e-history::grade acessível hábitos × dias…` |
| HB-E-04 | Célula sem registro é honesta (`—`), nunca 0% fabricado | `HabitHistoryGrid.tsx:25-39` | `habitsSurface.ts` + `HabitCompletionGrid.tsx` (célula tracejada) | `Surface::período sem nenhuma linha é travessão, nunca 0% fabricado` · `Surface::numérico sem meta E sem valor nenhum continua sendo "sem registro"` | `e2e-history::grade acessível hábitos × dias…` |
| HB-E-05 | **Toda** célula com registro tem número — célula sem número é bug, não variante | `HabitHistoryGrid.tsx:188-208` (glifo + `aria-label`) | `habitsSurface.ts` + `HabitCompletionGrid.tsx` | `Surface::toda célula com registro TEM número (célula sem número é bug, não variante)` · `Surface::numérico SEM meta congelada ainda mostra número (média dos valores), sem inventar razão` · `RecordPage::a grade lê o CONTEÚDO de cada célula: 5/7 booleano, 75% numérico, "—" na semana sem linha` | `e2e-record::histórico é readonly…` (loop sobre todas as células, nenhuma vazia) |
| HB-E-06 | Vazio: `Nenhum registro no período.` | `HabitHistoryGrid.tsx:75-81,91-94` | `HabitCompletionGrid.tsx::EMPTY_RANGE` | `RecordPage::período sem nenhum hábito: "Nenhum registro no período."` | `e2e-history::sem hábitos: o histórico mostra período vazio honesto e é alcançado por aba (AC1, AC3, AC4)` |
| HB-E-07 | Recomposição no compact: lista por dia **com uma linha POR HÁBITO**, sem scroll horizontal | `HabitHistoryGrid.tsx:72,86-118` | `HabitCompletionGrid.tsx` (agregado do dia + `<ul>` por hábito via `compactReading`, espelhando `cellState` do legado; chip `Inativo` preservado) | `RecordPage::no compact a grade vira lista por dia (sem scroll horizontal)` · `RecordPage::compact mantém a leitura POR HÁBITO (recomposição, não compressão)` | — (recomposição por faixa verificada em jsdom; matriz por viewport descontinuada) |
| HB-E-10 | **Novo (ciclo de review 1):** o cabeçalho da coluna da grade conta dias **com registro**, não dias corridos. Contar dias corridos punha "7 dias" sobre células "2/3" — exatamente a leitura errada que o rótulo existe para evitar (`GridCell.daysWithRecord` já existia e não era usado no cabeçalho) | — | `HabitCompletionGrid.tsx` (filtro por `entries.length > 0`) | `RecordPage::cabeçalho da coluna da grade conta dias COM REGISTRO, não dias corridos` (sensibilidade confirmada por sabotagem) | — |
| HB-E-08 | Escala **contínua** de tom por `color-mix` sobre `--ds-primary`/`--ds-surface` com `--p` = completude da célula | novo, verbatim do mockup (`key-habitos.html:220-222`) — o legado usava ✓/— (ver **DIV-HB-04**) | `HabitCompletionGrid.tsx` | `Guard::HabitCompletionGrid deriva a cor da célula por color-mix sobre os tokens` | `e2e-record::histórico é readonly…` |
| HB-E-09 | Booleano pinta a **razão real** (`5/7` → 71%), nunca o numerador | novo, exigido pelo gate | `habitsSurface.ts` | `Surface::booleano mostra feitos sobre dias com registro e pinta a razão, não o numerador` | — |
| HB-E-10 | Numérico agrega pela média do percentual da meta dos dias **medidos** (dia sem medição fora do denominador) | novo, exigido pelo gate | `habitsSurface.ts` | `Surface::numérico mostra a média do percentual da meta dos dias medidos` | — |
| HB-E-11 | Buckets **semanais fixos** (segunda→domingo); semana parcial das pontas é bucket próprio e a coluna rotula os **dias reais** | novo, exigido pelo gate (sem alternador semana/quinzena) | `habitsSurface.ts::weeklyBuckets` | `Surface::mondayOf ancora a semana na segunda` · `Surface::a semana parcial das pontas é um bucket próprio` · `Surface::a coluna rotula os DIAS REAIS (para que "2/3" não seja lido contra 7)` | `e2e-record::histórico é readonly…` |
| HB-E-12 | **Tabela equivalente** da grade, em `details`, na mesma superfície e em contraste normal — é o que sustenta a exceção de contraste das células | novo, exigido pelo gate | `HabitCompletionGrid.tsx` | `RecordPage::a grade traz caption, th scope, tags de tipo de dia e a tabela equivalente` | `e2e-record::histórico é readonly…` (`Mesma leitura em formato linear`) |

## F. Gráfico de evolução

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|---|
| HB-F-01 | Série só é buscada com hábito selecionado (`enabled:false` sem seleção) e a frase `Selecione um hábito para ver o gráfico de evolução.` | `HabitHistory.tsx:219-242` · `api.ts:93-98` | `HabitsHistoryPanel.tsx::NO_HABIT_SELECTED` | `RecordPage::sem hábito selecionado, NADA é buscado para a série` | `e2e-history::gráfico de evolução: série on-read + marcador de mudança real + sombreamento de ritmo (AC2, AC3)` |
| HB-F-02 | Eixo **único**, `connectNulls={false}`, lacuna não fabrica 0 | `HabitEvolutionChart.tsx:109-128,163-205` | `HabitEvolutionChart.tsx` (reusado; só literais → tokens) | `HabitEvolutionChart.test.tsx` (85 l., preservado) | `e2e-history::gráfico de evolução…` |
| HB-F-03 | Faixas de ritmo (`ReferenceArea`) para blocos contíguos de dias não úteis + legenda textual | `HabitEvolutionChart.tsx:131-139,177-185,234-238` | idem | `HabitEvolutionChart.test.tsx` | `e2e-history::gráfico de evolução…` |
| HB-F-04 | Eventos de versão como `ReferenceLine` **e** lista textual `Mudanças no período` | `HabitEvolutionChart.tsx:186-193,219-232` | idem | `HabitEvolutionChart.test.tsx` | `e2e-history::gráfico de evolução…` |
| HB-F-05 | `figure` + `role="img"` com resumo no nome acessível, repetido em `figcaption` | `HabitEvolutionChart.tsx:141-155,209-216` | idem | `HabitEvolutionChart.test.tsx` | `e2e-history::gráfico de evolução…` |
| HB-F-06 | Tooltip com data completa, valor+unidade ou `Sem registro`, tipo do dia e a mudança | `HabitEvolutionChart.tsx:51-84` | idem | `HabitEvolutionChart.test.tsx` | — |
| HB-F-07 | Select de **Visão** (valor diário / % da meta / contribuição) sobre o payload existente | prop `view` já existia sem consumidor (`HabitEvolutionChart.tsx:86-107`); rótulos em `habitSeriesView.ts:12-18` | `HabitsHistoryPanel.tsx` (select `Visão`) | `RecordPage::o select de Visão oferece as três visões sobre o payload existente` · `Surface::booleano é 1 quando feito, 0 quando aberto e não feito, nulo sem linha` · `Surface::numérico na meta é 1 (ganha o bônus); abaixo, aplica a penalidade do bônus` | `e2e-history::gráfico de evolução…` |
| HB-F-08 | Falha parcial: a série falha e a **grade carrega íntegra**, com retry só no bloco da série | `HabitHistory.tsx:243-250` (erro isolado do bloco) | `HabitsHistoryPanel.tsx` | `RecordPage::falha parcial: a série falha e a GRADE carrega íntegra` | — |

| HB-F-09 | **Novo (passe de review):** as duas visões DERIVADAS são de fato exercidas — antes só os três `<option>` eram asseridos e o mock de `/series/` devolvia `points: []`, então `viewSeries` podia calcular a métrica errada com tudo verde | — | `HabitsHistoryPanel.tsx::viewSeries` | `RecordPage::visão "% da meta" reescreve a leitura como percentual da meta congelada` · `RecordPage::visão "contribuição" aplica a penalidade do bônus — leitura DIFERENTE da % da meta` | — |
| HB-F-10 | **Novo (passe de review):** na visão "contribuição", dia com linha materializada e valor nulo é **0** (não feito), nunca lacuna — a visão "valor diário" já desenhava 0 no mesmo dia, e as duas discordavam | — | `habitsSurface.ts::contributionFactor` (parâmetro `hasRecord`) | `Surface::booleano é 1 quando feito, 0 quando aberto e não feito, nulo sem linha` | — |
| HB-F-11 | **Novo (ciclo de review 1):** o gráfico usa a MESMA regra de nulo da tabela equivalente — booleano com linha materializada e valor nulo é **0** em todas as visões, nunca lacuna. Antes o conserto do HB-F-10 tinha entrado só no lado da tabela e as duas leituras do mesmo dia discordavam | — | `HabitEvolutionChart.tsx:120` (`isBoolean ? 0 : null`) | `RecordPage::booleano não feito lê 0 na contribuição — gráfico e tabela concordam` | — |
| HB-F-12 | **Novo (ciclo de review 1):** a visão `% da meta` **não é oferecida** para hábito booleano. `metaAtTime` é sempre nulo num booleano ⇒ a série ficava toda nula e a tabela equivalente imprimia `Sem registro neste dia.` em dias **que têm** registro (absência fabricada, o inverso de "nunca 0% fabricado") | — | `HabitsHistoryPanel.tsx::viewsFor` + `effectiveView` | `RecordPage::hábito booleano NÃO oferece a visão "% da meta"` | — |

## G. Formatação e textos de transparência

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência |
|---|---|---|---|---|
| HB-G-01 | `formatNumber` / `formatDateShortBR` / `formatDateBR` por split de string | `historyUtils.ts:6-23` | reusados; `habitsSurface.ts` acrescenta `formatDateLongBR`/`formatDateMediumBR` no mesmo padrão | `Surface::formata por extenso a partir do split da string` · `HabitHistory.test.tsx` (preservado) |
| HB-G-02 | `DAY_TYPE_LABEL` compartilhado | `historyUtils.ts:26-30` | reusado por `HabitGroupCard`, `HabitsTodayPanel`, `HabitsHistoryPanel`, `HabitCompletionGrid` | `RecordPage::mostra data por extenso, chip de tipo de dia e a navegação de data` |
| HB-G-03 | `describeChange` / `describeEvent` (texto das mudanças de versão) | `historyUtils.ts:35-55` | reusados pelo `HabitEvolutionChart` | `HabitEvolutionChart.test.tsx` |
| HB-G-04 | `isRhythmDay` era dead code no legado | `historyUtils.ts:58-60` | segue sem consumidor — **não** foi promovido nem apagado (remoção é do Épico 18) | — (registrado para não ser confundido com perda) |
| HB-G-05 | Strings verbatim do gate asseridas literalmente | — | `record/**` (constantes exportadas) | `RecordPage` (cada `it` cita a frase) · `e2e-record` (todas as frases conferidas em browser) |
| HB-G-06 | Zero literal de cor/medida na subpasta nova, com testes de **não-vacuidade** | — | `record/**` + `pages/habits/**` | `Guard::o guard não é vacuoso` (3 testes) · `Guard::o guard da casca não é vacuoso` (2 testes) |
| HB-G-08 | **Novo (passe de review):** `--ds-record-cards-card-min-width` passou a ser CONSUMIDO (`auto-fit` + `minmax`), então duas colunas só se formam quando cada card cabe no piso do gate — antes o token era emitido e asserido sem nenhum consumidor, e a grade `repeat(<colunas>, 1fr)` podia entregar cards abaixo dele | `HabitsTodayPanel.tsx` | `Tokens::test_cada_medida_de_geometria_da_16_1_aparece_em_shellCssVariables` · `Guard::HabitsTodayPanel.tsx não escreve nenhum dos literais reservados a tokens` |
| HB-G-09 | **Novo (ciclo de review 1):** `--ds-record-cards-columns-wide` passou a ser CONSUMIDO — o teto de colunas é declarado no `gridTemplateColumns`, não emergente da aritmética entre `max-width`, piso e gap. Antes era emitido e asserido-como-emitido sem consumidor real (a asserção vácua que o próprio HB-G-08 dizia ter corrigido) | `HabitsTodayPanel.tsx` | `Tokens::test_cada_medida_de_geometria_da_16_1_aparece_em_shellCssVariables` |
| HB-G-07 | Geometria do gate emitida como token + CSS var (`recordCards`, `completionBar`, `habitTrackerRow`, `pictogramPicker`) | — | `shared/design/tokens.ts` | `Tokens::test_record_cards_bate_com_o_design_md` · `…test_completion_bar_bate_com_o_design_md` · `…test_habit_tracker_row_bate_com_o_design_md` · `…test_pictogram_picker_bate_com_o_design_md` · `…test_cada_medida_de_geometria_da_16_1_aparece_em_shellCssVariables` · `…test_o_que_reusa_var_existente_nao_ganha_var_propria` |

## H. Rotas, chrome e collection desligada

| ID | Comportamento | Origem no legado | Onde vive agora | Evidência (jsdom) | Evidência (browser real) |
|---|---|---|---|---|---|
| HB-H-01 | Exatamente **um** `<main aria-label="Hábitos">` (o shell não renderiza `main`) | `HabitsPage.tsx:7-14` · `HabitHistoryPage.tsx:7-14` | `HabitsRecordPage.tsx` | `RecordPage::renderiza exatamente um <main aria-label="Hábitos">` · `RouteAnnouncer.test.tsx::test_anuncia_mudanca_de_superficie_ao_navegar_via_sheet_do_menu` (`findAllByRole('main')` = 1) | `e2e-record::AC1 — a superfície tem um main e três abas na ordem canônica, com estado em ?tab=` |
| HB-H-02 | Abas internas de Hábitos (`Seções de Hábitos`) | `HabitsTabs.tsx:8-16` (2 abas por **rota**) | `HabitsRecordPage.tsx` — 3 abas por **querystring** | `RecordPage::a tablist tem exatamente três abas, na ordem Hoje · Histórico · Configuração` · `Surface::a ordem é Hoje · Histórico · Configuração, invariável` | `e2e-record::AC1 …` |
| HB-H-03 | Rótulo abreviado `Config.` no compact | — (novo) | `habitsSurface.ts` | `RecordPage::no compact a terceira aba abrevia para "Config."` · `Surface::só "Configuração" abrevia no compact` | — |
| HB-H-04 | Aba ativa reflete `?tab=`; `?tab=` desconhecido cai em Hoje; `back` volta à aba anterior | — (novo; molde `ArchivePage.tsx:311-344`) | `HabitsRecordPage.tsx` | `RecordPage::a aba ativa reflete "?tab=" (deep link)` · `RecordPage::"?tab=" desconhecido cai na aba Hoje, sem tela morta` · `RecordPage::clicar numa aba troca o painel e o estado da querystring` · `Surface::deep link desconhecido/ausente cai na aba padrão, nunca em tela morta` | `e2e-record::AC1 …` (`goBack` volta a `?tab=historico`) |
| HB-H-05 | `aria-controls` só na aba selecionada; setas + Home/End com roving `tabIndex` | molde `RecurringGroupTabs.tsx` / `ArchivePage.tsx` | `HabitsRecordPage.tsx` | `RecordPage::só a aba SELECIONADA tem "aria-controls" (o painel inativo não existe no DOM)` · `RecordPage::setas e Home/End percorrem as abas (roving tabIndex)` · `Surface::os ids do par tab⇄tabpanel são distintos e estáveis` | — |
| HB-H-06 | Deep link `/habits/history` → `/habits?tab=historico` | `registry.ts` montava `HabitHistoryPage` | `pages/habits/HabitHistoryRedirect.tsx`; a rota **permanece** no manifest | `shellRouting.test.ts::test_shell_e_novo_em_tudo_e_apenas_as_rotas_migradas_tem_surfaceMigrated_true` (rota presente) | `e2e-record::AC2 — os deep links antigos redirecionam para as abas correspondentes` · `e2e-history` (linhas 78-79) |
| HB-H-07 | Deep link `/settings/habits` (inclusive pelo link de `SettingsPage`) → `/habits?tab=configuracao` | `router.tsx` montava `HabitsSettingsPage` | `router.tsx:203-211` (`<Navigate replace>`) | idem HB-H-06 | `e2e-record::AC2 …` (inclui o clique no link de `/settings`) · `e2e-mult` (linhas 51-52) |
| HB-H-08 | `LegacySeamNotice` não aparece em nenhuma das três rotas de Hábitos | `shellRouting.ts:82,90,91` (`surfaceMigrated:false`) | as três com `surfaceMigrated:true` | `shellRouting.test.ts::test_as_tres_rotas_de_habitos_sao_migradas_na_story_16_1` (com irmã de não-vacuidade) | `e2e-record::AC1 …` e `AC2 …` (`legacy-seam-notice` com contagem 0) |
| HB-H-09 | Toda rota do registro tem entrada em `shellRoutes` | `shellRouting.test.ts` (invariante pré-existente) | inalterado | `shellRouting.test.ts::test_shell_e_novo_em_tudo_e_apenas_as_rotas_migradas_tem_surfaceMigrated_true` | — |
| HB-H-10 | **DIR-12c** — sem a entrada `habits` no manifest, o destino desaparece da nav inteira, sem link fantasma / item `disabled` / heading vazio, e Hoje + Planner seguem íntegros | — (requisito do gate) | `shellDestinations.ts` (derivação genérica) | `shellDestinations.test.ts::sem a entrada "habits" no manifest, o destino Hábitos some da navegação inteira` | — |
| HB-H-11 | Páginas legado permanecem no repositório, apenas **desmontadas** | `HabitsPage.tsx`, `HabitHistoryPage.tsx`, `HabitsTabs.tsx`, `HabitsSettingsPage.tsx` | idem — remoção é do **Épico 18** | — | — |
| HB-H-12 | `HabitTracker` legado continua montado no Daily | `DailyPage.tsx:110` | intacto | `DailyPage.test.tsx` (preservado) | `e2e-tracker::tracker de um usuário sem hábitos mostra o estado vazio em /today e /habits (AC2)` |
| HB-H-13 | Mocks de chrome estendidos para os hooks que a superfície nova consome | `router.test.tsx:55-58` · `RouteAnnouncer.test.tsx:50-53` (só `{useHabitDayQuery, HabitTracker}`) | ambos mockam o barrel **e** `features/habits/api` (a superfície importa intra-feature) | `router.test.tsx` e `RouteAnnouncer.test.tsx` inteiros | — |

## I. Divergências **contratadas** (não são bugs)

| ID | Divergência | Autoridade | Consequência |
|---|---|---|---|
| DIV-HB-01 | Loading textual (`Carregando hábitos…`, `Carregando histórico…`, `Carregando série…` com `role="status"`) foi substituído por **skeleton com a geometria final** e `aria-busy`, sem porcentagem provisória | spec 16.1 Boundaries (estados obrigatórios) + Task 7 | O anúncio de carregamento passa a ser o `aria-busy` do bloco; nenhuma porcentagem provisória pode ser lida como dado |
| DIV-HB-02 | **Emoji não é renderizado em lugar nenhum** (rótulo da linha, select do histórico, cabeçalho da grade, campo `Emoticon` da criação) e a criação **não envia** `emoticon` | gate 16.0 Q2; `epic-16-context.md` (Technical Decisions) | A coluna do glifo de `--ds-domain-icon-size-default` existe e fica vazia; `iconKey` + migração são a **Story 16.2**. Provado por `Guard::… não lê nem escreve o campo emoticon` (11 fontes) e `RecordPage::criar hábito NÃO envia emoticon` |
| DIV-HB-03 | O aviso de vigência prospectiva deixou de ser **tooltip** e passou a ser **texto persistente** sob os campos versionados | Design Notes da spec ("tooltip não sobrevive a teclado nem a toque") | Mesma string verbatim; agora sempre visível. `RecordPage::o aviso de vigência é TEXTO persistente, nunca tooltip` |
| DIV-HB-04 | A grade deixou de ser **dia × hábito com ✓/—** e passou a ser **semana × hábito com número + tom contínuo** | gate 16.0 / mockup F8 | Agregação por bucket é derivada **no cliente sobre o payload existente** (`useHabitHistoryQuery`), sem endpoint novo; a agregação server-side e o alternador semana/quinzena são **Story 16.2b** e não existem aqui |
| DIV-HB-05 | Os inputs livres `Início`/`Fim` do intervalo e os botões `Dia anterior`/`Próximo dia` do legado (`HabitHistory.tsx:145-209`) não existem: o bloco de intervalo é `‹ Período anterior · {range} · 30 dias · Próximo período ›` + `Dia em detalhe` | mockup F8 (`key-habitos.html:1151-1160`), promovido no gate | A janela continua sendo de 30 dias e qualquer dia dela é alcançável pelo campo `Dia em detalhe` (com `min`/`max`); a seleção de intervalo arbitrário **não** foi promovida pelo gate |
| DIV-HB-06 | O `caption` da grade e o texto do resumo do dia foram reescritos (a leitura passou de diária para semanal, e o denominador ficou nomeado) | gate 16.0 / mockup F8 | Nenhuma informação foi perdida: tipo de dia, completude, soma dos pesos efetivos e contagem de registros preenchidos ficaram **explícitos** onde antes eram implícitos |
| DIV-HB-07 | Contraste das células da grade: a escala contínua de tom é a **única exceção nomeada** ao piso de 4,5:1 do produto | gate 16.0 (memória de decisão) + `EXPERIENCE.md#Accessibility Floor` | Sustentada pela redundância na mesma superfície: `caption`, `th scope` em linha e coluna, tags textuais FDS/FER e a **tabela equivalente permanente em `details`** em contraste normal. Não extensível a nenhuma outra superfície |
| DIV-HB-08 | `Sidebar.tsx:53` e `BottomNav.tsx:21` (chrome **legado**) continuam lançando exceção se a entrada `habits` sair do manifest | Design Notes da spec ("fronteira consciente") | A AC de DIR-12c cobre o **shell novo**, onde o módulo passa a viver; o chrome legado é aposentado pelo Épico 18. O mesmo acoplamento já valia para `gratitude` |
| DIV-HB-11 | A affordance de retry tem **um** rótulo em toda a superfície: `Tentar de novo` (spec Task 8). Antes conviviam `Tentar de novo` nos blocos de leitura e `Tentar novamente` nos de escrita | spec 16.1 Task 8 | Constante única `habitsSurface.ts::RETRY_LABEL`, consumida por `HabitsTodayPanel`, `HabitTrackerRow`, `HabitsConfigPanel` e `HabitsHistoryPanel`. `Tentar novamente` segue vivo em OUTRAS features (Semanal/Mensal/Migração/Medicamentos) — a unificação é escopada a Hábitos |
| DIV-HB-09 | Sem matriz axe por viewport e sem story de fechamento de a11y | retro do Épico 15 (verificação formal de a11y descontinuada) | Teclado, foco, alvo de toque e contraste vêm herdados dos tokens/componentes compartilhados; os contratos semânticos são asseridos por `role`/`aria-*` nos testes acima |
| DIV-HB-10 | F10–F12 (bloco de Hábitos nas duas lentes do Daily) e F13–F15 (sequência, dias 100%, série por grupo) não entram | spec 16.1 Never; mockup `key-habitos.html:1768` | `DailyPage.tsx:110` segue com o `HabitTracker` legado, intacto; as leituras agregadas exigem backend novo (**Story 16.2b**) |

## K. Ajustes da homologação em dev (2026-08-22)

> 12 apontamentos do Hugo sobre a instância de dev, todos aplicados. Onde havia
> fonte da verdade, a referência foi o `mockups/key-habitos.html` — não o gosto
> de quem implementou.

| Frame | Apontamento | O que mudou |
|---|---|---|
| F1–F4 | Remover a nota "Hoje é o último dia registrável…" | Constante e `role="note"` removidos; o botão desabilitado é o contrato. `aria-describedby` do "Próximo" limpo |
| F3–F4 | Navegação de dia só com as setas | `‹` / `›` no visual, com `aria-label` `Dia anterior` / `Próximo dia` — sem texto visível a seta sozinha não se anunciaria |
| F5 | Conferir maiúsculas/minúsculas | A Configuração já seguia o mockup (`Booleano`/`Numérico`); a **grade** usava minúsculas — alinhada a `Booleano · Peso N` |
| F8 | Card superior: alinhamento vertical e negritos | `alignItems` unificado em `center` (havia `flex-end` no container contra `center` no texto); intervalo passou a `body-strong` por ser a informação principal |
| F8 | Remover "Este é o período mais recente" | Nota e `aria-describedby` removidos; botão desabilitado basta |
| F8 | Remover "Leva o dia selecionado para a aba Hoje…" | Removida — o rótulo do botão já diz |
| F8 | Grade: negritos e tamanhos de fonte | Nome do hábito é `th scope="row"`: passou de `body` para `body-strong`, coerente com o papel de cabeçalho |
| F8 | Grade: números não centralizados | `flex` + `center` nos dois eixos, em vez de `lineHeight` fingindo altura — o tom pinta o bloco todo, o número tem de estar no meio dele |
| F8 | Tabela equivalente: head sem destaque | `backgroundColor: var(--ds-surface-subtle)`, como o head da grade |
| E2 | Fundo verde não aparecia no salvamento | A linha recebe `var(--ds-primary-soft)` enquanto `isPending` (mockup `:1579`) |
| E2 | Altura pulava no estado curto | Estado transitório virou slot **sempre montado** (`habit-row-transient`) com `minHeight` reservada, dentro do corpo da linha — antes `salvando…`/erro eram nós criados ABAIXO da linha |
| E3 | Comportamento errado no erro de escrita | Erro e retry passaram para dentro da linha, e o estado ganhou o sufixo `— valor no servidor`: no erro o campo mostra o **digitado** e o estado o **confirmado**, e sem esse rótulo a linha exibia dois números contraditórios (mockup `:1599`) |

**Cobertura nova:** `RecordPage::E2: linha ganha fundo e "salvando…" sem mudar de altura`
(sensibilidade confirmada por sabotagem) e a asserção de `— valor no servidor` no teste
de erro de escrita. O estado de salvamento **não tinha teste nenhum** antes — foi por isso
que o fundo ausente e o pulo de altura passaram pelas três camadas de review.

## J. Verificação executada nesta rodada

> **Terceira passada (ciclo de review 1 REGISTRADO, 2026-08-22).** As duas passadas
> anteriores não deixaram trilha na spec (a sessão expirou — commit
> `81be411 "implementação até o timeout"`); o `## Review Triage Log` da spec agora
> registra a triagem completa. Nesta passada, 3 camadas de review produziram 13
> achados mantidos como `patch` (todos aplicados), 6 descartados por verificação
> — dois deles **medidos em Chromium real** — e 4 deferidos ao ledger
> (`DW-56`..`DW-59`, todos em `api.ts`/guards fora do diff desta story).
>
> **Defeitos de comportamento corrigidos nesta passada:** (1) `% da meta` num
> hábito **booleano** produzia série toda nula e a tabela equivalente imprimia
> "Sem registro neste dia." em dias **com** registro — absência fabricada; a visão
> deixou de ser oferecida para booleanos. (2) Gráfico e tabela **discordavam do
> mesmo dia**: booleano com linha materializada e valor nulo virava lacuna no
> gráfico e `0` na tabela; a regra do gráfico foi alinhada a `contributionFactor`.
> (3) O cabeçalho da coluna da grade contava dias **corridos** ("7 dias" sobre
> células "2/3"); passou a contar dias **com registro**. (4) O compact da grade
> havia perdido a leitura **por hábito** (o legado renderiza uma linha por hábito
> por dia) **e** a tabela equivalente — restaurada a recomposição. (5) Navegação de
> data agora indisponível offline (evita erro de leitura com retry impossível).
> (6) Reselecionar a aba atual não empilha mais entrada no histórico. (7) Legenda
> do grupo derivada do `dayType` do **dia**, não de `entries[0]`. (8) `scope`
> corrigido na banda de seção da grade. (9) Campo numérico ressincroniza com o
> servidor quando não há escrita pendente nem erro a preservar.


> Segunda passada: 15 achados de review triados como `patch` foram aplicados
> (4 defeitos de comportamento contra o backend real — futuro navegável,
> multiplicador vazio, versão espúria e falha muda de ativação —, 5 defeitos
> menores de UI e 4 lacunas de verificação, mais o consumo do token de piso do
> card e a unificação do rótulo de retry). As linhas afetadas acima já citam a
> evidência nova; as seções **A/B/C/D/F/G** ganharam as linhas `HB-A-23`,
> `HB-A-24`, `HB-B-13`, `HB-C-26`, `HB-C-27`, `HB-C-28`, `HB-D-13`, `HB-F-09`,
> `HB-F-10` e `HB-G-08`, e a seção **I** ganhou `DIV-HB-11`.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, zero warning |
| `npm run test:run -- src/features/habits src/pages/habits src/app src/shared/design` | 27 arquivos / **467** testes verdes (425 na entrega inicial → 437 → 457 → **467** com os 10 testes de regressão do ciclo de review 1) |
| `npm run test:run` (full-suite, gate cross-app) | **2213/2220 verdes**, reconfirmado no ciclo de review 1. As **3 falhas (7 testes) são pré-existentes e alheias a Hábitos** (`FuturePage.test.tsx`, `TaskDetailPanel.test.tsx`, `TaskDestinationDialog.test.tsx` — datas de julho/2026 fixas, sem `setSystemTime`): reproduzidas **idênticas** no baseline `d990d3b` em worktree isolada, nesta rodada inclusive |
| `CI=1 npx playwright test` (4 specs de Hábitos + 2 de chrome) | **30 passed (2,4 min)** contra o backend real e o Postgres local `bujo_e2e`, reconfirmado após os 13 patches do ciclo de review 1 |
| Diff × domínio | nenhum arquivo de `backend/`, `features/habits/api.ts`, `api/keys.ts`, `features/habits/types.ts` ou `types.gen.ts` alterado |
