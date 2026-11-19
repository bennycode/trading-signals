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

/** An ATR reading is only actionable together with the multiple applied to it, so the two travel as a pair. */
type AtrInputs = {atr: BigSource; atrMultiple: BigSource};

/**
 * Trailing-stop inputs. The union requires at least one method — a percentage, an ATR pair, or
 * both — so an empty or half-specified request (e.g. an ATR with no multiple) won't type-check.
 */
export type TrailStopOptions = {
  /** Running peak the trail is measured down from. */
  peak: BigSource;
} & ({atr?: never; atrMultiple?: never; trailDownPct: BigSource} | (AtrInputs & {trailDownPct?: BigSource}));

/**
 * Combined trailing stop. Computes whichever of the percentage and ATR stops the inputs allow
 * and returns the **lower (looser)** of them, so neither method can force a tighter stop than
 * the other — volatility can only widen the trail. With just `trailDownPct` it behaves like
 * {@link percentTrailStop}; with `atr` + `atrMultiple` it adds {@link atrTrailStop} to the mix.
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

/**
 * Position size that caps the loss at `riskPct` of the account if the stop is hit.
 *
 * A stop on its own says where to get out, not what getting out costs: the same 14% stop is a
 * rounding error on a small position and ruinous on a large one. Turning the distance into a
 * quantity is what actually bounds the loss, and it is why two instruments with very different
 * volatility can carry the same risk.
 *
 * Gaps and slippage can still push the fill below the stop, so treat the result as the intended
 * loss rather than a guaranteed one.
 */
export function sizeFromRisk(params: {
  accountValue: BigSource;
  entryPrice: BigSource;
  /** Share of the account to lose if the stop is hit, in percent (e.g. `1` for 1%). */
  riskPct: BigSource;
  stopPrice: BigSource;
}): Big {
  const {accountValue, entryPrice, riskPct, stopPrice} = params;
  const riskPerUnit = new Big(entryPrice).minus(stopPrice);

  if (riskPerUnit.lte(0)) {
    throw new Error('sizeFromRisk requires a stop below the entry price');
  }

  return new Big(accountValue).mul(new Big(riskPct).div(100)).div(riskPerUnit);
}
