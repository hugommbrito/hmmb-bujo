import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import type { MigrationDestination } from '../api'
import { MONTH_NAMES_PT } from '../monthNames'
import type { Task } from '../types'

export interface MigrationDecisionExtra {
  monthFirst?: string
  scheduledDate?: string | null
}

export type MigrationFlowType = 'daily' | 'weekly' | 'monthly'

interface MigrationCardProps {
  task: Task
  index: number // 0-based
  total: number
  activePicker: 'none' | 'month' | 'future'
  onOpenPicker: (picker: 'month' | 'future') => void
  onDecide: (destination: MigrationDestination, extra?: MigrationDecisionExtra) => void
  flowType?: MigrationFlowType
}

// Mês corrente calculado no frontend a partir de `new Date()` local — cálculo
// de UI, não autoridade de domínio (a view valida o mês corrente de verdade
// via `today_for`).
function currentMonthBounds() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return { min: `${year}-${pad(month)}-01`, max: `${year}-${pad(month)}-${pad(lastDay)}` }
}

function currentMonthLabel() {
  return MONTH_NAMES_PT[new Date().getMonth()]
}

export function MigrationCard({
  task,
  index,
  total,
  activePicker,
  onOpenPicker,
  onDecide,
  flowType = 'daily',
}: MigrationCardProps) {
  const [futureDay, setFutureDay] = useState('')
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const subtasks = task.subtasks ?? []
  const { min, max } = currentMonthBounds()

  // Task 6.1/6.2 — 'monthly' não tem botão 1 (a origem já É o mês corrente);
  // 'weekly' reaproveita a mesma anatomia de 4 botões do 'daily', só troca
  // rótulo/destino do botão 1 (ver Dev Notes "Anatomia do card por contexto").
  const primaryAction =
    flowType === 'monthly'
      ? null
      : {
          label: flowType === 'weekly' ? 'Migrar para esta semana' : 'Migrar para hoje',
          destination: (flowType === 'weekly' ? 'week' : 'today') as MigrationDestination,
        }
  const monthLabel = flowType === 'monthly' ? `Definir data em ${currentMonthLabel()}` : 'Adiar no mês'
  // Numeração dos atalhos exibidos: 1-4 quando há botão 1, 1-3 quando não há.
  const shortcutOffset = primaryAction ? 1 : 0

  function handleMonthDateChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    if (!value) return
    onDecide('month', { scheduledDate: value })
  }

  function handleFutureMonthChange(event: ChangeEvent<HTMLInputElement>) {
    const month = event.target.value
    if (!month) return
    const scheduledDate = futureDay ? `${month}-${futureDay.padStart(2, '0')}` : undefined
    onDecide('future', { monthFirst: `${month}-01`, scheduledDate })
  }

  // ↑/↓ movem o foco entre os 4 botões quando nenhum picker está aberto
  // (Task 6.3) — sem interação com os pickers, que já capturam as setas nos
  // próprios <input>.
  function handleArrowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (activePicker !== 'none') return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = buttonRefs.current.filter((btn): btn is HTMLButtonElement => btn !== null)
    const currentFocusIndex = buttons.findIndex((btn) => btn === document.activeElement)
    const delta = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (currentFocusIndex + delta + buttons.length) % buttons.length
    buttons[nextIndex]?.focus()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3, minWidth: 320 }}>
      <Typography role="status" aria-live="polite" variant="body-sm" color="text.secondary">
        {index + 1} de {total} revisadas
      </Typography>
      <Typography variant="heading">{task.title}</Typography>
      {task.description && (
        <Typography variant="body2" color="text.secondary">
          {task.description}
        </Typography>
      )}
      {subtasks.length > 0 && (
        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          {subtasks.map((subtask) => (
            <Typography key={subtask.id} component="li" variant="body2">
              {subtask.title}
            </Typography>
          ))}
        </Box>
      )}
      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
        onKeyDown={handleArrowKeyDown}
      >
        {primaryAction && (
          <Button
            ref={(el) => {
              buttonRefs.current[0] = el
            }}
            variant="outlined"
            sx={{ justifyContent: 'space-between' }}
            onClick={() => onDecide(primaryAction.destination)}
          >
            {primaryAction.label}
            <Typography component="span" variant="body-sm" color="text.secondary" aria-hidden="true">
              1
            </Typography>
          </Button>
        )}
        <Button
          ref={(el) => {
            buttonRefs.current[shortcutOffset] = el
          }}
          variant="outlined"
          sx={{ justifyContent: 'space-between' }}
          onClick={() => onOpenPicker('month')}
        >
          {monthLabel}
          <Typography component="span" variant="body-sm" color="text.secondary" aria-hidden="true">
            {shortcutOffset + 1}
          </Typography>
        </Button>
        {activePicker === 'month' && (
          <TextField
            label="Data no mês corrente"
            type="date"
            size="small"
            slotProps={{ htmlInput: { min, max }, inputLabel: { shrink: true } }}
            onChange={handleMonthDateChange}
          />
        )}
        <Button
          ref={(el) => {
            buttonRefs.current[shortcutOffset + 1] = el
          }}
          variant="outlined"
          sx={{ justifyContent: 'space-between' }}
          onClick={() => onOpenPicker('future')}
        >
          Adiar no Futuro
          <Typography component="span" variant="body-sm" color="text.secondary" aria-hidden="true">
            {shortcutOffset + 2}
          </Typography>
        </Button>
        {activePicker === 'future' && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Dia (opcional)"
              type="number"
              size="small"
              value={futureDay}
              onChange={(event) => setFutureDay(event.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 31 } }}
              sx={{ width: 140 }}
            />
            <TextField
              label="Mês"
              type="month"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={handleFutureMonthChange}
            />
          </Box>
        )}
        <Button
          ref={(el) => {
            buttonRefs.current[shortcutOffset + 2] = el
          }}
          variant="outlined"
          sx={{ justifyContent: 'space-between' }}
          onClick={() => onDecide('cancel')}
        >
          Cancelar
          <Typography component="span" variant="body-sm" color="text.secondary" aria-hidden="true">
            {shortcutOffset + 3}
          </Typography>
        </Button>
      </Box>
    </Box>
  )
}
