# Test Automation Summary — Story 14.4 (Soft delete de templates recorrentes)

**Workflow:** `bmad-qa-generate-e2e-tests` · **Data:** 2026-07-25 · **Story:** `14-4-soft-delete-de-templates-recorrentes-backend.md` · **Baseline do passo:** 1262 passed (fim do `dev-story`) · **Framework:** pytest (backend) + Playwright (E2E), ambos já no projeto

Story de **backend puro**: uma coluna nulável, um helper compartilhado (`live_templates`), um
serviço idempotente e um verbo HTTP na rota que já existia. O `dev-story` fechou com cobertura
de serviço densa — matriz de 4 células, idempotência provada em SQL, linhagem comparada com o
id original, guard por `inspect.getsource`. Este passo **não** reexercitou nada disso. Procurou
três coisas: o que existia só **abaixo do fio**, o que **nenhuma camada** cobria, e o que só o
**browser contra o banco real** pode mostrar.

## Lacunas encontradas e fechadas

### API (pytest, `backend/bujo/tests/test_views.py`) — 6 funções, 6 testes coletados

| # | Lacuna | Teste |
|---|---|---|
| 1 | **`deletedAt` sem blindagem.** A AC4 manda o `RecurringTaskTemplateSerializer` ficar intocado, e a story indicou o lugar exato do guard ("assert de conjunto de chaves do teste de fio da listagem, não um teste de serializer novo") — mas **nenhum teste do arquivo asserta conjunto de chaves de template**. Um `fields` ampliado por engano vazava sem vermelho nas respostas de template. | `test_deleted_at_nao_vaza_no_contrato_de_template_em_nenhuma_das_tres_respostas` (+ constante `_CHAVES_DE_TEMPLATE_NO_FIO`, reusada no envelope da fonte) |
| 2 | **Query params isolados ≠ combinados.** A matriz da AC6 prova cada param sozinho; "some da biblioteca em toda combinação" inclui os três encadeados. Faltava o cenário onde `unplaced_year` **também** exclui alguém (senão a cláusula podia estar morta e o teste passaria). | `test_excluido_some_da_listagem_com_os_tres_query_params_combinados` |
| 3 | **A fonte "Recorrentes" semanal só existia em teste de serviço.** No fio, o que a UI das 14.5/14.6 consome são as contagens do envelope: excluir um template **pendente** muda o denominador do progresso do ritual, e excluir o **último** pendente faz a fonte passar a "revisada". Efeito de produto do soft delete que nenhum teste observava. | `test_fonte_recorrentes_semanal_no_fio_perde_o_excluido_dos_dois_buckets_e_das_contagens` |
| 4 | **Um bucket sem cobertura em NENHUMA camada.** A story fala de "três saídas" da fonte mensal; no fio ela tem **quatro** — e `alreadyPlaced` (o mensal já colocado no mês-alvo) não era assertado nem no serviço nem no fio. | `test_fonte_recorrentes_mensal_no_fio_perde_o_excluido_dos_quatro_buckets` |
| 5 | **O 409 da AC2 ponto 7 nunca foi observado.** O teste de serviço assere a exceção; a AC especifica o **status** (409, não 404 — que é a tentação natural, já que o `PATCH` sobre excluído devolve 404) e a **mensagem neutra**, que é contrato de segurança herdado da 14.2 (uma mensagem de "não existe" revelaria ausência de linha alheia). | `test_post_decisao_skip_week_sobre_template_excluido_e_409_neutro_e_nao_persiste` |
| 6 | **Interação 14.2 × 14.4, órfã nas duas stories.** `RitualDecision.recurring_template` é `on_delete=CASCADE`: num delete físico a decisão-snapshot iria embora. E `decisions_for_target` monta `by_template` sem saber de exclusão, então sobra uma entrada apontando para template que a fonte não lista mais. Nada garantia que a leitura continua íntegra e que a decisão sobrevive. | `test_excluir_template_com_decisao_snapshot_preserva_a_decisao_e_a_leitura_da_fonte` |

### E2E (Playwright, `frontend/e2e/recurring-soft-delete.spec.ts` — **NEW**) — 4 testes

A story fechou o `dev-story` com **nenhum spec E2E** e registrou que este passo poderia criar
um. Criado. Como o botão **Excluir** só nasce na 14.8, toda escrita acontece pelo fio — mesmo
critério do `ritual-sources.spec.ts` da 14.2. O spec **não** reexercita regra de domínio.

