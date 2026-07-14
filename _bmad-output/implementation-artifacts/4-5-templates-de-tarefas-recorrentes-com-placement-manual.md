---
baseline_commit: 8535f8c2bfd5c7480db6f7402e2a651cfafd4741
---

# Story 4.5: Templates de tarefas recorrentes com placement manual

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero cadastrar tarefas recorrentes como templates e decidir manualmente onde cada uma entra a cada ciclo,
Para que o juízo de placement permaneça comigo, sem auto-placement (FR-1.11, FR-1.12, AR-15).

## Acceptance Criteria

1. **Template gravado em tabela separada, sem ciclo de vida de tarefa (AD-08)**
   - **Dado que** a tela Configurações > Recorrentes,
   - **Quando** Hugo cria um template,
   - **Então** é gravado em `recurring_task_templates` (separado de `tasks`, sem `status`/`log_id`/ciclo de vida) com título, descrição, eisenhower, `recurrence_group` (weekly/monthly/annual), `recurrence_text` (texto livre, **não parseado**) e `active` (booleano simples),
   - **E** o template é sempre plano (sem subtarefas).

2. **Placement manual na abertura de ciclo — cria Task snapshot com linhagem**
   - **Dado que** a abertura de um ciclo,
   - **Quando** o app apresenta os recorrentes ativos do período,
   - **Então** lista os templates com botão "Definir placement" — sem auto-placement,
   - **E** colocar um recorrente cria uma `Task` snapshot (copiando os campos do template no instante) com `source_template_id` apontando para a origem, `status=pending`, `parent_task_id=NULL` e `migration_count=0`.

3. **Instância e template são independentes após o placement**
   - **Dado que** uma instância colocada e seu template,
   - **Quando** qualquer um é editado depois,
   - **Então** editar a instância toca só aquela `Task`,
   - **E** editar o template afeta só placements **futuros** (instâncias passadas intactas).

## Tasks / Subtasks

