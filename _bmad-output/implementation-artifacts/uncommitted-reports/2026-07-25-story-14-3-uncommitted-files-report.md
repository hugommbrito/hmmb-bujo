# Explicação dos arquivos não commitados — Story 14.3: Fila unificada de migração + aliases finos (backend)

## Visão geral

A Story 14.3 é a **terceira story de código do Épico 14** (Onda 3 — Núcleo BuJo no
Sistema Novo) e é **backend puro** (Django/DRF): materializa a **fila unificada de
migração** (AD-28 item 7 / AD-09; spine M10 do `EXPERIENCE.md`) — uma leitura **100%
derivada por query**, **sem schema novo, sem cron, sem estado acumulado** — e converte
as duas filas legadas (`/migration/queue/` e `/catch-up/queue/`) em **aliases finos**
que projetam o mesmo serviço, sem query própria. Ela **consome** o estado de ciclo da
14.1 e as fontes de ritual da 14.2 (promovendo `undisposed_roots` a pública) e **não**
altera nada das duas.

Peças centrais:

- Novo serviço `unified_migration_queue(*, user)` em `bujo/services/migration.py`
  (coabitando de propósito com a mutação `migrate_task`, AD-28 item 7): 3 seções
  **sempre presentes** na ordem hierárquica **mês → semana → dia**, agrupadas por
  `period_start`, com fronteiras **exclusivas** (`__lt`) que deixam semana/mês
  **anteriores** de fora (território das fontes bloqueantes de ritual da 14.2). Uma
  mecânica única para as 3 seções via dataclass `_SectionSpec` + `_SECTION_SPECS`
  (three linhas de dados, zero corpo copiado — padrão `_CycleSpec` da 14.1 /
  `ALLOWED_DECISIONS` da 14.2) e `annotate(period_start=F(lookup))` que torna o laço de
  agrupamento **sem ramos**. Ordenação **declarada** (`period_start, order_index`),
  apertando o indefinido intra-período das views legadas. Não materializa log, não
  consulta `ritual_decisions` (a mutação é a persistência — achado A1 da 14.2), não
  reusa o `_envelope` de rituais (campos sem significado aqui).
- `MigrationQueueView` e `CatchUpQueueView` viraram **aliases finos**: helper
  compartilhado `_flatten_queue_section` (`only_period`/`exclude_period`) + `_queue_section`;
  **zero** `Task.objects`/`Log.objects`/`.filter(`/`status__in`/`today_for` próprios.
  `log_date` vem de `queue["yesterday"]` (o alias não recalcula tempo). Um teste de
  caracterização com `inspect.getsource` **falha** se um alias reintroduzir query própria.
- `undisposed_roots` **promovida a pública** em `services/rituals.py` (era
  `_undisposed_roots`) + 4 chamadores internos atualizados: fonte única de "raiz aberta"
  agora consumida também pela fila.
- 1 endpoint novo (`GET /api/bujo/migration/unified-queue/`) + 3 serializers de projeção
  (`UnifiedMigrationQueueSerializer`/`UnifiedQueueSectionSerializer`/`UnifiedQueueGroupSerializer`),
  **sem `label`** pt-BR (a cópia é do UI: `sourceId`+`periodStart`), sem query param.
  `TaskSerializer` **intocado** (acrescentar campo quebraria ~10 respostas legadas).
- `schema.yaml` e `types.gen.ts` regenerados com **0 deleções** (`72/0` e `70/0` — prova
  mecânica de aditividade estrita).

**Nenhum arquivo de frontend de produto tocado** além dos gerados; nenhuma migration,
nenhum model, nenhuma decisão nova (`makemigrations --check`: "No changes detected").

