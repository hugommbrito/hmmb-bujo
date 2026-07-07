// Padrão canônico: [escopo, entidade, discriminador, params?]
// discriminador = 'list' | 'detail' para coleções/items; operações agregadas usam nome descritivo (ex: 'count').
// Cada feature adiciona sua seção à medida que é implementada.
// Mutations invalidam por prefixo: queryClient.invalidateQueries({ queryKey: keys.habits.logs.all })
export const keys = {
  brainDump: {
    count: (userId: string) => ['brainDump', 'count', userId] as const,
  },
  // Sem userId (diferente de brainDump.count): não há hoje nenhum acessor de
  // userId no frontend (AuthContext não decodifica o JWT) — ver Dev Notes da
  // Story 3.2. `AuthProvider.logout()` já limpa o cache inteiro na troca de
  // usuário, cobrindo o risco que o userId na chave mitigaria.
  bujo: {
    todayLog: () => ['bujo', 'dailyLog', 'today'] as const,
  },
  // Adicionados nas stories:
  // habits: { logs: { ... } }  → Story 6.x
  // health: { logs: { ... } }  → Story 7.x
} as const
