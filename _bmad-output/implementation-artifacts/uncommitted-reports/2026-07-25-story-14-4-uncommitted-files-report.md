# Explicação dos arquivos não commitados — Story 14.4: Soft delete de templates recorrentes (backend)

## Visão geral

A Story 14.4 é a **quarta story de código do Épico 14** (Núcleo BuJo no Sistema Novo) e é
**backend puro** (Django/DRF): implementa o **soft delete** de `RecurringTaskTemplate`
(spine **M09** do `EXPERIENCE.md` + **UX-DR24**), ou seja — *"o template sai da biblioteca
e dos rituais, mas o registro persiste para preservar a linhagem (`source_template`) das
tarefas já alocadas; não há exclusão física"*. A entrega inteira cabe em quatro peças de
produção: **uma coluna nulável**, **um helper compartilhado**, **um serviço idempotente** e
**um verbo HTTP** acrescentado a uma rota que já existia. Nenhum serializer novo, nenhuma
rota nova, nenhuma exceção nova, nenhum arquivo de produção novo, e nenhum arquivo de
frontend de produto tocado além dos dois gerados.

Peças centrais:

- **Coluna `deleted_at` (nulável) + migration `0009` aditiva.** `deleted_at IS NULL` = vivo,
  `IS NOT NULL` = excluído. A migration tem **um** `AddField` e nada mais — sem `RunPython`,
  sem backfill (toda linha pré-existente nasce `NULL` = viva). O carimbo vem de
  `core.calendar.now()` (única fonte de "agora" fora do guardrail de AST). Escolha
  deliberada de `DateTimeField` nulável em vez de `BooleanField`: uma flag lógica **com**
  auditoria de "quando", sem coluna extra.
- **`live_templates(queryset=None)` em `services/recurring.py`** — a definição **única** de
  "template vivo", espelhando a forma de `undisposed_roots` (helper de módulo que recebe e
  devolve queryset, **não** manager, **não** classe — as três razões estão no docstring).
  Aplicado nos **seis** pontos de leitura de template (listagem, fonte weekly, fonte monthly
  em `monthly` **e** `annual`, `update_template`, `place_template`), com filtro na **origem**
  de cada queryset (antes de `annotate`/`exclude`), o que cobre `items` + `alreadyPlaced` e as
  três saídas do bloco anual de uma vez (achado A1 da 14.2). Um **sétimo** ponto herda o
  filtro de graça: `upsert_ritual_decision` troca uma expressão e `skip_week` sobre excluído
  cai no `item is None` que já existia → **409 `InvalidRitualDecision`** com a mensagem neutra,
  sem exceção nem mensagem nova.
- **`soft_delete_template(*, user, template_id)`** — serviço idempotente que **jamais** emite
  `DELETE` físico. Localiza pelo manager escopado **sem** `live_templates` (única exceção à
  regra, porque a idempotência precisa achar a linha já excluída), devolve sem escrever se
  `deleted_at` já estiver preenchido, e grava com `save(update_fields=["deleted_at"])` — uma
  coluna só, o que garante mecanicamente que `active` e o conteúdo não são tocados.
- **`DELETE /api/bujo/recurring-templates/<pk>/` → 204** acrescentado à
  `RecurringTaskTemplateDetailView` **existente** (nenhuma rota nova em `urls.py`), idempotente,
  `@extend_schema(responses={204: None})`. `deleted_at` **não** é exposto em serializer nenhum;
  não há endpoint de restauração — irreversível na API, não só na UI.
- **`schema.yaml` e `types.gen.ts` regenerados**: `schema.yaml` fecha **16/0**; `types.gen.ts`
  fecha **21/1** — a única deleção é o placeholder `delete?: never` do path existente virando
  `delete: operations["bujo_recurring_templates_destroy"]`, que o `openapi-typescript` reescreve
  **por força do formato** ao acrescentar um verbo; nenhum componente muda de forma
  (divergência da AC7 documentada e aceita na review).

**Nenhum model novo, nenhuma constraint nova, nenhum índice novo** (`makemigrations --check`:
"No changes detected"). O bloco de schema da AD-08 em `architecture.md` foi atualizado como
as-built (ganhou `deleted_at` + item 6b, e de quebra `category`, um gap pré-existente do mesmo
bloco desde a migration `0005`).

