// Padrão canônico: [escopo, entidade, discriminador, params?]
// discriminador = 'list' | 'detail' para coleções/items; operações agregadas usam nome descritivo (ex: 'count').
// Cada feature adiciona sua seção à medida que é implementada.
// Mutations invalidam por prefixo: queryClient.invalidateQueries({ queryKey: keys.habits.logs.all })
export const keys = {
  brainDump: {
    count: (userId: string) => ['brainDump', 'count', userId] as const,
  },
  // Adicionados nas stories:
  // habits: { logs: { ... } }  → Story 6.x
  // health: { logs: { ... } }  → Story 7.x
  // bujo:   { dailyLog: { ... } } → Story 3.x
} as const
