---
baseline_commit: 9088d37
---

# Story 11.12: Categoria em templates recorrentes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero atribuir uma categoria (cor) aos templates de tarefas recorrentes,
Para que a recorrência já carregue sua categoria e a tarefa gerada herde a cor sem eu reclassificar toda vez (fecha a questão em aberto registrada na Story 11.8).

3º lote do Épico 11 (Correct Course 2026-07-16). Nasce da questão em aberto da Story 11.8 (`_bmad-output/implementation-artifacts/11-8-infos-da-recorrencia-no-modal-de-placement.md`, seção final): `RecurringTaskTemplate` nunca teve `category` (só `Task` tem). Diferente das Stories 11.7–11.11 (só-frontend), **esta story muda schema** — modelo, migração, serializers e regeneração de contrato (`schema.yaml`/`types.gen.ts`).

## Acceptance Criteria

### AC1 — `RecurringTaskTemplate` ganha campo `category` opcional (reusa `Task.Category`)

- **Dado que** o modelo `RecurringTaskTemplate` (`backend/bujo/models.py:174-197`),
- **Então** ganha um campo `category` nulável/opcional que **reusa os valores de `Task.Category`** (teal/purple/pink/yellow/green/blue, `models.py:92-99`) — sem inventar enum novo,
- **E** um template sem categoria continua válido (`category=None`).

### AC2 — Migração Django + serializers + regeneração de contrato

- **Dado que** a mudança de modelo,
- **Então** há uma migração Django nova (`backend/bujo/migrations/`), os 3 serializers de template (`RecurringTaskTemplateSerializer`/`…CreateSerializer`/`…UpdateSerializer`, `backend/bujo/serializers.py:249-286`) passam a incluir `category`,
- **E** `schema.yaml` (raiz do repo) e `frontend/src/api/types.gen.ts` são regenerados e commitados — esta story **muda contrato**, ao contrário das stories só-de-frontend do 2º lote.

### AC3 — CRUD de templates (`RecurringTemplateManager`) ganha seletor de categoria

- **Dado que** o formulário de criação de templates (`frontend/src/features/bujo/components/RecurringTemplateManager.tsx`),
- **Quando** crio um template,
- **Então** há um seletor de categoria (as mesmas 6 cores do `Task`), a categoria escolhida é persistida e exibida na listagem,
- **E** deixá-la vazia é permitido (sem categoria, `category: null`).

### AC4 — Categoria exibida no placement de recorrentes (fecha a AC4 da Story 11.8)

- **Dado que** o modal de placement (`RecurringPlacementDialog.tsx`, Stories 11.3/11.8) e a lista de recorrentes a colocar (`RecurringPlacementSection.tsx`, Story 11.2/4.5),
- **Quando** o template tem categoria definida,
- **Então** a categoria é exibida junto às demais infos (mesmo padrão da linha "Prioridade: …" adicionada pela Story 11.8),
- **E** um template **sem** categoria simplesmente não mostra o campo (sem placeholder ruidoso — mesma regra de nulos da AC3 da Story 11.8).

### AC5 — Task colocada/gerada herda a categoria do template (editável depois)

- **Dado que** um template **com** categoria, colocado via o fluxo de placement existente (`place_template`, `backend/bujo/services/recurring.py:28-53`),
- **Então** a `Task` criada **herda** `category` do template (mesmo padrão de cópia já usado para `title`/`description`/`eisenhower`),
- **E** o campo permanece **editável** depois na tarefa (via `TaskDetailPanel`, sem trava nova).

### AC6 — Template sem categoria: task nasce sem categoria (sem regressão)

- **Dado que** um template **sem** categoria colocado/gerado,
- **Então** a `Task` criada nasce com `category=None`, exatamente como hoje,
- **E** nenhum teste/fluxo existente de placement muda de comportamento.

*Nota (epics.md):* não existe fluxo de auto-geração de recorrentes no código atual — confirmado por leitura exaustiva (sem cron, sem management command, sem Celery; `RecurringTaskTemplate.__doc__` é explícito: "nunca migra, só é colocado... placement manual, sem auto-placement"). **O único ponto de criação de `Task` a partir de um template é `place_template`** (placement manual) — é o único lugar que precisa copiar `category`. Não invente um segundo fluxo.

## Tasks / Subtasks

> **Escopo real:** 1 campo de modelo + 1 migração + 3 serializers + 1 linha de cópia no serviço de placement + regeneração de contrato (backend) — 1 seletor no CRUD de templates + 1 linha de exibição no modal/seção de placement (frontend). Story curta mas toca as 3 camadas (modelo → contrato → UI), ao contrário do 2º lote inteiro (só-frontend).

### Backend — Modelo, migração, serializers

- [x] **Task 1: Adicionar `category` ao modelo `RecurringTaskTemplate`** (AC1)
  - [x] 1.1 Em `backend/bujo/models.py`, dentro da classe `RecurringTaskTemplate` (linhas 174-197), inserir o campo `category` logo após `eisenhower` (linha 188) e antes de `recurrence_group` (linha 189) — mesma posição relativa que `Task` usa entre seus dois campos (`models.py:115-120`, `eisenhower` depois `category`):
    ```python
    category = models.CharField(  # noqa: DJ001 - mesma semântica nulável de Task.category
        max_length=8, choices=Task.Category.choices, null=True, blank=True
    )
    ```
    Reusa `Task.Category` (nested `TextChoices` em `models.py:92-99` — teal/purple/pink/yellow/green/blue) — **não** criar um novo enum. `Task` já está importado no módulo (é a classe anterior no mesmo arquivo).
  - [x] 1.2 **Não** tocar em `Task.Category`, em nenhum outro campo de `RecurringTaskTemplate` (`title`/`description`/`eisenhower`/`recurrence_group`/`recurrence_text`/`active`) nem em `Meta` (`db_table`, linha 196).

- [x] **Task 2: Gerar e aplicar a migração** (AC1, AC2)
  - [x] 2.1 Rodar `cd backend && uv run python manage.py makemigrations bujo` — deve gerar `bujo/migrations/0005_recurringtasktemplate_category.py` (última migração hoje é `0004_recurringtasktemplate_remove_task_source_template_id_and_more.py`; `0005` depende de `0004`). **Não escrever a migração à mão** — deixar o Django autogerar e só revisar o resultado.
  - [x] 2.2 Conferir que a migração gerada é uma única `AddField` (mesmo shape da precedente direta, `0002_task_category.py`, que adicionou `category` a `Task`):
    ```python
    migrations.AddField(
        model_name='recurringtasktemplate',
        name='category',
        field=models.CharField(blank=True, choices=[('teal', 'Teal'), ('purple', 'Purple'), ('pink', 'Pink'), ('yellow', 'Yellow'), ('green', 'Green'), ('blue', 'Blue')], max_length=8, null=True),
    )
    ```
  - [x] 2.3 Rodar `uv run python manage.py migrate` local (ambiente de dev) para aplicar. **Nenhum dado a migrar/backfill** — campo novo nulável, todas as linhas existentes ficam `category=NULL` automaticamente.

