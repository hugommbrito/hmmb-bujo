// ─────────────────────────────────────────────────────────────────────────────
// Sheet responsivo de edição do item do Brain Dump (Story 15.1 — M11; edição
// paritária decidida na promoção da 15.0, Q1).
//
//   ▶ MESMO componente nas duas faixas (Design Notes da spec): no compact
//     reúne Mover + Descartar + os 3 campos de edição (`compact=true` — os
//     botões trailing da linha não existem nessa faixa); no ponteiro
//     (wide/medium/tablet) expõe só os 3 campos, porque Mover/Descartar já
//     são botões trailing sempre visíveis na linha
//     (`BrainDumpInboxItemRow`).
//   ▶ Confirmação de descarte usa DIRTY-CHECK (valor atual ≠ valor
//     carregado) — nunca "tem texto", que é o estado normal de um item já
//     existente (diferente do Capture Sheet, que dispara por texto
//     preenchido). Fechar sem alteração fecha direto, sem dialog.
//   ▶ Salvar é NÃO-OTIMISTA (`useUpdateBrainDumpItemMutation`): a linha só
//     atualiza após confirmação do servidor. Falha preserva os 3 campos e
//     mantém o sheet aberto, com erro junto à ação (retry = reenviar).
//   ▶ Mover/Descartar (só no compact) executam de IMEDIATO — sem dirty-check
//     próprio: são atos NOMEADOS, não um "fechar" genérico. Descartar em
//     particular nunca abre dialog (paridade deliberada com o legado).
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useRef, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogTitle, Drawer, Typography } from '@mui/material'

import { useUpdateBrainDumpItemMutation } from '../api'
import { TARGET_LOG_OPTIONS } from './BrainDumpCaptureForm'
import { shellCssVariables, typography } from '../../../shared/design/tokens'
import { formatDayLabel, isoOf } from '../../../shared/date'
import type { BrainDumpItem, BrainDumpTargetLog } from '../types'

const TITLE_REQUIRED = 'Informe um título.'
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

const TARGET_LOG_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  TARGET_LOG_OPTIONS.filter((option) => option.value).map((option) => [option.value, option.label]),
)

/** Normaliza descrição para comparação dirty-check/patch: `''`/espaços e
 * `null`/`undefined` são o MESMO valor ("sem descrição") — sem isso, um item
 * cuja descrição gravada é `''` (`allow_blank=True` no serializer) comparava
 * `'' → null` (lado atual, via `.trim() || null`) contra `'' → ''` (lado
 * original, via `?? null` que só substitui em `null`/`undefined`) e reportava
 * dirty desde o carregamento (achado de review). Aplicada aos DOIS lados. */
function normalizedDescription(value: string | null | undefined): string | null {
  return value?.trim() || null
}

export interface BrainDumpItemSheetProps {
  item: BrainDumpItem
  /** Compact (<768px): reúne Mover + Descartar junto aos 3 campos, porque a
   * linha não tem botões trailing nessa faixa (Design Notes da spec). */
  compact?: boolean
  disabled?: boolean
  disabledReason?: string
  onClose: () => void
  /** Só chamado/renderizado no compact — pointer usa os botões trailing da linha. */
  onMove: () => void
  /** Idem — executa DIRETO, sem dialog (paridade com o legado). */
  onDiscard: () => void
}

