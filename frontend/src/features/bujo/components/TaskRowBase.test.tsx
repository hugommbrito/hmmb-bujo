import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// ═══════════════════════════════════════════════════════════════════════════
// Story 14.7 (M08) — as duas extensões aditivas da AC5
// ═══════════════════════════════════════════════════════════════════════════

describe('TaskRowBase — allowStatusCycle (Story 14.7, AC5 extensão a)', () => {
  it('allowStatusCycle={false} degrada o ícone para role="img" (concluir/cancelar fora do Future Log)', () => {
    const onTransition = vi.fn()
    render(
      <TaskRowBase
        task={baseTask({ status: 'pending' })}
        cycleStatus="active"
        allowStatusCycle={false}
        onTransition={onTransition}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Pendente' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pendente' })).toBeInTheDocument()
  })

  it('caso irmão: sem a prop (default) o mesmo status É controle clicável', () => {
    const onTransition = vi.fn()
    render(
      <TaskRowBase task={baseTask({ status: 'pending' })} cycleStatus="active" onTransition={onTransition} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pendente' }))
    expect(onTransition).toHaveBeenCalledWith('task-1', 'started')
  })

  it('allowStatusCycle={false} PRESERVA o trailingSlot (é por isso que variant="readonly" não serve)', () => {
    render(
      <TaskRowBase
        task={baseTask()}
        cycleStatus="active"
        allowStatusCycle={false}
        trailingSlot={<button type="button">Definir dia</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Definir dia' })).toBeInTheDocument()
  })

  it('allowStatusCycle={false} NÃO desliga o controle de linhagem (navegação, não mutação)', async () => {
    render(
      <TaskRowBase
        task={baseTask({ status: 'postponed', migratedToTask: 'em-outro-periodo' })}
        cycleStatus="active"
        allowStatusCycle={false}
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: /adiada/i })).toBeInTheDocument()
  })
})

describe('TaskRowBase — seta de linhagem sobre postponed (Story 14.7, AC4/AC5 extensão b)', () => {
  it('postponed COM migratedToTask e sucessor no DOM: botão navega, foca e destaca', async () => {
    vi.useFakeTimers()
    const origem = baseTask({ id: 'origem', status: 'postponed', migratedToTask: 'sucessor' })
    const sucessor = baseTask({ id: 'sucessor', title: 'Consulta com a dentista' })

    render(
      <>
        <TaskRowBase task={origem} cycleStatus="active" />
        <TaskRowBase task={sucessor} cycleStatus="active" />
      </>,
    )
    await act(async () => {
      await Promise.resolve()
    })

    const arrow = screen.getByRole('button', { name: 'Adiada — ir para o sucessor' })
    expect(arrow).toHaveAttribute('aria-disabled', 'false')

    await act(async () => {
      fireEvent.click(arrow)
    })

    const successorRow = screen.getAllByTestId('task-row')[1]
    expect(successorRow).toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })
    expect(successorRow).toHaveFocus()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(successorRow).not.toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })
    vi.useRealTimers()
  })

  it('postponed COM migratedToTask e sucessor AUSENTE: aria-disabled com motivo, nunca oculta', async () => {
    render(
      <TaskRowBase
        task={baseTask({ status: 'postponed', migratedToTask: 'em-outro-periodo' })}
        cycleStatus="active"
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    const arrow = screen.getByRole('button', { name: 'Adiada — O sucessor está em outro período' })
    expect(arrow).toHaveAttribute('aria-disabled', 'true')
  })

  it('IRMÃO DE NÃO-VACUIDADE: postponed SEM migratedToTask continua role="img" mudo', () => {
    // Estado legal da matriz `ALLOWED` (pending/started → POSTPONED direto, sem
    // passar por `migrate_task`): sem linhagem não há para onde navegar. É a
    // guarda por `migratedToTask` que mantém isso — e que mantém o teste
    // pré-existente `postponed NUNCA é controle de ciclo` verde sem edição.
    render(<TaskRowBase task={baseTask({ status: 'postponed' })} cycleStatus="active" />)
    expect(screen.queryByRole('button', { name: /adiada/i })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Adiada' })).toBeInTheDocument()
  })

  it('IRMÃO DE NÃO-VACUIDADE: cancelled COM migratedToTask segue fora do controle de linhagem', () => {
    // `destination:'cancel'` não cria sucessor; a generalização é só para os
    // dois status que `migrate_task` produz com linhagem (Questão aberta #7).
    render(
      <TaskRowBase
        task={baseTask({ status: 'cancelled', migratedToTask: 'seja-la-o-que-for' })}
        cycleStatus="active"
      />,
    )
    expect(screen.getByRole('img', { name: 'Cancelada' })).toBeInTheDocument()
  })

  it('a seta é ALCANÇÁVEL e ACIONÁVEL por teclado — Enter e Space (AC7)', async () => {
    // A AC7 exige "ativação por Enter/Space", e isso não sai de graça só por
    // existir um `<button>`: `fireEvent.keyDown` não sintetiza clique nenhum,
    // então o assert precisa do `user-event`, que reproduz o comportamento
    // nativo do browser (Enter/Space num botão focado disparam o clique).
    const user = userEvent.setup()
    const origem = baseTask({ id: 'origem', status: 'postponed', migratedToTask: 'sucessor' })
    const sucessor = baseTask({ id: 'sucessor', title: 'Consulta com a dentista' })

    render(
      <>
        <TaskRowBase task={origem} cycleStatus="active" />
        <TaskRowBase task={sucessor} cycleStatus="active" />
      </>,
    )
    await act(async () => {
      await Promise.resolve()
    })

    const arrow = screen.getByRole('button', { name: 'Adiada — ir para o sucessor' })
    const successorRow = screen.getAllByTestId('task-row')[1]

    // Alcançável: a seta recebe foco de teclado.
    arrow.focus()
    expect(arrow).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(successorRow).toHaveFocus()

    // E de novo por Space, a partir da seta refocada — os dois mecanismos são
    // exigidos nominalmente pela AC, então os dois são provados separadamente.
    arrow.focus()
    await user.keyboard(' ')
    expect(successorRow).toHaveFocus()
  })

  it('IRMÃ DE NÃO-VACUIDADE: a seta aria-disabled não navega quando acionada', async () => {
    // `aria-disabled` não é `disabled`: o browser ATIVA o botão normalmente. Se
    // o handler não guardasse a ausência do sucessor, "sucessor em outro
    // período" viraria um clique que rouba o foco para lugar nenhum.
    const user = userEvent.setup()
    render(
      <TaskRowBase
        task={baseTask({ id: 'origem', status: 'postponed', migratedToTask: 'em-outro-periodo' })}
        cycleStatus="active"
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })

    const arrow = screen.getByRole('button', { name: 'Adiada — O sucessor está em outro período' })
    arrow.focus()
    await user.keyboard('{Enter}')

    // O foco não escapou e a própria linha não foi destacada (não há sucessor).
    expect(arrow).toHaveFocus()
    expect(screen.getByTestId('task-row')).not.toHaveStyle({ backgroundColor: 'var(--ds-info-soft)' })
  })

  it('REGRESSÃO migrated: rótulo e ícone derivados do status real produzem as MESMAS strings', async () => {
    render(
      <TaskRowBase
        task={baseTask({ status: 'migrated', migratedToTask: 'em-outro-periodo' })}
        cycleStatus="active"
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(
      screen.getByRole('button', { name: 'Migrada — O sucessor está em outro período' }),
    ).toBeInTheDocument()
  })
})
