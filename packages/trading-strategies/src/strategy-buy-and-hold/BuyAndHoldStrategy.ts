import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {BatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';

export const BuyAndHoldSchema = z.object({});

/**
 * Buys once at the first candle and holds for the entire period.
 * This is the simplest baseline strategy to compare other strategies against.
 */
export class BuyAndHoldStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-and-hold';

  #bought = false;

  protected override async processCandle(_candle: BatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (this.#bought) {
      return undefined;
    }

    this.#bought = true;

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountInCounter: true,
    };
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);
    if (typeof persisted.bought === 'boolean') {
      this.#bought = persisted.bought;
    }
  }
}
