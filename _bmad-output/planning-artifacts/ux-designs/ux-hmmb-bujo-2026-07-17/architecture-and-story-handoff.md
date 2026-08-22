# Architecture and Story Handoff — HMMB BuJo

Companion técnico do `EXPERIENCE.md`. Preserva obrigações downstream extraídas do antigo bloco **Decisions for Architecture and Stories**; o spine continua autoridade de experiência e este documento não cria funcionalidade.

## Fundação transversal

Arquitetura deve definir namespace/fronteira dos temas, ownership entre `app/pages/features/shared`, ativação e rollback por rota, CSS baseline/portals, política de extensão MUI, fronteira MUI/Phosphor, catálogo e persistência de `iconKey`, fallback de `emoticon`, visual regression, feature flags, deprecação e remoção.

### Aparência multi-dispositivo

Persistência por conta usa **last write wins**. O formulário mantém draft local separado do valor remoto: atualização remota só substitui o aplicado quando não há draft; salvar o draft grava a nova preferência vigente. Não há merge, versão exposta ou UI de conflito. A implementação deve impedir que refetch descarte silenciosamente um draft.

### Auth

Cold-load, sessão expirada, credencial inválida, recuperação de senha e preservação do formulário pertencem à x.0 do Épico 18. A arquitetura deve carregar os requisitos FR-0.2/FR-0.5 e não inferir estados visuais antes desse gate.

### Detalhes puramente técnicos

Idempotência de transições, materialização de períodos, constraints de unicidade, enum derivado de U/I e transações são obrigações de arquitetura/story, não componentes ou journeys. As consequências observáveis continuam nos spines: um ciclo ativo por tipo, nenhum salto silencioso, estado preservado em falha e decisões explícitas.

### Contrato acessível do shell

A implementação materializa o contrato do `EXPERIENCE.md`: skip link como primeiro foco, um único `main` por rota e landmarks nomeados exatamente; foco nunca encoberto pelo chrome fixo/sticky, FAB, safe-area ou teclado virtual; grupo recolhido com filho ativo descrito programaticamente, sem `aria-current` no grupo. RouteAnnouncer, títulos, regiões de status, alertas, erros de campo, `aria-busy` e indicadores de progresso devem compartilhar uma matriz de ownership para que cada evento seja anunciado uma única vez. Boundaries interativos necessários consomem `control-border` da paleta ativa, nunca `border-strong`; divisores e panels continuam estruturais. Testes cobrem primeiro e último controles em 320 CSS px/200%, cores forçadas e os limiares de contraste em todas as oito paletas.

## M06 — Weekly

Definir persistência/transações dos estados semanais e marco de planejamento; constraint de um Weekly **Em andamento** e um **Em planejamento**; criação/cancelamento do alvo vazio; decisões `manter`/`não alocar` e snapshots; agregação independente de Monthly/Weekly/Daily/recorrentes; migração para semana-alvo explícita; finalização/início idempotentes; localizador do sucessor por tarefa; origem readonly; densidade com subtarefas e todos os status; semana ISO e posição nos dois meses. Mudanças de domínio/API exigem histórias próprias, não CSS.

## M07 — Monthly

Definir persistência/transações dos estados mensais e marco de planejamento; constraints de um Monthly **Em andamento** e um **Em planejamento**; materialização sequencial de meses ausentes; janela regular pela semana segunda→domingo da virada; gates idempotentes; decisão **Manter sem dia** e snapshots; agregação independente das três fontes; distinção Monthly/Future; elegibilidade anual sem parsing de `recurrence_text`; destino anual no mesmo ano; múltiplas instâncias por template; migração/linhagem ao trocar dia; seletor 28–31; densidade com subtarefas/status; navegação dia → Daily e Task Row → detalhe.

Preservam PRD/arquitetura/Épicos 4 e 11: calendário, `month_first`, Future como visão de `monthly_log`, snapshots, `recurrence_text` livre, linhagem e readonly. Ampliam contrato e exigem Correct Course/arquitetura: estados explícitos, continuidade sem lacunas, decisões-snapshot, anuais no ritual mensal, conclusão direta no Monthly anterior e planejamento integral mobile.

