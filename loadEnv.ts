import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

/*
 * Preloaded with `--import` by every script that needs configuration, so it runs before any module
 * reads its settings at import time. Paths resolve from this file, so a script finds them no matter
 * which folder it starts in.
 *
 * Node never overrides a variable that is already set, which gives the precedence: the shell (e.g.
 * secrets from `op run`, or a platform like Dokku) wins over `.env`, and `.env` wins over the shared
 * flags in `.env.flags`.
 */
for (const file of ['.env', '.env.flags']) {
  const path = resolve(import.meta.dirname, file);
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}
