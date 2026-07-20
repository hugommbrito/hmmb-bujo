---
baseline_commit: aaa8ce4c60a0cc88e8cd96fa494de4599b12fc07
---

# Story 7.2: Log diário de saúde

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero preencher minhas métricas de saúde do dia (tipicamente de manhã, revisando ontem) numa superfície com **ontem no topo** e **hoje logo abaixo**, cada campo com o input correto para seu tipo,
Para que eu mantenha meu registro de saúde com validação correta por tipo e o histórico preservado mesmo quando desativo campos (FR-3.2, AR-7, AD-01, UX-DR10).

**Segunda story do Épico 7 (Métricas de Saúde).** Constrói o **armazenamento e a captura de valores** sobre o catálogo de definições entregue pela **7.1**. Cria a tabela `health_logs (id, user_id, date, values JSONB)` — **uma linha por (usuário, dia)** — cujas chaves de `values` são os **UUIDs** de `health_field_definitions` (a fonte de verdade de 7.1). A camada de serviço valida cada valor submetido contra o `field_type` da definição correspondente e grava **só se tudo for válido**. A superfície diária (`/health/metrics`, hoje um placeholder) vira o **log do ritual matinal**: seção "Ontem, [data]" no topo, "Hoje, [data]" abaixo, cada campo ativo renderizado como **Health Metric Row** pelo tipo. A 7.3 consumirá `health_logs.values` para histórico/gráficos via cast JSONB. Ordem do épico: **definições (7.1) → log diário (7.2) → histórico (7.3)**.

> **Divergência-chave (repetida de 7.1, ainda válida):** Saúde **NÃO versiona** e **NÃO tem completude ponderada**. Não porte `effective_from`/snapshots/`*_at_time` de Hábitos. O valor é gravado cru no JSONB, chaveado por UUID de definição; a **definição viva** (não um snapshot) tipa/valida/renderiza. `health_logs` **não** tem FK para `health_field_definitions` — o vínculo é o UUID dentro do JSONB (AD-01).

> **⚠️ Regra de ouro do JSONB (AC1/AC2):** o campo **DEVE** se chamar exatamente `values`. O parser/renderer `djangorestframework-camel-case` **já** está configurado com `JSON_CAMEL_CASE["JSON_UNDERSCOREIZE"]["ignore_fields"] = ("values",)` em `config/settings/base.py:207-208` (desde o Épico 1). Isso preserva as chaves internas (UUIDs, `blood_pressure`, …) em ambas as direções. Nomear o campo de outra forma **quebra** a idempotência do round-trip. **Não** confiar em "as chaves são UUID, não convertem" — a varredura é cega e recursiva (§6.3, `test_api_contract.py:24-60`).

## Acceptance Criteria

### AC1 — Gravação validada em `health_logs.values` (FR-3.2, AR-7, AD-01)

**Dado que** estou no log diário de saúde,
**Quando** preencho e salvo os campos de um dia,
**Então** os valores são gravados em `health_logs.values` (JSONB **indexado pelo UUID** de cada `health_field_definition`) após validação na **camada de serviço** contra as definições ativas do tenant — **grava só se TODOS os valores forem válidos** (submissão atômica; nenhuma gravação parcial),
**E** cada valor é validado pelo `field_type` da sua definição: `integer` → inteiro; `decimal` → número; `boolean` → `true`/`false`; `enum` → um dos `enum_options`; `text` → string. Valor com tipo incompatível ou UUID de campo inexistente/inativo é rejeitado (`DomainError` → 409 no serviço; `ValidationError` → 400 na borda),
**E** existe **uma única linha** `health_logs` por `(user_id, date)` (`UniqueConstraint`); regravar o mesmo dia faz **upsert** (não cria linha duplicada).

### AC2 — Round-trip camelCase idempotente (AR-9, §6.3, AD-01)

**Dado que** `values` trafega na API (leitura e escrita),
**Quando** o payload passa pelo parser (escrita) e pelo renderer (leitura),
**Então** as **chaves dinâmicas dentro de `values`** (UUIDs, e strings como `blood_pressure` num teste) **NÃO** são convertidas para camelCase em **nenhuma** direção — o round-trip é **idempotente** (`ler → escrever → ler` devolve o mesmo dicionário),
**E** os demais campos do recurso (`date`, etc.) **seguem** a convenção camelCase normal da borda.

### AC3 — Superfície do ritual matinal: "Ontem, [data]" no topo, "Hoje, [data]" abaixo (FR-3.2, UX-DR10)

**Dado que** abro a superfície **Saúde › Métricas** (`/health/metrics`),
**Quando** ela carrega,
**Então** a seção **"Ontem, [data]"** aparece **no topo** e a seção **"Hoje, [data]"** logo abaixo (acoplado ao fluxo da manhã — Hugo revisa ontem de manhã),
**E** as datas de "ontem" e "hoje" são resolvidas pela **autoridade temporal do servidor** (`today_for(user)`, fuso do usuário) — o frontend **não** calcula "ontem" (evita drift de fuso),
**E** cada seção mostra os **campos ativos** com o valor já gravado daquele dia (ou vazio se ainda não preenchido).

### AC4 — Campos inativos fora do log ativo; valores históricos preservados (FR-3.2, NFR-4)

**Dado que** um campo foi desativado (`active=false`, via 7.1) depois de já ter valores gravados,
**Quando** o log diário renderiza e quando eu regravo um dia,
**Então** o campo inativo **não aparece** no log ativo (só campos ativos são renderizados/editáveis),
**E** seus valores históricos em `health_logs.values` são **preservados** — a gravação faz **merge** (só mescla as chaves submetidas), **nunca** um replace que apagaria chaves de campos hoje inativos.

### AC5 — Health Metric Row por tipo + confirmação inline de salvamento (UX-DR10)

**Dado que** cada campo ativo é renderizado como **Health Metric Row**,
**Quando** interajo com ele,
**Então** o controle corresponde ao `field_type`: `integer`/`decimal` → campo numérico com **teclado numérico no mobile** (`inputMode`); `boolean` → toggle/switch; `enum` → select com as opções da definição; `text` → campo de texto,
**E** ao salvar um dia, uma **confirmação inline discreta** aparece ("Dados de ontem salvos." / "Dados de hoje salvos."), sem gamificação (UX-DR13),
**E** os estados obrigatórios estão cobertos: loading (skeleton), sem campos ativos (uma frase + link para Configurações › Métricas de Saúde), erro de leitura (retry, preserva contexto), erro de escrita (input preservado + retry).

## Escopo — o que NÃO entra nesta story (limites explícitos)

- ❌ **Histórico em tabela, gráficos de evolução (`(values->>'uuid')::numeric`), dashboard/resumo de período, `recharts`** → **Story 7.3**. 7.2 grava e edita **ontem/hoje**, não navega o passado arbitrário nem deriva séries.
- ❌ **Criar/editar/desativar definições de campo** → já é da **7.1** (tela Configurações › Métricas de Saúde). 7.2 **consome** as definições ativas; não as altera.
- ❌ **Qualquer versionamento/effective-dating/snapshot/`*_at_time`** → não existe em Saúde (AD-01). O valor é cru no JSONB, tipado pela definição viva.
- ❌ **Completude ponderada / score / totalizador de "saúde"** → Saúde **não** tem denominador ponderado (ao contrário de Hábitos). No máximo um contador factual "preenchido/pendente" **se** for trivial — mas **nada** de score inventado (EXPERIENCE.md:112,140; review-accessibility §33/§43). *Default desta fatia: sem contador; só as duas seções editáveis.*
- ❌ **Qualquer FK entre `health_logs` e `health_field_definitions`** → o vínculo é o UUID no JSONB (AD-01). **Sem** FK; sem FK para `medications` (domínios independentes, §7.1:1150-1151).
- ❌ **Integrar a superfície de saúde dentro do Daily Log / alternador "Dia completo"** → o EXPERIENCE.md prevê Saúde na banda do Daily Log "quando o módulo existir" (linha 112-117), mas isso é composição futura. 7.2 entrega a **superfície própria `/health/metrics`** (primeiro nível de nav, já cabeada no Sidebar/BottomNav). **Não** mexer no Daily Log nem no alternador de lente.
- ❌ **Gating por horário real ("só de manhã")** → ver Decisão 1. *Default: sempre ontem-no-topo + hoje-abaixo, sem detectar horário.*
- ❌ **Mexer no Sidebar/BottomNav** → a entrada "Saúde › Métricas" → `/health/metrics` **já existe** (Sidebar.tsx:63; BottomNav.tsx:14). 7.2 só **troca o elemento da rota** (placeholder → página real) em `router.tsx`. **Nada** Query-driven novo na nav (protege os 3 testes compartilhados).

