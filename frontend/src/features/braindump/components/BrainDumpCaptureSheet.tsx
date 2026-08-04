// ─────────────────────────────────────────────────────────────────────────────
// Capture Sheet — captura persistente do shell novo (Story 15.2 — M11).
//
//   ▶ Variante responsiva Dialog(ponteiro, ~400px)/Drawer(compact, 80vh), MESMO
//     padrão de `BrainDumpItemSheet.tsx` (`compact` prop, `shellCssVariables
//     ('light')` em `slotProps.paper.style`, inputs brutos com um
//     `FIELD_INPUT_STYLE` local — nunca cor de tema MUI crua).
//   ▶ `compact = true` como default: preserva o único consumidor que nunca
//     passa a prop (`BottomNav.tsx`, mobile-only por natureza, congelado).
//     `ShellLayout.tsx` passa `compact={isCompact}` explicitamente por ser o
//     único chamador que alterna entre as duas variantes.
//   ▶ Fecha ao SALVAR com sucesso (sem limpar+refocar para a próxima
//     captura) — DESIGN.md "Fluxo 3" e `story-15.0-brain-dump.md` §4 vencem
//     sobre a leitura solta do epic-15-context (que descreve o formulário DA
//     PÁGINA Inbox, não este sheet — ver Design Notes da spec).
//   ▶ "Cancelar" (só no ponteiro) passa pela MESMA guarda de fechamento que
//     X/Esc/backdrop — nunca um atalho que pula a confirmação de descarte.
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useRef, useState, type FormEvent } from 'react'
import { Box, Button, Dialog, DialogActions, DialogTitle, Drawer, Typography } from '@mui/material'

import { useCreateBrainDumpItemMutation } from '../api'
import { TARGET_LOG_OPTIONS } from './BrainDumpCaptureForm'
import { shellCssVariables, typography } from '../../../shared/design/tokens'
import type { BrainDumpTargetLog } from '../types'

const DESTINATION_HINT = 'Fica no Brain Dump até ser processado.'
const WRITE_ERROR = 'Não foi possível salvar. Tente novamente.'

const FIELD_INPUT_STYLE = {
  ...typography.body,
  padding: 'var(--ds-space-2)',
  border: '1px solid var(--ds-control-border)',
  borderRadius: 'var(--ds-radius-sm)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-ink)',
  minHeight: 'var(--ds-touch-target-min)',
} as const

export interface BrainDumpCaptureSheetProps {
  open: boolean
  onClose: () => void
  /**
   * Compact (<768px): Drawer subindo do fundo, até 80vh, sem "Cancelar" (uma
   * única ação primária). Ponteiro (wide/medium/tablet): Dialog ~400px com
   * "Cancelar" ao lado de "Salvar no Brain Dump". Default `true` preserva o
   * único consumidor que nunca passa a prop (`BottomNav.tsx`, congelado).
   */
  compact?: boolean
  disabled?: boolean
  disabledReason?: string
}

