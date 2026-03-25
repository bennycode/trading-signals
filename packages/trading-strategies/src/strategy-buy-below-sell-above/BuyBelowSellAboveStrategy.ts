import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import Big from 'big.js';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

export const BuyBelowSellAboveSchema = z.object({
  buyBelow: positiveNumberString.optional(),
  sellAbove: positiveNumberString.optional(),
});

export type BuyBelowSellAboveConfig = z.infer<typeof BuyBelowSellAboveSchema>;

export class BuyBelowSellAboveStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-below-sell-above';

  constructor(config: BuyBelowSellAboveConfig = {}) {
    super({config});
  }

  get #config(): BuyBelowSellAboveConfig {
    return this.getProxiedConfig<BuyBelowSellAboveConfig>();
  }

  protected override async processCandle(candle: OneMinuteBatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    const closePrice = candle.close;

    if (this.#config.buyBelow !== undefined) {
      const buyBelowPrice = new Big(this.#config.buyBelow);

      if (closePrice.lt(buyBelowPrice)) {
        return {
          side: ExchangeOrderSide.BUY,
          type: ExchangeOrderType.LIMIT,
          amount: null,
          amountIn: 'base',
          price: closePrice,
        };
      }
    }

    if (this.#config.sellAbove !== undefined) {
      const sellAbovePrice = new Big(this.#config.sellAbove);

      if (closePrice.gt(sellAbovePrice)) {
        return {
          side: ExchangeOrderSide.SELL,
          type: ExchangeOrderType.LIMIT,
          amount: null,
          amountIn: 'base',
          price: closePrice,
        };
      }
    }
  }
}
