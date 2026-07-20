---
baseline_commit: d7c885c954838b8991ad744c271838500a93656b
---

# Story 9.2: Histórico navegável por data e mês

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Hugo,
I want navegar o histórico de gratidão por data e por mês,
so that eu releia entradas passadas (FR-4.2).

---

## ⚠️ Callout de divergência arquitetural (LEIA ANTES DE CODAR)

A 9.2 é **puramente leitura** sobre o modelo plano que a 9.1 já criou. **Não reintroduza as máquinas pesadas** que o callout da 9.1 já barrou por dois épicos:

- **NÃO cria model novo, NÃO cria migration.** `GratitudeEntry(id, user_id, date, text, created_at)` da 9.1 já basta. 9.2 só **lê** e **agrupa**. Se você rodar `makemigrations` e algo aparecer, é bug — reverta.
- **NÃO herde a máquina de range/cap da Saúde (7.3).** Saúde usa `?start=&end=` com default de 30 dias e **cap de 92 dias** (`_MAX_RANGE_DAYS`) porque o range é arbitrário. Gratidão navega **por mês** — um mês é naturalmente limitado. Use o idioma **de mês** do `bujo` (MonthlyLog/TaskDensity: normaliza para o dia 1, filtra `date__year/date__month`), **não** a máquina de range/cap de `health/services.py`.
- **NÃO tem score/denominador/gráfico/`recharts`/streak/insight/IA.** O histórico de gratidão é uma **lista de entradas agrupadas por dia** — nada de dashboard de período nem série temporal (isso é da Saúde). O resumo mensal por IA é **FR-4.3, [BACKLOG]**, fora do MVP.
- **NÃO adiciona editar/excluir** (a 9.1 já deferiu isso — D3 da 9.1; escopo, não dívida). O histórico é read-only: exibe, não muta.

**A ÚNICA peça de backend nova é o endpoint de mês** (`GET months/`). A navegação **por data específica** reutiliza o endpoint `days/?date=` **que a 9.1 já entregou** (via o hook `useGratitudeDayQuery` existente) — sem backend novo para "por data".

**Dependência de outros épicos: NENHUMA.** `gratitude` é domínio independente, sem FK. Os ativos reusados (idioma de navegador de mês do `bujo`, tabs `component={Link}`, `GratitudeEntryList`) são **conveniência (copiar o padrão)**, não dependência (a fronteira de features do ESLint proíbe `features/gratitude` importar outra feature).

---

## Acceptance Criteria

Derivadas de `epics.md` (Story 9.2, BDD já formatado, linhas 1382-1399) + UX Flow 5 / UX-DR8 + os padrões de histórico dos Épicos 6/7/8. Cada AC é verificável.

**AC1 — Consulta por mês, agrupada por dia (backend + frontend).**
Dado o histórico de gratidão, quando Hugo seleciona um mês, então o sistema retorna **todas as entradas daquele mês agrupadas por dia** (`GET /api/gratitude/months/?month=YYYY-MM-DD`, `month` normalizado para o dia 1 no servidor; ausente → mês corrente via `today_for(user).replace(day=1)`). Cada dia com entradas aparece como um grupo com **cabeçalho de data** e a lista das entradas daquele dia. Dias **sem** entradas não aparecem (lacunas honestas — sem gap-fill). Query escopada por tenant.

**AC2 — Ordem cronológica.**
Dado um mês exibido, quando os grupos são renderizados, então **os dias vêm em ordem cronológica ascendente** e, **dentro de cada dia, as entradas em ordem cronológica ascendente** por `created_at` (aproveita `Meta.ordering=["created_at"]` — AC3 da 9.1). Cada entrada exibe hora e data (reusa `GratitudeEntryList`).

**AC3 — Consulta por data específica.**
Dado o histórico, quando Hugo escolhe uma **data específica** (seletor `type="date"`, capado em hoje, sem limite inferior), então a superfície exibe **as entradas exatamente daquela data** em ordem cronológica ascendente, reutilizando o read-model diário existente (`GET days/?date=` via `useGratitudeDayQuery`). Um controle "Voltar ao mês" (ou equivalente) retorna à visão do mês. (Ver Decisão D3.)

**AC4 — Navegação de mês.**
Dado a visão por mês, quando Hugo usa "Mês anterior"/"Próximo mês" ou o seletor de mês, então a superfície carrega o mês escolhido. **Não navega para meses futuros** (cap no mês corrente); **sem limite inferior**. Reusa o idioma de aritmética de mês tz-safe de `pages/planner/MonthlyPage.tsx:27-40` (`addMonthsIso`/`currentMonthFirst`, split de string — **nunca** `new Date(iso)`).

**AC5 — Estados vazios informativos (voz neutra).**
Dado nenhum registro, quando um mês não tem entradas, exibe exatamente **"Nenhuma entrada neste mês."**; quando uma data específica não tem entradas, exibe **"Nenhuma entrada para esta data."** (string reusada da 9.1). Voz neutra, informativa, **não motivacional** (UX-DR13) — zero CTA/gamificação.

**AC6 — Acesso via aba "Histórico" + roteamento + a11y.**
Dado a superfície Gratidão, quando Hugo a abre, então há uma aba **"Hoje"** (o composer da 9.1, rota `/gratitude`) e uma aba **"Histórico"** (rota `/gratitude/history`), no padrão de abas dentro da página (MUI `Tabs` com `<Tab component={Link}>`, valor derivado de `useLocation().pathname`) — **nunca** na casca de navegação. O `RouteAnnouncer` anuncia o título da rota (`handle.title`). WCAG 2.2 AA: touch target ≥ 44px, loading `role="status" aria-live="polite"`, erro `role="alert"` + retry, foco preservado. A aba "Hoje" e o link "Gratidão de ontem" do `/today` (9.1) permanecem intactos.

**AC7 — Read-only + isolamento + contrato aditivo, sem migration.**
Dado o histórico, quando qualquer query roda, então é **somente leitura** (sem composer, sem editar/excluir) e **escopada por tenant** (fail-closed: contexto vazio → `TenantScopeViolation`; entrada de outro usuário nunca aparece — cross-tenant → mês/dia vazio). O schema OpenAPI/`types.gen.ts` cresce de forma **aditiva** (0 remoções); novos schemas de mês, nenhum ENUM novo. **NENHUMA migration** é criada (9.2 é leitura sobre o `GratitudeEntry` da 9.1). Sem paginação (lista embutida, como todas as superfícies de histórico do projeto — o mês é naturalmente limitado; latitude AD-14, sem NFR de < 2s).

