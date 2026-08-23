// Conversão kebab ⇄ Pascal (DW-60) — as linhas de conversão da I/O Matrix.
//
// O módulo é PURO de propósito: estes testes não montam React nem carregam um
// glifo do Phosphor. A resolução do glifo em si (chave órfã ⇒ `null`) é coberta
// em `components/record/recordPrimitives.test.tsx`, onde há DOM.
import { describe, expect, it } from 'vitest'

import { isKebabIconKey, toPascalCase } from './iconKey'

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
