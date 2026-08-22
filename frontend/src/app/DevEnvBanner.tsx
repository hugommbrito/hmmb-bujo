import { Box } from '@mui/material'
import { APP_ENV, HAS_ENV_BANNER } from '../shared/env'

/**
 * Faixa fixa no topo que sinaliza o ambiente: AZUL para dev local
 * (VITE_APP_ENV=local) e MARROM para deploy DEV (VITE_APP_ENV=development).
 * Renderiza `null` no estado neutro de produção (vazio/qualquer outro valor).
 * O espaço para não sobrepor o layout (padding no body + offset do Drawer da
 * sidebar) é aberto por `body.dev-env` em index.css — ativado por
 * `applyEnvBranding()` sempre que há faixa.
 */
export function DevEnvBanner() {
  if (!HAS_ENV_BANNER) return null

  const isLocal = APP_ENV === 'local'

  return (
    <Box
      role="note"
      aria-label={isLocal ? 'Ambiente local' : 'Ambiente de desenvolvimento'}
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
        bgcolor: isLocal ? '#1d4ed8' : '#b45309',
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
      {isLocal ? '💻 Ambiente local · vite dev' : '⚠️ Ambiente de desenvolvimento · deploy DEV'}
    </Box>
  )
}
