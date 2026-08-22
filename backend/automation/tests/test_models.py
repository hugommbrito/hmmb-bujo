"""Testes do modelo `AutomationToken` e do helper `issue()` (AC1)."""

import hashlib

from automation.models import (
    SCOPE_CAPTURE,
    SCOPE_SUMMARY,
    AutomationToken,
    hash_token,
)


def test_issue_generates_bujo_prefixed_secret_and_stores_only_the_hash(user):
    token, full = AutomationToken.issue(
        user=user, name="Atalhos do iPhone", scopes=[SCOPE_CAPTURE, SCOPE_SUMMARY]
    )

    # O pleno é o segredo prefixado por `bujo_`, retornado só em memória.
    assert full.startswith("bujo_")
    # `token_prefix` são os 12 primeiros chars do pleno.
    assert token.token_prefix == full[:12]
    # Só o hash SHA-256 (64 hex) é persistido — nunca o pleno.
    assert token.token_hash == hashlib.sha256(full.encode()).hexdigest()
    assert len(token.token_hash) == 64
    assert token.scopes == [SCOPE_CAPTURE, SCOPE_SUMMARY]
    assert token.user_id == user.id
    assert token.revoked_at is None
    assert token.last_used_at is None


def test_issue_never_persists_the_plaintext_in_any_field(user):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])

    reloaded = AutomationToken.objects.get(pk=token.pk)
    # O pleno não aparece em nenhum campo persistido (só o prefixo + hash).
    assert reloaded.token_hash != full
    assert reloaded.token_prefix == full[:12]
    for value in (reloaded.name, reloaded.token_hash):
        assert value != full


def test_hash_token_is_deterministic():
    assert hash_token("bujo_abc") == hash_token("bujo_abc")
    assert hash_token("bujo_abc") != hash_token("bujo_xyz")
