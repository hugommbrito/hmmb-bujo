import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 13.2 (badge do Brain Dump com cap `9+`): o contrato só se manifesta ACIMA
// de 9 itens pendentes, e capturar 10+ itens pelo formulário da UI custaria dezenas
// de round-trips por teste. Seed direto pela camada de serviço
// (`create_brain_dump_item`) dentro de `tenant_context` — mesma técnica de
// `seedGratitude.ts`/`seedMedications.ts`, contra a mesma branch Neon `e2e` que o
// `runserver` do Playwright serve, então o browser lê exatamente estes itens.
//
// Sem mock de rede: a contagem continua vindo de `GET /api/brain-dump/count/`
// real (server state derivado — Story 5.2); aqui só se materializa o cenário.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

/**
 * Cria `count` itens pendentes no Brain Dump do usuário (já cadastrado via UI
 * pela fixture `email`) e devolve a contagem confirmada pelo backend.
 */
export function seedBrainDumpItems(email: string, count: number): number {
  const script = `
import json
from accounts.models import User
from braindump.services import count_brain_dump_items, create_brain_dump_item
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})
with tenant_context(user):
    for index in range(${count}):
        create_brain_dump_item(user=user, title=f"Item semeado {index + 1}")
    total = count_brain_dump_items(user=user)
print(json.dumps({"count": total}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedGratitude.ts`).
  const lines = output.toString().trim().split('\n')
  return (JSON.parse(lines[lines.length - 1]) as { count: number }).count
}
