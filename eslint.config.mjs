/**
 * Repository-wide ESLint flat configuration.
 *
 * Layer: config.
 *
 * Applies base JavaScript rules to tooling files (this config included) and
 * strict, type-checked TypeScript rules to application source once it lands.
 */
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
  'crypto',
  'crypto-js',
  'md5',
  'bcrypt',
  'bcryptjs',
  'uuid',
  'nanoid',
]

/**
 * Custom messages for banned imports whose generic "native equivalent"
 * message would be misleading (the built-in itself is fine, only the
 * unprefixed specifier is banned).
 *
 * @type {Record<string, string>}
 */
const BANNED_IMPORT_MESSAGE_OVERRIDES = {
  crypto: "Do not import 'crypto'. Use the 'node:crypto' prefixed form instead.",
}

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
            message:
              BANNED_IMPORT_MESSAGE_OVERRIDES[name] ??
              `Do not import '${name}'. Use a native Node API or the platform-provided equivalent.`,
          })),
        },
      ],
    },
  },

  // NestJS module classes are intentionally empty: the `@Module` decorator holds
  // every piece of metadata and the class itself is the DI handle the framework
  // requires. `no-extraneous-class` (from the strict preset) would flag them, so
  // it is switched off for these framework-mandated shells only.
  {
    files: ['**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
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
