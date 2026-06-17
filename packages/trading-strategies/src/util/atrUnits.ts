/**
 * Conversions between a percentage stop and ATR multiples, bridged by the instrument's ATR%
 * (its "usual % move per bar"; see {@link AtrPercent}). This is what turns the observation
 * "a 10% trail on STX is only ≈1.4× ATR" into a number you can act on.
 */

/**
 * How many ATRs of room a percentage stop provides at the given ATR%.
 * `percentToAtrMultiple(10, 7.11)` → `≈1.41` — i.e. a 10% trail sits just 1.4 average bars away.
 *
 * @throws when `atrPercent` is not positive (a flat instrument has no meaningful ATR room).
 */
export function percentToAtrMultiple(trailDownPct: number, atrPercent: number) {
  if (atrPercent <= 0) {
    throw new Error('atrPercent must be greater than 0');
  }

  return trailDownPct / atrPercent;
}

/**
 * The percentage stop that yields a given ATR multiple at the current ATR%.
 * `atrMultipleToPercent(3, 7.11)` → `≈21.3` — a 3× ATR trail on STX needs ~21%, not 10%.
 */
export function atrMultipleToPercent(atrMultiple: number, atrPercent: number) {
  return atrMultiple * atrPercent;
}

/**
 * Conventional bands for an ATR-based trailing stop. These are heuristics, not laws: the widely
 * cited Chandelier Exit trails at 3× ATR, and most ATR-stop guidance lives in the 2–3.5× range.
 * Below ~2× the stop sits inside the instrument's normal noise (whipsaw-prone); above ~3.5× it
 * gives back a lot of open profit before triggering.
 */
export const ATR_TRAIL_BANDS = {
  /** At or above this multiple the trail is considered loose. */
  looseAtOrAbove: 3.5,
  /** Below this multiple the trail sits inside normal volatility and is whipsaw-prone. */
  whippyBelow: 2,
} as const;

/** A sensible default ATR multiple for a trend-following trailing stop (Chandelier Exit convention). */
export const DEFAULT_ATR_TRAIL_MULTIPLE = 3;

/** How an ATR multiple rates as trailing-stop wiggle room. See {@link ATR_TRAIL_BANDS} for the thresholds. */
export type AtrRoomVerdict = 'whippy' | 'balanced' | 'loose';

/** Classifies an ATR multiple into an {@link AtrRoomVerdict} using the {@link ATR_TRAIL_BANDS} thresholds. */
export function classifyAtrMultiple(atrMultiple: number): AtrRoomVerdict {
  if (atrMultiple < ATR_TRAIL_BANDS.whippyBelow) {
    return 'whippy';
  }

  if (atrMultiple >= ATR_TRAIL_BANDS.looseAtOrAbove) {
    return 'loose';
  }

  return 'balanced';
}
