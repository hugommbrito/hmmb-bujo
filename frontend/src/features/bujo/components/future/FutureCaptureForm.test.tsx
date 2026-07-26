import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FutureCaptureForm } from './FutureCaptureForm'

function renderForm(overrides: Partial<React.ComponentProps<typeof FutureCaptureForm>> = {}) {
  const onAdd = vi.fn()
  render(
    <FutureCaptureForm
      focusedMonthFirst="2026-08-01"
      anchorMonthFirst="2026-07-01"
      onAdd={onAdd}
      {...overrides}
    />,
  )
  return { onAdd }
}

describe('FutureCaptureForm (AC3)', () => {
  it('o campo Mês NASCE preenchido com o mês em foco (delta vs. o form legado)', () => {
    renderForm()
    expect(screen.getByLabelText('Mês')).toHaveValue('2026-08')
  })

  it('trocar o mês em foco reflete no campo Mês sem remontar o formulário', () => {
    const { rerender } = render(
      <FutureCaptureForm focusedMonthFirst="2026-08-01" anchorMonthFirst="2026-07-01" onAdd={vi.fn()} />,
    )
    expect(screen.getByLabelText('Mês')).toHaveValue('2026-08')
    rerender(
      <FutureCaptureForm focusedMonthFirst="2026-12-01" anchorMonthFirst="2026-07-01" onAdd={vi.fn()} />,
    )
    expect(screen.getByLabelText('Mês')).toHaveValue('2026-12')
  })

  it('captura com data COMPLETA envia scheduledDate', () => {
    const { onAdd } = renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Renovar passaporte' } })
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAdd).toHaveBeenCalledWith({
      monthFirst: '2026-08-01',
      title: 'Renovar passaporte',
      scheduledDate: '2026-08-14',
    })
  })

  it('captura PARCIAL (só mês) envia scheduledDate undefined', () => {
    const { onAdd } = renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Consulta com a dentista' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAdd).toHaveBeenCalledWith({
      monthFirst: '2026-08-01',
      title: 'Consulta com a dentista',
      scheduledDate: undefined,
    })
  })

  it('capturar num mês DISTANTE vazio continua possível digitando a data', () => {
    const { onAdd } = renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Viagem' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2029-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAdd).toHaveBeenCalledWith({
      monthFirst: '2029-05-01',
      title: 'Viagem',
      scheduledDate: undefined,
    })
  })

  it('REJEITA no cliente, antes do POST, um mês ≤ âncora — com o motivo e a saída', () => {
    const { onAdd } = renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Item do passado' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-07' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este mês não pertence ao Futuro. Use o Mês ou a Semana para datas de agora.',
    )
  })

  it('IRMÃ de não-vacuidade: o mês seguinte ao âncora É aceito', () => {
    const { onAdd } = renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Item do futuro' } })
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-08' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAdd).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejeita dia inexistente no mês (30 de fevereiro)', () => {
    const { onAdd } = renderForm({ focusedMonthFirst: '2027-02-01' })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Impossível' } })
    fireEvent.change(screen.getByLabelText('Dia (opcional)'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Este mês tem 28 dias.')
  })

  it('título vazio não submete', () => {
    const { onAdd } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('offline: campos e botão desabilitados COM MOTIVO visível, sem fila local', () => {
    renderForm({
      disabled: true,
      disabledReason:
        'Você está offline. Consulta disponível; capturar, datar e mover ficam indisponíveis até reconectar.',
    })
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(screen.getByText(/Você está offline/)).toBeInTheDocument()
  })
})

describe('FutureCaptureForm — nome acessível sem colisão (regressão E2E)', () => {
  it('o formulário NÃO contém a palavra "Futuro" no nome acessível', () => {
    renderForm()
    // `getByLabel('Futuro')` (substring, case-insensitive) é como `navigate()` e
    // vários specs E2E localizam `<main aria-label="Futuro">`. Um segundo
    // elemento com "Futuro" no nome quebra o modo estrito do Playwright — foi
    // achado real na primeira execução do E2E desta story.
    const form = screen.getByRole('form', { name: 'Adicionar item ao Future Log' })
    expect(form).toBeInTheDocument()
    expect(form.getAttribute('aria-label')?.toLowerCase()).not.toContain('futuro')
  })
})
