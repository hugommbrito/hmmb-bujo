import pytest
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory


@pytest.fixture
def client():
    return APIClient()


def test_signup_valido_retorna_201(client):
    payload = {
        "email": "novo@example.com",
        "password": "senha-segura-123",
        "timezone": "America/Sao_Paulo",
    }
    response = client.post("/api/accounts/signup/", payload, format="json")
    assert response.status_code == 201


def test_signup_email_duplicado_retorna_400(client):
    user = UserFactory()
    response = client.post(
        "/api/accounts/signup/",
        {"email": user.email, "password": "senha-segura-123"},
        format="json",
    )
    assert response.status_code == 400
    assert "email" in response.json()["fields"]


def test_signup_senha_fraca_retorna_400(client):
    response = client.post(
        "/api/accounts/signup/",
        {"email": "fraco@example.com", "password": "123"},
        format="json",
    )
    assert response.status_code == 400
    assert "password" in response.json()["fields"]


def test_login_valido_retorna_tokens(client):
    user = UserFactory()
    response = client.post(
        "/api/accounts/token/",
        {"email": user.email, "password": "senha-segura-123"},
        format="json",
    )
    assert response.status_code == 200
    data = response.json()
    assert "access" in data
    assert "refresh" in data


def test_login_email_invalido_retorna_401(client):
    response = client.post(
        "/api/accounts/token/",
        {"email": "naoexiste@example.com", "password": "senha-segura-123"},
        format="json",
    )
    assert response.status_code == 401


def test_login_senha_errada_retorna_401(client):
    user = UserFactory()
    response = client.post(
        "/api/accounts/token/",
        {"email": user.email, "password": "senha-errada-xxx"},
        format="json",
    )
    assert response.status_code == 401


def test_login_campo_obrigatorio_ausente_retorna_400(client):
    response = client.post(
        "/api/accounts/token/", {"email": "sem-senha@example.com"}, format="json"
    )
    assert response.status_code == 400
    assert "password" in response.json()["fields"]


def test_token_refresh_campo_obrigatorio_ausente_retorna_400(client):
    response = client.post("/api/accounts/token/refresh/", {}, format="json")
    assert response.status_code == 400
    assert "refresh" in response.json()["fields"]


