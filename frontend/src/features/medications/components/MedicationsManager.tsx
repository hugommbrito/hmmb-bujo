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
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import {
  useAddSubstanceVersionMutation,
  useCreateDoctorMutation,
  useCreateMedicationMutation,
  useCreateTimeBlockMutation,
  useDoctorsQuery,
  useMedicationsQuery,
  useSetMedicationActiveMutation,
  useSetScheduleMutation,
  useTimeBlocksQuery,
  useUpdateDoctorMutation,
  useUpdateMedicationTitleMutation,
  useUpdateTimeBlockMutation,
} from '../api'
import type { Doctor, DoseComponent, Medication, TimeBlock } from '../types'

// Constantes de voz (UX-DR13: pt-BR neutro, zero gamificação). String prospectiva
// EXATA da AC7 / Fluxo (não alterar — verificada em teste/E2E).
const PROSPECTIVE_TOOLTIP =
  'Alteração válida a partir de hoje. Registros anteriores preservados.'
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
const LOAD_ERROR = 'Não foi possível carregar os medicamentos.'
const EMPTY_STATE = 'Nenhum medicamento ainda.'

// Linha editável (string) da dose; convertida para {label, amount:number, unit} no submit.
interface DoseRow {
  label: string
  amount: string
  unit: string
}

function doseToRows(dose: DoseComponent[]): DoseRow[] {
  if (dose.length === 0) return [{ label: '', amount: '', unit: '' }]
  return dose.map((c) => ({
    label: c.label ?? '',
    amount: c.amount != null ? String(c.amount) : '',
    unit: c.unit ?? '',
  }))
}

function rowsToDose(rows: DoseRow[]): DoseComponent[] {
  // Um componente de dose só faz sentido com uma quantidade: exigir `amount`
  // preenchido evita que uma linha com só a unidade vire um `{amount: 0}` fantasma
  // (Number('') === 0). Linha com quantidade mas sem unidade é mantida de propósito —
  // o backend rejeita `unit` vazia com feedback (AC3, validação no serviço).
  return rows
    .filter((r) => r.amount.trim() !== '')
    .map((r) => ({ label: r.label.trim(), amount: Number(r.amount), unit: r.unit.trim() }))
}

function doseSummary(dose: DoseComponent[]): string {
  return dose
    .map((c) => `${c.amount ?? ''} ${c.unit ?? ''}${c.label ? ` (${c.label})` : ''}`.trim())
    .join(' + ')
}

// Editor de dose multi-componente (net-new): lista repetível de {label, amount, unit}
// com adicionar/remover. Reusa o idioma do EnumOptionsEditor (health). Controlado pelo pai.
interface DoseEditorProps {
  rows: DoseRow[]
  onChange: (rows: DoseRow[]) => void
  idPrefix: string
}

