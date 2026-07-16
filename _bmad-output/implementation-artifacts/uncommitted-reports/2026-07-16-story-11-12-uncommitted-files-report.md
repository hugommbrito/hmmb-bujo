# Explicação dos arquivos não commitados - Story 11.12 (Categoria em templates recorrentes)

## Visão geral

Story do **3º lote do Épico 11** (Correct Course 2026-07-16), diferente das Stories 11.7–11.11 (só-frontend): esta **muda schema**. Adiciona um campo `category` opcional a `RecurringTaskTemplate`, reusando o enum já existente `Task.Category` (teal/purple/pink/yellow/green/blue) — sem criar um enum novo. O campo percorre exatamente o mesmo caminho que `eisenhower` já percorre no mesmo modelo:

1. Modelo (`models.py`) → migração Django nova → 3 serializers de template (`RecurringTaskTemplateSerializer`/`…CreateSerializer`/`…UpdateSerializer`).
2. Regeneração do contrato OpenAPI (`schema.yaml` na raiz) e dos tipos TS gerados (`frontend/src/api/types.gen.ts`).
3. `place_template` (serviço de placement) passa a copiar `category` do template para a `Task` gerada — mesmo padrão já usado para `title`/`description`/`eisenhower`.
4. Frontend: payload da mutation (`api.ts`), seletor de categoria no CRUD de templates (`RecurringTemplateManager.tsx`, incluindo exibição na listagem `TemplateRow`) e uma linha condicional "Categoria: …" nas duas superfícies de placement (`RecurringPlacementDialog.tsx` e `RecurringPlacementSection.tsx` — a AC4 do épico cita os dois componentes nominalmente, ao contrário da Story 11.8 que só tocou o Dialog).
5. Testes em todas as camadas acima.

Fecha uma questão em aberto registrada na Story 11.8 (o modal de placement não podia exibir "categoria" porque o template estruturalmente não tinha esse campo). Código revisado adversarialmente (code review) com **0 issues** encontrados; status da story: `done`.

Dois arquivos do conjunto (`epics.md`, log do orquestrador `orchestration-11-...md`) são mudanças **pré-existentes no working tree, fora do escopo desta story** — a própria story já os documenta como tal (File List, nota final).

## Ordem lógica de funcionamento

1. Artefatos de rastreamento/planejamento (sprint status, epics, log do orquestrador, arquivo da story).
2. Modelo de dados e migração (`models.py`, `0005_...category.py`).
3. Serializers (contrato Python/DRF).
4. Serviço de placement (`recurring.py`) — consome o campo do modelo/serializer.
5. Contrato gerado (`schema.yaml`, `types.gen.ts`) — gerado a partir do que os passos 2-3 produziram.
6. Camada de dados do frontend (`api.ts`) — consome os tipos gerados no passo 5.
7. Componentes de UI (`RecurringTemplateManager.tsx`, `RecurringPlacementDialog.tsx`, `RecurringPlacementSection.tsx`).
8. Testes, por camada (backend: models/services/views; frontend: os 3 componentes).

## 1. Artefatos de rastreamento e planejamento

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Função geral do arquivo**

Rastreamento de status por story/épico do sprint (YAML lido pelas skills BMAD).

**Função geral da alteração**

- `last_updated` (comentário) passa de "epic-11 retrospectiva (2ª passada, 11.7-11.11) concluída; epic-11 → done" para "Story 11.12 revisada (code review) — done".
- `epic-11: done` → `epic-11: in-progress` (comentário: "3º lote... Story 11.12 adicionada; 11.1–11.11 concluídas").
- Nova entrada `11-12-categoria-em-templates-recorrentes: done`.
- `epic-11-retrospective: done` → `epic-11-retrospective: optional` (comentário: retros anteriores mantidas, reaberto para o 3º lote).

Nenhuma outra entrada do arquivo muda.

### `_bmad-output/planning-artifacts/epics.md`

**Fora do escopo desta story — resumo em alto nível.** Diff acrescenta um bloco novo (33 linhas) descrevendo a Story 11.12 dentro do Épico 11: nota de abertura do "3º lote" (origem: questão aberta da Story 11.8 + decisão do Hugo via Correct Course) e a redação completa da story (As a/I want/So that + 6 ACs + nota de escopo backend+contrato+frontend). Este arquivo já vinha modificado no working tree **antes do início da sessão desta story** (é a própria fonte de onde a story foi extraída) — a story-file documenta explicitamente essa mudança como pré-existente e fora do seu escopo de implementação. Não há necessidade de análise linha a linha adicional.

