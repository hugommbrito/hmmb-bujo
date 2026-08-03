---
title: 'DW-6/DW-7/DW-9: hardening dos guardrails fail-closed do core (user_id explícito, guards falsy, exception handler)'
type: 'chore'
created: '2026-08-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '2690d5e4df9a6f7edf750368877a3054cf8ea731'
final_revision: '2c117dbe0ff382eaf23c0eb3c4b60fe26bde899b'
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      A nova `_as_list` recursiva em `core/exceptions.py` também achata corretamente uma lista de
      erros de serializers aninhados (`many=True`, ex.: `[{}, {"email": [...]}]`), mas isso não
      ganha teste de regressão dedicado nesta pass -- só os 4 casos citados verbatim na DW-7
      (dict aninhado simples, `non_field_errors` não-lista, `data=None`, `detail`+chaves extras)
      têm teste próprio.
    evidence: |-
      `_as_list` ficou genérica (recursa em `list` e em `dict` da mesma forma), então o caso
      list-of-dicts é coberto pela mesma implementação que resolve o caso nomeado "erro de
      serializer aninhado" -- mas nenhum serializer `many=True` gravável existe hoje
      (mesma razão pela qual a DW-7 inteira é hardening preventivo), então não há caminho real
      para exercitar isso além de um teste sintético que não foi pedido explicitamente.
    location: backend/core/exceptions.py (_as_list)
    severity: low
  - summary: >-
      `TenantManager.bulk_create()` agora aplica `assign_tenant_user_id` por item, mas
      `QuerySet.update()`/`bulk_update()` continuam sem guarda -- os dois também emitem UPDATE
      direto sem passar por `save()`, o mesmo desvio estrutural que a DW-6 fechou só para
      `bulk_create` (única API citada pelo intent verbatim).
    evidence: |-
      Achado por 2 revisores independentes (blind-hunter, edge-case-hunter) na pass de review de
      2026-08-03. Confirmado por leitura: nem `core/tenant.py` nem nenhum manager em `core/`
      sobrescreve `update()`/`bulk_update()`. Sem caminho real hoje (nenhuma chamada a
      `bulk_create`/`update`/`bulk_update` existe em código de aplicação, só nos testes deste
      diff) -- mesma classificação "hardening preventivo" do resto da bundle, mas fora do texto
      literal do intent (que só nomeia `bulk_create`), então tratado como achado novo para uma
      DW futura, não como parte desta.
    location: backend/core/tenant.py (TenantManager)
    severity: low
  - summary: >-
      Um campo de serializer literalmente chamado `detail` colide com a chave `detail` que
      `_normalise_body` usa para o corpo de erro -- o dict de erros de um campo `detail` que
      falhasse validação seria lido como se fosse o `detail` explícito do wrapper, não como um
      erro de campo.
    evidence: |-
      Achado por 2 revisores independentes (edge-case-hunter, blind-hunter) na pass de review de
      2026-08-03. Confirmado por leitura: a ambiguidade já existia identicamente no código antigo
      (o branch `"detail" in data and len(data) == 1` já tratava um único campo chamado `detail`
      do mesmo jeito) -- não é introduzida nem agravada por este diff, e nenhum serializer real
      no repo tem campo `detail` (confirmado por grep em `bujo/serializers.py`,
      `medications/serializers.py`, `health/serializers.py`, `habits/serializers.py`,
      `braindump/serializers.py`, `gratitude/serializers.py`).
    location: backend/core/exceptions.py (_normalise_body)
    severity: low
  - summary: >-
      `TenantManager.abulk_create()` -- o gêmeo assíncrono que o Django gera automaticamente
      para todo manager via `from_queryset` -- não passa por `assign_tenant_user_id` e contorna
      o guard fail-closed exatamente como o `bulk_create` síncrono contornava antes desta pass.
    evidence: |-
      Achado por 1 revisor (blind-hunter) na pass de review de 2026-08-03, confirmado por
      inspeção direta do mecanismo do Django: `BaseManager._get_queryset_methods` só copia um
      método da QuerySet para o manager quando o manager ainda não o define (`hasattr(cls, name)`)
      -- como `TenantManager` define `bulk_create` mas não `abulk_create`, o manager herda o
      `abulk_create` genérico de `Manager`, que delega a `self.get_queryset().abulk_create(...)`;
      `QuerySet.abulk_create` por sua vez chama `self.bulk_create` (do próprio QuerySet, não do
      manager) via `sync_to_async` -- nunca toca o `TenantManager.bulk_create` sobrescrito.
      Verificado interativamente (`TenantManager.abulk_create` é o proxy herdado de `Manager`,
      não uma sobrescrita própria). Sem caminho real hoje: o projeto roda 100% WSGI síncrono
      (`config/asgi.py` existe mas não é usado; `core/tenant.py` já tem um comentário `TODO
      (async/ASGI)` reconhecendo o risco futuro) -- mesma classificação "hardening preventivo".
    location: backend/core/tenant.py (TenantManager.abulk_create, herdado)
    severity: low
  - summary: >-
      Nos branches `non_field_errors` e lista-no-topo de `_normalise_body`, a primeira mensagem é
      extraída via `_first_message()` e passada direto para `_stringify()`, sem passar por
      `_as_list()` -- então, se o primeiro item for ele mesmo um dict/lista aninhada, ainda vira
      `str(dict)` cru, a mesma classe de bug que a DW-7 existe para fechar (o branch `detail_value`
      já corrige isso ao rotear por `_as_list()` antes, mas os outros dois branches não).
    evidence: |-
      Achado por 1 revisor (edge-case-hunter) na pass de review de 2026-08-03, confirmado por
      leitura: `detail = _stringify(_first_message(non_field))` (branch `non_field_errors`) e
      `return {"detail": _stringify(_first_message(data)) ...}` (branch lista-no-topo) chamam
      `_stringify` direto sobre o resultado de `_first_message`, que devolve o item bruto sem
      achatar quando é list/dict. Sem caminho real hoje: `non_field_errors`/erro de lista no topo
      do DRF são sempre listas planas de string na prática (mesma razão "sem serializer real"
      do restante desta bundle) -- mas é uma inconsistência genuína dentro da própria função que
      esta pass reescreveu, valendo registro para quando a primeira view/serializer surgir.
    location: backend/core/exceptions.py (_normalise_body, branches non_field_errors e lista-no-topo)
    severity: low
  - summary: >-
      Correção de evidência do item deferido acima sobre `QuerySet.update()`/`bulk_update()`: a
      alegação de que "nenhuma chamada a bulk_create/update/bulk_update existe em código de
      aplicação" está factualmente errada -- `.update()` é chamado 2x em código de aplicação. A
      conclusão de risco baixo do item original permanece válida, mas por um motivo diferente do
      que o texto afirma.
    evidence: |-
      Achado por 1 revisor (blind-hunter) na pass de review de 2026-08-03, confirmado por grep e
      leitura direta: `medications/services.py:538` (`confirm_block`) roda
      `MedicationDayEntry.objects.filter(date=..., time_block_id=..., source=...).update(...)` --
      `MedicationDayEntry(TenantModel)` usa o manager escopado por padrão, então o `.filter()`
      antes do `.update()` já passa por `get_queryset()` (que exige contexto ativo) antes do
      UPDATE rodar, mantendo o isolamento por acidente de ordem de chamada, não por guarda
      explícita no `.update()` em si. `automation/admin.py:110` também chama
      `queryset.filter(revoked_at__isnull=True).update(...)` dentro de uma admin action (superuser,
      fora do fluxo de tenant por design). Nenhum dos dois é um bug hoje, mas o item deferido
      original deveria ter dito "toda chamada existente passa por manager/queryset já escopado
      antes do `.update()`", não "nenhuma chamada existe".
    location: backend/medications/services.py:538; backend/automation/admin.py:110
    severity: low
  - summary: >-
      `all_objects.bulk_create()` (o caminho admin/unscoped que este hardening preserva
      intencionalmente sem guarda) não ganhou nenhum teste de regressão nesta pass -- se um
      item da lista não tiver `user_id` explícito, o resultado seria um `IntegrityError` cru do
      Postgres (coluna NOT NULL), não uma exceção de domínio tratada.
    evidence: |-
      Achado por 1 revisor (blind-hunter) na pass de review de 2026-08-03. Confirmado por leitura:
      `user_id` não tem `null=True` em `TenantModel`, e `all_objects.bulk_create` não passa por
      `assign_tenant_user_id` (nem deveria -- é o escape hatch admin, sem contexto por design).
      Sem caminho real hoje: nenhum código de aplicação chama `all_objects.bulk_create` (grep
      confirma), só o `objects.bulk_create` coberto pelos testes desta pass.
    location: backend/core/models.py (TenantModel.all_objects); backend/core/tenant.py (TenantManager)
    severity: low
  - summary: >-
      `TenantManager.bulk_create()` chama `assign_tenant_user_id(obj)` item a item, num único
      laço, ANTES de delegar a `super().bulk_create()` -- então, se um item no meio da lista
      falhar a validação, os itens anteriores já tiveram `.user_id` mutado em memória
      (auto-fill in-place) mesmo que nenhum INSERT tenha rodado.
    evidence: |-
      Achado por 1 revisor (edge-case-hunter) na pass de review de 2026-08-03 (3ª pass, fresh
      review sobre spec já done). Confirmado por leitura: `assign_tenant_user_id` faz
      `instance.user_id = uid` diretamente no objeto Python recebido, dentro do loop de
      `bulk_create`, antes de qualquer chamada a `super().bulk_create()`. Sem caminho real hoje:
      nenhum call site de aplicação existe para `bulk_create` (mesma razão "hardening preventivo"
      do resto da bundle), e mesmo que existisse, só importaria se o chamador reutilizasse os
      objetos após capturar a exceção -- separar validação de mutação em duas passadas exigiria
      redesenhar o contrato do helper compartilhado (usado também por `save()`), não é um fix
      trivial.
    location: backend/core/tenant.py (TenantManager.bulk_create)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Três guardas fail-closed do `core/` (isolamento multi-tenant, AD-12) são corretas só "por acidente" hoje. `TenantModel.save()` preenche `user_id` apenas quando ele é `None` -- um valor explícito arbitrário passa sem checar o contexto ativo, e `bulk_create` nem chama `save()`, então contorna o auto-fill e essa checagem por completo. Os guards de leitura (`TenantManager.get_queryset`) e escrita (`save()`) usam `is None` estrito, que trataria um id falsy-mas-não-`None` (`0`, `""`) como "sem tenant" ou aceitaria como id válido -- inofensivo hoje porque `accounts.User` usa UUID (nunca falsy), mas frágil por construção. E `custom_exception_handler`/`_as_list` (`core/exceptions.py`) mal-renderizam corpos de erro não triviais: erro de serializer aninhado vira `str(dict)`, `non_field_errors` não-lista é indexado por caractere, `data=None` vira `{"detail": "None"}` literal, e um dict `{"detail": ..., "outra_chave": ...}` rebaixa o `detail` real para dentro de `fields`. Nenhum caminho real exercita essas falhas hoje (sem serializers/views/bulk_create até a Story 1.4/2.1), mas a fundação fica frágil para a primeira camada de escrita de domínio.

