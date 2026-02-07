import 'dotenv-defaults/config.js';
import {ms, format} from 'ms';
import {getAlpacaClient} from './alpaca/getAlpacaClient.js';
import {CurrencyPair} from './core/CurrencyPair.js';

const exchange = getAlpacaClient({
  apiKey: process.env.ALPACA_PAPER_API_KEY ?? '',
  apiSecret: process.env.ALPACA_PAPER_API_SECRET ?? '',
  usePaperTrading: true,
});

// 1. Exchange time
const time = await exchange.getTime();
console.log(`[getTime] Exchange time: ${time}`);

// 2. Historical stock candles
const APPLE_USD_STOCK = new CurrencyPair('AAPL', 'USD');
const ONE_MINUTE_INTERVAL = ms('1m');
const ONE_DAY_INTERVAL = ms('1d');
const ONE_HOUR_INTERVAL = ms('1h');
const stockCandles = await exchange.getCandles(APPLE_USD_STOCK, {
  intervalInMillis: ONE_HOUR_INTERVAL,
  startTimeFirstCandle: '2025-01-06T14:30:00.000Z',
  startTimeLastCandle: '2025-01-06T20:30:00.000Z',
});
console.log(
  `[getCandles] ${APPLE_USD_STOCK.asString('/')} ${format(ONE_HOUR_INTERVAL)} candles: ${stockCandles.length}`
);
console.log(stockCandles[0]);

// 3. Historical crypto candles
const btc = new CurrencyPair('BTC', 'USD');
const cryptoCandles = await exchange.getCandles(btc, {
  intervalInMillis: ONE_HOUR_INTERVAL,
  startTimeFirstCandle: '2025-01-06T00:00:00.000Z',
  startTimeLastCandle: '2025-01-06T23:00:00.000Z',
});
console.log(`[getCandles] ${btc.asString('/')} ${format(ONE_HOUR_INTERVAL)} candles: ${cryptoCandles.length}`);
console.log(cryptoCandles[0]);

// 4. Latest stock candle
const latestStock = await exchange.getLatestCandle(APPLE_USD_STOCK, ONE_DAY_INTERVAL);
console.log(`[getLatestCandle] ${APPLE_USD_STOCK.asString('/')} latest ${format(ONE_DAY_INTERVAL)} candle:`);
console.log(latestStock);

// 5. Latest crypto candle
const latestCrypto = await exchange.getLatestCandle(btc, ONE_DAY_INTERVAL);
console.log(`[getLatestCandle] ${btc.asString('/')} latest ${format(ONE_DAY_INTERVAL)} candle:`);
console.log(latestCrypto);

// 6. Real-time WebSocket streaming
console.log(`[watchCandles] Subscribing to ${btc.asString('/')} ${format(ONE_MINUTE_INTERVAL)} bars via WebSocket...`);
const topicId = await exchange.watchCandles(btc, ONE_MINUTE_INTERVAL, new Date().toISOString());
exchange.on(topicId, candle => {
  console.log(`[watchCandles] Received candle:`, candle);
  console.log(`[unwatchCandles] Unsubscribed from ${btc.asString('/')}`);
  exchange.disconnect();
});
