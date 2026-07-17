"""Testes de schema de `BrainDumpItem` (AC #1)."""

from datetime import UTC, datetime

import pytest

from braindump.models import BrainDumpItem
from braindump.tests.factories import BrainDumpItemFactory
from core.tenant import tenant_context


@pytest.mark.django_db
def test_brain_dump_item_aceita_target_log_none(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user, target_log=None)

        assert item.target_log is None


@pytest.mark.django_db
@pytest.mark.parametrize("target_log", list(BrainDumpItem.TargetLog.values))
def test_brain_dump_item_aceita_cada_valor_de_target_log(user, target_log):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user, target_log=target_log)

        assert item.target_log == target_log


@pytest.mark.django_db
def test_brain_dump_item_aceita_description_none(user):
    with tenant_context(user):
        item = BrainDumpItemFactory(user=user, description=None)

        assert item.description is None


@pytest.mark.django_db
def test_brain_dump_item_ordering_por_created_at_crescente_nao_por_ordem_de_insercao(user):
    """Cria o item "mais novo" PRIMEIRO (inserido antes) e o "mais antigo"
    DEPOIS, forçando `created_at` fora da ordem de inserção — prova que
    `ordering = ["created_at"]` (Meta) e não a ordem de criação no banco."""
    with tenant_context(user):
        newer = BrainDumpItemFactory(user=user, title="Mais novo")
        newer.created_at = datetime(2026, 1, 2, tzinfo=UTC)
        newer.save(update_fields=["created_at"])

        older = BrainDumpItemFactory(user=user, title="Mais antigo")
        older.created_at = datetime(2026, 1, 1, tzinfo=UTC)
        older.save(update_fields=["created_at"])

        assert list(BrainDumpItem.objects.all()) == [older, newer]
