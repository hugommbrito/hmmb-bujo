import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 4.4 (Catch-Up de dias pulados): `CatchUpQueueView` só cobre o que é
// MAIS ANTIGO que "ontem"/"semana anterior"/"mês anterior" (as janelas da
// 4.2/4.3) — não há affordance de UI para criar dados nesse passado mais
// distante, por isso o seed via `manage.py shell` + `tenant_context`, mesma
// técnica de `seedYesterdayQueue.ts`/`seedReviewScenario.ts`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedTaskInput {
  title: string
  status?: 'pending' | 'started' | 'completed' | 'cancelled'
  description?: string
  children?: SeedTaskInput[]
}

export interface SeedCatchUpScenarioInput {
  monthlyTasks?: SeedTaskInput[]
  weeklyTasks?: SeedTaskInput[]
  dailyTasks?: SeedTaskInput[]
}

export function seedCatchUpScenario(email: string, input: SeedCatchUpScenarioInput): void {
  const script = `
import json
from datetime import timedelta
from accounts.models import User
from bujo.models import Log, MonthlyLog, Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})
monthly_tasks = json.loads(${JSON.stringify(JSON.stringify(input.monthlyTasks ?? []))})
weekly_tasks = json.loads(${JSON.stringify(JSON.stringify(input.weeklyTasks ?? []))})
daily_tasks = json.loads(${JSON.stringify(JSON.stringify(input.dailyTasks ?? []))})

def months_before(d, n):
    year, month = d.year, d.month - n
    while month <= 0:
        month += 12
        year -= 1
    return d.replace(year=year, month=month, day=1)

with tenant_context(user):
    today = today_for(user)
    # 3 meses/semanas/dias atrás — nenhum coincide com "ontem"/"semana
    # anterior"/"mês anterior" (as janelas da 4.2/4.3), evitando sobreposição
    # com os banners já existentes no mesmo cenário de teste.
    old_month_first = months_before(today.replace(day=1), 3)
    old_week_start = week_start_of(today) - timedelta(weeks=3)
    old_date = today - timedelta(days=10)

    def create_tree(spec, container_field, container, parent, order):
        task = Task.objects.create(
            parent_task=parent,
            title=spec["title"],
            description=spec.get("description"),
            status=spec.get("status", "pending"),
            order_index=order,
            **{container_field: container},
        )
        for child_index, child in enumerate(spec.get("children", [])):
            create_tree(child, container_field, container, task, order + (child_index + 1) / 10)

    if monthly_tasks:
        monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=old_month_first)
        for root_index, root in enumerate(monthly_tasks):
            create_tree(root, "monthly_log", monthly_log, None, float(root_index + 1))

    if weekly_tasks:
        weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=old_week_start)
        for root_index, root in enumerate(weekly_tasks):
            create_tree(root, "weekly_log", weekly_log, None, float(root_index + 1))

    if daily_tasks:
        log, _ = Log.objects.get_or_create(log_date=old_date)
        for root_index, root in enumerate(daily_tasks):
            create_tree(root, "log", log, None, float(root_index + 1))
`.trim()

  execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
}

// Verificação pós-decisão (Task 10.4): `migration_count` do registro migrado
// tem que ser 1 por decisão — não o número de dias pulados (AC #1). Consulta
// direta ao ORM, mesma técnica de seed acima.
export function queryMigrationCount(email: string, title: string): number {
  const script = `
from accounts.models import User
from bujo.models import Task
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})
with tenant_context(user):
    # A tarefa original (agora status=migrated) e a cópia recriada no destino
    # compartilham o mesmo title — só a cópia viva (não-migrada) é o registro
    # que a AC #1 pede para inspecionar.
    task = Task.objects.exclude(status="migrated").get(title=${JSON.stringify(title)})
    print(task.migration_count)
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner ("N objects imported automatically...")
  // antes de rodar o script — só a última linha não-vazia é o `print` de verdade.
  const lines = output.toString().trim().split('\n')
  return Number(lines[lines.length - 1])
}
