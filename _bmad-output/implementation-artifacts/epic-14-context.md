# Epic 14 Context: Onda 3 — Núcleo BuJo no Sistema Novo (gate vertical)

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Levar o núcleo do método Bullet Journal — Weekly Board, Monthly Board, Future Log, Migração/Catch-Up (unificada) e a biblioteca de Recorrentes, mais o Arquivo — para o sistema de design novo, incorporando ao mesmo tempo os deltas de domínio que os spines de UX (M06–M10) aprovaram: ciclos de vida explícitos de Weekly/Monthly, fila única de migração e decisões-snapshot de ritual. É o **gate vertical** do roadmap de migração: caminho crítico, com critério de saída = épico inteiro concluído, não stories isoladas. As regras do método (migração manual, seis estados, linhagem, placement manual) permanecem intocadas — os deltas mudam a forma de persistência, nunca a disciplina do usuário.

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

## Requirements & Constraints

- Paridade completa com o motor BuJo existente: quatro logs (Daily/Weekly/Monthly/Future), tarefa com título/descrição/subtarefas/Eisenhower, seis estados (pendente/iniciada/concluída/cancelada/migrada/adiada), ordenação manual, migração diária/semanal/mensal sempre por decisão explícita (sem auto-placement), recorrentes com placement manual, arquivo consultável.
- Herança de status na migração: o sucessor herda `started` da origem em vez de resetar para `pending`; só tarefas `pending`/`started` são migráveis; `migrated`/`postponed` são terminais — regra já existente, reaproveitada (não duplicada) pelas novas superfícies.
- Premissa blindada: o Daily legado (e seus banners de migração/catch-up) permanece plenamente utilizável até o Épico 17 entrar — nenhum contrato hoje consumido por ele pode mudar.
- Endpoints legados de migração/catch-up viram **aliases finos** sobre o serviço unificado até serem removidos no Épico 18.
- Mockups dos spines M06–M10 já estão aprovados/promovidos; a story 14.0 cobre só o que falta (padrão Arquivo readonly) — em conflito entre mockup novo e spine, o spine vence.
- Todo mockup/superfície cobre os estados obrigatórios (loading/empty/error/offline/parcial-por-fonte) e o estado "collection desligada/ausente".

## Technical Decisions

- Estado do ciclo vive em colunas nos próprios `WeeklyLog`/`MonthlyLog` (`status`: `planning|active|finalized`; `NULL` = fora do regime operacional) + `planning_completed_at` (timestamp, não booleano) — sem tabela satélite. `UniqueConstraint` parcial garante no máx. um `active` e um `planning` por usuário/tipo; corrida vira `CycleTargetConflict` (novo `DomainError`, 409, distinto de `InvalidTransition`).
- Transições só por service idempotente e atômico: **Iniciar** exige `today_for(user) ≥` alvo + planejamento concluído + ciclo anterior finalizado; **Finalizar** é irreversível; **Concluir planejamento** é não bloqueante. Os `get_or_create_*_log` existentes nunca atribuem estado — entrar no regime é sempre ato de ritual. Meses pulados materializam sequencialmente, um por vez (janela mensal via `core/calendar.py`).
- Data migration retroativa (bootstrap): fechados → `finalized`; corrente → `active` (materializado se ausente); futuros e ciclos passados não-fechados → `NULL` (essa população alimenta a fila unificada).
- Decisões-snapshot: tabela `ritual_decisions`, só para decisões que **não** mutam o item (`keep`/`skip_week`/`keep_undated`); decisões mutantes (migrar/alocar/concluir/cancelar) não geram registro paralelo — a mutação já é a persistência.
- Fila unificada é **derivada por query, sem schema novo** (`unified_migration_queue` em `bujo/services/migration.py`), seções mês→semana→dia; endpoint `GET /api/migration/unified-queue/`; herança de status/`waiting_on` reusa a função de regra já existente (Épico 12, sem duplicação).
- Aliases finos: `MigrationQueueView`/`CatchUpQueueView` projetam a resposta do service unificado nos contratos atuais (mesmas rotas/serializers); testes de caracterização travam o contrato.
- API de ciclo é um endpoint de ação por tipo (`POST /api/bujo/logs/weekly|monthly/cycle/`, campo `action`); GETs de log ganham `status`/`planningCompletedAt` aditivos; `is_cycle_closed` é autoridade só **dentro** do regime — fora dele a derivação legada permanece intacta.
- A **Task Row base do sistema novo nasce na 14.5**, com anatomia canônica completa e desenhada para reuso — o Épico 17 só a especializa, sem refatorar.

