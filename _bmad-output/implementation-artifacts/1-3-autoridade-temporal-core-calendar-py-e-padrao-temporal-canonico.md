---
baseline_commit: 0855f66f5d19cb58e9bb16f1c3e79a27e8d46a9d
---

# Story 1.3: Autoridade temporal `core/calendar.py` e padrão temporal canônico

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como **desenvolvedor do projeto**,
Quero **uma fonte única para "hoje" e para a semântica de calendário (semana/mês/ano), com o padrão temporal canônico documentado e imposto por guardrail**,
Para que **todo módulo concorde sobre datas e fronteiras temporais, evitando divergência conceitual entre Daily Log, migração e materialização de snapshots** (AR-6, AD-04, AD-05).

## Acceptance Criteria

**AC1 — `today_for(user)` + guardrail de uso direto no CI**
**Dado que** a necessidade de saber "que dia é hoje" para um usuário,
**Quando** `core/calendar.py` é implementado,
**Então** expõe `today_for(user)` que resolve o fuso IANA do usuário (`timezone.now().astimezone(ZoneInfo(user.timezone)).date()`), e nenhum outro código de produção chama `date.today()`/`timezone.now()` direto,
**E** um guardrail no CI falha o build se houver uso direto de `date.today()`/`timezone.now()`/`datetime.now()` fora de `core/calendar.py` (excluindo arquivos de teste e conftest).

**AC2 — Funções de derivação de calendário + casos-âncora**
**Dado que** a semântica de calendário (segunda = primeiro dia; semana 1 = a que contém o dia 1),
**Quando** as funções de derivação são implementadas,
**Então** existem `week_start_of(d)`, `weeks_of_month(year, month)` e `months_of_week(week_start)`,
**E** os casos-âncora passam: `week_start_of(date(2023,1,1)) == date(2022,12,26)`; `months_of_week(date(2022,12,26)) == {(2022,12),(2023,1)}`; `weeks_of_month(2022,12)[-1] == weeks_of_month(2023,1)[0]`.

**AC3 — Documento do padrão temporal canônico em `docs/`**
**Dado que** as duas categorias de coluna temporal,
**Quando** o padrão temporal canônico é documentado em `docs/`,
**Então** registra `DATE` puro para "página do diário" (`log_date`, datas de hábito/saúde) vs `timestamptz` (UTC) para eventos/auditoria, a regra "sem auto-migração / dia congela na abertura", e quando se materializa vs. consulta sob demanda,
**E** o documento é referenciável pelos Épicos 4 e 6.

## Tasks / Subtasks

- [x] **Task 1 — `core/calendar.py`: autoridade temporal** (AC: 1, 2)
  - [x] Criar `backend/core/calendar.py`
  - [x] Implementar `today_for(user) -> date`: `timezone.now().astimezone(ZoneInfo(user.timezone)).date()` — lê `user.timezone` (string IANA); sem `try/except` (fuso inválido deve explodir explicitamente)
  - [x] Implementar `week_start_of(d: date) -> date`: `d - timedelta(days=d.weekday())` — weekday() retorna 0=segunda...6=domingo; zero dias = já é segunda
  - [x] Implementar `weeks_of_month(year: int, month: int) -> list[date]`: lista de `week_start` do mês; 1ª semana = a que contém o dia 1; última semana = a que contém o último dia do mês (pode pertencer ao mês seguinte)
  - [x] Implementar `months_of_week(week_start: date) -> set[tuple[int, int]]`: retorna `{(year, month)}` ou `{(y1,m1),(y2,m2)}` para semanas de virada — compara `week_start` e `week_start + timedelta(days=6)`
  - [x] Implementar `is_workday(user, d: date) -> bool` como **stub**: `d.weekday() < 5` (segunda–sexta), com `# TODO (Story 2.1+): checar user_holidays via accounts` — a integração real espera `accounts.User` e `user_holidays` existirem
  - [x] **Verificar naming conflict**: `core/calendar.py` shadowing da stdlib — dentro do arquivo, `import calendar` importa a stdlib (Python 3 usa imports absolutos); usar `import calendar as _calendar` para evitar confusão; testar `calendar.monthrange` via o alias
  - [x] **Não usar** `date.today()` ou `timezone.now()` em nenhum outro arquivo de produção

