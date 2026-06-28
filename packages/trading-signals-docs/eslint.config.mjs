import {createConfig} from '../../eslint.config.base.mjs';

/*
 * A flat-config object with only `ignores` (no `files`) is a GLOBAL ignore — it removes these paths
 * from every config block. Next.js build output (.next, out) and generated stubs are not source we
 * author, so they must never be linted.
 */
export default [{ignores: ['**/.next/**', '**/out/**', 'next-env.d.ts', '**/postcss.config.js']}, ...createConfig()];
