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
"""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from automation.models import AutomationToken, hash_token
from core.calendar import now
from core.context import current_user_id

_BEARER_PREFIX = "Bearer "


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
        if token is None:
            raise AuthenticationFailed("Token inválido")
        if token.revoked_at is not None:
            raise AuthenticationFailed("Token revogado")

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
