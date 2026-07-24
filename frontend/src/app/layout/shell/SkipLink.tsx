import { Box } from '@mui/material'
import type { MouseEvent } from 'react'

import { typography } from '../../../shared/design/tokens'

interface SkipLinkProps {
  /** `id` do wrapper de conteúdo do shell (alvo focável do pulo). */
  targetId: string
}

/**
 * `Pular para o conteúdo` — primeiro elemento focável do documento
 * (WCAG 2.2 `2.4.1 Bypass Blocks`). Visualmente oculto até receber foco,
 * exatamente como no mockup aprovado (`transform: translateY(-160%)` →
 * `:focus { transform: none }`).
 *
 * O clique é tratado no JS (em vez de depender só do fragmento na URL) para
 * mover o foco de forma determinística e não sujar o histórico do router com
 * um hash.
 */
export function SkipLink({ targetId }: SkipLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId)
    if (!target) return
    event.preventDefault()
    target.focus()
    // jsdom não implementa scrollIntoView — o pulo de foco não depende dele.
    target.scrollIntoView?.({ block: 'start' })
  }

  return (
    <Box
      component="a"
      href={`#${targetId}`}
      onClick={handleClick}
      sx={{
        position: 'fixed',
        left: 'var(--ds-space-3)',
        top: 'calc(var(--dev-banner-height) + var(--ds-space-2))',
        // Fora da tela até receber foco — sem `display:none`, que o removeria
        // da ordem de tabulação.
        transform: 'translateY(-160%)',
        padding: 'var(--ds-space-3)',
        background: 'var(--ds-surface)',
        color: 'var(--ds-ink)',
        border: 'var(--ds-focus-ring-width) solid var(--ds-control-border)',
        borderRadius: 'var(--ds-radius-sm)',
        textDecoration: 'none',
        ...typography['body-strong'],
        zIndex: (theme) => theme.zIndex.drawer + 3,
        '&:focus': {
          transform: 'none',
          outline: 'var(--ds-focus-ring-width) solid var(--ds-focus)',
          outlineOffset: 'var(--ds-focus-ring-offset)',
        },
      }}
    >
      Pular para o conteúdo
    </Box>
  )
}
