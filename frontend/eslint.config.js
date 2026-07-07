import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
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
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // ─── Testes E2E (Playwright) ───────────────────────────────────────────────
  // Node puro, sem JSX/hooks — a fixture `use` do Playwright não é um React
  // Hook, então react-hooks/rules-of-hooks não se aplica aqui.
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  // ─── Fronteiras inter-feature ─────────────────────────────────────────────
  // Arquivos dentro de src/features/<A>/ NÃO podem importar
  // diretamente de src/features/<B>/<sub-path>.
  // Apenas o barrel (index.ts / import '../featureB') é permitido.
  // Permitido: imports para api/ (infra) e shared/ (utilitários compartilhados).
  // Regex: detecta '../' NOT seguido por '../', 'api/', 'shared/' ou 'app/',
  // e seguido de ao menos um segmento de diretório (com '/') — i.e. um import profundo.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '\\.\\.\\/(?!api\\/|shared\\/|app\\/|\\.\\.\\/)[^\\/]+\\/',
              message:
                'Imports inter-feature devem usar apenas o barrel: import { X } from "../featureB" (não "../featureB/arquivo")',
            },
          ],
        },
      ],
    },
  },
])
