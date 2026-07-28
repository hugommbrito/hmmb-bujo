// ─────────────────────────────────────────────────────────────────────────────
// Lista de decisão do ritual de migração (Story 14.9, M10) — molde de
// `weekly/WeeklyDecisionList.tsx`: continuidade de foco (decidir move o foco
// à próxima pendência; ao esgotar a fonte, ao heading), erro por item com
// retry local, toggle Pendentes de decisão/Tudo. Ações são AS MESMAS em toda
// fonte (mockup, decisão fechada #2): "Migrar para hoje" (destaque) ·
// "Escolher destino…" · "Cancelar" — nunca "Concluir" (migração não conclui
// tarefa).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Box, Button } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import { MIGRATION_SOURCE_HEADING, type MigrationSourceId, type NormalizedMigrationItem } from './migrationRitualSources'

export interface MigrationDecisionListProps {
  sourceId: MigrationSourceId
  items: NormalizedMigrationItem[]
  view: 'pending' | 'all'
  onViewChange: (view: 'pending' | 'all') => void
  loading: boolean
  error: boolean
  /** Sem rede: decisões ficam `aria-disabled` + guardadas no clique — o
   * motivo vive no banner `role="status"` que o chamador (`MigrationRitualPage`)
   * renderiza, mesmo padrão do Weekly/Monthly. */
  offline?: boolean
  onRetry: () => void
  itemErrors?: Record<string, string>
  onRetryItem?: (itemId: string) => void
  onMigrateToday: (taskId: string) => void
  onChooseDestination: (taskId: string) => void
  onCancel: (taskId: string) => void
}

export function MigrationDecisionList({
  sourceId,
  items,
  view,
  onViewChange,
  loading,
  error,
  offline = false,
  onRetry,
  itemErrors = {},
  onRetryItem,
  onMigrateToday,
  onChooseDestination,
  onCancel,
}: MigrationDecisionListProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [lastActed, setLastActed] = useState<{ id: string; index: number } | null>(null)

  // Continuidade de foco (mesma mecânica do Weekly, AC "decidir o último item
  // de uma fonte move o foco ao heading"): quando o item agido SOME da lista,
  // foca a próxima pendência na MESMA posição, ou o heading, ao esgotar.
  useEffect(() => {
    if (!lastActed) return
    const stillThere = items.some((item) => item.id === lastActed.id)
    if (stillThere) return
    const next = items[Math.min(lastActed.index, items.length - 1)]
    if (next) {
      itemRefs.current.get(next.id)?.focus()
    } else {
      headingRef.current?.focus()
    }
    setLastActed(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  function actOn(itemId: string, index: number, run: () => void) {
    if (offline) return
    setLastActed({ id: itemId, index })
    run()
  }

  function chooseDestination(itemId: string) {
    if (offline) return
    onChooseDestination(itemId)
  }

  return (
    <Box component="section" aria-label={`Decisões — ${MIGRATION_SOURCE_HEADING[sourceId]}`} aria-busy={loading || undefined}>
      <Box
        component="h2"
        ref={headingRef}
        tabIndex={-1}
        sx={{ ...typography['section-title'], color: 'var(--ds-ink)', outline: 'none' }}
      >
        {MIGRATION_SOURCE_HEADING[sourceId]}
      </Box>

      <Box role="group" aria-label="Alternar entre pendentes e tudo" sx={{ display: 'flex', gap: 'var(--ds-space-1)', mb: 'var(--ds-space-2)' }}>
        {/* `color: 'var(--ds-primary)'` nestes botões-texto: fix do achado real de
            contraste do axe (e2e em review). Sem override, o MUI aplica
            `theme.primary` legado (o teal antigo da marca), que fica abaixo de 4.5:1 contra
            `--ds-surface`/`--ds-canvas` — o token novo `--ds-primary` (o verde-
            petróleo do design system novo) resolve. */}
        <Button aria-pressed={view === 'pending'} onClick={() => onViewChange('pending')} size="small" sx={{ color: 'var(--ds-primary)' }}>
          Pendentes de decisão
        </Button>
        <Button aria-pressed={view === 'all'} onClick={() => onViewChange('all')} size="small" sx={{ color: 'var(--ds-primary)' }}>
          Tudo
        </Button>
      </Box>

      {error && (
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)', mb: 'var(--ds-space-2)' }}>
          Não foi possível carregar esta fonte.{' '}
          <Button onClick={onRetry} size="small" sx={{ color: 'var(--ds-primary)' }}>
            Tentar novamente
          </Button>
        </Box>
      )}

      {!error && items.length === 0 && (
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
          {view === 'pending' ? 'Nenhuma pendência nesta fonte.' : 'Nada para mostrar ainda.'}
        </Box>
      )}

      {!error &&
        items.map((item, index) => {
          const itemError = itemErrors[item.id]
          return (
            <Box
              key={item.id}
              data-testid="migration-decision-item"
              tabIndex={-1}
              ref={(el: HTMLElement | null) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                columnGap: 'var(--ds-space-2)',
                // Linha e botões viram DUAS linhas empilhadas em telas estreitas
                // (mesma mecânica de `flexWrap`). Achado real do e2e em
                // review: com row-gap de 8px (`--ds-space-2`), o axe mede o
                // botão "Cancelar" (linha de baixo) como alvo de toque com
                // espaço insuficiente até o vizinho de cima (WCAG 2.5.8/
                // target-size) — precisa de ≥24px CSS px de vizinhança.
                rowGap: 'var(--ds-space-6)',
                padding: 'var(--ds-space-2)',
                borderBottom: '1px solid var(--ds-border)',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
                <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>{item.title}</Box>
                <Box sx={{ ...typography.meta, color: 'var(--ds-info)' }}>{item.originLabel}</Box>
              </Box>
              {/* Split de gap (achado de code review): `gap` único valeria também na
                  direção HORIZONTAL em toda largura, inflando o espaçamento entre os
                  3 botões até em wide/desktop (onde nunca quebram linha). `columnGap`
                  mantém o espaçamento original entre eles lado a lado; `rowGap` é o
                  que o axe realmente exige (≥24px) quando quebram linha em telas
                  estreitas. */}
              <Box sx={{ display: 'flex', columnGap: 'var(--ds-space-1)', rowGap: 'var(--ds-space-6)', flexWrap: 'wrap' }}>
                <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onCancel(item.id))} sx={{ color: 'var(--ds-danger)' }}>
                  Cancelar
                </Button>
                {/* Fix do achado real de contraste do axe (e2e em review): MUI aplicava
                    `theme.primary` legado (o teal antigo da marca) em vez do token novo
                    `--ds-primary` (o verde-petróleo do design system novo), insuficiente
                    contra `--ds-surface`/`--ds-canvas`. */}
                <Button size="small" aria-disabled={offline} onClick={() => chooseDestination(item.id)} sx={{ color: 'var(--ds-primary)' }}>
                  Escolher destino…
                </Button>
                <Button
                  size="small"
                  aria-disabled={offline}
                  onClick={() => actOn(item.id, index, () => onMigrateToday(item.id))}
                  sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)', '&:hover': { backgroundColor: 'var(--ds-primary-hover)' } }}
                >
                  Migrar para hoje
                </Button>
              </Box>
              {itemError && (
                <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', width: '100%', ...typography.meta, color: 'var(--ds-danger)' }}>
                  <Box component="span">{itemError}</Box>
                  <Button size="small" onClick={() => onRetryItem?.(item.id)} sx={{ color: 'var(--ds-primary)' }}>
                    Tentar novamente
                  </Button>
                </Box>
              )}
            </Box>
          )
        })}
    </Box>
  )
}
