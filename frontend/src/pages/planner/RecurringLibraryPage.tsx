// ─────────────────────────────────────────────────────────────────────────────
// Biblioteca de Recorrentes do sistema novo (Story 14.8 — M09). QUARTA
// superfície do Épico 14, depois de Weekly (14.5), Monthly (14.6) e Future (14.7).
//
//   ▶ NÃO É UM PLANNER — É UMA COLEÇÃO. Template não é tarefa: não tem status,
//     nem data, nem log, nem linhagem, nem subtarefas (AD-08 itens 1 e 8). Não
//     há ciclo, ritual, densidade nem migração aqui.
//
//   ▶ ALOCAR CONTINUA SENDO DOS RITUAIS. A biblioteca apenas ALIMENTA e
//     REFERENCIA: nenhum botão "Alocar", nenhum `RecurringPlacementDialog`,
//     nenhum `POST /place/`. A alocação já está desenhada e aprovada em
//     M06/M07/M08, e recriá-la aqui geraria redundância e divergência.
//
//   ▶ UMA ÚNICA QUERY SEM PARAMS + filtro CLIENT-SIDE (decisão vigente desde a
//     11.2): é o que mantém a troca de aba instantânea, sem novo estado de
//     loading. O servidor já filtra `deleted_at` na origem (`live_templates()`,
//     AD-08 item 6b) — e é essa assimetria (`active` no cliente × excluído no
//     servidor) que o E2E da 14.4 prova.
//
//   ▶ "NOVO TEMPLATE" FICA NO HEADER, TAMBÉM EM COMPACT — o mockup (frame D)
//     desenha um FAB no canto inferior direito, exatamente onde o `ShellLayout`
//     já monta o FAB de CAPTURA persistente desde a 13.3. Dois FABs no mesmo
//     canto é colisão, não composição, e o FAB de captura é chrome global que
//     uma superfície não pode suprimir. O mockup perde nesse ponto por conflito
//     com o shell aprovado (Questão aberta #8).
//
//   ▶ `RecurringPage.tsx` + `RecurringTemplateManager.tsx` (legados) permanecem
//     no repositório, apenas DESMONTADOS da rota — a remoção do legado é o
//     Épico 18, e o rollback por superfície continua sendo UMA LINHA em
//     `router.tsx` (AC9).
//
// [Source: EXPERIENCE.md#Recorrentes L349-357; DESIGN.md#Recorrentes (Coleção)
//  L647-655; mockups/key-recorrentes.html frames A–E; epics.md#Story 14.8]
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { Box, Button, Dialog, IconButton, useMediaQuery } from '@mui/material'
import { Trash } from '@phosphor-icons/react'

import {
  TemplateDetailCard,
  useDeleteRecurringTemplateMutation,
  useRecurringTemplatesQuery,
  useUpdateRecurringTemplateMutation,
} from '../../features/bujo'
import type { RecurrenceGroup, RecurringTaskTemplate } from '../../features/bujo'
import { RecurringGroupTabs } from '../../features/bujo/components/recurring/RecurringGroupTabs'
import { RecurringLibrarySkeleton } from '../../features/bujo/components/recurring/RecurringLibrarySkeleton'
import { TemplateLibraryList } from '../../features/bujo/components/recurring/TemplateLibraryList'
import { visibleByGroup } from '../../features/bujo/components/recurring/recurringLibrary'
import { mediaQueries, shellCssVariables, typography } from '../../shared/design/tokens'
import { useOnlineStatus } from '../../shared/hooks/useOnlineStatus'

const PAGE_SUBTITLE =
  'Modelos que você aloca manualmente ao planejar. Não geram tarefas sozinhos.'
const READ_ERROR = 'Não foi possível carregar os templates.'
const OFFLINE_REASON =
  'Você está offline. Consulta disponível; criar e editar templates ficam indisponíveis até reconectar.'
const WRITE_ERROR = 'Não foi possível salvar o template. Tente novamente.'
const DELETE_ERROR = 'Não foi possível excluir o template. Tente novamente.'
const DELETE_DIALOG_TITLE = 'Excluir template?'
function deleteDialogBody(title: string): string {
  return `«${title}» sai da biblioteca e deixa de ser oferecido nos rituais. As tarefas já criadas a partir dele são preservadas e mantêm a linhagem — a exclusão é lógica (soft delete).`
}