- [x] **Task 2 — `core/tests/test_calendar.py`** (AC: 1, 2)
  - [x] Criar `backend/core/tests/test_calendar.py`
  - [x] Fixture `user_sp` = `types.SimpleNamespace(timezone="America/Sao_Paulo")` — sem model real até a 2.1; `today_for` só precisa de `.timezone`
  - [x] **Caso âncora AC2-a**: `week_start_of(date(2023,1,1)) == date(2022,12,26)` — 01/01/2023 era domingo
  - [x] **Caso âncora AC2-b**: `months_of_week(date(2022,12,26)) == {(2022,12),(2023,1)}` — semana de virada pertence a 2 meses
  - [x] **Caso âncora AC2-c**: `weeks_of_month(2022,12)[-1] == weeks_of_month(2023,1)[0]` — mesma semana nas duas visões mensais (uma linha compartilhada)
  - [x] Teste `today_for` com `freeze_time` (ou mock de `django.utils.timezone.now`): verificar que retorna a data no fuso correto — especialmente para horário perto de meia-noite onde UTC e SP diferem
  - [x] Teste `weeks_of_month` para mês com 4 semanas e para mês com 6 semanas
  - [x] Teste `is_workday` stub: seg–sex = True, sáb/dom = False
  - [x] Teste que `today_for` com fuso inválido levanta `ZoneInfoNotFoundError` (sem silenciar o erro)

- [x] **Task 3 — Guardrail de uso direto de `date.today()`/`timezone.now()`** (AC: 1)
  - [x] Adicionar `test_no_bare_date_today_outside_calendar` em `backend/core/tests/test_guardrails.py` (ALTERAR — estender, não recriar)
  - [x] Scanner AST varre todos os `.py` sob `backend/` exceto: `core/calendar.py` (o módulo autoridade), `.venv/`, `migrations/`, arquivos que começam com `test_`, `conftest.py` e `__pycache__`
  - [x] Patterns proibidos fora de `core/calendar.py`:
    - `date.today()` — AST: `Call(Attribute(Name("date"), "today"))`
    - `timezone.now()` — AST: `Call(Attribute(Name("timezone"), "now"))`
    - `datetime.now()` e `datetime.today()` e `datetime.utcnow()` — AST: `Call(Attribute(Name("datetime"), "{now,today,utcnow}"))`
  - [x] Reportar o arquivo e número da linha em cada violação; falhar com `assert not violations, f"...{violations}"`
  - [x] Confirmar que o guardrail não dispara na suite atual (0 violações na base)
  - [x] **Não adicionar passo novo no `ci.yml`** — o guardrail roda dentro do `pytest` existente (igual ao guardrail de manager da 1.2)

- [x] **Task 4 — Documento `docs/temporal-pattern.md`** (AC: 3)
  - [x] Criar `docs/temporal-pattern.md` (o diretório `docs/` existe na raiz do monorepo)
  - [x] Seções obrigatórias:
    1. **Duas categorias de coluna temporal**: `DATE` puro vs `timestamptz` (UTC) — quando usar cada uma e por quê
    2. **Autoridade de "hoje"**: `today_for(user)` é a única fonte; o que acontece se `date.today()` for chamado diretamente (drift de fuso, bug silencioso no multi-tenant)
    3. **Dia lógico congela na abertura**: sem auto-refresh de "hoje" no meio de uma sessão; a virada ocorre em ação explícita
    4. **Sem automação de migração**: logs passados ficam `pending`; reconciliação deliberada via Catch-Up (AD-09)
    5. **Materialização vs. consulta sob demanda**: materialização ansiosa no 1º acesso do dia (AD-06/07), consulta on-read para gráficos/histórico (AD-11/§6.8)
    6. **Semântica de semana**: segunda = dia 1; semana 1 = a que contém o dia 1; semana de virada pertence a dois meses (chave única em `weekly_log`)
    7. **Referências cruzadas**: citar AD-04, AD-05, §6.8, §7.2 da arquitetura; sinalizar que Épicos 4 (Motor BuJo) e 6 (Hábitos) dependem deste padrão
  - [x] Formato pt-BR, conciso, referenciável (headings âncora em inglês ou pt-BR consistente)

