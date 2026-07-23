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
"""

from braindump.services import create_brain_dump_item


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
