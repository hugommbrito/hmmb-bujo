import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

// Flat config (eslint.config.js) is the project standard. Feature-boundary
// rule implemented via no-restricted-imports (Story 1.5).
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // ─── Fronteiras inter-feature ─────────────────────────────────────────────
  // Arquivos dentro de src/features/<A>/ NÃO podem importar
  // diretamente de src/features/<B>/<sub-path>.
  // Apenas o barrel (index.ts / import '../featureB') é permitido.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*/*'],
              message:
                'Imports inter-feature devem usar apenas o barrel: import { X } from "../featureB" (não "../featureB/arquivo")',
            },
          ],
        },
      ],
    },
  },
])
