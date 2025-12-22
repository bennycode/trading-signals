import 'dotenv-defaults/config.js';
import {getAlpacaClient} from './getAlpacaClient.js';
import {CurrencyPair} from './CurrencyPair.js';
import ms from 'ms';
import {ExchangeCandle} from './Exchange.js';

const usePaperTrading = process.env.ALPACA_USE_PAPER === 'true';
const apiKey = usePaperTrading ? (process.env.ALPACA_PAPER_API_KEY ?? '') : (process.env.ALPACA_LIVE_API_KEY ?? '');
const apiSecret = usePaperTrading
  ? (process.env.ALPACA_PAPER_API_SECRET ?? '')
  : (process.env.ALPACA_LIVE_API_SECRET ?? '');

const client = getAlpacaClient({
  apiKey,
  apiSecret,
  usePaperTrading,
});

console.log('paper trading', usePaperTrading);

console.log('time', await client.getTime());

const pair = new CurrencyPair('SHOP', 'USD');

const interval = '1m';
const intervalInMillis = ms(interval);
const now = new Date();
const startDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);

console.log(
  `Trying to fetch 1 day of price data using "${interval}" interval candles. Starting on the first day of the past year where the trading exchange was open...`
);

let currentDay = new Date(startDate);
let candles: ExchangeCandle[] = [];

while (candles.length === 0 && currentDay <= now) {
  const endOfDay = new Date(currentDay);
  endOfDay.setHours(23, 59, 59, 999);

  const endTime = endOfDay < now ? endOfDay : now;

  console.log(`Trying day: ${currentDay.toISOString()}`);

  candles = await client.getCandles(pair, {
    intervalInMillis,
    startTimeFirstCandle: currentDay.toISOString(),
    startTimeLastCandle: endTime.toISOString(),
  });

  if (candles.length === 0) {
    currentDay.setDate(currentDay.getDate() + 1);
  }
}

console.log(`Found "${candles.length}" candles starting from "${currentDay.toISOString()}".`);
console.log(`First candle`, candles[0]);
