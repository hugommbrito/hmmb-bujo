// ─────────────────────────────────────────────────────────────────────────────
// Captura no header do Future Log (Story 14.7, AC3 — M08).
//
//   ▶ Molde do `FutureLogItemForm` legado — mesmos rótulos (`Título`, `Mês`,
//     `Dia (opcional)`, botão `Adicionar`), mesmo `<input type="month">` nativo
//     (nenhum date picker novo, `@mui/x-date-pickers` segue fora).
//   ▶ DELTA deliberado vs. o legado: o campo **Mês** nasce preenchido com o mês
//     em FOCO. Capturar no mês visível vira um campo só; capturar num mês
//     distante vazio continua possível digitando a data — que é exatamente como
//     o M08 manda um mês distante passar a existir no seletor "Ir para mês…".
//   ▶ Rejeita mês ≤ âncora ANTES do POST: `MonthlyTaskCreateSerializer` aceita
//     qualquer `month_first` (só valida `day == 1` e a data dentro do mês), então
//     sem esta validação o item seria criado com 201 num mês do passado/corrente
//     e sumiria da superfície sem erro nenhum.
//   ▶ Ícones: nenhum. O legado usa `@mui/icons-material`, que permanece SÓ no
//     legado até o Épico 18 (AD-29).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type FormEvent } from 'react'
import { Box, Button, TextField } from '@mui/material'

import { CAPTURE_MONTH_REJECTED, isCaptureMonthInFuture } from './futureHorizon'
import { lastDayOfMonth } from '../../../../shared/date'
import { typography } from '../../../../shared/design/tokens'

export interface FutureCaptureFields {
  monthFirst: string
  title: string
  scheduledDate?: string
}

export interface FutureCaptureFormProps {
  /** Mês em foco — pré-preenche o campo Mês ("AAAA-MM-01"). */
  focusedMonthFirst: string
  /** Âncora do horizonte (do servidor): o mês capturado precisa ser MAIOR. */
  anchorMonthFirst: string
  /** Offline (AC7): capturar fica indisponível COM MOTIVO, sem fila local. */
  disabled?: boolean
  disabledReason?: string | null
  onAdd: (fields: FutureCaptureFields) => void
}

export function FutureCaptureForm({
  focusedMonthFirst,
  anchorMonthFirst,
  disabled = false,
  disabledReason = null,
  onAdd,
}: FutureCaptureFormProps) {
  const [title, setTitle] = useState('')
  const [month, setMonth] = useState(focusedMonthFirst.slice(0, 7))
  const [day, setDay] = useState('')
  const [error, setError] = useState<string | null>(null)

  // O mês em foco muda sem remontar o formulário (o pai só troca a prop): sem
  // este reset o campo Mês ficaria preso ao primeiro foco da sessão. Só o mês é
  // resetado — título e dia em digitação são do usuário.
  useEffect(() => {
    setMonth(focusedMonthFirst.slice(0, 7))
  }, [focusedMonthFirst])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !month) return

    const monthFirst = `${month}-01`
    if (!isCaptureMonthInFuture(monthFirst, anchorMonthFirst)) {
      setError(CAPTURE_MONTH_REJECTED)
      return
    }

    const dayNumber = day ? Number(day) : null
    if (dayNumber !== null && (dayNumber < 1 || dayNumber > lastDayOfMonth(monthFirst))) {
      setError(`Este mês tem ${lastDayOfMonth(monthFirst)} dias.`)
      return
    }

    setError(null)
    onAdd({
      monthFirst,
      title: trimmedTitle,
      scheduledDate: dayNumber !== null ? `${month}-${String(dayNumber).padStart(2, '0')}` : undefined,
    })
    setTitle('')
    setDay('')
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      // Nome acessível SEM a palavra "Futuro": `navigate()` (`shellHelpers.ts`) e
      // vários specs localizam a superfície por `getByLabel('Futuro')`, que casa
      // por SUBSTRING — um segundo elemento contendo "Futuro" quebraria o modo
      // estrito em `weekly-monthly-cycle`, nos `shell-*` e no `future-log-annual`
      // (achado real na primeira execução do E2E desta story). "Future Log" não
      // contém "Futuro", e é o mesmo rótulo que o `FutureLogItemForm` legado já
      // usava — convenção preservada, não inventada.
      aria-label="Adicionar item ao Future Log"
      sx={{
        display: 'flex',
        gap: 'var(--ds-space-2)',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
      }}
    >
      <TextField
        label="Título"
        size="small"
        disabled={disabled}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <TextField
        label="Mês"
        type="month"
        size="small"
        disabled={disabled}
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="Dia (opcional)"
        type="number"
        size="small"
        disabled={disabled}
        value={day}
        onChange={(event) => setDay(event.target.value)}
        slotProps={{ htmlInput: { min: 1, max: 31 } }}
      />
      {/* Cores EXPLÍCITAS do design system, nunca o `primary` do tema MUI:
          achado real do axe (`color-contrast`) nesta story — o teal de marca do
          tema mede ~2,4:1 sobre `--ds-surface` e reprova AA. O legado nunca foi
          pego porque a rota antiga ficava sob `exclude: 'main'` (SHELL-DEBT-02). */}
      <Button
        type="submit"
        disabled={disabled}
        sx={{
          minHeight: 'var(--ds-touch-target-min)',
          backgroundColor: 'var(--ds-primary)',
          color: 'var(--ds-on-primary)',
          '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
          '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
        }}
      >
        Adicionar
      </Button>
      {disabled && disabledReason && (
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', width: '100%' }}>
          {disabledReason}
        </Box>
      )}
      {error && (
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)', width: '100%' }}>
          {error}
        </Box>
      )}
    </Box>
  )
}
