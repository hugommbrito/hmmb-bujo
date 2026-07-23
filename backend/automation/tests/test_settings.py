"""Guardrail de configuração (AC3): a auth class de automação NÃO vale
globalmente — não está em `DEFAULT_AUTHENTICATION_CLASSES`. É opt-in per-view
(as views de 12.5/12.6 a declaram explicitamente)."""

from django.conf import settings


def test_automation_auth_not_in_default_authentication_classes():
    default_classes = settings.REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]
    assert not any("AutomationTokenAuthentication" in cls for cls in default_classes)


def test_automation_app_is_installed():
    assert "automation" in settings.INSTALLED_APPS