### `_bmad-output/story-automator/orchestration-11-20260716-015115.md`

**Fora do escopo desta story — resumo em alto nível.** Log de orquestração do story-automator (front-matter YAML + log cronológico em texto). Diff: `status` `IN_PROGRESS` → `COMPLETE`, `currentStep` → `step-04-wrapup`, `lastUpdated` avançado, e 3 novas linhas de log cronológico registrando a conclusão da retrospectiva do Épico 11 (commit `9088d37`) e o andamento da Story 11.12 (create/dev/review). Mesmo caso do `epics.md`: artefato de orquestração pré-existente, apenas registra o que já aconteceu; não é implementação da story em si.

### `_bmad-output/implementation-artifacts/11-12-categoria-em-templates-recorrentes.md` (novo, untracked)

**Função geral do arquivo**

Arquivo de story no formato BMAD: Story (As a/I want/So that), 6 Acceptance Criteria, Tasks/Subtasks detalhadas por camada, Dev Notes (justificativa e referências linha-a-linha), Dev Agent Record (Completion Notes, File List), Change Log e uma seção **Senior Developer Review (AI)** completa.

**Função geral da alteração**

Arquivo inteiramente novo. Conteúdo relevante para o restante deste relatório:

- **ACs 1-6**: campo `category` opcional reusando `Task.Category`; migração+serializers+regeneração de contrato; seletor no CRUD; exibição no placement (Dialog **e** Section); herança pela `Task` colocada (editável depois); template sem categoria não regride.
- **Dev Agent Record / Completion Notes**: registra contagens reais de teste — backend `377 passed` (baseline pós-11.11 era 368, +9), frontend `551 passed / 45 arquivos` (baseline era 538, +13) — e uma decisão de escopo explícita: a AC3 ("persistida e **exibida na listagem**") foi lida literalmente, por isso `TemplateRow` (não só o formulário de criação) também ganhou a linha "Categoria: …".
- **Senior Developer Review**: revisão adversarial concluída com **0 issues** CRITICAL/HIGH/MEDIUM/LOW; confirma AC-a-AC contra o código real (não só contra as Completion Notes); reexecutou as suítes completas e bateu os mesmos números (377/551); uma nota FYI não-bloqueante sobre edição inline de categoria em `TemplateRow` não estar coberta (decisão de escopo pré-aprovada, mesmo padrão do campo irmão `eisenhower`).
- **File List** já reconciliada contra `git status`/`git diff --stat` reais — bate exatamente com o conjunto de arquivos deste relatório.

Este é o artefato de rastreamento da story; não contém código executável.

## 2. Modelo de dados e migração

### `backend/bujo/models.py`

**Função geral do arquivo**

Modelos Django do app `bujo` (multi-tenant via `TenantModel`) — `Task`, `Log`/`WeeklyLog`/`MonthlyLog`, `RecurringTaskTemplate`, etc.

**Função geral da alteração**

Adiciona um único campo, `category`, à classe `RecurringTaskTemplate` (linhas 174-197 no diff base), logo após `eisenhower` e antes de `recurrence_group` — mesma posição relativa usada em `Task` entre `eisenhower` e `category` (linhas ~115-120).

**Blocos principais**

- Linha 189-191 (novo bloco):
  ```python
  category = models.CharField(  # noqa: DJ001 - mesma semântica nulável de Task.category
      max_length=8, choices=Task.Category.choices, null=True, blank=True
  )
  ```

**Funções, classes e importações específicas**

- `Task.Category` (classe `TextChoices` já existente, definida dentro de `Task`, linhas 91-99: `TEAL`/`PURPLE`/`PINK`/`YELLOW`/`GREEN`/`BLUE`) — reusada diretamente como `choices`, sem duplicar o enum. `Task` já é a classe anterior no mesmo módulo, nenhum import novo necessário.
- `RecurringTaskTemplate.category`: mesmo shape de `Task.category` (`CharField(max_length=8, null=True, blank=True)`) — nulo/vazio é um valor válido ("sem categoria").

**Comportamento de libs usadas**

- Django `models.CharField(null=True, blank=True, choices=...)`: gera coluna `varchar(8)` nulável no banco; `blank=True` só afeta validação de formulário/admin (não a coluna); `choices` restringe os valores aceitos pelos serializers/admin, não pelo banco em si (checagem em nível de aplicação/DRF, não `CHECK` constraint).

