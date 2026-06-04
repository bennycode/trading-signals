import Big from 'big.js';
import {z} from 'zod';
import {AllAvailableAmount, OrderSide, OrderType} from '@typedtrader/exchange';
import type {
  Fill,
  PendingOrder,
  LimitOrderAdvice,
  OneMinuteBatchedCandle,
  OrderAdvice,
  TradingSessionState,
} from '@typedtrader/exchange';
import {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

export const TrailingStopSchema = z.object({
  /**
   * Order type used to exit. `"limit"` (default) places the sell at the trail target —
   * guaranteed price, but may not fill on a gap. `"market"` guarantees fill at the
   * prevailing price.
   */
  exitOrder: z.enum(['limit', 'market']).default('limit'),
  /**
   * Optional initial pivot price. When set, the peak seeds from this value on attach
   * instead of the attach candle's `high`. From there the peak ratchets up normally on
   * subsequent candle highs. Useful when you know the right anchor (e.g. cost basis or
   * a recent swing high) and don't want the strategy to seed from whatever candle
   * happens to be first.
   */
  pivotPrice: positiveNumberString.optional(),
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
   * Highest candle high observed since attach. Stored as a Big string. Seeded from the
   * configured `pivotPrice` (when set) or otherwise from the attach candle's `high`,
   * then ratchets upward only — falling prices never lower it, so the trail target is
   * monotonic. `'0'` doubles as the "not yet attached" sentinel: while it is `'0'`, the
   * next eligible candle (one with a non-zero base balance) will run the attach branch.
   */
  peakPrice: string;
  /**
   * Current trail target as a Big string — `peakPrice * (1 - trailDownPct/100)`. Refreshed
   * on attach and on every candle that the strategy processes, so it always reflects the
   * current peak. `'0'` while not yet attached. The exit advice fires when `candle.close`
   * drops to or below this value.
   */
  stopPrice: string;
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
  exitLimitPrice: null,
  exitReason: null,
  peakPrice: '0',
  stopPrice: '0',
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
 * the strategy seeds the peak from the configured `pivotPrice` (when provided) or
 * otherwise from the attach candle's `high`. It does not snapshot a position size —
 * the trail always guards whatever base is currently available, read live from
 * `state.baseBalance` on every candle, so size added after attach (a top-up, another
 * strategy's buy, a balance carried across a restart) is covered automatically. The
 * exit liquidates the full available balance (`AllAvailableAmount`); the strategy is
 * considered exited once a SELL fill drops the live base balance below the exchange's
 * minimum order size (`base_min_size`), i.e. only unsellable dust remains.
 */
export class TrailingStopStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-trailing-stop';
  static override marketTypes: readonly MarketType[] = [MarketType.BULLISH];

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

  /**
   * Whether the available base balance is large enough to place an exit order. Anything
   * below the exchange's minimum order size (`base_min_size`) is unsellable dust, so the
   * position counts as effectively closed. Gating on this threshold rather than `> 0`
   * stops a tiny residue left after a fill from keeping the strategy armed forever.
   */
  #hasSellablePosition(state: TradingSessionState): boolean {
    return state.baseBalance.gte(new Big(state.tradingRules.base_min_size));
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    if (this.#state.exited) {
      return undefined;
    }

    if (this.#state.peakPrice === '0') {
      if (!this.#hasSellablePosition(state)) {
        return undefined;
      }
      const peak = this.#pivotPrice ?? candle.high;
      const stopTarget = peak.mul(new Big(1).minus(this.#trailDownPct.div(100)));
      this.#state.peakPrice = peak.toFixed();
      this.#state.stopPrice = stopTarget.toFixed();
      this.onMessage?.(
        `Trail attached. Peak: ${peak.toFixed()}, stop: ${stopTarget.toFixed()} (-${this.#trailDownPct.toFixed()}%)`
      );
      return undefined;
    }

    if (!this.#hasSellablePosition(state)) {
      return undefined;
    }

    const previousPeak = new Big(this.#state.peakPrice);
    const ratchetThreshold = this.#trailUpPct
      ? previousPeak.mul(new Big(1).plus(this.#trailUpPct.div(100)))
      : previousPeak;
    const newPeak = candle.high.gte(ratchetThreshold) && candle.high.gt(previousPeak) ? candle.high : previousPeak;
    const peakRatcheted = newPeak.gt(previousPeak);
    if (peakRatcheted) {
      this.#state.peakPrice = newPeak.toFixed();
    }

    const trailTarget = newPeak.mul(new Big(1).minus(this.#trailDownPct.div(100)));
    this.#state.stopPrice = trailTarget.toFixed();

    if (peakRatcheted) {
      this.onMessage?.(`Peak moved to ${newPeak.toFixed()} (stop: ${trailTarget.toFixed()})`);
    }

    if (candle.close.gt(trailTarget)) {
      return undefined;
    }

    const reason = `Trailing stop: close ${candle.close.toFixed()} <= peak ${newPeak.toFixed()} - ${this.#trailDownPct.toFixed()}% (target ${trailTarget.toFixed()})`;
    if (this.#state.exitReason === null) {
      this.#state.exitReason = reason;
      this.onMessage?.(reason);
    }

    if (this.#exitOrder === 'market') {
      this.#state.exitLimitPrice = null;
      return {
        amount: AllAvailableAmount,
        amountIn: 'base',
        reason,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
      };
    }

    this.#state.exitLimitPrice = trailTarget.toFixed();
    const advice: LimitOrderAdvice = {
      amount: AllAvailableAmount,
      amountIn: 'base',
      price: trailTarget,
      reason,
      side: OrderSide.SELL,
      type: OrderType.LIMIT,
    };
    return advice;
  }

  async onFill(fill: Fill, state: TradingSessionState): Promise<void> {
    if (fill.side !== OrderSide.SELL) {
      return;
    }
    // The exit sells the full available balance, so a SELL fill that drains the live
    // base balance below the minimum order size means the position is closed — only
    // unsellable dust remains. Reading the post-fill balance (rather than decrementing a
    // snapshot) keeps the strategy correct even when size was added after attach.
    if (!this.#hasSellablePosition(state)) {
      this.#state.exited = true;
    }
  }

  async onOrderFilled(order: PendingOrder, _state: TradingSessionState): Promise<void> {
    if (this.#state.exited && order.side === OrderSide.SELL) {
      await this.onFinish?.();
    }
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const validated: TrailingStopState = isTrailingStopState(persisted) ? persisted : defaultState();
    super.restoreState(validated);
    const restored = this.#state;
    restored.exited = validated.exited;
    restored.peakPrice = validated.peakPrice;
    restored.stopPrice = validated.stopPrice;
    restored.exitReason = validated.exitReason;
    restored.exitLimitPrice = validated.exitLimitPrice;
  }
}

function isTrailingStopState(value: unknown): value is TrailingStopState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (!('exited' in value) || typeof value.exited !== 'boolean') {
    return false;
  }
  if (!('peakPrice' in value) || typeof value.peakPrice !== 'string' || !isValidBigString(value.peakPrice)) {
    return false;
  }
  if (!('stopPrice' in value) || typeof value.stopPrice !== 'string' || !isValidBigString(value.stopPrice)) {
    return false;
  }
  if (!('exitReason' in value) || (value.exitReason !== null && typeof value.exitReason !== 'string')) {
    return false;
  }
  if (!('exitLimitPrice' in value)) {
    return false;
  }
  if (value.exitLimitPrice !== null) {
    if (typeof value.exitLimitPrice !== 'string' || !isValidBigString(value.exitLimitPrice)) {
      return false;
    }
  }

  /*
   * Cross-field invariant. Restoring a state that violates this would strand the
   * strategy in an inconsistent runtime state, so reject and let restoreState fall
   * back to defaults.
   */
  const peakPrice = new Big(value.peakPrice);
  const stopPrice = new Big(value.stopPrice);

  // peakPrice and stopPrice are coupled — both '0' (not yet attached) or both non-zero.
  if (peakPrice.eq(0) !== stopPrice.eq(0)) {
    return false;
  }

  return true;
}

function isValidBigString(value: string) {
  try {
    new Big(value);
    return true;
  } catch {
    return false;
  }
}
