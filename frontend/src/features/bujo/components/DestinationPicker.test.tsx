import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { DestinationPicker } from './DestinationPicker'

// ─────────────────────────────────────────────────────────────────────────────
// O ASSERT DE REGRESSÃO de DW-30. O defeito era exatamente este: o não-compact
// fazia `if (!compact) return content`, então na faixa desktop o conteúdo — com
// `role="dialog"` mas SEM overlay nem posição fixa — ficava como filho direto do
// container de chamada, DEPOIS da grade de 3 colunas do ritual, e abria abaixo
// da dobra ("clico em Escolher destino… e nada acontece"). Um teste que só
// verificasse `getByRole('dialog')` continuaria VERDE com o bug de volta: a
// prova tem de ser ESTRUTURAL (portal + raiz de modal do MUI), não de presença.
// Espelha `DestinationDialog.test.tsx:72-104`.
// ─────────────────────────────────────────────────────────────────────────────
describe('DestinationPicker — regressão: no não-compact o conteúdo vive num Dialog PORTALIZADO', () => {
  const MES = { targetMonthFirst: '2026-08-01' }

  it('o diálogo NÃO é filho do container de chamada — ele é portalizado para fora dele', () => {
    const { container } = render(
      <DestinationPicker month={MES} onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })

    expect(document.body).toContainElement(dialog)
    expect(container).not.toContainElement(dialog)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('o diálogo vive dentro de uma raiz de modal do MUI (overlay + posição fixa), não no fluxo do DOM', () => {
    render(<DestinationPicker month={MES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })

    expect(dialog.closest('.MuiDialog-root')).not.toBeNull()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('não aninha dois role="dialog" (o MUI Dialog já estampa o seu no Paper)', () => {
    render(<DestinationPicker month={MES} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Escolher destino')
  })

  it('faixa compact: Drawer com um único role="dialog" nomeado, também portalizado', () => {
    const { container } = render(
      <DestinationPicker month={MES} compact onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(dialog.closest('.MuiDrawer-root')).not.toBeNull()
    expect(container).not.toContainElement(dialog)
  })

  // Comportamento NOVO trazido pelo overlay: o `Escape` disparado de dentro do
  // diálogo é tratado pelo `Modal` do MUI, que chama `stopPropagation` no evento
  // nativo — logo o `useKeyboardShortcuts` (listener de `window`, fase de bolha)
  // não o vê e `onClose` roda UMA vez, nunca duas. Nada a mudar no componente
  // (o Enter deste seletor segue sendo escopo BLOQUEADO de DW-20), mas a
  // ausência de fechamento duplo precisa ficar pinada.
  it('Escape de dentro do diálogo fecha EXATAMENTE uma vez (o Modal engole o evento antes do listener global)', () => {
    const onClose = vi.fn()
    render(<DestinationPicker month={MES} onConfirm={vi.fn()} onClose={onClose} />)

    fireEvent.keyDown(screen.getByRole('gridcell', { name: '1' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Os DOIS caminhos de fechamento que só passaram a existir com o `Dialog`.
  // Sem eles, apagar `onClose={onClose}` do `<Dialog>` deixaria a suíte VERDE:
  // os demais casos de Escape são servidos pelo `useKeyboardShortcuts`
  // (listener de `window`), nunca pelo handler do `Modal`.
  // ───────────────────────────────────────────────────────────────────────────
  it('Escape no PRIMEIRO contato (foco no container do Dialog, nada clicado ainda) fecha uma única vez', () => {
    const onClose = vi.fn()
    render(<DestinationPicker month={MES} onConfirm={vi.fn()} onClose={onClose} />)

    // Ao abrir, o FocusTrap do MUI põe o foco em `div.MuiDialog-container` — um
    // ANCESTRAL do conteúdo. O Escape que o usuário aperta primeiro é servido
    // pelo `Modal`, que engole o evento antes do listener global de `window`.
    expect(document.activeElement?.closest('.MuiDialog-root')).not.toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clique no backdrop fecha o seletor (caminho que a faixa desktop não tinha antes)', () => {
    // Convergência deliberada com `DestinationDialog`/`FutureMonthPicker`, que
    // também aceitam o fechamento por backdrop — sem guard de
    // `reason !== 'backdropClick'`. Molde de `TaskDetailPanel.test.tsx:166-176`.
    const onClose = vi.fn()
    render(<DestinationPicker month={MES} onConfirm={vi.fn()} onClose={onClose} />)

    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop as Element)

    expect(onClose).toHaveBeenCalled()
  })
})

describe('DestinationPicker — aba "Esta semana" (Story 14.9)', () => {
  it('renderiza os 7 dias da semana-alvo', () => {
    render(
      <DestinationPicker week={{ weekStart: '2026-07-20' }} onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getAllByRole('radio')).toHaveLength(7)
  })

  it('sem aba "Dia no mês"/"Outro mês", nenhum tablist aparece (só uma composição)', () => {
    render(
      <DestinationPicker week={{ weekStart: '2026-07-20' }} onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('clicar num dia arma e confirma com destination "week"', () => {
    const onConfirm = vi.fn()
    render(
      <DestinationPicker week={{ weekStart: '2026-07-20' }} onConfirm={onConfirm} onClose={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /Quarta/ }))
    fireEvent.click(screen.getByRole('button', { name: /Migrar para/ }))
    expect(onConfirm).toHaveBeenCalledWith('2026-07-22', { kind: 'week', monthFirst: '2026-07-01' })
  })

  it('tecla 3 arma o terceiro dia (Quarta) e Enter confirma', () => {
    const onConfirm = vi.fn()
    render(
      <DestinationPicker week={{ weekStart: '2026-07-20' }} onConfirm={onConfirm} onClose={vi.fn()} />,
    )
    fireEvent.keyDown(window, { key: '3' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('2026-07-22', { kind: 'week', monthFirst: '2026-07-01' })
  })

  it('Escape fecha o seletor', () => {
    const onClose = vi.fn()
    render(<DestinationPicker week={{ weekStart: '2026-07-20' }} onConfirm={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('DestinationPicker — aba "Dia no mês" (Story 14.9)', () => {
  const MONTH = { targetMonthFirst: '2026-08-01' }

  it('mostra 31 gridcells para agosto', () => {
    render(<DestinationPicker month={MONTH} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(31)
  })

  it('clicar num dia arma e confirma com destination "month" + o mês em foco', () => {
    const onConfirm = vi.fn()
    render(<DestinationPicker month={MONTH} onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('gridcell', { name: '18' }))
    fireEvent.click(screen.getByRole('button', { name: /Migrar para/ }))
    expect(onConfirm).toHaveBeenCalledWith('2026-08-18', { kind: 'month', monthFirst: '2026-08-01' })
  })

  it('setas navegam dia a dia a partir do dia armado', () => {
    render(<DestinationPicker month={MONTH} onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('gridcell', { name: '18' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo dia' }))
    expect(screen.getByLabelText('Número do dia')).toHaveValue(19)
  })

  it('sem selectableMonths, não há aba "Outro mês"', () => {
    render(<DestinationPicker month={MONTH} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('tab', { name: 'Outro mês' })).not.toBeInTheDocument()
  })

  it('com selectableMonths, "Outro mês" lista os meses e retarga a grade', () => {
    const onTargetMonthChange = vi.fn()
    render(
      <DestinationPicker
        month={{ ...MONTH, selectableMonths: ['2026-08-01', '2026-09-01'], onTargetMonthChange }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Outro mês' }))
    expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.click(screen.getByRole('option', { name: 'Setembro de 2026' }))
    expect(onTargetMonthChange).toHaveBeenCalledWith('2026-09-01')
  })
})

describe('DestinationPicker — 3 abas juntas (composição da Migração)', () => {
  const PROPS = {
    week: { weekStart: '2026-07-20' },
    month: { targetMonthFirst: '2026-07-01', selectableMonths: ['2026-08-01', '2026-09-01'], onTargetMonthChange: vi.fn() },
    todayIso: '2026-07-21',
  }

  it('renderiza as 3 abas na ordem Esta semana/Dia no mês/Outro mês', () => {
    render(<DestinationPicker {...PROPS} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Esta semana',
      'Dia no mês',
      'Outro mês',
    ])
  })

  it('atalho "Hoje" arma e confirma com destination "today"', () => {
    const onConfirm = vi.fn()
    render(<DestinationPicker {...PROPS} onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para hoje' }))
    expect(onConfirm).toHaveBeenCalledWith('2026-07-21', { kind: 'today', monthFirst: '2026-07-01' })
  })

  it('"Sem dia definido" na aba Esta semana confirma destination "week" com scheduledDate null', () => {
    const onConfirm = vi.fn()
    render(<DestinationPicker {...PROPS} onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sem dia definido' }))
    // Armado, agora existem 2 botões com o MESMO texto (sem confirmLabelFor):
    // o atalho no rodapé e o botão de confirmação nomeado — o último é o
    // botão de confirmação (aparece depois no DOM).
    const buttons = screen.getAllByRole('button', { name: 'Sem dia definido' })
    fireEvent.click(buttons[buttons.length - 1])
    expect(onConfirm).toHaveBeenCalledWith(null, { kind: 'week', monthFirst: '2026-07-01' })
  })

  it('confirmLabelFor nomeia o botão de confirmação com a seleção completa', () => {
    const onConfirm = vi.fn()
    render(
      <DestinationPicker
        {...PROPS}
        confirmLabelFor={(selection) =>
          selection.scheduledDate ? `Migrar para ${selection.scheduledDate}` : 'Manter sem dia'
        }
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Dia no mês' }))
    fireEvent.click(screen.getByRole('gridcell', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrar para 2026-07-05' }))
    expect(onConfirm).toHaveBeenCalledWith('2026-07-05', { kind: 'month', monthFirst: '2026-07-01' })
  })

  it('erro preservado é exibido, sem fechar o seletor', () => {
    render(<DestinationPicker {...PROPS} error="Não foi possível migrar." onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível migrar.')
  })

  // `axe(document.body)` e não `axe(container)`: o conteúdo é PORTALIZADO, então
  // o container do RTL fica vazio (e `aria-hidden` pelo Modal) e medi-lo não
  // mediria nada. Precedente verde em `DestinationDialog.test.tsx:611-620`.
  it('jest-axe: sem violações com as 3 abas presentes', async () => {
    render(<DestinationPicker {...PROPS} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('jest-axe: sem violações na faixa compact (Drawer)', async () => {
    render(<DestinationPicker {...PROPS} compact onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
