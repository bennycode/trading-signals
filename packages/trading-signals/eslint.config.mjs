import {defineConfig} from 'eslint/config';
import eslintConfig from '@tstv/eslint-config';

export default defineConfig({
  extends: [eslintConfig],
  files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
  ignores: [
    '**/.dependency-cruiser.cjs',
    '**/coverage/**',
    '**/dist/**',
    '**/docs/**',
    '**/tsdown.config.ts',
    '**/vitest.config.ts',
    'eslint.config.mjs',
  ],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        message: 'Drop the explicit primitive return type and rely on inference.',
        selector:
          ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > TSTypeAnnotation > :matches(TSBooleanKeyword, TSNumberKeyword, TSStringKeyword, TSBigIntKeyword)',
      },
    ],
    // Object-key sorting is enforced across all packages.
    'perfectionist/sort-objects': 'error',
  },
});