> **Ordem de execução:** backend (model → migration → service → serializer/view → contrato) antes do frontend (data layer → Configurações/Recorrentes → seções de placement no Weekly/Monthly), igual às Stories 4.1–4.4. A Task 3 (migration do `source_template_id`) é o pivô mais delicado desta story — leia a Dev Note "Migração de `source_template_id`: UUIDField solto vira FK de verdade" antes de tocar em `models.py`.
>
> **Decisão de escopo desta story (ver Dev Notes "O que é 'abertura de ciclo' nesta story")**: "abertura de ciclo" (AC #2) é implementada como uma seção nas páginas **já existentes** `WeeklyPage`/`MonthlyPage` (Épico 4), não como um novo modal/banner no estilo `MigrationFlow`. Recorrentes `annual` são apresentados **junto com os `monthly`**, só quando o mês exibido é janeiro (ver Dev Notes) — não existe "abertura do ano" no PRD/UX, e ambos os grupos colocam no **mesmo container** (`monthly_log`).

- [x] **Task 1: `RecurringTaskTemplate` — novo model, sempre plano** (AC: #1)
  - [x] 1.1 Em `backend/bujo/models.py`, adicionar (após `Task`, antes ou depois — mantendo a ordem lógica log → task → template):
    ```python
    class RecurringTaskTemplate(TenantModel):
        class RecurrenceGroup(models.TextChoices):
            WEEKLY = "weekly"
            MONTHLY = "monthly"
            ANNUAL = "annual"

        title = models.CharField(max_length=500)
        description = models.TextField(null=True, blank=True)  # noqa: DJ001 - mesma semântica nulável de Task.description
        eisenhower = models.CharField(  # noqa: DJ001 - default copiado no placement; ausência é valor válido
            max_length=8, choices=Task.Eisenhower.choices, null=True, blank=True
        )
        recurrence_group = models.CharField(max_length=8, choices=RecurrenceGroup.choices)
        recurrence_text = models.TextField()  # livre, NÃO parseado (addendum AD-08 item 4) — só exibição
        active = models.BooleanField(default=True)  # booleano simples, SEM versionamento (AD-08 item 6 — YAGNI consciente)

        class Meta:
            db_table = "recurring_task_templates"
    ```
    Sem `status`, sem `log_id`/`weekly_log_id`/`monthly_log_id`, sem `parent_task_id` — um template não é uma `Task` e nunca migra (AD-08 item 1). Sem campo `category`: a AC #1 e a AD-08 só listam título/descrição/eisenhower/recurrence_group/recurrence_text/active — não reproduzir todos os campos de `Task`.
  - [x] 1.2 `cd backend && uv run python manage.py makemigrations bujo` — deve gerar **duas operações** (possivelmente em um único arquivo ou dois): `CreateModel(RecurringTaskTemplate)` e a alteração do campo de linhagem em `Task` (Task 2 abaixo). Revisar o arquivo gerado antes de aplicar.

- [x] **Task 2: Migrar `Task.source_template_id` de `UUIDField` solto para `ForeignKey` de verdade** (AC: #2, #3)
  - [x] 2.1 Em `backend/bujo/models.py`, na classe `Task`, trocar:
    ```python
    source_template_id = models.UUIDField(null=True, blank=True)
    ```
    por:
    ```python
    source_template = models.ForeignKey(
        RecurringTaskTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="instances",
    )
    ```
    **Nomear o campo Python `source_template` (sem `_id`)** — Django adiciona o sufixo `_id` automaticamente à coluna de uma `ForeignKey`, então a coluna resultante no banco continua se chamando `source_template_id`, **igual ao nome já usado desde a 3.1** (mesma convenção de `parent_task`/`migrated_to_task`, cujas colunas são `parent_task_id`/`migrated_to_task_id`). Não é necessário `db_column` explícito.
    `RecurringTaskTemplate` precisa estar definida **acima** de `Task` no arquivo (ou usar o nome como string `"RecurringTaskTemplate"` na FK) — Python resolve nomes em ordem de definição no módulo.
  - [x] 2.2 Ao rodar `makemigrations` (Task 1.2), o autodetector do Django provavelmente perguntará interativamente "did you rename `bujo.Task.source_template_id` to `bujo.Task.source_template`" — **responder `N`** (é uma troca de tipo — `UUIDField` solto → `ForeignKey` —, não um rename puro). A migration resultante deve ter `RemoveField("task", "source_template_id")` + `AddField("task", "source_template", ForeignKey(...))`. **Seguro sem perda de dados**: `grep -rn "source_template_id" backend/bujo/` (fora de `models.py`/migrations) confirma que nenhum código de produção jamais leu/gravou esse campo desde a 3.1 — a coluna está 100% `NULL` em qualquer ambiente, incluindo o deploy AR-21 já em produção.
  - [x] 2.3 `uv run python manage.py migrate` local para validar a migration antes de prosseguir.

- [x] **Task 3: Factory + registro no contrato de isolamento (§6.7, §7.4 — guardrail obrigatório para todo `TenantModel` novo)** (AC: #1)
  - [x] 3.1 Em `backend/bujo/tests/factories.py`, adicionar `RecurringTaskTemplateFactory` (mesmo molde de `TaskFactory` — `class Params: user = factory.SubFactory(UserFactory)`, `user_id = factory.SelfAttribute("user.id")`), com `title` sequencial, `recurrence_group` default `"weekly"`, `recurrence_text` fixa (ex. `"toda segunda"`), `active=True`.
  - [x] 3.2 `register_isolation_case(id="bujo.RecurringTaskTemplate", model=RecurringTaskTemplate, make=lambda: {"title": "Template de isolamento", "recurrence_group": "weekly", "recurrence_text": "toda segunda"})` — **sem este registro, o teste compartilhado de `core/tests/test_isolation.py` não cobre o model novo e AD-12 vira esperança, não contrato** (achado explícito da retro Epic 3, §6.7 do architecture.md).

- [x] **Task 4: Domain exception para container incompatível com o `recurrence_group`** (AC: #2)
  - [x] 4.1 Em `backend/core/exceptions.py`, adicionar `class WrongPlacementContainer(DomainError): """Placement de um template weekly sem week_start, ou monthly/annual sem month_first."""` — mapeia automaticamente para 409 pelo handler genérico (nenhuma outra alteração necessária em `custom_exception_handler`, que já trata qualquer `DomainError` não-`TenantScopeViolation`).

- [x] **Task 5: Camada de serviço — `services/recurring.py` (novo arquivo, molde `services/tasks.py`/`services/migration.py`)** (AC: #1, #2, #3)
  - [x] 5.1 `create_template(*, user, **fields) -> RecurringTaskTemplate`: `RecurringTaskTemplate.objects.create(**fields)` (auto-escopado por tenant via manager, mesmo padrão de `Task.objects.create`).
  - [x] 5.2 `update_template(*, user, template_id, **fields) -> RecurringTaskTemplate`: mesmo molde de `update_task` (`services/tasks.py`) — `.get(id=template_id)`, `setattr` por campo, `.save(update_fields=[...])`. **Não precisa de lógica especial "só afeta placements futuros"** (AC #3): isso já é garantido pela Task 5.3 copiar os campos do template **no instante do placement** — instâncias já colocadas são `Task`s congeladas sem nenhum ponteiro vivo de volta ao template além de `source_template` (usado só para linhagem/exibição, nunca para reler campos).
  - [x] 5.3 `place_template(*, user, template_id, week_start=None, month_first=None, scheduled_date=None) -> Task`:
    ```python
    @transaction.atomic
    def place_template(*, user, template_id, week_start=None, month_first=None, scheduled_date=None) -> Task:
        template = RecurringTaskTemplate.objects.get(id=template_id)  # auto-escopado; DoesNotExist -> 404 na view
        common = dict(
            title=template.title,
            description=template.description,
            eisenhower=template.eisenhower,
            source_template=template,
        )
        if template.recurrence_group == RecurringTaskTemplate.RecurrenceGroup.WEEKLY:
            if week_start is None:
                raise WrongPlacementContainer("Template weekly requer week_start.")
            container = get_or_create_weekly_log(user=user, week_start=week_start)
            return create_task(user=user, weekly_log=container, scheduled_date=scheduled_date, **common)
        # monthly E annual colocam no mesmo container (Monthly Log) — AD-08 item 5:
        # recurrence_group só controla EM QUAL abertura de ciclo o template é
        # apresentado, não onde a instância é colocada. Não existe "log anual".
        if month_first is None:
            raise WrongPlacementContainer("Template monthly/annual requer month_first.")
        container = get_or_create_monthly_log(user=user, month_first=month_first)
        return create_task(user=user, monthly_log=container, scheduled_date=scheduled_date, **common)
    ```
  - [x] 5.4 Em `backend/bujo/services/tasks.py`, estender `create_task` com o parâmetro `source_template=None` (mesma posição de `parent_task=None`, kwarg-only) e passar para `Task.objects.create(..., source_template=source_template)`. **Não alterar nenhum caller existente** — todos os callers atuais (`TaskCreateView`, `SubtaskCreateView`, `MonthlyLogView.post`, `_migrate_subtree`) omitem o parâmetro, que fica `None` por default (idêntico ao comportamento de hoje).

- [x] **Task 6: Serializers (`backend/bujo/serializers.py`, estender)** (AC: #1, #2)
  - [x] 6.1 `RecurringTaskTemplateSerializer(serializers.ModelSerializer)` — `fields = ["id", "title", "description", "eisenhower", "recurrence_group", "recurrence_text", "active"]` (leitura/listagem; camelCase na borda via middleware já configurado, nenhuma configuração extra).
  - [x] 6.2 `RecurringTaskTemplateCreateSerializer(serializers.Serializer)` — `title` (obrigatório), `description`/`eisenhower` (opcionais, `allow_null=True`), `recurrence_group` (`ChoiceField` obrigatório), `recurrence_text` (obrigatório), `active` (opcional, default `True`).
  - [x] 6.3 `RecurringTaskTemplateUpdateSerializer(serializers.Serializer)` — mesmos campos, todos `required=False` (uso com `partial=True` na view, mesmo padrão de `TaskUpdateSerializer`).
  - [x] 6.4 `RecurringTaskTemplatePlaceSerializer(serializers.Serializer)` — `week_start`/`month_first` (`DateField`, `required=False` cada — a view decide qual é obrigatório com base no `recurrence_group` do template, não o serializer), `scheduled_date` (`DateField`, `required=False`, `allow_null=True`).

- [x] **Task 7: Views + URLs finas (`backend/bujo/views.py`/`urls.py`, estender)** (AC: #1, #2, #3)
  - [x] 7.1 `RecurringTaskTemplateListView`:
    - `GET`: filtros opcionais via query params **snake_case** (mesmo padrão real de `week_start`/`month_first` em `WeeklyLogView`/`MonthlyLogView` — não a forma camelCase aspiracional do §6.3, que essas duas views já não seguem): `?active=true` e `?recurrence_group=weekly`. Sem filtro = todos os templates do tenant (uso: tela Configurações > Recorrentes lista tudo, ativo e inativo; as seções de placement do Weekly/Monthly Log passam `active=true&recurrence_group=<grupo>`).
    - `POST`: valida com `RecurringTaskTemplateCreateSerializer` → `create_template` → `201` com `RecurringTaskTemplateSerializer`.
  - [x] 7.2 `RecurringTaskTemplateDetailView`:
    - `PATCH`: valida com `RecurringTaskTemplateUpdateSerializer(partial=True)` → `update_template` (capturar `RecurringTaskTemplate.DoesNotExist` → `NotFound`, mesmo padrão de `TaskDetailView`) → `200`.
  - [x] 7.3 `RecurringTaskTemplatePlaceView`:
    - `POST`: valida com `RecurringTaskTemplatePlaceSerializer` → `place_template` (capturar `RecurringTaskTemplate.DoesNotExist` → `NotFound`; `WrongPlacementContainer` propaga para o handler genérico → `409`) → `201` com `TaskSerializer`.
  - [x] 7.4 `backend/bujo/urls.py`: adicionar (preservando as 15 rotas existentes)
    ```python
    path("recurring-templates/", RecurringTaskTemplateListView.as_view(), name="bujo-recurring-template-list"),
    path("recurring-templates/<uuid:pk>/", RecurringTaskTemplateDetailView.as_view(), name="bujo-recurring-template-detail"),
    path("recurring-templates/<uuid:pk>/place/", RecurringTaskTemplatePlaceView.as_view(), name="bujo-recurring-template-place"),
    ```

- [x] **Task 8: Testes de backend** (AC: #1, #2, #3)
  - [x] 8.1 `test_models.py`: `RecurringTaskTemplate` sem campos de ciclo de vida (introspecção simples: nenhum atributo `status`/`log`/`weekly_log`/`monthly_log`/`parent_task`); `Task.source_template` aceita `None` e uma instância de `RecurringTaskTemplate`; `on_delete=SET_NULL` — deletar o template não deleta a `Task` instância (regressão direta contra a filosofia "não é referência viva", AD-08 item 2).
  - [x] 8.2 `test_services.py` (seção nova `# --- recurring.py ---`):
    - `create_template`/`update_template` básicos (idempotência de campo, escopo por tenant — outro usuário não vê/edita o template).
    - `place_template` com `recurrence_group=weekly`: cria `Task` com `weekly_log` setado, `status=PENDING`, `parent_task=None`, `migration_count=0`, `source_template=template`, campos copiados (`title`/`description`/`eisenhower`) do template **no instante da chamada**.
    - `place_template` com `recurrence_group=monthly` e com `annual`: ambos criam a `Task` no `monthly_log` do `month_first` passado (prova direta de "controla apresentação, não placement" — mesma mecânica de container para os dois grupos).
    - `place_template` weekly sem `week_start` (ou monthly/annual sem `month_first`) levanta `WrongPlacementContainer`.
    - **AC #3 (independência)**: colocar um template, editar o template depois (`update_template`) → a `Task` já criada **não muda** nenhum campo (recarregar do banco e comparar); colocar o mesmo template de novo **depois** da edição → a nova `Task` reflete os campos atualizados. Editar a `Task` instância (`update_task`) não toca o template (`refresh_from_db` no template, campos intactos).
    - Escopo por tenant em `place_template` (`RecurringTaskTemplate.DoesNotExist` para template de `other_user`).
  - [x] 8.3 `test_views.py` (seção nova `# --- RecurringTaskTemplateView* ---`): CRUD via `auth_client` (create → 201, list com filtros `active`/`recurrence_group`, patch → 200, patch de template de outro tenant → 404); `place` via `auth_client` para weekly e monthly/annual → 201 com o `Task` serializado, incluindo `sourceTemplate`-equivalente (conferir nome exato do campo id gerado pelo serializer, camelCase); `place` sem o parâmetro de container certo → 409 com `detail`.
  - [x] 8.4 `test_serializers.py`: `RecurringTaskTemplateCreateSerializer`/`UpdateSerializer` validam `recurrence_group` contra o enum (valor fora do enum → erro de validação); `description`/`eisenhower` aceitam `null`.

- [x] **Task 9: Regenerar o contrato de API** (AC: #1, #2, #3)
  - [x] 9.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml`
  - [x] 9.2 `cd frontend && npm run generate-types`
  - [x] 9.3 Confirmar que o step de CI "Verificar types.gen.ts está atualizado" passa sem diff residual.
  - [x] 9.4 Conferir no diff do `schema.yaml` que só entraram os schemas/paths novos (`RecurringTaskTemplate`, `RecurringTaskTemplateCreate`, `RecurringTaskTemplateUpdate`, `RecurringTaskTemplatePlace`, os 3 paths `/api/bujo/recurring-templates/...`) e que o schema `Task` ganhou o campo `sourceTemplate` (era um `UUIDField` opaco antes — conferir como o `drf-spectacular` representa a FK nullable, provavelmente `sourceTemplate: string(uuid) | null` sendo a PK do relacionado, já que o serializer `TaskSerializer` não declara `source_template` explicitamente nos seus `fields` — **decisão**: não adicionar `source_template`/`source_template_id` a `TaskSerializer.Meta.fields`, pois nenhuma AC desta story pede exibir a linhagem de recorrência na UI de tarefa; o campo seria alcançável só via admin/ORM por ora, YAGNI); blocos `security` dos endpoints existentes seguem intactos (guardrail retro Epic 3 §3).

- [x] **Task 10: Camada de dados do frontend** (AC: #1, #2, #3)
  - [x] 10.1 `frontend/src/api/keys.ts` (estender seção `bujo`): `recurringTemplates: (params?: { active?: boolean; recurrenceGroup?: string }) => ['bujo', 'recurringTemplates', 'list', params ?? {}] as const,`.
  - [x] 10.2 `frontend/src/features/bujo/types.ts` (estender): `export type RecurringTaskTemplate = components['schemas']['RecurringTaskTemplate']` e `export type RecurrenceGroup = components['schemas']['RecurrenceGroupEnum']` (conferir nome exato gerado na Task 9).
  - [x] 10.3 `frontend/src/features/bujo/api.ts` (estender):
    - `useRecurringTemplatesQuery(params?: { active?: boolean; recurrenceGroup?: RecurrenceGroup })` — `GET /api/bujo/recurring-templates/` com `active`/`recurrence_group` como query params **snake_case** (espelhando o backend real da Task 7.1, não a convenção camelCase aspiracional).
    - `useCreateRecurringTemplateMutation()` — `POST /api/bujo/recurring-templates/`; `onSuccess` invalida `keys.bujo.recurringTemplates()` (prefixo, cobre qualquer variante de `params`, mesma técnica de `useMigrateTaskMutation`).
    - `useUpdateRecurringTemplateMutation()` — `PATCH /api/bujo/recurring-templates/:id/`; mesma invalidação por prefixo.
    - `usePlaceRecurringTemplateMutation()` — `POST /api/bujo/recurring-templates/:id/place/`; `onSuccess` invalida `keys.bujo.recurringTemplates()` (a lista de ativos da seção de placement não muda, mas simplifica) **e** a query do log afetado: `queryClient.invalidateQueries({ queryKey: ['bujo', 'weeklyLog'] })` e `['bujo', 'monthlyLog']` (mesma técnica de `useMigrateTaskMutation` — invalidar ambos os prefixos é seguro mesmo quando só um se aplica).
  - [x] 10.4 Exportar tudo no barrel `frontend/src/features/bujo/index.ts`: os 4 hooks novos + `RecurringTaskTemplate`/`RecurrenceGroup` (tipos).
  - [x] 10.5 `frontend/src/features/bujo/api.test.tsx` (estender): os 4 hooks batem no endpoint/params certos; mutations invalidam as query keys esperadas.

- [x] **Task 11: Configurações > Recorrentes — CRUD de templates** (AC: #1, #3)
  - [x] 11.1 Novo componente `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`: usa `useRecurringTemplatesQuery()` (sem filtro — lista tudo, ativo e inativo, com indicação visual de inativo) + form de criação (título, descrição, eisenhower — mesmo `Select` de opções usado em outros forms de tarefa, se houver componente compartilhado; senão `TextField select` simples, recurrence_group, recurrence_text, active) usando `useCreateRecurringTemplateMutation()`; cada linha da lista permite editar (`useUpdateRecurringTemplateMutation()`) e alternar `active` (toggle simples via `PATCH { active: !current }`, sem modal de confirmação — mesma leveza de outras toggles do app).
  - [x] 11.2 Novo arquivo `frontend/src/pages/settings/SettingsPage.tsx`: `<Box component="main" aria-label="Configurações">` compondo `<RecurringTemplateManager />` (por ora a única seção — "Recorrentes"; título de seção "Recorrentes" com `Typography variant="heading"`, mesmo padrão visual de `WeeklyPage`/`MonthlyPage`).
  - [x] 11.3 Em `frontend/src/app/router.tsx`, trocar a rota `settings` de `<PlaceholderPage title="Configurações" />` para `<SettingsPage />` (import novo, remover o uso de `PlaceholderPage` só para essa rota — as demais rotas `PlaceholderPage` de outros épicos continuam intocadas).
  - [x] 11.4 Exportar `RecurringTemplateManager` no barrel de `features/bujo` (único export que `pages/settings` precisa).
  - [x] 11.5 `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx` (novo): criar template via form chama a mutation com os campos certos; lista renderiza título + `recurrence_group` + indicador ativo/inativo; editar altera; toggle `active` chama `PATCH` com o campo invertido; `jest-axe` no componente real.
  - [x] 11.6 `frontend/src/pages/settings/SettingsPage.test.tsx` (novo, mesmo molde de `DailyPage.test.tsx` para smoke test de composição): renderiza o título "Configurações" e a seção de recorrentes.
  - [x] 11.7 **Mocks de barrel** (achado recorrente 4.3/4.4): `RouteAnnouncer.test.tsx`/`router.test.tsx` mockam `features/bujo` — adicionar `RecurringTemplateManager: () => null` ao mock existente para não quebrar esses testes com o export novo.

- [x] **Task 12: Placement na abertura de ciclo — seções no `WeeklyPage`/`MonthlyPage`** (AC: #2)
  - [x] 12.1 Novo componente `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`: props `recurrenceGroups: RecurrenceGroup[]` (uma ou mais — `MonthlyPage` passa `['monthly']` ou `['monthly', 'annual']` conforme o mês; `WeeklyPage` passa sempre `['weekly']`) + `onPlace: (templateId: string) => void` (o componente não decide o container — só lista e delega). Usa `useRecurringTemplatesQuery({ active: true, recurrenceGroup: ... })` **uma vez por grupo** (ou um único fetch com filtro por lista, se o backend suportar `?recurrence_group=` múltiplo — **manter simples**: um `useRecurringTemplatesQuery({ active: true })` só e filtrar client-side por `recurrenceGroups.includes(t.recurrenceGroup)`, evitando N requisições). Se a lista filtrada for vazia, não renderiza nada (mesmo padrão de `MigrationBanner`/`CatchUpBanner`: banner vazio = sem DOM). Cada template ativo aparece como uma linha com título + `recurrenceGroup` + botão "Definir placement".
  - [x] 12.2 Em `WeeklyPage.tsx`: renderizar `<RecurringPlacementSection recurrenceGroups={['weekly']} onPlace={...} />` abaixo da seção "Sem dia definido" (mesma posição relativa que `CatchUpBanner` ocupa em `DailyPage` — no fim, depois do conteúdo principal). `onPlace` abre um `Dialog` simples (novo, `RecurringPlacementDialog.tsx` ou inline no próprio `RecurringPlacementSection`) com um `TextField type="date"` opcional (bounds implícitos: qualquer data — o backend não valida que a data cai dentro da semana; **decisão de escopo**: não replicar aqui a validação de mês que `TaskDetailView` faz para `monthly_log`, pois a AC não exige isso e o Weekly Log já aceita `scheduled_date` fora da semana sem erro hoje — ver `WeeklyLogView`, que só filtra por dia na exibição) e chama `usePlaceRecurringTemplateMutation().mutate({ templateId, weekStart: weeklyLog.data.weekStart, scheduledDate })`.
  - [x] 12.3 Em `MonthlyPage.tsx`: calcular `recurrenceGroups` como `isCurrentMonth ? (Number(monthFirst.slice(5, 7)) === 1 ? ['monthly', 'annual'] : ['monthly']) : []` (reaproveita o `isCurrentMonth`/`monthFirst` já existentes na página — ver Dev Notes "O que é 'abertura de ciclo' nesta story": a seção só aparece no mês corrente, igual à seção "Itens do Future Log" já condicionada a `isCurrentMonth`). Renderizar `<RecurringPlacementSection recurrenceGroups={recurrenceGroups} onPlace={...} />` abaixo do form "Adicionar tarefa ao mês". `onPlace` abre o dialog com um campo "Dia (opcional)" numérico (mesmo padrão de `MonthlyPage.handleSubmit`, `day.padStart(2, '0')` combinado com `monthFirst.slice(0, 7)`) e chama a mutation com `monthFirst`.
  - [x] 12.4 `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx` (novo): não renderiza sem templates ativos do(s) grupo(s) pedido(s); renderiza só os templates do grupo certo quando a query retorna grupos mistos; clicar "Definir placement" + confirmar chama a mutation com os parâmetros certos; `jest-axe` no componente real.
  - [x] 12.5 `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` (estender): a seção de recorrentes aparece/some conforme a query de templates ativos; `MonthlyPage` só mostra a seção quando `isCurrentMonth`; grupo `annual` só aparece quando o mês corrente é janeiro (mockar `monthFirst` retornado pela query, não a data do sistema — mesma técnica de mock de dados usada nos testes existentes dessas páginas).

- [x] **Task 13: Verificação final** (AC: #1, #2, #3)
  - [x] 13.1 `cd backend && uv run pytest && uv run ruff check . && uv run lint-imports && uv run python manage.py check` — colar a contagem **real** observada (guardrail retro Epic 3 §1).
  - [x] 13.2 `cd frontend && npm run typecheck && npm run lint && npm run build && npm run test` — idem, colar a contagem real.
  - [x] 13.3 **Verificação manual contra backend+frontend reais** (`npm run dev` + backend, logado): criar 2 templates em Configurações > Recorrentes (um `weekly`, um `monthly`) → confirmar que aparecem na lista com o `recurrence_group` certo. Ir para "Esta Semana" → confirmar que só o template `weekly` ativo aparece na seção de placement; clicar "Definir placement", confirmar sem data → a tarefa aparece em "Sem dia definido" da semana corrente com `migration_count=0` (conferir via admin/ORM) e `source_template` apontando para o template. Editar o template (mudar título) → confirmar que a `Task` já colocada **não muda** de título; colocar o **mesmo** template de novo → a nova instância usa o título atualizado. Ir para "Este Mês" → confirmar que o template `monthly` aparece (e que, se o mês corrente não for janeiro, nenhum grupo `annual` apareceria mesmo que existisse um). Desativar um template (`active=false`) → confirmar que ele some da seção de placement mas continua visível/editável em Configurações. Zero erros de console.
  - [x] 13.4 **File List por último** (retro Epic 3 §8-2, guardrail ativo): `git status --short` + `git diff --stat` **depois** da verificação manual, reconciliar contra o File List documentado.

## Dev Notes

### Migração de `source_template_id`: UUIDField solto vira FK de verdade

A Story 3.1 congelou `source_template_id` como um `UUIDField` **solto** (não `ForeignKey`) deliberadamente, porque `recurring_task_templates` só seria criada no Épico 4 — ver `_bmad-output/implementation-artifacts/3-1-*.md` Dev Notes ("`source_template_id` é diferente: a própria AC já escreve o nome **com** `_id` porque **não é uma FK**... Por isso o campo é um `UUIDField` solto"). Agora que a tabela existe, esta story faz a promoção para `ForeignKey` de verdade (integridade referencial, `on_delete=SET_NULL` coerente com "não é referência viva" da AD-08 item 2 — o `SET_NULL` garante que deletar um template nunca quebra a instância já colocada, sem exigir `CASCADE` destrutivo). A coluna do banco continua se chamando `source_template_id` (Task 2.1) — só o nome do campo Python muda, não o schema físico além do tipo/constraint. Migração seguramente sem perda de dados: a coluna está `NULL` em 100% das linhas existentes (nenhum código de produção jamais a usou, confirmado por Task 2.2).

### O que é "abertura de ciclo" nesta story

A epics.md AC #2 fala genericamente em "abertura de um ciclo" — mas, diferente de 4.2/4.3/4.4 (que geram um banner + `MigrationFlow` modal para **reconciliar tarefas já existentes sem disposição**), recorrentes são sobre **criar tarefas novas a partir de um catálogo**. É um problema diferente (biblioteca de templates com um botão, não uma fila de decisões sequenciais) — por isso esta story **não** estende `MigrationFlow`/`MigrationCard` nem os banners de 4.2–4.4. A implementação escolhida é uma seção simples nas páginas `WeeklyPage`/`MonthlyPage` (já existentes desde 4.1) que lista os templates ativos do grupo certo com um botão de placement — sem fila, sem "N de M revisados", sem Esc-pausa (não há sequência a pausar: cada placement é uma ação independente e idempotente do ponto de vista do fluxo).

Duas lacunas que o PRD/UX deixam sem definição explícita, resolvidas aqui por escopo mínimo (documentado para não virar suposição silenciosa):
- **`annual` não tem "abertura do ano" definida em nenhum FR/UX.** Decisão: templates `annual` são apresentados **junto com os `monthly`**, apenas quando o `MonthlyPage` exibe janeiro (`month === 1`) — a primeira abertura de mês do ano é o análogo mais direto de "abertura do ano" sem inventar uma superfície nova. Ambos os grupos colocam no **mesmo container** (`monthly_log`), pois não existe (nem a AD-08 define) um "log anual" — AD-08 item 5 já deixa isso implícito ("controla apresentação, não placement").
- **A seção de placement só aparece no período corrente**, não em navegação para semanas/meses passados — reaproveita o `isCurrentMonth` já calculado em `MonthlyPage` (Task 8.1 da Story 4.3); análogo implícito para `WeeklyPage`, que hoje só exibe a semana corrente (sem parâmetro de navegação usado na UI).

### AC #3 (independência instância/template) não exige lógica nova de "congelamento"

"Editar o template afeta só placements futuros" é satisfeito **por construção**: `place_template` (Task 5.3) copia `title`/`description`/`eisenhower` do template para a `Task` no momento da chamada, e a `Task` resultante nunca relê o template depois (mesma filosofia de snapshot das AD-06/AD-07/AD-03, já provada em 4.1–4.4). `source_template` existe só para linhagem/auditoria (ex.: um futuro "quais tarefas vieram deste template"), nunca para reidratar campos. Não há necessidade de um `RecurringTaskTemplateVersion` nem de effective-dating (AD-08 item 6 já rejeita isso conscientemente como YAGNI).

### Reaproveitamento obrigatório — não reinventar

`get_or_create_weekly_log`/`get_or_create_monthly_log` (`services/logs.py`, desde 4.1) reaproveitados sem alteração para resolver o container do placement. `create_task` (`services/tasks.py`, desde 3.1) ganha só um parâmetro novo (`source_template`, aditivo, default `None`) — nenhuma outra assinatura de serviço muda. Nenhuma lógica de `order_index`/validação de transição nova: `create_task` já calcula `order_index` por irmãos (mesmo container + `parent_task`), e o placement sempre cria uma raiz (`parent_task=None`, AD-08 item 8: "template é sempre plano"). `WeeklyLogView`/`MonthlyLogView` (GET, leitura) **não mudam** — a seção de placement lê via `useRecurringTemplatesQuery` (endpoint novo, independente) e invalida a query do log afetado após o placement, mesma técnica de invalidação cruzada já usada por `useMigrateTaskMutation`.

### Previous Story Intelligence (4.4 — done)

- Stack: Django 5.2 + DRF + `uv`; Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59. Sem dependência nova.
- Todo `TenantModel` novo **precisa** de `register_isolation_case` em `factories.py` (Task 3.2) — sem isso, `core/tests/test_isolation.py` não cobre o model e o guardrail fail-closed (§6.7) fica sem prova automatizada para essa tabela.
- Mocks do barrel `features/bujo` usados em `RouteAnnouncer.test.tsx`/`router.test.tsx` quebram silenciosamente quando um novo componente exportado do barrel não está no mock (achado recorrente 4.3/4.4) — Task 11.7 antecipa isso.
- `jest-axe` só pega violações reais contra o componente **de verdade**, nunca mockado (lição repetida em 3.3/4.1–4.4).
- Query keys: forma fixa `[escopo, entidade, 'list'|'detail', params?]`, invalidação **por prefixo** (`queryClient.invalidateQueries({ queryKey: keys.bujo.recurringTemplates() })` cobre qualquer variante de filtro sem reconstruir params).
- **File List por último** (retro Epic 3 §8-2): rodar `git status --short`/`git diff --stat` **depois** da verificação manual e reconciliar — guardrail ativo em `_bmad/custom/bmad-dev-story.toml`.
- **Contagem de testes sempre real, nunca de memória** (retro Epic 3 §1) — rodar o comando de verdade antes de escrever Completion Notes/Debug Log.
- Deploy AR-21 concluído (2026-07-12); AR-22 (observabilidade) segue pendente, sem dono/data — não bloqueia esta story.

### Git Intelligence

- Branch `main`; HEAD em `8535f8c` (Story 4.4 mergeada — Catch-Up de dias pulados). Convenção de commit: `feat(story-4.5): <descrição em pt-BR>`.
- Única story do Épico 4 (até aqui) com **mudança de schema**: `recurring_task_templates` (tabela nova) + alteração de tipo em `tasks.source_template_id` (Task 2). Todas as demais tabelas/campos usados (`Log`/`WeeklyLog`/`MonthlyLog`, `Task.title/description/eisenhower/status/parent_task/migration_count`) já existem desde 3.1/4.1.
- Nenhum app novo: tudo vive em `bujo` (backend) e `features/bujo` (frontend) — §7.2 já resolve a fronteira ("orquestração cross-domínio... vive em `bujo/services/`"); recorrentes são tasks-domain, sem intersecção com `habits`/`health`/`medications`.

### Project Structure Notes

- Backend: `models.py` ganha `RecurringTaskTemplate` + altera `Task.source_template`; `migrations/` ganha 1–2 arquivos novos; `services/recurring.py` é o único arquivo de serviço novo; `serializers.py`/`views.py`/`urls.py` estendidos (não recriados); `core/exceptions.py` ganha `WrongPlacementContainer`; `tests/factories.py` ganha `RecurringTaskTemplateFactory` + `register_isolation_case`.
- Frontend: `features/bujo/components/` ganha `RecurringTemplateManager.tsx`, `RecurringPlacementSection.tsx` (+ testes) — novos arquivos. `WeeklyPage.tsx`/`MonthlyPage.tsx` estendidos com a seção de placement, sem reescrever a lógica existente. Novo diretório `pages/settings/` com `SettingsPage.tsx` (+ teste) — primeira página real da rota `/settings`, substituindo `PlaceholderPage` só ali. `api.ts`/`keys.ts`/`types.ts`/`index.ts` estendidos.
- Fronteiras (§7.2): `features/bujo` não importa outra feature; `pages/settings` compõe a feature (mesmo padrão de `pages/daily`/`pages/planner`). Sem violação de `import-linter` esperada (mesma app `bujo` no backend, nenhum novo app Django).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5 (linhas 708-728); §Epic 4 (linhas 622-624 — "histórias estritamente ordenadas")]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-1.11 (linha 207 — campos do template), FR-1.12 (linha 209 — placement manual, sem auto-placement), FR-1.9 (linha 199 — abertura do mês, escopo do que já existe em 4.3)]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-08 (linhas 471-532 — resolve T8: template em tabela separada, placement gera snapshot com `source_template_id`, instância/template independentes, `recurrence_text` não parseado, `active` booleano simples, template sempre plano), §6.2 (linhas 857-874 — camada de serviço/estrutura por app), §6.3 (linhas 876-885 — casing camelCase na borda), §6.4 (linhas 887-900 — taxonomia de exceções, `DomainError` → 409), §6.7 (linhas 921-929 — isolamento multi-tenant fail-closed, `register_isolation_case`), §7.2 (linhas 1125-1135 — fronteiras: `bujo` é dono do domínio tasks/recorrentes, `features/<x>` não importa outra feature)]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#UJ-2/UJ-3 (linhas 71-90 — "abertura da semana"/"abertura do mês" como parte do ritual diário, sem menção a "abertura do ano")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md (linha 66 — "Configurações > Recorrentes" via tabela de navegação; linha 595 — Fluxo 3 "Recorrentes mensais: lista de templates com botão 'Definir placement'... Sem auto-placement"; linha 686 — FR-1.11 mapeado para "Configurações > Recorrentes")]
- [Source: backend/bujo/models.py (`Task` — campos `parent_task`/`source_template_id`/`migration_count` já congelados desde 3.1, comentário de módulo linhas 1-6 confirma "Épico 4 consome sem precisar alterar o schema" — **exceção**: `source_template_id` muda de tipo nesta story, ver Dev Notes); backend/bujo/services/{logs,tasks,migration}.py (padrões de serviço a reaproveitar/estender); backend/core/exceptions.py (taxonomia `DomainError`, handler genérico já mapeia qualquer subclasse não-`TenantScopeViolation` para 409 sem registro extra); backend/core/tests/registry.py (`register_isolation_case`, contrato obrigatório para `TenantModel` novo)]
- [Source: backend/bujo/{views,serializers,urls}.py (padrão view fina/serializer a estender — `TaskDetailView`/`MonthlyLogView.post` são o molde direto das views novas); backend/bujo/tests/{factories,test_models,test_services,test_views,test_serializers}.py (padrões de teste e factories a seguir)]
- [Source: frontend/src/api/keys.ts (padrão de query key + invalidação por prefixo); frontend/src/features/bujo/{api,types,index}.ts; frontend/src/features/bujo/components/{MigrationBanner,CatchUpBanner}.tsx (molde "banner vazio = sem DOM" reaproveitado por `RecurringPlacementSection`); frontend/src/pages/planner/{WeeklyPage,MonthlyPage}.tsx (pontos de integração da seção de placement — `MonthlyPage.isCurrentMonth`/`currentMonthFirst()` reaproveitados); frontend/src/pages/PlaceholderPage.tsx (substituído só na rota `settings`); frontend/src/app/router.tsx (rota `settings`, linhas 98-102); frontend/src/app/layout/Sidebar.tsx (nav item "Configurações" → `/settings`, já existente desde a 2.3 — nenhuma alteração necessária aqui)]
- [Source: _bmad-output/implementation-artifacts/3-1-agregado-task-com-schema-congelado-e-maquina-de-estados.md#Dev Notes (linhas 87 — por que `source_template_id` era `UUIDField` solto; linha 247 — campos congelados implementados)]
- [Source: _bmad-output/implementation-artifacts/4-4-catch-up-de-dias-pulados.md#Dev Notes ("Contexto não-bloqueante" — "Story 4.5 não depende de nada desta story — templates são uma entidade nova, sem interseção com o motor de migração/catch-up", confirmando a decisão de não estender `MigrationFlow`); #Senior Developer Review (padrão de verificação independente de contagens antes de aceitar Completion Notes)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-07-08.md §1 ("contagem real de testes"), §8 ("File List por último") — guardrails codificados em `_bmad/custom/bmad-dev-story.toml`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Sessão anterior (dev-story attempt 1) tinha deixado o backend implementado (Tasks 1-8) mas sem os checkboxes marcados e sem a Task 9 em diante — esta execução retomou a partir daí, verificando o trabalho existente por leitura de diff antes de continuar (nenhum código backend foi reescrito, só validado).
- `uv run pytest` falhou nas primeiras 288 tentativas com `psycopg.errors.DuplicateDatabase: database "test_neondb" already exists` — banco de teste órfão de uma execução anterior interrompida, com 1 sessão ainda conectada (`ObjectInUse` ao tentar `DROP DATABASE`). Corrigido terminando a sessão travada via `pg_terminate_backend` antes do `DROP DATABASE`, direto no Neon via `psycopg`/`django-environ`.
- `WeeklyPage.test.tsx`/`MonthlyPage.test.tsx` (Task 12.5): dois campos com o mesmo `label` coexistem quando o diálogo de placement está aberto (`"Título"` da linha em edição vs. do form de criação em `RecurringTemplateManager`; `"Dia (opcional)"` do diálogo vs. do form "Adicionar tarefa ao mês" em `MonthlyPage`) — `getByLabelText`/`getAllByLabelText` precisou de escopo por posição no DOM (primeiro = linha da lista, que renderiza antes do form; último = diálogo, portal do MUI renderiza por último).
- Verificação manual (Task 13.3) via Playwright temporário (criado e apagado nesta sessão, não faz parte do File List): a primeira tentativa falhou com "Test timeout of 30000ms exceeded" no meio do fluxo de segundo placement — não era bug de produto; instrumentação com `waitForResponse` confirmou que o clique em "Confirmar" nunca deixou de disparar o POST, só que o fluxo completo (CRUD de 2 templates + 2 placements + edição + desativação, cada passo com round-trip real contra o Neon dev branch) excede o timeout default de 30s do Playwright. Corrigido com `test.setTimeout(120_000)`; reexecutado do zero e passou de ponta a ponta.

### Completion Notes List

- Backend (Tasks 1-9) já estava implementado ao início desta sessão (modelo `RecurringTaskTemplate`, migração 0004 promovendo `source_template_id` de `UUIDField` solto para `ForeignKey`, `services/recurring.py`, serializers/views/urls, `WrongPlacementContainer`, `register_isolation_case`) — validado linha a linha contra as Tasks 1-8 e contra os testes já escritos antes de marcar os checkboxes; nenhuma alteração de código foi necessária, só a regeneração do contrato (Task 9) e a verificação de suite.
- Contrato de API (Task 9): `schema.yaml`/`types.gen.ts` regenerados — diff só aditivo (`RecurringTaskTemplate`/`Create`/`Update`/`Place` + os 3 paths novos; `Task` ganhou `sourceTemplate`); blocos `security` dos endpoints existentes intactos (guardrail retro Epic 3 §3, conferido no diff).
- Camada de dados do frontend (Task 10): `keys.bujo.recurringTemplates`, tipos `RecurringTaskTemplate`/`RecurrenceGroup`, e os 4 hooks (`useRecurringTemplatesQuery`/`useCreateRecurringTemplateMutation`/`useUpdateRecurringTemplateMutation`/`usePlaceRecurringTemplateMutation`) seguindo exatamente o molde de `useMigrateTaskMutation` (invalidação por prefixo, incluindo cruzada para `weeklyLog`/`monthlyLog` no placement).
- `RecurringTemplateManager` (Task 11): CRUD completo em Configurações — lista (ativo+inativo, com indicador visual), form de criação, edição inline por linha, toggle `active` via PATCH direto (sem confirmação). `SettingsPage` é a primeira página real da rota `/settings` (substitui `PlaceholderPage` só ali, demais rotas intocadas). Barrel de `features/bujo` estendido; mocks de `RouteAnnouncer.test.tsx`/`router.test.tsx` atualizados preventivamente (achado recorrente 4.3/4.4).
- `RecurringPlacementSection`/`RecurringPlacementDialog` (Task 12): seção presentacional (mesmo padrão "banner vazio = sem DOM" de `MigrationBanner`/`CatchUpBanner`) que só lista e delega via `onPlace` — o diálogo (compartilhado entre `WeeklyPage`/`MonthlyPage`, variando só `dateFieldType`) e a chamada de `usePlaceRecurringTemplateMutation` vivem na página, que é quem conhece `weekStart`/`monthFirst`. `MonthlyPage` calcula `recurrenceGroups` reaproveitando `isCurrentMonth`; `annual` só se soma a `monthly` quando o mês exibido é janeiro.
- AC #3 (independência instância/template) verificada em 3 camadas: teste de serviço (`test_place_template_independencia_instancia_template_ac3`), teste de view, e a verificação manual E2E (editar o template depois de um placement não muda a `Task` já criada; colocar de novo usa os campos atualizados).
- Contagens reais observadas nesta execução (guardrail retro Epic 3 §1):
  - Backend: `288 passed` (`uv run pytest`, 14:07 min — Neon dev branch remoto, após limpar o banco de teste órfão); `uv run ruff check .` — All checks passed; `uv run lint-imports` — 1 contrato mantido, 0 quebrado; `uv run python manage.py check` — 0 problemas.
  - Frontend: `npm run typecheck` sem erros; `npm run lint` sem achados; `npm run build` concluído (aviso pré-existente de chunk size >500kB, não relacionado a esta story); `npm run test` → `365 passed` em 41 arquivos.
  - Verificação manual (Task 13.3): script Playwright temporário (criado e apagado, não versionado) contra backend+frontend reais — CRUD de templates, placement weekly/monthly, independência AC#3 (editar template não muda instância já colocada; colocar de novo usa título atualizado), desativação (some do placement, continua em Configurações), zero erros de console. `migration_count == 0` e `source_template` apontando para o template confirmados via `manage.py shell`/ORM.

### File List

- backend/bujo/models.py
- backend/bujo/migrations/0004_recurringtasktemplate_remove_task_source_template_id_and_more.py
- backend/bujo/services/recurring.py
- backend/bujo/services/tasks.py
- backend/bujo/serializers.py
- backend/bujo/views.py
- backend/bujo/urls.py
- backend/core/exceptions.py
- backend/bujo/tests/factories.py
- backend/bujo/tests/test_models.py
- backend/bujo/tests/test_serializers.py
- backend/bujo/tests/test_services.py
- backend/bujo/tests/test_views.py
- schema.yaml
- frontend/src/api/keys.ts
- frontend/src/api/types.gen.ts
- frontend/src/app/layout/RouteAnnouncer.test.tsx
- frontend/src/app/router.test.tsx
- frontend/src/app/router.tsx
- frontend/src/features/bujo/api.ts
- frontend/src/features/bujo/api.test.tsx
- frontend/src/features/bujo/index.ts
- frontend/src/features/bujo/types.ts
- frontend/src/features/bujo/components/RecurringTemplateManager.tsx
- frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx
- frontend/src/features/bujo/components/RecurringPlacementSection.tsx
- frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx
- frontend/src/features/bujo/components/RecurringPlacementDialog.tsx
- frontend/src/pages/settings/SettingsPage.tsx
- frontend/src/pages/settings/SettingsPage.test.tsx
- frontend/src/pages/planner/WeeklyPage.tsx
- frontend/src/pages/planner/WeeklyPage.test.tsx
- frontend/src/pages/planner/MonthlyPage.tsx
- frontend/src/pages/planner/MonthlyPage.test.tsx
- frontend/e2e/recurring-templates.spec.ts (achado da revisão automática — spec E2E deixado no working tree por uma rodada de QA anterior à finalização deste File List; não estava documentado)

## Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (story-automator, revisão automática) em 2026-07-14

**Verificação independente:** claims de contagem/qualidade não aceitas de memória — reexecutadas nesta sessão: `uv run pytest` → **288 passed** (11:35 min), `uv run ruff check .` → limpo, `uv run lint-imports` → `1 kept, 0 broken`, `uv run python manage.py check` → 0 problemas; `npm run typecheck` → limpo, `npm run lint` → limpo, `npm run build` → sucesso (aviso pré-existente de chunk >500kB, não relacionado), `npm run test` → **365 passed** em 41 arquivos — todos os números batem exatamente com as Completion Notes. Contrato de API reconferido do zero: `manage.py spectacular` e `npm run generate-types` regerados em arquivos temporários e comparados por `diff` contra `schema.yaml`/`types.gen.ts` commitados — **zero diff** em ambos (Task 9 confirmada, nenhum diff residual). Diff completo (não amostral) de todos os 21 arquivos de código de produção/teste do backend e frontend lido linha a linha contra as ACs e as Tasks marcadas `[x]`; nenhuma discrepância entre implementação e claim encontrada. `git status`/`git diff --name-only` cruzados contra o File List.

### Findings

1. **[MEDIUM] File List incompleto — `frontend/e2e/recurring-templates.spec.ts` não documentado.** O arquivo existe no working tree (untracked, 201 linhas, spec E2E real cobrindo AC1/AC2/AC3 ponta-a-ponta) mas não constava no File List nem foi reconhecido nas Completion Notes — o Debug Log da própria story afirma que o script de verificação manual (Task 13.3) "foi criado e apagado nesta sessão", o que está desatualizado em relação ao estado real do repositório (o spec foi adicionado por uma rodada de QA posterior, antes desta revisão). **Corrigido:** File List atualizado com o arquivo e uma nota explicando a origem.
2. **[HIGH, corrigido] `frontend/e2e/recurring-templates.spec.ts` era flaky sob execução paralela normal (`playwright test`, 2 workers, timeout default).** Rodei a suite real (backend + frontend + Neon dev branch) via `npx playwright test e2e/recurring-templates.spec.ts`: **2/2 falharam** na primeira tentativa — `getByText('Semanal — toda segunda')`/`'Semanal — toda manhã'` não apareciam a tempo (5000ms) logo após o POST de criação, apesar do POST ter retornado 201 (confirmado nos logs do webServer). Causa raiz: das ~18 asserções `toBeVisible()` do arquivo, a maioria que segue uma mutação (create/update/place) usa `{ timeout: 10_000 }` para acomodar o round-trip real contra o Neon dev branch (mesma lentidão já documentada no Debug Log da própria story, que motivou `test.setTimeout(120_000)`) — mas 5 asserções (linhas 36, 43, 95, 135, 182 no arquivo original) ficaram com o timeout default de 5000ms, inconsistente com o resto do arquivo. **Corrigido:** adicionado `{ timeout: 10_000 }` às 5 asserções; suite re-executada com a configuração default (2 workers) → **2/2 passaram** (verificado, não apenas assumido).

Nenhum achado CRITICAL: as 3 ACs estão implementadas e comprovadas por teste em 3 camadas (model, serviço, view) mais E2E real; nenhuma task marcada `[x]` ficou sem evidência real de implementação; a migração de `source_template_id` (`UUIDField` solto → `ForeignKey`) foi conferida linha a linha no arquivo de migração gerado — `RemoveField` + `AddField` com `on_delete=SET_NULL`, sem perda de dados; AC #3 (independência instância/template) provada por teste de serviço dedicado (`test_place_template_independencia_instancia_template_ac3`) que edita o template entre dois placements e confere que a primeira `Task` não muda; isolamento multi-tenant registrado (`register_isolation_case`) e a taxonomia de exceção (`WrongPlacementContainer` → 409) mapeada sem registro extra, consistente com o handler genérico.

**Outcome:** Approved — 0 issues CRITICAL/HIGH remanescentes (o único HIGH foi corrigido e reverificado nesta mesma sessão).
