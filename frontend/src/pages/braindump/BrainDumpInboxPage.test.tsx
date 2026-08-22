import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'

import { createBujoTheme } from '../../theme'
import { mediaQueries } from '../../shared/design/tokens'
import { BrainDumpInboxPage } from './BrainDumpInboxPage'
import type { BrainDumpItem } from '../../features/braindump'

// `vi.resetAllMocks()` também limpa o mock GLOBAL de `window.matchMedia`
// (`test-setup.ts`) — sem reafirmar `tabletUp`, `useMediaQuery` recebe
// `undefined` e a página quebra ao montar (mesmo achado de
// `RecurringLibraryPage.test.tsx`). Faixa larga por padrão (pointer, com
// trailing Mover/Descartar visíveis).
function mockWideFaixa() {
  const tabletUp: string = mediaQueries.tabletUp
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === tabletUp,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const mockDiscardMutate = vi.fn()

vi.mock('../../features/braindump', () => ({
  useBrainDumpItemsQuery: vi.fn(),
  useDiscardBrainDumpItemMutation: () => ({ mutate: mockDiscardMutate }),
  BrainDumpInboxCaptureForm: (props: { disabled?: boolean; disabledReason?: string }) => (
    <div data-testid="capture-form-mock">
      Capturar mock
      {props.disabled && <span>{props.disabledReason}</span>}
    </div>
  ),
  BrainDumpInboxItemRow: ({
    item,
    onEdit,
    onMove,
    onDiscard,
  }: {
    item: BrainDumpItem
    onEdit: (item: BrainDumpItem) => void
    onMove: (item: BrainDumpItem) => void
    onDiscard: (item: BrainDumpItem) => void
  }) => (
    <div data-testid="item-row-mock">
      <span>{item.title}</span>
      <button onClick={() => onEdit(item)}>Editar {item.title}</button>
      <button onClick={() => onMove(item)}>Mover {item.title}</button>
      <button onClick={() => onDiscard(item)}>Descartar {item.title}</button>
    </div>
  ),
  BrainDumpItemSheet: ({
    item,
    onClose,
    onMove,
    onDiscard,
  }: {
    item: BrainDumpItem
    onClose: () => void
    onMove: () => void
    onDiscard: () => void
  }) => (
    <div role="dialog" aria-label="sheet-mock">
      Sheet: {item.title}
      <button onClick={onClose}>Fechar sheet</button>
      <button onClick={onMove}>Mover do sheet</button>
      <button onClick={onDiscard}>Descartar do sheet</button>
    </div>
  ),
  BrainDumpDestinationPicker: ({ item, onClose }: { item: BrainDumpItem; onClose: () => void }) => (
    <div role="dialog" aria-label="picker-mock">
      Picker: {item.title}
      <button onClick={onClose}>Fechar picker</button>
    </div>
  ),
}))

import { useBrainDumpItemsQuery } from '../../features/braindump'

const mockUseBrainDumpItemsQuery = useBrainDumpItemsQuery as ReturnType<typeof vi.fn>

function renderPage() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <BrainDumpInboxPage />
    </ThemeProvider>,
  )
}

const ITEMS: BrainDumpItem[] = [
  { id: 'item-1', title: 'Renovar seguro do carro', description: null, targetLog: 'week', createdAt: '2026-07-23T10:00:00Z' },
  { id: 'item-2', title: 'Comprar filtro de água', description: null, targetLog: null, createdAt: '2026-07-25T10:00:00Z' },
]

