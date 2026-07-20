---
baseline_commit: 84796a5be3da94b6a6fa0aabcf020872fb647c35
---

# Story 7.3: Histórico de saúde em três visualizações

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero consultar meu histórico de saúde em **três visualizações** — tabela dia a dia, gráfico de evolução por campo numérico e dashboard de resumo do período —,
Para que eu acompanhe a evolução das minhas métricas ao longo do tempo, sem confundir a captura diária (7.2) com a leitura analítica do passado (FR-3.3, AD-01, AD-14).

**Terceira e última story do Épico 7 (Métricas de Saúde).** É a **camada de LEITURA analítica** sobre o que a 7.1 (catálogo de definições) e a 7.2 (log diário `health_logs.values` JSONB) já materializaram. Espelha estruturalmente a **Story 6.4** (histórico + gráfico de Hábitos): superfície read-only, derivada **on-read**, **sem schema/migration/model novo** (AD-14 reserva a latitude de índice/view materializada). Diferenças-chave vs. 6.4: (1) Saúde **não versiona** e **não tem `day_type`/multiplicador** — então **não há marcadores de mudança nem sombreamento de ritmo** no gráfico (a série é uma linha simples com lacunas honestas); (2) os valores vivem num **blob JSONB de chave dinâmica** (UUID da definição), então a série numérica é derivada via **cast explícito do JSONB** (`(values->>'uuid')::numeric`, AD-01) e o dashboard resume o intervalo via **agregação com o mesmo cast**; (3) há **três** visualizações (tabela + gráfico + dashboard), não duas. A biblioteca de charting (`recharts@3.9.2`) **já está instalada** (6.4) — 7.3 **reusa**, não adiciona dependência.

> **Divergência-chave (repetida de 7.1/7.2, ainda válida):** Saúde **NÃO versiona** e **NÃO tem completude ponderada / score / `day_type` / multiplicador**. **Não** porte `habit_versions`/eventos/`ReferenceLine` de mudança/`ReferenceArea` de fim de semana de 6.4. Um campo é tipado pela **definição viva** (7.1), não por snapshot. O vínculo entre `health_logs.values` e as definições é o **UUID dentro do JSONB** (AD-01) — **sem FK**.

> **⚠️ Regra de ouro do JSONB (herdada da 7.2):** o campo é `values` e o `ignore_fields=("values",)` (`config/settings/base.py:207-208`) já preserva as chaves internas (UUIDs) na camelização em ambas as direções. 7.3 **lê** `values` (nunca escreve) e **nunca** cameliza as chaves dinâmicas. Ao expor `days[].values` no contrato, **reusar** o `HealthValuesField` (`@extend_schema_field`) já existente (`health/serializers.py:30-43`) — **não** modelar `values` como campo estruturado.

## Acceptance Criteria

### AC1 — Tabela por data: valores de cada campo dia a dia, tipados pela definição, read-only (FR-3.3, AD-01)

**Dado que** existe a superfície de **Histórico de Saúde** e um intervalo de datas selecionado,
**Quando** Hugo acessa a **visualização em tabela**,
**Então** a tabela exibe, **por data (dia a dia)**, os valores de cada campo a partir das linhas já existentes em `health_logs.values` (blob JSONB indexado por UUID de `health_field_definitions`) — **somente leitura** (nenhuma edição, marcação ou upsert nesta superfície; a captura continua na 7.2),
**E** cada **coluna respeita a definição do campo** para tipar/renderizar o valor: `integer`/`decimal` → número (formato pt-BR); `boolean` → sim/não factual; `enum`/`text` → string; a coluna existe para os campos **ativos** e também para campos **hoje inativos que possuem valor no intervalo** (a 7.2 preserva o histórico ao desativar — AC4 da 7.2; a tabela não pode esconder o passado),
**E** um dia **sem valor** para um campo (chave ausente no blob) aparece como **lacuna honesta** ("—", com texto/aria — nunca `0`/`false` fabricado); um dia **sem nenhuma linha** `health_logs` aparece vazio, sem fabricar valores.

### AC2 — Gráfico de evolução (campo numérico) via cast JSONB + dashboard de período (FR-3.3, AD-01)

**Dado que** Hugo seleciona um **campo numérico** (`integer`/`decimal`) e o intervalo,
**Quando** o **gráfico de evolução** é renderizado,
**Então** a **série diária** `(data, valor)` é derivada via **cast explícito do JSONB** — `Cast(KeyTextTransform('<uuid>', 'values'), FloatField())`, i.e. `(values->>'uuid')::numeric` ao longo do tempo (AD-01) — auto-escopada por tenant; dias sem valor para o campo aparecem como **quebras/lacunas na linha** (`connectNulls={false}`), **nunca** zero fabricado; o seletor de campo do gráfico oferece **apenas campos numéricos** (booleano/enum/texto não são plotáveis),
**E** o **dashboard de período** resume as métricas do intervalo selecionado: para cada campo **numérico**, um cartão com **contagem de registros, mínimo, máximo, média e valor mais recente** no período, computados via **agregação com o mesmo cast JSONB** (`Avg`/`Min`/`Max`/`Count` sobre a expressão castada) — não recalculados no frontend,
**E** o gráfico expõe `role="img"` + `aria-label` com **resumo textual** (campo, período, nº de dias com registro) e um `<figcaption>`; a **tabela (AC1) é a representação equivalente acessível** exigida pelo Accessibility Floor para o gráfico.

### AC3 — Read-only aditivo, on-read, sem schema novo, escopo por tenant, sem NFR (AD-14, §6.8, regra de porta)

**Dado que** AD-14 fixa que a **revisão histórica não tem NFR de performance formal** no MVP e que a latitude de otimização (índices, view materializada) fica **reservada**,
**Quando** os endpoints de histórico são adicionados,
**Então** são **GET puros read-only** — **nenhuma escrita, nenhuma materialização, nenhuma migration, nenhum model novo, sem `@transaction.atomic`** — com toda a lógica na **camada de serviço** (assinatura `*, user, …`), auto-escopada por tenant (fail-closed via `TenantManager`; **nunca** `all_objects`, **nunca** `user_id` cru na query), reusando `list_health_fields` (7.1) e o `HealthValuesField`/`HealthFieldDefinitionSerializer` (7.1/7.2) sem reimplementar,
**E** a **decisão de índice** (GIN deferido da 7.2) é resolvida e **documentada inline**: **sem índice nesta story** — o cast `(values->>'uuid')::numeric` é *range on-expression* sobre **chaves dinâmicas** (UUIDs), que nem o GIN (containment `@>`) nem um índice de expressão estático (chave conhecida) atendem genericamente; com AD-14 (sem NFR) e volume single-user, a latitude segue reservada,
**E** o contrato regenerado (`schema.yaml` + `frontend/src/api/types.gen.ts`) é **aditivo** — **nenhum enum novo** (reusa `HealthFieldTypeEnum`); `lint-imports` **KEPT**; nenhuma superfície existente regride (o log de 7.2, os 3 testes compartilhados da casca).

### AC4 — Acessibilidade, paridade tabular e voz (Accessibility Floor, UX-DR13, UX-DR18/DR20)

**Dado que** "gráficos previstos têm resumo textual e tabela equivalente" (Accessibility Floor do EXPERIENCE.md) e a superfície de saúde é read-only,
**Quando** a superfície de Histórico é renderizada,
**Então** a **tabela (AC1)** usa `<table>` semântica com **headers programáticos** (`<th scope="col">` para colunas, `<th scope="row">` para linhas), células anunciando **contexto + valor** (aria), alternativa de **lista no mobile** e **sem scroll horizontal** no fluxo diário mobile (UX-DR18); o **gráfico (AC2)** expõe `role="img"` + resumo textual (`<figure>`/`<figcaption>`),
**E** **cor nunca comunica sozinha**; **zero gamificação** (sem troféus, sequências, exclamações — UX-DR13); voz **pt-BR** direta e factual; estados obrigatórios cobertos: loading (skeleton, sem spinner global), vazio ("Nenhum registro no período." / "Nenhum campo de saúde para exibir."), erro de leitura (retry local, preserva contexto), e a superfície entra pela **casca de navegação existente** (abas dentro de Saúde, **sem** novo item de Sidebar/BottomNav que quebraria os 3 testes compartilhados).

## Decisões a confirmar (defaults para #YOLO — endossar todos e documentar inline)

Segue o guardrail institucionalizado (resolver ambiguidade por **leitura literal + código existente + arquitetura**, documentando inline; memória `ask-dont-assume-functionality-flows`). A UX **não produziu mockup fino** desta tela (mesmo gap da 7.2/6.4 — os workspaces de UX só têm menções genéricas: "consulta o histórico em três visualizações"). Os defaults abaixo **originam** a spec sob AD-01 + AD-14 + Accessibility Floor + o precedente direto de 6.4. Cada um é buildável de ponta-a-ponta; se Hugo vetar algum, ajustar a task correspondente.

