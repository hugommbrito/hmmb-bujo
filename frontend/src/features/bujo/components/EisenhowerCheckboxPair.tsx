// ─────────────────────────────────────────────────────────────────────────────
// Controle CANÔNICO de Eisenhower — DUAS checkboxes REAIS e independentes, com
// `checked` DERIVADO do enum combinado (`none|u|i|ui`), nunca dois booleans
// soltos: o backend guarda um único campo, e derivar na leitura + recombinar na
// escrita é o que impede os dois estados de divergirem.
//
//   ▶ EXTRAÍDO de `TaskDetailCard.tsx` na Story 14.8 (AC3), SEM mudança de
//     comportamento — `DESIGN.md` L673 declara o tratamento único "para toda
//     superfície com detalhe — tarefa e template recorrente".
//   ▶ Consumidores: `TaskDetailCard.tsx` (14.5) e `TemplateDetailCard.tsx` (14.8).
//   ▶ Desmarcar o último marcado devolve `null` (e não `'none'`): é o valor que
//     os dois cards enviam no PATCH/POST desde a 14.5.
//
// [Source: DESIGN.md#Task Row L671-681 — controles canônicos; UX-DR26]
// ─────────────────────────────────────────────────────────────────────────────
import { Box, Checkbox } from '@mui/material'

import { typography } from '../../../shared/design/tokens'
import type { TaskEisenhower } from '../types'

// eslint-disable-next-line react-refresh/only-export-components
export function toggleUrgent(
  current: TaskEisenhower | null,
  checked: boolean,
): TaskEisenhower | null {
  const important = current === 'i' || current === 'ui'
  if (checked) return important ? 'ui' : 'u'
  return important ? 'i' : null
}

// eslint-disable-next-line react-refresh/only-export-components
export function toggleImportant(
  current: TaskEisenhower | null,
  checked: boolean,
): TaskEisenhower | null {
  const urgent = current === 'u' || current === 'ui'
  if (checked) return urgent ? 'ui' : 'i'
  return urgent ? 'u' : null
}

export interface EisenhowerCheckboxPairProps {
  value: TaskEisenhower | null
  onChange: (next: TaskEisenhower | null) => void
  readonly?: boolean
  /** Rótulo VISÍVEL do campo. Os nomes acessíveis das duas checkboxes
   * ("Urgente (U)" / "Importante (I)") são fixos — contrato de locator. */
  label?: string
}

export function EisenhowerCheckboxPair({
  value,
  onChange,
  readonly = false,
  label = 'Eisenhower',
}: EisenhowerCheckboxPairProps) {
  const urgent = value === 'u' || value === 'ui'
  const important = value === 'i' || value === 'ui'

  return (
    <Box>
      <Box sx={{ ...typography.label, mb: 'var(--ds-space-1)' }}>{label}</Box>
      <Box sx={{ display: 'flex', gap: 'var(--ds-space-3)' }}>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
          <Checkbox
            checked={urgent}
            disabled={readonly}
            onChange={(event) => onChange(toggleUrgent(value, event.target.checked))}
            sx={{
              color: 'var(--ds-priority-u)',
              '&.Mui-checked': { color: 'var(--ds-priority-u)' },
            }}
          />
          Urgente (U)
        </Box>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
          <Checkbox
            checked={important}
            disabled={readonly}
            onChange={(event) => onChange(toggleImportant(value, event.target.checked))}
            sx={{
              color: 'var(--ds-priority-i)',
              '&.Mui-checked': { color: 'var(--ds-priority-i)' },
            }}
          />
          Importante (I)
        </Box>
      </Box>
    </Box>
  )
}