---

## Tasks / Subtasks

Ordem recomendada: **backend (serviço→serializer→view→url→testes) → contrato → frontend (keys→tipos→api→history surface→tabs→page→router→testes) → e2e → verificação final**.

- [x] **Task 1 — Serviço de mês** (AC: 1, 2, 7)
  - [x] 1.1 Em `backend/gratitude/services.py`, adicionar `get_gratitude_month(*, user, month) -> dict` (read-only, **sem** `@transaction.atomic`, como `get_gratitude_day`). Idioma de mês do `bujo` (`bujo/views.py:362-419` TaskDensityView): `year, m = month.year, month.month`; `rows = GratitudeEntry.objects.filter(date__year=year, date__month=m)` (auto-escopado; `Meta.ordering=["created_at"]` aplica → entradas globalmente por `created_at`). Agrupar em Python por `date` (ex.: `defaultdict(list)`) preservando a ordem cronológica dentro do dia. Retornar `{"month": month, "days": [{"date": d, "entries": days[d]} for d in sorted(days)]}` (dias ascendentes). **Nunca** referenciar `user_id` nem `all_objects`.
  - [x] 1.2 **NÃO** importar/replicar `_validate_history_range`/`_MAX_RANGE_DAYS`/`date__range` da Saúde (divergência — o mês já é limitado). **NÃO** paginar.
- [x] **Task 2 — Serializer de mês** (AC: 1, 2, 7)
  - [x] 2.1 Em `backend/gratitude/serializers.py`, adicionar `GratitudeMonthSerializer(serializers.Serializer)`: `month = serializers.DateField()` + `days = GratitudeDaySerializer(many=True)`. **Reusa** o `GratitudeDaySerializer` existente (`{date, entries}`) — cada dia do mês é um read-model de dia. `fields` explícito; `created_at`→`createdAt` na borda (herdado).
- [x] **Task 3 — View + URL de mês** (AC: 1, 4, 7)
  - [x] 3.1 Em `backend/gratitude/views.py`, adicionar `_resolve_month(request)`: lê `?month=`; ausente → `today_for(request.user).replace(day=1)`; presente → `date_cls.fromisoformat(raw).replace(day=1)` (normaliza para o dia 1 — idioma do `MonthlyLogView`, `bujo/views.py:296-317`); inválida → `raise serializers.ValidationError({"month": "Data inválida. Use o formato AAAA-MM-DD."})` (espelha `_resolve_day`).
  - [x] 3.2 `GratitudeMonthView(APIView).get`: `@extend_schema(parameters=[OpenApiParameter("month", str, required=False)], responses=GratitudeMonthSerializer)` → `_resolve_month` → `get_gratitude_month(user=request.user, month=...)` → `Response(GratitudeMonthSerializer(payload).data)` (200, lista embutida, **sem paginação**).
  - [x] 3.3 Em `backend/gratitude/urls.py`, adicionar `path("months/", GratitudeMonthView.as_view(), name="gratitude-month")` (rota estática, junto de `days/`/`entries/`). **NÃO** tocar `days/`/`entries/` (9.1). **NÃO** colidir com `api/health/`.
- [x] **Task 4 — Testes backend** (AC: 1, 2, 3, 5, 7)
  - [x] 4.1 `test_services.py`: `get_gratitude_month` agrupa por dia (2+ dias, 2+ entradas/dia), dias ascendentes, entradas ascendentes dentro do dia; dias sem entrada não aparecem; mês vazio → `days=[]`; ignora entradas de outros meses; escopo por tenant (`with tenant_context`). Datas via constante fixa (nunca `today()`).
  - [x] 4.2 `test_serializers.py`: `GratitudeMonthSerializer` serializa `{month, days:[{date, entries}]}`; entradas com `id/date/text/created_at`.
  - [x] 4.3 `test_views.py`: `GET months/` default = mês corrente (`today_for(user).replace(day=1)`); `?month=2026-01-15` normaliza para janeiro/2026 e lista só janeiro; `?month=` inválido → 400 (`"month" in resp.data["fields"]`); cross-tenant → `days=[]`; camelCase na borda (`createdAt` em `json.loads(resp.content)` dentro de `days[].entries[]`). Reusar `GratitudeEntryFactory` (9.1). Isolamento parametrizado (`gratitude.GratitudeEntry`) **já** cobre o model (registrado na 9.1 — não re-registrar).
- [x] **Task 5 — Regenerar contrato** (AC: 7)
  - [x] 5.1 `cd backend && uv run python manage.py spectacular --file ../schema.yaml` (ou o comando de CI existente) → schema **aditivo** (novo `GratitudeMonth`; nenhum ENUM novo → sem `ENUM_NAME_OVERRIDES`).
  - [x] 5.2 `cd frontend && npm run generate-types` → `src/api/types.gen.ts` cresce aditivo (verificar 0 remoções no diff).
- [x] **Task 6 — Frontend: keys + tipos + api** (AC: 1, 4)
  - [x] 6.1 `src/api/keys.ts`: em `gratitude`, adicionar `month: (monthFirst?: string) => ['gratitude', 'month', monthFirst ?? 'current'] as const` (forma do `bujo.taskDensity`/`monthlyLog` — sentinela `'current'` para o default resolvido no servidor). Manter `gratitude.day` (9.1) intacto.
  - [x] 6.2 `src/features/gratitude/types.ts`: adicionar `export type GratitudeMonth = components['schemas']['GratitudeMonth']`.
  - [x] 6.3 `src/features/gratitude/api.ts`: adicionar `useGratitudeMonthQuery(monthFirst?)` (GET `/api/gratitude/months/`, `params: monthFirst ? {month: monthFirst} : undefined`, `queryKey: keys.gratitude.month(monthFirst)`, `useQuery` puro — read-only, sem otimismo). Reusar `useGratitudeDayQuery` da 9.1 para o modo "por data".
