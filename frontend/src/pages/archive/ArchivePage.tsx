// ─────────────────────────────────────────────────────────────────────────────
// Índice do Arquivo do sistema novo (Story 14.10) — substitui a lista simples
// (`text.secondary`, sem abas/filtro) por abas Semanal/Mensal (ARIA completo:
// `tablist`/`tab`/`tabpanel`, roving tabindex, setas/Home/End — corrige o
// High-3 de `review-accessibility-archive.md`) + filtro de data CLIENT-SIDE
// sobre a mesma `useArchiveQuery()` (sem paginação/agregação no backend,
// `EXPERIENCE.md:371`).
//
//   ▶ `tab`/`from`/`to` vivem na querystring (não em estado local perdível):
//     browser back e o link "Voltar ao Arquivo" dos detalhes restauram aba e
//     intervalo de graça, sem plumbing extra.
//   ▶ "Último período visitado" (scroll + destaque ao voltar do detalhe) usa
//     UMA entrada de `sessionStorage` — mesmo racional de
//     `archiveLineageReturn.ts`, mas escopado à lista (não à linha de tarefa).
//   ▶ Períodos continuam `<a>`/`RouterLink` (não botões): é o que
//     `frontend/e2e/archive.spec.ts` já verifica via `getByRole('link', ...)`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Box, Button } from '@mui/material'
import { useArchiveQuery } from '../../features/bujo'
import type { ArchiveEntry } from '../../features/bujo'
import { capitalize, MONTH_NAMES_PT } from '../../features/bujo/monthNames'
import { PlannerSkeleton } from '../../features/bujo/components/PlannerSkeleton'
import { typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'
import { addDaysIso, lastDayOfMonth } from '../../shared/date'

type ArchiveTabId = 'weekly' | 'monthly'

const TABS: ReadonlyArray<{ id: ArchiveTabId; label: string }> = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensal' },
]

const LAST_SELECTED_STORAGE_KEY = 'bujo:archive-last-selected'
const HIGHLIGHT_MS = 2000

function writeLastSelected(key: string): void {
  sessionStorage.setItem(LAST_SELECTED_STORAGE_KEY, key)
}
function readLastSelected(): string | null {
  return sessionStorage.getItem(LAST_SELECTED_STORAGE_KEY)
}
function clearLastSelected(): void {
  sessionStorage.removeItem(LAST_SELECTED_STORAGE_KEY)
}

function formatEntryLabel(entry: ArchiveEntry): string {
  if (entry.type === 'weekly' && entry.weekStart) {
    return `Semana de ${entry.weekStart}`
  }
  if (entry.type === 'monthly' && entry.monthFirst) {
    const month = Number(entry.monthFirst.slice(5, 7))
    const year = entry.monthFirst.slice(0, 4)
    return `${capitalize(MONTH_NAMES_PT[month - 1])} ${year}`
  }
  return ''
}

/** Data de início do período — usada para o filtro de intervalo. */
function entryKey(entry: ArchiveEntry): string {
  return entry.weekStart ?? entry.monthFirst ?? ''
}

/** Último dia do período — `entryKey` sozinho (sempre o 1o dia, semana ou mês)
 * SUBESTIMA o intervalo real de um período (Story 14.10, review): um filtro
 * com `from` no meio do período excluía o período inteiro, mesmo com a
 * segunda metade dele dentro do range escolhido. Mesma classe de bug corrigida
 * para mensal e semanal (review fresca pós `status: done`, sobre a mesma
 * mecânica de overlap). */
function entryPeriodEnd(entry: ArchiveEntry): string {
  if (entry.type === 'monthly' && entry.monthFirst) {
    const day = String(lastDayOfMonth(entry.monthFirst)).padStart(2, '0')
    return `${entry.monthFirst.slice(0, 7)}-${day}`
  }
  if (entry.type === 'weekly' && entry.weekStart) {
    return addDaysIso(entry.weekStart, 6)
  }
  return entryKey(entry)
}

/** Chave de IDENTIDADE (React key, destaque, `sessionStorage`) — precisa do
 * `type` porque uma semana pode começar no dia 1 de um mês, colidindo com
 * `entryKey` de um mês nesse mesmo dia (Story 14.10, review). */
