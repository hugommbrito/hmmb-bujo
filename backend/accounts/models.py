import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from accounts.managers import UserManager
from core.models import TenantModel


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"

    def __str__(self) -> str:
        return self.email


class UserHoliday(TenantModel):
    """Feriado manual por data, por usuário (AD-10, Story 6.3).

    A presença da linha ``(user_id, date)`` marca o dia como feriado — feriado é
    pessoal/regional, então mora no perfil (``accounts``). ``core/calendar`` o lê
    (``core → accounts`` é permitido pela regra de porta) e ``habits`` o escreve
    (endpoint/serviço ``set_holiday``; ``habits → accounts`` permitido). O model
    fica "burro": só existência importa.

    Herda ``TenantModel`` (UUID PK + ``user_id`` denormalizado + auto-scope +
    cobertura do gate de isolamento). A AD-10 desenha PK ``(user_id, date)``, mas
    o projeto exige UUID PK + ``user_id`` indexado, então a unicidade vira
    ``UniqueConstraint(user_id, date)`` — mesma reconciliação de ``habit_day_entries``.
    """

    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_holidays"
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "date"],
                name="uniq_user_holiday",
            ),
        ]


class UntrackedCollection(models.TextChoices):
    """Collections que podem ter um dia marcado como "não registrado" (Story 16.2c).

    ``health`` fica de fora de propósito: não tem estatística a excluir. O enum
    vive só no model (``CheckConstraint`` + ``choices``) — **nunca** entra no wire:
    cada endpoint (``habits``/``medications``) fixa a sua collection, então nenhum
    serializer o expõe e o contrato OpenAPI não ganha enum novo.
    """

    HABITS = "habits", "Hábitos"
    MEDICATIONS = "medications", "Medicamentos"


class UntrackedDay(TenantModel):
    """Dia "não registrado" por ``(usuário, data, collection)`` (Story 16.2c).

    Molde de ``UserHoliday``: a **presença** da linha é a flag — o dia sai de toda
    estatística daquela collection (completude nula, fora de todo denominador,
    ponto omitido na série). Nenhuma linha de domínio (``habit_day_entries``,
    ``medication_day_entries``) é apagada ou re-semeada por marcar/desmarcar: o dia
    marcado continua editável e nunca desmarca sozinho.

    Uma tabela só em ``accounts`` (porta já usada por ``UserHoliday``), importável
    pelos dois módulos; ``collection`` dá o escopo por módulo — a flag de Hábitos
    não afeta Medicamentos e vice-versa. Herda ``TenantModel`` (UUID PK +
    ``user_id`` + auto-scope + gate de isolamento); unicidade em
    ``(user_id, date, collection)``.
    """

    date = models.DateField()
    collection = models.CharField(max_length=16, choices=UntrackedCollection.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_untracked_days"
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "date", "collection"],
                name="uniq_user_untracked_day",
            ),
            models.CheckConstraint(
                condition=models.Q(collection__in=UntrackedCollection.values),
                name="user_untracked_day_collection_valid",
            ),
        ]
