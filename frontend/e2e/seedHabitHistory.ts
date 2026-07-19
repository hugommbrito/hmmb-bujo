import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DJANGO_SETTINGS_MODULE } from './backendEnv'

// Story 6.4 (histórico por data + gráfico de evolução): a superfície de histórico
// é read-only e NÃO semeia — só existem dados se dias passados já tiverem sido
// materializados (`habit_day_entries`) e a config tiver mudado (`habit_versions`).
// O tracker (6.2) só materializa HOJE, então um histórico determinístico precisa
// de linhas passadas seedadas direto pela camada de dados — mesma técnica de
// `seedPastDailyTask.ts` (uma tarefa num Daily Log passado). Aqui montamos:
//  - grupo "Saúde" + "Meditar" (booleano, peso 1) + "Passos" (numérico, peso 2,
//    meta 5000, bonus 20, unidade "passos"), via a camada de serviço (6.1);
//  - uma MUDANÇA REAL de config de "Meditar" (peso 1 → 2) num dia dentro da janela
//    de 30 dias (marcador de evolução — AC2) e a versão "Criado" backdatada PARA
//    FORA da janela (só o marcador de peso aparece no período);
//  - linhas passadas de `habit_day_entries` em dias específicos, deixando UM dia
//    (today-4) como LACUNA honesta (nunca 0% fabricado — AC1);
//  - um FERIADO real (today-6) → tipo de dia determinístico (FER/sombreamento),
//    independente do dia da semana em que a suíte roda (mesma alavanca de
//    determinismo que `seedMultiplierScenario.ts` usa com o toggle de feriado).
// O dia âncora (today-2) reproduz a matemática de completude das 6.2/6.3:
// Meditar feito (1×1) + Passos 2500/5000 com bonus 20 ((0,5×0,8)=0,4 → 0,4×2) →
// (1 + 0,8) / (1+2) = 60%.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')

export interface SeedHabitHistoryResult {
  meditarId: string
  passosId: string
  groupId: string
  // Dia com registro completo (detalhe por-data → 60%). ISO "YYYY-MM-DD".
  anchorDate: string
  // Dia nunca aberto dentro da janela (detalhe → "Sem registro neste dia.").
  gapDate: string
  // Feriado real → coluna/sombreamento "Feriado" determinístico na grade/gráfico.
  holidayDate: string
  // Dia da mudança de peso de "Meditar" (marcador "Peso 1 → 2" no gráfico).
  changeDate: string
}

// Seeda o cenário de histórico para o usuário já cadastrado via UI (`email`
// fixture). Todas as datas são relativas a `today_for(user)` (autoridade única de
// "hoje" do backend) — nunca `date.today()` cru (guardrail temporal das retros).
export function seedHabitHistory(email: string): SeedHabitHistoryResult {
  const script = `
import json
from datetime import timedelta
from decimal import Decimal
from accounts.models import User, UserHoliday
from core.calendar import today_for
from core.tenant import tenant_context
from habits.models import HabitDayEntry, HabitVersion
from habits.services import create_habit, create_habit_group

user = User.objects.get(email=${JSON.stringify(email)})

with tenant_context(user):
    today = today_for(user)

    def d(n):
        return today - timedelta(days=n)

    group = create_habit_group(user=user, name="Saúde")
    meditar = create_habit(
        user=user, name="Meditar", group_id=group.id, type="boolean", weight="1"
    )
    passos = create_habit(
        user=user, name="Passos", group_id=group.id, type="numeric",
        weight="2", meta="5000", bonus="20", unit="passos",
    )

    # "Criado" de Meditar backdatado para FORA da janela de 30 dias; mudança real
    # de peso (1 → 2) DENTRO da janela → exatamente um marcador "Peso 1 → 2" (AC2).
    v0 = meditar.versions.get()
    v0.effective_from = d(40)
    v0.save(update_fields=["effective_from"])
    HabitVersion.objects.create(
        habit=meditar, weight=Decimal("2"), active=True, effective_from=d(4)
    )

    # Feriado real num dia passado → tipo de dia determinístico (precedência
    # holiday > weekend > weekday), sem depender do dia real da execução.
    UserHoliday.objects.get_or_create(date=d(6))

    def entry(habit, date, value, weight, meta=None, bonus=None, day_type="weekday"):
        HabitDayEntry.objects.create(
            habit=habit, date=date,
            value=None if value is None else Decimal(str(value)),
            weight_at_time=Decimal(str(weight)),
            meta_at_time=None if meta is None else Decimal(str(meta)),
            bonus_at_time=None if bonus is None else Decimal(str(bonus)),
            day_type=day_type, multiplier_at_time=Decimal("1.00"),
        )

    # Dias COM registro: today-6 (feriado), today-5, today-3, today-2 (âncora).
    # today-4 fica sem linha (LACUNA honesta) — e é também o dia da mudança de peso.
    entry(meditar, d(6), 1, 1, day_type="holiday")
    entry(passos, d(6), 5000, 2, meta=5000, bonus=20, day_type="holiday")
    entry(meditar, d(5), 1, 1)
    entry(passos, d(5), 1000, 2, meta=5000, bonus=20)
    entry(meditar, d(3), 1, 1)
    entry(passos, d(3), 3000, 2, meta=5000, bonus=20)
    entry(meditar, d(2), 1, 1)
    entry(passos, d(2), 2500, 2, meta=5000, bonus=20)

    print(json.dumps({
        "meditarId": str(meditar.id),
        "passosId": str(passos.id),
        "groupId": str(group.id),
        "anchorDate": d(2).isoformat(),
        "gapDate": d(4).isoformat(),
        "holidayDate": d(6).isoformat(),
        "changeDate": d(4).isoformat(),
    }))
`.trim()

  const output = execFileSync('uv', ['run', 'python', 'manage.py', 'shell', '-c', script], {
    cwd: backendDir,
    env: { ...process.env, DJANGO_SETTINGS_MODULE },
    stdio: 'pipe',
  })
  // `manage.py shell -c` imprime um banner antes de rodar o script — só a última
  // linha não-vazia é o `print` de verdade (mesma técnica de `seedHabits.ts`).
  const lines = output.toString().trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as SeedHabitHistoryResult
}
