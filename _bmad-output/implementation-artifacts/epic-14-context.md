# Epic 14 Context: Onda 3 — Núcleo BuJo no Sistema Novo (gate vertical)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Levar o núcleo do método BuJo (planejamento semanal/mensal, Future Log, Migração/Catch-Up unificada, Recorrentes e Arquivo) para o sistema de design novo, com os deltas de domínio aprovados nos spines M06–M10 como stories próprias. É o gate vertical do roadmap: caminho crítico, saída = épico inteiro concluído. As regras do método (migração manual, seis estados, linhagem, placement manual) ficam intactas.

## Stories

- Story 14.0: [UX] Mockups complementares do Núcleo BuJo (gate do épico)
- Story 14.1: Ciclos de vida de Weekly e Monthly (backend)
- Story 14.2: Fontes dos rituais e decisões-snapshot (backend)
- Story 14.3: Fila unificada de migração + aliases finos (backend)
- Story 14.4: Soft delete de templates recorrentes (backend)
- Story 14.5: Weekly Board e planejamento semanal no sistema novo (M06)
- Story 14.6: Monthly Board e planejamento mensal no sistema novo (M07)
- Story 14.7: Future Log no sistema novo (M08)
- Story 14.8: Recorrentes no sistema novo (M09)
- Story 14.9: Migração/Catch-Up como ritual no shell (M10)
- Story 14.10: Arquivo no sistema novo
- Story 14.11: Regularização atrasada do ciclo mensal — destravar e explicar

## Requirements & Constraints

- Paridade com o motor BuJo: quatro logs, seis estados, ordenação manual, migração sempre por decisão explícita (sem auto-placement), recorrentes com placement manual, arquivo readonly. Sucessor herda status e `waiting_on`; só `pending`/`started` migram; `migrated`/`postponed` são terminais.
- Premissa blindada: Daily legado e banners seguem utilizáveis até o Épico 17 (nenhum contrato que ele consome muda); endpoints legados de migração/catch-up são aliases finos até o Épico 18. Spines vencem mockups; toda superfície cobre loading/empty/error/offline.

## Technical Decisions

- Ciclo em colunas do próprio log (`status`: `planning|active|finalized`, `NULL` = fora do regime; `planning_completed_at` timestamp). No máx. um `active` e um `planning` por tipo (corrida → 409 `CycleTargetConflict`). Transições só por service idempotente/atômico; materialização nunca atribui estado; `NULL→active` é proibido.
- Bootstrap (data migration): fechados → `finalized`; corrente → `active` (materializado se ausente); futuros e passados não-fechados → `NULL` — essa população alimenta a fila unificada.
- API de ciclo: `POST /api/bujo/logs/weekly|monthly/cycle/` com `action`; GETs de log ganham `status`/`planningCompletedAt` aditivos; `is_cycle_closed` é autoridade só **dentro** do regime (fora dele a derivação legada permanece).
- **Alvo mensal determinístico:** "Planejar próximo mês" mira sempre o mês seguinte ao `active` — sem escolha, retargeting ou cancelar alvo. Se já existe `planning`, ele é o alvo; sem `active`, o mês corrente. Meses pulados materializam um por vez (planejar → concluir → iniciar → finalizar), sem lote nem fechamento automático; o produto informa quantos faltam (faixa "Regularização atrasada", 14.11).
- **Gates de Iniciar (cumulativos):** data do usuário ≥ chave-alvo; planejamento concluído; ciclo operacional anterior (logs `NULL` são ignorados) `finalized` — sem anterior, passa por vacuidade.
- **Gates de Finalizar (irreversível):** zero `pending`/`started` em toda a subárvore, subtarefas incluídas (pai com filho aberto não fecha); e próximo ciclo já em `planning` — Weekly: qualquer semana posterior; Monthly: exatamente o mês seguinte.
- **409 de gate explicável (14.11):** cada gate de iniciar/finalizar levanta `InvalidTransition` com `detail` pt-BR e `code` = chave do gate da readiness (`previous_finalized`, `no_open_tasks`, …); readiness obsoleta → `state_changed`/`not_planning`. O handler central emite `code` só quando presente.
- **Fonte bloqueante ≡ gate:** "Monthly anterior"/"Weekly anterior" apontam para o mesmo anterior operacional do gate de Iniciar, nunca oferecem "Manter" e listam **cabeças abertas** (`undisposed_heads`: raiz aberta ou subtarefa aberta sob pai disposto, com `parentTitle`), logo `reviewed == readyToFinalize == not has_undisposed` por construção (14.11). A fila unificada usa o mesmo predicado; `undisposed_roots` segue nas fontes não bloqueantes.
- **Migrate (`POST /tasks/{id}/migrate/`):** `today`/`week` → `migrated`; `month` sem `month_first` → mês corrente (servidor), `postponed`; `month` com `month_first` (14.11) → faixa `[min(alvo de planejamento, corrente), corrente]`, meses intermediários inclusos (log `NULL`, próximos alvos da sequência), senão 400; `future` → `month_first` dia 1 **estritamente posterior** ao corrente, senão 400, `postponed`; `cancel` → sem linhagem. Frontend concentra a escolha em `migrateFieldsForMonth` (`> corrente` → `future`, senão `month` + `monthFirst`). Horizonte do Future usa piso `max(active, corrente)`.
- Decisões-snapshot só para decisões não mutantes (`keep`/`skip_week`/`keep_undated`). Fila unificada derivada por query, sem schema, seções mês→semana→dia. Template: exclusão lógica; inativo ≠ excluído.
- Aliases finos (`MigrationQueueView`/`CatchUpQueueView`) projetam o service unificado nos contratos legados até o Épico 18.
- A **Task Row base do sistema novo nasce na 14.5** — o Épico 17 só a especializa, sem refatorar.

## UX & Interaction Patterns

- Task Row/detalhe transversal, com footer conforme mutabilidade e seta de linhagem. Rituais: rail de fontes → decisões → rail de contexto sticky; bloqueante por último; decisões persistem na hora; concluir planejamento não exige zerar avisos; Iniciar via painel ✓/✗ por gate com motivo; Finalizar anterior dentro do ritual atrás de confirmação irreversível.
- Weekly: faixas + pool "Sem dia definido", teclado `1`–`7`/`0`+`Enter`. Monthly: calendário completo, seletor calendário + dia digitado. Future: trilho de 8 meses + "Ir para mês…". Recorrentes: termo "Alocar". Migração: faixa discreta no Hoje, Migrar para hoje / Escolher destino… / Cancelar, pausar/retomar, resumo factual. Offline desabilita decisões com motivo.

## Cross-Story Dependencies

- Domínio-primeiro: 14.1 → 14.2 → 14.3/14.4 sob a UI legada antes de 14.5–14.10. 14.3 → 14.9; 14.4 → 14.8; 14.0 → 14.10; 14.5 cria a Task Row reusada por 14.6–14.10 e pelo Épico 17.
- 14.11 depende de 14.1 (alvo/gates), 14.6 (ritual e readiness) e do contrato de migrate; mantém aliases e Daily legado intactos. Depende do Épico 13 (shell/tokens).
