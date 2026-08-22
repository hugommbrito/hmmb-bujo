import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.6 (AC5/AC9): cenário completo do ritual de planejamento mensal —
// molde direto de `seedWeeklyPlanningScenario.ts` (14.5), trocando semana por
// mês. O mês CORRENTE fica `active` com uma tarefa aberta (alimenta a fonte
// bloqueante `previous-monthly` do mês-ALVO) e o PRÓXIMO mês nasce como alvo
// de planejamento (`planning`). As outras 2 fontes ganham 1 item elegível
// cada: um template recorrente `monthly` ativo (fonte Recorrentes) e uma Task
// já residente no Monthly Log do mês-alvo sem `scheduled_date` (fonte Future
// Log — arquitetura AD-03: "Future Log = monthly_log futuro").
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedMonthlyPlanningScenarioResult {
  currentMonthFirst: string
  targetMonthFirst: string
}

export function seedMonthlyPlanningScenario(email: string): SeedMonthlyPlanningScenarioResult {
  const script = `
import json
from accounts.models import User
from bujo.models import MonthlyLog, RecurringTaskTemplate, Task
from core.calendar import today_for
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    current_month = today.replace(day=1)
    if current_month.month == 12:
        target_month = current_month.replace(year=current_month.year + 1, month=1)
    else:
        target_month = current_month.replace(month=current_month.month + 1)

    current_log, _ = MonthlyLog.objects.get_or_create(month_first=current_month)
    current_log.status = "active"
    current_log.save(update_fields=["status"])
    Task.objects.create(
        monthly_log=current_log, title="Pendência do mês anterior", status="pending",
        scheduled_date=current_month, order_index=1.0,
    )

    target_log, _ = MonthlyLog.objects.get_or_create(month_first=target_month)
    target_log.status = "planning"
    target_log.save(update_fields=["status"])
    Task.objects.create(
        monthly_log=target_log, title="Item do Future Log para o mês-alvo", status="pending",
        scheduled_date=None, order_index=1.0,
    )

    RecurringTaskTemplate.objects.create(
        title="Recorrente mensal", recurrence_group="monthly",
        recurrence_text="todo dia 1", active=True,
    )

    print(json.dumps({
        "currentMonthFirst": current_month.isoformat(),
        "targetMonthFirst": target_month.isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedMonthlyPlanningScenarioResult
}
