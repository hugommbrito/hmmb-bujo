# Deferred Work

Itens reais porém não acionáveis agora, registrados durante reviews para acompanhamento futuro.

## Deferred from: code review of 1-1-scaffold-do-monorepo-e-pipeline-de-ci-base (2026-06-24)

- **Hardening de produção incompleto** — `backend/config/settings/prod.py` define cookies `Secure` e `SECURE_PROXY_SSL_HEADER`, mas falta `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`/`INCLUDE_SUBDOMAINS`/`PRELOAD`. Deferido porque o alvo de deploy e o hardening de produção estão explicitamente fora do escopo desta story (Gap I-1, pré-produção). Revisitar antes do primeiro deploy.
- **CI não exercita o caminho de produção** — `.github/workflows/ci.yml` roda apenas `config.settings.dev`; `prod.py` nunca é importado/validado e não há smoke de `migrate`/`makemigrations --check`. Inócuo hoje (sem models de domínio), mas deixa drift de migração e erros exclusivos de prod passarem despercebidos. Revisitar quando houver models (Stories 1.2+) ou ao definir deploy.

## Deferred from: code review of 1-2-modulo-core-com-isolamento-multi-tenant-fail-closed-e-guardrails (2026-06-24)

- **Escrita cross-tenant não validada contra o contexto ativo** (`backend/core/models.py:394-402`) — `save()` só preenche `user_id` quando é `None`, então um `user_id` explícito arbitrário é persistido sem checar `current_user_id`, e `bulk_create` não chama `save()` (contorna auto-fill + fail-closed). **Razão do defer:** sem serializers/views/`bulk_create` até a Story 1.4; preservar `user_id` explícito é by-design (caminho admin). Endereçar validação `user_id == current_user_id` + guarda de `bulk_create` quando surgir a primeira camada de escrita de domínio.
- **Robustez do `custom_exception_handler` para corpos de erro não-triviais** (`backend/core/exceptions.py:278-315`) — `_as_list` stringifica erros de serializer aninhado como `"{'sub': [...]}"`; `non_field_errors` como string é indexado por caractere; `data=None` vira `{"detail": "None"}`; dict com `detail` + chaves extras rebaixa o `detail` real a "campo". Sem serializers/views que exercitem esses caminhos até a Story 1.4 — endereçar quando a primeira view/serializer surgir.
- **Mapeamento 404 "recurso de outro usuário" não implementado nem testado** (`backend/core/exceptions.py`) — o mapa do §6.4 lista 404 para recurso de outro tenant, mas isso só emerge com `get_object_or_404`/views de recurso, inexistentes até o Épico 3+. Cobrir com a primeira view de recurso.
- **`tenant_context`/middleware aceitam `user.id` None ou falsy** (`backend/core/tenant.py:446,461`; `backend/core/middleware.py:345`) — `set(None)`/`set(0)`/`set("")` torna o contexto indistinguível de "sem tenant" (500 + log crítico enganoso) ou aceita id espúrio. Guards são estritamente `is None`. Sem `User` real até a Story 2.1.
- **`TenantMiddleware` pode "acordar" via sessão do Django admin com PK incompatível** (`backend/core/middleware.py:343-345`) — login no admin autentica um `auth.User` de PK inteiro; o middleware setaria `current_user_id` para um int incompatível com `user_id` UUID. Sem superuser/models de domínio hoje; reavaliar quando houver acesso ao admin ou models reais.

## Deferred from: code review of fix-deploy-ci-e-cors (2026-07-03)

Contexto: a regeneração de `schema.yaml`/`frontend/src/api/types.gen.ts` (antes um stub vazio) expôs lacunas pré-existentes de anotação de schema em `accounts/views.py` e `accounts/serializers.py` que nunca tinham sido refletidas no arquivo commitado. Nenhum destes itens foi causado pela regeneração — apenas ficaram visíveis por ela.

