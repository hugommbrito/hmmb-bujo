// Testes de ISOLAMENTO dos primitivos da variante "Registro em cards"
// (Story 16.1, Task 3). A superfície inteira é coberta em
// `pages/habits/HabitsRecordPage.test.tsx`; aqui provamos os contratos que
// pertencem ao PRIMITIVO e que qualquer consumidor futuro (Saúde reusa a mesma
// variante, por decisão do épico) herda:
//
//   ▶ `CompletionBar` é LEITURA (`role="img"`), nunca `progressbar`.
//   ▶ `HabitTrackerRow` mantém o estado TEXTUAL ligado ao checkbox por
//     `aria-describedby` — a marca nunca é canal único.
//   ▶ A coluna do pictograma resolve o glifo do `iconKey` (DW-60), e AUSÊNCIA
//     (chave nula, órfã ou malformada) é estado válido: coluna vazia, nunca
//     tofu, quadrado ou glifo de erro (gate 16.0 Q2).
//   ▶ O checkbox do numérico é INDICADOR (`disabled` mesmo online).
//   ▶ `HabitGroupCard` só mostra a legenda de multiplicador quando o dia não é
//     útil E o multiplicador difere de 1 (paridade `HabitTracker.tsx:164-167`).
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import client from '../../../../api/client'
import { createBujoTheme } from '../../../../theme'
import type { HabitDayEntry } from '../../types'
import { CompletionBar } from './CompletionBar'
import { EMPTY_GROUP, HabitGroupCard } from './HabitGroupCard'
import { DomainIcon } from './DomainIcon'
import { HabitTrackerRow, INVALID_NUMBER } from './HabitTrackerRow'

const mockPatch = client.patch as ReturnType<typeof vi.fn>

function entry(overrides: Partial<HabitDayEntry> = {}): HabitDayEntry {
  return {
    id: 'e1',
    habitId: 'h1',
    name: 'Alongamento',
    // A API AINDA devolve `emoticon`; nenhum primitivo o renderiza.
    emoticon: '🧘',
    // Nulo é o DEFAULT das fixtures de propósito: a maioria dos casos desta
    // suíte não é sobre pictograma, e ausência tem de ser inofensiva. Os testes
    // de glifo passam `iconKey` explicitamente (DW-60).
    iconKey: null,
    type: 'boolean',
    group: 'g1',
    unit: '',
    value: null,
    weightAtTime: '1.00',
    metaAtTime: null,
    bonusAtTime: null,
    dayType: 'weekday',
    multiplierAtTime: '1.00',
    ...overrides,
  }
}

const NUMERIC = entry({
  id: 'e2',
  habitId: 'h2',
  name: 'Corrida',
  type: 'numeric',
  unit: 'km',
  value: '2.1',
  weightAtTime: '3.00',
  metaAtTime: '8',
  bonusAtTime: '0',
})

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={createBujoTheme('light')}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mockPatch.mockResolvedValue({ data: {} })
})