- [x] **Task 3: Atualizar os 3 serializers de template** (AC2)
  - [x] 3.1 `RecurringTaskTemplateSerializer.Meta.fields` (`backend/bujo/serializers.py:250-260`): inserir `"category",` logo após `"eisenhower",` (linha 256) — mesma ordem relativa de `TaskSerializer.Meta.fields` (`serializers.py:24-25`, `eisenhower` seguido de `category`). É um `ModelSerializer`: nenhuma outra mudança necessária, o DRF introspecta `null`/`choices` do modelo automaticamente (mesmo padrão de `eisenhower` hoje).
  - [x] 3.2 `RecurringTaskTemplateCreateSerializer` (`serializers.py:263-273`): adicionar, logo após o bloco `eisenhower` (linhas 266-268), um campo idêntico ao padrão de `TaskCreateSerializer.category` (`serializers.py:68-70`):
    ```python
    category = serializers.ChoiceField(
        choices=Task.Category.choices, required=False, allow_null=True
    )
    ```
  - [x] 3.3 `RecurringTaskTemplateUpdateSerializer` (`serializers.py:276-286`): mesma adição, mirrorando `TaskUpdateSerializer.category` (`serializers.py:79-81`) — `ChoiceField(choices=Task.Category.choices, required=False, allow_null=True)`, inserido logo após o bloco `eisenhower` (linhas 279-281).
  - [x] 3.4 **Não** tocar em `RecurringTaskTemplatePlaceSerializer` (`serializers.py:289-292`, só parâmetros de data de placement — nenhum campo de template passa por aqui) nem nas views (`backend/bujo/views.py:176-241`, já usam `@extend_schema` com os serializers acima — o contrato OpenAPI é regenerado automaticamente a partir deles, Task 6).

- [x] **Task 4: Copiar `category` no placement (`place_template`)** (AC5, AC6)
  - [x] 4.1 Em `backend/bujo/services/recurring.py`, dentro de `place_template` (linhas 28-53), no dict `common` (linhas 36-41), adicionar `category=template.category,` logo após `eisenhower=template.eisenhower,` (linha 39):
    ```python
    common = dict(
        title=template.title,
        description=template.description,
        eisenhower=template.eisenhower,
        category=template.category,
        source_template=template,
    )
    ```
  - [x] 4.2 **Nenhuma mudança em `create_task`** (`backend/bujo/services/tasks.py:23-61`) — já aceita `category=None` como kwarg nomeado (linha 33) e já persiste `category=category` no `Task.objects.create(...)` (linha 58); `**common` passa `category` direto por nome. Confirmar isso por leitura, não reimplementar.
  - [x] 4.3 **Nenhuma mudança em `create_template`/`update_template`** (`services/recurring.py:14-25`) — ambos são passthrough puro (`**fields`); uma vez que os serializers da Task 3 incluam `category` em `validated_data`, ele flui automaticamente para `RecurringTaskTemplate.objects.create(**fields)` / `setattr(template, field, value)`.

- [x] **Task 5: Testes de backend** (AC1, AC2, AC5, AC6)
  - [x] 5.1 `backend/bujo/tests/test_models.py`: estender com testes de `category` em `RecurringTaskTemplate`, mesmo padrão de `test_task_category_aceita_as_6_choices_validas`/`test_task_category_aceita_null` (linhas 77-91) — `RecurringTaskTemplateFactory(user=user, category=category)` para cada valor de `Task.Category.values` + caso `category=None`. **`RecurringTaskTemplateFactory` (`tests/factories.py:85-96`) não precisa de nenhuma mudança** — é um `DjangoModelFactory` puro, aceita `category=...` como kwarg de instanciação mesmo sem declaração explícita na classe (mesmo padrão de `TaskFactory`, que também não declara `category` e ainda assim `TaskFactory(user=user, category=...)` já funciona nos testes existentes, `test_models.py:81`).
  - [x] 5.2 `backend/bujo/tests/test_services.py`: estender `test_create_template_grava_campos_passados` (linha 920) para passar e assertar `category`; estender `test_place_template_weekly_cria_task_com_campos_esperados` (linha 971) para incluir `category=Task.Category.TEAL` (ou similar) no `RecurringTaskTemplateFactory` e assertar `task.category == Task.Category.TEAL` (AC5, mesmo padrão da asserção de `eisenhower` já existente, linha ~992). Adicionar teste novo dedicado `test_place_template_sem_category_cria_task_sem_categoria` (AC6 — regressão): template com `category=None` → task colocada tem `category is None`.
  - [x] 5.3 `backend/bujo/tests/test_views.py`: estender `test_post_recurring_template_cria_e_retorna_201` (linha 1655) para enviar `category` no payload e assertar `response.data["category"]`; estender `test_patch_recurring_template_atualiza_e_retorna_200` (linha 1925) ou adicionar um teste novo de PATCH só de `category`.
  - [x] 5.4 `ruff check . && lint-imports && manage.py check` verdes; **colar contagem real** de `pytest -q` **sem restringir por caminho** (retro Epic 11: `pytest bujo/ core/` já mascarou 26 testes de `accounts/` numa story anterior — rodar a suíte completa, sem escopo). Baseline de sanidade (11.11, pós-review): **368 passed**.

### Contrato — regenerar `schema.yaml` + `types.gen.ts`

- [x] **Task 6: Regenerar o contrato OpenAPI e os tipos TS** (AC2)
  - [x] 6.1 A partir de `backend/`: `uv run python manage.py spectacular --file ../schema.yaml` (mesmo comando do CI, `.github/workflows/ci.yml:74` — grava na raiz do repo, `schema.yaml`, não dentro de `backend/`).
  - [x] 6.2 A partir de `frontend/`: `npm run generate-types` (script já existente, `frontend/package.json:12` — `npx openapi-typescript ../schema.yaml -o src/api/types.gen.ts`).
  - [x] 6.3 Conferir por `git diff` que `schema.yaml` (raiz) e `frontend/src/api/types.gen.ts` mudaram: `RecurringTaskTemplate`/`RecurringTaskTemplateCreate`/`PatchedRecurringTaskTemplateUpdate` (`types.gen.ts`, hoje linhas ~467-514) ganham `category` no mesmo formato que `eisenhower` já tem nesses 3 tipos (union com `CategoryEnum`/`NullEnum`, e para o tipo de leitura também `BlankEnum` — mesmo padrão de `Task.category`, `types.gen.ts:540`). **Não editar `types.gen.ts` à mão** — é gerado.
  - [x] 6.4 O CI (`ci.yml:76-82`) falha se `types.gen.ts` divergir do `schema.yaml` regenerado — rodar os dois comandos acima e commitar ambos garante que o gate passe.

