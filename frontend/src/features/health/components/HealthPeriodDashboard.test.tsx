import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

import { createBujoTheme } from '../../../theme'
import { HealthPeriodDashboard } from './HealthPeriodDashboard'
import type { HealthFieldDefinition, HealthPeriodSummary } from '../types'

const FIELDS: HealthFieldDefinition[] = [
  { id: 'f-peso', name: 'Peso', fieldType: 'decimal', enumOptions: [], active: true, displayOrder: 0 },
  { id: 'f-sono', name: 'Sono', fieldType: 'integer', enumOptions: [], active: true, displayOrder: 1 },
]

// count/min/max/avg/latest distintos para asserção sem ambiguidade.
const SUMMARY: HealthPeriodSummary[] = [
  { fieldId: 'f-peso', count: 3, min: 80, max: 90, avg: 85, latest: 88 },
]

function renderDashboard(summary = SUMMARY, fields = FIELDS) {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <HealthPeriodDashboard summary={summary} fields={fields} />
    </ThemeProvider>,
  )
}

describe('HealthPeriodDashboard', () => {
  it('renderiza um cartão por campo numérico com os 5 números', () => {
    renderDashboard()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Peso' })).toBeInTheDocument()
    // registros / mín / máx / média / mais recente
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByText('Mais recente')).toBeInTheDocument()
  })

  it('mostra "—" para estatística nula (campo sem registro no período)', () => {
    renderDashboard([
      { fieldId: 'f-peso', count: 0, min: null, max: null, avg: null, latest: null },
    ])
    expect(screen.getByText('0')).toBeInTheDocument() // registros
    // mín/máx/média/mais recente → "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('mostra estado vazio quando não há campo numérico', () => {
    renderDashboard([])
    expect(screen.getByText('Nenhum campo numérico para resumo.')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderDashboard()
    expect(await axe(container)).toHaveNoViolations()
  })
})
