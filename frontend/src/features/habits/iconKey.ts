// ─────────────────────────────────────────────────────────────────────────────
// Conversão kebab-case ⇄ export PascalCase do Phosphor (DW-60).
//
//   ▶ MÓDULO PURO: sem React e sem `@phosphor-icons/react`. A conversão é
//     aritmética de string e precisa ser testável sem montar componente nem
//     carregar glifo — daí morar fora de `DomainIcon.tsx`.
//
//   ▶ A PERSISTÊNCIA E O WIRE SÃO KEBAB-CASE (`address-book`); o pacote exporta
//     PascalCase (`AddressBook`). A conversão é do FRONTEND (decisão da Story
//     16.2, documentada em `backend/core/phosphor.py`) e é BIJETIVA: medida
//     sobre os 1512 nomes de `dist/csr/*.es.js` — zero colisões, zero dígitos.
//
//   ▶ A FORMA É PARTE DO CONTRATO, não só a existência. `AddressBook` (o export
//     do pacote) chega pelo wire como chave INVÁLIDA de propósito — o servidor
//     a rejeita com 400 (`validate_icon_key`) e aqui ela é tratada como órfã,
//     nunca "consertada" por normalização. Espelha `_KEBAB_CASE` do backend.
//
// [Source: EXPERIENCE.md §Pictogramas de hábitos e saúde; spec DW-60 I/O Matrix]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grafia kebab-case estrita: minúsculas separadas por hífen simples.
 *
 * Espelho de `_KEBAB_CASE` (`backend/core/phosphor.py`). Rejeita PascalCase,
 * snake_case, hífen duplo, hífen nas pontas, dígito e string vazia. ` `
 * não entra na conta porque `[a-z]+` já não o aceita.
 */
const KEBAB_CASE = /^[a-z]+(?:-[a-z]+)*$/

/** `true` se `value` respeita a grafia kebab-case do catálogo Phosphor. */
export function isKebabIconKey(value: unknown): value is string {
  return typeof value === 'string' && KEBAB_CASE.test(value)
}

/**
 * `address-book` → `AddressBook`. Devolve `null` para qualquer coisa que não
 * seja kebab-case estrito — inclusive o próprio PascalCase de entrada.
 *
 * Devolver `null` em vez de lançar é deliberado: o consumidor é uma coluna de
 * pictograma cuja ausência é ESTADO VÁLIDO (gate 16.0, Q2), não erro.
 */
export function toPascalCase(value: unknown): string | null {
  if (!isKebabIconKey(value)) return null
  return value
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}