## Dev Notes

### ⚠️ Limites de Escopo (LEIA PRIMEIRO — previne over-build)

| Pertence a esta Story (1.3) | NÃO faça agora — Story responsável |
|---|---|
| `core/calendar.py` (`today_for`, `week_start_of`, `weeks_of_month`, `months_of_week`, `is_workday` stub) | Integração de `is_workday` com `user_holidays` real → **Story 2.1+** (depende de `accounts.User` e `user_holidays`) |
| `core/tests/test_calendar.py` | `core/pagination.py` + defaults DRF → **Story 1.4** |
| Guardrail AST de `date.today()`/`timezone.now()` em `test_guardrails.py` | `drf-spectacular`, `types.gen.ts`, camelCase → **Story 1.4** |
| `docs/temporal-pattern.md` | `User` model, JWT, `user_holidays` → **Story 2.1** |

**Princípio:** nada além da autoridade temporal e da documentação do padrão. Sem User model real, sem integração com `user_holidays`, sem paginação.

### `core/calendar.py` — Forma normativa

```python
# backend/core/calendar.py
import calendar as _calendar      # alias para evitar confusão com este módulo
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone


def today_for(user) -> date:
    """Única fonte de 'hoje'. user deve ter .timezone (string IANA)."""
    return timezone.now().astimezone(ZoneInfo(user.timezone)).date()


def week_start_of(d: date) -> date:
    """Segunda-feira da semana de d (chave do Weekly Log)."""
    return d - timedelta(days=d.weekday())


def weeks_of_month(year: int, month: int) -> list[date]:
    """week_starts do mês; 1ª = a que contém o dia 1; inclui semanas de virada."""
    first = date(year, month, 1)
    last = date(year, month, _calendar.monthrange(year, month)[1])
    cur, out = week_start_of(first), []
    while cur <= last:
        out.append(cur)
        cur += timedelta(days=7)
    return out


def months_of_week(week_start: date) -> set[tuple[int, int]]:
    """(year, month) tuples a que a semana pertence (1 ou 2 para semanas de virada)."""
    end = week_start + timedelta(days=6)
    return {(week_start.year, week_start.month), (end.year, end.month)}


def is_workday(user, d: date) -> bool:
    """True se d é um dia útil para user. Stub: apenas verifica fim de semana.
    # TODO (Story 2.1+): integrar user_holidays de accounts.models.UserHoliday
    """
    return d.weekday() < 5  # 0=seg...4=sex; 5=sab, 6=dom
```

### ⚠️ Naming conflict: `core/calendar.py` vs stdlib `calendar`

- O arquivo `core/calendar.py` sombreia o módulo stdlib `calendar` **somente para importadores** que façam `from core import calendar` ou `import core.calendar`.
- Dentro do próprio `core/calendar.py`, `import calendar` importa **a stdlib** (Python 3 usa imports absolutos por default) — use o alias `import calendar as _calendar` para deixar explícito que é a stdlib.
- Qualquer módulo externo que precise do stdlib `calendar` e também use `core.calendar` deve fazer `from core import calendar as core_calendar` ou importar o stdlib antes.
- O guardrail de import-linter não precisa de alteração — `_calendar` é um alias interno.
- **Confirmar** com `uv run python -c "import core.calendar; import calendar; print(calendar.__file__)"` que os dois importam coisas distintas.

### ⚠️ `today_for` e o `User` ausente (sem User real até 2.1)

- `today_for(user)` **não** acoplada ao model `User` do Django — lê apenas `user.timezone` (string IANA).
- Em testes da 1.3: `user = types.SimpleNamespace(timezone="America/Sao_Paulo")`.
- Quando `accounts.User` existir (2.1), `user.timezone` será uma coluna real — nenhuma mudança necessária em `today_for`.
- **Fuso padrão**: se `user.timezone` for uma string vazia ou inválida, `ZoneInfo` levanta `ZoneInfoNotFoundError`. O código não silencia esse erro — é um bug a corrigir no nível de dados.

### Casos-âncora dos testes (obrigatórios — AC2)

