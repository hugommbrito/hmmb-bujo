// ─────────────────────────────────────────────────────────────────────────────
// Grade hábitos × períodos do Histórico (Story 16.1) — `DESIGN.md#Grid/Calendar`.
//
//   ▶ SEMANAL FIXA. Uma coluna por semana (segunda→domingo), como o resto do
//     produto conta semana. O alternador semana/quinzena NÃO foi promovido pelo
//     gate e não existe.
//
//   ▶ TOM É O CANAL PRIMÁRIO, em ESCALA CONTÍNUA (não faixas): cada célula
//     pinta `--ds-primary` sobre `--ds-surface` com alpha igual à própria
//     completude, via `color-mix` e a custom property `--p` (0..100). O número
//     herda o mesmo fundo um degrau mais escuro. Booleano usa a RAZÃO REAL
//     ("5/7" pinta a 71%), nunca o numerador.
//
//     `color-mix`/`--p` são literais LEGÍTIMOS aqui (documentados no guard):
//     são a receita verbatim do mockup (`key-habitos.html:220-222`), não
//     medidas com token.
//
//   ▶ ESTA É A ÚNICA EXCEÇÃO NOMEADA ao piso de 4,5:1 do produto
//     (`EXPERIENCE.md#Accessibility Floor`, decisão de 2026-08-22) e não se
//     estende a nenhuma outra superfície. O que a sustenta é a redundância em
//     volta: `caption`, `th scope` em linha e coluna, tags textuais FDS/FER e a
//     **tabela equivalente permanente em `details`**, em contraste normal.
//     Célula sem número continua sendo bug, não variante.
//
//   ▶ COMPACT: a grade vira LISTA POR DIA — recomposição, nunca compressão, e
//     nunca scroll horizontal de página.
//
//   ▶ AS LEITURAS AGREGADAS DE SERVIDOR (sequência, dias 100%, série por grupo,
//     e a agregação por bucket calculada no backend) são da **Story 16.2b**.
//     O que esta grade faz é contar/mediar o que o servidor JÁ devolveu por
//     dia — nunca inferir completude ponderada.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, type CSSProperties } from 'react'
import { Box } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import { DAY_TYPE_LABEL, formatDateBR } from '../historyUtils'
import type { DayType, HabitDayEntry, HabitGroup, HabitHistoryRange, HabitSlim } from '../../types'
import {
  bucketLabel,
  formatDateMediumBR,
  formatDecimal,
  gridCell,
  realDaysLabel,
  weeklyBuckets,
  type GridCell,
} from './habitsSurface'

/** Verbatim do gate. */
export const EMPTY_RANGE = 'Nenhum registro no período.'
export const NO_RECORD_DAY = 'Sem registro neste dia.'

/**
 * Leitura textual de UMA linha num dia, para a recomposição do compact.
 * Espelha o `cellState` do legado (`HabitHistoryGrid.tsx:25-39`): número com
 * unidade no numérico, "feito"/"não feito" no booleano — nunca só um glifo.
 */
function compactReading(
  entry: { value?: string | null },
  habit: { type: 'boolean' | 'numeric'; unit?: string | null },
): string {
  if (entry.value == null || entry.value === '') return 'sem registro'
  if (habit.type === 'boolean') return Number(entry.value) === 1 ? 'feito' : 'não feito'
  const unit = habit.unit ? ` ${habit.unit}` : ''
  return `${formatDecimal(entry.value) ?? entry.value}${unit}`
}

/** Tag textual curta do tipo de dia (nunca só cor). */
const DAY_TYPE_TAG: Record<DayType, string> = {
  weekday: '',
  weekend: 'FDS',
  holiday: 'FER',
}

