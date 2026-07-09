// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Imports banned repository-wide. Each entry has a safe, native or
 * platform-provided replacement, so there is never a reason to reach for
 * these in application code.
 *
 * @type {string[]}
 */
const BANNED_IMPORTS = [
  'dotenv',
  'moment',
  'lodash',
  'crypto-js',
  'md5',
  'bcrypt',
  'bcryptjs',
  'uuid',
  'nanoid',
]

export default tseslint.config(
  // Files and directories excluded from all linting.
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.stryker-tmp/**',
      '**/node_modules/**',
    ],
  },

  // Base JavaScript rules for config and tooling files (no type-checking:
  // these files are not part of any app tsconfig program).
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },

  // Type-checked strict rules for application TypeScript source.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: BANNED_IMPORTS.map((name) => ({
            name,
            message: `Do not import '${name}'. Use a native Node API or the platform-provided equivalent.`,
          })),
        },
      ],
    },
  },

  // Relaxed type-unsafe rules for test files (spec and e2e), where mocking
  // and fixture construction routinely cross strict-typing boundaries.
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
