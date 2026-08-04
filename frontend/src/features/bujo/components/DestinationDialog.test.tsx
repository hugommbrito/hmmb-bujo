import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { createBujoTheme } from '../../../theme'
import { DestinationDialog, type DestinationDialogProps, type DestinationSelection } from './DestinationDialog'
import destinationDialogSource from './DestinationDialog.tsx?raw'

/** Rótulo nomeado padrão dos testes — nunca um "Confirmar" genérico. */
function namedLabel({ scheduledDate }: DestinationSelection): string {
  return scheduledDate ? `Alocar em ${scheduledDate}` : 'Alocar sem dia definido'
}

const MONTH_OFFER: DestinationDialogProps['offer'] = {
  id: 'target-month',
  day: { kind: 'month', monthFirst: '2026-08-01' },
  undated: {},
}

const WEEK_OFFER: DestinationDialogProps['offer'] = {
  id: 'target-week',
  day: { kind: 'week', weekStart: '2026-07-27' },
  undated: {},
}

function renderDialog(props: Partial<DestinationDialogProps> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={createBujoTheme('light')}>{children}</ThemeProvider>
  )
  const utils = render(
    <DestinationDialog
      title="Escolher destino"
      offer={MONTH_OFFER}
      confirmLabelFor={namedLabel}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
    { wrapper },
  )
  return { ...utils, onConfirm, onClose }
}

/**
 * Enter como o BROWSER faz de verdade: o `keydown` e, SÓ se ninguém cancelou o
 * default, a ativação nativa (clique) do botão focado.
 *
 * jsdom não implementa essa ação default, então modelá-la aqui é o que torna o
 * bug da ESCRITA DUPLICADA reproduzível em teste: com `useKeyboardShortcuts`
 * (handler de `window`, que não filtra BUTTON) o keydown não era cancelado, logo
 * `confirm()` rodava pelo hook E pelo clique nativo — dois `POST /migrate/`.
 * `fireEvent` devolve `false` quando algum handler chamou `preventDefault()`.
 */
function pressEnter(element: HTMLElement) {
  const notPrevented = fireEvent.keyDown(element, { key: 'Enter' })
  if (notPrevented && element.tagName === 'BUTTON') fireEvent.click(element)
}

