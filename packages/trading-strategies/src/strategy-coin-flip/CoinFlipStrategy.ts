import {randomInt} from 'node:crypto';
import Big from 'big.js';
import {
  StrategyAdvice,
  StrategyAdviceMarketBuyOrder,
  StrategyAdviceMarketSellOrder,
} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';

export class CoinFlipStrategy {
  async processCandle(): Promise<StrategyAdvice | void> {
    const buyMarket: StrategyAdviceMarketBuyOrder = {
      amount: null,
      amountType: 'base',
      price: null,
      signal: StrategySignal.BUY_MARKET,
    };

    const sellMarket: StrategyAdviceMarketSellOrder = {
      amount: null,
      amountType: 'base',
      price: null,
      signal: StrategySignal.SELL_MARKET,
    };

    const result = randomInt(0, 100);

    return result < 50 ? buyMarket : sellMarket;
  }
}
