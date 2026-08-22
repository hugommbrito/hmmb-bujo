"""Architecture guardrails (§6.9 item 1, §7.4).

The scoped-manager guardrail walks every installed model and asserts that any
concrete ``TenantModel`` subclass exposes the auto-scoped ``TenantManager`` as
its default ``objects`` manager. This fails the build the moment a tenant model
accidentally ships an unscoped manager as ``objects`` — the most likely way to
silently break isolation.

The temporal guardrail (§6.9 item 6, Story 1.3) scans the AST of every
production Python file under ``backend/`` and fails if any code outside
``core/calendar.py`` calls ``date.today()``, ``timezone.now()``,
``datetime.now()``, ``datetime.today()``, or ``datetime.utcnow()`` directly.

The public-route guardrail (DW-35) *derives* the set of DRF routes reachable
without credentials by walking the live ``ROOT_URLCONF`` and probing every route,
then asserts a bogus bearer does not change the outcome on any of them. It exists
because the same defect — a route advertised as public that nonetheless inherits
``DEFAULT_AUTHENTICATION_CLASSES`` and rejects a stale ``Authorization`` header —
shipped three times in a row (DW-15 ``accounts/views.py::signup``, DW-24
``core/views.py::health``, DW-34 the drf-spectacular schema views), each time
patched one view at a time. Nothing in the codebase is hardcoded into the guard:
the route sets come from the URLconf at runtime, so a *new* public route is
covered the moment it is registered, and an unclassifiable route fails the build
instead of being skipped.

Its boundary matters: the guard probes the view callable **directly**
(``APIRequestFactory`` + ``callback(request, **kwargs)``), so no middleware runs
and no content negotiation happens against a real ``Accept`` header. It measures
one property — "does a stale credential change the outcome" — across the whole
DRF surface. The ``APIClient``-based tests (``core/tests/test_health.py``,
``core/tests/test_api_contract.py``, ``accounts/tests/test_views.py``) drive the
full HTTP stack on a few routes and assert response bodies; they are
*complementary* to this guard, not duplicates of it.

The port rule (``core`` must not import domain apps) is enforced by import-linter
in CI (see pyproject.toml ``[tool.importlinter]``); it is not a pytest concern.
"""

import ast
from pathlib import Path
from uuid import UUID

from django.apps import apps
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from core.models import TenantModel
from core.tenant import TenantManager

# Importing the test model registers it in the app registry, so the guardrail
# also exercises at least one concrete TenantModel subclass even before any
# domain models exist.
from core.tests import models as _test_models  # noqa: F401


def _concrete_tenant_models():
    return [
        model
        for model in apps.get_models()
        if issubclass(model, TenantModel) and not model._meta.abstract
    ]


def test_tenant_models_use_scoped_default_manager():
    tenant_models = _concrete_tenant_models()

    # Sanity: the test model guarantees this is non-empty today.
    assert tenant_models, "expected at least one concrete TenantModel (the test model)"

    for model in tenant_models:
        assert isinstance(model.objects, TenantManager), (
            f"{model.__name__}.objects must be a TenantManager (auto-scoped)"
        )
        assert isinstance(model._meta.default_manager, TenantManager), (
            f"{model.__name__}._meta.default_manager must be the scoped TenantManager"
        )


def test_no_bare_date_today_outside_calendar():
    """Fail build se date.today()/timezone.now() usados fora de core/calendar.py.

    Scanner AST cobre todo backend/ exceto: o próprio módulo autoridade
    (core/calendar.py), .venv/, migrations/, __pycache__, arquivos test_ e conftest.
    Arquivos de teste usam mocks/freeze_time legitimamente — são excluídos.
    """
    FORBIDDEN = {
        ("date", "today"),
        ("timezone", "now"),
        ("datetime", "now"),
        ("datetime", "today"),
        ("datetime", "utcnow"),
    }

    backend_root = Path(__file__).resolve().parent.parent.parent
    SKIP_PARTS = {".venv", "migrations", "__pycache__"}

    violations = []
    for py_file in sorted(backend_root.rglob("*.py")):
        rel = py_file.relative_to(backend_root)

        # Pular o próprio módulo autoridade
        if rel.parts[-2:] == ("core", "calendar.py"):
            continue
        # Pular venv, migrations, pycache
        if any(p in SKIP_PARTS for p in rel.parts):
            continue
        # Pular arquivos de teste e conftest (usam mocks/freeze_time legitimamente)
        if rel.name.startswith("test_") or rel.name == "conftest.py":
            continue

        source = py_file.read_text(encoding="utf-8", errors="replace")
        try:
            tree = ast.parse(source, filename=str(rel))
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if (
                isinstance(func, ast.Attribute)
                and isinstance(func.value, ast.Name)
                and (func.value.id, func.attr) in FORBIDDEN
            ):
                violations.append(f"{rel}:{node.lineno} — {func.value.id}.{func.attr}()")

    assert not violations, (
        "Uso direto de date.today()/timezone.now() fora de core/calendar.py:\n"
        + "\n".join(violations)
    )


