// ─────────────────────────────────────────────────────────────────────────────
// Banner unificado de migração no Hoje (Story 14.9, M10) — substitui
// `MigrationBanner`+`CatchUpBanner` em `DailyPage.tsx` (os dois seguem no
// repo, intocados, para rollback). Único dado de leitura:
// `useUnifiedMigrationQueueQuery` (a mesma fila que alimenta os dois aliases
// legados). Vazio = sem DOM (mockup, frame A/F).
//
//   ▶ Variante PAUSADA ("Migração pausada · N de M restantes"): `M` vem de
//     `sessionStorage` (chave `MIGRATION_SESSION_TOTAL_KEY`), capturado por
//     `MigrationRitualPage` no primeiro mount do ritual nesta aba — este
//     banner só LÊ a chave, nunca escreve nela. Sem `M` salvo (nenhuma
//     sessão de ritual aberta ainda), a variante é a simples (contagem +
//     detalhamento por fonte).
//   ▶ `N` é sempre AO VIVO (a mesma leitura desta query), nas duas variantes.
// ─────────────────────────────────────────────────────────────────────────────
import { Box, Button } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import { useUnifiedMigrationQueueQuery } from '../../api'
import { typography } from '../../../../shared/design/tokens'
import { MIGRATION_SESSION_TOTAL_KEY, MIGRATION_SOURCE_LABEL, MIGRATION_SOURCE_ORDER } from './migrationRitualSources'

export function MigrationRitualBanner() {
  const queue = useUnifiedMigrationQueueQuery()
  const totalCount = queue.data?.totalCount ?? 0

  if (queue.isPending || totalCount === 0) return null

  const storedTotal = sessionStorage.getItem(MIGRATION_SESSION_TOTAL_KEY)
  const paused = storedTotal !== null

  const breakdown = MIGRATION_SOURCE_ORDER.map((sourceId) => {
    const count = queue.data?.sections.find((section) => section.sourceId === sourceId)?.count ?? 0
    return `${count} de ${MIGRATION_SOURCE_LABEL[sourceId].toLowerCase()}`
  }).join(' · ')

  const label = paused
    ? `Migração pausada · ${totalCount} de ${storedTotal} restantes`
    : `${totalCount} ${totalCount === 1 ? 'tarefa precisa' : 'tarefas precisam'} de decisão · ${breakdown}`

  return (
    <Box
      role="region"
      aria-label={label}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ds-space-3)',
        background: 'var(--ds-surface)',
        border: '1px solid var(--ds-border)',
        borderLeft: paused ? 'var(--ds-legacy-seam-border-width) solid var(--ds-warning)' : '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-md)',
        padding: 'var(--ds-space-2) var(--ds-space-3)',
        mb: 'var(--ds-space-2)',
      }}
    >
      <Box aria-hidden="true" sx={{ color: paused ? 'var(--ds-warning)' : 'var(--ds-primary)', flex: 'none' }}>
        {paused ? '⏸' : '⇥'}
      </Box>
      <Box sx={{ ...typography.body, color: 'var(--ds-ink)', flex: 1, minWidth: 0 }}>
        {paused ? (
          <>
            <Box component="span" sx={{ fontWeight: 700 }}>
              Migração pausada
            </Box>{' '}
            <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
              · {totalCount} de {storedTotal} restantes
            </Box>
          </>
        ) : (
          <>
            <Box component="span" sx={{ fontWeight: 700 }}>
              {totalCount} {totalCount === 1 ? 'tarefa' : 'tarefas'}
            </Box>{' '}
            precisa{totalCount === 1 ? '' : 'm'} de decisão{' '}
            <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
              · {breakdown}
            </Box>
          </>
        )}
      </Box>
      <Button
        component={RouterLink}
        to="/migration"
        variant="outlined"
        size="small"
        sx={{ flex: 'none', borderColor: 'var(--ds-control-border)', color: 'var(--ds-primary)' }}
      >
        {paused ? 'Retomar migração' : 'Migrar ›'}
      </Button>
    </Box>
  )
}
