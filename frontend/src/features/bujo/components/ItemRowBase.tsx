// ─────────────────────────────────────────────────────────────────────────────
// Item Row BASE do sistema novo (Story 14.8, AC2; UX-DR24/UX-DR26).
//
//   ▶ NASCE aqui, como IRMÃ de `TaskRowBase.tsx` — não um fork dele. O
//     `DESIGN.md` L523 registra Item Row como componente de RAIZ ("variante sem
//     máquina de estado de tarefa") e o `EXPERIENCE.md` L119 nomeia os
//     consumidores: recorrentes (14.8), Brain Dump (Épico 15) e settings
//     (Épico 18). Desenhar para reuso é requisito, não bônus — e por isso as
//     props são de APRESENTAÇÃO (título/subline/descrição/categoria/chips), não
//     um domínio específico: nenhum `RecurringTaskTemplate` cruza esta fronteira.
//
//   ▶ Os Épicos 15/18 ESPECIALIZAM sem alterar a anatomia: o `trailingSlot`
//     recebe o conjunto de ações da superfície e `statusChipLabel` nomeia o
//     estado daquele domínio ("inativo" aqui, outro rótulo lá).
//
//   ▶ O QUE NÃO EXISTE AQUI, de propósito: coluna de ícone de status,
//     indicador de ordem e subárvore. As três existem em `TaskRowBase` por
//     causa da MÁQUINA DE ESTADOS, e template não tem estado, nem data, nem
//     linhagem, nem subtarefas (AD-08 itens 1 e 8).
//
//   ▶ MESMA MEDIDA da Task Row: consome `--ds-task-row-min-height-pointer` /
//     `--ds-task-row-min-height-touch` e `--ds-task-row-category-border-width`.
//     "Mesma anatomia" (`EXPERIENCE.md` L119) é literal — as duas linhas
//     precisam medir igual lado a lado. NENHUM token novo (AC7): `taskRow.hover`
//     é o PAPEL de cor `surface-subtle`, e papéis são emitidos como
//     `--ds-<papel>` (não existe `--ds-task-row-hover` em `shellCssVariables`);
//     consumir `var(--ds-surface-subtle)` É consumir `taskRow.hover`.
//
//   ▶ DIVERGÊNCIA DELIBERADA de posição: o chip Eisenhower fica INLINE ao lado
//     do título (mockup `key-recorrentes.html`, frame A `.t1`), enquanto na
//     `TaskRowBase` ele é a coluna 2 de uma grade de 5. O TRATAMENTO CROMÁTICO é
//     idêntico (`--ds-priority-*` sobre `--ds-on-primary`) — só o lugar muda.
//
//   ▶ REGRA DE OPACIDADE (lição cara da Story 14.5): a de-ênfase do item
//     inativo é aplicada SÓ a elementos com fundo OPACO próprio (os chips) —
//     NUNCA ao container, ao título ou à descrição. `opacity` num ancestral se
//     acumula, CSS não permite o filho desfazê-la via `calc(1/x)`, e texto
//     diluído reprova `color-contrast` do axe. A de-ênfase do TEXTO usa
//     `--ds-ink-muted` (nunca `--ds-ink-disabled`, que a 14.6 provou medir
//     ~2,6:1 sobre `--ds-surface-subtle` e reprovar AA).
//
// [Source: DESIGN.md L523 (tabela de componentes), L647-655 (#Recorrentes);
//  EXPERIENCE.md#Component Patterns L119, #State Patterns L410]
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react'
import { Box } from '@mui/material'

import { typography } from '../../../shared/design/tokens'
import type { TaskCategory, TaskEisenhower } from '../types'

/** Rótulo do chip Eisenhower por valor do enum combinado. `none`/`null` não
 * renderiza chip nenhum (ausência é o estado, não um chip "vazio"). */
const EISENHOWER_CHIP_LABEL: Record<Exclude<TaskEisenhower, 'none'>, string> = {
  ui: 'U+I',
  u: 'U',
  i: 'I',
}

