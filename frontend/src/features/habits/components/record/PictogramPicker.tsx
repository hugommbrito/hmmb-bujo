// ─────────────────────────────────────────────────────────────────────────────
// Seletor de pictograma (DW-64) — frames **O1 · O2** do gate 16.0, e a ÚNICA
// profundidade de overlay do módulo de Hábitos.
//
//   ▶ ANATOMIA DE OVERLAY (molde de `bujo/components/DestinationPicker.tsx`):
//     `Drawer anchor="bottom"` em compact, `Dialog` portalizado em wide, escolha
//     pela prop `compact` — o breakpoint mora no CALL-SITE (`HabitsRecordPage`
//     já calcula `compact = !isTabletUp`). `shellCssVariables` é aplicado nos
//     QUATRO slots (paper e backdrop de cada faixa): Drawer/Dialog portalizam
//     para `document.body` e perdem a herança das `--ds-*`.
//
//   ▶ ARIA CONDICIONAL: `role="dialog"` + `aria-label` no wrapper SÓ quando
//     `compact`. O `Drawer` não estampa papel no paper; o `Dialog` já estampa o
//     seu (com `aria-modal`), e repetir aqui aninharia dois dialogs — o de fora
//     sem nome. No caminho Dialog o nome vai em `slotProps.paper['aria-label']`.
//
//   ▶ VIRTUALIZAÇÃO PRÓPRIA, OBRIGATÓRIA (gate 16.0, Q1). A grade nunca monta os
//     ~1.500 nós: renderiza só as linhas da janela visível mais `OVERSCAN_ROWS`
//     de folga em cada ponta, posicionadas em `absolute` dentro de um sizer da
//     altura TOTAL (é o sizer que dá a barra de rolagem honesta). O projeto não
//     tem biblioteca de virtualização e esta spec não introduz uma — a janela é
//     aritmética de `scrollTop / rowStep`, e `rowStep` sai do TOKEN
//     (`pictogramPicker.tileHeight*` + `spacing[2]`), nunca de magic number.
//
//   ▶ O TILE NÃO USA `DomainIcon`. `DomainIcon` resolve por chave, de forma
//     assíncrona, e trata ausência como estado válido SEM loading — correto para
//     uma coluna decorativa, errado para um tile cuja razão de existir é ser
//     visto. Aqui o componente já está em memória (veio do catálogo), então é
//     renderizado direto com os MESMOS atributos (`weight="regular"`,
//     `color="currentColor"`, medida por `var(--ds-domain-icon-size-default)`,
//     `aria-hidden` porque o nome do glifo está escrito ao lado). Cinco linhas
//     duplicadas é o preço de não acoplar as duas fontes de resolução.
//
//   ▶ LOADING É LEGÍTIMO AQUI e proibido no `DomainIcon`: lá a coluna vazia já é
//     o estado válido; aqui não existe estado válido de grade vazia, então a
//     espera pelo chunk é DITA (`role="status"`) e a falha tem retry.
//
//   ▶ NADA É SALVO DAQUI. `onConfirm` só atualiza o rascunho da identidade; a
//     persistência é o "Salvar alterações" (PATCH de identidade) ou o "Adicionar
//     hábito" (POST) que já existem em `HabitsConfigPanel`.
//
//   ▶ DESVIO DECLARADO DO MOCKUP: o mockup desenha o glifo do tile a 24px,
//     medida que NÃO existe no contrato de `domainIcon` (que só tem `default` e
//     `compact`) e que a própria nota "Tamanhos do pictograma" do gate não
//     enumera. O tile usa a medida `default`
//     (`var(--ds-domain-icon-size-default)`), preservando o contrato do design
//     system em vez de criar uma terceira medida só para ele.
//
// [Source: mockups/key-habitos.html frames O1/O2; EXPERIENCE.md §Pictogramas de
//  hábitos e saúde; gate 16.0 Q1; spec DW-64 Tasks 6-8 + I/O Matrix]
// ─────────────────────────────────────────────────────────────────────────────
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type UIEvent,
} from 'react'
import { Box, Button, Dialog, Drawer } from '@mui/material'

