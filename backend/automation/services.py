"""Serviço de composição da captura externa (AD-19 item 3/4, AC1/AC4).

`dispatch_capture` é um **composition service**: recebe o payload já validado e
despacha por `type` para o service de domínio correto. É **HTTP-agnóstico** — não
conhece `Response`/status/`rest_framework`. Tipo desconhecido vira um erro de
domínio (`UnknownCaptureType`) que a **view** traduz em `400` com mensagem clara
(ver Dev Notes › "Fronteira service × HTTP"; espelha `braindump/views.py`, onde a
view mapeia `DoesNotExist` → 404 e o service permanece agnóstico).

**Estender é trivial (AC4, navalha de Occam):** adicionar um tipo de captura é
adicionar **um braço no `match`** — sem tocar modelo, contrato ou registro. NÃO
há padrão de registro/plugin especulativo (Occam 2026-07-23). A ingestão de
Pressão Arterial NÃO passa por aqui — terá endpoint próprio (AD-27), reusando a
mesma auth class.

`automation` é **app de composição** (AD-19 item 4): pode importar
`braindump.services`. O import-linter só proíbe `core` → apps de domínio;
`automation` não é `core`.

`build_today_summary` (Story 12.6) é a segunda composição deste módulo — o
resumo do dia (`GET /api/summary/today`). Composição **pura e read-only**: cada
bloco vem de um service de domínio EXISTENTE (ou, no caso da última reflexão, de
um service novo NO app de domínio — `gratitude.services.get_latest_gratitude_entry`).
NÃO monta queries ad-hoc cross-tenant (`Task.objects…`, `HabitDayEntry.objects…`)
dentro do `automation` — isso é o que a AC2 proíbe; o ponto de leitura correto é
sempre o app de domínio (via seu service ou seu reverse manager escopado).
"""

from braindump.services import create_brain_dump_item
from bujo.models import Task
from bujo.services.logs import get_or_create_daily_log
from core.calendar import today_for
from gratitude.services import get_latest_gratitude_entry
from habits.services import compute_day_completeness


class UnknownCaptureType(ValueError):
    """Erro de domínio (HTTP-agnóstico) para um `type` de captura não suportado.

    Carrega o valor recebido e uma mensagem clara em pt-BR; a view usa
    `str(exc)` como corpo do 400 (`{"type": "Tipo de captura desconhecido: …"}`).
    """

    def __init__(self, type_value: str) -> None:
        self.type_value = type_value
        super().__init__(f"Tipo de captura desconhecido: {type_value}")


def dispatch_capture(*, user, type, text, value=None):
    """Despacha a captura por `type` e retorna o objeto de domínio criado.

    - `"braindump"` → cria um item de Brain Dump via o service EXISTENTE
      `braindump.services.create_brain_dump_item` (o `text` do payload vira o
      `title` do item). Retorna o `BrainDumpItem` criado.
    - qualquer outro `type` → `raise UnknownCaptureType(type)`.

    `value` é aceito na assinatura e **ignorado** na captura de braindump
    (reservado a tipos futuros). Adicionar um tipo = adicionar um braço abaixo,
    sem tocar modelo/contrato (AD-27, Occam).
    """
    match type:
        case "braindump":
            return create_brain_dump_item(user=user, title=text)
        case _:
            raise UnknownCaptureType(type)


def build_today_summary(*, user) -> dict:
    """Resumo agregado do dia do ``user`` (AC1/AC2/AC4) — composição HTTP-agnóstica.

    Retorna **dados brutos** (instâncias/dicts de domínio); a serialização (incl.
    ``null`` quando não há última reflexão, camelCase na borda) fica na view/serializer
    (§6.2/§6.3). Cada bloco deriva de um service de domínio, nunca de query ad-hoc:

    - ``date`` — ``core.calendar.today_for(user)`` (autoridade temporal única do projeto).
    - ``pending_tasks`` — tarefas **raiz** (``parent_task IS NULL``) do Daily Log de hoje
      com status ∈ {``pending``, ``started``} (não-terminais e acionáveis: "o que ainda
      falta hoje"). O log é obtido por ``get_or_create_daily_log`` — o **mesmo caminho
      idempotente** que ``DailyLogView.get`` usa ao abrir o Daily (não é efeito colateral
      novo). O reverse manager ``log.tasks`` já é duplamente escopado (pelo log do dono +
      tenant manager); espelha o ``get_tasks`` do ``LogSerializer`` (só as raízes).
    - ``habits`` — ``compute_day_completeness`` (**read-only**: só LÊ ``habit_day_entries``
      já existentes → ``{total, groups:[{id,name,completion}]}``). **NUNCA** ``seed_habit_day``
      (que ESCREVE): um GET de widget que roda a cada 15–60 min não pode materializar
      entradas de hábito. Dia não semeado → ``total=0``/``groups=[]`` (resposta honesta).
    - ``last_journal_entry`` — ``get_latest_gratitude_entry`` (a ``GratitudeEntry`` mais
      recente ou ``None``). Campo de nome **genérico** (journalling-neutro): a troca de
      fonte gratidão→journalling no Épico 16.11 é sem breaking change.

    ``automation`` (composição, AD-19 item 4) pode importar ``bujo``/``habits``/``gratitude``
    — o import-linter só proíbe ``core`` → apps de domínio. A ingestão de Pressão Arterial
    NÃO passa por aqui (endpoint próprio, AD-27); este endpoint é só leitura de resumo.
    """
    today = today_for(user)
    log = get_or_create_daily_log(user=user, log_date=today)
    pending = log.tasks.filter(
        parent_task__isnull=True,
        status__in=[Task.Status.PENDING, Task.Status.STARTED],
    )
    return {
        "date": today,
        "pending_tasks": list(pending),
        "habits": compute_day_completeness(user=user, date=today),
        "last_journal_entry": get_latest_gratitude_entry(user=user),
    }
