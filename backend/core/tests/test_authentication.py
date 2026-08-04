"""Tests for ``TenantAwareJWTAuthentication`` (§6.7).

This is what actually wakes up ``current_user_id`` for a real JWT-bearer
request — Django middleware runs before ``request.user`` is resolved, so only
an authentication class (running inside DRF's ``perform_authentication()``)
sees the real user in time to set the context. See ``core/middleware.py`` for
the matching teardown half of this contract.

Wrapped in a real ``rest_framework.request.Request`` (not the raw
``APIRequestFactory`` request) on purpose: that's what DRF actually passes to
``authenticate()`` in production, and it is a *different object* from the raw
Django request — the exact distinction this authentication class has to get
right (it stashes the token on ``request._request``, not on ``request``
itself). Testing against the raw request directly would silently miss that.

A segunda metade do arquivo (a partir de ``_desativar``) cobre outra coisa: a
DW-31, que colapsa "usuário apagado" e "usuário inativo" num 401 único em toda
rota autenticada por esta classe. Aqui vive também o ÚNICO teste do projeto que
compara as duas superfícies de ``no_active_account`` entre si
(``test_401_de_no_active_account_e_uma_convencao_so_nas_duas_superficies``) — a
paridade dentro de cada superfície é testada em ``accounts/tests/test_views.py``
(refresh × refresh) e logo abaixo (rota × rota), e nenhuma das duas notaria as
convenções se separando.
"""

import json

import pytest
import rest_framework_simplejwt.settings as simplejwt_settings
from django.utils import translation
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.exceptions import AuthenticationFailed, ErrorDetail
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed as SimpleJWTAuthFailed
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from accounts.tests.factories import UserFactory
from core.authentication import (
    _INDISTINGUISHABLE_CODES,
    TenantAwareJWTAuthentication,
    _failure_code,
)
from core.exceptions import _NO_ACTIVE_ACCOUNT
from core.tenant import current_user_id

# Rota autenticada qualquer que NÃO é a de refresh: o furo da DW-25 era exatamente
# valer só lá. Acoplamento por string de URL de propósito — importar `bujo` aqui
# quebraria o contrato de import do `core` (port rule, pyproject.toml).
TODAY_LOG_URL = "/api/bujo/logs/today/"
REFRESH_URL = "/api/accounts/token/refresh/"


@pytest.mark.django_db
def test_authenticate_sets_tenant_context_for_a_valid_token():
    user = UserFactory()
    token = str(AccessToken.for_user(user))
    raw_request = APIRequestFactory().get("/", HTTP_AUTHORIZATION=f"Bearer {token}")

    result = TenantAwareJWTAuthentication().authenticate(Request(raw_request))

    assert result is not None
    assert current_user_id.get() == user.id
    current_user_id.reset(raw_request._tenant_context_token)


def test_authenticate_sets_nothing_without_credentials():
    raw_request = APIRequestFactory().get("/")

    result = TenantAwareJWTAuthentication().authenticate(Request(raw_request))

    assert result is None
    assert not hasattr(raw_request, "_tenant_context_token")
    assert current_user_id.get() is None


def test_spectacular_resolves_a_security_scheme_for_this_class():
    """Regression: drf-spectacular's ``OpenApiAuthenticationExtension`` matches
    ``target_class`` by exact import path (``match_subclasses = False``), so
    swapping ``DEFAULT_AUTHENTICATION_CLASSES`` to this subclass of
    ``JWTAuthentication`` silently dropped the ``security``/``securitySchemes``
    blocks from every endpoint's generated schema — none of the library's
    built-in ``SimpleJWTScheme`` extensions matched anymore.
    ``TenantAwareJWTAuthenticationScheme`` (registered as a side effect of
    importing ``core.authentication``, this module's import above) must
    resolve, or schema.yaml silently drifts from what a fresh
    ``manage.py spectacular`` run produces."""
    match = OpenApiAuthenticationExtension.get_match(TenantAwareJWTAuthentication)

    assert match is not None
    assert match.name == "jwtAuth"


# --- DW-31: apagado vs. desativado indistinguíveis em rota autenticada ----------
def _desativar(user):
    user.is_active = False
    user.save()


def _apagar(user):
    user.delete()


def _token_de_usuario_mutado(mutate):
    """Access token de um usuário novo, emitido ANTES de ``mutate`` agir sobre ele.

    Cada chamada cria o seu próprio usuário: as duas mutações usadas aqui
    (desativar / apagar) são destrutivas e não podem compartilhar sujeito. A ordem
    importa — ``AccessToken.for_user`` lê o id da linha, então o token tem de sair
    antes de a linha ser apagada.
    """
    user = UserFactory()
    token = AccessToken.for_user(user)
    mutate(user)
    return token


