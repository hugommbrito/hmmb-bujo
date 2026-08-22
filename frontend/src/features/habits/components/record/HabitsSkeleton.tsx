// ─────────────────────────────────────────────────────────────────────────────
// Skeletons por aba (Story 16.1) — molde de `RecurringLibrarySkeleton.tsx`.
//
//   ▶ GEOMETRIA FINAL: cada linha reserva coluna de controle
//     (`--ds-habit-tracker-row-control-column`), coluna do glifo
//     (`--ds-domain-icon-size-default`), corpo e o campo numérico
//     (`--ds-habit-tracker-row-numeric-field-width`). A altura do bloco é a
//     altura final — a lista não pula quando o dado chega (mockup E1).
//
//   ▶ **SEM PORCENTAGEM.** Nenhum número provisório enquanto o servidor não
//     respondeu; o lugar da barra é reservado, o valor não é inventado.
//
//   ▶ `aria-busy` na região + placeholders `aria-hidden`: o leitor de tela
//     ouve "carregando", não uma lista de retângulos.
// ─────────────────────────────────────────────────────────────────────────────
import { Box } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'

/** Densidade do placeholder — não é medida de design, não vira token. */
const SKELETON_ROWS = 3
const SKELETON_CARDS = 2

const BLOCK_SX = {
  backgroundColor: 'var(--ds-surface-subtle)',
  borderRadius: 'var(--ds-radius-sm)',
  display: 'block',
} as const

function SkeletonRow() {
  return (
    <Box
      aria-hidden
      sx={{
        display: 'grid',
        gridTemplateColumns:
          'var(--ds-habit-tracker-row-control-column) var(--ds-domain-icon-size-default) minmax(0, 1fr) var(--ds-habit-tracker-row-numeric-field-width)',
        gap: 'var(--ds-space-2)',
        alignItems: 'center',
        minHeight: 'var(--ds-task-row-min-height-pointer)',
        '@media (pointer: coarse)': { minHeight: 'var(--ds-task-row-min-height-touch)' },
        py: 'var(--ds-space-2)',
        borderBottom: '1px solid var(--ds-border)',
      }}
    >
      <Box
        sx={{
          ...BLOCK_SX,
          width: 'var(--ds-domain-icon-size-default)',
          height: 'var(--ds-domain-icon-size-default)',
          justifySelf: 'center',
        }}
      />
      <Box
        sx={{
          ...BLOCK_SX,
          width: 'var(--ds-domain-icon-size-default)',
          height: 'var(--ds-domain-icon-size-default)',
        }}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
        <Box sx={{ ...BLOCK_SX, width: '58%', height: 'var(--ds-space-3)' }} />
        <Box sx={{ ...BLOCK_SX, width: '34%', height: 'var(--ds-space-2)' }} />
      </Box>
      <Box
        sx={{
          ...BLOCK_SX,
          width: 'var(--ds-habit-tracker-row-numeric-field-width)',
          height: 'var(--ds-touch-target-min)',
          borderRadius: 'var(--ds-radius-md)',
        }}
      />
    </Box>
  )
}

function SkeletonCard() {
  return (
    <Box
      aria-hidden
      sx={{
        backgroundColor: 'var(--ds-surface)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
        padding: 'var(--ds-panel-padding)',
      }}
    >
      <Box sx={{ ...BLOCK_SX, width: '40%', height: 'var(--ds-space-4)' }} />
      {/* Lugar da barra reservado — SEM porcentagem provisória. */}
      <Box
        sx={{
          ...BLOCK_SX,
          width: '100%',
          height: 'var(--ds-completion-bar-height-group)',
          mt: 'var(--ds-space-2)',
        }}
      />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </Box>
  )
}

function SkeletonStatus({ children }: { children: string }) {
  return (
    <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
      {children}
    </Box>
  )
}

export function HabitsTodaySkeleton() {
  return (
    <Box
      aria-busy="true"
      data-testid="habits-today-skeleton"
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-4)' }}
    >
      <Box
        aria-hidden
        sx={{
          backgroundColor: 'var(--ds-surface)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-md)',
          padding: 'var(--ds-panel-padding)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-2)',
        }}
      >
        <Box sx={{ ...BLOCK_SX, width: '46%', height: 'var(--ds-space-5)' }} />
        <Box
          sx={{ ...BLOCK_SX, width: '100%', height: 'var(--ds-completion-bar-height-day)' }}
        />
        <Box sx={{ ...BLOCK_SX, width: '62%', height: 'var(--ds-space-3)' }} />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 'var(--ds-record-cards-gap)',
          gridTemplateColumns: 'minmax(0, 1fr)',
        }}
      >
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </Box>
      <SkeletonStatus>Carregando os hábitos do dia…</SkeletonStatus>
    </Box>
  )
}

export function HabitsConfigSkeleton() {
  return (
    <Box
      aria-busy="true"
      data-testid="habits-config-skeleton"
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}
    >
      <Box aria-hidden sx={{ ...BLOCK_SX, width: '30%', height: 'var(--ds-space-5)' }} />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
      <SkeletonStatus>Carregando a configuração de hábitos…</SkeletonStatus>
    </Box>
  )
}

export function HabitsHistorySkeleton() {
  return (
    <Box
      aria-busy="true"
      data-testid="habits-history-skeleton"
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}
    >
      <Box aria-hidden sx={{ ...BLOCK_SX, width: '100%', height: 'var(--ds-touch-target-min)' }} />
      <SkeletonCard />
      <SkeletonStatus>Carregando o histórico…</SkeletonStatus>
    </Box>
  )
}
