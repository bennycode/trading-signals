import {createConfig} from '../../eslint.config.base.mjs';

export default createConfig({
  ignores: [
    '**/.next/**',
    '**/next-env.d.ts',
    '**/out/**',
    '**/playwright-report/**',
    '**/postcss.config.js',
    '**/test-results/**',
  ],
});
