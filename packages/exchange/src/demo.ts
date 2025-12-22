import 'dotenv-defaults/config.js';
import {getAlpacaClient} from './getAlpacaClient.js';
import {CurrencyPair} from './CurrencyPair.js';
import ms from 'ms';

const usePaperTrading = process.env.ALPACA_USE_PAPER === 'true';
const apiKey = usePaperTrading
  ? process.env.ALPACA_PAPER_API_KEY ?? ''
  : process.env.ALPACA_LIVE_API_KEY ?? '';
const apiSecret = usePaperTrading
  ? process.env.ALPACA_PAPER_API_SECRET ?? ''
  : process.env.ALPACA_LIVE_API_SECRET ?? '';

const client = getAlpacaClient({
  apiKey,
  apiSecret,
  usePaperTrading,
});

console.log('paper trading', usePaperTrading);

console.log('time', await client.getTime());

const pair = new CurrencyPair('SHOP', 'USD');

const intervalInMillis = ms('1h');
const now = new Date();
const dayOfWeek = now.getDay();
const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
const monday = new Date(now);
monday.setDate(now.getDate() - daysToMonday);
monday.setHours(0, 0, 0, 0);

const candles = await client.getCandles(pair, {
  intervalInMillis,
  startTimeFirstCandle: monday.toISOString(),
  startTimeLastCandle: now.toISOString(),
});

console.log(candles);
