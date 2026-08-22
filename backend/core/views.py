"""Core views shared across the project."""

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


# A ordem dos decorators abaixo é load-bearing: ``@api_view`` precisa ficar por
# fora (é ele que lê ``permission_classes``/``authentication_classes`` da função
# que os decorators internos anotam), e ``@authentication_classes([])`` precisa
# continuar presente — sem ele a view volta a herdar o autenticador JWT global
# (DW-24; ver docstring).
@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def health(_request: Request) -> Response:
    """Liveness check — sem acesso a DB e com qualquer ``Authorization`` ignorado.

    Retorna 200 ``{"status": "ok"}``.

    ``@authentication_classes([])`` é o que torna o "no auth" literalmente
    verdadeiro (DW-24, mesma correção que a DW-15 aplicou a
    ``accounts/views.py::signup``): ``@api_view`` sem ``authentication_classes``
    próprio herda ``DEFAULT_AUTHENTICATION_CLASSES``
    (``TenantAwareJWTAuthentication``), então um bearer malformado fazia o liveness
    check responder 401 — um falso "unhealthy" para qualquer probe ou reverse proxy
    que encaminhasse um header velho. Com a lista vazia nenhum autenticador roda:
    um header malformado E um JWT perfeitamente válido são ambos ignorados, a
    request segue anônima e nenhum contexto de tenant é setado (a view não toca o
    banco, então não precisa de um).
    """
    return Response({"status": "ok"})
