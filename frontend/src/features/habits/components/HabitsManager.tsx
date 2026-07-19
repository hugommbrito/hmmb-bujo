import { useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import {
  useAddHabitVersionMutation,
  useCreateHabitGroupMutation,
  useCreateHabitMutation,
  useGroupMultipliersQuery,
  useHabitGroupsQuery,
  useHabitsQuery,
  useSetGroupMultipliersMutation,
  useUpdateHabitIdentityMutation,
} from '../api'
import type { Habit, HabitGroup, HabitType } from '../types'

// String EXATA da AC2 / Fluxo 7 — não alterar (verificada em teste).
const PROSPECTIVE_CHANGE_TOOLTIP =
  'Alteração válida a partir de hoje. Registros anteriores preservados.'
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'

const HABIT_TYPE_LABEL: Record<HabitType, string> = {
  boolean: 'Booleano',
  numeric: 'Numérico',
}

interface HabitRowProps {
  habit: Habit
}

// Edição inline de peso (e meta/bonus para numéricos) — toda mudança insere uma
// nova versão prospectiva (AC2). O toggle Desativar/Ativar também insere versão (AC3).
function HabitRow({ habit }: HabitRowProps) {
  const addVersion = useAddHabitVersionMutation()
  const updateIdentity = useUpdateHabitIdentityMutation()
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(habit.weight)
  const [meta, setMeta] = useState(habit.meta ?? '')
  const [bonus, setBonus] = useState(habit.bonus ?? '')
  const [unit, setUnit] = useState(habit.unit ?? '')
  const isNumeric = habit.type === 'numeric'

  function handleSave() {
    const trimmed = weight.trim()
    if (!trimmed) return
    addVersion.mutate(
      {
        habitId: habit.id,
        weight: trimmed,
        ...(isNumeric ? { meta: meta === '' ? null : meta, bonus: bonus === '' ? null : bonus } : {}),
      },
      { onSuccess: () => setEditing(false) },
    )
    // Unidade é identidade (não versionada) → UPDATE direto, mutation separada.
    if (isNumeric && unit.trim() !== (habit.unit ?? '')) {
      updateIdentity.mutate({ habitId: habit.id, unit: unit.trim() })
    }
  }

  function handleToggleActive() {
    addVersion.mutate({ habitId: habit.id, active: !habit.active })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 1,
        minHeight: 44,
        opacity: habit.active ? 1 : 0.6,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {habit.emoticon ? `${habit.emoticon} ` : ''}
          {habit.name}
          {!habit.active && ' (inativo)'}
        </Typography>
        {editing ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mt: 0.5, flexWrap: 'wrap' }}>
            <Tooltip title={PROSPECTIVE_CHANGE_TOOLTIP}>
              <TextField
                label="Peso"
                type="number"
                size="small"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                inputProps={{ 'aria-label': `Peso de ${habit.name}` }}
              />
            </Tooltip>
            {isNumeric && (
              <>
                <TextField
                  label="Meta"
                  type="number"
                  size="small"
                  value={meta}
                  onChange={(event) => setMeta(event.target.value)}
                  inputProps={{ 'aria-label': `Meta de ${habit.name}` }}
                />
                <TextField
                  label="Bonus"
                  type="number"
                  size="small"
                  value={bonus}
                  onChange={(event) => setBonus(event.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  inputProps={{ 'aria-label': `Bonus de ${habit.name}` }}
                />
                <TextField
                  label="Unidade"
                  size="small"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  inputProps={{ 'aria-label': `Unidade de ${habit.name}` }}
                  sx={{ width: 120 }}
                />
              </>
            )}
            <Button size="small" onClick={handleSave}>
              Salvar
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Peso: {habit.weight}
            {isNumeric && habit.meta != null && ` · Meta: ${habit.meta}`}
            {isNumeric && habit.bonus != null && ` · Bonus: ${habit.bonus}%`}
          </Typography>
        )}
        {addVersion.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
      {!editing && (
        <Button size="small" onClick={() => setEditing(true)}>
          Editar peso
        </Button>
      )}
      <Button size="small" onClick={handleToggleActive}>
        {habit.active ? 'Desativar' : 'Ativar'}
      </Button>
    </Box>
  )
}

// Config do multiplicador por grupo (AC1) — primeira edição por-grupo. Dois campos
// numéricos ("Fim de semana ×", "Feriado ×") preenchidos pela config vigente e
// salvos prospectivamente (INSERT com effective_from=hoje; dias congelados intactos).
interface GroupMultiplierConfigProps {
  groupId: string
}

function GroupMultiplierConfig({ groupId }: GroupMultiplierConfigProps) {
  const query = useGroupMultipliersQuery(groupId)
  // Só monta o formulário depois de carregar a config → estado inicializa uma vez
  // a partir dos valores vigentes (sem corrida de prefill). `key` remonta ao trocar
  // de grupo/config.
  if (!query.data) return null
  return (
    <GroupMultiplierForm
      key={`${groupId}:${query.data.weekend}:${query.data.holiday}`}
      groupId={groupId}
      initialWeekend={query.data.weekend}
      initialHoliday={query.data.holiday}
    />
  )
}

interface GroupMultiplierFormProps {
  groupId: string
  initialWeekend: string
  initialHoliday: string
}

function GroupMultiplierForm({
  groupId,
  initialWeekend,
  initialHoliday,
}: GroupMultiplierFormProps) {
  const save = useSetGroupMultipliersMutation()
  const [weekend, setWeekend] = useState(initialWeekend)
  const [holiday, setHoliday] = useState(initialHoliday)

  function handleSave() {
    save.mutate({
      groupId,
      weekend: weekend.trim() === '' ? null : weekend.trim(),
      holiday: holiday.trim() === '' ? null : holiday.trim(),
    })
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', px: 1, pb: 1, flexWrap: 'wrap' }}>
      {/* Tooltip nos campos (não no botão): assim o botão mantém o nome acessível
          "Salvar multiplicadores" e o input mantém seu aria-label (padrão da 6.1). */}
      <Tooltip title={PROSPECTIVE_CHANGE_TOOLTIP}>
        <TextField
          label="Fim de semana ×"
          type="number"
          size="small"
          value={weekend}
          onChange={(event) => setWeekend(event.target.value)}
          inputProps={{ 'aria-label': `Multiplicador de fim de semana de ${groupId}`, step: '0.1' }}
          sx={{ width: 150 }}
        />
      </Tooltip>
      <Tooltip title={PROSPECTIVE_CHANGE_TOOLTIP}>
        <TextField
          label="Feriado ×"
          type="number"
          size="small"
          value={holiday}
          onChange={(event) => setHoliday(event.target.value)}
          inputProps={{ 'aria-label': `Multiplicador de feriado de ${groupId}`, step: '0.1' }}
          sx={{ width: 150 }}
        />
      </Tooltip>
      <Button size="small" onClick={handleSave} disabled={save.isPending}>
        Salvar multiplicadores
      </Button>
      {save.isError && (
        <Typography variant="caption" color="error" role="alert">
          {SAVE_ERROR}
        </Typography>
      )}
    </Box>
  )
}

interface GroupSectionProps {
  group: HabitGroup
  habits: Habit[]
}

function GroupSection({ group, habits }: GroupSectionProps) {
  const groupHabits = habits.filter((habit) => habit.group === group.id)
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" component="h3" sx={{ px: 1, py: 0.5 }}>
        {group.name}
      </Typography>
      <GroupMultiplierConfig groupId={group.id} />
      {groupHabits.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          Nenhum hábito neste grupo.
        </Typography>
      ) : (
        groupHabits.map((habit) => <HabitRow key={habit.id} habit={habit} />)
      )}
    </Box>
  )
}

