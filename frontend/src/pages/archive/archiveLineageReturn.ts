// ─────────────────────────────────────────────────────────────────────────────
// Foco de retorno da linhagem cross-período (Story 14.10). Diferente do
// "farol" local de `TaskRowBase` (um `CustomEvent` síncrono entre linhas já
// montadas na MESMA árvore), aqui cada salto de linhagem TROCA DE ROTA — o
// componente de destino remonta do zero, então o farol local não alcança nada.
//
//   ▶ Foco de CHEGADA (origem → sucessor) viaja como `location.state` do
//     próprio `navigate()` — é imediato, não precisa sobreviver a um F5 nem ao
//     botão "Voltar" do navegador (só é relevante logo após o `navigate()`).
//   ▶ Foco de RETORNO (sucessor → volta pra origem) precisa sobreviver a
//     QUALQUER forma de voltar (link explícito ou botão nativo do navegador),
//     que NÃO passa pelo nosso código — por isso vive em `sessionStorage`.
//   ▶ Uma ÚNICA chave (não uma pilha): dois saltos consecutivos antes de
//     voltar do primeiro sobrescrevem a entrada do primeiro — limitação
//     conhecida e aceita (registrada em `deferred-work.md`); o escopo desta
//     story é origem → sucessor IMEDIATO, um salto de cada vez.
//   ▶ Melhor esforço: se a linha não existir mais quando o usuário voltar
//     (período mudou, tarefa não está mais visível), `focusTaskRow` só
//     devolve `false` — nada quebra, só o foco extra não acontece.
// ─────────────────────────────────────────────────────────────────────────────
import { LINEAGE_HIGHLIGHT_EVENT } from '../../features/bujo/components/TaskRowBase'
import type { MigrationTarget } from '../../features/bujo'

/** Rota de destino de uma seta de linhagem cross-período (AC2): Weekly/Monthly
 * sempre via Arquivo (nenhuma rota de detalhe fora dele), Daily via a rota já
 * existente `daily/:date` (fora do Code Map desta story — não é uma rota do
 * Arquivo, só o destino natural de uma migração "para hoje"). */
export function pathForMigrationTarget(target: MigrationTarget): string | null {
  if (target.type === 'weekly' && target.weekStart) return `/archive/weekly/${target.weekStart}`
  if (target.type === 'monthly' && target.monthFirst) return `/archive/monthly/${target.monthFirst}`
  if (target.type === 'daily' && target.logDate) return `/daily/${target.logDate}`
  return null
}

const STORAGE_KEY = 'bujo:archive-lineage-return-task-id'

/** Registra qual linha deve receber foco+destaque na PRÓXIMA vez que ela
 * existir no DOM — chamado pela página de ORIGEM antes de navegar para o
 * período de destino (guarda a si mesma, para quando o usuário voltar). */
export function writeLineageReturn(taskId: string): void {
  sessionStorage.setItem(STORAGE_KEY, taskId)
}

export function readLineageReturn(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function clearLineageReturn(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

/**
 * Foca e destaca (reusando o mesmo evento que `TaskRowBase` já escuta) a linha
 * de `taskId`, SE ela existir no DOM atual. Devolve `true` em sucesso.
 *
 * Quem chama `readLineageReturn()` deve limpar a entrada (`clearLineageReturn`)
 * IMEDIATAMENTE após lê-la, ANTES de tentar focar — nunca só no caminho de
 * sucesso (achado da review: se a linha de origem não existir mais quando o
 * usuário voltar, a tentativa falha e a entrada ficaria presa no
 * `sessionStorage` indefinidamente). É melhor esforço: perder uma tentativa de
 * foco é aceitável, vazar estado entre sessões não é.
 *
 * O foco vai para o PRIMEIRO botão da linha (coluna 1 — a seta de linhagem
 * quando a linha é a ORIGEM que disparou a navegação, ou o controle de status
 * quando a linha é o SUCESSOR mutável) quando existir; sem botão (linha
 * readonly sem seta, ex.: `role="img"`), cai no container da própria linha —
 * "foco na seta de origem" (AC2) e "foca a linha sucessora" (I/O matrix) são
 * o MESMO mecanismo, resolvido pelo que a linha alvo realmente contém.
 */
export function focusTaskRow(taskId: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`)
  if (!el) return false
  el.scrollIntoView({ block: 'center' })
  el.dispatchEvent(new CustomEvent(LINEAGE_HIGHLIGHT_EVENT))
  const focusTarget = el.querySelector<HTMLElement>('button') ?? el
  focusTarget.focus()
  return true
}
