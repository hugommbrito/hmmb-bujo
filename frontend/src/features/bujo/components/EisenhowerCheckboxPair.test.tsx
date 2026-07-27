import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { EisenhowerCheckboxPair } from './EisenhowerCheckboxPair'
import type { TaskEisenhower } from '../types'

function Controlled({
  initial = null,
  readonly = false,
  label,
  onChangeSpy,
}: {
  initial?: TaskEisenhower | null
  readonly?: boolean
  label?: string
  onChangeSpy?: (next: TaskEisenhower | null) => void
}) {
  const [value, setValue] = useState<TaskEisenhower | null>(initial)
  return (
    <EisenhowerCheckboxPair
      value={value}
      readonly={readonly}
      label={label}
      onChange={(next) => {
        setValue(next)
        onChangeSpy?.(next)
      }}
    />
  )
}

describe('EisenhowerCheckboxPair — 2 checkboxes REAIS derivando o enum (Story 14.8, AC3)', () => {
  it('renderiza exatamente 2 checkboxes com nomes acessíveis próprios', () => {
    render(<Controlled />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /importante/i })).toBeInTheDocument()
  })

  it('value null não marca nenhum', () => {
    render(<Controlled />)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).not.toBeChecked()
  })

  it('"ui" marca AMBOS', () => {
    render(<Controlled initial="ui" />)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).toBeChecked()
  })

  it('"u" marca só Urgente; "i" marca só Importante (não-vacuidade cruzada)', () => {
    const { unmount } = render(<Controlled initial="u" />)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).not.toBeChecked()
    unmount()

    render(<Controlled initial="i" />)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).toBeChecked()
  })

  it('"none" é tratado como nenhum marcado (o enum combinado tem 4 valores)', () => {
    render(<Controlled initial="none" />)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).not.toBeChecked()
  })
})

describe('EisenhowerCheckboxPair — derivação do enum combinado', () => {
  it('marcar Urgente a partir de null deriva "u"', () => {
    const spy = vi.fn()
    render(<Controlled onChangeSpy={spy} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /urgente/i }))
    expect(spy).toHaveBeenLastCalledWith('u')
  })

  it('marcar Importante depois de "u" deriva "ui"', () => {
    const spy = vi.fn()
    render(<Controlled initial="u" onChangeSpy={spy} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /importante/i }))
    expect(spy).toHaveBeenLastCalledWith('ui')
  })

  it('desmarcar Urgente a partir de "ui" deriva "i" (não zera os dois)', () => {
    const spy = vi.fn()
    render(<Controlled initial="ui" onChangeSpy={spy} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /urgente/i }))
    expect(spy).toHaveBeenLastCalledWith('i')
  })

  it('desmarcar Importante a partir de "ui" deriva "u"', () => {
    const spy = vi.fn()
    render(<Controlled initial="ui" onChangeSpy={spy} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /importante/i }))
    expect(spy).toHaveBeenLastCalledWith('u')
  })

  it('desmarcar o único marcado deriva null (e não "none")', () => {
    const spy = vi.fn()
    render(<Controlled initial="u" onChangeSpy={spy} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /urgente/i }))
    expect(spy).toHaveBeenLastCalledWith(null)
  })
})

describe('EisenhowerCheckboxPair — readonly e rótulo', () => {
  it('readonly desabilita os dois checkboxes', () => {
    render(<Controlled initial="u" readonly />)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /importante/i })).toBeDisabled()
  })

  it('caso irmão: sem readonly os dois ficam habilitados', () => {
    render(<Controlled initial="u" />)
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: /importante/i })).toBeEnabled()
  })

  it('rótulo visível padrão é "Eisenhower" (paridade com o TaskDetailCard)', () => {
    render(<Controlled />)
    expect(screen.getByText('Eisenhower')).toBeInTheDocument()
  })

  it('rótulo é sobrescrevível (o card de template usa "Prioridade (Eisenhower)")', () => {
    render(<Controlled label="Prioridade (Eisenhower)" />)
    expect(screen.getByText('Prioridade (Eisenhower)')).toBeInTheDocument()
    expect(screen.queryByText('Eisenhower')).not.toBeInTheDocument()
  })
})

describe('EisenhowerCheckboxPair — jest-axe', () => {
  it('sem violações de acessibilidade', async () => {
    const { container } = render(<Controlled initial="ui" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
