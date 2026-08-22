import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HABIT_TAB,
  HABIT_TABS,
  addDays,
  bucketLabel,
  clampDate,
  contributionFactor,
  decimalInputValue,
  effectiveWeightOf,
  formatDateLongBR,
  formatDateMediumBR,
  formatDecimal,
  formatEffectiveWeight,
  formatFrozenFactors,
  gridCell,
  isBooleanDone,
  isMetaReached,
  isUnchangedDecimal,
  isoLocalToday,
  metaPercent,
  minDate,
  mondayOf,
  parseDecimalInput,
  parseTabSlug,
  realDaysLabel,
  rowStateText,
  sumEffectiveWeights,
  tabIdOf,
  tabLabelOf,
  tabPanelIdOf,
  weeklyBuckets,
} from './habitsSurface'

describe('abas — ordem canônica e estado na querystring', () => {
  it('a ordem é Hoje · Histórico · Configuração, invariável', () => {
    expect(HABIT_TABS.map((tab) => tab.slug)).toEqual(['hoje', 'historico', 'configuracao'])
    expect(HABIT_TABS.map((tab) => tab.label)).toEqual(['Hoje', 'Histórico', 'Configuração'])
  })

  it('só "Configuração" abrevia no compact', () => {
    expect(HABIT_TABS.map((tab) => tabLabelOf(tab, true))).toEqual([
      'Hoje',
      'Histórico',
      'Config.',
    ])
    expect(HABIT_TABS.map((tab) => tabLabelOf(tab, false))).toEqual([
      'Hoje',
      'Histórico',
      'Configuração',
    ])
  })

  it('parseTabSlug aceita os três slugs e normaliza caixa/espaço', () => {
    expect(parseTabSlug('hoje')).toBe('hoje')
    expect(parseTabSlug('historico')).toBe('historico')
    expect(parseTabSlug(' Configuracao ')).toBe('configuracao')
  })

  it('deep link desconhecido/ausente cai na aba padrão, nunca em tela morta', () => {
    expect(parseTabSlug(null)).toBe(DEFAULT_HABIT_TAB)
    expect(parseTabSlug('')).toBe('hoje')
    expect(parseTabSlug('historia')).toBe('hoje')
  })

  it('os ids do par tab⇄tabpanel são distintos e estáveis', () => {
    expect(tabIdOf('hoje')).toBe('habits-tab-hoje')
    expect(tabPanelIdOf('hoje')).toBe('habits-tabpanel-hoje')
    expect(tabIdOf('hoje')).not.toBe(tabPanelIdOf('hoje'))
  })
})

describe('fatores congelados — texto de transparência da linha', () => {
  it('multiplicador 1 (ou ausente) mostra só o peso, inteiro sem fração', () => {
    expect(formatFrozenFactors('3.00', '1.00')).toBe('Peso 3')
    expect(formatFrozenFactors('3.00', undefined)).toBe('Peso 3')
    expect(formatFrozenFactors('2.50', '1.00')).toBe('Peso 2,5')
  })

  it('multiplicador ≠ 1 mostra os fatores separados e o produto', () => {
    expect(formatFrozenFactors('3.00', '0.50')).toBe('Peso 3 × 0,5 = 1,5')
    expect(formatFrozenFactors('2.00', '0.50')).toBe('Peso 2 × 0,5 = 1')
    expect(formatFrozenFactors('1.00', '0.50')).toBe('Peso 1 × 0,5 = 0,5')
  })

  it('peso efetivo é peso × multiplicador, e a soma é o denominador nomeado', () => {
    expect(effectiveWeightOf({ weightAtTime: '3.00', multiplierAtTime: '0.50' })).toBe(1.5)
    expect(effectiveWeightOf({ weightAtTime: '3.00' })).toBe(3)
    expect(
      sumEffectiveWeights([
        { weightAtTime: '3.00', multiplierAtTime: '1.00' },
        { weightAtTime: '2.00', multiplierAtTime: '0.50' },
      ]),
    ).toBe(4)
    expect(formatEffectiveWeight(14)).toBe('14,0')
  })
})

describe('parser decimal — aceita vírgula E ponto', () => {
  it('normaliza vírgula para o formato da API', () => {
    expect(parseDecimalInput('2,1')).toEqual({ valid: true, value: '2.1' })
    expect(parseDecimalInput('2.1')).toEqual({ valid: true, value: '2.1' })
    expect(parseDecimalInput(' 8 ')).toEqual({ valid: true, value: '8' })
  })

  it('campo vazio grava NULO (intenção legítima, não erro)', () => {
    expect(parseDecimalInput('')).toEqual({ valid: true, value: null })
    expect(parseDecimalInput('   ')).toEqual({ valid: true, value: null })
  })

  it('texto que não é número é inválido', () => {
    expect(parseDecimalInput('abc').valid).toBe(false)
    expect(parseDecimalInput('1,2,3').valid).toBe(false)
  })

  it('o campo exibe o decimal do servidor com vírgula', () => {
    expect(decimalInputValue('2.10')).toBe('2,1')
    expect(decimalInputValue('8')).toBe('8')
    expect(decimalInputValue(null)).toBe('')
  })

  it('valor inalterado é detectado por VALOR, não por string', () => {
    expect(isUnchangedDecimal('2.1', '2.10')).toBe(true)
    expect(isUnchangedDecimal(null, null)).toBe(true)
    expect(isUnchangedDecimal('2.1', null)).toBe(false)
    expect(isUnchangedDecimal('2.2', '2.10')).toBe(false)
  })
})

