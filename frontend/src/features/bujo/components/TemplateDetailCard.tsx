// ─────────────────────────────────────────────────────────────────────────────
// Detalhe canônico do TEMPLATE RECORRENTE (Story 14.8, AC3; UX-DR24/UX-DR26).
//
//   ▶ IRMÃO de `TaskDetailCard.tsx`, não um fork: mesma anatomia de card
//     (header com título + subtítulo + Fechar, corpo, rodapé) e os DOIS
//     controles canônicos COMPARTILHADOS (`CategorySwatchGroup` /
//     `EisenhowerCheckboxPair`, extraídos na Task 1). Reusar o
//     `TaskDetailCard` diretamente é impossível: ele é tipado sobre `Task`, e
//     template não tem `status`, `logId`, `subtasks`, `migratedToTask` nem
//     `orderIndex` — e TEM dois campos que tarefa nenhuma tem
//     (`recurrenceGroup`, `recurrenceText`). Fabricar um `Task` sintético para
//     satisfazer o tipo seria o caminho curto para um bug silencioso.
//
//   ▶ CRIAR E EDITAR SÃO O MESMO CARD (paridade), diferindo em EXATAMENTE três
//     pontos: o rótulo do primário (Criar × Salvar), o Grupo (editável ×
//     readonly) e o rodapé (criação = primário + nota; edição = Salvar +
//     Ativar/Desativar + Excluir).
//
//   ▶ `onClose` × `onSaved` são callbacks SEPARADOS de propósito: `onClose` é
//     só fechar/cancelar (descarta o rascunho), `onSaved` é só "a ação-alvo foi
//     concluída". Reaproveitar um `onClose` único para os dois eventos foi
//     achado HIGH de code-review na Story 11.6.
//
//   ▶ VALIDAÇÃO: o legado abortava em SILÊNCIO (`if (!t || !r) return`) — fechar
//     essa lacuna é delta contratado do M09. O primário fica indisponível
//     enquanto faltar título ou recorrência, DESCRITO pelo motivo
//     (`aria-describedby`), e o motivo do campo aparece em `role="alert"` depois
//     que o campo foi tocado (anunciar erro num formulário recém-aberto, antes
//     de qualquer interação, é ruído para leitor de tela).
//
//   ▶ DELTA SILENCIOSO REGISTRADO (Dev Notes): o checkbox "Ativo" da criação
//     legada SOME. Todo template passa a nascer `active: true` — é o que o
//     mockup (frame B) especifica, e criar um template já desativado não tem
//     caso de uso. Ativar/Desativar continua existindo, só na EDIÇÃO.
//
//   ▶ `recurrenceGroup` readonly na edição é contrato de UI, NÃO de API: o
//     `RecurringTaskTemplateUpdateSerializer` continua aceitando o campo no
//     PATCH (endurecê-lo mudaria o contrato de um endpoint que o legado ainda
//     consome). O cliente simplesmente nunca o envia no PATCH — Questão
//     aberta #3, candidata ao Épico 18.
//
//   ▶ Faixa compact: segue `Dialog` do MUI como o irmão `TaskDetailCard`, e não
//     o sheet que o `DESIGN.md` L651 pede. Adotar sheet só aqui criaria
//     assimetria entre os dois cards irmãos; adotar nos dois é refatoração de
//     três superfícies já entregues. Divergência registrada (Questão aberta #2).
//
// [Source: DESIGN.md#Recorrentes (Coleção) L647-655, #Task Row L671-681;
//  mockups/key-recorrentes.html frame B; .decision-log.md 2026-07-21 Revisão 2 Q1]
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Box, Button, Dialog } from '@mui/material'

import {
  useCreateRecurringTemplateMutation,
  useUpdateRecurringTemplateMutation,
} from '../api'
import { CategorySwatchGroup } from './CategorySwatchGroup'
import { EisenhowerCheckboxPair } from './EisenhowerCheckboxPair'
import { shellCssVariables, typography } from '../../../shared/design/tokens'
import type {
  RecurrenceGroup,
  RecurringTaskTemplate,
  TaskCategory,
  TaskEisenhower,
} from '../types'

