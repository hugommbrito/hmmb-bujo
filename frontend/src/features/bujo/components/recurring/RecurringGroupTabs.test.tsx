import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { RecurringGroupTabs } from './RecurringGroupTabs'
import { tabIdOf, tabPanelIdOf } from './recurringLibrary'

function renderTabs(overrides: Partial<Parameters<typeof RecurringGroupTabs>[0]> = {}) {
  const props = {
    activeGroup: 'weekly' as const,
    counts: { weekly: 4, monthly: 2, annual: 3 },
    showInactive: false,
    onSelectGroup: vi.fn(),
    onToggleShowInactive: vi.fn(),
    ...overrides,
  }
  // O painel da aba ATIVA acompanha as abas — é assim que a página monta, e
  // medir o `tablist` sem o `tabpanel` que ele referencia seria medir metade do
  // widget (o axe reprovaria por `aria-controls` órfão, corretamente).
  return {
    ...render(
      <>
        <RecurringGroupTabs {...props} />
        <div role="tabpanel" id={tabPanelIdOf(props.activeGroup)} aria-labelledby={tabIdOf(props.activeGroup)} />
      </>,
    ),
    props,
  }
}

describe('RecurringGroupTabs — tablist nomeado (Story 14.8, AC1/AC6)', () => {
  it('é role="tablist" com nome acessível "Grupo de recorrência"', () => {
    renderTabs()
    expect(screen.getByRole('tablist', { name: 'Grupo de recorrência' })).toBeInTheDocument()
  })

  it('renderiza uma aba por recurrence_group, na ordem canônica', () => {
    renderTabs()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Semanal (4)',
      'Mensal (2)',
      'Anual (3)',
    ])
  })

  it('a contagem é ANUNCIADA EM TEXTO no nome acessível da aba (AC6)', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: 'Semanal (4)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mensal (2)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Anual (3)' })).toBeInTheDocument()
  })

  it('só a aba ativa tem aria-selected=true e fica na ordem de Tab', () => {
    renderTabs({ activeGroup: 'monthly' })
    expect(screen.getByRole('tab', { name: /Mensal/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Semanal/ })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /Mensal/ })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /Semanal/ })).toHaveAttribute('tabindex', '-1')
  })

  it('a aba ATIVA aponta para o painel correspondente (aria-controls / id)', () => {
    renderTabs()
    const tab = screen.getByRole('tab', { name: /Semanal/ })
    expect(tab).toHaveAttribute('id', tabIdOf('weekly'))
    expect(tab).toHaveAttribute('aria-controls', tabPanelIdOf('weekly'))
  })

  // Só o painel ATIVO é montado. `aria-controls` apontando para um id que não
  // existe no DOM é violação real de `aria-valid-attr-value` (mesma classe do
  // CRITICAL da 14.6) — este teste é o gate vermelho contra a regressão.
  it('as abas INATIVAS não declaram aria-controls (o painel delas não existe no DOM)', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: /Mensal/ })).not.toHaveAttribute('aria-controls')
    expect(screen.getByRole('tab', { name: /Anual/ })).not.toHaveAttribute('aria-controls')
  })

  it('clicar numa aba emite onSelectGroup com o grupo certo', () => {
    const { props } = renderTabs()
    fireEvent.click(screen.getByRole('tab', { name: /Anual/ }))
    expect(props.onSelectGroup).toHaveBeenCalledWith('annual')
  })
})

