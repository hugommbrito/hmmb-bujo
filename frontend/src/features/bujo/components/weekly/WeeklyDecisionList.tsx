// ─────────────────────────────────────────────────────────────────────────────
// Lista de decisões do ritual (Story 14.5, AC5) — a fonte ATIVA do rail, com
// o conjunto de ações completo e estável (`WEEKLY_RITUAL_SOURCE_ACTIONS`),
// toggle Pendentes de decisão/Tudo, e continuidade de foco: sucesso move o
// foco à PRÓXIMA pendência da mesma fonte; ao esgotar, ao heading da fonte.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Box, Button } from '@mui/material'

import {
  WEEKLY_RITUAL_ACTION_LABEL,
  WEEKLY_RITUAL_SOURCE_ACTIONS,
  WEEKLY_RITUAL_SOURCE_LABEL,
  type NormalizedRitualItem,
  type WeeklyRitualSourceId,
} from './weeklyRitualSources'
import { addDaysIso, formatDayLabel, weekdayIndexOf } from '../../../../shared/date'
import { typography } from '../../../../shared/design/tokens'

export interface WeeklyDecisionListProps {
  sourceId: WeeklyRitualSourceId
  weekStart: string
  items: NormalizedRitualItem[]
  /** Só `recurring`: bucket `alreadyPlaced` — FORA do progresso e dos avisos,
   * mas permanentemente consultável (novas instâncias continuam permitidas). */
  alreadyPlacedItems?: NormalizedRitualItem[]
  view: 'pending' | 'all'
  onViewChange: (view: 'pending' | 'all') => void
  loading: boolean
  error: boolean
  /** Sem rede (AC7): decisões ficam `aria-disabled` + guardadas no clique —
   * NUNCA `disabled` nativo, nunca fila local. O motivo vive no banner
   * persistente que o chamador renderiza (`role="status"`). */
  offline?: boolean
  onRetry: () => void
  /** Mensagem de falha por item (AC5: falha preserva item/densidade/foco,
   * mostra o motivo e oferece retry) — chave é o id do item/template. */
  itemErrors?: Record<string, string>
  onRetryItem?: (itemId: string) => void
  onKeep: (itemId: string) => void
  onSkipWeek: (templateId: string) => void
  onAllocate: (templateId: string) => void
  onComplete: (taskId: string) => void
  onCancel: (taskId: string) => void
  onMigrateNamedDay: (taskId: string, destinationDate: string) => void
  onChooseDestination: (taskId: string) => void
}

