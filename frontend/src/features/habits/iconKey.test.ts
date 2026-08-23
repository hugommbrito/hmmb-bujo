// Conversão kebab ⇄ Pascal (DW-60) — as linhas de conversão da I/O Matrix.
//
// O módulo é PURO de propósito: estes testes não montam React nem carregam um
// glifo do Phosphor. A resolução do glifo em si (chave órfã ⇒ `null`) é coberta
// em `components/record/recordPrimitives.test.tsx`, onde há DOM.
import { describe, expect, it } from 'vitest'

import { isKebabIconKey, isPascalIconName, toKebabCase, toPascalCase } from './iconKey'

describe('DW-60 — toPascalCase', () => {
  it('converte a chave composta do wire no export do pacote', () => {
    expect(toPascalCase('address-book')).toBe('AddressBook')
    expect(toPascalCase('address-book-tabs')).toBe('AddressBookTabs')
  })

  it('converte a chave de uma palavra só', () => {
    expect(toPascalCase('barbell')).toBe('Barbell')
  })

  it('PascalCase de ENTRADA não resolve — é chave inválida, não algo a normalizar', () => {
    // O servidor rejeita `AddressBook` com 400 (`validate_icon_key`); se um
    // valor assim chegar, tratar como órfã é o contrato, não "consertar".
    expect(toPascalCase('AddressBook')).toBeNull()
    expect(toPascalCase('Barbell')).toBeNull()
  })

  it('devolve null para toda grafia fora do kebab-case estrito', () => {
    for (const invalid of [
      '',
      'address_book',
      'address--book',
      '-address-book',
      'address-book-',
      'address book',
      'number1',
      'ADDRESS-BOOK',
      'address-Book',
      'barbell\n',
    ]) {
      expect(toPascalCase(invalid), invalid).toBeNull()
    }
  })

  it('devolve null para não-string (nulo é o estado "sem pictograma")', () => {
    expect(toPascalCase(null)).toBeNull()
    expect(toPascalCase(undefined)).toBeNull()
    expect(toPascalCase(42)).toBeNull()
  })

  it('um nome kebab BEM FORMADO mas inexistente no catálogo ainda converte — a existência é da resolução', () => {
    // A conversão é sintática. Quem devolve "sem glifo" para nome inexistente é
    // o `DomainIcon` (a chave simplesmente não está no mapa do catálogo).
    expect(toPascalCase('glifo-que-saiu')).toBe('GlifoQueSaiu')
  })
})

