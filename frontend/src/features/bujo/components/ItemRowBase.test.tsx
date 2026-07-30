import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { ItemRowBase } from './ItemRowBase'

describe('ItemRowBase — anatomia canônica (Story 14.8, AC2)', () => {
  it('renderiza o título e a subline', () => {
    render(<ItemRowBase title="Revisar orçamento" subline="Semanal — toda segunda de manhã" />)
    expect(screen.getByText('Revisar orçamento')).toBeInTheDocument()
    expect(screen.getByText('Semanal — toda segunda de manhã')).toBeInTheDocument()
  })

  it('descrição opcional aparece quando presente', () => {
    render(
      <ItemRowBase
        title="Revisar orçamento"
        subline="Semanal — toda segunda"
        description="Conferir gastos e conciliar cartões"
      />,
    )
    expect(screen.getByText('Conferir gastos e conciliar cartões')).toBeInTheDocument()
  })

  it('caso irmão: sem descrição, nada é renderizado no lugar dela', () => {
    render(<ItemRowBase title="Treino de força" subline="Semanal — seg / qua / sex" />)
    expect(screen.getByTestId('item-row').textContent).toBe(
      'Treino de forçaSemanal — seg / qua / sex',
    )
  })

  it('NÃO tem coluna de ícone de status, indicador de ordem nem subárvore (não é Task Row)', () => {
    render(<ItemRowBase title="Template plano" subline="Semanal — sexta" />)
    // Nenhum `role="img"`/botão de status: template não tem máquina de estados.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('item-row')).toHaveLength(1)
  })

  it('o TÍTULO não é um controle — os comandos vivem no slot de ações (mockup frame A)', () => {
    render(
      <ItemRowBase
        title="Planejar a semana"
        subline="Semanal — domingo"
        trailingSlot={<button type="button">Editar</button>}
      />,
    )
    expect(screen.getByText('Planejar a semana')).toBeInTheDocument()
    // Exatamente UM botão na linha: o do slot. Dois controles cujo nome começa
    // por "Editar" seriam ambíguos por leitor de tela e por locator.
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })
})

