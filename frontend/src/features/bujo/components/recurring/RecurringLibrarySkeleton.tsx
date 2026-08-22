// ─────────────────────────────────────────────────────────────────────────────
// Skeleton do `initial loading` da biblioteca (Story 14.8, AC6; mockup frame E).
//
//   ▶ PRESERVA A GEOMETRIA "abas + linhas". O `PlannerSkeleton` compartilhado é
//     uma pilha genérica de barras e NÃO serve aqui — deformá-lo para servir
//     esta superfície quebraria as outras que já o consomem. Compor local é a
//     saída contratada (mesma decisão da 14.7 para o trilho do Future Log).
//
//   ▶ Uma barra por ABA (as três do `recurrence_group`) + uma pilha de linhas
//     na altura real da Item Row — o esqueleto tem a forma da superfície, não
//     um retângulo qualquer.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { RECURRENCE_GROUPS } from './recurringLibrary'
import { typography } from '../../../../shared/design/tokens'

/** Quantas linhas o esqueleto insinua. Não é medida de design (não vira token,
 * AC7): é a densidade visual do placeholder, e o mockup (frame E) desenha três. */
const SKELETON_ROWS = 3

export function RecurringLibrarySkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
      <Box aria-hidden sx={{ display: 'flex', gap: 'var(--ds-space-1)' }}>
        {RECURRENCE_GROUPS.map((group) => (
          <Box
            key={group}
            sx={{
              // Sem medida própria: as três barras dividem a faixa igualmente.
              // Emprestar um token de OUTRA superfície (ex.: a largura do
              // trilho do Future Log) seria acoplamento acidental, e inventar
              // `itemRow`/`recurringLibrary` seria token novo (proibido, AC7).
              flex: '1 1 0',
              height: 'var(--ds-touch-target-min)',
              borderRadius: 'var(--ds-radius-sm)',
              backgroundColor: 'var(--ds-surface-subtle)',
            }}
          />
        ))}
      </Box>
      <Box
        aria-hidden
        sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}
      >
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Box
            key={index}
            sx={{
              minHeight: 'var(--ds-task-row-min-height-pointer)',
              '@media (pointer: coarse)': { minHeight: 'var(--ds-task-row-min-height-touch)' },
              borderRadius: 'var(--ds-radius-sm)',
              backgroundColor: 'var(--ds-surface-subtle)',
            }}
          />
        ))}
      </Box>
      <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
        Carregando os templates…
      </Box>
    </Box>
  )
}
