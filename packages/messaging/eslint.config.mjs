import {createConfig} from '../../eslint.config.base.mjs';

// `drizzle.config.ts` is generated tooling config that shouldn't be linted.
export default createConfig({ignores: ['**/drizzle.config.ts']});
