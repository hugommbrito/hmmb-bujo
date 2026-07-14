import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { SettingsPage } from './SettingsPage'

vi.mock('../../features/bujo', () => ({
  RecurringTemplateManager: () => <div data-testid="recurring-template-manager" />,
}))

describe('SettingsPage (smoke test de composição)', () => {
  it('renderiza o título "Configurações"', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument()
  })

  it('renderiza a seção de recorrentes', () => {
    render(<SettingsPage />)

    expect(screen.getByTestId('recurring-template-manager')).toBeInTheDocument()
  })

  it('aria-label do <main> igual ao título', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('main', { name: 'Configurações' })).toBeInTheDocument()
  })

  it('sem violações de acessibilidade (jest-axe)', async () => {
    const { container } = render(<SettingsPage />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
