import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GratitudeTabs } from './GratitudeTabs'

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <GratitudeTabs />
    </MemoryRouter>,
  )
}

describe('GratitudeTabs (AC6)', () => {
  it('expõe as abas "Hoje" e "Histórico" apontando para as rotas certas', () => {
    renderAt('/gratitude')
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('href', '/gratitude')
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
      'href',
      '/gratitude/history',
    )
  })

  it('em /gratitude a aba "Hoje" está ativa', () => {
    renderAt('/gratitude')
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('em /gratitude/history a aba "Histórico" está ativa', () => {
    renderAt('/gratitude/history')
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'false')
  })
})
