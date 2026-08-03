# Deferred Work

### DW-4: Hardening de produção incompleto
origin: migrated from legacy ledger ("Deferred from: code review of 1-1-scaffold-do-monorepo-e-pipeline-de-ci-base (2026-06-24)"), 2026-07-31
location: backend/config/settings/prod.py
reason: prod.py define cookies Secure e SECURE_PROXY_SSL_HEADER, mas falta SECURE_SSL_REDIRECT, SECURE_HSTS_SECONDS/INCLUDE_SUBDOMAINS/PRELOAD; deferido porque o alvo de deploy e o hardening de produção estavam explicitamente fora do escopo da story 1.1 (Gap I-1, pré-produção) — revisitar antes do primeiro deploy.
status: done 2026-07-31
resolution: resolved by sweep bundle dw-prod-settings-and-ci-hardening

### DW-5: CI não exercita o caminho de produção
origin: migrated from legacy ledger ("Deferred from: code review of 1-1-scaffold-do-monorepo-e-pipeline-de-ci-base (2026-06-24)"), 2026-07-31
location: .github/workflows/ci.yml
reason: CI roda apenas config.settings.dev; prod.py nunca é importado/validado e não há smoke de migrate/makemigrations --check; inócuo enquanto não havia models de domínio, mas deixa drift de migração e erros exclusivos de prod passarem despercebidos — revisitar quando houver models (Stories 1.2+) ou ao definir deploy.
status: done 2026-07-31
resolution: resolved by sweep bundle dw-prod-settings-and-ci-hardening

### DW-6: Escrita cross-tenant não validada contra o contexto ativo
origin: migrated from legacy ledger ("Deferred from: code review of 1-2-modulo-core-com-isolamento-multi-tenant-fail-closed-e-guardrails (2026-06-24)"), 2026-07-31
location: backend/core/models.py:394-402
reason: save() só preenche user_id quando é None, então um user_id explícito arbitrário é persistido sem checar current_user_id, e bulk_create não chama save() (contorna auto-fill + fail-closed); sem serializers/views/bulk_create até a Story 1.4, e preservar user_id explícito é by-design (caminho admin) — endereçar validação user_id == current_user_id + guarda de bulk_create quando surgir a primeira camada de escrita de domínio.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-core-tenant-guardrail-hardening

### DW-7: Robustez do custom_exception_handler para corpos de erro não-triviais
origin: migrated from legacy ledger ("Deferred from: code review of 1-2-modulo-core-com-isolamento-multi-tenant-fail-closed-e-guardrails (2026-06-24)"), 2026-07-31
location: backend/core/exceptions.py:278-315
reason: _as_list stringifica erros de serializer aninhado como "{'sub': [...]}"; non_field_errors como string é indexado por caractere; data=None vira {"detail": "None"}; dict com detail + chaves extras rebaixa o detail real a "campo" — sem serializers/views que exercitem esses caminhos até a Story 1.4, endereçar quando a primeira view/serializer surgir.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-core-tenant-guardrail-hardening

### DW-8: Mapeamento 404 "recurso de outro usuário" não implementado nem testado
origin: migrated from legacy ledger ("Deferred from: code review of 1-2-modulo-core-com-isolamento-multi-tenant-fail-closed-e-guardrails (2026-06-24)"), 2026-07-31
location: backend/core/exceptions.py
reason: o mapa do §6.4 lista 404 para recurso de outro tenant, mas isso só emerge com get_object_or_404/views de recurso, inexistentes até o Épico 3+ — cobrir com a primeira view de recurso.
status: done 2026-07-31
resolution: already resolved: bujo/views.py TaskDetailView.patch (lines 139-142) uses the tenant-scoped TenantManager (`Task.objects.get(id=pk)`) wrapped in try/except Task.DoesNotExist -> NotFound(), which is functionally identical to the ledger's described get_object_or_404 404-mapping for a cross-tenant resource; the same pattern is heavily tested (test_..._de_outro_tenant_retorna_404 style tests exist in bujo/medications/braindump/health/habits test suites).

### DW-9: tenant_context/middleware aceitam user.id None ou falsy
origin: migrated from legacy ledger ("Deferred from: code review of 1-2-modulo-core-com-isolamento-multi-tenant-fail-closed-e-guardrails (2026-06-24)"), 2026-07-31
location: backend/core/tenant.py:446,461; backend/core/middleware.py:345
reason: set(None)/set(0)/set("") torna o contexto indistinguível de "sem tenant" (500 + log crítico enganoso) ou aceita id espúrio; guards são estritamente is None; sem User real até a Story 2.1.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-core-tenant-guardrail-hardening

