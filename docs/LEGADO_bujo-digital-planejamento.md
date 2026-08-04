# Ignorar este arquivo pois ele foi substituído pelo briefing e prd

# BuJo Digital — Planejamento de Projeto

> **Status:** Planejamento em andamento
> **Última atualização:** 25/05/2026
> **Fase atual:** Definição de escopo e arquitetura — pré-implementação
> **Próxima ação:** Discutir arquitetura/stack → detalhar HealthLog → criar prompt ClaudeDesign → iniciar MVP
> **Decisões pendentes:** Revisão de arquitetura/stack, campos de saúde do Notion, prompt para ClaudeDesign

## Visão do Produto

Aplicação web pessoal que replica e otimiza o sistema de Bullet Journal analógico do Hugo, consolidando caderno físico e Notion em uma plataforma única. O app preserva os princípios de intencionalidade e reflexão do método Carroll enquanto elimina o trabalho repetitivo de setup, transcrição e manutenção de estruturas.

**Princípio de design:** o atrito deve existir onde gera reflexão (priorização, migração, gratidões), e ser eliminado onde é apenas mecânico (recorrentes, cabeçalhos, gráficos, hábitos).

---

## Arquitetura Técnica

### Stack Recomendada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Familiaridade do Hugo, SSR para Kindle, API routes integradas |
| UI | **React + Tailwind CSS** | Produtividade, responsividade nativa, theming com CSS variables |
| Banco de Dados | **PostgreSQL (Supabase)** | Tier gratuito generoso, auth integrada, API REST automática, backups |
| ORM | **Prisma** | Type-safety, migrations, integração natural com Next.js |
| Hospedagem | **Vercel** | Deploy zero-config para Next.js, tier gratuito, edge functions |
| Autenticação | **Supabase Auth** | Single user com login por email/senha, sem complexidade multi-tenant |
| Gráficos | **Recharts** | React-nativo, responsivo, customizável |
| Kindle View | **Rota Next.js com CSS otimizado para e-ink** | HTML estático, alto contraste, sem animações |

### Estimativa de Custo Mensal

- **Vercel (Hobby):** gratuito
- **Supabase (Free Tier):** gratuito (500MB DB, 1GB storage, 50k requests/mês)
- **Domínio (opcional):** ~R$40/ano

**Custo estimado: R$0–3/mês** no tier gratuito, escalável se necessário.

### Arquitetura Simplificada

```
┌─────────────────────────────────────────────┐
│                 Next.js App                  │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Desktop  │ │  Mobile  │ │ Kindle View  │ │
│  │  (main)  │ │(respons.)│ │  (e-ink opt) │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       └─────────────┼──────────────┘         │
│                     │                        │
│            ┌────────▼────────┐               │
│            │   API Routes    │               │
│            │  (Next.js API)  │               │
│            └────────┬────────┘               │
│                     │                        │
│            ┌────────▼────────┐               │
│            │     Prisma      │               │
│            └────────┬────────┘               │
└─────────────────────┼───────────────────────┘
                      │
              ┌───────▼───────┐
              │   Supabase    │
              │  PostgreSQL   │
              │  + Auth       │
              │  + Storage    │
              └───────────────┘
```

---

## Modelo de Dados

### Entidades Principais

#### `Task` — Tarefa
```
id              UUID
title           String
status          Enum: TODO | DOING | DONE | MIGRATED | POSTPONED | CANCELLED
priority        Enum: URGENT_IMPORTANT | URGENT | IMPORTANT | NEITHER
order           Int? (nullable — posição na fila de execução do dia)
period          Enum?: MORNING | AFTERNOON | NIGHT (horário planejado)
source          Enum: MANUAL | RECURRING (origem da tarefa)
recurring_id    FK? → RecurringTask (se gerada por recorrente)
target_date     Date (dia em que deve ser feita)
original_date   Date? (data original, se foi migrada)
week_id         FK → Week
month_id        FK → Month
notes           Text?
created_at      DateTime
updated_at      DateTime
```

#### `RecurringTask` — Tarefa Recorrente
```
id              UUID
title           String
frequency       Enum: YEARLY | QUARTERLY | MONTHLY | WEEKLY | DAILY
day_of_week     Enum?: MON | TUE | WED | THU | FRI | SAT | SUN
day_of_month    Int? (1-31)
month           Int? (1-12)
priority        Enum: URGENT_IMPORTANT | URGENT | IMPORTANT | NEITHER
is_active       Boolean
notes           Text?
created_at      DateTime
```

#### `Week` — Semana
```
id              UUID
week_number     Int (1-53)
year            Int
start_date      Date
end_date        Date
month_id        FK → Month
created_at      DateTime
```

