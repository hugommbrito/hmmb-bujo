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

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')

  if (!task) return null

  const hasLineage = (task.migrationCount ?? 0) > 0 || Boolean(task.migratedToTask)
  const willHardDelete = task.status === 'pending' && !hasLineage

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
          onBlur={() => {
            const trimmed = title.trim()
            // Título é obrigatório (AC1) — esvaziar e sair do campo não pode
            // persistir um título vazio nem deixar o campo visualmente em
            // branco enquanto o painel segue aberto; reverte para o valor salvo.
            if (!trimmed) {
              setTitle(task.title)
              return
            }
            if (trimmed !== task.title) {
              updateTask.mutate({ taskId: task.id, title: trimmed })
            }
            setTitle(trimmed)
          }}
          fullWidth
        />
        <TextField
          label="Descrição"
          value={description ?? ''}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            if (description !== (task.description ?? '')) {
              updateTask.mutate({ taskId: task.id, description: description || null })
            }
          }}
          multiline
          minRows={3}
          fullWidth
        />
        <Select
          displayEmpty
          value={task.category ?? ''}
          onChange={(event) => {
            const value = event.target.value
            updateTask.mutate({ taskId: task.id, category: value ? (value as TaskCategory) : null })
          }}
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
          value={task.eisenhower ?? ''}
          onChange={(event) => {
            const value = event.target.value
            updateTask.mutate({
              taskId: task.id,
              eisenhower: value ? (value as TaskEisenhower) : null,
            })
          }}
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

        {!isSubtask && (
          <Button
            color="error"
            onClick={() => deleteTask.mutate({ taskId: task.id }, { onSuccess: onClose })}
          >
            {willHardDelete ? 'Excluir tarefa' : 'Cancelar tarefa'}
          </Button>
        )}
      </Box>
    </Drawer>
  )
}
