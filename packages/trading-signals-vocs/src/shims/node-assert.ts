/*
 * Browser shim for the `node:assert` / `node:assert/strict` surface used by
 * @typedtrader/exchange and trading-strategies (wired up via `scripts/site.ts`). BrokerMock
 * asserts invariants at runtime in the browser, so this must actually work. The packages call
 * the default export directly and as `assert.ok(...)`.
 */

function assertValue(value: unknown, message?: string | Error): asserts value {
  if (!value) {
    if (message instanceof Error) {
      throw message;
    }
    throw new Error(message ?? 'Assertion failed');
  }
}

const assert = Object.assign(assertValue, {ok: assertValue});

export default assert;