import { pictogramPicker, shellCssVariables, spacing, typography } from '../../../../shared/design/tokens'
import type { PhosphorCatalog } from '../../phosphorCatalog'
import { isKebabIconKey } from '../../iconKey'
import { DomainIcon } from './DomainIcon'
import { Field } from './HabitsFormControls'
import { PRIMARY_BUTTON_SX, SECONDARY_BUTTON_SX, CONTROL_STYLE, controlStyle } from './habitsFormStyles'
import { RETRY_LABEL } from './habitsSurface'

// ─── Textos verbatim do gate ─────────────────────────────────────────────────

export const PICKER_TITLE = 'Escolher pictograma'
export const PICKER_SUBTITLE =
  'Busque pelo nome do glifo em inglês. O nome não aparece fora deste seletor.'
export const SEARCH_LABEL = 'Buscar pictograma'
export const SEARCH_PLACEHOLDER = 'Ex.: drop, book, run'
export const GRID_LABEL = 'Pictogramas disponíveis'
export const CATALOG_LOADING = 'Carregando catálogo…'
export const CATALOG_ERROR = 'Não foi possível carregar o catálogo de pictogramas.'
export const CONFIRM_PREFIX = 'Usar pictograma'
export const REMOVE_LABEL = 'Remover pictograma'
export const CANCEL_LABEL = 'Cancelar'
/** Rótulo do CAMPO (o gatilho), não do overlay. */
export const FIELD_LABEL = 'Pictograma'
export const TRIGGER_CHOSEN = 'Pictograma escolhido'
export const TRIGGER_EMPTY = 'Nenhum pictograma escolhido'
export const TRIGGER_HINT_CHANGE = 'Trocar'
export const TRIGGER_HINT_PICK = 'Escolher'

// ─── Geometria da janela virtual ─────────────────────────────────────────────

/**
 * Linhas de FOLGA renderizadas acima e abaixo da janela visível, para que a
 * rolagem não exponha vazio entre um frame e o próximo.
 */
const OVERSCAN_ROWS = 2
/**
 * Piso de linhas na janela. Em jsdom `clientHeight` é sempre 0 (não há layout):
 * sem o piso a grade renderizaria SÓ a folga, e a assertiva de virtualização
 * mediria um artefato do ambiente em vez do comportamento. Casa com o
 * multiplicador do `maxHeight` do contêiner de rolagem.
 */
const VIEWPORT_ROWS = 6

const GRID_GAP = Number.parseInt(spacing[2], 10)

interface Faixa {
  columns: number
  /** Altura da linha (a do tile) — token, verbatim do mockup. */
  tileHeight: number
  tileHeightVar: string
}

const DIALOG_FAIXA: Faixa = {
  columns: pictogramPicker.columnsDialog,
  tileHeight: Number.parseInt(pictogramPicker.tileHeightDialog, 10),
  tileHeightVar: 'var(--ds-pictogram-picker-tile-height-dialog)',
}
const SHEET_FAIXA: Faixa = {
  columns: pictogramPicker.columnsSheet,
  tileHeight: Number.parseInt(pictogramPicker.tileHeightSheet, 10),
  tileHeightVar: 'var(--ds-pictogram-picker-tile-height-sheet)',
}

// ─── Texto da contagem ───────────────────────────────────────────────────────

const numberFormat = new Intl.NumberFormat('pt-BR')

/**
 * Contagem ANUNCIADA (`role="status" aria-live="polite"`), pluralizada à mão em
 * pt-BR sobre o array já filtrado — mesmo padrão de `ArchivePage`, sem efeito
 * nem estado extra. O substantivo concorda com o TOTAL ("de 1.512 ícones") e o
 * verbo com o filtrado ("1 … contém" × "11 … contêm").
 */
