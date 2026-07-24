import { Box } from '@mui/material'
import { useMatches } from 'react-router-dom'

import { mediaQueries, typography } from '../../../shared/design/tokens'

/**
 * Topbar do shell novo — composição **"superfície como protagonista"**
 * (decisão B da Story 13.0): mostra o nome da superfície atual e nada mais.
 * Sem marca, sem breadcrumb e sem ações globais não contratadas.
 *
 * A fonte de verdade do título é a MESMA do `RouteAnnouncer` (`handle.title` do
 * match mais profundo). O texto aqui é **estático, nunca live region**: o
 * anúncio de rota continua exclusivo do `RouteAnnouncer`
 * (`EXPERIENCE.md`: "Título visual e RouteAnnouncer nunca repetem a mesma
 * mensagem").
 */
export function ShellTopbar() {
  const matches = useMatches()

  const title = [...matches]
    .reverse()
    .map((match) => (match.handle as { title?: string } | undefined)?.title)
    .find((candidate): candidate is string => Boolean(candidate))

  return (
    <Box
      component="header"
      sx={{
        height: 'var(--ds-topbar-height)',
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        px: 'var(--ds-gutter-compact)',
        background: 'var(--ds-surface)',
        color: 'var(--ds-ink)',
        borderBottom: '1px solid var(--ds-border)',
        [`@media ${mediaQueries.tabletUp}`]: {
          px: 'var(--ds-gutter-medium)',
        },
      }}
    >
      <Box
        component="strong"
        sx={{
          ...typography['section-title'],
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Box>
    </Box>
  )
}
