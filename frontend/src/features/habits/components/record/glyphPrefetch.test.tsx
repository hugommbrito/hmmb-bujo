// Pré-carga dos glifos do dia (DW-65) — o FIO entre os painéis e `prefetchGlyphs`.
//
// `DomainIcon.test.ts` cobre o helper: dedupe, chave inválida, cache quente. O
// que faltava era o CALL-SITE. Provado por mutação: neutralizar as duas chamadas
// (`if (false && …)`) em `HabitsTodayPanel`/`HabitsHistoryPanel` deixava a suíte
// inteira verde — a pré-carga é invisível por desenho (nenhum skeleton, nenhuma
// piscada, nenhum CLS), então nada mais poderia pegá-la.
//
// Por que espionar, e não medir o efeito: as linhas de cada painel disparam os
// MESMOS imports no MESMO commit (efeitos de filho rodam antes do efeito do pai),
// então o cache fica quente com ou sem a pré-carga. O ganho real da DW-65 é de
// TEMPO (disparar quando o payload chega, antes do commit de render) e de
// alcance (aquecer grade e detalhe do dia) — nenhum dos dois observável em jsdom.
// A chamada é, portanto, o contrato verificável; o `glyphLoadsStarted()` abaixo
// prova que ela chega ao loader de verdade.
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}))

import client from '../../../../api/client'
import * as domainIconModule from './DomainIcon'
import { DomainIcon, glyphLoadsStarted } from './DomainIcon'
import { HabitsHistoryPanel } from './HabitsHistoryPanel'
import { HabitsTodayPanel } from './HabitsTodayPanel'
import { isoLocalToday } from './habitsSurface'

const mockGet = client.get as ReturnType<typeof vi.fn>
const TODAY = isoLocalToday()

// Chaves REAIS do pacote — a pré-carga tem de chegar ao loader de verdade. Cada
// teste usa as suas: o cache de `DomainIcon` é de MÓDULO (proposital, é o que
// faz tracker → grade → histórico compartilharem uma carga), então reusar chaves
// entre testes zeraria a contagem de `import()`s do segundo.
const DAY_KEYS = ['barbell', null, 'anchor', 'barbell']
const OTHER_DAY_KEYS = ['brain', null, 'alarm', 'brain']

function dayEntry(index: number, iconKey: string | null) {
  return {
    id: `e${index}`,
    habitId: `h${index}`,
    name: `Hábito ${index}`,
    emoticon: '',
    iconKey,
    type: 'boolean' as const,
    group: 'g1',
    unit: '',
    value: null,
    weightAtTime: '1.00',
    metaAtTime: null,
    bonusAtTime: null,
    dayType: 'weekday' as const,
    multiplierAtTime: '1.00',
  }
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

let prefetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockGet.mockReset()
  prefetchSpy = vi.spyOn(domainIconModule, 'prefetchGlyphs')
})

function mockDay(keys: (string | null)[]) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/habits/days/') {
      return Promise.resolve({
        data: {
          date: TODAY,
          totalCompletion: 0,
          dayType: 'weekday',
          groups: [{ id: 'g1', name: 'Corpo', completion: 0 }],
          entries: keys.map((key, index) => dayEntry(index, key)),
        },
      })
    }
    return Promise.reject(new Error(`unhandled GET ${url}`))
  })
}

describe('DW-65 — a aba Hoje pré-carrega os glifos do payload', () => {
  it('chama `prefetchGlyphs` com as chaves do payload quando ele chega', async () => {
    mockDay(DAY_KEYS)
    renderWithQuery(
      <HabitsTodayPanel date={TODAY} onChangeDate={() => {}} compact={false} wide />,
    )
    await screen.findByText('Hábito 0')
    // As chaves do payload, verbatim — a deduplicação é do helper, não do
    // call-site (é o que faz `prefetchGlyphs` reusável).
    await waitFor(() => expect(prefetchSpy).toHaveBeenCalledWith(DAY_KEYS))
  })

  it('depois do payload, um `DomainIcon` novo rende o glifo no PRIMEIRO commit', async () => {
    mockDay(OTHER_DAY_KEYS)
    const before = glyphLoadsStarted()
    renderWithQuery(
      <HabitsTodayPanel date={TODAY} onChangeDate={() => {}} compact={false} wide />,
    )
    await screen.findByText('Hábito 0')
    // A pré-carga chegou ao LOADER (não parou num no-op): duas chaves distintas
    // e válidas ⇒ dois `import()`.
    await waitFor(() => expect(glyphLoadsStarted() - before).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(document.querySelectorAll('svg').length).toBeGreaterThan(0))

    // SEM `waitFor`: o inicializador do `useState` do `DomainIcon` LÊ o cache, e
    // é isso que faz a grade e o detalhe do dia renderizarem síncronos na
    // primeira pintura.
    const { container } = render(<DomainIcon iconKey="alarm" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('DW-65 — a aba Histórico pré-carrega os glifos do período', () => {
  it('chama `prefetchGlyphs` com as chaves de `history.habits`', async () => {
    const habits = [
      { id: 'h1', name: 'Alongamento', emoticon: '', iconKey: 'barbell', type: 'boolean', unit: '', group: 'g1' },
      { id: 'h2', name: 'Corrida', emoticon: '', iconKey: 'airplane', type: 'numeric', unit: 'km', group: 'g1' },
    ]
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/habits/history/')) {
        return Promise.resolve({
          data: {
            start: TODAY,
            end: TODAY,
            habits,
            days: [
              { date: TODAY, dayType: 'weekday', totalCompletion: null, groups: [], entries: [] },
            ],
          },
        })
      }
      if (url === '/api/habit-groups/') return Promise.resolve({ data: [] })
      if (url.startsWith('/api/habits/')) return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unhandled GET ${url}`))
    })

    renderWithQuery(<HabitsHistoryPanel compact={false} onOpenDayForEdit={() => {}} />)
    await screen.findByRole('heading', { name: 'Evolução por hábito' })
    // A grade E o detalhe do dia se alimentam desta lista: uma passada aquece as
    // duas superfícies antes da primeira pintura das linhas.
    await waitFor(() => expect(prefetchSpy).toHaveBeenCalledWith(['barbell', 'airplane']))
  })
})