| Teste | O que só aqui é verificável |
|---|---|
| `AC6 na biblioteca real: o excluído não volta nem com "Mostrar inativos" ligado, o inativo volta` | A distinção "inativo = visível com filtro, reversível" × "excluído = fora da biblioteca" é **de UI, e os dois filtros vivem em camadas diferentes**: `active` é filtrado no **cliente** (`RecurringTemplateManager` consulta sem params) e `deleted_at` no **servidor**. Só o browser prova que o toggle traz um de volta e não traz o outro. Fecha com a reversibilidade real: o inativo volta a ativo pelo botão "Ativar"; o excluído não tem linha, logo não tem botão. |
| `Future Log real: o anual excluído sai de "Anuais pendentes" e o vivo permanece` | A seção "Anuais pendentes de \<ano\>" é o **único consumidor de `?unplaced_year`** no produto (`FuturePage.tsx:78`) e a Questão aberta #5 da story ("um anual excluído deixa de ser lembrado"). O pytest prova o param; só aqui a seção é provada — inclusive que ela **não desaparece inteira** (o vivo a sustenta). |
| `AC5 no banco real: a instância alocada sobrevive e o template sai da seção de placement até com "Mostrar já colocados"` | A FK `SET_NULL` do Postgres de verdade sob a exclusão. E um caso que só existe na UI: na seção de placement o template com instância está escondido pelo **dedup** da 11.3, que o toggle "Mostrar já colocados" desfaz — o excluído tem de ficar fora **mesmo com o toggle ligado**, ou seja, "escondido" e "excluído" são estados distintos também nessa superfície. |
| `DELETE contra a branch Neon e2e: 204 idempotente e nenhum caminho de volta pelo PATCH` | Um `DELETE` que responde 204 aqui é a **prova operacional de que a migration `0009` está aplicada onde o Playwright roda** (sem ela: 500 por `UndefinedColumn`) — o bug recorrente 7.1/7.2/14.1, que só aparece nesta camada. Mais idempotência contra Postgres real e `PATCH` → 404, com um template vivo ao lado provando que o 404 é do excluído, não de rota quebrada. |

## Achados

**1 — Nenhum defeito de produção.** Os 6 testes de API e os 4 E2E passaram na primeira
execução; nenhum arquivo de produção foi alterado por este passo. A única correção foi num
teste próprio (`ruff` F841: duas variáveis de cenário sem uso em `..._quatro_buckets`, cujo
assert é sobre `recurrenceText`).

**2 — A fonte mensal tem quatro buckets, não três.** A story descreve "as três saídas" do
bloco anual/mensal (`monthly`, `annual_eligible`, `annual_in_year`). No fio, o envelope mensal
expõe **quatro** listas: `items` (mensais pendentes + anuais elegíveis, na ordem do M07),
`alreadyPlaced` e `alreadyPlacedInYear`. A contagem "três" descreve as *querysets*, não as
*saídas observáveis* — e foi justamente a quarta que ficou sem cobertura de exclusão. Vale
para quem escrever a UI da 14.6.

**3 — Excluir um recorrente mexe no progresso do ritual.** Consequência correta, mas não
registrada em nenhuma das duas stories: `pendingDecisionCount` e `reviewed` são computados na
leitura sobre a lista de itens, então excluir o último template pendente **encerra a pendência
da fonte** — o soft delete é um caminho para "revisar" a fonte Recorrentes sem decidir nada.
Coberto pelo teste #3 e digno de nota para a UX da 14.5.

## Provas de não-vacuidade (4 experimentos SEPARADOS, além dos 3 do `dev-story`)

Escolhidos por cobrirem exatamente as propriedades que os três do `dev-story` **não** tocaram.

| # | Reversão cirúrgica | Vermelhos | Restauração |
|---|---|---|---|
| (d) | `rituals.py`: `live_templates(...)` fora das **duas** querysets de `list_monthly_recurring_candidates` | **2** — o teste de serviço da story + `..._mensal_no_fio_perde_o_excluido_dos_quatro_buckets` (2 failed, 612 passed) | restaurado por cópia; `md5` idêntico |
| (e) | `rituals.py`: `live_templates()` fora do lookup de item de `upsert_ritual_decision` | **2** — o teste de serviço do `skip_week` + `..._409_neutro_e_nao_persiste` (o de fio é o que prova o **409**) (2 failed, 612 passed) | restaurado por cópia; `md5` idêntico |
| (f) | `serializers.py`: `deleted_at` acrescentado ao `fields` do `RecurringTaskTemplateSerializer` | **3** — o teste de chaves, o envelope da fonte semanal (o `template` aninhado usa o mesmo serializer) e `test_ac8_contrato_legado_preservado_nas_nove_respostas_nomeadas` (3 failed, 611 passed) | restaurado por cópia; `md5` idêntico |
| (g) | `views.py`: `live_templates()` → `objects.all()` na listagem — a mesma reversão da (a) do `dev-story`, agora medida **no browser** | **4 de 4** testes do spec E2E novo, cada um falhando na **linha do assert de ausência** | restaurado por cópia; `md5` idêntico |

