// ─────────────────────────────────────────────────────────────────────────────
// Hábitos — superfície de REGISTRO do sistema novo (Story 16.1 — M12).
//
//   ▶ UMA rota, TRÊS abas internas. O spine é explícito ("principal única, sem
//     rail de contexto, dividida em três abas", `EXPERIENCE.md#Hábitos`),
//     enquanto o legado usava três rotas em duas árvores. O caminho é o
//     precedente vivo do `ArchivePage`: estado da aba na QUERYSTRING (`?tab=`),
//     e as rotas antigas viram redirect. Isso preserva deep link, o link de
//     `SettingsPage` e os specs e2e que navegam por URL, sem rota nova (o gate
//     proíbe rota nova) nem manifest inflado.
//
//   ▶ RECOMPOSIÇÃO DA SUPERFÍCIE, DOMÍNIO INTOCADO. Zero endpoint novo, zero
//     migration, zero regra nova: os 14 hooks de `features/habits/api.ts` são
//     reusados como estão. `backend/`, `api.ts`, `keys.ts` e `types.gen.ts` não
//     aparecem no diff.
//
//   ▶ COEXISTÊNCIA. `HabitsPage`/`HabitHistoryPage`/`HabitsTabs`/
//     `HabitsSettingsPage` (legadas) e o `HabitTracker` do Daily permanecem no
//     repositório — as três primeiras apenas DESMONTADAS das rotas. A remoção
//     do legado é o Épico 18 (mesmo padrão de 14.7/14.8/15.1). `DailyPage`
//     continua montando o `HabitTracker` legado: F10–F12 são da onda da home.
//
//   ▶ EXATAMENTE UM `<main aria-label="Hábitos">` — o shell não renderiza
//     `main`.
//
// [Source: DESIGN.md#Hábitos (Registro); EXPERIENCE.md#Hábitos;
//  mockups/key-habitos.html F1-F9 + E1-E6; spec 16.1 Task 8]
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, useMediaQuery } from '@mui/material'

