import type {z} from 'zod';
import {OrderSide, OrderType} from '@typedtrader/exchange';
import {AllAvailableAmount} from '../trader/index.js';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import Big from 'big.js';
import {MarketType} from '../strategy/MarketType.js';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';
import {BuyAmountSchema, positiveNumberString} from '../util/validators.js';

export const BuyOnceSchema = ProtectedStrategySchema.extend({
  /** The limit price at which to place the buy order. When omitted, buys immediately at market price. */
  buyAt: positiveNumberString.optional(),
}).and(BuyAmountSchema);

export type BuyOnceConfig = z.input<typeof BuyOnceSchema>;

type BuyOnceState = {
  bought: boolean;
};

/**
 * Buys once and then stays silent. When `buyAt` is set, waits for the close
 * price to drop to that level and places a limit order. When `buyAt` is
 * omitted, buys immediately on the first candle with a market order.
 */
export class BuyOnceStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-buy-once';
  static override marketTypes: readonly MarketType[] = [MarketType.BULLISH];

  constructor(config: BuyOnceConfig = {}) {
    super({config, state: {bought: false}});
  }

  get #config(): BuyOnceConfig {
    return this.getProxiedConfig<BuyOnceConfig>();
  }

  get #state(): BuyOnceState {
    return this.getProxiedState<BuyOnceState>();
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

    const {buyAt, quantity, spend} = this.#config;

    if (!buyAt) {
      this.#state.bought = true;
      if (quantity) {
        return {
          amount: quantity,
          amountIn: 'base',
          side: OrderSide.BUY,
          type: OrderType.MARKET,
        };
      }
      return {
        amount: spend ?? AllAvailableAmount,
        amountIn: 'counter',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      };
    }

    const buyAtPrice = new Big(buyAt);

    if (candle.close.gt(buyAtPrice)) {
      return undefined;
    }

    this.#state.bought = true;

    let amount: string | typeof AllAvailableAmount = AllAvailableAmount;
    if (quantity) {
      amount = quantity;
    } else if (spend) {
      amount = new Big(spend).div(buyAtPrice).toFixed();
    }

    return {
      amount,
      amountIn: 'base',
      price: buyAtPrice,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
    };
  }

  protected override hydrateState(persisted: Record<string, unknown>): void {
    super.hydrateState(persisted);
    if (typeof persisted.bought === 'boolean') {
      this.#state.bought = persisted.bought;
    }
  }
}
