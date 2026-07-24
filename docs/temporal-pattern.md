# Padrão Temporal Canônico

> **Referenciável por**: Épico 4 (Motor BuJo — logs, migração, recorrentes) e Épico 6 (Sistema de Hábitos).  
> **Autoridade de código**: `backend/core/calendar.py` (Story 1.3).  
> **Decisões de arquitetura**: AD-04, AD-05, §6.8, §7.2 de `architecture.md`.

---

## 1. Por que `today_for(user)` e não `date.today()`

`date.today()` retorna a data **no fuso do servidor** (UTC em produção). Para um usuário em São Paulo (UTC-3), às 23:30 UTC o servidor já está no dia seguinte enquanto o usuário ainda está no dia atual — o Daily Log abriria na data errada.

`today_for(user)` resolve o fuso IANA do usuário:

```python
# backend/core/calendar.py
def today_for(user) -> date:
    return timezone.now().astimezone(ZoneInfo(user.timezone)).date()
```

**Regra**: nenhum código de produção fora de `core/calendar.py` pode chamar `date.today()`, `timezone.now()`, `datetime.now()`, `datetime.today()` ou `datetime.utcnow()` diretamente. Um guardrail AST em `core/tests/test_guardrails.py` falha o build se essa regra for violada (§6.9 item 6).

**As duas únicas fontes canônicas** (ambas em `core/calendar.py`):

| Preciso de… | Use | Retorna |
|---|---|---|
| a "autoridade de hoje" do usuário (página do diário) | `today_for(user)` | `date` |
| o instante de auditoria de escrita ("quando exatamente") | `now()` | `datetime` timezone-aware (UTC) |

> **`now()` é o substituto de `timezone.now()` para timestamps de auditoria** — não confundir com `today_for`. O guardrail AST proíbe `timezone.now()` em **todo** módulo de produção fora de `core/calendar.py`, **sem distinguir intenção** (autoridade de "hoje" vs. carimbo de auditoria); por isso até um instante que claramente não é "hoje de negócio" (ex.: `last_used_at` de um token, `revoked_at`) deve vir de `core.calendar.now()`, não de `timezone.now()` direto. Centralizar dá um único ponto de mock nos testes e mantém o guardrail válido. Precedentes em produção: `medications/services.py` (`confirmed_at`), `automation/authentication.py` (`last_used_at`), `automation/admin.py` (revogação).

Se `user.timezone` for inválido, `ZoneInfo` levanta `ZoneInfoNotFoundError` — o erro não é silenciado porque indica dado incorreto no cadastro do usuário, não um caso esperado.

---

## 2. Duas categorias de coluna temporal

| Categoria | Tipo SQL | Quando usar | Exemplos |
|---|---|---|---|
| **Página do diário** | `DATE` | "Que dia é esse registro?" — sem hora, sem fuso | `log_date`, datas de hábito, datas de saúde, `week_start`, `month` |
| **Instante de evento** | `TIMESTAMPTZ` (UTC) | "Quando exatamente aconteceu?" — ordenação, auditoria, expiração | `created_at`, `updated_at`, `completed_at`, tokens JWT, logs de auditoria |

**Por que `DATE` puro para páginas do diário**: converter um `DATE` em `TIMESTAMPTZ` exige o fuso do usuário — usar `TIMESTAMPTZ` aqui criaria dependência de fuso em toda query de leitura e quebraria a semântica de "página" (que é agnóstica a hora).

**Por que `TIMESTAMPTZ` UTC para eventos**: UTC garante ordenação global correta e elimina ambiguidade de horário de verão.

**Como obter o "agora" de um instante de evento**: sempre via `core.calendar.now()` (nunca `timezone.now()` direto — ver a regra e a tabela de fontes canônicas na §1). Vale para todos os exemplos da linha "Instante de evento", inclusive carimbos de auditoria que não são "hoje de negócio" (`confirmed_at`, `last_used_at`, `revoked_at`).

---

## 3. Dia lógico congela na abertura