import { HabitsConfigPanel } from '../../features/habits/components/record/HabitsConfigPanel'
import { HabitsHistoryPanel } from '../../features/habits/components/record/HabitsHistoryPanel'
import { HabitsTodayPanel } from '../../features/habits/components/record/HabitsTodayPanel'
import {
  HABIT_TABS,
  isoLocalToday,
  parseTabSlug,
  tabIdOf,
  tabLabelOf,
  tabPanelIdOf,
  type HabitTabSlug,
} from '../../features/habits/components/record/habitsSurface'
import { mediaQueries, typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

export const PAGE_SUBTITLE = 'Registro do dia, configuração e histórico'
/** Verbatim do gate — nenhuma promessa de fila, rascunho ou sync. */
export const OFFLINE_BANNER = 'Sem conexão. Registrar e configurar hábitos exige rede.'

const TABLIST_LABEL = 'Seções de Hábitos'

export function HabitsRecordPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isOnline = useOnlineStatus()
  const isTabletUp = useMediaQuery(mediaQueries.tabletUp)
  const isWide = useMediaQuery(mediaQueries.wideUp)
  const compact = !isTabletUp
  const reactId = useId()
  const offlineId = `habits-offline-${reactId}`

  const tab = parseTabSlug(searchParams.get('tab'))
  // Data visível da aba Hoje. Estado LOCAL (não querystring): o gate não
  // promoveu deep link por data, e a aba Histórico é quem transporta um dia
  // específico para cá ("Abrir este dia para edição").
  const [date, setDate] = useState(() => isoLocalToday())

  /**
   * Ponto ÚNICO de troca de data, e o lugar onde o teto vive: nenhum chamador
   * pode levar a superfície para o futuro. `GET /api/habits/days/?date=`
   * MATERIALIZA o dia pedido (`seed_habit_day`), então abrir um dia futuro
   * criaria linhas com os pesos de hoje congelados nele — e esse dia entraria
   * como "dia com registro" na grade do Histórico. Retroatividade é ilimitada
   * (gate 16.0, Q5); prospectividade não existe.
   */
  function changeDate(next: string) {
    const today = isoLocalToday()
    setDate(next > today ? today : next)
  }

  function selectTab(next: HabitTabSlug) {
    // Reselecionar a aba ATUAL não é navegação: empurrar aqui empilharia
    // entradas idênticas e o primeiro `back` não mudaria de aba — contrariando
    // a AC ("o back do navegador volta à aba anterior").
    if (next === tab) return
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    // `push` (não `replace`): o back do navegador volta à aba anterior.
    setSearchParams(params)
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = HABIT_TABS.findIndex((candidate) => candidate.slug === tab)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % HABIT_TABS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + HABIT_TABS.length) % HABIT_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = HABIT_TABS.length - 1
    }
    if (nextIndex == null) return
    event.preventDefault()
    const nextSlug = HABIT_TABS[nextIndex].slug
    selectTab(nextSlug)
    document.getElementById(tabIdOf(nextSlug))?.focus()
  }

  function openDayForEdit(nextDate: string) {
    changeDate(nextDate)
    selectTab('hoje')
  }

  return (
    <Box
      component="main"
      aria-label="Hábitos"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-3)',
        // A variante "Registro em cards" ROMPE a largura de leitura; a aba
        // Configuração volta a 800px por conta própria.
        maxWidth: 'var(--ds-record-cards-max-width)',
        width: '100%',
      }}
    >
      <Box component="header">
        <Box
          component="h1"
          sx={{ ...typography['page-title'], color: 'var(--ds-ink)', margin: 0 }}
        >
          Hábitos
        </Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{PAGE_SUBTITLE}</Box>
      </Box>

      {/* Faixa PERSISTENTE de offline: controles de escrita ficam `disabled`
          com `aria-describedby` apontando para cá; rótulos seguem legíveis. */}
      {!isOnline && (
        <Box
          id={offlineId}
          role="status"
          sx={{
            ...typography.body,
            color: 'var(--ds-warning)',
            backgroundColor: 'var(--ds-warning-soft)',
            borderLeft: '3px solid var(--ds-warning)',
            padding: 'var(--ds-space-2)',
            borderRadius: 'var(--ds-radius-sm)',
          }}
        >
          {OFFLINE_BANNER}
        </Box>
      )}

      <Box
        role="tablist"
        aria-label={TABLIST_LABEL}
        onKeyDown={handleTabKeyDown}
        sx={{
          display: 'flex',
          gap: 'var(--ds-space-1)',
          borderBottom: '1px solid var(--ds-border)',
          overflowX: compact ? 'auto' : 'visible',
        }}
      >
        {HABIT_TABS.map((candidate) => {
          const selected = candidate.slug === tab
          return (
            <Box
              key={candidate.slug}
              component="button"
              type="button"
              role="tab"
              id={tabIdOf(candidate.slug)}
              aria-selected={selected}
              // SÓ na aba selecionada: apenas o painel ATIVO é montado, e
              // `aria-controls` para um id inexistente é violação real de
              // `aria-valid-attr-value`.
              aria-controls={selected ? tabPanelIdOf(candidate.slug) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(candidate.slug)}
              sx={{
                ...typography['body-strong'],
                flex: '0 0 auto',
                minHeight: 'var(--ds-touch-target-min)',
                padding: '0 var(--ds-space-3)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                background: selected ? 'var(--ds-primary-soft)' : 'transparent',
                border: 'none',
                borderBottom: '2px solid',
                borderBottomColor: selected ? 'var(--ds-primary)' : 'transparent',
                color: selected ? 'var(--ds-primary)' : 'var(--ds-ink-muted)',
              }}
            >
              {tabLabelOf(candidate, compact)}
            </Box>
          )
        })}
      </Box>

      <Box
        role="tabpanel"
        id={tabPanelIdOf(tab)}
        aria-labelledby={tabIdOf(tab)}
        tabIndex={0}
        sx={{ minWidth: 0 }}
      >
        {tab === 'hoje' && (
          <HabitsTodayPanel
            date={date}
            onChangeDate={changeDate}
            compact={compact}
            wide={isWide}
            disabled={!isOnline}
            disabledReasonId={!isOnline ? offlineId : undefined}
          />
        )}
        {tab === 'historico' && (
          <HabitsHistoryPanel compact={compact} onOpenDayForEdit={openDayForEdit} />
        )}
        {tab === 'configuracao' && (
          <HabitsConfigPanel
            compact={compact}
            disabled={!isOnline}
            disabledReasonId={!isOnline ? offlineId : undefined}
          />
        )}
      </Box>
    </Box>
  )
}
