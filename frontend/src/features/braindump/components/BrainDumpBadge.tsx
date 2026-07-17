import { Badge } from '@mui/material'
import { useBrainDumpCountQuery } from '../api'

interface BrainDumpBadgeProps {
  children: React.ReactNode
}

export function BrainDumpBadge({ children }: BrainDumpBadgeProps) {
  const { data } = useBrainDumpCountQuery()
  const count = data?.count ?? 0
  const label = `Brain Dump: ${count} ${count === 1 ? 'item pendente' : 'itens pendentes'}`

  return (
    <Badge badgeContent={count} invisible={count === 0} color="primary" aria-label={label}>
      {children}
    </Badge>
  )
}
