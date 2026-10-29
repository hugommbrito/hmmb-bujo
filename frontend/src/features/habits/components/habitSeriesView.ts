// ─────────────────────────────────────────────────────────────────────────────
// Visões do gráfico de evolução (Story 16.1). Módulo SEM componentes: o rótulo
// é consumido pelo select da aba Histórico E pelo resumo do gráfico, e manter a
// constante junto do componente quebraria o Fast Refresh.
//
//   ▶ As TRÊS visões operam sobre o payload que a superfície JÁ busca — a série
//     (`value`, `effectiveWeight`) e as linhas do histórico (`metaAtTime`,
//     `bonusAtTime`, congelados pelo servidor). Nenhuma exige endpoint novo.
// ─────────────────────────────────────────────────────────────────────────────

/** `value` é o comportamento histórico da 6.4 e segue sendo o default. */
export type HabitSeriesView = 'value' | 'metaPercent' | 'contribution'

export const HABIT_SERIES_VIEW_LABEL: Record<HabitSeriesView, string> = {
  value: 'Valor diário',
  metaPercent: '% da meta',
  contribution: 'Contribuição na completude',
}
