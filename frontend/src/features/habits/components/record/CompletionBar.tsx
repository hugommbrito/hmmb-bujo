// ─────────────────────────────────────────────────────────────────────────────
// Barra de completude (Story 16.1) — `{components.completion-bar}`.
//
//   ▶ É LEITURA, NUNCA CONTROLE. `role="img"` com a porcentagem no nome
//     acessível; nenhum `progressbar` (que sugeriria uma tarefa em andamento).
//
//   ▶ SEMPRE REDUNDANTE À PORCENTAGEM EM TEXTO. A barra não é fonte única: o
//     número tabular vive ao lado, no cabeçalho do dia ou do card de grupo
//     (`DESIGN.md` L714 — "Nenhuma barra existe sem o número ao lado").
//
//   ▶ A PORCENTAGEM VEM DO SERVIDOR. Este componente só desenha o que recebe:
//     não calcula, não arredonda regra de domínio, não interpola.
//     "Dia sem registro não desenha barra zerada" é decisão de quem chama —
//     por isso `percent` é `number` e não `number | null`: renderizar exige um
//     valor real (`HabitsHistoryPanel` simplesmente não monta a barra num
//     dia-lacuna).
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

export type CompletionBarScope = 'day' | 'group'

export interface CompletionBarProps {
  /** Porcentagem inteira 0–100, **vinda do servidor**. */
  percent: number
  /** Nome acessível completo, ex.: `Completude do dia: 64 por cento`. */
  label: string
  /** `day` usa a altura do cabeçalho; `group`, a do card. */
  scope?: CompletionBarScope
}

export function CompletionBar({ percent, label, scope = 'day' }: CompletionBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <Box
      data-testid={`completion-bar-${scope}`}
      role="img"
      aria-label={label}
      sx={{
        width: '100%',
        height:
          scope === 'day'
            ? 'var(--ds-completion-bar-height-day)'
            : 'var(--ds-completion-bar-height-group)',
        borderRadius: 'var(--ds-radius-xs)',
        backgroundColor: 'var(--ds-surface-subtle)',
        border: 'var(--ds-completion-bar-track-border-width) solid var(--ds-border)',
        overflow: 'hidden',
      }}
    >
      <Box
        aria-hidden
        sx={{
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: 'var(--ds-primary)',
        }}
      />
    </Box>
  )
}
