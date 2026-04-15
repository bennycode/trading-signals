import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import Big from 'big.js';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';
import {positiveNumberString} from '../util/validators.js';

export const BuyBelowSellAboveSchema = ProtectedStrategySchema.extend({
  buyBelow: positiveNumberString.optional(),
  sellAbove: positiveNumberString.optional(),
});

export type BuyBelowSellAboveConfig = z.input<typeof BuyBelowSellAboveSchema>;

export class BuyBelowSellAboveStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-buy-below-sell-above';

  constructor(config: BuyBelowSellAboveConfig = {}) {
    super({config});
  }

  get #config(): BuyBelowSellAboveConfig {
    return this.getProxiedConfig<BuyBelowSellAboveConfig>();
  }

  protected override async processCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice;
    }

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
