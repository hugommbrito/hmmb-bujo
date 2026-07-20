import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

import { createBujoTheme } from '../../../theme'
import { HealthHistoryTable } from './HealthHistoryTable'
import type { HealthFieldDefinition, HealthHistoryDay } from '../types'

const FIELDS: HealthFieldDefinition[] = [
  { id: 'f-peso', name: 'Peso', fieldType: 'decimal', enumOptions: [], active: true, displayOrder: 0 },
  { id: 'f-ativ', name: 'Atividade', fieldType: 'boolean', enumOptions: [], active: true, displayOrder: 1 },
  { id: 'f-humor', name: 'Humor', fieldType: 'enum', enumOptions: ['Bom', 'Ruim'], active: true, displayOrder: 2 },
]

const DAYS: HealthHistoryDay[] = [
  { date: '2026-02-03', values: { 'f-peso': 80.5, 'f-ativ': true, 'f-humor': 'Bom' } },
  { date: '2026-02-05', values: { 'f-peso': 82 } }, // atividade/humor ausentes = lacuna
]

function renderTable(fields = FIELDS, days = DAYS) {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <HealthHistoryTable fields={fields} days={days} />
    </ThemeProvider>,
  )
}

describe('HealthHistoryTable', () => {
  it('renderiza <table> com headers programáticos (campo=coluna, data=linha)', () => {
    renderTable()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Peso' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '05/02/2026' })).toBeInTheDocument()
  })

  it('tipa cada célula pela definição do campo (número pt-BR, boolean, enum)', () => {
    renderTable()
    expect(screen.getByLabelText('Peso, 03/02/2026: 80,5')).toBeInTheDocument()
    expect(screen.getByLabelText('Atividade, 03/02/2026: Sim')).toBeInTheDocument()
    expect(screen.getByLabelText('Humor, 03/02/2026: Bom')).toBeInTheDocument()
  })

  it('mostra lacuna "—" (sem registro) para chave ausente no blob', () => {
    renderTable()
    expect(
      screen.getByLabelText('Atividade, 05/02/2026: sem registro'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Humor, 05/02/2026: sem registro'),
    ).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há registros no período', () => {
    renderTable(FIELDS, [])
    expect(screen.getByText('Nenhum registro no período.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('usa lista por data no mobile (sem scroll horizontal / sem <table>)', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, // simula viewport mobile (<768px)
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    try {
      renderTable()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.getByText('05/02/2026')).toBeInTheDocument()
      expect(screen.getByText('Peso: 80,5')).toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderTable()
    expect(await axe(container)).toHaveNoViolations()
  })
})
