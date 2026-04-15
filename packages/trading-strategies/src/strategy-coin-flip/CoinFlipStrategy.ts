import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';

export const CoinFlipSchema = ProtectedStrategySchema.extend({});

export type CoinFlipConfig = z.input<typeof CoinFlipSchema>;

export class CoinFlipStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-coin-flip';

  constructor(config: CoinFlipConfig = {}) {
    super({config});
  }

  protected override async processCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice;
    }

    const buyMarket: OrderAdvice = {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountIn: 'counter',
    };

    const sellMarket: OrderAdvice = {
      side: ExchangeOrderSide.SELL,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountIn: 'base',
    };

    // Using bitwise AND instead of modulo to avoid modulo bias
    // (a Uint8 ranges 0–255, which is not evenly divisible by 100)
    const result = globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 1;

    return result === 0 ? buyMarket : sellMarket;
  }
}
