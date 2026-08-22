---
baseline_commit: fc4d46c32e80b2c6d8937df3bb39c1e8baddc147
---

# Story 14.4: Soft delete de templates recorrentes (backend)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Escopo:** backend puro (Django/DRF). **Nenhuma superfície de UI nova, nenhum componente alterado.** Os únicos arquivos de frontend tocados são `schema.yaml` e `frontend/src/api/types.gen.ts` — **gerados**, nunca editados à mão (guardrail de CI). `frontend/src/features/bujo/api.ts`, `types.ts`, `keys.ts` e `RecurringTemplateManager.tsx` ficam **intocados**: o botão **Excluir** é da **Story 14.8**, que aciona o serviço entregue aqui.
>
> **Uma migration, aditiva, sem `RunPython`.** Esta story acrescenta **uma coluna nulável** (`recurring_task_templates.deleted_at`). Não cria model, não cria tabela, não acrescenta valor a enum nenhum, não escreve data migration (toda linha existente nasce `NULL` = viva, que é exatamente o estado correto). Se o dev sentir necessidade de `RunPython`, a leitura está errada.
>
> **Autoridade de produto:** spine **M09** no `EXPERIENCE.md` (§Recorrentes + State Patterns) + **UX-DR24** (`epics.md:337`) + o AC do épico. **Autoridade de forma:** `AD-08` (itens 2, 3, 6 e 8) e `AD-12` do `architecture.md`. Os spines vencem em conflito.
>
> **Dependências satisfeitas:** 14.1 (ciclos), 14.2 (fontes dos rituais + `ritual_decisions`) e 14.3 (fila unificada + aliases) estão `done`. Esta story **não altera nada das três** — ela só acrescenta um filtro à origem dos templates que a 14.2 já consulta.
>
> ⚠️ **O ponto onde esta story mais facilmente falha não é o soft delete em si — é esquecer um dos lugares que lê templates.** São **seis** (Task 2). Um esquecido = template excluído reaparecendo num ritual, que é literalmente o AC.

## Story

Como Hugo,
Quero excluir um template da biblioteca sem apagar o registro,
Para que a linhagem das tarefas já alocadas permaneça rastreável (UX-DR24; EXPERIENCE M09).

## Acceptance Criteria

### AC1 — Coluna `deleted_at` nulável + migration aditiva nomeada, aplicada a `dev` E à branch Neon `e2e`

**Dado que** AD-08 modela `recurring_task_templates` como tabela própria e que o soft delete precisa persistir *que* o template foi excluído sem tocar em nenhuma outra coluna,
**Quando** a migration `0009_recurringtasktemplate_deleted_at` roda,
**Então** `RecurringTaskTemplate` ganha **um** campo — `deleted_at = models.DateTimeField(null=True, blank=True)` — e **nada mais**: `active`, `title`, `description`, `eisenhower`, `category`, `recurrence_group`, `recurrence_text` ficam byte-idênticos, nenhuma constraint nova, nenhum índice novo, **nenhum `RunPython`**,
**E** `deleted_at IS NULL` significa **vivo** e `deleted_at IS NOT NULL` significa **excluído** — toda linha pré-existente nasce viva pelo default da coluna, sem backfill,
**E** o timestamp vem de **`core.calendar.now()`** (a única fonte de "agora" do projeto — o guardrail de AST `test_no_bare_date_today_outside_calendar` proíbe `timezone.now()` em todo módulo de produção fora de `core/calendar.py`, e o docstring de `now()` nomeia exatamente este uso: *"timestamps de auditoria de escrita"*),
**E** a migration é aplicada à **branch Neon `e2e` antes do Playwright**, com `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` limpo — bug recorrente 7.1/7.2/14.1.

> ⚠️ **Divergência declarada de redação, não de forma.** O AC do épico diz *"flag lógica"*, o que sugeriria um `BooleanField`. Um `DateTimeField` nulável **é** uma flag lógica (`IS NULL` / `IS NOT NULL`) e entrega auditoria de graça, sem coluna extra. A escolha é deliberada e registrada em Questões abertas #1. **O dev não deve trocar por booleano** — o `now()` já existe, `RitualDecision` já usa `TIMESTAMPTZ` (`models.py:367-371`) e um booleano jogaria fora "quando" sem economizar nada.

### AC2 — `live_templates()`: uma única definição de "template vivo", aplicada nos **seis** lugares que leem template

**Dado que** o AC do épico exige que o template excluído *"suma da biblioteca **e das fontes dos rituais** (filtro default nas queries)"* e que a retrospectiva do Épico 13 (SHELL-DEBT-03/04) tornou "copiar o filtro em N lugares" um antipadrão nomeado,
**Quando** o filtro é implementado,
**Então** existe **uma** definição — `live_templates(queryset=None)` em `bujo/services/recurring.py`, espelhando exatamente a forma de `undisposed_roots` em `services/rituals.py:238` (helper de módulo que recebe/devolve queryset, **não** classe, **não** manager) —,
**E** ela é aplicada nos **seis** pontos de leitura, sem que nenhum deles redeclare `deleted_at__isnull=True`:

| # | Ponto | Arquivo | Efeito para o excluído |
|---|---|---|---|
| 1 | `RecurringTaskTemplateListView.get` | `views.py:213-232` | some da biblioteca **em toda combinação de query param** |
| 2 | `list_weekly_recurring_candidates` | `rituals.py:340` | some da fonte **Recorrentes** do ritual semanal (`items` **e** `alreadyPlaced`) |
| 3 | `list_monthly_recurring_candidates` — `monthly` | `rituals.py:420` | some da fonte **Recorrentes** do ritual mensal |
| 4 | `list_monthly_recurring_candidates` — `annual` | `rituals.py:420` | some da elegibilidade anual **e** de `alreadyPlacedInYear` |
| 5 | `update_template` | `recurring.py:20` | `PATCH` devolve **404** |
| 6 | `place_template` | `recurring.py:29` | `POST …/place/` devolve **404** |

**E** um **sétimo** ponto herda o filtro de graça e precisa de teste: `upsert_ritual_decision` (`rituals.py:144`) troca `RecurringTaskTemplate.objects.filter(pk=…)` por `live_templates().filter(pk=…)`, de modo que `skip_week` sobre template excluído cai no caminho `item is None` **já existente** e devolve **409 `InvalidRitualDecision`** com a mensagem neutra `_ILLEGAL` — **nenhuma exceção nova, nenhuma mensagem nova**,
**E** o **único** lugar de produção que consulta templates **sem** o filtro é o próprio `soft_delete_template` (AC3, por causa da idempotência) — e isso é declarado em comentário no ponto exato.

### AC3 — `soft_delete_template`: serviço idempotente que **jamais** emite `DELETE`

**Dado que** M09 é literal — *"o template sai da biblioteca e dos rituais, mas o registro persiste para preservar a linhagem (`source_template`) das tarefas já alocadas. **Não há exclusão física**"* —,
**Quando** `soft_delete_template(*, user, template_id)` roda em `bujo/services/recurring.py`,
**Então** ele localiza o template pelo manager auto-escopado **sem** o filtro de vivos (`RecurringTaskTemplate.objects.get(id=template_id)`) — é a **única** exceção à AC2, e existe porque a idempotência exige encontrar uma linha já excluída —,
**E** se `deleted_at` **já** estiver preenchido, devolve o registro **sem escrever nada** — `deleted_at` original **preservado**, provado por `_sem_escrita` (`test_services.py:2130`), zero `INSERT`/`UPDATE`/`DELETE` no SQL capturado,
**E** se estiver `NULL`, grava `deleted_at = now()` com `save(update_fields=["deleted_at"])` — **só essa coluna**, nunca `active`, nunca os campos de conteúdo,
**E** template inexistente ou de outro tenant levanta `RecurringTaskTemplate.DoesNotExist` (o manager escopado já torna a linha alheia inexistente — AD-12), traduzido em **404** pela view, exatamente como `update_template`/`place_template` já fazem,
**E** **nenhuma linha de produção chama `.delete()` sobre um template** — provado por um teste-guard que lê o fonte de `bujo/services/recurring.py` e da classe `RecurringTaskTemplateDetailView` via `inspect.getsource` e assere a ausência do literal `".delete("` (mesmo padrão do guard de alias da 14.3). ⚠️ O guard procura `".delete("` **com o ponto**: `def delete(self, request, pk)` não casa, e é isso que o torna escrevível.

### AC4 — `DELETE /api/bujo/recurring-templates/<pk>/` → 204, idempotente, sem caminho de volta

**Dado que** a biblioteca já tem a rota de detalhe (`urls.py:76-80`, `RecurringTaskTemplateDetailView` com `patch`),
**Quando** o método `delete` é acrescentado **à view existente** (rota nova é proibida — o recurso é o mesmo),
**Então** responde **`204 No Content` sem corpo** (idioma DRF; devolver o template serializado seria devolver um objeto que nenhuma listagem volta a mostrar), com `@extend_schema(responses={204: None})`,
**E** `DELETE` duas vezes seguidas devolve **204 nas duas** e o `deleted_at` da segunda é **igual** ao da primeira (idempotência do AC3 observada no fio),
**E** `DELETE` sem token → **401**; `DELETE` de template de outro tenant → **404**; `DELETE` de id inexistente → **404**,
**E** **não existe endpoint de restauração**: `RecurringTaskTemplateUpdateSerializer` (`serializers.py:415-428`) **não ganha** `deleted_at`, então `PATCH {"deletedAt": null}` é campo desconhecido e ignorado — e, de qualquer forma, o `PATCH` já devolve 404 para excluído (AC2 ponto 5). *"Irreversível na UI"* (UX-DR24) é, aqui, irreversível na API,
**E** `RecurringTaskTemplateSerializer` (`serializers.py:384-397`) fica **intocado** — **não** expor `deleted_at` na resposta: toda resposta que a API consegue emitir traz um template vivo, logo o campo seria `null` em 100% dos casos (ruído de contrato). Registrado em Questões abertas #2.

### AC5 — Linhagem íntegra: a FK sobrevive, o registro sobrevive, o `TaskSerializer` sobrevive

**Dado que** a razão de ser desta story é *"para que a linhagem das tarefas já alocadas permaneça rastreável"*,
**Quando** um template **com instâncias alocadas** é excluído,
**Então** cada instância mantém `source_template_id` **exatamente igual** (`refresh_from_db()`, não `is not None` — o assert precisa comparar com o id original, senão passa vacuamente),
**E** a linha continua existindo pelos **dois** caminhos: `RecurringTaskTemplate.objects.filter(pk=…).exists()` é **`True`** (o manager auto-escopado **não** filtra excluídos — só `live_templates()` filtra) e `RecurringTaskTemplate.all_objects.filter(pk=…).exists()` também,
**E** no fio, `sourceTemplate` da Task continua devolvendo o **mesmo UUID** em `/api/bujo/logs/weekly/` (ou no log onde a instância vive) — a exclusão do template **não** muda uma vírgula de nenhuma resposta de Task,
**E** o teste existente `test_deletar_template_nao_deleta_a_task_instancia_set_null` (`test_models.py:226-237`) **continua verde sem edição de assert** — ele exercita `on_delete=SET_NULL` no nível **ORM**, que permanece a rede de segurança do banco. Acrescente **uma frase** ao docstring dele deixando explícito que, a partir desta story, **nenhum caminho de produção chega ali** (o comentário atual não mente, mas um leitor concluiria que a API suporta delete físico — a lição "docstring que induz a erro" veio da AC6 da 14.3).

### AC6 — Ativar/Desativar e Excluir provados **distintos**, numa matriz, não em prosa

**Dado que** o AC do épico exige literalmente que *"os dois conceitos fiquem distintos (inativo = visível com filtro, reversível; excluído = fora da biblioteca, irreversível na UI) **e testados separadamente**"*,
**Quando** a cobertura é escrita,
**Então** existe uma **matriz de 4 células** (`active` × vivo/excluído) assertada sobre a mesma listagem, e nenhuma célula é inferida:

| | vivo (`deleted_at IS NULL`) | excluído (`deleted_at IS NOT NULL`) |
|---|---|---|
| `active=True` | aparece em `GET /recurring-templates/` e em `?active=true`; aparece nas fontes de ritual | **não aparece em lugar nenhum** |
| `active=False` | aparece em `GET /recurring-templates/` e em `?active=false`; **não** aparece nas fontes de ritual (elas já filtram `active=True`) | **não aparece em lugar nenhum** |

