// Seletor de pictograma (DW-64) — as linhas da I/O Matrix, nas DUAS faixas.
//
// O catálogo é MOCKADO: o real tem 1512 módulos e cada teste pagaria o preço de
// carregá-los para provar comportamento que não depende deles. A blindagem do
// catálogo real vive em `features/habits/phosphorCatalog.test.ts`.
//
// A assertiva que mais importa aqui é a CONTAGEM DE NÓS MONTADOS: sem ela, a
// grade pode voltar a montar os ~1.500 tiles e todo o resto continua verde
// (gate 16.0, Q1 — virtualização é obrigatória, não otimização).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhosphorCatalog } from '../../phosphorCatalog'

// A carga é trocável por teste (sucesso, pendente, falha) sem re-mockar o módulo.
let load: () => Promise<PhosphorCatalog>

vi.mock('../../phosphorCatalog', () => ({
  loadPhosphorCatalog: () => load(),
}))

import { PictogramPicker } from './PictogramPicker'

/** Glifo de mentira: só precisa ser um componente que rende um `svg`. */
function MockGlyph() {
  return <svg data-testid="tile-glyph" />
}

function catalogOf(names: readonly string[]): PhosphorCatalog {
  const sorted = [...names].sort()
  const set = new Set(sorted)
  return {
    names: sorted,
    get: (kebab) => (set.has(kebab) ? (MockGlyph as unknown as ReturnType<PhosphorCatalog['get']>) : null),
  }
}

// Catálogo pequeno com os nomes do mockup O1/O2 — 14 nomes, 7 deles contendo
// "dr". Pequeno de propósito: cabe inteiro na janela, então a navegação por
// setas é observável sem depender de rolagem.
const NAMES = [
  'acorn',
  'alarm',
  'barbell',
  'book-open',
  'brain',
  'carrot',
  'dress',
  'dresser',
  'drone',
  'drop',
  'drop-half',
  'drop-simple',
  'drumsticks',
  'guitar',
]
const USED = ['barbell', 'drop']
/** Ordem de abertura: chaves EM USO primeiro, resto alfabético. */
const OPEN_ORDER = ['barbell', 'drop', 'acorn', 'alarm', 'book-open', 'brain', 'carrot', 'dress', 'dresser', 'drone', 'drop-half', 'drop-simple', 'drumsticks', 'guitar']

/** 1512 nomes kebab distintos, para a assertiva de virtualização. */
function letters(index: number): string {
  let out = ''
  let value = index
  do {
    out = String.fromCharCode(97 + (value % 26)) + out
    value = Math.floor(value / 26)
  } while (value > 0)
  return out
}
const BIG_NAMES = Array.from({ length: 1512 }, (_, index) => `glifo-${letters(index)}`)

interface Harness {
  onConfirm: ReturnType<typeof vi.fn>
  onClose: ReturnType<typeof vi.fn>
}

function renderPicker(
  options: { compact?: boolean; value?: string | null; usedKeys?: readonly string[] } = {},
): Harness {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <PictogramPicker
      value={options.value ?? null}
      compact={options.compact ?? false}
      usedKeys={options.usedKeys ?? USED}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )
  return { onConfirm, onClose }
}

const grid = () => screen.getByRole('radiogroup', { name: 'Pictogramas disponíveis' })
/**
 * As três ações na ORDEM DO DOM — que é a ordem de foco. A primária entra como
 * `'confirmar'` porque o rótulo dela carrega a chave escolhida.
 */
const footerOrder = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter(
      (label) =>
        label.startsWith('Usar pictograma') ||
        label === 'Remover pictograma' ||
        label === 'Cancelar',
    )
    .map((label) => (label.startsWith('Usar pictograma') ? 'confirmar' : label))
const tiles = () => screen.getAllByRole('radio')
const count = () => screen.getByTestId('pictogram-picker-count')

beforeEach(() => {
  load = () => Promise.resolve(catalogOf(NAMES))
})

// ─────────────────────────────────────────────────────────────────────────────
// Abertura, ordem e contagem
// ─────────────────────────────────────────────────────────────────────────────