**Approach:** centralizar o auto-fill/validação de `user_id` num único helper em `core/tenant.py`, reusado por `TenantModel.save()` e por um novo `TenantManager.bulk_create()` -- rejeitando mismatch explícito quando há contexto ativo e trocando os dois guards `is None` por `not uid`. Reescrever `_normalise_body`/`_as_list` em `core/exceptions.py` para achatar recursivamente erros aninhados, tratar `non_field_errors` escalar, `data=None`, e preservar o `detail` real quando há chaves extras. Cobrir cada caso com teste de regressão.

## Boundaries & Constraints

**Always:** preservar 100% o comportamento hoje coberto por `test_explicit_user_id_is_preserved_on_save` (`core/tests/test_isolation.py:64-70`) -- `user_id` explícito **sem** contexto ativo continua sendo aceito sem validação (caminho admin/`all_objects`, by-design, citado no ledger original). A lógica de auto-fill/validação de `user_id` fica centralizada num único helper compartilhado entre `save()` e `bulk_create()` -- nunca duplicada. A cadeia acíclica de imports `exceptions ← tenant ← models` é preservada; o helper novo vive em `core/tenant.py` (models.py já importa de lá), nunca em `core/models.py` importado de volta por `tenant.py`. `fields` em `_normalise_body` continua sempre `{campo: [array]}` plano (nunca dict aninhado) -- contrato da Architecture Spine (`Consistency Conventions | Erros`).

