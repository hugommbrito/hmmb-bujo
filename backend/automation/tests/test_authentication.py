"""Testes de `AutomationTokenAuthentication` (AC3/AC4).

Espelha `core/tests/test_authentication.py`: chama `.authenticate(Request(raw))`
diretamente (sem endpoint), envolvendo o request cru num
`rest_framework.request.Request` real — o mesmo objeto que o DRF passa em
produção, e *diferente* do `HttpRequest` cru onde a auth class stasha o
reset-token do contexto.
"""

import pytest
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from automation.authentication import AutomationTokenAuthentication
from automation.models import SCOPE_CAPTURE, AutomationToken
from braindump.models import BrainDumpItem
from core.context import current_user_id
from core.tenant import tenant_context


def _request(full_token=None):
    kwargs = {}
    if full_token is not None:
        kwargs["HTTP_AUTHORIZATION"] = f"Bearer {full_token}"
    return Request(APIRequestFactory().get("/", **kwargs))


def test_valid_token_returns_user_and_token_and_sets_context(user):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    request = _request(full)

    result = AutomationTokenAuthentication().authenticate(request)

    assert result is not None
    returned_user, returned_token = result
    assert returned_user == user
    assert returned_token == token
    # Tenant context setado com o dono do token.
    assert current_user_id.get() == user.id
    # `last_used_at` foi carimbado.
    token.refresh_from_db()
    assert token.last_used_at is not None
    # Reset do contextvar (como o teste do core faz).
    current_user_id.reset(request._request._tenant_context_token)


def test_no_authorization_header_returns_none_and_sets_nothing():
    request = _request()

    result = AutomationTokenAuthentication().authenticate(request)

    assert result is None
    assert not hasattr(request._request, "_tenant_context_token")
    assert current_user_id.get() is None


def test_non_bearer_header_returns_none():
    request = Request(APIRequestFactory().get("/", HTTP_AUTHORIZATION="Basic abc"))

    assert AutomationTokenAuthentication().authenticate(request) is None
    assert current_user_id.get() is None


def test_unknown_hash_raises_authentication_failed():
    request = _request("bujo_desconhecido")

    with pytest.raises(AuthenticationFailed):
        AutomationTokenAuthentication().authenticate(request)
    assert current_user_id.get() is None


def test_revoked_token_raises_authentication_failed(user):
    from django.utils import timezone

    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    token.revoked_at = timezone.now()
    token.save(update_fields=["revoked_at"])

    with pytest.raises(AuthenticationFailed):
        AutomationTokenAuthentication().authenticate(_request(full))
    assert current_user_id.get() is None


def test_authenticate_header_returns_bearer():
    # Sem isto o DRF responde 403 em vez de 401 (AC4).
    assert AutomationTokenAuthentication().authenticate_header(_request()) == "Bearer"


def test_context_set_by_auth_isolates_domain_query(user, other_user):
    """AC3: dentro do contexto setado por `authenticate()`, uma query de domínio
    enxerga só os dados do dono do token (caminho de isolamento coberto)."""
    with tenant_context(user):
        BrainDumpItem.objects.create(title="a")
        BrainDumpItem.objects.create(title="b")
    with tenant_context(other_user):
        BrainDumpItem.objects.create(title="c")

    # Nenhum contexto ativo agora — a auth class é quem seta.
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    request = _request(full)

    AutomationTokenAuthentication().authenticate(request)

    # Escopo do dono do token: só os 2 itens dele, não os 3 totais.
    assert BrainDumpItem.objects.count() == 2
    current_user_id.reset(request._request._tenant_context_token)
