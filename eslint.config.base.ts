import {defineConfig} from 'eslint/config';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import eslintConfig from '@tstv/eslint-config';

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
 * Shared ESLint config for every package in this monorepo. Pass `ignores` to append
 * package-specific ignore globs on top of the common ones.
 */
export function createConfig({ignores = []}: {ignores?: string[]} = {}) {
  return defineConfig([
    {
      extends: [eslintConfig],
      files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
      ignores: [
        '**/.dependency-cruiser.cjs',
        '**/coverage/**',
        '**/dist/**',
        '**/docs/**',
        '**/tsdown.config.ts',
        '**/vitest.config.ts',
        ...ignores,
      ],
      rules: {
        /*
         * The codebase uses the idiomatic `const X = {...} as const` + `type X = ...`
         * companion pattern as an enum replacement. `no-redeclare` misfires on the shared
         * value/type name even though TypeScript allows it; renaming would break public APIs.
         */
        '@typescript-eslint/no-redeclare': 'off',
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
        // Object-key sorting is enforced across all packages.
        'perfectionist/sort-objects': 'error',
      },
    },
    configFileOverride,
  ]);
}
