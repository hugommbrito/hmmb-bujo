import type { components } from '../../api/types.gen'

// Tipos aliasados do contrato gerado (nunca ad-hoc). Story 9.1.
export type GratitudeDay = components['schemas']['GratitudeDay']
export type GratitudeEntry = components['schemas']['GratitudeEntry']
// Story 9.2 — read-model do mês: {month, days:[GratitudeDay]}.
export type GratitudeMonth = components['schemas']['GratitudeMonth']
