import {z} from 'zod';
import type {BatchedCandle} from '@typedtrader/exchange';
import Big from 'big.js';
import type {StrategyAdvice, StrategyAdviceLimitBuyOrder} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import {Strategy} from '../strategy/Strategy.js';

const positiveNumberString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive number')
  .refine(val => parseFloat(val) > 0, 'Must be greater than 0');

export const BuyOnceSchema = z.object({
  /** The price at which to place the buy order. */
  buyAt: positiveNumberString,
});

export type BuyOnceConfig = z.infer<typeof BuyOnceSchema>;

/**
 * Signals a single limit buy when the candle's close price drops to or below the predefined price.
 * After the buy is triggered, the strategy stays silent for all remaining candles.
 */
export class BuyOnceStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-buy-once';

  readonly #buyAtPrice: Big;
  #bought = false;

  constructor(config: BuyOnceConfig) {
    super();
    this.#buyAtPrice = new Big(config.buyAt);
  }

  protected override async processCandle(candle: BatchedCandle): Promise<StrategyAdvice | void> {
    if (this.#bought) {
      return undefined;
    }

    if (candle.close.gt(this.#buyAtPrice)) {
      return undefined;
    }

    this.#bought = true;

    const buyLimit: StrategyAdviceLimitBuyOrder = {
      amount: null,
      amountType: 'counter',
      price: this.#buyAtPrice,
      signal: StrategySignal.BUY_LIMIT,
    };

    return buyLimit;
  }
}