### DW-10: TenantMiddleware pode "acordar" via sessão do Django admin com PK incompatível
origin: migrated from legacy ledger ("Deferred from: code review of 1-2-modulo-core-com-isolamento-multi-tenant-fail-closed-e-guardrails (2026-06-24)"), 2026-07-31
location: backend/core/middleware.py:343-345
reason: login no admin autentica um auth.User de PK inteiro; o middleware setaria current_user_id para um int incompatível com o user_id UUID; sem superuser/models de domínio até o momento do defer — reavaliar quando houver acesso ao admin ou models reais.
status: done 2026-07-31
resolution: already resolved: backend/config/settings/base.py:21 sets AUTH_USER_MODEL = 'accounts.User' (custom UUID-PK model, no separate django.contrib.auth.User exists); backend/accounts/admin.py registers this same User model for Django admin; TenantMiddleware never reads request.user at all -- current_user_id is only ever set by TenantAwareJWTAuthentication.authenticate() in core/authentication.py, which fires for JWT/DRF requests, not Django admin's session login -- so the described int-PK-vs-UUID mismatch scenario cannot occur under the current architecture.

### DW-11: Signup documentado com status/response errados
origin: migrated from legacy ledger ("Deferred from: code review of fix-deploy-ci-e-cors (2026-07-03)"), 2026-07-31
location: backend/accounts/views.py:9-15
reason: a regeneração de schema.yaml/types.gen.ts expôs que a view signup (@api_view sem @extend_schema) documenta 200 com corpo vazio quando na realidade retorna 201 com {"detail": "Conta criada com sucesso."} (coberto por backend/accounts/tests/test_views.py:19, test_signup_valido_retorna_201) e falta o requestBody de SignupSerializer; corrigir anotando a view com @extend_schema(request=SignupSerializer, responses={201: ...}).
status: done 2026-08-03
resolution: resolved by sweep bundle dw-accounts-schema-accuracy-drift-guard

### DW-12: Nenhuma resposta de erro documentada no schema
origin: migrated from legacy ledger ("Deferred from: code review of fix-deploy-ci-e-cors (2026-07-03)"), 2026-07-31
location: schema.yaml
reason: nenhuma das 3 operações (signup, token, token/refresh) lista 400/401, embora test_views.py exercite esses casos — adicionar quando as views ganharem anotações @extend_schema completas.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-accounts-schema-accuracy-drift-guard

### DW-13: COMPONENT_SPLIT_REQUEST=False conflacia request/response de TokenObtainPair/TokenRefresh
origin: migrated from legacy ledger ("Deferred from: code review of fix-deploy-ci-e-cors (2026-07-03)"), 2026-07-31
location: backend/config/settings/base.py:160
reason: o schema gerado marca access/refresh como obrigatórios tanto no request quanto no response, o que é logicamente incorreto para quem só possui o request — revisitar se/quando os tipos gerados forem consumidos diretamente pelo frontend para esses endpoints.
status: open

### DW-14: Sem guarda de CI para drift schema-vs-view
origin: migrated from legacy ledger ("Deferred from: code review of fix-deploy-ci-e-cors (2026-07-03)"), 2026-07-31
location: .github/workflows/ci.yml
reason: o step de CI hoje só garante que types.gen.ts bate com o schema.yaml gerado, não que o schema.yaml reflita o comportamento real das views (faltam anotações @extend_schema) — considerar um teste de contrato leve por endpoint quando o número de endpoints crescer.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-accounts-schema-accuracy-drift-guard

### DW-15: security do signup mistura JWT opcional com endpoint público
origin: migrated from legacy ledger ("Deferred from: code review of fix-deploy-ci-e-cors (2026-07-03)"), 2026-07-31
location: schema.yaml; backend/accounts/views.py
reason: tecnicamente correto dado DEFAULT_AUTHENTICATION_CLASSES global + permission_classes=[AllowAny], mas confuso no contrato gerado — considerar authentication_classes=[] na view de signup para um schema mais limpo.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-accounts-schema-accuracy-drift-guard

