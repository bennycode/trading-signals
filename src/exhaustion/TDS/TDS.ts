import type {TrendIndicator} from '../../types/Indicator.js';
import {IndicatorSeries, TrendSignal} from '../../types/Indicator.js';

/**
 * Tom Demark's Sequential Indicator (TDS)
 * Type: Exhaustion
 *
 * The TD Sequential indicator is used to identify potential turning points in the price of an asset.
 * It consists of two phases: TD Setup and TD Countdown. This implementation focuses on the TD Setup phase,
 * which is the most commonly used part for trend exhaustion signals.
 *
 * - A bullish setup occurs when there are 9 consecutive closes greater than the close 4 bars earlier. A possible sell opportunity is when the low of bars 6 and 7 in the count are exceeded by the low of bars 8 or 9.
 * - A bearish setup occurs when there are 9 consecutive closes less than the close 4 bars earlier. A possible buy opportunity is when the low of bars 6 and 7 in the count are exceeded by the low of bars 8 or 9.
 *
 * @see https://github.com/bennycode/trading-signals/discussions/239
 * @see https://hackernoon.com/how-to-buy-sell-cryptocurrency-with-number-indicator-td-sequential-5af46f0ebce1
 * @see https://practicaltechnicalanalysis.blogspot.com/2013/01/tom-demark-sequential.html
 */
export class TDS extends IndicatorSeries implements TrendIndicator {
  private readonly closes: number[] = [];
  private setupCount: number = 0;
  private setupDirection: 'bullish' | 'bearish' | null = null;

  override getRequiredInputs() {
    return 9;
  }

  update(close: number, replace: boolean): number | null {
    if (replace) {
      this.closes.pop();
    }
    this.closes.push(close);
    if (this.closes.length < 5) {
      return null;
    }
    // Only keep the last 13 closes for memory efficiency
    if (this.closes.length > 13) {
      this.closes.shift();
    }
    const index = this.closes.length - 1;
    const prev4 = this.closes[index - 4];
    if (close > prev4) {
      if (this.setupDirection === 'bearish') {
        this.setupCount = 1;
        this.setupDirection = 'bullish';
      } else {
        this.setupCount++;
        this.setupDirection = 'bullish';
      }
    } else if (close < prev4) {
      if (this.setupDirection === 'bullish') {
        this.setupCount = 1;
        this.setupDirection = 'bearish';
      } else {
        this.setupCount++;
        this.setupDirection = 'bearish';
      }
    }
    // Setup completed
    if (this.setupCount >= this.getRequiredInputs()) {
      const result = this.setupDirection === 'bullish' ? 1 : -1;
      this.setupCount = 0;
      this.setupDirection = null;
      return this.setResult(result, replace);
    }
    return null;
  }

  getSignal() {
    const tds = this.getResult();

    if (tds === null) {
      return {
        changed: false,
        signal: TrendSignal.UNKNOWN,
      };
    }

    // Bullish setup completed (1) - trend exhaustion, potential reversal down
    if (tds === 1) {
      return {
        changed: false,
        signal: TrendSignal.BULLISH,
      };
    }

    // Bearish setup completed (-1) - trend exhaustion, potential reversal up
    if (tds === -1) {
      return {
        changed: false,
        signal: TrendSignal.BEARISH,
      };
    }

    return {
      changed: false,
      signal: TrendSignal.SIDEWAYS,
    };
  }
}
