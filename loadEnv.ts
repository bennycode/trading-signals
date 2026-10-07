import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

for (const file of ['.env', '.env.flags']) {
  const path = resolve(import.meta.dirname, file);
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}
