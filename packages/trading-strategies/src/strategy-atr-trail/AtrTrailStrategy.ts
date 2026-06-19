import Big from 'big.js';
import {z} from 'zod';
import {AllAvailableAmount, CandleBatcher, OrderSide, OrderType} from '@typedtrader/exchange';
import type {
  Fill,
  MarketDataSource,
  OneMinuteBatchedCandle,
  OrderAdvice,
  PendingOrder,
  TradingPair,
  TradingSessionState,
} from '@typedtrader/exchange';
import {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';
import {AtrPercent} from '../util/AtrPercent.js';
import {positiveNumberString} from '../util/validators.js';

const ONE_DAY_IN_MS = 86_400_000;

export const AtrTrailSchema = z.object({
  /** ATR lookback used to measure volatility from history. Defaults to 14. */
  atrInterval: z.number().int().positive().default(14),
  /** Candle size (ms) the warm-up history is pulled and the ATR is measured on. Defaults to daily. */
  atrIntervalMillis: z.number().int().positive().default(ONE_DAY_IN_MS),
  /** ATR multiple that sets the trail width: `trailPct = atrMultiple * ATR%`. Defaults to "3" (Chandelier convention). */
  atrMultiple: positiveNumberString.default('3'),
  /**
   * When `true`, keep re-sizing the trail from a rolling ATR as live candles arrive, instead of
   * freezing it at `init`. The ATR window advances only when a full `atrIntervalMillis` bar
   * completes, so a daily ATR steps once per day — intraday minute candles accumulate into the
   * current bar but don't move the width until that day closes. The stop still only ratchets up, so
   * a volatility spike can widen the trail for future peaks but never loosens a locked stop.
   */
  rolling: z.boolean().default(false),
});

export type AtrTrailConfig = z.input<typeof AtrTrailSchema>;

export type AtrTrailState = {
  /** `true` once the exit sell has fully filled; no further advice is emitted afterwards. */
  exited: boolean;
  /** Highest candle high since attach, ratcheting upward only. `'0'` = not yet attached. */
  peakPrice: string;
  /** Current trail target, `peakPrice * (1 - trailDownPct/100)`. `'0'` until sized and attached. */
  stopPrice: string;
  /** Trail width in percent, frozen once from `atrMultiple * ATR%` during {@link AtrTrailStrategy.init}. `null` until sized. */
  trailDownPct: string | null;
};

const defaultState = (): AtrTrailState => ({
  exited: false,
  peakPrice: '0',
  stopPrice: '0',
  trailDownPct: null,
});

/**
 * Exit-only trailing stop whose width is sized from the instrument's own volatility: on `init` it
 * pulls recent history, measures ATR%, and sets the trail to `atrMultiple * ATR%`. By default that
 * width is **frozen** — from then on it's an ordinary percentage trail that ratchets the peak up and
 * exits on a breach. With `rolling: true` the ATR keeps advancing on completed `atrIntervalMillis`
 * bars and the width re-sizes, while the stop still only ratchets up. The point either way is a
 * sensible, volatility-aware stop distance (wide for a volatile name, tight for a calm one) without
 * hand-tuning a percent.
 *
 * Attaches to whatever base balance exists (opened elsewhere or carried across a restart) and exits
 * the full available balance with a limit sell at the trail target when `candle.close` drops to it.
 * If the ATR can't be sized from history (too few candles), it holds without a stop and says so.
 */
export class AtrTrailStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-atr-trail';
  static override marketTypes: readonly MarketType[] = [MarketType.BULLISH];

  readonly #atrPercent: AtrPercent;
  readonly #atrInterval: number;
  readonly #atrIntervalMillis: number;
  readonly #atrMultiple: Big;
  readonly #atrBatcher: CandleBatcher | null;

  constructor(config: AtrTrailConfig) {
    super({config, state: defaultState()});
    const parsed = AtrTrailSchema.parse(config);
    this.#atrInterval = parsed.atrInterval;
    this.#atrIntervalMillis = parsed.atrIntervalMillis;
    this.#atrMultiple = new Big(parsed.atrMultiple);
    this.#atrPercent = new AtrPercent(parsed.atrInterval);
    this.#atrBatcher = parsed.rolling ? new CandleBatcher(parsed.atrIntervalMillis) : null;
  }

  get #state(): AtrTrailState {
    return this.getProxiedState<AtrTrailState>();
  }

  /** Read-only snapshot of the current trail state. Useful for tests and diagnostics. */
  get trailState(): Readonly<AtrTrailState> {
    return {...this.#state};
  }

  async init(market: Pick<MarketDataSource, 'getRecentCandles'>, pair: TradingPair): Promise<void> {
    // ATR(n) needs 2n-1 inputs to stabilize; pull a small buffer beyond that.
    const count = this.#atrInterval * 2 + 1;
    const candles = await market.getRecentCandles(pair, count, this.#atrIntervalMillis);
    for (const candle of candles) {
      this.#atrPercent.add({
        close: parseFloat(candle.close),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
      });
    }

    const atrPercent = this.#atrPercent.value;
    if (atrPercent === null) {
      this.onMessage?.(`ATR trail could not be sized from ${candles.length} candles; holding without a stop.`);
      return;
    }

    const trailDownPct = this.#atrMultiple.mul(atrPercent);
    this.#state.trailDownPct = trailDownPct.toFixed();
    this.onMessage?.(
      `ATR trail sized to ${trailDownPct.toFixed(2)}% (${this.#atrMultiple.toFixed()}x ${atrPercent.toFixed(2)}% ATR).`
    );
  }

  /**
   * Rolling mode only (no-op otherwise): aggregate the live candle toward the ATR timeframe and
   * re-size the trail when a bar completes. A daily ATR therefore steps once per day — intraday
   * minute candles accumulate into the current bar and don't move the width until that day closes.
   */
  #advanceRollingAtr(candle: OneMinuteBatchedCandle): void {
    if (!this.#atrBatcher) {
      return;
    }
    const completed = this.#atrBatcher.addToBatch(candle);
    if (!completed) {
      return;
    }
    this.#atrPercent.add({
      close: completed.close.toNumber(),
      high: completed.high.toNumber(),
      low: completed.low.toNumber(),
    });
    const atrPercent = this.#atrPercent.value;
    if (atrPercent !== null) {
      this.#state.trailDownPct = this.#atrMultiple.mul(atrPercent).toFixed();
    }
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    if (this.#state.exited) {
      return undefined;
    }

    this.#advanceRollingAtr(candle);

    if (this.#state.trailDownPct === null) {
      return undefined;
    }

    const trailDownPct = new Big(this.#state.trailDownPct);

    if (this.#state.peakPrice === '0') {
      if (!this.hasSellablePosition(state)) {
        return undefined;
      }
      const stop = candle.high.mul(new Big(1).minus(trailDownPct.div(100)));
      this.#state.peakPrice = candle.high.toFixed();
      this.#state.stopPrice = stop.toFixed();
      this.onMessage?.(
        `Trail attached. Peak ${candle.high.toFixed()}, stop ${stop.toFixed()} (-${trailDownPct.toFixed(2)}%).`
      );
      return undefined;
    }

    if (!this.hasSellablePosition(state)) {
      return undefined;
    }

    const peak = candle.high.gt(this.#state.peakPrice) ? candle.high : new Big(this.#state.peakPrice);
    const candidateStop = peak.mul(new Big(1).minus(trailDownPct.div(100)));
    // Ratchet up only: a wider (rolling) trail can lower the candidate, but the stop never falls.
    const previousStop = new Big(this.#state.stopPrice);
    const stop = candidateStop.gt(previousStop) ? candidateStop : previousStop;
    this.#state.peakPrice = peak.toFixed();
    this.#state.stopPrice = stop.toFixed();

    if (candle.close.gt(stop)) {
      return undefined;
    }

    const reason = `ATR trailing stop: close ${candle.close.toFixed()} <= ${stop.toFixed()} (peak ${peak.toFixed()} -${trailDownPct.toFixed(2)}%).`;
    this.onMessage?.(reason);
    /*
     * Sell at the trail target rather than at market, so a gap straight through the stop can't fill
     * far below it. The limit re-emits each candle (tracking the ratcheted stop) until it fills.
     */
    return {
      amount: AllAvailableAmount,
      amountIn: 'base',
      price: stop,
      reason,
      side: OrderSide.SELL,
      type: OrderType.LIMIT,
    };
  }

  async onFill(fill: Fill, state: TradingSessionState): Promise<void> {
    if (fill.side === OrderSide.SELL && !this.hasSellablePosition(state)) {
      this.#state.exited = true;
    }
  }

  async onOrderFilled(order: PendingOrder, _state: TradingSessionState): Promise<void> {
    if (this.#state.exited && order.side === OrderSide.SELL) {
      await this.onFinish?.();
    }
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const validated = isAtrTrailState(persisted) ? persisted : defaultState();
    super.restoreState(validated);
    const restored = this.#state;
    restored.exited = validated.exited;
    restored.peakPrice = validated.peakPrice;
    restored.stopPrice = validated.stopPrice;
    restored.trailDownPct = validated.trailDownPct;
  }
}

function isAtrTrailState(value: unknown): value is AtrTrailState {
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
  if (!('trailDownPct' in value)) {
    return false;
  }
  if (
    value.trailDownPct !== null &&
    (typeof value.trailDownPct !== 'string' || !isValidBigString(value.trailDownPct))
  ) {
    return false;
  }

  // peakPrice and stopPrice are coupled — both '0' (not yet attached) or both non-zero.
  return new Big(value.peakPrice).eq(0) === new Big(value.stopPrice).eq(0);
}

function isValidBigString(value: string) {
  try {
    new Big(value);
    return true;
  } catch {
    return false;
  }
}
