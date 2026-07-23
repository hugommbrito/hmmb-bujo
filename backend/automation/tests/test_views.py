"""Testes de endpoint de `POST /api/capture` (AC1/AC2/AC3/AC4).

Regra de ouro (Dev Notes › "Testar com token real, não `force_authenticate`"):
os testes materializam um **token real** via `AutomationToken.issue(...)` e passam
`Authorization: Bearer <full>`. `force_authenticate` substituiria os
autenticadores por `ForcedAuthentication`, a `AutomationTokenAuthentication` nunca
rodaria, o tenant context não seria setado e a criação via `BrainDumpItem.objects`
(fail-closed) levantaria `TenantScopeViolation`. O ciclo de request real passa
pelo middleware → a auth seta o contexto e o `TenantMiddleware` reseta no
`finally` — é o único caminho que exercita o isolamento de verdade.
"""

import logging
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from automation.models import SCOPE_CAPTURE, SCOPE_SUMMARY, AutomationToken
from braindump.models import BrainDumpItem
from core.tenant import tenant_context

CAPTURE_URL = "/api/capture"


def _token_client(user, scopes=(SCOPE_CAPTURE,)):
    """Cliente com um AutomationToken real no header. Retorna (client, token, full)."""
    token, full = AutomationToken.issue(user=user, name="t", scopes=list(scopes))
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {full}")
    return client, token, full


