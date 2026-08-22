"""Testes do admin de operador (AC2): criação gera hash+prefix, o operador
nunca define o hash, e o pleno é revelado uma única vez via mensagem.

Cobre `save_model` diretamente (mais barato que o fluxo HTTP completo do admin).
"""

import datetime

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from automation.admin import AutomationTokenAdmin, AutomationTokenAdminForm
from automation.authentication import AutomationTokenAuthentication
from automation.models import SCOPE_CAPTURE, SCOPE_SUMMARY, AutomationToken


def _admin_request():
    request = RequestFactory().post("/admin/automation/automationtoken/add/")
    # Storage de mensagens fora do middleware.
    request.session = {}
    request._messages = FallbackStorage(request)
    return request


def test_add_form_never_exposes_derived_secret_fields():
    form = AutomationTokenAdminForm()
    assert "token_hash" not in form.fields
    assert "token_prefix" not in form.fields
    # O operador escolhe os escopos (não digita hash).
    assert "scopes" in form.fields


def test_save_model_on_create_generates_secret_and_reveals_it_once(user):
    admin_instance = AutomationTokenAdmin(AutomationToken, AdminSite())
    request = _admin_request()
    form = AutomationTokenAdminForm(
        data={"user": str(user.pk), "name": "Atalhos", "scopes": [SCOPE_CAPTURE, SCOPE_SUMMARY]}
    )
    assert form.is_valid(), form.errors
    obj = form.save(commit=False)

    admin_instance.save_model(request, obj, form, change=False)

    created = AutomationToken.objects.get(user=user)
    # Derivados gerados pela aplicação, não pelo operador.
    assert created.token_hash and len(created.token_hash) == 64
    assert created.token_prefix.startswith("bujo_")
    assert created.scopes == [SCOPE_CAPTURE, SCOPE_SUMMARY]

    # Mensagem de revelação única contém o pleno (e portanto o prefixo).
    revealed = [str(m.message) for m in request._messages]
    assert any(created.token_prefix in msg for msg in revealed)


def test_save_model_on_edit_never_regenerates_secret(user):
    token, _full = AutomationToken.issue(user=user, name="orig", scopes=[SCOPE_CAPTURE])
    original_hash = token.token_hash
    admin_instance = AutomationTokenAdmin(AutomationToken, AdminSite())
    request = _admin_request()

    token.name = "renomeado"
    admin_instance.save_model(request, token, form=None, change=True)

    token.refresh_from_db()
    assert token.token_hash == original_hash  # nunca regenerado
    assert token.name == "renomeado"


def test_revoke_action_stamps_only_non_revoked_tokens_and_is_idempotent(user):
    """AC2: a ação de admin `revogar_tokens` revoga os tokens ainda ativos e
    **não** re-carimba os já revogados (filtro `revoked_at__isnull=True`),
    preservando o `revoked_at` original."""
    active_a, _ = AutomationToken.issue(user=user, name="a", scopes=[SCOPE_CAPTURE])
    active_b, _ = AutomationToken.issue(user=user, name="b", scopes=[SCOPE_CAPTURE])
    previously_revoked_at = timezone.now() - datetime.timedelta(days=3)
    already, _ = AutomationToken.issue(user=user, name="c", scopes=[SCOPE_CAPTURE])
    already.revoked_at = previously_revoked_at
    already.save(update_fields=["revoked_at"])

    admin_instance = AutomationTokenAdmin(AutomationToken, AdminSite())
    request = _admin_request()
    admin_instance.revogar_tokens(request, AutomationToken.objects.all())

    active_a.refresh_from_db()
    active_b.refresh_from_db()
    already.refresh_from_db()
    assert active_a.revoked_at is not None
    assert active_b.revoked_at is not None
    # O já-revogado mantém o carimbo original (não sobrescrito).
    assert already.revoked_at == previously_revoked_at
    # A mensagem reporta exatamente os 2 revogados agora (idempotência).
    revealed = [str(m.message) for m in request._messages]
    assert any("2 token" in msg for msg in revealed)


def test_token_revoked_via_admin_action_then_fails_authentication(user):
    """Liga AC2 → AC3: um token revogado pela ação do admin deixa de autenticar
    (a credencial é efetivamente desativada, não só um flag cosmético)."""
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    admin_instance = AutomationTokenAdmin(AutomationToken, AdminSite())
    admin_instance.revogar_tokens(_admin_request(), AutomationToken.objects.filter(pk=token.pk))

    request = Request(APIRequestFactory().get("/", HTTP_AUTHORIZATION=f"Bearer {full}"))
    with pytest.raises(AuthenticationFailed):
        AutomationTokenAuthentication().authenticate(request)