(g) é o experimento que este passo mais precisava: um assert de "sumiu" na UI é o jeito mais
barato de escrever um teste vacuoso. Os quatro morreram, e cada um morreu no assert certo —
por isso o spec intercala **presença antes de ausência** na mesma renderização (helper
`reloadAndWaitTemplates`), em vez de confiar em timing.

**Resíduo zero, conferido por hash e não por leitura** (achado C1/C2 da 14.3): os três arquivos
de produção tocados foram copiados antes e restaurados por cópia; `md5` dos três na árvore
final é idêntico ao dos backups; `grep -rn "EXPERIMENTO" backend/ frontend/src frontend/e2e`
não devolve nada; `git diff --stat` fecha com as **mesmas 24 deleções** de antes do passo; e a
**full-suite foi re-executada depois do último experimento**.

## Gates

| Gate | Resultado |
|---|---|
| `docker compose up -d db && cd backend && uv run pytest` (full-suite, sem escopo) | **1268 passed em 240.72s** |
| `uv run pytest bujo/tests/ -q` (depois da correção de `ruff`) | 614 passed em 127.08s |
| `uv run ruff check` | All checks passed! |
| `uv run lint-imports` | **1 kept, 0 broken** |
| `uv run ruff format --check` | 48 arquivos — **mesma lista** da baseline da story (`bujo/tests/test_views.py` já era vermelho); `services/recurring.py`, `services/rituals.py` e a migration seguem fora |
| `npx tsc --noEmit` (Node 22.15.1) | limpo |
| `npx eslint e2e/recurring-soft-delete.spec.ts` | limpo |
| `DJANGO_SETTINGS_MODULE=config.settings.e2e … migrate --check` | exit 0 — `0009` aplicada na branch Neon `e2e` **antes** do Playwright |
| `CI=1 npx playwright test recurring-soft-delete recurring-templates future-log-annual ritual-sources --retries=0` | **11 passed / 1 failed em 6,5 min** — a falha é a **pré-existente** `recurring-templates.spec.ts:306` (locator `Definir placement`, herdada da 13.3, já medida na 14.2 e na 14.3), mesmo teste/linha/locator. Portas 5173/8000; **5174/8001 intocadas** |

**Contagem derivada de `git diff`, nunca por subtração:** `git diff -U0 backend/bujo/tests/ |
grep -c "^+def test_"` → **26** funções novas na story (20 do `dev-story` + 6 deste passo),
**zero** `@pytest.mark.parametrize` novos → 26 coletados. 1242 + 26 = 1268 ✓ — o total
corrobora a divisão; a divisão não veio dele.

**Contrato gerado:** `schema.yaml` e `types.gen.ts` **não** foram tocados por este passo, e não
deveriam ser — nenhuma rota, serializer ou enum mudou. Só testes e um spec novo.

## Cobertura

- **Pontos de leitura de template:** 7/7 cobertos no serviço (pelo `dev-story`); dos que têm
  superfície HTTP, **6/6 agora cobertos no fio** — listagem (5 combinações isoladas + a
  combinada), `PATCH` (404), `POST …/place/` (404), fonte semanal, fonte mensal e
  `POST /ritual-decisions/` (409 neutro).
- **Buckets de fonte de ritual:** 4/4 com exclusão assertada (antes: 2/4, e só no serviço).
- **Respostas que emitem template:** 4/4 com conjunto de chaves fixado (`POST` 201, `GET`
  listagem, `PATCH` 200 e o `template` aninhado no item da fonte).
- **ACs com cobertura E2E no banco real:** AC1 (migration na branch `e2e`), AC3
  (idempotência), AC4 (204 + 404 do `PATCH`), AC5 (linhagem), AC6 (a distinção
  inativo × excluído na superfície).
- **Sem cobertura, por decisão:** o botão Excluir, o dialog de confirmação e o estado offline
  são **14.8** — não existem nesta onda.

## Próximos passos

1. Levar os **Achados 2 e 3** para a UX das Stories 14.5/14.6 (quatro buckets na fonte mensal;
   excluir um recorrente encerra pendência de ritual).
2. Na **14.8**, `recurring-soft-delete.spec.ts` é o spec a estender: o fluxo pelo fio troca
   pelo clique em Excluir + dialog, e os asserts de UI já estão escritos.
3. `recurring-soft-delete.spec.ts` entra na seleção de regressão das próximas stories do
   Épico 14 que tocarem a biblioteca de recorrentes, o Future Log ou as fontes de ritual.
