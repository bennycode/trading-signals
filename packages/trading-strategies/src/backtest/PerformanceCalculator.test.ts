import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {PerformanceCalculator} from './PerformanceCalculator.js';

describe('PerformanceCalculator risk-adjusted metrics', () => {
  it('calculates Sharpe and Sortino from consecutive equity returns', () => {
    const equityCurve = ['100', '110', '99', '118.8'].map(value => new Big(value));

    expect(PerformanceCalculator.calculateSharpeRatio(equityCurve)?.toNumber()).toBeCloseTo(0.534522, 6);
    expect(PerformanceCalculator.calculateSortinoRatio(equityCurve)?.toNumber()).toBeCloseTo(1.154701, 6);
  });

  it('calculates the largest peak-to-trough drawdown as a positive percentage', () => {
    const equityCurve = ['100', '120', '90', '108', '80', '100'].map(value => new Big(value));

    expect(PerformanceCalculator.calculateMaxDrawdown(equityCurve).toNumber()).toBeCloseTo(33.333333, 6);
  });

  it('reports no risk ratio when insufficient or zero-variance data leaves nothing to divide by', () => {
    const flatEquityCurve = ['100', '100', '100'].map(value => new Big(value));

    expect(
      PerformanceCalculator.calculateSharpeRatio([]),
      'a curve with fewer than two points yields no returns to measure'
    ).toBeNull();
    expect(PerformanceCalculator.calculateSharpeRatio(flatEquityCurve), 'zero variance has no deviation').toBeNull();
    expect(
      PerformanceCalculator.calculateSortinoRatio(flatEquityCurve),
      'zero downside deviation has nothing to divide by'
    ).toBeNull();
    expect(
      PerformanceCalculator.calculateMaxDrawdown(flatEquityCurve).toFixed(),
      'a flat curve genuinely never declines, so zero is a real drawdown rather than a missing value'
    ).toBe('0');
  });

  it('never ranks a curve without losses below one that lost money', () => {
    const flawless = ['100', '101', '102', '103', '104'].map(value => new Big(value));
    const lossy = ['100', '104', '99', '106', '104'].map(value => new Big(value));

    expect(
      PerformanceCalculator.calculateSortinoRatio(flawless),
      'no losing candle means no downside deviation, so the ratio is absent rather than zero'
    ).toBeNull();
    expect(
      PerformanceCalculator.calculateSortinoRatio(lossy)?.toNumber(),
      'a curve that did lose money has a measurable downside, so it stays comparable'
    ).toBeCloseTo(0.423669, 6);
  });

  it('reports no Sharpe ratio for a perfectly steady winner', () => {
    const steadyGain = ['100', '110', '121'].map(value => new Big(value));

    expect(
      PerformanceCalculator.calculateSharpeRatio(steadyGain),
      'a constant +10% per candle has zero variance, and zero would read as no edge at all'
    ).toBeNull();
  });
});