**Verificação (citada do Dev Agent Record, do QA e da code review — não re-executada
aqui):** a review (story-automator, auto-fix) fechou como **Aprovada** após corrigir
**1 crítico + 2 médios** (1 baixo registrado). O **C1** era **resíduo de experimento em
produção**: a fronteira da seção `day` em `_SECTION_SPECS` estava revertida como
`lambda today: today + timedelta(days=2)` com o comentário `# EXPERIMENTO (C)` ainda no
fonte — a fila cobrava decisão sobre tarefas de **hoje e amanhã** e o defeito atravessava
para o contrato legado (`catch-up/queue/.dailyTasks`); restaurada para `lambda today: today`.
**C2**: as 3 afirmações de fechamento do dev eram falsas sobre a árvore entregue (grep de
resíduo que não rodou, "pytest 1231 passed" impossível com C1, "E2E 14 passed" sem o spec
novo) — lição transferível: **gate estático verde (ruff/lint-imports) não substitui
re-rodar a suíte depois de um experimento**. **M1**: File List citava um `test-summary-14-3.md`
inexistente (o passo de QA rodou mas não escreveu o resumo). **M2/M3**: contagens não
reconciliadas após o QA (o real é 24 funções → 32 coletados → **1242**). **B1** registrado
sem mudança: `_queue_section` usa `next()` sem default (morre com os aliases no Épico 18).
Gates pós-correção **todos re-executados**: pytest full-suite **1242 passed** / 343.88s,
`ruff check` limpo, `lint-imports` 1/0, `tsc --noEmit` limpo, `spectacular` regenerado
**byte-idêntico** ao commitado, `72/0` e `70/0`, `makemigrations` "No changes detected",
`migrate --check` da branch Neon `e2e` limpo, **E2E 17 passed / 0 failed** (14 de
regressão legada + 3 do spec novo). sprint-status → `done`.

**Total documentado: 13 arquivos** (11 modificados + 2 novos), excluindo este próprio relatório.

## Ordem lógica de funcionamento

1. **Artefatos de planejamento/processo** — story spec, sprint-status, orquestração do
   story-automator.
2. **Primitiva compartilhada** — `services/rituals.py` (`undisposed_roots` promovida a pública).
3. **Serviço** — `services/migration.py` (`unified_migration_queue` + `_SectionSpec`).
4. **Serializers** — projeção da fila (envelope + seção + grupo).
5. **Views + URLs** — view fonte-de-verdade nova + os 2 aliases finos reescritos + 1 rota.
6. **Contrato gerado** — `schema.yaml`, `types.gen.ts` (consumidores do backend).
7. **Testes** — serviço e views, ordenados pela camada que validam.
8. **E2E** — spec de fim a fim contra o Postgres real da branch Neon `e2e`.

---

## 1. Artefatos de planejamento e processo

### `_bmad-output/implementation-artifacts/14-3-fila-unificada-de-migracao-e-aliases-finos-backend.md`

**Função geral do arquivo** — Story spec da 14.3 (NEW, untracked). Fonte da verdade:
`Status: done`, `baseline_commit: 8fca90a`. ACs 1–7, Tasks, Dev Notes, Dev Agent Record,
Senior Developer Review (AI) e File List.

**Função geral da alteração** — Documento de contexto. AC1 (serviço derivado por query
com as fronteiras exatas da união das duas filas), AC2 (zero materialização — sem
`get_or_create_*_log`), AC3 (zero schema novo — sem model/migration/decisão nova), AC4
(3 seções sempre presentes, ordem mês→semana→dia, grupos por `period_start`), AC5 (os
dois aliases finos, sem query própria, contratos legados congelados), AC6 (equivalência
de conjunto entre a união dos aliases e a fila unificada), AC7 (reuso de `undisposed_roots`
e da herança AD-18). Cabeçalho blinda o escopo: backend puro, nenhuma UI nova, só os
gerados de frontend tocados.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo** — Fila e status do sprint (fonte da ordem mestre).

**Função geral da alteração** — `14-3-...: backlog → done` (linha 18/19) com o histórico
anexado (transições e o detalhe da review: C1 resíduo de experimento, C2 gate afirmado
sem execução, M1/M2/M3, B1). `last_updated` reescrito com o resumo da review da 14.3 no
topo. Registra a nota de que a entrada estava em `backlog` embora a story dissesse
`ready-for-dev` (create-story não sincronizou o sprint-status). `epic-14` permanece
`in-progress`.

### `_bmad-output/story-automator/orchestration-14-20260725-024358.md`

**Função geral do arquivo** — Documento de estado da orquestração `bmad-story-automator`
que conduz o Épico 14 (artefato de processo, não runtime).

**Função geral da alteração** — `currentStory: 14.2 → 14.3`; a tabela de progresso marca
14.3 como `create/dev/automate/review = done`, git-commit `in-progress`. 6 linhas de log
anexadas (início 14.3, create verificado, review ciclo 1 PASS, dev-story done → review,
automate done, code-review done).

## 2. Primitiva compartilhada

### `backend/bujo/services/rituals.py`

**Função geral do arquivo** — Serviço das fontes de ritual + decisões-snapshot (14.2).

