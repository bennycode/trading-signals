import {defineConfig} from 'eslint/config';
import eslintConfig from '@tstv/eslint-config';

export default defineConfig({
  extends: [eslintConfig],
  files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
  ignores: ['**/vitest.config.ts', '**/tsup.config.ts', '**/dist/**', '**/docs/**', '**/.dependency-cruiser.cjs'],
});
