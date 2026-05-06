import 'dotenv-defaults/config';
import axios from 'axios';
import {ExchangeOrderSide} from '../../Exchange.js';
import {TradingPair} from '../../TradingPair.js';
import {getTrading212Client} from '../getTrading212Client.js';

const usePaperTrading = process.env.TRADING212_USE_PAPER !== 'false';
const apiKey = usePaperTrading ? process.env.TRADING212_PAPER_API_KEY : process.env.TRADING212_LIVE_API_KEY;
const apiSecret = usePaperTrading ? process.env.TRADING212_PAPER_API_SECRET : process.env.TRADING212_LIVE_API_SECRET;

const exchange = getTrading212Client({
  apiKey: apiKey ?? '',
  apiSecret: apiSecret ?? '',
  usePaperTrading,
});

const pair = new TradingPair('AAPL_US_EQ', 'USD');

async function section<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  console.log(`\n--- ${name} ---`);
  try {
    const result = await fn();
    console.log(result);
    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`FAILED: HTTP ${error.response?.status} ${JSON.stringify(error.response?.data)}`);
    } else {
      console.error(`FAILED: ${error instanceof Error ? error.message : error}`);
    }
    return undefined;
  }
}

// 1. getTime
await section('getTime', () => exchange.getTime());

// 2. getName / getSmallestInterval
console.log('\n--- getName / getSmallestInterval ---');
console.log('name:', exchange.getName(), 'smallest interval (ms):', exchange.getSmallestInterval());

// 3. getFeeRates
await section('getFeeRates', async () => {
  const rates = await exchange.getFeeRates(pair);
  return {LIMIT: rates.LIMIT.toString(), MARKET: rates.MARKET.toString()};
});

// 4. getTradingRules
await section('getTradingRules', () => exchange.getTradingRules(pair));

// 5. listBalances (truncated)
await section('listBalances', async () => {
  const balances = await exchange.listBalances();
  return `${balances.length} entries (first 3): ${JSON.stringify(balances.slice(0, 3))}`;
});

// 6. Place a LIMIT BUY below market so it stays open, then query, cancel by id
const placed = await section('placeLimitOrder (BUY 1 AAPL @ $220)', () =>
  exchange.placeLimitOrder(pair, {price: '220', side: ExchangeOrderSide.BUY, size: '1'})
);

await section('getOpenOrders', () => exchange.getOpenOrders(pair));

if (placed) {
  await section(`cancelOrderById (${placed.id})`, async () => {
    await exchange.cancelOrderById(pair, placed.id);
    return 'cancelled';
  });
}

// 7. Place another, then cancelOpenOrders
const second = await section('placeLimitOrder #2 (BUY 1 AAPL @ $215)', () =>
  exchange.placeLimitOrder(pair, {price: '215', side: ExchangeOrderSide.BUY, size: '1'})
);

if (second) {
  await section('cancelOpenOrders', () => exchange.cancelOpenOrders(pair));
}

// 8. getFills (limit to first 3 to keep output readable)
await section('getFills (first 3)', async () => {
  const fills = await exchange.getFills(pair);
  return {count: fills.length, sample: fills.slice(0, 3)};
});

// 9. getAvailableBalances
await section('getAvailableBalances', async () => {
  const bal = await exchange.getAvailableBalances(pair);
  return {base: bal.base.toString(), counter: bal.counter.toString()};
});

// 10. Methods that should throw
async function expectThrow(name: string, fn: () => Promise<unknown>) {
  console.log(`\n--- ${name} (expecting throw) ---`);
  try {
    await fn();
    console.log('UNEXPECTED: did not throw');
  } catch (error) {
    console.log(`OK: threw "${error instanceof Error ? error.message : error}"`);
  }
}

await expectThrow('getCandles', () =>
  exchange.getCandles(pair, {
    intervalInMillis: 60_000,
    startTimeFirstCandle: '2025-01-01T00:00:00Z',
    startTimeLastCandle: '2025-01-02T00:00:00Z',
  })
);
await expectThrow('getLatestCandle', () => exchange.getLatestCandle(pair, 60_000));
await expectThrow('watchCandles', () => exchange.watchCandles(pair, 60_000, new Date().toISOString()));
await expectThrow('watchOrders', () => exchange.watchOrders());

console.log('\n--- disconnect ---');
exchange.disconnect();
console.log('OK');
process.exit(0);