export function WeeklyDecisionList({
  sourceId,
  weekStart,
  items,
  alreadyPlacedItems = [],
  view,
  onViewChange,
  loading,
  error,
  offline = false,
  onRetry,
  itemErrors = {},
  onRetryItem,
  onKeep,
  onSkipWeek,
  onAllocate,
  onComplete,
  onCancel,
  onMigrateNamedDay,
  onChooseDestination,
}: WeeklyDecisionListProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [lastActed, setLastActed] = useState<{ id: string; index: number } | null>(null)

  // Continuidade de foco (AC5): quando o item agido SOME da lista (decisão
  // persistida, fonte revalidada), foca a próxima pendência na MESMA posição
  // — ou o heading da fonte, ao esgotar. Roda só quando `items` muda de fato.
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

  function allocate(templateId: string) {
    if (offline) return
    onAllocate(templateId)
  }

  const actions = WEEKLY_RITUAL_SOURCE_ACTIONS[sourceId]
  const groupedByDay = sourceId === 'pending-dailies'
  const groupLabels = groupedByDay ? [...new Set(items.map((item) => item.groupLabel ?? ''))] : [undefined]

  return (
    <Box component="section" aria-label={`Decisões — ${WEEKLY_RITUAL_SOURCE_LABEL[sourceId]}`} aria-busy={loading || undefined}>
      <Box
        component="h2"
        ref={headingRef}
        tabIndex={-1}
        sx={{ ...typography['section-title'], color: 'var(--ds-ink)', outline: 'none' }}
      >
        {WEEKLY_RITUAL_SOURCE_LABEL[sourceId]}
      </Box>

      <Box role="group" aria-label="Alternar entre pendentes e tudo" sx={{ display: 'flex', gap: 'var(--ds-space-1)', mb: 'var(--ds-space-2)' }}>
        <Button
          aria-pressed={view === 'pending'}
          onClick={() => onViewChange('pending')}
          size="small"
        >
          Pendentes de decisão
        </Button>
        <Button aria-pressed={view === 'all'} onClick={() => onViewChange('all')} size="small">
          Tudo
        </Button>
      </Box>

      {error && (
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)', mb: 'var(--ds-space-2)' }}>
          Não foi possível carregar esta fonte.{' '}
          <Button onClick={onRetry} size="small">
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
        groupLabels.map((groupLabel) => (
          <Box key={groupLabel ?? 'ungrouped'}>
            {groupedByDay && groupLabel && (
              <Box sx={{ ...typography.label, color: 'var(--ds-ink-muted)', mt: 'var(--ds-space-2)' }}>
                {formatDayLabel(groupLabel, 'day-month')}
              </Box>
            )}
            {items
              .filter((item) => !groupedByDay || item.groupLabel === groupLabel)
              .map((item, index) => {
                const destinationDate = item.scheduledDate
                  ? addDaysIso(weekStart, weekdayIndexOf(item.scheduledDate))
                  : weekStart
                const destinationLabel = formatDayLabel(destinationDate, 'weekday')

                const itemError = itemErrors[item.id]

                return (
                  <Box
                    key={item.id}
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
                      gap: 'var(--ds-space-2)',
                      padding: 'var(--ds-space-2)',
                      borderBottom: '1px solid var(--ds-border)',
                    }}
                  >
                    <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>{item.title}</Box>
                    <Box sx={{ display: 'flex', gap: 'var(--ds-space-1)', flexWrap: 'wrap' }}>
                      {actions.includes('keep') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onKeep(item.id))}>
                          {WEEKLY_RITUAL_ACTION_LABEL.keep}
                        </Button>
                      )}
                      {actions.includes('skip_week') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onSkipWeek(item.id))}>
                          {WEEKLY_RITUAL_ACTION_LABEL.skip_week}
                        </Button>
                      )}
                      {actions.includes('allocate') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onAllocate(item.id))}>
                          {WEEKLY_RITUAL_ACTION_LABEL.allocate}
                        </Button>
                      )}
                      {actions.includes('migrate_named_day') && (
                        <Button
                          size="small"
                          aria-disabled={offline}
                          onClick={() => actOn(item.id, index, () => onMigrateNamedDay(item.id, destinationDate))}
                        >
                          {WEEKLY_RITUAL_ACTION_LABEL.migrate_named_day} {destinationLabel}
                        </Button>
                      )}
                      {actions.includes('choose_destination') && (
                        <Button size="small" aria-disabled={offline} onClick={() => chooseDestination(item.id)}>
                          {WEEKLY_RITUAL_ACTION_LABEL.choose_destination}
                        </Button>
                      )}
                      {actions.includes('complete') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onComplete(item.id))}>
                          {WEEKLY_RITUAL_ACTION_LABEL.complete}
                        </Button>
                      )}
                      {actions.includes('cancel') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onCancel(item.id))}>
                          {WEEKLY_RITUAL_ACTION_LABEL.cancel}
                        </Button>
                      )}
                    </Box>
                    {itemError && (
                      <Box
                        role="alert"
                        sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', width: '100%', ...typography.meta, color: 'var(--ds-danger)' }}
                      >
                        <Box component="span">{itemError}</Box>
                        <Button size="small" onClick={() => onRetryItem?.(item.id)}>
                          Tentar novamente
                        </Button>
                      </Box>
                    )}
                  </Box>
                )
              })}
          </Box>
        ))}

      {sourceId === 'recurring' && alreadyPlacedItems.length > 0 && (
        <Box component="section" aria-label="Já alocados (fora do progresso)" sx={{ mt: 'var(--ds-space-3)' }}>
          <Box sx={{ ...typography.label, color: 'var(--ds-ink-muted)' }}>Já alocados</Box>
          {alreadyPlacedItems.map((item) => (
            <Box
              key={item.id}
              sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)', padding: 'var(--ds-space-2)', borderBottom: '1px solid var(--ds-border)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{item.title}</Box>
                <Button size="small" aria-disabled={offline} onClick={() => allocate(item.id)}>
                  {WEEKLY_RITUAL_ACTION_LABEL.allocate}
                </Button>
              </Box>
              {itemErrors[item.id] && (
                <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', ...typography.meta, color: 'var(--ds-danger)' }}>
                  <Box component="span">{itemErrors[item.id]}</Box>
                  <Button size="small" onClick={() => onRetryItem?.(item.id)}>
                    Tentar novamente
                  </Button>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
