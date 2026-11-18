import Big from 'big.js';
import type {z} from 'zod';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {defineStrategy, ProtectionSchema, required, protection} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {BuyAmountSchema, positiveNumberString} from '../util/validators.js';

export const BuyOnceSchema = ProtectionSchema.safeExtend({
  /** Limit price to wait for. Omit to buy at market on the first candle. */
  buyAt: positiveNumberString.optional(),
}).and(BuyAmountSchema);

export type BuyOnceConfig = z.input<typeof BuyOnceSchema>;
type Settings = z.output<typeof BuyOnceSchema>;

/** What both entry rules need to be true, whichever way the order is sized. */
function priceIsRight(facts: {candle: OneMinuteBatchedCandle; config: Settings; entries: number}): boolean {
  const {buyAt} = facts.config;
  // One position, ever: the rules stop applying once a buy has actually filled.
  return facts.entries === 0 && (buyAt === undefined || facts.candle.close.lte(buyAt));
}

/** The limit price to offer, or `undefined` to buy at market. */
function buyAt({config}: {config: Settings}): Big | undefined {
  return config.buyAt === undefined ? undefined : new Big(config.buyAt);
}

/**
 * Buys a single position and then holds it. Useful on its own for entering a long-term position
 * at a price worth waiting for, and as the simplest thing a protective rule can be attached to.
 */
export const BuyOnce = defineStrategy(BuyOnceSchema)({
  long: {
    close: [...protection<Settings>()],
    open: [
      {
        because: ({candle}) => `Buying a fixed quantity at ${candle.close.toFixed(2)}`,
        limit: buyAt,
        quantity: ({config}) => required(config.quantity, 'quantity'),
        when: facts => facts.config.quantity !== undefined && priceIsRight(facts),
      },
      {
        because: ({candle}) => `Spending the balance at ${candle.close.toFixed(2)}`,
        limit: buyAt,
        spend: ({config}) => config.spend ?? 'all',
        when: facts => facts.config.quantity === undefined && priceIsRight(facts),
      },
    ],
  },
  markets: [MarketType.BULLISH],
  name: '@typedtrader/strategy-buy-once',
});
