"""Testes de `LogSerializer`/`TaskSerializer` (AC #1, #2)."""

from datetime import date

import pytest

from bujo.models import RecurringTaskTemplate, Task
from bujo.serializers import (
    DensityResponseSerializer,
    LogSerializer,
    RecurringTaskTemplateCreateSerializer,
    RecurringTaskTemplateUpdateSerializer,
    RitualDecisionCreateSerializer,
    TaskSerializer,
    TaskSourceSerializer,
)
from bujo.services.migration import migrate_task
from bujo.services.recurring import place_template
from bujo.tests.factories import (
    LogFactory,
    MonthlyLogFactory,
    RecurringTaskTemplateFactory,
    TaskFactory,
)
from core.tenant import tenant_context


@pytest.mark.django_db
def test_log_serializer_aninha_tarefas_na_ordem_de_order_index(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        TaskFactory(user=user, log=log, title="Terceira", order_index=3.0)
        TaskFactory(user=user, log=log, title="Primeira", order_index=1.0)
        TaskFactory(user=user, log=log, title="Segunda", order_index=2.0)

        data = LogSerializer(log).data

        assert [task["title"] for task in data["tasks"]] == [
            "Primeira",
            "Segunda",
            "Terceira",
        ]


def test_task_serializer_expoe_exatamente_os_campos_esperados():
    assert set(TaskSerializer.Meta.fields) == {
        "id",
        "title",
        "description",
        "status",
        "eisenhower",
        "category",
        "scheduled_date",
        "subtasks",
        "waiting_on",
        "migration_count",
        "migrated_to_task",
        "source_template",
    }


@pytest.mark.django_db
def test_task_serializer_waiting_on_e_false_para_tarefa_comum(user):
    """Story 12.2 (AC2): `waiting_on` sai no read e nasce `False` por default.
    Chaves de `.data` são snake_case — a camelização (`waitingOn`) só ocorre no
    render do corpo HTTP, que `.data` não passa."""
    with tenant_context(user):
        task = TaskFactory(user=user)

        data = TaskSerializer(task).data

        assert "waiting_on" in data
        assert data["waiting_on"] is False


@pytest.mark.django_db
def test_task_serializer_source_template_e_null_para_tarefa_comum(user):
    with tenant_context(user):
        task = TaskFactory(user=user)

        data = TaskSerializer(task).data

        assert "source_template" in data
        assert data["source_template"] is None


@pytest.mark.django_db
def test_task_serializer_source_template_e_o_id_do_template_apos_placement(user):
    """AC1: uma tarefa colocada via `place_template` serializa `source_template`
    com o id do template — é o que habilita o dedup client-side."""
    with tenant_context(user):
        MonthlyLogFactory(user=user, month_first=date(2026, 7, 1))
        template = RecurringTaskTemplateFactory(
            user=user, recurrence_group=RecurringTaskTemplate.RecurrenceGroup.MONTHLY
        )

        task = place_template(
            user=user, template_id=template.id, month_first=date(2026, 7, 1)
        )
        data = TaskSerializer(task).data

        assert data["source_template"] == template.id


@pytest.mark.django_db
def test_task_serializer_categoria_nula_serializa_como_null(user):
    with tenant_context(user):
        task = TaskFactory(user=user, category=None)

        data = TaskSerializer(task).data

        assert "category" in data
        assert data["category"] is None


@pytest.mark.django_db
def test_task_serializer_categoria_definida_serializa_valor(user):
    with tenant_context(user):
        task = TaskFactory(user=user, category=Task.Category.TEAL)

        data = TaskSerializer(task).data

        assert data["category"] == Task.Category.TEAL


@pytest.mark.django_db
def test_task_serializer_descricao_nula_serializa_como_null(user):
    with tenant_context(user):
        task = TaskFactory(user=user, description=None)

        data = TaskSerializer(task).data

        assert "description" in data
        assert data["description"] is None


@pytest.mark.django_db
def test_task_serializer_subtasks_vazio_serializa_como_lista_vazia(user):
    with tenant_context(user):
        task = TaskFactory(user=user)

        data = TaskSerializer(task).data

        assert data["subtasks"] == []


@pytest.mark.django_db
def test_task_serializer_subtasks_aninha_na_ordem_de_order_index(user):
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, title="Pai")
        TaskFactory(user=user, log=log, parent_task=parent, title="Segunda filha", order_index=2.0)
        TaskFactory(user=user, log=log, parent_task=parent, title="Primeira filha", order_index=1.0)

        data = TaskSerializer(parent).data

        assert [child["title"] for child in data["subtasks"]] == [
            "Primeira filha",
            "Segunda filha",
        ]


@pytest.mark.django_db
def test_task_serializer_migrated_to_task_e_null_quando_nunca_migrou(user):
    with tenant_context(user):
        task = TaskFactory(user=user)

        data = TaskSerializer(task).data

        assert data["migration_count"] == 0
        assert data["migrated_to_task"] is None


@pytest.mark.django_db
def test_task_serializer_migrated_to_task_e_o_id_da_tarefa_de_destino_apos_migrar(user):
    with tenant_context(user):
        task = TaskFactory(user=user, status=Task.Status.PENDING)

        # `migrate_task` retorna a ORIGEM recarregada (Task.Status.MIGRATED,
        # `migrated_to_task` populado) — não a tarefa de destino nova.
        migrated_source = migrate_task(user=user, task_id=task.id, destination="today")
        data = TaskSerializer(migrated_source).data

        assert data["migrated_to_task"] == migrated_source.migrated_to_task_id
        new_task = migrated_source.migrated_to_task
        assert TaskSerializer(new_task).data["migration_count"] == 1


