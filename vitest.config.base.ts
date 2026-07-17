import {transform} from 'esbuild';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  oxc: {
    // Downlevels syntax Node cannot parse natively yet (e.g. the "accessor" keyword).
    // Vite 8 (rolldown) transforms with oxc; the former `esbuild` options are ignored.
    target: 'es2022',
  },
  plugins: [
    {
      enforce: 'pre',
      name: 'standard-decorators',
      /*
       * oxc (rolldown's transformer) can only downlevel legacy `experimentalDecorators`,
       * not TC39 standard decorators, so decorator-bearing files would reach Node as raw
       * decorator syntax and fail to parse. esbuild (already present via tsx) downlevels
       * them; scoped to files that actually use decorators so everything else stays on oxc.
       * Drop this plugin once oxc ships standard-decorator support.
       */
      async transform(code, id) {
        if (!/\.tsx?$/.test(id) || !/^\s*@[A-Za-z_$]/m.test(code)) {
          return null;
        }
        return transform(code, {loader: 'ts', sourcefile: id, sourcemap: true, target: 'es2022'});
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
    sequence: {
      concurrent: true,
      shuffle: true,
    },
  },
});
