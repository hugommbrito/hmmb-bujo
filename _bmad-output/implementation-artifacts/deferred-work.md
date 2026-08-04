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
reason: mesmas violações axe de color-contrast e target-size (WCAG 2.5.8) em compact/tablet/reflow-320 que a 14.9 corrigiu localmente na página de Migração, sem tocar tokens compartilhados; confirmado rodando o teste axe da própria weekly-planning-ritual.spec.ts em compact contra o dev HEAD atual — falha com violações idênticas, pré-existente desde a 14.5, fora do Code Map da 14.9 (corrigir ali tocaria --ds-weekly-planning-source-rail/context-rail, tokens também consumidos por Monthly/Future); atribuído ao Épico 17 ou 18 na retrospectiva do Épico 14 (2026-07-28) para não virar dívida sem dono. ESCOPO AMPLIADO (2026-08-03, verificação do fix dos seletores de destino): o ritual MENSAL tem a MESMA violação, e ela não é só de compact/tablet/reflow — os 10 testes `axe sem exclude: main` de `weekly-planning-ritual.spec.ts` + `monthly-planning-ritual.spec.ts` falham nas 5 faixas (wide/medium/tablet/compact/reflow-320) com uma única violação `[serious] color-contrast` nos MESMOS 2 seletores (`.MuiButton-root.MuiButton-text.MuiButton-textPrimary` das linhas de decisão — "Alocar"/"Adiar ao Future Log" no Monthly, "Manter"/"Concluir" etc. no Weekly). Causa: `MuiButton` `text`+`primary` herda o teal de marca do tema, abaixo de AA sobre `--ds-surface` — o MESMO achado que `BrainDumpDestinationPicker.tsx` (:89-96) já contorna localmente com uma cor EXPLÍCITA em `RETRY_BUTTON_SX`. Confirmado PRÉ-EXISTENTE por A/B: `git stash push -u -- frontend` + rodar os testes axe reproduz as violações idênticas sem nenhuma mudança em árvore. O `target-size` é FLAKY por timing, também no baseline: numa única execução de `weekly-planning-ritual.spec.ts -g "axe sem exclude"` com a árvore limpa, a MESMA faixa (wide, e idem medium) acusou 1 violação (só `color-contrast`) em duas tentativas e 2 (`color-contrast` + `target-size`) na outra — a medição acontece logo após `toBeVisible()` do `main`, com o layout ainda assentando. Ao comparar contagens entre execuções, esperar 1–2 nas faixas wide/medium/tablet/reflow, não um número fixo. Correção natural: `MonthlyDecisionList.tsx`/`WeeklyDecisionList.tsx` deixarem de usar `MuiButton` text+primary cru, ou o tema ganhar um `primary` AA-safe na consolidação do Épico 18; e o gate esperar o layout assentar antes de medir, para o `target-size` parar de oscilar.
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
status: done 2026-08-04
resolution: fechada por decisão do dono do projeto, sem mudança de código — confiar em X-Forwarded-Proto via SECURE_PROXY_SSL_HEADER é a convenção portável entre reverse proxies (nginx, Caddy, ALB, Render, Fly, Heroku), enquanto a correção real (middleware de proxy confiável ou is_secure() condicionado ao Host) acoplaria o código à topologia do Railway; correção factual ao reason acima: a metade do HSTS está invertida — forjar o header faz is_secure() virar True, então o Django PULA o redirect e EMITE o Strict-Transport-Security (django/middleware/security.py:33-44), logo o ganho do atacante se limita a ter a própria request servida em texto claro, sem vítima terceira; fica assumido e NÃO medido se o edge do Railway substitui ou concatena o X-Forwarded-Proto do cliente — se concatenar, o Django lê o valor mais à esquerda (django/http/request.py:316-319) e o spoof passaria a ser alcançável da internet pública, o que reabre este item como bug em vez de postura.

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
decision: 2026-08-04 Adicionar um segundo step sem filtro de tag, em --fail-level ERROR — Manter intacto o step existente de .github/workflows/ci.yml:84-85 (`check --deploy --tag security --fail-level WARNING`) e acrescentar logo em seguida um segundo step que roda `check --deploy --fail-level ERROR --settings=config.settings.prod`, sem `--tag`. Isso passa a exercitar os 21 deploy checks — incluindo os que nao tem tag alguma, como o schema_check do drf_spectacular — sem reintroduzir o ruido de WARNING do SECRET_KEY dummy que motivou o escopo original, porque o nivel de falha e ERROR. Atualizar o comentario de ci.yml:76-83 para explicar a divisao de trabalho entre os dois steps (security a WARNING, todo o resto a ERROR) e registrar por que a combinacao existe, para a proxima pessoa nao colapsar os dois.

