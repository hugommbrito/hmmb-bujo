import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
