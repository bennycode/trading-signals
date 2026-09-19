/*
 * Browser shim for the `node:crypto` surface used by @typedtrader/exchange and
 * trading-strategies (wired up via `scripts/site.ts`). Only `randomUUID` actually runs in the
 * browser (BrokerMock order ids); `createHash` lives in report tooling that never executes
 * client-side, so it throws instead of pulling in a hashing implementation.
 */

export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

export function createHash(algorithm: string): never {
  throw new Error(`createHash('${algorithm}') is not available in the browser build.`);
}
