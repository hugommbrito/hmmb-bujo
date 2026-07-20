import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 7.3 (histórico de saúde em três visualizações): a superfície de histórico
// (`/health/metrics/history`) é read-only e NÃO semeia — só existe série/tabela se
// houver linhas passadas em `health_logs`. O log da 7.2 grava HOJE/ONTEM pela UI, mas
// um histórico determinístico precisa de dias mais antigos seedados direto pela camada
// de dados — mesma técnica de `seedHabitHistory.ts` (6.4) / `seedHealthFields.ts` (7.2).
// Aqui montamos, para o usuário já cadastrado via UI (`email` fixture):
//  - o catálogo (7.1) cobrindo os tipos: "Peso" (decimal) + "Passos" (integer)
//    numéricos/plotáveis; "Dormiu bem" (boolean); "Humor" (enum); "Observações" (text);
//  - "Pressão" (integer) que é DESATIVADO após receber um valor no range → prova a
//    Decisão 3 (coluna/cartão de campo INATIVO-COM-VALOR persiste — a 7.2 preserva o
//    histórico ao desativar; esconder apagaria o passado);
//  - "Campo Antigo" (integer) DESATIVADO e SEM valor → prova o inverso (inativo sem
//    valor é EXCLUÍDO da tabela/dashboard);
//  - linhas passadas de `health_logs` em d(8)/d(5)/d(2), deixando d(4) SEM linha
//    (dia-lacuna honesto — não aparece na tabela; AC1);
//  - chaves omitidas em dias com linha (ex.: "Dormiu bem" ausente em d(8)) → célula
//    "—" honesta, distinta de um `false` real gravado ("Não") em d(5).
// Aritmética numérica escolhida para bater limpo no formato pt-BR do dashboard:
//  - Passos: 4000/5000/6000 → mín 4.000, máx 6.000, média 5.000, mais recente 6.000.
//  - Peso:   87/89/88       → mín 87, máx 89, média 88, mais recente 88 (≠ máx: prova
//    que "mais recente" = valor na MAIOR data com registro (d2), não o máximo — Decisão 8).
// Todas as datas são relativas a `today_for(user)` (autoridade única de "hoje" do
// backend) — nunca `date.today()` cru (guardrail temporal das retros).
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedHealthHistoryResult {
  pesoId: string
  passosId: string
  dormiuId: string
  humorId: string
  obsId: string
  pressaoId: string
  antigoId: string
  // Dia com registro completo (todos os campos). ISO "YYYY-MM-DD".
  anchorDate: string
  // Dia intermediário (Peso/Passos + "Dormiu bem" = false).
  midDate: string
  // Dia mais antigo (só Peso/Passos; demais campos ausentes → "—").
  oldDate: string
  // Dia SEM nenhuma linha `health_logs` dentro da janela → dia-lacuna honesto.
  gapDate: string
}

// Seeda o cenário de histórico para o usuário já cadastrado via UI (`email` fixture).
export function seedHealthHistory(email: string): SeedHealthHistoryResult {
  const script = `
import json
from datetime import timedelta
from accounts.models import User
from core.calendar import today_for
from core.tenant import tenant_context
from health.models import HealthLog
from health.services import create_health_field, update_health_field

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)

    def d(n):
        return today - timedelta(days=n)

    def mkfield(name, ftype, opts=None):
        return create_health_field(user=user, name=name, field_type=ftype, enum_options=opts)

    peso = mkfield("Peso", "decimal")
    passos = mkfield("Passos", "integer")
    dormiu = mkfield("Dormiu bem", "boolean")
    humor = mkfield("Humor", "enum", ["Bom", "Ruim"])
    obs = mkfield("Observações", "text")
    pressao = mkfield("Pressão", "integer")
    antigo = mkfield("Campo Antigo", "integer")

    # Linhas passadas: uma por dia com registro. As chaves do blob são os UUIDs das
    # definições (vínculo AD-01, sem FK) — exatamente o que a 7.3 lê/casta.
    HealthLog.objects.create(date=d(8), values={str(peso.id): 87, str(passos.id): 4000})
    HealthLog.objects.create(
        date=d(5),
        values={str(peso.id): 89, str(passos.id): 5000, str(dormiu.id): False},
    )
    HealthLog.objects.create(
        date=d(2),
        values={
            str(peso.id): 88,
            str(passos.id): 6000,
            str(dormiu.id): True,
            str(humor.id): "Bom",
            str(obs.id): "dia tranquilo",
            str(pressao.id): 120,
        },
    )
    # d(4) NÃO recebe linha → dia-lacuna (não aparece na tabela; AC1).

    # Pressão: inativo COM valor no range → coluna/cartão persistem (Decisão 3).
    # Campo Antigo: inativo SEM valor → excluído da tabela/dashboard (o inverso).
    update_health_field(user=user, field_id=pressao.id, active=False)
    update_health_field(user=user, field_id=antigo.id, active=False)

    print(json.dumps({
        "pesoId": str(peso.id),
        "passosId": str(passos.id),
        "dormiuId": str(dormiu.id),
        "humorId": str(humor.id),
        "obsId": str(obs.id),
        "pressaoId": str(pressao.id),
        "antigoId": str(antigo.id),
        "anchorDate": d(2).isoformat(),
        "midDate": d(5).isoformat(),
        "oldDate": d(8).isoformat(),
        "gapDate": d(4).isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedHabitHistory.ts`).
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedHealthHistoryResult
}
