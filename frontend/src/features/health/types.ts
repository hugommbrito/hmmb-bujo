import type { components } from '../../api/types.gen'

// Story 7.1 — catálogo de definições de campos dinâmicos de saúde (AD-01).
export type HealthFieldDefinition = components['schemas']['HealthFieldDefinition']
export type HealthFieldType = components['schemas']['HealthFieldTypeEnum']

// Story 7.2 — log diário de valores (AD-01). `values` é um dict de **chave dinâmica**
// (UUID da definição → valor): a exceção de camelCase de §6.3/§7.1:892. O tipo do
// valor por campo é a união dos 5 field_types (integer/decimal → number;
// boolean → boolean; enum/text → string).
export type HealthValue = number | boolean | string
export type HealthValues = Record<string, HealthValue>

// Read-model do ritual matinal (ontem no topo, hoje abaixo) + a linha upsertada.
export type HealthDaily = components['schemas']['HealthDaily']
export type HealthDaySection = components['schemas']['HealthDaySection']
export type HealthLog = components['schemas']['HealthLog']

// Story 7.3 — histórico read-only em três visualizações (tabela + gráfico + dashboard).
// `HealthHistoryDay.values` reusa o mesmo dict opaco de chave dinâmica (UUID) de 7.2.
export type HealthHistory = components['schemas']['HealthHistory']
export type HealthHistoryDay = components['schemas']['HealthHistoryDay']
export type HealthPeriodSummary = components['schemas']['HealthPeriodSummary']
export type HealthFieldSeries = components['schemas']['HealthFieldSeries']
export type HealthSeriesPoint = components['schemas']['HealthSeriesPoint']
