// Blindagem do MAPA de glifos (DW-60, achado P2 do ciclo de review 1).
//
// `GLYPH_LOADERS` é um `import.meta.glob` sobre um caminho de `node_modules`.
// Se esse caminho deixar de casar — hoisting do pacote para a raiz do monorepo,
// pacote movido, renomeado ou ausente — o glob resolve VAZIO e o componente
// passa a tratar TODA chave como órfã: coluna vazia, nenhum erro, suíte verde e
// nenhum pictograma em produção. Falha silenciosa, a mesma classe do guard
// assimétrico. Este teste é a cota inferior que a torna ruidosa.
import { describe, expect, it } from 'vitest'

import { GLYPH_CATALOG_SIZE } from './DomainIcon'

describe('DW-60 — o catálogo de glifos do glob está populado', () => {
  it('o glob encontra o pacote instalado, e não um diretório vazio', () => {
    // Cota GENEROSA de propósito: a contagem exata (1512) já é gate de CI da
    // Story 16.2 (`scripts/gen_phosphor_catalog.mjs` regenera e `diff`a o
    // `phosphor_catalog.json`). Fixá-la aqui também faria todo bump do pacote
    // falhar em DOIS lugares, sem informação nova no segundo.
    expect(GLYPH_CATALOG_SIZE).toBeGreaterThan(1000)
  })
})