function DoseEditor({ rows, onChange, idPrefix }: DoseEditorProps) {
  function update(index: number, patch: Partial<DoseRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  function add() {
    onChange([...rows, { label: '', amount: '', unit: '' }])
  }
  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Dose (ao menos um componente)
      </Typography>
      {rows.map((row, index) => (
        // Editável em posição (sem reordenação); o índice é a identidade do slot.
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Rótulo"
            size="small"
            value={row.label}
            onChange={(event) => update(index, { label: event.target.value })}
            inputProps={{ 'aria-label': `${idPrefix} — rótulo do componente ${index + 1}` }}
            sx={{ width: 130 }}
          />
          <TextField
            label="Quantidade"
            type="number"
            size="small"
            value={row.amount}
            onChange={(event) => update(index, { amount: event.target.value })}
            inputProps={{ 'aria-label': `${idPrefix} — quantidade do componente ${index + 1}` }}
            sx={{ width: 120 }}
          />
          <TextField
            label="Unidade"
            size="small"
            value={row.unit}
            onChange={(event) => update(index, { unit: event.target.value })}
            inputProps={{ 'aria-label': `${idPrefix} — unidade do componente ${index + 1}` }}
            sx={{ width: 110 }}
          />
          {rows.length > 1 && (
            <IconButton
              size="small"
              aria-label={`Remover componente ${index + 1}`}
              onClick={() => remove(index)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={add}>
          Adicionar componente
        </Button>
      </Box>
    </Box>
  )
}

// Seletor de médico reutilizável (Select das opções existentes + "Sem médico").
interface DoctorSelectProps {
  doctors: Doctor[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

function DoctorSelect({ doctors, value, onChange, ariaLabel }: DoctorSelectProps) {
  return (
    <Select
      size="small"
      displayEmpty
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ 'aria-label': ariaLabel }}
      sx={{ minWidth: 160 }}
    >
      <MenuItem value="">Sem médico</MenuItem>
      {doctors.map((doctor) => (
        <MenuItem key={doctor.id} value={doctor.id}>
          {doctor.name}
        </MenuItem>
      ))}
    </Select>
  )
}

// --- Uma linha da lista de medicamentos (Item Row + edição inline) -------------
interface MedicationRowProps {
  medication: Medication
  doctors: Doctor[]
  blocks: TimeBlock[]
}

function MedicationRow({ medication, doctors, blocks }: MedicationRowProps) {
  const updateTitle = useUpdateMedicationTitleMutation()
  const addSubstance = useAddSubstanceVersionMutation()
  const setSchedule = useSetScheduleMutation()
  const setMedActive = useSetMedicationActiveMutation()

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(medication.title)
  const [substanceName, setSubstanceName] = useState(
    medication.substance?.substanceName ?? '',
  )
  const [laboratory, setLaboratory] = useState(medication.substance?.laboratory ?? '')
  const [doctorId, setDoctorId] = useState(medication.substance?.prescribedBy ?? '')

  // Editor de agenda por bloco (dose): bloco selecionado + linhas de dose.
  const [scheduleBlockId, setScheduleBlockId] = useState('')
  const [doseRows, setDoseRows] = useState<DoseRow[]>([{ label: '', amount: '', unit: '' }])

  const schedules = medication.schedules
  const activeBlockIds = schedules.filter((s) => s.active).map((s) => s.timeBlock)
  const inactiveBlockIds = schedules.filter((s) => !s.active).map((s) => s.timeBlock)

  function handleSaveIdentity() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    if (trimmedTitle !== medication.title) {
      updateTitle.mutate({ medicationId: medication.id, title: trimmedTitle })
    }
    // Substância = nova versão prospectiva (eixo independente); só se algo mudou.
    const trimmedSubstance = substanceName.trim()
    const changedSubstance =
      trimmedSubstance !== (medication.substance?.substanceName ?? '') ||
      laboratory.trim() !== (medication.substance?.laboratory ?? '') ||
      doctorId !== (medication.substance?.prescribedBy ?? '')
    if (changedSubstance && trimmedSubstance) {
      addSubstance.mutate(
        {
          medicationId: medication.id,
          substanceName: trimmedSubstance,
          laboratory: laboratory.trim() === '' ? null : laboratory.trim(),
          prescribedById: doctorId === '' ? null : doctorId,
        },
        { onSuccess: () => setEditing(false) },
      )
    } else {
      setEditing(false)
    }
  }

  function handleSaveDose() {
    if (!scheduleBlockId) return
    const dose = rowsToDose(doseRows)
    setSchedule.mutate(
      { medicationId: medication.id, timeBlockId: scheduleBlockId, dose },
      {
        onSuccess: () => {
          setScheduleBlockId('')
          setDoseRows([{ label: '', amount: '', unit: '' }])
        },
      },
    )
  }

  function handleToggleScheduleActive(timeBlockId: string, active: boolean) {
    setSchedule.mutate({ medicationId: medication.id, timeBlockId, active })
  }

  function handleToggleMedActive() {
    if (medication.active) {
      setMedActive.mutate({
        medicationId: medication.id,
        timeBlockIds: activeBlockIds,
        active: false,
      })
    } else {
      setMedActive.mutate({
        medicationId: medication.id,
        timeBlockIds: inactiveBlockIds,
        active: true,
      })
    }
  }

  const substanceLine = medication.substance
    ? [
        medication.substance.substanceName,
        medication.substance.laboratory,
        doctors.find((d) => d.id === medication.substance?.prescribedBy)?.name,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Sem substância definida'

  const isError =
    updateTitle.isError ||
    addSubstance.isError ||
    setSchedule.isError ||
    setMedActive.isError

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        px: 1,
        py: 1,
        minHeight: 44,
        opacity: medication.active ? 1 : 0.6,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2">
            {medication.title}
            {!medication.active && ' (inativo)'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {substanceLine}
          </Typography>
        </Box>
        {!editing && (
          <Button size="small" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
        {schedules.length > 0 && (
          <Button
            size="small"
            onClick={handleToggleMedActive}
            aria-label={`${medication.active ? 'Desativar' : 'Ativar'} medicamento ${medication.title}`}
          >
            {medication.active ? 'Desativar' : 'Ativar'}
          </Button>
        )}
      </Box>

      {/* Agendas vigentes por bloco (dose + toggle por bloco) */}
      {schedules.map((schedule) => (
        <Box
          key={schedule.id}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, minHeight: 44 }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
            {schedule.timeBlockName}: {doseSummary(schedule.dose)}
            {!schedule.active && ' (inativo)'}
          </Typography>
          <Button
            size="small"
            onClick={() => handleToggleScheduleActive(schedule.timeBlock, !schedule.active)}
            aria-label={`${schedule.active ? 'Desativar' : 'Ativar'} agenda ${schedule.timeBlockName}`}
          >
            {schedule.active ? 'Desativar' : 'Ativar'}
          </Button>
        </Box>
      ))}

      {/* Painel de edição de identidade + substância (eixo substância, prospectivo) */}
      {editing && (
        <Box
          component="form"
          aria-label={`Editar ${medication.title}`}
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            handleSaveIdentity()
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 2, mt: 0.5 }}
        >
          <TextField
            label="Título"
            size="small"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            inputProps={{ 'aria-label': `Título de ${medication.title}` }}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Tooltip title={PROSPECTIVE_TOOLTIP}>
              <TextField
                label="Substância"
                size="small"
                value={substanceName}
                onChange={(event) => setSubstanceName(event.target.value)}
                inputProps={{ 'aria-label': `Substância de ${medication.title}` }}
              />
            </Tooltip>
            <TextField
              label="Laboratório"
              size="small"
              value={laboratory}
              onChange={(event) => setLaboratory(event.target.value)}
              inputProps={{ 'aria-label': `Laboratório de ${medication.title}` }}
            />
            <DoctorSelect
              doctors={doctors}
              value={doctorId}
              onChange={setDoctorId}
              ariaLabel={`Médico de ${medication.title}`}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" type="submit">
              Salvar
            </Button>
            <Button size="small" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </Box>
        </Box>
      )}

      {/* Definir/alterar a dose de um bloco (eixo agenda, prospectivo) */}
      {editing && (
        <Box
          component="form"
          aria-label={`Definir dose de ${medication.title}`}
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            handleSaveDose()
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 2, mt: 0.5 }}
        >
          <Select
            size="small"
            displayEmpty
            value={scheduleBlockId}
            onChange={(event) => {
              const blockId = event.target.value
              setScheduleBlockId(blockId)
              const existing = schedules.find((s) => s.timeBlock === blockId)
              setDoseRows(existing ? doseToRows(existing.dose) : [{ label: '', amount: '', unit: '' }])
            }}
            inputProps={{ 'aria-label': `Bloco da dose de ${medication.title}` }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="" disabled>
              Selecione um bloco
            </MenuItem>
            {blocks.map((block) => (
              <MenuItem key={block.id} value={block.id}>
                {block.name}
              </MenuItem>
            ))}
          </Select>
          {scheduleBlockId !== '' && (
            <Tooltip title={PROSPECTIVE_TOOLTIP}>
              <Box>
                <DoseEditor rows={doseRows} onChange={setDoseRows} idPrefix={medication.title} />
              </Box>
            </Tooltip>
          )}
          <Box>
            <Button size="small" type="submit" startIcon={<AddIcon />} disabled={!scheduleBlockId}>
              Salvar dose
            </Button>
          </Box>
        </Box>
      )}

      {isError && (
        <Typography variant="caption" color="error" role="alert" sx={{ pl: 2 }}>
          {SAVE_ERROR}
        </Typography>
      )}
    </Box>
  )
}

// --- Sub-gerenciador de blocos de horário (AC2) --------------------------------
function TimeBlocksSubManager() {
  const [showInactive, setShowInactive] = useState(false)
  const query = useTimeBlocksQuery({ includeInactive: showInactive })
  const create = useCreateTimeBlockMutation()
  const update = useUpdateTimeBlockMutation()
  const [name, setName] = useState('')
  const blocks = query.data ?? []

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    create.mutate({ name: trimmed }, { onSuccess: () => setName('') })
  }

  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ px: 1, py: 0.5 }}>
        Blocos de horário
      </Typography>
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
      {blocks.map((block) => (
        <Box
          key={block.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            minHeight: 44,
            opacity: block.active ? 1 : 0.6,
          }}
        >
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
            {block.name}
            {!block.active && ' (inativo)'}
          </Typography>
          <Button
            size="small"
            onClick={() =>
              update.mutate({ timeBlockId: block.id, active: !block.active })
            }
            aria-label={`${block.active ? 'Desativar' : 'Ativar'} bloco ${block.name}`}
          >
            {block.active ? 'Desativar' : 'Ativar'}
          </Button>
        </Box>
      ))}
      <Box
        component="form"
        onSubmit={handleCreate}
        aria-label="Novo bloco de horário"
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', px: 1, py: 1, flexWrap: 'wrap' }}
      >
        <TextField
          label="Novo bloco"
          size="small"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" startIcon={<AddIcon />}>
          Criar bloco
        </Button>
        {create.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// --- Sub-gerenciador de médicos (AC6) ------------------------------------------
function DoctorsSubManager() {
  const query = useDoctorsQuery()
  const create = useCreateDoctorMutation()
  const update = useUpdateDoctorMutation()
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const doctors = query.data ?? []

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    create.mutate(
      { name: trimmed, specialty: specialty.trim() === '' ? null : specialty.trim() },
      {
        onSuccess: () => {
          setName('')
          setSpecialty('')
        },
      },
    )
  }

  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ px: 1, py: 0.5 }}>
        Médicos
      </Typography>
      {doctors.map((doctor) => (
        <DoctorRow key={doctor.id} doctor={doctor} update={update} />
      ))}
      <Box
        component="form"
        onSubmit={handleCreate}
        aria-label="Novo médico"
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', px: 1, py: 1, flexWrap: 'wrap' }}
      >
        <TextField
          label="Nome do médico"
          size="small"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Especialidade"
          size="small"
          value={specialty}
          onChange={(event) => setSpecialty(event.target.value)}
        />
        <Button type="submit" startIcon={<AddIcon />}>
          Criar médico
        </Button>
        {create.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

interface DoctorRowProps {
  doctor: Doctor
  update: ReturnType<typeof useUpdateDoctorMutation>
}

function DoctorRow({ doctor, update }: DoctorRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(doctor.name)
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '')

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    update.mutate(
      {
        doctorId: doctor.id,
        name: trimmed,
        specialty: specialty.trim() === '' ? null : specialty.trim(),
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, minHeight: 44 }}>
      {editing ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap', flex: 1 }}>
          <TextField
            label="Nome"
            size="small"
            value={name}
            onChange={(event) => setName(event.target.value)}
            inputProps={{ 'aria-label': `Nome de ${doctor.name}` }}
          />
          <TextField
            label="Especialidade"
            size="small"
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            inputProps={{ 'aria-label': `Especialidade de ${doctor.name}` }}
          />
          <Button size="small" onClick={handleSave}>
            Salvar
          </Button>
          <Button size="small" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </Box>
      ) : (
        <>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
            {doctor.name}
            {doctor.specialty ? ` · ${doctor.specialty}` : ''}
          </Typography>
          <Button size="small" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </>
      )}
    </Box>
  )
}

