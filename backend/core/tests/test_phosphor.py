"""Catálogo Phosphor e validação de ``icon_key`` (Story 16.2).

O catálogo é um artefato COMMITADO (``backend/habits/phosphor_catalog.json``,
gerado por ``scripts/gen_phosphor_catalog.mjs``) porque o backend roda sem
``node_modules``. Estes testes guardam as propriedades de que o resto da story
depende: a grafia é kebab-case, a conversão para o export PascalCase do pacote é
bijetiva, e a validação rejeita tudo que não está no catálogo.

O gate que impede o artefato de divergir do pacote instalado é do CI
(regenera + ``diff``); aqui checamos a forma do que está commitado.
"""

import json
import re

import pytest
from rest_framework import serializers

from core.phosphor import (
    _CATALOG_PATH,
    ICON_KEYS,
    PHOSPHOR_VERSION,
    is_kebab_case,
    is_valid_icon_key,
    validate_icon_key,
)


# --- forma do artefato ---------------------------------------------------------
def test_catalog_e_internamente_consistente():
    """Consistência interna do artefato — NÃO é o gate anti-drift.

    Antes chamava-se "...e a versão do pacote instalado", mas `PHOSPHOR_VERSION`
    é lido DESTE mesmo arquivo: comparar os dois é tautológico e nunca detectaria
    drift. Quem compara o artefato com o pacote instalado é o step de CI
    "Verificar catálogo Phosphor está atualizado" (regenera e `diff`a) — o backend
    não tem `node_modules` para fazer essa checagem em teste.
    """
    payload = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    assert payload["package"] == "@phosphor-icons/react"
    assert payload["version"] == PHOSPHOR_VERSION
    # ~1.5k glifos: o número exato muda com o pacote, mas uma ordem de grandeza
    # errada (0, ou 10) significa artefato quebrado.
    assert payload["count"] == len(payload["names"]) == len(ICON_KEYS)
    assert 1000 < len(ICON_KEYS) < 5000


def test_todo_nome_do_catalogo_e_kebab_case():
    assert all(is_kebab_case(name) for name in ICON_KEYS)


def test_conversao_para_pascalcase_e_bijetiva():
    """Premissa do contrato: o backend guarda kebab, o frontend reconstrói o export.

    Se duas chaves distintas virassem o mesmo componente, o par kebab↔Pascal
    deixaria de ser reversível sem tabela — e o seletor de DW-60 renderizaria o
    glifo errado.
    """
    pascal = {name.replace("-", " ").title().replace(" ", "") for name in ICON_KEYS}
    assert len(pascal) == len(ICON_KEYS)


def test_catalogo_nao_tem_digitos():
    """Nenhum nome com dígito — é o que torna a conversão kebab↔Pascal segura."""
    assert not [name for name in ICON_KEYS if re.search(r"\d", name)]


# --- is_valid_icon_key ---------------------------------------------------------
@pytest.mark.parametrize("value", ["barbell", "address-book", "address-book-tabs"])
def test_chave_do_catalogo_e_valida(value):
    assert is_valid_icon_key(value) is True


@pytest.mark.parametrize(
    "value",
    [
        "nao-existe",       # nome inventado
        "AddressBook",      # PascalCase: o export do pacote, não o nome público
        "address_book",     # snake_case
        "Address-Book",     # kebab com maiúscula
        "address--book",    # hífen duplo
        "-address-book",    # hífen na ponta
        "",                 # vazio
        "barbell ",         # espaço à direita
    ],
)
def test_chave_invalida_e_rejeitada(value):
    """NOTA: `"barbell "` é inválido para ESTA função, mas a API o ACEITA —
    o `CharField` do DRF apara espaços (`trim_whitespace=True`, default) antes
    de o validador rodar, então o que chega aqui já vem sem as pontas. O valor
    persistido é o correto (`"barbell"`); veja o teste de borda em
    `habits/tests/test_icon_key.py`.
    """
    assert is_valid_icon_key(value) is False


# --- validate_icon_key (validador de serializer → 400) -------------------------
def test_validador_aceita_none():
    """Limpar o pictograma é legítimo — ``None`` passa."""
    assert validate_icon_key(None) is None


def test_validador_devolve_a_chave_valida():
    assert validate_icon_key("barbell") == "barbell"


@pytest.mark.parametrize("value", ["nao-existe", "AddressBook"])
def test_validador_levanta_validation_error(value):
    """``serializers.ValidationError`` → 400 (nunca ``DomainError``, que viraria 409)."""
    with pytest.raises(serializers.ValidationError) as exc:
        validate_icon_key(value)
    assert "kebab-case" in str(exc.value)

def test_catalogo_bate_com_o_pacote_instalado_quando_disponivel():
    """Gate anti-drift LOCAL: só roda onde `frontend/node_modules` existe.

    Complementa o step de CI. Em produção/CI-backend o diretório não existe e o
    teste é pulado — o gate real continua sendo o do job frontend.
    """
    csr = (
        _CATALOG_PATH.parent.parent.parent
        / "frontend" / "node_modules" / "@phosphor-icons" / "react" / "dist" / "csr"
    )
    if not csr.is_dir():
        pytest.skip("frontend/node_modules ausente — gate vive no CI")

    instalados = {f.name[: -len(".es.js")] for f in csr.glob("*.es.js")}
    assert len(instalados) == len(ICON_KEYS)
