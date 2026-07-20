import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 8.1 (cadastro de medicamentos): seed direto pela camada de serviço
// (`create_time_block` + `create_medication` + `set_schedule`), dando controle exato
// do estado versionado para cenários determinísticos (ex.: desativar uma agenda já
// existente). Mesma técnica de `seedHealthFields.ts`/`seedHabits.ts`. Retorna os UUIDs
// criados — chaves estáveis que a 8.2 vai consumir em `medication_day_entries`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeededMedication {
  medicationId: string
  blockId: string
}

function runShell(script: string): string {
  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedHealthFields.ts`).
  const lines = output.toString().trim().split('\n')
  return lines[lines.length - 1]
}

// Cria um bloco de horário + um medicamento (com substância vigente) + uma agenda de
// dose ativa para o usuário já cadastrado via UI (fixture `email`). Retorna
// {medicationId, blockId}.
export function seedMedication(
  email: string,
  opts: { title: string; substanceName: string; blockName: string; dose: unknown },
): SeededMedication {
  const script = `
import json
from accounts.models import User
from core.tenant import tenant_context
from medications.services import create_medication, create_time_block, set_schedule

user = User.objects.get(email=${JSON.stringify(email)})
opts = json.loads(${JSON.stringify(JSON.stringify(opts))})
with tenant_context(user):
    block = create_time_block(user=user, name=opts["blockName"])
    med = create_medication(
        user=user, title=opts["title"], substance_name=opts["substanceName"]
    )
    set_schedule(
        user=user, medication_id=med.id, time_block_id=block.id, dose=opts["dose"]
    )
print(json.dumps({"medicationId": str(med.id), "blockId": str(block.id)}))
`.trim()

  return JSON.parse(runShell(script)) as SeededMedication
}