describe('RecurringGroupTabs — navegação por seta (AC6)', () => {
  it('ArrowRight avança para a aba seguinte', () => {
    const { props } = renderTabs()
    fireEvent.keyDown(screen.getByRole('tab', { name: /Semanal/ }), { key: 'ArrowRight' })
    expect(props.onSelectGroup).toHaveBeenCalledWith('monthly')
  })

  it('ArrowLeft recua', () => {
    const { props } = renderTabs({ activeGroup: 'monthly' })
    fireEvent.keyDown(screen.getByRole('tab', { name: /Mensal/ }), { key: 'ArrowLeft' })
    expect(props.onSelectGroup).toHaveBeenCalledWith('weekly')
  })

  it('dá a volta: ArrowLeft na primeira aba vai para a última', () => {
    const { props } = renderTabs()
    fireEvent.keyDown(screen.getByRole('tab', { name: /Semanal/ }), { key: 'ArrowLeft' })
    expect(props.onSelectGroup).toHaveBeenCalledWith('annual')
  })

  it('dá a volta: ArrowRight na última aba volta para a primeira', () => {
    const { props } = renderTabs({ activeGroup: 'annual' })
    fireEvent.keyDown(screen.getByRole('tab', { name: /Anual/ }), { key: 'ArrowRight' })
    expect(props.onSelectGroup).toHaveBeenCalledWith('weekly')
  })

  it('tecla não-direcional não troca de aba', () => {
    const { props } = renderTabs()
    fireEvent.keyDown(screen.getByRole('tab', { name: /Semanal/ }), { key: 'Enter' })
    expect(props.onSelectGroup).not.toHaveBeenCalled()
  })
})

// Questão aberta #1 — decisão DELIBERADA e registrada: o filtro fica
// `role="checkbox"` (MUI `Switch` = `input type="checkbox"` real), preservando
// 3 asserts vivos em `recurring-templates.spec.ts` e `recurring-soft-delete.spec.ts`.
describe('RecurringGroupTabs — filtro "Mostrar inativos" (AC6, Questão aberta #1)', () => {
  it('tem papel checkbox e nome acessível estável', () => {
    renderTabs()
    expect(screen.getByRole('checkbox', { name: 'Mostrar inativos' })).toBeInTheDocument()
  })

  it('NÃO usa role="switch" — a escolha é o papel nativo do controle', () => {
    renderTabs()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('reflete o estado atual e emite a troca', () => {
    const { props, unmount } = renderTabs({ showInactive: false })
    const filtro = screen.getByRole('checkbox', { name: 'Mostrar inativos' })
    expect(filtro).not.toBeChecked()
    fireEvent.click(filtro)
    expect(props.onToggleShowInactive).toHaveBeenCalledWith(true)
    unmount()

    const segundo = renderTabs({ showInactive: true })
    expect(screen.getByRole('checkbox', { name: 'Mostrar inativos' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar inativos' }))
    expect(segundo.props.onToggleShowInactive).toHaveBeenCalledWith(false)
  })

  // "Visível/limpável junto ao dado" (EXPERIENCE.md, "Empty por filtro"): o
  // rótulo é o que o olho vê — o `input` do MUI `Switch` é opacidade 0 por
  // construção, com a trilha desenhada por cima. Assertar `toBeVisible()` no
  // input mediria o detalhe de implementação do MUI, não o contrato.
  it('permanece VISÍVEL e operável junto ao dado nas duas posições do filtro', () => {
    const { unmount } = renderTabs({ showInactive: false })
    expect(screen.getByText('Mostrar inativos')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: 'Mostrar inativos' })).toBeEnabled()
    unmount()
    renderTabs({ showInactive: true })
    expect(screen.getByText('Mostrar inativos')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: 'Mostrar inativos' })).toBeEnabled()
  })
})

describe('RecurringGroupTabs — contagem reflete o filtro (AC1)', () => {
  it('os três números vêm das props (fonte única) e mudam juntos com o filtro', () => {
    const { unmount } = renderTabs({
      showInactive: false,
      counts: { weekly: 1, monthly: 0, annual: 1 },
    })
    expect(screen.getByRole('tab', { name: 'Semanal (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mensal (0)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Anual (1)' })).toBeInTheDocument()
    unmount()

    renderTabs({ showInactive: true, counts: { weekly: 2, monthly: 1, annual: 2 } })
    expect(screen.getByRole('tab', { name: 'Semanal (2)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mensal (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Anual (2)' })).toBeInTheDocument()
  })

  it('contagem zero é exibida (a aba vazia não some do tablist)', () => {
    renderTabs({ counts: { weekly: 0, monthly: 0, annual: 0 } })
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: 'Anual (0)' })).toBeInTheDocument()
  })
})

describe('RecurringGroupTabs — jest-axe', () => {
  it('sem violações (faixa completa: tablist + filtro)', async () => {
    const { container } = renderTabs()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações em compact (faixa rolável)', async () => {
    const { container } = renderTabs({ compact: true })
    expect(await axe(container)).toHaveNoViolations()
  })
})
