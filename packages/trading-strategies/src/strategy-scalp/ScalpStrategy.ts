import {z} from 'zod';
import Big from 'big.js';
import {CandleBatcher, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeFill, OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {EMA, ER} from 'trading-signals';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';
import {suggestScalpOffset} from './suggestScalpOffset.js';

export const ScalpSchema = z.object({
  /** Nominal price offset for each leg of the scalp (e.g., "0.10" means sell at fill+0.10, re-buy at fill-0.10).
   *  When omitted, the offset is auto-computed from historical candles passed to `init()`. */
  offset: positiveNumberString.optional(),
  /** EMA period used for the initial entry filter. Default: 5. */
  emaPeriod: z.number().int().positive().optional().default(5),
});

export type ScalpConfig = z.infer<typeof ScalpSchema>;

type Phase = 'entry' | 'pendingAdvice' | 'waitingForFill';

type ScalpState = {
  phase: Phase;
  lastFillPrice: string | null;
  lastFillSide: ExchangeOrderSide | null;
};

export class ScalpStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-scalp';
  static readonly ER_THRESHOLD = 0.4;

  readonly #ema: EMA;
  #scalpFriendly = true;

  constructor(config: ScalpConfig) {
    super({
      config,
      state: {phase: 'entry', lastFillPrice: null, lastFillSide: null},
    });
    this.#ema = new EMA(this.#config.emaPeriod);
  }

  get #config(): ScalpConfig {
    return this.getProxiedConfig<ScalpConfig>();
  }

  get #state(): ScalpState {
    return this.getProxiedState<ScalpState>();
  }

  /**
   * Pre-seed the EMA with historical candles to skip the live warmup period.
   * When no offset is configured, it is auto-computed from these candles using
   * daily ATR (takes <5ms even on 20k+ candles).
   *
   * Also evaluates Range Efficiency (ER) to determine if the stock is
   * scalp-friendly. Trending stocks (ER >= 0.4) are flagged as unsuitable.
   */
  init(candles: OneMinuteBatchedCandle[]): void {
    if (candles.length > 0) {
      const exchangeCandles = CandleBatcher.toExchangeCandles(candles);

      if (!this.#config.offset) {
        const offset = suggestScalpOffset(exchangeCandles);
        this.#config.offset = offset.toFixed(2);
      }

      this.#scalpFriendly = this.#computeRangeEfficiency(exchangeCandles);
    }

    for (const candle of candles) {
      this.#ema.add(candle.close.toNumber());
    }
  }

  get scalpFriendly(): boolean {
    return this.#scalpFriendly;
  }

  #computeRangeEfficiency(candles: import('@typedtrader/exchange').ExchangeCandle[]): boolean {
    const ONE_DAY_IN_MS = 86_400_000;
    const isSubDaily = candles[0].sizeInMillis < ONE_DAY_IN_MS;

    // Aggregate to daily bars if needed
    const dailyCandles: {close: number; high: number; low: number}[] = [];

    if (isSubDaily) {
      const dayMap = new Map<string, {high: number; low: number; close: number}>();

      for (const c of candles) {
        const day = c.openTimeInISO.slice(0, 10);
        let b = dayMap.get(day);

        if (!b) {
          b = {high: -Infinity, low: Infinity, close: 0};
          dayMap.set(day, b);
        }

        const h = parseFloat(c.high);
        const l = parseFloat(c.low);

        if (h > b.high) b.high = h;
        if (l < b.low) b.low = l;

        b.close = parseFloat(c.close);
      }

      for (const bar of dayMap.values()) {
        dailyCandles.push(bar);
      }
    } else {
      for (const c of candles) {
        dailyCandles.push({close: parseFloat(c.close), high: parseFloat(c.high), low: parseFloat(c.low)});
      }
    }

    if (dailyCandles.length < 14) {
      return true;
    }

    const er = new ER(dailyCandles.length);

    for (const bar of dailyCandles) {
      er.add(bar);
    }

    return er.getResultOrThrow() < ScalpStrategy.ER_THRESHOLD;
  }

  async onFill(fill: ExchangeFill, _state: TradingSessionState): Promise<void> {
    this.#state.lastFillPrice = fill.price;
    this.#state.lastFillSide = fill.side;
    this.#state.phase = 'pendingAdvice';
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);

    if (typeof persisted.lastFillPrice === 'string') {
      this.#state.lastFillPrice = persisted.lastFillPrice;
    }

    if (typeof persisted.lastFillSide === 'string') {
      this.#state.lastFillSide = persisted.lastFillSide as ExchangeOrderSide;
    }

    if (typeof persisted.phase === 'string') {
      this.#state.phase = persisted.phase as Phase;
    }
  }

  protected override async processCandle(candle: OneMinuteBatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (this.#state.phase === 'entry') {
      return this.#handleEntry(candle);
    }

    if (this.#state.phase === 'pendingAdvice') {
      return this.#handlePendingAdvice();
    }

    // waitingForFill — do nothing, limit order is sitting on the exchange
  }

  #handleEntry(candle: OneMinuteBatchedCandle): OrderAdvice | void {
    const closePrice = candle.close.toNumber();
    this.#ema.add(closePrice);

    if (!this.#scalpFriendly) {
      return;
    }

    if (!this.#ema.isStable) {
      return;
    }

    const emaValue = this.#ema.getResultOrThrow();

    if (closePrice <= emaValue) {
      return;
    }

    // Price is above EMA — enter position
    this.#state.phase = 'waitingForFill';

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountIn: 'counter',
      reason: `Entry: price ${closePrice.toFixed(2)} above EMA(${this.#ema.interval}) ${emaValue.toFixed(2)}`,
    };
  }

  #handlePendingAdvice(): OrderAdvice | void {
    if (!this.#state.lastFillPrice || !this.#state.lastFillSide || !this.#config.offset) {
      return;
    }

    this.#state.phase = 'waitingForFill';
    const offset = new Big(this.#config.offset);
    const lastFillPrice = new Big(this.#state.lastFillPrice);

    if (this.#state.lastFillSide === ExchangeOrderSide.BUY) {
      // Just bought — sell at fill + offset
      const sellPrice = lastFillPrice.plus(offset);

      return {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.LIMIT,
        amount: null,
        amountIn: 'base',
        price: sellPrice,
        reason: `Scalp sell: fill ${lastFillPrice.toFixed(2)} + offset ${offset.toFixed(2)}`,
      };
    }

    // Just sold — re-buy at fill - offset
    const buyPrice = lastFillPrice.minus(offset);

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.LIMIT,
      amount: null,
      amountIn: 'base',
      price: buyPrice,
      reason: `Scalp buy: fill ${lastFillPrice.toFixed(2)} - offset ${offset.toFixed(2)}`,
    };
  }
}
