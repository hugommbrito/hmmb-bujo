import { useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Divider,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import {
  useCreateAdHocEntryMutation,
  useMedicationDayQuery,
  useMedicationsQuery,
} from '../api'
import { doseSummary } from '../dayModel'
import { MedicationBlock } from './MedicationBlock'
import type { Medication, MedicationDayEntry } from '../types'

// Voz neutra pt-BR (UX-DR13, zero gamificação). Strings de erro/empty EXATAS.
const LOAD_ERROR = 'Não foi possível carregar os medicamentos.'
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
const EMPTY_STATE = 'Nenhum medicamento para hoje.'

// --- Seção Avulso/PRN (AC7): lista os avulsos + um controle simples de registro ---

function AdHocList({ entries }: { entries: MedicationDayEntry[] }) {
  return (
    <Box sx={{ px: 1 }}>
      {entries.map((entry) => {
        const summary = doseSummary(entry.doseAtTime)
        return (
          <Box
            key={entry.id}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 44 }}
          >
            <CheckCircleOutlineIcon fontSize="small" color="success" aria-hidden />
            <Typography variant="body2">
              {entry.medicationTitle}
              {summary ? ` · ${summary}` : ''}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

interface AdHocFormProps {
  medications: Medication[]
  date?: string
  dayDate: string
}

function AdHocForm({ medications, date, dayDate }: AdHocFormProps) {
  const [medicationId, setMedicationId] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const createAdHoc = useCreateAdHocEntryMutation(date)

  const canSubmit = medicationId !== '' && amount.trim() !== '' && unit.trim() !== ''

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createAdHoc.mutate(
      {
        date: dayDate,
        medicationId,
        dose: [{ label: '', amount: Number(amount), unit: unit.trim() }],
      },
      {
        onSuccess: () => {
          setMedicationId('')
          setAmount('')
          setUnit('')
        },
      },
    )
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ px: 1, pt: 1 }}>
      <Typography variant="subtitle2" component="h3" gutterBottom>
        Registrar avulso
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Select
          size="small"
          displayEmpty
          value={medicationId}
          onChange={(event) => setMedicationId(event.target.value)}
          inputProps={{ 'aria-label': 'Medicamento avulso' }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="" disabled>
            Selecione o medicamento
          </MenuItem>
          {medications.map((med) => (
            <MenuItem key={med.id} value={med.id}>
              {med.title}
            </MenuItem>
          ))}
        </Select>
        <TextField
          type="number"
          size="small"
          label="Quantidade"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputProps={{ 'aria-label': 'Quantidade da dose avulsa' }}
          sx={{ width: 120 }}
        />
        <TextField
          size="small"
          label="Unidade"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          inputProps={{ 'aria-label': 'Unidade da dose avulsa' }}
          sx={{ width: 120 }}
        />
        <Button type="submit" variant="outlined" disabled={!canSubmit || createAdHoc.isPending}>
          Registrar avulso
        </Button>
      </Box>
      {createAdHoc.isError && (
        <Typography variant="caption" color="error" role="alert" component="div">
          {SAVE_ERROR}
        </Typography>
      )}
    </Box>
  )
}

export interface MedicationDaySurfaceProps {
  date?: string
}

export function MedicationDaySurface({ date }: MedicationDaySurfaceProps) {
  const dayQuery = useMedicationDayQuery(date)
  // Catálogo (para o seletor do avulso). Query dentro da página (no <Outlet/>),
  // nunca na nav — protege os testes compartilhados da casca (ver Dev Notes).
  const medicationsQuery = useMedicationsQuery()

  if (dayQuery.isPending) {
    return (
      <Box role="status" aria-live="polite" sx={{ px: 1, py: 2 }}>
        <Skeleton variant="text" width={160} />
        <Skeleton variant="rectangular" height={44} sx={{ mt: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Carregando medicamentos…
        </Typography>
      </Box>
    )
  }

  if (dayQuery.isError || !dayQuery.data) {
    return (
      <Box sx={{ px: 1, py: 2 }}>
        <Typography variant="body2" color="error" role="alert">
          {LOAD_ERROR}
        </Typography>
        <Button size="small" onClick={() => void dayQuery.refetch()} sx={{ mt: 1 }}>
          Tentar novamente
        </Button>
      </Box>
    )
  }

  const { date: dayDate, blocks, adHoc } = dayQuery.data
  const isEmpty = blocks.length === 0 && adHoc.length === 0
  const catalog = medicationsQuery.data ?? []

  return (
    <Box>
      <Typography variant="h6" component="h2" sx={{ px: 1, mb: 1 }}>
        Medicamentos
      </Typography>

      {blocks.map((block) => (
        <MedicationBlock
          key={block.timeBlockId}
          block={block}
          date={date}
          dayDate={dayDate}
        />
      ))}

      {adHoc.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" component="h3" sx={{ px: 1, py: 0.5 }}>
            Avulso / PRN
          </Typography>
          <AdHocList entries={adHoc} />
        </Box>
      )}

      {isEmpty && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          {EMPTY_STATE}
        </Typography>
      )}

      {catalog.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <AdHocForm medications={catalog} date={date} dayDate={dayDate} />
        </>
      )}
    </Box>
  )
}
