"""Autenticação dedicada por token de automação (AD-19 item 2, AC3/AC4).

`AutomationTokenAuthentication` valida um `Authorization: Bearer <token>` contra
o `token_hash` (SHA-256) de um `AutomationToken` não-revogado e, ao ter sucesso,
**seta o tenant context (AD-12)** com o dono do token — exatamente o mesmo
mecanismo de `core.authentication.TenantAwareJWTAuthentication`:

1. Esta classe **seta** o contexto e **stasha o `contextvars.Token`** em
   `request._request._tenant_context_token` (o `_request` é o `HttpRequest` cru,
   objeto *diferente* do `rest_framework.request.Request` passado a
   `authenticate()`; stashar no wrapper vaza contexto entre requests — bug real).
2. `core.middleware.TenantMiddleware` **reseta** no `finally`. Nada a mudar lá —
   ele já reseta qualquer token stashado, venha de JWT ou de token de automação.

Import de `current_user_id`: de **`core.context`**, NÃO de `core.tenant` — este
importa `core.exceptions`, que o Django resolve muito cedo, arriscando um
`ImportError` circular. `core/authentication.py` faz o mesmo pela mesma razão.

Opt-in **per-view**: NÃO está em `DEFAULT_AUTHENTICATION_CLASSES`. As views das
Stories 12.5/12.6 declaram `authentication_classes = [AutomationTokenAuthentication]`.
O lookup por hash roda **fora do tenant scope** (o contexto ainda não existe — é
setado *como consequência* de encontrar o token); é por isso que `AutomationToken`
é plain model e não `TenantModel` (ver `automation/models.py`).

**Recusa uniforme (DW-41/DW-43).** Os três ramos de falha — hash desconhecido,
token revogado e dono desativado — devolvem UMA resposta só, reusando o msgid
congelado `core.exceptions._NO_ACTIVE_ACCOUNT` com `code="no_active_account"`. Duas
razões, uma por DW:

- **DW-43:** as mensagens distintas de antes (`"Token inválido"` vs.
  `"Token revogado"`) diziam ao cliente se a linha do token existia — a mesma
  propriedade que a DW-25 construiu no refresh e a DW-31 nas rotas JWT. Reusar o
  msgid daquelas (em vez de uniformizar em texto próprio) evita criar uma segunda
  convenção para a mesma propriedade; a mensagem é literalmente o que um token de
  automação inválido/revogado/de dono trancado significa.
- **DW-41:** `is_active` nunca era consultado. Como `AutomationToken.user` é
  `on_delete=CASCADE`, um dono **apagado** derrubava o token junto e a request
  falhava, mas um dono **desativado** seguia recebendo 200 com o corpo completo —
  separando os dois casos por sucesso-vs-falha e, pior, ignorando a desativação, que
  é a única tranca de conta que o admin oferece (`accounts/admin.py`).

O import de `core.exceptions` fica no TOPO aqui (diferente de
`core/authentication.py`, onde ele tem de ser em runtime): este módulo já importa
`automation.models` no topo, logo só é importável depois do app registry, e **não**
está em `DEFAULT_AUTHENTICATION_CLASSES` — a cadeia de resolução precoce do DRF que
força o import tardio lá não alcança este arquivo (verificado com `django.setup()`).
"""

import logging

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from automation.models import AutomationToken, hash_token
from core.calendar import now
from core.context import current_user_id
from core.exceptions import _NO_ACTIVE_ACCOUNT

# Precedente: `automation/views.py` usa `logging.getLogger(__name__)`.
logger = logging.getLogger(__name__)

_BEARER_PREFIX = "Bearer "


def _falha_uniforme(motivo: str) -> AuthenticationFailed:
    """A recusa única dos três ramos, com o motivo no log (DW-41/DW-43).

    O cliente deixa de distinguir os casos; o OPERADOR não — mesmo racional do
    `logger.warning` da DW-31/DW-25: o corpo neutro é a propriedade de segurança, e o
    log é o que impede o caso de desaparecer. Nunca o token (nem pleno nem prefixo,
    AD-19) nem id de usuário; sem `exc_info`, porque é um 401 de rotina e um
    traceback por request seria só ruído.

    `AuthenticationFailed` **nativo do DRF** (não a subclasse do simplejwt): sem o
    `DetailDictMixin`, o corpo sai `{"detail": str}` sem a chave `fields` — a forma
    exata do 401 de refresh (DW-25) e das rotas JWT (DW-31). O `code` não chega ao
    cliente; existe para o operador e para casar com aquelas duas superfícies.
    """
    logger.warning("Falha de autenticação de automação colapsada: motivo=%s", motivo)
    return AuthenticationFailed(_NO_ACTIVE_ACCOUNT, code="no_active_account")


class AutomationTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith(_BEARER_PREFIX):
            # Sem credencial desta classe: deixa outras auth / IsAuthenticated
            # decidirem (resulta em 401 vazio se nenhuma autenticar).
            return None

        full = header[len(_BEARER_PREFIX) :].strip()
        # `objects` é o manager padrão do Django (modelo puro, sem fail-closed);
        # a busca por hash roda ANTES de qualquer tenant context existir.
        token = AutomationToken.objects.filter(token_hash=hash_token(full)).first()
        # Três `if` separados de propósito: o LOG discrimina o ramo, a resposta não.
        if token is None:
            # Inclui o dono APAGADO: `AutomationToken.user` é `on_delete=CASCADE`,
            # então a linha do token cai junto — mesmo ramo, não um ramo novo.
            raise _falha_uniforme("hash_desconhecido")
        if token.revoked_at is not None:
            raise _falha_uniforme("token_revogado")
        if not token.user.is_active:
            # DW-41. `token.user` já é carregado no `return` do caminho de sucesso e o
            # descriptor da FK cacheia na instância, então esta checagem não acrescenta
            # query nenhuma lá — só neste ramo, que termina em 401 de qualquer forma.
            raise _falha_uniforme("dono_inativo")

        # `last_used_at` é telemetria de infra (instante de auditoria), não data
        # de domínio. Semanticamente NÃO é "hoje do usuário" (AD-04 rege datas de
        # domínio, não isto) — mas o guardrail de AST proíbe `timezone.now()`
        # direto em produção, então usa-se `core.calendar.now()` (mesma fonte de
        # "agora" de auditoria de `medication_day_entries.confirmed_at`).
        token.last_used_at = now()
        token.save(update_fields=["last_used_at"])

        # Seta o tenant context com o dono do token e stasha o reset-token no
        # HttpRequest cru (o middleware reseta no finally).
        request._request._tenant_context_token = current_user_id.set(token.user_id)

        # `token` vai para `request.auth`, de onde `HasAutomationScope` lê os scopes.
        return (token.user, token)

    def authenticate_header(self, request):
        """CRÍTICO (AC4): sem isto o DRF "domestica" a falha de autenticação para
        403 em vez de 401. Retornar o esquema faz o DRF responder 401 para
        token revogado/inválido. Escopo insuficiente é caso diferente
        (autenticado, sem autorização) → 403 via `HasAutomationScope`."""
        return "Bearer"
