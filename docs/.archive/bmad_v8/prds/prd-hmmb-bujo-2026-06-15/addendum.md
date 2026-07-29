---
title: "BuJo Digital — PRD Addendum"
status: draft
created: 2026-06-15
updated: 2026-07-22
---

# Addendum: BuJo Digital PRD

Contexto técnico e decisões de arquitetura que emergem dos requisitos mas pertencem ao documento de arquitetura, não ao PRD.

---

## Modelo de Dados — Campos Dinâmicos

FR-8.1 (métricas de saúde dinâmicas) e FR-7 (hábitos dinâmicos) exigem que o sistema suporte campos criados pelo usuário em runtime, com tipos variados. Padrões arquiteturais a considerar:

- **EAV (Entity-Attribute-Value):** flexível, mas penaliza queries analíticas
- **JSONB (PostgreSQL):** boa performance de leitura, suporte a indexação parcial
- **Tabelas de definição + tabelas de valor:** mais verboso, mas tipagem forte por coluna

A decisão do padrão cabe à fase de arquitetura. O PRD exige que a solução suporte: criação de campos em runtime, múltiplos tipos (inteiro, decimal, booleano, enum, texto), histórico imutável por dia, e queries de evolução temporal por campo.

---

## Medicines — Entidade Separada de Health

Medicamentos (FR-9.1) não são campos dinâmicos de saúde — são uma entidade própria com lógica de agendamento e confirmação por bloco de horário. Apesar de exibidos junto às métricas de saúde na interface, o modelo de dados os trata de forma independente.

Implicações para arquitetura:
- Tabela própria para medicamentos e blocos de horário
- Log de confirmação diária por medicamento × bloco
- Um medicamento pode ter doses diferentes em blocos diferentes do mesmo dia

---

## Multi-Tenant — Isolamento por Usuário

A premissa "single user" do planejamento técnico original está revogada (D18 do decision log do brief). Toda tabela do sistema deve ter isolamento por usuário desde o início.

A UI de gestão de usuários (convites, onboarding) é fase posterior (FR-15), mas o schema e as políticas de isolamento são pré-condição para qualquer dado (FR-0).

Supabase Auth suporta multi-tenant nativamente. As políticas de isolamento de dados devem ser implementadas no banco — não apenas na camada de aplicação.

---

## Hábitos — Modelo de Dados (Revisão)

O modelo original do planejamento técnico (`completed: Boolean` em `HabitLog`) é insuficiente para os requisitos do PRD (FR-7). O modelo correto deve suportar:

- Definição dinâmica de hábito com tipo, peso e bonus
- Registro de valor por dia (não apenas booleano — numérico quando aplicável)
- Snapshot imutável de hábitos ativos + pesos por dia
- Evolução temporal de pesos (peso varia ao longo do tempo)

---

## Recorrentes — Placement Manual

A recorrência de tarefas (FR-4.11) usa texto livre para descrever o padrão (ex: "segunda e quarta", "dia 15 de cada mês"). O sistema não faz parsing desse campo — ele é apenas descritivo para o usuário. O placement de recorrentes é sempre manual: o app apresenta a lista de recorrentes ativos do período e o usuário decide onde cada um entra (FR-4.12).

Isso simplifica a implementação e preserva o princípio do método: o juízo de onde uma tarefa recorrente entra numa semana específica permanece com o usuário.

---

# Adendo CC 2026-07-22 — Decisões técnicas dos FRs novos

> Contexto técnico que emerge dos FRs novos (Seção 5, Grupos A–D) e pertence ao documento de **arquitetura**, não ao PRD. Roteado ao rito [ARCH] pelo §9 do `sprint-change-proposal-2026-07-22.md`. Fontes: brainstorming 2026-07-21 (Mergulhos 1–4, Rodada 4) e TR 2026-07-22 (`technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22.md`).

## Infraestrutura de Collections — Manifest/Registry (FR-1)

- Registro **estático de frontend** (ex.: `src/app/collections/registry.ts`): **dados puros, sem hooks/TanStack Query** — para não exigir mocks novos nos 3 testes compartilhados de AppLayout/router/RouteAnnouncer (lição conhecida do projeto). Uma entrada por collection coded: `id`, nome, ícone, rotas lazy, entrada de sidebar (label/grupo/ordem); campos reservados `dashboardCard` e `settingsSchema` sem consumidores na fatia 1.
- **Filhas dinâmicas do container "Custom Collections" (FR-14):** quando C6 for implementado, Sidebar/BottomNav ganham **server state** para esse grupo (as filhas vêm do banco) — tensão com "manifest = dados puros". A fatia 1 permanece segura (o container ainda não existe nela). Registrar na story de C6: os 3 testes compartilhados ganham mocks novos.
- Granularidade da flag de ativação (espaço × usuário) é agnóstica no manifest; decidida no desenho do Épico 10.

## Plataforma de Automação/Captura — C5 (FR-3)

