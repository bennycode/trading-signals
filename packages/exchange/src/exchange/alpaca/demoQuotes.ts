import 'dotenv-defaults/config.js';
import {alpacaWebSocket} from './AlpacaWebSocket.js';

const SYMBOL = process.env.SYMBOL ?? 'INTC';
const TICK_SIZE = 0.05; // bucket ask prices to nearest $0.05
const WINDOW_SIZE = 500; // rolling window of quotes
const TOP_N = 5; // print top N resistance levels
const PRINT_INTERVAL_MS = 5_000;

const usePaper = process.env.ALPACA_USE_PAPER !== 'false';
const credentials = {
  apiKey: usePaper ? (process.env.ALPACA_PAPER_API_KEY ?? '') : (process.env.ALPACA_LIVE_API_KEY ?? ''),
  apiSecret: usePaper ? (process.env.ALPACA_PAPER_API_SECRET ?? '') : (process.env.ALPACA_LIVE_API_SECRET ?? ''),
  usePaperTrading: usePaper,
};
console.log(`Using ${usePaper ? 'paper' : 'live'} credentials (ALPACA_USE_PAPER=${process.env.ALPACA_USE_PAPER})`);

/** Round a price to the nearest tick. */
function bucket(price: number): number {
  return Math.round(price / TICK_SIZE) * TICK_SIZE;
}

/** Build a frequency histogram from an array of bucketed ask prices. */
function buildHistogram(prices: number[]): Map<number, number> {
  const histogram = new Map<number, number>();
  for (const price of prices) {
    histogram.set(price, (histogram.get(price) ?? 0) + 1);
  }
  return histogram;
}

/** Return the top N most-frequent prices as resistance levels. */
function topResistanceLevels(histogram: Map<number, number>, n: number): {count: number; price: number}[] {
  return Array.from(histogram.entries())
    .map(([price, count]) => ({count, price}))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

console.log(`Connecting to Alpaca (paper) and streaming quotes for ${SYMBOL}...`);
const connection = await alpacaWebSocket.connect(credentials, 'v2/iex');

const askWindow: number[] = [];
let quoteCount = 0;

alpacaWebSocket.subscribeToQuotes(connection.connectionId, SYMBOL, msg => {
  quoteCount++;
  const bucketed = bucket(msg.ap);
  askWindow.push(bucketed);
  if (askWindow.length > WINDOW_SIZE) {
    askWindow.shift();
  }
});

console.log(`Subscribed. Printing resistance levels every ${PRINT_INTERVAL_MS / 1000}s (Ctrl+C to stop).\n`);

setInterval(() => {
  if (askWindow.length === 0) {
    console.log('Waiting for quotes...');
    return;
  }

  const histogram = buildHistogram(askWindow);
  const levels = topResistanceLevels(histogram, TOP_N);
  const currentAsk = askWindow.at(-1)!;

  console.log(`--- ${new Date().toISOString()} | ${SYMBOL} | quotes received: ${quoteCount} | current ask: $${currentAsk.toFixed(2)} ---`);
  console.log('Top resistance levels (by ask-price clustering):');
  for (const {price, count} of levels) {
    const bar = '█'.repeat(Math.round((count / askWindow.length) * 40));
    console.log(`  $${price.toFixed(2)}  ${bar}  (${count}/${askWindow.length} = ${((count / askWindow.length) * 100).toFixed(1)}%)`);
  }
  console.log('');
}, PRINT_INTERVAL_MS);