## M08 — Future Log

Definir horizonte rolante de oito meses futuros, com vazios e sem o corrente; seletor de meses distantes filtrando `monthly_log` com itens/contagens; datear/mover com migração/linhagem e localizador; ordenação por dia com sem-dia ao final; offline/erro local.

Preservam `FuturePage.tsx`: visão de `monthly_log`, agrupamento mensal, data parcial/completa, `FutureLogItemForm`, anuais pendentes e skeleton. Ampliam contrato: horizonte vazio, trilho + foco, “Ir para mês”, datear/mover no lugar e estados explícitos. Concluir/cancelar permanecem fora.

## M09 — Recorrentes

Definir soft delete com preservação de `source_template`; edição completa mantendo `recurrence_group` imutável; Categoria/Eisenhower em swatches/checkboxes; offline/erro/validação.

Preservam `RecurringTemplateManager`: `/planner/recurring`, abas, Mostrar inativos, categoria-cor, `recurrence_text` livre, sem ícone de estado, ativação prospectiva e alocação nos rituais. Ampliam contrato: soft delete, edição completa, novos controles e estados. O termo canônico é **Alocar**.

## M10 — Migração/Catch-Up

Definir fila unificada de `/migration/queue/` + `/catch-up/queue/`, ordenada mês→semana→dia; ritual dentro do shell; seletor com Esta semana/dia no mês/outro mês/Hoje/Sem dia; pausar/retomar por itens restantes; resumo; erro no fluxo.

Preservam detecção por pendências, decisão individual, destinos `today/week/month/future/cancel`, atalhos e ausência de toast. Ampliam contrato: unificação, ritual, seletor rico, pausa/retomada, resumo e erro. Migração não conclui tarefa.

## M11 — Brain Dump/Captura

Definir endpoint de atualização do item (`PATCH /api/brain-dump/items/{id}/`, campos `title`/`description`/`target_log`) para a edição paritária decidida no gate 15.0 — o domínio hoje só tem criar/listar/processar/descartar/contar; processamento aceitando `scheduled_date` opcional nos destinos `week`/`month` (contratado, nunca exercitado pela UI legada — registrar divergência de paridade na 15.3); chaves de query `['brainDump','count',userId]` e lista, invalidadas em toda mutação; captura otimista sobre a contagem, com rollback em falha de escrita.

Preservam `BrainDumpPage`/`CaptureSheet.tsx`: rotas `GET/POST /api/brain-dump/items/` · `DELETE .../items/{id}/` · `POST .../items/{id}/process/` · `GET .../count/`; campos `id`, `title` (máx. 500), `description`, `target_log` (`today|week|month|future` ou nulo), `created_at`; ordenação por `created_at`; destinos `today·week·month·future`, com `future` exigindo `month_first` posterior ao mês corrente e `month` resolvendo o mês corrente no servidor; processar cria a Task e apaga o item; descartar apaga sem confirmação, sem desfazer. Ampliam contrato: endpoint de atualização do item, `scheduled_date` exercitado por Esta Semana/Este Mês no seletor de destino, e sheet de edição do item com confirmação de descarte de rascunho equivalente à do Capture Sheet.

## Checklist de cada story

Cada story carrega onda, superfície, paridade, tokens/componentes, matriz responsiva, estados, aceite acessível, ownership, dependências, rollout/rollback, testes e dívida legada removida. Trocar MUI ou regras de domínio não é autorizado por esta UX. `iconKey` é mudança contratual isolada, retrocompatível e explicitamente aprovada.

## Fontes

- `../../../specs/spec-design-system-migration/SPEC.md`
- `../../../specs/spec-design-system-migration/design-system-contract.md`
- `../../../specs/spec-design-system-migration/migration-plan.md`
- `../../architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md`
- `../../epics.md`
- `../../prds/prd-hmmb-bujo-2026-06-15/prd.md`
- `../../prds/prd-hmmb-bujo-2026-06-15/addendum.md`
- [`requirements-traceability.md`](requirements-traceability.md)
- [`imports/story-15-0-brain-dump-handoff/`](imports/story-15-0-brain-dump-handoff/)
