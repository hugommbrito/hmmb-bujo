import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 6.3 (multiplicador de peso por tipo de dia): a camada de ritmo empilha
// um multiplicador por grupo × tipo de dia sobre o snapshot da 6.2. Como o
// tracker sempre mostra HOJE e o tipo de dia real varia com o dia em que a
// suíte roda, os specs usam o toggle de FERIADO como alavanca determinística
// (precedência holiday > weekend > weekday): marcar feriado força `day_type =
// holiday` em qualquer dia. Aqui seedamos direto pela camada de serviço
// (`create_habit_group`/`create_habit`/`set_group_day_multiplier`, todos com
// `effective_from = hoje`) para dar controle exato de peso/multiplicador —
// mesma técnica dos demais seeds (`seedHabits.ts`, `seedPastDailyTask.ts`).
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedMultiplierResult {
  professionalId: string
  personalId: string | null
}

export interface SeedMultiplierOptions {
  // Se informado, define (prospectivo, effective_from=hoje) o multiplicador de
  // FERIADO do grupo "Profissional". Omitir para configurá-lo pela UI no spec.
  professionalHolidayMultiplier?: string
  // Seeda só o grupo "Profissional" (sem "Pessoal"). Usado pelo spec de config de
  // UI para que os localizadores por-grupo (campo/botão de multiplicador) fiquem
  // inequívocos — com dois grupos haveria dois "Salvar multiplicadores".
  onlyProfessional?: boolean
}

// Cenário âncora do multiplicador (Dev Notes da story 6.3): dois grupos com
// pesos base distintos para que o efeito do peso efetivo na completude seja
// visível e determinístico.
//   - Grupo "Profissional": "Emails" (booleano, peso 2) + "Relatório" (booleano, peso 1).
//   - Grupo "Pessoal": "Ler" (booleano, peso 1) — sem config de multiplicador (×1,0).
// Só o grupo "Profissional" recebe multiplicador de feriado (se informado);
// "Pessoal" fica em 1,0, então ao marcar feriado os dois grupos passam a ter
// pesos efetivos diferentes. Versões vigentes a partir de HOJE, então o tracker
// de hoje as materializa na 1ª abertura. Para o usuário já cadastrado via UI
// (fixture `email`).
export function seedMultiplierScenario(
  email: string,
  options: SeedMultiplierOptions = {},
): SeedMultiplierResult {
  const holiday = options.professionalHolidayMultiplier
  const holidayLine =
    holiday != null
      ? `    set_group_day_multiplier(user=user, group_id=prof.id, day_type="holiday", multiplier=${JSON.stringify(holiday)})`
      : '    pass'
  const personalLines = options.onlyProfessional
    ? [
        '    pessoal = None',
        '    personal_id = None',
      ].join('\n')
    : [
        '    pessoal = create_habit_group(user=user, name="Pessoal")',
        '    create_habit(user=user, name="Ler", group_id=pessoal.id, type="boolean", weight="1")',
        '    personal_id = str(pessoal.id)',
      ].join('\n')

  const script = `
import json
from accounts.models import User
from core.tenant import tenant_context
from habits.services import create_habit, create_habit_group, set_group_day_multiplier

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    prof = create_habit_group(user=user, name="Profissional")
    create_habit(user=user, name="Emails", group_id=prof.id, type="boolean", weight="2")
    create_habit(user=user, name="Relatório", group_id=prof.id, type="boolean", weight="1")
${personalLines}
${holidayLine}
    print(json.dumps({"professionalId": str(prof.id), "personalId": personal_id}))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedHabits.ts`).
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedMultiplierResult
}