export function BrainDumpItemSheet({
  item,
  compact = false,
  disabled = false,
  disabledReason,
  onClose,
  onMove,
  onDiscard,
}: BrainDumpItemSheetProps) {
  const updateItem = useUpdateBrainDumpItemMutation()

  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [targetLog, setTargetLog] = useState<BrainDumpTargetLog | ''>(item.targetLog ?? '')
  const [titleTouched, setTitleTouched] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const continueEditingRef = useRef<HTMLButtonElement>(null)

  const idPrefix = useId()
  const titleErrorId = `${idPrefix}-title-error`
  const offlineId = `${idPrefix}-offline`

  const trimmedTitle = title.trim()
  const titleError = trimmedTitle ? null : TITLE_REQUIRED
  const isDirty =
    trimmedTitle !== item.title ||
    normalizedDescription(description) !== normalizedDescription(item.description) ||
    (targetLog || null) !== (item.targetLog ?? null)

  // `?? null` é defensivo (mesmo achado de review de `BrainDumpInboxItemRow`):
  // um `target_log` fora das 4 chaves conhecidas cai em `undefined` na
  // indexação — sem o fallback renderizaria "Dica: undefined" em vez de
  // simplesmente omitir a dica.
  const targetLogHint = item.targetLog ? (TARGET_LOG_LABEL_BY_VALUE[item.targetLog] ?? null) : null
  // `createdAt` é um INSTANTE ISO completo (UTC), não campo DATE — fatiar e
  // tratar como data local desloca o dia em fusos negativos à noite (mesmo
  // achado de `BrainDumpInboxItemRow`). `new Date` + `isoOf` convertem para
  // hora LOCAL antes de formatar.
  const metaLine = [
    `Capturado em ${formatDayLabel(isoOf(new Date(item.createdAt)), 'day-month')}`,
    targetLogHint ? `Dica: ${targetLogHint}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Fechar (X/Esc/backdrop) descarta direto SE não houver alteração não salva
  // vs. o valor carregado; caso contrário, pede confirmação (dirty-check —
  // nunca "tem texto", que é o normal de um item existente).
  function requestClose() {
    // Um Salvar já em voo NÃO pode ser abortado (`useMutation` não cancela no
    // unmount) — sem este guard, confirmar "Descartar alterações?" durante o
    // pending desmonta o sheet, mas o PATCH já disparado ainda pode ter
    // sucesso no servidor, contradizendo o descarte que o usuário pediu
    // (achado de review).
    if (updateItem.isPending) return
    if (isDirty) {
      setConfirmDiscardOpen(true)
      return
    }
    onClose()
  }

  function handleSave() {
    if (titleError) {
      setTitleTouched(true)
      return
    }
    if (disabled || updateItem.isPending || !isDirty) return
    setWriteError(null)

    const patch: { title?: string; description?: string | null; targetLog?: BrainDumpTargetLog | null } = {}
    if (trimmedTitle !== item.title) patch.title = trimmedTitle
    if (normalizedDescription(description) !== normalizedDescription(item.description)) {
      patch.description = normalizedDescription(description)
    }
    if ((targetLog || null) !== (item.targetLog ?? null)) patch.targetLog = targetLog || null

    updateItem.mutate(
      { itemId: item.id, ...patch },
      {
        onSuccess: onClose,
        onError: () => setWriteError(WRITE_ERROR),
      },
    )
  }

  // `role="dialog"`/`aria-label` só no CONTEÚDO quando a faixa é compact
  // (Drawer): MUI Drawer não estampa `role="dialog"` sozinho, diferente de
  // MUI Dialog (que já estampa `role="dialog"` + `aria-modal` no próprio
  // Paper) — duplicar aqui para o Dialog criaria dois `role="dialog"`
  // aninhados, o de fora sem nome acessível (achado de review). O Dialog
  // recebe o nome via `slotProps.paper['aria-label']` mais abaixo.
  const content = (
    <Box
      {...(compact ? { role: 'dialog' as const, 'aria-label': 'Item do Brain Dump' } : {})}
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}
    >
      <Box component="header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--ds-space-2)' }}>
        <Box>
          <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
            Item do Brain Dump
          </Box>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{metaLine}</Box>
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
          aria-label="Título"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => setTitleTouched(true)}
          aria-describedby={titleTouched && titleError ? titleErrorId : undefined}
          style={FIELD_INPUT_STYLE}
        />
        {titleTouched && titleError && (
          <Box id={titleErrorId} role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
            {titleError}
          </Box>
        )}
      </Box>

      <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
        <span style={{ ...typography.label }}>Descrição</span>
        <textarea
          aria-label="Descrição"
          value={description}
          disabled={disabled}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          style={{ ...FIELD_INPUT_STYLE, resize: 'vertical' }}
        />
      </Box>

      <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
        <span style={{ ...typography.label }}>Destino</span>
        <select
          aria-label="Destino"
          disabled={disabled}
          value={targetLog}
          onChange={(event) => setTargetLog(event.target.value as BrainDumpTargetLog | '')}
          style={FIELD_INPUT_STYLE}
        >
          {TARGET_LOG_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Box>

      {disabled && disabledReason && (
        <Box id={offlineId} sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          {disabledReason}
        </Box>
      )}

      {writeError && (
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
          {writeError}
        </Box>
      )}

      <Box component="footer" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
        <Button
          onClick={handleSave}
          disabled={disabled || updateItem.isPending || !isDirty || Boolean(titleError)}
          aria-describedby={disabled && disabledReason ? offlineId : undefined}
          sx={{
            minHeight: 'var(--ds-touch-target-min)',
            backgroundColor: 'var(--ds-primary)',
            color: 'var(--ds-on-primary)',
            '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
            '&.Mui-disabled': { backgroundColor: 'var(--ds-surface-subtle)', color: 'var(--ds-ink-muted)' },
          }}
        >
          {updateItem.isPending ? 'Salvando…' : 'Salvar'}
        </Button>

        {/* Mover/Descartar só existem AQUI no compact — no ponteiro já são
            botões trailing sempre visíveis na linha (Design Notes da spec). */}
        {compact && (
          <>
            <Button
              onClick={onMove}
              disabled={disabled}
              sx={{
                minHeight: 'var(--ds-touch-target-min)',
                border: '1px solid var(--ds-control-border)',
                color: 'var(--ds-ink)',
                '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
              }}
            >
              Mover para um log
            </Button>
            <Button
              onClick={onDiscard}
              disabled={disabled}
              sx={{
                minHeight: 'var(--ds-touch-target-min)',
                border: '1px solid var(--ds-danger)',
                color: 'var(--ds-danger)',
                '&.Mui-disabled': { color: 'var(--ds-ink-muted)', border: '1px solid var(--ds-control-border)' },
              }}
            >
              Descartar item
            </Button>
          </>
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
      <DialogTitle sx={{ color: 'var(--ds-ink)' }}>Descartar alterações?</DialogTitle>
      <Typography sx={{ px: 3, pb: 1, ...typography.body, color: 'var(--ds-ink-muted)' }}>
        As alterações não salvas neste item serão perdidas.
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
        <Button
          onClick={() => {
            setConfirmDiscardOpen(false)
            onClose()
          }}
          sx={{ color: 'var(--ds-danger)' }}
        >
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
          open
          onClose={requestClose}
          slotProps={{
            paper: {
              style: shellCssVariables('light'),
              sx: { padding: 'var(--ds-space-3)', maxHeight: '88vh', overflowY: 'auto' },
            },
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
        open
        onClose={requestClose}
        slotProps={{
          paper: {
            'aria-label': 'Item do Brain Dump',
            style: shellCssVariables('light'),
            sx: {
              width: 'min(480px, 90vw)',
              backgroundColor: 'var(--ds-surface)',
              border: '1px solid var(--ds-border)',
              borderRadius: 'var(--ds-radius-md)',
              padding: 'var(--ds-space-4)',
              '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' },
            },
          },
        }}
      >
        {content}
      </Dialog>
      {confirmDiscardDialog}
    </>
  )
}