function iconCountLabel(filtered: number, total: number, query: string): string {
  const noun = total === 1 ? 'ícone' : 'ícones'
  if (query === '') return `${numberFormat.format(total)} ${noun}`
  const verb = filtered === 1 ? 'contém' : 'contêm'
  return `${numberFormat.format(filtered)} de ${numberFormat.format(total)} ${noun} ${verb} "${query}"`
}

/** Vazio de BUSCA (não de catálogo): o gate escreve a consulta entre guillemets. */
function noMatchLabel(query: string): string {
  return `Nenhum ícone contém «${query}»`
}

/**
 * Ordem de abertura: as chaves JÁ USADAS pelos hábitos existentes primeiro,
 * depois o catálogo em ordem alfabética (`EXPERIENCE.md`). Sem categorias e sem
 * sinônimos em pt-BR. A busca filtra ESTA lista, então a chave em uso continua
 * vindo antes das demais que casam o mesmo substring.
 */
function orderedNames(
  names: readonly string[],
  usedKeys: readonly string[],
): readonly string[] {
  const catalog = new Set(names)
  const used: string[] = []
  const seen = new Set<string>()
  for (const key of usedKeys) {
    if (!catalog.has(key) || seen.has(key)) continue
    seen.add(key)
    used.push(key)
  }
  return [...used, ...names.filter((name) => !seen.has(name))]
}

// ─── Estilos locais ──────────────────────────────────────────────────────────

/** Texto só para leitor de tela (o rótulo do campo de busca, frame O1/O2). */
const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const

const GLYPH_STYLE: CSSProperties = {
  width: 'var(--ds-domain-icon-size-default)',
  height: 'var(--ds-domain-icon-size-default)',
  flex: '0 0 auto',
}

// ─── O overlay ───────────────────────────────────────────────────────────────

export interface PictogramPickerProps {
  /** Chave vigente do rascunho (`null` = sem pictograma). */
  value: string | null
  compact: boolean
  /** Chaves já usadas pelos hábitos existentes — abrem a lista. */
  usedKeys?: readonly string[]
  /** Confirmação: chave escolhida, ou `null` para "Remover pictograma". */
  onConfirm: (next: string | null) => void
  /** Cancelar, Esc e backdrop — fecha SEM aplicar. */
  onClose: () => void
}