- [x] **Task 7 — Frontend: `GratitudeHistorySurface` (read-only)** (AC: 1, 2, 3, 4, 5)
  - [x] 7.1 Criar `src/features/gratitude/components/GratitudeHistorySurface.tsx`. Estado: `monthFirst` (default = mês corrente via idioma `currentMonthFirst()`) e `focusedDate: string | null` (null = visão de mês; setada = visão de dia). Copiar os helpers tz-safe de aritmética de mês de `pages/planner/MonthlyPage.tsx:27-40` (`addMonthsIso`, `currentMonthFirst`) e de dia de `MedicationHistorySurface.tsx:15-41` (`isoLocalToday`/`addDays`/`clampMax`/`formatDateBR`) — **split de string, nunca `new Date(iso)`**.
  - [x] 7.2 **Navegador de mês:** "Mês anterior"/"Próximo mês" (`minHeight:44`; próximo desabilitado quando no mês corrente) + seletor de mês (`TextField type="month"`, value = `monthFirst.slice(0,7)`, onChange → `${value}-01`, capado no mês corrente). Rótulo do mês em pt-BR.
  - [x] 7.3 **Visão por mês** (`focusedDate === null`): `useGratitudeMonthQuery(monthFirst)` → renderizar `data.days` como grupos: cabeçalho `<Typography component="h3">{formatDateBR(day.date)}</Typography>` + `<GratitudeEntryList entries={day.entries} />` (reuso da 9.1). Vazio → `'Nenhuma entrada neste mês.'` (const). Loading `role="status"`; erro `role="alert"` + "Tentar novamente".
  - [x] 7.4 **Visão por data** (`focusedDate !== null`): seletor `TextField type="date"` (capado em hoje) que seta `focusedDate`; `useGratitudeDayQuery(focusedDate)` → `<GratitudeEntryList>` da data; vazio → `'Nenhuma entrada para esta data.'` (reuso 9.1). Botão "Voltar ao mês" limpa `focusedDate`. O seletor `type="date"` "Ir para data" deve estar acessível também na visão de mês (para entrar no modo por-data). (Ver D3.)
  - [x] 7.5 `sx={{ maxWidth: 800, mx: 'auto' }}` (reading-width, D8 da 9.1). Strings pt-BR como `const` no topo. **Sem** composer/edição (read-only).
  - [x] 7.6 `src/features/gratitude/index.ts`: exportar `useGratitudeMonthQuery`, `GratitudeHistorySurface` e o tipo `GratitudeMonth`.
- [x] **Task 8 — Frontend: tabs + página de histórico + rota** (AC: 6)
  - [x] 8.1 Criar `src/pages/gratitude/GratitudeTabs.tsx` (espelhar `pages/health/MedicationsTabs.tsx`): MUI `Tabs`/`Tab` com "Hoje" (`to="/gratitude"`) e "Histórico" (`to="/gratitude/history"`), `component={Link}`, valor derivado de `useLocation().pathname`, `aria-label` na `Tabs`. **Tabs vivem na página (sob `<Outlet/>`), nunca na casca de nav.**
  - [x] 8.2 Criar `src/pages/gratitude/GratitudeHistoryPage.tsx`: `<Box component="main" aria-label="Diário de Gratidão" sx={{ p: 3 }}>` → `<GratitudeTabs />` + `<GratitudeHistorySurface />` (espelha `MedicationHistoryPage.tsx`).
  - [x] 8.3 Atualizar `src/pages/gratitude/GratitudePage.tsx`: manter `<main aria-label="Diário de Gratidão">`, adicionar `<GratitudeTabs />` **acima** de `<GratitudeDaySurface />` (padrão `MedicationsPage`).
  - [x] 8.4 `src/app/router.tsx`: junto da rota `/gratitude` existente (linhas ~121-125), adicionar irmã `{ path: 'gratitude/history', element: <GratitudeHistoryPage />, handle: { title: 'Histórico de Gratidão' } }` (import estático, sob `ProtectedLayout`). Manter a rota `/gratitude` (Hoje) e seu `handle.title` intactos.
- [x] **Task 9 — Testes frontend (vitest + RTL + jest-axe)** (AC: 1, 2, 3, 5, 6)
  - [x] 9.1 `GratitudeHistorySurface.test.tsx`: mock de `../../api/client`; render em `QueryClientProvider` + `ThemeProvider(createBujoTheme('light'))` + `<main aria-label="Diário de Gratidão">`. Cobrir: loading/erro/vazio-de-mês (string exata **"Nenhuma entrada neste mês."**); mês agrupado por dia (2 dias, entradas por dia em ordem); navegação mês anterior/próximo (assert `params: {month: ...}`) e cap no mês corrente; modo "por data" (`type="date"` → assert `GET days/?date=`, exibe as entradas do dia, vazio → **"Nenhuma entrada para esta data."**, "Voltar ao mês" limpa); `expect(await axe(document.body)).toHaveNoViolations()`.
  - [x] 9.2 `GratitudeTabs.test.tsx` (ou dentro do teste da página): abas "Hoje"/"Histórico" existem, apontam para `/gratitude` e `/gratitude/history`, e a ativa reflete a rota atual (render em `MemoryRouter` com cada `initialEntries`).
  - [x] 9.3 `api.test.tsx` (arquivo da 9.1): adicionar teste de `useGratitudeMonthQuery` (mock `client.get`, assert chamada a `/api/gratitude/months/` com `params:{month}` e o shape retornado). Manter os testes de mutação da 9.1.
  - [x] 9.4 Rodar `npm run test:run` (suíte completa) + `npm run typecheck` + `npm run lint`. Confirmar que os testes compartilhados da casca (`Sidebar.test.tsx`/`BottomNav.test.tsx`/`AppLayout`/`RouteAnnouncer.test.tsx`) e `router.test.tsx` seguem verdes — só rota nova + tabs `Link` (nada Query na casca). Se `router.test.tsx`/`RouteAnnouncer.test.tsx` enumeram rotas/títulos, atualizar para incluir `gratitude/history` → "Histórico de Gratidão". **[Verificado: `router.test.tsx`/`RouteAnnouncer.test.tsx` NÃO enumeram rotas/títulos — testam rotas específicas (today/login/signup/unknown); nenhuma edição necessária.]**
