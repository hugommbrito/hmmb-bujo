// ─────────────────────────────────────────────────────────────────────────────
// Habit Tracker Row (Story 16.1) — variante da Item Row,
// `{components.habit-tracker-row}`.
//
//   ▶ SOBRE `ItemRowBase`, não um fork: reusa altura, raio, hover e a regra de
//     opacidade já resolvidas lá. Os três pontos de extensão usados
//     (`leadingSlot`, `titleTrailing`, `categoryBorder={false}`) nasceram nesta
//     story como props OPT-IN — Recorrentes e Brain Dump seguem idênticos.
//
//   ▶ COLUNA DO GLIFO EXISTE E FICA VAZIA. O pictograma (`iconKey`, seletor,
//     migração `emoticon` → `iconKey`) é a **Story 16.2**. Aqui a coluna é um
//     espaçador de `--ds-domain-icon-size-default`, `aria-hidden`, SEM
//     conteúdo — nada de quadrado, tofu ou glifo de erro (gate 16.0, Q2). O
//     `emoticon` que a API ainda devolve NÃO é renderizado em lugar nenhum.
//
//   ▶ A COLUNA DE CONTROLE ABRIGA DOIS OBJETOS OPOSTOS:
//       booleano → checkbox INTERATIVO (entrada);
//       numérico → checkbox INDICADOR, sempre `disabled`, que marca sozinho ao
//                  atingir a meta (SAÍDA, não entrada — gate 16.0, Q9).
//     Nos dois casos o estado TEXTUAL ("Feito"/"Não feito"/"Meta atingida") é
//     obrigatório: a marca do checkbox nunca é canal único.
//
//   ▶ OTIMISMO RESTRITO AO VALOR DA LINHA. `useMarkHabitEntryMutation` atualiza
//     só `entry.value` no cache; porcentagem, peso efetivo e multiplicador
//     esperam o refetch. Falha ⇒ rollback do cache (o hook) + o valor DIGITADO
//     preservado no campo (este componente) + `role="alert"` junto à linha.
//
// [Source: DESIGN.md#Hábitos L710-712; EXPERIENCE.md#Hábitos; mockup F1/F2/F4,
//  E2/E3/E4; spec 16.1 Task 3 e I/O Matrix]
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Box, Button, Checkbox } from '@mui/material'

import { ItemRowBase } from '../../../bujo'
import { typography } from '../../../../shared/design/tokens'
import { useMarkHabitEntryMutation } from '../../api'
import type { HabitDayEntry } from '../../types'
import {
  RETRY_LABEL,
  decimalInputValue,
  formatFrozenFactors,
  isBooleanDone,
  isMetaReached,
  isUnchangedDecimal,
  parseDecimalInput,
  rowStateText,
} from './habitsSurface'

/** Texto verbatim de falha de escrita (mesma constante do módulo legado). */
export const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
/** Texto verbatim de valor inválido — o campo aceita vírgula E ponto. */
export const INVALID_NUMBER = 'Use um número (vírgula ou ponto).'

const RETRY_BUTTON_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  ...typography.label,
  color: 'var(--ds-danger)',
  border: '1px solid var(--ds-danger)',
  alignSelf: 'flex-start',
} as const

export interface HabitTrackerRowProps {
  entry: HabitDayEntry
  /** Data do dia visível (`undefined` = hoje) — chave do cache da mutação. */
  date?: string
  compact: boolean
  /** Offline: controles de escrita indisponíveis, rótulos seguem legíveis. */
  disabled?: boolean
  /** Id do elemento que explica por que o controle está indisponível. */
  disabledReasonId?: string
}

