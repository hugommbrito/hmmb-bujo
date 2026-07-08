import type { Task } from './types'

export function mapTaskTree(tasks: Task[], taskId: string, fn: (task: Task) => Task): Task[] {
  return tasks.map((task) =>
    task.id === taskId
      ? fn(task)
      : { ...task, subtasks: mapTaskTree(task.subtasks ?? [], taskId, fn) },
  )
}

export function findTaskById(tasks: Task[], taskId: string): Task | undefined {
  for (const task of tasks) {
    if (task.id === taskId) return task
    const found = findTaskById(task.subtasks ?? [], taskId)
    if (found) return found
  }
  return undefined
}

export function reorderTaskTree(
  tasks: Task[],
  taskId: string,
  targetTaskId: string,
  position: 'before' | 'after',
): Task[] {
  const hasBoth = tasks.some((t) => t.id === taskId) && tasks.some((t) => t.id === targetTaskId)
  if (hasBoth) {
    const dragged = tasks.find((t) => t.id === taskId)!
    const rest = tasks.filter((t) => t.id !== taskId)
    const targetIndex = rest.findIndex((t) => t.id === targetTaskId)
    const insertAt = position === 'before' ? targetIndex : targetIndex + 1
    return [...rest.slice(0, insertAt), dragged, ...rest.slice(insertAt)]
  }
  return tasks.map((task) => ({
    ...task,
    subtasks: reorderTaskTree(task.subtasks ?? [], taskId, targetTaskId, position),
  }))
}
