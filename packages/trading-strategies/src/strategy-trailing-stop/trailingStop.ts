import {z} from 'zod';
import {defineStrategy, trailingStop} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {positiveNumberString} from '../util/validators.js';

export const TrailingStopSchema = z.object({
  /**
   * `"limit"` (the default) offers exactly the trail target, which is predictable but can miss a
   * gap. `"market"` takes whatever the market offers and always fills.
   */
  exitOrder: z.enum(['limit', 'market']).default('limit'),
  /**
   * A price the trail refuses to anchor below. Without it the anchor starts at the first high the
   * strategy sees, which for a position opened elsewhere is whatever candle it attached on rather
   * than a price that means anything — a cost basis or a recent swing high does.
   */
  pivotPrice: positiveNumberString.optional(),
  /** Exit once price falls this many percent from the anchor. */
  trailDownPct: positiveNumberString.default('10'),
});

export type TrailingStopConfig = z.input<typeof TrailingStopSchema>;
type Settings = z.output<typeof TrailingStopSchema>;

/**
 * Guards a position it did not open — bought by hand, by another strategy, or carried across a
 * restart — and sells it once price falls `trailDownPct` from the best price seen since. It has
 * no entry rule at all, so there is nothing to buy the position back: the exit is terminal and
 * the session is torn down after it.
 */
export const TrailingStop = defineStrategy(TrailingStopSchema)({
  long: {
    close: trailingStop<Settings>({
      as: ({config}) => config.exitOrder,
      pct: ({config}) => config.trailDownPct,
      pivot: ({config}) => config.pivotPrice,
    }),
  },
  markets: [MarketType.BULLISH],
  name: '@typedtrader/strategy-trailing-stop',
});