1. **Onde mora a superfície (rota + navegação).** A 7.2 entregou `/health/metrics` (o log/registro). **Default:** transformar a página de Saúde num **shell com abas "Registro" · "Histórico"** (espelhando exatamente `HabitsTabs` de 6.4), com a sub-rota **`/health/metrics/history`**. **NÃO** adicionar item novo de Sidebar/BottomNav (evita a armadilha dos 3 testes compartilhados; as abas vivem no `<Outlet/>`). `BottomNav` já usa `startsWith('/health')` → a aba "Saúde" segue realçada na sub-rota; o item "Métricas" do Sidebar usa match exato de pathname → perde o realce em `/health/metrics/history` (**nit aceito**, idêntico ao de 6.4 em `/habits/history`; não tocar a estrutura do Sidebar).
2. **Endpoints (2, read-only, espelhando 6.4).** **Default:** `GET /api/health-logs/history/?start=&end=` (tabela dia a dia **+** dashboard de período — o dashboard é uma agregação do mesmo intervalo, um payload só) e `GET /api/health-logs/series/?field=<uuid>&start=&end=` (série de **um** campo numérico via cast). Ambos sob o módulo `health.urls_logs` já existente. Range **default** = últimos 30 dias (`end = today_for(user)`, `start = end − 29`) e **limitado** a 92 dias (`DomainError` → 400 se exceder), idêntico ao bound de 6.4 (`_MAX_RANGE_DAYS`).
3. **Quais campos entram na tabela (ativos vs. inativos-com-dado).** **Default:** a tabela mostra colunas para **campos ativos** (7.1) **e** para **campos inativos que têm ao menos um valor no intervalo** (a 7.2 preserva o histórico ao desativar — esconder a coluna apagaria o passado da visão). Cada coluna é tipada pela sua **definição** (mesmo inativa). Carregar as definições com `include_inactive=True` e filtrar para `active OR aparece em alguma linha do range`. Ordenar por `display_order, name` (Meta.ordering de 7.1).
4. **O cast: `FloatField` (não `DecimalField`).** **Default:** `Cast(KeyTextTransform(field_uuid, "values"), output_field=FloatField())` → `::double precision`. O `::numeric` do exemplo da AD-01 é **ilustrativo**; `FloatField` evita configurar `max_digits`/`decimal_places` (que um `DecimalField` de saída exigiria) e é adequado para gráfico/agregação (a captura em 7.2 já valida os números; não há requisito de precisão decimal exata na leitura analítica). **Segurança do cast:** filtrar `values__has_key=<uuid>` antes de castar; como `field_type` é **imutável** (7.1) e a 7.2 só grava número para `integer`/`decimal`, o texto castado é **sempre** numérico-parseável → o cast nunca estoura. Documentar essa invariante inline.
5. **Só campos numéricos são plotáveis/resumíveis.** **Default:** o seletor do gráfico e os cartões do dashboard oferecem **apenas** campos `integer`/`decimal`. `boolean`/`enum`/`text` aparecem **só na tabela** (AC1). Pedir série de um campo não-numérico → `DomainError` (400). Se **não houver** campo numérico no tenant, o gráfico e o dashboard mostram um estado vazio factual ("Nenhum campo numérico para gráfico/resumo."), e a tabela ainda funciona.
6. **Sem índice, sem migration (resolve o defer da 7.2).** **Default:** 7.3 é **read-only puro** — `makemigrations --check --dry-run` deve dizer "No changes detected". Nenhum GIN, nenhum índice de expressão (ver AC3 para o racional honesto). Confirmar explicitamente que **nada** é aplicado às branches Neon `dev`/`e2e` (diferente de 7.1/7.2, que tiveram migration).
7. **Layout do dashboard de período.** **Default:** uma faixa de **cartões de estatística** (um por campo numérico), cada cartão com rótulo do campo + 5 números factuais (registros, mín, máx, média, mais recente) — sem sparkline embutido (o gráfico dedicado já cobre a série; evita duplicar). **Carregar o skill `dataviz`** antes de escrever os cartões/gráfico (paleta, stat-tiles, acessibilidade). Estética "ferramenta, não produto" (UX-DR1): flat, sem elevação, cor nunca sozinha.
8. **Semântica de "mais recente" e agregação.** **Default:** "mais recente" = o valor do campo na **maior data com registro** dentro do intervalo (não a data de hoje se não houver registro). `média` = `Avg` do cast (arredondada só na exibição, pt-BR); `mín`/`máx`/`registros` = `Min`/`Max`/`Count` do cast. Booleano/enum/texto **não** entram no dashboard (Decisão 5).

## Escopo — o que NÃO entra nesta story (limites explícitos)

- ❌ **Qualquer escrita/mutação de valores** — a superfície é **100% read-only**. Preencher/editar métricas continua na **7.2** (`/health/metrics`, aba "Registro"). Nenhum `PUT`/`PATCH`/upsert, nenhum `@transaction.atomic`.
- ❌ **Model novo, coluna nova, migration nova, view materializada.** AD-14 reserva a latitude; 7.3 deriva tudo **on-read** de `health_logs`. Se um default parecer exigir schema, parar e reavaliar (provável erro de abordagem). **Nenhum índice** (Decisão 6/AC3).
- ❌ **Versionamento / snapshots / `effective_from` / `day_type` / multiplicador / marcadores de mudança / sombreamento de ritmo** — **não existem em Saúde** (AD-01). **Não** portar `habit_versions`/eventos/`ReferenceLine`/`ReferenceArea` de 6.4. O gráfico de saúde é uma **linha simples** (série + lacunas), sem anotações de evento.
- ❌ **Completude ponderada / score / "% de saúde" / totalizador** — Saúde não tem denominador ponderado (ao contrário de Hábitos). O dashboard resume **fatos por campo** (mín/máx/média/contagem), **nunca** um score inventado (EXPERIENCE.md:112,140; review-accessibility §33).
- ❌ **Gráfico para campos não-numéricos** (booleano/enum/texto) — fora do MVP desta story (Decisão 5). Eles aparecem só na **tabela**. (Um futuro "% de dias verdadeiro" para booleano é ideia de backlog, não aqui.)
- ❌ **Criar/editar/desativar definições** → é da **7.1** (`/settings/health-metrics`). 7.3 só **consome** as definições (inclusive inativas, para tipar colunas históricas).
- ❌ **Índice/otimização/paginação/`/api/daily/:date` agregado** — reservados (AD-14); não nesta story.
- ❌ **Novo item de Sidebar/BottomNav com filho Query-driven** — quebraria os 3 testes compartilhados da casca. Histórico é **aba/sub-rota** dentro de Saúde (Decisão 1).
- ❌ **Nova dependência de charting** — `recharts@3.9.2` **já** está no `package.json` (instalado na 6.4). **Reusar**; **não** `npm install` de lib nova.
- ❌ **Tema escuro como trabalho novo** — usar os tokens temáticos (`palette.category.*`, light/dark-aware) sem inventar spec dark; testes em `createBujoTheme('light')` (idem 6.4).

## Tasks / Subtasks

- [x] **Task 1 — Serviços read-only de histórico em `backend/health/services.py` (AC1, AC2, AC3)**
  - [x] `_validate_history_range(start, end)` (helper de módulo): `start <= end` senão `DomainError`; `(end - start).days > 92` senão `DomainError` (espelha `habits.services._validate_range`/`_MAX_RANGE_DAYS`). Constante local `_MAX_RANGE_DAYS = 92`.
  - [x] `get_health_history(*, user, start, end) -> dict` (**sem** `@transaction.atomic` — read-only): valida o range. **Uma** query `HealthLog.objects.filter(date__range=(start, end)).order_by("date")` (auto-escopada) → carrega as linhas do intervalo. Carrega as definições com `list_health_fields(user=user, include_inactive=True)`. Monta `fields` = definições que estão **ativas OU aparecem** em alguma chave de alguma linha do range (Decisão 3), ordenadas por `display_order, name`. Monta `days` = **uma entrada por linha `health_logs` existente** no range: `{date, values}` (o blob cru; o frontend tipa por definição). Monta `summary` = para cada campo **numérico** em `fields`, um `{field_id, count, min, max, avg, latest}` via a **agregação castada** (ver Task 2). Retorna `{start, end, fields, days, summary}`.
  - [x] `get_health_field_series(*, user, field_id, start, end) -> dict` (read-only): valida o range; carrega a definição (`HealthFieldDefinition.objects.get(id=field_id)` → deixa `DoesNotExist` virar 404 na view, cross-tenant = 404); se `field_type` **não** for `integer`/`decimal` → `DomainError` ("Só campos numéricos têm gráfico de evolução."). `points` = série `(date, value)` via **cast JSONB** (Task 2), ordenada por data; dias sem a chave são **omitidos** (o frontend desenha lacuna — mesmo idioma de 6.4). Retorna `{field: <definição>, points}`.
  - [x] Funções de **módulo** (nunca classes); `user` = primeiro kwarg keyword-only; scoping implícito via `TenantManager`; só exceções de `core/exceptions.py`. **Nenhuma** escrita → **nenhum** `@transaction.atomic`. **Nunca** `date.today()` cru (a resolução de "hoje" é da view via `today_for`).