describe('CompletionBar — leitura, nunca controle', () => {
  it('é `role="img"` com a porcentagem no nome acessível, e NÃO é progressbar', () => {
    render(<CompletionBar percent={64} label="Completude do dia: 64 por cento" />)
    expect(screen.getByRole('img', { name: 'Completude do dia: 64 por cento' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    // Nenhum texto próprio: o número tabular é do CHAMADOR (redundância
    // obrigatória, não duplicação na árvore acessível).
    expect(screen.getByRole('img').textContent).toBe('')
  })

  it('o escopo escolhe a altura do dia ou a do card de grupo', () => {
    const { unmount } = render(<CompletionBar percent={10} label="dia" />)
    expect(screen.getByTestId('completion-bar-day')).toBeInTheDocument()
    unmount()
    render(<CompletionBar percent={10} label="grupo" scope="group" />)
    expect(screen.getByTestId('completion-bar-group')).toBeInTheDocument()
  })
})

describe('HabitTrackerRow — anatomia e canais redundantes', () => {
  it('booleano: checkbox interativo nomeado pelo hábito, com o estado TEXTUAL ligado por aria-describedby', () => {
    renderWithQuery(<HabitTrackerRow entry={entry()} compact={false} />)
    const checkbox = screen.getByRole('checkbox', { name: 'Alongamento' })
    expect(checkbox).toBeEnabled()
    // "Não feito" é obrigatório: nulo NUNCA é apresentado como ausência.
    const stateId = checkbox.getAttribute('aria-describedby')!.split(' ')[0]
    expect(document.getElementById(stateId)).toHaveTextContent('Não feito')
  })

  it('chave VÁLIDA: o pictograma aparece na coluna, decorativo e em currentColor', async () => {
    const { container } = renderWithQuery(
      <HabitTrackerRow entry={entry({ iconKey: 'barbell' })} compact={false} />,
    )
    const glyph = screen.getByTestId('habit-glyph-column')
    // A coluna segue `aria-hidden`: o nome do hábito é o label visível e o
    // glifo NUNCA duplica nome acessível.
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    const svg = await waitFor(() => {
      const found = glyph.querySelector('svg')
      expect(found).not.toBeNull()
      return found!
    })
    expect(svg).toHaveAttribute('fill', 'currentColor')
    // A medida vem do token, nunca de um número cru.
    expect(svg.getAttribute('style')).toContain('var(--ds-domain-icon-size-default)')
    // O emoji saiu da interface, mesmo com o `emoticon` ainda no contrato.
    expect(container.textContent).not.toContain('🧘')
  })

  it('chave NULA: a coluna existe e fica VAZIA — layout idêntico ao da 16.1', async () => {
    const { container } = renderWithQuery(
      <>
        <HabitTrackerRow entry={entry()} compact={false} />
        <span data-testid="relogio">
          {/* Chave nunca usada antes nesta suíte: o relógio passa pelo import
              de verdade, então esperá-lo mede a janela real de resolução. */}
          <DomainIcon iconKey="alarm" />
        </span>
      </>,
    )
    const glyph = screen.getByTestId('habit-glyph-column')
    expect(glyph).toBeEmptyDOMElement()
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    // Passada a janela de resolução (o relógio ao lado já resolveu), a coluna
    // CONTINUA vazia: ausência não é estado transitório de loading.
    await waitFor(() =>
      expect(screen.getByTestId('relogio').querySelector('svg')).not.toBeNull(),
    )
    expect(glyph).toBeEmptyDOMElement()
    expect(container.textContent).not.toContain('🧘')
  })

  it('trocar `iconKey` troca o glifo: chave órfã limpa a coluna, chave nova resolve', async () => {
    // O `DomainIcon` é montado DIRETO (sem remontar a árvore em volta) para que
    // o `rerender` exercite a MESMA instância — é a troca de chave que muda o
    // resultado, não uma remontagem. (O frame intermediário é indefensável em
    // teste: o `act` do RTL libera o effect junto com o render.)
    const { rerender } = render(<DomainIcon iconKey="barbell" />)
    await waitFor(() => expect(document.querySelector('svg')).not.toBeNull())

    // Chave nova ÓRFÃ: pictograma errado por um frame é pior que coluna vazia.
    rerender(<DomainIcon iconKey="glifo-que-saiu" />)
    expect(document.querySelector('svg')).toBeNull()

    // Chave nova VÁLIDA: resolve o glifo dela.
    rerender(<DomainIcon iconKey="acorn" />)
    await waitFor(() => expect(document.querySelector('svg')).not.toBeNull())
  })

  it('chave ÓRFÃ ou em PascalCase: coluna vazia, sem tofu, quadrado ou glifo de erro', async () => {
    // Um `DomainIcon` com chave válida AINDA NÃO usada nesta suíte monta ao lado
    // como RELÓGIO: ele passa pelo import de verdade, então quando resolve a
    // janela já passou — só aí a coluna vazia prova ausência, e não "ainda não
    // chegou". Chave já cacheada não serviria: resolveria SÍNCRONA e o relógio
    // adiantaria, deixando o teste passar mesmo com um fallback a caminho.
    const relogios = ['airplane', 'anchor', 'archive']
    for (const [index, iconKey] of ['glifo-que-saiu', 'AddressBook', 'nao_kebab'].entries()) {
      const { unmount } = renderWithQuery(
        <>
          <HabitTrackerRow entry={entry({ iconKey })} compact={false} />
          <span data-testid="relogio">
            <DomainIcon iconKey={relogios[index]} />
          </span>
        </>,
      )
      await waitFor(() =>
        expect(screen.getByTestId('relogio').querySelector('svg')).not.toBeNull(),
      )
      const glyph = screen.getByTestId('habit-glyph-column')
      expect(glyph, iconKey).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('numérico: o checkbox é INDICADOR de meta e continua disabled mesmo online', () => {
    renderWithQuery(<HabitTrackerRow entry={NUMERIC} compact={false} />)
    const indicator = screen.getByRole('checkbox', { name: 'Corrida: indicador de meta' })
    expect(indicator).toBeDisabled()
    expect(indicator).not.toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Valor de Corrida' })).toHaveValue('2,1')
    expect(screen.getByTestId('habit-row-factors')).toHaveTextContent('Peso 3')
  })

  it('os fatores congelados aparecem separados quando o multiplicador ≠ 1', () => {
    renderWithQuery(
      <HabitTrackerRow
        entry={entry({ weightAtTime: '3.00', multiplierAtTime: '0.50', dayType: 'holiday' })}
        compact={false}
      />,
    )
    expect(screen.getByTestId('habit-row-factors')).toHaveTextContent('Peso 3 × 0,5 = 1,5')
  })

  it('texto que não é número não vira requisição: erro local com aria-invalid', async () => {
    const user = userEvent.setup()
    renderWithQuery(<HabitTrackerRow entry={NUMERIC} compact={false} />)
    const field = screen.getByRole('textbox', { name: 'Valor de Corrida' })
    await user.clear(field)
    await user.type(field, 'abc')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent(INVALID_NUMBER)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    // O valor DIGITADO fica no campo e nada foi enviado.
    expect(field).toHaveValue('abc')
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('voltar a digitar LIMPA o erro de formato (nada de aria-invalid sobre texto novo)', async () => {
    const user = userEvent.setup()
    renderWithQuery(<HabitTrackerRow entry={NUMERIC} compact={false} />)
    const field = screen.getByRole('textbox', { name: 'Valor de Corrida' })
    await user.clear(field)
    await user.type(field, 'abc')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent(INVALID_NUMBER)

    // Uma única tecla já retira a marca: manter `aria-invalid` sobre um texto
    // que mudou faz o leitor de tela anunciar inválido um valor válido.
    await user.type(field, '1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(field).not.toHaveAttribute('aria-invalid')
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('offline: controles indisponíveis apontando para o motivo, rótulos seguem legíveis', () => {
    renderWithQuery(
      <>
        <span id="offline-reason">Sem conexão. Registrar e configurar hábitos exige rede.</span>
        <HabitTrackerRow
          entry={entry()}
          compact={false}
          disabled
          disabledReasonId="offline-reason"
        />
      </>,
    )
    const checkbox = screen.getByRole('checkbox', { name: 'Alongamento' })
    expect(checkbox).toBeDisabled()
    expect(checkbox.getAttribute('aria-describedby')).toContain('offline-reason')
    expect(screen.getByText('Não feito')).toBeVisible()
  })
})

describe('HabitGroupCard — Panel por grupo', () => {
  const group = { id: 'g1', name: 'Corpo', completion: 75 }

  it('cabeçalho traz nome, peso efetivo somado e a porcentagem em TEXTO ao lado da barra', () => {
    renderWithQuery(
      <HabitGroupCard
        group={group}
        entries={[entry(), NUMERIC]}
        compact={false}
        headingId="h-corpo"
      />,
    )
    const card = screen.getByTestId('habit-group-card')
    expect(within(card).getByRole('heading', { name: 'Corpo' })).toBeInTheDocument()
    // 1×1 + 3×1 = 4,0 — transparência do denominador, não recálculo.
    expect(within(card).getByText('peso efetivo 4,0')).toBeInTheDocument()
    expect(screen.getByTestId('habit-group-percent')).toHaveTextContent('75%')
    expect(
      within(card).getByRole('img', { name: 'Completude do grupo Corpo: 75 por cento' }),
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('habit-tracker-row')).toHaveLength(2)
  })

  it('grupo vazio é estado LEGÍTIMO: a frase não sugere ação', () => {
    renderWithQuery(
      <HabitGroupCard group={group} entries={[]} compact={false} headingId="h-corpo" />,
    )
    expect(screen.getByText(EMPTY_GROUP)).toBeInTheDocument()
    expect(screen.queryByTestId('habit-tracker-row')).not.toBeInTheDocument()
  })

  it('legenda de multiplicador só com dia ≠ útil E multiplicador ≠ 1', () => {
    const { unmount } = renderWithQuery(
      <HabitGroupCard
        group={group}
        entries={[entry({ dayType: 'holiday', multiplierAtTime: '0.50' })]}
        compact={false}
        headingId="h-corpo"
      />,
    )
    expect(screen.getByText('Feriado · peso ×0,5 neste grupo')).toBeInTheDocument()
    unmount()

    // Multiplicador 1 em dia não útil: NENHUMA legenda (não há o que explicar).
    renderWithQuery(
      <HabitGroupCard
        group={group}
        entries={[entry({ dayType: 'weekend', multiplierAtTime: '1.00' })]}
        compact={false}
        headingId="h-corpo"
      />,
    )
    expect(screen.queryByText(/peso ×/)).not.toBeInTheDocument()
  })
})
