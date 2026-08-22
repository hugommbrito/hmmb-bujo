---
title: 'DW-32: set_rollback() nos três ramos de Response construída à mão do custom_exception_handler'
type: 'bugfix'
created: '2026-08-04'
status: 'done'
baseline_revision: '8db21dc5de3f11a1c495849c54d92a243e480983'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: [oversized]
deferred:
  - superseded_by: >-
      DW-52 — já promovido ao ledger pelo item seguinte desta mesma lista. Mantido
      aqui só como histórico: NÃO promover de novo.
    summary: >-
      [PROMOVIDO → DW-52, não repromover] As duas respostas de erro construídas à mão
      em automation/views.py devolvem 400
      sem marcar rollback e sem passar por _normalise_body — mesma classe da DW-32, um
      nível acima (view, não handler).
    evidence: |-
      Achado por dois reviewers independentes nesta passada. O reviewer de
      verification-gap investigou e concluiu que hoje NÃO há regressão viva: `:56`
      dispara em falha de `CaptureRequestSerializer.is_valid()`, que é validação de
      forma pura (`automation/serializers.py:15-28`, zero DB), e `:63` dispara em
      `UnknownCaptureType`, que `dispatch_capture` levanta no braço `case _` antes de
      qualquer escrita (`automation/services.py:61-65`). Ou seja: latente pelo mesmo
      motivo que a DW-32 era latente, mas com um agravante — como esses returns não
      levantam exceção, sob ATOMIC_REQUESTS o Django COMMITA normalmente (não há
      exceção para o wrapper rolar de volta), então nem o fallback do `make_view_atomic`
      protege. Além disso ambos escapam do contrato de corpo `{detail, fields}` por não
      passarem por `_normalise_body`. Nada nesta story registrava que o escopo era
      handler-only, então fica anotado aqui.
    location: >-
      backend/automation/views.py:56 e :63
    severity: low
  - summary: >-
      Promovido ao ledger como DW-52 na pass de follow-up: o mesmo item acima, agora
      com a evidência de que a autenticação já escreve dentro do bloco atômico da
      request, o que torna o desvio pior do que "latente sem vítima".
    evidence: |-
      Reconfirmado por dois reviewers nesta pass, com dois acréscimos ao que a pass
      anterior registrou. (1) A divergência de corpo é VIVA, não latente: `:56`
      devolve `serializer.errors` cru e `:63` devolve `{"type": str(exc)}`, então o
      contrato `{detail, fields}` de §6.4 já não vale em `/api/capture` hoje.
      (2) `AutomationTokenAuthentication.authenticate()` faz
      `token.save(update_fields=["last_used_at"])`
      (`backend/automation/authentication.py:58-59`) e `make_view_atomic` embrulha
      `APIView.dispatch` — logo essa escrita de auditoria acontece DENTRO do bloco
      atômico, antes dos dois `return`. Sob `ATOMIC_REQUESTS` esses dois 400 seriam
      os únicos desfechos de erro da view a preservá-la, enquanto todo erro por
      `raise` a descartaria. Também confirmado por grep que essas duas são as
      últimas respostas de erro à mão do backend fora de `core/exceptions.py`.
    location: >-
      backend/automation/views.py:56 e :63 (ledger: DW-52)
    severity: low
  - summary: >-
      Duas afirmações da DW-52 estão erradas e mudam a estimativa: a divergência de
      corpo do /api/capture já está pinada por três testes verdes, e esse corpo não é
      contrato publicado. Registrado no ledger como DW-53 (entrada aditiva, sem
      reabrir a DW-52).
    evidence: |-
      Achado por dois reviewers independentes nesta pass e conferido por mim.
      (1) A DW-52 termina com "Nada disso está coberto por teste", o que é falso
      para a metade do corpo: `automation/tests/test_views.py:77` assere
      `resp.data["type"] == "Tipo de captura desconhecido: xpto"` e `:87`/`:96`
      aserem `"text" in resp.data` — os três pinam exatamente as formas que o
      contrato `{detail, fields}` mudaria, então os três têm de ser reescritos sob
      qualquer das duas opções que a DW-52 lista. Só a metade do rollback é
      genuinamente sem cobertura.
      (2) `schema.yaml:1116-1131` (`operationId: capture_create`) documenta APENAS o
      `201` — nenhum dos dois 400 está no OpenAPI. Então a opção `raise` altera um
      corpo NÃO documentado, decisão mais barata do que a DW-52 sugere ao falar de
      "contrato publicado".
    location: >-
      backend/automation/tests/test_views.py:77, :87, :96 e schema.yaml:1116-1131
      (ledger: DW-53)
    severity: low
  - summary: >-
      Ligar ATOMIC_REQUESTS tem pré-requisitos e efeitos colaterais que nenhuma
      entrada rastreia — e hoje não existe caminho de configuração suportado para
      ligar a flag. Registrado no ledger como DW-54.
    evidence: |-
      A DW-32 foi feita explicitamente antes de qualquer decisão de ligar a flag, e
      agora que o pré-requisito está pronto nada registra a decisão. Três fatos
      verificados nesta pass. (1) Não há slot: `env.db("DATABASE_URL")`
      (`config/settings/base.py:97-99`) devolve ENGINE/NAME/USER/HOST/PORT/OPTIONS,
      nunca uma chave top-level `ATOMIC_REQUESTS` — a superfície de CONFIGURAÇÃO
      segue sem cobertura, e é a que o Block If do intent adiou. (2) Os dois
      `return` da DW-52 COMMITAM sob a flag (não levantam exceção), então ligá-la
      antes de resolver a DW-52 cria a inconsistência que ela descreve.
      (3) `token.save(update_fields=["last_used_at"])`
      (`automation/authentication.py:58-59`) roda dentro do bloco atômico, logo esse
      registro de auditoria passa a ser descartado em toda resposta de erro por
      `raise` — correto transacionalmente, perda de telemetria na prática.
    location: >-
      backend/config/settings/base.py:97-99 e
      backend/automation/authentication.py:58-59 (ledger: DW-54)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Os três ramos do `custom_exception_handler` que constroem `Response` à mão (`TenantScopeViolation` → 500, `DomainError` → 409, `User.DoesNotExist` → 401) devolvem a resposta **sem** chamar `set_rollback()`, coisa que o handler default do DRF faz sempre antes de responder (`rest_framework/views.py:99`). O objetivo dessa chamada é justamente impedir que uma exceção dentro de um bloco `ATOMIC_REQUESTS` deixe escrita parcial commitada. O bug é **latente, não vivo**: `ATOMIC_REQUESTS` não está setado em nenhum lugar de `backend/config/` nem nos arquivos de env, e `DATABASES` vem inteiro de `env.db(DATABASE_URL)` — então hoje o guard interno de `set_rollback()` seria False de todo jeito. Dois dos três ramos são pré-existentes à DW-25 (que só acrescentou a terceira instância do mesmo padrão).