describe('estado textual da linha — nulo é "Não feito", nunca ausência', () => {
  it('booleano', () => {
    expect(rowStateText({ type: 'boolean', value: '1' })).toBe('Feito')
    expect(rowStateText({ type: 'boolean', value: null })).toBe('Não feito')
    expect(isBooleanDone('1')).toBe(true)
    expect(isBooleanDone(null)).toBe(false)
  })

  it('numérico abaixo da meta lê valor / meta unidade (percentual)', () => {
    expect(rowStateText({ type: 'numeric', value: '2.1', metaAtTime: '8', unit: 'km' })).toBe(
      '2,1 / 8 km (26%)',
    )
    expect(rowStateText({ type: 'numeric', value: '1.8', metaAtTime: '2.5', unit: 'L' })).toBe(
      '1,8 / 2,5 L (72%)',
    )
  })

  it('numérico na meta (ou acima) lê "Meta atingida · valor / meta unidade"', () => {
    expect(rowStateText({ type: 'numeric', value: '8.4', metaAtTime: '8', unit: 'km' })).toBe(
      'Meta atingida · 8,4 / 8 km',
    )
    expect(isMetaReached('8.4', '8')).toBe(true)
    expect(isMetaReached('7.9', '8')).toBe(false)
    expect(isMetaReached(null, '8')).toBe(false)
  })

  it('metaPercent é percentual DA META (peso e bônus não entram)', () => {
    expect(metaPercent('2.1', '8')).toBe(26)
    expect(metaPercent(null, '8')).toBeNull()
    expect(metaPercent('2', '0')).toBeNull()
  })
})

describe('minDate — teto de data sem construir Date', () => {
  it('devolve a menor das duas datas ISO, comparando como string', () => {
    expect(minDate('2026-08-22', '2026-08-30')).toBe('2026-08-22')
    expect(minDate('2026-09-01', '2026-08-31')).toBe('2026-08-31')
    expect(minDate('2026-08-22', '2026-08-22')).toBe('2026-08-22')
  })
})

describe('datas — sem desvio de fuso', () => {
  it('formata por extenso a partir do split da string', () => {
    expect(formatDateLongBR('2026-08-21')).toBe('Sexta-feira, 21 de agosto de 2026')
    expect(formatDateMediumBR('2026-07-23')).toBe('23 de julho de 2026')
  })

  it('addDays/clampDate operam em calendário local', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(clampDate('2026-08-30', '2026-08-01', '2026-08-21')).toBe('2026-08-21')
    expect(clampDate('2026-07-01', '2026-08-01', '2026-08-21')).toBe('2026-08-01')
  })

  it('isoLocalToday nunca usa UTC (23h local não vira o dia seguinte)', () => {
    expect(isoLocalToday(new Date(2026, 7, 21, 23, 30))).toBe('2026-08-21')
  })
})

describe('buckets semanais fixos (segunda→domingo)', () => {
  it('mondayOf ancora a semana na segunda', () => {
    // 2026-08-21 é sexta; a segunda dessa semana é 2026-08-17.
    expect(mondayOf('2026-08-21')).toBe('2026-08-17')
    expect(mondayOf('2026-08-17')).toBe('2026-08-17')
    // Domingo pertence à semana que COMEÇOU na segunda anterior.
    expect(mondayOf('2026-08-23')).toBe('2026-08-17')
  })

  it('a semana parcial das pontas é um bucket próprio', () => {
    const dates = [
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
    ]
    const buckets = weeklyBuckets(dates)
    expect(buckets).toHaveLength(2)
    expect(buckets[0].dates).toEqual(['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'])
    expect(buckets[1].dates).toEqual(['2026-08-17', '2026-08-18'])
    expect(bucketLabel(buckets[0])).toBe('13–16 ago.')
    expect(bucketLabel(buckets[1])).toBe('17–18 ago.')
  })

  it('a coluna rotula os DIAS REAIS (para que "2/3" não seja lido contra 7)', () => {
    expect(realDaysLabel(3)).toBe('3 dias')
    expect(realDaysLabel(1)).toBe('1 dia')
  })
})

