import Big from 'big.js';
import {AllAvailableAmount, CandleBatcher, ONE_MINUTE_IN_MS, OrderSide, OrderType} from '@typedtrader/exchange';
import type {
  Candle,
  Fill,
  HistoricalCandleProvider,
  LimitOrderAdvice,
  OneMinuteBatchedCandle,
  OrderAdvice,
  PendingOrder,
  TradingSessionState,
} from '@typedtrader/exchange';
import {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';
import {AtrPercent} from '../util/AtrPercent.js';
import {atrMultipleToPercent, classifyAtrMultiple} from '../util/atrUnits.js';
import {percentTrailStop} from '../util/trailStop.js';
import {DynamicTrailSchema, type DynamicTrailConfig} from './DynamicTrailSchema.js';

export type DynamicTrailState = {
  /** `true` once the trailing-stop sell has fully filled (position reduced to zero in `onFill`). */
  exited: boolean;
  /** Limit price of the most recently emitted exit advice, or `null` for market exits / before a breach. */
  exitLimitPrice: string | null;
  /** Human-readable reason captured when the trail was first breached. `null` until the exit fires. */
  exitReason: string | null;
  /** Highest candle high since attach, ratcheting upward only. `'0'` is the "not yet attached" sentinel. */
  peakPrice: string;
  /** Current trail target. `'0'` until the first volatility-sized stop is established. */
  stopPrice: string;
  /** Current trail width in percent (`atrMultiple * ATR%`, clamped). `null` until first sized. */
  trailDownPct: string | null;
};

const defaultState = (): DynamicTrailState => ({
  exited: false,
  exitLimitPrice: null,
  exitReason: null,
  peakPrice: '0',
  stopPrice: '0',
  trailDownPct: null,
});

/**
 * Exit-only trailing stop whose trail width is derived from volatility rather than hardcoded.
 * Each candle feeds an {@link AtrPercent}; the trail percentage is `atrMultiple * ATR%` (clamped
 * by the optional min/max), so the stop auto-sizes to the instrument — wide for a volatile name,
 * tight for a calm one — instead of a fixed percentage that may sit inside the noise band.
 *
 * Subclasses decide how a freshly computed stop combines with the previous one via
 * {@link combineStop}: ratchet-up-only vs. fully adaptive.
 *
 * Note: the ATR is not persisted, so after a restart it re-warms from cold. The peak and the last
 * stop ARE persisted, so a previously established stop keeps being enforced during re-warmup.
 */
export abstract class AbstractDynamicTrailStrategy extends Strategy {
  static override marketTypes: readonly MarketType[] = [MarketType.BULLISH];

  readonly #atrPercent: AtrPercent;
  readonly #atrInterval: number;
  readonly #atrIntervalMillis: number | null;
  readonly #atrBatcher: CandleBatcher | null;
  readonly #atrMultiple: number;
  readonly #minTrailPct: number | null;
  readonly #maxTrailPct: number | null;
  readonly #fallbackTrailPct: number | null;
  readonly #exitOrder: 'limit' | 'market';
  readonly #pivotPrice: Big | null;

  constructor(config: DynamicTrailConfig) {
    super({config, state: defaultState()});
    const parsed = DynamicTrailSchema.parse(config);
    this.#atrInterval = parsed.atrInterval;
    this.#atrIntervalMillis = parsed.atrIntervalMillis ?? null;
    this.#atrBatcher = parsed.atrIntervalMillis ? new CandleBatcher(parsed.atrIntervalMillis) : null;
    this.#atrMultiple = parseFloat(parsed.atrMultiple);
    this.#minTrailPct = parsed.minTrailDownPct ? parseFloat(parsed.minTrailDownPct) : null;
    this.#maxTrailPct = parsed.maxTrailDownPct ? parseFloat(parsed.maxTrailDownPct) : null;
    this.#fallbackTrailPct = parsed.fallbackTrailDownPct ? parseFloat(parsed.fallbackTrailDownPct) : null;
    this.#exitOrder = parsed.exitOrder;
    this.#pivotPrice = parsed.pivotPrice ? new Big(parsed.pivotPrice) : null;
    this.#atrPercent = new AtrPercent(parsed.atrInterval);
  }

  /**
   * Warm-up hook (called by the runtime on session start). Fetches enough historical candles at
   * the ATR timeframe to stabilize the ATR, so the trail is volatility-sized from the very first
   * live candle instead of sitting unprotected through the warm-up period. Only the ATR is seeded
   * — the peak still starts at attach, since there is no position to guard until then.
   */
  async init(provider: HistoricalCandleProvider): Promise<void> {
    const intervalInMillis = this.#atrIntervalMillis ?? ONE_MINUTE_IN_MS;
    // ATR(n) needs 2n-1 inputs to stabilize; fetch a small buffer beyond that.
    const count = this.#atrInterval * 2 + 1;
    const candles = await provider.getRecentCandles(intervalInMillis, count);

    for (const candle of candles) {
      this.#seedAtr(candle);
    }
  }

  /** Feed a completed historical candle's HLC into the ATR (string prices). */
  #seedAtr(candle: Candle): void {
    this.#atrPercent.add({close: parseFloat(candle.close), high: parseFloat(candle.high), low: parseFloat(candle.low)});
  }

  /**
   * Feed the live candle toward the ATR. When an ATR timeframe is configured, the candle is
   * aggregated and the ATR only advances on completed timeframe candles; otherwise every candle
   * updates the ATR directly.
   */
  #advanceAtr(candle: OneMinuteBatchedCandle): void {
    if (!this.#atrBatcher) {
      this.#atrPercent.add({close: candle.close.toNumber(), high: candle.high.toNumber(), low: candle.low.toNumber()});
      return;
    }

    const completed = this.#atrBatcher.addToBatch(candle);

    if (completed) {
      this.#atrPercent.add({
        close: completed.close.toNumber(),
        high: completed.high.toNumber(),
        low: completed.low.toNumber(),
      });
    }
  }

  /**
   * Combines the previously stored stop with the freshly computed candidate. Ratcheting strategies
   * keep the higher of the two (the stop never falls); adaptive strategies take the candidate.
   */
  protected abstract combineStop(previousStop: Big, candidateStop: Big): Big;

  get #state(): DynamicTrailState {
    return this.getProxiedState<DynamicTrailState>();
  }

  /** Read-only snapshot of the current trailing-stop state. Useful for tests and diagnostics. */
  get trailState(): Readonly<DynamicTrailState> {
    return {...this.#state};
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    if (this.#state.exited) {
      return undefined;
    }

    this.#advanceAtr(candle);

    if (this.#state.peakPrice === '0') {
      if (!this.hasSellablePosition(state)) {
        return undefined;
      }

      const peak = this.#pivotPrice ?? candle.high;
      this.#state.peakPrice = peak.toFixed();
      this.#applyStop(peak);
      this.onMessage?.(
        `Dynamic trail attached. Peak ${peak.toFixed()}, ATR(${this.#atrInterval}) x${this.#atrMultiple} (${classifyAtrMultiple(this.#atrMultiple)}).`
      );
      return undefined;
    }

    if (!this.hasSellablePosition(state)) {
      return undefined;
    }

    const previousPeak = new Big(this.#state.peakPrice);
    const newPeak = candle.high.gt(previousPeak) ? candle.high : previousPeak;

    if (newPeak.gt(previousPeak)) {
      this.#state.peakPrice = newPeak.toFixed();
    }

    const stop = this.#applyStop(newPeak);

    if (stop === null || candle.close.gt(stop)) {
      return undefined;
    }

    const reason = `Dynamic trailing stop: close ${candle.close.toFixed()} <= stop ${stop.toFixed()} (peak ${newPeak.toFixed()} - ${this.#state.trailDownPct ?? '?'}%)`;

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

    this.#state.exitLimitPrice = stop.toFixed();
    const advice: LimitOrderAdvice = {
      amount: AllAvailableAmount,
      amountIn: 'base',
      price: stop,
      reason,
      side: OrderSide.SELL,
      type: OrderType.LIMIT,
    };
    return advice;
  }

  /**
   * Recomputes the stop for the given peak using the current volatility-derived trail percentage
   * and the subclass's {@link combineStop}. Returns the active stop, or `null` when no stop has
   * been established yet (ATR not warmed up and no fallback configured).
   */
  #applyStop(peak: Big): Big | null {
    const storedStop = new Big(this.#state.stopPrice);
    const trailPct = this.#currentTrailPct();

    if (trailPct === null) {
      return storedStop.gt(0) ? storedStop : null;
    }

    const candidate = percentTrailStop(peak, trailPct);
    const combined = this.combineStop(storedStop, candidate);
    this.#state.stopPrice = combined.toFixed();
    this.#state.trailDownPct = new Big(trailPct).toFixed();
    return combined;
  }

  /** Current trail width in percent: `atrMultiple * ATR%`, clamped, or the fallback / `null` during warmup. */
  #currentTrailPct() {
    const atrPercent = this.#atrPercent.value;

    if (atrPercent === null) {
      return this.#fallbackTrailPct;
    }

    let trailPct = atrMultipleToPercent(this.#atrMultiple, atrPercent);

    if (this.#minTrailPct !== null && trailPct < this.#minTrailPct) {
      trailPct = this.#minTrailPct;
    }

    if (this.#maxTrailPct !== null && trailPct > this.#maxTrailPct) {
      trailPct = this.#maxTrailPct;
    }

    return trailPct;
  }

  async onFill(fill: Fill, state: TradingSessionState): Promise<void> {
    if (fill.side !== OrderSide.SELL) {
      return;
    }

    if (!this.hasSellablePosition(state)) {
      this.#state.exited = true;
    }
  }

  async onOrderFilled(order: PendingOrder, _state: TradingSessionState): Promise<void> {
    if (this.#state.exited && order.side === OrderSide.SELL) {
      await this.onFinish?.();
    }
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const validated: DynamicTrailState = isDynamicTrailState(persisted) ? persisted : defaultState();
    super.restoreState(validated);
    const restored = this.#state;
    restored.exited = validated.exited;
    restored.exitLimitPrice = validated.exitLimitPrice;
    restored.exitReason = validated.exitReason;
    restored.peakPrice = validated.peakPrice;
    restored.stopPrice = validated.stopPrice;
    restored.trailDownPct = validated.trailDownPct;
  }
}

function isDynamicTrailState(value: unknown): value is DynamicTrailState {
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

  if (
    value.exitLimitPrice !== null &&
    (typeof value.exitLimitPrice !== 'string' || !isValidBigString(value.exitLimitPrice))
  ) {
    return false;
  }

  if (!('trailDownPct' in value)) {
    return false;
  }

  if (
    value.trailDownPct !== null &&
    (typeof value.trailDownPct !== 'string' || !isValidBigString(value.trailDownPct))
  ) {
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
