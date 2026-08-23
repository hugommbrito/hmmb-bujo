// ─────────────────────────────────────────────────────────────────────────────
// Domain Icon (DW-60) — `{components.domain-icon}`: o pictograma Phosphor de um
// hábito, resolvido pelo NOME DO GLIFO (`iconKey`).
//
//   ▶ AUSÊNCIA É ESTADO VÁLIDO, NUNCA ERRO VISUAL. Chave nula, malformada
//     (PascalCase, snake_case…) ou ÓRFÃ (glifo que saiu numa atualização do
//     Phosphor) ⇒ o componente devolve `null` e a coluna fica VAZIA. Nada de
//     tofu, quadrado, placeholder ou glifo de erro (gate 16.0, Q2). Molde exato
//     de `navIconFor` (`app/layout/shell/navIcons.tsx:119-123`), que já degrada
//     sem ícone quando a chave não está no catálogo curado.
//
//   ▶ RESOLUÇÃO POR CHAVE USADA, NÃO POR CATÁLOGO. O peso do Phosphor está em
//     `dist/defs/` (13 MB, ~4 kB por glifo): um import estático do barrel leva
//     6,9 MB (1,14 MB gzip) para o chunk que o alcança — medido com build real.
//     Um usuário tem dezenas de hábitos, não 1512, então `import.meta.glob`
//     (lazy, sem `eager`) emite um chunk POR GLIFO e a rota busca apenas os que
//     os hábitos do usuário realmente usam. `import()` com template literal de
//     specifier BARE (`@phosphor-icons/react/dist/csr/${x}.es.js`) NÃO serve:
//     o Rollup não o resolve e o deixa cru no bundle — quebra em produção
//     (medido). O chunk lazy do catálogo INTEIRO, para NAVEGAR a lista no
//     seletor, é da DW-64.
//
//   ▶ SEM ESTADO DE LOADING. A coluna vazia já é o estado válido entregue pela
//     16.1 e é visualmente idêntica ao espaço que o glifo vai ocupar; então
//     "ainda não resolveu" e "não tem glifo" compartilham a mesma renderização
//     — sem skeleton, sem piscada, sem CLS. O cache de módulo faz a segunda
//     ocorrência da MESMA chave (tracker → grade → histórico) renderizar
//     síncrona.
//
//   ▶ DECORATIVO onde há label visível: `aria-hidden` por padrão e nenhum nome
//     acessível duplicado. `currentColor` + weight `regular`: a tinta vem por
//     HERANÇA do estado da linha — nunca cor própria, nunca cor que varie com o
//     número (proibição de celebração).
//
//   ▶ A MEDIDA VEM DE `var(--ds-domain-icon-size-default|compact)` via `style`,
//     não da prop `size` do Phosphor: `size` vira ATRIBUTO `width`/`height` do
//     SVG, que não aceita `var()`. O CSS sobrepõe o atributo, então o `1em` do
//     `IconContext` nunca chega a valer.
//
// [Source: EXPERIENCE.md §Pictogramas de hábitos e saúde; DESIGN.md
//  {components.domain-icon}; spec DW-60 Code Map + Design Notes]
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type CSSProperties } from 'react'
import type { Icon } from '@phosphor-icons/react'

import { toPascalCase } from '../../iconKey'

/**
 * Loaders LAZY, um por glifo do pacote instalado. Sem `eager`: o valor é a
 * função de import, e nenhum `dist/defs/*` entra no chunk da rota — cada glifo
 * é buscado só quando uma chave o pede.
 *
 * A CHAVE do mapa é o caminho absoluto do arquivo (contrato do
 * `import.meta.glob`), então a existência no catálogo é uma consulta ao próprio
 * pacote — não a uma lista que poderia divergir dele.
 */
const GLYPH_LOADERS = import.meta.glob<Record<string, unknown>>(
  '/node_modules/@phosphor-icons/react/dist/csr/*.es.js',
)

const CSR_PREFIX = '/node_modules/@phosphor-icons/react/dist/csr/'

/**
 * Quantos glifos o glob encontrou. Existe SÓ para ser asserido em teste.
 *
 * Um mapa VAZIO é indistinguível do estado válido de ausência: se o layout de
 * `node_modules` mudar (hoisting para a raiz, pacote movido/renomeado), o glob
 * casa zero arquivos, TODA chave cai como órfã e a coluna fica vazia em
 * silêncio — suíte verde, zero erro, pictograma nenhum em produção. É a mesma
 * classe de falha silenciosa do guard assimétrico, então a cota inferior é
 * asserida em `DomainIcon.test.ts`.
 *
 * Exportamos o NÚMERO, não o mapa: o teste só precisa saber que está populado,
 * e expor os loaders convidaria a burlar a resolução por chave.
 */
export const GLYPH_CATALOG_SIZE = Object.keys(GLYPH_LOADERS).length

/**
 * Cache por chave. `undefined` = nunca pedida; `null` = resolvida como AUSENTE
 * (órfã, malformada ou export inesperado) — o `null` é memoizado de propósito,
 * para não reimportar em cada render de uma chave que já se sabe sem glifo.
 */