- [x] **Task 10 — E2E (Playwright, branch Neon `e2e`)** (AC: 1, 2, 3, 4, 6)
  - [x] 10.1 **NÃO há migration nova** (9.2 é leitura) — pular o passo de "aplicar migration à branch Neon". Confirmar que a branch `e2e`/`dev` já tem a tabela `gratitude_entries` (aplicada na 9.1). **[Confirmado: e2e roda contra a branch `e2e` sem migration nova; as queries `GET months/`/`days/` respondem 200.]**
  - [x] 10.2 Criar `frontend/e2e/gratitude-history.spec.ts`: usar `seedGratitudeEntry` (9.1; aceita `daysAgo`) para semear entradas em 2+ datas de meses diferentes (ex.: hoje e ~40 dias atrás). Abrir `/gratitude`, clicar na aba "Histórico" (assert URL `/gratitude/history` + `handle.title`), ver o mês corrente agrupado por dia; navegar "Mês anterior" até o mês semeado e assert as entradas agrupadas em ordem; entrar no modo "por data", escolher uma data semeada e assert as entradas daquela data; "Próximo mês" desabilitado no mês corrente. `expect(consoleErrors).toEqual([])`.
  - [x] 10.3 Se o seed de meses distantes exigir mais de um `daysAgo`, estender `seedGratitude.ts` com um helper de múltiplas entradas (aditivo; manter `seedGratitudeEntry` da 9.1). **[Não necessário: duas chamadas a `seedGratitudeEntry` (hoje + `daysAgo:40`) bastaram; `seedGratitude.ts` intocado.]**
  - [x] 10.4 **Regressão:** re-rodar o `gratitude.spec.ts` **existente** (9.1) — o `GratitudePage` mudou (ganhou tabs). Confirmar que os 5 casos da 9.1 seguem verdes (a aba "Hoje" + o link "Gratidão de ontem" do `/today` intactos; tabs são `role="tab"`, sem colisão com o `getByRole('listitem')` do helper de entradas). **[6 passed: 5 casos da 9.1 + 1 novo da 9.2.]**
- [x] **Task 11 — Verificação final** (AC: todos)
  - [x] 11.1 `docker compose up -d db` (raiz) → `cd backend && uv run pytest` (**suíte completa local, Postgres docker, rápida**). Confirmar `gratitude` (incl. novos testes de mês), isolamento parametrizado, `test_guardrails.py` (nenhum `date.today()`/`timezone.now()` cru introduzido) e import-linter verdes. `ruff check gratitude/` limpo. **[871 passed; import-linter 1 kept/0 broken; ruff limpo.]**
  - [x] 11.2 Confirmar `git status` **não** lista nenhuma migration nova em `backend/gratitude/migrations/` (AC7). Reconciliar a **File List** 1:1 com `git status` no fim. **[`makemigrations --check` → No changes detected; migrations/ sem alterações.]**

---

## Dev Notes

### Contexto de negócio e escopo (o que ESTÁ e NÃO está na 9.2)

- **Está:** endpoint de mês (`GET months/`) que agrupa as entradas do mês por dia; superfície de **Histórico read-only** (nova aba "Histórico") com navegação **por mês** (agrupado por dia, cronológico) e **por data específica** (reusando o read-model diário da 9.1); tabs "Hoje"/"Histórico" + rota `/gratitude/history`; contrato aditivo + e2e. **Sem migration.**
- **NÃO está (fora de escopo — não implemente):** resumo mensal por IA (FR-4.3, **[BACKLOG]**); qualquer gráfico/score/streak/dashboard de período (isso é da Saúde 7.3 — **não** copiar); editar/excluir entradas (deferido desde a 9.1 D3); paginação; model/migration novos; range arbitrário com cap (idioma da Saúde — divergência).

### 🚫 Guardrails do arquiteto (obrigatórios — herdados da 9.1, resumidos)

1. **Tenant fail-closed (AD-12/§6.7).** Queries via `GratitudeEntry.objects` (auto-escopado). **Nunca** `user_id` cru, **nunca** `all_objects`. Contexto vazio → `TenantScopeViolation`. O caso de isolamento parametrizado já cobre `gratitude.GratitudeEntry` (registrado na 9.1 em `conftest.py._ISOLATION_TEST_MODULES`) — **não** re-registrar.
2. **Autoridade temporal (AD-04/§6.8).** **Proibido** `date.today()`/`timezone.now()`/`datetime.now()` em produção (guardrail AST `test_no_bare_date_today_outside_calendar` falha o build). "Mês corrente" e "hoje" resolvidos **no servidor** via `today_for(user)` (`.replace(day=1)` para o dia 1). O `?month=`/`?date=` são conveniência validada (inválida → 400). Factories usam constante de data fixa.
3. **Camada de serviço (§6.2).** `get_gratitude_month(*, user, month)` em `services.py` (função de módulo; `user` primeiro kwarg keyword-only). Leitura **sem** `@transaction.atomic` (como `get_gratitude_day`). Recebe dados já validados (nunca o `request`). Views finas: `_resolve_month` → serviço → serializa.
4. **Contrato/casing (§6.3).** camelCase na borda (auto). `fields` explícito; `user_id` omitido. Resposta sem envelope (objeto direto `{month, days}`). Erros `{detail, fields}`. Sem `/api/v1/`. Sem JSONB de chave dinâmica → nada de `ignore_fields`.
5. **Exceções (§6.4).** `month`/`date` malformados → `serializers.ValidationError` (400), não exceção de domínio.

### Backend — padrões concretos a replicar (com caminhos)

- **Idioma de mês (a peça nova) — molde `bujo`, NÃO `health`:**
  - Normalização e parse do `?month=`: `MonthlyLogView.get` em `backend/bujo/views.py:296-317` (`date.fromisoformat(param).replace(day=1)`; ausente → `today_for(user).replace(day=1)`; inválida → `ValidationError`).
  - Agregação mês→por-dia: `TaskDensityView` em `backend/bujo/views.py:362-419` (`filter(date__year=year, date__month=month)` + agrupamento Python). Adaptar de `count` para **lista de entradas por dia**.
  - `core/calendar.py` **não** tem helper de "primeiro/último dia do mês" dedicado; o idioma canônico é `today_for(user).replace(day=1)` + filtro `date__year/date__month` (não precisa de `date__range` nem de `monthrange`).
