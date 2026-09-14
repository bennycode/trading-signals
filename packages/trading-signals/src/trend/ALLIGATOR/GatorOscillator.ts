import type {HighLow} from '../../base/Candle.type.js';
import {IndicatorInputShape, TechnicalIndicator} from '../../base/Indicator.js';
import {Alligator, type AlligatorConfig} from './Alligator.js';

export type GatorOscillatorResult = {
  /** Always at or below zero: distance between the Alligator's teeth and lips, mirrored below the zero line */
  lower: number;
  /** Always at or above zero: distance between the Alligator's jaw and teeth */
  upper: number;
};

/**
 * Gator Oscillator (GATOR)
 * Type: Trend
 *
 * Bill Williams' companion to his Alligator ("Trading Chaos", 1995): it turns the spread between the Alligator's
 * displaced lines into two histograms around a zero line. The upper histogram measures how far the jaw and teeth
 * have separated, the lower histogram mirrors the separation of teeth and lips below zero. Reading the bars
 * together shows at a glance how soundly the alligator sleeps (lines intertwined, bars near zero) and how wide
 * its mouth opens (lines fanned, bars stretched).
 *
 * Interpretation:
 * Williams colors every bar by whether it grew or shrank against its predecessor and reads the market's cycle from
 * the color pairs of both histograms: awakening (one side growing), eating (both growing), sated (one side
 * shrinking) and sleeping (both shrinking). That reading requires bar-to-bar comparison across two histograms
 * rather than a fixed threshold, so this class emits no standalone signal.
 *
 * @see https://www.metatrader5.com/en/terminal/help/indicators/bw_indicators/go
 */
export class GatorOscillator extends TechnicalIndicator<GatorOscillatorResult, HighLow<number>> {
  override readonly inputShape = IndicatorInputShape.HIGH_LOW;

  readonly #alligator: Alligator;

  constructor(config?: AlligatorConfig) {
    super();
    this.#alligator = new Alligator(config);
  }

  override getRequiredInputs() {
    return this.#alligator.getRequiredInputs();
  }

  update(candle: HighLow<number>, replace: boolean) {
    const alligator = this.#alligator.update(candle, replace);

    if (alligator === null) {
      return null;
    }

    return (this.result = {
      lower: -Math.abs(alligator.teeth - alligator.lips),
      upper: Math.abs(alligator.jaw - alligator.teeth),
    });
  }
}
