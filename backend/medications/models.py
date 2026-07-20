"""Medicamentos — cadastro/versões prospectivas (8.1) + camada realizada (8.2).

A Story 8.1 implementou a camada de **catálogo versionado** da AD-07 (slot estável +
blocos dinâmicos + agenda/substância versionadas). A Story 8.2 acrescenta a **camada
realizada** (``medication_day_entries`` com ``dose_at_time`` congelado, ``source``
scheduled/ad_hoc e a semântica de ausência = dose perdida) — itens 7-11 da AD-07,
espelhando ``habits.HabitDayEntry`` (AD-06). A **exibição** da dose perdida (histórico)
é 8.3; o **schema e a semântica de ausência** nascem aqui na 8.2.

Divergência-chave (AD-07 espelha AD-06): Medicamentos **VERSIONA** — porte o molde de
``habits`` (``HabitVersion``), NÃO o de ``health`` (plano). O estado de
``(medicamento, bloco)`` no dia D = a versão com ``max(effective_from) <= D``. Dois
eixos de versão **independentes**: a dose muda por ``(medicamento, bloco)`` →
``MedicationScheduleVersion``; substância/laboratório/médico mudam no nível do
medicamento → ``MedicationSubstanceVersion``.

Regra de ouro (AD-07): mudança = INSERT de versão com ``effective_from = hoje``
(prospectivo); uma segunda mudança no **mesmo dia** é UPDATE da versão daquele dia
(via ``UniqueConstraint`` + ``update_or_create``). ``medications.title`` é identidade
pura (slot estável) — **sem** coluna ``active`` (o ativo/inativo vive nas versões de
agenda). Não há ENUM nesta story (blocos são dinâmicos; ``source`` é 8.2).
"""

from django.db import models

from core.models import TenantModel


class Doctor(TenantModel):
    """Catálogo de médicos por tenant (AD-07 item 6). Plano, estilo ``HabitGroup``
    (sem coluna ``active`` — a AD-07 não a especifica; é protegido por ``PROTECT``).

    Herda ``TenantModel`` → UUID PK ``id`` + ``user_id`` indexado + managers
    auto-escopados. Referenciado por ``MedicationSubstanceVersion.prescribed_by``
    (``on_delete=PROTECT`` — preserva o histórico da versão de substância).
    """

    name = models.CharField(max_length=200)
    specialty = models.CharField(max_length=200, null=True, blank=True)  # noqa: DJ001 - AD-07: specialty TEXT NULL (ausência é valor válido)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "doctors"
        ordering = ["name"]


class TimeBlock(TenantModel):
    """Bloco de horário — dinâmico por usuário, **sem ENUM e sem migração** (AD-07).

    Novos blocos ("antes do almoço") são criados sem migração de schema. O bloco só
    **agrupa e ordena** (papel não-analítico, não-restritivo); desativar
    (``active=false``) esconde sem apagar, preservando as referências históricas das
    versões de agenda que o apontam (``on_delete=PROTECT``). ``display_order`` já no
    schema (append sequencial na criação); UI de reordenação deferida (espelha 6.1/7.1).
    """

    name = models.CharField(max_length=200)
    display_order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "time_blocks"
        ordering = ["display_order", "name"]


class Medication(TenantModel):
    """Slot estável da rotina ("Remédio de pressão") — identidade pura (AD-07).

    É o que ganha blocos, agenda e histórico contínuo de adesão — não quebra quando o
    médico troca a substância. **SEM coluna ``active``** (AC5): o ativo/inativo vive
    nas versões de agenda. O ``id`` (UUID do ``TenantModel``) é a **chave-âncora
    estável** que a Story 8.2 usará em ``medication_day_entries``.
    """

    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "medications"
        ordering = ["title"]


class MedicationSubstanceVersion(TenantModel):
    """Produto que preenche o slot ao longo do tempo (AD-07) — eixo **substância**.

    Substância/laboratório/médico versionados no nível do medicamento. Produto
    vigente no dia D = versão com ``max(effective_from) <= D``. Uma versão por
    ``(medication, effective_from)``: a segunda mudança do mesmo dia faz UPDATE da
    versão do dia (via ``update_or_create``, molde ``HabitVersion``).
    """

    medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="substance_versions"
    )
    substance_name = models.CharField(max_length=200)
    laboratory = models.CharField(max_length=200, null=True, blank=True)  # noqa: DJ001 - AD-07: laboratory TEXT NULL (opcional)
    prescribed_by = models.ForeignKey(
        Doctor, on_delete=models.PROTECT, null=True, blank=True,
        related_name="substance_versions",
    )
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "medication_substance_versions"
        ordering = ["medication", "-effective_from", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["medication", "effective_from"],
                name="uniq_substance_version_per_day",
            ),
        ]


