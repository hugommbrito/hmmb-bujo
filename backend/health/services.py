"""Camada de serviço das Métricas de Saúde (§6.2, AD-01, Story 7.1).

Funções de módulo (nunca classes de serviço); ``user`` é sempre o primeiro kwarg
keyword-only; toda escrita é ``@transaction.atomic``; scoping implícito via
``TenantManager`` (nunca ``user_id`` cru nas queries, nunca ``all_objects``). O
service recebe dados **já validados** + ``user``, nunca o ``request``, e só levanta
exceções de ``core/exceptions.py`` (``DomainError`` → 409).

Regras de negócio (AD-01, AC1–AC4):
- ``field_type`` é imutável após a criação (integridade histórica NFR-4).
- ``enum`` exige ≥1 opção; os demais tipos não aceitam opções.
- ``display_order`` sem valor = append ao fim (``max(display_order)+1`` do tenant).
- Desativar nunca deleta (``active=false``); reativar volta ``active=true``.
"""

from django.db import transaction
from django.db.models import Max

from core.exceptions import DomainError
from health.models import HealthFieldDefinition, HealthFieldType

# Campos mutáveis por UPDATE direto (Saúde não versiona). ``field_type`` é imutável.
_MUTABLE_FIELDS = ("name", "display_order", "enum_options", "active")


def _validate_enum_options(field_type, enum_options) -> None:
    """Regra enum⇔opções (AC3): ``enum`` exige ≥1 opção; não-enum não aceita opções.

    Levanta ``DomainError`` (→ 409) — a validação de forma equivalente vive também
    no serializer (→ 400) para a borda da API.
    """
    options = enum_options or []
    if field_type == HealthFieldType.ENUM:
        if len(options) < 1:
            raise DomainError("Campo do tipo enum exige ao menos uma opção.")
    elif options:
        raise DomainError("Opções só se aplicam a campos do tipo enum.")


def list_health_fields(*, user, include_inactive=False):
    """Definições do tenant, ordenadas por ``display_order, name`` (Meta.ordering).

    Por default só as ativas (AC2); ``include_inactive`` traz também as desativadas.
    Auto-escopado por tenant (``TenantManager``).
    """
    qs = HealthFieldDefinition.objects.all()
    if not include_inactive:
        qs = qs.filter(active=True)
    return qs


@transaction.atomic
def create_health_field(
    *, user, name, field_type, enum_options=None, display_order=None
) -> HealthFieldDefinition:
    """Cria uma definição de campo (AC1). ``active=True`` por default.

    Valida a regra enum⇔opções. Sem ``display_order``, calcula o append
    (``max(display_order)+1`` do tenant; a primeira definição fica em 0). O ``id``
    (UUID do ``TenantModel``) é a chave estável consumida pela Story 7.2.
    """
    options = list(enum_options) if enum_options else []
    _validate_enum_options(field_type, options)

    if display_order is None:
        current_max = HealthFieldDefinition.objects.aggregate(m=Max("display_order"))["m"]
        display_order = 0 if current_max is None else current_max + 1

    return HealthFieldDefinition.objects.create(
        name=name,
        field_type=field_type,
        enum_options=options,
        display_order=display_order,
    )


@transaction.atomic
def update_health_field(*, user, field_id, **fields) -> HealthFieldDefinition:
    """UPDATE direto de ``name``/``display_order``/``enum_options``/``active`` (AC4).

    ``field_type`` é **imutável**: passá-lo levanta ``DomainError``. Se
    ``enum_options`` for alterado, valida contra o ``field_type`` atual (imutável).
    """
    if "field_type" in fields:
        raise DomainError("O tipo do campo é imutável e não pode ser alterado.")

    field = HealthFieldDefinition.objects.get(id=field_id)

    if "enum_options" in fields:
        options = list(fields["enum_options"]) if fields["enum_options"] else []
        _validate_enum_options(field.field_type, options)
        fields["enum_options"] = options

    updated = []
    for key, value in fields.items():
        if key not in _MUTABLE_FIELDS:
            continue
        setattr(field, key, value)
        updated.append(key)
    if updated:
        field.save(update_fields=updated)
    return field
