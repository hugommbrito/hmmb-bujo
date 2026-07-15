import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 11.5 (AC4): fechar o ciclo CORRENTE (semana/mês desta sessão, não um
// período passado como em `seedArchiveScenario.ts`) não tem affordance de UI
// além de dispor manualmente todas as tarefas — por isso o seed direto via
// `manage.py shell` + `tenant_context`, mesma técnica de `seedArchiveScenario.ts`.
// Uma única tarefa já `completed` no container basta: `is_container_closed`
// exige só "existe >=1 tarefa E nenhuma pending/started" (services/archive.py).
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedClosedCycleScenarioResult {
  weekStart: string
  monthFirst: string
}

export function seedClosedCycleScenario(email: string): SeedClosedCycleScenarioResult {
  const script = `
import json
from accounts.models import User
from bujo.models import MonthlyLog, Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    week_start = week_start_of(today)
    month_first = today.replace(day=1)

    weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)
    Task.objects.create(
        weekly_log=weekly_log,
        title="Tarefa concluída (fecha a semana)",
        status="completed",
        order_index=1.0,
    )

    monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=month_first)
    Task.objects.create(
        monthly_log=monthly_log,
        title="Tarefa concluída (fecha o mês)",
        status="completed",
        order_index=1.0,
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
  // `seedArchiveScenario.ts`).
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedClosedCycleScenarioResult
}

// AC3: excluir uma tarefa com linhagem de migração só pode cancelar, nunca
// hard-delete — não há affordance de UI pra criar essa linhagem sem rodar uma
// migração real inteira, por isso o seed direto do campo `migration_count`.
export function seedWeeklyTaskWithLineage(email: string, title: string): void {
  const script = `
from accounts.models import User
from bujo.models import Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    week_start = week_start_of(today)
    weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)
    Task.objects.create(
        weekly_log=weekly_log,
        title=${JSON.stringify(title)},
        status="pending",
        migration_count=2,
        order_index=1.0,
    )
`.trim()

  execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
}
