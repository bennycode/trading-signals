import {BreakoutBarLow} from './BREAKOUT_BAR_LOW/BreakoutBarLow.js';
import {HigherLowTrail} from './HIGHER_LOW_TRAIL/HigherLowTrail.js';
import {SwingLookback} from './SWING_LOW/SwingLookback.js';
import {SwingLow} from './SWING_LOW/SwingLow.js';

/**
 * AMD daily candles, 2026-01-20 → 2026-04-17 (62 sessions), fetched from Alpaca.
 * Used to cross-check where each stop-loss concept places its level on the same
 * real-world dataset.
 */
const AMD_CANDLES = [
  {date: '2026-01-20', high: 239.47, low: 225.55},
  {date: '2026-01-21', high: 252.885, low: 235.965},
  {date: '2026-01-22', high: 255.935, low: 246.695},
  {date: '2026-01-23', high: 266.95, low: 256.26},
  {date: '2026-01-26', high: 258.145, low: 250.335},
  {date: '2026-01-27', high: 255.515, low: 248.1},
  {date: '2026-01-28', high: 257.26, low: 250.21},
  {date: '2026-01-29', high: 260.44, low: 241.01},
  {date: '2026-01-30', high: 245.13, low: 234.59},
  {date: '2026-02-02', high: 249.94, low: 235.085},
  {date: '2026-02-03', high: 252.47, low: 237.155},
  {date: '2026-02-04', high: 217.83, low: 199.26},
  {date: '2026-02-05', high: 203.95, low: 190.74},
  {date: '2026-02-06', high: 209.225, low: 196.47},
  {date: '2026-02-09', high: 217.56, low: 204.23},
  {date: '2026-02-10', high: 219.35, low: 213.18},
  {date: '2026-02-11', high: 219.595, low: 209.32},
  {date: '2026-02-12', high: 218.35, low: 205.21},
  {date: '2026-02-13', high: 210.01, low: 204.035},
  {date: '2026-02-17', high: 205.24, low: 194.94},
  {date: '2026-02-18', high: 203.2, low: 195.13},
  {date: '2026-02-19', high: 204, low: 198.49},
  {date: '2026-02-20', high: 204.84, low: 198.66},
  {date: '2026-02-23', high: 199.26, low: 194.26},
  {date: '2026-02-24', high: 216.68, low: 206.67},
  {date: '2026-02-25', high: 216.38, low: 210.36},
  {date: '2026-02-26', high: 209.29, low: 201.51},
  {date: '2026-02-27', high: 201.845, low: 197.74},
  {date: '2026-03-02', high: 198.73, low: 190},
  {date: '2026-03-03', high: 193.59, low: 188.23},
  {date: '2026-03-04', high: 202.44, low: 189.905},
  {date: '2026-03-05', high: 203.7, low: 194.93},
  {date: '2026-03-06', high: 200.1, low: 191.32},
  {date: '2026-03-09', high: 202.95, low: 189.22},
  {date: '2026-03-10', high: 206.495, low: 202.32},
  {date: '2026-03-11', high: 209.14, low: 203.66},
  {date: '2026-03-12', high: 203.62, low: 196.69},
  {date: '2026-03-13', high: 199.66, low: 192.29},
  {date: '2026-03-16', high: 200.12, low: 194.86},
  {date: '2026-03-17', high: 199.14, low: 195.26},
  {date: '2026-03-18', high: 202.86, low: 195.91},
  {date: '2026-03-19', high: 205.825, low: 192.91},
  {date: '2026-03-20', high: 206.25, low: 198.33},
  {date: '2026-03-23', high: 209.06, low: 201.745},
  {date: '2026-03-24', high: 206.41, low: 200.24},
  {date: '2026-03-25', high: 221.31, low: 211.645},
  {date: '2026-03-26', high: 221, low: 203.465},
  {date: '2026-03-27', high: 202.98, low: 197.71},
  {date: '2026-03-30', high: 208.265, low: 192.915},
  {date: '2026-03-31', high: 203.98, low: 196.46},
  {date: '2026-04-01', high: 213.775, low: 206.2},
  {date: '2026-04-02', high: 217.69, low: 200.69},
  {date: '2026-04-06', high: 226.28, low: 217.84},
  {date: '2026-04-07', high: 221.99, low: 215.47},
  {date: '2026-04-08', high: 233.91, low: 227.11},
  {date: '2026-04-09', high: 237.05, low: 231.02},
  {date: '2026-04-10', high: 249.5, low: 239.545},
  {date: '2026-04-13', high: 247.285, low: 242.08},
  {date: '2026-04-14', high: 255.415, low: 245.85},
  {date: '2026-04-15', high: 258.17, low: 251.93},
  {date: '2026-04-16', high: 279.3, low: 261.7},
  {date: '2026-04-17', high: 280.03, low: 274.21},
] as const;

