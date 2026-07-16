import { useState } from 'react'
import {
  Box,
  Button,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useCreateSubtaskMutation, useDeleteTaskMutation, useUpdateTaskMutation } from '../api'
import { AddTaskRow } from './AddTaskRow'
import { TaskDestinationDialog } from './TaskDestinationDialog'
import type { Task, TaskCategory, TaskEisenhower } from '../types'

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  teal: 'Teal',
  purple: 'Purple',
  pink: 'Pink',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
}

const EISENHOWER_LABEL: Record<TaskEisenhower, string> = {
  ui: 'Urgente + Importante',
  u: 'Urgente',
  i: 'Importante',
  none: 'Nenhum',
}

interface TaskDetailPanelProps {
  task: Task | undefined
  isSubtask: boolean
  onClose: () => void
}

export function TaskDetailPanel({ task, isSubtask, onClose }: TaskDetailPanelProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const updateTask = useUpdateTaskMutation()
  const createSubtask = useCreateSubtaskMutation()
  const deleteTask = useDeleteTaskMutation()

  // Rascunho local dos 4 campos editáveis (Story 11.7). Título/descrição já
  // eram estado local; categoria/eisenhower passam a ser rascunho também para
  // que "Salvar" persista tudo num único PATCH e "Fechar" descarte sem
  // persistir (AC2). O `key={openTaskId}` nas páginas remonta o painel por
  // tarefa, então o rascunho reinicializa a cada abertura sem `useEffect`.
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [category, setCategory] = useState<TaskCategory | ''>(task?.category ?? '')
  const [eisenhower, setEisenhower] = useState<TaskEisenhower | ''>(task?.eisenhower ?? '')
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false)

  if (!task) return null

  const hasLineage = (task.migrationCount ?? 0) > 0 || Boolean(task.migratedToTask)
  const willHardDelete = task.status === 'pending' && !hasLineage

  // Caminho explícito de salvar (AC1/AC2): um único PATCH com os 4 campos,
  // espelhando RecurringTemplateManager.TemplateRow.handleSave. Só o sucesso
  // fecha o painel (onSuccess: onClose) — fechar por X/Esc/backdrop descarta o
  // rascunho sem persistir (lição da 11.6: separar sucesso de fechar/cancelar).
  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) return
    updateTask.mutate(
      {
        taskId: task.id,
        title: trimmed,
        description: description || null,
        eisenhower: eisenhower || null,
        category: category || null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: isMobile ? '100%' : 400,
            maxHeight: isMobile ? '80vh' : '100%',
            p: 3,
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="heading">Detalhe da tarefa</Typography>
        <IconButton aria-label="Fechar" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Título"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
        />
        <TextField
          label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          multiline
          minRows={3}
          fullWidth
        />
        <Select
          displayEmpty
          value={category}
          onChange={(event) => setCategory(event.target.value as TaskCategory | '')}
          inputProps={{ 'aria-label': 'Categoria' }}
        >
          <MenuItem value="">Nenhuma</MenuItem>
          {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((category) => (
            <MenuItem key={category} value={category}>
              {CATEGORY_LABEL[category]}
            </MenuItem>
          ))}
        </Select>
        <Select
          displayEmpty
          value={eisenhower}
          onChange={(event) => setEisenhower(event.target.value as TaskEisenhower | '')}
          inputProps={{ 'aria-label': 'Eisenhower' }}
        >
          <MenuItem value="">Nenhum</MenuItem>
          {/* `none` já é coberto pelo item em branco acima (mesmo rótulo
              "Nenhum") — mapeá-lo também aqui duplicaria a opção no dropdown
              com dois valores distintos ("" → null vs "none") por trás do
              mesmo texto, que é exatamente como `TaskRow.eisenhowerChipInfo`
              já trata os dois como equivalentes (nenhum chip exibido). */}
          {(Object.keys(EISENHOWER_LABEL) as TaskEisenhower[])
            .filter((eisenhower) => eisenhower !== 'none')
            .map((eisenhower) => (
              <MenuItem key={eisenhower} value={eisenhower}>
                {EISENHOWER_LABEL[eisenhower]}
              </MenuItem>
            ))}
        </Select>

        <Box>
          <Typography variant="label" color="text.secondary">
            Subtarefas
          </Typography>
          {(task.subtasks ?? []).map((subtask) => (
            <Typography key={subtask.id} variant="body2" sx={{ py: 0.5 }}>
              {subtask.title}
            </Typography>
          ))}
          {/* Adicionar sub-subtarefas é fora de escopo desta story (Dev Notes —
              "Profundidade da árvore"): o input só aparece para tarefas raiz. */}
          {!isSubtask && (
            <AddTaskRow
              label="Nova subtarefa"
              placeholder="Nova subtarefa"
              onAdd={(subtaskTitle) =>
                createSubtask.mutate({ parentTaskId: task.id, title: subtaskTitle })
              }
            />
          )}
        </Box>

        {/* "Salvar" é a ação primária e aparece também para subtarefas (editar
            campos de subtarefa é válido) — diferente de "Mover"/"Excluir", que
            ficam fora para subtarefa. Desabilitado enquanto o título estiver
            vazio/whitespace (guard de obrigatório, equivalente ao antigo revert
            do onBlur). */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={handleSave} disabled={!title.trim()}>
            Salvar
          </Button>
        </Box>
        {!isSubtask && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => setDestinationDialogOpen(true)}
              disabled={task.status !== 'pending' && task.status !== 'started'}
            >
              Mover tarefa
            </Button>
            <Button
              color="error"
              onClick={() => deleteTask.mutate({ taskId: task.id }, { onSuccess: onClose })}
            >
              {willHardDelete ? 'Excluir tarefa' : 'Cancelar tarefa'}
            </Button>
          </Box>
        )}
        {!isSubtask && (
          <TaskDestinationDialog
            task={task}
            open={destinationDialogOpen}
            onClose={() => setDestinationDialogOpen(false)}
            onSuccess={onClose}
          />
        )}
      </Box>
    </Drawer>
  )
}