export function BrainDumpCaptureSheet({
  open,
  onClose,
  compact = true,
  disabled = false,
  disabledReason,
}: BrainDumpCaptureSheetProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetLog, setTargetLog] = useState<BrainDumpTargetLog | ''>('')
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const continueEditingRef = useRef<HTMLButtonElement>(null)
  const createItem = useCreateBrainDumpItemMutation()

  const offlineId = useId()

  function resetFields() {
    setTitle('')
    setDescription('')
    setTargetLog('')
    createItem.reset()
  }

  // Único ponto de fechamento sem salvar — X, Esc, backdrop E "Cancelar"
  // (ponteiro) convergem todos aqui, mesma guarda de descarte em todas as
  // faixas (DESIGN.md:673).
  function requestClose() {
    if (title.trim()) {
      setConfirmDiscardOpen(true)
      return
    }
    resetFields()
    onClose()
  }

  function confirmDiscard() {
    setConfirmDiscardOpen(false)
    resetFields()
    onClose()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    // O botão Salvar já fica `disabled` durante o envio/offline, mas o Enter
    // no Título contorna o botão — sem este guard, dois Enter rápidos
    // disparariam duas mutações e criariam itens duplicados.
    if (!trimmedTitle || createItem.isPending || disabled) return
    createItem.mutate(
      { title: trimmedTitle, description: description.trim() || undefined, targetLog: targetLog || undefined },
      {
        onSuccess: () => {
          resetFields()
          onClose()
        },
      },
    )
  }

  // `role="dialog"`/`aria-label` só no CONTEÚDO quando a faixa é compact
  // (Drawer): MUI Drawer não estampa `role="dialog"` sozinho, diferente de
  // MUI Dialog (que já estampa `role="dialog"` + `aria-modal` no próprio
  // Paper) — duplicar aqui para o Dialog criaria dois `role="dialog"`
  // aninhados, o de fora sem nome acessível (mesmo achado de review de
  // `BrainDumpItemSheet.tsx`). O Dialog recebe o nome via
  // `slotProps.paper['aria-label']` mais abaixo.
  const content = (
    <Box
      {...(compact ? { role: 'dialog' as const, 'aria-modal': true, 'aria-label': 'Captura rápida' } : {})}
      aria-busy={createItem.isPending}
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}
    >
      <Box component="header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
          Captura rápida
        </Box>
        <Button
          onClick={requestClose}
          aria-label="Fechar"
          sx={{ minWidth: 'var(--ds-touch-target-min)', minHeight: 'var(--ds-touch-target-min)', color: 'var(--ds-ink-muted)' }}
        >
          ×
        </Button>
      </Box>

      <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
        <span style={{ ...typography.label }}>Título</span>
        <input
          ref={titleRef}
          aria-label="Título"
          // Foco inicial (AC #1) tem dois mecanismos complementares: o
          // `autoFocus` cobre a montagem imediata (o que jsdom exercita no
          // teste unitário), e o `onEntered` do slot de transição abaixo
          // refoca ao fim da animação de entrada — necessário porque o
          // FocusTrap do Modal rouba o foco do autoFocus durante a transição
          // no browser real (mesmo achado do componente legado).
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          required
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          style={FIELD_INPUT_STYLE}
        />
      </Box>

      <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
        <span style={{ ...typography.label }}>Descrição</span>
        <textarea
          aria-label="Descrição"
          value={description}
          disabled={disabled}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          style={{ ...FIELD_INPUT_STYLE, resize: 'vertical' }}
        />
      </Box>

      <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
        <span style={{ ...typography.label }}>Destino</span>
        <select
          aria-label="Destino"
          value={targetLog}
          disabled={disabled}
          onChange={(event) => setTargetLog(event.target.value as BrainDumpTargetLog | '')}
          style={FIELD_INPUT_STYLE}
        >
          {TARGET_LOG_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Dica junto ao campo Destino nas DUAS variantes (mockup B1/C2) —
            substitui o texto de rodapé do componente legado, que tinha a
            cópia errada e ficava no lugar errado. */}
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{DESTINATION_HINT}</Box>
      </Box>

      {createItem.isError && (
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
          {WRITE_ERROR}
        </Box>
      )}

      {disabled && disabledReason && (
        <Box id={offlineId} sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          {disabledReason}
        </Box>
      )}

      <Box
        component="footer"
        sx={{ display: 'flex', flexDirection: compact ? 'column' : 'row', gap: 'var(--ds-space-2)' }}
      >
        <Button
          type="submit"
          disabled={!title.trim() || createItem.isPending || disabled}
          aria-describedby={disabled && disabledReason ? offlineId : undefined}
          sx={{
            flex: compact ? undefined : 1,
            minHeight: 'var(--ds-touch-target-min)',
            backgroundColor: 'var(--ds-primary)',
            color: 'var(--ds-on-primary)',
            '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
            '&.Mui-disabled': { backgroundColor: 'var(--ds-surface-subtle)', color: 'var(--ds-ink-muted)' },
          }}
        >
          {createItem.isPending ? 'Salvando…' : 'Salvar no Brain Dump'}
        </Button>
        {/* "Cancelar" só no ponteiro — compact mantém uma única ação primária
            (mockup C2). Passa pela MESMA guarda de fechamento do X/Esc/backdrop. */}
        {!compact && (
          <Button
            onClick={requestClose}
            sx={{
              minHeight: 'var(--ds-touch-target-min)',
              border: '1px solid var(--ds-control-border)',
              color: 'var(--ds-ink)',
            }}
          >
            Cancelar
          </Button>
        )}
      </Box>
    </Box>
  )

  const confirmDiscardDialog = (
    <Dialog
      open={confirmDiscardOpen}
      onClose={() => setConfirmDiscardOpen(false)}
      slotProps={{
        paper: { style: shellCssVariables('light') },
        transition: { onEntered: () => continueEditingRef.current?.focus() },
      }}
    >
      <DialogTitle sx={{ color: 'var(--ds-ink)' }}>Descartar item?</DialogTitle>
      <Typography sx={{ px: 3, pb: 1, ...typography.body, color: 'var(--ds-ink-muted)' }}>
        O título preenchido será perdido.
      </Typography>
      <DialogActions>
        <Button
          ref={continueEditingRef}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onClick={() => setConfirmDiscardOpen(false)}
          sx={{ color: 'var(--ds-ink)' }}
        >
          Continuar editando
        </Button>
        <Button onClick={confirmDiscard} sx={{ color: 'var(--ds-danger)' }}>
          Descartar
        </Button>
      </DialogActions>
    </Dialog>
  )

  if (compact) {
    return (
      <>
        <Drawer
          anchor="bottom"
          open={open}
          onClose={requestClose}
          slotProps={{
            paper: {
              style: shellCssVariables('light'),
              sx: {
                maxHeight: '80vh',
                overflowY: 'auto',
                padding: 'var(--ds-space-3)',
                borderTopLeftRadius: 'var(--ds-radius-lg)',
                borderTopRightRadius: 'var(--ds-radius-lg)',
              },
            },
            transition: { onEntered: () => titleRef.current?.focus() },
          }}
        >
          {content}
        </Drawer>
        {confirmDiscardDialog}
      </>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        slotProps={{
          paper: {
            'aria-label': 'Captura rápida',
            'aria-busy': createItem.isPending,
            style: shellCssVariables('light'),
            sx: {
              width: 'min(400px, 90vw)',
              backgroundColor: 'var(--ds-surface)',
              border: '1px solid var(--ds-border)',
              borderRadius: 'var(--ds-radius-md)',
              padding: 'var(--ds-space-4)',
              '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' },
            },
          },
          transition: { onEntered: () => titleRef.current?.focus() },
        }}
      >
        {content}
      </Dialog>
      {confirmDiscardDialog}
    </>
  )
}
