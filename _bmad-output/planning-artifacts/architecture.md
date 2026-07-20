---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-22'
sessionDate: '2026-06-22'
sessionStatus: 'COMPLETO — tópicos T1–T16 resolvidos (AD-01 a AD-15); PRD reconciliado; Seções 6 (Padrões), 7 (Estrutura) e 8 (Validação) concluídas em 2026-06-22 — Status: READY FOR IMPLEMENTATION'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/addendum.md'
  - '_bmad-output/planning-artifacts/briefs/brief-hmmb-bujo-2026-06-15/brief.md'
workflowType: 'architecture'
project_name: 'hmmb-bujo'
user_name: 'HugoMMBrito'
date: '2026-06-16'
---

# Architecture Decision Document — BuJo Digital

_Este documento é construído colaborativamente, passo a passo. Seções são adicionadas à medida que tomamos decisões arquiteturais juntos._

---

## 1. Project Context Analysis

### Requirements Overview

**Functional Requirements:**

O sistema cobre 35 requisitos funcionais em 7 categorias:

- **FR-0 — Fundação:** Multi-tenancy, auth email/senha com sessão persistente, ambientes dev/prod isolados. O isolamento de dados é mandatório em todas as tabelas desde o primeiro commit.
- **FR-1 — Motor BuJo:** 4 tipos de log (Daily, Weekly, Monthly, Future) com motor de migrações como máquina de estados. Cada tarefa tem um ciclo de vida explícito com 6 estados (pending, started, completed, cancelled, migrated, postponed). Recorrentes com placement manual. Arquivo de ciclos fechados.
- **FR-2 — Hábitos:** Schema dinâmico com tipos booleano/numérico, pesos configuráveis, cálculo de completude ponderado. Snapshot do peso vigente por dia — alterações de peso são prospectivas, nunca retroativas.
- **FR-3 — Saúde & Medicamentos:** Campos dinâmicos criados pelo usuário (nome, tipo, ativo). Medicamentos como entidade separada com blocos de horário e confirmação por bloco ou individual. Histórico em 3 visualizações (tabela, gráficos, dashboard).
- **FR-4 — Diário de Gratidão:** Texto livre, múltiplas entradas por dia, histórico navegável por data e mês.
- **FR-5 — Brain Dump:** Caixa de entrada sem data. Indicador visual persistente quando não vazio. Processamento manual.
- **FR-6 — Gestão de Usuários:** Fora do MVP. Schema e políticas de isolamento são pré-condição.

**Non-Functional Requirements:**

- **NFR-1:** Acesso mobile real — todas as ações do fluxo diário sem scroll horizontal
- **NFR-2:** Performance percebida como instantânea (< 2s) no Daily Log e migrações
- **NFR-3:** Isolamento total de dados entre usuários em todas as circunstâncias
- **NFR-4:** Imutabilidade histórica — **interpretação adotada: imutabilidade sistêmica apenas.** O sistema nunca altera registros históricos como efeito colateral de ações futuras (ex: alterar peso de um hábito hoje não retroage em logs passados). O usuário tem autonomia para editar manualmente qualquer registro histórico. Não são necessários mecanismos de write-protection ou append-only no banco.
- **NFR-5:** Ambientes dev e prod completamente separados
- **NFR-6:** Uptime 99% no horário ativo (6h–23h)

**Scale & Complexity:**

- **Domínio primário:** Full-stack web (SPA + API backend + banco relacional)
- **Nível de complexidade:** Alta (revisado de médio-alta — combinação de schema dinâmico, máquina de estados e snapshots sobre o mesmo eixo temporal cria superfície de integração complexa)
- **Componentes arquiteturais estimados:** 8 módulos de produto + 5 camadas transversais

### Technical Constraints & Dependencies

- **PostgreSQL via Neon:** banco relacional gerenciado, serverless, com suporte nativo a JSONB, RLS e branching de schema.
- **Django + DRF:** backend e API REST. Django gerencia migrations, ORM e auth.
- **React SPA + MUI:** frontend já decidido. SSR não é prioridade.
- **Sem offline no MVP:** toda leitura e escrita requer conexão ativa.
- **Schema dinâmico em runtime:** hábitos e métricas de saúde são campos criados pelo usuário — estratégias diferenciadas por entidade (ver decisões abaixo).

### Cross-Cutting Concerns Identificados

1. **Multi-tenancy:** toda tabela carrega `user_id`. Isolamento autoritativo na camada de aplicação via manager auto-escopado (AD-12); RLS no Postgres **não** é usado no MVP (decisão revisada em AD-12). Acesso de operador/admin é caminho privilegiado explícito e separado.
2. **Imutabilidade sistêmica (NFR-4):** o sistema nunca retroage em registros históricos, mas o usuário pode editar manualmente.
3. **Máquina de estados de tarefas:** transições auditáveis e consistentes com matriz formal definida.
4. **Schema dinâmico:** estratégia diferenciada — hábitos em tabelas normalizadas, métricas de saúde em JSONB.
5. **Theming MUI centralizado:** theme provider único e bem definido para garantir consistência entre implementações.
6. **Otimismo seletivo na UI:** operações de escrita têm resposta otimista com rollback em erro.

---

## 2. Stack Definida

| Camada | Decisão |
|---|---|
| Banco de dados | PostgreSQL via Neon |
| Backend / API | Django + Django REST Framework |
| Auth | djangorestframework-simplejwt (email/senha + JWT com refresh token) |
| Frontend | React SPA + Material UI |
| Isolamento multi-tenant | Camada de aplicação: manager auto-escopado por `user_id` (autoritativo). RLS **não usado** no MVP — ver AD-12 |
| Deploy | Railway |

---

## 3. Decisões Arquiteturais

### AD-01 — Schema Dinâmico: estratégia diferenciada por entidade

**Contexto:** FR-2 (hábitos) e FR-3 (métricas de saúde) exigem campos criados pelo usuário em runtime com múltiplos tipos. O padrão de armazenamento afeta performance de queries históricas, complexidade de RLS e facilidade de migração futura.

**Decisão:**

- **Hábitos → tabela normalizada.** A estrutura é conhecida: todo hábito tem `type` (boolean/numeric), `weight` e `value`. O log diário captura `weight_at_time` para preservar o snapshot sem JSONB.
- **Métricas de saúde → JSONB.** Os campos são genuinamente abertos — o usuário define nome, tipo e quantidade. JSONB com validação de tipo na camada de serviço (contra `health_field_definitions`). Índice: **latitude reservada, sem índice no MVP** (AD-14, sem NFR de performance). O GIN esboçado aqui **não foi adotado** — a query analítica de saúde é um cast *range on-expression* sobre chave dinâmica (`values->>'<uuid>'`), que o GIN (containment `@>`) e um índice de expressão estático (chave conhecida) não atendem genericamente; achado resolvido e documentado nas Stories 7.2/7.3.
- **Medicamentos → tabela normalizada.** Campos fixos (nome, dose, bloco de horário). Entidade separada de métricas de saúde.
- **View materializada:** não por ora. Adicionar se performance de queries analíticas se tornar perceptível com o crescimento de dados.

**Schema simplificado:**

```
habits (id, user_id, name, type, active, ...)
habit_logs (id, user_id, habit_id, date, value NUMERIC, weight_at_time NUMERIC)

health_field_definitions (id, user_id, name, field_type, enum_options JSONB, active, display_order)
-- enum_options: lista de rótulos (só para field_type=enum); Story 7.1/AC3 (precedente JSONB estruturado da AD-07)
health_logs (id, user_id, date, values JSONB)
-- values = {"uuid-campo-peso": 88.2, "uuid-campo-sono": 4, "uuid-atividade": true}

medications (id, user_id, name, dose, active)
medication_blocks (id, medication_id, block ENUM(morning, afternoon, night), dose_override)
medication_logs (id, user_id, medication_id, block, date, confirmed_at)
```

**Operacionalização da camada de serviço para JSONB:**
- Na escrita: serviço carrega `health_field_definitions` ativas do usuário, valida cada valor submetido contra o `field_type` correspondente, grava somente se tudo válido.
- Na leitura: serviço usa as definições para saber como tipar e renderizar cada campo.
- Em queries analíticas (gráficos): cast explícito via operadores JSONB (`(values->>'uuid')::numeric`). Implementado na Story 7.3 como `Cast(KeyTextTransform(uuid, "values"), FloatField())` → `::double precision` (o `::numeric` acima é ilustrativo); guarda `values__has_key` antes de castar + `field_type` imutável (7.1) tornam o texto sempre parseável.

---

### AD-02 — Máquina de Estados de Tarefas

**Contexto:** FR-1 define 6 estados de tarefa. O EXPERIENCE.md define os gestos de UI (clique cicla, migração vem do fluxo dedicado). Amelia e Winston sinalizaram que a ausência de uma matriz formal causaria implementações divergentes.

**Decisão — Matriz de transições:**

| De \ Para | pending | started | completed | cancelled | migrated | postponed |
|---|---|---|---|---|---|---|
| **pending** | — | ✅ clique | ✅ clique | ✅ menu | ✅ fluxo | ✅ fluxo |
| **started** | ✅ clique | — | ✅ clique | ✅ menu | ✅ fluxo | ✅ fluxo |
| **completed** | ✅ clique | ✅ clique | — | ✅ menu | ❌ | ❌ |
| **cancelled** | ✅ edição manual | ❌ | ❌ | — | ❌ | ❌ |
| **migrated** | ❌ | ❌ | ❌ | ❌ | — | ❌ |
| **postponed** | ❌ | ❌ | ❌ | ❌ | ❌ | — |

**Regras:**
- `migrated` e `postponed` são **estados terminais** no log de origem.
- `completed` pode ser reaberta via clique (volta para `pending`).
- `cancelled` pode ser desfeita via edição manual (volta para `pending`).
- Migração e adiamento só ocorrem via Fluxo de Migração — nunca via clique direto no status.

**Validação:** ENUM no Postgres (impede valores inválidos no banco) + lógica de transição no Django service layer (impede sequências inválidas).

---

### AD-03 — Rastreamento de Linhagem de Tarefas (migrated_to_task_id + migration_count)

**Contexto:** quando uma tarefa é migrada, o comportamento do registro original e a rastreabilidade da linhagem precisavam ser definidos.

**Decisão — Opção C (registro original preservado + ponteiro para sucessor):**

- O registro original permanece no log de origem com `status = migrated`.
- Um novo registro é criado no log de destino com `status = pending`.
- O registro original recebe `migrated_to_task_id` apontando para o novo registro.
- O novo registro herda `migration_count = original.migration_count + 1`.
- Tanto `migrated` quanto `postponed` incrementam o contador — a tarefa está se "arrastando" independente do destino.

**Racional:** o `migration_count` digitaliza a fricção intencional do BuJo analógico. Uma tarefa com contagem alta é um sinal explícito de que ela precisa de atenção — ser concluída, redefinida ou cancelada de vez.

**Schema de tasks — campos relevantes:**

```
tasks:
  id                    uuid  PK
  user_id               uuid  FK → users
  log_id                uuid  nullable, FK → logs
  weekly_log_id         uuid  nullable, FK → weekly_log
  monthly_log_id        uuid  nullable, FK → monthly_log
  scheduled_date         DATE  nullable  -- dia opcional dentro de um weekly/monthly log
  status                enum(pending, started, completed, cancelled, migrated, postponed)
  migrated_to_task_id   uuid  nullable, FK → tasks (self-referential)
  migration_count       integer  default 0
  eisenhower            enum(ui, u, i, none)  nullable
  category              enum(teal, purple, pink, yellow, green, blue)  nullable  -- agrupamento visual (borda 3px na Task Row), independente do Eisenhower (ver DESIGN.md#Categorias Semânticas)
  order_index           float  (ordenação manual)
  title                 text
  description           text  nullable
  created_at            timestamptz
  updated_at            timestamptz
```

**Generalização do vínculo Task↔log (Story 4.1, aditiva ao congelamento do Epic 3, aprovada por Hugo).** O congelamento da Story 3.1 assumia só o Daily Log. O modelo do Épico 4 exige que uma tarefa possa morar em qualquer horizonte (daily **ou** weekly **ou** monthly), então `log_id` passou a nulável e ganhou duas FKs irmãs nuláveis (`weekly_log_id`, `monthly_log_id`) mais `scheduled_date` (dia específico opcional dentro de um weekly/monthly log; `null` = só o mês/semana, sem dia — o parcial do Future Log, FR-1.2). Um `CHECK` (`task_exactly_one_log`) garante no banco que **exatamente um** dos três containers está preenchido. A mudança é aditiva e segura: linhas daily existentes já têm `log_id` preenchido e as duas FKs novas nulas, satisfazendo o CHECK sem migração de dado. Subtarefas herdam o container do pai.

---

### AD-04 — Contrato Temporal Implícito (resolve T4)

**Contexto:** Daily Log, hábitos, saúde e medicamentos precisam concordar sobre o que "hoje" significa e como datas são armazenadas — caso contrário cada módulo inventa a própria interpretação. Edge cases motivadores: usuário registrando às 23h59, usuário em fuso diferente, dias pulados, e o fluxo (comum no produto) de preencher hoje os registros de ontem.

**Decisões:**

