// ─────────────────────────────────────────────────────────────────────────────
// Detalhe canônico da Task Row do sistema novo (Story 14.5, AC2; UX-DR26).
//
//   ▶ Categoria: `role="radiogroup"` visual (7 `role="radio"` — `Sem categoria`
//     + 6 swatches), seleção por anel `--ds-primary`, SEM dropdown e SEM
//     checkmark. Eisenhower: 2 checkboxes REAIS e independentes, `checked`
//     DERIVADO do enum combinado (`none|u|i|ui`), nunca dois booleans soltos.
//   ▶ Rascunho local dos 4 campos e um ÚNICO PATCH ao salvar (molde de
//     `TaskDetailPanel.tsx`) — fechar explícito (X/Esc/backdrop) DESCARTA;
//     falha de escrita PRESERVA o rascunho inteiro.
//   ▶ `Cancelar tarefa` e `Excluir` são DOIS serviços distintos, de propósito:
//     `Cancelar` é `POST /tasks/{id}/transition/ { toStatus: 'cancelled' }` —
//     a matriz de transição já autoriza `cancelled` a partir de `pending`/
//     `started`, então é o caminho EXPLÍCITO e nomeado que a AC pede. `Excluir`
//     continua em `DELETE /tasks/{id}/` (o servidor decide hard-delete OU
//     cancela via transição quando não elegível) — a saída discreta, ícone só.
//   ▶ Portal (MUI Dialog): reaplica `shellCssVariables()` no papel, e o Épico
//     17 especializa variantes/ações permitidas/densidade sem tocar a anatomia.
//
// [Source: DESIGN.md#Task Row; EXPERIENCE.md#Tarefas e logs L179-195; UX-DR26]
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, Checkbox, Dialog, IconButton } from '@mui/material'
import { Trash } from '@phosphor-icons/react'

import {
  invalidateRitualQueries,
  useCreateSubtaskMutation,
  useDeleteTaskMutation,
  useTransitionTaskMutation,
  useUpdateTaskMutation,
} from '../api'
import { shellCssVariables, typography } from '../../../shared/design/tokens'
import type { Task, TaskCategory, TaskEisenhower } from '../types'

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  teal: 'Teal',
  purple: 'Purple',
  pink: 'Pink',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
}
const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[]
/** `null` ("Sem categoria") + as 6 cores, na mesma ordem visual do radiogroup
 * — usada pela navegação por seta (roving tabindex). */
const CATEGORY_OPTIONS: (TaskCategory | null)[] = [null, ...CATEGORIES]

function toggleUrgent(current: TaskEisenhower | null, checked: boolean): TaskEisenhower | null {
  const important = current === 'i' || current === 'ui'
  if (checked) return important ? 'ui' : 'u'
  return important ? 'i' : null
}

function toggleImportant(current: TaskEisenhower | null, checked: boolean): TaskEisenhower | null {
  const urgent = current === 'u' || current === 'ui'
  if (checked) return urgent ? 'ui' : 'i'
  return urgent ? 'u' : null
}

export interface TaskDetailCardPredecessor {
  /** Rótulo do período de origem (ex.: "Segunda-feira", "Semana anterior"). */
  period: string
  /** Data no formato de exibição já resolvido pelo chamador (ex.: "20/07"). */
  date: string
}

export interface TaskDetailCardProps {
  task: Task
  isSubtask?: boolean
  onClose: () => void
  onMove?: () => void
  /** Derivado pelo chamador (busca na semana carregada por `migratedToTask ===
   * task.id`) — `TaskDetailCard` NUNCA inventa link reverso. */
  predecessor?: TaskDetailCardPredecessor | null
  /** Semana `finalized` (AC3): visualização permanece, escrita não — nenhum
   * campo aceita edição e o rodapé de ações (Salvar/Mover/Cancelar/Excluir)
   * some inteiro. Só "Fechar" continua disponível. */
  readonly?: boolean
}

