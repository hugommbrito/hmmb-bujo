import { useRef, useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  SwipeableDrawer,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useCreateBrainDumpItemMutation } from '../api'
import { TARGET_LOG_OPTIONS } from './BrainDumpCaptureForm'
import type { BrainDumpTargetLog } from '../types'

interface BrainDumpCaptureSheetProps {
  open: boolean
  onClose: () => void
}

export function BrainDumpCaptureSheet({ open, onClose }: BrainDumpCaptureSheetProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetLog, setTargetLog] = useState<BrainDumpTargetLog | ''>('')
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const createItem = useCreateBrainDumpItemMutation()

  function resetFields() {
    setTitle('')
    setDescription('')
    setTargetLog('')
    createItem.reset()
  }

  // Único ponto de fechamento sem salvar — SwipeableDrawer chama isto em
  // swipe-down, Esc E backdrop click (mesmo handler de onClose do Modal
  // subjacente); AC #2 só cita swipe-down/Esc, mas não há motivo para o
  // backdrop se comportar diferente (mesma UX de modal em todo o app).
  function requestClose() {
    if (title.trim()) {
      setConfirmDiscardOpen(true)
      return
    }
    resetFields()
    onClose()
  }

  function confirmDiscard() {
    setConfirmDiscardOpen(false)
    resetFields()
    onClose()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    // O botão Salvar já fica `disabled` durante o envio, mas o Enter no Título
    // (AC #1) contorna o botão — sem este guard, dois Enter rápidos disparariam
    // duas mutações e criariam itens duplicados (mesma condição do `disabled`).
    if (!trimmedTitle || createItem.isPending) return
    createItem.mutate(
      { title: trimmedTitle, description: description.trim() || undefined, targetLog: targetLog || undefined },
      {
        onSuccess: () => {
          resetFields()
          onClose()
        },
      },
    )
  }

  return (
    <>
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onOpen={() => {}}
        onClose={requestClose}
        disableSwipeToOpen
        slotProps={{
          paper: { sx: { maxHeight: '80vh', borderTopLeftRadius: 8, borderTopRightRadius: 8 } },
          // AC #1: título em foco ao abrir. Focar via ref no fim da transição
          // (onEntered) é o único jeito confiável dentro de um SwipeableDrawer —
          // o `autoFocus` nativo do TextField é sobrescrito pelo FocusTrap do
          // Modal durante a animação de entrada (confirmado no e2e real).
          transition: { onEntered: () => titleRef.current?.focus() },
        }}
      >
        <Box
          role="dialog"
          aria-modal="true"
          aria-label="Captura rápida"
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3 }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="heading">Captura rápida</Typography>
            <IconButton aria-label="Fechar" onClick={requestClose} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <TextField
            inputRef={titleRef}
            label="Título"
            // Foco inicial do AC #1 tem dois mecanismos complementares: o
            // `autoFocus` cobre a montagem imediata (e é o que jsdom exercita no
            // teste unitário), e o `onEntered` acima refoca ao fim da transição —
            // necessário porque o FocusTrap do Modal rouba o foco do autoFocus
            // durante a animação no browser real (provado no e2e).
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
          />
          <TextField
            label="Descrição"
            multiline
            minRows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
          />
          <Select
            displayEmpty
            value={targetLog}
            onChange={(event) => setTargetLog(event.target.value as BrainDumpTargetLog | '')}
            inputProps={{ 'aria-label': 'Destino' }}
          >
            {TARGET_LOG_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>

          {createItem.isError && (
            <Typography color="error" variant="body-sm">
              Não foi possível salvar. Tente novamente.
            </Typography>
          )}

          <Button type="submit" variant="contained" disabled={!title.trim() || createItem.isPending}>
            Salvar
          </Button>
          <Typography variant="body-sm" component="div" color="text.secondary" sx={{ textAlign: 'center' }}>
            Salvo no Brain Dump até você processar.
          </Typography>
        </Box>
      </SwipeableDrawer>

      <Dialog open={confirmDiscardOpen} onClose={() => setConfirmDiscardOpen(false)}>
        <DialogTitle>Descartar item?</DialogTitle>
        <Typography sx={{ px: 3, pb: 1 }} variant="body2" color="text.secondary">
          O título preenchido será perdido.
        </Typography>
        <DialogActions>
          <Button onClick={() => setConfirmDiscardOpen(false)}>Continuar editando</Button>
          <Button color="error" onClick={confirmDiscard}>
            Descartar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
