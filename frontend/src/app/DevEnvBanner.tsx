import { Box } from '@mui/material'
import { IS_PROD_DEPLOY } from '../shared/env'

/**
 * Faixa fixa no topo que sinaliza o ambiente de desenvolvimento.
 * Renderiza `null` em produção. O espaço para não sobrepor o layout
 * (padding no body + offset do Drawer da sidebar) é aberto por `body.dev-env`
 * em index.css — ativado por `applyEnvBranding()`.
 */
export function DevEnvBanner() {
  if (IS_PROD_DEPLOY) return null

  return (
    <Box
      role="note"
      aria-label="Ambiente de desenvolvimento"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--dev-banner-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        px: 2,
        bgcolor: '#b45309',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        // Acima do Drawer permanente (zIndex.drawer = 1200) para cobrir a
        // faixa superior antes do offset assumir.
        zIndex: (theme) => theme.zIndex.drawer + 2,
        // Faixa puramente informativa: não intercepta cliques.
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      ⚠️ Ambiente de desenvolvimento · deploy DEV
    </Box>
  )
}