### DW-16: WeeklyPlanningPage/WeeklyDecisionList têm as mesmas violações axe de color-contrast e target-size que a 14.9 corrigiu localmente na página de Migração
origin: migrated from legacy ledger ("Deferred from: review of story-14-9-migracao-catch-up-como-ritual-no-shell (2026-07-28)"), 2026-07-31
location: WeeklyPlanningPage.tsx; WeeklyDecisionList.tsx (Story 14.5)
reason: mesmas violações axe de color-contrast e target-size (WCAG 2.5.8) em compact/tablet/reflow-320 que a 14.9 corrigiu localmente na página de Migração, sem tocar tokens compartilhados; confirmado rodando o teste axe da própria weekly-planning-ritual.spec.ts em compact contra o dev HEAD atual — falha com violações idênticas, pré-existente desde a 14.5, fora do Code Map da 14.9 (corrigir ali tocaria --ds-weekly-planning-source-rail/context-rail, tokens também consumidos por Monthly/Future); atribuído ao Épico 17 ou 18 na retrospectiva do Épico 14 (2026-07-28) para não virar dívida sem dono.
status: open

### DW-17: findPredecessor em ArchiveWeeklyDetailPage.tsx/ArchiveMonthlyDetailPage.tsx só busca a origem da linhagem dentro do próprio período carregado
origin: migrated from legacy ledger ("Deferred from: review of story-14-10-arquivo-no-sistema-novo (2026-07-28)"), 2026-07-31
location: ArchiveWeeklyDetailPage.tsx; ArchiveMonthlyDetailPage.tsx (findPredecessor)
reason: o card de detalhe de uma tarefa alcançada via seta cross-período nunca mostra "veio de" (some silenciosamente, ao contrário do mesmo card para migração dentro do período); confirmado lendo findPredecessor em ambas as páginas — o loop itera só sobre days/unscheduled (Weekly) ou tasks (Monthly) do período atual; não é exigido pela matriz I/O da spec 14-10 (que só pede navegação + foco na linha sucessora), só um efeito colateral perdido.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-archive-lineage-navigation-fixes

### DW-18: archiveLineageReturn.ts usa uma única chave de sessionStorage, quebrando o foco-ao-voltar em saltos de linhagem encadeados
origin: migrated from legacy ledger ("Deferred from: review of story-14-10-arquivo-no-sistema-novo (2026-07-28)"), 2026-07-31
location: archiveLineageReturn.ts
reason: um segundo salto de linhagem (B→C) antes de retornar do primeiro (A→B) sobrescreve a entrada de retorno, quebrando o foco-ao-voltar da primeira origem; confirmado lendo archiveLineageReturn.ts — STORAGE_KEY é um único valor, escrito por handleNavigateToSuccessor em ambas as páginas de detalhe sem pilha/histórico; fora do escopo da spec 14-10 (linhagem definida só como "origem → sucessor imediato", um salto por vez), mas o encadeamento de saltos consecutivos é uma sequência de usuário plausível.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-archive-lineage-navigation-fixes

### DW-19: A seta de linhagem em TaskRowBase.tsx usa aria-disabled em vez de disabled real quando o sucessor não está disponível
origin: migrated from legacy ledger ("Deferred from: review of story-14-10-arquivo-no-sistema-novo (2026-07-28)"), 2026-07-31
location: TaskRowBase.tsx (~linha 293)
reason: o controle continua clicável por mouse e produz um clique morto silencioso — padrão pré-existente, não tocado pela story 14-10 (Design Notes: "sem reescrita da lógica de successorAvailable"); confirmado lendo TaskRowBase.tsx — o botão da seta usa aria-disabled em vez de disabled e nenhum handler de clique é suprimido no DOM; o mesmo comportamento já existia antes desta story em todos os outros consumidores (Weekly/Monthly/Future/Migration boards), que não passam a nova prop onNavigateToSuccessor.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-task-row-lineage-arrow-disabled-fix

### DW-1: Follow-up review still recommended for 14-10-arquivo-no-sistema-novo after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-14-10-arquivo-no-sistema-novo.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260728-115746-2279; this entry preserves the lingering recommendation for a deliberate later review.
status: done 2026-08-03
resolution: already resolved: Commits a4b8908 (dw-archive-lineage-navigation-fixes: DW-17, DW-18) and fa0c825 (dw-task-row-lineage-arrow-disabled-fix: DW-19), both 2026-08-03, implemented and reviewed fixes for every previously-known open item on this story's surface (ArchiveWeeklyDetailPage.tsx, ArchiveMonthlyDetailPage.tsx, archiveLineageReturn.ts, TaskRowBase.tsx) via full bmad-loop dev+review cycles; neither review cycle produced a new deferred/follow-up ledger entry (no DW-27+ exists for this area), and three days of subsequent Epic 15 work over the same codebase surfaced nothing new here either -- the independent follow-up review this entry asked for has, in substance, already happened cleanly.

