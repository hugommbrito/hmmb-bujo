---
title: 'DW-22/DW-23: alinhar as afirmações de hardening de prod com o que é de fato exercitado'
type: 'chore'
created: '2026-08-04'
status: 'done'
baseline_revision: '7e3530d402ba4c5a78d1a2726e2445006eeb7a61'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      Os 3 warnings `drf_spectacular.W001` que o step novo de CI tolera são um defeito
      vivo de contrato de schema, não só ruído, e nenhum DW os rastreia.
    evidence: |-
      Medido em 2026-08-04: 2 dos 3 são `could not resolve authenticator
      <class 'automation.authentication.AutomationTokenAuthentication'>` para `CaptureView` e
      `SummaryView` — ou seja, o `schema.yaml` commitado omite o security scheme dessas duas
      views. O próprio `ci.yml` trata esse `schema.yaml` como contrato de registro no step
      "Gerar schema OpenAPI e checar drift schema-vs-view" (DW-14). O terceiro é
      `ToStatusEnum` (múltiplos nomes para o mesmo choice set, resolvível via
      `ENUM_NAME_OVERRIDES`). O intent desta story proibiu explicitamente resolvê-los, e o
      comentário de `ci.yml` mais o docstring do teste agora codificam que eles nunca podem
      ser gate — o que torna a dívida permanente sem nenhum registro de que deve ser paga.
      Fecha-se registrando `OpenApiAuthenticationExtension` para o autenticador de automação
      e um `ENUM_NAME_OVERRIDES` para `ToStatusEnum`.
      Rastreado no ledger como **DW-38** (apendado em 2026-08-04) — não abrir entrada nova.
    location: >-
      backend/automation/views.py + backend/automation/authentication.py; .github/workflows/ci.yml:93-97
    severity: medium
  - summary: >-
      Nenhum dos 3 deploy checks que o step novo acrescenta consegue falhar o CI no env
      deste job; `--tag` é repetível, e alargar o step 1 para `--tag security --tag caches
      --tag async_support --fail-level WARNING` faria caches.W002 e async.E001 virarem gate
      de verdade — cobrindo 20 dos 21 deploy checks a WARNING.
    evidence: |-
      Medido em 2026-08-04. `--tag` é declarado com `action="append"` em
      `django/core/management/commands/check.py`, então é repetível, e
      `check --deploy --tag security --tag caches --tag async_support --fail-level WARNING
      --settings=config.settings.prod` sai EXIT=0 no estado atual do repo — ou seja, o
      alargamento é adotável hoje sem ruído. Isso importa porque, no env deste job, os 3
      checks que o step 2 acrescenta são todos inalcançáveis ou não-gate: `caches.W002` é
      warning-only E retorna `[]` antes de emitir (só dispara para um `FileBasedCache` cujo
      LOCATION cruza MEDIA_ROOT/STATIC_ROOT/STATICFILES_DIRS, e o repo não configura
      `CACHES`); `async.E001` exige `DJANGO_ALLOW_ASYNC_UNSAFE` no ambiente, que o `env:` do
      job nunca define; `drf_spectacular.E001` já é coberto pelo step `spectacular --file`
      mais abaixo. Fora de escopo desta story porque o intent exige o step 1 "literalmente
      intacto" e proíbe `--tag` no step 2 — mudar as tags do step 1 é exatamente o que ele
      veta. O step 2 continuaria necessário de todo modo: `schema_check` não tem tag alguma.
      Rastreado no ledger como **DW-37** (apendado em 2026-08-04) — não abrir entrada nova.
      Ressalva medida na pass de 2026-08-04: o `reason:` de DW-37 diz que as asserções do
      teste "pinam `--tag security` sozinho" no step 1; na verdade elas só exigem que
      `--tag security` esteja presente, então alargar as tags do step 1 mantém o teste verde
      e só a prosa do docstring ("18 de 21") precisaria de atualização. O texto do ledger não
      foi corrigido porque este run só pode APENDAR entradas novas, nunca reescrever as
      existentes.
    location: >-
      .github/workflows/ci.yml (step "Checar settings de produção (deploy checks)")
    severity: low
  - summary: >-
      O CI roda `uv sync --frozen`, que instala a partir do `uv.lock` sem nunca comparar o
      lock com o `pyproject.toml` — então qualquer dependência declarada sem re-lock fica
      inerte com o build verde, incluindo o `pyyaml>=6.0` que existe para proteger os guards
      de hardening.
    evidence: |-
      Medido em 2026-08-04 com uv 0.11.24. Removendo só a linha
      `{ name = "pyyaml", specifier = ">=6.0" },` de `backend/uv.lock` e mantendo o
      `pyproject.toml` como está: `uv sync --frozen` sai EXIT=0 ("Would make no changes") e
      `uv lock --check` sai EXIT=1. Ou seja, `--frozen` não valida o lock contra o
      `pyproject.toml`; a declaração de `pyyaml` só é efetiva hoje porque o hunk de 2 linhas
      do lock caiu no mesmo commit. Um rebase/merge que preserve o hunk do `pyproject.toml`
      e perca o do lock — ou qualquer dependência futura adicionada do mesmo jeito —
      restaura silenciosamente o risco que a declaração fecha (drf-spectacular largar
      PyYAML → `import yaml` morre na coleta → os guards de DW-4/DW-22/DW-23 saem da suíte),
      sem nada vermelho em lugar algum. A suíte também não serve de rede aqui: PyYAML
      continua instalado transitivamente, então `import yaml` funciona de todo modo.
      Fora de escopo desta story: o step `Install dependencies` é pré-existente e o intent
      só autoriza mexer nos steps de deploy check; trocar `--frozen` por `--locked` é
      decisão de política de CI para o repo inteiro (passa a derrubar o build em qualquer
      drift lock-vs-pyproject), não um detalhe deste diff.
      Fecha-se trocando `uv sync --frozen` por `uv sync --locked` em
      `.github/workflows/ci.yml`, ou acrescentando um step `uv lock --check` ao lado.
    location: >-
      .github/workflows/ci.yml:68 (step "Install dependencies") + backend/pyproject.toml
    severity: low
---

<intent-contract>

## Intent

**Problem:** Duas pontas soltas da mesma review pass de `spec-dw-4-dw-5-prod-settings-e-ci-hardening`. (DW-23) O step de deploy check do CI roda `--tag security`, exercitando 18 dos 21 deploy checks registrados sob `config.settings.prod` — um erro exclusivo de prod fora dessa tag passa pelo mesmo mecanismo que a DW-5 existe para fechar. (DW-22) O comentário de `backend/config/settings/prod.py:40-42` afirma forçar HTTPS "para toda requisição", com carve-out só do healthcheck, mas preflight CORS nunca chega ao `SecurityMiddleware`: `CorsMiddleware` está no índice 0 de `MIDDLEWARE` e responde antes.

