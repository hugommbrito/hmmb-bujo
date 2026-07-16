# Sprint Change Proposal — 2026-07-15

**Projeto:** hmmb-bujo · **Autor:** HugoMMBrito (via Correct Course) · **Modo:** Incremental
**Escopo classificado:** Moderado (reorganização de backlog + notas de arquitetura/UX)
**Épico afetado:** Épico 11 — Refinamento do Planner & Recorrentes (reaberto)

---

## 1. Resumo do Problema (Issue Summary)

Após o fechamento do 1º lote do Épico 11 (Stories 11.1–11.6, retro concluída em 2026-07-15), o uso revelou um gap conceitual na migração e um conjunto de bugs/melhorias de UI ainda pendentes.

**Gatilho principal (Story 11.6):** a funcionalidade "Mover" entregue pela 11.6 **nunca** leva uma tarefa ao Daily Log de hoje. Ao escolher "hoje", a 11.6 sempre faz um *placement semanal* (`weekly_log` + `scheduled_date`), por decisão deliberada documentada nas Dev Notes e no próprio texto do épico ("hoje ou qualquer dia — o app deduz a semana"). Como o Daily Log (`LogSerializer`) só lê o container `log` (`log_id`), uma tarefa com `scheduled_date=hoje` aparece em "Esta Semana" sob hoje, **mas nunca no Daily Log "Hoje"** — a superfície onde o dia é de fato executado. Isso contraria a premissa do item #9 de `docs/futureIdeas.md` ("antecipar para hoje uma tarefa").

**Gatilho secundário:** logs passados **não-fechados** (com pendências) são inalcançáveis pela navegação — o Arquivo (Story 4.6) lista só ciclos fechados, e não há navegação anterior/próximo. Pendências de um período passado aberto só são expostas pelos rituais de revisão/catch-up.

**Lote adicional (feedback direto do Hugo):** bugs remanescentes (edição de tarefa não persiste — 11.5; modal de placement sem infos — 11.3; "Mover" quebrado em Esta Semana — 11.6), reformulação do seletor de Mover (abas Hoje/Semana/Mês/Futuro, botão explícito "Migrar", mais infos da task, calendário com highlight e clique-preenche-campo) e melhorias de UX/UI nos cards (descrição truncada, hover, espaçamento, semana em 2 linhas).

**Evidência coletada:**
- `backend/bujo/serializers.py:57-59` — `LogSerializer.get_tasks` lê só `obj.tasks` (container `log`).
- `_bmad-output/implementation-artifacts/11-6-...md` (Dev Notes "Por que 'hoje' na nova UI não usa `destination='today'`") — decisão deliberada de placement semanal.
- `epics.md` Story 11.6 AC — "o app deduz a semana a partir da data"; "não há balde de semana sem dia".
- `backend/bujo/views.py:245-301` + `frontend/src/features/bujo/api.ts:185-259` — backend e páginas já servem período arbitrário por `week_start`/`month_first`; navegação para trás e listagem de abertos é o que falta.

---

## 2. Análise de Impacto (Impact Analysis)

- **Épico:** Épico 11 estava `done` (retro concluída). As ACs da 11.6 foram cumpridas **como escritas** — o gap é de spec (a AC resolveu "hoje" como placement semanal), não defeito de dev. Correção via **novas stories**, não rollback. Épico 11 reaberto (`done → in-progress`); retro → `optional` (1ª passada mantida, nova retro cobre 11.7–11.11).
- **Stories:** 5 novas (11.7–11.11). Nenhuma story existente reescrita (11.1–11.6 intactas). A "Hoje → Daily Log" antes planejada foi **absorvida** na 11.10 (mesmo componente).
- **Épicos futuros (5–10):** sem impacto; o 2º lote roda antes do Épico 5, como o 1º.
- **PRD:** sem conflito de meta/MVP — refino dentro de FR-1.7 (migração) e FR-1.13 (consulta de ciclos). Nenhuma edição de PRD necessária.
- **Arquitetura:** novo **AD-16** — "Mover para Hoje" (destino explícito), balde de semana/mês sem dia no seletor, botão explícito (só o seletor Mover; `MigrationCard`/UX-DR3 preservado), navegação de logs passados abertos. **Sem impacto de schema.**
- **UX:** capturada nas ACs das stories (UX-DR vivem no `epics.md`); os controles seguem padrões existentes (dialog da 11.6, prev/next). `DESIGN.md`/`EXPERIENCE.md` sem edição estrutural.
- **Técnico/backend:** único delta de backend previsto é uma leitura de Daily Log por data (Story 11.11); o resto é frontend + reuso de `migrate_task`/`destination='today'` já existentes.

