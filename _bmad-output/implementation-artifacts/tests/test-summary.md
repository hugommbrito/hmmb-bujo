# Resumo de Automação de Testes — Story 1.3

**Data:** 2026-06-26
**Story:** 1.3 — Autoridade temporal `core/calendar.py` e padrão temporal canônico
**Framework:** pytest 9.1.1 + pytest-django 4.12.0 (`uv run pytest`)

---

## Testes Gerados (QA — gaps adicionados)

### Testes de API / Unidade

| Arquivo | Teste | Status |
|---------|-------|--------|
| `backend/core/tests/test_calendar.py` | `test_today_for_fuso_positivo_utc_mais_9` | ✅ |
| `backend/core/tests/test_calendar.py` | `test_today_for_fuso_utc` | ✅ |
| `backend/core/tests/test_calendar.py` | `test_week_start_of_quarta` | ✅ |
| `backend/core/tests/test_calendar.py` | `test_weeks_of_month_marco_2023_cinco_semanas` | ✅ |
| `backend/core/tests/test_calendar.py` | `test_weeks_of_month_mes_comecando_na_segunda` | ✅ |
| `backend/core/tests/test_calendar.py` | `test_weeks_of_month_todos_os_itens_sao_segundas` | ✅ |
| `backend/core/tests/test_calendar.py` | `test_months_of_week_semana_fim_de_mes_sem_cruzar` | ✅ |

### Testes E2E
Não aplicável — projeto back-end sem UI nesta story.

---

## Gaps Descobertos e Corrigidos

| ID | Gap | Motivo da relevância |
|----|-----|---------------------|
| G1 | `today_for` com fuso positivo (UTC+9, Tokyo) | Testes anteriores só cobriam UTC-3; meia-noite inversa (UTC atrás) era diferente code-path semântico |
| G2 | `today_for` com fuso UTC | Fixture `user_utc` existia sem nenhum teste usando-a |
| G3 | `week_start_of` para quarta-feira (dia intermediário) | Apenas Seg, Sáb e Dom estavam cobertos; Ter–Sex sem teste |
| G4 | `weeks_of_month` mês com 5 semanas | Caso mais frequente do calendário gregoriano, sem cobertura |
| G5 | `weeks_of_month` mês começando na segunda | Garantia que `week_start == dia 1` sem recuo ao mês anterior |
| G6 | `weeks_of_month` todos resultados são segundas | Regressão: verifica invariante estrutural em 4 meses distintos |
| G7 | `months_of_week` fim de mês sem cruzar virada | Semana dez/25–31 inteira em dezembro — conjunto de 1 elemento |

---

## Cobertura

| Função | Antes | Depois |
|--------|-------|--------|
| `today_for` | 2 happy paths + 1 erro | +fuso positivo +fuso UTC = 4 happy paths + 1 erro |
| `week_start_of` | Seg, Sáb, Dom | +Qua — representa Ter–Sex |
| `weeks_of_month` | 4 semanas, 6 semanas, tipo | +5 semanas (caso típico), +começa na segunda, +invariante de segundas |
| `months_of_week` | virada de mês, meio do mês | +fim de mês sem cruzar |
| `is_workday` | Seg–Sex, Sáb, Dom | sem alteração (stub — cobertura completa) |
| guardrail temporal | 0 violações na base | sem alteração (guardrail mantido) |

**Total de testes:** 31 originais → **38 após QA** (+7 novos, 0 falhas, 0 regressões)

---

## Próximos Passos

- Executar em CI: `uv run pytest` (os 38 testes estão no path de testes padrão)
- `is_workday` tem TODO p/ Story 2.1 — quando `accounts.UserHoliday` existir, adicionar testes de integração para feriados
- Considerar `pytest-cov` para rastreamento de cobertura de linhas em CI
