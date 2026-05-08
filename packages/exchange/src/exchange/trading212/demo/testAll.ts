import 'dotenv-defaults/config';
import axios from 'axios';
import {ExchangeOrderSide} from '../../Broker.js';
import {TradingPair} from '../../TradingPair.js';
import {getDemoClient} from './getDemoClient.js';

const exchange = getDemoClient();

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

// What time is it on the broker?
await section('getTime', () => exchange.getTime());

// Basic info about the exchange
console.log('\n--- getName / getSmallestInterval ---');
console.log('name:', exchange.getName(), 'smallest interval (ms):', exchange.getSmallestInterval());

// What does it cost to trade?
await section('getFeeRates', async () => {
  const rates = await exchange.getFeeRates(pair);
  return {LIMIT: rates.LIMIT.toString(), MARKET: rates.MARKET.toString()};
});

// Minimum order size, price increment, etc.
await section('getTradingRules', () => exchange.getTradingRules(pair));

// What's in the account?
await section('listBalances', async () => {
  const balances = await exchange.listBalances();
  return `${balances.length} entries (first 3): ${JSON.stringify(balances.slice(0, 3))}`;
});

// Place a buy below market price so it stays open, then look it up and cancel it
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

// Place another open order, then cancel everything for this pair at once
const second = await section('placeLimitOrder #2 (BUY 1 AAPL @ $215)', () =>
  exchange.placeLimitOrder(pair, {price: '215', side: ExchangeOrderSide.BUY, size: '1'})
);

if (second) {
  await section('cancelOpenOrders', () => exchange.cancelOpenOrders(pair));
}

// Recent trades on the account (showing only a few to keep output short)
await section('getFills (first 3)', async () => {
  const fills = await exchange.getFills(pair);
  return {count: fills.length, sample: fills.slice(0, 3)};
});

// How much can we still trade?
await section('getAvailableBalances', async () => {
  const bal = await exchange.getAvailableBalances(pair);
  return {base: bal.base.toString(), counter: bal.counter.toString()};
});

// These features aren't offered by Trading212 and should refuse to run
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

// Order updates are checked on a timer rather than streamed; just confirm we can subscribe
await section('watchOrders (polling)', async () => {
  const topicId = await exchange.watchOrders();
  exchange.unwatchOrders(topicId);
  return `subscribed + unsubscribed (topicId: ${topicId})`;
});

console.log('\n--- disconnect ---');
exchange.disconnect();
console.log('OK');
process.exit(0);
