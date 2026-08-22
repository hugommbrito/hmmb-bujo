---
title: 'DW-4/DW-5: hardening de prod.py e validação do caminho de produção no CI'
type: 'chore'
created: '2026-07-31'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['multiple-goals']
deferred:
  - summary: >-
      A nota de conhecimento `_knowledge/06-Quality/Risks/Riscos técnicos.md` ainda lista DW-4/DW-5
      como riscos abertos, verbatim, mas é um espelho derivado de `deferred-work.md` (mesmo
      `source_files`/`source_updated` no frontmatter) — fora do escopo deste run, que foi
      instruído a não editar o ledger; a atualização dessa nota deve seguir o mesmo processo que
      resolve o ledger.
    evidence: |-
      Confirmado por leitura direta: `_knowledge/06-Quality/Risks/Riscos técnicos.md` linha 22 cita
      "Hardening de produção registrado como incompleto: redirecionamento HTTPS e HSTS precisam ser
      revistos antes do primeiro deploy" e uma entrada equivalente para DW-5, ambas agora resolvidas
      por este diff.
    location: >-
      _knowledge/06-Quality/Risks/Riscos técnicos.md:22
    severity: low
  - summary: >-
      SECURE_HSTS_SECONDS/INCLUDE_SUBDOMAINS/PRELOAD entraram em um único passo, sem rollout
      escalonado (max-age curto primeiro) — antes do primeiro deploy real com usuários, o risco
      prático é zero, mas isso muda no lançamento do Épico 10.
    evidence: |-
      HSTS com preload é efetivamente irreversível para navegadores que já visitaram o domínio;
      o próprio intent nota que ainda não houve deploy com usuário real, então hoje não há
      navegador nenhum com esse header cacheado — mas vale revisitar o max-age antes do Épico 10.
    location: >-
      backend/config/settings/prod.py
    severity: medium
  - summary: >-
      `CorsMiddleware` roda antes de `SecurityMiddleware` em `MIDDLEWARE` e responde
      preflight `OPTIONS` diretamente, então esse tráfego nunca passa pelo redirect
      HTTPS/HSTS novo — "força HTTPS para toda requisição" não é literalmente
      verdade para preflight, ainda que sem dado sensível nesse tipo de requisição.
    evidence: |-
      Confirmado: `backend/config/settings/base.py` lista `corsheaders.middleware.CorsMiddleware`
      antes de `django.middleware.security.SecurityMiddleware` em `MIDDLEWARE`; reproduzido
      localmente que um `OPTIONS` com `Access-Control-Request-Method` sobre HTTP puro em
      `/api/accounts/` retorna 200 com headers de CORS, sem `Location` e sem
      `Strict-Transport-Security` — o pipeline nunca chega em `SecurityMiddleware`. Ordem de
      middleware pré-existente, não alterada por este diff.
    location: >-
      backend/config/settings/base.py (MIDDLEWARE)
    severity: low
  - summary: >-
      O redirect/HSTS novos dependem inteiramente de `SECURE_PROXY_SSL_HEADER` (pré-existente,
      não tocado por este diff) para decidir se uma requisição é "segura"; `RAILWAY_PRIVATE_DOMAIN`
      já está em `ALLOWED_HOSTS` em `prod.py`, então qualquer origem capaz de alcançar o
      container pela rede privada do Railway poderia forjar `X-Forwarded-Proto: https` e
      derrubar o hardening inteiro (sem redirect, sem header HSTS).
    evidence: |-
      Confirmado em código: `backend/config/settings/prod.py` adiciona `RAILWAY_PRIVATE_DOMAIN`
      a `ALLOWED_HOSTS` e usa `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`
      (ambos pré-existentes). Não foi verificado neste run se a rede privada do Railway é de
      fato alcançável por algo além dos próprios serviços do mesmo projeto — vale investigar
      antes de tratar como confirmado.
    location: >-
      backend/config/settings/prod.py (SECURE_PROXY_SSL_HEADER, ALLOWED_HOSTS)
    severity: medium
  - summary: >-
      O gate de CI `check --deploy --tag security` cobre só os checks de deploy tagueados
      `security`; checks de deploy de outras tags (ex. `async_support.E001`, `caches.W002`) não
      são exercitados por esse step, então um erro exclusivo de prod fora da tag `security`
      passaria despercebido pelo mesmo mecanismo que a DW-5 existe para fechar.
    evidence: |-
      Confirmado em código-fonte do Django: `async_checks.py` registra `E001` como
      `@register(Tags.async_support, deploy=True)` e `caches.py` registra `W002` como
      `@register(Tags.caches, deploy=True)` -- ambos "deploy-only" mas fora da tag `security`,
      logo excluídos por `--tag security`. Sem impacto hoje: este repo não define `CACHES` (usa o
      default `LocMemCache`, que não dispara W002) nem `DJANGO_ALLOW_ASYNC_UNSAFE` (E001 nunca
      dispara). `--tag security` foi escolhido deliberadamente na pass anterior para viabilizar
      `--fail-level WARNING` sem ruído do `SECRET_KEY` dummy do CI (que dispara `security.W009`
      sem o filtro de tag) -- estreitar esse trade-off exigiria decisão sobre quais tags de
      deploy adicionar, não é mecânico.
    location: >-
      .github/workflows/ci.yml (step "Checar settings de produção (deploy checks)")
    severity: medium
