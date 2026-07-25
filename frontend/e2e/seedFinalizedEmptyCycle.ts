import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 14.1 (AC6): o buraco que `status = finalized` fecha é o ciclo finalizado
// e VAZIO — `is_container_closed` exige `total_tasks > 0`, então antes desta story
// um ciclo finalizado sem nenhuma tarefa continuava mutável e fora do Arquivo.
//
// Por que seed direto (e não o ritual pela API, como no resto do spec): chegar a
// `finalized` pelo ritual exige o PRÓXIMO ciclo já registrado como `planning`, o
// que criaria uma segunda semana no cenário e embaralharia a asserção do Arquivo.
// O cenário aqui é deliberadamente degenerado (uma semana, zero tarefas), que é
// exatamente o caso que a derivação não representava. Mesma técnica de
// `seedClosedCycleScenario.ts`: `manage.py shell` + `tenant_context`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedFinalizedEmptyCycleResult {
  weekStart: string
}

export function seedFinalizedEmptyWeekly(email: string): SeedFinalizedEmptyCycleResult {
  const script = `
import json
from accounts.models import User
from bujo.models import WeeklyLog
from core.calendar import today_for, week_start_of
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    week_start = week_start_of(today_for(user))
    weekly_log, _ = WeeklyLog.objects.get_or_create(week_start=week_start)
    # Estado explícito, ZERO tarefas: o ciclo é fechado pelo ritual, não pelo
    # conteúdo. Nenhuma outra semana entra no cenário.
    weekly_log.status = "finalized"
    weekly_log.save(update_fields=["status"])
    assert weekly_log.tasks.count() == 0, "o cenário exige o ciclo VAZIO"

    print(json.dumps({"weekStart": week_start.isoformat()}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedArchiveScenario.ts`).
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedFinalizedEmptyCycleResult
}
