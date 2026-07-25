import { describe, expect, it } from 'vitest'

import {
  addDaysIso,
  formatDayLabel,
  isoOf,
  isoWeekNumber,
  mondayIsoOf,
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