**Função geral da alteração** — Promove `_undisposed_roots` → `undisposed_roots`
(**pública**) e atualiza os 4 chamadores internos. `+11 / -6`. Nenhuma lógica muda: é o
mesmo predicado (`status__in=UNDISPOSED, parent_task__isnull=True`, `UNDISPOSED` de
`archive.py`, não redeclarado). A docstring registra por que promover em vez de importar
um símbolo privado: mantém **fonte única de "raiz aberta"** entre serviços sem tornar o
acoplamento invisível.

**Blocos principais**
- `undisposed_roots(queryset)` (l.238): assinatura pública; corpo intacto.
- 4 call-sites internos atualizados: `_blocking_previous_source`,
  `list_monthly_tasks_in_week`, `list_pending_daily_groups`, `list_future_log_items`.

## 3. Serviço

### `backend/bujo/services/migration.py`

**Função geral do arquivo** — Migração de tarefas pendentes (mutação `migrate_task`) e,
desde a 14.3, **a fila que a alimenta** (leitura `unified_migration_queue`). As duas
metades do mesmo agregado coabitam de propósito (AD-28 item 7). `+158 / -4`.

**Função geral da alteração** — Adiciona a fila unificada 100% derivada por query, sem
schema, sem cron, sem estado acumulado (AD-09 item 2).

**Blocos principais**
- Docstring do módulo reescrita: separa **mutação** (`migrate_task`/`_migrate_subtree`/
  `inherited_successor_status`, que reusa `create_task`/`update_task`/`transition_task`) da
  **leitura** (`unified_migration_queue`); justifica manter as duas no mesmo arquivo.
- Import novo `from bujo.services.rituals import undisposed_roots` (consome a primitiva
  promovida na seção 2), além de `OrderedDict`, `Callable`, `dataclass`, `date`/`timedelta`,
  `F`.
- `_previous_week_start`/`_previous_month_first` (helpers de fronteira; `.replace(day=1)`
  inline porque `core/calendar.py` não expõe `month_first_for`).
- `@dataclass(frozen=True) _SectionSpec` (l.~180): o que **diverge** entre as 3 seções e
  nada mais — `source_id`, `period_lookup` (caminho ORM da chave de período) e `boundary`
  (deriva a fronteira exclusiva a partir de `hoje`). Docstring explica por que **não** há
  um 4º campo com "nome do atributo da chave": a derivação anota sempre com o **mesmo alias**
  `period_start` via `F(period_lookup)`, então o laço fica sem ramos.
- `_SECTION_SPECS` (tupla; l.~210): `("month", "monthly_log__month_first", _previous_month_first)`,
  `("week", "weekly_log__week_start", _previous_week_start)`, `("day", "log__log_date",
  lambda today: today)`. **Esta tupla É o contrato de ordem** (mês→semana→dia). Comentário
  registra que as fronteiras são **exclusivas** de propósito (semana/mês anteriores são as
  fontes bloqueantes da 14.2; escoá-las aqui criaria duas superfícies para a mesma pendência)
  e que "ontem" É o nível `day` (`< hoje`), não uma quarta seção.
- `unified_migration_queue(*, user)` (l.~228): laço sobre `_SECTION_SPECS` →
  `undisposed_roots(...filter(period_lookup__lt=boundary(today)))`,
  `.annotate(period_start=F(period_lookup))` (chave na **mesma** query — senão N+1),
  `.prefetch_related("subtasks")` (reduz a recursão do `TaskSerializer`),
  `.order_by("period_start", "order_index")` (ordenação declarada, substitui o
  `Meta.ordering`). Agrupa em `OrderedDict` por `period_start`. Devolve dict puro
  `{total_count, sections:[{source_id,count,groups:[{period_start,items:[Task]}]}], yesterday}`.
  Docstrings registram: leitura pura (sem `@transaction.atomic`, sem `get_or_create_*_log`,
  sem `all_objects`); `yesterday` é chave **interna** (consumida só pelos aliases;
  `Serializer` com campos declarados ignora chaves extras → não vaza); `total_count` é soma
  direta sem dedup (`Task` tem 1 container por CHECK `task_exactly_one_log`, seções disjuntas
  por garantia do banco); e por que **não** reusa `_envelope`/`_bucket` de `rituals.py` nem
  consulta `ritual_decisions`.