- **Molde do serviço/serializer/view (o mais próximo é o par diário da própria 9.1):**
  - `get_gratitude_day`/`GratitudeDaySerializer`/`GratitudeDayView` em `backend/gratitude/{services,serializers,views}.py` — o de mês é o **mesmo shape, um nível acima** (`{month, days:[GratitudeDay...]}`). Reusar `GratitudeDaySerializer` dentro do `GratitudeMonthSerializer`.
  - `_resolve_day` (`gratitude/views.py:26-39`) é o molde exato de `_resolve_month` (troque `date`→`month` + `.replace(day=1)`).
- **Sem paginação:** todas as superfícies de histórico do projeto retornam **lista embutida** (health `get_health_history` retorna `days[]`; medications/gratitude retornam listas simples). `CorePagination` (`core/pagination.py`, page_size 50) **não** é aplicada em `APIView`s de histórico (nenhum call-site de `paginate_queryset`). Mantenha embutido (o mês é limitado; AD-14 single-user, sem NFR de < 2s — AC do épico é explícita: "sem NFR formal de < 2s").
- **Testes:** `conftest.py` fornece `auth_client`/`user`/`other_user`/`tenant_context`; autouse `_enable_db_access`. Reusar `GratitudeEntryFactory` (9.1, `class Params`/`SelfAttribute`, data via constante fixa). View tests: body/params camelCase na borda; `response.data` snake_case; camelCase provado por `json.loads(response.content)`.

### Frontend — padrões concretos a replicar (com caminhos)

- **Aba dentro da feature (shell de tabs) — molde `MedicationsTabs`:** `frontend/src/pages/health/MedicationsTabs.tsx` (MUI `Tabs`/`Tab` `component={Link}`, valor de `useLocation().pathname`, "Hoje"/"Histórico"). As páginas: `MedicationsPage.tsx` (Hoje) e `MedicationHistoryPage.tsx` (Histórico) — ambas `<main aria-label="Medicamentos"><XTabs/><XSurface/></main>`. Espelhar 1:1 para gratidão (`aria-label="Diário de Gratidão"`). **Tabs são `<Link>` puro → seguras para os testes compartilhados da casca** (regra herdada: nada Query-driven em `Sidebar`/`BottomNav`).
- **Superfície de histórico read-only — molde `MedicationHistorySurface`:** `frontend/src/features/medications/components/MedicationHistorySurface.tsx` (navegador de data por split de string, estados loading/erro/vazio, sem composer). Para gratidão, trocar o navegador de dia pelo de **mês** + o modo "por data".
- **Navegador de mês tz-safe — molde `MonthlyPage`:** `frontend/src/pages/planner/MonthlyPage.tsx:27-40` (`addMonthsIso`, `currentMonthFirst()`) + os `IconButton`s prev/next (`MonthlyPage.tsx:177-194`). **Regra crítica:** aritmética de mês por split de string, nunca `new Date(iso)` (drift de fuso).
- **Reuso direto da 9.1:** `GratitudeEntryList` (`features/gratitude/components/GratitudeEntryList.tsx`) renderiza uma lista de entradas com hora+data — reusar tanto no grupo-de-dia (mês) quanto no modo por-data. `useGratitudeDayQuery` (`features/gratitude/api.ts:19-24`) atende o modo "por data" **sem backend novo**. Helpers `isoLocalToday`/`addDays`/`clampMax`/`formatDateBR` já existem em `GratitudeDaySurface.tsx:15-40` (copiar/reusar o mesmo idioma).
- **Data layer (§6.5):** `client` (axios) anexa `Bearer`; `keys` centralizado — adicionar `gratitude.month` (forma `bujo.taskDensity`); **proibido** chave inline. Read-only → `useQuery` puro (sem `useOptimisticMutation`).
- **Query-keys de mês (precedente):** `bujo.monthlyLog`/`bujo.taskDensity` em `src/api/keys.ts:17,28-29` (`monthFirst ?? 'current'`). `health.history(range)` (`keys.ts:58`) é o precedente de range — **não** usar (gratidão é por mês, não range).
- **Tema/tokens:** consumir tokens (`color="text.secondary"`, spacing base 4px → `p:3`), botões/IconButton com `minHeight:44`. Estado vazio `Typography variant="body2" color="text.secondary"`, strings exatas como `const`. Loading `role="status" aria-live="polite"`; erro `role="alert"` + retry.
- **Tipos:** aliasar de `components['schemas'][...]` em `features/gratitude/types.ts` após `npm run generate-types`; nunca tipos ad-hoc.

### Decisões #YOLO (documentadas inline; baixo risco, ~1 linha se o PO discordar)

- **D1 — Histórico é superfície read-only** (sem composer/editar/excluir), paridade com o escopo enxuto da 9.1 (D3). Se o PO quiser editar do histórico, é aditivo depois.
- **D2 — "Por mês" = endpoint novo `GET months/`** (idioma de mês do `bujo`: normaliza p/ dia 1, `date__year/date__month`, agrupa por dia server-side). Alternativa descartada: idioma de range/cap da Saúde (over-engineering — o mês já é limitado).
- **D3 — "Por data específica" reusa o read-model diário da 9.1** (`days/?date=` via `useGratitudeDayQuery`), num modo "por data" dentro do Histórico (seletor `type="date"` → visão de dia; "Voltar ao mês" retorna). Sem backend novo para por-data. ⚠️ **É a decisão que mais vale confirmação do Hugo** (a forma exata do UX de "por data": modo alternável vs. clicar num dia do mês). Risco baixo, 1 componente.
- **D4 — Ordem:** dias do mês **ascendentes**, entradas dentro do dia **ascendentes** (cronológico — AC do épico). Alternativa: dias descendentes (mais recente no topo, estilo "reviver"). Mantido ascendente por consistência com `Meta.ordering` da 9.1; trivial inverter se o PO preferir.
- **D5 — Sem paginação** (lista embutida, mês limitado; latitude AD-14, o épico dispensa NFR de < 2s).
- **D6 — Navegador de mês capado no mês corrente** (sem futuro), sem limite inferior.
- **D7 — Sem migration** (9.2 é leitura sobre `GratitudeEntry`). Se `makemigrations` gerar algo, é bug (revertir).

