import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('../api', () => ({
  useCreateRecurringTemplateMutation: vi.fn(),
  useUpdateRecurringTemplateMutation: vi.fn(),
  useDeleteRecurringTemplateMutation: vi.fn(),
}))

import {
  useCreateRecurringTemplateMutation,
  useDeleteRecurringTemplateMutation,
  useUpdateRecurringTemplateMutation,
} from '../api'
import { TemplateDetailCard } from './TemplateDetailCard'
import type { RecurringTaskTemplate } from '../types'

function baseTemplate(overrides: Partial<RecurringTaskTemplate> = {}): RecurringTaskTemplate {
  return {
    id: 'tpl-1',
    title: 'Planejar a semana',
    description: null,
    eisenhower: null,
    category: null,
    recurrenceGroup: 'weekly',
    recurrenceText: 'domingo à noite',
    active: true,
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockMutations({
  createImpl,
  updateImpl,
  deleteImpl,
}: {
  createImpl?: (vars: unknown, opts?: { onSuccess?: () => void; onError?: () => void }) => void
  updateImpl?: (vars: unknown, opts?: { onSuccess?: () => void; onError?: () => void }) => void
  deleteImpl?: (vars: unknown, opts?: { onSuccess?: () => void; onError?: () => void }) => void
} = {}) {
  const createMutate = vi.fn(createImpl ?? ((_vars, opts) => opts?.onSuccess?.()))
  const updateMutate = vi.fn(updateImpl ?? ((_vars, opts) => opts?.onSuccess?.()))
  const deleteMutate = vi.fn(deleteImpl ?? ((_vars, opts) => opts?.onSuccess?.()))
  ;(useCreateRecurringTemplateMutation as unknown as Mock).mockReturnValue({
    mutate: createMutate,
    isPending: false,
  })
  ;(useUpdateRecurringTemplateMutation as unknown as Mock).mockReturnValue({
    mutate: updateMutate,
    isPending: false,
  })
  ;(useDeleteRecurringTemplateMutation as unknown as Mock).mockReturnValue({
    mutate: deleteMutate,
    isPending: false,
  })
  return { createMutate, updateMutate, deleteMutate }
}

beforeEach(() => {
  vi.resetAllMocks()
  mockMutations()
})

// ── AC3: criar e editar são o MESMO card ───────────────────────────────────
// Diferem em EXATAMENTE três pontos: o rótulo do primário (Criar × Salvar), o
// Grupo (editável × readonly) e o rodapé (nota × Ativar/Desativar + Excluir).
describe('TemplateDetailCard — paridade criar × editar (Story 14.8, AC3)', () => {
  it('criação: header "Novo template" com subtítulo "Recorrente · Semanal"', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByRole('heading', { name: 'Novo template' })).toBeInTheDocument()
    expect(screen.getByText('Recorrente · Semanal')).toBeInTheDocument()
  })

  it('edição: header "Editar template" com subtítulo "Recorrente · Semanal · ativo"', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByRole('heading', { name: 'Editar template' })).toBeInTheDocument()
    expect(screen.getByText('Recorrente · Semanal · ativo')).toBeInTheDocument()
  })

  it('edição de template inativo mostra "· inativo" no subtítulo', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate({ active: false })}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByText('Recorrente · Semanal · inativo')).toBeInTheDocument()
  })

  it('os MESMOS 6 campos existem nos dois modos', () => {
    const fields = ['Título', 'Descrição', 'Recorrência']
    const { unmount } = render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    for (const field of fields) expect(screen.getByLabelText(field)).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Grupo de recorrência' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Categoria' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    unmount()

    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    for (const field of fields) expect(screen.getByLabelText(field)).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Grupo de recorrência' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Categoria' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('diferença 1 — rótulo do primário: "Criar" na criação, "Salvar" na edição', () => {
    const { unmount } = render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    unmount()

    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar' })).not.toBeInTheDocument()
  })

  it('diferença 3 — rodapé: criação tem a nota e NÃO tem Ativar/Desativar', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByText('Título e recorrência são obrigatórios.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument()
  })

  it('diferença 3 — rodapé: edição tem Ativar/Desativar e NÃO tem a nota', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
    expect(screen.queryByText('Título e recorrência são obrigatórios.')).not.toBeInTheDocument()
  })

  it('template inativo mostra "Ativar" no rodapé (não "Desativar")', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate({ active: false })}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument()
  })
})

