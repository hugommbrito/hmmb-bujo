import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 12.5 (captura externa `POST /api/capture`): emite um `AutomationToken`
// real com escopo `capture` para um usuário (por email), materializado direto
// pela camada de modelo (`AutomationToken.issue`) — o mesmo caminho que um
// operador usaria fora da UI (não há UI de emissão de token; ver Story 12.4).
// Retorna o segredo pleno (`bujo_<...>`) para o spec disparar a captura externa
// via HTTP com `Authorization: Bearer <full>`, fielmente ao atalho do iPhone.
//
// Mesma técnica de `seedGratitude.ts`/`seedMedications.ts`: roda contra a branch
// Neon `e2e` (via `DJANGO_SETTINGS_MODULE`), a mesma que o `runserver` do
// Playwright serve — logo o token emitido aqui é encontrável pela auth do
// endpoint e o item capturado cai no mesmo banco que o browser lê.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

function runShell(script: string): string {
  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedGratitude.ts`).
  const lines = output.toString().trim().split('\n')
  return lines[lines.length - 1]
}

export function issueAutomationToken(email: string): { full: string; prefix: string } {
  const script = `
import json
from accounts.models import User
from automation.models import SCOPE_CAPTURE, AutomationToken

user = User.objects.get(email=${JSON.stringify(email)})
token, full = AutomationToken.issue(user=user, name="e2e capture", scopes=[SCOPE_CAPTURE])
print(json.dumps({"full": full, "prefix": token.token_prefix}))
`.trim()

  return JSON.parse(runShell(script)) as { full: string; prefix: string }
}