### `backend/bujo/migrations/0005_recurringtasktemplate_category.py` (novo)

**Função geral do arquivo**

Migração Django autogerada (`makemigrations bujo`), dependente de `0004_recurringtasktemplate_remove_task_source_template_id_and_more`.

**Função geral da alteração**

Único arquivo novo do backend. Contém uma única operação:

```python
migrations.AddField(
    model_name='recurringtasktemplate',
    name='category',
    field=models.CharField(blank=True, choices=[('teal', 'Teal'), ('purple', 'Purple'), ('pink', 'Pink'), ('yellow', 'Yellow'), ('green', 'Green'), ('blue', 'Blue')], max_length=8, null=True),
),
```

**Blocos principais**

- `dependencies`: aponta para `0004_...` (última migração antes desta) — cadeia de migração correta.
- `operations`: `AddField` isolado, sem `RunPython`/backfill — campo novo nulável, todas as linhas existentes de `RecurringTaskTemplate` recebem `category=NULL` automaticamente. Mesmo formato do precedente direto `0002_task_category.py` (que adicionou `category` a `Task`), só trocando `model_name`.

**Comportamento de libs usadas**

- `migrations.AddField`: operação idempotente de DDL (`ALTER TABLE ... ADD COLUMN`); como o campo é nulável e sem `default` não-nulo, não exige varredura/backfill da tabela existente.

## 3. Serializers (contrato Python/DRF)

### `backend/bujo/serializers.py`

**Função geral do arquivo**

Serializers DRF do app `bujo`, incluindo os 4 serializers de `RecurringTaskTemplate` (`RecurringTaskTemplateSerializer`, `...CreateSerializer`, `...UpdateSerializer`, `...PlaceSerializer`).

**Função geral da alteração**

Adiciona `category` aos 3 serializers de leitura/criação/atualização de template (não ao `PlaceSerializer`, que só lida com parâmetros de data de placement).

**Blocos principais**

- `RecurringTaskTemplateSerializer.Meta.fields`: `"category",` inserido logo após `"eisenhower",` (é um `ModelSerializer` — nenhuma outra mudança necessária, o DRF introspecta `null`/`choices` diretamente do modelo).
- `RecurringTaskTemplateCreateSerializer`: campo explícito adicionado logo após o bloco de `eisenhower`:
  ```python
  category = serializers.ChoiceField(
      choices=Task.Category.choices, required=False, allow_null=True
  )
  ```
- `RecurringTaskTemplateUpdateSerializer`: mesmo campo, mesma posição relativa (após `eisenhower`).

**Funções, classes e importações específicas**

- `serializers.ChoiceField(choices=..., required=False, allow_null=True)`: campo opcional que aceita `null` — mesmo padrão já usado por `TaskCreateSerializer.category`/`TaskUpdateSerializer.category`. `required=False` permite omitir o campo no payload (template sem categoria); `allow_null=True` permite enviar `category: null` explicitamente.

**Comportamento de libs usadas**

- DRF `ModelSerializer` com `Meta.fields`: para campos declarados no modelo (`RecurringTaskTemplateSerializer`), basta listar o nome em `fields` — tipo, `null`/`blank`, e `choices` são inferidos automaticamente do model field.
- DRF `Serializer` "plano" (não `ModelSerializer`, caso de `Create`/`UpdateSerializer`): cada campo precisa ser declarado explicitamente, por isso o `ChoiceField` manual nos dois casos.

## 4. Serviço de placement

### `backend/bujo/services/recurring.py`

**Função geral do arquivo**

Serviço de domínio para templates recorrentes: `create_template`, `update_template`, `place_template` (função central — único ponto do código que cria uma `Task` a partir de um `RecurringTaskTemplate`, confirmado por leitura exaustiva; não há cron/Celery/management command de auto-placement).

**Função geral da alteração**

Uma linha adicionada dentro de `place_template`, no dict `common` (campos comuns copiados do template para a `Task` nova, independente do grupo de recorrência — weekly/monthly/annual):

```python
common = dict(
    title=template.title,
    description=template.description,
    eisenhower=template.eisenhower,
    category=template.category,   # <- linha nova
    source_template=template,
)
```

**Blocos principais**

