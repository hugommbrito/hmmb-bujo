// ─────────────────────────────────────────────────────────────────────────────
// Catálogo ABERTO do Phosphor para NAVEGAR a lista no seletor de pictograma
// (DW-64) — o único lugar do repo que alcança o catálogo INTEIRO.
//
//   ▶ ALCANÇÁVEL SÓ POR `import()`. O `PictogramPicker` faz
//     `await import('../../phosphorCatalog')`, e é isso que faz o Vite isolar
//     este módulo — e o catálogo dentro dele — num chunk PRÓPRIO: 5,31 MB /
//     1,12 MB gzip, medido em build de produção. Baixado UMA vez, sobre uma ação
//     deliberada (abrir o seletor), e a partir daí qualquer tile é desenhado de
//     forma SÍNCRONA enquanto o usuário rola. Importar este arquivo
//     ESTATICAMENTE de qualquer lugar arrasta os 5 MB para o chunk do
//     importador — é o defeito que a Verification do spec caça.
//
//   ▶ DOIS MECANISMOS DE PROPÓSITO. `DomainIcon` RENDERIZA punhados de glifos
//     com `import.meta.glob` per-chave (+52 kB gzip na rota, ~4 kB por glifo em
//     uso) — ótimo para dezenas de hábitos, péssimo para rolar 1512 tiles, que
//     viraria 1512 requisições. Aqui o objetivo é o oposto: TODOS os componentes
//     em memória, de uma vez. Unificar exige medir de novo (spec §Design Notes)
//     — não trocar um pelo outro por simetria.
//
//   ▶ POR QUE UM ALIAS DE BUILD, E NÃO `import * as … from
//     '@phosphor-icons/react'`. O barrel ESM do pacote são 1512 re-exports dos
//     MESMOS `dist/csr/*.es.js` que o glob da DW-60 transforma em entradas
//     dinâmicas — e aí o catálogo ou polui o chunk de ENTRADA (1,08 MB → 6,16 MB)
//     ou estilhaça em ~1.489 chunks irmãos. O alias resolve para o bundle
//     autocontido que o pacote já publica: UM módulo, UM chunk, zero módulo
//     compartilhado com `dist/csr/*`. As duas medições e o racional completo
//     estão no bloco de comentário de `vite.config.ts`.
//
//   ▶ A LISTA DE NOMES VEM DE `dist/csr/*.es.js`, NÃO DOS EXPORTS DO BUNDLE.
//     Parece equivalente e não é: os exports `*Icon` do bundle são **1530**,
//     contra **1512** arquivos em `dist/csr/`. As 18 excedentes são ALIASES
//     LEGADOS sem arquivo próprio (`activity`, `archive-box`, `archive-tray`,
//     `caduceus`, `circle-wavy*`, `file-dotted`, `file-search`, `folder-dotted`,
//     `folder-notch*`, `folder-simple-dotted`, `lemniscate`, `text-bolder`) —
//     e elas DESENHAM. O usuário escolheria uma, confirmaria, e o PATCH/POST
//     voltaria 400 (`validate_icon_key` valida contra
//     `backend/habits/phosphor_catalog.json`, gerado de `dist/csr/`); e mesmo se
//     o servidor aceitasse, o `DomainIcon` — que resolve pelo `import.meta.glob`
//     de `dist/csr/` — a trataria como ÓRFÃ e a coluna ficaria vazia para
//     sempre. `dist/csr/` é a fonte de que o gerador do backend E o glob da
//     DW-60 derivam; usar a mesma aqui é o que alinha os três consumidores.
//     O glob abaixo é NÃO-eager: só as CHAVES do mapa são lidas, então nenhum
//     módulo de `dist/csr/` entra neste chunk.
//
//   ▶ A DIVERGÊNCIA NÃO É "IMPOSSÍVEL POR CONSTRUÇÃO" — é impossível DENTRO deste
//     módulo (um nome sem componente desenhável é descartado, nunca listado),
//     mas não ENTRE os três consumidores do catálogo (este seletor, o
//     `validate_icon_key` do servidor e o `DomainIcon`). O que amarra os três é o
//     teste de PARIDADE de `phosphorCatalog.test.ts`, que compara `names` com
//     `backend/habits/phosphor_catalog.json` por igualdade de CONJUNTOS. Sem ele
//     a deriva reaparece a cada bump do pacote.
//
//   ▶ O pacote publica `X` E `XIcon` para cada glifo (o primeiro está
//     `@deprecated` desde a 2.1.x). Preferimos `XIcon` e caímos em `X`, para não
//     quebrar numa atualização que remova o alias — mesma escolha do
//     `pickExport` do `DomainIcon`.
//
// [Source: EXPERIENCE.md §Pictogramas de hábitos e saúde (catálogo ABERTO);
//  gate 16.0 Q1; spec DW-64 Tasks 3-4 + §Design Notes + AC de bundle]
// ─────────────────────────────────────────────────────────────────────────────
import type { Icon } from '@phosphor-icons/react'
/**
 * O catálogo inteiro como UM módulo, lido por REFLEXÃO (nunca por export
 * nomeado) — é o que garante que a lista de nomes e os componentes desenháveis
 * venham da MESMA fonte. Ver `vite.config.ts` para o que o alias resolve.
 */
