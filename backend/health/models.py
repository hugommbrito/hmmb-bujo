"""Métricas de Saúde — catálogo de campos dinâmicos (FR-3.1, AD-01, Story 7.1).

Esta story (7.1) implementa APENAS o **catálogo de definições** da AD-01 — a
fonte de verdade que tipa/valida/renderiza os valores. O armazenamento de valores
(``health_logs.values`` JSONB) é a Story 7.2 e **não** existe aqui.

Divergência-chave em relação a Hábitos (AD-06): Saúde **não** versiona. Não há
``effective_from``/snapshots — a definição é uma linha **plana e não-versionada**
``(id, user_id, name, field_type, enum_options, active, display_order)`` (AD-01). O
``id`` (UUID do ``TenantModel``) é a **chave estável** que a Story 7.2 usará dentro
de ``health_logs.values``; por isso ``field_type`` é **imutável após a criação**
(mudá-lo re-tiparia erradamente os valores históricos gravados por UUID — NFR-4).
``name``/``active``/``display_order``/``enum_options`` são config mutável (UPDATE
direto, sem versão).
"""

from django.db import models

from core.models import TenantModel


class HealthFieldType(models.TextChoices):
    """Definida no nível do módulo (não aninhada em ``HealthFieldDefinition``): uma
    classe aninhada não é visível ao ``CheckConstraint`` de ``Meta`` (mesmo idioma
    load-bearing de ``habits.models.HabitType`` / ``bujo.models.TaskStatus``).
    Exposta como ``HealthFieldDefinition.FieldType`` para manter o acesso
    ``HealthFieldDefinition.FieldType.ENUM``.
    """

    INTEGER = "integer"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    ENUM = "enum"
    TEXT = "text"


class HealthFieldDefinition(TenantModel):
    """Definição de um campo de métrica de saúde (AD-01) — plana, não-versionada.

    Herda ``TenantModel`` → UUID PK ``id`` + ``user_id`` indexado + managers
    auto-escopados (``objects``) / escape hatch (``all_objects``). ``field_type`` é
    imutável após a criação (integridade histórica NFR-4); os demais campos são
    config mutável. ``enum_options`` só se aplica a ``field_type = enum`` (lista de
    rótulos definida pelo usuário; ≥1 obrigatória) — a regra vive na camada de
    serviço/serializer, não no schema.
    """

    FieldType = HealthFieldType

    name = models.CharField(max_length=200)
    field_type = models.CharField(max_length=10, choices=HealthFieldType.choices)
    # Rótulos do enum (lista de strings). Uma lista de strings JSON NÃO é afetada
    # pela varredura do djangorestframework-camel-case (converte chaves de dict,
    # não elementos de array) — por isso NÃO entra em `ignore_fields`. Só relevante
    # para field_type=enum; vazio para os demais tipos.
    enum_options = models.JSONField(default=list, blank=True)
    active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "health_field_definitions"
        ordering = ["display_order", "name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(field_type__in=HealthFieldType.values),
                name="health_field_type_valid",
            ),
        ]
