import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState, BatchedCandle} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';

export const CoinFlipSchema = z.object({});

export class CoinFlipStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-coin-flip';

  protected override async processCandle(_candle: BatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    const buyMarket: OrderAdvice = {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountInCounter: true,
    };

    const sellMarket: OrderAdvice = {
      side: ExchangeOrderSide.SELL,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountInCounter: false,
    };

    // Using bitwise AND instead of modulo to avoid modulo bias
    // (a Uint8 ranges 0–255, which is not evenly divisible by 100)
    const result = globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 1;

    return result === 0 ? buyMarket : sellMarket;
  }
}
