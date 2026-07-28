// ─────────────────────────────────────────────────────────────────────────────
// Task Row BASE do sistema novo (Story 14.5, AC2; UX-DR26).
//
//   ▶ NASCE aqui: é a anatomia canônica de 5 colunas que toda superfície do
//     sistema novo (Weekly, e depois Monthly/Future/Arquivo) reusa a partir
//     do Épico 14. O `TaskRow.tsx` LEGADO continua existindo, intocado, até o
//     Épico 17 (Story 14.10 removeu `WeeklyPage`/`MonthlyPage` legadas, que
//     eram consumidoras dele nas rotas de Arquivo — só sobrevive fora do
//     Arquivo, que agora reusa `TaskRowBase` como toda superfície do sistema
//     novo).
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
import type { CycleStatus, MigrationTarget, Task, TaskStatus } from '../types'

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
// Exportado (Story 14.10): o Arquivo reusa o MESMO "farol" para focar/destacar
// a linha de retorno depois de uma navegação cross-período (troca de rota, não
// scroll local) — ver `pages/archive/archiveLineageReturn.ts`.
export const LINEAGE_HIGHLIGHT_EVENT = 'bujo:lineage-highlight'

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
function isStatusCycleControl(
  status: TaskStatus,
  readonly: boolean,
  allowStatusCycle: boolean,
): boolean {
  if (readonly) return false
  // Story 14.7 (M08): superfície onde concluir/cancelar NÃO EXISTEM como regra
  // de produto (Future Log). Cai no ramo `role="img"` que já existe abaixo —
  // zero mudança de layout, `trailingSlot` preservado (é por isso que
  // `variant='readonly'` não serve: ele suprime a coluna 5 inteira).
  if (!allowStatusCycle) return false
  return status === 'pending' || status === 'started' || status === 'completed'
}

/**
 * "Terminal COM linhagem" — os únicos dois status que `migrate_task` produz na
 * origem com `migrated_to_task` preenchido (Story 14.7, AC4):
 *
 * - `migrated`  → `destination` `today`/`week`;
 * - `postponed` → `destination` `month`/`future` (é o que o Future Log gera).
 *
 * A assimetria é DELIBERADA e retrocompatível: `migrated` renderiza o controle
 * mesmo SEM sucessor (anunciando "O sucessor está em outro período" — mudar isso
 * seria regressão), enquanto `postponed` exige `migratedToTask`, porque
 * `postponed` SEM linhagem é estado legal (a matriz `ALLOWED` do
 * `state_machine.py` permite `pending`/`started` → `POSTPONED` direto, sem passar
 * por `migrate_task`) e precisa continuar caindo no ramo `role="img"` mudo.
 *
 * `cancelled` fica fora por construção: `destination:'cancel'` não cria sucessor
 * nem linhagem (Questão aberta #7 da Story 14.7).
 */
function isLineageControl(status: TaskStatus, migratedToTask?: string | null): boolean {
  if (status === 'migrated') return true
  return status === 'postponed' && Boolean(migratedToTask)
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
  /**
   * Ciclo de status por clique no ícone (Story 14.7, AC5). Default `true` =
   * comportamento de sempre. `false` desliga SÓ a mutação de status (o ícone
   * vira `role="img"`); NÃO desliga o controle de linhagem — a seta é
   * navegação, não mutação, mesmo racional que já faz `migrated` sobreviver a
   * `cycleStatus='finalized'`. `trailingSlot` continua renderizado.
   */
  allowStatusCycle?: boolean
  /**
   * Navegação cross-período da seta de linhagem (Story 14.10, Arquivo).
   * Invocado com `(successorTaskId, originTaskId, migrationTarget)` SÓ quando
   * a seta é acionada, o sucessor NÃO está no DOM atual (fora do período
   * carregado) e `task.migrationTarget` está resolvido. `TaskRowBase` não sabe
   * navegar sozinho — quem recebe o callback decide a rota (Weekly/Monthly via
   * Arquivo, Daily via `daily/:date`) e o retorno.
   *
   * Ausente por padrão (todos os boards — Weekly/Monthly/Future/Migration —
   * NÃO passam esta prop): o comportamento atual (`aria-disabled` mudo)
   * sobrevive inalterado fora do Arquivo. Zero regressão.
   */
  onNavigateToSuccessor?: (
    successorTaskId: string,
    originTaskId: string,
    migrationTarget: MigrationTarget,
  ) => void
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
  allowStatusCycle = true,
  onNavigateToSuccessor,
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

  // Sucessor no DOM = sucessor no período carregado (o board só renderiza um
  // período por vez) — nenhum lookup de rede, nenhum estado extra.
  useEffect(() => {
    if (!isLineageControl(status, task.migratedToTask) || !task.migratedToTask) {
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

  // Story 14.10: navegar cross-período é acionável mesmo com o sucessor fora
  // do DOM, DESDE que a página tenha resolvido `migrationTarget` E passado o
  // callback — os demais consumidores (sem a prop) preservam o `aria-disabled`
  // mudo de sempre.
  const canNavigateCrossPeriod = Boolean(onNavigateToSuccessor && task.migrationTarget)
  const successorReachable = successorAvailable || canNavigateCrossPeriod

  function handleLineageClick() {
    if (!task.migratedToTask) return
    const successorEl = document.querySelector<HTMLElement>(
      `[data-task-id="${task.migratedToTask}"]`,
    )
    if (successorEl) {
      successorEl.scrollIntoView(
        prefersReducedMotion() ? { block: 'center' } : { block: 'center', behavior: 'smooth' },
      )
      successorEl.dispatchEvent(new CustomEvent(LINEAGE_HIGHLIGHT_EVENT))
      successorEl.focus()
      return
    }
    if (onNavigateToSuccessor && task.migrationTarget) {
      onNavigateToSuccessor(task.migratedToTask, task.id, task.migrationTarget)
    }
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
        {isLineageControl(status, task.migratedToTask) ? (
          <Box
            component="button"
            type="button"
            onClick={handleLineageClick}
            aria-disabled={!successorReachable}
            // Rótulo e ícone derivam do STATUS REAL (Story 14.7, AC4): para
            // `migrated` produz exatamente as mesmas strings de antes, e para
            // `postponed` produz "Adiada — …" com o ícone `ArrowLineRight`.
            // `successorReachable` (Story 14.10) cobre TAMBÉM o caso do
            // Arquivo, onde o sucessor está em outro período mas navegável.
            aria-label={
              successorReachable
                ? `${STATUS_LABEL[status]} — ir para o sucessor`
                : `${STATUS_LABEL[status]} — O sucessor está em outro período`
            }
            sx={{
              width: 'var(--ds-task-row-status-icon-size)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: successorReachable ? 'pointer' : 'not-allowed',
              color: 'var(--ds-ink-muted)',
              // Sempre em opacidade plena: é um controle de navegação acionável
              // (ir para o sucessor) — de-enfatizar a linha nunca de-enfatiza o
              // próprio comando, mesmo que a origem esteja `migrated` (terminal).
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {taskStatusIconFor(status)}
          </Box>
        ) : isStatusCycleControl(status, readonly, allowStatusCycle) ? (
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
                  allowStatusCycle={allowStatusCycle}
                  onNavigateToSuccessor={onNavigateToSuccessor}
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