### DW-24: health liveness check 401a com um Authorization header inválido presente
origin: review (fresh review pass) of spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard, 2026-08-03
location: backend/core/views.py (health)
severity: medium
reason: DW-15 corrigiu exatamente essa classe de bug em accounts/views.py::signup (@api_view sem authentication_classes próprio herda DEFAULT_AUTHENTICATION_CLASSES global, então um Authorization header malformado é rejeitado por um autenticador global antes mesmo da view rodar) mas o mesmo padrão (@api_view + permission_classes=[AllowAny] sem authentication_classes=[]) continua em core/views.py::health, fora do escopo desta bundle (o ledger nomeia só accounts/signup/token/token-refresh). Confirmado empiricamente (achado pela verification-gap review desta pass, 2026-08-03): GET /api/health/ com um header Authorization inválido retorna 401 em vez de 200, apesar do docstring da view dizer "no auth" — nenhum dos 2 testes existentes (core/tests/test_health.py::test_health_returns_ok, accounts/tests/test_views.py::test_health_sem_auth_retorna_200) envia um Authorization header, então o regressão fica invisível a ambos. Um probe de monitoramento/reverse proxy que encaminhe um bearer token velho/corrompido para o liveness check receberia um falso "unhealthy".
status: done 2026-08-03
resolution: resolved by sweep bundle dw-core-auth-error-handling-fixes

### DW-25: TokenRefreshSerializer.validate() pode 500ar em vez de 401ar se o usuário do token foi apagado do banco
origin: review (fresh review pass) of spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard, 2026-08-03
location: rest_framework_simplejwt/serializers.py:111-124 (TokenRefreshSerializer.validate); backend/core/exceptions.py (custom_exception_handler)
severity: medium
reason: achado pelo edge-case-hunter (2026-08-03) e confirmado lendo o código-fonte instalado do simplejwt: TokenRefreshSerializer.validate() chama get_user_model().objects.get(**{USER_ID_FIELD: user_id}) sem try/except em torno do .get() — se o usuário referenciado por um refresh token estruturalmente válido foi apagado do banco (diferente de apenas desativado, caso já coberto por test_token_refresh_usuario_desativado_retorna_401_sem_fields), a exceção User.DoesNotExist não é reconhecida por custom_exception_handler (não é APIException nem DomainError) e cai no fallback return None, virando o 500 padrão do Django em vez de um 401 documentado. Pré-existente, não introduzido pelo diff desta bundle (que só anota schema em torno das views de token, sem tocar TokenRefreshSerializer). Nenhum fluxo do app hoje apaga usuários de fato (só desativa via is_active=False) — o caminho só é alcançável por intervenção direta no banco/admin, por isso severity medium, não high.
status: done 2026-08-03
resolution: resolved by sweep bundle dw-core-auth-error-handling-fixes

### DW-26: Follow-up review still recommended for dw-accounts-schema-accuracy-drift-guard after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260731-134802-a244; this entry preserves the lingering recommendation for a deliberate later review.
status: done 2026-08-03
resolution: already resolved: The independent follow-up review this entry asked for already ran: DW-24 and DW-25 are both dated 2026-08-03 with origin 'review (fresh review pass) of spec-dw-11-dw-12-dw-14-dw-15-accounts-schema-accuracy-drift-guard' -- the exact spec this entry names -- and that fresh pass is what surfaced them. The recommendation has been honored; its output is tracked as DW-24/DW-25, triaged separately in this same sweep.

