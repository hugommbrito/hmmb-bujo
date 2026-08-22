"""Testes de `AutomationTokenAuthentication` (AC3/AC4).

Espelha `core/tests/test_authentication.py`: chama `.authenticate(Request(raw))`
diretamente (sem endpoint), envolvendo o request cru num
`rest_framework.request.Request` real — o mesmo objeto que o DRF passa em
produção, e *diferente* do `HttpRequest` cru onde a auth class stasha o
reset-token do contexto.

A partir de `_capturar_falha` o arquivo cobre a DW-41/DW-43: os quatro casos de
recusa (hash desconhecido, token revogado, dono apagado, dono desativado) rendem
UMA exceção só, com o msgid congelado `_NO_ACTIVE_ACCOUNT` — a mesma convenção das
superfícies de refresh (DW-25) e de rota JWT (DW-31). A paridade equivalente na
camada HTTP está em `automation/tests/test_views.py`, e a comparação entre as três
superfícies em `core/tests/test_authentication.py`.
"""

import logging

import pytest
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ErrorDetail
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from automation.authentication import AutomationTokenAuthentication
from automation.models import SCOPE_CAPTURE, AutomationToken, hash_token
from automation.tests.factories import casos_de_falha_de_auth
from braindump.models import BrainDumpItem
from core.context import current_user_id
from core.exceptions import _NO_ACTIVE_ACCOUNT
from core.tenant import tenant_context


def _request(full_token=None):
    kwargs = {}
    if full_token is not None:
        kwargs["HTTP_AUTHORIZATION"] = f"Bearer {full_token}"
    return Request(APIRequestFactory().get("/", **kwargs))


def test_valid_token_returns_user_and_token_and_sets_context(user):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    request = _request(full)

    result = AutomationTokenAuthentication().authenticate(request)

    assert result is not None
    returned_user, returned_token = result
    assert returned_user == user
    assert returned_token == token
    # Tenant context setado com o dono do token.
    assert current_user_id.get() == user.id
    # `last_used_at` foi carimbado.
    token.refresh_from_db()
    assert token.last_used_at is not None
    # Reset do contextvar (como o teste do core faz).
    current_user_id.reset(request._request._tenant_context_token)


def test_no_authorization_header_returns_none_and_sets_nothing():
    request = _request()

    result = AutomationTokenAuthentication().authenticate(request)

    assert result is None
    assert not hasattr(request._request, "_tenant_context_token")
    assert current_user_id.get() is None


def test_non_bearer_header_returns_none():
    request = Request(APIRequestFactory().get("/", HTTP_AUTHORIZATION="Basic abc"))

    assert AutomationTokenAuthentication().authenticate(request) is None
    assert current_user_id.get() is None


def _capturar_falha(full_token):
    """Roda `authenticate()` esperando recusa e devolve a exceção.

    Asseve de passagem o invariante "checar-DEPOIS-carimbar": nenhuma recusa seta
    o tenant context (era o que os dois testes originais já checavam).
    """
    with pytest.raises(AuthenticationFailed) as exc:
        AutomationTokenAuthentication().authenticate(_request(full_token))
    assert current_user_id.get() is None
    return exc.value


def _assert_falha_uniforme(exc):
    """A forma única da recusa: msgid congelado, `code` da convenção, `detail` str.

    Compara contra `_NO_ACTIVE_ACCOUNT` como FONTE, nunca contra um literal
    copiado: é o que impede a mensagem desta superfície de divergir em silêncio da
    do refresh (DW-25) e da das rotas JWT (DW-31).
    """
    assert str(exc.detail) == str(_NO_ACTIVE_ACCOUNT)
    assert exc.detail.code == "no_active_account"
    # `detail` como `ErrorDetail` (um str), não o dict do `DetailDictMixin` do
    # simplejwt: é isso que faz o corpo HTTP sair `{"detail": str}`, sem `fields`
    # — e `fields.code` é justamente onde o caso vazaria.
    assert isinstance(exc.detail, ErrorDetail)


def test_unknown_hash_raises_authentication_failed():
    _assert_falha_uniforme(_capturar_falha("bujo_desconhecido"))


def test_revoked_token_raises_authentication_failed(user):
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    token.revoked_at = timezone.now()
    token.save(update_fields=["revoked_at"])

    _assert_falha_uniforme(_capturar_falha(full))


def test_dono_desativado_raises_authentication_failed(user):
    """DW-41: `is_active` nunca era consultado — o dono desativado seguia autenticando.

    Não era só canal lateral (sucesso vs. falha, o tell mais grosseiro que existe):
    desativar é a ÚNICA tranca de conta que o admin oferece (`accounts/admin.py`), e
    sem esta checagem os tokens de uma conta trancada continuavam valendo.
    """
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    user.is_active = False
    user.save(update_fields=["is_active"])

    _assert_falha_uniforme(_capturar_falha(full))
    # Checar-DEPOIS-carimbar: a recusa não pode ter carimbado `last_used_at`.
    token.refresh_from_db()
    assert token.last_used_at is None


