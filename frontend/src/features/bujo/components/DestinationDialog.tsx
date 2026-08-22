// ─────────────────────────────────────────────────────────────────────────────
// Seletor de destino AGNÓSTICO DE DOMÍNIO — correção do defeito "os seletores
// de destino dos rituais abrem fora da viewport no desktop".
//
// CAUSA RAIZ que este componente fecha: os seletores de destino legados faziam
// `if (!compact) return content`, então na faixa desktop não existia `Dialog`
// nenhum — o "diálogo" (só `role="dialog"`, sem overlay nem posição fixa)
// entrava no fluxo normal do DOM, DEPOIS da grade de 3 colunas do ritual, e
// abria abaixo da dobra. (O seletor semanal daquela época foi removido em
// DW-29; `MonthlyDestinationPicker`/`DestinationPicker`, que seguem vivos nas
// suas superfícies, ganharam a MESMA anatomia em DW-30.) Aqui o par é o mesmo do
// `BrainDumpDestinationPicker` (layout já validado em uso pelo usuário):
// `Dialog` PORTALIZADO no não-compact, `Drawer anchor="bottom"` no compact.
//
//   ▶ AGNÓSTICO: recebe `onConfirm`/`onClose`, a DESCRIÇÃO do que é ofertado e a
//     densidade JÁ RESOLVIDA pelo chamador. Não importa NADA de `../api` nem os
//     tipos `Task`/`RecurringTaskTemplate` — quem decide o `destination` do POST
//     (e de qual endpoint de densidade os números vêm) é sempre o chamador.
//   ▶ Contrato ESPELHADO de `DestinationPicker.tsx` (M10):
//     `onConfirm(scheduledDate, meta)`. Uma função com MENOS parâmetros continua
//     atribuível (JS/TS padrão), então um call-site que só lê `scheduledDate`
//     (os dois rituais) segue válido sem adaptador. É o gancho por onde DW-27
//     ("Mover tarefa" dos boards) estende sem quebrar o que já existe.
//   ▶ TECLADO: `Enter`/`Escape`/dígitos são tratados no PRÓPRIO container, com
//     `preventDefault()` — NUNCA por `useKeyboardShortcuts` (handler de
//     `window`). Ver o bloco "Teclado" mais abaixo: o hook não filtra `BUTTON`,
//     e usá-lo aqui fazia o Enter rodar `confirm()` DUAS vezes (duas migrações
//     reais, provado em browser). Molde herdado de
//     `monthly/MonthlyDestinationPicker.tsx:114-123`, que documenta em :9-13
//     exatamente por que recusou o hook global.
//   ▶ AFFORDANCES DE STORIES ANTERIORES, preservadas por contrato:
//       · 14.5 AC5 — dígitos `1`–`7` armam os dias da semana, `0` arma "Sem dia
//         definido", com lembrete visível dos atalhos.
//       · 14.6 AC5 — entrada direta do número do dia + setas anterior/próximo,
//         sincronizadas com o calendário e validando os 28–31 dias REAIS do mês
//         (inclusive bissexto, via `lastDayOfMonth`).
//       · 14.5/14.6 AC6 — `armedDate` deixa o chamador abrir o diálogo com um
//         dia JÁ ARMADO: é por aí que o clique num dia do rail de densidade
//         continua escolhendo o destino da decisão corrente, mesmo com o rail
//         `aria-hidden` atrás do backdrop do modal.
//   ▶ Reusa as PEÇAS já provadas, não as reimplementa: `MonthDensityCalendar`
//     (calendário real de `<table>`, sem `role="grid"` manual — daí não existir
//     aqui o par `grid`/`gridcell` sem `role="row"` que foi achado CRITICAL do
//     axe na 14.7) e os tokens `var(--ds-*)`.
//   ▶ Rótulo de confirmação SEMPRE nomeado pelo ato ("Alocar em 14 de agosto")
//     — `confirmLabelFor` é OBRIGATÓRIO justamente para não haver caminho até
//     um "Confirmar" genérico.
//   ▶ Falha de escrita NÃO fecha o diálogo: `error` aparece com o destino
//     armado preservado, então "tentar novamente" é reconfirmar o mesmo ato.
//   ▶ LISTA DE OFERTAS (DW-27): `offer` aceita UMA oferta (os dois rituais, que
//     seguem passando um objeto e não mudaram uma linha) ou uma LISTA de
//     destinos nomeados. Só com N>1 nasce o `radiogroup` "Selecionar destino" —
//     um grupo de um item só seria ruído semântico. A anatomia do DIA é sempre
//     a da oferta SELECIONADA, e duas variantes voltam a existir para cobrir os
//     destinos canônicos dos boards: `none` (destino sem dia, "Hoje") e
//     `month-choice` (mês escolhido pelo usuário, "Futuro"). O contrato
//     `onConfirm(scheduledDate, meta)` segue intocado — quem decide o
//     `destination` do POST a partir de `meta.offerId` continua sendo o chamador.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Box, Button, Dialog, Drawer } from '@mui/material'

