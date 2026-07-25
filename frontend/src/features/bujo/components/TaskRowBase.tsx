// ─────────────────────────────────────────────────────────────────────────────
// Task Row BASE do sistema novo (Story 14.5, AC2; UX-DR26).
//
//   ▶ NASCE aqui: é a anatomia canônica de 5 colunas que toda superfície do
//     sistema novo (Weekly, e depois Monthly/Future/Arquivo) reusa a partir
//     do Épico 14. O `TaskRow.tsx` LEGADO continua existindo, intocado, e
//     serve os 5 consumidores atuais (Daily, Monthly, Future, Arquivo e a
//     `WeeklyPage` legada de `archive/weekly/:weekStart`) até o Épico 17.
//
//   ▶ O Épico 17 especializa, SEM alterar a anatomia: variantes de densidade
//     adicionais, o conjunto de ações permitidas por superfície (o slot
//     `trailingSlot`, hoje só reordenação, pode ganhar outros comandos), e o
//     indicador de `waitingOn` (Onda 2b — deliberadamente ausente aqui, AD-18
//     item 3 / AD-21 item 6).
//
//   ▶ Ícones: catálogo fechado `taskStatusIcons.tsx`, só `@phosphor-icons/react`.
//   ▶ Estilo: só `var(--ds-*)` — zero literal estrutural/cromático (AC8).
//
// [Source: DESIGN.md#Task Row; EXPERIENCE.md#Tarefas e logs L179-195; AD-02]
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box } from '@mui/material'

import { taskStatusIconFor, STATUS_LABEL } from './taskStatusIcons'
import { typography } from '../../../shared/design/tokens'
import type { CycleStatus, Task, TaskStatus } from '../types'

export type TaskRowVariant = 'full' | 'compact' | 'readonly'

/** Cicla apenas os 3 status operáveis por clique (AD-02) — `migrated`/`postponed`
 * NUNCA nascem de clique direto, só do fluxo de migração. */
const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  pending: 'started',
  started: 'completed',
  completed: 'pending',
}

/** Estados terminais que recebem menor ênfase (AC1) — grupo DIFERENTE do
 * "terminal na origem" do backend (`migrated`/`postponed`): aqui inclui
 * também `completed`/`cancelled`, por decisão visual do spine. A opacidade
 * reduzida só é aplicada a elementos com fundo OPACO próprio (ícone, badge
 * Eisenhower) — nunca ao título/descrição, cujo fundo é transparente: opacity
 * num ancestral se acumula com a do próprio elemento (CSS não permite um
 * filho "desfazer" a opacidade herdada via `calc(1/x)`), e diluir o texto
 * reprovava `color-contrast` do axe em telas mais estreitas (gap real
 * encontrado na Task 12). */
const TERMINAL_OPACITY_STATUSES: ReadonlySet<TaskStatus> = new Set([
  'completed',
  'cancelled',
  'migrated',
  'postponed',
])

const LINEAGE_HIGHLIGHT_MS = 2000
const LINEAGE_HIGHLIGHT_EVENT = 'bujo:lineage-highlight'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Matriz status × estado do ciclo (AC2, Dev Notes): decide o que é controle.
 * `readonly` (derivado de `variant === 'readonly'` OU `cycleStatus ===
 * 'finalized'` — ver `readonly` mais abaixo) não renderiza NENHUMA mutação —
 * só a linhagem sobrevive, e mesmo essa não cicla status. O parâmetro é o
 * booleano já resolvido (não `cycleStatus` puro): um `closed` legado (semana
 * sem `status` operacional, ex. `WeeklyLog.status IS NULL`) chega aqui via
 * `variant='readonly'`, e precisa desabilitar o controle mesmo quando
 * `cycleStatus` não é literalmente `'finalized'`. Fora do regime (nem
 * readonly, nem finalized) é tratado como operável, mesmo padrão de
 * "planning"/"active".
 */
function isStatusCycleControl(status: TaskStatus, readonly: boolean): boolean {
  if (readonly) return false
  return status === 'pending' || status === 'started' || status === 'completed'
}

export interface TaskRowBaseProps {
  task: Task
  /** `full` = painel diário/pool; `compact` = weekend-stack (sem chip nem
   * indicador de ordem); `readonly` = semana `finalized` (mutações ausentes). */
  variant?: TaskRowVariant
  /** Estado do ciclo da SEMANA (não da tarefa) — alimenta a matriz de controles. */
  cycleStatus: CycleStatus
  /** Posição 1-based dentro do container (dia/pool). Omitida em `compact`. */
  order?: number
  onTransition?: (taskId: string, toStatus: TaskStatus) => void
  onOpenDetail?: (taskId: string) => void
  isSubtask?: boolean
  /** Slot de reordenação/overflow (24px) — o painel decide o conjunto de
   * comandos (Task 7); ausente = coluna vazia. */
  trailingSlot?: ReactNode
}

