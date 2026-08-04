"""Domain exception taxonomy and the project-wide DRF exception handler.

Two responsibilities live here (§6.4):

1. The ``DomainError`` hierarchy — plain ``Exception`` subclasses (NOT DRF
   ``APIException``) raised by domain/service code. Because they are plain
   exceptions, DRF's default handler returns ``None`` for them; mapping them to
   HTTP status codes is the *exclusive* job of ``custom_exception_handler``.

2. ``custom_exception_handler`` — uniformises every error response body to
   ``{"detail": ..., "fields": {...}}`` (``fields`` only present when there are
   per-field validation errors, in DRF's native ``{field: [msg, ...]}`` shape)
   and maps exception → status.

This module must NOT import ``core.tenant`` or ``core.models`` — it sits at the
root of the acyclic chain ``exceptions <- tenant <- models``.
"""

import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

# The msgid simplejwt uses for its own ``no_active_account`` error (DW-25). Frozen
# here as a literal rather than read off ``TokenRefreshSerializer``: a runtime
# third-party import inside the exception handler would turn a translator into a
# failure amplifier. Freezing the msgid is safe *because* it is lazy and resolves
# through simplejwt's merged catalogue (the app is in ``INSTALLED_APPS``), so both
# 401 branches translate identically under any active locale — and because
# ``test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis``
# compares them under a non-English locale, so a future rewording upstream breaks
# a test instead of silently splitting the two messages apart.
_NO_ACTIVE_ACCOUNT = _("No active account found for the given token.")


# --- Domain exception taxonomy -------------------------------------------------
class DomainError(Exception):
    """Base for all domain/business-rule violations.

    Plain ``Exception`` (not ``APIException``) on purpose: domain code stays
    framework-agnostic and the HTTP mapping is centralised in the handler.
    """


class InvalidTransition(DomainError):
    """A state machine was asked for a transition it does not allow (AD-02)."""

    def __init__(self, from_status, to_status):
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(f"Invalid transition: {from_status} -> {to_status}")


class ImmutableSnapshot(DomainError):
    """An attempt to mutate an immutable historical snapshot (AD-06/07)."""


class InvalidReorderTarget(DomainError):
    """Reorder pedido contra um alvo que não é irmão da tarefa movida (Story 3.4)."""

    def __init__(self, task_id, target_task_id):
        self.task_id = task_id
        self.target_task_id = target_task_id
        super().__init__(f"Invalid reorder target: {task_id} -> {target_task_id}")


class WrongPlacementContainer(DomainError):
    """Placement de um template weekly sem week_start, ou monthly/annual sem month_first."""


class ClosedCycleReadOnly(DomainError):
    """Tentativa de mutar um weekly_log/monthly_log já fechado (is_cycle_closed)."""


class CycleTargetConflict(DomainError):
    """Disputa pelo alvo único de ciclo — colisão das uniques parciais (AD-28 item 2).

    "Unicidade no banco, não na disciplina": ``weekly_log``/``monthly_log`` têm
    índices únicos parciais garantindo no máximo um ``active`` e um ``planning``
    por usuário. Quando duas requisições concorrentes tentam abrir/iniciar o
    mesmo ciclo, uma delas recebe ``IntegrityError`` do Postgres — o serviço a
    traduz nesta exceção (→ 409). NÃO é transição ilegal (por isso não é
    ``InvalidTransition``): é corrida perdida por um pedido que era legal no
    momento em que foi lido.
    """


class InvalidRitualDecision(DomainError):
    """Combinação ``(alvo, item, decisão)`` que o produto não define (AD-28 item 6).

    A matriz única em ``bujo/services/rituals.py`` amarra cada uma das três
    decisões-snapshot a **um** contexto de ritual: ``keep`` só em weekly × Task,
    ``skip_week`` só em weekly × template, ``keep_undated`` só em monthly × Task.
    Toda outra célula é ilegal por decisão de produto explícita — não existe "não
    alocar neste mês" para anual e o Weekly anterior não oferece "manter"
    (EXPERIENCE.md M06/M07).

    **Por que exceção nova** (mesma lógica que criou ``CycleTargetConflict``):
    não é transição de estado ilegal (``InvalidTransition`` — o alvo pode estar
    perfeitamente em ``planning``), nem disputa pelo alvo único de ciclo
    (``CycleTargetConflict``). É uma combinação que o produto simplesmente não
    define, e o consumidor precisa poder distinguir os três casos. → 409 pelo
    mesmo handler central.

    Também é o erro devolvido quando o **item** não existe no tenant: a mensagem
    fica neutra de propósito, para não revelar a existência de linha alheia.
    """