import { MonthDensityCalendar } from './MonthDensityCalendar'
import { addDaysIso, addMonthsIso, formatDayLabel, isoOf, lastDayOfMonth } from '../../../shared/date'
import { shellCssVariables, typography } from '../../../shared/design/tokens'

/** Os 7 dias de uma semana, segunda→domingo. `densityByDate` (mapa
 * `"AAAA-MM-DD" → nº de registros`) vem do CHAMADOR: é ele que sabe de qual
 * endpoint de densidade os números saem — este componente não consulta nada. */
export interface DayOfferWeek {
  kind: 'week'
  weekStart: string
  densityByDate?: ReadonlyMap<string, number>
}

/** Um mês FIXO (o mês-alvo do ritual): calendário de densidade + entrada direta
 * do número do dia. `densityByDate` idem — do chamador, nunca de query própria,
 * para que o calendário do diálogo e o do rail de contexto nunca mostrem
 * números divergentes para o mesmo mês. */
export interface DayOfferMonth {
  kind: 'month'
  monthFirst: string
  densityByDate?: ReadonlyMap<string, number>
}

/** Destino SEM escolha de dia (ex.: "Hoje", que o servidor resolve sozinho).
 * A seleção é derivada do próprio `kind` — nunca do estado `armed` (ver o
 * comentário de `currentSelection`). */
export interface DayOfferNone {
  kind: 'none'
}

/** Um mês que o USUÁRIO ainda vai escolher (ex.: "Futuro"): `input type="month"`
 * nativo e, com um mês válido, a mesma anatomia de `DayOfferMonth` (entrada do
 * número do dia + calendário). Sem `densityByDate`: o chamador não tem como
 * saber de que mês buscar contagem antes da escolha. */
export interface DayOfferMonthChoice {
  kind: 'month-choice'
  /** Meses ATÉ este (inclusive, comparação lexicográfica de "AAAA-MM-01") são
   * RECUSADOS. É o que sustenta a regra de `POST /migrate/`: `'future'` exige
   * `monthFirst` ESTRITAMENTE posterior ao mês corrente. */
  rejectUpToMonthFirst?: string
  /** Motivo anunciado (`role="alert"`) quando o mês digitado é recusado. */
  rejectedMonthReason?: string
}

/** Como o DIA é escolhido dentro da oferta de destino. */
export type DestinationDayOffer = DayOfferWeek | DayOfferMonth | DayOfferNone | DayOfferMonthChoice

export interface DestinationOffer {
  /** Id estável, devolvido em `meta.offerId` — é por ele que o chamador decide
   * o `destination` do POST. */
  id: string
  day: DestinationDayOffer
  /** Rótulo do destino no `radiogroup` — só usado quando há MAIS DE UMA oferta
   * (com uma só não existe grupo para rotular). */
  label?: string
  /** Ícone do destino, JÁ RESOLVIDO pelo chamador (`navIconFor('planner-week')`
   * e afins): este componente não conhece o shell nem o catálogo de ícones. */
  icon?: ReactNode
  /** A oferta APARECE no grupo, indisponível e com o motivo no nome acessível —
   * nunca um destino que some sem explicação nem um 400 cru do servidor. */
  unavailableReason?: string | null
  /**
   * "Sem dia definido". AUSENTE = a opção não existe nesta oferta.
   * `unavailableReason` preenchido = a opção aparece, INDISPONÍVEL e com o
   * motivo no nome acessível — é o que sustenta a regra de domínio do semanal
   * (migrar `destination: 'week'` sem `scheduledDate` cai na semana CORRENTE
   * no servidor, nunca na semana-alvo).
   */
  undated?: { unavailableReason?: string | null }
}

/** Lista de destinos NOMEADOS (2 ou mais). Uma oferta só continua sendo passada
 * como OBJETO — é o que mantém os dois rituais sem uma linha alterada. */
export type DestinationOfferList = ReadonlyArray<DestinationOffer>

export interface DestinationConfirmMeta {
  /** `id` da oferta escolhida. */
  offerId: string
  /** "AAAA-MM-01" do mês relevante à decisão — o mês do dia escolhido ou o mês
   * em foco. INFORMATIVO: o chamador decide `'month'` vs `'future'` comparando
   * com o mês corrente, que este componente não conhece. */
  monthFirst: string
}

export interface DestinationSelection extends DestinationConfirmMeta {
  /** `null` = "Sem dia definido". */
  scheduledDate: string | null
}

