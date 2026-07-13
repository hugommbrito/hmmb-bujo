import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Story 4.2 (Migração diária) só existe a partir de tarefas `pending`/`started`
// de ONTEM (`today_for(user) - 1 dia`) — e não há nenhuma affordance na UI para
// criar dados no passado (de propósito: a app nunca deixa o cliente rotular um
// dia como "ontem"). O único jeito de montar esse cenário para um E2E real é
// seedar direto no banco de dev que o backend do Playwright já sobe
// (`config.settings.dev`, mesmo Neon dev branch), do mesmo jeito que a
// verificação manual da story fez via `manage.py shell` + `tenant_context`.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedTaskInput {
  title: string
  status?: 'pending' | 'started' | 'completed' | 'cancelled'
  description?: string
  children?: SeedTaskInput[]
}

// Cria um Daily Log de ontem (calculado via `today_for`, não `date.today()` —
// mesma autoridade temporal que `MigrationQueueView` usa) com as tarefas-raiz
// (e subtarefas) dadas, para o usuário já cadastrado via UI (`email` fixture).
export function seedYesterdayQueue(email: string, rootTasks: SeedTaskInput[]): void {
  const script = `
import json
from datetime import timedelta
from accounts.models import User
from bujo.models import Log, Task
from core.calendar import today_for
from core.tenant import tenant_context

user = User.objects.get(email=${JSON.stringify(email)})
root_tasks = json.loads(${JSON.stringify(JSON.stringify(rootTasks))})

with tenant_context(user):
    yesterday = today_for(user) - timedelta(days=1)
    log = Log.objects.create(log_date=yesterday)

    def create_tree(spec, parent, order):
        task = Task.objects.create(
            log=log,
            parent_task=parent,
            title=spec["title"],
            description=spec.get("description"),
            status=spec.get("status", "pending"),
            order_index=order,
        )
        for child_index, child in enumerate(spec.get("children", [])):
            create_tree(child, task, order + (child_index + 1) / 10)

    for root_index, root in enumerate(root_tasks):
        create_tree(root, None, float(root_index + 1))
`.trim()

  execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings.dev' },
    stdio: 'pipe',
  })
}
