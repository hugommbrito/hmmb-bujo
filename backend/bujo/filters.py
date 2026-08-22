"""FilterSets do app `bujo` (Story 12.2, AC3, §6.3).

O sistema não expõe um endpoint plano `GET /api/tasks/`: tarefas são servidas
aninhadas dentro de `LogSerializer`/`WeeklyLogSerializer`/... e das filas, todas
`APIView` (não `GenericAPIView`/`ViewSet`), então o `DjangoFilterBackend` de
`DEFAULT_FILTER_BACKENDS` não se aplica automaticamente. django-filter suporta
uso *standalone* — instanciar o `FilterSet` diretamente sobre um queryset:
`TaskFilter(query_params, queryset=roots, request=request).qs`.
"""

import django_filters

from bujo.models import Task


class TaskFilter(django_filters.FilterSet):
    """Filtro reutilizável de `Task`. Nesta story só o Daily Log o consome; a
    adoção em Weekly/Monthly/filas é do Épico 17 (spec 17.0).

    Convenção da borda: nome do parâmetro em camelCase (`?waitingOn=`, §6.1/§6.3)
    mapeado à coluna snake_case `waiting_on`. `BooleanFilter` aceita `true`/`false`;
    parâmetro ausente = sem filtro. Filtro declarado entra independentemente de
    `Meta.fields` (por isso `fields = []`).
    """

    waitingOn = django_filters.BooleanFilter(field_name="waiting_on")

    class Meta:
        model = Task
        fields = []
