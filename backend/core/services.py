"""Referência canônica do padrão de camada de serviço (§6.2, §6.10).

REMOVER ou substituir quando o primeiro serviço de domínio real for criado.
O importante é a ASSINATURA e as REGRAS:
  - Funções de módulo (nunca classes de serviço)
  - Keyword-only args; `user` é sempre o primeiro kwarg
  - @transaction.atomic decora o serviço (não a view)
  - Só levanta exceções de core/exceptions.py
  - Retorna a instância de domínio (Model ou dict enquanto não há model)
"""

from django.db import transaction

from core.exceptions import DomainError


@transaction.atomic
def example_service_pattern(*, user, name: str) -> dict:
    """Demonstra o padrão canônico de serviço (§6.2).

    Em serviços reais: substituir `dict` por `-> Model` e implementar
    lógica de domínio + escrita no DB.
    """
    if not user:
        raise DomainError("user é obrigatório")
    if not name or not name.strip():
        raise DomainError("name não pode ser vazio")
    return {"name": name.strip()}