- **Token de automação:** modelo próprio (`AutomationToken`, padrão Home Assistant) — longa duração, escopado aos endpoints de captura/resumo, revogável, **sem refresh** (não é o JWT de sessão; refresh de JWT dentro de atalho é frágil e sem precedente publicado). Gestão inicial via Django admin.
- **Endpoints:** `POST /api/capture` (payload raso `{type, text, value?}`, resposta curta); `GET /api/summary/today` (JSON raso agregado). **Rate limiting (DRF throttling) + logging** desde o início. Ingestão preparada para `source: import` (ponte Apple Health futura do #20) — o mesmo endpoint de medições aceita POST vindo de Shortcuts→Health.
- **iOS/PWA:** sem Web Share Target; deep links de fora abrem no Safari (contexto separado da PWA standalone) → captura por atalho vai **direto na API**, nunca via navegação. Widget "resumo do dia" viável só via **Scriptable** (Keychain para o token; refresh WidgetKit 15–60 min); wrapper nativo (Capacitor/Expo + WidgetKit Swift, US$ 99/ano) **adiado indefinidamente**.

## Análises — DSL, formato e agendamento (FR-13)

- **Segurança (coração do TR):** nunca persistir nem executar SQL gerado por IA (OWASP LLM01+LLM05; ataques P2SQL demonstrados; prompt injection sem equivalente a prepared statements). O **Modelo de Relatório persiste uma spec JSON** `{métricas [do catálogo em código], agregação, período, filtros [range de datas + igualdade/existência]}`, validada por **JSON Schema + allowlist de métricas** e **compilada server-side para QuerySets do ORM** — o backend é o único que toca o banco. Defesa em profundidade: **role Postgres read-only** no caminho de leitura + **`statement_timeout`**; **RLS** quando o app virar multiusuário (Épico 10).
- **Formato da fase b (decidido no TR): texto + gráficos.** O backend computa séries/agregados (determinísticos); o LLM devolve JSON estruturado com blocos ordenados `{tipo: texto|grafico|tabela, ...}` referenciando séries por ID (`serie_ref`) — **não embute dados nem escreve spec Vega completa**; escolhe tipo de gráfico, título e destaques. Frontend renderiza com **Recharts** (sem linguagem de expressão embutida; evita CVEs de XSS do Vega). Structured outputs com JSON Schema estrito.
- **Versionamento/exemplar:** padrão prompt-registry — cada geração grava snapshot **imutável** (`GeracaoRelatorio`: prompt renderizado, versão da spec do DSL, exemplar/versão usado, modelo, `usage`). O exemplar adotado é entidade versionada; trocá-lo cria nova versão do modelo.
- **Fase c (agendada):** **django-q2** (broker no Postgres/ORM — zero infra nova, cron no admin, retries) rodando os Modelos; **Batch API da Anthropic (−50%)** adequada (sem sensibilidade a latência). Controle de custo BYO key: **cap mensal configurável** (tokens×preço via `usage`) + **skip por hash** (SHA-256 do payload agregado + versão do modelo + versão do prompt — não gera se os dados não mudaram). Custo total < US$ 1/mês mesmo no Opus com uso semanal.
- **Índice reverso métrica→modelos:** serviço compartilhado que alimenta o badge "dado lido por IA" (FR-13.8), com **degradação graciosa** (Análises desligada/erro = sem badge; formulário de origem intacto).

## Journalling — âncoras temporais (FR-10)

- Cadência configurável por campo (diário/semanal/livre) exige **três âncoras temporais** no modelo de entrada: **data** (diário), **semana** (semanal) e **timestamp** (livre). Campos semanais/livres precisam de casa própria na navegação e no histórico (o shape do 9.2 é por data/mês — funciona só para diário).

## Alimentação — espelho e fotos (FR-11)

- **Espelho local sincronizado** do foodLog (read-only); Análises filtra/agrega localmente (resiliência de graça). Credenciais no `settingsSchema` da collection.
- **Fotos: copiar × referenciar** é decisão do architect. Espelhar binários custa storage; referenciar URLs do foodLog degrada quando ele cai (dados aparecem, fotos não). Degradação parcial é aceitável. Fotos são exibição, nunca contexto de IA.

## Pressão Arterial — schema e modelo de IA (FR-12)

Derivado de FHIR Observation "Blood Pressure Profile" + Apple HealthKit (correlação atômica) + protocolo AHA/AMA "7-2-2":

```
BPMeasurement: id, session_fk (nullable), systolic int, diastolic int, pulse int?,
               measured_at, arm enum{left,right}?, position enum{sentado,deitado,em_pé}?,
               moment enum{manhã,noite,ad_hoc}?, source enum{photo_ai, manual, import},
               photo FK?, ai_confidence?, ai_raw_response JSON?, notes
               constraints: systolic > diastolic; ranges plausíveis (sis 70–250, dia 40–150, pulso 30–220)
BPSession:     id, started_at, médias calculadas (mean_systolic, mean_diastolic)
Dashboard:     média móvel de 7 dias (a métrica clínica), não a leitura isolada
```

- Par sis/dia **na mesma linha** (nunca registros separados); sessão **opcional** (leitura avulsa permitida); `source` enum **desde a 1ª migration** (acomoda o caminho Bluetooth/import futuro sem retrabalho).
- **Modelo:** Claude **Haiku 4.5** por padrão via BYO key (≈ US$ 0,002/leitura); redimensionar/cropar a foto para ≤ ~1.100 px antes de enviar. Structured output estrito `{systolic, diastolic, pulse: int|null, confidence, legible: bool, notes}` + instrução de recusa (`null` em vez de adivinhar) + descrição do layout do monitor + imagem antes do texto. **Nunca** Gemini free tier.

## Configuração de IA global — BYO key (FR-2)

- Chave única global **criptografada em repouso**; capability derivada `ai_available` (= chave configurada) como estado transversal que gateia Análises, Pressão Arterial foto+IA e o `contexto_ia` do Journalling. Credenciais de integração (foodLog) permanecem no `settingsSchema` da collection — natureza diferente.

## Custom Collections — persistência (FR-14)

- Candidato natural: **schema por collection + registros JSONB** (decisão do architect). **Aninhamento máx. 1 nível** (campo-array de sub-registros; sub-registro não aninha) — fronteira para conter custo de UI/modelo/exibição. Sistema de tipos próprio, independente do Épico 7.