**Comportamento de libs usadas**
- `F(period_lookup)`: expõe a coluna do container como atributo anotado uniforme da `Task`.
- `prefetch_related("subtasks")`: cobre profundidade 1 da recursão do serializer (reduz, não
  elimina queries).
- `order_by(...)`: em Django 5.2 substitui integralmente `Meta.ordering` — a ordem
  intra-período passa a ser contrato.

## 4. Serializers

### `backend/bujo/serializers.py`

**Função geral do arquivo** — Serializers DRF do `bujo` (validam/projetam forma, não regra).

**Função geral da alteração** — Adiciona os 3 serializers de projeção da fila unificada.
`+32 / -0`. `Serializer` puros (não `ModelSerializer`): projetam o dict do serviço, como os
4 serializers de fila legados.

**Blocos principais**
- `UnifiedQueueGroupSerializer`: `period_start` (`DateField`) + `items` (`TaskSerializer(many=True)`).
  Comentário registra que a chave uniforme de período é de onde a Task Row deriva a "origem"
  (M10) e que ids de container **não** são contrato de API neste domínio (achado M1 da 14.2).
- `UnifiedQueueSectionSerializer`: `source_id` (`CharField`, **não** `ChoiceField` — evita um
  Enum de ruído no schema para 3 valores que só o backend emite), `count` (`IntegerField`),
  `groups` (`many=True`).
- `UnifiedMigrationQueueSerializer`: `total_count` + `sections`. Note que **não** declara
  `yesterday` — a chave interna do serviço é ignorada.

## 5. Views e URLs

### `backend/bujo/views.py`

**Função geral do arquivo** — Views DRF (`APIView`) do `bujo`. Views finas. `+85 / -34`.

**Função geral da alteração** — Adiciona a view fonte-de-verdade nova e **reescreve os dois
aliases** para projetarem o serviço unificado, removendo toda query própria. Import de `Log`
removido (não usado mais); `UnifiedMigrationQueueSerializer` e `unified_migration_queue`
importados.

**Blocos principais**
- Comentário de seção documenta a arquitetura: fonte de verdade = `UnifiedMigrationQueueView`;
  aliases = `MigrationQueueView`/`CatchUpQueueView` (mesmas rotas/serializers, zero query própria);
  remoção formal é do Épico 18.
- `_flatten_queue_section(section, *, only_period=None, exclude_period=None)`: helper único dos
  **dois** aliases — achata os grupos numa lista de tarefas, filtrando por período (o
  `/migration/queue/` quer **só** o grupo de ontem; o `/catch-up/queue/` quer **tudo menos**
  ontem).
- `_queue_section(queue, source_id)`: `next(...)` da seção pelo `source_id` (B1 conhecido: sem
  default).
- `UnifiedMigrationQueueView.get`: `@extend_schema(responses=UnifiedMigrationQueueSerializer)`;
  chama o serviço e projeta. Sem query param (AD-09 item 8 — apresenta tudo, sem paginação).
- `MigrationQueueView.get` (**alias**): `log_date = queue["yesterday"]` (não recalcula tempo →
  imune à virada do dia entre leituras), `tasks = _flatten_queue_section(_queue_section(queue,
  "day"), only_period=yesterday)`. Docstring redigida **sem** o literal `today_for` de propósito
  (o guard lê a classe inteira).
- `CatchUpQueueView.get` (**alias**): `monthly_tasks`/`weekly_tasks` das seções `month`/`week`;
  `daily_tasks` da seção `day` com `exclude_period=queue["yesterday"]` (a única divergência de
  recorte: catch-up exclui ontem, que é do outro alias). Remove a função local `undisposed_roots`
  e os 3 blocos de query manuais legados.

### `backend/bujo/urls.py`

**Função geral do arquivo** — Roteamento do `bujo`.

**Função geral da alteração** — Importa `UnifiedMigrationQueueView` e adiciona **1 rota**:
`migration/unified-queue/` (`name="bujo-unified-migration-queue"`). `+10 / -0`. Comentário
registra que a AD escreve `GET /api/migration/unified-queue/` mas a rota real leva o prefixo
do app (`api/bujo/`, `config/urls.py`), como todas as rotas de `bujo`.

## 6. Contrato gerado (produtores → consumidores)

### `schema.yaml`

**Função geral do arquivo** — OpenAPI gerado por `manage.py spectacular` (autoridade do
contrato; guardrail de CI compara com `types.gen.ts`).