- [x] **Task 2 — Cast JSONB explícito para série e agregação (AC2, AD-01)**
  - [x] Import: `from django.db.models import FloatField, Avg, Min, Max, Count` + `from django.db.models.functions import Cast` + `from django.db.models.fields.json import KeyTextTransform`.
  - [x] Helper `_numeric_expr(field_id) -> Cast`: `Cast(KeyTextTransform(str(field_id), "values"), output_field=FloatField())` — produz `(values->>'<uuid>')::double precision`, exatamente a operação da AD-01. **Segurança (Decisão 4):** sempre filtrar `.filter(values__has_key=str(field_id))` antes de anotar/castar; como `field_type` é imutável (7.1) e a 7.2 só grava número para campos numéricos, o texto castado é sempre parseável → o cast não estoura. Documentar a invariante inline.
  - [x] Série (para `get_health_field_series`): `HealthLog.objects.filter(date__range=(start, end), values__has_key=uuid).annotate(num=_numeric_expr(uuid)).order_by("date").values_list("date", "num")` → `[{date, value}]`.
  - [x] Agregação (para o `summary` de `get_health_history`): `HealthLog.objects.filter(date__range=(start, end), values__has_key=uuid).aggregate(count=Count("date"), min=Min(num), max=Max(num), avg=Avg(num))` (com `num=_numeric_expr(uuid)` anotado ou inline). `latest` = valor na maior data com registro (ex.: `.order_by("-date").values_list(num, flat=True).first()` sobre o mesmo filtro, ou derivar da série). Campo sem nenhum registro no range → `{count: 0, min: None, max: None, avg: None, latest: None}` (o frontend mostra "—"). **Nota N+1 aceitável:** uma agregação por campo numérico (poucos campos, single-user, sem NFR — AD-14); documentar que a otimização (single-pass) fica reservada.

- [x] **Task 3 — Serializers read-only em `backend/health/serializers.py` (AC1, AC2, AC3)**
  - [x] `HealthHistoryDaySerializer(Serializer)`: `date = DateField()`, `values = HealthValuesField()` (**reusar** o field opaco de 7.2 — chaves dinâmicas preservadas).
  - [x] `HealthPeriodSummarySerializer(Serializer)`: `field_id = UUIDField()`, `count = IntegerField()`, `min/max/avg/latest = FloatField(allow_null=True)`. (Números crus no wire — **não** string; a captura já é numérica e o dashboard consome números. Diferença consciente vs. hábitos, que serializam decimais como string.)
  - [x] `HealthHistorySerializer(Serializer)`: `start = DateField()`, `end = DateField()`, `fields = HealthFieldDefinitionSerializer(many=True)` (**reuso** de 7.1), `days = HealthHistoryDaySerializer(many=True)`, `summary = HealthPeriodSummarySerializer(many=True)`.
  - [x] `HealthSeriesPointSerializer(Serializer)`: `date = DateField()`, `value = FloatField(allow_null=True)`.
  - [x] `HealthFieldSeriesSerializer(Serializer)`: `field = HealthFieldDefinitionSerializer()`, `points = HealthSeriesPointSerializer(many=True)`.
  - [x] Todos **read-only** (sem `validate`/write). **Nenhum enum novo** (`field_type` já emite `HealthFieldTypeEnum` via `HealthFieldDefinitionSerializer`).

- [x] **Task 4 — Views + rotas GET read-only em `backend/health/` (AC1, AC2, AC3)**
  - [x] `health/views.py`: adicionar `_parse_date_param(raw, field)` + `_resolve_history_range(request)` (espelhar `habits/views.py:58-88`: `end = today_for(user)` default, `start = end − 29` default; `date.fromisoformat`, erro → `ValidationError`/400). `HealthHistoryView(APIView).get` → resolve range, chama `get_health_history`, serializa com `HealthHistorySerializer`; `@extend_schema` com `OpenApiParameter` `start`/`end`. `HealthFieldSeriesView(APIView).get` → resolve range + `field = request.query_params.get("field")` (obrigatório; ausente → 400); chama `get_health_field_series`; `HealthFieldDefinition.DoesNotExist` → `NotFound` (404, como as views existentes); `@extend_schema` com params `field`/`start`/`end`. Views **finas** (parse → serviço → serializer); **sem** transação/materialização.
  - [x] `health/urls_logs.py`: adicionar `path("history/", HealthHistoryView.as_view(), name="health-log-history")` e `path("series/", HealthFieldSeriesView.as_view(), name="health-log-series")` **antes** do `path("", HealthLogUpsertView...)` (rotas específicas antes da raiz, como `daily/` já é). **Nenhuma** mudança em `config/urls.py` (o prefixo `/api/health-logs/` já existe).
  - [x] **Não** tocar `HealthLogDailyView`/`HealthLogUpsertView` (7.2) nem as views de definições (7.1).

- [x] **Task 5 — Regenerar contrato + verificar aditividade (AC3)**
  - [x] `cd backend && uv run python manage.py spectacular --file ../schema.yaml` + (frontend, `nvm use 22.15.1`) `npm run generate-types`.
  - [x] Diff **aditivo**: novos schemas `HealthHistory`/`HealthHistoryDay`/`HealthPeriodSummary`/`HealthFieldSeries`/`HealthSeriesPoint` + 2 paths; **nenhum enum novo** (`HealthFieldTypeEnum` intacto); **0 remoções**. Se por descuido um enum novo aparecer, pinar em `SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"]` (`base.py:183-197`) — mas não é esperado.

- [x] **Task 6 — Frontend: keys + hooks read-only (AC1, AC2, AC3)**
  - [x] `frontend/src/api/keys.ts` seção `health` (após `daily`): `history: (range: { start: string; end: string }) => ['health', 'history', range] as const` e `series: (fieldId: string, range: { start: string; end: string }) => ['health', 'series', fieldId, range] as const` (sem `userId`, como o resto de `health.*`).
  - [x] `frontend/src/features/health/api.ts`: `useHealthHistoryQuery({ start, end })` (GET `/api/health-logs/history/?start=&end=`, key `keys.health.history`) e `useHealthFieldSeriesQuery(fieldId, { start, end })` (GET `/api/health-logs/series/?field=&start=&end=`, key `keys.health.series`; `enabled: fieldId !== ''`). **`useQuery` puro** (read-only; sem otimismo/prefetch — AD-14). Exportar em `index.ts`.
  - [x] `frontend/src/features/health/types.ts` + `index.ts`: re-exportar os tipos gerados novos (`HealthHistory`, `HealthHistoryDay`, `HealthPeriodSummary`, `HealthFieldSeries`, `HealthSeriesPoint`) de `components['schemas'][…]`.

- [x] **Task 7 — Frontend: shell com abas + página/rota de histórico (AC1, AC4, Decisão 1)**
  - [x] `frontend/src/pages/health/HealthMetricsTabs.tsx` (novo, mirror de `HabitsTabs.tsx`): abas "Registro" (`/health/metrics`) · "Histórico" (`/health/metrics/history`), via `Tab component={Link}`; `value` derivado do `location.pathname`.
  - [x] `frontend/src/pages/health/HealthMetricsPage.tsx` (7.2): inserir `<HealthMetricsTabs/>` acima de `<HealthMetricsLog/>` (o log vira a aba "Registro"). **Não** mudar o `aria-label="Métricas de Saúde"` da `<main>`.
  - [x] `frontend/src/pages/health/HealthHistoryPage.tsx` (novo, mirror de `HabitHistoryPage.tsx`): `<Box component="main" aria-label="Métricas de Saúde" sx={{ p: 3 }}>` com `<HealthMetricsTabs/>` + `<HealthHistory/>`. Compõe **só** `features/health` (fronteira §7.2).
  - [x] `frontend/src/app/router.tsx`: adicionar a rota `{ path: 'health/metrics/history', element: <HealthHistoryPage/>, handle: { title: 'Métricas de Saúde — Histórico' } }` (após `health/metrics`). **NÃO** tocar `Sidebar.tsx`/`BottomNav.tsx`.