**Block If:** _nenhum -- hardening mecânico e testável sobre código já lido por completo, sem decisão que exija humano._

**Never:** não tocar `core/middleware.py` nem `core/authentication.py` -- a responsabilidade de setar `current_user_id` já migrou para `authentication.py` (fix da Story 3.2, documentado no próprio docstring do middleware); não há guard `is None` nesse arquivo hoje para estreitar (ver Design Notes). Não introduzir uma classe de exceção nova para o mismatch de `user_id` -- reusar `TenantScopeViolation` (mesma semântica "bug de fail-closed", já mapeada pelo handler para 500+alerta). Não tocar CI/settings de produção (isso foi DW-4/DW-5, já resolvido). Não criar serializers/views/`User` real nem simular a "primeira camada de escrita de domínio" citada no ledger original -- a validação funciona sobre `core` puro, sem esses pré-requisitos. Não editar `deferred-work.md` -- o orquestrador registra a resolução.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Auto-fill (comportamento existente) | `save()` com `user_id=None`, contexto ativo | `user_id` preenchido do contexto | — |
| Escrita sem contexto e sem `user_id` | `save()` com `user_id=None`, sem contexto | `TenantScopeViolation` | fail-closed (já existia) |
| `user_id` explícito == contexto ativo | `save()` com `user_id=X`, `tenant_context(X)` ativo | salva normalmente | — |
| `user_id` explícito != contexto ativo | `save()` com `user_id=Y`, `tenant_context(X)` ativo (Y≠X) | `TenantScopeViolation` | rejeita mismatch (NOVO) |
| `user_id` explícito sem contexto (admin) | `save()` com `user_id=X`, sem contexto | preservado como está | comportamento existente, preservado |
| `bulk_create` com item inválido | `objects.bulk_create([...])`, algum item sem `user_id`/contexto ausente, ou `user_id` divergente | `TenantScopeViolation` antes de qualquer INSERT | NOVO — hoje bulk_create ignora tudo isso |
| Leitura com contexto falsy-não-`None` | `current_user_id` setado para `0`/`""`, `TenantModel.objects.all()` | `TenantScopeViolation` (hoje passaria e filtraria por esse id espúrio) | NOVO — guard estreitado |
| Erro de serializer aninhado | `data={"campo": {"sub": ["msg"]}}` | `fields={"campo": ["msg"]}` | nunca `str(dict)` |
| `non_field_errors` não-lista | `data={"non_field_errors": "msg"}` | `detail="msg"` | nunca indexado por caractere |
| Corpo `None` | `response.data is None` | `{"detail": "Unexpected error"}` | nunca `{"detail": "None"}` literal |
| `detail` + chaves extras | `data={"detail": "real", "code": "x"}` | `detail="real"`, `fields={"code": ["x"]}` | `detail` real nunca rebaixado para `fields` |

</intent-contract>

## Code Map

