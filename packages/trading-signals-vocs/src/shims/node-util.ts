/*
 * Browser shim for the `node:util` surface used by trading-strategies (wired up via
 * `scripts/site.ts`). `parseArgs` is only reached by CLI entry points that never execute
 * client-side, so it throws instead of shipping a real implementation.
 */

export function parseArgs(): never {
  throw new Error('parseArgs is not available in the browser build.');
}
