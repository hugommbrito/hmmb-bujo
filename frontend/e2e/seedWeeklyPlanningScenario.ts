import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.5 (AC5/AC9): cenário completo do ritual de planejamento — a semana
// CORRENTE fica `active` com uma tarefa aberta (alimenta a fonte bloqueante
// `previous-weekly` da PRÓXIMA semana) e a PRÓXIMA semana nasce como alvo de
// planejamento (`planning`). As 3 fontes restantes ganham 1 item elegível cada:
// uma Task no Monthly dentro da semana-alvo, um template recorrente semanal
// ativo, e um Daily Log passado não resolvido.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedWeeklyPlanningScenarioResult {
  currentWeekStart: string
  targetWeekStart: string
}

export function seedWeeklyPlanningScenario(email: string): SeedWeeklyPlanningScenarioResult {
  const script = `
import json
from datetime import timedelta

from accounts.models import User
from bujo.models import Log, MonthlyLog, RecurringTaskTemplate, Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    current_week = week_start_of(today)
    target_week = current_week + timedelta(weeks=1)

    current_log, _ = WeeklyLog.objects.get_or_create(week_start=current_week)
    current_log.status = "active"
    current_log.save(update_fields=["status"])
    Task.objects.create(
        weekly_log=current_log, title="Pendência da semana anterior", status="pending",
        scheduled_date=current_week, order_index=1.0,
    )

    target_log, _ = WeeklyLog.objects.get_or_create(week_start=target_week)
    target_log.status = "planning"
    target_log.save(update_fields=["status"])

    month_first = target_week.replace(day=1)
    monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)
    Task.objects.create(
        monthly_log=monthly_log, title="Tarefa do Monthly na semana-alvo", status="pending",
        scheduled_date=target_week, order_index=1.0,
    )

    RecurringTaskTemplate.objects.create(
        title="Recorrente semanal", recurrence_group="weekly",
        recurrence_text="toda semana", active=True,
    )

    past_log = Log.objects.create(log_date=today - timedelta(days=3))
    Task.objects.create(log=past_log, title="Tarefa de um dia passado", status="pending", order_index=1.0)

    print(json.dumps({
        "currentWeekStart": current_week.isoformat(),
        "targetWeekStart": target_week.isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedWeeklyPlanningScenarioResult
}