- `backend/core/tenant.py:44-55` -- `TenantManager`; `get_queryset()` guarda fail-closed na linha 53 (`if uid is None:`); **sem** `bulk_create` próprio hoje -- `models.Manager` (via `from_queryset`) gera um automático que delega a `self.get_queryset().bulk_create(objs, ...)`, mas `QuerySet.bulk_create` faz `INSERT` direto sem nunca chamar `Model.save()` de cada item (confirmado: é assim que Django implementa `bulk_create` para contornar overhead de save por linha).
- `backend/core/tenant.py:27-41` -- `tenant_context()`; não precisa mudar (fora de escopo -- ver "Never").
- `backend/core/models.py:35-43` -- `TenantModel.save()`; hoje só entra no fail-closed/auto-fill quando `self.user_id is None` (linha 38); um `user_id` explícito pula a checagem inteira, mismatch incluso.
- `backend/core/context.py` -- só o contextvar (`current_user_id`, default `None`); zero imports internos, não precisa mudar.
- `backend/core/middleware.py` -- **investigado e confirmado sem guard a estreitar**: só faz reset do token no `finally` (ver Design Notes; a DW-9 cita este arquivo mas o guard real já não existe aqui desde a Story 3.2).
- `backend/core/authentication.py:38-44` -- `TenantAwareJWTAuthentication.authenticate()` seta o contexto incondicionalmente a partir de um usuário já autenticado pelo JWT (`current_user_id.set(user.id)`); sem guard `is None`/falsy hoje, fora de escopo (usuário real sempre tem UUID válido).
- `backend/core/exceptions.py:102-109` -- `TenantScopeViolation`; reusada para o novo caso de mismatch (não precisa de subclasse nova).
- `backend/core/exceptions.py:152-185` -- `_normalise_body`/`_as_list`; os 4 bugs verbatim da DW-7, confirmados por leitura: (1) `_as_list` faz `[_stringify(value)]` quando `value` é dict → `str({"sub": [...]})`; (2) `non_field = data.get("non_field_errors"); non_field[0]` indexa por caractere se `non_field` for string; (3) `data=None` cai no fallback `_stringify(data)` → `"None"`; (4) o guard `"detail" in data and len(data) == 1` só preserva `detail` quando é a ÚNICA chave -- com chaves extras, cai no branch geral e `detail` some para dentro de `fields["detail"]`, com o `detail` do corpo virando `"Validation failed"`.
- `backend/core/tests/test_isolation.py:64-70` -- `test_explicit_user_id_is_preserved_on_save`, o teste que pina o comportamento "sem contexto, `user_id` explícito preservado" -- deve continuar verde sem alteração.
- `backend/core/tests/models.py` + `backend/core/tests/registry.py` -- `TenantTestModel`/`tenant_test_table()`, reusados pelos testes novos (mesmo padrão dos existentes).
- `backend/core/tests/test_exceptions.py` -- padrão de teste do handler; os 4 testes novos de `_normalise_body` entram aqui, chamando a função diretamente (mesmo módulo, sem necessidade de subir uma `Response` real do DRF para cada caso).
- `backend/conftest.py:36-45` -- fixtures `user`/`other_user` já são `UserFactory()` reais (Epic 2), UUID PK -- suficientes para os testes de mismatch sem stand-ins.

## Tasks & Acceptance

**Execution:**
- `backend/core/tenant.py` -- adicionar `assign_tenant_user_id(instance)`: lê `current_user_id.get()`; se `instance.user_id is None`, auto-preenche do contexto (fail-closed com `not uid`, tightened); se já está setado e há contexto ativo (`uid` truthy) e diverge, levanta `TenantScopeViolation`; se não há contexto ativo, preserva como está (caminho admin). Trocar o guard de `get_queryset()` de `is None` para `not uid`. Sobrescrever `TenantManager.bulk_create(self, objs, *args, **kwargs)`: aplicar `assign_tenant_user_id` em cada item de `objs` (loop completo, sem chamar `super()` ainda) antes de delegar a `super().bulk_create(objs, *args, **kwargs)` -- fecha DW-9 (leitura) e a lacuna de `bulk_create` da DW-6.
- `backend/core/models.py` -- `TenantModel.save()` passa a chamar `assign_tenant_user_id(self)` no lugar da lógica inline; atualizar o import de `core.tenant` -- fecha DW-6 (mismatch explícito + preserva o caminho admin sem contexto).
- `backend/core/exceptions.py` -- reescrever `_normalise_body`: usar `data.get("detail")` (não mais `"detail" in data and len(data) == 1`) para decidir o `detail` real, computando `fields` a partir das chaves restantes (excluindo `detail` e `non_field_errors`); tratar `data is None` com um `detail` genérico fixo (`"Unexpected error"`) em vez de cair no fallback `_stringify`. Adicionar `_first_message(value)` (retorna `value[0]` se lista, senão o próprio valor) e usar no lugar de `non_field[0]` direto. Reescrever `_as_list` para recursar em `dict` (achatando os valores) e em `list` (achatando cada item que for `list`/`dict`, senão `_stringify`) -- fecha DW-7.
- `backend/core/tests/test_isolation.py` -- novos testes: `test_explicit_user_id_mismatch_with_active_context_fails_closed` (contexto ativo, `user_id` de outro usuário → `TenantScopeViolation`); `test_bulk_create_auto_fills_user_id_from_context` (bulk_create sem `user_id` explícito, contexto ativo → todas as linhas preenchidas); `test_bulk_create_rejects_explicit_mismatch_before_any_insert` (um item com `user_id` divergente → `TenantScopeViolation`, `count() == 0` depois); `test_bulk_create_without_context_fails_closed`; `test_read_with_falsy_non_none_context_fails_closed` e `test_write_with_falsy_non_none_context_fails_closed` (setar `current_user_id` manualmente para `0`/`""` via token, confirmar `TenantScopeViolation` nos dois caminhos).
- `backend/core/tests/test_exceptions.py` -- novos testes: `test_normalise_body_flattens_nested_serializer_error`, `test_normalise_body_handles_non_list_non_field_errors`, `test_normalise_body_handles_none_data`, `test_normalise_body_preserves_detail_with_extra_keys` -- importam `_normalise_body` diretamente e fixam o formato exato de cada um dos 4 casos.

