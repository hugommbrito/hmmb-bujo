import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'
import { SHIFT_MONTHS_HELPER } from './seedMonthlyBoardScenario'

// Story 14.11 — cenário de REGULARIZAÇÃO ATRASADA, calcado no estado real da
// produção que originou a story: o mês m−2 ficou `active` com uma SUBTAREFA
// `started` sob um pai já `completed` ("Cardiologista" → "Marcar retorno"), o
// mês m−1 está em `planning` com o planejamento já concluído, e hoje é m.
//
// Antes da story: a fonte "Monthly anterior" listava só raízes (0 itens,
// `reviewed: true`) enquanto o gate de finalizar via a subtarefa
// (`ready_to_finalize: false`) — a UI dizia "pronto para finalizar" com o
// botão desabilitado e nenhum destino de `migrate/` alcançava m−1. O spec
// `monthly-planning-ritual.spec.ts` percorre o destravamento ponta a ponta.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedMonthlyCatchUpScenarioResult {
  currentMonthFirst: string
  /** m−1, em `planning` (planejamento já concluído). */
  targetMonthFirst: string
  /** m−2, `active`, com a subtarefa órfã. */
  previousMonthFirst: string
}

export function seedMonthlyCatchUpScenario(email: string): SeedMonthlyCatchUpScenarioResult {
  const script = `
${SHIFT_MONTHS_HELPER}
import json
from accounts.models import User
from bujo.models import MonthlyLog, Task
from core.calendar import now, today_for
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)
    current_month = today.replace(day=1)
    previous_month = shift_months(current_month, -2)
    target_month = shift_months(current_month, -1)

    previous_log, _ = MonthlyLog.objects.get_or_create(month_first=previous_month)
    previous_log.status = "active"
    previous_log.save(update_fields=["status"])
    parent = Task.objects.create(
        monthly_log=previous_log, title="Cardiologista", status="completed",
        scheduled_date=previous_month, order_index=1.0,
    )
    Task.objects.create(
        monthly_log=previous_log, title="Marcar retorno", status="started",
        parent_task=parent, order_index=1.0,
    )

    target_log, _ = MonthlyLog.objects.get_or_create(month_first=target_month)
    target_log.status = "planning"
    target_log.planning_completed_at = now()
    target_log.save(update_fields=["status", "planning_completed_at"])

    print(json.dumps({
        "currentMonthFirst": current_month.isoformat(),
        "targetMonthFirst": target_month.isoformat(),
        "previousMonthFirst": previous_month.isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedMonthlyCatchUpScenarioResult
}

// Cópia de teste de `formatMonthTitle` (`src/features/bujo/monthNames.ts`) — os
// specs E2E não importam código de produção; o texto tem de bater com o que os
// botões nomeados e a faixa renderizam ("Setembro de 2026").
const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function monthTitle(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  return `${MONTH_NAMES_PT[month - 1]} de ${year}`
}