describe('DW-64 — abertura e contagem anunciada', () => {
  it('sem busca, abre pelas chaves EM USO e segue alfabético; a contagem é o total', async () => {
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    expect(tiles().map((tile) => tile.textContent)).toEqual(OPEN_ORDER)
    // O GLIFO, não só o rótulo. Apagar `{Glyph != null && <Glyph …/>}` do tile
    // deixava a suíte inteira verde e o seletor virava uma grade de nomes em
    // inglês — provado por mutação.
    for (const tile of tiles()) {
      expect(within(tile).getByTestId('tile-glyph'), tile.textContent ?? '').toBeInTheDocument()
    }
    expect(count()).toHaveTextContent('14 ícones')
    // A contagem é ANUNCIADA, não só escrita.
    expect(count()).toHaveAttribute('aria-live', 'polite')
    expect(count()).toHaveAttribute('role', 'status')
  })

  it('o título, o subtítulo e o rótulo `sr-only` da busca são os do gate', async () => {
    renderPicker()
    expect(await screen.findByText('Escolher pictograma')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Busque pelo nome do glifo em inglês. O nome não aparece fora deste seletor.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar pictograma')).toBeInTheDocument()
  })

  it('busca por substring filtra e anuncia a contagem com a consulta', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    await user.type(screen.getByLabelText('Buscar pictograma'), 'dr')
    await waitFor(() => expect(count()).toHaveTextContent('7 de 14 ícones contêm "dr"'))
    expect(tiles().map((tile) => tile.textContent)).toEqual([
      'drop',
      'dress',
      'dresser',
      'drone',
      'drop-half',
      'drop-simple',
      'drumsticks',
    ])
  })

  it('busca de UM resultado concorda o verbo no singular', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    await user.type(screen.getByLabelText('Buscar pictograma'), 'guit')
    await waitFor(() => expect(count()).toHaveTextContent('1 de 14 ícones contém "guit"'))
  })

  it('busca sem resultado: grade vazia com a frase do gate e contagem ZERO anunciada', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    await user.type(screen.getByLabelText('Buscar pictograma'), 'zzz')
    await waitFor(() => expect(count()).toHaveTextContent('0 de 14 ícones contêm "zzz"'))
    expect(screen.getByText('Nenhum ícone contém «zzz»')).toBeInTheDocument()
    // Nenhum `radiogroup` VAZIO: um grupo sem `radio` é grupo mentiroso.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Carga e falha do chunk do catálogo
// ─────────────────────────────────────────────────────────────────────────────

describe('DW-64 — carga e falha do catálogo', () => {
  it('enquanto o chunk não chega: `role="status"`, grade vazia e AÇÕES desabilitadas', () => {
    load = () => new Promise(() => {})
    renderPicker({ value: 'drop' })
    // A MESMA região viva que depois vira a contagem — não uma segunda região
    // inserida já preenchida (que leitor de tela nenhum anunciaria).
    const live = screen.getByRole('status')
    expect(live).toHaveTextContent('Carregando catálogo…')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toBe(count())
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    // Desabilitado MESMO com seleção herdada: confirmar sem catálogo enviaria
    // uma chave que a UI não conseguiu validar contra o pacote instalado.
    expect(screen.getByRole('button', { name: /^Usar pictograma/ })).toBeDisabled()
    // "Remover" também: enquanto o overlay não é utilizável, nenhuma de suas
    // escritas é (e confirmar já estava desabilitado ao lado dela).
    expect(screen.getByRole('button', { name: 'Remover pictograma' })).toBeDisabled()
  })

  it('a região viva PERSISTE da carga até a contagem — é ela que anuncia o total', async () => {
    // Deferred criado ANTES do render: `loadPhosphorCatalog` só é chamado num
    // microtask depois do `import()`, então capturar o `resolve` dentro do
    // executor de `load()` chegaria tarde.
    let resolveCatalog!: (value: PhosphorCatalog) => void
    const pending = new Promise<PhosphorCatalog>((resolve) => {
      resolveCatalog = resolve
    })
    load = () => pending
    renderPicker()
    const live = count()
    expect(live).toHaveTextContent('Carregando catálogo…')

    await act(async () => {
      resolveCatalog(catalogOf(NAMES))
    })
    // MESMO nó, conteúdo novo: a mudança é o que a tecnologia assistiva fala.
    // (Uma região INSERIDA já preenchida não seria anunciada nenhuma vez.)
    await waitFor(() => expect(live).toHaveTextContent('14 ícones'))
    expect(count()).toBe(live)
  })

  it('catálogo que resolve VAZIO é falha, não grade vazia — alerta com retry', async () => {
    const user = userEvent.setup()
    load = () => Promise.resolve(catalogOf([]))
    renderPicker()
    // Sem isto, um catálogo vazio abriria "0 ícones" + "Nenhum ícone contém «»"
    // e o usuário não teria saída — a mesma falha silenciosa da P2 da DW-60.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o catálogo de pictogramas.',
    )
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Nenhum ícone contém/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Usar pictograma/ })).toBeDisabled()

    load = () => Promise.resolve(catalogOf(NAMES))
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
  })

  it('chunk que falha: `role="alert"` + "Tentar de novo", overlay ABERTO e nada enviado', async () => {
    const user = userEvent.setup()
    load = () => Promise.reject(new Error('chunk boom'))
    const { onConfirm, onClose } = renderPicker({ value: 'drop' })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar o catálogo de pictogramas.')
    // O overlay PERMANECE aberto e o rascunho intocado.
    expect(screen.getByText('Escolher pictograma')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    load = () => Promise.resolve(catalogOf(NAMES))
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Seleção, teclado e confirmação
// ─────────────────────────────────────────────────────────────────────────────

describe('DW-64 — seleção sem controle desenhado', () => {
  it('o tile é `role="radio"` com `aria-checked`, e a ação de confirmar NOMEIA a chave', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    // Sem seleção, confirmar não tem chave para nomear.
    expect(screen.getByRole('button', { name: 'Usar pictograma' })).toBeDisabled()
    // Nenhum checkbox/checkmark desenhado dentro da grade.
    expect(within(grid()).queryAllByRole('checkbox')).toHaveLength(0)

    await user.click(screen.getByRole('radio', { name: 'drop' }))
    expect(screen.getByRole('radio', { name: 'drop' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'barbell' })).toHaveAttribute('aria-checked', 'false')

    const confirm = screen.getByRole('button', { name: 'Usar pictograma drop' })
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('drop')
  })

  it('a chave vigente chega PRÉ-SELECIONADA', async () => {
    renderPicker({ value: 'drop' })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    expect(screen.getByRole('radio', { name: 'drop' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Usar pictograma drop' })).toBeEnabled()
  })

  it('chave ÓRFÃ pré-selecionada NÃO é confirmável — o catálogo acabou de provar que não existe', async () => {
    renderPicker({ value: 'glifo-que-saiu' })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    // Confirmar reenviaria a chave e o servidor recusaria o PATCH de identidade
    // INTEIRO com 400 — nome, unidade e grupo cairiam junto.
    expect(screen.getByRole('button', { name: 'Usar pictograma glifo-que-saiu' })).toBeDisabled()
    expect(tiles().some((tile) => tile.getAttribute('aria-checked') === 'true')).toBe(false)
    // "Remover pictograma" continua sendo a saída: é o caminho para limpar a órfã.
    expect(screen.getByRole('button', { name: 'Remover pictograma' })).toBeEnabled()
  })

  it('a seta parte do tile em FOCO, não da seleção — Tab e depois seta ANDA', async () => {
    const user = userEvent.setup()
    renderPicker({ value: null })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })

    // Nada selecionado (formulário de criação). Tab sai da busca e pousa no
    // único tab stop da grade: `barbell`, índice 0.
    await user.click(screen.getByLabelText('Buscar pictograma'))
    await user.tab()
    expect(screen.getByRole('radio', { name: 'barbell' })).toHaveFocus()

    // Ancorada na SELEÇÃO (nula ⇒ índice -1), a seta ficaria parada em `barbell`.
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'drop' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'drop' })).toHaveFocus()
  })

  it('setas percorrem com WRAP e select-follows-focus; Enter seleciona', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })

    await user.click(screen.getByRole('radio', { name: 'barbell' }))
    // ArrowRight avança um; a seleção SEGUE o foco (sem segunda tecla).
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'drop' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'drop' })).toHaveFocus()

    // ArrowDown salta uma LINHA (6 colunas em wide): índice 1 → 7 = `dress`.
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'dress' })).toHaveAttribute('aria-checked', 'true')

    // Wrap na ponta de baixo: do índice 0, ArrowLeft vai ao ÚLTIMO.
    await user.click(screen.getByRole('radio', { name: 'barbell' }))
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'guitar' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'guitar' })).toHaveFocus()

    // Enter no tile focado seleciona (o tile é `<button>`: a tecla vira click).
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'barbell' })).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('radio', { name: 'barbell' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Usar pictograma barbell' })).toBeEnabled()
  })

  it('roving tabindex: UM tab stop na grade', async () => {
    renderPicker({ value: 'drop' })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    const stops = tiles().filter((tile) => tile.getAttribute('tabindex') === '0')
    expect(stops).toHaveLength(1)
    expect(stops[0]).toHaveTextContent('drop')
  })

  // Propriedade ESTRUTURAL, não guard: o input de busca é IRMÃO do contêiner de
  // rolagem, nunca descendente do `radiogroup` que carrega o `onKeyDown` — então
  // a seta digitada na busca não tem por onde chegar ao handler. Este teste
  // ancora a estrutura; se alguém mover o input para dentro da grade, ele cai.
  it('seta com o foco na BUSCA não é capturada pelo radiogroup', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    const search = screen.getByLabelText('Buscar pictograma')
    await user.click(search)
    await user.keyboard('{ArrowDown}{ArrowRight}')
    expect(search).toHaveFocus()
    expect(tiles().some((tile) => tile.getAttribute('aria-checked') === 'true')).toBe(false)
    expect(screen.getByRole('button', { name: 'Usar pictograma' })).toBeDisabled()
  })
})