class MedicationScheduleVersion(TenantModel):
    """Agenda de doses por ``(medicamento, bloco)`` (AD-07) — eixo **agenda**.

    O estado de ``(medicamento, bloco)`` no dia D = a versão com
    ``max(effective_from) <= D``. ``dose`` é JSONB multi-componente
    ``[{label, amount, unit}]`` (nº de componentes livre — cobre remédio com >1
    droga), validado na **camada de serviço** (``amount`` numérico, ``unit``
    não-vazia). ``active`` mora aqui (nunca em ``medications``): desativar uma agenda
    = **nova versão com ``active=false``** (prospectiva; nunca ``.delete()``, AC5).
    Uma versão por ``(medication, time_block, effective_from)`` — o análogo mais
    próximo é ``HabitGroupDayMultiplier`` (composto de 3 campos).

    ⚠️ **Casing JSONB (§6.3):** ``dose`` usa chaves estáticas de palavra única
    (``label``/``amount``/``unit``) — o ``underscoreize``/``camelize`` só reescreve
    chaves com underscore/fronteira de caso, então elas passam **intactas**. Por isso
    ``dose`` **NÃO** entra em ``JSON_UNDERSCOREIZE.ignore_fields`` (base.py) — ao
    contrário de ``health_logs.values`` (indexado por UUID). Se algum dia surgir uma
    chave de dose multi-palavra, aí sim ela entra na tupla.
    """

    medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="schedule_versions"
    )
    time_block = models.ForeignKey(
        TimeBlock, on_delete=models.PROTECT, related_name="schedule_versions"
    )
    dose = models.JSONField(default=list, blank=True)
    active = models.BooleanField(default=True)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "medication_schedule_versions"
        ordering = ["medication", "time_block", "-effective_from", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["medication", "time_block", "effective_from"],
                name="uniq_schedule_version_per_day",
            ),
        ]


class Source(models.TextChoices):
    """Origem da linha realizada (AD-07 itens 8/10) — no **nível do módulo** (não
    aninhada em ``MedicationDayEntry``): uma classe aninhada não é visível ao
    ``CheckConstraint`` de ``Meta`` (mesmo motivo de ``bujo.models.TaskStatus`` /
    ``habits.models.HabitType``). Exposta como ``MedicationDayEntry.Source``.

    - ``SCHEDULED``: materializada da agenda vigente no dia (contrapartida esperada;
      uma ``scheduled`` sem ``confirmed_at`` num dia passado é uma **dose perdida** —
      sinal clínico, exibido na 8.3).
    - ``AD_HOC``: medicamento tomado sem previsão (PRN); sempre confirmado, sem
      contrapartida — a **ausência** de uma ``ad_hoc`` nunca significa perda.
    """

    SCHEDULED = "scheduled"
    AD_HOC = "ad_hoc"


class MedicationDayEntry(TenantModel):
    """Snapshot realizado, congelado por dia (AD-07 itens 7-11 — camada da 8.2).

    Espelha ``habits.HabitDayEntry`` (AD-06): uma linha ``scheduled`` por
    ``(medicamento, bloco)`` agendado e ativo em D, materializada na 1ª abertura do
    dia via ``seed_medication_day`` (gap-fill idempotente), com ``dose_at_time``
    **congelado** da versão de agenda vigente naquele dia. ``confirmed_at`` nulo =
    não confirmado; preenchê-lo = adesão registrada. Confirmar não sangra para outras
    linhas nem toca a agenda/substância.

    Duas semânticas que hábitos não tem (o coração da 8.2):

    1. **Dose perdida ≠ 0% de hábito.** Uma linha ``scheduled`` sem ``confirmed_at``
       num dia passado é um **sinal clínico**, não entra em denominador nenhum. A
       exibição como "perda" é a 8.3; o schema e a semântica de ausência nascem aqui.
    2. **``ad_hoc`` (PRN).** Medicamento tomado sem previsão, sempre confirmado, sem
       contrapartida — ``time_block`` opcional (pode ser nulo) e **fora** da constraint
       parcial de ``scheduled`` (permite múltiplos avulsos no mesmo dia/bloco).

    Também herda ``TenantModel`` (UUID PK + ``user_id`` denormalizado + auto-scope):
    a AD-07 desenha PK composta ``(user_id, medication_id, time_block_id, date)``, mas
    o projeto exige UUID PK + ``user_id`` indexado em toda tabela tenant (§6.1/AD-12),
    então a unicidade vira ``UniqueConstraint`` — e aqui **PARCIAL** (``WHERE
    source='scheduled'``), diferente de hábitos (que não tem ``source``). É a primeira
    constraint parcial do codebase.

    ⚠️ **Casing JSONB (§6.3):** ``dose_at_time`` usa chaves estáticas de palavra única
    (``label``/``amount``/``unit``) — o ``underscoreize``/``camelize`` as deixa
    **intactas**, então ``dose_at_time`` **NÃO** entra em
    ``JSON_UNDERSCOREIZE.ignore_fields`` (base.py), mesma decisão do ``dose`` da 8.1.
    """

    Source = Source

    medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="day_entries"
    )
    time_block = models.ForeignKey(
        TimeBlock, on_delete=models.PROTECT, null=True, blank=True,
        related_name="day_entries",
    )
    date = models.DateField()
    dose_at_time = models.JSONField(default=list, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    source = models.CharField(
        max_length=16, choices=Source.choices, default=Source.SCHEDULED
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "medication_day_entries"
        ordering = ["date", "time_block", "medication"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(source__in=Source.values),
                name="med_day_entry_source_valid",
            ),
            # PRIMEIRA constraint parcial do codebase: uma linha ``scheduled`` por
            # ``(med, bloco, dia)``. Linhas ``ad_hoc`` NÃO são restringidas (Django
            # gera um índice único parcial ``... WHERE source = 'scheduled'``).
            models.UniqueConstraint(
                fields=["medication", "time_block", "date"],
                condition=models.Q(source=Source.SCHEDULED),
                name="uniq_med_day_entry_scheduled",
            ),
        ]
