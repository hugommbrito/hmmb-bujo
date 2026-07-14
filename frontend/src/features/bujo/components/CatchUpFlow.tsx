import { useEffect, useState } from 'react'
import type { Task } from '../types'
import { MigrationFlow } from './MigrationFlow'
import type { MigrationFlowType } from './MigrationCard'

interface CatchUpFlowProps {
  monthlyTasks: Task[]
  weeklyTasks: Task[]
  dailyTasks: Task[]
  open: boolean
  onClose: () => void
}

const STAGE_ORDER: MigrationFlowType[] = ['monthly', 'weekly', 'daily']

// Um único Dialog contínuo (Task 7, Dev Notes "Um Dialog contínuo, não três
// banners separados") — orquestra mês → semana → dia via `onExhausted`
// (Task 6), nunca fechando/reabrindo o Dialog entre estágios.
export function CatchUpFlow({
  monthlyTasks,
  weeklyTasks,
  dailyTasks,
  open,
  onClose,
}: CatchUpFlowProps) {
  const queuesByStage: Record<MigrationFlowType, Task[]> = {
    monthly: monthlyTasks,
    weekly: weeklyTasks,
    daily: dailyTasks,
  }
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    if (open) {
      const first = STAGE_ORDER.findIndex((stage) => queuesByStage[stage].length > 0)
      setStageIndex(first === -1 ? STAGE_ORDER.length : first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recalcula ao abrir, mesmo padrão do MigrationFlow
  }, [open])

  function handleExhausted() {
    const rest = STAGE_ORDER.slice(stageIndex + 1)
    const nextOffset = rest.findIndex((stage) => queuesByStage[stage].length > 0)
    if (nextOffset === -1) {
      onClose()
    } else {
      setStageIndex(stageIndex + 1 + nextOffset)
    }
  }

  if (!open || stageIndex >= STAGE_ORDER.length) return null
  const stage = STAGE_ORDER[stageIndex]

  return (
    <MigrationFlow
      key={stage}
      queue={queuesByStage[stage]}
      flowType={stage}
      open={open}
      onClose={onClose}
      onExhausted={handleExhausted}
    />
  )
}