- `common` é repassado via `**common` para `create_task` (em `services/tasks.py`), que já aceita `category` como kwarg nomeado e já o persiste em `Task.objects.create(...)` — nenhuma mudança necessária nesse arquivo (confirmado por leitura, não reimplementado).

**Funções, classes e importações específicas**

- `place_template(user, template_id, ...)`: função de serviço que resolve o template, monta `common`, e delega a criação da `Task` conforme o `recurrence_group`. A mudança garante que `category=None` (template sem categoria) resulta em `Task.category=None` — sem regressão (comportamento coberto por teste dedicado, ver seção de testes).

## 5. Contrato gerado (OpenAPI + tipos TS)

### `schema.yaml` (raiz do repo)

**Função geral do arquivo**

Especificação OpenAPI gerada por `drf-spectacular` (`manage.py spectacular --file ../schema.yaml`), fonte única de verdade do contrato API consumida por `openapi-typescript` no frontend.

**Função geral da alteração**

Arquivo gerado — resumido por schema/campo, sem inspeção linha a linha manual. Os 3 schemas de template (`RecurringTaskTemplate`, `RecurringTaskTemplateRequest`/Create, `PatchedRecurringTaskTemplateUpdateRequest`) ganham a propriedade `category`, cada um com o `oneOf` correspondente:

- Leitura (`RecurringTaskTemplate`) e criação: `category: { nullable: true, oneOf: [CategoryEnum, NullEnum] }`.
- Update parcial (`Patched...`): `category: { nullable: true, oneOf: [CategoryEnum, BlankEnum, NullEnum] }` (aceita também string vazia, mesmo padrão de PATCH parcial já usado por `eisenhower`).

Mesmo shape que `eisenhower` já tinha nos mesmos 3 schemas — `category` é adicionado logo abaixo de `eisenhower` em cada bloco.

**Comportamento de libs usadas**

- `drf-spectacular`: introspecção automática dos serializers DRF (Seção 3) para gerar o schema OpenAPI; `CategoryEnum` já existia no contrato (usado por `Task.category`) e é reaproveitado, nenhum enum novo é gerado.

### `frontend/src/api/types.gen.ts`

**Função geral do arquivo**

Tipos TypeScript gerados a partir de `schema.yaml` via `openapi-typescript` (`npm run generate-types`) — nunca editado à mão.

**Função geral da alteração**

Espelha exatamente as 3 adições do `schema.yaml`: `category?: (components["schemas"]["CategoryEnum"] | components["schemas"]["NullEnum"]) | null` nos tipos de leitura/criação, e a variante com `BlankEnum` adicional no tipo de update parcial (`PatchedRecurringTaskTemplateUpdate`). Cada linha nova é inserida imediatamente após a linha equivalente de `eisenhower` no mesmo tipo.

**Comportamento de libs usadas**

- `openapi-typescript`: gera interfaces TS 1:1 com os schemas OpenAPI; um `oneOf` com `NullEnum` vira união com `null` no TS. É consumido a seguir por `frontend/src/features/bujo/types.ts` (não alterado nesta story — `RecurringTaskTemplate`/`TaskCategory` já são aliases derivados desses tipos gerados, então captam `category` automaticamente sem mudança própria).

## 6. Camada de dados do frontend

### `frontend/src/features/bujo/api.ts`

**Função geral do arquivo**

Camada de acesso a dados do feature `bujo`: funções de request + hooks TanStack Query (`useCreateRecurringTemplateMutation`, `useUpdateRecurringTemplateMutation`, etc.).

**Função geral da alteração**

Uma linha adicionada à interface `RecurringTemplateFields` (payload de criar/editar template):

```ts
interface RecurringTemplateFields {
  title: string
  description?: string | null
  eisenhower?: TaskEisenhower | null
  category?: TaskCategory | null   // <- linha nova
  recurrenceGroup: RecurrenceGroup
  recurrenceText: string
  active?: boolean
}
```

**Funções, classes e importações específicas**

- `TaskCategory`: tipo já importado no topo do arquivo (usado por `Task`), reaproveitado sem import novo.
- `createRecurringTemplate`/`updateRecurringTemplate` (e os hooks de mutation correspondentes) já repassam o objeto de fields inteiro ao `client.post`/`client.patch` — adicionar o campo à interface é suficiente para os dois payloads passarem a incluir `category` quando presente; nenhuma outra função precisou mudar.

## 7. Componentes de UI

### `frontend/src/features/bujo/components/RecurringTemplateManager.tsx`

**Função geral do arquivo**

