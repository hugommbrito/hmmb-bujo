import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ThemeProvider } from '@mui/material'
import { createBujoTheme } from '../../../theme'
import { LegacySeamNotice } from './LegacySeamNotice'
import { legacySeam } from '../../../shared/design/tokens'

function renderSeam() {
  return render(
    <ThemeProvider theme={createBujoTheme('light')}>
      <LegacySeamNotice />
    </ThemeProvider>,
  )
}

describe('LegacySeamNotice', () => {
  it('test_mostra_o_texto_aprovado_no_mockup', () => {
    renderSeam()

    expect(screen.getByText('Esta área ainda usa a versão anterior.')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Você pode continuar trabalhando normalmente enquanto esta superfície é atualizada\./,
      ),
    ).toBeInTheDocument()
  })

  it('test_nao_oferece_dispensar_nem_toggle_legado_moderno', () => {
    renderSeam()

    // Persistente por contrato: sem botão de dispensar, sem toggle, sem link.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText(/Legado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Moderno/i)).not.toBeInTheDocument()
  })

  it('test_nao_e_role_alert_e_conteudo_estatico_no_fluxo_de_leitura', () => {
    renderSeam()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByTestId('legacy-seam-notice')).not.toHaveAttribute('aria-live')
  })

  it('test_seam_vive_num_landmark_proprio_fora_do_main_da_pagina', () => {
    renderSeam()

    // O shell não renderiza `<main>`; sem landmark próprio o texto do seam
    // ficaria solto e reprovaria a regra `region` do axe nos testes de chrome.
    expect(screen.getByRole('complementary')).toBe(screen.getByTestId('legacy-seam-notice'))
  })

  it('test_faixa_editorial_usa_os_tokens_do_legacy_seam', () => {
    renderSeam()

    const seam = screen.getByTestId('legacy-seam-notice')
    expect(seam.style.background).toContain(`var(--ds-${legacySeam.background})`)
    expect(seam.style.color).toContain(`var(--ds-${legacySeam.foreground})`)
    // Faixa editorial: borda SÓ à esquerda, nunca uma moldura em volta.
    expect(seam.style.borderLeftWidth).toBe('var(--ds-legacy-seam-border-width)')
    expect(seam.style.borderLeftStyle).toBe('solid')
    expect(seam.style.borderLeftColor).toBe(`var(--ds-${legacySeam.borderLeftColor})`)
    expect(seam.style.borderTopStyle).toBe('')
    expect(seam.style.borderRightStyle).toBe('')
    expect(seam.style.borderBottomStyle).toBe('')
  })

  it('test_sem_violacoes_de_acessibilidade', async () => {
    const { container } = renderSeam()

    expect(await axe(container)).toHaveNoViolations()
  })
})
