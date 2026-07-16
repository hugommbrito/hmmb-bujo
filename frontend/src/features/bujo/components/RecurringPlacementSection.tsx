import { useState } from 'react'
import { Box, Button, FormControlLabel, Switch, Typography } from '@mui/material'
import { useRecurringTemplatesQuery } from '../api'
import type { RecurrenceGroup, RecurringTaskTemplate, TaskCategory } from '../types'

interface RecurringPlacementSectionProps {
  recurrenceGroups: RecurrenceGroup[]
  onPlace: (template: RecurringTaskTemplate) => void
  // ids de templates que já têm instância no período corrente (a página calcula
  // a partir de `tasks.sourceTemplate`). Opcional: ausência = comportamento
  // antigo (nada é deduplicado), para robustez (Story 11.3, Task 7.5).
  placedTemplateIds?: Set<string>
}

const RECURRENCE_GROUP_LABEL: Record<RecurrenceGroup, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  annual: 'Anual',
}

// Categoria não tem sentinela tipo `'none'` (Story 11.12) — todo valor do
// enum é uma cor real, ausência é só `null`/`''`/`undefined`.
const CATEGORY_LABEL: Record<TaskCategory, string> = {
  teal: 'Teal',
  purple: 'Purple',
  pink: 'Pink',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
}

// Mesmo molde "banner vazio = sem DOM" de MigrationBanner/CatchUpBanner — um
// único useRecurringTemplatesQuery({ active: true }) e filtro client-side por
// recurrenceGroups (Task 12.1: evita N requisições, uma por grupo). O
// componente não decide o container do placement (weekStart/monthFirst) —
// só lista e delega via onPlace, que a página (WeeklyPage/MonthlyPage) usa
// para abrir o diálogo de confirmação com os dados de container que só ela tem.
//
// Story 11.3 (AC1): esconde templates já colocados no período (dedup). O switch
// "Mostrar já colocados" (mesmo padrão do "Mostrar inativos" da 11.2) é o
// caminho explícito para recolocar uma ocorrência extra — sem bloqueio rígido.
export function RecurringPlacementSection({
  recurrenceGroups,
  onPlace,
  placedTemplateIds = new Set(),
}: RecurringPlacementSectionProps) {
  const [showPlaced, setShowPlaced] = useState(false)
  const templates = useRecurringTemplatesQuery({ active: true })
  const inGroup = (templates.data ?? []).filter((template) =>
    recurrenceGroups.includes(template.recurrenceGroup),
  )
  const filtered = showPlaced
    ? inGroup
    : inGroup.filter((template) => !placedTemplateIds.has(template.id))

  // Só some totalmente quando não há NADA no grupo; se todos foram colocados,
  // ainda mostramos o switch para permitir recolocar.
  if (templates.isPending || inGroup.length === 0) return null

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="heading" sx={{ px: 1 }}>
        Recorrentes
      </Typography>
      <FormControlLabel
        sx={{ px: 1 }}
        control={
          <Switch
            checked={showPlaced}
            onChange={(event) => setShowPlaced(event.target.checked)}
          />
        }
        label="Mostrar já colocados"
      />
      {filtered.map((template) => {
        const alreadyPlaced = placedTemplateIds.has(template.id)
        return (
          <Box
            key={template.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 1,
              py: 1,
            }}
          >
            {/* Coluna à esquerda; `minWidth: 0` habilita o ellipsis da descrição. */}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">
                {template.title} — {RECURRENCE_GROUP_LABEL[template.recurrenceGroup]}
                {alreadyPlaced && ' (já colocado)'}
              </Typography>
              {/* AC1/AC2: descrição truncada em 1 linha, só quando há conteúdo.
                  `component="div"`: sem ela, `body-sm` (variante custom) cai no
                  fallback <span> (display:inline) e o ellipsis do `noWrap` não
                  se aplica. */}
              {template.description && (
                <Typography variant="body-sm" color="text.secondary" component="div" noWrap>
                  {template.description}
                </Typography>
              )}
              {template.category && (
                <Typography variant="body-sm" color="text.secondary" component="div">
                  Categoria: {CATEGORY_LABEL[template.category]}
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onPlace(template)}
              sx={{ flexShrink: 0 }}
            >
              Definir placement
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}
