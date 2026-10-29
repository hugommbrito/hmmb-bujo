import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ─────────────────────────────────────────────────────────────────────────────
// `phosphor-catalog-bundle` (DW-64) — o catálogo INTEIRO do Phosphor como UM
// módulo, para o chunk do seletor de pictograma (`features/habits/
// phosphorCatalog.ts`, alcançável só por `import()`).
//
// Por que um alias, e não `import * as … from '@phosphor-icons/react'`: o barrel
// ESM do pacote (`dist/index.es.js`) são 1512 re-exports de `dist/csr/*.es.js` —
// exatamente os módulos que o `import.meta.glob` per-chave da DW-60 transforma
// em 1512 ENTRADAS DINÂMICAS. Um módulo não mora em dois chunks, e o Rollup não
// funde entrada dinâmica com chunk dinâmico, então o barrel só tem dois destinos
// possíveis, os DOIS medidos em build de produção:
//   · alcançável da entrada (é o caso hoje — `app/layout/shell/navIcons.tsx`
//     importa do barrel): o chunk de ENTRADA salta de 1,08 MB para 6,16 MB
//     (293 kB → 1,38 MB gzip) — ×4,7 no caminho crítico de TODA rota;
//   · só atrás de `import()`: o chunk do catálogo vira 176 kB de cola que
//     importa ~1.489 chunks irmãos — abrir o seletor dispara ~1.500 requisições.
//
// `dist/index.cjs.js` é o bundle ÚNICO e autocontido que o pacote já publica
// (`"require"` do próprio `exports`; depende só de `react`). Sendo UM módulo, ele
// vira UM chunk de 5,31 MB / 1,12 MB gzip, sem compartilhar módulo nenhum com
// `dist/csr/*` — a entrada fica em 1,08 MB, a rota de Hábitos em ~350 kB e os
// 1512 chunks per-chave da DW-60 continuam existindo, intactos.
//
// O caminho é absoluto porque o mapa `exports` do pacote não publica subcaminho
// para o bundle. `optimizeDeps.include` é o que faz o DEV funcionar: sem ele o
// servidor entrega o CommonJS cru (`exports is not defined` no browser); com ele
// o esbuild/rolldown pré-empacota o arquivo em ESM, então dev, E2E e produção
// exercitam o MESMO artefato.
// ─────────────────────────────────────────────────────────────────────────────
const PHOSPHOR_CATALOG_BUNDLE_ID = 'phosphor-catalog-bundle'
const phosphorCatalogBundle = fileURLToPath(
  new URL('./node_modules/@phosphor-icons/react/dist/index.cjs.js', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { [PHOSPHOR_CATALOG_BUNDLE_ID]: phosphorCatalogBundle } },
  optimizeDeps: { include: [PHOSPHOR_CATALOG_BUNDLE_ID] },
  server: {
    // DEV: same-origin calls — the app talks to a relative `/api` and Vite
    // proxies to the Django backend, so there is no CORS in development.
    // PROD: the app reads `VITE_API_BASE_URL` (cross-origin). The two paths do
    // not overlap — proxy for dev, base-URL for prod.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
