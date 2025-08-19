// eslint.config.ts
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import prettierPlugin from 'eslint-plugin-prettier'

const bunTestGlobals = {
  // Bun test runner globals
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  mock: 'readonly',
}

export default [
  // Ignore generated / external stuff
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  // App source
  {
    files: ['src/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json', // type-aware linting & IntelliSense
        tsconfigRootDir: import.meta.dirname, // resolves project path correctly
      },
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript hygiene
      'no-constant-condition': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',

      // Prettier formatting
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // Tests (Bun)
  {
    files: ['__tests__/**/*.{ts,tsx}', 'packages/**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json', // keep type-aware in tests
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...bunTestGlobals,
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // same rules as src by default; tweak tests if you like:
      'no-constant-condition': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',

      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
]