@pytest.mark.django_db
def test_log_serializer_tasks_nao_inclui_subtarefas_na_raiz(user):
    """Gap fechado nesta story: subtarefas compartilham `log_id` do pai
    (AD-08 item 12) — sem o filtro `parent_task__isnull=True`, apareceriam
    duplicadas: uma vez aninhadas, outra vez soltas na raiz."""
    with tenant_context(user):
        log = LogFactory(user=user)
        parent = TaskFactory(user=user, log=log, title="Pai")
        TaskFactory(user=user, log=log, parent_task=parent, title="Filha")

        data = LogSerializer(log).data

        assert [task["title"] for task in data["tasks"]] == ["Pai"]
        assert data["tasks"][0]["subtasks"][0]["title"] == "Filha"


# --- RecurringTaskTemplate serializers (AC #1) ---------------------------------


@pytest.mark.parametrize("recurrence_group", list(RecurringTaskTemplate.RecurrenceGroup.values))
def test_create_serializer_aceita_todos_os_recurrence_group_validos(recurrence_group):
    serializer = RecurringTaskTemplateCreateSerializer(
        data={
            "title": "Template",
            "recurrence_group": recurrence_group,
            "recurrence_text": "toda segunda",
        }
    )

    assert serializer.is_valid(), serializer.errors


def test_create_serializer_recurrence_group_fora_do_enum_e_invalido():
    serializer = RecurringTaskTemplateCreateSerializer(
        data={"title": "Template", "recurrence_group": "bogus", "recurrence_text": "texto"}
    )

    assert not serializer.is_valid()
    assert "recurrence_group" in serializer.errors


def test_create_serializer_description_e_eisenhower_aceitam_null():
    serializer = RecurringTaskTemplateCreateSerializer(
        data={
            "title": "Template",
            "description": None,
            "eisenhower": None,
            "recurrence_group": "weekly",
            "recurrence_text": "toda segunda",
        }
    )

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["description"] is None
    assert serializer.validated_data["eisenhower"] is None


def test_update_serializer_todos_os_campos_sao_opcionais():
    serializer = RecurringTaskTemplateUpdateSerializer(data={}, partial=True)

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data == {}


# --- Story 14.2: envelope de fonte e densidade ---------------------------------
def test_ritual_decision_create_serializer_exige_exatamente_um_alvo_e_um_item():
    """Forma inválida é 400 no serializer; a MATRIZ de combinação é 409 no serviço.
    A distinção é deliberada (§6.6: regra de produto nunca em serializer)."""
    base = {"decision": "keep", "taskId": "b1f0c2d4-0000-4000-8000-000000000001"}
    formas = [
        base,  # nenhum alvo
        {**base, "weekStart": "2026-03-02", "monthFirst": "2026-03-01"},  # dois alvos
        {"decision": "keep", "weekStart": "2026-03-02"},  # nenhum item
        {
            **base,
            "weekStart": "2026-03-02",
            "recurringTemplateId": "b1f0c2d4-0000-4000-8000-000000000002",
        },  # dois itens
        {**base, "weekStart": "2026-03-03"},  # não é segunda
        {**base, "monthFirst": "2026-03-15"},  # não é dia 1
    ]
    # O parser camelCase roda ANTES do serializer no ciclo real; aqui alimentamos
    # snake_case direto, que é o que o serializer recebe de fato.
    def snake(corpo):
        mapa = {
            "weekStart": "week_start",
            "monthFirst": "month_first",
            "taskId": "task_id",
            "recurringTemplateId": "recurring_template_id",
        }
        return {mapa.get(k, k): v for k, v in corpo.items()}

    for corpo in formas:
        assert not RitualDecisionCreateSerializer(data=snake(corpo)).is_valid(), corpo

    valido = RitualDecisionCreateSerializer(data=snake({**base, "weekStart": "2026-03-02"}))
    assert valido.is_valid(), valido.errors


def test_envelope_de_fonte_serializa_sem_label_e_com_os_seis_campos():
    """AC5 + decisão registrada nas Dev Notes: **sem campo `label`** — a cópia pt-BR
    das fontes é do UI (DESIGN/EXPERIENCE são a autoridade de wording)."""
    dados = TaskSourceSerializer(
        {
            "source_id": "monthly-in-week",
            "blocking": False,
            "counts_toward_progress": True,
            "eligible_count": 0,
            "pending_decision_count": 0,
            "reviewed": True,
            "items": [],
        }
    ).data
    assert set(dados) == {
        "source_id",
        "blocking",
        "counts_toward_progress",
        "eligible_count",
        "pending_decision_count",
        "reviewed",
        "items",
    }
    assert "label" not in dados


def test_densidade_serializa_as_seis_chaves_de_status_sem_underscore():
    """AC6: as 6 chaves de `TaskStatus` não têm underscore, então a camelização de
    saída não as altera — e todas são obrigatórias no serializer, então uma chave
    faltando levantaria em vez de sair como `undefined` no cliente."""
    celula = {"total": 0, "by_status": {status: 0 for status in Task.Status.values}}
    dados = DensityResponseSerializer(
        {"days": [{"date": date(2026, 3, 2), **celula}], "undated": celula, "total": 0}
    ).data
    assert set(dados["days"][0]["by_status"]) == set(Task.Status.values)
    assert not any("_" in chave for chave in dados["days"][0]["by_status"])