**Verificação (citada do Dev Agent Record, do passo de QA e da Senior Developer Review — não
re-executada na produção deste relatório):** a review (story-automator, auto-fix) fechou como
**Aprovada** com **0 críticos e 0 altos** — a primeira story do Épico 14 em que **nenhum** gate
afirmado precisou de correção (as lições C1/C2 da 14.3, resíduo de experimento no fonte e
número afirmado sem execução, **não** se repetiram). Foram corrigidos **1 médio + 2 baixos**:
**A1** (médio) — `update_fields=["deleted_at"]` não estava pinado por teste nenhum; confirmado
por mutação (`save()` puro deixava a suíte inteira verde, porque os asserts existentes são de
**valor** e um save completo reescreve as colunas com os mesmos valores), risco real de *lost
update* contra `PATCH` concorrente; corrigido com um teste que captura o SQL e exige um
`UPDATE` citando **só** `deleted_at`. **B1** (baixo) — dois asserts tautológicos no spec E2E
(`expect(a.id).not.toBe(b.id)`) trocados por conferência do estado do servidor via `api.list()`.
**B2** (baixo) — docstring do módulo afirmava que `soft_delete_template` era a única exceção ao
filtro, mas `purge_e2e_users` remove templates fisicamente via `all_objects`; escopo da regra
delimitado ao caminho `objects`. Gates re-executados pela review: **pytest full-suite 1269
passed** / 240.80s, `ruff check` limpo, `lint-imports` 1/0, `ruff format --check` 48 arquivos
(mesma lista da baseline, com `recurring.py`/`rituals.py`/`0009` fora dela), `makemigrations`
"No changes detected", `tsc`/`eslint` limpos, `migrate --check` da branch Neon `e2e` exit 0
(bug recorrente 7.1/7.2/14.1 não se repetiu), `schema.yaml` byte-idêntico à regeneração limpa,
`16/0` e `21/1`, resíduo de experimento zero (7 experimentos de não-vacuidade no total, 3 do
`dev-story` + 4 do QA, restaurados e conferidos por `md5`), **E2E 11 passed / 1 failed** (a
única falha é a pré-existente `recurring-templates.spec.ts:306`, locator `Definir placement`,
herdada da 13.3 e já medida na 14.2 e na 14.3). sprint-status → `done`.

**Total documentado: 17 arquivos** (13 modificados + 4 novos), excluindo este próprio relatório.

## Ordem lógica de funcionamento

1. **Artefatos de planejamento/processo** — story spec, `architecture.md` (as-built AD-08),
   sprint-status, orquestração do story-automator, resumo do passo de QA.
2. **Modelo de dados e migration** — `models.py` (`deleted_at`) → `0009_...deleted_at.py`.
3. **Serviço** — `services/recurring.py` (`live_templates` + `soft_delete_template`) e
   `services/rituals.py` (o 7º ponto herdado + as 3 querysets filtradas na origem).
4. **Views** — `views.py` (listagem filtrada + método `delete` na view de detalhe). `urls.py`
   **não** é tocado (a rota já existia).
5. **Contrato gerado** — `schema.yaml`, `types.gen.ts` (consumidores do backend).
6. **Testes** — factory, model, serviço e views, ordenados pela camada que validam.
7. **E2E** — spec de fim a fim contra o Postgres real da branch Neon `e2e`.

---

## 1. Artefatos de planejamento e processo

### `_bmad-output/implementation-artifacts/14-4-soft-delete-de-templates-recorrentes-backend.md`

**Função geral do arquivo** — Story spec da 14.4 (NEW, untracked). Fonte da verdade:
`Status: done`, `baseline_commit: fc4d46c`. 7 ACs, 7 Tasks, Dev Notes, Dev Agent Record,
Senior Developer Review (AI), Change Log e File List.

**Função geral da alteração** — Documento de contexto. AC1 (coluna `deleted_at` nulável +
migration aditiva nomeada, aplicada a `dev` **e** à branch Neon `e2e`), AC2 (`live_templates()`
como definição única de "vivo" nos seis pontos de leitura + o sétimo herdado), AC3
(`soft_delete_template` idempotente que jamais emite `DELETE` físico), AC4 (`DELETE …/<pk>/` →
204 idempotente, sem caminho de volta), AC5 (linhagem íntegra: FK, registro e `TaskSerializer`
sobrevivem), AC6 (Ativar/Desativar × Excluir provados **distintos** numa matriz de 4 células),
AC7 (contrato aditivo, gates verdes, não-vacuidade provada). O cabeçalho blinda o escopo: backend
puro, nenhuma UI nova, `serializers.py`/`urls.py`/`RecurringTemplateManager.tsx` intocados; o
botão **Excluir** é da 14.8, que aciona o serviço entregue aqui.

