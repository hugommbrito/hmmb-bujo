import { useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import {
  useCreateHealthFieldMutation,
  useHealthFieldDefinitionsQuery,
  useUpdateHealthFieldMutation,
} from '../api'
import type { HealthFieldDefinition, HealthFieldType } from '../types'

// Constante única de erro de escrita (input preservado + retry). Voz UX-DR13:
// pt-BR neutro, zero gamificação.
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
const LOAD_ERROR = 'Não foi possível carregar os campos de saúde.'
const EMPTY_STATE = 'Nenhum campo de saúde ainda.'

// Rótulos pt-BR dos 5 tipos (UX-DR10). `Select` (não ToggleButtonGroup): 5 tipos
// ficariam apertados no mobile.
const FIELD_TYPE_LABEL: Record<HealthFieldType, string> = {
  integer: 'Inteiro',
  decimal: 'Decimal',
  boolean: 'Booleano',
  enum: 'Enum',
  text: 'Texto',
}

// Editor de opções do enum (net-new): lista repetível de inputs de texto com
// adicionar/remover. Controlado pelo pai (options + onChange).
interface EnumOptionsEditorProps {
  options: string[]
  onChange: (options: string[]) => void
  idPrefix: string
}

function EnumOptionsEditor({ options, onChange, idPrefix }: EnumOptionsEditorProps) {
  function handleChange(index: number, value: string) {
    onChange(options.map((option, i) => (i === index ? value : option)))
  }
  function handleAdd() {
    onChange([...options, ''])
  }
  function handleRemove(index: number) {
    onChange(options.filter((_, i) => i !== index))
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Opções (obrigatório ao menos uma)
      </Typography>
      {options.map((option, index) => (
        // A lista é editável em posição (sem reordenação); o índice é a única
        // identidade estável de cada slot.
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            label={`Opção ${index + 1}`}
            size="small"
            value={option}
            onChange={(event) => handleChange(index, event.target.value)}
            inputProps={{ 'aria-label': `${idPrefix} — opção ${index + 1}` }}
          />
          {options.length > 1 && (
            <IconButton
              size="small"
              aria-label={`Remover opção ${index + 1}`}
              onClick={() => handleRemove(index)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAdd}>
          Adicionar opção
        </Button>
      </Box>
    </Box>
  )
}

// Uma linha da lista: identidade do campo + edição inline de name (e, para enum,
// das opções) + toggle Desativar/Ativar. Cor nunca é indicador único (WCAG): a
// linha inativa some opacidade E ganha o rótulo textual "(inativo)".
interface HealthFieldRowProps {
  field: HealthFieldDefinition
}

function HealthFieldRow({ field }: HealthFieldRowProps) {
  const update = useUpdateHealthFieldMutation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(field.name)
  const [options, setOptions] = useState<string[]>(
    field.enumOptions.length > 0 ? field.enumOptions : [''],
  )
  const isEnum = field.fieldType === 'enum'

  function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) return
    update.mutate(
      {
        fieldId: field.id,
        name: trimmedName,
        ...(isEnum
          ? { enumOptions: options.map((option) => option.trim()).filter(Boolean) }
          : {}),
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  function handleToggleActive() {
    update.mutate({ fieldId: field.id, active: !field.active })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1,
        py: 1,
        minHeight: 44,
        opacity: field.active ? 1 : 0.6,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {field.name}
          {!field.active && ' (inativo)'}
        </Typography>
        {editing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
            <TextField
              label="Nome"
              size="small"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ 'aria-label': `Nome de ${field.name}` }}
            />
            {isEnum && (
              <EnumOptionsEditor
                options={options}
                onChange={setOptions}
                idPrefix={field.name}
              />
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={handleSave}>
                Salvar
              </Button>
              <Button size="small" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {FIELD_TYPE_LABEL[field.fieldType]}
            {isEnum && field.enumOptions.length > 0 && ` · ${field.enumOptions.join(', ')}`}
          </Typography>
        )}
        {update.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
      {!editing && (
        <Button size="small" onClick={() => setEditing(true)}>
          Editar
        </Button>
      )}
      <Button size="small" onClick={handleToggleActive}>
        {field.active ? 'Desativar' : 'Ativar'}
      </Button>
    </Box>
  )
}

export function HealthMetricsManager() {
  const [showInactive, setShowInactive] = useState(false)
  const query = useHealthFieldDefinitionsQuery({ includeInactive: showInactive })
  const createField = useCreateHealthFieldMutation()

  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState<HealthFieldType>('integer')
  const [options, setOptions] = useState<string[]>([''])

  const fields = query.data ?? []
  const isEnum = fieldType === 'enum'

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    const cleanedOptions = options.map((option) => option.trim()).filter(Boolean)
    createField.mutate(
      {
        name: trimmedName,
        fieldType,
        ...(isEnum ? { enumOptions: cleanedOptions } : {}),
      },
      {
        onSuccess: () => {
          setName('')
          setFieldType('integer')
          setOptions([''])
        },
      },
    )
  }

  return (
    <Box>
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

      {/* Lista de campos ordenada por displayOrder (o backend já ordena) */}
      {query.isLoading ? (
        <Box sx={{ px: 1 }} aria-hidden="true">
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </Box>
      ) : query.isError ? (
        <Box sx={{ px: 1, py: 1 }}>
          <Alert
            severity="error"
            role="alert"
            action={
              <Button color="inherit" size="small" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            }
          >
            {LOAD_ERROR}
          </Alert>
        </Box>
      ) : fields.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, mb: 2 }}>
          {EMPTY_STATE}
        </Typography>
      ) : (
        fields.map((field) => <HealthFieldRow key={field.id} field={field} />)
      )}

      <Divider sx={{ my: 1 }} />

      {/* Novo campo (AC1/AC3) — seletor de tipo + editor de opções condicional */}
      <Box
        component="form"
        onSubmit={handleCreate}
        aria-label="Novo campo de saúde"
        sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1, py: 1 }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            label="Nome"
            size="small"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Select
            size="small"
            value={fieldType}
            onChange={(event) => setFieldType(event.target.value as HealthFieldType)}
            inputProps={{ 'aria-label': 'Tipo do campo' }}
            sx={{ minWidth: 140 }}
          >
            {(Object.keys(FIELD_TYPE_LABEL) as HealthFieldType[]).map((value) => (
              <MenuItem key={value} value={value}>
                {FIELD_TYPE_LABEL[value]}
              </MenuItem>
            ))}
          </Select>
        </Box>
        {/* Editor de opções condicional: aparece só quando o tipo é enum */}
        {isEnum && (
          <EnumOptionsEditor options={options} onChange={setOptions} idPrefix="Novo campo" />
        )}
        <Box>
          <Button type="submit" startIcon={<AddIcon />}>
            Criar campo
          </Button>
        </Box>
        {createField.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
