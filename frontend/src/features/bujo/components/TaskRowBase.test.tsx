import { act, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskRowBase } from './TaskRowBase'
import type { CycleStatus, Task } from '../types'

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Finalizar relatório Q2',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('TaskRowBase — anatomia por variante (AC2)', () => {
  it('variante full renderiza data-testid task-row e data-task-id', () => {
    render(<TaskRowBase task={baseTask()} cycleStatus="active" />)
    const row = screen.getByTestId('task-row')
    expect(row).toHaveAttribute('data-task-id', 'task-1')
  })

  it('variante compact NÃO renderiza indicador de ordem nem coluna de Eisenhower', () => {
    const { container } = render(
      <TaskRowBase task={baseTask({ eisenhower: 'u' })} cycleStatus="active" variant="compact" order={2} />,
    )
    expect(screen.queryByText('U')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).not.toBe('2')
  })

  it('caso irmão: variante full COM order renderiza o número (não-vacuidade)', () => {
    render(<TaskRowBase task={baseTask()} cycleStatus="active" order={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('título truncado é exibido mesmo sem onOpenDetail', () => {
    render(<TaskRowBase task={baseTask({ title: 'Sem callback' })} cycleStatus="active" />)
    expect(screen.getByText('Sem callback')).toBeInTheDocument()
  })

  it('descrição aparece truncada em uma linha quando presente', () => {
    render(
      <TaskRowBase
        task={baseTask({ description: 'Uma descrição qualquer' })}
        cycleStatus="active"
      />,
    )
    expect(screen.getByText('Uma descrição qualquer')).toBeInTheDocument()
  })

  it('caso irmão: sem descrição, nada é renderizado no lugar dela', () => {
    render(<TaskRowBase task={baseTask({ description: null })} cycleStatus="active" />)
    expect(screen.queryByText('Uma descrição qualquer')).not.toBeInTheDocument()
  })
})

describe('TaskRowBase — priority-placeholder preserva alinhamento (AC2)', () => {
  it('eisenhower null renderiza o placeholder vazio (mesma largura reservada)', () => {
    const { container } = render(
      <TaskRowBase task={baseTask({ eisenhower: null })} cycleStatus="active" />,
    )
    const placeholder = container.querySelector('[aria-hidden="true"]')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.textContent).toBe('')
  })

  it('caso irmão: eisenhower "ui" preenche o mesmo slot com U+I', () => {
    render(<TaskRowBase task={baseTask({ eisenhower: 'ui' })} cycleStatus="active" />)
    expect(screen.getByText('U+I')).toBeInTheDocument()
  })
})

describe('TaskRowBase — matriz status × ciclo: o que é controle (AC2)', () => {
  const CYCLABLE: Array<[Task['status'], CycleStatus]> = [
    ['pending', 'planning'],
    ['started', 'active'],
    ['completed', 'active'],
  ]

  it.each(CYCLABLE)(
    'status %s em ciclo %s é controle clicável que cicla via onTransition',
    (status, cycleStatus) => {
      const onTransition = vi.fn()
      render(
        <TaskRowBase
          task={baseTask({ status: status ?? 'pending' })}
          cycleStatus={cycleStatus}
          onTransition={onTransition}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /pendente|em andamento|concluída/i }))
      expect(onTransition).toHaveBeenCalledWith('task-1', expect.any(String))
    },
  )

  it.each(['cancelled', 'postponed'] as const)(
    'status %s NUNCA é controle de ciclo (mesmo em planning/active)',
    (status) => {
      const onTransition = vi.fn()
      render(
        <TaskRowBase task={baseTask({ status })} cycleStatus="active" onTransition={onTransition} />,
      )
      expect(screen.queryByRole('button', { name: /pendente|em andamento|concluída/i })).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument()
    },
  )

  it.each(['pending', 'started', 'completed'] as const)(
    'em semana finalized, %s NÃO é controle (nenhuma mutação renderizada)',
    (status) => {
      const onTransition = vi.fn()
      render(
        <TaskRowBase
          task={baseTask({ status })}
          cycleStatus="finalized"
          onTransition={onTransition}
        />,
      )
      expect(screen.queryByRole('button', { name: /pendente|em andamento|concluída/i })).not.toBeInTheDocument()
    },
  )

  it.each(['pending', 'started', 'completed'] as const)(
    'variant="readonly" desabilita %s mesmo quando cycleStatus NÃO é "finalized" (closed legado)',
    (status) => {
      // Regressão: `WeeklyTaskPanel` traduz `closed` legado (status IS NULL)
      // em `variant="readonly"`, mas `cycleStatus` continua chegando cru
      // (`active`/`planning`/null) — a matriz de controle não pode depender
      // só de `cycleStatus === 'finalized'`, senão o ícone vira botão
      // clicável (mutação real) numa semana que a UI trata como fechada.
      const onTransition = vi.fn()
      render(
        <TaskRowBase
          task={baseTask({ status })}
          cycleStatus="active"
          variant="readonly"
          onTransition={onTransition}
        />,
      )
      expect(screen.queryByRole('button', { name: /pendente|em andamento|concluída/i })).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument()
    },
  )

  it('migrated é SEMPRE controle de linhagem, mesmo em finalized — a única mutação-zero que sobrevive', () => {
    render(<TaskRowBase task={baseTask({ status: 'migrated', migratedToTask: 'task-2' })} cycleStatus="finalized" />)
    expect(screen.getByRole('button', { name: /migrada/i })).toBeInTheDocument()
  })

  it('migrated NUNCA cicla status por clique (não chama onTransition)', () => {
    const onTransition = vi.fn()
    render(
      <TaskRowBase
        task={baseTask({ status: 'migrated', migratedToTask: 'task-2' })}
        cycleStatus="active"
        onTransition={onTransition}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /migrada/i }))
    expect(onTransition).not.toHaveBeenCalled()
  })
})

