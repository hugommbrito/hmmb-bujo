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
//   ▶ Pilha LIFO, MESMA chave (DW-18): `sessionStorage` guarda um array JSON
//     sob `STORAGE_KEY` — dois saltos consecutivos (A→B→C) antes de voltar do
//     primeiro (A→B) EMPILHAM em vez de se sobrescreverem (limitação conhecida
//     da versão de chave única, registrada em `deferred-work.md`). `write`
//     empilha, `read` espia o TOPO (sem remover), `clear` remove só o TOPO —
//     ler+limpar juntos (achado da review da Story 14.10) continua o
//     invariante, agora por ENTRADA, não pela chave inteira.
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

/** Lê a pilha bruta do `sessionStorage`. JSON inválido ou algo que não seja
 * um array de strings (ex.: valor legado da versão de chave única, antes da
 * DW-18) é tratado como pilha vazia — nunca lança. */
function readStack(): string[] {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

/** Grava a pilha; uma pilha vazia REMOVE a chave (nunca deixa `'[]'` parado
 * em `sessionStorage`, mesmo invariante de "sem entrada = chave ausente" da
 * versão anterior). */
function writeStack(stack: string[]): void {
  if (stack.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack))
}

/** Registra qual linha deve receber foco+destaque na PRÓXIMA vez que ela
 * existir no DOM — chamado pela página de ORIGEM antes de navegar para o
 * período de destino (guarda a si mesma, para quando o usuário voltar).
 * EMPILHA (DW-18): um segundo salto de linhagem antes do primeiro retornar
 * não sobrescreve a entrada anterior — ambas sobrevivem em `sessionStorage`. */
export function writeLineageReturn(taskId: string): void {
  const stack = readStack()
  stack.push(taskId)
  writeStack(stack)
}

/** Espia (sem remover) o TOPO da pilha — a entrada MAIS RECENTE. `null`
 * quando a pilha está vazia. */
export function readLineageReturn(): string | null {
  const stack = readStack()
  return stack.length > 0 ? stack[stack.length - 1] : null
}

/** Remove só o TOPO da pilha. Entradas mais antigas (saltos anteriores ainda
 * não consumidos) permanecem intactas. Chamar em pilha vazia é um no-op
 * seguro (nunca lança). */
export function clearLineageReturn(): void {
  const stack = readStack()
  stack.pop()
  writeStack(stack)
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