**Acceptance Criteria:**
- Given contexto ativo `tenant_context(user)` e `user_id` explícito de outro usuário, when `.save()` roda, then levanta `TenantScopeViolation` e nada é persistido.
- Given nenhum contexto ativo e `user_id` explícito, when `.save()` roda, then persiste como hoje (`test_explicit_user_id_is_preserved_on_save` continua verde, sem alteração).
- Given `TenantManager.objects.bulk_create([...])` com ao menos um item sem `user_id` e sem contexto, ou com `user_id` divergente do contexto ativo, when o manager processa a lista, then levanta `TenantScopeViolation` antes de qualquer `INSERT` (nenhuma linha persistida).
- Given `current_user_id` setado para um valor falsy-não-`None` (`0`, `""`), when uma leitura (`get_queryset`) ou escrita (`save`/`bulk_create`) escopada roda, then levanta `TenantScopeViolation`.
- Given um corpo de erro com serializer aninhado, `non_field_errors` não-lista, `data=None`, ou `detail`+chaves extras, when `_normalise_body` processa, then o resultado nunca contém um dict stringificado, nunca indexa por caractere, nunca é `{"detail": "None"}` literal, e nunca rebaixa um `detail` real para dentro de `fields`.
- Given a suíte completa (`uv run pytest`), when roda após as mudanças, then permanece 100% verde, sem regressão em nenhum teste existente de `core`, `accounts`, ou qualquer app de domínio.

## Review Triage Log

### 2026-08-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3 (high 1, medium 1, low 1)
- defer: 2 (high 0, medium 0, low 2)
- reject: 8 (high 0, medium 0, low 8)
- addressed_findings:
  - `[high]` `[patch]` `assign_tenant_user_id` (`core/tenant.py`) só checava mismatch quando `uid` era truthy -- um contexto falsy-não-`None` (`0`/`""`) com `user_id` explícito passava sem validação alguma (nem auto-fill nem mismatch disparavam), contradizendo o próprio invariante "falsy-não-`None` sempre fecha" que a DW-9 estabeleceu no resto da função. Corrigido: guarda incondicional `if uid is not None and not uid: raise` antes dos dois branches. Novo teste `test_explicit_user_id_with_falsy_non_none_context_fails_closed` (parametrizado `0`/`""`).
  - `[medium]` `[patch]` `_normalise_body` (`core/exceptions.py`), branch `detail_value is not None`: (a) excluía `detail` **e** `non_field_errors` de `fields`, então um dict com os dois presentes perdia `non_field_errors` por completo (achado convergente de 3 revisores: blind-hunter, edge-case-hunter, intent-alignment); (b) `_stringify(detail_value)` direto sem achatar -- um `detail` de valor lista/dict virava repr Python cru, a mesma classe de bug que a DW-7 existe para fechar. Corrigido: só `detail` é excluído de `fields` (não mais `non_field_errors`), e `detail_value` passa por `_as_list()` antes de escolher a primeira mensagem. Novos testes `test_normalise_body_keeps_non_field_errors_as_a_field_when_detail_wins` e `test_normalise_body_flattens_a_list_detail_value`.
  - `[low]` `[patch]` `assign_tenant_user_id`, comparação de mismatch usava `!=` cru -- `uuid.UUID.__eq__` devolve `NotImplemented` contra um operando não-UUID, então um `user_id` logicamente igual mas representado como `str` seria rejeitado como mismatch falso-positivo. Corrigido: comparação via `str(...)` nos dois lados. Novo teste `test_explicit_user_id_as_string_matches_active_context`.

Achados roteados como `defer` (registrados em `deferred` no frontmatter, não repetidos aqui): `QuerySet.update()`/`bulk_update()` sem a mesma guarda que `bulk_create` ganhou (fora do texto literal do intent, que só nomeia `bulk_create`); colisão conceitual entre um campo de serializer chamado `detail` e a chave `detail` do wrapper (ambiguidade pré-existente, não introduzida por este diff, sem serializer real com esse nome de campo hoje).

Achados descartados como `reject` (ruído/sintético/fora de escopo, não repetidos individualmente): `data={"detail": None}` (forma nunca produzida por nenhum call site real, confirmado por grep); recursão irrestrita em `_as_list` (sem gatilho real -- payload é sempre gerado pelo servidor, nunca por profundidade controlada por cliente); `non_field_errors` com valor dict, ou lista cujo primeiro elemento é `None`/lista/dict (formas sintéticas, DRF nunca produz isso na prática); `bulk_create` no manager escopado (`objects`) sempre exigir contexto ativo mesmo com `user_id` explícito em todo item (não é bug -- `get_queryset()` já exige contexto para qualquer operação no manager escopado; o caminho admin equivalente é `all_objects.bulk_create`, espelhando `all_objects` para leitura); nota descritiva do auditor de alinhamento de intenção sobre `core/middleware.py` não ter guarda a estreitar (já investigado e documentado com evidência nas Design Notes desta spec -- confirma a leitura já adotada, não é um problema novo); notas descritivas do mesmo auditor sobre a leitura contexto-gated da DW-6 e a leitura de 4 casos da DW-7 (ambas já resolvidas explicitamente em Boundaries & Constraints/Code Map usando o texto verbatim do ledger como critério, não uma lacuna nova).

