import type {BatchedCandle} from '@typedtrader/exchange';
import type {StrategyAdvice, StrategyAdviceMarketBuyOrder} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import {Strategy} from '../strategy/Strategy.js';

/**
 * Buys once at the first candle and holds for the entire period.
 * This is the simplest baseline strategy to compare other strategies against.
 */
export class BuyAndHoldStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-and-hold';

  #bought = false;

  protected override async processCandle(_candle: BatchedCandle): Promise<StrategyAdvice | void> {
    if (this.#bought) {
      return undefined;
    }

    this.#bought = true;

    const buyMarket: StrategyAdviceMarketBuyOrder = {
      amount: null,
      amountType: 'counter',
      price: null,
      signal: StrategySignal.BUY_MARKET,
    };

    return buyMarket;
  }
}
