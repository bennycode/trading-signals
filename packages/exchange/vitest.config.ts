import {defineConfig} from 'vitest/config';

export default defineConfig({
  esbuild: {
    // Allows using the "accessor" keyword in TypeScript:
    // https://github.com/vitest-dev/vitest/issues/5976#issuecomment-2190804966
    target: 'es2022',
  },
  test: {
    bail: 1,
    coverage: {
      exclude: ['src/start/**', 'fixtures/**'],
      include: ['src/**'],
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
    },
    environment: 'node',
    globals: true,
  },
});