#### `Day` — Dia
```
id              UUID
date            Date (unique)
week_id         FK → Week
productivity_morning    Int? (0-10)
productivity_afternoon  Int? (0-10)
productivity_night      Enum: Int? | NA
fasting_first_meal      Time? (hora da primeira refeição)
fasting_last_meal       Time? (hora da última refeição)
fasting_predicted_break Time? (hora prevista para quebrar jejum)
notes           Text?
created_at      DateTime
```

#### `Month` — Mês
```
id              UUID
month           Int (1-12)
year            Int
important_dates JSON? (datas importantes do mês)
created_at      DateTime
```

#### `FutureLogEntry` — Entrada no Log Futuro
```
id              UUID
title           String
target_month    Int (1-12)
target_year     Int
target_day      Int? (nullable, para entradas sem data específica)
is_migrated     Boolean
migrated_to     FK? → Task
created_at      DateTime
```

#### `Habit` — Hábito (definição)
```
id              UUID
name            String
order           Int (posição na lista)
is_active       Boolean
created_at      DateTime
```

#### `HabitLog` — Registro de Hábito
```
id              UUID
habit_id        FK → Habit
date            Date
completed       Boolean
created_at      DateTime
```

#### `HealthLog` — Registro de Saúde (diário)
```
id              UUID
date            Date (unique)
weight          Decimal? (kg)
body_fat_pct    Decimal? (%)
steps           Int?
sleep_quality   Int? (escala a definir)
medications     JSON? (lista de medicamentos tomados)
diet_notes      Text?
created_at      DateTime
```

#### `BodyMeasurement` — Medidas Corporais (quinzenal)
```
id              UUID
date            Date
waist           Decimal? (cm)
abdomen         Decimal? (cm)
chest           Decimal? (cm)
arms            Decimal? (cm)
thighs          Decimal? (cm)
photos          JSON? (array de URLs no Supabase Storage)
notes           Text?
created_at      DateTime
```

#### `Gratitude` — Gratidão
```
id              UUID
date            Date
entry_number    Int (número sequencial dentro do dia/mês)
content         Text
created_at      DateTime
```

#### `WeightGoal` — Meta de Peso
```
id              UUID
target_weight   Decimal
target_date     Date?
set_date        Date
is_active       Boolean
created_at      DateTime
```

---

## Módulos e Telas

### M1. Dashboard Diário ⭐ (tela principal)

**Propósito:** substitui o spread semanal aberto na mesa. É a primeira coisa que Hugo vê ao abrir o app.

**Conteúdo:**
- **Cabeçalho:** data atual, dia da semana, número da semana
- **Produtividade:** campos para manhã/tarde/noite (0-10 ou NA)
- **Jejum:** primeira refeição | previsão de quebra | última refeição
- **Tarefas do dia:** lista ordenável por drag-and-drop, com:
  - Cor lateral (Eisenhower)
  - Número de ordem (auto-incrementado via posição no drag)
  - Bullet de status (clicável para alterar: todo → doing → done → migrated)
  - Ação de migrar (abre seletor de data destino)
- **Hábitos do dia:** checklist dos hábitos ativos (Tous les Jours)
- **Gratidão do dia:** campo de texto
- **Métricas de saúde:** peso, % gordura, passos (campos compactos)
- **Tarefas concluídas (colapsável):** tarefas já finalizadas, fora do caminho

**Interação chave:** ao abrir na segunda-feira, o sistema:
1. Auto-gera tarefas recorrentes da semana
2. Migra automaticamente tarefas não concluídas da semana anterior (com flag visual "migrada")
3. Solicita confirmação: "Estas X tarefas foram migradas. Alguma delas perdeu relevância?"

Essa confirmação preserva o atrito intencional do Carroll — o app pergunta, Hugo decide.

---

### M2. Visão Semanal

**Propósito:** substitui o spread semanal do caderno.

**Conteúdo:**
- 7 colunas (Seg-Dom), cada uma mostrando:
  - Tarefas do dia com cor/status
  - Nota de produtividade (3 períodos)
  - Janela de jejum
  - Progresso dos hábitos (barra ou fração: 8/12)
- Resumo lateral ou superior:
  - Tarefas pendentes da semana
  - Tarefas para "Próx. Semana" (área de staging)
  - Contadores: feitas / migradas / canceladas

---

### M3. Visão Mensal (Monthly Log)

**Propósito:** substitui a Agenda Mensal.

**Conteúdo:**
- Calendário visual do mês (com indicadores de dias que têm tarefas)
- Lista de datas importantes
- Resumo mensal: total de tarefas, taxa de conclusão, métricas médias
- Gatilho de migração mensal: ao virar o mês, apresenta tarefas pendentes do mês anterior para decisão