## Tasks / Subtasks

- [x] **Task 1 — Model `HealthLog` + migration (AC1, AC4)**
  - [x] Em `backend/health/models.py`, adicionar `HealthLog(TenantModel)`: `date = models.DateField()`, `values = models.JSONField(default=dict, blank=True)`, `created_at = models.DateTimeField(auto_now_add=True)`. Herda UUID PK `id` + `user_id` + managers auto-escopados do `TenantModel` — **não** redeclarar `id`/`user_id`; **sem** FK para `HealthFieldDefinition` (o vínculo é o UUID nas chaves de `values` — AD-01).
  - [x] `Meta.db_table = "health_logs"`, `ordering = ["-date"]`, `constraints = [UniqueConstraint(fields=["user_id", "date"], name="uniq_health_log_per_day")]` (espelha o `uniq_habit_day_entry_per_day` — mas por `(user_id, date)`, pois não há `habit`).
  - [x] **`values` DEVE se chamar `values`** (ver "Regra de ouro do JSONB" na Story). Comentário inline: o `ignore_fields=("values",)` já configurado (base.py:207) protege as chaves internas.
  - [x] `makemigrations health --name health_log` → **uma** migration (`0002_healthlog`). Aplicar às branches Neon `dev`/`e2e` antes das suítes que batem no banco (lacuna recorrente ao introduzir tabela nova).
  - [x] Decisão a confirmar (Decisão 4): índice GIN em `values` — **default: deferir** para 7.3 (AD-14 reserva a latitude de índice; o cast `->>'uuid'::numeric` de 7.3 não usa GIN). Documentar inline.
  - [x] `admin.py`: registrar `HealthLog` com `all_objects` + `user_id`/`date` na lista (padrão operador).

- [x] **Task 2 — Camada de serviço: read-model do dia + upsert-merge validado (AC1, AC3, AC4)**
  - [x] `get_health_daily(*, user) -> dict`: resolve `today = today_for(user)` e `yesterday = today - timedelta(days=1)`; carrega os `HealthLog` desses dois dias (se existirem) e as **definições ativas** (`list_health_fields(user=user)`); devolve `{"yesterday": {"date", "values"}, "today": {"date", "values"}, "fields": [<def ativas>]}`. Dias sem linha → `values = {}`. Único ponto de "hoje"/"ontem" — **nunca** `date.today()` cru.
  - [x] `upsert_health_log(*, user, log_date, values) -> HealthLog` (`@transaction.atomic`): (1) carrega as definições **ativas** do tenant num dict `{str(id): definition}`; (2) valida **cada** par `{uuid: valor}` submetido — UUID deve existir e estar **ativo**, e o valor deve casar com `field_type` (ver `_validate_value` abaixo); qualquer inválido → `DomainError` (→409), **antes** de gravar (grava só se tudo válido); (3) `HealthLog.objects.get_or_create(date=log_date)` (auto-escopado; **não** passar `user_id`), depois **mescla** os pares validados em `row.values` (preservando chaves não submetidas — AC4) e `row.save(update_fields=["values"])`. Chave `null`/vazia → **remover** a chave do blob (limpar valor). Retorna a linha.
  - [x] `_validate_value(field_type, value) -> value_normalizado` (helper de módulo): `integer` → `int` sem parte fracionária (rejeita `1.5`, `"abc"`); `decimal` → `int|float` (aceita `88.2`); `boolean` → `bool` estrito; `enum` → string ∈ `enum_options` da definição; `text` → `str` (cap defensivo, ex. `len ≤ 1000`). Tipo incompatível → `DomainError`. Devolve o valor normalizado a gravar.
  - [x] **Só exceções de `core/exceptions.py`** (`DomainError`→409). Sem `ValueError`/`ValidationError` cru no serviço. Assinatura fixa `(*, user, …)`, `user` keyword-only primeiro; escrita `@transaction.atomic`; scoping implícito (`HealthLog.objects…`, nunca `all_objects`).

- [x] **Task 3 — API DRF + contrato (AC1, AC2, AC3, AC4)**
  - [x] Views finas `APIView` (o codebase **não** usa ViewSet/router) com `@extend_schema`, sob **`/api/health-logs/`** (irmão de `/api/health-field-definitions/`; **nunca** `/api/health/` — liveness reservado):
        - `GET /api/health-logs/daily/` → read-model do ritual (`get_health_daily`); resposta `{yesterday, today, fields}`.
        - `PUT /api/health-logs/` (body `{date, values}`) → `upsert_health_log`; resposta `{date, values}`. Ver Decisão 2 para a escolha de superfície de escrita.
  - [x] **Serializer com `values` opaco (exceção do camelCase — §6.10):** `values = serializers.JSONField()` (dict cru; chaves NÃO convertidas). `HealthLogSerializer` (`ModelSerializer`, `fields = ["id", "date", "values"]`) para saída de uma linha; `HealthDailySerializer` (`Serializer` plano) compõe `yesterday`/`today` (cada um `{date, values}`) + `fields` (`HealthFieldDefinitionSerializer(many=True)` — reuso de 7.1). Entrada de escrita: `HealthLogWriteSerializer` (`Serializer` plano) com `date = DateField()` + `values = JSONField()` (a validação de conteúdo é do **serviço**, contra as definições — o serializer só garante forma).
  - [x] **Tipar `values` no contrato como `Record<string, …>`** (§7.1:892 exige "tipados explicitamente como `Record<string, HealthValue>`"): usar `@extend_schema_field` com um schema OpenAPI de objeto de `additionalProperties` (precedente de uso do helper em `bujo/serializers.py:8,46,56`) **ou** aceitar o objeto opaco e definir o tipo no `features/health/types.ts` (ver Task 4 / Decisão 3). Meta: `types.gen.ts` não vira `unknown`/`Record<string, never>` inútil.
  - [x] Wire em `backend/config/urls.py`: adicionar `path("api/health-logs/", include("health.urls_logs"))` (novo módulo `health/urls_logs.py`). **Precedente exato:** `habits` já faz esse split de recursos-irmãos — `api/habits/ → habits.urls` **e** `api/habit-groups/ → habits.urls_groups` (config/urls.py:15-16). Espelhar: `api/health-field-definitions/ → health.urls` (7.1) **e** `api/health-logs/ → health.urls_logs` (7.2).
  - [x] Regenerar contrato: `uv run python manage.py spectacular --file ../schema.yaml` + `npm run generate-types`. Diff deve ser **puramente aditivo** (novos schemas `HealthLog`/`HealthDaily`/write; 0 remoções). **Não** introduzir novo `*Enum` sem `ENUM_NAME_OVERRIDES` (nenhum enum novo esperado aqui — `field_type` já vem via `HealthFieldDefinitionSerializer` de 7.1).

- [x] **Task 4 — Feature frontend: hooks, keys e tipos (AC1, AC3, AC5)**
  - [x] `frontend/src/api/keys.ts` — expandir a seção `health` (o slot `// logs: { ... } → Story 7.2` já está reservado, linhas 52-53):
        ```ts
        health: {
          fieldDefinitions: (params?: { includeInactive?: boolean }) =>
            ['health', 'fieldDefinitions', 'list', params ?? {}] as const,
          daily: () => ['health', 'logs', 'daily'] as const,
        },
        ```
        Mutação de escrita invalida por prefixo `['health']` (ou mais estreito `['health','logs']`). Chaves sem `userId` (logout limpa o cache — padrão do projeto).
  - [x] `features/health/types.ts` — adicionar `HealthValue = number | boolean | string` e `HealthValues = Record<string, HealthValue>` (a exceção de chave dinâmica de §6.3/§7.1:892); tipos do read-model (`HealthDaily`, `HealthLog`) a partir de `components['schemas'][…]` gerados.
  - [x] `features/health/api.ts` — `useHealthDailyQuery()` (`GET /api/health-logs/daily/`, `queryKey: keys.health.daily()`) e `useUpsertHealthLogMutation()` (`PUT /api/health-logs/`, body camelCase `{date, values}`; `onSuccess: invalidateQueries({ queryKey: ['health'] })`). Config/log-CRUD → `useMutation` sem otimismo (a confirmação inline é explícita; não é toggle de alta frequência). `index.ts`: exportar os novos hooks/tipos.