def test_get_user_colapsa_usuario_apagado_e_desativado_na_mesma_falha():
    """``get_user`` sem o stack HTTP: as duas falhas são a MESMA exceção (DW-31).

    ``JWTAuthentication.get_user`` distingue os dois casos por mensagem e por
    código (``user_not_found`` vs. ``user_inactive``), o que revela se a linha do
    usuário existe em toda request autenticada.
    """
    token_apagado = _token_de_usuario_mutado(_apagar)
    token_desativado = _token_de_usuario_mutado(_desativar)

    with pytest.raises(AuthenticationFailed) as apagado:
        TenantAwareJWTAuthentication().get_user(token_apagado)
    with pytest.raises(AuthenticationFailed) as desativado:
        TenantAwareJWTAuthentication().get_user(token_desativado)

    assert str(apagado.value.detail) == str(desativado.value.detail)
    assert apagado.value.detail.code == desativado.value.detail.code
    assert str(apagado.value.detail) == str(_NO_ACTIVE_ACCOUNT)
    assert apagado.value.detail.code == "no_active_account"
    # Forma: `detail` como `ErrorDetail` (um str), não o dict do `DetailDictMixin`
    # do simplejwt. É o que faz o corpo sair `{"detail": str}` sem `fields`, igual
    # ao 401 de refresh. É a propriedade que importa no fio.
    assert not isinstance(apagado.value.detail, dict)
    assert not isinstance(desativado.value.detail, dict)
    # E a asserção direta do que aquela é proxy: a exceção levantada é a NATIVA do
    # DRF, não a subclasse do simplejwt (que satisfaria o `pytest.raises` acima).
    assert not isinstance(apagado.value, SimpleJWTAuthFailed)
    assert not isinstance(desativado.value, SimpleJWTAuthFailed)

    # Encadeamento: o `from exc` é o último rastro da causa real depois de o corpo
    # ficar neutro (o log é o outro). Um refactor que o derrube apaga esse rastro —
    # falha aqui em vez de sumir em silêncio.
    assert _failure_code(apagado.value.__cause__) == "user_not_found"
    assert _failure_code(desativado.value.__cause__) == "user_inactive"


def test_o_colapso_registra_o_codigo_original_no_log(caplog):
    """O cliente perde a distinção; o operador não (DW-31).

    Mesma razão do ``logger.warning`` do ramo da DW-25: o corpo neutro é a
    propriedade de segurança, e o log é o que impede o caso de desaparecer. Pina
    também o que NÃO pode entrar no log — id de usuário e conteúdo de token.
    """
    token_apagado = _token_de_usuario_mutado(_apagar)
    token_desativado = _token_de_usuario_mutado(_desativar)

    with caplog.at_level("WARNING", logger="core.authentication"):
        for token in (token_apagado, token_desativado):
            with pytest.raises(AuthenticationFailed):
                TenantAwareJWTAuthentication().get_user(token)

    mensagens = [r.getMessage() for r in caplog.records if r.name == "core.authentication"]
    assert any("user_not_found" in m for m in mensagens), mensagens
    assert any("user_inactive" in m for m in mensagens), mensagens
    assert all(r.levelname == "WARNING" for r in caplog.records if r.name == "core.authentication")
    # 401 de rotina: um traceback por request seria só ruído.
    assert all(r.exc_info is None for r in caplog.records if r.name == "core.authentication")
    # Um registro por colapso, na ordem do loop acima — é o que o `zip` a seguir
    # assume ao pareá-los com os tokens. Asseverado aqui, e não deixado para o
    # `strict=True`, porque lá um registro a mais ou a menos sai como `ValueError`
    # cru em vez de dizer quantos registros vieram.
    assert len(mensagens) == 2, mensagens
    # Nada de identidade nem de credencial no log.
    for token, m in zip((token_apagado, token_desativado), mensagens, strict=True):
        assert str(token) not in m
        assert str(token[jwt_settings.USER_ID_CLAIM]) not in m


