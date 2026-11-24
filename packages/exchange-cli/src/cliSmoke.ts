import Big from 'big.js';
import {OrderType, type Broker, type CandleFeed, type TradingPair} from '@typedtrader/exchange';

/** What one call answered, or why it did not. */
interface SmokeCheck {
  check: string;
  error?: string;
  ok: boolean;
  result?: unknown;
}

/** The notional to price a fee estimate against, small enough that a per-order floor still shows. */
const ESTIMATE_NOTIONAL = new Big(1_000);

/**
 * Runs every read-only call in the broker interface against one instrument and reports each
 * separately.
 *
 * One failing call does not stop the others, because the question this answers is which parts of
 * an integration a given account can actually reach: market data needs a subscription, fee
 * estimates need a session, and an account can hold permissions for one and not the other. A run
 * that stopped at the first error would report a broker as broken when one endpoint is unentitled.
 *
 * Places no orders and cancels nothing, so it is safe to point at a live account.
 */
export async function runSmokeChecks(
  broker: Broker & CandleFeed,
  pair: TradingPair,
  interval: number
): Promise<{checks: SmokeCheck[]; ok: boolean; pair: string}> {
  const checks: SmokeCheck[] = [];

  const run = async (check: string, call: () => Promise<unknown>): Promise<void> => {
    try {
      checks.push({check, ok: true, result: await call()});
    } catch (error) {
      checks.push({check, error: error instanceof Error ? error.message : String(error), ok: false});
    }
  };

  await run('verifyCredentials', async () => {
    await broker.verifyCredentials();
    return 'authenticated';
  });
  await run('getTime', () => broker.getTime());
  await run('listBalances', () => broker.listBalances());
  await run('getTradingRules', () => broker.getTradingRules(pair));
  await run('getFeeRates', () => broker.getFeeRates(pair));
  await run(`estimateFee (${ESTIMATE_NOTIONAL.toString()} notional)`, () =>
    broker.estimateFee(pair, OrderType.MARKET, ESTIMATE_NOTIONAL)
  );
  await run('getOpenOrders', () => broker.getOpenOrders(pair));
  await run('getFills', async () => (await broker.getFills(pair)).slice(0, 3));
  await run('getLatestCandle', () => broker.getLatestCandle(pair, interval));
  await run('getRecentCandles', () => broker.getRecentCandles(pair, 3, interval));

  return {checks, ok: checks.every(check => check.ok), pair: pair.asString('/')};
}
