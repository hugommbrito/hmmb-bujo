import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { useHealthHistoryQuery } from '../api'
import type { HealthFieldDefinition } from '../types'
import { HealthEvolutionChart } from './HealthEvolutionChart'
import { HealthHistoryTable } from './HealthHistoryTable'
import { HealthPeriodDashboard } from './HealthPeriodDashboard'
import { formatDateBR } from './healthHistoryUtils'

// Superfície de histórico read-only (Story 7.3). Compõe: controle de intervalo +
// dashboard de período + gráfico de evolução + tabela dia a dia (a equivalente
// acessível do gráfico). `useQuery` puro (sem otimismo/prefetch — AD-14). Datas
// manipuladas por split de string / Date local, sem desvio de fuso (idioma de 6.4).

const DEFAULT_SPAN = 29 // últimos 30 dias, inclusive.

function isoLocalToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function defaultRange() {
  const end = isoLocalToday()
  return { start: addDays(end, -DEFAULT_SPAN), end }
}

const NUMERIC_TYPES = ['integer', 'decimal'] as const

function isNumeric(field: HealthFieldDefinition): boolean {
  return (NUMERIC_TYPES as readonly string[]).includes(field.fieldType)
}

export function HealthHistory() {
  const [range, setRange] = useState(defaultRange)
  const history = useHealthHistoryQuery(range)

  function updateRange(next: { start: string; end: string }) {
    if (next.start > next.end) return
    setRange(next)
  }

  function shiftPeriod(direction: -1 | 1) {
    const span = DEFAULT_SPAN + 1
    updateRange({
      start: addDays(range.start, direction * span),
      end: addDays(range.end, direction * span),
    })
  }

  const fields = history.data?.fields ?? []
  const numericFields = fields.filter(isNumeric)

  return (
    <Box>
      <Typography variant="h6" component="h2" sx={{ px: 1 }}>
        Histórico
      </Typography>

      {/* Controle de intervalo (anterior/próximo período + seletores start/end). */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          px: 1,
          py: 1,
        }}
      >
        <Button size="small" onClick={() => shiftPeriod(-1)}>
          Período anterior
        </Button>
        <TextField
          label="Início"
          type="date"
          size="small"
          value={range.start}
          onChange={(event) => updateRange({ ...range, start: event.target.value })}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'aria-label': `Início do intervalo: ${formatDateBR(range.start)}` },
          }}
        />
        <TextField
          label="Fim"
          type="date"
          size="small"
          value={range.end}
          onChange={(event) => updateRange({ ...range, end: event.target.value })}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'aria-label': `Fim do intervalo: ${formatDateBR(range.end)}` },
          }}
        />
        <Button size="small" onClick={() => shiftPeriod(1)}>
          Próximo período
        </Button>
      </Box>

      {history.isPending ? (
        <Typography variant="body2" color="text.secondary" role="status" sx={{ px: 1, py: 2 }}>
          Carregando histórico…
        </Typography>
      ) : history.isError || !history.data ? (
        <Box role="alert" sx={{ px: 1, py: 2 }}>
          <Typography variant="body2" color="error">
            Não foi possível carregar o histórico.
          </Typography>
          <Button size="small" onClick={() => history.refetch()} sx={{ mt: 1 }}>
            Tentar novamente
          </Button>
        </Box>
      ) : fields.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
          Nenhum campo de saúde para exibir.
        </Typography>
      ) : (
        <Box>
          {/* Dashboard de período (AC2). */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" component="h3" sx={{ px: 1, mb: 1 }}>
              Resumo do período
            </Typography>
            <HealthPeriodDashboard summary={history.data.summary} fields={fields} />
          </Box>

          {/* Gráfico de evolução (AC2). */}
          <Box sx={{ mb: 3, px: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              Evolução
            </Typography>
            <HealthEvolutionChart numericFields={numericFields} range={range} />
          </Box>

          {/* Tabela dia a dia = tabela acessível equivalente (AC1/AC4). */}
          <Box sx={{ px: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              Tabela por data
            </Typography>
            <HealthHistoryTable fields={fields} days={history.data.days} />
          </Box>
        </Box>
      )}
    </Box>
  )
}
