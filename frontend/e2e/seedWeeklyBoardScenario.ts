import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.5 (AC1/AC9): cenário do Weekly Board do sistema novo — algumas
// tarefas espalhadas pela semana corrente + o pool, para exercitar
// composição/filtros/contagens sem depender do que a sessão de teste cria
// pela própria UI. Mesma técnica de `seedClosedCycleScenario.ts`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedWeeklyBoardScenarioResult {
  weekStart: string
}

export function seedWeeklyBoardScenario(email: string): SeedWeeklyBoardScenarioResult {
  const script = `
import json
from accounts.models import User
from bujo.models import Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    week_start = week_start_of(today_for(user))
    weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)

    Task.objects.create(
        weekly_log=weekly_log, title="Pendente na segunda", status="pending",
        scheduled_date=week_start, order_index=1.0,
    )
    Task.objects.create(
        weekly_log=weekly_log, title="Concluída na segunda", status="completed",
        scheduled_date=week_start, order_index=2.0,
    )
    Task.objects.create(
        weekly_log=weekly_log, title="Sem dia definido", status="pending",
        scheduled_date=None, order_index=1.0,
    )

    print(json.dumps({"weekStart": week_start.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedWeeklyBoardScenarioResult
}

// AC3: uma semana `finalized` COM tarefas (`seedFinalizedEmptyCycle.ts` exige
// zero tarefas de propósito — o cenário oposto, aqui, prova o readonly com
// conteúdo de verdade). Alvo: 2 semanas atrás, para nunca colidir com a
// semana corrente que o resto do spec navega. Inclui também um par
// migrada/sucessora (Segunda → Terça) — a matriz status×ciclo da AC2 (Dev
// Notes) afirma que a seta de linhagem é "a única mutação-zero que sobrevive
// ao readonly", e o pool fica vazio de propósito para provar "o pool aparece
// sempre, inclusive vazio" também no regime finalizado.
export interface SeedFinalizedWeekWithTasksResult {
  weekStart: string
}

export function seedFinalizedWeekWithTasks(email: string): SeedFinalizedWeekWithTasksResult {
  const script = `
import json
from accounts.models import User
from bujo.models import Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context
from datetime import timedelta

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    week_start = week_start_of(today_for(user)) - timedelta(weeks=2)
    weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)
    Task.objects.create(
        weekly_log=weekly_log, title="Tarefa da semana finalizada", status="completed",
        scheduled_date=week_start, order_index=1.0,
    )
    successor = Task.objects.create(
        weekly_log=weekly_log, title="Sucessora na finalizada", status="pending",
        scheduled_date=week_start + timedelta(days=1), order_index=1.0,
    )
    Task.objects.create(
        weekly_log=weekly_log, title="Origem migrada na finalizada", status="migrated",
        scheduled_date=week_start, order_index=2.0, migrated_to_task=successor,
    )
    weekly_log.status = "finalized"
    weekly_log.save(update_fields=["status"])

    print(json.dumps({"weekStart": week_start.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedFinalizedWeekWithTasksResult
}

// AC2 (navegação de linhagem): par migrada/sucessora na semana CORRENTE
// (Segunda → Terça), fora do regime finalizado — prova o ciclo completo de
// clique → scroll → destaque → foco contra o browser real (jsdom não
// executa `scrollIntoView`/foco de verdade).
export interface SeedWeeklyBoardLineageScenarioResult {
  weekStart: string
}

export function seedWeeklyBoardLineageScenario(email: string): SeedWeeklyBoardLineageScenarioResult {
  const script = `
import json
from accounts.models import User
from bujo.models import Task, WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context
from datetime import timedelta

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    week_start = week_start_of(today_for(user))
    weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)

    successor = Task.objects.create(
        weekly_log=weekly_log, title="Sucessora da migração", status="pending",
        scheduled_date=week_start + timedelta(days=1), order_index=1.0,
    )
    Task.objects.create(
        weekly_log=weekly_log, title="Origem da migração", status="migrated",
        scheduled_date=week_start, order_index=1.0, migrated_to_task=successor,
    )

    print(json.dumps({"weekStart": week_start.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedWeeklyBoardLineageScenarioResult
}
