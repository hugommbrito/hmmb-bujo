import { useCallback, useEffect, useState } from 'react'
import { Dialog, useMediaQuery } from '@mui/material'
import { useMigrateTaskMutation } from '../api'
import type { MigrationDestination } from '../api'
import type { Task } from '../types'
import { MigrationCard, type MigrationDecisionExtra, type MigrationFlowType } from './MigrationCard'

interface MigrationFlowProps {
  queue: Task[]
  open: boolean
  onClose: () => void
  flowType?: MigrationFlowType
}

// Overlay real com backdrop (Dialog do MUI) — desktop centralizado, mobile
// full-screen (breakpoint canônico de TaskRow/TaskDetailPanel). Ver Dev Notes
// "Modal overlay vs. full-page".
export function MigrationFlow({ queue, open, onClose, flowType = 'daily' }: MigrationFlowProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [snapshot, setSnapshot] = useState<Task[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activePicker, setActivePicker] = useState<'none' | 'month' | 'future'>('none')
  const migrate = useMigrateTaskMutation()

  // `snapshot` é a fila capturada ao abrir — não refaz a query a cada decisão
  // nem reage a mudanças no prop `queue` (que muda a cada invalidação/refetch
  // de `useMigrationQueueQuery`), só avança o índice localmente (Task 6.3).
  useEffect(() => {
    if (open) {
      setSnapshot(queue)
      setCurrentIndex(0)
      setActivePicker('none')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recaptura ao abrir, não a cada mudança de `queue`
  }, [open])

  const currentTask = snapshot[currentIndex]

  const handleDecide = useCallback(
    (destination: MigrationDestination, extra?: MigrationDecisionExtra) => {
      if (!currentTask) return
      migrate.mutate({ taskId: currentTask.id, destination, ...extra })
      setActivePicker('none')
      const nextIndex = currentIndex + 1
      // `onClose` chamado como statement direto do handler, nunca dentro de um
      // updater de setState — fazê-lo lá dispara "Cannot update a component
      // while rendering a different component" e quebra o próximo render do
      // `MigrationBanner` (a invalidação da query nunca reflete na UI).
      if (nextIndex >= snapshot.length) {
        onClose()
      } else {
        setCurrentIndex(nextIndex)
      }
    },
    [currentTask, currentIndex, migrate, onClose, snapshot.length],
  )

  // Atalhos de teclado (nível do Dialog, só enquanto aberto), tabela por
  // `flowType` (Task 6.3) — em vez de um if/else aninhado, os 3 casos ficam
  // legíveis lado a lado: 'daily'/'weekly' têm 4 atalhos (1 confirma direto o
  // botão 1, 2/3 abrem picker, 4 cancela); 'monthly' tem 3 (sem atalho para
  // "hoje/semana" — não existe botão 1). Confirmação de mês/futuro vem do
  // onChange do input, MigrationCard. Esc é tratado pelo próprio Dialog do MUI
  // (onClose) — pausa sem decidir, a tarefa atual continua na fila.
  useEffect(() => {
    if (!open) return

    const shortcuts: Record<MigrationFlowType, Record<string, () => void>> = {
      daily: {
        '1': () => handleDecide('today'),
        '2': () => setActivePicker('month'),
        '3': () => setActivePicker('future'),
        '4': () => handleDecide('cancel'),
      },
      weekly: {
        '1': () => handleDecide('week'),
        '2': () => setActivePicker('month'),
        '3': () => setActivePicker('future'),
        '4': () => handleDecide('cancel'),
      },
      monthly: {
        '1': () => setActivePicker('month'),
        '2': () => setActivePicker('future'),
        '3': () => handleDecide('cancel'),
      },
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isEditable) return

      shortcuts[flowType][event.key]?.()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleDecide, flowType])

  if (!currentTask) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      aria-label="Fluxo de migração"
    >
      <MigrationCard
        key={currentTask.id}
        task={currentTask}
        index={currentIndex}
        total={snapshot.length}
        activePicker={activePicker}
        onOpenPicker={setActivePicker}
        onDecide={handleDecide}
        flowType={flowType}
      />
    </Dialog>
  )
}
