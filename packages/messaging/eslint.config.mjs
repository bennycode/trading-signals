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
    '**/drizzle.config.ts',
    '**/tsdown.config.ts',
    '**/vitest.config.ts',
    'eslint.config.mjs',
  ],
  rules: {
    // The codebase uses the idiomatic `const X = {...} as const` + `type X = ...`
    // companion pattern as an enum replacement. `no-redeclare` misfires on the shared
    // value/type name even though TypeScript allows it; renaming would break public APIs.
    '@typescript-eslint/no-redeclare': 'off',
  },
});
