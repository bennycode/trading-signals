import type {StringValue} from 'ms';
import {ms} from 'ms';
import {z} from 'zod';
import {CandleBatcher, OrderSide, OrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {SMA} from 'trading-signals';
import {AllAvailableAmount} from '../trader/index.js';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';

const ONE_MINUTE_IN_MS = 60_000;

/** A duration in `ms` syntax (`"1m"`, `"5m"`, `"1d"`), no smaller than one candle (`"1m"`). */
const timeframeString = z.string().refine(value => {
  const millis = ms(value as StringValue);
  return typeof millis === 'number' && Number.isFinite(millis) && millis >= ONE_MINUTE_IN_MS;
}, 'Must be a duration of at least "1m" in ms syntax, e.g. "1m", "5m", "1d"');

const barCount = z.number().int().positive();

export const SmaCrossoverSchema = ProtectedStrategySchema.extend({
  /** Number of bars in the slow SMA. Must be larger than `shortPeriod`. */
  longPeriod: barCount.default(20),
  /** Number of bars in the fast SMA. Must be smaller than `longPeriod`. */
  shortPeriod: barCount.default(10),
  /** Bar size both SMAs are computed on, in `ms` syntax (e.g. "1m", "5m", "1d"). */
  timeframe: timeframeString.default('1m'),
});

export type SmaCrossoverConfig = z.input<typeof SmaCrossoverSchema>;

/**
 * Classic dual-SMA crossover: a fast SMA and a slow SMA over the same timeframe.
 * When the fast SMA crosses *above* the slow one the trend has turned up, so buy;
 * when it crosses *below*, the trend has turned down, so sell. Both entries and
 * exits are market orders using the full available balance.
 */
export class SmaCrossoverStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-sma-crossover';
  static override marketTypes: readonly MarketType[] = [MarketType.BULLISH, MarketType.BEARISH];

  readonly #shortPeriod: number;
  readonly #longPeriod: number;
  readonly #shortSma: SMA;
  readonly #longSma: SMA;
  readonly #batcher: CandleBatcher;

  /**
   * Whether the fast SMA sat above the slow SMA on the previous completed bar.
   * A crossover is the bar where this flips, so advice fires *once at the cross*
   * instead of on every bar the fast SMA stays on one side. `undefined` until the
   * first bar where both SMAs are stable.
   */
  #shortWasAboveLong: boolean | undefined = undefined;

  constructor(config?: SmaCrossoverConfig) {
    const parsed = SmaCrossoverSchema.parse(config ?? {});
    super({config: parsed});

    if (parsed.shortPeriod >= parsed.longPeriod) {
      throw new Error(
        `SmaCrossoverStrategy: shortPeriod (${parsed.shortPeriod}) must be smaller than longPeriod (${parsed.longPeriod})`
      );
    }

    this.#shortPeriod = parsed.shortPeriod;
    this.#longPeriod = parsed.longPeriod;
    this.#shortSma = new SMA(parsed.shortPeriod);
    this.#longSma = new SMA(parsed.longPeriod);
    this.#batcher = new CandleBatcher(ms(parsed.timeframe as StringValue));
  }

  /** Whether both SMAs have seen enough bars to produce a value. */
  get isWarmedUp() {
    return this.#shortSma.isStable && this.#longSma.isStable;
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice;
    }

    // Strategies always receive 1-minute candles; roll them up to the configured timeframe.
    const bar = this.#batcher.addToBatch(candle);
    if (!bar) {
      return;
    }

    const closePrice = bar.close.toNumber();
    this.#shortSma.add(closePrice);
    this.#longSma.add(closePrice);

    if (!this.isWarmedUp) {
      return;
    }

    const shortValue = this.#shortSma.getResultOrThrow();
    const longValue = this.#longSma.getResultOrThrow();
    const shortAboveLong = shortValue > longValue;

    // Detecting a *crossover* needs the previous bar's relationship, not just this one's.
    const shortWasAboveLong = this.#shortWasAboveLong;
    this.#shortWasAboveLong = shortAboveLong;
    if (shortWasAboveLong === undefined || shortWasAboveLong === shortAboveLong) {
      return;
    }

    if (shortAboveLong) {
      return {
        amount: AllAvailableAmount,
        amountIn: 'counter',
        reason: `SMA${this.#shortPeriod} (${shortValue.toFixed(2)}) crossed above SMA${this.#longPeriod} (${longValue.toFixed(2)})`,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      };
    }

    return {
      amount: AllAvailableAmount,
      amountIn: 'base',
      reason: `SMA${this.#shortPeriod} (${shortValue.toFixed(2)}) crossed below SMA${this.#longPeriod} (${longValue.toFixed(2)})`,
      side: OrderSide.SELL,
      type: OrderType.MARKET,
    };
  }
}
