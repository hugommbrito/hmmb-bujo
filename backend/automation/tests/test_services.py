"""Testes do dispatcher de captura (`dispatch_capture`, AC1/AC4) — unit, sem HTTP.

O dispatcher é HTTP-agnóstico; aqui exercita-se o service direto dentro de um
`tenant_context(user)` (o contexto que, em produção, a auth por token seta). Os
casos 401/403/429/log ficam no teste de endpoint (`test_views.py`).
"""

from datetime import timedelta

import pytest

from automation.services import (
    UnknownCaptureType,
    build_today_summary,
    dispatch_capture,
)
from braindump.models import BrainDumpItem
from bujo.services.logs import get_or_create_daily_log
from bujo.tests.factories import TaskFactory
from core.calendar import today_for
from core.tenant import tenant_context
from gratitude.services import create_gratitude_entry


def test_dispatch_braindump_cria_item_com_title_igual_ao_text(user):
    with tenant_context(user):
        item = dispatch_capture(user=user, type="braindump", text="Ideia")

        assert isinstance(item, BrainDumpItem)
        assert item.title == "Ideia"
        assert BrainDumpItem.objects.filter(id=item.id, title="Ideia").exists()


def test_dispatch_tipo_desconhecido_levanta_unknown_capture_type(user):
    with tenant_context(user):
        with pytest.raises(UnknownCaptureType) as exc_info:
            dispatch_capture(user=user, type="desconhecido", text="x")

    assert exc_info.value.type_value == "desconhecido"
    assert "Tipo de captura desconhecido: desconhecido" in str(exc_info.value)


def test_dispatch_value_e_ignorado_no_braco_braindump(user):
    with tenant_context(user):
        item = dispatch_capture(user=user, type="braindump", text="Ideia", value="123")

        # `value` é reservado a tipos futuros: não deixa vestígio no braindump.
        assert item.title == "Ideia"
        assert item.description is None
        assert item.target_log is None


# --- Story 12.6: build_today_summary (composição read-only) -------------------
#
# Unit, sem HTTP: exercita o composition service dentro de `tenant_context(user)`
# (o contexto que, em produção, a auth por token seta). Os casos 401/403/429/log
# ficam no teste de endpoint (`test_views.py`).


def test_build_today_summary_pending_tasks_so_raizes_pendentes_ou_started(user):
    with tenant_context(user):
        today = today_for(user)
        log = get_or_create_daily_log(user=user, log_date=today)
        root_pending = TaskFactory(user=user, log=log, title="pendente", status="pending")
        TaskFactory(user=user, log=log, title="iniciada", status="started")
        TaskFactory(user=user, log=log, title="concluída", status="completed")
        # Subtarefa pendente: NÃO é raiz (parent_task setado) → não deve aparecer.
        TaskFactory(
            user=user, log=log, title="subtarefa", status="pending", parent_task=root_pending
        )

        summary = build_today_summary(user=user)

    pend = summary["pending_tasks"]
    assert {t.title for t in pend} == {"pendente", "iniciada"}
    assert {t.status for t in pend} == {"pending", "started"}
    assert summary["date"] == today


def test_build_today_summary_habits_bloco_tem_total_e_groups(user):
    with tenant_context(user):
        get_or_create_daily_log(user=user, log_date=today_for(user))
        summary = build_today_summary(user=user)

    # Sem hábitos semeados → resposta honesta (total=0, groups=[]); as chaves
    # `total`/`groups` sempre presentes (shape de compute_day_completeness).
    assert set(summary["habits"].keys()) == {"total", "groups"}
    assert summary["habits"]["total"] == 0
    assert summary["habits"]["groups"] == []


def test_build_today_summary_last_journal_entry_e_a_gratidao_mais_recente(user):
    with tenant_context(user):
        today = today_for(user)
        get_or_create_daily_log(user=user, log_date=today)
        create_gratitude_entry(user=user, date=today - timedelta(days=1), text="ontem")
        create_gratitude_entry(user=user, date=today, text="hoje")

        summary = build_today_summary(user=user)

    assert summary["last_journal_entry"].text == "hoje"


def test_build_today_summary_last_journal_entry_none_sem_gratidao(user):
    with tenant_context(user):
        get_or_create_daily_log(user=user, log_date=today_for(user))
        summary = build_today_summary(user=user)

    assert summary["last_journal_entry"] is None
