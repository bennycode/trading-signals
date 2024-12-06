import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['**/*.{ts,tsx}', '!**/*.d.ts', '!**/cli.ts', '!**/index.ts', '!**/start*.ts'],
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    environment: 'node',
    globals: true,
  },
});