### DW-20: Enter global no seletor de destino do Brain Dump pode confirmar um destino/dia obsoleto em vez do que acabou de receber foco
origin: migrated from legacy ledger ("Deferred from: review of story-15-1-brain-dump-no-sistema-novo-inbox-e-processamento (2026-07-30)"), 2026-07-31
location: frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:205-208; frontend/src/features/bujo/components/DestinationPicker.tsx
severity: medium
reason: o atalho global de Enter pode confirmar um destino/dia previamente armado e obsoleto em vez do que o usuário acabou de focar, porque o clique nativo do radio-button focado (que atualiza o estado) dispara como ação default do keydown de Enter DEPOIS que o handler do atalho de nível de window já leu o estado antigo; confirmado lendo useKeyboardShortcuts (frontend/src/shared/hooks/useKeyboardShortcuts.ts:27-36 — só exclui INPUT/TEXTAREA/contentEditable do guard do atalho, não BUTTON) junto de confirm()/useKeyboardShortcuts({ Enter: confirm, ... }) em BrainDumpDestinationPicker.tsx:188-208; a mesma anatomia (atalho global de Enter + role="radio" num elemento <button>) já existe, sem modificação, no DestinationPicker.tsx de produção (M10, consumido por MigrationRitualPage.tsx) — esta story reusa deliberadamente essa anatomia conforme seu próprio comentário de cabeçalho, então o risco é herdado, não lógica nova introduzida.
status: open

### DW-2: Follow-up review still recommended for 15-1-brain-dump-no-sistema-novo-inbox-e-processamento after the review budget was exhausted
origin: review-budget-followup
location: n/a
source_spec: `spec-15-1-brain-dump-no-sistema-novo-inbox-e-processamento.md`
severity: low
reason: Review budget (3 cycles) was exhausted with the story finalized (status: done, verify green) while the review pass kept recommending an independent follow-up. The work was committed by bmad-loop run 20260729-230649-5530; this entry preserves the lingering follow-up recommendation for a deliberate later review.
status: done 2026-08-03
resolution: already resolved: The only concrete finding left dangling when this review round's budget was exhausted was the Enter-key race in the destination picker, already tracked as its own ledger entry, DW-20 -- this same sweep classifies DW-20 as a buildable bundle (destination-picker-enter-key-race) that will run its own dev+review cycle. Every other finding from both review rounds (12 patch/6 defer, then 7 patch/1 defer) was already fixed inside the story's own review cycles. Nothing from 15-1's review history remains unaddressed or untracked.

### DW-3: Follow-up review still recommended for 15-3-passe-de-paridade-estados-e-acessibilidade-da-captura after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-15-3-passe-de-paridade-estados-e-acessibilidade-da-captura.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260729-230649-5530; this entry preserves the lingering recommendation for a deliberate later review.
status: open

### DW-21: SECURE_PROXY_SSL_HEADER + RAILWAY_PRIVATE_DOMAIN em ALLOWED_HOSTS pode permitir spoof de X-Forwarded-Proto pela rede privada do Railway
origin: review (fresh review pass) of spec-dw-4-dw-5-prod-settings-e-ci-hardening, 2026-07-31
location: backend/config/settings/prod.py (SECURE_PROXY_SSL_HEADER, ALLOWED_HOSTS)
severity: medium
reason: o redirect/HSTS de DW-4 dependem inteiramente de SECURE_PROXY_SSL_HEADER (pré-existente, não tocado por essa story) para decidir se uma requisição é "segura"; RAILWAY_PRIVATE_DOMAIN já está em ALLOWED_HOSTS, então qualquer origem capaz de alcançar o container pela rede privada do Railway poderia forjar X-Forwarded-Proto: https e derrubar o hardening inteiro (sem redirect, sem header HSTS); não foi verificado se a rede privada do Railway é de fato alcançável por algo além dos próprios serviços do mesmo projeto — investigar a topologia real antes de tratar como confirmado.
status: open

### DW-22: CorsMiddleware responde preflight OPTIONS antes de SecurityMiddleware, então esse tráfego não passa pelo redirect HTTPS/HSTS de DW-4
origin: review (fresh review pass) of spec-dw-4-dw-5-prod-settings-e-ci-hardening, 2026-07-31
location: backend/config/settings/base.py (MIDDLEWARE)
severity: low
reason: CorsMiddleware roda antes de SecurityMiddleware em MIDDLEWARE e responde preflight OPTIONS diretamente (confirmado reproduzindo localmente: OPTIONS com Access-Control-Request-Method sobre HTTP puro em /api/accounts/ retorna 200 com headers de CORS, sem Location e sem Strict-Transport-Security); ordem de middleware pré-existente, não alterada pela story DW-4/DW-5 — preflight não carrega dado sensível, mas o comentário "força HTTPS para toda requisição" em prod.py não é literalmente exato para esse tráfego.
status: open