def test_upstream_ainda_levanta_exatamente_os_codigos_do_frozenset():
    """Pin direto do contrato upstream que ``_INDISTINGUISHABLE_CODES`` duplica.

    Mesmo raciocínio de ``core/tests/test_exceptions.py`` para o msgid congelado da
    DW-25: sem este pin, um rename upstream faria o colapso parar de acontecer e a
    falha apareceria como "indistinguibilidade quebrada" — sintoma, não causa.
    Chama a implementação do PAI (contornando o override) justamente para observar
    os códigos crus que o frozenset precisa casar.
    """
    token_apagado = _token_de_usuario_mutado(_apagar)
    token_desativado = _token_de_usuario_mutado(_desativar)
    autenticador = TenantAwareJWTAuthentication()

    with pytest.raises(AuthenticationFailed) as apagado:
        JWTAuthentication.get_user(autenticador, token_apagado)
    with pytest.raises(AuthenticationFailed) as desativado:
        JWTAuthentication.get_user(autenticador, token_desativado)

    codigos_upstream = {_failure_code(apagado.value), _failure_code(desativado.value)}
    # Igualdade, não contenção: pinça o rename upstream E o frozenset encolhendo.
    # O preço é que este teste também fala quando o frozenset é alargado DE
    # PROPÓSITO (ex. incluir `password_changed` se `CHECK_REVOKE_TOKEN` for ligado —
    # ver o teste dos settings abaixo). Daí a mensagem nomear as duas causas: sem
    # ela, um alargamento intencional se lê como "o upstream renomeou um código".
    assert codigos_upstream == set(_INDISTINGUISHABLE_CODES), (
        "Os códigos que o simplejwt levanta hoje divergiram de "
        f"_INDISTINGUISHABLE_CODES. Upstream: {sorted(codigos_upstream)}; "
        f"frozenset: {sorted(_INDISTINGUISHABLE_CODES)}. Duas causas possíveis: "
        "(a) o upstream renomeou/alterou os códigos — o colapso parou de "
        "acontecer e o canal lateral voltou; ou (b) o frozenset foi alargado de "
        "propósito para um código que não vem destes dois ramos, e é este pin que "
        "precisa acompanhar a decisão."
    )


def test_os_dois_settings_de_que_o_colapso_depende_seguem_nos_defaults_seguros():
    """Pin dos settings que fazem o colapso da DW-31 significar algo.

    O frozenset é só metade do desenho; a outra metade é a configuração do
    simplejwt, e nada a segurava. Dois eixos, dois modos de falha:

    ``CHECK_USER_IS_ACTIVE`` (default ``True``) é o que faz o upstream levantar
    ``user_inactive``. Ligado em ``False``, o ramo simplesmente não acontece: um
    usuário desativado volta a receber **200** em toda rota autenticada — não é
    canal lateral, é bypass de desativação. O ``Never`` do intent da DW-31 diz que
    ele "fica no default ``True``", e este é o único lugar que checa isso.

    ``CHECK_REVOKE_TOKEN`` (default ``False``) é o que mantém ``password_changed``
    inalcançável. Ligado em ``True``, ele passa a ser levantado — e só DEPOIS de o
    lookup achar a linha e ``is_active`` passar, logo divulgando existência de
    linha — sem entrar em ``_INDISTINGUISHABLE_CODES``. Nenhum outro teste notaria
    o flip (os tokens daqui são recém-emitidos e o claim de hash de senha casa).

    Isto é tripwire, não veto: a decisão de colapsar ``password_changed`` também
    (ou de assumir o vazamento) está deferida de propósito. O que este teste impede
    é a decisão ser tomada por acidente, em silêncio, num diff de settings.

    Lê pelo MÓDULO (``simplejwt_settings.api_settings``), não pelo ``jwt_settings``
    importado no topo: ``reload_api_settings`` reage a ``setting_changed``
    **rebindando** o global ``api_settings`` a um objeto novo (upstream
    ``settings.py``), então um nome importado por valor fica preso ao objeto antigo e
    um ``override_settings(SIMPLE_JWT=...)`` passaria invisível. Pelo módulo, o pin
    pega tanto o diff no arquivo de settings (medido: fica ``True``/``False`` como
    esperado) quanto o override em runtime. O nome local NÃO é ``jwt_settings``
    de propósito: rebatizá-lo sombrearia o import do topo e, no dia em que esta
    linha fosse removida num refactor, o teste passaria a ler exatamente o global
    obsoleto contra o qual este parágrafo alerta.

    ALCANCE, dito sem exagero: isto resolve o settings module que o pytest carregou
    (``config.settings.test`` local, ``config.settings.dev`` na CI), nunca o de
    produção. Um override de ``SIMPLE_JWT`` só em ``config/settings/prod.py``
    passaria por aqui verde — quem cobre esse eixo é
    ``core/tests/test_prod_settings.py::test_prod_mantem_os_settings_de_jwt_de_que_a_indistinguibilidade_depende``.
    """
    settings_vivos = simplejwt_settings.api_settings
    assert settings_vivos.CHECK_USER_IS_ACTIVE is True, (
        "CHECK_USER_IS_ACTIVE saiu do default True: o ramo `user_inactive` do "
        "upstream deixa de ser levantado e um usuário desativado volta a receber "
        "200 em toda rota autenticada. Ver o Never do intent da DW-31."
    )
    assert settings_vivos.CHECK_REVOKE_TOKEN is False, (
        "CHECK_REVOKE_TOKEN saiu do default False: `password_changed` passa a ser "
        "alcançável e divulga existência de linha sem colapsar. Antes de ligar, "
        "decidir se ele entra em _INDISTINGUISHABLE_CODES (core/authentication.py) "
        "— e então este pin e o de códigos do upstream acompanham a decisão."
    )


