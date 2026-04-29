import Big from 'big.js';
import {z} from 'zod';
import {AllAvailableAmount, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {
  ExchangeFill,
  ExchangePendingOrder,
  LimitOrderAdvice,
  OneMinuteBatchedCandle,
  OrderAdvice,
  TradingSessionState,
} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

export const TrailingStopSchema = z.object({
  /**
   * Exit threshold as a percentage of the running peak. "5" → exit when close drops to
   * peak * 0.95. Defaults to "10" (10%).
   */
  trailDownPct: positiveNumberString.default('10'),
  /**
   * Optional hysteresis on peak ratcheting. When set, a new candle high only updates
   * the peak if it exceeds the previous peak by at least `trailUpPct` percent — i.e.
   * `candle.high >= peakPrice * (1 + trailUpPct/100)`. When the threshold is crossed,
   * the peak jumps to `candle.high` (the actual new high, not a ratcheted multiple).
   * Useful in choppy markets to avoid letting every micro-tick reset the trail.
   * When omitted, the peak ratchets on every candle high that exceeds the previous one.
   */
  trailUpPct: positiveNumberString.optional(),
  /**
   * Optional initial pivot price. When set, the peak seeds from this value on attach
   * instead of the attach candle's `high`. From there the peak ratchets up normally on
   * subsequent candle highs. Useful when you know the right anchor (e.g. cost basis or
   * a recent swing high) and don't want the strategy to seed from whatever candle
   * happens to be first.
   */
  pivotPrice: positiveNumberString.optional(),
  /**
   * Order type used to exit. `"limit"` (default) places the sell at the trail target —
   * guaranteed price, but may not fill on a gap. `"market"` guarantees fill at the
   * prevailing price.
   */
  exitOrder: z.enum(['limit', 'market']).default('limit'),
});

export type TrailingStopConfig = z.input<typeof TrailingStopSchema>;

export type TrailingStopState = {
  /**
   * `true` once the trailing-stop sell has fully filled (position reduced to zero in
   * `onFill`). Once set, `processCandle` short-circuits and emits no further advice;
   * `onOrderFilled` invokes `onFinish` so the runtime can tear the session down.
   */
  exited: boolean;
  /**
   * Net base quantity currently held. Stored as a Big string. Starts at `'0'`, jumps to
   * the seeded balance on attach, and decreases on SELL fills of the strategy's own
   * exit orders. When it reaches zero, `exited` flips to `true`.
   */
  positionSize: string;
  /**
   * Highest candle high observed since attach. Stored as a Big string. Seeded from the
   * configured `pivotPrice` (when set) or otherwise from the attach candle's `high`,
   * then ratchets upward only — falling prices never lower it, so the trail target is
   * monotonic. `'0'` doubles as the "not yet attached" sentinel: while it is `'0'`, the
   * next eligible candle (one with a non-zero base balance) will run the attach branch.
   */
  peakPrice: string;
  /**
   * Human-readable reason string captured the moment the trail was breached (close,
   * peak, percentage, target). `null` until the exit fires. Surfaced in the order
   * advice's `reason` field for downstream logging and diagnostics.
   */
  exitReason: string | null;
  /**
   * Limit price of the most recently emitted exit advice, as a Big string. `null` when
   * `exitOrder` is `"market"` or before the trail is breached. Refreshed on every
   * subsequent candle that re-emits the sell — so if the peak ratchets again before the
   * order fills, the recorded price tracks the current peak's target rather than the
   * original breach price.
   */
  exitLimitPrice: string | null;
};

const defaultState = (): TrailingStopState => ({
  exited: false,
  positionSize: '0',
  peakPrice: '0',
  exitReason: null,
  exitLimitPrice: null,
});

/**
 * Exit-only trailing stop. Attaches to an existing base balance — opened manually,
 * by another strategy, or carried across a restart — and trails the highest candle
 * high seen since attach. Emits a sell-all advice when the candle close drops to
 * `peak * (1 - trailPct/100)`.
 *
 * The trail only ratchets upward — once the peak is set, falling prices never lower it,
 * so the exit threshold is monotonic. The exit advice is re-emitted on every subsequent
 * candle until `onFill` brings the position to zero, so a rejected or delayed sell is
 * automatically retried. After the position is fully exited, `onFinish` is invoked so
 * the runtime can tear down the session.
 *
 * Attach behavior: on each candle, if not yet attached and `state.baseBalance > 0`,
 * the strategy claims the full base balance as its position and seeds the peak from
 * the configured `pivotPrice` (when provided) or otherwise from the attach candle's
 * `high`. The position is not modified again until the strategy's own SELL fills
 * arrive — `TradingSession` only forwards fills for orders it placed itself, so any
 * external buys made after attach do not reach `onFill` and are not tracked.
 */
export class TrailingStopStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-trailing-stop';

  readonly #trailDownPct: Big;
  readonly #trailUpPct: Big | null;
  readonly #pivotPrice: Big | null;
  readonly #exitOrder: 'limit' | 'market';

  constructor(config: TrailingStopConfig) {
    super({config, state: defaultState()});
    const parsed = TrailingStopSchema.parse(config);
    this.#trailDownPct = new Big(parsed.trailDownPct);
    this.#trailUpPct = parsed.trailUpPct ? new Big(parsed.trailUpPct) : null;
    this.#pivotPrice = parsed.pivotPrice ? new Big(parsed.pivotPrice) : null;
    this.#exitOrder = parsed.exitOrder;
  }

  get #state(): TrailingStopState {
    return this.getProxiedState<TrailingStopState>();
  }

  /** Read-only snapshot of the current trailing-stop state. Useful for tests and diagnostics. */
  get trailingState(): Readonly<TrailingStopState> {
    return {...this.#state};
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    if (this.#state.exited) {
      return undefined;
    }

    if (this.#state.peakPrice === '0') {
      if (state.baseBalance.lte(0)) {
        return undefined;
      }
      const peak = this.#pivotPrice ?? candle.high;
      const stopTarget = peak.mul(new Big(1).minus(this.#trailDownPct.div(100)));
      this.#state.positionSize = state.baseBalance.toFixed();
      this.#state.peakPrice = peak.toFixed();
      this.onMessage?.(
        `Trail attached. Peak: ${peak.toFixed()}, stop: ${stopTarget.toFixed()} (-${this.#trailDownPct.toFixed()}%)`
      );
      return undefined;
    }

    const positionSize = new Big(this.#state.positionSize);
    if (positionSize.lte(0)) {
      return undefined;
    }

    const previousPeak = new Big(this.#state.peakPrice);
    const ratchetThreshold = this.#trailUpPct
      ? previousPeak.mul(new Big(1).plus(this.#trailUpPct.div(100)))
      : previousPeak;
    const newPeak = candle.high.gte(ratchetThreshold) && candle.high.gt(previousPeak) ? candle.high : previousPeak;
    if (newPeak.gt(previousPeak)) {
      this.#state.peakPrice = newPeak.toFixed();
    }

    const trailTarget = newPeak.mul(new Big(1).minus(this.#trailDownPct.div(100)));

    if (candle.close.gt(trailTarget)) {
      return undefined;
    }

    const reason = `Trailing stop: close ${candle.close.toFixed()} <= peak ${newPeak.toFixed()} - ${this.#trailDownPct.toFixed()}% (target ${trailTarget.toFixed()})`;
    const isFirstBreach = this.#state.exitReason === null;
    this.#state.exitReason = reason;
    if (isFirstBreach) {
      this.onMessage?.(reason);
    }

    if (this.#exitOrder === 'market') {
      this.#state.exitLimitPrice = null;
      return {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.MARKET,
        amount: AllAvailableAmount,
        amountIn: 'base',
        reason,
      };
    }

    this.#state.exitLimitPrice = trailTarget.toFixed();
    const advice: LimitOrderAdvice = {
      side: ExchangeOrderSide.SELL,
      type: ExchangeOrderType.LIMIT,
      amount: AllAvailableAmount,
      amountIn: 'base',
      price: trailTarget,
      reason,
    };
    return advice;
  }

  async onFill(fill: ExchangeFill, _state: TradingSessionState): Promise<void> {
    if (fill.side !== ExchangeOrderSide.SELL) {
      return;
    }
    const fillSize = new Big(fill.size);
    const newSize = new Big(this.#state.positionSize).minus(fillSize);
    if (newSize.lte(0)) {
      this.#state.positionSize = '0';
      this.#state.exited = true;
      return;
    }
    this.#state.positionSize = newSize.toFixed();
  }

  async onOrderFilled(order: ExchangePendingOrder, _state: TradingSessionState): Promise<void> {
    if (this.#state.exited && order.side === ExchangeOrderSide.SELL) {
      this.onFinish?.();
    }
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const validated: TrailingStopState = isTrailingStopState(persisted) ? persisted : defaultState();
    super.restoreState(validated);
    const restored = this.#state;
    restored.exited = validated.exited;
    restored.positionSize = validated.positionSize;
    restored.peakPrice = validated.peakPrice;
    restored.exitReason = validated.exitReason;
    restored.exitLimitPrice = validated.exitLimitPrice;
  }
}

function isTrailingStopState(value: unknown): value is TrailingStopState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (!('exited' in value) || typeof value.exited !== 'boolean') return false;
  if (!('positionSize' in value) || typeof value.positionSize !== 'string' || !isValidBigString(value.positionSize)) {
    return false;
  }
  if (!('peakPrice' in value) || typeof value.peakPrice !== 'string' || !isValidBigString(value.peakPrice)) {
    return false;
  }
  if (!('exitReason' in value) || (value.exitReason !== null && typeof value.exitReason !== 'string')) return false;
  if (!('exitLimitPrice' in value)) return false;
  if (value.exitLimitPrice !== null) {
    if (typeof value.exitLimitPrice !== 'string' || !isValidBigString(value.exitLimitPrice)) return false;
  }

  // Cross-field invariants. Restoring a state that violates these would strand the
  // strategy in a no-op or otherwise inconsistent runtime state, so reject and let
  // restoreState fall back to defaults.
  const positionSize = new Big(value.positionSize);
  const peakPrice = new Big(value.peakPrice);

  // Once exited, the position must be zero. Anything else is contradictory.
  if (value.exited && !positionSize.eq(0)) return false;

  // Attached (peak set) but not exited and no position left → permanent no-op:
  // the seed branch is skipped (peak !== '0') and the trail branch returns early
  // (positionSize <= 0). Treat as corrupt and reset.
  if (!peakPrice.eq(0) && !value.exited && positionSize.lte(0)) return false;

  return true;
}

function isValidBigString(value: string): boolean {
  try {
    new Big(value);
    return true;
  } catch {
    return false;
  }
}
