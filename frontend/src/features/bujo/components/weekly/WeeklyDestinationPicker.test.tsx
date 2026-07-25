import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../../api/client'
import { WeeklyDestinationPicker } from './WeeklyDestinationPicker'

const mockGet = client.get as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const EMPTY_DENSITY = {
  days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${20 + i}`,
    total: i,
    byStatus: { pending: i, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 },
  })),
  undated: { total: 0, byStatus: { pending: 0, started: 0, completed: 0, cancelled: 0, migrated: 0, postponed: 0 } },
  total: 21,
}

describe('WeeklyDestinationPicker — 8 alvos e teclado (AC5, Task 9)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: EMPTY_DENSITY })
  })

  it('renderiza os 8 alvos (1-7 + 0)', async () => {
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getAllByRole('radio')).toHaveLength(8)
  })

  it.each([
    { key: '1', label: 'Segunda' },
    { key: '2', label: 'Terça' },
    { key: '3', label: 'Quarta' },
    { key: '4', label: 'Quinta' },
    { key: '5', label: 'Sexta' },
    { key: '6', label: 'Sábado' },
    { key: '7', label: 'Domingo' },
  ])('tecla $key arma o alvo certo ($label)', async ({ key }) => {
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    fireEvent.keyDown(window, { key })
    const armed = screen.getAllByRole('radio').filter((el) => el.getAttribute('aria-checked') === 'true')
    expect(armed).toHaveLength(1)
  })

  it('tecla 0 arma "Sem dia" quando a semana-alvo é a corrente', async () => {
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByRole('radio', { name: /^0 Sem dia/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('Enter confirma SÓ quando um alvo está armado (habilitado)', () => {
    const onConfirm = vi.fn()
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={onConfirm} onClose={vi.fn()} />,
      { wrapper },
    )
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: '3' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('2026-07-22')
  })

  it('confirmação nomeada aparece no próprio seletor, sem modal adicional', () => {
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    fireEvent.keyDown(window, { key: '3' })
    expect(screen.getByText('Migrar para quarta, 22 jul.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /confirmar/i })).not.toBeInTheDocument()
  })

  it('guard de campo editável: dígitos digitados num input não armam alvo', () => {
    render(
      <>
        <input aria-label="outro campo" />
        <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />
      </>,
      { wrapper },
    )
    fireEvent.keyDown(screen.getByLabelText('outro campo'), { key: '3' })
    expect(screen.queryAllByRole('radio').some((el) => el.getAttribute('aria-checked') === 'true')).toBe(false)
  })

  it('0 fica indisponível com motivo quando a semana-alvo NÃO é a corrente', () => {
    const onConfirm = vi.fn()
    render(
      <WeeklyDestinationPicker weekStart="2026-07-27" isCurrentWeek={false} onConfirm={onConfirm} onClose={vi.fn()} />,
      { wrapper },
    )
    const undated = screen.getByRole('radio', { name: /indisponível/i })
    expect(undated).toHaveAttribute('aria-disabled', 'true')

    fireEvent.keyDown(window, { key: '0' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('caso irmão: 0 fica DISPONÍVEL na semana corrente (par não-vacuoso)', () => {
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByRole('radio', { name: '0 Sem dia' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('jest-axe: sem violações', async () => {
    const { container } = render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('WeeklyDestinationPicker — foco (Task 9)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: EMPTY_DENSITY })
  })

  it('ao abrir, o foco vai para a primeira opção', async () => {
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    await waitFor(() => expect(screen.getAllByRole('radio')[0]).toHaveFocus())
  })

  it('no modo compact (sheet), fechar devolve o foco ao acionador', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Escolher destino…</button>
          {open && (
            <WeeklyDestinationPicker
              weekStart="2026-07-20"
              isCurrentWeek
              compact
              onConfirm={vi.fn()}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      )
    }
    render(<Harness />, { wrapper })
    const trigger = screen.getByRole('button', { name: 'Escolher destino…' })
    trigger.focus()
    fireEvent.click(trigger)

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

describe('WeeklyDestinationPicker — falha na confirmação (AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGet.mockResolvedValue({ data: EMPTY_DENSITY })
  })

  it('exibe o motivo quando o chamador passa "error", sem fechar o seletor sozinho', () => {
    render(
      <WeeklyDestinationPicker
        weekStart="2026-07-20"
        isCurrentWeek
        error="Não foi possível migrar a tarefa. Tente novamente."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar a tarefa.')
    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
  })

  it('caso irmão: sem "error", nenhum alerta aparece', () => {
    render(
      <WeeklyDestinationPicker weekStart="2026-07-20" isCurrentWeek onConfirm={vi.fn()} onClose={vi.fn()} />,
      { wrapper },
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