### `_bmad-output/planning-artifacts/architecture.md`

**Função geral do arquivo** — Documento de arquitetura (autoridade de forma; ADs). Planning
artifact.

**Função geral da alteração** — Fecha o gap de spec da **AD-08** como as-built da 14.4.
`+6 / -2` (2 hunks). Não muda comportamento — é reconciliação documento↔código.

**Blocos principais**
- Novo item **6b** (l.~510): *"Exclusão é LÓGICA e ortogonal a `active`"* — descreve
  `deleted_at TIMESTAMPTZ NULL`, a ausência de exclusão física em qualquer caminho de produção,
  a linhagem via `tasks.source_template_id` (`SET_NULL`), o helper único `live_templates`, a
  exceção `soft_delete_template` e o contrato HTTP (`DELETE` → 204; `PATCH`/`place` sobre
  excluído → 404).
- Bloco de schema de `recurring_task_templates` (l.~537-546): acrescenta
  `deleted_at TIMESTAMPTZ NULL` **e** `category ENUM(...) NULL` (este último presente no model
  desde a `0005` e ausente do bloco — gap as-built pré-existente, reconciliado na mesma edição);
  vírgula acrescentada à linha `active` para acomodar a nova coluna.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo** — Fila e status do sprint (fonte da ordem mestre).

**Função geral da alteração** — `14-4-...: backlog → done` (l.18/19) com o histórico completo
anexado ao valor (transições `ready-for-dev` → `in-progress` → `review` → `done` e o detalhe da
review: A1/B1/B2, todos os gates re-executados, a divergência aceita da AC7 `21/1`). `last_updated`
reescrito com o resumo da 14.4 no topo. `epic-14` permanece `in-progress`. Nota: a entrada estava
em `backlog` embora a story já dissesse `ready-for-dev` (o create-story não sincronizou o
sprint-status — mesma observação registrada na 14.3).

### `_bmad-output/story-automator/orchestration-14-20260725-024358.md`

**Função geral do arquivo** — Documento de estado da orquestração `bmad-story-automator` que
conduz o Épico 14 (artefato de processo, não runtime).

**Função geral da alteração** — `currentStory: 14.3 → 14.4`; `lastUpdated` avançado; a tabela de
progresso marca 14.3 como fechada (`git-commit = done`) e 14.4 como `create/dev/automate/review =
done`, `git-commit in-progress`. 8 linhas de log anexadas (fim da 14.3, início da 14.4, create
verificado, review ciclo 1 PASS, dev-story done → review com pytest 1262 e a migration 0009,
automate/QA done com o spec E2E novo e pytest 1268, code-review done).

### `_bmad-output/implementation-artifacts/tests/test-summary-14-4.md`

**Função geral do arquivo** — Resumo do passo de QA (`bmad-qa-generate-e2e-tests`) da 14.4 (NEW,
untracked). Artefato de processo/testing (a ausência dele foi o achado M1 da 14.3).

**Função geral da alteração** — Documenta as lacunas que o passo de QA fechou: 6 testes de API
(blindagem de `deletedAt` por conjunto de chaves; os três query params combinados; o fio das
fontes de ritual semanal e mensal — inclusive o 4º bucket `alreadyPlaced` que não tinha cobertura
de exclusão em nenhuma camada; `POST /ritual-decisions/` sobre excluído em 409 neutro; interação
14.2 × 14.4 preservando a decisão-snapshot) e o **primeiro spec E2E** da story (4 testes). Registra
**3 achados** (nenhum defeito de produção; a fonte mensal tem **quatro** buckets observáveis, não
três; excluir um recorrente pendente mexe no progresso do ritual), os **4 experimentos** de
não-vacuidade extras (d–g, resíduo zero por `md5`) e os gates (pytest full-suite **1268 passed**,
E2E 11p/1f).

## 2. Modelo de dados e migration

### `backend/bujo/models.py`

**Função geral do arquivo** — Models do app `bujo` (`Task`, logs, `RecurringTaskTemplate`,
`RitualDecision`, etc.), todos herdando `TenantModel` (UUID pk, `objects` auto-escopado).