import * as phosphorBundle from 'phosphor-catalog-bundle'

import { toKebabCase, toPascalCase } from './iconKey'

/**
 * A LISTA de nomes: um mapa cujas CHAVES são os caminhos de `dist/csr/*.es.js`.
 * Não-eager de propósito — nenhum destes módulos é importado aqui; só os nomes
 * dos arquivos são lidos, exatamente como `DomainIcon.GLYPH_CATALOG_SIZE` faz.
 * É a MESMA fonte de `scripts/gen_phosphor_catalog.mjs` (backend) e do glob
 * per-chave da DW-60, e é isso que mantém os três consumidores alinhados.
 */
const CSR_GLYPH_FILES = import.meta.glob('/node_modules/@phosphor-icons/react/dist/csr/*.es.js')

const CSR_PREFIX = '/node_modules/@phosphor-icons/react/dist/csr/'
const CSR_SUFFIX = '.es.js'

export interface PhosphorCatalog {
  /** Todos os nomes de glifo em kebab-case, em ordem alfabética. */
  names: readonly string[]
  /** Componente do glifo, ou `null` para chave fora do catálogo. */
  get(kebab: string): Icon | null
}

let cached: PhosphorCatalog | null = null

/** Componente do glifo `pascal` no bundle, ou `null` se ele não o publica. */
function pickComponent(pascal: string): Icon | null {
  const bundle = phosphorBundle as Record<string, unknown>
  const candidate = bundle[`${pascal}Icon`] ?? bundle[pascal]
  return typeof candidate === 'function' || (typeof candidate === 'object' && candidate != null)
    ? (candidate as Icon)
    : null
}

function build(): PhosphorCatalog {
  const byKebab = new Map<string, Icon>()
  for (const path of Object.keys(CSR_GLYPH_FILES)) {
    const pascal = path.slice(CSR_PREFIX.length, -CSR_SUFFIX.length)
    const kebab = toKebabCase(pascal)
    // A ida E a volta: um nome cuja grafia não sobrevive ao round-trip produziria
    // chave que `DomainIcon` não resolve e que o servidor recusa com 400.
    if (kebab == null || toPascalCase(kebab) !== pascal) continue
    // Nome SEM componente desenhável não é oferecido: um tile vazio numa grade
    // cuja razão de existir é ser vista é pior que a escolha não existir. Se isto
    // descartar algo, o teste de PARIDADE fica vermelho — é o alarme, não o
    // silêncio.
    const component = pickComponent(pascal)
    if (component == null) continue
    byKebab.set(kebab, component)
  }
  const names = [...byKebab.keys()].sort()
  return {
    names,
    get: (kebab) => byKebab.get(kebab) ?? null,
  }
}

/**
 * Catálogo do pacote INSTALADO, construído uma vez e memoizado. Assíncrono por
 * contrato — o chamador já chega aqui por `import()`, e a assinatura mantém a
 * porta aberta para o índice ficar mais caro sem mudar call-site.
 */
export async function loadPhosphorCatalog(): Promise<PhosphorCatalog> {
  cached ??= build()
  return cached
}