function collectEmissions<Candle extends {date: string}>(
  candles: readonly Candle[],
  feed: (candle: Candle) => number | null
): {date: string; value: number}[] {
  const emissions: {date: string; value: number}[] = [];

  candles.forEach(candle => {
    const value = feed(candle);

    if (value !== null) {
      emissions.push({date: candle.date, value});
    }
  });

  return emissions;
}

describe('Stop-loss comparison on AMD (2026-01-20 → 2026-04-17)', () => {
  // Final close on 2026-04-17 was $278.29; the stock ran +~48% off the 2026-03-03 low.

  describe('SwingLow', () => {
    // Note: emission date = pivot-bar date + `lookback` bars (confirmation lag).

    it('places the final stop at the last confirmed symmetric swing low with Bill Williams lookback', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});
      const emissions = collectEmissions(AMD_CANDLES, candle => swingLow.add(candle));

      // Pivot 2026-03-30, confirmed 2 bars later on 2026-04-01.
      expect(emissions.at(-1)).toEqual({date: '2026-04-01', value: 192.915});
      expect(swingLow.getResultOrThrow()).toBe(192.915);
    });

    it('places the final stop at the same low with the stricter chartist lookback', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.CHARTISTS});
      const emissions = collectEmissions(AMD_CANDLES, candle => swingLow.add(candle));

      // Pivot dates: 2026-02-05, 2026-03-03, 2026-03-30 — confirmed 5 bars later each.
      expect(emissions).toEqual([
        {date: '2026-02-12', value: 190.74},
        {date: '2026-03-10', value: 188.23},
        {date: '2026-04-07', value: 192.915},
      ]);
      expect(swingLow.getResultOrThrow()).toBe(192.915);
    });
  });

  describe('HigherLowTrail', () => {
    it('raises the stop to the 2026-04-16 breakout-bar low with one-bar confirmation', () => {
      const trail = new HigherLowTrail({lookback: 1});
      const emissions = collectEmissions(AMD_CANDLES, candle => trail.add(candle));

      expect(emissions.at(-1)).toEqual({date: '2026-04-17', value: 261.7});
      expect(trail.getResultOrThrow()).toBe(261.7);
    });

    it('emits every one-sided pullback low when monotonic is disabled', () => {
      const trail = new HigherLowTrail({lookback: 1, monotonic: false});
      const emissions = collectEmissions(AMD_CANDLES, candle => trail.add(candle));

      // Non-monotonic fires on every bar where the previous bar's low was strictly lower,
      // so it generates many more emissions than the monotonic variant.
      expect(emissions.length).toBeGreaterThan(20);
      expect(emissions.at(-1)).toEqual({date: '2026-04-17', value: 261.7});
    });
  });

  describe('BreakoutBarLow', () => {
    it('places the stop at the low of the most recent 20-day breakout bar', () => {
      const breakout = new BreakoutBarLow({lookback: 20});
      const emissions = collectEmissions(AMD_CANDLES, candle => breakout.add(candle));

      expect(emissions.at(-1)).toEqual({date: '2026-04-17', value: 274.21});
      expect(emissions.at(-2)).toEqual({date: '2026-04-16', value: 261.7});
      expect(breakout.getResultOrThrow()).toBe(274.21);
    });
  });

  describe('all three stop concepts on the same dataset', () => {
    it('places stops at distinct levels reflecting their different tradeoffs', () => {
      const swingLow = new SwingLow({lookback: SwingLookback.BILL_WILLIAMS});
      const trail = new HigherLowTrail({lookback: 1});
      const breakout = new BreakoutBarLow({lookback: 20});

      AMD_CANDLES.forEach(candle => {
        swingLow.add(candle);
        trail.add(candle);
        breakout.add(candle);
      });

      const structural = swingLow.getResultOrThrow();
      const trailing = trail.getResultOrThrow();
      const momentum = breakout.getResultOrThrow();

      // Structural (symmetric fractal) lags the most and sits deepest below price.
      // Trailing (one-sided, monotonic) sits in the middle after confirming the rally.
      // Momentum (20-day breakout-bar low) sits highest — tied to the latest breakout.
      expect(structural).toBeLessThan(trailing);
      expect(trailing).toBeLessThan(momentum);

      expect({momentum, structural, trailing}).toEqual({
        momentum: 274.21,
        structural: 192.915,
        trailing: 261.7,
      });
    });
  });
});
