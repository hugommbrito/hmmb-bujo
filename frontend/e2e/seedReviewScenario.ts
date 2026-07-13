import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Story 4.3 (Revisão semanal/mensal e pull automático do Future Log): as
// filas de revisão só existem a partir de Weekly/Monthly Log ANTERIORES, e o
// "pull do Future Log" só é observável com uma tarefa já residente no Monthly
// Log CORRENTE sem `scheduledDate` (Dev Notes "Pull do Future Log é
// armazenamento, não uma ação nova"). Nenhuma dessas 3 situações tem
// affordance de UI para o cliente criar diretamente — mesma técnica de
// `seedYesterdayQueue.ts` (4.2): seed direto no banco de dev via
// `manage.py shell` + `tenant_context`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedTaskInput {
  title: string
  status?: 'pending' | 'started' | 'completed' | 'cancelled'
  description?: string
  children?: SeedTaskInput[]
}

export interface SeedReviewScenarioInput {
  previousWeekTasks?: SeedTaskInput[]
  previousMonthTasks?: SeedTaskInput[]
  currentMonthTasksWithoutDate?: SeedTaskInput[]
}

export function seedReviewScenario(email: string, input: SeedReviewScenarioInput): void {
  const script = `
import json
from datetime import timedelta
from accounts.models import User
from bujo.models import MonthlyLog, Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})
previous_week_tasks = json.loads(${JSON.stringify(JSON.stringify(input.previousWeekTasks ?? []))})
previous_month_tasks = json.loads(${JSON.stringify(JSON.stringify(input.previousMonthTasks ?? []))})
current_month_tasks = json.loads(${JSON.stringify(JSON.stringify(input.currentMonthTasksWithoutDate ?? []))})

with tenant_context(user):
    today = today_for(user)
    current_month_first = today.replace(day=1)
    previous_month_first = (current_month_first - timedelta(days=1)).replace(day=1)
    previous_week_start = week_start_of(today) - timedelta(weeks=1)

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

    if previous_week_tasks:
        weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=previous_week_start)
        for root_index, root in enumerate(previous_week_tasks):
            create_tree(root, "weekly_log", weekly_log, None, float(root_index + 1))

    if previous_month_tasks:
        previous_monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=previous_month_first)
        for root_index, root in enumerate(previous_month_tasks):
            create_tree(root, "monthly_log", previous_monthly_log, None, float(root_index + 1))

    if current_month_tasks:
        current_monthly_log, _ = MonthlyLog.objects.get_or_create(month_first=current_month_first)
        for root_index, root in enumerate(current_month_tasks):
            create_tree(root, "monthly_log", current_monthly_log, None, float(root_index + 1))
`.trim()

  execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings.dev' },
    stdio: 'pipe',
  })
}
