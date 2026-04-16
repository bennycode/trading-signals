import {z} from 'zod';
import {ALL_AVAILABLE, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import Big from 'big.js';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';
import {positiveNumberString} from '../util/validators.js';

export const BuyOnceSchema = ProtectedStrategySchema.extend({
  /** The price at which to place the buy order. */
  buyAt: positiveNumberString,
});

export type BuyOnceConfig = z.input<typeof BuyOnceSchema>;

type BuyOnceState = {
  bought: boolean;
};

/**
 * Signals a single limit buy when the candle's close price drops to or below the predefined price.
 * After the buy is triggered, the strategy stays silent for all remaining candles.
 */
export class BuyOnceStrategy extends ProtectedStrategy {
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

  protected override async processCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice;
    }

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
      amount: ALL_AVAILABLE,
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
