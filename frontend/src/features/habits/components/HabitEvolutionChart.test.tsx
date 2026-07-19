import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

import { createBujoTheme } from '../../../theme'
import { HabitEvolutionChart } from './HabitEvolutionChart'
import type { HabitSeries } from '../types'

// recharts + jsdom: o ResponsiveContainer usa ResizeObserver (não existe em jsdom)
// e mede o container por getBoundingClientRect. Sem estes mocks, recharts lança e
// não renderiza. Damos dimensões fixas para o SVG desenhar (padrão documentado no
// Debug Log). As asserções principais (role=img/aria-label, lista de mudanças,
// legenda de sombreamento) são DOM próprio e independem do SVG.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300, x: 0, y: 0, toJSON: () => {} }),
  })
})

const SERIES: HabitSeries = {
  habit: { id: 'h1', name: 'Ler', emoticon: '📖', type: 'numeric', unit: 'páginas', group: 'g1' },
  points: [
    { date: '2026-01-05', value: '10.00', effectiveWeight: '2.00', dayType: 'weekday' },
    { date: '2026-01-06', value: '12.00', effectiveWeight: '2.00', dayType: 'weekday' },
    { date: '2026-01-10', value: null, effectiveWeight: '1.00', dayType: 'weekend' },
  ],
  events: [
    { effectiveFrom: '2026-01-06', changes: [{ field: 'weight', before: '3.00', after: '4.00' }] },
    { effectiveFrom: '2026-01-09', changes: [{ field: 'active', before: 'true', after: 'false' }] },
  ],
  dayTypes: [
    { date: '2026-01-05', dayType: 'weekday' },
    { date: '2026-01-06', dayType: 'weekday' },
    { date: '2026-01-07', dayType: 'weekday' },
    { date: '2026-01-08', dayType: 'weekday' },
    { date: '2026-01-09', dayType: 'weekday' },
    { date: '2026-01-10', dayType: 'weekend' },
    { date: '2026-01-11', dayType: 'weekend' },
  ],
}

function renderChart(series: HabitSeries) {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <HabitEvolutionChart series={series} />
    </ThemeProvider>,
  )
}

describe('HabitEvolutionChart', () => {
  it('expõe o gráfico com role=img e aria-label de resumo', () => {
    renderChart(SERIES)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('Evolução de Ler'))
    // resumo tem nº de dias com registro (3) e nº de mudanças (2)
    expect(img.getAttribute('aria-label')).toMatch(/3 dias com registro/)
    expect(img.getAttribute('aria-label')).toMatch(/2 mudanças de configuração/)
  })

  it('mostra os marcadores de mudança como TEXTO (cor nunca sozinha)', () => {
    renderChart(SERIES)
    // diff de peso e o "Desativado" acompanham os marcadores como texto.
    expect(screen.getByText(/Peso 3 → 4/)).toBeInTheDocument()
    expect(screen.getByText(/Desativado/)).toBeInTheDocument()
  })

  it('explica o sombreamento de ritmo por texto', () => {
    renderChart(SERIES)
    expect(
      screen.getByText(/Fim de semana e feriados aparecem sombreados/),
    ).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderChart(SERIES)
    expect(await axe(container)).toHaveNoViolations()
  })
})
