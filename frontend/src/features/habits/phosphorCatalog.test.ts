// Blindagem do CATÁLOGO ABERTO (DW-64) — o pareado do `DomainIcon.test.ts`.
//
// `loadPhosphorCatalog` deriva nomes e componentes dos exports `*Icon` do pacote.
// Se esse formato mudar — sufixo renomeado, exports movidos para um subcaminho,
// pacote ausente — o mapa sai VAZIO e a grade do seletor abre em branco: nenhum
// erro, suíte verde, seletor inútil em produção. É a mesma classe de falha
// silenciosa do achado P2 da DW-60, então a cota inferior é asserida aqui.
//
// O catálogo REAL é importado de propósito: um mock provaria só o mock.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { isKebabIconKey } from './iconKey'
import { loadPhosphorCatalog } from './phosphorCatalog'

describe('DW-64 — o catálogo aberto do Phosphor', () => {
  it('encontra os glifos do pacote instalado, na ordem de milhar', async () => {
    const catalog = await loadPhosphorCatalog()
    // Cota GENEROSA de propósito: a contagem exata (1512) já é gate de CI da
    // Story 16.2 (`scripts/gen_phosphor_catalog.mjs`). Fixá-la aqui faria todo
    // bump do pacote falhar em dois lugares, sem informação nova no segundo.
    expect(catalog.names.length).toBeGreaterThan(1000)
  })

  it('todo nome é kebab-case e a lista sai ordenada', async () => {
    const catalog = await loadPhosphorCatalog()
    for (const name of catalog.names) {
      expect(isKebabIconKey(name), name).toBe(true)
    }
    expect([...catalog.names].sort()).toEqual([...catalog.names])
    // Sem duplicata: nome duplicado viraria `key` repetida na grade.
    expect(new Set(catalog.names).size).toBe(catalog.names.length)
  })

  it('`get` devolve um componente RENDERIZÁVEL para uma chave do catálogo', async () => {
    const catalog = await loadPhosphorCatalog()
    expect(catalog.names).toContain('barbell')
    const Glyph = catalog.get('barbell')
    expect(Glyph).not.toBeNull()
    // Renderizável é o que importa: um mapa com valores que não são componente
    // deixaria a grade vazia do mesmo jeito que um mapa vazio.
    const { container } = render(
      createElement(Glyph!, { 'aria-hidden': true, weight: 'regular', color: 'currentColor' }),
    )
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('todo nome listado é desenhável — a grade nunca oferece o que não sabe desenhar', async () => {
    const catalog = await loadPhosphorCatalog()
    for (const name of catalog.names) {
      expect(catalog.get(name), name).not.toBeNull()
    }
  })

  it('chave órfã e chave malformada devolvem null (sem tofu, sem lançar)', async () => {
    const catalog = await loadPhosphorCatalog()
    expect(catalog.get('glifo-que-saiu')).toBeNull()
    expect(catalog.get('Barbell')).toBeNull()
    expect(catalog.get('')).toBeNull()
  })

  it('os exports que NÃO são glifo ficam fora do catálogo', async () => {
    const catalog = await loadPhosphorCatalog()
    // `IconContext`, `IconBase` e o namespace `SSR` são infraestrutura do
    // pacote — listá-los ofereceria escolha que o servidor rejeita com 400.
    expect(catalog.names).not.toContain('icon-context')
    expect(catalog.names).not.toContain('icon-base')
    expect(catalog.names).not.toContain('ssr')
    expect(catalog.names).not.toContain('')
  })

  it('memoiza: a segunda carga devolve a MESMA instância', async () => {
    const first = await loadPhosphorCatalog()
    const second = await loadPhosphorCatalog()
    expect(second).toBe(first)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PARIDADE com o servidor — o teste que amarra OFERTA a ACEITAÇÃO.
//
// Todos os testes acima aprovam uma chave que o servidor recusa: os 18 aliases
// legados do bundle (`archive-box`, `folder-notch`, `circle-wavy`, `lemniscate`…)
// são kebab-case, únicos, ordenados E desenháveis. O que os reprova é ISTO: a
// comparação com `backend/habits/phosphor_catalog.json`, que é literalmente a
// fonte de verdade de `validate_icon_key`. Sem esta asserção, um bump do pacote
// reintroduz a deriva em silêncio e o usuário só descobre no 400 do "Salvar".
//
// O JSON é lido do arquivo do BACKEND — nunca copiado para o frontend, porque
// duas cópias divergem e a divergência é exatamente o que este teste existe para
// pegar. `node:fs` e não `?raw`: o arquivo mora FORA da raiz do Vite
// (`frontend/`), então nenhum import dele resolve; `readFileSync` não passa pelo
// bundler. O cwd do Vitest é `frontend/`, daí o `../`.
// ─────────────────────────────────────────────────────────────────────────────
const BACKEND_CATALOG_PATH = '../backend/habits/phosphor_catalog.json'

describe('DW-64 — paridade entre o catálogo do seletor e o do servidor', () => {
  const backend = JSON.parse(readFileSync(BACKEND_CATALOG_PATH, 'utf8')) as {
    package: string
    version: string
    count: number
    names: string[]
  }

  it('o JSON do servidor é o do MESMO pacote instalado (senão a paridade é vácua)', () => {
    expect(backend.package).toBe('@phosphor-icons/react')
    expect(backend.names).toHaveLength(backend.count)
  })

  it('os dois conjuntos são IGUAIS — nem oferta a mais, nem a menos', async () => {
    const catalog = await loadPhosphorCatalog()
    const oferecidas = new Set(catalog.names)
    const aceitas = new Set(backend.names)

    // Diferenças NOMEADAS: "size mismatch" não diz qual chave derivou.
    const soNoSeletor = [...oferecidas].filter((name) => !aceitas.has(name))
    const soNoServidor = [...aceitas].filter((name) => !oferecidas.has(name))
    expect(soNoSeletor, 'o seletor oferece chave que o servidor recusa com 400').toEqual([])
    expect(soNoServidor, 'o servidor aceita chave que o seletor não oferece').toEqual([])
    expect(oferecidas.size).toBe(aceitas.size)
  })

  it('o teste de paridade NÃO é vácuo: um alias legado do bundle seria pego', async () => {
    // `archive-box` é um dos 18 aliases que o bundle publica e `dist/csr/` não
    // tem. Se ele voltar à lista, a asserção acima reprova — esta prova que o
    // mecanismo enxerga exatamente esse caso.
    const catalog = await loadPhosphorCatalog()
    expect(backend.names).not.toContain('archive-box')
    expect(catalog.names).not.toContain('archive-box')
    expect(catalog.names).not.toContain('folder-notch')
    expect(catalog.names).not.toContain('circle-wavy')
    expect(catalog.names).not.toContain('lemniscate')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Guard de IMPORT ESTÁTICO — o desenho inteiro depende dele.
//
// Se qualquer arquivo de `src/` passar a importar `phosphorCatalog`
// ESTATICAMENTE, os 5 MB do catálogo entram no chunk desse importador; se esse
// importador for alcançável da entrada, o chunk de entrada multiplica por ~4,7
// (medido). E nada mais pega: typecheck, lint, build, Vitest e o E2E continuam
// todos verdes. Este guard é a única barreira.
//
// `import type` é permitido (é erasable, não emite import nenhum) e
// `await import(...)` é o mecanismo CORRETO — nenhum dos dois casa o padrão.
// ─────────────────────────────────────────────────────────────────────────────
const SRC_SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** `import …/export … from '…phosphorCatalog'` que NÃO seja `import type`. */
const STATIC_PHOSPHOR_CATALOG_IMPORT =
  /(?:^|\n)[ \t]*(?:import|export)(?![ \t]+type[ \t])[^;\n]*?\bfrom[ \t]*['"][^'"]*phosphorCatalog['"]/

describe('DW-64 — o catálogo é alcançável SÓ por import()', () => {
  it('nenhum módulo de produção importa `phosphorCatalog` estaticamente', () => {
    const violations = Object.entries(SRC_SOURCES)
      .filter(([path]) => !path.endsWith('phosphorCatalog.ts') && !/\.test\.tsx?$/.test(path))
      .filter(([, source]) => STATIC_PHOSPHOR_CATALOG_IMPORT.test(source))
      .map(([path]) => path)
    expect(violations).toEqual([])
  })

  it('o guard vê `src/` de verdade (não um glob vazio) e não é vacuoso', () => {
    // Um glob que não casa nada aprovaria qualquer violação em silêncio.
    expect(Object.keys(SRC_SOURCES).length).toBeGreaterThan(100)
    expect(Object.keys(SRC_SOURCES)).toContain(
      '/src/features/habits/components/record/PictogramPicker.tsx',
    )
    // O mecanismo REPROVA o import estático...
    expect(
      STATIC_PHOSPHOR_CATALOG_IMPORT.test("import { loadPhosphorCatalog } from '../../phosphorCatalog'"),
    ).toBe(true)
    // ...e ACEITA as duas formas legítimas.
    expect(
      STATIC_PHOSPHOR_CATALOG_IMPORT.test("import type { PhosphorCatalog } from '../../phosphorCatalog'"),
    ).toBe(false)
    expect(
      STATIC_PHOSPHOR_CATALOG_IMPORT.test("void import('../../phosphorCatalog').then((m) => m)"),
    ).toBe(false)
  })
})