function entryIdKey(entry: ArchiveEntry): string {
  return `${entry.type}:${entryKey(entry)}`
}

function entryPath(entry: ArchiveEntry): string {
  return entry.type === 'weekly'
    ? `/archive/weekly/${entry.weekStart}`
    : `/archive/monthly/${entry.monthFirst}`
}

export function ArchivePage() {
  const archive = useArchiveQuery()
  const isOnline = useOnlineStatus()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab: ArchiveTabId = searchParams.get('tab') === 'monthly' ? 'monthly' : 'weekly'
  const appliedFrom = searchParams.get('from') ?? ''
  const appliedTo = searchParams.get('to') ?? ''

  const [draftFrom, setDraftFrom] = useState(appliedFrom)
  const [draftTo, setDraftTo] = useState(appliedTo)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)

  const weeklyTabRef = useRef<HTMLButtonElement>(null)
  const monthlyTabRef = useRef<HTMLButtonElement>(null)
  const restoredRef = useRef(false)

  // A URL é a fonte da verdade (querystring) — o rascunho dos inputs só segue
  // quando ela muda por FORA de `applyRange` (voltar do navegador, "Voltar ao
  // Arquivo" de um detalhe, edição manual da URL).
  useEffect(() => {
    setDraftFrom(appliedFrom)
    setDraftTo(appliedTo)
  }, [appliedFrom, appliedTo])

  useEffect(() => {
    if (!highlightedKey) return undefined
    const timer = window.setTimeout(() => setHighlightedKey(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlightedKey])

  // Restaura scroll + destaque do ÚLTIMO período visitado ao voltar ao índice
  // (medium finding da review: sem isso o retorno "esquece" onde o usuário
  // estava). Roda uma única vez, quando a lista carrega.
  useEffect(() => {
    if (!archive.data || restoredRef.current) return
    const lastSelected = readLastSelected()
    if (!lastSelected) return
    // O destaque só existe no DOM da aba correspondente (review): se a última
    // seleção é de um tipo diferente da aba ativa, não consumir a entrada
    // agora — espera uma futura montagem cuja aba já bata (ex.: usuário troca
    // de aba) em vez de descartá-la de imediato sem chance de restaurar.
    if (!lastSelected.startsWith(`${tab}:`)) return
    restoredRef.current = true
    const found = archive.data.some((entry) => entryIdKey(entry) === lastSelected)
    clearLastSelected()
    if (!found) return
    setHighlightedKey(lastSelected)
    const el = document.querySelector<HTMLElement>(`[data-archive-entry="${lastSelected}"]`)
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }, [archive.data, tab])

  function selectTab(next: ArchiveTabId) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params)
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const next: ArchiveTabId = tab === 'weekly' ? 'monthly' : 'weekly'
      selectTab(next)
      ;(next === 'weekly' ? weeklyTabRef : monthlyTabRef).current?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectTab('weekly')
      weeklyTabRef.current?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      selectTab('monthly')
      monthlyTabRef.current?.focus()
    }
  }

  function applyRange() {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setRangeError('A data inicial não pode ser depois da data final.')
      return
    }
    setRangeError(null)
    const params = new URLSearchParams(searchParams)
    if (draftFrom) params.set('from', draftFrom)
    else params.delete('from')
    if (draftTo) params.set('to', draftTo)
    else params.delete('to')
    setSearchParams(params)
  }

  function clearRange() {
    setRangeError(null)
    setDraftFrom('')
    setDraftTo('')
    const params = new URLSearchParams(searchParams)
    params.delete('from')
    params.delete('to')
    setSearchParams(params)
  }

  if (archive.isPending) {
    return (
      <Box component="main" aria-label="Arquivo" sx={{ p: 'var(--ds-space-4)' }}>
        <PlannerSkeleton />
      </Box>
    )
  }

  if (archive.isError || !archive.data) {
    return (
      <Box
        component="main"
        aria-label="Arquivo"
        sx={{
          p: 'var(--ds-space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-2)',
          alignItems: 'flex-start',
        }}
      >
        {!isOnline ? (
          <Box
            role="status"
            sx={{
              ...typography.body,
              color: 'var(--ds-danger)',
              backgroundColor: 'var(--ds-danger-soft)',
              padding: 'var(--ds-space-2)',
              borderRadius: 'var(--ds-radius-sm)',
            }}
          >
            Sem conexão. Não é possível carregar o Arquivo agora.
          </Box>
        ) : (
          <>
            <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
              Não foi possível carregar o Arquivo.
            </Box>
            <Button onClick={() => archive.refetch()} variant="contained">
              Tentar de novo
            </Button>
          </>
        )}
      </Box>
    )
  }

  const entriesOfTab = archive.data.filter((entry) => entry.type === tab)
  const rangeApplied = Boolean(appliedFrom || appliedTo)
  // `applyRange` valida `draftFrom > draftTo` antes de escrever na URL, mas a
  // URL é lida direto aqui também (voltar do navegador, link/bookmark editado
  // à mão) — sem esta checagem, um range invertido vindo só da querystring
  // nunca passava pela validação (achado da review).
  const appliedRangeInvalid = Boolean(appliedFrom && appliedTo && appliedFrom > appliedTo)
  const filteredEntries = entriesOfTab.filter((entry) => {
    if (!rangeApplied) return true
    if (appliedRangeInvalid) return false
    // Overlap, não comparação de ponto único: um período que TERMINA depois de
    // `appliedFrom` e COMEÇA antes de `appliedTo` está dentro do intervalo,
    // mesmo que seu dia de início/fim não seja um dos dois limites.
    if (appliedFrom && entryPeriodEnd(entry) < appliedFrom) return false
    if (appliedTo && entryKey(entry) > appliedTo) return false
    return true
  })
  const displayedRangeError =
    rangeError ?? (appliedRangeInvalid ? 'A data inicial não pode ser depois da data final.' : null)

  const emptyInitial = entriesOfTab.length === 0
  const emptyByFilter = !emptyInitial && filteredEntries.length === 0
  const countLabel =
    tab === 'weekly'
      ? `${filteredEntries.length} ${filteredEntries.length === 1 ? 'semana finalizada' : 'semanas finalizadas'}`
      : `${filteredEntries.length} ${filteredEntries.length === 1 ? 'mês finalizado' : 'meses finalizados'}`

  // Mesma forma que `handleNavigateToSuccessor` (das páginas de detalhe) já
  // constrói para o salto de linhagem — aqui é o caminho ORDINÁRIO
  // índice→detalhe (achado da review: sem isto, "Voltar ao Arquivo" e o
  // destaque de "último período visitado" só funcionavam vindos de um salto
  // de linhagem, nunca vindos da lista). A aba/intervalo ATUAIS (a querystring
  // desta própria página) viajam como `location.state`, para o detalhe
  // devolver exatamente a este estado ao voltar.
  const archiveReturnQuery = searchParams.toString() ? `?${searchParams.toString()}` : ''

  return (
    <Box
      component="main"
      aria-label="Arquivo"
      sx={{ p: 'var(--ds-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}
    >
      <Box component="header">
        <Box component="h1" sx={{ ...typography['page-title'], color: 'var(--ds-ink)', margin: 0 }}>
          Arquivo
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          Ciclos finalizados · somente leitura
        </Box>
      </Box>

      {!isOnline && (
        <Box
          role="status"
          sx={{
            ...typography.body,
            color: 'var(--ds-danger)',
            backgroundColor: 'var(--ds-danger-soft)',
            padding: 'var(--ds-space-2)',
            borderRadius: 'var(--ds-radius-sm)',
          }}
        >
          Sem conexão. Mostrando ciclos disponíveis neste dispositivo.
        </Box>
      )}

      <Box
        role="tablist"
        aria-label="Tipos do Arquivo"
        sx={{ display: 'flex', gap: 'var(--ds-space-1)', borderBottom: '1px solid var(--ds-border)' }}
      >
        {TABS.map((t) => (
          <Box
            key={t.id}
            component="button"
            type="button"
            ref={t.id === 'weekly' ? weeklyTabRef : monthlyTabRef}
            role="tab"
            id={`archive-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`archive-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => selectTab(t.id)}
            onKeyDown={handleTabKeyDown}
            sx={{
              ...typography['body-strong'],
              minHeight: 'var(--ds-touch-target-min)',
              padding: '0 var(--ds-space-3)',
              border: 'none',
              borderBottom: '3px solid',
              borderBottomColor: tab === t.id ? 'var(--ds-primary)' : 'transparent',
              backgroundColor: tab === t.id ? 'var(--ds-primary-soft)' : 'transparent',
              color: tab === t.id ? 'var(--ds-primary)' : 'var(--ds-ink-muted)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </Box>
        ))}
      </Box>

      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault()
          applyRange()
        }}
        sx={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <Box component="label" htmlFor="archive-filter-from" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Data inicial</span>
          <input
            id="archive-filter-from"
            type="date"
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
            style={{
              ...typography.body,
              minHeight: 'var(--ds-touch-target-min)',
              padding: 'var(--ds-space-1)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-ink)',
            }}
          />
        </Box>
        <Box component="label" htmlFor="archive-filter-to" sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-1)' }}>
          <span style={{ ...typography.label }}>Data final</span>
          <input
            id="archive-filter-to"
            type="date"
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
            style={{
              ...typography.body,
              minHeight: 'var(--ds-touch-target-min)',
              padding: 'var(--ds-space-1)',
              border: '1px solid var(--ds-control-border)',
              borderRadius: 'var(--ds-radius-sm)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-ink)',
            }}
          />
        </Box>
        <Button type="submit" sx={{ backgroundColor: 'var(--ds-primary)', color: 'var(--ds-on-primary)' }}>
          Aplicar período
        </Button>
        {rangeApplied && (
          <Button type="button" onClick={clearRange} sx={{ color: 'var(--ds-ink)', border: '1px solid var(--ds-control-border)' }}>
            Limpar
          </Button>
        )}
        <Box role="status" aria-live="polite" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)', ml: 'auto' }}>
          {countLabel}
        </Box>
      </Box>

      {displayedRangeError && (
        <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-danger)' }}>
          {displayedRangeError}
        </Box>
      )}

      <Box role="tabpanel" id={`archive-panel-${tab}`} aria-labelledby={`archive-tab-${tab}`} tabIndex={0}>
        {emptyInitial ? (
          <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
            {tab === 'weekly' ? 'Nenhuma semana finalizada ainda.' : 'Nenhum mês finalizado ainda.'}
          </Box>
        ) : emptyByFilter ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)', alignItems: 'flex-start' }}>
            <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>
              {tab === 'weekly'
                ? 'Nenhuma semana finalizada nesse período.'
                : 'Nenhum mês finalizado nesse período.'}
            </Box>
            <Button onClick={clearRange} sx={{ color: 'var(--ds-ink)', border: '1px solid var(--ds-control-border)' }}>
              Limpar período
            </Button>
          </Box>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {filteredEntries.map((entry) => {
              const key = entryIdKey(entry)
              const isHighlighted = highlightedKey === key
              return (
                <Box component="li" key={key}>
                  <Box
                    component={RouterLink}
                    to={entryPath(entry)}
                    state={{ archiveReturnQuery }}
                    onClick={() => writeLastSelected(key)}
                    data-archive-entry={key}
                    aria-current={isHighlighted ? 'true' : undefined}
                    sx={{
                      display: 'block',
                      minHeight: 'var(--ds-touch-target-min)',
                      padding: 'var(--ds-space-2) var(--ds-space-3)',
                      textDecoration: 'none',
                      color: 'var(--ds-ink)',
                      borderBottom: '1px solid var(--ds-border)',
                      outline: isHighlighted ? '2px solid var(--ds-info)' : 'none',
                      outlineOffset: '-2px',
                      backgroundColor: isHighlighted ? 'var(--ds-info-soft)' : 'transparent',
                    }}
                  >
                    <Box sx={{ ...typography['body-strong'] }}>{formatEntryLabel(entry)}</Box>
                    <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
                      {entry.type === 'weekly' ? 'Semana · Fechada' : 'Mês · Fechado'}
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
