// Blindagem do MAPA de glifos (DW-60, achado P2 do ciclo de review 1).
//
// `GLYPH_LOADERS` é um `import.meta.glob` sobre um caminho de `node_modules`.
// Se esse caminho deixar de casar — hoisting do pacote para a raiz do monorepo,
// pacote movido, renomeado ou ausente — o glob resolve VAZIO e o componente
// passa a tratar TODA chave como órfã: coluna vazia, nenhum erro, suíte verde e
// nenhum pictograma em produção. Falha silenciosa, a mesma classe do guard
// assimétrico. Este teste é a cota inferior que a torna ruidosa.
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DomainIcon, GLYPH_CATALOG_SIZE, glyphLoadsStarted, prefetchGlyphs } from './DomainIcon'

describe('DW-60 — o catálogo de glifos do glob está populado', () => {
  it('o glob encontra o pacote instalado, e não um diretório vazio', () => {
    // Cota GENEROSA de propósito: a contagem exata (1512) já é gate de CI da
    // Story 16.2 (`scripts/gen_phosphor_catalog.mjs` regenera e `diff`a o
    // `phosphor_catalog.json`). Fixá-la aqui também faria todo bump do pacote
    // falhar em DOIS lugares, sem informação nova no segundo.
    expect(GLYPH_CATALOG_SIZE).toBeGreaterThan(1000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DW-65 — a pré-carga. Sem estes testes a `prefetchGlyphs` pode virar no-op sem
// nada ficar vermelho: o resultado dela é DESCARTADO nos call-sites, e a coluna
// vazia é estado válido, então nenhuma superfície reclamaria.
//
// O cache de `DomainIcon` é de MÓDULO (proposital: é o que faz tracker → grade →
// histórico compartilharem uma carga), então cada teste usa chaves PRÓPRIAS —
// reusar uma chave já aquecida por outro teste esconderia a regressão.
// ─────────────────────────────────────────────────────────────────────────────
describe('DW-65 — prefetchGlyphs', () => {
  afterEach(cleanup)

  it('chave inédita fica resolvida no cache ANTES de qualquer render', async () => {
    const started = await prefetchGlyphs(['acorn'])
    expect(started).toEqual(['acorn'])

    // Nenhum `await` entre o render e a asserção: o inicializador do `useState`
    // LÊ o cache, então o glifo tem de aparecer no PRIMEIRO commit. Se a
    // pré-carga não tivesse acontecido, a coluna estaria vazia aqui e só
    // resolveria depois do efeito.
    const { container } = render(createElement(DomainIcon, { iconKey: 'acorn' }))
    expect(container.querySelector('svg')).not.toBeNull()
  })

  // O DEDUPE é medido no LOADER, não no array devolvido: `resolveGlyph` devolve
  // uma Promise tanto para a chave que acabou de pedir quanto para a que já
  // estava em voo, então o array não distingue "deduplicou" de "pediu duas
  // vezes". `glyphLoadsStarted()` conta `import()`s de verdade.
  it('deduplica: N ocorrências da MESMA chave disparam UM import', async () => {
    const before = glyphLoadsStarted()
    const started = await prefetchGlyphs(['alien', 'alien', 'alien'])
    expect(started).toEqual(['alien'])
    expect(glyphLoadsStarted() - before).toBe(1)

    // E uma chave já resolvida não dispara import NOVO na segunda passada.
    const afterFirst = glyphLoadsStarted()
    expect(await prefetchGlyphs(['alien'])).toEqual([])
    expect(glyphLoadsStarted()).toBe(afterFirst)
  })

  it('deduplica CONCORRENTEMENTE: duas passadas simultâneas = UM import', async () => {
    const before = glyphLoadsStarted()
    // Aqui as DUAS chamadas reportam a chave como "não estava em cache" (a
    // segunda recebe a promise em voo) — e é exatamente por isso que a asserção
    // que importa é a do contador do loader.
    await Promise.all([prefetchGlyphs(['anchor-simple']), prefetchGlyphs(['anchor-simple'])])
    expect(glyphLoadsStarted() - before).toBe(1)
  })

  it('chave inválida, órfã ou nula NÃO vira import', async () => {
    const before = glyphLoadsStarted()
    const started = await prefetchGlyphs([
      null,
      undefined,
      '',
      'AddressBook',
      'nao_kebab',
      'glifo-que-saiu-numa-atualizacao',
    ])
    expect(started).toEqual([])
    // Nenhum `import()` foi disparado — a chave inválida nem chega ao loader.
    expect(glyphLoadsStarted()).toBe(before)
    // E continuam sendo AUSÊNCIA no render — nunca tofu, nunca erro.
    const { container } = render(createElement(DomainIcon, { iconKey: 'AddressBook' }))
    expect(container.querySelector('svg')).toBeNull()
  })

  it('uma passada aquece TODAS as chaves distintas do payload', async () => {
    const payload = ['airplane', 'alarm', 'airplane', null, 'anchor']
    expect([...(await prefetchGlyphs(payload))].sort()).toEqual(['airplane', 'alarm', 'anchor'])
    for (const key of ['airplane', 'alarm', 'anchor']) {
      const { container } = render(createElement(DomainIcon, { iconKey: key }))
      expect(container.querySelector('svg'), key).not.toBeNull()
      cleanup()
    }
  })
})