### DW-31: JWTAuthentication.get_user distingue usuário apagado de desativado em TODA rota autenticada, anulando a indistinguibilidade que a DW-25 construiu no refresh
origin: review (fresh review pass) of spec-dw-24-dw-25-core-auth-error-handling-fixes, 2026-08-03
location: rest_framework_simplejwt/authentication.py:120-139 (JWTAuthentication.get_user); superfície do projeto: backend/core/authentication.py (TenantAwareJWTAuthentication)
severity: medium
reason: achado pelo blind-hunter (2026-08-03) e confirmado por mim lendo o simplejwt instalado — JWTAuthentication.get_user levanta AuthenticationFailed(_("User not found"), code="user_not_found") quando a linha do usuário foi apagada e AuthenticationFailed(_("User is inactive"), code="user_inactive") quando ela existe mas está inativa: mensagem distinta E código distinto, em toda request autenticada por TenantAwareJWTAuthentication (que herda esse get_user). A DW-25 gastou trabalho real para tornar os dois 401 de POST /api/accounts/token/refresh/ indistinguíveis em status, corpo e header WWW-Authenticate (convenção do spine: nunca expor existência/inexistência de linha), mas quem tem um access token ainda válido — isto é, qualquer um que acabou de obter o refresh token que replayaria — distingue os dois casos trivialmente em qualquer outro endpoint. Pré-existente e fora do escopo da DW-25 (cujo intent nomeia só o handler central e a rota de refresh): fechar isso exige decidir a política no autenticador, não no exception handler, e provavelmente sobrescrever get_user em TenantAwareJWTAuthentication para colapsar os dois ramos num só AuthenticationFailed. Decisão de produto embutida: se a propriedade de indistinguibilidade importa, ela vale projeto-inteiro e este é o furo principal; se não importa, então _authenticate_header e metade do teste de paridade da DW-25 são complexidade não-ganha. Nenhum teste hoje asseve nada sobre a distinção nessa superfície.
status: open

### DW-32: os três ramos de resposta construída à mão em custom_exception_handler não chamam set_rollback(), que o handler default do DRF sempre chama
origin: review (fresh review pass) of spec-dw-24-dw-25-core-auth-error-handling-fixes, 2026-08-03
location: backend/core/exceptions.py (ramos TenantScopeViolation, DomainError e User.DoesNotExist do custom_exception_handler)
severity: medium
reason: achado pelo blind-hunter (2026-08-03) e confirmado por mim no DRF instalado — rest_framework/views.py:99 chama set_rollback() imediatamente antes de devolver a resposta, exatamente para que uma exceção dentro de um bloco ATOMIC_REQUESTS não deixe escrita parcial commitada. Os três ramos que constroem Response à mão em custom_exception_handler devolvem sem essa chamada, então herdam o footgun. LATENTE, não vivo: ATOMIC_REQUESTS não está setado em lugar nenhum de backend/config/ (grep vazio), logo hoje não há transação por request para rolar de volta. Pré-existente em 2 dos 3 ramos (TenantScopeViolation e DomainError antecedem a DW-25); a DW-25 só adicionou a terceira instância do mesmo padrão, e corrigir só o ramo novo deixaria a inconsistência pior do que está. Vale uma correção única nos três de uma vez, junto com um teste que prove o rollback — e vale ANTES de qualquer decisão de ligar ATOMIC_REQUESTS, porque é exatamente aí que o latente vira perda de dados silenciosa.
status: open

