import Big from 'big.js';
import {AlpacaBroker, AlpacaBrokerMock, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {DynamicTrailStrategy} from './DynamicTrailStrategy.js';
import type {DynamicTrailConfig} from './DynamicTrailSchema.js';

export type TrailSuitabilityVerdict =
  /** Capped a real loss — worth running as a protective overlay. */
  | 'protective-fit'
  /** Tracked buy & hold within a hair — the trail stayed out of the way (no reversal to catch). */
  | 'rode-through'
  /** Exited a winning uptrend early and forfeited gains — wrong tool as a standalone return strategy. */
  | 'opportunity-cost'
  /** Stopped out early on a choppy, non-directional market — death by a thousand cuts. */
  | 'whipsaw-prone'
  /** None of the above cleanly applies — read the raw metrics. */
  | 'inconclusive';

export interface TrailSuitabilityReport {
  /** Worst peak-to-trough drawdown of the close price (%) — the downside the stop could protect against. */
  buyHoldMaxDrawdownPct: number;
  /** Return of simply holding from first to last close (%). */
  buyHoldReturnPct: number;
  /** `strategyReturnPct - buyHoldReturnPct`: positive = the stop helped, negative = opportunity cost. */
  edgeVsBuyHoldPct: number;
  /** Kaufman efficiency ratio of the closes (0 = pure chop, 1 = a straight line) — directionality. */
  efficiencyRatio: number;
  /** Whether the strategy exited during the series. */
  exited: boolean;
  /** Fill price of the exit, or `null` if it never exited. */
  exitPrice: number | null;
  /** Plain-language explanation of the verdict. */
  reason: string;
  /** Return of the strategy (%) — exit price vs entry, or buy & hold if it never exited. */
  strategyReturnPct: number;
  /** Fraction of the series the position was held before exiting (%). */
  timeInMarketPct: number;
  verdict: TrailSuitabilityVerdict;
}

export interface TrailSuitabilityOptions {
  /** Starting base-asset balance for the backtest. Defaults to `'1'`. */
  baseBalance?: string;
  /** Strategy config to assess. Defaults to a 3x ATR(14) trail. */
  config?: DynamicTrailConfig;
}

/** Worst peak-to-trough drawdown of the series, as a positive percentage. */
function maxDrawdownPct(closes: readonly number[]) {
  let peak = closes[0];
  let worst = 0;

  for (const close of closes) {
    if (close > peak) {
      peak = close;
    }

    const drawdown = ((peak - close) / peak) * 100;

    if (drawdown > worst) {
      worst = drawdown;
    }
  }

  return worst;
}

/** Kaufman efficiency ratio: net move divided by total path length. 1 = straight line, ~0 = chop. */
function efficiencyRatio(closes: readonly number[]) {
  if (closes.length < 2) {
    return 0;
  }

  const net = Math.abs(closes[closes.length - 1] - closes[0]);
  let path = 0;

  for (let index = 1; index < closes.length; index++) {
    path += Math.abs(closes[index] - closes[index - 1]);
  }

  return path === 0 ? 0 : net / path;
}

function classify(metrics: {
  buyHoldMaxDrawdownPct: number;
  buyHoldReturnPct: number;
  edgeVsBuyHoldPct: number;
  efficiencyRatio: number;
  exited: boolean;
  strategyReturnPct: number;
  timeInMarketPct: number;
}): {reason: string; verdict: TrailSuitabilityVerdict} {
  const {buyHoldReturnPct, edgeVsBuyHoldPct, efficiencyRatio: er, exited, strategyReturnPct, timeInMarketPct} = metrics;

  if (edgeVsBuyHoldPct > 1 && buyHoldReturnPct < 0) {
    return {
      reason: `Capped the loss at ${strategyReturnPct.toFixed(1)}% vs buy & hold ${buyHoldReturnPct.toFixed(1)}% (saved ${edgeVsBuyHoldPct.toFixed(1)}pp).`,
      verdict: 'protective-fit',
    };
  }

  if (edgeVsBuyHoldPct < -5 && buyHoldReturnPct > 0) {
    return {
      reason: `Exited a winning uptrend early — gave up ${(-edgeVsBuyHoldPct).toFixed(1)}pp vs buy & hold (+${buyHoldReturnPct.toFixed(1)}%).`,
      verdict: 'opportunity-cost',
    };
  }

  if (Math.abs(edgeVsBuyHoldPct) <= 1) {
    return {
      reason: `Tracked buy & hold within ${Math.abs(edgeVsBuyHoldPct).toFixed(1)}pp — the trail stayed out of the way.`,
      verdict: 'rode-through',
    };
  }

  if (exited && timeInMarketPct < 30 && er < 0.4) {
    return {
      reason: `Stopped out after ${timeInMarketPct.toFixed(0)}% of the series on a choppy market (efficiency ${er.toFixed(2)}).`,
      verdict: 'whipsaw-prone',
    };
  }

  return {
    reason: `Edge ${edgeVsBuyHoldPct.toFixed(1)}pp vs buy & hold — review the raw metrics.`,
    verdict: 'inconclusive',
  };
}

/**
 * Pre-flight check: backtests a {@link DynamicTrailStrategy} over the given candles and reports
 * whether a trailing stop is the right tool for this instrument. It measures the strategy against
 * two baselines — opportunity cost (return vs buy & hold) and protection (drawdown avoided) — plus
 * a chop/trend measure, then renders a {@link TrailSuitabilityVerdict}.
 */
export async function assessTrailSuitability(
  candles: Candle[],
  options: TrailSuitabilityOptions = {}
): Promise<TrailSuitabilityReport> {
  if (candles.length === 0) {
    throw new Error('assessTrailSuitability requires at least one candle');
  }

  const closes = candles.map(candle => parseFloat(candle.close));
  const entry = closes[0];
  const buyHoldReturnPct = (closes[closes.length - 1] / entry - 1) * 100;
  const buyHoldMaxDrawdownPct = maxDrawdownPct(closes);
  const ratio = efficiencyRatio(closes);

  const strategy = new DynamicTrailStrategy(options.config ?? {atrInterval: 14, atrMultiple: '3'});
  const tradingPair = new TradingPair(candles[0].base, candles[0].counter);
  const balances = new Map([
    [candles[0].base, {available: new Big(options.baseBalance ?? '1'), hold: new Big(0)}],
    [candles[0].counter, {available: new Big(0), hold: new Big(0)}],
  ]);
  const broker = new AlpacaBrokerMock({balances, tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES});
  const result = await new BacktestExecutor({broker, candles, strategy, tradingPair}).execute();

  const exitTrade = result.trades[0];
  const exitPrice = exitTrade ? parseFloat(exitTrade.price.toString()) : null;
  const strategyReturnPct = exitPrice === null ? buyHoldReturnPct : (exitPrice / entry - 1) * 100;
  const edgeVsBuyHoldPct = strategyReturnPct - buyHoldReturnPct;

  const exitIndex = exitTrade ? candles.findIndex(candle => candle.openTimeInISO === exitTrade.openTimeInISO) : -1;
  const barsInMarket = exitIndex >= 0 ? exitIndex : candles.length;
  const timeInMarketPct = (barsInMarket / candles.length) * 100;

  const {reason, verdict} = classify({
    buyHoldMaxDrawdownPct,
    buyHoldReturnPct,
    edgeVsBuyHoldPct,
    efficiencyRatio: ratio,
    exited: strategy.trailState.exited || exitTrade !== undefined,
    strategyReturnPct,
    timeInMarketPct,
  });

  return {
    buyHoldMaxDrawdownPct,
    buyHoldReturnPct,
    edgeVsBuyHoldPct,
    efficiencyRatio: ratio,
    exited: strategy.trailState.exited || exitTrade !== undefined,
    exitPrice,
    reason,
    strategyReturnPct,
    timeInMarketPct,
    verdict,
  };
}
