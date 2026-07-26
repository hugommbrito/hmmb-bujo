import { describe, expect, it } from 'vitest'

import {
  addDaysIso,
  addMonthsIso,
  formatDayLabel,
  isoOf,
  isoWeekNumber,
  lastDayOfMonth,
  mondayIsoOf,
  monthGridWeeks,
  parseLocalDate,
  weekPositionInMonth,
} from './index'

describe('isoOf / parseLocalDate — sem deslocamento de fuso', () => {
  it('test_isoOf_formata_ano_mes_dia_com_zero_a_esquerda', () => {
    expect(isoOf(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(isoOf(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('test_parseLocalDate_e_isoOf_sao_inversas', () => {
    expect(isoOf(parseLocalDate('2026-07-20'))).toBe('2026-07-20')
  })

  it('test_parseLocalDate_nunca_desloca_para_utc', () => {
    // `new Date('2026-07-27')` seria parseado como UTC meia-noite e viraria
    // 26/07 em fusos negativos — o caso que a Dev Notes nomeia explicitamente.
    const date = parseLocalDate('2026-07-27')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(6) // julho = índice 6
    expect(date.getDate()).toBe(27)
  })
})

describe('addDaysIso', () => {
  it('test_soma_dias_positivos_e_negativos', () => {
    expect(addDaysIso('2026-07-20', 7)).toBe('2026-07-27')
    expect(addDaysIso('2026-07-20', -7)).toBe('2026-07-13')
  })

  it('test_atravessa_fronteira_de_mes_e_de_ano', () => {
    expect(addDaysIso('2026-07-28', 7)).toBe('2026-08-04')
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('mondayIsoOf — casos-âncora de docs/temporal-pattern.md', () => {
  it('test_caso_ancora_01_01_2023_era_domingo', () => {
    expect(mondayIsoOf('2023-01-01')).toBe('2022-12-26')
  })

  it('test_segunda_feira_e_o_proprio_dia', () => {
    expect(mondayIsoOf('2026-07-20')).toBe('2026-07-20')
  })

  it('test_domingo_volta_para_a_segunda_da_mesma_semana', () => {
    expect(mondayIsoOf('2026-07-26')).toBe('2026-07-20')
  })
})

describe('isoWeekNumber', () => {
  it('test_semana_iso_1_de_2026_contem_a_primeira_quinta_do_ano', () => {
    // 01/01/2026 é quinta-feira — a própria semana 1 do ano ISO.
    expect(isoWeekNumber('2026-01-01')).toBe(1)
  })

  it('test_numero_cresce_ao_longo_do_ano', () => {
    expect(isoWeekNumber('2026-07-20')).toBeGreaterThan(isoWeekNumber('2026-01-05'))
  })
})

describe('weekPositionInMonth — regra DO PROJETO (AD-05), distinta de ISO', () => {
  it('test_primeira_semana_do_mes_e_a_que_contem_o_dia_1', () => {
    // Julho/2026 começa numa quarta (01/07/2026) — a 1ª semana começa em
    // 29/06 (segunda anterior) e "contém o dia 1"; por isso é TAMBÉM a última
    // semana de junho (posição 5) — semana de virada, cai nos dois testes.
    expect(weekPositionInMonth('2026-06-29')).toEqual([
      { position: 5, month: 6, year: 2026 },
      { position: 1, month: 7, year: 2026 },
    ])
  })

  it('test_semana_de_virada_pertence_aos_dois_meses_simultaneamente', () => {
    // 26/12/2022 é o caso-âncora de temporal-pattern.md: última semana de
    // dezembro/2022 E primeira de janeiro/2023, ao mesmo tempo.
    const posicoes = weekPositionInMonth('2022-12-26')
    expect(posicoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ month: 12, year: 2022 }),
        expect.objectContaining({ month: 1, year: 2023, position: 1 }),
      ]),
    )
    expect(posicoes).toHaveLength(2)
  })

  it('test_semana_totalmente_dentro_do_mes_devolve_um_unico_elemento', () => {
    // 20/07/2026 é uma semana inteira dentro de julho, longe das viradas.
    const posicoes = weekPositionInMonth('2026-07-20')
    expect(posicoes).toHaveLength(1)
    expect(posicoes[0].month).toBe(7)
    expect(posicoes[0].year).toBe(2026)
  })
})

describe('formatDayLabel', () => {
  it('test_estilo_weekday_devolve_nome_completo_pt_br', () => {
    expect(formatDayLabel('2026-07-20', 'weekday')).toBe('Segunda')
    expect(formatDayLabel('2026-07-25', 'weekday')).toBe('Sábado')
    expect(formatDayLabel('2026-07-26', 'weekday')).toBe('Domingo')
  })

  it('test_estilo_day_month_devolve_dia_e_mes_abreviado', () => {
    expect(formatDayLabel('2026-07-20', 'day-month')).toBe('20 jul.')
  })

  it('test_estilo_weekday_short_day_devolve_maiusculas', () => {
    expect(formatDayLabel('2026-07-20', 'weekday-short-day')).toBe('SEG 20')
  })

  it('test_default_e_weekday', () => {
    expect(formatDayLabel('2026-07-20')).toBe(formatDayLabel('2026-07-20', 'weekday'))
  })
})

describe('lastDayOfMonth (Story 14.6, AC1/Task 2) — espelha calendar.monthrange', () => {
  it('test_meses_de_31_dias', () => {
    expect(lastDayOfMonth('2026-07-01')).toBe(31)
  })

  it('test_meses_de_30_dias', () => {
    expect(lastDayOfMonth('2026-04-01')).toBe(30)
  })

  it('test_fevereiro_comum', () => {
    expect(lastDayOfMonth('2026-02-01')).toBe(28)
  })

  it('test_fevereiro_bissexto', () => {
    expect(lastDayOfMonth('2028-02-01')).toBe(29)
  })

  it('test_virada_dez_jan_nao_interfere', () => {
    expect(lastDayOfMonth('2026-12-01')).toBe(31)
    expect(lastDayOfMonth('2027-01-01')).toBe(31)
  })
})

describe('monthGridWeeks — grade segunda→domingo cobrindo o mês inteiro (Story 14.6, AC1)', () => {
  it('test_julho_2026_comeca_numa_quarta_e_tem_5_semanas', () => {
    // 01/07/2026 é quarta — a grade começa na segunda anterior (29/06) e
    // termina na semana que contém 31/07 (sexta).
    const weeks = monthGridWeeks('2026-07-01')
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toEqual({ iso: '2026-06-29', inMonth: false })
    expect(weeks[0][2]).toEqual({ iso: '2026-07-01', inMonth: true })
    expect(weeks[4][6]).toEqual({ iso: '2026-08-02', inMonth: false })
    expect(weeks[4][4]).toEqual({ iso: '2026-07-31', inMonth: true })
  })

  it('test_todas_as_semanas_tem_7_dias_segunda_a_domingo', () => {
    const weeks = monthGridWeeks('2026-07-01')
    for (const week of weeks) {
      expect(week).toHaveLength(7)
      expect(weekdayIndexOfIso(week[0].iso)).toBe(0)
      expect(weekdayIndexOfIso(week[6].iso)).toBe(6)
    }
  })

  it('test_fevereiro_bissexto_2028_cobre_29_dias_sem_faltar_nenhum', () => {
    const weeks = monthGridWeeks('2028-02-01')
    const diasDoMes = weeks.flat().filter((d) => d.inMonth)
    expect(diasDoMes).toHaveLength(29)
    expect(diasDoMes[0].iso).toBe('2028-02-01')
    expect(diasDoMes[28].iso).toBe('2028-02-29')
  })

  it('test_virada_dez_jan_marca_dias_do_mes_seguinte_como_fora_do_mes', () => {
    const weeks = monthGridWeeks('2026-12-01')
    const foraDoMes = weeks.flat().filter((d) => !d.inMonth && d.iso.startsWith('2027-01'))
    expect(foraDoMes.length).toBeGreaterThan(0)
    const dentroDoMes = weeks.flat().filter((d) => d.inMonth)
    expect(dentroDoMes).toHaveLength(31)
  })

  it('test_mes_que_precisa_de_6_linhas', () => {
    // 01/08/2026 é sábado: a grade cresce até 6 semanas para cobrir o mês
    // inteiro (início próximo do fim de uma semana + 31 dias).
    const weeks = monthGridWeeks('2026-08-01')
    expect(weeks).toHaveLength(6)
    const dentroDoMes = weeks.flat().filter((d) => d.inMonth)
    expect(dentroDoMes).toHaveLength(31)
  })

  it('test_fevereiro_nao_bissexto_comecando_numa_segunda_precisa_de_so_4_linhas', () => {
    // Achado de revisão: o comentário de `monthGridWeeks` afirmava "5 ou 6
    // linhas" sem cobrir o caso mínimo. 01/02/2027 é segunda-feira e 2027 não
    // é bissexto (28 dias) — a grade cabe inteira em exatamente 4 semanas.
    const weeks = monthGridWeeks('2027-02-01')
    expect(weeks).toHaveLength(4)
    const dentroDoMes = weeks.flat().filter((d) => d.inMonth)
    expect(dentroDoMes).toHaveLength(28)
    expect(dentroDoMes[0].iso).toBe('2027-02-01')
    expect(dentroDoMes[27].iso).toBe('2027-02-28')
  })
})

function weekdayIndexOfIso(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return (new Date(year, month - 1, day).getDay() + 6) % 7
}

describe('addMonthsIso (Story 14.7)', () => {
  it('avança e retrocede meses normalizando ao dia 1', () => {
    expect(addMonthsIso('2026-07-01', 1)).toBe('2026-08-01')
    expect(addMonthsIso('2026-07-01', 8)).toBe('2027-03-01')
    expect(addMonthsIso('2026-07-01', -1)).toBe('2026-06-01')
  })

  it('vira o ano nos dois sentidos', () => {
    expect(addMonthsIso('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonthsIso('2027-01-01', -1)).toBe('2026-12-01')
    expect(addMonthsIso('2026-01-01', -13)).toBe('2024-12-01')
  })

  it('delta 0 é identidade', () => {
    expect(addMonthsIso('2026-02-01', 0)).toBe('2026-02-01')
  })
})
