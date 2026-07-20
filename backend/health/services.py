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

from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, Count, FloatField, Max, Min
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast

from core.calendar import today_for
from core.exceptions import DomainError
from health.models import HealthFieldDefinition, HealthFieldType, HealthLog

# Tipos numéricos (plotáveis/resumíveis via cast JSONB). boolean/enum/text não
# entram no gráfico nem no dashboard (Story 7.3, Decisão 5) — só na tabela.
_NUMERIC_TYPES = (HealthFieldType.INTEGER, HealthFieldType.DECIMAL)

# Campos mutáveis por UPDATE direto (Saúde não versiona). ``field_type`` é imutável.
_MUTABLE_FIELDS = ("name", "display_order", "enum_options", "active")

# Cap defensivo de tamanho para valores ``text`` (evita blob JSONB gigante por linha).
_MAX_TEXT_LEN = 1000


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


# --- Log diário de valores (Story 7.2, AD-01) ----------------------------------
# A segunda metade da AD-01: get_health_daily (read-model do ritual) + upsert_health_log
# (grava-só-se-tudo-válido + merge). A validação-contra-definições é o núcleo desta
# story (§6.4: tipagem de JSONB contra health_field_definitions é regra de serviço).


def _validate_value(field_type, definition, value):
    """Valida ``value`` contra o ``field_type`` da definição; devolve o valor a gravar.

    Tipo incompatível → ``DomainError`` (→ 409). ``bool`` é subclasse de ``int`` em
    Python, então é rejeitado explicitamente para ``integer``/``decimal`` (um toggle
    marcado não é um número). O caminho de limpar/remover (``null``/``""``) é tratado
    **antes** desta função em ``upsert_health_log`` — aqui todo ``value`` é um valor
    real a persistir.
    """
    if field_type == HealthFieldType.INTEGER:
        if isinstance(value, bool):
            raise DomainError("Valor inteiro inválido.")
        if isinstance(value, int):
            return int(value)
        if isinstance(value, float) and value.is_integer():
            return int(value)
        raise DomainError("Valor inteiro inválido.")

    if field_type == HealthFieldType.DECIMAL:
        if isinstance(value, bool):
            raise DomainError("Valor numérico inválido.")
        if isinstance(value, (int, float)):
            return value
        raise DomainError("Valor numérico inválido.")

    if field_type == HealthFieldType.BOOLEAN:
        if isinstance(value, bool):
            return value
        raise DomainError("Valor booleano inválido.")

    if field_type == HealthFieldType.ENUM:
        options = definition.enum_options or []
        if isinstance(value, str) and value in options:
            return value
        raise DomainError("Valor fora das opções do campo.")

    if field_type == HealthFieldType.TEXT:
        if isinstance(value, str):
            if len(value) > _MAX_TEXT_LEN:
                raise DomainError("Valor de texto excede o tamanho máximo.")
            return value
        raise DomainError("Valor de texto inválido.")

    raise DomainError("Tipo de campo desconhecido.")  # defensivo (enum fechado no DB)


def get_health_daily(*, user) -> dict:
    """Read-model do ritual matinal: **ontem no topo, hoje abaixo** (AC3).

    Resolve ``today`` e ``yesterday`` pela **autoridade temporal do servidor**
    (``today_for(user)`` — fuso do usuário; nunca ``date.today()`` cru, guardrail
    AST). Carrega os ``HealthLog`` desses dois dias (se existirem) e as definições
    **ativas** (7.1). Dias sem linha → ``values = {}``. As definições não são
    versionadas (AD-01): as duas seções renderizam o mesmo conjunto ativo atual.
    """
    today = today_for(user)
    yesterday = today - timedelta(days=1)

    rows = {
        row.date: row.values
        for row in HealthLog.objects.filter(date__in=[yesterday, today])
    }
    fields = list(list_health_fields(user=user))

    return {
        "yesterday": {"date": yesterday, "values": rows.get(yesterday, {})},
        "today": {"date": today, "values": rows.get(today, {})},
        "fields": fields,
    }


