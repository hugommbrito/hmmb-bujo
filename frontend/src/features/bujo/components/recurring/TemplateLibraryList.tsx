// ─────────────────────────────────────────────────────────────────────────────
// Painel da aba ativa: a lista de `ItemRowBase` (Story 14.8, AC1/AC2/AC6).
//
//   ▶ `role="tabpanel"` NOMEADO e ligado à aba por `aria-labelledby` — o par
//     que fecha `role="tablist"`/`role="tab"`.
//
//   ▶ `<ul>`/`<li>` (e não `div`s soltas): dá a cada template um CONTORNO
//     próprio na árvore de acessibilidade. É o que permite distinguir dois
//     botões "Editar" idênticos — por leitor de tela e por locator. O
//     `xpath=ancestor::div[2]` que os specs legados usavam é frágil por
//     construção; o escopo estável é `getByRole('listitem')`, o mesmo padrão
//     que a 14.7 adotou para os anuais pendentes.
//
//   ▶ Vazio POR GRUPO (não global): cópia literal do mockup (frame E) + a ação
//     de criar. NÃO renderiza enquanto a query está pendente — regressão
//     conhecida, coberta desde `RecurringTemplateManager.test.tsx:300`; aqui o
//     `initial loading` nem chega a montar este componente (a página troca pelo
//     skeleton), e o `pending` de refetch é tratado por quem chama.
// ─────────────────────────────────────────────────────────────────────────────
import { Box, Button } from '@mui/material'

import { ItemRowBase } from '../ItemRowBase'
import { RECURRENCE_GROUP_LABEL, sublineOf, tabIdOf, tabPanelIdOf } from './recurringLibrary'
import { typography } from '../../../../shared/design/tokens'
import type { RecurrenceGroup, RecurringTaskTemplate } from '../../types'

export const EMPTY_GROUP_TITLE = 'Nenhum template neste grupo.'
export const EMPTY_GROUP_HINT = 'Crie um modelo para alocá-lo depois ao planejar.'

export interface TemplateLibraryListProps {
  group: RecurrenceGroup
  templates: readonly RecurringTaskTemplate[]
  /** Offline (AC6): escrita indisponível com motivo, sem fila local. */
  disabled?: boolean
  onEdit: (template: RecurringTaskTemplate) => void
  onToggleActive: (template: RecurringTaskTemplate) => void
  onCreate: () => void
}

export function TemplateLibraryList({
  group,
  templates,
  disabled = false,
  onEdit,
  onToggleActive,
  onCreate,
}: TemplateLibraryListProps) {
  return (
    <Box
      role="tabpanel"
      id={tabPanelIdOf(group)}
      // Nomeado PELA ABA (`aria-labelledby`), nunca por um `aria-label` paralelo:
      // dois nomes concorrentes no mesmo nó divergem na primeira mudança de
      // rótulo, e `aria-labelledby` ganharia em silêncio.
      aria-labelledby={tabIdOf(group)}
      sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}
    >
      {templates.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ds-space-1)',
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ ...typography['section-title'], color: 'var(--ds-ink)' }}>
            {EMPTY_GROUP_TITLE}
          </Box>
          <Box sx={{ ...typography.body, color: 'var(--ds-ink-muted)' }}>{EMPTY_GROUP_HINT}</Box>
          {/* Nome acessível DISTINTO da ação primária do header (que também lê
              "Novo template" — cópia literal do mockup nos dois lugares): sem
              isso, os dois botões colidem no mesmo nome quando o grupo ativo
              está vazio, e ficam indistinguíveis por `getByRole`/leitor de
              tela. O texto VISÍVEL continua "Novo template" (mockup, frame E);
              só o `aria-label` ganha o grupo como contexto. */}
          <Button
            onClick={onCreate}
            disabled={disabled}
            aria-label={`Novo template — ${RECURRENCE_GROUP_LABEL[group]}`}
            sx={{
              minHeight: 'var(--ds-touch-target-min)',
              backgroundColor: 'var(--ds-primary)',
              color: 'var(--ds-on-primary)',
              '&:hover': { backgroundColor: 'var(--ds-primary-hover)' },
              '&.Mui-disabled': {
                backgroundColor: 'var(--ds-surface-subtle)',
                color: 'var(--ds-ink-muted)',
              },
            }}
          >
            Novo template
          </Button>
        </Box>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ds-space-1)',
          }}
        >
          {templates.map((template) => (
            <Box component="li" key={template.id}>
              <ItemRowBase
                title={template.title}
                subline={sublineOf(template)}
                description={template.description}
                category={template.category || null}
                eisenhower={template.eisenhower || null}
                deemphasized={!template.active}
                trailingSlot={
                  <>
                    <Button
                      size="small"
                      disabled={disabled}
                      onClick={() => onEdit(template)}
                      aria-label={`Editar ${template.title}`}
                      sx={ROW_ACTION_SX}
                    >
                      Editar
                    </Button>
                    <Button
                      size="small"
                      disabled={disabled}
                      onClick={() => onToggleActive(template)}
                      aria-label={`${template.active ? 'Desativar' : 'Ativar'} ${template.title}`}
                      sx={ROW_ACTION_SX}
                    >
                      {template.active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </>
                }
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

/** Alvo de toque ≥44px e cor EXPLÍCITA (o `primary` do tema MUI é o teal de
 * marca, que sobre `--ds-surface` mede ~2,4:1 e reprova AA — achado real do axe
 * na 14.7). */
const ROW_ACTION_SX = {
  minWidth: 0,
  minHeight: 'var(--ds-touch-target-min)',
  color: 'var(--ds-ink)',
  '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
} as const