```python
from datetime import date
from core.calendar import week_start_of, weeks_of_month, months_of_week

assert week_start_of(date(2023, 1, 1)) == date(2022, 12, 26)
# 01/01/2023 era domingo (weekday=6), então -6 dias = 26/12/2022 (segunda)

assert months_of_week(date(2022, 12, 26)) == {(2022, 12), (2023, 1)}
# Semana 26/12/2022–01/01/2023 pertence a dois meses

assert weeks_of_month(2022, 12)[-1] == weeks_of_month(2023, 1)[0]
# A última semana de dez/2022 É a primeira semana de jan/2023 — mesma linha no DB
assert weeks_of_month(2022, 12)[-1] == date(2022, 12, 26)
```

### Guardrail AST — estratégia de implementação

Adicionar em `backend/core/tests/test_guardrails.py` (ARQUIVO A ALTERAR — ler primeiro):

```python
import ast
from pathlib import Path

def test_no_bare_date_today_outside_calendar():
    """Fail build se date.today()/timezone.now() usados fora de core/calendar.py."""
    FORBIDDEN = {("date", "today"), ("timezone", "now"),
                 ("datetime", "now"), ("datetime", "today"), ("datetime", "utcnow")}

    backend_root = Path(__file__).resolve().parent.parent.parent
    SKIP_PARTS = {".venv", "migrations", "__pycache__"}

    violations = []
    for py_file in sorted(backend_root.rglob("*.py")):
        rel = py_file.relative_to(backend_root)
        # Pular o próprio módulo autoridade
        if rel.parts[-2:] == ("core", "calendar.py"):
            continue
        # Pular venv, migrations, pycache
        if any(p in SKIP_PARTS for p in rel.parts):
            continue
        # Pular arquivos de teste e conftest (usam mocks/freeze_time)
        if rel.name.startswith("test_") or rel.name == "conftest.py":
            continue

        source = py_file.read_text(encoding="utf-8", errors="replace")
        try:
            tree = ast.parse(source, filename=str(rel))
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if (
                isinstance(func, ast.Attribute)
                and isinstance(func.value, ast.Name)
                and (func.value.id, func.attr) in FORBIDDEN
            ):
                violations.append(f"{rel}:{node.lineno} — {func.value.id}.{func.attr}()")

    assert not violations, (
        "Uso direto de date.today()/timezone.now() fora de core/calendar.py:\n"
        + "\n".join(violations)
    )
```

### Documento `docs/temporal-pattern.md` — estrutura mínima

O arquivo deve conter (em pt-BR):
- **Por que `today_for(user)` e não `date.today()`**: fuso do usuário, consistência entre Daily Log e hábitos, bug de meia-noite em fusos diferentes do UTC
- **Duas categorias de coluna**: `DATE` (página do diário) × `timestamptz` UTC (instante de evento)
- **Dia lógico congela na abertura**: evita surpresa de virada de dia dentro de uma sessão; a reconciliação é deliberada
- **Sem automação de migração**: por design (AD-04 item 5) — sem cron, sem fechar dias automaticamente
- **Materialização vs. consulta sob demanda**: tabela de decisão (quando materializar x quando calcular on-read)
- **Semântica de semana**: segunda-feira, semana 1 = contém o dia 1, virada de semana = chave única compartilhada
- Referências: AD-04, AD-05, §6.8, §7.2 de `architecture.md`

### Testing requirements

- `pytest` + `pytest-django` com `uv run pytest` (ver stack 1.1/1.2)
- Não existe `freeze_time` nem `freezegun` nas deps atuais. Alternativa: mockar `django.utils.timezone.now` via `unittest.mock.patch` — **preferível** a adicionar uma nova dependência para esta story
- `test_calendar.py` cobre: casos-âncora AC2, `today_for` com fuso UTC vs America/Sao_Paulo, `is_workday` stub, erro em fuso inválido
- O guardrail de `test_guardrails.py` não deve encontrar violações na base do commit 0855f66 (confirmar antes de mergear)
- Rodar toda a suite com `uv run pytest` — os 16 testes existentes devem continuar passando (smoke test de regressão)

### Project Structure Notes

Árvore ao fim desta story:

```
backend/
├── core/
│   ├── calendar.py              # NOVO — today_for, week_start_of, weeks_of_month, months_of_week, is_workday (stub)
│   ├── tests/
│   │   ├── test_calendar.py     # NOVO — casos-âncora + today_for + is_workday stub
│   │   └── test_guardrails.py   # ALTERAR — adicionar test_no_bare_date_today_outside_calendar
│   └── ... (demais arquivos da 1.2 — não mexer)
docs/
└── temporal-pattern.md          # NOVO — padrão temporal canônico referenciável pelos Épicos 4 e 6
```

**Não criar:**
- `core/pagination.py` → Story 1.4
- Qualquer model de usuário ou integração com `user_holidays` → Story 2.1

### Previous Story Intelligence (1.2 — done)

Aprendizados relevantes da Story 1.2:
- **Stack cravada**: Python 3.13.5, Django 5.2, DRF 3.17, gerenciado por `uv` (`uv run pytest`, `uv run ruff`)
- **`zoneinfo`** nativo do Python 3.9+ — `from zoneinfo import ZoneInfo` funciona sem deps extras (Python 3.13)
- **Guardrail pattern** estabelecido: testes AST/introspection em `test_guardrails.py`, sem passo CI separado — replicar o mesmo padrão
- **Alias de import** para evitar conflito: padrão já usado em `core/tenant.py` com `from core.exceptions import TenantScopeViolation` (sem ciclo) — mesma disciplina para o alias `_calendar`
- **`ruff`** pode sinalizar imports não-utilizados; checar que `_calendar` alias não dispara `F401` (necessário declarar uso explícito via `_calendar.monthrange`)
- **mock de `django.utils.timezone.now`**: padrão Django/pytest — `from unittest.mock import patch` + `@patch("django.utils.timezone.now", return_value=...)`
- **`uv run python manage.py check`** deve passar 0 issues após a story
- **`uv run lint-imports`** deve passar 0 broken — `core/calendar.py` não importa apps de domínio (ok); ele importa `django.utils.timezone` (não é app de domínio)

### Git Intelligence

- Branch `main`; último commit `0855f66` ("Story 1.2: módulo core…"). Repo limpo após 1.2.
- Convenção de commit: `"Story X.Y: <descrição>"` — aplicar ao commitar ao fim desta story (status `done`).
- `core/` não tem `calendar.py` — confirmar antes de criar (já confirmado: não existe).

### References

