// ─────────────────────────────────────────────────────────────────────────────
// Lista de decisões do ritual mensal (Story 14.6, AC5) — a fonte ATIVA do
// rail, com o conjunto de ações por fonte (`MONTHLY_RITUAL_SOURCE_ACTIONS`),
// toggle Pendentes de decisão/Tudo e continuidade de foco (mesmo padrão da
// `WeeklyDecisionList`, 14.5): sucesso move o foco à PRÓXIMA pendência da
// mesma fonte; ao esgotar, ao heading da fonte.
//
//   ▶ Só `recurring` agrupa (Mensais primeiro, Lembrete anual depois — AC5) e
//     tem os 2 buckets FORA do progresso (`alreadyPlacedItems`/
//     `alreadyPlacedInYearItems`) — `future-log`/`previous-monthly` são listas
//     lineares.
//   ▶ `migrate_named_day` (atalho) preserva o MESMO NÚMERO de dia da origem,
//     com clamp para o mês-alvo mais curto (`sameDayOfMonthClamped`) — a
//     divergência mensal do "preservar o dia da semana" que o Weekly usa
//     (dias da semana não fazem sentido entre meses).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Box, Button } from '@mui/material'

import {
  MONTHLY_RITUAL_ACTION_LABEL,
  MONTHLY_RITUAL_SOURCE_ACTIONS,
  MONTHLY_RITUAL_SOURCE_LABEL,
  sameDayOfMonthClamped,
  type MonthlyRitualSourceId,
  type NormalizedRitualItem,
} from './monthlyRitualSources'
import { parseLocalDate } from '../../../../shared/date'
import { typography } from '../../../../shared/design/tokens'

/** Cor EXPLÍCITA (achado real do axe, DW-16): sem override, o MUI aplica
 * `theme.palette.primary` — o teal de marca LEGADO —, que fica em torno de
 * 2,4:1 sobre `--ds-surface`, abaixo do piso AA. O token novo `--ds-primary`
 * resolve LOCALMENTE, sem tocar `theme.ts`. Paridade com
 * `weekly/WeeklyDecisionList.tsx` e `migration/MigrationDecisionList.tsx`. */
const DECISION_BUTTON_SX = { color: 'var(--ds-primary)' } as const

export interface MonthlyDecisionListProps {
  sourceId: MonthlyRitualSourceId
  targetMonthFirst: string
  items: NormalizedRitualItem[]
  /** Só `recurring`: os 2 buckets FORA do progresso — mensal já alocado no mês
   * e anual já alocado no ano, permanentemente consultáveis para novas
   * instâncias conscientes (AC5). */
  alreadyPlacedItems?: NormalizedRitualItem[]
  alreadyPlacedInYearItems?: NormalizedRitualItem[]
  view: 'pending' | 'all'
  onViewChange: (view: 'pending' | 'all') => void
  loading: boolean
  error: boolean
  offline?: boolean
  onRetry: () => void
  itemErrors?: Record<string, string>
  onRetryItem?: (itemId: string) => void
  onAllocate: (templateId: string) => void
  onDeferToFutureLog: (id: string) => void
  onKeepUndated: (taskId: string) => void
  onComplete: (taskId: string) => void
  onCancel: (taskId: string) => void
  onMigrateNamedDay: (taskId: string, destinationDate: string) => void
  onChooseDestination: (taskId: string) => void
}