- [x] **Task 8 — Frontend: as três visualizações em `features/health/components/` (AC1, AC2, AC4)**
  - [x] `HealthHistory.tsx` (orquestrador, mirror de `HabitHistory.tsx`): **controle de intervalo** (start/end via `TextField type="date"` + botões período anterior/próximo; locale pt-BR; *accessible name* com a data completa; datas manipuladas por **split de string / `Date` local**, nunca `new Date(iso)` — reusar o idioma `historyUtils` de 6.4). Compõe: dashboard + gráfico + tabela. Estados: loading (skeleton/`role=status`), vazio ("Nenhum registro no período."), erro inline (`role=alert` + retry).
  - [x] `healthHistoryUtils.ts` (novo): `formatDateBR`/`formatDateShortBR` (split de string, sem drift — copiar de `habits/components/historyUtils.ts`), `formatNumber` (Intl pt-BR) e `formatCellValue(fieldType, value)` (tipa a célula: número → pt-BR; boolean → "Sim"/"Não"; enum/text → string; ausente → "—").
  - [x] `HealthPeriodDashboard.tsx` (novo): faixa de **cartões de estatística** — um por campo numérico do `summary` (registros/mín/máx/média/mais recente, pt-BR). Estado vazio: "Nenhum campo numérico para resumo." **Carregar o skill `dataviz`** antes de estilizar (stat-tiles, hierarquia, cor nunca sozinha). `role`/rótulos factuais; sem gamificação.
  - [x] `HealthEvolutionChart.tsx` (novo, mirror **simplificado** de `HabitEvolutionChart.tsx`): seletor de **campo numérico**; `recharts` `LineChart` responsivo; linha única `value` por dia; `connectNulls={false}` para lacunas; **sem** `ReferenceLine`/`ReferenceArea`/eventos (Saúde não versiona/sem ritmo). Wrapper `role="img"` + `aria-label` de resumo (campo, período, nº de dias com registro) + `<figcaption>`. Cores via `theme.palette.category.*`; `Intl.NumberFormat('pt-BR')`; `isAnimationActive={false}`. Estado vazio: "Nenhum campo numérico para gráfico." / "Selecione um campo numérico."
  - [x] `HealthHistoryTable.tsx` (novo, mirror de `HabitHistoryGrid.tsx`): `<table>` semântica — **linhas = datas** (mais recente primeiro), **colunas = campos**; `<th scope="col">` campos (nome), `<th scope="row">` datas; célula = `formatCellValue(field.fieldType, day.values[field.id])`; **lacuna** = "—" honesto (texto/aria); célula com `aria-label` "campo, data: valor". **É a tabela equivalente acessível** do gráfico (AC4). **Mobile (<768px):** alternativa de **lista** por data — sem scroll horizontal (UX-DR18, `useMediaQuery`). Reusar o idioma `srOnly` de 6.4 se precisar de texto só-leitor-de-tela em `<th>` (axe `empty-table-header` exige texto visível).

- [x] **Task 9 — Testes backend (AC1, AC2, AC3)**
  - [x] `health/tests/test_services.py` (append): (a) `get_health_history` — `days` reflete só linhas existentes; `fields` inclui campo **ativo** e campo **inativo com valor no range**, exclui inativo sem valor; `summary` com `count/min/max/avg/latest` corretos para campo numérico (usar `HealthLogFactory` com datas fixas + `timedelta`; **sem** `date.today()`); campo numérico sem registro → summary zerado/`None`. (b) `get_health_field_series` — série ordenada por data com lacunas **omitidas**; campo **não-numérico** → `DomainError`; `field_id` inexistente/cross-tenant → `DoesNotExist` (→404 na view). (c) **cast**: valores `integer`/`decimal` castam corretamente (ex.: `88.2`, `4`); chave ausente não entra na série/aggregate. (d) `_validate_history_range` — `start>end` e `>92` → `DomainError`. (e) **não-materialização**: `HealthLog.objects.count()` inalterado antes/depois de qualquer leitura.
  - [x] `health/tests/test_views.py` (append): `GET /api/health-logs/history/` e `/series/` — 200 com shape correto (**`response.data` é snake_case**; wire JSON é camelCase); query params `start`/`end`/`field`; **isolamento cross-tenant** (tenant B não vê linhas de A → `days` vazio / série vazia; `field` de outro tenant → 404); range/data inválidos → 400; `field` numérico ok, não-numérico → 409 (`DomainError`), ausente → 400.
  - [x] `health/tests/test_serializers.py` (append, se útil): shapes read-only (`values` opaco preservado; `summary` numérico não-string). **Nenhum model novo → nenhum `register_isolation_case` novo** (a story não adiciona `TenantModel`).

- [x] **Task 10 — Testes frontend (AC1, AC2, AC4)**
  - [x] `features/health/api.test.tsx` (append): `useHealthHistoryQuery` e `useHealthFieldSeriesQuery` — endpoint/params/key corretos; `series` **desabilitado** com `fieldId=''`. Fixtures novas (camelCase; `values` com chave-UUID; `summary` numérico).
  - [x] `features/health/components/HealthHistory.test.tsx` (novo): controle de intervalo; loading/vazio/erro; compõe as três seções. `vi.mock('../../../api/client')`, wrapper `QueryClientProvider` (`retry:false`), `ThemeProvider theme={createBujoTheme('light')}`, `jest-axe` sem violações. **`vi.clearAllMocks()` (não `resetAllMocks`)** para não apagar o mock de `window.matchMedia` do `useMediaQuery` (armadilha registrada em 6.4).
  - [x] `features/health/components/HealthHistoryTable.test.tsx` (novo): `<table>` com headers programáticos; valor tipado por definição (número pt-BR, boolean "Sim/Não", enum/texto string); **lacuna "—"** para chave ausente; lista mobile; a11y.
  - [x] `features/health/components/HealthEvolutionChart.test.tsx` (novo): série renderiza; `role="img"`/`aria-label` de resumo + `<figcaption>`; seletor só com campos numéricos; estado vazio. **Nota jsdom+recharts (de 6.4):** `ResponsiveContainer` precisa de `ResizeObserver` + `getBoundingClientRect` mockados (dimensões fixas num `beforeAll`); assertar o DOM próprio (role/aria/legenda), não o SVG.
  - [x] `features/health/components/HealthPeriodDashboard.test.tsx` (novo): um cartão por campo numérico com os 5 números; estado vazio sem campo numérico; a11y.
  - [x] Confirmar que a nova aba/rota **não** afeta os 3 testes compartilhados (`AppLayout`/`router`/`RouteAnnouncer`): a superfície vive no `<Outlet/>`; **nada** Query-driven entra em `Sidebar`/`BottomNav`. Se `router.test.tsx`/`RouteAnnouncer.test.tsx` mockam `../features/health` ou `../pages/health/*`, garantir que os novos exports não quebrem o mock.

- [x] **Task 11 — Verificação e contrato (AC3)**
  - [x] Backend verde: `ruff` (health) · `lint-imports` (**KEPT** — `health` não ganha aresta cross-app nova; lê só `HealthLog`/definições locais + `core.calendar.today_for`) · `pytest` escopado `health accounts core --reuse-db` (full-suite do Neon trava → run por lotes, **contagem honesta da união**, nunca escopada-como-total; guardrail Retro Épico 11) · `spectacular` + diff `types.gen.ts` **aditivo**.
  - [x] Frontend verde: **`nvm use 22.15.1`** antes de todo comando · `tsc` · ESLint (fronteira: `pages/health` compõe só `features/health`; `features/health` não importa outra feature) · `vitest run` (suíte completa; colar total + novos literalmente) · `vite build` (o aviso de chunk >500 kB do recharts é **esperado**, não erro).
  - [x] **Sem migrations nesta story** (read-only): `makemigrations --check --dry-run` → "No changes detected". **Nada** a aplicar nas branches Neon `dev`/`e2e` (confirmar explicitamente — diferente de 7.1/7.2).

## Dev Notes

### Contexto de arquitetura — 7.3 é a LEITURA analítica da AD-01 (7.1 catálogo → 7.2 valores → 7.3 histórico)