**E** a **reversibilidade** de `active` é provada de ponta a ponta (`PATCH {active:false}` → some do `?active=true` → `PATCH {active:true}` → volta), contra a **irreversibilidade** de `deleted_at` (nenhum endpoint o zera — AC4),
**E** a invisibilidade do excluído é provada em **todas** as combinações de query param que a listagem aceita: sem filtro, `?active=true`, `?active=false`, `?recurrence_group=<o do template>` e `?unplaced_year=<ano sem instância>` — esta última é a que mais facilmente escapa, porque é a que o `FuturePage` usa para os **anuais pendentes** (`FuturePage.tsx:78`),
**E** o soft delete **não** altera `active`: um template `active=True` excluído continua com `active=True` na linha (assert explícito). Os dois eixos são **ortogonais** — é isso que "conceitos distintos" significa no schema, não só na UI.

### AC7 — Contrato aditivo, gates verdes e não-vacuidade provada

**Dado que** a 14.3 fechou `72/0` e `70/0` e que a retrospectiva do Épico 13 nomeou teste vacuoso e contagem de memória como os achados mais caros,
**Quando** a story fecha,
**Então** `schema.yaml` e `frontend/src/api/types.gen.ts` são regenerados e commitados com **0 deleções** (`git diff --numstat`) — a operação `delete` entra sob o path que já existe, e nenhum componente muda de forma,
**E** os gates fecham com números **reais colados**: `pytest` **full-suite sem escopo de caminho** (baseline **1242 passed em 338.79s** no commit `fc4d46c` — ver §Testing), `ruff check`, `lint-imports` **1/0**, `npx tsc --noEmit`, `makemigrations --check --dry-run` = *"No changes detected"* **depois** de escrever a migration, e `migrate --check` limpo na branch `e2e`,
**E** ao menos **três experimentos de não-vacuidade SEPARADOS** são executados e registrados nas Debug Log References, cada um revertendo **uma** propriedade e nomeando o teste que passa a falhar — candidatos: (a) remover `live_templates` da listagem; (b) removê-lo de `list_weekly_recurring_candidates`; (c) fazer `soft_delete_template` sobrescrever `deleted_at` na re-execução; (d) trocar o `save` por `.delete()` físico,
**E** **zero resíduo de experimento** é conferido **sobre a árvore final** por `git diff` + `grep`, **e a suíte é re-executada depois do último experimento** — este é o achado **C1/C2 crítico da 14.3**: `ruff check` e `lint-imports` ficaram **verdes** com um experimento esquecido no fonte, porque o resíduo era sintaticamente válido. **Gate estático verde não substitui re-rodar o pytest.**

## Tasks / Subtasks

- [x] **Task 1 — Campo `deleted_at` + migration** (AC: 1)
  - [x] `backend/bujo/models.py`, dentro de `class RecurringTaskTemplate` (`:400-425`), logo **abaixo** de `active` (os dois eixos ficam adjacentes e o contraste vira documentação): `deleted_at = models.DateTimeField(null=True, blank=True)`.
  - [x] Comentário curto ao lado, no estilo dos vizinhos (`active` tem um, `recurrence_text` tem outro): soft delete de M09/UX-DR24; `NULL` = vivo; **contraste deliberado com `active`** — `active` é reversível e prospectivo, `deleted_at` é terminal; o registro persiste porque `Task.source_template` (`models.py:229-235`) aponta para ele.
  - [x] **Nenhuma** constraint e **nenhum** índice novos. A tabela é de um caderno pessoal (dezenas de linhas); índice parcial aqui é otimização especulativa. Registre a decisão em comentário para a review não a ler como esquecimento.
  - [x] `cd backend && uv run python manage.py makemigrations bujo -n recurringtasktemplate_deleted_at` → deve gerar **`0009_recurringtasktemplate_deleted_at.py`** com **um** `AddField` e nada mais. Abra o arquivo e confirme: sem `RunPython`, sem `AlterField` em outra coluna, sem `CreateModel`.
  - [x] Aplicar em `dev` (`uv run python manage.py migrate`) **e** na branch Neon `e2e` (`DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate`), com `migrate --check` limpo nas duas **antes** do Playwright. Runbook: `docs/e2e-neon-reset.md`.
  - [x] `backend/bujo/tests/factories.py` — **preferência: não tocar.** `deleted_at` é campo de model comum, então `RecurringTaskTemplateFactory(user=user, deleted_at=<datetime fixo>)` já funciona a partir do teste, e teste é o lugar certo para o valor. **Só** acrescente um trait `deleted` dentro da `class Params:` que já existe (`:103-104`) se três ou mais testes repetirem o mesmo literal. ⚠️ Se tocar: **data fixa, nunca `now()`** — o guardrail de AST varre `factories.py` (só `test_*.py` e `conftest.py` são pulados), então `timezone.now()` ali **quebra o build**. Use `datetime(2026, 1, 1, tzinfo=UTC)`, coerente com a convenção "datas fixas + `timedelta`" do arquivo.
  - [x] **Não** registrar caso novo em `register_isolation_case` — o model já está registrado (`factories.py:167-174`) e nenhum model novo nasce aqui.

- [x] **Task 2 — `live_templates()` e os seis pontos de leitura** (AC: 2)
  - [x] `backend/bujo/services/recurring.py`: `def live_templates(queryset=None):` devolvendo `(queryset if queryset is not None else RecurringTaskTemplate.objects.all()).filter(deleted_at__isnull=True)`. Docstring nomeando M09 e a razão de ser helper de módulo.
  - [x] ⚠️ **Não** implementar como manager customizado (`RecurringTaskTemplate.objects` filtrando excluídos por default). Três razões, registre-as em comentário: (a) o filtro default esconderia a linha **inclusive** do `soft_delete_template`, que precisa encontrá-la para ser idempotente (AC3), forçando um segundo manager só para isso; (b) filtro implícito é invisível na leitura do call site — `undisposed_roots` já estabeleceu no repo que o predicado compartilhado é **explícito e greppável**; (c) `core/tests/test_guardrails.py:40-52` assere que `objects` é um `TenantManager` para todo `TenantModel` concreto — passar por subclasse é possível, mas amarra duas responsabilidades num manager só.
  - [x] Atualizar o docstring do módulo `recurring.py` (`:1-3`): hoje diz "Criação/edição/placement"; passa a cobrir **exclusão lógica** e a apontar `live_templates` como a origem única dos vivos.
  - [x] **Ponto 1 — `views.py:216`**: `templates = live_templates().order_by("recurrence_text")`. Os três filtros de query param (`active`, `recurrence_group`, `unplaced_year`) encadeiam **depois**, sem mudança. Import: `views.py:75` é hoje a linha única `from bujo.services.recurring import create_template, place_template, update_template` — acrescente `live_templates` (e, na Task 4, `soft_delete_template`) em ordem alfabética; ruff/isort é gate.
  - [x] **Ponto 2 — `rituals.py:356-364`**: `live_templates(RecurringTaskTemplate.objects.filter(active=True, recurrence_group=…))` — passando a queryset, não recriando o filtro. Isto cobre `items` **e** o bucket `alreadyPlaced` de uma vez, porque `_partition_by_placement` (`:302`) parte **a mesma** queryset.
  - [x] **Pontos 3 e 4 — `rituals.py:455` e `:462`**: idem para `monthly_templates` e `annual`. O `annual` alimenta **três** saídas (`annual_eligible`, `annual_in_year`, contagens), todas derivadas da mesma queryset — filtrar na origem cobre as três.
  - [x] **`rituals.py` passa a importar `bujo.services.recurring`.** Verificado: **não cria ciclo** — `recurring.py` importa `models`, `services.logs`, `services.tasks` e `core.exceptions`; nenhum deles importa `rituals`. `lint-imports` precisa continuar **1/0** (o único contrato é "`core` não importa app de domínio").
  - [x] **Pontos 5 e 6 — `recurring.py:21` e `:35`**: `update_template` e `place_template` trocam `RecurringTaskTemplate.objects.get(...)` por `live_templates().get(...)`. `DoesNotExist` continua sendo a exceção levantada (as views já a traduzem em 404 — `views.py:257` e `:276`), então **nenhuma view muda por causa disto**.
  - [x] **Ponto 7 — `rituals.py:144`**: `item = live_templates().filter(pk=recurring_template_id).first()`. O `if item is None: raise InvalidRitualDecision(_ILLEGAL)` logo abaixo (`:148-149`) já faz o resto. **Não** criar exceção nem mensagem nova — a mensagem `_ILLEGAL` é deliberadamente neutra (`rituals.py:83-86`: *"uma mensagem específica de 'não existe' revelaria a ausência (ou a presença) de linha alheia"*).
  - [x] Depois: `grep -rn "deleted_at" backend/bujo/ --include=*.py | grep -v tests` deve mostrar **exatamente três** ocorrências de produção — o campo no model, o filtro dentro de `live_templates` e a atribuição em `soft_delete_template`. Qualquer quarta é o filtro copiado.

- [x] **Task 3 — `soft_delete_template` no serviço** (AC: 3, 5)
  - [x] `backend/bujo/services/recurring.py`, **depois** de `update_template` e **antes** de `place_template` (ordem CRUD do módulo): `@transaction.atomic` + `def soft_delete_template(*, user, template_id) -> RecurringTaskTemplate:`.
  - [x] Corpo: `template = RecurringTaskTemplate.objects.get(id=template_id)` — **sem** `live_templates`. Comentário obrigatório explicando que esta é a **única** exceção à AC2 e por quê (idempotência precisa achar a linha já excluída).
  - [x] `if template.deleted_at is not None: return template` — **antes** de qualquer `save`. É esta linha que `_sem_escrita` prova.
  - [x] `template.deleted_at = now()` (import `from core.calendar import now` — `cycles.py:41` já usa o mesmo import) + `template.save(update_fields=["deleted_at"])`.
  - [x] **Proibido**: `.delete()`, `all_objects`, tocar `active`, tocar qualquer campo de conteúdo, tocar as `Task` instâncias (a FK é preservada **por não fazer nada**, não por código).

- [x] **Task 4 — Método `delete` na view existente + schema** (AC: 4)
  - [x] `backend/bujo/views.py`, dentro de `class RecurringTaskTemplateDetailView` (`:246-259`), **depois** do `patch`:
    ```python
    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        try:
            soft_delete_template(user=request.user, template_id=pk)
        except RecurringTaskTemplate.DoesNotExist:
            raise NotFound() from None
        return Response(status=status.HTTP_204_NO_CONTENT)
    ```
    View **fina**: serviço → resposta, zero regra (§6.2). `NotFound`, `Response` e `status` já estão importados no arquivo.
  - [x] Import de `soft_delete_template` na mesma linha de `views.py:75` (alfabético — ver Task 2).
  - [x] **Nenhuma rota nova** em `urls.py` — o `path("recurring-templates/<uuid:pk>/", …)` (`:76-80`) já roteia o verbo.
  - [x] Um comentário curto na classe registrando que `DELETE` é **lógico** e apontando o serviço — a próxima pessoa a ler `def delete` precisa saber em uma linha que nada é apagado.

