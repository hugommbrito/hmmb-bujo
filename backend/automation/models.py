"""Token de automação de longa duração, escopado e revogável (AD-19, FR-3.1).

`AutomationToken` é uma **credencial de auth**, NÃO um model de domínio — por
isso é um `models.Model` puro e **não** herda `TenantModel`. Ver Dev Notes da
Story 12.4 ("Por que NÃO herda `TenantModel`"): o token é buscado por hash
*antes* de qualquer tenant context existir (o contexto é setado *como
consequência* de encontrá-lo). Se herdasse `TenantModel`, o lookup em
`authenticate()` estouraria `TenantScopeViolation` (§6.7). Segue o precedente do
próprio `User` (`accounts/models.py`), também plain model buscado por `email`
fora de contexto.

O segredo pleno é gerado e exibido **uma única vez** na criação (padrão GitHub
PAT): só o `token_hash` (SHA-256) é persistido — o pleno **nunca** é armazenado
nem logado.
"""

import hashlib
import secrets
import uuid

from django.conf import settings
from django.db import models

# Prefixo humano do segredo pleno (`bujo_<random>`), usado para identificação.
TOKEN_PREFIX_LEN = 12


class AutomationScope(models.TextChoices):
    """Escopos de autorização per-view (lista JSONB de strings, sem enum nativo
    do Postgres — AD-01 / §6.9). Reusado pelo admin, pela permissão e testes."""

    CAPTURE = "capture", "Captura (POST /api/capture)"
    SUMMARY = "summary", "Resumo (GET /api/summary/today)"


# Aliases de conveniência para uso direto no código/testes.
SCOPE_CAPTURE = AutomationScope.CAPTURE.value
SCOPE_SUMMARY = AutomationScope.SUMMARY.value


def hash_token(full_plaintext: str) -> str:
    """SHA-256 hex (64 chars) do segredo pleno.

    Hash rápido e determinístico de propósito: o lookup em `authenticate()` é por
    igualdade (`filter(token_hash=...)`) e o segredo é de alta entropia
    (`token_urlsafe(32)` ≈ 256 bits), então SHA-256 sem salt é o padrão da
    indústria para PATs (GitHub/HA). **Não** usar `make_password` (salt aleatório
    impede lookup por igualdade). [AD-19 item 1]
    """
    return hashlib.sha256(full_plaintext.encode()).hexdigest()


class AutomationToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="automation_tokens",
    )
    name = models.CharField(max_length=255)
    token_prefix = models.CharField(max_length=TOKEN_PREFIX_LEN)
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    scopes = models.JSONField(default=list)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "automation_tokens"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.token_prefix}…)"

    @classmethod
    def issue(cls, *, user, name: str, scopes: list[str]) -> tuple["AutomationToken", str]:
        """Gera um token novo e o persiste; retorna `(instance, full_plaintext)`.

        O `full_plaintext` **só** existe em memória e deve ser exibido uma única
        vez ao operador (padrão GitHub PAT) e então descartado — ele **nunca** é
        salvo (só o hash) nem logado. Formato do segredo: `bujo_<token_urlsafe>`.
        """
        full = "bujo_" + secrets.token_urlsafe(32)
        instance = cls.objects.create(
            user=user,
            name=name,
            token_prefix=full[:TOKEN_PREFIX_LEN],
            token_hash=hash_token(full),
            scopes=list(scopes),
        )
        return instance, full
