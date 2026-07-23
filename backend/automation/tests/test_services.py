"""Testes do dispatcher de captura (`dispatch_capture`, AC1/AC4) — unit, sem HTTP.

O dispatcher é HTTP-agnóstico; aqui exercita-se o service direto dentro de um
`tenant_context(user)` (o contexto que, em produção, a auth por token seta). Os
casos 401/403/429/log ficam no teste de endpoint (`test_views.py`).
"""

import pytest

from automation.services import UnknownCaptureType, dispatch_capture
from braindump.models import BrainDumpItem
from core.tenant import tenant_context


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
