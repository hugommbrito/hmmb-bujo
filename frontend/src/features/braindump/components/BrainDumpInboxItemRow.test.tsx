import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { BrainDumpInboxItemRow, brainDumpMetaLineOf } from './BrainDumpInboxItemRow'
import type { BrainDumpItem } from '../types'

const ITEM: BrainDumpItem = {
  id: 'item-1',
  title: 'Renovar seguro do carro',
  description: 'Comparar cotações antes de decidir.',
  targetLog: 'week',
  createdAt: '2026-07-23T10:00:00Z',
}

const ITEM_SEM_DICA: BrainDumpItem = {
  id: 'item-2',
  title: 'Responder o e-mail da contadora',
  description: null,
  targetLog: null,
  createdAt: '2026-07-24T10:00:00Z',
}

describe('brainDumpMetaLineOf', () => {
  it('combina a dica de destino e a data de captura', () => {
    expect(brainDumpMetaLineOf(ITEM)).toBe('Dica: Esta Semana · 23 jul.')
  })

  it('sem target_log, mostra só a data', () => {
    expect(brainDumpMetaLineOf(ITEM_SEM_DICA)).toBe('24 jul.')
  })

  it('usa a data LOCAL da captura, não a data UTC (achado de review: fuso negativo à noite)', () => {
    vi.stubEnv('TZ', 'America/Sao_Paulo') // UTC-3
    try {
      // 2026-07-24T02:00:00Z = 2026-07-23 23:00 em America/Sao_Paulo — ainda dia 23 local.
      const item: BrainDumpItem = { ...ITEM_SEM_DICA, createdAt: '2026-07-24T02:00:00Z' }
      expect(brainDumpMetaLineOf(item)).toBe('23 jul.')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('BrainDumpInboxItemRow — pointer (trailing sempre visível)', () => {
  it('renderiza título, descrição e a meta combinada', () => {
    render(
      <BrainDumpInboxItemRow item={ITEM} onEdit={vi.fn()} onMove={vi.fn()} onDiscard={vi.fn()} />,
    )
    expect(screen.getByText('Renovar seguro do carro')).toBeInTheDocument()
    expect(screen.getByText('Comparar cotações antes de decidir.')).toBeInTheDocument()
    expect(screen.getByText('Dica: Esta Semana · 23 jul.')).toBeInTheDocument()
  })

  it('Mover e Descartar existem como botões trailing nomeados', () => {
    const onMove = vi.fn()
    const onDiscard = vi.fn()
    render(<BrainDumpInboxItemRow item={ITEM} onEdit={vi.fn()} onMove={onMove} onDiscard={onDiscard} />)

    fireEvent.click(screen.getByRole('button', { name: 'Mover Renovar seguro do carro' }))
    expect(onMove).toHaveBeenCalledWith(ITEM)

    fireEvent.click(screen.getByRole('button', { name: 'Descartar Renovar seguro do carro' }))
    expect(onDiscard).toHaveBeenCalledWith(ITEM)
  })

  it('Descartar dispara direto, sem dialog intermediário', () => {
    const onDiscard = vi.fn()
    render(<BrainDumpInboxItemRow item={ITEM} onEdit={vi.fn()} onMove={vi.fn()} onDiscard={onDiscard} />)

    fireEvent.click(screen.getByRole('button', { name: 'Descartar Renovar seguro do carro' }))

    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('onActivate (título) abre o sheet de edição via onEdit', () => {
    const onEdit = vi.fn()
    render(<BrainDumpInboxItemRow item={ITEM} onEdit={onEdit} onMove={vi.fn()} onDiscard={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Renovar seguro do carro' }))

    expect(onEdit).toHaveBeenCalledWith(ITEM)
  })

  it('o nome acessível do ativador é só o título — subline/descrição não entram no nome (achado de review)', () => {
    render(<BrainDumpInboxItemRow item={ITEM} onEdit={vi.fn()} onMove={vi.fn()} onDiscard={vi.fn()} />)

    // Nome EXATO "Renovar seguro do carro": nem a dica/data (subline) nem a
    // descrição entram — evita um nome que cresce sem limite com a descrição
    // e mantém dois itens de mesmo título distinguíveis quando só a
    // descrição difere.
    expect(screen.getByRole('button', { name: 'Renovar seguro do carro' })).toBeInTheDocument()
    // A descrição/subline continuam VISÍVEIS na linha, só fora do nome.
    expect(screen.getByText('Comparar cotações antes de decidir.')).toBeInTheDocument()
    expect(screen.getByText('Dica: Esta Semana · 23 jul.')).toBeInTheDocument()
  })

  it('offline desabilita Mover/Descartar', () => {
    render(
      <BrainDumpInboxItemRow item={ITEM} disabled onEdit={vi.fn()} onMove={vi.fn()} onDiscard={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Mover Renovar seguro do carro' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descartar Renovar seguro do carro' })).toBeDisabled()
  })
})

describe('BrainDumpInboxItemRow — compact (linha inteira é o alvo, sem trailing)', () => {
  it('NÃO renderiza Mover/Descartar como botões trailing — só o ativador do sheet', () => {
    render(
      <BrainDumpInboxItemRow item={ITEM} compact onEdit={vi.fn()} onMove={vi.fn()} onDiscard={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Descartar/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('o único botão (a linha) chama onEdit', () => {
    const onEdit = vi.fn()
    render(
      <BrainDumpInboxItemRow item={ITEM} compact onEdit={onEdit} onMove={vi.fn()} onDiscard={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onEdit).toHaveBeenCalledWith(ITEM)
  })
})

describe('BrainDumpInboxItemRow — jest-axe', () => {
  it('sem violações de acessibilidade (pointer)', async () => {
    const { container } = render(
      <BrainDumpInboxItemRow item={ITEM} onEdit={vi.fn()} onMove={vi.fn()} onDiscard={vi.fn()} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (compact)', async () => {
    const { container } = render(
      <BrainDumpInboxItemRow item={ITEM} compact onEdit={vi.fn()} onMove={vi.fn()} onDiscard={vi.fn()} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