1. **Autoridade temporal.** O servidor (UTC) é a autoridade do *instante*. `users.timezone` (IANA, ex. `America/Sao_Paulo`, persistido, editável, detectado no signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`) é a autoridade da *zona* para "que dia é hoje". O cliente nunca dita a data. Armazenar sempre o nome IANA, nunca offset numérico (offset perde DST).

2. **Duas categorias de coluna temporal — separadas por intenção:**
   - `timestamptz` (armazenado em UTC; `USE_TZ = True` no Django) para instantes de evento/auditoria: `created_at`, `updated_at`, `completed_at`, `migrated_at`, confirmação de medicamento, etc. Respondem "que instante absoluto".
   - `DATE` puro (sem hora, sem fuso) para a "página do diário": `log_date`, data de hábito, data de métrica de saúde. Conceito calendárico — a página "17 de junho" é a mesma de qualquer lugar do mundo.

3. **Função única de "hoje".** `today_for(user) = timezone.now().astimezone(ZoneInfo(user.timezone)).date()` em `core/calendar.py`. **Nenhum módulo** chama `date.today()` ou `timezone.now().date()` diretamente. Guardrail: grep no CI / teste de arquitetura que falha o build em uso direto. A virada do dia é **meia-noite no fuso do usuário**. O cutover configurável (~04h) foi **descartado** como complexidade desnecessária — onde a data importa ela é `DATE`, então um off-by-one de instante não causa prejuízo de dado. Pode ser revisitado como conforto futuro.

4. **Dia lógico da sessão congela na abertura da página.** Sem auto-refresh do "hoje" no meio de uma sessão ativa — quem está escrevendo às 23h59 termina no dia em que começou; a virada ocorre numa ação explícita (reabrir, navegar, Catch-Up).

5. **Sem automação de migração.** Logs passados permanecem intactos (`pending`/`started`). Não há cron de "fechar o dia" nem migração automática (seria pesadelo de fuso e mataria a tese do produto). A reconciliação após dias pulados é ato **deliberado** do usuário (fluxo Catch-Up — ver T9). `migration_count` só incrementa em decisão consciente de carregar a tarefa adiante. Uma ausência é UM evento de reencontro, não N migrações de procrastinação.

6. **Wall-clock histórico — necessidade reconhecida, implementação adiada (decisão pragmática).** Exibir "concluí às 16h (Brasil)" fielmente mesmo revisando de outro fuso exigiria persistir a zona *de cada evento* (`timestamptz` descarta o fuso e guarda só o instante UTC). Como esses casos de revisão são raros no uso diário:
   - **Por ora:** eventos gravados em `timestamptz` e renderizados no fuso **atual** do usuário (`users.timezone`). Sem coluna `occurred_tz` por evento.
   - **Captura de segurança:** tabela `user_day_timezone (user_id, date, iana_tz)` — uma linha por dia ativo, populada na primeira abertura do app no dia a partir do IANA do navegador; gaps preenchidos com o último valor conhecido. **Não é usada no read path atual.**
   - **Caminho futuro (não descartado):** se a precisão de wall-clock se tornar relevante (ex. viagens frequentes), usar o histórico da `user_day_timezone` para backfill de colunas `occurred_tz` nos eventos relevantes (padrão `OccurredAtMixin`: par `occurred_at timestamptz` + `occurred_tz` IANA, renderizado via `occurred_at.astimezone(ZoneInfo(occurred_tz))`).
   - **Trade-off aceito:** preenchimento retroativo feito em fuso diferente do dia de origem fica impreciso na tabela de captura — aceitável dada a raridade e a reversibilidade futura.

**Schema relevante:**

```
users
  timezone  varchar(64)  -- IANA, default detectado no signup, editável

user_day_timezone           -- captura de segurança; NÃO usada em read por ora
  user_id  uuid  FK
  date     DATE
  iana_tz  varchar(64)
  PK (user_id, date)
```

**Edge cases resolvidos:**
- *Migração às 23h59:* destino default = `today_for(user)` no instante da requisição (servidor projeta no fuso do usuário). Origem fica como `migrated`. Janela de segundos na virada de meia-noite é aceita (determinística e auditável).
- *Fuso na viagem:* o diário segue o `users.timezone` declarado ("a casa") até o usuário mudar a preferência. Sem troca automática por geolocalização/browser (evita migrações fantasma).
- *Dias pulados:* sem acúmulo automático — ver item 5 e T9.

---

### AD-05 — Semântica de Calendário (Semana / Mês / Ano)

**Decisões:**

- **Segunda-feira é o primeiro dia da semana.**
- **A primeira semana de um mês/ano é sempre a que contém o dia 1.** Divergência consciente do ISO-8601 (que define semana 1 como a que contém a primeira quinta-feira / o dia 4 de janeiro, e cada semana pertence a exatamente um ano).
- **Consequência aceita:** uma semana de virada pertence a **dois meses e dois anos simultaneamente**. Ex.: com 01/01/2023 num domingo, a semana 26/12/2022–01/01/2023 é a última de dez/2022, a primeira de jan/2023 e a primeira de 2023.

**Chaveamento (evita duplicação de dados):**

- **Weekly Log** chaveado pela data da **segunda-feira** (`week_start DATE`, `CHECK EXTRACT(ISODOW FROM week_start) = 1`).
- **Monthly Log** chaveado pelo **dia 1** (`month_first DATE`, `CHECK EXTRACT(DAY FROM month_first) = 1`).
- O pertencimento a mês/ano é **derivado na leitura**, nunca armazenado como ordinal `(ano, mês, semana_n)` — ordinais duplicariam a semana de virada em duas linhas divergentes. A semana de virada é **uma única linha**, compartilhada pelas duas visões mensais (editar numa vista edita a mesma página na outra).

```sql
CREATE TABLE weekly_log (
  user_id    uuid NOT NULL REFERENCES users(id),
  week_start DATE NOT NULL,   -- sempre uma segunda-feira
  body       JSONB,
  PRIMARY KEY (user_id, week_start),
  CONSTRAINT week_start_is_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1)
);

CREATE TABLE monthly_log (
  user_id     uuid NOT NULL REFERENCES users(id),
  month_first DATE NOT NULL,  -- sempre dia 1
  body        JSONB,
  PRIMARY KEY (user_id, month_first),
  CONSTRAINT month_first_is_day_one CHECK (EXTRACT(DAY FROM month_first) = 1)
);
```

**Funções de derivação (em `core/calendar.py`):**

```python
def week_start_of(d: date) -> date:        # segunda-feira da semana de d (chave da Weekly)
    return d - timedelta(days=d.weekday())

def weeks_of_month(year, month) -> list[date]:   # week_starts do mês; 1ª = a que contém o dia 1
    first = date(year, month, 1)
    last  = date(year, month, calendar.monthrange(year, month)[1])
    cur, out = week_start_of(first), []
    while cur <= last:
        out.append(cur); cur += timedelta(days=7)
    return out

def months_of_week(week_start) -> set[tuple[int,int]]:   # 1 ou 2 (ano, mês) a que a semana pertence
    end = week_start + timedelta(days=6)
    return {(week_start.year, week_start.month), (end.year, end.month)}
```

**Casos de teste-âncora:** `week_start_of(2023-01-01) == 2022-12-26`; `months_of_week(2022-12-26) == {(2022,12),(2023,1)}`; `weeks_of_month(2022,12)[-1] == weeks_of_month(2023,1)[0] == 2022-12-26` (mesma linha nas duas visões).

**Future Log = `monthly_log` futuro (Story 4.1, decisão de Hugo).** O Future Log **não é uma entidade separada** — não existe tabela `future_log_item`. É o próprio conjunto dos `monthly_log` com `month_first` maior que o mês corrente. "Jogar uma tarefa pro futuro" é criar uma `Task` num `monthly_log` de um mês futuro, com `scheduled_date` opcional (parcial = sem dia, FR-1.2). O `POST /api/bujo/logs/monthly/` é o único write path — serve tanto o Monthly Log do mês corrente quanto o Future Log; `GET /api/bujo/future-log/` é só uma visão agrupada por mês. Editar/excluir um item do Future Log usa os endpoints de tarefa já existentes.

---

### AD-06 — Snapshot de Hábitos: materialização ansiosa por dia + timeline de configuração (resolve T5)

**Contexto:** FR-2.4 calcula a completude diária como `Σ(contribuição × peso) / Σ(peso de todos os hábitos ativos naquele dia)`. FR-2.5/2.6 exigem que peso, meta e bonus "vigentes naquele dia" sejam preservados historicamente — o sistema nunca retroage (NFR-4), mas o usuário edita manualmente qualquer dia. AD-01 deixou `habit_logs` esparso com `weight_at_time`, insuficiente para o denominador (hábitos ativos não-marcados não teriam linha nem peso) e vulnerável a edições retroativas que "sangram" para dias vizinhos.

**Decisões:**

1. **Grão normalizado por `(user_id, habit_id, date)`** — confirma AD-01. Uma linha por hábito por dia. Permite FR-2.9 (histórico por data) e os gráficos de evolução por hábito; agregar em JSONB inviabilizaria a query "evolução do hábito X no tempo".

2. **Duas camadas com papéis distintos:**
   - **`habit_versions` — configuração prospectiva (autoridade de semeadura).** Timeline efetivada por data. O estado de um hábito no dia D = a versão com `max(effective_from) <= D`. Mudar peso (UJ-8.2), desativar (FR-2.7) ou reativar (FR-2.8) = inserir nova versão. Congela `weight`, `active`, e — para numéricos — `meta` e `bonus`, porque todos afetam a contribuição histórica (FR-2.4).
   - **`habit_day_entries` — snapshot realizado, congelado e editável por dia.** Carrega `weight_at_time`, `meta_at_time`, `bonus_at_time` e `value`. É a fonte de verdade do que aconteceu naquele dia.

3. **Materialização ansiosa na primeira abertura do dia.** Ao abrir o Daily Log do dia D pela primeira vez, grava-se uma linha por hábito **ativo em D**, com peso/meta/bonus **semeados da versão vigente em D** e `value` nulo. Coerente com o padrão "congela na abertura" do AD-04 — sem cron, sem job de fundo. Dias pulados e abertos depois (Catch-Up, T9) são semeados com a versão vigente *naquele dia*, não a de hoje — é isto que torna FR-2.6 literalmente correto.

4. **Denominador = todas as linhas de `habit_day_entries` do dia.** Fonte única na leitura, sem fallback para versão.

5. **Semântica da ausência (binária, sem terceiro estado):**
   - Hábito **ativo** sem valor → "não feito": contribui 0%, **conta no denominador** (booleano não-marcado = 0; numérico sem valor = 0% da meta).
   - Hábito **inativo** → "não aplicável": não tem linha no dia, **fora do denominador**.

6. **Edição vs. mudança de config — nunca se confundem:**

| Ação | Mecanismo | Sangra? |
|---|---|---|
| Mudar peso "a partir de hoje" (UJ-8.2) | INSERT `habit_version` com `effective_from = hoje`; semeia só dias abertos daqui em diante | ❌ dias congelados intactos |
| Corrigir peso de um dia passado avulso | UPDATE no `weight_at_time` **daquela única linha** | ❌ só aquele dia recalcula |

A edição avulsa **não toca** `habit_versions` — a timeline de config permanece limpa; apenas a completude daquele dia muda. NFR-4 honrado: o sistema nunca retroage, o usuário edita o que quiser.

**Schema:**

```sql
habits (
  id, user_id, name, emoticon, group_id,
  type ENUM(boolean, numeric)   -- identidade/cosmético; type não muda após criação
)

habit_versions (
  id, habit_id  FK → habits,
  weight   NUMERIC,
  active   BOOLEAN,
  meta     NUMERIC NULL,        -- numéricos: alvo (FR-2.3)
  bonus    NUMERIC NULL,        -- numéricos: bonus de completude %
  effective_from DATE
)
-- estado em D = versão com max(effective_from <= D)

