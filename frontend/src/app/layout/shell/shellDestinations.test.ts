import { describe, it, expect } from 'vitest'

import { collections as registry } from '../../collections/registry'
import type { CollectionManifestEntry } from '../../collections/registry'
import { shellRoutes } from './shellRouting'
import {
  deriveBottomNavShortcuts,
  deriveShellNavItems,
  flattenDestinations,
  isDestinationActive,
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

  // DIR-12c (Story 16.1): "Hábitos com a collection desligada". O gateamento
  // futuro FILTRA o registro; a derivação precisa tolerar a ausência da entrada
  // sem deixar link fantasma, item disabled ou heading vazio para trás.
  it('sem a entrada `habits` no manifest, o destino Hábitos some da navegação inteira', () => {
    const semHabitos = registry.filter((c) => c.id !== 'habits')
    const items = deriveShellNavItems(semHabitos)
    const destinos = flattenDestinations(items)

    // Nenhum link fantasma e nenhuma rota de Hábitos alcançável pela nav.
    expect(destinos.map((d) => d.label)).not.toContain('Hábitos')
    expect(destinos.map((d) => d.path)).not.toContain('/habits')
    // Nenhum destino sem rótulo/rota (o "item disabled" que o gate proíbe).
    for (const destino of destinos) {
      expect(destino.label).toBeTruthy()
      expect(destino.path).toBeTruthy()
    }
    // Nenhum agrupador vazio (heading sem filhos).
    for (const item of items) {
      if (item.kind === 'group') expect(item.group.children.length).toBeGreaterThan(0)
    }
    // Núcleo e Planner seguem ÍNTEGROS.
    for (const label of ['Hoje', 'Esta Semana', 'Este Mês', 'Futuro', 'Recorrentes', 'Arquivo']) {
      expect(destinos.map((d) => d.label)).toContain(label)
    }
    // As demais collections continuam presentes — só Hábitos saiu.
    expect(destinos.map((d) => d.label)).toContain('Gratidão')
    expect(destinos.map((d) => d.label)).toContain('Métricas')
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

describe('shellDestinations — predicado único de destino ativo (Story 13.4 AC1)', () => {
  it('casa o path exato e o prefixo do PRÓPRIO destino, nunca um prefixo mais largo', () => {
    expect(isDestinationActive('/habits', '/habits')).toBe(true)
    expect(isDestinationActive('/habits/history', '/habits')).toBe(true)
    expect(isDestinationActive('/archive/weekly/2026-07-20', '/archive')).toBe(true)
    // Prefixo de SEGMENTO, não de string: `/habits-extra` não é filha de `/habits`.
    expect(isDestinationActive('/habits-extra', '/habits')).toBe(false)
    // `/planner/future` compartilha o segmento `/planner` com "Esta Semana" sem
    // ser rota dela — continua não ativando ninguém (regressão da 13.3).
    expect(isDestinationActive('/planner/future', '/planner/week')).toBe(false)
    expect(isDestinationActive('/today', '/archive')).toBe(false)
  })

  // Risco #1 da story: migrar a sidebar de match exato para prefixo poderia
  // produzir DOIS `aria-current` numa mesma superfície. A prova não é por
  // inspeção manual das rotas testadas à mão — é a invariante sobre TODAS as
  // rotas autenticadas do registro de coexistência.
  it('nenhuma rota autenticada casa mais de um destino da lista achatada', () => {
    const destinations = flatten()
    const sample: Record<string, string> = {
      ':date': '2026-07-01',
      ':weekStart': '2026-07-20',
      ':monthFirst': '2026-07-01',
    }
    const pathnames = shellRoutes.map(
      (entry) =>
        `/${entry.routeId
          .split('/')
          .map((segment) => (segment.startsWith(':') ? sample[segment] : segment))
          .join('/')}`,
    )
    // A amostra cobre todos os params declarados (senão o pathname viria com
    // `undefined` e o teste "passaria" medindo outra coisa).
    expect(pathnames.every((pathname) => !pathname.includes('undefined'))).toBe(true)

    for (const pathname of pathnames) {
      const matches = destinations
        .filter((dest) => isDestinationActive(pathname, dest.path))
        .map((dest) => dest.path)
      expect(
        matches.length,
        `rota ${pathname} casou ${matches.length} destinos: ${matches.join(', ')}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  it('nenhum destino da nav é prefixo de outro destino da nav', () => {
    const destinations = flatten()
    for (const dest of destinations) {
      const others = destinations.filter((other) => other.path !== dest.path)
      for (const other of others) {
        expect(
          isDestinationActive(other.path, dest.path),
          `${other.path} casa o destino ${dest.path}`,
        ).toBe(false)
      }
    }
  })

  // Contrato registrado, não bug: `/daily/:date` não tem destino próprio na nav
  // (o atalho é "Hoje" = `/today`), então nenhum destino fica ativo — no compact
  // o item Menu é que aparece selecionado.
  it('/daily/:date não ativa nenhum destino (contrato registrado)', () => {
    expect(flatten().filter((dest) => isDestinationActive('/daily/2026-07-01', dest.path))).toEqual(
      [],
    )
  })

  // As 9 rotas reais que, com match exato, deixavam a sidebar SEM destino ativo.
  it('as 9 rotas profundas ativam o destino PAI correto', () => {
    const destinations = flatten()
    const parentOf = (pathname: string) =>
      destinations.find((dest) => isDestinationActive(pathname, dest.path))?.label

    expect(parentOf('/habits/history')).toBe('Hábitos')
    expect(parentOf('/gratitude/history')).toBe('Gratidão')
    expect(parentOf('/health/metrics/history')).toBe('Métricas')
    expect(parentOf('/health/medications/history')).toBe('Medicamentos')
    expect(parentOf('/settings/habits')).toBe('Configurações')
    expect(parentOf('/settings/health-metrics')).toBe('Configurações')
    expect(parentOf('/settings/medications')).toBe('Configurações')
    expect(parentOf('/archive/weekly/2026-07-20')).toBe('Arquivo')
    expect(parentOf('/archive/monthly/2026-07-01')).toBe('Arquivo')
  })
})

describe('shellDestinations — derivação genérica de avulsos (Story 13.4 AC2)', () => {
  /** Collection avulsa INÉDITA: `id` fora do catálogo `navIcons`, sem `nav.group`. */
  const novaAvulsa: CollectionManifestEntry = {
    ...registry[0],
    id: 'journalling',
    name: 'Journalling',
    nav: { label: 'Journalling', order: 2 },
    routes: [{ ...registry[0].routes[0], path: 'journalling', title: 'Journalling' }],
  }

  // DoD estrutural do AD-17 tornado executável: uma collection avulsa nova
  // aparece na navegação SEM tocar no chrome (antes, `find(c => c.id ===
  // 'habits' | 'gratitude')` a deixava invisível em todas as superfícies).
  it('collection avulsa inédita aparece na lista achatada, na posição do nav.order', () => {
    const labels = flatten([...registry, novaAvulsa]).map((d) => d.label)
    expect(labels).toContain('Journalling')
    // order 2 ⇒ depois de Gratidão (order 1) e antes do núcleo final.
    expect(labels).toEqual([
      'Hoje',
      'Esta Semana',
      'Este Mês',
      'Futuro',
      'Recorrentes',
      'Hábitos',
      'Métricas',
      'Medicamentos',
      'Gratidão',
      'Journalling',
      'Brain Dump',
      'Arquivo',
      'Configurações',
    ])
  })

  it('nav.order da avulsa reposiciona a unidade inteira (antes de Hábitos e do grupo Saúde)', () => {
    const primeira: CollectionManifestEntry = {
      ...novaAvulsa,
      nav: { label: 'Journalling', order: -1 },
    }
    const labels = flatten([...registry, primeira]).map((d) => d.label)
    expect(labels.indexOf('Journalling')).toBe(labels.indexOf('Hábitos') - 1)
  })

  it('empate de nav.order é desempatado pela primeira ocorrência no registro', () => {
    // `habits` (avulsa, order 0) empata com `health-metrics` (grupo saúde,
    // order 0): o índice no array é o que mantém Hábitos antes de Saúde. Invertendo
    // a ordem do registro, a saída acompanha — a regra é determinística, não
    // dependente de `id` literal.
    const invertido = [...registry].reverse()
    const items = deriveShellNavItems(invertido)
    const labels = flattenDestinations(items).map((d) => d.label)
    expect(labels.indexOf('Métricas')).toBeLessThan(labels.indexOf('Hábitos'))
    // Dentro do grupo, `nav.order` continua mandando (Métricas antes de Medicamentos).
    expect(labels.indexOf('Métricas')).toBeLessThan(labels.indexOf('Medicamentos'))
  })

  it('grupo com chave fora do catálogo é derivado com o label degradado para a chave', () => {
    const grupoNovo: CollectionManifestEntry = {
      ...registry[0],
      id: 'reading',
      name: 'Leitura',
      nav: { label: 'Livros', group: 'biblioteca', order: 5 },
      routes: [{ ...registry[0].routes[0], path: 'reading', title: 'Leitura' }],
    }
    const items = deriveShellNavItems([...registry, grupoNovo])
    // `key` é tipada como `NavIconKey` (catálogo FECHADO) mas na prática vem do
    // registro como string aberta (`nav.group`) — daí o cast, e daí o guard de
    // ícone existir: a limitação de modelagem está registrada no checklist.
    const grupo = items.find((i) => i.kind === 'group' && (i.group.key as string) === 'biblioteca')
    expect(grupo && grupo.kind === 'group' && grupo.group.label).toBe('biblioteca')
    expect(grupo && grupo.kind === 'group' && grupo.group.children.map((c) => c.label)).toEqual([
      'Livros',
    ])
  })

  it('nenhum id de collection é hardcodado no CÓDIGO da derivação', () => {
    // O hardcode da SHELL-DEBT-04 era literalmente `c.id === 'habits'` /
    // `'gratitude'`; nenhum id de collection pode voltar ao módulo. O grep é
    // sobre CÓDIGO — os comentários citam os ids ao explicar o que saiu daqui
    // (mesma precaução do "checa o IMPORT, não menções em comentário" da 13.2).
    const codeOnly = shellDestinationsSource
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n')
    // O guard só vale se o filtro não engoliu o código: as funções continuam lá.
    expect(codeOnly).toMatch(/export function deriveShellNavItems/)
    for (const id of ['habits', 'gratitude', 'health-metrics', 'medications']) {
      expect(codeOnly, `id "${id}" hardcodado`).not.toMatch(new RegExp(`['"]${id}['"]`))
    }
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
