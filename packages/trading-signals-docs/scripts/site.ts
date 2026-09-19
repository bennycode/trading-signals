/**
 * Replaces the `vocs dev` / `vocs build` CLI commands (which pass `configFile: false` and offer
 * no Vite hook) with the same Vite invocations plus Node.js built-in shims. The backtest page
 * runs @typedtrader/exchange broker mocks and trading-strategies in the browser, and their
 * module graphs import Node.js built-ins that rolldown refuses to bundle without these shims.
 *
 *   tsx scripts/site.ts dev|build
 */
import * as path from 'node:path';
import react from '@vitejs/plugin-react';
import * as vite from 'vite';
import {resolveConfig} from 'vocs/config';
import {vocs} from 'vocs/vite';

const shimsDir = path.join(import.meta.dirname, '../src/shims');

const shims: Record<string, string> = {
  'node:assert': path.join(shimsDir, 'node-assert.ts'),
  'node:assert/strict': path.join(shimsDir, 'node-assert.ts'),
  'node:crypto': path.join(shimsDir, 'node-crypto.ts'),
  // The `events` npm package is an API-compatible EventEmitter that works in every runtime.
  'node:events': 'events',
  'node:util': path.join(shimsDir, 'node-util.ts'),
};

/**
 * Shims Node.js built-ins in the client environment only: server environments run in Node.js
 * where the real built-ins exist (and vocs' own server dependencies rely on them).
 */
function nodeShims(): vite.Plugin {
  return {
    enforce: 'pre',
    name: 'node-builtin-shims',
    resolveId(source, importer) {
      if (this.environment.name !== 'client') {
        return null;
      }
      const shim = shims[source];
      if (!shim) {
        return null;
      }
      if (path.isAbsolute(shim)) {
        return shim;
      }
      return this.resolve(shim, importer, {skipSelf: true});
    },
  };
}

const command = process.argv[2];

if (command === 'dev') {
  const server = await vite.createServer({
    configFile: false,
    plugins: [nodeShims(), react(), vocs()],
  });
  await server.listen();
  server.printUrls();
} else if (command === 'build') {
  const config = await resolveConfig();
  const builder = await vite.createBuilder({
    build: {outDir: config.outDir},
    configFile: false,
    plugins: [nodeShims(), react(), vocs()],
  });
  await builder.buildApp();
} else {
  throw new Error(`Unknown command: ${String(command)} (expected "dev" or "build")`);
}
