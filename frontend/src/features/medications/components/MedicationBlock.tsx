import { useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import AdjustIcon from '@mui/icons-material/Adjust'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import {
  useConfirmBlockMutation,
  useConfirmMedicationEntryMutation,
  useEditEntryDoseMutation,
} from '../api'
import {
  deriveBlockStatus,
  deriveEntryStatus,
  doseSummary,
  type BlockStatus,
  type EntryStatus,
} from '../dayModel'
import type { DoseComponent, MedicationDayBlock, MedicationDayEntry } from '../types'

// Voz neutra pt-BR (UX-DR13, zero gamificação). String de erro EXATA de 8.1.
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'

// Indicador de estado do BLOCO = texto + ícone (nunca só cor — WCAG 2.2 AA / UX-DR20).
const STATUS_LABEL: Record<BlockStatus, string> = {
  confirmed: 'Confirmado',
  partial: 'Parcial',
  pending: 'Pendente',
}

// Rótulo/ícone de estado da LINHA (Story 8.3, AC3). "Dose perdida" é sinal clínico
// NEUTRO: ícone discreto (não vermelho de alarme) + texto — cor nunca sozinha.
const ENTRY_STATUS: Record<EntryStatus, { label: string; color: 'success' | 'warning' | 'disabled' }> = {
  confirmed: { label: 'Confirmado', color: 'success' },
  missed: { label: 'Dose perdida', color: 'warning' },
  pending: { label: 'Pendente', color: 'disabled' },
}

function StatusIndicator({ status, isPast }: { status: BlockStatus; isPast?: boolean }) {
  // Relabel de EXIBIÇÃO (AC3): num dia passado, um bloco derivado `pending` (nenhuma
  // linha confirmada) é rotulado "Doses perdidas". `deriveBlockStatus` permanece
  // inalterado (alimenta o updater otimista) — só o rótulo/ícone mudam aqui.
  const missedBlock = isPast === true && status === 'pending'
  const Icon = missedBlock
    ? RemoveCircleOutlineIcon
    : status === 'confirmed'
      ? CheckCircleOutlineIcon
      : status === 'partial'
        ? AdjustIcon
        : RadioButtonUncheckedIcon
  const color = missedBlock
    ? 'warning'
    : status === 'confirmed'
      ? 'success'
      : status === 'partial'
        ? 'warning'
        : 'disabled'
  const label = missedBlock ? 'Doses perdidas' : STATUS_LABEL[status]
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Icon fontSize="small" color={color} aria-hidden />
      <Typography variant="caption" color="text.secondary" component="span">
        {label}
      </Typography>
    </Box>
  )
}

function EntryStatusIndicator({ status }: { status: EntryStatus }) {
  const { label, color } = ENTRY_STATUS[status]
  const Icon =
    status === 'confirmed'
      ? CheckCircleOutlineIcon
      : status === 'missed'
        ? RemoveCircleOutlineIcon
        : RadioButtonUncheckedIcon
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Icon fontSize="small" color={color} aria-hidden />
      <Typography variant="caption" color="text.secondary" component="span">
        {label}
      </Typography>
    </Box>
  )
}

// Editor inline de dose (Story 8.3, AC6) — lista repetível de componentes
// [{label, amount, unit}], reusando o idioma do `EnumOptionsEditor` de 8.1 (add/remove
// de linhas). Inline (expand na linha) em vez de Modal — mais simples e evita o bug de
// onClose/onSuccess (Épico 11). `amount` fica como string no input (jsdom) e vira
// Number no save.
interface DraftComponent {
  label: string
  amount: string
  unit: string
}

interface EntryDoseEditorProps {
  entry: MedicationDayEntry
  date?: string
  onClose: () => void
}