/** Cores EXPLÍCITAS do design system: o `primary` do tema MUI é o teal de
 * marca, que sobre `--ds-surface` mede ~2,4:1 e reprova AA (achado real do axe
 * na 14.7). Todo `Button` desta superfície declara a cor que usa. */
const PRIMARY_BUTTON_SX = {
  minHeight: 'var(--ds-touch-target-min)',
  backgroundColor: 'var(--ds-primary)',
  color: 'var(--ds-on-primary)',
  '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
  '&.Mui-disabled': {
    backgroundColor: 'var(--ds-surface-subtle)',
    color: 'var(--ds-ink-muted)',
  },
} as const

/** O card aberto. `mode: 'create'` não carrega template; `mode: 'edit'` carrega
 * o template daquela linha. Um único estado (em vez de dois booleanos) impede o
 * par impossível "criando E editando". */
type OpenCard =
  | { mode: 'create' }
  | { mode: 'edit'; template: RecurringTaskTemplate }

export function RecurringLibraryPage() {
  const templates = useRecurringTemplatesQuery()
  const updateTemplate = useUpdateRecurringTemplateMutation()
  const deleteTemplate = useDeleteRecurringTemplateMutation()

  const [activeGroup, setActiveGroup] = useState<RecurrenceGroup>('weekly')
  const [showInactive, setShowInactive] = useState(false)
  const [openCard, setOpenCard] = useState<OpenCard | null>(null)
  const [rowWriteError, setRowWriteError] = useState<string | null>(null)
  // Alvo do `alertdialog` de confirmação (AC4). `null` ⇒ dialog fechado.
  const [deleteTarget, setDeleteTarget] = useState<RecurringTaskTemplate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  const isTabletUp = useMediaQuery(mediaQueries.tabletUp)
  const isOnline = useOnlineStatus()
  const compact = !isTabletUp

  // FONTE ÚNICA da lista e das contagens (AC1): as três abas e o painel leem
  // deste mesmo objeto, então ligar o filtro muda os três números E o conteúdo
  // pela mesma causa.
  const visible = visibleByGroup(templates.data ?? [], showInactive)
  const counts = {
    weekly: visible.weekly.length,
    monthly: visible.monthly.length,
    annual: visible.annual.length,
  } as Record<RecurrenceGroup, number>

  function handleToggleActive(template: RecurringTaskTemplate) {
    setRowWriteError(null)
    updateTemplate.mutate(
      { templateId: template.id, active: !template.active },
      { onError: () => setRowWriteError(WRITE_ERROR) },
    )
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    deleteTemplate.mutate(
      { templateId: deleteTarget.id },
      {
        onSuccess: () => {
          // Confirmar fecha dialog E card (AC4) — o template já saiu da
          // biblioteca, então não há mais o que editar.
          setDeleteTarget(null)
          setOpenCard(null)
        },
        // Falha do DELETE mantém card e dialog UTILIZÁVEIS, com motivo e
        // retry — nunca fecha em cima de um erro (AC4).
        onError: () => setDeleteError(DELETE_ERROR),
      },
    )
  }

  function handleCancelDelete() {
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const header = (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--ds-space-3)',
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ ...typography['page-title'], color: 'var(--ds-ink)' }}>Recorrentes</Box>
        <Box sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>{PAGE_SUBTITLE}</Box>
      </Box>
      {/* Ação primária no HEADER também em compact — ver o bloco do FAB no
          cabeçalho do arquivo. Alcançável sem scroll e no alvo de toque
          mínimo (`--ds-touch-target-min`). */}
      <Button
        onClick={() => setOpenCard({ mode: 'create' })}
        disabled={!isOnline}
        sx={{ ...PRIMARY_BUTTON_SX, flex: '0 0 auto' }}
      >
        Novo template
      </Button>
    </Box>
  )

  return (
    <Box
      component="main"
      aria-label="Recorrentes"
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}
    >
      {header}

      {!isOnline && (
        <Box role="status" sx={{ ...typography.meta, color: 'var(--ds-ink-muted)' }}>
          {OFFLINE_REASON}
        </Box>
      )}

      {templates.isPending ? (
        <RecurringLibrarySkeleton />
      ) : (
        <>
          {/* As abas e o filtro SOBREVIVEM ao erro de leitura (AC6): o retry não
              tira o usuário da tela nem perde a aba/filtro escolhidos. */}
          <RecurringGroupTabs
            activeGroup={activeGroup}
            counts={counts}
            showInactive={showInactive}
            compact={compact}
            onSelectGroup={setActiveGroup}
            onToggleShowInactive={setShowInactive}
          />

          {templates.isError ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--ds-space-2)',
                alignItems: 'flex-start',
              }}
            >
              <Box role="alert" sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
                {READ_ERROR}
              </Box>
              <Button onClick={() => templates.refetch()} sx={PRIMARY_BUTTON_SX}>
                Tentar de novo
              </Button>
            </Box>
          ) : (
            <TemplateLibraryList
              group={activeGroup}
              templates={visible[activeGroup]}
              disabled={!isOnline}
              onEdit={(template) => setOpenCard({ mode: 'edit', template })}
              onToggleActive={handleToggleActive}
              onCreate={() => setOpenCard({ mode: 'create' })}
            />
          )}
        </>
      )}

      {rowWriteError && (
        <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
          {rowWriteError}
        </Box>
      )}

      {openCard && (
        <TemplateDetailCard
          // `key` remonta o card ao trocar de template/modo — sem isso o
          // rascunho do anterior sobreviveria à troca (mesma classe do
          // vazamento de estado entre instâncias que a Retro do Épico 11
          // registrou para rotas parametrizadas).
          key={openCard.mode === 'edit' ? openCard.template.id : 'create'}
          template={openCard.mode === 'edit' ? openCard.template : null}
          initialGroup={activeGroup}
          disabled={!isOnline}
          disabledReason={OFFLINE_REASON}
          onClose={() => setOpenCard(null)}
          onSaved={() => setOpenCard(null)}
          deleteSlot={
            openCard.mode === 'edit' ? (
              <IconButton
                aria-label="Excluir template"
                disabled={!isOnline}
                onClick={() => {
                  setDeleteError(null)
                  setDeleteTarget(openCard.template)
                }}
                sx={{
                  width: 'var(--ds-touch-target-min)',
                  height: 'var(--ds-touch-target-min)',
                  color: 'var(--ds-ink-muted)',
                }}
              >
                <Trash size={20} />
              </IconButton>
            ) : undefined
          }
        />
      )}

      {deleteTarget && (
        <Dialog
          open
          onClose={handleCancelDelete}
          slotProps={{
            paper: {
              role: 'alertdialog',
              'aria-label': 'Confirmar exclusão',
              style: shellCssVariables('light'),
              sx: {
                width: 'min(420px, 90vw)',
                backgroundColor: 'var(--ds-surface)',
                border: '1px solid var(--ds-border)',
                borderRadius: 'var(--ds-radius-md)',
                padding: 'var(--ds-space-4)',
              },
            },
            // Foco inicial do AC6 tem dois mecanismos complementares: o
            // `autoFocus` cobre a montagem imediata (jsdom, unit test), e o
            // `onEntered` refoca ao fim da transição — necessário porque o
            // FocusTrap do Modal rouba o foco do `autoFocus` durante a
            // animação de entrada no browser real (mesmo padrão de
            // `BrainDumpCaptureSheet.tsx`).
            transition: { onEntered: () => cancelButtonRef.current?.focus() },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
            <Box component="h2" sx={{ ...typography['section-title'], color: 'var(--ds-ink)', margin: 0 }}>
              {DELETE_DIALOG_TITLE}
            </Box>
            <Box sx={{ ...typography.body, color: 'var(--ds-ink)' }}>
              {deleteDialogBody(deleteTarget.title)}
            </Box>
            {deleteError && (
              <Box role="alert" sx={{ ...typography.meta, color: 'var(--ds-danger)' }}>
                {deleteError}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 'var(--ds-space-2)', justifyContent: 'flex-end' }}>
              {/* Foco nasce numa ação NÃO-destrutiva (AC6). */}
              <Button
                ref={cancelButtonRef}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onClick={handleCancelDelete}
                sx={{
                  minHeight: 'var(--ds-touch-target-min)',
                  color: 'var(--ds-ink)',
                  border: '1px solid var(--ds-control-border)',
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleteTemplate.isPending}
                sx={{
                  minHeight: 'var(--ds-touch-target-min)',
                  backgroundColor: 'var(--ds-danger)',
                  color: 'var(--ds-on-primary)',
                }}
              >
                Excluir
              </Button>
            </Box>
          </Box>
        </Dialog>
      )}
    </Box>
  )
}