def test_o_setting_de_que_a_paridade_do_refresh_depende_segue_no_default_seguro():
    """Pin do TERCEIRO knob — o que governa a outra metade da comparação.

    ``test_401_de_no_active_account_e_uma_convencao_so_nas_duas_superficies``
    compara a rota autenticada contra ``POST /api/accounts/token/refresh/``, e as
    duas metades derivam o 401 de desativado de settings DIFERENTES. A rota vem de
    ``CHECK_USER_IS_ACTIVE`` (pinçado acima, dentro de
    ``JWTAuthentication.get_user``). O refresh **não**: ``TokenRefreshSerializer``
    chama ``api_settings.USER_AUTHENTICATION_RULE(user)`` (upstream
    ``serializers.py``), cujo default ``default_user_authentication_rule`` é o que
    consulta ``user.is_active``.

    Consequência de deixá-lo solto: apontar ``USER_AUTHENTICATION_RULE`` para uma
    regra que aceite inativos faz o refresh devolver **200** para um usuário
    desativado enquanto um apagado segue 401ando — o eixo da DW-25 reaberto, e do
    lado mais grosseiro (sucesso vs. falha). Os dois pins acima seguem verdes, e o
    único teste a falhar seria o cross-superfície — como SINTOMA ("as convenções se
    separaram"), não nomeando a causa. É o mesmo motivo pelo qual
    ``test_upstream_ainda_levanta_exatamente_os_codigos_do_frozenset`` existe.
    """
    from rest_framework_simplejwt.authentication import default_user_authentication_rule

    settings_vivos = simplejwt_settings.api_settings
    assert settings_vivos.USER_AUTHENTICATION_RULE is default_user_authentication_rule, (
        "USER_AUTHENTICATION_RULE saiu do default: é ele, e não "
        "CHECK_USER_IS_ACTIVE, que faz POST /api/accounts/token/refresh/ recusar "
        "um usuário desativado. Uma regra que aceite inativos devolve 200 no "
        "refresh do desativado e 401 no do apagado, reabrindo o eixo da DW-25 "
        "nessa superfície — e o cross-superfície falharia como sintoma."
    )


def test_get_user_devolve_o_usuario_de_um_token_valido():
    """Caminho feliz através do override — o único que devolve o usuário.

    Hoje ele só é coberto de raspão, via ``authenticate()``. Um ``except`` largo
    demais ou um ``return`` esquecido no override deixaria toda a API 401.
    """
    user = UserFactory()

    assert TenantAwareJWTAuthentication().get_user(AccessToken.for_user(user)) == user


def test_get_user_nao_colapsa_token_sem_claim_de_usuario():
    """Regressão de não-colapso: o filtro é estreito (DW-31).

    ``InvalidToken`` é subclasse do ``AuthenticationFailed`` do simplejwt, então
    um ``except`` por classe engoliria também este 401 — que não revela existência
    de linha e deve continuar dizendo ``token_not_valid``.
    """
    token = AccessToken.for_user(UserFactory())
    # O nome do claim é configurável (``SIMPLE_JWT["USER_ID_CLAIM"]``), então lê-lo
    # do settings do simplejwt é o que mantém o teste testando o que ele quer dizer.
    del token.payload[jwt_settings.USER_ID_CLAIM]

    with pytest.raises(InvalidToken) as exc:
        TenantAwareJWTAuthentication().get_user(token)

    assert exc.value.detail["code"] == "token_not_valid"