- **Signup documentado com status/response errados** (`backend/accounts/views.py:9-15`) — a view `signup` é um `@api_view` sem `@extend_schema`, então drf-spectacular "adivinhou" `200` com corpo vazio. Na realidade retorna `201` com `{"detail": "Conta criada com sucesso."}` (coberto por `backend/accounts/tests/test_views.py:19`, `test_signup_valido_retorna_201`). Também falta o `requestBody` (`email`/`password`/`timezone` de `SignupSerializer`). Corrigir anotando a view com `@extend_schema(request=SignupSerializer, responses={201: ...})`.
- **Nenhuma resposta de erro documentada no schema** — nenhuma das 3 operações (signup, token, token/refresh) lista 400/401, embora `test_views.py` exercite esses casos. Adicionar quando as views ganharem anotações `@extend_schema` completas.
- **`COMPONENT_SPLIT_REQUEST=False` (`backend/config/settings/base.py:160`) conflacia request/response de `TokenObtainPair`/`TokenRefresh`** — o schema gerado marca `access`/`refresh` como obrigatórios tanto no request quanto no response, o que é logicamente incorreto para quem só possui o request. Revisitar se/quando os tipos gerados forem consumidos diretamente pelo frontend para esses endpoints.
- **Sem guarda de CI para drift schema-vs-view** — o step de CI hoje só garante que `types.gen.ts` bate com `schema.yaml` gerado; não garante que `schema.yaml` reflita o comportamento real das views (faltam anotações `@extend_schema`). Considerar um teste de contrato leve por endpoint quando o número de endpoints crescer.
- **`security` do signup mistura JWT opcional com endpoint público** (`schema.yaml`, view `accounts/views.py`) — tecnicamente correto dado `DEFAULT_AUTHENTICATION_CLASSES` global + `permission_classes=[AllowAny]`, mas confuso no contrato gerado. Considerar `authentication_classes=[]` na view de signup para um schema mais limpo.

## Deferred from: review of story-14-9-migracao-catch-up-como-ritual-no-shell (2026-07-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-14-9-migracao-catch-up-como-ritual-no-shell.md`
  summary: `WeeklyPlanningPage`/`WeeklyDecisionList` (Story 14.5) têm as mesmas violações axe de color-contrast e target-size (WCAG 2.5.8) em compact/tablet/reflow-320 que a 14.9 corrigiu localmente na página de Migração, sem tocar tokens compartilhados.
  evidence: confirmado rodando o teste axe da própria `weekly-planning-ritual.spec.ts` em compact contra o `dev` HEAD atual — falha com as violações idênticas, independente de qualquer mudança desta sessão. Pré-existente desde a 14.5, fora do Code Map da 14.9 (corrigir ali tocaria `--ds-weekly-planning-source-rail`/`context-rail`, tokens consumidos por Weekly/Monthly/Future).
  target_epic: Épico 17 ou 18 (atribuído na retrospectiva do Épico 14, 2026-07-28) — tokens compartilhados (`--ds-weekly-planning-source-rail`/`context-rail`) tocam Weekly/Monthly/Future; corrigir junto do trabalho de remoção de legados/hardening desses épicos, para não virar dívida sem dono.

## Deferred from: review of story-14-10-arquivo-no-sistema-novo (2026-07-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-14-10-arquivo-no-sistema-novo.md`
  summary: `findPredecessor` em `ArchiveWeeklyDetailPage.tsx`/`ArchiveMonthlyDetailPage.tsx` só busca a origem da linhagem dentro do próprio período carregado, então o card de detalhe de uma tarefa alcançada via seta cross-período nunca mostra "veio de" (some silenciosamente, ao contrário do mesmo card para migração dentro do período).
  evidence: confirmado lendo `findPredecessor` em ambas as páginas — o loop itera só sobre `days`/`unscheduled` (Weekly) ou `tasks` (Monthly) do período atual; a origem de uma linhagem cross-período está por definição em outro período, fora desse escopo de busca. Não é exigido pela matriz I/O da spec (que só pede navegação + foco na linha sucessora), só um efeito colateral perdido.
- source_spec: `_bmad-output/implementation-artifacts/spec-14-10-arquivo-no-sistema-novo.md`
  summary: `archiveLineageReturn.ts` usa uma única chave de `sessionStorage`; um segundo salto de linhagem (B→C) antes de retornar do primeiro (A→B) sobrescreve a entrada de retorno, quebrando o foco-ao-voltar da primeira origem.
  evidence: confirmado lendo `archiveLineageReturn.ts` — `STORAGE_KEY` é um único valor, escrito por `handleNavigateToSuccessor` em ambas as páginas de detalhe sem pilha/histórico. Fora do escopo da spec (que define linhagem só como "origem → sucessor imediato", um salto por vez), mas o encadeamento de saltos consecutivos é uma sequência de usuário plausível.