**Função geral da alteração** — **Gerado**, não editado à mão. `+72 / -0`: o path novo
`/api/bujo/migration/unified-queue/` e os schemas de fila/seção/grupo. **Zero deleções** =
aditividade estrita. Na review, `spectacular` regenerado bateu byte-idêntico ao commitado.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo** — Tipos TS gerados a partir do `schema.yaml`
(`npm run generate-types`). **Nunca** editado à mão.

**Função geral da alteração** — **Gerado**. `+70 / -0`: tipos do endpoint e dos envelopes
novos, zero deleções. `tsc --noEmit` limpo.

## 7. Testes (por camada)

### `backend/bujo/tests/test_services.py`

**Função geral do arquivo** — Testes de serviço. `+498 / -1`.

**Função geral da alteração** — ~14 funções novas (3 parametrizadas) + helpers `_fronteiras`/
`_secao`/`_ids_da_secao`, cobrindo: fronteira exclusiva de cada seção (`month`/`week`/`day`
inclui ontem), **ordem** das seções mês→semana→dia sobre a lista, grupos crescentes e itens
por `order_index`, `count` por seção/total e seções vazias presentes, descarte de dispostos e
de subtarefas (só raízes de topo), **re-derivação** removendo o item decidido sem persistência
nova, herança de `status`/`waiting_on` por seção (AD-18, parametrizada por seção-alvo),
`migration count` por decisão e não por dia pulado, **zero materialização** provada como leitura
pura, isolamento por tenant, ausência de N+1 por grupo, e sucessor de **qualquer** destino não
reentrando na fila (parametrizada por destino).

### `backend/bujo/tests/test_views.py`

**Função geral do arquivo** — Testes de view/HTTP (DRF `APIClient`). `+334 / -1`.

**Função geral da alteração** — ~10 funções novas (2 parametrizadas) + helpers
`_ids_de_topo_da_fila_unificada`/`_semear_cenario_da_fila`: `401` sem autenticação; isolamento
por tenant com Bearer real; forma de fio camelCase; seções vazias presentes sem materializar log;
**união dos dois aliases equivale à fila unificada** (equivalência de conjunto, AC6); **partição
de ontem** entre os dois aliases; **`test_aliases_de_fila_nao_contem_query_propria`** (guard por
`inspect.getsource` — falha se um alias reintroduzir `Task.objects`/`.filter(`/`status__in`/
`today_for`); a fila **recusa escrita** (parametrizada por método); ignora query params e não
pagina; e ignora períodos **futuros** nos três níveis (6 distratores).

## 8. E2E (Playwright)

### `frontend/e2e/unified-migration-queue.spec.ts`

**Função geral do arquivo** — Spec E2E novo (NEW) — 3 testes contra o backend real da branch
Neon `e2e`. Reusa `countRitualContainers` (contagem fora do fio), `seedCatchUpScenario` e
`seedYesterdayQueue`.

**Função geral da alteração** — Cobre o que só o fim-a-fim prova: (1) **AC5/AC6** — os **dois
banners legados** renderizados (migração de ontem = 1; Catch-Up = 3) e a fila unificada contam
a **mesma coisa** no mesmo banco (`totalCount == 4`, seções `[["month",1],["week",1],["day",2]]`,
equivalência de conjunto sem dedup, e a subtarefa aberta viajando aninhada, fora da contagem de
topo); (2) **AC3** — decidir pela **UI legada** (`MigrationFlow`, atalho "1") **escoa** a fila
unificada (re-derivação: item sai, resto permanece, seção `day` segue presente), o alias de ontem
esvazia no servidor, o de catch-up não é tocado, e **`ritual_decisions` continua vazia**
(`countRitualContainers(email).decisions === 0` — AD-28 item 6, a mutação é a persistência); (3)
**AC2** — três leituras seguidas + os dois aliases **não materializam** container nenhum no
Postgres real (contagem via `countRitualContainers` idêntica antes/depois), atravessando o ciclo
de request completo (JWT + middleware de tenant). Usa `queueApi` com JWT real; assume a
`BrainDumpCaptureSheet` portalizada da 13.3 (locators escopados, sem campo de formulário sem escopo).

---

**Nota:** nenhum comportamento de código-fonte foi alterado na produção deste relatório —
apenas leitura de `git status`/`git diff` e dos arquivos novos. Testes/gates não foram
re-executados aqui; as contagens e vereditos citados vêm do Dev Agent Record, do
sprint-status e da Senior Developer Review já registrados na story.
