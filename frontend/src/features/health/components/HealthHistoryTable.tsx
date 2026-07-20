import { Box, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { HealthFieldDefinition, HealthHistoryDay } from '../types'
import { formatCellValue, formatDateBR } from './healthHistoryUtils'

// Tabela dia a dia (AC1). É a TABELA EQUIVALENTE acessível que o Accessibility
// Floor exige para o gráfico (mata dois requisitos com um componente):
// - `<table>` semântica: linhas = datas (mais recente primeiro), colunas = campos;
//   headers programáticos (`<th scope="col">` campos, `<th scope="row">` datas).
// - células anunciam campo + data + valor (aria-label); lacuna = "—" honesto
//   (texto, não só cor); cada célula é tipada pela DEFINIÇÃO viva do campo.
// - Mobile (<768px): alternativa de LISTA por data — sem scroll horizontal (UX-DR18).
// Divergência vs. 6.4: Saúde não versiona / não tem tipo de dia → SEM tag de ritmo
// nem sombreamento de fim de semana. A tabela é uma grade simples. Todos os `<th>`
// têm texto VISÍVEL (nome do campo / data), satisfazendo o axe empty-table-header
// sem precisar de srOnly.

interface CellState {
  display: string
  aria: string
}

function cellState(field: HealthFieldDefinition, day: HealthHistoryDay): CellState {
  const display = formatCellValue(field.fieldType, day.values[field.id])
  return { display, aria: display === '—' ? 'sem registro' : display }
}

export interface HealthHistoryTableProps {
  fields: HealthFieldDefinition[]
  days: HealthHistoryDay[]
}

export function HealthHistoryTable({ fields, days }: HealthHistoryTableProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery('(max-width:767px)')

  if (fields.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
        Nenhum campo de saúde para exibir.
      </Typography>
    )
  }

  if (days.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
        Nenhum registro no período.
      </Typography>
    )
  }

  // O serviço devolve os dias em ordem ascendente; a tabela mostra o mais recente
  // no topo (leitura analítica olha o passado recente primeiro).
  const rows = [...days].reverse()

  if (isMobile) {
    // Alternativa de lista por data (sem scroll horizontal).
    return (
      <Box>
        {rows.map((day) => (
          <Box key={day.date} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" component="h4" sx={{ px: 1 }}>
              {formatDateBR(day.date)}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {fields.map((field) => {
                const state = cellState(field, day)
                return (
                  <Typography component="li" variant="body-sm" key={field.id}>
                    {field.name}: {state.aria}
                  </Typography>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}
      >
        <Typography
          component="caption"
          variant="body-sm"
          color="text.secondary"
          sx={{ textAlign: 'left', px: 1, py: 0.5 }}
        >
          Histórico de saúde por dia. Linhas são datas; colunas são campos. Um traço
          (—) indica dia sem registro para o campo.
        </Typography>
        <thead>
          <tr>
            <Box
              component="th"
              scope="col"
              sx={{
                position: 'sticky',
                left: 0,
                bgcolor: 'background.paper',
                textAlign: 'left',
                p: 1,
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="label" component="span">
                Data
              </Typography>
            </Box>
            {fields.map((field) => (
              <Box
                component="th"
                scope="col"
                key={field.id}
                sx={{
                  p: 1,
                  minWidth: 72,
                  textAlign: 'center',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="body-sm" component="span">
                  {field.name}
                </Typography>
              </Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((day) => (
            <tr key={day.date}>
              <Box
                component="th"
                scope="row"
                sx={{
                  position: 'sticky',
                  left: 0,
                  bgcolor: 'background.paper',
                  textAlign: 'left',
                  p: 1,
                  whiteSpace: 'nowrap',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="body-sm" component="span">
                  {formatDateBR(day.date)}
                </Typography>
              </Box>
              {fields.map((field) => {
                const state = cellState(field, day)
                return (
                  <Box
                    component="td"
                    key={field.id}
                    aria-label={`${field.name}, ${formatDateBR(day.date)}: ${state.aria}`}
                    sx={{
                      p: 1,
                      textAlign: 'center',
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Typography variant="body-sm" component="span" aria-hidden>
                      {state.display}
                    </Typography>
                  </Box>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  )
}
