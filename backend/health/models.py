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


class HealthLog(TenantModel):
    """Valores de saúde de um dia — **uma linha por (usuário, dia)** (AD-01, Story 7.2).

    A segunda metade da AD-01 (7.1 entregou o catálogo de definições; esta story
    entrega o **armazenamento e a captura de valores**). ``values`` é um blob JSONB
    **indexado pelo UUID** de cada ``HealthFieldDefinition`` — ex.
    ``{"uuid-peso": 88.2, "uuid-sono": 4, "uuid-atividade": true}``. **Não há FK**
    para ``HealthFieldDefinition``: o vínculo é o UUID dentro das chaves de
    ``values`` (AD-01); a definição **viva** (não um snapshot) tipa/valida/renderiza.

    Divergência-chave vs. Hábitos (AD-01): Saúde **não** versiona e **não** tem
    completude ponderada — não há ``effective_from``/snapshots/``*_at_time``. O valor
    é gravado cru no JSONB e a validação-contra-definições vive na camada de serviço
    (``upsert_health_log``), não no serializer (§6.4).

    ⚠️ **Regra de ouro do JSONB:** o campo **DEVE** se chamar exatamente ``values``.
    O ``djangorestframework-camel-case`` está configurado com
    ``JSON_CAMEL_CASE['JSON_UNDERSCOREIZE']['ignore_fields'] = ('values',)``
    (``config/settings/base.py``) desde o Épico 1 — isso preserva as chaves internas
    (UUIDs, ``blood_pressure``…) em ambas as direções (parser e renderer). Renomear o
    campo quebra a idempotência do round-trip camelCase (§6.3, AD-01).

    Herda ``TenantModel`` → UUID PK ``id`` + ``user_id`` indexado + managers
    auto-escopados. A unicidade é ``(user_id, date)`` (um blob por dia; sem ``habit``,
    ao contrário de ``HabitDayEntry.(habit, date)``). Índice GIN em ``values``:
    **deferido** para 7.3 (AD-14 reserva a latitude de índice; o cast analítico
    ``(values->>'uuid')::numeric`` de 7.3 é range on-expression, não usa GIN — GIN
    serve containment ``@>``).
    """

    date = models.DateField()
    # JSONB indexado pelo UUID da definição. DEVE se chamar `values` — o
    # ignore_fields=("values",) (base.py) protege as chaves internas na camelização.
    values = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "health_logs"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "date"],
                name="uniq_health_log_per_day",
            ),
        ]