baseline_revision: '79d46d4498687d7beb5c679352f801a2be64b08d'
final_revision: '6db91f45d5ebaaa744fc43505b5ee8e8434a9aef'
---

<intent-contract>

## Intent

**Problem:** `backend/config/settings/prod.py` não define `SECURE_SSL_REDIRECT`/`SECURE_HSTS_*` (Django `check --deploy` emite `security.W004`/`W008`), e `.github/workflows/ci.yml` só roda contra `config.settings.dev`, então erros exclusivos de prod e drift de migração passam despercebidos.

**Approach:** completar `prod.py` com o trio HSTS + `SECURE_SSL_REDIRECT`, isentando explicitamente `api/health/` do redirect (Railway bate no container via rede interna, sem `X-Forwarded-Proto`); acrescentar dois steps no job `backend` do CI que carregam `config.settings.prod` (`check --deploy` e `makemigrations --check --dry-run`).

## Boundaries & Constraints

**Always:** `api/health/` deve continuar respondendo 200 (não 301) sobre HTTP puro após `SECURE_SSL_REDIRECT=True` — é o healthcheck do Railway, sem `X-Forwarded-Proto`. Os dois novos steps de CI reusam `SECRET_KEY`/`ALLOWED_HOSTS`/`DATABASE_URL` já definidos no `env:` do job `backend` (via `--settings=config.settings.prod` no comando, sem `env:` extra). As duas mudanças (prod.py e ci.yml) andam juntas: o step de CI é o que impede a regressão do hardening.

**Block If:** _nenhum — mudança mecânica, sem decisão que exija humano._

**Never:** não usar `--fail-level` no `check --deploy` (o `SECRET_KEY` dummy do CI sempre disparará `security.W009`, o que tornaria o step permanentemente vermelho por um motivo não relacionado). Não tocar `SESSION_COOKIE_SECURE`/`CSRF_COOKIE_SECURE`/`SECURE_PROXY_SSL_HEADER` (já corretos). Não tocar `dev.py`/`test.py`/`e2e.py`. Não editar `docs/CIandDeploymentLogs.md` (dump histórico, não doc viva). Não editar `deferred-work.md` (o orquestrador registra a resolução).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Healthcheck do Railway | `GET /api/health/`, `Host: healthcheck.railway.app`, sem `X-Forwarded-Proto` | 200 `{"status":"ok"}`, sem redirect | Nunca falha |
| Qualquer outro path em prod, HTTP puro | `GET /api/accounts/...` sem `X-Forwarded-Proto` | 301 para `https://` | N/A |
| CI: drift de migração | model mudou, migration não gerada | `makemigrations --check --dry-run --settings=config.settings.prod` sai com código 1 | job `backend` falha |
| CI: erro de import/config exclusivo de prod | `prod.py` levanta erro ao carregar | `check --deploy --settings=config.settings.prod` sai não-zero | job `backend` falha |

</intent-contract>

## Code Map

