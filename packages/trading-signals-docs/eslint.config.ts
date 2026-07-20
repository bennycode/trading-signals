import {createConfig} from '../../eslint.config.base.ts';

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
