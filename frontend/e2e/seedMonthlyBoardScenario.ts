import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.6 (AC1/AC9): cenário do Monthly Board do sistema novo — molde
// direto de `seedWeeklyBoardScenario.ts` (14.5), trocando `WeeklyLog`/
// `week_start` por `MonthlyLog`/`month_first`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedMonthlyBoardScenarioResult {
  monthFirst: string
  dayWithTask: string
}

export function seedMonthlyBoardScenario(email: string): SeedMonthlyBoardScenarioResult {
  const script = `
import json
from accounts.models import User
from bujo.models import Task, MonthlyLog
from core.calendar import today_for
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    month_first = today.replace(day=1)
    monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)

    Task.objects.create(
        monthly_log=monthly_log, title="Pendente no dia", status="pending",
        scheduled_date=today, order_index=1.0,
    )
    Task.objects.create(
        monthly_log=monthly_log, title="Concluída no dia", status="completed",
        scheduled_date=today, order_index=2.0,
    )
    Task.objects.create(
        monthly_log=monthly_log, title="Sem dia definido", status="pending",
        scheduled_date=None, order_index=1.0,
    )

    print(json.dumps({"monthFirst": month_first.isoformat(), "dayWithTask": today.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedMonthlyBoardScenarioResult
}

// Mesma técnica de aritmética de mês PURA (sem dependência externa) usada
// pelos 3 seeds abaixo que precisam de "N meses atrás/à frente" — evita
// depender de `dateutil` (não usado em nenhum outro lugar do backend).
const SHIFT_MONTHS_HELPER = `
def shift_months(d, delta):
    total = d.year * 12 + (d.month - 1) + delta
    year, month = divmod(total, 12)
    return d.replace(year=year, month=month + 1, day=1)
`.trim()

// AC3: um mês `finalized` COM tarefas — prova o readonly com conteúdo de
// verdade (par não-vacuoso de `seedFinalizedEmptyCycle.ts`). Alvo: 2 meses
// atrás, para nunca colidir com o mês corrente que o resto do spec navega.
// Inclui um par migrada/sucessora (mesmo dia) — a seta de linhagem é "a única
// mutação-zero que sobrevive ao readonly" (Dev Notes → matriz status×ciclo).
export interface SeedFinalizedMonthWithTasksResult {
  monthFirst: string
}

export function seedFinalizedMonthWithTasks(email: string): SeedFinalizedMonthWithTasksResult {
  const script = `
${SHIFT_MONTHS_HELPER}
import json
from datetime import timedelta

from accounts.models import User
from bujo.models import Task, MonthlyLog
from core.calendar import today_for
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    month_first = shift_months(today.replace(day=1), -2)
    monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)
    Task.objects.create(
        monthly_log=monthly_log, title="Tarefa do mês finalizado", status="completed",
        scheduled_date=month_first, order_index=1.0,
    )
    successor = Task.objects.create(
        monthly_log=monthly_log, title="Sucessora no mês finalizado", status="pending",
        scheduled_date=month_first + timedelta(days=1), order_index=1.0,
    )
    Task.objects.create(
        monthly_log=monthly_log, title="Origem migrada no mês finalizado", status="migrated",
        scheduled_date=month_first, order_index=2.0, migrated_to_task=successor,
    )
    monthly_log.status = "finalized"
    monthly_log.save(update_fields=["status"])

    print(json.dumps({"monthFirst": month_first.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedFinalizedMonthWithTasksResult
}

// AC2 (navegação de linhagem): par migrada/sucessora no MÊS CORRENTE, fora do
// regime finalizado — prova o ciclo completo clique → scroll → destaque →
// foco contra o browser real.
export interface SeedMonthlyBoardLineageScenarioResult {
  monthFirst: string
}

export function seedMonthlyBoardLineageScenario(email: string): SeedMonthlyBoardLineageScenarioResult {
  const script = `
import json
from datetime import timedelta

from accounts.models import User
from bujo.models import Task, MonthlyLog
from core.calendar import today_for
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    month_first = today.replace(day=1)
    monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)

    # Dias FIXOS (1 e 2, não "hoje") — todo mês tem pelo menos 28 dias, então
    # nunca cruza a virada de mês (ao contrário de "hoje + 1 dia", que
    # quebraria no último dia do mês).
    successor = Task.objects.create(
        monthly_log=monthly_log, title="Sucessora da migração no mês", status="pending",
        scheduled_date=month_first + timedelta(days=1), order_index=1.0,
    )
    Task.objects.create(
        monthly_log=monthly_log, title="Origem da migração no mês", status="migrated",
        scheduled_date=month_first, order_index=2.0, migrated_to_task=successor,
    )

    print(json.dumps({"monthFirst": month_first.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedMonthlyBoardLineageScenarioResult
}