describe('TaskRowBase — de-ênfase terminal sem perder o título nem a seta (AC1/AC2)', () => {
  // A opacidade reduzida vive SÓ no ícone de status (fundo opaco, contraste
  // interno intocado) — nunca no container da linha nem no título (fundo
  // transparente): dimming aí se acumula com o de qualquer ancestral e reprova
  // `color-contrast` do axe em telas estreitas (gap real da Task 12; jsdom não
  // pega porque `toHaveStyle` não simula composição visual de opacity entre
  // elementos, só o valor literal da propriedade).
  it('status terminal (completed) aplica opacity reduzida no ÍCONE de status', () => {
    render(<TaskRowBase task={baseTask({ status: 'completed' })} cycleStatus="active" />)
    const icon = screen.getByRole('button', { name: 'Concluída' })
    expect(icon).toHaveStyle({ opacity: 'var(--ds-task-row-terminal-opacity)' })
  })

  it('caso irmão: status não-terminal (pending) NÃO aplica opacity reduzida no ícone', () => {
    render(<TaskRowBase task={baseTask({ status: 'pending' })} cycleStatus="active" />)
    const icon = screen.getByRole('button', { name: 'Pendente' })
    expect(icon).not.toHaveStyle({ opacity: 'var(--ds-task-row-terminal-opacity)' })
  })

  it('o título NUNCA recebe opacity reduzida, mesmo com status terminal (completed)', () => {
    render(<TaskRowBase task={baseTask({ status: 'completed', title: 'Tarefa feita' })} cycleStatus="active" />)
    const title = screen.getByText('Tarefa feita')
    expect(title).not.toHaveStyle({ opacity: 'var(--ds-task-row-terminal-opacity)' })
  })

  it('a seta de linhagem permanece em opacidade plena mesmo com a linha de-enfatizada', () => {
    render(
      <TaskRowBase
        task={baseTask({ status: 'migrated', migratedToTask: 'task-2' })}
        cycleStatus="active"
      />,
    )
    const arrow = screen.getByRole('button', { name: /migrada/i })
    expect(arrow).not.toHaveStyle({ opacity: 'var(--ds-task-row-terminal-opacity)' })
  })
})