@transaction.atomic
def upsert_health_log(*, user, log_date, values) -> HealthLog:
    """Upsert-merge validado do dia ``log_date`` (AC1, AC4).

    **Grava só se TODOS os valores forem válidos** (submissão atômica): valida cada
    par ``{uuid: valor}`` **antes** de qualquer gravação. O UUID deve existir e estar
    **ativo** (o vínculo AD-01 é o UUID no JSONB, sem FK); o valor deve casar com o
    ``field_type`` da definição. Qualquer inválido → ``DomainError`` (→ 409), sem
    persistir nada.

    A gravação é um **merge**: só mescla as chaves submetidas em ``row.values``,
    preservando as demais — inclusive chaves de campos hoje **inativos** (AC4;
    nunca um replace que apagaria histórico). ``null``/``""`` para uma chave a
    **remove** do blob (limpar valor).
    """
    by_id = {str(d.id): d for d in list_health_fields(user=user)}

    validated: dict = {}
    to_remove: list[str] = []
    for key, value in values.items():
        uuid_key = str(key)
        if uuid_key not in by_id:
            raise DomainError(f"Campo de saúde desconhecido ou inativo: {uuid_key}")
        # Limpar valor: null/"" remove a chave (não grava null no blob).
        if value is None or value == "":
            to_remove.append(uuid_key)
            continue
        definition = by_id[uuid_key]
        validated[uuid_key] = _validate_value(definition.field_type, definition, value)

    row, _created = HealthLog.objects.get_or_create(date=log_date)
    # Merge (nunca replace): preserva chaves não submetidas, inclusive de campos inativos.
    row.values.update(validated)
    for uuid_key in to_remove:
        row.values.pop(uuid_key, None)
    row.save(update_fields=["values"])
    return row


# --- Camada de LEITURA de histórico (Story 7.3, AD-01/AD-14) -------------------
# A terceira parte da AD-01 (7.1 catálogo → 7.2 valores → 7.3 histórico): as
# **queries analíticas** derivadas on-read de ``health_logs.values``. Tudo é
# read-only puro — **sem** ``@transaction.atomic``, **sem** materialização/view/
# índice novo (AD-14 reserva a latitude; o modo de revisão histórica não tem NFR).
# A técnica nova é o **cast explícito do JSONB** ``(values->>'uuid')::double
# precision`` (AD-01), tanto para a série do gráfico quanto para a agregação do
# dashboard. Divergência-chave vs. Hábitos (6.4): Saúde **não** versiona e **não**
# tem ``day_type``/multiplicador — a série é uma linha simples com lacunas honestas,
# sem marcadores de mudança nem sombreamento de ritmo.

# Bound de range idêntico ao de Hábitos (``habits.services._MAX_RANGE_DAYS``).
_MAX_RANGE_DAYS = 92


def _validate_history_range(start, end) -> None:
    """Guarda das leituras de histórico: ``start <= end`` e range ≤ 92 dias.

    Espelha ``habits.services._validate_range`` (mesmo bound e mensagens de domínio).
    """
    if start > end:
        raise DomainError("A data inicial deve ser anterior ou igual à data final.")
    if (end - start).days > _MAX_RANGE_DAYS:
        raise DomainError(f"O intervalo não pode exceder {_MAX_RANGE_DAYS} dias.")


def _numeric_expr(field_id):
    """``(values ->> '<uuid>')::double precision`` — a operação analítica da AD-01.

    **Segurança do cast (Story 7.3, Decisão 4):** sempre combine com
    ``.filter(values__has_key=str(field_id))`` **antes** de anotar/agregar. Como
    ``field_type`` é imutável (7.1) e ``upsert_health_log`` (7.2) só grava número
    para campos ``integer``/``decimal``, o texto extraído por ``->>`` é **sempre**
    numérico-parseável → o cast nunca estoura. O ``has_key`` ainda limita qualquer
    risco residual às linhas que têm a chave, nunca à query inteira. Usa
    ``FloatField`` (``::double precision``), não ``DecimalField``: evita configurar
    ``max_digits``/``decimal_places`` e serve gráfico/agregação (o ``::numeric`` da
    AD-01 é ilustrativo; não há requisito de precisão decimal exata na leitura).
    """
    return Cast(KeyTextTransform(str(field_id), "values"), output_field=FloatField())


