// Padrão canônico: [escopo, entidade, discriminador, params?]
// discriminador = 'list' | 'detail' para coleções/items; operações agregadas usam nome descritivo (ex: 'count').
// Cada feature adiciona sua seção à medida que é implementada.
// Mutations invalidam por prefixo: queryClient.invalidateQueries({ queryKey: keys.habits.logs.all })
export const keys = {
  brainDump: {
    count: (userId: string) => ['brainDump', 'count', userId] as const,
    list: () => ['brainDump', 'list'] as const,
  },
  // Sem userId (diferente de brainDump.count): `useAuth().userId` já existe
  // desde a Story 5.2, mas as chaves `bujo.*` continuam deliberadamente sem
  // userId (YAGNI) — `AuthProvider.logout()` já limpa o cache inteiro na
  // troca de usuário, cobrindo o risco que o userId na chave mitigaria.
  bujo: {
    todayLog: (logDate?: string) => ['bujo', 'dailyLog', logDate ?? 'today'] as const,
    weeklyLog: (weekStart?: string) => ['bujo', 'weeklyLog', weekStart ?? 'current'] as const,
    monthlyLog: (monthFirst?: string) => ['bujo', 'monthlyLog', monthFirst ?? 'current'] as const,
    futureLog: () => ['bujo', 'futureLog', 'list'] as const,
    migrationQueue: () => ['bujo', 'migrationQueue', 'list'] as const,
    weeklyReviewQueue: () => ['bujo', 'weeklyReviewQueue', 'list'] as const,
    monthlyReviewQueue: () => ['bujo', 'monthlyReviewQueue', 'list'] as const,
    catchUpQueue: () => ['bujo', 'catchUpQueue', 'list'] as const,
    recurringTemplates: (params?: {
      active?: boolean
      recurrenceGroup?: string
      unplacedYear?: number
    }) => ['bujo', 'recurringTemplates', 'list', params ?? {}] as const,
    taskDensity: (monthFirst?: string) =>
      ['bujo', 'taskDensity', monthFirst ?? 'current'] as const,
    archive: () => ['bujo', 'archive', 'list'] as const,
  },
  // Sem userId (mesmo racional de bujo.*): logout limpa o cache inteiro.
  habits: {
    list: (params?: { includeInactive?: boolean }) =>
      ['habits', 'list', params ?? {}] as const,
    groups: () => ['habits', 'groups', 'list'] as const,
    day: (date?: string) => ['habits', 'day', date ?? 'today'] as const,
    // Story 6.3 — config de multiplicador por grupo. O estado de feriado vem no
    // habits.day(date) (via dayType), sem key nova.
    groupMultipliers: (groupId: string) =>
      ['habits', 'groupMultipliers', groupId] as const,
  },
  // Adicionados nas stories:
  // health: { logs: { ... } }  → Story 7.x
} as const
