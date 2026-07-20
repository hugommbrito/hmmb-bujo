import { Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import AdjustIcon from '@mui/icons-material/Adjust'
import { useConfirmBlockMutation, useConfirmMedicationEntryMutation } from '../api'
import { deriveBlockStatus, doseSummary, type BlockStatus } from '../dayModel'
import type { MedicationDayBlock, MedicationDayEntry } from '../types'

// Voz neutra pt-BR (UX-DR13, zero gamificação). String de erro EXATA de 8.1.
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'

// Indicador de estado = texto + ícone (nunca só cor — WCAG 2.2 AA / UX-DR20).
const STATUS_LABEL: Record<BlockStatus, string> = {
  confirmed: 'Confirmado',
  partial: 'Parcial',
  pending: 'Pendente',
}

function StatusIndicator({ status }: { status: BlockStatus }) {
  const Icon =
    status === 'confirmed'
      ? CheckCircleOutlineIcon
      : status === 'partial'
        ? AdjustIcon
        : RadioButtonUncheckedIcon
  const color =
    status === 'confirmed' ? 'success' : status === 'partial' ? 'warning' : 'disabled'
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Icon fontSize="small" color={color} aria-hidden />
      <Typography variant="caption" color="text.secondary" component="span">
        {STATUS_LABEL[status]}
      </Typography>
    </Box>
  )
}

interface EntryRowProps {
  entry: MedicationDayEntry
  date?: string
}

function EntryRow({ entry, date }: EntryRowProps) {
  const confirm = useConfirmMedicationEntryMutation(date)
  const checked = entry.confirmedAt != null
  const summary = doseSummary(entry.doseAtTime)
  return (
    <Box sx={{ px: 1 }}>
      <FormControlLabel
        sx={{ minHeight: 44, width: '100%', m: 0 }}
        control={
          <Checkbox
            checked={checked}
            onChange={() =>
              confirm.mutate({ entryId: entry.id, confirmed: !checked })
            }
          />
        }
        label={
          <Typography variant="body2">
            {entry.medicationTitle}
            {summary ? ` · ${summary}` : ''}
          </Typography>
        }
      />
      {confirm.isError && (
        <Typography
          variant="caption"
          color="error"
          role="alert"
          component="div"
          sx={{ pl: 4 }}
        >
          {SAVE_ERROR}
        </Typography>
      )}
    </Box>
  )
}

export interface MedicationBlockProps {
  block: MedicationDayBlock
  // Chave da query (param `?date=`, undefined = hoje) — usada pelos hooks otimistas.
  date?: string
  // Data concreta do dia (ISO) — enviada no payload da confirmação em lote.
  dayDate: string
}

export function MedicationBlock({ block, date, dayDate }: MedicationBlockProps) {
  const confirmBlock = useConfirmBlockMutation(date)
  // Fonte única (AC6): deriva do estado das linhas (que já refletem o otimismo no
  // cache), para o cabeçalho reagir instantaneamente antes do refetch.
  const status = deriveBlockStatus(block.entries)
  const allConfirmed = status === 'confirmed'

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1,
          py: 0.5,
        }}
      >
        <Typography variant="subtitle2" component="h3">
          {block.timeBlockName}
        </Typography>
        <StatusIndicator status={status} />
      </Box>

      {block.entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} date={date} />
      ))}

      <Box sx={{ px: 1, pt: 0.5 }}>
        <Button
          size="small"
          onClick={() =>
            confirmBlock.mutate({
              date: dayDate,
              timeBlockId: block.timeBlockId,
              confirmed: true,
            })
          }
          disabled={allConfirmed || confirmBlock.isPending}
        >
          Confirmar todos — {block.timeBlockName}
        </Button>
        {confirmBlock.isError && (
          <Typography variant="caption" color="error" role="alert" component="div">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
