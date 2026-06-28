import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {PerformanceCalculator} from './PerformanceCalculator.js';

function toEquityCurve(values: number[]): Big[] {
  return values.map(value => new Big(value));
}

describe('PerformanceCalculator', () => {
  describe('calculateMaxDrawdown', () => {
    it('returns 0 for an empty or single-point curve', () => {
      expect(PerformanceCalculator.calculateMaxDrawdown([]).toNumber(), 'empty curve').toBe(0);
      expect(PerformanceCalculator.calculateMaxDrawdown(toEquityCurve([100])).toNumber(), 'single point').toBe(0);
    });

    it('returns 0 when the curve never falls below a prior peak', () => {
      const drawdown = PerformanceCalculator.calculateMaxDrawdown(toEquityCurve([100, 110, 120, 130]));
      expect(drawdown.toNumber(), 'monotonically rising equity has no drawdown').toBe(0);
    });

    it('measures the largest peak-to-trough drop as a positive percentage', () => {
      // Peak 200, trough 150 → 25% drawdown, even though the curve recovers afterwards.
      const drawdown = PerformanceCalculator.calculateMaxDrawdown(toEquityCurve([100, 200, 150, 180, 250]));
      expect(drawdown.toNumber(), '50/200 = 25% peak-to-trough decline').toBe(25);
    });

    it('keeps the deepest drawdown when several occur', () => {
      // First dip 100→90 (10%), second dip 120→60 (50%). The deeper one wins.
      const drawdown = PerformanceCalculator.calculateMaxDrawdown(toEquityCurve([100, 90, 120, 60, 130]));
      expect(drawdown.toNumber(), 'deepest of multiple drawdowns').toBe(50);
    });
  });
});
