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
  useHabitGroupsQuery,
  useHabitsQuery,
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
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(habit.weight)
  const [meta, setMeta] = useState(habit.meta ?? '')
  const [bonus, setBonus] = useState(habit.bonus ?? '')
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
          ? { meta: meta === '' ? null : meta, bonus: bonus === '' ? null : bonus }
          : {}),
      },
      {
        onSuccess: () => {
          setName('')
          setEmoticon('')
          setWeight('')
          setMeta('')
          setBonus('')
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