### Frontend — payload da mutation + CRUD de templates

- [x] **Task 7: `api.ts` — incluir `category` no payload de criar/editar template** (AC2, AC3)
  - [x] 7.1 Em `frontend/src/features/bujo/api.ts`, na interface `RecurringTemplateFields` (linhas 425-432), adicionar `category?: TaskCategory | null` logo após `eisenhower?: TaskEisenhower | null` (linha 428). `TaskCategory` já está importado no topo do arquivo (linha 17) — nenhum import novo.
  - [x] 7.2 **Nenhuma outra mudança em `api.ts`** — `createRecurringTemplate`/`useCreateRecurringTemplateMutation` (434-449) e `updateRecurringTemplate`/`useUpdateRecurringTemplateMutation` (451-474, via `Partial<RecurringTemplateFields>`) já repassam o objeto de fields inteiro ao `client.post`/`client.patch`; adicionar o campo à interface é suficiente para os dois payloads.
  - [x] 7.3 **`keys.ts` não muda** — `keys.bujo.recurringTemplates(params)` chaveia só por `active`/`recurrenceGroup`/`unplacedYear` (query params), não por campos da entidade.

- [x] **Task 8: Seletor de categoria no CRUD de templates (`RecurringTemplateManager.tsx`)** (AC3)
  - [x] 8.1 Importar `TaskCategory` junto dos demais tipos (linha 21: `import type { RecurrenceGroup, RecurringTaskTemplate, TaskEisenhower } from '../types'` → adicionar `TaskCategory`).
  - [x] 8.2 Adicionar um mapa `CATEGORY_LABEL` local, mirrorando `TaskDetailPanel.tsx:19-26` (a fonte canônica do padrão de categoria — **não** o `EISENHOWER_LABEL` deste mesmo arquivo, que filtra `'none'`; categoria não tem sentinela "nenhuma", as 6 cores são todas reais), inserido logo após `EISENHOWER_LABEL` (linhas 29-34):
    ```tsx
    const CATEGORY_LABEL: Record<TaskCategory, string> = {
      teal: 'Teal',
      purple: 'Purple',
      pink: 'Pink',
      yellow: 'Yellow',
      green: 'Green',
      blue: 'Blue',
    }
    ```
    Mesma convenção de duplicação local já estabelecida (`EISENHOWER_LABEL` já está copiado em `TaskDetailPanel.tsx`, `RecurringTemplateManager.tsx` e `RecurringPlacementDialog.tsx` — uma 4ª/5ª cópia de `CATEGORY_LABEL` segue o padrão vigente; **não** extrair módulo compartilhado nesta story).
  - [x] 8.3 Adicionar estado `const [category, setCategory] = useState<TaskCategory | ''>('')` junto de `eisenhower` (linha 133).
  - [x] 8.4 Adicionar o `<Select>` de categoria no formulário (`RecurringTemplateManager.tsx`, dentro do `Box component="form"`, linhas 205-254), logo depois do `<Select>` de Eisenhower (linhas 223-238) e antes do `TextField` de "Recorrência (texto livre)" (linha 239):
    ```tsx
    <Select
      size="small"
      displayEmpty
      value={category}
      onChange={(event) => setCategory(event.target.value as TaskCategory | '')}
      inputProps={{ 'aria-label': 'Categoria' }}
    >
      <MenuItem value="">Nenhuma</MenuItem>
      {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((value) => (
        <MenuItem key={value} value={value}>
          {CATEGORY_LABEL[value]}
        </MenuItem>
      ))}
    </Select>
    ```
    **Sem filtro** de valores (ao contrário do `<Select>` de Eisenhower deste mesmo arquivo, que filtra `'none'`, linha 232) — mesmo padrão do `<Select>` de categoria em `TaskDetailPanel.tsx:119-131`, que também não filtra nada (todas as 6 chaves de `CATEGORY_LABEL` são categorias reais; só o valor `''` do MenuItem "Nenhuma" representa ausência).
  - [x] 8.5 Em `handleSubmit` (linhas 145-164): adicionar `category: category || null,` ao objeto passado a `createTemplate.mutate({...})`, logo após `eisenhower: eisenhower || null,` (linha 154); e `setCategory('')` ao bloco de reset após o submit, junto de `setEisenhower('')` (linha 161).
  - [x] 8.6 **Fora de escopo, decisão registrada:** `TemplateRow` (edição inline, linhas 42-121) **não** ganha edição de categoria — hoje a edição inline só cobre `title`/`recurrenceText` (linhas 56-60), nem `eisenhower` é editável inline. Adicionar categoria à edição inline seria escopo maior que o de Eisenhower (campo irmão, também sem esse suporte) — mesma decisão de escopo mínimo já tomada implicitamente para `eisenhower` neste componente. Se precisar reclassificar um template existente, o caminho é recriar ou aguardar uma story futura de edição inline mais completa.

- [x] **Task 9: Exibir a categoria no placement de recorrentes** (AC4 — fecha a AC4 da Story 11.8)
  - [x] 9.1 Em `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`: importar `TaskCategory` (linha 4, junto de `RecurringTaskTemplate`); adicionar `CATEGORY_LABEL` local (mesma duplicação de `TaskDetailPanel.tsx:19-26`, mesma convenção do `EISENHOWER_LABEL` já duplicado neste arquivo, linhas 11-15) logo após ele. Adicionar, dentro do bloco `{template && (<Box>...)}` (linhas 60-79), uma linha condicional **depois** do bloco de Eisenhower (linhas 73-77) e antes do `</Box>` de fechamento (linha 78):
    ```tsx
    {template.category && (
      <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
        Categoria: {CATEGORY_LABEL[template.category]}
      </Typography>
    )}
    ```
    Guard é só `template.category &&` (sem o `in EISENHOWER_LABEL`-style check do Eisenhower) — categoria não tem sentinela tipo `'none'`; `null`/`undefined`/`''` já são todos falsy, então o `&&` sozinho cobre a regra de nulos da AC4 (campo ausente não aparece). **Não** tocar em nenhuma outra parte do bloco (título, descrição, "Recorrência: …", `MonthDensityCalendar`, `handleConfirm`/`handleClose`).
  - [x] 9.2 Em `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`: a AC4 do épico nomeia explicitamente este componente também (`epics.md:1029`, "modal/seção de placement... RecurringPlacementDialog/RecurringPlacementSection"). Diferente da Story 11.8 (que só tocou o Dialog, porque a Section nunca exibiu Eisenhower e a AC da 11.8 não a citava), **aqui a AC cita a Section nominalmente** — decisão desta story: adicionar a mesma linha condicional também na Section, dentro do `.map((template) => ...)` (linhas 64-104), logo após o bloco de descrição (linhas ~89-93):
    ```tsx
    {template.category && (
      <Typography variant="body-sm" color="text.secondary" component="div">
        Categoria: {CATEGORY_LABEL[template.category]}
      </Typography>
    )}
    ```
    Precisa do mesmo import de `TaskCategory` e do mesmo mapa `CATEGORY_LABEL` local (mais uma duplicação, mesma convenção). Custo marginal (uma linha), evita reabrir esta AC numa story futura por causa da lista de sugestões não mostrar o que o modal já mostra.
  - [x] 9.3 **Fora de escopo:** trocar o texto por um chip/swatch colorido usando `theme.palette.category[...]` (usado em `TaskRow.tsx:169-170` como borda colorida do card) — variante visual aceitável mas não requerida; o padrão de texto já é o que a Story 11.8 estabeleceu para Eisenhower no mesmo Dialog, manter consistência visual mínima.