CRUD de templates recorrentes (aba "Recorrentes" do Planner): formulário de criação + `TemplateRow` (listagem/edição inline por template).

**Função geral da alteração**

Três frentes: (1) mapa de rótulos `CATEGORY_LABEL`; (2) seletor de categoria no formulário de criação; (3) exibição condicional da categoria na linha de leitura (`TemplateRow`).

**Blocos principais**

- Import: `TaskCategory` adicionado ao `import type { RecurrenceGroup, RecurringTaskTemplate, TaskEisenhower } from '../types'`.
- Novo `CATEGORY_LABEL: Record<TaskCategory, string>` (teal/purple/pink/yellow/green/blue), logo após `EISENHOWER_LABEL` — **sem** filtrar nenhum valor (diferente de `EISENHOWER_LABEL`, que oculta `'none'`; categoria não tem sentinela, todo valor do enum é uma cor real).
- Dentro de `TemplateRow` (linha de leitura), bloco novo condicional logo após a descrição truncada:
  ```tsx
  {template.category && (
    <Typography variant="body-sm" color="text.secondary" component="div">
      Categoria: {CATEGORY_LABEL[template.category]}
    </Typography>
  )}
  ```
  Comentário no código documenta a decisão de leitura da AC3 ("persistida e exibida na listagem" → também na `TemplateRow`, não só no formulário).
- Novo estado `const [category, setCategory] = useState<TaskCategory | ''>('')`, junto de `eisenhower`.
- Novo `<Select displayEmpty aria-label="Categoria">` no formulário, com `<MenuItem value="">Nenhuma</MenuItem>` + uma opção por valor de `CATEGORY_LABEL`, inserido entre o `<Select>` de Eisenhower e o `TextField` de "Recorrência (texto livre)".
- `handleSubmit`: `category: category || null,` adicionado ao payload de `createTemplate.mutate({...})`; `setCategory('')` adicionado ao reset pós-submit.

**Funções, classes e importações específicas**

- `TemplateRow` (componente interno): view de leitura de um template; não ganhou edição inline de categoria (decisão de escopo registrada — mesmo padrão do campo irmão `eisenhower`, que também não é editável inline).
- `CATEGORY_LABEL`: 4ª/5ª cópia local do mesmo mapa (já duplicado em `TaskDetailPanel.tsx` e, agora, também em `RecurringPlacementDialog.tsx`/`RecurringPlacementSection.tsx`) — convenção já vigente no código, sem extração de módulo compartilhado nesta story.

**Comportamento de libs usadas**

- MUI `<Select displayEmpty>`: permite exibir um valor vazio (`''`) sem colapsar a label; `inputProps={{ 'aria-label': 'Categoria' }}` é o hook usado pelos testes (`getByRole('combobox', { name: 'Categoria' })`).

### `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`

**Função geral do arquivo**

Modal de placement de um template recorrente (colocar/gerar uma `Task` a partir dele) em um período (Semana/Mês/Future), com calendário de densidade (`MonthDensityCalendar`).

**Função geral da alteração**

Adiciona a exibição condicional "Categoria: …" junto às demais infos do template (título/descrição/"Prioridade: …"/"Recorrência: …").

**Blocos principais**

- Import: `TaskCategory` adicionado a `import type { RecurringTaskTemplate, TaskCategory } from '../types'`.
- Novo `CATEGORY_LABEL` local (mesmo mapa das 6 cores, comentário no código explicando a ausência de sentinela `'none'`).
- Novo bloco, dentro do `{template && (<Box>...)}`, logo após a linha de Eisenhower (adicionada pela Story 11.8):
  ```tsx
  {template.category && (
    <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
      Categoria: {CATEGORY_LABEL[template.category]}
    </Typography>
  )}
  ```

**Comportamento de libs usadas**

- `component="div"` em `Typography variant="body-sm"`: guardrail explícito herdado da retrospectiva do Épico 11 (2º lote) — sem esse atributo, um bug HIGH recorrente fazia o truncamento/renderização de bloco falhar silenciosamente apesar de testes verdes.

### `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`

**Função geral do arquivo**

Lista de templates recorrentes "colocáveis" no período atual (sugestões antes de abrir o modal de placement), com dedup "(já colocado)".

**Função geral da alteração**

Mesma adição do Dialog: `CATEGORY_LABEL` local + linha condicional "Categoria: …" dentro do `.map(template => ...)`, logo após o bloco de descrição.

