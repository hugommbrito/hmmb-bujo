import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import type { ReactNode } from 'react'

import { BrainDumpItemSheet } from './BrainDumpItemSheet'
import type { BrainDumpItem } from '../types'

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

const mockPatch = client.patch as ReturnType<typeof vi.fn>

const ITEM: BrainDumpItem = {
  id: 'item-1',
  title: 'Renovar seguro do carro',
  description: 'Comparar cotações antes de decidir.',
  targetLog: 'week',
  createdAt: '2026-07-23T10:00:00Z',
}

function renderSheet(props: Partial<React.ComponentProps<typeof BrainDumpItemSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const onClose = vi.fn()
  const onMove = vi.fn()
  const onDiscard = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const utils = render(
    <BrainDumpItemSheet item={ITEM} onClose={onClose} onMove={onMove} onDiscard={onDiscard} {...props} />,
    { wrapper },
  )
  return { ...utils, onClose, onMove, onDiscard, qc }
}

describe('BrainDumpItemSheet — carga e dirty-check (Story 15.1, M11)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('pré-preenche os 3 campos com os valores carregados', () => {
    renderSheet()
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Renovar seguro do carro')
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toHaveValue(
      'Comparar cotações antes de decidir.',
    )
    expect(screen.getByRole('combobox', { name: 'Destino' })).toHaveValue('week')
  })

  it('usa a data LOCAL da captura, não a data UTC (achado de review: fuso negativo à noite)', () => {
    vi.stubEnv('TZ', 'America/Sao_Paulo') // UTC-3
    try {
      // 2026-07-24T02:00:00Z = 2026-07-23 23:00 em America/Sao_Paulo — ainda dia 23 local.
      // `ITEM.targetLog = 'week'` faz a linha de meta incluir "· Dica: Esta
      // Semana" na MESMA linha de texto (achado de review: o match exato
      // anterior nunca batia com o texto combinado — nunca detectado porque
      // o job de frontend do CI não roda vitest, item já deferido na spec).
      renderSheet({ item: { ...ITEM, createdAt: '2026-07-24T02:00:00Z' } })
      expect(screen.getByText((_, node) => node?.textContent === 'Capturado em 23 jul. · Dica: Esta Semana')).toBeInTheDocument()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('fechar sem alteração fecha direto, sem dialog', () => {
    const { onClose } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar alterações?')).not.toBeInTheDocument()
  })

  it('fechar com alteração não salva abre "Descartar alterações?", foco em Continuar editando', async () => {
    const { onClose } = renderSheet()
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Novo título' } })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    const dialogTitle = await screen.findByText('Descartar alterações?')
    expect(dialogTitle).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continuar editando' })).toHaveFocus(),
    )
  })

  it('"Continuar editando" fecha o dialog e preserva o rascunho', async () => {
    renderSheet()
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Novo título' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await screen.findByText('Descartar alterações?')

    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }))

    await waitFor(() => expect(screen.queryByText('Descartar alterações?')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Novo título')
  })

  it('"Descartar" no dialog de confirmação fecha o sheet', async () => {
    const { onClose } = renderSheet()
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Novo título' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await screen.findByText('Descartar alterações?')

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BrainDumpItemSheet — salvar (não-otimista)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('Salvar fica desabilitado sem alteração', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('item com description "" (não null) NÃO reporta dirty ao abrir sem editar nada (achado de review #1)', () => {
    // `allow_blank=True` no serializer: descrição gravada pode ser "" (não
    // `null`). Antes do fix, o lado "atual" comparava `'' → null` mas o lado
    // "original" comparava `'' ?? null → ''` (só `??` não colapsa string
    // vazia) — reportava dirty desde o load, Salvar habilitado à toa e
    // fechar abria "Descartar alterações?" sem NENHUMA edição real.
    const { onClose } = renderSheet({ item: { ...ITEM, description: '' } })

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar alterações?')).not.toBeInTheDocument()
  })

  it('salvar sucesso: envia só os campos alterados, fecha o sheet', async () => {
    mockPatch.mockResolvedValueOnce({ data: { ...ITEM, title: 'Renomeado' } })
    const { onClose } = renderSheet()

    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Renomeado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/brain-dump/items/item-1/', { title: 'Renomeado' }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('falha de escrita preserva os 3 campos, sheet permanece aberto, erro junto à ação', async () => {
    mockPatch.mockRejectedValueOnce(new Error('falha de rede'))
    const { onClose } = renderSheet()

    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Renomeado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Renomeado')
  })

  it('título vazio desabilita Salvar e mostra erro inline ao perder o foco (achado de review: antes o botão ficava clicável)', () => {
    renderSheet()
    const titleField = screen.getByRole('textbox', { name: 'Título' })
    fireEvent.change(titleField, { target: { value: '' } })

    // Botão reflete a invalidez diretamente (achado de review): antes disso
    // ficava habilitado com o título vazio, e o guard só disparava no clique.
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()

    fireEvent.blur(titleField)
    expect(screen.getByText('Informe um título.')).toBeInTheDocument()
    expect(mockPatch).not.toHaveBeenCalled()
  })
})

describe('BrainDumpItemSheet — responsivo (compact vs pointer)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('pointer: NÃO renderiza Mover/Descartar (já são botões trailing na linha)', () => {
    renderSheet({ compact: false })
    expect(screen.queryByRole('button', { name: 'Mover para um log' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar item' })).not.toBeInTheDocument()
  })

  it('compact: renderiza Mover e Descartar junto aos campos', () => {
    renderSheet({ compact: true })
    expect(screen.getByRole('button', { name: 'Mover para um log' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar item' })).toBeInTheDocument()
  })

  it('compact: Descartar item executa direto, sem dialog', () => {
    const { onDiscard } = renderSheet({ compact: true })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar item' }))

    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartar alterações?')).not.toBeInTheDocument()
  })

  it('compact: Mover para um log aciona onMove', () => {
    const { onMove } = renderSheet({ compact: true })
    fireEvent.click(screen.getByRole('button', { name: 'Mover para um log' }))
    expect(onMove).toHaveBeenCalledTimes(1)
  })

  it('pointer: não aninha dois role="dialog" (achado de review #2 — MUI Dialog já estampa o seu)', () => {
    renderSheet({ compact: false })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Item do Brain Dump')
  })

  it('compact: o conteúdo declara role="dialog" próprio (MUI Drawer não estampa um sozinho)', () => {
    renderSheet({ compact: true })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Item do Brain Dump')
  })
})

describe('BrainDumpItemSheet — offline', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('desabilita os campos e Salvar com o motivo visível', () => {
    renderSheet({ disabled: true, disabledReason: 'Sem conexão. Esta ação exige rede.' })
    expect(screen.getByRole('textbox', { name: 'Título' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByText('Sem conexão. Esta ação exige rede.')).toBeInTheDocument()
  })
})

describe('BrainDumpItemSheet — jest-axe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sem violações de acessibilidade (pointer)', async () => {
    const { container } = renderSheet({ compact: false })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (compact)', async () => {
    const { container } = renderSheet({ compact: true })
    expect(await axe(container)).toHaveNoViolations()
  })
})
