import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Button } from '@mui/material'
import { Modal } from './Modal'

describe('Modal', () => {
  it('test_dialog_tem_role_e_aria_modal', () => {
    render(
      <Modal open aria-label="Teste" onClose={vi.fn()}>
        <Button>Confirmar</Button>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Teste' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('test_esc_fecha_o_modal', () => {
    const onClose = vi.fn()
    render(
      <Modal open aria-label="Teste" onClose={onClose}>
        <Button>Confirmar</Button>
      </Modal>,
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('test_foco_e_travado_dentro_do_modal', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button>Fora</button>
        <Modal open aria-label="Teste" onClose={vi.fn()}>
          <Button>Primeiro</Button>
          <Button>Segundo</Button>
        </Modal>
      </>,
    )

    const primeiro = screen.getByRole('button', { name: 'Primeiro' })
    const segundo = screen.getByRole('button', { name: 'Segundo' })
    const fora = screen.getByRole('button', { name: 'Fora', hidden: true })

    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()

    expect(document.activeElement).not.toBe(fora)
    expect([primeiro, segundo]).toContain(document.activeElement)
  })

  it('test_sem_violacoes_de_acessibilidade', async () => {
    const { container } = render(
      <Modal open aria-label="Teste" onClose={vi.fn()}>
        <Button>Confirmar</Button>
      </Modal>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