# --- Guard de rotas públicas (DW-35) -------------------------------------------
# Valor dummy por CONVERTER (nome da classe), não por nome de kwarg: assim uma
# rota nova com `<int:year>` ou `<slug:codigo>` já nasce coberta, e só um
# converter genuinamente desconhecido derruba o guard — que é o ponto: o guard
# precisa falhar quando não entende a superfície, nunca pular em silêncio.
# Os valores imitam o `to_python()` de cada converter do Django (o UUIDConverter
# entrega um `UUID`, não uma string).
_DUMMY_BY_CONVERTER = {
    "UUIDConverter": UUID("00000000-0000-0000-0000-000000000000"),
    "IntConverter": 1,
    "StringConverter": "dummy",
    "SlugConverter": "dummy",
    "PathConverter": "dummy",
}

_BOGUS_BEARER = "Bearer garbage"


def _walk_url_entries(resolver, prefix=""):
    """Gera ``(route, entry)`` para cada folha do URLconf, com o path acumulado.

    ``str(pattern)`` devolve a rota declarada (ex.: ``bujo/tasks/<uuid:pk>/``), o
    que basta: o guard chama o callback direto e passa os kwargs à mão, então não
    precisa de uma URL concreta. Entradas de tipo inesperado sobem como
    ``entry`` mesmo assim — quem classifica decide que são não-classificáveis.
    """
    for entry in resolver.url_patterns:
        route = prefix + str(entry.pattern)
        if isinstance(entry, URLResolver):
            yield from _walk_url_entries(entry, route)
        else:
            yield route, entry


def _dummy_kwargs(pattern):
    """kwargs dummy para TODO named group da rota, tipados por ``pattern.converters``.

    Os nomes obrigatórios vêm de ``pattern.regex.groupindex`` — a verdade sobre o que
    o resolver entregaria à view — e não de ``converters``. A diferença é
    load-bearing: ``RegexPattern.__init__`` seta ``self.converters = {}``, nunca
    ``None`` (django/urls/resolvers.py), então uma rota ``re_path`` com
    ``(?P<slug>[^/]+)`` tem named group e NENHUM converter. Derivando de
    ``converters`` ela seria sondada com ``kwargs={}`` e classificada normalmente;
    se for protegida, o 401/403 sai de ``initial()`` antes de a view tocar o kwarg
    que nunca chegou, e a rota entra em "protegida" sem que ninguém note que a
    sonda estava incompleta. Cruzar os dois conjuntos torna essa rota genuinamente
    não-classificável, que é o desfecho honesto.

    Levanta ``LookupError`` (→ rota não-classificável → build vermelho) para
    qualquer named group sem converter, ou com converter fora do mapa dummy. Um pk
    inexistente é irrelevante: em rota protegida a recusa acontece em
    ``APIView.initial()``, muito antes de qualquer ``get_object()``.
    """
    converters = pattern.converters
    kwargs = {}
    for name in pattern.regex.groupindex:
        converter = converters.get(name)
        if converter is None:
            raise LookupError(
                f"named group `{name}` não tem converter em "
                f"{type(pattern).__name__}.converters (rota declarada via re_path?) — "
                "o guard não sabe que valor entregar e não vai sondar a rota pela metade"
            )
        converter_name = type(converter).__name__
        if converter_name not in _DUMMY_BY_CONVERTER:
            raise LookupError(
                f"converter `{converter_name}` (kwarg `{name}`) não está em "
                "_DUMMY_BY_CONVERTER — mapear um valor dummy lá para o guard "
                "voltar a classificar esta rota"
            )
        kwargs[name] = _DUMMY_BY_CONVERTER[converter_name]
    return kwargs