- source_spec: `_bmad-output/implementation-artifacts/spec-14-10-arquivo-no-sistema-novo.md`
  summary: A seta de linhagem em `TaskRowBase.tsx` usa `aria-disabled` (não o atributo `disabled` real) quando o sucessor não está disponível, então o controle continua clicável por mouse e produz um clique morto silencioso — padrão pré-existente, não tocado por esta story (Design Notes: "sem reescrita da lógica de `successorAvailable`").
  evidence: confirmado lendo `TaskRowBase.tsx` (~linha 293) — o botão da seta usa `aria-disabled` em vez de `disabled`, e nenhum handler de clique é suprimido no lado do DOM; o mesmo comportamento já existia antes desta story em todos os outros consumidores (Weekly/Monthly/Future/Migration boards), que não passam a nova prop `onNavigateToSuccessor`.

<!-- RESOLVIDO 2026-07-28 (review pass pós-implementação): os dois achados abaixo foram corrigidos —
     `select_related` (`MIGRATED_TO_TASK_SELECT_RELATED`) adicionado a `LogSerializer.get_tasks`/
     `WeeklyLogView.get`/`MonthlyLogView.get`; `archiveLineageReturn.ts` agora limpa a entrada
     IMEDIATAMENTE após lê-la (antes de tentar focar), nunca só no caminho de sucesso. Removidos
     desta lista; mantidos apenas para referência de histórico neste comentário. -->

### DW-1: Follow-up review still recommended for 14-10-arquivo-no-sistema-novo after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-14-10-arquivo-no-sistema-novo.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260728-115746-2279; this entry preserves the lingering recommendation for a deliberate later review.
status: open

## Deferred from: review of story-15-1-brain-dump-no-sistema-novo-inbox-e-processamento (2026-07-30)

- source_spec: `_bmad-output/implementation-artifacts/spec-15-1-brain-dump-no-sistema-novo-inbox-e-processamento.md`
  summary: The global Enter keyboard shortcut in the Brain Dump/migration destination pickers can confirm a stale, previously-armed destination/day instead of the one the user just focused, because the focused radio-button's native click (which updates state) fires as the Enter keydown's default action AFTER the window-level shortcut handler already read the old state.
  evidence: confirmed reading `useKeyboardShortcuts` (`frontend/src/shared/hooks/useKeyboardShortcuts.ts:27-36` — only excludes INPUT/TEXTAREA/contentEditable from the shortcut guard, not BUTTON) alongside `confirm()`/`useKeyboardShortcuts({ Enter: confirm, ... })` in `BrainDumpDestinationPicker.tsx:188-208`. The identical anatomy (global Enter shortcut + `role="radio"` on a `<button>` element) already exists, unmodified, in the production `DestinationPicker.tsx` (M10, consumed by `MigrationRitualPage.tsx`) — this story's new picker deliberately reuses that anatomy per its own header comment, so the hazard is inherited, not newly introduced logic.
  location: >-
    frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:205-208;
    frontend/src/features/bujo/components/DestinationPicker.tsx
  severity: medium

### DW-2: Follow-up review still recommended for 15-1-brain-dump-no-sistema-novo-inbox-e-processamento after the review budget was exhausted
origin: review-budget-followup
location: n/a
source_spec: `spec-15-1-brain-dump-no-sistema-novo-inbox-e-processamento.md`
severity: low
reason: Review budget (3 cycles) was exhausted with the story finalized (status: done, verify green) while the review pass kept recommending an independent follow-up. The work was committed by bmad-loop run 20260729-230649-5530; this entry preserves the lingering follow-up recommendation for a deliberate later review.
status: open

### DW-3: Follow-up review still recommended for 15-3-passe-de-paridade-estados-e-acessibilidade-da-captura after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-15-3-passe-de-paridade-estados-e-acessibilidade-da-captura.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260729-230649-5530; this entry preserves the lingering recommendation for a deliberate later review.
status: open
