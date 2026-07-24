import { Badge } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { useBrainDumpCountQuery } from '../api'

interface BrainDumpBadgeProps {
  children: React.ReactNode
  /**
   * Cap visual do conteúdo (MUI `Badge max`). O App Shell (Story 13.2) passa
   * `max={9}` → mostra `9+` acima de 9. O `aria-label` mantém a contagem EXATA
   * (é derivado de `count`, não do conteúdo exibido). Omitido no uso legado
   * (`Sidebar`/`BottomNav`) → sem cap visual, sem regressão.
   */
  max?: number
  /**
   * Estilo opcional aplicado ao slot `.MuiBadge-badge`. Usado SÓ pelo App Shell
   * para o token `app-shell-badge` (fundo `primary`, tinta `on-primary`,
   * `min-height 18px`, cantos `full`). O uso legado não passa nada e permanece
   * com `color="primary"`.
   */
  badgeSx?: SxProps<Theme>
}

export function BrainDumpBadge({ children, max, badgeSx }: BrainDumpBadgeProps) {
  const { data } = useBrainDumpCountQuery()
  const count = data?.count ?? 0
  const label = `Brain Dump: ${count} ${count === 1 ? 'item pendente' : 'itens pendentes'}`

  return (
    <Badge
      badgeContent={count}
      max={max}
      invisible={count === 0}
      color="primary"
      aria-label={label}
      slotProps={badgeSx ? { badge: { sx: badgeSx } } : undefined}
    >
      {children}
    </Badge>
  )
}
