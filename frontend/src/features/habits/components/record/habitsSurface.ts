// ─────────────────────────────────────────────────────────────────────────────
// Derivações PURAS da superfície de Registro de Hábitos (Story 16.1).
//
//   ▶ DADOS PUROS: sem React, sem MUI, sem Query. Molde de
//     `bujo/components/recurring/recurringLibrary.ts` — os ids do par
//     `tab`⇄`tabpanel` vivem aqui porque os DOIS lados precisam deles e nenhum
//     é dono do outro.
//
//   ▶ NADA AQUI CALCULA COMPLETUDE. Porcentagem do dia e de grupo vêm do
//     servidor (`HabitDay.totalCompletion` / `HabitDayGroup.completion`). O que
//     este módulo faz é FORMATAR o que o servidor já congelou (peso ×
//     multiplicador) e converter entrada do usuário — nunca inferir regra de
//     domínio.
//
//   ▶ Datas são strings "YYYY-MM-DD". Nunca `new Date(iso)` (desvio de fuso —
//     mesma armadilha já documentada em `historyUtils.ts`): split de string e,
//     quando precisa do dia da semana, `new Date(y, m-1, d)` LOCAL.
//
// [Source: DESIGN.md#Hábitos (Registro); EXPERIENCE.md#Hábitos;
//  mockups/key-habitos.html F1-F9; spec 16.1 Tasks 2/6]
// ─────────────────────────────────────────────────────────────────────────────

// ─── Abas internas ───────────────────────────────────────────────────────────

/** Slug canônico de cada aba, tal como aparece em `?tab=`. */
export type HabitTabSlug = 'hoje' | 'historico' | 'configuracao'

export interface HabitTabDefinition {
  slug: HabitTabSlug
  /** Rótulo em wide/medium/tablet. */
  label: string
  /** Rótulo em compact — só "Configuração" abrevia (DESIGN.md L706). */
  compactLabel: string
}

/**
 * Ordem canônica e INVARIÁVEL: Hoje · Histórico · Configuração
 * (`EXPERIENCE.md#Hábitos`). Não reordenar por faixa nem por preferência.
 */
export const HABIT_TABS: readonly HabitTabDefinition[] = [
  { slug: 'hoje', label: 'Hoje', compactLabel: 'Hoje' },
  { slug: 'historico', label: 'Histórico', compactLabel: 'Histórico' },
  { slug: 'configuracao', label: 'Configuração', compactLabel: 'Config.' },
] as const

export const HABIT_TAB_SLUGS: readonly HabitTabSlug[] = HABIT_TABS.map((tab) => tab.slug)

export const DEFAULT_HABIT_TAB: HabitTabSlug = 'hoje'

/**
 * Normaliza o `?tab=` da querystring. Valor ausente, vazio ou desconhecido cai
 * na aba padrão — deep link quebrado abre a superfície, nunca uma tela morta.
 */
export function parseTabSlug(raw: string | null | undefined): HabitTabSlug {
  const candidate = (raw ?? '').trim().toLowerCase()
  return (HABIT_TAB_SLUGS as readonly string[]).includes(candidate)
    ? (candidate as HabitTabSlug)
    : DEFAULT_HABIT_TAB
}

export function tabIdOf(slug: HabitTabSlug): string {
  return `habits-tab-${slug}`
}

export function tabPanelIdOf(slug: HabitTabSlug): string {
  return `habits-tabpanel-${slug}`
}

/** Rótulo da aba na faixa pedida (só "Config." muda no compact). */
export function tabLabelOf(tab: HabitTabDefinition, compact: boolean): string {
  return compact ? tab.compactLabel : tab.label
}

// ─── Números e datas ─────────────────────────────────────────────────────────

const numberFormat = new Intl.NumberFormat('pt-BR')

/**
 * Formatação pt-BR de um decimal do servidor. Diferente de
 * `historyUtils.formatNumber`, `null` devolve `null` (e não `'0'`): nesta
 * superfície "sem valor" NUNCA vira zero fabricado.
 */
export function formatDecimal(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isNaN(value) ? String(raw) : numberFormat.format(value)
}

/** Peso/multiplicador como texto: inteiro sem fração, decimal com vírgula. */
function formatFactor(raw: string | number | null | undefined): string {
  return formatDecimal(raw) ?? '0'
}

