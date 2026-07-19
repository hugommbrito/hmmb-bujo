"""Testes da camada de serviço das Métricas de Saúde (AD-01, AC1–AC4)."""

import uuid
from datetime import date, timedelta

import pytest

from core.calendar import today_for
from core.exceptions import DomainError
from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType, HealthLog
from health.services import (
    create_health_field,
    get_health_daily,
    list_health_fields,
    update_health_field,
    upsert_health_log,
)
from health.tests.factories import HealthFieldDefinitionFactory

# Data fixa de log (guardrail: nunca ``date.today()``; os testes de ritual usam ``today_for``).
_D = date(2026, 3, 10)


# --- create_health_field (AC1, AC3) --------------------------------------------
def test_create_persists_fields_active_true_and_uuid(user):
    """(a) grava name/field_type, active=True por default e id UUID estável."""
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        assert field.name == "Peso"
        assert field.field_type == HealthFieldType.DECIMAL
        assert field.active is True
        assert isinstance(field.id, uuid.UUID)
        assert field.enum_options == []


def test_create_appends_display_order_sequentially(user):
    """Sem display_order → append: primeira em 0, próxima em max+1."""
    with tenant_context(user):
        first = create_health_field(
            user=user, name="Sono", field_type=HealthFieldType.INTEGER
        )
        second = create_health_field(
            user=user, name="Passos", field_type=HealthFieldType.INTEGER
        )
        assert first.display_order == 0
        assert second.display_order == 1


def test_create_respects_explicit_display_order(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Água", field_type=HealthFieldType.INTEGER, display_order=7
        )
        assert field.display_order == 7


def test_create_enum_requires_at_least_one_option(user):
    with tenant_context(user), pytest.raises(DomainError):
        create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM, enum_options=[]
        )


def test_create_enum_with_options_ok(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM,
            enum_options=["Bom", "Neutro", "Ruim"],
        )
        assert field.enum_options == ["Bom", "Neutro", "Ruim"]


def test_create_non_enum_rejects_options(user):
    with tenant_context(user), pytest.raises(DomainError):
        create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL,
            enum_options=["não", "permitido"],
        )


# --- update_health_field (AC2, AC4) --------------------------------------------
def test_update_changes_name_without_touching_type(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Antigo", field_type=HealthFieldType.INTEGER
        )
        updated = update_health_field(user=user, field_id=field.id, name="Novo")
        assert updated.name == "Novo"
        field.refresh_from_db()
        assert field.name == "Novo"
        assert field.field_type == HealthFieldType.INTEGER


def test_update_rejects_field_type_change(user):
    """(c) field_type é imutável → DomainError."""
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.INTEGER
        )
        with pytest.raises(DomainError):
            update_health_field(
                user=user, field_id=field.id, field_type=HealthFieldType.DECIMAL
            )


def test_update_changes_display_order(user):
    """display_order é mutável por UPDATE direto (Saúde não versiona)."""
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        updated = update_health_field(user=user, field_id=field.id, display_order=5)
        assert updated.display_order == 5
        field.refresh_from_db()
        assert field.display_order == 5


def test_update_enum_options_ok(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM,
            enum_options=["Bom"],
        )
        updated = update_health_field(
            user=user, field_id=field.id, enum_options=["Bom", "Ruim"]
        )
        assert updated.enum_options == ["Bom", "Ruim"]


def test_update_enum_to_empty_options_rejected(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Humor", field_type=HealthFieldType.ENUM,
            enum_options=["Bom"],
        )
        with pytest.raises(DomainError):
            update_health_field(user=user, field_id=field.id, enum_options=[])


