import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  STATUS_LABEL,
  TASK_STATUS_ICON_SIZE,
  taskStatusIconFor,
  taskStatusIcons,
} from './taskStatusIcons'
import type { TaskStatus } from '../types'

const ALL_STATUSES: TaskStatus[] = [
  'pending',
  'started',
  'completed',
  'cancelled',
  'migrated',
  'postponed',
]

describe('taskStatusIcons — catálogo fechado (AC2/AC8)', () => {
  it('test_catalogo_cobre_exatamente_os_seis_status', () => {
    expect(Object.keys(taskStatusIcons).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('test_tamanho_canonico_e_20px', () => {
    expect(TASK_STATUS_ICON_SIZE).toBe(20)
  })

  it('test_rotulos_pt_br_reusados_nominalmente_do_legado', () => {
    expect(STATUS_LABEL).toEqual({
      pending: 'Pendente',
      started: 'Em andamento',
      completed: 'Concluída',
      cancelled: 'Cancelada',
      migrated: 'Migrada',
      postponed: 'Adiada',
    })
  })

  it.each(ALL_STATUSES)('test_taskStatusIconFor_renderiza_svg_para_%s', (status) => {
    const { container } = render(<>{taskStatusIconFor(status)}</>)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('test_taskStatusIconFor_degrada_sem_icone_para_status_desconhecido', () => {
    // Caso irmão do teste acima: prova que a ausência é tratada, não apenas
    // presumida (assert vacuoso é achado recorrente do projeto).
    const desconhecido = 'arquivada' as TaskStatus
    const { container } = render(<>{taskStatusIconFor(desconhecido)}</>)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('test_weight_fill_e_repassado_ao_icone', () => {
    const { container: regular } = render(<>{taskStatusIconFor('pending', 'regular')}</>)
    const { container: fill } = render(<>{taskStatusIconFor('pending', 'fill')}</>)
    expect(regular.querySelector('svg')?.outerHTML).not.toBe(fill.querySelector('svg')?.outerHTML)
  })
})