- `backend/config/settings/prod.py:35-38` -- bloco existente (`SECURE_PROXY_SSL_HEADER`, cookies secure); os 5 settings novos entram logo depois, antes do bloco `LOGGING`.
- `backend/core/views.py:13-15` -- `health()`: liveness sem auth/DB, `AllowAny`, `@extend_schema(exclude=True)`.
- `backend/config/urls.py:11` -- `path("api/health/", health, name="health")` -- path literal usado no regex de `SECURE_REDIRECT_EXEMPT`.
- `.venv/lib/.../django/middleware/security.py:22,26` (referência, não editar) -- `SecurityMiddleware` casa `SECURE_REDIRECT_EXEMPT` contra `request.path.lstrip("/")` via `pattern.search()` — confirma que `r"^api/health/$"` isenta exatamente esse path.
- `backend/config/settings/base.py:17-26` -- `SECRET_KEY`/`ALLOWED_HOSTS`/`DATABASE_URL` via `env()`; já vêm do `env:` do job CI, `prod.py` não precisa de nada novo para carregar.
- `.github/workflows/ci.yml:8-11` -- comentário de escopo no topo do arquivo, já lista extensões por story (import-linter 1.2, types.gen.ts 1.4); acrescentar uma linha.
- `.github/workflows/ci.yml:65-68` -- entre o step `Pytest` e `Set up Node`: onde entram os dois novos steps.
- `core/tests/test_health.py` -- padrão existente de teste da view; o teste novo de settings entra em `core/tests/` ao lado.
- Confirmado localmente: `check --deploy --settings=config.settings.prod` hoje sai com `security.W004`+`W008`+`W009` (warnings, exit 0); `makemigrations --check --dry-run --settings=config.settings.prod` hoje sai "No changes detected" (exit 0) mesmo sem a tabela `django_migrations` existir no DB do step (usa os arquivos de migration em disco, não introspecção de schema).

## Tasks & Acceptance

**Execution:**
- `backend/config/settings/prod.py` -- adicionar `SECURE_SSL_REDIRECT = True`, `SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]`, `SECURE_HSTS_SECONDS = 31536000`, `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`, `SECURE_HSTS_PRELOAD = True` -- fecha DW-4; a isenção evita que o healthcheck interno do Railway (sem `X-Forwarded-Proto`) receba 301 e quebre o rollout do deploy.
- `backend/core/tests/test_prod_settings.py` (novo) -- importar `config.settings.prod` diretamente e checar os 5 valores + que `SECURE_REDIRECT_EXEMPT` de fato casa `"api/health/"` via `re.search` -- guarda de regressão, já que nada mais na suíte importa esse módulo.
- `.github/workflows/ci.yml` -- dois novos steps no job `backend`, entre `Pytest` e `Set up Node`: `Checar settings de produção (deploy checks)` rodando `uv run python manage.py check --deploy --settings=config.settings.prod`; `Checar migrations pendentes (settings de produção)` rodando `uv run python manage.py makemigrations --check --dry-run --settings=config.settings.prod` -- fecha DW-5.
- `.github/workflows/ci.yml:8-11` -- acrescentar uma cláusula ao comentário de escopo registrando esta extensão (consistente com o histórico já documentado ali).

**Acceptance Criteria:**
- Given o CI roda o job `backend`, when os steps novos executam, then ambos saem com código 0 no estado atual do repo (sem drift, sem erro de import).
- Given um model muda sem gerar migration, when `makemigrations --check --dry-run --settings=config.settings.prod` roda, then o step falha (exit ≠ 0).
- Given uma requisição HTTP pura em `api/health/` em prod, when `SECURE_SSL_REDIRECT=True` está ativo, then a resposta é 200, não 301.
- Given `manage.py check --deploy --tag security --fail-level WARNING --settings=config.settings.prod` (flags endurecidos na pass de revisão de 2026-07-31, ver Review Triage Log), then o step sai com código 0 no estado atual — `security.W004`/`W008` não aparecem mais na saída, e `W009` também não (o `SECRET_KEY` dummy do CI foi fortalecido para não disparar essa checagem).

## Spec Change Log

_Vazio — nenhum loopback `bad_spec` ocorreu nesta run._

## Review Triage Log

