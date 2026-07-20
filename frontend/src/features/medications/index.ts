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
} from './api'
export { MedicationsManager } from './components/MedicationsManager'
export { MedicationBlock } from './components/MedicationBlock'
export { MedicationDaySurface } from './components/MedicationDaySurface'
export { deriveBlockStatus, doseSummary } from './dayModel'
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
