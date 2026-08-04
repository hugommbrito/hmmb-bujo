from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.serializers import SignupSerializer

# Corpo de erro de validação (§6.4, core.exceptions._normalise_body): tipicamente
# {"detail": "Validation failed", "fields": {campo: [msg, ...]}} quando um dos 3
# serializers (Signup/TokenObtainPair/TokenRefresh) rejeita o payload. Mas um
# corpo de requisição com JSON malformado nunca chega ao serializer -- o
# JSONParser do DRF levanta ParseError antes disso, e _normalise_body produz só
# {"detail": "JSON parse error - ..."} sem "fields" nenhum (confirmado
# empiricamente enviando um body inválido às 3 rotas: ver
# test_signup_json_malformado_retorna_400_sem_fields e os 2 testes irmãos). Por
# isso `fields` aqui é opcional (não obrigatório) -- mesma forma de correção já
# aplicada a `_TOKEN_INVALID_RESPONSE.fields` acima.
_VALIDATION_ERROR_RESPONSE = inline_serializer(
    name="AccountsValidationErrorResponse",
    fields={
        "detail": serializers.CharField(),
        "fields": serializers.DictField(
            child=serializers.ListField(child=serializers.CharField()), required=False
        ),
    },
)

# Credenciais inválidas em /token/: AuthenticationFailed nativo do DRF carrega
# só uma string em `detail` -- nunca ganha "fields" (mensagem genérica idêntica
# para email inexistente ou senha errada, de propósito).
_LOGIN_FAILED_RESPONSE = inline_serializer(
    name="AccountsLoginFailedResponse",
    fields={"detail": serializers.CharField()},
)

# /token/refresh/ tem TRÊS ramos de 401 distintos, e é por isso que `fields` aqui
# é opcional (não obrigatório) -- só o primeiro deles carrega a chave:
#
# 1. Token inválido/expirado/blacklisted -> InvalidToken do simplejwt
#    (DetailDictMixin, sempre inclui "code" ao lado de "detail")
#    -> test_token_refresh_rotacao_blacklist.
# 2. Token estruturalmente válido cujo usuário não está mais ativo
#    (USER_AUTHENTICATION_RULE) -> AuthenticationFailed NATIVO do DRF (sem
#    DetailDictMixin), produzindo {"detail": str} sem "fields" nenhum, igual ao 401
#    de login -> test_token_refresh_usuario_desativado_retorna_401_sem_fields.
#    (Achado por review adversarial 2026-08-03: a primeira pass documentou "fields"
#    como obrigatório por acreditar que só o ramo 1 existia.)
# 3. Token estruturalmente válido cuja LINHA do usuário foi apagada (DW-25):
#    TokenRefreshSerializer.validate() faz o lookup do usuário sem try/except e
#    ANTES do ramo 2, então User.DoesNotExist sobe cru -- não é APIException nem
#    DomainError, e antes da DW-25 virava o 500 do Django. Hoje o
#    custom_exception_handler central (core/exceptions.py) o traduz, reusando o
#    mesmo msgid do ramo 2 e o mesmo header WWW-Authenticate, de propósito: os dois
#    corpos são indistinguíveis, para não revelar se a conta foi desligada ou
#    apagada -> test_token_refresh_usuario_apagado_retorna_401_sem_fields e
#    test_token_refresh_401_de_desativado_e_de_apagado_sao_indistinguiveis.
_TOKEN_INVALID_RESPONSE = inline_serializer(
    name="AccountsTokenInvalidResponse",
    fields={
        "detail": serializers.CharField(),
        "fields": inline_serializer(
            name="AccountsTokenErrorCode",
            fields={"code": serializers.ListField(child=serializers.CharField())},
            required=False,
        ),
    },
)


@extend_schema(
    request=SignupSerializer,
    responses={
        201: OpenApiResponse(
            response=inline_serializer(
                name="SignupSuccessResponse", fields={"detail": serializers.CharField()}
            ),
            examples=[OpenApiExample("Sucesso", value={"detail": "Conta criada com sucesso."})],
        ),
        400: _VALIDATION_ERROR_RESPONSE,
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"detail": "Conta criada com sucesso."}, status=status.HTTP_201_CREATED)


TokenObtainPairView = extend_schema_view(
    post=extend_schema(
        responses={
            200: TokenObtainPairSerializer,
            400: _VALIDATION_ERROR_RESPONSE,
            401: _LOGIN_FAILED_RESPONSE,
        }
    ),
)(TokenObtainPairView)

TokenRefreshView = extend_schema_view(
    post=extend_schema(
        responses={
            200: TokenRefreshSerializer,
            400: _VALIDATION_ERROR_RESPONSE,
            401: _TOKEN_INVALID_RESPONSE,
        }
    ),
)(TokenRefreshView)
