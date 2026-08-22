---
title: "BuJo Digital — Addendum"
status: draft
created: 2026-06-15
updated: 2026-06-15
---

# Addendum: BuJo Digital

Contexto e decisões que não cabem no brief mas são relevantes para fases posteriores.

---

## Sistema de Campos Dinâmicos — Health, Medicines e Habits

Tanto o módulo de Saúde quanto o de Hábitos devem suportar **campos dinâmicos definidos pelo usuário** — não hardcoded. O usuário pode criar novos campos quando julgar necessário e extinguir campos que deixaram de ser úteis.

Existem três tipos distintos de entidade configurável:

### Health — Métricas de Saúde
Campos criados pelo usuário para rastrear parâmetros de saúde. Cada campo tem um tipo de dado (inteiro, decimal, booleano, enum, texto) e pode ser adicionado ou desativado a qualquer momento.

**Exemplos de campos que hoje existem no Notion:** peso, % gordura, passos, qualidade do sono, entre outros definidos pelo Hugo.

### Medicines — Medicamentos
Entidade separada mas exibida junto às métricas de saúde. Cada medicamento tem:
- Nome e dose
- Horário(s) para tomar
- Variações (ex: doses diferentes em horários diferentes)
- Log de confirmação diária (tomei / não tomei)

**Distinção importante:** Medicines não é um campo de Health — é uma entidade própria com lógica de agendamento e confirmação.

### Habits — Hábitos com Pesos
Hábitos também são dinâmicos (criados e desativados pelo usuário) e têm:
- Tipo de dado configurável (não necessariamente booleano)
- Peso individual que determina importância relativa
- Percentual de completude diário calculado com base nos pesos — não uma contagem simples

**Implicação para o modelo de dados:** o modelo do planejamento original (`completed: Boolean` em `HabitLog`) é insuficiente e está revogado. O modelo de dados precisa ser redesenhado para suportar definições dinâmicas de campo com tipos e pesos.

**Padrão arquitetural a considerar:** EAV (Entity-Attribute-Value), JSONB no PostgreSQL, ou tabelas de definição + tabelas de valor separadas. Decisão para a fase de arquitetura.

---

## Módulo de Relatórios Médicos (backlog)

O tracking de saúde tem origem numa necessidade clínica: trazer dados reais para consultas médicas em vez de suposições. Um módulo de relatórios que estruture e exporte os dados de saúde para comunicação com médicos está no backlog.

**Formato provável:** exportação por período (ex: "últimos 3 meses"), com gráficos de evolução e resumo dos parâmetros principais.

---

## Tracking de Alimentação por Foto (backlog)

Ideia registrada pelo Hugo: usuário tira foto do que está comendo e o sistema rastreia a alimentação. Secundário, mas não deve ser perdido.

**Implicações técnicas:** OCR/visão computacional, Supabase Storage para fotos, possivelmente integração com base de dados nutricional.

---

## Nota de Arquitetura: Multi-Tenant

O planejamento técnico original (`bujo-digital-planejamento.md`) assumia "single user sem complexidade multi-tenant". Essa premissa está **ultrapassada**. A decisão tomada durante o briefing é de arquitetura multi-tenant desde o início.

**Impactos:** modelo de dados com isolamento por usuário/tenant, gestão de usuários, convites, ambientes dev e prod separados. Supabase Auth suporta multi-tenant nativamente — mas o modelo de dados e as policies de RLS precisam ser desenhados para isso.

---

## Decisão: Caderno fecha com ciclo BuJo completo

O critério de abandono do caderno é mais amplo do que "Dashboard Diário". Inclui o ciclo completo: Daily → Weekly → Monthly → Future Log + motor de migrações entre eles. Não basta ter a tela do dia — precisa fechar o loop.