---

### M4. Future Log

**Propósito:** visão panorâmica dos próximos meses/anos.

**Conteúdo:**
- Grid de meses com entradas por bullet
- Ao iniciar um novo mês, sugere migrar entradas do Future Log para o Monthly Log
- Suporte a múltiplos anos (2026, 2027...)

---

### M5. Recorrentes (Motor de Automação)

**Propósito:** substitui as 3 páginas de recorrentes (Ano, Mês, Semana) e o cartão Tous les Jours.

**Funcionamento:**
- CRUD de tarefas recorrentes com frequência (diária, semanal, mensal, trimestral, anual)
- No início de cada dia/semana/mês, o motor gera automaticamente as instâncias de tarefas
- Cada instância gerada herda prioridade e atributos do template, mas pode ser editada individualmente
- Interface de gestão para ativar/desativar/editar templates

**Isso elimina:** a cópia manual diária/semanal/mensal das recorrentes — o maior gargalo de tempo identificado.

---

### M6. Hábitos (Tous les Jours)

**Propósito:** substitui o cartão impresso + tabela do Notion.

**Conteúdo:**
- Lista de hábitos com toggle diário
- Visualização semanal em grid (como o cartão atual)
- Streak tracking (sequência de dias consecutivos)
- Indicador de conclusão no Dashboard (8/12 hábitos feitos)

---

### M7. Saúde e Corpo

**Propósito:** consolida peso, gordura, medidas e fotos.

**Conteúdo:**
- Input diário: peso + % gordura
- Input quinzenal: medidas corporais + upload de fotos
- Gráficos de evolução (substituem os gráficos desenhados à mão)
- Meta de peso ativa com linha de referência no gráfico
- Comparativo de fotos lado-a-lado

---

### M8. Gratidões

**Propósito:** diário de gratidão com capacidade de revisitação.

**Conteúdo:**
- Input diário (campo de texto)
- Timeline navegável por mês
- Funcionalidade "Revisitar": botão que exibe uma gratidão aleatória do passado (ou do mesmo dia em meses anteriores)
- Busca por texto

---

### M9. Analytics Dashboard

**Propósito:** análises que hoje Hugo faz manualmente exportando do Notion.

**Conteúdo:**
- **Produtividade:** média semanal/mensal, tendência, correlação com sono/jejum/exercício
- **Hábitos:** taxa de adesão por hábito, tendência, streaks
- **Saúde:** evolução de peso/gordura, projeção de meta, correlações
- **Tarefas:** taxa de conclusão vs migração vs cancelamento, distribuição por quadrante Eisenhower
- **Jejum:** janelas médias, aderência ao protocolo
- Filtros por período (semana, mês, trimestre, ano)

---

### M10. Kindle View

**Propósito:** tela estática otimizada para e-ink, para deixar no Kindle sobre a mesa.

**Características:**
- Rota dedicada: `/kindle` ou `/eink`
- CSS otimizado: alto contraste, sem gradientes, sem animações, fontes grandes
- Conteúdo: tarefas do dia ordenadas + hábitos pendentes + próximo compromisso
- Auto-refresh suave (meta refresh a cada X minutos, ou manual)
- Layout pensado para tela do Kindle 3ª geração (600×800px, escala de cinza)

---

## Fases de Entrega

### Fase 1 — MVP Funcional
**Objetivo:** substituir o caderno para o fluxo diário/semanal.

| Módulo | Escopo |
|---|---|
| Auth | Login simples (email/senha) |
| Dashboard Diário (M1) | Tarefas, hábitos, produtividade, jejum, gratidão, saúde básica |
| Recorrentes (M5) | CRUD + motor de geração automática |
| Hábitos (M6) | Checklist diário + grid semanal |
| Visão Semanal (M2) | 7 colunas com resumo |

**Entregável:** app funcional que cobre o fluxo diário de segunda a domingo.

---

### Fase 2 — Ciclo Mensal e Futuro
**Objetivo:** cobrir o planejamento de médio/longo prazo.

| Módulo | Escopo |
|---|---|
| Visão Mensal (M3) | Calendário + datas importantes + migração mensal |
| Future Log (M4) | Grid multi-mês com migração |
| Saúde (M7) | Gráficos de peso/gordura, medidas, fotos |
| Gratidões (M8) | Timeline + revisitação + busca |

---

### Fase 3 — Inteligência e Extras
**Objetivo:** análises e experiências diferenciadas.

| Módulo | Escopo |
|---|---|
| Analytics (M9) | Dashboard com correlações e tendências |
| Kindle View (M10) | Rota e-ink otimizada |
| Migração Notion | Import de dados históricos (24 meses) |
| PWA / Offline | Service worker para uso sem internet |