- [x] **Task 5 — Superfície do log diário (AC3, AC4, AC5)**
  - [x] Criar `frontend/src/pages/health/HealthMetricsPage.tsx`: `<Box component="main" aria-label="Métricas de Saúde" sx={{ p: 3 }}>` renderizando `<HealthMetricsLog/>`.
  - [x] `router.tsx` — **trocar** o elemento da rota `health/metrics` de `<PlaceholderPage title="Métricas de Saúde"/>` para `<HealthMetricsPage/>` (manter `path`/`handle.title`). **Não** tocar em `health/medications` (Épico 8) nem no Sidebar/BottomNav.
  - [x] `features/health/components/HealthMetricsLog.tsx` — modelado em `HabitTracker.tsx`: duas seções empilhadas — **"Ontem, [data]"** (topo) e **"Hoje, [data]"** (abaixo) — cada uma renderizando os `fields` ativos como **Health Metric Row** pelo tipo (extrair um `<HealthMetricRow field value onChange/>`):
        - `integer`/`decimal` → `TextField type="number"` com `inputProps={{ inputMode: 'numeric' }}` (decimal → `'decimal'`), commit no blur/enter (idioma de `NumericRow` em HabitTracker:88-136).
        - `boolean` → `Switch`/`Checkbox` (toggle).
        - `enum` → `Select` com `field.enumOptions` como `MenuItem`s (+ `aria-label`).
        - `text` → `TextField` multiline curto.
        - Cada Row com `aria-label` factual; touch target ≥44px; sem hex hardcodado (sx semântico).
  - [x] **Salvar por dia:** cada seção tem um botão **"Salvar"** que coleta os valores editados daquela seção e chama `useUpsertHealthLogMutation` com `{ date, values }` do dia. Ao sucesso → **confirmação inline discreta** (`role="status"`): "Dados de ontem salvos." / "Dados de hoje salvos." (constantes exatas). Ver Decisão 6 (salvar-por-dia vs. autosave-por-campo).
  - [x] **Estados obrigatórios** (parte do aceite): loading → skeleton com geometria real (shell/header permanecem); **sem campos ativos** → uma frase ("Nenhum campo de saúde ativo.") + **até uma ação** (link para `/settings/health-metrics`); erro de leitura → mensagem local + retry, preserva contexto; erro de escrita → input preservado + retry (constante `"Não foi possível salvar. Tente novamente."`). Voz UX-DR13: pt-BR neutro, zero gamificação (State Patterns EXPERIENCE.md:144-160).

