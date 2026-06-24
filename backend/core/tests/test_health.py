"""Smoke test for the liveness health-check.

Guarantees pytest collects at least one test (avoids exit code 5) and proves the
app boots and serves ``GET /api/health/``.
"""

from rest_framework import status
from rest_framework.test import APIClient


def test_health_returns_ok():
    client = APIClient()
    response = client.get("/api/health/")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}