### Testing standards (resumo)

- **Backend:** `pytest` (`uv run pytest` de `backend/`, Postgres local via `docker compose up -d db`), `factory_boy`, `test_{services,serializers,views}.py`. Cobrir agrupamento por mês, ordem cronológica (dia e entrada), mês vazio, `?month=` default/específico/inválido→400, cross-tenant vazio, camelCase na borda. Isolamento parametrizado já cobre o model (9.1).
- **Frontend:** Vitest + RTL + jest-axe, co-localizado `*.test.tsx`, mock de `../../api/client`, render em `QueryClientProvider`+`ThemeProvider`. **Todo teste de surface inclui `axe(...).toHaveNoViolations()`.** `fileParallelism:false` (não reabilitar). `vi.clearAllMocks()` (não `resetAllMocks` — preserva `matchMedia` global).
- **E2E:** Playwright `workers:1`, backend real `config.settings.e2e` (Neon `e2e`), specs em `frontend/e2e/*.spec.ts`, seed via `seedGratitude.ts` (`manage.py shell`). Assert `consoleErrors == []`. **Sem passo de migration** (não há migration nova).

### 🟢 Nota operacional (herdada da 9.1 — Neon/Node)

- **`pytest` roda contra Postgres LOCAL (docker-compose), não Neon** (`config.settings.test`). `docker compose up -d db` (raiz) uma vez → `cd backend && uv run pytest` (**suíte completa em segundos**). O "hang do Neon" das retros antigas **não** se aplica a testes unitários — rode a full-suite local sem medo (o CI também roda `uv run pytest` completo).
- **Neon só importa para e2e** (`config.settings.e2e`) **e dev** (`config.settings.dev`). Como **não há migration nova** na 9.2, não é preciso aplicar migration às branches (a tabela `gratitude_entries` já existe desde a 9.1).
- **Node:** sem `.nvmrc`/`engines`; frontend exige Node ≥20 (Vite 8/Vitest 4). A sessão inicia em versão antiga — rodar `nvm use 22.15.1` (ou ≥20) antes de todo comando de frontend/e2e.

### Project Structure Notes

- **Alinhamento:** `gratitude` já existe (9.1) na árvore (`architecture.md:1107`), no import-linter e no frontend (feature + rota + item de sidebar). A rota `/gratitude/history` e as tabs seguem o padrão `health/medications` (§7.1/7.2) — nada foge da estrutura unificada. `pages/` compõe a feature; `features/gratitude` permanece isolada (barrel `index.ts`).
- **Arquivos NOVOS:**
  - `backend/gratitude/` — sem arquivos novos (só edições em `services.py`/`serializers.py`/`views.py`/`urls.py` + testes).
  - `frontend/src/features/gratitude/components/GratitudeHistorySurface.tsx` (+ `.test.tsx`).
  - `frontend/src/pages/gratitude/GratitudeTabs.tsx` (+ `.test.tsx` se separado).
  - `frontend/src/pages/gratitude/GratitudeHistoryPage.tsx`.
  - `frontend/e2e/gratitude-history.spec.ts`.
- **Arquivos UPDATE (estado atual → mudança → preservar):**
  - `backend/gratitude/services.py` — **add** `get_gratitude_month`. **Preservar** `create_gratitude_entry`/`get_gratitude_day`.
  - `backend/gratitude/serializers.py` — **add** `GratitudeMonthSerializer` (reusa `GratitudeDaySerializer`). **Preservar** os 3 serializers da 9.1.
  - `backend/gratitude/views.py` — **add** `_resolve_month` + `GratitudeMonthView`. **Preservar** `_resolve_day`/`GratitudeDayView`/`GratitudeEntryCreateView`.
  - `backend/gratitude/urls.py` — **add** `path("months/", ...)`. **Preservar** `days/`/`entries/`.
  - `backend/gratitude/tests/{test_services,test_serializers,test_views}.py` — **add** casos de mês. **Preservar** os da 9.1.
  - `frontend/src/api/keys.ts` — **add** `gratitude.month`. **Preservar** `gratitude.day` + convenção de chaves.
  - `frontend/src/features/gratitude/{types,api,index}.ts` — **add** `GratitudeMonth`, `useGratitudeMonthQuery`, exports. **Preservar** os da 9.1.
  - `frontend/src/features/gratitude/api.test.tsx` — **add** teste de mês. **Preservar** os da 9.1.
  - `frontend/src/pages/gratitude/GratitudePage.tsx` — **add** `<GratitudeTabs/>` acima da surface. **Preservar** o `<main aria-label>` + `<GratitudeDaySurface/>`.
  - `frontend/src/app/router.tsx` — **add** rota `gratitude/history`. **Preservar** a rota `/gratitude` (Hoje) + `handle.title`.
  - `frontend/src/app/layout/RouteAnnouncer.test.tsx` / `frontend/src/app/router.test.tsx` — **atualizar SÓ SE** enumerarem rotas/títulos (add `gratitude/history` → "Histórico de Gratidão"). **Preservar** demais asserções.
  - `schema.yaml` + `frontend/src/api/types.gen.ts` — regeneração **aditiva** (0 remoções).
  - `frontend/e2e/seedGratitude.ts` — **add** helper multi-entrada SÓ SE necessário. **Preservar** `seedGratitudeEntry` (9.1).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.2 (Épico 9, linhas 1382-1399); #Epic 9 (302-306); #FR-4.2 (77)]
