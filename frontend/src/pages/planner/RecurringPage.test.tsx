import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RecurringPage } from './RecurringPage'

vi.mock('../../features/bujo', () => ({
  RecurringTemplateManager: () => <div data-testid="recurring-template-manager" />,
}))

describe('RecurringPage (smoke test de composição)', () => {
  it('renderiza o título "Recorrentes"', () => {
    render(<RecurringPage />)

    expect(screen.getByRole('heading', { name: 'Recorrentes' })).toBeInTheDocument()
  })

  it('renderiza a gestão de templates recorrentes', () => {
    render(<RecurringPage />)

    expect(screen.getByTestId('recurring-template-manager')).toBeInTheDocument()
  })

  it('aria-label do <main> igual ao título', () => {
    render(<RecurringPage />)

    expect(screen.getByRole('main', { name: 'Recorrentes' })).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    const { container } = render(<RecurringPage />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