describe('DW-60 — isKebabIconKey', () => {
  it('aceita só a grafia do catálogo', () => {
    expect(isKebabIconKey('barbell')).toBe(true)
    expect(isKebabIconKey('address-book-tabs')).toBe(true)
    expect(isKebabIconKey('AddressBook')).toBe(false)
    expect(isKebabIconKey(null)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DW-64 — a volta: o catálogo do seletor NASCE em PascalCase (são os exports do
// pacote) e tudo a jusante é kebab.
// ─────────────────────────────────────────────────────────────────────────────

describe('DW-64 — toKebabCase', () => {
  it('converte o export do pacote na chave do wire', () => {
    expect(toKebabCase('AddressBook')).toBe('address-book')
    expect(toKebabCase('AddressBookTabs')).toBe('address-book-tabs')
  })

  it('converte o nome de uma palavra só', () => {
    expect(toKebabCase('Barbell')).toBe('barbell')
    expect(toKebabCase('Drop')).toBe('drop')
  })

  it('segmento de UMA letra é segmento, não sufixo colado', () => {
    // Existem no pacote instalado: `ArrowUUpLeft`, `FileCSharp`, `SmileyXEyes`,
    // `FourK`, `X`. Colar a letra solta ao segmento anterior produziria chave
    // que o servidor rejeita com 400.
    expect(toKebabCase('ArrowUUpLeft')).toBe('arrow-u-up-left')
    expect(toKebabCase('ArrowUDownRight')).toBe('arrow-u-down-right')
    expect(toKebabCase('FileCSharp')).toBe('file-c-sharp')
    expect(toKebabCase('SmileyXEyes')).toBe('smiley-x-eyes')
    expect(toKebabCase('FourK')).toBe('four-k')
    expect(toKebabCase('X')).toBe('x')
  })

  it('kebab de ENTRADA não resolve — o inverso é ESTRITO, não tolerante', () => {
    // Converter duas vezes é bug do chamador; "consertar" aqui esconderia o bug.
    expect(toKebabCase('address-book')).toBeNull()
    expect(toKebabCase('barbell')).toBeNull()
  })

  it('devolve null para toda grafia fora do PascalCase estrito', () => {
    for (const invalid of [
      '',
      'Address_Book',
      'Address-Book',
      'Address Book',
      'Number1',
      'aAddressBook',
      'Barbell\n',
    ]) {
      expect(toKebabCase(invalid), invalid).toBeNull()
    }
  })

  it('devolve null para não-string', () => {
    expect(toKebabCase(null)).toBeNull()
    expect(toKebabCase(undefined)).toBeNull()
    expect(toKebabCase(42)).toBeNull()
  })
})

describe('DW-64 — isPascalIconName', () => {
  it('aceita só a grafia dos exports', () => {
    expect(isPascalIconName('AddressBook')).toBe(true)
    expect(isPascalIconName('ArrowUUpLeft')).toBe(true)
    expect(isPascalIconName('address-book')).toBe(false)
    expect(isPascalIconName(null)).toBe(false)
    // MAIÚSCULAS SEGUIDAS são segmentos de uma letra, e isso é DELIBERADO: são
    // exatamente elas que sustentam `ArrowUUpLeft` e `FileCSharp`. `ADDRESSBOOK`
    // é o PascalCase legítimo de `a-d-d-r-e-s-s-b-o-o-k` — a bijeção continua
    // valendo, e quem decide o que EXISTE é o catálogo, não a grafia.
    expect(isPascalIconName('ADDRESSBOOK')).toBe(true)
    expect(toKebabCase('ADDRESSBOOK')).toBe('a-d-d-r-e-s-s-b-o-o-k')
    expect(toPascalCase('a-d-d-r-e-s-s-b-o-o-k')).toBe('ADDRESSBOOK')
  })
})

// A BIJEÇÃO é o contrato: se ela quebrasse, o seletor ofereceria uma chave que o
// servidor rejeita com 400 (`validate_icon_key`) — a grade mostraria o glifo e
// salvar falharia. Os dois sentidos, porque só um deles verde deixa passar a
// perda de informação no outro.
describe('DW-64 — round-trip kebab ⇄ Pascal', () => {
  const KEBAB_KEYS = [
    'barbell',
    'drop',
    'x',
    'address-book',
    'address-book-tabs',
    'arrow-u-up-left',
    'arrow-u-down-right',
    'file-c-sharp',
    'smiley-x-eyes',
    'four-k',
    'glifo-que-saiu',
  ]

  it.each(KEBAB_KEYS)('kebab → Pascal → kebab preserva %s', (key) => {
    const pascal = toPascalCase(key)
    expect(pascal, key).not.toBeNull()
    expect(isPascalIconName(pascal)).toBe(true)
    expect(toKebabCase(pascal)).toBe(key)
  })

  it.each(['Barbell', 'Drop', 'X', 'AddressBookTabs', 'ArrowUUpLeft', 'FileCSharp', 'FourK'])(
    'Pascal → kebab → Pascal preserva %s',
    (pascal) => {
      const kebab = toKebabCase(pascal)
      expect(kebab, pascal).not.toBeNull()
      expect(isKebabIconKey(kebab)).toBe(true)
      expect(toPascalCase(kebab)).toBe(pascal)
    },
  )
})