habit_day_entries (
  id, user_id, habit_id  FK → habits,
  date            DATE,
  value           NUMERIC NULL,   -- nulo = não-feito; booleano marcado = 1
  weight_at_time  NUMERIC,        -- congelado e editável por dia
  meta_at_time    NUMERIC NULL,
  bonus_at_time   NUMERIC NULL,
  PRIMARY KEY (user_id, habit_id, date)
)
-- materializado na 1ª abertura do dia, uma linha por hábito ativo em D
```

**Casos-âncora:**
- *Peso muda hoje:* dias passados já materializados mantêm `weight_at_time`; só dias abertos de hoje em diante usam a nova versão.
- *Correção avulsa de 10 dias atrás:* UPDATE numa linha; vizinhos intactos.
- *Dia pulado aberto no Catch-Up:* semeado com a versão vigente naquele dia, não a atual.
- *Hábito reativado (FR-2.8):* nova versão `active=true`; só entra no denominador de dias abertos a partir da reativação.

**Impacto em AD-01:** a linha `habit_logs (... weight_at_time)` de AD-01 é substituída por `habit_day_entries` acima, complementada pela timeline `habit_versions`. `weight_at_time` deixa de ser mera cópia de auditoria e passa a ser o valor operante por dia.

---

### AD-07 — Modelo de Medicamentos: slot estável + blocos dinâmicos + agenda/substância versionadas + log realizado por dia (resolve T6 e T7)

**Contexto:** FR-3.4–3.7 definem medicamentos como entidade própria com blocos de horário, doses por bloco (FR-3.5), confirmação por bloco *ou* individual (FR-3.6), e ativo/inativo com histórico preservado (FR-3.7). T6 pergunta o grão do log; T7 pergunta se a ausência de confirmação é distinta da ausência de hábito. A AD-01 esboçou `medication_logs` com `block ENUM` — insuficiente: o bloco é dinâmico (definido pelo usuário), a ausência de uma dose é um evento clínico (não um zero de denominador), e o "remédio" que o usuário acompanha é um **slot estável** cujo produto/dose/médico mudam ao longo do tempo.

**Decisões:**

1. **Grão do log = `(medicamento, bloco, data)`** (Opção B de T6). Confirmação **individual** = uma linha; confirmação do **bloco inteiro** ("tomar remédios da manhã") = escrita em lote de todas as linhas daquele bloco no dia. **Bloco parcialmente confirmado** é representável naturalmente (subconjunto das linhas com `confirmed_at`). O status "bloco confirmado" é **derivado** (todas as linhas `scheduled` do bloco no dia confirmadas), nunca armazenado.

2. **Bloco é tabela dinâmica por usuário (`time_blocks`), sem ENUM e sem papel analítico nem restritivo.** Apenas agrupa e ordena para o atalho "confirmar tudo". O usuário pode criar "antes do almoço" sem migração de schema. `active` esconde sem apagar (preserva referências históricas). **Isto descarta o `block ENUM(morning, afternoon, night)` assumido na AD-01 e na AD-04.**

3. **Slot estável vs. produto vigente (responde à modelagem de "título"):**
   - **`medications.title`** = o slot estável da rotina ("Remédio de pressão"). É o que ganha blocos, agenda e histórico contínuo de adesão — não quebra quando o médico troca a substância.
   - **`medication_substance_versions`** = o produto que preenche o slot ao longo do tempo (substância/nome comercial, laboratório, médico que receitou). Trocar o remédio ou o laboratório = inserir nova versão. Produto vigente no dia D = versão com `max(effective_from) <= D`.

4. **Dois eixos de versão independentes:**
   - **Dose** muda por `(medicamento, bloco)` → `medication_schedule_versions` (FR-3.5). Congela `dose` e `active`.
   - **Substância / laboratório / médico** mudam no nível do medicamento → `medication_substance_versions`. "Só a dose" toca a agenda; "só o laboratório" toca a substância; "o remédio inteiro" normalmente toca os dois.

5. **Dose como JSONB estruturado multi-componente** (coerente com AD-01: estrutura de cada componente fixa, mas o número de componentes é aberto — cobre remédios com mais de uma droga):
   ```jsonc
   dose = [
     {"label": "paracetamol", "amount": 500, "unit": "mg"},
     {"label": "codeína",     "amount": 30,  "unit": "mg"}
   ]
   ```
   Validação na camada de serviço (cada componente: `amount` numérico, `unit` não-vazia), mesmo padrão das métricas de saúde da AD-01. **Análise futura preservada:** `amount` numérico permite correlação "dose ao longo do tempo × peso/saúde" via cast JSONB (`(dose->0->>'amount')::numeric`) sobre a timeline de `medication_schedule_versions`; o `label` por componente permite escolher a droga num remédio multi-droga. Não é foco do MVP; se virar caminho quente e pesado, normaliza-se para tabela-filha (mesma postura de "revisitar se necessário" da AD-01).

6. **Tabela de médicos (`doctors`)** associada via `prescribed_by` na **versão de substância** (é ali que o médico age — a prescrição). Habilita análises futuras ("quais remédios o Dr. X receitou", "o que mudou quando troquei de cardiologista").

7. **Camada realizada (`medication_day_entries`) — espelha AD-06.** Materialização **ansiosa na 1ª abertura do dia** (coerente com AD-04/AD-06): uma linha por `(medicamento, bloco)` **agendado e ativo em D**, com `dose_at_time` semeada da versão vigente em D, `confirmed_at` nulo, `source = scheduled`. Dias pulados abertos no Catch-Up (T9) são semeados com a versão vigente **naquele dia**.

8. **`source` distingue agendado de avulso (PRN):**
   - `scheduled` — veio da agenda; materializado; ausência é significativa.
   - `ad_hoc` — tomei sem previsão (ex.: remédio de dor de cabeça num dia específico); linha criada na confirmação, `confirmed_at` preenchido, sem contrapartida esperada, `time_block_id` opcional.

9. **Substância derivada, dose congelada.** `medication_day_entries` congela apenas `dose_at_time` (valor operante e editável por dia, igual ao `weight_at_time` da AD-06). Substância/laboratório são **derivados por data** da timeline (`max(effective_from) <= date`), mantendo o `day_entries` enxuto sem perder fidelidade histórica.

10. **Semântica da ausência (resolve T7) — medicamento ≠ hábito:**

    | Situação | Significado |
    |---|---|
    | Linha `scheduled` com `confirmed_at` nulo, dia passado | **Dose perdida** — sinal clínico de adesão (distinto de hábito) |
    | Linha `scheduled` com `confirmed_at` preenchido | Tomado conforme esperado |
    | Sem linha no dia | Não aplicável (medicamento inativo naquele dia) |
    | Linha `ad_hoc` | Sempre confirmada; ausência sem sentido |

    **Contraste com AD-06:** hábito ausente vira **0% e entra no denominador** (matemática de completude). Medicamento **não tem denominador** — a ausência de uma dose agendada é um **evento clínico de perda**, exibível como tal, e existe a categoria PRN/avulsa que hábito não tem.

11. **Edição avulsa não sangra (igual AD-06):** corrigir dose ou `confirmed_at` de um dia passado é `UPDATE` naquela única linha de `medication_day_entries`; não toca a agenda nem a substância. NFR-4 honrado: o sistema nunca retroage, o usuário edita o que quiser.

**Schema:**

```sql
doctors (
  id, user_id, name,
  specialty TEXT NULL            -- ex. "Cardiologista"
)

time_blocks (
  id, user_id, name, display_order,
  active BOOLEAN
)  -- dinâmico; só agrupa/ordena para "confirmar tudo"; sem papel analítico nem restritivo

medications (
  id, user_id,
  title TEXT                     -- slot estável: "Remédio de pressão" (sem coluna active;
)                                --   ativo/inativo vive nas versões de agenda)

medication_substance_versions (
  id, user_id,
  medication_id   FK → medications,
  substance_name  TEXT,          -- o remédio de fato: "Losartana 50mg"
  laboratory      TEXT NULL,
  prescribed_by   FK → doctors NULL,
  effective_from  DATE
)  -- produto vigente em D = versão com max(effective_from <= D)

medication_schedule_versions (
  id, user_id,
  medication_id   FK → medications,
  time_block_id   FK → time_blocks,
  dose            JSONB,         -- [{label, amount(numeric), unit}], nº de componentes livre
  active          BOOLEAN,
  effective_from  DATE
)  -- estado de (med, bloco) em D = versão com max(effective_from <= D)

medication_day_entries (
  id, user_id,
  medication_id   FK → medications,
  time_block_id   FK → time_blocks NULL,   -- nulo permitido p/ avulso sem bloco
  date            DATE,
  dose_at_time    JSONB,                    -- congelado da versão vigente em D
  confirmed_at    TIMESTAMPTZ NULL,         -- nulo = não confirmado
  source          ENUM(scheduled, ad_hoc)
)
-- scheduled: materializado na 1ª abertura, 1 linha por (med, bloco) ativo em D
-- UNIQUE (user_id, medication_id, time_block_id, date) WHERE source = 'scheduled'
```

**Casos-âncora:**
- *Confirmar "remédios da manhã":* `UPDATE confirmed_at = now()` em todas as linhas `scheduled` do bloco "manhã" no dia.
- *Confirmar um só:* `UPDATE` numa linha.
- *Bloco parcial:* 2 de 3 linhas confirmadas → status do bloco = "parcial" (derivado).
- *Dose muda hoje (FR-3.5):* nova `medication_schedule_versions`; dias já materializados mantêm `dose_at_time`; só dias abertos daqui em diante usam a nova dose.
- *Cardiologista troca o remédio:* nova `medication_substance_versions` (nova substância/lab/médico); o slot "Remédio de pressão" e seu histórico de adesão continuam intactos.
- *Remédio para dor de cabeça num dia avulso:* `INSERT` com `source = ad_hoc`, `confirmed_at = now()`, sem expectativa.
- *Dose perdida ontem:* linha `scheduled` com `confirmed_at` nulo num dia passado → exibida como perda clínica.

**Impacto em AD-01 e AD-04:** substitui a porção de medicamentos da AD-01 (`medication_blocks` com `block ENUM` e `medication_logs` deixam de existir nessa forma). O `block ENUM(morning, afternoon, night)` da AD-04 fica **descartado** — blocos agora são dinâmicos em `time_blocks`. `confirmed_at` segue `timestamptz` conforme AD-04.

---

### AD-08 — Tarefas Recorrentes (template prospectivo + instância congelada) e Subtarefas (árvore auto-referencial) (resolve T8 + define subtarefas)

**Contexto:** FR-1.11 define recorrentes como **templates** (título, grupo de recorrência, recorrência em texto livre, ativo, demais campos de tarefa); FR-1.12 + addendum determinam **placement manual, sem auto-placement e sem parsing** do texto de recorrência. T8 pergunta se o template vive em tabela separada, se o placement gera nova `task` ou referencia o template, e se editar uma instância afeta o template. A modelagem escancarou uma lacuna: **subtarefas** (FR-1.3) ainda não existiam no schema de `tasks` (AD-03).

**Decisões — Recorrentes:**

1. **Template em tabela separada (`recurring_task_templates`).** Um template não é uma tarefa: não tem `status`, `log_id` nem ciclo de vida, e não migra. Misturá-lo em `tasks` poluiria a máquina de estados (AD-02) e o modelo de logs.

2. **Placement gera nova `task` (snapshot), com ponteiro de linhagem.** Ao colocar um recorrente num dia/log, cria-se uma `tasks` real copiando os campos do template naquele instante, com `source_template_id` apontando para a origem. A instância passa a ser uma tarefa de primeira classe (inicia, conclui, migra via AD-03, cancela, adia, reordena, edita). **Não é referência viva** ao template — uma referência faria a edição futura do template retroagir sobre instâncias passadas, violando NFR-4 e a filosofia de snapshot das AD-06/AD-07.

3. **Instância e template são independentes.** Editar a instância toca só aquela `task`; editar o template afeta só **placements futuros**, nunca os já feitos. Mesmo split prospectivo/congelado das AD-06/AD-07.

4. **`recurrence_text` não é parseado** (addendum) — texto livre exibido na lista de placement. Sem cron, sem auto-placement (reforça "sem automação" da AD-04).

5. **`recurrence_group` ENUM(weekly, monthly, annual)** — define em qual abertura de ciclo (FR-1.12 / FR-1.9) o template é apresentado. Controla apresentação, não placement.

6. **`active` é booleano simples — SEM versionamento** (contraste consciente com AD-06/AD-07). Não há denominador retroativo dependente de "ativo no dia D": o template só é apresentado ou não, e instâncias passadas já são `tasks` congeladas. Se "adesão a recorrentes" virar métrica futura, adiciona-se effective-dating — YAGNI por ora.

**Decisões — Subtarefas:**

7. **Subtarefa = `task` com `parent_task_id` (árvore auto-referencial / lista de adjacência).** Uma subtarefa É uma tarefa, com a mesma estrutura — sem segunda entidade. `parent_task_id` nulo = raiz; preenchido = filho. Profundidade arbitrária no schema (UI pode limitar a 1–2 níveis).

8. **Template é sempre plano.** `recurring_task_templates` não carrega subtarefas; o placement cria **uma única `task` raiz**, sem subárvore. O usuário adiciona filhos manualmente depois, se quiser.

9. **Status independente, sem cascata automática** (coerente com AD-04). Concluir todos os filhos não conclui o pai automaticamente, nem vice-versa — é juízo explícito do usuário.

10. **Fechamento de log (FR-1.10) considera a subárvore.** Uma tarefa-pai só está "disposta" quando ela **e** seus filhos têm disposição; um pai com filho pendente não fecha a semana.

11. **Migração de um pai (interação com AD-03).** O fluxo de migração (FR-1.7) opera sobre tarefas raiz; migrar um pai **recria no destino a subárvore de filhos ainda não dispostos** (pending/started). Filhos já concluídos/cancelados **não viajam** (ficam no registro histórico). Cada nó carregado segue AD-03 individualmente (`migrated_to_task_id` + `migration_count++`), preservando a auditabilidade da linhagem. A árvore original inteira permanece na origem marcada conforme AD-03.

12. **`log_id` e `order_index` da subtarefa.** A subtarefa compartilha o `log_id` do pai (vive no mesmo log); seu `order_index` é relativo aos irmãos sob o mesmo pai.

**Schema (delta sobre AD-03):**

```sql
tasks (
  ... ,                          -- campos de AD-03 (status, eisenhower, order_index, migração...)
  parent_task_id      uuid NULL  FK → tasks,                  -- subtarefa = task com pai
  source_template_id  uuid NULL  FK → recurring_task_templates -- linhagem de recorrente
)