**Approach:** Acrescentar um segundo step de CI sem filtro de tag em `--fail-level ERROR`, mantendo o step atual literalmente intacto (decisão humana já registrada no ledger em 2026-08-04 — seguir como está), e corrigir o texto do comentário de `prod.py` documentando o carve-out do preflight ao lado da nota que já existe sobre `SECURE_REDIRECT_EXEMPT`. Ambas as pontas ganham guarda de regressão em `core/tests/test_prod_settings.py`.

## Boundaries & Constraints

**Always:**
- Manter o step de `.github/workflows/ci.yml:84-85` (`check --deploy --tag security --fail-level WARNING`) literalmente intacto; o step novo entra **logo depois** dele.
- O step novo roda `--fail-level ERROR`, **nunca** `WARNING`: medido nesta varredura que o comando sai EXIT=0 a `ERROR` e EXIT=1 a `WARNING`, por causa de 3 warnings `drf_spectacular.W001` pré-existentes.
- Atualizar `test_ci_prod_deploy_check_keeps_security_fail_level_gate` (`core/tests/test_prod_settings.py:132-152`): ele hoje afirma `len(deploy_check_lines) == 1` e **quebra** com o step novo. Passa a exigir os dois steps, cada um com suas flags — é essa asserção que impede a próxima pessoa de colapsar os dois.
- Idioma dos comentários segue o arquivo, não o idioma do spec: `ci.yml` em pt-BR, `prod.py` e docstrings de teste em inglês (como já estão).

**Block If:** _nenhum — a decisão de DW-23 já está registrada no ledger e o comportamento de DW-22 já foi reproduzido localmente._

**Never:**
- Não reordenar `MIDDLEWARE` em `base.py:58-61`: `CorsMiddleware` precisa continuar cedo (antes de `CommonMiddleware`). DW-22 é correção de texto, não mudança de comportamento.
- Não colapsar os dois steps de CI em um só, não adicionar `--tag` ao step novo, não mexer no `SECRET_KEY` dummy do job.
- Não resolver os 3 warnings `drf_spectacular.W001` (fora de escopo — o step novo tem de conviver com eles).
- Não tocar `dev.py`/`test.py`/`e2e.py`, `CORS_ALLOWED_ORIGINS`/`CORS_URLS_REGEX`, nem o step de `makemigrations --check`.
- Não editar `_bmad-output/implementation-artifacts/deferred-work.md` (o orquestrador registra a resolução).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Preflight CORS sob hardening de prod | `OPTIONS /api/accounts/` com `Access-Control-Request-Method: POST` sobre HTTP puro | 200, **sem** `Location` e **sem** `Strict-Transport-Security` — confirma o carve-out que o comentário passa a documentar | Nenhum erro esperado |
| `OPTIONS` que não é preflight | `OPTIONS /api/accounts/` **sem** `Access-Control-Request-Method` | 301 para `https://testserver/api/accounts/` — o carve-out é só do preflight, não de todo `OPTIONS` | Nenhum erro esperado |
| Preflight de Origin não allow-listed | preflight com `Origin: http://evil.example` (fora de `CORS_ALLOWED_ORIGINS`) | 200 igualmente, sem headers `Access-Control-Allow-*` — o bypass não é filtrado por Origin, e sim por `CORS_URLS_REGEX` (default `^.*$`) | Nenhum erro esperado |
| Step novo no estado atual do repo | `check --deploy --fail-level ERROR --settings=config.settings.prod`, env do job `backend` | EXIT=0, com os 3 `drf_spectacular.W001` impressos sem falhar o step | Nenhum erro esperado |
| Regressão de deploy check fora da tag `security` | mesmo comando, com um check de deploy nível ERROR falhando | EXIT≠0 | O step falha e derruba o job |

</intent-contract>

## Code Map

- `.github/workflows/ci.yml:76-83` -- comentário do step atual (explica `--tag security` + `--fail-level WARNING`). Reescrever para cobrir a divisão de trabalho entre os dois steps e registrar por que a combinação existe.
- `.github/workflows/ci.yml:84-85` -- step `Checar settings de produção (deploy checks)`, manter intacto. O step novo entra imediatamente após a linha 85, **antes** do comentário de `--noinput` (87-90), que pertence ao step de migrations (91-92).
- `backend/config/settings/prod.py:40-42` -- comentário a corrigir. `SECURE_SSL_REDIRECT`/`SECURE_REDIRECT_EXEMPT` nas linhas 43-44, `SECURE_HSTS_*` em 45-47.
- `backend/config/settings/base.py:58-61` (read-only) -- `CorsMiddleware` no índice 0, `SecurityMiddleware` no 1, com comentário existente justificando a ordem. **Não reordenar.**
- `backend/config/settings/base.py:228-231` (read-only) -- bloco CORS: só `CORS_ALLOWED_ORIGINS`. `CORS_URLS_REGEX` nunca é definido, então fica no default `^.*$` e `is_enabled()` casa qualquer path.
- `backend/.venv/lib/python3.13/site-packages/corsheaders/middleware.py:68-79` (read-only, django-cors-headers 4.9.0) -- `check_preflight()` devolve `HttpResponse(headers={"content-length": "0"})` antes de chamar `get_response`, quando `is_enabled` + método `OPTIONS` + header `access-control-request-method` presente. Não consulta `CORS_ALLOWED_ORIGINS`.
- `backend/core/tests/test_prod_settings.py:132-152` -- `test_ci_prod_deploy_check_keeps_security_fail_level_gate`. O `assert len(deploy_check_lines) == 1` (linha 147) é o ponto que quebra com o step novo.
- `backend/core/tests/test_prod_settings.py:20-39` -- helper `_security_middleware_settings()`, que puxa os valores do módulo `prod` real. Reutilizar no teste novo de preflight, junto com o padrão já estabelecido no arquivo: `Client()` construído **dentro** do bloco `override_settings`, porque `SecurityMiddleware` lê settings no `__init__`.

