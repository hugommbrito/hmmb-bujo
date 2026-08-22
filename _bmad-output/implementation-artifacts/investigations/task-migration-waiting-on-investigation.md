# Investigação: erro 500 ao migrar tarefa com `waiting_on` nulo

## Hand-off Brief

1. **O que aconteceu.** Confirmado: em produção, a migração de uma tarefa falhou ao inserir uma nova linha em `tasks` porque `waiting_on` recebeu `NULL`, contrariando a restrição `NOT NULL` do banco.
2. **Onde o caso está.** Ativo; o erro está ancorado no caminho `migrate_task` → `_migrate_subtree` → `create_task`, mas ainda é necessário comparar model, migrations e histórico recente.
3. **Próximo passo necessário.** Mapear o perímetro de evidências no repositório para identificar por que código e schema de produção divergiram.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-07-25 |
| Status | Active |
| System | Produção; Django/Python 3.13.14; PostgreSQL via psycopg |
| Evidence sources | Log de deploy anexado; código-fonte e histórico Git ainda não mapeados |

## Problem Statement

Relato do usuário: “o ambiente de produção, que funcionava normalmente, parou de funcionar para algumas requests. Ao solicitar uma migração recebo um erro 500”.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Log de produção anexado | Available | Janela observada em 2026-07-26 00:34 UTC; contém acessos HTTP e traceback |
| Código-fonte local | Partial | Frames indicam arquivos e funções, ainda sem inspeção contextual |
| Histórico Git | Missing | Necessário para reconstruir quando a divergência surgiu |
| Schema/migrations | Missing | Necessário comparar nulabilidade esperada com produção |
| Estado/configuração do deploy | Missing | Necessário confirmar revisão implantada e migrations aplicadas |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Comparar `Task.waiting_on` no model, migrations e criação da tarefa | High | Open | Determina a divergência código/schema |
| 2 | Inspecionar o fluxo de migração e seus testes | High | Open | Explica por que apenas algumas tarefas falham |
| 3 | Examinar histórico Git recente das áreas afetadas | High | Open | Pode identificar mudança causal |
| 4 | Confirmar revisão e migrations do deploy de produção | Medium | Open | Evidência externa ainda indisponível |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-07-26 00:34:24 UTC | `GET /api/bujo/migration/queue/` respondeu 200 | Log anexado | Confirmed |
| 2026-07-26 00:34:29 UTC | Migração de tarefa gerou erro interno | Log anexado | Confirmed |
| 2026-07-26 00:34:29 UTC | PostgreSQL recusou linha com `waiting_on = NULL` | Log anexado | Confirmed |

## Confirmed Findings

### Finding 1: falha é uma violação de integridade na criação da tarefa migrada

**Evidence:** log anexado, timestamp `2026-07-26T00:34:29Z`; `psycopg.errors.NotNullViolation`.

**Detail:** A coluna `waiting_on` da relação `tasks` rejeitou `NULL`. O traceback atravessa `/app/bujo/views.py:529`, `/app/bujo/services/migration.py:105`, `/app/bujo/services/migration.py:37` e `/app/bujo/services/tasks.py:48`.

### Finding 2: a API e a leitura da fila de migração estavam operacionais

**Evidence:** log anexado, `GET /api/bujo/migration/queue/` retornou HTTP 200 às `00:34:24 UTC`.

**Detail:** O incidente afeta o comando de migração/insert, não toda a API nem a consulta da fila.

## Deduced Conclusions

### Deduction 1: o erro depende dos dados/caminho de criação

**Based on:** Findings 1 e 2.

**Reasoning:** Leituras funcionam; a falha surge somente quando `create_task` persiste uma linha cujo valor de `waiting_on` é nulo.

**Conclusion:** “Algumas requests” falham porque o caminho afetado produz um valor que o schema atual de produção não aceita.

## Hypothesized Paths

### Hypothesis 1: há divergência entre o model/código implantado e o schema do banco

**Status:** Open

**Theory:** O código passou a admitir/omitir `waiting_on`, enquanto a coluna de produção continua `NOT NULL`, possivelmente por migration não aplicada, ausente ou incorreta.

**Supporting indicators:** O insert contém `NULL`, mas o PostgreSQL mantém uma restrição explícita.

**Would confirm:** Model com `null=True` ou criação sem valor default, acompanhado de migration que remove `NOT NULL` e não está efetiva em produção.

**Would refute:** Model e última migration ainda exigindo valor não nulo, com o fluxo de migração sendo o único produtor incorreto.