def _summarize_numeric_field(*, field_id, start, end) -> dict:
    """Resumo de período de UM campo numérico: ``count/min/max/avg/latest`` via cast.

    Filtra ``values__has_key`` (segurança do cast) e agrega com ``_numeric_expr``.
    ``latest`` = valor na **maior data com registro** dentro do range (não "hoje" se
    não houver registro nele — Decisão 8). Campo sem nenhum registro no range →
    ``{count: 0, min/max/avg/latest: None}`` (o frontend mostra "—").

    **N+1 aceitável (AD-14):** uma agregação (+1 query de ``latest``) por campo
    numérico — poucos campos, single-user, sem NFR; o single-pass fica reservado.
    """
    scoped = HealthLog.objects.filter(
        date__range=(start, end), values__has_key=str(field_id)
    )
    agg = scoped.aggregate(
        count=Count("date"),
        min=Min(_numeric_expr(field_id)),
        max=Max(_numeric_expr(field_id)),
        avg=Avg(_numeric_expr(field_id)),
    )
    latest = (
        scoped.order_by("-date")
        .annotate(num=_numeric_expr(field_id))
        .values_list("num", flat=True)
        .first()
    )
    return {
        "field_id": field_id,
        "count": agg["count"],
        "min": agg["min"],
        "max": agg["max"],
        "avg": agg["avg"],
        "latest": latest,
    }


def get_health_history(*, user, start, end) -> dict:
    """Histórico dia a dia + dashboard de período no range ``[start, end]`` — read-only.

    **Sem** ``@transaction.atomic`` (só leitura). Uma query carrega as linhas do
    range; as definições vêm de ``list_health_fields(include_inactive=True)``.
    Retorna:

    - ``fields``: definições **ativas OU que aparecem** em alguma linha do range
      (Decisão 3 — a 7.2 preserva o histórico ao desativar um campo; esconder a
      coluna apagaria o passado da visão), ordenadas por ``display_order, name``
      (Meta.ordering, herdado de ``list_health_fields``).
    - ``days``: **uma entrada por linha ``health_logs`` existente** no range
      (``{date, values}`` — o blob cru; o frontend tipa cada célula pela definição
      **viva**). Um dia sem linha simplesmente não aparece — lacuna honesta, nada
      é fabricado nem materializado.
    - ``summary``: para cada campo **numérico** em ``fields``, um resumo
      ``{field_id, count, min, max, avg, latest}`` via agregação castada.
    """
    _validate_history_range(start, end)

    rows = list(HealthLog.objects.filter(date__range=(start, end)).order_by("date"))
    definitions = list(list_health_fields(user=user, include_inactive=True))

    # Chaves de definição que aparecem em alguma linha do range — para manter na
    # tabela as colunas de campos hoje inativos que ainda têm histórico (Decisão 3).
    keys_in_range = {key for row in rows for key in row.values}
    fields = [d for d in definitions if d.active or str(d.id) in keys_in_range]

    days = [{"date": row.date, "values": row.values} for row in rows]

    summary = [
        _summarize_numeric_field(field_id=d.id, start=start, end=end)
        for d in fields
        if d.field_type in _NUMERIC_TYPES
    ]

    return {
        "start": start,
        "end": end,
        "fields": fields,
        "days": days,
        "summary": summary,
    }


def get_health_field_series(*, user, field_id, start, end) -> dict:
    """Série ``(data, valor)`` de UM campo numérico no range — read-only, via cast.

    Valida o range primeiro; depois ``HealthFieldDefinition.objects.get(id=field_id)``
    deixa o ``DoesNotExist`` subir para a view virar 404 (cross-tenant também = 404,
    via auto-scope do ``TenantManager``). Campo **não-numérico** → ``DomainError``
    (booleano/enum/texto não são plotáveis — Decisão 5). ``points`` = série ordenada
    por data derivada via ``_numeric_expr``; dias sem a chave são **omitidos** (o
    frontend desenha a lacuna com ``connectNulls={false}``, mesmo idioma de 6.4).
    """
    _validate_history_range(start, end)

    definition = HealthFieldDefinition.objects.get(id=field_id)
    if definition.field_type not in _NUMERIC_TYPES:
        raise DomainError("Só campos numéricos têm gráfico de evolução.")

    rows = (
        HealthLog.objects.filter(
            date__range=(start, end), values__has_key=str(field_id)
        )
        .annotate(num=_numeric_expr(field_id))
        .order_by("date")
        .values_list("date", "num")
    )
    points = [{"date": row_date, "value": value} for row_date, value in rows]

    return {"field": definition, "points": points}