export function MonthlyDecisionList({
  sourceId,
  targetMonthFirst,
  items,
  alreadyPlacedItems = [],
  alreadyPlacedInYearItems = [],
  view,
  onViewChange,
  loading,
  error,
  offline = false,
  onRetry,
  itemErrors = {},
  onRetryItem,
  onAllocate,
  onDeferToFutureLog,
  onKeepUndated,
  onComplete,
  onCancel,
  onMigrateNamedDay,
  onChooseDestination,
}: MonthlyDecisionListProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [lastActed, setLastActed] = useState<{ id: string; index: number } | null>(null)

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

  const actions = MONTHLY_RITUAL_SOURCE_ACTIONS[sourceId]
  const groupedByRecurrence = sourceId === 'recurring'
  // Só grupos com item PRESENTE viram seção (mesmo padrão de
  // `WeeklyDecisionList`/pending-dailies: labels derivados dos itens, não uma
  // lista fixa) — sem isso, "Mensais"/"Lembrete anual" apareceriam vazios
  // mesmo depois do único item do grupo ser decidido/alocado.
  const groupLabels: (string | undefined)[] = groupedByRecurrence
    ? (['monthly', 'annual'] as const).filter((group) => items.some((item) => item.recurrenceGroup === group))
    : [undefined]
  const GROUP_TITLE: Record<string, string> = { monthly: 'Mensais', annual: 'Lembrete anual' }

  return (
    <Box component="section" aria-label={`Decisões — ${MONTHLY_RITUAL_SOURCE_LABEL[sourceId]}`} aria-busy={loading || undefined}>
      <Box
        component="h2"
        ref={headingRef}
        tabIndex={-1}
        sx={{ ...typography['section-title'], color: 'var(--ds-ink)', outline: 'none' }}
      >
        {MONTHLY_RITUAL_SOURCE_LABEL[sourceId]}
      </Box>

      <Box role="group" aria-label="Alternar entre pendentes e tudo" sx={{ display: 'flex', gap: 'var(--ds-space-1)', mb: 'var(--ds-space-2)' }}>
        <Button aria-pressed={view === 'pending'} onClick={() => onViewChange('pending')} size="small" sx={DECISION_BUTTON_SX}>
          Pendentes de decisão
        </Button>
        <Button aria-pressed={view === 'all'} onClick={() => onViewChange('all')} size="small" sx={DECISION_BUTTON_SX}>
          Tudo
        </Button>
      </Box>

      {error && (
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)', mb: 'var(--ds-space-2)' }}>
          Não foi possível carregar esta fonte.{' '}
          <Button onClick={onRetry} size="small" sx={DECISION_BUTTON_SX}>
            Tentar novamente
          </Button>
        </Box>
      )}

      {!error && items.length === 0 && alreadyPlacedItems.length === 0 && alreadyPlacedInYearItems.length === 0 && (
        <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
          {view === 'pending' ? 'Nenhuma pendência nesta fonte.' : 'Nada para mostrar ainda.'}
        </Box>
      )}

      {!error &&
        groupLabels.map((groupLabel) => (
          <Box key={groupLabel ?? 'ungrouped'}>
            {groupedByRecurrence && groupLabel && (
              <Box sx={{ ...typography.label, color: 'var(--ds-ink-muted)', mt: 'var(--ds-space-2)' }}>
                {GROUP_TITLE[groupLabel]}
              </Box>
            )}
            {items
              .filter((item) => !groupedByRecurrence || item.recurrenceGroup === groupLabel)
              .map((item, index) => {
                const destinationDate = sameDayOfMonthClamped(item.scheduledDate, targetMonthFirst)
                const destinationDay = parseLocalDate(destinationDate).getDate()
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
                      {actions.includes('allocate') && (
                        <Button size="small" aria-disabled={offline} onClick={() => allocate(item.id)} sx={DECISION_BUTTON_SX}>
                          {MONTHLY_RITUAL_ACTION_LABEL.allocate}
                        </Button>
                      )}
                      {actions.includes('keep_undated') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onKeepUndated(item.id))} sx={DECISION_BUTTON_SX}>
                          {MONTHLY_RITUAL_ACTION_LABEL.keep_undated}
                        </Button>
                      )}
                      {actions.includes('migrate_named_day') && (
                        <Button
                          size="small"
                          aria-disabled={offline}
                          onClick={() => actOn(item.id, index, () => onMigrateNamedDay(item.id, destinationDate))}
                          sx={DECISION_BUTTON_SX}
                        >
                          {MONTHLY_RITUAL_ACTION_LABEL.migrate_named_day} dia {destinationDay}
                        </Button>
                      )}
                      {actions.includes('choose_destination') && (
                        <Button size="small" aria-disabled={offline} onClick={() => chooseDestination(item.id)} sx={DECISION_BUTTON_SX}>
                          {MONTHLY_RITUAL_ACTION_LABEL.choose_destination}
                        </Button>
                      )}
                      {actions.includes('complete') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onComplete(item.id))} sx={DECISION_BUTTON_SX}>
                          {MONTHLY_RITUAL_ACTION_LABEL.complete}
                        </Button>
                      )}
                      {actions.includes('cancel') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onCancel(item.id))} sx={DECISION_BUTTON_SX}>
                          {MONTHLY_RITUAL_ACTION_LABEL.cancel}
                        </Button>
                      )}
                      {actions.includes('defer_to_future_log') && (
                        <Button size="small" aria-disabled={offline} onClick={() => actOn(item.id, index, () => onDeferToFutureLog(item.id))} sx={DECISION_BUTTON_SX}>
                          {MONTHLY_RITUAL_ACTION_LABEL.defer_to_future_log}
                        </Button>
                      )}
                    </Box>
                    {itemError && (
                      <Box
                        role="alert"
                        sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', width: '100%', ...typography.meta, color: 'var(--ds-danger)' }}
                      >
                        <Box component="span">{itemError}</Box>
                        <Button size="small" onClick={() => onRetryItem?.(item.id)} sx={DECISION_BUTTON_SX}>
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
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--ds-space-2)', borderBottom: '1px solid var(--ds-border)' }}
            >
              <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{item.title}</Box>
              <Button size="small" aria-disabled={offline} onClick={() => allocate(item.id)} sx={DECISION_BUTTON_SX}>
                Alocar outra instância
              </Button>
            </Box>
          ))}
        </Box>
      )}

      {sourceId === 'recurring' && alreadyPlacedInYearItems.length > 0 && (
        <Box component="section" aria-label="Já alocados no ano (fora do progresso)" sx={{ mt: 'var(--ds-space-3)' }}>
          <Box sx={{ ...typography.label, color: 'var(--ds-ink-muted)' }}>Já alocados no ano</Box>
          {alreadyPlacedInYearItems.map((item) => (
            <Box
              key={item.id}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--ds-space-2)', borderBottom: '1px solid var(--ds-border)' }}
            >
              <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{item.title}</Box>
              <Button size="small" aria-disabled={offline} onClick={() => allocate(item.id)} sx={DECISION_BUTTON_SX}>
                Alocar outra instância
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
