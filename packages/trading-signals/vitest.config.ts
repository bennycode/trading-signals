import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  })
);
