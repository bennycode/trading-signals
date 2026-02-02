import type {BatchedCandle} from '@typedtrader/exchange';
import {StrategyAdvice, StrategyAdviceLimitBuyOrder, StrategyAdviceLimitSellOrder} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import Big from 'big.js';
import {Strategy} from '../strategy/Strategy.js';

export interface BuyBelowSellAboveConfig {
  buyBelow?: string;
  sellAbove?: string;
}

export class BuyBelowSellAboveStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-below-sell-above';

  readonly #config: BuyBelowSellAboveConfig;

  constructor(config: BuyBelowSellAboveConfig = {}) {
    super();
    this.#config = config;
  }

  override async processCandle(candle: BatchedCandle): Promise<StrategyAdvice | void> {
    const closePrice = candle.close;

    if (this.#config.buyBelow !== undefined) {
      const buyBelowPrice = new Big(this.#config.buyBelow);

      if (closePrice.lt(buyBelowPrice)) {
        const buyLimit: StrategyAdviceLimitBuyOrder = {
          amount: null,
          amountType: 'base',
          price: closePrice,
          signal: StrategySignal.BUY_LIMIT,
        };

        return buyLimit;
      }
    }

    if (this.#config.sellAbove !== undefined) {
      const sellAbovePrice = new Big(this.#config.sellAbove);

      if (closePrice.gt(sellAbovePrice)) {
        const sellLimit: StrategyAdviceLimitSellOrder = {
          amount: null,
          amountType: 'base',
          price: closePrice,
          signal: StrategySignal.SELL_LIMIT,
        };

        return sellLimit;
      }
    }
  }
}
