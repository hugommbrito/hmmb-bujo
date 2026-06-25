"""Architecture guardrails (§6.9 item 1, §7.4).

The scoped-manager guardrail walks every installed model and asserts that any
concrete ``TenantModel`` subclass exposes the auto-scoped ``TenantManager`` as
its default ``objects`` manager. This fails the build the moment a tenant model
accidentally ships an unscoped manager as ``objects`` — the most likely way to
silently break isolation.

The port rule (``core`` must not import domain apps) is enforced by import-linter
in CI (see pyproject.toml ``[tool.importlinter]``); it is not a pytest concern.
"""

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