### DW-33: o contrato do import-linter da regra de porta do core omite o app automation, então core -> automation passaria o gate verde
origin: review (fresh review pass) of spec-dw-24-dw-25-core-auth-error-handling-fixes, 2026-08-04
location: backend/pyproject.toml:59-63 (contrato "core must not import domain apps (port rule)")
severity: medium
reason: achado pela verification-gap review (2026-08-04) e confirmado por mim — forbidden_modules lista bujo, habits, health, medications, gratitude, braindump e para aí, mas INSTALLED_APPS em config/settings/base.py:46-55 inclui automation, que é app de domínio de verdade (models.AutomationToken com FK para AUTH_USER_MODEL, mais views). O comentário logo acima do próprio contrato manda literalmente "When a new domain app is created, add its package name to forbidden_modules below": foi esquecido quando o app nasceu, então hoje o gate que a Verification de várias stories cita como prova da regra de porta é estruturalmente incapaz de ver esse import. core não importa automation hoje (grep vazio em backend/core/), logo a correção é de uma linha e o gate segue verde depois dela (uv run lint-imports continuaria "1 kept, 0 broken") — vale conferir de passagem se algum outro app instalado também ficou de fora. Pré-existente e fora do escopo da bundle DW-24/DW-25, cujo intent não fala do contrato de import. Nota para quem pegar isto: a ausência de accounts na lista é DELIBERADA e documentada (core -> accounts é permitido, ver docstring de UserHoliday e core/calendar.py); só automation é omissão.
status: open

### DW-34: /api/schema/ e /api/schema/swagger-ui/ 401am com um Authorization header inválido presente — mesma classe de bug que DW-15 e DW-24 corrigiram uma view por vez
origin: review (fresh review pass) of spec-dw-24-dw-25-core-auth-error-handling-fixes, 2026-08-04
location: backend/config/settings/base.py (SPECTACULAR_SETTINGS, sem SERVE_AUTHENTICATION) — rotas registradas em backend/config/urls.py:32-36
severity: medium
reason: promovido ao ledger em 2026-08-04. Estava registrado apenas no frontmatter deferred: da spec-dw-24-dw-25 desde a primeira review pass (2026-08-03) e nunca chegou a este arquivo, então sobreviveu a três passes invisível para a varredura — é por isso que entra aqui agora, não porque seja achado novo. Reproduzido independentemente por dois reviewers nesta pass e medido a cada vez: GET /api/schema/ sem header -> 200; com Authorization: Bearer garbage -> 401 {"detail": "Given token not valid for any token type", "fields": {"code": [...]}}; com bearer válido -> 200. GET /api/schema/swagger-ui/ -> 200 sem header, 401 com o header inválido. (Um reviewer alegou 500 no swagger-ui por InvalidToken escapando no render do template; NÃO reproduziu — o que se mediu foram 401 nas duas rotas.) Causa: drf_spectacular/settings.py tem SERVE_AUTHENTICATION = None, que faz as views caírem em api_settings.DEFAULT_AUTHENTICATION_CLASSES (TenantAwareJWTAuthentication), e SPECTACULAR_SETTINGS em config/settings/base.py não sobrescreve a chave — exatamente o mecanismo que DW-15 corrigiu em accounts/views.py::signup e DW-24 em core/views.py::health. As rotas são registradas sem gate de DEBUG, logo valem em produção. Correção provável sem tocar settings globais de DRF: SPECTACULAR_SETTINGS["SERVE_AUTHENTICATION"] = []. Sem cobertura: nenhum dos 3 testes de core/tests/test_api_contract.py:63-93 envia Authorization, nada toca /api/schema/swagger-ui/, e o step de schema do CI usa manage.py spectacular (management command), que nunca passa pelo caminho HTTP de autenticação — o teste que falta é o espelho de test_health_com_authorization_header_invalido_retorna_200 para as duas rotas.
status: open

