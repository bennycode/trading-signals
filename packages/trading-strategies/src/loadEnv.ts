import {resolve} from 'node:path';
import {config} from 'dotenv-defaults';

/*
 * All packages share one `.env` and `.env.defaults` at the repository root. Imported for its side
 * effect, first, because modules read their settings while they are being imported.
 */
const root = resolve(import.meta.dirname, '../../..');
config({defaults: resolve(root, '.env.defaults'), path: resolve(root, '.env')});