**Função geral da alteração** — Acrescenta **um** campo a `RecurringTaskTemplate`. `+11 / -0`.
Nenhum outro model, campo, constraint ou índice mudou.

**Blocos principais**
- `deleted_at = models.DateTimeField(null=True, blank=True)` (l.~431), logo **abaixo** de
  `active` — os dois eixos ficam adjacentes e o contraste vira documentação. Comentário extenso
  registra: soft delete de M09/UX-DR24 (`NULL` = vivo); o **contraste deliberado** com `active`
  (`active` reversível e prospectivo, `deleted_at` terminal, os dois ortogonais); a razão de o
  registro persistir (`Task.source_template` aponta para ele com `SET_NULL`, e exclusão física
  apagaria a linhagem em silêncio); e a decisão de **não** criar índice parcial (tabela de
  caderno pessoal, `user_id` já indexado — otimização especulativa, registrada para a review não
  a ler como esquecimento).

### `backend/bujo/migrations/0009_recurringtasktemplate_deleted_at.py`

**Função geral do arquivo** — Migration da coluna nova (NEW, untracked). É a `0009` da app
`bujo` (`dependencies = [("bujo", "0008_ritual_decisions")]`).

**Função geral da alteração** — Gerada por `makemigrations -n`. Contém **um** `AddField`
(`recurringtasktemplate.deleted_at`, `DateTimeField(blank=True, null=True)`) e **nada mais**:
sem `RunPython`, sem `AlterField` em outra coluna, sem `CreateModel`, sem backfill. Em Postgres,
`ADD COLUMN … NULL` é `ALTER TABLE` sem reescrita de tabela nem lock longo (Django 5.2.15). No
estilo default do Django (aspas simples), coerente com `0006`/`0008`; o `ruff format` **exclui**
`migrations/` (`extend-exclude` no `pyproject.toml`), então a `0009` não entra em nenhuma lista.
Aplicada a `dev` **e** à branch Neon `e2e` com `migrate --check` limpo nas duas antes do
Playwright (Dev Agent Record).

## 3. Serviço

### `backend/bujo/services/recurring.py`

**Função geral do arquivo** — Serviço do agregado de recorrentes: criação, edição, placement
e, desde a 14.4, **exclusão lógica**. Funções de módulo `@transaction.atomic`, todas com
`RecurringTaskTemplate.objects` (auto-escopado por tenant). `+58 / -4`.

**Função geral da alteração** — Adiciona `live_templates` (definição única de "vivo") e
`soft_delete_template` (o serviço idempotente), e passa `update_template`/`place_template` a
lerem por `live_templates()`.

**Blocos principais**
- Docstring do módulo reescrita (l.1-16): cobre agora **exclusão lógica**, aponta `live_templates`
  como a origem única dos vivos e — correção **B2** da review — delimita o escopo dessa regra ao
  caminho tenant-scoped (`objects`), nomeando o escape hatch `all_objects` de
  `management/commands/purge_e2e_users.py` (que remove templates fisicamente, deliberado por AD-12)
  como fora dela. Redigida **sem** o literal proibido pelo guard de `inspect.getsource`.
- Import novo `from core.calendar import now` (l.~22).
- `live_templates(queryset=None)` (l.~24-48): `base = queryset if queryset is not None else
  RecurringTaskTemplate.objects.all()`; `return base.filter(deleted_at__isnull=True)`. Docstring
  com as **três razões** de ser helper e não manager: (a) filtro default esconderia a linha até de
  `soft_delete_template`; (b) filtro implícito é invisível no call site (o repo já fixou com
  `undisposed_roots` que predicado compartilhado é explícito e greppável); (c) `objects` precisa
  continuar sendo `TenantManager` (`core/tests/test_guardrails.py`), e amarrar escopo de tenant +
  soft delete num manager só seria acoplamento indevido.
- `update_template` (l.~56): `RecurringTaskTemplate.objects.get(...)` → `live_templates().get(...)`
  (comentário *"auto-escopado por tenant; vivos só"*). `DoesNotExist` continua a exceção levantada
  → 404 na view (sem mudança de view).
- `soft_delete_template(*, user, template_id) -> RecurringTaskTemplate` (l.~58-82): `@transaction.
  atomic`; `template = RecurringTaskTemplate.objects.get(id=template_id)` — **sem** `live_templates`,
  com comentário obrigatório explicando que é a **única** exceção à regra (a idempotência exige
  encontrar a linha já excluída); `if template.deleted_at is not None: return template` (early-return
  **antes** de qualquer `save` — é o que os testes de idempotência em SQL pinam); senão
  `template.deleted_at = now()` + `template.save(update_fields=["deleted_at"])` (uma coluna só).
