"""Testes do padrão canônico de camada de serviço (§6.2, AC3)."""
import pytest

from core.exceptions import DomainError
from core.services import example_service_pattern


def test_service_exige_keyword_args():
    """Serviço deve ser chamado com keyword args — positional levanta TypeError."""
    with pytest.raises(TypeError):
        example_service_pattern(None, "foo")  # type: ignore[call-arg]


def test_service_levanta_domain_error_para_user_none():
    """Serviço levanta DomainError (não ValueError/None) para user inválido (§6.4)."""
    with pytest.raises(DomainError):
        example_service_pattern(user=None, name="test")


def test_service_levanta_domain_error_para_name_vazio():
    """Serviço levanta DomainError para name vazio."""
    import types

    user = types.SimpleNamespace(id="uuid-user")
    with pytest.raises(DomainError):
        example_service_pattern(user=user, name="")


@pytest.mark.django_db
def test_service_happy_path():
    """Happy path: retorna resultado esperado."""
    import types

    user = types.SimpleNamespace(id="uuid-user-123")
    result = example_service_pattern(user=user, name="  teste  ")
    assert result["name"] == "teste"  # strip() aplicado