### DW-35: nada impede a próxima recorrência de @api_view + AllowAny sem authentication_classes([]) — as duas function-based views do repo tiveram o bug, em DWs consecutivas
origin: review (fresh review pass) of spec-dw-24-dw-25-core-auth-error-handling-fixes, 2026-08-04
location: backend/core/tests/ (meta-teste ausente) — instâncias em backend/accounts/views.py:79 (DW-15) e backend/core/views.py:11 (DW-24); terceira instância nas rotas de schema (DW-34)
severity: medium
reason: promovido ao ledger em 2026-08-04. Como a DW-34, estava só no frontmatter deferred: da spec-dw-24-dw-25 desde 2026-08-03 e nunca chegou a este arquivo. Achado pelo blind-hunter e re-achado nesta pass: @api_view aparece exatamente 2x em backend/ (accounts/views.py:79, core/views.py:11) e ambas precisaram do mesmo one-liner, em DWs consecutivas — 100% de taxa de defeito na classe — e as rotas de schema da DW-34 são uma terceira instância do mesmo mecanismo (rota pública que herda o autenticador JWT global e passa a 401ar com um Authorization velho). Cada correção até aqui foi um patch pontual de decorator. Um guarda sistêmico barato fecharia a classe inteira de uma vez: um meta-teste caminhando pelo ROOT_URLCONF e afirmando que toda rota alcançável sem credenciais continua não-401 diante de um bearer inválido, ou um helper compartilhado @public_api_view. Deliberadamente fora do escopo da DW-24, cujo intent pede nominalmente "the same one-line @authentication_classes([]) pattern" e cuja spec proíbe tocar DEFAULT_AUTHENTICATION_CLASSES/DEFAULT_PERMISSION_CLASSES globais.
status: open

### DW-36: o interceptor de 401 do frontend (client.ts) não tem guarda de _retry, então um 401 determinístico com refresh saudável entra em loop ilimitado de refresh+retry
origin: review (fresh review pass) of spec-dw-24-dw-25-core-auth-error-handling-fixes, 2026-08-04
location: frontend/src/api/client.ts:25-59
severity: medium
reason: promovido ao ledger em 2026-08-04. Como DW-34 e DW-35, estava só no frontmatter deferred: da spec-dw-24-dw-25 desde 2026-08-03 e nunca chegou a este arquivo. Achado pelo blind-hunter e confirmado lendo frontend/src/api/client.ts:25-59: o interceptor reenvia a request original via client(originalRequest), que passa pelo MESMO interceptor; só há early-return para a própria rota de refresh, nenhuma marca de tentativa na request replayada. Contraria a regra do ARCHITECTURE-SPINE ("401 concorrentes aguardam e fazem retry 1x"), logo é desvio pré-existente de arquitetura no frontend, não algo introduzido pela DW-25. LATENTE, não vivo: o gatilho alegado (um User.DoesNotExist escapando de um endpoint qualquer virar 401 em vez de 500) não existe hoje — grep por User.objects.get / get_user_model().objects.get fora de .venv e de tests/ não retorna call site nenhum em backend/, e o único produtor real da exceção é o TokenRefreshSerializer do simplejwt, cuja rota é justamente a que o interceptor já trata com early-return. Detalhe novo desta pass: o teste que parece ser o guarda (frontend/src/api/client.test.ts:189, "retry com novo token retornando 401 -> logout chamado") só termina porque o mock zera getRefreshToken() na segunda passagem — ele fabrica a condição de saída que produção não tem, então não é evidência de que o loop seja limitado.
status: open

