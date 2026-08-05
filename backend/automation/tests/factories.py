"""Factory de `AutomationToken` para os testes da Story 12.4.

`AutomationToken` **não** é `TenantModel` (é credencial de auth, plain model),
então usa `user = SubFactory(UserFactory)` diretamente (FK real) — mais simples
que o padrão `class Params` + `SelfAttribute` dos models tenant-scoped — e
**não** registra `register_isolation_case` (o contrato de isolamento parametrizado
cobre `TenantModel`s; este não é um). Ver Dev Notes da Story 12.4.

Para materializar um token com segredo conhecido (ex.: montar o header de auth),
use `AutomationToken.issue(...)` diretamente — ele retorna `(instance, full)`.

Vive aqui também o montador dos QUATRO casos de recusa do autenticador
(`casos_de_falha_de_auth`, DW-41/DW-43), compartilhado pelos testes da camada do
autenticador e pelos de HTTP.
"""

import hashlib
import uuid
from typing import NamedTuple

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from automation.models import SCOPE_CAPTURE, SCOPE_SUMMARY, AutomationToken
from core.calendar import now


class AutomationTokenFactory(DjangoModelFactory):
    class Meta:
        model = AutomationToken

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Token {n}")
    token_prefix = "bujo_teste"
    token_hash = factory.Sequence(lambda n: hashlib.sha256(f"fake-secret-{n}".encode()).hexdigest())
    scopes = factory.LazyFunction(lambda: [SCOPE_CAPTURE])


class CasoDeFalhaDeAuth(NamedTuple):
    """Um caso que `AutomationTokenAuthentication` tem de recusar (DW-41/DW-43).

    `dono_id` é `None` apenas para o hash desconhecido (nenhum token foi emitido
    para aquele segredo). Ele existe para o teste de log poder afirmar que o id do
    dono **não** aparece na mensagem — o que exige tê-lo em mãos, e no caso do dono
    apagado exige tê-lo capturado antes do `delete()`.
    """

    nome: str
    token_pleno: str
    dono_id: uuid.UUID | None


def casos_de_falha_de_auth(scopes=(SCOPE_CAPTURE, SCOPE_SUMMARY)) -> list[CasoDeFalhaDeAuth]:
    """Os quatro casos de recusa do autenticador de automação, um sujeito por caso.

    Compartilhado por `test_authentication.py` (camada do autenticador) e
    `test_views.py` (camada HTTP): as duas asseveram a MESMA propriedade —
    DW-41/DW-43, os quatro casos são indistinguíveis — em superfícies diferentes, e
    duplicar a montagem deixaria as duas listas de casos divergirem em silêncio.

    Um usuário por caso porque desativar e apagar são destrutivos e não podem
    compartilhar sujeito. A ORDEM importa: o token sai antes da mutação, já que
    `AutomationToken.issue` grava a FK do dono.

    `scopes` traz os DOIS escopos por default: o mesmo token é enviado às duas
    rotas de automação e a recusa acontece antes de `HasAutomationScope`, mas um
    token sem escopo devolveria 403 se a autenticação passasse — mascarando
    exatamente a regressão caçada (dono desativado voltando a autenticar).
    """
    dono_revogado = UserFactory()
    revogado, full_revogado = AutomationToken.issue(
        user=dono_revogado, name="revogado", scopes=list(scopes)
    )
    revogado.revoked_at = now()
    revogado.save(update_fields=["revoked_at"])

    dono_inativo = UserFactory()
    full_inativo = AutomationToken.issue(
        user=dono_inativo, name="dono inativo", scopes=list(scopes)
    )[1]
    dono_inativo.is_active = False
    dono_inativo.save(update_fields=["is_active"])

    dono_apagado = UserFactory()
    full_apagado = AutomationToken.issue(
        user=dono_apagado, name="dono apagado", scopes=list(scopes)
    )[1]
    id_do_apagado = dono_apagado.id
    dono_apagado.delete()  # `AutomationToken.user` é CASCADE: o token cai junto

    return [
        # Segredo para o qual nenhum token foi emitido.
        CasoDeFalhaDeAuth("hash_desconhecido", "bujo_desconhecido", None),
        CasoDeFalhaDeAuth("token_revogado", full_revogado, dono_revogado.id),
        CasoDeFalhaDeAuth("dono_inativo", full_inativo, dono_inativo.id),
        # Mesmo RAMO de `hash_desconhecido` (o CASCADE derrubou a linha), mas caso
        # distinto do ponto de vista de quem chama — é a identidade das respostas
        # que se asseve, não um ramo novo.
        CasoDeFalhaDeAuth("dono_apagado", full_apagado, id_do_apagado),
    ]