- [x] **Task 5 — Regenerar o contrato** (AC: 7)
  - [x] `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] `cd frontend && nvm use 22.15.1 && npm run generate-types && npx tsc --noEmit`
  - [x] Commitar `schema.yaml` **e** `frontend/src/api/types.gen.ts`; provar **0 deleções** com `git diff --numstat schema.yaml frontend/src/api/types.gen.ts`. ⚠️ Se aparecer deleção, **pare e investigue** — acrescentar um verbo a um path existente é estritamente aditivo; deleção significa que algum componente mudou de forma (provável culpado: `deleted_at` vazando para um serializer, o que a AC4 proíbe).
  - [x] **Não** adicionar consumidor no frontend: `api.ts`, `types.ts`, `keys.ts` e `RecurringTemplateManager.tsx` ficam **intocados**. O tipo gerado existir sem consumidor é esperado (mesma situação da fila unificada na 14.3) — a 14.8 o consome.
  - [x] A advertência `multiple names for the same choice set (ToStatusEnum)` do `spectacular` é **pré-existente** (medida na 14.2 e 14.3) — não tentar consertar.

- [x] **Task 6 — Testes** (AC: 1–7)
  - [x] `bujo/tests/test_models.py`:
    - `deleted_at` nasce `NULL` num template recém-criado (o default da coluna, não um valor escrito).
    - Acrescentar a frase de esclarecimento ao docstring de `test_deletar_template_nao_deleta_a_task_instancia_set_null` (`:226`) — **sem tocar nos asserts**.
  - [x] `bujo/tests/test_services.py` (vizinhança `:1285-1470`, onde os testes de `recurring` já moram):
    - `soft_delete_template` grava `deleted_at`, mantém `active` inalterado e **não** toca nenhum campo de conteúdo (compare o objeto campo a campo, ou pelo menos `active`, `title` e `recurrence_text`).
    - **Idempotência via `_sem_escrita`** (`test_services.py:2130`): re-executar devolve o mesmo registro com o **mesmo** `deleted_at` e **zero** `INSERT`/`UPDATE`/`DELETE` no SQL capturado.
    - Escopo por tenant: `soft_delete_template` de template de `other_user` levanta `DoesNotExist` (padrão de `test_update_template_escopado_por_tenant`, `:1328`).
    - **Linhagem (AC5):** template com **duas** instâncias alocadas (uma weekly, uma monthly) → excluir → cada `task.refresh_from_db()` com `source_template_id == template.id` (**compare com o id**, não com `is not None`), `RecurringTaskTemplate.objects.filter(pk=…).exists()` **True** e `all_objects` idem.
    - `update_template` e `place_template` sobre excluído levantam `DoesNotExist`.
    - Fontes de ritual: template excluído fora de `list_weekly_recurring_candidates` (`items` **e** `alreadyPlaced` — semeie uma instância no alvo para o bucket não ser vazio por acidente) e fora de `list_monthly_recurring_candidates` nas **três** saídas (`monthly`, `annual_eligible`, `annual_in_year`). ⚠️ Assertar `len(items) == 0` num cenário onde só existe o template excluído é **vacuoso**: semeie **dois** templates, exclua **um**, e assere que o conjunto de ids devolvido é **exatamente** `{o vivo}`.
    - `upsert_ritual_decision` com `skip_week` sobre template excluído levanta `InvalidRitualDecision` (alvo weekly em `planning`, para o teste morrer no item e não no gate de ciclo).
  - [x] `bujo/tests/test_views.py` (vizinhança `:1787-2100`):
    - `DELETE` sem token → **401**; `DELETE` de outro tenant → **404** (Bearer real, padrão `:39-57`); id inexistente → **404**.
    - `DELETE` → **204 sem corpo**; segundo `DELETE` → **204** e `deleted_at` **inalterado** (releia do banco entre as duas chamadas).
    - **Matriz da AC6 no fio**, 4 células: dois templates vivos (um `active`, um inativo) + dois excluídos (um `active`, um inativo) → `GET` sem filtro, `?active=true`, `?active=false`, `?recurrence_group=`, `?unplaced_year=` — em cada resposta, o conjunto de ids é **exatamente** o esperado (assert de conjunto, não de `len`). Asserts em **camelCase** via `.json()`, **nunca** `.data` (pré-render, snake_case — armadilha registrada na 14.2 e 14.3); URLs como **literais**.
    - Reversibilidade de `active` × irreversibilidade de `deleted_at`: `PATCH {active:false}` → some de `?active=true` → `PATCH {active:true}` → volta; depois `DELETE` → `PATCH {"active": true}` devolve **404**.
    - **Linhagem no fio:** depois de excluir, a resposta que contém a Task instância continua trazendo o **mesmo** `sourceTemplate`.
    - **Guard de "sem delete físico" (AC3):** `inspect.getsource` de `bujo.services.recurring` e de `RecurringTaskTemplateDetailView`, assertando ausência do literal `".delete("`. Espelha o guard de alias da 14.3 (`test_views.py`, AC5).
    - **Caracterização:** `test_ac8_contrato_legado_preservado_nas_nove_respostas_nomeadas` (`:3413`) e os testes de listagem existentes (`:1807-2056`) ficam **verdes sem edição de assert**. Se algum exigir edição, o filtro vazou para além do combinado.
  - [x] `bujo/tests/test_serializers.py`: **nada a acrescentar.** Nenhum serializer muda de forma (AC4). Não escreva um teste que "prove" que `deletedAt` não está na resposta e depois alguém o adicione sem perceber — se quiser blindar a ausência, o lugar é o assert de **conjunto de chaves** do teste de fio da listagem, não um teste de serializer novo.
  - [x] **Prova de não-vacuidade — 3 experimentos SEPARADOS**, um por propriedade, cada um: reverter → rodar `uv run pytest bujo/tests/ -q` (**sem** `-k`) → nomear os vermelhos → restaurar → conferir por `grep` da expressão original **e** `git diff` limpo no arquivo de produção:
    - (a) `views.py`: `live_templates()` → `RecurringTaskTemplate.objects.all()` na listagem;
    - (b) `rituals.py`: remover `live_templates(...)` de `list_weekly_recurring_candidates`;
    - (c) `recurring.py`: remover o early-return de idempotência (passa a reescrever `deleted_at`).
  - [x] ⚠️ **Depois do último experimento**: `git diff` na árvore inteira + `grep -rn "EXPERIMENTO" backend/` + **re-executar o pytest full-suite**. A 14.3 fechou com um resíduo no fonte porque `ruff`/`lint-imports` seguiram verdes e a suíte não foi re-rodada (achados C1/C2).

- [x] **Task 7 — Gates** (AC: 1, 7)
  - [x] `docker compose up -d db && cd backend && uv run pytest` — **full-suite, sem escopo de caminho**. Baseline **1242 passed** no commit `fc4d46c` (§Testing). Colar a contagem real ao fechar e derivar a divisão herdados/novos de `git diff -U0 bujo/tests/ | grep "^+def test_"` (contando parametrizações), **nunca** por subtração.
  - [x] `uv run ruff check` (verde) + `uv run lint-imports` (**1 kept, 0 broken**).
  - [x] `uv run ruff format --check` está vermelho em **48 arquivos pré-existentes**. A obrigação é **não adicionar** arquivo à lista — verifique por **diff das listas** antes/depois, **não** por contagem. Baseline medido no commit `fc4d46c`: dos arquivos que esta story toca, **já estão vermelhos** `bujo/models.py`, `bujo/views.py`, `bujo/tests/factories.py`, `bujo/tests/test_models.py`, `bujo/tests/test_services.py` e `bujo/tests/test_views.py`; **estão limpos e precisam continuar limpos** `bujo/services/recurring.py` e `bujo/services/rituals.py` — e a migration nova (`0009_*.py`), que nasce formatada.
  - [x] `uv run python manage.py makemigrations --check --dry-run` → *"No changes detected"* **depois** de commitar a migration (prova de que o model e a migration estão em sincronia).
  - [x] `npx tsc --noEmit` (Node 22.15.1) + `git diff --numstat schema.yaml frontend/src/api/types.gen.ts` com **0 deleções**.
  - [x] Migration aplicada a `dev` **e** à branch Neon `e2e`, com `DJANGO_SETTINGS_MODULE=config.settings.e2e uv run python manage.py migrate --check` limpo **antes** do Playwright.
  - [x] E2E de **regressão** (story de backend puro — os specs provam que nada quebrou, não uma feature nova): `recurring-templates.spec.ts`, `future-log-annual.spec.ts` (é quem exercita `?unplaced_year` — o filtro mais fácil de quebrar), `ritual-sources.spec.ts`. `nvm use 22.15.1`, `CI=1`, portas **5173/8000** — **nunca** matar 5174/8001 (dev local do dono).
  - [x] Falhas de E2E **já medidas como pré-existentes**: `recurring-templates.spec.ts:306` (locator `Definir placement`, herdado da 13.3, medido na 14.2 **e** na 14.3) e as **4** de `weekly-monthly-task-crud.spec.ts` (`getByLabel('Título')` × `BrainDumpCaptureSheet` portalizado, medidas na 14.1). **Não** re-diagnosticar e **não** consertar em story de backend puro — apenas citar se aparecerem.

## Dev Notes

### Estado atual do código que esta story toca (leia ANTES de escrever)

**`backend/bujo/models.py` — `class RecurringTaskTemplate` (`:400-425`) (UPDATE).**
Herda `TenantModel` (UUID pk, `user_id` indexado, `objects` auto-escopado, `all_objects` escape hatch). Campos: `title`, `description`, `eisenhower`, `category`, `recurrence_group` (`TextChoices` weekly/monthly/annual), `recurrence_text` (**livre, nunca parseado** — AD-08 item 4), `active` (booleano simples, **sem** versionamento — AD-08 item 6). `Meta` tem **só** `db_table = "recurring_task_templates"`: nenhuma constraint, nenhum índice, **nenhum** `created_at`/`updated_at`. **O que esta story muda:** acrescenta `deleted_at`. Nada mais.

**`backend/bujo/models.py` — `Task.source_template` (`:229-235`).** `ForeignKey("RecurringTaskTemplate", null=True, blank=True, on_delete=models.SET_NULL, related_name="instances")`. **`SET_NULL` é o que torna o soft delete necessário**: um delete físico não quebraria o banco, ele **apagaria a linhagem em silêncio** — exatamente o que UX-DR24 proíbe. O `related_name="instances"` é o que `list_*_recurring_candidates` usa para contar instâncias no alvo (`Count("instances", filter=…)`).

**`backend/bujo/services/recurring.py` (UPDATE, 55 linhas — leia inteiro).**
Três funções, todas `@transaction.atomic`, todas com `RecurringTaskTemplate.objects` (auto-escopado):
- `create_template` (`:15`) — `objects.create(**fields)`. **Intocada.**
- `update_template` (`:20`) — `.get(id=template_id)` (comentário *"auto-escopado por tenant"*), `setattr` em laço, `save(update_fields=[*fields.keys()])`. **Ganha `live_templates`.**
- `place_template` (`:29`) — `.get(id=template_id)` (comentário *"auto-escopado; 404 na view"*), copia campos **no instante** do placement (snapshot, AD-08 itens 2/3 — a Task **nunca relê** o template), roteia weekly → `WeeklyLog`, monthly **e** annual → `MonthlyLog` (AD-08 item 5: `recurrence_group` controla **em qual abertura de ciclo o template é apresentado**, não onde a instância cai). **Ganha `live_templates`.**

**`backend/bujo/views.py` (UPDATE).**
- `RecurringTaskTemplateListView` (`:213-243`) — `GET` com `objects.all().order_by("recurrence_text")` + três query params opcionais encadeados (`active` como string `"true"/"false"`, `recurrence_group`, `unplaced_year` com `ValidationError` 400 em não-inteiro e `exclude(instances__monthly_log__month_first__year=…)`); `POST` cria. **`GET` ganha `live_templates`; `POST` intocado.**
- `RecurringTaskTemplateDetailView` (`:246-259`) — **só** `patch` hoje. **Ganha `delete`.**
- `RecurringTaskTemplatePlaceView` (`:262-278`) — `POST …/place/` → 201 com `TaskSerializer`. **Intocada** (herda o filtro pelo serviço).

**`backend/bujo/serializers.py` (NÃO TOCAR).** `RecurringTaskTemplateSerializer` (`:384-397`, `ModelSerializer` com 8 campos), `…CreateSerializer` (`:399-413`), `…UpdateSerializer` (`:415-428`, todos `required=False`), `…PlaceSerializer` (`:431`). Nenhum ganha `deleted_at` (AC4). `TaskSerializer` (`:21-58`) expõe `source_template` e é compartilhado por ~10 respostas — **proibido** tocar.

**`backend/bujo/services/rituals.py` (UPDATE — 3 querysets + 1 lookup).**
- `list_weekly_recurring_candidates` (`:340-372`) — `objects.filter(active=True, recurrence_group=WEEKLY)` + `annotate(instances_in_target_count=…)` + `order_by("recurrence_text")`, partido por `_partition_by_placement` (`:302`) em `items` e `alreadyPlaced`. O docstring registra que um template com `skip_week` **continua listado e continua ativo** — *"remove o aviso sem desativar o template"*. **Excluído é diferente: ele não aparece nem em `items` nem em `alreadyPlaced`.**
- `list_monthly_recurring_candidates` (`:420-470`) — `monthly` ativos primeiro, depois `annual` ativos **sem instância no ano-alvo** (`exclude(instances__monthly_log__month_first__year=…)`, a mesma expressão de `?unplaced_year`). A **regra de dezembro é emergente**, não codificada — não escreva `if month == 12`, e não a quebre ao inserir o filtro.
- `upsert_ritual_decision` (`:95-176`) — matriz `ALLOWED_DECISIONS` (`:76-80`) com **três** células; `(monthly, template)` **não existe** de propósito. Item pelo manager escopado (`:144`), `None` → `InvalidRitualDecision(_ILLEGAL)` (`:148-149`), mensagem **neutra** de propósito.
- `undisposed_roots` (`:238`) — **o exemplar de forma** para `live_templates`: helper de módulo que recebe queryset e devolve queryset filtrada, consumido por 4 chamadores locais **e** por `services/migration.py:32` (a 14.3 o promoveu de privado a público exatamente para isso).

**`backend/core/calendar.py` — `now()` (`:22-34`).** Única fonte de "agora" (`TIMESTAMPTZ`). O docstring já nomeia o caso de uso: *"timestamps de auditoria de escrita"*, distinto de `today_for` (que é a autoridade de **negócio** e devolve `date`). `cycles.py:41` já importa. **Use `now()`.**

**`backend/core/models.py` + `core/tenant.py`.** `TenantManager.get_queryset` filtra por `current_user_id` e **falha fechado** (`TenantScopeViolation`) sem contexto. `all_objects` é escape hatch de admin — **proibido** aqui (AD-12). `core/tests/test_guardrails.py:40-52` assere que todo `TenantModel` concreto tem `objects` do tipo `TenantManager`.

**`frontend/` (não tocar, só saber que existe):**
- `RecurringTemplateManager.tsx:143` — `useRecurringTemplatesQuery()` **sem params**, filtragem client-side por grupo e `showInactive` (`:158-160`). Footer só tem **Editar** e **Ativar/Desativar** (`:126-133`) — **não há botão Excluir hoje**; ele nasce na 14.8.
- `RecurringPlacementSection.tsx:48` — `useRecurringTemplatesQuery({ active: true })`.
- `FuturePage.tsx:78` — `useRecurringTemplatesQuery({ recurrenceGroup: 'annual', unplacedYear })` para os **anuais pendentes**. É o consumidor de `?unplaced_year` e a razão de `future-log-annual.spec.ts` estar no gate de E2E.
- `api.ts:395-506` — `fetch/create/update/place`. **Não existe** `deleteRecurringTemplate`; não crie.

### Regras de produto (spine M09 vence conflitos)

[Source: EXPERIENCE.md#Recorrentes (L349-L357)]

- *"Templates não têm status de tarefa. **Alocar** é manual e cria snapshot de tarefa real no destino; não existem auto-injeção, indicador 'synced', frequência executável ou audit trail de engine."*
- *"A biblioteca vive em `/planner/recurring` (padrão Coleção) e é só CRUD."*
- *"O footer oferece **Salvar**, **Ativar/Desativar** e **Excluir**: Ativar/Desativar é **reversível e prospectivo** (o inativo permanece no sistema, **visível com o filtro**); **Excluir** existe só na edição, confirma em dialog e é **soft delete** — o template sai da biblioteca **e dos rituais**, mas o registro persiste para preservar a linhagem (`source_template`) das tarefas já alocadas. **Não há exclusão física.**"* — a frase que esta story implementa inteira.
- *"O grupo (`recurrence_group`) é editável na criação — herdado da aba — e **readonly** na edição."* ⚠️ Hoje o backend **aceita** `recurrence_group` no `PATCH` (`serializers.py:425-427`). Isso é matéria da **14.8** (a UX fala do card de edição), **não** desta story — não endureça o serializer aqui. Registrado em Questões abertas #3.
- *"offline mantém a consulta e desabilita criar/editar/ativar/**excluir** com motivo, sem fila local"* — superfície, 14.8. O backend não faz nada por offline.
- [Source: EXPERIENCE.md#State Patterns (L410-L411)] — *"Recorrente inativo: menor ênfase + chip 'inativo'; **visível só com 'Mostrar inativos'**; efeito prospectivo."* × *"Recorrente excluído: soft delete: **some da biblioteca e dos rituais**; registro e linhagem (`source_template`) preservados; confirmação em dialog."* **Estas duas linhas, lado a lado, são a AC6.**
- [Source: architecture-and-story-handoff.md#M09 (L41-L45)] — *"Definir soft delete com preservação de `source_template`; edição completa mantendo `recurrence_group` imutável… Preservam `RecurringTemplateManager`: `/planner/recurring`, abas, Mostrar inativos, categoria-cor, `recurrence_text` livre, sem ícone de estado, **ativação prospectiva** e alocação nos rituais."*
- [Source: epics.md#UX-DR24 (L337)] — *"footer Salvar / Ativar-Desativar / Excluir; **soft delete** com dialog (preserva a FK `source_template` das tarefas alocadas)."*
- [Source: EXPERIENCE.md#Weekly (L231)] — *"**Não alocar nesta semana** remove o aviso **sem desativar** o template."* Três estados distintos convivem no mesmo template: `skip_week` (decisão-snapshot de **um** ritual), `active=False` (fora dos rituais, dentro da biblioteca) e excluído (fora de tudo). Não os confunda em teste nem em código.

### Forma decidida (AD-08 + AD-12 — não redecidir)

[Source: architecture.md#AD-08 (L492-L553)]

1. **Template em tabela separada** (`recurring_task_templates`) — *"um template não é uma tarefa: não tem `status`, `log_id` nem ciclo de vida, e não migra"* (item 1). Logo, soft delete **não** é uma transição de `TaskStatus` e **não** entra na máquina de estados da AD-02.
2. **Placement gera nova `task` (snapshot), com ponteiro de linhagem** (item 2) — *"**Não é referência viva** ao template"*. A instância **não lê** o template depois; por isso excluir o template **não pode** alterar nenhuma Task, e é por isso que a AC5 se prova **por ausência de mudança**.
3. **Instância e template são independentes** (item 3) — *"editar o template afeta só placements futuros, nunca os já feitos"*. Excluir é o caso-limite disso: afeta só placements futuros (não haverá nenhum).
4. **`active` é booleano simples — SEM versionamento** (item 6), *"contraste consciente com AD-06/AD-07… YAGNI por ora"*. **`deleted_at` segue a mesma filosofia:** um campo, sem versionamento, sem tabela de auditoria, sem histórico de quem excluiu.
5. **Schema da AD** (`L533-541`) lista os campos de `recurring_task_templates` terminando em `active`. Esta story acrescenta `deleted_at` — **é um gap de spec conhecido**: atualizar o bloco de schema da AD-08 (e a §6.1 se ela listar a tabela) faz parte do fechamento (guardrail codificado em `_bmad/custom/bmad-dev-story.toml`: *"a atualização do documento-fonte entra no escopo de fechamento da story"*).

[Source: architecture.md#AD-12] — manager auto-escopado sempre; `all_objects` **proibido** fora de admin/migration.

### Ambiguidades resolvidas nesta story (documentadas em vez de improvisadas)

1. **`deleted_at` (timestamp nulável) em vez de `deleted` (booleano).** O AC do épico diz *"flag lógica"*. Um `DateTimeField` nulável é uma flag lógica **mais** a auditoria; `core.calendar.now()` existe exatamente para isso e `RitualDecision` já usa `TIMESTAMPTZ`. Um booleano jogaria "quando" fora sem economizar coluna. Registrado em Questões abertas #1 — troca de uma linha se o dono discordar.
2. **Helper explícito (`live_templates`) em vez de manager com filtro default.** Ver Task 2 para as três razões. O exemplar do repo é `undisposed_roots`.
3. **204 sem corpo, não 200 com o template.** Idioma DRF para delete, e devolver um objeto que nenhuma listagem volta a mostrar convidaria o cliente a renderizá-lo.
4. **Idempotente (204 nas duas chamadas), não 404 na segunda.** Coerente com a 14.1 (*"os services são idempotentes"*) e com a 14.2 (`upsert` com zero escrita na re-execução). Um 404 na segunda chamada transformaria um duplo-clique em erro visível sem nenhum ganho.
5. **`PATCH` sobre excluído devolve 404, não 409.** O template *não está* na biblioteca; "não encontrado" é a verdade do recurso. Um 409 sugeriria que existe um estado a resolver — e não existe: é irreversível.
6. **`skip_week` sobre excluído devolve 409 `InvalidRitualDecision`, não 404.** Não é escolha: é o que o código **já** faz quando o item não é encontrado (`rituals.py:148-149`), com mensagem neutra por decisão de segurança da 14.2. Aplicar `live_templates` ali é a mudança de **uma** expressão.
7. **Nenhum caminho de leitura para excluídos.** Sem `?include_deleted=true`, sem endpoint de detalhe. A AC diz *"some da biblioteca e das fontes"* e a 14.3 estabeleceu a disciplina de não inventar contrato sem visto do dono. **Consequência real, registrada:** uma Task cuja origem foi excluída carrega um `sourceTemplate` que nenhum endpoint resolve. Questões abertas #2 — se a 14.8 precisar do título na linhagem, a resposta aditiva mais barata é expor `sourceTemplateTitle` no `TaskSerializer` (não um filtro `?ids=`, que reabriria a biblioteca).
8. **`on_delete=SET_NULL` fica como está.** É a rede de segurança do banco, não um caminho de produto. Trocar por `PROTECT` "para garantir" quebraria `test_deletar_template_nao_deleta_a_task_instancia_set_null` e o `purge_e2e_users` sem necessidade — o guard de `.delete(` (AC3) já cobre o que precisa ser coberto.
9. **Sem índice parcial em `deleted_at`.** Tabela de caderno pessoal; o `user_id` já é indexado. Decisão registrada em comentário para não parecer esquecimento.
10. **`recurrence_group` continua editável no `PATCH`.** M09 pede readonly na edição, mas isso é o **card da 14.8**; endurecer o serializer aqui mudaria um contrato que a UI legada usa, numa story cujo AC não o menciona. Questões abertas #3.

### Convenções que o dev **não** pode violar

- Serviço em `<app>/services/<agregado>.py`, **funções de módulo, nunca classes**; `def <verbo>_<substantivo>(*, user, ...)`; view **fina** (serializer → serviço → serializer); serviço recebe dados validados, **nunca** `request` [Source: architecture.md#6.2].
- Regra de produto **no serviço**, nunca em serializer nem em view; erro de domínio é `DomainError` → 409 [Source: architecture.md#6.4, #6.6]. **Esta story não cria exceção nova.**
- Manager auto-escopado `objects` sempre; `all_objects` **proibido** fora de admin/migration [Source: architecture.md#AD-12].
- Sem `date.today()`/`timezone.now()` fora de `core/calendar.py` — guardrail de AST em `core/tests/test_guardrails.py:55-106`, que **inclui `factories.py`** (só `test_*.py` e `conftest.py` são pulados).
- Migration **nomeada** (`-n`), aplicada a `dev` **e** à branch Neon `e2e` antes do Playwright [Source: architecture.md#6.1; lição recorrente 7.1/7.2/14.1].
- `core` não importa app de domínio (`lint-imports` no CI).
- `parameters=[...]` (quando houver query param) + `responses=` em **todo** `@extend_schema` — o schema é gate de CI.
- Testes por camada: `test_models.py` / `test_serializers.py` / `test_services.py` / `test_views.py`. Asserts de fio com `.json()`, **nunca** `.data`.
- **Não copiar código ao espelhar.** Os "gêmeos" desta story são os **seis pontos de leitura**: eles pedem **uma** função compartilhada, não seis `deleted_at__isnull=True`.
- Nomes e docstrings de teste em **pt-BR** descritivo.

### Project Structure Notes

| Arquivo | Ação |
|---|---|
| `backend/bujo/models.py` | UPDATE — 1 campo em `RecurringTaskTemplate` |
| `backend/bujo/migrations/0009_recurringtasktemplate_deleted_at.py` | **NEW** — 1 `AddField`, sem `RunPython` |
| `backend/bujo/services/recurring.py` | UPDATE — `live_templates` + `soft_delete_template`; `update_template`/`place_template` filtrados; docstring do módulo |
| `backend/bujo/services/rituals.py` | UPDATE — 3 querysets de template + o lookup do item em `upsert_ritual_decision` |
| `backend/bujo/views.py` | UPDATE — `GET` da listagem filtrado; método `delete` na view de detalhe |
| `backend/bujo/tests/factories.py` | UPDATE — trait `deleted` (data fixa, nunca `now()`) |
| `backend/bujo/tests/{test_models,test_services,test_views}.py` | UPDATE |
| `_bmad-output/planning-artifacts/architecture.md` | UPDATE — bloco de schema da AD-08 ganha `deleted_at` (gap de spec, item 5 acima) |
| `schema.yaml`, `frontend/src/api/types.gen.ts` | UPDATE — **gerados**, 0 deleções |

**Sem serializer novo. Sem rota nova. Sem exceção nova. Sem arquivo de produção novo.**

**Fora de escopo, explicitamente:** o botão **Excluir**, o dialog de confirmação, o card de edição compartilhado, `recurrence_group` readonly, abas com contagem e o termo "Alocar" (todos **14.8**); qualquer superfície de UI (14.5–14.10); `RecurringTaskTemplateSerializer` expondo `deleted_at`; endpoint de restauração; endpoint de detalhe de template; `?include_deleted`; índice parcial; purga física de excluídos antigos; conserto dos locators pré-existentes de `recurring-templates.spec.ts:306` e `weekly-monthly-task-crud.spec.ts`; `ruff format` global (48 arquivos pré-existentes).

### Previous Story Intelligence

**Story 14.3** (`done` 2026-07-25) — a story imediatamente anterior, mesmo agregado. O que importa herdar:

- **Achado C1 (CRÍTICO) — a lição mais cara e mais transferível:** um experimento de não-vacuidade ficou **revertido no fonte de produção** (`# EXPERIMENTO (C)` no arquivo entregue). `ruff check` e `lint-imports` seguiram **verdes** porque o resíduo era sintaticamente válido; só o pytest o pegaria, e o pytest **não foi re-executado** depois do último experimento. **Transferência direta:** os experimentos desta story mexem em `views.py`, `rituals.py` e `recurring.py` — três arquivos, três reversões. Depois do último: `git diff` na árvore inteira **+ pytest full-suite**, nessa ordem, sem exceção (AC7).
- **Achado C2 — "gate afirmado sem execução":** três afirmações de fechamento descreviam uma árvore que não era a entregue. **Transferência:** todo número colado em Completion Notes vem de um comando rodado **depois** do último commit de código.
- **Achado M1 — File List afirmando um arquivo inexistente** (`tests/test-summary-14-3.md`, escrito pelo passo de QA que rodou mas não gravou o resumo). **Transferência:** reconcilie o File List contra `git status --short` **depois** de qualquer passo pós-`dev-story`.
- **Achados M2/M3 — contagem não reconciliada depois do passo de QA:** "19 funções → 21 coletados" virou 24 → 32 na realidade. **Transferência:** conte parametrizações e re-derive **depois** do QA.
- **Padrão de guard por leitura de fonte** (`inspect.getsource` + ausência de literais) funcionou e é reusado aqui (AC3). Armadilha registrada na 14.3: o guard lê a **classe inteira, docstring incluída** — então um comentário citando o literal proibido faz o guard falhar por prosa. Ao escrever o comentário do `def delete`, **não** escreva a sequência `.delete(`.
- **Promoção de símbolo privado a público** entre services (`_undisposed_roots` → `undisposed_roots`) foi a solução aceita para compartilhar predicado — `live_templates` nasce público direto.

**Story 14.2** (`done` 2026-07-25):
- **Achado A1 (alto):** uma fonte anotava decisões-snapshot de um contexto onde não faziam sentido, porque a matriz casa apenas **tipos**. Correção: invariante **por construção**, não por filtro adicional. **Transferência:** `live_templates` é aplicado na **origem** de cada queryset (antes do `annotate`/`exclude`), não como um `.filter()` colado no fim de cada saída — filtrar na origem é o que faz as três saídas do bloco `annual` ficarem corretas de uma vez.
- **Achado B1 (baixo):** assert de lista **vacuoso** (lista vazia passava). **Transferência:** todo assert de "não aparece" desta story precisa de **dois** templates (um vivo, um excluído) e comparação de **conjunto de ids**, nunca `len(...) == 0`.
- **`.data` vs `.json()`:** 6 testes falharam na 14.2 por usar `response.data` (pré-render, snake_case).
- **Aditividade provada mecanicamente:** 14.1 `156/0` e `141/0`; 14.2 `594/0` e `562/0`; 14.3 `72/0` e `70/0`.

**Story 14.1** (`done` 2026-07-25):
- Migration com estado novo foi aplicada a `dev` **e** à branch Neon `e2e` **antes** do Playwright, e ainda assim o bug recorrente 7.1/7.2 quase se repetiu. Esta story tem migration — **o item de maior risco operacional é este**.
- `_sem_escrita` (helper com `CaptureQueriesContext`, `test_services.py:2130`) é o instrumento certo para provar idempotência **em SQL**, não por valor de retorno. A AC3 depende dele.
- Constraints/uniques parciais foram derivadas por helper em vez de copiadas — mesma disciplina que a AC2 exige para o filtro.

**Retrospectiva do Épico 13** — as classes de achado mais caras, todas relevantes aqui: contagem/divisão de testes escrita de memória; **File List** sem os artefatos dos passos pós-`dev-story`; **testes vacuosos** (incluindo "dois asserts que parecem medir a mesma coisa precisam de experimentos SEPARADOS").

### Git Intelligence

`fc4d46c` (`feat(story-14.3): Fila unificada de migração + aliases finos (backend)`) é o HEAD da branch `dev`. Os três commits anteriores são as 14.2 (`8fca90a`), 14.1 (`971da7c`) e o fechamento do Épico 13 (`c2ba650`).

- **Última migration commitada: `0008_ritual_decisions` (14.2).** A desta story é a **`0009`**. A 14.3 não criou nenhuma.
- Os padrões a espelhar vêm das três stories de backend imediatamente anteriores: helper de predicado compartilhado (`undisposed_roots`, `UNDISPOSED`), estrutura única no nível do módulo para parametrizar gêmeos (`_CycleSpec`, `ALLOWED_DECISIONS`, `_SectionSpec`), views finas com `@extend_schema` completo, `_sem_escrita` nos testes, guard por `inspect.getsource`.
- Convenção de mensagem: `feat(story-14.4): <resumo>`. **1 commit por story.**
- **Commit assinado e push falham no contexto de automação** (1Password SSH indisponível): usar `--no-gpg-sign` e deferir push para sessão interativa. Branch de trabalho é **`dev`** (homologação); `main` é produção.

### Latest Tech Information

- **Django 5.2.15** — `AddField` de coluna nulável em Postgres é `ALTER TABLE … ADD COLUMN … NULL`, **sem reescrita de tabela e sem lock longo**. Não há razão para `SeparateDatabaseAndState` nem para migration em duas fases.
- `save(update_fields=[...])` emite um `UPDATE` **só com as colunas listadas** — é o que garante mecanicamente que o soft delete não toca `active`. Sem `update_fields`, o Django reescreve **todas** as colunas do model.
- **`djangorestframework-camel-case`** cameliza a saída: se `deleted_at` **fosse** exposto viraria `deletedAt` — a AC4 o mantém fora. Query string **não** é camelizada (irrelevante: nenhum param novo).
- **`drf-spectacular`** com `camelize_serializer_fields` nos `POSTPROCESSING_HOOKS` (`config/settings/base.py:188-191`). `responses={204: None}` gera uma resposta sem `content` — é a forma correta para 204 e **não** cria componente novo. A advertência `ToStatusEnum` é **pré-existente**.
- **Node ≥20.12 via nvm** (`nvm use 22.15.1`) antes de **qualquer** comando de frontend/e2e — a sessão abre em v18 e não há `.nvmrc`.
- Pytest usa **Postgres local** (docker-compose, tmpfs): full-suite local é barato e é o padrão; o CI roda `uv run pytest` sem escopo. Neon só para `e2e`/`dev`.

### Testing

- **Baseline re-executada na criação desta story** (comando real, não copiado de documento anterior): `docker compose up -d db && cd backend && uv run pytest -q` no commit `fc4d46c` (2026-07-25) → **1242 passed em 338.79s**. Re-executar ao fechar, colar o número real e derivar a divisão herdados/novos de `git diff`, **nunca** por subtração.
- Fixtures (`backend/conftest.py`, único conftest raiz): `_enable_db_access` (autouse), `user`, `other_user`, `api_client`, `auth_client` (já entra em `tenant_context`). Testes de serviço envolvem o corpo em `with tenant_context(user):`.
- Factories: `backend/bujo/tests/factories.py` — `RecurringTaskTemplateFactory` (`:99-110`), `TaskFactory`, `WeeklyLogFactory`, `MonthlyLogFactory`, `RitualDecisionFactory`. **Datas fixas + `timedelta`**; o guardrail de AST de tempo varre este arquivo.
- Exemplares a espelhar: `test_update_template_escopado_por_tenant` (`test_services.py:1328` — o padrão de escopo por tenant em serviço de template); `test_get_recurring_templates_unplaced_year_isola_por_tenant` (`test_views.py:1980`); `test_get_recurring_templates_unplaced_year_combinado_com_active_e_recurrence_group` (`:2008` — o vizinho natural da matriz da AC6); `test_patch_recurring_template_de_outro_tenant_retorna_404` (`:2089`); `_sem_escrita` (`test_services.py:2130`); JWT real para isolamento (`test_views.py:39-57`); URLs como **literais**.
- **Testes que precisam continuar verdes sem edição de assert:** os 11 de listagem/PATCH de template (`test_views.py:1787-2100`), `test_deletar_template_nao_deleta_a_task_instancia_set_null` (`test_models.py:226`, só o docstring muda), `test_fonte_recorrentes_skip_week_sai_da_pendencia_sem_desativar_o_template` (`test_services.py:2843`) e `test_ac8_contrato_legado_preservado_nas_nove_respostas_nomeadas` (`test_views.py:3413`).
- E2E: Playwright sobe os servidores sozinho (`webServer`), frontend **5173** (`--mode e2e`, lê `.env.e2e`) e backend **8000** (`config.settings.e2e`), `workers: 1`, **não** roda no CI. `CI=1` e escopo por spec. **Nunca** matar 5174/8001 (dev local do dono). Falha em massa no fixture de signup = checar vazamento de `VITE_API_BASE_URL` antes de culpar o Neon.
- Specs de regressão desta story: `recurring-templates.spec.ts` (CRUD + placement), `future-log-annual.spec.ts` (`?unplaced_year`), `ritual-sources.spec.ts` (as fontes da 14.2).
- Esta story **não** cria superfície de UI: os E2E são de **regressão de contrato**, não de feature nova. Se o passo de QA (`bmad-qa-generate-e2e-tests`) criar spec/seed novo, **reconcilie o File List depois dele** (achado M1 da 14.3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.4: Soft delete de templates recorrentes (backend)] — ACs originais (linhas 2259–2274)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR24] — linha 337 (biblioteca, footer, soft delete com dialog, "Alocar" nos rituais)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.8: Recorrentes no sistema novo (M09)] — linhas 2335–2350 (a UI que consome este serviço; *"acionando o soft delete da 14.4"*)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-08] — L492–L553: template em tabela separada (item 1), snapshot com ponteiro de linhagem (item 2), independência instância/template (item 3), `active` booleano sem versionamento (item 6), template plano (item 8), bloco de schema (L533–541 — recebe `deleted_at` no fechamento)
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-12] — manager auto-escopado, `all_objects` proibido
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-04/#AD-07] — `now()` como fonte de timestamps de auditoria
- [Source: _bmad-output/planning-artifacts/architecture.md#6.1, #6.2, #6.4, #6.6, #6.9] — migrations nomeadas, camada de serviço, erros, validação, anti-padrões
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Recorrentes] — L349–L357; [#State Patterns] — *Recorrente inativo* (L410) e *Recorrente excluído* (L411); [#Weekly] — L231 (`skip_week` não desativa)
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/architecture-and-story-handoff.md#M09 — Recorrentes] — L41–L45
- [Source: ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-recorrentes.html] — composição aprovada da biblioteca (contrato visual da 14.8, não desta story)
- [Source: _bmad-output/implementation-artifacts/14-3-fila-unificada-de-migracao-e-aliases-finos-backend.md] — achados C1/C2/M1/M2 da code review, guard por `inspect.getsource`, disciplina de experimentos
- [Source: _bmad-output/implementation-artifacts/14-2-fontes-dos-rituais-e-decisoes-snapshot-backend.md] — fontes de ritual, `ALLOWED_DECISIONS`, achados A1/B1
- [Source: _bmad-output/implementation-artifacts/14-1-ciclos-de-vida-de-weekly-e-monthly-backend.md] — `_sem_escrita`, migration aplicada à branch e2e
- [Source: backend/bujo/models.py] — `RecurringTaskTemplate` (:400), `Task.source_template` (:229)
- [Source: backend/bujo/services/recurring.py] — `create_template` (:15), `update_template` (:20), `place_template` (:29)
- [Source: backend/bujo/services/rituals.py] — `upsert_ritual_decision` (:95), `undisposed_roots` (:238), `_partition_by_placement` (:302), `list_weekly_recurring_candidates` (:340), `list_monthly_recurring_candidates` (:420)
- [Source: backend/bujo/views.py] — `RecurringTaskTemplateListView` (:213), `RecurringTaskTemplateDetailView` (:246), `RecurringTaskTemplatePlaceView` (:262)
- [Source: backend/bujo/serializers.py] — `TaskSerializer` (:21), `RecurringTaskTemplateSerializer` (:384), `…UpdateSerializer` (:415)
- [Source: backend/core/calendar.py] — `now()` (:22); [backend/core/models.py] / [backend/core/tenant.py] — `TenantModel`, `TenantManager`; [backend/core/tests/test_guardrails.py] — manager escopado (:40), tempo (:55)
- [Source: backend/bujo/tests/factories.py] — `RecurringTaskTemplateFactory` (:99), `register_isolation_case` (:167)
- [Source: frontend/src/features/bujo/api.ts] (:395–506) + [components/{RecurringTemplateManager,RecurringPlacementSection}.tsx] + [pages/planner/FuturePage.tsx] (:78) — consumidores (não tocar)
- [Source: docs/e2e-neon-reset.md] — runbook da branch `e2e` e fallback Postgres local

### Questões abertas (para o dono — não bloqueiam a implementação)

1. **`deleted_at` (timestamp) em vez de `deleted` (booleano).** O AC do épico diz *"flag lógica"*. Entregue como timestamp nulável: mesma semântica de flag (`IS NULL`), com "quando" de graça e sem coluna extra. Se preferir booleano, é troca de uma linha no model + a migration.
2. **Template excluído fica ilegível pela API.** Uma Task cuja origem foi excluída mantém `sourceTemplate` no fio, mas nenhum endpoint resolve esse id (a listagem passa a excluí-lo e não há endpoint de detalhe). O registro está preservado no banco — a **linhagem de dados** está íntegra, a **linhagem navegável** não. Se a 14.8 precisar mostrar "veio do template X (excluído)", a resposta aditiva mais barata é expor `sourceTemplateTitle` no `TaskSerializer`; reabrir a biblioteca com `?include_deleted=true` seria contra o AC.
3. **`recurrence_group` continua editável no `PATCH`.** M09 pede readonly na edição, mas isso é o card da 14.8 e o AC desta story não menciona. Se preferir endurecer no backend, é `read_only` no `RecurringTaskTemplateUpdateSerializer` — mas mudaria um contrato que a UI legada usa hoje.
4. **Sem purga física, nunca.** Nada apaga templates excluídos, jamais. Numa base pessoal isso é irrelevante; se um dia incomodar, um management command de purga (que teria de zerar `source_template_id` das instâncias) seria o caminho — e destruiria a linhagem, que é o oposto do que esta story existe para proteger.
5. **`?unplaced_year` combinado com excluídos.** A elegibilidade anual do `FuturePage` passa a nunca listar excluídos. É o comportamento correto pelo AC (*"some das fontes dos rituais"*), mas vale o registro: um anual excluído **deixa de ser lembrado**, mesmo sem instância no ano.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5[1m]) — Claude Code, workflow `bmad-dev-story`, 2026-07-25.

