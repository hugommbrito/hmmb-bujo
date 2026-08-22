import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../auth', () => ({
  useAuth: () => ({
    userId: 'user-1',
    isAuthenticated: true,
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

import client from '../../../api/client'
import { BrainDumpCaptureSheet } from './BrainDumpCaptureSheet'

const mockPost = client.post as ReturnType<typeof vi.fn>

function renderSheet(props: Partial<React.ComponentProps<typeof BrainDumpCaptureSheet>> = {}) {
  const onClose = vi.fn()
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={qc}>
      <BrainDumpCaptureSheet open onClose={onClose} {...props} />
    </QueryClientProvider>,
  )
  return { onClose, qc, ...utils }
}

describe('BrainDumpCaptureSheet — carga e campos (compact default)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('foca o título automaticamente quando aberto', async () => {
    renderSheet()
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título' })).toHaveFocus(),
    )
  })

  it('expõe as 5 opções de destino, com "Brain Dump" como default, na ordem Título → Descrição → Destino', () => {
    renderSheet()

    const combobox = screen.getByRole('combobox', { name: 'Destino' })
    expect(combobox).toHaveValue('')
    expect(within(combobox).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Brain Dump',
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Futuro',
    ])

    // Ordem de leitura dos campos no DOM (achado real de review em sheets
    // anteriores: a ordem visual precisa bater com a ordem dos elementos).
    const labels = screen.getAllByText(/^(Título|Descrição|Destino)$/)
    expect(labels.map((l) => l.textContent)).toEqual(['Título', 'Descrição', 'Destino'])
  })

  it('a dica de destino fica junto ao campo Destino (não mais no rodapé)', () => {
    renderSheet()
    expect(screen.getByText('Fica no Brain Dump até ser processado.')).toBeInTheDocument()
    expect(screen.queryByText('Salvo no Brain Dump até você processar.')).not.toBeInTheDocument()
  })

  it('botão Fechar (×) atinge o alvo de toque mínimo de 44px', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveStyle({
      minWidth: 'var(--ds-touch-target-min)',
      minHeight: 'var(--ds-touch-target-min)',
    })
  })
})

