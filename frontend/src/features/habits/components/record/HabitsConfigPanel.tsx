// ─────────────────────────────────────────────────────────────────────────────
// Aba **Configuração** (Story 16.1) — padrão Coleção: grupos → hábitos do grupo
// → criação ao fim, em largura de LEITURA (`--ds-reading-width`, 800px). O
// registro em cards rompe a largura de leitura; a configuração NÃO.
//
//   ▶ IDENTIDADE × VERSIONADO é o coração desta aba:
//       identidade (nome, unidade, grupo) → `useUpdateHabitIdentityMutation`
//         (UPDATE direto, vale para TODO o histórico);
//       versionado (peso, meta, bônus, ativação) → `useAddHabitVersionMutation`
//         (nova versão com efeito A PARTIR DE HOJE; a 2ª mudança no mesmo dia
//         ATUALIZA a versão do dia, regra do backend).
//     ⚠ ARMADILHA DO LEGADO (`HabitsManager.tsx:67-70`): um único formulário
//     dispara DUAS mutações diferentes. Salvar dispara as duas só quando cada
//     lado realmente mudou.
//
//   ▶ O AVISO É TEXTO PERSISTENTE, nunca tooltip (o legado usava `Tooltip`, que
//     não sobrevive a teclado nem a toque) — `ProspectiveNotice`.
//
//   ▶ EXCLUIR NÃO EXISTE. O domínio desativa: "Desativar hábito" / "Reativar
//     hábito", ações que nomeiam a consequência.
//
//   ▶ FALHA PARCIAL: o bloco de multiplicadores de um grupo falha SEM derrubar
//     a lista de hábitos (cada bloco tem erro e retry próprios).
//
// [Source: EXPERIENCE.md#Hábitos §Configuração; mockup F5/F6/F7; spec Task 5]
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useState, type FormEvent } from 'react'
import { Box, Button, Checkbox, FormControlLabel } from '@mui/material'

import { typography } from '../../../../shared/design/tokens'
import {
  useAddHabitVersionMutation,
  useCreateHabitGroupMutation,
  useCreateHabitMutation,
  useGroupMultipliersQuery,
  useHabitGroupsQuery,
  useHabitsQuery,
  useSetGroupMultipliersMutation,
  useUpdateHabitIdentityMutation,
} from '../../api'
import { formatDateBR } from '../historyUtils'
import type { Habit, HabitGroup, HabitType } from '../../types'
import { HabitsConfigSkeleton } from './HabitsSkeleton'
import { Field, FieldPair, ProspectiveNotice } from './HabitsFormControls'
import { PRIMARY_BUTTON_SX, SECONDARY_BUTTON_SX, controlStyle } from './habitsFormStyles'
import { decimalInputValue, formatDecimal, parseDecimalInput } from './habitsSurface'

/** Textos verbatim do gate. */
export const NO_GROUP_REASON = 'Crie um grupo para começar a adicionar hábitos.'
export const EMPTY_GROUP = 'Nenhum hábito neste grupo.'
export const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
export const READ_ERROR = 'Não foi possível carregar. Tente novamente.'
export const MULTIPLIER_PRECEDENCE =
  'Precedência: feriado > fim de semana > dia útil. Dia útil vale 1,00 e nunca é armazenado. Campo vazio remove a configuração e a leitura volta a 1,00.'
export const SHOW_INACTIVE = 'Mostrar inativos'

const HABIT_TYPE_LABEL: Record<HabitType, string> = {
  boolean: 'Booleano',
  numeric: 'Numérico',
}

/** Resumo factual da linha: `Numérico · km · Peso 3 · Meta 8 · Bônus 0%`. */
function habitSummary(habit: Habit): string {
  const parts: string[] = [HABIT_TYPE_LABEL[habit.type]]
  if (habit.type === 'numeric' && habit.unit) parts.push(habit.unit)
  parts.push(`Peso ${formatDecimal(habit.weight) ?? '0'}`)
  if (habit.type === 'numeric' && habit.meta != null) {
    parts.push(`Meta ${formatDecimal(habit.meta) ?? '0'}`)
  }
  if (habit.type === 'numeric' && habit.bonus != null) {
    parts.push(`Bônus ${formatDecimal(habit.bonus) ?? '0'}%`)
  }
  if (!habit.active) parts.push(`inativo desde ${formatDateBR(habit.effectiveFrom)}`)
  return parts.join(' · ')
}