A AD-01 tem três partes; 7.3 fecha a terceira [Source: architecture.md#AD-01 linhas 91-121]:
- **Escrita** (7.2): serviço valida cada valor contra `health_field_definitions` e grava em `health_logs.values`.
- **Leitura tipada** (7.2): serviço usa as definições para tipar/renderizar cada campo.
- **Queries analíticas (gráficos)** — **ESTA story**: *"cast explícito via operadores JSONB (`(values->>'uuid')::numeric`)"* [Source: architecture.md#AD-01 linha 121].

E AD-14 governa o modo de leitura histórica [Source: architecture.md#AD-14 linhas 728-736]:
> *"Modo 3 (revisão histórica) — sem NFR de performance formal no MVP; a latitude de otimização (índices, view materializada) fica reservada."*

Por isso 7.3 é **read-only, on-read, sem schema novo** — exatamente o shape de 6.4 (que fez o mesmo para Hábitos). O que 6.4 provou operacionalmente e 7.3 reusa: superfície de histórico como **aba dentro da feature** (não item de nav), gráfico com **tabela equivalente acessível**, `useQuery` puro sem otimismo, contrato **aditivo**, **zero migration**.

### Mapa de derivação on-read (o que cada visualização lê)

| Visualização | Fonte na leitura | Como é derivada |
|---|---|---|
| **Tabela** (AC1) | `health_logs.values` (blob por dia) + definições (7.1) | 1 query de linhas no range; tipa cada célula pela **definição viva**; chave ausente = "—" honesto |
| **Gráfico** (AC2) | `values->>'uuid'` de **um** campo numérico | **cast JSONB** `Cast(KeyTextTransform(uuid,'values'), FloatField())`; série `(data, valor)`; dias sem a chave = lacuna |
| **Dashboard** (AC2) | agregação do mesmo cast no range | `Count`/`Min`/`Max`/`Avg` + `latest` (maior data com registro) por campo numérico |

**Diferença central vs. 6.4 (não confundir):** Hábitos tinha **três fontes de variação** (valor, evento de config, ritmo de tipo de dia) → marcadores + sombreamento. **Saúde não tem nenhuma dessas** — sem versão, sem `day_type`, sem multiplicador. O gráfico de saúde é **uma linha simples**. **Não** porte `ReferenceLine`/`ReferenceArea`/`describeEvent`/`day_types` de 6.4.

### O cast JSONB — a técnica nova desta story (AC2, AD-01)

Não há precedente de cast JSONB no backend (grep confirma: 7.3 o introduz). Padrão a usar (ORM, não SQL cru):

```python
from django.db.models import Avg, Count, FloatField, Max, Min
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast

def _numeric_expr(field_id):
    # (values ->> '<uuid>')::double precision — a operação da AD-01.
    return Cast(KeyTextTransform(str(field_id), "values"), output_field=FloatField())

# Série (um campo):
(HealthLog.objects
    .filter(date__range=(start, end), values__has_key=str(field_id))  # segurança do cast
    .annotate(num=_numeric_expr(field_id))
    .order_by("date")
    .values_list("date", "num"))

# Agregado (dashboard):
(HealthLog.objects
    .filter(date__range=(start, end), values__has_key=str(field_id))
    .aggregate(count=Count("date"), min=Min(_numeric_expr(field_id)),
               max=Max(_numeric_expr(field_id)), avg=Avg(_numeric_expr(field_id))))
```

- **`values__has_key` antes de castar** (Decisão 4): garante que só linhas com a chave entram; `field_type` **imutável** (7.1) + 7.2 só grava número para numéricos → o texto é sempre parseável → o cast **não estoura**. Se um dia essa invariante mudar (não deve), o `has_key` limita o risco à linha, não à query.
- **`FloatField`, não `DecimalField`**: o `::numeric` da AD-01 é ilustrativo; `FloatField` (`::double precision`) evita configurar `max_digits`/`decimal_places` e serve gráfico/agregação (Decisão 4). Os números vão **crus** no wire (não string — diferente de hábitos).
- **Auto-escopo**: `HealthLog.objects` é o `TenantManager` → a query já filtra por tenant (fail-closed). O `annotate`/`aggregate` herdam o escopo. **Nunca** `all_objects`.
- **N+1 aceitável** (uma agregação por campo numérico): poucos campos, single-user, AD-14 sem NFR. Documentar que o single-pass fica reservado.

### Camada de leitura — assinaturas e contrato (§6.2, §6.3)

`get_health_history(*, user, start, end)` e `get_health_field_series(*, user, field_id, start, end)` — funções de módulo, `user` keyword-only primeiro, **sem** `@transaction.atomic`, só `DomainError`. Espelham `habits.services.get_habit_history_range`/`get_habit_series` [Source: backend/habits/services.py:431-505,558+]. Views finas `APIView` + `@extend_schema` com `OpenApiParameter` de range, parse via `_parse_date_param`/`_resolve_history_range` (copiar o idioma de `habits/views.py:51-88` — `end = today_for(user)` default, `start = end − 29`) [Source: backend/habits/views.py:51-88]. `DoesNotExist` → `NotFound` (404), `DomainError` → 409, parse inválido → 400 [Source: backend/core/exceptions.py].

Endpoints sob o `health.urls_logs` já existente (recurso-irmão de `daily/`/upsert) [Source: backend/health/urls_logs.py]:

| Método & rota | Ação |
|---|---|
| `GET /api/health-logs/history/?start=&end=` | tabela dia a dia + dashboard: `{start, end, fields, days:[{date,values}], summary:[{fieldId,count,min,max,avg,latest}]}` |
| `GET /api/health-logs/series/?field=<uuid>&start=&end=` | série de 1 campo numérico: `{field, points:[{date,value}]}` (via cast) |

**Contrato aditivo, zero enum novo:** `field_type` já emite `HealthFieldTypeEnum` (pinado em `ENUM_NAME_OVERRIDES`, `base.py:197`); `values` reusa `HealthValuesField` (opaco, `@extend_schema_field`). Regenerar `schema.yaml` + `types.gen.ts` puramente aditivo [Source: backend/health/serializers.py:30-43; backend/config/settings/base.py:183-197].

### Frontend — estender `features/health/` + shell com abas (reusar 6.4/7.2)

A feature **já existe** (7.1/7.2): `api.ts`, `types.ts`, `index.ts`, `keys.ts` (seção `health`), `HealthMetricsLog`. 7.3 **adiciona**:
- **`api.ts`**: `useHealthHistoryQuery` + `useHealthFieldSeriesQuery` (`useQuery` puro; `series` com `enabled: fieldId !== ''`) — mesmo idioma de `useHabitHistoryQuery`/`useHabitSeriesQuery` [Source: frontend/src/features/habits/api.ts (6.4)].
- **`keys.ts`**: `health.history`/`health.series` (sem `userId`, como o resto de `health.*`) [Source: frontend/src/api/keys.ts:48-56].
- **Shell com abas** "Registro" · "Histórico": `HealthMetricsTabs` (mirror exato de `HabitsTabs.tsx`), `HealthMetricsPage` ganha a aba, `HealthHistoryPage` novo (mirror de `HabitHistoryPage.tsx`), rota `/health/metrics/history` em `router.tsx` [Source: frontend/src/pages/habits/HabitsTabs.tsx, HabitsPage.tsx, HabitHistoryPage.tsx; frontend/src/app/router.tsx:97-101].
- **Três componentes** em `features/health/components/`: `HealthHistory` (orquestrador, mirror de `HabitHistory`), `HealthHistoryTable` (mirror de `HabitHistoryGrid` — a **tabela acessível**), `HealthEvolutionChart` (mirror **simplificado** de `HabitEvolutionChart` — sem eventos/ritmo), `HealthPeriodDashboard` (novo — cartões de estatística), `healthHistoryUtils` (formatação de data por split de string + `formatCellValue` por tipo) [Source: frontend/src/features/habits/components/HabitHistory.tsx, HabitHistoryGrid.tsx, HabitEvolutionChart.tsx, historyUtils.ts].

**`recharts@3.9.2` já instalado** (6.4) — **reusar**, sem `npm install`. Padrão do gráfico: `LineChart`/`ResponsiveContainer`/`XAxis`/`YAxis`/`CartesianGrid`/`Line connectNulls={false}`/`Tooltip`, cores `theme.palette.category.*`, `role="img"` + `<figure>`/`<figcaption>` [Source: frontend/src/features/habits/components/HabitEvolutionChart.tsx; frontend/package.json].

**Datas sem drift de fuso:** as datas chegam como `"YYYY-MM-DD"`; formatar por **split de string**, nunca `new Date(iso)` (parse UTC recuaria um dia) — reusar `formatDateBR`/`formatDateShortBR` de `historyUtils` [Source: frontend/src/features/habits/components/historyUtils.ts:12-23; frontend/src/features/health/components/HealthMetricsLog.tsx:17-29].

### UX — fonte canônica, Accessibility Floor e o gap de mockup

- **Canônico:** `ux-designs/ux-hmmb-bujo-2026-07-17/` (DESIGN.md + EXPERIENCE.md); `2026-06-15/` é **LEGADO CONGELADO** [Source: ux-hmmb-bujo-2026-06-15/LEGACY.md].
- **Gap de mockup:** a tela detalhada de histórico de saúde **não foi produzida** (mesmo gap de 7.2/6.4). Apoiar-se nos contratos de componente do design-system + o precedente direto de 6.4 [Source: 7.2 Dev Notes; 6.4 §"Decisões a confirmar"].
- **Accessibility Floor (obrigatório, parte do aceite):** *"gráficos previstos têm resumo textual e tabela equivalente"* — a **tabela (AC1) É a equivalente** do gráfico (mata dois requisitos com um componente, como a grade de 6.4); `role="img"`+`aria-label`/`<figcaption>`; headers programáticos; célula anuncia contexto+valor; **cor nunca sozinha**; sem scroll horizontal mobile (lista alternativa) [Source: EXPERIENCE.md#Accessibility-Floor linhas ~155-165; #Responsive; UX-DR18/DR20].
- **Voz (UX-DR13):** pt-BR direto, **zero gamificação** (sem troféus/sequências/exclamações); estados vazios informativos ("Nenhum registro no período.", "Nenhum campo numérico para gráfico.") [Source: EXPERIENCE.md#Voice; epics.md#UX-DR13].
- **Saúde sem score inventado:** o dashboard resume **fatos por campo** (mín/máx/média/contagem), nunca um "% de saúde" [Source: EXPERIENCE.md:112,140; review-accessibility-product.md:33].
- **Skill `dataviz`:** carregar antes de codar gráfico e cartões de estatística (paleta, stat-tiles, legendas, cor acessível) [Source: skill `dataviz`; 6.4 Task 8].

### Armadilha dos 3 testes compartilhados (memória do projeto — CONFIRMADA)

`AppLayout.test.tsx`/`router.test.tsx`/`RouteAnnouncer.test.tsx` renderizam a casca **sem** `QueryClientProvider`, sobrevivendo só porque `vi.mock`am os filhos de nav com Query. A superfície de histórico é **aba/página no `<Outlet/>`** → **não** os afeta, **desde que** nada Query-driven entre no `Sidebar`/`BottomNav`. **Não** adicionar item novo de nav (Decisão 1). Se `router.test.tsx`/`RouteAnnouncer.test.tsx` mockam `../pages/health/*` ou `../features/health`, garantir que os novos exports não quebrem o mock [Source: memória `sidebar-bottomnav-shared-tests-need-query-mock`; 6.4/7.2 Dev Notes].

### Testes — idiomas herdados (backend e frontend)

**Backend** [Source: backend/conftest.py; backend/health/tests/; 6.4/7.2]:
- `conftest.py` dá DB autouse + `user`/`other_user`/`api_client`/`auth_client` (corpo em `tenant_context(user)`; **`response.data` é snake_case**, camelização só no renderer JSON).
- `HealthLogFactory` já existe (7.2): `class Params`/`SelfAttribute`, `date` **fixa** (nunca `date.today()`), `values` dict. Reusar; **datas fixas + `timedelta`**.
- **Nenhum model novo → nenhum `register_isolation_case` novo** (read-only; idem 6.4).
- **Cross-tenant + fail-closed**: tenant B não vê linhas de A (`days`/série vazios); `field` de outro tenant → 404.
- **Contagem honesta**: full-suite do Neon **trava** → run escopado `pytest health accounts core --reuse-db` + lotes; reportar a **união**, nunca uma contagem escopada como total (guardrail Retro Épico 11).

**Frontend** [Source: 6.4/7.2 test files; test-setup.ts]:
- vitest + RTL, `fileParallelism:false` (default — **não** passar flags). `vi.mock('../../../api/client')` + wrapper `QueryClientProvider` (`retry:false`) + `ThemeProvider(createBujoTheme('light'))`. `jest-axe` sem violações. **Sem MSW.**
- **`vi.clearAllMocks()` (não `resetAllMocks`)**: `resetAllMocks` apaga o mock global de `window.matchMedia` do qual `useMediaQuery` (na tabela) depende (armadilha registrada em 6.4).
- **jsdom + recharts**: `ResponsiveContainer` precisa de `ResizeObserver` + `getBoundingClientRect` mockados (dimensões fixas num `beforeAll`); assertar o DOM próprio (role/aria/figcaption), não o SVG (padrão de 6.4).
- **axe `empty-table-header`**: `<th>` precisa de texto **visível** (não só `aria-label`); usar `srOnly` para o rótulo completo (padrão de 6.4).

### Ambiente / CI / operação

- **Node ≥ 22.15.1 via nvm** antes de todo comando de frontend (`nvm use 22.15.1`; a sessão inicia em v18) [Source: memória `frontend-needs-node-22-via-nvm`].
- **Sem migrations nesta story** (read-only) → **nada** a aplicar nas branches Neon `dev`/`e2e` (diferente de 7.1/7.2). Confirmar com `makemigrations --check --dry-run` [Source: memória `apply-new-migration-to-neon-e2e-branch-before-e2e` — não se aplica aqui, mas confirmar explicitamente].
- **Full-suite do Neon trava** (recorrente): fallback = run escopado por lotes para contagem honesta. **Vitest não roda no CI** — rede local/review.
- **Gates de CI** (ordem): backend `ruff` → `lint-imports` → `pytest` → `spectacular` + diff `types.gen.ts`; frontend `tsc` → ESLint → `vite build` [Source: .github/workflows/ci.yml].
- **Commit ao fim da story**: 1 commit/story; rodar `/bmad-uncommitted-report`, salvar o report, então commitar **sem** pedir "[S]im". **Não** varrer para o commit as mudanças de planejamento/UX do Hugo no working tree (`architecture.md`, `epics.md`, `ux-designs/*`, `specs/*`, `_bmad-output/story-automator/*`) — trabalho paralelo dele [Source: memórias `commit-at-end-of-each-story`; epic-6-retro §9].

### Inteligência das stories anteriores (7.1, 7.2, 6.4)

[Source: 7-1-campos-de-saude-dinamicos.md; 7-2-log-diario-de-saude.md; 6-4-historico-por-data-e-grafico-de-evolucao.md]:
- **`values` DEVE se chamar `values`** e reusar `HealthValuesField` (7.2) — o round-trip camelCase depende do `ignore_fields`. 7.3 só **lê**; nunca cameliza chave dinâmica.
- **`field_type` imutável** (7.1) é o que torna o cast **seguro** (um campo numérico nunca vira texto). Reforço da Decisão 4.
- **Números crus no wire** para o dashboard/série (Float), consciente vs. a convenção decimais-como-string de hábitos — Saúde nunca adotou string (7.2 tipou `HealthValue = number|boolean|string`).
- **6.4 é o molde estrutural**: recharts já instalado (`3.9.2`), abas dentro da feature, grade-como-tabela-acessível, `useQuery` puro, contrato aditivo, zero migration, mocks de recharts em jsdom, `vi.clearAllMocks`. **Simplificar** (sem eventos/ritmo).
- **File List completo e honesto**: nomear modificados (`services.py`, `serializers.py`, `views.py`, `urls_logs.py`, `keys.ts`, `api.ts`, `types.ts`, `index.ts`, `router.tsx`, `HealthMetricsPage.tsx`, `schema.yaml`, `types.gen.ts`) e novos (componentes, páginas, testes). Contagem de testes **colada literalmente** após rodar (guardrail Retro Épico 3/11).
- **Guardrail "resolver design não-explícito por leitura literal + código + doc e documentar inline"** — aplicado nas Decisões acima.

### Project Structure Notes

- **Backend (estende `health/`, read-only):** `services.py` (+`get_health_history`, +`get_health_field_series`, +`_numeric_expr`, +`_validate_history_range`; **sem** `@transaction.atomic`), `serializers.py` (+5 serializers read-only, reusa `HealthValuesField`/`HealthFieldDefinitionSerializer`), `views.py` (+`HealthHistoryView`, +`HealthFieldSeriesView` + parse de range), `urls_logs.py` (+`history/`, +`series/`), `tests/test_services.py`/`test_views.py`/`test_serializers.py` (+testes). **Sem** model/migration/admin/factory nova; **sem** isolation case novo.
- **Backend (não tocar):** `models.py`, `migrations/`, `config/urls.py`, `core/*`; `settings/base.py` só se um enum novo escapar (não esperado).
- **Frontend (estende `features/health/` + páginas):** `api.ts` (+2 hooks), `keys.ts` (+`health.history`/`health.series`), `types.ts`/`index.ts` (+tipos/exports), `components/HealthHistory.tsx` + `HealthHistoryTable.tsx` + `HealthEvolutionChart.tsx` + `HealthPeriodDashboard.tsx` + `healthHistoryUtils.ts` (novos) + testes; `pages/health/HealthMetricsTabs.tsx` + `HealthHistoryPage.tsx` (novos), `HealthMetricsPage.tsx` (+abas), `app/router.tsx` (+rota).
- **Frontend (não tocar):** `Sidebar.tsx`, `BottomNav.tsx`, `HealthMetricsLog.tsx`/`HealthMetricRow.tsx` (7.2). `package.json` **inalterado** (recharts já lá).
- **Regenerados:** `schema.yaml`, `frontend/src/api/types.gen.ts`.
- Alinhamento total com a estrutura unificada (feature-folder isolada, service layer, `TenantManager` auto-escopado, query-key factory, `APIView` fina, JSONB opaco §6.10, fronteira `pages/`→`features/`). Sem variância além das decisões documentadas.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.3 linhas 1260-1281] — user story + ACs originais (tabela; gráfico via cast JSONB; dashboard de período; sem NFR/latitude de índice)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7 linhas 290-294, 1215-1218] — objetivo do épico; ordem 7.1→7.2→7.3; "três visualizações"
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-01 linhas 91-121] — schema JSONB; **cast explícito `(values->>'uuid')::numeric` em queries analíticas**; sem FK (vínculo = UUID no blob); Saúde não versiona
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-14 linhas 728-736] — modo 3 (revisão histórica) **sem NFR de performance**; latitude de índice/view materializada **reservada**
- [Source: _bmad-output/planning-artifacts/architecture.md §6.8] — materialização/cálculo só no serviço; leitura derivada on-read
- [Source: _bmad-output/planning-artifacts/architecture.md §6.3, §6.9, §6.10] — camelCase na borda; **exceção JSONB de chave dinâmica** (`values` não converte); `HealthValuesField` opaco
- [Source: _bmad-output/planning-artifacts/architecture.md §7.1-7.2] — estrutura frontend (pages/ compõe features/; barrel; ESLint boundary)
- [Source: backend/health/models.py:72-117] — `HealthLog` (blob `values` JSONB, unicidade por dia, nota do GIN deferido para 7.3)
- [Source: backend/health/services.py:46-55,163-224] — `list_health_fields` (reusar, com `include_inactive`), padrões de serviço (funções de módulo, só `DomainError`)
- [Source: backend/health/serializers.py:30-43,46-53,114-160] — `HealthValuesField` (`@extend_schema_field`, reusar), `HealthFieldDefinitionSerializer` (reusar), split leitura/escrita
- [Source: backend/health/views.py:86-119] — `HealthLogDailyView`/`HealthLogUpsertView` (7.2, não tocar; padrão `APIView` fina + `@extend_schema`)
- [Source: backend/health/urls_logs.py] — módulo de URLs do log (adicionar `history/`/`series/`; não tocar `config/urls.py`)
- [Source: backend/habits/services.py:431-505,558+] — `_validate_range`/`get_habit_history_range`/`get_habit_series` (molde read-only: range bound 92 dias, uma query, sem `@transaction.atomic`)
- [Source: backend/habits/views.py:51-88] — `_parse_date_param`/`_resolve_history_range`/`_HISTORY_RANGE_PARAMS` (molde de parse de range: `today_for` default, `end−29`)
- [Source: backend/core/calendar.py:14-19] — `today_for(user)` (autoridade temporal; nunca `date.today()` cru)
- [Source: backend/core/exceptions.py] — taxonomia (`DomainError`→409, 400 fields, 404, 500 opaco)
- [Source: backend/config/settings/base.py:183-197] — `SPECTACULAR_SETTINGS`/`ENUM_NAME_OVERRIDES` (`HealthFieldTypeEnum` pinado; não emitir enum novo)
- [Source: backend/pyproject.toml] — contrato import-linter (`health` sem aresta cross-app nova → `lint-imports` KEPT)
- [Source: frontend/src/features/habits/components/HabitHistory.tsx, HabitHistoryGrid.tsx, HabitEvolutionChart.tsx, historyUtils.ts] — precedente direto das três visualizações (**simplificar**: sem eventos/ritmo)
- [Source: frontend/src/pages/habits/HabitsTabs.tsx, HabitsPage.tsx, HabitHistoryPage.tsx] — molde do shell com abas + sub-rota (mirror para Saúde)
- [Source: frontend/src/features/health/{api,types,index}.ts; components/HealthMetricsLog.tsx] — feature de 7.1/7.2 a estender (hooks, tipos, formatação de data sem drift)
- [Source: frontend/src/api/keys.ts:33-56] — factory de query-keys (`habits.history`/`series` como molde para `health.*`)
- [Source: frontend/src/app/router.tsx:91-101] — rotas de habits (`/habits/history` como molde) e de health (`/health/metrics`)
- [Source: frontend/src/app/layout/Sidebar.tsx:62-64; BottomNav.tsx:14,20] — nav de Saúde (BottomNav `startsWith('/health')` OK; Sidebar match exato = nit aceito; **não tocar**)
- [Source: frontend/src/theme.ts] — `createBujoTheme`, `palette.category.*` (séries), tokens light/dark, 44px, flat
- [Source: frontend/package.json] — `recharts@3.9.2` **já instalado** (6.4); reusar sem `npm install`
- [Source: _bmad-output/implementation-artifacts/6-4-historico-por-data-e-grafico-de-evolucao.md] — molde estrutural completo (mocks recharts jsdom, `vi.clearAllMocks`, grade-como-tabela-acessível, contrato aditivo, zero migration)
- [Source: _bmad-output/implementation-artifacts/7-1-campos-de-saude-dinamicos.md; 7-2-log-diario-de-saude.md] — stories anteriores (mesma feature): `field_type` imutável, `HealthValuesField`, `HealthLogFactory`, round-trip camelCase, decisões documentadas inline
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-19.md §3/§7/§9; epic-11-retro §3] — contrato aditivo, run escopado Neon, contagem honesta, não varrer planejamento no commit
- [Source: skill `dataviz`] — guia de design de gráfico e stat-tiles (carregar antes de codar as visualizações)
- [Source: memórias do projeto] — `commit-at-end-of-each-story`, `story-language-conventions`, `frontend-needs-node-22-via-nvm`, `sidebar-bottomnav-shared-tests-need-query-mock`, `ask-dont-assume-functionality-flows`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, contexto de 1M)

