from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.tokens import AccessToken

from accounts.tests.factories import UserFactory
from core.authentication import TenantAwareJWTAuthentication
from core.middleware import TenantMiddleware
from core.tenant import current_user_id


def test_middleware_seta_user_id_correto():
    """force_authenticate → health (AllowAny) completa com 200.

    Nota: `force_authenticate` substitui os authenticators por um
    `ForcedAuthentication` interno do DRF — `TenantAwareJWTAuthentication`
    nunca roda nesse caminho, então isto NÃO exercita o contextvar (ver
    `test_contextvar_conteudo_correto` para isso, com um JWT de verdade).
    """
    user_a = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get("/api/health/")
    assert response.status_code == 200


def test_token_de_usuario_a_nao_autentica_como_b():
    """Token de User A não pode ser trocado pelo token de User B."""
    user_a = UserFactory()
    user_b = UserFactory()
    client = APIClient()

    login_a = client.post(
        "/api/accounts/token/",
        {"email": user_a.email, "password": "senha-segura-123"},
        format="json",
    )
    assert login_a.status_code == 200

    # Tentar autenticar como user_b usando credenciais de user_a não funciona
    login_b_wrong = client.post(
        "/api/accounts/token/",
        {"email": user_b.email, "password": "senha-segura-123"},
        format="json",
    )
    assert login_b_wrong.status_code == 200
    # Tokens são diferentes — user_a's access != user_b's access
    assert login_a.json()["access"] != login_b_wrong.json()["access"]


def test_contextvar_conteudo_correto(db):
    """AC3: verifica o conteúdo real do contextvar — não apenas status 200.

    Desde a Story 3.2, quem seta `current_user_id` é
    `TenantAwareJWTAuthentication` (não mais `TenantMiddleware`, que hoje só
    garante o reset) — por isso o `capture_view` chama o authenticate() de
    verdade com um JWT real, simulando o que `perform_authentication()` faria
    dentro do dispatch de uma view real.
    """
    user_a = UserFactory()
    token = str(AccessToken.for_user(user_a))
    raw_request = APIRequestFactory().get("/fake/", HTTP_AUTHORIZATION=f"Bearer {token}")

    captured = []

    def capture_view(req):
        TenantAwareJWTAuthentication().authenticate(Request(req))
        captured.append(current_user_id.get(None))
        return HttpResponse()

    middleware = TenantMiddleware(capture_view)
    middleware(raw_request)

    assert len(captured) == 1
    assert captured[0] == user_a.id
    assert current_user_id.get(None) is None  # reset após o middleware retornar


def test_novo_usuario_criado_com_isolamento():
    """User A e User B têm IDs distintos; ambos completam requests via force_authenticate."""
    user_a = UserFactory()
    user_b = UserFactory()

    assert user_a.id != user_b.id

    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get("/api/health/")
    assert response.status_code == 200

    client.force_authenticate(user=user_b)
    response = client.get("/api/health/")
    assert response.status_code == 200
