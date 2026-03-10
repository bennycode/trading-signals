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

type BuyOnceState = {
  bought: boolean;
};

/**
 * Signals a single limit buy when the candle's close price drops to or below the predefined price.
 * After the buy is triggered, the strategy stays silent for all remaining candles.
 */
export class BuyOnceStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-once';

  constructor(config: BuyOnceConfig) {
    super({config, state: {bought: false}});
  }

  get #config(): BuyOnceConfig {
    return this.getProxiedConfig<BuyOnceConfig>();
  }

  get #state(): BuyOnceState {
    return this.getProxiedState<BuyOnceState>();
  }

  protected override async processCandle(candle: BatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (this.#state.bought) {
      return undefined;
    }

    const buyAtPrice = new Big(this.#config.buyAt);

    if (candle.close.gt(buyAtPrice)) {
      return undefined;
    }

    this.#state.bought = true;

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.LIMIT,
      amount: null,
      amountIn: 'base',
      price: buyAtPrice,
    };
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);
    if (typeof persisted.bought === 'boolean') {
      this.#state.bought = persisted.bought;
    }
  }
}