describe('BrainDumpCaptureSheet — salvar', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('submeter com título cria o item com o destino escolhido, fecha o sheet e chama onClose', async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: { id: 'bd-1', title: 'Comprar café' } })
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Comprar café')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino' }), 'week')
    await user.click(screen.getByRole('button', { name: 'Salvar no Brain Dump' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    expect(mockPost).toHaveBeenCalledWith(
      '/api/brain-dump/items/',
      expect.objectContaining({ title: 'Comprar café', targetLog: 'week' }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('submeter com o destino default (Brain Dump) cria o item sem targetLog', async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: { id: 'bd-3', title: 'Sem destino' } })
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Sem destino')
    await user.click(screen.getByRole('button', { name: 'Salvar no Brain Dump' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [url, payload] = mockPost.mock.calls[0]
    expect(url).toBe('/api/brain-dump/items/')
    expect(payload).toMatchObject({ title: 'Sem destino' })
    expect(payload.targetLog).toBeUndefined()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('Enter no campo Título submete o formulário', async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: { id: 'bd-4', title: 'Via Enter' } })
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Via Enter{Enter}')

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    expect(mockPost).toHaveBeenCalledWith(
      '/api/brain-dump/items/',
      expect.objectContaining({ title: 'Via Enter' }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('Enter repetido durante o envio não cria itens duplicados; a região fica aria-busy', async () => {
    const user = userEvent.setup()
    let resolvePost: (value: { data: { id: string; title: string } }) => void = () => {}
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Item único')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('dialog', { name: 'Captura rápida' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()

    // Segundo Enter enquanto a mutação está pendente — deve ser ignorado.
    await user.keyboard('{Enter}')
    expect(mockPost).toHaveBeenCalledTimes(1)

    resolvePost({ data: { id: 'bd-2', title: 'Item único' } })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('falha na mutação mostra o erro inline e NÃO chama onClose (nada perdido)', async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new Error('network'))
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Item que falha')
    await user.click(screen.getByRole('button', { name: 'Salvar no Brain Dump' }))

    expect(
      await screen.findByText('Não foi possível salvar. Tente novamente.'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Item que falha')
  })
})

describe('BrainDumpCaptureSheet — fechar e descartar (guarda comum a X/Esc/backdrop/Cancelar)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('botão "Fechar" (X) sem título fecha direto, sem diálogo de descarte', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar item?')).not.toBeInTheDocument()
  })

  it('botão "Fechar" (X) com título mostra o diálogo de descarte e não fecha ainda', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Não perca isto')
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(await screen.findByText('Descartar item?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Esc sem título fecha direto, sem diálogo de descarte', () => {
    const { onClose } = renderSheet()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Captura rápida' }), {
      key: 'Escape',
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar item?')).not.toBeInTheDocument()
  })

  it('Esc com título mostra o diálogo; "Continuar editando" mantém o título intacto', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    const titleInput = screen.getByRole('textbox', { name: 'Título' })
    await user.type(titleInput, 'Rascunho importante')

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Captura rápida' }), {
      key: 'Escape',
    })

    expect(await screen.findByText('Descartar item?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Continuar editando' }))

    await waitFor(() =>
      expect(screen.queryByText('Descartar item?')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Rascunho importante')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Esc com título e "Descartar" limpa os campos e chama onClose', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Rascunho a descartar')

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Captura rápida' }), {
      key: 'Escape',
    })

    const discardDialog = await screen.findByRole('dialog', { name: /descartar item/i })
    await user.click(within(discardDialog).getByRole('button', { name: 'Descartar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('clique no backdrop sem título fecha direto, sem diálogo de descarte', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    // MUI monta o Modal via portal direto em `document.body` — fora do
    // `container` do RTL, por isso a busca precisa ser em `document`.
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop as HTMLElement)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar item?')).not.toBeInTheDocument()
  })

  it('clique no backdrop com título passa pela MESMA guarda de fechamento (dialog "Descartar item?")', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Rascunho no backdrop')

    // MUI monta o Modal via portal direto em `document.body` — fora do
    // `container` do RTL, por isso a busca precisa ser em `document`.
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop as HTMLElement)

    expect(await screen.findByText('Descartar item?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('BrainDumpCaptureSheet — variante compact (Drawer, default)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('não renderiza "Cancelar" — uma única ação primária', () => {
    renderSheet()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar no Brain Dump' })).toBeInTheDocument()
  })

  it('o conteúdo declara role="dialog" + aria-modal próprios (MUI Drawer não estampa sozinho)', () => {
    renderSheet()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Captura rápida')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})

describe('BrainDumpCaptureSheet — variante ponteiro (Dialog, compact=false)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renderiza "Cancelar" ao lado de "Salvar no Brain Dump"', () => {
    renderSheet({ compact: false })
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar no Brain Dump' })).toBeInTheDocument()
  })

  it('não aninha dois role="dialog" (MUI Dialog já estampa o seu)', () => {
    renderSheet({ compact: false })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Captura rápida')
  })

  it('"Cancelar" sem título fecha direto, sem diálogo de descarte', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet({ compact: false })

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar item?')).not.toBeInTheDocument()
  })

  it('"Cancelar" com título passa pela MESMA guarda de fechamento (dialog "Descartar item?")', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet({ compact: false })

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Rascunho no ponteiro')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('Descartar item?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clique no backdrop do Dialog com título também passa pela MESMA guarda de fechamento', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet({ compact: false })

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Rascunho no backdrop do ponteiro')

    // MUI monta o Modal via portal direto em `document.body` — fora do
    // `container` do RTL, por isso a busca precisa ser em `document`.
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop as HTMLElement)

    expect(await screen.findByText('Descartar item?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('durante o envio, o próprio role="dialog" (Paper do MUI Dialog) fica aria-busy', async () => {
    const user = userEvent.setup()
    let resolvePost: (value: { data: { id: string; title: string } }) => void = () => {}
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )
    renderSheet({ compact: false })

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Item no ponteiro')
    await user.click(screen.getByRole('button', { name: 'Salvar no Brain Dump' }))

    // Diferente do compact (onde `role="dialog"` é o próprio form), no
    // ponteiro o MUI Dialog estampa `role="dialog"` no Paper — `aria-busy`
    // precisa alcançar ESSE nó, não só o form filho, para o estado pendente
    // ser visível a quem consulta o próprio dialog.
    expect(screen.getByRole('dialog', { name: 'Captura rápida' })).toHaveAttribute('aria-busy', 'true')

    resolvePost({ data: { id: 'bd-5', title: 'Item no ponteiro' } })
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
  })
})

describe('BrainDumpCaptureSheet — offline (disabled/disabledReason)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('desabilita os campos e a ação de salvar, com o motivo acessível junto ao Salvar', () => {
    renderSheet({ disabled: true, disabledReason: 'Sem conexão. Esta ação exige rede.' })

    expect(screen.getByRole('textbox', { name: 'Título' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Destino' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvar no Brain Dump' })).toBeDisabled()
    expect(screen.getByText('Sem conexão. Esta ação exige rede.')).toBeInTheDocument()
  })

  it('Fechar/Cancelar continuam disponíveis quando offline (não dependem de rede)', () => {
    renderSheet({ compact: false, disabled: true, disabledReason: 'Sem conexão. Esta ação exige rede.' })

    expect(screen.getByRole('button', { name: 'Fechar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
  })
})

describe('BrainDumpCaptureSheet — jest-axe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sem violações de acessibilidade (compact)', async () => {
    const { container } = renderSheet()
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título' })).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (ponteiro)', async () => {
    const { container } = renderSheet({ compact: false })
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título' })).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
