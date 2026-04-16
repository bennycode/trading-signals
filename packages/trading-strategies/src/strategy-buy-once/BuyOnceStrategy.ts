import {z} from 'zod';
import {ALL_AVAILABLE_AMOUNT, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import Big from 'big.js';
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

  constructor(config: BuyOnceConfig = {}) {
    super({config, state: {bought: false}});
  }

  get #config(): BuyOnceConfig {
    return this.getProxiedConfig<BuyOnceConfig>();
  }

  get #state(): BuyOnceState {
    return this.getProxiedState<BuyOnceState>();
  }

  protected override async processCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
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
          side: ExchangeOrderSide.BUY,
          type: ExchangeOrderType.MARKET,
          amount: quantity,
          amountIn: 'base',
        };
      }
      return {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: spend ?? ALL_AVAILABLE_AMOUNT,
        amountIn: 'counter',
      };
    }

    const buyAtPrice = new Big(buyAt);

    if (candle.close.gt(buyAtPrice)) {
      return undefined;
    }

    this.#state.bought = true;

    let amount: string | typeof ALL_AVAILABLE_AMOUNT = ALL_AVAILABLE_AMOUNT;
    if (quantity) {
      amount = quantity;
    } else if (spend) {
      amount = new Big(spend).div(buyAtPrice).toFixed();
    }

    return {
      side: ExchangeOrderSide.BUY,
      type: ExchangeOrderType.LIMIT,
      amount,
      amountIn: 'base',
      price: buyAtPrice,
    };
  }

  override restoreState(persisted: Record<string, unknown>): void {
    super.restoreState(persisted);
    if (typeof persisted.bought === 'boolean') {
      this.#state.bought = persisted.bought;
    }
  }
}