/**
 * Texto de transparência dos FATORES CONGELADOS da linha
 * (`DESIGN.md` L710 · `EXPERIENCE.md#Hábitos`):
 *
 *   `Peso 3`               quando o multiplicador é 1 (ou ausente)
 *   `Peso 3 × 0,5 = 1,5`   quando o dia tem multiplicador ≠ 1
 *
 * O produto é aritmética sobre dois valores que o servidor JÁ congelou na
 * linha — não é recálculo de regra: é escrever por extenso o que a linha diz.
 */
export function formatFrozenFactors(
  weightAtTime: string | null | undefined,
  multiplierAtTime: string | null | undefined,
): string {
  const weight = Number(weightAtTime ?? 0)
  const multiplier = multiplierAtTime == null ? 1 : Number(multiplierAtTime)
  if (!Number.isFinite(multiplier) || multiplier === 1) {
    return `Peso ${formatFactor(weightAtTime)}`
  }
  const effective = Number.isFinite(weight) ? weight * multiplier : 0
  return `Peso ${formatFactor(weightAtTime)} × ${formatFactor(multiplierAtTime)} = ${formatFactor(effective)}`
}

/** Peso efetivo de uma linha: `weightAtTime × multiplierAtTime` (ambos congelados). */
export function effectiveWeightOf(entry: {
  weightAtTime: string
  multiplierAtTime?: string
}): number {
  const weight = Number(entry.weightAtTime)
  const multiplier = entry.multiplierAtTime == null ? 1 : Number(entry.multiplierAtTime)
  if (!Number.isFinite(weight) || !Number.isFinite(multiplier)) return 0
  return weight * multiplier
}

/** Soma dos pesos efetivos de um conjunto de linhas (denominador NOMEADO). */
export function sumEffectiveWeights(
  entries: readonly { weightAtTime: string; multiplierAtTime?: string }[],
): number {
  return entries.reduce((total, entry) => total + effectiveWeightOf(entry), 0)
}

/** `14` → `"14,0"` — o denominador nomeado sempre mostra uma casa. */
export function formatEffectiveWeight(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const WEEKDAY_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const

const MONTH_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

/** `"2026-08-21"` → `"Sexta-feira, 21 de agosto de 2026"`. Sem desvio de fuso. */
export function formatDateLongBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const local = new Date(y, m - 1, d)
  return `${WEEKDAY_LONG[local.getDay()]}, ${d} de ${MONTH_LONG[m - 1]} de ${y}`
}

/** `"2026-08-21"` → `"21 de agosto de 2026"` (sem o dia da semana). */
export function formatDateMediumBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} de ${MONTH_LONG[m - 1]} de ${y}`
}

/** Hoje em ISO local (`YYYY-MM-DD`) — nunca `toISOString()` (UTC). */
export function isoLocalToday(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Soma `n` dias a uma data ISO, em calendário LOCAL. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoLocalToday(new Date(y, m - 1, d + n))
}

export function clampDate(iso: string, start: string, end: string): string {
  if (iso < start) return start
  if (iso > end) return end
  return iso
}

// ─── Entrada numérica ────────────────────────────────────────────────────────

export interface DecimalParseResult {
  /** `false` ⇒ o texto digitado não é um decimal; não enviar nada ao servidor. */
  valid: boolean
  /** `null` ⇒ campo vazio: grava NULO (remove o registro do dia). */
  value: string | null
}

/**
 * Parser do campo numérico da linha. Aceita **vírgula e ponto** (I/O Matrix):
 * `"2,1"` e `"2.1"` viram `"2.1"`, o formato que a API espera. Campo vazio é
 * intenção legítima (grava nulo), não erro.
 */
export function parseDecimalInput(raw: string): DecimalParseResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { valid: true, value: null }
  const normalized = trimmed.replace(',', '.')
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return { valid: false, value: null }
  return { valid: true, value: normalized }
}

/** O valor do servidor como o campo deve exibi-lo (vírgula decimal pt-BR). */
export function decimalInputValue(raw: string | null | undefined): string {
  if (raw == null || raw === '') return ''
  const value = Number(raw)
  if (Number.isNaN(value)) return String(raw)
  return String(value).replace('.', ',')
}

/**
 * `true` quando o texto digitado representa o MESMO número já gravado — o
 * commit não deve disparar requisição ("Numérico inalterado" da I/O Matrix).
 * Compara por VALOR, não por string: `"2,10"` sobre um `"2.1"` gravado não é
 * mudança.
 */
export function isUnchangedDecimal(parsed: string | null, stored: string | null): boolean {
  if (parsed == null || stored == null) return parsed === stored
  const a = Number(parsed)
  const b = Number(stored)
  if (Number.isNaN(a) || Number.isNaN(b)) return parsed === stored
  return a === b
}

// ─── Leitura da linha ────────────────────────────────────────────────────────

/** Percentual da META (não é completude: nem peso nem bônus entram). */
export function metaPercent(
  value: string | null | undefined,
  meta: string | null | undefined,
): number | null {
  if (value == null || value === '' || meta == null || meta === '') return null
  const v = Number(value)
  const m = Number(meta)
  if (Number.isNaN(v) || Number.isNaN(m) || m === 0) return null
  return Math.round((v / m) * 100)
}

export function isMetaReached(
  value: string | null | undefined,
  meta: string | null | undefined,
): boolean {
  if (value == null || value === '' || meta == null || meta === '') return false
  const v = Number(value)
  const m = Number(meta)
  return !Number.isNaN(v) && !Number.isNaN(m) && v >= m
}

export function isBooleanDone(value: string | null | undefined): boolean {
  return value != null && value !== '' && Number(value) === 1
}

export interface RowStateInput {
  type: 'boolean' | 'numeric'
  value?: string | null
  metaAtTime?: string | null
  unit?: string
}

/**
 * Estado TEXTUAL obrigatório da linha — a marca do checkbox nunca é canal único
 * (`EXPERIENCE.md#Hábitos`). Nulo é "Não feito", NUNCA ausência.
 *
 *   booleano  → "Feito" / "Não feito"
 *   numérico  → "Meta atingida · 8,4 / 8 km" | "1,8 / 2,5 L (72%)" | "0 / 8 km"
 */
