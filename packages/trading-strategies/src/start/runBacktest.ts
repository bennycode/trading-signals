import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {AlpacaExchangeMock, ExchangeOrderType, TradingPair} from '@typedtrader/exchange';
import type {ExchangeCandle} from '@typedtrader/exchange';
import Big from 'big.js';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {createStrategy, getStrategyNames} from '../strategy/StrategyRegistry.js';

const {values} = parseArgs({
  options: {
    data: {type: 'string', short: 'd'},
    strategy: {type: 'string', short: 's'},
    config: {type: 'string', short: 'c', default: '{}'},
    balance: {type: 'string', short: 'b', default: '10000'},
  },
});

if (!values.data || !values.strategy) {
  console.log('Usage: tsx src/start/runBacktest.ts --data <candles.json> --strategy <name> [--config <json>] [--balance <amount>]');
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
  console.error(`Failed to read candle file "${values.data}": ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

let candles: ExchangeCandle[];
try {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Candle file must contain a JSON array');
  }
  candles = parsed;
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
const startingBalance = new Big(values.balance!);
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
const strategyConfig = JSON.parse(values.config!);
const strategy = createStrategy(values.strategy, strategyConfig);

// 3. Set up mock exchange (commission-free for US stocks)
const exchange = new AlpacaExchangeMock({
  balances: new Map([
    [tradingPair.base, {available: new Big(0), hold: new Big(0)}],
    [tradingPair.counter, {available: startingBalance, hold: new Big(0)}],
  ]),
  feeRates: {
    [ExchangeOrderType.MARKET]: new Big(0),
    [ExchangeOrderType.LIMIT]: new Big(0),
  },
});

// 4. Pre-seed strategy if it supports init()
if ('init' in strategy && typeof strategy.init === 'function') {
  const {CandleBatcher} = await import('@typedtrader/exchange');
  const batchedCandles = CandleBatcher.toBatchedCandles(candles);
  strategy.init(batchedCandles);

  if (strategy.config?.offset) {
    console.log(`Auto-computed offset: ${strategy.config.offset} ${counter}`);
  }

  if ('scalpFriendly' in strategy) {
    const friendly = strategy.scalpFriendly as boolean;
    console.log(`Scalp-friendly (ER): ${friendly ? 'Yes' : 'No — stock is trending, strategy will not trade'}`);
  }

  console.log('---');
}

// 5. Run backtest
const result = await new BacktestExecutor({
  candles,
  exchange,
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
console.log(`Portfolio:       ${performance.initialPortfolioValue.toFixed(2)} → ${performance.finalPortfolioValue.toFixed(2)} ${counter}`);
