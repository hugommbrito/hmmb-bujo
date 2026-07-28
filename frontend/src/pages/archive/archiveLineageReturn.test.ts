import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLineageReturn,
  focusTaskRow,
  pathForMigrationTarget,
  readLineageReturn,
  writeLineageReturn,
} from './archiveLineageReturn'

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('pathForMigrationTarget', () => {
  it('weekly -> rota de Arquivo semanal', () => {
    expect(pathForMigrationTarget({ type: 'weekly', weekStart: '2026-07-13' })).toBe(
      '/archive/weekly/2026-07-13',
    )
  })

  it('monthly -> rota de Arquivo mensal', () => {
    expect(pathForMigrationTarget({ type: 'monthly', monthFirst: '2026-08-01' })).toBe(
      '/archive/monthly/2026-08-01',
    )
  })

  it('daily -> rota de Daily já existente', () => {
    expect(pathForMigrationTarget({ type: 'daily', logDate: '2026-08-05' })).toBe('/daily/2026-08-05')
  })

  it('sem a chave correspondente ao tipo: devolve null (defensivo)', () => {
    expect(pathForMigrationTarget({ type: 'weekly' })).toBeNull()
  })
})

describe('write/read/clearLineageReturn', () => {
  it('grava e lê o mesmo valor', () => {
    writeLineageReturn('task-1')
    expect(readLineageReturn()).toBe('task-1')
  })

  it('uma segunda escrita sobrescreve a primeira (limitação conhecida — um salto por vez)', () => {
    writeLineageReturn('task-1')
    writeLineageReturn('task-2')
    expect(readLineageReturn()).toBe('task-2')
  })

  it('clear remove a entrada', () => {
    writeLineageReturn('task-1')
    clearLineageReturn()
    expect(readLineageReturn()).toBeNull()
  })

  it('sem entrada prévia devolve null', () => {
    expect(readLineageReturn()).toBeNull()
  })
})

describe('focusTaskRow', () => {
  it('linha ausente do DOM: devolve false, sem lançar', () => {
    expect(focusTaskRow('inexistente')).toBe(false)
  })

  it('linha presente SEM botão dentro: foca a própria linha, dispara scrollIntoView e o evento de farol, devolve true', () => {
    const row = document.createElement('div')
    row.setAttribute('data-task-id', 'task-1')
    row.tabIndex = -1
    row.scrollIntoView = vi.fn()
    const handler = vi.fn()
    row.addEventListener('bujo:lineage-highlight', handler)
    document.body.appendChild(row)

    const result = focusTaskRow('task-1')

    expect(result).toBe(true)
    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    expect(handler).toHaveBeenCalled()
    expect(row).toHaveFocus()
  })

  it('linha presente COM botão dentro (seta de linhagem ou controle de status): foca o botão, não o container da linha', () => {
    const row = document.createElement('div')
    row.setAttribute('data-task-id', 'task-2')
    row.tabIndex = -1
    row.scrollIntoView = vi.fn()
    const button = document.createElement('button')
    button.textContent = 'Migrada'
    row.appendChild(button)
    document.body.appendChild(row)

    const result = focusTaskRow('task-2')

    expect(result).toBe(true)
    expect(button).toHaveFocus()
  })
})