### Debug Log References

**Ordem de execução (red-green-refactor por task).** Cada task teve o teste escrito e visto FALHAR antes da implementação: Task 1 (`AttributeError: 'RecurringTaskTemplate' object has no attribute 'deleted_at'`), Tasks 2–3 (`ImportError: cannot import name 'live_templates'`), Task 4 (os 9 testes de fio contra a view sem `delete`).

**Migration aplicada aos DOIS bancos antes do Playwright** (bug recorrente 7.1/7.2/14.1 — o item de maior risco operacional desta story):
- `dev`: `Applying bujo.0009_recurringtasktemplate_deleted_at... OK`; `migrate --check` → exit 0.
- Branch Neon `e2e` (`DJANGO_SETTINGS_MODULE=config.settings.e2e`): `Applying bujo.0009_recurringtasktemplate_deleted_at... OK`; `migrate --check` → exit 0.
- Migration conferida linha a linha: **um** `AddField`, zero `RunPython`, zero `AlterField`, zero `CreateModel`.

**Três experimentos de não-vacuidade SEPARADOS**, um por propriedade, cada um com a suíte `bujo/tests/` inteira (sem `-k`):

| # | Propriedade revertida | Arquivo | Vermelhos |
|---|---|---|---|
| (a) | `live_templates()` → `RecurringTaskTemplate.objects.all()` na listagem | `views.py` | **2** — `test_delete_recurring_template_retorna_204_sem_corpo_e_some_da_listagem`, `test_matriz_active_x_excluido_em_todas_as_combinacoes_de_query_param` (2 failed, 606 passed) |
| (b) | `live_templates(...)` removido de `list_weekly_recurring_candidates` | `rituals.py` | **1** — `test_fonte_recorrentes_semanais_exclui_o_template_excluido_de_items_E_de_already_placed` (1 failed, 607 passed) |
| (c) | early-return de idempotência removido (passa a reescrever `deleted_at`) | `recurring.py` | **2** — `test_soft_delete_template_idempotente_preserva_o_deleted_at_original_sem_escrita` (SQL) e `test_delete_recurring_template_duas_vezes_retorna_204_com_deleted_at_inalterado` (fio); dois asserts diferentes, dois vermelhos distintos |

