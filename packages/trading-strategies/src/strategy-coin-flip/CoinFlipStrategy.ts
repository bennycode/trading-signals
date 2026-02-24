import {z} from 'zod';
import {
  StrategyAdvice,
  StrategyAdviceMarketBuyOrder,
  StrategyAdviceMarketSellOrder,
} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import {Strategy} from '../strategy/Strategy.js';

export const CoinFlipSchema = z.object({});

export class CoinFlipStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-coin-flip';

  protected override async processCandle(): Promise<StrategyAdvice | void> {
    const buyMarket: StrategyAdviceMarketBuyOrder = {
      amount: null,
      amountType: 'counter',
      price: null,
      signal: StrategySignal.BUY_MARKET,
    };

    const sellMarket: StrategyAdviceMarketSellOrder = {
      amount: null,
      amountType: 'base',
      price: null,
      signal: StrategySignal.SELL_MARKET,
    };

    // Using bitwise AND instead of modulo to avoid modulo bias
    // (a Uint8 ranges 0–255, which is not evenly divisible by 100)
    const result = globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 1;

    return result === 0 ? buyMarket : sellMarket;
  }
}
