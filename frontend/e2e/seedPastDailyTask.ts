import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 11.11 (AC2/AC3): uma tarefa num Daily Log passado só existe hoje via
// seed direto (`TaskCreateView`/`AddTaskRow` não aceitam uma data arbitrária —
// Dev Notes "Escopo de 'agir sobre as tarefas'"). Generaliza a técnica de
// `seedYesterdayQueue.ts` (Story 4.2): o `log_date` é a SEGUNDA-FEIRA de
// `weeksAgo` semanas atrás (`week_start_of`, mesma autoridade usada pelo
// backend) — garante que o dia seedado caia exatamente na semana alcançada
// clicando "Semana anterior" `weeksAgo` vezes a partir de Esta Semana,
// sem o teste precisar reproduzir aritmética de calendário.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedPastDailyTaskResult {
  logDate: string
}

// Cria um Daily Log na segunda-feira de `weeksAgo` semanas atrás com uma
// única tarefa-raiz `pending`, para o usuário já cadastrado via UI (`email`
// fixture).
export function seedPastDailyTask(
  email: string,
  weeksAgo: number,
  title: string,
): SeedPastDailyTaskResult {
  const script = `
import json
from datetime import timedelta
from accounts.models import User
from bujo.models import Log, Task
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    log_date = week_start_of(today_for(user)) - timedelta(weeks=${weeksAgo})
    log = Log.objects.create(log_date=log_date)
    Task.objects.create(log=log, title=${JSON.stringify(title)}, status="pending", order_index=1.0)
    print(json.dumps({"logDate": log_date.isoformat()}))
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
  return JSON.parse(lines[lines.length - 1]) as SeedPastDailyTaskResult
}
