import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { HealthFieldDefinition, HealthPeriodSummary } from '../types'
import { formatNumber } from './healthHistoryUtils'

// Dashboard de período (AC2, Decisão 7): uma faixa de CARTÕES DE ESTATÍSTICA — um
// por campo numérico —, cada um com 5 fatos (registros, mín, máx, média, mais
// recente). Segue o skill `dataviz` para stat-tiles: número em destaque, rótulo em
// tinta secundária, SEM cor codificando categoria (cor nunca sozinha), flat (sem
// elevação — UX-DR1 "ferramenta, não produto"), zero gamificação. Saúde NÃO tem
// score/"% de saúde": o dashboard resume fatos por campo, nunca um número inventado.

interface StatProps {
  label: string
  value: string
}

// Uma linha rótulo→valor dentro do cartão. O valor usa tinta primária (destaque
// factual); o rótulo, tinta secundária. Sem cor semântica.
function Stat({ label, value }: StatProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.25 }}>
      <Typography variant="body-sm" component="span" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body-sm" component="span" color="text.primary">
        {value}
      </Typography>
    </Box>
  )
}

export interface HealthPeriodDashboardProps {
  summary: HealthPeriodSummary[]
  fields: HealthFieldDefinition[]
}

export function HealthPeriodDashboard({ summary, fields }: HealthPeriodDashboardProps) {
  const theme = useTheme()
  const nameById = new Map(fields.map((f) => [f.id, f.name]))

  if (summary.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
        Nenhum campo numérico para resumo.
      </Typography>
    )
  }

  return (
    <Box
      role="list"
      aria-label="Resumo do período por campo"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 1 }}
    >
      {summary.map((card) => (
        <Box
          key={card.fieldId}
          role="listitem"
          sx={{
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            p: 1.5,
            minWidth: 180,
            flex: '1 1 180px',
          }}
        >
          <Typography variant="label" component="h4" sx={{ mb: 0.5 }}>
            {nameById.get(card.fieldId) ?? '—'}
          </Typography>
          <Stat label="Registros" value={String(card.count)} />
          <Stat label="Mínimo" value={formatNumber(card.min)} />
          <Stat label="Máximo" value={formatNumber(card.max)} />
          <Stat label="Média" value={formatNumber(card.avg)} />
          <Stat label="Mais recente" value={formatNumber(card.latest)} />
        </Box>
      ))}
    </Box>
  )
}
