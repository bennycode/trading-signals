import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        // Exclude runnable CLI scripts (top-level await + process.exit) from coverage.
        // They aren't library code and rolldown's coverage parser misreads some TS syntax
        // in them (e.g. type assertions, non-null assertions).
        exclude: ['fixtures/**', 'src/broker/alpaca/demo/**', 'src/broker/trading212/demo/**'],
      },
    },
  })
);
