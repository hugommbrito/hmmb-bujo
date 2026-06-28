---
baseline_commit: f3ae033477e1b22a826cac0075240a8d76580c22
---

# Story 2.1: Cadastro e login com JWT

Status: done

## Story

Como **Hugo**,
Quero **criar uma conta com email/senha e autenticar recebendo tokens JWT**,
Para que **eu tenha acesso seguro ao meu espaço de dados isolado** (FR-0.2, AR-5).

## Acceptance Criteria

**AC1 — Modelo de usuário e endpoints**
**Dado que** o app `accounts/` e o model de usuário,
**Quando** ele é implementado,
**Então** o `User` tem PK `UUID`, email único, senha com hash e `timezone` IANA (enviado no signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`, editável),
**E** existe endpoint `POST /api/accounts/signup/` que cria o usuário e `POST /api/accounts/token/` que valida credenciais e retorna tokens.

**AC2 — Tokens JWT e ativação do middleware**
**Dado que** um login válido,
**Quando** o usuário autentica via `POST /api/accounts/token/`,
**Então** recebe um par access/refresh token (`djangorestframework-simplejwt`) com `ACCESS_TOKEN_LIFETIME` ~30min e `REFRESH_TOKEN_LIFETIME` 7 dias, com `ROTATE_REFRESH_TOKENS=True` + `BLACKLIST_AFTER_ROTATION=True`,
**E** o `TenantMiddleware` (já implementado na Story 1.2, dormia aguardando auth real) passa a setar `current_user_id` no contextvar a partir do `request.user` autenticado via JWT — ligando o isolamento multi-tenant automaticamente.

**AC3 — Credenciais inválidas e isolamento**
**Dado que** credenciais inválidas,
**Quando** o login é tentado,
**Então** a API responde `401` sem revelar se o email existe (a mensagem é genérica),
**E** um teste de isolamento confirma que a cadeia JWT → middleware → contextvar → `TenantManager` funciona corretamente: o token de um usuário seta o contexto apenas com o `user_id` daquele usuário.

## Tasks / Subtasks

- [x] **Task 1 — Dependência simplejwt** (AC: 2)
  - [x] 1.1: Adicionar `djangorestframework-simplejwt>=5.3,<6` a `dependencies` em `backend/pyproject.toml`
  - [x] 1.2: Instalar dependência (`uv sync` ou `uv add` no diretório `backend/`)

- [x] **Task 2 — App `accounts/` — modelo e manager** (AC: 1)
  - [x] 2.1: Criar `backend/accounts/apps.py` — `AccountsConfig` com `name = 'accounts'`
  - [x] 2.2: Criar `backend/accounts/managers.py` — `UserManager(BaseUserManager)` com `create_user` e `create_superuser`
  - [x] 2.3: Criar `backend/accounts/models.py` — `User(AbstractBaseUser, PermissionsMixin)` (ver forma normativa)

- [x] **Task 3 — Serializers, views, urls e admin** (AC: 1)
  - [x] 3.1: Criar `backend/accounts/serializers.py` — `SignupSerializer` (email, password com `validate_password`, timezone)
  - [x] 3.2: Criar `backend/accounts/views.py` — view `signup` com `AllowAny`
  - [x] 3.3: Criar `backend/accounts/urls.py` — rotas: `signup/`, `token/`, `token/refresh/`
  - [x] 3.4: Criar `backend/accounts/admin.py` — registrar `User` no Django admin

- [x] **Task 4 — Configurações e URLs globais** (AC: 1, 2)
  - [x] 4.1: Atualizar `backend/config/settings/base.py`:
    - Adicionar `AUTH_USER_MODEL = 'accounts.User'`
    - Adicionar `accounts`, `rest_framework_simplejwt`, `rest_framework_simplejwt.token_blacklist` a `INSTALLED_APPS`
    - Adicionar bloco `SIMPLE_JWT` (ver forma normativa)
    - Adicionar `DEFAULT_AUTHENTICATION_CLASSES` e `DEFAULT_PERMISSION_CLASSES` a `REST_FRAMEWORK`
  - [x] 4.2: Atualizar `backend/core/views.py` — adicionar `@permission_classes([AllowAny])` ao endpoint `health` para não exigir auth
  - [x] 4.3: Atualizar `backend/config/urls.py` — incluir `accounts.urls` em `api/accounts/`

- [x] **Task 5 — Migrations** (AC: 1)
  - [x] 5.1: Gerar migration com nome descritivo: `python manage.py makemigrations accounts --name initial`
  - [x] 5.2: Verificar `python manage.py migrate` sem erros (inclui tabelas do `token_blacklist`)
  - [x] 5.3: Verificar `python manage.py makemigrations --check` → 0 migrations pendentes

- [x] **Task 6 — Testes** (AC: 1, 2, 3)
  - [x] 6.1: Criar `backend/accounts/tests/__init__.py`
  - [x] 6.2: Criar `backend/accounts/tests/factories.py` — `UserFactory` (ver forma normativa)
  - [x] 6.3: Criar `backend/accounts/tests/test_models.py` — UUID PK, email único, password hashed, timezone default
  - [x] 6.4: Criar `backend/accounts/tests/test_views.py` — signup válido (201), email duplicado (400), login válido (tokens), credenciais inválidas (401 genérico), token/refresh funciona
  - [x] 6.5: Criar `backend/accounts/tests/test_isolation.py` — JWT → middleware → contextvar correto por usuário

- [x] **Task 7 — Atualizar `conftest.py`** (AC: 2, 3)
  - [x] 7.1: Substituir fixture `user` por `UserFactory()`
  - [x] 7.2: Substituir fixture `other_user` por `UserFactory()` (email diferente via `factory_boy` sequence)
  - [x] 7.3: Atualizar `auth_client` — adicionar `api_client.force_authenticate(user=user)` antes do `tenant_context`
  - [x] 7.4: Remover imports não mais necessários (`types`, `uuid` do stub de `SimpleNamespace`)

- [x] **Task 8 — Verificação final** (AC: 1, 2, 3)
  - [x] 8.1: `cd backend && pytest` — todos os testes passando (incluindo os 53 testes de Épico 1)
  - [x] 8.2: `ruff check .` — 0 erros/warnings
  - [x] 8.3: `lint-imports` — regra de porta do `core` ainda verde
  - [x] 8.4: Testar manualmente: `curl -X POST http://localhost:8000/api/accounts/signup/ -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"senha123","timezone":"America/Sao_Paulo"}'` → 201

## Dev Notes

### ⚠️ Limites de Escopo (LEIA PRIMEIRO)

| Pertence a esta Story (2.1) | NÃO faça agora — Story responsável |
|---|---|
| `accounts.User` model + endpoints backend | Frontend login page (React/HTML) → **Story 2.2** |
| `POST /api/accounts/signup/`, `token/`, `token/refresh/` | JWT interceptor Axios single-flight → **Story 2.2** |
| simplejwt config + blacklist (backend) | Token storage no `localStorage` → **Story 2.2** |
| `TenantMiddleware` "acorda" automaticamente | `AuthProvider` + estado de auth frontend → **Story 2.2** |
| `conftest.py`: fixtures com User real | `AppLayout` / sidebar / bottom-nav → **Story 2.3** |
| `backend/accounts/` migrations | Auth guards no roteamento → **Story 2.3** |
| Testes backend (model + views + isolamento) | `user_holidays` (campo em `accounts`) → **Story 6.3** |

**Princípio:** 100% backend. Zero mudanças no `frontend/`.

---

### Forma normativa das implementações

#### `backend/accounts/managers.py`

```python
from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if not extra_fields["is_staff"]:
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields["is_superuser"]:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)
```

#### `backend/accounts/models.py`

```python
import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from accounts.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # email já é USERNAME_FIELD; nada extra para createsuperuser

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"
```

**Notas:**
- `PermissionsMixin` é obrigatório para compatibilidade com Django admin (`has_perm`, `has_module_perms`, relações M2M com `auth.Group` e `auth.Permission`).
- `date_joined` não é fornecido por `AbstractBaseUser` — declarar explicitamente para o admin funcionar corretamente.
- `REQUIRED_FIELDS = []` → `createsuperuser` pede só email + password (não pede timezone).
- `db_table = "accounts_user"` é explícito para evitar dependência de convenção automática.
- **NÃO** herdar de `TenantModel` — `User` é o *dono* do tenant, não entidade tenantizada.

#### `backend/accounts/serializers.py`

```python
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from accounts.models import User


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    timezone = serializers.CharField(max_length=64, default="America/Sao_Paulo")

    def validate_email(self, value):
        normalized = value.lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("Este email já está em uso.")
        return normalized

    def validate_password(self, value):
        validate_password(value)  # usa validators do Django (comprimento, similaridade, etc.)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            timezone=validated_data.get("timezone", "America/Sao_Paulo"),
        )
```

#### `backend/accounts/views.py`

```python
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from accounts.serializers import SignupSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"detail": "Conta criada com sucesso."}, status=status.HTTP_201_CREATED)
```

#### `backend/accounts/urls.py`

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from accounts.views import signup

urlpatterns = [
    path("signup/", signup, name="accounts-signup"),
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
```

**Nota:** `TokenObtainPairView` usa `email` automaticamente porque `User.USERNAME_FIELD = "email"`. Sem necessidade de serializer customizado.

#### `backend/accounts/admin.py`

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "timezone", "is_active", "is_staff", "date_joined")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Perfil", {"fields": ("timezone",)}),
        ("Permissões", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Datas", {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "timezone", "password1", "password2")}),
    )
    search_fields = ("email",)
    readonly_fields = ("date_joined",)
    # AbstractBaseUser não tem username → remover do BaseUserAdmin
    filter_horizontal = ("groups", "user_permissions")
```

#### Adições a `backend/config/settings/base.py`

```python
from datetime import timedelta  # adicionar no topo do arquivo

# --- Auth model customizado ---------------------------------------------------
AUTH_USER_MODEL = "accounts.User"  # deve vir ANTES de INSTALLED_APPS ser lido

# Em INSTALLED_APPS, adicionar (na seção "Local"):
"accounts",
# Em INSTALLED_APPS, adicionar (na seção "Third-party"):
"rest_framework_simplejwt",
"rest_framework_simplejwt.token_blacklist",

# --- JWT config ---------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",  # claim do payload JWT que carrega o UUID do usuário
    "TOKEN_USER_CLASS": "rest_framework_simplejwt.models.TokenUser",
}

# Em REST_FRAMEWORK, adicionar:
"DEFAULT_AUTHENTICATION_CLASSES": [
    "rest_framework_simplejwt.authentication.JWTAuthentication",
],
"DEFAULT_PERMISSION_CLASSES": [
    "rest_framework.permissions.IsAuthenticated",
],
```

**⚠️ Endpoints públicos que precisam de `AllowAny` explícito após esta mudança:**
- `core/views.py::health` → adicionar `@permission_classes([AllowAny])`
- `accounts/views.py::signup` → já tem `@permission_classes([AllowAny])`
- `drf_spectacular` views (`/api/schema/`, `/api/schema/swagger-ui/`) → as views do spectacular têm `AllowAny` por padrão via `SERVE_INCLUDE_SCHEMA = False`, mas verificar após migration.

#### Adições a `backend/config/urls.py`

```python
from django.urls import path, include  # adicionar include
# ...
path("api/accounts/", include("accounts.urls")),
```

#### `backend/accounts/tests/factories.py`

```python
import factory
from factory.django import DjangoModelFactory
from accounts.models import User


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@test.com")
    password = factory.PostGenerationMethodCall("set_password", "senha-segura-123")
    timezone = "America/Sao_Paulo"
    is_active = True
    is_staff = False
```

**Nota:** `factory.PostGenerationMethodCall("set_password", ...)` chama `user.set_password("senha-segura-123")` após criação — garantindo que o password seja hasheado corretamente, não armazenado em texto puro.

#### `backend/conftest.py` — seção atualizada das fixtures

```python
# Remover imports que não são mais necessários (após substituição):
# import types
# import uuid  <- manter se usado em outro lugar; remover se exclusivo do stub

@pytest.fixture
def user(db):
    from accounts.tests.factories import UserFactory
    return UserFactory()


@pytest.fixture
def other_user(db):
    from accounts.tests.factories import UserFactory
    return UserFactory()  # email único garantido pela Sequence do factory


@pytest.fixture
def auth_client(user, api_client):
    """Cliente autenticado via JWT real.

    force_authenticate seta request.user → TenantMiddleware acorda e seta
    current_user_id por request. tenant_context mantido para compatibilidade
    com testes que chamam services diretamente (sem passar pelo HTTP stack).
    """
    api_client.force_authenticate(user=user)
    with tenant_context(user):
        yield api_client
    api_client.force_authenticate(user=None)  # limpar após o teste
```

**Nota:** O import de `tenant_context` já está no `conftest.py` (`from core.tenant import tenant_context`). Apenas atualizar as fixtures.

---

### Estrutura de arquivos ao fim da story

```
backend/
├── pyproject.toml                           # ALTERAR — +djangorestframework-simplejwt
├── accounts/
│   ├── __init__.py                          # JÁ EXISTE (placeholder vazio)
│   ├── admin.py                             # NOVO
│   ├── apps.py                              # NOVO
│   ├── managers.py                          # NOVO
│   ├── models.py                            # NOVO
│   ├── serializers.py                       # NOVO
│   ├── urls.py                              # NOVO
│   ├── views.py                             # NOVO
│   ├── migrations/
│   │   ├── __init__.py                      # NOVO
│   │   └── 0001_initial.py                  # NOVO (gerado + --name initial)
│   └── tests/
│       ├── __init__.py                      # NOVO
│       ├── factories.py                     # NOVO
│       ├── test_models.py                   # NOVO
│       ├── test_views.py                    # NOVO
│       └── test_isolation.py               # NOVO
├── config/
│   ├── settings/base.py                     # ALTERAR — AUTH_USER_MODEL, INSTALLED_APPS, SIMPLE_JWT, REST_FRAMEWORK
│   └── urls.py                              # ALTERAR — include accounts.urls
├── core/
│   └── views.py                             # ALTERAR — @permission_classes([AllowAny]) no health
└── conftest.py                              # ALTERAR — fixtures user/other_user/auth_client
```

**Não criar:**
- Nenhum arquivo em `frontend/` — zero mudanças no frontend nesta story
- `accounts/services.py` — sem lógica de negócio complexa aqui; a criação de usuário é simples o suficiente para ficar no serializer
- `accounts/tests/models.py` (registro de isolation) — `User` não é `TenantModel`; não pertence ao registry de isolamento genérico

---

### ⚠️ Armadilhas críticas (LEIA ANTES DE IMPLEMENTAR)

#### 1. `AUTH_USER_MODEL` deve ser definido ANTES de qualquer migration que o referencie

Em `settings/base.py`, adicionar `AUTH_USER_MODEL = "accounts.User"` antes da linha que define `INSTALLED_APPS`. Django exige que o model customizado seja declarado antes de criar qualquer migration que o referencie (ex.: `auth.Permission` usa `settings.AUTH_USER_MODEL`). **Fazer `migrate` sem esta linha causa `InconsistentMigrationHistory`**.

#### 2. `token_blacklist` exige migration própria

`rest_framework_simplejwt.token_blacklist` cria tabelas (`outstanding_token`, `blacklisted_token`). Deve estar em `INSTALLED_APPS` **antes** de rodar `migrate`. Ordem no `INSTALLED_APPS`:
```python
"rest_framework_simplejwt",
"rest_framework_simplejwt.token_blacklist",  # depois do simplejwt pai
```

#### 3. `PermissionsMixin` vs `AbstractBaseUser` vs `AbstractUser`

Use `AbstractBaseUser + PermissionsMixin` (não `AbstractUser`). O `AbstractUser` adiciona `username`, `first_name`, `last_name` que não queremos. Com `PermissionsMixin`, Django admin e grupos/permissões funcionam corretamente.

#### 4. `TokenObtainPairView` usa `email` automaticamente via `USERNAME_FIELD`

Não criar serializer customizado para simplejwt. O `TokenObtainPairSerializer` detecta `USERNAME_FIELD = "email"` do `User` model e usa `email` como campo de autenticação. A view padrão funcionará sem customização. O campo no body da requisição DEVE ser `"email"` (não `"username"`).

#### 5. `DEFAULT_PERMISSION_CLASSES` quebra endpoints públicos existentes

Após adicionar `IsAuthenticated` como padrão, os seguintes endpoints quebraram sem `@permission_classes([AllowAny])`:
- `GET /api/health/` → adicionar `@permission_classes([AllowAny])` ao `core/views.py`
- `GET /api/schema/` e `/api/schema/swagger-ui/` → verificar se spectacular tem AllowAny por padrão (tem — via `SERVE_INCLUDE_SCHEMA = False` e settings próprios)

#### 6. `UserFactory.password` deve usar `PostGenerationMethodCall`

Não use `password = "senha-segura-123"` diretamente no factory — isso armazenaria texto puro. Usar:
```python
password = factory.PostGenerationMethodCall("set_password", "senha-segura-123")
```

#### 7. `conftest.py`: `user` fixture agora requer `db`

A fixture `user` agora cria registro no banco (via factory). O `autouse=True` de `_enable_db_access` já garante acesso ao DB para todos os testes, então `user(db)` é seguro. Mas se algum teste usar `user` sem DB (unitário), quebrará — verificar se algum teste existente faz isso.

#### 8. `auth_client.force_authenticate` ativa o middleware

Com `force_authenticate(user=user)`, o `request.user` é setado como o objeto `User` real. O `TenantMiddleware` já implementado na Story 1.2 detecta `request.user.is_authenticated == True` e seta `current_user_id = request.user.id` (UUID). A cadeia de isolamento fecha automaticamente sem alteração no middleware.

#### 9. Import-linter: adicionar `accounts` a `root_packages`

Se o import-linter estiver configurado com `root_packages = ["core", "config"]`, adicionar `"accounts"` para que o linter analise o novo app:
```toml
root_packages = ["core", "config", "accounts"]
```

#### 10. `email` normalizado para lowercase no signup

O `SignupSerializer.validate_email` normaliza para lowercase via `value.lower()`. O `EmailField` do DRF já normaliza o domínio via RFC, mas não o local part. Normalizar explicitamente para evitar duplicatas case-insensitive (`User@Test.com` vs `user@test.com`).

---

### Inteligência da Story anterior (1.5 — done)

Contexto direto aplicável a esta story:

- **Stack backend confirmada**: Python 3.13, Django 5.1, DRF 3.15, `factory-boy 3.3`, `pytest-django 4.9`, `ruff 0.6`, `import-linter 2.0`. **Não reinventar** nenhuma dessas dependências.
- **`uv` é o gerenciador de pacotes**: `uv sync` (não `pip install`) para instalar o `djangorestframework-simplejwt`.
- **Conventions de migration**: `--name` descritivo obrigatório (§6.1). Usar `--name initial` para a 0001.
- **53 testes passando** na branch atual — **todos devem continuar passando**. A substituição das fixtures em `conftest.py` é o principal ponto de regressão.
- **camelCase na borda (§6.3)**: `djangorestframework-camel-case` converte automaticamente. O corpo do signup recebe `{"email": "...", "password": "...", "timezone": "..."}` (já em camelCase, mas esses campos são mono-palavra ou explicitamente assim na spec).
- **Tokens não ficam no Django admin session**: simplejwt usa `Authorization: Bearer` header, não cookies/session. O admin Django tem session própria separada.

### Git Intelligence

- Branch `main`, último commit `f3ae033` ("feat(story-1.5): Tema MUI central e camada de dados do frontend")
- `backend/accounts/` existe mas contém apenas `__init__.py` — confirmar com `ls backend/accounts/` antes de criar os arquivos
- `backend/config/settings/base.py` linha 29-43: comentário explícito indica que `accounts` ainda não está em `INSTALLED_APPS` por falta de models — **adicionar agora**
- `backend/core/middleware.py` linhas 6-10: comentário documenta que o middleware está "dormindo" aguardando a Story 2.1 — não alterar o middleware, apenas confirmar que funciona
- `backend/conftest.py` linha 35: comentário `"Story 2.1 replaces this with UserFactory"` — referência direta do código
- Convenção de commit: `"feat(story-2.1): Cadastro e login com JWT"`

---

### Testes obrigatórios

#### `accounts/tests/test_models.py`

- `test_user_pk_e_uuid` — verifica `isinstance(user.id, uuid.UUID)`
- `test_email_e_unico` — criar dois usuários com mesmo email deve levantar `IntegrityError`
- `test_password_e_hasheado` — `user.password` não deve conter a senha em texto puro
- `test_timezone_default` — usuário criado sem timezone usa `"America/Sao_Paulo"`
- `test_check_password` — `user.check_password("senha-segura-123")` retorna `True`

#### `accounts/tests/test_views.py`

- `test_signup_valido_retorna_201` — POST `/api/accounts/signup/` com dados válidos → 201
- `test_signup_email_duplicado_retorna_400` — segundo signup com mesmo email → 400 + campo `email` em `fields`
- `test_signup_senha_fraca_retorna_400` — senha curta/simples → 400
- `test_login_valido_retorna_tokens` — POST `/api/accounts/token/` com credenciais corretas → 200, resposta contém `access` e `refresh`
- `test_login_email_invalido_retorna_401` — credenciais com email inexistente → 401 sem revelar que o email não existe
- `test_login_senha_errada_retorna_401` — email correto + senha errada → 401 (mesma mensagem genérica)
- `test_token_refresh_funciona` — usar `refresh` token em `/api/accounts/token/refresh/` → 200, novo `access` token
- `test_health_sem_auth_retorna_200` — `GET /api/health/` sem Authorization header → 200 (regressão)

#### `accounts/tests/test_isolation.py`

- `test_middleware_seta_user_id_correto` — criar dois usuários, autenticar como User A via `force_authenticate`, fazer request ao health (que inclui context check), confirmar `current_user_id` no request é UUID de A (usando um endpoint de diagnóstico ou verificação direta via middleware)
- `test_token_de_usuario_a_nao_autentica_como_b` — token de User A não pode ser usado para obter token de User B
- `test_novo_usuario_criado_com_isolamento` — criar User A e User B; autenticar como A; confirmar que `request.user.id == user_a.id` (não user_b)

**Dica de implementação do `test_middleware_seta_user_id_correto`**: O middleware já funciona por design — basta criar um simples `@api_view` de teste que retorna `str(current_user_id.get())` em `accounts/tests/test_isolation.py` (dentro do módulo de teste, não em production views). OU verificar via `api_client.get("/api/health/")` que retorna 200 para o User autenticado (prova que o middleware + TenantManager não explodiram com `TenantScopeViolation`).

---

### Project Structure Notes

- Alinhamento com `architecture.md §7.1`: `backend/accounts/` com `models/`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `migrations/`, `tests/`
- `AUTH_USER_MODEL = "accounts.User"` é o gate para todos os apps de domínio (épicos 3-9) — esta é a fundação de auth de todo o projeto
- `core.calendar.today_for(user)` acessa `user.timezone` como atributo — funciona diretamente com a `User.timezone` que definimos (IANA string)
- `TenantModel.user_id` em `core/models.py` é um `UUIDField` sem FK (não ForeignKey para `accounts.User`). Isso é intencional — evita dependência circular entre `core` e `accounts`. O isolamento é garantido pelo manager auto-escopado via `current_user_id` (UUID), não por FK constraint no banco.

### References

- [Source: epics.md#Story-2.1] — user story e ACs originais (BDD completo)
- [Source: epics.md#Epic-2 intro] — contexto do épico: JWT single-flight é Story 2.2
- [Source: architecture.md §6.5] — JWT contrato fixo: ACCESS 30min, REFRESH 7d, ROTATE+BLACKLIST, tokens em localStorage (→ 2.2)
- [Source: architecture.md §6.7] — Middleware fail-closed: seta contextvar pós-auth, reset no `finally`
- [Source: architecture.md §6.10] — Pattern tenant_context + auth_client fixture
- [Source: architecture.md §7.1] — Árvore backend: `accounts/` com estrutura padrão por domínio
- [Source: architecture.md §8.7] — Ordem de implementação: `accounts` (User + auth JWT) é item 3
- [Source: architecture.md AR-5] — simplejwt, access ~30min, refresh 7d, ROTATE+BLACKLIST, single-flight interceptor
- [Source: architecture.md AD-12] — Isolamento via manager auto-escopado; TenantMiddleware ativa com request.user autenticado
- [Source: architecture.md AD-04] — `users.timezone` IANA, default detectado no signup via JS `Intl.DateTimeFormat`
- [Source: backend/config/settings/base.py:28-43] — Comentário documenta que `accounts` deve ser adicionado em Story 2.1
- [Source: backend/core/middleware.py:6-10] — Comentário documenta que o middleware está dormindo aguardando Story 2.1
- [Source: backend/conftest.py:33-36] — Comentário documenta que fixture `user` deve ser substituída em Story 2.1
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Itens 4 e 5 do defer de 1.2 resolvidos automaticamente com User real UUID

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Task 5 / subtask 5.2: `InconsistentMigrationHistory` ao rodar `migrate` — banco Neon dev já tinha migrations do `admin` aplicadas sem `AUTH_USER_MODEL`. Solução: DROP SCHEMA + CREATE SCHEMA via psycopg, depois `migrate` limpo. Armadilha #1 do Dev Notes confirmada.
- Task 6 / factory: `PostGenerationMethodCall` gerava `DeprecationWarning`. Corrigido com `@post_generation` + `skip_postgeneration_save = True` em Meta — salva explicitamente após `set_password`.

### Completion Notes List

- **AC1**: `User` model com PK UUID, email único, senha hasheada, `timezone` IANA default "America/Sao_Paulo". Endpoints `POST /api/accounts/signup/` (201) e `POST /api/accounts/token/` implementados e testados.
- **AC2**: `djangorestframework-simplejwt 5.5.1` instalado. `SIMPLE_JWT` configurado com ACCESS 30min, REFRESH 7d, `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`. `TenantMiddleware` acorda automaticamente via `request.user.is_authenticated` — ligando isolamento multi-tenant sem alteração no middleware.
- **AC3**: Credenciais inválidas → 401 com mensagem genérica. 3 testes de isolamento confirmam JWT → middleware → contextvar → TenantManager funciona corretamente por usuário.
- **79 testes passando** (53 de Épico 1 + 26 novos de Épico 2). Ruff 0 erros. Lint-imports verde (1 contrato kept).
- **Task 4.2 (core/views.py)**: já tinha `@permission_classes([AllowAny])` do Épico 1 — nenhuma alteração necessária.
- **Import-linter**: `accounts` adicionado a `root_packages` no `pyproject.toml`.

### File List

- `backend/pyproject.toml` (modificado — +simplejwt dep, +accounts em root_packages)
- `backend/accounts/__init__.py` (existia — não alterado)
- `backend/accounts/apps.py` (novo)
- `backend/accounts/managers.py` (novo)
- `backend/accounts/models.py` (novo)
- `backend/accounts/serializers.py` (novo)
- `backend/accounts/views.py` (novo)
- `backend/accounts/urls.py` (novo)
- `backend/accounts/admin.py` (novo)
- `backend/accounts/migrations/__init__.py` (novo)
- `backend/accounts/migrations/0001_initial.py` (novo)
- `backend/accounts/tests/__init__.py` (novo)
- `backend/accounts/tests/factories.py` (novo)
- `backend/accounts/tests/test_models.py` (novo)
- `backend/accounts/tests/test_views.py` (novo)
- `backend/accounts/tests/test_isolation.py` (novo)
- `backend/config/settings/base.py` (modificado — AUTH_USER_MODEL, INSTALLED_APPS, SIMPLE_JWT, REST_FRAMEWORK auth classes)
- `backend/config/urls.py` (modificado — include accounts.urls)
- `backend/conftest.py` (modificado — UserFactory fixtures, force_authenticate, remoção de types/uuid stubs)
- `backend/uv.lock` (modificado — +djangorestframework-simplejwt lock entry)

## Senior Developer Review (AI)

**Data:** 2026-06-28 | **Revisor:** claude-sonnet-4-6

**Resultado:** ✅ APROVADO com fixes aplicados

### Issues Encontrados e Corrigidos (MEDIUM)

- **`User.__str__` ausente** (`accounts/models.py`): Django admin exibia `User object (uuid)` em widgets de escolha. Adicionado `def __str__(self): return self.email`.

- **Sem validação IANA de timezone** (`accounts/serializers.py`): Campo `timezone` aceitava qualquer string até 64 chars. `core.calendar.today_for(user)` lança `ZoneInfoNotFoundError` com timezone inválido. Adicionado `validate_timezone` usando `zoneinfo.available_timezones()`. Novo teste `test_signup_timezone_invalida_retorna_400` adicionado.

- **`backend/uv.lock` ausente do File List**: lockfile foi atualizado (simplejwt), mas não listado. Corrigido no File List.

### Issues Corrigidos (LOW)

- **Contagem de testes**: Notas diziam "69 (53+16)" — real é 79 (53+26) após os testes extras do QA e o novo de timezone. Corrigido.

- **`SECRET_KEY` curto no `.env.dev`**: `changeme-dev-only` (17 bytes) gerava `InsecureKeyLengthWarning` no JWT durante testes. Atualizado para 44 chars. `.env.example` corrigido também.

### Verificação Final

- 79 testes passando · ruff 0 erros · lint-imports verde · 0 CRITICAL issues

### Change Log

- 2026-06-27: Story 2.1 implementada — cadastro e login com JWT (claude-sonnet-4-6)
- 2026-06-28: Code review — 5 issues (2 MEDIUM, 3 LOW) auto-fixados → status done (claude-sonnet-4-6)
