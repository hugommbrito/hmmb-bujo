import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material'
import { fieldErrorMessage } from '../../../api/errors'
import { useMedicationDayQuery, useSetMedicationUntrackedDayMutation } from '../api'
import { AdHocList } from './AdHocList'
import { MedicationBlock } from './MedicationBlock'
import type { MedicationDayBlock, MedicationDayEntry } from '../types'

// Voz neutra pt-BR (UX-DR13, zero gamificação/punição). Strings EXATAS.
const LOAD_ERROR = 'Não foi possível carregar o histórico.'
const EMPTY_STATE = 'Nenhum medicamento neste dia.'
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
// Story 16.2c — dia "não registrado" (collection `medications`): mesmo controle
// (checkbox rotulado) e mesma voz do de feriado em Hábitos; estado SEMPRE escrito.
export const UNTRACKED_LABEL = 'Marcar este dia como não registrado'
export const UNTRACKED_STATE = 'Dia não registrado — fora das estatísticas'

// Datas manipuladas por SPLIT DE STRING / Date local — nunca `new Date(iso)` (evita
// drift de fuso). Idioma copiado de HabitHistory.tsx (6.4); aqui só o limite SUPERIOR
// (= hoje), sem range inferior (pode-se voltar indefinidamente no passado).
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
  // `new Date(y, m-1, d)` (construtor por partes, local) — NÃO `new Date(iso)`.
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

// Seção Avulso/PRN read-only (AC7): o histórico EXIBE avulsos passados; registrar um
// novo avulso retroativo é fora de escopo (a UI de avulso é a aba "Hoje" da 8.2). A
// lista em si é o `AdHocList` compartilhado com a superfície diária (sem fork).

export function MedicationHistorySurface() {
  const today = isoLocalToday()
  const [selectedDate, setSelectedDate] = useState(today)
  const dayQuery = useMedicationDayQuery(selectedDate)
  const setUntracked = useSetMedicationUntrackedDayMutation(selectedDate)
  const isPast = selectedDate < today
  const atToday = selectedDate >= today
  const untracked = dayQuery.data?.untracked === true
  // Trocar de data zera o estado do toggle: um erro de D1 não sobrevive em D2
  // (o alerta falaria de outro dia e o retry escreveria nele).
  const { reset: resetUntracked } = setUntracked
  useEffect(() => {
    resetUntracked()
  }, [selectedDate, resetUntracked])
  // 400 de CAMPO (ex.: "hoje" do navegador passou o `today_for` do perfil →
  // "dia futuro"): mostra a mensagem do servidor e NÃO oferece retry (não
  // passaria). Qualquer outro erro: genérico + retry da escrita exata.
  const untrackedFieldError = setUntracked.isError
    ? fieldErrorMessage(setUntracked.error, 'date')
    : null

  return (
    <Box>
      <Typography variant="h6" component="h2" sx={{ px: 1, mb: 1 }}>
        Histórico
      </Typography>

      {/* Navegador de data: dia anterior (sem limite inferior) / próximo (≤ hoje) +
          seletor type="date" limitado a hoje. */}
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

      <Typography variant="subtitle2" component="h3" sx={{ px: 1, mb: 1 }}>
        {formatDateBR(selectedDate)}
        {untracked ? ` · ${UNTRACKED_STATE}` : ''}
      </Typography>

      {/* Story 16.2c: a linha do toggle fica MONTADA sempre que não há erro de
          leitura — `disabled` enquanto o dia carrega (sem `placeholderData`, o
          controle sumiria e voltaria a cada "Dia anterior": salto de layout).
          A escrita é otimista na flag; falha → rollback + alerta + retry da
          escrita EXATA que falhou (`variables`), ou só a mensagem de campo. */}
      {!dayQuery.isError && (
        <Box sx={{ px: 1, mb: 1 }}>
          <FormControlLabel
            sx={{ minHeight: 44, m: 0 }}
            control={
              <Checkbox
                checked={untracked}
                disabled={dayQuery.data == null}
                onChange={(event) =>
                  setUntracked.mutate({ date: selectedDate, untracked: event.target.checked })
                }
                inputProps={{ 'aria-label': UNTRACKED_LABEL }}
              />
            }
            label={UNTRACKED_LABEL}
          />
          {untrackedFieldError != null ? (
            <Typography
              variant="caption"
              color="error"
              role="alert"
              component="div"
              data-testid="medications-untracked-field-error"
            >
              {untrackedFieldError}
            </Typography>
          ) : (
            setUntracked.isError && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="caption" color="error" role="alert" component="div">
                  {SAVE_ERROR}
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    if (setUntracked.variables) setUntracked.mutate(setUntracked.variables)
                  }}
                  sx={{ minHeight: 44 }}
                >
                  Tentar novamente
                </Button>
              </Box>
            )
          )}
        </Box>
      )}

      {dayQuery.isPending ? (
        <Box role="status" aria-live="polite" sx={{ px: 1, py: 2 }}>
          <Skeleton variant="text" width={160} />
          <Skeleton variant="rectangular" height={44} sx={{ mt: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Carregando histórico…
          </Typography>
        </Box>
      ) : dayQuery.isError || !dayQuery.data ? (
        <Box sx={{ px: 1, py: 2 }}>
          <Typography variant="body2" color="error" role="alert">
            {LOAD_ERROR}
          </Typography>
          {/* Retry local preserva a data selecionada (só re-busca a query). */}
          <Button size="small" onClick={() => void dayQuery.refetch()} sx={{ mt: 1 }}>
            Tentar novamente
          </Button>
        </Box>
      ) : (
        <HistoryDay
          blocks={dayQuery.data.blocks}
          adHoc={dayQuery.data.adHoc}
          selectedDate={selectedDate}
          isPast={isPast}
          untracked={untracked}
        />
      )}
    </Box>
  )
}

interface HistoryDayProps {
  blocks: MedicationDayBlock[]
  adHoc: MedicationDayEntry[]
  selectedDate: string
  isPast: boolean
  untracked: boolean
}

function HistoryDay({ blocks, adHoc, selectedDate, isPast, untracked }: HistoryDayProps) {
  const isEmpty = blocks.length === 0 && adHoc.length === 0
  return (
    <Box>
      {blocks.map((block) => (
        <MedicationBlock
          key={block.timeBlockId}
          block={block}
          date={selectedDate}
          dayDate={selectedDate}
          isPast={isPast}
          untracked={untracked}
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
    </Box>
  )
}
