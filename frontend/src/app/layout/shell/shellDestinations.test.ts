import { describe, it, expect } from 'vitest'

import { collections as registry } from '../../collections/registry'
import type { CollectionManifestEntry } from '../../collections/registry'
import {
  deriveBottomNavShortcuts,
  deriveShellNavItems,
  flattenDestinations,
  type ShellDestination,
} from './shellDestinations'
// `?raw` (suportado por vite/client) traz o código-fonte como string — grep de
// dados puros, padrão `shellRouting.test.ts`.
import shellDestinationsSource from './shellDestinations.ts?raw'

const flatten = (collections?: CollectionManifestEntry[]) =>
  flattenDestinations(deriveShellNavItems(collections))

describe('shellDestinations — ordem canônica (AC2/AC3)', () => {
  it('lista achatada segue a ordem canônica dos spines (não a do mockup)', () => {
    expect(flatten().map((d) => d.label)).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Futuro',
      'Recorrentes',
      'Hábitos',
      'Métricas',
      'Medicamentos',
      'Gratidão',
      'Brain Dump',
      'Arquivo',
      'Configurações',
    ])
  })

  it('estrutura agrupada: Planner e Saúde são grupos; demais são destinos', () => {
    const items = deriveShellNavItems()
    const groups = items.filter((i) => i.kind === 'group')
    expect(groups.map((g) => (g.kind === 'group' ? g.group.label : ''))).toEqual([
      'Planner',
      'Saúde',
    ])
    // Saúde ordenado por nav.order: Métricas antes de Medicamentos.
    const saude = groups[1]
    expect(saude.kind === 'group' && saude.group.children.map((c) => c.label)).toEqual([
      'Métricas',
      'Medicamentos',
    ])
  })

  it('o destino brain-dump é o único portador do badge', () => {
    const withBadge = flatten().filter((d) => d.badge)
    expect(withBadge.map((d) => d.key)).toEqual(['brain-dump'])
  })
})

describe('shellDestinations — atalhos default da bottom nav (AC2)', () => {
  it('3 primeiros da ordem canônica: Hoje, Esta Semana, Este Mês', () => {
    const shortcuts = deriveBottomNavShortcuts(flatten())
    expect(shortcuts.map((d) => d.label)).toEqual(['Hoje', 'Esta Semana', 'Este Mês'])
    expect(shortcuts.map((d) => d.path)).toEqual(['/today', '/planner/week', '/planner/month'])
  })

  it('sem duplicatas: path repetido na lista não ocupa duas vagas', () => {
    const duplicated: ShellDestination[] = [
      { key: 'today', label: 'Hoje', path: '/today' },
      { key: 'today', label: 'Hoje (dup)', path: '/today' },
      { key: 'planner-week', label: 'Esta Semana', path: '/planner/week' },
      { key: 'planner-month', label: 'Este Mês', path: '/planner/month' },
    ]
    expect(deriveBottomNavShortcuts(duplicated).map((d) => d.path)).toEqual([
      '/today',
      '/planner/week',
      '/planner/month',
    ])
  })

  it('tolera menos de 3 destinos disponíveis por construção', () => {
    const two: ShellDestination[] = [
      { key: 'today', label: 'Hoje', path: '/today' },
      { key: 'archive', label: 'Arquivo', path: '/archive' },
    ]
    expect(deriveBottomNavShortcuts(two)).toHaveLength(2)
  })

  it('preferência salva ainda não existe: passar preferência explode (Story 18.1)', () => {
    // Assinatura pronta para a 18.1; a implementação é dela — falhar alto é
    // melhor do que ignorar silenciosamente uma preferência do usuário.
    expect(() => deriveBottomNavShortcuts(flatten(), ['/archive'])).toThrow(/18\.1/)
  })
})

describe('shellDestinations — nav mínima (AC2/AC3)', () => {
  it('zero collections: núcleo + Planner completos, sem Hábitos/Saúde/Gratidão', () => {
    const labels = flatten([]).map((d) => d.label)
    expect(labels).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Futuro',
      'Recorrentes',
      'Brain Dump',
      'Arquivo',
      'Configurações',
    ])
    // Os atalhos default não mudam (os 3 primeiros são núcleo).
    expect(deriveBottomNavShortcuts(flatten([])).map((d) => d.label)).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
    ])
  })

  it('uma collection avulsa: só ela aparece, sem grupo Saúde', () => {
    const onlyHabits = registry.filter((c) => c.id === 'habits')
    const items = deriveShellNavItems(onlyHabits)
    expect(items.filter((i) => i.kind === 'group').map((i) => i.kind === 'group' && i.group.label)).toEqual([
      'Planner',
    ])
    expect(flattenDestinations(items).map((d) => d.label)).toContain('Hábitos')
    expect(flattenDestinations(items).map((d) => d.label)).not.toContain('Gratidão')
  })

  it('grupo Saúde só existe com ≥1 filho e ordena por nav.order', () => {
    const onlyMetrics = registry.filter((c) => c.id === 'health-metrics')
    const items = deriveShellNavItems(onlyMetrics)
    const saude = items.find((i) => i.kind === 'group' && i.group.key === 'saude')
    expect(saude && saude.kind === 'group' && saude.group.children.map((c) => c.label)).toEqual([
      'Métricas',
    ])

    const noHealth = registry.filter((c) => c.nav.group !== 'saude')
    expect(
      deriveShellNavItems(noHealth).find((i) => i.kind === 'group' && i.group.key === 'saude'),
    ).toBeUndefined()
  })
})

describe('shellDestinations — dados puros (AC1)', () => {
  it('sem React, sem hooks, sem Query, sem env (padrão shellRouting)', () => {
    const source = shellDestinationsSource
    expect(source).not.toMatch(/@tanstack\/react-query/)
    expect(source).not.toMatch(/\buse[A-Z]\w*\(/)
    expect(source).not.toMatch(/import\.meta\.env/)
    expect(source).not.toMatch(/from ['"]react['"]/)
    expect(source).not.toMatch(/from\s+['"]@mui\/icons-material/)
  })
})
