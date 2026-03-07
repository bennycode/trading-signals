import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {BatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import Big from 'big.js';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

export const BuyOnceSchema = z.object({
  /** The price at which to place the buy order. */
  buyAt: positiveNumberString,
});

export type BuyOnceConfig = z.infer<typeof BuyOnceSchema>;

/**
 * Signals a single limit buy when the candle's close price drops to or below the predefined price.
 * After the buy is triggered, the strategy stays silent for all remaining candles.
 */
export class BuyOnceStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-once';

  readonly #buyAtPrice: Big;
  #bought = false;

  constructor(config: BuyOnceConfig) {
    super();
    this.#buyAtPrice = new Big(config.buyAt);
  }

  protected override async processCandle(candle: BatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (this.#bought) {
      return undefined;
    }

    if (candle.close.gt(this.#buyAtPrice)) {
      return undefined;
    }

    this.#bought = true;

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.LIMIT,
      amount: null,
      amountInCounter: true,
      price: this.#buyAtPrice,
    };
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);
    if (typeof persisted.bought === 'boolean') {
      this.#bought = persisted.bought;
    }
  }
}
