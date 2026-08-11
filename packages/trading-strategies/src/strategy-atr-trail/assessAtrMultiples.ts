import Big from 'big.js';
import {AlpacaBroker, AlpacaBrokerMock, OrderSide, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {classifyAtrMultiple, type AtrRoomVerdict} from '../util/atrUnits.js';
import {AtrTrailStrategy} from './AtrTrailStrategy.js';

const DEFAULT_MULTIPLES = [1.5, 2, 2.5, 3, 3.5, 4];

/**
 * How a single ATR multiple actually behaved on the assessed window:
 * - `held` — the trail was never breached (rode through to the end).
 * - `protective` — exited, and price kept falling afterwards (the stop saved downside).
 * - `whipsawed` — exited, but price recovered above the exit (a premature, noise stop-out).
 */
export type AtrMultipleOutcome = 'held' | 'protective' | 'whipsawed';

export interface AtrMultipleAssessment {
  /** The ATR multiple that was tested. */
  atrMultiple: number;
  /** Static band classification from {@link classifyAtrMultiple}: whippy / balanced / loose. */
  band: AtrRoomVerdict;
  /** Portfolio value of simply holding the position across the whole window. */
  buyHoldValue: number;
  /** `(finalValue - buyHoldValue) / buyHoldValue * 100`: positive = the trail beat holding. */
  edgeVsHoldPct: number;
  /** Date (`YYYY-MM-DD`) the trail exited, or `null` if it never did. */
  exitDate: string | null;
  /** Fill price of the exit, or `null` if it never exited. */
  exitPrice: number | null;
  /** Whether the trail was breached and the position exited. */
  exited: boolean;
  /** Final portfolio value after running the trail over the window. */
  finalValue: number;
  /** What actually happened — the empirical counterpart to `band`. */
  outcome: AtrMultipleOutcome;
  /** The frozen trail width this multiple produced (`atrMultiple * ATR%`), or `null` if it couldn't be sized. */
  trailDownPct: number | null;
}

export interface AssessAtrMultiplesOptions {
  /** ATR lookback. Defaults to 14. */
  atrInterval?: number;
  /** Candle size (ms) the ATR is measured on. Defaults to daily. */
  atrIntervalMillis?: number;
  /** Base-asset units assumed to be held across the window. Defaults to `'1'`. */
  baseBalance?: string;
  /** ATR multiples to sweep. Defaults to `[1.5, 2, 2.5, 3, 3.5, 4]`. */
  multiples?: number[];
}

/**
 * Sweeps a range of ATR multiples over an instrument's candles and reports how each one would have
 * behaved, so the trail width can be chosen from evidence rather than guessed. For every multiple it
 * warms `AtrTrailStrategy` from `history`, trails it over `candles` while holding a position, and
 * records whether it rode through, protected, or got whipsawed — alongside the static whippy/balanced/
 * loose band. The pair is derived from the first candle.
 */
export async function assessAtrMultiples(
  params: {candles: Candle[]; history: Candle[]} & AssessAtrMultiplesOptions
): Promise<AtrMultipleAssessment[]> {
  const {atrInterval = 14, atrIntervalMillis = 86_400_000, baseBalance = '1', candles, history} = params;
  const multiples = params.multiples ?? DEFAULT_MULTIPLES;

  if (candles.length === 0) {
    throw new Error('assessAtrMultiples needs at least one candle to assess.');
  }

  const pair = new TradingPair(candles[0].base, candles[0].counter);
  const lastClose = parseFloat(candles[candles.length - 1].close);
  const buyHoldValue = parseFloat(baseBalance) * lastClose;

  return Promise.all(
    multiples.map(async atrMultiple => {
      const exchange = new AlpacaBrokerMock({
        balances: new Map([
          [pair.base, {available: new Big(baseBalance), hold: new Big(0)}],
          [pair.counter, {available: new Big(0), hold: new Big(0)}],
        ]),
        tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES,
      });
      exchange.setHistoricalCandles(history);

      const strategy = new AtrTrailStrategy({atrInterval, atrIntervalMillis, atrMultiple: String(atrMultiple)});
      await strategy.init(exchange, pair);
      const result = await new BacktestExecutor({broker: exchange, candles, strategy, tradingPair: pair}).execute();

      const exit = result.trades.find(trade => trade.side === OrderSide.SELL);
      const exitPrice = exit ? exit.price.toNumber() : null;
      const finalValue = result.performance.finalPortfolioValue.toNumber();
      const trailDownPct = strategy.trailState.trailDownPct === null ? null : Number(strategy.trailState.trailDownPct);

      let outcome: AtrMultipleOutcome = 'held';
      if (exitPrice !== null) {
        outcome = lastClose > exitPrice ? 'whipsawed' : 'protective';
      }

      return {
        atrMultiple,
        band: classifyAtrMultiple(atrMultiple),
        buyHoldValue,
        edgeVsHoldPct: ((finalValue - buyHoldValue) / buyHoldValue) * 100,
        exitDate: exit ? exit.openTimeInISO.slice(0, 10) : null,
        exited: strategy.trailState.exited,
        exitPrice,
        finalValue,
        outcome,
        trailDownPct,
      };
    })
  );
}