describe('DW-64 — sair do seletor', () => {
  it('"Remover pictograma" confirma a AUSÊNCIA (null), não fecha em silêncio', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderPicker({ value: 'drop' })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    await user.click(screen.getByRole('button', { name: 'Remover pictograma' }))
    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('"Cancelar" e Esc fecham SEM aplicar a seleção nova', async () => {
    const user = userEvent.setup()
    const { onConfirm, onClose } = renderPicker({ value: 'barbell' })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })

    await user.click(screen.getByRole('radio', { name: 'drop' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Virtualização — a assertiva que sustenta o gate
// ─────────────────────────────────────────────────────────────────────────────

describe('DW-64 — a grade é virtualizada', () => {
  beforeEach(() => {
    load = () => Promise.resolve(catalogOf(BIG_NAMES))
  })

  it('com 1.512 nomes o DOM tem ordem de DEZENAS de tiles, nunca os ~1.500', async () => {
    renderPicker({ usedKeys: [] })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    expect(count()).toHaveTextContent('1.512 ícones')
    const mounted = tiles().length
    expect(mounted).toBeGreaterThan(10)
    expect(mounted).toBeLessThan(200)
  })

  it('a chave vigente é ROLADA para a vista ao abrir, mesmo centenas de linhas abaixo', async () => {
    const sorted = [...BIG_NAMES].sort()
    const target = sorted[600]
    renderPicker({ usedKeys: [], value: target })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    // Sem a rolagem inicial a janela ficaria nas primeiras linhas e a grade
    // abriria sem NADA marcado na tela — o caso do formulário de criação, onde
    // não há chave em uso à frente para trazer a seleção ao topo.
    const marked = screen.getByRole('radio', { name: target })
    expect(marked).toHaveAttribute('aria-checked', 'true')
    // E continua virtualizada: rolar não é montar tudo.
    expect(tiles().length).toBeLessThan(200)
    expect(screen.getByRole('button', { name: `Usar pictograma ${target}` })).toBeEnabled()
  })

  it('rolar TROCA os tiles montados sem mudar a contagem anunciada', async () => {
    renderPicker({ usedKeys: [] })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    const before = tiles().map((tile) => tile.textContent)
    const antes = count().textContent

    // jsdom não tem layout: `clientHeight`/`scrollTop` são encenados para que a
    // aritmética da janela seja exercitada de verdade.
    const scroller = screen.getByTestId('pictogram-picker-scroll')
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 3600 })
    fireEvent.scroll(scroller)

    const after = tiles().map((tile) => tile.textContent)
    expect(after).not.toEqual(before)
    // Nenhum tile em comum: a janela andou de verdade, não só cresceu.
    expect(after.filter((name) => before.includes(name))).toHaveLength(0)
    expect(after.length).toBeLessThan(200)
    // A contagem é do FILTRO, não da janela.
    expect(count().textContent).toBe(antes)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// As duas faixas
// ─────────────────────────────────────────────────────────────────────────────

describe('DW-64 — Dialog em wide, Drawer em compact', () => {
  it('wide: EXATAMENTE um `role="dialog"`, nomeado, com 6 colunas', async () => {
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]).toHaveAccessibleName('Escolher pictograma')
    expect(grid()).toHaveAttribute('data-columns', '6')
    // Em wide a primária é a ÚLTIMA (vai para a direita por `margin-left: auto`).
    expect(footerOrder()).toEqual(['Remover pictograma', 'Cancelar', 'confirmar'])
    expect(await axe(document.body)).toHaveNoViolations()
  })

  it('compact: EXATAMENTE um `role="dialog"`, nomeado, com 4 colunas', async () => {
    renderPicker({ compact: true })
    await screen.findByRole('radiogroup', { name: 'Pictogramas disponíveis' })
    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]).toHaveAccessibleName('Escolher pictograma')
    expect(grid()).toHaveAttribute('data-columns', '4')
    // Em compact a primária é pintada NO TOPO, e a ordem do DOM (= ordem de
    // foco) tem de ser a mesma: `column-reverse` fazia o teclado ler o rodapé de
    // baixo para cima enquanto os olhos leem de cima para baixo (WCAG 2.4.3).
    expect(footerOrder()).toEqual(['confirmar', 'Remover pictograma', 'Cancelar'])
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