def _jwt_client(user):
    """Cliente JWT normal do dono (leitura das superfícies legadas do Brain Dump)."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# --- AC1: cria item via service existente / validação -------------------------


def test_post_braindump_retorna_201_com_id_e_cria_item(user):
    client, _token, _full = _token_client(user)

    resp = client.post(CAPTURE_URL, {"type": "braindump", "text": "Ideia"}, format="json")

    assert resp.status_code == 201
    assert "id" in resp.data
    with tenant_context(user):
        item = BrainDumpItem.objects.get(id=resp.data["id"])
        assert item.title == "Ideia"


def test_post_tipo_desconhecido_retorna_400_com_mensagem_clara(user):
    client, *_ = _token_client(user)

    resp = client.post(CAPTURE_URL, {"type": "xpto", "text": "x"}, format="json")

    assert resp.status_code == 400
    assert resp.data["type"] == "Tipo de captura desconhecido: xpto"
    with tenant_context(user):
        assert BrainDumpItem.objects.count() == 0


def test_post_sem_text_retorna_400(user):
    client, *_ = _token_client(user)

    resp = client.post(CAPTURE_URL, {"type": "braindump"}, format="json")

    assert resp.status_code == 400
    assert "text" in resp.data


def test_post_text_vazio_retorna_400(user):
    client, *_ = _token_client(user)

    resp = client.post(CAPTURE_URL, {"type": "braindump", "text": ""}, format="json")

    assert resp.status_code == 400
    assert "text" in resp.data


# --- AC2: aparece no Brain Dump legado do dono + isolamento -------------------


def test_item_capturado_aparece_no_brain_dump_e_no_badge_do_dono(user):
    client, *_ = _token_client(user)
    resp = client.post(CAPTURE_URL, {"type": "braindump", "text": "Comprar café"}, format="json")
    assert resp.status_code == 201

    jwt = _jwt_client(user)
    with tenant_context(user):
        items = jwt.get("/api/brain-dump/items/")
        count = jwt.get("/api/brain-dump/count/")

    assert items.status_code == 200
    assert [i["title"] for i in items.data] == ["Comprar café"]
    assert count.status_code == 200
    assert count.data == {"count": 1}


def test_item_capturado_nunca_aparece_para_outro_tenant(user, other_user):
    client, *_ = _token_client(user)
    resp = client.post(CAPTURE_URL, {"type": "braindump", "text": "Privado"}, format="json")
    assert resp.status_code == 201

    other_jwt = _jwt_client(other_user)
    with tenant_context(other_user):
        items = other_jwt.get("/api/brain-dump/items/")

    assert items.status_code == 200
    assert items.data == []


# --- AC3: auth (401) / escopo (403) -------------------------------------------


def test_sem_authorization_retorna_401():
    resp = APIClient().post(CAPTURE_URL, {"type": "braindump", "text": "x"}, format="json")

    assert resp.status_code == 401


def test_token_invalido_retorna_401():
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer bujo_invalido")

    resp = client.post(CAPTURE_URL, {"type": "braindump", "text": "x"}, format="json")

    assert resp.status_code == 401


def test_token_revogado_retorna_401(user):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    token.revoked_at = timezone.now()
    token.save(update_fields=["revoked_at"])
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {full}")

    resp = client.post(CAPTURE_URL, {"type": "braindump", "text": "x"}, format="json")

    assert resp.status_code == 401


def test_token_sem_escopo_capture_retorna_403(user):
    # Token só com escopo `summary` → autenticado, mas sem autorização → 403.
    client, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])

    resp = client.post(CAPTURE_URL, {"type": "braindump", "text": "x"}, format="json")

    assert resp.status_code == 403
    with tenant_context(user):
        assert BrainDumpItem.objects.count() == 0


# --- AC3: throttle (429) ------------------------------------------------------


def test_excede_a_taxa_retorna_429(user):
    client, *_ = _token_client(user)
    # `override_settings(REST_FRAMEWORK=...)` NÃO rebinda a taxa: DRF captura
    # `SimpleRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES`
    # UMA vez, no import da classe; o sinal `setting_changed` só reseta o
    # `api_settings`, não o atributo de classe já ligado. Para um teste
    # determinístico, patcha-se o atributo de classe diretamente + limpa o cache
    # (LocMemCache guarda os contadores). (Ver Dev Notes › "Testar o
    # ScopedRateThrottle de forma determinística".)
    low_rate = {"automation-capture": "1/min"}
    with patch.object(ScopedRateThrottle, "THROTTLE_RATES", low_rate):
        cache.clear()
        r1 = client.post(CAPTURE_URL, {"type": "braindump", "text": "a"}, format="json")
        r2 = client.post(CAPTURE_URL, {"type": "braindump", "text": "b"}, format="json")
    cache.clear()

    assert r1.status_code == 201
    assert r2.status_code == 429


# --- AC3: log estruturado, sem token pleno ------------------------------------


def test_log_estruturado_com_prefix_endpoint_status_e_sem_token_pleno(user, caplog):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {full}")

    with caplog.at_level(logging.INFO, logger="automation.views"):
        resp = client.post(CAPTURE_URL, {"type": "braindump", "text": "x"}, format="json")

    assert resp.status_code == 201
    records = [r for r in caplog.records if r.getMessage() == "automation capture"]
    assert len(records) == 1
    rec = records[0]
    assert rec.token_prefix == token.token_prefix == full[:12]
    assert rec.endpoint == "/api/capture"
    assert rec.status == 201
    # O token PLENO nunca aparece em nenhum record (nem em campo extra, nem texto).
    assert rec.token_prefix != full
    assert full not in caplog.text
    for r in caplog.records:
        assert full not in str(getattr(r, "token_prefix", ""))


def test_log_tambem_registra_o_400_de_validacao(user, caplog):
    # AC3: "cada chamada que alcança o handler gera log" — inclui o 400.
    client, token, _full = _token_client(user)

    with caplog.at_level(logging.INFO, logger="automation.views"):
        resp = client.post(CAPTURE_URL, {"type": "braindump"}, format="json")

    assert resp.status_code == 400
    records = [r for r in caplog.records if r.getMessage() == "automation capture"]
    assert len(records) == 1
    assert records[0].status == 400
    assert records[0].token_prefix == token.token_prefix


def test_log_tambem_registra_o_400_de_tipo_desconhecido(user, caplog):
    # AC3: o 400 do braço `except UnknownCaptureType` também alcança o handler e
    # deve logar — caminho distinto do 400 de validação (que sai antes, no
    # `is_valid()`). Sem esta asserção, uma regressão que esquecesse o
    # `self._audit(...)` só nesse braço passaria em todos os outros testes.
    client, token, _full = _token_client(user)

    with caplog.at_level(logging.INFO, logger="automation.views"):
        resp = client.post(CAPTURE_URL, {"type": "xpto", "text": "x"}, format="json")

    assert resp.status_code == 400
    records = [r for r in caplog.records if r.getMessage() == "automation capture"]
    assert len(records) == 1
    assert records[0].status == 400
    assert records[0].endpoint == "/api/capture"
    assert records[0].token_prefix == token.token_prefix
