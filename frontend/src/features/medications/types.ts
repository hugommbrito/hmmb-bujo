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