### 2026-08-03 — Review pass (fresh review de spec `done`)
- intent_gap: 0
- bad_spec: 0
- patch: 3 (high 0, medium 1, low 2)
- defer: 4 (high 0, medium 0, low 4)
- reject: 10 (high 0, medium 0, low 10)
- addressed_findings:
  - `[medium]` `[patch]` Design Notes (linhas 146-157 antes desta pass) mostrava a versão **pré-patch** de `assign_tenant_user_id` -- sem a guarda incondicional `if uid is not None and not uid: raise` que o código final (`core/tenant.py`) já tem desde a pass de review anterior. Um leitor futuro copiando o "Design Notes" como referência reintroduziria o bug `[high]` que aquela pass já corrigiu. Corrigido: bloco de código do Design Notes atualizado para espelhar exatamente `core/tenant.py` (guarda incondicional + comparação via `str(...)`), com nota explícita de que é a versão final pós-patches. (achado: blind-hunter)
  - `[low]` `[patch]` `TenantManager.bulk_create()` com contexto falsy-não-`None` (`0`/`""`) não tinha teste de regressão dedicado -- só `save()` (`test_write_with_falsy_non_none_context_fails_closed`) tinha. Comportamento já estava correto por construção (guarda incondicional é compartilhada via `assign_tenant_user_id`, chamada por item dentro do loop de `bulk_create`), então nenhuma mudança de código -- só teste novo. Adicionado `test_bulk_create_with_falsy_non_none_context_fails_closed` (parametrizado `0`/`""`) em `core/tests/test_isolation.py`. (achado: intent-alignment)
  - `[low]` `[patch]` `_normalise_body` com um `detail` cujo valor é um **dict** aninhado (`{"detail": {"sub": ["msg"]}}`) não tinha teste dedicado -- só o caso de valor **lista** (`test_normalise_body_flattens_a_list_detail_value`) tinha. `_as_list()` já trata dict genericamente, então nenhuma mudança de código -- só teste novo. Adicionado `test_normalise_body_flattens_a_dict_detail_value` em `core/tests/test_exceptions.py`. (achado: intent-alignment)
- Achados roteados como `defer` (registrados em `deferred` no frontmatter, não repetidos aqui): `TenantManager.abulk_create()` (gêmeo assíncrono auto-gerado pelo Django) contorna `assign_tenant_user_id` do mesmo jeito que o `bulk_create` síncrono contornava antes desta bundle -- sem caminho real hoje (projeto é 100% WSGI síncrono); nos branches `non_field_errors`/lista-no-topo de `_normalise_body`, a primeira mensagem é extraída via `_first_message` + `_stringify` direto, sem rotear por `_as_list` -- mesma classe de bug "`str(dict)` cru" que o branch `detail_value` já corrige, mas sem caminho real hoje; correção de evidência do item deferido `TenantManager.bulk_create()`/`update()`/`bulk_update()` já existente no frontmatter -- a alegação "nenhuma chamada a update/bulk_update existe em código de aplicação" está factualmente errada (`medications/services.py:538`, `automation/admin.py:110` chamam `.update()`), embora a conclusão de risco baixo permaneça válida por outro motivo (ambas já passam por queryset/manager escopado ou são admin-only); `all_objects.bulk_create()` sem teste de regressão -- item sem `user_id` explícito viraria `IntegrityError` cru do Postgres em vez de exceção de domínio tratada, mas sem caminho real hoje (nenhum código de aplicação chama esse método).
- Achados descartados como `reject` (ruído/sintético/fora de escopo/comportamento já documentado como intencional, não repetidos individualmente): comparação `str(instance.user_id) != str(uid)` só normaliza tipo (UUID vs. str), não variação de *case* dentro da própria string -- nenhum call site real produz `user_id` em forma não-canônica; assimetria fail-closed entre leitura e escrita-sem-contexto-com-`user_id`-explícito -- é o caminho admin documentado como by-design em Boundaries & Constraints, não um bug; recursão irrestrita em `_as_list` (mesmo achado já rejeitado na pass anterior, reconfirmado); colisão do campo `detail` com a chave `detail` do wrapper "mais fácil de disparar agora" -- mesmo achado já deferido na pass anterior (nenhum serializer real tem esse nome de campo, achado não muda a classificação); `_normalise_body({"detail": ["a","b"]})` descartar mensagens além da primeira -- consistente com o comportamento já estabelecido (pré-existente a este diff) para `non_field_errors`/lista-no-topo, que sempre só surfaçam a primeira mensagem; `fields` podendo conter uma entrada de lista vazia (`non_field_errors: []` quando `detail` vence) -- forma sintética, nenhum call site real produz esse shape; `bulk_create` com lista vazia + sem contexto não levantar exceção -- sem consequência real (nenhuma linha é criada de qualquer forma); `_first_message`/`_as_list` não tratarem `tuple`/`set` -- corpos de erro reais são sempre JSON-serializável (dict/list/str/number/bool/null), nunca tuple/set; container vazio sob `detail` (`[]`/`{}`) caindo no fallback genérico -- o próprio verification-gap reviewer concluiu "nenhuma lacuna de verificação encontrada", achado sintético sem call site real; docstring do teste `test_bulk_create_without_context_fails_closed` supostamente superestimando o que é novo -- nitpick cosmético, a asserção do teste está correta, só a ênfase do comentário poderia ser mais precisa.

