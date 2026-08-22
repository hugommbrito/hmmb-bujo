import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.7 (AC1/AC9): cenário do Future Log do sistema novo — molde direto de
// `seedMonthlyBoardScenario.ts` (14.6).
//
// O horizonte SEMPRE começa em `âncora + 1 mês`, e o âncora tem piso no mês
// corrente (AC2): o 1º mês do horizonte é, portanto, `mês corrente + 1`. É a
// partir dessa invariante que o seed calcula os alvos — nunca de uma data fixa.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

const SHIFT_MONTHS_HELPER = `
def shift_months(d, delta):
    total = d.year * 12 + (d.month - 1) + delta
    year, month = divmod(total, 12)
    return d.replace(year=year, month=month + 1, day=1)
`.trim()

export interface SeedFutureLogScenarioResult {
  /** Mês corrente ("AAAA-MM-01") — o âncora quando não há `active` adiantado. */
  anchorMonthFirst: string
  /** 1º mês do horizonte = foco default da superfície. */
  firstHorizonMonthFirst: string
  /** 2º mês do horizonte — usado para provar a troca de foco. */
  secondHorizonMonthFirst: string
  /** 8º (último) mês do horizonte — nomeado no estado vazio do "Ir para mês…". */
  lastHorizonMonthFirst: string
  /** Mês DISTANTE (além do horizonte) com item — aparece só no seletor. */
  distantMonthFirst: string
}

export function seedFutureLogScenario(email: string): SeedFutureLogScenarioResult {
  const script = `
import json
from accounts.models import User
from bujo.models import MonthlyLog, Task
from core.calendar import today_for
from core.tenant import tenant_context

${SHIFT_MONTHS_HELPER}

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    anchor = today_for(user).replace(day=1)
    first = shift_months(anchor, 1)
    second = shift_months(anchor, 2)
    last = shift_months(anchor, 8)
    distant = shift_months(anchor, 20)

    first_log, _ = MonthlyLog.objects.get_or_create(month_first=first)
    Task.objects.create(
        monthly_log=first_log, title="Renovar passaporte", status="pending",
        scheduled_date=first.replace(day=14), order_index=1.0,
    )
    Task.objects.create(
        monthly_log=first_log, title="Aniversario da Maria", status="pending",
        scheduled_date=first.replace(day=20), order_index=2.0,
    )
    # Sem dia: é o item que "Definir dia" exercita, e o que prova a ordenação
    # dia → sem-dia (criado com order_index 3 mas SEM data, tem que ficar por último).
    Task.objects.create(
        monthly_log=first_log, title="Consulta com a dentista", status="pending",
        scheduled_date=None, order_index=3.0,
    )

    second_log, _ = MonthlyLog.objects.get_or_create(month_first=second)
    Task.objects.create(
        monthly_log=second_log, title="Item do segundo mes", status="pending",
        scheduled_date=None, order_index=1.0,
    )

    distant_log, _ = MonthlyLog.objects.get_or_create(month_first=distant)
    Task.objects.create(
        monthly_log=distant_log, title="Item bem distante", status="pending",
        scheduled_date=None, order_index=1.0,
    )

    print(json.dumps({
        "anchorMonthFirst": anchor.isoformat(),
        "firstHorizonMonthFirst": first.isoformat(),
        "secondHorizonMonthFirst": second.isoformat(),
        "lastHorizonMonthFirst": last.isoformat(),
        "distantMonthFirst": distant.isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedFutureLogScenarioResult
}

/** Cenário VAZIO: nenhum item em lugar nenhum — prova o "empty global" e o
 * estado vazio do seletor "Ir para mês…" (par não-vacuoso do seed acima). */
export function seedFutureLogEmpty(email: string): SeedFutureLogScenarioResult {
  const script = `
import json
from accounts.models import User
from core.calendar import today_for
from core.tenant import tenant_context

${SHIFT_MONTHS_HELPER}

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    anchor = today_for(user).replace(day=1)
    print(json.dumps({
        "anchorMonthFirst": anchor.isoformat(),
        "firstHorizonMonthFirst": shift_months(anchor, 1).isoformat(),
        "secondHorizonMonthFirst": shift_months(anchor, 2).isoformat(),
        "lastHorizonMonthFirst": shift_months(anchor, 8).isoformat(),
        "distantMonthFirst": shift_months(anchor, 20).isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedFutureLogScenarioResult
}

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

/** "Agosto de 2026" — o mesmo rótulo que o trilho e o cabeçalho de foco usam. */
export function monthTitleOf(monthFirst: string): string {
  const [year, month] = monthFirst.split('-').map(Number)
  return `${MONTH_NAMES_PT[month - 1]} de ${year}`
}
