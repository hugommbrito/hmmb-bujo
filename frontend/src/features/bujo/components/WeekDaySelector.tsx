import { Box, Chip } from '@mui/material'

interface WeekDaySelectorProps {
  days: { date: string }[]
  selectedIndex: number
  onSelect: (index: number) => void
}

/**
 * `date` é uma data ISO ("YYYY-MM-DD") — parsear os componentes manualmente
 * evita que `new Date(string)` interprete a string como UTC-midnight e
 * desloque o dia exibido em fusos negativos (mesmo cuidado de `DayHeader`).
 */
function formatDayChipLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  const parts = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit' }).formatToParts(
    parsed,
  )
  const part = (type: string) => parts.find((p) => p.type === type)?.value.replace('.', '') ?? ''
  return `${part('weekday')} ${part('day')}`.toUpperCase()
}

// Seletor de dia único no mobile (EXPERIENCE.md §6.2): chips/abas horizontais
// "Seg…Dom", sem swipe — `flexWrap` evita scroll horizontal invisível.
export function WeekDaySelector({ days, selectedIndex, onSelect }: WeekDaySelectorProps) {
  return (
    <Box
      role="tablist"
      aria-label="Selecionar dia da semana"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 1, py: 1 }}
    >
      {days.map((day, index) => (
        <Chip
          key={day.date}
          role="tab"
          aria-selected={index === selectedIndex}
          label={formatDayChipLabel(day.date)}
          onClick={() => onSelect(index)}
          color={index === selectedIndex ? 'primary' : 'default'}
          variant={index === selectedIndex ? 'filled' : 'outlined'}
        />
      ))}
    </Box>
  )
}
