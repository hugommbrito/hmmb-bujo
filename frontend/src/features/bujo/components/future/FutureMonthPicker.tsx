// ─────────────────────────────────────────────────────────────────────────────
// Seletor "Ir para mês…" (Story 14.7, AC1/AC7 — M08).
//
//   ▶ Lista SÓ os meses ALÉM do horizonte que têm item, agrupados por ano e com
//     a contagem de cada um. Escolher um leva o foco àquele mês SEM que o
//     trilho cresça — o horizonte é fixo por definição.
//   ▶ Sem nenhum mês distante com item, mostra o estado vazio do mockup
//     (frame B), que orienta à captura POR DATA — é assim que um mês distante
//     passa a existir aqui.
//   ▶ Compact abre em sheet (`Drawer`), desktop em `Dialog` — as duas
//     superfícies contêm foco e devolvem o foco ao acionador ao fechar (MUI).
//   ▶ O papel e o nome do overlay vão no SLOT `paper`, nunca no componente:
//     `aria-label` posto em `<Dialog>`/`<Drawer>` cai no root `role="presentation"`
//     do Modal, deixando o overlay anônimo (e, no `Drawer`, sem `role="dialog"`
//     nenhum, porque só o `Dialog` põe o papel no paper por conta própria).
//     Achado do passo de QA desta story; o `MonthlyDestinationPicker` — o outro
//     overlay desta mesma superfície — já se expunha nomeado.
// ─────────────────────────────────────────────────────────────────────────────
import { Box, Dialog, Drawer } from '@mui/material'

import { formatMonthTitle, groupDistantByYear } from './futureHorizon'
import { shellCssVariables, typography } from '../../../../shared/design/tokens'
import type { FutureLogMonthCount } from '../../types'

export interface FutureMonthPickerProps {
  distant: readonly FutureLogMonthCount[]
  /** Último mês do horizonte — nomeado na cópia do estado vazio. */
  lastHorizonMonthFirst: string
  compact?: boolean
  onSelect: (monthFirst: string) => void
  onClose: () => void
}

export function FutureMonthPicker({
  distant,
  lastHorizonMonthFirst,
  compact = false,
  onSelect,
  onClose,
}: FutureMonthPickerProps) {
  const groups = groupDistantByYear(distant)

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-2)',
        padding: 'var(--ds-space-3)',
        minWidth: 0,
      }}
    >
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>Ir para mês</Box>
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
        Meses além do horizonte que têm itens.
      </Box>

      {groups.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
            {`Nada capturado além de ${formatMonthTitle(lastHorizonMonthFirst)}.`}
          </Box>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
            Use o campo de captura com uma data para registrar mais adiante.
          </Box>
        </Box>
      ) : (
        groups.map((group) => (
          <Box key={group.year} sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
            <Box
              component="h3"
              sx={{ ...typography.label, color: 'var(--ds-ink-muted)', margin: 0 }}
            >
              {group.year}
            </Box>
            <Box
              component="ul"
              aria-label={`Meses de ${group.year}`}
              sx={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}
            >
              {group.months.map((month) => (
                <Box component="li" key={month.monthFirst}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onSelect(month.monthFirst)}
                    sx={{
                      ...typography.body,
                      width: '100%',
                      minHeight: 'var(--ds-touch-target-min)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--ds-space-3)',
                      textAlign: 'left',
                      padding: 'var(--ds-space-1) var(--ds-space-2)',
                      border: '1px solid var(--ds-control-border)',
                      borderRadius: 'var(--ds-radius-sm)',
                      backgroundColor: 'var(--ds-surface)',
                      color: 'var(--ds-ink)',
                      cursor: 'pointer',
                    }}
                  >
                    <Box component="span">{formatMonthTitle(month.monthFirst)}</Box>
                    <Box component="span" sx={{ ...typography.label, fontVariantNumeric: 'tabular-nums' }}>
                      {month.taskCount === 1 ? '1 item' : `${month.taskCount} itens`}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  )

  if (compact) {
    return (
      <Drawer
        anchor="bottom"
        open
        onClose={onClose}
        slotProps={{
          paper: {
            // O `Drawer` não põe papel nenhum no paper — sem isto o sheet não
            // existe como overlay para a árvore de acessibilidade.
            role: 'dialog',
            'aria-label': 'Ir para mês',
            style: shellCssVariables('light'),
            sx: { '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' } },
          },
          backdrop: { style: shellCssVariables('light') },
        }}
      >
        {content}
      </Drawer>
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      slotProps={{
        paper: {
          // O paper do `Dialog` já é o `role="dialog"`; o nome tem que vir
          // AQUI para pousar no mesmo elemento que carrega o papel.
          'aria-label': 'Ir para mês',
          style: shellCssVariables('light'),
          sx: { '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' } },
        },
        backdrop: { style: shellCssVariables('light') },
      }}
    >
      {content}
    </Dialog>
  )
}