**Resíduo zero, verificado SOBRE A ÁRVORE FINAL** (achado C1/C2 da 14.3 — `ruff`/`lint-imports` ficaram verdes com resíduo lá, porque resíduo sintaticamente válido só o pytest pega): após o último experimento, `grep -rn "EXPERIMENTO" backend/ frontend/src` → nenhum resultado; `git diff` das 3 linhas revertidas conferido individualmente (toda linha `-` do diff dos 3 arquivos de produção é uma mudança intencional da story, listada uma a uma); e a **full-suite re-executada depois disso** (1262 passed). O gate estático verde NÃO substituiu re-rodar o pytest.

**Divergências de especificação encontradas e resolvidas (documentadas em vez de improvisadas):**

1. **`types.gen.ts` fecha 21/1, não 21/0.** A AC7 previa **0 deleções** nos dois arquivos gerados. `schema.yaml` fechou **16/0** como previsto; `types.gen.ts` tem **1 deleção**, que é a linha `delete?: never;` do path `/api/bujo/recurring-templates/{id}/` sendo substituída por `delete: operations["bujo_recurring_templates_destroy"];`. O `openapi-typescript` emite um placeholder por verbo ausente, então acrescentar um verbo **necessariamente** reescreve essa linha. A invariante que a AC realmente protege — "nenhum componente muda de forma" — vale: o diff tem exatamente 2 hunks, o placeholder e o bloco novo da operação. Nenhum outro tipo mudou.
2. **Docstring de classe vaza para o schema.** A primeira versão do comentário obrigatório da Task 4 foi escrita como **docstring** de `RecurringTaskTemplateDetailView`, e o `drf-spectacular` a promoveu a `description` de **todas** as operações da classe — o `PATCH` passou a carregar no contrato uma explicação sobre o `DELETE` (schema fechava 24/0 em vez de 16/0). Convertido para comentário `#`, como a Task 4 pede literalmente ("um comentário curto na classe"); o motivo ficou registrado inline para ninguém reverter.
3. **O grep da Task 2 dá 5 linhas, não 3.** O critério escrito era "exatamente três ocorrências de produção de `deleted_at`". O real são 5 linhas de código, mas em exatamente os **3 sítios** previstos: o campo (`models.py`), o filtro (`live_templates`) e `soft_delete_template` — que naturalmente cita a coluna 3 vezes (guard de idempotência, atribuição, `update_fields`). O que o critério protege é que **nenhum quarto lugar redeclare o filtro**, e isso está provado de forma mais forte: `grep -rn "deleted_at__isnull" backend/` devolve **uma única linha** (`recurring.py:41`).
4. **A migration não é formatada pelo `ruff` — é excluída dele.** A Task 7 dizia que a `0009` "nasce formatada". Na verdade `pyproject.toml` tem `extend-exclude = ["migrations"]`: a lista vermelha do `ruff format` não contém migration nenhuma, antes ou depois. A `0009` ficou no estilo default do Django (aspas simples), idêntico a `0006`/`0008` — que é a convenção real do repo.
5. **Gap de spec fechado + um achado extra no mesmo bloco.** O bloco de schema da AD-08 ganhou `deleted_at` e um item **6b** descrevendo a decisão (lógica, ortogonal a `active`, helper único, sem restauração). Ao editar o bloco, apareceu que ele **também** não listava `category`, presente no model desde a migration `0005` — exatamente a classe de gap da Retro do Épico 3, ainda aberta neste bloco. Acrescentado como as-built na mesma edição. As ACs de `epics.md` (linhas 2259–2274) foram relidas e estão integralmente cobertas (guardrail da Retro do Épico 4 #2 — checar `epics.md`, não só `architecture.md`/`prd.md`).

**Falha de E2E pré-existente, não re-diagnosticada:** `recurring-templates.spec.ts:306` (locator `Definir placement`), herdada da 13.3 e já medida na 14.2 **e** na 14.3. Story de backend puro não a conserta (fora de escopo declarado).

**Passo de QA (`bmad-qa-generate-e2e-tests`, 2026-07-25) — o que ele acrescentou.** Seis testes de API novos (fio das duas fontes de ritual, `POST /ritual-decisions/` sobre excluído, blindagem de contrato, combinação dos três query params, interação com decisão-snapshot) e o **primeiro spec E2E desta story** (`frontend/e2e/recurring-soft-delete.spec.ts`, 4 testes). Detalhamento em `tests/test-summary-14-4.md`. **Nenhum defeito de produção encontrado** — nenhum arquivo de produção foi alterado por este passo; a única correção foi num teste próprio (`ruff` F841: duas variáveis de cenário sem uso em `test_fonte_recorrentes_mensal_no_fio_perde_o_excluido_dos_quatro_buckets`, cujo assert é sobre `recurrenceText`).

**Mais QUATRO experimentos de não-vacuidade SEPARADOS** (além dos três do `dev-story`), escolhidos por cobrirem exatamente as propriedades que os três primeiros **não** tocaram — a fonte mensal, o lookup da decisão, o contrato do serializer e o fio até a UI:

| # | Propriedade revertida | Arquivo | Vermelhos |
|---|---|---|---|
| (d) | `live_templates(...)` removido das **duas** querysets de `list_monthly_recurring_candidates` | `rituals.py` | **2** — `test_fonte_recorrentes_mensais_exclui_o_excluido_das_TRES_saidas` (serviço, do `dev-story`) e `test_fonte_recorrentes_mensal_no_fio_perde_o_excluido_dos_quatro_buckets` (fio, novo) — 2 failed, 612 passed |
| (e) | `live_templates()` removido do lookup de item de `upsert_ritual_decision` | `rituals.py` | **2** — o teste de serviço do `skip_week` e `test_post_decisao_skip_week_sobre_template_excluido_e_409_neutro_e_nao_persiste` (o de fio prova o **409**, que o de serviço não observa) — 2 failed, 612 passed |
| (f) | `deleted_at` acrescentado ao `fields` do `RecurringTaskTemplateSerializer` (o vazamento que a AC4 proíbe) | `serializers.py` | **3** — `test_deleted_at_nao_vaza_no_contrato_de_template_em_nenhuma_das_tres_respostas`, `test_fonte_recorrentes_semanal_no_fio_...` (o `template` aninhado usa o mesmo serializer) e `test_ac8_contrato_legado_preservado_nas_nove_respostas_nomeadas` — 3 failed, 611 passed |
| (g) | `live_templates()` → `objects.all()` na listagem (mesma reversão da (a), agora medida **no browser**) | `views.py` | **4 de 4** testes do spec E2E novo, cada um falhando na linha do assert de ausência — a prova de que nenhum "sumiu" do spec passa por página vazia |

**Resíduo zero, conferido por hash, não por leitura:** os três arquivos de produção tocados pelos experimentos foram copiados antes (`views.py`, `serializers.py`, `rituals.py`) e restaurados por cópia; `md5` dos três na árvore final é **idêntico** ao dos backups. `grep -rn "EXPERIMENTO" backend/ frontend/src frontend/e2e` → nenhum resultado. `git diff --stat` fecha com as **mesmas 24 deleções** de antes do passo (nenhuma linha de produção foi alterada), e a **suíte cheia foi re-executada depois do último experimento** (achado C1/C2 da 14.3).

### Completion Notes List

**O que foi entregue.** Soft delete de templates recorrentes, backend completo: uma coluna nulável, um helper compartilhado, um serviço idempotente e um verbo HTTP na rota que já existia. Nenhum serializer, nenhuma rota, nenhuma exceção e nenhum arquivo de produção novos — e nenhum arquivo de frontend de produção tocado (só os dois gerados).

- **AC1** — `deleted_at = models.DateTimeField(null=True, blank=True)` em `RecurringTaskTemplate`, logo abaixo de `active` (os dois eixos adjacentes, o contraste documentado em comentário). Migration `0009_recurringtasktemplate_deleted_at` com **um** `AddField` e nada mais; sem backfill, porque toda linha pré-existente nasce `NULL` = viva. Timestamp de `core.calendar.now()`. Aplicada a `dev` **e** à branch Neon `e2e`, `migrate --check` limpo nas duas antes do Playwright.
- **AC2** — `live_templates(queryset=None)` em `services/recurring.py`, espelhando a forma de `undisposed_roots` (helper de módulo que recebe/devolve queryset, não manager, não classe — as três razões estão no docstring). Aplicado nos **seis** pontos: listagem (`views.py`), fonte weekly, fonte monthly (`monthly` e `annual`), `update_template`, `place_template`. O **sétimo** ponto herdou o filtro: `upsert_ritual_decision` troca uma expressão e `skip_week` sobre excluído cai no `item is None` que já existia → **409 `InvalidRitualDecision`** com a mensagem neutra, sem exceção nem mensagem nova. Nas fontes, o filtro entra na **origem** de cada queryset (antes de `annotate`/`exclude`), que é o que faz `items` + `alreadyPlaced` e as três saídas do bloco anual ficarem corretas de uma vez — achado A1 da 14.2 aplicado.
- **AC3** — `soft_delete_template(*, user, template_id)`: localiza pelo manager escopado **sem** o filtro (única exceção à AC2, com o porquê em comentário no ponto exato), devolve sem escrever se `deleted_at` já estiver preenchido, e grava `save(update_fields=["deleted_at"])` — uma coluna só, o que garante mecanicamente que `active` e o conteúdo não são tocados. Guard por `inspect.getsource` sobre `bujo.services.recurring` **e** `RecurringTaskTemplateDetailView` provando a ausência do literal `".delete("`.
- **AC4** — `DELETE /api/bujo/recurring-templates/<pk>/` na view de detalhe **existente** (nenhuma rota nova), `@extend_schema(responses={204: None})`, 204 sem corpo, idempotente (204 nas duas, carimbo da segunda igual ao da primeira), 401 sem token, 404 de outro tenant (com Bearer real) e 404 para id inexistente. Nenhum serializer expõe `deleted_at`; não existe endpoint de restauração.
- **AC5** — Linhagem provada com **duas** instâncias (weekly + monthly): `source_template_id` comparado **com o id original** (não `is not None`), linha presente por `objects` **e** por `all_objects`, e no fio a resposta de Task fica **idêntica** antes e depois da exclusão (`depois["unscheduled"] == antes["unscheduled"]`). `test_deletar_template_nao_deleta_a_task_instancia_set_null` continua verde **sem edição de assert** — só o docstring ganhou a frase esclarecendo que nenhum caminho de produção chega ali.
- **AC6** — Matriz de 4 células (`active` × vivo/excluído) assertada sobre a mesma listagem, célula por célula, em **todas** as combinações de query param: sem filtro, `?active=true`, `?active=false`, `?recurrence_group=`, `?unplaced_year=` (a do `FuturePage`, a que mais escapa). Assert de **conjunto de ids** em todas — nunca `len`, e sempre com um vivo ao lado do excluído, para nenhum assert de ausência passar por lista vazia (achado B1 da 14.2). Reversibilidade de `active` provada de ponta a ponta contra a irreversibilidade de `deleted_at`, e assert explícito de que excluir **não** altera `active`.
- **AC7** — Contrato aditivo e gates fechados com números reais (abaixo).

**Gates — números REAIS, colados de execução posterior à última alteração de código:**

| Gate | Resultado |
|---|---|
| `uv run pytest` (**full-suite, sem escopo de caminho**) | **1268 passed em 240.72s** — re-executada no passo de QA, **depois** do último experimento. Baseline `fc4d46c` era 1242, então **1242 herdados + 26 novos**. *(O `dev-story` fechou em 1262 passed / 270.34s; o passo de QA somou os 6 testes de API.)* ⚠️ **Número final da story: 1269** — a code review confirmou os 1268 por execução própria e acrescentou 1 teste (achado A1). |
| Divisão herdados/novos | **derivada de `git diff -U0 backend/bujo/tests/`**: **26** funções `test_` novas (**20** do `dev-story` + **6** do passo de QA), **zero** parametrizações novas → 26 coletados (o total 1242+26=1268 confirma, mas a divisão veio do diff, não de subtração) |
| `uv run ruff check` | All checks passed (re-executado no passo de QA; duas variáveis sem uso nos testes novos foram corrigidas antes de fechar) |
| `uv run lint-imports` | **1 kept, 0 broken** (o import novo `rituals.py → services.recurring` não cria ciclo) |
| `uv run ruff format --check` | 48 arquivos, **lista byte-idêntica ao baseline** (`diff` das listas antes/depois, não contagem); `services/recurring.py` e `services/rituals.py` seguem **fora** da lista vermelha |
| `manage.py makemigrations --check --dry-run` | **No changes detected** (model e migration em sincronia) |
| `npx tsc --noEmit` (Node 22.15.1) | limpo |
| `git diff --numstat` | `schema.yaml` **16/0**; `types.gen.ts` **21/1** (a deleção é o placeholder `delete?: never` — ver Debug Log #1) |
| `migrate --check` branch Neon `e2e` | limpo, **antes** do Playwright |
| E2E (`recurring-soft-delete` **novo** + regressão `recurring-templates`, `future-log-annual`, `ritual-sources`) | **11 passed / 1 failed em 6,5 min** (`CI=1`, `--retries=0`, portas 5173/8000) — os **4** testes do spec novo passaram; a única falha é a pré-existente `recurring-templates.spec.ts:306` (locator `Definir placement`), mesmo teste/linha/locator já medidos na 14.2 e na 14.3. *(O `dev-story` havia fechado em 7 passed / 1 failed, antes de o spec novo existir.)* |
| Experimentos de não-vacuidade | **7 separados**: 3 do `dev-story` (2+1+2 vermelhos) e **4 do passo de QA** (2+2+3 vermelhos no pytest e 4-de-4 no E2E). Resíduo zero conferido sobre a árvore final — por `md5` dos arquivos restaurados, não por leitura — **e** full-suite re-executada depois do último |

**Testes de caracterização verdes sem edição de assert**, como a story exigia: os 11 de listagem/PATCH de template (`test_views.py:1787-2100`), `test_deletar_template_nao_deleta_a_task_instancia_set_null`, `test_fonte_recorrentes_skip_week_sai_da_pendencia_sem_desativar_o_template` e `test_ac8_contrato_legado_preservado_nas_nove_respostas_nomeadas`.

**Decisão de escopo registrada:** a factory ganhou o trait `deleted` (data fixa `datetime(2026, 1, 1, tzinfo=UTC)`, **nunca** `now()` — o guardrail de AST varre `factories.py`), porque 3 testes repetiriam o literal. Nenhum caso novo em `register_isolation_case` (nenhum model novo nasceu).

### File List

**Backend — produção**
- `backend/bujo/models.py` — UPDATE: campo `deleted_at` em `RecurringTaskTemplate` (+ comentário do contraste com `active` e da decisão de não criar índice parcial)
- `backend/bujo/migrations/0009_recurringtasktemplate_deleted_at.py` — **NEW**: um `AddField`, sem `RunPython`
- `backend/bujo/services/recurring.py` — UPDATE: `live_templates()` e `soft_delete_template()` novos; `update_template`/`place_template` passam a ler por `live_templates()`; docstring do módulo cobre exclusão lógica (+ **code review**: o docstring passou a delimitar o escopo da regra ao caminho `objects`, porque `purge_e2e_users` remove templates fisicamente pelo `all_objects` — achado B2)
- `backend/bujo/services/rituals.py` — UPDATE: import de `live_templates`; 3 querysets de template (weekly, monthly, annual) filtradas na origem; lookup de item em `upsert_ritual_decision`
- `backend/bujo/views.py` — UPDATE: imports de `live_templates`/`soft_delete_template`; `GET` da listagem filtrado; método `delete` na `RecurringTaskTemplateDetailView` + comentário da classe

**Backend — testes**
- `backend/bujo/tests/factories.py` — UPDATE: trait `deleted` em `RecurringTaskTemplateFactory` (data fixa); import de `UTC`/`datetime`
- `backend/bujo/tests/test_models.py` — UPDATE: 1 teste novo (`deleted_at` nasce `NULL`) + frase no docstring de `test_deletar_template_nao_deleta_a_task_instancia_set_null` (asserts intocados)
- `backend/bujo/tests/test_services.py` — UPDATE: **11** testes novos (soft delete, idempotência em SQL, tenant, linhagem, `update`/`place` sobre excluído, `live_templates`, fontes weekly/monthly, `skip_week`) + import ampliado. **10 do `dev-story` + 1 da code review** (`test_soft_delete_template_escreve_SOMENTE_a_coluna_deleted_at_no_sql` — achado A1)
- `backend/bujo/tests/test_views.py` — UPDATE: **15** testes novos + imports de `uuid`, `bujo.services.recurring` e `RecurringTaskTemplateDetailView`. **9 do `dev-story`** (204/idempotência/401/404×2, matriz da AC6, reversibilidade × irreversibilidade, linhagem no fio, guard de exclusão física) e **6 do passo de QA** (blindagem de `deletedAt` no contrato + a constante `_CHAVES_DE_TEMPLATE_NO_FIO`, três query params combinados, fio das fontes de ritual semanal e mensal, `POST /ritual-decisions/` 409 neutro, interação com decisão-snapshot)

**Contrato gerado (nunca editado à mão)**
- `schema.yaml` — UPDATE: operação `delete` sob o path existente (16/0)
- `frontend/src/api/types.gen.ts` — UPDATE: `bujo_recurring_templates_destroy` (21/1 — ver Debug Log #1)

**Documentação de spec**
- `_bmad-output/planning-artifacts/architecture.md` — UPDATE: bloco de schema da AD-08 ganha `deleted_at` (e `category`, gap as-built pré-existente no mesmo bloco) + item **6b** com a decisão de exclusão lógica

**E2E — criado pelo passo de QA (`bmad-qa-generate-e2e-tests`)**
- `frontend/e2e/recurring-soft-delete.spec.ts` — **NEW** (+ **code review**: os dois asserts tautológicos de "cenário não degenerado" — `expect(a.id).not.toBe(b.id)`, que nunca podiam falhar — foram trocados por conferência do estado do SERVIDOR via `api.list()`, achado B1), e **artefato de tipo novo** para esta story (o `dev-story` fechou sem nenhum spec E2E): 4 testes contra a branch Neon `e2e` — AC6 na biblioteca real (o excluído não volta nem com "Mostrar inativos" ligado, o inativo volta), o anual excluído saindo de "Anuais pendentes" do Future Log (único consumidor de `?unplaced_year`), AC5 no banco real (a instância sobrevive e o template sai da seção de placement até com "Mostrar já colocados") e `DELETE` idempotente 204/204 com `PATCH` pós-exclusão em 404. Toda escrita pelo fio, porque o botão Excluir só nasce na 14.8

**Rastreamento**
- `_bmad-output/implementation-artifacts/14-4-soft-delete-de-templates-recorrentes-backend.md` — este arquivo
- `_bmad-output/implementation-artifacts/tests/test-summary-14-4.md` — **NEW**: resumo do passo de QA (lacunas fechadas, 4 experimentos, gates)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE: `14-4-...` → `in-progress` → `review`

*Reconciliado contra `git status --short` e `git diff --stat` **depois** do passo de QA (não só depois do `dev-story`): a afirmação anterior — "nenhum artefato de tipo novo foi criado por esta story: nenhum spec E2E novo… só a migration `0009`, que é o único arquivo NEW" — **ficou falsa** e está corrigida acima. São **três** arquivos NEW: a migration `0009`, o spec `recurring-soft-delete.spec.ts` e o `test-summary-14-4.md`. Nenhum arquivo de produção foi alterado pelo passo de QA (os 4 experimentos foram restaurados por cópia e conferidos por `md5`), e as contagens de teste abaixo foram refeitas pelo `git diff`, não por subtração.*

### Senior Developer Review (AI)

**Revisor:** Hugo (workflow `bmad-story-automator-review`, auto-fix) · **Data:** 2026-07-25 · **Resultado:** **Aprovada** — `review` → `done`

**Zero achados CRÍTICOS e zero ALTOS.** As 7 ACs estão implementadas, e **todas** as tasks marcadas `[x]` foram verificadas contra o código: nenhuma caixa marcada sem entrega. É a primeira story do Épico 14 em que **nenhum** gate afirmado precisou de correção — as lições C1/C2 da 14.3 (resíduo de experimento no fonte, número de fechamento afirmado sem execução) **não** se repetiram.

**Todos os números do fechamento foram RE-EXECUTADOS pela review, não lidos da story:**

| Gate | Afirmado | Medido pela review |
|---|---|---|
| `uv run pytest` (full-suite, sem escopo) | 1268 passed | **1268 passed / 239.18s** ✓ (→ **1269** depois do teste que a review acrescentou) |
| Divisão herdados/novos | 26 funções, 0 parametrizações | **26 / 0** por `git diff -U0` ✓ (1+10+15 por arquivo) |
| `ruff check` | limpo | limpo ✓ |
| `lint-imports` | 1 kept, 0 broken | **1/0** ✓ |
| `ruff format --check` | 48, lista igual à baseline | **48**; `services/recurring.py`, `services/rituals.py` e a `0009` seguem **fora** da lista ✓ |
| `makemigrations --check --dry-run` | No changes detected | ✓ |
| `npx tsc --noEmit` / `eslint` | limpos | ambos limpos ✓ |
| `migrate --check` branch Neon `e2e` | limpo | **exit 0** ✓ (bug recorrente 7.1/7.2/14.1 **não** se repetiu) |
| `schema.yaml` em sincronia | 16/0 | **byte-idêntico** a uma regeneração limpa do `spectacular` ✓ |
| Deleções na árvore | 24 | **24** ✓ |
| Resíduo de experimento | zero | `grep -rn "EXPERIMENTO"` vazio; toda linha `-` do diff é mudança intencional ✓ |
| E2E (4 specs, `CI=1`, `--retries=0`, 5173/8000) | 11 passed / 1 failed | **11 passed / 1 failed em 6,5 min** ✓ — e a falha é **exatamente** `recurring-templates.spec.ts:306`, a pré-existente que a story nomeou |

**Divergência de AC verificada e ACEITA (não é achado):** a AC7 exigia **0 deleções** nos dois arquivos gerados; `types.gen.ts` fecha **21/1**. A deleção é o placeholder `delete?: never` do path existente virando `delete: operations[...]` — o `openapi-typescript` emite um placeholder por verbo ausente, então acrescentar um verbo **necessariamente** reescreve essa linha. A invariante que a AC protege ("nenhum componente muda de forma") vale: conferido que o diff tem 2 hunks e nenhum outro tipo mudou. Declarada pelo dev em Debug Log #1 antes da review.

#### Achados (3) — todos corrigidos automaticamente

**A1 — MÉDIO · `update_fields=["deleted_at"]` não estava pinado por teste nenhum** (`backend/bujo/services/recurring.py:77`).
A AC3 e o comentário inline elevam a cláusula a garantia **mecânica** (*"é o que garante MECANICAMENTE que a exclusão nunca toca `active` nem nenhum campo de conteúdo"*), mas **nenhum** dos 7 experimentos de não-vacuidade a cobriu. **Confirmado por mutação:** trocando `save(update_fields=["deleted_at"])` por `save()`, a suíte `bujo/tests/` fecha **614 passed, 0 failed**. Os asserts existentes de "`active` não mudou" são de **valor**, e um `save()` completo reescreve todas as colunas com os mesmos valores que acabou de ler — nenhum assert de igualdade fica vermelho. O que se perde é a proteção contra **lost update**: um `PATCH` concorrente teria seus campos sobrescritos por uma exclusão, numa operação terminal e irreversível.
**Correção:** `test_soft_delete_template_escreve_SOMENTE_a_coluna_deleted_at_no_sql` (`test_services.py`), que captura o SQL com `CaptureQueriesContext`, exige **um** `UPDATE`, e assere que o `SET` cita `deleted_at` e **nenhuma** das outras 7 colunas do model. **Não-vacuidade provada:** sob a mutação o teste falha apontando `"active" = true` dentro do `SET`; restaurado por cópia com **md5 idêntico** ao backup.

**B1 — BAIXO · dois asserts tautológicos no spec E2E novo** (`frontend/e2e/recurring-soft-delete.spec.ts`).
`expect(vivo.id).not.toBe(excluido.id)` e `expect(semInstancia.id).not.toBe(comInstancia.id)`, rotulados *"ids distintos: o cenário não é degenerado"*, **não podem falhar**: dois `POST` distintos sempre devolvem UUIDs distintos. Além de vácuos, eram redundantes — a presença de cada template já é assertada antes. Teste vacuoso é a classe de achado mais caramente nomeada pela retrospectiva do Épico 13, e o spec inteiro é construído contra ela (presença antes de ausência, `reloadAndWaitTemplates`); estas duas linhas eram a exceção.
**Correção:** trocados por conferência do estado do **servidor** por trás da tela (`api.list()`): no teste 1, que a listagem devolve exatamente os dois vivos (o reativado incluído) e **não** contém o excluído; no teste 3, que devolve exatamente o template sem instância. Passa a distinguir "escondido por filtro client-side / por dedup" de "removido da origem" — que é a tese dos dois testes. **4 de 4 testes do spec re-executados e verdes (1,4 min).**

**B2 — BAIXO · docstring com afirmação absoluta contrariada pelo próprio repo** (`backend/bujo/services/recurring.py:5-9`).
O docstring do módulo dizia que *"todo ponto de leitura de template no projeto … passa por ela. A única exceção é `soft_delete_template`"*. Não é literalmente verdade: `bujo/management/commands/purge_e2e_users.py` lê (`count()`) e **remove fisicamente** templates via `all_objects`. É deliberado, sancionado pela AD-12 e reconhecido pela própria story (ambiguidade #8) — mas um leitor futuro que confie na frase absoluta conclui que exclusão física não existe em lugar nenhum. É a mesma classe de *"docstring que induz a erro"* que a story herdou da AC6 da 14.3.
**Correção:** o docstring passou a delimitar o escopo da regra ao caminho tenant-scoped (`objects`) e a nomear o escape hatch `all_objects` como fora dela, citando o comando. Redigido **sem** o literal proibido, para não quebrar o guard de `inspect.getsource`.

#### Verificado e correto (sem achado)

- **Os 6 pontos de leitura + o 7º herdado** existem todos e nenhum redeclara o predicado: `grep -rn "deleted_at__isnull" backend/` devolve **uma** linha (`recurring.py:41`). Varri o backend inteiro por leituras de template fora da lista — não há oitavo ponto (`RitualDecisionCreateView` é só `POST`; não existe endpoint de leitura de decisão).
- **Filtro na ORIGEM de cada queryset** (achado A1 da 14.2 aplicado): confirmado que as 3 saídas do bloco anual (`annual_eligible`, `annual_in_year`, contagens) derivam da `annual` já filtrada, e que `deleted_at` ser coluna **local** é o que impede o `Count("instances", distinct=True)` de inflar.
- **Idempotência** provada em SQL por `_sem_escrita` (helper real, conferido: filtra `INSERT`/`UPDATE`/`DELETE` dos statements capturados).
- **Contrato:** `RecurringTaskTemplateSerializer` tem `fields` **explícito** de 8 itens (não `__all__`), então `deleted_at` não podia vazar; a blindagem por conjunto de chaves nas 3 respostas o pina de qualquer forma.
- **Migration `0009`:** um `AddField`, zero `RunPython`/`AlterField`/`CreateModel`, aplicada às duas bases.
- **Cobertura da matriz da AC6:** a coluna "fontes dos rituais" da tabela (o `active=False` **vivo** que não aparece nas fontes) é coberta por teste **pré-existente** (`test_fonte_recorrentes_semanais_ordem_alfabetica_e_already_placed_fora_do_progresso`), então a matriz está fechada no conjunto da suíte.
- **Nenhum arquivo fora do File List** na superfície de review (`backend/`, `frontend/`, `schema.yaml`).

#### Gates pós-correção (re-executados DEPOIS da última alteração de código)

`uv run pytest` full-suite **1269 passed / 240.80s** · `ruff check` limpo · `lint-imports` **1/0** · `ruff format --check` **48**, mesma lista · `npx tsc --noEmit` limpo · `eslint` limpo · E2E `recurring-soft-delete.spec.ts` **4/4 passed em 1,4 min**. Nenhuma deleção nova na árvore (as mesmas 24).

### Change Log

| Data | Mudança |
|---|---|
| 2026-07-25 | **Code review (story-automator, auto-fix).** **0 críticos, 0 altos**; 1 médio + 2 baixos corrigidos. **A1 (médio):** `update_fields=["deleted_at"]` não era pinado por teste — confirmado por mutação (`save()` puro → 614 passed, suíte inteira verde), porque os asserts existentes são de valor e um save completo reescreve as colunas com os mesmos valores; risco real é *lost update* contra `PATCH` concorrente numa operação terminal. Corrigido com teste que captura o SQL e exige um `UPDATE` citando só `deleted_at`, com não-vacuidade provada sob a mutação e restauração conferida por md5. **B1 (baixo):** dois asserts tautológicos no spec E2E (`expect(a.id).not.toBe(b.id)`, impossíveis de falhar) trocados por conferência do estado do servidor via `api.list()`. **B2 (baixo):** docstring do módulo afirmava que `soft_delete_template` era a única exceção ao filtro, mas `purge_e2e_users` lê e remove templates fisicamente via `all_objects` — escopo da regra delimitado ao caminho `objects`, sem usar o literal que o guard de `inspect.getsource` proíbe. **Todos os gates da story foram RE-EXECUTADOS pela review, não lidos:** pytest 1268 (→ **1269** pós-correção), 26/0 por `git diff`, ruff/lint-imports/tsc/eslint/makemigrations limpos, `migrate --check` na branch Neon `e2e` exit 0, `schema.yaml` **byte-idêntico** a uma regeneração limpa, 24 deleções, resíduo de experimento zero, E2E **11 passed / 1 failed** com a falha sendo exatamente a pré-existente `recurring-templates.spec.ts:306`. Divergência da AC7 (`types.gen.ts` 21/1 em vez de 21/0) verificada e **aceita**: o `openapi-typescript` reescreve o placeholder `delete?: never` por força do formato. Status: `review` → `done`. |
| 2026-07-25 | Passo de QA (`bmad-qa-generate-e2e-tests`). **6 testes de API novos** (blindagem de `deletedAt` nas 3 respostas de template; três query params combinados; fio das fontes de ritual semanal e mensal — inclusive o 4º bucket, `alreadyPlaced` do mensal, que não tinha cobertura de exclusão em nenhuma camada; `POST /ritual-decisions/` sobre excluído em **409 neutro**; interação com decisão-snapshot preservada, sem CASCADE) e o **primeiro spec E2E da story**: `frontend/e2e/recurring-soft-delete.spec.ts` (4 testes — AC6 na biblioteca real com "Mostrar inativos", anual excluído fora de "Anuais pendentes", AC5 no banco real com "Mostrar já colocados", `DELETE` 204/204 + `PATCH` 404 provando a `0009` na branch Neon `e2e`). **Nenhum defeito de produção; nenhum arquivo de produção alterado.** 4 experimentos de não-vacuidade adicionais, resíduo zero por `md5`. Gates re-executados: pytest full-suite **1268 passed** (1242 + 26), ruff/lint-imports/tsc/eslint limpos, E2E **11 passed / 1 failed** (pré-existente). Achados para as 14.5/14.6/14.8 em `tests/test-summary-14-4.md`. |
| 2026-07-25 | Story 14.4 implementada (dev-story). Coluna `deleted_at` + migration `0009` aditiva; `live_templates()` como definição única de "vivo" nos 6 pontos de leitura (+1 herdado); `soft_delete_template` idempotente provado em SQL; `DELETE …/recurring-templates/<pk>/` → 204 na view existente. Contrato regenerado (16/0 e 21/1). Gap de spec da AD-08 fechado (`deleted_at` + item 6b; `category` reconciliada de tabela). Gates: pytest full-suite **1262 passed** (1242 + 20), ruff/lint-imports/tsc/makemigrations limpos, E2E 7 passed / 1 failed pré-existente. Status: `ready-for-dev` → `review`. |