**Approach:** Importar `set_rollback` de `rest_framework.views` (hoje só `exception_handler` é importado) e chamá-lo imediatamente antes de cada um dos três `return Response(...)` construídos à mão, na mesma posição em que o DRF o chama. Cobrir com testes de unidade que ligam `ATOMIC_REQUESTS` sob demanda na conexão default (mutando `settings_dict`, o mesmo dado que `set_rollback()` lê) para que o assert não seja vácuo, incluindo uma prova ponta-a-ponta de que uma escrita feita no bloco atômico realmente se perde.

## Boundaries & Constraints

**Always:**
- Corrigir os **três** ramos na mesma passada — consertar só o mais novo deixaria a inconsistência pior do que está.
- Usar o `set_rollback` do próprio DRF (`rest_framework.views`), nunca uma reimplementação: o guard `settings_dict['ATOMIC_REQUESTS'] and db.in_atomic_block` e a iteração sobre `connections.all()` precisam continuar sendo os do framework.
- Chamar antes do `return`, na mesma posição relativa que `rest_framework/views.py:99` usa (depois de montar corpo/headers, antes de construir/devolver a `Response`).
- Cada teste que assere rollback tem de restaurar `ATOMIC_REQUESTS` ao valor original no teardown, e não pode deixar a flag `needs_rollback` ligada vazando para o resto da suíte.
- Provar não-vacuidade: remover temporariamente uma das chamadas e confirmar que o teste correspondente falha; restaurar depois.

**Block If:**
- Ligar `ATOMIC_REQUESTS` de verdade em `backend/config/settings/` exigiria decisão de produto/infra — não é essa a tarefa; se a implementação concluir que é impossível testar sem ligar globalmente, HALT.

