"""Apaga usuários de teste E2E e TODAS as suas linhas tenant-scoped.

Usado em dois lugares (story 11.1):

* **Limpeza one-shot da branch de dev** (AC3): rodar uma vez com
  ``DJANGO_SETTINGS_MODULE=config.settings.dev`` para remover os ~200 usuários
  órfãos que os testes acumularam antes do isolamento por branch.
* **Reset da branch `e2e`** (AC2): rodar com
  ``DJANGO_SETTINGS_MODULE=config.settings.e2e`` sempre que a branch dedicada
  acumular lixo. Ver ``docs/e2e-neon-reset.md``.

⚠️ Guardrail crítico (AD-12): ``user_id`` é ``UUIDField`` puro, **não** FK — não
há ``ON DELETE CASCADE``. Apagar o ``User`` sozinho deixaria centenas de
``Task``/logs órfãos. Por isso varremos cada model tenant-scoped por
``user_id`` **antes** de apagar os ``User``.

⚠️ Fora de um request não há tenant no contexto, então o manager ``objects``
(``TenantManager``) falha-fechado e retornaria vazio. Usamos ``all_objects``
(sem escopo) para a varredura cross-tenant.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from bujo.models import Log, MonthlyLog, RecurringTaskTemplate, Task, WeeklyLog

# Padrão único e estável de e-mail de teste (frontend/e2e/fixtures.ts):
# `e2e-${uuid}@e2e.test`. O e-mail real do usuário não casa este sufixo.
E2E_EMAIL_SUFFIX = "@e2e.test"

# Todos os models tenant-scoped (subclasses de TenantModel). Enumerados
# explicitamente — para uma operação destrutiva, explícito > descoberta
# dinâmica. Se um novo model tenant-scoped surgir, ele PRECISA entrar aqui.
TENANT_MODELS = [Task, Log, WeeklyLog, MonthlyLog, RecurringTaskTemplate]


class Command(BaseCommand):
    help = "Apaga usuários de teste E2E (@e2e.test) e suas linhas tenant-scoped."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Só conta o que seria apagado; não apaga nada.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        user_ids = list(
            User.objects.filter(email__endswith=E2E_EMAIL_SUFFIX).values_list(
                "id", flat=True
            )
        )
        user_count = len(user_ids)

        self.stdout.write(
            f"Usuários de teste (email termina em '{E2E_EMAIL_SUFFIX}'): {user_count}"
        )

        # Contagem por model tenant-scoped (all_objects → sem escopo de tenant).
        for model in TENANT_MODELS:
            count = model.all_objects.filter(user_id__in=user_ids).count()
            self.stdout.write(f"  {model.__name__}: {count} linhas")

        if user_count == 0:
            self.stdout.write(self.style.SUCCESS("Nada a apagar."))
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING("--dry-run: nenhuma linha foi apagada.")
            )
            return

        with transaction.atomic():
            for model in TENANT_MODELS:
                deleted, _ = model.all_objects.filter(user_id__in=user_ids).delete()
                self.stdout.write(f"  {model.__name__}: {deleted} apagadas")
            users_deleted, _ = User.objects.filter(id__in=user_ids).delete()
            self.stdout.write(f"  User: {users_deleted} apagados")

        remaining = User.objects.filter(email__endswith=E2E_EMAIL_SUFFIX).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Limpeza concluída. Usuários de teste restantes: {remaining}"
            )
        )
