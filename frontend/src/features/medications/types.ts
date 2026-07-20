import type { components } from '../../api/types.gen'

// Story 8.1 — catálogo versionado de medicamentos (AD-07). O slot estável
// (`Medication`) tem dois eixos de versão independentes: substância
// (`MedicationSubstanceVersion`) e agenda por bloco (`MedicationScheduleVersion`).
export type Medication = components['schemas']['Medication']
export type MedicationSubstanceVersion =
  components['schemas']['MedicationSubstanceVersion']
export type MedicationScheduleVersion =
  components['schemas']['MedicationScheduleVersion']
export type TimeBlock = components['schemas']['TimeBlock']
export type Doctor = components['schemas']['Doctor']

// Componente de dose `[{label, amount, unit}]` — chaves de palavra única que NÃO são
// camelizadas na borda (§6.3). Derivado do array `dose` da versão de agenda.
export type DoseComponent = MedicationScheduleVersion['dose'][number]

// Story 8.2 — camada realizada por dia (AD-07 itens 7-11). O read-model da
// superfície diária: blocos agendados (com status derivado) + seção avulso/PRN.
export type MedicationDay = components['schemas']['MedicationDay']
export type MedicationDayBlock = components['schemas']['MedicationDayBlock']
export type MedicationDayEntry = components['schemas']['MedicationDayEntry']
