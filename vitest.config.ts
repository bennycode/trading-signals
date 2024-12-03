import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      branches: 100,
      functions: 100,
      include: ['**/*.{ts,tsx}', '!**/*.d.ts', '!**/cli.ts', '!**/index.ts', '!**/start*.ts'],
      lines: 100,
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
      statements: 100,
    },
    environment: 'node',
    globals: true,
  },
});
