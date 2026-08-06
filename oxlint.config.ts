import {defineConfig} from 'oxlint';

export default defineConfig({
  categories: {
    correctness: 'off',
  },

  env: {
    browser: true,
    builtin: true,
    node: true,
  },

  ignorePatterns: [
    // Agent worktree copies — linting them breaks tsgolint's type-aware pass for the whole run
    '.claude/**',
    '**/.dependency-cruiser.cjs',
    '**/.next/**',
    '**/coverage/**',
    '**/dist/**',
    '**/docs/**',
    '**/drizzle.config.ts',
    '**/next-env.d.ts',
    '**/out/**',
    '**/playwright-report/**',
    '**/postcss.config.js',
    '**/test-results/**',
    '**/tsdown.config.ts',
    '**/vitest.config.ts',
  ],

  // Rules Oxlint has no native equivalent for, bridged through its ESLint plugin support.
  jsPlugins: ['@stylistic/eslint-plugin'],

  // Runs the type-aware rules below through oxlint-tsgolint. Honoured only in the root config.
  options: {
    typeAware: true,
  },

  plugins: ['import', 'typescript'],

  rules: {
    '@stylistic/multiline-comment-style': ['error', 'starred-block'],
    curly: 'error',
    'import/no-cycle': 'error',
    'max-depth': ['warn', 4],
    'no-cond-assign': 'error',
    'no-console': 'off',
    'no-const-assign': 'error',
    'no-dupe-class-members': 'error',
    'no-duplicate-case': 'error',
    'no-else-return': 'error',
    'no-inner-declarations': 'error',
    'no-lonely-if': 'error',
    /*
     * The codebase uses the idiomatic `const X = {...} as const` + `type X = ...` companion
     * pattern as an enum replacement. `no-redeclare` misfires on the shared value/type name even
     * though TypeScript allows it; renaming would break public APIs.
     */
    'no-redeclare': 'off',
    'no-sequences': 'error',
    'no-shadow': 'off',
    'no-sparse-arrays': 'error',
    'no-template-curly-in-string': 'error',
    'no-unneeded-ternary': 'error',
    'no-unused-expressions': 'error',
    'no-unused-vars': 'off',
    'no-useless-return': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-const': 'error',
    'prefer-promise-reject-errors': 'error',
    'sort-keys': ['error', 'asc', {caseSensitive: false, natural: true}],
    'sort-vars': 'error',
    'typescript/array-type': 'error',
    'typescript/consistent-type-assertions': 'error',
    'typescript/consistent-type-imports': 'error',
    'typescript/explicit-function-return-type': 'off',
    'typescript/no-floating-promises': ['error', {ignoreIIFE: true}],
    'typescript/no-import-type-side-effects': 'error',
    'typescript/no-namespace': 'error',
    'typescript/no-this-alias': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unsafe-argument': 'error',
    'typescript/no-unsafe-assignment': 'error',
    'typescript/no-unsafe-call': 'error',
    'typescript/no-unsafe-member-access': 'error',
    'typescript/no-unsafe-return': 'error',
    'typescript/prefer-as-const': 'error',
    'typescript/prefer-for-of': 'off',
    'typescript/prefer-readonly': 'error',
    'typescript/return-await': ['error', 'in-try-catch'],
  },
});
