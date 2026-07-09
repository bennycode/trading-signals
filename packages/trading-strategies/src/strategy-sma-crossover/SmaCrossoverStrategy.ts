import type {StringValue} from 'ms';
import {ms} from 'ms';
import {z} from 'zod';
import {CandleBatcher, OrderSide, OrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {SMA} from 'trading-signals';
import {AllAvailableAmount} from '../trader/index.js';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';

const ONE_MINUTE_IN_MS = 60_000;

/** A duration in `ms` syntax (`"1m"`, `"5m"`, `"1d"`), no smaller than one candle (`"1m"`). */
const timeframeString = z.string().refine(value => {
  const millis = ms(value as StringValue);
  return typeof millis === 'number' && Number.isFinite(millis) && millis >= ONE_MINUTE_IN_MS;
}, 'Must be a duration of at least "1m" in ms syntax, e.g. "1m", "5m", "1d"');

const barCount = z.number().int().positive();

export const SmaCrossoverSchema = z.object({
  /** Number of bars in the fast SMA. */
  fastPeriod: barCount.default(10),
  /** Bar size the fast SMA is computed on, in `ms` syntax (e.g. "1m", "5m", "1d"). */
  fastTimeframe: timeframeString.default('1m'),
  /** Number of bars in the slow SMA. */
  slowPeriod: barCount.default(20),
  /** Bar size the slow SMA is computed on, in `ms` syntax (e.g. "1m", "5m", "1d"). */
  slowTimeframe: timeframeString.default('5m'),
});

export type SmaCrossoverConfig = z.input<typeof SmaCrossoverSchema>;

/**
 * Classic dual-SMA crossover: a fast SMA and a slow SMA. Each has its own bar count
 * *and* its own timeframe, so you can cross, say, an SMA10 on 1-minute bars against an
 * SMA20 on 5-minute bars. When the fast SMA crosses *above* the slow one the trend has
 * turned up, so buy; when it crosses *below*, the trend has turned down, so sell. Both
 * entries and exits are market orders using the full available balance.
 */
export class SmaCrossoverStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-sma-crossover';
  static override marketTypes: readonly MarketType[] = [MarketType.BULLISH, MarketType.BEARISH];

  readonly #fastPeriod: number;
  readonly #slowPeriod: number;
  readonly #fastTimeframe: string;
  readonly #slowTimeframe: string;
  readonly #fast: SMA;
  readonly #slow: SMA;
  readonly #fastBatcher: CandleBatcher;
  readonly #slowBatcher: CandleBatcher;

  /**
   * Whether the fast SMA sat above the slow SMA on the previous evaluated bar.
   * A crossover is the bar where this flips, so advice fires *once at the cross*
   * instead of on every bar the fast SMA stays on one side. `undefined` until the
   * first bar where both SMAs are stable.
   */
  #fastWasAboveSlow: boolean | undefined = undefined;

  constructor(config?: SmaCrossoverConfig) {
    const parsed = SmaCrossoverSchema.parse(config ?? {});
    super({config: parsed});

    const fastIntervalInMillis = ms(parsed.fastTimeframe as StringValue);
    const slowIntervalInMillis = ms(parsed.slowTimeframe as StringValue);
    if (parsed.fastPeriod === parsed.slowPeriod && fastIntervalInMillis === slowIntervalInMillis) {
      throw new Error(
        'SmaCrossoverStrategy: the fast and slow SMA must differ in period or timeframe, otherwise they are identical and never cross'
      );
    }

    this.#fastPeriod = parsed.fastPeriod;
    this.#slowPeriod = parsed.slowPeriod;
    this.#fastTimeframe = parsed.fastTimeframe;
    this.#slowTimeframe = parsed.slowTimeframe;
    this.#fast = new SMA(parsed.fastPeriod);
    this.#slow = new SMA(parsed.slowPeriod);
    this.#fastBatcher = new CandleBatcher(fastIntervalInMillis);
    this.#slowBatcher = new CandleBatcher(slowIntervalInMillis);
  }

  /** Whether both SMAs have seen enough bars to produce a value. */
  get isWarmedUp() {
    return this.#fast.isStable && this.#slow.isStable;
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    _state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    // Strategies always receive 1-minute candles; roll them up to each SMA's own timeframe.
    const fastBar = this.#fastBatcher.addToBatch(candle);
    if (fastBar) {
      this.#fast.add(fastBar.close.toNumber());
    }
    const slowBar = this.#slowBatcher.addToBatch(candle);
    if (slowBar) {
      this.#slow.add(slowBar.close.toNumber());
    }

    // No SMA advanced on this candle, so the relationship cannot have changed.
    if (!fastBar && !slowBar) {
      return;
    }

    if (!this.isWarmedUp) {
      return;
    }

    const fastValue = this.#fast.getResultOrThrow();
    const slowValue = this.#slow.getResultOrThrow();
    const fastAboveSlow = fastValue > slowValue;

    // Detecting a *crossover* needs the previous relationship, not just this bar's.
    const fastWasAboveSlow = this.#fastWasAboveSlow;
    this.#fastWasAboveSlow = fastAboveSlow;
    if (fastWasAboveSlow === undefined || fastWasAboveSlow === fastAboveSlow) {
      return;
    }

    const fastLabel = `SMA${this.#fastPeriod}@${this.#fastTimeframe} (${fastValue.toFixed(2)})`;
    const slowLabel = `SMA${this.#slowPeriod}@${this.#slowTimeframe} (${slowValue.toFixed(2)})`;

    if (fastAboveSlow) {
      return {
        amount: AllAvailableAmount,
        amountIn: 'counter',
        reason: `${fastLabel} crossed above ${slowLabel}`,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      };
    }

    return {
      amount: AllAvailableAmount,
      amountIn: 'base',
      reason: `${fastLabel} crossed below ${slowLabel}`,
      side: OrderSide.SELL,
      type: OrderType.MARKET,
    };
  }
}