---

## Fluxos Críticos de UX

### Fluxo 1: Início do Dia (diário)
```
1. Hugo abre o app
2. Dashboard mostra o dia atual
3. Recorrentes do dia já estão listadas (geradas automaticamente)
4. Hugo adiciona tarefas manuais se necessário
5. Hugo reordena por drag-and-drop (números se auto-atribuem)
6. Ao longo do dia: marca hábitos, registra peso, altera status de tarefas
7. No fim do dia: preenche produtividade e gratidão
```

### Fluxo 2: Início da Semana (segunda-feira)
```
1. Hugo abre o app na segunda
2. Sistema apresenta tarefas não concluídas da semana anterior
3. Para cada tarefa pendente: Migrar | Cancelar | Manter na semana anterior
4. ← ESTE É O ATRITO INTENCIONAL PRESERVADO
5. Recorrentes da semana são geradas
6. Hugo organiza o dia normalmente (Fluxo 1)
```

### Fluxo 3: Início do Mês
```
1. Na primeira segunda do mês, além do Fluxo 2:
2. Sistema apresenta resumo do mês anterior (taxa de conclusão, métricas)
3. Migração mensal: tarefas pendentes do mês anterior
4. Future Log: entradas agendadas para este mês são sugeridas para migração
5. Recorrentes mensais e anuais (se aplicável) são geradas
```

### Fluxo Kindle
```
1. Hugo configura o Kindle para abrir /kindle em tela cheia
2. Página mostra: tarefas do dia em ordem, hábitos pendentes
3. Atualização manual (recarregar página) ou auto-refresh configurable
```

---

## Decisões de Design — Resolvidas

| # | Decisão | Resolução |
|---|---|---|
| 1 | Tema visual | **Dashboard moderno** — cards limpos, tipografia sans-serif, hierarquia por densidade |
| 2 | Gratidão | **Múltiplas entradas por dia** |
| 3 | Integração com calendários | **Backlog** — Hugo já usa iCalendar da Apple para consolidar Google + Outlook |
| 4 | Notificações | **Backlog** — não descartar, mas fora do MVP |
| 5 | Escala de produtividade | **Manter 0-10 + NA** (ver tabela de significados abaixo) |
| 6 | Campos do HealthLog | **Pendente** — Hugo detalhará após planejamento dos módulos de logs |

### Escala de Produtividade — Significados

| Nota | Significado |
|---|---|
| 0 | Só procrastinei e não fiz nada |
| 2–4 | Produtividade horrível, travei e não consegui avançar |
| 5–6 | Produtividade abaixo do esperado/planejado |
| 7–8 | Produzi como esperava/planejava |
| 9–10 | Produtividade acima da planejada/esperada |
| NA | Não me propus a ser produtivo |

---

## Próximos Passos

1. **Discutir decisões de arquitetura/stack** — Hugo quer revisar antes de dar o planejamento por concluído
2. **Hugo detalha campos do HealthLog** — formato exato de cada parâmetro rastreado no Notion (sono, remédios, alimentação, etc.)
3. **Criar prompt otimizado para ClaudeDesign** — para modelagem de UI das telas do app
4. Finalizar modelo de dados com os campos de saúde
5. Iniciar implementação da Fase 1 (MVP):
   - Setup do projeto (Next.js + Prisma + Supabase)
   - Modelo de dados e migrations
   - Dashboard Diário (tema moderno)
   - Motor de Recorrentes
   - Hábitos (Tous les Jours)
   - Visão Semanal

---

## Changelog

| Data | O que foi decidido |
|---|---|
| 25/05/2026 | Sessão inicial de planejamento. Análise completa do BuJo analógico (PDF 21 páginas). Mapeamento de todos os elementos: Index, Legendas (bullets expandidos + Eisenhower + horários), Recorrentes (ano/mês/semana), Future Log, Monthly Log, Weekly Log (layer operacional), cabeçalho azul (produtividade 3 períodos + jejum), habit tracker (Tous les Jours), peso/gordura, gratidões. |
| 25/05/2026 | Definição de arquitetura: Next.js + Prisma + Supabase + Vercel. Modelo de dados inicial com 11 entidades. 10 módulos planejados em 3 fases. |
| 25/05/2026 | Decisões: tema moderno (dashboard), gratidões múltiplas/dia, escala 0-10+NA com significados, calendários no backlog, notificações no backlog. |
| 25/05/2026 | Pendente: detalhamento dos campos de HealthLog, discussão de arquitetura/stack, prompt para ClaudeDesign. |

