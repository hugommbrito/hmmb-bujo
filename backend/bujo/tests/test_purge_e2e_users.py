"""Testes do management command ``purge_e2e_users`` (story 11.1, AC2/AC3).

O comando é destrutivo e carrega dois guardrails sutis que estes testes travam:

* **Sem cascade (AD-12):** ``user_id`` é ``UUIDField`` puro, não FK — apagar o
  ``User`` NÃO remove suas linhas tenant-scoped. O comando precisa varrer cada
  model por ``user_id`` antes de apagar os usuários. Os testes provam que Task,
  Log, WeeklyLog, MonthlyLog e RecurringTaskTemplate somem junto com o usuário.
* **Escopo por sufixo de e-mail:** só ``@e2e.test`` é alvo. Um usuário real (e um
  near-miss como ``e2e-x@example.com``) precisa sobreviver intacto — inclusive
  suas linhas tenant-scoped.

O comando roda FORA de um request (sem tenant no contexto), então ele depende de
``all_objects`` para enxergar as linhas cross-tenant; os testes rodam sem
``tenant_context`` ativo justamente para exercer esse caminho.
"""

from io import StringIO

import pytest
from django.core.management import call_command

from accounts.models import User
from bujo.models import Log, MonthlyLog, RecurringTaskTemplate, Task, WeeklyLog
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
    WeeklyLogFactory,
)
from core.tenant import tenant_context

TENANT_MODELS = [Task, Log, WeeklyLog, MonthlyLog, RecurringTaskTemplate]


def _seed_tenant_rows(user):
    """Cria uma linha de cada model tenant-scoped para ``user``.

    Precisa de ``tenant_context`` porque os factories salvam via o manager
    ``objects`` (TenantManager). ``TaskFactory`` já cria um ``Log`` próprio, mas
    criamos um ``LogFactory`` extra para garantir cobertura explícita do model.
    """
    with tenant_context(user):
        LogFactory(user=user)
        TaskFactory(user=user)
        WeeklyLogFactory(user=user)
        MonthlyLogFactory(user=user)
        RecurringTaskTemplateFactory(user=user)


def _tenant_row_count(user):
    return sum(
        model.all_objects.filter(user_id=user.id).count() for model in TENANT_MODELS
    )


def _run(*args):
    out = StringIO()
    call_command("purge_e2e_users", *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def e2e_user():
    from accounts.tests.factories import UserFactory

    return UserFactory(email="e2e-abc123@e2e.test")


def test_apaga_usuario_e2e_e_todas_as_linhas_tenant_scoped(e2e_user):
    """Happy path: usuário ``@e2e.test`` e TODAS as suas linhas somem (sem cascade)."""
    _seed_tenant_rows(e2e_user)
    assert _tenant_row_count(e2e_user) > 0

    _run()

    assert not User.objects.filter(id=e2e_user.id).exists()
    # Guardrail AD-12: as linhas tenant-scoped NÃO cascateiam — o comando precisou
    # apagá-las explicitamente. Zero restante prova que a varredura funcionou.
    assert _tenant_row_count(e2e_user) == 0


def test_preserva_usuario_real_e_suas_linhas(e2e_user, user):
    """Só ``@e2e.test`` é alvo: o usuário real (``user*@test.com``) fica intacto."""
    _seed_tenant_rows(e2e_user)
    _seed_tenant_rows(user)
    real_rows_antes = _tenant_row_count(user)
    assert real_rows_antes > 0

    _run()

    assert User.objects.filter(id=user.id).exists()
    assert _tenant_row_count(user) == real_rows_antes
    assert not User.objects.filter(id=e2e_user.id).exists()
    assert _tenant_row_count(e2e_user) == 0


def test_near_miss_de_email_nao_e_apagado():
    """``e2e-...@example.com`` casa o prefixo mas não o sufixo → não é apagado."""
    from accounts.tests.factories import UserFactory

    near_miss = UserFactory(email="e2e-fake@example.com")

    _run()

    assert User.objects.filter(id=near_miss.id).exists()


def test_dry_run_nao_apaga_nada(e2e_user):
    """``--dry-run`` só conta; nenhum usuário nem linha é removido."""
    _seed_tenant_rows(e2e_user)
    rows_antes = _tenant_row_count(e2e_user)

    saida = _run("--dry-run")

    assert User.objects.filter(id=e2e_user.id).exists()
    assert _tenant_row_count(e2e_user) == rows_antes
    assert "dry-run" in saida.lower()


def test_sem_usuarios_alvo_encerra_limpo(user):
    """Sem nenhum ``@e2e.test`` no banco: comando não apaga nada e reporta sucesso."""
    _seed_tenant_rows(user)
    rows_antes = _tenant_row_count(user)

    saida = _run()

    assert "Nada a apagar" in saida
    assert User.objects.filter(id=user.id).exists()
    assert _tenant_row_count(user) == rows_antes


def test_varredura_cross_tenant_sem_contexto(e2e_user):
    """Rodando fora de um request (sem tenant), a varredura enxerga múltiplos tenants.

    Prova que o comando usa ``all_objects`` (não ``objects``): se usasse o manager
    escopado, sem tenant no contexto ele falharia-fechado / veria vazio e deixaria
    as linhas de VÁRIOS usuários e2e órfãs.
    """
    from accounts.tests.factories import UserFactory

    e2e_user_2 = UserFactory(email="e2e-def456@e2e.test")
    _seed_tenant_rows(e2e_user)
    _seed_tenant_rows(e2e_user_2)

    # Nenhum tenant_context ativo aqui — exatamente como o comando roda em prod.
    _run()

    assert User.objects.filter(email__endswith="@e2e.test").count() == 0
    assert _tenant_row_count(e2e_user) == 0
    assert _tenant_row_count(e2e_user_2) == 0