// ─── Bloco de multiplicadores por grupo ──────────────────────────────────────

interface GroupMultiplierBlockProps {
  group: HabitGroup
  disabled?: boolean
  disabledReasonId?: string
}

function GroupMultiplierBlock({ group, disabled, disabledReasonId }: GroupMultiplierBlockProps) {
  const query = useGroupMultipliersQuery(group.id)

  if (query.isPending) {
    return (
      <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
        Carregando os multiplicadores de {group.name}…
      </Box>
    )
  }

  // Falha do bloco de multiplicador NÃO derruba a lista de hábitos.
  if (query.isError || !query.data) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-1)',
          alignItems: 'flex-start',
        }}
      >
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
          {READ_ERROR}
        </Box>
        <Button
          onClick={() => query.refetch()}
          sx={{ ...SECONDARY_BUTTON_SX, color: 'var(--ds-danger)', borderColor: 'var(--ds-danger)' }}
        >
          Tentar novamente
        </Button>
      </Box>
    )
  }

  return (
    <GroupMultiplierForm
      // Remonta ao trocar de grupo/config vigente (padrão do legado,
      // `HabitsManager.tsx:174-185`): o estado inicializa UMA vez a partir dos
      // valores vigentes, sem corrida de prefill.
      key={`${group.id}:${query.data.weekend}:${query.data.holiday}`}
      group={group}
      initialWeekend={query.data.weekend}
      initialHoliday={query.data.holiday}
      disabled={disabled}
      disabledReasonId={disabledReasonId}
    />
  )
}

interface GroupMultiplierFormProps {
  group: HabitGroup
  initialWeekend: string
  initialHoliday: string
  disabled?: boolean
  disabledReasonId?: string
}

/**
 * `1,00` ⇄ campo VAZIO. O servidor sempre devolve um decimal (default `1.00`),
 * então "sem configuração" e "configurado em 1,00" são indistinguíveis no
 * contrato — e semanticamente idênticos ("dia útil é 1,00 implícito, nunca
 * armazenado"). Mostrar o campo vazio com placeholder `1,00` é o que o gate
 * desenhou e o que torna "limpar o campo remove a configuração" reversível.
 */
function multiplierFieldValue(raw: string): string {
  return Number(raw) === 1 ? '' : decimalInputValue(raw)
}

