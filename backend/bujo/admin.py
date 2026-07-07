"""Admin de operador para `Log`/`Task` (AD-12): usa `all_objects` — caminho
explícito, sem tenant context — porque o admin não roda dentro de um request
autenticado como usuário de negócio. Único jeito de atribuir `category` a
tarefas de seed até a UI de edição chegar na Story 3.3.
"""

from django.contrib import admin

from bujo.models import Log, Task


@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "log_date")
    list_filter = ("log_date",)
    search_fields = ("id", "user_id")

    def get_queryset(self, request):
        return Log.all_objects.all()


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "category", "eisenhower", "log", "order_index")
    list_filter = ("status", "category", "eisenhower")
    search_fields = ("id", "title", "user_id")

    def get_queryset(self, request):
        return Task.all_objects.all()
