import {type Config, defineConfig} from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

/*
 * Forbid explicit primitive return types where TypeScript trivially infers the same type.
 * Covers both bare primitives (`: string`) and Promise-wrapped primitives (`: Promise<string>`),
 * but never `void`/`Promise<void>` and never body-less signatures (abstract methods, interface
 * members, overload declarations) where the annotation is actually required.
 */
const FUNCTIONS_WITH_BODY = ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)';
const PRIMITIVE_KEYWORDS = ':matches(TSBooleanKeyword, TSNumberKeyword, TSStringKeyword, TSBigIntKeyword)';

/*
 * ESLint config files are plain ESM that live outside the TypeScript program, so the
 * type-aware parser (`parserOptions.project`) can't resolve them. Rather than excluding
 * them from linting, lint them with type-checked rules switched off — syntactic rules
 * (formatting, comment style, key sorting) still apply.
 */
const configFileOverride = {
  ...typescriptEslint.configs['flat/disable-type-checked'],
  files: ['**/eslint.config.*'],
};

/**
 * Shared ESLint config for every package in this monorepo. Pass `config` to append
 * package-specific configuration and ignore globs on top of the common ones.
 */
export function createConfig({ignores = [], ...config}: Config = {}) {
  return defineConfig([
    /*
     * Global ignores: a config object with ONLY `ignores` excludes files entirely.
     * Attached to a config that also has `files`, the same patterns would only exclude
     * files from that one object and extended configs could still lint them.
     */
    {
      ignores: [
        '**/.dependency-cruiser.cjs',
        '**/coverage/**',
        '**/dist/**',
        '**/docs/**',
        '**/tsdown.config.ts',
        '**/vitest.config.ts',
        ...ignores,
      ],
    },
    {
      /*
       * `eslint-config-prettier` only switches rules off, so it belongs in `extends` where it
       * is applied before this object's own `rules` block and can't clobber a deliberate choice.
       */
      extends: [eslintConfigPrettier],
      files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],

      languageOptions: {
        ecmaVersion: 8,

        globals: {
          ...globals.browser,
          ...globals.node,
        },
        parser: tsParser,
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
          // https://typescript-eslint.io/blog/parser-options-project-true/
          project: true,
        },

        sourceType: 'module',
      },

      // https://eslint.org/docs/latest/use/configure/configuration-files#configuration-naming-conventions
      name: 'typedtrader/base',

      plugins: {
        '@stylistic': stylistic,
        '@typescript-eslint': typescriptEslint,
        perfectionist,
        prettier,
      },

      rules: {
        '@stylistic/multiline-comment-style': ['error', 'starred-block'],
        '@typescript-eslint/array-type': 'error',
        '@typescript-eslint/consistent-type-assertions': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/member-ordering': 'off',
        '@typescript-eslint/no-dupe-class-members': ['error'],

        '@typescript-eslint/no-floating-promises': [
          'error',
          {
            ignoreIIFE: true,
          },
        ],

        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/no-namespace': 'error',

        /*
         * The codebase uses the idiomatic `const X = {...} as const` + `type X = ...`
         * companion pattern as an enum replacement. `no-redeclare` misfires on the shared
         * value/type name even though TypeScript allows it; renaming would break public APIs.
         */
        '@typescript-eslint/no-redeclare': 'off',

        '@typescript-eslint/no-this-alias': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-unsafe-argument': 'error',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/prefer-as-const': 'error',
        '@typescript-eslint/prefer-for-of': 'off',
        '@typescript-eslint/prefer-readonly': 'error',
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/typedef': 'off',
        curly: 'error',
        'dot-notation': 'off',
        'max-depth': ['warn', 4],
        'no-cond-assign': 'error',
        'no-console': 'off',
        'no-const-assign': 'error',
        'no-dupe-class-members': 'off',
        'no-duplicate-case': 'error',
        'no-else-return': 'error',
        'no-inner-declarations': 'error',
        'no-invalid-this': 'error',
        'no-lonely-if': 'error',
        'no-redeclare': 'off',

        'no-restricted-syntax': [
          'error',
          {
            message: 'Drop the explicit primitive return type and rely on inference.',
            selector: `${FUNCTIONS_WITH_BODY} > TSTypeAnnotation > ${PRIMITIVE_KEYWORDS}`,
          },
          {
            message: 'Drop the explicit Promise<primitive> return type and rely on inference.',
            selector: `${FUNCTIONS_WITH_BODY} > TSTypeAnnotation > TSTypeReference[typeName.name='Promise'] > TSTypeParameterInstantiation > ${PRIMITIVE_KEYWORDS}`,
          },
        ],

        'no-return-await': 'off',
        'no-sequences': 'error',
        'no-shadow': 'off',
        'no-sparse-arrays': 'error',
        'no-template-curly-in-string': 'error',
        'no-unneeded-ternary': 'error',
        'no-unused-expressions': 'error',
        'no-unused-vars': 'off',
        'no-useless-return': 'error',
        'no-var': 'error',
        'one-var': ['error', 'never'],

        'padding-line-between-statements': [
          'error',
          {
            blankLine: 'always',
            next: ['export', 'expression'],
            prev: 'import',
          },
        ],

        /*
         * Object-key sorting is enforced across all packages. We use a plugin instead of
         * ESLint's core `sort-keys` rule because that rule is frozen and provides no autofix.
         * https://eslint.org/docs/latest/rules/sort-keys#require-object-keys-to-be-sorted-sort-keys
         */
        'perfectionist/sort-objects': [
          'error',
          {
            ignoreCase: false,
            order: 'asc',
            type: 'natural',
          },
        ],

        'prefer-arrow-callback': 'error',
        'prefer-const': 'error',
        'prefer-promise-reject-errors': 'error',
        'prettier/prettier': 'error',
        'sort-imports': 'off',
        'sort-vars': 'error',
        'space-in-parens': 'error',
        strict: ['error', 'global'],
      },
    },
    config,
    configFileOverride,
  ]);
}
