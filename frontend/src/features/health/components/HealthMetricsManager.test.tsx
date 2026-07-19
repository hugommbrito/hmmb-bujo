import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'

vi.mock('../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import client from '../../../api/client'
import { HealthMetricsManager } from './HealthMetricsManager'
import type { HealthFieldDefinition } from '../types'

const mockGet = client.get as ReturnType<typeof vi.fn>
const mockPost = client.post as ReturnType<typeof vi.fn>
const mockPatch = client.patch as ReturnType<typeof vi.fn>

const FIELD_PESO: HealthFieldDefinition = {
  id: 'f-peso',
  name: 'Peso',
  fieldType: 'decimal',
  enumOptions: [],
  active: true,
  displayOrder: 0,
}

const FIELD_HUMOR: HealthFieldDefinition = {
  id: 'f-humor',
  name: 'Humor',
  fieldType: 'enum',
  enumOptions: ['Bom', 'Ruim'],
  active: true,
  displayOrder: 1,
}

function setGet(fields: HealthFieldDefinition[]) {
  mockGet.mockImplementation(() => Promise.resolve({ data: fields }))
}

function renderManager() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <HealthMetricsManager />
    </QueryClientProvider>,
  )
}

describe('HealthMetricsManager', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lista os campos existentes ordenados pelo backend', async () => {
    setGet([FIELD_PESO, FIELD_HUMOR])
    renderManager()

    expect(await screen.findByText('Peso')).toBeInTheDocument()
    expect(screen.getByText('Humor')).toBeInTheDocument()
    // O enum mostra suas opções no resumo.
    expect(screen.getByText(/Bom, Ruim/)).toBeInTheDocument()
  })

  it('mostra o empty state quando não há campos', async () => {
    setGet([])
    renderManager()

    expect(await screen.findByText('Nenhum campo de saúde ainda.')).toBeInTheDocument()
  })

  it('mostra o editor de opções só quando o tipo é Enum', async () => {
    setGet([])
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Nenhum campo de saúde ainda.')

    // Tipo default (Inteiro): sem editor de opções.
    expect(screen.queryByLabelText('Novo campo — opção 1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Tipo do campo' }))
    await user.click(await screen.findByRole('option', { name: 'Enum' }))

    expect(await screen.findByLabelText('Novo campo — opção 1')).toBeInTheDocument()
  })

  it('cria um campo com o payload correto (não-enum, sem opções)', async () => {
    setGet([])
    mockPost.mockResolvedValueOnce({ data: FIELD_PESO })
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Nenhum campo de saúde ainda.')

    const form = screen.getByRole('form', { name: 'Novo campo de saúde' })
    await user.type(within(form).getByLabelText('Nome'), 'Peso')
    // Tipo: seleciona Decimal.
    await user.click(within(form).getByRole('combobox', { name: 'Tipo do campo' }))
    await user.click(await screen.findByRole('option', { name: 'Decimal' }))

    await user.click(within(form).getByRole('button', { name: /Criar campo/ }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/health-field-definitions/', {
        name: 'Peso',
        fieldType: 'decimal',
      }),
    )
  })

  it('cria um campo enum enviando as opções', async () => {
    setGet([])
    mockPost.mockResolvedValueOnce({ data: FIELD_HUMOR })
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Nenhum campo de saúde ainda.')

    const form = screen.getByRole('form', { name: 'Novo campo de saúde' })
    await user.type(within(form).getByLabelText('Nome'), 'Humor')
    await user.click(within(form).getByRole('combobox', { name: 'Tipo do campo' }))
    await user.click(await screen.findByRole('option', { name: 'Enum' }))

    await user.type(await screen.findByLabelText('Novo campo — opção 1'), 'Bom')
    await user.click(screen.getByRole('button', { name: 'Adicionar opção' }))
    await user.type(await screen.findByLabelText('Novo campo — opção 2'), 'Ruim')

    await user.click(within(form).getByRole('button', { name: /Criar campo/ }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/health-field-definitions/', {
        name: 'Humor',
        fieldType: 'enum',
        enumOptions: ['Bom', 'Ruim'],
      }),
    )
  })

  it('desativa um campo via PATCH {active:false}', async () => {
    setGet([FIELD_PESO])
    mockPatch.mockResolvedValueOnce({ data: { ...FIELD_PESO, active: false } })
    const user = userEvent.setup()
    renderManager()
    await screen.findByText('Peso')

    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/health-field-definitions/f-peso/', {
        active: false,
      }),
    )
  })

  it('marca campos inativos com rótulo textual "(inativo)"', async () => {
    setGet([{ ...FIELD_PESO, active: false }])
    renderManager()

    expect(await screen.findByText(/Peso/)).toBeInTheDocument()
    expect(screen.getByText(/\(inativo\)/)).toBeInTheDocument()
    // E o botão vira "Ativar".
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeInTheDocument()
  })

  it('mostra erro de leitura com retry quando a query falha', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderManager()

    expect(
      await screen.findByText('Não foi possível carregar os campos de saúde.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (jest-axe)', async () => {
    setGet([FIELD_PESO, FIELD_HUMOR])
    const { container } = renderManager()
    await screen.findByText('Peso')

    expect(await axe(container)).toHaveNoViolations()
  })
})
