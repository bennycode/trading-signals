import type Big from 'big.js';
import {AbstractDynamicTrailStrategy} from './AbstractDynamicTrailStrategy.js';

export {DynamicTrailSchema, type DynamicTrailConfig} from './DynamicTrailSchema.js';
export type {DynamicTrailState} from './AbstractDynamicTrailStrategy.js';

/**
 * Volatility-sized trailing stop with a **ratcheting** (monotonic) stop: the trail width tracks
 * ATR, but once the stop is set it only ever moves up. A volatility spike widens the trail for
 * future peaks without pulling an already-locked stop down, so booked gains can't be given back.
 * Predictable and faithful to the classic trailing-stop guarantee.
 */
export class DynamicTrailStrategy extends AbstractDynamicTrailStrategy {
  static override NAME = '@typedtrader/strategy-dynamic-trail';

  protected override combineStop(previousStop: Big, candidateStop: Big): Big {
    return previousStop.gt(candidateStop) ? previousStop : candidateStop;
  }
}
