import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material'
import { useHealthDailyQuery, useUpsertHealthLogMutation } from '../api'
import type { HealthDaySection, HealthFieldDefinition, HealthValue } from '../types'
import { HealthMetricRow } from './HealthMetricRow'

// Constantes de estado (voz UX-DR13: pt-BR neutro, zero gamificação). As de
// confirmação são verificadas literalmente em teste — não alterar o texto.
const READ_ERROR = 'Não foi possível carregar as métricas de saúde.'
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.'
const EMPTY_STATE = 'Nenhum campo de saúde ativo.'
const LOADING = 'Carregando métricas de saúde…'
const SAVED_YESTERDAY = 'Dados de ontem salvos.'
const SAVED_TODAY = 'Dados de hoje salvos.'

// Formatação de data em pt-BR SEM drift de fuso: a data vem do servidor como
// "YYYY-MM-DD" (autoridade temporal, AC3); construir o Date com partes locais
// evita o parse UTC de `new Date("2026-07-18")` (que poderia recuar um dia).
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return dateFormat.format(new Date(year, month - 1, day))
}

// Draft de uma seção: boolean → boolean; demais tipos → string (input controlado).
type SectionDraft = Record<string, string | boolean>

function initDraft(fields: HealthFieldDefinition[], values: HealthDaySection['values']): SectionDraft {
  const draft: SectionDraft = {}
  for (const field of fields) {
    const stored = values[field.id]
    draft[field.id] =
      field.fieldType === 'boolean' ? stored === true : stored == null ? '' : String(stored)
  }
  return draft
}

// Converte o draft (string|boolean) no payload a persistir: number para
// integer/decimal, boolean para boolean, string para enum/text; vazio → null
// (o backend remove a chave). `NaN` nunca é enviado (JSON serializa NaN como
// null e limparia a chave silenciosamente) — envia a string crua, que o backend
// rejeita com 409 (erro de escrita explícito).
function draftToPayload(
  fields: HealthFieldDefinition[],
  draft: SectionDraft,
): Record<string, HealthValue | null> {
  const payload: Record<string, HealthValue | null> = {}
  for (const field of fields) {
    const value = draft[field.id]
    if (field.fieldType === 'boolean') {
      payload[field.id] = value === true
    } else if (field.fieldType === 'integer' || field.fieldType === 'decimal') {
      const text = String(value).trim()
      if (text === '') {
        payload[field.id] = null
      } else {
        const parsed = Number(text)
        payload[field.id] = Number.isNaN(parsed) ? text : parsed
      }
    } else {
      // enum | text
      const text = String(value)
      payload[field.id] = text === '' ? null : text
    }
  }
  return payload
}

interface HealthLogSectionProps {
  heading: string
  date: string
  fields: HealthFieldDefinition[]
  values: HealthDaySection['values']
  savedMessage: string
}

function HealthLogSection({ heading, date, fields, values, savedMessage }: HealthLogSectionProps) {
  const [draft, setDraft] = useState<SectionDraft>(() => initDraft(fields, values))
  const upsert = useUpsertHealthLogMutation()

  function handleChange(fieldId: string, next: string | boolean) {
    // Limpa qualquer confirmação/erro anterior ao voltar a editar (evita mensagem
    // de sucesso "presa" enquanto o usuário mexe de novo).
    if (upsert.isSuccess || upsert.isError) upsert.reset()
    setDraft((prev) => ({ ...prev, [fieldId]: next }))
  }

  function handleSave() {
    upsert.mutate({ date, values: draftToPayload(fields, draft) })
  }

  return (
    <Box component="section" aria-label={heading} sx={{ mb: 3 }}>
      <Typography variant="h6" component="h2" sx={{ px: 1, mb: 1 }}>
        {heading}
      </Typography>
      {fields.map((field) => (
        <HealthMetricRow
          key={field.id}
          field={field}
          value={draft[field.id]}
          onChange={(next) => handleChange(field.id, next)}
        />
      ))}
      <Box sx={{ px: 1, mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="contained" onClick={handleSave} disabled={upsert.isPending}>
          Salvar
        </Button>
        {upsert.isSuccess && (
          <Typography variant="body2" color="success.main" role="status">
            {savedMessage}
          </Typography>
        )}
      </Box>
      {upsert.isError && (
        <Typography variant="body2" color="error" role="alert" sx={{ px: 1, mt: 1 }}>
          {SAVE_ERROR}
        </Typography>
      )}
    </Box>
  )
}

export function HealthMetricsLog() {
  const daily = useHealthDailyQuery()

  if (daily.isPending) {
    return (
      <Box>
        <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 1, mb: 1 }}>
          {LOADING}
        </Typography>
        <Box aria-hidden="true" sx={{ px: 1 }}>
          <Skeleton height={32} width="40%" />
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={32} width="40%" sx={{ mt: 2 }} />
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </Box>
      </Box>
    )
  }

  // Erro de LEITURA inicial (nunca houve sucesso → não há dados a exibir): estado
  // bloqueante com retry. Um erro de refetch em BACKGROUND (após o save invalidar
  // ['health'], ou no refetchOnWindowFocus com staleTime:0) NÃO cai aqui — `daily.data`
  // retém o último sucesso, então os rascunhos em edição das duas seções e a
  // confirmação "Dados salvos" são PRESERVADOS (AC5: "erro de leitura … preserva
  // contexto"). Diverge de propósito do idioma `isError || !data` de HabitTracker:
  // esta superfície mantém rascunhos não salvos, cuja perda num blip de refetch
  // (Neon cold-start) seria uma regressão de contexto.
  if (!daily.data) {
    return (
      <Box sx={{ px: 1, py: 1 }}>
        <Alert
          severity="error"
          role="alert"
          action={
            <Button color="inherit" size="small" onClick={() => void daily.refetch()}>
              Tentar novamente
            </Button>
          }
        >
          {READ_ERROR}
        </Alert>
      </Box>
    )
  }

  const { yesterday, today, fields } = daily.data

  if (fields.length === 0) {
    return (
      <Box sx={{ px: 1, py: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {EMPTY_STATE}
        </Typography>
        <Button component={RouterLink} to="/settings/health-metrics" size="small">
          Configurar métricas de saúde
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Ritual matinal (AC3): ontem no topo, hoje logo abaixo. Datas do servidor. */}
      <HealthLogSection
        heading={`Ontem, ${formatDate(yesterday.date)}`}
        date={yesterday.date}
        fields={fields}
        values={yesterday.values}
        savedMessage={SAVED_YESTERDAY}
      />
      <HealthLogSection
        heading={`Hoje, ${formatDate(today.date)}`}
        date={today.date}
        fields={fields}
        values={today.values}
        savedMessage={SAVED_TODAY}
      />
    </Box>
  )
}
