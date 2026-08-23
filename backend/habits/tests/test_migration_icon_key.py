"""Mapeamento ``emoticon`` → ``icon_key`` da migration ``habits/0004`` (Story 16.2).

O backfill em si não é testável pelo pytest — o banco de teste nasce vazio das
migrations, então não há linha com ``emoticon`` para converter (a evidência sobre
dados reais é a saída do ``migrate``, como em ``bujo/0007``). O que é testável, e
é o que importa, é a **função pura** de mapeamento extraída no nível do módulo:
ela decide cada linha da I/O Matrix (emoji mapeado vira chave, emoji desconhecido
vira ``NULL``) e não pode nunca levantar exceção.

O módulo é carregado via ``importlib.import_module`` porque ``0004_icon_key``
começa com dígito e não pode ser importado com a sintaxe ``import`` normal.
"""

import importlib

import pytest

from core.phosphor import is_valid_icon_key

_migration = importlib.import_module("habits.migrations.0004_icon_key")


@pytest.mark.parametrize(
    ("emoticon", "expected"),
    [
        ("✅", "check-circle"),
        ("📖", "book-open"),
        ("🏃", "person-simple-run"),
        ("💧", "drop"),
        ("💊", "pill"),
        ("🧘", "person-simple-tai-chi"),
    ],
)
def test_emoji_mapeado_vira_a_chave_correspondente(emoticon, expected):
    assert _migration.icon_key_for_emoticon(emoticon) == expected


@pytest.mark.parametrize("emoticon", ["🦄", "🛸", "xyz", "🫎"])
def test_emoji_desconhecido_vira_none(emoticon):
    """Nunca falha, nunca inventa chave: sem mapeamento, o hábito fica sem pictograma."""
    assert _migration.icon_key_for_emoticon(emoticon) is None


@pytest.mark.parametrize("emoticon", ["", "   ", None])
def test_emoticon_vazio_vira_none(emoticon):
    assert _migration.icon_key_for_emoticon(emoticon) is None


def test_espacos_em_volta_sao_ignorados():
    assert _migration.icon_key_for_emoticon(" ✅ ") == "check-circle"


def test_seletor_de_variacao_unicode_converge_para_a_mesma_chave():
    """``❤️`` (com U+FE0F) e ``❤`` (sem) são a mesma aparência — mesma chave."""
    assert _migration.icon_key_for_emoticon("❤️") == "heart"
    assert _migration.icon_key_for_emoticon("❤") == "heart"


@pytest.mark.parametrize(
    ("emoticon", "expected"),
    [
        ("🏃🏽", "person-simple-run"),
        ("🧘🏻", "person-simple-tai-chi"),
        ("🙏🏼", "hands-praying"),
    ],
)
def test_tom_de_pele_degrada_para_o_emoji_base(emoticon, expected):
    """O Phosphor não tem variante de tom: ``🏃🏽`` é o mesmo glifo que ``🏃``.

    Sem essa degradação o usuário que digitou o emoji com modificador perderia o
    pictograma (``NULL``) embora o base esteja mapeado — perda silenciosa, não a
    "ausência por escolha" do gate 16.0.
    """
    assert _migration.icon_key_for_emoticon(emoticon) == expected


@pytest.mark.parametrize(
    ("emoticon", "expected"),
    [
        ("🚶‍♀️", "person-simple-walk"),  # variante de gênero ausente do mapa
        ("🏃‍♂️", "person-simple-run"),  # variante presente no mapa (não regride)
    ],
)
def test_sequencia_zwj_de_genero_resolve(emoticon, expected):
    assert _migration.icon_key_for_emoticon(emoticon) == expected


def test_degradacao_nao_inventa_chave_para_emoji_nao_mapeado():
    """A degradação só recupera o BASE mapeado — nunca cria chave do nada."""
    assert _migration.icon_key_for_emoticon("🦄🏽") is None
    assert _migration.icon_key_for_emoticon("🛸") is None


def test_nenhuma_chave_duplicada_no_mapa():
    """Um dict literal com chave repetida perde a primeira em silêncio."""
    import re
    from pathlib import Path

    fonte = Path(_migration.__file__).read_text(encoding="utf-8")
    corpo = fonte.split("EMOJI_TO_ICON_KEY = {", 1)[1].split("\n}", 1)[0]
    chaves = re.findall(r'^\s*"([^"]+)":', corpo, re.MULTILINE)
    duplicadas = sorted({k for k in chaves if chaves.count(k) > 1})
    assert duplicadas == []


def test_toda_chave_do_mapa_existe_no_catalogo_phosphor():
    """O mapa é literal congelado (não pode importar ``core.phosphor``), então esta
    é a única rede que impede uma chave inventada de entrar no banco pela migration."""
    invalidas = sorted(
        {key for key in _migration.EMOJI_TO_ICON_KEY.values() if not is_valid_icon_key(key)}
    )
    assert invalidas == []
