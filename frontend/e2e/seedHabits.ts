import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 6.2 (tracker diário): o snapshot do dia (`habit_day_entries`) é
// materializado pelo próprio GET `/api/habits/days/` ao abrir a página — mas os
// hábitos e suas versões de config (Story 6.1) precisam existir antes. A UI de
// config vive em `/settings/habits` (Story 6.1); aqui seedamos direto pela
// camada de serviço (`create_habit_group`/`create_habit`, `effective_from =
// hoje`) para dar controle exato de peso/meta/bonus e exercitar o tracker de
// 6.2 de forma determinística — mesma técnica dos demais seeds
// (`seedPastDailyTask.ts`, `seedYesterdayQueue.ts`).
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedHabitAnchorResult {
  groupName: string
}

// Cria o "exemplo âncora" da matemática de completude (Dev Notes da story 6.2):
// grupo "Saúde" com um hábito booleano (peso 1) e um numérico (peso 2, meta
// 5000, bonus 20%, unidade "passos"). Marcar o booleano + registrar 2500 no
// numérico → (1×1 + 0.4×2) / (1+2) = 60%. Versões vigentes a partir de HOJE, então
// o tracker de hoje as materializa na 1ª abertura. Para o usuário já cadastrado
// via UI (fixture `email`).
export function seedHabitAnchor(email: string): SeedHabitAnchorResult {
  const script = `
import json
from accounts.models import User
from core.tenant import tenant_context
from habits.services import create_habit, create_habit_group

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    group = create_habit_group(user=user, name="Saúde")
    create_habit(user=user, name="Meditar", group_id=group.id, type="boolean", weight="1")
    create_habit(
        user=user, name="Passos", group_id=group.id, type="numeric",
        weight="2", meta="5000", bonus="20", unit="passos",
    )
    print(json.dumps({"groupName": group.name}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a
  // última linha não-vazia é o `print` de verdade (mesma técnica de
  // `seedPastDailyTask.ts`).
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedHabitAnchorResult
}
