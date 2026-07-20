"""Testes da camada de serviço das Métricas de Saúde (AD-01, AC1–AC4)."""

import uuid
from datetime import date, timedelta

import pytest

from core.calendar import today_for
from core.exceptions import DomainError
from core.tenant import tenant_context
from health.models import HealthFieldDefinition, HealthFieldType, HealthLog
from health.services import (
    _validate_history_range,
    create_health_field,
    get_health_daily,
    get_health_field_series,
    get_health_history,
    list_health_fields,
    update_health_field,
    upsert_health_log,
)
from health.tests.factories import HealthFieldDefinitionFactory, HealthLogFactory

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


def test_upsert_text_rejects_over_max_len(user):
    """Cap defensivo (_MAX_TEXT_LEN=1000): texto acima do limite → DomainError."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.TEXT)
        # No limite (1000) passa; acima (1001) é rejeitado antes de qualquer write.
        upsert_health_log(user=user, log_date=_D, values={str(f.id): "a" * 1000})
        with pytest.raises(DomainError):
            upsert_health_log(user=user, log_date=_D, values={str(f.id): "a" * 1001})


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


# ===============================================================================
# Story 7.3 — histórico read-only (get_health_history + get_health_field_series)
# ===============================================================================

# Datas fixas dentro de um mesmo range (guardrail: nunca ``date.today()``).
_H_START = date(2026, 2, 1)
_H_D1 = date(2026, 2, 3)
_H_D2 = date(2026, 2, 5)
_H_D3 = date(2026, 2, 8)
_H_END = date(2026, 2, 28)


# --- _validate_history_range ---------------------------------------------------
def test_validate_history_range_start_after_end():
    with pytest.raises(DomainError):
        _validate_history_range(_H_END, _H_START)


def test_validate_history_range_over_92_days():
    with pytest.raises(DomainError):
        _validate_history_range(date(2026, 1, 1), date(2026, 6, 1))


def test_validate_history_range_within_bounds_ok():
    # No limite (92 dias) não estoura.
    _validate_history_range(date(2026, 1, 1), date(2026, 4, 3))


def test_get_health_history_range_over_92_raises(user):
    with tenant_context(user), pytest.raises(DomainError):
        get_health_history(user=user, start=date(2026, 1, 1), end=date(2026, 6, 1))


# --- get_health_history: days / fields / summary -------------------------------
def test_history_days_reflect_only_existing_rows(user):
    """``days`` traz uma entrada por linha existente, ordenada por data — nunca
    fabrica dias sem registro (diferente de Hábitos, que preenche o range inteiro)."""
    with tenant_context(user):
        weight = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.DECIMAL, name="Peso"
        )
        HealthLogFactory(user=user, date=_H_D2, values={str(weight.id): 82.5})
        HealthLogFactory(user=user, date=_H_D1, values={str(weight.id): 80.5})
        result = get_health_history(user=user, start=_H_START, end=_H_END)

    assert [d["date"] for d in result["days"]] == [_H_D1, _H_D2]  # ordenado, só existentes
    assert result["days"][0]["values"] == {str(weight.id): 80.5}


def test_history_fields_include_active_and_inactive_with_value(user):
    """``fields`` inclui campos ATIVOS e campos INATIVOS que têm valor no range
    (Decisão 3 — esconder a coluna apagaria o histórico); exclui inativo sem valor."""
    with tenant_context(user):
        active = HealthFieldDefinitionFactory(
            user=user, name="Ativo", active=True, display_order=0
        )
        inactive_with = HealthFieldDefinitionFactory(
            user=user, name="InativoComDado", active=False, display_order=1
        )
        HealthFieldDefinitionFactory(
            user=user, name="InativoSemDado", active=False, display_order=2
        )
        HealthLogFactory(user=user, date=_H_D1, values={str(inactive_with.id): 5})
        result = get_health_history(user=user, start=_H_START, end=_H_END)

    names = [f.name for f in result["fields"]]
    assert names == ["Ativo", "InativoComDado"]  # ordenado por display_order; sem-dado fora
    assert active.id in [f.id for f in result["fields"]]


def test_history_summary_numeric_field_stats(user):
    """``summary`` de campo numérico: count/min/max/avg/latest via cast JSONB.
    ``latest`` = valor na maior data com registro (D3), não hoje (Decisão 8)."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.DECIMAL, name="Peso"
        )
        HealthLogFactory(user=user, date=_H_D1, values={str(f.id): 80.0})
        HealthLogFactory(user=user, date=_H_D2, values={str(f.id): 90.0})
        HealthLogFactory(user=user, date=_H_D3, values={str(f.id): 85.0})
        result = get_health_history(user=user, start=_H_START, end=_H_END)

    stats = next(s for s in result["summary"] if s["field_id"] == f.id)
    assert stats["count"] == 3
    assert stats["min"] == 80.0
    assert stats["max"] == 90.0
    assert stats["avg"] == 85.0
    assert stats["latest"] == 85.0  # valor na maior data (D3)


