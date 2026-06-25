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

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


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

    # Unknown/unexpected: let Django produce its standard 500.
    return None


def _normalise_body(data):
    """Coerce a DRF error payload into ``{"detail": str, "fields": {...}}``.

    - A serializer ``ValidationError`` produces ``{field: [msgs], ...}`` (and
      sometimes ``non_field_errors``). We surface field errors under ``fields``
      and lift ``non_field_errors`` (or a top-level list) into ``detail``.
    - A plain ``{"detail": "..."}`` (404/401/throttle/etc.) passes through, with
      no ``fields`` key added.
    """
    if isinstance(data, dict):
        if "detail" in data and len(data) == 1:
            return {"detail": _stringify(data["detail"])}

        fields = {k: _as_list(v) for k, v in data.items() if k != "non_field_errors"}
        non_field = data.get("non_field_errors")
        detail = _stringify(non_field[0]) if non_field else "Validation failed"

        body = {"detail": detail}
        if fields:
            body["fields"] = fields
        return body

    if isinstance(data, list):
        # Top-level list of messages (e.g. raised on the serializer root).
        return {"detail": _stringify(data[0]) if data else "Validation failed"}

    return {"detail": _stringify(data)}


def _as_list(value):
    """Field errors are always a list of message strings (native DRF shape)."""
    if isinstance(value, list):
        return [_stringify(v) for v in value]
    return [_stringify(value)]


def _stringify(value):
    return str(value)