def test_failure_code_le_as_tres_formas_de_detail():
    """``_failure_code`` sozinho: as duas formas vivas e a de fallback.

    Na prática tudo que chega ao ``except`` vem do ``DetailDictMixin`` do simplejwt
    (sempre a forma de dict), então os outros dois ramos são defensivos — e ficam
    testados em vez de removidos: o dia em que o upstream trocar de forma, o
    discriminador continua funcionando e é aqui que isso está escrito.
    """
    # Forma do simplejwt (DetailDictMixin): `detail` é dict com a chave `code`.
    assert _failure_code(SimpleJWTAuthFailed("qualquer", code="user_inactive")) == "user_inactive"

    # Forma nativa do DRF: `detail` é um `ErrorDetail` (str) que carrega `.code`.
    nativa = AuthenticationFailed("qualquer", code="no_active_account")
    assert isinstance(nativa.detail, ErrorDetail)
    assert _failure_code(nativa) == "no_active_account"

    # Sem código algum: `detail` é uma lista (nem dict nem portador de `.code`).
    sem_codigo = AuthenticationFailed(["a", "b"])
    assert isinstance(sem_codigo.detail, list)
    assert _failure_code(sem_codigo) is None


def _get_today_log(mutate):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_token_de_usuario_mutado(mutate)}")
    return client.get(TODAY_LOG_URL)


def test_401_de_apagado_e_de_desativado_sao_indistinguiveis_em_rota_autenticada():
    """A propriedade da DW-25 valendo onde ela realmente precisa valer (DW-31).

    A DW-25 fechou a paridade só em ``POST /api/accounts/token/refresh/``; quem
    tem um access token válido distinguia os dois casos trivialmente em qualquer
    outra rota. Bearer real de propósito: a fixture ``auth_client`` do
    ``conftest.py`` usa ``force_authenticate``, que bypassa o autenticador e não
    exercitaria nada disto.

    Sobre o eixo de locale, vale a mesma leitura de
    ``accounts/tests/test_views.py``: hoje não há ``LocaleMiddleware`` e
    ``LANGUAGE_CODE="en-us"``, então em produção os dois corpos saem em inglês e
    só o ``translation.override`` daqui ativa pt-br. O valor vivo desta metade é
    detectar um rewording futuro do simplejwt — o msgid congelado em
    ``core/exceptions.py`` deixaria de casar com o catálogo e as duas strings
    colapsariam numa só, em inglês.
    """
    with translation.override("pt-br"):
        pt_desativado = _get_today_log(_desativar)
        pt_apagado = _get_today_log(_apagar)
    with translation.override("en-us"):
        en_apagado = _get_today_log(_apagar)
        # Resolvido DENTRO do override: `_NO_ACTIVE_ACCOUNT` é `gettext_lazy`, então
        # `str()` rende o texto do locale ativo no momento da chamada.
        en_msgid = str(_NO_ACTIVE_ACCOUNT)

    assert pt_desativado.status_code == 401
    assert pt_apagado.status_code == pt_desativado.status_code
    assert pt_apagado.json() == pt_desativado.json()
    # Mesma forma do 401 de refresh (DW-25): sem `fields`, logo sem `fields.code`,
    # que é justamente onde `user_not_found`/`user_inactive` vazavam.
    assert "fields" not in pt_apagado.json()

    challenge_apagado = pt_apagado.headers.get("WWW-Authenticate")
    challenge_desativado = pt_desativado.headers.get("WWW-Authenticate")
    assert challenge_apagado == challenge_desativado
    # Não-vacuidade: "ambos ausentes" satisfaria a igualdade acima, e um 401 sem
    # challenge viola a RFC 7235.
    assert challenge_desativado

    # Não-vacuidade da paridade de locale: se a mensagem não traduzisse de verdade,
    # as duas seriam a mesma string inglesa e o canal lateral de locale voltaria a
    # ficar invisível. Compara com a MESMA fonte (a rota real), não com um literal.
    assert pt_apagado.json()["detail"] != en_apagado.json()["detail"]

    # O VALOR no fio, não só a paridade entre os dois casos: a matriz do intent nomeia
    # o corpo exato, e até aqui ele estava pinçado só transitivamente (a exceção contra
    # a constante, num teste de objeto; e o corpo da rota contra o do refresh). Contra
    # a fonte única, nunca contra um literal copiado — o `Always` do intent proíbe a
    # cópia justamente para o msgid não poder divergir do de refresh sem quebrar algo.
    assert en_apagado.json()["detail"] == en_msgid


