import Big from 'big.js';
import {AlpacaBrokerMock, CandleBatcher, OrderType} from '@typedtrader/exchange';
import type {Candle, TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from './BacktestExecutor.js';
import type {BacktestResult} from './BacktestResult.js';
import {createStrategy} from '../strategy/StrategyRegistry.js';
import type {Strategy} from '../strategy/Strategy.js';

export interface SingleBacktestParams {
  /** Hook fired after the strategy is seeded (`init`) but before the backtest runs — handy for logging derived config such as an auto-computed offset. */
  beforeRun?: (strategy: Strategy) => void;
  /** Candle data to replay, in chronological order. */
  candles: Candle[];
  /** Strategy config (validated by the strategy's own Zod schema in the registry). */
  config: unknown;
  /** Starting cash in the counter currency. */
  startingBalance: Big;
  /** Strategy name as registered in the {@link createStrategy} registry. */
  strategyName: string;
  /** The pair to trade, derived from the candle data. */
  tradingPair: TradingPair;
}

export interface SingleBacktestRun {
  result: BacktestResult;
  strategy: Strategy;
}

/**
 * Runs one strategy/config combination through the backtester on a fresh, commission-free mock exchange.
 * Shared by the single-run CLI and the parameter optimiser so both replay candles identically — the only
 * thing the optimiser varies is the config it passes in.
 */
export async function runSingleBacktest(params: SingleBacktestParams): Promise<SingleBacktestRun> {
  const {beforeRun, candles, config, startingBalance, strategyName, tradingPair} = params;

  const strategy = createStrategy(strategyName, config);

  // Commission-free mock exchange (matches US-stock trading on Alpaca).
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

  // Some strategies pre-seed indicators from history before the first live candle.
  if ('init' in strategy && typeof strategy.init === 'function') {
    strategy.init(CandleBatcher.toBatchedCandles(candles));
  }

  beforeRun?.(strategy);

  const result = await new BacktestExecutor({
    broker: exchange,
    candles,
    strategy,
    tradingPair,
  }).execute();

  return {result, strategy};
}
