import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // DW-64 — `phosphor-catalog-bundle` (ver o bloco em `vite.config.ts`). Aqui o
  // alias aponta para o BARREL ESM, não para `dist/index.cjs.js`: o Vitest
  // externaliza dependências de `node_modules` e o Node recusa um `.js`
  // CommonJS dentro de um pacote `"type": "module"` (`exports is not defined`).
  // A troca é só de EMPACOTAMENTO — os dois artefatos vêm do mesmo código-fonte
  // e publicam os mesmos exports `*Icon`, que é o que `phosphorCatalog.test.ts`
  // asserta. O artefato de produção é exercitado pelo E2E, que roda contra o
  // servidor de dev (onde o alias JÁ é o bundle).
  resolve: { alias: { 'phosphor-catalog-bundle': '@phosphor-icons/react' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // A suíte é flaky sob execução paralela de arquivos (poluição de estado
    // global / pressão de recursos entre arquivos): ~2 falhas não-determinísticas
    // por rodada, conjunto variável, todas passam em isolamento — achado MEDIUM
    // pré-existente registrado na review da Story 5.3. Todo o Épico 11 e o Épico 5
    // invocaram `--no-file-parallelism` manualmente; promovido a default aqui
    // (retro Épico 11 #1 / retro Épico 5 §7, 4º ciclo).
    fileParallelism: false,
    // e2e/ roda em Playwright (browser real), não em jsdom — mantê-lo fora
    // do Vitest evita que ele tente coletar specs de outro test runner.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
