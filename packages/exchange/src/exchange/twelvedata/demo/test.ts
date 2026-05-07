import 'dotenv-defaults/config';
import assert from 'node:assert/strict';
import {TradingPair} from '../../TradingPair.js';
import {getTrading212Client} from '../../trading212/getTrading212Client.js';
import {getTwelveDataMarketData} from '../getTwelveDataMarketData.js';

const apiKey = process.env.TWELVEDATA_API_KEY;
assert.ok(apiKey, 'Missing TWELVEDATA_API_KEY in environment');

const marketData = getTwelveDataMarketData({apiKey});

// 1. Fetch candles directly from the Twelve Data market-data source
console.log('\n--- direct: getCandles AAPL/USD 1min x5 ---');
const candles = await marketData.getCandles(new TradingPair('AAPL', 'USD'), {
  intervalInMillis: 60_000,
  startTimeFirstCandle: '2026-05-06T15:55:00.000Z',
  startTimeLastCandle: '2026-05-06T15:59:00.000Z',
});
console.log(`got ${candles.length} candles`);
console.log(candles[0]);

// 2. Wire it into Trading212Exchange and call getCandles via the broker
const t212ApiKey = process.env.TRADING212_PAPER_API_KEY;
const t212ApiSecret = process.env.TRADING212_PAPER_API_SECRET;
if (t212ApiKey && t212ApiSecret) {
  console.log('\n--- via Trading212Exchange: getLatestCandle AAPL_US_EQ/USD 1day ---');
  const exchange = getTrading212Client({
    apiKey: t212ApiKey,
    apiSecret: t212ApiSecret,
    usePaperTrading: true,
    marketData,
  });
  const latest = await exchange.getLatestCandle(new TradingPair('AAPL_US_EQ', 'USD'), 86_400_000);
  console.log(latest);
} else {
  console.log('\n(skipping Trading212 delegation — no TRADING212_PAPER credentials)');
}

marketData.disconnect();
console.log('\nDone.');