recurring_task_templates (
  id, user_id,
  title            TEXT,
  description      TEXT NULL,
  eisenhower       ENUM(ui, u, i, none) NULL,    -- default copiado no placement
  recurrence_group ENUM(weekly, monthly, annual),
  recurrence_text  TEXT,                          -- livre, NÃO parseado; só exibição
  active           BOOLEAN                        -- booleano simples, sem versão
)                                                 -- template é plano: sem subtarefas
```

**Placement (FR-1.12):** `INSERT tasks` com `log_id` = destino, `status = pending`, `parent_task_id = NULL`, `order_index` definido na colocação, campos copiados do template, `source_template_id = template.id`, `migration_count = 0`.

**Casos-âncora:**
- *Placement de recorrente semanal:* na abertura da semana, app lista templates `weekly` ativos; usuário coloca cada um → uma `task` raiz por placement, com `source_template_id`.
- *Editar template depois:* placements já feitos intactos; só próximos placements usam a nova versão.
- *Editar uma instância colocada:* toca só aquela `task`; template intacto.
- *Migrar pai com 2 filhos (1 concluído, 1 pendente):* destino recebe pai + o filho pendente recriados (pending); o filho concluído fica na origem; árvore original marcada `migrated`.
- *Fechar a semana:* pai com filho pendente impede o fechamento até o filho ter disposição.

**Impacto em AD-03:** `tasks` ganha `parent_task_id` e `source_template_id` (ambos nullable). A máquina de estados (AD-02) e a linhagem (AD-03) aplicam-se a todo nó da árvore.

---

### AD-09 — Catch-Up / Log Órfão: fluxo de migração generalizado, detecção por query, reconciliação deliberada (resolve T9)

**Contexto:** o Fluxo de Migração (EXPERIENCE Fluxo 1) assume "ontem" — banner detecta tarefas sem disposição do dia anterior e o usuário decide cada uma num modal. T9 pergunta o que acontece quando o usuário pula vários dias (viagem, férias, esquecimento): o sistema acumula migrações pendentes? Apresenta um fluxo de catch-up? A **AD-04 (item 5)** já fixou a filosofia (sem cron, sem auto-migração; reconciliação deliberada; *uma ausência é UM evento de reencontro, não N migrações*). AD-09 **operacionaliza** isso.

**Decisões:**

1. **Catch-Up = Fluxo de Migração generalizado, não subsistema novo.** Mesma máquina de estados (AD-02), mesma linhagem (AD-03), mesmo modal de decisão-por-tarefa. Muda apenas a **fonte**: de "tarefas de ontem" para "tarefas sem disposição (`pending`/`started`) em qualquer log com data < hoje".

2. **Detecção por query, sem estado acumulado e sem cron.** Não existe fila de migrações materializada. As tarefas órfãs permanecem no log de origem (o último dia ativo); os dias pulados **nunca foram abertos → nunca materializaram nada** (sem `habit_day_entries`, `medication_day_entries` nem Daily Log). Não há "N dias órfãos", há um **conjunto de tarefas não-dispostas** aguardando.

3. **Gatilhos por condição, não por data.** A revisão semanal/mensal dispara por *"existe Weekly/Monthly anterior com tarefas sem disposição?"*, não por *"hoje é segunda / primeira semana"*. Uma segunda pulada ainda faz a revisão semanal aparecer na quarta.

4. **Ordem hierárquica do BuJo:** havendo catch-up em vários níveis, apresenta **mês → semana → dia** (do mais grosso ao mais fino).

5. **`migration_count += 1` por decisão de reconciliação** (AD-04 reforçado), independentemente de quantos dias de calendário foram pulados. O sistema não itera a tarefa por cada dia ausente.

6. **Dias pulados = lacunas honestas, não 0%.** Sem linhas materializadas, a completude/adesão desses dias é "não aplicável" (fora do denominador — AD-06) / "sem linha" (AD-07), nunca "0% de tudo". O sistema não fabrica dias vazios que afundariam estatísticas.

7. **Catch-Up é só de tarefas.** Preencher hábitos/saúde de um dia pulado usa o caminho normal: navegar até o dia → materializa na abertura com a versão vigente daquele dia (AD-06/AD-07). Sem obrigação, sem auto-fill no Catch-Up.

8. **Horizonte = Opção A (apresenta tudo, item a item).** Toda tarefa não-disposta de datas anteriores entra no fluxo, sem janela nem arquivamento automático. Máxima fidelidade ao método (counter-métrica do PRD: 100% das decisões de migração exigem ação explícita). Justificativa do usuário: na prática nunca houve ausência > 5 dias, mesmo no caderno físico, então a pilha intimidante não é preocupação real para o MVP.

**Backlog (pós-MVP):**
- **Disposição em lote** (Opção B): agrupar órfãos por data de origem com ação explícita de lote ("cancelar todas as 12 de maio") para suavizar ausências longas sem mover nada em silêncio.
- **Aviso prévio de ausência planejada:** usuário declara "estarei viajando de X a Y" e o BuJo se comporta diferente nesses dias (não conta como lacuna/ausência a reconciliar).

**Sem impacto de schema.** AD-09 é mecânica de fluxo sobre estruturas já definidas; a detecção é uma query sobre `tasks` (status + data do log). Nenhuma tabela nova.

**Casos-âncora:**
- *Ausência de 5 dias:* ao reabrir, a query acha as tarefas `pending`/`started` do último dia ativo; banner oferece o fluxo; cada uma decidida explicitamente; `migration_count += 1` por tarefa migrada (não × 5).
- *Segunda pulada:* abrir na quarta ainda dispara a revisão semanal (gatilho por condição).
- *Hábitos da viagem:* dias pulados ficam como lacuna; se quiser registrar algum, navega até o dia e ele materializa na abertura.

---

### AD-10 — Pesos Diferenciados por Tipo de Dia (fim de semana / feriado) (resolve T16)

**Contexto:** FR-2.1 organiza hábitos em grupos. O usuário quer que o peso de hábitos de um **grupo** seja ajustado por **tipo de dia** — ex.: hábitos profissionais valem ×0.2 em fins de semana. Fins de semana são detectáveis automaticamente; feriados são marcados manualmente. Isso incide diretamente sobre o snapshot de hábitos (AD-06) e exige preservar a imutabilidade sistêmica (NFR-4).

**Decisões:**

1. **Multiplicador por grupo × tipo de dia (não por hábito).** Vive no grupo e aplica-se a todos os hábitos dele. Tipo de dia ∈ {`weekday`, `weekend`, `holiday`}. `weekday` é implicitamente **1.0**; só se configuram `weekend` e `holiday`. Grupo sem multiplicador = 1.0; hábito sem grupo = 1.0. Override por hábito isolado **não** é previsto (sem cenário de uso).

2. **Tipo de dia — resolução e precedência `holiday > weekend > weekday` (sem acumular):**
   - `weekend`: detecção automática = sábado/domingo (coerente com AD-05, semana começando na segunda).
   - `holiday`: booleano manual por data em `user_holidays (user_id, date)`; presença = feriado (por usuário — feriado é pessoal/regional).
   - Um sábado marcado como feriado usa o multiplicador de **feriado** (não multiplica os dois).

3. **Congelar base e multiplicador separadamente (não o produto).** `habit_day_entries` passa a congelar, além do `weight_at_time` (peso **base**, como na AD-06): `day_type` e `multiplier_at_time` (default 1.0). O **peso efetivo** = `weight_at_time × multiplier_at_time`. Separar (em vez de gravar o produto) habilita: transparência na UI ("peso 5 × 0.2 = 1.0"), distinção entre mudança real de peso e queda de fim de semana (conexão com T10), e override avulso do multiplicador de um único dia.

4. **Fórmula de completude (atualiza AD-06):**
   > completude(D) = `Σ(contribuição × peso_efetivo) / Σ(peso_efetivo dos hábitos ativos em D)`, com `peso_efetivo = weight_at_time × multiplier_at_time`.

5. **Config do multiplicador é versionada e prospectiva** (igual `habit_versions`): alterar o multiplicador de um grupo só afeta dias abertos daqui em diante; dias congelados ficam intactos. NFR-4 honrado.

6. **Marcar/desmarcar feriado recalcula só aquele dia** (bounded, paridade com a edição avulsa da AD-06): toggle de `user_holidays` na data D re-resolve `day_type` e `multiplier_at_time` de todas as linhas de D, sem sangrar para vizinhos.

7. **Materialização** (1ª abertura do dia, AD-06): resolve `day_type(D)`, busca o multiplicador do grupo vigente em D para aquele tipo e congela `multiplier_at_time`. Dias pulados abertos no Catch-Up são semeados com a versão vigente naquele dia (consistente com AD-06/AD-09).

8. **Escopo: só hábitos.** Medicamentos e gratidão não têm peso nem completude — fora do alcance desta decisão.

**Schema (delta sobre AD-06):**

```sql
habit_groups (                         -- formaliza o que a AD-06 só referenciava (FR-2.1)
  id, user_id, name, display_order
)

habit_group_day_multipliers (
  id, user_id, group_id FK,
  day_type    ENUM(weekend, holiday),  -- weekday não armazenado (= 1.0)
  multiplier  NUMERIC,                 -- ex. 0.2
  effective_from DATE
)  -- multiplicador vigente em D = versão com max(effective_from <= D)

user_holidays (
  user_id, date,
  PRIMARY KEY (user_id, date)
)  -- presença = feriado marcado manualmente

