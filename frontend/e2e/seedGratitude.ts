import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 9.1 (Diário de Gratidão): seed direto pela camada de serviço
// (`create_gratitude_entry`) dentro de `tenant_context`, dando controle exato da data
// (ex.: uma entrada em "ontem" para exercitar o link contextual). Mesma técnica de
// `seedMedications.ts`/`seedHealthFields.ts`.
//
// A data é computada NO SERVIDOR (`today_for(user) - daysAgo`), então casa exatamente
// com o alvo do link "Gratidão de ontem" do /today (que também deriva de today_for) —
// robusto a divergências de fuso entre o navegador do E2E e o fuso do usuário. Retorna
// {id, date} (a data ISO efetivamente usada).
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

function runShell(script: string): string {
  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última linha
  // não-vazia é o `print` de verdade (mesma técnica de `seedMedications.ts`).
  const lines = output.toString().trim().split('\n')
  return lines[lines.length - 1]
}

export function seedGratitudeEntry(
  email: string,
  opts: { text: string; daysAgo?: number },
): { id: string; date: string } {
  const script = `
import json
from datetime import timedelta
from accounts.models import User
from core.calendar import today_for
from core.tenant import tenant_context
from gratitude.services import create_gratitude_entry

user = User.objects.get(email=${JSON.stringify(email)})
opts = json.loads(${JSON.stringify(JSON.stringify(opts))})
with tenant_context(user):
    day = today_for(user) - timedelta(days=opts.get("daysAgo", 0))
    entry = create_gratitude_entry(user=user, date=day, text=opts["text"])
print(json.dumps({"id": str(entry.id), "date": day.isoformat()}))
`.trim()

  return JSON.parse(runShell(script)) as { id: string; date: string }
}