// ── AC3: Grupo — editável na criação (herdando a aba), readonly na edição ───
describe('TemplateDetailCard — Grupo segmentado (AC3; decision-log 2026-07-21, Q1)', () => {
  it('criação herda a aba ativa como grupo selecionado', () => {
    render(
      <TemplateDetailCard initialGroup="monthly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByRole('radio', { name: 'Mensal' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Recorrente · Mensal')).toBeInTheDocument()
  })

  it('criação: o grupo PODE ser trocado antes de criar, e o subtítulo acompanha', () => {
    const { createMutate } = mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Anual' }))
    expect(screen.getByRole('radio', { name: 'Anual' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Recorrente · Anual')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Aniversários' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'todo dezembro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ recurrenceGroup: 'annual' }),
      expect.anything(),
    )
  })

  it('criação: o hint explica a herança', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    expect(screen.getByText('Herdado da aba ativa; pode trocar antes de criar.')).toBeInTheDocument()
  })

  it('criação: navegação por seta percorre os 3 grupos com wrap', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Semanal' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Mensal' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Mensal' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'Semanal' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Semanal' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'Anual' })).toHaveAttribute('aria-checked', 'true')
  })

  it('edição: o radiogroup é aria-readonly e a seleção não muda por clique', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    const group = screen.getByRole('radiogroup', { name: 'Grupo de recorrência' })
    expect(group).toHaveAttribute('aria-readonly', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Anual' }))
    expect(screen.getByRole('radio', { name: 'Semanal' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Anual' })).toHaveAttribute('aria-checked', 'false')
  })

  it('edição: as setas também não mudam a seleção', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Semanal' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Semanal' })).toHaveAttribute('aria-checked', 'true')
  })

  it('edição: o hint explica o readonly', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(
      screen.getByText(
        'Semanal/Mensal/Anual define em qual ritual é oferecido. Readonly após criar.',
      ),
    ).toBeInTheDocument()
  })

  it('edição NUNCA envia recurrenceGroup no PATCH (readonly é contrato de UI)', () => {
    const { updateMutate } = mockMutations()
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    const [patch] = updateMutate.mock.calls[0]
    expect(patch).not.toHaveProperty('recurrenceGroup')
  })
})

describe('TemplateDetailCard — Recorrência é texto livre (AD-08 item 4)', () => {
  it('o hint diz que o texto nunca é interpretado', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    expect(
      screen.getByText('Texto livre — exibido como lembrete, nunca interpretado para inferir datas.'),
    ).toBeInTheDocument()
  })
})