export function rowStateText(entry: RowStateInput): string {
  if (entry.type === 'boolean') return isBooleanDone(entry.value) ? 'Feito' : 'Não feito'
  const unitSuffix = entry.unit ? ` ${entry.unit}` : ''
  const value = formatDecimal(entry.value) ?? '0'
  const meta = formatDecimal(entry.metaAtTime)
  if (meta == null) return `${value}${unitSuffix}`
  if (isMetaReached(entry.value, entry.metaAtTime)) {
    return `Meta atingida · ${value} / ${meta}${unitSuffix}`
  }
  const percent = metaPercent(entry.value, entry.metaAtTime)
  return `${value} / ${meta}${unitSuffix}${percent != null ? ` (${percent}%)` : ''}`
}

// ─── Grade semanal do histórico ──────────────────────────────────────────────

export interface WeeklyBucket {
  /** Primeira data do bucket presente no intervalo (ISO). */
  start: string
  /** Última data do bucket presente no intervalo (ISO). */
  end: string
  /** Todas as datas do intervalo que caem neste bucket, em ordem. */
  dates: string[]
}

/**
 * Divide o intervalo em SEMANAS FIXAS (segunda→domingo), do jeito que o resto
 * do produto conta semana. A semana parcial das pontas continua sendo um
 * bucket próprio — é justamente por isso que a coluna precisa rotular os dias
 * reais ("3 dias"), para que "2/3" não seja lido como "2/7".
 *
 * Não existe alternador semana/quinzena: o gate não o promoveu.
 */
export function weeklyBuckets(dates: readonly string[]): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = []
  let current: WeeklyBucket | null = null
  let currentKey = ''
  for (const iso of [...dates].sort()) {
    const key = mondayOf(iso)
    if (!current || key !== currentKey) {
      current = { start: iso, end: iso, dates: [iso] }
      currentKey = key
      buckets.push(current)
      continue
    }
    current.end = iso
    current.dates.push(iso)
  }
  return buckets
}

/** Segunda-feira da semana de `iso` (ISO local, sem desvio de fuso). */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const local = new Date(y, m - 1, d)
  // getDay(): 0=domingo … 6=sábado. Segunda é a âncora do produto inteiro.
  const offset = (local.getDay() + 6) % 7
  return addDays(iso, -offset)
}

/** `"23–26 jul."` — rótulo curto de um bucket. */
const MONTH_SHORT = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
] as const

export function bucketLabel(bucket: WeeklyBucket): string {
  const [, sm, sd] = bucket.start.split('-').map(Number)
  const [, em, ed] = bucket.end.split('-').map(Number)
  if (sm === em) {
    return sd === ed
      ? `${sd} ${MONTH_SHORT[sm - 1]}`
      : `${sd}–${ed} ${MONTH_SHORT[sm - 1]}`
  }
  return `${sd} ${MONTH_SHORT[sm - 1]}–${ed} ${MONTH_SHORT[em - 1]}`
}

