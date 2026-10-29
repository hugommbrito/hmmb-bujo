// Tipo do alias `phosphor-catalog-bundle` (DW-64) — ver o bloco de comentário em
// `vite.config.ts` para O QUE ele resolve e POR QUÊ.
//
// O bundle é lido por REFLEXÃO (`Object.entries`), nunca por export nomeado, e a
// forma de cada valor é validada em runtime por `phosphorCatalog.ts` (sufixo
// `Icon` + round-trip da grafia). Declarar `Record<string, unknown>` é portanto o
// tipo HONESTO: um mapa cujas chaves não são conhecidas em tempo de compilação.
// Os tipos reais dos componentes vêm de `import type { Icon }`, que é erasable e
// não emite import nenhum.
declare module 'phosphor-catalog-bundle' {
  const bundle: Record<string, unknown>
  export = bundle
}
