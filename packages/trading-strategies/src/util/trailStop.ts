import Big from 'big.js';
import type {BigSource} from 'big.js';

/** Percentage trailing stop: places the stop a fixed percentage below the running peak. */
export function percentTrailStop(peak: BigSource, trailDownPct: BigSource): Big {
  return new Big(peak).mul(new Big(1).minus(new Big(trailDownPct).div(100)));
}

/** Volatility-scaled trailing stop: places the stop a multiple of ATR below the running peak. */
export function atrTrailStop(peak: BigSource, atr: BigSource, atrMultiple: BigSource): Big {
  return new Big(peak).minus(new Big(atr).mul(atrMultiple));
}

export interface TrailStopOptions {
  /** Running peak the trail is measured down from. */
  peak: BigSource;
  /** Percentage distance below the peak. Omit to trail purely on volatility. */
  trailDownPct?: BigSource;
  /** Current ATR reading. Must be paired with `atrMultiple` to take effect. */
  atr?: BigSource;
  /** How many ATRs below the peak the stop sits. Must be paired with `atr` to take effect. */
  atrMultiple?: BigSource;
}

/**
 * Combined trailing stop. Computes whichever of the percentage and ATR stops the inputs allow
 * and returns the **lower (looser)** of them, so neither method can force a tighter stop than
 * the other — volatility can only widen the trail. With just `trailDownPct` it behaves like
 * {@link percentTrailStop}; with `atr` + `atrMultiple` it adds {@link atrTrailStop} to the mix.
 *
 * @throws when neither a percentage nor a complete ATR pair is supplied.
 */
export function trailStop(options: TrailStopOptions): Big {
  const {atr, atrMultiple, peak, trailDownPct} = options;
  const candidates: Big[] = [];

  if (trailDownPct !== undefined) {
    candidates.push(percentTrailStop(peak, trailDownPct));
  }

  if (atr !== undefined && atrMultiple !== undefined) {
    candidates.push(atrTrailStop(peak, atr, atrMultiple));
  }

  if (candidates.length === 0) {
    throw new Error('trailStop requires trailDownPct, or both atr and atrMultiple');
  }

  return candidates.reduce((lowest, candidate) => (candidate.lt(lowest) ? candidate : lowest));
}
