// ─────────────────────────────────────────────────────────────────────────────
// Panel Capturar do Brain Dump Inbox (Story 15.1 — M11). Primeira peça da
// ordem de leitura fixa da página Inbox (`DESIGN.md#Brain Dump (Inbox)`):
// Capturar → Pendências → lista.
//
//   ▶ Molde de `FutureCaptureForm`/`RecurringLibraryPage`: tokens de
//     `shared/design/tokens.ts` (`var(--ds-*)`), NUNCA cor de tema MUI crua —
//     todo `Button` declara `sx` de cor explícita (achado real de axe em
//     stories anteriores).
//   ▶ Reusa `TARGET_LOG_OPTIONS` de `BrainDumpCaptureForm.tsx` (vocabulário de
//     destino compartilhado, fonte única) — não duplica a lista de rótulos.
//   ▶ Captura é OTIMISTA só sobre a contagem (`useCreateBrainDumpItemMutation`
//     já implementa isso) — este componente só monta o formulário e chama a
//     mutation existente, sem lógica de estado de servidor própria.
// ─────────────────────────────────────────────────────────────────────────────
import { forwardRef, useRef, useState, type FormEvent } from 'react'
import { Box, Button, MenuItem, Select } from '@mui/material'

import { useCreateBrainDumpItemMutation } from '../api'
import { TARGET_LOG_OPTIONS } from './BrainDumpCaptureForm'
import { typography } from '../../../shared/design/tokens'
import type { BrainDumpTargetLog } from '../types'

const WRITE_ERROR = 'Não foi possível salvar. Tente novamente.'

const FIELD_INPUT_STYLE = {
  ...typography.body,
  padding: 'var(--ds-space-2)',
  border: '1px solid var(--ds-control-border)',
  borderRadius: 'var(--ds-radius-sm)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-ink)',
  minHeight: 'var(--ds-touch-target-min)',
} as const

export interface BrainDumpInboxCaptureFormProps {
  /** Offline (I/O Matrix): captura indisponível com motivo, sem fila local. */
  disabled?: boolean
  disabledReason?: string
}

export const BrainDumpInboxCaptureForm = forwardRef<
  HTMLInputElement,
  BrainDumpInboxCaptureFormProps
>(function BrainDumpInboxCaptureForm({ disabled = false, disabledReason }, ref) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetLog, setTargetLog] = useState<BrainDumpTargetLog | ''>('')
  const createItem = useCreateBrainDumpItemMutation()

  // Ref LOCAL, além da encaminhada: a página usa a encaminhada para focar no
  // mount (Task 10.2, paridade com o legado), e este componente precisa da
  // sua PRÓPRIA referência para devolver o foco ao Título após capturar —
  // convenção já estabelecida em `BrainDumpCaptureSheet.tsx` ("o Título limpa
  // e mantém o foco para a captura seguinte"), sem a qual capturas rápidas em
  // sequência exigiriam um clique manual de volta no campo a cada item
  // (achado de review).
  const titleRef = useRef<HTMLInputElement>(null)

  function setRefs(node: HTMLInputElement | null) {
    titleRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || disabled || createItem.isPending) return

    createItem.mutate(
      {
        title: trimmedTitle,
        description: description.trim() || undefined,
        targetLog: targetLog || undefined,
      },
      {
        onSuccess: () => {
          setTitle('')
          setDescription('')
          setTargetLog('')
          titleRef.current?.focus()
        },
      },
    )
  }

  return (
    <Box
      component="section"
      aria-label="Capturar"
      sx={{
        backgroundColor: 'var(--ds-surface)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
        padding: 'var(--ds-panel-padding)',
      }}
    >
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)', mb: 'var(--ds-space-2)' }}>
        Capturar
      </Box>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}
      >
        <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Título</span>
          <input
            ref={setRefs}
            aria-label="Título"
            required
            disabled={disabled}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="O que você precisa lembrar?"
            style={FIELD_INPUT_STYLE}
          />
        </Box>

        <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Descrição</span>
          <textarea
            aria-label="Descrição"
            disabled={disabled}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Detalhes opcionais, em até duas linhas…"
            rows={2}
            style={{ ...FIELD_INPUT_STYLE, resize: 'vertical' }}
          />
        </Box>

        <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Destino</span>
          <Select
            size="small"
            disabled={disabled}
            value={targetLog}
            onChange={(event) => setTargetLog(event.target.value as BrainDumpTargetLog | '')}
            inputProps={{ 'aria-label': 'Destino' }}
            sx={{ backgroundColor: 'var(--ds-surface)' }}
          >
            {TARGET_LOG_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </Box>

        {disabled && disabledReason && (
          <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
            {disabledReason}
          </Box>
        )}

        {createItem.isError && (
          <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
            {WRITE_ERROR}
          </Box>
        )}

        <Box>
          <Button
            type="submit"
            disabled={!title.trim() || disabled || createItem.isPending}
            sx={{
              minHeight: 'var(--ds-touch-target-min)',
              backgroundColor: 'var(--ds-primary)',
              color: 'var(--ds-on-primary)',
              '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
              '&.Mui-disabled': {
                backgroundColor: 'var(--ds-surface-subtle)',
                color: 'var(--ds-ink-muted)',
              },
            }}
          >
            {createItem.isPending ? 'Salvando…' : 'Capturar'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
})