const SR_ONLY = {
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

const CELL_BACKGROUND = 'color-mix(in srgb, var(--ds-primary) calc(var(--p) * 1%), var(--ds-surface))'
const CELL_COLOR = `color-mix(in srgb, ${CELL_BACKGROUND} 72%, var(--ds-ink))`

interface HabitRowData {
  habit: HabitSlim
  /** `true` quando o hábito está inativo (vai para o agrupamento próprio). */
  inactive: boolean
  cells: GridCell[]
}

export interface HabitCompletionGridProps {
  data: HabitHistoryRange
  /** Nomes de grupo (opcional): se a query falhar, a grade degrada sem grupos. */
  groups?: HabitGroup[]
  /** Ids dos hábitos INATIVOS (opcional, mesma degradação). */
  inactiveHabitIds?: ReadonlySet<string>
  compact: boolean
}

export function HabitCompletionGrid({
  data,
  groups = [],
  inactiveHabitIds,
  compact,
}: HabitCompletionGridProps) {
  const { habits, days } = data

  if (habits.length === 0 || days.length === 0) {
    return <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{EMPTY_RANGE}</Box>
  }

  const buckets = weeklyBuckets(days.map((day) => day.date))
  const dayByDate = new Map(days.map((day) => [day.date, day]))

  // Índice hábito → (data → linha materializada).
  const entriesByHabit = new Map<string, Map<string, HabitDayEntry>>()
  for (const day of days) {
    for (const entry of day.entries) {
      let byDate = entriesByHabit.get(entry.habitId)
      if (!byDate) {
        byDate = new Map()
        entriesByHabit.set(entry.habitId, byDate)
      }
      byDate.set(day.date, entry)
    }
  }

  const rows: HabitRowData[] = habits.map((habit) => {
    const byDate = entriesByHabit.get(habit.id)
    return {
      habit,
      inactive: inactiveHabitIds?.has(habit.id) ?? false,
      cells: buckets.map((bucket) =>
        gridCell({
          type: habit.type,
          entries: bucket.dates
            .map((date) => byDate?.get(date))
            .filter((entry): entry is HabitDayEntry => entry != null),
        }),
      ),
    }
  })

  // Compact: LISTA POR DIA (mesma informação, sem scroll horizontal).
  if (compact) {
    return (
      <Box>
        <Box
          component="h4"
          sx={{ ...typography['body-strong'], color: 'var(--ds-ink)', margin: 0 }}
        >
          Completude por dia
        </Box>
        <Box component="ul" sx={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {[...days].reverse().map((day) => {
            const filled = day.entries.filter((entry) => entry.value != null).length
            const hasRecord = day.entries.length > 0 && day.totalCompletion != null
            const tag = DAY_TYPE_TAG[day.dayType]
            return (
              <Box
                component="li"
                key={day.date}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--ds-space-1)',
                  borderBottom: '1px solid var(--ds-border)',
                  py: 'var(--ds-space-2)',
                  ...typography.meta,
                  color: 'var(--ds-ink)',
                }}
              >
                <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', justifyContent: 'space-between' }}>
                <Box component="span">
                  {formatDateBR(day.date)}
                  {tag ? ` · ${tag}` : ` · ${DAY_TYPE_LABEL[day.dayType]}`}
                </Box>
                <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {hasRecord
                    ? `${day.totalCompletion}% · ${filled}/${day.entries.length} registros`
                    : NO_RECORD_DAY}
                </Box>
                </Box>
                {/* RECOMPOSIÇÃO, não compressão: a leitura POR HÁBITO é a
                    informação que a grade wide carrega e que o compact não pode
                    perder (paridade com `HabitHistoryGrid.tsx:86-118`, que
                    renderiza uma linha por hábito por dia). O agregado do dia
                    acima é resumo; estas linhas são o dado. */}
                {hasRecord && (
                  <Box
                    component="ul"
                    sx={{ listStyle: 'none', margin: 0, padding: 0, pl: 'var(--ds-space-3)' }}
                  >
                    {habits.map((habit) => {
                      const entry = entriesByHabit.get(habit.id)?.get(day.date)
                      if (entry == null) return null
                      const inactive = inactiveHabitIds?.has(habit.id) ?? false
                      return (
                        <Box
                          component="li"
                          key={habit.id}
                          sx={{
                            display: 'flex',
                            gap: 'var(--ds-space-2)',
                            justifyContent: 'space-between',
                            ...typography.meta,
                            color: 'var(--ds-ink-muted)',
                          }}
                        >
                          <Box component="span">
                            {habit.name}
                            {inactive ? ' · Inativo' : ''}
                          </Box>
                          <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {compactReading(entry, habit)}
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  }

  const groupName = new Map(groups.map((group) => [group.id, group.name]))
  // Ordem: grupos na ordem do registro, hábitos ativos primeiro; inativos em
  // agrupamento PRÓPRIO ao final (mockup F8).
  const activeRows = rows.filter((row) => !row.inactive)
  const inactiveRows = rows.filter((row) => row.inactive)
  const groupIds = [...new Set(activeRows.map((row) => row.habit.group))]

  const sections: { key: string; label: string | null; rows: HabitRowData[] }[] = []
  if (groups.length > 0) {
    for (const id of groupIds) {
      sections.push({
        key: id,
        label: groupName.get(id) ?? 'Sem grupo',
        rows: activeRows.filter((row) => row.habit.group === id),
      })
    }
  } else {
    sections.push({ key: 'all', label: null, rows: activeRows })
  }
  if (inactiveRows.length > 0) {
    sections.push({ key: 'inactive', label: 'Inativos', rows: inactiveRows })
  }

  const columnCount = buckets.length + 1

  return (
    <Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }}>
          <Box
            component="caption"
            sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', textAlign: 'left', pb: 'var(--ds-space-2)' }}
          >
            Completude por hábito e semana, de {formatDateMediumBR(data.start)} a{' '}
            {formatDateMediumBR(data.end)}. Booleano mostra dias feitos sobre dias com registro;
            numérico mostra o percentual médio da meta no período, ou a média dos valores quando
            nenhuma meta estava configurada. Célula tracejada com travessão indica período sem
            nenhum registro. FDS marca semana com fim de semana e FER marca semana com feriado.
          </Box>
          <thead>
            <tr>
              <Box
                component="th"
                scope="col"
                sx={{
                  ...typography.label,
                  textAlign: 'left',
                  p: 'var(--ds-space-2)',
                  border: '1px solid var(--ds-border)',
                  backgroundColor: 'var(--ds-surface-subtle)',
                  color: 'var(--ds-ink)',
                  // Ancorada no wrapper INTERNO da tabela (o `overflowX: auto`
                  // acima), nunca no workspace do shell — contrato verificado
                  // por `shell-states.spec.ts`.
                  position: 'sticky',
                  left: 0,
                }}
              >
                Hábito
              </Box>
              {buckets.map((bucket) => {
                const tags = new Set(
                  bucket.dates
                    .map((date) => DAY_TYPE_TAG[dayByDate.get(date)?.dayType ?? 'weekday'])
                    .filter(Boolean),
                )
                return (
                  <Box
                    component="th"
                    scope="col"
                    key={bucket.start}
                    sx={{
                      ...typography.label,
                      p: 'var(--ds-space-1)',
                      textAlign: 'center',
                      border: '1px solid var(--ds-border)',
                      backgroundColor: 'var(--ds-surface-subtle)',
                      color: 'var(--ds-ink)',
                    }}
                  >
                    {bucketLabel(bucket)}
                    <Box
                      component="span"
                      sx={{ display: 'block', ...typography.meta, color: 'var(--ds-ink-muted)' }}
                    >
                      {/* Dias com REGISTRO no bucket — não dias corridos. As
                          células leem "2/3" sobre esse mesmo denominador; contar
                          dias corridos aqui ("7 dias" sobre "2/3") é exatamente
                          a leitura errada que este rótulo existe para evitar. */}
                      {realDaysLabel(
                        bucket.dates.filter((date) => (dayByDate.get(date)?.entries.length ?? 0) > 0)
                          .length,
                      )}
                      {tags.size > 0 ? ` · ${[...tags].join(' ')}` : ''}
                    </Box>
                  </Box>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.key}>
                {section.label && (
                  <tr>
                    <Box
                      component="th"
                      scope="col"
                      colSpan={columnCount}
                      sx={{
                        ...typography.label,
                        textAlign: 'left',
                        p: 'var(--ds-space-1)',
                        border: '1px solid var(--ds-border)',
                        backgroundColor: 'var(--ds-surface-subtle)',
                        color: 'var(--ds-primary)',
                      }}
                    >
                      {section.label}
                    </Box>
                  </tr>
                )}
                {section.rows.map((row) => (
                  <tr key={row.habit.id}>
                    <Box
                      component="th"
                      scope="row"
                      sx={{
                        ...typography['body-strong'],
                        textAlign: 'left',
                        p: 'var(--ds-space-2)',
                        border: '1px solid var(--ds-border)',
                        backgroundColor: 'var(--ds-surface)',
                        color: 'var(--ds-ink)',
                        position: 'sticky',
                        left: 0,
                      }}
                    >
                      {row.habit.name}
                      {row.inactive && (
                        <Box
                          component="span"
                          data-testid="habit-inactive-chip"
                          sx={{
                            ...typography.label,
                            ml: 'var(--ds-space-1)',
                            borderRadius: 'var(--ds-radius-xs)',
                            px: 'var(--ds-space-1)',
                            opacity: 'var(--ds-task-row-terminal-opacity)',
                            backgroundColor: 'var(--ds-surface-subtle)',
                            border: '1px solid var(--ds-border)',
                            color: 'var(--ds-ink-muted)',
                          }}
                        >
                          Inativo
                        </Box>
                      )}
                      <Box
                        component="span"
                        sx={{ display: 'block', ...typography.meta, color: 'var(--ds-ink-muted)' }}
                      >
                        {row.habit.type === 'boolean' ? 'Booleano' : 'Numérico'}
                        {row.habit.unit ? ` · ${row.habit.unit}` : ''}
                      </Box>
                    </Box>
                    {row.cells.map((cell, index) => (
                      <Box
                        component="td"
                        key={buckets[index].start}
                        sx={{
                          p: 0,
                          textAlign: 'center',
                          // Tracejada é a marca do período SEM NENHUM registro.
                          // Uma célula com registro mas sem razão de completude
                          // (numérico sem meta congelada) é sólida: ela tem
                          // número, só não tem tom.
                          border: cell.hasRecord
                            ? '1px solid var(--ds-border)'
                            : '1px dashed var(--ds-border-strong)',
                        }}
                      >
                        <Box
                          component="span"
                          // Escala CONTÍNUA: `--p` é a completude da própria
                          // célula (mockup `key-habitos.html:220-222`).
                          style={
                            cell.percent == null
                              ? undefined
                              : ({ ['--p' as string]: String(cell.percent) } as CSSProperties)
                          }
                          sx={{
                            // Centragem nos DOIS eixos: `flex` + `center` em
                            // vez de `lineHeight` fingindo altura de linha —
                            // o tom pinta o bloco inteiro, então o número
                            // precisa estar no meio dele de verdade.
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 'var(--ds-touch-target-min)',
                            ...typography['body-strong'],
                            fontVariantNumeric: 'tabular-nums',
                            ...(cell.percent == null
                              ? { color: 'var(--ds-ink-muted)' }
                              : { background: CELL_BACKGROUND, color: CELL_COLOR }),
                          }}
                        >
                          {cell.display}
                          {/* Leitura por extenso — o número dentro da célula
                              nunca é a única fonte. */}
                          <Box component="span" sx={SR_ONLY}>
                            {` ${row.habit.name}, ${bucketLabel(buckets[index])}: ${cell.reading}`}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </Box>
      </Box>

      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', mt: 'var(--ds-space-2)' }}>
        Denominador de ambos os formatos: dias com registro no período, não dias corridos. Um dia
        sem linha materializada não entra nem como falha.
      </Box>

      {/* TABELA EQUIVALENTE — permanente na mesma superfície, em contraste
          normal. É o que sustenta a exceção de contraste das células. */}
      <Box
        component="details"
        sx={{
          mt: 'var(--ds-space-2)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-md)',
          padding: 'var(--ds-space-2)',
          backgroundColor: 'var(--ds-surface)',
        }}
      >
        <Box
          component="summary"
          sx={{
            ...typography.label,
            color: 'var(--ds-ink)',
            minHeight: 'var(--ds-touch-target-min)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          Tabela equivalente da grade
        </Box>
        <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }}>
          <Box
            component="caption"
            sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', textAlign: 'left', pb: 'var(--ds-space-1)' }}
          >
            Mesma leitura em formato linear, hábito por hábito e período por período.
          </Box>
          <thead>
            <tr>
              {['Hábito', 'Período', 'Dias com registro', 'Leitura'].map((header) => (
                <Box
                  component="th"
                  scope="col"
                  key={header}
                  sx={{
                    ...typography.label,
                    textAlign: 'left',
                    p: 'var(--ds-space-1)',
                    border: '1px solid var(--ds-border)',
                    backgroundColor: 'var(--ds-surface-subtle)',
                    color: 'var(--ds-ink)',
                  }}
                >
                  {header}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((row) =>
              row.cells.map((cell, index) => (
                <tr key={`${row.habit.id}-${buckets[index].start}`}>
                  <Box
                    component="th"
                    scope="row"
                    sx={{
                      ...typography.meta,
                      textAlign: 'left',
                      p: 'var(--ds-space-1)',
                      border: '1px solid var(--ds-border)',
                      color: 'var(--ds-ink)',
                    }}
                  >
                    {row.habit.name}
                    {row.inactive ? ' (inativo)' : ''}
                  </Box>
                  <Box
                    component="td"
                    sx={{ ...typography.meta, p: 'var(--ds-space-1)', border: '1px solid var(--ds-border)', color: 'var(--ds-ink)' }}
                  >
                    {bucketLabel(buckets[index])}
                  </Box>
                  <Box
                    component="td"
                    sx={{ ...typography.meta, p: 'var(--ds-space-1)', border: '1px solid var(--ds-border)', color: 'var(--ds-ink)' }}
                  >
                    {cell.daysWithRecord}
                  </Box>
                  <Box
                    component="td"
                    sx={{ ...typography.meta, p: 'var(--ds-space-1)', border: '1px solid var(--ds-border)', color: 'var(--ds-ink)' }}
                  >
                    {cell.reading}
                  </Box>
                </tr>
              )),
            )}
          </tbody>
        </Box>
      </Box>
    </Box>
  )
}
