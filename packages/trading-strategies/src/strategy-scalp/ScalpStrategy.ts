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

type ScalpState = {
  phase: Phase;
  lastFillPrice: string | null;
  lastFillSide: ExchangeOrderSide | null;
};

export class ScalpStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-scalp';

  readonly #ema: EMA;

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
   */
  init(candles: BatchedCandle[]): void {
    for (const candle of candles) {
      this.#ema.add(candle.close.toNumber());
    }
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

  protected override async processCandle(candle: BatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (this.#state.phase === 'entry') {
      return this.#handleEntry(candle);
    }

    if (this.#state.phase === 'pendingAdvice') {
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
    if (!this.#state.lastFillPrice || !this.#state.lastFillSide) {
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