### 2026-07-31 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5 (high 0, medium 2, low 3)
- defer: 2 (high 0, medium 1, low 1)
- reject: 2 (high 0, medium 0, low 2)
- addressed_findings:
  - `[medium]` `[patch]` O step novo `check --deploy --settings=config.settings.prod` (sem `--fail-level`) saía com exit 0 mesmo com as 5 linhas de hardening da DW-4 removidas — confirmado empiricamente antes e depois do fix. Corrigido: `SECRET_KEY` dummy do CI fortalecido para ≥50 chars/≥5 chars únicos (não dispara mais `security.W009`), e o comando passou a usar `--tag security --fail-level WARNING`, tornando-o um gate real (verificado: exit 1 com o hardening removido, exit 0 no estado atual).
  - `[medium]` `[patch]` Nenhum teste exercitava o caminho "seguro" real (tráfego via proxy do Railway com `X-Forwarded-Proto: https`) nem confirmava a presença do header `Strict-Transport-Security`. Corrigido: novo teste `test_secure_request_via_trusted_proxy_is_not_redirected_and_gets_hsts_header`, incluindo `SECURE_PROXY_SSL_HEADER` no override.
  - `[low]` `[patch]` `test_other_paths_redirect_to_https_under_prod_hardening` só checava o prefixo `https://` do `Location`. Corrigido: assert do valor exato (`https://testserver/api/accounts/`).
  - `[low]` `[patch]` O path isento (`api/health/`) estava hardcoded como string literal em dois lugares, independente do `urls.py` real. Corrigido: uso de `reverse("health")`.
  - `[low]` `[patch]` Nenhum teste provava que o regex de isenção é ancorado (não é prefix match). Corrigido: novo teste `test_exempt_pattern_is_anchored_not_a_prefix_match` com `api/health/extra` e `api/healthcheck/` como near-miss.

### 2026-07-31 — Review pass (fresh, pós-`done`)
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 0, medium 1, low 3)
- defer: 2 (high 0, medium 1, low 1)
- reject: 9 (high 0, medium 0, low 9)
- addressed_findings:
  - `[medium]` `[patch]` `railway.toml`'s `healthcheckPath` e `SECURE_REDIRECT_EXEMPT` em `prod.py` eram duas strings mantidas à mão sem fonte única de verdade — um drift futuro entre elas redirecionaria (301) o healthcheck do Railway e travaria o rollout, sem nenhum teste que capturasse isso. Corrigido: novo teste `test_redirect_exempt_pattern_matches_railway_healthcheck_path`, que lê `railway.toml` via `tomllib` e confirma que o padrão de isenção casa o `healthcheckPath` real.
  - `[low]` `[patch]` Docstring do arquivo de teste novo (`test_prod_settings.py`) afirmava que o pytest "roda sob `config.settings.test`" sem qualificar o caso do CI — verificado que o job `backend` do CI sobrescreve isso via `DJANGO_SETTINGS_MODULE=config.settings.dev` no `env:` (o próprio `pyproject.toml` já documenta essa sobrescrita). Corrigido: docstring agora distingue execução local (`config.settings.test`) de CI (`config.settings.dev`).
  - `[low]` `[patch]` `test_other_paths_redirect_to_https_under_prod_hardening` usava `/api/accounts/` sem explicar a escolha, acoplando o teste a uma rota real que não precisa resolver (o redirect do `SecurityMiddleware` acontece antes da resolução de URL). Corrigido: docstring esclarece que o path é arbitrário.
  - `[low]` `[patch]` O critério de aceite sobre `check --deploy` em `## Tasks & Acceptance` ainda descrevia o estado pré-reconciliação da pass anterior (`W009` ainda disparando, sem `--fail-level`), divergindo do comportamento final já registrado no Review Triage Log de 2026-07-31 (pass anterior). Corrigido: texto do critério atualizado para refletir `--tag security --fail-level WARNING` e a ausência de qualquer warning na saída atual.

Achados descartados como `defer` (registrados em `deferred` no frontmatter, não repetidos aqui) ou `reject` (ruído — não listados individualmente): risco de bypass do redirect por preflight CORS (`CorsMiddleware` roda antes de `SecurityMiddleware`, pré-existente); confiança de `SECURE_PROXY_SSL_HEADER` combinada com `RAILWAY_PRIVATE_DOMAIN` em `ALLOWED_HOSTS` (pré-existente, não investigado se a rede privada do Railway é alcançável por terceiros); duplicata do risco de rollout escalonado de HSTS já registrado na pass anterior; comentário sobre escopo da isenção do healthcheck (o path é público por design, `AllowAny`); dependência não fixada de `--tag security` cobrir só checks futuros já tagueados `security` (comportamento atual correto, hipotético); degradação silenciosa de `makemigrations --check` para comparação só-por-arquivo quando o DB está inacessível (no CI o Postgres do job sempre está disponível); especulação sobre vazamento do `SECRET_KEY` dummy do CI para um ambiente real; sugestão de guarda de tamanho mínimo para esse mesmo `SECRET_KEY`; notas descritivas do auditor de alinhamento de intenção sobre a reconciliação já documentada na pass anterior e sobre a superfície Host-header não testada (isenção casa por path, não por Host — não afeta o comportamento).