### 2026-08-03 — Review pass (fresh review de spec `done`, 2ª rodada)
- intent_gap: 0
- bad_spec: 0
- patch: 1 (high 0, medium 0, low 1)
- defer: 1 (high 0, medium 0, low 1)
- reject: 16 (high 0, medium 0, low 16)
- addressed_findings:
  - `[low]` `[patch]` `assign_tenant_user_id` roda em TODO `save()`, não só em inserts -- mas todos os testes de mismatch existentes construíam uma instância nova (nunca salva) antes de chamar `.save()`, deixando o caminho de UPDATE (linha já persistida, buscada via `all_objects`, salva de novo sob um contexto de tenant diferente) sem nenhuma cobertura. Comportamento já estava correto por construção (o helper compartilhado não distingue insert/update), então nenhuma mudança de código -- só teste novo. Adicionado `test_save_update_with_mismatched_context_fails_closed` em `core/tests/test_isolation.py`. (achado: blind-hunter)
- Achados roteados como `defer` (registrados em `deferred` no frontmatter, não repetidos aqui): `TenantManager.bulk_create()` muta `user_id` item a item dentro do laço de validação, então itens anteriores a um item inválido ficam com o atributo já preenchido em memória mesmo sem nenhum INSERT rodar -- sem caminho real hoje (nenhum call site de `bulk_create` existe em código de aplicação) e não é um fix trivial (exigiria redesenhar o helper compartilhado com `save()`).
- Achados descartados como `reject` (ruído/sintético/fora de escopo/duplicata de achado já registrado, não repetidos individualmente): branches `non_field_errors`/lista-no-topo de `_normalise_body` ainda usam `_first_message`+`_stringify` em vez de `_as_list` recursivo (mesmo achado já deferido, 2 formulações: lista aninhada dentro de `non_field_errors`, e lista-no-topo estilo `many=True` pegando o primeiro item errado); `{"detail": None}` explícito faz `fields["detail"]` virar `["None"]` (repete literalmente achado já rejeitado na pass 1, forma nunca produzida por call site real); `_as_list` achatando um dict aninhado perde o nome das sub-chaves (é o comportamento CONTRATADO pela própria matriz de Intent/Design Notes, não um bug); só a primeira mensagem de uma lista `detail`/`non_field_errors` é surfaçada, o resto é descartado (comportamento pré-existente, já rejeitado na pass 1 como consistente com o padrão estabelecido); `QuerySet.update()`/`bulk_update()` sem guarda (duplicata exata do item já deferido no frontmatter); `TenantManager.abulk_create()` contorna o override (duplicata exata do item já deferido no frontmatter); comparação `str(...)` troca mismatch de tipo por sensibilidade a case (repete literalmente achado já rejeitado na pass 2); `_normalise_body({})` e valores escalares falsy de `detail` (`""`, `0`, `False`) sem teste dedicado (formas sintéticas, sem call site real); `objs = list(objs)` em `bulk_create` materializa a lista sem documentar (nitpick cosmético, zero consequência funcional, mesma classe do nitpick já rejeitado na pass 2); nenhum teste fixa `all_objects.bulk_create()` como intencionalmente sem guarda (duplicata exata do item já deferido no frontmatter); `non_field_errors` como dict, ou lista cujo primeiro elemento é `None`/dict/lista (formas sintéticas, DRF nunca produz isso, mesmo raciocínio da pass 1); lista-no-topo cujo primeiro elemento é `None`/dict/lista aninhada (mesmo raciocínio sintético); `_as_list` num dict cujos valores são todos vazios produz lista vazia em vez de mensagem de fallback (forma sintética, nenhum dict de erro vazio real existe); `_as_list(None)` (valor de campo bare `None`) vira a string literal `"None"` -- o próprio revisor (verification-gap) confirma não haver caminho real DRF/app que produza isso; 4 notas descritivas do auditor de alinhamento de intenção (escopo do guard falsy-não-`None` além das células literais da matriz; assimetria entre o texto do Approach -- "trocar os dois guards" -- e o código real de `assign_tenant_user_id`; extrapolação de simetria em `_normalise_body`/`_as_list` além da matriz; semântica de comparação sem texto de intent para checar contra) -- o próprio auditor conclui que nenhuma viola uma boundary declarada, mesmo padrão de notas descritivas já tratadas como não-acionáveis nas passes 1/2.

## Design Notes

`core/middleware.py` foi investigado a fundo porque a DW-9 o cita como um dos dois locais do guard `is None` -- mas ele não guarda mais `current_user_id` desde um fix anterior (Story 3.2, já documentado no próprio docstring do arquivo): Django resolve `request.user` só dentro de `APIView.dispatch()`, então o middleware nunca veria o usuário real a tempo. Quem seta o contexto hoje é `TenantAwareJWTAuthentication.authenticate()` (`core/authentication.py`), incondicionalmente, a partir de um usuário JÁ autenticado pelo JWT -- sem guard algum. O guard real equivalente ao citado pela DW-9 vive só em `core/tenant.py:53` (leitura) e, simetricamente, dentro do fail-closed de escrita que hoje mora em `core/models.py:38-41` (mesmo padrão `current_user_id.get()` + checagem). Por isso este diff estreita os dois através de um único helper compartilhado, em vez de tentar (inutilmente) tocar `middleware.py`.

