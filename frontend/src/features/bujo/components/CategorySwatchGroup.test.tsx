import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { CategorySwatchGroup } from './CategorySwatchGroup'
import type { TaskCategory } from '../types'

/** Casca controlada mínima — o componente é puramente controlado (o estado vive
 * em quem o consome: `TaskDetailCard` e `TemplateDetailCard`). */
function Controlled({
  initial = null,
  readonly = false,
  onChangeSpy,
}: {
  initial?: TaskCategory | null
  readonly?: boolean
  onChangeSpy?: (next: TaskCategory | null) => void
}) {
  const [value, setValue] = useState<TaskCategory | null>(initial)
  return (
    <CategorySwatchGroup
      value={value}
      readonly={readonly}
      onChange={(next: TaskCategory | null) => {
        setValue(next)
        onChangeSpy?.(next)
      }}
    />
  )
}

describe('CategorySwatchGroup — anatomia canônica (Story 14.8, AC3)', () => {
  it('renderiza radiogroup "Categoria" com 7 role=radio (Sem categoria + 6 swatches)', () => {
    render(<Controlled />)
    expect(screen.getByRole('radiogroup', { name: 'Categoria' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(7)
  })

  it('cada swatch tem nome acessível próprio', () => {
    render(<Controlled />)
    for (const label of ['Teal', 'Purple', 'Pink', 'Yellow', 'Green', 'Blue']) {
      expect(screen.getByRole('radio', { name: `Categoria ${label}` })).toBeInTheDocument()
    }
  })

  it('value null marca "Sem categoria"', () => {
    render(<Controlled />)
    expect(screen.getByRole('radio', { name: 'Sem categoria' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('clicar um swatch emite onChange e marca ele, desmarcando "Sem categoria"', () => {
    const spy = vi.fn()
    render(<Controlled onChangeSpy={spy} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Categoria Teal' }))
    expect(spy).toHaveBeenCalledWith('teal')
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'Sem categoria' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('Enter e Espaço selecionam o swatch focado (operável por teclado sem clique)', () => {
    const spy = vi.fn()
    render(<Controlled onChangeSpy={spy} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Pink' }), { key: 'Enter' })
    expect(spy).toHaveBeenLastCalledWith('pink')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Green' }), { key: ' ' })
    expect(spy).toHaveBeenLastCalledWith('green')
  })
})

// O roving tabindex é a parte da extração mais fácil de perder — a Story 14.5
// levou achado ALTO justamente por ele não existir. Estes testes provam a
// unidade isolada; `TaskDetailCard.test.tsx` continua sendo a prova de
// integração (e roda sem uma linha alterada).
describe('CategorySwatchGroup — roving tabindex (Story 14.5, achado ALTO)', () => {
  it('ArrowRight avança e move o foco para a opção seguinte', () => {
    render(<Controlled />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Sem categoria' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveFocus()
  })

  it('ArrowDown se comporta como ArrowRight (radiogroup em wrap visual)', () => {
    render(<Controlled />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Sem categoria' }), { key: 'ArrowDown' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('ArrowLeft recua', () => {
    render(<Controlled initial="purple" />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Purple' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('ArrowUp se comporta como ArrowLeft', () => {
    render(<Controlled initial="purple" />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Purple' }), { key: 'ArrowUp' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('dá a volta: ArrowLeft na primeira opção vai para a última (Blue)', () => {
    render(<Controlled />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Sem categoria' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'Categoria Blue' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('dá a volta: ArrowRight na última opção volta para "Sem categoria"', () => {
    render(<Controlled initial="blue" />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Blue' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Sem categoria' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('só a opção selecionada fica na ordem de Tab (tabIndex 0); as demais em -1', () => {
    render(<Controlled initial="pink" />)
    expect(screen.getByRole('radio', { name: 'Categoria Pink' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute('tabindex', '-1')
  })

  it('tecla não-direcional (ex.: Tab) não altera a seleção', () => {
    const spy = vi.fn()
    render(<Controlled initial="teal" onChangeSpy={spy} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Teal' }), { key: 'Tab' })
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('CategorySwatchGroup — readonly', () => {
  it('setas não movem a seleção', () => {
    render(<Controlled initial="teal" readonly />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Teal' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Categoria Teal' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('clique não muda a seleção e os swatches ficam aria-disabled', () => {
    const spy = vi.fn()
    render(<Controlled initial="teal" readonly onChangeSpy={spy} />)
    const pink = screen.getByRole('radio', { name: 'Categoria Pink' })
    expect(pink).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(pink)
    expect(spy).not.toHaveBeenCalled()
    expect(pink).toHaveAttribute('aria-checked', 'false')
  })

  it('Enter/Espaço também não selecionam em readonly', () => {
    const spy = vi.fn()
    render(<Controlled initial="teal" readonly onChangeSpy={spy} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Categoria Pink' }), { key: 'Enter' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('caso irmão: sem readonly o clique muda (prova que os asserts acima não são vacuosos)', () => {
    const spy = vi.fn()
    render(<Controlled initial="teal" onChangeSpy={spy} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Categoria Pink' }))
    expect(spy).toHaveBeenCalledWith('pink')
  })
})

describe('CategorySwatchGroup — jest-axe', () => {
  it('sem violações de acessibilidade', async () => {
    const { container } = render(<Controlled initial="blue" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