def test_update_non_enum_options_rejected(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        with pytest.raises(DomainError):
            update_health_field(
                user=user, field_id=field.id, enum_options=["não", "permitido"]
            )


# --- desativar / reativar (AC2) ------------------------------------------------
def test_deactivate_sets_active_false_and_preserves_record(user):
    with tenant_context(user):
        field = create_health_field(
            user=user, name="Peso", field_type=HealthFieldType.DECIMAL
        )
        update_health_field(user=user, field_id=field.id, active=False)
        field.refresh_from_db()
        assert field.active is False
        # Registro persiste — nunca é deletado (só some da lista ATIVA).
        assert HealthFieldDefinition.objects.filter(id=field.id).exists() is True
        assert field.id not in [f.id for f in list_health_fields(user=user)]


def test_reactivate_sets_active_true(user):
    with tenant_context(user):
        field = HealthFieldDefinitionFactory(user=user, active=False)
        update_health_field(user=user, field_id=field.id, active=True)
        field.refresh_from_db()
        assert field.active is True


# --- list_health_fields (AC2, f) -----------------------------------------------
def test_list_hides_inactive_by_default(user):
    with tenant_context(user):
        active = HealthFieldDefinitionFactory(user=user, name="Ativo", active=True)
        HealthFieldDefinitionFactory(user=user, name="Inativo", active=False)

        default = list(list_health_fields(user=user))
        assert [f.id for f in default] == [active.id]

        with_inactive = list(list_health_fields(user=user, include_inactive=True))
        assert len(with_inactive) == 2


def test_list_orders_by_display_order_then_name(user):
    with tenant_context(user):
        HealthFieldDefinitionFactory(user=user, name="Zeta", display_order=1)
        HealthFieldDefinitionFactory(user=user, name="Alfa", display_order=0)
        result = [f.name for f in list_health_fields(user=user)]
        assert result == ["Alfa", "Zeta"]


# --- isolamento (g) ------------------------------------------------------------
def test_update_cross_tenant_raises_does_not_exist(user, other_user):
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(user=other_user)
    with tenant_context(user), pytest.raises(HealthFieldDefinition.DoesNotExist):
        update_health_field(user=user, field_id=alheio.id, name="Invadido")


# ===============================================================================
# Story 7.2 — upsert_health_log + get_health_daily (AC1, AC3, AC4)
# ===============================================================================


# --- (a) grava valores válidos -------------------------------------------------
def test_upsert_persists_valid_values(user):
    with tenant_context(user):
        weight = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.DECIMAL)
        sleep = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        row = upsert_health_log(
            user=user, log_date=_D, values={str(weight.id): 88.2, str(sleep.id): 7}
        )
        assert row.values == {str(weight.id): 88.2, str(sleep.id): 7}
        assert HealthLog.objects.filter(date=_D).count() == 1


# --- (b) grava só se TUDO válido (submissão atômica) ---------------------------
def test_upsert_all_or_nothing_creates_no_row_when_invalid(user):
    with tenant_context(user):
        weight = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.DECIMAL)
        sleep = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        with pytest.raises(DomainError):
            upsert_health_log(
                user=user,
                log_date=_D,
                # 1.5 é inválido para integer → o lote inteiro falha, nada persiste.
                values={str(weight.id): 88.2, str(sleep.id): 1.5},
            )
        assert HealthLog.objects.filter(date=_D).exists() is False


def test_upsert_invalid_batch_leaves_existing_row_unchanged(user):
    with tenant_context(user):
        weight = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.DECIMAL)
        sleep = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        upsert_health_log(user=user, log_date=_D, values={str(weight.id): 80})
        with pytest.raises(DomainError):
            upsert_health_log(
                user=user,
                log_date=_D,
                values={str(weight.id): 90, str(sleep.id): 1.5},  # 1.5 inválido
            )
        # O 90 NÃO foi aplicado — a validação de tudo acontece antes de qualquer write.
        row = HealthLog.objects.get(date=_D)
        assert row.values == {str(weight.id): 80}


# --- (c) validação por tipo ----------------------------------------------------
def test_upsert_integer_rejects_fraction_and_string(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        upsert_health_log(user=user, log_date=_D, values={str(f.id): 5})
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(f.id): 1.5})
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(f.id): "x"})


def test_upsert_integer_accepts_whole_float(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        row = upsert_health_log(user=user, log_date=_D, values={str(f.id): 5.0})
        assert row.values[str(f.id)] == 5
        assert isinstance(row.values[str(f.id)], int)


def test_upsert_decimal_accepts_float(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.DECIMAL)
        row = upsert_health_log(user=user, log_date=_D, values={str(f.id): 88.2})
        assert row.values[str(f.id)] == 88.2


def test_upsert_boolean_is_strict(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.BOOLEAN)
        row = upsert_health_log(user=user, log_date=_D, values={str(f.id): True})
        assert row.values[str(f.id)] is True
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(f.id): "true"})
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(f.id): 1})