const RECURRENCE_GROUP_LABEL: Record<RecurrenceGroup, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  annual: 'Anual',
}

const RECURRENCE_GROUPS = Object.keys(RECURRENCE_GROUP_LABEL) as RecurrenceGroup[]

const GROUP_HINT_CREATE = 'Herdado da aba ativa; pode trocar antes de criar.'
const GROUP_HINT_EDIT =
  'Semanal/Mensal/Anual define em qual ritual é oferecido. Readonly após criar.'
const RECURRENCE_HINT =
  'Texto livre — exibido como lembrete, nunca interpretado para inferir datas.'
const REQUIRED_NOTE = 'Título e recorrência são obrigatórios.'
/** Cópia canônica do mockup (frame E). O par da recorrência não é desenhado lá
 * — é derivado do MESMO molde, deliberadamente, para não deixar um dos dois
 * campos obrigatórios sem motivo visível. */
const TITLE_REQUIRED = 'Informe um título.'
const RECURRENCE_REQUIRED = 'Informe uma recorrência.'
const WRITE_ERROR = 'Não foi possível salvar o template. Tente novamente.'

const FIELD_INPUT_STYLE = {
  ...typography.body,
  padding: 'var(--ds-space-2)',
  border: '1px solid var(--ds-control-border)',
  borderRadius: 'var(--ds-radius-sm)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-ink)',
} as const

export interface TemplateDetailCardProps {
  /** Ausente/`null` ⇒ modo CRIAÇÃO. Presente ⇒ modo EDIÇÃO. */
  template?: RecurringTaskTemplate | null
  /** Grupo herdado da aba ativa — só usado na criação. */
  initialGroup: RecurrenceGroup
  /** Fechar/cancelar: DESCARTA o rascunho. Nunca é chamado por sucesso. */
  onClose: () => void
  /** A ação-alvo (criar/salvar/ativar/desativar) foi concluída com sucesso. */
  onSaved: () => void
  /** Offline (AC6): escrita indisponível com motivo, sem fila local. */
  disabled?: boolean
  disabledReason?: string
  /** Rodapé de exclusão (Fase C / AC4) — só renderizado na edição. */
  deleteSlot?: React.ReactNode
}

