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

function renderSheet(open = true) {
  const onClose = vi.fn()
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={qc}>
      <BrainDumpCaptureSheet open={open} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose, qc, ...utils }
}

describe('BrainDumpCaptureSheet', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('foca o título automaticamente quando aberto', async () => {
    renderSheet(true)
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título' })).toHaveFocus(),
    )
  })

  it('expõe as 5 opções de destino, com "Brain Dump" como default', async () => {
    const user = userEvent.setup()
    renderSheet(true)

    // Valor default (vazio) exibe o label "Brain Dump".
    const combobox = screen.getByRole('combobox', { name: 'Destino' })
    expect(combobox).toHaveTextContent('Brain Dump')

    await user.click(combobox)
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(5)
    expect(options.map((o) => o.textContent)).toEqual([
      'Brain Dump',
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Futuro',
    ])
  })

  it('submeter com título cria o item com o destino escolhido e chama onClose', async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: { id: 'bd-1', title: 'Comprar café' } })
    const { onClose } = renderSheet(true)

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Comprar café')

    // Escolhe um destino não-default ("Esta Semana" → 'week').
    await user.click(screen.getByRole('combobox', { name: 'Destino' }))
    await user.click(await screen.findByRole('option', { name: 'Esta Semana' }))

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    expect(mockPost).toHaveBeenCalledWith(
      '/api/brain-dump/items/',
      expect.objectContaining({ title: 'Comprar café', targetLog: 'week' }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('submeter com o destino default (Brain Dump) cria o item sem targetLog', async () => {
    // AC #1: default do select é "Brain Dump" (valor vazio). Sem escolher outro
    // destino, o payload não carrega `targetLog` — o caminho mais comum (Fluxo 2
    // da UX), até então coberto só pelo caso não-default ('week').
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: { id: 'bd-3', title: 'Sem destino' } })
    const { onClose } = renderSheet(true)

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Sem destino')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [url, payload] = mockPost.mock.calls[0]
    expect(url).toBe('/api/brain-dump/items/')
    expect(payload).toMatchObject({ title: 'Sem destino' })
    expect(payload.targetLog).toBeUndefined()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('Enter no campo Título submete o formulário (AC #1: "Enter no último campo")', async () => {
    // AC #1 aceita salvar "por botão ou Enter no último campo": Enter no Título
    // (single-line) dispara o submit implícito do form, sem handler custom.
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ data: { id: 'bd-4', title: 'Via Enter' } })
    const { onClose } = renderSheet(true)

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Via Enter{Enter}')

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    expect(mockPost).toHaveBeenCalledWith(
      '/api/brain-dump/items/',
      expect.objectContaining({ title: 'Via Enter' }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('Enter repetido durante o envio não cria itens duplicados', async () => {
    // AC #1 aceita salvar por Enter no Título; o botão Salvar já fica disabled
    // durante o envio, mas o Enter contorna o botão. Com a mutação em voo,
    // um segundo Enter não deve disparar um segundo POST.
    const user = userEvent.setup()
    let resolvePost: (value: { data: { id: string; title: string } }) => void = () => {}
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve
      }),
    )
    const { onClose } = renderSheet(true)

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Item único')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    // Segundo Enter enquanto a mutação está pendente — deve ser ignorado.
    await user.keyboard('{Enter}')
    expect(mockPost).toHaveBeenCalledTimes(1)

    resolvePost({ data: { id: 'bd-2', title: 'Item único' } })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('botão "Fechar" (X) sem título fecha direto, sem diálogo de descarte (AC #2)', async () => {
    // O X do cabeçalho converge para o mesmo `requestClose` do Esc/swipe-down;
    // até então só o Esc exercitava esse handler.
    const user = userEvent.setup()
    const { onClose } = renderSheet(true)

    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar item?')).not.toBeInTheDocument()
  })

  it('botão "Fechar" (X) com título mostra o diálogo de descarte e não fecha ainda (AC #2)', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet(true)

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Não perca isto')
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(await screen.findByText('Descartar item?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Esc sem título fecha direto, sem diálogo de descarte', () => {
    const { onClose } = renderSheet(true)

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Captura rápida' }), {
      key: 'Escape',
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar item?')).not.toBeInTheDocument()
  })

  it('Esc com título mostra o diálogo; "Continuar editando" mantém o título intacto', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet(true)

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
    const { onClose } = renderSheet(true)

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Rascunho a descartar')

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Captura rápida' }), {
      key: 'Escape',
    })

    const discardDialog = await screen.findByRole('dialog', { name: /descartar item/i })
    await user.click(within(discardDialog).getByRole('button', { name: 'Descartar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('falha na mutação mostra o erro inline e NÃO chama onClose (nada perdido)', async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new Error('network'))
    const { onClose } = renderSheet(true)

    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Item que falha')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('Não foi possível salvar. Tente novamente.'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    // Conteúdo do formulário permanece — nenhuma captura perdida silenciosamente.
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Item que falha')
  })

  it('sem violações de acessibilidade com o sheet aberto', async () => {
    const { container } = renderSheet(true)
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Título' })).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
