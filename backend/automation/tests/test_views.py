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
from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from automation.models import SCOPE_CAPTURE, SCOPE_SUMMARY, AutomationToken
from braindump.models import BrainDumpItem
from bujo.services.logs import get_or_create_daily_log
from bujo.tests.factories import TaskFactory
from core.calendar import today_for
from core.tenant import tenant_context
from gratitude.services import create_gratitude_entry
from habits.models import HabitDayEntry
from habits.tests.factories import (
    HabitDayEntryFactory,
    HabitFactory,
    HabitGroupFactory,
    HabitVersionFactory,
)

CAPTURE_URL = "/api/capture"
SUMMARY_URL = "/api/summary/today"


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


# =============================================================================
# Story 12.6 — GET /api/summary/today
# =============================================================================
#
# Mesma regra de ouro do capture: token REAL via header (nunca `force_authenticate`,
# que pularia a auth class → tenant context não setado → a leitura escopada
# (`log.tasks`, `compute_day_completeness`, `get_latest_gratitude_entry`) estouraria
# `TenantScopeViolation`). As chaves da RESPOSTA são camelCase (§6.3): a camelização
# só ocorre no render do corpo HTTP, então asseveramos sobre `resp.json()` (corpo
# renderizado), NÃO sobre `resp.data` (pré-render, snake_case — precedente testado
# da Story 12.2: test_patch_task_detail_alterna_waiting_on_e_persiste).


# --- AC1: shape agregado (camelCase) + tarefas pendentes ----------------------


def test_summary_retorna_200_com_shape_camelcase(user):
    with tenant_context(user):
        get_or_create_daily_log(user=user, log_date=today_for(user))
    client, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])

    resp = client.get(SUMMARY_URL)

    assert resp.status_code == 200
    body = resp.json()  # corpo renderizado → camelCase na borda
    assert "date" in body
    assert "pendingTasks" in body  # camelCase (pending_tasks → pendingTasks)
    assert "lastJournalEntry" in body  # camelCase (last_journal_entry → lastJournalEntry)
    assert set(body["habits"].keys()) == {"total", "groups"}


def test_summary_pending_tasks_traz_so_raizes_pendentes_ou_started(user):
    with tenant_context(user):
        today = today_for(user)
        log = get_or_create_daily_log(user=user, log_date=today)
        root_pending = TaskFactory(user=user, log=log, title="comprar café", status="pending")
        TaskFactory(user=user, log=log, title="revisar PR", status="started")
        TaskFactory(user=user, log=log, title="feita", status="completed")
        TaskFactory(
            user=user, log=log, title="subtarefa", status="pending", parent_task=root_pending
        )
    client, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])

    body = client.get(SUMMARY_URL).json()

    tasks = body["pendingTasks"]
    # Ordem estável por `order_index` (Task.Meta.ordering), espelhando o
    # `LogSerializer.get_tasks`: o widget mostra as pendências na ordem manual do
    # usuário, não em ordem arbitrária do banco. "comprar café" é criada antes de
    # "revisar PR" (order_index crescente via factory.Sequence), então vem primeiro.
    assert [t["title"] for t in tasks] == ["comprar café", "revisar PR"]
    for t in tasks:
        assert set(t.keys()) == {"id", "title", "status"}
        assert t["status"] in {"pending", "started"}


def test_summary_dados_sao_so_do_dono(user, other_user):
    with tenant_context(user):
        log_u = get_or_create_daily_log(user=user, log_date=today_for(user))
        TaskFactory(user=user, log=log_u, title="tarefa do dono", status="pending")
    with tenant_context(other_user):
        log_o = get_or_create_daily_log(user=other_user, log_date=today_for(other_user))
        TaskFactory(user=other_user, log=log_o, title="tarefa alheia", status="pending")

    client_u, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])
    client_o, *_ = _token_client(other_user, scopes=[SCOPE_SUMMARY])
    body_u = client_u.get(SUMMARY_URL).json()
    body_o = client_o.get(SUMMARY_URL).json()

    assert {t["title"] for t in body_u["pendingTasks"]} == {"tarefa do dono"}
    assert {t["title"] for t in body_o["pendingTasks"]} == {"tarefa alheia"}


def test_summary_get_nao_semeia_habitos(user):
    # AC1 (read-only): o GET NUNCA materializa habit_day_entries — mesmo com um
    # hábito cuja versão vigente hoje `seed_habit_day` materializaria. Conta
    # antes/depois: o endpoint usa `compute_day_completeness` (só lê), nunca `seed`.
    with tenant_context(user):
        today = today_for(user)
        get_or_create_daily_log(user=user, log_date=today)
        HabitVersionFactory(user=user, effective_from=today, active=True)
        before = HabitDayEntry.objects.count()
    client, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])

    resp = client.get(SUMMARY_URL)

    assert resp.status_code == 200
    with tenant_context(user):
        after = HabitDayEntry.objects.count()
    assert before == after == 0


