import type {z} from 'zod';
import {defineStrategy, ProtectionSchema, stopLoss, takeProfit} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {positiveNumberString} from '../util/validators.js';

export const BuyBelowSellAboveSchema = ProtectionSchema.extend({
  /** Buy the whole balance once the price drops below this. Omit to never buy. */
  buyBelow: positiveNumberString.optional(),
  /** Sell the whole position once the price rises above this. Omit to never sell. */
  sellAbove: positiveNumberString.optional(),
});

export type BuyBelowSellAboveConfig = z.input<typeof BuyBelowSellAboveSchema>;
type Settings = z.output<typeof BuyBelowSellAboveSchema>;

/**
 * Buys below one price and sells above another, with no view on where the market is heading. Both
 * orders are limits at the candle close, so they fill at the price the decision was made on or
 * not at all.
 */
export const BuyBelowSellAbove = defineStrategy(BuyBelowSellAboveSchema)({
  long: {
    close: [
      stopLoss<Settings>({pct: ({config}) => config.stopLossPct}),
      takeProfit<Settings>({pct: ({config}) => config.takeProfitPct}),
      {
        because: ({candle, config}) => `Price ${candle.close.toFixed(2)} rose above ${config.sellAbove ?? ''}`,
        limit: ({candle}) => candle.close,
        when: ({candle, config}) => config.sellAbove !== undefined && candle.close.gt(config.sellAbove),
      },
    ],
    open: {
      because: ({candle, config}) => `Price ${candle.close.toFixed(2)} fell below ${config.buyBelow ?? ''}`,
      limit: ({candle}) => candle.close,
      spend: 'all',
      when: ({candle, config}) => config.buyBelow !== undefined && candle.close.lt(config.buyBelow),
    },
  },
  markets: [MarketType.RANGING],
  name: '@typedtrader/strategy-buy-below-sell-above',
});
