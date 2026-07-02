import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { PlaceholderPage } from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('test_renderiza_titulo_como_heading', () => {
    render(<PlaceholderPage title="Hoje" />)
    expect(screen.getByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
  })

  it('test_exibe_em_desenvolvimento', () => {
    render(<PlaceholderPage title="Hábitos" />)
    expect(screen.getByText('Em desenvolvimento.')).toBeInTheDocument()
  })

  it('test_aria_label_igual_ao_titulo', () => {
    render(<PlaceholderPage title="Configurações" />)
    expect(screen.getByRole('main', { name: 'Configurações' })).toBeInTheDocument()
  })

  it('test_sem_violacoes_de_acessibilidade', async () => {
    const { container } = render(<PlaceholderPage title="Hoje" />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
