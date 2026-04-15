import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';

export const BuyAndHoldSchema = ProtectedStrategySchema.extend({});
export type BuyAndHoldConfig = z.input<typeof BuyAndHoldSchema>;

type BuyAndHoldState = {
  bought: boolean;
};

/**
 * Buys once at the first candle and holds for the entire period — the
 * simplest baseline strategy to compare others against.
 *
 * Because it extends `ProtectedStrategy`, optional stop-loss / take-profit kill
 * switches can be configured via the nested `protected` key. That turns the
 * plain hold into a protected buy-and-hold: enter once at the first candle,
 * then let the guards manage the exit. Once a guard fires, the strategy is
 * terminal for the session — buy-and-hold only ever enters once.
 */
export class BuyAndHoldStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-buy-and-hold';

  constructor(config: BuyAndHoldConfig = {}) {
    super({config, state: {bought: false}});
  }

  get #state(): BuyAndHoldState {
    return this.getProxiedState<BuyAndHoldState>();
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice;
    }

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