**Evidências medidas nesta varredura (não re-verificar do zero, apenas preservar):**
- 21 deploy checks registrados sob `config.settings.prod` = 18 `security` + `async_checks.check_async_unsafe` (`async_support`) + `caches.check_cache_location_not_exposed` (`caches`) + `drf_spectacular.checks.schema_check` (**sem tag alguma**). O step novo passa a exercitar exatamente esses 3 que o atual pula.
- Com o env do job `backend` do CI: `--fail-level ERROR` sem `--tag` → EXIT=0 com 3 `drf_spectacular.W001` (2× autenticador `AutomationTokenAuthentication` não resolvido em `automation/views.py`, 1× `ToStatusEnum`); o **mesmo comando** a `--fail-level WARNING` → EXIT=1; step atual (`--tag security --fail-level WARNING`) → EXIT=0.
- Preflight reproduzido sob `override_settings` do hardening de prod: 200, sem `Location`, sem `Strict-Transport-Security`, headers = `{content-length, Content-Type, Vary: origin}`. `OPTIONS` sem o header de preflight: 301.

## Tasks & Acceptance

**Execution:**
- `.github/workflows/ci.yml` -- reescrever o comentário de 76-83 explicando a divisão de trabalho (security a `WARNING`, todo o resto a `ERROR`) e por que os dois coexistem; acrescentar, logo após a linha 85, um segundo step (ex. `Checar settings de produção (deploy checks sem filtro de tag)`) rodando `uv run python manage.py check --deploy --fail-level ERROR --settings=config.settings.prod` -- fecha DW-23, cobrindo os 3 deploy checks fora da tag `security` sem reintroduzir o ruído de WARNING que motivou o escopo original.
- `backend/config/settings/prod.py` -- corrigir o comentário de 40-42 para nomear os **dois** carve-outs: o healthcheck do Railway (via `SECURE_REDIRECT_EXEMPT`) e o preflight CORS (via ordem de `MIDDLEWARE`), deixando claro que o preflight escapa em qualquer path e que `OPTIONS` fora do preflight continua redirecionado -- fecha DW-22; a afirmação "for every request" é o que estava incorreto.
- `backend/core/tests/test_prod_settings.py` -- (a) atualizar `test_ci_prod_deploy_check_keeps_security_fail_level_gate` para exigir **duas** linhas `check --deploy ... config.settings.prod`, uma com `--tag security --fail-level WARNING` e outra sem `--tag` e com `--fail-level ERROR`, com mensagens que identifiquem qual das duas regrediu; (b) novo teste de preflight cobrindo os 3 primeiros cenários da matriz I/O -- transforma o comentário corrigido de `prod.py` numa afirmação verificada em vez de outra alegação sem guarda, que é exatamente como DW-22 nasceu.

**Acceptance Criteria:**
- Dado o env do job `backend` do CI, quando `uv run python manage.py check --deploy --fail-level ERROR --settings=config.settings.prod` roda no estado atual do repo, então sai EXIT=0 e os 3 `drf_spectacular.W001` aparecem na saída sem derrubar o step.
- Dado que alguém remova `--tag security` ou `--fail-level WARNING` do primeiro step, ou remova/afrouxe o segundo step, quando `uv run pytest core/tests/test_prod_settings.py` roda, então falha com mensagem que identifica qual dos dois steps regrediu.
- Dado o comentário corrigido em `prod.py`, quando alguém procura ali o que escapa da imposição de HTTPS, então encontra os dois carve-outs (healthcheck e preflight CORS) sem precisar abrir `MIDDLEWARE` em `base.py`.
- Dado `.github/workflows/ci.yml`, quando alguém lê o bloco de comentário dos dois steps, então entende por que existem dois níveis de falha diferentes e que colapsá-los num só step reabre o gap de DW-23 ou pinta o CI de vermelho pelos W001.
- Dado o diff completo, quando `uv run pytest` roda a suíte inteira, então passa sem regressão em nenhum outro teste.

## Spec Change Log

## Review Triage Log

### 2026-08-04 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12 (high 0, medium 4, low 8)
- defer: 1 (high 0, medium 1, low 0)
- reject: 7 (high 0, medium 0, low 7)
- addressed_findings:
  - `[medium]` `[patch]` As 3 premissas do teste novo de preflight liam `django.conf.settings` (= `config.settings.test` local / `config.settings.dev` no CI), nunca `config.settings.prod` — e é `prod.py` que reescreve `MIDDLEWARE` (injeção do WhiteNoise). **Provado**: com `CORS_URLS_REGEX = r"^/api/v2/"` + reorder de `Cors` atrás de `Security` aplicados SÓ em `prod.py`, o módulo dava `8 passed`. Corrigido: premissas passam a ler `prod_settings.MIDDLEWARE`/`hasattr(prod_settings, "CORS_URLS_REGEX")` via helper `_cors_middleware_precedes_security`, com uma segunda asserção sobre as settings ativas para provar que o exercício HTTP ainda reproduz a ordem de prod. Reverificado: a mesma mutação agora falha (regex+reorder, só regex, e só reorder — os três).
  - `[medium]` `[patch]` O comentário de `ci.yml` dizia que o step 2 "cobre os 3 deploy checks fora da tag security": (a) sem `--tag` ele executa os 50 checks registrados, então os 3 são a coberta ACRESCENTADA sobre o step 1, não o blast radius; (b) a `--fail-level ERROR`, `caches.W002` — um dos dois exemplos citados no próprio registro de DW-23 — roda mas nunca pode falhar (medido: `check_cache_location_not_exposed` só emite `Warning`). Corrigido: comentário passa a separar *executado* de *capaz de derrubar o build*, com o resíduo declarado como trade-off aceito de `ERROR`.
  - `[medium]` `[patch]` O guard de `ci.yml` era scan de texto do arquivo inteiro, então ficava verde com o gate morto: `run:` comentado continua casando, e `if:`/`continue-on-error: true` são invisíveis; flag `--fail-level` duplicada também passava (argparse honra a última). Corrigido: `yaml.safe_load` do workflow, varredura de `jobs.backend.steps`, steps com `if:`/`continue-on-error` excluídos do conjunto vivo e reportados em `NOTE:`, e nível efetivo via última ocorrência da flag. Reverificado: os 3 casos que o scan antigo deixava passar agora falham.
  - `[medium]` `[patch]` O caso de Origin não allow-listed era vacuoso: `CORS_ALLOWED_ORIGINS` é `[]` em todos os settings sob os quais a suíte roda, então a premissa era trivialmente verdadeira e a asserção de ausência de `Access-Control-Allow-*` nunca poderia falhar (com allowlist vazia nenhuma origin recebe esses headers). Corrigido: fase 2 do teste com `override_settings(CORS_ALLOWED_ORIGINS=["http://good.example"])` afirmando as duas pontas — allow-listed recebe `Access-Control-Allow-Origin`, foreign mantém o 200 sem nenhum `Access-Control-Allow-*`.
  - `[low]` `[patch]` "escopa para os 18 checks de segurança" estava errado para o que o step 1 roda: medido que `--tag security` executa 20 checks (18 deles deploy; os outros 2 são `check_settings` e `check_csrf_failure_view`). Corrigido com os números exatos e marcados como MEDIDOS em 2026-08-04, já que um upgrade de Django/drf-spectacular pode retaguear checks.
  - `[low]` `[patch]` O comentário de escopo no topo de `ci.yml` (linhas 12-14) descrevia só o step único de DW-5 e não mencionava a divisão em dois. Corrigido com uma cláusula de DW-23 apontando para o bloco de comentário dos steps.
  - `[low]` `[patch]` A afirmação "on any path" só exercitava `/api/accounts/`, deixando `^.*$` como inferência da setting ausente. Corrigido: caso novo de preflight em `/definitely/not/a/route/` (path que não resolve view alguma), com as três asserções.
  - `[low]` `[patch]` "reaches neither the redirect nor HSTS" nomeava duas consequências, mas o short-circuit pula toda a cadeia abaixo do `CorsMiddleware` — a mesma classe de sobre-afirmação que originou DW-22. Corrigido com uma cláusula, sem virar enumeração de segurança.
  - `[low]` `[patch]` "CorsMiddleware only consults CORS_URLS_REGEX" era inexato: `is_enabled` é `re.match(CORS_URLS_REGEX, path) or self.check_signal(request)`, ou seja consulta também o sinal `check_request_enabled` — verdadeiro hoje só porque o repo não registra receiver (fato do repo, não do middleware). Corrigido no comentário e travado com `assert not check_request_enabled.receivers`.
  - `[low]` `[patch]` As asserções novas de CORS estavam sem mensagem de falha, ao contrário do resto do diff, e as 3 requisições eram afirmadas depois do bloco `with` — uma falha exibia status code nu sem indicar qual cenário quebrou. Corrigido: todas com mensagem nomeando o cenário.
  - `[low]` `[patch]` A mensagem do guard de `CORS_URLS_REGEX` ("expected to stay unset") enquadrava como regressão justamente a mudança que ESTREITARIA o bypass. Corrigido: agora diz que é um aperto legítimo e manda atualizar o comentário de `prod.py` e o caso "any path".
  - `[low]` `[patch]` O bypass passou a ser documentado E travado por teste sem nenhum registro de POR QUE deixá-lo aberto é aceitável, o que faria o próximo leitor lê-lo como design intencional sem justificativa. Corrigido com a razão do próprio ledger: preflight não carrega credencial nem corpo, então a exposição em claro não tem vítima — reordenar `MIDDLEWARE` quebraria CORS por um não-problema.

