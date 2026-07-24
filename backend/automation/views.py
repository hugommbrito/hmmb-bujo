"""View externa da captura (`POST /api/capture`, AC1/AC2/AC3).

View fina (§6.2): valida o payload raso → despacha via `dispatch_capture` →
serializa a resposta curta. Autenticada por **token de automação** (opt-in
per-view, NÃO no `DEFAULT_AUTHENTICATION_CLASSES`), autorizada por **escopo**
`capture`, com `ScopedRateThrottle` (`automation-capture`) e **log estruturado**
de auditoria em cada chamada que alcança o handler.
"""

import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from automation.authentication import AutomationTokenAuthentication
from automation.models import SCOPE_CAPTURE, SCOPE_SUMMARY
from automation.permissions import HasAutomationScope
from automation.serializers import (
    CaptureRequestSerializer,
    CaptureResponseSerializer,
    SummaryResponseSerializer,
)
from automation.services import UnknownCaptureType, build_today_summary, dispatch_capture

# Precedente: `core/exceptions.py:25` usa `logging.getLogger(__name__)`.
logger = logging.getLogger(__name__)


class CaptureView(APIView):
    # Opt-in per-view: a auth class NÃO está no DEFAULT_AUTHENTICATION_CLASSES.
    authentication_classes = [AutomationTokenAuthentication]
    # Só `HasAutomationScope`: NÃO adicionar `IsAuthenticated` — seria redundante.
    # Sem header/token inválido/revogado → 401 (a auth class define
    # `authenticate_header` → "Bearer"); autenticado sem o escopo → 403. Os
    # desfechos corretos já emergem do fluxo DRF (ver Dev Notes › "401 vs 403
    # sem `IsAuthenticated`").
    permission_classes = [HasAutomationScope]
    required_scopes = [SCOPE_CAPTURE]
    # Rate limiting per-view (NÃO global): a taxa vem de
    # REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["automation-capture"]
    # (env-configurável). Chaveado por `request.user` (dono do token).
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "automation-capture"

    @extend_schema(request=CaptureRequestSerializer, responses={201: CaptureResponseSerializer})
    def post(self, request):
        # Validar SEM `raise_exception=True` para que o 400 de validação também
        # seja logado (AC3: "cada chamada que alcança o handler gera log"). Ver
        # Dev Notes › "Logar todos os desfechos do handler".
        serializer = CaptureRequestSerializer(data=request.data)
        if not serializer.is_valid():
            self._audit(request, status.HTTP_400_BAD_REQUEST)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = dispatch_capture(user=request.user, **serializer.validated_data)
        except UnknownCaptureType as exc:
            # Erro de domínio → 400 com mensagem clara vinda do dispatcher.
            self._audit(request, status.HTTP_400_BAD_REQUEST)
            return Response({"type": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        self._audit(request, status.HTTP_201_CREATED)
        return Response(
            CaptureResponseSerializer({"id": item.id}).data,
            status=status.HTTP_201_CREATED,
        )

    def _audit(self, request, status_code: int) -> None:
        """Log estruturado de auditoria (AC3).

        Emite `{token_prefix, endpoint, status}` para cada chamada que alcança o
        handler (201 e 400). O **token pleno NUNCA é logado**: `request.auth` é o
        `AutomationToken`, que só guarda `token_prefix`/`token_hash` — o segredo
        pleno sequer está acessível aqui (defesa em profundidade). Falhas de
        auth/escopo (401/403) ocorrem em `APIView.initial()`, ANTES do handler,
        e ficam fora deste log (cobertas pelo pacote de observabilidade AR-22 —
        não antecipar; Occam).
        """
        logger.info(
            "automation capture",
            extra={
                "token_prefix": request.auth.token_prefix,
                "endpoint": "/api/capture",
                "status": status_code,
            },
        )


class SummaryView(APIView):
    """Resumo do dia (`GET /api/summary/today`, AC1/AC3).

    View fina (§6.2) e **somente leitura**: compõe o resumo via `build_today_summary`
    (3 apps de domínio, read-only) → serializa a resposta agregada. Mesma espinha da
    `CaptureView`: auth por token opt-in per-view + escopo `summary` + `ScopedRateThrottle`
    (`automation-summary`) + log estruturado de auditoria. **Sem payload de entrada** →
    não há caminho 400 de validação; só 200 (+ 401/403/429 antes/fora do handler).
    """

    # Opt-in per-view: a auth class NÃO está no DEFAULT_AUTHENTICATION_CLASSES.
    authentication_classes = [AutomationTokenAuthentication]
    # Só `HasAutomationScope` (sem `IsAuthenticated`, redundante — mesmo racional
    # 401/403 da `CaptureView`): sem header/token inválido/revogado → 401 (a auth
    # class define `authenticate_header` → "Bearer"); autenticado sem escopo `summary`
    # → 403; com escopo → handler.
    permission_classes = [HasAutomationScope]
    required_scopes = [SCOPE_SUMMARY]
    # Rate limiting per-view: taxa de
    # REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["automation-summary"] (env-configurável).
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "automation-summary"

    @extend_schema(responses={200: SummaryResponseSerializer})
    def get(self, request):
        data = build_today_summary(user=request.user)
        self._audit(request, status.HTTP_200_OK)
        return Response(SummaryResponseSerializer(data).data)

    def _audit(self, request, status_code: int) -> None:
        """Log estruturado de auditoria (AC3), gêmeo do `CaptureView._audit`.

        Emite `{token_prefix, endpoint, status}` no mesmo logger `automation.views`,
        mas com mensagem **distinta** (`"automation summary"`) — de propósito: o teste de
        `caplog` da 12.5 filtra por `getMessage() == "automation capture"` e afirma
        `len == 1`, então uma mensagem distinta garante zero colisão (mesmo logger,
        mensagens diferentes). O **token pleno NUNCA é logado**: `request.auth` é o
        `AutomationToken`, que só guarda `token_prefix`/`token_hash` — o segredo pleno
        sequer está acessível aqui. `_audit` próprio (não helper compartilhado) mantém o
        blast radius mínimo na fatia final do épico (ver Dev Notes).
        """
        logger.info(
            "automation summary",
            extra={
                "token_prefix": request.auth.token_prefix,
                "endpoint": "/api/summary/today",
                "status": status_code,
            },
        )