// ─────────────────────────────────────────────────────────────────────────────
// O ASSERT DE REGRESSÃO desta correção. O defeito era exatamente este: os dois
// pickers antigos faziam `if (!compact) return content`, então na faixa desktop
// o conteúdo — com `role="dialog"` mas SEM overlay nem posição fixa — ficava
// como filho direto do container de chamada, DEPOIS da grade de 3 colunas do
// ritual, e abria abaixo da dobra. Um teste que só verificasse `getByRole(
// 'dialog')` continuaria verde com o bug de volta: a prova tem de ser
// ESTRUTURAL (portal + raiz de modal do MUI), não de presença.
// ─────────────────────────────────────────────────────────────────────────────
describe('DestinationDialog — regressão: no não-compact o conteúdo vive num Dialog PORTALIZADO', () => {
  it('o diálogo NÃO é filho do container de chamada — ele é portalizado para fora dele', () => {
    const { container } = renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })

    expect(document.body).toContainElement(dialog)
    expect(container).not.toContainElement(dialog)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('o diálogo vive dentro de uma raiz de modal do MUI (overlay + posição fixa), não no fluxo do DOM', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })

    expect(dialog.closest('.MuiDialog-root')).not.toBeNull()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('não aninha dois role="dialog" (o MUI Dialog já estampa o seu no Paper)', () => {
    renderDialog()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Escolher destino')
  })

  it('faixa compact: Drawer com um único role="dialog" nomeado, também portalizado', () => {
    const { container } = renderDialog({ compact: true })
    const dialog = screen.getByRole('dialog', { name: 'Escolher destino' })

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(dialog.closest('.MuiDrawer-root')).not.toBeNull()
    expect(container).not.toContainElement(dialog)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regra 3 das Design Notes. Achado de review de severidade máxima: o Enter
// rodava `confirm()` DUAS vezes (duas migrações reais, provado em browser).
// ─────────────────────────────────────────────────────────────────────────────
describe('DestinationDialog — Enter confirma EXATAMENTE uma vez (escrita duplicada)', () => {
  it('com o botão de confirmação focado, o Enter confirma UMA vez (nunca duas)', () => {
    const { onConfirm } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '18 de agosto, sem tarefas' }))
    const confirmButton = screen.getByRole('button', { name: 'Alocar em 2026-08-18' })

    pressEnter(confirmButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('2026-08-18', {
      offerId: 'target-month',
      monthFirst: '2026-08-01',
    })
  })

  it('com uma opção de dia focada, o Enter confirma UMA vez o dia ARMADO', () => {
    const { onConfirm } = renderDialog({ offer: WEEK_OFFER })
    const wednesday = screen.getByRole('radio', { name: '3 Quarta, 29 jul.' })
    fireEvent.click(wednesday)

    pressEnter(wednesday)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('2026-07-29', {
      offerId: 'target-week',
      monthFirst: '2026-07-01',
    })
  })

  it('o Enter confirma o dia que ACABOU de ser armado, não um anterior', () => {
    const { onConfirm } = renderDialog({ offer: WEEK_OFFER })
    const group = screen.getByRole('radiogroup', { name: /^Dias de/ })

    fireEvent.keyDown(group, { key: '2' }) // terça
    fireEvent.keyDown(group, { key: '5' }) // sexta — o destino REAL
    pressEnter(screen.getByRole('radio', { name: '5 Sexta, 31 jul.' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('2026-07-31', expect.anything())
  })

  it('o Enter dentro da entrada do número do dia confirma (o que o guard de INPUT do hook global impediria)', () => {
    const { onConfirm } = renderDialog()
    const dayInput = screen.getByLabelText('Número do dia')
    fireEvent.change(dayInput, { target: { value: '9' } })

    fireEvent.keyDown(dayInput, { key: 'Enter' })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('2026-08-09', expect.anything())
  })

  it('sem nada armado o Enter não confirma', () => {
    const { onConfirm } = renderDialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Escape fecha UMA vez, sem confirmar', () => {
    const { onClose, onConfirm } = renderDialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('o Enter no botão "Fechar" FECHA, não confirma — a interceptação não pode roubar o ×', () => {
    const { onClose, onConfirm } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '18 de agosto, sem tarefas' }))

    pressEnter(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('o Enter nas setas de dia ANDA o dia, sem confirmar', () => {
    const { onConfirm } = renderDialog()
    fireEvent.change(screen.getByLabelText('Número do dia'), { target: { value: '9' } })

    pressEnter(screen.getByRole('button', { name: 'Próximo dia' }))

    expect(screen.getByLabelText('Número do dia')).toHaveValue(10)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regra 4 das Design Notes — Story 14.5 AC5, restaurada.
// ─────────────────────────────────────────────────────────────────────────────
describe('DestinationDialog — Story 14.5 AC5: dígitos 1–7/0 no seletor semanal', () => {
  it('1–7 armam segunda–domingo', () => {
    renderDialog({ offer: WEEK_OFFER })
    const group = screen.getByRole('radiogroup', { name: /^Dias de/ })

    // Semana de 2026-07-27 (segunda) a 2026-08-02 (domingo).
    fireEvent.keyDown(group, { key: '1' })
    expect(screen.getByRole('button', { name: 'Alocar em 2026-07-27' })).toBeInTheDocument()

    fireEvent.keyDown(group, { key: '7' })
    expect(screen.getByRole('button', { name: 'Alocar em 2026-08-02' })).toBeInTheDocument()

    fireEvent.keyDown(group, { key: '4' })
    expect(screen.getByRole('radio', { name: '4 Quinta, 30 jul.' })).toHaveAttribute('aria-checked', 'true')
  })

  it('0 arma "Sem dia definido"', () => {
    const { onConfirm } = renderDialog({ offer: WEEK_OFFER })
    fireEvent.keyDown(screen.getByRole('radiogroup', { name: /^Dias de/ }), { key: '0' })

    expect(screen.getByRole('button', { name: '0 Sem dia definido' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Alocar sem dia definido' }))
    expect(onConfirm).toHaveBeenCalledWith(null, { offerId: 'target-week', monthFirst: '2026-07-01' })
  })

  it('0 NÃO arma quando "Sem dia definido" está indisponível (regra de domínio da semana-alvo)', () => {
    const { onConfirm } = renderDialog({
      offer: { ...WEEK_OFFER, undated: { unavailableReason: 'a semana-alvo não é a semana corrente' } },
    })
    fireEvent.keyDown(screen.getByRole('radiogroup', { name: /^Dias de/ }), { key: '0' })

    expect(screen.queryByRole('button', { name: /^Alocar/ })).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('o lembrete VISÍVEL dos atalhos está presente', () => {
    renderDialog({ offer: WEEK_OFFER })
    expect(
      screen.getByText('Atalhos: 1–7 escolhem o dia · 0 deixa sem data · Enter confirma.'),
    ).toBeInTheDocument()
  })

  it('os dígitos não roubam a digitação de um campo editável', () => {
    renderDialog() // oferta de MÊS: tem entrada de número do dia
    const dayInput = screen.getByLabelText('Número do dia')
    fireEvent.keyDown(dayInput, { key: '3' })
    // Nada foi armado por atalho — o "3" pertence ao campo.
    expect(screen.queryByRole('button', { name: /^Alocar em/ })).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regra 5 das Design Notes — Story 14.6 AC5, restaurada.
// ─────────────────────────────────────────────────────────────────────────────
describe('DestinationDialog — Story 14.6 AC5: dia por digitação e setas no seletor mensal', () => {
  it('a entrada direta do número do dia sincroniza com o calendário de densidade', () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Número do dia'), { target: { value: '12' } })

    // O calendário reusado marca o dia escolhido com `aria-pressed` (o
    // `aria-current` do grid antigo não existe mais — `MonthDensityCalendar` é
    // um `<table>` real e a spec proíbe alterá-lo).
    expect(screen.getByRole('button', { name: '12 de agosto, sem tarefas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Alocar em 2026-08-12' })).toBeInTheDocument()
  })

  it('clicar no calendário sincroniza de volta para a entrada do número do dia', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '18 de agosto, sem tarefas' }))
    expect(screen.getByLabelText('Número do dia')).toHaveValue(18)
  })

  it('as setas andam dia a dia a partir do dia armado', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '18 de agosto, sem tarefas' }))

    fireEvent.click(screen.getByRole('button', { name: 'Próximo dia' }))
    expect(screen.getByLabelText('Número do dia')).toHaveValue(19)

    fireEvent.click(screen.getByRole('button', { name: 'Dia anterior' }))
    expect(screen.getByLabelText('Número do dia')).toHaveValue(18)
  })

  it('valida os 31 dias reais de agosto — o 32 é clampado e a seta não passa do último', () => {
    renderDialog()
    const dayInput = screen.getByLabelText('Número do dia')

    fireEvent.change(dayInput, { target: { value: '32' } })
    expect(dayInput).toHaveValue(31)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo dia' }))
    expect(dayInput).toHaveValue(31)
  })

  it('fevereiro de ano BISSEXTO aceita o dia 29 e recusa o 30', () => {
    renderDialog({ offer: { ...MONTH_OFFER, day: { kind: 'month', monthFirst: '2028-02-01' } } })
    const dayInput = screen.getByLabelText('Número do dia')

    fireEvent.change(dayInput, { target: { value: '29' } })
    expect(dayInput).toHaveValue(29)
    expect(screen.getByRole('button', { name: 'Alocar em 2028-02-29' })).toBeInTheDocument()

    fireEvent.change(dayInput, { target: { value: '30' } })
    expect(dayInput).toHaveValue(29)
  })

  it('fevereiro de ano NÃO bissexto recusa o dia 29', () => {
    renderDialog({ offer: { ...MONTH_OFFER, day: { kind: 'month', monthFirst: '2027-02-01' } } })
    const dayInput = screen.getByLabelText('Número do dia')

    fireEvent.change(dayInput, { target: { value: '29' } })
    expect(dayInput).toHaveValue(28)
  })

  it('o lembrete VISÍVEL dos atalhos do mensal está presente', () => {
    renderDialog()
    expect(
      screen.getByText('Setas navegam dia a dia · digite o número do dia · Enter confirma.'),
    ).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regra 6 das Design Notes — Stories 14.5/14.6 AC6, restaurada. O clique num dia
// do rail de densidade chega até aqui como `armedDate`.
// ─────────────────────────────────────────────────────────────────────────────
describe('DestinationDialog — armedDate: o dia vindo do rail de densidade nasce ARMADO', () => {
  it('abre com o dia já armado e o ato já nomeado (a um clique da confirmação)', () => {
    const { onConfirm } = renderDialog({ armedDate: '2026-08-21' })

    expect(screen.getByLabelText('Número do dia')).toHaveValue(21)
    fireEvent.click(screen.getByRole('button', { name: 'Alocar em 2026-08-21' }))
    expect(onConfirm).toHaveBeenCalledWith('2026-08-21', {
      offerId: 'target-month',
      monthFirst: '2026-08-01',
    })
  })

  it('`armedDate: null` abre com "Sem dia definido" armado', () => {
    renderDialog({ armedDate: null })
    expect(screen.getByRole('button', { name: '0 Sem dia definido' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Alocar sem dia definido' })).toBeInTheDocument()
  })

  it('o efeito de troca de período NÃO apaga o `armedDate` na montagem', () => {
    renderDialog({ offer: WEEK_OFFER, armedDate: '2026-07-29' })
    expect(screen.getByRole('radio', { name: '3 Quarta, 29 jul.' })).toHaveAttribute('aria-checked', 'true')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Achado de review: foco inicial e semântica do radiogroup.
// ─────────────────────────────────────────────────────────────────────────────
describe('DestinationDialog — foco inicial e navegação do radiogroup', () => {
  // O foco inicial vai um frame depois da montagem (o `FocusTrap` do MUI foca a
  // raiz do modal no efeito dele, que roda antes) — daí o `waitFor`.
  it('semanal: o foco nasce na PRIMEIRA opção de dia, não no "Fechar" do cabeçalho', async () => {
    renderDialog({ offer: WEEK_OFFER })
    await waitFor(() => expect(screen.getByRole('radio', { name: '1 Segunda, 27 jul.' })).toHaveFocus())
  })

  it('mensal: o foco nasce na entrada do número do dia', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByLabelText('Número do dia')).toHaveFocus())
  })

  it('tabindex ROVING: um único tab stop no grupo de dias', () => {
    renderDialog({ offer: WEEK_OFFER })
    const radios = screen.getAllByRole('radio')
    expect(radios.filter((radio) => radio.getAttribute('tabindex') === '0')).toHaveLength(1)
    expect(radios[0]).toHaveAttribute('tabindex', '0')

    fireEvent.click(radios[4])
    const after = screen.getAllByRole('radio')
    expect(after.filter((radio) => radio.getAttribute('tabindex') === '0')).toHaveLength(1)
    expect(after[4]).toHaveAttribute('tabindex', '0')
  })

  it('as setas navegam e armam dentro do radiogroup, movendo o foco', () => {
    renderDialog({ offer: WEEK_OFFER })
    const group = screen.getByRole('radiogroup', { name: /^Dias de/ })

    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: '2 Terça, 28 jul.' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '2 Terça, 28 jul.' })).toHaveFocus()

    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: '1 Segunda, 27 jul.' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(group, { key: 'End' })
    expect(screen.getByRole('radio', { name: '7 Domingo, 02 ago.' })).toHaveAttribute('aria-checked', 'true')

    // Circula: da última opção a seta seguinte volta para a primeira.
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: '1 Segunda, 27 jul.' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('DestinationDialog — densidade vem do CHAMADOR (uma fonte só por período)', () => {
  it('mensal: as contagens do calendário são as que o chamador passou', () => {
    renderDialog({
      offer: {
        ...MONTH_OFFER,
        day: { kind: 'month', monthFirst: '2026-08-01', densityByDate: new Map([['2026-08-18', 3]]) },
      },
    })
    expect(screen.getByRole('button', { name: '18 de agosto, 3 tarefas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '19 de agosto, sem tarefas' })).toBeInTheDocument()
  })

  it('semanal: a contagem por dia entra no nome acessível', () => {
    renderDialog({
      offer: {
        ...WEEK_OFFER,
        day: { kind: 'week', weekStart: '2026-07-27', densityByDate: new Map([['2026-07-29', 1]]) },
      },
    })
    expect(screen.getByRole('radio', { name: '3 Quarta, 29 jul., 1 registro' })).toBeInTheDocument()
  })
})

describe('DestinationDialog — oferta de SEMANA: regra de domínio de "Sem dia definido"', () => {
  it('oferece os 7 dias e confirma com o ISO exato do dia escolhido', () => {
    const { onConfirm } = renderDialog({ offer: WEEK_OFFER })
    expect(screen.getAllByRole('radio')).toHaveLength(7)

    fireEvent.click(screen.getByRole('radio', { name: '3 Quarta, 29 jul.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alocar em 2026-07-29' }))

    expect(onConfirm).toHaveBeenCalledWith('2026-07-29', {
      offerId: 'target-week',
      monthFirst: '2026-07-01',
    })
  })

  // Lacuna B7 da Story 14.5: `migrate` com `destination: 'week'` sem
  // `scheduledDate` cai na semana CORRENTE no servidor, não na semana-alvo.
  it('semana-alvo ≠ corrente: "Sem dia definido" fica INDISPONÍVEL com o motivo, e não confirma', () => {
    const { onConfirm } = renderDialog({
      offer: { ...WEEK_OFFER, undated: { unavailableReason: 'a semana-alvo não é a semana corrente' } },
    })

    const undated = screen.getByRole('button', {
      name: '0 Sem dia definido — indisponível: a semana-alvo não é a semana corrente',
    })
    expect(undated).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(undated)
    expect(screen.queryByRole('button', { name: /^Alocar/ })).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('sem `undated` a opção simplesmente não existe', () => {
    renderDialog({ offer: { id: 'w', day: { kind: 'week', weekStart: '2026-07-27' } } })
    expect(screen.queryByRole('button', { name: /Sem dia definido/ })).not.toBeInTheDocument()
  })
})

describe('DestinationDialog — oferta de MÊS: confirmação nomeada e troca de período', () => {
  it('nada armado ⇒ nenhum botão de confirmação (nunca um "Confirmar" genérico)', () => {
    renderDialog()
    expect(screen.queryByRole('button', { name: /^Alocar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  it('"Sem dia definido" confirma com null e o mês em foco', () => {
    const { onConfirm } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '0 Sem dia definido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alocar sem dia definido' }))
    expect(onConfirm).toHaveBeenCalledWith(null, { offerId: 'target-month', monthFirst: '2026-08-01' })
  })

  it('trocar o mês em foco DESCARTA o dia armado (um "31" não sobrevive a um mês de 30 dias)', () => {
    const { rerender, onConfirm } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '31 de agosto, sem tarefas' }))
    expect(screen.getByRole('button', { name: 'Alocar em 2026-08-31' })).toBeInTheDocument()

    rerender(
      <DestinationDialog
        title="Escolher destino"
        offer={{ ...MONTH_OFFER, day: { kind: 'month', monthFirst: '2026-09-01' } }}
        confirmLabelFor={namedLabel}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /^Alocar em/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Número do dia')).toHaveValue(null)
  })
})

describe('DestinationDialog — falha preserva o seletor ABERTO, armado e com o motivo visível', () => {
  it('com `error` o diálogo continua aberto, o dia segue armado e o motivo é anunciado', () => {
    const { rerender, onConfirm } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '18 de agosto, sem tarefas' }))

    rerender(
      <DestinationDialog
        title="Escolher destino"
        offer={MONTH_OFFER}
        error="Não foi possível alocar o template. Tente novamente."
        confirmLabelFor={namedLabel}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Escolher destino' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível alocar o template.')
    fireEvent.click(screen.getByRole('button', { name: 'Alocar em 2026-08-18' }))
    expect(onConfirm).toHaveBeenCalledWith('2026-08-18', {
      offerId: 'target-month',
      monthFirst: '2026-08-01',
    })
  })
})

describe('DestinationDialog — `disabled` guarda todos os controles (offline / escrita em curso)', () => {
  it('desabilitado: nada arma e nenhuma confirmação acontece', () => {
    const { onConfirm } = renderDialog({ disabled: true })

    expect(screen.getByRole('button', { name: '0 Sem dia definido' })).toBeDisabled()
    expect(screen.getByLabelText('Número do dia')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '0 Sem dia definido' }))
    expect(screen.queryByRole('button', { name: /^Alocar/ })).not.toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('desabilitado com um dia JÁ armado: o botão de confirmação existe mas está bloqueado', () => {
    const { onConfirm } = renderDialog({ disabled: true, armedDate: '2026-08-18' })
    const confirmButton = screen.getByRole('button', { name: 'Alocar em 2026-08-18' })

    expect(confirmButton).toBeDisabled()
    pressEnter(confirmButton)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('desabilitado: o calendário não é interativo', () => {
    renderDialog({ disabled: true })
    // `MonthDensityCalendar` só é interativo com `onSelectDay` — sem ele os dias
    // ficam em texto, sem botão.
    expect(screen.queryByRole('button', { name: '18 de agosto, sem tarefas' })).not.toBeInTheDocument()
  })

  it('desabilitado: os dígitos do semanal também ficam guardados', () => {
    renderDialog({ offer: WEEK_OFFER, disabled: true })
    fireEvent.keyDown(screen.getByRole('radiogroup', { name: /^Dias de/ }), { key: '3' })
    expect(screen.queryByRole('button', { name: /^Alocar/ })).not.toBeInTheDocument()
  })
})

// `?raw` traz o código-fonte como string. Guarda só o que ESTE arquivo de fato
// introduz — uma lista copiada de outra pasta passaria por construção e daria a
// aparência de disciplina sem morder nada (achado de review).
describe('DestinationDialog — guardas estruturais do próprio arquivo', () => {
  it('não escreve cor hexadecimal literal — cor só por papel semântico', () => {
    expect(destinationDialogSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  // As 7 colunas da grade de dias vêm de `--ds-monthly-board-columns`.
  it('não escreve nº de colunas literal em repeat()', () => {
    expect(destinationDialogSource).not.toMatch(/repeat\(\s*\d+\s*,/)
  })

  it('não escreve espaçamento em px cru — padding/gap/margin só por --ds-space-*', () => {
    expect(destinationDialogSource).not.toMatch(/(padding|gap|margin)[A-Za-z]*:\s*'?\d+(px|rem)/)
  })

  it('não escreve o alvo de toque mínimo como literal — só var(--ds-touch-target-min)', () => {
    expect(destinationDialogSource).not.toMatch(/\b44px\b/)
  })

  // AGNOSTICISMO DE DOMÍNIO (Boundaries → Always): quem decide o `destination` do
  // POST — e de onde a densidade vem — é o chamador. A prova é sobre IMPORTS,
  // porque os nomes proibidos aparecem no comentário de cabeçalho declarando a
  // fronteira.
  it('não importa NADA de `../api` nem tipo de domínio, e não usa o hook global de atalhos', () => {
    expect(destinationDialogSource).not.toMatch(/from '\.\.\/api'/)
    expect(destinationDialogSource).not.toMatch(/from '\.\.\/types'/)
    // Regra 3 das Design Notes: o Enter NÃO pode vir de um handler de `window`.
    expect(destinationDialogSource).not.toMatch(/useKeyboardShortcuts\s*\(/)
  })
})

// Achado de review: as células do calendário REUSADO nascem abaixo do piso de
// toque do projeto, e no compact elas são o alvo de toque principal do seletor.
// `MonthDensityCalendar` é consumido por superfícies que a spec proíbe tocar, então
// o piso é elevado só no contexto deste diálogo — e é isto que prova a cascata.
describe('DestinationDialog — piso de alvo de toque no calendário reusado', () => {
  it('as células do calendário herdam var(--ds-touch-target-min) dentro do diálogo', () => {
    renderDialog()
    const day = screen.getByRole('button', { name: '18 de agosto, sem tarefas' })
    expect(getComputedStyle(day).minHeight).toBe('var(--ds-touch-target-min)')
  })

  it('idem no compact, onde essas células são o alvo de toque principal', () => {
    renderDialog({ compact: true })
    const day = screen.getByRole('button', { name: '18 de agosto, sem tarefas' })
    expect(getComputedStyle(day).minHeight).toBe('var(--ds-touch-target-min)')
  })
})

describe('DestinationDialog — piso de acessibilidade', () => {
  it('sem violações de axe no não-compact (oferta de mês, com dia armado)', async () => {
    renderDialog({ armedDate: '2026-08-18' })
    // O conteúdo é PORTALIZADO — medir `container` não mediria nada.
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('sem violações de axe no compact (Drawer, semana com "Sem dia" indisponível)', async () => {
    renderDialog({
      compact: true,
      offer: { ...WEEK_OFFER, undated: { unavailableReason: 'a semana-alvo não é a semana corrente' } },
    })
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
