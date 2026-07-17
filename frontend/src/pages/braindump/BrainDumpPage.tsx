import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import {
  useBrainDumpItemsQuery,
  useCreateBrainDumpItemMutation,
} from '../../features/braindump'
import { BrainDumpCaptureForm } from '../../features/braindump/components/BrainDumpCaptureForm'
import { BrainDumpItemRow } from '../../features/braindump/components/BrainDumpItemRow'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'

export function BrainDumpPage() {
  const items = useBrainDumpItemsQuery()
  const createItem = useCreateBrainDumpItemMutation()
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Foca o título toda vez que a página monta — não só quando chegou via
  // atalho `B` (Task 10.2, decisão de simplicidade: custo zero, evita
  // ramificar comportamento por origem de navegação).
  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  if (items.isPending) {
    return (
      <Box component="main" aria-label="Brain Dump" sx={{ p: 3 }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (!items.data) return null

  return (
    <Box component="main" aria-label="Brain Dump" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Brain Dump
      </Typography>
      <BrainDumpCaptureForm ref={titleInputRef} onCapture={(fields) => createItem.mutate(fields)} />
      {items.data.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          Brain Dump vazio.
        </Typography>
      ) : (
        <Box>
          {items.data.map((item) => (
            <BrainDumpItemRow key={item.id} item={item} />
          ))}
        </Box>
      )}
    </Box>
  )
}