describe('BrainDumpInboxPage — estados (Story 15.1, M11)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
  })

  it('loading preserva header e captura, com skeleton de 5 linhas', () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: true, isError: false, data: undefined })
    renderPage()

    expect(screen.getByLabelText('Brain Dump')).toBeInTheDocument()
    expect(screen.getByTestId('capture-form-mock')).toBeInTheDocument()
    expect(screen.queryByText('Pendências')).not.toBeInTheDocument()
  })

  it('vazio mostra "Brain Dump vazio." — único texto, captura continua visível', () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, isError: false, data: [] })
    renderPage()

    expect(screen.getByText('Brain Dump vazio.')).toBeInTheDocument()
    expect(screen.getByTestId('capture-form-mock')).toBeInTheDocument()
  })

  it('erro de leitura mostra banner + retry, sem bloquear a captura', () => {
    const refetch = vi.fn()
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, isError: true, data: undefined, refetch })
    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as pendências.')
    expect(screen.getByTestId('capture-form-mock')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('lista populada mostra a contagem e uma linha por item', () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, isError: false, data: ITEMS })
    renderPage()

    expect(screen.getByText('2 itens')).toBeInTheDocument()
    expect(screen.getByText('Renovar seguro do carro')).toBeInTheDocument()
    expect(screen.getByText('Comprar filtro de água')).toBeInTheDocument()
  })
})

describe('BrainDumpInboxPage — orquestração de overlays', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, isError: false, data: ITEMS })
  })

  it('Editar abre o sheet do item', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Renovar seguro do carro' }))
    expect(screen.getByRole('dialog', { name: 'sheet-mock' })).toHaveTextContent('Renovar seguro do carro')
  })

  it('Mover (linha) abre o seletor de destino direto', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Mover Renovar seguro do carro' }))
    expect(screen.getByRole('dialog', { name: 'picker-mock' })).toHaveTextContent('Renovar seguro do carro')
  })

  it('Descartar (linha) chama a mutation direto, sem dialog intermediário', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar Comprar filtro de água' }))
    expect(mockDiscardMutate).toHaveBeenCalledWith({ itemId: 'item-2' }, expect.anything())
  })

  it('Mover a partir do sheet fecha o sheet e abre o seletor — nunca empilham', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Renovar seguro do carro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover do sheet' }))

    expect(screen.queryByRole('dialog', { name: 'sheet-mock' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'picker-mock' })).toBeInTheDocument()
  })

  it('Descartar a partir do sheet fecha o sheet e chama a mutation direto', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Renovar seguro do carro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar do sheet' }))

    expect(screen.queryByRole('dialog', { name: 'sheet-mock' })).not.toBeInTheDocument()
    expect(mockDiscardMutate).toHaveBeenCalledWith({ itemId: 'item-1' }, expect.anything())
  })

  it('fechar o sheet de edição devolve o foco ao acionador da linha (I/O Matrix — achado de review)', async () => {
    const user = userEvent.setup()
    renderPage()

    const editButton = screen.getByRole('button', { name: 'Editar Renovar seguro do carro' })
    await user.click(editButton)
    await user.click(screen.getByRole('button', { name: 'Fechar sheet' }))

    expect(editButton).toHaveFocus()
  })

  it('fechar o seletor de destino aberto DIRETO da linha devolve o foco ao botão Mover (achado de review — antes não restaurava foco nenhum)', async () => {
    const user = userEvent.setup()
    renderPage()

    const moveButton = screen.getByRole('button', { name: 'Mover Renovar seguro do carro' })
    await user.click(moveButton)
    await user.click(screen.getByRole('button', { name: 'Fechar picker' }))

    expect(moveButton).toHaveFocus()
  })

  it('mover a partir do sheet e depois fechar o seletor devolve o foco ao acionador ORIGINAL da linha, não a um botão já desmontado (achado de review)', async () => {
    const user = userEvent.setup()
    renderPage()

    const editButton = screen.getByRole('button', { name: 'Editar Renovar seguro do carro' })
    await user.click(editButton)
    await user.click(screen.getByRole('button', { name: 'Mover do sheet' }))
    await user.click(screen.getByRole('button', { name: 'Fechar picker' }))

    expect(editButton).toHaveFocus()
  })
})

describe('BrainDumpInboxPage — jest-axe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWideFaixa()
  })

  it('sem violações de acessibilidade (populado)', async () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, isError: false, data: ITEMS })
    const { container } = renderPage()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (vazio)', async () => {
    mockUseBrainDumpItemsQuery.mockReturnValue({ isPending: false, isError: false, data: [] })
    const { container } = renderPage()
    expect(await axe(container)).toHaveNoViolations()
  })
})
