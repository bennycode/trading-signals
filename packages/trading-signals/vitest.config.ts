import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from '../../vitest.shared';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        // The bin entry only wires stdin/stdout to runCli(), which carries the tested logic.
        exclude: ['src/cli/cli.ts'],
        thresholds: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
      tags: [
        {
          description:
            'Verifies indicator results against Tulip Indicators reference data (https://tulipindicators.org/).',
          name: 'tulipindicators',
        },
        {
          description: 'Tests written specifically to guard against bugs that already happened.',
          name: 'regression',
        },
      ],
    },
  })
);
