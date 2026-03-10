import {z} from 'zod';
import Big from 'big.js';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {BatchedCandle, ExchangeFill, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {EMA} from 'trading-signals';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

export const ScalpSchema = z.object({
  /** Nominal price offset for each leg of the scalp (e.g., "0.10" means sell at fill+0.10, re-buy at fill-0.10). */
  offset: positiveNumberString,
  /** EMA period used for the initial entry filter. Default: 5. */
  emaPeriod: z.number().int().positive().optional().default(5),
});

export type ScalpConfig = z.infer<typeof ScalpSchema>;

type Phase = 'entry' | 'pendingAdvice' | 'waitingForFill';

export class ScalpStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-scalp';

  readonly #offset: Big;
  readonly #ema: EMA;

  #phase: Phase = 'entry';
  #lastFillPrice: Big | null = null;
  #lastFillSide: ExchangeOrderSide | null = null;

  constructor(config: ScalpConfig) {
    super();
    this.#offset = new Big(config.offset);
    this.#ema = new EMA(config.emaPeriod);
  }

  /**
   * Pre-seed the EMA with historical candles to skip the live warmup period.
   */
  init(candles: BatchedCandle[]): void {
    for (const candle of candles) {
      this.#ema.add(candle.close.toNumber());
    }
  }

  async onFill(fill: ExchangeFill, _state: TradingSessionState): Promise<void> {
    this.#lastFillPrice = new Big(fill.price);
    this.#lastFillSide = fill.side;
    this.#phase = 'pendingAdvice';
    this.state = {
      lastFillPrice: fill.price,
      lastFillSide: fill.side,
      phase: 'pendingAdvice',
    };
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);

    if (typeof persisted.lastFillPrice === 'string') {
      this.#lastFillPrice = new Big(persisted.lastFillPrice);
    }

    if (typeof persisted.lastFillSide === 'string') {
      this.#lastFillSide = persisted.lastFillSide as ExchangeOrderSide;
    }

    if (typeof persisted.phase === 'string') {
      this.#phase = persisted.phase as Phase;
    }
  }

  protected override async processCandle(candle: BatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (this.#phase === 'entry') {
      return this.#handleEntry(candle);
    }

    if (this.#phase === 'pendingAdvice') {
      return this.#handlePendingAdvice();
    }

    // waitingForFill — do nothing, limit order is sitting on the exchange
  }

  #handleEntry(candle: BatchedCandle): OrderAdvice | void {
    const closePrice = candle.close.toNumber();
    this.#ema.add(closePrice);

    if (!this.#ema.isStable) {
      return;
    }

    const emaValue = this.#ema.getResultOrThrow();

    if (closePrice <= emaValue) {
      return;
    }

    // Price is above EMA — enter position
    this.#phase = 'waitingForFill';
    this.state = {phase: 'waitingForFill'};

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountIn: 'counter',
      reason: `Entry: price ${closePrice.toFixed(2)} above EMA(${this.#ema.interval}) ${emaValue.toFixed(2)}`,
    };
  }

  #handlePendingAdvice(): OrderAdvice | void {
    if (!this.#lastFillPrice || !this.#lastFillSide) {
      return;
    }

    this.#phase = 'waitingForFill';
    this.state = {lastFillPrice: this.#lastFillPrice.toFixed(), lastFillSide: this.#lastFillSide, phase: 'waitingForFill'};

    if (this.#lastFillSide === ExchangeOrderSide.BUY) {
      // Just bought — sell at fill + offset
      const sellPrice = this.#lastFillPrice.plus(this.#offset);

      return {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.LIMIT,
        amount: null,
        amountIn: 'base',
        price: sellPrice,
        reason: `Scalp sell: fill ${this.#lastFillPrice.toFixed(2)} + offset ${this.#offset.toFixed(2)}`,
      };
    }

    // Just sold — re-buy at fill - offset
    const buyPrice = this.#lastFillPrice.minus(this.#offset);

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.LIMIT,
      amount: null,
      amountIn: 'base',
      price: buyPrice,
      reason: `Scalp buy: fill ${this.#lastFillPrice.toFixed(2)} - offset ${this.#offset.toFixed(2)}`,
    };
  }
}