Achados descartados como `defer` (registrado em `deferred` no frontmatter, não repetido aqui) ou `reject` (não listados individualmente): `--fail-level ERROR` no step 2 ser redundante com o default do Django (é o comando prescrito verbatim na decisão humana de DW-23 — pinar explicitamente é o comportamento correto); renomear `test_ci_prod_deploy_check_keeps_security_fail_level_gate` (as mensagens por step já carregam a informação, e renomear orfanaria a referência no Review Triage Log append-only de `spec-dw-4-dw-5-prod-settings-e-ci-hardening`); o workflow não rodar em push para `dev` (escopo de trigger pré-existente e deliberado, não específico destes steps); step 2 não executar quando o step 1 falha (fail-fast padrão do GitHub Actions, não defeito); `Access-Control-Request-Method` presente-mas-vazio também sofrer bypass (o comentário fala de ausência do header, e nisso está correto); spec untracked / DW-22 e DW-23 ainda `open` no ledger (o spec é commitado na finalização e o ledger é do orquestrador, proibido a este run); bloco `decision:` duplicado verbatim no registro de DW-23 no ledger (mesmo motivo — arquivo proibido).

### 2026-08-04 — Review pass (follow-up, `followup_review_recommended: true` da pass anterior)
- intent_gap: 0
- bad_spec: 0
- patch: 17 (high 0, medium 6, low 11)
- defer: 1 (high 0, medium 0, low 1)
- reject: 11 (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` O guard novo de `ci.yml` casava só a grafia `--tag`, mas Django registra `("--tag", "-t")`: **provado** que reescrever o step 2 como `-t security` deixava as 5 asserções verdes, reabrindo o gap de DW-23 em silêncio — e a primeira mensagem a disparar dizia o oposto do que aconteceu. Corrigido com `_TAG_FLAG = r"(?<![\w-])(?:--tag|-t)"` (lookbehind para não casar `-t` dentro de flag mais longa).
  - `[medium]` `[patch]` O guard inspecionava `if:`/`continue-on-error:` mas nada no nível do shell: **provado** que `|| true` no step 1 deixava as 5 asserções verdes com o gate de DW-4/DW-5 incapaz de falhar. Corrigido com `_exit_code_can_propagate` (`||`, `|` — Actions roda `bash -e` sem `pipefail` —, `; exit 0`, `; true`, `; :`), reportado como motivo de neutering junto dos outros.
  - `[medium]` `[patch]` Neutering só era detectado no step, nunca no job: `if:`/`continue-on-error:` em `jobs.backend` matava os dois gates com o teste verde — exatamente o "dead gate looking green" que o docstring alegava cobrir. Corrigido inspecionando o job e prefixando o motivo com `job `/`step ` na mensagem.
  - `[medium]` `[patch]` O guard reduziu escopo em relação ao código que substituiu: o scan de texto antigo cobria o arquivo inteiro, o novo só `jobs.backend`, então um step de deploy check duplicado/conflitante em outro job passava despercebido; e renomear o job dava `KeyError: 'backend'` nu — a única falha do arquivo sem mensagem. Corrigido varrendo todos os jobs, atribuindo cada invocação ao seu job, com asserção `misplaced` e mensagem explícita para o rename.
  - `[medium]` `[patch]` O comentário de `ci.yml` sobre-afirmava o que o step 2 consegue derrubar — a mesma classe de defeito que originou DW-22. **Medido**: no env deste job nenhum dos 3 pode falhar hoje (`caches.W002` é warning-only E retorna `[]` sem `CACHES` FileBasedCache configurado; `async.E001` exige `DJANGO_ALLOW_ASYNC_UNSAFE`, que o `env:` do job nunca define; `drf_spectacular.E001` já é coberto pelo step `spectacular --file` abaixo). Corrigido: o comentário passa a declarar que o valor do step é **prospectivo** (fecha a porta para um deploy check ERROR fora da tag `security` vindo de upgrade/app novo/CACHES futuro), com o porquê de cada um dos 3 nomeado.
  - `[medium]` `[patch]` `import yaml` era novo na suíte do backend e resolvia só transitivamente via drf-spectacular — se essa dependência largar PyYAML, o módulo inteiro morre na coleta e leva os guards de hardening de DW-4 com ele. Corrigido declarando `pyyaml>=6.0` no grupo `dev` de `backend/pyproject.toml` + `uv lock` (diff de 2 linhas; `uv lock --check` OK, então `uv sync --frozen` do CI continua válido).
  - `[low]` `[patch]` `_effective_fail_level` varria a string inteira do `run:`, não uma invocação: fundir os dois steps num `run: |` atribuía a flag do step 2 ao step 1. Corrigido com `_deploy_check_invocations` (split por linha e `&&`) — mas isso **removia a detecção** da fusão, então foi acrescentada a asserção dedicada `merged_steps`, que reporta a fusão *como* fusão. Reverificado: 9/9 mutações pegas (antes 8/9).
  - `[low]` `[patch]` `--fail-level` ausente fazia a mensagem afirmar nível `'WARNING'`, quando o default do Django é `ERROR` — mensagem factualmente errada. Corrigido com `_describe_fail_level`, que diz "absent (Django then defaults to ERROR)".
  - `[low]` `[patch]` "as alternativas são piores" enumerava só duas alternativas. **Medido**: `--tag` é `action="append"`, e `--tag security --tag caches --tag async_support --fail-level WARNING` sai EXIT=0 hoje, tornando `caches.W002` e `async.E001` gate de verdade. Corrigido nomeando essa terceira via e por que não foi adotada (o intent exige o step 1 intacto), com ponteiro para DW-37; a adoção em si ficou deferida.
  - `[low]` `[patch]` A fase 2 afirmava o ramo allow-listed mais fraco que os outros três casos (sem `Location`/HSTS), então não conseguia distinguir "origin allow-listed também escapa do redirect" de "origin allow-listed recebe headers de CORS". Corrigido com a mesma tripla dos outros casos + `allow_headers(allowed_preflight) != []`, aplicando o mesmo conjunto derivado nos dois lados.
  - `[low]` `[patch]` A fase 2 não pinava `CORS_ALLOW_ALL_ORIGINS`/`CORS_ALLOWED_ORIGIN_REGEXES`: qualquer um deles ligado no ambiente tornaria `foreign_origin` allow-listed e o contraste voltaria a ser vacuoso. Corrigido pinando ambos no `override_settings`; **verificado** que com `CORS_ALLOW_ALL_ORIGINS = True` nas settings ativas o teste segue verde.
  - `[low]` `[patch]` `_cors_middleware_precedes_security` guardava a presença de `CorsMiddleware` com mensagem de 3 linhas e então chamava `.index(_SECURITY_MIDDLEWARE)` sem guarda — `ValueError` nu. Corrigido com guarda simétrica; **verificado** que remover `SecurityMiddleware` de `prod.MIDDLEWARE` agora dá a mensagem, não o `ValueError`.
  - `[low]` `[patch]` `assert not check_request_enabled.receivers` lia a lista crua, que retém slots de receivers weak já coletados, transformando a premissa em função do timing do GC. Corrigido para `has_listeners()` (usa `_live_receivers`), com a mensagem dizendo que vazamento de receiver por outro teste é causa mais provável que mudança no repo. **Verificado** que conectar um receiver faz a asserção disparar.
  - `[low]` `[patch]` A premissa de `CORS_URLS_REGEX` era unilateral (só `prod`) enquanto a de `MIDDLEWARE` já era bilateral: as settings ativas passando a definir o regex fariam o caso "any path" falhar culpando `prod.py`, que estaria intacto. Corrigido com a checagem bilateral; **verificado** que a mensagem certa dispara.
  - `[low]` `[patch]` O docstring do módulo seguia escopado a DW-4 e não explicava por que um teste de settings parseia YAML de workflow nem por que `yaml` é importado ali. Reescrito cobrindo as três frentes (DW-4, DW-23, DW-22).
  - `[low]` `[patch]` Duas referências desatualizadas em `ci.yml`: o comentário do `SECRET_KEY` dizia "the prod deploy-check step below" no singular com dois steps abaixo, e a cláusula nova do topo apontava posicionalmente ("directly above them"). Corrigidos nomeando o primeiro step explicitamente e os dois títulos de step.
  - `[low]` `[patch]` A ordem dos steps não era afirmada, embora a numeração "1) ... 2)" do comentário e a decisão de DW-23 ("logo depois") dependam dela. Corrigido com asserção de índice.

Achados descartados como `defer` (registrado em `deferred` no frontmatter **e** apendado ao ledger como DW-37, conforme instrução da invocação) ou `reject` (11, não listados individualmente): guardar as contagens 50/21/20/18 com teste derivado do registro (decisão deliberada e já documentada nos riscos residuais desta story — datar em vez de introspectar, para não transformar todo upgrade de dependência em falha de CI); preflight também escapar de `ALLOWED_HOSTS` (a cláusula "every middleware further down" já cobre com precisão; a pass anterior decidiu explicitamente não virar enumeração de segurança); preflight nunca receber HSTS nem sobre HTTPS (a requisição real subsequente recebe; "no victim" trata da exposição em claro do próprio preflight); afirmar `MIDDLEWARE[0] == Cors` em vez de ordem relativa (a afirmação documentada é sobre o que está ABAIXO do Cors, que a ordem relativa captura exatamente); aceitar níveis mais estritos (`INFO`/`DEBUG`) no step 1 (o intent pina as flags exatas); breadcrumb em `base.py` (a mensagem de falha do teste já roteia o editor para `prod.py`, e o Code Map marca `base.py` read-only); workflow não rodar em push para `dev` (escopo de trigger pré-existente, já rejeitado na pass anterior); abreviação de prefixo do argparse (`--fail-l`, `--ta`); `on:` virar boolean `True` no PyYAML (o teste nunca lê); `--fail-level ERROR` redundante com o default (já rejeitado na pass anterior — é o comando prescrito verbatim pela decisão humana); `deferred-work.md`/spec fora do diff revisado (bookkeeping do orquestrador).

**Nota sobre o ledger:** a invocação autorizou apendar achados deferidos como entradas NOVAS. Foram apendadas duas: **DW-37** (o defer desta pass) e **DW-38** (o defer `medium` da pass ANTERIOR sobre os `drf_spectacular.W001`, que existia só no frontmatter do spec e não tinha entrada no ledger — órfão da classe já conhecida neste projeto). Nenhuma entrada existente foi modificada, reaberta ou reescrita.

### 2026-08-04 — Review pass (follow-up 2, `followup_review_recommended: true` da pass anterior)
- intent_gap: 0
- bad_spec: 0
- patch: 12 (high 0, medium 5, low 7)
- defer: 1 (high 0, medium 0, low 1)
- reject: 19 (high 0, medium 0, low 19)
- addressed_findings:
  - `[medium]` `[patch]` A detecção de tag exigia separador (`_TAG_FLAG + r"[= ]"`), mas um short option do argparse aceita o valor colado: **medido** que reescrever o step 2 como `-tsecurity` deixava o teste verde com o gap de DW-23 reaberto — exatamente o mesmo defeito que a pass anterior fechou para `-t security`, uma grafia adiante. Corrigido separando presença (`_TAG_FLAG`, sem separador) de valor (`_TAG_SECURITY`, com separador opcional no short form). Reverificado: `-tsecurity` e `-t security` agora falham.
  - `[medium]` `[patch]` `_exit_code_can_propagate` só olhava a linha da invocação, então neutering vindo de OUTRA linha do mesmo `run:` era invisível: **medido** que `set +e` acima do comando do step 1 deixava o teste verde com o gate de DW-4/DW-5 incapaz de falhar. Corrigido com `_shell_neutering_reason`, que casa `set +e`/`set +o errexit` contra o bloco inteiro e reporta o motivo pelo mesmo canal `neutered`. Reverificado: falha com a mensagem "its `run:` block turns off errexit (`set +e`)".
  - `[medium]` `[patch]` O split por linha tratava uma continuação `\` como duas invocações, então um `|| true` estacionado na linha seguinte não pertencia a comando nenhum: **medido** que o teste ficava verde com o step 1 mudo. Corrigido normalizando continuações (`_LINE_CONTINUATION`) antes do split.
  - `[medium]` `[patch]` O docstring alegava que parsear YAML fecha o buraco do "`run:` comentado ainda casa", mas YAML só remove `#` de escalar plano, não de bloco `|`: **medido** que comentar o comando do step 2 dentro de um `run: |` deixava o teste verde contando a linha comentada como gate vivo. Corrigido removendo comentários de shell (`_SHELL_COMMENT`) na normalização; a asserção passa a reportar o step 2 como ausente, que é o que ele é.
  - `[medium]` `[patch]` O comentário de `ci.yml` afirmava que "no env DESTE job nenhum dos 3 pode falhar o (2)" e se contradizia no próprio bullet, que diz que `drf_spectacular.E001` "dispara" — a mesma classe de sobre-afirmação que originou DW-22. **Verificado na fonte** (`drf_spectacular/checks.py`): `E001` é `Error`, `ENABLE_DJANGO_DEPLOY_CHECK` está ligado, então ele derruba o step 2 de verdade; e o "já derruba mais abaixo" tinha a direção invertida — o step 2 roda ANTES do `spectacular --file`, então é ele que reporta primeiro sob fail-fast. Corrigido para "dos 3 só UM pode falhar, e de forma redundante", com a ressalva de que `W002` é o canal de ERRO do gerador emitido como `Warning` (ou seja, a `ERROR` este step tolera erro real de geração de schema — reforça DW-38).
  - `[low]` `[patch]` `merged_steps` (acrescentado na pass anterior justamente para reportar fusão *como* fusão) cobria `\n` e `&&`, não `;`: **medido** que fundir os dois comandos com `;` numa linha falhava dizendo "o `--fail-level` do step 1 é 'ERROR'" — a misdiagnose que a asserção existe para evitar. Corrigido com split condicional `;(?=[^;]*check --deploy)`, que separa fusão sem desgrudar `; exit 0` do comando que ele silencia. Reverificado: reporta como fusão.
  - `[low]` `[patch]` Valor de flag entre aspas ou com espaço extra virava falso positivo com mensagem factualmente errada: **medido** que `--fail-level="WARNING"` (shell válido, argparse recebe WARNING) derrubava o teste dizendo que a flag estava "absent". Corrigido tolerando aspas e `\s*` em `_effective_fail_level` e em `_TAG_SECURITY`. Reverificado: `--fail-level="WARNING"`, `--fail-level=WARNING` e `--tag=security` ficam verdes.
  - `[low]` `[patch]` Perder `--settings=config.settings.prod` — que é a regressão de DW-5 em si, porque os checks passariam a rodar sob `config.settings.dev` — era pego, mas a mensagem culpava `--tag security`/deleção e nunca nomeava a causa. Corrigido nomeando-a explicitamente nas mensagens dos dois steps.
  - `[low]` `[patch]` `if:` era tratado como neutering sem exceção, então `if: always()` no step 2 — benigno, o step continua gatando — derrubava o teste com a mensagem "exists but cannot gate the build", que é falsa. Corrigido com `_HARMLESS_IF` (`success()`, `always()`, `!cancelled()`), aplicado no step e no job. Reverificado: `if: always()` fica verde.
  - `[low]` `[patch]` Sobravam duas falhas sem mensagem no módulo, contra o padrão que a pass anterior estabeleceu ao trocar o `KeyError: 'backend'` nu: `FileNotFoundError` se o workflow for movido e `KeyError`/`TypeError` em `workflow["jobs"]`. Corrigido com guardas explicativas antes de ambos.
  - `[low]` `[patch]` O comando de parse de YAML no bloco `## Verification` importava `sys` sem usar e usava caminho relativo à raiz enquanto todos os outros começam com `cd backend`. Corrigido, e passa a usar o `yaml` do venv — o mesmo que o teste guard importa.
  - `[low]` `[patch]` Os itens de `deferred` no frontmatter não referenciavam os ids de ledger que se tornaram (DW-37/DW-38), o exato modo de falha "defer órfão" já conhecido neste projeto. Corrigido com back-reference em cada um; aproveitado para registrar ali que o `reason:` de DW-37 descreve mal as asserções do teste (elas só exigem `--tag security` presente, então alargar as tags do step 1 mantém tudo verde — só a prosa "18 de 21" precisaria mudar). O texto do ledger não foi corrigido: este run só pode apendar entradas novas.

Achados descartados como `defer` (registrado em `deferred` no frontmatter **e** apendado ao ledger como DW-39, conforme instrução da invocação) ou `reject` (19, não listados individualmente): o `reason:` impreciso de DW-37 e o `location:`/enquadramento de DW-22 no ledger (arquivo em que este run só pode apendar — a correção ficou no frontmatter do spec); a nota "nenhuma entrada existente foi modificada" conviver no mesmo diff com os flips `open → done` de DW-22/DW-23 (esses flips são do orquestrador, já estavam no working tree, e a procedência está registrada no Auto Run Result); o `Never` do intent proibir `deferred-work.md` enquanto o diff apenda (as duas invocações autorizaram explicitamente entradas NOVAS); `review_loop_iteration: 0` "desatualizado" (conta loopbacks de bad_spec, não passes de review) e `context: []`/`status` (campos geridos pelo workflow); a matriz I/O não listar os dois cenários acrescentados em review nem o row EXIT≠0 não ser exercitável (a matriz está dentro de `<intent-contract>`, imutável — e a inexercitabilidade É o conteúdo de DW-37); a análise medida viver em três lugares (o comentário de `ci.yml` precisa ser legível sozinho por quem chega de um build vermelho); falta de âncora de versão de django-cors-headers e do id DW-22 no comentário de `prod.py` (o comportamento é afirmado por teste, então um upgrade que o mude fica vermelho; o docstring do teste carrega o id); step 2 sem comentário próprio (o bloco fica acima dos dois); `/api/accounts/` literal em vez de `reverse` (o teste vizinho documenta o literal como deliberadamente arbitrário — o redirect do `SecurityMiddleware` roda antes da resolução de URL); posição/redundância do controle `allow_headers(allowed_preflight) != []` e da premissa `hasattr(prod_settings, "CORS_URLS_REGEX")` (ambos deliberados da pass anterior); adotar `actionlint`/validação de schema do workflow (adoção de ferramenta nova, fora de escopo); rename de step desincronizar os títulos citados no comentário do topo (drift de prosa, sem gate); cross-check por texto cru para declarações fora de `steps[*].run` (o parse de YAML é a substituição deliberada); `shell:`/`defaults.run.shell` invalidarem a premissa `bash -e` e `; true` no meio do bloco escapar da âncora `$` (declarados como riscos residuais).

## Design Notes

Sobre a precisão do comentário de `prod.py`: o carve-out do preflight é mais estreito do que "OPTIONS não é redirecionado" e mais largo do que "origens permitidas passam". `check_preflight()` dispara com `is_enabled` + `OPTIONS` + `access-control-request-method`, e `is_enabled` só consulta `CORS_URLS_REGEX` (default `^.*$`) — nunca a lista de origens. O texto novo precisa acertar as duas bordas; a matriz I/O e o teste novo existem para travá-las.

Forma esperada (inglês, como o resto do arquivo):

```python
# Force HTTPS, with two carve-outs. (1) Railway's own healthcheck: it hits the
# container over the internal network without X-Forwarded-Proto, so a redirect
# there would make Railway think the release is unhealthy and block rollout.
# (2) CORS preflight, on any path: CorsMiddleware sits ahead of
# SecurityMiddleware in MIDDLEWARE (see base.py) and answers preflight OPTIONS
# itself, so that traffic reaches neither the redirect nor HSTS. Plain OPTIONS
# (no Access-Control-Request-Method) is still redirected.
```

## Verification

**Commands:**
- `cd backend && SECRET_KEY="ci-dummy-secret-not-for-production-0123456789abcdefgh" ALLOWED_HOSTS="localhost,127.0.0.1" DATABASE_URL="postgres://postgres:postgres@localhost:5432/hmmb_ci" uv run python manage.py check --deploy --fail-level ERROR --settings=config.settings.prod` -- expected: EXIT=0, saída com os 3 `drf_spectacular.W001` (replica o step novo com o env do job do CI).
- `cd backend && uv run pytest core/tests/test_prod_settings.py -q` -- expected: todos passam, incluindo o teste de preflight novo e o de `ci.yml` atualizado.
- `cd backend && uv run pytest -q` -- expected: suíte inteira verde (a mudança em `ci.yml` é lida por teste, então precisa da suíte toda para descartar outro leitor do arquivo).
- `cd backend && uv run ruff check .` -- expected: sem findings.
- `cd backend && uv run python -c "import yaml; yaml.safe_load(open('../.github/workflows/ci.yml'))"` -- expected: parse sem erro (o step novo não pode quebrar o YAML do workflow). Rodado de `backend/` como os demais comandos, e com o `yaml` do venv, que é o mesmo que o teste guard usa.

**Manual checks (if no CLI):**
- Temporariamente remover as 5 linhas de hardening de `prod.py` e confirmar que o **primeiro** step continua saindo EXIT=1 (o gate de DW-4/DW-5 segue intacto), revertendo em seguida.

## Auto Run Result

Status: done
Blocking condition: nenhuma

### Mudança implementada

Fecha DW-22 e DW-23, as duas pontas soltas da review pass de `spec-dw-4-dw-5-prod-settings-e-ci-hardening`. **DW-23:** o step de deploy check do CI rodava `--tag security`, exercitando 18 dos 21 deploy checks de `config.settings.prod`; um segundo step sem filtro de tag, a `--fail-level ERROR`, passa a exercitar os 3 restantes, com o step original mantido byte-a-byte intacto conforme a decisão humana registrada no ledger. **DW-22:** o comentário de `prod.py` afirmava forçar HTTPS "para toda requisição" com carve-out só do healthcheck, mas `CorsMiddleware` (índice 0 de `MIDDLEWARE`) responde preflight OPTIONS antes do `SecurityMiddleware`; o texto passa a documentar os dois carve-outs, sem reordenar middleware. Ambos ganharam guarda de regressão executável.

Este passe é o **segundo follow-up review**. Como o anterior, não mudou o comportamento entregue: fechou quatro formas de neutering que o guard de `ci.yml` deixava passar **verde** (todas medidas, não antecipadas), removeu dois falsos positivos que derrubariam o CI por edição benigna, e corrigiu uma sobre-afirmação no comentário de `ci.yml` que se contradizia no próprio bullet — a mesma classe de defeito que originou DW-22.

### Arquivos alterados

- `.github/workflows/ci.yml` — comentário dos dois steps corrigido: passa a dizer que **um** dos 3 checks acrescentados (`drf_spectacular.E001`, um `Error` real) derruba o step 2 de fato, ainda que redundantemente, com a direção do fail-fast na ordem certa e a ressalva de que `W002` é o canal de erro do gerador emitido como `Warning`. A lista de formas de regressão que o teste cobre foi atualizada.
- `backend/core/tests/test_prod_settings.py` — guard endurecido: `-t` com valor colado, `set +e` em qualquer linha do bloco, continuação `\`, comando comentado dentro de `run: |`, fusão por `;`, valores de flag entre aspas, perda de `--settings`, `if:` benigno, workflow ausente e `jobs:` ausente.
- `_bmad-output/implementation-artifacts/deferred-work.md` — **apenas append** de DW-39 (+7 linhas, 0 remoções).
- `backend/config/settings/prod.py`, `backend/pyproject.toml`, `backend/uv.lock` — inalterados neste passe.

**Procedência dos flips `open → done` de DW-22/DW-23 no diff:** foram feitos pelo orquestrador, já estavam no working tree quando o primeiro passe começou, e foram preservados intactos. Nenhum dos passes deste run modificou entrada existente do ledger; os três appends foram DW-37, DW-38 e DW-39.

### Review — 4 camadas (blind hunter, edge-case hunter, verification-gap, intent-alignment)

- **12 patches aplicados** (medium 5, low 7) — detalhe no Review Triage Log acima.
- **1 item deferido** (low): `uv sync --frozen` não valida o lock contra o `pyproject.toml`. Registrado em `deferred` no frontmatter **e** apendado ao ledger como **DW-39**.
- **19 itens rejeitados**: sumarizados no Review Triage Log.
- **Follow-up review recomendado: `true`.** Patches por severidade: high 0, medium 5, low 7 → score `3×5 + 1×7 = 22` (≥ 5).

### Verificação executada

| Verificação | Resultado |
|---|---|
| `check --deploy --fail-level ERROR --settings=config.settings.prod` (env do job de CI) | EXIT=0, com os 3 `drf_spectacular.W001` impressos |
| `check --deploy --tag security --fail-level WARNING ...` (step 1) | EXIT=0 |
| `pytest core/tests/test_prod_settings.py` | 8 passed |
| `pytest` (suíte completa) | **1381 passed** (4m41s) |
| `ruff check .` | All checks passed |
| `yaml.safe_load(ci.yml)` | parseia OK (jobs: `backend`, `frontend`) |
| `drf_spectacular/checks.py` lido na fonte | `E001` é `Error`; `W002` transporta `_error_cache` como `Warning` |

**Mutações no `ci.yml` real** — 21 aplicadas, cada uma isolada, revertida e conferida por sha256 ao final (`ci.yml` restaurado byte-a-byte):

| Mutação | Antes deste passe | Agora |
|---|---|---|
| step 2 com `-tsecurity` (valor colado) | **passava verde** (gap de DW-23 reaberto) | CAUGHT |
| `set +e` em outra linha do `run: \|` do step 1 | **passava verde** (gate de DW-4/DW-5 morto) | CAUGHT, nomeando `set +e` |
| continuação `\` levando `\|\| true` para a linha seguinte | **passava verde** | CAUGHT |
| comando do step 2 comentado dentro de `run: \|` | **passava verde** | CAUGHT como step 2 ausente |
| dois comandos fundidos com `;` numa linha | pegava, com misdiagnose ("fail-level do step 1 é ERROR") | CAUGHT, reportado *como* fusão |
| `; exit 0 # nota` dentro de `run: \|` | passava (âncora `$` derrotada pelo comentário) | CAUGHT |
| step 1 sem `--settings=config.settings.prod` | pegava, sem nomear a causa | CAUGHT, nomeando a causa |
| `--fail-level="WARNING"` (aspas, benigno) | **falso positivo** com mensagem errada ("absent") | verde |
| `--fail-level=WARNING` / `--tag=security` (benignos) | verde | verde |
| `if: always()` no step 2 (benigno) | **falso positivo** ("cannot gate the build") | verde |
| `-t security`, `\|\| true`, `if:`/`continue-on-error` no job, fusão em `run: \|`, `run:` comentado no YAML, `--fail-level` duplicada, ordem trocada, migração de job | CAUGHT | CAUGHT (sem regressão) |

**Achado do lock, medido e revertido** (uv 0.11.24): removendo só a linha de `pyyaml` de `backend/uv.lock`, `uv sync --frozen` sai EXIT=0 e `uv lock --check` sai EXIT=1 → base de DW-39.

### Riscos residuais

- **A cobertura de neutering segue heurística, não um parser de shell.** Agora cobre `\|\|`, `\|`, `; exit 0`, `; true`, `; :`, `set +e`/`set +o errexit` e comentários; continuam invisíveis: `; true` no MEIO do bloco (a âncora `$` só pega no fim da invocação), subshell, wrapper em script externo, e um `shell:`/`defaults.run.shell` que mude a premissa `bash -e` — inclusive `shell: bash`, que ADICIONA `pipefail` e tornaria a heurística do `\|` um falso positivo.
- **`set +e` é rejeitado em qualquer posição do bloco**, mesmo se um `set -e` posterior rearmar o errexit. É um falso alarme deliberado: erra para o lado que um humano lê, não para o que ninguém vê.
- **Nenhum dos 3 deploy checks acrescentados pelo step 2 é gate útil hoje**, e o único que consegue derrubá-lo (`drf_spectacular.E001`) é redundante com o step `spectacular --file`. O valor segue prospectivo e agora está declarado com precisão. A via que tornaria dois dos outros gate real está em **DW-37**; os `W001` que forçam `--fail-level ERROR` estão em **DW-38**.
- **As contagens 50/21/20/18 no comentário são prosa datada em 2026-08-04**, não asserção executável — decisão deliberada (datar em vez de introspectar, para não transformar todo upgrade de dependência em falha de CI), rejeitada como achado em duas passes.
- **O guard cobre o job `backend` por nome** (`_DEPLOY_CHECK_JOB`), com mensagem explicativa e varredura de todos os jobs para detectar migração/duplicação. Rename do job pede editar a constante.
- **O teste de preflight não roda uma requisição pela cadeia de `config.settings.prod`** (arrastaria WhiteNoise e seu manifest storage); a lacuna é fechada por premissas bilaterais lidas de `prod.MIDDLEWARE`/`prod.CORS_URLS_REGEX`.
- **`uv sync --frozen` não valida o lock contra o `pyproject.toml`** (DW-39): a declaração de `pyyaml>=6.0` é efetiva hoje só porque o hunk do lock caiu no mesmo commit.
- **Nota factual para quem editar o comentário depois:** `caches.py` define um `E001`, mas ele pertence a `check_default_cache_is_configured` (não-deploy); o deploy check `check_cache_location_not_exposed` só emite `caches.W002`. E `async_support` é a *tag*, enquanto o id da mensagem é `async.E001`.