/**
 * Rótulo dos DIAS REAIS da coluna. O denominador é sempre "dias com registro",
 * nunca dias corridos — e a coluna diz quantos são para que a razão da célula
 * não seja lida contra 7 (`EXPERIENCE.md#Hábitos`, mockup F8).
 */
export function realDaysLabel(daysWithRecord: number): string {
  return `${daysWithRecord} ${daysWithRecord === 1 ? 'dia' : 'dias'}`
}

// ─── Célula da grade ─────────────────────────────────────────────────────────

export interface GridCellInput {
  type: 'boolean' | 'numeric'
  /** Linhas MATERIALIZADAS do hábito dentro do bucket (dia sem linha não entra). */
  entries: readonly { value?: string | null; metaAtTime?: string | null }[]
}

export interface GridCell {
  /** `"5/7"` (booleano), `"71%"` (numérico) ou `"—"` (sem registro no período). */
  display: string
  /** `--p` da escala contínua de tom: 0–100, ou `null` quando não há registro. */
  percent: number | null
  daysWithRecord: number
  /** Leitura por extenso (título/tabela equivalente). */
  reading: string
}

const NO_RECORD_CELL: GridCell = {
  display: '—',
  percent: null,
  daysWithRecord: 0,
  reading: 'Sem registro no período',
}

/**
 * Leitura agregada de UM hábito num bucket, derivada só do que o servidor já
 * devolve em `HabitHistoryRange` (valores e metas CONGELADOS por dia):
 *
 *   booleano → dias feitos sobre **dias com registro** ("5/7"); o tom usa a
 *              RAZÃO REAL (5/7 = 71%), nunca o numerador;
 *   numérico → média simples do **percentual da meta** dos dias medidos.
 *
 * Isto NÃO é completude ponderada: peso, multiplicador e bônus não entram, e
 * a porcentagem do dia/grupo continua vindo exclusivamente do servidor. A
 * leitura agregada de servidor (rota nova por grupo, sequência, dias 100%) é
 * da Story 16.2b.
 */
export function gridCell({ type, entries }: GridCellInput): GridCell {
  if (type === 'boolean') {
    // Linha materializada com valor nulo é "não feito" — conta como dia COM
    // registro (o dia foi aberto), só não conta como feito.
    const daysWithRecord = entries.length
    if (daysWithRecord === 0) return NO_RECORD_CELL
    const done = entries.filter((entry) => isBooleanDone(entry.value)).length
    return {
      display: `${done}/${daysWithRecord}`,
      percent: Math.round((done / daysWithRecord) * 100),
      daysWithRecord,
      reading: `${done} de ${daysWithRecord} dias com registro feitos`,
    }
  }

  // Numérico: só o dia MEDIDO entra (linha aberta sem valor = sem medição).
  const measured = entries.filter(
    (entry) => entry.value != null && entry.value !== '' && entry.metaAtTime != null,
  )
  if (measured.length === 0) return NO_RECORD_CELL
  const total = measured.reduce((sum, entry) => sum + (metaPercent(entry.value, entry.metaAtTime) ?? 0), 0)
  const average = Math.round(total / measured.length)
  return {
    display: `${average}%`,
    percent: average,
    daysWithRecord: measured.length,
    reading: `${average}% do percentual médio da meta em ${measured.length} ${measured.length === 1 ? 'dia' : 'dias'} com registro`,
  }
}

// ─── Visões da série de evolução ─────────────────────────────────────────────

/**
 * Contribuição (0–1) de UM dia de UM hábito — reprodução da mesma aritmética
 * que o servidor já congelou na linha (valor, meta e bônus do dia). NÃO é a
 * completude do dia nem a do grupo, que continuam vindo do servidor e nunca
 * são recalculadas aqui.
 */
export function contributionFactor(
  type: 'boolean' | 'numeric',
  value: string | null | undefined,
  meta: string | null | undefined,
  bonus: string | null | undefined,
): number | null {
  if (type === 'boolean') {
    if (value == null || value === '') return null
    return isBooleanDone(value) ? 1 : 0
  }
  if (value == null || value === '' || meta == null || meta === '') return null
  const v = Number(value)
  const m = Number(meta)
  if (Number.isNaN(v) || Number.isNaN(m) || m === 0) return null
  if (v >= m) return 1
  const b = bonus == null || bonus === '' ? 0 : Number(bonus)
  const penalty = Number.isNaN(b) ? 0 : b / 100
  return (v / m) * (1 - penalty)
}
