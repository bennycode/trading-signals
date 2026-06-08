import type Big from 'big.js';
import {AbstractDynamicTrailStrategy} from './AbstractDynamicTrailStrategy.js';

/**
 * Volatility-sized trailing stop with a **fully adaptive** (Chandelier Exit style) stop: the trail
 * target is recomputed every candle as `peak - atrMultiple * ATR`, so it widens (moves down) when
 * volatility spikes and tightens when it calms. Best whipsaw protection during volatility bursts,
 * at the cost of giving back more open profit when ATR jumps.
 */
export class ChandelierTrailStrategy extends AbstractDynamicTrailStrategy {
  static override NAME = '@typedtrader/strategy-chandelier-trail';

  protected override combineStop(_previousStop: Big, candidateStop: Big): Big {
    return candidateStop;
  }
}