- [x] **Task 6 — Testes backend (todas as ACs)**
  - [x] `health/tests/factories.py`: adicionar `HealthLogFactory` (`class Params: user = SubFactory(UserFactory)` + `user_id = SelfAttribute("user.id")`; `date` fixa — **sem `date.today()`**; `values = factory.Dict({})`), e `register_isolation_case(id="health.HealthLog", model=HealthLog, make=lambda: {"date": <data fixa>, "values": {}})`. `_ISOLATION_TEST_MODULES` já inclui `"health.tests.factories"` (7.1) — **nenhuma** mudança em `conftest.py`.
  - [x] `test_models.py`: unicidade `(user_id, date)` (segundo insert do mesmo dia → `IntegrityError`); `values` default `{}`.
  - [x] `test_services.py`: (a) upsert grava `{uuid: valor}` válido; (b) **grava só se tudo válido** — um valor inválido no lote → `DomainError`, **nenhuma** chave persistida; (c) validação por tipo: `integer` rejeita `1.5`/`"x"`, `decimal` aceita `88.2`, `boolean` estrito, `enum` só ∈ opções, `text` string; (d) UUID inexistente/**inativo** rejeitado; (e) **merge preserva** chave de campo hoje inativo (grava campo ativo → não apaga a chave inativa — AC4); (f) `null`/vazio remove a chave; (g) regravar o mesmo dia = upsert (1 linha); (h) `get_health_daily` devolve ontem/hoje/fields com datas de `today_for` e só definições ativas.
  - [x] `test_serializers.py`/`test_views.py`: `PUT` válido → 200 e linha upsertada; inválido → 400/409; `GET /daily/` → shape `{yesterday, today, fields}`; **isolamento cross-tenant** (404/vazio via service+view) e **fail-closed** (`TenantScopeViolation` sem contexto — coberto pelo contrato parametrizado ao registrar o `register_isolation_case`).
  - [x] **Round-trip camelCase (AC2)** — teste dedicado no app `health` (além do contrato genérico em `core`): `PUT` com `values={"blood_pressure": 120, "<uuid>": 88.5}` (usar um campo `text`/definição real para `blood_pressure` **ou** validar via o renderer/parser como em `test_api_contract`), depois `GET` → as chaves voltam **idênticas** (não `bloodPressure`). Provar `ler→escrever→ler` idempotente.

- [x] **Task 7 — Testes frontend (AC3, AC5)**
  - [x] `features/health/api.test.tsx` (append): assert de endpoint/payload camelCase (`GET /daily/`, `PUT` com `{date, values}`), invalidação `['health']`. `vi.mock('../../../api/client')`, wrapper `QueryClientProvider` (`retry:false`), `jest-axe` sem violações.
  - [x] `features/health/components/HealthMetricsLog.test.tsx`: duas seções "Ontem, [data]"/"Hoje, [data]"; render por tipo (numérico `inputMode`, boolean toggle, enum select, texto); **confirmação inline** ao salvar ("Dados de ontem salvos."); campo **inativo não renderizado**; empty (sem campos ativos → frase + link Configurações); erro de leitura (retry) e de escrita (input preservado). **Caveat jsdom para `<input type="number">`:** `userEvent.type/clear` não funcionam — usar `fireEvent.change(field, { target: { value } })`.
  - [x] Rota: a superfície é página no `<Outlet/>` → **não** afeta os 3 testes compartilhados de nav (`AppLayout`/`router`/`RouteAnnouncer`) desde que nada Query-driven entre no Sidebar/BottomNav. Se `router.test.tsx` asserta o texto do placeholder de `/health/metrics`, atualizar o assert para a página real.

- [x] **Task 8 — Verificação e contrato**
  - [x] Backend verde: `ruff` (health/config) · `lint-imports` (contrato "core must not import domain apps" — `health` já em `forbidden_modules`; **nenhuma** mudança) · `pytest health accounts core --reuse-db` (run escopado honesto; full-suite do Neon trava — registrar contagem por lotes, não omitir apps) · `spectacular` + diff `types.gen.ts` (aditivo).
  - [x] Frontend verde: `tsc` · ESLint · `vitest run` (suíte completa; registrar total + novos de health) · `vite build`. **Node 22.15.1 via nvm** antes de todo comando de frontend (`nvm use 22.15.1`).
  - [x] Migration `health.0002_healthlog` aplicada às branches Neon `dev`/`e2e` (`pytest --create-db` reconstrói o test DB com a nova migration).

## Dev Notes

### Contexto de arquitetura — AD-01 operacionalizada (esta é a story do "valor")

7.1 entregou o **catálogo de definições**. 7.2 entrega o **armazenamento e captura de valores** — a segunda metade da AD-01. Schema (agora com a linha de 7.2 ativa) [Source: architecture.md#AD-01 linhas 104-121]:

```
health_field_definitions (id, user_id, name, field_type, enum_options JSONB, active, display_order)   -- 7.1
health_logs (id, user_id, date, values JSONB)                                                          -- 7.2 (ESTA story)
-- values = {"uuid-campo-peso": 88.2, "uuid-campo-sono": 4, "uuid-atividade": true}
```

Operacionalização literal da AD-01 [Source: architecture.md#AD-01 linhas 118-121]:
> *"Na escrita: serviço carrega `health_field_definitions` ativas do usuário, valida cada valor submetido contra o `field_type` correspondente, grava somente se tudo válido. Na leitura: serviço usa as definições para saber como tipar e renderizar cada campo. Em queries analíticas (gráficos): cast explícito via operadores JSONB (`(values->>'uuid')::numeric`)."*

7.2 implementa **escrita** e **leitura**; o cast analítico é **7.3**. A validação-contra-definições é o coração desta story — mesma classe de invariante-no-serviço que a §6.4 lista explicitamente [Source: architecture.md#§6.4 linha 938: *"tipagem de JSONB contra `health_field_definitions` (AD-01)"* é regra de negócio no serviço, não no serializer].

### ⚠️⚠️ camelCase e o JSONB de chave dinâmica — a armadilha central (AC2)

**Já resolvido na infraestrutura (Épico 1) — NÃO reimplementar, apenas usar corretamente:**
- `config/settings/base.py:207-208`: `JSON_CAMEL_CASE = {"JSON_UNDERSCOREIZE": {"ignore_fields": ("values",)}}`. O `djangorestframework-camel-case` (parser **e** renderer) lê esse setting; qualquer campo chamado `values` tem suas **chaves internas preservadas** em ambas as direções [Source: base.py:201-209].
- `core/tests/test_api_contract.py:24-60` já **prova** o round-trip (`blood_pressure` não vira `bloodPressure`; UUID intacto) e que o renderer de produção tem `values` em `ignore_fields`.

**O que 7.2 DEVE garantir para herdar essa proteção:**
1. O campo do model/serializer **DEVE** se chamar `values` — não `data`, não `metrics`, não `field_values`. Renomear = quebrar o round-trip.
2. O serializer expõe `values` como `serializers.JSONField()` (dict **opaco**) — o padrão canônico de §6.10 [Source: architecture.md#§6.10 linhas 996-1005 `HealthLogSerializer`]. **Não** modelar `values` como campo estruturado/`SerializerMethodField` que reprocessa as chaves.
3. Regra de §6.9 (anti-padrão proibido): *"Converter chaves dinâmicas de JSONB para camelCase"* [Source: architecture.md#§6.9 linha 974].
4. **Proibido confiar em "as chaves são UUID, não vão converter"** — a varredura é cega e recursiva; a proteção é o `ignore_fields`, não a forma das chaves [Source: architecture.md#§6.3 linha 898].

> Nota histórica: `test_api_contract.py` usa `health_field_id`/`log_date` como exemplos **ilustrativos** de camelização normal — **não** são o schema real. O schema real de `health_logs` é `(id, user_id, date, values)`; o campo é `date` (não `log_date`). `health_field_id` **normal** cameliza para `healthFieldId` (é campo comum); a exceção é só para as **chaves internas** de `values` [Source: 7.1 Dev Notes; test_api_contract.py:14-21].

### Modelo de dados — `health_logs` (uma linha por dia, JSONB)

Diretrizes [Source: backend/habits/models.py:153-205 `HabitDayEntry`; architecture.md#§6.1]:
- **Herda `TenantModel`** → UUID PK `id` + `user_id UUIDField(db_index=True)` + `objects`/`all_objects`. **Não** redeclarar `id`/`user_id`.
- **`date`**: `DateField()`. **`values`**: `JSONField(default=dict, blank=True)`. **`created_at`**: `DateTimeField(auto_now_add=True)` (o `TenantModel` não dá timestamps).
- **Unicidade por dia**: `UniqueConstraint(fields=["user_id", "date"], name="uniq_health_log_per_day")`. Precedente: `HabitDayEntry` usa `UniqueConstraint(fields=["habit","date"])` [Source: habits/models.py:200-205] — aqui a chave natural é `(user_id, date)` porque não há `habit` (um blob por dia). Incluir `user_id` explicitamente no constraint (o auto-scope do manager filtra leituras, mas o índice único precisa da coluna).
- **Sem FK** para `HealthFieldDefinition` (o vínculo é o UUID no JSONB — AD-01) nem para `medications` (§7.1:1150-1151).
- **`db_table = "health_logs"`**, `ordering = ["-date"]` (mais recente primeiro; a leitura do ritual busca por data específica, mas 7.3 varre ranges).
- **1 migration** (`0002_healthlog`) — §6.1 (uma migration por story).

### Camada de serviço — validação-contra-definições é o núcleo (AC1, AC4)

`health/services.py` (funções de módulo, `@transaction.atomic` nas escritas, `(*, user, …)`, só `DomainError`):

- **`get_health_daily(*, user)`** — read-model do ritual. Resolve `today = today_for(user)`, `yesterday = today - timedelta(days=1)` (a **única** fonte temporal; `core/calendar.today_for` usa o fuso do usuário — nunca `date.today()` cru; guardrail AST em `test_guardrails.py`) [Source: core/calendar.py:14-19]. Carrega os 2 `HealthLog` + `list_health_fields(user=user)` (só ativos, de 7.1). Devolve `{"yesterday": {"date", "values"}, "today": {"date", "values"}, "fields": [<def ativas>]}`. Dia sem linha → `{"date": d, "values": {}}`.

- **`upsert_health_log(*, user, log_date, values)`** — o "grava só se tudo válido" (AC1) + **merge** (AC4):
  1. Carrega definições ativas num dict `by_id = {str(d.id): d for d in list_health_fields(user=user)}`.
  2. Para cada `(uuid, valor)` submetido: se `uuid ∉ by_id` → `DomainError` (campo inexistente/inativo); senão `validated[uuid] = _validate_value(by_id[uuid].field_type, by_id[uuid], valor)`. **Toda** a validação acontece **antes** de qualquer gravação.
  3. `row, _ = HealthLog.objects.get_or_create(date=log_date)` (auto-escopado; `get_or_create` upsert pela unicidade). **Merge**: `row.values.update(validated)`; chaves com `null`/vazio → `row.values.pop(uuid, None)` (limpar). `row.save(update_fields=["values"])`. O merge **preserva** chaves de campos hoje inativos (AC4) — nunca `row.values = validated` (replace apagaria histórico).
  4. Retorna `row`.

- **`_validate_value(field_type, definition, value)`** — normaliza/rejeita por tipo:
  - `integer`: aceita `int` (ou `float` sem parte fracionária); rejeita `1.5`, strings não-numéricas → `DomainError`.
  - `decimal`: aceita `int`/`float`. *Default de armazenamento: número cru (`88.2`), coerente com o exemplo da AD-01* (ver Decisão 3 — string vs. float).
  - `boolean`: aceita só `True`/`False` estritos.
  - `enum`: string ∈ `definition.enum_options`; fora → `DomainError`.
  - `text`: `str` (cap defensivo, ex. `≤ 1000` chars).

> **Por que a validação de valor é do serviço, não do serializer:** o serializer não conhece as definições do tenant (tipos/opções variam por linha e por usuário). §6.4 lista tipagem-de-JSONB-contra-definições como regra de negócio no serviço [Source: architecture.md#§6.4 linha 938]. O serializer de escrita só garante **forma** (`date` é data, `values` é objeto); o **conteúdo** é o serviço.

### Superfície de API (§6.1, §6.3, §6.10)

| Método & rota | Ação |
|---|---|
| `GET /api/health-logs/daily/` | read-model do ritual: `{yesterday:{date,values}, today:{date,values}, fields:[…ativas]}` |
| `PUT /api/health-logs/` | upsert-merge do dia: body `{date, values}` → `{date, values}` |

- Views finas `APIView` + `@extend_schema` (o codebase **não** usa router) [Source: habits/views.py:186-244 `HabitDayView`/`HabitDayEntryDetailView` — o precedente exato de "superfície do dia": `GET` read-model resolvendo `today_for`, escrita separada].
- `values` opaco = `serializers.JSONField()` [Source: architecture.md#§6.10:996-1005].
- **Contrato de `values` tipado**: §7.1:892 exige `Record<string, HealthValue>`. `drf-spectacular` para `JSONField()` gera objeto vazio; usar `@extend_schema_field({"type":"object","additionalProperties":{...}})` (helper já usado em `bujo/serializers.py:8,46,56`) **ou** definir `HealthValues = Record<string, HealthValue>` manualmente em `features/health/types.ts` e castar. *Default: tipo manual no frontend (menos acoplamento ao gerador; ver Decisão 3).*
- `DoesNotExist` → `NotFound()`; `DomainError` → 409; serializer inválido → 400 `{detail, fields}` [Source: core/exceptions.py:29-114].

### Frontend — feature `features/health/` (estender, não recriar)

A feature **já existe** (7.1): `api.ts`, `types.ts`, `index.ts`, `components/HealthMetricsManager.tsx`. 7.2 **adiciona**:
- **`api.ts`**: `useHealthDailyQuery()` + `useUpsertHealthLogMutation()` (`useMutation` + invalidação `['health']`; **sem** `useOptimisticMutation` — o log tem save explícito + confirmação, não é toggle de alta frequência) [Source: features/health/api.ts:46-82 — o precedente config-CRUD de 7.1].
- **`keys.ts`**: `health.daily()` no slot já reservado (`keys.ts:52-53`).
- **`types.ts`**: `HealthValue`/`HealthValues` (a exceção de chave dinâmica; §7.1:892).
- **`components/HealthMetricsLog.tsx`** (net-new) + **`components/HealthMetricRow.tsx`**: modelados em `HabitTracker.tsx`/`NumericRow`/`BooleanRow` [Source: features/habits/components/HabitTracker.tsx:57-263]. Diferença central: HabitTracker faz **autosave por linha** (mark on blur, otimista); Saúde faz **save por dia** (botão → um `PUT` do dia → confirmação inline). O `HealthMetricsManager` de 7.1 já tem o precedente do `Select` de tipo e do render condicional — reusar o mapa `FIELD_TYPE_LABEL` se útil, mas o **input de valor** (não de config) é net-new por tipo.
- **`pages/health/HealthMetricsPage.tsx`** (net-new, mirror de `HabitsPage.tsx`) [Source: pages/habits/HabitsPage.tsx:7-14].

**Health Metric Row por tipo (AC5)** — o controle de **valor** (não de definição):
| `field_type` | Controle | Nota |
|---|---|---|
| `integer` | `TextField type="number"` `inputMode:'numeric'` | teclado numérico mobile; commit no blur |
| `decimal` | `TextField type="number"` `inputMode:'decimal'` | idem; aceita `88,2`/`88.2` |
| `boolean` | `Switch`/`Checkbox` | toggle |
| `enum` | `Select` + `field.enumOptions` | `aria-label` factual |
| `text` | `TextField` | curto |

Cada Row: `useState` controlado (draft por `field.id`), `aria-label` factual, ≥44px, sx semântico (sem hex). Idioma do `NumericRow`: draft local + `commit` no blur/enter [Source: HabitTracker.tsx:88-136].

**Salvar + confirmação (AC5):** botão "Salvar" por seção → coleta os valores da seção → `useUpsertHealthLogMutation.mutate({date, values})` → `onSuccess` mostra `role="status"` discreto: **"Dados de ontem salvos."** / **"Dados de hoje salvos."** (constantes exatas, verificadas em teste). Erro → constante `"Não foi possível salvar. Tente novamente."` (mesma de HabitTracker:28) com input preservado.

**Rota/nav:** trocar só o `element` de `health/metrics` em `router.tsx:96-100` (placeholder → `<HealthMetricsPage/>`). O Sidebar (`Sidebar.tsx:63` → `/health/metrics`, ícone `ShowChartIcon`) e o BottomNav (`BottomNav.tsx:14,55` "Saúde") **já apontam** para cá — **não** tocar. **Nada** Query-driven na nav (protege `AppLayout`/`router`/`RouteAnnouncer`).

### Ritual matinal — "Ontem, [data]" e a autoridade temporal (AC3)

- A superfície **sempre** mostra **ontem no topo, hoje abaixo** (Decisão 1: sem gate por horário). O rótulo "Ontem, [data]" ancora o ritual; a data vem do **servidor** (`get_health_daily` resolve via `today_for(user)`) — o frontend **nunca** faz `new Date()` para "ontem" (drift de fuso; a autoridade é o backend, espelhando `HabitDayView` que resolve `today_for`) [Source: habits/views.py:212; core/calendar.py:14-19].
- Formatação da data em pt-BR no frontend (`Intl.DateTimeFormat('pt-BR')` ou similar; há precedente de `Intl.NumberFormat('pt-BR')` em HabitTracker:30). Rótulos: "Ontem, [data]" / "Hoje, [data]" — factuais, sem gamificação (UX-DR13).
- Definições **não versionadas** (AD-01): ambas as seções renderizam o **mesmo conjunto ativo atual**; um campo ativado hoje também aparece (vazio) na seção de ontem — consistente e esperado. Um campo desativado some das **duas** seções, mas seu valor histórico continua no blob (AC4).

### UX — fonte canônica, padrões de estado e o gap de mockup

- **Canônico:** `ux-designs/ux-hmmb-bujo-2026-07-17/` (DESIGN.md + EXPERIENCE.md), regido pela SPEC de design-system. `ux-hmmb-bujo-2026-06-15/` é **LEGADO CONGELADO** (referência-only) [Source: ux-hmmb-bujo-2026-06-15/LEGACY.md].
- **UX-DR10 (Health Metric Row)** — autoritativo via `epics.md`: input por tipo; campos inativos não aparecem; sem exclusão, só desativação. 7.2 **implementa a Row** (7.1 só modelou as definições) [Source: epics.md#Story-7.2 linhas 1255-1258; #UX-DR10].
- **Padrão de página**: EXPERIENCE.md descreve Saúde como "campos do período diário editáveis" com "quantidade preenchida/pendente, **sem inventar score**" (linha 112) e "campos dinâmicos renderizados pelo tipo … Sem fasting/BMI fixo" (linha 140). O "Resumo de período" é **7.3** (FR-3.3), não aqui [Source: EXPERIENCE.md:112,140; review-accessibility-product.md:33,73].
- **State Patterns (obrigatórios, parte do aceite)** [Source: EXPERIENCE.md:144-160]: loading = skeleton com geometria real; empty inicial = uma frase + até uma ação; read error = local + retry + contexto preservado; write error = input preservado + rollback seletivo + retry explícito.
- **a11y (WCAG 2.2 AA)/voz (UX-DR13):** `<main aria-label>`; controles com nome acessível; cor nunca é indicador único; erros anunciados (`role="alert"`); confirmação anunciada (`role="status"`); pt-BR neutro, zero gamificação.
- **Gap de mockup:** o mockup M22 detalhado da tela **não foi produzido** — apoiar-se nos contratos de componente do design-system + precedente de `HabitTracker` [Source: ux-hmmb-bujo-2026-07-17/.working/mockup-coverage-plan.md; review-accessibility-product.md].

### Nota do design-system em migração (não bloqueante)

`_bmad-output/specs/spec-design-system-migration/` é **contrato de planejamento — implementação NÃO autorizada**; não há biblioteca de primitivos nova (só `shared/components/Modal.tsx`). Construir com `theme.ts` + padrões de `habits`/`health` existentes, honrando os princípios preservados (semântica redundante, 44px, WCAG, sem scroll horizontal mobile) para que a re-skin da **Onda 5** (Saúde) seja barata. Evitar estilos estruturais one-off / hex hardcodado [Source: specs/spec-design-system-migration/SPEC.md#Non-goals].

### Testes

**Backend** [Source: backend/conftest.py; backend/health/tests/; backend/habits/tests/]:
- `conftest.py` já dá DB autouse + `user`/`other_user`/`api_client`/`auth_client` (roda o corpo em `tenant_context(user)`; `response.data` é **snake_case** — camelização só no renderer JSON; assert erros em snake, ex. `values`).
- Factory `HealthLogFactory` com `class Params`/`SelfAttribute` + `register_isolation_case(id="health.HealthLog", …)`. `_ISOLATION_TEST_MODULES` **já** tem `health.tests.factories` (7.1) — sem mudança em conftest. **Sem `date.today()`** — datas fixas + `timedelta`.
- **Round-trip (AC2)**: reforçar com um teste no app `health` (o contrato genérico em `core/tests/test_api_contract.py` já cobre o mecanismo; o de `health` prova ponta-a-ponta via `PUT`→`GET`).
- Contagem honesta: full-suite do Neon **trava** — run escopado `pytest health accounts core --reuse-db` + lotes (`habits`, `bujo braindump`); reportar a **união** dos lotes, nunca uma contagem escopada como se fosse total (guardrail Retro Épico 11).

**Frontend** [Source: features/habits/*.test.tsx; test-setup.ts]:
- vitest + RTL, `fileParallelism:false` (default — **não** passar flags). `vi.mock('../../../api/client')` + wrapper `QueryClientProvider` (`retry:false`). `jest-axe` sem violações. **Sem MSW.**
- **Caveat jsdom `<input type="number">`:** `userEvent.type/clear` não funcionam → `fireEvent.change(field, { target: { value } })`.

### Armadilha dos 3 testes compartilhados (memória do projeto — CONFIRMADA)

`AppLayout.test.tsx`/`router.test.tsx`/`RouteAnnouncer.test.tsx` renderizam a casca **sem** `QueryClientProvider`, sobrevivendo só porque `vi.mock`am todo filho de nav com Query. A superfície de saúde é página no `<Outlet/>` → **não** os afeta, **desde que** nada Query-driven entre no Sidebar/BottomNav. Se `router.test.tsx` asserta o texto do placeholder atual de `/health/metrics`, **atualizar** esse assert para a página real [Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`].

### Ambiente / CI / operação

- **Node ≥ 22.15.1 via nvm** antes de todo comando de frontend/e2e (`nvm use 22.15.1`; a sessão inicia em v18) [Source: memória `frontend-needs-node-22-via-nvm`].
- **Migration em branches Neon dedicadas**: aplicar `health.0002_healthlog` às branches `dev`/`e2e` antes de suítes que batem no banco.
- **Full-suite do Neon trava** (recorrente): fallback = run escopado por lotes para contagem honesta. **Vitest não roda no CI** — rede local/review.
- **Gates de CI** (ordem): backend `ruff` → `lint-imports` → `pytest` → `spectacular` + diff `types.gen.ts`; frontend `tsc` → ESLint → `vite build`.
- **Commit ao fim da story**: 1 commit/story; rodar `/bmad-uncommitted-report`, salvar o report, então commitar **sem** pedir "[S]im". **Não** varrer para o commit as mudanças de planejamento/UX do Hugo no working tree (`architecture.md`, `epics.md`, `ux-designs/*`, `specs/*`) — trabalho paralelo dele [Source: memórias `commit-at-end-of-each-story`; epic-6-retro §9].

### Inteligência da story anterior (7.1)

[Source: 7-1-campos-de-saude-dinamicos.md — mesma feature/app, entregue ontem]:
- **`ENUM_NAME_OVERRIDES["HealthFieldTypeEnum"]`** já pina o enum de tipo — reusado via `HealthFieldDefinitionSerializer` no `fields` do read-model. **Nenhum** enum novo em 7.2 (sem override novo).
- **Contrato aditivo** foi a disciplina do Épico 6/7.1 — meta: diff `schema.yaml`/`types.gen.ts` puramente aditivo.
- **Resolver design não-explícito por leitura literal + código + doc e documentar inline** (guardrail institucionalizado) — aplicado nas "Decisões a confirmar" abaixo.
- **File List completo** — nomear também modificados (`models.py`, `urls.py`, `router.tsx`, `keys.ts`, `types.ts`, `api.ts`, `index.ts`, `schema.yaml`, `types.gen.ts`, `factories.py`); colar contagem de testes **depois** do último teste, observada literalmente (não de memória).
- Revisão sênior de 7.1 já adicionou `max_value=_MAX_DISPLAY_ORDER` e testes de `display_order` — nada a fazer aqui (7.2 não escreve `display_order`).

### Decisões a confirmar (defaults para #YOLO — endossar todos e documentar inline)

1. **Gate por horário do ritual matinal** → **NÃO**. A superfície sempre mostra ontem-no-topo + hoje-abaixo; "de manhã" descreve o hábito do Hugo, não um comportamento time-gated (fragilidade + fuso, sem benefício claro; o rótulo "Ontem, [data]" já ancora). *Default: sem gate.* **(É a assunção funcional mais sensível — memória `ask-dont-assume-functionality-flows`; se o revisor discordar, é o ponto a levantar.)**
2. **Superfície de escrita** → `PUT /api/health-logs/` com `{date, values}` no body (upsert-merge por dia) + `GET /api/health-logs/daily/` (read-model). Alternativa considerada e descartada: PATCH por-campo (não casa com a confirmação por-dia "Dados de ontem salvos." nem com "grava só se tudo válido"). *Default: PUT por dia + GET daily.*
3. **Armazenamento de `decimal` e tipagem do contrato** → valor **número cru** no JSONB (coerente com o exemplo `88.2` da AD-01); tipo `HealthValue = number | boolean | string` definido no `features/health/types.ts` (a exceção de chave dinâmica; §7.1:892). Alternativa: string para `decimal` (evita float drift) — descartada por simplicidade e alinhamento ao exemplo da AD-01. *Default: número cru + tipo manual no frontend.*
4. **Índice GIN em `values`** → **deferir** para 7.3 (AD-14 reserva a latitude de índice; o cast `->>'uuid'::numeric` de 7.3 **não** usa GIN — GIN serve containment `@>`, não range on-expression; a AD-01 menciona GIN como esboço, mas 7.3 explicita "índices reservados"). *Default: sem GIN nesta migration; documentar o achado honesto inline.*
5. **Wire de URL** → `path("api/health-logs/", include("health.urls_logs"))` (novo módulo `urls_logs.py` no app `health`), espelhando **exatamente** o split `api/habits/ → habits.urls` + `api/habit-groups/ → habits.urls_groups` de recursos-irmãos (config/urls.py:15-16). *Default: `urls_logs.py` separado + segunda `include`.*
6. **Salvar por dia vs. autosave por campo** → **salvar por dia** (botão por seção → um `PUT` do dia → confirmação "Dados de [ontem/hoje] salvos."). Casa com a mensagem por-dia da AC5 e com "grava só se tudo válido" (validação atômica do lote). Autosave-por-campo (idioma HabitTracker) foi descartado por não casar com a confirmação por-dia. *Default: salvar por dia.*
7. **Limpar um valor** → enviar `null`/vazio remove a chave do blob (não grava `null`). *Default: remover a chave.*

### Project Structure Notes

- **Backend (estende `health/`):** `models.py` (+`HealthLog`), `services.py` (+`get_health_daily`/`upsert_health_log`/`_validate_value`), `serializers.py` (+`HealthLogSerializer`/`HealthDailySerializer`/`HealthLogWriteSerializer`), `views.py` (+2 views), `urls_logs.py` (novo), `admin.py` (+`HealthLog`), `migrations/0002_healthlog.py`, `tests/factories.py` (+`HealthLogFactory`+`register_isolation_case`), `tests/test_*.py` (+ casos de valor/merge/round-trip).
- **Backend (modificados):** `backend/config/urls.py` (rota `api/health-logs/`), `schema.yaml` (regenerado).
- **Frontend (estende `features/health/` + nova página):** `api.ts` (+2 hooks), `types.ts` (+`HealthValue`/read-model), `index.ts` (+exports), `components/HealthMetricsLog.tsx` + `components/HealthMetricRow.tsx` (novos), `pages/health/HealthMetricsPage.tsx` (novo).
- **Frontend (modificados):** `frontend/src/api/keys.ts` (`health.daily`), `frontend/src/api/types.gen.ts` (regenerado), `frontend/src/app/router.tsx` (element de `health/metrics`).
- Alinhamento total com a estrutura unificada (feature-folder isolada, service layer obrigatória, `TenantModel`, query-key factory, `APIView` fina, JSONB opaco §6.10). Sem variância além das decisões documentadas.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.2 linhas 1237-1258] — user story + ACs originais (3 blocos BDD)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7 linhas 1215-1281; #Epic-7 (visão) linhas 290-294] — objetivo do épico; ordem 7.1→7.2→7.3; espinha do ritual matinal
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-01 linhas 91-121] — schema JSONB, `health_logs (id,user_id,date,values)`, validação-no-serviço, cast analítico (7.3)
- [Source: _bmad-output/planning-artifacts/architecture.md#§6.3 linhas 897-898] — camelCase na borda; **exceção crítica** JSONB de chave dinâmica (`health_logs.values` não converte)
- [Source: _bmad-output/planning-artifacts/architecture.md#§6.4 linha 938] — tipagem de JSONB contra `health_field_definitions` é regra de negócio **no serviço**
- [Source: _bmad-output/planning-artifacts/architecture.md#§6.9 linhas 962-977] — enforcement/anti-padrões ("Converter chaves dinâmicas de JSONB para camelCase" proibido)
- [Source: _bmad-output/planning-artifacts/architecture.md#§6.10 linhas 996-1005] — `HealthLogSerializer` canônico (`values = JSONField()` opaco)
- [Source: _bmad-output/planning-artifacts/architecture.md#§7.1 linhas 892,1103-1104,1150-1151] — `values` tipado `Record<string, HealthValue>`; app `health`; sem FK com medications
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-14 linhas 728-736] — modo 3 (revisão histórica) sem NFR formal; latitude de índice/view materializada reservada
- [Source: backend/config/settings/base.py:201-209] — `JSON_CAMEL_CASE['JSON_UNDERSCOREIZE']['ignore_fields']=('values',)` **já configurado** (Épico 1)
- [Source: backend/core/tests/test_api_contract.py:14-60] — round-trip provado (blood_pressure não cameliza; renderer tem `values` em ignore_fields)
- [Source: backend/core/calendar.py:14-19] — `today_for(user)` (autoridade temporal; fuso do usuário)
- [Source: backend/health/{models,services,serializers,views,urls,admin}.py] — app de 7.1 a **estender** (padrões: TextChoices, APIView fina, split serializers, `DomainError`)
- [Source: backend/health/tests/factories.py] — `HealthFieldDefinitionFactory` + `register_isolation_case` (padrão a espelhar para `HealthLog`)
- [Source: backend/habits/models.py:153-205] — `HabitDayEntry` (UniqueConstraint por dia — precedente de unicidade)
- [Source: backend/habits/views.py:186-244] — `HabitDayView`/`HabitDayEntryDetailView` (precedente exato da "superfície do dia": GET read-model via `today_for`, escrita separada)
- [Source: backend/habits/serializers.py:158-167] — `HabitDaySerializer` (payload composto do dia — precedente para `HealthDailySerializer`)
- [Source: backend/bujo/serializers.py:8,46,56] — uso de `@extend_schema_field` (precedente para tipar `values` no contrato)
- [Source: backend/core/exceptions.py:29-114] — taxonomia (DomainError→409, 400 fields, 500 opaco)
- [Source: backend/conftest.py:19; backend/pyproject.toml:55-59] — `_ISOLATION_TEST_MODULES` (health já listado); import-linter (health já em forbidden_modules)
- [Source: frontend/src/features/health/{api,types,index}.ts; components/HealthMetricsManager.tsx] — feature de 7.1 a estender (config-CRUD, Select de tipo, editor de opções)
- [Source: frontend/src/features/habits/components/HabitTracker.tsx:28-263] — precedente da superfície do dia (NumericRow/BooleanRow, draft+commit, estados, constante de erro)
- [Source: frontend/src/api/keys.ts:48-54] — seção `health` com slot `logs` reservado para 7.2
- [Source: frontend/src/app/router.tsx:96-100,133-137] — rota `health/metrics` (placeholder a trocar); rota-irmã `settings/health-metrics` (7.1)
- [Source: frontend/src/app/layout/Sidebar.tsx:63; BottomNav.tsx:14,55] — nav "Saúde › Métricas" → `/health/metrics` (já cabeado; não tocar)
- [Source: frontend/src/pages/habits/HabitsPage.tsx:7-14] — mirror para `HealthMetricsPage`
- [Source: frontend/src/theme.ts] — `createBujoTheme`, 44px, flat/no-shadow, sx semântico
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md:112,140,144-160,238-248] — Saúde "sem inventar score"; renderização por tipo; State Patterns; fluxo do ritual matinal
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-accessibility-product.md:33,73] — Saúde: nomear resumo de período (7.3) sem importar analytics; log de ontem/hoje
- [Source: _bmad-output/implementation-artifacts/7-1-campos-de-saude-dinamicos.md] — story anterior (mesma feature): decisões, patterns, guardrails
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-19.md §3/§7/§9] — contrato aditivo, run escopado Neon, não varrer planejamento no commit
- [Source: memórias do projeto] — `commit-at-end-of-each-story`, `story-language-conventions`, `frontend-needs-node-22-via-nvm`, `sidebar-bottomnav-shared-tests-need-query-mock`, `ask-dont-assume-functionality-flows`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- `makemigrations health --name health_log` → `0002_health_log.py` (o `--name` gera `health_log`; a story citou `0002_healthlog` como rótulo aproximado — o conteúdo é o esperado: `CreateModel HealthLog` com `UniqueConstraint(user_id, date)`).
- Migration aplicada às branches Neon `dev` via `migrate health` (0001 + 0002 OK) e ao test DB via `pytest --create-db` (reconstrói com a nova migration).
- `spectacular` mostra 1 warning + 4 errors **pré-existentes** (signup sem serializer; `ToStatusEnum`) — nenhum relacionado a 7.2. Diff `schema.yaml`/`types.gen.ts` **puramente aditivo** (0 remoções; +133 linhas de schema).

### Completion Notes List

Story 7.2 entrega a **captura e o armazenamento de valores de saúde** (segunda metade da AD-01) sobre o catálogo de definições de 7.1.

**Decisões documentadas (todos os defaults #YOLO endossados, §Decisões a confirmar):**
1. **Sem gate por horário** — a superfície sempre mostra ontem-no-topo + hoje-abaixo (o rótulo "Ontem, [data]" ancora o ritual; sem detecção de horário → evita fragilidade de fuso).
2. **Superfície de escrita** = `PUT /api/health-logs/` (`{date, values}`, upsert-merge) + `GET /api/health-logs/daily/` (read-model).
3. **`decimal` = número cru** no JSONB (ex. `88.2`); tipo `HealthValue = number|boolean|string`. Optei por **`@extend_schema_field`** no `HealthValuesField` (não só o tipo manual): o contrato gera `Record<string, number|boolean|string>` utilizável **e** mantenho os aliases manuais em `types.ts`. Ambos entregam §7.1:892.
4. **Sem índice GIN** em `values` (deferido para 7.3; o cast `->>'uuid'::numeric` é range on-expression, não usa GIN — documentado inline no model).
5. **Wire de URL** = `urls_logs.py` + segunda `include`, espelhando `habits.urls` + `habits.urls_groups`.
6. **Salvar por dia** (botão por seção → um `PUT` → confirmação "Dados de [ontem/hoje] salvos.").
7. **`null`/`""` remove a chave** do blob (não grava `null`).

**Divergência de implementação registrada (guardrail "resolver por leitura literal + código + doc, documentar inline"):** a story sugeria "commit no blur/enter (idioma de `NumericRow`)" para as Rows. Como a Decisão 6 troca autosave-por-campo por **salvar-por-dia explícito**, as `HealthMetricRow` são **inputs controlados contra o estado da seção** (sem draft local + commit-no-blur). Isso elimina o bug do "último caractere não commitado ao clicar Salvar" e é mais simples/testável (jsdom `fireEvent.change`). Documentado inline em `HealthMetricRow.tsx`. Risco de mudança de 1 linha se o revisor preferir o commit-no-blur.

**AC2 (round-trip camelCase):** o campo se chama exatamente `values` (herda o `ignore_fields=("values",)` de base.py). Teste ponta-a-ponta dedicado em `health` (`test_daily_values_dynamic_keys_survive_camelcase_roundtrip`) prova via `response.content` (JSON renderizado de produção) que `blood_pressure` **não** vira `bloodPressure` e o UUID fica intacto — inspecionando o render real, não `response.data` (pré-render). Não confiei em "UUID não converte".

**AC1/AC4 (grava só se tudo válido + merge):** `upsert_health_log` valida **todo** o lote antes de qualquer write (`DomainError`→409); o merge preserva chaves não submetidas, inclusive de campos hoje inativos (teste `test_upsert_merge_preserves_inactive_field_key`). `bool` é rejeitado explicitamente para `integer`/`decimal` (bool é subclasse de int em Python).

**Nav/rotas:** só o `element` de `health/metrics` mudou (placeholder → `<HealthMetricsPage/>`). Sidebar/BottomNav **não** tocados; nada Query-driven na nav → os 3 testes compartilhados (`AppLayout`/`router`/`RouteAnnouncer`) seguem verdes. `router.test.tsx` **não** asserta o texto do placeholder de `/health/metrics` (verificado) → nenhum ajuste necessário.

**Contagens de teste (observadas literalmente; full-suite do Neon trava → run escopado por lotes, união reportada):**
- Backend (lotes `--reuse-db`, sem sobreposição — os 2 lotes particionam os 6 apps: `health/accounts/core` + `habits/bujo/braindump`): **Lote A `health accounts core` = 181 passed** · **Lote B `habits bujo braindump` = 470 passed** → **união = 651 passed** (0 falhas). Novos testes de 7.2 no app `health`: model (unicidade/default/uuid), serviço (validação por tipo, atomicidade, merge, upsert, read-model, isolamento), views (PUT 200/400/409, GET daily shape, isolamento, round-trip camelCase), serializers (forma do write).
- Frontend (`vitest run`, suíte completa): **689 passed** (62 arquivos), incluindo os novos `HealthMetricsLog.test.tsx` e os appends em `api.test.tsx`. `tsc` · ESLint · `vite build` verdes.

### File List

**Backend — novos:**
- `backend/health/migrations/0002_health_log.py` — model `HealthLog` (`UniqueConstraint(user_id, date)`).
- `backend/health/urls_logs.py` — rotas `/api/health-logs/` (PUT) + `/daily/` (GET).

**Backend — modificados:**
- `backend/health/models.py` — `+HealthLog` (JSONB `values` opaco, sem FK, unicidade por dia).
- `backend/health/services.py` — `+get_health_daily`, `+upsert_health_log`, `+_validate_value`.
- `backend/health/serializers.py` — `+HealthValuesField` (`@extend_schema_field`), `+HealthLogSerializer`, `+HealthDaySectionSerializer`, `+HealthDailySerializer`, `+HealthLogWriteSerializer`.
- `backend/health/views.py` — `+HealthLogDailyView`, `+HealthLogUpsertView`.
- `backend/health/admin.py` — `+HealthLogAdmin` (`all_objects`).
- `backend/config/urls.py` — `+path("api/health-logs/", include("health.urls_logs"))`.
- `backend/health/tests/factories.py` — `+HealthLogFactory` + `register_isolation_case("health.HealthLog")`.
- `backend/health/tests/test_models.py` — testes de `HealthLog` (unicidade, default, uuid).
- `backend/health/tests/test_services.py` — testes de `upsert_health_log`/`get_health_daily` (AC1/AC3/AC4).
- `backend/health/tests/test_views.py` — testes de `/health-logs/` + round-trip camelCase (AC2).
- `backend/health/tests/test_serializers.py` — testes de forma do `HealthLogWriteSerializer`/`HealthDailySerializer`.
- `schema.yaml` — regenerado (aditivo: `HealthDaily`, `HealthDaySection`, `HealthLog`, `HealthLogWrite`, 2 paths).

**Frontend — novos:**
- `frontend/src/features/health/components/HealthMetricRow.tsx` — control de valor por `field_type`.
- `frontend/src/features/health/components/HealthMetricsLog.tsx` — duas seções (ontem/hoje) + salvar-por-dia + estados.
- `frontend/src/features/health/components/HealthMetricsLog.test.tsx` — testes da superfície (AC3/AC4/AC5 + jest-axe).
- `frontend/src/pages/health/HealthMetricsPage.tsx` — página `/health/metrics` (mirror de HabitsPage).

**Frontend — modificados:**
- `frontend/src/api/keys.ts` — `+health.daily()`.
- `frontend/src/api/types.gen.ts` — regenerado (aditivo).
- `frontend/src/app/router.tsx` — `element` de `health/metrics`: placeholder → `<HealthMetricsPage/>`.
- `frontend/src/features/health/types.ts` — `+HealthValue`, `+HealthValues`, `+HealthDaily`, `+HealthDaySection`, `+HealthLog`.
- `frontend/src/features/health/api.ts` — `+useHealthDailyQuery`, `+useUpsertHealthLogMutation`.
- `frontend/src/features/health/index.ts` — exports dos novos hooks/tipos/componente.
- `frontend/src/features/health/api.test.tsx` — appends (daily query + upsert mutation).

**E2E (etapa de QA automation da story) — novos:**
- `frontend/e2e/health-log.spec.ts` — 4 specs da superfície `/health/metrics` (AC1–AC5) ponta-a-ponta contra a branch Neon `e2e`: ritual ontem/hoje + Row por tipo + salvar-por-dia + round-trip por UUID (T1); campo inativo some mas valor histórico preservado no merge (T2); empty state + link (T3); valor incompatível → 409 + erro inline + input preservado + retry (T4).
- `frontend/e2e/seedHealthFields.ts` — seed de definições ativas via `create_health_field` + `setHealthFieldActive` (des/reativar), devolvendo o map `{nome: uuid}` (idioma de `seedHabits.ts`).
- `_bmad-output/implementation-artifacts/tests/test-summary.md` — append da seção "Story 7.2" (cobertura por AC, resultado do run, gaps auto-aplicados).

### Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-07-19 | 0.1 | Implementação da Story 7.2 (log diário de saúde): model `HealthLog` + JSONB `values` validado por definição, `PUT /api/health-logs/` (upsert-merge) + `GET /daily/` (read-model ontem/hoje), superfície `/health/metrics` (Health Metric Row por tipo, salvar-por-dia). Status → review. | Amelia (dev-story) |
| 2026-07-19 | 0.2 | QA automation (E2E): `frontend/e2e/health-log.spec.ts` (4 specs, AC1–AC5) + seed `seedHealthFields.ts`, contra a branch Neon `e2e` (sem mocks). Gaps auto-aplicados: migração `health.0002_health_log` aplicada à branch `e2e` (estava pendente); timeouts folgados (30s/180s) para os stalls de cold-start do Neon. Run: 3 passed + 1 flaky (fixture de signup, passa no retry). | HugoMMBrito (qa-generate-e2e-tests) |
| 2026-07-19 | 0.3 | Code review (adversarial, auto-fix). 0 críticos. 1 MÉDIO + 2 BAIXOS corrigidos. Status → done. | HugoMMBrito (story-automator-review) |

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-19 · **Resultado:** ✅ Aprovado (done) — 0 issues críticos.

**Escopo:** todos os arquivos-fonte do commit `c513314` (backend `health/*`, `config/urls.py`; frontend `features/health/*`, `pages/health/*`, `api/keys.ts`, `api/types.gen.ts`, `app/router.tsx`) + os E2E não-commitados (`frontend/e2e/health-log.spec.ts`, `seedHealthFields.ts`). Excluídos da revisão: artefatos de planejamento/UX em `_bmad-output/` (trabalho paralelo).

**Veredito por AC:** AC1–AC5 **implementadas** e cobertas por testes reais (serviço/model/view/serializer no backend + unit + E2E no frontend). Tarefas `[x]` conferidas contra o código — nenhuma marcada como feita sem evidência. Sem discrepância git ↔ File List (E2E + `test-summary.md` são os artefatos ainda não-commitados esperados, consolidados no fim). Segurança/tenancy corretas (manager auto-escopado, JSONB `values` opaco, `DomainError`→409 / `ValidationError`→400, sem FK, sem `all_objects` indevido).

**Achados e correções auto-aplicadas:**
1. **[MÉDIO] `HealthMetricsLog` — erro de refetch em background destruía o contexto.** A guarda `daily.isError || !daily.data` acionava o estado de erro-bloqueante (desmontando as duas seções + rascunhos não salvos + a confirmação "Dados salvos.") num **erro de refetch em background** — alcançável via `refetchOnWindowFocus:true` + `staleTime:0` (queryClient) + os stalls de cold-start do Neon, e após cada save invalidar `['health']`. Contradizia a AC5 ("erro de leitura … **preserva contexto**"). **Fix:** a guarda passou a `if (!daily.data)` — o erro-bloqueante só ocorre na **leitura inicial** (sem dado a exibir); um erro de refetch mantém o último sucesso e preserva rascunhos/confirmação. Divergência de propósito do idioma de `HabitTracker` (documentada inline). *Arquivo: `frontend/src/features/health/components/HealthMetricsLog.tsx`.*
2. **[BAIXO] Docstring de módulo desatualizada em `health/views.py`** — dizia que os endpoints ficavam só sob `/api/health-field-definitions/`, mas o arquivo agora serve também `/api/health-logs/` (7.2). **Fix:** docstring atualizada para descrever os dois recursos-irmãos.
3. **[BAIXO] Ramo sem teste em `_validate_value` (cap de texto `>1000`).** O `_MAX_TEXT_LEN=1000` levantava `DomainError` sem cobertura. **Fix:** `test_upsert_text_rejects_over_max_len` (1000 passa; 1001 rejeita) em `test_services.py`.

**Observações não acionadas (por design, sem violação de AC):** (a) campos `boolean` persistem `false` ao salvar mesmo se intocados (toggle é binário; nenhuma AC proíbe); (b) o draft de uma seção não é re-semeado após um refetch bem-sucedido (correto para single-user — o draft espelha os valores salvos).

**Verificação pós-fix:** frontend `vitest run` **689 passed** (62 arquivos) + `tsc` limpo; backend `pytest health --reuse-db` **82 passed** (inclui o novo teste) + `ruff` limpo. Nenhum arquivo novo no File List (os 3 fixes tocaram arquivos já listados).