// ── AC3: validação — o legado abortava em SILÊNCIO ─────────────────────────
describe('TemplateDetailCard — validação (AC3, delta contratado do M09)', () => {
  it('título vazio (após toque) mostra o motivo em role="alert" junto ao campo', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.blur(screen.getByLabelText('Título'))
    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((el) => el.textContent === 'Informe um título.')).toBe(true)
  })

  it('recorrência vazia (após toque) mostra o motivo em role="alert"', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.blur(screen.getByLabelText('Recorrência'))
    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((el) => el.textContent === 'Informe uma recorrência.')).toBe(true)
  })

  it('o primário fica indisponível enquanto título OU recorrência estiverem vazios', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    const primary = screen.getByRole('button', { name: 'Criar' })
    expect(primary).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Só o título' } })
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'toda segunda' } })
    expect(screen.getByRole('button', { name: 'Criar' })).toBeEnabled()
  })

  it('o primário indisponível é DESCRITO pelo motivo (não é um botão morto e mudo)', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    const primary = screen.getByRole('button', { name: 'Criar' })
    const describedBy = primary.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const reason = document.getElementById(describedBy!.split(' ')[0])
    expect(reason?.textContent).toBe('Título e recorrência são obrigatórios.')
  })

  it('espaços em branco não contam como preenchimento', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled()
  })

  it('a validação PRESERVA o rascunho inteiro (nada é limpo ao esvaziar um campo)', () => {
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Detalhe longo' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'sexta' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Categoria Pink' }))

    // esvazia o título: bloqueia, mas não descarta nada
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled()
    expect(screen.getByLabelText('Descrição')).toHaveValue('Detalhe longo')
    expect(screen.getByLabelText('Recorrência')).toHaveValue('sexta')
    expect(screen.getByRole('radio', { name: 'Categoria Pink' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('caso irmão de não-vacuidade: com os dois campos preenchidos, criar CHAMA a mutação', () => {
    const { createMutate } = mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Revisar orçamento' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'toda segunda' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(createMutate).toHaveBeenCalledTimes(1)
  })
})

describe('TemplateDetailCard — criar (AC3)', () => {
  it('envia todos os campos, com active true (o checkbox "Ativo" do legado some)', () => {
    const { createMutate } = mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '  Revisar orçamento  ' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Conferir gastos' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: '  toda segunda  ' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Categoria Blue' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /urgente/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    expect(createMutate).toHaveBeenCalledWith(
      {
        title: 'Revisar orçamento',
        description: 'Conferir gastos',
        eisenhower: 'u',
        category: 'blue',
        recurrenceGroup: 'weekly',
        recurrenceText: 'toda segunda',
        active: true,
      },
      expect.anything(),
    )
  })

  it('descrição vazia vira null (nunca string vazia)', () => {
    const { createMutate } = mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'R' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
      expect.anything(),
    )
  })

  it('sucesso chama onSaved (e NÃO mostra toast)', () => {
    const onSaved = vi.fn()
    mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={onSaved} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'R' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('TemplateDetailCard — editar (AC3)', () => {
  it('pré-preenche todos os campos com os valores do template', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate({
          title: 'Planejar a semana',
          description: 'Revisar metas',
          category: 'purple',
          eisenhower: 'ui',
          recurrenceText: 'domingo à noite',
        })}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByLabelText('Título')).toHaveValue('Planejar a semana')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Revisar metas')
    expect(screen.getByLabelText('Recorrência')).toHaveValue('domingo à noite')
    expect(screen.getByRole('radio', { name: 'Categoria Purple' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('checkbox', { name: /urgente/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /importante/i })).toBeChecked()
  })

  it('Salvar envia um único PATCH com os 5 campos editáveis', () => {
    const { updateMutate } = mockMutations()
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo título' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(updateMutate).toHaveBeenCalledWith(
      {
        templateId: 'tpl-1',
        title: 'Novo título',
        description: null,
        eisenhower: null,
        category: null,
        recurrenceText: 'domingo à noite',
      },
      expect.anything(),
    )
  })

  it('Desativar envia active:false e chama onSaved no sucesso', () => {
    const onSaved = vi.fn()
    const { updateMutate } = mockMutations()
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    expect(updateMutate).toHaveBeenCalledWith(
      { templateId: 'tpl-1', active: false },
      expect.anything(),
    )
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('Ativar envia active:true (caso irmão de não-vacuidade do Desativar)', () => {
    const { updateMutate } = mockMutations()
    render(
      <TemplateDetailCard
        template={baseTemplate({ active: false })}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ativar' }))
    expect(updateMutate).toHaveBeenCalledWith(
      { templateId: 'tpl-1', active: true },
      expect.anything(),
    )
  })
})

// ── AC3: falha de escrita PRESERVA o rascunho ──────────────────────────────
describe('TemplateDetailCard — falha de escrita (AC3)', () => {
  it('preserva o rascunho inteiro, mostra o motivo UMA vez e oferece nova tentativa', async () => {
    const { createMutate } = mockMutations({
      createImpl: (_vars, opts) => opts?.onError?.(),
    })
    const onSaved = vi.fn()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={onSaved} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho vivo' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Detalhe' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'sexta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))

    await waitFor(() =>
      expect(screen.getByText('Não foi possível salvar o template. Tente novamente.')).toBeInTheDocument(),
    )
    // anunciado UMA única vez
    expect(screen.getAllByText('Não foi possível salvar o template. Tente novamente.')).toHaveLength(1)
    // rascunho inteiro preservado
    expect(screen.getByLabelText('Título')).toHaveValue('Rascunho vivo')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Detalhe')
    expect(screen.getByLabelText('Recorrência')).toHaveValue('sexta')
    // não fechou
    expect(onSaved).not.toHaveBeenCalled()
    // nova tentativa disponível
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(createMutate).toHaveBeenCalledTimes(2)
  })

  it('falha do PATCH de Salvar também preserva o rascunho', async () => {
    mockMutations({ updateImpl: (_vars, opts) => opts?.onError?.() })
    const onSaved = vi.fn()
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(screen.getByText('Não foi possível salvar o template. Tente novamente.')).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Título')).toHaveValue('Editado')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('caso irmão: sucesso NÃO mostra o erro', () => {
    mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Recorrência'), { target: { value: 'R' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }))
    expect(
      screen.queryByText('Não foi possível salvar o template. Tente novamente.'),
    ).not.toBeInTheDocument()
  })
})

// ── AC3: fechar explícito DESCARTA (mesma semântica do TaskDetailCard) ─────
describe('TemplateDetailCard — fechar explícito descarta o rascunho (AC3)', () => {
  it('X chama onClose e NÃO persiste nada', () => {
    const onClose = vi.fn()
    const { createMutate, updateMutate } = mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={onClose} onSaved={vi.fn()} />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Descartado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(createMutate).not.toHaveBeenCalled()
    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('onClose e onSaved são callbacks SEPARADOS — fechar nunca é confundido com sucesso', () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()
    mockMutations()
    render(
      <TemplateDetailCard initialGroup="weekly" onClose={onClose} onSaved={onSaved} />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
  })
})

// ── AC6: offline ───────────────────────────────────────────────────────────
describe('TemplateDetailCard — offline (AC6)', () => {
  it('desabilita o primário e o toggle, com o motivo visível', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        disabled
        disabledReason="Você está offline. Consulta disponível; criar e editar templates ficam indisponíveis até reconectar."
      />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeDisabled()
    expect(
      screen.getByText(
        'Você está offline. Consulta disponível; criar e editar templates ficam indisponíveis até reconectar.',
      ),
    ).toBeInTheDocument()
  })

  it('caso irmão: online, o primário e o toggle ficam habilitados', () => {
    render(
      <TemplateDetailCard
        template={baseTemplate()}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeEnabled()
  })
})

describe('TemplateDetailCard — jest-axe', () => {
  it('sem violações no card de criação', async () => {
    const { container } = render(
      <TemplateDetailCard initialGroup="weekly" onClose={vi.fn()} onSaved={vi.fn()} />,
      { wrapper },
    )
    expect(await axe(document.body)).toHaveNoViolations()
    expect(container).toBeTruthy()
  })

  it('sem violações no card de edição (Grupo readonly incluso)', async () => {
    render(
      <TemplateDetailCard
        template={baseTemplate({ category: 'teal', eisenhower: 'ui', description: 'D' })}
        initialGroup="weekly"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { wrapper },
    )
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
