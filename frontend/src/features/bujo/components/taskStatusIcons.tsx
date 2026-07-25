// ─────────────────────────────────────────────────────────────────────────────
// Catálogo Phosphor FECHADO de ícones de status da Task Row (AC2/AC8), no
// molde de `app/layout/shell/navIcons.tsx`: mapa por identidade estável
// (`TaskStatus`) → componente `@phosphor-icons/react`, `regular`/20px/
// `currentColor`, com resolvedor tolerante a chave desconhecida.
//
// Mapeamento verificado no pacote instalado (^2.1.10): `pending → Circle`,
// `started → HourglassMedium`, `completed → CheckCircle`, `cancelled →
// XCircle`, `migrated → ArrowRight`, `postponed → ArrowLineRight`.
//
// [Source: Story 14.5 Dev Notes — Task 1; DESIGN.md#components.domain-icon]
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowLineRight, ArrowRight, CheckCircle, Circle, HourglassMedium, XCircle, type Icon } from '@phosphor-icons/react'

import type { TaskStatus } from '../types'

/** Tamanho canônico dos ícones de status (`{components.task-row.status-icon-size}`). */
export const TASK_STATUS_ICON_SIZE = 20

/**
 * Rótulos pt-BR — reusados NOMINALMENTE do legado (`TaskRow.tsx:28-35`), não
 * reescritos de memória.
 */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  started: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  migrated: 'Migrada',
  postponed: 'Adiada',
}

export const taskStatusIcons: Record<TaskStatus, Icon> = {
  pending: Circle,
  started: HourglassMedium,
  completed: CheckCircle,
  cancelled: XCircle,
  migrated: ArrowRight,
  postponed: ArrowLineRight,
}

/**
 * Renderiza o ícone canônico de um status, TOLERANDO status desconhecido
 * (degradação sem ícone — mesmo guard de `navIconFor`, nunca derruba a linha).
 */
export function taskStatusIconFor(status: TaskStatus, weight: 'regular' | 'fill' = 'regular') {
  const IconComp: Icon | undefined = taskStatusIcons[status]
  if (!IconComp) return null
  return <IconComp size={TASK_STATUS_ICON_SIZE} weight={weight} />
}
