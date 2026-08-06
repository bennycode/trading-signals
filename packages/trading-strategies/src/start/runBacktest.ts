import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {config} from 'dotenv-defaults';
import {z} from 'zod';
import {AlpacaBrokerMock, AlpacaMarketData, CandleSchema, OrderType, TradingPair} from '@typedtrader/exchange';
import type {Candle, MarketDataSource} from '@typedtrader/exchange';
import Big from 'big.js';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {createStrategy, getStrategyNames} from '../strategy/StrategyRegistry.js';
import {ScalpStrategy} from '../strategy-scalp/ScalpStrategy.js';

/*
 * Credentials load from the monorepo root .env first, then from the exchange package's .env
 * (the current home of broker secrets). Root wins on duplicate keys, so secrets can be
 * consolidated into a single root file without touching this script. No defaults file is
 * loaded — its placeholder values would masquerade as real credentials and trigger doomed
 * live-warmup requests on machines without a configured .env.
 */
config({path: '../../.env'});
config({path: '../exchange/.env'});

const {values} = parseArgs({
  options: {
    balance: {default: '10000', short: 'b', type: 'string'},
    config: {default: '{}', short: 'c', type: 'string'},
    data: {short: 'd', type: 'string'},
    strategy: {short: 's', type: 'string'},
  },
});

if (!values.data || !values.strategy) {
  console.log(
    'Usage: tsx src/start/runBacktest.ts --data <candles.json> --strategy <name> [--config <json>] [--balance <amount>]'
  );
  console.log('');
  console.log('Options:');
  console.log('  --data, -d       Path to candle JSON file');
  console.log('  --strategy, -s   Strategy name from registry');
  console.log('  --config, -c     Strategy config as JSON (default: {})');
  console.log('  --balance, -b    Starting cash in counter currency (default: 10000)');
  console.log('');
  console.log('Available strategies:');
  for (const name of getStrategyNames()) {
    console.log(`  ${name}`);
  }
  process.exit(1);
}

// 1. Load candle data
let raw: string;
try {
  raw = await readFile(values.data, 'utf8');
} catch (error) {
  console.error(
    `Failed to read candle file "${values.data}": ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

let candles: Candle[];
try {
  candles = z.array(CandleSchema).parse(JSON.parse(raw));
} catch (error) {
  console.error(`Invalid candle file "${values.data}": ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (candles.length === 0) {
  console.error(`Candle file "${values.data}" is empty. Need at least one candle to run a backtest.`);
  process.exit(1);
}

const firstCandle = candles[0];
const lastCandle = candles[candles.length - 1];
const tradingPair = new TradingPair(firstCandle.base, firstCandle.counter);
const startingBalance = new Big(values.balance);
const counter = tradingPair.counter;

console.log(`Candles:   ${candles.length} from ${values.data}`);
console.log(`Period:    ${firstCandle.openTimeInISO.slice(0, 10)} → ${lastCandle.openTimeInISO.slice(0, 10)}`);
console.log(`Pair:      ${tradingPair.asString('/')}`);
console.log(`Open:      ${firstCandle.open} ${counter}  Close: ${lastCandle.close} ${counter}`);
console.log(`Strategy:  ${values.strategy}`);
console.log(`Config:    ${values.config}`);
console.log(`Balance:   ${startingBalance.toFixed(2)} ${counter}`);
console.log('---');

// 2. Create strategy from registry
const strategyConfig: unknown = JSON.parse(values.config);
const strategy = createStrategy(values.strategy, strategyConfig);

// 3. Set up mock exchange (commission-free for US stocks)
const exchange = new AlpacaBrokerMock({
  balances: new Map([
    [tradingPair.base, {available: new Big(0), hold: new Big(0)}],
    [tradingPair.counter, {available: startingBalance, hold: new Big(0)}],
  ]),
  feeRates: {
    [OrderType.LIMIT]: new Big(0),
    [OrderType.MARKET]: new Big(0),
  },
});

/*
 * 4. Warm up the strategy. With Alpaca credentials configured, warmup candles are fetched
 * live from just before the backtest window, so the warmup never sees the candles the
 * backtest replays. Without credentials (or when the fetch fails, e.g. for non-Alpaca
 * pairs), the file's own history is served instead — with the look-ahead that implies.
 */
const alpacaApiKey = process.env.ALPACA_LIVE_API_KEY;
const alpacaApiSecret = process.env.ALPACA_LIVE_API_SECRET;
const liveMarketData =
  alpacaApiKey && alpacaApiSecret
    ? new AlpacaMarketData({apiKey: alpacaApiKey, apiSecret: alpacaApiSecret, usePaperTrading: false})
    : null;

const market: Pick<MarketDataSource, 'getRecentCandles'> = {
  getRecentCandles: async (pair, count, intervalInMillis) => {
    if (liveMarketData) {
      try {
        // Over-ask 2x so weekends and market holidays still leave enough candles.
        const spanInMillis = count * intervalInMillis * 2;
        const preWindowCandles = await liveMarketData.getCandles(pair, {
          intervalInMillis,
          startTimeFirstCandle: new Date(firstCandle.openTimeInMillis - spanInMillis).toISOString(),
          startTimeLastCandle: new Date(firstCandle.openTimeInMillis - intervalInMillis).toISOString(),
        });

        if (preWindowCandles.length > 0) {
          console.log(`Warmup:    ${Math.min(count, preWindowCandles.length)} pre-window candles from Alpaca`);
          return preWindowCandles.slice(-count);
        }
      } catch (error) {
        console.warn(`Warmup:    live fetch failed (${error instanceof Error ? error.message : String(error)})`);
      }
    }

    console.log('Warmup:    using the backtest file itself (includes the replayed window)');
    return candles;
  },
};

await strategy.init(market, tradingPair);

if (strategy.config?.offset) {
  console.log(`Auto-computed offset: ${strategy.config.offset} ${counter}`);
}

if (strategy instanceof ScalpStrategy) {
  console.log(
    `Scalp-friendly (ER): ${strategy.scalpFriendly ? 'Yes' : 'No — stock is trending, strategy will not trade'}`
  );
  console.log('---');
}

// 5. Run backtest
const result = await new BacktestExecutor({
  broker: exchange,
  candles,
  strategy,
  tradingPair,
}).execute();

// 6. Print results
const {performance} = result;

console.log('');
console.log('=== BACKTEST RESULTS ===');
console.log(`Strategy:        ${values.strategy}`);
console.log(`Pair:            ${tradingPair.asString('/')}`);
console.log(`Period:          ${firstCandle.openTimeInISO.slice(0, 10)} → ${lastCandle.openTimeInISO.slice(0, 10)}`);
console.log(`Candles:         ${result.totalCandles}`);
console.log(`Trades:          ${performance.totalTrades}`);
console.log(`Win Rate:        ${performance.winRate.toFixed(1)}%`);
console.log(`Return:          ${performance.returnPercentage.toFixed(2)}%`);
console.log(`Buy & Hold:      ${performance.buyAndHoldReturnPercentage.toFixed(2)}%`);
console.log(`P&L:             ${result.profitOrLoss.toFixed(2)} ${counter}`);
console.log(`Fees:            ${result.totalFees.toFixed(2)} ${counter}`);
console.log(`Max Win Streak:  ${performance.maxWinStreak}`);
console.log(`Max Loss Streak: ${performance.maxLossStreak}`);
console.log(
  `Portfolio:       ${performance.initialPortfolioValue.toFixed(2)} → ${performance.finalPortfolioValue.toFixed(2)} ${counter}`
);
