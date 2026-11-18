/*
 * Browser shim for the `node:https` surface used by @typedtrader/exchange (wired up via
 * `scripts/site.ts`). The IBKR broker builds an `Agent` to reach its local Client Portal Gateway,
 * and the package barrel pulls that module into the client graph even though the backtest page
 * only ever constructs broker mocks.
 *
 * None of it can run in a browser — there is no gateway on localhost and no TLS agent to
 * configure — so the constructor throws rather than pretending to be one. An import alone stays
 * harmless, which is all the bundle needs.
 */

export class Agent {
  constructor() {
    throw new Error('https.Agent is not available in the browser build.');
  }
}
