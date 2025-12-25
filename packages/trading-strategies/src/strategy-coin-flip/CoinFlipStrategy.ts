import {randomInt} from 'node:crypto';
import {
  StrategyAdvice,
  StrategyAdviceMarketBuyOrder,
  StrategyAdviceMarketSellOrder,
} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import {Strategy} from '../strategy/Strategy.js';

export class CoinFlipStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-coin-flip';

  protected override async processCandle(): Promise<StrategyAdvice | void> {
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
