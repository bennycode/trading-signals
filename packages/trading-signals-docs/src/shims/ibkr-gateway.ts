/**
 * Stands in for `@typedtrader/exchange`'s IBKR gateway launcher in the browser bundle.
 *
 * The launcher downloads and runs IBKR's Client Portal Gateway, a Java process, and drives its
 * login with Playwright. Its module graph therefore reaches `node:child_process`, `node:fs` and
 * Playwright's own `fs`/`dns` usage, none of which rolldown can bundle for the client — and the
 * backtest page only ever uses broker mocks, so none of it is wanted here.
 *
 * `IbkrBroker` reaches the launcher through a dynamic import, which a bundler still follows and
 * resolves, so leaving this out breaks the docs build rather than merely bloating it.
 */
export const IbkrGatewayLauncher = {
  for() {
    throw new Error('The IBKR gateway cannot be launched in a browser.');
  },
};

export function toIbkrGatewayLauncher(): undefined {
  return undefined;
}