export interface DestinationDialogProps {
  /** Nome acessível do diálogo E título do cabeçalho. */
  title: string
  /** Segunda linha do cabeçalho — o item/período ofertado. */
  description?: string
  /** UMA oferta (sem `radiogroup` de destinos) ou uma LISTA de destinos nomeados. */
  offer: DestinationOffer | DestinationOfferList
  /**
   * Dia JÁ ARMADO na abertura (Stories 14.5/14.6 AC6): `undefined` = nada
   * armado, `null` = "Sem dia definido", string = o dia. É o que mantém vivo o
   * caminho "clicar num dia do rail de densidade escolhe o destino da decisão
   * corrente" — o rail fica `aria-hidden` atrás do backdrop enquanto o diálogo
   * está aberto, então o clique acontece ANTES e chega até aqui já armado.
   */
  armedDate?: string | null
  compact?: boolean
  /** Guarda TODOS os controles (offline, mutação EM CURSO). */
  disabled?: boolean
  /** Falha da última confirmação — o diálogo permanece ABERTO e armado. */
  error?: string | null
  /** Rótulo NOMEADO do ato. Obrigatório: sem caminho para um "Confirmar" genérico. */
  confirmLabelFor: (selection: DestinationSelection) => string
  onConfirm: (scheduledDate: string | null, meta: DestinationConfirmMeta) => void
  onClose: () => void
}

/** `undefined` = nada armado (confirmar indisponível) · `null` = "Sem dia
 * definido" (ato explícito) · string = dia "AAAA-MM-DD" escolhido. */
type Armed = string | null | undefined

const WEEK_LENGTH = 7

const CONTROL_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  border: '1px solid var(--ds-control-border)',
  borderRadius: 'var(--ds-radius-sm)',
  backgroundColor: 'var(--ds-surface)',
  color: 'var(--ds-ink)',
  cursor: 'pointer',
} as const

const CONTROL_SELECTED_SX = {
  border: '2px solid var(--ds-primary)',
  backgroundColor: 'var(--ds-primary-soft)',
  color: 'var(--ds-primary)',
  fontWeight: 700,
} as const

const CONTROL_UNAVAILABLE_SX = {
  color: 'var(--ds-ink-disabled)',
  cursor: 'not-allowed',
} as const

const STEPPER_SX = {
  ...typography.body,
  minWidth: 'var(--ds-touch-target-min)',
  minHeight: 'var(--ds-touch-target-min)',
  border: '1px solid var(--ds-control-border)',
  borderRadius: 'var(--ds-radius-sm)',
  backgroundColor: 'var(--ds-surface)',
  color: 'var(--ds-ink)',
  cursor: 'pointer',
} as const

/**
 * O calendário reusado (`MonthDensityCalendar`) traz células abaixo do piso de
 * toque do projeto (`--ds-touch-target-min`) — e no compact essas células são o
 * alvo de toque PRINCIPAL deste seletor. O componente é consumido por
 * superfícies que a spec proíbe tocar (`BrainDumpDestinationPicker`,
 * `TaskDestinationDialog` legado), então o piso é elevado AQUI, no contexto
 * deste diálogo: `.css-x td > .MuiButtonBase-root` tem especificidade maior que
 * a classe própria do `ButtonBase`, então vence a cascata sem depender da ordem
 * de injeção do emotion e sem `!important`.
 */
const CALENDAR_TOUCH_FLOOR_SX = {
  '& td > .MuiButtonBase-root': { minHeight: 'var(--ds-touch-target-min)' },
} as const

function monthFirstOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function DestinationDialog({
  title,
  description,
  offer,
  armedDate,
  compact = false,
  disabled = false,
  error = null,
  confirmLabelFor,
  onConfirm,
  onClose,
}: DestinationDialogProps) {
  const [armed, setArmed] = useState<Armed>(armedDate)
  /** "AAAA-MM" digitado no `month-choice` (formato nativo do `input type="month"`). */
  const [chosenMonth, setChosenMonth] = useState('')
  /** Destino escolhido no `radiogroup` — irrelevante quando há uma oferta só. */
  const [chosenOfferId, setChosenOfferId] = useState<string | null>(null)

  // Uma oferta só continua vindo como OBJETO (os dois rituais): normalizar aqui
  // é o que permite estender sem tocar nenhum call-site existente.
  const offers: DestinationOfferList = Array.isArray(offer) ? offer : [offer as DestinationOffer]
  const hasOfferGroup = offers.length > 1
  // Com uma oferta só ela É a seleção (nada para escolher); com N>1 nada nasce
  // pré-selecionado — escolher o destino é ato explícito do usuário.
  const selectedOffer = hasOfferGroup
    ? (offers.find((candidate) => candidate.id === chosenOfferId) ?? null)
    : offers[0]

  const dayOffer = selectedOffer?.day ?? null
  const weekOffer = dayOffer?.kind === 'week' ? dayOffer : null
  const fixedMonthOffer = dayOffer?.kind === 'month' ? dayOffer : null
  const monthChoiceOffer = dayOffer?.kind === 'month-choice' ? dayOffer : null

  // O mês precisa ser 01–12 de verdade: o Firefox degrada `input type="month"`
  // para campo de TEXTO, então "2026-13" é digitável. Só o formato (`\d{4}-\d{2}`)
  // deixaria passar um `2026-13-01`, que produz um calendário de mês inexistente
  // e um 400 cru no confirmar.
  const chosenMonthNumber = /^\d{4}-\d{2}$/.test(chosenMonth) ? Number(chosenMonth.slice(5, 7)) : 0
  const chosenMonthFirst =
    chosenMonthNumber >= 1 && chosenMonthNumber <= 12 ? `${chosenMonth}-01` : null
  // Derivado a cada render (nunca guardado em estado próprio): o teto de recusa
  // vem do chamador e pode chegar DEPOIS do usuário digitar o mês.
  const rejectedMonthReason =
    monthChoiceOffer &&
    chosenMonthFirst &&
    monthChoiceOffer.rejectUpToMonthFirst &&
    chosenMonthFirst <= monthChoiceOffer.rejectUpToMonthFirst
      ? (monthChoiceOffer.rejectedMonthReason ?? 'Escolha um mês posterior ao mês corrente.')
      : null

  /** Mês cuja anatomia de dia está ATIVA — o mês fixo da oferta, ou o mês
   * escolhido e aceito no `month-choice`. */
  const activeMonthFirst = fixedMonthOffer
    ? fixedMonthOffer.monthFirst
    : monthChoiceOffer && chosenMonthFirst && !rejectedMonthReason
      ? chosenMonthFirst
      : null
  const activeMonthDensity = fixedMonthOffer?.densityByDate

  const weekDays = weekOffer
    ? Array.from({ length: WEEK_LENGTH }, (_, index) => addDaysIso(weekOffer.weekStart, index))
    : []
  const lastDay = activeMonthFirst ? lastDayOfMonth(activeMonthFirst) : 0
  const [monthYear, monthMonth] = activeMonthFirst ? activeMonthFirst.split('-').map(Number) : [0, 0]

  /** Há uma superfície de escolha de dia na tela? `none` não tem nenhuma, e o
   * `month-choice` só passa a ter depois de um mês aceito. */
  const dayChoiceReady = Boolean(weekOffer || activeMonthFirst)
  const undatedOffered = Boolean(selectedOffer?.undated) && dayChoiceReady
  const undatedUnavailableReason = selectedOffer?.undated?.unavailableReason ?? null
  const undatedAvailable = undatedOffered && !undatedUnavailableReason

  // Chave do PERÍODO em foco. O período muda SEM remontar o componente (o pai só
  // troca `targetMonthFirst`/`weekStart`, ou o usuário troca de mês no
  // `month-choice`) e `useState` sobrevive à troca de prop, daí o reset
  // EXPLÍCITO — um "31" armado não sobrevive a um mês de 30 dias. O `ref` existe
  // para que o reset NÃO dispare na montagem: senão o `armedDate` que vem do
  // rail de densidade (AC6) seria apagado no primeiro efeito.
  const periodKey = weekOffer?.weekStart ?? activeMonthFirst ?? ''
  const previousPeriodKey = useRef(periodKey)
  useEffect(() => {
    if (previousPeriodKey.current === periodKey) return
    previousPeriodKey.current = periodKey
    setArmed(undefined)
  }, [periodKey])

  // ── Foco inicial ───────────────────────────────────────────────────────────
  // Sem foco explícito o primeiro tab stop por ordem de DOM é o "×" do cabeçalho
  // (achado de review). Molde herdado do seletor semanal da 14.5 (removido em
  // DW-29): o foco nasce na PRIMEIRA opção de dia — o radio de segunda no
  // semanal, a entrada do número do dia no mensal.
  //
  // O gancho é o CALLBACK REF do próprio elemento, não um `useEffect` daqui: o
  // `Portal` do MUI só descobre o nó de montagem no seu próprio efeito, então na
  // primeira passada os filhos do `Dialog` ainda não estão no DOM e um efeito do
  // componente PAI rodaria com a ref vazia (verificado empiricamente).
  //
  // E o foco vai um FRAME depois, não no próprio callback: o `FocusTrap` do MUI
  // foca a raiz do modal no efeito dele, que roda DEPOIS deste callback ref.
  // Focar direto aqui passa em jsdom e é desfeito no browser real — provado pelo
  // E2E em Chromium, onde o `toBeFocused` reprovava com o foco na raiz do modal.
  // Um frame adiante o trap já assentou e o foco fica onde deve.
  //
  // `initialFocusDoneRef` impede que re-renders tragam o foco de volta à primeira
  // opção depois de o usuário navegar com setas/dígitos.
  const dayOptionRefs = useRef<Array<HTMLElement | null>>([])
  const initialFocusDoneRef = useRef(false)
  function captureInitialFocus(element: HTMLElement | null) {
    if (!element || initialFocusDoneRef.current) return
    initialFocusDoneRef.current = true
    requestAnimationFrame(() => element.focus())
  }

  const armedWeekIndex = typeof armed === 'string' ? weekDays.indexOf(armed) : -1
  const armedDay =
    typeof armed === 'string' && activeMonthFirst && armed.slice(0, 7) === activeMonthFirst.slice(0, 7)
      ? Number(armed.slice(8, 10))
      : null

  function isoForDay(day: number): string {
    return isoOf(new Date(monthYear, monthMonth - 1, day))
  }

  function armDay(day: number) {
    if (disabled || !activeMonthFirst || day < 1 || day > lastDay) return
    setArmed(isoForDay(day))
  }

  /** Trocar de destino DESCARTA o dia armado: um "31" de um mês não é um dia
   * válido de uma semana, e um dia da semana em foco não é um dia do mês. */
  function selectOffer(candidate: DestinationOffer) {
    if (disabled || candidate.unavailableReason) return
    setChosenOfferId(candidate.id)
    setArmed(undefined)
  }

  function changeChosenMonth(value: string) {
    if (disabled) return
    setChosenMonth(value)
    setArmed(undefined)
  }

  /** Setas anterior/próximo do mensal (14.6 AC5) — a partir do dia armado, ou do
   * dia 1 quando ainda não há nenhum (molde de `MonthlyDestinationPicker:104-107`). */
  function stepDay(delta: number) {
    armDay((armedDay ?? 1) + delta)
  }

  function armWeekday(index: number) {
    if (disabled || !weekOffer) return
    const next = ((index % WEEK_LENGTH) + WEEK_LENGTH) % WEEK_LENGTH
    setArmed(weekDays[next])
    dayOptionRefs.current[next]?.focus()
  }

  function armUndated() {
    if (disabled || !undatedAvailable) return
    setArmed(null)
  }

  function currentSelection(): DestinationSelection | null {
    if (!selectedOffer || selectedOffer.unavailableReason) return null
    // `kind: 'none'` NÃO passa por `armed`: o efeito de reset de período apaga
    // `armed` quando a chave do período muda, e selecionar "Hoje" muda a chave —
    // apagaria um `armed === null` recém-posto. Derivar direto do `kind` elimina
    // a corrida. `monthFirst: ''` já é valor possível hoje e é ignorado por quem
    // consome `'today'`.
    if (selectedOffer.day.kind === 'none') {
      return { offerId: selectedOffer.id, scheduledDate: null, monthFirst: '' }
    }
    if (armed === undefined) return null
    if (armed === null) {
      if (!undatedAvailable) return null
      return {
        offerId: selectedOffer.id,
        scheduledDate: null,
        monthFirst: weekOffer ? monthFirstOf(weekOffer.weekStart) : (activeMonthFirst ?? ''),
      }
    }
    return { offerId: selectedOffer.id, scheduledDate: armed, monthFirst: monthFirstOf(armed) }
  }

  const selection = currentSelection()

  function confirm() {
    if (disabled) return
    const next = currentSelection()
    if (!next) return
    const { scheduledDate, ...meta } = next
    onConfirm(scheduledDate, meta)
  }

  // ── Teclado ────────────────────────────────────────────────────────────────
  // NUNCA `useKeyboardShortcuts` aqui (Design Notes, regra 3): o hook escuta em
  // `window` e filtra só INPUT/TEXTAREA/contentEditable — nunca BUTTON. Com o
  // botão de confirmação focado, o Enter disparava o handler do hook E a
  // ativação nativa do botão: `confirm()` rodava DUAS vezes e a tarefa migrava
  // em duplicidade (dois `POST /migrate/` 200, provado em browser real). A mesma
  // corrida fazia o Enter confirmar o dia armado ANTERIOR em vez do que acabou
  // de receber foco (classe registrada em DW-20).
  //
  // Aqui o keydown é tratado no PRÓPRIO container, com `preventDefault()` — molde
  // de `MonthlyDestinationPicker:114-123`. A regra de exatamente-uma-ação:
  //
  //   · Botões que SÃO a própria ação (×, ‹, ›, confirmar) chamam
  //     `stopEnterFromDialog` no seu keydown: o evento nunca sobe até aqui, então
  //     só a ativação NATIVA acontece — uma vez, e o × volta a fechar de fato.
  //   · As opções de dia (radios da semana, células do calendário) deixam o Enter
  //     subir: aqui ele é cancelado (nada de re-clique redundante) e confirma o
  //     destino ARMADO. É a mesma UX que a 14.5/14.6 provaram ("escolher com
  //     dígito/seta e confirmar com Enter").
  //   · Enter digitado DENTRO da entrada do número do dia confirma — deliberado,
  //     e é justamente o que o guard de INPUT do hook global impediria (o motivo
  //     documentado em `MonthlyDestinationPicker:9-13`).
  function handleContainerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return

    if (event.key === 'Enter') {
      event.preventDefault()
      confirm()
      return
    }
    if (event.key === 'Escape') {
      // `stopPropagation` para o `Modal` do MUI não chamar `onClose` de novo
      // logo depois — uma tecla, um fechamento.
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }

    // Dígitos são atalho, não digitação: mesmo guard de campo editável do
    // `useKeyboardShortcuts` (`shared/hooks/useKeyboardShortcuts.ts:27-33`), para
    // não roubar o "3" que o usuário digita no número do dia.
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    // Story 14.5 AC5: `1`–`7` armam segunda–domingo, `0` arma "Sem dia definido".
    if (weekOffer && event.key >= '1' && event.key <= '7') {
      event.preventDefault()
      armWeekday(Number(event.key) - 1)
      return
    }
    if (event.key === '0' && undatedOffered) {
      event.preventDefault()
      armUndated()
    }
  }

  /** Botões que são a PRÓPRIA ação: o Enter/Espaço deles não pode subir até o
   * container, senão a ação aconteceria duas vezes. */
  function stopEnterFromDialog(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
  }

  /** Navegação por seta no radiogroup de dias da semana: declarar
   * `role="radiogroup"` promete isso à tecnologia assistiva. Combina com o
   * tabindex ROVING abaixo (um único tab stop no grupo). */
  function handleWeekdayKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!weekOffer) return
    const base = armedWeekIndex >= 0 ? armedWeekIndex : 0
    const moves: Record<string, number> = {
      ArrowRight: base + 1,
      ArrowDown: base + 1,
      ArrowLeft: base - 1,
      ArrowUp: base - 1,
      Home: 0,
      End: WEEK_LENGTH - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    event.stopPropagation()
    armWeekday(moves[event.key])
  }

  const shortcutHint = weekOffer
    ? `Atalhos: 1–7 escolhem o dia${selectedOffer?.undated ? ' · 0 deixa sem data' : ''} · Enter confirma.`
    : activeMonthFirst
      ? 'Setas navegam dia a dia · digite o número do dia · Enter confirma.'
      : selectedOffer
        ? 'Enter confirma.'
        : 'Escolha um destino.'

  // `role="dialog"`/`aria-label` só no CONTEÚDO quando a faixa é compact: o MUI
  // Drawer não estampa `role="dialog"` sozinho, enquanto o MUI Dialog já o
  // estampa (com `aria-modal`) no próprio Paper — duplicar aqui criaria dois
  // `role="dialog"` aninhados, o de fora sem nome acessível (achado de review da
  // Story 15.1). No Dialog o nome chega por `slotProps.paper['aria-label']`.
  const content = (
    <Box
      {...(compact ? { role: 'dialog' as const, 'aria-label': title } : {})}
      onKeyDown={handleContainerKeyDown}
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)', padding: 'var(--ds-space-3)' }}
    >
      <Box
        component="header"
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--ds-space-2)' }}
      >
        <Box>
          <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
            {title}
          </Box>
          {description && <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{description}</Box>}
        </Box>
        <Button
          onClick={onClose}
          onKeyDown={stopEnterFromDialog}
          aria-label="Fechar"
          sx={{
            minWidth: 'var(--ds-touch-target-min)',
            minHeight: 'var(--ds-touch-target-min)',
            color: 'var(--ds-ink-muted)',
          }}
        >
          ×
        </Button>
      </Box>

      {/* Lembrete DISCRETO dos atalhos — presente nos dois seletores substituídos
          (o semanal da 14.5, removido em DW-29, e `MonthlyDestinationPicker`). */}
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{shortcutHint}</Box>

      {/* Destinos NOMEADOS (DW-27) — molde vivo do `BrainDumpDestinationPicker`:
          `radiogroup` com ícone + rótulo por destino, sem navegação por seta
          (o grupo de DIAS abaixo é que a tem). Só nasce com N>1: um grupo de um
          item só seria ruído semântico, e é o que mantém os dois rituais com a
          anatomia idêntica à de hoje. `flexWrap` (e não `repeat(N, …)`) porque o
          número de destinos varia por superfície. */}
      {hasOfferGroup && (
        <Box
          role="radiogroup"
          aria-label="Selecionar destino"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ds-space-1)' }}
        >
          {offers.map((candidate, index) => {
            const selected = selectedOffer?.id === candidate.id
            const unavailable = Boolean(candidate.unavailableReason)
            return (
              <Box
                key={candidate.id}
                ref={(element: HTMLElement | null) => {
                  if (index === 0) captureInitialFocus(element)
                }}
                component="button"
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={unavailable ? true : undefined}
                disabled={disabled}
                aria-label={
                  unavailable
                    ? `${candidate.label ?? candidate.id} — indisponível: ${candidate.unavailableReason}`
                    : undefined
                }
                // Os radios de DESTINO são a PRÓPRIA ação (como ×, ‹, › e o
                // confirmar), diferente dos radios de DIA, que deliberadamente
                // deixam o Enter subir para confirmar o dia armado. Sem este
                // `stopPropagation` o Enter subiria até `handleContainerKeyDown`,
                // que faz `preventDefault()` (matando a ativação nativa do
                // botão) e `confirm()` — confirmando o destino ANTERIOR em vez
                // de selecionar o que acabou de receber foco. É a classe exata
                // registrada em DW-20.
                onKeyDown={stopEnterFromDialog}
                onClick={() => selectOffer(candidate)}
                sx={{
                  ...CONTROL_SX,
                  ...(selected && CONTROL_SELECTED_SX),
                  ...(unavailable ? CONTROL_UNAVAILABLE_SX : {}),
                  flex: '1 1 0',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--ds-space-1)',
                  padding: 'var(--ds-space-2)',
                  ...typography.meta,
                }}
              >
                {candidate.icon}
                {candidate.label ?? candidate.id}
              </Box>
            )
          })}
        </Box>
      )}

      {/* `month-choice`: o mês é do USUÁRIO (`input type="month"` nativo, molde
          de `BrainDumpDestinationPicker`). O motivo da recusa é anunciado, e
          nenhuma anatomia de dia aparece enquanto o mês não for aceito — é o que
          impede um 400 cru de `POST /migrate/` ("Use 'month' para o mês corrente."). */}
      {monthChoiceOffer && (
        <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Mês</span>
          <input
            aria-label="Mês"
            type="month"
            // Primeiro mês ACEITÁVEL: o seletor nativo nem oferece meses que o
            // diálogo vai recusar (a validação acima continua sendo a
            // autoridade — `min` é dica de UI, não garantia).
            min={
              monthChoiceOffer.rejectUpToMonthFirst
                ? addMonthsIso(monthChoiceOffer.rejectUpToMonthFirst, 1).slice(0, 7)
                : undefined
            }
            disabled={disabled}
            value={chosenMonth}
            onChange={(event) => changeChosenMonth(event.target.value)}
            style={{
              ...typography.body,
              padding: 'var(--ds-space-2)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-ink)',
              minHeight: 'var(--ds-touch-target-min)',
            }}
          />
          {rejectedMonthReason && (
            <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
              {rejectedMonthReason}
            </Box>
          )}
        </Box>
      )}

      {weekOffer && (
        <Box
          role="radiogroup"
          aria-label={`Dias de ${formatDayLabel(weekDays[0], 'day-month')} a ${formatDayLabel(weekDays[WEEK_LENGTH - 1], 'day-month')}`}
          onKeyDown={handleWeekdayKeyDown}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(var(--ds-monthly-board-columns), minmax(0, 1fr))',
            gap: 'var(--ds-space-1)',
          }}
        >
          {weekDays.map((iso, index) => {
            const selected = armed === iso
            const count = weekOffer.densityByDate?.get(iso)
            // Tabindex ROVING: um único tab stop no grupo — o dia armado, ou o
            // primeiro quando nada está armado (molde herdado do seletor
            // semanal da 14.5, removido em DW-29). Sem isto os 7 dias viram 7
            // tab stops e a promessa de `radiogroup` fica quebrada.
            const roving = index === (armedWeekIndex >= 0 ? armedWeekIndex : 0)
            return (
              <Box
                key={iso}
                ref={(element: HTMLElement | null) => {
                  dayOptionRefs.current[index] = element
                  if (index === 0) captureInitialFocus(element)
                }}
                component="button"
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={roving ? 0 : -1}
                disabled={disabled}
                aria-label={`${index + 1} ${formatDayLabel(iso, 'weekday')}, ${formatDayLabel(iso, 'day-month')}${
                  count === undefined ? '' : `, ${count} ${count === 1 ? 'registro' : 'registros'}`
                }`}
                onClick={() => setArmed(iso)}
                sx={{
                  ...CONTROL_SX,
                  ...(selected && CONTROL_SELECTED_SX),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 'var(--ds-space-1)',
                  ...typography.meta,
                }}
              >
                <span>{formatDayLabel(iso, 'weekday-short-day')}</span>
                {count !== undefined && <span style={{ color: 'var(--ds-ink-muted)' }}>{count}</span>}
              </Box>
            )
          })}
        </Box>
      )}

      {/* Story 14.6 AC5 — entrada direta do número do dia + setas, sincronizadas
          com o calendário abaixo e validando os 28–31 dias REAIS do mês-alvo
          (`lastDayOfMonth` cobre bissexto). */}
      {activeMonthFirst && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
          <Box
            component="button"
            type="button"
            aria-label="Dia anterior"
            disabled={disabled}
            onKeyDown={stopEnterFromDialog}
            onClick={() => stepDay(-1)}
            sx={STEPPER_SX}
          >
            ‹
          </Box>
          <input
            ref={captureInitialFocus}
            aria-label="Número do dia"
            type="number"
            min={1}
            max={lastDay}
            disabled={disabled}
            value={armedDay ?? ''}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isFinite(value) && value >= 1) armDay(Math.min(value, lastDay))
            }}
            style={{
              ...typography.body,
              minWidth: 'var(--ds-touch-target-min)',
              minHeight: 'var(--ds-touch-target-min)',
              padding: 'var(--ds-space-1)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-ink)',
            }}
          />
          <Box
            component="button"
            type="button"
            aria-label="Próximo dia"
            disabled={disabled}
            onKeyDown={stopEnterFromDialog}
            onClick={() => stepDay(1)}
            sx={STEPPER_SX}
          >
            ›
          </Box>
        </Box>
      )}

      {activeMonthFirst && (
        <Box sx={CALENDAR_TOUCH_FLOOR_SX}>
          <MonthDensityCalendar
            monthFirst={activeMonthFirst}
            // `MonthDensityCalendar` pede um `Map` mutável; a oferta expõe
            // `ReadonlyMap` (o chamador é o dono do dado). Cópia rasa na
            // fronteira, sem tocar o componente compartilhado. Um mês ainda por
            // escolher (`month-choice`) não tem densidade: o chamador não teria
            // como saber de qual mês buscá-la antes da escolha.
            densityByDate={new Map(activeMonthDensity)}
            selectedDate={typeof armed === 'string' ? armed : null}
            onSelectDay={disabled ? undefined : (iso) => setArmed(iso)}
          />
        </Box>
      )}

      {undatedOffered && (
        <Box
          component="button"
          type="button"
          aria-pressed={armed === null}
          aria-disabled={undatedAvailable ? undefined : true}
          disabled={disabled}
          aria-label={
            undatedUnavailableReason
              ? `0 Sem dia definido — indisponível: ${undatedUnavailableReason}`
              : undefined
          }
          onClick={armUndated}
          sx={{
            ...CONTROL_SX,
            ...(armed === null && CONTROL_SELECTED_SX),
            ...(undatedAvailable ? {} : CONTROL_UNAVAILABLE_SX),
            padding: 'var(--ds-space-2)',
            ...typography.body,
          }}
        >
          0 Sem dia definido
        </Box>
      )}

      {selection && (
        <Button
          onClick={confirm}
          onKeyDown={stopEnterFromDialog}
          disabled={disabled}
          sx={{
            ...typography.label,
            minHeight: 'var(--ds-touch-target-min)',
            backgroundColor: 'var(--ds-primary)',
            color: 'var(--ds-on-primary)',
            '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
            '&.Mui-disabled': { backgroundColor: 'var(--ds-surface-subtle)', color: 'var(--ds-ink-muted)' },
          }}
        >
          {confirmLabelFor(selection)}
        </Button>
      )}

      {error && (
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
          {error}
        </Box>
      )}
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
              maxHeight: '88vh',
              overflowY: 'auto',
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

  // É ESTE `Dialog` — portalizado, sobreposto e centrado — que fecha o defeito:
  // o conteúdo nunca mais entra no fluxo do DOM depois da grade do ritual.
  return (
    <Dialog
      open
      onClose={onClose}
      slotProps={{
        paper: {
          'aria-label': title,
          style: shellCssVariables('light'),
          sx: {
            width: 'min(520px, 92vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: 'var(--ds-surface)',
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-md)',
            '& :focus-visible': { outline: '2px solid var(--ds-focus)', outlineOffset: '2px' },
          },
        },
      }}
    >
      {content}
    </Dialog>
  )
}