---

## 3. Caminho Recomendado (Recommended Approach)

**Opção 1 — Ajuste Direto (Direct Adjustment): adicionar stories ao Épico 11 reaberto.** Selecionada.

- **Esforço:** Médio · **Risco:** Baixo.
- **Rollback (Opção 2): descartado** — a 11.6 permanece válida ("mover para um dia da semana" segue funcionando); nada a reverter, só a acrescentar.
- **MVP Review (Opção 3): descartado** — MVP não ameaçado; é refino.
- **Justificativa:** backend já tem `destination='today'` e serve períodos arbitrários; o grosso é frontend reaproveitando `TaskDestinationDialog` (11.6) e páginas por rota. Manter tudo no Épico 11 (o épico "lote de refinamentos do `futureIdeas.md`") evita um 2º ciclo de planejamento, permite um único run do story-automator e uma retro final única.

---

## 4. Propostas de Mudança Detalhadas (aplicadas)

| # | Artefato | Mudança |
|---|---|---|
| 1 | `epics.md` (overview Épico 11) | Menciona o 2º lote (reabertura pós-retro). |
| 2 | `epics.md` (intro detalhada) | Lista ordenada estendida: → (7)…(11). |
| 3 | `epics.md` | Novas Stories **11.7–11.11** (ACs Given/When/Then). |
| 4 | `architecture.md` | Novo **AD-16** (4 decisões; sem schema). |
| 5 | `sprint-status.yaml` | `epic-11: in-progress`; +11-7…11-11 `backlog`; retro → `optional`. |

**Stories (resumo):**
- **11.7 — Edição de tarefa persiste** (bug 11.5): botão salvar + persistência.
- **11.8 — Infos da recorrência no modal de placement** (bug 11.3).
- **11.9 — Polimento visual dos cards + grid da semana** (descrição truncada incl. recorrentes, hover, espaçamento/largura, semana em 2 linhas).
- **11.10 — Seletor Mover/Migrar completo**: abas Hoje (Daily Log) / Esta semana (dia ou sem-data) / Este mês (dia ou sem-data) / Futuro; botão "Migrar" + título "Migrar Tarefa"; mais infos da task; calendário com highlight (hoje/semana) e clique-preenche-campo; corrige bug em Esta Semana. Reverte 2 decisões da 11.6 (balde sem-dia; auto-fire), registradas no AD-16.
- **11.11 — Navegar e agir em logs passados não-fechados** (issue de visibilidade).

**Decisões de produto registradas neste Correct Course:**
- "Mover para hoje" = **ação explícita ao Daily Log** (não agregação automática) — preserva a fricção do BuJo.
- Ajustes de botão/título/infos valem **só para o seletor Mover** — `MigrationCard` (UX-DR3) intacto.
- Ordem dependente: **11.11 após 11.10** (mover de log passado usa o seletor novo).

---

## 5. Handoff de Implementação

- **Classificação:** Moderado → reorganização de backlog concluída (artefatos acima atualizados).
- **Próximo passo:** `bmad-create-story` para a **Story 11.7** (contexto limpo), depois `bmad-story-automator` para rodar o lote 11.7–11.11, ou dev-story/CR manual por story.
- **Fechamento:** ao concluir 11.11, rodar `bmad-retrospective` do Épico 11 (2ª passada, cobrindo 11.7–11.11) — retro está `optional` em `sprint-status.yaml`.
- **Critério de sucesso:** todas as ACs de 11.7–11.11 verdes; sem regressão em 11.1–11.6; AD-16 refletido na implementação.

**Sem commit realizado** — apenas edições de artefatos de planejamento.
