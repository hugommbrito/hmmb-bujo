// ─────────────────────────────────────────────────────────────────────────────
// Brain Dump — Inbox do sistema novo (Story 15.1 — M11).
//
//   ▶ Padrão de página INBOX (`DESIGN.md#Brain Dump (Inbox)`): sem
//     Page/Period Header de stepper/status/período — ordem de leitura fixa
//     Panel Capturar → Section Header Pendências (com contagem) → lista.
//   ▶ Molde de convenção de `FutureBoardPage.tsx`/`RecurringLibraryPage.tsx`:
//     tokens (`var(--ds-*)`), `useOnlineStatus`, botão de retry com cor
//     explícita, skeleton preservando shell/header/capture, sem cor de tema
//     MUI crua.
//   ▶ Overlays de item (sheet de edição / seletor de destino) são estado do
//     PÁGINA, não da linha — mesmo padrão de `openCard`/`pendingMove` em
//     `RecurringLibraryPage.tsx`/`FutureBoardPage.tsx`: a linha só emite
//     `onEdit`/`onMove`/`onDiscard`, a página decide o que abre.
//   ▶ "Mover" a partir do SHEET (compact) fecha o sheet e abre o seletor de
//     destino no mesmo gesto — nunca empilham (`DESIGN.md#Brain Dump e
//     captura`). "Descartar" (linha OU sheet) executa direto, sem dialog.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Box, Button, useMediaQuery } from '@mui/material'

import {
  BrainDumpDestinationPicker,
  BrainDumpInboxCaptureForm,
  BrainDumpInboxItemRow,
  BrainDumpItemSheet,
  useBrainDumpItemsQuery,
  useDiscardBrainDumpItemMutation,
} from '../../features/braindump'
import type { BrainDumpItem } from '../../features/braindump'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

const READ_ERROR = 'Não foi possível carregar as pendências.'
const OFFLINE_REASON = 'Sem conexão. Esta ação exige rede.'
const DISCARD_ERROR = 'Não foi possível descartar o item. Tente novamente.'
// Único texto do estado vazio (uma frase, sem incentivo a conteúdo) — ver
// Boundaries & Constraints da spec.
const EMPTY_TEXT = 'Brain Dump vazio.'
const SKELETON_ROWS = 5

/** Cor EXPLÍCITA (achado real de axe em stories anteriores): o `primary` do
 * tema MUI é o teal de marca, abaixo de AA sobre `--ds-surface`. */
const RETRY_BUTTON_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
} as const

