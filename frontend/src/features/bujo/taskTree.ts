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