habit_day_entries (                    -- AD-06 + 2 campos
  ... ,
  day_type            ENUM(weekday, weekend, holiday),  -- resolvido e congelado na materialização
  multiplier_at_time  NUMERIC                            -- congelado, default 1.0
)
```

**Casos-âncora:**
- *Sábado normal, grupo Profissional com weekend=0.2:* hábitos profissionais materializados com `multiplier_at_time = 0.2`; peso efetivo = base × 0.2 no numerador e denominador.
- *Sábado marcado feriado, grupo com holiday=0.0:* usa o multiplicador de feriado (precedência), não o de fim de semana.
- *Mudar o multiplicador do grupo hoje:* dias passados congelados mantêm o `multiplier_at_time` antigo; só dias abertos daqui em diante usam o novo.
- *"Nesse sábado eu trabalhei":* override avulso de `multiplier_at_time` daquela linha/dia para 1.0; vizinhos intactos.
- *Marcar feriado num dia já materializado:* recalcula `day_type` e `multiplier_at_time` só daquele dia.

**Impacto em AD-06:** a fórmula de completude passa a usar `peso_efetivo = weight_at_time × multiplier_at_time`; `habit_day_entries` ganha `day_type` e `multiplier_at_time`. O `weight_at_time` continua sendo o peso base congelado. Formaliza `habit_groups`.

---

### AD-11 — Apresentação de Mudanças de Peso: anotação por stream de versões, multiplicador como ritmo (resolve T10)

**Contexto:** uma mudança de peso aparece como salto em qualquer série temporal de hábito (completude ao longo do tempo, gráfico de evolução). T10 pergunta se o sistema anota o salto, exibe nota contextual ou silencia. Após a AD-10, uma série de hábito tem **três fontes de variação** que não podem ser confundidas: (1) **valor** (comportamento), (2) **mudança real de config** (peso/meta/bonus/ativo via `habit_versions` — eventos discretos datados), (3) **multiplicador de tipo de dia** (queda periódica de fim de semana/feriado — ritmo, não evento). O DESIGN já fixou a postura "honesto com o passado" e a FR-2.5 já anota a mudança no momento da edição.

**Decisões:**

1. **Política: anotar mudanças reais, nunca silenciar.** Coerente com a ética "honesto com o passado" e com a tooltip da FR-2.5. Silenciar está descartado.

2. **Contrato de read-path (evita divergência de implementação):**
   - **`habit_versions` é a fonte de um stream de eventos datados de mudança** — cada nova versão (peso, meta, bonus, e ativar/desativar das FR-2.7/2.8) é um ponto de anotação com `effective_from` + o diff (valor anterior → novo), derivado de versões consecutivas.
   - **`habit_day_entries` é a série diária** (valor, peso efetivo).
   - **`day_type` / `multiplier_at_time` são estilo/contexto, nunca evento.** Fim de semana/feriado se representam como sombreamento do período (ou pela linha de peso efetivo caindo), jamais como marcador de "peso mudou".

3. **Prominência: marcadores sempre visíveis, discretos** (Opção A). Linha vertical discreta + ponto na timeline; o diff (ex.: "Exercício 3 → 4") aparece no hover/tooltip. Combina com a estética "ferramenta, não produto de consumo" do DESIGN (marcador funcional, sem floreio) e com a transparência como valor central.

4. **Sem impacto de schema.** T10 é política de read-path + apresentação sobre estruturas já existentes (`habit_versions` + `habit_day_entries` + `day_type` da AD-10). Nada novo no banco — barato de honrar já no MVP.

**Casos-âncora:**
- *Peso de Exercício 3→4 em 16/jun:* marcador discreto em 16/jun; hover mostra "3 → 4"; a série de peso efetivo dá um degrau ali.
- *Todo sábado o grupo Profissional cai a 0.2:* a linha de peso efetivo dipa nos sábados com sombreamento de fim de semana; **nenhum** marcador de mudança — é ritmo, não evento.
- *Hábito desativado em mai e reativado em jun (FR-2.7/2.8):* marcadores "desativado" / "reativado" nos pontos; gap na série entre eles.

**⚠️ Pendência de reconciliação com o PRD:** esta sessão confirmou que o **gráfico de evolução de hábitos entra no MVP**. O PRD/FR-2 hoje só especifica FR-2.9 ("histórico por data"); gráficos aparecem apenas em Saúde (FR-3.3). Recomenda-se um addendum/correct-course no PRD para tornar o requisito do gráfico de hábitos rastreável, e a especificação visual fina (métricas plotadas, eixos, range de datas) deve ser detalhada na UX spec — a AD-11 fixa só a política de anotação e o contrato de dados.

---

### AD-12 — Isolamento Multi-Tenant na Camada de Aplicação (revisa estratégia de RLS) (resolve T11)

**Contexto:** o doc havia decidido "filtragem explícita no ORM (primária) + RLS no Postgres (secundária)". T11 alertava que credenciais privilegiadas sem validação de `user_id` quebrariam NFR-3 por design. Ao detalhar, o usuário clarificou o **threat model real**: a preocupação é **um usuário não ver dados de outro**; ele, como **operador/admin**, precisa ver todas as tabelas em completude (debug, análise de uso). São coisas distintas — isolamento na fronteira da aplicação ≠ muro de banco que bloqueia o próprio operador.

**Reinterpretação de NFR-3** (paralela à de NFR-4): *"isolamento em todas as circunstâncias" = na fronteira da aplicação* (onde usuários acessam dados via API), não enforcement no nível do banco que bloqueie acesso de operador. Acesso direto/admin de Hugo é caminho privilegiado legítimo, fora do fluxo que serve usuários.

**Decisões:**

1. **Isolamento na camada de aplicação, sem RLS no Postgres.** Aposenta a "defesa secundária via RLS" e o `FORCE ROW LEVEL SECURITY`. Sem GUC por request, sem ginástica com o pooling serverless do Neon.

2. **Manager padrão auto-escopado.** Todo model tenant tem como `objects` um `TenantManager` que filtra por `user_id` a partir de um **`contextvar`** (`current_user_id`) setado num middleware logo após a autenticação. `Model.objects` já vem isolado — o isolamento é o **default**, não um "lembre-se de filtrar". Na criação, `user_id` é preenchido automaticamente do contextvar.

3. **Falha segura na ausência de contexto.** Se não há usuário no contextvar (tarefa de sistema, request mal configurada), o manager escopado **levanta erro** em vez de retornar tudo — impede vazamento acidental pelo caminho default.

4. **Acesso de operador é caminho explícito e separado.** Um `Model.all_objects` (manager não-escopado), Django Admin com superuser, ou acesso direto ao banco dão visão cross-tenant completa para debug/análise. Uso explícito e raro, nunca no caminho que serve usuário final.

5. **Guardrail em CI:** teste de arquitetura que falha o build se (a) um model tenant expuser manager não-escopado como `objects` default, ou (b) houver SQL cru sem escopo de `user_id` em caminho de usuário.

6. **Trade-off documentado:** sem rede no banco, o modo de falha é "uma query *explicitamente* não-escopada vaza". Mitigado por o default já ser escopado (sair do escopo exige `all_objects` deliberado, só no caminho admin) + guardrail. Aceitável para o threat model (admin solo; ameaça é bug honesto, não tenant malicioso). Se um dia o produto abrir para terceiros não-confiáveis, reavaliar RLS (Opção B do T11 fica como caminho de upgrade).

**Sem schema novo** além do `user_id` que toda tabela tenant já carrega (cross-cutting concern #1).

**Casos-âncora:**
- *Request de usuário:* middleware seta `current_user_id`; toda query via `objects` filtra sozinha; dev não precisa lembrar do `.filter(user=...)`.
- *Debug do admin:* Hugo usa `all_objects`/Admin/psql e vê todos os usuários.
- *Job sem usuário:* `objects` levanta erro → força o autor a escolher conscientemente `all_objects` ou setar o contexto.

**Impacto:** revisa a linha "Isolamento multi-tenant" da Stack (§2) e o cross-cutting concern #1 (§1) — a parte "RLS no Postgres como defesa secundária" é **substituída** por "isolamento autoritativo na camada de aplicação via manager auto-escopado; RLS não usado no MVP".

---

### AD-13 — Estado do Frontend: indicador do Brain Dump como server state derivado; TanStack Query como camada de dados (resolve T12)

**Contexto:** o indicador do Brain Dump (FR-5.4) é um badge numérico no item do sidebar (visível até colapsado) e no FAB mobile, persistente enquanto a caixa não está vazia. T12 pergunta onde esse estado vive: store de cliente (Context/Zustand), count query no mount, ou outro mecanismo. Afeta a arquitetura de estado do frontend.

**Insight central:** a contagem do badge é **server state** (a verdade mora no Postgres), não client state. Guardá-la num store de cliente cria uma segunda fonte de verdade que precisa ser sincronizada à mão em toda tela e diverge na primeira omissão. A resposta limpa é **derivar do cache de servidor**, mantido fresco por invalidação nas mutações.

**Decisões:**

1. **Badge = server state derivado**, não store de cliente. Os componentes (sidebar + FAB) leem a mesma entrada de cache e re-renderizam juntos; nenhum guarda número próprio.

2. **TanStack Query (v5) como camada de dados do app** — fetch + cache em memória (por chave, client-side, por sessão) + mutações. T12 é o caso concreto que ancora esse padrão para todo o app (não só o Brain Dump).

3. **Contagem via endpoint dedicado leve** `GET /brain-dump/count`, com chave `['brainDump', 'count', userId]`. A query fica ativa no app inteiro (sidebar/FAB sempre montados); carga mínima.

4. **Mutações invalidam a chave** (capturar / processar / descartar) → o badge atualiza sozinho em qualquer superfície. Sem store manual, sem `+1/-1` espalhado.

5. **Otimismo na captura** — incremento otimista do badge ao salvar no FAB, rollback em erro. Operacionaliza o cross-cutting concern #6 ("otimismo seletivo na UI").

6. **Staleness real (mesmo usuário, vários dispositivos)** resolvida por **refetch on window focus** (padrão da lib) + refetch ao montar/navegar; não há push entre abas. Realtime/websocket só se virar requisito (não é o caso).

7. **Separação de estado:** server state → TanStack Query; estado de UI efêmero (modais, data selecionada) → Context/estado local. O badge é firmemente server state.

8. **Isolamento entre usuários NÃO depende do cache** (o cache é client-side por navegador; invalidar é ato local). Vem da auth + manager escopado da AD-12 no servidor. Boas práticas: `userId` na chave (evita colisão em navegador compartilhado) e `queryClient.clear()` no logout.

**Schema/API:** apenas um endpoint leve de contagem; nenhuma estrutura de banco nova.

**Casos-âncora:**
- *Captura no FAB:* badge sobe otimista na hora; mutação invalida `['brainDump', 'count', userId]`; confirma com o servidor.
- *Processar item no desktop:* invalida a mesma chave → badge cai no sidebar e no FAB.
- *Dois usuários simultâneos:* caches separados em navegadores separados; invalidação de um nunca toca o outro; respostas já escopadas por AD-12.
- *Desktop + mobile do mesmo usuário:* ao focar a aba do desktop, refetch corrige o badge.

**Impacto:** estabelece TanStack Query como o padrão de data-fetching/mutação do frontend (React SPA + MUI já decididos), base para o otimismo seletivo do cross-cutting concern #6.

---

### AD-14 — Escopo do NFR-2: só o modo de execução diária (resolve T14)

**Contexto:** o produto tem três modos de uso com perfis de performance distintos — execução diária (hot path), planejamento (Weekly/Monthly/Future, abertura de ciclo) e revisão histórica (gráficos/dashboard analíticos). O NFR-2 ("< 2s, percebido como instantâneo") foi escrito mirando a execução diária. T14 pergunta se os outros dois modos precisam de NFRs próprios.

**Decisão (pragmática, YAGNI):**

1. **NFR-2 (< 2s) aplica-se exclusivamente ao modo 1 — execução diária** (Daily Log, marcação de hábito/saúde/medicamento, migrações). É a promessa de "instantâneo", sustentada pelo otimismo seletivo na UI (cross-cutting #6).

2. **Modos 2 (planejamento) e 3 (revisão histórica/analítica) não têm NFR de performance formal no MVP.** Se o tempo de resposta se tornar problema em algum momento, trata-se então — com a latitude arquitetural já reservada (índices, otimização de query e o escape de **view materializada** previsto em AD-01/AD-06).

**Racional:** evita super-otimizar o analítico (que é engenharia diferente, sobre histórico longo) e prometer instantâneo onde não há requisito real. Mantém o foco de performance onde o produto vive no dia a dia.

**Sem impacto de schema.**

---

### AD-15 — Antecipação do Brain Dump para a Fase 1b (resolve T15)

**Contexto:** o roadmap do PRD posiciona o Brain Dump na Fase 5 (última). T15 questiona se é tarde demais, dado que ele é tecnicamente simples e é a válvula de escape do sistema, especialmente no mobile (UJ-4).

**Decisão: antecipar o Brain Dump para a Fase 1b** (logo após o Daily Log).

**Racional:**
- **Trivial e desacoplado:** não depende de hábitos/saúde/medicamentos; a AD-13 já desenhou todo o seu estado (badge como server state derivado).
- **Válvula de escape mobile:** UJ-4 (captura em trânsito) e o NFR-1 ("mobile real") são centrais à proposta de valor; sem o Brain Dump cedo, o usuário mobile não tem captura rápida nos primeiros estágios.
- **Dependências mínimas:** auth (FR-0) + Daily Log existir (para os itens terem destino de processamento) → 1b é o ponto mais cedo sensato.
- **Complementa o marco da Fase 1** ("abandono do caderno"): capturar + processar juntos.

**⚠️ Pendência de reconciliação com o PRD:** as fases vivem no roadmap do PRD. Esta decisão exige um correct-course/addendum no PRD para mover o Brain Dump de Fase 5 → Fase 1b.

**Sem impacto de schema.**

---

### AD-16 — "Mover para Hoje" (destino explícito ao Daily Log), balde de semana sem dia no seletor de Mover, e navegação de logs passados não-fechados

**Contexto:** em uso após o 1º lote do Épico 11 (Correct Course 2026-07-15), a Story 11.6 revelou três lacunas: (a) "mover para hoje" caía sempre em placement semanal (`weekly_log` + `scheduled_date`), nunca no Daily Log (`log_id`) — a superfície onde o dia é de fato executado (o `LogSerializer` só lê o container `log`); (b) o seletor de Mover não oferecia alocar "na semana sem dia" (decisão explícita da 11.6 de não ter esse balde) nem um passo de confirmação; (c) logs passados **não-fechados** eram inalcançáveis pela navegação (o Arquivo, Story 4.6, lista só ciclos fechados), prendendo suas pendências.

**Decisões:**

1. **"Hoje" é destino explícito ao Daily Log.** O seletor de Mover (`TaskDestinationDialog`) oferece "Hoje" → `destination='today'` (container `log`), distinto de escolher um dia no calendário (placement semanal, `scheduled_date`). **Sem agregação automática** de tarefas semanais/mensais no Daily Log — a fricção intencional do BuJo é preservada (consistente com AD-04, "sem auto-migração"). Trazer para hoje é ação explícita do usuário. Reusa o `destination='today'` já existente em `migrate_task` (hoje só acionado pelo Fluxo de Migração de fim-de-dia) — sem endpoint/serializer/coluna novos.

2. **O balde de "semana/mês sem dia" volta a ser destino no seletor de Mover.** Revoga a decisão da Story 11.6 ("não há balde de semana sem dia"): o seletor passa a permitir alocar na semana corrente sem `scheduled_date` (o backend já suportava via `migrate_task(destination="week")` sem data) e, análogamente, no mês sem dia. A restrição da 11.6 era de UI, não de domínio.

3. **Confirmação explícita no seletor de Mover.** O `TaskDestinationDialog` passa a exigir um botão "Migrar" (título "Migrar Tarefa"); preencher/selecionar não dispara sozinho, e clicar num dia do calendário **preenche o campo** em vez de mover imediatamente. **Escopo limitado a este seletor** — o Fluxo de Migração de fim-de-dia (`MigrationCard`) mantém a confirmação automática dos pickers (UX-DR3 inalterado; decisão do Hugo no Correct Course).

4. **Passado aberto é navegável e acionável; passado fechado é read-only.** A navegação livre para trás (semanas/meses e Daily Log por data) reusa as leituras por período já existentes (`week_start`/`month_first`; para o Daily Log, uma leitura por data — única adição de backend). O `_check_container_open` (Story 11.5) segue como a **única** fronteira de escrita: período fechado = Arquivo (somente-leitura), período passado aberto permanece acionável sem código de permissão novo.

**Impacto de schema:** nenhum. Referência: `sprint-change-proposal-2026-07-15.md`, Épico 11 Stories 11.10 e 11.11.

---

## 4. Rastreador de Tópicos

Registro de todos os tópicos arquiteturais identificados. **Resolvidos** apontam para a AD que os fechou; os **em aberto** ficam ao final, na ordem sugerida de retomada.

### ✅ Resolvidos

**T1 — Schema Dinâmico: EAV vs JSONB vs Tabelas Tipadas** (Winston + Amelia + Mary)
Afeta FR-2 (hábitos) e FR-3 (saúde). Impacta RLS, performance de queries históricas (NFR-2) e facilidade de migração de schema. Amelia e Winston apontam JSONB como favorito; Mary alerta que essa decisão precisa estar na Fase 0, não adiada para Fase 2/3.
→ resolvido em **AD-01** (estratégia diferenciada: hábitos e medicamentos em tabelas normalizadas; métricas de saúde em JSONB com validação na camada de serviço).

**T2 — Matriz de Transições da Máquina de Estados de Tarefas** (Winston + Amelia)
O diagrama pending → started → done / migrated / postponed / cancelled não define: quais transições são válidas de cada estado, quem valida (frontend ou constraint/trigger no Postgres), se done pode ser reaberto, e se migrated é terminal ou gera um filho. Sem isso, cada história de FR-1 vai ter premissas implícitas diferentes.
→ resolvido em **AD-02** (matriz formal de transições; ENUM no Postgres + lógica no service layer; `completed` reabre via clique; `migrated`/`postponed` terminais).

**T3 — Rastreamento de Linhagem de Tarefas Migradas** (Winston)
Quando uma tarefa é migrada entre logs, o item pai "morre" e nasce um filho? Ou é o mesmo registro com novo log_id? Winston propõe coluna migrated_to_task_id como ponteiro mínimo. Sem isso, perde-se a auditabilidade que é o valor central do BuJo.
→ resolvido em **AD-03** (Opção C: registro original preservado com `status = migrated` + `migrated_to_task_id` apontando para o sucessor; `migration_count` incrementa).

**T4 — Contrato Temporal Implícito** → resolvido em **AD-04** (autoridade temporal, `DATE` vs `timestamptz`, `today_for`, sem auto-migração, tabela de captura de fuso) e **AD-05** (semântica de calendário semana/mês/ano).

**T5 — Granularidade do Snapshot de Hábitos** → resolvido em **AD-06** (grão normalizado `(user_id, habit_id, date)`; duas camadas — `habit_versions` prospectiva + `habit_day_entries` congelada/editável por dia; materialização ansiosa na 1ª abertura semeada da versão vigente em D; ausência binária ativo/inativo; edição avulsa não sangra para vizinhos).

**T6 — Granularidade do Log de Medicamentos** → resolvido em **AD-07** (grão `(medicamento, bloco, data)`; bloco "confirmado"/"parcial" derivado; blocos dinâmicos em `time_blocks`, sem ENUM e sem papel analítico; confirmação por bloco = escrita em lote).

**T7 — Ausência de Confirmação de Medicamento vs Ausência de Hábito** → resolvido em **AD-07** (medicamento ≠ hábito: dose agendada não confirmada em dia passado = **dose perdida**, sinal clínico, não zero de denominador; `source = scheduled | ad_hoc` separa esperado de PRN; sem linha = não aplicável).

**T8 — Modelo de Recurring Task Templates** → resolvido em **AD-08** (template em tabela separada `recurring_task_templates`; placement cria `task` snapshot com `source_template_id`; instância e template independentes; `recurrence_text` não parseado; `active` booleano simples). **Subtarefas** também definidas: `task` com `parent_task_id` (árvore auto-referencial); template é plano.

**T9 — O "Dia que Não Fecha" / Log Órfão** → resolvido em **AD-09** (Catch-Up = fluxo de migração generalizado; detecção por query sem cron nem estado acumulado; gatilhos por condição; dias pulados = lacunas honestas, não 0%; Catch-Up só de tarefas; horizonte Opção A — apresenta tudo item a item; lote e aviso-prévio de ausência no backlog).

**T16 — Pesos Diferenciados por Tipo de Dia (fim de semana / feriado)** (levantado por Hugo) → resolvido em **AD-10** (multiplicador por grupo × tipo de dia; precedência `holiday > weekend > weekday` sem acumular; fim de semana automático, feriado manual em `user_holidays`; base e multiplicador congelados separados em `habit_day_entries`; config versionada prospectiva; só hábitos). Conecta com **T10** (separar multiplicador de mudança real de peso no gráfico).

**T10 — Apresentação Visual de Mudanças de Peso de Hábitos** → resolvido em **AD-11** (anotar via stream de eventos de `habit_versions`, nunca silenciar; multiplicador de tipo de dia é ritmo/estilo, nunca evento; marcadores sempre visíveis e discretos com diff no hover; sem schema novo). Confirmou que o **gráfico de evolução de hábitos entra no MVP** — pendência de reconciliação com o PRD registrada na AD-11.

**T11 — Fronteira RLS vs Camada de Serviço / Django** → resolvido em **AD-12** (isolamento autoritativo na camada de aplicação via manager auto-escopado por `contextvar`; RLS não usado no MVP; acesso de operador/admin como caminho privilegiado explícito; falha segura na ausência de contexto; guardrail em CI; NFR-3 reinterpretado como isolamento na fronteira da aplicação).

**T12 — Indicador Técnico do Brain Dump** → resolvido em **AD-13** (badge como server state derivado, não store de cliente; TanStack Query como camada de dados do app; endpoint de contagem leve com chave `['brainDump', 'count', userId]`; mutações invalidam a chave; otimismo na captura; staleness multi-dispositivo via refetch-on-focus; isolamento garantido por auth + AD-12, não pelo cache).

**T13 — Complexidade Alta** → sem pendência (complexidade reclassificada de médio-alta para alta; registro apenas).

**T14 — Três Modos de Uso com NFRs Distintos** → resolvido em **AD-14** (NFR-2 < 2s aplica-se só ao modo 1 — execução diária; planejamento e revisão histórica sem NFR formal no MVP; tratar depois se virar problema, com a latitude de view materializada já reservada).

**T15 — Brain Dump: Fase 5 é tarde demais?** → resolvido em **AD-15** (antecipar para Fase 1b, logo após o Daily Log; trivial, desacoplado, válvula de escape mobile; exige correct-course do roadmap no PRD).

### ✅ Todos os tópicos endereçados

Não há tópicos arquiteturais em aberto. As pendências de **reconciliação com o PRD** foram **resolvidas** em 2026-06-22 via `correct-course` (ver `sprint-change-proposal-2026-06-22.md`):
- ✅ Gráfico de evolução de hábitos no MVP (AD-11) → **FR-2.10** adicionado ao PRD.
- ✅ Brain Dump Fase 5 → Fase 1b (AD-15) → roadmap do PRD (seção 7) atualizado.

---

## 5. Ponto de Retomada

**Todos os tópicos arquiteturais identificados (T1–T16) estão resolvidos** — 15 decisões registradas (AD-01 a AD-15).

**Reconciliação com o PRD:** ✅ concluída em 2026-06-22 (`sprint-change-proposal-2026-06-22.md`) — FR-2.10 (gráfico de hábitos) adicionado e Brain Dump movido para Fase 1b no roadmap.

**Padrões de Implementação:** ✅ concluído (step-05, ver Seção 6) — 10 subseções de regras de consistência para agentes de IA, refinadas em sessão de party-mode (Winston, Amelia, Dr. Quinn, Mary). Decisões-chave fechadas: tenant fail-closed, `TextChoices`+`CheckConstraint`, PKs UUID, rotação de refresh com single-flight.

**Estrutura do Projeto:** ✅ concluído (step-06, ver Seção 7) — árvore monorepo (`backend/` + `frontend/`), dev/prod via branches do Neon, refinada em party-mode (Amelia, Winston, Sally). Decisões-chave: autoridade do "dia" em `core/calendar.py` (grafo acíclico), regra de porta do `core` via import-linter, catch-up tasks-only em `bujo/services/` (AD-09), camada `app/`+`pages/` no frontend com ESLint boundary, prefetch paralelo no Daily Log (NFR-2) com `/daily/:date` agregado reservado (AD-14).

**Validação:** ✅ concluída (step-07, ver Seção 8) — **READY FOR IMPLEMENTATION** (16/16 no checklist, confiança alta, sem lacunas críticas). Lacunas importantes não-bloqueantes para o MVP solo: observabilidade/uptime (I-1) e logging (I-2), deferidos como gate antes de multiusuário no Épico 10.

**Próximos passos sugeridos:**

1. **Concluir o workflow de arquitetura** (step-08 — handoff de implementação).
2. **Quebrar em épicos e histórias** a partir das ADs (a arquitetura está pronta para implementação).

---

## 6. Padrões de Implementação & Regras de Consistência

_Regras que todos os agentes de IA DEVEM seguir para escrever código compatível. Foco em **consistência**, não em detalhes de implementação. Ancorado na stack (seção 2) e nas ADs (seção 3). Refinado em sessão de party-mode (Winston, Amelia, Dr. Quinn, Mary) que caçou pontos de divergência entre agentes._

**Pontos de conflito endereçados:** 14 categorias. As §6.7 (ciclo de vida do tenant), §6.8 (Tempo & Domínio) e §6.10 (Reference Implementations) foram acrescentadas para fechar lacunas comportamentais e alinhar agentes por exemplo, não só por regra.

### 6.1 Nomenclatura

**Banco de dados (PostgreSQL/Django):**
- Tabelas: `snake_case` no plural — `habits`, `habit_logs`, `medication_day_entries`, `health_field_definitions`.
- Colunas: `snake_case`. FK = `<entidade>_id` (`user_id`, `habit_id`, `migrated_to_task_id`).
- Índices: `idx_<tabela>_<coluna(s)>` (ex.: `idx_habit_logs_user_id_date`). Toda tabela tenant indexa `user_id`.
- **PKs: `UUID`** (default `uuid4`, server-side; o cliente também pode gerar para mutação otimista — ver §6.5 e AD-13).
- **Valores fechados: `models.TextChoices` + `CheckConstraint`** no banco — nunca ENUM nativo do Postgres (evita `ALTER TYPE` frágil; mantém integridade na constraint). Aplica-se a status de tarefa (AD-02), blocos de medicamento (AD-07), `source` (AD-07), tipo de hábito (AD-01), tipo de dia (AD-10).
- **Migrations:** `--name` descritivo **obrigatório** (`0007_add_habit_day_entries_idx`, nunca `auto_<timestamp>`); uma migration por story/PR; ENUM/choices alterados via nova migration limpa.

**API REST (DRF):**
- Recurso no plural, `kebab-case` quando composto: `/api/habits/`, `/api/habit-logs/`, `/api/medication-blocks/`.
- Parâmetro de rota via router padrão DRF: `/api/habits/{uuid}/`.
- Prefixo `/api/` em tudo; query params em `camelCase` (alinhado ao casing JSON, ver 6.3).

**Código:**
- Python: `snake_case` (funções, variáveis, módulos), `PascalCase` (classes/models), `UPPER_SNAKE` (constantes).
- React/TS: componentes `PascalCase` em arquivo `PascalCase.tsx`; hooks `useXxx`; funções/variáveis `camelCase`; tipos/interfaces `PascalCase`.

### 6.2 Estrutura

**Backend (Django por domínio):**
- Um app por domínio: `accounts`, `core`, `bujo` (tasks/logs/migração), `habits`, `health`, `medications`, `gratitude`, `braindump`.
- **Camada de serviço obrigatória, com assinatura fixa** (ancorado em AD-01, AD-02, AD-12):
  - Lógica em `<app>/services.py` (ou pacote `<app>/services/<agregado>.py` quando crescer). **Funções de módulo, nunca classes de serviço.**
  - Assinatura: `def <verbo>_<substantivo>(*, user, ...) -> Model`. `user` é sempre o **primeiro kwarg, keyword-only**. O serviço recebe **dados já validados + `user` explícito**, nunca o objeto `request`.
  - **A transação mora no serviço:** `@transaction.atomic` decora o serviço que faz escrita multi-tabela. A view **nunca** abre `atomic`.
  - O serviço retorna a **instância de domínio** atualizada/criada.
  - Views são finas: parseiam/validam (serializer) → chamam o serviço → serializam a resposta. Models não carregam regra de transição.
- **Settings** divididos: `settings/base.py` + `dev.py` + `prod.py` (FR-0 exige dev/prod isolados); config via `django-environ` (`.env`, nunca commitado).
- **Testes:** `<app>/tests/` com mapeamento fixo por camada — `test_models.py`, `test_serializers.py`, `test_services.py`, `test_views.py`, **`test_isolation.py`** (isolamento de tenant, obrigatório por app). `conftest.py` na raiz define fixtures compartilhadas (`user`, `other_user`, `api_client`, `auth_client`) e ativa `@pytest.mark.django_db` por default. `factory_boy` em `<app>/tests/factories.py`: classe `<Model>Factory`; **toda factory de model tenant declara `user = SubFactory(UserFactory)`**.

**Frontend (React por feature):**
- `src/features/<dominio>/` (components, hooks, api, types co-localizados por feature).
- `src/shared/` para UI e utilitários reutilizáveis; `src/api/client.ts` (Axios + interceptors); `src/api/keys.ts` (query-key factory).
- **Tipos da API: fonte única.** Gerados de `drf-spectacular` em `src/api/types.gen.ts` (preferido) **ou**, se manual, em `src/api/types/<dominio>.ts` — nunca tipos ad-hoc espalhados. Campos JSONB de chave dinâmica (`health_logs.values`) tipados explicitamente como `Record<string, HealthValue>` (a exceção do camelCase — ver 6.3).
- Material UI via tema centralizado (`src/theme.ts`), nunca estilos inline ad-hoc.

### 6.3 Formatos de Dados & API

- **Casing JSON:** `camelCase` na borda via `djangorestframework-camel-case` (parser + renderer). Internamente tudo é `snake_case` (Python/DB). Query params também em camelCase.
  - **Exceção crítica — JSONB de chave dinâmica:** `health_logs.values` (indexado por UUID de `health_field_definitions`) **NÃO** é convertido em nenhuma direção (leitura e escrita). A varredura do `djangorestframework-camel-case` é recursiva e cega; sem limite explícito o round-trip **não é idempotente** (uma chave `blood_pressure` no JSONB viraria `bloodPressure` e voltaria errada). Regra: exclua o campo via `SerializerMethodField` que devolve `dict` opaco **ou** configuração explícita de ignore; **sempre** com o `HealthLogSerializer` canônico de §6.10 como referência. Proibido confiar em "as chaves são UUID, não vão converter".
- **Respostas (DRF nativo, sem envelope):**
  - Objeto: corpo direto — `{ "id": "uuid", "name": "Água" }`.
  - Lista: paginação padrão DRF — `{ count, next, previous, results: [...] }`.
- **Paginação & filtros (input fixado):** `PageNumberPagination` default, `page_size` padrão 50 (`?page=`). Filtros via `django-filter`; ordenação via `OrderingFilter` (`?ordering=`). Nomes de filtro/ordering em camelCase na borda, mapeados para o campo `snake_case` no backend.
- **Datas (AD-04):** saída `DATE` → `"YYYY-MM-DD"`; `timestamptz` → ISO 8601 UTC (`"2026-06-22T10:00:00Z"`). **Entrada:** datetime sempre com offset/UTC explícito; naive é **rejeitado** (400). Servidor armazena sempre UTC; o cliente resolve fuso na exibição. A autoridade temporal é `today_for()` (ver §6.8), nunca o relógio do cliente.
- **Booleanos:** `true`/`false`. **Null/ausência:** campo ausente ≠ `null` — seguir a semântica das ADs (medicamento sem linha = não aplicável, AD-07; ausência de hábito = binária, AD-06).

### 6.4 Erros

- **Taxonomia de exceções de domínio** em `core/exceptions.py` — hierarquia base `DomainError` com subclasses tipadas: `InvalidTransition` (AD-02), `ImmutableSnapshot` (AD-06/07), `TenantScopeViolation` (AD-12), etc. **Proibido levantar `ValidationError`/`ValueError`/`PermissionDenied` crus de dentro de `services/`** — só exceções de domínio.
- **Exception handler custom (DRF)** uniformiza o corpo: `{ "detail": "...", "fields": { "campo": ["msg", ...] } }`. `fields` é sempre **`{campo: [array de mensagens]}`** (formato nativo DRF). Mapa exceção→status:

  | Exceção / situação | Status |
  |---|---|
  | Erro de validação de serializer | `400` + `fields` |
  | `InvalidTransition` e demais `DomainError` de regra | `409` |
  | Sem autenticação | `401` |
  | Acesso a recurso de **outro usuário** (existe, não é seu) | `404` (esconde existência) |
  | **Contexto de tenant ausente/ambíguo** (`TenantScopeViolation` por contexto vazio) | `500` + **alerta** — o handler **NÃO** domestica; é bug de infra, não negação de acesso |
  | Inesperado | `500` |

- **Frontend:** Error Boundary global para crashes de render; estados de erro do TanStack Query para erros de dados; mensagem ao usuário via componente padrão (Snackbar/Alert MUI). Erro técnico vai para log, nunca para a tela crua.

### 6.5 Estado, Loading & Comunicação (frontend)

- **Camada de dados (AD-13):** TanStack Query v5. Toda leitura passa por `useQuery`; toda escrita por `useMutation` com invalidação por chave.
- **Query keys — forma fixa:** factory centralizada em `src/api/keys.ts` no padrão **`[escopo, entidade, 'list'|'detail', params?]`** (ex.: `keys.habits.logs(date)` → `['habits', 'logs', 'list', { date }]`). Mutações invalidam **por prefixo** `[escopo, entidade]`. Proibido literal de chave inline (invalidação que "não pega" é bug silencioso de cache).
- **Loading:** `isPending`/`isFetching` do TanStack Query; loading local por feature (skeleton/spinner MUI), não flag global manual.
- **Mutação otimista — wrapper canônico:** onde a AD-13 previu (captura do Brain Dump), usar o helper de §6.10 que faz `onMutate` (cancel queries + snapshot do cache) → `onError` (rollback) → `onSettled` (invalidate). Nunca otimismo artesanal por mutation. IDs gerados no cliente via `crypto.randomUUID()` (viável por causa do UUID PK).
- **Auth (simplejwt) — contrato fixo:**
  - `ACCESS_TOKEN_LIFETIME` curto (~30 min); `REFRESH_TOKEN_LIFETIME` **7 dias**; `ROTATE_REFRESH_TOKENS = True` + `BLACKLIST_AFTER_ROTATION = True`. Usuário ativo nunca desloga; inatividade > 7 dias → re-login.
  - Tokens em `localStorage` (chaves `access_token`, `refresh_token`); interceptor Axios anexa `Authorization: Bearer <access>`.
  - **Refresh single-flight (obrigatório por causa da rotação):** uma única promise de refresh compartilhada; requisições que tomam `401` **aguardam** essa promise e fazem retry **uma vez**; `401` no próprio refresh → `logout()`. Sem isso, N 401 simultâneos disparam N refreshes e a rotação invalida o token em uso (logout no meio do uso).
  - **Multi-aba:** listener de `storage` re-sincroniza o token entre abas; logout em uma aba limpa as demais.
  - **Logout:** limpa `localStorage` + `queryClient.clear()`.

### 6.6 Validação

- **Fronteira:** serializers DRF validam forma, tipo e enum-membership na entrada.
- **Regra de negócio (no serviço):** invariantes que o serializer não cobre. **Transição de estado ilegal (AD-02) é SEMPRE `InvalidTransition` levantada no serviço** (→ 409 pelo handler) — nunca um `validate_status()` no serializer. Idem: tipagem de JSONB contra `health_field_definitions` (AD-01), congelamento de snapshot (AD-06/07 → `ImmutableSnapshot`), linhagem de migração (AD-03). Toda escrita multi-tabela em `@transaction.atomic` no serviço.

### 6.7 Multi-Tenant — contrato de ciclo de vida (AD-12)

- **Isolamento por manager auto-escopado** lendo `current_user_id` de um `contextvar`.
- **Fail-closed, sempre:** `contextvar` vazio → o manager **levanta `TenantScopeViolation`**; **nunca** interpreta ausência de contexto como "todos os usuários". (Decisão A.)
- **Dentro do request:** middleware seta o `contextvar` **logo após** a autenticação JWT (depende do `user` do token) e **reseta no `finally`** — proibido vazar contexto entre requests num worker reusado.
- **Fora do request (commands, workers, shell, seeding, testes):** obrigatório envolver com o context manager canônico `with tenant_context(user): ...` (§6.10). Sem ele, o código falha alto — comportamento desejado.
- **Async/ASGI:** se uma view virar async, garantir propagação do `contextvar` através de `sync_to_async`/`async_to_sync` (não assumir herança automática).
- **Teste de regressão obrigatório** (`core/tests/test_isolation.py`): uma query **sem** contexto setado DEVE levantar `TenantScopeViolation` — não retornar vazio. Sem esse teste, AD-12 é esperança, não padrão.
- **Caminho de admin/operador:** `Model.all_objects` (sem escopo) é o caminho privilegiado explícito; permitido **apenas** em admin/shell de Hugo, nunca em código de aplicação.

### 6.8 Tempo, Materialização & Cálculo de Domínio (fecha AD-04, AD-06/07, AD-09, AD-10/11)

**Regra guarda-chuva:** toda lógica de tempo, materialização e cálculo de domínio reside na **camada de serviço**. Serializers e managers nunca derivam datas correntes, nunca disparam materialização e nunca aplicam multiplicadores.

- **Autoridade de "hoje" (AD-04):** nenhum código — service, manager, view ou frontend — chama `date.today()`/`timezone.now()` direto. Toda data corrente passa por **`today_for(user)`**, que resolve o fuso do usuário. Fonte de fuso única e documentada.
- **Materialização ansiosa de snapshot (AD-06/07) — decisão F:** ocorre via **método de service explícito** (`seed_habit_day(*, user, date)`), **nunca via signal**; **idempotente por chave `(user, date, tipo)`** (re-execução é no-op); **atômica** (mesma transação do agregado que a dispara). Snapshot já materializado é imutável (`ImmutableSnapshot`).
- **Catch-up / log órfão (AD-09):** detecção **por query** (sem cron nem estado acumulado); gatilho **on-read/on-login** do recurso afetado; quando materializa dias perdidos, **reusa o mesmo método de service** da semeadura (idempotência compartilhada — catch-up e materialização ansiosa nunca colidem).
- **Multiplicador por tipo de dia (AD-10):** calculado **só na camada de serviço**, nunca no serializer nem no frontend.
- **Série do gráfico de evolução de hábitos (AD-11 / FR-2.10):** **derivada on-read** a partir de `habit_day_entries` (já materializadas por AD-06/07) + o stream de eventos de `habit_versions` para anotações. **Sem série materializada separada** no MVP (coerente com AD-14: views históricas sem NFR formal).

### 6.9 Enforcement

**Todos os agentes de IA DEVEM:**
1. Filtrar por tenant **sempre** via manager auto-escopado (`Model.objects`); `all_objects` só no caminho de admin explícito. Contexto vazio = `TenantScopeViolation`, nunca query global (§6.7).
2. Colocar regra de negócio na **camada de serviço** com a assinatura fixa (`*, user, ...`); transação no serviço; nunca em views, signals ou frontend.
3. Respeitar o casing: `snake_case` no Python/DB, `camelCase` na borda, **chaves JSONB dinâmicas intactas**.
4. Usar a query-key factory `[escopo, entidade, ...]` e a paginação/filtros nativos do DRF — nada de chaves/contratos inventados por endpoint.
5. Levantar só exceções de `core/exceptions.py` a partir de serviços; respeitar o mapa exceção→status.
6. Usar `today_for()` como única fonte de "hoje"; materializar só via método de service idempotente.
7. Escrever teste com `pytest` + `factory_boy` cobrindo isolamento de tenant (incl. o teste fail-closed) e transições de estado.

**Anti-padrões (proibidos):**
- `Model.all_objects` ou query sem escopo fora do caminho de admin; interpretar contexto vazio como "todos".
- Lógica de transição de status no serializer ou no frontend.
- Converter chaves dinâmicas de JSONB para camelCase.
- Envelope custom de resposta; `fields` como string em vez de array.
- Chave do TanStack Query inline; mutação otimista artesanal; interceptor de refresh sem single-flight.
- `date.today()`/`timezone.now()` cru; materialização via signal; ENUM nativo do Postgres; PK sequencial.

### 6.10 Reference Implementations (alinham agentes por exemplo)

_Trechos canônicos — a forma é normativa; nomes de domínio são ilustrativos._

**Serviço (assinatura + transação + exceção de domínio):**
```python
# bujo/services.py
@transaction.atomic
def transition_task(*, user, task_id, to_status) -> Task:
    task = Task.objects.get(id=task_id)            # objects = auto-escopado por user
    if to_status not in ALLOWED[task.status]:
        raise InvalidTransition(task.status, to_status)   # core.exceptions → 409
    task.status = to_status
    task.save(update_fields=["status"])
    return task
