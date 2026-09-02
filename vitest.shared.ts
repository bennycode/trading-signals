import {transform} from 'esbuild';
import {defineConfig} from 'vitest/config';

/*
 * Allows using the "accessor" keyword in TypeScript:
 * https://github.com/vitest-dev/vitest/issues/5976#issuecomment-2190804966
 */
const target = 'es2022';

export default defineConfig({
  esbuild: {
    target,
  },
  plugins: [
    {
      enforce: 'pre',
      name: 'standard-decorators',
      /*
       * oxc (the transformer behind Vitest 4) can only downlevel legacy `experimentalDecorators`,
       * not TC39 standard decorators, so decorator-bearing files would reach Node as raw decorator
       * syntax and fail to parse. esbuild (already installed via tsx) downlevels them; scoped to
       * files that actually use decorators so everything else stays on oxc. Drop this plugin once
       * oxc ships standard-decorator support.
       */
      async transform(code, id) {
        if (!/\.tsx?$/.test(id) || !/^\s*@[A-Za-z_$]/m.test(code)) {
          return null;
        }
        return transform(code, {loader: 'ts', sourcefile: id, sourcemap: true, target});
      },
    },
  ],
  test: {
    bail: 1,
    coverage: {
      exclude: ['src/start/**'],
      include: ['src/**'],
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
    },
    environment: 'node',
    globals: true,
    // https://main.vitest.dev/guide/learn/writing-tests-with-ai.html#mock-cleanup
    restoreMocks: true,
    sequence: {
      concurrent: true,
      shuffle: true,
    },
  },
});