## UX & Interaction Patterns

- Task Row/detalhe é padrão transversal a toda superfície da onda: categoria = borda 3px, status + Eisenhower (U/I) à esquerda, ordem/drag à direita; footer Salvar/Mover/Cancelar/Excluir conforme mutabilidade; seta de linhagem navega ao sucessor sem abrir o detalhe; `Enter`/`Ctrl+Enter` com semântica fixa de salvar.
- Weekly Board: multi-faixa (Seg–Qua / Qui–Dom compacto) + pool "Sem dia definido"; fontes em ordem fixa (Monthly na semana → Monthly ampliado opcional → Recorrentes → Weekly anterior [única bloqueante] → Daily pendentes); teclado `1`–`7`/`0`+`Enter` no seletor de destino; densidade conta só materializados; sem toast redundante.
- Monthly Board: calendário seg→dom completo com Task Rows nas células (sem "+N"); fontes (Recorrentes → Future Log → Monthly anterior [única bloqueante]); seletor combina calendário + entrada direta (valida 28–31 dias); anual só resolve com destino no ano-alvo (dezembro = só o mês-alvo).
- Future Log: trilho fixo dos 8 meses seguintes (vazios visíveis, com contagem) + coluna de foco; "Ir para mês…" só lista meses distantes com itens; datar/mover usa o seletor padrão; concluir/cancelar não existem aqui.
- Recorrentes (`/planner/recurring`): abas Semanal/Mensal/Anual + filtro "Mostrar inativos"; criar/editar no mesmo card de detalhe de tarefa; footer Salvar/Ativar-Desativar/Excluir (soft delete só na edição); termo padrão do ato é **"Alocar"**.
- Migração/Catch-Up: entrada única = faixa discreta no Hoje; reusa o padrão rail-de-fontes/lista/rail-de-contexto do shell (não é dialog nem tela cheia); ações **Migrar para hoje** / **Escolher destino…** / **Cancelar** (sem "Concluir"); pausar/retomar não perde decisões; resumo factual ao final.
- Arquivo: filtros→lista→detalhe readonly; "Fechado"/"Somente leitura" textuais (nunca aparência disabled); linhagem preserva filtro/posição.
- Todas as superfícies exigem estados obrigatórios (loading/empty/error/offline/parcial-por-fonte) e axe-core em wide/medium/compact; offline desabilita decisões com motivo, sem fila local.

## Cross-Story Dependencies

- Ordem interna é domínio-primeiro: 14.1 (ciclos de vida), 14.2 (fontes/decisões-snapshot) e 14.3 (fila unificada) são backend puro, maturando sob a UI legada, antes das stories de superfície (14.5–14.10).
- 14.4 (soft delete de templates) é pré-requisito do footer "Excluir" da 14.8 (Recorrentes).
- 14.3 (fila unificada) é pré-requisito direto da 14.9 (ritual de Migração/Catch-Up no shell).
- 14.5 cria a Task Row base do sistema novo, reutilizada por todas as demais stories da onda e, depois, pelo Épico 17 (que só a especializa).
- Depende do Épico 13 (shell/tokens `--ds-*`) para toda superfície de UI.
- Aliases finos (14.3) mantêm o Daily legado e seus banners intactos até o Épico 17 assumir a superfície; remoção definitiva só no Épico 18.
