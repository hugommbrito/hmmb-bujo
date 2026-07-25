"""Ciclo de vida operacional de Weekly e Monthly (AD-28; EXPERIENCE.md M06/M07).

Três estados explícitos — ``planning`` → ``active`` → ``finalized`` — mais a
**terceira semântica** ``NULL`` (fora do regime operacional), que é o estado de
todo log nascido por materialização sob demanda (navegação, ``POST`` de tarefa,
Brain Dump, placement de recorrente, migração). Entrar no regime é SEMPRE ato de
ritual explícito: nenhum caminho de materialização atribui, altera ou lê estado
(AD-28 item 3).

Weekly e Monthly compartilham quase toda a mecânica, então a implementação é
**parametrizada por ``_CycleSpec``** em vez de duplicada — os pontos onde as
regras de produto realmente divergem estão isolados no spec e nomeados:

- ``_CycleSpec.next_planning_exists``: gate de finalizar. Weekly = existe QUALQUER
  ``planning`` posterior (semanas podem ser puladas); Monthly = existe
  ``planning`` exatamente no mês seguinte (sequência sem lacunas).

E dois pontos que divergem no serviço público (não no spec, porque mudam a própria
assinatura da função):

- **escolha do alvo**: o Weekly recebe ``week_start`` e aceita a semana corrente ou
  qualquer futura, inclusive pulando semanas — alvo no passado é rejeitado; o
  Monthly não recebe alvo nenhum (é sempre o mês seguinte ao ``active``).
- **cancelar alvo vazio**: existe só no Weekly ("O Monthly não herda a ação
  Cancelar planejamento vazio do Weekly" — M07).

Convenções obrigatórias: funções de módulo (nunca classes de serviço),
``@transaction.atomic`` no serviço, ``user`` como primeiro kwarg keyword-only,
matriz de transições AQUI (nunca em serializer), erro de gate = ``InvalidTransition``
(→ 409 pelo handler central).
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

from django.db import IntegrityError, transaction

from bujo.models import CycleStatus, MonthlyLog, WeeklyLog
from bujo.services.archive import UNDISPOSED
from core.calendar import now, today_for, week_start_of
from core.exceptions import CycleTargetConflict, InvalidTransition

# Matriz única de transições legais. Auto-transições (ex.: `planning -> planning`)
# NÃO estão em nenhum conjunto — contam como ilegais, igual a
# `services/state_machine.py`. `finalized` é TERMINAL (conjunto vazio): finalizar
# é irreversível e um ciclo finalizado nunca reabre.
#
# `None -> ACTIVE` ausente é LOAD-BEARING, não descuido: M06/M07 dão a `planning`
# uma única saída (Iniciar) e a `active` uma única entrada (confirmação a partir
# do alvo planejado). Sem essa restrição — combinada com a pré-condição
# `status == 'planning'` de `complete_*_planning` — existiria um bypass completo
# do ritual: um log materializado por navegação (`NULL`) receberia o timestamp de
# planejamento, o gate de "anterior finalizado" seria satisfeito por vacuidade e
# o usuário entraria em `active` sem nunca ter planejado.
#
# `PLANNING -> None` é a única transição "para trás" do domínio (cancelar alvo
# vazio, só no Weekly).
ALLOWED: dict[str | None, set[str | None]] = {
    None: {CycleStatus.PLANNING},
    CycleStatus.PLANNING: {CycleStatus.ACTIVE, None},
    CycleStatus.ACTIVE: {CycleStatus.FINALIZED},
    CycleStatus.FINALIZED: set(),
}

# Pseudo-alvo usado só na mensagem de erro de `complete_*_planning`: concluir
# planejamento é um MARCO (timestamp), não uma mudança de `status`, então não há
# `to_status` real a citar. A AD-28 manda usar `InvalidTransition` para todo erro
# de gate, e este rótulo mantém o 409 legível ("none -> planning_completed").
PLANNING_COMPLETED = "planning_completed"


def add_months(month_first: date, months: int) -> date:
    """Dia 1 do mês ``months`` à frente de ``month_first`` (sempre normalizado)."""
    total = (month_first.year * 12 + month_first.month - 1) + months
    return date(total // 12, total % 12 + 1, 1)


@dataclass(frozen=True)
class _CycleSpec:
    """Parametrização de um dos dois tipos de ciclo (ver docstring do módulo)."""

    model: type
    key_field: str
    # Predicado do gate de finalizar: "o próximo ciclo já está registrado como
    # planning?". Diferente por tipo de propósito — NÃO compartilhar.
    next_planning_exists: Callable[[date], bool]


def _weekly_next_planning_exists(key: date) -> bool:
    """Weekly: QUALQUER semana posterior em planejamento serve — semanas podem ser
    puladas sem registro (AC3/M06), então exigir a semana imediatamente seguinte
    travaria o ritual de quem planejou duas semanas à frente."""
    return WeeklyLog.objects.filter(status=CycleStatus.PLANNING, week_start__gt=key).exists()


def _monthly_next_planning_exists(key: date) -> bool:
    """Monthly: exatamente o mês seguinte — a sequência mensal não admite lacuna
    (M07: meses pulados são materializados um a um, sem salto nem lote)."""
    return MonthlyLog.objects.filter(
        status=CycleStatus.PLANNING, month_first=add_months(key, 1)
    ).exists()


_WEEKLY = _CycleSpec(
    model=WeeklyLog,
    key_field="week_start",
    next_planning_exists=_weekly_next_planning_exists,
)
_MONTHLY = _CycleSpec(
    model=MonthlyLog,
    key_field="month_first",
    next_planning_exists=_monthly_next_planning_exists,
)


# --- helpers privados ----------------------------------------------------------
def _get(spec: _CycleSpec, key: date):
    """Log do tenant para ``key``, ou ``None``. `objects` é auto-escopado."""
    return spec.model.objects.filter(**{spec.key_field: key}).first()


def _status_of(log) -> str | None:
    return log.status if log is not None else None


def _check_allowed(log, to_status) -> None:
    """Impõe a matriz. Log inexistente conta como ``status = None``."""
    from_status = _status_of(log)
    if to_status not in ALLOWED[from_status]:
        raise InvalidTransition(from_status, to_status)


def _previous_operational(spec: _CycleSpec, *, key: date):
    """Ciclo **operacional** (``status`` não-``NULL``) cronologicamente anterior a ``key``.

    Deliberadamente ignora ciclos ``NULL``: se "anterior" fosse o log anterior
    qualquer, todo usuário com semanas/meses velhos não-fechados (bucket ``NULL``
    da data migration) ficaria travado para sempre no primeiro uso real — o
    "ciclo órfão" que o AC7 proíbe. Ausência de anterior operacional satisfaz o
    gate por vacuidade, e é exatamente isso que faz o primeiro uso real funcionar
    depois do backfill. As tarefas abertas dos ciclos ``NULL`` são a população da
    fila unificada da Story 14.3, não um bloqueio de ritual.
    """
    return (
        spec.model.objects.filter(status__isnull=False, **{f"{spec.key_field}__lt": key})
        .order_by(f"-{spec.key_field}")
        .first()
    )


def _has_undisposed(log) -> bool:
    """Alguma tarefa da subárvore completa ainda ``pending``/``started``?

    Reusa ``UNDISPOSED`` de ``services/archive.py`` (não redeclara a tupla) e, como
    lá, NÃO filtra ``parent_task``: um pai com filho pendente não fecha (FR-1.10).
    """
    return log.tasks.filter(status__in=UNDISPOSED).exists()


def _save_status(log, *, fields) -> None:
    """Persiste ``fields`` traduzindo colisão de unique parcial em 409 de domínio.

    Savepoint interno (``atomic`` aninhado) para que a ``IntegrityError`` não deixe
    a transação externa quebrada antes de a exceção de domínio subir.
    """
    try:
        with transaction.atomic():
            log.save(update_fields=fields)
    except IntegrityError as exc:
        raise CycleTargetConflict(
            "Já existe outro ciclo disputando este alvo. Recarregue e tente de novo."
        ) from exc


def _create_planning(spec: _CycleSpec, *, key: date):
    """Cria o log já em ``planning`` (o alvo pode nunca ter sido materializado).

    ``user_id`` é auto-preenchido pelo ``save()`` de ``TenantModel`` a partir do
    contexto de tenant — não passar à mão aqui (diferente da data migration, que
    usa models históricos sem esse ``save()``).
    """
    try:
        with transaction.atomic():
            return spec.model.objects.create(status=CycleStatus.PLANNING, **{spec.key_field: key})
    except IntegrityError as exc:
        raise CycleTargetConflict(
            "Já existe outro ciclo disputando este alvo. Recarregue e tente de novo."
        ) from exc


# --- transições genéricas ------------------------------------------------------
def _open_planning_target(spec: _CycleSpec, *, key: date):
    log = _get(spec, key)
    if _status_of(log) == CycleStatus.PLANNING:
        return log  # idempotente: já é o alvo de planejamento, nada a escrever
    _check_allowed(log, CycleStatus.PLANNING)
    if log is None:
        return _create_planning(spec, key=key)
    log.status = CycleStatus.PLANNING
    _save_status(log, fields=["status"])
    return log


def _complete_planning(spec: _CycleSpec, *, key: date):
    log = _get(spec, key)
    # Exige `planning`: concluir planejamento de um log fora do regime (`NULL`)
    # seria o primeiro passo do bypass do ritual descrito na matriz acima.
    if _status_of(log) != CycleStatus.PLANNING:
        raise InvalidTransition(_status_of(log), PLANNING_COMPLETED)
    if log.planning_completed_at is not None:
        # Idempotente E não re-timbra: o marco original é dado de auditoria
        # (mesmo espírito do "create-if-missing" de `seed_medication_day`).
        return log
    # Declaração NÃO-bloqueante: não exige zerar fontes, não congela o ritual e
    # NÃO muda `status` — o alvo permanece plenamente operável e revisitável até
    # Iniciar (M06/M07).
    log.planning_completed_at = now()
    log.save(update_fields=["planning_completed_at"])
    return log


def _start(spec: _CycleSpec, *, user, key: date):
    log = _get(spec, key)
    if _status_of(log) == CycleStatus.ACTIVE:
        return log  # idempotente: re-executar Iniciar é no-op (caso-âncora AD-28)
    _check_allowed(log, CycleStatus.ACTIVE)

    # Os três gates de Iniciar são CUMULATIVOS (M06/M07). Avisos de Daily,
    # Monthly e recorrentes NÃO bloqueiam — só o ciclo anterior do mesmo tipo.
    if today_for(user) < key:
        # "Uma semana futura nunca entra Em andamento antes de sua segunda-feira,
        # mesmo quando seu planejamento for concluído antecipadamente."
        raise InvalidTransition(CycleStatus.PLANNING, CycleStatus.ACTIVE)
    if log.planning_completed_at is None:
        raise InvalidTransition(CycleStatus.PLANNING, CycleStatus.ACTIVE)
    previous = _previous_operational(spec, key=key)
    if previous is not None and previous.status != CycleStatus.FINALIZED:
        raise InvalidTransition(CycleStatus.PLANNING, CycleStatus.ACTIVE)

    log.status = CycleStatus.ACTIVE
    _save_status(log, fields=["status"])
    return log


def _finalize(spec: _CycleSpec, *, key: date):
    log = _get(spec, key)
    if _status_of(log) == CycleStatus.FINALIZED:
        return log  # idempotente
    _check_allowed(log, CycleStatus.FINALIZED)

    if _has_undisposed(log):
        raise InvalidTransition(CycleStatus.ACTIVE, CycleStatus.FINALIZED)
    if not spec.next_planning_exists(key):
        raise InvalidTransition(CycleStatus.ACTIVE, CycleStatus.FINALIZED)

    log.status = CycleStatus.FINALIZED
    _save_status(log, fields=["status"])
    return log


# --- predicados públicos compartilhados com as fontes de ritual (Story 14.2) ---
# Wrappers finos por tipo, e NÃO uma cópia da query: as fontes bloqueantes dos
# rituais (`previous-weekly` / `previous-monthly`) precisam olhar EXATAMENTE o
# mesmo log que o gate de `_start` consulta. Se divergissem — por exemplo se uma
# fonte assumisse `week_start - 7 dias` em vez do anterior OPERACIONAL — a UI
# mostraria "semana anterior pronta para finalizar" enquanto Iniciar responderia
# 409, porque um ciclo `NULL` intermediário estaria sendo contado por um lado e
# ignorado pelo outro.
def previous_operational_weekly(*, user, week_start) -> WeeklyLog | None:
    """Weekly operacional imediatamente anterior a ``week_start`` (ou ``None``)."""
    return _previous_operational(_WEEKLY, key=week_start)


def previous_operational_monthly(*, user, month_first) -> MonthlyLog | None:
    """Monthly operacional imediatamente anterior a ``month_first`` (ou ``None``)."""
    return _previous_operational(_MONTHLY, key=month_first)


def has_undisposed(log) -> bool:
    """Alguma tarefa da subárvore de ``log`` ainda ``pending``/``started``?

    Público desde a Story 14.2: é o mesmo predicado que decide o gate de
    finalizar e o ``readyToFinalize`` que as fontes bloqueantes expõem — um
    ``readyToFinalize: true`` que não fosse este predicado seria uma promessa que
    o botão Finalizar não honraria.
    """
    return _has_undisposed(log)


# --- Weekly (M06) --------------------------------------------------------------
@transaction.atomic
def open_weekly_planning_target(*, user, week_start) -> WeeklyLog:
    """Abre a semana ``week_start`` como alvo de planejamento.

    Aceita a semana corrente ou qualquer semana futura, inclusive pulando semanas
    sem registro (M06). Alvo no passado é rejeitado: envenenaria o "anterior
    operacional" de todos os ciclos seguintes.
    """
    if week_start < week_start_of(today_for(user)):
        raise InvalidTransition(None, CycleStatus.PLANNING)
    return _open_planning_target(_WEEKLY, key=week_start)


@transaction.atomic
def complete_weekly_planning(*, user, week_start) -> WeeklyLog:
    """Registra o marco "planejamento concluído" da semana (não muda ``status``)."""
    return _complete_planning(_WEEKLY, key=week_start)


@transaction.atomic
def start_weekly(*, user, week_start) -> WeeklyLog:
    """Inicia a semana: data ≥ ``week_start`` + planejamento concluído + Weekly
    operacional anterior ``finalized`` (cumulativos)."""
    return _start(_WEEKLY, user=user, key=week_start)


@transaction.atomic
def finalize_weekly(*, user, week_start) -> WeeklyLog:
    """Finaliza a semana — **irreversível**. Exige zero ``pending``/``started`` na
    subárvore completa + próxima semana já registrada em planejamento."""
    return _finalize(_WEEKLY, key=week_start)


@transaction.atomic
def cancel_weekly_planning_target(*, user, week_start) -> WeeklyLog:
    """Cancela o alvo de planejamento vazio — a única transição "para trás".

    Só no Weekly (o Monthly não herda esta ação — M07) e só com ZERO tarefas.
    Zera ``status`` **e** ``planning_completed_at`` sem apagar o log: M06 admite
    "cancelado **e recriado**", e deixar o timestamp sobreviver permitiria recriar
    o alvo e passar o gate de Iniciar sem concluir planejamento de novo.
    """
    log = _get(_WEEKLY, week_start)
    if _status_of(log) is None and log is not None:
        return log  # idempotente: já está fora do regime, nada a escrever
    _check_allowed(log, None)
    if log.tasks.exists():
        raise InvalidTransition(CycleStatus.PLANNING, None)
    log.status = None
    log.planning_completed_at = None
    log.save(update_fields=["status", "planning_completed_at"])
    return log


# --- Monthly (M07) -------------------------------------------------------------
def next_monthly_target(*, user) -> date:
    """Alvo determinístico de "Planejar próximo mês" — sem escolha, sem retargeting.

    É sempre o mês cronologicamente seguinte ao Monthly ``active``. Sem nenhum
    ``active`` (usuário novo, nunca no regime operacional — caso que os spines não
    cobrem), o alvo é o **mês corrente** por ``today_for(user)``: decisão interina
    registrada nas Questões abertas da Story 14.1, coerente com o Weekly, que
    aceita a semana corrente como alvo por regra própria.

    O alvo já existente em ``planning`` vem ANTES das duas regras acima porque é o
    único que preserva a idempotência de "Planejar próximo mês" na janela em que
    não há ``active``: entre ``finalize`` do mês corrente e ``start`` do planejado
    (ordem obrigatória — finalizar exige o próximo já em planejamento), a regra do
    mês corrente devolveria um alvo DIFERENTE do único ``planning`` que existe, e o
    ritual receberia um 409 de disputa de alvo em vez do no-op esperado. Não há
    ambiguidade a resolver: a unique parcial garante no máximo um ``planning``.
    """
    planning = MonthlyLog.objects.filter(status=CycleStatus.PLANNING).first()
    if planning is not None:
        return planning.month_first
    active = MonthlyLog.objects.filter(status=CycleStatus.ACTIVE).first()
    if active is None:
        return today_for(user).replace(day=1)
    return add_months(active.month_first, 1)


@transaction.atomic
def open_monthly_planning_target(*, user) -> MonthlyLog:
    """Abre o próximo mês como alvo de planejamento (alvo determinístico).

    Sem parâmetro de data de propósito: "não existe escolha ou retargeting" (M07).
    Meses pulados exigem materialização sequencial — um ciclo por vez, percorrendo
    planejar → concluir → iniciar → finalizar, sem lote e sem fechamento automático.
    """
    return _open_planning_target(_MONTHLY, key=next_monthly_target(user=user))


@transaction.atomic
def complete_monthly_planning(*, user, month_first) -> MonthlyLog:
    """Registra o marco "planejamento concluído" do mês (não muda ``status``)."""
    return _complete_planning(_MONTHLY, key=month_first)


@transaction.atomic
def start_monthly(*, user, month_first) -> MonthlyLog:
    """Inicia o mês: data ≥ ``month_first`` + planejamento concluído + Monthly
    operacional anterior ``finalized`` (cumulativos)."""
    return _start(_MONTHLY, user=user, key=month_first)


@transaction.atomic
def finalize_monthly(*, user, month_first) -> MonthlyLog:
    """Finaliza o mês — **irreversível**. Exige zero ``pending``/``started`` na
    subárvore completa + o mês SEGUINTE já registrado em planejamento (sem lacuna)."""
    return _finalize(_MONTHLY, key=month_first)
