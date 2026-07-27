import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { TemplateLibraryList } from './TemplateLibraryList'
import { tabIdOf, tabPanelIdOf } from './recurringLibrary'
import type { RecurringTaskTemplate } from '../../types'

function tpl(overrides: Partial<RecurringTaskTemplate> = {}): RecurringTaskTemplate {
  return {
    id: 'tpl-1',
    title: 'Revisar orçamento',
    description: null,
    eisenhower: null,
    category: null,
    recurrenceGroup: 'weekly',
    recurrenceText: 'toda segunda de manhã',
    active: true,
    ...overrides,
  }
}

function renderList(overrides: Partial<Parameters<typeof TemplateLibraryList>[0]> = {}) {
  const props = {
    group: 'weekly' as const,
    templates: [tpl()],
    onEdit: vi.fn(),
    onToggleActive: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  }
  return { ...render(<TemplateLibraryList {...props} />), props }
}

describe('TemplateLibraryList — tabpanel (Story 14.8, AC1/AC6)', () => {
  it('é role="tabpanel" ligado à aba correspondente', () => {
    renderList()
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('id', tabPanelIdOf('weekly'))
    expect(panel).toHaveAttribute('aria-labelledby', tabIdOf('weekly'))
  })

  it('renderiza uma Item Row por template, cada uma com contorno próprio (listitem)', () => {
    renderList({ templates: [tpl({ id: 'a' }), tpl({ id: 'b', title: 'Treino de força' })] })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByTestId('item-row')).toHaveLength(2)
  })

  it('a subline é "{Grupo} — {recurrenceText}"', () => {
    renderList()
    expect(screen.getByText('Semanal — toda segunda de manhã')).toBeInTheDocument()
  })

  it('a subline NÃO concatena "(inativo)" — o estado virou chip (delta do M09)', () => {
    renderList({ templates: [tpl({ active: false, recurrenceText: 'todo dia útil' })] })
    expect(screen.getByText('Semanal — todo dia útil')).toBeInTheDocument()
    expect(screen.queryByText(/\(inativo\)/)).not.toBeInTheDocument()
    expect(screen.getByText('inativo')).toBeInTheDocument()
  })

  it('propaga descrição, categoria e Eisenhower para a Item Row', () => {
    renderList({
      templates: [tpl({ description: 'Conferir gastos', category: 'blue', eisenhower: 'ui' })],
    })
    expect(screen.getByText('Conferir gastos')).toBeInTheDocument()
    expect(screen.getByTestId('item-row')).toHaveStyle({
      borderLeftColor: 'var(--ds-category-blue)',
    })
    expect(screen.getByText('U+I')).toBeInTheDocument()
  })
})

describe('TemplateLibraryList — ações da linha (AC2)', () => {
  it('cada linha tem Editar e Desativar, com nome acessível que a distingue', () => {
    renderList({ templates: [tpl({ title: 'Revisar orçamento' })] })
    expect(screen.getByRole('button', { name: 'Editar Revisar orçamento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desativar Revisar orçamento' })).toBeInTheDocument()
  })

  it('dois templates dão dois pares de ações inequívocos (não-vacuidade do escopo)', () => {
    renderList({
      templates: [tpl({ id: 'a', title: 'Alfa' }), tpl({ id: 'b', title: 'Beta' })],
    })
    expect(screen.getByRole('button', { name: 'Editar Alfa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Beta' })).toBeInTheDocument()
  })

  it('template inativo troca Desativar por Ativar', () => {
    renderList({ templates: [tpl({ title: 'Regar', active: false })] })
    expect(screen.getByRole('button', { name: 'Ativar Regar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar Regar' })).not.toBeInTheDocument()
  })

  it('Editar emite onEdit com o template da linha', () => {
    const alfa = tpl({ id: 'a', title: 'Alfa' })
    const { props } = renderList({ templates: [alfa, tpl({ id: 'b', title: 'Beta' })] })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Alfa' }))
    expect(props.onEdit).toHaveBeenCalledWith(alfa)
  })

  it('Ativar/Desativar emite onToggleActive com o template da linha', () => {
    const beta = tpl({ id: 'b', title: 'Beta' })
    const { props } = renderList({ templates: [tpl({ id: 'a', title: 'Alfa' }), beta] })
    fireEvent.click(screen.getByRole('button', { name: 'Desativar Beta' }))
    expect(props.onToggleActive).toHaveBeenCalledWith(beta)
  })

  it('EXCLUIR não vive na linha (é só do card de edição — AC4)', () => {
    renderList()
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument()
  })

  it('ALOCAR não vive na biblioteca (a alocação é dos rituais — AC5)', () => {
    renderList()
    expect(screen.queryByRole('button', { name: /Alocar/ })).not.toBeInTheDocument()
  })
})

describe('TemplateLibraryList — vazio POR GRUPO (AC6, mockup frame E)', () => {
  it('mostra a cópia literal do mockup + a ação de criar', () => {
    renderList({ templates: [] })
    expect(screen.getByText('Nenhum template neste grupo.')).toBeInTheDocument()
    expect(screen.getByText('Crie um modelo para alocá-lo depois ao planejar.')).toBeInTheDocument()
    // Texto VISÍVEL é "Novo template" (mockup); o nome ACESSÍVEL leva o grupo
    // para não colidir com a ação primária idêntica do header da página.
    const button = screen.getByRole('button', { name: 'Novo template — Semanal' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Novo template')
  })

  it('a ação do vazio emite onCreate', () => {
    const { props } = renderList({ templates: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Novo template — Semanal' }))
    expect(props.onCreate).toHaveBeenCalledTimes(1)
  })

  it('caso irmão: com templates, o vazio NÃO aparece', () => {
    renderList()
    expect(screen.queryByText('Nenhum template neste grupo.')).not.toBeInTheDocument()
  })
})

describe('TemplateLibraryList — offline (AC6)', () => {
  it('desabilita Editar e Ativar/Desativar', () => {
    renderList({ disabled: true })
    expect(screen.getByRole('button', { name: 'Editar Revisar orçamento' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desativar Revisar orçamento' })).toBeDisabled()
  })

  it('desabilita a ação de criar do estado vazio', () => {
    renderList({ templates: [], disabled: true })
    expect(screen.getByRole('button', { name: 'Novo template — Semanal' })).toBeDisabled()
  })

  it('caso irmão: online, tudo habilitado', () => {
    renderList()
    expect(screen.getByRole('button', { name: 'Editar Revisar orçamento' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Desativar Revisar orçamento' })).toBeEnabled()
  })
})

describe('TemplateLibraryList — jest-axe', () => {
  it('sem violações com lista preenchida (ativo + inativo)', async () => {
    const { container } = renderList({
      templates: [
        tpl({ id: 'a', title: 'Alfa', category: 'teal', eisenhower: 'u', description: 'D' }),
        tpl({ id: 'b', title: 'Beta', active: false }),
      ],
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações no estado vazio', async () => {
    const { container } = renderList({ templates: [] })
    expect(await axe(container)).toHaveNoViolations()
  })
})