### DW-27: "Mover tarefa" do TaskDetailCard segue morto no Weekly Board e no Monthly Board
origin: split from spec-fix-seletores-de-destino-fora-da-viewport-no-sistema-novo (2026-08-03)
location: frontend/src/pages/planner/WeeklyBoardPage.tsx (~linha 385); frontend/src/pages/planner/MonthlyBoardPage.tsx (~linha 416)
severity: medium
reason: as duas páginas renderizam `<TaskDetailCard>` sem passar a prop opcional `onMove`, então o botão "Mover tarefa" (TaskDetailCard.tsx:316-320) aparece e o clique não faz nada — clique morto silencioso confirmado em dev pelo usuário (2026-08-03). Gap DELIBERADO desde as Stories 14.5/14.6, documentado no cabeçalho de MonthlyBoardPage.tsx (:24-26) e no comentário de frontend/e2e/move-task.spec.ts (:173-193), que mantém 4 testes E2E vermelhos "até uma decisão de produto sobre wireup de onMove nos boards novos". A decisão de produto FOI TOMADA em 2026-08-03 (usuário: cablear), mas o trabalho foi separado desta spec por tamanho: o seletor de destino novo (DestinationDialog) é pré-requisito e nasce na passada 1. Ao retomar: os 4 testes E2E vermelhos precisam ser REESCRITOS, não só reabilitados — eles dependem de um botão "Mover tarefa" na LINHA (getByTestId('task-row')) e do diálogo legado `name: 'Migrar Tarefa'` com abas, anatomia que o sistema novo não tem; o caminho real é detalhe da tarefa -> seletor novo. Regra de domínio a respeitar no Monthly: `destination` é 'month' quando o mês em foco é o corrente e 'future' (+ monthFirst) caso contrário, e o contrato de POST /migrate/ não suporta mês-alvo já passado (Questão aberta #5 da Story 14.6). O pré-requisito FOI ENTREGUE em 2026-08-03: `frontend/src/features/bujo/components/DestinationDialog.tsx` (`Dialog` portalizado no não-compact, `Drawer` no compact) com o contrato `onConfirm(scheduledDate, meta)` — o gancho por onde esta entrada estende. ATENÇÃO ao retomar: por decisão de review (2026-08-03, "superfície especulativa não conta como cobertura") o diálogo ficou com SÓ as duas formas de oferta que têm consumidor hoje (`week` e `month`) e UMA oferta por vez; as formas `none` (destino "Hoje", sem dia) e `month-choice` (destino "Futuro", mês escolhido pelo usuário), o radiogroup de destinos nomeados e os ícones de `navIconFor` foram REMOVIDOS por não terem chamador. DW-27 vai reintroduzi-las — extensão ADITIVA de props (`offer` volta a ser uma lista, `DestinationDayOffer` ganha as 2 variantes), sem quebrar o contrato de `onConfirm`. A anatomia removida está no histórico do git (primeira passada desta spec) para servir de molde.
status: open

### DW-28: `npx tsc -b --noEmit` está VERMELHO no baseline por drift do schema gerado em BrainDumpDestinationPicker
origin: verification of spec-fix-seletores-de-destino-fora-da-viewport-no-sistema-novo (2026-08-03)
location: frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:113; frontend/src/api/types.gen.ts:1505 (BlankEnum), :1539 (BrainDumpItem.targetLog)
severity: medium
reason: `npx tsc -b --noEmit` falha com um único erro TS2345 em `BrainDumpDestinationPicker.tsx:113` (`useState<BrainDumpTargetLog | null>(item.targetLog)`): `BrainDumpItem.targetLog` no schema gerado é `TargetLogEnum | BlankEnum | NullEnum | null`, e `BlankEnum` é a string vazia `""`, que não pertence a `BrainDumpTargetLog` (= `TargetLogEnum`). PRÉ-EXISTENTE e confirmado empiricamente com `git stash push -u -- frontend` + `npx tsc -b --force --noEmit` (o erro persiste sem nenhuma mudança em árvore). Drift de regeneração, não bug de lógica: `types.gen.ts` foi regenerado pelo commit 22e3c2f (sweep dw-accounts-schema-accuracy-drift-guard, 2026-08-03) DEPOIS de `BrainDumpDestinationPicker.tsx` nascer no 7615468 (story 15.1), e ninguém rodou o typecheck em seguida. Invisível ao vitest (esbuild não type-checa) e ao eslint (regra de tipo não cobre isto), então só o gate de `tsc` acusa. Ao corrigir: decidir se o estado inicial aceita `''` (normalizar para `null` na leitura) ou se o serializer deve deixar de emitir `blank`; a spec do fix dos seletores de destino proíbe explicitamente tocar `BrainDumpDestinationPicker.tsx`, por isso ficou fora daquela passada.
status: done 2026-08-04
resolution: already resolved: resolvido pelo commit e346362 (2026-08-03, "fix(braindump): targetLog vazio quebra o typecheck do seletor de destino", contido em dev): BrainDumpDestinationPicker.tsx:119 agora usa `useState<BrainDumpTargetLog | null>(item.targetLog || null)` com comentario explicativo em :113-118; `npx tsc -b --force --noEmit` rodado nesta varredura em dev@0d0566c sai com EXIT_CODE=0 e zero output (o gate de CI e .github/workflows/ci.yml:142-143 `npm run typecheck`), logo o TS2345 descrito nao existe mais; types.gen.ts ficou intacto (a correcao foi no consumidor, nao por regeneracao).

### DW-29: WeeklyDestinationPicker virou código morto em produção (mantido deliberadamente)
origin: split from spec-fix-seletores-de-destino-fora-da-viewport-no-sistema-novo (2026-08-03)
location: frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.tsx; frontend/src/features/bujo/components/weekly/WeeklyDestinationPicker.test.tsx
severity: low
reason: `WeeklyPlanningPage` era o ÚNICO consumidor e passou a usar `DestinationDialog` (fix dos seletores fora da viewport, 2026-08-03). O arquivo ficou sem nenhum import de produção — só o próprio teste e `weekly/noLiteralTokens.test.ts` ainda o referenciam —, e foi MANTIDO de propósito: a spec daquela passada proíbe deletá-lo ("Never"), e manter o par componente+teste verdes preserva a possibilidade de rollback do call-site. Diferente do irmão `monthly/MonthlyDestinationPicker.tsx`, que continua VIVO servindo `FutureBoardPage.tsx:470` e não deve ser removido. Ao retomar (candidato natural: a limpeza de legado do Épico 18): remover o componente, o seu teste e a entrada em `weekly/noLiteralTokens.test.ts` juntos, depois de confirmar que nenhum consumidor novo apareceu.
status: open

### DW-30: O defeito `if (!compact) return content` (seletor abre fora da viewport no desktop) segue VIVO em duas superfícies não migradas
origin: review (3 camadas) of spec-fix-seletores-de-destino-fora-da-viewport-no-sistema-novo, 2026-08-03
location: frontend/src/features/bujo/components/monthly/MonthlyDestinationPicker.tsx:354 (renderizado por frontend/src/pages/planner/FutureBoardPage.tsx:470); frontend/src/features/bujo/components/DestinationPicker.tsx:423 (renderizado por frontend/src/pages/MigrationRitualPage.tsx:407)
severity: medium
reason: é EXATAMENTE a mesma causa raiz que a spec acima corrigiu nos dois rituais de planejamento — sem `Dialog` do MUI no ramo não-compact, o seletor entra no fluxo normal do DOM e pode abrir abaixo da dobra, produzindo o sintoma "clico e nada acontece" relatado pelo usuário em 2026-08-03. As duas superfícies estavam na lista Never da spec (não reportadas como quebradas, testes verdes), então ficaram fora de escopo de propósito — mas nenhuma entrada da ledger registrava o defeito remanescente: DW-27 é sobre o wireup do `onMove` e DW-29 é sobre o arquivo morto do Weekly. Os testes dessas duas superfícies usam exatamente o assert de PRESENÇA que a spec acima declarou insuficiente (`getByRole('dialog', { name: 'Escolher destino' })` em FutureBoardPage.test.tsx:393,442 e MigrationRitualPage.test.tsx:196-218,302), logo o defeito pode existir com a suíte verde. Ao migrar: reusar o assert estrutural (`closest('.MuiDialog-root')` / portal) que DestinationDialog.test.tsx introduziu, senão a regressão volta invisível.
status: open