def _classify_drf_routes():
    """Deriva do ``ROOT_URLCONF`` quais rotas DRF são públicas e quais são protegidas.

    Sonda com ``GET`` mesmo em rotas POST-only de propósito: ``APIView.dispatch``
    roda ``self.initial(request)`` — autenticação + permissões — ANTES de resolver
    o handler do método. Logo rota protegida POST-only recusa (401/403, auth
    primeiro) e rota pública POST-only devolve 405. Discriminar recusa de 405 é
    exatamente o sinal de que o guard vive: ``signup``/``token``/``token/refresh``
    aparecem como públicas com 405, e uma regressão que reintroduzisse o
    autenticador global as viraria 405 → 401.

    "Protegida" significa **não alcançável sem credencial**, e isso inclui 403,
    não só 401: ``APIView.permission_denied`` só levanta ``NotAuthenticated``
    (401) quando ``request.authenticators`` é não-vazio — com a lista vazia ele
    levanta ``PermissionDenied`` (403). Tratar 403 como "pública" abriria o buraco
    que este guard existe para fechar: apagar ``DEFAULT_AUTHENTICATION_CLASSES``
    faz as ~71 rotas de domínio virarem 403 anônimas E 403 com bearer podre, ou
    seja, zero violações e guard verde com o autenticador global inteiro fora.

    Filtra a superfície DRF por ``callback.cls`` (setado por ``APIView.as_view()``
    e por ``@api_view``) em vez de por prefixo ``api/``: é um filtro estrutural,
    não uma allowlist de paths — as ~155 rotas do admin nem recusam (redirecionam)
    e só fariam ruído.

    Devolve ``(public, protected, unclassifiable)``, onde ``public`` traz tuplas
    ``(route, cls, anon_status, bogus_bearer_status)``.
    """
    factory = APIRequestFactory()
    public, protected, unclassifiable = [], [], []

    for route, entry in _walk_url_entries(get_resolver()):
        cls = getattr(getattr(entry, "callback", None), "cls", None)
        if not (isinstance(cls, type) and issubclass(cls, APIView)):
            continue  # admin & cia.: não é superfície DRF

        label = f"{route} ({cls.__name__})"
        try:
            if not isinstance(entry, URLPattern):
                raise LookupError(f"entrada de URLconf de tipo inesperado: {type(entry).__name__}")
            kwargs = _dummy_kwargs(entry.pattern)
            kwargs.update(entry.default_args or {})

            anon_status = entry.callback(factory.get("/" + route), **kwargs).status_code
            if anon_status >= 500:
                # 5xx é medição PERDIDA, não rota pública saudável: a sonda nunca
                # chegou a exercer a propriedade de auth. `core/exceptions.py`
                # converte TenantScopeViolation num 500 opaco, e rota pública sem
                # contexto de tenant é um jeito plausível de cair nele.
                raise LookupError(
                    f"a sonda anônima devolveu {anon_status} — o guard não mediu a "
                    "propriedade de auth desta rota; investigar o 5xx antes de "
                    "considerá-la pública"
                )
            if anon_status in (401, 403):
                # Não alcançável sem credencial (ver docstring: 403 conta).
                protected.append(route)
                continue

            bogus_status = entry.callback(
                factory.get("/" + route, HTTP_AUTHORIZATION=_BOGUS_BEARER), **kwargs
            ).status_code
            public.append((route, cls, anon_status, bogus_status))
        except Exception as exc:  # noqa: BLE001 - não-classificável DEVE falhar o build
            unclassifiable.append(f"{label}: {type(exc).__name__}: {exc}")

    return public, protected, unclassifiable


def _public_route_violations(public):
    """Rotas públicas cujo desfecho MUDA com um bearer inválido, já formatadas.

    O critério é ``bogus != anon``, não ``bogus == 401``: uma credencial velha não
    deve alterar o resultado, ponto. Olhar só o 401 deixa a mesma falha passar com
    outro código — um autenticador cujo ``authenticate_header()`` devolve ``None``
    faz o DRF responder **403**, e anon=200/bogus=403 é exatamente o defeito das
    DW-15/24/34 visto por um probe ou por uma aba velha do Swagger.

    Helper (e não uma comprehension inline no teste) para que o teste que prova
    que o guard MORDE possa afirmar a mensagem real, sem reimplementar o critério.
    """
    return [
        f"{route} ({cls.__name__}): anon={anon_status} bearer-invalido={bogus_status}"
        for route, cls, anon_status, bogus_status in public
        if bogus_status != anon_status
    ]


