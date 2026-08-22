// ─────────────────────────────────────────────────────────────────────────────
// Controle CANÔNICO de Categoria — radiogroup visual de swatches preenchidos.
//
//   ▶ EXTRAÍDO de `TaskDetailCard.tsx` na Story 14.8 (AC3), SEM mudança de
//     comportamento: o `DESIGN.md` L673 declara este tratamento único e válido
//     "para toda superfície com detalhe — tarefa e template recorrente". Duas
//     implementações do mesmo padrão divergiriam em silêncio na próxima
//     mudança de tratamento, então o card de template CONSOME este módulo em
//     vez de copiar os controles.
//   ▶ Consumidores: `TaskDetailCard.tsx` (14.5) e `TemplateDetailCard.tsx` (14.8).
//   ▶ Anatomia: "Sem categoria" + 6 swatches preenchidos, seleção por ANEL
//     `--ds-primary`, sem dropdown e sem checkmark.
//   ▶ ROVING TABINDEX com wrap nas duas pontas: sem ele só a opção JÁ
//     selecionada é alcançável por teclado (as demais ficam com `tabIndex -1`
//     e nenhum handler as move) — achado ALTO do code-review da Story 14.5.
//     Perder este handler na extração reproduz exatamente aquele achado.
//
// [Source: DESIGN.md#Task Row L671-681 — controles canônicos; UX-DR26]
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, type KeyboardEvent } from 'react'
import { Box } from '@mui/material'

import { typography } from '../../../shared/design/tokens'
import type { TaskCategory } from '../types'

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  teal: 'Teal',
  purple: 'Purple',
  pink: 'Pink',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
}
const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[]
/** `null` ("Sem categoria") + as 6 cores, na mesma ordem visual do radiogroup
 * — usada pela navegação por seta (roving tabindex). */
const CATEGORY_OPTIONS: (TaskCategory | null)[] = [null, ...CATEGORIES]

export interface CategorySwatchGroupProps {
  value: TaskCategory | null
  onChange: (next: TaskCategory | null) => void
  /** Superfície somente-leitura: nenhuma opção responde a clique nem a seta. */
  readonly?: boolean
  /** Rótulo VISÍVEL do campo. O nome ACESSÍVEL do radiogroup é sempre
   * "Categoria" (contrato de locator dos E2E/unit já existentes). */
  label?: string
}

export function CategorySwatchGroup({
  value,
  onChange,
  readonly = false,
  label = 'Categoria',
}: CategorySwatchGroupProps) {
  const categoryRefs = useRef<(HTMLElement | null)[]>([])

  // Roving tabindex do radiogroup: ArrowRight/Down avança, ArrowLeft/Up recua,
  // com wrap nas duas pontas.
  function handleCategoryKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (readonly) return
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!forward && !backward) return
    event.preventDefault()
    const currentIndex = CATEGORY_OPTIONS.indexOf(value)
    const delta = forward ? 1 : -1
    const nextIndex = (currentIndex + delta + CATEGORY_OPTIONS.length) % CATEGORY_OPTIONS.length
    onChange(CATEGORY_OPTIONS[nextIndex])
    // `tabIndex={-1}` continua focável via script (só sai da ordem de Tab) —
    // não é preciso esperar o re-render aplicar `tabIndex={0}` no próximo item.
    categoryRefs.current[nextIndex]?.focus()
  }

  return (
    <Box>
      <Box sx={{ ...typography.label, mb: 'var(--ds-space-1)' }}>{label}</Box>
      <Box
        role="radiogroup"
        aria-label="Categoria"
        onKeyDown={handleCategoryKeyDown}
        sx={{ display: 'flex', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}
      >
        <CategorySwatch
          ref={(el) => {
            categoryRefs.current[0] = el
          }}
          selected={value === null}
          label="Sem categoria"
          readonly={readonly}
          onSelect={() => onChange(null)}
        />
        {CATEGORIES.map((option, index) => (
          <CategorySwatch
            key={option}
            ref={(el) => {
              categoryRefs.current[index + 1] = el
            }}
            selected={value === option}
            label={`Categoria ${CATEGORY_LABEL[option]}`}
            color={`var(--ds-category-${option})`}
            readonly={readonly}
            onSelect={() => onChange(option)}
          />
        ))}
      </Box>
    </Box>
  )
}

function CategorySwatch({
  selected,
  label,
  color,
  readonly = false,
  onSelect,
  ref,
}: {
  selected: boolean
  label: string
  color?: string
  readonly?: boolean
  onSelect: () => void
  // React 19: `ref` é prop normal, sem `forwardRef` (Latest Tech Information).
  ref?: (el: HTMLElement | null) => void
}) {
  return (
    <Box
      ref={ref}
      role="radio"
      aria-checked={selected}
      aria-disabled={readonly}
      aria-label={label}
      tabIndex={readonly ? -1 : selected ? 0 : -1}
      onClick={readonly ? undefined : onSelect}
      onKeyDown={(event) => {
        if (readonly) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      sx={{
        width: '28px',
        height: '28px',
        borderRadius: 'var(--ds-radius-full)',
        cursor: readonly ? 'default' : 'pointer',
        backgroundColor: color ?? 'var(--ds-surface-subtle)',
        border: color ? 'none' : '1px solid var(--ds-border)',
        outline: selected ? '2px solid var(--ds-primary)' : 'none',
        outlineOffset: '2px',
      }}
    />
  )
}