def test_dono_apagado_raises_authentication_failed(user):
    """Dono apagado cai no MESMO ramo do hash desconhecido (`user` é CASCADE).

    A asserção do `exists()` é o que mantém o teste honesto: ele não descobre um
    ramo novo, ele fixa que a resposta do caso "dono apagado" é idêntica à do
    "hash desconhecido" *porque a linha do token deixou de existir*.
    """
    _token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    user.delete()

    assert not AutomationToken.objects.filter(token_hash=hash_token(full)).exists()
    _assert_falha_uniforme(_capturar_falha(full))


def test_os_quatro_casos_de_recusa_produzem_a_mesma_excecao():
    """DW-41/DW-43: um corpo só para os quatro casos, na camada do autenticador.

    Antes desta mudança o autenticador separava "hash desconhecido"
    (`"Token inválido"`) de "revogado" (`"Token revogado"`) por mensagem, e o dono
    desativado nem falhava. Aqui os quatro casos são medidos juntos: um valor
    distinto em cada eixo (corpo e `code`), e o valor é o da fonte única.
    """
    falhas = {caso.nome: _capturar_falha(caso.token_pleno) for caso in casos_de_falha_de_auth()}

    corpos = {nome: str(exc.detail) for nome, exc in falhas.items()}
    codigos = {nome: exc.detail.code for nome, exc in falhas.items()}

    assert len(falhas) == 4, falhas
    assert len(set(corpos.values())) == 1, corpos
    assert len(set(codigos.values())) == 1, codigos
    for exc in falhas.values():
        _assert_falha_uniforme(exc)


def test_a_recusa_registra_o_motivo_no_log_sem_token_nem_id_de_usuario(caplog):
    """O cliente perde a distinção; o operador não (racional da DW-31/DW-25).

    É também a prova de que a uniformidade acima não é "tudo falha igual por
    acidente": os três RAMOS do autenticador aparecem discriminados no log. São
    QUATRO registros e TRÊS motivos porque `dono_apagado` compartilha o ramo de
    `hash_desconhecido` (CASCADE) — a assimetria é o desenho, não um furo.

    E pina o que NÃO pode entrar no log: o segredo pleno e até o prefixo dele
    (AD-19: "token nunca aparece em log"), e o id do dono.
    """
    casos = casos_de_falha_de_auth()

    with caplog.at_level(logging.WARNING, logger="automation.authentication"):
        for caso in casos:
            _capturar_falha(caso.token_pleno)

    registros = [r for r in caplog.records if r.name == "automation.authentication"]
    mensagens = [r.getMessage() for r in registros]
    # Um registro por recusa: um a mais ou a menos significa ramo logando duas
    # vezes (ou nenhuma), e é isso que faz o log ser utilizável pelo operador.
    assert len(mensagens) == 4, mensagens
    assert all(r.levelname == "WARNING" for r in registros)
    # 401 de rotina: um traceback por request seria só ruído (igual à DW-31).
    assert all(r.exc_info is None for r in registros)
    for motivo in ("hash_desconhecido", "token_revogado", "dono_inativo"):
        assert any(motivo in m for m in mensagens), (motivo, mensagens)
    for caso in casos:
        assert all(caso.token_pleno not in m for m in mensagens), caso.nome
        assert all(caso.token_pleno[:12] not in m for m in mensagens), caso.nome
        if caso.dono_id is not None:
            assert all(str(caso.dono_id) not in m for m in mensagens), caso.nome


def test_authenticate_header_returns_bearer():
    # Sem isto o DRF responde 403 em vez de 401 (AC4).
    assert AutomationTokenAuthentication().authenticate_header(_request()) == "Bearer"


def test_context_set_by_auth_isolates_domain_query(user, other_user):
    """AC3: dentro do contexto setado por `authenticate()`, uma query de domínio
    enxerga só os dados do dono do token (caminho de isolamento coberto)."""
    with tenant_context(user):
        BrainDumpItem.objects.create(title="a")
        BrainDumpItem.objects.create(title="b")
    with tenant_context(other_user):
        BrainDumpItem.objects.create(title="c")

    # Nenhum contexto ativo agora — a auth class é quem seta.
    token, full = AutomationToken.issue(user=user, name="t", scopes=[SCOPE_CAPTURE])
    request = _request(full)

    AutomationTokenAuthentication().authenticate(request)

    # Escopo do dono do token: só os 2 itens dele, não os 3 totais.
    assert BrainDumpItem.objects.count() == 2
    current_user_id.reset(request._request._tenant_context_token)