```

**Serializer com JSONB opaco (exceção do camelCase):**
```python
# health/serializers.py
class HealthLogSerializer(serializers.ModelSerializer):
    # 'values' devolvido como dict opaco — chaves NÃO convertidas em nenhuma direção
    values = serializers.JSONField()   # + config de ignore no camel-case renderer/parser
    class Meta:
        model = HealthLog
        fields = ["id", "date", "values"]
```

**Contexto de tenant (fail-closed) + manager:**
```python
# core/tenant.py
current_user_id = contextvars.ContextVar("current_user_id", default=None)

@contextmanager
def tenant_context(user):
    token = current_user_id.set(user.id)
    try:
        yield
    finally:
        current_user_id.reset(token)

class TenantManager(models.Manager):
    def get_queryset(self):
        uid = current_user_id.get()
        if uid is None:
            raise TenantScopeViolation()       # fail-closed → 500 + alerta
        return super().get_queryset().filter(user_id=uid)
```

**Fixture pytest e teste fail-closed:**
```python
# conftest.py
@pytest.fixture
def auth_client(user, api_client):
    with tenant_context(user):
        yield api_client

# core/tests/test_isolation.py
def test_query_sem_contexto_explode(db):
    with pytest.raises(TenantScopeViolation):
        Habit.objects.all()