export interface ItemRowBaseProps {
  title: string
  /** Linha secundária de contexto (em Recorrentes: `{Grupo} — {recurrenceText}`). */
  subline?: string
  /** Descrição opcional, truncada em UMA linha. */
  description?: string | null
  category?: TaskCategory | null
  eisenhower?: TaskEisenhower | null
  /**
   * Chip TEXTUAL de estado do domínio, ao lado do título — "inativo" em
   * Recorrentes. Renderizado só quando `deemphasized` também é verdadeiro:
   * o chip e a de-ênfase são a MESMA afirmação visual, e separá-los deixaria
   * um "menos ênfase sem motivo dito" (falha de a11y por cor-só).
   */
  statusChipLabel?: string
  /** Item de menor ênfase (inativo/arquivado). Ver a regra de opacidade acima. */
  deemphasized?: boolean
  /**
   * Ações da linha — em Recorrentes: `Editar` e `Ativar`/`Desativar` (mockup
   * frame A, `.acts`). O TÍTULO NÃO é um controle aqui, diferente da
   * `TaskRowBase`: o mockup dá o comando por botão nomeado, e ter as duas
   * affordances abrindo o mesmo detalhe criaria dois botões cujo nome acessível
   * começa por "Editar" na mesma linha — ambíguo por leitor de tela e violação
   * de strict mode em qualquer locator por nome. Se o Épico 15/18 precisar do
   * título acionável, a prop nasce lá, com consumidor de produção real (a 14.7
   * levou achado MÉDIO por artefato sem consumidor).
   */
  trailingSlot?: ReactNode
}

export function ItemRowBase({
  title,
  subline,
  description,
  category = null,
  eisenhower = null,
  statusChipLabel = 'inativo',
  deemphasized = false,
  trailingSlot,
}: ItemRowBaseProps) {
  const eisenhowerLabel =
    eisenhower && eisenhower !== 'none' ? EISENHOWER_CHIP_LABEL[eisenhower] : null

  return (
    <Box
      data-testid="item-row"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ds-space-2)',
        minHeight: 'var(--ds-task-row-min-height-pointer)',
        '@media (pointer: coarse)': { minHeight: 'var(--ds-task-row-min-height-touch)' },
        borderLeft: 'var(--ds-task-row-category-border-width) solid',
        borderLeftColor: category ? `var(--ds-category-${category})` : 'var(--ds-border)',
        pl: 'var(--ds-space-2)',
        pr: 'var(--ds-space-3)',
        py: 'var(--ds-space-1)',
        borderRadius: 'var(--ds-radius-sm)',
        // `taskRow.hover` = papel `surface-subtle` (ver cabeçalho).
        '&:hover': { backgroundColor: 'var(--ds-surface-subtle)' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Título + chips na MESMA linha (mockup frame A, `.t1`). */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)', minWidth: 0 }}>
          <Box
            sx={{
              ...typography.body,
              // Sem `opacity`: fundo transparente (ver regra no cabeçalho).
              color: 'var(--ds-ink)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Box>

          {eisenhowerLabel && (
            <Box
              data-testid="item-row-eisenhower"
              sx={{
                flex: '0 0 auto',
                borderRadius: 'var(--ds-radius-xs)',
                px: 'var(--ds-space-1)',
                ...typography.label,
                // Fundo OPACO próprio ⇒ pode receber a de-ênfase sem diluir texto
                // sobre fundo transparente.
                opacity: deemphasized ? 'var(--ds-task-row-terminal-opacity)' : 1,
                backgroundColor: `var(--ds-priority-${eisenhower})`,
                color: 'var(--ds-on-primary)',
              }}
            >
              {eisenhowerLabel}
            </Box>
          )}

          {deemphasized && (
            <Box
              data-testid="item-row-status-chip"
              sx={{
                flex: '0 0 auto',
                borderRadius: 'var(--ds-radius-xs)',
                px: 'var(--ds-space-1)',
                ...typography.label,
                opacity: 'var(--ds-task-row-terminal-opacity)',
                backgroundColor: 'var(--ds-surface-subtle)',
                border: '1px solid var(--ds-border)',
                color: 'var(--ds-ink-muted)',
              }}
            >
              {statusChipLabel}
            </Box>
          )}
        </Box>

        {subline && (
          <Box
            sx={{
              ...typography.meta,
              // De-ênfase de TEXTO por cor semântica, nunca por opacity.
              color: 'var(--ds-ink-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subline}
          </Box>
        )}

        {description && (
          <Box
            sx={{
              ...typography.meta,
              color: 'var(--ds-ink-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {description}
          </Box>
        )}
      </Box>

      {trailingSlot && (
        <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
          {trailingSlot}
        </Box>
      )}
    </Box>
  )
}
