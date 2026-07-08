import { describe, it, expect } from 'vitest'
import { mapTaskTree, findTaskById, reorderTaskTree } from './taskTree'
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

describe('reorderTaskTree', () => {
  it('move um item para antes de outro na raiz', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Um' }),
      makeTask({ id: 't2', title: 'Dois' }),
      makeTask({ id: 't3', title: 'Três' }),
    ]

    const result = reorderTaskTree(tasks, 't3', 't1', 'before')

    expect(result.map((t) => t.id)).toEqual(['t3', 't1', 't2'])
  })

  it('move um item para depois de outro na raiz', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Um' }),
      makeTask({ id: 't2', title: 'Dois' }),
      makeTask({ id: 't3', title: 'Três' }),
    ]

    const result = reorderTaskTree(tasks, 't1', 't2', 'after')

    expect(result.map((t) => t.id)).toEqual(['t2', 't1', 't3'])
  })

  it('reordena dentro de um array de subtasks no mesmo nível', () => {
    const child1 = makeTask({ id: 'c1', title: 'Filha 1' })
    const child2 = makeTask({ id: 'c2', title: 'Filha 2' })
    const child3 = makeTask({ id: 'c3', title: 'Filha 3' })
    const parent = makeTask({ id: 'p1', title: 'Pai', subtasks: [child1, child2, child3] })

    const result = reorderTaskTree([parent], 'c3', 'c1', 'before')

    expect(result[0].subtasks?.map((t) => t.id)).toEqual(['c3', 'c1', 'c2'])
  })

  it('não altera nada quando taskId/targetTaskId não coexistem em nenhum nível', () => {
    const tasks = [makeTask({ id: 't1', title: 'Um' }), makeTask({ id: 't2', title: 'Dois' })]

    const result = reorderTaskTree(tasks, 't1', 'inexistente', 'after')

    expect(result.map((t) => t.id)).toEqual(['t1', 't2'])
  })
})