### Debug Log References

- **Neon lento (recorrente):** o run do `pytest health/` levou ~4 min só de I/O de conexão (15s de CPU em 15 min). Rodado em lotes escopados (`health`, depois `accounts core`) para contagem honesta — full-suite do Neon trava (guardrail Retro Épico 11).
- **Status 400 vs 409 na série (ambiguidade resolvida inline):** a story tinha uma contradição interna — Decisão 5 dizia "campo não-numérico → DomainError (400)" e a Task 9 dizia "não-numérico → 409". Resolvido por **precedente do próprio app**: a 7.2 já retorna **409** para conflito de tipo (`test_put_invalid_value_type_returns_409`); um campo não-numérico pedido para gráfico é o mesmo tipo de conflito → **409**. Range inválido (start>end / >92 dias) → **400** (parâmetro de requisição ruim, espelha a history view de 6.4). Para separar os dois `DomainError` na mesma view, a série valida o range **na view** (→400) e deixa o não-numérico propagar do serviço (→409). Documentado inline em `health/views.py`.
- **UUID malformado no `?field=`:** `HealthFieldDefinition.objects.get(id="nao-e-uuid")` levanta `django.core.exceptions.ValidationError` (não reconhecida pelo handler DRF → viraria 500). A view captura `(DoesNotExist, DjangoValidationError, ValueError)` → **404** (um field irresolúvel é "não encontrado").
- **ESLint `no-unused-vars`** pegou 2 imports mortos nos testes (`waitFor`, `ReactNode`) — removidos. **Ruff `I001`** pegou ordem de import em `test_serializers.py` — corrigido.