```

**Query-key factory + mutação otimista:**
```typescript
// src/api/keys.ts
export const keys = {
  brainDump: { count: (userId: string) => ['brainDump', 'count', userId] as const },
  habits:    { logs:  (date: string)   => ['habits', 'logs', 'list', { date }] as const },
};
// mutações invalidam por prefixo: queryClient.invalidateQueries({ queryKey: ['habits', 'logs'] })

// src/shared/useOptimisticMutation.ts  (esqueleto)
// onMutate:  cancelQueries(key) → snapshot = getQueryData(key) → setQueryData(otimista)
// onError:   setQueryData(key, snapshot)            // rollback
// onSettled: invalidateQueries(key)
```

**Interceptor Axios single-flight:**
```typescript
// src/api/client.ts (esqueleto)
let refreshing: Promise<string> | null = null;
// no 401: se !refreshing → refreshing = doRefresh().finally(() => refreshing = null)
//         await refreshing → retry da request 1x
// 401 no doRefresh → logout(): localStorage.clear() + queryClient.clear()
// window.addEventListener('storage', syncTokenBetweenTabs)
```

---

## 7. Estrutura do Projeto & Fronteiras

_Materializa as convenções da Seção 6 numa árvore concreta. Monorepo (`backend/` + `frontend/`); dev/prod isolados via branches do Neon (sem Docker). Refinada em party-mode (Amelia, Winston, Sally): a estrutura serve domínios isolados; os pontos cross-domínio (calendário, composição de tela) ganharam lugar próprio._

### 7.1 Árvore do Projeto (monorepo)

```
hmmb-bujo/
├── README.md
├── docs/                            # documentação viva
├── .github/workflows/ci.yml         # lint + testes + guardrail de tenant + import-linter (regra de porta do core)
├── backend/
│   ├── manage.py
│   ├── pyproject.toml               # deps + ruff + pytest + config do import-linter (§7.2)
│   ├── uv.lock
│   ├── conftest.py                  # fixtures globais + fixture parametrizada de isolamento (§7.4)
│   ├── .env.example                 # .env.dev → Neon branch dev | .env.prod → Neon main
│   ├── config/
│   │   ├── settings/{base,dev,prod}.py   # split via django-environ (§6.2)
│   │   ├── urls.py                  # router raiz /api/ + schema drf-spectacular
│   │   ├── wsgi.py  asgi.py
│   ├── core/                        # CROSS-CUTTING — regra de porta dura: NÃO importa nenhum app de domínio (§7.2)
│   │   ├── models.py                # TenantModel abstrata: id=UUID, user_id, objects(TenantManager), all_objects
│   │   ├── tenant.py                # contextvar, tenant_context(), TenantManager (§6.7/6.10)
│   │   ├── middleware.py            # seta contextvar pós-auth JWT, reset no finally (§6.7)
│   │   ├── exceptions.py            # DomainError + subclasses + exception handler (§6.4)
│   │   ├── calendar.py              # today_for/user_today(user), is_workday(user, date) — autoridade do "dia" (§6.8); lê user_holidays de accounts
│   │   ├── pagination.py            # PageNumberPagination default, page_size=50 (§6.3)
│   │   └── tests/{test_isolation,test_calendar}.py
│   ├── accounts/                    # FR-0 (auth, JWT) + FR-6 (gestão de usuários, pós-MVP)
│   │   └── models/{user,profile,holidays}.py   # pacote: User, perfil (timezone), user_holidays (AD-10)
│   ├── bujo/                        # FR-1 — dono da ENTIDADE Daily Log (não "container do dia"; o dia é eixo de consulta)
│   │   ├── models.py                # task (árvore auto-ref AD-08, linhagem AD-03), logs
│   │   └── services/{state_machine,migration,catchup}.py   # catchup importa migration (AD-09 é tasks-only)
│   ├── habits/                      # FR-2 (+ FR-2.10): habit_versions, habit_day_entries
│   ├── health/                      # FR-3 métricas genéricas (JSONB): health_field_definitions, health_logs
│   │   └── models/                  # pacote (definições + logs JSONB)
│   ├── medications/                 # FR-3.4–3.7: dono do rastreio de medicação (AD-07: doctors, time_blocks, medications, medication_substance_versions, medication_schedule_versions, medication_day_entries) — sem FK p/ health
│   ├── gratitude/                   # FR-4
│   └── braindump/                   # FR-5 (Fase 1b)
│       ├── models.py  serializers.py  services.py  views.py  urls.py  admin.py
│       ├── migrations/              # nomeadas (§6.1), uma por story
│       └── tests/{factories,test_models,test_serializers,test_services,test_views}.py
└── frontend/
    ├── package.json  vite.config.ts  tsconfig.json  index.html
    ├── eslint.config.js              # flat config; regra de boundary: features não se importam (§7.2)
    ├── .env.development  .env.production
    ├── public/
    └── src/
        ├── main.tsx
        ├── theme.ts                 # tema MUI central (§6.2)
        ├── api/
        │   ├── client.ts            # Axios + interceptor refresh single-flight (§6.5/6.10)
        │   ├── keys.ts              # query-key factory + keys.daily(date) compõe chaves de domínios (§6.5)
        │   ├── queryClient.ts       # TanStack QueryClient (refetchOnWindowFocus on)
        │   └── types.gen.ts         # tipos gerados de drf-spectacular — fonte única (§6.2)
        ├── app/                     # COMPOSIÇÃO COM DONO (chrome + navegação + providers)
        │   ├── router.tsx           # mapa de jornadas/rotas
        │   ├── layout/AppLayout.tsx # app bar, bottom-nav e o FAB de captura (dispara modal do braindump)
        │   └── providers/           # QueryClientProvider, ThemeProvider, AuthProvider (auth state/contexto)
        ├── pages/                   # COMPOSIÇÃO DE TELA — único lugar que importa MÚLTIPLAS features
        │   └── daily/
        │       ├── DailyPage.tsx    # orquestra bujo + habits do dia; gratitude via link contextual "Gratidão de ontem" (Épico 9 D7); medications vive em /health/medications (Épico 8 D5) — nenhum dos dois é montado aqui
        │       └── useDailyData.ts  # prefetch PARALELO das query keys do dia (NFR-2); /daily/:date agregado reservado se <2s falhar
        ├── shared/                  # PRIMITIVOS SEM DONO
        │   ├── components/          # ErrorBoundary global, Snackbar/Alert padrão (§6.4)
        │   └── hooks/useOptimisticMutation.ts   # wrapper canônico (§6.5/6.10)
        └── features/                # CAMARINS isolados — nunca importam outra feature
            ├── auth/ bujo/ habits/ health/ medications/ gratitude/ braindump/ users/
            └── <feature>/
                ├── index.ts         # BARREL público: só api + hooks + types (o que pages/ pode consumir)
                ├── api.ts           # hooks useQuery/useMutation (usam keys.ts)
                ├── components/  hooks/  types.ts