### 2026-07-31 — Review pass (fresh, disparada por status `done` explícito na invocação)
- intent_gap: 0
- bad_spec: 0
- patch: 2 (high 0, medium 1, low 1)
- defer: 1 (high 0, medium 1, low 0)
- reject: 12 (high 0, medium 0, low 12)
- addressed_findings:
  - `[medium]` `[patch]` O step `check --deploy --tag security --fail-level WARNING` (o gate real de DW-5) não tinha nenhum teste que o protegesse de regressão -- uma edição futura em `ci.yml` que removesse silenciosamente `--tag security` ou `--fail-level WARNING` reverteria o step a um no-op sem que nada na suíte notasse. Corrigido: novo teste `test_ci_prod_deploy_check_keeps_security_fail_level_gate` em `core/tests/test_prod_settings.py`, que lê `ci.yml` e confirma que a linha do step contém as duas flags.
  - `[low]` `[patch]` O step `makemigrations --check --dry-run --settings=config.settings.prod` rodava sem `--noinput`; um drift ambíguo (ex. rename de campo que o autodetector não resolve sozinho) dispararia `InteractiveMigrationQuestioner`, que sem stdin anexado no runner do CI levanta `EOFError` -- o step ainda falharia (exit ≠ 0, via exceção não tratada), mas com um traceback confuso em vez do sinal limpo que o step existe para dar. Corrigido: adicionado `--noinput` ao comando em `.github/workflows/ci.yml`.

Achados descartados como `defer` (registrado em `deferred` no frontmatter, não repetido aqui) ou `reject` (ruído/duplicata — não listados individualmente): `--tag security` excluir checks de deploy não tagueados `security` (ex. `async_support.E001`, `caches.W002`) — sem impacto hoje (repo não usa `CACHES` custom nem `DJANGO_ALLOW_ASYNC_UNSAFE`), registrado como o único `defer` desta pass; duplicatas dos 4 itens já em `deferred` (HSTS sem rollout escalonado/`includeSubDomains`, `SECURE_PROXY_SSL_HEADER`+`RAILWAY_PRIVATE_DOMAIN`, preflight CORS, nota de conhecimento desatualizada); especulação sobre vazamento do `SECRET_KEY` dummy do CI (já descartada na pass anterior pelo mesmo motivo); afirmação factualmente incorreta de que o diff revisado parava no `final_revision` anterior e não cobria mudanças posteriores (o diff construído para esta pass usa `git diff` contra a working tree, cobrindo tudo até o estado atual, incluindo não commitado); caso de borda de `/api/health` sem barra final não casar com `SECURE_REDIRECT_EXEMPT` (sem impacto: `railway.toml` define `healthcheckPath` com barra final, e um teste já lê esse valor real do arquivo); 5 notas descritivas do auditor de alinhamento de intenção sobre tensões já documentadas e resolvidas nas passes anteriores (uso deliberado de `--fail-level` apesar do "Never" original, superfície de falha mais ampla que a matriz I/O, detalhe de Host-header já rejeitado antes, verificação via `Client`/`override_settings` em vez de request real -- consistente com a própria seção `## Verification` da spec, e edição de `deferred-work.md` corretamente atribuída ao orquestrador, não a este run).

## Design Notes

Railway termina TLS na borda e encaminha `X-Forwarded-Proto`, mas o *healthcheck* do próprio Railway bate direto no container pela rede interna (confirmado em `docs/CIandDeploymentLogs.md`, incidente real de "Healthcheck failed") — sem esse header. Com `SECURE_SSL_REDIRECT=True` sem isenção, toda checagem de saúde do deploy seria redirecionada (301) e o Railway marcaria o release como não saudável, travando o rollout. `SECURE_REDIRECT_EXEMPT` resolve isso porque `SecurityMiddleware` casa a lista contra `request.path` sem a barra inicial, então `r"^api/health/$"` isenta exatamente (e só) esse path.

## Verification

**Commands:**
- `cd backend && uv run python manage.py check --deploy --settings=config.settings.prod` -- expected: exit 0, sem `security.W004`/`W008` na saída.
- `cd backend && uv run python manage.py makemigrations --check --dry-run --settings=config.settings.prod` -- expected: "No changes detected", exit 0.
- `cd backend && uv run pytest core/tests/test_prod_settings.py -q` -- expected: passa.
- `cd backend && uv run pytest` -- expected: suíte completa continua verde (sem regressão em dev/test/e2e).