**Resolution:** Pendente.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Model e migrations locais | Distingue bug de código de migration não aplicada | Inspeção do repositório |
| Revisão implantada e saída de `showmigrations` | Confirma estado real da produção | Consultar ambiente de deploy |
| Casos que migram com sucesso | Isola a condição exata nos dados | Comparar payloads/tarefas |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | `/app/bujo/services/tasks.py:48`, `create_task` |
| Trigger | POST em `/api/bujo/tasks/{uuid}/migrate/` |
| Condition | Tentativa de inserir `tasks.waiting_on = NULL` sob constraint `NOT NULL` |
| Related files | `/app/bujo/views.py`, `/app/bujo/services/migration.py`, `/app/core/models.py` |

## Conclusion

**Confidence:** Medium

Está confirmado que o 500 é causado por `waiting_on = NULL` durante a criação da tarefa migrada. A causa da divergência — migration ausente em produção ou produtor de dados incorreto — ainda depende da inspeção do código, migrations e histórico.

## Recommended Next Steps

### Fix direction

Pendente do mapeamento de evidências.

### Diagnostic

Comparar model, cadeia de migrations, fluxo `migrate_task`/`create_task` e revisão implantada.

## Reproduction Plan

Migrar localmente uma tarefa equivalente à UUID do log sob um banco com o mesmo schema de produção e observar o insert de `waiting_on`.

## Side Findings

- O traceback anexado apresenta algumas linhas intercaladas/fora de ordem, provavelmente por agregação concorrente do log, mas a cadeia causal do `NotNullViolation` permanece inequívoca.

## Follow-up: 2026-07-25

### New Evidence

- O usuário informou que alterou manualmente a tarefa de `migrated` para `pending` antes de solicitar a migração.
- A migration `backend/bujo/migrations/0006_task_waiting_on.py:13` adiciona `waiting_on` como booleano não nulo, com default apenas no estado do model/migration.
- O código atual declara `Task.waiting_on = models.BooleanField(default=False)` em `backend/bujo/models.py:207`.
- O commit `781a77365a71c10ba3b88b587f61b4d4664a9021` introduziu simultaneamente o campo no model, a migration e a herança na migração.
- O PostgreSQL registrou um insert com `waiting_on = NULL`. Com o model atual, uma nova instância recebe `False`; portanto, o processo que realizou o insert não estava operando com o estado atual do model.

### Additional Findings

#### Confirmado: alteração manual foi gatilho, não causa do `NULL`

Mudar `migrated` para `pending` tornou a tarefa elegível para o endpoint de migração e disparou a criação de um sucessor. Porém, o valor nulo decorre de incompatibilidade entre o código carregado pelo processo e o schema já migrado.

#### Confirmado: produção tinha código e schema incompatíveis

O banco já possuía a coluna `waiting_on NOT NULL`, mas o processo responsável pelo request omitiu o campo no insert. Isso é compatível com uma instância antiga da aplicação executando após a migration `0006`, inclusive durante rollout parcial ou deploy que aplicou migrations sem substituir/reiniciar corretamente todos os processos.

#### Deduzido: outras operações de criação também podem falhar

Qualquer endpoint atendido pela instância antiga que tente criar uma `Task` pode produzir o mesmo erro. As leituras continuam funcionando, explicando a aparência de falha apenas em algumas requests.

#### Risco de integridade da alteração manual

Uma tarefa originalmente `migrated` normalmente conserva `migrated_to_task` e `migration_count`. Alterar apenas `status` para `pending` cria um estado incoerente e, após corrigido o deploy, uma nova migração pode gerar outro sucessor/duplicata.

### Updated Hypotheses

#### Hypothesis 1: há divergência entre o model/código implantado e o schema do banco

**Status:** Confirmed

**Resolution:** O banco rejeitou `waiting_on = NULL`, enquanto o model no commit que criou a coluna aplica `False` a toda nova instância. Logo, o processo que realizou o insert não carregava o model compatível com o schema.

### Backlog Changes

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Comparar `Task.waiting_on` no model, migrations e criação | High | Done | Divergência confirmada |
| 2 | Verificar revisão e processos ativos no deploy | High | Open | Confirmar por que uma instância antiga permaneceu ativa |
| 3 | Auditar a tarefa alterada manualmente | High | Open | Verificar `migrated_to_task`, `migration_count` e sucessor existente |

### Updated Conclusion

**Confidence:** High

A edição manual de `migrated` para `pending` fez a tarefa voltar ao fluxo de migração e, portanto, expôs o problema. A causa técnica do erro 500 é um processo de aplicação incompatível com o schema: o banco já exige `waiting_on`, mas a instância que executou o insert não fornece o campo. Além disso, a edição isolada do status provavelmente deixou a linhagem da tarefa inconsistente e deve ser revertida ou reparada considerando também `migrated_to_task` e `migration_count`.
