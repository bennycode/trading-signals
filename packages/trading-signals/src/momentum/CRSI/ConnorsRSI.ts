import {ThresholdCrossSeries} from '../../base/Indicator.js';
import type {SignalThresholds} from '../../base/SignalThresholds.type.js';
import {RSI} from '../RSI/RSI.js';

export type ConnorsRSIConfig = {
  /** Ranking window of previous one-bar returns — the return being ranked stays outside the window. */
  percentRankInterval?: number;
  rsiInterval?: number;
  signalThresholds?: SignalThresholds;
  streakRsiInterval?: number;
};

type ConnorsRSIState = {
  previousClose: number | null;
  returns: number[];
  /**
   * Signed length of the current run of closes: positive while rising, negative while falling.
   * An unchanged close resets the run to zero, a direction change restarts it at one.
   */
  streak: number;
};

/**
 * Connors RSI (CRSI)
 * Type: Momentum
 *
 * Developed by Larry Connors and Cesar Alvarez ("An Introduction to ConnorsRSI", Connors Research
 * Trading Strategy Series, 2012), the Connors RSI is a short-term oscillator ranging from 0 to 100.
 * It averages three momentum readings: a short RSI on closing prices, an even shorter RSI on the
 * streak of consecutive up/down closes, and the percent rank of the current one-bar return against
 * the previous returns. All three components react within a few bars, so the CRSI reaches its
 * extremes far more often than the classic RSI, which makes it suitable for timing short-term
 * pullbacks within a larger trend.
 *
 * Interpretation:
 * A CRSI value of 90 or above indicates an overbought condition, a value of 10 or below an oversold
 * condition. Connors trades these extremes mean-reverting: oversold readings mark buying
 * opportunities and overbought readings mark selling opportunities.
 *
 * @see https://www.tradingview.com/support/solutions/43000502017-connors-rsi-crsi/
 * @see https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/connorsrsi
 */
export class ConnorsRSI extends ThresholdCrossSeries<number, ConnorsRSIState> {
  protected override state: ConnorsRSIState = {
    previousClose: null,
    returns: [],
    streak: 0,
  };

  readonly #priceRsi: RSI;
  readonly #streakRsi: RSI;

  public readonly percentRankInterval: number;
  public readonly rsiInterval: number;
  public readonly streakRsiInterval: number;

  constructor({
    percentRankInterval = 100,
    rsiInterval = 3,
    signalThresholds = {},
    streakRsiInterval = 2,
  }: ConnorsRSIConfig = {}) {
    const {overbought = 90, oversold = 10} = signalThresholds;
    super({overbought, oversold});
    this.percentRankInterval = percentRankInterval;
    this.rsiInterval = rsiInterval;
    this.streakRsiInterval = streakRsiInterval;
    this.#priceRsi = new RSI(rsiInterval);
    this.#streakRsi = new RSI(streakRsiInterval);
  }

  override getRequiredInputs() {
    /*
     * The slowest component dictates the warm-up. A RSI on closes needs one close more than its
     * interval before its first reading. The streak and the one-bar return only exist from the
     * second close on, which delays their components by one additional close; the percent rank
     * furthermore needs a full window of previous returns besides the return being ranked.
     */
    const priceRsiWarmUp = this.rsiInterval + 1;
    const streakRsiWarmUp = this.streakRsiInterval + 2;
    const percentRankWarmUp = this.percentRankInterval + 2;

    return Math.max(priceRsiWarmUp, streakRsiWarmUp, percentRankWarmUp);
  }

  update(close: number, replace: boolean) {
    this.trackState(replace);

    const {previousClose, streak: previousStreak} = this.state;
    const priceRsiResult = this.#priceRsi.update(close, replace);

    this.state.previousClose = close;

    if (previousClose === null) {
      return null;
    }

    const streak = this.#nextStreak(close, previousClose, previousStreak);
    this.state.streak = streak;
    const streakRsiResult = this.#streakRsi.update(streak, replace);

    const currentReturn = ((close - previousClose) / previousClose) * 100;
    const {returns} = this.state;

    /*
     * Only strictly smaller previous returns raise the rank: a move that merely matches an
     * earlier one signals no additional strength.
     */
    const percentRank =
      returns.length === this.percentRankInterval
        ? (returns.filter(previousReturn => previousReturn < currentReturn).length / this.percentRankInterval) * 100
        : null;

    returns.push(currentReturn);

    if (returns.length > this.percentRankInterval) {
      returns.shift();
    }

    if (priceRsiResult === null || streakRsiResult === null || percentRank === null) {
      return null;
    }

    return this.setResult((priceRsiResult + streakRsiResult + percentRank) / 3, replace);
  }

  #nextStreak(close: number, previousClose: number, previousStreak: number) {
    if (close > previousClose) {
      return previousStreak > 0 ? previousStreak + 1 : 1;
    }

    if (close < previousClose) {
      return previousStreak < 0 ? previousStreak - 1 : -1;
    }

    return 0;
  }
}
