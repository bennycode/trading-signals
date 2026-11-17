import {OrderType} from '../../Broker.js';
import {TradingPair} from '../../TradingPair.js';
import {getIbkrClient} from '../getIbkrClient.js';
import Big from 'big.js';
import {ms} from 'ms';

/**
 * Read-only smoke test against a running Client Portal Gateway. Places no orders, so it is safe
 * to point at a live account.
 *
 * The gateway must be logged in first (`npm run gateway:ibkr:op`, then approve the IB Key push).
 */
const pair = new TradingPair(process.env.IBKR_DEMO_SYMBOL ?? 'AAPL', 'USD');

/** No `marketData`: candles come from IBKR's own history endpoint. */
const broker = getIbkrClient({
  gatewayUrl: process.env.IBKR_GATEWAY_URL ?? 'https://localhost:5001',
});

async function section(name: string, run: () => Promise<unknown>) {
  try {
    const result = await run();
    console.info(`\n=== ${name} ===`);
    console.info(result);
  } catch (error) {
    console.error(`\n=== ${name} FAILED ===`);
    console.error(error instanceof Error ? error.message : error);
  }
}

await section('verifyCredentials', async () => {
  await broker.verifyCredentials();
  return 'session is authenticated';
});

await section('getAccountId', () => broker.getAccountId());

await section('getConid', () => broker.getConid(pair));

await section('listBalances', () => broker.listBalances());

await section('getTradingRules', () => broker.getTradingRules(pair));

await section('getFeeRates', async () => {
  const rates = await broker.getFeeRates(pair);
  return {LIMIT: rates.LIMIT.toString(), MARKET: rates.MARKET.toString()};
});

await section('estimateFee (1000 notional)', async () => {
  const estimate = await broker.estimateFee(pair, OrderType.MARKET, new Big(1_000));
  return {
    commission: estimate.commission.toString(),
    feeAsset: estimate.feeAsset,
    total: estimate.total.toString(),
  };
});

await section('getOpenOrders', () => broker.getOpenOrders(pair));

await section('getFills', async () => (await broker.getFills(pair)).slice(0, 3));

await section('getRecentCandles (3 daily)', async () =>
  (await broker.getRecentCandles(pair, 3, ms('1d'))).map(candle => ({
    close: candle.close,
    openTimeInISO: candle.openTimeInISO,
    volume: candle.volume,
  }))
);

broker.disconnect();
