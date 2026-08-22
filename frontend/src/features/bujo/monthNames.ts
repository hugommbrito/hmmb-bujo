export const MONTH_NAMES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Abreviação de 3 letras, minúsculas (Future Log: data PARCIAL — "— ago",
 * FR-1.2). Nasce aqui, ao lado do nome por extenso, e NÃO é importada do
 * `FuturePage.tsx` legado (que tem a própria cópia, desmontada da rota pela
 * Story 14.7 e removida no Épico 18). */
export const MONTH_ABBREV_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