def test_rotas_publicas_ignoram_authorization_invalido():
    """Rota DRF alcançável sem credencial responde IGUAL com um bearer podre (DW-35).

    Cobre a forma do bug em toda a superfície DRF, em vez de esperar a quarta
    instância dele: a rota pública que esquece ``authentication_classes = []``
    responde 200 anônima e recusa (401/403) com um ``Authorization`` velho — probe,
    reverse proxy ou aba antiga do Swagger passam a ver um falso
    "unhealthy"/"unauthorized". Sobre o que este guard NÃO cobre (middleware, corpo
    da resposta, negociação de conteúdo), ver o docstring do módulo.
    """
    public, protected, unclassifiable = _classify_drf_routes()

    # Nunca pular em silêncio: rota DRF que o guard não conseguiu classificar
    # (converter novo, regex, exceção inesperada) derruba o build.
    assert not unclassifiable, (
        "rotas DRF não-classificáveis pelo guard de rotas públicas — corrigir o "
        "guard (ex.: mapear o converter em _DUMMY_BY_CONVERTER), não silenciá-lo:\n"
        + "\n".join(unclassifiable)
    )

    # Não-vacuidade nas duas pontas: se qualquer conjunto zerar, o guard passou a
    # não medir nada. Medido hoje: 77 rotas DRF → 6 públicas, 71 protegidas.
    assert public, (
        "nenhuma rota DRF pública derivada do ROOT_URLCONF — o guard estaria passando "
        "vacuamente (esperado ≥1: health, signup, token, token/refresh, schema, swagger-ui)"
    )
    assert protected, (
        "nenhuma rota DRF protegida (401/403 anônima) derivada do ROOT_URLCONF — o "
        "conjunto vazio significa que o guard não está medindo a superfície protegida"
    )

    violations = _public_route_violations(public)
    assert not violations, (
        "rota alcançável sem credencial cujo status MUDA com um Authorization inválido "
        "— declarar `authentication_classes = []` na view (ou `SERVE_AUTHENTICATION: []` "
        "em SPECTACULAR_SETTINGS, para as views de schema de terceiros):\n"
        + "\n".join(violations)
    )


def test_guard_de_rotas_publicas_flagra_rota_que_401a_com_bearer_invalido():
    """O guard MORDE: prova automatizada de que a quarta instância do bug seria pega.

    Sem isto o guard acima passaria verde para sempre e ninguém saberia se ele
    ainda enxerga o defeito — foi exatamente assim que as DW-15/24/34 escaparam
    (os testes existentes nunca mandavam `Authorization`). Registra uma view
    pública que esquece `authentication_classes = []`, exatamente a forma do bug,
    e afirma que o guard a classifica como pública e a nomeia na violação.
    """
    from django.test import override_settings
    from django.urls import path
    from rest_framework.decorators import api_view, permission_classes
    from rest_framework.permissions import AllowAny
    from rest_framework.response import Response

    @api_view(["GET"])
    @permission_classes([AllowAny])
    def _publica_sem_authentication_classes(_request):
        # De propósito SEM `@authentication_classes([])`: herda o
        # TenantAwareJWTAuthentication global, logo 200 anônima e 401 com bearer podre.
        return Response({"ok": True})

    class _UrlConf:
        # Classe (não módulo nem SimpleNamespace): `get_resolver()` cacheia no objeto
        # do urlconf, que precisa ser hashável. `override_settings` limpa esse cache na
        # entrada e na saída, então este urlconf não sobrevive ao bloco. Mesmo padrão
        # de core/tests/test_exceptions.py.
        urlpatterns = [path("dw35-publica-com-bug/", _publica_sem_authentication_classes)]

    with override_settings(ROOT_URLCONF=_UrlConf):
        public, protected, unclassifiable = _classify_drf_routes()

    assert not unclassifiable
    assert protected == []
    assert [(route, anon, bogus) for route, _cls, anon, bogus in public] == [
        ("dw35-publica-com-bug/", 200, 401)
    ]

    violations = _public_route_violations(public)
    assert len(violations) == 1
    assert "dw35-publica-com-bug/" in violations[0]
    assert "anon=200 bearer-invalido=401" in violations[0]


def test_guard_de_rotas_publicas_nao_classifica_converter_desconhecido(monkeypatch):
    """Converter fora do mapa dummy vira não-classificável — nunca um skip silencioso.

    O modo de falha que este teste fecha é o guard apodrecer: uma rota nova com um
    converter que o guard não entende sendo pulada de fininho, deixando a rota fora
    da cobertura sem ninguém notar. Zerar `_DUMMY_BY_CONVERTER` simula esse converter
    desconhecido sobre o URLconf REAL (as rotas com `<uuid:pk>`), sem mexer no
    registro global de converters do Django — que não tem API pública de desregistro.
    """
    monkeypatch.setattr("core.tests.test_guardrails._DUMMY_BY_CONVERTER", {})

    public, protected, unclassifiable = _classify_drf_routes()

    # Afirmar só sobre as entradas que ESTE teste provoca: uma entrada
    # não-classificável por outro motivo é problema do teste principal, e um `all()`
    # sobre a lista inteira falharia aqui com uma mensagem enganosa.
    uuid_entries = [item for item in unclassifiable if "UUIDConverter" in item]
    assert uuid_entries, (
        "com o mapa de dummies vazio, as rotas com `<uuid:pk>` deveriam ter virado "
        "não-classificáveis; se não viraram, o guard está pulando rota em silêncio"
    )
    assert all("não está em _DUMMY_BY_CONVERTER" in item for item in uuid_entries)
    # As rotas sem kwarg nenhum seguem classificáveis — a falha é por rota, não global.
    assert public or protected