function EntryDoseEditor({ entry, date, onClose }: EntryDoseEditorProps) {
  const [components, setComponents] = useState<DraftComponent[]>(() =>
    entry.doseAtTime.length > 0
      ? entry.doseAtTime.map((c) => ({
          label: c.label ?? '',
          amount: c.amount != null ? String(c.amount) : '',
          unit: c.unit ?? '',
        }))
      : [{ label: '', amount: '', unit: '' }],
  )
  const editDose = useEditEntryDoseMutation(date)

  const canSave = components.every(
    (c) => c.amount.trim() !== '' && c.unit.trim() !== '',
  )

  function updateComponent(index: number, patch: Partial<DraftComponent>) {
    setComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    )
  }
  function addComponent() {
    setComponents((prev) => [...prev, { label: '', amount: '', unit: '' }])
  }
  function removeComponent(index: number) {
    setComponents((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    const dose: DoseComponent[] = components.map((c) => ({
      label: c.label.trim(),
      amount: Number(c.amount),
      unit: c.unit.trim(),
    }))
    editDose.mutate({ entryId: entry.id, dose }, { onSuccess: onClose })
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ pl: 4, pr: 1, pb: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography variant="caption" color="text.secondary" component="div">
        Corrigir a dose registrada de {entry.medicationTitle}
      </Typography>
      {components.map((component, index) => (
        // Lista editável em posição (índice = identidade estável do slot), molde
        // EnumOptionsEditor (8.1).
        <Box
          key={index}
          sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <TextField
            size="small"
            label="Rótulo"
            value={component.label}
            onChange={(e) => updateComponent(index, { label: e.target.value })}
            inputProps={{ 'aria-label': `Rótulo do componente ${index + 1}` }}
            sx={{ width: 140 }}
          />
          <TextField
            size="small"
            type="number"
            label="Quantidade"
            value={component.amount}
            onChange={(e) => updateComponent(index, { amount: e.target.value })}
            inputProps={{ 'aria-label': `Quantidade do componente ${index + 1}` }}
            sx={{ width: 120 }}
          />
          <TextField
            size="small"
            label="Unidade"
            value={component.unit}
            onChange={(e) => updateComponent(index, { unit: e.target.value })}
            inputProps={{ 'aria-label': `Unidade do componente ${index + 1}` }}
            sx={{ width: 120 }}
          />
          {components.length > 1 && (
            <IconButton
              size="small"
              aria-label={`Remover componente ${index + 1}`}
              onClick={() => removeComponent(index)}
              sx={{ minHeight: 44, minWidth: 44 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="small" startIcon={<AddIcon />} onClick={addComponent}>
          Adicionar componente
        </Button>
        <Button
          type="submit"
          size="small"
          variant="outlined"
          disabled={!canSave || editDose.isPending}
          sx={{ minHeight: 44 }}
        >
          Salvar dose
        </Button>
        <Button size="small" onClick={onClose} sx={{ minHeight: 44 }}>
          Cancelar
        </Button>
      </Box>
      {editDose.isError && (
        <Typography variant="caption" color="error" role="alert" component="div">
          {SAVE_ERROR}
        </Typography>
      )}
    </Box>
  )
}

interface EntryRowProps {
  entry: MedicationDayEntry
  date?: string
  // Story 8.3 (AC3): num dia passado, o estado da linha é temporal (missed vs. pending)
  // e o afordance "Corrigir dose" fica disponível (ação de revisão).
  isPast?: boolean
}

function EntryRow({ entry, date, isPast = false }: EntryRowProps) {
  const confirm = useConfirmMedicationEntryMutation(date)
  const [editingDose, setEditingDose] = useState(false)
  const checked = entry.confirmedAt != null
  const summary = doseSummary(entry.doseAtTime)
  const status = deriveEntryStatus(entry, isPast)
  return (
    <Box sx={{ px: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <FormControlLabel
          sx={{ minHeight: 44, m: 0, flexGrow: 1 }}
          control={
            <Checkbox
              checked={checked}
              onChange={() =>
                confirm.mutate({ entryId: entry.id, confirmed: !checked })
              }
            />
          }
          label={
            <Typography variant="body2">
              {entry.medicationTitle}
              {summary ? ` · ${summary}` : ''}
            </Typography>
          }
        />
        {/* Estado temporal da linha (texto + ícone) — só num dia passado, para não
            alterar a aba "Hoje" (que já comunica o estado pelo checkbox). */}
        {isPast && <EntryStatusIndicator status={status} />}
        {isPast && (
          <Button
            size="small"
            onClick={() => setEditingDose((v) => !v)}
            sx={{ minHeight: 44 }}
          >
            {editingDose ? 'Fechar' : 'Corrigir dose'}
          </Button>
        )}
      </Box>
      {confirm.isError && (
        <Typography
          variant="caption"
          color="error"
          role="alert"
          component="div"
          sx={{ pl: 4 }}
        >
          {SAVE_ERROR}
        </Typography>
      )}
      {editingDose && (
        <EntryDoseEditor
          entry={entry}
          date={date}
          onClose={() => setEditingDose(false)}
        />
      )}
    </Box>
  )
}

export interface MedicationBlockProps {
  block: MedicationDayBlock
  // Chave da query (param `?date=`, undefined = hoje) — usada pelos hooks otimistas.
  date?: string
  // Data concreta do dia (ISO) — enviada no payload da confirmação em lote.
  dayDate: string
  // Story 8.3 (AC3): dia passado → relabel "Doses perdidas" + estado temporal por linha
  // + afordance de correção de dose. Ausente/false = comportamento idêntico à aba "Hoje".
  isPast?: boolean
}

export function MedicationBlock({ block, date, dayDate, isPast = false }: MedicationBlockProps) {
  const confirmBlock = useConfirmBlockMutation(date)
  // Fonte única (AC6): deriva do estado das linhas (que já refletem o otimismo no
  // cache), para o cabeçalho reagir instantaneamente antes do refetch.
  const status = deriveBlockStatus(block.entries)
  const allConfirmed = status === 'confirmed'

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1,
          py: 0.5,
        }}
      >
        <Typography variant="subtitle2" component="h3">
          {block.timeBlockName}
        </Typography>
        <StatusIndicator status={status} isPast={isPast} />
      </Box>

      {block.entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} date={date} isPast={isPast} />
      ))}

      <Box sx={{ px: 1, pt: 0.5 }}>
        <Button
          size="small"
          onClick={() =>
            confirmBlock.mutate({
              date: dayDate,
              timeBlockId: block.timeBlockId,
              confirmed: true,
            })
          }
          disabled={allConfirmed || confirmBlock.isPending}
        >
          Confirmar todos — {block.timeBlockName}
        </Button>
        {confirmBlock.isError && (
          <Typography variant="caption" color="error" role="alert" component="div">
            {SAVE_ERROR}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