export function TaskRowBase({
  task,
  variant = 'full',
  cycleStatus,
  order,
  onTransition,
  onOpenDetail,
  isSubtask = false,
  trailingSlot,
}: TaskRowBaseProps) {
  const [announcement, setAnnouncement] = useState('')
  const [highlighted, setHighlighted] = useState(false)
  const [successorAvailable, setSuccessorAvailable] = useState(false)
  const rowRef = useRef<HTMLDivElement | null>(null)

  const status = task.status ?? 'pending'
  const readonly = variant === 'readonly' || cycleStatus === 'finalized'
  const isTerminalOpacity = TERMINAL_OPACITY_STATUSES.has(status)
  const category = task.category || null
  const subtasks = task.subtasks ?? []
  const eisenhower = task.eisenhower

  // Sucessor no DOM = sucessor na semana carregada (o board só renderiza os 7
  // dias + pool da MESMA semana) — nenhum lookup de rede, nenhum estado extra.
  useEffect(() => {
    if (status !== 'migrated' || !task.migratedToTask) {
      setSuccessorAvailable(false)
      return
    }
    setSuccessorAvailable(Boolean(document.querySelector(`[data-task-id="${task.migratedToTask}"]`)))
  }, [status, task.migratedToTask])

  // Escuta o "farol" de linhagem disparado por OUTRA instância (a origem que
  // navegou até aqui) — cada linha só conhece a própria posição/título.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return undefined
    function handleHighlightEvent() {
      setHighlighted(true)
      setAnnouncement(`Veio de tarefa migrada — ${task.title}`)
    }
    el.addEventListener(LINEAGE_HIGHLIGHT_EVENT, handleHighlightEvent)
    return () => el.removeEventListener(LINEAGE_HIGHLIGHT_EVENT, handleHighlightEvent)
  }, [task.title])

  // Encerra o destaque por timer OU pela primeira interação/mudança de foco —
  // AMBOS os mecanismos, independente de `prefers-reduced-motion` (que só
  // remove a animação do deslocamento, nunca o mecanismo de encerramento).
  useEffect(() => {
    if (!highlighted) return undefined
    const el = rowRef.current
    const timer = window.setTimeout(() => setHighlighted(false), LINEAGE_HIGHLIGHT_MS)
    function clearOnInteraction() {
      setHighlighted(false)
    }
    el?.addEventListener('focusout', clearOnInteraction)
    el?.addEventListener('click', clearOnInteraction)
    return () => {
      window.clearTimeout(timer)
      el?.removeEventListener('focusout', clearOnInteraction)
      el?.removeEventListener('click', clearOnInteraction)
    }
  }, [highlighted])

  function handleStatusClick() {
    const nextStatus = NEXT_STATUS[status]
    if (!nextStatus || !onTransition) return
    onTransition(task.id, nextStatus)
    setAnnouncement(`Tarefa marcada como ${STATUS_LABEL[nextStatus]}`)
  }

  function handleLineageClick() {
    if (!task.migratedToTask) return
    const successorEl = document.querySelector<HTMLElement>(
      `[data-task-id="${task.migratedToTask}"]`,
    )
    if (!successorEl) return
    successorEl.scrollIntoView(
      prefersReducedMotion() ? { block: 'center' } : { block: 'center', behavior: 'smooth' },
    )
    successorEl.dispatchEvent(new CustomEvent(LINEAGE_HIGHLIGHT_EVENT))
    successorEl.focus()
  }

  // Coluna 1 = exatamente `--ds-task-row-status-icon-size` (nunca um literal
  // separado): o ícone de status (20px, DESIGN.md#task-row) precisa caber sem
  // sobra/estouro na própria trilha da grade que o contém.
  const gridTemplateColumns =
    variant === 'compact'
      ? 'var(--ds-task-row-status-icon-size) minmax(0, 1fr)'
      : 'var(--ds-task-row-status-icon-size) 28px minmax(0, 1fr) auto 24px'

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        ref={rowRef}
        data-testid="task-row"
        data-task-id={task.id}
        tabIndex={-1}
        sx={{
          display: 'grid',
          gridTemplateColumns,
          alignItems: 'center',
          columnGap: 'var(--ds-space-2)',
          minHeight: 'var(--ds-task-row-min-height-pointer)',
          '@media (pointer: coarse)': { minHeight: 'var(--ds-task-row-min-height-touch)' },
          borderLeft: 'var(--ds-task-row-category-border-width) solid',
          borderLeftColor: category ? `var(--ds-category-${category})` : 'var(--ds-border)',
          pl: 'var(--ds-space-2)',
          pr: 'var(--ds-space-3)',
          position: 'relative',
          outline: highlighted ? '2px solid var(--ds-info)' : 'none',
          outlineOffset: '-2px',
          backgroundColor: highlighted ? 'var(--ds-info-soft)' : 'transparent',
        }}
      >
        {/* Coluna 1 — status (18px) */}
        {status === 'migrated' ? (
          <Box
            component="button"
            type="button"
            onClick={handleLineageClick}
            aria-disabled={!successorAvailable}
            aria-label={
              successorAvailable
                ? `${STATUS_LABEL.migrated} — ir para o sucessor`
                : `${STATUS_LABEL.migrated} — O sucessor está em outro período`
            }
            sx={{
              width: 'var(--ds-task-row-status-icon-size)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: successorAvailable ? 'pointer' : 'not-allowed',
              color: 'var(--ds-ink-muted)',
              // Sempre em opacidade plena: é um controle de navegação acionável
              // (ir para o sucessor) — de-enfatizar a linha nunca de-enfatiza o
              // próprio comando, mesmo que a origem esteja `migrated` (terminal).
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {taskStatusIconFor('migrated')}
          </Box>
        ) : isStatusCycleControl(status, readonly) ? (
          <Box
            component="button"
            type="button"
            onClick={handleStatusClick}
            aria-label={STATUS_LABEL[status]}
            sx={{
              width: 'var(--ds-task-row-status-icon-size)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: status === 'completed' ? 'var(--ds-category-green)' : 'var(--ds-ink-muted)',
              opacity: isTerminalOpacity ? 'var(--ds-task-row-terminal-opacity)' : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {taskStatusIconFor(status)}
          </Box>
        ) : (
          <Box
            role="img"
            aria-label={STATUS_LABEL[status]}
            sx={{
              width: 'var(--ds-task-row-status-icon-size)',
              color: 'var(--ds-ink-muted)',
              opacity: isTerminalOpacity ? 'var(--ds-task-row-terminal-opacity)' : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {taskStatusIconFor(status)}
          </Box>
        )}

        {/* Coluna 2 — Eisenhower ou placeholder (28px), ausente em compact */}
        {variant !== 'compact' && (
          <Box
            aria-hidden={!eisenhower}
            sx={{
              width: '28px',
              height: '18px',
              borderRadius: 'var(--ds-radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              opacity: isTerminalOpacity ? 'var(--ds-task-row-terminal-opacity)' : 1,
              ...(eisenhower === 'ui' && {
                backgroundColor: 'var(--ds-priority-ui)',
                color: 'var(--ds-on-primary)',
              }),
              ...(eisenhower === 'u' && {
                backgroundColor: 'var(--ds-priority-u)',
                color: 'var(--ds-on-primary)',
              }),
              ...(eisenhower === 'i' && {
                backgroundColor: 'var(--ds-priority-i)',
                color: 'var(--ds-on-primary)',
              }),
            }}
          >
            {eisenhower === 'ui' && 'U+I'}
            {eisenhower === 'u' && 'U'}
            {eisenhower === 'i' && 'I'}
          </Box>
        )}

        {/* Coluna central — título + descrição truncada em 1 linha */}
        <Box sx={{ minWidth: 0 }}>
          {onOpenDetail ? (
            <Box
              component="button"
              type="button"
              onClick={() => onOpenDetail(task.id)}
              aria-label={`Ver detalhes de ${task.title}`}
              sx={{
                ...typography.body,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                width: '100%',
                color: 'var(--ds-ink)',
                textDecoration: status === 'cancelled' ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </Box>
          ) : (
            <Box
              sx={{
                ...typography.body,
                color: 'var(--ds-ink)',
                textDecoration: status === 'cancelled' ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </Box>
          )}
          {task.description && (
            <Box
              sx={{
                ...typography.meta,
                color: 'var(--ds-ink-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {task.description}
            </Box>
          )}
          {subtasks.length > 0 && (
            <Box sx={{ pl: 'var(--ds-space-3)' }}>
              {subtasks.map((subtask) => (
                <TaskRowBase
                  key={subtask.id}
                  task={subtask}
                  variant={variant}
                  cycleStatus={cycleStatus}
                  onTransition={onTransition}
                  onOpenDetail={onOpenDetail}
                  isSubtask
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Coluna 4 — ordem (auto), ausente em compact e em subtarefas */}
        {variant !== 'compact' && !isSubtask && (
          <Box
            aria-hidden
            sx={{
              fontSize: 'var(--ds-space-3)',
              color: 'var(--ds-ink-disabled)',
              minWidth: '16px',
              textAlign: 'right',
            }}
          >
            {order ?? ''}
          </Box>
        )}

        {/* Coluna 5 — drag/overflow (24px), ausente em compact */}
        {variant !== 'compact' && !readonly && (
          <Box sx={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
            {trailingSlot}
          </Box>
        )}

        <Box
          role="status"
          aria-live="polite"
          sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
        >
          {announcement}
        </Box>
      </Box>
    </Box>
  )
}
