"""Testes de schema de `Log`/`Task` (AC #1): constraints e relações self-FK."""

import importlib
from datetime import date

import pytest
from django.db import IntegrityError, transaction

from bujo.models import (
    MonthlyLog,
    RitualDecision,
    RitualDecisionKind,
    Task,
    WeeklyLog,
)
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
    WeeklyLogFactory,
)
from core.tenant import tenant_context


@pytest.mark.django_db
def test_log_unique_constraint_por_user_e_data(user):
    with tenant_context(user):
        LogFactory(user=user, log_date="2026-01-01")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                LogFactory(user=user, log_date="2026-01-01")


@pytest.mark.django_db
def test_task_check_constraint_status_invalido(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Task.objects.create(
                    log=log,
                    status="bogus",
                    title="Tarefa inválida",
                    order_index=0.0,
                )


@pytest.mark.django_db
def test_task_relacao_parent_subtasks(user):
    with tenant_context(user):
        parent = TaskFactory(user=user)
        child = TaskFactory(user=user, parent_task=parent)

        assert child.parent_task_id == parent.id
        assert list(parent.subtasks.all()) == [child]


@pytest.mark.django_db
def test_task_relacao_migrated_to_task(user):
    with tenant_context(user):
        original = TaskFactory(user=user)
        successor = TaskFactory(user=user, migrated_to_task=original)

        assert successor.migrated_to_task_id == original.id
        assert list(original.migrated_from.all()) == [successor]


@pytest.mark.django_db
def test_task_campos_de_linhagem_tem_defaults_inertes(user):
    """Campos congelados (Épico 4) nascem nulos/zerados numa `Task` comum —
    nenhum valor "mágico" é atribuído por padrão fora do fluxo de migração."""
    with tenant_context(user):
        task = TaskFactory(user=user)

        assert task.migrated_to_task_id is None
        assert task.migration_count == 0
        assert task.parent_task_id is None
        assert task.source_template_id is None
        assert list(task.subtasks.all()) == []
        assert list(task.migrated_from.all()) == []


@pytest.mark.django_db
@pytest.mark.parametrize("category", list(Task.Category.values))
def test_task_category_aceita_as_6_choices_validas(user, category):
    with tenant_context(user):
        task = TaskFactory(user=user, category=category)

        assert task.category == category


@pytest.mark.django_db
def test_task_category_aceita_null(user):
    with tenant_context(user):
        task = TaskFactory(user=user, category=None)

        assert task.category is None


@pytest.mark.django_db
def test_weekly_log_check_constraint_week_start_deve_ser_segunda(user):
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                WeeklyLog.objects.create(week_start=date(2026, 7, 14))  # terça


@pytest.mark.django_db
def test_weekly_log_week_start_segunda_grava(user):
    with tenant_context(user):
        log = WeeklyLog.objects.create(week_start=date(2026, 7, 13))  # segunda

        assert log.week_start == date(2026, 7, 13)


@pytest.mark.django_db
def test_weekly_log_unique_constraint_por_user_e_week_start(user):
    with tenant_context(user):
        WeeklyLogFactory(user=user, week_start=date(2026, 7, 13))
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                WeeklyLogFactory(user=user, week_start=date(2026, 7, 13))


@pytest.mark.django_db
def test_monthly_log_check_constraint_month_first_deve_ser_dia_1(user):
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                MonthlyLog.objects.create(month_first=date(2026, 7, 2))


@pytest.mark.django_db
def test_monthly_log_month_first_dia_1_grava(user):
    with tenant_context(user):
        log = MonthlyLog.objects.create(month_first=date(2026, 7, 1))

        assert log.month_first == date(2026, 7, 1)


@pytest.mark.django_db
def test_monthly_log_unique_constraint_por_user_e_month_first(user):
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))


@pytest.mark.django_db
def test_task_check_constraint_exatamente_um_container_nenhum(user):
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Task.objects.create(title="Sem container", order_index=0.0)


