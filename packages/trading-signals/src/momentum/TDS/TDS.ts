import {TradingSignal, TrendIndicatorSeries, type TradingSignals} from '../../base/Indicator.js';

type TDSState = {
  closes: number[];
  /*
   * Whether the latest bar completed a setup. TDS emits sparsely and its result persists between
   * setups, so only a bar that emitted may withdraw that emission when it gets replaced.
   */
  lastBarCompletedSetup: boolean;
  setupCount: number;
  setupDirection: 'bullish' | 'bearish' | null;
};

/**
 * Tom Demark's Sequential Indicator (TDS)
 * Type: Momentum
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
export class TDS extends TrendIndicatorSeries<number, TradingSignals, TDSState> {
  protected override state: TDSState = {
    closes: [],
    lastBarCompletedSetup: false,
    setupCount: 0,
    setupDirection: null,
  };

  override getRequiredInputs() {
    return 9;
  }

  update(close: number, replace: boolean): number | null {
    // Read before trackState() rewinds the flag to what the bar before the replaced one found
    if (replace && this.state.lastBarCompletedSetup) {
      this.rollbackLastResult();
    }

    this.trackState(replace);

    const state = this.state;

    state.closes.push(close);
    state.lastBarCompletedSetup = false;

    if (state.closes.length < 5) {
      return null;
    }
    // Only keep the last 13 closes for memory efficiency
    if (state.closes.length > 13) {
      state.closes.shift();
    }
    const index = state.closes.length - 1;
    const prev4 = state.closes[index - 4];
    if (close > prev4) {
      if (state.setupDirection === 'bearish') {
        state.setupCount = 1;
        state.setupDirection = 'bullish';
      } else {
        state.setupCount++;
        state.setupDirection = 'bullish';
      }
    } else if (close < prev4) {
      if (state.setupDirection === 'bullish') {
        state.setupCount = 1;
        state.setupDirection = 'bearish';
      } else {
        state.setupCount++;
        state.setupDirection = 'bearish';
      }
    }
    // Setup completed
    if (state.setupCount >= this.getRequiredInputs()) {
      const result = state.setupDirection === 'bullish' ? 1 : -1;
      state.setupCount = 0;
      state.setupDirection = null;
      state.lastBarCompletedSetup = true;
      return this.setResult(result, replace);
    }
    return null;
  }

  protected calculateSignalState(result?: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isOverbought = hasResult && result === 1; // Bullish setup completed - potential reversal down

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isOverbought:
        return TradingSignal.BULLISH;
      default:
        // Bearish setup completed (result === -1) - potential reversal up
        return TradingSignal.BEARISH;
    }
  }
}
