#!/usr/bin/env node
/**
 * Gera o catálogo de nomes de glifo do Phosphor consumido pelo backend
 * (Story 16.2).
 *
 * Por que um artefato commitado, e não leitura em runtime: a fonte única de
 * nomes válidos é o pacote `@phosphor-icons/react` instalado — que só existe em
 * `frontend/node_modules/`. O backend roda no Railway **sem** `node_modules`,
 * então o servidor não tem como enumerar o pacote na hora de validar um
 * `icon_key`. A saída deste script é portanto um artefato versionado, e o CI
 * regenera + `diff`a contra o commitado (mesmo molde dos gates de
 * `schema.yaml` / `types.gen.ts`): sem esse gate, atualizar o pacote faria o
 * catálogo divergir em silêncio e chaves válidas passariam a dar 400.
 *
 * Conversão PascalCase → kebab-case: medida sobre os 1512 nomes de
 * `dist/csr/*.es.js` — nenhum contém dígito e não há **nenhuma** colisão, ou
 * seja, o mapeamento é bijetivo e reversível sem tabela. Persistimos o nome
 * público do Phosphor (`address-book`), que é também o que a busca por
 * substring do seletor (DW-60) espera; a conversão de volta para o export
 * PascalCase do pacote fica no frontend.
 *
 * Uso: `node scripts/gen_phosphor_catalog.mjs` (a partir da raiz do repositório).
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_ROOT = join(REPO_ROOT, 'frontend', 'node_modules', '@phosphor-icons', 'react')
const CSR_DIR = join(PACKAGE_ROOT, 'dist', 'csr')
const OUTPUT = join(REPO_ROOT, 'backend', 'habits', 'phosphor_catalog.json')

/** `AddressBookTabs` → `address-book-tabs`. Sem dígitos no conjunto real. */
function toKebabCase(pascal) {
  return pascal
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function main() {
  let version
  try {
    version = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version
  } catch (error) {
    console.error(
      `❌ @phosphor-icons/react não encontrado em ${PACKAGE_ROOT}. ` +
        'Rode `npm ci` em frontend/ antes de gerar o catálogo.',
    )
    throw error
  }

  let entries
  try {
    entries = readdirSync(CSR_DIR)
  } catch (error) {
    console.error(
      `❌ ${CSR_DIR} não existe — o layout de @phosphor-icons/react mudou. ` +
        'Revise este gerador antes de confiar no catálogo.',
    )
    throw error
  }

  const pascalNames = entries
    .filter((file) => file.endsWith('.es.js'))
    .map((file) => file.slice(0, -'.es.js'.length))

  // A conversão kebab não define separação para dígitos (`Number1` → `number1`
  // ou `number-1`?). Hoje nenhum nome tem dígito; se um aparecer, é melhor
  // falhar aqui do que gravar uma chave que o regex do backend rejeitaria.
  const comDigito = pascalNames.filter((name) => /\d/.test(name))
  if (comDigito.length > 0) {
    throw new Error(
      `Nomes com dígito não suportados pela conversão kebab: ${comDigito.join(', ')}`,
    )
  }

  if (pascalNames.length === 0) {
    throw new Error(`Nenhum glifo encontrado em ${CSR_DIR} — pacote corrompido?`)
  }

  // A bijeção é premissa do contrato (o backend guarda kebab, o frontend
  // reconstrói o export). Se uma versão futura do pacote introduzir uma
  // colisão, é melhor falhar aqui, ruidosamente, do que gravar um catálogo em
  // que duas chaves distintas apontam para o mesmo glifo.
  const seen = new Map()
  for (const pascal of pascalNames) {
    const kebab = toKebabCase(pascal)
    if (seen.has(kebab)) {
      throw new Error(
        `Colisão kebab-case: "${seen.get(kebab)}" e "${pascal}" viram "${kebab}". ` +
          'A conversão deixou de ser bijetiva — revise o contrato de icon_key.',
      )
    }
    seen.set(kebab, pascal)
  }

  const names = [...seen.keys()].sort()
  const payload = {
    _comment:
      'GERADO por scripts/gen_phosphor_catalog.mjs — não editar à mão. ' +
      'Nomes de glifo do Phosphor em kebab-case; fonte de verdade da validação de icon_key.',
    package: '@phosphor-icons/react',
    version,
    count: names.length,
    names,
  }

  writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`✅ ${names.length} glifos (@phosphor-icons/react@${version}) → ${OUTPUT}`)
}

main()
