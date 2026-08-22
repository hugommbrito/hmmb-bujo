import { createRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import type { ReactNode } from 'react'

import { createBujoTheme } from '../../../theme'
import { BrainDumpInboxCaptureForm } from './BrainDumpInboxCaptureForm'

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

const mockPost = client.post as ReturnType<typeof vi.fn>

function renderForm(props: { disabled?: boolean; disabledReason?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const ref = createRef<HTMLInputElement>()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>{children}</ThemeProvider>
    </QueryClientProvider>
  )
  const utils = render(<BrainDumpInboxCaptureForm ref={ref} {...props} />, { wrapper })
  return { ...utils, ref, qc }
}

describe('BrainDumpInboxCaptureForm (Story 15.1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('submeter só com título chama a mutation de criação', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: '1', title: 'Ideia solta', description: null, targetLog: null, createdAt: '2026-07-29T10:00:00Z' },
    })
    renderForm()

    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Ideia solta' } })
    fireEvent.click(screen.getByRole('button', { name: /Capturar/ }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/brain-dump/items/', {
        title: 'Ideia solta',
        description: undefined,
        targetLog: undefined,
      }),
    )
  })

  it('título vazio não submete', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Capturar/ }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('limpa os campos após sucesso', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: '1', title: 'Ideia solta', description: null, targetLog: null, createdAt: '2026-07-29T10:00:00Z' },
    })
    renderForm()

    const title = screen.getByRole('textbox', { name: 'Título' })
    fireEvent.change(title, { target: { value: 'Ideia solta' } })
    fireEvent.click(screen.getByRole('button', { name: /Capturar/ }))

    await waitFor(() => expect(title).toHaveValue(''))
  })

  it('offline desabilita a captura com motivo no nome acessível', () => {
    renderForm({ disabled: true, disabledReason: 'Sem conexão. Esta ação exige rede.' })

    expect(screen.getByRole('button', { name: /Capturar/ })).toBeDisabled()
    expect(screen.getByText('Sem conexão. Esta ação exige rede.')).toBeInTheDocument()
  })

  it('a ref encaminhada foca o campo de título', () => {
    const { ref } = renderForm()
    ref.current?.focus()
    expect(ref.current).toBe(document.activeElement)
  })

  it('após capturar com sucesso, o foco volta ao Título (achado de review #10 — mesma convenção do Capture Sheet)', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: '1', title: 'Ideia solta', description: null, targetLog: null, createdAt: '2026-07-29T10:00:00Z' },
    })
    renderForm()

    const title = screen.getByRole('textbox', { name: 'Título' })
    fireEvent.change(title, { target: { value: 'Ideia solta' } })
    fireEvent.click(screen.getByRole('button', { name: /Capturar/ }))

    await waitFor(() => expect(title).toHaveValue(''))
    expect(title).toHaveFocus()
  })

  it('sem violações de acessibilidade', async () => {
    const { container } = renderForm()
    expect(await axe(container)).toHaveNoViolations()
  })
})
