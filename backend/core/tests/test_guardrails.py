"""Architecture guardrails (§6.9 item 1, §7.4).

The scoped-manager guardrail walks every installed model and asserts that any
concrete ``TenantModel`` subclass exposes the auto-scoped ``TenantManager`` as
its default ``objects`` manager. This fails the build the moment a tenant model
accidentally ships an unscoped manager as ``objects`` — the most likely way to
silently break isolation.

The temporal guardrail (§6.9 item 6, Story 1.3) scans the AST of every
production Python file under ``backend/`` and fails if any code outside
``core/calendar.py`` calls ``date.today()``, ``timezone.now()``,
``datetime.now()``, ``datetime.today()``, or ``datetime.utcnow()`` directly.

The port rule (``core`` must not import domain apps) is enforced by import-linter
in CI (see pyproject.toml ``[tool.importlinter]``); it is not a pytest concern.
"""

import ast
from pathlib import Path

from django.apps import apps

from core.models import TenantModel
from core.tenant import TenantManager

# Importing the test model registers it in the app registry, so the guardrail
# also exercises at least one concrete TenantModel subclass even before any
# domain models exist.
from core.tests import models as _test_models  # noqa: F401


def _concrete_tenant_models():
    return [
        model
        for model in apps.get_models()
        if issubclass(model, TenantModel) and not model._meta.abstract
    ]


def test_tenant_models_use_scoped_default_manager():
    tenant_models = _concrete_tenant_models()

    # Sanity: the test model guarantees this is non-empty today.
    assert tenant_models, "expected at least one concrete TenantModel (the test model)"

    for model in tenant_models:
        assert isinstance(model.objects, TenantManager), (
            f"{model.__name__}.objects must be a TenantManager (auto-scoped)"
        )
        assert isinstance(model._meta.default_manager, TenantManager), (
            f"{model.__name__}._meta.default_manager must be the scoped TenantManager"
        )


def test_no_bare_date_today_outside_calendar():
    """Fail build se date.today()/timezone.now() usados fora de core/calendar.py.

    Scanner AST cobre todo backend/ exceto: o próprio módulo autoridade
    (core/calendar.py), .venv/, migrations/, __pycache__, arquivos test_ e conftest.
    Arquivos de teste usam mocks/freeze_time legitimamente — são excluídos.
    """
    FORBIDDEN = {
        ("date", "today"),
        ("timezone", "now"),
        ("datetime", "now"),
        ("datetime", "today"),
        ("datetime", "utcnow"),
    }

    backend_root = Path(__file__).resolve().parent.parent.parent
    SKIP_PARTS = {".venv", "migrations", "__pycache__"}

    violations = []
    for py_file in sorted(backend_root.rglob("*.py")):
        rel = py_file.relative_to(backend_root)

        # Pular o próprio módulo autoridade
        if rel.parts[-2:] == ("core", "calendar.py"):
            continue
        # Pular venv, migrations, pycache
        if any(p in SKIP_PARTS for p in rel.parts):
            continue
        # Pular arquivos de teste e conftest (usam mocks/freeze_time legitimamente)
        if rel.name.startswith("test_") or rel.name == "conftest.py":
            continue

        source = py_file.read_text(encoding="utf-8", errors="replace")
        try:
            tree = ast.parse(source, filename=str(rel))
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if (
                isinstance(func, ast.Attribute)
                and isinstance(func.value, ast.Name)
                and (func.value.id, func.attr) in FORBIDDEN
            ):
                violations.append(f"{rel}:{node.lineno} — {func.value.id}.{func.attr}()")

    assert not violations, (
        "Uso direto de date.today()/timezone.now() fora de core/calendar.py:\n"
        + "\n".join(violations)
    )