**Never:**
- Não ligar `ATOMIC_REQUESTS` em nenhum settings de aplicação (base/dev/prod/test) nem em arquivo de env. A flag só existe dentro do escopo do teste.
- Não mexer no ramo reconhecido pelo DRF (`:144-148`) — ele já ganha a chamada de graça pelo handler default.
- Não alterar status HTTP, corpo, headers, logs ou a ordem dos `isinstance` do handler.
- Não adicionar dependência nova nem fixture no `conftest.py` raiz (o único consumidor é `core/tests/test_exceptions.py`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| TenantScopeViolation com ATOMIC_REQUESTS ligado, dentro de bloco atômico | `custom_exception_handler(TenantScopeViolation(), {})` | 500 opaco como hoje **e** `connection.get_rollback() is True` | No error expected |
| DomainError com ATOMIC_REQUESTS ligado, dentro de bloco atômico | `custom_exception_handler(DomainError("x"), {})` | 409 como hoje **e** `connection.get_rollback() is True` | No error expected |
| User.DoesNotExist com ATOMIC_REQUESTS ligado, dentro de bloco atômico | `custom_exception_handler(User.DoesNotExist(), {})` | 401 + corpo/challenge como hoje **e** `connection.get_rollback() is True` | No error expected |
| Ramo reconhecido pelo DRF (regressão do "de graça") | `custom_exception_handler(NotAuthenticated(), {})` com ATOMIC_REQUESTS ligado | 401 normalizado **e** `connection.get_rollback() is True` (herdado do handler default) | No error expected |
| Escrita parcial dentro do bloco | `UserFactory()` e então o handler no mesmo `transaction.atomic()` | Ao sair do bloco, a linha criada **não** existe mais | No error expected |
| Exceção desconhecida (controle negativo) | `custom_exception_handler(RuntimeError("x"), {})` com ATOMIC_REQUESTS ligado | Devolve `None` **e** `connection.get_rollback() is False` | No error expected |
| ATOMIC_REQUESTS desligado (produção hoje) | Qualquer um dos três ramos | Resposta idêntica à de hoje; nenhum rollback marcado (guard do DRF é False) | No error expected |

</intent-contract>

## Code Map

- `backend/core/exceptions.py:26` -- `from rest_framework.views import exception_handler`; é aqui que `set_rollback` entra (confirmado por grep: `set_rollback` hoje é **zero** em todo `backend/`).
- `backend/core/exceptions.py:144-148` -- ramo reconhecido pelo DRF (`response is not None`): já recebe a chamada de graça do handler default. **Não tocar** — só cobrir com teste de regressão.
- `backend/core/exceptions.py:151-158` -- ramo `TenantScopeViolation`: `logger.critical` + `return Response({"detail": "Internal server error"}, 500)`. Alvo 1.
- `backend/core/exceptions.py:160-164` -- ramo `DomainError`: `return Response({"detail": str(exc)}, 409)`. Alvo 2.
- `backend/core/exceptions.py:189-209` -- ramo `User.DoesNotExist` (DW-25): `logger.warning` + `_authenticate_header(context)` + `return Response(..., 401, headers=...)`. Alvo 3 — a chamada entra depois de derivar o header, imediatamente antes do `return`.
- `backend/.venv/lib/python3.13/site-packages/rest_framework/views.py:66-69` -- (read-only) implementação de `set_rollback()`: `for db in connections.all(): if db.settings_dict['ATOMIC_REQUESTS'] and db.in_atomic_block: db.set_rollback(True)`. Guard duplo — daí o teste ter de ligar `ATOMIC_REQUESTS` **e** rodar dentro de um bloco atômico.
- `backend/.venv/lib/python3.13/site-packages/rest_framework/views.py:99` -- (read-only) call site canônico: `set_rollback()` na linha anterior ao `return Response(...)`. É o padrão a espelhar.
- `backend/core/tests/test_exceptions.py:1-20` -- testes de unidade chamam `custom_exception_handler(exc, {})` direto (contexto vazio); imports já trazem `TenantScopeViolation`, `DomainError`, `custom_exception_handler`, `_NO_ACTIVE_ACCOUNT`, `get_user_model`. `NotAuthenticated` já importado (`:9`). `:105-113` mostram o padrão de teste dos ramos `DoesNotExist`.
- `backend/conftest.py:31-34` -- fixture autouse `_enable_db_access(db)`: **todo** teste da suíte já roda dentro do bloco atômico do pytest-django, então `db.in_atomic_block` já é True e falta apenas ligar `ATOMIC_REQUESTS`.
- `backend/accounts/tests/factories.py:10-26` -- `UserFactory` cria `User` sem exigir `tenant_context`. **Não foi o caminho adotado:** as provas de escrita descartada usam `django.contrib.sessions.models.Session` (sem FK, sem tenant scoping, sem factory), decidido na 1ª pass de review. Fica registrado porque a linha "Escrita parcial dentro do bloco" da I/O Matrix — congelada — ainda nomeia `UserFactory()`: o mecanismo provado é o mesmo, só o modelo mudou. Atenção: `accounts` **não** está na lista proibida do port rule do `core` (`backend/pyproject.toml:64-68`) e `core/tests/test_authentication.py:41` já importa `UserFactory`, então "acoplamento de camada" não era o argumento — os de verdade são os três acima.
- `backend/config/settings/base.py:97-99` -- `DATABASES = {"default": env.db("DATABASE_URL")}`. Nenhum `ATOMIC_REQUESTS` (grep vazio em `backend/`), nem em `.env.dev`/`.env.e2e`/`.env.example`: é isso que torna o bug latente.
- `backend/.venv/.../django/db/backends/base/base.py:494-510` -- (read-only) `get_rollback()`/`set_rollback()` exigem `in_atomic_block`, senão levantam `TransactionManagementError`.
- `backend/.venv/.../django/db/transaction.py` (`Atomic.__exit__`) -- (read-only) com `needs_rollback=True` e savepoint presente: faz `savepoint_rollback` e **zera** `needs_rollback`. Ou seja, um `with transaction.atomic():` interno no teste se autolimpa ao sair, sem vazar a flag.

## Tasks & Acceptance

**Execution:**
- `backend/core/exceptions.py` -- adicionar `set_rollback` ao import de `rest_framework.views` e chamá-lo imediatamente antes dos três `return Response(...)` construídos à mão (`TenantScopeViolation`, `DomainError`, `User.DoesNotExist`) -- paridade com `views.py:99`: erro nunca deve deixar escrita parcial commitável sob `ATOMIC_REQUESTS`. Comentário curto explicando *por que* (paridade com o default do DRF + latente hoje), não *o que*.
- `backend/core/tests/test_exceptions.py` -- adicionar fixture local que liga `ATOMIC_REQUESTS` em `connections["default"].settings_dict` e restaura no teardown, e testar cada cenário da I/O Matrix: os três ramos marcando rollback, o ramo do DRF marcando por herança, a escrita descartada ponta-a-ponta, e o controle negativo (exceção desconhecida não marca) -- o controle negativo é o que prova que os asserts `is True` não vêm de estado ambiente.

**Acceptance Criteria:**
- Dado que `ATOMIC_REQUESTS` continua ausente de todo `backend/config/` e dos arquivos de env, quando a suíte roda, então nenhum settings de aplicação foi alterado e o comportamento em produção segue idêntico ao de hoje.
- Dado o handler já corrigido, quando qualquer uma das três chamadas a `set_rollback()` é removida temporariamente, então o teste correspondente falha (prova de não-vacuidade) e volta a passar quando a chamada é restaurada.
- Dado que os testes existentes de `test_exceptions.py` cobrem status, corpo, headers e logs dos três ramos, quando a suíte completa roda, então todos continuam verdes — a mudança não altera contrato de resposta.
- Dado que a flag `needs_rollback` é global por conexão, quando os testes novos terminam, então nenhum teste subsequente da suíte falha com `TransactionManagementError` (rodar a suíte completa, não só o módulo).

## Spec Change Log

## Review Triage Log

### 2026-08-04 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 11: (high 0, medium 3, low 8)
- defer: 1: (high 0, medium 0, low 1)
- reject: 6: (high 0, medium 0, low 6)
- addressed_findings:
  - `[medium]` `[patch]` `test_no_rollback_marked_when_atomic_requests_is_off` falhava com um `assert True is False` no dia em que alguém habilitasse `ATOMIC_REQUESTS` de verdade, culpando o handler por algo correto → passou a assertar a premissa (`settings_dict["ATOMIC_REQUESTS"] is False`) com mensagem que nomeia a causa e a ação certa (inverter/apagar o teste, nunca reverter a infra). Reproduzido por reviewer contra um settings que só liga a flag.
  - `[medium]` `[patch]` docstring da fixture ensinava um modelo falso do mecanismo (`settings_dict` é o MESMO objeto que `connections.settings["default"]` e que `settings.DATABASES["default"]`) → reescrita com o mecanismo verificado: `ConnectionHandler.settings` é `cached_property` já materializada e o `DatabaseWrapper` aberto segura o dict original, então `override_settings(DATABASES=...)` simplesmente não tem efeito no guard (Django 5.2); a mutação é process-wide e o que a torna segura é só o restore do teardown.
  - `[medium]` `[patch]` a garantia só estava provada na superfície da função → adicionado `test_request_level_partial_write_is_discarded`: request real, transação vinda do `make_view_atomic()` do Django, 409 + linha descartada. Cobre também o risco de a fase de resposta (middleware/rendering) tocar o banco com `needs_rollback` ligado e virar `TransactionManagementError`.
  - `[low]` `[patch]` posição do `set_rollback()` no ramo `User.DoesNotExist` é load-bearing (depois do log e do `_authenticate_header()`) e isso só estava dito nos testes → nota no call site avisando para não hoistar as três chamadas.
  - `[low]` `[patch]` docstrings de contrato não mencionavam a marcação de rollback → linha nova na Strategy do `custom_exception_handler` e docstring do módulo de teste atualizada.
  - `[low]` `[patch]` comentário de 7 linhas fora de proporção e duplicando fato repo-wide que apodrece → enxugado para 4 linhas de "por quê".
  - `[low]` `[patch]` parâmetro `context` de `_handle_in_atomic_block` era morto e era exatamente o que faltava para fechar a linha da matriz do `User.DoesNotExist` na superfície que ela nomeia → teste passou a usar `_StubView` e a assertar corpo + `WWW-Authenticate` junto com a flag.
  - `[low]` `[patch]` fixture liga só o alias `default` enquanto o `set_rollback()` do DRF itera `connections.all()` → premissa de banco único registrada na docstring.
  - `[low]` `[patch]` controle negativo parecia sancionar commit de escrita parcial em exceção desconhecida → acrescentado o argumento de segurança (devolver `None` re-levanta e o `make_view_atomic()` do Django rola a request de volta).
  - `[low]` `[patch]` teste futuro que pedisse a fixture sem bloco atômico próprio explodiria com `TransactionManagementError` longe da causa → `yield` da fixture embrulhado em `transaction.atomic()`, com o restore fora dele.
  - `[low]` `[patch]` prova ponta-a-ponta importava `accounts.tests.factories`, contra o precedente documentado neste próprio arquivo (`core` não acopla a app de domínio) → escrita trocada por `django.contrib.sessions.models.Session` (modelo do Django, sem FK); `lint-imports` segue KEPT.

### 2026-08-04 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 2, low 2)
- defer: 1: (high 0, medium 0, low 1)
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[medium]` `[patch]` as três chamadas ficaram *antes* da construção do corpo, invertendo a ordem do DRF e violando a cláusula Always "depois de montar corpo/headers": `str(exc)` (409) e `str(_NO_ACTIVE_ACCOUNT)` (401) eram avaliados dentro do `Response(...)`, isto é, já com `needs_rollback` ligado → corpo hoisted para uma local antes do `set_rollback()` nos dois ramos (o do 500 é literal constante, nada a hoistar). Achado por dois reviewers independentes, com a falha reproduzida: um `DomainError` cujo `__str__` lê o banco devolvia `TransactionManagementError` (500 cru) em vez do 409 documentado. Fixado por `test_domain_error_message_is_built_before_the_transaction_is_marked` — não-vacuidade conferida: reinlinando o corpo, o teste falha.
  - `[medium]` `[patch]` a invariante de posição que o próprio comentário do ramo 401 declara load-bearing ("AFTER o log e AFTER `_authenticate_header()`") estava garantida por prosa: três reviewers mediram que hoistar a chamada deixava a suíte inteira verde, e o `except Exception` deliberado de `_authenticate_header` engoliria o `TransactionManagementError`, devolvendo o 401 *silenciosamente* sem `WWW-Authenticate` — o canal lateral de um header que a DW-25 fechou → `_StubView` ganhou `query_first` (challenge derivado de query) e o novo `test_challenge_is_derived_before_the_transaction_is_marked` falha exatamente sob esse hoist.
  - `[low]` `[patch]` a Strategy do docstring afirmava "Every branch that returns a `Response` first marks..." — falso em dois pontos: só três dos quatro ramos que devolvem `Response` chamam `set_rollback()` (o reconhecido pelo DRF herda a chamada) e nesse ramo `_normalise_body` reescreve o corpo *depois* da marcação → bullet reescrito nomeando os três explícitos, o herdado, a normalização pós-marcação e a ordem corpo→marca→`Response`.
  - `[low]` `[patch]` o critério de aceite diz "qualquer um dos três ramos" com a flag desligada, mas `test_no_rollback_marked_when_atomic_requests_is_off` exercitava só o `DomainError` → parametrizado sobre os três ramos (o `User.DoesNotExist` via callable, para não resolver `get_user_model()` em tempo de coleta).

### 2026-08-04 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 2, low 4)
- defer: 2: (high 0, medium 0, low 2)
- reject: 19: (high 0, medium 0, low 19)
- addressed_findings:
  - `[medium]` `[patch]` o frontmatter carregava DUAS entradas `deferred:` para o mesmo item de `automation/views.py` — a segunda dizendo "o mesmo item acima" — e só ela registrava a promoção; a primeira seguia lendo como defer não promovido, então um sweep futuro do ledger podia cunhar um segundo DW para o mesmo código (exatamente o mecanismo que a DW-34 registra e que a própria DW-52 cita). Achado por dois reviewers independentes → primeira entrada ganhou `superseded_by: DW-52` e o marcador `[PROMOVIDO → DW-52, não repromover]` no início do `summary`, sem apagar nada.
  - `[medium]` `[patch]` o comando de grep da seção `## Verification` reportava FALHA justamente quando passava: `grep` sai com 1 quando não acha nada, e o "expected" era "zero ocorrências" — qualquer runner que leia exit code marcava vermelho no caso verde (reproduzido: `exit=1`). Pior, `.env.dev`/`.env.e2e` são gitignored (`.gitignore:3,5`), então em clone novo ou no CI o comando morria com exit 2 por arquivo inexistente → virou `! grep -rq ... config/` (exit 0 = verde) mais um laço que pula env file ausente; ambos conferidos com `exit=0` nesta pass.
  - `[low]` `[patch]` a `## Verification` não listava `uv run lint-imports`, embora a triagem da 1ª pass tenha resolvido um achado com "lint-imports segue KEPT" e o CI rode esse gate (`.github/workflows/ci.yml:77`) → comando acrescentado, com a referência ao CI.
  - `[low]` `[patch]` o comentário da prova de escrita ensinava uma regra de camada falsa ("mesma razão do `LogEntry`: a prova custa ao `core` zero acoplamento com factories de app de domínio") — `accounts` **não** está na lista proibida do port rule (`backend/pyproject.toml:64-68`, que lista só bujo/habits/health/medications/gratitude/braindump) e `core/tests/test_authentication.py:41` e `test_health.py:18` já importam `UserFactory` a nível de módulo. Achado por dois reviewers, verificado por mim → comentário reescrito com os motivos reais (`Session` não tem FK nem tenant scoping, logo não precisa de factory nem de `tenant_context`) e o Code Map passou a registrar que a linha congelada da I/O Matrix nomeia `UserFactory()` mas o mecanismo provado é o mesmo.
  - `[low]` `[patch]` a linha "Ramo reconhecido pelo DRF" da I/O Matrix pede "401 **normalizado** e rollback", e `test_drf_recognised_branch_still_marks_rollback` assertava só o status — a normalização acontece *depois* da marcação herdada, então delegar para `test_missing_auth_maps_to_401` (que roda com a flag desligada) não fecha a linha → asserts de corpo `{detail}` sem `fields` acrescentados no mesmo teste, nos mesmos termos que o resto do módulo usa para "normalizado".
  - `[low]` `[patch]` a mensagem do assert de premissa instrui quem ligar `ATOMIC_REQUESTS` a inverter/apagar o teste, mas não avisava que ligar a flag tem pré-requisitos fora do handler (os dois 400 da DW-52 commitariam; não existe slot de configuração para a flag) → mensagem passou a apontar para a DW-54, a entrada de ledger criada nesta pass justamente para isso.

## Design Notes

Por que mutar `settings_dict` em vez de `override_settings(DATABASES=...)`: `set_rollback()` lê `db.settings_dict['ATOMIC_REQUESTS']` da conexão **já aberta**; trocar o dict `DATABASES` inteiro dentro de um teste que roda numa transação aberta mexe com a inicialização das conexões e é justamente o que se quer evitar aqui. Mutar a chave no `settings_dict` da conexão default é o mesmo caminho que o próprio DRF usa na suíte de `atomic_requests` dele, e restaurar o valor original no teardown mantém o efeito confinado ao teste.

Forma esperada do teste (esqueleto, não literal):

```python
@pytest.fixture
def atomic_requests():
    settings_dict = connections["default"].settings_dict
    original = settings_dict.get("ATOMIC_REQUESTS", False)
    settings_dict["ATOMIC_REQUESTS"] = True
    try:
        yield
    finally:
        settings_dict["ATOMIC_REQUESTS"] = original
```

Dentro do teste, `with transaction.atomic():` cria um savepoint sobre a transação do pytest-django; depois de chamar o handler, `connections["default"].get_rollback()` deve ser `True`. Cuidado real: com `needs_rollback` ligado, **qualquer query dentro do bloco** levanta `TransactionManagementError` — então os asserts dentro do bloco só podem tocar `response`/flag, e qualquer verificação de banco (a linha sumiu) vai **depois** de sair do bloco.

## Verification

**Commands:**
- `cd backend && uv run pytest core/tests/test_exceptions.py -q` -- expected: todos os testes do módulo passam, incluindo os novos.
- `cd backend && uv run pytest -q` -- expected: suíte completa verde (guarda contra vazamento da flag `needs_rollback` para outros testes).
- `cd backend && uv run ruff check .` -- expected: zero achados.
- `cd backend && uv run lint-imports` -- expected: 1 kept, 0 broken (o `core` não pode acoplar app de domínio; é o mesmo gate que o CI roda em `.github/workflows/ci.yml:77`).
- `cd backend && ! grep -rq "ATOMIC_REQUESTS" config/` -- expected: **exit 0** (a flag não escapou do teste). O `!` é necessário: `grep` sai com 1 quando não acha nada, então a forma sem negação reporta "falha" justamente quando está tudo certo.
- `cd backend && for f in .env.dev .env.e2e .env.example; do [ ! -f "$f" ] || ! grep -q ATOMIC_REQUESTS "$f" || exit 1; done` -- expected: exit 0. Os env files ficam em `backend/`, não na raiz, e `.env.dev`/`.env.e2e` são gitignored (`.gitignore:3,5`) — logo não existem em clone novo nem no CI; o `[ ! -f ]` deixa isso passar em vez de virar erro de arquivo inexistente.
- Não-vacuidade: comentar uma chamada `set_rollback()` por vez, rodar `uv run pytest core/tests/test_exceptions.py -q`, confirmar falha do teste daquele ramo, restaurar. Ao final, `git diff -- core/exceptions.py` deve mostrar apenas as três chamadas + o import.

## Auto Run Result

Status: done
Blocking condition: nenhuma

### Mudança implementada

`set_rollback` do DRF é importado em `backend/core/exceptions.py` e chamado antes de cada um dos três `return Response(...)` construídos à mão do `custom_exception_handler` (`TenantScopeViolation` → 500, `DomainError` → 409, `User.DoesNotExist` → 401), na ordem exata do DRF: corpo e headers primeiro, depois a marcação, depois a `Response`. Status, corpo, headers, logs e a ordem dos `isinstance` seguem intocados; o ramo reconhecido pelo DRF não foi mexido (herda a chamada do handler default). Nenhum settings de aplicação ou arquivo de env ganhou `ATOMIC_REQUESTS` — o fix é latente de propósito, como o intent pediu.

Esta 3ª pass **não mexeu em `core/exceptions.py`** (sha `38d6f401` antes e depois, `git diff` vazio): o código do handler já estava correto. O que ela corrigiu foi o entorno — dois riscos de processo (defer duplicado no frontmatter, comando de verificação que reportava falha no caso verde), duas imprecisões de documentação (regra de camada falsa no comentário da prova; Code Map desatualizado) e duas lacunas pequenas de asserção/orientação nos testes.

### Arquivos alterados

- [../../backend/core/exceptions.py](../../backend/core/exceptions.py) — (passes anteriores) import de `set_rollback` + as três chamadas com o *porquê*; corpo hoisted para uma local antes da marcação nos ramos 409 e 401; nota de posição load-bearing no ramo 401; bullet da Strategy descrevendo os três explícitos, o herdado e a normalização pós-marcação. **Inalterado nesta pass.**
- [../../backend/core/tests/test_exceptions.py](../../backend/core/tests/test_exceptions.py) — fixture local `atomic_requests`, helper `_handle_in_atomic_block`, `_StubView` com `query_first` e 10 testes / 12 casos (passes anteriores). Nesta pass: asserts de corpo normalizado no ramo do DRF, comentário da prova de escrita reescrito com o motivo real da escolha de `Session`, e a mensagem do assert de premissa apontando para a DW-54.
- [deferred-work.md](deferred-work.md) — duas entradas NOVAS (DW-53, DW-54). Nenhuma entrada existente foi modificada, reaberta ou reescrita.
- [spec-dw-32-exception-handler-set-rollback.md](spec-dw-32-exception-handler-set-rollback.md) — `deferred:` do primeiro item marcado como já promovido; Code Map corrigido; `## Verification` com `lint-imports` e com os dois checks de flag reescritos para exit 0 no caso verde.

### Achados do review

**3ª pass (2026-08-04, esta pass)** — 4 camadas em paralelo (blind-hunter, edge-case-hunter, verification-gap, intent-alignment):

- **Patches aplicados: 6** (medium 2, low 4) — detalhados no Review Triage Log. Os dois medium não são bugs de runtime: são o defer duplicado que faria um sweep futuro cunhar um DW repetido, e o comando de verificação que dava vermelho no caso verde.
- **Itens deferidos: 2** (low) — **DW-53** corrige duas afirmações da DW-52 (a divergência de corpo do `/api/capture` já está pinada por três testes verdes, e esse corpo não está no `schema.yaml`, então a opção `raise` é mais barata do que a entrada faz parecer) e **DW-54** registra os pré-requisitos de ligar `ATOMIC_REQUESTS` (não existe slot em `env.db()`; os dois 400 da DW-52 commitariam; a escrita de auditoria `last_used_at` passa a ser descartada em todo erro por `raise`). Ambas são **aditivas**: nenhuma entrada existente do ledger foi tocada.
- **Itens rejeitados: 19** (low) — entre eles: guardar `set_rollback()` em try/except e try/except em torno de `_normalise_body` (o DRF chama sem guarda; paridade é cláusula Always, e o verification-gap provou que o caminho do `_normalise_body` é inalcançável porque o `_get_error_details` do DRF já força string no raise); teste com log handler que toca o banco (o logging de prod é `StreamHandler` para stdout, não há regressão realista); pinar a ordem `set_rollback` × `logger.critical` e × `str(_NO_ACTIVE_ACCOUNT)` (msgid lazy constante, nada consulta o banco); teste contra uma reimplementação de `set_rollback` que solte o guard `in_atomic_block` (o código usa o do framework, como a cláusula Always exige); `.get(..., False)` no teardown da fixture (a chave sempre existe via `setdefault` do Django — mesmo achado já rejeitado na 1ª pass); dobrar `test_domain_error_marks_rollback` e `test_tenant_scope_violation_marks_rollback` nos vizinhos mais fortes (são as linhas 1 e 2 da matriz congelada, cada uma merece teste nomeado); hoistar os imports locais de `django.contrib.*` (o módulo já tem esse precedente no teste do `LogEntry`); títulos iguais das passes no triage log e `review_loop_iteration: 0` (formato e semântica prescritos pelo workflow — o contador só sobe em loopback de bad_spec, e não houve nenhum); e vários artefatos de workflow em voo (spec em `in-review`, `Auto Run Result` ausente, spec não commitada) — todos resolvidos por esta própria finalização.

**Passes anteriores (2026-08-04)** — 11 patches (medium 3, low 8) e 4 patches (medium 2, low 2); preservados no Review Triage Log acima.

### Recomendação de follow-up

`followup_review_recommended: true`. Contagem só dos achados desta pass triados como `patch`: high 0, medium 2, low 4 → `3 × 2 + 1 × 4 = 10`, que é ≥ 5. Ressalva honesta para quem decidir: nenhum dos 6 patches tocou comportamento de runtime do handler, e as três passes convergiram — 11 → 4 → 6 patches, todos de severidade decrescente e nenhum `high` em nenhuma delas. O score alto vem de dois medium de processo/documentação, não de risco no código.

### Verificação executada

- `uv run pytest core/tests/test_exceptions.py -q` → **32 passed**.
- `uv run pytest -q` (suíte completa) → **1405 passed** em 4m32s. É o que guarda contra vazamento da flag `needs_rollback` para o resto da suíte.
- `uv run ruff check .` → All checks passed. `uv run lint-imports` → **1 kept, 0 broken**.
- `! grep -rq "ATOMIC_REQUESTS" config/` → **exit 0**; laço nos três env files → **exit 0**. Os dois comandos reescritos nesta pass foram rodados na forma nova e dão verde como exit 0 (antes davam exit 1 no mesmo estado).
- Não-vacuidade das três chamadas, rodada nesta pass com script que comenta uma por vez e restaura: sem a do ramo 500 → **1 failed**; sem a do 409 → **4 failed**; sem a do 401 → **2 failed**. `core/exceptions.py` restaurado byte-a-byte (sha `38d6f401cb69cf74a609067a46513ec7156a8e80` antes e depois, `git diff` vazio).
- Frontmatter reparseado como YAML depois dos appends: uma única chave `deferred`, 4 itens, os 2 anteriores preservados com o texto pretendido.
- Fatos que sustentaram os patches, todos conferidos no repo (não aceitos da palavra dos reviewers): exit code do grep; `.env.dev`/`.env.e2e` em `.gitignore:3,5`; `lint-imports` no `ci.yml:77`; lista do port rule em `pyproject.toml:64-68` sem `accounts`; `UserFactory` já importado em `core/tests/test_authentication.py:41` e `test_health.py:18`; `schema.yaml:1116-1131` documentando só o `201` do `capture_create`; e `automation/tests/test_views.py:77,:87,:96` pinando as formas de corpo divergentes.

### Riscos residuais

- `set_rollback` é helper de módulo em `rest_framework.views`, não API pública documentada do DRF (3.17.1 aqui). Um upgrade que mova o símbolo quebra alto (ImportError no boot), não em silêncio — e o intent exigia usar o do framework em vez de reimplementar.
- A superfície de **configuração** continua sem cobertura: os testes provam que o handler honra uma conexão cuja flag já é `True`, não que o encanamento `DATABASE_URL` → `env.db()` → `DATABASES` consiga expressar `ATOMIC_REQUESTS` (não há slot para a chave). Foi o que o intent adiou via Block If, e agora está rastreado como **DW-54** em vez de viver só aqui.
- Os asserts de normalização acrescentados no ramo do DRF são de consistência, não prova forte: o corpo default do `NotAuthenticated` já é `{"detail": ...}` sem `fields`, então eles pegariam uma normalização que *adicionasse* `fields` ou perdesse `detail`, não a ausência de normalização. É o mesmo nível que `test_missing_auth_maps_to_401` usa; ficou registrado para não parecer mais do que é.
- A fixture mexe só no alias `default` (banco único hoje) enquanto o `set_rollback()` do DRF itera `connections.all()`. Um segundo alias passaria batido; a premissa está na docstring da fixture.
- A fixture muta estado process-wide (`connections['default'].settings_dict`, o mesmo objeto de `settings.DATABASES['default']`) e depende do restore no `finally`. A classe de risco é real mesmo com a suíte verde em três passes.
- O corpo do ramo 500 é literal constante e por isso não foi hoisted; se algum dia virar expressão, passa a precisar do mesmo tratamento que os outros dois ganharam.
- Duas ordens permanecem não pinadas por teste de propósito (marcação acima do `logger.critical` e acima de `str(_NO_ACTIVE_ACCOUNT)`): nenhuma tem regressão demonstrável hoje — logging de prod não toca banco e o msgid é lazy constante — mas o comentário do ramo 401 as apresenta junto com a única que **é** pinada (a posição relativa a `_authenticate_header()`). Quem editar aquele bloco não deve ler as três como igualmente garantidas pela suíte.