- [x] **Task 10: Testes de frontend** (AC3, AC4)
  - [x] 10.1 `RecurringTemplateManager.test.tsx`: estender com um teste de "criar com categoria repassa esse campo no payload" mirrorando o teste já existente `'criar com descrição e eisenhower repassa esses campos no payload'` (linha 212) — abrir o `<Select aria-label="Categoria">` (`fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Categoria' }))`), escolher uma opção, assertar `category` no mock de `useCreateRecurringTemplateMutation`.
  - [x] 10.2 `RecurringPlacementDialog.test.tsx`: a fixture `TEMPLATE` (linhas 17-24) ganha `category: null` explícito (não regride os testes existentes, já que `null` é falsy/não-exibido). Adicionar casos novos: categoria exibida quando definida (`template={{ ...TEMPLATE, category: 'teal' }}` → `expect(screen.getByText('Categoria: Teal')).toBeInTheDocument()`, cobrir ao menos 2-3 valores via `it.each`) e categoria **não** exibida quando `null` (caso já coberto pela fixture default, mas adicionar asserção explícita `expect(screen.queryByText(/Categoria:/)).not.toBeInTheDocument()`).
  - [x] 10.3 `RecurringPlacementSection.test.tsx`: mesmo par de casos (exibe quando definida / não exibe quando `null`), adaptado à fixture de templates já usada neste arquivo.
  - [x] 10.4 `npm run typecheck && npm run lint && npm run build && npx vitest run --no-file-parallelism` (Node 22, `nvm use 22`) verdes; **colar contagem real**. Baseline de sanidade (11.11, pós-review): **538 passed (45 arquivos)**.

### Verificação manual e reconciliação final

