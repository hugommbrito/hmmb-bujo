import type { components } from '../../api/types.gen'

export type Habit = components['schemas']['Habit']
export type HabitGroup = components['schemas']['HabitGroup']
export type HabitVersion = components['schemas']['HabitVersion']
export type HabitType = components['schemas']['HabitTypeEnum']
// Story 6.2 — snapshot realizado do dia (tracker).
export type HabitDay = components['schemas']['HabitDay']
export type HabitDayEntry = components['schemas']['HabitDayEntry']
export type HabitDayGroup = components['schemas']['HabitDayGroup']
// Story 6.3 — multiplicador por tipo de dia + feriado.
export type DayType = components['schemas']['DayTypeEnum']
export type GroupMultipliers = components['schemas']['GroupMultipliers']
export type SetGroupMultipliers = components['schemas']['SetGroupMultipliers']
export type SetHoliday = components['schemas']['SetHoliday']
export type HolidayResult = components['schemas']['HolidayResult']
// Story 6.4 — histórico por data + série de evolução (read-only).
export type HabitHistoryRange = components['schemas']['HabitHistoryRange']
export type HabitHistoryDay = components['schemas']['HabitHistoryDay']
export type HabitSlim = components['schemas']['HabitSlim']
export type HabitSeries = components['schemas']['HabitSeries']
export type HabitSeriesPoint = components['schemas']['HabitSeriesPoint']
export type HabitVersionEvent = components['schemas']['HabitVersionEvent']
export type HabitChange = components['schemas']['HabitChange']
export type HabitDayType = components['schemas']['HabitDayType']