def test_401_de_token_invalido_em_rota_autenticada_segue_dizendo_token_not_valid():
    """Contraste de FORMA no stack HTTP: um 401 não-colapsado ainda traz ``fields``.

    Sobre o que este teste NÃO é: ``Bearer garbage`` morre em
    ``get_validated_token`` (upstream ``authentication.py:100-118``), que
    ``authenticate()`` chama ANTES de ``get_user`` — então esta request nem entra
    no ``try``/``except`` da DW-31, e o teste seguiria verde se o ``raise`` de
    re-levantamento fosse removido. Quem pinça a estreiteza do filtro é
    ``test_get_user_nao_colapsa_token_sem_claim_de_usuario``, na camada do
    autenticador.

    O que ele pinça, e por isso vale: no fio, um 401 que NÃO colapsa continua
    saindo com ``fields.code`` — ou seja, o colapso mudou a forma do corpo só no
    caminho que devia, não para todo 401 de autenticação.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer garbage")

    response = client.get(TODAY_LOG_URL)

    assert response.status_code == 401
    assert response.json()["fields"]["code"] == ["token_not_valid"]


def _post_refresh(mutate):
    """401 do refresh para um usuário mutado — o outro lado da comparação.

    Emite o refresh token direto com ``RefreshToken.for_user`` em vez de fazer o
    round-trip de login do ``accounts/tests/test_views.py``: aqui o sujeito do teste
    é a forma da resposta, não o fluxo de login.
    """
    user = UserFactory()
    token = RefreshToken.for_user(user)
    mutate(user)
    return APIClient().post(REFRESH_URL, {"refresh": str(token)}, format="json")


def test_401_de_no_active_account_e_uma_convencao_so_nas_duas_superficies():
    """UMA convenção nas duas superfícies que este colapso liga, não duas (DW-31).

    ``accounts/tests/test_views.py`` compara refresh contra refresh; o teste de rota
    autenticada acima compara rota contra rota. Nenhum dos dois compara as DUAS
    superfícies entre si — então se o ramo da DW-25 no handler central passasse a
    emitir, digamos, uma chave ``fields``, as duas convenções se separariam em
    silêncio com toda a suíte verde. Este teste é o único lugar onde isso falha.

    O que ele NÃO afirma, e o nome antigo afirmava: que ``no_active_account`` seja
    uma convenção única em todo o projeto. O login levanta o MESMO ``code`` com
    outro msgid (``"...with the given credentials"``, upstream ``serializers.py``),
    então acrescentá-lo como terceira superfície aqui falharia pelo texto e não por
    defeito — no login, apagado e desativado já produzem a mesma resposta. As duas
    superfícies comparadas são as que este colapso passou a ligar; a divergência do
    login está registrada à parte.
    """
    respostas = {
        "refresh/apagado": _post_refresh(_apagar),
        "refresh/desativado": _post_refresh(_desativar),
        "rota/apagado": _get_today_log(_apagar),
        "rota/desativado": _get_today_log(_desativar),
    }

    corpos = {nome: r.json() for nome, r in respostas.items()}
    challenges = {nome: r.headers.get("WWW-Authenticate") for nome, r in respostas.items()}

    assert {r.status_code for r in respostas.values()} == {401}
    # Um único valor distinto em cada eixo — os dicts nomeados vão no `assert` para
    # a falha dizer QUAL superfície divergiu. `json.dumps(sort_keys=True)` porque os
    # corpos são dicts, e dict nenhum entra num `set` (é o dict que não é hasheável,
    # não uma chave dele); serializar canonicamente dá a comparação por valor de
    # graça, inclusive se o corpo ganhar chaves aninhadas — que é a regressão caçada.
    assert len({json.dumps(c, sort_keys=True) for c in corpos.values()}) == 1, corpos
    # Sobre o eixo do challenge: as duas superfícies o derivam de lugares
    # INDEPENDENTES — o refresh de `TokenViewBase.get_authenticate_header`
    # (`www_authenticate_realm = "api"`, upstream `views.py`), a rota autenticada de
    # `JWTAuthentication.authenticate_header`. Eles casam hoje porque dois defaults
    # não relacionados rendem `Bearer realm="api"`; nada nesta mudança constrói essa
    # igualdade. Então uma falha aqui pode ser "as convenções se separaram" OU "um
    # realm mudou de um lado só" — vale conferir qual antes de culpar o colapso.
    assert len(set(challenges.values())) == 1, challenges
    # Não-vacuidade: "todos ausentes" satisfaria a igualdade acima.
    assert all(challenges.values()), challenges