def test_summary_habits_bloco_reflete_grupos_reais_com_shape_id_name_completion(user):
    # GAP fechado pelo QA (AC1): todos os demais testes de `habits` usam um dia
    # NÃO semeado (total=0, groups=[]), então o `SummaryHabitsGroupSerializer`
    # ({id, name, completion}) nunca foi exercitado com um grupo REAL — uma
    # regressão que renomeasse `completion`→`percent` (ou quebrasse a
    # serialização de `groups`) passaria em toda a suíte. Aqui um hábito booleano
    # concluído HOJE materializa uma linha de `habit_day_entries` no SETUP (não
    # pela view — a view é read-only); `compute_day_completeness` devolve o grupo
    # e a resposta HTTP deve trazer o shape {id, name, completion} + o total real.
    with tenant_context(user):
        today = today_for(user)
        get_or_create_daily_log(user=user, log_date=today)
        group = HabitGroupFactory(user=user, name="Manhã")
        habit = HabitFactory(user=user, group=group)  # BOOLEAN por default
        HabitDayEntryFactory(user=user, habit=habit, date=today, value=Decimal("1"))
    client, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])

    body = client.get(SUMMARY_URL).json()

    habits = body["habits"]
    assert habits["total"] == 100  # único hábito booleano concluído → 100%
    assert len(habits["groups"]) == 1
    grupo = habits["groups"][0]
    assert set(grupo.keys()) == {"id", "name", "completion"}  # shape na borda (§6.3)
    assert grupo["name"] == "Manhã"
    assert grupo["completion"] == 100


# --- AC2: campo genérico lastJournalEntry (null / preenchido) -----------------


def test_summary_last_journal_entry_null_e_depois_preenchido(user):
    client, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])

    # Sem gratidão → null (campo genérico, nome journalling-neutro).
    body_vazio = client.get(SUMMARY_URL).json()
    assert body_vazio["lastJournalEntry"] is None
    assert "lastGratitude" not in body_vazio  # nome genérico, NÃO lastGratitude

    # Com gratidão → {text, date} da última entrada.
    with tenant_context(user):
        create_gratitude_entry(user=user, date=today_for(user), text="grato pelo sol")
    body = client.get(SUMMARY_URL).json()
    assert body["lastJournalEntry"]["text"] == "grato pelo sol"
    assert "date" in body["lastJournalEntry"]


# --- AC3: auth (401) / escopo (403) -------------------------------------------


def test_summary_sem_authorization_retorna_401():
    assert APIClient().get(SUMMARY_URL).status_code == 401


def test_summary_token_invalido_retorna_401():
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer bujo_invalido")

    assert client.get(SUMMARY_URL).status_code == 401


def test_summary_token_revogado_retorna_401(user):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_SUMMARY])
    token.revoked_at = timezone.now()
    token.save(update_fields=["revoked_at"])
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {full}")

    assert client.get(SUMMARY_URL).status_code == 401


def test_summary_token_sem_escopo_summary_retorna_403(user):
    # Token só com escopo `capture` → autenticado, mas sem autorização → 403.
    client, *_ = _token_client(user, scopes=[SCOPE_CAPTURE])

    assert client.get(SUMMARY_URL).status_code == 403


# --- AC3: throttle (429) ------------------------------------------------------


def test_summary_excede_a_taxa_retorna_429(user):
    with tenant_context(user):
        get_or_create_daily_log(user=user, log_date=today_for(user))
    client, *_ = _token_client(user, scopes=[SCOPE_SUMMARY])
    # `override_settings` NÃO rebinda a taxa (THROTTLE_RATES é ligado uma vez no
    # import da classe) — patcha-se o atributo de classe direto + limpa o cache
    # (LocMemCache guarda os contadores). (Ver Dev Notes › "Testar o
    # ScopedRateThrottle de forma determinística"; lição empírica da 12.5.)
    low_rate = {"automation-summary": "1/min"}
    with patch.object(ScopedRateThrottle, "THROTTLE_RATES", low_rate):
        cache.clear()
        r1 = client.get(SUMMARY_URL)
        r2 = client.get(SUMMARY_URL)
    cache.clear()

    assert r1.status_code == 200
    assert r2.status_code == 429


# --- AC3: log estruturado, sem token pleno ------------------------------------


def test_summary_log_estruturado_com_prefix_endpoint_status_e_sem_token_pleno(user, caplog):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_SUMMARY])
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {full}")

    with caplog.at_level(logging.INFO, logger="automation.views"):
        resp = client.get(SUMMARY_URL)

    assert resp.status_code == 200
    # Mensagem distinta ("automation summary") → zero colisão com o teste da 12.5.
    records = [r for r in caplog.records if r.getMessage() == "automation summary"]
    assert len(records) == 1
    rec = records[0]
    assert rec.token_prefix == token.token_prefix == full[:12]
    assert rec.endpoint == "/api/summary/today"
    assert rec.status == 200
    # O token PLENO nunca aparece em nenhum record (nem em campo extra, nem texto).
    assert rec.token_prefix != full
    assert full not in caplog.text
    for r in caplog.records:
        assert full not in str(getattr(r, "token_prefix", ""))
