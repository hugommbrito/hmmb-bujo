import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GateRow } from './GateRow'

describe('GateRow (Story 14.11)', () => {
  it('✓ não mostra motivo mesmo quando informado', () => {
    render(<GateRow label="Planejamento concluído" ok reason="não deveria aparecer" />)
    expect(screen.getByText('Planejamento concluído')).toBeInTheDocument()
    expect(screen.queryByText('não deveria aparecer')).not.toBeInTheDocument()
  })

  it('✗ mostra o motivo ao lado do rótulo', () => {
    render(
      <GateRow
        label="Sem tarefas abertas"
        ok={false}
        reason="subtarefas incluídas — decida todas antes de finalizar"
      />,
    )
    expect(screen.getByText('Sem tarefas abertas')).toBeInTheDocument()
    expect(screen.getByText('subtarefas incluídas — decida todas antes de finalizar')).toBeInTheDocument()
  })

  it('✗ sem motivo renderiza só o rótulo (compatível com os painéis de Iniciar)', () => {
    const { container } = render(<GateRow label="Data alcançada" ok={false} />)
    expect(screen.getByText('Data alcançada')).toBeInTheDocument()
    expect(container.textContent).toBe('✗Data alcançada')
  })
})