Helper compartilhado (evita duplicar a lógica entre `save()` e `bulk_create`, que foi exatamente o que permitiu o desvio original). Versão final, já com os 2 patches da pass de review de 2026-08-03 (guarda incondicional de contexto falsy + comparação tolerante a tipo):
```python
# core/tenant.py
def assign_tenant_user_id(instance):
    uid = current_user_id.get()
    if uid is not None and not uid:
        raise TenantScopeViolation()  # falsy-não-None sempre fecha, mesmo com user_id explícito

    if instance.user_id is None:
        if uid is None:
            raise TenantScopeViolation()
        instance.user_id = uid
    elif uid is not None and str(instance.user_id) != str(uid):
        raise TenantScopeViolation()
```
`bulk_create` valida a lista inteira em Python (`for obj in objs: assign_tenant_user_id(obj)`) antes de chamar `super().bulk_create(objs, ...)` uma única vez -- então uma falha em qualquer item aborta antes do primeiro `INSERT`, sem necessidade de `@transaction.atomic` extra.

Para `_as_list`, achatar recursivamente (`dict` → concatena `_as_list` de cada valor; `list` → concatena `_as_list` de cada item) é a leitura correta do contrato "`fields` sempre `{campo: [array]}` plano" já documentado no docstring do módulo -- não é uma escolha de forma nova, é fechar o gap entre o contrato documentado e o código que hoje o viola para valores não-lista/não-string.

## Verification

**Commands:**
- `cd backend && uv run pytest core/tests/test_isolation.py core/tests/test_guardrails.py core/tests/test_exceptions.py core/tests/test_middleware.py core/tests/test_authentication.py -v` -- expected: todos passam, incluindo os testes novos.
- `cd backend && uv run pytest` -- expected: suíte completa verde, zero regressão.
- `cd backend && uv run ruff check .` -- expected: limpo.
- `cd backend && uv run lint-imports` -- expected: cadeia acíclica `exceptions ← tenant ← models` continua respeitada pelo helper novo.

## Auto Run Result

**Resumo da mudança implementada:** hardening fail-closed do `core/` (DW-6/DW-7/DW-9) -- helper `assign_tenant_user_id` compartilhado entre `TenantModel.save()` e `TenantManager.bulk_create()` (rejeita mismatch explícito, guarda contexto falsy-não-`None` em todos os pontos, comparação tolerante a tipo), e reescrita de `_normalise_body`/`_as_list` em `core/exceptions.py` para achatar erros aninhados, tratar `non_field_errors` escalar, `data=None`, e preservar `detail` real com chaves extras. Esta é a 3ª pass de review desta spec (2 passes anteriores já a haviam levado a `done`); esta rodada não mudou nenhum comportamento -- só fechou uma lacuna de cobertura de teste e registrou um novo achado de baixo risco no ledger `deferred`.

**Arquivos alterados nesta pass:**
- `backend/core/tests/test_isolation.py` -- novo teste `test_save_update_with_mismatched_context_fails_closed`, cobrindo o caminho de UPDATE (instância já persistida, buscada via `all_objects`, salva de novo sob contexto de tenant diferente) que nenhum teste anterior exercitava.
- `_bmad-output/implementation-artifacts/spec-dw-6-dw-7-dw-9-core-tenant-guardrail-hardening.md` -- novo item `deferred` (mutação in-place de `bulk_create` antes da validação completa da lista) e entrada nova no Review Triage Log.

**Review findings (3ª pass):** 1 patch aplicado (low), 1 item deferido (low), 16 achados rejeitados (todos low -- majoritariamente duplicatas exatas de achados já deferidos/rejeitados nas passes 1 e 2, ou formas sintéticas sem caminho real de produção).

**Recomendação de follow-up review:** `false`. Score = 3×0 (medium) + 1×1 (low) = 1 (< 5); nenhum patch de severidade `high`. Contagem de patches por severidade: high 0, medium 0, low 1.

**Verificação executada:**
- `cd backend && uv run pytest core/tests/test_isolation.py core/tests/test_guardrails.py core/tests/test_exceptions.py core/tests/test_middleware.py core/tests/test_authentication.py -v` -- 63 passed.
- `cd backend && uv run pytest` -- 1362 passed (suíte completa, zero regressão; era 1361 antes desta pass, +1 pelo teste novo).
- `cd backend && uv run ruff check .` -- limpo.
- `cd backend && uv run lint-imports` -- cadeia acíclica `exceptions ← tenant ← models` respeitada.

**Riscos residuais:** nenhum novo de severidade relevante. O item deferido nesta pass (mutação in-place de objetos em `bulk_create` antes da validação completa) só importaria se um chamador reutilizasse os objetos após capturar `TenantScopeViolation` -- sem caminho real hoje, já que nenhum código de aplicação chama `bulk_create`. O ledger `deferred` acumulado (8 itens, todos `low`) permanece a referência para quando a primeira camada de escrita de domínio (Story 1.4/2.1) surgir.