export function HabitsManager() {
  const groupsQuery = useHabitGroupsQuery()
  const [showInactive, setShowInactive] = useState(false)
  const habitsQuery = useHabitsQuery({ includeInactive: showInactive })
  const createGroup = useCreateHabitGroupMutation()
  const createHabit = useCreateHabitMutation()

  const [groupName, setGroupName] = useState('')

  const [name, setName] = useState('')
  const [emoticon, setEmoticon] = useState('')
  const [group, setGroup] = useState('')
  const [type, setType] = useState<HabitType>('boolean')
  const [weight, setWeight] = useState('')
  const [meta, setMeta] = useState('')
  const [bonus, setBonus] = useState('')
  const [unit, setUnit] = useState('')

  const groups = groupsQuery.data ?? []
  const habits = habitsQuery.data ?? []
  const hasGroups = groups.length > 0

  function handleCreateGroup(event: FormEvent) {
    event.preventDefault()
    const trimmed = groupName.trim()
    if (!trimmed) return
    createGroup.mutate({ name: trimmed }, { onSuccess: () => setGroupName('') })
  }

  function handleCreateHabit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !group || !weight.trim()) return
    createHabit.mutate(
      {
        name: trimmedName,
        emoticon: emoticon.trim(),
        group,
        type,
        weight: weight.trim(),
        ...(type === 'numeric'
          ? {
              meta: meta === '' ? null : meta,
              bonus: bonus === '' ? null : bonus,
              unit: unit.trim(),
            }
          : {}),
      },
      {
        onSuccess: () => {
          setName('')
          setEmoticon('')
          setWeight('')
          setMeta('')
          setBonus('')
          setUnit('')
          setType('boolean')
        },
      },
    )
  }

  return (
    <Box>
      {/* Gerência de grupos (AC4) */}
      <Box
        component="form"
        onSubmit={handleCreateGroup}
        aria-label="Novo grupo de hábitos"
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', px: 1, py: 1, flexWrap: 'wrap' }}
      >
        <TextField
          label="Novo grupo"
          size="small"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
        />
        <Button type="submit" startIcon={<AddIcon />}>
          Criar grupo
        </Button>
        {createGroup.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 1 }} />

      <FormControlLabel
        sx={{ px: 1 }}
        control={
          <Switch
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
        }
        label="Mostrar inativos"
      />

      {/* Lista agrupada por grupo (AC4 / Fluxo 7) */}
      {!hasGroups ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, mb: 2 }}>
          Crie um grupo para começar a adicionar hábitos.
        </Typography>
      ) : (
        groups.map((g) => <GroupSection key={g.id} group={g} habits={habits} />)
      )}

      {/* Novo hábito (AC1 / Fluxo 7) — desabilitado sem grupo (grupo obrigatório) */}
      <Divider sx={{ my: 1 }} />
      <Box
        component="form"
        onSubmit={handleCreateHabit}
        aria-label="Novo hábito"
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', px: 1, py: 1, flexWrap: 'wrap' }}
      >
        <TextField
          label="Nome"
          size="small"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Emoticon"
          size="small"
          value={emoticon}
          onChange={(event) => setEmoticon(event.target.value)}
          sx={{ width: 96 }}
        />
        <Select
          size="small"
          displayEmpty
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          disabled={!hasGroups}
          inputProps={{ 'aria-label': 'Grupo' }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="" disabled>
            Selecione um grupo
          </MenuItem>
          {groups.map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name}
            </MenuItem>
          ))}
        </Select>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={type}
          onChange={(_, value) => value && setType(value as HabitType)}
          aria-label="Tipo do hábito"
        >
          {(Object.keys(HABIT_TYPE_LABEL) as HabitType[]).map((value) => (
            <ToggleButton key={value} value={value}>
              {HABIT_TYPE_LABEL[value]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          label="Peso inicial"
          type="number"
          size="small"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          sx={{ width: 120 }}
        />
        {/* Campos condicionais: só aparecem para numérico (Fluxo 7 passo 2) */}
        {type === 'numeric' && (
          <>
            <TextField
              label="Meta"
              type="number"
              size="small"
              value={meta}
              onChange={(event) => setMeta(event.target.value)}
              sx={{ width: 120 }}
            />
            <TextField
              label="Bonus"
              type="number"
              size="small"
              value={bonus}
              onChange={(event) => setBonus(event.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              sx={{ width: 120 }}
            />
            <TextField
              label="Unidade"
              size="small"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="passos, min…"
              sx={{ width: 120 }}
            />
          </>
        )}
        <Button type="submit" startIcon={<AddIcon />} disabled={!hasGroups}>
          Criar hábito
        </Button>
        {createHabit.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
