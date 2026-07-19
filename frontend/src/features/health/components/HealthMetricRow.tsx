import { Box, FormControlLabel, MenuItem, Select, Switch, TextField, Typography } from '@mui/material'
import type { HealthFieldDefinition } from '../types'

// Health Metric Row (UX-DR10): o controle de **valor** por `field_type`. É net-new
// (o Manager de 7.1 edita a *definição*; aqui editamos o *valor* do dia).
//
// Contrato de forma do draft (garantido pela seção que compõe as rows): campos
// `boolean` recebem/emitem `boolean`; todos os outros (integer/decimal/enum/text)
// recebem/emitem `string` — a conversão para número/null acontece só no save da
// seção. Manter a row como input controlado (sem draft local + commit-no-blur)
// casa com o "salvar por dia" (Decisão 6): não há autosave por campo, então a
// seção detém o estado e a row é puramente controlada — simples e testável
// (fireEvent.change no jsdom para `<input type="number">`).

interface HealthMetricRowProps {
  field: HealthFieldDefinition
  value: string | boolean
  onChange: (next: string | boolean) => void
}

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  px: 1,
  minHeight: 44,
} as const

export function HealthMetricRow({ field, value, onChange }: HealthMetricRowProps) {
  const label = field.name

  if (field.fieldType === 'boolean') {
    return (
      <Box sx={{ px: 1 }}>
        <FormControlLabel
          sx={{ minHeight: 44, width: '100%', m: 0, justifyContent: 'space-between', ml: 0 }}
          labelPlacement="start"
          control={
            <Switch
              checked={value === true}
              onChange={(event) => onChange(event.target.checked)}
              inputProps={{ 'aria-label': label }}
            />
          }
          label={<Typography variant="body2">{label}</Typography>}
        />
      </Box>
    )
  }

  if (field.fieldType === 'enum') {
    return (
      <Box sx={ROW_SX}>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
          {label}
        </Typography>
        <Select
          size="small"
          displayEmpty
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          inputProps={{ 'aria-label': label }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">
            <em>Sem valor</em>
          </MenuItem>
          {field.enumOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </Box>
    )
  }

  if (field.fieldType === 'text') {
    return (
      <Box sx={ROW_SX}>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
          {label}
        </Typography>
        <TextField
          size="small"
          multiline
          maxRows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          inputProps={{ 'aria-label': label }}
          sx={{ minWidth: 160 }}
        />
      </Box>
    )
  }

  // integer | decimal → campo numérico com teclado numérico no mobile (inputMode).
  const inputMode = field.fieldType === 'decimal' ? 'decimal' : 'numeric'
  return (
    <Box sx={ROW_SX}>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
        {label}
      </Typography>
      <TextField
        type="number"
        size="small"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        inputProps={{ inputMode, 'aria-label': label }}
        sx={{ width: 120 }}
      />
    </Box>
  )
}
