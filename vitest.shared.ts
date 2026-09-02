import {transform} from 'esbuild';
import {defineConfig} from 'vitest/config';
import tsconfig from './tsconfig.lib.json';

/*
 * Keeps tests on the same language level that ships in `dist` rather than Vitest's older default,
 * and keeps the decorator transform below in step with it. Read from the tsconfig so the two
 * cannot drift apart.
 */
const target = tsconfig.compilerOptions.target;

export default defineConfig({
  oxc: {
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
       * files that actually use decorators so everything else stays on oxc.
       *
       * This is not a short-lived bridge: oxc has deferred standard decorators until the spec
       * stabilizes, and the proposal has since moved back to Stage 2.7. Drop the plugin when
       * https://github.com/oxc-project/oxc/issues/9170 closes.
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
