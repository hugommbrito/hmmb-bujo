import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 7.2 (log diário de saúde): a superfície `/health/metrics` só consome as
// definições ATIVAS do catálogo `health_field_definitions` (Story 7.1). A UI de
// config vive em `/settings/health-metrics`, mas aqui seedamos direto pela camada
// de serviço (`create_health_field`) para dar controle exato de nome/tipo/opções
// e exercitar o log de forma determinística — mesma técnica de `seedHabits.ts`.
// A Story 7.2 chaveia os valores do JSONB pelo UUID de cada definição, então o
// map {nome: uuid} devolvido aqui é a fonte de verdade das chaves persistidas.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface HealthFieldSpec {
  name: string
  fieldType: 'integer' | 'decimal' | 'boolean' | 'enum' | 'text'
  enumOptions?: string[]
}

function runShell(script: string): string {
  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedHabits.ts`).
  const lines = output.toString().trim().split('\n')
  return lines[lines.length - 1]
}

// Cria definições de campo de saúde ATIVAS para o usuário já cadastrado via UI
// (fixture `email`). Retorna o map {nome: uuid} — os UUIDs são exatamente as
// chaves que a 7.2 grava em `health_logs.values`.
export function seedHealthFields(
  email: string,
  fields: HealthFieldSpec[],
): Record<string, string> {
  const script = `
import json
from accounts.models import User
from core.tenant import tenant_context
from health.services import create_health_field

user = User.objects.get(email=${JSON.stringify(email)})
specs = json.loads(${JSON.stringify(JSON.stringify(fields))})
out = {}
with tenant_context(user):
    for spec in specs:
        field = create_health_field(
            user=user,
            name=spec["name"],
            field_type=spec["fieldType"],
            enum_options=spec.get("enumOptions") or None,
        )
        out[spec["name"]] = str(field.id)
print(json.dumps(out))
`.trim()

  return JSON.parse(runShell(script)) as Record<string, string>
}

// Ativa/desativa uma definição por nome (Story 7.1) — a alavanca da AC4 da 7.2:
// um campo desativado some do log ATIVO mas seu valor histórico no JSONB é
// PRESERVADO (o upsert faz merge, nunca replace). Reativar o traz de volta com o
// valor intacto. `objects` já é auto-escopado por tenant dentro de
// `tenant_context` (o filtro `active` só existe em `list_health_fields`, não no
// manager — então acha a definição inativa também).
export function setHealthFieldActive(email: string, name: string, active: boolean): void {
  const script = `
from accounts.models import User
from core.tenant import tenant_context
from health.models import HealthFieldDefinition
from health.services import update_health_field

user = User.objects.get(email=${JSON.stringify(email)})
with tenant_context(user):
    field = HealthFieldDefinition.objects.get(name=${JSON.stringify(name)})
    update_health_field(user=user, field_id=field.id, active=${active ? 'True' : 'False'})
print("ok")
`.trim()

  runShell(script)
}