describe('célula da grade — tom contínuo pela razão REAL', () => {
  it('booleano mostra feitos sobre dias com registro e pinta a razão, não o numerador', () => {
    const cell = gridCell({
      type: 'boolean',
      entries: [
        { value: '1' },
        { value: '1' },
        { value: '1' },
        { value: '1' },
        { value: '1' },
        { value: null },
        { value: null },
      ],
    })
    expect(cell.display).toBe('5/7')
    // 5/7 = 71%, NUNCA 5%.
    expect(cell.percent).toBe(71)
    expect(cell.daysWithRecord).toBe(7)
  })

  it('numérico mostra a média do percentual da meta dos dias medidos', () => {
    const cell = gridCell({
      type: 'numeric',
      entries: [
        { value: '8', metaAtTime: '8' },
        { value: '4', metaAtTime: '8' },
        { value: null, metaAtTime: '8' },
      ],
    })
    expect(cell.display).toBe('75%')
    expect(cell.percent).toBe(75)
    // O dia sem medição NÃO entra no denominador.
    expect(cell.daysWithRecord).toBe(2)
  })

  // A meta é OPCIONAL no cadastro. Exigir `metaAtTime` para contar o dia como
  // medido fazia um hábito numérico sem meta renderizar "—" em TODA célula,
  // mesmo em dias com valor real — a apresentação de "período sem linha"
  // aplicada a um período que tem linhas.
  it('numérico SEM meta congelada ainda mostra número (média dos valores), sem inventar razão', () => {
    const cell = gridCell({
      type: 'numeric',
      entries: [{ value: '2', metaAtTime: null }, { value: '3', metaAtTime: null }],
    })
    expect(cell.display).toBe('2,5')
    expect(cell.hasRecord).toBe(true)
    expect(cell.daysWithRecord).toBe(2)
    // Sem meta não existe razão de completude: o tom fica SEM pintar (em vez de
    // pintar 0, que leria como "falhou tudo").
    expect(cell.percent).toBeNull()
    expect(cell.reading).toBe('média 2,5 em 2 dias com registro · sem meta configurada no período')
  })

  it('numérico sem meta E sem valor nenhum continua sendo "sem registro"', () => {
    const cell = gridCell({ type: 'numeric', entries: [{ value: null, metaAtTime: null }] })
    expect(cell.display).toBe('—')
    expect(cell.hasRecord).toBe(false)
    expect(cell.percent).toBeNull()
  })

  it('período sem nenhuma linha é travessão, nunca 0% fabricado', () => {
    const cell = gridCell({ type: 'numeric', entries: [] })
    expect(cell.display).toBe('—')
    expect(cell.percent).toBeNull()
    expect(cell.reading).toBe('Sem registro no período')
  })

  it('toda célula com registro TEM número (célula sem número é bug, não variante)', () => {
    const boolCell = gridCell({ type: 'boolean', entries: [{ value: null }] })
    expect(boolCell.display).toBe('0/1')
    expect(boolCell.percent).toBe(0)
    expect(boolCell.hasRecord).toBe(true)
    // `hasRecord` é o que autoriza travessão e borda tracejada — e SÓ o caso
    // genuíno de período vazio o tem em `false`.
    expect(gridCell({ type: 'boolean', entries: [] }).hasRecord).toBe(false)
  })
})

describe('contribuição diária de UM hábito (nunca a completude do dia)', () => {
  it('booleano é 1 quando feito, 0 quando aberto e não feito, nulo sem linha', () => {
    expect(contributionFactor('boolean', '1', null, null)).toBe(1)
    // Linha MATERIALIZADA com valor nulo é "não feito" ⇒ 0. Devolver lacuna
    // aqui fazia a visão "contribuição" discordar da visão "valor diário" do
    // mesmo dia (que já desenha 0) e escondia um "não feito" real.
    expect(contributionFactor('boolean', null, null, null)).toBe(0)
    expect(contributionFactor('boolean', '', null, null)).toBe(0)
    // Nulo SÓ quando o dia não tem ponto nenhum.
    expect(contributionFactor('boolean', null, null, null, false)).toBeNull()
  })

  it('numérico na meta é 1 (ganha o bônus); abaixo, aplica a penalidade do bônus', () => {
    expect(contributionFactor('numeric', '5000', '5000', '20')).toBe(1)
    expect(contributionFactor('numeric', '2500', '5000', '20')).toBeCloseTo(0.4)
    expect(contributionFactor('numeric', null, '5000', '20')).toBeNull()
  })
})

describe('formatDecimal — null NÃO vira zero fabricado', () => {
  it('devolve null para ausência e pt-BR para número', () => {
    expect(formatDecimal(null)).toBeNull()
    expect(formatDecimal('')).toBeNull()
    expect(formatDecimal('2.50')).toBe('2,5')
    expect(formatDecimal('1000')).toBe('1.000')
  })
})