function GroupMultiplierForm({
  group,
  initialWeekend,
  initialHoliday,
  disabled,
  disabledReasonId,
}: GroupMultiplierFormProps) {
  const save = useSetGroupMultipliersMutation()
  const [weekend, setWeekend] = useState(() => multiplierFieldValue(initialWeekend))
  const [holiday, setHoliday] = useState(() => multiplierFieldValue(initialHoliday))
  const [invalid, setInvalid] = useState(false)
  const reactId = useId()
  const weekendId = `habit-multiplier-weekend-${reactId}`
  const holidayId = `habit-multiplier-holiday-${reactId}`

  function handleSave(event: FormEvent) {
    event.preventDefault()
    const parsedWeekend = parseDecimalInput(weekend)
    const parsedHoliday = parseDecimalInput(holiday)
    if (!parsedWeekend.valid || !parsedHoliday.valid) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    save.mutate({ groupId: group.id, weekend: parsedWeekend.value, holiday: parsedHoliday.value })
  }

  return (
    <Box
      component="form"
      onSubmit={handleSave}
      aria-label={`Multiplicadores do grupo ${group.name}`}
      sx={{
        border: '1px dashed var(--ds-border-strong)',
        borderRadius: 'var(--ds-radius-md)',
        padding: 'var(--ds-space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-2)',
      }}
    >
      <Box component="h4" sx={{ ...typography['body-strong'], color: 'var(--ds-ink)', margin: 0 }}>
        Multiplicadores do grupo {group.name}
      </Box>
      {/* Precedência DECLARADA no próprio bloco onde a config é editada. */}
      <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{MULTIPLIER_PRECEDENCE}</Box>
      <FieldPair>
        <Field id={weekendId} label="Fim de semana ×">
          <input
            id={weekendId}
            type="text"
            inputMode="decimal"
            placeholder="1,00"
            value={weekend}
            disabled={disabled}
            aria-label={`Multiplicador de fim de semana de ${group.name}`}
            aria-describedby={disabled ? disabledReasonId : undefined}
            onChange={(event) => setWeekend(event.target.value)}
            style={controlStyle(disabled)}
          />
        </Field>
        <Field id={holidayId} label="Feriado ×">
          <input
            id={holidayId}
            type="text"
            inputMode="decimal"
            placeholder="1,00"
            value={holiday}
            disabled={disabled}
            aria-label={`Multiplicador de feriado de ${group.name}`}
            aria-describedby={disabled ? disabledReasonId : undefined}
            onChange={(event) => setHoliday(event.target.value)}
            style={controlStyle(disabled)}
          />
        </Field>
      </FieldPair>
      <ProspectiveNotice />
      <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          type="submit"
          disabled={disabled || save.isPending}
          aria-describedby={disabled ? disabledReasonId : undefined}
          sx={PRIMARY_BUTTON_SX}
        >
          Salvar multiplicadores
        </Button>
        {(save.isError || invalid) && (
          <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
            {SAVE_ERROR}
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Bloco de edição (identidade × versionado) ───────────────────────────────

interface HabitEditBlockProps {
  habit: Habit
  groups: HabitGroup[]
  onClose: () => void
  disabled?: boolean
  disabledReasonId?: string
}

function HabitEditBlock({ habit, groups, onClose, disabled, disabledReasonId }: HabitEditBlockProps) {
  const addVersion = useAddHabitVersionMutation()
  const updateIdentity = useUpdateHabitIdentityMutation()
  const isNumeric = habit.type === 'numeric'
  const reactId = useId()

  const [name, setName] = useState(habit.name)
  const [unit, setUnit] = useState(habit.unit ?? '')
  const [group, setGroup] = useState(habit.group)
  const [weight, setWeight] = useState(() => decimalInputValue(habit.weight))
  const [meta, setMeta] = useState(() => decimalInputValue(habit.meta))
  const [bonus, setBonus] = useState(() => decimalInputValue(habit.bonus))
  const [invalid, setInvalid] = useState(false)

  const ids = {
    name: `habit-edit-name-${reactId}`,
    unit: `habit-edit-unit-${reactId}`,
    group: `habit-edit-group-${reactId}`,
    weight: `habit-edit-weight-${reactId}`,
    meta: `habit-edit-meta-${reactId}`,
    bonus: `habit-edit-bonus-${reactId}`,
  }

  function handleSave(event: FormEvent) {
    event.preventDefault()
    const parsedWeight = parseDecimalInput(weight)
    const parsedMeta = parseDecimalInput(meta)
    const parsedBonus = parseDecimalInput(bonus)
    if (!parsedWeight.valid || !parsedMeta.valid || !parsedBonus.valid || parsedWeight.value == null) {
      setInvalid(true)
      return
    }
    setInvalid(false)

    // ── VERSIONADO: peso/meta/bônus abrem versão com vigência de HOJE.
    addVersion.mutate({
      habitId: habit.id,
      weight: parsedWeight.value,
      ...(isNumeric ? { meta: parsedMeta.value, bonus: parsedBonus.value } : {}),
    })

    // ── IDENTIDADE: UPDATE direto, vale para todo o histórico. Só dispara se
    // algum campo de identidade realmente mudou (duas mutações distintas).
    const identity: { name?: string; unit?: string; group?: string } = {}
    if (name.trim() !== habit.name) identity.name = name.trim()
    if (isNumeric && unit.trim() !== (habit.unit ?? '')) identity.unit = unit.trim()
    if (group !== habit.group) identity.group = group
    if (Object.keys(identity).length > 0) {
      updateIdentity.mutate({ habitId: habit.id, ...identity })
    }
  }

  const writeError = addVersion.isError || updateIdentity.isError || invalid

  return (
    <Box
      component="form"
      onSubmit={handleSave}
      aria-label={`Editando o hábito ${habit.name}`}
      data-testid="habit-edit-block"
      sx={{
        border: '1px solid var(--ds-primary)',
        borderRadius: 'var(--ds-radius-md)',
        backgroundColor: 'var(--ds-surface)',
        padding: 'var(--ds-space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-3)',
      }}
    >
      <Box component="h4" sx={{ ...typography['body-strong'], color: 'var(--ds-ink)', margin: 0 }}>
        Editando: {habit.name}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))',
          gap: 'var(--ds-space-3)',
        }}
      >
        <Box
          sx={{
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-sm)',
            padding: 'var(--ds-space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ds-space-2)',
          }}
        >
          <Box component="h5" sx={{ ...typography['body-strong'], color: 'var(--ds-ink)', margin: 0 }}>
            Identidade
          </Box>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
            Vale para todo o histórico. Não cria versão.
          </Box>
          <Field id={ids.name} label="Nome">
            <input
              id={ids.name}
              value={name}
              disabled={disabled}
              onChange={(event) => setName(event.target.value)}
              style={controlStyle(disabled)}
            />
          </Field>
          {isNumeric && (
            <Field id={ids.unit} label="Unidade">
              <input
                id={ids.unit}
                value={unit}
                disabled={disabled}
                onChange={(event) => setUnit(event.target.value)}
                style={controlStyle(disabled)}
              />
            </Field>
          )}
          <Field id={ids.group} label="Grupo">
            <select
              id={ids.group}
              value={group}
              disabled={disabled}
              onChange={(event) => setGroup(event.target.value)}
              style={controlStyle(disabled)}
            >
              {groups.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
        </Box>

        <Box
          sx={{
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-sm)',
            padding: 'var(--ds-space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ds-space-2)',
          }}
        >
          <Box component="h5" sx={{ ...typography['body-strong'], color: 'var(--ds-ink)', margin: 0 }}>
            Versionado
          </Box>
          <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
            Cria versão com vigência a partir de hoje. O histórico não muda.
          </Box>
          <FieldPair>
            <Field id={ids.weight} label="Peso">
              <input
                id={ids.weight}
                type="text"
                inputMode="decimal"
                value={weight}
                disabled={disabled}
                aria-label={`Peso de ${habit.name}`}
                onChange={(event) => setWeight(event.target.value)}
                style={controlStyle(disabled)}
              />
            </Field>
            {isNumeric && (
              <Field id={ids.meta} label="Meta">
                <input
                  id={ids.meta}
                  type="text"
                  inputMode="decimal"
                  value={meta}
                  disabled={disabled}
                  aria-label={`Meta de ${habit.name}`}
                  onChange={(event) => setMeta(event.target.value)}
                  style={controlStyle(disabled)}
                />
              </Field>
            )}
          </FieldPair>
          {isNumeric && (
            <Field id={ids.bonus} label="Bônus (%)">
              <input
                id={ids.bonus}
                type="text"
                inputMode="decimal"
                value={bonus}
                disabled={disabled}
                aria-label={`Bônus de ${habit.name}`}
                onChange={(event) => setBonus(event.target.value)}
                style={controlStyle(disabled)}
              />
            </Field>
          )}
          <ProspectiveNotice />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          type="submit"
          disabled={disabled || addVersion.isPending}
          aria-describedby={disabled ? disabledReasonId : undefined}
          sx={PRIMARY_BUTTON_SX}
        >
          Salvar alterações
        </Button>
        {/* Descarta sem tocar o servidor. */}
        <Button type="button" onClick={onClose} sx={SECONDARY_BUTTON_SX}>
          Cancelar edição
        </Button>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          Segunda alteração no mesmo dia atualiza a versão de hoje, não cria outra.
        </Box>
        {writeError && (
          <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
            {SAVE_ERROR}
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Painel ──────────────────────────────────────────────────────────────────

export interface HabitsConfigPanelProps {
  disabled?: boolean
  disabledReasonId?: string
}

export function HabitsConfigPanel({ disabled = false, disabledReasonId }: HabitsConfigPanelProps) {
  const [showInactive, setShowInactive] = useState(false)
  const groupsQuery = useHabitGroupsQuery()
  const habitsQuery = useHabitsQuery({ includeInactive: showInactive })
  const createGroup = useCreateHabitGroupMutation()
  const createHabit = useCreateHabitMutation()
  const addVersion = useAddHabitVersionMutation()
  const reactId = useId()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [newType, setNewType] = useState<HabitType>('boolean')
  const [newWeight, setNewWeight] = useState('1')
  const [newMeta, setNewMeta] = useState('')
  const [newBonus, setNewBonus] = useState('')
  const [newUnit, setNewUnit] = useState('')

  const ids = {
    groupName: `habit-new-group-${reactId}`,
    name: `habit-new-name-${reactId}`,
    group: `habit-new-habit-group-${reactId}`,
    weight: `habit-new-weight-${reactId}`,
    unit: `habit-new-unit-${reactId}`,
    meta: `habit-new-meta-${reactId}`,
    bonus: `habit-new-bonus-${reactId}`,
    reason: `habit-no-group-reason-${reactId}`,
  }

  if (groupsQuery.isPending || habitsQuery.isPending) return <HabitsConfigSkeleton />

  if (groupsQuery.isError || habitsQuery.isError) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-2)',
          alignItems: 'flex-start',
        }}
      >
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
          {READ_ERROR}
        </Box>
        <Button
          onClick={() => {
            groupsQuery.refetch()
            habitsQuery.refetch()
          }}
          sx={PRIMARY_BUTTON_SX}
        >
          Tentar de novo
        </Button>
      </Box>
    )
  }

  const groups = groupsQuery.data ?? []
  const habits = habitsQuery.data ?? []
  const hasGroups = groups.length > 0
  const creationDisabled = disabled || !hasGroups
  const creationReasonId = !hasGroups ? ids.reason : disabled ? disabledReasonId : undefined

  function handleCreateGroup(event: FormEvent) {
    event.preventDefault()
    const trimmed = groupName.trim()
    if (!trimmed) return
    createGroup.mutate({ name: trimmed }, { onSuccess: () => setGroupName('') })
  }

  function handleCreateHabit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = newName.trim()
    const parsedWeight = parseDecimalInput(newWeight)
    if (!trimmedName || !newGroup || !parsedWeight.valid || parsedWeight.value == null) return
    const parsedMeta = parseDecimalInput(newMeta)
    const parsedBonus = parseDecimalInput(newBonus)
    createHabit.mutate(
      {
        name: trimmedName,
        group: newGroup,
        type: newType,
        weight: parsedWeight.value,
        // `emoticon` NÃO é enviado: o emoji saiu da interface de Hábitos
        // (gate 16.0, Q2); `iconKey` é a Story 16.2.
        ...(newType === 'numeric'
          ? { meta: parsedMeta.value, bonus: parsedBonus.value, unit: newUnit.trim() }
          : {}),
      },
      {
        onSuccess: () => {
          setNewName('')
          setNewWeight('1')
          setNewMeta('')
          setNewBonus('')
          setNewUnit('')
          setNewType('boolean')
        },
      },
    )
  }

  function toggleActive(habit: Habit) {
    addVersion.mutate({ habitId: habit.id, active: !habit.active })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-4)',
        // A configuração é leitura textual corrida — largura de leitura.
        maxWidth: 'var(--ds-reading-width)',
        width: '100%',
      }}
    >
      <FormControlLabel
        sx={{ margin: 0, alignSelf: 'flex-end', ...typography.body, color: 'var(--ds-ink)' }}
        control={
          <Checkbox
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            inputProps={{ 'aria-label': SHOW_INACTIVE }}
            sx={{
              color: 'var(--ds-control-border)',
              '&.Mui-checked': { color: 'var(--ds-primary)' },
            }}
          />
        }
        label={SHOW_INACTIVE}
      />

      {!hasGroups && (
        <Box
          id={ids.reason}
          role="note"
          sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}
        >
          {NO_GROUP_REASON}
        </Box>
      )}

      {groups.map((group) => {
        const groupHabits = habits.filter((habit) => habit.group === group.id)
        const activeCount = groupHabits.filter((habit) => habit.active).length
        return (
          <Box
            key={group.id}
            component="section"
            aria-labelledby={`habits-config-group-${group.id}`}
            sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--ds-space-2)',
                flexWrap: 'wrap',
              }}
            >
              <Box
                component="h3"
                id={`habits-config-group-${group.id}`}
                sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}
              >
                {group.name}
              </Box>
              <Box
                sx={{
                  ...typography.meta,
                  color: 'var(--ds-ink-muted)',
                  marginLeft: 'auto',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {activeCount} {activeCount === 1 ? 'hábito ativo' : 'hábitos ativos'}
              </Box>
            </Box>

            {groupHabits.length === 0 ? (
              <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{EMPTY_GROUP}</Box>
            ) : (
              <Box component="ul" sx={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {groupHabits.map((habit) => (
                  <Box
                    component="li"
                    key={habit.id}
                    data-testid="habit-config-row"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--ds-space-1)',
                      borderBottom: '1px solid var(--ds-border)',
                      py: 'var(--ds-space-2)',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--ds-space-2)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            ...typography['body-strong'],
                            color: 'var(--ds-ink)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--ds-space-1)',
                          }}
                        >
                          {habit.name}
                          {/* Chip TEXTUAL — opacidade nunca é canal único. */}
                          {!habit.active && (
                            <Box
                              component="span"
                              data-testid="habit-inactive-chip"
                              sx={{
                                ...typography.label,
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
                        </Box>
                        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                          {habitSummary(habit)}
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          marginLeft: 'auto',
                          display: 'flex',
                          gap: 'var(--ds-space-2)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <Button
                          onClick={() => setEditingId(editingId === habit.id ? null : habit.id)}
                          aria-label={`Editar ${habit.name}`}
                          sx={SECONDARY_BUTTON_SX}
                        >
                          Editar
                        </Button>
                        <Button
                          onClick={() => toggleActive(habit)}
                          disabled={disabled || addVersion.isPending}
                          aria-describedby={disabled ? disabledReasonId : undefined}
                          aria-label={`${habit.active ? 'Desativar' : 'Reativar'} hábito ${habit.name}`}
                          sx={SECONDARY_BUTTON_SX}
                        >
                          {habit.active ? 'Desativar hábito' : 'Reativar hábito'}
                        </Button>
                      </Box>
                    </Box>

                    {/* UM bloco de edição aberto por vez. */}
                    {editingId === habit.id && (
                      <HabitEditBlock
                        key={habit.id}
                        habit={habit}
                        groups={groups}
                        onClose={() => setEditingId(null)}
                        disabled={disabled}
                        disabledReasonId={disabledReasonId}
                      />
                    )}
                  </Box>
                ))}
              </Box>
            )}

            <GroupMultiplierBlock
              group={group}
              disabled={disabled}
              disabledReasonId={disabledReasonId}
            />
          </Box>
        )
      })}

      {/* ── Criação ao fim ──────────────────────────────────────────────── */}
      <Box
        component="form"
        onSubmit={handleCreateHabit}
        aria-label="Adicionar hábito"
        sx={{
          backgroundColor: 'var(--ds-surface)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-md)',
          padding: 'var(--ds-panel-padding)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-3)',
        }}
      >
        <Box component="h3" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
          Adicionar hábito
        </Box>
        <FieldPair>
          <Field id={ids.name} label="Nome" hint="(obrigatório)">
            <input
              id={ids.name}
              value={newName}
              disabled={creationDisabled}
              aria-describedby={creationReasonId}
              onChange={(event) => setNewName(event.target.value)}
              style={controlStyle(creationDisabled)}
            />
          </Field>
          <Field id={ids.group} label="Grupo" hint="(obrigatório)">
            <select
              id={ids.group}
              value={newGroup}
              disabled={creationDisabled}
              aria-describedby={creationReasonId}
              onChange={(event) => setNewGroup(event.target.value)}
              style={controlStyle(creationDisabled)}
            >
              <option value="">
                {hasGroups ? 'Selecione um grupo' : 'Nenhum grupo cadastrado'}
              </option>
              {groups.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
        </FieldPair>

        {/* Tipo em `radiogroup`, IMUTÁVEL depois da criação. */}
        <Box
          component="fieldset"
          sx={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}
        >
          <Box component="legend" sx={{ ...typography.label, color: 'var(--ds-ink)', padding: 0 }}>
            Tipo{' '}
            <Box component="span" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
              (obrigatório · imutável depois da criação)
            </Box>
          </Box>
          <Box role="radiogroup" aria-label="Tipo do hábito" sx={{ display: 'flex', gap: 'var(--ds-space-2)' }}>
            {(Object.keys(HABIT_TYPE_LABEL) as HabitType[]).map((value) => (
              <Box
                key={value}
                component="label"
                sx={{
                  ...typography.body,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--ds-space-1)',
                  minHeight: 'var(--ds-touch-target-min)',
                  px: 'var(--ds-space-2)',
                  borderRadius: 'var(--ds-radius-md)',
                  border: '1px solid',
                  borderColor: newType === value ? 'var(--ds-primary)' : 'var(--ds-control-border)',
                  backgroundColor: newType === value ? 'var(--ds-primary-soft)' : 'transparent',
                  color: newType === value ? 'var(--ds-primary)' : 'var(--ds-ink)',
                }}
              >
                <input
                  type="radio"
                  name={`habit-type-${reactId}`}
                  value={value}
                  checked={newType === value}
                  disabled={creationDisabled}
                  aria-describedby={creationReasonId}
                  onChange={() => setNewType(value)}
                />
                {HABIT_TYPE_LABEL[value]}
              </Box>
            ))}
          </Box>
        </Box>

        <FieldPair>
          <Field id={ids.weight} label="Peso inicial" hint="(obrigatório)">
            <input
              id={ids.weight}
              type="text"
              inputMode="decimal"
              value={newWeight}
              disabled={creationDisabled}
              aria-describedby={creationReasonId}
              onChange={(event) => setNewWeight(event.target.value)}
              style={controlStyle(creationDisabled)}
            />
          </Field>
          {/* Meta, bônus e unidade SÓ existem no tipo numérico. */}
          {newType === 'numeric' && (
            <Field id={ids.unit} label="Unidade">
              <input
                id={ids.unit}
                value={newUnit}
                disabled={creationDisabled}
                aria-describedby={creationReasonId}
                onChange={(event) => setNewUnit(event.target.value)}
                style={controlStyle(creationDisabled)}
              />
            </Field>
          )}
        </FieldPair>
        {newType === 'numeric' && (
          <FieldPair>
            <Field id={ids.meta} label="Meta">
              <input
                id={ids.meta}
                type="text"
                inputMode="decimal"
                value={newMeta}
                disabled={creationDisabled}
                aria-describedby={creationReasonId}
                onChange={(event) => setNewMeta(event.target.value)}
                style={controlStyle(creationDisabled)}
              />
            </Field>
            <Field id={ids.bonus} label="Bônus (%)">
              <input
                id={ids.bonus}
                type="text"
                inputMode="decimal"
                value={newBonus}
                disabled={creationDisabled}
                aria-describedby={creationReasonId}
                onChange={(event) => setNewBonus(event.target.value)}
                style={controlStyle(creationDisabled)}
              />
            </Field>
          </FieldPair>
        )}
        <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            type="submit"
            disabled={creationDisabled || createHabit.isPending}
            aria-describedby={creationReasonId}
            sx={PRIMARY_BUTTON_SX}
          >
            Adicionar hábito
          </Button>
          {createHabit.isError && (
            <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
              {SAVE_ERROR}
            </Box>
          )}
        </Box>
      </Box>

      <Box
        component="form"
        onSubmit={handleCreateGroup}
        aria-label="Adicionar grupo"
        sx={{
          backgroundColor: 'var(--ds-surface)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-md)',
          padding: 'var(--ds-panel-padding)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-3)',
        }}
      >
        <Box component="h3" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
          Adicionar grupo
        </Box>
        <Field id={ids.groupName} label="Nome do grupo">
          <input
            id={ids.groupName}
            value={groupName}
            disabled={disabled}
            aria-describedby={disabled ? disabledReasonId : undefined}
            onChange={(event) => setGroupName(event.target.value)}
            style={controlStyle(disabled)}
          />
        </Field>
        <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            type="submit"
            disabled={disabled || createGroup.isPending}
            aria-describedby={disabled ? disabledReasonId : undefined}
            sx={PRIMARY_BUTTON_SX}
          >
            Adicionar grupo
          </Button>
          {createGroup.isError && (
            <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
              {SAVE_ERROR}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