### DW-23: check --deploy --tag security no CI exclui checks de deploy não tagueados security
origin: review (fresh review pass, 3a) of spec-dw-4-dw-5-prod-settings-e-ci-hardening, 2026-07-31
location: .github/workflows/ci.yml (step "Checar settings de produção (deploy checks)")
severity: medium
reason: o step novo de DW-5 roda check --deploy --tag security, que cobre só checks de deploy tagueados security no Django; checks de deploy de outras tags (ex. async_checks.py registra E001 como Tags.async_support, deploy=True; caches.py registra W002 como Tags.caches, deploy=True — nenhum dos dois na tag security) não são exercitados por esse step, então um erro exclusivo de prod fora da tag security passaria despercebido pelo mesmo mecanismo que a DW-5 existe para fechar; sem impacto hoje (este repo não define CACHES customizado nem DJANGO_ALLOW_ASYNC_UNSAFE), mas o trade-off foi deliberado (na pass anterior, para viabilizar --fail-level WARNING sem ruído do SECRET_KEY dummy do CI) e vale revisitar se o projeto crescer nessas direções — decisão sobre quais tags de deploy adicionar não é mecânica.
status: open

### DW-24: health liveness check 401a com um Authorization header inválido presente
origin: review (fresh review pass) of spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard, 2026-08-03
location: backend/core/views.py (health)
severity: medium
reason: DW-15 corrigiu exatamente essa classe de bug em accounts/views.py::signup (@api_view sem authentication_classes próprio herda DEFAULT_AUTHENTICATION_CLASSES global, então um Authorization header malformado é rejeitado por um autenticador global antes mesmo da view rodar) mas o mesmo padrão (@api_view + permission_classes=[AllowAny] sem authentication_classes=[]) continua em core/views.py::health, fora do escopo desta bundle (o ledger nomeia só accounts/signup/token/token-refresh). Confirmado empiricamente (achado pela verification-gap review desta pass, 2026-08-03): GET /api/health/ com um header Authorization inválido retorna 401 em vez de 200, apesar do docstring da view dizer "no auth" — nenhum dos 2 testes existentes (core/tests/test_health.py::test_health_returns_ok, accounts/tests/test_views.py::test_health_sem_auth_retorna_200) envia um Authorization header, então o regressão fica invisível a ambos. Um probe de monitoramento/reverse proxy que encaminhe um bearer token velho/corrompido para o liveness check receberia um falso "unhealthy".
status: open

### DW-25: TokenRefreshSerializer.validate() pode 500ar em vez de 401ar se o usuário do token foi apagado do banco
origin: review (fresh review pass) of spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard, 2026-08-03
location: rest_framework_simplejwt/serializers.py:111-124 (TokenRefreshSerializer.validate); backend/core/exceptions.py (custom_exception_handler)
severity: medium
reason: achado pelo edge-case-hunter (2026-08-03) e confirmado lendo o código-fonte instalado do simplejwt: TokenRefreshSerializer.validate() chama get_user_model().objects.get(**{USER_ID_FIELD: user_id}) sem try/except em torno do .get() — se o usuário referenciado por um refresh token estruturalmente válido foi apagado do banco (diferente de apenas desativado, caso já coberto por test_token_refresh_usuario_desativado_retorna_401_sem_fields), a exceção User.DoesNotExist não é reconhecida por custom_exception_handler (não é APIException nem DomainError) e cai no fallback return None, virando o 500 padrão do Django em vez de um 401 documentado. Pré-existente, não introduzido pelo diff desta bundle (que só anota schema em torno das views de token, sem tocar TokenRefreshSerializer). Nenhum fluxo do app hoje apaga usuários de fato (só desativa via is_active=False) — o caminho só é alcançável por intervenção direta no banco/admin, por isso severity medium, não high.
status: open

### DW-26: Follow-up review still recommended for dw-accounts-schema-accuracy-drift-guard after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260731-134802-a244; this entry preserves the lingering recommendation for a deliberate later review.
status: done 2026-08-03
resolution: already resolved: The independent follow-up review this entry asked for already ran: DW-24 and DW-25 are both dated 2026-08-03 with origin 'review (fresh review pass) of spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard' -- the exact spec this entry names -- and that fresh pass is what surfaced them. The recommendation has been honored; its output is tracked as DW-24/DW-25, triaged separately in this same sweep.
