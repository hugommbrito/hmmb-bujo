import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { WeeklyDecisionList } from './WeeklyDecisionList'
import weeklyDecisionListSource from './WeeklyDecisionList.tsx?raw'
import type { NormalizedRitualItem } from './weeklyRitualSources'

function item(overrides: Partial<NormalizedRitualItem> = {}): NormalizedRitualItem {
  return { id: 'i-1', kind: 'task', title: 'Item', decision: null, ...overrides }
}

const noop = {
  onViewChange: vi.fn(),
  onRetry: vi.fn(),
  onKeep: vi.fn(),
  onSkipWeek: vi.fn(),
  onAllocate: vi.fn(),
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  onMigrateNamedDay: vi.fn(),
  onChooseDestination: vi.fn(),
}

describe('WeeklyDecisionList — conjunto de ações por fonte (AC5)', () => {
  it('monthly-in-week oferece Manter + Migrar + Escolher destino + Concluir + Cancelar', () => {
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[item({ scheduledDate: '2026-07-22' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Manter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Migrar para/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolher destino…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('previous-weekly e pending-dailies NÃO oferecem Manter (caso irmão: monthly-in-week oferece)', () => {
    const { rerender } = render(
      <WeeklyDecisionList
        sourceId="previous-weekly"
        weekStart="2026-07-20"
        items={[item({ scheduledDate: '2026-07-13' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Manter' })).not.toBeInTheDocument()

    rerender(
      <WeeklyDecisionList
        sourceId="pending-dailies"
        weekStart="2026-07-20"
        items={[item({ scheduledDate: '2026-07-10', groupLabel: '2026-07-10' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Manter' })).not.toBeInTheDocument()

    rerender(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[item({ scheduledDate: '2026-07-20' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Manter' })).toBeInTheDocument()
  })

  it('recurring oferece Alocar + Não alocar nesta semana, SEM Migrar/Concluir/Cancelar', () => {
    render(
      <WeeklyDecisionList
        sourceId="recurring"
        weekStart="2026-07-20"
        items={[item({ kind: 'template' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Alocar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Não alocar nesta semana' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Migrar para/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
  })

  it('alreadyPlaced fica FORA do progresso — seção própria, sempre consultável (novas instâncias permitidas)', () => {
    const onAllocate = vi.fn()
    render(
      <WeeklyDecisionList
        sourceId="recurring"
        weekStart="2026-07-20"
        items={[item({ id: 'pendente', kind: 'template', title: 'Pendente' })]}
        alreadyPlacedItems={[item({ id: 'ja-alocado', kind: 'template', title: 'Já alocado' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
        onAllocate={onAllocate}
      />,
    )
    expect(screen.getByRole('region', { name: 'Já alocados (fora do progresso)' })).toBeInTheDocument()
    expect(screen.getByText('Já alocado')).toBeInTheDocument()
    // "novas instâncias, inclusive duplicadas, continuam permitidas" — o botão
    // Alocar segue disponível mesmo para um template já colocado.
    const alreadyPlacedSection = screen.getByRole('region', { name: 'Já alocados (fora do progresso)' })
    fireEvent.click(within(alreadyPlacedSection).getByRole('button', { name: 'Alocar' }))
    expect(onAllocate).toHaveBeenCalledWith('ja-alocado')
  })

  it('caso irmão: sem alreadyPlaced, a seção não aparece', () => {
    render(
      <WeeklyDecisionList
        sourceId="recurring"
        weekStart="2026-07-20"
        items={[item({ kind: 'template' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.queryByRole('region', { name: 'Já alocados (fora do progresso)' })).not.toBeInTheDocument()
  })

  it('Migrar para <dia> preserva o dia de origem mapeado na semana-alvo', () => {
    render(
      <WeeklyDecisionList
        sourceId="previous-weekly"
        weekStart="2026-07-20" // segunda
        items={[item({ scheduledDate: '2026-07-15' })]} // quarta da semana anterior
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    // Quarta mapeada na semana-alvo (2026-07-20) é 2026-07-22.
    expect(screen.getByRole('button', { name: /Migrar para Quarta/ })).toBeInTheDocument()
  })
})

describe('WeeklyDecisionList — pending-dailies usa groups (AC3)', () => {
  it('agrupa por data (groupLabel), não uma lista plana', () => {
    render(
      <WeeklyDecisionList
        sourceId="pending-dailies"
        weekStart="2026-07-20"
        items={[
          item({ id: 'a', title: 'A', groupLabel: '2026-07-10' }),
          item({ id: 'b', title: 'B', groupLabel: '2026-07-11' }),
        ]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByText('10 jul.')).toBeInTheDocument()
    expect(screen.getByText('11 jul.')).toBeInTheDocument()
  })
})

describe('WeeklyDecisionList — estados (AC5/AC7)', () => {
  it('erro mostra mensagem local + Tentar novamente', () => {
    const onRetry = vi.fn()
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[]}
        view="pending"
        loading={false}
        error
        {...noop}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('vazio em Pendentes mostra "Nenhuma pendência nesta fonte."', () => {
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByText('Nenhuma pendência nesta fonte.')).toBeInTheDocument()
  })

  it('toggle Pendentes/Tudo chama onViewChange', () => {
    const onViewChange = vi.fn()
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
        onViewChange={onViewChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tudo' }))
    expect(onViewChange).toHaveBeenCalledWith('all')
  })

  it('região com aria-busy quando carregando (por fonte, não global)', () => {
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[]}
        view="pending"
        loading
        error={false}
        {...noop}
      />,
    )
    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'true')
  })

  it('jest-axe: sem violações', async () => {
    const { container } = render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[item({ scheduledDate: '2026-07-20' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('WeeklyDecisionList — continuidade de foco (AC5)', () => {
  it('ao esgotar as pendências, o foco vai para o heading da fonte', () => {
    function Wrapper() {
      const [items, setItems] = useState([item({ id: 'only' })])
      return (
        <WeeklyDecisionList
          sourceId="monthly-in-week"
          weekStart="2026-07-20"
          items={items}
          view="pending"
          loading={false}
          error={false}
          {...noop}
          onComplete={() => setItems([])}
        />
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.getByRole('heading', { name: 'Monthly na semana' })).toHaveFocus()
  })

  it('com mais pendências, o foco vai para o item na MESMA posição', () => {
    function Wrapper() {
      const [items, setItems] = useState([
        item({ id: 'a', title: 'A' }),
        item({ id: 'b', title: 'B' }),
        item({ id: 'c', title: 'C' }),
      ])
      return (
        <WeeklyDecisionList
          sourceId="monthly-in-week"
          weekStart="2026-07-20"
          items={items}
          view="pending"
          loading={false}
          error={false}
          {...noop}
          onComplete={(id: string) => setItems((prev: typeof items) => prev.filter((i: { id: string }) => i.id !== id))}
        />
      )
    }
    render(<Wrapper />)
    const buttons = screen.getAllByRole('button', { name: 'Concluir' })
    fireEvent.click(buttons[0]) // remove 'A' (índice 0)
    // O item que ocupa o índice 0 agora é 'B' — o foco deve estar na LINHA
    // (o pai do título, que é o elemento com tabIndex=-1 focável).
    expect(screen.getByText('B').parentElement).toHaveFocus()
  })
})

describe('WeeklyDecisionList — falha de decisão por item (AC5)', () => {
  it('mostra o motivo + Tentar novamente SÓ no item com erro, e o item continua na lista', () => {
    const onRetryItem = vi.fn()
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[item({ id: 'a', title: 'A' }), item({ id: 'b', title: 'B' })]}
        view="pending"
        loading={false}
        error={false}
        itemErrors={{ a: 'Não foi possível salvar a decisão. Tente novamente.' }}
        onRetryItem={onRetryItem}
        {...noop}
      />,
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar a decisão')
    // Caso irmão: 'B' não tem erro, então não ganha o alerta.
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetryItem).toHaveBeenCalledWith('a')
  })

  it('caso irmão: sem itemErrors, nenhum alerta por item aparece', () => {
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[item({ id: 'a', title: 'A' })]}
        view="pending"
        loading={false}
        error={false}
        {...noop}
      />,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('WeeklyDecisionList — offline (AC7)', () => {
  it('offline: botões ficam aria-disabled (NUNCA disabled nativo) e o clique é guardado', () => {
    const onComplete = vi.fn()
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[item({ scheduledDate: '2026-07-20' })]}
        view="pending"
        loading={false}
        error={false}
        offline
        {...noop}
        onComplete={onComplete}
      />,
    )
    const button = screen.getByRole('button', { name: 'Concluir' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled() // nunca `disabled` nativo (AC7)
    fireEvent.click(button)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('caso irmão: online, o mesmo botão funciona normalmente', () => {
    const onComplete = vi.fn()
    render(
      <WeeklyDecisionList
        sourceId="monthly-in-week"
        weekStart="2026-07-20"
        items={[item({ scheduledDate: '2026-07-20' })]}
        view="pending"
        loading={false}
        error={false}
        offline={false}
        {...noop}
        onComplete={onComplete}
      />,
    )
    const button = screen.getByRole('button', { name: 'Concluir' })
    expect(button).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(button)
    expect(onComplete).toHaveBeenCalledWith('i-1')
  })
})

// `?raw` (molde de `noLiteralTokens.test.ts`): prova ESTRUTURAL da DW-16 — o
// `Button` do MUI sem `color` explícito herda o teal de marca legado do tema,
// abaixo de AA sobre `--ds-surface`. O gate axe (`weekly-planning-ritual.spec.ts`)
// só mede os botões RENDERIZADOS na cena que ele monta; a checagem sobre a
// fonte cobre TODOS eles — inclusive os que só aparecem em erro por item, em
// erro da fonte e no bucket "Já alocados" — e pega qualquer botão novo.
describe('WeeklyDecisionList — cor explícita AA em TODO botão (DW-16)', () => {
  it('todo `<Button` do arquivo declara uma cor EXPLÍCITA de token', () => {
    // Parear por botão, não contar ocorrências: com contagem, um
    // `sx={DECISION_BUTTON_SX}` em qualquer OUTRO elemento compensaria um
    // `Button` sem cor e o guard passaria com o defeito de volta.
    // `=>` dos handlers tem um `>` que cortaria a tag no meio (o `sx` vem
    // depois do `onClick`), então neutralizar a seta ANTES de fatiar.
    const source = weeklyDecisionListSource.replaceAll('=>', '⇒')
    const openingTags = source.match(/<Button\b[^>]*>/g) ?? ([] as string[])
    const uncolored = openingTags.filter(
      (tag) => !tag.includes('DECISION_BUTTON_SX') && !tag.includes("color: 'var(--ds-"),
    )

    expect(openingTags.length).toBeGreaterThan(0)
    expect(uncolored).toEqual([])
  })

  it('DECISION_BUTTON_SX declara a cor pelo token --ds-primary', () => {
    // `[\s\S]*?\} as const` em vez de `[^}]*`: a const pode ganhar objeto
    // aninhado (ex. `'&:hover'`, como no irmão da Migração) sem que o match
    // vire vazio e o assert deixe de checar o que promete.
    const declaration = weeklyDecisionListSource.match(/const DECISION_BUTTON_SX = [\s\S]*?\} as const/)?.[0]

    expect(declaration).toBeDefined()
    expect(declaration).toContain("color: 'var(--ds-primary)'")
  })
})