const resolved = new Map<string, Icon | null>()
/** Imports em voo, para que N linhas com a MESMA chave façam UM import. */
const pending = new Map<string, Promise<Icon | null>>()

/**
 * Nome do export do componente no módulo `csr`. O pacote publica os dois
 * (`Barbell` está `@deprecated` em favor de `BarbellIcon`); preferimos o novo e
 * caímos no antigo, para não quebrar numa atualização que remova o alias.
 */
function pickExport(mod: Record<string, unknown>, pascal: string): Icon | null {
  const candidate = mod[`${pascal}Icon`] ?? mod[pascal]
  return typeof candidate === 'function' || typeof candidate === 'object'
    ? (candidate as Icon)
    : null
}

/**
 * Resolve o componente do glifo de uma chave kebab-case.
 *
 * Nunca lança e nunca loga: chave órfã é fluxo NORMAL (o glifo pode ter saído
 * numa atualização do Phosphor), não incidente. Um `console.error` aqui
 * poluiria a suíte — e vários testes desta superfície asseram console limpo.
 */
function resolveGlyph(iconKey: string): Icon | null | Promise<Icon | null> {
  const cached = resolved.get(iconKey)
  if (cached !== undefined) return cached

  const pascal = toPascalCase(iconKey)
  if (pascal == null) {
    resolved.set(iconKey, null)
    return null
  }

  const loader = GLYPH_LOADERS[`${CSR_PREFIX}${pascal}.es.js`]
  if (loader == null) {
    // Chave ÓRFÃ: bem formada, mas sem glifo na versão instalada.
    resolved.set(iconKey, null)
    return null
  }

  const inFlight =
    pending.get(iconKey) ??
    loader()
      .then((mod) => {
        const component = pickExport(mod, pascal)
        resolved.set(iconKey, component)
        return component
      })
      .catch(() => {
        // Falha de rede no chunk do glifo degrada para ausência — a coluna
        // vazia é o estado válido, e a linha inteira não pode cair por isso.
        resolved.set(iconKey, null)
        return null
      })
      .finally(() => {
        pending.delete(iconKey)
      })
  pending.set(iconKey, inFlight)
  return inFlight
}

export type DomainIconSize = 'default' | 'compact'

const SIZE_VAR: Record<DomainIconSize, string> = {
  default: 'var(--ds-domain-icon-size-default)',
  compact: 'var(--ds-domain-icon-size-compact)',
}

export interface DomainIconProps {
  /** Nome do glifo em kebab-case. Nulo/órfão/malformado ⇒ nada renderizado. */
  iconKey?: string | null
  /** `default` = coluna do tracker; `compact` = grade e histórico. */
  size?: DomainIconSize
  /**
   * Nome acessível para apresentação SÓ por ícone. Ausente (o caso desta spec,
   * onde o label do hábito está sempre visível) ⇒ `aria-hidden`, sem nome
   * duplicado.
   */
  label?: string
}

export function DomainIcon({ iconKey, size = 'default', label }: DomainIconProps) {
  const key = iconKey ?? null
  // O estado guarda a CHAVE junto do glifo, para que trocar `iconKey` nunca
  // renda o glifo ANTIGO no render que precede o effect — pictograma errado por
  // um frame é pior que a coluna vazia, que é o estado válido. É defesa que os
  // testes NÃO conseguem observar (o `act` do RTL libera o effect junto com o
  // render), então o teste de troca de chave prova o resultado — a coluna acaba
  // com o glifo da chave NOVA — e não a ausência do frame intermediário.
  //
  // O inicializador só LÊ o cache: a segunda ocorrência da mesma chave
  // (tracker → grade → histórico) já rende síncrona, sem piscada. Disparar o
  // import daqui seria efeito colateral em render; quem o dispara é o effect.
  const [state, setState] = useState<{ key: string | null; glyph: Icon | null }>(() => ({
    key,
    glyph: key == null ? null : (resolved.get(key) ?? null),
  }))

  useEffect(() => {
    if (key == null) {
      setState({ key, glyph: null })
      return
    }
    const outcome = resolveGlyph(key)
    if (!(outcome instanceof Promise)) {
      setState({ key, glyph: outcome })
      return
    }
    // Ainda resolvendo: a coluna fica VAZIA (nunca placeholder) até chegar.
    setState((current) => (current.key === key ? current : { key, glyph: null }))
    let alive = true
    void outcome.then((glyph) => {
      if (alive) setState({ key, glyph })
    })
    return () => {
      alive = false
    }
  }, [key])

  const Glyph = state.key === key ? state.glyph : null
  if (Glyph == null) return null

  const style: CSSProperties = { width: SIZE_VAR[size], height: SIZE_VAR[size], flex: '0 0 auto' }
  return label == null ? (
    <Glyph aria-hidden weight="regular" color="currentColor" style={style} />
  ) : (
    <Glyph role="img" aria-label={label} weight="regular" color="currentColor" style={style} />
  )
}
