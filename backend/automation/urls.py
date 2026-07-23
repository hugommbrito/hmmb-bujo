"""URLs da Plataforma de Automação (AD-19): endpoints externos com caminhos
literais SEM barra final.

`POST /api/capture` (Story 12.5) e, no futuro, `GET /api/summary/today`
(Story 12.6) entram aqui. **Sem barra final** de propósito: a AD-19 escreve os
endpoints externos assim e o `APPEND_SLASH` do Django NÃO resgata um POST (só
redireciona GET) — um atalho iOS chama uma URL fixa; a variante com barra errada
daria 404. (Ver Dev Notes › "Rota externa: `/api/capture` sem barra final".)
"""

from django.urls import path

from automation.views import CaptureView

urlpatterns = [
    path("capture", CaptureView.as_view(), name="automation-capture"),
]