export function TaskDetailCard({
  task,
  isSubtask = false,
  onClose,
  onMove,
  predecessor = null,
  readonly = false,
}: TaskDetailCardProps) {
  const queryClient = useQueryClient()
  const updateTask = useUpdateTaskMutation()
  const deleteTask = useDeleteTaskMutation()
  const transitionTask = useTransitionTaskMutation()
  const createSubtask = useCreateSubtaskMutation()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [category, setCategory] = useState<TaskCategory | null>(task.category || null)
  const [eisenhower, setEisenhower] = useState<TaskEisenhower | null>(
    task.eisenhower && task.eisenhower !== 'none' ? task.eisenhower : null,
  )
  const [titleError, setTitleError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const categoryRefs = useRef<(HTMLElement | null)[]>([])

  const urgent = eisenhower === 'u' || eisenhower === 'ui'
  const important = eisenhower === 'i' || eisenhower === 'ui'

  function handleSaveAndClose() {
    if (readonly) return
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError('O título não pode ficar vazio.')
      return
    }
    if (updateTask.isPending) return // escrita em andamento não fecha
    setTitleError(null)
    setWriteError(null)
    updateTask.mutate(
      {
        taskId: task.id,
        title: trimmed,
        description: description || null,
        eisenhower,
        category,
      },
      {
        onSuccess: onClose,
        onError: () => setWriteError('Não foi possível salvar. Tente novamente.'),
      },
    )
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter simples salva-e-fecha; Ctrl/Cmd+Enter é tratado no container (vale
    // de qualquer campo) — o guard evita disparar os dois para a mesma tecla.
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      handleSaveAndClose()
    }
  }

  function handleContainerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      handleSaveAndClose()
    }
  }

  function handleAddSubtask() {
    if (readonly) return
    const trimmed = subtaskDraft.trim()
    if (!trimmed) return
    createSubtask.mutate({ parentTaskId: task.id, title: trimmed })
    setSubtaskDraft('')
  }

  function handleSubtaskKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adiciona (AC2) — sem ctrl/meta, que o container já trata como
    // salvar-e-fechar de qualquer campo.
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      handleAddSubtask()
    }
  }

  // Roving tabindex do radiogroup de categoria: ArrowRight/Down avança,
  // ArrowLeft/Up recua, com wrap nas duas pontas — sem isso só a opção JÁ
  // selecionada é alcançável por teclado (as demais ficam com tabIndex -1 e
  // nenhum handler as move), quebrando a operabilidade por teclado do radio
  // group inteiro.
  function handleCategoryKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (readonly) return
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !backward) return
    event.preventDefault()
    const currentIndex = CATEGORY_OPTIONS.indexOf(category)
    const delta = forward ? 1 : -1
    const nextIndex = (currentIndex + delta + CATEGORY_OPTIONS.length) % CATEGORY_OPTIONS.length
    setCategory(CATEGORY_OPTIONS[nextIndex])
    // `tabIndex={-1}` continua focável via script (só sai da ordem de Tab) —
    // não é preciso esperar o re-render aplicar `tabIndex={0}` no próximo item.
    categoryRefs.current[nextIndex]?.focus()
  }

  function handleCancel() {
    transitionTask.mutate(
      { taskId: task.id, toStatus: 'cancelled' },
      {
        onSuccess: () => {
          invalidateRitualQueries(queryClient)
          onClose()
        },
      },
    )
  }

  function handleDelete() {
    deleteTask.mutate({ taskId: task.id }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      slotProps={{
        paper: {
          'aria-label': 'Detalhe da tarefa',
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
      <Box onKeyDown={handleContainerKeyDown} sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ ...typography['section-title'] }}>Detalhe da tarefa</Box>
          <IconButton aria-label="Fechar" onClick={onClose} size="small">
            ×
          </IconButton>
        </Box>

        {predecessor && (
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
            Veio de {predecessor.period}, {predecessor.date}
          </Box>
        )}

        <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Título</span>
          <input
            aria-label="Título"
            value={title}
            disabled={readonly}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={handleTitleKeyDown}
            style={{
              ...typography.body,
              padding: 'var(--ds-space-2)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-ink)',
            }}
          />
          {titleError && (
            <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
              {titleError}
            </Box>
          )}
        </Box>

        <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Descrição</span>
          {/* Enter aqui quebra linha nativamente (textarea) — nenhum
              `onKeyDown` intercepta a tecla. */}
          <textarea
            aria-label="Descrição"
            value={description}
            disabled={readonly}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            style={{
              ...typography.body,
              padding: 'var(--ds-space-2)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-ink)',
              resize: 'vertical',
            }}
          />
        </Box>

        <Box>
          <Box sx={{ ...typography.label, mb: 'var(--ds-space-1)' }}>Categoria</Box>
          <Box
            role="radiogroup"
            aria-label="Categoria"
            onKeyDown={handleCategoryKeyDown}
            sx={{ display: 'flex', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}
          >
            <CategorySwatch
              ref={(el) => {
                categoryRefs.current[0] = el
              }}
              selected={category === null}
              label="Sem categoria"
              readonly={readonly}
              onSelect={() => setCategory(null)}
            />
            {CATEGORIES.map((option, index) => (
              <CategorySwatch
                key={option}
                ref={(el) => {
                  categoryRefs.current[index + 1] = el
                }}
                selected={category === option}
                label={`Categoria ${CATEGORY_LABEL[option]}`}
                color={`var(--ds-category-${option})`}
                readonly={readonly}
                onSelect={() => setCategory(option)}
              />
            ))}
          </Box>
        </Box>

        <Box>
          <Box sx={{ ...typography.label, mb: 'var(--ds-space-1)' }}>Eisenhower</Box>
          <Box sx={{ display: 'flex', gap: 'var(--ds-space-3)' }}>
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
              <Checkbox
                checked={urgent}
                disabled={readonly}
                onChange={(event) => setEisenhower(toggleUrgent(eisenhower, event.target.checked))}
                sx={{
                  color: 'var(--ds-priority-u)',
                  '&.Mui-checked': { color: 'var(--ds-priority-u)' },
                }}
              />
              Urgente (U)
            </Box>
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
              <Checkbox
                checked={important}
                disabled={readonly}
                onChange={(event) => setEisenhower(toggleImportant(eisenhower, event.target.checked))}
                sx={{
                  color: 'var(--ds-priority-i)',
                  '&.Mui-checked': { color: 'var(--ds-priority-i)' },
                }}
              />
              Importante (I)
            </Box>
          </Box>
        </Box>

        {!isSubtask && (
          <Box>
            <Box sx={{ ...typography.label, mb: 'var(--ds-space-1)' }}>Subtarefas</Box>
            {(task.subtasks ?? []).map((subtask) => (
              <Box key={subtask.id} sx={{ ...typography.body, color: 'var(--ds-ink)', py: 'var(--ds-space-1)' }}>
                {subtask.title}
              </Box>
            ))}
            {!readonly && (
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleAddSubtask()
                }}
                sx={{ display: 'flex', gap: 'var(--ds-space-1)', mt: 'var(--ds-space-1)' }}
              >
                <input
                  aria-label="Nova subtarefa"
                  placeholder="Nova subtarefa"
                  value={subtaskDraft}
                  onChange={(event) => setSubtaskDraft(event.target.value)}
                  onKeyDown={handleSubtaskKeyDown}
                  style={{
                    ...typography.body,
                    flex: 1,
                    minWidth: 0,
                    padding: 'var(--ds-space-2)',
                    border: '1px solid var(--ds-control-border)',
                    borderRadius: 'var(--ds-radius-sm)',
                    background: 'var(--ds-surface)',
                    color: 'var(--ds-ink)',
                  }}
                />
                <IconButton type="submit" aria-label="Adicionar subtarefa" size="small" sx={{ color: 'var(--ds-primary)' }}>
                  +
                </IconButton>
              </Box>
            )}
          </Box>
        )}

        {writeError && (
          <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
            {writeError}
          </Box>
        )}

        {!readonly && (
          <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              onClick={handleSaveAndClose}
              sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}
            >
              Salvar
            </Button>
            {!isSubtask && (
              <Button onClick={onMove} sx={{ color: 'var(--ds-ink)', border: '1px solid var(--ds-control-border)' }}>
                Mover tarefa
              </Button>
            )}
            {!isSubtask && (
              <Button
                onClick={handleCancel}
                sx={{
                  color: 'var(--ds-danger)',
                  border: '1px solid var(--ds-danger)',
                }}
              >
                Cancelar tarefa
              </Button>
            )}
            {!isSubtask && (
              <IconButton
                aria-label="Excluir tarefa"
                onClick={handleDelete}
                sx={{ width: '44px', height: '44px', color: 'var(--ds-ink-muted)' }}
              >
                <Trash size={20} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>
    </Dialog>
  )
}

function CategorySwatch({
  selected,
  label,
  color,
  readonly = false,
  onSelect,
  ref,
}: {
  selected: boolean
  label: string
  color?: string
  readonly?: boolean
  onSelect: () => void
  // React 19: `ref` é prop normal, sem `forwardRef` (Latest Tech Information).
  ref?: (el: HTMLElement | null) => void
}) {
  return (
    <Box
      ref={ref}
      role="radio"
      aria-checked={selected}
      aria-disabled={readonly}
      aria-label={label}
      tabIndex={readonly ? -1 : selected ? 0 : -1}
      onClick={readonly ? undefined : onSelect}
      onKeyDown={(event) => {
        if (readonly) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      sx={{
        width: '28px',
        height: '28px',
        borderRadius: 'var(--ds-radius-full)',
        cursor: readonly ? 'default' : 'pointer',
        backgroundColor: color ?? 'var(--ds-surface-subtle)',
        border: color ? 'none' : '1px solid var(--ds-border)',
        outline: selected ? '2px solid var(--ds-primary)' : 'none',
        outlineOffset: '2px',
      }}
    />
  )
}