export function PictogramPicker({
  value,
  compact,
  usedKeys = [],
  onConfirm,
  onClose,
}: PictogramPickerProps) {
  const faixa = compact ? SHEET_FAIXA : DIALOG_FAIXA
  const rowStep = faixa.tileHeight + GRID_GAP

  const [catalog, setCatalog] = useState<PhosphorCatalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(value)
  /**
   * Índice do tile em FOCO dentro de `visible` — a âncora da navegação por seta.
   *
   * Ancorar na SELEÇÃO não serve: depois do Tab pousar no tab stop, `selected`
   * pode ser nulo (criação) ou estar fora da janela (chave em uso muito abaixo),
   * e aí `indexOf` devolve -1 — a seta não anda, ou teleporta para o índice 0.
   * O foco é o que o usuário vê; é dele que a seta parte.
   */
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(VIEWPORT_ROWS * rowStep)
  /**
   * A região de contagem (`role="status" aria-live="polite"`) precisa EXISTIR
   * antes de ter conteúdo: leitor de tela não anuncia região viva que é INSERIDA
   * já preenchida. Este flag vira `true` no efeito de carga — um render depois do
   * primeiro —, então "Carregando catálogo…" e a contagem são MUDANÇAS de uma
   * região que já estava lá, e as duas são faladas.
   */
  const [liveRegionArmed, setLiveRegionArmed] = useState(false)

  const searchId = `pictogram-picker-search-${useId()}`
  const scrollRef = useRef<HTMLDivElement | null>(null)
  /**
   * Foco inicial no campo de busca — o fluxo do gate é "busque pelo nome". Um
   * FRAME depois, não no próprio callback ref: o `FocusTrap` do MUI foca a raiz
   * do overlay no efeito DELE, que roda depois deste callback (molde de
   * `DestinationDialog`). A ref de idempotência impede que um re-render traga o
   * foco de volta ao input depois de o usuário navegar para a grade.
   */
  const initialFocusDoneRef = useRef(false)
  function captureInitialFocus(element: HTMLInputElement | null) {
    if (element == null || initialFocusDoneRef.current) return
    initialFocusDoneRef.current = true
    requestAnimationFrame(() => element.focus())
  }
  const tileRefs = useRef(new Map<string, HTMLElement>())
  /** Pedido de foco pendente: a tecla escolhe a chave, o efeito foca o tile —
   *  que pode ainda não estar montado quando a seta atravessa a janela. */
  const pendingFocusRef = useRef(false)

  // O catálogo mora num chunk PRÓPRIO (5,31 MB / 1,12 MB gzip, medido),
  // alcançado SÓ por `import()`. Um `import` estático de `phosphorCatalog` aqui
  // arrastaria os 5 MB para o chunk da rota de Hábitos — é exatamente o que o
  // desenho evita, e o que a Verification do spec caça.
  useEffect(() => {
    let alive = true
    setFailed(false)
    setCatalog(null)
    setLiveRegionArmed(true)
    void import('../../phosphorCatalog')
      .then((mod) => mod.loadPhosphorCatalog())
      .then((loaded) => {
        if (alive) setCatalog(loaded)
      })
      .catch(() => {
        // Falha de rede no chunk NÃO fecha o overlay e NÃO toca o rascunho: o
        // usuário pediu para escolher, então a espera frustrada precisa de
        // retry, não de um seletor que desaparece.
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [attempt])

  const ordered = useMemo(
    () => (catalog == null ? [] : orderedNames(catalog.names, usedKeys)),
    // `usedKeys` chega como array novo a cada render do painel; a identidade da
    // LISTA é o que importa, e ela é estável dentro de uma abertura do overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle === '' ? ordered : ordered.filter((name) => name.includes(needle))
  }, [ordered, query])

  const totalRows = Math.ceil(visible.length / faixa.columns)
  const firstVisibleRow = Math.floor(scrollTop / rowStep)
  const rowsInView = Math.max(VIEWPORT_ROWS, Math.ceil(viewportHeight / rowStep))
  const startRow = Math.max(0, firstVisibleRow - OVERSCAN_ROWS)
  const endRow = Math.min(totalRows, firstVisibleRow + rowsInView + OVERSCAN_ROWS)
  const windowNames = visible.slice(startRow * faixa.columns, endRow * faixa.columns)

  // Roving tabindex: UM tab stop no grupo. Quando a seleção está fora da janela
  // (chave em uso muito abaixo, ou filtrada), o primeiro tile renderizado
  // assume o tab stop — sem isto a grade ficaria inalcançável por Tab.
  const tabStop =
    selected != null && windowNames.includes(selected) ? selected : (windowNames[0] ?? null)

  useEffect(() => {
    const element = scrollRef.current
    if (element == null) return
    if (element.clientHeight > 0) setViewportHeight(element.clientHeight)
  }, [catalog, compact])

  // Rola até a LINHA da seleção quando o catálogo chega. Sem isto, no formulário
  // de CRIAÇÃO (nenhuma chave em uso à frente na lista) a chave vigente fica
  // centenas de linhas abaixo da dobra e a grade abre sem nada marcado na tela.
  // Idempotente: uma vez por abertura, para não desfazer a rolagem do usuário.
  const initialScrollDoneRef = useRef(false)
  useEffect(() => {
    if (catalog == null || initialScrollDoneRef.current) return
    initialScrollDoneRef.current = true
    if (selected == null) return
    const index = visible.indexOf(selected)
    if (index < 0) return
    setFocusIndex(index)
    scrollToRow(Math.floor(index / faixa.columns))
    // `visible`/`scrollToRow` derivam do catálogo que acabou de chegar; reagir a
    // eles reabriria a rolagem a cada tecla digitada na busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog])

  useEffect(() => {
    if (!pendingFocusRef.current || selected == null) return
    const element = tileRefs.current.get(selected)
    if (element == null) return
    pendingFocusRef.current = false
    element.focus()
  })

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop)
    if (event.currentTarget.clientHeight > 0) setViewportHeight(event.currentTarget.clientHeight)
  }

  function scrollToRow(row: number) {
    const top = row * rowStep
    let next = scrollTop
    if (top < scrollTop) next = top
    else if (top + rowStep > scrollTop + viewportHeight) next = top + rowStep - viewportHeight
    if (next === scrollTop) return
    setScrollTop(next)
    // O DOM também: em navegador real a atribuição dispara `scroll`, que
    // reconcilia o estado; em jsdom o estado acima é a única fonte.
    if (scrollRef.current != null) scrollRef.current.scrollTop = next
  }

  function moveSelection(delta: number) {
    if (visible.length === 0) return
    // Âncora: o FOCO. Cai na seleção só quando não há foco (teclado antes de
    // qualquer Tab/clique) e, sem nem isso, no primeiro tile.
    const focused = focusIndex != null && focusIndex >= 0 && focusIndex < visible.length
    const anchor = focused
      ? focusIndex
      : selected != null
        ? visible.indexOf(selected)
        : -1
    const next =
      anchor < 0 ? 0 : (((anchor + delta) % visible.length) + visible.length) % visible.length
    setSelected(visible[next])
    setFocusIndex(next)
    pendingFocusRef.current = true
    scrollToRow(Math.floor(next / faixa.columns))
  }

  /**
   * Setas percorrem o `radiogroup` com wrap e SELECT-FOLLOWS-FOCUS (molde de
   * `CategorySwatchGroup`). Enter/Espaço não precisam de tratamento — o tile é um
   * `<button>` nativo, e a tecla vira `click`.
   *
   * SEM guard de campo editável (o de `DestinationDialog.tsx:469-471`): aqui ele
   * seria código morto. O input de busca é IRMÃO do contêiner de rolagem, nunca
   * descendente do `radiogroup` que carrega este `onKeyDown`, então a seta
   * digitada na busca não chega aqui por construção — é a ESTRUTURA que a
   * protege, e um guard sugeriria um caminho que não existe.
   */
  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowDown'
            ? faixa.columns
            : event.key === 'ArrowUp'
              ? -faixa.columns
              : null
    if (delta == null) return
    event.preventDefault()
    moveSelection(delta)
  }

  function handleQueryChange(next: string) {
    setQuery(next)
    // A janela e a âncora de foco são indexadas pela lista FILTRADA: manter um
    // `scrollTop` ou um `focusIndex` antigos sobre uma lista curta renderizaria
    // vazio / andaria a partir de um tile que não existe mais.
    setScrollTop(0)
    setFocusIndex(null)
    if (scrollRef.current != null) scrollRef.current.scrollTop = 0
  }

  const total = catalog?.names.length ?? 0
  const confirmLabel = selected == null ? CONFIRM_PREFIX : `${CONFIRM_PREFIX} ${selected}`

  // Catálogo que resolve VAZIO é a mesma falha silenciosa que a P2 da DW-60
  // corrigiu: a grade abriria em branco com "0 ícones" e nenhuma saída. Vai para
  // o MESMO alerta com retry da falha de carga.
  const catalogEmpty = catalog != null && catalog.names.length === 0
  const broken = failed || catalogEmpty
  const catalogUnusable = broken || catalog == null

  /**
   * A chave vigente pode ser ÓRFÃ (o glifo saiu numa atualização do Phosphor).
   * Ela chega pré-selecionada, mas o catálogo acabou de provar que não existe:
   * confirmar reenviaria a chave e o servidor recusaria o PATCH de identidade
   * INTEIRO com 400 — o usuário perderia nome, unidade e grupo junto. Só habilita
   * confirmar quando o catálogo sabe desenhar a seleção.
   */
  const confirmable = selected != null && catalog != null && catalog.get(selected) != null

  /** Texto da região viva: carga → contagem, na MESMA região (ver `liveRegionArmed`). */
  const liveText = !liveRegionArmed
    ? ''
    : catalog == null
      ? CATALOG_LOADING
      : iconCountLabel(visible.length, total, query.trim())

  const confirmButton = (
    <Button
      disabled={!confirmable}
      onClick={() => selected != null && onConfirm(selected)}
      sx={{ ...PRIMARY_BUTTON_SX, marginLeft: compact ? undefined : 'auto' }}
    >
      {confirmLabel}
    </Button>
  )

  const content = (
    <Box
      {...(compact ? { role: 'dialog' as const, 'aria-label': PICKER_TITLE } : {})}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-2)',
        padding: 'var(--ds-space-3)',
        minWidth: 0,
      }}
    >
      {/* O nome ACESSÍVEL do overlay vem do `aria-label` (paper do Dialog /
          wrapper do Drawer); este é o título VISÍVEL. Não é `<h*>` — mesmo
          precedente do `DestinationPicker`: um heading solto dentro do overlay
          entra na ordem de headings da página hospedeira. */}
      <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>{PICKER_TITLE}</Box>
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{PICKER_SUBTITLE}</Box>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box component="label" htmlFor={searchId} sx={srOnly}>
          {SEARCH_LABEL}
        </Box>
        <input
          id={searchId}
          ref={captureInitialFocus}
          type="text"
          value={query}
          placeholder={SEARCH_PLACEHOLDER}
          onChange={(event) => handleQueryChange(event.target.value)}
          style={CONTROL_STYLE}
        />
      </Box>

      {/* UMA região viva, montada desde o primeiro render (ver `liveRegionArmed`):
          ela diz a espera pelo chunk e depois a contagem filtrada. Duas regiões
          disputariam o mesmo anúncio; uma inserida já preenchida não seria
          anunciada nenhuma vez. */}
      {!broken && (
        <Box
          role="status"
          aria-live="polite"
          data-testid="pictogram-picker-count"
          sx={{
            ...typography.meta,
            color: 'var(--ds-ink-muted)',
            fontVariantNumeric: 'tabular-nums',
            minHeight: '1lh',
          }}
        >
          {liveText}
        </Box>
      )}

      {broken ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ds-space-2)',
            alignItems: 'flex-start',
          }}
        >
          <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
            {CATALOG_ERROR}
          </Box>
          <Button onClick={() => setAttempt((current) => current + 1)} sx={SECONDARY_BUTTON_SX}>
            {RETRY_LABEL}
          </Button>
        </Box>
      ) : catalog == null ? null : (
        <>
          {visible.length === 0 ? (
            <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
              {noMatchLabel(query.trim())}
            </Box>
          ) : (
            <Box
              ref={scrollRef}
              data-testid="pictogram-picker-scroll"
              onScroll={handleScroll}
              sx={{
                overflowY: 'auto',
                overflowX: 'hidden',
                maxHeight: `calc((${faixa.tileHeightVar} + var(--ds-space-2)) * ${VIEWPORT_ROWS})`,
              }}
            >
              {/* Sizer da altura TOTAL: é ele que dá a barra de rolagem honesta
                  sem montar as ~1.500 linhas. `presentation` para não entrar
                  entre o `radiogroup` e seus `radio`. */}
              <Box
                role="presentation"
                sx={{ position: 'relative', height: totalRows * rowStep }}
              >
                <Box
                  role="radiogroup"
                  aria-label={GRID_LABEL}
                  data-columns={faixa.columns}
                  onKeyDown={handleGridKeyDown}
                  sx={{
                    position: 'absolute',
                    top: startRow * rowStep,
                    left: 0,
                    right: 0,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${faixa.columns}, minmax(0, 1fr))`,
                    gridAutoRows: faixa.tileHeightVar,
                    gap: 'var(--ds-space-2)',
                  }}
                >
                  {windowNames.map((name, offset) => {
                    const index = startRow * faixa.columns + offset
                    return (
                      <PictogramTile
                        key={name}
                        name={name}
                        glyph={catalog.get(name)}
                        selected={name === selected}
                        tabStop={name === tabStop}
                        // O foco é a âncora da navegação por seta: quem o move —
                        // Tab, clique ou a própria seta — atualiza o índice.
                        onFocusTile={() => setFocusIndex(index)}
                        onSelect={() => {
                          setSelected(name)
                          setFocusIndex(index)
                        }}
                        ref={(element) => {
                          if (element == null) tileRefs.current.delete(name)
                          else tileRefs.current.set(name, element)
                        }}
                      />
                    )
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* A ordem do DOM É a ordem pintada nas duas faixas — sem
          `column-reverse`. Inverter a pintura por CSS faz a ordem de FOCO
          divergir da visual (WCAG 2.4.3): em compact o rodapé é lido de baixo
          para cima pelo teclado enquanto os olhos leem de cima para baixo. Em
          wide a primária vai para a direita por `margin-left: auto`, que não
          reordena nada. */}
      <Box
        sx={{
          display: 'flex',
          gap: 'var(--ds-space-2)',
          flexWrap: 'wrap',
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
        }}
      >
        {compact && confirmButton}
        <Button
          disabled={catalogUnusable}
          onClick={() => onConfirm(null)}
          sx={SECONDARY_BUTTON_SX}
        >
          {REMOVE_LABEL}
        </Button>
        <Button onClick={onClose} sx={SECONDARY_BUTTON_SX}>
          {CANCEL_LABEL}
        </Button>
        {!compact && confirmButton}
      </Box>
    </Box>
  )

  if (compact) {
    return (
      <Drawer
        anchor="bottom"
        open
        onClose={onClose}
        slotProps={{
          paper: {
            style: shellCssVariables('light'),
            sx: {
              padding: 'var(--ds-space-2)',
              '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' },
            },
          },
          backdrop: { style: shellCssVariables('light') },
        }}
      >
        {content}
      </Drawer>
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      slotProps={{
        paper: {
          // O paper do `Dialog` já é o `role="dialog"`; o nome tem que vir AQUI
          // para pousar no mesmo elemento que carrega o papel.
          'aria-label': PICKER_TITLE,
          style: shellCssVariables('light'),
          sx: {
            backgroundColor: 'var(--ds-surface)',
            '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' },
          },
        },
        backdrop: { style: shellCssVariables('light') },
      }}
    >
      {content}
    </Dialog>
  )
}

// ─── Tile ────────────────────────────────────────────────────────────────────

function PictogramTile({
  name,
  glyph: Glyph,
  selected,
  tabStop,
  onSelect,
  onFocusTile,
  ref,
}: {
  name: string
  glyph: ReturnType<PhosphorCatalog['get']>
  selected: boolean
  tabStop: boolean
  onSelect: () => void
  onFocusTile: () => void
  // React 19: `ref` é prop normal, sem `forwardRef`.
  ref?: (element: HTMLElement | null) => void
}) {
  return (
    <Box
      ref={ref}
      component="button"
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onFocus={onFocusTile}
      tabIndex={tabStop ? 0 : -1}
      sx={{
        // SEM CONTROLE DESENHADO: a seleção é `aria-checked` + borda/fundo.
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--ds-space-1)',
        minHeight: 'var(--ds-touch-target-min)',
        minWidth: 0,
        cursor: 'pointer',
        borderRadius: 'var(--ds-radius-md)',
        border: selected ? '2px solid var(--ds-primary)' : '1px solid var(--ds-control-border)',
        backgroundColor: selected ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
        color: selected ? 'var(--ds-primary)' : 'var(--ds-ink-muted)',
        ...typography.label,
        overflow: 'hidden',
      }}
    >
      {/* O glifo já está em memória — renderizado direto, sem `DomainIcon`. */}
      {Glyph != null && (
        <Glyph aria-hidden weight="regular" color="currentColor" style={GLYPH_STYLE} />
      )}
      <Box
        component="span"
        sx={{
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </Box>
    </Box>
  )
}

// ─── Campo (gatilho + overlay) ───────────────────────────────────────────────

export interface PictogramFieldProps {
  /** Id do `<label>`/gatilho — vem do `useId()` do painel. */
  id: string
  value: string | null
  onChange: (next: string | null) => void
  compact: boolean
  usedKeys?: readonly string[]
  disabled?: boolean
  disabledReasonId?: string
}

/**
 * Campo **Pictograma** do cartão Identidade: gatilho + o overlay, com a
 * DEVOLUÇÃO DO FOCO ao gatilho no fechamento. Mora aqui, e não em
 * `HabitsConfigPanel`, porque a edição e a criação precisam do mesmo
 * comportamento — duas cópias divergiriam na próxima mudança.
 *
 * O gatilho NUNCA mostra o nome do glifo (proibição do gate: o nome em inglês
 * não aparece fora do seletor): mostra o próprio glifo mais "Pictograma
 * escolhido"/"Nenhum pictograma escolhido".
 */
export function PictogramField({
  id,
  value,
  onChange,
  compact,
  usedKeys,
  disabled = false,
  disabledReasonId,
}: PictogramFieldProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  // Esc, Cancelar, backdrop e confirmar devolvem o foco ao gatilho. O
  // `Modal` do MUI já restaura foco ao desmontar, mas o overlay abre por
  // MONTAGEM CONDICIONAL (molde do `DestinationPicker`) e o gatilho pode ter
  // re-renderizado no meio — o efeito garante o destino explicitamente.
  useEffect(() => {
    if (wasOpenRef.current && !open) triggerRef.current?.focus()
    wasOpenRef.current = open
  }, [open])

  const state = value == null ? TRIGGER_EMPTY : TRIGGER_CHOSEN
  const hint = value == null ? TRIGGER_HINT_PICK : TRIGGER_HINT_CHANGE

  return (
    <Field id={id} label={FIELD_LABEL}>
      <Box
        ref={(element: HTMLElement | null) => {
          triggerRef.current = element
        }}
        component="button"
        type="button"
        id={id}
        aria-haspopup="dialog"
        // `aria-expanded` fecha o par com `aria-haspopup`: sem ele o leitor
        // anuncia que o botão ABRE um dialog, mas nunca que o dialog está
        // aberto — e o gatilho continua na árvore, atrás do overlay.
        aria-expanded={open}
        // NOME ACESSÍVEL EXPLÍCITO, com o ESTADO e a AÇÃO. O `<label htmlFor>` do
        // `Field` sozinho não serve: `button` é elemento rotulável, então o
        // rótulo do host (etapa 2D do accname) VENCE o conteúdo (2F) — o nome
        // viraria só "Pictograma" e tanto o estado ("escolhido" × "nenhum
        // escolhido") quanto a dica visível ("Trocar"/"Escolher") ficariam de
        // fora. Nunca inclui o nome do glifo (proibição do gate).
        aria-label={`${FIELD_LABEL}: ${state}. ${hint}`}
        disabled={disabled}
        aria-describedby={disabled ? disabledReasonId : undefined}
        onClick={() => setOpen(true)}
        sx={{
          ...controlStyle(disabled),
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--ds-space-2)',
          textAlign: 'left',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {/* Reserva a largura do glifo mesmo sem pictograma — a linha não pula
            quando o usuário escolhe ou remove. */}
        <Box
          component="span"
          aria-hidden
          data-testid="pictogram-trigger-glyph"
          sx={{
            width: 'var(--ds-domain-icon-size-default)',
            height: 'var(--ds-domain-icon-size-default)',
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DomainIcon iconKey={value} />
        </Box>
        <Box component="span" sx={{ minWidth: 0 }}>
          {state}
        </Box>
        <Box
          component="span"
          sx={{ marginLeft: 'auto', ...typography.meta, color: 'var(--ds-ink-muted)' }}
        >
          {hint}
        </Box>
      </Box>
      {open && (
        <PictogramPicker
          value={isKebabIconKey(value) ? value : null}
          compact={compact}
          usedKeys={usedKeys}
          onConfirm={(next) => {
            onChange(next)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </Field>
  )
}
