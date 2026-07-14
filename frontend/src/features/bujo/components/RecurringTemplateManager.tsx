import { useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import {
  useCreateRecurringTemplateMutation,
  useRecurringTemplatesQuery,
  useUpdateRecurringTemplateMutation,
} from '../api'
import type { RecurrenceGroup, RecurringTaskTemplate, TaskEisenhower } from '../types'

const RECURRENCE_GROUP_LABEL: Record<RecurrenceGroup, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  annual: 'Anual',
}

const EISENHOWER_LABEL: Record<TaskEisenhower, string> = {
  ui: 'Urgente + Importante',
  u: 'Urgente',
  i: 'Importante',
  none: 'Nenhum',
}

interface TemplateRowProps {
  template: RecurringTaskTemplate
}

// Edição inline por linha — mesma leveza do toggle de `active` (sem modal de
// confirmação, PATCH direto), evitando um segundo componente/dialog só para isso.
function TemplateRow({ template }: TemplateRowProps) {
  const updateTemplate = useUpdateRecurringTemplateMutation()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(template.title)
  const [recurrenceText, setRecurrenceText] = useState(template.recurrenceText)

  function handleToggleActive() {
    updateTemplate.mutate({ templateId: template.id, active: !template.active })
  }

  function handleSave() {
    const trimmedTitle = title.trim()
    const trimmedText = recurrenceText.trim()
    if (!trimmedTitle || !trimmedText) return
    updateTemplate.mutate({
      templateId: template.id,
      title: trimmedTitle,
      recurrenceText: trimmedText,
    })
    setEditing(false)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 1,
        opacity: template.active ? 1 : 0.6,
      }}
    >
      {editing ? (
        <>
          <TextField
            label="Título"
            size="small"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextField
            label="Recorrência"
            size="small"
            value={recurrenceText}
            onChange={(event) => setRecurrenceText(event.target.value)}
          />
          <Button size="small" onClick={handleSave}>
            Salvar
          </Button>
        </>
      ) : (
        <>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2">{template.title}</Typography>
            <Typography variant="body-sm" color="text.secondary">
              {RECURRENCE_GROUP_LABEL[template.recurrenceGroup]} — {template.recurrenceText}
              {!template.active && ' (inativo)'}
            </Typography>
          </Box>
          <Button size="small" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </>
      )}
      <Button size="small" onClick={handleToggleActive}>
        {template.active ? 'Desativar' : 'Ativar'}
      </Button>
    </Box>
  )
}

// Único componente que `pages/settings` precisa importar (Task 11.2).
export function RecurringTemplateManager() {
  const templates = useRecurringTemplatesQuery()
  const createTemplate = useCreateRecurringTemplateMutation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eisenhower, setEisenhower] = useState<TaskEisenhower | ''>('')
  const [recurrenceGroup, setRecurrenceGroup] = useState<RecurrenceGroup>('weekly')
  const [recurrenceText, setRecurrenceText] = useState('')
  const [active, setActive] = useState(true)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedText = recurrenceText.trim()
    if (!trimmedTitle || !trimmedText) return

    createTemplate.mutate({
      title: trimmedTitle,
      description: description.trim() || null,
      eisenhower: eisenhower || null,
      recurrenceGroup,
      recurrenceText: trimmedText,
      active,
    })
    setTitle('')
    setDescription('')
    setEisenhower('')
    setRecurrenceText('')
    setActive(true)
  }

  return (
    <Box>
      <Typography variant="heading" sx={{ px: 1, mb: 1 }}>
        Recorrentes
      </Typography>

      {templates.data?.length === 0 || !templates.data ? (
        templates.isPending ? null : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, mb: 2 }}>
            Nenhum template cadastrado.
          </Typography>
        )
      ) : (
        <Box sx={{ mb: 2 }}>
          {templates.data.map((template) => (
            <TemplateRow key={template.id} template={template} />
          ))}
        </Box>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        aria-label="Novo template recorrente"
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', px: 1, py: 1 }}
      >
        <TextField
          label="Título"
          size="small"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          label="Descrição"
          size="small"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Select
          size="small"
          displayEmpty
          value={eisenhower}
          onChange={(event) => setEisenhower(event.target.value as TaskEisenhower | '')}
          inputProps={{ 'aria-label': 'Eisenhower' }}
        >
          <MenuItem value="">Nenhum</MenuItem>
          {(Object.keys(EISENHOWER_LABEL) as TaskEisenhower[])
            .filter((value) => value !== 'none')
            .map((value) => (
              <MenuItem key={value} value={value}>
                {EISENHOWER_LABEL[value]}
              </MenuItem>
            ))}
        </Select>
        <Select
          size="small"
          value={recurrenceGroup}
          onChange={(event) => setRecurrenceGroup(event.target.value as RecurrenceGroup)}
          inputProps={{ 'aria-label': 'Grupo de recorrência' }}
        >
          {(Object.keys(RECURRENCE_GROUP_LABEL) as RecurrenceGroup[]).map((group) => (
            <MenuItem key={group} value={group}>
              {RECURRENCE_GROUP_LABEL[group]}
            </MenuItem>
          ))}
        </Select>
        <TextField
          label="Recorrência (texto livre)"
          size="small"
          value={recurrenceText}
          onChange={(event) => setRecurrenceText(event.target.value)}
        />
        <FormControlLabel
          control={
            <Checkbox checked={active} onChange={(event) => setActive(event.target.checked)} />
          }
          label="Ativo"
        />
        <Button type="submit" startIcon={<AddIcon />}>
          Criar
        </Button>
      </Box>
    </Box>
  )
}
