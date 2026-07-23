"""Autorização por escopo, per-view (AD-19 item 2, AC4).

A auth class (`AutomationTokenAuthentication`) valida **identidade** (hash +
não-revogado) e para por aí — uma auth class é global à requisição, não conhece
qual escopo um endpoint arbitrário exige. A checagem de **escopo** é
autorização **per-view**: `HasAutomationScope` lê o escopo exigido declarado
pela própria view e o compara com `request.auth.scopes`.

Contrato da view: declarar os escopos exigidos em `required_scopes: list[str]`
(ou `required_scope: str` para um único). A permissão concede apenas se **todos**
os escopos exigidos estiverem presentes nos scopes do token. As views das
Stories 12.5/12.6 consumirão este contrato.

Falta de escopo → `has_permission` retorna `False` → DRF responde **403**
(autenticado, mas sem autorização) — diferente do 401 de falha de autenticação.
"""

from rest_framework.permissions import BasePermission

from automation.models import AutomationToken


class HasAutomationScope(BasePermission):
    message = "Token sem o escopo exigido por este endpoint."

    def _required_scopes(self, view) -> list[str]:
        required = getattr(view, "required_scopes", None)
        if required is None:
            single = getattr(view, "required_scope", None)
            required = [single] if single else []
        return list(required)

    def has_permission(self, request, view) -> bool:
        token = getattr(request, "auth", None)
        # Fail-closed: se a view não usou a auth class (auth não é um
        # AutomationToken), nega com segurança em vez de estourar.
        if not isinstance(token, AutomationToken):
            return False

        token_scopes = set(token.scopes or [])
        return all(scope in token_scopes for scope in self._required_scopes(view))