// --- Gerenciador principal -----------------------------------------------------
export function MedicationsManager() {
  const query = useMedicationsQuery()
  const doctorsQuery = useDoctorsQuery()
  const blocksQuery = useTimeBlocksQuery()
  const createMedication = useCreateMedicationMutation()
  const createDoctor = useCreateDoctorMutation()

  const [title, setTitle] = useState('')
  const [substanceName, setSubstanceName] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [doctorId, setDoctorId] = useState('')
  // Criar médico inline a partir do form de medicamento (AC6).
  const [newDoctorName, setNewDoctorName] = useState('')

  const medications = query.data ?? []
  const doctors = doctorsQuery.data ?? []
  const blocks = blocksQuery.data ?? []

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedSubstance = substanceName.trim()
    if (!trimmedTitle || !trimmedSubstance) return
    createMedication.mutate(
      {
        title: trimmedTitle,
        substanceName: trimmedSubstance,
        laboratory: laboratory.trim() === '' ? null : laboratory.trim(),
        prescribedById: doctorId === '' ? null : doctorId,
      },
      {
        onSuccess: () => {
          setTitle('')
          setSubstanceName('')
          setLaboratory('')
          setDoctorId('')
        },
      },
    )
  }

  function handleCreateDoctorInline() {
    const trimmed = newDoctorName.trim()
    if (!trimmed) return
    // Auto-seleciona o médico recém-criado no Select (AC6: criar a partir da tela e
    // reutilizar) — evita o passo manual extra de reabrir o Select após o refetch.
    createDoctor.mutate(
      { name: trimmed },
      {
        onSuccess: (doctor) => {
          setNewDoctorName('')
          setDoctorId(doctor.id)
        },
      },
    )
  }

  return (
    <Box>
      {/* Lista de medicamentos ordenada por título (o backend já ordena) */}
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
      ) : medications.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, mb: 2 }}>
          {EMPTY_STATE}
        </Typography>
      ) : (
        medications.map((medication) => (
          <MedicationRow
            key={medication.id}
            medication={medication}
            doctors={doctors}
            blocks={blocks}
          />
        ))
      )}

      <Divider sx={{ my: 1 }} />

      {/* Novo medicamento (AC1) — slot + substância vigente + médico opcional */}
      <Box
        component="form"
        onSubmit={handleCreate}
        aria-label="Novo medicamento"
        sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1, py: 1 }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            label="Título"
            size="small"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Remédio de pressão"
          />
          <Tooltip title={PROSPECTIVE_TOOLTIP}>
            <TextField
              label="Substância"
              size="small"
              value={substanceName}
              onChange={(event) => setSubstanceName(event.target.value)}
            />
          </Tooltip>
          <TextField
            label="Laboratório"
            size="small"
            value={laboratory}
            onChange={(event) => setLaboratory(event.target.value)}
          />
          <DoctorSelect
            doctors={doctors}
            value={doctorId}
            onChange={setDoctorId}
            ariaLabel="Médico do medicamento"
          />
        </Box>
        {/* Criar médico inline (AC6): fica disponível no Select após o refetch. */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            label="Novo médico"
            size="small"
            value={newDoctorName}
            onChange={(event) => setNewDoctorName(event.target.value)}
            inputProps={{ 'aria-label': 'Novo médico (inline)' }}
          />
          <Button size="small" onClick={handleCreateDoctorInline}>
            Criar médico
          </Button>
        </Box>
        <Box>
          <Button type="submit" startIcon={<AddIcon />}>
            Criar medicamento
          </Button>
        </Box>
        {createMedication.isError && (
          <Typography variant="caption" color="error" role="alert">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 1 }} />
      <TimeBlocksSubManager />
      <Divider sx={{ my: 1 }} />
      <DoctorsSubManager />
    </Box>
  )
}
