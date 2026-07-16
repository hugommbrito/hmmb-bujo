import { useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
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
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2">{template.title}</Typography>
            <Typography variant="body-sm" color="text.secondary">
              {RECURRENCE_GROUP_LABEL[template.recurrenceGroup]} — {template.recurrenceText}
              {!template.active && ' (inativo)'}
            </Typography>
            {/* AC1/AC2: descrição truncada em 1 linha, só quando há conteúdo.
                `component="div"`: sem ela, `body-sm` (variante custom) cai no
                fallback <span> e a descrição colaria na mesma linha da subline
                de recorrência, sem ellipsis. */}
            {template.description && (
              <Typography variant="body-sm" color="text.secondary" component="div" noWrap>
                {template.description}
              </Typography>
            )}
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

// Gestão de templates recorrentes — agora vive dentro do Planner (Story 11.2).
// Templates são segmentados em abas por grupo (Semanal/Mensal/Anual) e um
// filtro "mostrar inativos" inclui/exclui `active=false` (padrão: só ativos).
export function RecurringTemplateManager() {
  const templates = useRecurringTemplatesQuery()
  const createTemplate = useCreateRecurringTemplateMutation()
  const [group, setGroup] = useState<RecurrenceGroup>('weekly')
  const [showInactive, setShowInactive] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eisenhower, setEisenhower] = useState<TaskEisenhower | ''>('')
  const [recurrenceText, setRecurrenceText] = useState('')
  const [active, setActive] = useState(true)

  // Filtragem client-side (não por query param): um único fetch de tudo +
  // `.filter()` por grupo/`showInactive`. Espelha a decisão da Story 4.5
  // (RecurringPlacementSection) e mantém troca de aba instantânea, sem novo
  // estado de loading; a query key sem params é a que as mutations invalidam.
  const visibleTemplates = (templates.data ?? []).filter(
    (template) => template.recurrenceGroup === group && (showInactive || template.active),
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedText = recurrenceText.trim()
    if (!trimmedTitle || !trimmedText) return

    createTemplate.mutate({
      title: trimmedTitle,
      description: description.trim() || null,
      eisenhower: eisenhower || null,
      recurrenceGroup: group,
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
      <Tabs
        value={group}
        onChange={(_, value) => setGroup(value as RecurrenceGroup)}
        aria-label="Grupo de recorrência"
        sx={{ mb: 1 }}
      >
        {(Object.keys(RECURRENCE_GROUP_LABEL) as RecurrenceGroup[]).map((value) => (
          <Tab key={value} value={value} label={RECURRENCE_GROUP_LABEL[value]} />
        ))}
      </Tabs>

      <Box role="tabpanel" aria-label={RECURRENCE_GROUP_LABEL[group]}>
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

        {visibleTemplates.length === 0 ? (
          templates.isPending ? null : (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1, mb: 2 }}>
              Nenhum template neste grupo.
            </Typography>
          )
        ) : (
          <Box sx={{ mb: 2 }}>
            {visibleTemplates.map((template) => (
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
    </Box>
  )
}