### Completion Notes List

Implementada a **camada de leitura analítica** do Épico 7 (fecha 7.1 catálogo → 7.2 valores → 7.3 histórico). Read-only puro, on-read, **sem model/migration/índice novo** (AD-14).

**Backend (estende `health/`, read-only):**
- `services.py`: `get_health_history` (tabela + dashboard num payload), `get_health_field_series` (série de 1 campo), `_validate_history_range` (bound 92 dias, espelha `habits`), `_numeric_expr` (cast JSONB `(values->>'uuid')::double precision`, AD-01), `_summarize_numeric_field` (count/min/max/avg/latest via agregação castada). **Sem `@transaction.atomic`**. Segurança do cast: `values__has_key` antes de castar + `field_type` imutável (7.1) → o texto é sempre parseável.
- `serializers.py`: 5 serializers read-only (`HealthHistoryDay`, `HealthPeriodSummary`, `HealthHistory`, `HealthSeriesPoint`, `HealthFieldSeries`). Reusa `HealthValuesField` (blob opaco) e `HealthFieldDefinitionSerializer` (7.1). Números crus (Float), **nenhum enum novo**.
- `views.py` + `urls_logs.py`: `HealthHistoryView` (`GET /api/health-logs/history/`) e `HealthFieldSeriesView` (`GET /api/health-logs/series/`), views finas, `@extend_schema` com params de range; rotas específicas antes da raiz.

**Frontend (estende `features/health/` + shell com abas):**
- `api.ts`/`keys.ts`/`types.ts`/`index.ts`: `useHealthHistoryQuery` + `useHealthFieldSeriesQuery` (`useQuery` puro; série com `enabled: fieldId !== ''`), keys `health.history`/`health.series`, tipos gerados re-exportados.
- Shell com abas "Registro" · "Histórico": `HealthMetricsTabs` (mirror de `HabitsTabs`), `HealthMetricsPage` ganhou as abas, `HealthHistoryPage` novo, rota `/health/metrics/history` em `router.tsx`. **Nenhum item novo de Sidebar/BottomNav** (a superfície vive no `<Outlet/>` — os 3 testes compartilhados da casca seguem verdes).
- Três visualizações em `features/health/components/`: `HealthHistory` (orquestrador: controle de intervalo + estados), `HealthPeriodDashboard` (cartões de estatística, stat-tiles do skill `dataviz`, cor nunca sozinha, sem score inventado), `HealthEvolutionChart` (mirror **simplificado** de `HabitEvolutionChart` — linha única, `connectNulls={false}`, `role="img"` + `<figcaption>`, **sem** eventos/ritmo/ReferenceLine/ReferenceArea), `HealthHistoryTable` (tabela acessível equivalente do gráfico, headers programáticos, célula tipada pela definição, lacuna "—", lista no mobile), `healthHistoryUtils` (data por split de string, `formatCellValue`).

