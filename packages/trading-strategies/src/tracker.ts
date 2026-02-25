import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({path: path.join(import.meta.dirname, '../../exchange/.env')});
import {alpacaWebSocket, type QuoteMessage} from '@typedtrader/exchange';

const SYMBOL = process.env.SYMBOL ?? 'INTC';

// --- State ---
const state = {
  quoteCount: 0,
  lastQuote: null as QuoteMessage | null,
  highAsk: -Infinity,
  lowAsk: Infinity,
  highBid: -Infinity,
  lowBid: Infinity,
  imbalanceHistory: [] as number[],
  startedAt: new Date(),
};

function computeImbalance(msg: QuoteMessage): number {
  const total = msg.bs + msg.as;
  return total > 0 ? (msg.bs - msg.as) / total : 0;
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

// --- Connect ---
const credentials = {
  apiKey: process.env.ALPACA_LIVE_API_KEY ?? '',
  apiSecret: process.env.ALPACA_LIVE_API_SECRET ?? '',
  usePaperTrading: false,
};

console.log(`Connecting for ${SYMBOL}... (Ctrl+C to stop)\n`);
const connection = await alpacaWebSocket.connect(credentials, 'v2/iex');

alpacaWebSocket.subscribeToQuotes(connection.connectionId, SYMBOL, msg => {
  state.quoteCount++;
  state.lastQuote = msg;
  state.highAsk = Math.max(state.highAsk, msg.ap);
  state.lowAsk = Math.min(state.lowAsk, msg.ap);
  state.highBid = Math.max(state.highBid, msg.bp);
  state.lowBid = Math.min(state.lowBid, msg.bp);

  const imbalance = computeImbalance(msg);
  state.imbalanceHistory.push(imbalance);
  if (state.imbalanceHistory.length > 500) {
    state.imbalanceHistory.shift();
  }
});

// --- Periodic report ---
setInterval(() => {
  const q = state.lastQuote;
  if (!q) {
    console.log('Waiting for quotes...');
    return;
  }

  const imbalance = computeImbalance(q);
  const avgImbalance = avg(state.imbalanceHistory);
  const uptimeSeconds = Math.round((Date.now() - state.startedAt.getTime()) / 1000);
  const sentiment = avgImbalance > 0.1 ? 'bullish' : avgImbalance < -0.1 ? 'bearish' : 'neutral';

  console.log(`\n[${new Date().toISOString()}] ${SYMBOL} — uptime ${uptimeSeconds}s | quotes ${state.quoteCount}`);
  console.log(`  Bid $${q.bp.toFixed(2)} (${q.bs})  Ask $${q.ap.toFixed(2)} (${q.as})  spread $${(q.ap - q.bp).toFixed(2)}`);
  console.log(`  Ask range $${state.lowAsk.toFixed(2)}–$${state.highAsk.toFixed(2)}  Bid range $${state.lowBid.toFixed(2)}–$${state.highBid.toFixed(2)}`);
  console.log(`  Imbalance now ${imbalance.toFixed(3)}  avg(last ${state.imbalanceHistory.length}) ${avgImbalance.toFixed(3)}  → ${sentiment}`);
}, 5_000);

// --- Graceful shutdown ---
process.on('SIGINT', () => {
  console.log(`\nShutting down. Total quotes received: ${state.quoteCount}`);
  connection.stream.close();
  process.exit(0);
});