**Blocos principais**

- Import: `TaskCategory` adicionado.
- `CATEGORY_LABEL` (mesma duplicação, mesmo comentário sobre ausência de sentinela).
- Bloco novo:
  ```tsx
  {template.category && (
    <Typography variant="body-sm" color="text.secondary" component="div">
      Categoria: {CATEGORY_LABEL[template.category]}
    </Typography>
  )}
  ```

**Nota de decisão**: diferente da Story 11.8 (que só tocou o Dialog, porque a Section nunca exibiu Eisenhower e a AC da 11.8 não a citava), a AC4 desta story cita nominalmente os dois componentes — por isso a Section também ganhou a linha, mesmo sendo custo marginal (uma linha a mais).

## 8. Testes

### `backend/bujo/tests/test_models.py`

Dois testes novos para `RecurringTaskTemplate.category`, mesmo padrão dos testes equivalentes de `Task.category`:
- `test_recurring_task_template_category_aceita_as_6_choices_validas` (parametrizado com `Task.Category.values`, 6 casos).
- `test_recurring_task_template_category_aceita_null`.

### `backend/bujo/tests/test_services.py`

- `test_create_template_grava_campos_passados`: estendido para passar/assertar `category=Task.Category.TEAL`.
- `test_place_template_weekly_cria_task_com_campos_esperados`: estendido para incluir `category=Task.Category.TEAL` no template e assertar `task.category == Task.Category.TEAL` (AC5 — herança na Task colocada).
- Novo: `test_place_template_sem_category_cria_task_sem_categoria` — regressão explícita da AC6: template com `category=None` → `Task` colocada com `category is None`.

### `backend/bujo/tests/test_views.py`

- `test_post_recurring_template_cria_e_retorna_201`: payload passa a incluir `"category": "teal"`, com asserção `response.data["category"] == "teal"`.
- Novo: `test_patch_recurring_template_atualiza_category_e_retorna_200` — PATCH só de `category` (`None` → `"purple"`) retorna 200 com o valor atualizado.

### `frontend/src/features/bujo/components/RecurringTemplateManager.test.tsx`

- 4 asserções de payload existentes (criação semanal/mensal/anual, "com detalhes") passaram a incluir `category: null` — não é regressão, é consequência de `handleSubmit` agora sempre incluir o campo.
- Novo: "criar com categoria repassa esse campo no payload" — abre o `<Select aria-label="Categoria">` via `fireEvent.mouseDown`/`click` em uma opção, assertando `category: 'teal'` no mock da mutation.
- Novos: "a linha do template exibe a categoria quando presente" / "template sem categoria não mostra linha ruidosa" — cobrindo a exibição condicional em `TemplateRow`.

### `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx`

- Fixture `TEMPLATE` ganha `category: null` explícito (não regride os testes existentes — `null` é falsy/não-exibido).
- Novo `it.each` com 3 cores (`teal`/`purple`/`pink`) assertando `"Categoria: <Label>"` visível.
- Novo teste assertando ausência da linha quando `category` é `null` (fixture default).

### `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx`

- Par equivalente de casos: exibe "Categoria: Teal" quando o template tem `category: 'teal'`; não exibe linha quando o template não tem categoria.

## Verificação (contagens reais reportadas na story, não reexecutadas por este relatório)

- Backend: `ruff check .`, `lint-imports`, `manage.py check` verdes; `uv run pytest -q` (suíte completa, sem escopo de path) → **377 passed** (baseline pós-11.11: 368; +9 testes novos desta story). Um warning de teardown do Neon registrado como flake de infraestrutura, não falha de teste.
- Frontend (Node 22): `npm run typecheck`, `npm run lint`, `npm run build` verdes; `npx vitest run --no-file-parallelism` → **551 passed (45 arquivos)** (baseline pós-11.11: 538/45; +13 testes novos).
- Code review adversarial (Senior Developer Review, dentro do arquivo da story): **0 issues** CRITICAL/HIGH/MEDIUM/LOW após verificação AC-a-AC contra o código real e reexecução das duas suítes completas, batendo os mesmos números.
- Esta verificação **não foi reexecutada** na produção deste relatório — os números acima vêm do próprio arquivo da story/review, conforme instrução de não rodar suítes/linters neste passo.

Nenhum código-fonte foi alterado ao produzir este relatório; nenhuma mudança pré-existente (`epics.md`, log do orquestrador) foi revertida.
