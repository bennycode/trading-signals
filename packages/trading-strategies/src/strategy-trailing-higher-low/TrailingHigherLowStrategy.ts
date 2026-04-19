import {z} from 'zod';
import {ALL_AVAILABLE_AMOUNT, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {HigherLowTrail} from 'trading-signals';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';

export const TrailingHigherLowSchema = ProtectedStrategySchema.extend({
  /**
   * Number of bars of strictly-higher-low confirmation required after a pullback low.
   * Interpreted in the candle timeframe fed into the strategy (1 daily candle =
   * 1 day of confirmation when `lookback` is 1).
   */
  lookback: z.number().int().positive().default(1),
  /**
   * Bars to skip re-entry for after an exit. Helps filter whipsaws in chop; set to
   * 0 to re-enter as soon as a new higher-low prints above the last exit price.
   */
  cooldownBars: z.number().int().nonnegative().default(0),
  /**
   * Rule for the first buy when the strategy has no prior exit on record.
   *
   * - `"immediate"`: market-buy on the first candle the strategy sees.
   * - `"trail-confirmed"`: wait until the `HigherLowTrail` indicator emits its first
   *   pivot (i.e. the uptrend has printed at least one confirmed higher-low) before
   *   buying. Skips fresh downtrends at the cost of entering later on clean rallies.
   */
  entry: z.enum(['immediate', 'trail-confirmed']).default('immediate'),
});

export type TrailingHigherLowConfig = z.input<typeof TrailingHigherLowSchema>;

type Position = 'FLAT' | 'LONG';

type TrailingHigherLowState = {
  position: Position;
  /** Highest pullback-low pivot seen since entering LONG. `null` when FLAT or before first pivot. */
  runningStop: string | null;
  lastExitPrice: string | null;
  cooldownRemaining: number;
};

/**
 * Rides trends long while a rising higher-low stop sits under price. Exits at market
 * when the close drops below the running stop, then waits for a new pullback-low
 * strictly *above* the last exit price before re-entering — so every re-entry buys
 * into already-intact uptrend structure, accepting a higher entry price in exchange
 * for avoiding catch-a-falling-knife.
 *
 * The stop is tracked per-position: `runningStop` resets on every exit and climbs
 * again as fresh higher-low pivots print during the next long. The indicator itself
 * runs in non-monotonic mode so it can emit low pivots after deep drawdowns — those
 * emissions are what arm the re-entry trigger.
 *
 * Operates on whatever candle timeframe the backtester/live session feeds it;
 * `lookback` is expressed in bars, not wall-clock time.
 */
export class TrailingHigherLowStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-trailing-higher-low';

  readonly #trail: HigherLowTrail;

  constructor(config: TrailingHigherLowConfig = {}) {
    super({
      config,
      state: {
        cooldownRemaining: 0,
        lastExitPrice: null,
        position: 'FLAT',
        runningStop: null,
      },
    });

    const parsed = TrailingHigherLowSchema.parse(config);
    this.#trail = new HigherLowTrail({lookback: parsed.lookback, monotonic: false});
  }

  get #config() {
    return TrailingHigherLowSchema.parse(this.getProxiedConfig());
  }

  get #state(): TrailingHigherLowState {
    return this.getProxiedState<TrailingHigherLowState>();
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);

    if (guardAdvice) {
      return guardAdvice;
    }

    const low = candle.low.toNumber();
    const high = candle.high.toNumber();
    const close = candle.close.toNumber();

    const pivot = this.#trail.add({high, low});

    if (this.#state.cooldownRemaining > 0) {
      this.#state.cooldownRemaining = this.#state.cooldownRemaining - 1;
    }

    if (this.#state.position === 'LONG') {
      if (pivot !== null) {
        const currentStop = this.#state.runningStop === null ? null : parseFloat(this.#state.runningStop);

        if (currentStop === null || pivot > currentStop) {
          this.#state.runningStop = pivot.toString();
        }
      }

      const stop = this.#state.runningStop === null ? null : parseFloat(this.#state.runningStop);

      if (stop !== null && close < stop) {
        this.#state.position = 'FLAT';
        this.#state.runningStop = null;
        this.#state.lastExitPrice = close.toString();
        this.#state.cooldownRemaining = this.#config.cooldownBars;

        return {
          amount: ALL_AVAILABLE_AMOUNT,
          amountIn: 'base',
          reason: `Close ${close.toFixed(2)} dropped below trail ${stop.toFixed(2)}`,
          side: ExchangeOrderSide.SELL,
          type: ExchangeOrderType.MARKET,
        };
      }

      return;
    }

    if (this.#state.cooldownRemaining > 0) {
      return;
    }

    const {entry} = this.#config;
    const lastExit = this.#state.lastExitPrice;

    const shouldEnter =
      lastExit === null
        ? entry === 'immediate' || pivot !== null
        : pivot !== null && pivot > parseFloat(lastExit);

    if (!shouldEnter) {
      return;
    }

    this.#state.position = 'LONG';
    this.#state.runningStop = pivot === null ? null : pivot.toString();

    const reason =
      lastExit === null
        ? entry === 'immediate'
          ? 'Initial entry'
          : `Initial entry confirmed by first trail pivot ${pivot?.toFixed(2)}`
        : `Re-entry: new trail pivot ${pivot?.toFixed(2)} above last exit ${parseFloat(lastExit).toFixed(2)}`;

    return {
      amount: ALL_AVAILABLE_AMOUNT,
      amountIn: 'counter',
      reason,
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.MARKET,
    };
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);

    if (persisted.position === 'FLAT' || persisted.position === 'LONG') {
      this.#state.position = persisted.position;
    }

    if (typeof persisted.runningStop === 'string' || persisted.runningStop === null) {
      this.#state.runningStop = persisted.runningStop;
    }

    if (typeof persisted.lastExitPrice === 'string' || persisted.lastExitPrice === null) {
      this.#state.lastExitPrice = persisted.lastExitPrice;
    }

    if (typeof persisted.cooldownRemaining === 'number') {
      this.#state.cooldownRemaining = persisted.cooldownRemaining;
    }
  }
}