- [Source: epics.md#Story-1.3] — user story e ACs originais (BDD): today_for, funções de derivação, documento temporal
- [Source: epics.md#Epic-1] — objetivo do épico (padrão temporal canônico como prerequisito de Daily Log e hábitos)
- [Source: architecture.md AD-04] — autoridade temporal (today_for, ZoneInfo, duas categorias de coluna, sem auto-migração, congela na abertura)
- [Source: architecture.md AD-05] — semântica de calendário (segunda, semana 1 = contém dia 1, funções de derivação, casos-âncora)
- [Source: architecture.md §6.8] — regra guarda-chuva: today_for, materialização idempotente, cálculo de domínio no service
- [Source: architecture.md §6.9] — enforcement: today_for como única fonte de "hoje" (item 6)
- [Source: architecture.md §7.1] — árvore do projeto: `core/calendar.py` listado com `today_for/user_today(user), is_workday(user, date)`
- [Source: architecture.md §7.2] — autoridade do "dia" em `core/calendar.py`, `user_holidays` em accounts
- [Source: architecture.md §8.7] — handoff: `calendar.py` como segunda prioridade após tenant
- [Source: 1-2-...md §Previous Story Intelligence] — stack, padrão de guardrail, uv, ruff DJ012 lição

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Postgres local não estava rodando; iniciado container Docker efêmero `hmmb-bujo-postgres` na porta 55432 (mesmo endereço do `.env.dev`).
- Ruff sinalizou `I001` (imports locais dentro de funções de teste) e `UP017` (`timezone.utc` → `datetime.UTC`); corrigidos movendo imports para o topo do arquivo e usando o alias `UTC` nativo do Python 3.11+.
- Naming conflict `core/calendar.py` vs stdlib `calendar` confirmado: `import core.calendar; import calendar; print(calendar.__file__)` aponta corretamente para a stdlib. Alias `_calendar` usado dentro do módulo autoridade.

### Completion Notes List

- **Task 1** (`core/calendar.py`): implementado com `import calendar as _calendar` para evitar shadowing, `today_for` via `ZoneInfo`, `week_start_of` via `d.weekday()`, `weeks_of_month` iterando por semanas, `months_of_week` comparando `week_start` e `week_start + 6d`, `is_workday` stub com TODO para Story 2.1. Ruff limpo, import-linter OK (sem importar apps de domínio), django check 0 issues.
- **Task 2** (`test_calendar.py`): 21 testes cobrindo os 3 casos-âncora obrigatórios do AC2, mock de `django.utils.timezone.now` com `datetime.UTC`, erro de fuso inválido, `is_workday` stub seg–dom, `weeks_of_month` para fevereiro (4 semanas) e outubro 2023 (6 semanas), mais 7 gaps de cobertura adicionados na revisão (G1–G7: fusos positivos, UTC direto, quarta-feira, 5 semanas, mês começando na segunda, invariante de segunda-feira, fim de mês sem virada). Todos passam.
- **Task 3** (`test_guardrails.py` estendido): guardrail AST `test_no_bare_date_today_outside_calendar` adicionado sem modificar o guardrail de manager existente. Scanner verifica 5 padrões proibidos; 0 violações na base. Ruff limpo.
- **Task 4** (`docs/temporal-pattern.md`): 7 seções obrigatórias em pt-BR com tabela de decisão materialização vs. on-demand, casos-âncora documentados, referências cruzadas a AD-04, AD-05, §6.8, §7.2 e Épicos 4 e 6.
- **Suite final**: 38/38 testes passam (16 originais + 21 novos de calendar + 1 novo de guardrail). Zero regressões. Ruff, lint-imports e django check todos OK.

### File List

- `backend/core/calendar.py` — NOVO
- `backend/core/tests/test_calendar.py` — NOVO
- `backend/core/tests/test_guardrails.py` — ALTERADO (guardrail AST adicionado)
- `docs/temporal-pattern.md` — NOVO
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — ALTERADO (status in-progress → review)
- `_bmad-output/implementation-artifacts/1-3-autoridade-temporal-core-calendar-py-e-padrao-temporal-canonico.md` — ALTERADO (checkboxes, Dev Agent Record, File List, Change Log, Status)

## Senior Developer Review (AI)

**Data:** 2026-06-26  
**Revisor:** claude-sonnet-4-6 (adversarial review)

**Resultado:** APROVADO — 0 issues críticos ou altos. 1 médio + 2 baixos corrigidos automaticamente.

### Achados e Correções

| # | Severidade | Achado | Ação |
|---|---|---|---|
| M1 | MEDIUM | 7 testes QA (G1–G7) foram adicionados em `test_calendar.py` após o commit da story e estavam não-commitados; Dev Agent Record citava 14 testes mas o arquivo tinha 21 | Corrigido — contagem atualizada no Dev Agent Record; testes serão commitados junto a esta revisão |
| L1 | LOW | `test_today_for_retorna_data_no_fuso_correto` usava 23:30 UTC = 20:30 BRT (mesma data); a função poderia retornar a data UTC e o teste passaria igualmente | Corrigido — caso alterado para 00:30 UTC dia 16 = 21:30 BRT dia 15; agora divergem e o teste prova a resolução de fuso |
| L2 | LOW | Dev Agent Record dizia "31/31 testes passam (16+14+1)"; suite real era 38 | Corrigido junto ao M1 |

**AC validados:** AC1 ✅ AC2 ✅ AC3 ✅  
**Suite:** 38/38 testes passam | Ruff limpo | lint-imports 1 contrato mantido | django check 0 issues

## Change Log

- **2026-06-26**: Story 1.3 implementada — `core/calendar.py` (autoridade temporal: `today_for`, `week_start_of`, `weeks_of_month`, `months_of_week`, `is_workday` stub), testes com casos-âncora AC2, guardrail AST de `date.today()`/`timezone.now()` em `test_guardrails.py`, e documento `docs/temporal-pattern.md`.
- **2026-06-26**: Code review (AI adversarial) — 1 médio + 2 baixos corrigidos; 7 testes QA gap (G1–G7) commitados; story → done.
