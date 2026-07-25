import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.2 (AC7): "nenhum endpoint desta story materializa log". No pytest isso
// é provado contando linhas no Postgres efêmero; aqui a prova precisa valer no
// banco REAL da branch Neon `e2e`, com o ciclo de request completo (JWT +
// middleware de tenant) em vez de chamada direta a serviço.
//
// Por que `manage.py shell` e não uma rota: contar containers PELA API é
// impossível sem materializá-los — `GET /api/bujo/logs/weekly/` faz
// `get_or_create` de propósito (é o comportamento legado que a AC4 da 14.1
// blindou). A contagem tem que vir de fora do fio. Mesma técnica de
// `seedFinalizedEmptyCycle.ts`/`seedClosedCycleScenario.ts`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface RitualContainerCounts {
  weekly: number
  monthly: number
  daily: number
  decisions: number
}

export function countRitualContainers(email: string): RitualContainerCounts {
  const script = `
import json
from accounts.models import User
from bujo.models import Log, MonthlyLog, RitualDecision, WeeklyLog
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    print(json.dumps({
        "weekly": WeeklyLog.objects.count(),
        "monthly": MonthlyLog.objects.count(),
        "daily": Log.objects.count(),
        "decisions": RitualDecision.objects.count(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes do script — só a última linha
  // não-vazia é o `print` de verdade.
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as RitualContainerCounts
}