@pytest.mark.django_db
def test_task_check_constraint_exatamente_um_container_dois(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        monthly_log = MonthlyLogFactory(user=user)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Task.objects.create(
                    log=log,
                    monthly_log=monthly_log,
                    title="Dois containers",
                    order_index=0.0,
                )


@pytest.mark.django_db
def test_task_com_exatamente_um_container_grava(user):
    with tenant_context(user):
        weekly_log = WeeklyLogFactory(user=user)
        task = Task.objects.create(
            weekly_log=weekly_log, title="Só weekly", order_index=0.0
        )

        assert task.log_id is None
        assert task.weekly_log_id == weekly_log.id
        assert task.monthly_log_id is None


@pytest.mark.django_db
def test_task_scheduled_date_nulavel_grava_com_e_sem_valor(user):
    with tenant_context(user):
        monthly_log = MonthlyLogFactory(user=user)
        with_date = TaskFactory(
            user=user, monthly_log=monthly_log, scheduled_date=date(2026, 7, 20)
        )
        without_date = TaskFactory(user=user, monthly_log=monthly_log, scheduled_date=None)

        assert with_date.scheduled_date == date(2026, 7, 20)
        assert without_date.scheduled_date is None


# --- RecurringTaskTemplate (AC #1) ---------------------------------------------


@pytest.mark.django_db
def test_recurring_task_template_nao_tem_campos_de_ciclo_de_vida(user):
    """AD-08 item 1: um template não é uma `Task` e nunca migra — sem
    `status`/`log`/`weekly_log`/`monthly_log`/`parent_task`."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)

        for field in ("status", "log", "weekly_log", "monthly_log", "parent_task"):
            assert not hasattr(template, field)


@pytest.mark.django_db
def test_task_source_template_aceita_none_e_instancia(user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)
        task_sem_template = TaskFactory(user=user)
        task_com_template = TaskFactory(user=user, source_template=template)

        assert task_sem_template.source_template is None
        assert task_com_template.source_template_id == template.id


@pytest.mark.django_db
def test_deletar_template_nao_deleta_a_task_instancia_set_null(user):
    """AD-08 item 2: `source_template` não é referência viva — `on_delete=SET_NULL`
    garante que deletar o template nunca quebra a instância já colocada."""
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user)
        task = TaskFactory(user=user, source_template=template)

        template.delete()
        task.refresh_from_db()

        assert Task.objects.filter(id=task.id).exists()
        assert task.source_template_id is None


@pytest.mark.django_db
@pytest.mark.parametrize("category", list(Task.Category.values))
def test_recurring_task_template_category_aceita_as_6_choices_validas(user, category):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, category=category)

        assert template.category == category


@pytest.mark.django_db
def test_recurring_task_template_category_aceita_null(user):
    with tenant_context(user):
        template = RecurringTaskTemplateFactory(user=user, category=None)

        assert template.category is None


# --- Estado do ciclo operacional (Story 14.1, AC1) -----------------------------
@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_cls,model,status",
    [
        (WeeklyLogFactory, WeeklyLog, "active"),
        (WeeklyLogFactory, WeeklyLog, "planning"),
        (MonthlyLogFactory, MonthlyLog, "active"),
        (MonthlyLogFactory, MonthlyLog, "planning"),
    ],
)
def test_cycle_unique_parcial_barra_segundo_ciclo_no_mesmo_estado(
    user, factory_cls, model, status
):
    """AC1: unicidade NO BANCO, não na disciplina — no máximo um `active` e um
    `planning` por usuário por tabela (índice único parcial)."""
    with tenant_context(user):
        factory_cls(user=user, status=status)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                factory_cls(user=user, status=status)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_cls", [WeeklyLogFactory, MonthlyLogFactory]
)
def test_cycle_active_e_planning_coexistem_no_mesmo_usuario(user, factory_cls):
    """AD-28 item 2: um `active` + um `planning` simultâneos é o estado NORMAL do
    método (planeja o próximo ciclo enquanto o atual corre) — as duas uniques são
    parciais e independentes, então não colidem entre si."""
    with tenant_context(user):
        active = factory_cls(user=user, status="active")
        planning = factory_cls(user=user, status="planning")

        assert active.status == "active"
        assert planning.status == "planning"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_cls", [WeeklyLogFactory, MonthlyLogFactory]
)
def test_cycle_active_de_dois_usuarios_diferentes_coexiste(user, other_user, factory_cls):
    """A unique parcial é por `(user_id) WHERE status=...` — nunca global."""
    with tenant_context(user):
        mine = factory_cls(user=user, status="active")
    with tenant_context(other_user):
        theirs = factory_cls(user=other_user, status="active")

    assert mine.status == theirs.status == "active"
    assert mine.user_id != theirs.user_id


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_cls", [WeeklyLogFactory, MonthlyLogFactory]
)
def test_cycle_check_constraint_status_invalido(user, factory_cls):
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                factory_cls(user=user, status="bogus")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "factory_cls", [WeeklyLogFactory, MonthlyLogFactory]
)
def test_cycle_status_null_e_aceito_e_e_o_default(user, factory_cls):
    """`NULL` = fora do regime operacional (3ª semântica, sem valor `none` no
    enum) e é o estado de nascimento de todo log materializado sob demanda."""
    with tenant_context(user):
        log = factory_cls(user=user)

        assert log.status is None
        assert log.planning_completed_at is None


# --- Data migration 0007: função pura de bucket (Story 14.1, AC7) --------------
# `import_module` funciona apesar de o nome do módulo começar com dígito — a
# restrição sintática vale só para a palavra-chave `import`.
_migration_0007 = importlib.import_module("bujo.migrations.0007_weekly_monthly_cycle_status")
classify_cycle_status = _migration_0007.classify_cycle_status
migration_current_key = _migration_0007.current_key

# Sábado: a semana corrente começa em 2026-07-20 e o mês corrente em 2026-07-01.
_HOJE = date(2026, 7, 25)


@pytest.mark.parametrize(
    "kind,esperado",
    [("weekly", date(2026, 7, 20)), ("monthly", date(2026, 7, 1))],
)
def test_migration_0007_current_key(kind, esperado):
    assert migration_current_key(kind=kind, today=_HOJE) == esperado


@pytest.mark.parametrize("derived_closed", [True, False])
@pytest.mark.parametrize(
    "kind,key",
    [("weekly", date(2026, 7, 20)), ("monthly", date(2026, 7, 1))],
)
def test_migration_0007_periodo_corrente_e_sempre_active(kind, key, derived_closed):
    """O período corrente vence `finalized`: é o que garante o invariante de
    exatamente um `active` por usuário por tabela."""
    assert (
        classify_cycle_status(
            kind=kind, key=key, today=_HOJE, derived_closed=derived_closed
        )
        == "active"
    )


@pytest.mark.parametrize("derived_closed", [True, False])
@pytest.mark.parametrize(
    "kind,key",
    [("weekly", date(2026, 8, 3)), ("monthly", date(2026, 10, 1))],
)
def test_migration_0007_periodo_futuro_e_sempre_null(kind, key, derived_closed):
    """Armazenamento do Future Log: nunca esteve no regime operacional, então não
    sai da migration como `finalized` nem com todas as tarefas dispostas."""
    assert (
        classify_cycle_status(
            kind=kind, key=key, today=_HOJE, derived_closed=derived_closed
        )
        is None
    )


@pytest.mark.parametrize(
    "kind,key",
    [("weekly", date(2026, 7, 13)), ("monthly", date(2026, 6, 1))],
)
def test_migration_0007_passado_fechado_e_finalized(kind, key):
    assert (
        classify_cycle_status(kind=kind, key=key, today=_HOJE, derived_closed=True)
        == "finalized"
    )


@pytest.mark.parametrize(
    "kind,key",
    [("weekly", date(2026, 7, 13)), ("monthly", date(2026, 6, 1))],
)
def test_migration_0007_passado_nao_fechado_e_null(kind, key):
    """Bucket que alimenta a fila unificada da Story 14.3: ciclo passado com
    tarefas abertas fica FORA do regime, e o gate de "anterior finalizado" o
    ignora (`_previous_operational` só olha `status` não-`NULL`)."""
    assert (
        classify_cycle_status(kind=kind, key=key, today=_HOJE, derived_closed=False)
        is None
    )


# --- `ritual_decisions` (Story 14.2, AC1) --------------------------------------
def _decisao_kwargs(user, **overrides):
    """Kwargs de uma decisão legal mínima (alvo weekly × item Task)."""
    weekly = WeeklyLogFactory(user=user)
    base = {
        "weekly_log": weekly,
        "monthly_log": None,
        "task": TaskFactory(user=user, weekly_log=weekly),
        "recurring_template": None,
        "decision": RitualDecisionKind.KEEP,
    }
    base.update(overrides)
    return base


@pytest.mark.django_db
def test_ritual_decision_unique_parcial_barra_segunda_linha_do_mesmo_par(user):
    """AC1: re-decidir é upsert no serviço, NUNCA segunda linha no banco."""
    with tenant_context(user):
        kwargs = _decisao_kwargs(user)
        RitualDecision.objects.create(**kwargs)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                RitualDecision.objects.create(**kwargs)


@pytest.mark.django_db
def test_ritual_decision_pares_diferentes_coexistem(user):
    """A unicidade é por `(alvo, item)`, não por alvo nem por item: o mesmo alvo
    com dois itens, e o mesmo item em dois alvos, precisam coexistir."""
    with tenant_context(user):
        weekly_a = WeeklyLogFactory(user=user)
        weekly_b = WeeklyLogFactory(user=user)
        tarefa_1 = TaskFactory(user=user, weekly_log=weekly_a)
        tarefa_2 = TaskFactory(user=user, weekly_log=weekly_a)

        RitualDecision.objects.create(
            weekly_log=weekly_a, task=tarefa_1, decision=RitualDecisionKind.KEEP
        )
        RitualDecision.objects.create(
            weekly_log=weekly_a, task=tarefa_2, decision=RitualDecisionKind.KEEP
        )
        RitualDecision.objects.create(
            weekly_log=weekly_b, task=tarefa_1, decision=RitualDecisionKind.KEEP
        )

        assert RitualDecision.objects.count() == 3


@pytest.mark.django_db
def test_ritual_decision_unique_parcial_por_template(user):
    """A unique de `(weekly_log, recurring_template)` é uma constraint SEPARADA
    das outras três — um teste só sobre o par de Task não a exercitaria."""
    with tenant_context(user):
        weekly = WeeklyLogFactory(user=user)
        template = RecurringTaskTemplateFactory(user=user)
        kwargs = {
            "weekly_log": weekly,
            "recurring_template": template,
            "decision": RitualDecisionKind.SKIP_WEEK,
        }
        RitualDecision.objects.create(**kwargs)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                RitualDecision.objects.create(**kwargs)


@pytest.mark.django_db
def test_ritual_decision_unique_parcial_no_alvo_mensal(user):
    """Gêmea da anterior no alvo monthly — as 4 uniques são 4 constraints."""
    with tenant_context(user):
        monthly = MonthlyLogFactory(user=user)
        template = RecurringTaskTemplateFactory(user=user)
        tarefa = TaskFactory(user=user, monthly_log=monthly)
        par_task = {
            "monthly_log": monthly,
            "task": tarefa,
            "decision": RitualDecisionKind.KEEP_UNDATED,
        }
        par_template = {
            "monthly_log": monthly,
            "recurring_template": template,
            "decision": RitualDecisionKind.KEEP_UNDATED,
        }
        RitualDecision.objects.create(**par_task)
        RitualDecision.objects.create(**par_template)
        for par in (par_task, par_template):
            with pytest.raises(IntegrityError):
                with transaction.atomic():
                    RitualDecision.objects.create(**par)


@pytest.mark.django_db
@pytest.mark.parametrize("ambos", [True, False])
def test_ritual_decision_check_exactly_one_target(user, ambos):
    """Dois alvos OU nenhum alvo violam `ritual_decision_exactly_one_target`."""
    with tenant_context(user):
        monthly = MonthlyLogFactory(user=user)
        kwargs = _decisao_kwargs(user)
        kwargs["monthly_log"] = monthly if ambos else None
        if not ambos:
            kwargs["weekly_log"] = None
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                RitualDecision.objects.create(**kwargs)


@pytest.mark.django_db
@pytest.mark.parametrize("ambos", [True, False])
def test_ritual_decision_check_exactly_one_item(user, ambos):
    """Dois itens OU nenhum item violam `ritual_decision_exactly_one_item`."""
    with tenant_context(user):
        kwargs = _decisao_kwargs(user)
        kwargs["recurring_template"] = (
            RecurringTaskTemplateFactory(user=user) if ambos else None
        )
        if not ambos:
            kwargs["task"] = None
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                RitualDecision.objects.create(**kwargs)


@pytest.mark.django_db
def test_ritual_decision_check_barra_valor_fora_do_enum(user):
    """`decision` fora dos três valores é barrada pelo banco, não só pelo enum
    Python: um `bulk_create`/`update` cru não passa pelo `TextChoices`."""
    with tenant_context(user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                RitualDecision.objects.create(**_decisao_kwargs(user, decision="skip_month"))


@pytest.mark.django_db
def test_ritual_decision_nao_acrescenta_coluna_de_progresso(user):
    """AD-28 item 6 ponto 7: progresso é DERIVADO. Nenhuma coluna de contador em
    `ritual_decisions` e nenhuma nova em `weekly_log`/`monthly_log`."""
    for model in (RitualDecision, WeeklyLog, MonthlyLog):
        nomes = {campo.name for campo in model._meta.get_fields()}
        assert not {
            n for n in nomes if "count" in n or "progress" in n or "reviewed" in n
        }, f"{model.__name__} ganhou coluna de progresso/contador"
