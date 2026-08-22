import { describe, expect, it } from 'vitest'

// `?raw` (molde de `weekly/noLiteralTokens.test.ts`/`monthly/noLiteralTokens.test.ts`)
// — prova estrutural de que nenhum componente novo desta story escreve um
// literal que já tem token equivalente (`--ds-*`). O seletor de destino
// compartilhado (`DestinationPicker.tsx`, promovido a partir do Monthly) mora
// em `components/`, não em `components/migration/` — incluído aqui porque é
// código NOVO desta story, mesmo fora da pasta.
import migrationRitualSourcesSource from './migrationRitualSources.ts?raw'
import migrationSourceRailSource from './MigrationSourceRail.tsx?raw'
import migrationDecisionListSource from './MigrationDecisionList.tsx?raw'
import migrationContextRailSource from './MigrationContextRail.tsx?raw'
import migrationSummarySource from './MigrationSummary.tsx?raw'
import migrationRitualBannerSource from './MigrationRitualBanner.tsx?raw'
import destinationPickerSource from '../DestinationPicker.tsx?raw'

// Subconjunto COMPARTILHADO (entre superfícies) dos literais reservados a
// tokens já emitidos por `shared/design/tokens.ts` — `--ds-task-row-*`
// (36px/48px/3px) e `--ds-task-row-terminal-opacity` (0.58). As larguras de
// rail específicas de OUTRAS superfícies (240px/235px/315px/190px/268px/188px/
// 310px) não entram aqui: esta story REUSA `--ds-weekly-planning-*` direto
// (nenhuma var/literal nova de geometria de rail).
const FORBIDDEN_LITERALS = ['0.58', '36px', '48px', '3px']

const SOURCES: Record<string, string> = {
  'migrationRitualSources.ts': migrationRitualSourcesSource,
  'MigrationSourceRail.tsx': migrationSourceRailSource,
  'MigrationDecisionList.tsx': migrationDecisionListSource,
  'MigrationContextRail.tsx': migrationContextRailSource,
  'MigrationSummary.tsx': migrationSummarySource,
  'MigrationRitualBanner.tsx': migrationRitualBannerSource,
  'DestinationPicker.tsx': destinationPickerSource,
}

describe('AC8 — zero literal estrutural/cromático nos componentes novos da Migração (Story 14.9)', () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    it(`${name} não escreve nenhum dos literais reservados a tokens`, () => {
      for (const literal of FORBIDDEN_LITERALS) {
        const pattern = new RegExp(`\\b${literal.replace('.', '\\.')}\\b`)
        expect(source).not.toMatch(pattern)
      }
    })

    it(`${name} não escreve cor hexadecimal literal`, () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    })
  }
})
