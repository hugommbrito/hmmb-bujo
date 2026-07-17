"""Testes de `BrainDumpItemSerializer`/`BrainDumpItemCreateSerializer`/
`BrainDumpItemProcessSerializer` (AC #1, #2, #3)."""

from datetime import date

import pytest
from djangorestframework_camel_case.util import camelize

from braindump.models import BrainDumpItem
from braindump.serializers import (
    BrainDumpCountSerializer,
    BrainDumpItemCreateSerializer,
    BrainDumpItemProcessSerializer,
    BrainDumpItemSerializer,
)
from braindump.tests.factories import BrainDumpItemFactory
from core.tenant import tenant_context


@pytest.mark.django_db
def test_brain_dump_item_serializer_expoe_target_log_e_created_at_em_camel_case_apos_camelize(
    user,
):
    """Mesma transformação executada por `CamelCaseJSONRenderer` na borda HTTP
    (§6.3) — aqui aplicada diretamente ao `.data` do serializer para provar o
    nome exato gerado a partir dos campos `target_log`/`created_at`."""
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user, target_log=BrainDumpItem.TargetLog.WEEK)

        data = camelize(BrainDumpItemSerializer(item).data)

        assert "targetLog" in data
        assert "createdAt" in data
        assert "target_log" not in data
        assert "created_at" not in data
        assert data["targetLog"] == "week"


def test_brain_dump_item_create_serializer_aceita_payload_so_com_title():
    serializer = BrainDumpItemCreateSerializer(data={"title": "Item novo"})

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data == {"title": "Item novo"}


def test_brain_dump_item_create_serializer_rejeita_target_log_fora_do_enum():
    serializer = BrainDumpItemCreateSerializer(
        data={"title": "Item novo", "target_log": "bogus"}
    )

    assert not serializer.is_valid()
    assert "target_log" in serializer.errors


def test_brain_dump_item_process_serializer_future_exige_month_first():
    serializer = BrainDumpItemProcessSerializer(data={"destination": "future"})

    assert not serializer.is_valid()
    assert "month_first" in serializer.errors


def test_brain_dump_item_process_serializer_future_rejeita_month_first_que_nao_seja_dia_1():
    serializer = BrainDumpItemProcessSerializer(
        data={"destination": "future", "month_first": date(2026, 8, 15)}
    )

    assert not serializer.is_valid()
    assert "month_first" in serializer.errors


def test_brain_dump_item_process_serializer_future_com_month_first_dia_1_e_valido():
    serializer = BrainDumpItemProcessSerializer(
        data={"destination": "future", "month_first": date(2026, 8, 1)}
    )

    assert serializer.is_valid(), serializer.errors


def test_brain_dump_item_process_serializer_future_rejeita_scheduled_date_fora_do_mes():
    serializer = BrainDumpItemProcessSerializer(
        data={
            "destination": "future",
            "month_first": date(2026, 9, 1),
            "scheduled_date": date(2026, 8, 15),
        }
    )

    assert not serializer.is_valid()
    assert "scheduled_date" in serializer.errors


def test_brain_dump_item_process_serializer_future_aceita_scheduled_date_no_mes_de_month_first():
    serializer = BrainDumpItemProcessSerializer(
        data={
            "destination": "future",
            "month_first": date(2026, 9, 1),
            "scheduled_date": date(2026, 9, 15),
        }
    )

    assert serializer.is_valid(), serializer.errors


def test_brain_dump_count_serializer_expoe_count():
    assert BrainDumpCountSerializer({"count": 3}).data == {"count": 3}