**Divergência consciente de 6.4 (documentada inline):** o seletor de campo vive **dentro** de `HealthEvolutionChart` (a story 7.3 coloca o seletor e os estados vazios lá), não no orquestrador como em 6.4.

**Contrato:** `schema.yaml` + `types.gen.ts` regenerados — **puramente aditivo** (0 remoções, 0 enum novo; `HealthFieldTypeEnum` intacto). `makemigrations --check --dry-run` → **"No changes detected"** (read-only puro; **nada** a aplicar nas branches Neon dev/e2e — diferente de 7.1/7.2).

**Verificação (contagens reais, coladas literalmente):**
- Backend: `ruff check health/` **All checks passed**; `lint-imports` **1 kept, 0 broken** (health sem aresta cross-app nova); `pytest` escopado **união = 216 passed** (health **116 passed** em 243.58s + accounts/core **100 passed** em 136.78s), rodado em 2 lotes (full-suite do Neon trava). Novos testes 7.3: **34** (17 serviço + 13 view + 4 serializer).
- Frontend (Node 22.15.1): `tsc --noEmit` limpo; `eslint src` limpo; `vitest run` **713 passed (66 files)** — inclui os **51** testes do feature/páginas de health (7 arquivos), com os 3 testes compartilhados da casca intactos; `vite build` ✓ (aviso de chunk >500 kB do recharts é **esperado**).

### File List

**Backend — modificados:**
- `backend/health/services.py` (+`get_health_history`, +`get_health_field_series`, +`_validate_history_range`, +`_numeric_expr`, +`_summarize_numeric_field`, +imports do cast; `_NUMERIC_TYPES`)
- `backend/health/serializers.py` (+5 serializers read-only)
- `backend/health/views.py` (+`HealthHistoryView`, +`HealthFieldSeriesView`, +parse de range)
- `backend/health/urls_logs.py` (+`history/`, +`series/`)
- `backend/health/tests/test_services.py` (+17 testes 7.3)
- `backend/health/tests/test_views.py` (+13 testes 7.3)
- `backend/health/tests/test_serializers.py` (+4 testes 7.3)

**Frontend — modificados:**
- `frontend/src/api/keys.ts` (+`health.history`/`health.series`)
- `frontend/src/api/types.gen.ts` (regenerado — aditivo)
- `frontend/src/app/router.tsx` (+rota `/health/metrics/history`)
- `frontend/src/features/health/api.ts` (+2 hooks)
- `frontend/src/features/health/api.test.tsx` (+3 testes de hooks)
- `frontend/src/features/health/index.ts` (+exports)
- `frontend/src/features/health/types.ts` (+5 tipos gerados)
- `frontend/src/pages/health/HealthMetricsPage.tsx` (+`<HealthMetricsTabs/>`)

**Frontend — novos:**
- `frontend/src/features/health/components/HealthHistory.tsx`
- `frontend/src/features/health/components/HealthHistory.test.tsx`
- `frontend/src/features/health/components/HealthPeriodDashboard.tsx`
- `frontend/src/features/health/components/HealthPeriodDashboard.test.tsx`
- `frontend/src/features/health/components/HealthEvolutionChart.tsx`
- `frontend/src/features/health/components/HealthEvolutionChart.test.tsx`
- `frontend/src/features/health/components/HealthHistoryTable.tsx`
- `frontend/src/features/health/components/HealthHistoryTable.test.tsx`
- `frontend/src/features/health/components/healthHistoryUtils.ts`
- `frontend/src/pages/health/HealthMetricsTabs.tsx`
- `frontend/src/pages/health/HealthHistoryPage.tsx`

**Frontend — E2E (novos, gerados no passo de QA automation):**
- `frontend/e2e/health-history.spec.ts` (4 specs Playwright: vazio/read-only, tabela dia a dia, gráfico via cast, dashboard de período)
- `frontend/e2e/seedHealthHistory.ts` (seed determinístico do cenário de histórico, datas relativas a `today_for`)

**Regenerados (raiz):**
- `schema.yaml`

## Change Log

- 2026-07-19 — Story 7.3 implementada (dev-story): camada de leitura analítica read-only do Épico 7 (histórico em três visualizações — tabela dia a dia, gráfico de evolução via cast JSONB e dashboard de período). Backend: 2 endpoints GET read-only sob `/api/health-logs/` (history/series), 5 serializers, cast JSONB `(values->>'uuid')::double precision` (AD-01), sem migration/model/índice novo (AD-14). Frontend: shell com abas Registro·Histórico, 3 visualizações reusando `recharts@3.9.2` (6.4). Contrato aditivo (0 enum novo, 0 remoção). Testes: backend +34 (união 216 passed), frontend +health 51 (suíte 713 passed). Status → review.
- 2026-07-19 — Review adversarial (story-automator-review, auto-fix): 0 CRÍTICO / 0 ALTO. Corrigidos: 1 MÉDIO (2 arquivos e2e — `health-history.spec.ts`/`seedHealthHistory.ts` — ausentes do File List → adicionados) + 2 BAIXOS no `HealthEvolutionChart` [(a) `YAxis domain` forçava base em zero, achatando séries contínuas (peso) → `['auto','auto']`; (b) estado de erro sem retry acionável, contrariando "retry local" da AC4 → botão + teste]. Gates re-verdes: ruff/lint-imports OK, `makemigrations --check` "No changes detected", schema/types puramente aditivos, tsc/eslint limpos, vitest health 52 passed (7 arquivos; +1 teste de erro), 3 testes compartilhados da casca intactos (app 57 passed). Status → done.

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-19 · **Resultado:** Aprovado (com correções aplicadas automaticamente)

### Escopo verificado

Revisão adversarial de toda a superfície de código-fonte da 7.3 (excluindo `_bmad*`, planejamento e UX). Cada AC foi cruzada contra a implementação e cada task `[x]` contra o código real.

### Acceptance Criteria — todos IMPLEMENTADOS

- **AC1 (tabela dia a dia, tipada pela definição, read-only):** `HealthHistoryTable` + `formatCellValue` tipam célula a célula pela definição viva (número pt-BR / "Sim"/"Não" / string); chave ausente → "—" honesto (distinto de `false` real); coluna para campo inativo-com-valor via `get_health_history` (`d.active or str(d.id) in keys_in_range`); dia sem linha simplesmente ausente. ✔
- **AC2 (gráfico via cast + dashboard):** `_numeric_expr` = `Cast(KeyTextTransform(uuid,'values'), FloatField())` com guarda `values__has_key` antes de castar; série omite lacunas (`connectNulls={false}` no front); dashboard via agregação castada (`Count/Min/Max/Avg` + `latest` na maior data); seletor e cartões só numéricos; `role="img"` + `aria-label` de resumo + `<figcaption>`. ✔
- **AC3 (read-only, on-read, sem schema, tenant, aditivo):** GETs puros, sem `@transaction.atomic`, lógica no serviço `*, user`; `TenantManager` auto-escopado (cross-tenant testado → vazio/404); `makemigrations --check` → "No changes detected"; schema +195/-0 e `types.gen.ts` +168/-0, **sem enum novo**; `lint-imports` KEPT. ✔
- **AC4 (a11y, paridade tabular, voz):** `<table>` semântica com `<th scope>`; célula com `aria-label` contexto+valor; lista alternativa no mobile (`useMediaQuery`); gráfico com equivalente tabular; voz pt-BR factual, zero gamificação; estados loading/vazio/erro cobertos. ✔

### Achados (todos corrigidos — auto-fix)

| Sev. | Achado | Correção |
|---|---|---|
| MÉDIO | `frontend/e2e/health-history.spec.ts` e `seedHealthHistory.ts` (trabalho da 7.3, gerados no QA automation) ausentes do File List | Adicionados ao File List |
| BAIXO | `HealthEvolutionChart` `YAxis domain={[0,'auto']}` força base em zero — achata a variação de métricas contínuas (peso/pressão), justamente o que a evolução existe para mostrar | `domain={['auto','auto']}` (comentado; divergência consciente de 6.4, cujas séries são contagem/multiplicador) |
| BAIXO | Estado de erro do gráfico dizia "Tente novamente" sem botão acionável — contraria "retry local" da AC4 | Botão de retry (`series.refetch()`) + teste de erro |

### Notas

- **Sem migration/índice** confirmado — o defer do GIN da 7.2 foi resolvido honestamente (o cast on-expression sobre chave dinâmica não é atendido por GIN/índice de expressão estático; AD-14 mantém a latitude reservada).
- **Segurança do cast** sólida: `has_key` + `field_type` imutável (7.1) garantem texto sempre parseável; nenhum caminho de escrita foi tocado.
- **N+1 do dashboard** (uma agregação + uma query de `latest` por campo numérico) documentado e aceitável sob AD-14 (single-user, sem NFR); single-pass fica reservado.