def test_upsert_enum_only_accepts_options(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.ENUM, enum_options=["Bom", "Ruim"]
        )
        row = upsert_health_log(user=user, log_date=_D, values={str(f.id): "Bom"})
        assert row.values[str(f.id)] == "Bom"
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(f.id): "Outro"})


def test_upsert_text_requires_string(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.TEXT)
        row = upsert_health_log(user=user, log_date=_D, values={str(f.id): "anotação"})
        assert row.values[str(f.id)] == "anotação"
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(f.id): 123})


# --- (d) UUID inexistente / inativo --------------------------------------------
def test_upsert_rejects_unknown_uuid(user):
    with tenant_context(user), pytest.raises(DomainError):
        upsert_health_log(user=user, log_date=_D, values={str(uuid.uuid4()): 5})


def test_upsert_rejects_inactive_field(user):
    with tenant_context(user):
        inactive = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.INTEGER, active=False
        )
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(inactive.id): 5})


# --- (e) merge preserva chave de campo hoje inativo (AC4) ----------------------
def test_upsert_merge_preserves_inactive_field_key(user):
    with tenant_context(user):
        weight = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.DECIMAL)
        old = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        # Histórico: `old` tinha valor gravado.
        upsert_health_log(
            user=user, log_date=_D, values={str(old.id): 5, str(weight.id): 80}
        )
        # `old` é desativado depois.
        old.active = False
        old.save(update_fields=["active"])
        # Regravar SÓ weight não pode apagar a chave histórica de `old`.
        upsert_health_log(user=user, log_date=_D, values={str(weight.id): 81})
        row = HealthLog.objects.get(date=_D)
        assert row.values[str(old.id)] == 5  # preservada (AC4)
        assert row.values[str(weight.id)] == 81


# --- (f) null/vazio remove a chave ---------------------------------------------
def test_upsert_null_removes_key(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.DECIMAL)
        upsert_health_log(user=user, log_date=_D, values={str(f.id): 80})
        upsert_health_log(user=user, log_date=_D, values={str(f.id): None})
        assert str(f.id) not in HealthLog.objects.get(date=_D).values


def test_upsert_empty_string_removes_key(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.TEXT)
        upsert_health_log(user=user, log_date=_D, values={str(f.id): "nota"})
        upsert_health_log(user=user, log_date=_D, values={str(f.id): ""})
        assert str(f.id) not in HealthLog.objects.get(date=_D).values


# --- (g) regravar o mesmo dia = upsert (1 linha) -------------------------------
def test_upsert_same_day_is_single_row(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        upsert_health_log(user=user, log_date=_D, values={str(f.id): 1})
        upsert_health_log(user=user, log_date=_D, values={str(f.id): 2})
        assert HealthLog.objects.filter(date=_D).count() == 1
        assert HealthLog.objects.get(date=_D).values[str(f.id)] == 2


# --- (h) get_health_daily: ontem/hoje/fields via today_for, só ativos ----------
def test_get_health_daily_shape_dates_and_active_only(user):
    with tenant_context(user):
        today = today_for(user)
        yesterday = today - timedelta(days=1)
        active = HealthFieldDefinitionFactory(user=user, active=True)
        HealthFieldDefinitionFactory(user=user, active=False)  # não deve aparecer
        upsert_health_log(user=user, log_date=yesterday, values={str(active.id): 3})

        daily = get_health_daily(user=user)
        assert daily["yesterday"]["date"] == yesterday
        assert daily["today"]["date"] == today
        assert daily["yesterday"]["values"] == {str(active.id): 3}
        assert daily["today"]["values"] == {}  # dia sem linha → {}
        assert [f.id for f in daily["fields"]] == [active.id]


def test_get_health_daily_cross_tenant_isolated(user, other_user):
    """O read-model de `user` nunca enxerga logs/definições de `other_user`."""
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(user=other_user, active=True)
        y = today_for(other_user) - timedelta(days=1)
        upsert_health_log(user=other_user, log_date=y, values={str(alheio.id): 9})
    with tenant_context(user):
        daily = get_health_daily(user=user)
        assert daily["fields"] == []
        assert daily["yesterday"]["values"] == {}
        assert daily["today"]["values"] == {}