```

### 7.2 Fronteiras Arquiteturais

- **Fronteira de API:** tudo sob `/api/` (DRF router). Schema OpenAPI por `drf-spectacular` é o **contrato único** e gera `frontend/src/api/types.gen.ts`. camelCase na borda (§6.3).
- **Fronteira de autenticação/tenant:** JWT autentica; `core/middleware.py` seta o `contextvar`; o `TenantManager` é a fronteira de isolamento (§6.7).
- **Fronteira de regra de negócio:** `services.py`/`services/` de cada app. `view → serializer → service (regra + transação) → model`.
- **Autoridade do "dia" (resolve risco de ciclo):** a **noção temporal** de dia (timezone, `user_today`, `is_workday`, meia-noite) é cross-cutting e vive em `core/calendar.py` — todos importam `core`, ninguém importa ninguém. A **entidade Daily Log** (página do dia no método BuJo) é de `bujo`. Os demais apps dependem de uma **data**, nunca de um agregado de `bujo` → grafo acíclico. `user_holidays` pertencem ao perfil (`accounts`), lidos por `core/calendar`.
- **Regra de porta do `core` (executável):** `core` **não pode importar nenhum app de domínio**; entra em `core` só o que é (1) mecânica de infra, não regra de produto, e (2) usado de fato por ≥2 apps. Imposto por **import-linter** no CI (não é convenção verbal).
- **`medications` × `health`:** `medications` é dono **completo** do rastreio de medicação (catálogo + blocos + logs, AD-07); `health` cobre só métricas genéricas definidas pelo usuário (JSONB, AD-01). **Sem FK entre eles.**
- **Orquestração cross-domínio (backend):** migração + catch-up vivem em `bujo/services/` (AD-09 é **tasks-only** → não cruza domínios). *Seam reservado:* se o catch-up um dia generalizar para hábitos/saúde, extrair para um app `rollover/` + protocolo em `core/protocols.py` — **não construído no MVP**.
- **Fronteira de componentes (frontend) — imposta por ESLint:** `features/<x>/` nunca importa outra feature; expõe só seu **barrel `index.ts`** (api + hooks + types). **`pages/` e `app/` são os únicos que compõem múltiplas features.** Estado compartilhado flui pelo cache do TanStack Query, não por props. `shared/` = primitivos sem dono; `app/` = composição com dono (layout, rotas, providers — incl. AuthProvider); `features/auth/` = telas de login/signup.

### 7.3 Pontos de Integração & Fluxo de Dados

- **Contrato back↔front:** `drf-spectacular` (schema) → `types.gen.ts` via **passo de CI versionado** (não geração manual ad-hoc) — o "contrato único" não envelhece.
- **Leitura:** componente → `useQuery` (chave da factory) → Axios → `/api/...` → view → `TenantManager` (escopo) → DB (Neon).
- **Escrita:** componente → `useMutation`/`useOptimisticMutation` → Axios → view → serializer → service (`@transaction.atomic`) → DB; resposta invalida a chave por prefixo.
- **Daily Log (tela crítica, NFR-2):** `pages/daily/useDailyData.ts` dispara **prefetch paralelo** das query keys de `bujo`/`habits` no load da rota (sem prop-drilling; cada widget lê seu dado do cache). *Medications ficou em `/health/medications` (Épico 8 D5) e gratitude entra por link contextual "Gratidão de ontem" no `/today` (Épico 9 D7) — nenhum dos dois foi integrado ao prefetch do dia (latitude AD-14; o slot em `useDailyData` fica reservado).* Se o <2s não se sustentar, endpoint agregado `/api/daily/{date}/` que hidrata o cache de várias features de uma vez — **reservado, não no MVP** (coerente com AD-14).
- **Externos:** Neon (Postgres gerenciado, branch por ambiente) e Railway (deploy). Sem outras integrações no MVP solo; Sentry/Better Stack entram no gate multiusuário do Épico 10.

### 7.4 Configuração, Build, Testes & Deploy

- **Config:** `django-environ` lê `.env.dev`/`.env.prod` (cada um aponta para sua branch do Neon — FR-0). **CORS e base-URL da API configuráveis por env desde o dia 1** (não fechar a porta de servir o frontend via CDN vs Django).
- **Build:** backend sem build; frontend `vite build` → estáticos. Geração de `types.gen.ts` é passo de CI.
- **Testes:** `core/tests/test_isolation.py` testa o `TenantManager` genérico (incl. fail-closed); o isolamento por-app é validado por uma **fixture parametrizada compartilhada** no `conftest.py` (não copy-paste de `test_isolation.py` por app). `factory_boy` por app; toda factory tenant declara `user = SubFactory(UserFactory)`.
- **CI (`.github/workflows/ci.yml`):** `ruff` + `pytest` (backend) + **import-linter** (regra de porta do `core`) + guardrail de tenant (AD-12) + diff de `types.gen.ts`; `tsc` + ESLint (incl. regra de boundary de features) + `vite build` (frontend). **Decisão de escopo (Story 1.1, revisitada e mantida na Story 2.4):** Vitest **não** roda no CI — os testes de frontend (incl. regressão de acessibilidade via `jest-axe`) são a rede de segurança do desenvolvedor local e do code-review, não um gate de pipeline.
- **Deploy:** Railway como alvo definido; estrutura preserva disciplina 12-factor/env. Migrations no release; frontend como estáticos/CDN. Branch Neon por ambiente; nada assume estado de banco no boot.

---

## 8. Validação da Arquitetura

_Verificação de coerência, cobertura de requisitos e prontidão para implementação por agentes de IA._

### 8.1 Validação de Coerência ✅

- **Compatibilidade de decisões:** stack consistente (Django+DRF+Neon+React/Vite+MUI+TanStack). Sem versões conflitantes. A escolha de **não usar RLS** (AD-12) é coerente com o isolamento na camada de aplicação — a menção a RLS na Seção 1 é descritiva da capacidade do Neon, não uma decisão contrária.
- **Consistência de padrões:** os padrões da Seção 6 sustentam as ADs — camelCase/JSONB (AD-01), service layer + transações (AD-02/03), fail-closed (AD-12), `today_for` (AD-04), materialização idempotente (AD-06/07). Nenhuma regra contradiz outra.
- **Alinhamento estrutural:** a Seção 7 realiza os padrões — `core` com regra de porta (acíclico), apps por domínio, `bujo` dono da entidade Daily Log, camada `app/`+`pages/` para composição. Fronteiras impostas por CI (import-linter, ESLint, guardrail de tenant).

### 8.2 Cobertura de Requisitos ✅

**Requisitos Funcionais (FR-0 a FR-6):**

| FR | Suporte arquitetural |
|---|---|
| FR-0 Fundação | AD-12 (multi-tenant), §6.5 (auth JWT), §7.4 (dev/prod via Neon branch) |
| FR-1 Motor BuJo | AD-02 (máquina de estados), AD-03 (linhagem), AD-04/05 (tempo/calendário), AD-08 (recorrentes/subtarefas), AD-09 (catch-up) |
| FR-2 Hábitos (+FR-2.10) | AD-01, AD-06 (snapshot), AD-10 (pesos por tipo de dia), AD-11 (gráfico/anotações) |
| FR-3 Saúde & Medicamentos | AD-01 (JSONB saúde), AD-07 (medicamentos) |
| FR-4 Gratidão | Estruturalmente em `gratitude` (texto livre, trivial — sem ponto de conflito arquitetural) |
| FR-5 Brain Dump | AD-13 (badge/server state), AD-15 (Fase 1b) |
| FR-6 Gestão de Usuários (pós-MVP) | Pré-condição satisfeita por AD-12; `accounts` estende quando entrar |

**Requisitos Não-Funcionais:**

| NFR | Status | Onde |
|---|---|---|
| NFR-1 mobile sem scroll horizontal | ✅ no nível arquitetural | Casca mobile (`app/layout`, FAB, bottom-nav); detalhe responsivo é da UX spec |
| NFR-2 <2s Daily Log + migrações | ✅ | AD-14 (escopo), §7.3 (prefetch paralelo; `/daily/:date` agregado reservado) |
| NFR-3 isolamento total | ✅ (mais forte) | AD-12, §6.7 fail-closed, `test_isolation`, import-linter + guardrail |
| NFR-4 imutabilidade sistêmica | ✅ | AD-06/07 (config prospectiva, sem retroação), §6.8 |
| NFR-5 dev/prod separados | ✅ | §7.4 (branch Neon por ambiente, settings split) |
| NFR-6 uptime 99% (6h–23h) | ⚠️ parcial | Deploy em Railway já definido; depende de monitoramento externo/canal de alerta + SLA do Neon — ver Gap I-1 |

### 8.3 Prontidão para Implementação ✅

- **Decisões completas:** 15 ADs + padrões + estrutura, refinados em duas rodadas de party-mode. Versões exatas serão fixadas no scaffold via lockfiles (`uv.lock`, `package-lock`); TanStack Query v5 já explícito.
- **Estrutura completa:** árvore concreta (§7.1) com arquivos/diretórios específicos, mapeamento FR→app, e os pontos cross-domínio (calendário, composição) com lugar próprio.
- **Padrões completos:** pontos de conflito entre agentes endereçados (§6), com Reference Implementations (§6.10) que alinham por exemplo, não só por regra.

### 8.4 Análise de Lacunas

**Críticas (bloqueiam implementação):** nenhuma.

**Importantes (não bloqueiam o MVP solo; endereçar antes de multiusuário):**
- **I-1 — Deploy & Observabilidade (NFR-6):** alvo de deploy já resolvido em Railway no curso da implementação; estratégia de uptime, monitoramento e **canal de alerta** ainda precisa ser fechada antes de convidar usuários externos. Para o MVP solo, disponibilidade é best-effort; o NFR-6 formal só é verificável após monitoramento externo.
- **I-2 — Estratégia de logging:** §6.4 define que erro técnico vai para log, mas não fixava stack/formato/níveis de logging estruturado. Decisão deferida para a primeira story do Épico 10, antes de multiusuário: logs estruturados JSON no backend, Railway como fonte primária de runtime logs, Sentry para error tracking e Better Stack para uptime/alertas.

**Decisão deferida — Observabilidade mínima para multiusuário (AR-21/AR-22):**
- **Gatilho:** não bloqueia o MVP de uso solo; bloqueia convites/onboarding de usuários externos no Épico 10.
- **Backend logging:** JSON logs em stdout via `python-json-logger` ou `structlog`; escolher `python-json-logger` se a implementação precisar apenas de formatter JSON simples, ou `structlog` se a story justificar eventos estruturados mais ricos.
- **Campos mínimos:** `timestamp`, `level`, `event`, `logger`, `request_id`, `method`, `path`, `status_code`, `duration_ms` e `user_id` quando aplicável. `user_id` deve ser apenas o UUID interno opaco, nunca email, nome ou conteúdo de payload.
- **Error tracking:** `sentry-sdk[django]` para exceções não tratadas e erros críticos do backend, com ambiente e release/versão quando disponíveis.
- **Runtime logs:** Railway permanece o sink primário dos logs de execução.
- **Healthcheck:** endpoint público sem autenticação em `/health/`, retornando `200` e corpo mínimo quando app e dependências essenciais responderem dentro do timeout configurado; falha retorna status não-2xx para o monitor.
- **Uptime/alertas:** Better Stack monitora `/health/` e dispara alerta para indisponibilidade conforme I-1/NFR-6. O canal mínimo é email para Hugo; outro canal (Telegram/Slack/Discord) pode substituir se for o canal realmente monitorado.
- **Dados proibidos:** tokens, cookies, senhas, headers sensíveis e conteúdo privado do journal nunca devem ser registrados em logs ou eventos externos.
- **Fora do escopo inicial:** dashboards avançados, tracing distribuído, Prometheus/Grafana, alertas complexos por regra de negócio, auditoria de ações de usuário e Sentry frontend (`@sentry/react`), salvo story futura específica para erros de UI.

**Menores (refinamentos):**
- **M-1 — Pinagem de versões:** a Seção 2 lista tecnologias sem major versions; recomenda-se cravar (Django 5.x, React 18/19, MUI 6, Node LTS, Python 3.12+) na Stack ou nos lockfiles do scaffold.
- **M-2 — NFR-1 responsivo:** especificidades de layout sem scroll horizontal pertencem à UX spec (apropriadamente diferido).

### 8.5 Checklist de Completude

**Requirements Analysis**
- [x] Contexto do projeto analisado a fundo
- [x] Escala e complexidade avaliadas
- [x] Restrições técnicas identificadas
- [x] Cross-cutting concerns mapeados

**Architectural Decisions**
- [x] Decisões críticas documentadas (versões fixadas no scaffold via lockfiles)
- [x] Stack tecnológica especificada
- [x] Padrões de integração definidos
- [x] Performance endereçada (AD-14, §7.3)

**Implementation Patterns**
- [x] Convenções de nomenclatura estabelecidas
- [x] Padrões de estrutura definidos
- [x] Padrões de comunicação especificados
- [x] Padrões de processo documentados (erros, loading, validação)

**Project Structure**
- [x] Estrutura de diretórios completa
- [x] Fronteiras de componentes estabelecidas
- [x] Pontos de integração mapeados
- [x] Mapeamento requisitos→estrutura completo

### 8.6 Avaliação de Prontidão

**Status Geral:** **READY FOR IMPLEMENTATION** (16/16 itens marcados; nenhuma lacuna crítica em aberto).

**Nível de Confiança:** **Alto** — profundidade de 15 ADs + 10 subseções de padrões + estrutura concreta, com pontos de conflito caçados adversarialmente em party-mode.

**Pontos Fortes:**
- Isolamento multi-tenant fail-closed, testado e imposto por CI (NFR-3).
- Rigor temporal e de snapshot (AD-04/06/07) com `today_for` como autoridade única.
- Regras de consistência com Reference Implementations — alinham agentes por exemplo.
- Grafo de módulos acíclico (autoridade do "dia" em `core`, Daily Log em `bujo`).
- Fidelidade à semântica do método BuJo (linhagem, migração, fricção intencional).

**Áreas para Evolução Futura:**
- Observabilidade mínima antes de multiusuário (Épico 10.0): uptime + canal de alerta (I-1) e logging/error tracking estruturado (I-2).
- Endpoint agregado `/daily/:date` se o NFR-2 não se sustentar com prefetch paralelo (AD-14).
- View materializada se queries analíticas ficarem perceptíveis (AD-01).
- Pinagem de versões major (M-1).

### 8.7 Handoff de Implementação

**Diretrizes para agentes de IA:**
- Seguir as ADs e os padrões da Seção 6 exatamente; respeitar as fronteiras da Seção 7.
- Consultar este documento para toda dúvida arquitetural; nunca divergir das Reference Implementations.

**Primeira prioridade de implementação (FR-0 é fundação de tudo):**
1. Scaffold do monorepo (`backend/` + `frontend/`).
2. `backend/core/` primeiro: `TenantModel` (UUID PK), `tenant.py` (contextvar + manager fail-closed), `exceptions.py` (+ handler), `calendar.py` (`today_for`), `middleware.py`, `pagination.py` — com `test_isolation` e o import-linter no CI desde o commit inicial.
3. `accounts` (User UUID + auth JWT + `user_holidays`).
4. Frontend base: `api/client.ts` (interceptor single-flight), `keys.ts`, `app/` (providers + layout + router).
5. A partir daí, **Fase 1 (Daily Log / Motor BuJo)** e **Fase 1b (Brain Dump)**, conforme roadmap do PRD.