## Auto Run Result

**Resumo:** Terceira pass de revisão (fresh review, disparada por status `done` explícito na invocação de `/bmad-dev-auto`) sobre o diff já implementado e commitado (`67260e9`, `5750650`, `e13d055`, `a783221`, `b901631`), que fecha DW-4 (hardening HTTPS/HSTS em `prod.py`) e DW-5 (validação do caminho de produção no CI). Os 2 findings roteados como `patch` nesta pass são melhorias de robustez/cobertura de teste do próprio mecanismo de CI que DW-5 introduziu -- nenhuma mudança de comportamento de produção foi necessária.

**Arquivos alterados nesta pass:**
- `.github/workflows/ci.yml` -- step `Checar migrations pendentes (settings de produção)` passou a rodar com `--noinput`, evitando um `EOFError` confuso em caso de drift ambíguo de migração sem stdin anexado no runner.
- `backend/core/tests/test_prod_settings.py` -- novo teste `test_ci_prod_deploy_check_keeps_security_fail_level_gate`, que lê `ci.yml` e confirma que o step `check --deploy ... config.settings.prod` mantém `--tag security --fail-level WARNING` (o que hoje torna o step um gate real, não um no-op).
- `_bmad-output/implementation-artifacts/spec-dw-4-dw-5-prod-settings-e-ci-hardening.md` -- 1 novo item `deferred` no frontmatter; nova entrada no Review Triage Log; esta seção.

**Findings da revisão (4 revisores em paralelo -- blind hunter, edge-case hunter, verification-gap, intent-alignment):**
- `patch`: 2 (medium 1, low 1) -- ambos corrigidos nesta pass, ver Review Triage Log.
- `defer`: 1 (medium 1) -- registrado em `deferred` no frontmatter: `check --deploy --tag security` exclui checks de deploy não tagueados `security` (ex. `async_support.E001`, `caches.W002`); sem impacto hoje (repo não usa `CACHES` custom nem `DJANGO_ALLOW_ASYNC_UNSAFE`), mas é um trade-off deliberado da pass anterior que vale revisitar se o projeto crescer nessas direções.
- `reject`: 12 (todos low) -- duplicatas dos 4 itens já em `deferred` (HSTS/`includeSubDomains`, `SECURE_PROXY_SSL_HEADER`+`RAILWAY_PRIVATE_DOMAIN`, preflight CORS, nota de conhecimento desatualizada); especulação sobre vazamento do `SECRET_KEY` dummy (já rejeitada antes); afirmação factualmente incorreta sobre o escopo do diff revisado (o diff desta pass cobre a working tree completa via `git diff` contra `baseline_revision`, não parou no `final_revision` anterior); caso de borda de `/api/health` sem barra final (sem impacto: `railway.toml` fixa a barra final, testado); 5 notas descritivas do auditor de alinhamento de intenção sobre tensões já documentadas/resolvidas nas passes anteriores.

**Follow-up review recommendation:** `false`. Score = 3×1 (medium patch) + 1×1 (low patch) = 4 < 5. Nenhum patch `high`.

**Verificação executada:**
- `uv run pytest core/tests/test_prod_settings.py -v` -- 7 passed (6 pré-existentes + o novo teste de guarda do `ci.yml`).
- `check --deploy --tag security --fail-level WARNING --settings=config.settings.prod` (env da CI simulado localmente) -- exit 0.
- `makemigrations --check --dry-run --noinput --settings=config.settings.prod` (env da CI simulado localmente) -- "No changes detected", exit 0 (mesmo `RuntimeWarning` de conexão local pré-existente, documentado no Code Map; não ocorre no CI real).
- `uv run ruff check .` -- All checks passed.
- `uv run pytest` (suíte completa do backend) -- 1340 passed em 262s, sem regressão.

**Riscos residuais:** o item `defer` desta pass (escopo de `--tag security` no gate de CI) fica para investigação futura -- não é acionável sem decisão sobre quais tags de deploy adicionar, e não há impacto hoje. Os 4 itens já deferidos nas passes anteriores (rollout escalonado de HSTS antes do Épico 10, confiança em `SECURE_PROXY_SSL_HEADER`/rede privada do Railway, bypass de preflight CORS, nota de conhecimento desatualizada) permanecem válidos e não foram alterados nesta pass.

