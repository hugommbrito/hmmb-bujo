"""Regression guard for prod.py's HTTPS/HSTS hardening (DW-4).

Nothing else in the suite imports ``config.settings.prod`` directly — pytest
runs under ``config.settings.test`` locally, or ``config.settings.dev`` in CI
(``DJANGO_SETTINGS_MODULE`` in the CI workflow env overrides the
``pyproject.toml`` default; see ``pyproject.toml``'s comment on that override) —
so this is the only test that would catch a missing/broken hardening setting or
a healthcheck exemption regex that stops matching Railway's healthcheck path.
"""

import importlib
import re
import tomllib
from pathlib import Path

from django.test import Client, override_settings
from django.urls import reverse


def _security_middleware_settings():
    """SecurityMiddleware-read settings, pulled from the real ``prod`` module.

    Sourced from ``config.settings.prod`` (not hardcoded) so the HTTP-level
    tests below stay coupled to whatever prod.py actually sets — a future edit
    to ``SECURE_REDIRECT_EXEMPT``/``SECURE_SSL_REDIRECT``/``SECURE_PROXY_SSL_HEADER``
    would break these tests instead of silently escaping coverage.
    """
    prod_settings = importlib.import_module("config.settings.prod")
    return {
        "SECURE_SSL_REDIRECT": prod_settings.SECURE_SSL_REDIRECT,
        "SECURE_REDIRECT_EXEMPT": prod_settings.SECURE_REDIRECT_EXEMPT,
        "SECURE_HSTS_SECONDS": prod_settings.SECURE_HSTS_SECONDS,
        "SECURE_HSTS_INCLUDE_SUBDOMAINS": prod_settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
        "SECURE_HSTS_PRELOAD": prod_settings.SECURE_HSTS_PRELOAD,
        # Pre-existing in prod.py (not part of DW-4), but SecurityMiddleware
        # needs it active to recognize HTTP_X_FORWARDED_PROTO as "secure" —
        # without it the trusted-proxy simulation below wouldn't be honest.
        "SECURE_PROXY_SSL_HEADER": prod_settings.SECURE_PROXY_SSL_HEADER,
    }


def test_prod_settings_https_and_hsts_hardening():
    prod_settings = importlib.import_module("config.settings.prod")

    assert prod_settings.SECURE_SSL_REDIRECT is True
    assert prod_settings.SECURE_HSTS_SECONDS == 31536000
    assert prod_settings.SECURE_HSTS_INCLUDE_SUBDOMAINS is True
    assert prod_settings.SECURE_HSTS_PRELOAD is True

    assert prod_settings.SECURE_REDIRECT_EXEMPT == [r"^api/health/$"]
    exempt_pattern = prod_settings.SECURE_REDIRECT_EXEMPT[0]
    assert re.search(exempt_pattern, reverse("health").lstrip("/"))


def test_exempt_pattern_is_anchored_not_a_prefix_match():
    """`^...$` must anchor exactly — a loosened regex (e.g. dropping the `$`)
    would start exempting unrelated paths like ``api/health/extra`` from the
    redirect, silently widening what bypasses HTTPS enforcement.
    """
    prod_settings = importlib.import_module("config.settings.prod")
    exempt_pattern = prod_settings.SECURE_REDIRECT_EXEMPT[0]

    near_miss = reverse("health").lstrip("/") + "extra"
    assert re.search(exempt_pattern, near_miss) is None
    assert re.search(exempt_pattern, "api/healthcheck/") is None


def test_healthcheck_path_is_exempt_from_ssl_redirect_under_prod_hardening():
    """Railway's healthcheck hits the container without X-Forwarded-Proto.

    SecurityMiddleware reads its settings once, in ``__init__`` — so the
    override only takes effect for a ``Client`` built (and used) *inside* the
    ``override_settings`` block, which is why one is constructed fresh here
    instead of reusing a fixture built under the plain test settings.
    """
    with override_settings(**_security_middleware_settings()):
        response = Client().get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_other_paths_redirect_to_https_under_prod_hardening():
    """Confirms the exemption is narrow: everything else still gets a 301
    to the exact same host and path — not just some https:// URL.

    ``/api/accounts/`` is an arbitrary non-exempt path, not a route this test
    depends on resolving: ``SecurityMiddleware``'s redirect fires before URL
    resolution, so this would pass the same way against any path outside
    ``SECURE_REDIRECT_EXEMPT``.
    """
    with override_settings(**_security_middleware_settings()):
        response = Client().get("/api/accounts/")

    assert response.status_code == 301
    assert response.headers["Location"] == "https://testserver/api/accounts/"


def test_secure_request_via_trusted_proxy_is_not_redirected_and_gets_hsts_header():
    """Simulates Railway's edge (unlike its internal healthcheck, the edge DOES
    forward X-Forwarded-Proto). SECURE_PROXY_SSL_HEADER — already set in
    prod.py — is what makes Django treat this request as secure: no redirect,
    and the HSTS header Django only emits for secure requests is present.
    """
    with override_settings(**_security_middleware_settings()):
        response = Client().get("/api/accounts/", HTTP_X_FORWARDED_PROTO="https")

    assert response.status_code != 301
    assert "Location" not in response.headers
    assert (
        response.headers["Strict-Transport-Security"]
        == "max-age=31536000; includeSubDomains; preload"
    )


def test_redirect_exempt_pattern_matches_railway_healthcheck_path():
    """`railway.toml`'s `healthcheckPath` and prod.py's `SECURE_REDIRECT_EXEMPT`
    are two independent, hand-maintained strings with no shared source of
    truth. If someone changes one without the other, Railway's healthcheck
    would start getting redirected (301) instead of 200, and the platform
    would mark the release unhealthy and block rollout — this guards that
    they stay in sync.
    """
    prod_settings = importlib.import_module("config.settings.prod")
    railway_toml = Path(__file__).resolve().parent.parent.parent / "railway.toml"
    healthcheck_path = tomllib.loads(railway_toml.read_text())["deploy"]["healthcheckPath"]

    exempt_pattern = prod_settings.SECURE_REDIRECT_EXEMPT[0]
    assert re.search(exempt_pattern, healthcheck_path.lstrip("/"))


def test_ci_prod_deploy_check_keeps_security_fail_level_gate():
    """`--tag security --fail-level WARNING` (ci.yml) is what turns
    `security.W004`/`W008` from harmless warnings (exit 0) into a real CI
    failure -- see Review Triage Log, 2026-07-31. A future edit that quietly
    drops either flag would silently revert the step to a no-op deploy check,
    with nothing else in the suite that would notice.
    """
    ci_yml = Path(__file__).resolve().parents[3] / ".github" / "workflows" / "ci.yml"
    content = ci_yml.read_text()

    deploy_check_lines = [
        line
        for line in content.splitlines()
        if "check --deploy" in line and "config.settings.prod" in line
    ]
    assert len(deploy_check_lines) == 1, (
        "expected exactly one `check --deploy ... config.settings.prod` line in ci.yml"
    )
    line = deploy_check_lines[0]
    assert "--tag security" in line
    assert "--fail-level WARNING" in line
