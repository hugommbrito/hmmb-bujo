import { describe, it, expect } from 'vitest'
import { mapTaskTree, findTaskById } from './taskTree'
import type { Task } from './types'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'default-id',
    title: 'Tarefa',
    status: 'pending',
    eisenhower: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

describe('mapTaskTree', () => {
  it('atualiza um nó na raiz sem afetar os demais', () => {
    const tasks = [makeTask({ id: 't1', title: 'Um' }), makeTask({ id: 't2', title: 'Dois' })]

    const result = mapTaskTree(tasks, 't2', (task) => ({ ...task, title: 'Dois editada' }))

    expect(result[0].title).toBe('Um')
    expect(result[1].title).toBe('Dois editada')
  })

  it('atualiza um nó dentro de subtasks preservando os irmãos', () => {
    const child = makeTask({ id: 'c1', title: 'Filha' })
    const otherChild = makeTask({ id: 'c2', title: 'Outra filha' })
    const parent = makeTask({ id: 'p1', title: 'Pai', subtasks: [child, otherChild] })

    const result = mapTaskTree([parent], 'c1', (task) => ({ ...task, title: 'Filha editada' }))

    expect(result[0].subtasks?.[0].title).toBe('Filha editada')
    expect(result[0].subtasks?.[1].title).toBe('Outra filha')
  })
})

describe('findTaskById', () => {
  it('encontra um nó na raiz', () => {
    const tasks = [makeTask({ id: 't1', title: 'Um' }), makeTask({ id: 't2', title: 'Dois' })]

    expect(findTaskById(tasks, 't2')?.title).toBe('Dois')
  })

  it('encontra um nó dentro de subtasks', () => {
    const child = makeTask({ id: 'c1', title: 'Filha' })
    const parent = makeTask({ id: 'p1', title: 'Pai', subtasks: [child] })

    expect(findTaskById([parent], 'c1')?.title).toBe('Filha')
  })

  it('retorna undefined quando não encontra', () => {
    const tasks = [makeTask({ id: 't1', title: 'Um' })]

    expect(findTaskById(tasks, 'inexistente')).toBeUndefined()
  })
})
