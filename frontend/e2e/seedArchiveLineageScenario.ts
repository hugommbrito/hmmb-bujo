import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.10 (Arquivo — linhagem cross-período): sem affordance de UI para
// compor, de propósito, uma migração ANTIGA cuja origem já está num ciclo
// fechado E cujo sucessor mora num período DIFERENTE (Weekly→Monthly,
// Monthly→Daily) — mesma técnica de `seedArchiveScenario.ts` (seed direto no
// banco de teste via `manage.py shell` + `tenant_context`).
//
//   ▶ Sucessor Weekly→Monthly nasce `pending` num MÊS SEGUINTE ainda sem
//     ritual (`status IS NULL`) — `is_container_closed` vê 1 tarefa pendente e
//     devolve `False`: o destino da linhagem renderiza MUTÁVEL (AC3 da story).
//   ▶ Sucessor Monthly→Daily nasce `pending` no Daily Log de amanhã — Daily
//     não tem conceito de "fechado" (fora do escopo do Arquivo).
//   ▶ As duas origens (semana/mês de 2/3 meses atrás) só têm ESSA tarefa —
//     `migrated` sozinha fecha o ciclo pela derivação por conteúdo.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedArchiveLineageScenarioResult {
  originWeekStart: string
  originWeeklyTaskTitle: string
  destMonthFirst: string
  destWeeklySuccessorTitle: string
  originMonthFirst: string
  originMonthlyTaskTitle: string
  destLogDate: string
  destMonthlySuccessorTitle: string
}

export function seedArchiveLineageScenario(email: string): SeedArchiveLineageScenarioResult {
  const originWeeklyTaskTitle = 'Renovar seguro do carro'
  const destWeeklySuccessorTitle = 'Renovar seguro do carro (mês seguinte)'
  const originMonthlyTaskTitle = 'Agendar revisão do carro'
  const destMonthlySuccessorTitle = 'Agendar revisão do carro (amanhã)'

  const script = `
import json
from datetime import timedelta
from accounts.models import User
from bujo.models import Log, MonthlyLog, Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

def months_before(d, n):
    year, month = d.year, d.month - n
    while month <= 0:
        month += 12
        year -= 1
    return d.replace(year=year, month=month, day=1)

def months_after(d, n):
    year, month = d.year, d.month + n
    while month > 12:
        month -= 12
        year += 1
    return d.replace(year=year, month=month, day=1)

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)

    origin_week_start = week_start_of(today) - timedelta(weeks=3)
    origin_weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=origin_week_start)
    dest_month_first = months_after(today.replace(day=1), 1)
    dest_monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=dest_month_first)
    successor_wm = Task.objects.create(
        monthly_log=dest_monthly_log,
        title=${JSON.stringify(destWeeklySuccessorTitle)},
        status="pending",
        order_index=1.0,
    )
    Task.objects.create(
        weekly_log=origin_weekly_log,
        title=${JSON.stringify(originWeeklyTaskTitle)},
        status="migrated",
        migration_count=1,
        migrated_to_task=successor_wm,
        order_index=1.0,
    )

    origin_month_first = months_before(today.replace(day=1), 3)
    origin_monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=origin_month_first)
    dest_log_date = today + timedelta(days=1)
    dest_log, _ = Log.objects.get_or_create(log_date=dest_log_date)
    successor_md = Task.objects.create(
        log=dest_log,
        title=${JSON.stringify(destMonthlySuccessorTitle)},
        status="pending",
        order_index=1.0,
    )
    Task.objects.create(
        monthly_log=origin_monthly_log,
        title=${JSON.stringify(originMonthlyTaskTitle)},
        status="migrated",
        migration_count=1,
        migrated_to_task=successor_md,
        order_index=1.0,
    )

    print(json.dumps({
        "originWeekStart": origin_week_start.isoformat(),
        "destMonthFirst": dest_month_first.isoformat(),
        "originMonthFirst": origin_month_first.isoformat(),
        "destLogDate": dest_log_date.isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a
  // última linha não-vazia é o `print` de verdade (mesma técnica de
  // `seedArchiveScenario.ts`).
  const lines = output.toString().trim().split('\n')
  const parsed = JSON.parse(lines[lines.length - 1]) as {
    originWeekStart: string
    destMonthFirst: string
    originMonthFirst: string
    destLogDate: string
  }
  return {
    ...parsed,
    originWeeklyTaskTitle,
    destWeeklySuccessorTitle,
    originMonthlyTaskTitle,
    destMonthlySuccessorTitle,
  }
}
