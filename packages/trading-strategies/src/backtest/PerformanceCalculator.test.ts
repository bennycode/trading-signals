import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {PerformanceCalculator} from './PerformanceCalculator.js';

describe('PerformanceCalculator risk-adjusted metrics', () => {
  it('calculates Sharpe and Sortino from consecutive equity returns', () => {
    const equityCurve = ['100', '110', '99', '118.8'].map(value => new Big(value));

    expect(PerformanceCalculator.calculateSharpeRatio(equityCurve).toNumber()).toBeCloseTo(0.534522, 6);
    expect(PerformanceCalculator.calculateSortinoRatio(equityCurve).toNumber()).toBeCloseTo(1.154701, 6);
  });

  it('calculates the largest peak-to-trough drawdown as a positive percentage', () => {
    const equityCurve = ['100', '120', '90', '108', '80', '100'].map(value => new Big(value));

    expect(PerformanceCalculator.calculateMaxDrawdown(equityCurve).toNumber()).toBeCloseTo(33.333333, 6);
  });

  it('returns finite zeroes when a risk ratio has insufficient or zero-variance data', () => {
    const flatEquityCurve = ['100', '100', '100'].map(value => new Big(value));

    expect(PerformanceCalculator.calculateSharpeRatio([]).toFixed()).toBe('0');
    expect(PerformanceCalculator.calculateSharpeRatio(flatEquityCurve).toFixed()).toBe('0');
    expect(PerformanceCalculator.calculateSortinoRatio(flatEquityCurve).toFixed()).toBe('0');
    expect(PerformanceCalculator.calculateMaxDrawdown(flatEquityCurve).toFixed()).toBe('0');
  });
});
