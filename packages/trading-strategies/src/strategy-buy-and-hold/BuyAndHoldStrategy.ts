import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';

export const BuyAndHoldSchema = z.object({});

type BuyAndHoldState = {
  bought: boolean;
};

/**
 * Buys once at the first candle and holds for the entire period.
 * This is the simplest baseline strategy to compare other strategies against.
 */
export class BuyAndHoldStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-and-hold';

  constructor() {
    super({state: {bought: false}});
  }

  get #state(): BuyAndHoldState {
    return this.getProxiedState<BuyAndHoldState>();
  }

  protected override async processCandle(_candle: OneMinuteBatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (this.#state.bought) {
      return undefined;
    }

    this.#state.bought = true;

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountIn: 'counter',
    };
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);
    if (typeof persisted.bought === 'boolean') {
      this.#state.bought = persisted.bought;
    }
  }
}
