"""Tenant-aware JWT authentication (§6.7, AD-12).

``TenantMiddleware`` (see ``core/middleware.py``) cannot set ``current_user_id``
itself — Django middleware runs before DRF resolves ``request.user`` from the
JWT, so by the time it would inspect ``request.user`` here, authentication has
not happened yet. This class sets the context as a side effect of a successful
``authenticate()`` call, which DRF invokes during ``perform_authentication()``,
exactly when the real user becomes known.

The token is stashed on the request (not reset here) so ``TenantMiddleware``
can guarantee the ``finally``-reset after the response, even though this class
has no teardown hook of its own. Critically, it is stashed on
``request._request`` — the raw Django ``HttpRequest`` — and NOT on ``request``
itself. ``authenticate()`` is called by DRF with its own ``Request`` wrapper
(``rest_framework.request.Request``), a *different object* from the raw
``HttpRequest`` that ``TenantMiddleware`` holds throughout ``get_response()``.
Stashing the token on the wrapper is invisible to the middleware — the context
would never be reset (a real leak hit while building this fix, only surfaced
by tests elsewhere in the suite unexpectedly seeing a stale tenant id).
``request._request`` is DRF's own documented back-reference to that same raw
request, which is what makes the hand-off work.

Imports the contextvar from ``core.context`` — NOT from ``core.tenant`` — on
purpose: ``core.tenant`` imports ``core.exceptions``, and Django resolves
``DEFAULT_AUTHENTICATION_CLASSES`` (this class) very early, as a side effect of
``core.exceptions`` itself importing ``rest_framework.views``. Importing
``core.tenant`` here would reach back into that same, still-mid-import
``core.exceptions`` module — a real circular-import ``ImportError`` hit while
building this fix. See ``core/context.py`` for the full explanation.
"""

import logging

from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.context import current_user_id

logger = logging.getLogger(__name__)

# DW-31: os dois códigos de ``JWTAuthentication.get_user`` que revelam o estado da
# LINHA do usuário — apagada (``user_not_found``) vs. existente mas inativa
# (``user_inactive``). Só estes colapsam.
#
# ``token_not_valid`` (``InvalidToken``, incluindo o ramo de claim ausente) fica
# fora porque não diz nada sobre a existência da linha: é levantado antes de
# qualquer lookup.
#
# ``password_changed`` fica fora por outro motivo — não por ser inócuo. Upstream o
# levanta em ``rest_framework_simplejwt/authentication.py:141-147``, isto é, só
# DEPOIS de o lookup ter achado a linha e de ``is_active`` ter passado: ele é
# alcançável apenas para um usuário existente E ativo, logo DIVULGA existência de
# linha. O que o mantém fora do frozenset é (a) ser inalcançável hoje —
# ``CHECK_REVOKE_TOKEN`` tem default ``False`` e o ``SIMPLE_JWT`` de
# ``config/settings/base.py:122-131`` não o seta — e (b) não separar apagado de
# inativo, que é o eixo que a DW-31 fecha. Ligar ``CHECK_REVOKE_TOKEN`` reabre a
# questão e ela é decidida à parte, deliberadamente.
_INDISTINGUISHABLE_CODES = frozenset({"user_not_found", "user_inactive"})


def _failure_code(exc):
    """O ``code`` de um ``AuthenticationFailed``, ou ``None`` quando não há um.

    Duas formas convivem: o ``AuthenticationFailed`` do simplejwt passa pelo
    ``DetailDictMixin`` e chega com ``detail`` = ``{"detail": ..., "code": ...}``;
    o nativo do DRF chega com ``detail`` = ``ErrorDetail`` (um ``str`` que carrega
    ``.code``). O ramo de ``dict`` vem primeiro porque ``ErrorDetail`` também é
    ``str`` — e nem toda forma tem código (``detail`` pode ser uma lista).
    """
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict):
        code = detail.get("code")
        return None if code is None else str(code)
    code = getattr(detail, "code", None)
    return None if code is None else str(code)


class TenantAwareJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _ = result
            request._request._tenant_context_token = current_user_id.set(user.id)
        return result

    def get_user(self, validated_token):
        """Colapsa "usuário apagado" e "usuário inativo" num 401 único (DW-31).

        ``JWTAuthentication.get_user`` distingue os dois casos por mensagem *e*
        por código (``user_not_found`` vs. ``user_inactive``) em toda request
        autenticada por ESTA classe, o que anula em qualquer outro endpoint a
        indistinguibilidade que a DW-25 construiu só em
        ``POST /api/accounts/token/refresh/``. Uma
        exceção única para os dois casos torna status, corpo, código e
        ``WWW-Authenticate`` idênticos por construção — o challenge porque
        ``APIView.handle_exception`` o deriva e gruda em ``exc.auth_header``, e o
        handler **default** do DRF (``rest_framework.views.exception_handler``, que
        ``custom_exception_handler`` chama primeiro) o copia para a resposta; o
        nosso handler só reescreve o ``.data`` do que voltou dali.

        Consequência de viver na camada do autenticador, e não na do handler:
        ``APIView.handle_exception`` rebaixa o status para 403 quando o challenge
        derivado é vazio, e — diferente de ``core/exceptions.py:215-241``, que opta
        por fora dessa regra de propósito — este código a herda. Inerte hoje (o
        challenge é sempre não-vazio, e o teste de paridade asseve isso), e mesmo
        que deixasse de ser, os dois casos colapsados são afetados de forma
        idêntica: a paridade sobrevive de qualquer jeito.

        Filtra por ``code``, não por classe: no simplejwt ``InvalidToken`` é
        subclasse de ``AuthenticationFailed``, então ``except AuthenticationFailed``
        sozinho engoliria também o 401 de token inválido. Se o upstream renomear
        esses códigos, o colapso deixa de acontecer e o teste de paridade fica
        vermelho — falha visível, não silenciosa.

        Levanta o ``AuthenticationFailed`` **nativo do DRF** (importado no topo),
        não o do simplejwt: sem o ``DetailDictMixin``, o corpo sai como
        ``{"detail": str}`` sem a chave ``fields`` — exatamente a forma do 401 de
        refresh, uma convenção só para "no active account" nas superfícies que
        passam por aqui e pelo handler central.

        Até onde a propriedade vale, dito sem exagero: ela cobre as rotas cujo
        autenticador é este — ou seja, as que herdam
        ``DEFAULT_AUTHENTICATION_CLASSES``. NÃO cobre
        ``automation.authentication.AutomationTokenAuthentication``, que é opt-in
        por view (``POST /api/capture``, ``GET /api/summary/today``) e nem consulta
        ``is_active``. E o ``code`` ``no_active_account`` não é sinônimo de um msgid
        único: o login (``TokenObtainSerializer``) usa o mesmo código com OUTRA
        mensagem (``"...with the given credentials"``, upstream
        ``serializers.py:35``) — o que esta classe iguala à rota de refresh é a
        FORMA do corpo e o eixo apagado-vs-inativo, não o texto de toda a família.

        ``_NO_ACTIVE_ACCOUNT`` é importado **em runtime, dentro do método**, nunca
        no topo do módulo: a cadeia ``core.models`` → ``core.tenant`` →
        ``core.exceptions`` (que importa ``rest_framework.views``, o que faz o DRF
        resolver ``DEFAULT_AUTHENTICATION_CLASSES`` e portanto importar ESTE
        módulo) alcança ``core.exceptions`` a meio caminho, antes da linha que
        define o nome — ``django.setup()`` morre com ``ImportError`` (comprovado).
        É o mesmo perigo que o docstring do módulo documenta para ``core.tenant``.
        """
        try:
            return super().get_user(validated_token)
        except AuthenticationFailed as exc:
            code = _failure_code(exc)
            if code not in _INDISTINGUISHABLE_CODES:
                raise
            # O cliente deixa de distinguir os dois casos; o OPERADOR não. Mesma
            # razão do ``logger.warning`` do ramo da DW-25 em ``core/exceptions.py``:
            # o corpo é neutro, o log é onde o caso continua visível. Só o código
            # original — nunca id de usuário nem conteúdo de token. Sem ``exc_info``:
            # é um 401 de rotina, não um escape inesperado, e um traceback por
            # request seria só ruído.
            logger.warning("Collapsed authentication failure (DW-31): code=%s", code)
            from core.exceptions import _NO_ACTIVE_ACCOUNT

            raise AuthenticationFailed(_NO_ACTIVE_ACCOUNT, code="no_active_account") from exc


class TenantAwareJWTAuthenticationScheme(SimpleJWTScheme):
    """Registers the ``jwtAuth`` security scheme for drf-spectacular.

    ``OpenApiAuthenticationExtension`` matches ``target_class`` by exact path
    (``match_subclasses = False`` in drf-spectacular), so swapping
    ``DEFAULT_AUTHENTICATION_CLASSES`` to this subclass silently dropped the
    ``security``/``securitySchemes`` blocks from every endpoint's generated
    schema — none of ``JWTAuthentication``'s built-in extension applied
    anymore. Subclassing the library's own scheme (same pattern it uses for
    ``JWTTokenUserAuthentication``) restores it.
    """

    target_class = "core.authentication.TenantAwareJWTAuthentication"
