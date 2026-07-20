export {
  useMedicationsQuery,
  useDoctorsQuery,
  useTimeBlocksQuery,
  useCreateMedicationMutation,
  useUpdateMedicationTitleMutation,
  useAddSubstanceVersionMutation,
  useSetScheduleMutation,
  useSetMedicationActiveMutation,
  useCreateTimeBlockMutation,
  useUpdateTimeBlockMutation,
  useCreateDoctorMutation,
  useUpdateDoctorMutation,
  // Story 8.2 — superfície diária realizada.
  useMedicationDayQuery,
  useConfirmMedicationEntryMutation,
  useConfirmBlockMutation,
  useCreateAdHocEntryMutation,
  // Story 8.3 — correção retroativa de dose.
  useEditEntryDoseMutation,
} from './api'
export { MedicationsManager } from './components/MedicationsManager'
export { MedicationBlock } from './components/MedicationBlock'
export { MedicationDaySurface } from './components/MedicationDaySurface'
export { MedicationHistorySurface } from './components/MedicationHistorySurface'
export { deriveBlockStatus, deriveEntryStatus, doseSummary } from './dayModel'
export type {
  Medication,
  MedicationSubstanceVersion,
  MedicationScheduleVersion,
  TimeBlock,
  Doctor,
  DoseComponent,
  // Story 8.2 — read-model do dia.
  MedicationDay,
  MedicationDayBlock,
  MedicationDayEntry,
} from './types'
