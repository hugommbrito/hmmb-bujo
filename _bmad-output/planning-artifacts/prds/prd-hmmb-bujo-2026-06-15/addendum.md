---
title: "BuJo Digital — PRD Addendum"
status: draft
created: 2026-06-15
updated: 2026-06-15
---

# Addendum: BuJo Digital PRD

Contexto técnico e decisões de arquitetura que emergem dos requisitos mas pertencem ao documento de arquitetura, não ao PRD.

---

## Modelo de Dados — Campos Dinâmicos

FR-3.1 (métricas de saúde dinâmicas) e FR-2 (hábitos dinâmicos) exigem que o sistema suporte campos criados pelo usuário em runtime, com tipos variados. Padrões arquiteturais a considerar:

- **EAV (Entity-Attribute-Value):** flexível, mas penaliza queries analíticas
- **JSONB (PostgreSQL):** boa performance de leitura, suporte a indexação parcial
- **Tabelas de definição + tabelas de valor:** mais verboso, mas tipagem forte por coluna

A decisão do padrão cabe à fase de arquitetura. O PRD exige que a solução suporte: criação de campos em runtime, múltiplos tipos (inteiro, decimal, booleano, enum, texto), histórico imutável por dia, e queries de evolução temporal por campo.

---

## Medicines — Entidade Separada de Health

Medicamentos (FR-3.4) não são campos dinâmicos de saúde — são uma entidade própria com lógica de agendamento e confirmação por bloco de horário. Apesar de exibidos junto às métricas de saúde na interface, o modelo de dados os trata de forma independente.

Implicações para arquitetura:
- Tabela própria para medicamentos e blocos de horário
- Log de confirmação diária por medicamento × bloco
- Um medicamento pode ter doses diferentes em blocos diferentes do mesmo dia

---

## Multi-Tenant — Isolamento por Usuário

A premissa "single user" do planejamento técnico original está revogada (D18 do decision log do brief). Toda tabela do sistema deve ter isolamento por usuário desde o início.

A UI de gestão de usuários (convites, onboarding) é fase posterior (FR-6), mas o schema e as políticas de isolamento são pré-condição para qualquer dado (FR-0).

Supabase Auth suporta multi-tenant nativamente. As políticas de isolamento de dados devem ser implementadas no banco — não apenas na camada de aplicação.

---

## Hábitos — Modelo de Dados (Revisão)

O modelo original do planejamento técnico (`completed: Boolean` em `HabitLog`) é insuficiente para os requisitos do PRD (FR-2). O modelo correto deve suportar:

- Definição dinâmica de hábito com tipo, peso e bonus
- Registro de valor por dia (não apenas booleano — numérico quando aplicável)
- Snapshot imutável de hábitos ativos + pesos por dia
- Evolução temporal de pesos (peso varia ao longo do tempo)

---

## Recorrentes — Placement Manual

A recorrência de tarefas (FR-1.11) usa texto livre para descrever o padrão (ex: "segunda e quarta", "dia 15 de cada mês"). O sistema não faz parsing desse campo — ele é apenas descritivo para o usuário. O placement de recorrentes é sempre manual: o app apresenta a lista de recorrentes ativos do período e o usuário decide onde cada um entra (FR-1.12).

Isso simplifica a implementação e preserva o princípio do método: o juízo de onde uma tarefa recorrente entra numa semana específica permanece com o usuário.
