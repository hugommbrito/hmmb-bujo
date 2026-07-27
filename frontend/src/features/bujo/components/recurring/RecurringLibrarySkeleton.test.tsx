import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import { RecurringLibrarySkeleton } from './RecurringLibrarySkeleton'

describe('RecurringLibrarySkeleton — geometria abas + linhas (Story 14.8, AC6)', () => {
  it('anuncia o carregamento em role="status"', () => {
    render(<RecurringLibrarySkeleton />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando os templates…')
  })

  it('as barras decorativas ficam fora da árvore de acessibilidade', () => {
    const { container } = render(<RecurringLibrarySkeleton />)
    // 2 grupos aria-hidden: a faixa de abas e a pilha de linhas.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })

  it('insinua UMA barra por aba (3) — a forma da superfície, não um retângulo qualquer', () => {
    const { container } = render(<RecurringLibrarySkeleton />)
    const [tabsRow] = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
    expect(tabsRow.children).toHaveLength(3)
  })

  it('as linhas do esqueleto medem a altura real da Item Row', () => {
    const { container } = render(<RecurringLibrarySkeleton />)
    const [, rowsStack] = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
    expect(rowsStack.children.length).toBeGreaterThan(0)
    for (const row of Array.from(rowsStack.children)) {
      expect(row).toHaveStyle({ minHeight: 'var(--ds-task-row-min-height-pointer)' })
    }
  })

  it('não renderiza o vazio por grupo (o vazio é estado de dado, não de loading)', () => {
    render(<RecurringLibrarySkeleton />)
    expect(screen.queryByText('Nenhum template neste grupo.')).not.toBeInTheDocument()
  })

  it('sem violações de acessibilidade', async () => {
    const { container } = render(<RecurringLibrarySkeleton />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