- [Source: _bmad-output/implementation-artifacts/9-1-entradas-de-texto-livre.md — app `gratitude` completo (model/serviço/serializer/view/url/testes), callout de divergência, decisões D1-D9, File List]
- [Source: _bmad-output/planning-artifacts/architecture.md#7.1 Árvore (gratitude 1107), #7.2 Fronteiras (features isoladas, pages compõem), #6.2 Serviço, #6.3 API/casing, #6.4 Erros, #6.7 Multi-Tenant, #6.8 Tempo]
- [Source: _bmad-output/implementation-artifacts/epic-8-retro-2026-07-20.md#6. Preview do Epic 9 (89-105) — "log plano por data", "shell de abas dentro da feature se a 9.2 quiser Hoje/Histórico", idioma de navegador de data reusável]
- [Source: backend/bujo/views.py:296-317 (MonthlyLogView — normaliza `?month=` p/ dia 1), :362-419 (TaskDensityView — `date__year/date__month` + agregação por dia)]
- [Source: backend/gratitude/{models,serializers,services,views,urls}.py (9.1 — molde diário a espelhar no mês); backend/core/{calendar,pagination}.py; backend/health/services.py:311-353 (get_health_history — idioma de range/cap a NÃO copiar)]
- [Source: frontend/src/pages/health/{MedicationsTabs,MedicationsPage,MedicationHistoryPage}.tsx (molde de tabs/páginas); frontend/src/features/medications/components/MedicationHistorySurface.tsx (molde de surface de histórico read-only)]
- [Source: frontend/src/pages/planner/MonthlyPage.tsx:27-40,177-194 (addMonthsIso/currentMonthFirst + navegador de mês); frontend/src/features/gratitude/components/{GratitudeDaySurface,GratitudeEntryList}.tsx + api.ts (reuso da 9.1); frontend/src/api/keys.ts:17,28-29,79-81 (chaves de mês); frontend/src/app/router.tsx:121-125 (rota gratitude)]
- [Source: frontend/e2e/{gratitude.spec,seedGratitude,fixtures}.ts (molde e2e + seed da 9.1)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- Backend gratitude suite: `uv run pytest gratitude/ -q` → **39 passed** (7.80s).
- Guardrails + isolamento: `uv run pytest -k "guardrail or isolation" -q` → **30 passed** (841 deselected).
- Contrato: `manage.py spectacular --file ../schema.yaml` → diff aditivo (43 inserções, 0 remoções reais); `npm run generate-types` → `types.gen.ts` +54 linhas, 0 remoções.
- Frontend gratitude/pages: `vitest run src/features/gratitude src/pages/gratitude` → **30 passed** (4 arquivos).
- Suíte frontend completa: `npm run test:run` → **811 passed** (77 arquivos); `npm run lint` limpo; `npm run typecheck` limpo.
- E2E: `playwright test gratitude.spec.ts gratitude-history.spec.ts` → **6 passed** (5 regressão 9.1 + 1 novo 9.2).
- Suíte backend completa (sem scoping): `uv run pytest` → **871 passed** (188s); `uv run lint-imports` → 1 kept, 0 broken; `ruff check gratitude/` limpo.
- Migration: `manage.py makemigrations --check --dry-run` → **No changes detected** (AC7 — 9.2 é leitura).

### Completion Notes List

- **Backend (AC1/AC2/AC5/AC7):** `get_gratitude_month(*, user, month)` agrupa as entradas do mês por dia (idioma `date__year`/`date__month` do `bujo`, **não** o range/cap da Saúde); `Meta.ordering=["created_at"]` (9.1) garante entradas ascendentes dentro do dia; dias ascendentes via `sorted(days)`. `GratitudeMonthSerializer` reusa `GratitudeDaySerializer` (`{month, days:[{date, entries}]}`). `_resolve_month` normaliza `?month=` para o dia 1 (default = `today_for(user).replace(day=1)`; inválida → 400). Rota estática `months/` adicionada sem tocar `days/`/`entries/`. Auto-escopado por tenant (nunca `user_id` cru / `all_objects`).
- **Contrato (AC7):** schema **aditivo** — novo `GratitudeMonth` (referencia o `GratitudeDay` existente) + path `/api/gratitude/months/`; nenhum ENUM novo; 0 remoções em `schema.yaml`/`types.gen.ts`. **Nenhuma migration** (verificado por `makemigrations --check`).
- **Frontend (AC1–AC6):** `useGratitudeMonthQuery` (read-only, `useQuery` puro); `keys.gratitude.month` (sentinela `'current'`). `GratitudeHistorySurface` com estado `monthFirst`/`focusedDate`: visão por mês (navegador "Mês anterior"/"Próximo mês" capado no mês corrente + seletor `type="month"` + "Ir para data") e visão por data (reusa `useGratitudeDayQuery`/`GratitudeEntryList` da 9.1, "Voltar ao mês"). Aritmética de mês/dia tz-safe por split de string (nunca `new Date(iso)`). Estados vazios com strings exatas em voz neutra (**"Nenhuma entrada neste mês."** / **"Nenhuma entrada para esta data."**); loading `role="status"`; erro `role="alert"` + retry; touch targets ≥ 44px; jest-axe sem violações.
- **Tabs/rota (AC6):** `GratitudeTabs` (`<Tab component={Link}>`, valor de `useLocation().pathname`) na página (sob `<Outlet/>`, nunca na casca de nav) — `<Link>` puro, sem TanStack Query, então os testes compartilhados da casca (Sidebar/BottomNav/AppLayout/RouteAnnouncer) seguem verdes. `GratitudeHistoryPage` (`<main aria-label="Diário de Gratidão">`); rota `gratitude/history` (import estático) com `handle.title: 'Histórico de Gratidão'`. `GratitudePage` (Hoje) ganhou `<GratitudeTabs/>` acima da surface; rota/título da 9.1 intactos.
- **Decisões #YOLO aplicadas conforme a story:** D1 (read-only, sem composer/edição), D2 (`GET months/`, idioma de mês do `bujo`), D3 (modo "por data" alternável reusa `days/?date=` — o seletor "Ir para data" fica acessível na visão de mês, e "Voltar ao mês" retorna), D4 (dias e entradas ascendentes), D5 (sem paginação), D6 (cap no mês corrente, sem limite inferior), D7 (sem migration).
- **Testes compartilhados da casca:** `router.test.tsx`/`RouteAnnouncer.test.tsx` **não** enumeram rotas/títulos (testam rotas específicas), então não precisaram de edição — confirmado por inspeção e pela suíte verde.

### File List

**Backend (modificados — add, sem remoção):**
- `backend/gratitude/services.py` — add `get_gratitude_month`
- `backend/gratitude/serializers.py` — add `GratitudeMonthSerializer`
- `backend/gratitude/views.py` — add `_resolve_month` + `GratitudeMonthView`
- `backend/gratitude/urls.py` — add `path("months/", ...)`
- `backend/gratitude/tests/test_services.py` — add casos de `get_gratitude_month`
- `backend/gratitude/tests/test_serializers.py` — add casos de `GratitudeMonthSerializer`
- `backend/gratitude/tests/test_views.py` — add casos de `GET months/`

**Contrato (regenerado, aditivo):**
- `schema.yaml`
- `frontend/src/api/types.gen.ts`

**Frontend (modificados):**
- `frontend/src/api/keys.ts` — add `gratitude.month`
- `frontend/src/features/gratitude/types.ts` — add `GratitudeMonth`
- `frontend/src/features/gratitude/api.ts` — add `useGratitudeMonthQuery`
- `frontend/src/features/gratitude/api.test.tsx` — add testes de `useGratitudeMonthQuery`
- `frontend/src/features/gratitude/index.ts` — export `useGratitudeMonthQuery`/`GratitudeHistorySurface`/`GratitudeMonth`
- `frontend/src/pages/gratitude/GratitudePage.tsx` — add `<GratitudeTabs/>`
- `frontend/src/app/router.tsx` — add rota `gratitude/history`

**Frontend (novos):**
- `frontend/src/features/gratitude/components/GratitudeHistorySurface.tsx`
- `frontend/src/features/gratitude/components/GratitudeHistorySurface.test.tsx`
- `frontend/src/pages/gratitude/GratitudeTabs.tsx`
- `frontend/src/pages/gratitude/GratitudeTabs.test.tsx`
- `frontend/src/pages/gratitude/GratitudeHistoryPage.tsx`
- `frontend/src/pages/gratitude/GratitudeHistoryPage.test.tsx` *(adicionado na review — cobre a composição da página `/gratitude/history`: `<main>` único + abas)*
- `frontend/src/pages/gratitude/GratitudePage.test.tsx` *(adicionado na review — teste colocado NOVO da página "Hoje" após ganhar as abas)*
- `frontend/e2e/gratitude-history.spec.ts` *(novo tipo de artefato: spec E2E permanente)*

## Senior Developer Review (AI)

**Reviewer:** HugoMMBrito · **Data:** 2026-07-20 · **Resultado:** Aprovado (auto-fix aplicado)

### Escopo verificado

Revisão adversarial de todos os arquivos da File List cruzada com o `git status`. Cada AC foi validada contra a implementação real (não só contra os `[x]` da story) e cada suíte foi **re-executada** neste ambiente:

- **Backend:** `makemigrations --check --dry-run` → **No changes detected** (AC7 — 9.2 é leitura, sem migration); `pytest gratitude/` → **40 passed**; `pytest -k "guardrail or isolation"` → **30 passed** (autoridade temporal AD-04 + isolamento parametrizado `gratitude.GratitudeEntry`); `ruff check gratitude/` limpo.
- **Contrato (AC7):** `schema.yaml` **+43/−0** e `types.gen.ts` **+54/−0** — puramente aditivo (novo `GratitudeMonth` referenciando `GratitudeDay`; nenhum ENUM novo; 0 remoções).
- **Frontend:** `tsc -b --noEmit` limpo; `eslint .` limpo; `vitest run src/features/gratitude src/pages/gratitude src/app` → **13 arquivos / 98 testes passed** (inclui os testes compartilhados da casca — `router`/`RouteAnnouncer`/`AppLayout`/`Sidebar`/`BottomNav` seguem verdes; confirmado que `router.test.tsx`/`RouteAnnouncer.test.tsx` **não** referenciam `gratitude`, validando a Task 9.4).

### AC × implementação (todas IMPLEMENTED)

- **AC1/AC2** — `get_gratitude_month` agrupa por dia (idioma `date__year`/`date__month` do `bujo`, **não** o range/cap da Saúde); dias ascendentes via `sorted()`, entradas ascendentes por `created_at` (`Meta.ordering`). Coberto por `test_get_gratitude_month_groups_by_day` + `..._orders_entries_within_day_chronologically`.
- **AC3** — modo "por data" reusa `useGratitudeDayQuery` (`days/?date=`), sem backend novo; "Voltar ao mês" limpa o foco. Coberto na surface e no e2e.
- **AC4** — navegador de mês tz-safe (split de string, nunca `new Date(iso)`), cap no mês corrente sem limite inferior; testes de clamp de futuro verdes.
- **AC5** — strings exatas em voz neutra (`"Nenhuma entrada neste mês."` / `"Nenhuma entrada para esta data."`).
- **AC6** — abas `<Tab component={Link}>` dentro da página (sob `<Outlet/>`, nunca na casca de nav); rota `/gratitude/history` + `handle.title`; a11y (touch ≥44px, `role="status"`/`role="alert"`, jest-axe sem violações).
- **AC7** — read-only, tenant fail-closed (auto-escopo; cross-tenant → mês/dia vazio), contrato aditivo, **sem migration**.

### Achados

- **[MEDIUM · corrigido] Reconciliação da File List (Task 11.2).** Dois arquivos de teste existiam no `git status` mas **não** estavam documentados na File List: `frontend/src/pages/gratitude/GratitudeHistoryPage.test.tsx` e `frontend/src/pages/gratitude/GratitudePage.test.tsx`. Corrigido — ambos adicionados à seção "Frontend (novos)"; a File List agora reconcilia 1:1 com o `git status` (excluindo artefatos `_bmad-output/` e config de repo).

Nenhum achado **CRITICAL** ou **HIGH**: nenhuma task `[x]` estava por fazer, nenhuma AC ficou faltando/parcial, e não há claim falso na story (todos os arquivos alegados têm mudança no git). Implementação de alta qualidade — divergências arquiteturais do callout (sem model/migration, sem range/cap, sem score/gráfico, read-only) todas respeitadas.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-07-20 | 0.1 | Implementação da Story 9.2 (histórico navegável por data e mês): endpoint `GET months/`, `GratitudeHistorySurface` read-only, tabs Hoje/Histórico + rota `/gratitude/history`, contrato aditivo, testes backend/frontend/E2E. Status → review. | Amelia (dev-story) |
| 2026-07-20 | 0.2 | Review adversarial (story-automator): suítes re-executadas (backend 40 + guardrails/isolamento 30; frontend 98; contrato aditivo; sem migration). 1 achado MEDIUM corrigido (File List 1:1 com git — 2 testes de página adicionados). 0 CRITICAL/HIGH. Status → done. | HugoMMBrito (review) |
