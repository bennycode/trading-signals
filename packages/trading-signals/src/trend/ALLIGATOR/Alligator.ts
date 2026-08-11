import type {HighLow} from '../../base/Candle.type.js';
import {TechnicalIndicator} from '../../base/Indicator.js';
import {getMedianPrice} from '../../util/getMedianPrice.js';
import {pushUpdate} from '../../util/pushUpdate.js';
import {WSMA} from '../WSMA/WSMA.js';

export type AlligatorResult = {
  /** Jaw ("blue line"): balance line of the slowest timeframe hierarchy */
  jaw: number;
  /** Lips ("green line"): balance line of the fastest timeframe hierarchy */
  lips: number;
  /** Teeth ("red line"): balance line of the intermediate timeframe hierarchy */
  teeth: number;
};

export type AlligatorConfig = {
  /** Smoothing window of the jaw line (default: 13) */
  jawInterval?: number;
  /** Bars the jaw line is displaced forward (default: 8) */
  jawShift?: number;
  /** Smoothing window of the lips line (default: 5) */
  lipsInterval?: number;
  /** Bars the lips line is displaced forward (default: 3) */
  lipsShift?: number;
  /** Smoothing window of the teeth line (default: 8) */
  teethInterval?: number;
  /** Bars the teeth line is displaced forward (default: 5) */
  teethShift?: number;
};

type AlligatorState = {
  jawBuffer: number[];
  lipsBuffer: number[];
  teethBuffer: number[];
};

/**
 * Williams Alligator (ALLIGATOR)
 * Type: Trend
 *
 * Published by Bill Williams in "Trading Chaos" (1995), the Alligator pictures the market as an alligator that
 * sleeps, awakens and eats. Three smoothed moving averages (SMMA) of the median price form its jaw, teeth and lips,
 * each smoothing a different timeframe hierarchy: the jaw carries the slowest balance line, the teeth the
 * intermediate one and the lips the fastest.
 *
 * On a chart, every line is plotted ahead of the bar it was computed on — the jaw by 8 bars, the teeth by 5 and the
 * lips by 3. Unlike a uniformly displaced overlay whose shift can be left to the chart, the three lines shift by
 * different amounts, and their resulting alignment is exactly what the indicator reads. This implementation
 * therefore applies the displacement internally: the value reported for the current bar is the one its line
 * produced the configured number of bars earlier, and a result only appears once all three displaced lines exist.
 *
 * Interpretation:
 * When the three lines are intertwined, the alligator sleeps and the market is range-bound — Williams stays out of
 * such stretches, and the longer the sleep, the stronger the move he expects afterwards. When the lines fan open
 * with the lips leading, the teeth in the middle and the jaw trailing, the alligator awakens and eats: an uptrend
 * when price runs above the fanned lines, a downtrend when it runs below. Reading these phases requires the mutual
 * alignment of three lines over time rather than a fixed threshold, so this class emits no standalone signal.
 *
 * @see https://www.metatrader5.com/en/terminal/help/indicators/bw_indicators/alligator
 */
export class Alligator extends TechnicalIndicator<AlligatorResult, HighLow<number>, AlligatorState> {
  protected override state: AlligatorState = {jawBuffer: [], lipsBuffer: [], teethBuffer: []};
  readonly #jaw: WSMA;
  readonly #lips: WSMA;
  readonly #teeth: WSMA;

  public readonly jawInterval: number;
  public readonly jawShift: number;
  public readonly lipsInterval: number;
  public readonly lipsShift: number;
  public readonly teethInterval: number;
  public readonly teethShift: number;

  constructor({
    jawInterval = 13,
    jawShift = 8,
    lipsInterval = 5,
    lipsShift = 3,
    teethInterval = 8,
    teethShift = 5,
  }: AlligatorConfig = {}) {
    super();

    // A line needs a real smoothing window and a real displacement, or its buffers never fill nor cap
    for (const [name, value] of Object.entries({jawInterval, lipsInterval, teethInterval})) {
      if (!Number.isFinite(value) || value < 1) {
        throw new Error(`The ${name} has to be a positive number, but "${value}" was given.`);
      }
    }

    for (const [name, value] of Object.entries({jawShift, lipsShift, teethShift})) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`The ${name} has to be zero or a positive number, but "${value}" was given.`);
      }
    }
    this.jawInterval = jawInterval;
    this.jawShift = jawShift;
    this.lipsInterval = lipsInterval;
    this.lipsShift = lipsShift;
    this.teethInterval = teethInterval;
    this.teethShift = teethShift;
    this.#jaw = new WSMA(jawInterval);
    this.#lips = new WSMA(lipsInterval);
    this.#teeth = new WSMA(teethInterval);
  }

  override getRequiredInputs() {
    return Math.max(
      this.jawInterval + this.jawShift,
      this.lipsInterval + this.lipsShift,
      this.teethInterval + this.teethShift
    );
  }

  /*
   * The displacement queues every smoothed value until its turn to be reported: the oldest queued
   * value is the one produced the configured number of bars ago. A replacement only rewrites the
   * newest queued value, because the current bar can never alter what earlier bars produced.
   */
  #delay(line: WSMA, median: number, buffer: number[], shift: number, replace: boolean) {
    const smoothed = line.update(median, replace);

    if (smoothed !== null) {
      pushUpdate({array: buffer, item: smoothed, maxLength: shift + 1, replace});
    }
  }

  update(candle: HighLow<number>, replace: boolean) {
    const median = getMedianPrice(candle);

    this.#delay(this.#jaw, median, this.state.jawBuffer, this.jawShift, replace);
    this.#delay(this.#lips, median, this.state.lipsBuffer, this.lipsShift, replace);
    this.#delay(this.#teeth, median, this.state.teethBuffer, this.teethShift, replace);

    const {jawBuffer, lipsBuffer, teethBuffer} = this.state;

    if (
      jawBuffer.length > this.jawShift &&
      lipsBuffer.length > this.lipsShift &&
      teethBuffer.length > this.teethShift
    ) {
      return (this.result = {jaw: jawBuffer[0], lips: lipsBuffer[0], teeth: teethBuffer[0]});
    }

    return null;
  }
}
