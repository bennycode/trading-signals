import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      branches: 0,
      functions: 0,
      include: ['**/*.{ts,tsx}', '!**/*.d.ts', '!**/cli.ts', '!**/index.ts', '!**/start*.ts'],
      lines: 0,
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
      statements: 0,
    },
    environment: 'node',
    globals: true,
  },
});