describe('TaskRowBase — subtarefas (AC2)', () => {
  it('renderiza subtarefas recursivamente, indentadas', () => {
    render(
      <TaskRowBase
        task={baseTask({
          subtasks: [baseTask({ id: 'sub-1', title: 'Subtarefa 1' })],
        })}
        cycleStatus="active"
      />,
    )
    expect(screen.getByText('Subtarefa 1')).toBeInTheDocument()
    expect(screen.getAllByTestId('task-row')).toHaveLength(2)
  })

  it('subtarefa não exibe indicador de ordem', () => {
    render(
      <TaskRowBase
        task={baseTask({
          subtasks: [baseTask({ id: 'sub-1', title: 'Subtarefa 1' })],
        })}
        cycleStatus="active"
        order={1}
      />,
    )
    // A linha pai mostra "1"; a subtarefa não mostra nenhum número de ordem.
    expect(screen.getAllByText('1')).toHaveLength(1)
  })
})

describe('TaskRowBase — jest-axe', () => {
  it('sem violações de acessibilidade', async () => {
    const { container } = render(
      <TaskRowBase task={baseTask({ eisenhower: 'u', description: 'nota' })} cycleStatus="active" order={1} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('TaskRowBase — navegação de linhagem (Task 3)', () => {
  it('sucessor presente no DOM (intra-semana): clique navega, foca e destaca temporariamente', async () => {
    vi.useFakeTimers()
    const origem = baseTask({ id: 'origem', status: 'migrated', migratedToTask: 'sucessor' })
    const sucessor = baseTask({ id: 'sucessor', title: 'Tarefa sucessora' })

    render(
      <>
        <TaskRowBase task={origem} cycleStatus="active" />
        <TaskRowBase task={sucessor} cycleStatus="active" />
      </>,
    )
    // Deixa o efeito de disponibilidade do sucessor rodar.
    await act(async () => {
      await Promise.resolve()
    })

    const arrow = screen.getByRole('button', { name: /migrada — ir para o sucessor/i })
    expect(arrow).toHaveAttribute('aria-disabled', 'false')

    await act(async () => {
      fireEvent.click(arrow)
    })

    const successorRow = screen.getAllByTestId('task-row')[1]
    expect(successorRow).toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(successorRow).not.toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })
    vi.useRealTimers()
  })

  it('destaque encerra pela PRIMEIRA interação (clique), sem esperar os 2000ms do timer', async () => {
    // Par não-vacuoso do teste acima: lá o timer sozinho encerra; aqui a
    // interação sozinha encerra ANTES do timer — "por timer OU por interação"
    // exige provar os dois mecanismos separadamente (a story flagra assert
    // vacuoso como achado recorrente do projeto).
    vi.useFakeTimers()
    const origem = baseTask({ id: 'origem', status: 'migrated', migratedToTask: 'sucessor' })
    const sucessor = baseTask({ id: 'sucessor', title: 'Tarefa sucessora' })

    render(
      <>
        <TaskRowBase task={origem} cycleStatus="active" />
        <TaskRowBase task={sucessor} cycleStatus="active" />
      </>,
    )
    await act(async () => {
      await Promise.resolve()
    })

    const arrow = screen.getByRole('button', { name: /migrada — ir para o sucessor/i })
    await act(async () => {
      fireEvent.click(arrow)
    })

    const successorRow = screen.getAllByTestId('task-row')[1]
    expect(successorRow).toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })

    await act(async () => {
      vi.advanceTimersByTime(500) // bem antes dos 2000ms do timer
      fireEvent.click(successorRow)
    })
    expect(successorRow).not.toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })
    vi.useRealTimers()
  })

  it('sucessor ausente do DOM (fora da semana carregada): aria-disabled com motivo, nunca oculta', async () => {
    const origem = baseTask({ id: 'origem', status: 'migrated', migratedToTask: 'em-outro-periodo' })
    render(<TaskRowBase task={origem} cycleStatus="active" />)
    await act(async () => {
      await Promise.resolve()
    })

    const arrow = screen.getByRole('button', { name: /o sucessor está em outro período/i })
    expect(arrow).toHaveAttribute('aria-disabled', 'true')
  })
})