def test_history_summary_numeric_field_without_record_is_zeroed(user):
    """Campo numérico sem nenhum registro no range → summary zerado/None."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.INTEGER, name="Passos"
        )
        result = get_health_history(user=user, start=_H_START, end=_H_END)

    stats = next(s for s in result["summary"] if s["field_id"] == f.id)
    assert stats["count"] == 0
    assert stats["min"] is None
    assert stats["max"] is None
    assert stats["avg"] is None
    assert stats["latest"] is None


def test_history_summary_excludes_non_numeric_fields(user):
    """Booleano/enum/texto NÃO entram no dashboard (Decisão 5) — só na tabela
    (aparecem em ``fields``, mas não em ``summary``)."""
    with tenant_context(user):
        boolean = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.BOOLEAN, name="Atividade"
        )
        HealthLogFactory(user=user, date=_H_D1, values={str(boolean.id): True})
        result = get_health_history(user=user, start=_H_START, end=_H_END)

    assert all(s["field_id"] != boolean.id for s in result["summary"])
    assert boolean.id in [f.id for f in result["fields"]]  # coluna existe na tabela


def test_history_cross_tenant_isolated(user, other_user):
    """A leitura de ``user`` nunca enxerga linhas/definições de ``other_user``."""
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(
            user=other_user, field_type=HealthFieldType.INTEGER
        )
        HealthLogFactory(user=other_user, date=_H_D1, values={str(alheio.id): 5})
    with tenant_context(user):
        result = get_health_history(user=user, start=_H_START, end=_H_END)

    assert result["days"] == []
    assert result["fields"] == []
    assert result["summary"] == []


# --- get_health_field_series ---------------------------------------------------
def test_series_points_ordered_with_gaps_omitted(user):
    """``points`` ordenados por data; dias sem a chave (lacuna) são OMITIDOS."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.DECIMAL, name="Peso"
        )
        other = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.INTEGER, name="Sono"
        )
        HealthLogFactory(user=user, date=_H_D2, values={str(f.id): 82.5})
        HealthLogFactory(user=user, date=_H_D1, values={str(f.id): 80.5})
        # Dia com registro só de OUTRO campo → não entra na série de f (chave ausente).
        HealthLogFactory(user=user, date=_H_D3, values={str(other.id): 7})
        result = get_health_field_series(
            user=user, field_id=f.id, start=_H_START, end=_H_END
        )

    assert result["field"].id == f.id
    assert [(p["date"], p["value"]) for p in result["points"]] == [
        (_H_D1, 80.5),
        (_H_D2, 82.5),
    ]


def test_series_cast_reads_integer_and_decimal(user):
    """(c) o cast JSONB lê integer e decimal corretamente como número."""
    with tenant_context(user):
        weight = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.DECIMAL, name="Peso"
        )
        sleep = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.INTEGER, name="Sono"
        )
        HealthLogFactory(
            user=user, date=_H_D1, values={str(weight.id): 88.2, str(sleep.id): 4}
        )
        w = get_health_field_series(user=user, field_id=weight.id, start=_H_START, end=_H_END)
        s = get_health_field_series(user=user, field_id=sleep.id, start=_H_START, end=_H_END)

    assert w["points"][0]["value"] == 88.2
    assert s["points"][0]["value"] == 4.0  # int no blob → float via cast


def test_series_non_numeric_field_raises_domain_error(user):
    """Campo não-numérico não é plotável (Decisão 5) → DomainError."""
    with tenant_context(user):
        boolean = HealthFieldDefinitionFactory(
            user=user, field_type=HealthFieldType.BOOLEAN
        )
        with pytest.raises(DomainError):
            get_health_field_series(
                user=user, field_id=boolean.id, start=_H_START, end=_H_END
            )


def test_series_nonexistent_field_raises_does_not_exist(user):
    with tenant_context(user), pytest.raises(HealthFieldDefinition.DoesNotExist):
        get_health_field_series(
            user=user, field_id=uuid.uuid4(), start=_H_START, end=_H_END
        )


def test_series_cross_tenant_field_raises_does_not_exist(user, other_user):
    with tenant_context(other_user):
        alheio = HealthFieldDefinitionFactory(
            user=other_user, field_type=HealthFieldType.INTEGER
        )
    with tenant_context(user), pytest.raises(HealthFieldDefinition.DoesNotExist):
        get_health_field_series(
            user=user, field_id=alheio.id, start=_H_START, end=_H_END
        )


def test_series_range_over_92_raises(user):
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        with pytest.raises(DomainError):
            get_health_field_series(
                user=user, field_id=f.id, start=date(2026, 1, 1), end=date(2026, 6, 1)
            )


# --- (e) leituras NUNCA materializam -------------------------------------------
def test_history_reads_do_not_materialize(user):
    """Nenhuma leitura de histórico cria linhas em health_logs (AC3, on-read puro)."""
    with tenant_context(user):
        f = HealthFieldDefinitionFactory(user=user, field_type=HealthFieldType.INTEGER)
        HealthLogFactory(user=user, date=_H_D1, values={str(f.id): 5})
        before = HealthLog.objects.count()
        get_health_history(user=user, start=_H_START, end=_H_END)
        get_health_field_series(user=user, field_id=f.id, start=_H_START, end=_H_END)
        after = HealthLog.objects.count()

    assert before == after == 1