def test_token_refresh_funciona(client):
    user = UserFactory()
    login = client.post(
        "/api/accounts/token/",
        {"email": user.email, "password": "senha-segura-123"},
        format="json",
    )
    refresh_token = login.json()["refresh"]
    response = client.post(
        "/api/accounts/token/refresh/",
        {"refresh": refresh_token},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.json()


def test_health_sem_auth_retorna_200(client):
    response = client.get("/api/health/")
    assert response.status_code == 200


def test_signup_com_authorization_header_invalido_ainda_retorna_201(client):
    # DW-15: signup ganhou @authentication_classes([]) -- antes disso, um
    # Authorization header inválido podia ser rejeitado por um autenticador
    # global (401) antes mesmo da view rodar, já que @api_view sem
    # authentication_classes próprio herda DEFAULT_AUTHENTICATION_CLASSES.
    # Confirma que o endpoint público continua público mesmo com um header
    # malformado presente.
    response = client.post(
        "/api/accounts/signup/",
        {"email": "authheader@example.com", "password": "senha-segura-123"},
        format="json",
        HTTP_AUTHORIZATION="Bearer garbage",
    )
    assert response.status_code == 201


def test_signup_email_normalizado_lowercase(client):
    # AC Armadilha #10: email deve ser armazenado em lowercase
    response = client.post(
        "/api/accounts/signup/",
        {"email": "UPPER@EXAMPLE.COM", "password": "senha-segura-123"},
        format="json",
    )
    assert response.status_code == 201
    from accounts.models import User
    assert User.objects.filter(email="upper@example.com").exists()


def test_signup_resposta_corpo_correto(client):
    # AC1: corpo da resposta 201 conforme spec ({"detail": "..."})
    response = client.post(
        "/api/accounts/signup/",
        {"email": "corpo@example.com", "password": "senha-segura-123"},
        format="json",
    )
    assert response.status_code == 201
    data = response.json()
    assert "detail" in data


def test_signup_sem_timezone_usa_default(client):
    # AC1: timezone padrão "America/Sao_Paulo" quando não enviado
    response = client.post(
        "/api/accounts/signup/",
        {"email": "notimezone@example.com", "password": "senha-segura-123"},
        format="json",
    )
    assert response.status_code == 201
    from accounts.models import User
    user = User.objects.get(email="notimezone@example.com")
    assert user.timezone == "America/Sao_Paulo"


def test_login_mensagem_erro_generica(client):
    # AC3: 401 deve ter mensagem genérica idêntica para email inválido e senha errada
    user = UserFactory()

    resp_email_invalido = client.post(
        "/api/accounts/token/",
        {"email": "naoexiste@example.com", "password": "senha-segura-123"},
        format="json",
    )
    resp_senha_errada = client.post(
        "/api/accounts/token/",
        {"email": user.email, "password": "senha-errada-xxx"},
        format="json",
    )

    assert resp_email_invalido.status_code == 401
    assert resp_senha_errada.status_code == 401
    # Mesma mensagem de erro — não revela se o email existe
    assert resp_email_invalido.json() == resp_senha_errada.json()
    # 401 de login nunca tem "fields" (AuthenticationFailed nativo do DRF
    # carrega só uma string em detail) — pina o formato documentado em
    # AccountsLoginFailedResponse.
    assert "fields" not in resp_email_invalido.json()
    assert "fields" not in resp_senha_errada.json()


def test_signup_timezone_invalida_retorna_400(client):
    # Timezone inválida deve ser rejeitada (IANA validation)
    response = client.post(
        "/api/accounts/signup/",
        {"email": "tzinvalid@example.com", "password": "senha-segura-123", "timezone": "Nao/Existe"},  # noqa: E501
        format="json",
    )
    assert response.status_code == 400


def test_token_refresh_rotacao_blacklist(client):
    # AC2: BLACKLIST_AFTER_ROTATION=True — token de refresh original é invalidado após uso
    user = UserFactory()
    login = client.post(
        "/api/accounts/token/",
        {"email": user.email, "password": "senha-segura-123"},
        format="json",
    )
    original_refresh = login.json()["refresh"]

    # Primeiro refresh funciona e rotaciona o token
    first = client.post(
        "/api/accounts/token/refresh/",
        {"refresh": original_refresh},
        format="json",
    )
    assert first.status_code == 200

    # Segundo uso do refresh original deve falhar (blacklisted)
    second = client.post(
        "/api/accounts/token/refresh/",
        {"refresh": original_refresh},
        format="json",
    )
    assert second.status_code == 401
    # 401 de refresh sempre tem fields.code (InvalidToken do simplejwt usa
    # DetailDictMixin) — pina o formato documentado em
    # AccountsTokenInvalidResponse, distinto do 401 de login (sem fields).
    assert second.json()["fields"]["code"]


def test_signup_json_malformado_retorna_400_sem_fields(client):
    # Achado por review adversarial (2026-08-03): _VALIDATION_ERROR_RESPONSE
    # documentava "fields" como obrigatório, mas um body JSON malformado nunca
    # chega ao serializer -- o JSONParser do DRF levanta ParseError antes disso,
    # produzindo {"detail": "JSON parse error - ..."} sem "fields" nenhum.
    response = client.post(
        "/api/accounts/signup/", data="{not valid json", content_type="application/json"
    )
    assert response.status_code == 400
    assert "fields" not in response.json()


def test_login_json_malformado_retorna_400_sem_fields(client):
    response = client.post(
        "/api/accounts/token/", data="{not valid json", content_type="application/json"
    )
    assert response.status_code == 400
    assert "fields" not in response.json()


def test_token_refresh_json_malformado_retorna_400_sem_fields(client):
    response = client.post(
        "/api/accounts/token/refresh/", data="{not valid json", content_type="application/json"
    )
    assert response.status_code == 400
    assert "fields" not in response.json()


def test_token_refresh_usuario_desativado_retorna_401_sem_fields(client):
    # TokenRefreshSerializer.validate() tem um segundo ramo de 401 distinto do
    # InvalidToken: token estruturalmente válido, mas o usuário referenciado não
    # está mais ativo (USER_AUTHENTICATION_RULE). Esse ramo levanta o
    # AuthenticationFailed NATIVO do DRF (sem DetailDictMixin) -- mesmo formato
    # do 401 de login, sem "fields". Achado por review adversarial (2026-08-03):
    # a primeira pass documentou "fields" como obrigatório em
    # AccountsTokenInvalidResponse por acreditar que só o ramo InvalidToken (com
    # "code") existia.
    user = UserFactory()
    login = client.post(
        "/api/accounts/token/",
        {"email": user.email, "password": "senha-segura-123"},
        format="json",
    )
    refresh_token = login.json()["refresh"]

    user.is_active = False
    user.save()

    response = client.post(
        "/api/accounts/token/refresh/",
        {"refresh": refresh_token},
        format="json",
    )
    assert response.status_code == 401
    assert "fields" not in response.json()