export function TemplateDetailCard({
  template = null,
  initialGroup,
  onClose,
  onSaved,
  disabled = false,
  disabledReason,
  deleteSlot,
}: TemplateDetailCardProps) {
  const isEdit = template !== null
  const createTemplate = useCreateRecurringTemplateMutation()
  const updateTemplate = useUpdateRecurringTemplateMutation()

  const [title, setTitle] = useState(template?.title ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [group, setGroup] = useState<RecurrenceGroup>(template?.recurrenceGroup ?? initialGroup)
  const [recurrenceText, setRecurrenceText] = useState(template?.recurrenceText ?? '')
  const [category, setCategory] = useState<TaskCategory | null>(template?.category || null)
  const [eisenhower, setEisenhower] = useState<TaskEisenhower | null>(
    template?.eisenhower && template.eisenhower !== 'none' ? template.eisenhower : null,
  )
  const [titleTouched, setTitleTouched] = useState(false)
  const [recurrenceTouched, setRecurrenceTouched] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const groupRefs = useRef<(HTMLElement | null)[]>([])

  const idPrefix = useId()
  const noteId = `${idPrefix}-required-note`
  const titleErrorId = `${idPrefix}-title-error`
  const recurrenceErrorId = `${idPrefix}-recurrence-error`
  const offlineId = `${idPrefix}-offline`

  const trimmedTitle = title.trim()
  const trimmedRecurrence = recurrenceText.trim()
  const titleError = trimmedTitle ? null : TITLE_REQUIRED
  const recurrenceError = trimmedRecurrence ? null : RECURRENCE_REQUIRED
  const isValid = !titleError && !recurrenceError
  const isPending = createTemplate.isPending || updateTemplate.isPending
  const primaryDisabled = !isValid || disabled || isPending

  /** O botão indisponível NUNCA é mudo (AC3): descreve-se pelo(s) motivo(s)
   * efetivamente renderizados — nota do rodapé, erro de campo tocado, offline. */
  const describedBy = [
    !isEdit ? noteId : null,
    titleTouched && titleError ? titleErrorId : null,
    recurrenceTouched && recurrenceError ? recurrenceErrorId : null,
    disabled && disabledReason ? offlineId : null,
  ]
    .filter(Boolean)
    .join(' ')

  function handlePrimary() {
    if (!isValid || disabled || isPending) return
    setWriteError(null)
    const shared = {
      title: trimmedTitle,
      description: description.trim() || null,
      eisenhower,
      category,
      recurrenceText: trimmedRecurrence,
    }
    const handlers = {
      onSuccess: onSaved,
      onError: () => setWriteError(WRITE_ERROR),
    }
    if (isEdit) {
      // `recurrenceGroup` FICA DE FORA do PATCH — readonly é contrato de UI.
      updateTemplate.mutate({ templateId: template.id, ...shared }, handlers)
      return
    }
    createTemplate.mutate({ ...shared, recurrenceGroup: group, active: true }, handlers)
  }

  function handleToggleActive() {
    if (!isEdit || disabled || isPending) return
    setWriteError(null)
    updateTemplate.mutate(
      { templateId: template.id, active: !template.active },
      { onSuccess: onSaved, onError: () => setWriteError(WRITE_ERROR) },
    )
  }

  // Roving tabindex do segmented de Grupo — mesmo racional do
  // `CategorySwatchGroup`: sem ele, só a opção já selecionada é alcançável.
  function handleGroupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isEdit) return
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !backward) return
    event.preventDefault()
    const currentIndex = RECURRENCE_GROUPS.indexOf(group)
    const delta = forward ? 1 : -1
    const nextIndex = (currentIndex + delta + RECURRENCE_GROUPS.length) % RECURRENCE_GROUPS.length
    setGroup(RECURRENCE_GROUPS[nextIndex])
    groupRefs.current[nextIndex]?.focus()
  }

  const headingText = isEdit ? 'Editar template' : 'Novo template'
  const activityLabel = isEdit ? (template.active ? ' · ativo' : ' · inativo') : ''
  const subtitle = `Recorrente · ${RECURRENCE_GROUP_LABEL[group]}${activityLabel}`

  return (
    <Dialog
      open
      onClose={onClose}
      slotProps={{
        paper: {
          'aria-label': 'Detalhe do template',
          style: shellCssVariables('light'),
          sx: {
            width: 'min(480px, 90vw)',
            backgroundColor: 'var(--ds-surface)',
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-md)',
            padding: 'var(--ds-space-4)',
            '& :focus-visible': {
              outline: '2px solid var(--ds-focus)',
              outlineOffset: '2px',
            },
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
        <Box
          component="header"
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--ds-space-2)' }}
        >
          <Box>
            <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
              {headingText}
            </Box>
            <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{subtitle}</Box>
          </Box>
          <Button
            onClick={onClose}
            aria-label="Fechar"
            sx={{
              minWidth: 'var(--ds-touch-target-min)',
              minHeight: 'var(--ds-touch-target-min)',
              color: 'var(--ds-ink-muted)',
            }}
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

        <Box>
          <Box sx={{ ...typography.label, mb: 'var(--ds-space-1)' }}>Grupo</Box>
          <Box
            role="radiogroup"
            aria-label="Grupo de recorrência"
            aria-readonly={isEdit || undefined}
            onKeyDown={handleGroupKeyDown}
            sx={{ display: 'flex', gap: 'var(--ds-space-1)', flexWrap: 'wrap' }}
          >
            {RECURRENCE_GROUPS.map((option, index) => {
              const selected = group === option
              return (
                <Box
                  key={option}
                  component="button"
                  type="button"
                  role="radio"
                  ref={(el: HTMLElement | null) => {
                    groupRefs.current[index] = el
                  }}
                  aria-checked={selected}
                  // Na edição as opções NÃO selecionadas ficam inertes (mockup
                  // frame B: `.seg.ro` com os dois irmãos `disabled`).
                  disabled={disabled || (isEdit && !selected)}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => {
                    if (isEdit || disabled) return
                    setGroup(option)
                  }}
                  sx={{
                    ...typography.label,
                    minHeight: 'var(--ds-touch-target-min)',
                    px: 'var(--ds-space-3)',
                    cursor: isEdit ? 'default' : 'pointer',
                    borderRadius: 'var(--ds-radius-sm)',
                    border: '1px solid var(--ds-control-border)',
                    backgroundColor: selected ? 'var(--ds-primary)' : 'var(--ds-surface)',
                    color: selected ? 'var(--ds-on-primary)' : 'var(--ds-ink)',
                    '&:disabled': { color: 'var(--ds-ink-muted)' },
                  }}
                >
                  {RECURRENCE_GROUP_LABEL[option]}
                </Box>
              )
            })}
          </Box>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', mt: 'var(--ds-space-1)' }}>
            {isEdit ? GROUP_HINT_EDIT : GROUP_HINT_CREATE}
          </Box>
        </Box>

        <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Recorrência</span>
          <input
            aria-label="Recorrência"
            value={recurrenceText}
            disabled={disabled}
            onChange={(event) => setRecurrenceText(event.target.value)}
            onBlur={() => setRecurrenceTouched(true)}
            style={FIELD_INPUT_STYLE}
          />
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{RECURRENCE_HINT}</Box>
          {recurrenceTouched && recurrenceError && (
            <Box
              id={recurrenceErrorId}
              role="alert"
              sx={{ ...typography.meta, color: 'var(--ds-danger)' }}
            >
              {recurrenceError}
            </Box>
          )}
        </Box>

        {/* Categoria + Prioridade NO PAR (mockup frame B, `.pair`). */}
        <Box sx={{ display: 'flex', gap: 'var(--ds-space-4)', flexWrap: 'wrap' }}>
          <CategorySwatchGroup value={category} onChange={setCategory} readonly={disabled} />
          <EisenhowerCheckboxPair
            value={eisenhower}
            onChange={setEisenhower}
            readonly={disabled}
            label="Prioridade (Eisenhower)"
          />
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

        <Box
          component="footer"
          sx={{ display: 'flex', gap: 'var(--ds-space-2)', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <Button
            onClick={handlePrimary}
            disabled={primaryDisabled}
            aria-describedby={describedBy || undefined}
            sx={{
              minHeight: 'var(--ds-touch-target-min)',
              backgroundColor: 'var(--ds-primary)',
              color: 'var(--ds-on-primary)',
              '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
              '&.Mui-disabled': {
                backgroundColor: 'var(--ds-surface-subtle)',
                color: 'var(--ds-ink-muted)',
              },
            }}
          >
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>

          {isEdit && (
            <Button
              onClick={handleToggleActive}
              disabled={disabled || isPending}
              sx={{
                minHeight: 'var(--ds-touch-target-min)',
                border: '1px solid var(--ds-control-border)',
                color: 'var(--ds-ink)',
                '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
              }}
            >
              {template.active ? 'Desativar' : 'Ativar'}
            </Button>
          )}

          {isEdit && deleteSlot}

          {!isEdit && (
            <Box id={noteId} sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
              {REQUIRED_NOTE}
            </Box>
          )}
        </Box>
      </Box>
    </Dialog>
  )
}