export function BrainDumpInboxPage() {
  const items = useBrainDumpItemsQuery()
  const discardItem = useDiscardBrainDumpItemMutation()
  const isOnline = useOnlineStatus()
  const isTabletUp = useMediaQuery(mediaQueries.tabletUp)
  const compact = !isTabletUp
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [editingItem, setEditingItem] = useState<BrainDumpItem | null>(null)
  const [movingItem, setMovingItem] = useState<BrainDumpItem | null>(null)
  const [discardError, setDiscardError] = useState<string | null>(null)
  // Guarda o elemento que abriu o sheet (achado de review): o sheet é montado
  // condicionalmente (`{editingItem && <BrainDumpItemSheet .../>}`), então o
  // `Dialog`/`Drawer` do MUI nunca observa uma transição `open: true → false`
  // — o restore-de-foco embutido do MUI não dispara. Restaurado manualmente
  // em `closeEditSheet`, coberto pela I/O Matrix ("foco volta ao acionador").
  const editingTriggerRef = useRef<HTMLElement | null>(null)
  // Mesmo mecanismo para o seletor "Mover" (achado de review: o picker não
  // tinha NENHUM restore-de-foco, nem a partir do botão trailing da linha
  // nem a partir do encadeamento sheet→picker).
  const movingTriggerRef = useRef<HTMLElement | null>(null)

  // Foca o título a cada montagem — mesma decisão de simplicidade do legado
  // (`BrainDumpPage.tsx`, Task 10.2): custo zero, sem ramificar por origem da
  // navegação.
  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  function handleDiscard(item: BrainDumpItem) {
    setDiscardError(null)
    discardItem.mutate({ itemId: item.id }, { onError: () => setDiscardError(DISCARD_ERROR) })
  }

  function handleEditItem(item: BrainDumpItem) {
    editingTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditingItem(item)
  }

  function closeEditSheet() {
    setEditingItem(null)
    const trigger = editingTriggerRef.current
    editingTriggerRef.current = null
    // Síncrono: a linha (e seu botão `onActivate`) segue montada por baixo do
    // sheet, que é só um overlay — desmontar o sheet não afeta esse nó.
    trigger?.focus()
  }

  function handleMove(item: BrainDumpItem) {
    movingTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setMovingItem(item)
  }

  function closeMovePicker() {
    setMovingItem(null)
    const trigger = movingTriggerRef.current
    movingTriggerRef.current = null
    trigger?.focus()
  }

  function handleMoveFromSheet() {
    if (!editingItem) return
    const item = editingItem
    // Transfere o acionador ORIGINAL da linha (não o botão "Mover para um
    // log" do sheet, que desmonta no mesmo gesto) — o picker fecha de volta
    // para quem abriu o sheet, mesmo padrão de `editingTriggerRef`.
    movingTriggerRef.current = editingTriggerRef.current
    editingTriggerRef.current = null
    setEditingItem(null)
    setMovingItem(item)
  }

  function handleDiscardFromSheet() {
    if (!editingItem) return
    const item = editingItem
    closeEditSheet()
    handleDiscard(item)
  }

  const disabledReason = !isOnline ? OFFLINE_REASON : undefined

  return (
    <Box
      component="main"
      aria-label="Brain Dump"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-3)',
        maxWidth: 'var(--ds-reading-width)',
        mx: 'auto',
        width: '100%',
      }}
    >
      <Box component="header" sx={{ borderBottom: '1px solid var(--ds-border)', pb: 'var(--ds-space-3)' }}>
        <Box sx={{ ...typography['page-title'], color: 'var(--ds-ink)' }}>Brain Dump</Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>Caixa de entrada sem data</Box>
      </Box>

      <BrainDumpInboxCaptureForm ref={titleInputRef} disabled={!isOnline} disabledReason={disabledReason} />

      {items.isPending ? (
        <Box aria-hidden="true" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
            <Box
              key={index}
              sx={{
                height: 'var(--ds-task-row-min-height-pointer)',
                borderRadius: 'var(--ds-radius-sm)',
                backgroundColor: 'var(--ds-surface-subtle)',
              }}
            />
          ))}
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ds-space-2)' }}>
            <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
              Pendências
            </Box>
            {items.data && (
              <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', ml: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                {items.data.length} {items.data.length === 1 ? 'item' : 'itens'}
              </Box>
            )}
          </Box>

          {items.isError ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}>
              <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
                {READ_ERROR}
              </Box>
              <Button onClick={() => items.refetch()} sx={RETRY_BUTTON_SX}>
                Tentar de novo
              </Button>
            </Box>
          ) : items.data && items.data.length === 0 ? (
            <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{EMPTY_TEXT}</Box>
          ) : (
            <Box
              component="ul"
              aria-label="Itens do Brain Dump"
              sx={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                borderTop: '1px solid var(--ds-border)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {items.data?.map((item) => (
                <Box component="li" key={item.id}>
                  <BrainDumpInboxItemRow
                    item={item}
                    compact={compact}
                    disabled={!isOnline}
                    discarding={discardItem.isPending && discardItem.variables?.itemId === item.id}
                    onEdit={handleEditItem}
                    onMove={handleMove}
                    onDiscard={handleDiscard}
                  />
                </Box>
              ))}
            </Box>
          )}

          {discardError && (
            <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
              {discardError}
            </Box>
          )}
        </>
      )}

      {editingItem && (
        <BrainDumpItemSheet
          key={editingItem.id}
          item={editingItem}
          compact={compact}
          disabled={!isOnline}
          disabledReason={disabledReason}
          onClose={closeEditSheet}
          onMove={handleMoveFromSheet}
          onDiscard={handleDiscardFromSheet}
        />
      )}

      {movingItem && (
        <BrainDumpDestinationPicker
          key={movingItem.id}
          item={movingItem}
          compact={compact}
          disabled={!isOnline}
          onClose={closeMovePicker}
        />
      )}
    </Box>
  )
}