- `place_template` (l.~93): `RecurringTaskTemplate.objects.get(...)` → `live_templates().get(...)`
  (comentário *"auto-escopado + vivos; 404 na view"*); o restante (snapshot dos campos no instante
  do placement) intacto.

**Comportamento de libs usadas**
- `core.calendar.now()`: única fonte de "agora" (`TIMESTAMPTZ`) do projeto, o docstring dela
  nomeia exatamente este caso (*"timestamps de auditoria de escrita"*); o guardrail de AST proíbe
  `timezone.now()` em produção fora de `core/calendar.py`.
- `QuerySet.filter(deleted_at__isnull=True)`: compõe com os filtros de cada chamador (`active=True`,
  `recurrence_group=…`) em vez de recriá-los — é o que permite o filtro na origem.
- `Model.save(update_fields=[...])`: emite um `UPDATE` **só** com as colunas listadas; sem ele o
  Django reescreveria todas as colunas (o risco de *lost update* do achado A1).

### `backend/bujo/services/rituals.py`

**Função geral do arquivo** — Serviço das fontes dos rituais + decisões-snapshot (14.2).

**Função geral da alteração** — Passa a consumir `live_templates` no **sétimo** ponto (herdado)
e nas **três** querysets de template das fontes. `+22 / -6`. Nenhuma lógica de ritual muda — só a
origem dos templates ganha o filtro de vivos.

**Blocos principais**
- Import novo `from bujo.services.recurring import live_templates` (l.51). Verificado que **não**
  cria ciclo (`recurring.py` não importa `rituals`); `lint-imports` segue 1/0.
- `upsert_ritual_decision` (l.~145): `RecurringTaskTemplate.objects.filter(pk=…)` →
  `live_templates().filter(pk=…)`. Comentário registra que um template excluído não é decidível —
  cai no `if item is None: raise InvalidRitualDecision(_ILLEGAL)` que já existia (`skip_week` sobre
  excluído → 409 neutro, sem exceção nem mensagem nova).
- `list_weekly_recurring_candidates` (l.~357-364): a queryset de templates weekly passa a ser
  `live_templates(RecurringTaskTemplate.objects.filter(active=True, recurrence_group=WEEKLY))` —
  filtro na **origem**, antes do `annotate`/`order_by`, o que cobre `items` **e** `alreadyPlaced`
  de uma vez (`_partition_by_placement` parte a mesma queryset).
- `list_monthly_recurring_candidates` (l.~457-477): mesmo tratamento para `monthly_templates` e
  para a queryset `annual`, esta com comentário explicando que as **três** saídas derivadas
  (`annual_eligible`, `annual_in_year`, contagens) herdam o filtro de uma vez porque partem da
  `annual` já filtrada.

## 4. Views

### `backend/bujo/views.py`

**Função geral do arquivo** — Views DRF (`APIView`) do `bujo`. Views finas (serviço → resposta).
`+29 / -3`.

**Função geral da alteração** — Filtra a listagem por `live_templates()` e acrescenta o método
`delete` à view de detalhe **existente**. `urls.py` **não** é tocado (a rota
`recurring-templates/<uuid:pk>/` já roteia o verbo).

**Blocos principais**
- Import (l.75-81): a linha única `from bujo.services.recurring import create_template,
  place_template, update_template` vira import multi-linha acrescentando `live_templates` e
  `soft_delete_template` em ordem alfabética (isort é gate).
- `RecurringTaskTemplateListView.get` (l.~221-224): `RecurringTaskTemplate.objects.all().order_by(
  "recurrence_text")` → `live_templates().order_by("recurrence_text")`, com comentário de que o
  excluído some da biblioteca em **toda** combinação de query param (os três filtros —`active`,
  `recurrence_group`, `unplaced_year`— encadeiam depois, inalterados).
