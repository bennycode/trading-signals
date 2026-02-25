import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({path: path.join(import.meta.dirname, '../../exchange/.env')});
import {getAlpacaClient, TradingPair} from '@typedtrader/exchange';
import {OrderImbalanceStrategy, OrderImbalanceSchema, OrderBookRunner} from './index.js';

const SYMBOL = 'INTC';
const DRY_RUN = process.env.DRY_RUN !== 'false';

// Live credentials for the quote stream (paper account lacks IEX streaming access)
const streamCredentials = {
  apiKey: process.env.ALPACA_LIVE_API_KEY ?? '',
  apiSecret: process.env.ALPACA_LIVE_API_SECRET ?? '',
  usePaperTrading: false,
};

// Paper credentials for order placement
const exchange = getAlpacaClient({
  apiKey: process.env.ALPACA_PAPER_API_KEY ?? '',
  apiSecret: process.env.ALPACA_PAPER_API_SECRET ?? '',
  usePaperTrading: true,
});

const strategyConfig = OrderImbalanceSchema.parse({
  imbalanceBuyThreshold: 0.3,
  imbalanceSellThreshold: -0.3,
  minTotalSize: 100,
});

const strategy = new OrderImbalanceStrategy(strategyConfig);
const pair = new TradingPair(SYMBOL, 'USD');
const runner = new OrderBookRunner(streamCredentials, strategy, exchange, pair, 'v2/iex', DRY_RUN);

console.log(`Starting OrderBookRunner for ${SYMBOL} (${DRY_RUN ? 'DRY RUN' : 'paper orders'}, live quotes)`);
console.log(`Config: buy >= ${strategyConfig.imbalanceBuyThreshold}, sell <= ${strategyConfig.imbalanceSellThreshold}, minSize ${strategyConfig.minTotalSize}`);
console.log('Press Ctrl+C to stop.\n');

await runner.start();
