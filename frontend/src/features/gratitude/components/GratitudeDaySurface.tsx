import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Button, Skeleton, TextField, Typography } from '@mui/material'
import { useCreateGratitudeEntryMutation, useGratitudeDayQuery } from '../api'
import { GratitudeEntryList } from './GratitudeEntryList'

// Voz neutra pt-BR (UX-DR13, zero gamificação/CTA). Strings EXATAS.
const LOAD_ERROR = 'Não foi possível carregar as entradas.'
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
const EMPTY_STATE = 'Nenhuma entrada para esta data.'

// Datas manipuladas por SPLIT DE STRING / Date local — nunca `new Date(iso)` (evita
// drift de fuso). Idioma copiado de MedicationHistorySurface (8.3); só o limite SUPERIOR
// (= hoje), sem limite inferior. O par hoje/ontem (AC4) é atendido pelo navegador completo.
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

// Não passa de hoje (limite superior); sem limite inferior.
function clampMax(iso: string, max: string): string {
  return iso > max ? max : iso
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function GratitudeDaySurface() {
  const [searchParams] = useSearchParams()
  const today = isoLocalToday()
  // Abre na data do `?date=` (link "Gratidão de ontem" do /today), capada em hoje;
  // ausente/ inválida → hoje. Lido só na montagem (navegação de data é estado local).
  const [selectedDate, setSelectedDate] = useState(() => {
    const raw = searchParams.get('date')
    return raw && ISO_DATE.test(raw) ? clampMax(raw, today) : today
  })
  const atToday = selectedDate >= today

  const dayQuery = useGratitudeDayQuery(selectedDate)
  const createEntry = useCreateGratitudeEntryMutation(selectedDate)
  const [text, setText] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    createEntry.mutate(
      { text: trimmed, date: selectedDate },
      { onSuccess: () => setText('') },
    )
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h6" component="h2" sx={{ px: 1, mb: 1 }}>
        Diário de Gratidão
      </Typography>

      {/* Navegador de data: dia anterior (sem limite inferior) / próximo (≤ hoje) +
          seletor type="date" limitado a hoje. Cobre o par hoje/ontem (AC4). */}
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
        <Button
          size="small"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          sx={{ minHeight: 44 }}
        >
          Dia anterior
        </Button>
        <TextField
          label="Data"
          type="date"
          size="small"
          value={selectedDate}
          onChange={(event) => setSelectedDate(clampMax(event.target.value, today))}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              max: today,
              'aria-label': `Data selecionada: ${formatDateBR(selectedDate)}`,
            },
          }}
        />
        <Button
          size="small"
          onClick={() => setSelectedDate((d) => clampMax(addDays(d, 1), today))}
          disabled={atToday}
          sx={{ minHeight: 44 }}
        >
          Próximo dia
        </Button>
      </Box>

      {/* Composer de texto livre (sem prompt/rótulo/estrutura — UX Flow 5). */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        aria-label="Adicionar entrada de gratidão"
        sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1, py: 1 }}
      >
        <TextField
          label="Sua gratidão"
          multiline
          minRows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Box>
          <Button
            type="submit"
            variant="contained"
            disabled={!text.trim() || createEntry.isPending}
          >
            Adicionar
          </Button>
        </Box>
        {createEntry.isError && (
          <Typography variant="caption" color="error" role="alert" component="div">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>

      {dayQuery.isPending ? (
        <Box role="status" aria-live="polite" sx={{ px: 1, py: 2 }}>
          <Skeleton variant="text" width={200} />
          <Skeleton variant="rectangular" height={44} sx={{ mt: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Carregando entradas…
          </Typography>
        </Box>
      ) : dayQuery.isError || !dayQuery.data ? (
        <Box sx={{ px: 1, py: 2 }}>
          <Typography variant="body2" color="error" role="alert">
            {LOAD_ERROR}
          </Typography>
          <Button size="small" onClick={() => void dayQuery.refetch()} sx={{ mt: 1 }}>
            Tentar novamente
          </Button>
        </Box>
      ) : dayQuery.data.entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
          {EMPTY_STATE}
        </Typography>
      ) : (
        <GratitudeEntryList entries={dayQuery.data.entries} />
      )}
    </Box>
  )
}
