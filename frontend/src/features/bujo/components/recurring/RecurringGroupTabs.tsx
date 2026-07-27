// ─────────────────────────────────────────────────────────────────────────────
// Abas por `recurrence_group` + filtro "Mostrar inativos" (Story 14.8, AC1/AC6).
//
//   ▶ CONTAGEM DERIVADA DA MESMA LISTA que o painel renderiza: quem chama passa
//     `counts` já vindo de `visibleByGroup()`. Ligar "Mostrar inativos" muda os
//     três números porque muda a lista — não porque exista um segundo cálculo.
//
//   ▶ A contagem é ANUNCIADA EM TEXTO (AC6): "Semanal (4)" está no conteúdo do
//     próprio `role="tab"`, nunca só num chip colorido. O nome acessível
//     computa do conteúdo (sem `aria-label` divergindo do texto visível), o que
//     também mantém os locators `getByRole('tab', { name: 'Mensal' })` dos
//     specs legados casando por substring.
//
//   ▶ PAPEL DO FILTRO — DECISÃO DELIBERADA E REGISTRADA (Questão aberta #1):
//     fica `role="checkbox"` (MUI `Switch` renderiza um `input type="checkbox"`
//     real), NÃO o `role="switch"` que o mockup desenha. Três razões:
//       1. `EXPERIENCE.md` NÃO fixa o papel; só o mockup fixa, e ele o desenha
//          num `<button>` — é esboço de ARIA, não contrato de plataforma.
//       2. `checkbox` é a semântica NATIVA do controle e preserva 3 asserts
//          vivos em dois specs E2E (`recurring-templates.spec.ts:115`,
//          `recurring-soft-delete.spec.ts:179,195`) sem perder nada.
//       3. O visual do mockup (switch) é preservado — só o papel ARIA difere, e
//          `checkbox` é conforme para um alternador binário.
//     Se o papel MUDAR um dia, os três asserts são atualizados no mesmo commit.
//
//   ▶ Compact: a faixa de abas rola HORIZONTALMENTE dentro de si (AC1) — o
//     conteúdo da página nunca ganha scroll horizontal.
//
// [Source: mockups/key-recurrentes.html frame A/D; DESIGN.md#Recorrentes L647-655]
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, type KeyboardEvent } from 'react'
import { Box, FormControlLabel, Switch } from '@mui/material'

import {
  RECURRENCE_GROUPS,
  RECURRENCE_GROUP_LABEL,
  tabIdOf,
  tabPanelIdOf,
} from './recurringLibrary'
import { typography } from '../../../../shared/design/tokens'
import type { RecurrenceGroup } from '../../types'

export const TABLIST_LABEL = 'Grupo de recorrência'
export const SHOW_INACTIVE_LABEL = 'Mostrar inativos'

export interface RecurringGroupTabsProps {
  activeGroup: RecurrenceGroup
  /** Contagem por grupo, derivada da MESMA lista filtrada que o painel mostra. */
  counts: Record<RecurrenceGroup, number>
  showInactive: boolean
  compact?: boolean
  onSelectGroup: (group: RecurrenceGroup) => void
  onToggleShowInactive: (next: boolean) => void
}

export function RecurringGroupTabs({
  activeGroup,
  counts,
  showInactive,
  compact = false,
  onSelectGroup,
  onToggleShowInactive,
}: RecurringGroupTabsProps) {
  const tabRefs = useRef<(HTMLElement | null)[]>([])

  // Navegação por seta entre abas (AC6), com wrap — o padrão APG de `tablist`.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !backward) return
    event.preventDefault()
    const currentIndex = RECURRENCE_GROUPS.indexOf(activeGroup)
    const delta = forward ? 1 : -1
    const nextIndex = (currentIndex + delta + RECURRENCE_GROUPS.length) % RECURRENCE_GROUPS.length
    onSelectGroup(RECURRENCE_GROUPS[nextIndex])
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--ds-space-2)',
        flexWrap: compact ? 'wrap' : 'nowrap',
      }}
    >
      <Box
        role="tablist"
        aria-label={TABLIST_LABEL}
        onKeyDown={handleKeyDown}
        sx={{
          display: 'flex',
          gap: 'var(--ds-space-1)',
          minWidth: 0,
          // Compact: a faixa rola dentro de si — o conteúdo da página não rola.
          overflowX: compact ? 'auto' : 'visible',
          flexWrap: 'nowrap',
        }}
      >
        {RECURRENCE_GROUPS.map((group, index) => {
          const selected = group === activeGroup
          return (
            <Box
              key={group}
              component="button"
              type="button"
              role="tab"
              ref={(el: HTMLElement | null) => {
                tabRefs.current[index] = el
              }}
              id={tabIdOf(group)}
              aria-selected={selected}
              // SÓ na aba selecionada: apenas o painel ATIVO é montado (as
              // outras duas listas não existem no DOM), e `aria-controls`
              // apontando para um id inexistente é violação REAL de
              // `aria-valid-attr-value` — a mesma classe do CRITICAL que a 14.6
              // levou. O APG permite omitir em tabs de painel lazy.
              aria-controls={selected ? tabPanelIdOf(group) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelectGroup(group)}
              sx={{
                ...typography.label,
                flex: '0 0 auto',
                minHeight: 'var(--ds-touch-target-min)',
                px: 'var(--ds-space-3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: 'none',
                border: 'none',
                borderBottom: '2px solid',
                borderBottomColor: selected ? 'var(--ds-primary)' : 'transparent',
                color: selected ? 'var(--ds-ink)' : 'var(--ds-ink-muted)',
              }}
            >
              {`${RECURRENCE_GROUP_LABEL[group]} (${counts[group]})`}
            </Box>
          )
        })}
      </Box>

      <FormControlLabel
        sx={{ flex: '0 0 auto', margin: 0, ...typography.label, color: 'var(--ds-ink)' }}
        control={
          <Switch
            checked={showInactive}
            onChange={(event) => onToggleShowInactive(event.target.checked)}
          />
        }
        label={SHOW_INACTIVE_LABEL}
      />
    </Box>
  )
}
