# Story 14.0 — Auditoria de cobertura do Núcleo BuJo

Data: 2026-07-24
Modo: `bmad-ux` coaching, human-in-the-loop
Autoridade: `DESIGN.md` + `EXPERIENCE.md` promovidos; mocks ilustram e nunca vencem os spines.

## Dependência e fronteira

- O Épico 13 permanece upstream: a Story 13.4 está `ready-for-dev`.
- Esta execução prepara e aprova UX; não libera implementação fora da ordem mestre.
- Nenhum arquivo de runtime é alvo desta story.
- M06–M10 só reabrem diante de conflito funcional comprovado.

## Matriz M06–M10

| Spine | Mock promovido | Evidência revisada | Lacuna comprovada | Decisão |
|---|---|---|---|---|
| M06 — Weekly | `mockups/key-weekly.html` | Board em múltiplas faixas, pool **Sem dia definido**, dia único no compact, rails de planejamento, densidade, falha parcial, estados terminal/linhagem | Nenhuma | Cobertura suficiente; sem frame novo |
| M07 — Monthly | `mockups/key-monthly.html` | Calendário seg→dom, células vazias, overflow interno, alternativa compacta completa, pool **Sem dia definido**, planejamento e densidade | Nenhuma | Cobertura suficiente; sem frame novo |
| M08 — Future Log | `mockups/key-future-log.html` | Horizonte de oito meses, meses vazios presentes, **Ir para mês…**, datear/mover com linhagem, ausência de concluir/cancelar | Nenhuma | Cobertura suficiente; sem frame novo |
| M09 — Recorrentes | `mockups/key-recorrentes.html` | Item Row sem status, ato **Alocar** por referência aos rituais, inativo distinto de excluído, soft delete e detalhe compartilhado | Nenhuma | Cobertura suficiente; sem frame novo |
| M10 — Migração/Catch-Up | `mockups/key-migracao.html` | Ritual no workspace, fontes mês→semana→dia, decisões individuais, retomada, falha parcial e resumo factual | Nenhuma | Cobertura suficiente; sem frame novo |

## Inventário do Arquivo atual

| Área | Comportamento atual | Lacuna contra os spines |
|---|---|---|
| `/archive` | Skeleton, vazio inicial textual e lista simples de semanas/meses; links preservam tipos e chaves temporais | Sem filtros/período, empty por filtro, erro/retry, offline explícito ou estrutura mestre-detalhe |
| `/archive/weekly/:weekStart` | Reusa `WeeklyPage`; mantém navegação temporal, dias e pool sem dia | Fechado remove criação e recorrentes, mas também impede abrir o detalhe |
| `/archive/monthly/:monthFirst` | Reusa `MonthlyPage`; mantém navegação temporal, agrupamento por data e sem data | Fechado remove criação e recorrentes, mas também impede abrir o detalhe |
| `TaskRow` | Callbacks opcionais produzem readonly parcial | **Mover tarefa** ainda aparece sem depender de permissão; concluída usa `text.disabled`; migrated não navega ao sucessor |
| Rotas/shell | Deep links semanais e mensais existem; shell novo marca a superfície como ainda não migrada | A futura Story 14.10 deve migrar a superfície sem alterar as chaves das rotas |
| Índice backend | Retorna somente `type`, `week_start` e `month_first`, ordenados do mais recente | Mock não pode presumir busca, agregados, paginação ou novos metadados |
| Fechamento backend | Derivado por conteúdo e ausência de `pending`/`started`, incluindo subtarefas | É inventário legado; AD-28 moverá autoridade para `status = finalized` |

## Lacuna visual confirmada

Produzir somente `key-archive.html`, cobrindo:

1. seleção/filtros de período;
2. lista de semanas e meses finalizados;
3. detalhe readonly com Task Row e painel de detalhe canônicos;
4. `Fechado` e `Somente leitura` textuais;
5. loading, empty inicial, empty por filtro, erro/retry, offline e readonly;
6. navegação origem→sucessor e retorno preservando filtros, período, posição e foco;
7. wide, medium, tablet e compact, incluindo reflow em 320 CSS px;
8. shell sem collections como ausência real, mantendo Arquivo e Planner-base.

## Restrições de dados

- Não inventar endpoint, schema, paginação, busca, exportação, agregação ou regra de finalização.
- Filtros apresentados pelo mock precisam ser deriváveis de `type` e das chaves temporais já existentes, salvo decisão upstream explícita.
- O detalhe continua carregando o log semanal ou mensal pela rota/query correspondente.
