# Test Automation Summary — Story 14.2 (Fontes dos rituais e decisões-snapshot)

**Workflow:** `bmad-qa-generate-e2e-tests` · **Data:** 2026-07-25 · **Story:** `14-2-fontes-dos-rituais-e-decisoes-snapshot-backend.md` · **Baseline do passo:** 1194 passed (fim do `dev-story`)

Story de **backend puro** (10 endpoints novos, nenhuma superfície de UI). O `dev-story`
já tinha deixado a cobertura de serviço praticamente exaustiva — matriz de 12 células,
elegibilidade das 7 fontes, densidade, zero-materialização. Este passo **não** reexercitou
nada disso: procurou o que só existia *abaixo* do fio e o que só o backend real da branch
Neon `e2e` pode provar.

## Lacunas encontradas e fechadas

### API (pytest, `backend/bujo/tests/test_views.py`) — 7 funções, 15 testes coletados

| # | Lacuna | Teste |
|---|---|---|
| 1 | A fonte mensal de recorrentes é a **única com dois buckets**, e `alreadyPlacedInYear` é a **única chave de bucket com underscore** — a camelização dela nunca foi verificada no fio, só deduzida. Também não havia assert de fio para a ordem "mensais primeiro, anuais depois" do M07. | `test_fonte_recorrentes_mensais_no_fio_expoe_os_dois_buckets` |
| 2 | A célula `keep_undated` (alvo **mensal** × Task) **nunca devolveu 201 por HTTP**: o único POST bem-sucedido testado era `keep`. O ramo `monthFirst` do endpoint só aparecia em casos 400. | `test_post_decisao_keep_undated_no_fio_grava_no_alvo_mensal` |
| 3 | Idem para `skip_week` (item = **template**). Junto, o caso-âncora literal da AD-28 ("nenhuma Task nasce; o template não é desativado") não tinha versão de fio. | `test_post_decisao_skip_week_no_fio_nao_cria_task_nem_desativa_template` |
| 4 | **O laço do ritual nunca foi percorrido inteiro por HTTP**: ler a fonte → POSTar a decisão → reler a fonte. É a razão de os endpoints existirem e o que a UI das 14.5/14.6 vai fazer. O invariante que ele protege é a **assimetria** — `pendingDecisionCount` cai e `reviewed` vira `true`, mas `eligibleCount` **não muda**. | `test_laco_do_ritual_no_fio_decisao_zera_a_pendencia_sem_mudar_a_elegibilidade` |
| 5 | O isolamento por tenant no fio cobria só **leituras**. Uma decisão apontando para a Task de outro tenant nunca foi testada por HTTP (só na camada de serviço). | `test_post_decisao_com_item_de_outro_tenant_e_409_e_nao_persiste` |
| 6 | Nenhum teste fixava que fonte e densidade são **leitura**: um `POST` que passasse a 200 seria superfície de escrita nascida por acidente de roteamento. | `test_fontes_e_densidades_recusam_escrita` (×9 endpoints) |
| 7 | A **ausência** de listagem e de `DELETE` em `/ritual-decisions/` é decisão de produto (Questões abertas #4), não omissão — e ausência não testada é ausência que volta. | `test_decisoes_de_ritual_recusam_leitura` |

### E2E (Playwright, `frontend/e2e/ritual-sources.spec.ts`) — 3 testes

A story fechou o `dev-story` com **nenhum spec E2E** e a nota de que o passo de QA poderia
criar um. Criado, com o mesmo critério da 14.1: o spec **não** reexercita regra de domínio
(o pytest já a cobre em Postgres local) — cobre o que só o backend real e o ciclo de request
completo mostram.

| Teste | O que só aqui é verificável |
|---|---|
| `as nove leituras de ritual não materializam container no banco real (AC7)` | A AC7 diz "nenhum endpoint desta story materializa log". A contagem tem que vir de **fora do fio** (`countRitualContainers`, via `manage.py shell`), porque contar pela API é impossível: `GET /api/bujo/logs/weekly/` faz `get_or_create` **de propósito** (AC4 da 14.1). Cobre também "fonte vazia é revisada", `readyToFinalize: false` sem log anterior, e grade completa/zerada nas duas densidades. |
| `laço do ritual semanal e upsert sob concorrência valem no banco real (AC1, AC2, AC5)` | Dois POSTs **simultâneos** da mesma decisão (o clique duplo real do usuário). Sem o índice único **parcial** da `0008`, a corrida entre o `get` e o `create` do serviço produziria duas linhas e dois ids. Convergir para o mesmo id é evidência do índice no Postgres de verdade. |
| `a densidade nova conta a subtarefa que a semana real mostra (AC6, AC8)` | Confronta o endpoint novo com a superfície que o usuário vê, e o legado `/api/bujo/task-density/` no backend real. Ver **Achado 1**. |

## Achados

**1 — A subtarefa aparece no dia do pai, mas conta como `undated` na densidade.** (Não é
defeito; é consequência a documentar.) A grade da semana renderiza a subtarefa **aninhada**
sob a raiz — o `TaskSerializer` serializa `subtasks` dentro de cada raiz —, então aos olhos
ela mora no dia do pai. Para a densidade ela é `undated`, porque `SubtaskCreateView` não
aceita `scheduledDate` e a faixa é definida pelo `scheduled_date` **do próprio registro**.
Isso é exatamente o que a AC6 contrata ("inclui subtarefas", faixa `undated` =
`scheduled_date IS NULL`), mas a **UI das 14.5/14.6 precisa saber disso** antes de desenhar
o heatmap: a barra de um dia não é a soma visual dos cartões daquele dia. Registrado aqui
porque nenhum teste de unidade compara as duas leituras — foi a primeira versão deste spec,
que assumia o contrário, que expôs o fato.

**2 — Nenhum defeito de produção encontrado.** Os 15 testes de API novos passaram na
primeira execução; as duas correções feitas durante o passo foram no **spec**, não no
código (a asserção invertida do Achado 1 e o `month_first` obrigatório do endpoint legado).

## Provas de não-vacuidade (4 experimentos SEPARADOS)

| # | Reversão cirúrgica | Teste que passou a FALHAR | Restauração |
|---|---|---|---|
| (d) | `rituals.py::_envelope`: `pending = sum(... if item["decision"] is None)` → `pending = len(items)` | `test_laco_do_ritual_no_fio_decisao_zera_a_pendencia_sem_mudar_a_elegibilidade` — 1 failed | restaurado; `grep -c EXPERIMENTO` = 0, 1 passed |
| (e) | `rituals.py`: `annual_eligible = annual.exclude(in_year)` → `annual_eligible = annual` | `test_fonte_recorrentes_mensais_no_fio_expoe_os_dois_buckets` — 1 failed | restaurado; `grep -c EXPERIMENTO` = 0, 1 passed |
| (f) | *(evidência direta, não reversão)* `pg_indexes` na branch Neon `e2e`: os **4** índices únicos parciais existem com os nomes contratados e o `WHERE (… IS NOT NULL AND … IS NOT NULL)` esperado — é a premissa da asserção de concorrência do E2E. | — | — |
| (g) | `density.py`: `WeeklyLog.objects.filter(...).first()` → `get_or_create(...)` | `as nove leituras de ritual não materializam container no banco real (AC7)` — 1 failed (3 tentativas) | restaurado; `grep` só acha as docstrings originais; suíte cheia verde |

Experimentos (d) e (e) foram separados porque medem propriedades distintas (derivação do
progresso × elegibilidade anual), mesmo tocando o mesmo arquivo. (g) exigiu execução E2E
própria: é o único assert que atravessa o fio até o banco real.

## Gates

| Gate | Resultado |
|---|---|
| `docker compose up -d db && cd backend && uv run pytest` (full-suite, sem escopo) | **1209 passed em 328.15s** |
| `uv run ruff check bujo/ core/` | All checks passed! |
| `uv run ruff format --check .` | 48 arquivos — **mesma contagem** da baseline da story; nenhum arquivo adicionado à dívida |
| `uv run lint-imports` | 1 kept, 0 broken |
| `npx tsc --noEmit` (Node 22.15.1) | limpo |
| `npx eslint e2e/ritual-sources.spec.ts e2e/countRitualContainers.ts` | limpo |
| `migrate --check` na branch Neon `e2e` | nada pendente (`0008` já aplicada) |
| `CI=1 npx playwright test ritual-sources.spec.ts` | **3 passed em 1,7 min** (portas 5173/8000; 5174/8001 intocadas) |

**Contagem derivada de `git diff`, nunca por subtração:** 7 funções `test_` novas em
`test_views.py`, das quais uma é parametrizada ×9 → **15 testes coletados**
(`pytest --collect-only` filtrado pelos nomes extraídos do diff). 1194 + 15 = 1209 ✓ — o
total corrobora a divisão; a divisão não foi obtida dele.

**Contrato gerado:** `schema.yaml` e `types.gen.ts` **não** foram tocados neste passo, e não
deveriam ser: nenhuma rota, serializer ou enum mudou — só testes e um spec novo.

**Regressão do contrato legado (AC8):** os 6 specs que a story rodou não foram reexecutados,
porque este passo **não alterou nenhum arquivo de produção** (os 4 experimentos foram
revertidos e a suíte cheia ficou verde depois deles). A falha pré-existente de
`recurring-templates.spec.ts:306` continua registrada na story, já medida no baseline.

## Cobertura

- **Endpoints da 14.2:** 10/10 com `401`, validação de query/corpo, forma de fio e isolamento por tenant; 10/10 com o método correto fixado.
- **Células da matriz de decisão:** 3/3 legais agora provadas **por HTTP** (antes: 1/3); 9/9 ilegais já provadas no serviço pelo `dev-story`.
- **Fontes:** 7/7 com envelope verificado no fio (antes: 4/7 — faltavam os dois buckets mensais e o `future-log`).
- **ACs com cobertura E2E no banco real:** AC1, AC2, AC5, AC6, AC7, AC8.

## Próximos passos

1. Levar o **Achado 1** para a UX das Stories 14.5/14.6 antes do heatmap de densidade.
2. `ritual-sources.spec.ts` entra na seleção de regressão das próximas stories do Épico 14 que tocarem fontes, decisão ou densidade.
