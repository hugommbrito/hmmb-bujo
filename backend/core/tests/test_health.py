"""Tests for the liveness health-check (``GET /api/health/``).

The original smoke check stays: it guarantees pytest collects at least one test
(avoids exit code 5) and proves the app boots and serves ``GET /api/health/``.

The rest pin the DW-24 contract: the view declares ``@authentication_classes([])``,
so no authenticator runs and *any* ``Authorization`` header — malformed or perfectly
valid — is ignored instead of being allowed to turn a liveness probe into a 401.
Proving the valid-token half means minting a real JWT, so this module now *writes* a
user row; DB access itself was never the difference (the root ``conftest`` grants it
to every test via an autouse fixture).
"""

from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.tests.factories import UserFactory


def test_health_returns_ok():
    client = APIClient()
    response = client.get("/api/health/")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}


def test_health_com_authorization_header_invalido_retorna_200():
    # DW-24: espelha test_signup_com_authorization_header_invalido_ainda_retorna_201
    # (DW-15). Antes de `@authentication_classes([])`, a view herdava
    # DEFAULT_AUTHENTICATION_CLASSES e um header malformado era rejeitado com 401
    # por TenantAwareJWTAuthentication antes de a view rodar — apesar do docstring
    # prometer "no auth". Nenhum dos 2 testes de health existentes enviava
    # Authorization, então a regressão era invisível a ambos.
    client = APIClient()
    response = client.get("/api/health/", HTTP_AUTHORIZATION="Bearer garbage")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}


def test_health_com_bearer_valido_ignora_o_header_e_nao_seta_tenant_context():
    # Contraparte do teste acima: `@authentication_classes([])` faz o liveness
    # check ignorar QUALQUER Authorization header, não só um malformado — um
    # bearer válido também não autentica mais aqui. Os 2 testes de isolamento que
    # tocam /api/health/ (accounts/tests/test_isolation.py) usam
    # `force_authenticate`, que substitui os authenticators por um
    # ForcedAuthentication interno do DRF, então nenhum deles cobre este caminho.
    user = UserFactory()
    token = str(AccessToken.for_user(user))

    client = APIClient()
    response = client.get("/api/health/", HTTP_AUTHORIZATION=f"Bearer {token}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}
    # Superfície pública primeiro: a request nunca foi autenticada, apesar do bearer
    # válido. Isto é o que mantém o teste honesto — a asserção seguinte espia um
    # atributo PRIVADO, e um rename dele a tornaria vacuamente verde para sempre.
    assert response.wsgi_request.user.is_anonymous
    # E a prova mecânica de que nenhum autenticador rodou:
    # TenantAwareJWTAuthentication.authenticate() estampa `_tenant_context_token` no
    # request cru sempre que autentica com sucesso (core/authentication.py).
    assert not hasattr(response.wsgi_request, "_tenant_context_token")
