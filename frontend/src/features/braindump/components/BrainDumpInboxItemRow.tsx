// ─────────────────────────────────────────────────────────────────────────────
// Variante Brain Dump da `ItemRowBase` (Story 15.1 — M11; `DESIGN.md#Brain
// Dump (Inbox)` L671).
//
//   ▶ Sem categoria, sem Eisenhower, sem ícone de status — o item não tem
//     máquina de estados (borda esquerda cai no fallback neutro `--ds-border`
//     de `ItemRowBase`, já que `category` nunca é passado).
//   ▶ `subline` carrega a dica de destino ("Dica: Esta Semana") + a data de
//     captura ("23 jul.") NA MESMA linha — `ItemRowBase` não tem um slot de
//     chip inline independente do título (só o chip Eisenhower/status, que
//     não se aplica aqui) e o Épico 15 só autoriza estender o arquivo
//     compartilhado com `onActivate` (ver Code Map da spec 15.1) — acrescentar
//     um slot novo a um componente de raiz cross-epic (Recorrentes/14.8,
//     Settings/18) é decisão de arquitetura fora do escopo desta story.
//   ▶ `onActivate` (novo ponto de extensão) abre o sheet de edição do item —
//     em QUALQUER faixa: no compact ele reúne Mover/Descartar/campos
//     (trailingSlot ausente, a linha inteira é o alvo de 48px); no ponteiro
//     ele expõe só os 3 campos, porque `trailingSlot` já traz Mover/Descartar
//     como botões sempre visíveis (Design Notes da spec).
//   ▶ Descartar executa DIRETO, sem dialog, sem desfazer (paridade
//     deliberada com o legado) — o `onDiscard` do chamador é a mutation, sem
//     confirmação intermediária aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { Button } from '@mui/material'

import { ItemRowBase } from '../../bujo'
import { formatDayLabel, isoOf } from '../../../shared/date'
import { typography } from '../../../shared/design/tokens'
import type { BrainDumpItem, BrainDumpTargetLog } from '../types'

const TARGET_LOG_LABEL: Record<BrainDumpTargetLog, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  month: 'Este Mês',
  future: 'Futuro',
}

/** Combina a dica de destino e a data de captura numa única linha de
 * contexto (ver nota do cabeçalho sobre a ausência de um slot de chip
 * inline dedicado em `ItemRowBase`). Exportar uma função ao lado de um
 * componente dispara o aviso de fast-refresh (mesmo padrão de
 * `BrainDumpCaptureForm.tsx::TARGET_LOG_OPTIONS`). */
// eslint-disable-next-line react-refresh/only-export-components
export function brainDumpMetaLineOf(item: BrainDumpItem): string {
  // `createdAt` é um INSTANTE ISO completo (UTC), não um campo DATE — fatiar
  // os 10 primeiros chars e tratar como data local (achado de review) desloca
  // o dia em fusos negativos (ex. UTC-3) para capturas feitas à noite. `new
  // Date(createdAt)` interpreta o instante corretamente; `isoOf` converte de
  // volta para "AAAA-MM-DD" já em hora LOCAL antes de formatar.
  const date = formatDayLabel(isoOf(new Date(item.createdAt)), 'day-month')
  // `?? null` é defensivo (achado de review): `item.targetLog` é tipado como
  // o enum fechado, mas só o backend garante o valor em runtime — um
  // `target_log` fora das 4 chaves conhecidas (ex.: enum estendido no
  // servidor antes do cliente regenerar tipos) cai em `undefined` na
  // indexação, e sem o fallback renderizaria o literal "Dica: undefined" em
  // vez de simplesmente omitir o chip.
  const hint = item.targetLog ? (TARGET_LOG_LABEL[item.targetLog] ?? null) : null
  return hint ? `Dica: ${hint} · ${date}` : date
}

/** Cores EXPLÍCITAS do design system (achado real do axe em stories
 * anteriores): o `primary` do tema MUI é o teal de marca, abaixo de AA sobre
 * `--ds-surface`. */
const MOVE_ACTION_SX = {
  minWidth: 0,
  minHeight: 'var(--ds-touch-target-min)',
  color: 'var(--ds-primary)',
  '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
} as const

const DISCARD_ACTION_SX = {
  minWidth: 0,
  minHeight: 'var(--ds-touch-target-min)',
  color: 'var(--ds-danger)',
  '&.Mui-disabled': { color: 'var(--ds-ink-muted)' },
} as const

export interface BrainDumpInboxItemRowProps {
  item: BrainDumpItem
  /** Faixa compact (<768px): ações migram para o sheet, sem `trailingSlot`
   * (Design Notes da spec 15.1). */
  compact?: boolean
  /** Offline: ações de escrita indisponíveis, mas a linha continua legível e
   * `onActivate` continua abrindo o sheet (só leitura). */
  disabled?: boolean
  /** DELETE já em voo para ESTE item (achado de review): sem isto, um
   * duplo-clique em Descartar dispara duas requisições — a segunda 404 e
   * mostra um erro falso mesmo com o descarte já bem-sucedido. */
  discarding?: boolean
  onEdit: (item: BrainDumpItem) => void
  onMove: (item: BrainDumpItem) => void
  onDiscard: (item: BrainDumpItem) => void
}

export function BrainDumpInboxItemRow({
  item,
  compact = false,
  disabled = false,
  discarding = false,
  onEdit,
  onMove,
  onDiscard,
}: BrainDumpInboxItemRowProps) {
  return (
    <ItemRowBase
      title={item.title}
      subline={brainDumpMetaLineOf(item)}
      description={item.description}
      onActivate={() => onEdit(item)}
      trailingSlot={
        compact ? undefined : (
          <>
            <Button
              size="small"
              disabled={disabled}
              onClick={() => onMove(item)}
              aria-label={`Mover ${item.title}`}
              sx={{ ...typography.label, ...MOVE_ACTION_SX }}
            >
              Mover
            </Button>
            <Button
              size="small"
              disabled={disabled || discarding}
              onClick={() => onDiscard(item)}
              aria-label={`Descartar ${item.title}`}
              sx={{ ...typography.label, ...DISCARD_ACTION_SX }}
            >
              Descartar
            </Button>
          </>
        )
      }
    />
  )
}