export function HabitTrackerRow({
  entry,
  date,
  compact,
  disabled = false,
  disabledReasonId,
}: HabitTrackerRowProps) {
  const mark = useMarkHabitEntryMutation(date)
  const reactId = useId()
  const stateId = `habit-row-state-${reactId}`
  const errorId = `habit-row-error-${reactId}`

  // Valor DIGITADO. NÃO é ressincronizado enquanto há escrita pendente, erro de
  // escrita ou entrada inválida — é o que garante "erro de escrita preserva o
  // valor no campo" (I/O Matrix). A troca de dia/linha remonta o componente
  // (`key={entry.id}` em quem chama).
  const [draft, setDraft] = useState(() => decimalInputValue(entry.value))
  const [invalid, setInvalid] = useState(false)
  // Espelho do último `entry.value` já refletido no campo. Quando o servidor
  // devolve um valor diferente do que o campo mostra E não há nada pendente
  // (outra aba/dispositivo gravou, ou o servidor normalizou o número), o campo
  // precisa contar a verdade: continuar exibindo o antigo faria o próximo blur
  // ser tratado como "inalterado" e NADA seria enviado.
  const syncedValueRef = useRef(entry.value ?? null)
  // Última variável enviada — o retry reenvia exatamente a mesma escrita.
  const lastValueRef = useRef<string | null>(null)

  const isNumeric = entry.type === 'numeric'
  const done = isBooleanDone(entry.value)
  const metaReached = isMetaReached(entry.value, entry.metaAtTime)
  const stateText = rowStateText({
    type: entry.type,
    value: entry.value,
    metaAtTime: entry.metaAtTime,
    unit: entry.unit,
  })
  const factors = formatFrozenFactors(entry.weightAtTime, entry.multiplierAtTime)
  const showError = mark.isError || invalid

  const serverValue = entry.value ?? null
  useEffect(() => {
    if (serverValue === syncedValueRef.current) return
    syncedValueRef.current = serverValue
    // Só ressincroniza quando não há nada em voo nem erro/entrada inválida a
    // preservar — a preservação do valor digitado em falha vem primeiro.
    if (mark.isPending || mark.isError || invalid) return
    setDraft(decimalInputValue(entry.value))
  }, [serverValue, mark.isPending, mark.isError, invalid, entry.value])

  function submit(value: string | null) {
    lastValueRef.current = value
    setInvalid(false)
    mark.mutate({ entryId: entry.id, value })
  }

  function toggleBoolean() {
    submit(done ? null : '1')
  }

  function commitNumeric() {
    const parsed = parseDecimalInput(draft)
    if (!parsed.valid) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    // Valor inalterado ⇒ NENHUMA requisição (I/O Matrix).
    if (isUnchangedDecimal(parsed.value, entry.value ?? null)) {
      if (mark.isError) mark.reset()
      return
    }
    submit(parsed.value)
  }

  const describedBy = [stateId, showError ? errorId : null, disabled ? disabledReasonId : null]
    .filter(Boolean)
    .join(' ')

  const control = isNumeric ? (
    // Checkbox INDICADOR — saída, nunca entrada. Permanece `disabled` mesmo
    // online: não está bloqueado por permissão, é uma leitura.
    <Checkbox
      checked={metaReached}
      disabled
      inputProps={{
        'aria-label': `${entry.name}: indicador de meta`,
        'aria-describedby': describedBy || undefined,
      }}
      sx={{ color: 'var(--ds-control-border)', '&.Mui-checked': { color: 'var(--ds-primary)' } }}
    />
  ) : (
    <Checkbox
      checked={done}
      disabled={disabled}
      onChange={toggleBoolean}
      inputProps={{
        'aria-label': entry.name,
        'aria-describedby': describedBy || undefined,
      }}
      sx={{ color: 'var(--ds-control-border)', '&.Mui-checked': { color: 'var(--ds-primary)' } }}
    />
  )

  const leadingSlot = (
    <>
      <Box
        sx={{
          flex: '0 0 auto',
          width: 'var(--ds-habit-tracker-row-control-column)',
          minHeight: 'var(--ds-touch-target-min)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {control}
      </Box>
      {/* Coluna do pictograma: EXISTE e fica VAZIA até a Story 16.2. */}
      <Box
        aria-hidden
        data-testid="habit-glyph-column"
        sx={{
          flex: '0 0 auto',
          width: 'var(--ds-domain-icon-size-default)',
          height: 'var(--ds-domain-icon-size-default)',
        }}
      />
    </>
  )

  // `<input>` NATIVO com `style` — mesmo precedente de `ArchivePage.tsx`: o
  // `sx` do `Box component="input"` não tipa os handlers do input e o estado
  // disabled aqui é conhecido em JS (não precisa de pseudo-classe).
  const numericFieldStyle: CSSProperties = {
    ...typography.body,
    width: compact ? '100%' : 'var(--ds-habit-tracker-row-numeric-field-width)',
    minHeight: 'var(--ds-touch-target-min)',
    textAlign: 'right',
    paddingLeft: 'var(--ds-space-2)',
    paddingRight: 'var(--ds-space-2)',
    borderRadius: 'var(--ds-radius-md)',
    border: `1px solid ${showError ? 'var(--ds-danger)' : 'var(--ds-control-border)'}`,
    background: disabled ? 'var(--ds-surface-subtle)' : 'var(--ds-surface)',
    color: disabled ? 'var(--ds-ink-muted)' : 'var(--ds-ink)',
    fontVariantNumeric: 'tabular-nums',
  }

  const numericField = isNumeric ? (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      aria-label={`Valor de ${entry.name}`}
      aria-invalid={showError || undefined}
      aria-describedby={describedBy || undefined}
      onChange={(event) => {
        setDraft(event.target.value)
        // O erro de FORMATO morre assim que o usuário volta a digitar: manter
        // `aria-invalid`/`INVALID_NUMBER` sobre um texto que já mudou faria o
        // leitor de tela anunciar inválido um valor possivelmente válido.
        if (invalid) setInvalid(false)
      }}
      onBlur={commitNumeric}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commitNumeric()
        }
      }}
      style={numericFieldStyle}
    />
  ) : null

  const row = (
    <ItemRowBase
      title={entry.name}
      subline={stateText}
      sublineId={stateId}
      categoryBorder={false}
      leadingSlot={leadingSlot}
      titleTrailing={
        <Box
          sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', whiteSpace: 'nowrap' }}
          data-testid="habit-row-factors"
        >
          {factors}
        </Box>
      }
      trailingSlot={!compact && isNumeric ? numericField : undefined}
    />
  )

  return (
    <Box component="li" data-testid="habit-tracker-row" sx={{ listStyle: 'none' }}>
      {compact && !isNumeric ? (
        // Compact booleano: a linha inteira é o alvo (rótulo clicável). O
        // `aria-label` do input VENCE o conteúdo do `<label>`, então o nome
        // acessível continua sendo só o nome do hábito.
        <Box
          component="label"
          sx={{
            display: 'block',
            cursor: disabled ? 'default' : 'pointer',
            minHeight: 'var(--ds-task-row-min-height-touch)',
          }}
        >
          {row}
        </Box>
      ) : (
        row
      )}

      {compact && isNumeric && (
        <Box
          sx={{
            pl: 'calc(var(--ds-habit-tracker-row-control-column) + var(--ds-domain-icon-size-default) + var(--ds-space-4))',
            pr: 'var(--ds-space-3)',
            pb: 'var(--ds-space-1)',
          }}
        >
          {numericField}
        </Box>
      )}

      {mark.isPending && (
        <Box
          role="status"
          sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', pl: 'var(--ds-space-2)' }}
        >
          Salvando…
        </Box>
      )}

      {showError && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ds-space-1)',
            pl: 'var(--ds-space-2)',
            pb: 'var(--ds-space-1)',
          }}
        >
          <Box id={errorId} role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
            {invalid ? INVALID_NUMBER : SAVE_ERROR}
          </Box>
          {!invalid && (
            <Button
              onClick={() => submit(lastValueRef.current)}
              disabled={disabled || mark.isPending}
              sx={RETRY_BUTTON_SX}
            >
              {RETRY_LABEL}
            </Button>
          )}
        </Box>
      )}
    </Box>
  )
}