- `RecurringTaskTemplateDetailView` (l.~254-284): comentário de classe registra que o `DELETE` é
  exclusão **lógica** e por que é comentário `#` e **não** docstring (o `drf-spectacular`
  promoveria o docstring da classe a `description` de **todas** as operações, poluindo o `PATCH`
  no contrato — divergência #2 do Dev Agent Record). Método novo `delete(self, request, pk)`
  (l.~275-284): `@extend_schema(responses={204: None})`; `try: soft_delete_template(user=request.
  user, template_id=pk) except RecurringTaskTemplate.DoesNotExist: raise NotFound() from None`;
  `return Response(status=status.HTTP_204_NO_CONTENT)`. Comentário registra o 204 sem corpo e a
  idempotência. `NotFound`/`Response`/`status` já estavam importados.

**Comportamento de libs usadas**
- `@extend_schema(responses={204: None})`: gera uma resposta 204 sem `content` no OpenAPI — a forma
  correta para No Content, **sem** criar componente novo.

## 5. Contrato gerado (produtores → consumidores)

### `schema.yaml`

**Função geral do arquivo** — OpenAPI gerado por `manage.py spectacular` (autoridade do contrato;
guardrail de CI compara com `types.gen.ts`).

**Função geral da alteração** — **Gerado**, não editado à mão. `+16 / -0`: a operação
`delete` (`operationId: bujo_recurring_templates_destroy`) sob o path **já existente**
`/api/bujo/recurring-templates/{id}/` — param `id` (uuid), `security: jwtAuth`, resposta `204`
sem corpo. **Zero deleções** = aditividade estrita. Na review, `spectacular` regenerado bateu
byte-idêntico ao commitado.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo** — Tipos TS gerados a partir do `schema.yaml`
(`npm run generate-types`). **Nunca** editado à mão. `tsc --noEmit` limpo.

**Função geral da alteração** — **Gerado**. `+21 / -1`. A única deleção é a linha
`delete?: never;` do path existente virando `delete: operations["bujo_recurring_templates_destroy"];`
— o `openapi-typescript` emite um placeholder por verbo ausente, então acrescentar um verbo
**necessariamente** reescreve essa linha (divergência declarada da AC7, que previa 21/0; a
invariante real — *"nenhum componente muda de forma"* — vale: 2 hunks, nenhum outro tipo mudou).
O bloco novo `bujo_recurring_templates_destroy` declara `path: { id: string }` e a resposta 204
sem `content`. Nenhum consumidor foi acrescentado no frontend (`api.ts`/`types.ts`/`keys.ts`
intocados — o tipo existir sem consumidor é esperado; a 14.8 o consome).

## 6. Testes (por camada)

### `backend/bujo/tests/factories.py`

**Função geral do arquivo** — Factories dos testes (`factory_boy`). O guardrail de AST de tempo
**varre** este arquivo (só `test_*.py`/`conftest.py` são pulados), daí a regra "datas fixas,
nunca `now()`". `+7 / -1`.

**Função geral da alteração** — Acrescenta o trait `deleted` a `RecurringTaskTemplateFactory`
(dentro da `class Params:` que já existia) porque 3+ testes repetiriam o literal:
`deleted = factory.Trait(deleted_at=datetime(2026, 1, 1, tzinfo=UTC))` — **data fixa**, com
comentário explicando por quê. Import ampliado: `from datetime import date, timedelta` →
`from datetime import UTC, date, datetime, timedelta`. Nenhum caso novo em
`register_isolation_case` (nenhum model novo nasceu).

### `backend/bujo/tests/test_models.py`

**Função geral do arquivo** — Testes de model. `+21 / -2`.

**Função geral da alteração** — 1 teste novo + 1 frase de docstring.
- `test_recurring_task_template_nasce_com_deleted_at_nulo` (l.~225): prova que `deleted_at` nasce
  `NULL` pelo default da coluna (não por escrita) — é a base da aditividade da `0009`.
- `test_deletar_template_nao_deleta_a_task_instancia_set_null` (l.~234): **asserts intocados**;
  o docstring ganha a frase esclarecendo que, a partir da 14.4, **nenhum** caminho de produção
  chega ali (a API só faz exclusão lógica; o teste exercita `on_delete=SET_NULL` no nível **ORM**,
  a rede de segurança do banco) — corrige a "docstring que induz a erro" nomeada na 14.3.

### `backend/bujo/tests/test_services.py`

**Função geral do arquivo** — Testes de serviço. `+313 / -1`.

**Função geral da alteração** — **11** funções `test_` novas (import de `recurring` ampliado para
multi-linha), cobrindo a camada de serviço do soft delete:
- `..._grava_deleted_at_sem_tocar_active_nem_conteudo` — comparação campo a campo (só `deleted_at`
  muda).
- `..._idempotente_preserva_o_deleted_at_original_sem_escrita` — idempotência via `_sem_escrita`
  (`CaptureQueriesContext`): re-execução com o mesmo carimbo e **zero** `INSERT`/`UPDATE`/`DELETE`.
- `..._escreve_SOMENTE_a_coluna_deleted_at_no_sql` — **teste do achado A1 da review**: captura o
  SQL, exige **um** `UPDATE` e assere que o `SET` cita `deleted_at` e **nenhuma** das outras 7
  colunas (pina o `update_fields` contra *lost update*).
- `..._escopado_por_tenant` — template de `other_user` levanta `DoesNotExist`.
- `..._preserva_a_linhagem_das_instancias_ja_alocadas` — duas instâncias (weekly + monthly);
  `source_template_id` comparado **com o id original** (não `is not None`); linha presente por
  `objects` **e** `all_objects` (AC5).
- `test_update_template_sobre_excluido_...` / `test_place_template_sobre_excluido_...` — ambos
  levantam `DoesNotExist`.
- `test_live_templates_devolve_so_os_vivos_e_aceita_queryset_de_entrada` — o helper em si.
- `..._semanais_exclui_o_template_excluido_de_items_E_de_already_placed` e
  `..._mensais_exclui_o_excluido_das_TRES_saidas` — fontes de ritual, com **dois** templates (um
  vivo, um excluído) e assert de **conjunto de ids** (não `len == 0` — achado B1 da 14.2).
- `..._skip_week_sobre_template_excluido_levanta_invalid_ritual_decision` — o 7º ponto herdado.

### `backend/bujo/tests/test_views.py`

**Função geral do arquivo** — Testes de view/HTTP (DRF `APIClient`). `+592 / -1`.

**Função geral da alteração** — **15** funções `test_` novas (9 do `dev-story` + 6 do passo de QA)
+ imports de `uuid`, `bujo.services.recurring` e `RecurringTaskTemplateDetailView` (para o guard).
Cobrem o soft delete no fio:
- `..._retorna_204_sem_corpo_e_some_da_listagem`; `..._duas_vezes_retorna_204_com_deleted_at_
  inalterado` (idempotência no fio, relendo o banco entre as chamadas); `..._sem_token_retorna_401`;
  `..._de_outro_tenant_retorna_404_com_bearer_real` (Bearer real); `..._inexistente_retorna_404`.
- `test_matriz_active_x_excluido_em_todas_as_combinacoes_de_query_param` (helper local `ids(url)`):
  a matriz de 4 células da AC6 em `GET` sem filtro, `?active=true`, `?active=false`,
  `?recurrence_group=` e `?unplaced_year=` — assert de **conjunto**, camelCase via `.json()`.
- `test_active_e_reversivel_e_deleted_at_e_irreversivel` (helper `ids_ativos()`): `PATCH` de `active`
  ida-e-volta contra a irreversibilidade de `deleted_at` (`PATCH` pós-`DELETE` → 404).
- `..._preserva_source_template_da_instancia_no_fio` (AC5 no fio).
- `test_nenhum_caminho_de_producao_faz_exclusao_fisica_de_template` — **guard** por
  `inspect.getsource` sobre `bujo.services.recurring` e `RecurringTaskTemplateDetailView`, assertando
  ausência do literal `".delete("` (espelha o guard de alias da 14.3).
- **Do passo de QA:** `..._deleted_at_nao_vaza_no_contrato_...nas_tres_respostas` (+ constante
  `_CHAVES_DE_TEMPLATE_NO_FIO`); `..._some_da_listagem_com_os_tres_query_params_combinados`;
  `..._fonte_recorrentes_semanal_no_fio_perde_o_excluido_dos_dois_buckets_e_das_contagens`;
  `..._fonte_recorrentes_mensal_no_fio_perde_o_excluido_dos_quatro_buckets` (o 4º bucket,
  `alreadyPlaced` do mensal, sem cobertura anterior); `..._post_decisao_skip_week_..._409_neutro_e_
  nao_persiste` (helper local `decidir(template_id)` — prova o **status** 409 e a mensagem neutra,
  não só a exceção); `..._excluir_template_com_decisao_snapshot_preserva_a_decisao_e_a_leitura_da_
  fonte` (interação 14.2 × 14.4 — a decisão-snapshot sobrevive, sem CASCADE).

**Comportamento de libs usadas**
- `inspect.getsource(...)`: devolve o texto-fonte do módulo/classe; o guard lê a **classe inteira**
  (docstring incluída), por isso o comentário do `def delete` foi redigido sem a sequência `.delete(`.
- `django.test.utils.CaptureQueriesContext`: captura os SQLs emitidos no bloco — instrumento das
  provas de idempotência e de "só uma coluna no `SET`" em SQL, não por valor de retorno.

> **Nota de contagem:** o `git diff` deste relatório mostra **27** funções `test_` novas nos três
> arquivos (11 em `test_services.py` + 15 em `test_views.py` + 1 em `test_models.py`). A Senior
> Developer Review registrou a divisão como **26** (`1+10+15`); a diferença é que a review parece
> não ter incrementado `test_services.py` para 11 ao acrescentar o próprio teste do achado A1
> (`..._escreve_SOMENTE_a_coluna_deleted_at_no_sql`). O File List da story, por outro lado, já
> lista `test_services.py` com **11** ("10 do `dev-story` + 1 da code review"), coerente com o diff.
> É uma inconsistência de bookkeeping da story, não um arquivo faltante; a suíte fechou **1269
> passed** pela execução da review.

## 7. E2E (Playwright)

### `frontend/e2e/recurring-soft-delete.spec.ts`

**Função geral do arquivo** — Spec E2E novo (NEW, untracked) — 4 testes contra o backend real da
branch Neon `e2e` (onde a `0009` já está aplicada). Criado pelo passo de QA (o `dev-story` fechou
sem spec E2E). Toda **escrita** acontece pelo fio (helper `templatesApi` com JWT real:
`create`/`deactivate`/`remove`/`patchActive`/`list`/`currentWeekStart`/`place`), como
`ritual-sources.spec.ts` da 14.2 — o botão Excluir só nasce na 14.8. `reloadAndWaitTemplates`
espera o `GET` da listagem chegar antes de qualquer assert de ausência (evita teste vacuoso por
página vazia).

**Função geral da alteração** — Cobre o que só o browser + banco real provam:
- **AC6 na biblioteca real** — ligar "Mostrar inativos" traz o inativo de volta (sufixo
  "(inativo)") e **não** traz o excluído; `active` é filtrado no **cliente**
  (`RecurringTemplateManager` consulta sem params) e `deleted_at` no **servidor**, então os dois
  filtros só se encontram aqui. Fecha com a reversibilidade real (o inativo volta a ativo pelo
  botão "Ativar") e — correção **B1** da review — com `api.list()` conferindo o estado do
  **servidor** (os dois vivos presentes, o excluído ausente), no lugar dos asserts tautológicos
  `expect(a.id).not.toBe(b.id)`.
- **Future Log real** — o anual excluído sai de "Anuais pendentes de \<ano\>" (único consumidor de
  `?unplaced_year`, `FuturePage.tsx:78`), com o anual vivo sustentando a seção (se o filtro
  vazasse, a seção inteira sumiria). Locator escopado ao container da seção.
- **AC5 no banco real** — a `Task` alocada (snapshot) sobrevive à exclusão do template
  (`SET_NULL` do Postgres real); e o template excluído fica **fora** da seção de placement mesmo
  com "Mostrar já colocados" ligado (distingue "escondido pelo dedup da 11.3" de "excluído");
  `api.list()` confirma que só o template sem instância permanece.
- **DELETE contra a branch `e2e`** — 204 idempotente (204 nas duas chamadas; corpo vazio na
  primeira), prova operacional de que a `0009` está aplicada onde o Playwright roda (sem ela seria
  500 por `UndefinedColumn` — bug recorrente 7.1/7.2/14.1); `PATCH` do excluído → 404 e `PATCH` do
  vivo → 200 (o 404 é do excluído, não de rota quebrada).

Cada teste coleta `consoleErrors`/`pageerror` e assere `[]` ao final. `weekStart` vem do próprio
backend (`today_for(user)`), nunca calculado em Node.

---

**Nota:** nenhum comportamento de código-fonte foi alterado na produção deste relatório —
apenas leitura de `git status`/`git diff` e dos arquivos novos. Testes/gates não foram
re-executados aqui; as contagens e vereditos citados vêm do Dev Agent Record, do passo de QA
(`test-summary-14-4.md`), do sprint-status e da Senior Developer Review já registrados na story.
