"""Admin de operador para `AutomationToken` (AD-19 item 1, AC2 da Story 12.4).

Gestão inicial dos tokens é via Django admin (UI própria é story futura, fora de
escopo). O operador cria um token escolhendo `user`, `name` e `scopes`; o
**token pleno é exibido uma única vez** na criação (padrão GitHub PAT) via
`messages` — nunca reaparece e **nunca é logado**. Depois, cada token é
identificado pelo `token_prefix` e pode ser revogado (setando `revoked_at`).

Diferença vs. os admins de operador dos apps de domínio (ex.: `braindump/admin.py`,
`accounts/admin.py`): aqueles usam `all_objects` para escapar do manager
fail-closed do `TenantModel`. `AutomationToken` **não** é `TenantModel` (é uma
credencial de auth, plain `models.Model`), então `objects` já é o manager padrão
do Django, sem fail-closed — o admin lê a tabela inteira normalmente, sem
precisar de `all_objects`. Ver Dev Notes da Story 12.4.
"""

from django import forms
from django.contrib import admin, messages

from automation.models import AutomationScope, AutomationToken
from core.calendar import now


class AutomationTokenAdminForm(forms.ModelForm):
    """Form do admin: o operador escolhe `scopes` por checkboxes, nunca digita
    `token_hash`/`token_prefix` (derivados na geração — ver `save_model`)."""

    scopes = forms.MultipleChoiceField(
        choices=AutomationScope.choices,
        widget=forms.CheckboxSelectMultiple,
        required=False,
        help_text="Escopos concedidos a este token.",
    )

    class Meta:
        model = AutomationToken
        fields = ["user", "name", "scopes", "revoked_at"]


@admin.register(AutomationToken)
class AutomationTokenAdmin(admin.ModelAdmin):
    form = AutomationTokenAdminForm
    list_display = (
        "id",
        "user",
        "name",
        "token_prefix",
        "scopes",
        "last_used_at",
        "revoked_at",
        "created_at",
    )
    list_filter = ("revoked_at",)
    search_fields = ("token_prefix", "name", "user__email")
    readonly_fields = ("token_prefix", "token_hash", "last_used_at", "created_at")
    actions = ["revogar_tokens"]

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            # Tela de "add": só o que o operador informa. Os campos derivados
            # (prefix/hash) e `revoked_at` só fazem sentido depois da criação.
            return ((None, {"fields": ("user", "name", "scopes")}),)
        return (
            (None, {"fields": ("user", "name", "scopes")}),
            ("Segredo (derivado — só leitura)", {"fields": ("token_prefix", "token_hash")}),
            ("Estado", {"fields": ("revoked_at", "last_used_at", "created_at")}),
        )

    def get_readonly_fields(self, request, obj=None):
        # `user` é imutável após a criação — trocar o dono de uma credencial
        # existente não faz sentido (e o segredo já foi entregue àquele dono).
        if obj is not None:
            return (*self.readonly_fields, "user")
        return self.readonly_fields

    def save_model(self, request, obj, form, change):
        """Na criação, gera o segredo via `AutomationToken.issue()` e exibe o
        pleno uma única vez; na edição, nunca regenera (só persiste os campos
        editáveis: `name`, `scopes`, `revoked_at`).

        Abordagem escolhida (das duas documentadas na story): chamar `issue()`
        (que faz o `create`) e copiar os campos derivados + `pk` para o `obj` do
        admin, **sem** chamar `super().save_model()` na criação — assim a linha é
        gravada uma única vez (via `issue()`) e nunca com hash vazio.
        """
        if not change:
            instance, full = AutomationToken.issue(
                user=form.cleaned_data["user"],
                name=form.cleaned_data["name"],
                scopes=form.cleaned_data.get("scopes", []),
            )
            # Reconcilia o obj do admin com a linha recém-criada (para o redirect
            # de "add", o log de admin e qualquer save_related de m2m — aqui não há).
            obj.pk = instance.pk
            obj.id = instance.id
            obj.token_prefix = instance.token_prefix
            obj.token_hash = instance.token_hash
            obj.created_at = instance.created_at
            # Exibição única do pleno — NUNCA logado, só na sessão do admin.
            self.message_user(
                request,
                f"Token (copie agora, não será exibido novamente): {full}",
                level=messages.WARNING,
            )
        else:
            super().save_model(request, obj, form, change)

    @admin.action(description="Revogar tokens selecionados")
    def revogar_tokens(self, request, queryset):
        revogados = queryset.filter(revoked_at__isnull=True).update(revoked_at=now())
        self.message_user(request, f"{revogados} token(s) revogado(s).", level=messages.INFO)
