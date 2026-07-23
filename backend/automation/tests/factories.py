"""Factory de `AutomationToken` para os testes da Story 12.4.

`AutomationToken` **não** é `TenantModel` (é credencial de auth, plain model),
então usa `user = SubFactory(UserFactory)` diretamente (FK real) — mais simples
que o padrão `class Params` + `SelfAttribute` dos models tenant-scoped — e
**não** registra `register_isolation_case` (o contrato de isolamento parametrizado
cobre `TenantModel`s; este não é um). Ver Dev Notes da Story 12.4.

Para materializar um token com segredo conhecido (ex.: montar o header de auth),
use `AutomationToken.issue(...)` diretamente — ele retorna `(instance, full)`.
"""

import hashlib

import factory
from factory.django import DjangoModelFactory

from accounts.tests.factories import UserFactory
from automation.models import SCOPE_CAPTURE, AutomationToken


class AutomationTokenFactory(DjangoModelFactory):
    class Meta:
        model = AutomationToken

    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Token {n}")
    token_prefix = "bujo_teste"
    token_hash = factory.Sequence(lambda n: hashlib.sha256(f"fake-secret-{n}".encode()).hexdigest())
    scopes = factory.LazyFunction(lambda: [SCOPE_CAPTURE])
