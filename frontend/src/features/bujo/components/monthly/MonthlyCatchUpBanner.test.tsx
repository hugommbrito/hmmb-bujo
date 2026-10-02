import { render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import { MonthlyCatchUpBanner } from './MonthlyCatchUpBanner'
import { catchUpSteps } from './monthlyCatchUp'
import type { MonthlyCycleReadiness } from '../../types'

// Cenário da produção (Story 14.11): agosto `active` com subtarefa aberta,
// setembro `planning` já concluído, hoje em outubro.
const READINESS: MonthlyCycleReadiness = {
  active: { monthFirst: '2026-08-01', status: 'active', planningCompletedAt: null },
  planning: { monthFirst: '2026-09-01', status: 'planning', planningCompletedAt: '2026-08-31T10:00:00Z' },
  start: {
    allowed: false,
    target: '2026-09-01',
    gates: { dateReached: true, planningCompleted: true, previousFinalized: false },
  },
  finalize: {
    allowed: false,
    target: '2026-08-01',
    gates: { noOpenTasks: false, nextPlanningExists: true },
  },
}

function renderBanner(overrides: Partial<Parameters<typeof MonthlyCatchUpBanner>[0]> = {}) {
  return render(
    <MonthlyCatchUpBanner
      targetMonthFirst="2026-09-01"
      currentMonthFirst="2026-10-01"
      readiness={READINESS}
      previousPeriodStart="2026-08-01"
      {...overrides}
    />,
  )
}

describe('MonthlyCatchUpBanner (Story 14.11)', () => {
  it('nomeia o alvo, o mês corrente e quantos meses faltam; é role="status"', () => {
    renderBanner()
    const banner = screen.getByRole('status', { name: 'Regularização atrasada' })
    expect(banner).toHaveTextContent('O alvo deste ritual é Setembro de 2026, anterior ao mês corrente (Outubro de 2026)')
    expect(banner).toHaveTextContent('ainda falta 1 mês até Outubro de 2026')
  })

  it('pluraliza os meses que faltam', () => {
    renderBanner({ targetMonthFirst: '2026-07-01' })
    expect(screen.getByRole('status')).toHaveTextContent('ainda faltam 3 meses até Outubro de 2026')
  })

  it('"Próximo passo" é o PRIMEIRO ✗ na ordem do M07 — Finalizar o anterior, com motivo das subtarefas', () => {
    renderBanner()
    expect(screen.getByText('Próximo passo: Finalizar Agosto de 2026')).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Passos da regularização' })).getAllByRole('listitem')
    expect(steps.map((li) => li.textContent)).toEqual([
      expect.stringContaining('✗Finalizar Agosto de 2026'),
      expect.stringContaining('✓Concluir planejamento de Setembro de 2026'),
      expect.stringContaining('✗Iniciar Setembro de 2026'),
    ])
    // O motivo só acompanha o próximo passo.
    expect(steps[0]).toHaveTextContent('subtarefas incluídas')
    expect(steps[2]).not.toHaveTextContent('Libera quando')
  })

  it('anterior já finalizado: o próximo passo avança para Iniciar', () => {
    renderBanner({
      readiness: {
        ...READINESS,
        active: null,
        finalize: null,
        start: { allowed: true, target: '2026-09-01', gates: { dateReached: true, planningCompleted: true, previousFinalized: true } },
      },
    })
    expect(screen.getByText('Próximo passo: Iniciar Setembro de 2026')).toBeInTheDocument()
  })

  it('sem Monthly anterior: não lista "Finalizar" e o próximo passo é Concluir planejamento', () => {
    renderBanner({
      previousPeriodStart: null,
      readiness: {
        ...READINESS,
        active: null,
        finalize: null,
        start: { allowed: false, target: '2026-09-01', gates: { dateReached: true, planningCompleted: false, previousFinalized: true } },
      },
    })
    expect(screen.queryByText(/^Finalizar/)).not.toBeInTheDocument()
    expect(screen.getByText('Próximo passo: Concluir planejamento de Setembro de 2026')).toBeInTheDocument()
  })

  it('catchUpSteps é puro: readiness sem start/finalize devolve ✗ em tudo sem lançar', () => {
    const steps = catchUpSteps('2026-09-01', { active: null, planning: null, start: null, finalize: null }, '2026-08-01')
    expect(steps.map((s) => s.ok)).toEqual([false, false, false])
  })

  it('jest-axe: sem violações', async () => {
    const { container } = renderBanner()
    expect(await axe(container)).toHaveNoViolations()
  })
})