describe('ItemRowBase — onActivate (Épico 15, ponto de extensão)', () => {
  it('sem onActivate, o título continua sem ser um controle (default preservado)', () => {
    render(<ItemRowBase title="Sem onActivate" subline="Semanal" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('com onActivate, o bloco de título vira um botão real', () => {
    const onActivate = vi.fn()
    render(<ItemRowBase title="Renovar seguro do carro" subline="23 jul." onActivate={onActivate} />)

    const control = screen.getByRole('button', { name: /Renovar seguro do carro/ })
    control.click()

    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('onActivate + trailingSlot convivem sem colidir (dois controles distintos)', () => {
    const onActivate = vi.fn()
    render(
      <ItemRowBase
        title="Item do Brain Dump"
        subline="23 jul."
        onActivate={onActivate}
        trailingSlot={<button type="button">Mover</button>}
      />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Mover' })).toBeInTheDocument()
  })
})

describe('ItemRowBase — borda de categoria', () => {
  it('categoria pinta a borda esquerda com a cor da categoria', () => {
    render(<ItemRowBase title="Com categoria" subline="Semanal" category="teal" />)
    expect(screen.getByTestId('item-row')).toHaveStyle({
      borderLeftColor: 'var(--ds-category-teal)',
    })
  })

  it('sem categoria cai no fallback --ds-border (não some a borda)', () => {
    render(<ItemRowBase title="Sem categoria" subline="Semanal" />)
    expect(screen.getByTestId('item-row')).toHaveStyle({ borderLeftColor: 'var(--ds-border)' })
  })
})

describe('ItemRowBase — chip Eisenhower inline ao lado do título', () => {
  it('"u" renderiza o chip U', () => {
    render(<ItemRowBase title="T" subline="S" eisenhower="u" />)
    expect(screen.getByText('U')).toBeInTheDocument()
  })

  it('"i" renderiza o chip I', () => {
    render(<ItemRowBase title="T" subline="S" eisenhower="i" />)
    expect(screen.getByText('I')).toBeInTheDocument()
  })

  it('"ui" renderiza o chip U+I', () => {
    render(<ItemRowBase title="T" subline="S" eisenhower="ui" />)
    expect(screen.getByText('U+I')).toBeInTheDocument()
  })

  it('"none" NÃO renderiza chip', () => {
    render(<ItemRowBase title="T" subline="S" eisenhower="none" />)
    expect(screen.queryByTestId('item-row-eisenhower')).not.toBeInTheDocument()
  })

  it('null NÃO renderiza chip', () => {
    render(<ItemRowBase title="T" subline="S" eisenhower={null} />)
    expect(screen.queryByTestId('item-row-eisenhower')).not.toBeInTheDocument()
  })

  it('o chip usa o tratamento cromático canônico de prioridade (--ds-priority-* sobre --ds-on-primary)', () => {
    render(<ItemRowBase title="T" subline="S" eisenhower="ui" />)
    expect(screen.getByTestId('item-row-eisenhower')).toHaveStyle({
      backgroundColor: 'var(--ds-priority-ui)',
      color: 'var(--ds-on-primary)',
    })
  })
})

// A regra de opacidade que a Story 14.5 pagou caro para descobrir: de-ênfase
// SÓ em elementos com fundo opaco próprio. `opacity` num ancestral se acumula,
// CSS não permite o filho desfazê-la, e texto diluído reprova `color-contrast`
// do axe. Os dois asserts abaixo são o PAR de não-vacuidade exigido pela AC2.
describe('ItemRowBase — inativo: chip textual + regra de opacidade (AC2)', () => {
  it('inativo renderiza o chip textual "inativo"', () => {
    render(<ItemRowBase title="Regar as plantas" subline="Semanal — sábado" deemphasized />)
    expect(screen.getByText('inativo')).toBeInTheDocument()
  })

  it('caso irmão: ativo NÃO renderiza o chip "inativo"', () => {
    render(<ItemRowBase title="Regar as plantas" subline="Semanal — sábado" />)
    expect(screen.queryByText('inativo')).not.toBeInTheDocument()
  })

  it('o chip de status "inativo" (fundo opaco próprio) RECEBE a opacidade reduzida', () => {
    render(<ItemRowBase title="Regar" subline="Semanal" deemphasized />)
    expect(screen.getByText('inativo')).toHaveStyle({
      opacity: 'var(--ds-task-row-terminal-opacity)',
    })
  })

  it('o TÍTULO nunca recebe opacidade reduzida, mesmo inativo (par de não-vacuidade)', () => {
    render(<ItemRowBase title="Regar as plantas" subline="Semanal" deemphasized />)
    expect(screen.getByText('Regar as plantas')).not.toHaveStyle({
      opacity: 'var(--ds-task-row-terminal-opacity)',
    })
  })

  it('a DESCRIÇÃO nunca recebe opacidade reduzida, mesmo inativo', () => {
    render(
      <ItemRowBase title="Regar" subline="Semanal" description="Todas as plantas" deemphasized />,
    )
    expect(screen.getByText('Todas as plantas')).not.toHaveStyle({
      opacity: 'var(--ds-task-row-terminal-opacity)',
    })
  })

  it('o CONTAINER da linha nunca recebe opacidade reduzida (dimming não se acumula)', () => {
    render(<ItemRowBase title="Regar" subline="Semanal" deemphasized />)
    expect(screen.getByTestId('item-row')).not.toHaveStyle({
      opacity: 'var(--ds-task-row-terminal-opacity)',
    })
  })

  it('o chip Eisenhower (fundo opaco próprio) também recebe a de-ênfase quando inativo', () => {
    render(<ItemRowBase title="Regar" subline="Semanal" eisenhower="u" deemphasized />)
    expect(screen.getByTestId('item-row-eisenhower')).toHaveStyle({
      opacity: 'var(--ds-task-row-terminal-opacity)',
    })
  })

  it('caso irmão: ativo, o chip Eisenhower fica em opacidade plena', () => {
    render(<ItemRowBase title="Regar" subline="Semanal" eisenhower="u" />)
    expect(screen.getByTestId('item-row-eisenhower')).not.toHaveStyle({
      opacity: 'var(--ds-task-row-terminal-opacity)',
    })
  })
})

describe('ItemRowBase — slot de ações trailing', () => {
  it('renderiza o conteúdo do slot', () => {
    render(
      <ItemRowBase
        title="Com ações"
        subline="Semanal"
        trailingSlot={<button type="button">Desativar</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
  })

  it('slot vazio não quebra a linha nem cria botão fantasma', () => {
    render(<ItemRowBase title="Sem ações" subline="Semanal" />)
    expect(screen.getByTestId('item-row')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ItemRowBase — jest-axe', () => {
  it('sem violações de acessibilidade (linha completa)', async () => {
    const { container } = render(
      <ItemRowBase
        title="Revisar orçamento"
        subline="Semanal — toda segunda"
        description="Conferir gastos"
        category="blue"
        eisenhower="ui"
        trailingSlot={<button type="button">Desativar</button>}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem violações de acessibilidade (linha inativa)', async () => {
    const { container } = render(
      <ItemRowBase title="Regar as plantas" subline="Semanal — sábado" category="teal" deemphasized />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
