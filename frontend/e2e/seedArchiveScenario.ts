import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 4.6 (Fechamento de ciclos e Arquivo): um ciclo só entra no Arquivo se
// TODAS as suas tarefas já tiverem disposição (FR-1.10) — não há affordance
// de UI para o cliente compor de propósito uma semana/mês passado inteiramente
// disposto, por isso o seed direto no banco de teste (branch Neon `e2e`) via
// `manage.py shell` + `tenant_context`, mesma técnica de
// `seedReviewScenario.ts` (4.3). 2
// semanas/meses atrás (não 1) evita qualquer sobreposição com as janelas de
// "semana/mês anterior" da revisão (4.3), que ficariam pendentes e disparariam
// banners não relacionados a este cenário caso o teste volte para `/today`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedArchiveTaskInput {
  title: string
  status?: 'pending' | 'started' | 'completed' | 'cancelled' | 'migrated' | 'postponed'
  migrationCount?: number
}

export interface SeedArchiveScenarioInput {
  closedWeekTasks: SeedArchiveTaskInput[]
  closedMonthTasks: SeedArchiveTaskInput[]
}

export interface SeedArchiveScenarioResult {
  weekStart: string
  monthFirst: string
}

export function seedArchiveScenario(
  email: string,
  input: SeedArchiveScenarioInput,
): SeedArchiveScenarioResult {
  const script = `
import json
from datetime import timedelta
from accounts.models import User
from bujo.models import MonthlyLog, Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

def months_before(d, n):
    year, month = d.year, d.month - n
    while month <= 0:
        month += 12
        year -= 1
    return d.replace(year=year, month=month, day=1)

user = User.objects.get(email=${JSON.stringify(email)})
week_tasks = json.loads(${JSON.stringify(JSON.stringify(input.closedWeekTasks))})
month_tasks = json.loads(${JSON.stringify(JSON.stringify(input.closedMonthTasks))})

with tenant_context(user):
    today = today_for(user)
    week_start = week_start_of(today) - timedelta(weeks=2)
    month_first = months_before(today.replace(day=1), 2)

    weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)
    for index, spec in enumerate(week_tasks):
        Task.objects.create(
            weekly_log=weekly_log,
            title=spec["title"],
            status=spec.get("status", "completed"),
            migration_count=spec.get("migrationCount", 0),
            order_index=float(index + 1),
        )

    monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)
    for index, spec in enumerate(month_tasks):
        Task.objects.create(
            monthly_log=monthly_log,
            title=spec["title"],
            status=spec.get("status", "completed"),
            migration_count=spec.get("migrationCount", 0),
            order_index=float(index + 1),
        )

    print(json.dumps({"weekStart": week_start.isoformat(), "monthFirst": month_first.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a
  // última linha não-vazia é o `print` de verdade (mesma técnica de
  // `queryMigrationCount` em seedCatchUpScenario.ts).
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedArchiveScenarioResult
}
