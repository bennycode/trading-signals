import type {HighLowClose} from '../../base/Candle.type.js';
import {TechnicalIndicator} from '../../base/Indicator.js';
import {NATR} from '../../volatility/NATR/NATR.js';

export const AtrTrailMode = {
  /** Size the trail width once when the ATR warms up, then leave it alone. */
  FROZEN: 'FROZEN',
  /** Re-size the trail width from the live ATR on every candle. */
  ROLLING: 'ROLLING',
} as const;

export type AtrTrailModes = (typeof AtrTrailMode)[keyof typeof AtrTrailMode];

export type AtrTrailResult = {
  /** Highest high since the ATR warmed up, ratcheting upward only. */
  peak: number;
  /** Actionable stop level: the highest `trail` seen so far, so it never decreases. */
  stop: number;
  /** Raw trail candidate, `peak * (1 - trailPct / 100)`. In ROLLING mode a volatility spike can push it below `stop`. */
  trail: number;
  /** Trail width in percent, `multiplier * ATR%`. */
  trailPct: number;
};

export type AtrTrailConfig = {
  /** ATR lookback used to measure the instrument's volatility (default: 14) */
  interval?: number;
  /** Sizing behavior of the trail width (default: FROZEN) */
  mode?: AtrTrailModes;
  /** How many ATR% the trail sits below the peak (default: 3, Chandelier convention) */
  multiplier?: number;
};

type AtrTrailState = {
  peak: number;
  stop: number;
  trailPct: number;
};

/**
 * ATR Trail (ATR_TRAIL)
 * Type: Trend
 *
 * A trailing stop for long positions whose width is sized from the instrument's own volatility
 * instead of a hand-tuned percentage: the trail sits `multiplier` ATR% below the highest high, so a
 * volatile name automatically gets room to breathe while a calm one gets a tight stop. A close
 * below the stop means the uptrend has given back more than its usual range → exit.
 *
 * Unlike the Chandelier Exit, whose highest high rolls out of a fixed window and whose stop can
 * therefore drop again, the peak here ratchets upward only and the emitted `stop` never decreases.
 * In `FROZEN` mode (default) the width is measured once when the ATR warms up and stays fixed —
 * a plain percentage trail sized sensibly from recent history. In `ROLLING` mode the width keeps
 * adapting to the live ATR, but a volatility spike can only widen the trail for future peaks —
 * it never loosens a stop that is already in place. The raw `trail` candidate is exposed alongside
 * `stop` so a consumer can see when the two diverge.
 */
export class AtrTrail extends TechnicalIndicator<AtrTrailResult, HighLowClose<number>> {
  readonly #natr: NATR;
  #state?: AtrTrailState;
  /** One-deep undo snapshot so `replace()` can rewind the recursive peak/stop/width state. */
  #previousState?: AtrTrailState;

  public readonly interval: number;
  public readonly mode: AtrTrailModes;
  public readonly multiplier: number;

  constructor({interval = 14, mode = AtrTrailMode.FROZEN, multiplier = 3}: AtrTrailConfig = {}) {
    super();
    this.interval = interval;
    this.mode = mode;
    this.multiplier = multiplier;
    this.#natr = new NATR(interval);
  }

  override getRequiredInputs() {
    return this.#natr.getRequiredInputs();
  }

  update(candle: HighLowClose<number>, replace: boolean) {
    if (replace) {
      this.#state = this.#previousState;
    } else {
      this.#previousState = this.#state;
    }

    const natr = this.#natr.update(candle, replace);

    if (natr === null) {
      return null;
    }

    const previous = this.#state;
    const trailPct =
      previous === undefined || this.mode === AtrTrailMode.ROLLING ? this.multiplier * natr : previous.trailPct;
    const peak = previous === undefined ? candle.high : Math.max(previous.peak, candle.high);
    const trail = peak * (1 - trailPct / 100);
    const stop = previous === undefined ? trail : Math.max(previous.stop, trail);

    this.#state = {peak, stop, trailPct};

    return (this.result = {peak, stop, trail, trailPct});
  }
}
