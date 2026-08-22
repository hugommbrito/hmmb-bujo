"""Testes de `HasAutomationScope` (AC4) — sem endpoint real, com view stub."""

from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from automation.models import SCOPE_CAPTURE, SCOPE_SUMMARY
from automation.permissions import HasAutomationScope
from automation.tests.factories import AutomationTokenFactory


class _CaptureView(APIView):
    required_scopes = [SCOPE_CAPTURE]


class _SingleScopeView(APIView):
    required_scope = SCOPE_SUMMARY


class _MultiScopeView(APIView):
    required_scopes = [SCOPE_CAPTURE, SCOPE_SUMMARY]


class _NoScopeView(APIView):
    required_scopes = []


def _request_with_auth(token):
    request = APIRequestFactory().get("/")
    request.auth = token
    return request


def test_grants_when_token_has_required_scope():
    token = AutomationTokenFactory(scopes=[SCOPE_CAPTURE, SCOPE_SUMMARY])
    request = _request_with_auth(token)

    assert HasAutomationScope().has_permission(request, _CaptureView()) is True


def test_denies_when_token_missing_required_scope():
    token = AutomationTokenFactory(scopes=[SCOPE_SUMMARY])
    request = _request_with_auth(token)

    # Autenticado, mas sem autorização → DRF responde 403.
    assert HasAutomationScope().has_permission(request, _CaptureView()) is False


def test_supports_single_required_scope_attribute():
    token = AutomationTokenFactory(scopes=[SCOPE_SUMMARY])
    request = _request_with_auth(token)

    assert HasAutomationScope().has_permission(request, _SingleScopeView()) is True


def test_grants_when_view_requires_no_scope():
    token = AutomationTokenFactory(scopes=[])
    request = _request_with_auth(token)

    assert HasAutomationScope().has_permission(request, _NoScopeView()) is True


def test_denies_when_token_has_only_some_of_the_required_scopes():
    # AC4: a permissão exige TODOS os escopos declarados (semântica `all`, não
    # `any`). Um token com só um de dois escopos exigidos → negado (evita
    # escalada de privilégio se `all()` regredisse para `any()`).
    token = AutomationTokenFactory(scopes=[SCOPE_CAPTURE])
    request = _request_with_auth(token)

    assert HasAutomationScope().has_permission(request, _MultiScopeView()) is False


def test_grants_when_token_has_all_of_the_required_scopes():
    token = AutomationTokenFactory(scopes=[SCOPE_CAPTURE, SCOPE_SUMMARY])
    request = _request_with_auth(token)

    assert HasAutomationScope().has_permission(request, _MultiScopeView()) is True


def test_fail_closed_when_auth_is_not_an_automation_token():
    # View mal configurada (sem a auth class) → request.auth não é um token.
    request = APIRequestFactory().get("/")
    request.auth = None

    assert HasAutomationScope().has_permission(request, _CaptureView()) is False