- [x] **Task 11: Verificação manual** (AC1-AC6)
  - [x] 11.1 Criar um template com categoria em Planner > Recorrentes → confirmar que aparece na listagem (`TemplateRow`) — **nota:** `TemplateRow` hoje não exibe categoria na linha de leitura (só mostra `RECURRENCE_GROUP_LABEL — recurrenceText` + descrição truncada, linhas 96-109); se a AC3 ("persistida e exibida na listagem") for lida como exigindo exibição visível na linha (não só no formulário de criação), adicionar uma linha/chip de categoria em `TemplateRow` também (mesmo `CATEGORY_LABEL`, ou um pequeno swatch `theme.palette.category[...]`) — **decisão a confirmar durante a implementação**: se o dev julgar que "exibida na listagem" é satisfeita só pelo formulário persistir/recarregar o valor (que já reflete no Select ao reabrir — mas hoje o formulário de criação não pré-popula um Select ao editar, só `TemplateRow`'s inline title/recurrenceText), registrar a leitura escolhida nas Completion Notes (guardrail: "documentar o raciocínio inline" da retro Epic 4 #3). Preferência: adicionar a categoria como texto/swatch discreto em `TemplateRow` (custo baixo, fecha a leitura literal da AC).
  - [x] 11.2 Abrir o modal de placement (Esta Semana ou Este Mês) de um template com categoria → linha "Categoria: …" aparece junto de "Prioridade: …"/"Recorrência: …"; de um template sem categoria → linha ausente. Repetir a checagem na lista de sugestões (`RecurringPlacementSection`, Task 9.2).
  - [x] 11.3 Colocar um template com categoria → a `Task` gerada nasce com a categoria (chip/borda colorida no `TaskRow`, `theme.palette.category[...]`) e é editável depois via `TaskDetailPanel` (AC5).
  - [x] 11.4 Colocar um template sem categoria → a `Task` gerada nasce sem categoria (AC6, sem regressão).
  - [x] 11.5 **e2e:** `frontend/e2e/recurring-templates.spec.ts` já cobre CRUD + placement ponta-a-ponta (Story 4.5/11.2/11.8). Se o fluxo de criação/placement usado pelo spec quebrar por causa do novo `<Select aria-label="Categoria">` (ex.: seletor de Título/Recorrência por posição), ajustar o spec; **não é obrigatório** adicionar um cenário e2e novo dedicado a categoria nesta story — mesma divisão de responsabilidade da Story 11.8 (o teste de componente é a fonte de verdade da renderização condicional; o passo de QA automatizado subsequente, `bmad-qa-generate-e2e-tests`, é quem historicamente adicionou cobertura e2e extra para este componente).
  - [x] 11.6 **File List por último** (retro Epic 3 §8-2) — reconciliar contra `git status --short`/`git diff --stat` reais, incluindo `schema.yaml` (raiz) e `frontend/src/api/types.gen.ts` no diff esperado (ao contrário de quase toda story do 2º lote, que explicitamente NÃO tocava esses dois arquivos). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.

## Dev Notes

### Por que esta story existe e o que ela fecha

A Story 11.8 (implementada e revisada em 2026-07-16) investigou exibir "categoria" no modal de placement e descobriu, por leitura exaustiva do código, que `RecurringTaskTemplate` **nunca teve** esse campo — só `Task` tem. A 11.8 registrou isso como AC4 (decisão: não exibir, campo estruturalmente ausente) e uma **questão aberta ao Hugo**, apontando exatamente a cadeia de trabalho que essa mudança exigiria: *"campo no modelo + migração + `RecurringTaskTemplateSerializer`/…Create/…Update + regeneração de contrato + input no CRUD de template + cópia no snapshot de placement"* — é literalmente o escopo desta story (11.12), item por item. O Hugo decidiu fechá-la via Correct Course em 2026-07-16 (ver `_bmad-output/planning-artifacts/epics.md:1009`, nota do 3º lote).

### O padrão a seguir é `eisenhower`, não um caminho novo

`eisenhower` já percorre exatamente o caminho que `category` precisa percorrer em `RecurringTaskTemplate` — campo nulável no modelo (`models.py:186-188`), nos 3 serializers (`serializers.py:255-256,266-268,279-281`), copiado no placement (`services/recurring.py:39`), exibido no CRUD (`RecurringTemplateManager.tsx:29-34,223-238`) e no modal de placement (`RecurringPlacementDialog.tsx:11-15,73-77`, adicionado pela própria Story 11.8). Cada task acima cita o bloco de `eisenhower` correspondente como o padrão a espelhar — **não inventar uma abordagem diferente** para categoria só porque semanticamente é "cor" em vez de "prioridade". A única diferença estrutural: `eisenhower` tem uma sentinela `'none'` (`Task.Eisenhower.NONE`) que participa do enum e precisa de um filtro extra nos `<Select>`/guards; `category` **não tem** sentinela — todo valor do enum é uma cor real, e ausência é só `null`/`''`/`undefined`. Isso já está refletido nas Tasks 8.4/9.1 (guards mais simples que os de Eisenhower).

### Onde a cópia template→task acontece (e por que só ali)

`place_template` (`backend/bujo/services/recurring.py:28-53`) é o **único** lugar do código onde uma `Task` é criada a partir de um `RecurringTaskTemplate` — confirmado por busca exaustiva (sem Celery, sem cron, sem management command tocando `RecurringTaskTemplate`; o único management command do app é `purge_e2e_users.py`, não relacionado). O próprio docstring do modelo (`models.py:176-177`) é explícito: *"um template nunca migra, só é colocado (placement manual, sem auto-placement)"*. Portanto a Task 4 (uma linha em `common`, `services/recurring.py:39`) é **suficiente** — não há um segundo fluxo de auto-geração a atualizar, ao contrário do que o texto de outras stories do épico poderia sugerir por analogia com sistemas de recorrência mais sofisticados.

### AC4 cita `RecurringPlacementSection` — decisão explícita (diferente da 11.8)

A Story 11.8 tocou só `RecurringPlacementDialog` (o modal) para a etiqueta Eisenhower, porque a AC da 11.8 citava só o "modal de placement" e `RecurringPlacementSection` (a lista de sugestões antes de abrir o modal) nunca exibiu Eisenhower nem foi mencionada. **Esta story é diferente**: a AC4 do épico (`epics.md:1029`) nomeia explicitamente os dois componentes — `RecurringPlacementDialog` **e** `RecurringPlacementSection`. Decisão registrada (Task 9.2): adicionar a linha de categoria também na Section. Custo marginal (uma `Typography` condicional a mais, mesmo mapa `CATEGORY_LABEL` já criado para o Dialog) — evita fechar esta AC pela metade e reabrir a discussão numa story futura. Se o dev discordar dessa leitura ao implementar, é uma mudança de uma linha reverter (mesma prática institucionalizada pela retro do Epic 4 #3: favorecer o texto mais específico + documentar o raciocínio).

### `TemplateRow` (listagem) pode precisar de uma exibição de categoria — verificar durante a implementação

A AC3 do épico diz "a categoria escolhida é **persistida e exibida na listagem**/edição". O formulário de criação (Task 8) cobre a captura; `TemplateRow` (`RecurringTemplateManager.tsx:42-121`) é a "listagem" — hoje mostra `recurrenceGroup`/`recurrenceText`/`(inativo)`/descrição truncada, **nunca** Eisenhower nem (após esta story) categoria, a menos que a Task 8/11.1 adicione algo. Registrado como Task 11.1 (verificação manual com decisão a confirmar), não como gap resolvido de antemão — é exatamente o tipo de ambiguidade de leitura de AC que a retro do Epic 4 (#3) pede para resolver a favor do código existente + documentar a escolha, não para adivinhar silenciosamente.

### Migração — sem backfill, sem dado a migrar

Campo novo, nulável, sem `default` não-nulo — `AddField` simples. Todas as `RecurringTaskTemplate` já existentes no banco (dev/e2e/prod) ficam com `category=NULL` automaticamente após a migração, semanticamente idêntico a "sem categoria" (mesmo default de `Task.category` desde sempre). **Nenhum script de backfill, nenhuma migração de dados.**

### Precedente direto: `0002_task_category.py`

A migração que adicionou `category` a `Task` (`backend/bujo/migrations/0002_task_category.py`) é o precedente **exato** desta mudança — mesmo tipo de campo (`CharField(max_length=8, choices=Category.choices, null=True, blank=True)`), mesma forma de `AddField` isolado. A migração desta story (`0005_recurringtasktemplate_category.py`, dependendo de `0004_recurringtasktemplate_remove_task_source_template_id_and_more`) deve ter a mesma forma, só trocando `model_name`.

### Contrato: esta story é a exceção do 2º lote

Todo o 2º lote (Stories 11.7-11.11) tomou cuidado explícito de **não** tocar `schema.yaml`/`types.gen.ts` (guardrail repetido em cada uma delas). Esta story é o oposto: **é obrigatório** que ambos apareçam no diff final (Task 6), refletindo `category` nos 3 tipos de template (`RecurringTaskTemplate`, `RecurringTaskTemplateCreate`, `PatchedRecurringTaskTemplateUpdate`). Se o `git diff` final **não** incluir esses dois arquivos, a story está incompleta — o oposto do guardrail que valia até a 11.11.

### Previous Story Intelligence (11.11 — done)

- **Stack:** Backend Django 5.2 + DRF + drf-spectacular + uv/pytest/ruff/lint-imports; Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Sem dependência nova nesta story (nem backend nem frontend).
- **Node 22 obrigatório** (`nvm use 22`); `vitest run --no-file-parallelism`; Playwright (se rodar) `--workers=1` por cold-start da branch Neon `e2e`.
- **`jest-axe` só pega violação real contra o componente de verdade** — não mockar o componente sob teste de a11y (`RecurringTemplateManager`/`RecurringPlacementDialog`/`RecurringPlacementSection` já têm esses testes; manter).
- **`component="div"` obrigatório em `Typography variant="body-sm"` de bloco** (achado HIGH recorrente, Epic 11 2º lote) — vale para a nova linha "Categoria: …" nos dois componentes de placement (Task 9.1/9.2).
- **Contagem de testes sempre real, sem escopo de path** (retro Epic 3 §1 + retro Epic 11: rodar a suíte completa, nunca `pytest bujo/ core/`). **File List por último** (retro Epic 3 §8-2). Guardrails ativos em `_bmad/custom/bmad-dev-story.toml` (lista completa carregada como fato persistente desta sessão).
- **Baselines de sanidade (pós-11.11):** backend `pytest` **368 passed**; frontend `vitest` **538 passed (45 arquivos)**.
- **AR-22 (observabilidade) segue pendente e sem dono** — não bloqueia esta story.

### Git Intelligence

- Branch `main`; HEAD em `9088d37` (`chore(epic-11): retrospectiva (2ª passada) e fechamento do épico`) — `baseline_commit` desta story. Commits recentes relevantes: `11.11` (cc53a83), `11.10` (5d677f7), fix ordenação recorrentes (9d5ef75), `11.9` (91b7bd3/fc76f5f), `11.8` (65c177c — a story que deixou a questão aberta que esta story fecha). Convenção de commit: `feat(story-11.12): <descrição em pt-BR>`.
- `git diff --stat` esperado (backend + contrato + frontend, ao contrário do 2º lote): `backend/bujo/models.py`, `backend/bujo/migrations/0005_recurringtasktemplate_category.py` (novo), `backend/bujo/serializers.py`, `backend/bujo/services/recurring.py`, `backend/bujo/tests/test_models.py`, `backend/bujo/tests/test_services.py`, `backend/bujo/tests/test_views.py`, `schema.yaml` (raiz), `frontend/src/api/types.gen.ts`, `frontend/src/features/bujo/api.ts`, `frontend/src/features/bujo/components/RecurringTemplateManager.tsx` (+`.test.tsx`), `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx` (+`.test.tsx`), `frontend/src/features/bujo/components/RecurringPlacementSection.tsx` (+`.test.tsx`). **Sem** mudança em `RecurringTaskTemplatePlaceSerializer`, `views.py`, `TaskDetailPanel.tsx`, `TaskRow.tsx`, `theme.ts` (a paleta de cores já existe, só reusada).

### Project Structure Notes

- **Backend alterado:** `backend/bujo/models.py` (só `RecurringTaskTemplate`), `backend/bujo/migrations/` (+1 arquivo), `backend/bujo/serializers.py` (3 classes de template), `backend/bujo/services/recurring.py` (só `place_template`), `backend/bujo/tests/test_models.py`/`test_services.py`/`test_views.py`. Nenhuma mudança em `views.py`, `urls.py`, `services/tasks.py`, `services/logs.py`.
- **Contrato alterado:** `schema.yaml` (raiz do repo, **não** `backend/schema.yaml`), `frontend/src/api/types.gen.ts` — ambos **gerados**, nunca editados à mão.
- **Frontend alterado:** `frontend/src/features/bujo/api.ts` (interface `RecurringTemplateFields`), `frontend/src/features/bujo/components/RecurringTemplateManager.tsx` (+`.test.tsx`), `RecurringPlacementDialog.tsx` (+`.test.tsx`), `RecurringPlacementSection.tsx` (+`.test.tsx`). `frontend/src/features/bujo/types.ts` **não muda** (`RecurringTaskTemplate = components['schemas']['RecurringTaskTemplate']`, `TaskCategory` já existe — ambos captam `category` automaticamente após a regeneração).
- **Fronteiras:** mudanças contidas em `bujo/` (backend) + `features/bujo/` (frontend) + contrato na raiz/`api/`. Nenhum import novo cross-feature; nenhuma nova violação de ESLint boundary/import-linter esperada.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.12 (linhas 1009-1038 — ACs completas + nota de escopo backend+contrato+frontend); §Epic 11 intro (linha 757, "3º lote... Story 11.12")]
- [Source: _bmad-output/implementation-artifacts/11-8-infos-da-recorrencia-no-modal-de-placement.md (origem da questão aberta; AC4 "categoria estruturalmente ausente"; questão aberta ao Hugo com o escopo exato desta story, linhas 37-41, 110-121, 216-218)]
- [Source: backend/bujo/models.py:86-99 (`Task.Eisenhower`/`Task.Category` nested TextChoices); :115-120 (`Task.eisenhower`/`Task.category`, o padrão exato a espelhar); :174-197 (`RecurringTaskTemplate`, ponto de inserção do novo campo na linha 188-189)]
- [Source: backend/bujo/migrations/0002_task_category.py (precedente direto — `AddField` de `category` em `Task`); 0004_recurringtasktemplate_remove_task_source_template_id_and_more.py (última migração, dependency da nova)]
- [Source: backend/bujo/serializers.py:14-45 (`TaskSerializer`, padrão de `Meta.fields`); :62-83 (`TaskCreateSerializer`/`TaskUpdateSerializer.category`, padrão de `ChoiceField`); :249-292 (os 4 serializers de template — só os 3 primeiros ganham `category`)]
- [Source: backend/bujo/services/recurring.py (arquivo completo, 54 linhas) — `place_template` linhas 28-53, dict `common` linhas 36-41 (ponto exato de inserção)]
- [Source: backend/bujo/services/tasks.py:23-61 (`create_task`, já aceita/persiste `category` — nenhuma mudança necessária)]
- [Source: backend/bujo/views.py:176-241 (as 3 views de template, todas com `@extend_schema` — contrato flui dos serializers automaticamente)]
- [Source: backend/bujo/tests/factories.py:63-82 (`TaskFactory`, não declara `category` explicitamente — prova de que `RecurringTaskTemplateFactory`, linhas 85-96, também não precisa); backend/bujo/tests/test_models.py:77-91 (padrão de teste de categoria em `Task`, a espelhar para o template)]
- [Source: backend/bujo/tests/test_services.py:920-934 (`test_create_template_grava_campos_passados`), :971-993 (`test_place_template_weekly_cria_task_com_campos_esperados`, onde adicionar a asserção de `category`)]
- [Source: backend/bujo/tests/test_views.py:1655-1668 (`test_post_recurring_template_cria_e_retorna_201`), :1925-1934 (`test_patch_recurring_template_atualiza_e_retorna_200`)]
- [Source: .github/workflows/ci.yml:74 (comando exato de `manage.py spectacular`), :76-82 (gate de diff `types.gen.ts` vs `schema.yaml`); frontend/package.json:12 (`npm run generate-types`)]
- [Source: schema.yaml (raiz do repo, confirmado que existe e é o arquivo certo, não `backend/schema.yaml`)]
- [Source: frontend/src/api/types.gen.ts:400-409 (`CategoryEnum`), :467-474 (`PatchedRecurringTaskTemplateUpdate`, sem `category` hoje), :496-514 (`RecurringTaskTemplate`/`RecurringTaskTemplateCreate`, sem `category` hoje), :533-549 (`Task`, já com `category`, linha 540 — o shape-alvo pós-regeneração)]
- [Source: frontend/src/features/bujo/types.ts:6,7,16 (`TaskCategory`/`TaskEisenhower`/`RecurringTaskTemplate` — nenhuma mudança necessária, tipos derivados do contrato)]
- [Source: frontend/src/features/bujo/api.ts:17 (`TaskCategory` já importado), :425-474 (`RecurringTemplateFields` + as duas mutations, ponto de inserção na linha 428)]
- [Source: frontend/src/features/bujo/components/RecurringTemplateManager.tsx (arquivo completo, 258 linhas) — :21 (import a estender), :29-34 (`EISENHOWER_LABEL`, ponto de inserção do `CATEGORY_LABEL`), :133 (estado `eisenhower`, mirror para `category`), :145-164 (`handleSubmit`), :223-238 (`<Select>` de Eisenhower, padrão a mirrorar SEM o filtro de `'none'`), :42-121 (`TemplateRow`, decisão de não editar categoria inline)]
- [Source: frontend/src/features/bujo/components/TaskDetailPanel.tsx:19-26 (`CATEGORY_LABEL` canônico, fonte de verdade do padrão), :54 (estado `category`), :76 (persistência `category: category || null`), :119-131 (`<Select>` de categoria SEM filtro — o padrão certo a mirrorar, não o de Eisenhower deste componente)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementDialog.tsx (arquivo completo, 111 linhas) — :4 (import a estender), :7-15 (`EISENHOWER_LABEL`, convenção de comentário a espelhar), :60-79 (bloco de infos), :73-77 (linha de Eisenhower da Story 11.8, ponto de inserção da linha de categoria)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementSection.tsx (arquivo completo, 107 linhas) — :64-104 (`.map` de templates, sem exibição de Eisenhower hoje — decisão desta story de adicionar categoria mesmo assim, Dev Notes acima)]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx:169-170 (`theme.palette.category[category]`, usado como borda colorida — referência para uma eventual variante de chip/swatch, não obrigatória)]
- [Source: frontend/src/theme.ts:27-56,76-82,122-129 (`CategoryPalette`, tokens de cor, wiring — já existe e não precisa de mudança)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx:17-24 (fixture `TEMPLATE`, a estender com `category: null`)]
- [Source: frontend/e2e/recurring-templates.spec.ts (spec e2e existente de CRUD + placement — verificar se sobrevive à mudança de UI, sem exigir cenário novo dedicado)]
- [Source: _bmad/custom/bmad-dev-story.toml (guardrails de retrospectiva: contagem de teste real sem escopo de path, File List por último nomeando artefatos novos, resolução de ambiguidade de spec documentada inline — todos citados acima onde relevantes)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

Nenhum debug de fluxo quebrado — implementação seguiu o padrão `eisenhower` ponto a ponto (modelo → migração → serializers → placement → contrato → CRUD → placement UI) sem desvios em relação ao planejado nas Tasks.

### Completion Notes List

- Task 1-4 (backend): campo `category` adicionado a `RecurringTaskTemplate` espelhando exatamente `eisenhower` (mesma posição, mesmo `noqa: DJ001`, nulável). Migração `0005_recurringtasktemplate_category.py` autogerada pelo Django (`makemigrations bujo`), forma idêntica ao precedente `0002_task_category.py` — só `AddField`, sem backfill. Os 3 serializers de template ganharam `category` na mesma posição relativa de `eisenhower`. `place_template` passou a copiar `category=template.category` no dict `common`; `create_task`/`create_template`/`update_template` não precisaram de nenhuma mudança (confirmado por leitura, conforme Dev Notes).
- Task 5 (testes de backend): estendidos `test_create_template_grava_campos_passados` e `test_place_template_weekly_cria_task_com_campos_esperados` com `category`; testes novos: `test_recurring_task_template_category_aceita_as_6_choices_validas` (parametrizado, 6 casos), `test_recurring_task_template_category_aceita_null`, `test_place_template_sem_category_cria_task_sem_categoria` (AC6, regressão), `test_patch_recurring_template_atualiza_category_e_retorna_200`. `ruff check .`, `lint-imports` e `manage.py check` verdes. **Suíte completa real (sem escopo de path)**: `uv run pytest -q` → **377 passed** (baseline pós-11.11 era 368 passed; +9 testes novos desta story, contagem bate exatamente). 1 warning de teardown (`database "test_neondb" is being accessed by other users`) — flake de infraestrutura do Neon durante o teardown paralelo dos testes, não uma falha de teste; todos os 377 testes passaram.
- Task 6 (contrato): `manage.py spectacular --file ../schema.yaml` e `npm run generate-types` rodados a partir de `backend/`/`frontend/` respectivamente (mesmos comandos do CI). `git diff` confirma `category` nos 3 tipos de template (`RecurringTaskTemplate`, `RecurringTaskTemplateCreate`, `PatchedRecurringTaskTemplateUpdate`) em `schema.yaml` e `types.gen.ts`, no mesmo formato que `eisenhower` já tinha (union com `CategoryEnum`/`NullEnum`, e `BlankEnum` no tipo de leitura/update). Únicos warnings do `spectacular` são pré-existentes (`accounts/views.py` signup sem serializer, `ToStatusEnum` duplicado) — não relacionados a esta story.
- Task 7-9 (frontend): `RecurringTemplateFields.category?` adicionado em `api.ts`. `RecurringTemplateManager.tsx` ganhou `CATEGORY_LABEL`, estado `category`, `<Select aria-label="Categoria">` sem filtro de sentinela (categoria não tem `'none'`), e o campo no payload/reset do form. **Decisão registrada (Task 11.1, leitura da AC3 "persistida e exibida na listagem")**: favoreci a leitura literal e adicionei também uma linha "Categoria: …" em `TemplateRow` (a listagem em si), não só no formulário de criação — custo marginal (uma `Typography` condicional), evita reabrir a AC numa story futura. `RecurringPlacementDialog.tsx` e `RecurringPlacementSection.tsx` ganharam a mesma linha condicional (`CATEGORY_LABEL` duplicado localmente em cada um, convenção já estabelecida pelo Eisenhower) — a AC4 do épico cita os dois componentes nominalmente, ao contrário da Story 11.8 que só tocou o Dialog.
- Task 10 (testes de frontend): 4 asserções existentes em `RecurringTemplateManager.test.tsx` precisaram de `category: null` adicionado ao payload esperado (o `handleSubmit` agora sempre inclui o campo) — não é regressão, é o novo comportamento correto. Testes novos: criação com categoria (payload), exibição/ausência de categoria em `TemplateRow`, em `RecurringPlacementDialog` (`it.each` com 3 cores + caso ausente) e em `RecurringPlacementSection`. `npm run typecheck`, `npm run lint`, `npm run build` verdes. **Suíte completa real**: `npx vitest run --no-file-parallelism` → **551 passed (45 arquivos)** (baseline pós-11.11 era 538 passed/45 arquivos; +13 testes novos, incluindo os `it.each` expandidos).
- Task 11 (verificação manual): rodei a app real (backend `manage.py runserver` contra a branch Neon `dev`, frontend `npm run dev`) e dirigi um script Playwright ad-hoc (não commitado, descartado após uso) cobrindo o fluxo ponta-a-ponta: criar template com categoria → aparece em `TemplateRow` (AC3) → aparece em `RecurringPlacementSection` e `RecurringPlacementDialog` (AC4) → colocar o template → a `Task` resultante nasce com `category: 'teal'`, editável em `TaskDetailPanel` (AC5) → criar template sem categoria não quebra nada (AC6). Zero erros de console. Screenshots confirmam visualmente os 3 pontos (listagem, dialog, detail panel). **`frontend/e2e/recurring-templates.spec.ts` não foi executado contra a branch Neon `e2e`** (cold-start caro, e a Task 11.5 explicitamente não exige isso) — análise estática do spec confirma que ele só interage com o Select de Eisenhower por `aria-label`/`role=option` nomeados, sem seletor posicional que colidiria com o novo `<Select aria-label="Categoria">` inserido entre Eisenhower e Recorrência; a verificação manual via Playwright ad-hoc acima exercitou o mesmo fluexo (CRUD + placement) sem quebra.
- **Reconciliação final (File List)**: `git status --short` + `git diff --stat` conferidos como ÚLTIMA etapa, depois da verificação manual — nenhum arquivo fora do previsto no Dev Notes/Git Intelligence da story. `schema.yaml` (raiz) e `frontend/src/api/types.gen.ts` estão no diff, como esperado (exceção desta story ao padrão do 2º lote).

### File List

- `backend/bujo/models.py`
- `backend/bujo/migrations/0005_recurringtasktemplate_category.py` (novo)
- `backend/bujo/serializers.py`
- `backend/bujo/services/recurring.py`
- `backend/bujo/tests/test_models.py`
- `backend/bujo/tests/test_services.py`
- `backend/bujo/tests/test_views.py`
- `schema.yaml` (raiz do repo)
- `frontend/src/api/types.gen.ts`
- `frontend/src/features/bujo/api.ts`
- `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`
- `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx`
- `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`
- `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx`
- `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`
- `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx`

*`_bmad-output/planning-artifacts/epics.md` e `_bmad-output/story-automator/orchestration-11-20260716-015115.md` aparecem modificados no working tree desde antes do início desta sessão — fora do escopo desta story, não tocados por ela.*

## Change Log

- **2026-07-16** — Implementação completa (Tasks 1-11). Fecha a questão em aberto da Story 11.8: `RecurringTaskTemplate` ganha `category` (reusa `Task.Category`, sem enum novo), seguindo ponto a ponto o padrão já estabelecido por `eisenhower` no mesmo modelo. Única decisão de escopo registrada: `TemplateRow` (listagem do CRUD) também passou a exibir "Categoria: …", além do formulário de criação — leitura literal da AC3 ("persistida e exibida na listagem"), favorecendo o texto mais específico (prática institucionalizada pela retro do Epic 4 #3). Nenhuma mudança de escopo além do especificado; todas as ACs (1-6) satisfeitas. Backend 377 passed, frontend 551 passed (45 arquivos).
- **2026-07-16** — Code review (AI, adversarial) concluído: 0 issues HIGH/MEDIUM/LOW após verificação exaustiva. Status → done.

## Senior Developer Review (AI)

**Reviewer:** HugoMMBrito (via story-automator review, adversarial) — 2026-07-16

**Escopo verificado:** git vs File List, as 6 ACs contra o código real (não só contra a Completion Notes), suítes de teste completas (sem escopo de path), lint/typecheck/build.

### Git vs Story File List

Nenhuma discrepância. `git status --porcelain`/`git diff --name-only` batem exatamente com o File List da story. Os 3 arquivos extras no working tree (`sprint-status.yaml`, `epics.md`, `orchestration-11-...md`) já estão corretamente marcados na story como fora de escopo desta story.

### AC-by-AC (lido direto do código, não da Completion Notes)

- **AC1** — `backend/bujo/models.py:189-191`: campo `category` no mesmo formato/posição de `eisenhower`, reusa `Task.Category` (sem enum novo). ✅
- **AC2** — Migração `0005_recurringtasktemplate_category.py` (dependência correta em `0004`, `AddField` isolado, forma idêntica ao precedente `0002_task_category.py`); os 3 serializers de template (`serializers.py:257,270-272,286-288`) ganharam `category` na posição certa; `schema.yaml`/`types.gen.ts` regenerados com o mesmo shape que `eisenhower` já tinha (`CategoryEnum`/`BlankEnum`/`NullEnum`, conferido campo a campo nos 3 tipos de template). ✅
- **AC3** — `RecurringTemplateManager.tsx`: `<Select aria-label="Categoria">` sem sentinela (correto — categoria não tem `'none'`), payload inclui `category: category || null`, `TemplateRow` exibe "Categoria: …" condicionalmente. ✅
- **AC4** — `RecurringPlacementDialog.tsx`/`RecurringPlacementSection.tsx`: linha "Categoria: …" com guard `template.category &&` (sem placeholder), `component="div"` presente (guardrail do Epic 11 2º lote respeitado). ✅
- **AC5** — `services/recurring.py:40`: `category=template.category` no dict `common` de `place_template`; nenhuma trava em `create_task`/`TaskDetailPanel` impede edição posterior (confirmado por leitura — não há nenhum campo/constraint ligando `category` a `source_template`). ✅
- **AC6** — `test_place_template_sem_category_cria_task_sem_categoria` cobre a regressão; comportamento confirmado por leitura de `place_template` (cópia direta do valor, `None` permanece `None`). ✅

### Verificação de execução real (não só leitura)

- Backend: `ruff check .`, `lint-imports`, `manage.py check` — todos verdes. `uv run pytest -q` (suíte completa, sem escopo de path) → **377 passed, 1 warning** (warning de teardown do Neon, mesmo flake de infra já registrado na Completion Notes) — bate exatamente com o valor reportado pelo dev agent.
- Frontend (Node 22): `npm run typecheck`, `npm run lint`, `npm run build` — todos verdes. `npx vitest run --no-file-parallelism` → **551 passed (45 arquivos)** — bate exatamente com o valor reportado.

### Achados

Nenhum issue CRITICAL/HIGH/MEDIUM/LOW encontrado após verificação linha a linha de todos os arquivos do File List contra as ACs e contra os precedentes (`eisenhower`, `Task.category`) que a story determinou espelhar. Hipóteses investigadas e descartadas por verificação empírica (não por suposição):
- Comportamento de `Field.get_default()` do Django para `CharField(null=True)` sem `category` no kwarg de `.create()` — confirmado via `manage.py shell` que retorna `None`, não `""` (checado porque afetaria tanto `category` quanto o precedente `eisenhower`).
- Colisão do novo `<Select aria-label="Categoria">` com o e2e spec (`recurring-templates.spec.ts`) — confirmado que o spec seleciona só por `aria-label`/`role=option` nomeados do Eisenhower, sem seletor posicional.

**Nota não-bloqueante (FYI, não corrigida):** o AC3 do épico (`epics.md`) menciona "crio/edito um template"; a story e a implementação cobrem só a criação (`TemplateRow` em modo de edição inline não ganhou seletor de categoria) — decisão já registrada e justificada na própria story (Task 8.6, mesmo precedente de `eisenhower` que também não é editável inline). Não tratado como defeito: é uma decisão de escopo pré-aprovada na story, não uma lacuna introduzida pelo dev.

**Outcome:** Approved. 0 issues fixed (nenhum encontrado). Status → done.