Ao abrir um Daily Log, o dia é determinado por `today_for(user)` **naquele momento** e gravado como `log_date` — um `DATE` imutável. Se a meia-noite passa durante a sessão, o log **não** muda de data; a virada ocorre apenas na próxima abertura explícita (AD-04 item 5).

Isso evita a surpresa de um usuário ver seu log de "hoje" virar "ontem" enquanto ainda está digitando.

---

## 4. Sem automação de migração

Dias pulados (usuário não abriu o app) ficam com status `pending` — **nunca são fechados ou migrados automaticamente** por cron ou signal (AD-04 item 5). A reconciliação é deliberada: o usuário aciona o fluxo de Catch-Up (AD-09, Épico 4 — Story 4.4).

Motivação: fechar dias silenciosamente distorce a intenção do usuário e cria registros que ele nunca revisou.

---

## 5. Materialização vs. consulta sob demanda

| Situação | Estratégia | Quando ocorre |
|---|---|---|
| Abertura do Daily Log do dia | **Materialização ansiosa** (idempotente) | 1º acesso do dia — cria o `DailyLog` se não existir (AD-06/07) |
| Abertura do Weekly/Monthly Log | **Materialização ansiosa** (idempotente) | 1º acesso da semana/mês — calcula e persiste (AD-06/07) |
| Gráficos de evolução / histórico | **Consulta sob demanda** (on-read) | Cada requisição agrega sobre dados existentes; sem materialização (AD-11, §6.8) |
| Snapshots de hábitos | **Materialização no encerramento do dia** | Imutável após o encerramento; revisões posteriores não alteram o snapshot (Épico 6) |

**Regra de decisão**: materializar quando o resultado precisa ser estável e reutilizável (página do diário, snapshot de hábito). Consultar sob demanda quando o resultado é derivado de dados já persistidos e não precisa de cache (gráficos, totais de histórico).

---

## 6. Semântica de semana

- **Dia 1 da semana**: segunda-feira (`weekday() == 0`).
- **Semana 1 do mês**: a semana que contém o dia 1 do mês (pode começar no mês anterior — AD-05).
- **Semana de virada**: uma semana que abrange dois meses pertence a **ambos** simultaneamente. A chave `week_start` (tipo `DATE`) é única no banco; o registro `WeeklyLog` de `26/12/2022` é compartilhado entre dezembro/2022 e janeiro/2023.

Funções de derivação em `core/calendar.py`:

```python
week_start_of(d)              # Segunda da semana de d
weeks_of_month(year, month)   # Lista de week_starts que tocam o mês
months_of_week(week_start)    # {(year, month)} ou {(y1,m1),(y2,m2)} para viradas
```

**Casos-âncora obrigatórios** (01/01/2023 era domingo):

```python
week_start_of(date(2023, 1, 1))         == date(2022, 12, 26)
months_of_week(date(2022, 12, 26))      == {(2022, 12), (2023, 1)}
weeks_of_month(2022, 12)[-1]            == weeks_of_month(2023, 1)[0]
weeks_of_month(2022, 12)[-1]            == date(2022, 12, 26)
```

---

## 7. Referências cruzadas

| Referência | Conteúdo |
|---|---|
| **AD-04** | Autoridade temporal: `today_for`, `ZoneInfo`, duas categorias de coluna, sem auto-migração, congela na abertura |
| **AD-05** | Semântica de calendário: segunda = dia 1, semana 1 = contém o dia 1, funções de derivação, casos-âncora |
| **§6.8** | Regra guarda-chuva: `today_for` como única fonte, materialização idempotente, cálculo de domínio no service |
| **§7.2** | Autoridade do "dia" em `core/calendar.py`; `user_holidays` em `accounts` (Story 2.1+) |
| **Épico 4** | Motor BuJo — Daily/Weekly/Monthly Log, migração, Catch-Up; depende diretamente deste padrão |
| **Épico 6** | Sistema de Hábitos — snapshots imutáveis por dia, multiplicadores por tipo de dia; depende de `today_for` e `is_workday` |