class TenantScopeViolation(DomainError):
    """A tenant-scoped query/write ran without a tenant context set (AD-12).

    Fail-closed marker: the manager/model raises this rather than ever leaking
    cross-tenant rows. It signals an *infrastructure* bug (missing context), not
    an access denial — the handler maps it to 500 + a critical log, and the
    response body stays opaque so we never reveal that the issue is tenant-scope.
    """


# --- DRF exception handler -----------------------------------------------------
def custom_exception_handler(exc, context):
    """Project-wide DRF exception handler.

    Strategy (§6.4):
    - Call DRF's default handler first. For exceptions it understands
      (``APIException`` subclasses, ``Http404``, ``PermissionDenied``) it returns
      a ``Response``; we normalise that body to ``{detail, fields}``.
    - For ``DomainError`` (plain ``Exception``) DRF returns ``None``; we map them
      ourselves. ``TenantScopeViolation`` → opaque 500 + ``logger.critical``;
      every other ``DomainError`` → 409.
    - ``User.DoesNotExist`` (DW-25) → 401 + ``logger.warning``, carrying the same
      body *and* ``WWW-Authenticate`` challenge as DRF's own 401: the only
      non-domain exception we domesticate, because simplejwt's token refresh
      raises it uncaught (see the branch comment below).
    - Anything else with no DRF response falls through to ``None`` so Django's
      own 500 handling applies (unexpected server error).
    """
    response = exception_handler(exc, context)

    if response is not None:
        response.data = _normalise_body(response.data)
        return response

    # DRF did not recognise the exception (returned None) — handle our domain types.
    if isinstance(exc, TenantScopeViolation):
        # Infra bug, not an access denial. Do NOT domesticate and do NOT leak the
        # real reason into the body — only the critical log carries the detail.
        logger.critical("TenantScopeViolation: tenant context missing", exc_info=exc)
        return Response(
            {"detail": "Internal server error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, DomainError):
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_409_CONFLICT,
        )

    # DW-25: simplejwt's ``TokenRefreshSerializer.validate()`` looks the token's
    # user up with a bare ``.objects.get()`` — no try/except — and that lookup runs
    # *before* the ``USER_AUTHENTICATION_RULE`` check that 401s a deactivated user.
    # So a *deleted* row raises ``User.DoesNotExist``, which is neither an
    # ``APIException`` nor a ``DomainError``: DRF returned ``None`` and the client
    # got Django's raw 500 instead of the documented 401. Translating it here keeps
    # the third-party serializer untouched.
    #
    # ``get_user_model()`` is resolved at runtime because ``core.exceptions`` is
    # imported very early (see ``core/authentication.py``), so a module-level model
    # reference risks ``AppRegistryNotReady``. The cheap ``ObjectDoesNotExist`` test
    # is first so that lookup never runs on the fallback path of every unrelated
    # exception. Narrow to ``User`` on purpose: any other model's missing row is
    # still an unexpected server error.
    #
    # The branch is global, so a ``User.DoesNotExist`` leaking from some *other*
    # bug also becomes a 401 — the warning log is what keeps that visible.
    if isinstance(exc, ObjectDoesNotExist) and isinstance(exc, get_user_model().DoesNotExist):
        logger.warning("User.DoesNotExist escapou para o handler central", exc_info=exc)
        auth_header = _authenticate_header(context)
        return Response(
            {"detail": _NO_ACTIVE_ACCOUNT},
            status=status.HTTP_401_UNAUTHORIZED,
            # Body *and* challenge must match the deactivated-user 401, or the
            # presence/absence of this header alone discloses which case it was.
            headers={"WWW-Authenticate": auth_header} if auth_header else None,
        )

    # Unknown/unexpected: let Django produce its standard 500.
    return None


def _authenticate_header(context):
    """The ``WWW-Authenticate`` challenge DRF would attach to a 401, or ``None``.

    Hand-built 401s bypass the path that normally sets this header:
    ``APIView.handle_exception`` asks the view for the challenge and stashes it on
    the exception, and DRF's default handler copies it onto the response. A 401
    without a challenge violates RFC 7235 — and, worse for DW-25, it would make the
    deleted-row 401 the *only* one on ``/token/refresh/`` lacking the header, a
    one-header side channel disclosing exactly what the matching body hides.

    Returns ``None`` when the context carries no view/request (the handler's unit
    tests call it with ``{}``) or the view is not an ``APIView``. Deliberately does
    NOT reproduce DRF's "no challenge → downgrade to 403" rule: the DW-25 branch is
    always a 401.
    """
    view = context.get("view") if isinstance(context, dict) else None
    request = context.get("request") if isinstance(context, dict) else None
    get_header = getattr(view, "get_authenticate_header", None)
    if get_header is None or request is None:
        return None

    try:
        return get_header(request)
    except Exception:
        # Deriving a header must never mask the exception we were translating.
        logger.warning("Falha ao derivar WWW-Authenticate no handler central", exc_info=True)
        return None


def _normalise_body(data):
    """Coerce a DRF error payload into ``{"detail": str, "fields": {...}}``.

    - A serializer ``ValidationError`` produces ``{field: [msgs], ...}`` (and
      sometimes ``non_field_errors``). We surface field errors under ``fields``
      and lift ``non_field_errors`` (or a top-level list) into ``detail``.
    - A plain ``{"detail": "..."}`` (404/401/throttle/etc.) passes through, with
      no ``fields`` key added. When extra keys sit alongside a real ``detail``,
      that ``detail`` is kept as-is — never demoted into ``fields`` — and the
      extra keys (INCLUDING ``non_field_errors``, which is just a normal field
      key once ``detail`` already won the slot) become ``fields``.
    - ``data is None`` (no body at all) maps to a fixed generic detail, never
      the literal string ``"None"``.
    """
    if data is None:
        return {"detail": "Unexpected error"}

    if isinstance(data, dict):
        detail_value = data.get("detail")
        if detail_value is not None:
            # Route detail_value through the same flattening as every other
            # field: it may itself be a list/dict (e.g. a nested serializer
            # error under a literal "detail" key) and must never surface as a
            # stringified container.
            detail_list = _as_list(detail_value)
            fields = {k: _as_list(v) for k, v in data.items() if k != "detail"}
            body = {"detail": detail_list[0] if detail_list else "Validation failed"}
            if fields:
                body["fields"] = fields
            return body

        fields = {k: _as_list(v) for k, v in data.items() if k != "non_field_errors"}
        non_field = data.get("non_field_errors")
        detail = _stringify(_first_message(non_field)) if non_field else "Validation failed"

        body = {"detail": detail}
        if fields:
            body["fields"] = fields
        return body

    if isinstance(data, list):
        # Top-level list of messages (e.g. raised on the serializer root).
        return {"detail": _stringify(_first_message(data)) if data else "Validation failed"}

    return {"detail": _stringify(data)}


def _first_message(value):
    """Return the first message of a list, or ``value`` itself when it is not one.

    Guards ``non_field_errors``/top-level lists: DRF's native shape is a list,
    but a non-list scalar (e.g. a plain string) must be returned whole, never
    indexed by character.
    """
    return value[0] if isinstance(value, list) else value


def _as_list(value):
    """Coerce a field's error value into a flat list of message strings.

    ``fields`` is always ``{field: [str, ...]}`` (native DRF shape) — never a
    nested structure. Recurses into ``dict`` (flattening every value) and
    ``list`` (flattening every ``list``/``dict`` item, stringifying everything
    else) so a nested serializer error never surfaces as a stringified
    container.
    """
    if isinstance(value, dict):
        flattened = []
        for v in value.values():
            flattened.extend(_as_list(v))
        return flattened

    if isinstance(value, list):
        flattened = []
        for item in value:
            if isinstance(item, (list, dict)):
                flattened.extend(_as_list(item))
            else:
                flattened.append(_stringify(item))
        return flattened

    return [_stringify(value)]


def _stringify(value):
    return str(value)
